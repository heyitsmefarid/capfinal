// Dump the sound-effect cues registered by the scenes to build/cues.json.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = await serve();
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${srv.address().port}/src/page/index.html`);
await page.waitForFunction(() => window.AVP && (window.AVP.ready || window.AVP.error), null, { timeout: 60000 });
const { cues, error } = await page.evaluate(() => ({ cues: window.AVP.cues, error: window.AVP.error }));
if (error) { console.error(error); process.exit(1); }
fs.writeFileSync(path.join(ROOT, 'build', 'cues.json'), JSON.stringify(cues, null, 1));
const counts = {}; cues.forEach((c) => counts[c.name] = (counts[c.name] || 0) + 1);
console.log(cues.length, 'cues', counts);
await browser.close(); srv.close();
