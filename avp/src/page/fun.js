/* Playful building blocks: the ISKONNECT scholar mascot, flip-in "hero"
   cards for the system components, particle bursts, screen shake, flashes.
   The mascot is drawn after the scholar in the project logo (logo.jpg). */

const MASCOT_SVG = `<svg viewBox="0 0 200 320" width="100%" height="100%" style="overflow:visible">
  <ellipse class="m-shadow" cx="100" cy="312" rx="58" ry="8" fill="rgba(0,0,0,.35)"/>
  <g class="m-all">
    <rect x="72" y="280" width="22" height="26" rx="8" fill="#232c31"/><rect x="106" y="280" width="22" height="26" rx="8" fill="#232c31"/>
    <ellipse cx="80" cy="306" rx="17" ry="7" fill="#0e1214"/><ellipse cx="121" cy="306" rx="17" ry="7" fill="#0e1214"/>
    <g class="m-armL"><path d="M64 170 C54 196 50 222 50 246" stroke="#1f272c" stroke-width="22" stroke-linecap="round" fill="none"/><circle cx="50" cy="250" r="11" fill="#f1c7a0"/></g>
    <path d="M60 160 Q100 146 140 160 L154 292 Q100 302 46 292 Z" fill="#1f272c"/>
    <path d="M84 168 L92 292" stroke="#d4ff00" stroke-width="7"/><path d="M116 168 L108 292" stroke="#d4ff00" stroke-width="7"/>
    <path d="M78 155 L100 198 L122 155 L112 150 L100 176 L88 150 Z" fill="#2d9596"/>
    <g class="m-armR"><path d="M136 170 C146 196 150 222 150 246" stroke="#1f272c" stroke-width="22" stroke-linecap="round" fill="none"/><circle cx="150" cy="250" r="11" fill="#f1c7a0"/></g>
    <rect x="90" y="130" width="20" height="22" rx="6" fill="#e2b18a"/>
    <g class="m-head">
      <circle cx="55" cy="98" r="10" fill="#f1c7a0"/><circle cx="145" cy="98" r="10" fill="#f1c7a0"/>
      <ellipse cx="100" cy="94" rx="46" ry="48" fill="#f6cfa8"/>
      <path d="M55 88 Q56 48 100 46 Q144 48 145 88 Q130 68 100 70 Q70 68 55 88Z" fill="#1b1512"/>
      <path d="M69 80 Q80 73 91 79" stroke="#1b1512" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M109 79 Q120 73 131 80" stroke="#1b1512" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="m-eyes"><circle cx="81" cy="98" r="5.5" fill="#1b1512"/><circle cx="119" cy="98" r="5.5" fill="#1b1512"/><circle cx="83" cy="96" r="1.8" fill="#fff"/><circle cx="121" cy="96" r="1.8" fill="#fff"/></g>
      <rect x="64" y="84" width="34" height="28" rx="11" fill="rgba(255,255,255,.14)" stroke="#16181a" stroke-width="4"/>
      <rect x="102" y="84" width="34" height="28" rx="11" fill="rgba(255,255,255,.14)" stroke="#16181a" stroke-width="4"/>
      <path d="M98 95 L102 95" stroke="#16181a" stroke-width="4"/>
      <ellipse cx="70" cy="119" rx="8" ry="5" fill="#ff8f8f" opacity=".5"/><ellipse cx="130" cy="119" rx="8" ry="5" fill="#ff8f8f" opacity=".5"/>
      <path class="m-mouth" d="M86 120 Q100 138 114 120 Z" fill="#9c3d2e"/><path d="M90 121 Q100 126 110 121" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M40 50 L100 26 L160 50 L100 74 Z" fill="#141a1e"/><path d="M70 60 L70 72 Q100 84 130 72 L130 60" fill="#141a1e"/>
      <circle cx="100" cy="49" r="4" fill="#d4ff00"/>
      <g class="m-tassel"><path d="M100 49 L150 58 L152 86" stroke="#ffd54f" stroke-width="3" fill="none"/><rect x="147" y="84" width="10" height="17" rx="3" fill="#ffd54f"/></g>
    </g>
  </g></svg>`;

/* Place the mascot. x, y = top-left; returns an object to schedule actions:
   wave(t, d), jump(t, n), cheer(t, d), walk(t, d), tip(t, d). Idle sway and
   blinking run all the time. */
