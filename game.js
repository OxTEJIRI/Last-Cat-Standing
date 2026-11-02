// CMBG: Last Cat Standing. Screens, input, bots, combat, loot, hazards and HUD. Drawing helpers live in art.js.
const $ = id => document.getElementById(id);
const cv = $('game'), G = cv.getContext('2d');
const heroCv = $('hero'), HC = heroCv.getContext('2d');
const stageCv = $('stage'), SG = stageCv.getContext('2d');
let vw = innerWidth, vh = innerHeight, dpr = 1, safeTop = 0, safeBottom = 0;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); vw = innerWidth; vh = innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  if (heroCv.clientWidth) { heroCv.width = Math.round(heroCv.clientWidth * dpr); heroCv.height = Math.round(heroCv.clientHeight * dpr); }
  const css = getComputedStyle(document.documentElement);
  safeTop = parseFloat(css.getPropertyValue('--safe-top')) || 0;
  safeBottom = parseFloat(css.getPropertyValue('--safe-bottom')) || 0;
  refreshControls();
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
function setMute(m) {
  muted = m; $('mute').classList.toggle('off', m); $('mute').setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound'); $('btnSound').textContent = m ? 'SOUND OFF' : 'SOUND ON';
  try { localStorage.setItem('lcs-muted', m ? '1' : '0'); } catch (e) {} }
$('mute').onclick = e => { e.stopPropagation(); setMute(!muted); audio(); };
setMute(muted);

// ---------- world ----------
const WW = 2200, WH = 1400, ZC = [1100, 700];
const OBST = [
  { x: 380, y: 360, r: 46, k: 'crate' }, { x: 1820, y: 360, r: 46, k: 'crate' }, { x: 360, y: 1040, r: 46, k: 'crate' }, { x: 1840, y: 1040, r: 46, k: 'crate' },
  { x: 760, y: 520, r: 26, k: 'candle', c: RED, h: 90 }, { x: 1440, y: 520, r: 26, k: 'candle', c: GREEN, h: 110 },
  { x: 760, y: 900, r: 26, k: 'candle', c: GREEN, h: 80 }, { x: 1440, y: 900, r: 26, k: 'candle', c: RED, h: 100 }
];
const RUG_SPOTS = [[560, 700], [1640, 700], [1100, 420], [1100, 980]];
const BOT_NAMES = ['PAPER PAWS', 'JEET KITTY', 'SER WHISKERS', 'EXIT LIQUIDITY', 'SIR FLOOFS', 'BAG HOLDER', 'MITTENS.ETH', 'RUG DOCTOR', 'DEV (ANON)', 'GAS FEE GARY', 'NGMI NOODLE', 'FUD FELINE', 'DIAMOND MITTS', 'TOP BUYER'];
const BOT_SKINS = ['gray', 'tux', 'ginger', 'calico', 'black', 'siamese', 'lilac', 'brown', 'smoke'];
const FIGHTERS = {
  common: { skin: 'street', weapon: 'claw', speed: 300, dmg: 1, cd: .55, range: 92, kb: 120 },
  rare: { skin: 'boss', weapon: 'heavy', speed: 250, dmg: 2, cd: 1, range: 98, kb: 330 },
  legendary: { skin: 'royal', weapon: 'fish', speed: 280, dmg: 1, cd: .7, range: 108, kb: 170, cleave: true }
};
const DESC = {
  common: 'Street Cat: fast and scrappy, with the quickest swipes in the trenches.',
  rare: 'Alley Boss: slow and tanky. Every hit does 2 damage and knocks cats back.',
  legendary: 'Chain Royalty: a long fishbone blade that hits every cat in reach.'
};
const ULT = {
  common: { name: 'NINE-TAIL RUSH', desc: 'Three dashes at the nearest cats, 2 damage each.' },
  rare: { name: 'GROUND POUND', desc: 'Leap and slam. Hits and stuns every cat close by.' },
  legendary: { name: 'BLADE STORM', desc: 'Spinning blades shred every cat around you.' }
};
const PERKS = { common: 'Fast and scrappy. Quickest swipes in the trenches.', rare: 'Slow and tanky. Every hit does 2 and knocks cats back.', legendary: 'Fishbone blade that hits every cat in reach.' };

// Record and card collection, kept in this browser only.
const SAVE = (() => {
  const d = { wins: 0, games: 0, bestKills: 0, cards: { common: 0, rare: 0, legendary: 0 } };
  try { const s = JSON.parse(localStorage.getItem('lcs-save') || 'null'); if (s) { Object.assign(d, s); d.cards = Object.assign({ common: 0, rare: 0, legendary: 0 }, s.cards); } } catch (e) {}
  return d;
})();
const persist = () => { try { localStorage.setItem('lcs-save', JSON.stringify(SAVE)); } catch (e) {} };
const owned = () => ['common', 'rare', 'legendary'].filter(k => SAVE.cards[k] > 0).length;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const blocked = (x, y, m) => OBST.some(o => Math.hypot(o.x - x, o.y - y) < o.r + m);
const scl = c => c.player ? 1.35 : 1.22;
const zoneR = ft => lerp(1000, 110, ss((ft - 8) / 82));

let screen = 'menu', g = null, rarity = FIGHTERS[SAVE.selected] ? SAVE.selected : 'common', pk = null;
const keys = {}, joy = { id: null, active: false, ox: 0, oy: 0, x: 0, y: 0 };
let touchMode = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

function makeCat(o) {
  return Object.assign({ x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, face: 1, faceT: 0, alive: true, landed: false, atk: 0, swing: -1, hurt: -1, inv: 0, item: null,
    spdUntil: 0, dmgUntil: 0, stun: 0, zt: 0, lastBy: null, lastByT: -9, kills: 0, walk: 0, seed: Math.random() * 9, dash: null, dashReady: 0, moving: false,
    ai: { s: 'wander', tx: ZC[0], ty: ZC[1], until: 0, next: 0, tgt: null } }, o);
}

