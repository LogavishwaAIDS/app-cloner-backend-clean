// generator/generateSite.js
import fs from "fs-extra";
import path from "path";

export async function generateStaticSite(crawlData) {
  const ts = Date.now();
  const outBase = path.join(process.cwd(), "output", `cloned-${ts}`);
  const siteDir = path.join(outBase, "site");
  await fs.ensureDir(siteDir);

  // copy screenshots from crawler output (they were saved in ./output)
  // Build pages
  const pageFiles = [];
  let idx = 1;
  for (const rec of crawlData.records) {
    const fileName = `page-${idx}.html`;
    const screenshotName = `screenshot-${idx}.png`;
    // Move screenshot into site dir (if exists)
    try {
      const src = path.resolve(rec.screenshot);
      if (await fs.pathExists(src)) {
        await fs.copy(src, path.join(siteDir, screenshotName));
      } else {
        // if not found, skip
      }
    } catch (e) {
      console.warn("screenshot copy failed", e.message);
    }

    // sanitize and write the raw HTML into the page (wrap to avoid break)
    const safeHtml = `<div class="captured-html">\n${rec.html}\n</div>`;
    const pageContent = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cloned - ${idx}</title>
  <style>
    body { font-family: system-ui,Segoe UI,Arial; margin:0; padding:12px; }
    .meta { margin-bottom:12px; }
    .captured-html img{ max-width:100%; height:auto; }
  </style>
</head>
<body>
  <div class="meta">
    <a href="./index.html">← Back</a> | Source: <strong>${rec.url}</strong>
  </div>
  ${safeHtml}
</body>
</html>`;

    await fs.writeFile(path.join(siteDir, fileName), pageContent, "utf8");
    pageFiles.push({ fileName, url: rec.url, screenshot: screenshotName });
    idx++;
  }

  // Build index (gallery)
  const linksHtml = pageFiles.map((p, i) => {
    const img = p.screenshot ? `<img src="${p.screenshot}" style="width:240px;height:auto;border:1px solid #ddd;">` : "";
    return `<div style="display:inline-block;margin:12px;text-align:center;">
      <a href="${p.fileName}" style="text-decoration:none;color:inherit;">
        ${img}<div style="margin-top:8px;max-width:240px;overflow:hidden;text-overflow:ellipsis">${p.url}</div>
      </a>
    </div>`;
  }).join("\n");

  const indexHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Generated Clone Preview</title>
</head>
<body style="font-family:system-ui,Segoe UI,Arial;padding:18px;">
  <h1>Generated Clone Preview</h1>
  <p>Source: <strong>${crawlData.startUrl}</strong></p>
  <div>${linksHtml}</div>
</body>
</html>`;

  await fs.writeFile(path.join(siteDir, "index.html"), indexHtml, "utf8");

  // return preview URL path relative to server
  return { outBase, siteDirName: path.join(`cloned-${ts}`, "site") };
}
