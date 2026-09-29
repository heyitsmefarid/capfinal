/* Sections 1–5: opening, current process, problems, introducing ISKONNECT,
   system overview. */

function personSVG(o = {}) {
  const w = o.w || 100, shirt = o.shirt || '#2d9596', skin = o.skin || '#e0b48f', hair = o.hair || '#2b1d16';
  const cap = o.cap ? `<path d="M14 30 L50 15 L86 30 L50 45 Z" fill="#0d1a1f"/><rect x="35" y="32" width="30" height="12" rx="2" fill="#0d1a1f"/><path d="M82 31 V50" stroke="#d4ff00" stroke-width="3"/><circle cx="82" cy="52" r="4" fill="#d4ff00"/>` :
    `<path d="M24 52 Q24 22 50 22 Q76 22 76 52 Q68 36 50 37 Q32 36 24 52Z" fill="${hair}"/>`;
  const doc = o.doc ? `<g transform="rotate(-10 76 136)"><rect x="60" y="112" width="32" height="42" rx="3" fill="#f4f1ea"/><rect x="65" y="120" width="20" height="3" fill="#b9c4c2"/><rect x="65" y="127" width="22" height="3" fill="#b9c4c2"/><rect x="65" y="134" width="16" height="3" fill="#b9c4c2"/></g>` : '';
  const id = o.id ? `<path d="M40 88 L50 118 L60 88" stroke="#d4ff00" stroke-width="3" fill="none"/><rect x="43" y="116" width="14" height="18" rx="2" fill="#fff"/>` : '';
  return `<svg viewBox="0 0 100 190" width="${w}" height="${w * 1.9}"><path d="M16 190 V124 Q16 88 50 88 Q84 88 84 124 V190 Z" fill="${shirt}"/>
    <rect x="42" y="72" width="16" height="20" rx="4" fill="${skin}"/><circle cx="50" cy="54" r="25" fill="${skin}"/>${cap}${id}${doc}</svg>`;
}

