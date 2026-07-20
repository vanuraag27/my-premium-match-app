import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * 1. Deep AI Analysis Engine
 * Uses Gemini to parse raw text into a clean, structured personality matrix.
 */
export async function analyzeProfileBio(rawBio) {
  const fallbackMatrix = {
    temperament: "Balanced",
    vision: "Growth & Stability",
    communication: "Expressive",
    tags: ["Family-Oriented", "Ambitious", "Harmonious"]
  };

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return fallbackMatrix;
  }

  try {
   // Ensure your model instance string is exactly this:
     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Analyze this matrimonial/relationship profile biography carefully:
      "${rawBio}"

      Extract a structured personality blueprint for matchmaking. Return ONLY a valid JSON object matching this structure exactly, with no markdown formatting around it:
      {
        "temperament": "Single-word description of core nature (e.g., Introverted, Ambitious, Empathetic, Calm, Vivacious)",
        "vision": "Short phrase describing primary life focus (e.g., Career & Growth, Family & Tradition, Spiritual Journey, Creativity & Travel)",
        "communication": "Single-word describing relationship communication style (e.g., Direct, Gentle, Analytical, Expressive, Deep-Listener)",
        "tags": ["Array", "Of Exactly 3", "Core Values/Traits"]
      }
    `;

    const response = await model.generateContent(prompt);
    let text = response.response.text().trim();
    
    // Clean out potential markdown backticks if Gemini returns them
    if (text.startsWith('```')) {
      text = text.replace(/^```json|```$/g, '').trim();
    }

    const cleanJson = JSON.parse(text);
    return {
      temperament: cleanJson.temperament || fallbackMatrix.temperament,
      vision: cleanJson.vision || fallbackMatrix.vision,
      communication: cleanJson.communication || fallbackMatrix.communication,
      tags: Array.isArray(cleanJson.tags) ? cleanJson.tags.slice(0, 3) : fallbackMatrix.tags
    };
  } catch (error) {
    console.warn("⚠️ Gemini Parsing Fallback Triggered:", error.message);
    return fallbackMatrix;
  }
}

/**
 * 2. Mathematical Compatibility Engine
 * Compares a current user matrix against potential candidate records from MongoDB.
 */
export function computeCompatibilityScore(userMatrix, candidateMatrix) {
  let score = 50; // Base compatibility baseline score

  if (!userMatrix || !candidateMatrix) return score;

  // Rule A: Vision Harmony (High impact)
  if (userMatrix.vision === candidateMatrix.vision) score += 20;

  // Rule B: Temperament Balance (Complementary vs Overlapping models)
  if (userMatrix.temperament === candidateMatrix.temperament) {
    score += 10; // Shared baseline
  } else {
    score += 15; // Diverse traits can spark connection
  }

  // Rule C: Matching Key Tags Array Intersections
  const userTags = userMatrix.tags || [];
  const candidateTags = candidateMatrix.tags || [];
  const sharedTags = userTags.filter(tag => candidateTags.includes(tag));
  score += (sharedTags.length * 10);

  // Keep score securely clamped between 0% and 99%
  return Math.min(Math.max(score, 30), 99);
}