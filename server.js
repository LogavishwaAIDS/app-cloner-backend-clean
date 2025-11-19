import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { crawlWebsite } from "./crawler/crawl.js";
import { generateStaticSite } from "./generator/generateSite.js";
import fetch from "node-fetch";

async function summarizeText(text) {
  const API_URL =
    "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
    }),
  });

  const data = await response.json();

  return data[0]?.summary_text || "Summary unavailable.";
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "https://app-cloner-frontend.vercel.app"
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

// serve generated output under /preview
app.use("/preview", express.static(path.join(__dirname, "output")));

// health
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/clone", async (req, res) => {
  const { url, maxPages } = req.body;

  if (!url)
    return res.status(400).json({
      success: false,
      error: "URL required",
    });

  try {
    // 1. Crawl website
    const crawlResult = await crawlWebsite(url, maxPages || 3);

    // 2. Combine text from crawled pages for AI summary
    const fullText = crawlResult.records
      .map((page) => page.text || "")
      .join("\n")
      .slice(0, 5000); // Limit for HuggingFace model

    // 3. Generate AI Summary using HuggingFace
    const aiSummary = await summarizeText(fullText);

    // 4. Generate static site content
    const gen = await generateStaticSite(crawlResult);

    // 5. Build preview URL
    const previewUrl = `${req.protocol}://${req.get(
      "host"
    )}/preview/${gen.siteDirName}/index.html`;

    // 6. Return full result to frontend
    return res.json({
      success: true,
      message: "Cloned successfully",
      previewUrl,
      summary: aiSummary,
      details: {
        pages: crawlResult.records.length,
      },
    });
  } catch (err) {
    console.error("Clone error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to clone",
    });
  }
});


const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on port ${port}`));


