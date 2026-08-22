import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { getMessageRequestStatus } from '../../../services/messageRequestHelpers';
import { isSessionAuthorized, unauthorizedResponse } from '../../../services/sessionHelpers';

// Common English filler words + generic dating-bio filler words, excluded so
// keyword overlap rewards genuinely distinctive shared interests/traits
// (e.g. "hiking", "vegetarian", "startup") rather than words nearly every
// bio contains regardless of actual compatibility.
const BIO_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'had',
  'are', 'was', 'were', 'been', 'being', 'i', 'im', 'me', 'my', 'mine',
  'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it',
  'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs',
  'a', 'an', 'of', 'in', 'on', 'at', 'to', 'by', 'as', 'is', 'am', 'be',
  'but', 'or', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'very',
  'just', 'also', 'about', 'into', 'over', 'after', 'before', 'while',
  'who', 'whom', 'which', 'what', 'when', 'where', 'why', 'how', 'can',
  'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'do', 'does', 'did', 'doing', 'up', 'down', 'out', 'off', 'again',
  'once', 'here', 'there', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'now', 'love',
  'looking', 'like', 'enjoy', 'person', 'someone', 'life', 'people', 'get',
  'really', 'always', 'still', 'much', 'lot', 'lots', 'good', 'great', 'new'
]);

// Break a bio into a set of meaningful, comparable keywords: lowercase,
// alphabetic-only tokens of length >= 3, with filler words removed.
function extractBioKeywords(text) {
  return new Set(
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && /[a-z]/.test(word) && !BIO_STOPWORDS.has(word))
  );
}

// Helper function to calculate a real vector alignment score based on shared keywords
function calculateVectorScore(user, match) {
  let base = 70;
  
  // Professional Alignment Vector bonus
  const userProf = (user.profession || '').toLowerCase().trim();
  const matchProf = (match.profession || '').toLowerCase().trim();
  if (userProf === matchProf && userProf !== '') base += 15;
  else if (userProf.includes(matchProf) || matchProf.includes(userProf)) base += 8;

  // Bio Keyword Intersection bonus — dynamically derived from each bio's own
  // vocabulary (not a fixed word list), so it applies equally well to any
  // profession or interest, not just tech-industry terms.
  const userBioWords = extractBioKeywords(user.rawBio);
  const matchBioWords = extractBioKeywords(match.rawBio);

  let keywordMatches = 0;
  userBioWords.forEach((word) => {
    if (matchBioWords.has(word)) keywordMatches++;
  });

  base += Math.min(keywordMatches * 3, 14); // Caps keyword intersection bonus at 14%
  
  // Guarantee values stay tightly balanced in premium threshold matrix
  return Math.min(Math.max(base, 75), 99);
}

/**
 * Apply match percentage range filter after scores are computed.
 * Only filters when min or max values are explicitly provided.
 */
function applyMatchPercentageFilter(matches, minMatchPercent, maxMatchPercent) {
  const hasMin = minMatchPercent !== null && minMatchPercent !== undefined && minMatchPercent !== '';
  const hasMax = maxMatchPercent !== null && maxMatchPercent !== undefined && maxMatchPercent !== '';

  if (!hasMin && !hasMax) return matches;

  const min = hasMin ? Number(minMatchPercent) : 0;
  const max = hasMax ? Number(maxMatchPercent) : 100;

  return matches.filter((m) => m.score >= min && m.score <= max);
}

/**
 * Apply gender/age preference filters after scores are computed.
 * Only filters when the corresponding preference is explicitly provided.
 *
 * Backward compatibility: a candidate whose profile predates this feature
 * (gender/age not set) is never excluded by that specific filter — only
 * candidates who *have* a value that actually conflicts with the stated
 * preference are filtered out. This keeps existing profiles/matches intact
 * until people opt in by filling in the new optional fields.
 */
function applyPreferenceFilters(matches, { preferredGender, minAge, maxAge }) {
  let result = matches;

  if (preferredGender && preferredGender !== 'Any') {
    result = result.filter((m) => !m.gender || m.gender === preferredGender);
  }

  const hasMinAge = minAge !== null && minAge !== undefined && minAge !== '';
  const hasMaxAge = maxAge !== null && maxAge !== undefined && maxAge !== '';
  if (hasMinAge || hasMaxAge) {
    const min = hasMinAge ? Number(minAge) : 0;
    const max = hasMaxAge ? Number(maxAge) : 200;
    result = result.filter((m) => m.age === null || m.age === undefined || (m.age >= min && m.age <= max));
  }

  return result;
}