/* ---------------- 1. Opening ---------------- */
scene('open_city', (c) => {
  const { tl } = c; const r = rng(11);
  // skyline: mountains, buildings with windows, water
  let mtn = `M0,760 L160,700 L330,735 L520,610 L640,650 L760,560 L900,640 L1080,600 L1240,680 L1420,620 L1600,690 L1760,650 L1920,700 L1920,1080 L0,1080 Z`;
  let blds = '', wins = '';
  for (let x = -20; x < 1940;) {
    const w = 46 + r() * 90, hgt = 70 + r() * (Math.abs(x - 960) < 420 ? 250 : 160), top = 905 - hgt;
    blds += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${hgt.toFixed(0)}" rx="3"/>`;
    for (let wy = top + 14; wy < 890; wy += 22) for (let wx = x + 9; wx < x + w - 12; wx += 16) if (r() < 0.22) wins += `<rect class="w" x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="7" height="10" rx="1"/>`;
    x += w + 4 + r() * 10;
  }
  const sky = c.add(`<svg class="abs" viewBox="0 0 1920 1080" width="1920" height="1080" style="left:0;top:0">
    <defs><linearGradient id="bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#113742"/><stop offset="1" stop-color="#081d24"/></linearGradient>
    <linearGradient id="wt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c2d36"/><stop offset="1" stop-color="#04141a"/></linearGradient></defs>
    <path class="mtn" d="${mtn}" fill="#0d2f3a" opacity=".85"/>
    <g class="bld" fill="url(#bl)">${blds}</g><g class="win" fill="#ffd87a">${wins}</g>
    <rect class="water" x="0" y="905" width="1920" height="175" fill="url(#wt)"/>
    <g class="ripples" stroke="#2d9596" stroke-width="2" opacity=".35">${Array.from({ length: 16 }, (_, i) => `<line x1="${(i * 131) % 1900}" y1="${930 + (i % 5) * 26}" x2="${(i * 131) % 1900 + 60 + (i % 3) * 30}" y2="${930 + (i % 5) * 26}"/>`).join('')}</g></svg>`);
  const [mEl, bEl, wEl] = [sky.querySelector('.mtn'), sky.querySelector('.bld'), sky.querySelector('.win')];
  tl.fromTo(mEl, { y: 60, opacity: 0 }, { y: 0, opacity: 0.85, duration: 2.4, ease: 'power2.out' }, 0.2);
  tl.fromTo([bEl, wEl], { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 2.2, ease: 'power3.out' }, 0.5);
  const winEls = [...sky.querySelectorAll('.w')];
  c.hook((t) => { winEls.forEach((w, i) => { if (i % 5 === 0) w.style.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.6 + (i % 7) * 0.13) + i)); }); });
  tl.to(sky, { y: 60, duration: c.dur, ease: 'none' }, 0); // slow cinematic drift

  const kick = c.add(`<div class="abs kicker" style="top:196px;width:100%;text-align:center;letter-spacing:.42em;color:#9fd8d2">Calapan City · Oriental Mindoro</div>`);
  const h1 = c.add(`<div class="abs h1" style="top:262px;width:100%;text-align:center;font-size:92px">Education opens doors.</div>`);
  const h1b = c.add(`<div class="abs h3" style="top:392px;width:100%;text-align:center;color:var(--mint);font-weight:500">Scholarships help keep them open.</div>`);
  inn(tl, kick, 0.9, { y: 14, d: 1.2 });
  inn(tl, h1, c.at(0, 0.02), { y: 26, d: 1.0 });
  inn(tl, h1b, c.word(0, 'scholarships'), { y: 20 });
  out(tl, [kick, h1, h1b], c.at(1, 0) - 0.2, { y: -30, d: 0.6 });

  const seals = c.add(`<div class="abs" style="top:170px;left:0;width:1920px;display:flex;justify-content:center;gap:70px">
    <img src="${ASSET}img/calapan_seal.png" style="width:190px;height:190px;filter:drop-shadow(0 12px 30px rgba(0,0,0,.5))">
    <img src="${ASSET}img/ced_seal.png" style="width:190px;height:190px;filter:drop-shadow(0 12px 30px rgba(0,0,0,.5))"></div>`);
  const ced = c.add(`<div class="abs" style="top:398px;width:100%;text-align:center"><div class="h2">City Education Department</div><div class="lead" style="margin-top:8px">Scholarship Program · Calapan City</div></div>`);
  pop(tl, seals.children, c.at(1, 0.02), { s: 0.7, st: 0.18, d: 0.8 });
  inn(tl, ced, c.word(1, 'or ced'), { y: 20 });
  // students standing in front of the skyline
  const shirts = ['#2d9596', '#9b8ec9', '#f4a261', '#4ecdc4', '#e76f51', '#8cb369', '#5fb3f9'];
  const skins = ['#e0b48f', '#c98f65', '#f0c9a4', '#b57a50', '#dcae86', '#c68e62', '#e8bc94'];
  const kids = [];
  for (let i = 0; i < 7; i++) {
    kids.push(c.add(`<div class="abs" style="left:${560 + i * 118}px;top:${690 + (i % 2) * 14}px">${personSVG({ w: 92, shirt: shirts[i], skin: skins[i], cap: true, hair: '#1f1612' })}</div>`));
  }
  inn(tl, kids, c.word(1, 'deserving'), { y: 60, st: 0.12, d: 0.8, e: 'back.out(1.4)' });
  c.cue('swell', 0.0, 0.8);
});

