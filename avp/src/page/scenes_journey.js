/* Section 6 (part 1): the complete ISKONNECT process — journey intro and
   steps 1–6. The sample applicant "Juan Dela Cruz" is fictional. */

const STUDENT = { name: 'Juan Dela Cruz', first: 'Juan', ini: 'JD', school: 'Luna Goco Colleges, Inc.', program: 'BS Information Technology', id: '2026-00123', email: 'juan.delacruz@email.com' };
const WORDMARK = () => `${ASSET}img/iskonnect_wordmark.png`;

function stepHead(c, title, o = {}) {
  const e = c.add(`<div class="abs" style="left:${o.x ?? 110}px;top:${o.y ?? 150}px;${o.w ? `width:${o.w}px;` : ''}">
    <div class="badge-step">${I('circle-dot', 20, 2.4)}Step ${String(c.s.step).padStart(2, '0')}</div>
    <div class="h2" style="margin-top:14px;${o.nowrap ? 'white-space:nowrap' : ''}">${title}</div></div>`);
  inn(c.tl, e, 0.15, { y: 20 });
  c.cue('whoosh', 0.0, 0.35);
  return e;
}
/* Vertical list of flow steps with a connecting rail; returns row elements. */
function vList(c, x, y, items, gap = 92) {
  const rows = items.map(([ic, t], i) => c.add(`<div class="abs vrow" style="left:${x}px;top:${y + i * gap}px;display:flex;align-items:center;gap:18px">
    <span class="vi" style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#0f2f38;border:2px solid rgba(78,205,196,.4);color:var(--mint)">${I(ic, 26)}</span>
    <span class="vt" style="font:600 25px/1.25 var(--head);color:var(--muted)">${t}</span></div>`));
  const sv = c.svg();
  for (let i = 1; i < items.length; i++) wire(sv, `M${x + 29},${y + (i - 1) * gap + 62} L${x + 29},${y + i * gap - 4}`, 'dash');
  return rows;
}
function vOn(tl, row, t, color = 'var(--lime)') {
  tl.to(row.querySelector('.vi'), { borderColor: color, color, boxShadow: '0 0 24px rgba(212,255,0,.35)', duration: 0.4 }, t);
  tl.to(row.querySelector('.vt'), { color: '#fff', duration: 0.4 }, t);
}
function vDone(tl, row, t) {
  tl.to(row.querySelector('.vi'), { borderColor: '#4ecdc4', color: '#4ecdc4', boxShadow: '0 0 0 rgba(0,0,0,0)', duration: 0.4 }, t);
  tl.to(row.querySelector('.vt'), { color: '#b9d3d6', duration: 0.4 }, t);
}
/* Readable dark admin panel (styled after the admin-ui). */
function admPanel(c, x, y, w, title, icon, h) {
  const e = c.add(`<div class="abs" style="left:${x}px;top:${y}px;width:${w}px;${h ? `height:${h}px;` : ''}border-radius:20px;overflow:hidden;background:#0f2127;border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 80px rgba(0,0,0,.5)">
    <div style="display:flex;align-items:center;gap:12px;padding:16px 22px;background:#0a171b;border-bottom:1px solid rgba(255,255,255,.07)">
      <span style="width:34px;height:34px;border-radius:10px;background:#1b4d5c;display:grid;place-items:center;color:var(--mint)">${I(icon, 18)}</span>
      <span style="font:700 20px/1 var(--head)">${title}</span><span style="margin-left:auto;font:600 13px/1 var(--body);color:#7fa2a8;letter-spacing:.08em">CED ADMIN</span></div>
    <div class="pb" style="padding:18px 22px"></div></div>`);
  e.body = e.querySelector('.pb');
  return e;
}
function tapAt(c, parent, x, y, t) {
  const r = add(parent, `<div style="position:absolute;left:${x}px;top:${y}px;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;background:rgba(27,77,92,.35);z-index:40"></div>`);
  c.tl.fromTo(r, { scale: 0.2, autoAlpha: 0.9 }, { scale: 1.6, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, t);
  c.cue('tap', t, 0.35);
}

/* ---------------- journey intro ---------------- */
scene('journey_intro', (c) => {
  const { tl } = c;
  const labels = ['Application', 'Exam & Interview', 'Evaluation & Selection', 'Becoming a Scholar', 'Semester Process', 'QR Attendance', 'Attendance Alert', 'Requirements', 'Announcements', 'Reports', 'Status & History', 'Complete Cycle'];
  const pts = labels.map((_, i) => [150 + i * 147, 540 + Math.sin(i * 0.9) * 90]);
  let d = `M${pts[0][0] - 80},${pts[0][1]}`;
  pts.forEach(([x, y], i) => { if (!i) d += ` L${x},${y}`; else { const [px, py] = pts[i - 1]; d += ` C${px + 70},${py} ${x - 70},${y} ${x},${y}`; } });
  const sv = c.svg(); const road = wire(sv, d); road.style.strokeWidth = 5; road.style.stroke = 'rgba(78,205,196,.45)';
  const t0 = c.at(0, 0);
  draw(tl, road, t0, 2.2);
  pts.forEach(([x, y], i) => {
    const up = i % 2 === 0;
    const m = c.add(`<div class="abs" style="left:${x}px;top:${y}px;width:0;height:0">
      <div style="position:absolute;left:-13px;top:-13px;width:26px;height:26px;border-radius:50%;background:#0f2f38;border:3px solid var(--mint)"></div>
      <div style="position:absolute;left:-90px;width:180px;text-align:center;${up ? 'bottom:26px' : 'top:26px'}">
        <div style="font:700 15px/1 var(--head);color:var(--lime);letter-spacing:.14em">${String(i + 1).padStart(2, '0')}</div>
        <div style="font:600 17px/1.2 var(--head);margin-top:6px">${labels[i]}</div></div></div>`);
    pop(tl, m, t0 + 0.2 + i * 0.18, { s: 0.5 });
  });
  const walker = c.add(`<div class="abs" style="width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:var(--lime);color:#0b232a;display:grid;place-items:center;box-shadow:0 0 30px rgba(212,255,0,.7)">${I('user', 32, 2.4)}</div>`);
  const len = road.getTotalLength();
  c.hook((t) => { const k = ease(clamp((t - t0 - 0.6) / (c.end(0) - t0 + 0.2))); const q = road.getPointAtLength(len * (0.03 + 0.97 * k)); walker.style.left = q.x + 'px'; walker.style.top = q.y + 'px'; walker.style.opacity = t < t0 + 0.4 ? 0 : 1; });
  const head = c.add(`<div class="abs" style="top:170px;width:100%;text-align:center"><div class="kicker">From application to graduation, and beyond</div><div class="h2" style="margin-top:14px">One student's journey</div></div>`);
  inn(tl, head, t0, { y: 20 });
});

/* ---------------- step 1: application ---------------- */
scene('step1_app', (c) => {
  const { tl } = c;
  stepHead(c, 'Application');
  const rows = vList(c, 110, 330, [['log-in', 'Register / Login'], ['user', 'Applicant Profile'], ['file-text', 'Scholarship Application'], ['upload', 'Upload Requirements'], ['shield-check', 'Accessible to CED']]);
  inn(tl, rows, 0.4, { x: -30, y: 0, st: 0.08 });
  const p = phone(c, 690, 140, 0.9);
  inn(tl, p, 0.3, { y: 60, d: 0.9 });
  // splash
  const vSplash = p.view(`<div style="position:absolute;inset:0;background:linear-gradient(160deg,#1b4d5c,#0f3441);display:grid;place-items:center">
    <div style="text-align:center"><div style="width:300px;padding:26px 18px;border-radius:26px;background:rgba(255,255,255,.95)"><img src="${WORDMARK()}" style="width:100%"></div>
    <div style="font:500 15px/1.3 var(--body);color:#cfe6e8;margin-top:18px">City Education Department<br>Scholarship Program</div></div></div>`);
  tl.fromTo(vSplash.firstElementChild.firstElementChild, { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.6)' }, c.at(0, 0.25));
  c.cue('tap', c.at(0, 0.2), 0.3);
  // login
  const vLogin = p.view(`<div class="app-hd" style="padding-bottom:40px"><div class="t">Welcome!</div><div class="s">Log in or create your ISKONNECT account</div></div>
    <div class="app-body"><div class="a-card" style="margin-top:-34px;display:flex;flex-direction:column;gap:6px">
      <div class="a-lbl">Email</div><div class="a-field"><span class="em"></span></div>
      <div class="a-lbl" style="margin-top:8px">Password</div><div class="a-field"><span class="pw"></span></div>
      <div class="a-btn" style="margin-top:14px">Log In</div>
      <div class="a-s" style="text-align:center;margin-top:8px">No account yet? <b style="color:#1b4d5c">Register</b></div></div></div>`);
  gsap.set(vLogin, { autoAlpha: 0 });
  const tL = c.at(1, 0) - 0.3;
  swap(tl, vSplash, vLogin, tL);
  typeText(c, vLogin.querySelector('.em'), STUDENT.email, tL + 0.5, 1.2);
  typeText(c, vLogin.querySelector('.pw'), '••••••••••', tL + 1.8, 0.6, false);
  tapAt(c, vLogin, 185, 368, tL + 2.6);
  vOn(tl, rows[0], tL);
  // profile
  const vProf = p.view(`<div class="app-hd"><div class="t">Applicant Profile</div><div class="s">Tell us about yourself</div></div>
    <div class="app-body">${[['Full name', STUDENT.name], ['Barangay', 'Lalud, Calapan City'], ['School', STUDENT.school], ['Program', STUDENT.program], ['Year level', '1st Year']].map(([l, v], i) =>
    `<div><div class="a-lbl">${l}</div><div class="a-field"><span class="f${i}"></span></div></div>`).join('')}</div>`);
  gsap.set(vProf, { autoAlpha: 0 });
  const tP = c.word(1, 'set up') - 0.2;
  swap(tl, vLogin, vProf, tP);
  ['Juan Dela Cruz', 'Lalud, Calapan City', STUDENT.school, STUDENT.program, '1st Year'].forEach((v, i) => typeText(c, vProf.querySelector('.f' + i), v, tP + 0.5 + i * 0.4, 0.35, false));
  vDone(tl, rows[0], tP); vOn(tl, rows[1], tP);
  // application form
  const secs = ['Personal Information', 'Family & Economic Background', 'Educational Background', 'Essay', 'Agreement & Consent'];
  const vApp = p.view(`<div class="app-hd"><div class="t">Scholarship Application</div><div class="s">CED Scholarship Program · A.Y. 2026–2027</div></div>
    <div class="app-body">${secs.map((s, i) => `<div class="a-card a-row" style="padding:13px 14px"><span class="a-ico ck${i}" style="background:#eef3f4;color:#9ab2b7;width:36px;height:36px">${I('circle-check', 20)}</span><div class="a-t" style="font-size:15px">${s}</div></div>`).join('')}
    <div class="a-btn" style="margin-top:6px">Continue to Requirements</div></div>`);
  gsap.set(vApp, { autoAlpha: 0 });
  const tA = c.word(1, 'fill out') - 0.2;
  swap(tl, vProf, vApp, tA);
  secs.forEach((_, i) => tl.to(vApp.querySelector('.ck' + i), { backgroundColor: '#dcf7ea', color: '#13925b', duration: 0.3 }, tA + 0.6 + i * 0.35));
  vDone(tl, rows[1], tA); vOn(tl, rows[2], tA);
  // requirements
  const reqs = ['Application Form', '2x2 ID Pictures', 'SHS Form 137', 'Good Moral Certificate', "Parent's Voter's ID / Cert.", 'Barangay Residency Cert.', 'Latest Electric Bill', "Parents' Cedula"];
  const vReq = p.view(`<div class="app-hd" style="padding-bottom:18px"><div class="t">Requirements</div><div class="s">Upload clear copies (PDF, JPG, PNG)</div></div>
    <div class="app-body" style="gap:8px"><div class="a-card prog" style="background:#1b4d5c;color:#fff;border:0;padding:14px 16px">
      <div class="a-row" style="justify-content:space-between"><b style="font:800 22px/1 var(--head)"><span class="cnt">0</span> / 8 documents</b><span class="st" style="background:rgba(255,255,255,.15);color:#fff">${I('upload', 12, 2.6)}Uploading</span></div>
      <div style="height:8px;border-radius:6px;background:rgba(255,255,255,.2);margin-top:12px;overflow:hidden"><div class="bar" style="height:100%;width:0;background:#d4ff00;border-radius:6px"></div></div></div>
      ${reqs.map((r, i) => `<div class="a-card a-row" style="padding:9px 12px;justify-content:space-between"><span class="a-row" style="gap:10px"><span style="color:#1b4d5c">${I('file-text', 18)}</span><span class="a-t" style="font-size:13.5px">${r}</span></span><span class="st pending r${i}">Pending</span></div>`).join('')}</div>`);
  gsap.set(vReq, { autoAlpha: 0 });
  const tR = c.at(2, 0) - 0.3;
  swap(tl, vApp, vReq, tR);
  vDone(tl, rows[2], tR); vOn(tl, rows[3], tR);
  const upD = (c.end(2) - tR - 0.8) / 8;
  c.hook((t) => {
    const n = clamp(Math.floor((t - tR - 0.6) / upD), 0, 8);
    vReq.querySelector('.cnt').textContent = n;
    vReq.querySelector('.bar').style.width = (n / 8) * 100 + '%';
    for (let i = 0; i < 8; i++) { const e = vReq.querySelector('.r' + i); const on = i < n; e.className = 'st r' + i + (on ? ' submitted' : ' pending'); e.textContent = on ? 'Submitted' : 'Pending'; }
  });
  for (let i = 0; i < 8; i += 2) c.cue('tick', tR + 0.6 + (i + 1) * upD, 0.25);
  // submitted → admin
  const tS = c.at(3, 0) - 0.2;
  const done = add(vReq, `<div style="position:absolute;inset:0;background:rgba(243,246,247,.96);display:grid;place-items:center;z-index:5"><div style="text-align:center;padding:0 30px">
    <div style="width:110px;height:110px;margin:0 auto;border-radius:50%;background:#dcf7ea;color:#13925b;display:grid;place-items:center">${I('check', 60, 2.6)}</div>
    <div style="font:800 26px/1.2 var(--head);margin-top:20px">Application Submitted</div><div class="a-s" style="font-size:15px;margin-top:8px">Status: <b style="color:#2f6fc0">Pending review</b></div></div></div>`);
  tl.fromTo(done, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, tS);
  tl.fromTo(done.querySelector('div > div'), { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'back.out(2)' }, tS);
  c.cue('chime', tS + 0.1, 0.4);
  vDone(tl, rows[3], tS); vOn(tl, rows[4], tS + 0.6);
  const adm = admPanel(c, 1160, 250, 660, 'Applications Management', 'file-text');
  adm.body.innerHTML = `<table style="width:100%;border-collapse:collapse;font:500 16px/1.2 var(--body)"><tr style="color:#7fa2a8;font-size:12px;letter-spacing:.08em;text-transform:uppercase">
    <td style="padding:8px 6px">Applicant</td><td>School</td><td>Req.</td><td>Status</td></tr>
    ${[['MS', 'Applicant', '#9b8ec9', '8/8', 'y', 'For Exam'], ['RB', 'Applicant', '#f4a261', '6/8', 'n', 'Pending']].map(([i, n, col, r, cl, st]) => `<tr style="border-top:1px solid rgba(255,255,255,.06);color:#a9c2c6"><td style="padding:12px 6px"><span class="av" style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:${col};color:#fff;font:700 12px/1 var(--body);margin-right:8px">${i}</span>${n}</td><td>—</td><td>${r}</td><td><span class="ast ${cl}">${st}</span></td></tr>`).join('')}
    <tr class="new" style="border-top:1px solid rgba(255,255,255,.06);background:rgba(212,255,0,.08)"><td style="padding:14px 6px;font-weight:700;color:#fff"><span style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#2d9596;color:#fff;font:700 12px/1 var(--body);margin-right:8px">JD</span>${STUDENT.name}</td>
    <td style="color:#cfe3e5">Luna Goco Colleges</td><td style="color:#34d399;font-weight:700">8/8</td><td><span class="ast b">Pending</span></td></tr></table>`;
  inn(tl, adm, c.at(3, 0.05), { x: 60, y: 0 });
  const nr = adm.body.querySelector('.new');
  tl.fromTo(nr, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, c.word(3, 'become') + 0.3);
  const sv = c.svg(); const w = wire(sv, curve(1040, 470, 1160, 500), 'lime dash');
  tl.fromTo(w, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, c.at(3, 0.1));
  packet(c, w, c.at(3, 0.2), 0.8); packet(c, w, c.at(3, 0.32), 0.8);
  const lock = c.add(`<div class="chip lime" style="position:absolute;left:1160px;top:560px">${I('lock', 22)}Authorized CED administrators only</div>`);
  pop(tl, lock, c.word(3, 'authorized'), { s: 0.7 });
});

/* ---------------- step 2: examination & interview ---------------- */
function calendar(c, x, y, marks) {
  let cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<b style="color:#7fa2a8;font:700 12px/1 var(--body)">${d}</b>`).join('');
  for (let i = 0; i < 4; i++) cells += '<span></span>';
  for (let d = 1; d <= 31; d++) cells += `<span class="cd d${d}" style="height:34px;border-radius:9px;display:grid;place-items:center;font:600 14px/1 var(--body);color:#cfe3e5">${d}</span>`;
  return `<div style="font:700 16px/1 var(--head);margin-bottom:12px">October 2026</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;text-align:center">${cells}</div>`;
}
scene('step2_sched', (c) => {
  const { tl } = c;
  stepHead(c, 'Examination &amp;<br>Interview');
  const rows = vList(c, 110, 400, [['clock', 'Pending'], ['clipboard-pen-line', 'For Exam'], ['messages-square', 'For Interview']], 110);
  inn(tl, rows, 0.4, { x: -30, y: 0, st: 0.08 });
  vDone(tl, rows[0], 0.6);
  const p = phone(c, 660, 140, 0.9);
  inn(tl, p, 0.3, { y: 60, d: 0.9 });
  const v = p.view(`<div class="app-hd" style="padding-bottom:22px"><div class="s" style="margin:0 0 4px">Hello,</div><div class="t">${STUDENT.first} 👋</div></div>
    <div class="app-body">
      <div class="a-card"><div class="a-s" style="margin:0">Application status</div><div class="a-row" style="justify-content:space-between;margin-top:8px"><b style="font:700 18px/1 var(--head)">CED Scholarship</b><span class="st exam stx">For Exam</span></div></div>
      <div class="a-card ex" style="border-left:5px solid #f4a261"><div class="a-row"><span class="a-ico" style="background:#fff4de;color:#e08a1e">${I('clipboard-pen-line', 22)}</span><div><div class="a-t">Examination Schedule</div><div class="a-s">Sat, Oct 17, 2026 · 8:00 AM</div><div class="a-s">Venue: CED Office</div></div></div></div>
      <div class="a-card iv" style="border-left:5px solid #9b8ec9"><div class="a-row"><span class="a-ico" style="background:#efe9ff;color:#7457c9">${I('messages-square', 22)}</span><div><div class="a-t">Panel Interview</div><div class="a-s">Thu, Oct 22, 2026 · 1:30 PM</div><div class="a-s">Venue: CED Office</div></div></div></div>
      <div class="a-card"><div class="a-row"><span class="a-ico" style="background:#e6f3f3;color:#1b4d5c">${I('bell', 20)}</span><div class="a-t" style="font-size:14px">Bring a valid ID and a black pen.</div></div></div>
    </div>${bnav(0)}`);
  const ex = v.querySelector('.ex'), iv = v.querySelector('.iv'), stx = v.querySelector('.stx');
  gsap.set([ex, iv], { autoAlpha: 0 });
  const n1 = add(p.scr, `<div class="notif"><div class="app">${I('graduation-cap', 22)}</div><div><div style="font:700 14px/1.2 var(--body)">ISKONNECT · CED</div><div style="font:500 14px/1.3 var(--body);color:#40606a">Your examination schedule is set: Sat, Oct 17 · 8:00 AM</div></div></div>`);
  const n2 = add(p.scr, `<div class="notif"><div class="app">${I('graduation-cap', 22)}</div><div><div style="font:700 14px/1.2 var(--body)">ISKONNECT · CED</div><div style="font:500 14px/1.3 var(--body);color:#40606a">Interview schedule: Thu, Oct 22 · 1:30 PM</div></div></div>`);
  [n1, n2].forEach((n) => { n.querySelector('.app').style.color = '#d4ff00'; });
  const tE = c.word(0, 'receives') - 0.2, tI = c.at(1, 0.05);
  tl.fromTo(n1, { y: -140, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.4)' }, tE);
  tl.to(n1, { y: -140, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, tE + 2.6);
  inn(tl, ex, tE + 0.5, { y: 20 });
  c.cue('ding', tE + 0.1, 0.45);
  vOn(tl, rows[1], tE);
  tl.fromTo(n2, { y: -140, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(1.4)' }, tI);
  tl.to(n2, { y: -140, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, tI + 2.4);
  inn(tl, iv, tI + 0.5, { y: 20 });
  c.cue('ding', tI + 0.1, 0.45);
  vDone(tl, rows[1], tI); vOn(tl, rows[2], tI);
  c.hook((t) => { const f = t >= tI + 0.4; stx.textContent = f ? 'For Interview' : 'For Exam'; stx.className = 'st stx ' + (f ? 'interview' : 'exam'); });
  // admin: applications + schedule
  const adm = admPanel(c, 1140, 150, 680, 'Applications Management', 'file-text');
  adm.body.innerHTML = `<table style="width:100%;border-collapse:collapse;font:500 16px/1.2 var(--body)"><tr style="color:#7fa2a8;font-size:12px;letter-spacing:.08em;text-transform:uppercase"><td style="padding:6px">Applicant</td><td>Exam</td><td>Interview</td><td>Status</td></tr>
    ${[['JD', STUDENT.name, '#2d9596', 'Oct 17', 'Oct 22', 'p', 'For Interview', 1], ['MS', 'Applicant', '#9b8ec9', 'Oct 17', 'Oct 22', 'p', 'For Interview', 0], ['RB', 'Applicant', '#f4a261', 'Oct 17', '—', 'y', 'For Exam', 0], ['AL', 'Applicant', '#5fb3f9', '—', '—', 'n', 'Pending', 0]]
    .map(([i, n, col, e, iv, cl, st, me]) => `<tr style="border-top:1px solid rgba(255,255,255,.06);${me ? 'background:rgba(212,255,0,.07);color:#fff;font-weight:700' : 'color:#a9c2c6'}"><td style="padding:11px 6px"><span style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:8px;background:${col};color:#fff;font:700 12px/1 var(--body);margin-right:8px">${i}</span>${n}</td><td>${e}</td><td>${iv}</td><td><span class="ast ${cl}">${st}</span></td></tr>`).join('')}</table>`;
  const cal = admPanel(c, 1140, 520, 400, 'Schedules', 'calendar-days');
  cal.body.innerHTML = calendar(c);
  const ev = c.add(`<div class="abs" style="left:1560px;top:560px;width:260px;display:flex;flex-direction:column;gap:12px">
    <div class="chip amber" style="font-size:18px">${I('clipboard-pen-line', 20)}Exam · Oct 17</div><div class="chip" style="font-size:18px;border-color:rgba(155,142,201,.6);color:#d8d0ff">${I('messages-square', 20)}Interview · Oct 22</div></div>`);
  const tAd = c.at(2, 0) - 0.2;
  inn(tl, adm, tAd, { x: 60, y: 0 }); inn(tl, cal, tAd + 0.35, { x: 60, y: 0 }); inn(tl, ev, tAd + 0.8, { x: 30, y: 0 });
  tl.to(cal.querySelector('.d17'), { backgroundColor: '#f4a261', color: '#0b232a', duration: 0.3 }, c.word(2, 'schedules'));
  tl.to(cal.querySelector('.d22'), { backgroundColor: '#9b8ec9', color: '#0b232a', duration: 0.3 }, c.word(2, 'schedules') + 0.3);
});

/* ---------------- step 3: evaluation & selection ---------------- */
scene('step3_eval', (c) => {
  const { tl } = c;
  stepHead(c, 'Evaluation &amp; Selection', { nowrap: true });
  const inputs = [['clipboard-pen-line', 'Examination', 'examination'], ['wallet', 'Economic Background', 'economic'], ['users', 'Panel Interview', 'panel']];
  const sv = c.svg();
  const cards = inputs.map(([ic, t, w], i) => {
    const y = 350 + i * 150;
    const e = c.add(`<div class="abs card" style="left:110px;top:${y}px;width:420px;height:112px;display:flex;align-items:center;gap:20px;padding:0 26px">
      <span style="width:62px;height:62px;border-radius:18px;display:grid;place-items:center;background:rgba(78,205,196,.12);border:1px solid rgba(78,205,196,.4);color:var(--mint)">${I(ic, 32)}</span>
      <span style="font:600 28px/1.2 var(--head)">${t}</span></div>`);
    const wv = wire(sv, curve(530, y + 56, 680, 510));
    inn(tl, e, c.word(1, w) - 0.2, { x: -40, y: 0 }); draw(tl, wv, c.word(1, w) + 0.2, 0.6);
    return e;
  });
  // ranking board
  const board = c.add(`<div class="abs card" style="left:680px;top:300px;width:600px;height:500px;padding:26px 28px">
    <div class="a-row" style="gap:12px;display:flex;align-items:center"><span style="color:var(--lime)">${I('list-ordered', 30)}</span><span style="font:700 28px/1 var(--head)">Evaluation / Ranking</span></div>
    <div class="rk" style="position:relative;margin-top:24px;height:390px"></div></div>`);
  inn(tl, board, c.at(1, 0.15), { y: 30 });
  const rk = board.querySelector('.rk');
  const scores = [78, 91, 64, 86, 72, 95];
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const rowsE = scores.map((s, i) => add(rk, `<div style="position:absolute;left:0;right:0;top:${i * 64}px;height:52px;display:flex;align-items:center;gap:14px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.05)">
    <span class="pos" style="width:30px;font:700 20px/1 var(--head);color:var(--muted)">${i + 1}</span><span style="width:150px;font:600 19px/1 var(--body)">Applicant ${String.fromCharCode(65 + i)}</span>
    <span style="flex:1;height:12px;border-radius:8px;background:rgba(255,255,255,.08);overflow:hidden"><span class="bar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#2d9596,#4ecdc4);border-radius:8px"></span></span>
    <span class="sc" style="width:46px;text-align:right;font:700 19px/1 var(--head)">${s}</span></div>`));
  const tBars = c.at(1, 0.5), tSort = c.word(2, 'ranked');
  rowsE.forEach((r, i) => tl.to(r.querySelector('.bar'), { width: scores[i] + '%', duration: 0.9, ease: 'power2.out' }, tBars + i * 0.12));
  rowsE.forEach((r, i) => tl.to(r, { top: order.indexOf(i) * 64, duration: 0.9, ease: 'power3.inOut' }, tSort));
  c.hook((t) => { rowsE.forEach((r, i) => { r.querySelector('.pos').textContent = t >= tSort + 0.5 ? order.indexOf(i) + 1 : i + 1; }); });
  c.cue('whoosh', tSort, 0.25);
  // selection with slots
  const sel = c.add(`<div class="abs card" style="left:1350px;top:300px;width:460px;height:500px;padding:26px 28px">
    <div style="display:flex;align-items:center;gap:12px"><span style="color:var(--lime)">${I('user-check', 30)}</span><span style="font:700 28px/1 var(--head)">Selection</span></div>
    <div class="muted" style="font:500 18px/1.4 var(--body);margin-top:18px">Available scholar slots</div>
    <div class="slots" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px">${Array.from({ length: 4 }, (_, i) => `<span class="slot s${i}" style="height:74px;border-radius:14px;border:2px dashed rgba(255,255,255,.2);display:grid;place-items:center;color:rgba(255,255,255,.25)">${I('user', 30)}</span>`).join('')}</div>
    <div class="budget chip amber" style="margin-top:26px;font-size:18px">${I('banknote', 22)}Based on the annual program budget</div>
    <div class="dec chip lime" style="margin-top:14px;font-size:18px">${I('stamp', 22)}Final selection by CED</div></div>`);
  inn(tl, sel, c.word(2, 'final') - 0.3, { x: 40, y: 0 });
  const slots = sel.querySelectorAll('.slot');
  tl.fromTo(sel.querySelector('.budget'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5 }, c.word(3, 'budget') - 0.3);
  gsap.set(sel.querySelector('.dec'), { autoAlpha: 0 });
  slots.forEach((s, i) => tl.to(s, { borderStyle: 'solid', borderColor: '#d4ff00', color: '#d4ff00', backgroundColor: 'rgba(212,255,0,.1)', duration: 0.35 }, c.at(3, 0.15) + i * 0.3));
  order.slice(0, 4).forEach((ri, k) => tl.to(rowsE[ri], { backgroundColor: 'rgba(212,255,0,.1)', duration: 0.35 }, c.at(3, 0.15) + k * 0.3));
  c.cue('pop', c.at(3, 0.15), 0.3);
  tl.to(sel.querySelector('.dec'), { autoAlpha: 1, duration: 0.5 }, c.word(2, 'final'));
  // assist, not decide
  const note = c.add(`<div class="abs" style="left:0;width:1920px;top:835px;display:flex;justify-content:center;gap:22px">
    <span class="chip" style="font-size:24px;padding:14px 26px">${I('layers', 26)}ISKONNECT assists &amp; records</span>
    <span class="chip lime" style="font-size:24px;padding:14px 26px">${I('landmark', 26)}CED decides</span></div>`);
  inn(tl, note, c.at(4, 0.05), { y: 20 });
  c.cue('chime', c.at(4, 0.05), 0.3);
});

/* ---------------- step 4: becoming a scholar ---------------- */
scene('step4_scholar', (c) => {
  const { tl } = c;
  stepHead(c, 'Becoming a Scholar', { nowrap: true });
  const p = phone(c, 150, 300, 0.78);
  inn(tl, p, 0.2, { y: 60, d: 0.9 });
  const v = p.view(`<div style="position:absolute;inset:0;background:linear-gradient(170deg,#1b4d5c,#0e3440)"></div>
    <div class="conf" style="position:absolute;inset:0;overflow:hidden"></div>
    <div style="position:absolute;left:0;right:0;top:170px;text-align:center;color:#fff;padding:0 30px">
      <div style="width:120px;height:120px;margin:0 auto;border-radius:50%;background:#d4ff00;color:#1b4d5c;display:grid;place-items:center;box-shadow:0 0 50px rgba(212,255,0,.6)">${I('graduation-cap', 64, 2)}</div>
      <div style="font:800 34px/1.15 var(--head);margin-top:28px">Congratulations, ${STUDENT.first}!</div>
      <div style="font:500 17px/1.4 var(--body);opacity:.85;margin-top:12px">You are now an ISKONNECT scholar of the Calapan City Education Department.</div>
      <div class="a-btn lime" style="margin-top:34px">Continue</div></div>`);
  const conf = v.querySelector('.conf'); const r = rng(9); const bits = [];
  for (let i = 0; i < 46; i++) bits.push({ e: add(conf, `<i style="position:absolute;display:block;width:${6 + r() * 6}px;height:${10 + r() * 8}px;border-radius:2px;background:${['#d4ff00', '#4ecdc4', '#ff6b6b', '#ffd54f', '#9b8ec9'][i % 5]}"></i>`), x: r() * 380, s: 120 + r() * 160, d: r() * 1.5, w: r() * 6 });
  const tC = c.at(0, 0);
  c.hook((t) => { const k = t - tC; bits.forEach((b) => { const y = -30 + (k - b.d) * b.s; b.e.style.transform = `translate(${b.x + Math.sin(k * 3 + b.w) * 16}px, ${y}px) rotate(${k * 200 + b.w * 40}deg)`; b.e.style.opacity = k > b.d ? 1 : 0; }); });
  c.cue('chime', tC + 0.1, 0.5); c.cue('shimmer', tC + 0.2, 0.4);
  // status morph
  const st = c.add(`<div class="abs" style="left:760px;top:330px;display:flex;align-items:center;gap:30px">
    <span class="pill ap" style="font-size:30px;padding:18px 30px;background:rgba(255,255,255,.08);color:#b9d3d6;border:1px solid rgba(255,255,255,.18)">APPLICANT</span>
    <span class="ar" style="color:var(--mint)">${I('arrow-right', 48, 2.4)}</span>
    <span class="pill sc" style="font-size:30px;padding:18px 30px;background:var(--lime);color:#0b232a;box-shadow:0 0 50px rgba(212,255,0,.5)">${I('shield-check', 30, 2.4)}ACTIVE SCHOLAR</span></div>`);
  const [ap, ar, sc] = st.children;
  inn(tl, ap, c.at(1, 0), { y: 20 }); inn(tl, ar, c.word(1, 'to active'), { x: -20, y: 0 }); pop(tl, sc, c.word(1, 'active') + 0.1, { s: 0.6 });
  c.cue('pop', c.word(1, 'active') + 0.1, 0.4);
  tl.to(st, { y: -150, scale: 0.72, transformOrigin: 'left top', duration: 0.8, ease: 'power3.inOut' }, c.at(2, 0) - 0.3);
  // digital profile
  const F = [['School', STUDENT.school, 'school'], ['Program', STUDENT.program, 'program'], ['Scholarship', 'CED Scholarship Program', 'scholarship details'], ['Status', '<span class="ast g" style="font-size:13px">Active</span>', 'status'],
    ['Year level', '1st Year', 'academic'], ['Academic year', '2026–2027', 'academic'], ['Scholarship semesters', '0 / 8', 'academic'], ['Enrollment', '<span class="ast g" style="font-size:13px">Verified</span>', 'academic']];
  const prof = c.add(`<div class="abs card" style="left:760px;top:330px;width:1050px;height:520px;padding:30px 36px">
    <div style="display:flex;align-items:center;gap:22px"><span style="width:92px;height:92px;border-radius:24px;background:linear-gradient(135deg,#2d9596,#1b4d5c);display:grid;place-items:center;font:800 34px/1 var(--head)">${STUDENT.ini}</span>
      <div><div style="font:700 36px/1.1 var(--head)">${STUDENT.name}</div><div class="muted" style="font:500 19px/1.3 var(--body);margin-top:6px">Scholar ID ${STUDENT.id} · ${STUDENT.email}</div></div>
      <span class="chip lime" style="margin-left:auto">${I('shield-check', 22)}Active Scholar</span></div>
    <div class="pi" style="display:flex;gap:14px;margin-top:22px">${['Personal information', 'Contact details', 'Barangay Lalud, Calapan City'].map((t) => `<span class="chip sm">${I('user', 16)}${t}</span>`).join('')}</div>
    <div style="font:700 16px/1 var(--head);letter-spacing:.2em;color:var(--mint);margin-top:28px">ACADEMIC &amp; SCHOLARSHIP INFORMATION</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:16px">${F.map(([k, val], i) => `<div class="f f${i}" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px">
      <div class="muted" style="font:600 13px/1 var(--body);letter-spacing:.06em;text-transform:uppercase">${k}</div><div style="font:600 19px/1.25 var(--body);margin-top:9px">${val}</div></div>`).join('')}</div></div>`);
  inn(tl, prof, c.at(2, 0.02), { y: 40 });
  inn(tl, prof.querySelectorAll('.pi .chip'), c.word(2, 'personal'), { y: 10, st: 0.12 });
  F.forEach(([, , w], i) => inn(tl, prof.querySelector('.f' + i), c.word(2, w) - 0.1 + (w === 'academic' ? (i - 4) * 0.15 : 0), { y: 14, d: 0.45 }));
});

/* ---------------- step 5: semester process ---------------- */
scene('step5_semester', (c) => {
  const { tl } = c;
  stepHead(c, 'Semester Process', { nowrap: true });
  const CX = 750, CY = 575, R = 255;
  const N = [['calendar-days', 'Semester<br>Begins'], ['book-open', 'Submit<br>Subjects'], ['chart-line', 'Academic<br>Monitoring'], ['calendar-check', 'Attendance<br>Monitoring'],
    ['file-up', 'Submit / Update<br>Requirements'], ['notebook-pen', 'Grade Encoding<br>by Admin'], ['scan-eye', 'Scholarship<br>Monitoring'], ['repeat', 'Next<br>Semester']];
  const sv = c.svg();
  const ring = wire(sv, `M${CX},${CY - R} A${R},${R} 0 1 1 ${CX - 0.01},${CY - R}`);
  ring.style.strokeWidth = 4;
  draw(tl, ring, c.at(0, 0), 1.6);
  const nodes = N.map(([ic, lb], k) => {
    const a = (-90 + k * 45) * Math.PI / 180, x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
    const n = c.add(`<div class="abs" style="left:${x}px;top:${y}px;width:0;height:0"><div class="nr" style="position:absolute;left:-44px;top:-44px;width:88px;height:88px;border-radius:50%;display:grid;place-items:center;
      background:radial-gradient(circle at 35% 30%,#1d5362,#0f2f38 70%);border:2px solid rgba(78,205,196,.55);color:var(--mint)">${I(ic, 38, 1.8)}</div>
      <div style="position:absolute;width:210px;left:${Math.cos(a) > 0.3 ? 56 : Math.cos(a) < -0.3 ? -266 : -105}px;top:${Math.sin(a) > 0.3 ? 52 : Math.sin(a) < -0.3 ? -100 : -26}px;text-align:${Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center'};font:600 21px/1.2 var(--head)">${lb}</div></div>`);
    pop(tl, n, c.at(0, 0.1) + k * 0.14, { s: 0.5 });
    return n;
  });
  add(nodes[5], `<span class="chip lime sm" style="position:absolute;left:-60px;top:-78px;font-size:14px;padding:6px 10px">${I('lock', 14)}CED only</span>`);
  const center = c.add(`<div class="abs" style="left:${CX}px;top:${CY}px;width:340px;margin-left:-170px;margin-top:-60px;text-align:center">
    <div class="kicker" style="color:var(--muted)">A.Y. 2026–2027</div><div class="sem" style="font:700 44px/1.1 var(--head);margin-top:12px">1st Semester</div></div>`);
  inn(tl, center, c.at(0, 0.3), { y: 10 });
  const sem = center.querySelector('.sem');
  const dot = c.add(`<div class="packet" style="width:26px;height:26px;margin:-13px 0 0 -13px"></div>`);
  const T = [c.at(0, 0.5), c.at(1, 0.1), c.at(2, 0.05), c.word(2, 'attendance'), c.word(2, 'requirements'), c.at(4, 0.0), c.at(5, 0.05), c.word(5, 'next semester')];
  const tLoop = c.end(5) + 0.1;
  // The dot rests on the node being described and glides to the next one
  // when its line starts; after the last node it loops back to the top.
  const angleAt = (t) => {
    let k = -1; for (let i = 0; i < T.length; i++) if (t >= T[i]) k = i;
    if (k <= 0) return { k, a: -90 };
    let a = lerp(-90 + (k - 1) * 45, -90 + k * 45, ease(clamp((t - T[k]) / 0.7)));
    if (k === T.length - 1) a += 45 * ease(clamp((t - T[k] - 0.8) / (tLoop - T[k] - 0.8)));
    return { k, a };
  };
  c.hook((t) => {
    const { k, a } = angleAt(t); const r = a * Math.PI / 180;
    dot.style.left = CX + R * Math.cos(r) + 'px'; dot.style.top = CY + R * Math.sin(r) + 'px';
    dot.style.opacity = t < T[0] ? 0 : 1;
    nodes.forEach((n, i) => { const on = i === k; const nr = n.querySelector('.nr'); nr.style.borderColor = on ? '#d4ff00' : i < k ? '#4ecdc4' : 'rgba(78,205,196,.55)'; nr.style.color = on ? '#d4ff00' : '#4ecdc4'; nr.style.boxShadow = on ? '0 0 0 8px rgba(212,255,0,.1), 0 0 40px rgba(212,255,0,.45)' : 'none'; });
    sem.textContent = t >= tLoop - 0.4 ? '2nd Semester' : '1st Semester';
  });
  for (let i = 1; i < T.length; i++) c.cue('tick', T[i], 0.2);
  // right-hand context cards
  const X = 1250;
  const subj = c.add(`<div class="abs" style="left:${X}px;top:250px;width:580px;border-radius:22px;background:#fff;color:#16323a;padding:22px 24px;box-shadow:0 30px 80px rgba(0,0,0,.45)">
    <div style="display:flex;align-items:center;justify-content:space-between"><b style="font:700 22px/1 var(--head)">My Subjects · 1st Semester</b><span class="st verified">${I('check', 12, 3)}Submitted</span></div>
    ${[['IT 101', 'Introduction to Computing', 3], ['GE 102', 'Purposive Communication', 3], ['MATH 101', 'College Algebra', 3], ['NSTP 1', 'National Service Training', 3], ['PE 1', 'Physical Fitness', 2]]
    .map(([k, n, u]) => `<div style="display:flex;align-items:center;gap:14px;padding:11px 0;border-top:1px solid #edf2f3;margin-top:8px"><span style="width:90px;font:700 15px/1 var(--body);color:#1b4d5c">${k}</span><span style="flex:1;font:500 16px/1.2 var(--body)">${n}</span><span style="font:600 14px/1 var(--body);color:#6b8a91">${u} units</span></div>`).join('')}</div>`);
  inn(tl, subj, c.at(1, 0.05), { x: 40, y: 0 });
  const mon = c.add(`<div class="abs" style="left:${X}px;top:300px;width:580px;display:flex;flex-direction:column;gap:16px">
    ${[['chart-line', 'Academic progress monitored'], ['calendar-check', 'Attendance monitored'], ['file-up', 'Requirements submitted / updated']].map(([ic, t]) => `<span class="chip" style="font-size:24px;padding:16px 24px;align-self:flex-start">${I(ic, 26)}${t}</span>`).join('')}</div>`);
  gsap.set(mon, { autoAlpha: 0 });
  // (monitoring chips sit behind the subjects card; they show after it leaves)
  const cog = c.add(`<div class="abs" style="left:${X}px;top:250px;width:580px;border-radius:22px;background:#fff;color:#16323a;padding:22px 24px;box-shadow:0 30px 80px rgba(0,0,0,.45)">
    <b style="font:700 22px/1 var(--head)">Certificate of Grades</b>
    <div style="display:flex;align-items:center;gap:14px;margin-top:16px;padding:14px;border-radius:14px;background:#f3f7f8"><span style="color:#d44848">${I('file-text', 30)}</span><div style="flex:1"><div style="font:600 16px/1.2 var(--body)">COG_1st_Sem_2026-2027.pdf</div><div style="font:500 13px/1.3 var(--body);color:#6b8a91">Uploaded by scholar</div></div><span class="st verified">${I('check', 12, 3)}Uploaded</span></div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:14px;padding:14px;border-radius:14px;background:#fff4de;color:#9a5b0c;font:600 16px/1.3 var(--body)">${I('lock', 22)}Scholars cannot encode their own grades</div></div>`);
  const enc = admPanel(c, X, 470, 580, 'Encode Grade · Academic Records', 'notebook-pen');
  enc.body.innerHTML = `<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px">${[['Subject', 'IT 101 · Intro to Computing'], ['Grade', '<span class="gv"></span>'], ['Remarks', 'Passed']].map(([k, v]) =>
    `<div><div style="font:600 12px/1 var(--body);color:#7fa2a8;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">${k}</div><div style="height:46px;border-radius:10px;background:#13292f;border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;padding:0 12px;font:600 16px/1 var(--body)">${v}</div></div>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:16px"><span class="ast g" style="font-size:12px">Encoded by CED Admin</span><span style="margin-left:auto;padding:12px 20px;border-radius:10px;background:#2d9596;font:700 15px/1 var(--body)">Save Grade</span></div>`;
  inn(tl, cog, c.at(3, 0.02), { x: 40, y: 0 });
  inn(tl, enc, c.at(4, 0), { x: 40, y: 0 });
  typeText(c, enc.querySelector('.gv'), '1.50', c.at(4, 0.3), 0.4);
  c.cue('tap', c.end(4) - 0.1, 0.3);
  out(tl, [cog, enc], c.at(5, 0) - 0.2, { x: 30, y: 0, st: 0.08 });
  const stand = c.add(`<div class="abs" style="left:${X}px;top:330px;width:580px">
    <div class="card" style="padding:26px 28px;display:flex;align-items:center;gap:20px"><span style="width:70px;height:70px;border-radius:20px;background:rgba(212,255,0,.12);border:1px solid rgba(212,255,0,.4);color:var(--lime);display:grid;place-items:center">${I('scan-eye', 36)}</span>
      <div><div style="font:700 26px/1.2 var(--head)">Scholarship standing reviewed</div><div class="muted" style="font:500 18px/1.4 var(--body);margin-top:4px">Monitored by CED each semester</div></div></div>
    <div class="chip lime" style="margin-top:22px;font-size:22px">${I('repeat', 24)}Continues into the next semester</div></div>`);
  inn(tl, stand, c.at(5, 0.05), { x: 40, y: 0 });
  // monitoring chips appear in the gap between subjects and COG
  tl.fromTo(mon, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, c.at(2, 0));
  inn(tl, mon.children, c.at(2, 0), { x: 30, y: 0, st: 0.6, ir: false });
  out(tl, mon, c.at(3, 0) - 0.3, { x: 30, y: 0 });
  tl.to(subj, { autoAlpha: 0, duration: 0.3 }, c.at(2, 0) - 0.3);
});

/* ---------------- step 6: QR attendance ---------------- */
scene('step6_qr', (c) => {
  const { tl } = c;
  stepHead(c, 'QR Attendance', { nowrap: true });
  // pipeline row
  const P = [['qr-code', 'Student QR'], ['scan-line', 'QR Scanner'], ['clipboard-check', 'Attendance<br>Record'], ['hard-drive', 'Local Storage<br>&amp; Sync'], ['monitor', 'Admin<br>Dashboard']];
  const PXs = (i) => 960 + (i - 2) * 330;
  const sv = c.svg();
  const pn = P.map(([ic, lb], i) => flowNode(c, PXs(i), 720, ic, lb, { sm: true }));
  const pw = P.slice(1).map((_, i) => wire(sv, `M${PXs(i) + 58},766 L${PXs(i + 1) - 58},766`));
  inn(tl, pn, c.at(0, 0.1), { y: 20, st: 0.1 });
  pw.forEach((w, i) => draw(tl, w, c.at(0, 0.3) + i * 0.1, 0.5));
  const lit = (i, t) => tl.to(pn[i].querySelector('.ring'), { borderColor: '#d4ff00', color: '#d4ff00', boxShadow: '0 0 0 8px rgba(212,255,0,.1), 0 0 40px rgba(212,255,0,.4)', duration: 0.4 }, t);
  // scholar ID phone
  const pa = phone(c, 650, 110, 0.7);
  const va = pa.view(`<div class="app-hd" style="padding-bottom:18px"><div class="t" style="font-size:22px">Scholar QR Code</div><div class="s">Your unique identification</div></div>
    <div class="app-body"><div style="border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 8px 26px rgba(20,60,70,.15)">
      <div style="background:linear-gradient(90deg,#1b4d5c,#2d9596);color:#fff;padding:12px 16px;display:flex;justify-content:space-between;align-items:center"><b style="font:800 16px/1 var(--head);letter-spacing:.08em">SCHOLARSHIP ID</b><span style="color:#d4ff00">${I('graduation-cap', 22)}</span></div>
      <div style="display:flex;gap:12px;padding:14px"><span style="width:84px;height:100px;border-radius:12px;background:linear-gradient(135deg,#2d9596,#1b4d5c);display:grid;place-items:center;color:#fff;font:800 28px/1 var(--head)">${STUDENT.ini}</span>
        <div style="flex:1"><div style="font:800 17px/1.1 var(--head)">${STUDENT.name.toUpperCase()}</div><div class="a-s">${STUDENT.id}</div><div class="a-s">${STUDENT.school}</div><div class="a-s">${STUDENT.program}</div></div></div>
      <div style="padding:0 60px 18px">${qrGrid(21)}</div></div>
      <div class="a-btn" style="margin-top:6px">${I('download', 18)}&nbsp; Download Scholarship ID</div></div>`);
  inn(tl, pa, c.at(1, 0) - 0.3, { x: -40, y: 0, d: 0.8 });
  lit(0, c.at(1, 0));
  // scanner phone
  const pb = phone(c, 1250, 110, 0.7);
  const vb = pb.view(`<div style="position:absolute;inset:0;background:#0b1316"></div>
    <div style="position:absolute;left:0;right:0;top:62px;text-align:center;color:#fff;font:700 18px/1 var(--head)">ISKONNECT Scanner</div>
    <div class="stat" style="position:absolute;left:50%;top:94px;transform:translateX(-50%);padding:6px 12px;border-radius:999px;font:700 13px/1 var(--body);background:#e3f7ec;color:#13925b">Online</div>
    <div style="position:absolute;left:50px;top:190px;width:274px;height:274px">
      <div style="position:absolute;inset:36px;opacity:.9">${qrGrid(21)}</div>
      ${[[0, 0, 'top left'], [1, 0, 'top right'], [0, 1, 'bottom left'], [1, 1, 'bottom right']].map(([x, y]) => `<i style="position:absolute;${x ? 'right' : 'left'}:0;${y ? 'bottom' : 'top'}:0;width:50px;height:50px;border:5px solid #d4ff00;border-${x ? 'left' : 'right'}:0;border-${y ? 'top' : 'bottom'}:0;border-radius:${y ? (x ? '0 0 14px 0' : '0 0 0 14px') : (x ? '0 14px 0 0' : '14px 0 0 0')}"></i>`).join('')}
      <div class="scan" style="position:absolute;left:14px;right:14px;height:4px;border-radius:4px;background:#d4ff00;box-shadow:0 0 20px #d4ff00"></div></div>
    <div class="res" style="position:absolute;left:18px;right:18px;bottom:40px;border-radius:20px;background:#fff;color:#16323a;padding:16px;display:flex;gap:12px;align-items:center">
      <span style="width:52px;height:52px;border-radius:50%;background:#dcf7ea;color:#13925b;display:grid;place-items:center">${I('check', 30, 3)}</span>
      <div><div style="font:800 17px/1.2 var(--head)">Attendance recorded</div><div class="a-s" style="margin-top:2px">${STUDENT.name} · General Assembly · 8:02 AM</div></div></div>
    <div class="pend" style="position:absolute;left:50%;top:494px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:#1c2a2f;color:#cfe3e5;font:600 14px/1 var(--body);white-space:nowrap"></div>`);
  inn(tl, pb, c.at(2, 0) - 0.3, { x: 40, y: 0, d: 0.8 });
  lit(1, c.word(2, 'scan'));
  const scanL = vb.querySelector('.scan'), res = vb.querySelector('.res'), stat = vb.querySelector('.stat'), pend = vb.querySelector('.pend');
  const tScan = c.at(3, 0) - 0.2;
  gsap.set(res, { autoAlpha: 0 });
  tl.fromTo(res, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.5)' }, tScan);
  c.cue('beep', tScan, 0.55);
  lit(2, tScan);
  const sv2 = c.svg(); const beam = wire(sv2, 'M930,380 L1250,380', 'lime dash');
  tl.fromTo(beam, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, c.word(2, 'scan'));
  tl.to(beam, { autoAlpha: 0, duration: 0.3 }, tScan + 0.4);
  const tOff = c.at(4, 0), tSync = c.word(4, 'synchronized');
  c.hook((t) => {
    scanL.style.top = (20 + (0.5 + 0.5 * Math.sin(t * 3.2)) * 230) + 'px';
    scanL.style.opacity = t < tScan ? 1 : 0;
    const offline = t >= tOff - 0.1 && t < tSync;
    stat.textContent = offline ? 'Offline · saved locally' : t >= tSync && t < tSync + 1.5 ? 'Syncing…' : t >= tSync ? 'Online · synced' : 'Online';
    stat.style.background = offline ? '#ffe9e9' : '#e3f7ec'; stat.style.color = offline ? '#d44848' : '#13925b';
    pend.textContent = t < tOff ? '' : t < tSync + 1.2 ? 'Pending sync: 1 record' : 'All records synced ✓';
    pend.style.opacity = t < tOff ? 0 : 1;
  });
  lit(3, tOff);
  const off = c.add(`<div class="abs chip coral" style="left:1570px;top:260px">${I('wifi-off', 22)}No internet</div>`);
  const on = c.add(`<div class="abs chip lime" style="left:1570px;top:330px">${I('refresh-cw', 22)}Back online · synced</div>`);
  pop(tl, off, tOff, { s: 0.6 }); pop(tl, on, tSync, { s: 0.6 });
  c.cue('pop', tSync, 0.3);
  const tAd = c.at(5, 0);
  lit(4, tAd);
  packet(c, pw[3], tAd - 0.4, 0.8); packet(c, pw[2], tSync + 0.2, 0.8);
  c.cue('chime', tAd + 0.2, 0.3);
});
