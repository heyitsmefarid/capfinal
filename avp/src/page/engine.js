/* ISKONNECT AVP — deterministic scene engine.
 *
 * Every visual is placed on one paused GSAP timeline and rendered by
 * seek(t): the renderer steps t frame by frame, so output never depends on
 * wall-clock timing. Scene builders get their narration line times from
 * build/timeline.json (made by build_tts.py), which keeps visuals synced to
 * the voice. Sound-effect cues registered by builders are collected into
 * AVP.cues and mixed into the soundtrack by mix_audio.py.
 */
const W = 1920, H = 1080;
const SCENES = {};
const HOOKS = [];
const AVP = (window.AVP = { cues: [], ready: false });
const ASSET = '../../assets/';
const PARAMS = new URLSearchParams(location.search);

/* ---------- tiny DOM helpers ---------- */
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function add(parent, html, css) { const e = h(html); if (css) Object.assign(e.style, css); parent.appendChild(e); return e; }
function I(name, size = 24, sw = 2, style = '') {
  const p = window.ICONS[name];
  if (!p) throw new Error('missing icon ' + name);
  return `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="${style}">${p}</svg>`;
}
function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/* ---------- animation helpers (all positioned on a scene timeline) ---------- */
function inn(tl, target, t, o = {}) {
  const from = { autoAlpha: 0, y: o.y ?? 30, x: o.x ?? 0 }, to = { autoAlpha: 1, y: 0, x: 0 };
  if (o.s !== undefined) { from.scale = o.s; to.scale = o.to ?? 1; }
  tl.fromTo(target, from, { ...to, duration: o.d ?? 0.7, ease: o.e ?? 'power3.out', stagger: o.st ?? 0, immediateRender: o.ir ?? true }, t);
}
function out(tl, target, t, o = {}) {
  const to = { autoAlpha: 0, y: o.y ?? -20, x: o.x ?? 0, duration: o.d ?? 0.5, ease: o.e ?? 'power2.in', stagger: o.st ?? 0 };
  if (o.s !== undefined) to.scale = o.s;
  tl.to(target, to, t);
}
function pop(tl, target, t, o = {}) {
  tl.fromTo(target, { autoAlpha: 0, scale: o.s ?? 0.5 }, { autoAlpha: 1, scale: 1, duration: o.d ?? 0.6, ease: o.e ?? 'back.out(1.8)', stagger: o.st ?? 0, immediateRender: o.ir ?? true }, t);
}
function draw(tl, path, t, d = 0.8, e = 'power2.inOut') {
  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len} ${len}`;
  tl.fromTo(path, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: d, ease: e }, t);
}
function svgLayer(parent) {
  return add(parent, `<svg class="wires" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"></svg>`);
}
function wire(svg, d, cls = '') {
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); if (cls) p.setAttribute('class', cls);
  svg.appendChild(p); return p;
}
/* Curved connector between two points. */
function curve(x1, y1, x2, y2, bend = 0.5, dir = 'h') {
  if (dir === 'h') { const mx = lerp(x1, x2, bend); return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; }
  const my = lerp(y1, y2, bend); return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

/* ---------- scene registration ---------- */
function scene(id, build) { SCENES[id] = build; }

function makeCtx(s, el, tl) {
  const L = s.lines.map((l) => ({ s: l.start - s.start, e: l.end - s.start, text: l.text }));
  const ctx = {
    s, el, tl, L, id: s.id, dur: s.end - s.start,
    at: (i, f = 0) => L[i].s + (L[i].e - L[i].s) * f, // time at fraction f of line i
    end: (i, off = 0) => L[i].e + off,
    cue: (name, t, gain = 1) => AVP.cues.push({ name, t: +(s.start + t).toFixed(3), gain, scene: s.id }),
    hook: (fn) => HOOKS.push({ s, fn }),
    add: (html, css) => add(el, html, css),
    svg: () => svgLayer(el),
    /* Word-level sync: time when the given word (first match) is spoken in
       line i, estimated by character position within the line. */
    word: (i, needle, off = 0) => {
      const txt = L[i].text.toLowerCase(); const k = txt.indexOf(needle.toLowerCase());
      if (k < 0) throw new Error(`word "${needle}" not in line ${i} of ${s.id}`);
      return L[i].s + (L[i].e - L[i].s) * (k / txt.length) + off;
    },
  };
  return ctx;
}

/* Packet (glowing dot) that travels along an SVG path between t0 and t0+d. */
function packet(ctx, path, t0, d, o = {}) {
  const p = ctx.add(`<div class="packet"></div>`, o.css);
  const len = path.getTotalLength();
  ctx.hook((t) => {
    const k = (t - t0) / d;
    if (k < 0 || k > 1) { p.style.opacity = 0; return; }
    const q = path.getPointAtLength(len * (o.reverse ? 1 - ease(k) : ease(k)));
    p.style.left = q.x + 'px'; p.style.top = q.y + 'px';
    p.style.opacity = Math.min(1, k * 8, (1 - k) * 8);
  });
  return p;
}

/* Deterministic text typing (per-frame hook). */
function typeText(ctx, node, text, t0, d, caret = true) {
  ctx.hook((t) => {
    const n = Math.round(clamp((t - t0) / d) * text.length);
    const blink = caret && t >= t0 - 0.3 && t < t0 + d + 0.6 && Math.floor(t * 2.5) % 2 === 0;
    node.innerHTML = (t < t0 ? '' : text.slice(0, n)) + (blink ? '<span style="opacity:.7">|</span>' : '');
  });
}
function countUp(ctx, node, from, to, t0, d, fmt = (v) => Math.round(v).toLocaleString()) {
  ctx.hook((t) => { node.textContent = fmt(lerp(from, to, ease(clamp((t - t0) / d)))); });
}

/* Chapter card shown during a scene's `pre` time. */
function chapterCard(ctx) {
  const c = ctx.s.chapter; if (!c) return;
  const e = ctx.add(`<div class="chapter"><div class="num">${c.num}</div><div class="ttl">${c.title}</div><div class="ln"></div></div>`);
  const [num, ttl, ln] = e.children;
  const tEnd = ctx.s.pre - 0.45;
  ctx.tl.fromTo(num, { autoAlpha: 0, scale: 0.86, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0.15);
  ctx.tl.fromTo(ttl, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.35);
  ctx.tl.fromTo(ln, { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'power2.inOut' }, 0.45);
  ctx.tl.to(e, { autoAlpha: 0, y: -30, duration: 0.45, ease: 'power2.in' }, tEnd);
  ctx.cue('whoosh', 0.05, 0.9);
}

/* ---------- phone / laptop factories ---------- */
function phone(ctx, x, y, scale = 1, o = {}) {
  const wrap = ctx.add(`<div class="abs" style="left:${x}px;top:${y}px;width:${400 * scale}px;height:${820 * scale}px"></div>`);
  const p = add(wrap, `<div class="phone" style="left:0;top:0"><div class="scr"><div class="island"></div>
    <div class="sbar ${o.dark ? 'dark' : ''}"><span>9:41</span><span class="r">${I('signal', 16, 2.4)}${I('wifi', 16, 2.4)}${I('battery-full', 20, 2)}</span></div></div></div>`);
  gsap.set(p, { scale, transformOrigin: 'top left' });
  wrap.phone = p; wrap.scr = p.querySelector('.scr'); wrap.sbar = p.querySelector('.sbar');
  wrap.view = (html, cls = '') => { const v = add(wrap.scr, `<div class="view ${cls}">${html}</div>`); wrap.scr.insertBefore(v, wrap.sbar); return v; };
  return wrap;
}
function bnav(active = 0) {
  const ic = ['house', 'user', null, 'bell', 'message-square'];
  return `<div class="bnav">${ic.map((n, i) => n ? `<span style="color:${i === active ? '#1b4d5c' : '#9bb3b8'}">${I(n, 24, 2)}</span>` : `<span class="fab">${I('qr-code', 28, 2)}</span>`).join('')}</div>`;
}
/* Slide the phone from one view to the next. */
function swap(tl, a, b, t, dir = 1) {
  tl.fromTo(b, { xPercent: 100 * dir, autoAlpha: 1 }, { xPercent: 0, duration: 0.55, ease: 'power3.inOut' }, t);
  if (a) tl.to(a, { xPercent: -35 * dir, autoAlpha: 0, duration: 0.55, ease: 'power3.inOut' }, t);
}
function laptop(ctx, x, y, scale = 1, title = 'ISKONNECT · CED Admin Dashboard') {
  const wrap = ctx.add(`<div class="abs" style="left:${x}px;top:${y}px;width:${1180 * scale}px;height:${742 * scale}px"></div>`);
  const l = add(wrap, `<div class="laptop" style="left:0;top:0"><div class="lid"><div class="win"><div class="tb"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="tt">${title}</span></div></div></div><div class="base"><div class="notch"></div></div></div>`);
  gsap.set(l, { scale, transformOrigin: 'top left' });
  wrap.win = l.querySelector('.win');
  return wrap;
}
const NAV = [['layout-dashboard', 'Dashboard'], ['file-text', 'Applications'], ['users', 'Scholars'], ['calendar-check', 'Attendance'], ['book-open', 'Academic Records'],
  ['megaphone', 'Announcements'], ['message-square', 'Messages'], ['chart-column', 'Reports'], ['history', 'History']];
function adminShell(win, active, title, sub) {
  return add(win, `<div class="adm"><div class="side"><div class="logo"><span class="lg">${I('landmark', 20)}</span><span><b>CED</b><small>City Education Department</small></span></div>
    ${NAV.map(([i, n]) => `<div class="nav ${n === active ? 'on' : ''}">${I(i, 16)}${n}</div>`).join('')}</div>
    <div class="main"><div class="pt">${title}</div><div class="ps">${sub}</div></div></div>`).querySelector('.main');
}
function flowNode(ctx, x, y, icon, label, o = {}) {
  const n = ctx.add(`<div class="node ${o.sm ? 'sm' : ''} ${o.hl ? 'hl' : ''}"><div class="ring">${I(icon, o.sm ? 40 : 50, 1.8)}</div><div class="lbl">${label}</div></div>`, { left: x + 'px', top: y + 'px' });
  return n;
}
function qrGrid(seed = 7) {
  const r = rng(seed), N = 25; let cells = '';
  const finder = (x, y) => { for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) { const dx = x - fx, dy = y - fy; if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) return (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)) ? 1 : 0; } return -1; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const f = finder(x, y); const on = f === -1 ? (r() < 0.5 ? 1 : 0) : f; cells += `<i class="${on ? 'k' : ''}"></i>`; }
  return `<div class="qr">${cells}</div>`;
}