scene('open_paper', (c) => {
  const { tl } = c; const r = rng(5);
  const papers = [];
  for (let i = 0; i < 11; i++) {
    const p = c.add(`<div class="paper"><i class="h"></i><i></i><i style="width:80%"></i><i></i><i style="width:65%"></i><i></i><i style="width:90%"></i>${i % 4 === 1 ? '<div class="stamp">RECEIVED</div>' : ''}</div>`,
      { left: 330 + r() * 300 + 'px', top: 300 + r() * 250 + 'px' });
    papers.push(p);
    const fromX = (r() < 0.5 ? -1 : 1) * (700 + r() * 400), fromY = -300 + r() * 600;
    tl.fromTo(p, { x: fromX, y: fromY, rotation: -60 + r() * 120, autoAlpha: 0 }, { x: 0, y: 0, rotation: -16 + r() * 32, autoAlpha: 1, duration: 0.9, ease: 'power3.out' }, c.at(0, 0) + i * 0.42);
    if (i % 3 === 0) c.cue('paper', c.at(0, 0) + i * 0.42 + 0.25, 0.5);
  }
  const chips0 = [['file-text', 'Application forms', 'application forms'], ['files', 'Photocopied documents', 'photocopied'], ['users', 'Submitted in person', 'in person']].map(([ic, t, w], i) => {
    const e = c.add(`<div class="chip amber" style="left:1080px;top:${300 + i * 92}px;position:absolute;font-size:28px;padding:16px 26px">${I(ic, 30)}${t}</div>`);
    inn(tl, e, c.word(0, w) - 0.2, { x: 40, y: 0 }); return e;
  });
  const t1 = c.at(1, 0);
  out(tl, chips0, t1 - 0.2, { x: 30, y: 0, st: 0.05 });
  // folders + logbook join the pile
  const fold = [0, 1, 2].map((i) => c.add(`<div class="folder" style="left:${240 + i * 34}px;top:${600 - i * 30}px"><div class="t"></div><div class="b"></div></div>`));
  const book = c.add(`<div class="abs" style="left:720px;top:560px;width:150px;height:190px;border-radius:8px 14px 14px 8px;background:linear-gradient(90deg,#6b2230 0 14px,#8e2f3f 14px);box-shadow:0 14px 30px rgba(0,0,0,.4);transform:rotate(8deg)">
    <div style="margin:40px 18px 0 30px;height:34px;border-radius:4px;background:#e9d9b8;font:700 13px/34px var(--head);text-align:center;color:#6b2230">LOGBOOK</div></div>`);
  inn(tl, fold, c.word(1, 'folders') - 0.2, { y: 80, st: 0.12, e: 'back.out(1.3)' });
  inn(tl, book, c.word(1, 'logbooks') - 0.2, { y: 80, e: 'back.out(1.3)' });
  // spreadsheet with cells filling in by hand
  const rows = 7, cols = 5;
  let tb = '<tr>' + ['Name', 'School', 'Year', 'Grade', 'Status'].map((h) => `<td>${h}</td>`).join('') + '</tr>';
  for (let y = 1; y < rows; y++) tb += '<tr>' + Array.from({ length: cols }, (_, x) => `<td><span class="cell" data-k="${y * cols + x}" style="display:inline-block;height:8px;border-radius:4px;background:#a9bcb7;width:${30 + ((x * 37 + y * 11) % 50)}px;opacity:0"></span></td>`).join('') + '</tr>';
  const sheet = c.add(`<div class="sheet" style="left:1040px;top:250px;width:680px"><div class="hdr"><i></i><i></i><i></i><span style="margin-left:10px;font:600 14px/1 var(--body);color:#fff">scholars_masterlist_FINAL_v3.xlsx</span></div><table>${tb}</table></div>`);
  inn(tl, sheet, c.word(1, 'spreadsheets') - 0.4, { x: 60, y: 0, d: 0.8 });
  const cells = [...sheet.querySelectorAll('.cell')];
  const tS = c.word(1, 'spreadsheets');
  c.hook((t) => { const n = Math.floor(clamp((t - tS) / 3.6) * cells.length); cells.forEach((e, i) => { e.style.opacity = i < n ? 1 : 0; }); });
  const pen = c.add(`<div class="chip" style="position:absolute;left:1210px;top:590px">${I('pen-line', 24)}Checked &amp; updated by hand</div>`);
  inn(tl, pen, c.word(1, 'checked') - 0.2, { y: 20 });
});

