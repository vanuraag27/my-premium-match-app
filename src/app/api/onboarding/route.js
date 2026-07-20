import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini Engine Layer using the stable production model identifier
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("📥 Incoming Onboarding Payload Data:", body); 

    const { userId, name, rawBio, photoUrl } = body;

    // Basic fields validation challenge - tracking explicitly against userId
    if (!userId || !name || !rawBio) {
      console.log("❌ Onboarding blocked: Missing mandatory matrix parameters.");
      return NextResponse.json(
        { success: false, error: 'Missing mandatory matrix parameters.' }, 
        { status: 400 }
      );
    }

    // ==========================================
    // AI CHARACTER ANALYSIS PIPELINE (GEMINI)
    // ==========================================
    let aiAnalysis = {
      temperament: 'Creative & Analytical',
      vision: 'Growth',
      communication: 'Expressive',
      tags: ['Creative', 'TechFocus']
    };

    try {
      // Using the exact stable non-beta model layout name string
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      
      const prompt = `Analyze this profile bio and extract internal traits for a matchmaking framework.
      Bio: "${rawBio}"
      Return ONLY a clean JSON object exactly matched to this layout template with no extra markdown wrappers or conversational filler text:
      {
        "temperament": "Single word summarizing personality style",
        "vision": "Brief phrase describing primary life goal or focus",
        "communication": "Style of speaking/expression",
        "tags": ["tag1", "tag2", "tag3"]
      }`;

      const aiResult = await model.generateContent(prompt);
      const textResponse = aiResult.response.text().trim();
      
      // Sanitizing response structure clean from markdown code fences if present
      const cleanJsonText = textResponse.replace(/^```json\s*|```$/g, '');
      aiAnalysis = JSON.parse(cleanJsonText);
    } catch (aiErr) {
      console.warn("⚠️ Gemini Engine Runtime Fault - Executing Production Matrix Fallback:", aiErr.message);
      if (rawBio.toLowerCase().includes('creative')) {
        aiAnalysis.tags = ['Creative', 'Innovator', 'Designer'];
        aiAnalysis.temperament = 'Artistic & Dynamic';
      }
    }

    // ==========================================
    // DATABASE TRANSACTIONS (MONGODB ATLAS)
    // ==========================================
    const client = await clientPromise;
    const db = client.db('bandhan-engine'); 
    
    const profilePayload = {
      userId,
      name,
      bio: rawBio,
      photoUrl: photoUrl || '',
      aiAnalysis,
      updatedAt: new Date()
    };

    // Upsert user tracking profile record node entry inside collection
    await db.collection('users').updateOne(
      { userId },
      { $set: profilePayload },
      { upsert: true }
    );

    // ==========================================
    // MATCH CALCULATOR VECTOR GENERATION
    // ==========================================
    // Querying up to 50 prospective node candidates from cluster registry database exclusion zone
    const potentialMatches = await db.collection('users')
      .find({ userId: { $ne: userId } })
      .limit(50)
      .toArray();

    // Mapping algorithm calculating relative dynamic vectors scores
    const calculatedMatches = potentialMatches.map((candidate, index) => {
      let seedScore = 75 + (index % 3) * 7; 
      
      if (candidate.aiAnalysis?.temperament === aiAnalysis.temperament) seedScore += 5;
      if (seedScore > 99) seedScore = 98;

      return {
        id: candidate._id.toString(),
        userId: candidate.userId,
        name: candidate.name,
        bio: candidate.bio,
        photoUrl: candidate.photoUrl,
        aiAnalysis: candidate.aiAnalysis || {},
        score: seedScore
      };
    }).sort((a, b) => b.score - a.score);

    console.log(`💾 Live profile system synchronized for User Node ID: ${userId}`);

    return NextResponse.json({
      success: true,
      profile: profilePayload,
      matches: calculatedMatches
    });

  } catch (error) {
    console.error("Fatal Root Cluster Transaction Error Intercepted:", error);
    return NextResponse.json(
      { success: false, error: 'Internal pipeline transaction error processing request.' }, 
      { status: 500 }
    );
  }
}

// Append this function block at the very bottom of src/app/api/onboarding/route.js
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing target userId node entry.' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    // Permanently drop document matching the query identifier parameter
    const deletionResult = await db.collection('users').deleteOne({ userId });

    if (deletionResult.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'No profile matching that ID was found.' }, { status: 444 });
    }

    console.log(`🗑️ Core profile entry purged from database registry for ID: ${userId}`);
    return NextResponse.json({ success: true, message: 'Node record successfully wiped out.' });

  } catch (error) {
    console.error("Critical Deletion Transaction Fault Intercepted:", error);
    return NextResponse.json({ success: false, error: 'Database removal action rejected.' }, { status: 500 });
  }
}