function mascot(c, x, y, scale = 1, o = {}) {
  const el = c.add(`<div class="abs mascot" style="left:${x}px;top:${y}px;width:${200 * scale}px;height:${320 * scale}px">${MASCOT_SVG}</div>`);
  if (o.flip) el.firstElementChild.style.transform = 'scaleX(-1)';
  const q = (s) => el.querySelector(s);
  const all = q('.m-all'), head = q('.m-head'), armR = q('.m-armR'), armL = q('.m-armL'), eyes = q('.m-eyes'), tassel = q('.m-tassel'), shadow = q('.m-shadow');
  const setOrigin = (e, ox, oy) => { e.style.transformBox = 'view-box'; e.style.transformOrigin = `${ox}px ${oy}px`; };
  setOrigin(all, 100, 306); setOrigin(head, 100, 140); setOrigin(armR, 136, 170); setOrigin(armL, 64, 170); setOrigin(eyes, 100, 98); setOrigin(tassel, 100, 49);
  const acts = [];
  const seed = (x * 13 + y * 7) % 11;
  c.hook((t) => {
    let aR = 8, aL = -8, ty = 0, rot = 0, hr = Math.sin(t * 1.4 + seed) * 2.5, sq = 1;
    for (const a of acts) {
      const k = (t - a.t) / a.d;
      if (k < 0 || k > 1) continue;
      const inOut = Math.min(1, k * 6, (1 - k) * 6);
      if (a.type === 'wave') { aR = lerp(8, -150 + Math.sin(k * Math.PI * 2 * a.n) * 22, inOut); hr = Math.sin(k * 9) * 5; }
      if (a.type === 'tip') { aR = lerp(8, -165, inOut); hr = -6 * inOut; }
      if (a.type === 'point') { aR = lerp(8, -100, inOut); }
      if (a.type === 'jump') { const p = (k * a.n) % 1; ty = -Math.sin(p * Math.PI) * 70; sq = p < 0.08 || p > 0.92 ? 0.93 : 1; aR = -120 * inOut; aL = 120 * inOut; }
      if (a.type === 'cheer') { aR = lerp(8, -160 + Math.sin(t * 14) * 10, inOut); aL = lerp(-8, 160 - Math.sin(t * 14) * 10, inOut); ty = -Math.abs(Math.sin(t * 7)) * 26 * inOut; }
      if (a.type === 'walk') { ty = -Math.abs(Math.sin(t * 9)) * 7; rot = Math.sin(t * 9) * 3; aR = Math.sin(t * 9) * 22; aL = -Math.sin(t * 9) * 22; }
    }
    all.style.transform = `translateY(${ty}px) rotate(${rot}deg) scaleY(${sq})`;
    head.style.transform = `rotate(${hr}deg)`;
    armR.style.transform = `rotate(${aR}deg)`; armL.style.transform = `rotate(${aL}deg)`;
    tassel.style.transform = `rotate(${Math.sin(t * 3 + seed) * 6}deg)`;
    const b = (t + seed * 0.37) % 3.3; eyes.style.transform = `scaleY(${b < 0.13 ? 0.12 : 1})`;
    shadow.style.opacity = 1 - Math.min(0.7, -ty / 100);
  });
  const m = { el };
  for (const type of ['wave', 'tip', 'point', 'cheer', 'walk']) m[type] = (t, d = 1.6, n = 2) => { acts.push({ type, t, d, n }); return m; };
  m.jump = (t, n = 1) => { acts.push({ type: 'jump', t, d: 0.55 * n, n }); c.cue('boing', t, 0.35); return m; };
  return m;
}

