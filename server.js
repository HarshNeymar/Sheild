import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!apiKey) {
  console.error("CRITICAL ERROR: API_KEY environment variable is missing!");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

// app.post('/api/generate', async (req, res) => {
//   console.log("Received generation request");
//   try {
//     const { prompt, config } = req.body;

//     const modelId = "gemini-3-flash-preview"; 

//     console.log(`Calling Gemini Model: ${modelId}`);

//     const response = await ai.models.generateContent({
//       model: modelId,
//       contents: prompt,
//       config: config
//     });

//     console.log("Gemini API response received successfully");

//     if (!response.text) {
//         throw new Error("Empty response from AI model.");
//     }

//     res.json({ text: response.text });

//   } catch (error) {
//     console.error("Server API Error Full Trace:", error);
    
//     const status = error.status || 500;
//     const message = error.message || 'Internal Server Error';
    
//     // Handle Quota limits
//     if (status === 429 || message.includes('429')) {
//       return res.status(429).json({ error: "Server busy (Quota Exceeded). Please try again later." });
//     }

//     res.status(status).json({ error: `AI Generation Failed: ${message}` });
//   }
// });

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
