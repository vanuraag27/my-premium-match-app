import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/generative-ai";

// Force Next.js to treat this purely as an API endpoint, preventing static build pre-rendering
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // Initialize the AI client INSIDE the request function so it scales safely on Vercel
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "fallback_key");

    // 1. Parse the incoming profiles from the request body
    const { currentUser, targetUser } = await req.json();

    if (!currentUser || !targetUser) {
      return NextResponse.json(
        { error: "Both currentUser and targetUser profiles are required." },
        { status: 400 }
      );
    }

    // 2. Target the smart model
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. Construct the matching framework prompt
    const prompt = `
      You are the core matchmaking engine for "Bandhan", a premium matrimonial website.
      Analyze the compatibility between these two individuals:

      User 1 (Current User):
      - Name: ${currentUser.name || "Anonymous"}
      - Age/Gender: ${currentUser.age || "N/A"} / ${currentUser.gender || "N/A"}
      - Interests: ${Array.isArray(currentUser.interests) ? currentUser.interests.join(", ") : currentUser.interests || "None listed"}
      - Bio: ${currentUser.bio || "No bio provided."}

      User 2 (Potential Match):
      - Name: ${targetUser.name || "Anonymous"}
      - Age/Gender: ${targetUser.age || "N/A"} / ${targetUser.gender || "N/A"}
      - Interests: ${Array.isArray(targetUser.interests) ? targetUser.interests.join(", ") : targetUser.interests || "None listed"}
      - Bio: ${targetUser.bio || "No bio provided."}

      Provide a strict JSON response containing exactly two fields:
      1. "compatibilityScore": An integer between 0 and 100 representing their match score.
      2. "reasoning": A 2-sentence warm, encouraging summary highlighting shared values/interests or potential hurdles.

      Return ONLY raw, parseable JSON. Do not include markdown code block formatting.
    `;

    // 4. Request the analysis from Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // 5. Cleanly parse the JSON return
    let matchData;
    try {
      matchData = JSON.parse(responseText);
    } catch (parseError) {
      const cleanJson = responseText.replace(/```json|```/g, "").trim();
      matchData = JSON.parse(cleanJson);
    }

    return NextResponse.json(matchData, { status: 200 });

  } catch (error) {
    console.error("Matchmaking Engine Error:", error);
    return NextResponse.json(
      { error: "Matchmaking engine experienced an optimization failure." },
      { status: 500 }
    );
  }
}