import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));

  // Initialize Gemini API
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Helper with retry on rate limit (429) & high demand / temporary unavailability (503 / 500)
  // along with model fallback (gemini-3.7-flash -> gemini-2.5-flash)
  async function generateWithFallback(
    createParams: (model: string) => { contents: any; config?: any },
    models = ['gemini-3.7-flash', 'gemini-2.5-flash'],
    maxRetriesPerModel = 2
  ) {
    let lastError: any = null;

    for (const model of models) {
      let delay = 1500;
      for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
        try {
          const params = createParams(model);
          return await ai.models.generateContent({
            model,
            contents: params.contents,
            config: params.config,
          });
        } catch (err: any) {
          lastError = err;
          const isTransient =
            err?.status === 429 ||
            err?.status === 503 ||
            err?.status === 500 ||
            err?.message?.includes("429") ||
            err?.message?.includes("503") ||
            err?.message?.includes("RESOURCE_EXHAUSTED") ||
            err?.message?.includes("UNAVAILABLE") ||
            err?.message?.includes("high demand");

          if (isTransient && attempt < maxRetriesPerModel) {
            console.warn(`[Gemini] Transient error on ${model} (attempt ${attempt}/${maxRetriesPerModel}): ${err?.message}. Retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2;
          } else {
            console.warn(`[Gemini] Model ${model} failed after attempt ${attempt}. Trying next fallback model if available.`);
            break; // Try next fallback model
          }
        }
      }
    }

    throw lastError || new Error("All Gemini models failed");
  }

  // API Route: AI Feedback
  app.post("/api/feedback", async (req, res) => {
    try {
      const { prompt, systemInstruction } = req.body;
      const response = await generateWithFallback((model) => ({
        contents: prompt,
        config: {
          systemInstruction,
        },
      }));
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Feedback Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI feedback" });
    }
  });

  // API Route: Extract PDF content using Gemini
  app.post("/api/extract", async (req, res) => {
    try {
      const { prompt, base64Image } = req.body;
      
      const response = await generateWithFallback((model) => ({
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      }));
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Extraction Error:", error);
      res.status(500).json({ error: error.message || "Failed to extract PDF data" });
    }
  });

  // API Route: Admin Authentication
  app.post("/api/admin-auth", (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "1234";
    if (password === adminPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid password" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