scene('open_queue', (c) => {
  const { tl } = c;
  const sign = c.add(`<div class="abs card" style="left:1180px;top:170px;width:600px;height:96px;display:flex;align-items:center;gap:18px;padding:0 28px;border-radius:18px">
    <span style="color:var(--lime)">${I('clipboard-list', 44, 1.8)}</span><div><div style="font:700 26px/1.1 var(--head)">Submission of Requirements</div><div class="muted" style="font:500 18px/1.4 var(--body)">Scholarship Program · CED Office</div></div></div>`);
  const staff = c.add(`<div class="abs" style="left:1420px;top:330px">${personSVG({ w: 120, shirt: '#1b4d5c', skin: '#d5a47c', hair: '#221612', id: true })}</div>`);
  const counter = c.add(`<div class="abs" style="left:1150px;top:560px;width:660px;height:300px">
    <div style="height:22px;border-radius:8px 8px 0 0;background:#2a6274"></div><div style="height:278px;background:linear-gradient(180deg,#153f4b,#0c2a33);border-radius:0 0 10px 10px"></div></div>`);
  // growing stack of received documents
  const stack = [];
  for (let i = 0; i < 9; i++) stack.push(c.add(`<div class="abs" style="left:${1220 + (i % 2) * 6}px;top:${540 - i * 9}px;width:150px;height:22px;border-radius:3px;background:#f4f1ea;box-shadow:0 2px 0 #c9c3b6"></div>`));
  stack.forEach((e, i) => tl.fromTo(e, { autoAlpha: 0, y: -40 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, 0.8 + i * (c.dur - 2.5) / 9));
  // the stack gets too tall and topples over
  const tFall = c.word(1, 'harder') - 0.15;
  stack.forEach((e, i) => {
    const r = rng(40 + i);
    tl.to(e, { x: -260 + r() * 420, y: 300 - i * 4 + r() * 30, rotation: -90 + r() * 180, duration: 0.7 + r() * 0.3, ease: 'bounce.out' }, tFall + i * 0.04);
  });
  c.cue('thud', tFall + 0.45, 0.8); c.cue('paper', tFall + 0.1, 0.8);
  const stampEl = c.add(`<div class="abs" style="left:1600px;top:460px;color:#ffb3b3">${I('stamp', 64, 1.8)}</div>`);
  c.hook((t) => { const k = (t % 1.6) / 1.6; stampEl.style.transform = `translateY(${k < 0.2 ? k / 0.2 * 44 : k < 0.35 ? 44 - (k - 0.2) / 0.15 * 44 : 0}px)`; });
  for (let t = 1.0; t < c.dur - 1; t += 1.6) c.cue('stamp', t + 0.32, 0.25);
  inn(tl, [sign, counter], 0.1, { y: 30, st: 0.1 });
  inn(tl, staff, 0.3, { y: 30 });
  inn(tl, stampEl, 0.5, { y: 0 });
  // queue of applicants shuffling forward
  const shirts = ['#9b8ec9', '#f4a261', '#4ecdc4', '#e76f51', '#8cb369', '#5fb3f9', '#d4a5e0'];
  const q = shirts.map((s, i) => c.add(`<div class="abs" style="left:${130 + i * 150}px;top:${520 + (i % 2) * 10}px">${personSVG({ w: 110, shirt: s, skin: ['#e0b48f', '#c98f65', '#f0c9a4', '#b57a50'][i % 4], doc: true, hair: '#1f1612' })}</div>`));
  inn(tl, q, 0.2, { x: -80, y: 0, st: 0.1, d: 0.9 });
  c.hook((t) => { const step = Math.floor(t / 2.4), k = ease(clamp((t % 2.4) / 0.7)); q.forEach((e, i) => { e.style.transform = `translate(${(step + k) * 18}px, ${Math.sin(t * 3 + i) * 2}px)`; }); });
  // "harder" beat
  const hard = c.add(`<div class="abs h2" style="top:118px;left:120px;white-space:nowrap">More scholars. <span class="amber">More paper.</span> More time.</div>`);
  inn(tl, hard, c.at(1, 0.05), { y: 20 });
  const clock = c.add(`<div class="abs" style="left:1010px;top:330px;width:120px;height:120px;border-radius:50%;border:5px solid #f4a261;background:#0c2a33">
    <div class="hh" style="position:absolute;left:55px;top:22px;width:6px;height:40px;border-radius:3px;background:#f4a261;transform-origin:3px 38px"></div>
    <div class="mm" style="position:absolute;left:56px;top:12px;width:4px;height:50px;border-radius:2px;background:#fff;transform-origin:2px 48px"></div></div>`);
  inn(tl, clock, c.at(1, 0.1), { s: 0.6, y: 0 });
  const hh = clock.querySelector('.hh'), mm = clock.querySelector('.mm');
  c.hook((t) => { const k = Math.max(0, t - c.at(1, 0)); mm.style.transform = `rotate(${k * k * 220}deg)`; hh.style.transform = `rotate(${k * k * 18}deg)`; });
});

scene('title', (c) => {
  const { tl } = c; const r = rng(3);
  const docs = [];
  for (let i = 0; i < 34; i++) {
    const d = c.add(`<div class="abs" style="left:${80 + r() * 1760}px;top:${90 + r() * 800}px;color:${i % 3 ? '#4ecdc4' : '#f4a261'};opacity:.85">${I(['file-text', 'files', 'folder', 'sheet', 'clipboard-list'][i % 5], 52 + r() * 40, 1.5)}</div>`);
    docs.push(d);
  }
  const tC = c.end(0) + 0.35; // convergence time
  docs.forEach((d, i) => {
    tl.fromTo(d, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 0.75, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.05 + (i % 10) * 0.05);
    tl.to(d, { left: 940, top: 470, scale: 0.15, rotation: 180, autoAlpha: 0, duration: 1.0, ease: 'power3.in' }, tC - 1.0 + (i % 6) * 0.03);
  });
  c.hook((t) => { if (t < tC - 1.1) docs.forEach((d, i) => { d.style.transform = `translate(${Math.sin(t * 0.8 + i) * 10}px, ${Math.cos(t * 0.6 + i * 1.7) * 12}px)`; }); });
  const flash = c.add(`<div class="abs" style="left:960px;top:480px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:radial-gradient(circle,rgba(212,255,0,.9),rgba(78,205,196,.4) 40%,transparent 70%)"></div>`);
  tl.fromTo(flash, { scale: 0, autoAlpha: 1 }, { scale: 60, autoAlpha: 0, duration: 1.3, ease: 'power2.out' }, tC);
  c.cue('impact', tC - 0.05, 0.9); c.cue('shimmer', tC, 0.6);
  const logo = c.add(`<div class="abs" style="left:0;top:270px;width:1920px;text-align:center"><img src="${ASSET}img/iskonnect_wordmark.png" style="width:1000px;filter:drop-shadow(0 0 40px rgba(78,205,196,.35))"></div>`);
  tl.fromTo(logo, { autoAlpha: 0, scale: 0.86 }, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'expo.out' }, tC);
  const sub1 = c.add(`<div class="abs h3" style="top:590px;width:100%;text-align:center;font-size:44px">Mobile-Based Scholarship Management System</div>`);
  const sub2 = c.add(`<div class="abs lead" style="top:660px;width:100%;text-align:center;color:var(--mint);font-size:34px">for the Calapan City Education Department</div>`);
  inn(tl, sub1, c.word(1, 'mobile'), { y: 20 });
  inn(tl, sub2, c.word(1, 'for the'), { y: 16 });
  // L2: move title up, show the connection
  const t2 = c.at(2, 0);
  tl.to(logo, { y: -190, scale: 0.6, duration: 1.0, ease: 'power3.inOut' }, t2);
  tl.to(sub1, { y: -262, scale: 0.72, duration: 1.0, ease: 'power3.inOut' }, t2);
  tl.to(sub2, { autoAlpha: 0, y: -240, duration: 0.6 }, t2);
  const sv = c.svg();
  const hub = c.add(`<div class="abs" style="left:960px;top:640px;width:230px;height:230px;margin:-115px 0 0 -115px;border-radius:50%;display:grid;place-items:center;
    background:radial-gradient(circle at 35% 30%,#1f5a69,#0d2a33 70%);border:3px solid var(--lime);box-shadow:0 0 0 14px rgba(212,255,0,.08),0 0 70px rgba(212,255,0,.3)">
    <div style="text-align:center;color:var(--lime)">${I('network', 70, 1.6)}<div style="font:700 19px/1.2 var(--head);color:#fff;margin-top:8px">Centralized<br>Digital Platform</div></div></div>`);
  const nA = flowNode(c, 470, 470, 'user-plus', 'Applicants');
  const nS = flowNode(c, 470, 690, 'graduation-cap', 'Scholars');
  const nC = flowNode(c, 1450, 580, 'landmark', 'CED');
  const w1 = wire(sv, curve(535, 529, 845, 640)), w2 = wire(sv, curve(535, 749, 845, 640)), w3 = wire(sv, curve(1075, 640, 1385, 639));
  pop(tl, hub, t2 + 0.5, { s: 0.6 });
  inn(tl, nA, c.word(2, 'applicants'), { y: 20 }); inn(tl, nS, c.word(2, 'scholars,'), { y: 20 }); inn(tl, nC, c.word(2, 'and ced'), { y: 20 });
  draw(tl, w1, c.word(2, 'applicants') + 0.2); draw(tl, w2, c.word(2, 'scholars,') + 0.2); draw(tl, w3, c.word(2, 'and ced') + 0.2);
  const tp = c.word(2, 'centralized');
  [w1, w2].forEach((w, i) => { packet(c, w, tp + i * 0.3, 1.1); packet(c, w3, tp + 1.2 + i * 0.4, 1.1, { reverse: i === 1 }); });
  c.cue('whoosh', t2, 0.4);
});

