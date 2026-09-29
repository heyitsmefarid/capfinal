// Render the AVP to MP4: frames are captured from the page with seek(t) in
// parallel workers, each encoding its own segment; segments are then joined
// and muxed with build/mix.wav (already mastered to -16 LUFS by mix_audio.py).
//   node render.mjs [--fps 30] [--workers 3] [--captions 1] [--out ../output/ISKONNECT_AVP.mp4] [--from 0 --to 0]
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 30), WORKERS = +arg('workers', 3), CAPS = arg('captions', '1');
const OUT = path.resolve(arg('out', path.join(ROOT, 'output', 'ISKONNECT_AVP.mp4')));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const CRF = arg('crf', '20');
const tmp = path.join(ROOT, 'build', 'segments' + (CAPS === '0' ? '_nocap' : ''));
fs.mkdirSync(tmp, { recursive: true });
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timeline.json')));
const T0 = +arg('from', 0), T1 = +arg('to', 0) || timeline.duration;
const nFrames = Math.round((T1 - T0) * FPS);
const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/src/page/index.html?captions=${CAPS}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-gpu', '--force-color-profile=srgb'] });
const started = Date.now();
let done = 0;
async function worker(w) {
  const a = Math.floor((nFrames * w) / WORKERS), b = Math.floor((nFrames * (w + 1)) / WORKERS);
  const seg = path.join(tmp, `seg_${String(w).padStart(2, '0')}.mp4`);
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url);
  await page.waitForFunction(() => window.AVP && (window.AVP.ready || window.AVP.error), null, { timeout: 60000 });
  const err = await page.evaluate(() => window.AVP.error); if (err) throw new Error(err);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p', '-threads', '2', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const cdp = await page.context().newCDPSession(page);
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.seek(t), T0 + f / FPS);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true });
    const buf = Buffer.from(data, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    done++;
    if (w === 0 && done % 300 < WORKERS) {
      const el = (Date.now() - started) / 1000; process.stdout.write(`\r${done}/${nFrames} frames  ${(done / el).toFixed(1)} fps  eta ${((nFrames - done) / (done / el) / 60).toFixed(1)} min   `);
    }
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  await page.close();
  return seg;
}
const segs = await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)));
await browser.close(); srv.close();
console.log(`\ncaptured ${nFrames} frames in ${((Date.now() - started) / 60000).toFixed(1)} min`);
const list = path.join(tmp, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
const audio = path.join(ROOT, 'build', 'mix.wav');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(T0), '-t', String(T1 - T0), '-i', audio,
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', OUT], { stdio: 'inherit' });
console.log('wrote', OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), 'MB');