/**
 * Mutual preference matching: checks whether a candidate's OWN declared
 * preference (gender/age, persisted via the same filter panel) would
 * accept the viewer — not just whether the candidate satisfies the
 * viewer's filter. This is the reverse direction of applyPreferenceFilters.
 *
 * Backward compatible in both directions: a candidate who has never stated
 * a preference (preferenceFilterEnabled false/unset) accepts everyone, and
 * a viewer who hasn't stated their own gender/age is never excluded by a
 * candidate's preference either — only real, known conflicts filter someone
 * out, exactly like applyPreferenceFilters above.
 */
function satisfiesCandidatePreference(viewer, candidate) {
  if (!candidate.preferenceFilterEnabled) return true;

  if (candidate.preferredGender && candidate.preferredGender !== 'Any') {
    if (!viewer.gender) return true;
    if (viewer.gender !== candidate.preferredGender) return false;
  }

  const hasMin = candidate.minAge !== null && candidate.minAge !== undefined;
  const hasMax = candidate.maxAge !== null && candidate.maxAge !== undefined;
  if (hasMin || hasMax) {
    if (viewer.age === null || viewer.age === undefined) return true;
    const min = hasMin ? candidate.minAge : 0;
    const max = hasMax ? candidate.maxAge : 200;
    if (viewer.age < min || viewer.age > max) return false;
  }

  return true;
}

// Helper to safely resolve the MongoDB database instance
async function getDatabase() {
  try {
    const client = await clientPromise;
    return client.db('bandhan-engine');
  } catch (dbError) {
    console.error("MongoDB Connection Exception:", dbError);
    return null;
  }
}

// Validate base64 photo data on the server side
function validatePhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  
  // Handle Data URL (base64) validation
  if (photoUrl.startsWith('data:image/')) {
    const matches = photoUrl.match(/^data:(image\/(jpeg|jpg|png));base64,(.+)$/i);
    if (!matches) {
      return 'Invalid image format. Only JPG, JPEG, and PNG files are allowed.';
    }

    const base64Data = matches[3];
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    if (sizeInBytes > 2 * 1024 * 1024) {
      return 'Uploaded file exceeds the maximum limit of 2 MB.';
    }
  }
  return null;
}

