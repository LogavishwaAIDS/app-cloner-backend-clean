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
app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve generated output
app.use("/preview", express.static(path.join(__dirname, "output")));

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));


// Strip HTML tags before summarizing
function cleanHTML(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateSummary(text) {

  const HF_API_KEY = process.env.HF_API_KEY;
  if (!HF_API_KEY) return "Summary unavailable (missing API key).";

  try {
    const cleaned = cleanHTML(text).slice(0, 3000); // IMPORTANT: safe limit

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: cleaned,
        }),
      }
    );

    const data = await response.json();
    console.log("HF Response:", data);

    // HF Router returns: { generated_text: ... }
    if (data.generated_text) {
      return data.generated_text;
    }

    return "Summary unavailable.";
  } catch (err) {
    console.error("HF Summary Error:", err);
    return "Summary unavailable.";
  }
}

export { generateSummary };

// 🧠 Main Clone Endpoint
app.post("/api/clone", async (req, res) => {
  const { url, maxPages } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "URL is required",
    });
  }

  try {
    // STEP 1 → Crawl target website
    const crawlResult = await crawlWebsite(url, maxPages || 3);

    // STEP 2 → Combine all extracted text
    const allText = crawlResult.records
      .map((p) => p.text || "")
      .join("\n\n");

    // STEP 3 → Generate AI Summary
    const summary = await generateSummary(allText);

    // STEP 4 → Build static site from crawled data
    const gen = await generateStaticSite(crawlResult);

    // STEP 5 → Build preview URL
    const previewUrl = `${req.protocol}://${req.get("host")}/preview/${gen.siteDirName}/index.html`;

    return res.json({
      success: true,
      message: "Cloned successfully",
      previewUrl,
      summary,
      details: { pages: crawlResult.records.length },
    });
  } catch (e) {
    console.error("❌ Clone API Error:", e);
    return res.status(500).json({
      success: false,
      error: e.message || "Failed to clone",
    });
  }
});

// Start backend
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on port ${port}`));