function newGame(r) {
  const F = FIGHTERS[r];
  const p = makeCat({ player: true, name: 'YOU', kind: r, skin: F.skin, weapon: F.weapon, speed: F.speed, dmg: F.dmg, cd: F.cd, range: F.range, kb: F.kb, cleave: !!F.cleave, lives: 9, max: 9,
    ult: 0, ulting: null, streak: 0, bestStreak: 0, lastKillT: -9, dealt: 0, loot: 0, ults: 0, trail: [] });
  const names = shuffle(BOT_NAMES.slice()).slice(0, 9), skins = shuffle(BOT_SKINS.slice()), cats = [p], spots = [];
  for (let i = 0; i < 9; i++) {
    const n = names[i], acc = n === 'DEV (ANON)' ? ['shades'] : n === 'SER WHISKERS' ? ['monocle'] : Math.random() < .2 ? ['shades'] : [];
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
    rugs: RUG_SPOTS.map(([x, y]) => ({ x, y, w: 230, h: 130, st: 'idle', t0: 0 })), endAt: null, result: null, place: null, cause: '', hs: 0, firstBlood: false, sub: null };
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
function shake(d, a) { if (!reducedMotion) g.sh = { t0: g.t, d, a }; }
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
  if (t.player) { shake(.2, 12); sfx('hurt'); g.hs = Math.max(g.hs, .05); } else if (src && src.player) sfx('hit');
  if (src && src.player) { src.dealt += d; g.hs = Math.max(g.hs, .035); if (!src.ulting) src.ult = Math.min(1, src.ult + d * .06); }
  if (t.lives <= 0) kill(t, src, cause);
}
function kill(t, src, cause) {
  t.alive = false; poof(t.x, t.y, t.skin); g.ghosts.push({ x: t.x, y: t.y, s: scl(t), t0: g.t });
  if (src) { src.kills++; g.feed.push({ t: g.t, a: src.player ? 'YOU' : src.name, v: 'scratched out', b: t.player ? 'YOU' : t.name }); }
  else g.feed.push({ t: g.t, a: t.player ? 'YOU' : t.name, v: cause, b: '' });
  if (src && src.player) {
    pop(t.x, t.y - 135, 'SCRATCHED OUT', '#fff', 36); sfx('kill'); g.hs = .09; src.ult = Math.min(1, src.ult + .12);
    src.streak = g.t - src.lastKillT < 4 ? src.streak + 1 : 1; src.lastKillT = g.t; src.bestStreak = Math.max(src.bestStreak, src.streak);
    const call = !g.firstBlood ? 'FIRST BLOOD' : ['', '', 'DOUBLE SCRATCH', 'TRIPLE SCRATCH'][src.streak] || (src.streak > 3 ? 'MEGA SCRATCH' : '');
    if (call) { slam(call, src.streak > 2 ? GOLD : LIME, 1.2); g.sub = { s: src.streak > 1 ? `STREAK X${src.streak} · ULT +12%` : 'ULT +12%', t0: g.t, dur: 1.2 }; }
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
const canAct = () => screen === 'game' && g && g.phase === 'fight' && g.p.alive && !g.result && !g.p.ulting;
function pounce() {
  if (!canAct()) return;
  const p = g.p; if (g.t < p.dashReady) return;
  const v = inputVec(); let dx = v[0], dy = v[1]; if (!dx && !dy) { dx = p.face; dy = 0; }
  const m = Math.hypot(dx, dy); p.dash = { t: 0, dx: dx / m, dy: dy / m }; p.dashReady = g.t + 2; p.inv = Math.max(p.inv, .25); sfx('dash');
}
function useItem() {
  if (!canAct()) return;
  const p = g.p;
  if (p.item === 'yarn') { const f = closestFoe(p, 480); throwYarn(p, f ? f.x : p.x + p.face * 300, f ? f.y : p.y); p.item = null; }
  else if (p.item === 'laser') { g.laser = { x: p.x + p.face * 70, y: p.y, an: Math.random() * TAU, until: g.t + 4.5, owner: p }; p.item = null; pop(p.x, p.y - 140, 'BOTS GO FERAL', RED, 40); sfx('pickup'); }
}
function ultimate() {
  if (!canAct()) return;
  const p = g.p; if (p.ult < 1) return;
  p.ult = 0; p.ults++; p.ulting = { k: p.kind, t: 0, n: 0, next: 0 }; p.inv = Math.max(p.inv, .3); p.dash = null;
  slam(ULT[p.kind].name, LIME, 1); sfx('reveal');
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
      ring(p.x, p.y + 30, GOLD, 260, .5, 14); ring(p.x, p.y + 30, '#fff', 200, .4, 6); dust(p.x, p.y + 30, 30);
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
      g.loot.splice(i, 1); if (c.player) c.loot++;
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
      dust(h.x, h.y, 26); ring(h.x, h.y, RED, 180, .5, 10);
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
  let dx = 0, dy = 0, sp = c.speed * (g.t < c.spdUntil ? 1.4 : 1) * (c.ulting ? 1.25 : 1);
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
      c.landed = true; dust(c.x, c.y + 36, c.player ? 26 : 12);
      if (c.player) { ring(c.x, c.y + 36, LIME, 200, .6, 9); pop(c.x, c.y - 140, 'LANDED ON FEET', LIME, 40); shake(.25, 10); sfx('land'); }
    }
  }
  if (T >= 3.5) { g.phase = 'fight'; g.ft = 0; slam('SCRATCH.', LIME, .9); }
}
function update(dt) {
  if (g.hs > 0) { g.hs -= dt; return; }
  g.t += dt; stepFX(dt);
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
  G.fillStyle = 'rgba(255,40,70,.17)'; G.fill('evenodd'); G.clip('evenodd');
  G.strokeStyle = 'rgba(255,61,77,.13)'; G.lineWidth = 14; G.beginPath(); const o = (g.t * 60) % 60;
  for (let x = -WH - 120; x < WW + 120; x += 60) { G.moveTo(x + o, -60); G.lineTo(x + o + WH + 120, WH + 60); } G.stroke(); G.restore();
  G.save(); G.setLineDash([26, 14]); G.lineDashOffset = -g.t * 50; G.lineWidth = 6; G.strokeStyle = RED; G.beginPath(); G.arc(ZC[0], ZC[1], r, 0, TAU); G.stroke(); G.restore();
}
function drawLoot(l) {
  const t = g.t, bob = Math.sin(t * 4 + l.x) * 6;
  if (l.k === 'ca') { lootBox(l.x, l.y, GOLD, t); G.font = `700 20px ${MF}`; G.fillStyle = GOLD; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('CA', l.x, l.y + 6); G.font = `40px ${DF}`; G.fillText('?', l.x, l.y - 52 + bob); }
  else {
    lootBox(l.x, l.y, LIME, t);
    if (l.k === 'yarn') yarnBall(l.x, l.y - 50 + bob, 16, t);
    else if (l.k === 'catnip') catnip(l.x, l.y - 44 + bob, 22);
    else laserPen(l.x, l.y - 50 + bob, 20);
  }
}
function drawCatEnt(c) {
  const s = scl(c);
  if (!c.landed) {
    const st = c.player ? 2.4 : c.dropAt, u = (g.t - st) / .85; if (u < 0) return;
    const k = eIn(u);
    G.fillStyle = `rgba(0,0,0,${.15 + .35 * k})`; G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 27 * s * (.4 + .6 * k), 8 * s * (.4 + .6 * k), 0, 0, TAU); G.fill();
    G.save(); G.globalAlpha = .35 + .65 * k;
    G.strokeStyle = 'rgba(255,255,255,.35)'; G.lineWidth = 3;
    for (const dx of [-30, 0, 30]) { G.beginPath(); G.moveTo(c.x + dx, c.y - 420 * (1 - k) - 160); G.lineTo(c.x + dx, c.y - 420 * (1 - k) - 60); G.stroke(); }
    drawCat(c.x, c.y - 420 * (1 - k), s * (1 + 2.2 * (1 - k)), { skin: c.skin, acc: c.acc, face: 1, time: g.t, mood: c.player ? 'angry' : 'feral', weapon: c.weapon, noShadow: true, tilt: Math.sin(g.t * 9 + c.seed) * .15 });
    G.restore(); return;
  }
  if (c.trail) for (const q of c.trail) { G.save(); G.globalAlpha = .3 * (1 - (g.t - q.t) / .25); drawCat(q.x, q.y, s, { skin: c.skin, acc: c.acc, face: c.face, time: g.t, weapon: c.weapon, noShadow: true }); G.restore(); }
  const u = c.ulting;
  let mood = 'normal';
  if (c.swing >= 0 || u) mood = 'angry'; if (!c.player && c.ai.s === 'laser') mood = 'feral'; if (c.player && g.result === 'win') mood = 'smug';
  if (g.t < c.dmgUntil) { G.strokeStyle = GOLD; G.lineWidth = 4; G.globalAlpha = .5 + .3 * Math.sin(g.t * 12); G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 44 * s, 15 * s, 0, 0, TAU); G.stroke(); G.globalAlpha = 1; }
  if (g.t < c.spdUntil && c.moving) { G.fillStyle = 'rgba(34,196,107,.35)'; for (let i = 1; i <= 3; i++) { G.beginPath(); G.arc(c.x - c.vx * .03 * i, c.y + 20 - c.vy * .03 * i, 10 - i * 2, 0, TAU); G.fill(); } }
  let jy = 0; if (u && u.k === 'rare' && u.t < .4) { jy = Math.sin(u.t / .4 * Math.PI) * 140; G.fillStyle = 'rgba(0,0,0,.4)'; G.beginPath(); G.ellipse(c.x, c.y + 31 * s, 28 * s, 8 * s, 0, 0, TAU); G.fill(); }
  if (u && u.k === 'legendary') { G.strokeStyle = LIME; G.lineWidth = 5; G.globalAlpha = .45 + .25 * Math.sin(g.t * 20); G.beginPath(); G.arc(c.x, c.y - 6 * s, 118, 0, TAU); G.stroke(); G.globalAlpha = 1; }
  const flick = c.player && c.inv > 0 && !c.dash && !u && Math.sin(g.t * 50) > 0;
  if (flick) G.globalAlpha = .55;
  drawCat(c.x, c.y - jy, s * (1 + jy / 1000), { skin: c.skin, acc: c.acc, face: c.face, moving: c.moving, walk: c.walk, time: g.t + c.seed, mood, weapon: c.weapon, swing: c.swing >= 0 ? c.swing : null, hurt: c.hurt >= 0, ring: c.player ? LIME : 'rgba(255,61,77,.6)', noShadow: jy > 0 });
  G.globalAlpha = 1;
  if (u && u.k === 'legendary') for (let i = 0; i < 3; i++) { G.save(); G.translate(c.x, c.y - 6 * s); G.scale(s, s); G.rotate(g.t * 14 + i * TAU / 3); G.translate(-20, -12); fishBlade(0); G.restore(); }
  if (c.stun > 0) for (let i = 0; i < 3; i++) { const a = g.t * 6 + i * TAU / 3; star(c.x + Math.cos(a) * 30, c.y - 78 * s + Math.sin(a) * 8, 8, GOLD); }
  if (c.player) {
    G.strokeStyle = LIME; G.lineWidth = 3; G.beginPath(); G.ellipse(c.x, c.y + 32 * s, 42 * s, 14 * s, 0, 0, TAU); G.stroke();
    const tx = c.x + 3 * s, ty = c.y - 91 * s - jy;
    G.fillStyle = LIME; G.beginPath(); G.roundRect(tx - 22, ty - 10, 44, 21, 4); G.fill();
    G.beginPath(); G.moveTo(tx - 5, ty + 10); G.lineTo(tx, ty + 16); G.lineTo(tx + 5, ty + 10); G.fill();
    G.font = `700 11px ${MF}`; G.fillStyle = INK; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('YOU', tx, ty + 1);
  } else if (Math.hypot(c.x - g.p.x, c.y - g.p.y) < 400) {
    const x = c.x + 3 * s, y = c.y - 77 * s - jy, w = 58;
    G.fillStyle = 'rgba(11,11,11,.9)'; G.beginPath(); G.roundRect(x - w / 2 - 3, y - 3, w + 6, 10, 3); G.fill();
    G.fillStyle = '#45413d'; G.fillRect(x - w / 2, y, w, 4);
    G.fillStyle = RED; G.fillRect(x - w / 2, y, w * c.lives / c.max, 4);
    if (closestFoe(g.p, 230) === c) {
      G.font = `700 11px ${MF}`; G.textAlign = 'center'; G.textBaseline = 'bottom'; G.lineWidth = 5; G.strokeStyle = INK;
      G.strokeText(c.name, x, y - 7); G.fillStyle = '#e8e8df'; G.fillText(c.name, x, y - 7);
    }
  }
  if (!c.player && c.ai.s === 'laser') { G.font = `38px ${DF}`; G.textAlign = 'center'; G.textBaseline = 'middle'; G.lineWidth = 6; G.strokeStyle = INK; G.strokeText('!', c.x + 44 * s, c.y - 62 * s); G.fillStyle = RED; G.fillText('!', c.x + 44 * s, c.y - 62 * s); }
}
function drawRug(r) {
  const a = g.t - r.t0;
  if (r.st === 'idle') rug(r.x, r.y, r.w, r.h, 1);
  else if (r.st === 'warn') { rug(r.x + Math.sin(a * 50) * 5, r.y, r.w, r.h, 1); G.font = `46px ${DF}`; G.textAlign = 'center'; G.textBaseline = 'middle'; G.lineWidth = 7; G.strokeStyle = INK; G.strokeText('!', r.x, r.y - r.h / 2 - 30); G.fillStyle = RED; G.fillText('!', r.x, r.y - r.h / 2 - 30); }
  else if (r.st === 'pull') { const k = eIn(a / .45); G.save(); G.translate(r.x + k * 420, r.y - k * 60); G.rotate(k * .8); rug(0, 0, r.w, r.h, 1 - k); G.restore(); }
  else if (r.st === 'gone') { G.save(); G.setLineDash([10, 10]); G.strokeStyle = 'rgba(255,255,255,.12)'; G.lineWidth = 3; G.strokeRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h); G.restore(); }
  else rug(r.x, r.y, r.w, r.h, a / .5);
}
function drawFX() {
  for (const p of g.parts) {
    const k = p.age / p.life; G.globalAlpha = 1 - k;
    if (p.kind === 'ring') { G.beginPath(); G.arc(p.x, p.y, p.R * eOut(k), 0, TAU); G.lineWidth = p.w * (1 - k) + 1; G.strokeStyle = p.c; G.stroke(); }
    else if (p.kind === 'star') star(p.x, p.y, p.r * (1 - k * .5), p.c);
    else if (p.kind === 'strand') { G.save(); G.translate(p.x, p.y); G.rotate(p.rot + p.age * 8); G.beginPath(); G.moveTo(-p.r, 0); G.bezierCurveTo(-p.r / 2, -10, p.r / 2, 10, p.r, 0); G.lineWidth = 5; G.strokeStyle = p.c; G.stroke(); G.restore(); }
    else { G.beginPath(); G.arc(p.x, p.y, p.r * (1 - k * .6), 0, TAU); G.fillStyle = p.c; G.fill(); }
  }
  G.globalAlpha = 1;
  for (const q of g.ghosts) {
    const age = g.t - q.t0, yy = q.y - age * 95, s = q.s * .9;
    G.save(); G.globalAlpha = .6 * (1 - age / 1.6);
    drawCat(q.x, yy, s, { skin: 'ghost', mood: 'dead', time: g.t, noShadow: true });
    G.strokeStyle = GOLD; G.lineWidth = 5; G.beginPath(); G.ellipse(q.x + 3 * s, yy - 78 * s, 20 * s, 6 * s, 0, 0, TAU); G.stroke(); G.restore();
  }
  for (const p of g.pops) {
    const k = (g.t - p.t0) / .95; if (k < 0 || k > 1) continue;
    G.save(); G.globalAlpha = k < .75 ? 1 : (1 - k) / .25; G.translate(p.x, p.y - eOut(k) * 60); const sc = 1 + .4 * (1 - eOut(k / .2)); G.scale(sc, sc);
    G.font = `${p.size}px ${DF}`; G.textAlign = 'center'; G.textBaseline = 'middle'; G.lineJoin = 'round'; G.lineWidth = p.size * .16; G.strokeStyle = INK; G.strokeText(p.s, 0, 0); G.fillStyle = p.c; G.fillText(p.s, 0, 0); G.restore();
  }
}
// Cache the static floor so its detail does not add work to every frame.
let arenaFloor = null;
function createArenaFloor() {
  const floor = document.createElement('canvas'); floor.width = WW; floor.height = WH;
  const f = floor.getContext('2d'); f.fillStyle = '#151513'; f.fillRect(0, 0, WW, WH);
  for (let y = 0; y < WH; y += 120) for (let x = 0; x < WW; x += 120) {
    const n = (x * 17 + y * 31) % 29;
    f.fillStyle = n < 10 ? '#191916' : n < 20 ? '#171714' : '#1c1c18';
    f.fillRect(x + 2, y + 2, 116, 116);
    f.fillStyle = 'rgba(255,255,255,.025)'; f.fillRect(x + 8, y + 8, 2, 34);
  }
  f.strokeStyle = '#36382a'; f.lineWidth = 4; f.beginPath(); f.ellipse(ZC[0], ZC[1], 700, 440, 0, 0, TAU); f.stroke();
  f.strokeStyle = 'rgba(212,255,0,.12)'; f.lineWidth = 2; f.setLineDash([26, 18]); f.beginPath(); f.ellipse(ZC[0], ZC[1], 675, 416, 0, 0, TAU); f.stroke(); f.setLineDash([]);
  f.save(); f.translate(ZC[0], ZC[1]); f.rotate(-.08); f.textAlign = 'center'; f.textBaseline = 'middle';
  f.fillStyle = 'rgba(212,255,0,.055)'; f.font = `180px ${DF}`; f.fillText('THE SCRATCH PIT', 0, -25);
  f.font = `700 19px ${MF}`; f.fillText('NINE LIVES. NO SECOND PLACE.', 0, 100); f.restore();
  for (let i = 0; i < 72; i++) {
    const x = (i * 193 + 41) % WW, y = (i * 317 + 83) % WH;
    f.strokeStyle = i % 3 ? 'rgba(0,0,0,.22)' : 'rgba(212,255,0,.055)'; f.lineWidth = 2;
    f.beginPath(); f.moveTo(x, y); f.lineTo(x + 12, y - 8); f.lineTo(x + 22, y + 2); f.lineTo(x + 37, y - 5); f.stroke();
  }
  f.strokeStyle = '#464936'; f.lineWidth = 30; f.strokeRect(16, 16, WW - 32, WH - 32);
  f.strokeStyle = LIME; f.lineWidth = 5; f.strokeRect(30, 30, WW - 60, WH - 60);
  for (const [x, y, rot] of [[50, 50, 0], [WW - 50, 50, Math.PI / 2], [WW - 50, WH - 50, Math.PI], [50, WH - 50, -Math.PI / 2]]) {
    f.save(); f.translate(x, y); f.rotate(rot); f.fillStyle = LIME;
    for (let i = 0; i < 7; i++) { f.beginPath(); f.moveTo(i * 30, 0); f.lineTo(i * 30 + 16, 0); f.lineTo(i * 30 + 45, 30); f.lineTo(i * 30 + 29, 30); f.fill(); } f.restore();
  }
  return floor;
}
function drawWorld() {
  if (!arenaFloor) arenaFloor = createArenaFloor();
  G.drawImage(arenaFloor, 0, 0);
  for (const r of g.rugs) drawRug(r);
  drawZone();
  for (const l of g.loot) drawLoot(l);
  for (const h of g.hz) {
    const a = g.t - h.t0;
    if (h.k === 'candle' && a < 1.22) {
      const k = clamp(a / 1.2, 0, 1); G.fillStyle = `rgba(0,0,0,${.2 + .45 * k})`; G.beginPath(); G.ellipse(h.x, h.y, 30 + 55 * k, 10 + 15 * k, 0, 0, TAU); G.fill();
      G.strokeStyle = RED; G.lineWidth = 5; G.globalAlpha = .5 + .5 * Math.sin(a * 30); G.beginPath(); G.ellipse(h.x, h.y, 95, 30, 0, 0, TAU); G.stroke(); G.globalAlpha = 1;
    }
  }
  if (g.phase === 'drop' && g.t < 2.4) {
    const [x, y] = g.ret; G.strokeStyle = LIME; G.lineWidth = 4; G.beginPath(); G.arc(x, y + 30, 40, 0, TAU);
    G.moveTo(x - 60, y + 30); G.lineTo(x - 24, y + 30); G.moveTo(x + 24, y + 30); G.lineTo(x + 60, y + 30); G.moveTo(x, y - 30); G.lineTo(x, y + 6); G.moveTo(x, y + 54); G.lineTo(x, y + 90); G.stroke();
    G.font = `700 18px ${MF}`; G.fillStyle = LIME; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('YOUR DROP', x, y + 112);
  }
  const items = [];
  for (const o of OBST) items.push({ y: o.k === 'crate' ? o.y + 40 : o.y, f: () => o.k === 'crate' ? crate(o.x, o.y) : candle(o.x, o.y, o.c, o.h) });
  for (const c of g.cats) if (c.alive) items.push({ y: c.y + 30 + (c.landed ? 0 : 2000), f: () => drawCatEnt(c) });
  items.sort((a, b) => a.y - b.y); for (const it of items) it.f();
  for (const h of g.hz) {
    const a = g.t - h.t0;
    if (h.k === 'candle' && a >= 1) { const y = a < 1.22 ? lerp(h.y - 1100, h.y, eIn((a - 1) / .22)) : h.y; G.save(); if (a > 2.2) G.globalAlpha = (2.6 - a) / .4; candle(h.x, y, RED, 230, 74); G.restore(); }
    if (h.k === 'bite') {
      const o = Math.abs(Math.sin(a * 22)) * 26; G.save(); G.translate(h.x, h.y - 20); G.globalAlpha = 1 - a / .6;
      G.fillStyle = '#5a1020'; G.beginPath(); G.ellipse(0, 0, 46, 10 + o, 0, 0, TAU); G.fill(); G.lineWidth = 5; G.strokeStyle = INK; G.stroke(); G.fillStyle = '#fff';
      for (let i = -3; i <= 3; i++) { G.beginPath(); G.moveTo(i * 12 - 6, -o - 8); G.lineTo(i * 12 + 6, -o - 8); G.lineTo(i * 12, -o + 8); G.fill(); G.beginPath(); G.moveTo(i * 12 - 6, o + 8); G.lineTo(i * 12 + 6, o + 8); G.lineTo(i * 12, o - 8); G.fill(); }
      G.restore();
    }
  }
  for (const p of g.proj) { const k = clamp(p.t, 0, 1), x = lerp(p.x0, p.x1, k), y = lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * 200; G.fillStyle = 'rgba(0,0,0,.35)'; G.beginPath(); G.ellipse(x, lerp(p.y0, p.y1, k) + 40, 18, 6, 0, 0, TAU); G.fill(); yarnBall(x, y, 18, g.t * 12); }
  if (g.laser) {
    g.trail.forEach(([x, y], i) => { G.globalAlpha = i ? .25 * (1 - i / 6) : 1; G.beginPath(); G.arc(x, y, i ? 6 : 9, 0, TAU); G.fillStyle = '#ff2a2a'; G.fill(); });
    G.globalAlpha = .35 + .25 * Math.sin(g.t * 20); G.beginPath(); G.arc(g.laser.x, g.laser.y, 20, 0, TAU); G.fillStyle = '#ff2a2a'; G.fill(); G.globalAlpha = 1;
  }
  drawFX();
}

