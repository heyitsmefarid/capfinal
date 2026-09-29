/* Sections 7–8: expected improvements and closing. */

const BENEFITS = [['database', 'Centralized scholarship records'], ['scan-eye', 'Easier scholar monitoring'], ['folder-open', 'Organized requirements'], ['chart-line', 'Digital academic & attendance monitoring'],
  ['zap', 'Faster access to information'], ['message-circle', 'Better communication'], ['file-text', 'Easier report preparation'], ['history', 'Better tracking of scholar history'],
  ['archive', 'Less dependence on physical records'], ['layers', 'More organized scholarship management']];
const BX = (i) => (i % 2 ? 1000 : 400), BY = (i) => 230 + Math.floor(i / 2) * 124;
function buildBenefits(c) {
  return BENEFITS.map(([ic, t], i) => c.add(`<div class="benefit card" style="left:${BX(i)}px;top:${BY(i)}px"><span class="bi">${I(ic, 30)}</span><span class="bt">${t}</span>
    <span style="margin-left:auto;color:var(--lime)">${I('check', 26, 2.6)}</span></div>`));
}
scene('benefits', (c) => {
  const { tl } = c;
  const head = c.add(`<div class="abs h2" style="top:110px;width:100%;text-align:center">What ISKONNECT brings to CED &amp; its scholars</div>`);
  inn(tl, head, c.at(0, 0.05), { y: 20 });
  const tiles = buildBenefits(c);
  const T = [c.at(1, 0), c.word(1, 'easier'), c.at(2, 0), c.word(2, 'digital'), c.at(3, 0), c.word(3, 'better'), c.word(3, 'easier'), c.at(4, 0), c.word(4, 'less'), c.end(4) + 0.1];
  tiles.forEach((e, i) => { inn(tl, e, T[i] - 0.15, { x: i % 2 ? 40 : -40, y: 0, d: 0.55 }); c.cue('tick', T[i], 0.22); });
});
scene('benefits_statement', (c) => {
  const { tl } = c;
  const tiles = buildBenefits(c);
  const head = c.add(`<div class="abs h2" style="top:110px;width:100%;text-align:center">What ISKONNECT brings to CED &amp; its scholars</div>`);
  tl.to(head, { autoAlpha: 0, duration: 0.4 }, 0.1);
  tiles.forEach((e, i) => tl.to(e, { autoAlpha: 0, y: 30, scale: 0.94, duration: 0.5, ease: 'power2.in' }, 0.1 + i * 0.03));
  const s = c.add(`<div class="abs" style="top:300px;width:100%;text-align:center">
    <div class="h3" style="font-weight:500;color:#dcebed">ISKONNECT helps make scholarship management more</div>
    <div style="display:flex;justify-content:center;gap:56px;margin-top:40px;font:800 100px/1 var(--head);letter-spacing:-.01em">
      <span class="w1 lime">organized.</span><span class="w2" style="color:#fff">accessible.</span><span class="w3 mint">connected.</span></div></div>`);
  inn(tl, s.firstElementChild, c.at(0, 0), { y: 20 });
  inn(tl, s.querySelector('.w1'), c.word(0, 'organized') - 0.1, { y: 40, s: 0.9 });
  inn(tl, s.querySelector('.w2'), c.word(0, 'accessible') - 0.1, { y: 40, s: 0.9 });
  inn(tl, s.querySelector('.w3'), c.word(0, 'connected') - 0.1, { y: 40, s: 0.9 });
  c.cue('shimmer', c.word(0, 'connected'), 0.45);
});
scene('closing', (c) => {
  const { tl } = c; const r = rng(17);
  // particles converge into the logo
  const parts = Array.from({ length: 70 }, (_, i) => {
    const a = r() * Math.PI * 2, d = 700 + r() * 500;
    return { e: c.add(`<div class="abs" style="width:${4 + r() * 5}px;height:${4 + r() * 5}px;border-radius:50%;background:${['#d4ff00', '#4ecdc4', '#9b8ec9', '#f4a261'][i % 4]};box-shadow:0 0 12px currentColor"></div>`), x: 960 + Math.cos(a) * d, y: 420 + Math.sin(a) * d * 0.6, k: r() };
  });
  const tLogo = c.at(0, 0) - 0.3;
  c.hook((t) => { parts.forEach((p) => { const k = ease(clamp((t - 0.2 - p.k * 0.6) / (tLogo - 0.2 - p.k * 0.6 + 0.001))); p.e.style.left = lerp(p.x, 960, k) + 'px'; p.e.style.top = lerp(p.y, 400, k) + 'px'; p.e.style.opacity = t < tLogo ? 0.3 + 0.7 * k : Math.max(0, 1 - (t - tLogo) * 3); }); });
  const flash = c.add(`<div class="abs" style="left:960px;top:400px;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.9),rgba(78,205,196,.35) 40%,transparent 70%)"></div>`);
  tl.fromTo(flash, { scale: 0, autoAlpha: 1 }, { scale: 55, autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, tLogo);
  c.cue('impact', tLogo - 0.05, 0.8); c.cue('shimmer', tLogo, 0.6);
  const logo = c.add(`<div class="abs" style="left:460px;top:230px;width:1000px">
    <img src="${ASSET}img/iskonnect_wordmark.png" style="width:100%;display:block;filter:drop-shadow(0 0 60px rgba(78,205,196,.4))">
    <div class="sw" style="position:absolute;inset:0;-webkit-mask-image:url(${ASSET}img/iskonnect_wordmark.png);-webkit-mask-size:100% 100%;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.85) 50%,transparent 60%);background-size:250% 100%;background-repeat:no-repeat"></div></div>`);
  tl.fromTo(logo, { autoAlpha: 0, scale: 0.88, filter: 'blur(14px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'expo.out' }, tLogo);
  tl.fromTo(logo.querySelector('.sw'), { backgroundPosition: '130% 0' }, { backgroundPosition: '-30% 0', duration: 1.8, ease: 'power2.inOut' }, tLogo + 0.6);
  const tag = c.add(`<div class="abs" style="top:560px;width:100%;text-align:center;font:700 58px/1.2 var(--head)"><span class="t1">Connecting Scholars.</span> <span class="t2 lime">Empowering Education.</span></div>`);
  inn(tl, tag.querySelector('.t1'), c.at(1, 0) - 0.1, { y: 24 });
  inn(tl, tag.querySelector('.t2'), c.word(1, 'empowering') - 0.1, { y: 24 });
  const foot = c.add(`<div class="abs" style="top:720px;width:100%;display:flex;justify-content:center;align-items:center;gap:34px">
    <img src="${ASSET}img/calapan_seal.png" style="width:118px">
    <div style="text-align:center"><div style="font:600 32px/1.3 var(--head);color:#dcebed">Mobile-Based Scholarship Management System</div>
      <div style="font:500 26px/1.4 var(--body);color:var(--mint);margin-top:6px">Calapan City Education Department</div></div>
    <img src="${ASSET}img/ced_seal.png" style="width:118px"></div>`);
  inn(tl, foot, c.end(1) + 0.6, { y: 24, d: 1.0 });
  const line = c.add(`<div class="abs" style="left:560px;top:690px;width:800px;height:2px;background:linear-gradient(90deg,transparent,rgba(78,205,196,.7),transparent)"></div>`);
  tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, c.end(1) + 0.3);
  c.cue('resolve', c.end(1) + 0.4, 0.8);
});
