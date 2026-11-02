// Shared drawing code for the game: cats, cards, pack, arena props, items. Everything is drawn into the current context X.
let X = null;
const useCtx = c => { X = c; };
const TAU = Math.PI * 2;
const LIME = '#d4ff00', INK = '#0b0b0b', INK2 = '#1b1b1b', INK3 = '#242424', MUTED = '#c9c9c9', RED = '#ff3d4d', GOLD = '#ffc83d', PINK = '#ff8fc0', BONE = '#f3eee2', GREEN = '#22c46b';
const DF = "'Anton',Impact,'Arial Narrow',sans-serif", MF = "'JetBrains Mono',Consolas,monospace";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const ss = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const eOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const eIn = t => Math.pow(clamp(t, 0, 1), 3);
const eBack = t => { t = clamp(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const FURS = {
  royal: { fur: '#f6eddc', fur2: '#e0cfae', belly: '#ffffff', pattern: 'plain', eye: '#36c8ff', acc: ['crown', 'chain'] },
  street: { fur: '#f08a3c', fur2: '#b9541b', belly: '#ffe0bf', pattern: 'tabby', eye: '#9be15d', acc: ['bandana'] },
  boss: { fur: '#7f8792', fur2: '#59606a', belly: '#cfd4da', pattern: 'tabby', eye: '#ffd23d', acc: ['patch', 'scar'] },
  gray: { fur: '#aab1bb', fur2: '#858c96', belly: '#e9edf2', pattern: 'tabby', eye: '#ffd23d' },
  tux: { fur: '#2e2e35', fur2: '#2e2e35', belly: '#ffffff', pattern: 'tux', eye: '#9be15d' },
  ginger: { fur: '#e99a52', fur2: '#c06a26', belly: '#ffe9d2', pattern: 'tabby', eye: '#9be15d' },
  calico: { fur: '#fbf7f0', fur2: '#ec8a3e', fur3: '#2e2e35', belly: '#ffffff', pattern: 'calico', eye: '#ffd23d' },
  black: { fur: '#2a2a30', fur2: '#2a2a30', belly: '#3d3d46', pattern: 'plain', eye: '#d4ff00' },
  siamese: { fur: '#efe2cc', fur2: '#5a4436', belly: '#fff8ee', pattern: 'siamese', eye: '#3d9bff' },
  lilac: { fur: '#c3b3e3', fur2: '#9d89c9', belly: '#f1ecfb', pattern: 'plain', eye: '#ffd23d' },
  brown: { fur: '#8d5d3a', fur2: '#5e3b22', belly: '#e8cdb3', pattern: 'tabby', eye: '#9be15d' },
  smoke: { fur: '#66707c', fur2: '#4a535e', belly: '#939da8', pattern: 'plain', eye: '#ff5a5a' },
  ghost: { fur: '#eef4ff', fur2: '#cfd9ec', belly: '#ffffff', pattern: 'plain', eye: '#ffffff' }
};

function foot(x, y, c) { X.beginPath(); X.ellipse(x, y, 7.5, 5.5, 0, 0, TAU); X.fillStyle = c; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }

function drawCat(x, y, s, o) {
  const f = FURS[o.skin] || FURS.gray, acc = o.acc || f.acc || [], T = o.time || 0, mv = !!o.moving, ph = o.walk || 0;
  const bob = mv ? -Math.abs(Math.sin(ph)) * 4 : Math.sin(T * 2.4) * 1.3;
  X.save(); X.translate(x, y); X.scale(s, s);
  if (o.ring) { X.strokeStyle = o.ring; X.lineWidth = 3.5; X.beginPath(); X.ellipse(0, 31, 35, 11, 0, 0, TAU); X.stroke(); }
  if (!o.noShadow) { X.fillStyle = 'rgba(0,0,0,.45)'; X.beginPath(); X.ellipse(0, 31, 27, 8, 0, 0, TAU); X.fill(); }
  X.scale(o.face || 1, 1);
  if (o.hurt) X.filter = 'brightness(2.4)';
  X.lineJoin = 'round'; X.lineCap = 'round';
  const tw = Math.sin(T * 5) * .5;
  X.beginPath(); X.moveTo(-15, 17); X.bezierCurveTo(-40, 18, -46, -4, -35 + tw * 7, -22);
  X.strokeStyle = INK; X.lineWidth = 14; X.stroke(); X.strokeStyle = f.pattern === 'siamese' ? f.fur2 : f.fur; X.lineWidth = 7; X.stroke();
  const k = mv ? Math.sin(ph) * 5 : 0;
  foot(-11 + k, 27, f.fur); foot(9 - k, 28, f.fur);
  X.beginPath(); X.ellipse(0, 11 + bob * .4, 21, 17, 0, 0, TAU); X.fillStyle = f.fur; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.ellipse(6, 15 + bob * .4, 10, 10, 0, 0, TAU); X.fillStyle = f.belly; X.fill();
  if (acc.includes('chain')) chain(bob * .4);
  X.save(); X.translate(3, -17 + bob); X.rotate(o.tilt || 0); head(f, o, acc); X.restore();
  weapon(o, f);
  X.filter = 'none';
  X.restore();
}

function chain(b) {
  X.beginPath(); X.moveTo(-14, -2 + b); X.quadraticCurveTo(3, 16 + b, 20, -2 + b); X.lineWidth = 7; X.strokeStyle = INK; X.stroke();
  X.lineWidth = 4; X.strokeStyle = GOLD; X.setLineDash([4, 3]); X.stroke(); X.setLineDash([]);
  X.beginPath(); X.arc(3.5, 7 + b, 6.5, 0, TAU); X.fillStyle = GOLD; X.fill(); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke();
}

function head(f, o, acc) {
  const earC = f.pattern === 'siamese' ? f.fur2 : f.fur;
  for (const sx of [-1, 1]) {
    X.beginPath(); X.moveTo(sx * 6 - 1, -18); X.lineTo(sx * 20 + 1, -39); X.lineTo(sx * 27 + 1, -9); X.closePath();
    X.fillStyle = earC; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    X.beginPath(); X.moveTo(sx * 10, -17); X.lineTo(sx * 19.5 + 1, -31); X.lineTo(sx * 23, -13); X.closePath(); X.fillStyle = '#ff9fb4'; X.fill();
  }
  X.beginPath(); X.ellipse(0, 0, 29, 24, 0, 0, TAU); X.fillStyle = f.fur; X.fill();
  X.save(); X.beginPath(); X.ellipse(0, 0, 29, 24, 0, 0, TAU); X.clip();
  if (f.pattern === 'tabby') { X.strokeStyle = f.fur2; X.lineWidth = 4; X.beginPath(); for (const i of [-1, 0, 1]) { X.moveTo(i * 8 + 3, -25); X.lineTo(i * 7 + 3, -15); } X.moveTo(-30, 1); X.lineTo(-20, 2); X.moveTo(-30, 8); X.lineTo(-21, 7); X.moveTo(30, 1); X.lineTo(23, 2); X.stroke(); }
  if (f.pattern === 'tux') { X.fillStyle = '#fff'; X.beginPath(); X.ellipse(7, 12, 15, 11, 0, 0, TAU); X.fill(); X.beginPath(); X.moveTo(7, -6); X.lineTo(1, 8); X.lineTo(13, 8); X.fill(); }
  if (f.pattern === 'calico') { X.fillStyle = f.fur2; X.beginPath(); X.ellipse(-16, -12, 16, 13, 0, 0, TAU); X.fill(); X.fillStyle = f.fur3; X.beginPath(); X.ellipse(20, -16, 13, 11, .3, 0, TAU); X.fill(); }
  if (f.pattern === 'siamese') { X.fillStyle = f.fur2; X.beginPath(); X.ellipse(6, 9, 16, 13, 0, 0, TAU); X.fill(); }
  X.restore();
  X.beginPath(); X.ellipse(0, 0, 29, 24, 0, 0, TAU); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  face(f, o);
  if (acc.includes('patch')) { X.fillStyle = '#111'; X.beginPath(); X.ellipse(-5, -2, 9.5, 10.5, 0, 0, TAU); X.fill(); X.strokeStyle = '#111'; X.lineWidth = 3; X.beginPath(); X.moveTo(-27, -14); X.lineTo(27, -19); X.stroke(); }
  if (acc.includes('scar')) { X.strokeStyle = '#ff9fb4'; X.lineWidth = 3; X.beginPath(); X.moveTo(9, -16); X.lineTo(21, 8); X.moveTo(14, -17); X.lineTo(24, 2); X.stroke(); }
  if (acc.includes('shades')) { X.fillStyle = INK; X.beginPath(); X.roundRect(-14, -9, 17, 12, 4); X.roundRect(7, -9, 17, 12, 4); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(3, -5); X.lineTo(7, -5); X.moveTo(-14, -6); X.lineTo(-28, -9); X.stroke(); X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(-11, -7, 5, 3); X.fillRect(10, -7, 5, 3); }
  if (acc.includes('monocle')) { X.strokeStyle = GOLD; X.lineWidth = 3; X.beginPath(); X.arc(15, -2, 10, 0, TAU); X.stroke(); X.lineWidth = 2; X.beginPath(); X.moveTo(15, 8); X.quadraticCurveTo(18, 22, 8, 30); X.stroke(); }
  if (acc.includes('bandana')) { X.beginPath(); X.moveTo(-28, -11); X.quadraticCurveTo(0, -22, 28, -14); X.lineTo(29, -6); X.quadraticCurveTo(0, -14, -28, -3); X.closePath(); X.fillStyle = RED; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.moveTo(-27, -7); X.lineTo(-41, -15); X.lineTo(-38, -1); X.closePath(); X.fill(); X.stroke(); }
  if (acc.includes('crown')) {
    X.beginPath(); X.moveTo(-15, -20); X.lineTo(-17, -42); X.lineTo(-7, -31); X.lineTo(2, -48); X.lineTo(11, -31); X.lineTo(21, -42); X.lineTo(19, -20); X.closePath();
    X.fillStyle = GOLD; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
    X.fillStyle = RED; X.beginPath(); X.arc(2, -27, 3.2, 0, TAU); X.fill();
    X.fillStyle = '#36c8ff'; X.beginPath(); X.arc(-9, -25, 2.4, 0, TAU); X.fill(); X.beginPath(); X.arc(13, -25, 2.4, 0, TAU); X.fill();
  }
}

function face(f, o) {
  const m = o.mood || 'normal';
  for (const ex of [-5, 15]) {
    if (m === 'dead') { X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(ex - 5, -7); X.lineTo(ex + 5, 3); X.moveTo(ex + 5, -7); X.lineTo(ex - 5, 3); X.stroke(); continue; }
    X.beginPath(); X.ellipse(ex, -2, 7, 8.5, 0, 0, TAU); X.fillStyle = '#fff'; X.fill(); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke();
    const big = m === 'feral';
    X.beginPath(); X.ellipse(ex + 2, -1, big ? 5.5 : 4.5, big ? 7 : 6, 0, 0, TAU); X.fillStyle = f.eye; X.fill();
    X.beginPath(); X.ellipse(ex + 2.5, -1, big ? 4.6 : 1.8, big ? 6 : 4.6, 0, 0, TAU); X.fillStyle = INK; X.fill();
    X.beginPath(); X.arc(ex + .3, -4.5, 1.9, 0, TAU); X.fillStyle = '#fff'; X.fill();
    if (m === 'smug') { X.beginPath(); X.ellipse(ex, -2, 8, 9.5, 0, Math.PI, TAU); X.fillStyle = f.pattern === 'siamese' ? f.fur2 : f.fur; X.fill(); X.beginPath(); X.moveTo(ex - 8, -2); X.lineTo(ex + 8, -2); X.lineWidth = 2.5; X.strokeStyle = INK; X.stroke(); }
    if (m === 'angry') { const l = ex < 5; X.beginPath(); X.moveTo(ex - 7, l ? -14 : -9); X.lineTo(ex + 7, l ? -9 : -14); X.lineWidth = 4; X.strokeStyle = INK; X.stroke(); }
  }
  X.beginPath(); X.moveTo(2, 6); X.lineTo(10, 6); X.lineTo(6, 10); X.closePath(); X.fillStyle = '#ff7a9a'; X.fill(); X.lineWidth = 2; X.strokeStyle = INK; X.stroke();
  if (m === 'angry' || m === 'feral') { X.beginPath(); X.ellipse(6, 14.5, 4.5, 3.5, 0, 0, TAU); X.fillStyle = '#5a1020'; X.fill(); X.stroke(); X.fillStyle = '#fff'; X.beginPath(); X.moveTo(3, 12); X.lineTo(5.5, 12); X.lineTo(4.2, 15.5); X.fill(); }
  else { X.beginPath(); X.moveTo(1, 12); X.quadraticCurveTo(3.5, 15, 6, 11); X.quadraticCurveTo(8.5, 15, 11, 12); X.lineWidth = 2.4; X.strokeStyle = INK; X.stroke(); }
  X.lineWidth = 1.8; X.strokeStyle = INK; X.beginPath(); X.moveTo(19, 7); X.lineTo(36, 4); X.moveTo(19, 10); X.lineTo(36, 12); X.moveTo(-6, 7); X.lineTo(-24, 4); X.moveTo(-6, 10); X.lineTo(-24, 12); X.stroke();
}

function fishBlade(a) {
  X.save(); X.translate(20, 12); X.rotate(a);
  X.beginPath(); X.moveTo(2, 0); X.lineTo(-11, -9); X.lineTo(-11, 9); X.closePath(); X.fillStyle = BONE; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.moveTo(0, 0); X.lineTo(52, 0); X.lineWidth = 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = 4; X.strokeStyle = BONE; X.stroke();
  for (let i = 0; i < 5; i++) { const x = 12 + i * 8.5, h = 11 - Math.abs(i - 2) * 2; X.beginPath(); X.moveTo(x - 2, -h); X.lineTo(x + 2, h); X.lineWidth = 5.5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.6; X.strokeStyle = BONE; X.stroke(); }
  X.beginPath(); X.moveTo(49, -11); X.quadraticCurveTo(76, 0, 49, 11); X.closePath(); X.fillStyle = BONE; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.arc(57, -2, 2.4, 0, TAU); X.fillStyle = INK; X.fill();
  X.restore();
}

function weapon(o, f) {
  if (o.weapon === 'fish') {
    let a = o.wAngle != null ? o.wAngle : -.55;
    if (o.swing != null) {
      a = lerp(-2.1, .9, eOut(o.swing));
      X.save(); X.globalAlpha = (1 - o.swing) * .9; X.strokeStyle = LIME; X.lineWidth = 9; X.beginPath(); X.arc(20, 12, 64, -2.1, a); X.stroke(); X.restore();
    }
    fishBlade(a); foot(20, 12, f.fur);
  } else if (o.swing != null) {
    const heavy = o.weapon === 'heavy';
    X.save(); X.globalAlpha = 1 - o.swing; X.strokeStyle = heavy ? GOLD : '#fff'; X.lineWidth = heavy ? 7 : 4;
    for (let k = 0; k < 3; k++) { X.beginPath(); X.arc(16, 6, (heavy ? 40 : 34) + k * (heavy ? 11 : 8), -1.3 + o.swing * .6, -.1 + o.swing * .9); X.stroke(); }
    X.restore();
    foot(24, 2 - 6 * Math.sin(o.swing * Math.PI), f.fur);
  } else foot(19, 22, f.fur);
}

function paw(x, y, r, fill, stroke) {
  X.beginPath(); X.ellipse(x, y + r * .25, r * .52, r * .42, 0, 0, TAU);
  for (const [a, b] of [[-.58, -.3], [-.2, -.62], [.2, -.62], [.58, -.3]]) { X.moveTo(x + a * r + r * .2, y + b * r); X.arc(x + a * r, y + b * r, r * .2, 0, TAU); }
  if (fill) { X.fillStyle = fill; X.fill(); }
  if (stroke) { X.lineWidth = 2.5; X.strokeStyle = stroke; X.stroke(); }
}

function star(x, y, r, c) { X.beginPath(); X.moveTo(x, y - r); X.quadraticCurveTo(x, y, x + r, y); X.quadraticCurveTo(x, y, x, y + r); X.quadraticCurveTo(x, y, x - r, y); X.quadraticCurveTo(x, y, x, y - r); X.fillStyle = c; X.fill(); }

function tag(x, y, s, c, lives, max) {
  X.font = `700 15px ${MF}`; const w = X.measureText(s).width + 16;
  X.fillStyle = 'rgba(11,11,11,.78)'; X.beginPath(); X.roundRect(x - w / 2, y - 12, w, 24, 5); X.fill();
  X.fillStyle = c; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(s, x, y + 1);
  if (max) { const bw = 9, gap = 3, tw = max * bw + (max - 1) * gap; for (let i = 0; i < max; i++) { X.fillStyle = i < lives ? (c === LIME ? LIME : RED) : 'rgba(255,255,255,.18)'; X.fillRect(x - tw / 2 + i * (bw + gap), y + 16, bw, 5); } }
}

const CARDS = {
  common: { label: 'COMMON', name: 'STREET CAT', frame: '#c9c9c9', tint: '#262626', skin: 'street', stats: [4, 2, 2], sig: 'SCRAPPY CLAWS', odds: '60%' },
  rare: { label: 'RARE', name: 'ALLEY BOSS', frame: '#4d7bff', tint: '#141f42', skin: 'boss', stats: [2, 5, 3], sig: 'HEAVY PAW', odds: '30%' },
  legendary: { label: 'LEGENDARY', name: 'CHAIN ROYALTY', frame: GOLD, tint: '#3a2a06', skin: 'royal', stats: [4, 4, 5], sig: 'FISHBONE BLADE', odds: '10%' }
};
function dagger(x, y, r, s) {
  X.save(); X.translate(x, y); X.rotate(r); X.scale(s, s);
  X.beginPath(); X.moveTo(0, -120); X.lineTo(15, -30); X.lineTo(0, -18); X.lineTo(-15, -30); X.closePath(); X.fillStyle = '#e3e9ff'; X.fill(); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.moveTo(0, -110); X.lineTo(0, -32); X.lineWidth = 2; X.strokeStyle = '#9aa6d6'; X.stroke();
  X.beginPath(); X.roundRect(-30, -24, 60, 12, 5); X.fillStyle = GOLD; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.roundRect(-7, -12, 14, 40, 4); X.fillStyle = '#5a3a22'; X.fill(); X.stroke();
  X.beginPath(); X.arc(0, 34, 8, 0, TAU); X.fillStyle = GOLD; X.fill(); X.stroke(); X.restore();
}
function teeth(x, y, w, c) { X.beginPath(); X.moveTo(x, y); for (let i = 0; i <= w / 24; i++) { X.lineTo(x + i * 24 + 12, y + 12); X.lineTo(x + i * 24 + 24, y); } X.lineTo(x + w, y); X.fillStyle = c; X.fill(); }
function drawPack(cx, cy, w, h, rot, torn, alpha) {
  X.save(); X.globalAlpha = alpha; X.translate(cx, cy); X.rotate(rot); X.scale(w / 380, h / 540); w = 380; h = 540; const x = -w / 2, y = -h / 2;
  X.beginPath(); X.roundRect(x, y + 34, w, h - 34, 22); X.fillStyle = '#2648d0'; X.fill(); X.lineWidth = 7; X.strokeStyle = INK; X.stroke();
  X.save(); X.clip(); X.fillStyle = 'rgba(255,255,255,.08)'; X.beginPath(); X.moveTo(x + 60, y); X.lineTo(x + 150, y); X.lineTo(x - 20, y + h); X.lineTo(x - 110, y + h); X.fill(); X.restore();
  X.fillStyle = '#1a34a6'; X.fillRect(x + 4, y + h - 40, w - 8, 30); teeth(x + 4, y + h - 40, w - 8, '#2648d0');
  if (!torn) { X.beginPath(); X.roundRect(x, y, w, 48, [22, 22, 0, 0]); X.fillStyle = '#1a34a6'; X.fill(); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); teeth(x + 4, y + 40, w - 8, '#2648d0'); }
  X.font = `700 21px ${MF}`; X.fillStyle = LIME; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('CARD PACK · 1 FIGHTER', 0, y + 84);
  dagger(0, -20, -.62, 1.05); dagger(0, -20, .62, 1.05);
  X.save(); X.rotate(-.08); X.font = `150px ${DF}`; X.lineJoin = 'round'; X.lineWidth = 16; X.strokeStyle = INK; X.strokeText('CMBG', 0, h * .27); X.fillStyle = LIME; X.fillText('CMBG', 0, h * .27); X.restore();
  X.font = `700 18px ${MF}`; X.fillStyle = '#b9c6ff'; X.fillText('COMMON · RARE · LEGENDARY', 0, y + h - 62);
  X.restore();
}
function drawCard(cx, cy, w, h, kind, flip, rot, t, alpha) {
  const c = CARDS[kind], u = w / 300;
  X.save(); X.globalAlpha = alpha == null ? 1 : alpha; X.translate(cx, cy); X.rotate(rot || 0); X.scale(Math.max(.02, Math.abs(Math.cos((1 - flip) * Math.PI))), 1);
  const x = -w / 2, y = -h / 2;
  if (flip < .5) {
    X.beginPath(); X.roundRect(x, y, w, h, 18 * u); X.fillStyle = INK2; X.fill(); X.lineWidth = 7 * u; X.strokeStyle = LIME; X.stroke();
    dagger(0, -10 * u, -.62, .55 * u); dagger(0, -10 * u, .62, .55 * u);
    X.font = `${74 * u}px ${DF}`; X.fillStyle = LIME; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('CMBG', 0, h * .3);
  } else {
    X.beginPath(); X.roundRect(x, y, w, h, 18 * u); X.fillStyle = c.frame; X.fill(); X.lineWidth = 6 * u; X.strokeStyle = INK; X.stroke();
    const ix = x + 14 * u, iy = y + 14 * u, iw = w - 28 * u, ih = h - 28 * u;
    X.beginPath(); X.roundRect(ix, iy, iw, ih, 10 * u); X.fillStyle = INK2; X.fill();
    const ph = ih * .48;
    X.save(); X.beginPath(); X.roundRect(ix + 10 * u, iy + 10 * u, iw - 20 * u, ph, 8 * u); X.fillStyle = c.tint; X.fill(); X.clip();
    X.strokeStyle = 'rgba(255,255,255,.05)'; X.lineWidth = 14 * u; for (let i = -4; i < 14; i++) { X.beginPath(); X.moveTo(ix + i * 40 * u, iy); X.lineTo(ix + i * 40 * u - 200 * u, iy + ph + 40 * u); X.stroke(); }
    const ga = X.globalAlpha; X.globalAlpha = ga * .3; X.beginPath(); X.arc(0, iy + 10 * u + ph * .56, 92 * u, 0, TAU); X.fillStyle = c.frame; X.fill(); X.globalAlpha = ga;
    drawCat(-6 * u, iy + 10 * u + ph * .64, 1.85 * u, { skin: c.skin, time: t, mood: kind === 'legendary' ? 'smug' : kind === 'rare' ? 'angry' : 'normal', weapon: kind === 'legendary' ? 'fish' : null });
    X.restore();
    const by = iy + ph + 22 * u;
    X.beginPath(); X.roundRect(ix + 10 * u, by, iw - 20 * u, 36 * u, 6 * u); X.fillStyle = c.frame; X.fill();
    X.font = `${24 * u}px ${DF}`; X.fillStyle = INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(c.label, 0, by + 19 * u);
    X.font = `${38 * u}px ${DF}`; X.fillStyle = '#fff'; X.fillText(c.name, 0, by + 68 * u);
    ['SPEED', 'CLAWS', 'DRIP'].forEach((l, i) => {
      const yy = by + 104 * u + i * 26 * u; X.font = `700 ${14 * u}px ${MF}`; X.fillStyle = MUTED; X.textAlign = 'left'; X.fillText(l, ix + 24 * u, yy);
      for (let j = 0; j < 5; j++) { X.fillStyle = j < c.stats[i] ? c.frame : '#333'; X.fillRect(ix + 108 * u + j * 27 * u, yy - 6 * u, 22 * u, 12 * u); }
    });
    X.font = `700 ${13 * u}px ${MF}`; X.fillStyle = c.frame; X.textAlign = 'center'; X.fillText('// ' + c.sig, 0, y + h - 24 * u);
  }
  X.restore();
}
function rays(cx, cy, u, c, a, R) { X.save(); X.translate(cx, cy); X.rotate(u * .25); X.fillStyle = c; X.globalAlpha = a; for (let i = 0; i < 16; i++) { const b = i * TAU / 16; X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, R || 1500, b, b + TAU / 34); X.fill(); } X.restore(); }