// Fetch user profile and compute real vector matches
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing active user node identifier.' }, { status: 400 });
    }

    if (!isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connectivity offline. Check MONGODB_URI and IP whitelist configuration.' 
      }, { status: 500 });
    }

    const collection = db.collection('users');
    const existingUser = await collection.findOne({ userId: userId });

    if (!existingUser) {
      return NextResponse.json({ success: true, exists: false });
    }

    // Default audioNotificationsEnabled to true if not explicitly set
    if (existingUser.audioNotificationsEnabled === undefined) {
      existingUser.audioNotificationsEnabled = true;
    }

    // Fetch potential partner matching items excluding self
    const searchCriteria = { userId: { $ne: userId }, profileStatus: { $ne: 'deleted' } };

    // Optional profession/keyword/location search filters (mirrors POST's filtering
    // logic) so read-only polling can respect the same search the user has
    // applied, without needing to go through the profile-updating POST route.
    const searchProfession = searchParams.get('searchProfession');
    const searchKeyword = searchParams.get('searchKeyword');
    const searchLocation = searchParams.get('preferredLocation');

    if (searchProfession && searchProfession.trim() !== '') {
      searchCriteria.profession = { $regex: searchProfession.trim(), $options: 'i' };
    }

    if (searchKeyword && searchKeyword.trim() !== '') {
      searchCriteria.$or = [
        { name: { $regex: searchKeyword.trim(), $options: 'i' } },
        { rawBio: { $regex: searchKeyword.trim(), $options: 'i' } }
      ];
    }

    if (searchLocation && searchLocation.trim() !== '') {
      searchCriteria.location = { $regex: searchLocation.trim(), $options: 'i' };
    }

    const rawMatchesList = await collection.find(searchCriteria).sort({ updatedAt: -1 }).limit(100).toArray();

    // Mutual preference matching: only keep candidates whose own declared
    // preference (if any) would also accept this viewer.
    const mutuallyEligibleMatches = rawMatchesList.filter((item) => satisfiesCandidatePreference(existingUser, item));

    const formattedMatches = mutuallyEligibleMatches.map((item) => {
      const calculatedScore = calculateVectorScore(existingUser, item);
      const matchProfession = item.profession || 'Professional';
      
      return {
        id: item._id.toString(),
        userId: item.userId,
        name: item.name || 'Anonymous Node',
        bio: item.rawBio || 'No tracking bio information recorded.',
        photoUrl: item.photoUrl || '',
        profession: matchProfession,
        gender: item.gender || '',
        age: item.age ?? null,
        location: item.location || '',
        score: calculatedScore,
        aiAnalysis: {
          communication: item.aiAnalysis?.communication || 'Synergistic Synchronous Stream',
          temperament: item.aiAnalysis?.temperament || 'Analytical / High Adaptability Matrix',
          vision: item.aiAnalysis?.vision || 'Scalable Engineering Systems Deployment',
          breakdown: `Aligned vectors detected across professional domains. High synergy observed between your background and their profile as a ${matchProfession}, focusing on collaborative structural problem-solving.`
        }
      };
    });
    
    formattedMatches.sort((a, b) => b.score - a.score);

    // Optional match percentage range filter from query params (GET login flow)
    const minMatchPercent = searchParams.get('minMatchPercent');
    const maxMatchPercent = searchParams.get('maxMatchPercent');
    const scoreFilteredMatches = applyMatchPercentageFilter(formattedMatches, minMatchPercent, maxMatchPercent);

    // Optional gender/age preference filters from query params
    const preferredGender = searchParams.get('preferredGender');
    const minAge = searchParams.get('minAge');
    const maxAge = searchParams.get('maxAge');
    const filteredMatches = applyPreferenceFilters(scoreFilteredMatches, { preferredGender, minAge, maxAge });

    // Enrich matches with connection status for message request workflow
    const matchUserIds = filteredMatches.map((match) => String(match.userId));
    const presenceRows = matchUserIds.length
      ? await db.collection('presence').find({ userId: { $in: matchUserIds } }).project({ userId: 1, lastSeenAt: 1 }).toArray()
      : [];
    const onlineCutoff = Date.now() - 30 * 1000;
    const presenceMap = new Map(presenceRows.map((row) => [String(row.userId), Boolean(row.lastSeenAt && new Date(row.lastSeenAt).getTime() >= onlineCutoff)]));

    const matchesWithStatus = await Promise.all(
      filteredMatches.map(async (match) => ({
        ...match,
        isOnline: presenceMap.get(String(match.userId)) === true,
        messageRequestStatus: await getMessageRequestStatus(db, userId, match.userId),
      }))
    );

    return NextResponse.json({
      success: true,
      exists: true,
      profile: existingUser,
      matches: matchesWithStatus
    });

  } catch (error) {
    console.error("Onboarding GET Route Execution Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Instantiate or Update Profile Matrix
export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, name, rawBio, photoUrl, profession, gender, age, location, searchProfession, searchKeyword, preferredLocation, audioNotificationsEnabled, minMatchPercent, maxMatchPercent, preferredGender, minAge, maxAge, preferenceFilterEnabled } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing active user node identifier.' }, { status: 400 });
    }

    if (!isSessionAuthorized(req, userId)) {
      const { body: unauthBody, status } = unauthorizedResponse();
      return NextResponse.json(unauthBody, { status });
    }

    if (typeof rawBio !== 'string' || rawBio.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Bio & interests is required.' }, { status: 400 });
    }
    if (rawBio.length > 4000) {
      return NextResponse.json({ success: false, error: 'Bio & interests cannot exceed 4,000 characters.' }, { status: 400 });
    }

    // Server-side photo validation
    if (photoUrl) {
      const photoValidationError = validatePhotoUrl(photoUrl);
      if (photoValidationError) {
        return NextResponse.json({ success: false, error: photoValidationError }, { status: 400 });
      }
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connectivity offline. Check MONGODB_URI and IP whitelist configuration.' 
      }, { status: 500 });
    }

    const collection = db.collection('users');

    const updatedProfile = {
      userId,
      profileStatus: 'active',
      name,
      rawBio,
      photoUrl,
      profession: profession || 'Developer',
      // Optional demographic fields powering the new preference filters —
      // stored as empty/null when not provided, so existing profiles that
      // predate this feature keep working exactly as before until edited.
      gender: gender || '',
      age: age !== undefined && age !== null && age !== '' ? Number(age) : null,
      location: location || '',
      // "What I'm looking for" — the same fields the dashboard filter panel
      // uses to browse are persisted here as this user's own declared
      // preference, so other users' matching can respect it too (mutual
      // preference matching, see satisfiesCandidatePreference below).
      preferenceFilterEnabled: preferenceFilterEnabled === true,
      preferredGender: preferenceFilterEnabled === true ? (preferredGender || 'Any') : 'Any',
      minAge: preferenceFilterEnabled === true && minAge !== undefined && minAge !== null && minAge !== '' ? Number(minAge) : null,
      maxAge: preferenceFilterEnabled === true && maxAge !== undefined && maxAge !== null && maxAge !== '' ? Number(maxAge) : null,
      audioNotificationsEnabled: audioNotificationsEnabled !== undefined ? Boolean(audioNotificationsEnabled) : true,
      updatedAt: new Date(),
      aiAnalysis: body.aiAnalysis || {
        temperament: 'Adaptive Matrix Vector',
        vision: 'Dynamic Innovation Cluster Target',
        communication: 'Synergistic Network'
      }
    };

    await collection.updateOne(
      { userId: userId },
      { $set: updatedProfile },
      { upsert: true }
    );

    // Build conditional lookup filtering constraints
    let searchCriteria = { userId: { $ne: userId }, profileStatus: { $ne: 'deleted' } };

    if (searchProfession && searchProfession.trim() !== '') {
      searchCriteria.profession = { $regex: searchProfession.trim(), $options: 'i' };
    }

    if (searchKeyword && searchKeyword.trim() !== '') {
      searchCriteria.$or = [
        { name: { $regex: searchKeyword.trim(), $options: 'i' } },
        { rawBio: { $regex: searchKeyword.trim(), $options: 'i' } }
      ];
    }

    if (preferredLocation && preferredLocation.trim() !== '') {
      searchCriteria.location = { $regex: preferredLocation.trim(), $options: 'i' };
    }

    const rawMatchesList = await collection.find(searchCriteria).sort({ updatedAt: -1 }).limit(100).toArray();

    // Mutual preference matching: only keep candidates whose own declared
    // preference (if any) would also accept this viewer.
    const mutuallyEligibleMatches = rawMatchesList.filter((item) => satisfiesCandidatePreference(updatedProfile, item));

    const formattedMatches = mutuallyEligibleMatches.map((item) => {
      const calculatedScore = calculateVectorScore(updatedProfile, item);
      const matchProfession = item.profession || 'Professional';
      
      return {
        id: item._id.toString(),
        userId: item.userId,
        name: item.name || 'Anonymous Node',
        bio: item.rawBio || 'No tracking bio information recorded.',
        photoUrl: item.photoUrl || '',
        profession: matchProfession,
        gender: item.gender || '',
        age: item.age ?? null,
        location: item.location || '',
        score: calculatedScore,
        aiAnalysis: {
          communication: item.aiAnalysis?.communication || 'Synergistic Synchronous Stream',
          temperament: item.aiAnalysis?.temperament || 'Analytical / High Adaptability Matrix',
          vision: item.aiAnalysis?.vision || 'Scalable Engineering Systems Deployment',
          breakdown: `Aligned vectors detected across professional domains. High synergy observed between your background and their profile as a ${matchProfession}, focusing on collaborative structural problem-solving.`
        }
      };
    });

    formattedMatches.sort((a, b) => b.score - a.score);

    // Apply match percentage range filter when provided via filter UI
    const scoreFilteredMatches = applyMatchPercentageFilter(formattedMatches, minMatchPercent, maxMatchPercent);

    // Apply gender/age preference filters when provided via filter UI
    const filteredMatches = applyPreferenceFilters(scoreFilteredMatches, { preferredGender, minAge, maxAge });

    // Enrich matches with connection status for message request workflow
    const matchUserIds = filteredMatches.map((match) => String(match.userId));
    const presenceRows = matchUserIds.length
      ? await db.collection('presence').find({ userId: { $in: matchUserIds } }).project({ userId: 1, lastSeenAt: 1 }).toArray()
      : [];
    const onlineCutoff = Date.now() - 30 * 1000;
    const presenceMap = new Map(presenceRows.map((row) => [String(row.userId), Boolean(row.lastSeenAt && new Date(row.lastSeenAt).getTime() >= onlineCutoff)]));

    const matchesWithStatus = await Promise.all(
      filteredMatches.map(async (match) => ({
        ...match,
        isOnline: presenceMap.get(String(match.userId)) === true,
        messageRequestStatus: await getMessageRequestStatus(db, userId, match.userId),
      }))
    );

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      matches: matchesWithStatus
    });

  } catch (error) {
    console.error("Onboarding POST Route Execution Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Wipe user profile metrics completely
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing target userId node entry.' }, { status: 400 });
    }

    if (!isSessionAuthorized(req, userId)) {
      const { body, status } = unauthorizedResponse();
      return NextResponse.json(body, { status });
    }

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connectivity offline. Check MONGODB_URI and IP whitelist configuration.' 
      }, { status: 500 });
    }

    const deletionResult = await db.collection('users').deleteMany({
      $or: [{ userId: userId }, { email: userId }]
    });

    console.log(`🗑️ VibeKey profile deletion complete. Removed ${deletionResult.deletedCount} matching profile record(s) for ${userId}.`);

    return NextResponse.json({ success: true, message: 'All matching records successfully wiped out.' });

  } catch (error) {
    console.error("Onboarding DELETE Route Execution Error:", error);
    return NextResponse.json({ success: false, error: 'Database removal action rejected.' }, { status: 500 });
  }
}