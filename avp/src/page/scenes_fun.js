/* The creative middle of the AVP: the "What if…?" bridge, the ISKONNECT
   reveal with the mascot and the name breakdown, and the system overview as
   "Meet the ISKONNECT squad" hero cards that snap into the architecture. */

/* ---------------- 3. A better way: What if…? ---------------- */
scene('whatif', (c) => {
  const { tl } = c;
  // L0: the problems crumple into a paper ball that rolls away
  const probIcons = PROBLEMS.map(([ic], i) => {
    const a = (i / PROBLEMS.length) * Math.PI * 2;
    const e = c.add(`<div class="abs" style="left:${960 + Math.cos(a) * 330 - 40}px;top:${500 + Math.sin(a) * 250 - 40}px;width:80px;height:80px;border-radius:22px;display:grid;place-items:center;
      background:rgba(255,107,107,.13);border:1px solid rgba(255,107,107,.4);color:var(--coral)">${I(ic, 40, 1.8)}</div>`);
    inn(tl, e, c.at(0, 0) - 0.3 + i * 0.05, { s: 0.6, y: 0, d: 0.4 });
    tl.to(e, { left: 920, top: 460, scale: 0.2, rotation: 200, autoAlpha: 0, duration: 0.7, ease: 'power3.in' }, c.word(0, 'outgrown') - 0.4 + i * 0.03);
    return e;
  });
  const ball = c.add(`<div class="abs" style="left:900px;top:440px;width:120px;height:120px;border-radius:46% 54% 50% 50%;
    background:radial-gradient(circle at 35% 30%,#fbf8f1,#d8d2c4 70%);box-shadow:inset -10px -12px 0 rgba(0,0,0,.08),0 12px 30px rgba(0,0,0,.4)">
    <svg viewBox="0 0 120 120" width="120" height="120"><path d="M20 50 L50 38 L62 70 L96 52 M40 90 L58 70 M70 26 L64 44 M84 86 L66 72" stroke="#b7ae9c" stroke-width="3" fill="none" stroke-linecap="round"/></svg></div>`);
  const tBall = c.word(0, 'outgrown') + 0.3;
  tl.fromTo(ball, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'back.out(2.5)' }, tBall);
  tl.to(ball, { x: 1200, rotation: 540, duration: 1.1, ease: 'power2.in' }, c.end(0) - 0.2);
  tl.to(ball, { keyframes: { y: [0, -160, 0, -50, 0] }, duration: 1.1, ease: 'none' }, c.end(0) - 0.2);
  c.cue('paper', tBall - 0.1, 0.7); c.cue('whoosh', c.end(0) - 0.1, 0.35);
  // L1: a big question mark drops in
  const qm = c.add(`<div class="abs" style="left:960px;top:230px;width:0;text-align:center"><div style="margin-left:-150px;width:300px;font:800 360px/1 var(--head);color:var(--lime);text-shadow:0 0 60px rgba(212,255,0,.5)">?</div></div>`);
  tl.fromTo(qm, { y: -700 }, { y: 0, duration: 0.8, ease: 'bounce.out' }, c.at(1, 0.15));
  c.hook((t) => { const k = t - c.at(1, 0.15) - 0.8; qm.style.rotate = k > 0 ? `${Math.sin(k * 5) * 8 * Math.exp(-k * 0.8)}deg` : '0deg'; });
  c.cue('boing', c.at(1, 0.15) + 0.5, 0.5);
  tl.to(qm, { autoAlpha: 0, scale: 0.3, duration: 0.4, ease: 'power2.in' }, c.at(2, 0) - 0.35);
  // "WHAT IF…" kicker stays for the three questions
  const kick = c.add(`<div class="abs" style="top:170px;width:100%;text-align:center;font:800 40px/1 var(--head);letter-spacing:.3em;color:var(--lime)">WHAT IF…</div>`);
  inn(tl, kick, c.at(2, 0) - 0.1, { y: -20, d: 0.5 });
  tl.to(kick, { autoAlpha: 0, duration: 0.4 }, c.at(5, 0) - 0.3);
  const Q = [
    'applying for a scholarship | took *minutes,* not ~days?~',
    'every requirement, grade and attendance record | was just *one* *tap* *away?*',
    'CED could follow every scholar\'s journey, | all in *one* *place?*',
  ];
  const qs = Q.map((q, i) => {
    const e = c.add(`<div class="abs" style="left:210px;top:250px;width:1500px;text-align:center;font:700 64px/1.18 var(--head);perspective:800px">${kw(q)}</div>`);
    kinetic(c, e, c.at(i + 2, 0.02), c.at(i + 2, 0.8));
    tl.to(e, { autoAlpha: 0, y: -30, duration: 0.4, ease: 'power2.in' }, c.at(i + 3, 0) - 0.35);
    return e;
  });
  // Q1 visual: days vs minutes
  const tiles = c.add(`<div class="abs" style="left:0;width:1920px;top:520px;display:flex;justify-content:center;align-items:center;gap:70px">
    <div class="d1" style="width:330px;height:230px;border-radius:26px;background:#10272e;border:3px solid rgba(255,107,107,.6);display:grid;place-items:center;text-align:center">
      <div><div style="font:800 110px/1 var(--head);color:#ff8b8b">7</div><div style="font:700 26px/1 var(--head);letter-spacing:.2em;color:#ffb3b3;margin-top:8px">DAYS</div></div></div>
    <div class="clk" style="color:var(--mint)">${I('timer', 90, 1.6)}</div>
    <div class="m1" style="width:330px;height:230px;border-radius:26px;background:#10272e;border:3px solid var(--lime);display:grid;place-items:center;text-align:center;box-shadow:0 0 50px rgba(212,255,0,.25)">
      <div><div style="font:800 110px/1 var(--head);color:var(--lime)">5</div><div style="font:700 26px/1 var(--head);letter-spacing:.2em;color:var(--lime);margin-top:8px">MINUTES</div></div></div></div>`);
  const [d1, clk, m1] = tiles.children;
  inn(tl, d1, c.at(2, 0.2), { y: 30 }); inn(tl, clk, c.at(2, 0.35), { y: 0, s: 0.4 });
  tl.fromTo(m1, { rotationX: -90, autoAlpha: 0 }, { rotationX: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)' }, c.word(2, 'minutes'));
  tl.to(d1, { scale: 0.85, opacity: 0.45, duration: 0.4 }, c.word(2, 'days'));
  c.hook((t) => { clk.style.rotate = `${Math.max(0, t - c.at(2, 0.35)) * 540}deg`; });
  c.cue('tick', c.word(2, 'minutes'), 0.5); c.cue('tick', c.word(2, 'minutes') + 0.12, 0.5);
  tl.to(tiles, { autoAlpha: 0, duration: 0.4 }, c.at(3, 0) - 0.35);
  // Q2 visual: records fly into a phone, one tap
  const ph = c.add(`<div class="abs" style="left:870px;top:470px;width:180px;height:330px;border-radius:32px;background:#0b1114;padding:9px;box-shadow:0 0 60px rgba(78,205,196,.35)">
    <div style="height:100%;border-radius:24px;background:linear-gradient(170deg,#1b4d5c,#0e3440);display:grid;place-items:center"><img src="${ASSET}img/iskonnect_wordmark.png" style="width:130px;background:#fff;border-radius:10px;padding:8px 6px"></div></div>`);
  inn(tl, ph, c.at(3, 0.05), { y: 80 });
  const recs = [['file-check', 'Requirements', 330], ['chart-column', 'Grades', 1440], ['calendar-check', 'Attendance', 360]].map(([ic, t, x], i) => {
    const e = c.add(`<div class="abs chip" style="left:${x}px;top:${520 + i * 90}px;font-size:26px;padding:14px 24px">${I(ic, 28)}${t}</div>`);
    inn(tl, e, c.word(3, ['requirement', 'grade', 'attendance'][i]) - 0.1, { x: x < 900 ? -60 : 60, y: 0, d: 0.4 });
    tl.to(e, { left: 890, top: 600, scale: 0.2, autoAlpha: 0, duration: 0.6, ease: 'power3.in' }, c.word(3, 'one tap') - 0.5 + i * 0.1);
    return e;
  });
  const finger = c.add(`<div class="abs" style="left:1060px;top:760px;color:#fff">${I('circle-dot', 70, 1.5)}</div>`);
  tl.fromTo(finger, { autoAlpha: 0, x: 140, y: 120 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: 'power2.out' }, c.word(3, 'one tap') - 0.4);
  tl.to(finger, { scale: 0.8, duration: 0.1, yoyo: true, repeat: 1 }, c.word(3, 'tap'));
  const rip = c.add(`<div class="abs" style="left:1095px;top:795px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:4px solid var(--lime)"></div>`);
  tl.fromTo(rip, { scale: 0.3, autoAlpha: 1 }, { scale: 4, autoAlpha: 0, duration: 0.6 }, c.word(3, 'tap'));
  c.cue('tap', c.word(3, 'tap'), 0.7);
  tl.to([ph, finger], { autoAlpha: 0, duration: 0.4 }, c.at(4, 0) - 0.35);
  // Q3 visual: scattered scholars link into one place
  const r = rng(12); const sv = c.svg();
  const dots = Array.from({ length: 18 }, (_, i) => {
    const x = 260 + r() * 1400, y = 480 + r() * 360;
    const d = c.add(`<div class="abs" style="left:${x - 26}px;top:${y - 26}px;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#0f2f38;border:2px solid var(--mint);color:var(--mint)">${I('graduation-cap', 24)}</div>`);
    const w = wire(sv, `M${x},${y} L960,650`); w.style.stroke = 'rgba(212,255,0,.5)';
    pop(tl, d, c.at(4, 0.05) + i * 0.05, { s: 0.3 });
    draw(tl, w, c.word(4, 'one place') - 0.6 + i * 0.03, 0.5);
    tl.to([d, w], { autoAlpha: 0, duration: 0.4 }, c.at(5, 0) - 0.35);
    return d;
  });
  const hub = c.add(`<div class="abs" style="left:960px;top:650px;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#1f5a69,#0b2730);border:3px solid var(--lime);color:var(--lime);box-shadow:0 0 60px rgba(212,255,0,.5)">${I('network', 56)}</div>`);
  pop(tl, hub, c.word(4, 'one place'), { s: 0.3 });
  tl.to(hub, { autoAlpha: 0, duration: 0.4 }, c.at(5, 0) - 0.35);
  // L5: "Well… now it can." and the phone powers on
  const now = c.add(`<div class="abs" style="top:200px;width:100%;text-align:center;font:700 80px/1.1 var(--head);perspective:800px">${kw('Well… *now* *it* *can.*')}</div>`);
  kinetic(c, now, c.at(5, 0), c.end(5) - 0.1, { y: 60 });
  const big = c.add(`<div class="abs" style="left:790px;top:420px;width:340px;height:620px;border-radius:52px;background:linear-gradient(145deg,#2b3a40,#0b1114 40%,#1a2429);padding:14px;box-shadow:0 40px 100px rgba(0,0,0,.6)">
    <div class="scr" style="position:relative;height:100%;border-radius:40px;background:#050809;overflow:hidden"><div class="on" style="position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,#2a6274,#0f3441 70%)">
      <div style="width:250px;padding:18px 14px;border-radius:22px;background:rgba(255,255,255,.96)"><img src="${ASSET}img/iskonnect_wordmark.png" style="width:100%"></div></div></div></div>`);
  tl.fromTo(big, { y: 700 }, { y: 0, duration: 1.0, ease: 'power3.out' }, c.at(5, 0) - 0.1);
  const on = big.querySelector('.on');
  tl.fromTo(on, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, c.end(5) + 0.2);
  tl.to(big, { scale: 1.6, duration: c.dur - c.end(5) - 0.2, ease: 'power2.in' }, c.end(5) + 0.2);
  flash(c, c.dur - 0.45, 0.4, 'in');
  c.cue('riser', c.dur - 2.4, 0.9);
  c.cue('mbreak', c.dur, 1);
});

