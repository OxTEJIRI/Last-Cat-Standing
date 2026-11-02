// CMBG: Last Cat Standing. Screens, input, bots, combat, loot, hazards and HUD. Drawing helpers live in art.js.
const $ = id => document.getElementById(id);
const cv = $('game'), G = cv.getContext('2d');
const heroCv = $('hero'), HC = heroCv.getContext('2d');
const stageCv = $('stage'), SG = stageCv.getContext('2d');
let vw = innerWidth, vh = innerHeight, dpr = 1;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); vw = innerWidth; vh = innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  heroCv.width = Math.round(heroCv.clientWidth * dpr) || 1; heroCv.height = Math.round(heroCv.clientHeight * dpr) || 1;
}
addEventListener('resize', resize);

// ---------- sound (synthesized, no files) ----------
let AC = null, NB = null, muted = false;
try { muted = localStorage.getItem('lcs-muted') === '1'; } catch (e) {}
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f0, f1, dur, type, vol, delay) {
  const a = audio(); if (!a || muted) return;
  const t = a.currentTime + (delay || 0), o = a.createOscillator(), gn = a.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(gn).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, freq, type, delay) {
  const a = audio(); if (!a || muted) return;
  if (!NB) { NB = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = a.currentTime + (delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
  s.buffer = NB; f.type = type || 'highpass'; f.frequency.value = freq || 1000;
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(gn).connect(a.destination); s.start(t); s.stop(t + dur + .02);
}
const SFX = {
  swipe: () => noise(.08, .1, 2600),
  hit: () => { tone(220, 70, .12, 'square', .1); noise(.06, .1, 800, 'lowpass'); },
  hurt: () => { tone(520, 240, .18, 'sawtooth', .11); noise(.1, .12, 900, 'lowpass'); },
  kill: () => { tone(700, 1100, .08, 'square', .09); tone(1100, 500, .25, 'sawtooth', .07, .08); },
  meow: () => { tone(480, 880, .14, 'sawtooth', .06); tone(880, 420, .26, 'sawtooth', .06, .13); },
  pickup: () => { tone(660, 660, .07, 'square', .08); tone(990, 990, .1, 'square', .08, .07); },
  bad: () => tone(300, 90, .3, 'sawtooth', .13),
  boom: () => { tone(140, 40, .45, 'sine', .35); noise(.35, .22, 600, 'lowpass'); },
  tap: () => tone(300, 520, .06, 'square', .08),
  tear: () => noise(.32, .18, 1800),
  reveal: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, .14, 'square', .07, i * .08)),
  dash: () => noise(.15, .13, 1200, 'bandpass'),
  land: () => tone(160, 60, .2, 'sine', .3),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, .18, 'square', .08, i * .11)),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, f * .97, .22, 'sawtooth', .07, i * .16)),
  warn: () => tone(880, 880, .05, 'square', .03)
};
const sfx = n => { try { SFX[n](); } catch (e) {} };
function setMute(m) { muted = m; $('mute').textContent = m ? 'SOUND OFF' : 'SOUND ON'; try { localStorage.setItem('lcs-muted', m ? '1' : '0'); } catch (e) {} }
$('mute').onclick = e => { e.stopPropagation(); setMute(!muted); audio(); };
setMute(muted);

// ---------- world ----------
const WW = 2200, WH = 1400, ZC = [1100, 700];
const OBST = [
  { x: 380, y: 360, r: 46, k: 'crate' }, { x: 1820, y: 360, r: 46, k: 'crate' }, { x: 360, y: 1040, r: 46, k: 'crate' }, { x: 1840, y: 1040, r: 46, k: 'crate' },
  { x: 760, y: 520, r: 26, k: 'candle', c: RED, h: 90 }, { x: 1440, y: 520, r: 26, k: 'candle', c: LIME, h: 110 },
  { x: 760, y: 900, r: 26, k: 'candle', c: LIME, h: 80 }, { x: 1440, y: 900, r: 26, k: 'candle', c: RED, h: 100 }
];
const CYBER = ['visor', 'antenna', 'collar'];

// The arena floor never changes, so it is drawn once into an offscreen canvas.
const FLOOR = document.createElement('canvas');
function buildFloor() {
  FLOOR.width = WW; FLOOR.height = WH; useCtx(FLOOR.getContext('2d'));
  X.fillStyle = VOID; X.fillRect(0, 0, WW, WH);
  X.strokeStyle = 'rgba(61,242,255,.05)'; X.lineWidth = 1; X.beginPath();
  for (let x = 0; x <= WW; x += 40) { X.moveTo(x, 0); X.lineTo(x, WH); } for (let y = 0; y <= WH; y += 40) { X.moveTo(0, y); X.lineTo(WW, y); } X.stroke();
  X.strokeStyle = 'rgba(212,255,0,.07)'; X.lineWidth = 2; X.beginPath();
  for (let x = 0; x <= WW; x += 200) { X.moveTo(x, 0); X.lineTo(x, WH); } for (let y = 0; y <= WH; y += 200) { X.moveTo(0, y); X.lineTo(WW, y); } X.stroke();
  for (let x = 200; x < WW; x += 200) for (let y = 200; y < WH; y += 200) { X.fillStyle = 'rgba(212,255,0,.18)'; X.fillRect(x - 4, y - 1, 8, 2); X.fillRect(x - 1, y - 4, 2, 8); }
  const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(42);
  for (const [y0, dir] of [[52, 1], [WH - 52, -1]]) for (let x = 60; x < WW - 60; x += 14) {
    const bid = x < WW / 2, d = Math.abs(x - WW / 2) / (WW / 2), hgt = 8 + d * 60 * (.5 + r());
    X.fillStyle = bid ? 'rgba(212,255,0,.16)' : 'rgba(255,46,77,.16)'; X.fillRect(x, dir > 0 ? y0 : y0 - hgt, 10, hgt);
  }
  X.font = `700 13px ${MF}`; X.fillStyle = 'rgba(61,242,255,.4)'; X.textAlign = 'left'; X.textBaseline = 'middle';
  X.fillText('BIDS', 70, 40); X.fillText('TRENCHES-01  //  ROBINHOOD CHAIN', 70, WH - 30); X.textAlign = 'right'; X.fillText('ASKS', WW - 70, 40);
  X.save(); X.globalAlpha = .045; X.font = `360px ${DF}`; X.fillStyle = LIME; X.textAlign = 'center'; X.fillText('$CMBG', ZC[0], ZC[1] + 10); X.restore();
  X.lineWidth = 6; X.strokeStyle = 'rgba(212,255,0,.8)'; X.strokeRect(6, 6, WW - 12, WH - 12);
  X.lineWidth = 2; X.strokeStyle = 'rgba(61,242,255,.35)'; X.strokeRect(22, 22, WW - 44, WH - 44);
  X.strokeStyle = LIME; X.lineWidth = 10; const L = 90;
  for (const [cx, cy, dx, dy] of [[6, 6, 1, 1], [WW - 6, 6, -1, 1], [6, WH - 6, 1, -1], [WW - 6, WH - 6, -1, -1]]) { X.beginPath(); X.moveTo(cx + dx * L, cy); X.lineTo(cx, cy); X.lineTo(cx, cy + dy * L); X.stroke(); }
}
buildFloor();
document.fonts.ready.then(buildFloor);