/* ---------------- 2. Current process ---------------- */
const ROW1 = [['user', 'Applicant'], ['file-stack', 'Requirements<br>Submission'], ['clipboard-pen-line', 'Examination'], ['messages-square', 'Interview'],
  ['list-ordered', 'Evaluation /<br>Ranking'], ['user-check', 'Selection'], ['graduation-cap', 'Scholar']];
const ROW2 = [['graduation-cap', 'Scholar'], ['book-open', 'Submit<br>Subjects'], ['chart-column', 'Grade<br>Monitoring'], ['calendar-check', 'Attendance<br>Monitoring'],
  ['file-check', 'Requirements'], ['scan-eye', 'Scholarship<br>Monitoring'], ['award', 'Graduation'], ['briefcase', 'Post-Graduation<br>Tracking']];
const R1X = (i) => 960 + (i - 3) * 250, R1Y = 400;
const R2X = (i) => 960 + (i - 3.5) * 224, R2Y = 575;
const R1_COMPACT = { y: -190, scale: 0.8 }; // row 1 once row 2 is shown

function buildRow1(c, group, o = {}) {
  const sv = svgLayer(group); const nodes = [], wires = [];
  ROW1.forEach(([ic, lb], i) => {
    const n = add(group, `<div class="node ${i === 6 ? 'hl' : ''}"><div class="ring">${I(ic, 50, 1.8)}</div><div class="lbl">${lb}</div></div>`, { left: R1X(i) + 'px', top: R1Y + 'px' });
    nodes.push(n);
    if (i) wires.push(wire(sv, `M${R1X(i - 1) + 72},${R1Y + 59} L${R1X(i) - 72},${R1Y + 59}`));
  });
  return { nodes, wires };
}
function buildRow2(c, group) {
  const sv = svgLayer(group); const nodes = [], wires = [];
  ROW2.forEach(([ic, lb], i) => {
    const n = add(group, `<div class="node sm ${i === 0 ? 'hl' : ''}"><div class="ring">${I(ic, 40, 1.8)}</div><div class="lbl">${lb}</div></div>`, { left: R2X(i) + 'px', top: R2Y + 'px' });
    nodes.push(n);
    if (i) wires.push(wire(sv, `M${R2X(i - 1) + 58},${R2Y + 46} L${R2X(i) - 58},${R2Y + 46}`));
  });
  return { nodes, wires };
}
function compactRow1(g) { gsap.set(g, { transformOrigin: `960px ${R1Y + 59}px` }); }

