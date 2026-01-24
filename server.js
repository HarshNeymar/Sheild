import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize Gemini
// NOTE: On GCP Cloud Run, the API_KEY is injected via environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, config } = req.body;

    // Use the backend client to call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Using the latest stable flash model
      contents: prompt,
      config: config
    });

    // Extract the text to send back to client
    const text = response.text;
    res.json({ text });

  } catch (error) {
    console.error("Server API Error:", error);
    
    // Pass robust error details back to frontend
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';
    
    // Handle Quota limits explicitly
    if (status === 429 || message.includes('429')) {
      return res.status(429).json({ error: "Server busy (Quota Exceeded). Please try again later." });
    }

    res.status(status).json({ error: message });
  }
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});