// The live $CMBG chart projected on the floor. Player kills print green candles, red-candle strikes print red ones.
function newChart() {
  const cs = []; let p = 1;
  for (let i = 0; i < 26; i++) { const o = p; p *= 1 + (Math.random() - .5) * .05; cs.push({ o, c: p, h: Math.max(o, p) * (1 + Math.random() * .015), l: Math.min(o, p) * (1 - Math.random() * .015) }); }
  return { cs, t: 0, push: 0, start: p, last: p };
}
function chartTick(ch) {
  const prev = ch.cs[ch.cs.length - 1].c, d = (Math.random() - .5) * .035 + ch.push, c = prev * (1 + d);
  ch.cs.push({ o: prev, c, h: Math.max(prev, c) * (1 + Math.random() * .012), l: Math.min(prev, c) * (1 - Math.random() * .012) });
  if (ch.cs.length > 26) ch.cs.shift();
  ch.push = 0; ch.t = 0; ch.last = c;
}
function chartPump(ch, amt) { ch.push += amt; if (ch.t > .25) chartTick(ch); }
function drawChart(ch, x0, y0, w, h, alpha, labels) {
  const n = ch.cs.length; let lo = Infinity, hi = -Infinity;
  for (const k of ch.cs) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); }
  const pad = (hi - lo) * .12 || .01, py = v => y0 + h - (v - lo + pad) / (hi - lo + pad * 2) * h, cw = w / n;
  X.save(); X.globalAlpha *= alpha;
  ch.cs.forEach((k, i) => {
    const up = k.c >= k.o, x = x0 + i * cw + cw / 2, col = up ? LIME : RED;
    X.strokeStyle = col; X.lineWidth = 3; X.beginPath(); X.moveTo(x, py(k.h)); X.lineTo(x, py(k.l)); X.stroke();
    const top = py(Math.max(k.o, k.c)), bh = Math.max(4, Math.abs(py(k.o) - py(k.c)));
    X.globalAlpha *= .7; X.fillStyle = col; X.fillRect(x - cw * .3, top, cw * .6, bh); X.globalAlpha /= .7;
  });
  X.globalAlpha *= 1.6; X.strokeStyle = CYAN; X.lineWidth = 3; X.beginPath();
  ch.cs.forEach((k, i) => { const x = x0 + i * cw + cw / 2; i ? X.lineTo(x, py(k.c)) : X.moveTo(x, py(k.c)); }); X.stroke();
  const lx = x0 + (n - .5) * cw, ly = py(ch.last);
  X.fillStyle = CYAN; X.beginPath(); X.arc(lx, ly, 8, 0, TAU); X.fill();
  if (labels) { const pct = (ch.last / ch.start - 1) * 100; X.font = `700 ${labels}px ${MF}`; X.textAlign = 'left'; X.textBaseline = 'middle'; X.fillStyle = pct >= 0 ? LIME : RED; X.fillText(`$CMBG ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, lx + 16, ly); }
  X.restore();
}
const RUG_SPOTS = [[560, 700], [1640, 700], [1100, 420], [1100, 980]];
const BOT_NAMES = ['PAPER PAWS', 'JEET KITTY', 'SER WHISKERS', 'EXIT LIQUIDITY', 'SIR FLOOFS', 'BAG HOLDER', 'MITTENS.ETH', 'RUG DOCTOR', 'DEV (ANON)', 'GAS FEE GARY', 'NGMI NOODLE', 'FUD FELINE', 'DIAMOND MITTS', 'TOP BUYER'];
const BOT_SKINS = ['gray', 'tux', 'ginger', 'calico', 'black', 'siamese', 'lilac', 'brown', 'smoke'];
const FIGHTERS = {
  common: { skin: 'street', weapon: 'claw', speed: 300, dmg: 1, cd: .55, range: 92, kb: 120 },
  rare: { skin: 'boss', weapon: 'heavy', speed: 250, dmg: 2, cd: 1, range: 98, kb: 330 },
  legendary: { skin: 'royal', weapon: 'fish', speed: 280, dmg: 1, cd: .7, range: 108, kb: 170, cleave: true }
};
const DESC = {
  common: 'Street Cat: fast and scrappy, with the quickest swipes. Ultimate: Nine-Tail Rush, three dashes that hit for 2.',
  rare: 'Alley Boss: slow and tanky, every hit does 2 and knocks cats back. Ultimate: Ground Pound, a slam that stuns everyone nearby.',
  legendary: 'Chain Royalty: a plasma fishbone blade that hits every cat in reach. Ultimate: Blade Storm, a spinning wall of blades.'
};
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const blocked = (x, y, m) => OBST.some(o => Math.hypot(o.x - x, o.y - y) < o.r + m);
const scl = c => c.player ? 1.35 : 1.22;
const zoneR = ft => lerp(1000, 110, ss((ft - 8) / 82));

let screen = 'menu', g = null, rarity = 'common', pk = null;
const keys = {}, joy = { id: null, active: false, ox: 0, oy: 0, x: 0, y: 0 };
let touchMode = false;

function makeCat(o) {
  return Object.assign({ x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, face: 1, faceT: 0, alive: true, landed: false, atk: 0, swing: -1, hurt: -1, inv: 0, item: null,
    spdUntil: 0, dmgUntil: 0, stun: 0, zt: 0, lastBy: null, lastByT: -9, kills: 0, walk: 0, seed: Math.random() * 9, dash: null, dashReady: 0, moving: false,
    ai: { s: 'wander', tx: ZC[0], ty: ZC[1], until: 0, next: 0, tgt: null } }, o);
}

function newGame(r) {
  const F = FIGHTERS[r];
  const p = makeCat({ player: true, name: 'YOU', kind: r, skin: F.skin, weapon: F.weapon, speed: F.speed, dmg: F.dmg, cd: F.cd, range: F.range, kb: F.kb, cleave: !!F.cleave, lives: 9, max: 9,
    ult: 0, ulting: null, streak: 0, lastKillT: -9, trail: [] });
  const names = shuffle(BOT_NAMES.slice()).slice(0, 9), skins = shuffle(BOT_SKINS.slice()), cats = [p], spots = [];
  for (let i = 0; i < 9; i++) {
    const n = names[i], acc = n === 'DEV (ANON)' ? ['shades', 'antenna'] : n === 'SER WHISKERS' ? ['monocle', 'collar'] : Math.random() < .75 ? [CYBER[i % 3]] : [];
    const c = makeCat({ name: n, skin: skins[i], acc, weapon: 'claw', speed: 195 + Math.random() * 40, dmg: 1, cd: 1.3 + Math.random() * .4, range: 86, kb: 150, lives: 8, max: 8,
      aggro: 260 + Math.random() * 200, dodge: Math.random() < .6, dropAt: 1.5 + Math.random() * 1.1 });
    let s, tries = 0;
    do { const a = Math.random() * TAU, rr = 200 + Math.random() * 640; s = [ZC[0] + Math.cos(a) * rr * 1.35, ZC[1] + Math.sin(a) * rr * .85]; tries++; }
    while (tries < 80 && (spots.some(q => Math.hypot(q[0] - s[0], q[1] - s[1]) < 230) || blocked(s[0], s[1], 70) || Math.hypot(s[0] - ZC[0], s[1] - ZC[1]) < 200));
    spots.push(s); c.x = s[0]; c.y = s[1]; cats.push(c);
  }
  p.x = ZC[0]; p.y = ZC[1] + 40;
  g = { t: 0, ft: 0, phase: 'drop', cats, p, ret: [p.x, p.y], loot: [], hz: [], proj: [], parts: [], pops: [], ghosts: [], feed: [], laser: null, trail: [],
    slams: [{ s: '3', t0: .1, dur: .7 }, { s: '2', t0: .9, dur: .7 }, { s: '1', t0: 1.7, dur: .7 }],
    zr: 1000, cam: { x: p.x, y: p.y, z: null }, sh: { t0: -9, d: 1, a: 0 }, nextCandle: 6, nextRug: 10, nextLoot: 6,
    rugs: RUG_SPOTS.map(([x, y]) => ({ x, y, w: 230, h: 130, st: 'idle', t0: 0 })), endAt: null, result: null, place: null, cause: '',
    chart: newChart(), hs: 0, firstBlood: false, flash: 0 };
  for (let i = 0; i < 4; i++) spawnLoot();
}

// ---------- effects ----------
const slam = (s, c, dur) => g.slams.push({ s, c, t0: g.t, dur: dur || .9 });
const pop = (x, y, s, c, size) => g.pops.push({ x, y, s, c, size, t0: g.t });
const part = o => g.parts.push(Object.assign({ age: 0, g: 0, life: .6, r: 6, kind: 'dot' }, o));
const ring = (x, y, c, R, life, w) => part({ x, y, vx: 0, vy: 0, life, R, w, c, kind: 'ring' });
function fur(x, y, skin, n) { const f = FURS[skin]; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 120 + Math.random() * 220; part({ x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 500, life: .4 + Math.random() * .3, r: 4 + Math.random() * 5, c: i % 2 ? f.fur : f.fur2 }); } }
function poof(x, y, skin) { fur(x, y, skin, 26); ring(x, y, '#fff', 120, .35, 6); }
function dust(x, y, n) { for (let i = 0; i < n; i++) { const a = i / n * TAU, v = 140 + Math.random() * 120; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .4, life: .45 + Math.random() * .2, r: 6 + Math.random() * 6, c: 'rgba(200,200,200,.55)' }); } }
function burst(x, y, c) { for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, v = 200 + Math.random() * 250; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .5, r: 9, c, kind: 'star' }); } }
function yarnBoom(x, y) {
  if (onScreen(x, y)) { shake(.25, 14); sfx('boom'); }
  ring(x, y, PINK, 160, .5, 12); ring(x, y, '#fff', 110, .3, 6);
  for (let i = 0; i < 20; i++) { const a = Math.random() * TAU, v = 200 + Math.random() * 360; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, life: .7, r: 18, c: i % 2 ? PINK : '#ff5fa0', kind: 'strand', rot: Math.random() * 6 }); }
}
function shake(d, a) { g.sh = { t0: g.t, d, a }; }
function shakeOff() { const u = (g.t - g.sh.t0) / g.sh.d; if (u < 0 || u > 1) return [0, 0]; const k = g.sh.a * (1 - u); return [(Math.random() - .5) * 2 * k, (Math.random() - .5) * 2 * k]; }
function onScreen(x, y) { const z = g.cam.z || 1; return Math.abs(x - g.cam.x) < vw / 2 / z + 80 && Math.abs(y - g.cam.y) < vh / 2 / z + 80; }
function stepFX(dt) {
  for (const p of g.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= .97; }
  g.parts = g.parts.filter(p => p.age < p.life); g.pops = g.pops.filter(p => g.t - p.t0 < 1); g.ghosts = g.ghosts.filter(q => g.t - q.t0 < 1.7);
}

// ---------- combat ----------
function hit(t, d, src, cause, kb, force) {
  if (!t.alive || (t.inv > 0 && !force) || (t.player && g.result === 'win')) return;
  t.lives = Math.max(0, t.lives - d); t.hurt = 0; t.inv = t.player ? 1 : .35;
  if (src) { t.lastBy = src; t.lastByT = g.t; }
  if (src && kb) { const dx = t.x - src.x, dy = t.y - src.y, m = Math.hypot(dx, dy) || 1; t.kx += dx / m * kb * 1.6; t.ky += dy / m * kb * 1.6; }
  pop(t.x + (Math.random() - .5) * 30, t.y - 95, '-' + d, t.player ? RED : '#fff', t.player ? 42 : 30);
  fur(t.x, t.y, t.skin, 7);
  if (t.player) { shake(.2, 12); sfx('hurt'); } else if (src && src.player) sfx('hit');
  if (src && src.player) { g.hs = Math.max(g.hs, .045); if (!src.ulting) src.ult = Math.min(1, src.ult + d * .06); }
  if (t.player) { g.hs = Math.max(g.hs, .06); g.flash = .25; chartPump(g.chart, -.012); }
  if (t.lives <= 0) kill(t, src, cause);
}
function kill(t, src, cause) {
  t.alive = false; poof(t.x, t.y, t.skin); g.ghosts.push({ x: t.x, y: t.y, s: scl(t), t0: g.t });
  if (src) { src.kills++; g.feed.push({ t: g.t, a: src.player ? 'YOU' : src.name, v: 'scratched out', b: t.player ? 'YOU' : t.name }); }
  else g.feed.push({ t: g.t, a: t.player ? 'YOU' : t.name, v: cause, b: '' });
  if (src && src.player) {
    pop(t.x, t.y - 135, 'SCRATCHED OUT', '#fff', 36); sfx('kill'); g.hs = .1; src.ult = Math.min(1, src.ult + .12);
    src.streak = g.t - src.lastKillT < 4 ? src.streak + 1 : 1; src.lastKillT = g.t;
    const call = !g.firstBlood ? 'FIRST BLOOD' : ['', '', 'DOUBLE SCRATCH', 'TRIPLE SCRATCH'][src.streak] || (src.streak > 3 ? 'MEGA SCRATCH' : '');
    if (call) slam(call, src.streak > 2 ? GOLD : LIME, 1.1);
    chartPump(g.chart, .05 + src.streak * .02); pop(t.x, t.y - 175, `$CMBG +${(5 + src.streak * 2)}%`, LIME, 26);
  }
  else if (!t.player && onScreen(t.x, t.y)) sfx('meow');
  g.firstBlood = true;
  const left = g.cats.filter(c => c.alive).length;
  if (t.player) { g.place = left + 1; g.cause = src ? `were scratched out by ${src.name}` : cause; endRound('lose'); }
  else if (left === 1 && g.p.alive) { g.place = 1; endRound('win'); }
}
function endRound(r) {
  if (g.result) return;
  g.result = r; g.endAt = g.t + (r === 'win' ? 1.6 : 1.8);
  if (r === 'win') { slam('LAST CAT STANDING.', GOLD, 1.6); sfx('win'); } else { slam('SCRATCHED OUT.', RED, 1.6); sfx('lose'); }
}
function tryAttack(c, force) {
  if ((c.atk > 0 && !force) || c.stun > 0) return;
  let best = null, bd = 1e9; const foes = [];
  const pool = c.player ? g.cats : [c.ai.s === 'fight' ? c.ai.tgt : null, g.t - c.lastByT < 2.5 ? c.lastBy : null].filter(Boolean);
  for (const o of pool) {
    if (o === c || !o.alive || !o.landed) continue;
    const d = Math.hypot(o.x - c.x, o.y - c.y);
    if (d < c.range + (force ? 30 : 0)) { foes.push(o); if (d < bd) { bd = d; best = o; } }
  }
  if (!best) return;
  c.face = Math.sign(best.x - c.x) || c.face; c.faceT = .3; c.swing = 0; c.atk = c.cd;
  if (c.player || onScreen(c.x, c.y)) sfx('swipe');
  const dmg = c.dmg * (g.t < c.dmgUntil ? 2 : 1);
  for (const o of (c.cleave ? foes : [best])) hit(o, dmg, c, null, c.kb);
}
function throwYarn(c, tx, ty) {
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  if (d > 480) { tx = c.x + dx / d * 480; ty = c.y + dy / d * 480; }
  g.proj.push({ x0: c.x, y0: c.y - 20, x1: tx, y1: ty, t: 0, owner: c });
  if (c.player || onScreen(c.x, c.y)) sfx('swipe');
}
function closestFoe(c, max) {
  let best = null, bd = max;
  for (const o of g.cats) { if (o === c || !o.alive) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function special() {
  if (screen !== 'game' || !g || g.phase !== 'fight' || !g.p.alive || g.result) return;
  const p = g.p;
  if (p.item === 'yarn') { const f = closestFoe(p, 480); throwYarn(p, f ? f.x : p.x + p.face * 300, f ? f.y : p.y); p.item = null; }
  else if (p.item === 'laser') { g.laser = { x: p.x + p.face * 70, y: p.y, an: Math.random() * TAU, until: g.t + 4.5, owner: p }; p.item = null; pop(p.x, p.y - 140, 'BOTS GO FERAL', RED, 40); sfx('pickup'); }
  else if (g.t >= p.dashReady) {
    const v = inputVec(); let dx = v[0], dy = v[1]; if (!dx && !dy) { dx = p.face; dy = 0; }
    const m = Math.hypot(dx, dy); p.dash = { t: 0, dx: dx / m, dy: dy / m }; p.dashReady = g.t + 2; p.inv = .25; sfx('dash');
  }
}

const ULT_NAMES = { common: 'NINE-TAIL RUSH', rare: 'GROUND POUND', legendary: 'BLADE STORM' };
function ultimate() {
  if (screen !== 'game' || !g || g.phase !== 'fight' || !g.p.alive || g.result) return;
  const p = g.p; if (p.ult < 1 || p.ulting) return;
  p.ult = 0; p.ulting = { k: p.kind, t: 0, n: 0, next: 0 }; p.inv = Math.max(p.inv, .3); p.dash = null;
  slam(ULT_NAMES[p.kind], CYAN, 1); sfx('reveal'); g.flash = .2;
}
// Runs the active ultimate. Returns true while it takes over the player's movement.
function updateUlt(p, dt) {
  const u = p.ulting; u.t += dt; p.inv = Math.max(p.inv, .15);
  if (u.k === 'common') {
    if (!u.dash && u.n < 3 && u.t >= u.next) {
      const f = closestFoe(p, 560); if (!f) { p.ulting = null; return false; }
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
      u.dash = { dx: dx / d, dy: dy / d, left: Math.max(.05, (d - 50) / 1600), tgt: f }; sfx('dash');
    }
    if (u.dash) {
      const s = Math.min(u.dash.left, dt); p.x += u.dash.dx * 1600 * s; p.y += u.dash.dy * 1600 * s; u.dash.left -= dt;
      p.face = Math.sign(u.dash.dx) || p.face; p.trail.push({ x: p.x, y: p.y, t: g.t });
      if (u.dash.left <= 0) { p.swing = 0; if (u.dash.tgt.alive) hit(u.dash.tgt, 2, p, null, 280, true); ring(p.x, p.y, LIME, 120, .3, 6); u.dash = null; u.n++; u.next = u.t + .12; }
    }
    if (u.n >= 3 && !u.dash) p.ulting = null;
    return true;
  }
  if (u.k === 'rare') {
    if (u.t >= .4 && !u.done) {
      u.done = true; shake(.45, 24); sfx('boom'); g.hs = .12;
      ring(p.x, p.y + 30, GOLD, 260, .5, 14); ring(p.x, p.y + 30, CYAN, 200, .4, 6); dust(p.x, p.y + 30, 30);
      for (const c of g.cats) if (c !== p && c.alive && c.landed && Math.hypot(c.x - p.x, c.y - p.y) < 240) { hit(c, 3, p, null, 420, true); c.stun = .9; }
    }
    if (u.t >= .55) p.ulting = null;
    return true;
  }
  if (u.t >= u.next) { u.next = u.t + .2; sfx('swipe'); for (const c of g.cats) if (c !== p && c.alive && c.landed && Math.hypot(c.x - p.x, c.y - p.y) < 150) hit(c, 1, p, null, 160, true); }
  if (u.t >= 1.6) p.ulting = null;
  return false;
}

// ---------- bots ----------
function nearestFoe(c) {
  let best = null;
  for (const o of g.cats) { if (o === c || !o.alive) continue; const d = Math.hypot(o.x - c.x, o.y - c.y), w = o.player ? d * 1.25 : d; if (!best || w < best.w) best = { c: o, d, w }; }
  return best;
}
function nearestLoot(c) {
  let best = null;
  for (const l of g.loot) { if (l.k === 'laser' || (l.k === 'yarn' && c.item)) continue; const d = Math.hypot(l.x - c.x, l.y - c.y); if (!best || d < best.d) best = { o: l, d }; }
  return best;
}
function think(c) {
  const a = c.ai; a.next = g.t + .18 + Math.random() * .15;
  if (g.laser && g.laser.owner !== c && Math.hypot(g.laser.x - c.x, g.laser.y - c.y) < 700) { a.s = 'laser'; return; }
  for (const h of g.hz) if (h.k === 'candle' && g.t - h.t0 < 1 && c.dodge && Math.hypot(h.x - c.x, h.y - c.y - 30) < 120) { a.s = 'go'; a.tx = c.x + (c.x - h.x) * 2.2 + 1; a.ty = c.y + (c.y + 30 - h.y) * 2.2; return; }
  if (Math.hypot(c.x - ZC[0], c.y - ZC[1]) > g.zr - 80) { a.s = 'go'; a.tx = ZC[0] + (Math.random() - .5) * 140; a.ty = ZC[1] + (Math.random() - .5) * 140; return; }
  const f = nearestFoe(c);
  if (c.lastBy && c.lastBy.alive && g.t - c.lastByT < 2.5 && c.lives > 2 && Math.hypot(c.lastBy.x - c.x, c.lastBy.y - c.y) < 300) { a.s = 'fight'; a.tgt = c.lastBy; return; }
  if (c.lives <= 2 && f && f.d < 260) { a.s = 'go'; a.tx = lerp(c.x - (f.c.x - c.x) * 1.5, ZC[0], .3); a.ty = lerp(c.y - (f.c.y - c.y) * 1.5, ZC[1], .3); return; }
  if (c.item === 'yarn' && f && f.d < 420 && f.d > 110) { throwYarn(c, f.c.x, f.c.y); c.item = null; }
  const l = nearestLoot(c);
  if (l && l.d < (g.ft < 15 ? 800 : 420) && (!f || f.d > 220)) { a.s = 'go'; a.tx = l.o.x; a.ty = l.o.y; return; }
  if (f && f.d < c.aggro * (g.ft < 20 ? .45 : 1)) {
    let tgt = f.c;
    if (tgt.player && a.tgt !== tgt && g.cats.filter(o => o.alive && o !== c && o.ai.s === 'fight' && o.ai.tgt === tgt).length >= 2) {
      const alt = g.cats.filter(o => o.alive && o !== c && !o.player).sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y))[0];
      if (alt) tgt = alt;
    }
    a.s = 'fight'; a.tgt = tgt; return;
  }
  if (a.s !== 'wander' || Math.hypot(a.tx - c.x, a.ty - c.y) < 50 || g.t > a.until) {
    const an = Math.random() * TAU, rr = g.zr * (.25 + Math.random() * .45);
    a.tx = ZC[0] + Math.cos(an) * rr; a.ty = ZC[1] + Math.sin(an) * rr; a.until = g.t + 2.5 + Math.random() * 3; a.s = 'wander';
  }
}
function botDir(c) {
  const a = c.ai; if (g.t >= a.next) think(c);
  let tx, ty, sp = 1;
  if (a.s === 'laser' && g.laser) { tx = g.laser.x + Math.sin(c.seed) * 40; ty = g.laser.y + Math.cos(c.seed) * 40; sp = 1.15; }
  else if (a.s === 'fight' && a.tgt && a.tgt.alive) {
    const d = Math.hypot(a.tgt.x - c.x, a.tgt.y - c.y);
    if (d < c.range * .75) { const nx = (a.tgt.x - c.x) / d, ny = (a.tgt.y - c.y) / d, w = Math.sin(c.seed + g.t * .7) * .5; return [-ny * w, nx * w, .6]; }
    tx = a.tgt.x; ty = a.tgt.y;
  } else if (a.s === 'laser' || a.s === 'fight') { a.s = 'wander'; a.next = 0; return [0, 0, 0]; }
  else { tx = a.tx; ty = a.ty; sp = a.s === 'wander' ? .6 : 1; }
  const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
  return d < 14 ? [0, 0, 0] : [dx / d, dy / d, sp];
}

// ---------- loot, hazards, laser ----------
function spawnLoot() {
  if (g.loot.length >= 6) return;
  const r = Math.random() * 100, k = r < 30 ? 'yarn' : r < 52 ? 'catnip' : r < 66 ? 'laser' : 'ca';
  for (let i = 0; i < 40; i++) {
    const an = Math.random() * TAU, rr = Math.random() * g.zr * .8, x = ZC[0] + Math.cos(an) * rr * 1.2, y = ZC[1] + Math.sin(an) * rr * .75;
    if (x < 100 || x > WW - 100 || y < 130 || y > WH - 100 || blocked(x, y, 80) || g.loot.some(l => Math.hypot(l.x - x, l.y - y) < 150)) continue;
    g.loot.push({ k, x, y, t0: g.t }); return;
  }
}
function pickups() {
  for (const c of g.cats) {
    if (!c.alive || !c.landed) continue;
    for (let i = g.loot.length - 1; i >= 0; i--) {
      const l = g.loot[i]; if (Math.hypot(l.x - c.x, l.y - c.y) > 52) continue;
      if ((l.k === 'yarn' || l.k === 'laser') && (c.item || (!c.player && l.k === 'laser'))) continue;
      g.loot.splice(i, 1);
      const say = (s, col) => { if (c.player || onScreen(c.x, c.y)) pop(c.x, c.y - 140, s, col, c.player ? 38 : 28); };
      if (l.k === 'catnip') { c.lives = Math.min(c.max, c.lives + 2); c.spdUntil = g.t + 4; say('+2 LIVES · ZOOMIES', GREEN); if (c.player) sfx('pickup'); }
      else if (l.k === 'ca') {
        if (Math.random() < .5) { c.dmgUntil = g.t + 8; say('REAL CA! 2X DAMAGE', GOLD); burst(l.x, l.y, GOLD); if (c.player) sfx('pickup'); }
        else { g.hz.push({ k: 'bite', x: l.x, y: l.y, t0: g.t }); say('FAKE CA BITES!', RED); if (c.player) sfx('bad'); hit(c, 2, null, 'aped a FAKE CA', 0, true); }
      } else { c.item = l.k; say(l.k === 'yarn' ? '+ YARN BOMB' : '+ LASER POINTER', l.k === 'yarn' ? PINK : RED); if (c.player) sfx('pickup'); }
    }
  }
}
function spawnCandle() {
  const al = g.cats.filter(c => c.alive && c.landed), r = Math.random(); let x, y;
  if (r < .25 && g.p.alive) { x = g.p.x; y = g.p.y; }
  else if (r < .75 && al.length) { const c = al[Math.floor(Math.random() * al.length)]; x = c.x; y = c.y; }
  else { const an = Math.random() * TAU, rr = Math.random() * g.zr * .7; x = ZC[0] + Math.cos(an) * rr; y = ZC[1] + Math.sin(an) * rr; }
  g.hz.push({ k: 'candle', x: x + (Math.random() - .5) * 70, y: y + 30 + (Math.random() - .5) * 50, t0: g.t, ph: 'warn', b: -1 });
}
function updateHazards() {
  if (g.ft >= g.nextCandle && !g.result) { spawnCandle(); g.nextCandle = g.ft + lerp(5.5, 2.8, clamp(g.ft / 80, 0, 1)) + Math.random() * 2; }
  for (const h of g.hz) {
    if (h.k !== 'candle') continue;
    const a = g.t - h.t0;
    if (h.ph === 'warn') { const b = Math.floor(a * 6); if (b !== h.b) { h.b = b; if (onScreen(h.x, h.y)) sfx('warn'); } if (a >= 1) h.ph = 'fall'; }
    else if (h.ph === 'fall' && a >= 1.22) {
      h.ph = 'stuck';
      if (onScreen(h.x, h.y)) { shake(.35, 18); sfx('boom'); }
      dust(h.x, h.y, 26); ring(h.x, h.y, RED, 180, .5, 10); chartPump(g.chart, -.06);
      for (const c of g.cats) if (c.alive && c.landed && Math.hypot(c.x - h.x, c.y + 30 - h.y) < 95) { hit(c, 2, null, 'got liquidated by a red candle', 0, true); if (c.alive) { c.kx += (c.x - h.x) * 6; c.ky += (c.y - h.y) * 6; } }
    }
  }
  g.hz = g.hz.filter(h => g.t - h.t0 < (h.k === 'candle' ? 2.6 : .6));
}
const onRug = (c, r) => Math.abs(c.x - r.x) < r.w / 2 && Math.abs(c.y + 28 - r.y) < r.h / 2;
function updateRugs() {
  if (g.ft >= g.nextRug && !g.result) {
    const idle = g.rugs.filter(r => r.st === 'idle');
    if (idle.length) {
      const cnt = r => g.cats.filter(c => c.alive && onRug(c, r)).length;
      idle.sort((a, b) => cnt(b) - cnt(a));
      const r = Math.random() < .7 ? idle[0] : idle[Math.floor(Math.random() * idle.length)]; r.st = 'warn'; r.t0 = g.t;
    }
    g.nextRug = g.ft + 7 + Math.random() * 5;
  }
  for (const r of g.rugs) {
    const a = g.t - r.t0;
    if (r.st === 'warn' && a >= .9) {
      r.st = 'pull'; r.t0 = g.t; if (onScreen(r.x, r.y)) sfx('tear');
      for (const c of g.cats) if (c.alive && c.landed && onRug(c, r)) { c.stun = .9; pop(c.x, c.y - 150, 'RUGGED!', RED, c.player ? 40 : 30); hit(c, 1, null, 'got rugged', 0, true); }
    } else if (r.st === 'pull' && a >= .45) { r.st = 'gone'; r.t0 = g.t; }
    else if (r.st === 'gone' && a >= 6) { r.st = 'back'; r.t0 = g.t; }
    else if (r.st === 'back' && a >= .5) r.st = 'idle';
  }
}
function updateLaser(dt) {
  const L = g.laser; if (!L) return;
  if (g.t > L.until) { g.laser = null; g.trail = []; return; }
  L.an += (Math.random() - .5) * dt * 9;
  if (Math.hypot(L.x - ZC[0], L.y - ZC[1]) > g.zr * 1.05) L.an = Math.atan2(ZC[1] - L.y, ZC[0] - L.x);
  L.x = clamp(L.x + Math.cos(L.an) * 360 * dt, 80, WW - 80); L.y = clamp(L.y + Math.sin(L.an) * 360 * dt, 110, WH - 80);
  g.trail.unshift([L.x, L.y]); g.trail.length = Math.min(g.trail.length, 6);
}
function updateProj(dt) {
  for (const p of g.proj) {
    p.t += dt / .5;
    if (p.t >= 1 && !p.done) {
      p.done = true; yarnBoom(p.x1, p.y1);
      for (const c of g.cats) if (c.alive && c !== p.owner && c.landed && Math.hypot(c.x - p.x1, c.y - p.y1) < 140) hit(c, 2, p.owner.alive ? p.owner : null, 'got yarn bombed', 300, true);
    }
  }
  g.proj = g.proj.filter(p => !p.done);
}

// ---------- update ----------
function inputVec() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x--; if (keys.KeyD || keys.ArrowRight) x++;
  if (keys.KeyW || keys.ArrowUp) y--; if (keys.KeyS || keys.ArrowDown) y++;
  if (joy.active) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, m = Math.hypot(dx, dy), R = 56 * uiK(); if (m > 8) { x = dx / m * Math.min(1, m / R); y = dy / m * Math.min(1, m / R); } }
  const m = Math.hypot(x, y); return m > 1 ? [x / m, y / m] : [x, y];
}
function updateCat(c, dt) {
  c.atk = Math.max(0, c.atk - dt); c.inv = Math.max(0, c.inv - dt); c.stun = Math.max(0, c.stun - dt); c.faceT -= dt;
  if (c.swing >= 0) { c.swing += dt / .28; if (c.swing >= 1) c.swing = -1; }
  if (c.hurt >= 0) { c.hurt += dt; if (c.hurt > .12) c.hurt = -1; }
  if (c.ulting && updateUlt(c, dt)) { c.vx = c.vy = 0; c.moving = false; collide(c); return; }
  let dx = 0, dy = 0, sp = c.speed * (g.t < c.spdUntil ? 1.4 : 1) * (c.ulting ? 1.3 : 1);
  if (c.player) { if (!g.result) [dx, dy] = inputVec(); }
  else { const d = botDir(c); dx = d[0]; dy = d[1]; sp *= d[2]; }
  if (c.dash) { c.dash.t += dt; dx = c.dash.dx; dy = c.dash.dy; sp = 1250; if (c.dash.t >= .16) { c.dash = null; tryAttack(c, true); } }
  if (c.stun > 0) dx = dy = 0;
  c.vx = dx * sp; c.vy = dy * sp;
  c.x += (c.vx + c.kx) * dt; c.y += (c.vy + c.ky) * dt;
  const dec = Math.exp(-dt * 9); c.kx *= dec; c.ky *= dec;
  if (Math.abs(dx) > .15 && c.faceT <= 0) c.face = Math.sign(dx);
  c.moving = Math.hypot(c.vx, c.vy) > 30; if (c.moving) c.walk += dt * 15;
  if (c.dash) c.trail.push({ x: c.x, y: c.y, t: g.t });
  collide(c);
  if (Math.hypot(c.x - ZC[0], c.y - ZC[1]) > g.zr) { c.zt += dt; if (c.zt >= 1.1) { c.zt = 0; hit(c, 1, null, 'got liquidated by the zone', 0, true); } } else c.zt = 0;
  if (c.alive && !c.ulting && (c.player || c.ai.s !== 'laser')) tryAttack(c);
}
function collide(c) {
  for (const o of OBST) { const ox = c.x - o.x, oy = c.y - o.y, d = Math.hypot(ox, oy), m = o.r + 22; if (d < m && d > 0) { c.x = o.x + ox / d * m; c.y = o.y + oy / d * m; } }
  c.x = clamp(c.x, 60, WW - 60); c.y = clamp(c.y, 90, WH - 50);
}
function separate() {
  const al = g.cats.filter(c => c.alive && c.landed);
  for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
    const a = al[i], b = al[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 52 && d > 0) { const p = (52 - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p; }
  }
}
function updateDrop() {
  const p = g.p, T = g.t;
  if (T < 2.4) {
    const v = inputVec(), dt = Math.min(.05, T - (g.lastT || 0));
    g.ret[0] = clamp(g.ret[0] + v[0] * 560 * dt, ZC[0] - 780, ZC[0] + 780); g.ret[1] = clamp(g.ret[1] + v[1] * 560 * dt, ZC[1] - 480, ZC[1] + 480);
    for (const o of OBST) { const ox = g.ret[0] - o.x, oy = g.ret[1] - o.y, d = Math.hypot(ox, oy), m = o.r + 30; if (d < m && d > 0) { g.ret[0] = o.x + ox / d * m; g.ret[1] = o.y + oy / d * m; } }
    p.x = g.ret[0]; p.y = g.ret[1];
  }
  g.lastT = T;
  if (T >= 2.4 && !g.dropSaid) { g.dropSaid = true; slam('DROP!', LIME, .7); }
  for (const c of g.cats) {
    const landT = (c.player ? 2.4 : c.dropAt) + .85;
    if (!c.landed && T >= landT) {
      c.landed = true; dust(c.x, c.y + 36, c.player ? 26 : 12); ring(c.x, c.y + 36, CYAN, 130, .4, 5);
      for (const sx of [-1, 1]) part({ x: c.x + sx * 14, y: c.y - 10, vx: sx * (260 + Math.random() * 120), vy: -260, g: 1100, life: .65, r: 1, rot: 0, spin: sx * 9, kind: 'shell' });
      if (c.player) { ring(c.x, c.y + 36, LIME, 200, .6, 9); pop(c.x, c.y - 140, 'LANDED ON FEET', LIME, 40); shake(.25, 10); sfx('land'); }
    }
  }
  if (T >= 3.5) { g.phase = 'fight'; g.ft = 0; slam('SCRATCH.', LIME, .9); }
}
function update(dt) {
  g.flash = Math.max(0, g.flash - dt);
  if (g.hs > 0) { g.hs -= dt; return; }
  g.t += dt; stepFX(dt);
  g.chart.t += dt; if (g.chart.t >= 1.2) chartTick(g.chart);
  if (g.p.trail.length) g.p.trail = g.p.trail.filter(q => g.t - q.t < .25);
  if (g.phase === 'drop') { updateDrop(); updateCam(dt, .8); return; }
  g.ft += dt; g.zr = zoneR(g.ft);
  for (const c of g.cats) if (c.alive) updateCat(c, dt);
  separate(); pickups();
  if (g.ft >= g.nextLoot) { spawnLoot(); g.nextLoot = g.ft + 5 + Math.random() * 4; }
  updateHazards(); updateRugs(); updateLaser(dt); updateProj(dt);
  if (g.endAt != null && g.t >= g.endAt && screen === 'game') showEnd();
  updateCam(dt, 1);
}
const zoomBase = () => Math.min(vw / 640, vh / 760);
function updateCam(dt, zf) {
  const z = zoomBase() * zf, k = 1 - Math.exp(-dt * 6);
  g.cam.z = g.cam.z == null ? z : g.cam.z + (z - g.cam.z) * k;
  g.cam.x += (g.p.x - g.cam.x) * k; g.cam.y += (g.p.y - g.cam.y) * k;
  const hw = vw / 2 / g.cam.z, hh = vh / 2 / g.cam.z;
  g.cam.x = hw * 2 >= WW + 80 ? WW / 2 : clamp(g.cam.x, hw - 40, WW - hw + 40);
  g.cam.y = hh * 2 >= WH + 100 ? WH / 2 : clamp(g.cam.y, hh - 60, WH - hh + 40);
}

// ---------- render: world ----------
function drawZone() {
  const r = g.zr;
  G.save(); G.beginPath(); G.rect(-2000, -2000, WW + 4000, WH + 4000); G.arc(ZC[0], ZC[1], r, 0, TAU);
  G.fillStyle = 'rgba(255,46,77,.13)'; G.fill('evenodd'); G.clip('evenodd');
  G.strokeStyle = 'rgba(255,46,77,.13)'; G.lineWidth = 3; G.beginPath(); const o = (g.t * 40) % 48;
  for (let x = -WH - 120; x < WW + 120; x += 24) { G.moveTo(x + o, -60); G.lineTo(x + o + WH + 120, WH + 60); } G.stroke(); G.restore();
  G.save(); G.globalCompositeOperation = 'lighter';
  G.strokeStyle = 'rgba(255,46,77,.22)'; G.lineWidth = 28; G.beginPath(); G.arc(ZC[0], ZC[1], r, 0, TAU); G.stroke();
  G.strokeStyle = RED; G.lineWidth = 4; G.stroke();
  G.strokeStyle = 'rgba(61,242,255,.55)'; G.lineWidth = 2; G.setLineDash([4, 18]); G.lineDashOffset = -g.t * 60; G.beginPath(); G.arc(ZC[0], ZC[1], Math.max(10, r - 18), 0, TAU); G.stroke();
  G.restore();
  G.save(); G.translate(ZC[0] + r * Math.cos(-.55), ZC[1] + r * Math.sin(-.55)); G.rotate(-.55 + Math.PI / 2);
  G.font = `700 18px ${MF}`; G.fillStyle = RED; G.textAlign = 'center'; G.textBaseline = 'alphabetic'; G.fillText('liquidation price', 0, -22); G.restore();
}
function drawLoot(l) {
  const t = g.t, bob = Math.sin(t * 4 + l.x) * 6, c = l.k === 'ca' ? GOLD : l.k === 'laser' ? RED : l.k === 'catnip' ? GREEN : CYAN;
  G.save(); G.globalCompositeOperation = 'lighter'; G.fillStyle = c; G.globalAlpha = .12; G.fillRect(l.x - 14, l.y - 110, 28, 120); G.restore();
  lootBox(l.x, l.y, c, t);
  if (l.k === 'ca') { G.font = `700 20px ${MF}`; G.fillStyle = GOLD; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('CA', l.x, l.y + 6); G.font = `40px ${DF}`; G.fillText('?', l.x, l.y - 52 + bob); }
  else if (l.k === 'yarn') yarnBall(l.x, l.y - 50 + bob, 16, t);
  else if (l.k === 'catnip') catnip(l.x, l.y - 44 + bob, 22);
  else laserPen(l.x, l.y - 50 + bob, 20);
}
function drawCatEnt(c) {
  const s = scl(c);
  if (!c.landed) {
    const st = c.player ? 2.4 : c.dropAt, u = (g.t - st) / .85; if (u < 0) return;
    const k = eIn(u), y = c.y - 560 * (1 - k), gr = 1.4 - .4 * k;
    G.fillStyle = `rgba(0,0,0,${.15 + .35 * k})`; G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 30 * s * (.4 + .6 * k), 9 * s * (.4 + .6 * k), 0, 0, TAU); G.fill();
    G.strokeStyle = c.player ? LIME : 'rgba(255,46,77,.75)'; G.lineWidth = 2; G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 46 * s * gr, 15 * s * gr, 0, 0, TAU); G.stroke();
    G.save(); G.globalCompositeOperation = 'lighter'; G.strokeStyle = 'rgba(61,242,255,.3)'; G.lineWidth = 3;
    for (const dx of [-26, 0, 26]) { G.beginPath(); G.moveTo(c.x + dx, y - 260); G.lineTo(c.x + dx, y - 100); G.stroke(); } G.restore();
    pod(c.x, y, s * (1 + 1.6 * (1 - k)), g.t + c.seed, true);
    return;
  }
  if (c.trail) for (const q of c.trail) { G.save(); G.globalAlpha = .3 * (1 - (g.t - q.t) / .25); drawCat(q.x, q.y, s, { skin: c.skin, acc: c.acc, face: c.face, time: g.t, weapon: c.weapon, noShadow: true }); G.restore(); }
  const u = c.ulting;
  let mood = 'normal';
  if (c.swing >= 0 || u) mood = 'angry'; if (!c.player && c.ai.s === 'laser') mood = 'feral'; if (c.player && g.result === 'win') mood = 'smug';
  if (g.t < c.dmgUntil) { G.strokeStyle = GOLD; G.lineWidth = 4; G.globalAlpha = .5 + .3 * Math.sin(g.t * 12); G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 46 * s, 16 * s, 0, 0, TAU); G.stroke(); G.globalAlpha = 1; }
  if (g.t < c.spdUntil && c.moving) { G.fillStyle = 'rgba(34,196,107,.35)'; for (let i = 1; i <= 3; i++) { G.beginPath(); G.arc(c.x - c.vx * .03 * i, c.y + 20 - c.vy * .03 * i, 10 - i * 2, 0, TAU); G.fill(); } }
  let jy = 0; if (u && u.k === 'rare' && u.t < .4) { jy = Math.sin(u.t / .4 * Math.PI) * 140; G.fillStyle = 'rgba(0,0,0,.4)'; G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 30 * s, 9 * s, 0, 0, TAU); G.fill(); }
  const flick = c.player && c.inv > 0 && !c.dash && !u && Math.sin(g.t * 50) > 0;
  if (flick) G.globalAlpha = .55;
  drawCat(c.x, c.y - jy, s * (1 + jy / 1000), { skin: c.skin, acc: c.acc, face: c.face, moving: c.moving, walk: c.walk, time: g.t + c.seed, mood, weapon: c.weapon,
    swing: c.swing >= 0 ? c.swing : null, hurt: c.hurt >= 0, ring: c.player ? LIME : 'rgba(255,46,77,.75)', slash: c.player ? LIME : null, hot: !!u, noShadow: jy > 0 });
  G.globalAlpha = 1;
  if (u && u.k === 'legendary') {
    for (let i = 0; i < 3; i++) { G.save(); G.translate(c.x, c.y - 6 * s); G.scale(s, s); G.rotate(g.t * 14 + i * TAU / 3); G.translate(-20, -12); fishBlade(0, true); G.restore(); }
    glowArc(c.x, c.y - 6 * s, 112, 0, TAU, CYAN, 3, .5 + .3 * Math.sin(g.t * 20));
  }
  if (c.stun > 0) for (let i = 0; i < 3; i++) { const a = g.t * 6 + i * TAU / 3; star(c.x + Math.cos(a) * 30, c.y - 78 * s + Math.sin(a) * 8, 8, GOLD); }
  tag(c.x + 3 * s, c.y - 92 * s - jy, c.player ? 'YOU' : c.name, c.player ? LIME : SNOW, c.player ? 0 : c.lives, c.player ? 0 : c.max);
  if (!c.player && c.ai.s === 'laser') chroma('!', c.x + 44 * s, c.y - 62 * s, 38, RED);
}
function drawRug(r) {
  const a = g.t - r.t0;
  if (r.st === 'idle') rugPanel(r.x, r.y, r.w, r.h, 1, false, g.t);
  else if (r.st === 'warn') rugPanel(r.x + Math.sin(a * 50) * 4, r.y, r.w, r.h, 1, true, g.t);
  else if (r.st === 'pull') { voidHole(r.x, r.y, r.w, r.h); const k = eIn(a / .45); G.save(); G.translate(r.x + k * 420, r.y - k * 60); G.rotate(k * .8); rugPanel(0, 0, r.w, r.h, 1 - k, true, g.t); G.restore(); }
  else if (r.st === 'gone') voidHole(r.x, r.y, r.w, r.h);
  else rugPanel(r.x, r.y, r.w, r.h, a / .5, false, g.t);
}
function drawFX() {
  for (const p of g.parts) {
    const k = p.age / p.life; G.globalAlpha = 1 - k;
    if (p.kind === 'ring') { G.save(); G.globalCompositeOperation = 'lighter'; G.beginPath(); G.arc(p.x, p.y, p.R * eOut(k), 0, TAU); G.lineWidth = p.w * (1 - k) + 1; G.strokeStyle = p.c; G.stroke(); G.restore(); }
    else if (p.kind === 'star') star(p.x, p.y, p.r * (1 - k * .5), p.c);
    else if (p.kind === 'strand') { G.save(); G.translate(p.x, p.y); G.rotate(p.rot + p.age * 8); G.beginPath(); G.moveTo(-p.r, 0); G.bezierCurveTo(-p.r / 2, -10, p.r / 2, 10, p.r, 0); G.lineWidth = 5; G.strokeStyle = p.c; G.stroke(); G.restore(); }
    else if (p.kind === 'shell') { G.save(); G.translate(p.x, p.y); G.rotate(p.rot + p.age * p.spin); G.beginPath(); G.roundRect(-14, -40, 28, 80, [14, 14, 6, 6]); G.fillStyle = '#161d2b'; G.fill(); G.lineWidth = 3; G.strokeStyle = INK; G.stroke(); G.fillStyle = LIME; G.fillRect(-14, 6, 28, 5); G.restore(); }
    else { G.beginPath(); G.arc(p.x, p.y, p.r * (1 - k * .6), 0, TAU); G.fillStyle = p.c; G.fill(); }
  }
  G.globalAlpha = 1;
  for (const q of g.ghosts) {
    const age = g.t - q.t0, yy = q.y - age * 95, s = q.s * .9;
    G.save(); G.globalAlpha = .6 * (1 - age / 1.6);
    drawCat(q.x, yy, s, { skin: 'ghost', mood: 'dead', time: g.t, noShadow: true });
    G.strokeStyle = CYAN; G.lineWidth = 4; G.beginPath(); G.ellipse(q.x + 3 * s, yy - 78 * s, 20 * s, 6 * s, 0, 0, TAU); G.stroke(); G.restore();
  }
  for (const p of g.pops) {
    const k = (g.t - p.t0) / .95; if (k < 0 || k > 1) continue;
    G.save(); G.globalAlpha = k < .75 ? 1 : (1 - k) / .25; G.translate(p.x, p.y - eOut(k) * 60); const sc = 1 + .4 * (1 - eOut(k / .2)); G.scale(sc, sc);
    chroma(p.s, 0, 0, p.size, p.c); G.restore();
  }
}
function drawWorld() {
  G.drawImage(FLOOR, 0, 0);
  drawChart(g.chart, 160, 240, WW - 320, WH - 480, .17, 30);
  for (const r of g.rugs) drawRug(r);
  drawZone();
  for (const l of g.loot) drawLoot(l);
  for (const h of g.hz) {
    const a = g.t - h.t0;
    if (h.k !== 'candle' || a >= 1.22) continue;
    const k = clamp(a / 1.2, 0, 1);
    G.fillStyle = `rgba(0,0,0,${.2 + .45 * k})`; G.beginPath(); G.ellipse(h.x, h.y, 30 + 55 * k, 10 + 15 * k, 0, 0, TAU); G.fill();
    G.save(); G.translate(h.x, h.y); G.strokeStyle = RED; G.lineWidth = 4; G.globalAlpha = .6 + .4 * Math.sin(a * 30);
    G.beginPath(); G.ellipse(0, 0, 95, 30, 0, 0, TAU); G.stroke();
    for (let i = 0; i < 4; i++) { const an = a * 3 + i * TAU / 4; G.beginPath(); G.ellipse(0, 0, 120 - 25 * k, 40 - 8 * k, 0, an, an + .5); G.stroke(); }
    G.restore();
    G.save(); G.globalCompositeOperation = 'lighter'; G.fillStyle = `rgba(255,46,77,${.06 + .16 * k})`; G.fillRect(h.x - 3 - 12 * k, h.y - 1500, 6 + 24 * k, 1500); G.restore();
  }
  if (g.phase === 'drop' && g.t < 2.4) {
    const [x, y] = g.ret, yy = y + 30;
    G.save(); G.globalCompositeOperation = 'lighter'; G.strokeStyle = LIME; G.lineWidth = 3; G.beginPath(); G.arc(x, yy, 46, 0, TAU);
    G.moveTo(x - 70, yy); G.lineTo(x - 28, yy); G.moveTo(x + 28, yy); G.lineTo(x + 70, yy); G.moveTo(x, yy - 70); G.lineTo(x, yy - 28); G.moveTo(x, yy + 28); G.lineTo(x, yy + 70); G.stroke();
    G.setLineDash([8, 10]); G.lineDashOffset = -g.t * 40; G.beginPath(); G.arc(x, yy, 64, 0, TAU); G.stroke(); G.restore();
    G.font = `700 18px ${MF}`; G.fillStyle = LIME; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('drop zone', x, yy + 92);
  }
  const items = [];
  for (const o of OBST) items.push({ y: o.k === 'crate' ? o.y + 40 : o.y, f: () => o.k === 'crate' ? vault(o.x, o.y, g.t) : neonCandle(o.x, o.y, o.c, o.h) });
  for (const c of g.cats) if (c.alive) items.push({ y: c.y + 30 + (c.landed ? 0 : 2000), f: () => drawCatEnt(c) });
  items.sort((a, b) => a.y - b.y); for (const it of items) it.f();
  for (const h of g.hz) {
    const a = g.t - h.t0;
    if (h.k === 'candle' && a >= 1) { const y = a < 1.22 ? lerp(h.y - 1200, h.y, eIn((a - 1) / .22)) : h.y; neonCandle(h.x, y, RED, 230, 74, a > 2.2 ? (2.6 - a) / .4 : 1); }
    if (h.k === 'bite') {
      const o = Math.abs(Math.sin(a * 22)) * 26; G.save(); G.translate(h.x, h.y - 20); G.globalAlpha = 1 - a / .6;
      G.fillStyle = '#5a1020'; G.beginPath(); G.ellipse(0, 0, 46, 10 + o, 0, 0, TAU); G.fill(); G.lineWidth = 5; G.strokeStyle = INK; G.stroke(); G.fillStyle = '#fff';
      for (let i = -3; i <= 3; i++) { G.beginPath(); G.moveTo(i * 12 - 6, -o - 8); G.lineTo(i * 12 + 6, -o - 8); G.lineTo(i * 12, -o + 8); G.fill(); G.beginPath(); G.moveTo(i * 12 - 6, o + 8); G.lineTo(i * 12 + 6, o + 8); G.lineTo(i * 12, o - 8); G.fill(); }
      G.restore();
    }
  }
  for (const p of g.proj) { const k = clamp(p.t, 0, 1), x = lerp(p.x0, p.x1, k), y = lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * 200; G.fillStyle = 'rgba(0,0,0,.35)'; G.beginPath(); G.ellipse(x, lerp(p.y0, p.y1, k) + 40, 18, 6, 0, 0, TAU); G.fill(); yarnBall(x, y, 18, g.t * 12); }
  if (g.laser) {
    G.save(); G.globalCompositeOperation = 'lighter';
    g.trail.forEach(([x, y], i) => { G.globalAlpha = i ? .3 * (1 - i / 6) : 1; G.beginPath(); G.arc(x, y, i ? 6 : 9, 0, TAU); G.fillStyle = '#ff2a2a'; G.fill(); });
    G.globalAlpha = .4 + .25 * Math.sin(g.t * 20); G.beginPath(); G.arc(g.laser.x, g.laser.y, 22, 0, TAU); G.fill(); G.restore();
  }
  drawFX();
}

// ---------- render: HUD ----------
const uiK = () => clamp(Math.min(vw, vh) / 760, .62, 1.15);
const specialBtn = () => { const k = uiK(); return { x: vw - 96 * k, y: vh - 110 * k, r: 62 * k }; };
const ultBtn = () => { const k = uiK(), s = specialBtn(); return { x: s.x - 18 * k, y: s.y - 130 * k, r: 44 * k }; };
function drawRadar(x, y, w) {
  const h = w * WH / WW, sx = w / WW;
  panel(x, y, w, h + 22, 'rgba(61,242,255,.45)');
  X.save(); X.beginPath(); X.rect(x + 4, y + 4, w - 8, h - 4); X.clip();
  X.strokeStyle = 'rgba(61,242,255,.12)'; X.lineWidth = 1; X.beginPath(); for (let i = 1; i < 4; i++) { X.moveTo(x + w * i / 4, y); X.lineTo(x + w * i / 4, y + h); X.moveTo(x, y + h * i / 4); X.lineTo(x + w, y + h * i / 4); } X.stroke();
  X.strokeStyle = RED; X.lineWidth = 1.5; X.beginPath(); X.arc(x + ZC[0] * sx, y + ZC[1] * sx, g.zr * sx, 0, TAU); X.stroke();
  for (const l of g.loot) { X.fillStyle = l.k === 'ca' ? GOLD : CYAN; X.fillRect(x + l.x * sx - 1.5, y + l.y * sx - 1.5, 3, 3); }
  for (const hz of g.hz) if (hz.k === 'candle' && g.t - hz.t0 < 1.22) { X.strokeStyle = RED; X.beginPath(); X.arc(x + hz.x * sx, y + hz.y * sx, 4, 0, TAU); X.stroke(); }
  for (const c of g.cats) if (c.alive && c.landed && !c.player) { X.fillStyle = RED; X.beginPath(); X.arc(x + c.x * sx, y + c.y * sx, 2.6, 0, TAU); X.fill(); }
  const p = g.p; if (p.alive) { X.fillStyle = LIME; X.beginPath(); X.arc(x + p.x * sx, y + p.y * sx, 3.6, 0, TAU); X.fill(); X.strokeStyle = 'rgba(212,255,0,.5)'; X.beginPath(); X.arc(x + p.x * sx, y + p.y * sx, 3.6 + (g.t * 14) % 10, 0, TAU); X.stroke(); }
  X.restore();
  X.font = `700 10px ${MF}`; X.fillStyle = 'rgba(61,242,255,.75)'; X.textAlign = 'left'; X.textBaseline = 'middle'; X.fillText('radar', x + 8, y + h + 10);
}
function drawHUD() {
  const k = uiK(), narrow = vw < 760, pad = 12, p = g.p, left = g.cats.filter(c => c.alive).length;
  if (g.flash > 0) { G.fillStyle = `rgba(255,46,77,${g.flash * .5})`; G.fillRect(0, 0, vw, vh); }
  panel(pad, pad, 104 * k, 88 * k);
  G.font = `700 ${12 * k}px ${MF}`; G.fillStyle = 'rgba(238,242,255,.6)'; G.textAlign = 'left'; G.textBaseline = 'alphabetic'; G.fillText('alive', pad + 14 * k, pad + 24 * k);
  G.font = `${48 * k}px ${DF}`; G.fillStyle = LIME; G.fillText(String(left), pad + 14 * k, pad + 76 * k); const nw = G.measureText(String(left)).width;
  G.font = `700 ${12 * k}px ${MF}`; G.fillStyle = 'rgba(238,242,255,.35)'; G.fillText('/10', pad + 18 * k + nw, pad + 76 * k);
  const lx = narrow ? pad : pad + 114 * k, ly = narrow ? pad + 96 * k : pad, lw = 9 * 30 * k + 26 * k;
  panel(lx, ly, lw, 88 * k);
  G.font = `700 ${12 * k}px ${MF}`; G.fillStyle = 'rgba(238,242,255,.6)'; G.textAlign = 'left'; G.fillText('lives', lx + 14 * k, ly + 24 * k);
  if (g.t < p.dmgUntil) { G.fillStyle = GOLD; G.fillText(`2x dmg ${Math.ceil(p.dmgUntil - g.t)}s`, lx + 70 * k, ly + 24 * k); }
  else if (g.t < p.spdUntil) { G.fillStyle = GREEN; G.fillText('zoomies', lx + 70 * k, ly + 24 * k); }
  const hitNow = p.hurt >= 0 || p.inv > .5;
  for (let i = 0; i < 9; i++) {
    const x = lx + 26 * k + i * 30 * k, y = ly + 60 * k;
    if (i < p.lives) paw(x, y, 13 * k, LIME, null); else paw(x, y, 13 * k, hitNow && i === p.lives ? RED : null, 'rgba(238,242,255,.18)');
  }
  const ch = g.chart, pct = (ch.last / ch.start - 1) * 100, up = pct >= 0;
  const secs = Math.max(0, Math.ceil(90 - g.ft)), zt = g.phase === 'drop' ? 'zone opens on landing' : secs > 0 ? `liq zone ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : 'zone closed';
  const tw = 196 * k, th = 62 * k, tx = narrow ? pad + 114 * k : vw / 2 - tw / 2, ty = narrow ? pad + 13 * k : pad;
  panel(tx, ty, tw, th, up ? LIME : RED);
  G.font = `${22 * k}px ${DF}`; G.fillStyle = SNOW; G.textAlign = 'left'; G.textBaseline = 'middle'; G.fillText('$CMBG', tx + 12 * k, ty + 22 * k);
  G.font = `700 ${15 * k}px ${MF}`; G.fillStyle = up ? LIME : RED; G.textAlign = 'right'; G.fillText(`${up ? '▲' : '▼'} ${up ? '+' : ''}${pct.toFixed(1)}%`, tx + tw - 12 * k, ty + 22 * k);
  G.font = `700 ${12 * k}px ${MF}`; G.fillStyle = 'rgba(255,46,77,.9)'; G.textAlign = 'left'; G.fillText(zt, tx + 12 * k, ty + 46 * k);
  const rw = (narrow ? 104 : 150) * k, rx = vw - pad - rw, ry = 48;
  useCtx(G); drawRadar(rx, ry, rw);
  let fy = narrow ? ly + 98 * k : ry + rw * WH / WW + 34; const fs = 14 * k, max = narrow ? 3 : 5;
  for (const f of g.feed.filter(f => g.t - f.t < 5).slice(-max)) {
    const age = g.t - f.t, a = Math.min(1, age / .15) * (age > 4.5 ? (5 - age) / .5 : 1);
    G.font = `700 ${fs}px ${MF}`; const w1 = G.measureText(f.a + ' ').width, w3 = G.measureText(f.b).width; G.font = `500 ${fs * .92}px ${MF}`; const w2 = G.measureText(f.v + (f.b ? ' ' : '')).width;
    const w = w1 + w2 + w3 + 30 * k, h = 30 * k, x = narrow ? pad : vw - pad - w, mine = f.a === 'YOU', dead = f.b === 'YOU' || (f.a === 'YOU' && !f.b);
    G.globalAlpha = a; chamfer(x, fy, w, h, 7); G.fillStyle = PANEL; G.fill();
    G.fillStyle = mine && !dead ? LIME : dead ? RED : 'rgba(61,242,255,.6)'; G.fillRect(x, fy + 6, 3, h - 12);
    G.textAlign = 'left'; G.textBaseline = 'middle'; G.font = `700 ${fs}px ${MF}`; G.fillStyle = mine ? LIME : SNOW; G.fillText(f.a, x + 14 * k, fy + h / 2 + 1);
    G.font = `500 ${fs * .92}px ${MF}`; G.fillStyle = f.b ? 'rgba(238,242,255,.55)' : '#ff8a96'; G.fillText(f.v, x + 14 * k + w1, fy + h / 2 + 1);
    G.font = `700 ${fs}px ${MF}`; G.fillStyle = f.b === 'YOU' ? RED : SNOW; G.fillText(f.b, x + 14 * k + w1 + w2, fy + h / 2 + 1);
    G.globalAlpha = 1; fy += h + 6 * k;
  }
  if (p.alive && g.phase === 'fight' && Math.hypot(p.x - ZC[0], p.y - ZC[1]) > g.zr) {
    const a = .45 + .3 * Math.sin(g.t * 10); G.strokeStyle = `rgba(255,46,77,${a})`; G.lineWidth = 24 * k; G.strokeRect(0, 0, vw, vh);
    chroma('GET BACK INSIDE THE ZONE', vw / 2, vh * .72, 28 * k, RED);
  }
  const sb = specialBtn(), ready = g.t >= p.dashReady, label = p.item === 'yarn' ? 'throw' : p.item === 'laser' ? 'laser' : 'pounce';
  G.fillStyle = PANEL; G.beginPath(); G.arc(sb.x, sb.y, sb.r, 0, TAU); G.fill();
  G.lineWidth = 3 * k; G.strokeStyle = p.item || ready ? LIME : 'rgba(238,242,255,.2)'; G.stroke();
  if (!p.item && !ready) glowArc(sb.x, sb.y, sb.r, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - (p.dashReady - g.t) / 2), LIME, 3 * k, 1);
  if (p.item === 'yarn') yarnBall(sb.x, sb.y - 4 * k, 22 * k, g.t * 2);
  else if (p.item === 'laser') laserPen(sb.x, sb.y - 4 * k, 24 * k);
  else paw(sb.x, sb.y, 26 * k, ready ? LIME : '#3a4050', null);
  G.font = `700 ${12 * k}px ${MF}`; G.fillStyle = 'rgba(238,242,255,.75)'; G.textAlign = 'center'; G.textBaseline = 'alphabetic'; G.fillText(touchMode ? label : label + ' [space]', sb.x, sb.y + sb.r + 18 * k);
  const ub = ultBtn(), full = p.ult >= 1;
  G.fillStyle = PANEL; G.beginPath(); G.arc(ub.x, ub.y, ub.r, 0, TAU); G.fill();
  G.lineWidth = 3 * k; G.strokeStyle = 'rgba(61,242,255,.2)'; G.stroke();
  if (p.ult > 0) glowArc(ub.x, ub.y, ub.r, -Math.PI / 2, -Math.PI / 2 + TAU * p.ult, CYAN, (full ? 5 : 3) * k, full ? .75 + .25 * Math.sin(g.t * 10) : .8);
  G.font = `${(full ? 22 : 18) * k}px ${DF}`; G.fillStyle = full ? CYAN : 'rgba(238,242,255,.45)'; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText(full ? 'ULT' : Math.floor(p.ult * 100) + '%', ub.x, ub.y + 1);
  G.font = `700 ${11 * k}px ${MF}`; G.fillStyle = full ? CYAN : 'rgba(238,242,255,.5)'; G.textBaseline = 'alphabetic';
  G.fillText(ULT_NAMES[p.kind].toLowerCase() + (touchMode ? '' : ' [e]'), ub.x - (narrow ? 30 * k : 0), ub.y - ub.r - 8 * k);
  if (touchMode) {
    const R = 56 * k, bx = joy.active ? joy.ox : 100 * k + 20, by = joy.active ? joy.oy : vh - 110 * k;
    G.lineWidth = 3; G.strokeStyle = 'rgba(61,242,255,.3)'; G.beginPath(); G.arc(bx, by, R, 0, TAU); G.stroke();
    let kx = 0, ky = 0; if (joy.active) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, m = Math.hypot(dx, dy); if (m > 0) { kx = dx / m * Math.min(m, R); ky = dy / m * Math.min(m, R); } }
    G.fillStyle = 'rgba(212,255,0,.35)'; G.beginPath(); G.arc(bx + kx, by + ky, 26 * k, 0, TAU); G.fill();
  }
  if (g.phase === 'drop' && g.t < 2.4) { G.font = `700 ${16 * k}px ${MF}`; G.fillStyle = LIME; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText(touchMode ? 'drag to steer your drop pod' : 'WASD / arrows to steer your drop pod', vw / 2, vh * .62); }
  if (g.phase === 'fight' && g.ft < 6) {
    G.globalAlpha = g.ft > 5.4 ? (6 - g.ft) / .6 : 1; G.font = `700 ${13 * k}px ${MF}`;
    const tip = 'walk into cats to scratch · hits charge your ult · stay inside the zone';
    const tw2 = Math.min(vw - 24, G.measureText(tip).width + 30), by2 = vh * .8;
    chamfer(vw / 2 - tw2 / 2, by2, tw2, 34 * k, 8); G.fillStyle = PANEL; G.fill();
    G.fillStyle = SNOW; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText(tip, vw / 2, by2 + 17 * k, vw - 40); G.globalAlpha = 1;
  }
  for (const s of g.slams) {
    const u = g.t - s.t0; if (u < 0 || u > s.dur) continue;
    const a = u < s.dur - .15 ? 1 : (s.dur - u) / .15, sc = 1 + .45 * (1 - eOut(u / .16));
    let size = 104 * k; G.font = `${size}px ${DF}`; const sw = G.measureText(s.s).width * sc; if (sw > vw * .9) size *= vw * .9 / sw;
    G.save(); G.globalAlpha = a; G.translate(vw / 2 + (u < .12 ? (Math.random() - .5) * 10 : 0), vh * .3); G.scale(sc, sc); chroma(s.s, 0, 0, size, s.c || LIME); G.restore();
  }
  if (g.result === 'win') for (let i = 0; i < 60; i++) { const x = (i * 211) % vw, y = ((g.t * (160 + (i * 53) % 140) + i * 61) % (vh + 40)) - 20; G.save(); G.translate(x, y); G.rotate(g.t * 4 + i); G.fillStyle = [LIME, CYAN, SNOW, GOLD][i % 4]; G.fillRect(-4, -8, 8, 16); G.restore(); }
}
function render() {
  useCtx(G); G.setTransform(1, 0, 0, 1, 0, 0); G.fillStyle = VOID; G.fillRect(0, 0, cv.width, cv.height);
  if (!g) return;
  const z = g.cam.z || zoomBase(), o = shakeOff();
  G.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - g.cam.x * z + o[0]), dpr * (vh / 2 - g.cam.y * z + o[1]));
  drawWorld();
  G.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHUD();
  G.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < vh; y += 3) G.fillRect(0, y, vw, 1);
}
// Menu and pack screens sit on top of a full-screen live chart.
let attract = null;
function renderAttract(dt) {
  if (!attract) attract = newChart();
  attract.t += dt; if (attract.t >= .9) chartTick(attract);
  useCtx(G); G.setTransform(1, 0, 0, 1, 0, 0); G.fillStyle = VOID; G.fillRect(0, 0, cv.width, cv.height);
  G.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.strokeStyle = 'rgba(61,242,255,.05)'; G.lineWidth = 1; G.beginPath();
  for (let x = 0; x <= vw; x += 32) { G.moveTo(x, 0); G.lineTo(x, vh); } for (let y = 0; y <= vh; y += 32) { G.moveTo(0, y); G.lineTo(vw, y); } G.stroke();
  drawChart(attract, vw * .04, vh * .18, vw * .92, vh * .64, screen === 'pack' ? .12 : .3, 0);
}