// ---------- render: HUD ----------
const uiK = () => clamp(Math.min(vw, vh) / 760, .85, 1.12);
const touchHUD = () => touchMode || vw < 760;
function hudButtons() {
  const k = uiK(), bottom = vh - safeBottom;
  if (touchHUD()) return {
    pounce: { x: vw - 55, y: bottom - 85, r: 43 },
    ult: { x: vw - 57, y: bottom - 189, r: 36 },
    item: { x: vw - 146, y: bottom - 69, r: 31 }
  };
  const cx = vw / 2, by = bottom - 65 * k;
  return { pounce: { x: cx - 107 * k, y: by, r: 33 * k, sq: true }, ult: { x: cx, y: by, r: 39 * k }, item: { x: cx + 107 * k, y: by, r: 33 * k, sq: true } };
}
function drawButtons(p, k) {
  const B = hudButtons(), ready = g.t >= p.dashReady, full = p.ult >= 1;
  if (!touchHUD()) {
    G.fillStyle = 'rgba(11,11,11,.94)'; G.strokeStyle = '#414332'; G.lineWidth = 1;
    G.beginPath(); G.roundRect(vw / 2 - 172 * k, vh - safeBottom - 119 * k, 344 * k, 109 * k, 12); G.fill(); G.stroke();
  }
  const shape = b => { G.beginPath(); if (b.sq) G.roundRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, 7); else G.arc(b.x, b.y, b.r, 0, TAU); };
  const base = (b, border) => { shape(b); G.fillStyle = 'rgba(11,11,11,.94)'; G.fill(); G.lineWidth = 2; G.strokeStyle = border; G.stroke(); };
  const label = (b, name, key, color) => {
    const s = !touchHUD() ? key + '  ' + name : name, y = b.y + b.r + 15;
    G.font = `700 ${touchHUD() ? 10 : 10 * k}px ${MF}`; G.textAlign = 'center'; G.textBaseline = 'middle';
    const w = G.measureText(s).width + 12; G.fillStyle = 'rgba(11,11,11,.92)'; G.beginPath(); G.roundRect(b.x - w / 2, y - 9, w, 18, 3); G.fill();
    G.fillStyle = color; G.fillText(s, b.x, y);
  };
  let b = B.pounce; base(b, ready ? LIME : '#555747');
  if (ready) paw(b.x, b.y, b.r * .46, LIME, null);
  else { G.font = `${28 * k}px ${DF}`; G.fillStyle = MUTED; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText(Math.ceil(p.dashReady - g.t) + 's', b.x, b.y); }
  label(b, 'POUNCE', 'SPACE', ready ? '#fff' : MUTED);
  b = B.ult; base(b, full ? LIME : '#515344'); G.lineWidth = 4; G.strokeStyle = LIME;
  if (p.ult > 0) { G.beginPath(); G.arc(b.x, b.y, b.r - 5, -Math.PI / 2, -Math.PI / 2 + TAU * p.ult); G.stroke(); }
  if (full) { G.fillStyle = 'rgba(212,255,0,.15)'; G.beginPath(); G.arc(b.x, b.y, b.r - 8, 0, TAU); G.fill(); }
  G.font = `${full ? 25 : 22}px ${DF}`; G.fillStyle = full ? LIME : '#fff'; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText(full ? 'ULT' : Math.floor(p.ult * 100) + '%', b.x, b.y + 1);
  label(b, full ? 'READY' : 'ULTIMATE', 'E', LIME);
  b = B.item; const col = p.item === 'yarn' ? PINK : p.item === 'laser' ? RED : '#515344'; base(b, col);
  if (p.item === 'yarn') yarnBall(b.x, b.y, b.r * .45, reducedMotion ? 0 : g.t * 2);
  else if (p.item === 'laser') laserPen(b.x, b.y, b.r * .48);
  else { G.font = `700 9px ${MF}`; G.fillStyle = '#96968a'; G.textAlign = 'center'; G.textBaseline = 'middle'; G.fillText('EMPTY', b.x, b.y); }
  label(b, p.item === 'yarn' ? 'YARN' : p.item === 'laser' ? 'LASER' : 'ITEM', 'Q', p.item ? '#fff' : MUTED);
}
function hudSlam(s, u, dur, y, size, col) {
  if (u < 0 || u > dur) return;
  const a = u < dur - .15 ? 1 : (dur - u) / .15, k = 1 + .45 * (1 - eOut(u / .16));
  G.save(); G.globalAlpha = a; G.translate(vw / 2, y); G.scale(k, k); G.font = `${size}px ${DF}`; G.textAlign = 'center'; G.textBaseline = 'middle'; G.lineJoin = 'round';
  G.fillStyle = INK; G.fillText(s, size * .06, size * .06); G.lineWidth = size * .09; G.strokeStyle = INK; G.strokeText(s, 0, 0); G.fillStyle = col || LIME; G.fillText(s, 0, 0); G.restore();
}
function drawHUD() {
  const k = uiK(), compact = vw < 1000, p = g.p, pad = 12, top = safeTop + 12, bottom = vh - safeBottom;
  const left = g.cats.filter(c => c.alive).length;
  const panel = (x, y, w, h, border) => { G.fillStyle = 'rgba(11,11,11,.92)'; G.strokeStyle = border || '#383a2d'; G.lineWidth = 1; G.beginPath(); G.roundRect(x, y, w, h, 7); G.fill(); G.stroke(); };
  const text = (s, x, y, font, color, align) => { G.font = font; G.fillStyle = color; G.textAlign = align || 'left'; G.textBaseline = 'middle'; G.fillText(s, x, y); };
  const aw = compact ? 64 : 84, hh = compact ? 63 : 72, lx = pad + aw + 8, lw = compact ? Math.min(174, vw - 190) : 263;
  panel(pad, top, aw, hh); text('ALIVE', pad + 11, top + 15, `700 9px ${MF}`, MUTED);
  text(String(left).padStart(2, '0'), pad + 11, top + 42, `${compact ? 32 : 38}px ${DF}`, LIME);
  panel(lx, top, lw, hh, p.lives <= 2 ? '#a83c42' : null);
  text(p.lives <= 2 ? 'LOW HEALTH' : 'YOUR LIVES', lx + 11, top + 15, `700 9px ${MF}`, p.lives <= 2 ? RED : MUTED);
  text(p.lives + '/9', lx + lw - 11, top + 15, `700 10px ${MF}`, '#fff', 'right');
  const step = (lw - 24) / 9;
  for (let i = 0; i < 9; i++) paw(lx + 12 + step * (i + .5), top + 43, Math.min(10, step * .37), i < p.lives ? (p.lives <= 2 ? RED : LIME) : null, i < p.lives ? null : '#45453b');
  const secs = Math.max(0, Math.ceil(90 - g.ft));
  const zone = g.phase === 'drop' ? 'THE SCRATCH PIT' : secs > 0 ? 'ZONE CLOSES ' + fmt(secs) : 'ZONE CLOSED';
  const zw = compact ? 182 : 204, zy = compact ? top + hh + 9 : top;
  panel(vw / 2 - zw / 2, zy, zw, 32);
  G.fillStyle = g.phase === 'drop' ? LIME : RED; G.beginPath(); G.arc(vw / 2 - zw / 2 + 15, zy + 16, 3, 0, TAU); G.fill();
  text(zone, vw / 2 - zw / 2 + 27, zy + 17, `700 10px ${MF}`, '#e5e5db');
  if (g.t < p.dmgUntil || g.t < p.spdUntil) {
    const buff = g.t < p.dmgUntil ? '2× DAMAGE · ' + Math.ceil(p.dmgUntil - g.t) + 's' : 'ZOOMIES';
    text(buff, compact ? pad + 7 : lx + lw / 2, compact ? bottom - 175 : top + hh + 15, `700 10px ${MF}`, GOLD, compact ? 'left' : 'center');
  }
  const teaching = SAVE.games === 0 && g.phase === 'fight' && g.ft < 18 && p.alive;
  if (teaching || g.phase === 'drop') {
    const phase = g.phase === 'drop' ? -1 : Math.floor(g.ft / 6);
    const title = phase < 0 ? 'PICK YOUR LANDING SPOT' : ['GET CLOSE. YOUR CLAWS DO THE REST.', 'POUNCE INTO A FIGHT. OR OUT OF ONE.', 'LAND HITS TO CHARGE YOUR ULTIMATE.'][phase];
    const hint = phase < 0 || phase === 0 ? (touchMode ? 'Drag the left side to move' : 'Move with WASD or the arrow keys') : phase === 1 ? (touchMode ? 'Tap the paw button to dash' : 'Press SPACE to dash') : (touchMode ? 'Tap ULT when the ring is full' : 'Press E when the ring is full');
    const w = Math.min(vw - 36, 420), y = compact ? top + hh + 50 : top + 91;
    panel(vw / 2 - w / 2, y, w, 48);
    text(title, vw / 2, y + 16, `700 ${compact ? 9 : 11}px ${MF}`, LIME, 'center');
    text(hint, vw / 2, y + 34, `500 10px ${MF}`, MUTED, 'center');
  }
  let fy = compact ? top + hh + 51 : top + 65;
  const feed = g.feed.filter(f => g.t - f.t < 3.5 && (!compact || f.a === 'YOU' || f.b === 'YOU')).slice(compact ? -1 : -2);
  if (!(compact && teaching)) for (const f of feed) {
    const s = [f.a, f.v, f.b].filter(Boolean).join(' '); G.font = `500 ${compact ? 9 : 10}px ${MF}`;
    const w = Math.min(vw - 24, G.measureText(s).width + 22), x = vw - pad - w;
    panel(x, fy, w, 27); text(s, x + 11, fy + 14, `500 ${compact ? 9 : 10}px ${MF}`, f.a === 'YOU' ? LIME : MUTED); fy += 32;
  }
  if (p.alive && g.phase === 'fight' && Math.hypot(p.x - ZC[0], p.y - ZC[1]) > g.zr) {
    G.strokeStyle = RED; G.lineWidth = 5; G.strokeRect(2, 2, vw - 4, vh - 4);
    const y = compact ? vh * .62 : vh * .72, w = Math.min(300, vw - 30); panel(vw / 2 - w / 2, y - 17, w, 34, RED);
    text('GET BACK IN THE ZONE', vw / 2, y, `22px ${DF}`, RED, 'center');
  }
  drawButtons(p, k);
  if (!touchHUD()) {
    panel(pad, bottom - 74, 146, 61);
    text('YOUR KILLS', pad + 12, bottom - 58, `700 9px ${MF}`, MUTED);
    text(String(p.kills), pad + 12, bottom - 32, `30px ${DF}`, LIME);
    text(p.dealt + ' DMG', pad + 59, bottom - 31, `700 10px ${MF}`, '#d7d7cb');
    const mw = 146, mh = mw * WH / WW, mx = vw - pad - mw, my = bottom - 13 - mh, sx = mw / WW;
    panel(mx, my, mw, mh); G.save(); G.beginPath(); G.roundRect(mx, my, mw, mh, 7); G.clip();
    G.setLineDash([4, 3]); G.strokeStyle = RED; G.lineWidth = 1.5; G.beginPath(); G.arc(mx + ZC[0] * sx, my + ZC[1] * sx, g.zr * sx, 0, TAU); G.stroke(); G.setLineDash([]);
    for (const l of g.loot) { G.fillStyle = GOLD; G.fillRect(mx + l.x * sx - 1.5, my + l.y * sx - 1.5, 3, 3); }
    for (const c of g.cats) if (c.alive && c.landed) { G.fillStyle = c.player ? LIME : RED; G.beginPath(); G.arc(mx + c.x * sx, my + c.y * sx, c.player ? 4 : 2.5, 0, TAU); G.fill(); }
    G.restore();
  } else {
    const bx = joy.active ? joy.ox : 71, by = joy.active ? joy.oy : bottom - 99, R = 43;
    G.fillStyle = 'rgba(11,11,11,.4)'; G.strokeStyle = 'rgba(212,255,0,.3)'; G.lineWidth = 2; G.beginPath(); G.arc(bx, by, R, 0, TAU); G.fill(); G.stroke();
    let dx = 0, dy = 0;
    if (joy.active) { const x = joy.x - joy.ox, y = joy.y - joy.oy, m = Math.hypot(x, y); if (m) { dx = x / m * Math.min(m, R); dy = y / m * Math.min(m, R); } }
    G.fillStyle = 'rgba(212,255,0,.35)'; G.beginPath(); G.arc(bx + dx, by + dy, 20, 0, TAU); G.fill();
    text('MOVE', bx, by + 61, `700 9px ${MF}`, MUTED, 'center');
    text(p.kills + (p.kills === 1 ? ' KILL' : ' KILLS'), pad + 7, bottom - 20, `700 10px ${MF}`, LIME);
  }
  for (const s of g.slams) {
    const size = Math.min(76 * k, vw / Math.max(3, s.s.length) * 1.25);
    hudSlam(s.s, g.t - s.t0, s.dur, vh * .37, size, s.c);
  }
  if (g.sub && g.t - g.sub.t0 < g.sub.dur) {
    G.font = `700 10px ${MF}`;
    const w = G.measureText(g.sub.s).width + 24, y = vh * .37 + 49;
    panel(vw / 2 - w / 2, y - 13, w, 26); text(g.sub.s, vw / 2, y, `700 10px ${MF}`, LIME, 'center');
  }
  if (g.result === 'win' && !reducedMotion) for (let i = 0; i < 40; i++) {
    const x = ((i * 97) % vw), y = ((g.t * (160 + i % 5 * 30) + i * 61) % (vh + 40)) - 20;
    G.save(); G.translate(x, y); G.rotate(g.t * 4 + i); G.fillStyle = [LIME, GOLD, '#fff', PINK][i % 4]; G.fillRect(-3, -6, 6, 12); G.restore();
  }
}
function render() {
  useCtx(G); G.setTransform(1, 0, 0, 1, 0, 0); G.fillStyle = INK; G.fillRect(0, 0, cv.width, cv.height);
  if (!g) return;
  const z = g.cam.z || zoomBase(), o = shakeOff();
  G.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - g.cam.x * z + o[0]), dpr * (vh / 2 - g.cam.y * z + o[1]));
  drawWorld();
  G.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHUD();
}