/* ---------- hero cards ("Meet the ISKONNECT squad") ---------- */
const HEROES = {
  app: { num: '01', name: 'Student App', role: 'The Pocket Companion', color: '#4ecdc4', icon: 'smartphone' },
  brain: { num: '02', name: 'Backend &amp; Database', role: 'The Brain', color: '#b9aef0', icon: 'database' },
  admin: { num: '03', name: 'CED Admin Dashboard', role: 'Mission Control', color: '#f4a261', icon: 'monitor' },
  qr: { num: '04', name: 'QR Scanner App', role: 'The Attendance Hero', color: '#d4ff00', icon: 'scan-line' },
};
function heroArt(key) {
  const h = HEROES[key];
  if (key === 'app') return `<div style="position:relative;width:128px;height:230px;border-radius:26px;background:#0b1114;padding:7px;box-shadow:0 0 50px ${h.color}66;transform:rotate(-8deg)">
      <div style="height:100%;border-radius:20px;overflow:hidden;background:#f3f6f7"><div style="height:62px;background:linear-gradient(135deg,#1b4d5c,#2a6274)"></div>
      ${[0, 1, 2, 3].map((i) => `<div style="margin:9px 9px 0;height:26px;border-radius:7px;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.08)"></div>`).join('')}</div>
      ${[['bell', -46, 20], ['file-check', 140, 50], ['calendar-days', -40, 150], ['message-circle', 146, 170]].map(([ic, x, y]) => `<span style="position:absolute;left:${x}px;top:${y}px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#0f2f38;border:2px solid ${h.color};color:${h.color}">${I(ic, 20)}</span>`).join('')}</div>`;
  if (key === 'brain') return `<div style="position:relative;width:230px;height:230px;display:grid;place-items:center">
      ${[0, 1, 2].map((i) => `<div class="ring${i}" style="position:absolute;inset:${i * 30}px;border-radius:50%;border:2px ${i === 1 ? 'dashed' : 'solid'} ${h.color}${['55', '88', 'cc'][i]}"></div>`).join('')}
      <span style="color:${h.color};filter:drop-shadow(0 0 20px ${h.color})">${I('database', 84, 1.6)}</span></div>`;
  if (key === 'admin') return `<div style="position:relative;width:250px;height:190px"><div style="position:absolute;left:0;top:0;width:250px;height:160px;border-radius:14px;background:#0b1114;border:4px solid #26343a;box-shadow:0 0 50px ${h.color}55;padding:14px;display:flex;align-items:flex-end;gap:12px">
      ${[46, 80, 58, 104, 72, 118].map((v, i) => `<div style="flex:1;height:${v}px;border-radius:5px;background:${i % 2 ? h.color : '#4ecdc4'}"></div>`).join('')}</div>
      <div style="position:absolute;left:105px;top:162px;width:40px;height:22px;background:#26343a"></div></div>`;
  return `<div style="position:relative;width:200px;height:220px;display:grid;place-items:center"><div style="width:170px">${qrGrid(33)}</div>
      <div class="hscan" style="position:absolute;left:10px;right:10px;top:40%;height:4px;border-radius:4px;background:${h.color};box-shadow:0 0 20px ${h.color}"></div>
      <span style="position:absolute;right:-18px;bottom:-6px;width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:#0f2f38;border:3px solid ${h.color};color:${h.color}">${I('wifi-off', 28)}</span></div>`;
}
function heroCard(c, key, x, y, scale = 1) {
  const h = HEROES[key];
  const w = c.add(`<div class="abs hero" style="left:${x}px;top:${y}px;width:${380 * scale}px;height:${520 * scale}px">
    <div class="hc-sc" style="position:absolute;left:0;top:0;width:380px;height:520px;perspective:1400px">
    <div class="hc-in" style="position:absolute;left:0;top:0;width:380px;height:520px;transform-style:preserve-3d;transform-origin:center">
      <div class="hc-back" style="position:absolute;inset:0;border-radius:30px;backface-visibility:hidden;transform:rotateY(180deg);display:grid;place-items:center;
        background:radial-gradient(circle at 50% 40%,#1f5a69,#0b232a 70%);border:3px solid rgba(78,205,196,.5);box-shadow:0 30px 70px rgba(0,0,0,.5)">
        <div style="text-align:center"><img src="${ASSET}img/iskonnect_wordmark.png" style="width:250px"><div style="font:800 110px/1 var(--head);color:rgba(212,255,0,.9);margin-top:24px">?</div></div></div>
      <div class="hc-front" style="position:absolute;inset:0;border-radius:30px;backface-visibility:hidden;padding:26px 28px;display:flex;flex-direction:column;
        background:linear-gradient(#0e2a31,#0b232a) padding-box,linear-gradient(145deg,${h.color},rgba(212,255,0,.2) 60%,${h.color}) border-box;border:3px solid transparent;box-shadow:0 30px 70px rgba(0,0,0,.5),0 0 60px ${h.color}33">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font:800 22px/1 var(--head);color:${h.color}">${h.num}</span>
          <span style="padding:7px 12px;border-radius:999px;background:${h.color}22;border:1px solid ${h.color}88;color:${h.color};font:700 13px/1 var(--body);letter-spacing:.08em;text-transform:uppercase">${h.role}</span></div>
        <div style="flex:1;display:grid;place-items:center;margin:10px 0;border-radius:22px;background:radial-gradient(circle at 50% 50%,${h.color}22,transparent 70%)">${heroArt(key)}</div>
        <div style="font:800 34px/1.1 var(--head)">${h.name}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;color:${h.color};font:600 18px/1 var(--body)">${I(h.icon, 20)}ISKONNECT component</div></div></div></div></div>`);
  w.sc = w.querySelector('.hc-sc');
  gsap.set(w.sc, { scale, transformOrigin: 'top left' });
  w.inner = w.querySelector('.hc-in');
  gsap.set(w.inner, { rotationY: 180 });
  const scan = w.querySelector('.hscan');
  if (scan) c.hook((t) => { scan.style.top = 20 + (0.5 + 0.5 * Math.sin(t * 3)) * 60 + '%'; });
  const rings = [...w.querySelectorAll('[class^=ring]')];
  if (rings.length) c.hook((t) => rings.forEach((r, i) => { r.style.transform = `rotate(${t * (i % 2 ? -30 : 20)}deg) scale(${1 + Math.sin(t * 2 + i) * 0.03})`; }));
  return w;
}
function flipCard(c, card, t, d = 0.9) {
  c.tl.to(card.inner, { rotationY: 0, duration: d, ease: 'back.out(1.3)' }, t);
  c.cue('flip', t, 0.6);
}