// ---------- screens ----------
function show(id) { for (const s of ['menu', 'pack', 'end']) $(s).classList.toggle('hidden', s !== id); }
function renderHero(t) {
  const w = heroCv.width, h = heroCv.height; if (w < 2) return;
  useCtx(HC); HC.setTransform(1, 0, 0, 1, 0, 0); HC.clearRect(0, 0, w, h);
  const s = w / 160, cx = w * .5, cy = h * .64, fy = cy + 31 * s;
  HC.save(); HC.globalCompositeOperation = 'lighter';
  HC.fillStyle = 'rgba(61,242,255,.07)'; HC.beginPath(); HC.moveTo(cx - w * .3, fy); HC.lineTo(cx - w * .1, 0); HC.lineTo(cx + w * .1, 0); HC.lineTo(cx + w * .3, fy); HC.fill();
  for (let i = 0; i < 3; i++) {
    const r = w * .3 * (1 + i * .2);
    HC.strokeStyle = i ? 'rgba(61,242,255,.4)' : 'rgba(212,255,0,.8)'; HC.lineWidth = i ? 2 * dpr : 4 * dpr;
    HC.setLineDash(i ? [14 * dpr, 12 * dpr] : []); HC.lineDashOffset = t * 40 * (i % 2 ? 1 : -1) * dpr;
    HC.beginPath(); HC.ellipse(cx, fy, r, r * .28, 0, 0, TAU); HC.stroke();
  }
  HC.restore(); HC.setLineDash([]);
  drawCat(cx, cy - Math.sin(t * 1.6) * 3 * s, s, { skin: 'royal', mood: 'smug', weapon: 'fish', wAngle: .1, time: t, noShadow: true, hot: true });
}
function openPack() {
  audio(); screen = 'pack'; show('pack'); g = null;
  pk = { taps: 0, shake: 0, ripples: [], open: null, t: 0, shown: false };
  $('packTitle').textContent = 'TAP THE PACK'; $('packTitle').style.color = LIME; $('packInfo').classList.add('hidden');
}
function roll() { const r = Math.random(); return r < .1 ? 'legendary' : r < .4 ? 'rare' : 'common'; }
stageCv.addEventListener('pointerdown', () => {
  if (screen !== 'pack' || pk.open != null) return;
  audio(); pk.taps++; pk.shake = 1; pk.ripples.push(pk.t); sfx('tap');
  if (pk.taps >= 3) { pk.open = pk.t; rarity = roll(); sfx('tear'); setTimeout(() => sfx('reveal'), 700); $('packTitle').textContent = '...'; }
  else $('packTitle').textContent = `TAP ${3 - pk.taps} MORE`;
});
function renderPack(dt) {
  pk.t += dt; pk.shake = Math.max(0, pk.shake - dt * 3);
  useCtx(SG); SG.setTransform(1.5, 0, 0, 1.5, 0, 0); SG.clearRect(0, 0, 600, 780);
  const u = pk.open == null ? -1 : pk.t - pk.open, cx = 300, cy = 400, C = CARDS[rarity];
  rays(cx, cy, pk.t, u > .9 ? C.frame : LIME, u > 0 ? .1 : .04, 700);
  if (u < 1) {
    const sh = Math.sin(pk.t * 70) * 14 * pk.shake, rot = Math.sin(pk.t * 55) * .05 * pk.shake, fall = u > .15 ? eIn((u - .15) / .8) : 0;
    drawPack(cx + sh, cy + fall * 600 + Math.sin(pk.t * 2) * 6, 300, 426, rot, u >= 0, 1 - fall * .5);
    for (const tp of pk.ripples) { const v = (pk.t - tp) / .35; if (v > 0 && v < 1) { SG.globalAlpha = 1 - v; SG.strokeStyle = LIME; SG.lineWidth = 5; SG.beginPath(); SG.arc(cx, cy, 50 + 120 * v, 0, TAU); SG.stroke(); SG.globalAlpha = 1; } }
  }
  if (u >= 0 && u < 1) { SG.save(); SG.globalAlpha = clamp(1 - u, 0, 1); SG.translate(cx + u * 420, cy - 200 - u * 320); SG.rotate(u * 4); SG.beginPath(); SG.roundRect(-150, -19, 300, 38, [18, 18, 0, 0]); SG.fillStyle = '#1a34a6'; SG.fill(); SG.lineWidth = 6; SG.strokeStyle = INK; SG.stroke(); SG.restore(); }
  if (u >= .15) { const rise = eOut((u - .15) / .6), flip = clamp((u - .7) / .5, 0, 1), gr = lerp(.72, 1, eOut((u - .7) / .5)); drawCard(cx, lerp(470, 390, rise), 330 * gr, 490 * gr, rarity, flip, 0, pk.t); }
  if (u > 1.2 && rarity !== 'common') for (let i = 0; i < 14; i++) { const k = Math.max(0, Math.sin(pk.t * 5 + i * 1.7)); star(cx + Math.sin(i * 2.3) * 240, cy + Math.cos(i * 1.9) * 330, (8 + (i % 4) * 4) * k, C.frame); }
  if (u >= 0 && u < .2) { SG.fillStyle = `rgba(255,255,255,${(.2 - u) / .2 * .85})`; SG.fillRect(0, 0, 600, 780); }
  if (u > 1.2 && !pk.shown) {
    pk.shown = true; $('packTitle').textContent = `${C.label} PULL.`; $('packTitle').style.color = C.frame;
    $('fighterDesc').textContent = DESC[rarity] + ` Odds: ${C.odds}.`; $('packInfo').classList.remove('hidden');
  }
}
function startGame() { audio(); newGame(rarity); screen = 'game'; show(null); for (const k in keys) keys[k] = false; }
function showEnd() {
  screen = 'end'; show('end');
  const win = g.result === 'win', p = g.p, C = CARDS[rarity];
  const pump = (g.chart.last / g.chart.start - 1) * 100, pumpS = `${pump >= 0 ? '+' : ''}${pump.toFixed(1)}%`;
  $('endTitle').textContent = win ? 'WINNER WINNER' : 'SCRATCHED OUT.'; $('endTitle').style.color = win ? SNOW : RED;
  $('endSub').textContent = win ? 'TUNA DINNER.' : `#${g.place} OF 10`;
  $('endStats').innerHTML = [['place', `#${g.place}/10`, LIME], ['kills', String(p.kills), SNOW], ['lives left', `${p.lives}/9`, SNOW], ['$CMBG chart', pumpS, pump >= 0 ? LIME : RED]]
    .map(([l, v, c]) => `<div class="stat"><small>${l}</small><b style="color:${c}">${v}</b></div>`).join('');
  $('endCause').textContent = (win ? `You outlasted 9 cats as ${C.name}.` : `You ${g.cause}.`) + ` Your fighter was a ${C.label.toLowerCase()} pull.`;
}
function shareText() {
  const C = CARDS[rarity], p = g.p, pump = (g.chart.last / g.chart.start - 1) * 100, pumpS = `${pump >= 0 ? '+' : ''}${pump.toFixed(1)}%`;
  return g.result === 'win'
    ? `Pulled a ${C.label} ${C.name} and won CMBG: Last Cat Standing 🐾 ${p.kills} kills, ${p.lives}/9 lives left, chart ${pumpS}.\n\nGmeow or get scratched out @Cmbg_RH`
    : `Placed #${g.place}/10 in CMBG: Last Cat Standing 🐾 ${p.kills} kills as a ${C.label} ${C.name}, chart ${pumpS}.\n\nGmeow or get scratched out @Cmbg_RH`;
}
$('btnPlay').onclick = openPack;
$('btnDrop').onclick = startGame;
$('btnAgain').onclick = openPack;
$('btnShare').onclick = () => {
  const url = location.protocol.startsWith('http') ? location.origin + location.pathname : '';
  window.open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + (url ? '&url=' + encodeURIComponent(url) : ''), '_blank', 'noopener');
};