// ---------- screens ----------
function show(id) {
  for (const s of ['menu', 'pack', 'end', 'cards', 'pause', 'help']) { $(s).classList.toggle('hidden', s !== id); $(s).inert = s !== id; }
  $('pauseBtn').classList.toggle('hidden', id !== null);
  if (id === 'menu') requestAnimationFrame(resize);
  if (id) { $(id).scrollTop = 0; const heading = $(id).querySelector('h1,h2,h3'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
  else cv.focus({ preventScroll: true });
}
function renderHero(t) {
  const w = heroCv.width, h = heroCv.height; if (w < 2) return;
  useCtx(HC); HC.setTransform(1, 0, 0, 1, 0, 0); HC.clearRect(0, 0, w, h);
  const kind = owned() ? rarity : 'legendary', f = FIGHTERS[kind];
  const s = Math.min(w / 175, h / 133); drawCat(w * .45, h * .55, s, { skin: f.skin, mood: 'smug', weapon: f.weapon, wAngle: .1, time: reducedMotion ? 1 : t, noShadow: true });
}
function openPack() {
  audio(); screen = 'pack'; show('pack'); g = null; $('pauseBtn').classList.add('hidden');
  pk = { taps: 0, shake: 0, ripples: [], open: null, t: 0, shown: false };
  $('packTitle').textContent = 'TAP THE PACK'; $('packTitle').style.color = LIME; $('packInfo').classList.add('hidden');
  $('packHint').textContent = 'Three taps. One fighter. All yours.';
  document.querySelectorAll('.pack-progress i').forEach(dot => dot.classList.remove('done'));
}
function roll() { const r = Math.random(); return r < .1 ? 'legendary' : r < .4 ? 'rare' : 'common'; }
stageCv.addEventListener('pointerdown', () => {
  if (screen !== 'pack' || pk.open != null) return;
  audio(); pk.taps++; pk.shake = reducedMotion ? 0 : 1; pk.ripples.push(pk.t); sfx('tap');
  document.querySelectorAll('.pack-progress i').forEach((dot, i) => dot.classList.toggle('done', i < pk.taps));
  if (pk.taps >= 3) { pk.open = pk.t; rarity = roll(); sfx('tear'); setTimeout(() => { if (screen === 'pack') sfx('reveal'); }, 700); $('packTitle').textContent = '...'; }
  else $('packTitle').textContent = `TAP ${3 - pk.taps} MORE`;
});
function renderPack(dt) {
  pk.t += dt; pk.shake = Math.max(0, pk.shake - dt * 3);
  useCtx(SG); SG.setTransform(1.5, 0, 0, 1.5, 0, 0); SG.fillStyle = INK; SG.fillRect(0, 0, 600, 780);
  const u = pk.open == null ? -1 : pk.t - pk.open, cx = 300, cy = 400, C = CARDS[rarity];
  rays(cx, cy, reducedMotion ? 0 : pk.t, u > .9 ? C.frame : LIME, u > 0 ? .1 : .04, 700);
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
    pk.shown = true; $('packTitle').textContent = C.name + '.'; $('packTitle').style.color = C.frame;
    $('packHint').textContent = C.label + ' · Added to your fighters';
    stageCv.setAttribute('aria-label', C.name + ' revealed. Choose Let’s drop in to play.');
    $('fighterDesc').textContent = DESC[rarity] + ` Ultimate: ${ULT[rarity].name}.`; $('packInfo').classList.remove('hidden');
    SAVE.cards[rarity]++; persist();
  }
}
const KINDS = ['common', 'rare', 'legendary'];
const KEYS = [['WASD', 'Move. You scratch any cat in reach automatically.'], ['SPACE', 'Pounce: a quick dash that ends in a free scratch.'], ['Q', 'Use your item: yarn bomb or laser pointer.'], ['E', 'Ultimate, once the ring is full.'], ['P / ESC', 'Pause.'], ['M', 'Mute or unmute.']];
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const cardCache = {};
function cardImg(kind) {
  if (!cardCache[kind]) { const c = document.createElement('canvas'); c.width = 300; c.height = 445; useCtx(c.getContext('2d')); drawCard(150, 222.5, 300, 445, kind, 1, 0, 1); cardCache[kind] = c.toDataURL('image/png'); }
  return cardCache[kind];
}
function catImg(skin, mood, weapon) {
  const c = document.createElement('canvas'); c.width = 520; c.height = 520; useCtx(c.getContext('2d'));
  drawCat(260, 330, 4.5, { skin, mood, weapon, wAngle: .1, time: 1, noShadow: true }); return c.toDataURL('image/png');
}
let controlsMode = null;
function refreshControls() {
  const mode = touchMode ? 'touch' : 'keyboard';
  if (controlsMode === mode) return; controlsMode = mode;
  const rows = touchMode ? [
    ['DRAG', 'Move with your left thumb. Get close to scratch automatically.'],
    ['POUNCE', 'Tap the paw to dash into a fight, or escape one.'],
    ['ITEM', 'Tap your item to throw yarn or use a laser pointer.'],
    ['ULT', 'Land hits to charge the ring. Tap it when full.']
  ] : KEYS.slice(0, 5);
  for (const id of ['pauseKeys', 'helpKeys']) $(id).innerHTML = rows.map(([k, d]) => `<div class="keyrow"><span class="keycap">${k}</span><span>${d}</span></div>`).join('');
}
refreshControls();

function refreshMenu() {
  $('recWins').textContent = SAVE.wins; $('recBest').textContent = SAVE.bestKills; $('recGames').textContent = SAVE.games;
  $('recCards').textContent = `${owned()}/3`; $('cardsBadge').textContent = `${owned()}/3`;
  if (!SAVE.cards[rarity]) rarity = KINDS.find(k => SAVE.cards[k] > 0) || 'common';
  const kind = owned() ? rarity : 'legendary', C = CARDS[kind], others = KINDS.filter(k => k !== kind);
  $('menuCardA').src = cardImg(others[0]); $('menuCardB').src = cardImg(others[1]);
  $('heroLabel').textContent = owned() ? 'YOUR FIGHTER' : 'MEET YOUR NEXT MAIN';
  $('heroRarity').textContent = C.label; $('heroName').textContent = C.name;
  $('heroPerk').textContent = kind === 'legendary' ? 'The crown comes with claws.' : kind === 'rare' ? 'Built like a tank. Hits like a truck.' : 'Quick paws. Absolutely no chill.';
  $('playHint').textContent = owned() ? `Ready as ${C.name.toLowerCase()}. Change your fighter in the lineup.` : 'Your first pack is free. No wallet. No sign-up.';
}
function startGame() { audio(); SAVE.selected = rarity; persist(); newGame(rarity); screen = 'game'; show(null); $('pauseBtn').classList.remove('hidden'); for (const k in keys) keys[k] = false; }
function pauseGame() {
  if (screen !== 'game' || !g || g.result) return;
  screen = 'pause'; show('pause'); joy.active = false; joy.id = null;
  $('pauseInfo').textContent = `// ROUND ${fmt(g.ft)} · ${g.cats.filter(c => c.alive).length} CATS LEFT`; $('btnPauseSound').textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
}
function resumeGame() { if (screen !== 'pause') return; screen = 'game'; show(null); for (const k in keys) keys[k] = false; }
function toMenu() { g = null; screen = 'menu'; show('menu'); $('pauseBtn').classList.add('hidden'); refreshMenu(); }
function openCards() {
  screen = 'cards'; show('cards'); $('pauseBtn').classList.add('hidden'); g = null;
  $('cardsSub').textContent = owned() ? `You've pulled ${owned()} of 3. Play as one you own, or open a new pack for a shot at the Legendary.` : 'No cards yet. Open a pack to pull your first fighter.';
  $('cardGrid').innerHTML = KINDS.map(k => {
    const C = CARDS[k], n = SAVE.cards[k], own = n > 0, sel = own && k === rarity, col = k === 'legendary' ? GOLD : k === 'rare' ? '#8fa9ff' : MUTED;
    return `<div class="fcol"><div class="fcard${sel ? ' sel' : ''}${own ? '' : ' locked'}">${sel ? '<span class="badge">SELECTED</span>' : ''}
      <div class="fimg"><img src="${cardImg(k)}" alt="${C.name} card">${own ? '' : '<span class="q">?</span>'}</div>
      <div class="finfo"><small style="color:${col}">${C.label} · ${own ? 'OWNED ×' + n : 'NOT PULLED'}</small><b>${C.name}</b><p>${PERKS[k]}</p>
      <small class="u" style="color:${k === 'legendary' && !own ? GOLD : LIME}">ULTIMATE</small><em style="color:${k === 'legendary' && !own ? GOLD : LIME}">${ULT[k].name}</em><p>${ULT[k].desc}</p></div></div>
      ${own ? `<button class="btn ${sel ? 'lime' : 'outline-w'}" data-play="${k}">PLAY AS ${C.name}</button>` : `<button class="btn outline-g" data-pull="1">PULL TO UNLOCK</button>`}</div>`;
  }).join('');
}
$('cardGrid').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) { if (b.dataset.play) { rarity = b.dataset.play; startGame(); } else openPack(); return; }
  const col = e.target.closest('.fcol'); if (!col) return; const k = KINDS[[...$('cardGrid').children].indexOf(col)]; if (SAVE.cards[k] > 0) { rarity = k; openCards(); }
});
function showEnd() {
  screen = 'end'; show('end'); $('pauseBtn').classList.add('hidden');
  const win = g.result === 'win', p = g.p, C = CARDS[rarity], newBest = p.kills > 0 && p.kills > SAVE.bestKills;
  SAVE.games++; if (win) SAVE.wins++; SAVE.bestKills = Math.max(SAVE.bestKills, p.kills); persist();
  $('endKicker').textContent = `// ROUND OVER · SURVIVED ${fmt(g.ft)}`;
  $('endTitle').innerHTML = win ? 'WINNER<br>WINNER' : 'SCRATCHED<br>OUT.';
  $('endSub').textContent = win ? 'TUNA DINNER.' : `#${g.place} OF 10`;
  $('endHead').textContent = win ? 'LAST CAT STANDING · #1 OF 10' : `YOU PLACED #${g.place} OF 10`;
  $('endBest').classList.toggle('hidden', !newBest);
  $('endCat').src = catImg(FIGHTERS[rarity].skin, win ? 'smug' : 'dead', FIGHTERS[rarity].weapon);
  $('endStats').innerHTML = [['PLACE', `#${g.place}/10`, LIME], ['KILLS', p.kills, '#fff'], ['LIVES LEFT', `${p.lives}/9`, '#fff'], ['DAMAGE DEALT', p.dealt, '#fff'], ['BEST STREAK', p.bestStreak ? 'X' + p.bestStreak : '0', '#fff'], ['LOOT GRABBED', p.loot, '#fff']]
    .map(([l, v, c]) => `<div class="stat"><small>${l}</small><b style="color:${c}">${v}</b></div>`).join('');
  $('endCardImg').src = cardImg(rarity); $('endCardLabel').textContent = `PLAYED AS · ${C.label}`; $('endCardLabel').style.color = rarity === 'legendary' ? GOLD : rarity === 'rare' ? '#8fa9ff' : MUTED;
  $('endCardName').textContent = C.name;
  $('endCause').textContent = (win ? 'You outlasted 9 cats.' : `You ${g.cause}.`) + ` ${ULT[rarity].name.toLowerCase().replace(/(^|\s|-)\S/g, m => m.toUpperCase())} used ${p.ults === 1 ? 'once' : p.ults + ' times'}.`;
}
function shareText() {
  const C = CARDS[rarity], p = g.p;
  return g.result === 'win'
    ? `Pulled a ${C.label} ${C.name} and won CMBG: Last Cat Standing 🐾 ${p.kills} kills, ${p.lives}/9 lives left.\n\nGmeow or get scratched out @Cmbg_RH`
    : `Placed #${g.place}/10 in CMBG: Last Cat Standing 🐾 ${p.kills} kills as a ${C.label} ${C.name}.\n\nGmeow or get scratched out @Cmbg_RH`;
}
const play = () => owned() ? startGame() : openPack();
$('btnPlay').onclick = play;
$('btnNewPack').onclick = openPack;
$('btnPackBack').onclick = toMenu;
$('btnEndMenu').onclick = toMenu;
$('menu').querySelector('.brand').onclick = e => { e.preventDefault(); toMenu(); };
stageCv.addEventListener('keydown', e => { if (e.code === 'Enter' && screen === 'pack' && pk.open == null) { e.preventDefault(); stageCv.dispatchEvent(new PointerEvent('pointerdown')); } });
$('btnCards').onclick = openCards;
$('btnCardsBack').onclick = toMenu;
$('btnCardsPack').onclick = openPack;
$('btnHow').onclick = () => { screen = 'help'; show('help'); };
$('btnHelpBack').onclick = () => { screen = 'menu'; show('menu'); };
$('btnSound').onclick = () => { setMute(!muted); audio(); $('btnSound').textContent = muted ? 'SOUND OFF' : 'SOUND ON'; };
$('btnDrop').onclick = startGame;
$('btnAgain').onclick = startGame;
$('btnEndCards').onclick = openCards;
$('pauseBtn').onclick = e => { e.stopPropagation(); pauseGame(); };
$('btnResume').onclick = resumeGame;
$('btnRestart').onclick = () => { show(null); startGame(); };
$('btnQuit').onclick = toMenu;
$('btnPauseSound').onclick = () => { setMute(!muted); $('btnPauseSound').textContent = muted ? 'SOUND: OFF' : 'SOUND: ON'; };
$('btnShare').onclick = () => {
  const url = location.protocol.startsWith('http') ? location.origin + location.pathname : '';
  window.open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + (url ? '&url=' + encodeURIComponent(url) : ''), '_blank', 'noopener');
};

