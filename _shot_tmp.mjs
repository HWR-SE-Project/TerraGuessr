import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://localhost:5180/';
const out = process.argv[3] || '/private/tmp/claude-501/-Users-maxim-WebstormProjects-geoguessr/ab8b96d9-0579-4172-a5c3-197234dd9ed9/scratchpad/home.png';
const width = Number(process.argv[4] || 1920);
const height = Number(process.argv[5] || 1080);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });

// Also dump bounding rects for key elements
const rects = await page.evaluate(() => {
  const ids = ['.th-hero', '.th-avatar-display', '.th-character-slot', '.th-edit-avatar', '.th-home', '.th-scene3d canvas'];
  const out = {};
  for (const sel of ids) {
    const el = document.querySelector(sel);
    out[sel] = el ? el.getBoundingClientRect().toJSON() : null;
  }
  out['innerHeight'] = window.innerHeight;
  return out;
});
console.log(JSON.stringify(rects, null, 2));

await browser.close();
