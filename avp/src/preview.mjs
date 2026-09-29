// Snapshot the AVP page at given times: node preview.mjs out_dir t1 t2 ...
// Times may be seconds or sceneId[+offset] (e.g. step1_app+4.5).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { serve } from './serve.mjs';
const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const srv = await serve();
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/src/page/index.html?captions=${process.env.CAPTIONS ?? '1'}`);
await page.waitForFunction(() => window.AVP && (window.AVP.ready || window.AVP.error), null, { timeout: 60000 });
const err = await page.evaluate(() => window.AVP.error);
if (err) { console.log('BUILD ERROR', err); process.exit(1); }
const scenes = await page.evaluate(() => window.AVP.timeline.scenes.map((s) => [s.id, s.start]));
for (const spec of times) {
  let t = parseFloat(spec);
  if (isNaN(t)) { const [id, off] = spec.split('+'); t = scenes.find((s) => s[0] === id)[1] + parseFloat(off || 0); }
  await page.evaluate((t) => window.seek(t), t);
  const png = process.env.PNG === '1';
  await page.screenshot({ path: `${outDir}/${spec.replace(/[^\w.+-]/g, '_')}.${png ? 'png' : 'jpg'}`, type: png ? 'png' : 'jpeg', ...(png ? {} : { quality: 80 }) });
}
await browser.close(); srv.close();