scene('process_applicant', (c) => {
  const { tl } = c;
  const head = c.add(`<div class="abs" style="top:150px;width:100%;text-align:center"><div class="kicker">How it works today</div><div class="h2" style="margin-top:14px">The Scholarship Application Process</div></div>`);
  inn(tl, head, c.at(0, 0), { y: 20 });
  const g = c.add(`<div class="abs" style="inset:0"></div>`);
  const { nodes, wires } = buildRow1(c, g);
  const T = [c.end(0) - 0.6, c.at(1, 0.05), c.word(1, 'takes'), c.word(1, 'goes through'), c.at(2, 0.05), c.word(2, 'those'), c.word(2, 'become')];
  nodes.forEach((n, i) => { pop(tl, n, T[i], { s: 0.6 }); c.cue('pop', T[i], 0.35); if (i) draw(tl, wires[i - 1], T[i] - 0.35, 0.45); });
  c.cue('chime', T[6] + 0.1, 0.45);
  tl.to(head, { autoAlpha: 0, y: -20, duration: 0.5 }, c.dur - 0.6);
});

scene('process_scholar', (c) => {
  const { tl } = c;
  const g1 = c.add(`<div class="abs" style="inset:0"></div>`); compactRow1(g1);
  const r1 = buildRow1(c, g1);
  tl.to(g1, { ...R1_COMPACT, duration: 1.0, ease: 'power3.inOut' }, c.at(0, 0.1));
  const g2 = c.add(`<div class="abs" style="inset:0"></div>`);
  const r2 = buildRow2(c, g2);
  // the Scholar node travels from the end of row 1 to the start of row 2
  const fromX = 960 + (R1X(6) - 960) * 0.8 - R2X(0), fromY = R1Y + R1_COMPACT.y + 59 * 0.8 + (R1Y - R1Y) - (R2Y + 46) + 20;
  tl.fromTo(r2.nodes[0], { x: fromX, y: fromY, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 1.1, ease: 'power3.inOut' }, c.end(0) - 0.2);
  const lab = c.add(`<div class="abs kicker" style="left:0;width:1920px;text-align:center;top:${R2Y - 80}px;color:var(--lime)">Scholar journey · every semester</div>`);
  inn(tl, lab, c.end(0), { y: 10 });
  const T = [null, c.at(1, 0.05), c.word(1, 'grades'), c.word(1, 'attendance'), c.at(2, 0.05), c.word(2, 'until'), c.word(2, 'graduation'), c.word(2, 'even after')];
  r2.nodes.forEach((n, i) => { if (!i) return; pop(tl, n, T[i], { s: 0.6 }); c.cue('pop', T[i], 0.3); draw(tl, r2.wires[i - 1], T[i] - 0.35, 0.45); });
});