function crate(x, y) {
  X.fillStyle = 'rgba(0,0,0,.45)'; X.beginPath(); X.ellipse(x, y + 44, 46, 12, 0, 0, TAU); X.fill();
  X.beginPath(); X.roundRect(x - 40, y - 30, 80, 70, 6); X.fillStyle = '#2a2118'; X.fill(); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
  X.beginPath(); X.roundRect(x - 40, y - 46, 80, 40, 6); X.fillStyle = '#4a3a28'; X.fill(); X.stroke();
  X.strokeStyle = '#33281c'; X.lineWidth = 3; X.beginPath(); X.moveTo(x - 30, y - 26); X.lineTo(x + 30, y - 26); X.moveTo(x - 34, y + 4); X.lineTo(x + 34, y + 4); X.stroke();
  X.font = `700 14px ${MF}`; X.fillStyle = LIME; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('CMBG', x, y + 20);
}
function candle(x, y, c, h, w) {
  w = w || 40; X.fillStyle = 'rgba(0,0,0,.45)'; X.beginPath(); X.ellipse(x, y + 6, w * .9, 10, 0, 0, TAU); X.fill();
  X.lineCap = 'round'; X.lineWidth = 5; X.strokeStyle = INK; X.beginPath(); X.moveTo(x, y - h - 34); X.lineTo(x, y + 18); X.stroke();
  X.lineWidth = 2.5; X.strokeStyle = c; X.beginPath(); X.moveTo(x, y - h - 32); X.lineTo(x, y + 16); X.stroke();
  X.beginPath(); X.roundRect(x - w / 2, y - h, w, h, 4); X.fillStyle = c; X.fill(); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.22)'; X.fillRect(x - w / 2 + 7, y - h + 8, 6, h - 16);
}
function yarnBall(x, y, r, rot) {
  X.save(); X.translate(x, y); X.rotate(rot); X.beginPath(); X.arc(0, 0, r, 0, TAU); X.fillStyle = PINK; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  X.strokeStyle = '#d9578f'; X.lineWidth = 2.5; for (const k of [-.5, 0, .5]) { X.beginPath(); X.ellipse(0, 0, r * .85, r * .35, k * 2, 0, TAU); X.stroke(); } X.restore();
}
function catnip(x, y, r) {
  X.save(); X.translate(x, y);
  for (const a of [-.9, 0, .9]) { X.save(); X.rotate(a); X.beginPath(); X.ellipse(0, -r * .55, r * .38, r * .62, 0, 0, TAU); X.fillStyle = GREEN; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.moveTo(0, -r * .1); X.lineTo(0, -r); X.lineWidth = 2; X.strokeStyle = '#0f6e3a'; X.stroke(); X.restore(); }
  X.restore();
}
function laserPen(x, y, r) {
  X.save(); X.translate(x, y); X.rotate(-.6);
  X.beginPath(); X.roundRect(-r, -r * .22, r * 2, r * .44, r * .2); X.fillStyle = '#c9ced4'; X.fill(); X.lineWidth = 3; X.strokeStyle = INK; X.stroke();
  X.fillStyle = INK; X.fillRect(-r * .2, -r * .22, r * .3, r * .44);
  X.beginPath(); X.arc(r, 0, r * .2, 0, TAU); X.fillStyle = '#ff2a2a'; X.fill();
  X.restore();
}
function lootBox(x, y, c, t) {
  const pu = .5 + .5 * Math.sin(t * 6);
  X.fillStyle = c; X.globalAlpha = .18 + .15 * pu; X.beginPath(); X.ellipse(x, y + 28, 58, 18, 0, 0, TAU); X.fill(); X.globalAlpha = 1;
  X.beginPath(); X.roundRect(x - 32, y - 18, 64, 46, 6); X.fillStyle = INK3; X.fill(); X.lineWidth = 4; X.strokeStyle = c; X.stroke();
}
function rug(x, y, w, h, a) {
  X.save(); X.globalAlpha = a; X.translate(x, y);
  X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, 6); X.fillStyle = '#7a2231'; X.fill(); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.lineWidth = 6; X.strokeStyle = '#e0b04a'; X.beginPath(); X.roundRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 4); X.stroke();
  X.beginPath(); X.moveTo(0, -h / 2 + 26); X.lineTo(w * .22, 0); X.lineTo(0, h / 2 - 26); X.lineTo(-w * .22, 0); X.closePath(); X.fillStyle = '#e0b04a'; X.fill();
  X.beginPath(); X.moveTo(0, -h / 2 + 44); X.lineTo(w * .12, 0); X.lineTo(0, h / 2 - 44); X.lineTo(-w * .12, 0); X.closePath(); X.fillStyle = '#2a4a8a'; X.fill();
  X.strokeStyle = '#e8d6a8'; X.lineWidth = 2; X.beginPath(); for (let i = -h / 2 + 8; i < h / 2 - 4; i += 9) { X.moveTo(-w / 2, i); X.lineTo(-w / 2 - 10, i); X.moveTo(w / 2, i); X.lineTo(w / 2 + 10, i); } X.stroke();
  X.restore();
}
