import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

import { crawlWebsite } from "./crawler/crawl.js";
import { generateStaticSite } from "./generator/generateSite.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve output folder for previews
app.use("/preview", express.static(path.join(__dirname, "output")));

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ------------------------------
// 🔥 MAIN API — /api/clone
// ------------------------------
app.post("/api/clone", async (req, res) => {
  const { url, maxPages } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "URL is required",
    });
  }

  try {
    // 1️⃣ Crawl website
    const crawlResult = await crawlWebsite(url, maxPages || 3);

    // 2️⃣ Generate static site files
    const gen = await generateStaticSite(crawlResult);

    const previewUrl = `${req.protocol}://${req.get("host")}/preview/${gen.siteDirName}/index.html`;

    // ------------------------------------------
    // 3️⃣ AI SUMMARIZATION USING HUGGINGFACE
    // ------------------------------------------
    let summary = "Summary unavailable.";

    try {
      const allText = crawlResult.records
        .map((p) => p.text || "")
        .join("\n\n")
        .slice(0, 8000);

      const hfRes = await fetch(
        "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
          },
          body: JSON.stringify({ inputs: allText }),
        }
      );

      const hfJson = await hfRes.json();

      if (hfJson && hfJson[0] && hfJson[0].summary_text) {
        summary = hfJson[0].summary_text;
      }
    } catch (err) {
      console.error("❌ HuggingFace Error:", err.message);
    }

    // ------------------------------------------
    // 4️⃣ RESPONSE SENT TO FRONTEND
    // ------------------------------------------
    return res.json({
      success: true,
      message: "Cloned successfully",
      previewUrl,
      summary, // ⭐ Frontend uses this
      details: {
        pages: crawlResult.records.length,
      },
    });
  } catch (err) {
    console.error("❌ Clone Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to clone website",
    });
  }
});

// ------------------------------
// START SERVER
// ------------------------------
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on port ${port}`));
