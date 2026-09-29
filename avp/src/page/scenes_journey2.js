/* Section 6 (part 2): steps 7–12. */

/* ---------------- step 7: attendance alert ---------------- */
scene('step7_alert', (c) => {
  const { tl } = c;
  stepHead(c, 'Attendance Alert', { nowrap: true });
  const card = c.add(`<div class="abs card" style="left:110px;top:310px;width:700px;padding:26px 30px">
    <div style="display:flex;align-items:center;justify-content:space-between"><b style="font:700 26px/1 var(--head)">Attendance · 1st Semester</b><span class="muted" style="font:600 16px/1 var(--body)">${STUDENT.name}</span></div>
    ${[["Scholars' Orientation", 'Present', 'g'], ['General Assembly', 'Absent', 'r'], ['Community Outreach', 'Absent', 'r']].map(([e, s, cl], i) => `<div class="ar ar${i}" style="display:flex;align-items:center;gap:14px;padding:15px 0;border-top:1px solid rgba(255,255,255,.07);margin-top:${i ? 0 : 16}px">
      <span style="color:${cl === 'g' ? '#34d399' : '#ff8b8b'}">${I(cl === 'g' ? 'circle-check' : 'x', 26, 2.2)}</span><span style="flex:1;font:600 21px/1.2 var(--body)">${e}</span><span class="ast ${cl}" style="font-size:13px">${s}</span></div>`).join('')}
    <div style="display:flex;align-items:center;gap:18px;margin-top:18px;padding:16px 18px;border-radius:16px;background:rgba(244,162,97,.1);border:1px solid rgba(244,162,97,.35)">
      <span style="font:800 54px/1 var(--head);color:#f4a261" class="abs-n">0</span><div><div style="font:700 20px/1.2 var(--head)">Absences</div><div class="muted" style="font:500 16px/1.3 var(--body)">Alert is raised at 2 absences</div></div></div></div>`);
  inn(tl, card, c.at(0, 0), { y: 30 });
  const rowsA = card.querySelectorAll('.ar');
  const tR = [c.at(0, 0.3), c.at(0, 0.7), c.word(1, 'reaches')];
  rowsA.forEach((r, i) => inn(tl, r, tR[i], { x: -20, y: 0, d: 0.5 }));
  const n = card.querySelector('.abs-n');
  c.hook((t) => { n.textContent = t >= tR[2] + 0.2 ? 2 : t >= tR[1] + 0.2 ? 1 : 0; });
  // admin alert
  const adm = admPanel(c, 900, 310, 910, 'Alerts & Notifications · Dashboard', 'bell');
  adm.body.innerHTML = `<div class="al" style="display:flex;align-items:center;gap:16px;padding:18px;border-radius:14px;background:rgba(244,162,97,.12);border:1px solid rgba(244,162,97,.45)">
      <span style="width:54px;height:54px;border-radius:14px;background:rgba(244,162,97,.2);color:#f4a261;display:grid;place-items:center">${I('triangle-alert', 30)}</span>
      <div style="flex:1"><div style="font:700 21px/1.2 var(--head)">At-Risk Scholar · Attendance</div><div style="font:500 16px/1.4 var(--body);color:#cfe3e5;margin-top:4px">${STUDENT.name} has reached <b style="color:#f4a261">2 absences</b>. Review needed.</div></div>
      <span class="ast y" style="font-size:12px">Flagged</span></div>
    <div style="display:flex;gap:12px;margin-top:14px;color:#7fa2a8;font:500 15px/1.4 var(--body)">${I('info', 18)}Flags are for review. The scholar's status is changed only by an administrator.</div>`;
  inn(tl, adm, c.word(1, 'flags') - 0.5, { x: 40, y: 0 });
  const al = adm.body.querySelector('.al');
  tl.fromTo(al, { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.6)' }, c.word(1, 'flags'));
  c.cue('alert', c.word(1, 'flags'), 0.4);
  // alert → review → decision
  const F = [['triangle-alert', 'Attendance<br>Alert'], ['user-search', 'Admin<br>Review'], ['scale', 'Administrative<br>Decision']];
  const X = (i) => 1090 + i * 290;
  const sv = c.svg();
  const nodes = F.map(([ic, lb], i) => flowNode(c, X(i), 610, ic, lb, { sm: true }));
  const ws = [wire(sv, `M${X(0) + 58},656 L${X(1) - 58},656`), wire(sv, `M${X(1) + 58},656 L${X(2) - 58},656`)];
  gsap.set(nodes, { autoAlpha: 0 });
  inn(tl, nodes[0], c.word(1, 'alerts'), { y: 20, ir: false });
  tl.to(nodes[0].querySelector('.ring'), { borderColor: '#f4a261', color: '#f4a261', duration: 0.4 }, c.word(1, 'alerts'));
  const auto = c.add(`<div class="abs chip lime" style="left:110px;top:${310 + 470}px;font-size:22px;padding:14px 22px">${I('shield-check', 24)}No automatic termination. CED reviews every case.</div>`);
  inn(tl, auto, c.at(2, 0.1), { y: 20 });
  inn(tl, nodes[1], c.word(3, 'reviews') - 0.2, { y: 20, ir: false }); draw(tl, ws[0], c.word(3, 'reviews') - 0.3, 0.4);
  inn(tl, nodes[2], c.word(3, 'decides') - 0.2, { y: 20, ir: false }); draw(tl, ws[1], c.word(3, 'decides') - 0.3, 0.4);
  tl.to(nodes[2].querySelector('.ring'), { borderColor: '#d4ff00', color: '#d4ff00', boxShadow: '0 0 0 8px rgba(212,255,0,.1), 0 0 40px rgba(212,255,0,.4)', duration: 0.4 }, c.word(3, 'circumstances'));
  const circ = c.add(`<div class="abs chip" style="left:${X(2)}px;top:850px;font-size:19px">${I('scale', 20)}Based on the scholar's circumstances</div>`);
  gsap.set(circ, { xPercent: -50 });
  inn(tl, circ, c.word(3, 'circumstances'), { y: 14 });
});

/* ---------------- step 8: requirements & documents ---------------- */
scene('step8_req', (c) => {
  const { tl } = c;
  stepHead(c, 'Requirements &amp; Documents', { nowrap: true });
  const p = phone(c, 110, 290, 0.76);
  const reqs = [['Certificate of Registration (COR)', 'verified', 'Verified'], ['Certificate of Grades (COG)', 'submitted', 'Submitted'], ['2x2 ID Picture', 'pending', 'Pending'], ['Barangay Residency Cert.', 'pending', 'Pending']];
  const v = p.view(`<div class="app-hd" style="padding-bottom:18px"><div class="t">Requirements</div><div class="s">1st Semester · A.Y. 2026–2027</div></div>
    <div class="app-body">${reqs.map(([n, cl, st], i) => `<div class="a-card rq${i}" style="padding:14px"><div class="a-row" style="justify-content:space-between"><span class="a-row" style="gap:10px"><span style="color:#1b4d5c">${I('file-text', 22)}</span><span class="a-t" style="font-size:15px">${n}</span></span></div>
      <div class="a-row" style="justify-content:space-between;margin-top:10px"><span class="st ${cl} s${i}">${st}</span><span class="up${i}" style="font:700 13px/1 var(--body);color:#1b4d5c">${I('upload', 14, 2.4)} Upload</span></div><div class="rm${i}" style="display:none"></div></div>`).join('')}</div>${bnav(1)}`);
  inn(tl, p, c.at(0, 0) - 0.2, { y: 60, d: 0.9 });
  // status pipeline
  const S = [['clock', 'Pending', '#93b4b9'], ['upload', 'Submitted', '#5fb3f9'], ['circle-check', 'Verified', '#34d399']];
  const SX = (i) => 560 + i * 250;
  const sv = c.svg();
  const pills = S.map(([ic, t, col], i) => c.add(`<div class="abs" style="left:${SX(i)}px;top:340px;width:210px;height:92px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:12px;
      background:rgba(255,255,255,.05);border:2px solid ${col};color:${col};font:700 25px/1 var(--head)">${I(ic, 28, 2.2)}${t}</div>`));
  const pw = [wire(sv, `M${SX(0) + 214},386 L${SX(1) - 4},386`), wire(sv, `M${SX(1) + 214},386 L${SX(2) - 4},386`)];
  const rej = c.add(`<div class="abs" style="left:${SX(1) - 20}px;top:560px;width:250px;height:92px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
      background:rgba(255,107,107,.08);border:2px solid #ff6b6b;color:#ff8b8b"><span style="display:flex;align-items:center;gap:10px;font:700 25px/1 var(--head)">${I('x', 26, 2.4)}Rejected</span><span style="font:500 15px/1 var(--body);color:#ffb3b3">returned with remarks</span></div>`);
  const rw1 = wire(sv, `M${SX(1) + 70},432 L${SX(1) + 70},560`, 'dash'), rw2 = wire(sv, `M${SX(1) + 140},560 L${SX(1) + 140},432`, 'dash');
  rw1.style.stroke = 'rgba(255,107,107,.7)'; rw2.style.stroke = 'rgba(95,179,249,.8)';
  const rs = c.add(`<div class="abs" style="left:${SX(1) + 152}px;top:480px;font:600 16px/1 var(--body);color:#9fd0ff">resubmit</div>`);
  const tP = c.at(2, 0);
  inn(tl, pills[0], c.word(2, 'pending') - 0.2, { y: 20 }); draw(tl, pw[0], c.word(2, 'submitted') - 0.4, 0.4);
  inn(tl, pills[1], c.word(2, 'submitted') - 0.2, { y: 20 }); draw(tl, pw[1], c.word(2, 'verified') - 0.4, 0.4);
  inn(tl, pills[2], c.word(2, 'verified') - 0.2, { y: 20 });
  const doc = c.add(`<div class="abs" style="left:0;top:0;width:54px;height:66px;border-radius:8px;background:#f4f1ea;color:#1b4d5c;display:grid;place-items:center;box-shadow:0 10px 24px rgba(0,0,0,.4)">${I('file-text', 30)}</div>`);
  c.hook((t) => {
    const a = c.word(2, 'pending'), b = c.word(2, 'submitted'), d = c.word(2, 'verified');
    const xs = [SX(0) + 78, SX(1) + 78, SX(2) + 78];
    let x = xs[0]; if (t > b) x = lerp(xs[0], xs[1], ease(clamp((t - b) / 0.6))); if (t > d) x = lerp(xs[1], xs[2], ease(clamp((t - d) / 0.6)));
    doc.style.left = x + 'px'; doc.style.top = '240px'; doc.style.opacity = t < a ? 0 : t > c.at(3, 0) ? 0 : 1;
  });
  // phone statuses follow the pipeline
  c.hook((t) => {
    const set = (i, cl, txt) => { const e = v.querySelector('.s' + i); e.className = 'st ' + cl + ' s' + i; e.textContent = txt; };
    if (t >= c.word(1, 'upload')) set(2, 'submitted', 'Submitted');
    if (t >= c.word(2, 'verified') + 0.4) { set(1, 'verified', 'Verified'); set(2, 'verified', 'Verified'); }
    if (t >= c.word(3, 'return') + 0.2) set(3, 'rejected', 'Rejected'); else if (t >= c.word(1, 'upload') + 0.8) set(3, 'submitted', 'Submitted');
    const rm = v.querySelector('.rm3'); const show = t >= c.word(3, 'remarks') + 0.3;
    rm.style.display = show ? 'block' : 'none';
    rm.innerHTML = `<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#ffe9e9;color:#b53b3b;font:500 13px/1.35 var(--body)">${I('message-square', 14)} Remarks: Please upload a clearer copy.</div>`;
  });
  tapAt(c, v, 300, 330, c.word(1, 'upload'));
  // admin review
  const adm = admPanel(c, 1330, 250, 490, 'Requirements Review', 'file-check');
  adm.body.innerHTML = `<div style="font:600 15px/1.3 var(--body);color:#cfe3e5">${STUDENT.name}</div><div style="font:500 13px/1.3 var(--body);color:#7fa2a8">Barangay Residency Certificate</div>
    <div style="margin-top:12px;height:210px;border-radius:12px;background:#f4f1ea;padding:22px 24px;filter:blur(1.2px)">${'<i style="display:block;height:8px;border-radius:4px;background:#cbd3d1;margin-bottom:12px"></i>'.repeat(9)}</div>
    <div class="rmk" style="margin-top:14px;height:48px;border-radius:10px;background:#13292f;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;padding:0 14px;font:500 15px/1 var(--body);color:#e3eff0"><span class="ph" style="color:#6f9197">Remarks…</span><span class="rt"></span></div>
    <div style="display:flex;gap:12px;margin-top:14px"><span class="vb" style="flex:1;text-align:center;padding:14px;border-radius:10px;background:#1f8a5c;font:700 16px/1 var(--body)">${I('check', 16, 3)} Verify</span><span class="rb" style="flex:1;text-align:center;padding:14px;border-radius:10px;background:#b83b3b;font:700 16px/1 var(--body)">${I('x', 16, 3)} Reject</span></div>`;
  inn(tl, adm, c.word(2, 'administrator') - 0.6, { x: 40, y: 0 });
  typeText(c, adm.body.querySelector('.rt'), 'Please upload a clearer copy.', c.word(3, 'remarks') - 0.6, 1.1);
  c.hook((t) => { adm.body.querySelector('.ph').style.display = t >= c.word(3, 'remarks') - 0.6 ? 'none' : ''; });
  tl.fromTo(adm.body.querySelector('.vb'), { boxShadow: '0 0 0 0 rgba(52,211,153,0)' }, { boxShadow: '0 0 0 6px rgba(52,211,153,.35)', duration: 0.3, yoyo: true, repeat: 1 }, c.word(2, 'verified'));
  tl.fromTo(adm.body.querySelector('.rb'), { boxShadow: '0 0 0 0 rgba(255,107,107,0)' }, { boxShadow: '0 0 0 6px rgba(255,107,107,.4)', duration: 0.3, yoyo: true, repeat: 1 }, c.word(3, 'return'));
  c.cue('chime', c.word(2, 'verified') + 0.3, 0.3); c.cue('tap', c.word(3, 'return'), 0.3);
  inn(tl, [rej, rs], c.word(3, 'return') - 0.1, { y: 20 });
  draw(tl, rw1, c.word(3, 'return') - 0.1, 0.4); draw(tl, rw2, c.word(3, 'fix') - 0.3, 0.4);
});

/* ---------------- step 9: announcements & communication ---------------- */
scene('step9_comm', (c) => {
  const { tl } = c;
  stepHead(c, 'Announcements &amp; Communication', { nowrap: true });
  const adm = admPanel(c, 110, 310, 760, 'Announcements · New Post', 'megaphone');
  adm.body.innerHTML = `<div style="font:600 12px/1 var(--body);color:#7fa2a8;letter-spacing:.06em;text-transform:uppercase">Title</div>
    <div style="margin-top:8px;height:52px;border-radius:10px;background:#13292f;border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;padding:0 14px;font:600 19px/1 var(--body)"><span class="tt"></span></div>
    <div style="display:flex;gap:10px;margin-top:14px">${['Announcement', 'Schedule', 'Reminder', 'Scholarship Update'].map((t, i) => `<span class="ast ${i ? 'n' : 'b'}" style="font-size:12px;padding:7px 11px">${t}</span>`).join('')}</div>
    <div style="margin-top:14px;padding:14px;border-radius:10px;background:#13292f;border:1px solid rgba(255,255,255,.12);font:500 16px/1.5 var(--body);color:#cfe3e5;min-height:96px"><span class="bd"></span></div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:16px"><span style="font:500 14px/1 var(--body);color:#7fa2a8">${I('users', 16)} Audience: All scholars</span><span class="post" style="margin-left:auto;padding:14px 22px;border-radius:10px;background:#2d9596;font:700 16px/1 var(--body)">${I('send', 16)} Post Announcement</span></div>`;
  inn(tl, adm, c.at(0, 0.1), { x: -40, y: 0 });
  const tT = c.at(1, 0);
  typeText(c, adm.body.querySelector('.tt'), 'General Assembly on Oct 24', tT, 1.3);
  typeText(c, adm.body.querySelector('.bd'), 'All scholars are required to attend the General Assembly on Saturday, Oct 24, 8:00 AM.', tT + 1.0, 1.8, false);
  const post = adm.body.querySelector('.post');
  const tPost = c.end(1) + 0.1;
  tl.fromTo(post, { scale: 1 }, { scale: 0.92, duration: 0.12, yoyo: true, repeat: 1 }, tPost);
  c.cue('tap', tPost, 0.4);
  const p = phone(c, 1330, 150, 0.84);
  inn(tl, p, c.at(0, 0.2), { x: 40, y: 0, d: 0.8 });
  const lock = p.view(`<div style="position:absolute;inset:0;background:linear-gradient(170deg,#1b4d5c,#0b2730 60%,#061a20)"></div>
    <div style="position:absolute;left:0;right:0;top:130px;text-align:center;color:#fff"><div style="font:500 18px/1 var(--body);opacity:.85">Thursday, October 15</div><div style="font:300 92px/1.1 var(--head);margin-top:6px">9:41</div></div>
    <div class="ln" style="position:absolute;left:14px;right:14px;top:330px;border-radius:22px;padding:14px 16px;background:rgba(255,255,255,.92);display:flex;gap:12px;color:#16323a">
      <span style="width:42px;height:42px;border-radius:11px;background:#1b4d5c;color:#d4ff00;display:grid;place-items:center;flex:none">${I('graduation-cap', 22)}</span>
      <div><div style="display:flex;justify-content:space-between"><b style="font:700 14px/1.2 var(--body)">ISKONNECT</b><span style="font:500 12px/1 var(--body);color:#6b8a91">now</span></div>
      <div style="font:700 15px/1.3 var(--body);margin-top:2px">General Assembly on Oct 24</div><div style="font:500 13px/1.35 var(--body);color:#40606a">All scholars are required to attend…</div></div></div>`);
  const ln = lock.querySelector('.ln');
  const tN = c.word(2, 'notification') - 0.3;
  tl.fromTo(ln, { y: -60, autoAlpha: 0, scale: 0.95 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(1.5)' }, tN);
  c.cue('ding', tN + 0.05, 0.55);
  const sv = c.svg(); const w = wire(sv, curve(870, 600, 1330, 480), 'lime dash');
  tl.fromTo(w, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, tPost);
  packet(c, w, tPost + 0.1, 0.9); packet(c, w, tPost + 0.35, 0.9);
  const chipClosed = c.add(`<div class="abs chip" style="left:1330px;top:870px;font-size:19px">${I('bell-ring', 20)}Delivered even when the app is closed</div>`);
  inn(tl, chipClosed, tN + 0.3, { y: 14 });
  out(tl, chipClosed, c.at(3, 0), { y: 10 });
  // announcements list
  const list = p.view(`<div class="app-hd" style="padding-bottom:18px"><div class="t">Announcements</div><div class="s">From the City Education Department</div></div>
    <div class="app-body">${[['Announcement', '#e3f7f5', '#138f86', 'megaphone', 'General Assembly on Oct 24', 'Just now'], ['Schedule', '#e3f0ff', '#2f6fc0', 'calendar-days', 'COR submission: Oct 16–30', 'Today'],
    ['Reminder', '#fff1dc', '#c77818', 'bell', 'Upload your Certificate of Grades', 'Yesterday'], ['Scholarship Update', '#f3fbd1', '#6c8a00', 'shield-check', 'Your status: Active Scholar', 'Oct 12']].map(([tg, bg, col, ic, t, d], i) =>
    `<div class="a-card an${i}"><div class="a-row" style="justify-content:space-between"><span class="st" style="background:${bg};color:${col}">${I(ic, 12, 2.6)}${tg}</span><span class="a-s" style="margin:0">${d}</span></div><div class="a-t" style="margin-top:10px">${t}</div></div>`).join('')}</div>${bnav(3)}`);
  gsap.set(list, { autoAlpha: 0 });
  const tList = c.at(3, 0) - 0.3;
  swap(tl, lock, list, tList);
  inn(tl, [0, 1, 2, 3].map((i) => list.querySelector('.an' + i)), tList + 0.4, { y: 20, st: 0.35 });
  // chat
  const chat = p.view(`<div class="app-hd" style="padding-bottom:18px"><div class="t">Messages</div><div class="s">CED Scholarship Office</div></div>
    <div class="app-body" style="gap:14px">
      <div class="b1" style="align-self:flex-end;max-width:78%;padding:12px 14px;border-radius:18px 18px 4px 18px;background:#1b4d5c;color:#fff;font:500 15px/1.4 var(--body)">Good day! Where can I submit my COR for this semester?</div>
      <div class="b2" style="align-self:flex-start;max-width:78%;padding:12px 14px;border-radius:18px 18px 18px 4px;background:#fff;border:1px solid #e1eaec;font:500 15px/1.4 var(--body)">Hi ${STUDENT.first}! Please upload it in the app under Requirements. 😊<div class="a-s" style="margin-top:6px">CED Admin</div></div></div>
    <div style="position:absolute;left:14px;right:14px;bottom:22px;height:54px;border-radius:18px;background:#fff;border:1px solid #dfe8ea;display:flex;align-items:center;padding:0 16px;color:#9ab2b7;font:500 15px/1 var(--body)">Type a message…<span style="margin-left:auto;color:#1b4d5c">${I('send', 20)}</span></div>`);
  gsap.set(chat, { autoAlpha: 0 });
  const tChat = c.word(3, 'message') - 0.4;
  swap(tl, list, chat, tChat);
  inn(tl, chat.querySelector('.b1'), tChat + 0.4, { y: 16 }); inn(tl, chat.querySelector('.b2'), tChat + 1.4, { y: 16 });
  c.cue('pop', tChat + 0.45, 0.3); c.cue('pop', tChat + 1.45, 0.3);
});

/* ---------------- step 10: reports & monitoring ---------------- */
scene('step10_reports', (c) => {
  const { tl } = c;
  stepHead(c, 'Reports &amp; Monitoring', { nowrap: true });
  const lap = laptop(c, 110, 300, 0.86);
  const main = adminShell(lap.win, 'Dashboard', 'Dashboard', 'CED City Education Department — Scholarship Management Overview');
  const K = [['users', 'Total Scholars', 248, '#2d9596'], ['user-check', 'Active Scholars', 231, '#34d399'], ['file-text', 'Pending Applications', 96, '#f4a261'], ['graduation-cap', 'Graduated', 42, '#9b8ec9']];
  add(main, `<div class="kpis">${K.map(([ic, k, v, col]) => `<div class="kpi" style="border-top-color:${col}"><span style="color:${col}">${I(ic, 20)}</span><div class="v" data-v="${v}">0</div><div class="k">${k}</div></div>`).join('')}</div>`);
  const schools = ['Divine Word College', 'Luna Goco Colleges', 'South Colleges', 'St. Mark College', 'St. Anthony College', 'ACLC College', 'St. Augustine Academy'];
  const vals = [52, 47, 38, 34, 29, 26, 22];
  add(main, `<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-top:12px">
    <div class="pnl"><h4>Scholars per School</h4>${schools.map((s, i) => `<div style="display:flex;align-items:center;gap:10px;margin:8px 0"><span style="width:150px;font:500 12px/1 var(--body);color:#a9c2c6">${s}</span><span style="flex:1;height:14px;border-radius:6px;background:rgba(255,255,255,.06)"><span class="hb" data-w="${vals[i] / 55 * 100}" style="display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#2d9596,#4ecdc4)"></span></span><span style="width:26px;font:600 12px/1 var(--body)">${vals[i]}</span></div>`).join('')}</div>
    <div class="pnl"><h4>Scholar Status</h4><svg viewBox="0 0 200 200" width="170" height="170" style="display:block;margin:6px auto">${[[0.72, '#34d399'], [0.12, '#f4a261'], [0.11, '#9b8ec9'], [0.05, '#ff6b6b']].map(([f, col], i, a) => { const off = a.slice(0, i).reduce((s, x) => s + x[0], 0); return `<circle class="dn" cx="100" cy="100" r="70" fill="none" stroke="${col}" stroke-width="26" stroke-dasharray="${f * 439.8} 439.8" stroke-dashoffset="${-off * 439.8}" transform="rotate(-90 100 100)"/>`; }).join('')}</svg>
      <div style="display:flex;flex-wrap:wrap;gap:8px 14px;font:500 11.5px/1 var(--body);color:#a9c2c6;justify-content:center">${[['#34d399', 'Active'], ['#f4a261', 'For Evaluation'], ['#9b8ec9', 'Graduated'], ['#ff6b6b', 'Terminated']].map(([col, t]) => `<span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${col};margin-right:5px"></i>${t}</span>`).join('')}</div></div></div>`);
  add(lap.win, `<div class="real-tag" style="background:rgba(0,0,0,.55)">${I('info', 14)}Illustrative data</div>`);
  inn(tl, lap, c.at(0, 0) - 0.3, { y: 40, d: 0.9 });
  main.querySelectorAll('.kpi .v').forEach((e) => countUp(c, e, 0, +e.dataset.v, c.at(0, 0.3), 1.6));
  main.querySelectorAll('.hb').forEach((e, i) => tl.to(e, { width: e.dataset.w + '%', duration: 0.9, ease: 'power2.out' }, c.word(1, 'school') - 0.2 + i * 0.08));
  const dn = main.querySelectorAll('.dn'); gsap.set(dn, { opacity: 0 });
  tl.to(dn, { opacity: 1, duration: 0.4, stagger: 0.15 }, c.word(1, 'status') - 0.2);
  // what's organized
  const F = [['users', 'Scholar records', 'scholar'], ['user-plus', 'Applicant records', 'applicant'], ['book-open', 'Academic information', 'academic'], ['calendar-check', 'Attendance', 'attendance'],
    ['file-check', 'Requirements', 'requirements'], ['shield-check', 'Scholarship status', 'scholarship status'], ['school', 'By school & category', 'school']];
  const chips = F.map(([ic, t, w], i) => {
    const e = c.add(`<div class="abs chip" style="left:1180px;top:${300 + i * 72}px;font-size:22px;padding:12px 20px">${I(ic, 24)}${t}</div>`);
    inn(tl, e, c.word(1, w) - 0.2, { x: 30, y: 0, d: 0.45 }); return e;
  });
  out(tl, chips, c.at(2, 0.25), { x: 30, y: 0, st: 0.04 });
  // report generation
  const rep = c.add(`<div class="abs" style="left:1240px;top:270px;width:520px;border-radius:14px;background:#fbfbf8;color:#1d3439;padding:26px 28px;box-shadow:0 30px 80px rgba(0,0,0,.5)">
    <div style="display:flex;align-items:center;gap:10px"><img src="${ASSET}img/ced_seal.png" style="width:44px"><div><div style="font:700 12px/1.2 var(--body);letter-spacing:.08em;color:#1f7a4a">CITY EDUCATION DEPARTMENT</div><div style="font:500 11px/1.2 var(--body);color:#6b8a91">Calapan City, Oriental Mindoro</div></div></div>
    <div style="font:800 22px/1.2 var(--head);margin-top:18px">Total Active Scholars Report</div><div style="font:500 13px/1.3 var(--body);color:#6b8a91;margin-top:4px">A.Y. 2026–2027 · 1st Semester · All schools</div>
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font:500 12.5px/1 var(--body)">${[['School', 'Scholars'], ...schools.slice(0, 5).map((s, i) => [s, vals[i]])].map((r, i) => `<tr style="${i ? '' : 'background:#e7f1ec;font-weight:700'}"><td style="padding:8px;border:1px solid #dde7e3">${r[0]}</td><td style="padding:8px;border:1px solid #dde7e3;text-align:right">${r[1]}</td></tr>`).join('')}</table></div>`);
  const ex = c.add(`<div class="abs" style="left:1240px;top:760px;display:flex;gap:14px"><span class="chip coral">${I('file-text', 22)}Export PDF</span><span class="chip" style="border-color:rgba(52,211,153,.5);color:#8ff0c8">${I('sheet', 22)}Export Excel</span></div>`);
  tl.fromTo(rep, { autoAlpha: 0, x: -200, rotation: -4, scale: 0.8 }, { autoAlpha: 1, x: 0, rotation: 0, scale: 1, duration: 0.9, ease: 'power3.out' }, c.word(2, 'reports') - 0.2);
  c.cue('paper', c.word(2, 'reports') - 0.1, 0.5);
  inn(tl, ex, c.word(2, 'prepare'), { y: 14 });
});

/* ---------------- step 11: status & history ---------------- */
scene('step11_history', (c) => {
  const { tl } = c;
  stepHead(c, 'Scholarship Status &amp; History', { nowrap: true });
  const sv = c.svg();
  const M = [['user-plus', 'Applicant', 250], ['graduation-cap', 'Scholar', 500], ['shield-check', 'Active', 750], ['award', 'Graduated', 1050], ['briefcase', 'Post-Graduation<br>Tracking', 1320]];
  const Y = 360;
  const nodes = M.map(([ic, lb, x]) => flowNode(c, x, Y, ic, lb));
  const ws = M.slice(1).map((m, i) => wire(sv, `M${M[i][2] + 72},${Y + 59} L${m[2] - 72},${Y + 59}`));
  const T = [c.word(1, 'applicant'), c.word(1, 'to scholar'), c.word(1, 'active'), c.word(3, 'graduates'), c.word(3, 'tracking')];
  nodes.forEach((n, i) => { pop(tl, n, T[i] - 0.1, { s: 0.6 }); if (i) draw(tl, ws[i - 1], T[i] - 0.4, 0.4); c.cue('pop', T[i], 0.25); });
  tl.to(nodes[2].querySelector('.ring'), { borderColor: '#34d399', color: '#34d399', duration: 0.3 }, T[2]);
  // stopped / terminated branch
  const stop = c.add(`<div class="abs card" style="left:760px;top:600px;width:360px;padding:18px 22px;display:flex;align-items:center;gap:16px;border-color:rgba(255,255,255,.18)">
    <span style="width:54px;height:54px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.07);color:#b9c9cc">${I('archive', 28)}</span>
    <div><div style="font:700 22px/1.2 var(--head)">Stopped / Terminated</div><div class="muted" style="font:500 16px/1.3 var(--body)">Decision recorded in history</div></div></div>`);
  const bw = wire(sv, curve(750, Y + 118, 860, 600, 0.5, 'v'), 'dash');
  bw.style.stroke = 'rgba(185,201,204,.6)';
  inn(tl, stop, c.word(2, 'stopped') - 0.1, { y: 20 }); draw(tl, bw, c.word(2, 'stopped') - 0.3, 0.5);
  // post-graduation outcomes
  const O = [['briefcase', 'Employed', 230, 'employed'], ['award', 'Board Passer', 360, 'board'], ['book-marked', 'Post-Graduate Studies', 490, 'post-graduate']];
  O.forEach(([ic, t, y, w]) => {
    const e = c.add(`<div class="abs chip lime" style="left:1520px;top:${y}px;font-size:22px;padding:14px 22px">${I(ic, 24)}${t}</div>`);
    const wv = wire(sv, curve(1392, Y + 59, 1520, y + 28), 'lime');
    inn(tl, e, c.word(3, w) - 0.15, { x: 30, y: 0 }); draw(tl, wv, c.word(3, w) - 0.35, 0.4);
  });
  // continuous record
  const blocks = Array.from({ length: 8 }, (_, i) => c.add(`<div class="abs sb" style="left:${270 + i * 172}px;top:790px;width:150px;height:62px;border-radius:12px;background:rgba(78,205,196,.12);border:1px solid rgba(78,205,196,.4);display:grid;place-items:center;font:600 17px/1.2 var(--head);text-align:center">
    <span>Sem ${i + 1}<br><small style="font:500 12px/1 var(--body);color:var(--muted)">${['1st', '2nd'][i % 2]} · Y${Math.floor(i / 2) + 1}</small></span></div>`));
  inn(tl, blocks, c.at(4, 0) - 0.2, { y: 20, st: 0.06 });
  const tJ = c.word(4, 'continuous');
  blocks.forEach((b, i) => tl.to(b, { x: -i * 20 + 70, borderRadius: i === 0 ? '12px 0 0 12px' : i === 7 ? '0 12px 12px 0' : '0', duration: 0.7, ease: 'power3.inOut' }, tJ));
  const wrap = c.add(`<div class="abs" style="left:${270 + 70 - 6}px;top:784px;width:${8 * 150 + 12}px;height:74px;border-radius:16px;border:3px solid var(--lime);box-shadow:0 0 40px rgba(212,255,0,.3)"></div>`);
  const lab = c.add(`<div class="abs chip lime" style="left:960px;top:720px;font-size:18px">${I('history', 20)}One continuous scholar record</div>`);
  gsap.set(lab, { xPercent: -50 });
  tl.fromTo(wrap, { autoAlpha: 0, scale: 0.97 }, { autoAlpha: 1, scale: 1, duration: 0.5 }, tJ + 0.6);
  inn(tl, lab, tJ + 0.6, { y: 10 });
  c.cue('chime', tJ + 0.6, 0.3);
});

/* ---------------- step 12: complete cycle ---------------- */
scene('step12_cycle', (c) => {
  const { tl } = c;
  stepHead(c, 'The Complete Cycle', { nowrap: true });
  const S = [['file-text', 'Application'], ['list-ordered', 'Evaluation'], ['user-check', 'Selection'], ['graduation-cap', 'Scholar'],
    ['calendar-days', 'Semester Monitoring'], ['calendar-check', 'Attendance'], ['file-check', 'Requirements'], ['chart-column', 'Grades'],
    ['chart-pie', 'Reports & Monitoring'], ['award', 'Graduation'], ['briefcase', 'Post-Graduation Tracking']];
  const XS = [330, 750, 1170, 1590];
  const pos = (i) => { const r = Math.floor(i / 4), k = i % 4; return [r === 1 ? XS[3 - k] : XS[k], 330 + r * 180]; };
  const sv = c.svg();
  let d = ''; S.forEach((_, i) => { const [x, y] = pos(i); if (!i) d = `M${x},${y}`; else { const [px, py] = pos(i - 1); d += py === y ? ` L${x},${y}` : ` C${px + (px > 900 ? 190 : -190)},${py} ${x + (x > 900 ? 190 : -190)},${y} ${x},${y}`; } });
  const path = wire(sv, d); path.style.strokeWidth = 4; path.style.stroke = 'rgba(212,255,0,.55)';
  const len = path.getTotalLength(); path.style.strokeDasharray = `${len} ${len}`;
  const pills = S.map(([ic, t], i) => { const [x, y] = pos(i); const e = c.add(`<div class="abs" style="left:${x}px;top:${y}px;width:360px;height:86px;margin:-43px 0 0 -180px;border-radius:22px;display:flex;align-items:center;gap:16px;padding:0 20px;
    background:#0f2f38;border:2px solid rgba(78,205,196,.4)"><span style="font:800 18px/1 var(--head);color:var(--lime);width:28px">${String(i + 1).padStart(2, '0')}</span><span class="pi" style="color:var(--mint)">${I(ic, 30)}</span><span style="font:700 21px/1.15 var(--head);text-transform:uppercase;letter-spacing:.02em">${t}</span></div>`); return e; });
  const groups = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10]];
  const words = [['application', 'evaluation', 'selection', 'scholar'], ['semester', 'attendance', 'requirements', 'grades'], ['reports', 'graduation', 'post-graduation']];
  const times = [];
  groups.forEach((g, li) => g.forEach((i, j) => times[i] = c.word(li + 1, words[li][j]) - 0.15));
  pills.forEach((p, i) => { pop(tl, p, times[i], { s: 0.7 }); tl.to(p, { borderColor: '#d4ff00', boxShadow: '0 0 30px rgba(212,255,0,.25)', duration: 0.3 }, times[i] + 0.1); tl.to(p, { borderColor: 'rgba(78,205,196,.6)', boxShadow: '0 0 0 rgba(0,0,0,0)', duration: 0.5 }, times[i] + 1.0); });
  // path grows with the pills
  const cum = S.map((_, i) => { if (!i) return 0; const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); let dd = ''; for (let k = 0; k <= i; k++) { const [x, y] = pos(k); if (!k) dd = `M${x},${y}`; else { const [px, py] = pos(k - 1); dd += py === y ? ` L${x},${y}` : ` C${px + (px > 900 ? 190 : -190)},${py} ${x + (x > 900 ? 190 : -190)},${y} ${x},${y}`; } } tmp.setAttribute('d', dd); sv.appendChild(tmp); const L = tmp.getTotalLength(); tmp.remove(); return L; });
  c.hook((t) => { let L = 0; for (let i = 1; i < S.length; i++) { const k = clamp((t - times[i] + 0.35) / 0.35); L = Math.max(L, lerp(cum[i - 1], cum[i], k) * (t >= times[i] - 0.35 ? 1 : 0)); } path.style.strokeDashoffset = len - L; });
  // collapse into CED <-> ISKONNECT <-> SCHOLARS
  const tF = c.at(4, 0) - 0.3;
  pills.forEach((p, i) => tl.to(p, { left: 960, top: 540, scale: 0.3, autoAlpha: 0, duration: 0.9, ease: 'power3.in' }, tF + i * 0.03));
  tl.to(path, { autoAlpha: 0, duration: 0.5 }, tF);
  const tri = c.add(`<div class="abs" style="left:0;top:380px;width:1920px;height:360px"></div>`);
  const circle = (x, inner, lab, col) => add(tri, `<div class="abs" style="left:${x}px;top:170px;width:280px;height:280px;margin:-140px 0 0 -140px;border-radius:50%;display:grid;place-items:center;
    background:radial-gradient(circle at 35% 30%,#1f5a69,#0b2730 70%);border:3px solid ${col};box-shadow:0 0 60px ${col}55"><div style="text-align:center">${inner}<div style="font:700 26px/1.1 var(--head);margin-top:10px">${lab}</div></div></div>`);
  const cA = circle(460, `<img src="${ASSET}img/ced_seal.png" style="width:110px">`, 'CED', '#4ecdc4');
  const cB = circle(960, `<img src="${ASSET}img/iskonnect_wordmark.png" style="width:220px">`, '', '#d4ff00');
  const cC = circle(1460, `<span style="color:var(--mint)">${I('graduation-cap', 90, 1.5)}</span>`, 'SCHOLARS', '#4ecdc4');
  const sv2 = svgLayer(tri);
  const l1 = wire(sv2, 'M605,170 L815,170'), l2 = wire(sv2, 'M1105,170 L1315,170');
  pop(tl, cB, c.word(4, 'iskonnect') - 0.3, { s: 0.5 }); pop(tl, cA, c.word(4, 'ced') - 0.2, { s: 0.5 }); pop(tl, cC, c.word(4, 'scholars') - 0.3, { s: 0.5 });
  draw(tl, l1, c.word(4, 'ced'), 0.4); draw(tl, l2, c.word(4, 'scholars') - 0.1, 0.4);
  for (let k = 0; k < 3; k++) { packet(c, l1, c.word(4, 'scholars') + k * 0.5, 0.8, { reverse: k % 2 === 1, css: { marginTop: '371px' } }); packet(c, l2, c.word(4, 'scholars') + 0.25 + k * 0.5, 0.8, { reverse: k % 2 === 0, css: { marginTop: '371px' } }); }
  c.cue('impact', c.word(4, 'iskonnect') - 0.3, 0.45); c.cue('shimmer', c.word(4, 'scholars'), 0.4);
});
