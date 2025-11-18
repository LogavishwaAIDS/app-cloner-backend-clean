import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { crawlWebsite } from "./crawler/crawl.js";
import { generateStaticSite } from "./generator/generateSite.js";

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
  if (!url) return res.status(400).json({ success: false, error: "url required" });

  try {
    const crawlResult = await crawlWebsite(url, maxPages || 3);
    const gen = await generateStaticSite(crawlResult);

    // preview URL:
    const previewUrl = `${req.protocol}://${req.get("host")}/preview/${gen.siteDirName}/index.html`;

    return res.json({
      success: true,
      message: "Cloned successfully",
      outputPath: gen.outBase,
      previewUrl,
      details: { pages: crawlResult.records.length }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e.message || "failed" });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on port ${port}`));
