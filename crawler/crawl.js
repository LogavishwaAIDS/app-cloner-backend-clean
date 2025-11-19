// crawler/crawl.js
import { chromium } from "playwright";

function normalizeUrl(u) {
  try {
    const url = new URL(u);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export async function crawlWebsite(startUrl, maxPages = 3) {
  const browser = await chromium.launch({
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();
  const visited = new Set();
  const queue = [startUrl];
  const records = [];

  while (queue.length && records.length < maxPages) {
    const url = queue.shift();
    const norm = normalizeUrl(url);
    if (!norm || visited.has(norm)) continue;

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(500);

      // Extract full HTML
      const html = await page.content();

      // ✅ Extract visible text from body (Fix for AI Summary)
      const text = await page.innerText("body");

      // Screenshot
      const snapshot = `screenshot-${Date.now()}-${records.length}.png`;
      await page.screenshot({
        path: `./output/${snapshot}`,
        fullPage: true,
      });

      // Collect links
      const links = await page.$$eval("a[href]", (els) =>
        els.map((a) => a.getAttribute("href")).filter(Boolean)
      );

      const origin = new URL(url).origin;
      const absLinks = links
        .map((l) => {
          try {
            return new URL(l, origin).href;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Add internal links
      for (const l of absLinks) {
        try {
          if (new URL(l).origin === origin) {
            const n = normalizeUrl(l);
            if (n && !visited.has(n) && !queue.includes(l)) {
              queue.push(l);
            }
          }
        } catch {}
      }

      visited.add(norm);

      // SAVE RECORD
      records.push({
        url,
        html,
        text, // ← REQUIRED FOR AI SUMMARY
        screenshot: `./output/${snapshot}`,
      });
    } catch (err) {
      console.error("crawl error for", url, err.message);
    }
  }

  await browser.close();
  return { startUrl, records };
}
