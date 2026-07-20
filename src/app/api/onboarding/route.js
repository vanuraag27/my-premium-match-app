import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

// Phase A: Fetch an already existing user profile by email/userId (The Login Check)
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

    // Look for existing user profile document
    const existingUser = await collection.findOne({ userId: userId });

    if (!existingUser) {
      return NextResponse.json({ success: true, exists: false });
    }

    // If they exist, pull their matches pool dynamically right now to log them in completely
    const searchCriteria = { userId: { $ne: userId } };
    const rawMatchesList = await collection.find(searchCriteria).limit(20).toArray();

    const formattedMatches = rawMatchesList.map((item) => ({
      id: item._id.toString(),
      name: item.name || 'Anonymous Node',
      bio: item.rawBio || 'No tracking bio information recorded.',
      photoUrl: item.photoUrl || '',
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

// Phase B: Save/Update profile structural data to MongoDB and pull matches
export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, name, rawBio, photoUrl, searchProfession, searchKeyword } = body;

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
      name: item.name || 'Anonymous Node',
      bio: item.rawBio || 'No tracking bio information recorded.',
      photoUrl: item.photoUrl || '',
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

// Phase C: Drop database profile elements via query parameters
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing target userId node entry.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    const deletionResult = await db.collection('users').deleteMany({
      $or: [
        { userId: userId },
        { email: userId }
      ]
    });

    if (deletionResult.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'No profile document matched.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'All matching records successfully wiped out.' });

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Database removal action rejected.' }, { status: 500 });
  }
}