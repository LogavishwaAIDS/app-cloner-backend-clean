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
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
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
      await page.waitForTimeout(500); // stabilize
      const html = await page.content();
      const snapshot = `screenshot-${Date.now()}-${records.length}.png`;
      await page.screenshot({ path: `./output/${snapshot}`, fullPage: true });

      // gather internal links
      const links = await page.$$eval("a[href]", (els) =>
        els.map((a) => a.getAttribute("href")).filter(Boolean)
      );
      // convert relative to absolute, keep same origin
      const origin = new URL(url).origin;
      const absLinks = links.map((l) => {
        try { return new URL(l, origin).href; } catch { return null; }
      }).filter(Boolean);

      // queue internal same-origin links (simple heuristic)
      for (const l of absLinks) {
        try {
          if (new URL(l).origin === origin && records.length + queue.length < maxPages * 3) {
            const n = normalizeUrl(l);
            if (n && !visited.has(n) && !queue.includes(l)) queue.push(l);
          }
        } catch {}
      }

      visited.add(norm);
      records.push({
        url,
        html,
        screenshot: `./output/${snapshot}`,
      });
    } catch (err) {
      console.error("crawl error for", url, err.message);
      // continue
    }
  }

  await browser.close();
  return { startUrl, records };
}
