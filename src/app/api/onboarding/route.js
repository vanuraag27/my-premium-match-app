import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

// Check if user exists by email/userId (The Login Check Hook)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing active user node identifier.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');
    const collection = db.collection('users');

    const existingUser = await collection.findOne({ userId: userId });

    if (!existingUser) {
      return NextResponse.json({ success: true, exists: false });
    }

    // Fetch matching partner nodes excluding the user themselves
    const searchCriteria = { userId: { $ne: userId } };
    const rawMatchesList = await collection.find(searchCriteria).limit(20).toArray();

    const formattedMatches = rawMatchesList.map((item) => ({
      id: item._id.toString(),
      userId: item.userId,
      name: item.name || 'Anonymous Node',
      bio: item.rawBio || 'No tracking bio information recorded.',
      photoUrl: item.photoUrl || '',
      profession: item.profession || 'Professional',
      score: Math.floor(Math.random() * (99 - 78 + 1)) + 78,
      aiAnalysis: item.aiAnalysis || { communication: 'Synergistic Integration' }
    }));
    formattedMatches.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      exists: true,
      profile: existingUser,
      matches: formattedMatches
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Instantiate or Update Profile Document Matrix
export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, name, rawBio, photoUrl, profession, searchProfession, searchKeyword } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing active user node identifier.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');
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

    const formattedMatches = rawMatchesList.map((item) => ({
      id: item._id.toString(),
      userId: item.userId,
      name: item.name || 'Anonymous Node',
      bio: item.rawBio || 'No tracking bio information recorded.',
      photoUrl: item.photoUrl || '',
      profession: item.profession || 'Professional',
      score: Math.floor(Math.random() * (99 - 78 + 1)) + 78,
      aiAnalysis: item.aiAnalysis || { communication: 'Synergistic Integration' }
    }));

    formattedMatches.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      matches: formattedMatches
    });

  } catch (error) {
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

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    await db.collection('users').deleteMany({
      $or: [{ userId: userId }, { email: userId }]
    });

    return NextResponse.json({ success: true, message: 'All matching records successfully wiped out.' });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Database removal action rejected.' }, { status: 500 });
  }
}