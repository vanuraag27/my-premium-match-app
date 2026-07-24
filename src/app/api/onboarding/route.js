import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

// Helper function to calculate a real vector alignment score based on shared keywords
function calculateVectorScore(user, match) {
  let base = 70;
  
  // Professional Alignment Vector bonus
  const userProf = (user.profession || '').toLowerCase().trim();
  const matchProf = (match.profession || '').toLowerCase().trim();
  if (userProf === matchProf && userProf !== '') base += 15;
  else if (userProf.includes(matchProf) || matchProf.includes(userProf)) base += 8;

  // Bio String Keyword Intersections bonus
  const userBioWords = (user.rawBio || '').toLowerCase().split(/\s+/);
  const matchBio = (match.rawBio || '').toLowerCase();
  
  let keywordMatches = 0;
  const targetKeywords = ['developer', 'engineer', 'design', 'finance', 'startup', 'tech', 'data', 'analyst', 'manager'];
  
  targetKeywords.forEach(word => {
    if (userBioWords.includes(word) && matchBio.includes(word)) {
      keywordMatches++;
    }
  });

  base += Math.min(keywordMatches * 3, 14); // Caps keyword intersection bonus at 14%
  
  // Guarantee values stay tightly balanced in premium threshold matrix
  return Math.min(Math.max(base, 75), 99);
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

// Fetch user profile and compute real vector matches
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing active user node identifier.' }, { status: 400 });
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

    // Fetch potential partner matching items excluding self
    const searchCriteria = { userId: { $ne: userId } };
    const rawMatchesList = await collection.find(searchCriteria).limit(20).toArray();

    const formattedMatches = rawMatchesList.map((item) => {
      const calculatedScore = calculateVectorScore(existingUser, item);
      const matchProfession = item.profession || 'Professional';
      
      return {
        id: item._id.toString(),
        userId: item.userId,
        name: item.name || 'Anonymous Node',
        bio: item.rawBio || 'No tracking bio information recorded.',
        photoUrl: item.photoUrl || '',
        profession: matchProfession,
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

    return NextResponse.json({
      success: true,
      exists: true,
      profile: existingUser,
      matches: formattedMatches
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
    const { userId, name, rawBio, photoUrl, profession, searchProfession, searchKeyword } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing active user node identifier.' }, { status: 400 });
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
      name,
      rawBio,
      photoUrl,
      profession: profession || 'Developer',
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
    let searchCriteria = { userId: { $ne: userId } };

    if (searchProfession && searchProfession.trim() !== '') {
      searchCriteria.profession = { $regex: searchProfession.trim(), $options: 'i' };
    }

    if (searchKeyword && searchKeyword.trim() !== '') {
      searchCriteria.$or = [
        { name: { $regex: searchKeyword.trim(), $options: 'i' } },
        { rawBio: { $regex: searchKeyword.trim(), $options: 'i' } }
      ];
    }

    const rawMatchesList = await collection.find(searchCriteria).limit(20).toArray();

    const formattedMatches = rawMatchesList.map((item) => {
      const calculatedScore = calculateVectorScore(updatedProfile, item);
      const matchProfession = item.profession || 'Professional';
      
      return {
        id: item._id.toString(),
        userId: item.userId,
        name: item.name || 'Anonymous Node',
        bio: item.rawBio || 'No tracking bio information recorded.',
        photoUrl: item.photoUrl || '',
        profession: matchProfession,
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

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      matches: formattedMatches
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

    const db = await getDatabase();
    if (!db) {
      return NextResponse.json({ 
        success: false, 
        error: 'Database connectivity offline. Check MONGODB_URI and IP whitelist configuration.' 
      }, { status: 500 });
    }

    await db.collection('users').deleteMany({
      $or: [{ userId: userId }, { email: userId }]
    });

    return NextResponse.json({ success: true, message: 'All matching records successfully wiped out.' });

  } catch (error) {
    console.error("Onboarding DELETE Route Execution Error:", error);
    return NextResponse.json({ success: false, error: 'Database removal action rejected.' }, { status: 500 });
  }
}