// ---------- input ----------
addEventListener('keydown', e => {
  if (e.target.closest('button,a') && ['Enter', 'Space'].includes(e.code)) return;
  keys[e.code] = true;
  if (/^(Key[WASDQE]|Arrow|Space)/.test(e.code) && touchMode) { touchMode = false; refreshControls(); }
  if (e.code === 'Space') { e.preventDefault(); if (screen === 'game') pounce(); else if (screen === 'pack' && pk.open == null) stageCv.dispatchEvent(new PointerEvent('pointerdown')); }
  if (e.code === 'KeyQ' && screen === 'game') useItem();
  if (e.code === 'KeyE' && screen === 'game') ultimate();
  if (e.code === 'KeyP' || e.code === 'Escape') { if (screen === 'game') pauseGame(); else if (screen === 'pause') resumeGame(); else if (['help', 'pack', 'cards', 'end'].includes(screen)) toMenu(); }
  if (e.code === 'KeyM') { setMute(!muted); $('btnSound').textContent = muted ? 'SOUND OFF' : 'SOUND ON'; }
  if (e.code === 'Enter') { if (screen === 'menu') play(); else if (screen === 'end') startGame(); else if (screen === 'pack' && pk.shown) startGame(); else if (screen === 'pause') resumeGame(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.active = false; joy.id = null; if (screen === 'game' && g && g.phase === 'fight') pauseGame(); });
cv.addEventListener('pointerdown', e => {
  audio(); if (screen !== 'game') return;
  if (e.pointerType === 'touch' && !touchMode) { touchMode = true; refreshControls(); }
  const B = hudButtons(), near = b => Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r + 6;
  if (near(B.ult)) { ultimate(); return; }
  if (near(B.item)) { useItem(); return; }
  if (near(B.pounce)) { pounce(); return; }
  if ((!touchHUD() || e.clientX < vw * .52) && joy.id == null) { joy.id = e.pointerId; joy.active = true; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const endJoy = e => { if (e.pointerId === joy.id) { joy.id = null; joy.active = false; } };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);

// ---------- loop ----------
let last = 0;
function frame(ms) {
  const s = ms / 1000, dt = Math.min(.05, last ? s - last : 0); last = s;
  if (screen === 'menu' || screen === 'help') renderHero(s);
  else if (screen === 'pack') renderPack(dt);
  if (g && (screen === 'game' || screen === 'end')) update(dt);
  if (g && (screen === 'game' || screen === 'end' || screen === 'pause')) render();
  requestAnimationFrame(frame);
}
document.fonts.ready.then(() => {
  arenaFloor = null;
  for (const kind of KINDS) delete cardCache[kind];
  resize();
  if (screen === 'menu') refreshMenu();
  else if (screen === 'cards') openCards();
});
resize();
refreshMenu();
requestAnimationFrame(frame);
window.__lcs = { get g() { return g; }, get screen() { return screen; }, startGame, openPack, pounce, useItem, ultimate, setRarity: r => { rarity = r; } };