/* ---------------- 4. Say hello to ISKONNECT ---------------- */
scene('intro_logo', (c) => {
  const { tl } = c;
  flash(c, 0, 0.6, 'out');
  const T0 = 0.12; // the logo slam
  const logo = c.add(`<div class="abs" style="left:460px;top:190px;width:1000px;z-index:5"><img src="${ASSET}img/iskonnect_wordmark.png" style="width:100%;display:block;filter:drop-shadow(0 0 60px rgba(78,205,196,.45))">
    <div class="sw" style="position:absolute;inset:0;-webkit-mask-image:url(${ASSET}img/iskonnect_wordmark.png);-webkit-mask-size:100% 100%;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.9) 50%,transparent 60%);background-size:250% 100%;background-repeat:no-repeat"></div></div>`);
  tl.fromTo(logo, { scale: 2.6, autoAlpha: 0, filter: 'blur(18px)' }, { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration: 0.32, ease: 'power4.in' }, T0);
  tl.fromTo(logo.querySelector('.sw'), { backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0', duration: 1.4, ease: 'power2.inOut' }, T0 + 0.6);
  shockwave(c, 960, 353, T0 + 0.32); burst(c, 960, 353, T0 + 0.32, { n: 44, speed: 1400, seed: 4 });
  shake(c, c.el, T0 + 0.32, 0.5, 22);
  c.cue('impact', T0 + 0.3, 1.0); c.cue('shimmer', T0 + 0.45, 0.6);
  const tagline = c.add(`<div class="abs" style="top:560px;width:100%;text-align:center;font:600 34px/1.3 var(--head);color:#dcebed">Mobile-Based Scholarship Management System</div>`);
  inn(tl, tagline, T0 + 0.8, { y: 20 });
  // the mascot says hi
  const m = mascot(c, 1480, 520, 1.05);
  m.el.style.zIndex = 10;
  tl.fromTo(m.el, { y: 500 }, { y: 0, duration: 0.6, ease: 'back.out(1.6)' }, c.at(0, 0) - 0.3);
  m.jump(c.at(0, 0) + 0.2).wave(c.at(0, 0) + 0.8, 2.2, 3);
  const bub = c.add(`<div class="abs" style="left:1330px;top:625px;z-index:11;padding:14px 22px;border-radius:22px 22px 4px 22px;background:#fff;color:#16323a;font:800 30px/1 var(--head);box-shadow:0 12px 30px rgba(0,0,0,.35)">Hi! 👋</div>`);
  pop(tl, bub, c.at(0, 0) + 0.7, { s: 0.3 }); tl.to(bub, { autoAlpha: 0, duration: 0.3 }, c.at(1, 0) - 0.2);
  // L1: what's in a name? — logo floats up, the two halves appear
  const tN = c.at(1, 0);
  tl.to(logo, { y: -110, scale: 0.55, duration: 0.8, ease: 'power3.inOut' }, tN);
  tl.to(tagline, { autoAlpha: 0, duration: 0.3 }, tN);
  const isko = c.add(`<div class="abs card" style="left:120px;top:330px;width:780px;height:440px;padding:36px 40px;overflow:hidden">
    <div class="w" style="font:800 124px/1 var(--head);color:var(--lime);letter-spacing:.02em">ISKO</div>
    <div class="def" style="margin-top:26px;width:440px;font:600 34px/1.3 var(--head)">What Filipinos lovingly call a <span class="lime">scholar</span></div>
    <div class="def chip lime" style="margin-top:22px;font-size:22px">${I('graduation-cap', 24)}short for “iskolar”</div></div>`);
  const kon = c.add(`<div class="abs card" style="left:1000px;top:330px;width:800px;height:440px;padding:36px 40px;overflow:hidden">
    <div class="w" style="font:800 116px/1 var(--head);color:var(--mint);letter-spacing:.02em">KONNECT</div>
    <div class="def" style="margin-top:200px;font:600 30px/1.3 var(--head)">The <span class="mint">connection</span> between scholars and CED</div></div>`);
  inn(tl, isko, tN + 0.3, { x: -120, y: 0, d: 0.7 }); inn(tl, kon, tN + 0.45, { x: 120, y: 0, d: 0.7 });
  const qmark = c.add(`<div class="abs" style="left:925px;top:470px;font:800 90px/1 var(--head);color:#fff">?</div>`);
  pop(tl, qmark, tN + 0.6, { s: 0.3 });
  c.cue('whoosh', tN + 0.25, 0.4);
  gsap.set([...isko.querySelectorAll('.def'), ...kon.querySelectorAll('.def')], { autoAlpha: 0 });
  // L2: ISKO — the mascot steps in and tips his cap
  tl.to(m.el, { left: 640, top: 360, duration: 0.8, ease: 'power3.inOut' }, c.at(2, 0) - 0.5);
  m.walk(c.at(2, 0) - 0.5, 0.8).tip(c.word(2, 'lovingly'), 1.6);
  inn(tl, isko.querySelectorAll('.def'), c.at(2, 0.1), { y: 16, st: 0.35 });
  tl.to(isko, { borderColor: 'rgba(212,255,0,.7)', duration: 0.4 }, c.at(2, 0));
  tl.to(qmark, { autoAlpha: 0, duration: 0.3 }, c.at(2, 0));
  // L3: KONNECT — a plug from the scholars snaps into CED's socket
  const plugY = 560;
  const plug = c.add(`<div class="abs" style="left:1040px;top:${plugY}px;width:400px;height:80px">
    <div style="position:absolute;left:0;top:34px;width:250px;height:12px;border-radius:6px;background:#4ecdc4"></div>
    <div style="position:absolute;left:240px;top:10px;width:110px;height:60px;border-radius:14px;background:#2d9596;display:grid;place-items:center;color:#fff">${I('graduation-cap', 30)}</div>
    <div style="position:absolute;left:350px;top:20px;width:40px;height:10px;border-radius:3px;background:#cfe3e5"></div><div style="position:absolute;left:350px;top:50px;width:40px;height:10px;border-radius:3px;background:#cfe3e5"></div>
    <div style="position:absolute;left:0;top:-30px;font:700 20px/1 var(--head);color:var(--mint)">SCHOLARS</div></div>`);
  const sock = c.add(`<div class="abs" style="left:1560px;top:${plugY}px;width:210px;height:80px">
    <div style="position:absolute;left:0;top:0;width:130px;height:80px;border-radius:16px;background:#1b4d5c;border:3px solid #d4ff00;display:grid;place-items:center;color:#d4ff00">${I('landmark', 34)}</div>
    <div style="position:absolute;left:125px;top:34px;width:90px;height:12px;border-radius:6px;background:#d4ff00"></div>
    <div style="position:absolute;right:0;top:-30px;font:700 20px/1 var(--head);color:var(--lime)">CED</div></div>`);
  const tSnap = c.word(3, 'connection');
  inn(tl, plug, c.at(3, 0), { x: -80, y: 0, d: 0.5 }); inn(tl, sock, c.at(3, 0) + 0.1, { x: 80, y: 0, d: 0.5 });
  tl.to(plug, { x: 170, duration: 0.5, ease: 'power3.in' }, tSnap - 0.5);
  tl.to(sock, { x: -40, duration: 0.5, ease: 'power3.in' }, tSnap - 0.5);
  burst(c, 1560, plugY + 40, tSnap, { n: 26, speed: 700, colors: ['#d4ff00', '#ffffff', '#ffd54f'], seed: 9 });
  c.cue('snap', tSnap, 0.9);
  inn(tl, kon.querySelectorAll('.def'), tSnap + 0.2, { y: 16 });
  tl.to(kon, { borderColor: 'rgba(78,205,196,.8)', duration: 0.4 }, c.at(3, 0));
  // L4: put them together — the halves merge back into the logo, features orbit
  const tM = c.at(4, 0) - 0.2;
  tl.to([isko, kon, plug, sock], { autoAlpha: 0, scale: 0.9, duration: 0.5, ease: 'power2.in' }, tM + 0.2);
  const wI = isko.querySelector('.w'), wK = kon.querySelector('.w');
  tl.to(logo, { y: 110, scale: 0.72, duration: 0.8, ease: 'back.out(1.4)' }, tM + 0.6);
  c.cue('whoosh', tM + 0.5, 0.4); c.cue('shimmer', tM + 0.9, 0.4);
  tl.to(m.el, { left: 110, top: 600, duration: 0.8, ease: 'power3.inOut' }, tM + 0.3);
  m.walk(tM + 0.3, 0.8).cheer(c.word(4, 'one platform'), 2.4);
  const feats = [['info', 'Information', 'information'], ['workflow', 'Processes', 'processes'], ['gauge', 'Monitoring', 'monitoring'], ['message-circle', 'Communication', 'communication'], ['archive', 'Records', 'records']];
  const CX = 960, CY = 463, RX = 640, RY = 230;
  const chips = feats.map(([ic, t, w], i) => {
    const e = c.add(`<div class="abs chip" style="font-size:26px;padding:15px 26px;white-space:nowrap">${I(ic, 28)}${t}</div>`);
    const t0 = c.word(4, w) - 0.1;
    c.hook((tt) => {
      const a = i * (Math.PI * 2 / 5) + Math.PI / 2 + (tt - c.at(4, 0)) * 0.55;
      const depth = Math.sin(a);
      const k = clamp((tt - t0) / 0.5);
      e.style.left = CX + Math.cos(a) * RX + 'px'; e.style.top = CY + depth * RY + 'px';
      e.style.transform = `translate(-50%,-50%) scale(${(0.88 + 0.2 * depth) * (0.4 + 0.6 * ease(k))})`;
      e.style.opacity = k * (0.65 + 0.35 * (depth + 1) / 2);
      e.style.zIndex = depth > 0 ? 6 : 4;
    });
    return e;
  });
  const one = c.add(`<div class="abs chip lime" style="left:960px;top:760px;font-size:30px;padding:18px 34px">${I('layers', 32)}One platform. Everything connected.</div>`);
  gsap.set(one, { xPercent: -50 });
  pop(tl, one, c.word(4, 'one platform'), { s: 0.6 });
  c.cue('chime', c.word(4, 'one platform'), 0.4);
});

/* ---------------- 5. Meet the ISKONNECT squad ---------------- */
const FEAT = { x: 130, y: 240 }; // featured card position
function featureHead(c, num, title, sub, t) {
  const e = c.add(`<div class="abs" style="left:640px;top:250px;width:1180px"><div class="kicker">${num}</div><div class="h2" style="margin-top:12px">${title}</div>${sub ? `<div class="lead" style="margin-top:8px">${sub}</div>` : ''}</div>`);
  inn(c.tl, e, t, { y: 20 });
  return e;
}
function abilities(c, items, li, x0, y0, cols = 2, colW = 520, rowH = 82) {
  return items.map(([ic, t, w], i) => {
    const e = c.add(`<div class="abs chip" style="left:${x0 + (i % cols) * colW}px;top:${y0 + Math.floor(i / cols) * rowH}px;font-size:24px;padding:14px 22px">${I(ic, 26)}${t}</div>`);
    pop(c.tl, e, c.word(li, w) - 0.15, { s: 0.6 });
    return e;
  });
}
scene('overview_arch', (c) => {
  const { tl } = c;
  const head = c.add(`<div class="abs" style="top:135px;width:100%;text-align:center"><div class="kicker">System overview</div><div class="h2" style="margin-top:12px">Meet the ISKONNECT squad</div></div>`);
  inn(tl, head, c.at(0, 0), { y: 20 });
  const keys = ['app', 'brain', 'admin', 'qr'];
  const cards = keys.map((k, i) => heroCard(c, k, 298 + i * 340, 330, 0.8));
  cards.forEach((cd, i) => tl.fromTo(cd, { y: 700, rotation: (i - 1.5) * 12, autoAlpha: 0 }, { y: 0, rotation: (i - 1.5) * 3, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.2)' }, c.at(0, 0.1) + i * 0.12));
  tl.to(cards, { y: -40, duration: 0.25, yoyo: true, repeat: 1, stagger: 0.1, ease: 'power2.out' }, c.word(0, 'meet them'));
  c.cue('boing', c.word(0, 'meet them'), 0.3);
  // L1: Student App flips and takes the stage
  const tA = c.at(1, 0);
  flipCard(c, cards[0], tA);
  tl.to(head, { autoAlpha: 0, duration: 0.4 }, tA + 0.3);
  tl.to(cards.slice(1), { y: 700, autoAlpha: 0, duration: 0.6, ease: 'power3.in', stagger: 0.06 }, tA + 0.6);
  tl.to(cards[0], { left: FEAT.x, top: FEAT.y, rotation: 0, duration: 0.8, ease: 'power3.inOut' }, tA + 0.9);
  tl.to(cards[0].sc, { scale: 1, duration: 0.8, ease: 'power3.inOut' }, tA + 0.9);
  const h1 = featureHead(c, '01 · Student App', 'A scholarship companion in your pocket', '', tA + 1.1);
  const A = [['user', 'Profile', 'profile'], ['graduation-cap', 'Scholarship details', 'scholarship details'], ['file-check', 'Requirements', 'requirements'], ['book-open', 'Subjects', 'subjects'],
    ['chart-column', 'Grades', 'grades'], ['calendar-check', 'Attendance', 'attendance'], ['megaphone', 'Announcements', 'announcements'], ['calendar-days', 'Schedules', 'schedules'],
    ['message-circle', 'Messages', 'messages'], ['shield-check', 'Scholarship status', 'scholarship status']];
  const ab = abilities(c, A, 2, 640, 420);
  // L3: the brain
  const tB = c.at(3, 0);
  tl.to([cards[0], h1, ...ab], { autoAlpha: 0, x: -60, duration: 0.5, ease: 'power2.in', stagger: 0.015 }, tB - 0.4);
  const brain = heroCard(c, 'brain', FEAT.x, FEAT.y, 1);
  tl.fromTo(brain, { y: 700, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, tB - 0.1);
  flipCard(c, brain, c.word(3, 'brain'));
  featureHead(c, '02 · Backend &amp; Database', 'The brain of the operation', '', c.word(3, 'brain') + 0.3);
  abilities(c, [['database', 'Every record in one place', 'central'], ['lock', 'Authorized access only', 'safe'], ['refresh-cw', 'Always in sync', 'in sync']], 3, 640, 420, 1, 0, 90);
  // sync diagram: app ⇄ brain ⇄ dashboard
  const sv = c.svg();
  const nA = flowNode(c, 1180, 680, 'smartphone', 'Student App', { sm: true }), nB = flowNode(c, 1450, 680, 'database', 'Database', { sm: true, hl: true }), nC = flowNode(c, 1720, 680, 'monitor', 'Dashboard', { sm: true });
  const w1 = wire(sv, 'M1238,726 L1392,726'), w2 = wire(sv, 'M1508,726 L1662,726');
  inn(tl, [nA, nB, nC], c.word(3, 'backend'), { y: 20, st: 0.12 });
  draw(tl, w1, c.word(3, 'database'), 0.4); draw(tl, w2, c.word(3, 'database') + 0.2, 0.4);
  for (let k = 0; k < 4; k++) { packet(c, w1, c.word(3, 'record') + k * 0.7, 0.6, { reverse: k % 2 === 1 }); packet(c, w2, c.word(3, 'record') + 0.35 + k * 0.7, 0.6, { reverse: k % 2 === 0 }); }
});

scene('overview_admin', (c) => {
  const { tl } = c;
  const card = heroCard(c, 'admin', 110, 230, 0.86);
  tl.fromTo(card, { y: 700, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, 0.05);
  flipCard(c, card, c.word(0, 'mission control') - 0.2);
  const lap = laptop(c, 530, 180, 0.66);
  add(lap.win, `<img class="shot" src="${ASSET}img/screens/admin_dashboard.png">`);
  add(lap.win, `<div class="real-tag">${I('monitor', 15)}Actual system screen</div>`);
  inn(tl, lap, c.word(0, 'dashboard') - 0.3, { x: 80, y: 0, d: 0.8 });
  const kk = c.add(`<div class="abs kicker" style="left:1360px;top:150px">03 · Mission Control</div>`);
  inn(tl, kk, c.word(0, 'dashboard'), { y: 10 });
  const F = [['users', 'Applicants &amp; scholars', 'applicants'], ['file-check', 'Requirements', 'requirements'], ['chart-column', 'Grades', 'grades'], ['calendar-check', 'Attendance', 'attendance'],
    ['megaphone', 'Announcements', 'announcements'], ['calendar-days', 'Schedules', 'schedules'], ['file-text', 'Reports', 'reports'], ['folder-open', 'Documents', 'documents'],
    ['history', 'Scholar history', 'history'], ['message-circle', 'Communication', 'communication']];
  F.forEach(([ic, t, w], i) => {
    const e = c.add(`<div class="abs" style="left:1360px;top:${195 + i * 62}px;display:flex;align-items:center;gap:14px;font:600 24px/1.2 var(--head)">
      <span style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:rgba(244,162,97,.13);border:1px solid rgba(244,162,97,.45);color:var(--amber)">${I(ic, 24)}</span>${t}</div>`);
    inn(tl, e, c.word(1, w) - 0.2, { x: 30, y: 0, d: 0.45 });
  });
});

scene('overview_qr', (c) => {
  const { tl } = c;
  const card = heroCard(c, 'qr', 110, 230, 0.86);
  tl.fromTo(card, { y: 700, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }, 0.05);
  flipCard(c, card, c.word(0, 'attendance hero') - 0.2);
  const kk = c.add(`<div class="abs" style="left:560px;top:160px"><div class="kicker">04 · QR Scanner App</div><div class="h2" style="margin-top:12px">Attendance, even offline</div></div>`);
  inn(tl, kk, c.word(0, 'qr scanner'), { y: 16 });
  // offline demo: scanner ⇄ system
  const p = phone(c, 560, 330, 0.66, { dark: true });
  const v = p.view(`<div style="padding:62px 20px 0">
    <div class="a-row" style="justify-content:space-between"><div class="a-row"><span class="a-ico" style="background:#1b4d5c;color:#d4ff00">${I('scan-line', 22)}</span><div><div class="a-t" style="font-size:18px;font-weight:800">ISKONNECT</div><div class="a-s" style="margin:0">Attendance Scanner</div></div></div>
      <span class="st sync">${I('refresh-cw', 12, 2.6)}<b class="sy">Online</b></span></div>
    <div class="a-card" style="margin-top:16px"><div class="a-row"><span class="a-ico" style="background:#fff4de;color:#e0a100">${I('calendar', 22)}</span><div><div class="a-s" style="margin:0">Current Event</div><div class="a-t">General Assembly</div></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
      <div class="a-card"><div style="font:800 30px/1 var(--head)" class="scans">0</div><div class="a-s">Activity Scans</div></div>
      <div class="a-card"><div style="font:800 30px/1 var(--head)" class="pend">0</div><div class="a-s">Pending Sync</div></div></div>
    <div style="margin:26px auto 0;width:150px;height:150px;border-radius:50%;background:#1b4d5c;display:grid;place-items:center;color:#fff;box-shadow:0 0 0 10px rgba(27,77,92,.12)">
      <div style="text-align:center">${I('scan-line', 52, 1.8)}<div style="font:800 15px/1 var(--head);margin-top:6px">SCAN</div></div></div></div>`);
  v.style.background = '#fff';
  inn(tl, p, c.at(1, 0) - 0.4, { y: 60, d: 0.7 });
  const hub = c.add(`<div class="abs" style="left:1560px;top:560px;width:240px;height:240px;margin:-120px 0 0 -120px;border-radius:50%;display:grid;place-items:center;
    background:radial-gradient(circle at 35% 30%,#1f5a69,#0b2730 70%);border:3px solid var(--mint);box-shadow:0 0 70px rgba(78,205,196,.3)"><img src="${ASSET}img/iskonnect_wordmark.png" style="width:170px"></div>`);
  inn(tl, hub, c.at(1, 0), { y: 20 });
  const sv = c.svg();
  const wA = wire(sv, 'M840,540 L1440,540'), wB = wire(sv, 'M1440,590 L840,590');
  draw(tl, wA, c.at(1, 0.05), 0.5); draw(tl, wB, c.at(1, 0.1), 0.5);
  const lenA = wA.getTotalLength(), lenB = wB.getTotalLength();
  const net = c.add(`<div class="abs" style="left:1108px;top:533px;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:#0b2730;border:2px solid var(--mint);color:var(--mint)"></div>`);
  inn(tl, net, c.at(1, 0.1), { y: 0, s: 0.5 });
  const tScan = c.word(1, 'scans'), tOff = c.word(1, 'without'), tSync = c.word(1, 'syncs');
  const scans = v.querySelector('.scans'), pend = v.querySelector('.pend'), sy = v.querySelector('.sy'), syc = v.querySelector('.sync');
  c.hook((t) => {
    const n = t < tScan ? 0 : Math.min(5, 1 + Math.floor((t - tScan) / 0.8));
    scans.textContent = n;
    const offline = t >= tOff - 0.1 && t < tSync;
    pend.textContent = t < tOff ? 0 : t < tSync + 0.5 ? Math.max(1, n - 1) : Math.max(0, n - 1 - Math.floor((t - tSync - 0.5) / 0.3));
    net.innerHTML = offline ? I('wifi-off', 30) : I('wifi', 30);
    net.style.color = net.style.borderColor = offline ? '#ff6b6b' : '#4ecdc4';
    sy.textContent = offline ? 'Offline' : t >= tSync && t < tSync + 1.5 ? 'Syncing…' : 'Online';
    syc.style.background = offline ? '#ffe9e9' : '#e3f7ec'; syc.style.color = offline ? '#d44848' : '#13925b';
    wA.style.stroke = wB.style.stroke = offline ? 'rgba(255,107,107,.35)' : 'rgba(78,205,196,.55)';
    wA.style.strokeDasharray = offline ? '8 12' : `${lenA} ${lenA}`; wB.style.strokeDasharray = offline ? '8 12' : `${lenB} ${lenB}`;
  });
  for (let k = 0; k < 3; k++) packet(c, wA, tSync + 0.2 + k * 0.35, 0.8);
  for (let k = 0; k < 3; k++) c.cue('beep', tScan + k * 0.8, 0.25);
  abilities(c, [['qr-code', 'Scans in seconds', 'scans'], ['wifi-off', 'Works offline', 'without'], ['hard-drive', 'Stores on device', 'stores'], ['refresh-cw', 'Syncs when online', 'syncs']], 1, 1000, 720, 2, 400, 78);
  // L2: the squad snaps together into the architecture
  const tJ = c.at(2, 0) - 0.3;
  tl.to([...c.el.querySelectorAll(':scope > *')], { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, tJ);
  const title = c.add(`<div class="abs" style="left:130px;top:430px;width:560px"><div class="kicker">System overview</div><div class="h2" style="margin-top:12px">One connected system</div>
    <div class="lead" style="margin-top:14px">Every component shares the same ISKONNECT data.</div></div>`);
  inn(tl, title, tJ + 0.5, { x: -40, y: 0 });
  const S = 0.4, cw = 380 * S, ch = 520 * S;
  const pos = { app: [890, 130], brain: [890, 420], admin: [890, 710], qr: [1330, 420] };
  const mini = Object.entries(pos).map(([k, [x, y]], i) => { const cd = heroCard(c, k, x, y, S); gsap.set(cd.inner, { rotationY: 0 }); pop(tl, cd, tJ + 0.5 + i * 0.15, { s: 0.5 }); return cd; });
  const sv2 = c.svg();
  const cx = 890 + cw / 2;
  const l1 = wire(sv2, `M${cx},${130 + ch} L${cx},420`, 'lime'), l2 = wire(sv2, `M${cx},${420 + ch} L${cx},710`, 'lime'), l3 = wire(sv2, `M${890 + cw},${420 + ch / 2} L1330,${420 + ch / 2}`, 'lime');
  [l1, l2, l3].forEach((w, i) => draw(tl, w, tJ + 1.1 + i * 0.15, 0.5));
  for (let k = 0; k < 4; k++) { packet(c, l1, tJ + 1.8 + k * 0.6, 0.5, { reverse: k % 2 === 1 }); packet(c, l2, tJ + 2.0 + k * 0.6, 0.5, { reverse: k % 2 === 0 }); packet(c, l3, tJ + 1.9 + k * 0.6, 0.6, { reverse: k % 2 === 1 }); }
  [['↕', cx + 20, 130 + ch + 30], ['↕', cx + 20, 420 + ch + 30], ['⇄', 1150, 420 + ch / 2 - 44]].forEach(([s, x, y], i) => { const e = c.add(`<div class="abs" style="left:${x}px;top:${y}px;font:700 30px/1 var(--head);color:var(--lime)">${s}</div>`); inn(tl, e, tJ + 1.4 + i * 0.1, { y: 0 }); });
  c.cue('snap', tJ + 1.1, 0.5); c.cue('chime', tJ + 1.6, 0.35);
});