// ---------- input ----------
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (screen === 'game') special(); else if (screen === 'pack' && pk.open == null) stageCv.dispatchEvent(new PointerEvent('pointerdown')); }
  if (e.code === 'KeyM') setMute(!muted);
  if (e.code === 'KeyE' && screen === 'game') ultimate();
  if (e.code === 'Enter') { if (screen === 'menu') openPack(); else if (screen === 'end') openPack(); else if (screen === 'pack' && pk.shown) startGame(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.active = false; joy.id = null; });
cv.addEventListener('pointerdown', e => {
  audio(); if (screen !== 'game') return;
  if (e.pointerType === 'touch') touchMode = true;
  const sb = specialBtn(), ub = ultBtn();
  if (Math.hypot(e.clientX - ub.x, e.clientY - ub.y) < ub.r * 1.35) { ultimate(); return; }
  if (Math.hypot(e.clientX - sb.x, e.clientY - sb.y) < sb.r * 1.3 || (touchMode && e.clientX > vw * .6)) { special(); return; }
  if (joy.id == null) { joy.id = e.pointerId; joy.active = true; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const endJoy = e => { if (e.pointerId === joy.id) { joy.id = null; joy.active = false; } };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);

// ---------- loop ----------
let last = 0;
function frame(ms) {
  const s = ms / 1000, dt = Math.min(.05, last ? s - last : 0); last = s;
  if (screen === 'menu' || screen === 'pack') renderAttract(dt);
  if (screen === 'menu') renderHero(s);
  else if (screen === 'pack') renderPack(dt);
  if (g && (screen === 'game' || screen === 'end')) { update(dt); render(); }
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
window.__lcs = { get g() { return g; }, get screen() { return screen; }, startGame, openPack, special, ultimate, setRarity: r => { rarity = r; } };