/* ---------- build everything ---------- */
async function build() {
  const timeline = await (await fetch('../../build/timeline.json')).json();
  AVP.timeline = timeline;
  const stage = document.getElementById('stage');
  const TL = gsap.timeline({ paused: true });
  AVP.TL = TL;

  // Ambient background
  const bg = add(stage, `<div id="bg"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="grid"></div><div class="warm"></div></div>`);
  const orbs = bg.querySelectorAll('.orb'), grid = bg.querySelector('.grid'), warm = bg.querySelector('.warm');
  const sceneRoot = add(stage, `<div id="scenes" style="position:absolute;inset:0"></div>`);

  // HUD: section label, wordmark, journey rail
  const hud = add(stage, `<div id="hud"></div>`);
  const mark = add(hud, `<img class="mark" src="${ASSET}img/iskonnect_wordmark.png">`);
  const rail = add(hud, `<div id="rail">${Array.from({ length: 12 }, (_, i) => (i ? '<div class="l"></div>' : '') + '<div class="d"></div>').join('')}</div>`);
  const dots = rail.querySelectorAll('.d'), links = rail.querySelectorAll('.l');
  add(stage, `<div id="vignette"></div>`);
  const cap = add(stage, `<div id="cap"></div>`);
  const black = add(stage, `<div id="black"></div>`);

  const SECTION_LABEL = { process: 'The Current Process', problems: 'Existing Problems', intro: 'Introducing ISKONNECT', overview: 'System Overview', journey: 'The ISKONNECT Process', benefits: 'Expected Improvements' };
  const hudSections = {};
  const scenes = timeline.scenes;
  const sceneEls = [];

  for (const s of scenes) {
    const el = add(sceneRoot, `<div class="scene" id="sc_${s.id}"></div>`);
    const tl = gsap.timeline();
    const ctx = makeCtx(s, el, tl);
    chapterCard(ctx);
    if (!SCENES[s.id]) throw new Error('no builder for scene ' + s.id);
    SCENES[s.id](ctx);
    tl.set({}, {}, ctx.dur); // pad scene timeline to its full length
    TL.add(tl, s.start);
    TL.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: s.start === 0 ? 0.01 : 0.6, ease: 'none', immediateRender: false }, Math.max(0, s.start - 0.3));
    TL.to(el, { autoAlpha: 0, duration: 0.6, ease: 'none' }, s.end - 0.3);
    sceneEls.push({ s, el });
    if (SECTION_LABEL[s.section] && !hudSections[s.section]) hudSections[s.section] = { start: s.start, end: s.end };
    if (hudSections[s.section]) hudSections[s.section].end = s.end;
  }
  // Section labels fade in/out with their section.
  for (const [sec, w] of Object.entries(hudSections)) {
    const lab = add(hud, `<div class="sec"><span class="bar"></span><b>${SECTION_LABEL[sec]}</b></div>`);
    TL.fromTo(lab, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out', immediateRender: true }, w.start + (sec === 'process' || sec === 'problems' || sec === 'intro' || sec === 'overview' || sec === 'journey' || sec === 'benefits' ? 2.7 : 0.3));
    TL.to(lab, { autoAlpha: 0, duration: 0.4 }, w.end - 0.4);
  }
  // Wordmark in the corner whenever a section label is up.
  const firstHud = Math.min(...Object.values(hudSections).map((w) => w.start)) + 2.7;
  const lastHud = Math.max(...Object.values(hudSections).map((w) => w.end));
  TL.fromTo(mark, { autoAlpha: 0 }, { autoAlpha: 0.95, duration: 0.8, immediateRender: true }, firstHud);
  TL.to(mark, { autoAlpha: 0, duration: 0.5 }, lastHud - 0.5);
  // Journey rail (steps 1–12).
  const steps = scenes.filter((s) => s.step);
  TL.fromTo(rail, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.6, immediateRender: true }, steps[0].start);
  TL.to(rail, { autoAlpha: 0, duration: 0.5 }, steps[steps.length - 1].end - 0.5);
  // Warm tint while describing problems.
  const probs = scenes.filter((s) => s.section === 'problems' || s.id === 'process_manual');
  TL.to(warm, { opacity: 1, duration: 1.5 }, probs[0].start + 1);
  const bridge = scenes.find((s) => s.section === 'bridge');
  TL.to(warm, { opacity: 0, duration: 2 }, bridge ? bridge.start + 1 : probs[probs.length - 1].start + 3);
  // Section-change whooshes (non-chapter scenes get their own cues).
  // Fade from / to black.
  TL.fromTo(black, { opacity: 1 }, { opacity: 0, duration: 1.6, ease: 'power1.inOut', immediateRender: true }, 0.1);
  TL.to(black, { opacity: 1, duration: 2.2, ease: 'power1.inOut' }, timeline.duration - 2.3);
  TL.set({}, {}, timeline.duration);

  // Captions: hold briefly after each chunk unless the next one starts.
  const caps = timeline.captions.map((c, i, a) => ({ ...c, hold: Math.min(c.end + 0.45, a[i + 1] ? a[i + 1].start : c.end + 0.45) }));
  const showCaps = PARAMS.get('captions') !== '0';
  let lastCap = null;

  AVP.duration = timeline.duration;
  window.seek = (t) => {
    TL.seek(t, false);
    for (const { s, el } of sceneEls) {
      const on = t >= s.start - 0.8 && t <= s.end + 0.8;
      el.style.display = on ? '' : 'none';
    }
    for (const hk of HOOKS) if (t >= hk.s.start - 0.8 && t <= hk.s.end + 0.8) hk.fn(t - hk.s.start);
    // journey rail state
    const cur = steps.find((s) => t >= s.start && t < s.end) || (t >= steps[steps.length - 1].end ? steps[steps.length - 1] : null);
    const k = cur ? cur.step : 0;
    dots.forEach((d, i) => { d.className = 'd' + (i + 1 < k ? ' done' : '') + (i + 1 === k ? ' on' : ''); });
    links.forEach((l, i) => { l.className = 'l' + (i + 2 <= k ? ' done' : ''); });
    // ambient motion
    orbs[0].style.transform = `translate(${-200 + Math.sin(t * 0.07) * 160}px, ${-120 + Math.cos(t * 0.05) * 90}px)`;
    orbs[1].style.transform = `translate(${1250 + Math.cos(t * 0.06) * 180}px, ${380 + Math.sin(t * 0.045) * 120}px)`;
    orbs[2].style.transform = `translate(${500 + Math.sin(t * 0.04 + 2) * 220}px, ${520 + Math.cos(t * 0.055) * 100}px)`;
    grid.style.transform = `translate(${(t * 6) % 80}px, ${(t * 3) % 80}px)`;
    // captions
    if (showCaps) {
      const c = caps.find((c) => t >= c.start - 0.05 && t < c.hold);
      if (c !== lastCap) { cap.textContent = c ? c.text : ''; lastCap = c; }
      cap.style.opacity = c ? clamp((t - c.start + 0.05) / 0.15) * clamp((c.hold - t) / 0.15) : 0;
    }
  };
  // Wait for fonts and images before the renderer starts capturing.
  await document.fonts.ready;
  await Promise.all([...document.images].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; })));
  window.seek(0);
  AVP.cues.sort((a, b) => a.t - b.t);
  AVP.ready = true;
}
window.addEventListener('load', () => build().catch((e) => { AVP.error = String(e && e.stack || e); console.error(e); }));