scene('process_manual', (c) => {
  const { tl } = c;
  const g1 = c.add(`<div class="abs" style="inset:0"></div>`); compactRow1(g1);
  const r1 = buildRow1(c, g1); gsap.set(g1, R1_COMPACT);
  const g2 = c.add(`<div class="abs" style="inset:0"></div>`);
  const r2 = buildRow2(c, g2);
  c.add(`<div class="abs kicker" style="left:0;width:1920px;text-align:center;top:${R2Y - 80}px;color:var(--lime)">Scholar journey · every semester</div>`);
  const TAGS = { printed: ['printer', 'Printed', [[r1, 1], [r1, 2], [r2, 4]]], spreadsheets: ['sheet', 'Spreadsheet', [[r1, 4], [r2, 2], [r2, 3], [r2, 5]]], 'face-to-face': ['users', 'Face-to-face', [[r1, 3], [r2, 1], [r2, 7]]] };
  for (const [word, [ic, txt, where]] of Object.entries(TAGS)) {
    const tags = where.map(([row, i]) => add(row.nodes[i], `<div class="tag chip amber sm" style="position:absolute;top:-30px;left:50%;right:auto">${I(ic, 18)}${txt}</div>`));
    tags.forEach((e) => gsap.set(e, { xPercent: -50 }));
    pop(tl, tags, c.word(0, word) - 0.1, { s: 0.4, st: 0.12 });
    c.cue('pop', c.word(0, word), 0.35);
  }
  const all = [...r1.nodes, ...r2.nodes].map((n) => n.querySelector('.ring'));
  tl.to(all, { borderColor: 'rgba(244,162,97,.7)', color: '#f4a261', duration: 0.8, stagger: 0.03 }, c.word(0, 'rely'));
});

/* ---------------- 3. Problems ---------------- */
const PROBLEMS = [['route', 'Hard to track scholars across their journey'], ['file-text', 'Paper-based, manually kept records'], ['chart-column', 'Grades & attendance are hard to monitor'],
  ['hourglass', 'Delayed report generation'], ['folder-open', 'Disorganized requirements & documents'], ['flame', 'Records at risk of loss or damage'],
  ['user-search', 'Student status is hard to monitor'], ['megaphone', 'Communication & announcement gaps']];
const PX = (i) => 112 + (i % 4) * 432, PY = (i) => 285 + Math.floor(i / 4) * 244;
function buildProblems(c) {
  return PROBLEMS.map(([ic, t], i) => c.add(`<div class="problem card" style="left:${PX(i)}px;top:${PY(i)}px"><div class="pi">${I(ic, 32, 1.9)}</div><div class="pt">${t}</div><div class="pn">0${i + 1}</div></div>`));
}
scene('problems', (c) => {
  const { tl } = c;
  const head = c.add(`<div class="abs" style="top:140px;width:100%;text-align:center"><div class="h2">Challenges of a manual process</div></div>`);
  inn(tl, head, c.at(0, 0), { y: 20 });
  const cards = buildProblems(c);
  cards.forEach((e, i) => { inn(tl, e, c.at(i + 1, 0) - 0.15, { y: 40, s: 0.94, d: 0.6 }); c.cue('pop', c.at(i + 1, 0) - 0.1, 0.3); });
});