/* ---------- effects ---------- */
function burst(c, cx, cy, t0, o = {}) {
  const r = rng(o.seed || 5), n = o.n || 36, colors = o.colors || ['#d4ff00', '#4ecdc4', '#9b8ec9', '#f4a261', '#ffffff'];
  const parts = Array.from({ length: n }, (_, i) => {
    const a = r() * Math.PI * 2, v = (o.speed || 700) * (0.4 + r() * 0.8);
    return { e: c.add(`<div class="abs" style="width:${6 + r() * 8}px;height:${6 + r() * 8}px;border-radius:${r() < 0.5 ? '50%' : '2px'};background:${colors[i % colors.length]};opacity:0"></div>`), a, v, s: r() * 360 };
  });
  c.hook((t) => {
    const k = t - t0;
    parts.forEach((p) => {
      if (k < 0 || k > 1.6) { p.e.style.opacity = 0; return; }
      const d = p.v * (1 - Math.exp(-k * 3)) / 3;
      p.e.style.left = cx + Math.cos(p.a) * d + 'px'; p.e.style.top = cy + Math.sin(p.a) * d + k * k * 120 + 'px';
      p.e.style.opacity = Math.max(0, 1 - k / 1.6); p.e.style.transform = `rotate(${p.s + k * 400}deg)`;
    });
  });
}
function shockwave(c, cx, cy, t0, color = 'rgba(212,255,0,.8)') {
  const e = c.add(`<div class="abs" style="left:${cx}px;top:${cy}px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:6px solid ${color}"></div>`);
  c.tl.fromTo(e, { scale: 0.2, autoAlpha: 1 }, { scale: 40, autoAlpha: 0, duration: 1.1, ease: 'power2.out' }, t0);
}
function shake(c, el, t0, d = 0.5, amp = 18) {
  c.hook((t) => { const k = (t - t0) / d; el.style.translate = k < 0 || k > 1 ? '0px 0px' : `${Math.sin(t * 90) * amp * (1 - k)}px ${Math.cos(t * 77) * amp * (1 - k)}px`; });
}
function flash(c, t0, d, dir = 'in', color = 'radial-gradient(circle at 50% 45%,#ffffff,#d4ffe9 30%,#4ecdc4 70%)') {
  const e = c.add(`<div class="abs" style="inset:0;background:${color};z-index:50"></div>`);
  if (dir === 'in') c.tl.fromTo(e, { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'power2.in' }, t0);
  else c.tl.fromTo(e, { autoAlpha: 1 }, { autoAlpha: 0, duration: d, ease: 'power2.out' }, t0);
  return e;
}
/* Word-by-word kinetic reveal of a line built with kw(). */
function kinetic(c, el, t0, t1, o = {}) {
  const words = [...el.querySelectorAll('.kw')];
  words.forEach((w, i) => c.tl.fromTo(w, { autoAlpha: 0, y: o.y ?? 40, rotationX: -70 }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.5, ease: 'back.out(2)' }, lerp(t0, t1, i / Math.max(1, words.length))));
}
/* Plain text -> word spans. *word* is highlighted lime, ~word~ is struck
   through in coral (markers wrap a single word, punctuation included). */
function kw(text) {
  return text.split(' ').map((tok) => {
    if (tok === '|') return '<br>';
    const m = tok.match(/^([*~])(.+)\1$/);
    if (!m) return `<span class="kw" style="display:inline-block">${tok}</span>`;
    const style = m[1] === '*' ? 'color:var(--lime)' : 'color:var(--coral);text-decoration:line-through;text-decoration-thickness:6px';
    return `<span class="kw" style="display:inline-block;${style}">${m[2]}</span>`;
  }).join(' ');
}
