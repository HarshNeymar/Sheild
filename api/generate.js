import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

const ai = new GoogleGenAI({
  apiKey,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel environment variables",
      });
    }

    const { prompt, config } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    const modelId = "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: config || {},
    });

    if (!response.text) {
      return res.status(500).json({
        error: "Empty response from AI model",
      });
    }

    return res.status(200).json({
      text: response.text,
    });
  } catch (error) {
    console.error("Gemini API Error:", error);

    const status = error?.status || 500;
    const message = error?.message || "Internal Server Error";

    if (status === 429 || message.includes("429")) {
      return res.status(429).json({
        error: "Server busy. Gemini quota exceeded. Please try again later.",
      });
    }

    return res.status(status).json({
      error: `AI Generation Failed: ${message}`,
    });
  }
}