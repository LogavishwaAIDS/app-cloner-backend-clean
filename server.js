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

// static preview folder
app.use("/preview", express.static(path.join(__dirname, "output")));

app.get("/api/health", (_, res) => res.json({ ok: true }));

// ========= AI SUMMARY FUNCTION =========
async function generateSummary(text) {
  const HF_API_KEY = process.env.HF_API_KEY;

  if (!HF_API_KEY) {
    console.log("⚠️ Missing HF_API_KEY");
    return "Summary unavailable.";
  }

  const body = {
    inputs: text.slice(0, 10000), // prevent very long payload
    parameters: { max_length: 250 }
  };

  const response = await fetch(
    "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();
  console.log("HF Response:", data);

  if (data.error) return "Summary unavailable.";
  if (Array.isArray(data) && data[0]?.summary_text) return data[0].summary_text;

  return "Summary unavailable.";
}
// =======================================

app.post("/api/clone", async (req, res) => {
  const { url, maxPages } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "url required" });

  try {
    // 1️⃣ Crawl the website
    const crawlResult = await crawlWebsite(url, maxPages || 3);

    // Combine all text content
    const combinedText = crawlResult.records.map(r => r.text).join("\n\n");

    // 2️⃣ Generate AI Summary
    const summary = await generateSummary(combinedText);

    // 3️⃣ Generate static site
    const gen = await generateStaticSite(crawlResult);

    const previewUrl = `${req.protocol}://${req.get("host")}/preview/${gen.siteDirName}/index.html`;

    return res.json({
      success: true,
      message: "Cloned successfully",
      outputPath: gen.outBase,
      previewUrl,
      summary,
      details: { pages: crawlResult.records.length }
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e.message || "failed" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on port ${port}`));
