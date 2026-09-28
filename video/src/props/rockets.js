// Rockets: Test Rocket #1 (the janky trash-can rocket that blows up) + its debris, the S.S. Biscuit
// (the real retro rocket, with booster stage, parachutes, landing legs, build stages), the launch
// gantry, the airliner that passes during the ascent, and the shared cartoon exhaust flame.
//
// All functions are pure functions of their arguments (no hidden state), draw inside
// ctx.save()/restore(), and use the house style: flat fill + one shade shape on the side
// away from the upper-left light + a pale highlight + thick rounded INK outline.
//
// Every draw function accepts o.light = { mul, add, addAmt, k } (the backyard's time-of-day tint:
// colour = mix(colour * mul, add, addAmt), blended in by k 0..1, default 1). Object colours are
// tinted; light sources (flames, re-entry plasma, the lit doorway, lamps) are not.
import { INK, LW, PAL, FONT, ink, circlePath, ellipsePath, rrectPath, smoothPath, glow, sparkle, smokePuff, softStarPath } from '../draw.js';
import { TAU, clamp, lerp, hash01, noise1, rgba, ease, fract, smoothstep, mixColor, hexToRgb, rgbToHex } from '../util.js';
import { kick, sway, pulse, beatAt } from '../timing.js';
import { drawGirlHead } from '../characters/girl.js';
import { drawDogHead } from '../characters/dog.js';

export const ROCKET_HEIGHT = 720; // main stage, fin tips (y) to nose tip, at s = 1
export const BOOSTER_HEIGHT = 300; // booster, collar top to fin tips, at s = 1
const TR_K = 1.35; // Test Rocket #1 is drawn 1.35x its design units so it reads next to Juno
export const TEST_ROCKET_HEIGHT = Math.round(239 * TR_K); // 323 px (base to cone tip) at s = 1
// S.S. Biscuit hatch: clear doorway opening in rocket-local units at s = 1 (origin = fin tips,
// y up is negative). x = opening centre; the top is a semicircular arch of radius w/2.
export const ROCKET_HATCH = Object.freeze({ x: 76, sillY: -298, topY: -528, w: 92, h: 230 });
export const TEST_DEBRIS_KINDS = Object.freeze(['fin', 'tape', 'lid', 'hoop', 'bolt', 'can']);
// S.S. Biscuit portholes in rocket-local units at s = 1: centre, glass radius r, brass rim width.
export const ROCKET_PORTHOLES = Object.freeze({
  girl: Object.freeze({ x: -46, y: -458, r: 44, rim: 14 }),
  dog: Object.freeze({ x: -46, y: -342, r: 34, rim: 12 }),
});

// ---------------------------------------------------------------- colours (+ time-of-day tint)
const BASE = {
  cream: PAL.cream, creamShade: '#efcf9c',
  red: PAL.red, redShade: PAL.redDark,
  primer: '#cfd3dc', primerShade: '#a9afbd',
  bare: '#c3cad7', bareShade: '#98a1b4', bareNose: '#b4bccb',
  steel: PAL.steel, steelShade: '#a3adc0', steelDark: PAL.greyDark,
  brass: PAL.gold, brassShade: '#c7841c', brassHi: '#ffe7a6',
  teal: PAL.teal, tealShade: '#1c9589',
  glass: '#26345f', glassTop: '#3a4c86',
  cardboard: '#d6a869', cardboardShade: '#aa7a3f', cardboardDark: '#8a5f2c',
  tape: '#dde1e8', tapeShade: '#a9b0bd', tapeSoot: '#8f8a96',
  can: '#b9c1ce', canShade: '#8e98ab', canLight: '#e4e9f1', canInside: '#5a6072',
  cone: PAL.orange, coneShade: '#d4621c', coneDark: '#b8511a', coneStripe: PAL.white, coneStripeShade: '#d9dbe6',
  white: PAL.white, yellow: PAL.yellow, starShade: '#e8a817', soot: PAL.soot,
  smoke: '#e9e4ef', smokeShade: '#bdb5c9', puff: '#ddd7e3', puffShade: '#aba3b8', curl: '#a39cab', curlShade: '#7d7688',
  line: '#efe6d6', checker: '#2f3550', frameBack: '#6e7890', gapDark: '#3b3259', gapRib: '#9aa3b8', gapRib2: '#7d879d',
  leafBack: '#9aa5bb', leafBackShade: '#76819a',
  concrete: '#cbc6d2', concreteShade: '#a8a2b4', hazard: PAL.yellow,
  brace: '#8b95ab', braceBack: '#5f6983', rung: '#f1f4f9',
  // airliner
  jet: '#fbf7ef', jetShade: '#d9dce6', jetBelly: '#e3e6ee', blue: PAL.blue, blueShade: '#2a62c0',
  intake: '#2e2a3a', cabin: '#ffe3a8', seatBlue: '#5b8ee6', skin: '#eab48a', skinShade: '#cf9166',
  hairGrey: '#c3bccd', hairGreyShade: '#9b93a8', cheek: '#ff9b8a',
  hiW: '#ffffff',
};
function mulC(a, m) {
  const A = hexToRgb(a), M = hexToRgb(m);
  return rgbToHex([(A[0] * M[0]) / 255, (A[1] * M[1]) / 255, (A[2] * M[2]) / 255]);
}
function buildPal(light) {
  let tint = (c) => c;
  if (light) {
    const k = clamp(light.k ?? 1);
    const { mul, add, addAmt = 0 } = light;
    tint = (c) => {
      let x = mul ? mulC(c, mul) : c;
      if (add && addAmt) x = mixColor(x, add, addAmt);
      return k < 1 ? mixColor(c, x, k) : x;
    };
  }
  const C = {};
  for (const key in BASE) C[key] = tint(BASE[key]);
  const [r, g, b] = hexToRgb(C.hiW);
  C.hi = `rgba(${r},${g},${b},0.55)`;
  C.hi7 = `rgba(${r},${g},${b},0.7)`;
  C.hi45 = `rgba(${r},${g},${b},0.45)`;
  C.hi75 = `rgba(${r},${g},${b},0.75)`;
  return C;
}
const PAL0 = buildPal(null); // untinted palette (constant)
// Tinted palette, built once per draw call (memoised per call, no state kept between calls).
function palFor(light) {
  if (!light || (light.k ?? 1) <= 0 || !(light.mul || (light.add && light.addAmt))) return PAL0;
  return buildPal(light);
}

// Effective on-screen scale (for level-of-detail + minimum outline width)
function effScale(ctx, s) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  return Math.abs(s) * (m ? Math.hypot(m.a, m.b) : 1);
}
// Outline widths in local units. lw = details (rivets, seams, lettering): never under ~1.3 px on
// screen. lwS = silhouette strokes: never under 3.5 px on screen (so the props match the fence /
// crates in the wide shots), capped at 2.2 x LW. k = extra internal scale of the drawing.
function widths(eff, k = 1) {
  const e = Math.max(eff, 0.01);
  const lw = Math.max(LW, 1.3 / e);
  const lwS = Math.max(lw, Math.min(2.2 * LW, Math.max(LW, 3.5 / e)));
  return { lw: lw / k, lwS: lwS / k };
}

// Fill a part: base colour, then (clipped to the part) the shade shape, the highlight and
// any extra overlays, then the ink outline on top.
function part(ctx, pathFn, base, lw, { shade, shadeFn, hiFn, fx, hi } = {}) {
  pathFn(); ctx.fillStyle = base; ctx.fill();
  if (shadeFn || hiFn || fx) {
    ctx.save();
    pathFn(); ctx.clip();
    if (shadeFn && shade) { ctx.fillStyle = shade; shadeFn(); }
    if (hiFn) { ctx.fillStyle = hi || PAL0.hi; hiFn(); }
    if (fx) fx();
    ctx.restore();
  }
  if (lw > 0) { pathFn(); ink(ctx, null, lw); }
}
// Shade trick: fill everything with the shade colour, then re-fill the part shifted toward
// the light, leaving a crescent of shade on the lower-right edges.
function offsetShade(ctx, pathFn, base, dx, dy) {
  return () => {
    ctx.fillRect(-4000, -4000, 8000, 8000);
    ctx.save(); ctx.translate(-dx, -dy); pathFn(); ctx.fillStyle = base; ctx.fill(); ctx.restore();
  };
}
// Translucent shade crescent (call while clipped to the part): everything except the part
// shifted toward the light.
function crescent(ctx, pathFn, dx, dy, color) {
  ctx.save(); ctx.translate(-dx, -dy); pathFn(); ctx.restore();
  ctx.rect(-4000, -4000, 8000, 8000);
  ctx.fillStyle = color; ctx.fill('evenodd');
}
// Lune = the part of circle (cx,cy,R) NOT covered by the same circle shifted by (-dx,-dy):
// a crisp shade crescent on the (dx,dy) side, built as an exact path (no clip needed).
function lunePath(ctx, cx, cy, R, dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d <= 0 || d >= 2 * R) { circlePath(ctx, cx, cy, R); return; }
  const a = Math.atan2(dy, dx), b = Math.acos(-d / (2 * R));
  const p1 = a - b, p2 = a + b;
  const ox = cx - dx, oy = cy - dy;
  const q2 = Math.atan2(cy + Math.sin(p2) * R - oy, cx + Math.cos(p2) * R - ox);
  const q1 = Math.atan2(cy + Math.sin(p1) * R - oy, cx + Math.cos(p1) * R - ox);
  ctx.beginPath();
  ctx.arc(cx, cy, R, p1, p2, false);
  ctx.arc(ox, oy, R, q2, q1, true);
  ctx.closePath();
}
function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
function strokeLimb(ctx, pts, w, col, lw) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (lw > 0) { ctx.strokeStyle = INK; ctx.lineWidth = w + 2 * lw; ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
// Many outlined bars in two strokes (ink, then colour): crossings merge into one clean shape.
function strokeBars(ctx, segs, w, col, lw) {
  if (!segs.length) return;
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (lw > 0) { ctx.strokeStyle = INK; ctx.lineWidth = w + 2 * lw; ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
// many rivets in two fills (batched paths are much cheaper than one fill per rivet)
function rivets(ctx, pts, col, hi = PAL0.hi7) {
  ctx.beginPath();
  for (const [x, y, r] of pts) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ctx.fillStyle = col; ctx.fill();
  ctx.beginPath();
  for (const [x, y, r] of pts) { ctx.moveTo(x - r * 0.35 + r * 0.4, y - r * 0.35); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, TAU); }
  ctx.fillStyle = hi; ctx.fill();
}
// flat, toon-style glow: a few stacked translucent ellipses (much cheaper than gradients)
function halo(ctx, x, y, rx, ry, col, a, n = 3) {
  if (rx <= 1 || ry <= 1 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(col, a);
  for (let i = 0; i < n; i++) {
    const k = 1 - i / n;
    ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// =====================================================================================
//                                   FLAME
// =====================================================================================
const FLAME_PAL = {
  normal: { outer: PAL.red, mid: PAL.orange, inner: PAL.yellow, core: '#fff7d6', glow: '#ffb347', spark: '#ffe066' },
  blue: { outer: '#3d57e0', mid: '#4fa3ff', inner: '#9fe3ff', core: '#f4fdff', glow: '#6fb6ff', spark: '#c8f0ff' },
};

function flameShape(ctx, L, Wd, t, f, seed, cap) {
  const N = 9;
  const sw = Wd * 0.22 * f * noise1(t * 4.3, seed + 3);
  const right = [], left = [];
  for (let i = 0; i < N; i++) {
    const v = i / N;
    const q = (v - 0.12) / 0.88;
    const p = v < 0.12 ? 0.86 + 0.14 * (v / 0.12) : Math.pow(1 - q, 0.65) * (1 + 0.45 * q);
    const k = Math.min(1, v * 2.4) * 0.17 * f;
    const rR = 1 + k * Math.sin(v * 11 - t * 23 + seed);
    const rL = 1 + k * Math.sin(v * 11 - t * 23 + seed + 2.3);
    const cx = sw * v * v;
    right.push([cx + (Wd / 2) * p * rR, v * L]);
    left.push([cx - (Wd / 2) * p * rL, v * L]);
  }
  const pts = [[0, -cap * Wd], ...right, [sw, L], ...left.reverse()];
  smoothPath(ctx, pts, true, 0.5);
}

// Layered cartoon flame pointing +y from (x, y). len/width in px (already scaled).
// o: { color 'normal'|'blue', flicker 0..1 (default 1), seed, cap (root roundness), sparks bool,
//      glow 0..1 (root glow), lw (outline width, default LW) }
export function drawFlame(ctx, x, y, len, width, t, o = {}) {
  if (!(len > 1) || !(width > 1)) return;
  const { color = 'normal', flicker = 1, seed = 7, cap = 0.18, sparks = true, lw = LW } = o;
  const gA = o.glow ?? 1;
  const P = FLAME_PAL[color] || FLAME_PAL.normal;
  const f = flicker;
  const L = len * (1 + 0.12 * f * noise1(t * 13, seed) + 0.06 * f * noise1(t * 31, seed + 1));
  const Wd = width * (1 + 0.06 * f * noise1(t * 17, seed + 2));
  ctx.save();
  ctx.translate(x, y);
  if (gA > 0) glow(ctx, 0, L * 0.28, Math.max(Wd * 1.1, L * 0.42), P.glow, 0.5 * gA);
  // detached licks drifting off the tip
  const sw = Wd * 0.22 * f * noise1(t * 4.3, seed + 3);
  for (let i = 0; i < 2; i++) {
    const ph = fract(t * 2.7 + i * 0.5 + hash01(i, seed) * 0.3);
    const r = Wd * 0.15 * (1 - ph) * (i ? 0.8 : 1);
    if (r < 1) continue;
    const ly = L * (0.8 + 0.34 * ph), lx = sw * (1 + ph) + (hash01(i, seed + 9) - 0.5) * Wd * 0.3;
    ctx.beginPath();
    ctx.moveTo(lx, ly + r * 1.9);
    ctx.quadraticCurveTo(lx + r * 1.15, ly + r * 0.1, lx, ly - r);
    ctx.quadraticCurveTo(lx - r * 1.15, ly + r * 0.1, lx, ly + r * 1.9);
    ink(ctx, P.mid, lw * 0.7);
  }
  // side tongues licking off the outer layer (drawn first so the body overlaps their roots)
  for (let i = 0; i < 2; i++) {
    const sg = i ? -1 : 1;
    const ph = t * 2.3 + i * 0.5 + hash01(i, seed + 30);
    const cyc = ph - Math.floor(ph);
    const v = 0.36 + 0.3 * cyc;
    const grow = Math.sin(cyc * Math.PI);
    const q = (v - 0.12) / 0.88;
    const half = (Wd / 2) * Math.pow(1 - q, 0.65) * (1 + 0.45 * q);
    const rx = sw * v * v + sg * half * 0.7, ry = v * L;
    const ll = L * 0.3 * grow * f, lwd = Wd * 0.2 * (0.45 + 0.55 * grow);
    if (ll < 3) continue;
    const tx = rx + sg * (lwd * 0.9 + ll * 0.12), ty = ry + ll;
    ctx.beginPath();
    ctx.moveTo(rx - sg * lwd * 0.4, ry - lwd * 0.3);
    ctx.bezierCurveTo(rx + sg * lwd * 1.1, ry - lwd * 0.2, rx + sg * (lwd * 1.4 + ll * 0.1), ry + ll * 0.55, tx, ty);
    ctx.bezierCurveTo(rx + sg * lwd * 0.5, ry + ll * 0.7, rx + sg * lwd * 0.2, ry + ll * 0.4, rx - sg * lwd * 0.4, ry + ll * 0.35);
    ctx.closePath();
    ink(ctx, P.outer, lw * 0.85);
  }
  const layers = [[1, 1, P.outer], [0.8, 0.76, P.mid], [0.6, 0.53, P.inner], [0.38, 0.3, P.core]];
  layers.forEach(([lk, wk, c], i) => {
    flameShape(ctx, L * lk, Wd * wk, t, f, seed + i * 5, cap + i * 0.05);
    ink(ctx, c, i === 0 ? lw : 0);
  });
  if (sparks) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ph = fract(t * (1.1 + hash01(i, seed + 20) * 0.9) + hash01(i, seed + 21));
      const sy = L * (0.25 + 0.95 * ph);
      const sx = (hash01(i, seed + 22) - 0.5) * Wd * (0.5 + 0.9 * ph) + sw * ph;
      const r = (Wd * 0.05 + 1.5) * (1 - ph);
      if (r < 0.6) continue;
      if (hash01(i, seed + 23) < 0.4) sparkle(ctx, sx, sy, r * 2.4, P.core, 1 - ph * 0.6);
      else { ctx.fillStyle = P.spark; circlePath(ctx, sx, sy, r); ctx.fill(); }
    }
  }
  ctx.restore();
}

// =====================================================================================
//                                 TEST ROCKET #1
// =====================================================================================
// Design units (before the internal TR_K scale): origin = bottom centre, ~239 tall.
// Parts are separate functions of a small render record R = { ctx, C, lw, lwS, det, charred, t }
// so the debris pieces reuse exactly the same art.
const canHW = (y) => lerp(44, 52, clamp((-30 - y) / 128)); // trash can is wider at the top
const FIN_L = [[-40, -106], [-62, -86], [-84, -60], [-93, -24], [-96, 0], [-62, -2], [-42, -28]];
const FIN_R = [[40, -100], [64, -84], [82, -64], [91, -28], [97, -3], [62, 0], [43, -32]];

function coughLevel(t, seed = 77) {
  const r = t * 8.5, i = Math.floor(r), fr = r - i;
  const lv = (k) => (hash01(k, seed) < 0.3 ? 0.06 : 0.45 + 0.55 * hash01(k, seed + 1));
  return lerp(lv(i), lv(i + 1), smoothstep(0.7, 1, fr));
}
function trSoot(R, x0, y0, x1, y1, seed) {
  const { ctx, C, charred } = R;
  if (charred <= 0) return;
  const g = ctx.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, rgba(C.soot, 0.85 * charred));
  g.addColorStop(1, rgba(C.soot, 0.35 * charred));
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = rgba(C.soot, 0.3 * charred);
  for (let i = 0; i < 3; i++) {
    circlePath(ctx, lerp(x0, x1, hash01(i, seed)), lerp(y0, y1, 0.3 + 0.7 * hash01(i, seed + 1)), (x1 - x0) * (0.25 + 0.2 * hash01(i, seed + 2)));
    ctx.fill();
  }
}
function trFin(R, sgn) {
  const { ctx, C, lwS, det } = R;
  const pts = sgn < 0 ? FIN_L : FIN_R;
  const fp = () => polyPath(ctx, pts);
  part(ctx, fp, C.cardboard, lwS, {
    shade: C.cardboardShade, shadeFn: offsetShade(ctx, fp, C.cardboard, sgn > 0 ? 9 : 4, 9),
    fx: () => {
      if (det) { // corrugation lines
        ctx.strokeStyle = rgba(C.cardboardDark, 0.45); ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath(); ctx.moveTo(sgn * (46 + i * 9), -96 + i * 2); ctx.lineTo(sgn * (58 + i * 11), -2); ctx.stroke();
        }
      }
      trSoot(R, sgn < 0 ? -100 : 30, -110, sgn < 0 ? -30 : 100, 4, 5 + sgn);
    },
  });
  if (det) { // torn corrugated tip
    ctx.strokeStyle = C.cardboardDark; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) ctx.lineTo(sgn * (66 + i * 5), -4 - (i % 2) * 5);
    ctx.stroke();
  }
}
function trFunnel(R) {
  const { ctx, C, lwS } = R;
  const funnel = () => {
    ctx.beginPath();
    ctx.moveTo(-21, -34); ctx.lineTo(21, -34); ctx.lineTo(34, -8);
    ctx.quadraticCurveTo(0, -1, -34, -8); ctx.closePath();
  };
  part(ctx, funnel, C.steel, lwS, {
    shade: C.steelShade, shadeFn: () => { polyPath(ctx, [[6, -40], [40, -40], [40, 0], [14, 0]]); ctx.fill(); },
    hiFn: () => { polyPath(ctx, [[-16, -32], [-10, -32], [-20, -8], [-27, -8]]); ctx.fill(); }, hi: C.hi,
    fx: () => trSoot(R, -40, -40, 40, 0, 9),
  });
}
// trash-can body with a dent in its silhouette + marker lettering
function trCan(R) {
  const { ctx, C, lwS, det } = R;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-44, -30);
    ctx.lineTo(canHW(-76) * -1, -76);
    ctx.quadraticCurveTo(-38, -94, -canHW(-112) + 1, -114);
    ctx.lineTo(-52, -158); ctx.lineTo(52, -158); ctx.lineTo(44, -30);
    ctx.quadraticCurveTo(0, -23, -44, -30);
    ctx.closePath();
  };
  part(ctx, body, C.can, lwS, {
    shade: C.canShade,
    shadeFn: () => { polyPath(ctx, [[20, -24], [23, -160], [60, -160], [60, -24]]); ctx.fill(); },
    hiFn: () => {
      polyPath(ctx, [[-36, -140], [-27, -140], [-24, -122], [-31, -122]]); ctx.fill();
      polyPath(ctx, [[-30, -66], [-24, -66], [-22, -44], [-28, -44]]); ctx.fill();
    },
    hi: C.hi,
    fx: () => {
      // dents: crescent shadow + light rim
      ctx.fillStyle = C.canShade;
      ellipsePath(ctx, 12, -143, 12, 6, -0.3); ctx.fill();
      ctx.fillStyle = C.can;
      ellipsePath(ctx, 10, -145, 11, 5, -0.3); ctx.fill();
      ctx.strokeStyle = C.canLight; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(13, -141, 12, 6, -0.3, 0.3, 1.9); ctx.stroke();
      ctx.fillStyle = C.canShade;
      ellipsePath(ctx, -30, -93, 6, 13, 0.1); ctx.fill();
      if (det) {
        // marker lettering
        ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.save(); ctx.translate(-2, -95); ctx.rotate(-0.07);
        ctx.font = `bold 24px ${FONT.hand}`; ctx.fillText('TEST', 0, 0); ctx.restore();
        ctx.save(); ctx.translate(4, -61); ctx.rotate(0.05);
        ctx.font = `bold 31px ${FONT.hand}`; ctx.fillText('#1', 0, 0); ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-15, -54); ctx.quadraticCurveTo(0, -50, 12, -55); ctx.quadraticCurveTo(20, -58, 26, -53); ctx.stroke();
      }
      trSoot(R, -60, -165, 60, -24, 13);
    },
  });
}
// corrugated hoop (raised ring) hugging the can at height yy
function trHoop(R, yy, hh) {
  const { ctx, C, lw } = R;
  const hwA = canHW(yy - hh / 2) + 3, hwB = canHW(yy + hh / 2) + 3;
  const hp = () => {
    ctx.beginPath();
    ctx.moveTo(-hwA, yy - hh / 2);
    ctx.quadraticCurveTo(0, yy - hh / 2 + 6, hwA, yy - hh / 2);
    ctx.lineTo(hwB, yy + hh / 2);
    ctx.quadraticCurveTo(0, yy + hh / 2 + 6, -hwB, yy + hh / 2);
    ctx.closePath();
  };
  part(ctx, hp, C.can, lw * 0.6, {
    shade: C.canShade, shadeFn: () => { ctx.fillRect(-60, yy + 1, 120, 20); ctx.fillRect(22, yy - 20, 40, 40); },
    fx: () => trSoot(R, -60, yy - 10, 60, yy + 10, 17),
  });
}
function trHandles(R) {
  const { ctx, C, lw, charred } = R;
  for (const sg of [-1, 1]) {
    strokeLimb(ctx, [[sg * 50, -153], [sg * 63, -151], [sg * 63, -139], [sg * 50, -136]], 4.5, mixColor(sg < 0 ? C.can : C.canShade, C.soot, charred * 0.7), lw * 0.6);
  }
}
// lid dome + rim (handle = the free-flying lid's grab strap)
function trLid(R, handle = false) {
  const { ctx, C, lw, lwS, charred } = R;
  if (handle) {
    strokeLimb(ctx, [[-15, -178], [-11, -189], [11, -189], [15, -178]], 5, mixColor(C.can, C.soot, charred * 0.7), lw * 0.6);
  }
  const lidDome = () => { ctx.beginPath(); ctx.ellipse(0, -166, 50, 17, 0, Math.PI, TAU); ctx.closePath(); };
  part(ctx, lidDome, C.can, lwS, {
    shade: C.canShade, shadeFn: () => { ctx.fillRect(18, -190, 40, 30); },
    fx: () => {
      if (handle) { ctx.fillStyle = C.canShade; ellipsePath(ctx, -22, -172, 9, 4, 0.2); ctx.fill(); }
      trSoot(R, -60, -185, 60, -160, 19);
    },
  });
  const rim = () => {
    ctx.beginPath();
    ctx.moveTo(-58, -170); ctx.quadraticCurveTo(0, -163, 58, -170);
    ctx.lineTo(58, -157); ctx.quadraticCurveTo(0, -150, -58, -157); ctx.closePath();
  };
  part(ctx, rim, C.can, lwS, {
    shade: C.canShade, shadeFn: () => { ctx.fillRect(22, -180, 40, 30); ctx.fillRect(-60, -159, 120, 10); },
    hiFn: () => { ctx.fillRect(-48, -168, 30, 3); }, hi: C.hi,
    fx: () => trSoot(R, -60, -175, 60, -150, 23),
  });
}
// traffic-cone nose; local origin = centre of the flange bottom
function trCone(R) {
  const { ctx, C, lw, lwS } = R;
  const flange = () => rrectPath(ctx, -38, -10, 76, 10, 4);
  part(ctx, flange, C.coneShade, lwS * 0.8, {
    shade: C.coneDark, shadeFn: () => ctx.fillRect(20, -20, 40, 30),
    fx: () => trSoot(R, -50, -14, 50, 2, 27),
  });
  const cone = () => {
    ctx.beginPath();
    ctx.moveTo(-36, -12); ctx.lineTo(-9, -58);
    ctx.quadraticCurveTo(0, -64, 9, -58); ctx.lineTo(36, -12);
    ctx.closePath();
  };
  const stripe = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -38); ctx.quadraticCurveTo(0, -33, 40, -38);
    ctx.moveTo(-40, -26); ctx.quadraticCurveTo(0, -21, 40, -26);
  };
  part(ctx, cone, C.cone, lwS, {
    shade: C.coneShade,
    shadeFn: () => { polyPath(ctx, [[4, -70], [40, -70], [40, 0], [16, 0]]); ctx.fill(); },
    hiFn: () => { polyPath(ctx, [[-24, -17], [-17, -17], [-5, -50], [-9, -52]]); ctx.fill(); }, hi: C.hi,
    fx: () => {
      // white reflective stripe (with its own shade side) + its ink edges
      ctx.beginPath();
      ctx.moveTo(-40, -38); ctx.quadraticCurveTo(0, -33, 40, -38);
      ctx.lineTo(40, -26); ctx.quadraticCurveTo(0, -21, -40, -26); ctx.closePath();
      ctx.fillStyle = C.coneStripe; ctx.fill();
      ctx.fillStyle = C.coneStripeShade;
      polyPath(ctx, [[10, -40], [40, -40], [40, -20], [14, -20]]); ctx.fill();
      trSoot(R, -40, -64, 40, 0, 29);
      stripe(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.45; ctx.stroke();
    },
  });
}
function trTape(R, cx, cy, len, w, rot, seed) {
  const { ctx, C, lw, charred } = R;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const tp = () => {
    ctx.beginPath();
    ctx.moveTo(-len / 2, -w / 2); ctx.lineTo(len / 2, -w / 2);
    for (let i = 1; i <= 3; i++) ctx.lineTo(len / 2 + (i % 2 ? 3 : -1) * (0.6 + hash01(i, seed)), -w / 2 + (i * w) / 3);
    ctx.lineTo(-len / 2, w / 2);
    for (let i = 1; i <= 3; i++) ctx.lineTo(-len / 2 + (i % 2 ? -3 : 1) * (0.6 + hash01(i, seed + 1)), w / 2 - (i * w) / 3);
    ctx.closePath();
  };
  part(ctx, tp, charred > 0.5 ? C.tapeSoot : C.tape, lw * 0.5, {
    shade: C.tapeShade, shadeFn: () => ctx.fillRect(-len, w * 0.12, len * 2, w),
    hiFn: () => ctx.fillRect(-len / 2 + 3, -w / 2 + 2, len - 8, 2.2), hi: C.hi,
    fx: () => trSoot(R, -len, -w, len, w, seed),
  });
  ctx.restore();
}

// (x, y) = bottom centre (resting on the crates). TEST_ROCKET_HEIGHT (~323 px) tall at s = 1.
// o: { t, flame 0..1 (sputtering, coughing), wobble 0..1 (drunken rocking), charred 0..1, shake 0..1, light }
export function drawTestRocket(ctx, x, y, s = 1, o = {}) {
  const { t = 0, flame = 0, wobble = 0, charred = 0, shake = 0 } = o;
  const eff = effScale(ctx, s);
  const { lw, lwS } = widths(eff, TR_K);
  const det = eff * TR_K > 0.28;
  const C = palFor(o.light);
  const R = { ctx, C, lw, lwS, det, charred, t };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * TR_K, s * TR_K);
  if (shake > 0) ctx.translate(shake * 5 * noise1(t * 43, 3), shake * 3 * noise1(t * 47, 5));

  // --- sputter puffs (world frame, not rocked) ---
  const puffs = (front) => {
    if (flame <= 0) return;
    const step = 0.13, k = Math.floor(t / step);
    ctx.save();
    ctx.globalAlpha *= clamp(flame * 2);
    for (let j = 7; j >= 0; j--) {
      const n = k - j;
      if ((n & 1) !== (front ? 0 : 1)) continue;
      const u = (t - n * step) / 0.95;
      if (u <= 0 || u >= 1) continue;
      const side = hash01(n, 41) < 0.5 ? -1 : 1;
      const px = side * (8 + 85 * u * (0.5 + hash01(n, 42)));
      const py = 4 - 60 * u * (0.3 + hash01(n, 43));
      const r = (13 + 26 * u) * (0.7 + 0.6 * hash01(n, 44));
      smokePuff(ctx, px, py, r, { seed: n + 3, u: 0.15 + 0.85 * u, n: 4, fill: C.puff, shadeCol: C.puffShade, lw: lw * 0.8 });
    }
    ctx.restore();
  };
  puffs(false);

  // --- drunken rocking about the base ---
  const rock = wobble * (0.13 * Math.sin(t * 7.1) + 0.09 * noise1(t * 3.3, 9) + 0.04 * Math.sin(t * 17.3));
  ctx.save();
  ctx.rotate(rock);

  // flame (behind the funnel) — a light source: untinted
  if (flame > 0) {
    const lvl = coughLevel(t);
    const L = flame * 175 * lvl * (1 + 0.25 * noise1(t * 21, 4));
    drawFlame(ctx, 0, -10, L, 48 * (0.75 + 0.35 * lvl) * Math.min(1, flame * 2), t, { seed: 21, lw, glow: lvl, sparks: det });
  }
  trFin(R, -1);
  trFin(R, 1);
  trFunnel(R);
  trCan(R);
  trHoop(R, -41, 8);
  trHoop(R, -124, 9);
  trHandles(R);
  trLid(R);
  // traffic-cone nose (loose: wobbles on its own)
  ctx.save();
  ctx.translate(0, -178);
  ctx.rotate(wobble * 0.1 * Math.sin(t * 11.3 + 1) + charred * 0.12);
  trCone(R);
  ctx.restore();
  // duct tape X's
  for (const sg of [-1, 1]) {
    trTape(R, sg * 45, -66, 46, 12, sg * 0.75, 31 + sg);
    trTape(R, sg * 45, -66, 46, 12, -sg * 0.75, 35 + sg);
  }
  trTape(R, -33, -174, 22, 9, -0.95, 40);
  trTape(R, 34, -175, 22, 9, 0.9, 42);
  ctx.restore(); // rock

  puffs(true);

  // charred: little smoke curls rising off the top
  if (charred > 0.2 && det) {
    ctx.save();
    ctx.globalAlpha *= clamp((charred - 0.2) * 2);
    for (let i = 0; i < 2; i++) {
      const ph = fract(t * 0.45 + i / 2);
      const px = (i ? 14 : -18) + 14 * Math.sin(ph * 4 + i * 2);
      smokePuff(ctx, px, -236 - ph * 70, 14 + 20 * ph, { seed: i + 50, u: 0.2 + 0.8 * ph, n: 4, fill: C.curl, shadeCol: C.curlShade, lw: lw * 0.6 });
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- debris (s01 KA-BOOM)
function debrisTapeRoll(R) {
  const { ctx, C, lw, lwS, charred } = R;
  const base = charred > 0.5 ? C.tapeSoot : C.tape;
  // loose strip flapping off the roll (behind)
  ctx.beginPath();
  ctx.moveTo(14, 12); ctx.bezierCurveTo(30, 26, 22, 44, 38, 50); ctx.lineTo(41, 44);
  ctx.bezierCurveTo(28, 38, 36, 20, 19, 7); ctx.closePath();
  ink(ctx, base, lw * 0.5);
  ctx.fillStyle = C.tapeShade; ctx.beginPath(); ctx.moveTo(38, 50); ctx.lineTo(41, 44); ctx.lineTo(44, 49); ctx.closePath(); ctx.fill();
  // cylinder: side band (shade) then the front face annulus
  const side = [[0, 0, 21], [3, 2.5, 21], [6, 5, 21]];
  ctx.beginPath(); for (const [cx, cy, r] of side) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); }
  ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); for (const [cx, cy, r] of side) { ctx.moveTo(cx + r - lwS / 2, cy); ctx.arc(cx, cy, r - lwS / 2, 0, TAU); }
  ctx.fillStyle = C.tapeShade; ctx.fill();
  circlePath(ctx, 0, 0, 21 - lwS / 2); ctx.fillStyle = base; ctx.fill();
  // layered tape rings + highlight
  ctx.strokeStyle = rgba(C.tapeShade, 0.8); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, TAU); ctx.stroke();
  ctx.strokeStyle = C.hi75; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 18, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  // cardboard core + the hole through it
  circlePath(ctx, 0, 0, 11); ink(ctx, C.cardboard, lw * 0.5);
  circlePath(ctx, 1, 0.8, 7.5); ctx.fillStyle = C.cardboardDark; ctx.fill();
  ctx.fillStyle = rgba(INK, 0.55); lunePath(ctx, 1, 0.8, 7.5, -2.5, -2.5); ctx.fill();
  if (charred > 0) { ctx.fillStyle = rgba(C.soot, 0.45 * charred); circlePath(ctx, 5, 6, 14); ctx.fill(); }
}
function debrisHoop(R) {
  const { ctx, C, lwS, charred } = R;
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const d = 1 + 0.07 * (hash01(i, 61) - 0.5) - (i === 3 ? 0.14 : 0); // bent, one kink
    pts.push([Math.cos(a) * 56 * d, Math.sin(a) * 19 * d]);
  }
  const col = mixColor(C.can, C.soot, charred * 0.6);
  smoothPath(ctx, pts, true, 0.5);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 11 + 2 * lwS; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 11; ctx.stroke();
  // shade on the lower/right half of the band, pale glint upper-left
  ctx.save(); ctx.translate(1.5, 2.5);
  ctx.beginPath(); ctx.ellipse(0, 0, 55, 18, 0, -0.2, Math.PI * 0.9); ctx.strokeStyle = mixColor(C.canShade, C.soot, charred * 0.6); ctx.lineWidth = 4.5; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, 0, 56, 19, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.strokeStyle = C.hi; ctx.lineWidth = 2.5; ctx.stroke();
}
function debrisBolt(R) {
  const { ctx, C, lw } = R;
  // threaded shaft
  const shaft = () => rrectPath(ctx, -8, -5, 34, 10, 3);
  part(ctx, shaft, C.steel, lw * 0.6, {
    shade: C.steelShade, shadeFn: () => ctx.fillRect(-10, 1, 40, 8),
    fx: () => {
      ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-2 + i * 5, -5); ctx.lineTo(1 + i * 5, 5); ctx.stroke(); }
    },
  });
  // hex head (two facets)
  const head = () => rrectPath(ctx, -20, -12, 13, 24, 3);
  part(ctx, head, C.steel, lw * 0.7, {
    shade: C.steelShade, shadeFn: () => ctx.fillRect(-20, 4, 16, 10),
    hiFn: () => ctx.fillRect(-18, -10, 3, 12), hi: C.hi,
    fx: () => { ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-20, -4); ctx.lineTo(-7, -4); ctx.moveTo(-20, 4); ctx.lineTo(-7, 4); ctx.stroke(); },
  });
  // nut
  const nut = () => rrectPath(ctx, 14, -9, 9, 18, 2.5);
  part(ctx, nut, C.steelShade, lw * 0.6, { shade: C.steelDark, shadeFn: () => ctx.fillRect(14, 3, 10, 8) });
  if (R.charred > 0) { ctx.fillStyle = rgba(C.soot, 0.5 * R.charred); ctx.fillRect(-4, -5, 18, 10); }
}
// crumpled bottom half of the can (torn jagged top, dark inside showing)
function debrisCan(R) {
  const { ctx, C, lw, lwS } = R;
  const tearF = (i) => -92 - 20 * hash01(i, 71) + (i % 2 ? 14 : 0); // front torn edge (jagged teeth)
  const n = 9;
  const front = () => {
    ctx.beginPath();
    ctx.moveTo(-44, -30);
    ctx.lineTo(-canHW(-90) + 2, -84);
    for (let i = 0; i <= n; i++) ctx.lineTo(lerp(-canHW(-96), canHW(-96), i / n), tearF(i));
    ctx.lineTo(44, -30);
    ctx.quadraticCurveTo(0, -23, -44, -30);
    ctx.closePath();
  };
  // back wall (the inside of the far side) peeking over the torn front edge
  const back = () => {
    ctx.beginPath();
    ctx.moveTo(-canHW(-100), -100);
    for (let i = 0; i <= 8; i++) ctx.lineTo(lerp(-canHW(-100), canHW(-100), i / 8), -104 - 12 * hash01(i, 73) - (i % 2 ? 0 : 10));
    ctx.lineTo(canHW(-96), -90); ctx.lineTo(-canHW(-96), -90);
    ctx.closePath();
  };
  part(ctx, back, C.canInside, lwS, { fx: () => trSoot(R, -60, -130, 60, -80, 77) });
  part(ctx, front, C.can, lwS, {
    shade: C.canShade,
    shadeFn: () => { polyPath(ctx, [[20, -24], [23, -130], [60, -130], [60, -24]]); ctx.fill(); },
    hiFn: () => { polyPath(ctx, [[-30, -80], [-24, -80], [-22, -46], [-28, -46]]); ctx.fill(); }, hi: C.hi,
    fx: () => {
      // crumple creases: zig-zag folds with a lit edge
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [pts, a] of [[[[-34, -70], [-18, -62], [-6, -74], [8, -60], [22, -70]], 0.5], [[[-10, -92], [-2, -80], [12, -88]], 0.45]]) {
        ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.strokeStyle = rgba(INK, a); ctx.lineWidth = 2.4; ctx.stroke();
        ctx.save(); ctx.translate(-1.5, -2.5);
        ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.strokeStyle = C.canLight; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
      }
      trSoot(R, -60, -120, 60, -24, 79);
    },
  });
  trHoop(R, -41, 8);
  trFunnel(R);
}

// Debris from Test Rocket #1, flying after the KA-BOOM. (x, y) = the piece's centre; s = the same
// scale as drawTestRocket (includes its internal 1.35). kind: 'fin' | 'tape' | 'lid' | 'hoop' | 'bolt' | 'can'.
// o: { rot (radians, about the centre), charred 0..1, t, light }
export function drawTestDebris(ctx, kind, x, y, s = 1, o = {}) {
  const { rot = 0, charred = 0, t = 0 } = o;
  const eff = effScale(ctx, s);
  const { lw, lwS } = widths(eff, TR_K);
  const C = palFor(o.light);
  const R = { ctx, C, lw, lwS, det: eff * TR_K > 0.28, charred, t };
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(s * TR_K, s * TR_K);
  switch (kind) {
    case 'fin':
      ctx.translate(68, 50);
      trFin(R, -1);
      trTape(R, -45, -66, 46, 12, -0.75, 30);
      trTape(R, -45, -66, 46, 12, 0.75, 34);
      break;
    case 'tape': debrisTapeRoll(R); break;
    case 'lid': ctx.translate(0, 168); trLid(R, true); break;
    case 'hoop': debrisHoop(R); break;
    case 'bolt': debrisBolt(R); break;
    case 'can': ctx.translate(0, 68); debrisCan(R); break;
    default: break;
  }
  ctx.restore();
}

// =====================================================================================
//                                   S.S. BISCUIT
// =====================================================================================
// Local frame (s = 1): origin = bottom centre (fin tips), y up is negative.
const BODY_B = -84; // body bottom (nozzle below)
const BODY_T = -720; // nose tip
const E = 0.1; // "smile" curvature of cylindrical bands (seen slightly from above)
const PROF = [
  [0, 74], [0.05, 97], [0.13, 120], [0.26, 136], [0.4, 141], [0.52, 138], [0.63, 127],
  [0.72, 109], [0.8, 87], [0.87, 63], [0.93, 38], [0.975, 16], [1, 0],
];
function hwAtV(v) {
  v = clamp(v);
  let i = 0;
  while (i < PROF.length - 2 && v > PROF[i + 1][0]) i++;
  const p0 = PROF[Math.max(0, i - 1)], p1 = PROF[i], p2 = PROF[i + 1], p3 = PROF[Math.min(PROF.length - 1, i + 2)];
  const u = (v - p1[0]) / (p2[0] - p1[0]);
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0]);
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0]);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
}
const vOf = (y) => (y - BODY_B) / (BODY_T - BODY_B);
const hwY = (y) => Math.max(0, hwAtV(vOf(y)));
// right-side silhouette samples (denser near the tip) — constant geometry
const BODY_R = (() => {
  const pts = [];
  const n = 44;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 1 - Math.pow(1 - u, 1.6);
    pts.push([hwAtV(v), lerp(BODY_B, BODY_T, v)]);
  }
  return pts;
})();
function bodyPath(ctx, grow = 0) {
  ctx.beginPath();
  ctx.moveTo(-BODY_R[0][0] - grow, BODY_B + grow);
  ctx.quadraticCurveTo(0, BODY_B + 14 + grow, BODY_R[0][0] + grow, BODY_B + grow);
  for (let i = 1; i < BODY_R.length; i++) ctx.lineTo(BODY_R[i][0] + grow * (1 - i / BODY_R.length), BODY_R[i][1] - (i === BODY_R.length - 1 ? grow : 0));
  for (let i = BODY_R.length - 2; i >= 1; i--) ctx.lineTo(-BODY_R[i][0] - grow * (1 - i / BODY_R.length), BODY_R[i][1]);
  ctx.closePath();
}
// point on the cylinder at height y, angle th (0 = facing camera)
const cyl = (y, th) => { const h = hwY(y); return [h * Math.sin(th), y + E * h * Math.cos(th)]; };
// Exact hull region between the seam curves at yTop (upper) and yBot (lower), following the
// silhouette — lets us colour/shade hull regions without an expensive clip.
function hullBand(ctx, yTop, yBot) {
  const n = 12, hT = hwY(yTop), hB = hwY(yBot);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const th = -Math.PI / 2 + (i / n) * Math.PI;
    const px = hT * Math.sin(th), py = yTop + E * hT * Math.cos(th);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  for (let i = BODY_R.length - 1; i >= 0; i--) { const [h, yy] = BODY_R[i]; if (yy > yTop && yy < yBot) ctx.lineTo(h, yy); }
  for (let i = n; i >= 0; i--) {
    const th = -Math.PI / 2 + (i / n) * Math.PI;
    ctx.lineTo(hB * Math.sin(th), yBot + E * hB * Math.cos(th));
  }
  for (let i = 0; i < BODY_R.length; i++) { const [h, yy] = BODY_R[i]; if (yy > yTop && yy < yBot) ctx.lineTo(-h, yy); }
  ctx.closePath();
}
function seamCurve(ctx, y, th0 = -1.45, th1 = 1.45, n = 14) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [px, py] = cyl(y, lerp(th0, th1, i / n));
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
}
function rivetRow(ctx, C, y, col, spacing = 21, th0 = -1.35, th1 = 1.35, r = 3.3, skip = null) {
  const h = hwY(y);
  const n = Math.max(2, Math.round((h * (th1 - th0)) / spacing));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = lerp(th0, th1, i / n);
    const [px, py] = cyl(y, th);
    if (skip && skip(px, py)) continue;
    pts.push([px, py, r * (0.55 + 0.45 * Math.cos(th))]);
  }
  rivets(ctx, pts, col, C.hi7);
}

// Layout constants
const NOSE_Y = -548; // nose-cone seam
const BAND_T = -226, BAND_B = -190; // red band
const NAME_Y = -246; // baseline of "S.S. BISCUIT"
const PORT_J = ROCKET_PORTHOLES.girl; // Juno porthole
const PORT_B = ROCKET_PORTHOLES.dog; // Biscuit porthole
const DOOR = {
  xl: ROCKET_HATCH.x - ROCKET_HATCH.w / 2, xr: ROCKET_HATCH.x + ROCKET_HATCH.w / 2,
  yt: ROCKET_HATCH.topY, yb: ROCKET_HATCH.sillY,
};
const NOZ_TOP = BODY_B + 6, NOZ_BOT = -14;
const LEG_LIFT = 64;
// paint order (s04 painting montage): 0 left fin, 1 band, 2 right fin + front fin, 3 nose
const PAINT_PARTS = 4;
const paintFrac = (paint, i) => clamp(paint * PAINT_PARTS - i);

// Side fins (right side; mirrored for the left)
function finPath(ctx, sg, open = false) {
  ctx.beginPath();
  ctx.moveTo(sg * (open ? 128 : 112), open ? -310 : -318);
  ctx.bezierCurveTo(sg * 190, -282, sg * 238, -168, sg * 236, -26);
  ctx.quadraticCurveTo(sg * 236, 2, sg * 210, 0);
  ctx.quadraticCurveTo(sg * 150, -4, sg * 124, -48);
  ctx.quadraticCurveTo(sg * 104, -80, sg * (open ? 80 : 60), open ? -90 : -96);
  if (open) return;
  ctx.lineTo(sg * 60, -318);
  ctx.closePath();
}
function frontFinPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-11, -180);
  ctx.quadraticCurveTo(0, -190, 11, -180);
  ctx.lineTo(25, -14);
  ctx.quadraticCurveTo(25, 4, 0, 4);
  ctx.quadraticCurveTo(-25, 4, -25, -14);
  ctx.closePath();
}
function nozzlePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-54, NOZ_TOP); ctx.lineTo(54, NOZ_TOP);
  ctx.quadraticCurveTo(60, -42, 84, NOZ_BOT);
  ctx.quadraticCurveTo(0, NOZ_BOT + 14, -84, NOZ_BOT);
  ctx.quadraticCurveTo(-60, -42, -54, NOZ_TOP);
  ctx.closePath();
}

// wet-paint reveal: clip to the part and fill red above a wavy edge that moves down
function paintReveal(ctx, C, f, y0, y1, x0, x1, seed, drips = true) {
  if (f <= 0) return;
  const edge = lerp(y0, y1, f);
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 20);
  ctx.lineTo(x1, y0 - 20);
  const n = 8;
  for (let i = n; i >= 0; i--) {
    const px = lerp(x0, x1, i / n);
    ctx.lineTo(px, edge + (f < 1 ? 7 * Math.sin(i * 1.9 + seed) : 40));
  }
  ctx.closePath();
  ctx.fillStyle = C.red; ctx.fill();
  if (drips && f > 0.02 && f < 1) {
    for (let i = 0; i < 3; i++) {
      const px = lerp(x0, x1, 0.2 + 0.6 * hash01(i, seed));
      const dl = 10 + 18 * hash01(i, seed + 1);
      ctx.beginPath();
      ctx.moveTo(px - 5, edge);
      ctx.lineTo(px - 4, edge + dl);
      ctx.arc(px, edge + dl, 4.5, Math.PI, 0, true);
      ctx.lineTo(px + 5, edge);
      ctx.closePath(); ctx.fill();
    }
  }
}

// sideways brush sweep (left → right) with a wavy wet edge and a couple of drips
function paintRevealX(ctx, C, f, x0, x1, y0, y1, seed) {
  if (f <= 0) return;
  const edge = lerp(x0, x1, f);
  ctx.beginPath();
  ctx.moveTo(x0 - 20, y0); ctx.lineTo(x0 - 20, y1);
  const n = 8;
  for (let i = n; i >= 0; i--) {
    const py = lerp(y0, y1, i / n);
    ctx.lineTo(edge + (f < 1 ? 7 * Math.sin(i * 2.1 + seed) : 60), py);
  }
  ctx.closePath();
  ctx.fillStyle = C.red; ctx.fill();
  if (f > 0.02 && f < 1) {
    for (let i = 0; i < 2; i++) {
      const px = lerp(x0, edge, 0.35 + 0.5 * hash01(i, seed));
      const dl = 12 + 14 * hash01(i, seed + 1);
      ctx.beginPath();
      ctx.moveTo(px - 5, y1 - 4); ctx.lineTo(px - 4, y1 + dl); ctx.arc(px, y1 + dl, 4.5, Math.PI, 0, true); ctx.lineTo(px + 5, y1 - 4);
      ctx.closePath(); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- portholes
function porthole(ctx, C, P, lw, det, contentFn) {
  const R = P.r + P.rim;
  // rim
  circlePath(ctx, P.x, P.y, R); ctx.fillStyle = C.brass; ctx.fill();
  lunePath(ctx, P.x, P.y, R, 4, 5); ctx.fillStyle = C.brassShade; ctx.fill();
  circlePath(ctx, P.x, P.y, R); ink(ctx, null, lw);
  // glass + contents
  ctx.save();
  circlePath(ctx, P.x, P.y, P.r); ctx.clip();
  const g = ctx.createLinearGradient(0, P.y - P.r, 0, P.y + P.r);
  g.addColorStop(0, C.glassTop); g.addColorStop(1, C.glass);
  ctx.fillStyle = g; ctx.fillRect(P.x - P.r, P.y - P.r, P.r * 2, P.r * 2);
  glow(ctx, P.x - P.r * 0.2, P.y + P.r * 0.5, P.r * 1.1, '#ffb070', 0.35); // cabin light (untinted)
  if (contentFn) contentFn();
  // glass sheen + glint
  ctx.fillStyle = 'rgba(190,225,255,0.12)'; ctx.fillRect(P.x - P.r, P.y - P.r, P.r * 2, P.r * 2);
  ctx.strokeStyle = C.hi75; ctx.lineCap = 'round';
  ctx.lineWidth = P.r * 0.15;
  ctx.beginPath(); ctx.arc(P.x, P.y, P.r * 0.7, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  ctx.fillStyle = C.hi75;
  circlePath(ctx, P.x + P.r * 0.1, P.y - P.r * 0.72, P.r * 0.07); ctx.fill();
  ctx.restore();
  circlePath(ctx, P.x, P.y, P.r); ink(ctx, null, lw * 0.8);
  if (det) {
    const n = 8, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.2;
      const rr = P.r + P.rim * 0.5;
      pts.push([P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr, 2.6]);
    }
    rivets(ctx, pts, C.brassShade, C.brassHi);
    ctx.strokeStyle = C.brassHi; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(P.x, P.y, R - 4, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  }
}

// ---------------------------------------------------------------- hatch door
// Arched door outline. Hinge edge at xh (top ytH, bottom ybH), free edge at xf (ytF, ybF).
// The top is a half-ellipse: vertical radius = ROCKET_HATCH.w/2, horizontal = half the width
// (so a swinging, foreshortened leaf keeps a believable arch).
function doorPath(ctx, xh, xf, ytH, ybH, ytF, ybF) {
  const hx = (xf - xh) / 2, sg = Math.sign(hx) || 1;
  const r = ROCKET_HATCH.w / 2;
  const xm = xh + hx, yTop = (ytH + ytF) / 2;
  const K = 0.5523;
  const cr = Math.min(9, Math.abs(hx));
  ctx.beginPath();
  ctx.moveTo(xh, ybH - cr);
  ctx.lineTo(xh, ytH + r);
  ctx.bezierCurveTo(xh, ytH + r - r * K, xm - hx * K, yTop, xm, yTop);
  ctx.bezierCurveTo(xm + hx * K, yTop, xf, ytF + r - r * K, xf, ytF + r);
  ctx.lineTo(xf, ybF - cr);
  ctx.quadraticCurveTo(xf, ybF, xf - sg * cr, ybF);
  ctx.lineTo(xh + sg * cr, ybH);
  ctx.quadraticCurveTo(xh, ybH, xh, ybH - cr);
  ctx.closePath();
}
function wheelHandle(ctx, C, wx, wy, r, lw, kx = 1) {
  ctx.save(); ctx.translate(wx, wy); ctx.scale(kx, 1);
  ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke();
  ctx.strokeStyle = C.steel; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
  ctx.strokeStyle = INK; ctx.lineWidth = 8.5; ctx.stroke();
  ctx.strokeStyle = C.red; ctx.lineWidth = 4.5; ctx.stroke();
  circlePath(ctx, 0, 0, r * 0.33); ink(ctx, C.brass, 2);
  ctx.restore();
}
function drawHatch(ctx, C, hatch, hullCol, hullShade, lw, lwS, det, t, o) {
  const { xl, xr, yt, yb } = DOOR;
  const closedPath = () => doorPath(ctx, xr, xl, yt, yb, yt, yb);
  const hinges = (x, kx = 1) => {
    for (const hy of [yt + 62, yb - 48]) { rrectPath(ctx, x - 5 * kx, hy - 10, 10 * kx, 20, 3); ink(ctx, C.steelShade, lw * 0.4); }
  };
  if (hatch <= 0.001) {
    // closed: seam outline (+ a faint inner bevel), hinges, wheel handle
    closedPath(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.55; ctx.lineJoin = 'round'; ctx.stroke();
    if (det) {
      ctx.save(); ctx.translate(-3, -3); closedPath(); ctx.restore();
      ctx.strokeStyle = C.hi45; ctx.lineWidth = 2.5; ctx.stroke();
      hinges(xr);
      wheelHandle(ctx, C, xl + 24, (yt + yb) / 2 + 26, 13, lw);
    }
    return;
  }
  const frameMode = o.hatchFrame === 'sill' ? 'sill' : 'full';
  // doorway: dark interior with warm light (a light source — untinted)
  closedPath();
  ctx.fillStyle = '#211a38'; ctx.fill();
  ctx.save();
  closedPath(); ctx.clip();
  glow(ctx, xl + 26, yb - 40, 150, '#ffb46b', 0.5);
  ctx.fillStyle = '#2e2550'; ctx.fillRect(xl + 50, yt, 60, yb - yt); // side wall catching less light
  ctx.fillStyle = '#3d3266'; ctx.fillRect(xl - 10, yb - 30, xr - xl + 20, 40); // floor
  ctx.fillStyle = '#4c3f7a'; ctx.fillRect(xl - 10, yb - 30, xr - xl + 20, 5);
  if (det) {
    // grab rail on the back wall + a little blinking panel
    ctx.strokeStyle = '#e8b04a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(xl + 16, yt + 90); ctx.lineTo(xl + 16, yb - 60); ctx.stroke();
    ctx.fillStyle = '#3a3160'; ctx.fillRect(xl + 40, yt + 58, 42, 26);
    [[xl + 49, '#ff5d5d'], [xl + 61, '#6df08a'], [xl + 73, '#ffd84a']].forEach(([lx, c], i) => {
      ctx.fillStyle = c; ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 5 + i * 2);
      circlePath(ctx, lx, yt + 71, 3.8); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const frame = () => {
    closedPath(); ctx.strokeStyle = C.steelShade; ctx.lineWidth = lw * 1.6; ctx.lineJoin = 'round'; ctx.stroke();
    closedPath(); ink(ctx, null, lw * 0.8);
  };
  const sill = () => {
    const sp = () => rrectPath(ctx, xl - 9, yb - 9, xr - xl + 18, 15, 6);
    part(ctx, sp, C.steel, lw * 0.7, {
      shade: C.steelShade, shadeFn: () => { ctx.fillRect(xl - 10, yb + 1, xr - xl + 20, 8); ctx.fillRect(xr - 6, yb - 12, 20, 20); },
      hiFn: () => ctx.fillRect(xl - 2, yb - 6, 40, 2.5), hi: C.hi,
    });
  };
  // content standing in the doorway (rocket-local units), between the interior and the frame
  if (frameMode === 'sill') frame();
  if (o.hatchContent) {
    ctx.save();
    if (o.hatchClip) { closedPath(); ctx.clip(); }
    o.hatchContent(ctx);
    ctx.restore();
  }
  if (frameMode === 'full') frame();
  sill();
  // door leaf swinging on its right-hand hinge, toward the viewer
  const phi = ease.inOutSine(clamp(hatch)) * 2.55;
  const w = xr - xl, h = yb - yt;
  const xf = xr - w * Math.cos(phi);
  const grow = 0.07 * h * Math.sin(phi);
  const front = Math.cos(phi) > 0;
  const leaf = () => doorPath(ctx, xr, xf, yt, yb, yt - grow, yb + grow);
  const col = front ? hullCol : C.leafBack;
  const sh = front ? hullShade : C.leafBackShade;
  const k = Math.abs(xf - xr) / w;
  part(ctx, leaf, col, lwS * 0.85, {
    shade: sh, shadeFn: () => { ctx.fillRect(Math.min(xr, xf) - 2, yb - 30, Math.abs(xf - xr) + 4, 60); },
    fx: () => {
      if (!det || k < 0.15) return;
      const cx = (xr + xf) / 2;
      if (!front) {
        // inside of the hatch: quilted padding + wheel
        ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 2;
        for (let i = 1; i < 6; i++) {
          const yy = yt + 40 + ((h - 40) * i) / 6;
          ctx.beginPath(); ctx.moveTo(xr, yy); ctx.lineTo(xf, yy + (i / 6 - 0.5) * grow * 1.6); ctx.stroke();
        }
        wheelHandle(ctx, C, cx, (yt + yb) / 2 + 10, 15, lw, k);
      } else {
        wheelHandle(ctx, C, lerp(xr, xf, 0.74), (yt + yb) / 2 + 26, 13, lw, k);
      }
    },
  });
  if (o.hatchFront) { ctx.save(); o.hatchFront(ctx); ctx.restore(); }
}

// ---------------------------------------------------------------- parachutes
function canopy(ctx, C, w, h, lw) {
  // local: skirt centre at (0,0), apex at (0,-h). Six gores, scalloped skirt.
  const gores = 6;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w, -h * 0.75, -w * 0.55, -h, 0, -h);
    ctx.bezierCurveTo(w * 0.55, -h, w, -h * 0.75, w, 0);
    for (let i = gores; i > 0; i--) {
      const a = Math.sin(((i / gores) * 2 - 1) * Math.PI / 2) * w;
      const b = Math.sin((((i - 1) / gores) * 2 - 1) * Math.PI / 2) * w;
      ctx.quadraticCurveTo((a + b) / 2, h * 0.09, b, 0);
    }
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = C.cream; ctx.fill();
  ctx.save();
  outline(); ctx.clip();
  // alternate red gores (meridians of the dome)
  const mer = (phi, k) => { const sk = Math.sqrt(Math.max(0, 1 - k * k)); return [Math.sin(phi) * w * sk, -h * k]; };
  for (let i = 0; i < gores; i += 2) {
    const p0 = ((i / gores) * 2 - 1) * Math.PI / 2, p1 = (((i + 1) / gores) * 2 - 1) * Math.PI / 2;
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) { const [px, py] = mer(p0, j / 6); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    for (let j = 6; j >= 0; j--) { const [px, py] = mer(p1, j / 6); ctx.lineTo(px, py + (j === 0 ? h * 0.2 : 0)); }
    ctx.lineTo(mer(p0, 0)[0], h * 0.2);
    ctx.closePath();
    ctx.fillStyle = C.red; ctx.fill();
  }
  // shade on the right + underside, highlight upper-left
  ctx.fillStyle = 'rgba(80,20,30,0.22)';
  ctx.beginPath(); ctx.ellipse(w * 0.55, -h * 0.25, w * 0.62, h * 1.1, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(80,20,30,0.2)';
  ctx.fillRect(-w, -h * 0.12, w * 2, h * 0.3);
  ctx.fillStyle = C.hi;
  ctx.beginPath(); ctx.ellipse(-w * 0.45, -h * 0.68, w * 0.2, h * 0.1, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
  outline(); ink(ctx, null, lw);
}
function drawChutes(ctx, C, u, t, lw, lwS) {
  if (u <= 0) return;
  const riser = [0, BODY_T - 16];
  const pop = clamp(u / 0.3); // shooting out
  const open = clamp((u - 0.25) / 0.75); // inflating
  const cfg = [[-0.52, 440, 0.2], [0.52, 440, 1.3], [0, 500, 2.4]];
  // little "pop" burst at the nose
  if (u < 0.45) {
    const b = clamp(u / 0.45);
    ctx.save();
    ctx.globalAlpha *= 1 - b;
    ctx.strokeStyle = C.white; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.42;
      const r0 = 30 + 60 * b, r1 = r0 + 30;
      ctx.beginPath(); ctx.moveTo(riser[0] + Math.cos(a) * r0, riser[1] + Math.sin(a) * r0);
      ctx.lineTo(riser[0] + Math.cos(a) * r1, riser[1] + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }
  for (const [ang0, dist, ph] of cfg) {
    const swing = 0.05 * sway(t + ph * 0.3, 4) * open;
    const ang = ang0 * lerp(0.35, 1, ease.outCubic(open)) + swing;
    const d = dist * lerp(0.55 * ease.outBack(pop), 1, ease.outCubic(open));
    const wFull = 150, hFull = 118;
    const breath = 1 + 0.025 * Math.sin(t * 5.2 + ph);
    const w = wFull * lerp(0.2, 1, ease.outBack(open)) * breath;
    const h = hFull * lerp(1.35, 1, ease.outCubic(open));
    const cx = riser[0] + Math.sin(ang) * d, cy = riser[1] - Math.cos(ang) * d;
    // lines: from skirt points to the riser
    ctx.beginPath();
    for (const k of [-1, -0.33, 0.33, 1]) {
      const sx = cx + Math.cos(ang) * w * k, sy = cy + Math.sin(ang) * w * k;
      ctx.moveTo(sx, sy); ctx.lineTo(riser[0], riser[1]);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.4, lw * 0.6); ctx.stroke();
    ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1, lw * 0.25); ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    if (open < 0.05) {
      // streamer: a fluttering folded chute
      const fl = Math.sin(t * 40 + ph) * 6;
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-18 + fl, -h * 0.6, -4, -h); ctx.lineTo(6, -h);
      ctx.quadraticCurveTo(18 + fl, -h * 0.6, 12, 0); ctx.closePath();
      ink(ctx, C.red, lwS * 0.8);
      ctx.fillStyle = C.cream; ctx.fillRect(-4, -h * 0.9, 7, h * 0.8);
    } else {
      canopy(ctx, C, w, h, lwS);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- landing legs
function drawLegs(ctx, C, k, lwS) {
  if (k <= 0) return;
  const e = ease.outBack(clamp(k));
  const ext = LEG_LIFT * e;
  const lw = lwS * 0.8;
  const pad = (foot, rx) => {
    const fp = () => { ctx.beginPath(); ctx.ellipse(foot[0], foot[1] - 6, rx, 11, 0, 0, TAU); };
    part(ctx, fp, C.steel, lw, { shade: C.steelShade, shadeFn: () => ctx.fillRect(foot[0] - rx, foot[1] - 3, rx * 2, 20) });
  };
  for (const sg of [-1, 1]) {
    const top = [sg * 176, -78];
    const foot = [sg * (196 + 26 * e), ext];
    strokeLimb(ctx, [top, foot], 13, C.steel, lw);
    strokeLimb(ctx, [top, [lerp(top[0], foot[0], 0.5), lerp(top[1], foot[1], 0.5)]], 26, C.steelShade, lw);
    pad(foot, 32);
  }
  // centre leg out of the front fin
  const foot = [0, ext + 2];
  strokeLimb(ctx, [[0, -20], foot], 14, C.steel, lw);
  pad(foot, 30);
}

// ---------------------------------------------------------------- booster stage
// Local: origin = booster top centre (collar top), y down to BOOSTER_HEIGHT.
function boosterLocal(ctx, C, o, lw, lwS, det) {
  const { t = 0, flame = 0 } = o;
  const H = BOOSTER_HEIGHT;
  if (flame > 0) {
    const k = t ? kick(t) : 0;
    drawFlame(ctx, 0, H - 22, flame * 400 * (1 + 0.25 * k), 150 * (0.85 + 0.15 * flame) * (1 + 0.1 * k), t, { seed: 13, lw, sparks: det });
  }
  const bhw = (y) => (y < 30 ? lerp(88, 84, y / 30) : 84);
  // fins (behind body)
  for (const sg of [-1, 1]) {
    const fp = () => {
      ctx.beginPath();
      ctx.moveTo(sg * 70, 150);
      ctx.quadraticCurveTo(sg * 140, 190, sg * 156, H - 16);
      ctx.quadraticCurveTo(sg * 158, H, sg * 138, H);
      ctx.lineTo(sg * 110, H - 4);
      ctx.quadraticCurveTo(sg * 96, 262, sg * 70, 258);
      ctx.closePath();
    };
    part(ctx, fp, C.steel, lwS, {
      shade: C.steelShade, shadeFn: offsetShade(ctx, fp, C.steel, sg > 0 ? 8 : 3, 8),
      fx: () => { ctx.fillStyle = C.steelDark; ctx.fillRect(sg > 0 ? 100 : -170, H - 34, 70, 40); },
    });
  }
  // nozzle bell
  const nz = () => {
    ctx.beginPath();
    ctx.moveTo(-56, 232); ctx.lineTo(56, 232);
    ctx.quadraticCurveTo(62, 262, 80, H - 12);
    ctx.quadraticCurveTo(0, H, -80, H - 12);
    ctx.quadraticCurveTo(-62, 262, -56, 232);
    ctx.closePath();
  };
  part(ctx, nz, C.steelShade, lwS, {
    shade: C.steelDark, shadeFn: () => { polyPath(ctx, [[18, 220], [90, 220], [90, H + 10], [30, H + 10]]); ctx.fill(); },
    hiFn: () => { polyPath(ctx, [[-44, 238], [-36, 238], [-48, H - 16], [-58, H - 16]]); ctx.fill(); }, hi: C.hi,
  });
  // body cylinder with collar
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-bhw(0), 0);
    ctx.quadraticCurveTo(0, 10, bhw(0), 0);
    ctx.lineTo(84, 30); ctx.lineTo(84, 236);
    ctx.quadraticCurveTo(0, 250, -84, 236);
    ctx.lineTo(-84, 30); ctx.closePath();
  };
  const band = (y0, y1) => {
    ctx.beginPath();
    ctx.moveTo(-100, y0); ctx.quadraticCurveTo(0, y0 + 17, 100, y0);
    ctx.lineTo(100, y1); ctx.quadraticCurveTo(0, y1 + 17, -100, y1); ctx.closePath();
  };
  part(ctx, body, C.steel, lwS, {
    fx: () => {
      // collar ring
      ctx.fillStyle = C.steelShade; band(-10, 30); ctx.fill();
      // checker roll-pattern ring
      const n = 8;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i / n) * Math.PI, a1 = a0 + Math.PI / n;
        for (let r = 0; r < 2; r++) {
          if ((i + r) % 2) continue;
          const yA = 56 + r * 22, yB = yA + 22;
          ctx.moveTo(84 * Math.sin(a0), yA + 8 * Math.cos(a0));
          ctx.lineTo(84 * Math.sin(a1), yA + 8 * Math.cos(a1));
          ctx.lineTo(84 * Math.sin(a1), yB + 8 * Math.cos(a1));
          ctx.lineTo(84 * Math.sin(a0), yB + 8 * Math.cos(a0));
          ctx.closePath();
        }
      }
      ctx.fillStyle = C.checker; ctx.fill();
      // red stripes
      ctx.fillStyle = C.red; band(172, 190); ctx.fill(); band(202, 212); ctx.fill();
      // shade + highlight
      ctx.fillStyle = 'rgba(40,40,80,0.2)'; ctx.fillRect(36, -20, 60, 280);
      ctx.fillStyle = C.hi; ctx.fillRect(-64, 36, 9, 130);
      if (det) {
        ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.4;
        band(56, 100); ctx.stroke();
        const r1 = [], r2 = [];
        for (let i = 0; i <= 6; i++) {
          const a = -1.3 + (i / 6) * 2.6;
          r1.push([84 * Math.sin(a), 14 + 8 * Math.cos(a), 3 * (0.6 + 0.4 * Math.cos(a))]);
          r2.push([84 * Math.sin(a), 142 + 8 * Math.cos(a), 3 * (0.6 + 0.4 * Math.cos(a))]);
        }
        rivets(ctx, r1, C.steelDark, C.hi7);
        rivets(ctx, r2, C.steelShade, C.hi7);
      }
    },
  });
  // collar lip line
  ctx.beginPath(); ctx.moveTo(-86, 30); ctx.quadraticCurveTo(0, 46, 86, 30);
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.6; ctx.stroke();
  // front fin
  const ff = () => {
    ctx.beginPath();
    ctx.moveTo(-8, 172); ctx.quadraticCurveTo(0, 166, 8, 172);
    ctx.lineTo(15, H - 10); ctx.quadraticCurveTo(15, H + 2, 0, H + 2); ctx.quadraticCurveTo(-15, H + 2, -15, H - 10);
    ctx.closePath();
  };
  part(ctx, ff, C.steel, lwS, {
    shade: C.steelShade, shadeFn: () => ctx.fillRect(1, 160, 20, 160),
    fx: () => { ctx.fillStyle = C.steelDark; ctx.fillRect(-20, H - 34, 40, 40); },
  });
}

// The separated booster on its own. (x, y) = top centre of the collar; BOOSTER_HEIGHT tall.
// o: { t, flame 0..1 (pumps with kick), rot (pivot at its centre), shake 0..1, light }
export function drawBooster(ctx, x, y, s = 1, o = {}) {
  const { rot = 0, shake = 0, t = 0 } = o;
  const eff = effScale(ctx, s);
  const { lw, lwS } = widths(eff);
  const C = palFor(o.light);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  if (shake > 0) ctx.translate(shake * 6 * noise1(t * 41, 2), shake * 4 * noise1(t * 37, 8));
  if (rot) { ctx.translate(0, BOOSTER_HEIGHT / 2); ctx.rotate(rot); ctx.translate(0, -BOOSTER_HEIGHT / 2); }
  boosterLocal(ctx, C, o, lw, lwS, eff > 0.28);
  ctx.restore();
}

// ---------------------------------------------------------------- re-entry heat (untinted: it glows)
function heatOverlay(ctx, g, yTop, yBot, usePath = false) {
  // underside glowing orange → white-hot at the bottom (clip already applied)
  const gr = ctx.createLinearGradient(0, yBot, 0, yTop);
  gr.addColorStop(0, rgba('#fffbe6', 0.95 * g));
  gr.addColorStop(0.12, rgba('#ffd23f', 0.85 * g));
  gr.addColorStop(0.35, rgba('#ff8a3d', 0.6 * g));
  gr.addColorStop(1, rgba('#ff5a2a', 0));
  ctx.fillStyle = gr;
  if (usePath) ctx.fill();
  else ctx.fillRect(-400, yTop, 800, yBot - yTop);
}
function plasmaBehind(ctx, g, t, lw) {
  if (g <= 0) return;
  ctx.save();
  halo(ctx, 0, -60, 350 * g, 450 * g, '#ff9a3d', 0.09 * g, 4);
  ctx.globalAlpha *= clamp(g * 3);
  // big flame envelope wrapping the tail and trailing up past the sides
  ctx.save();
  ctx.translate(0, 90); ctx.rotate(Math.PI);
  drawFlame(ctx, 0, 0, 200 + 700 * g, 330 + 280 * g, t * 1.5, { seed: 91, cap: 0.3, lw, glow: 0 });
  ctx.restore();
  // side streamers
  for (const sg of [-1, 1]) {
    ctx.save();
    ctx.translate(sg * 215, 0); ctx.rotate(Math.PI + sg * 0.12);
    drawFlame(ctx, 0, 0, 120 + 440 * g, 50 + 50 * g, t * 1.7 + sg, { seed: 95 + sg, cap: 0.3, lw, glow: 0, sparks: false });
    ctx.restore();
  }
  ctx.restore();
}
function plasmaFront(ctx, g, t) {
  if (g <= 0) return;
  ctx.save();
  // white-hot bow glow under the tail + heat shimmer lines
  halo(ctx, 0, 30, 190 * g, 120 * g, '#fff4c2', 0.22 * g, 3);
  ctx.strokeStyle = rgba('#fff6d8', 0.55 * g); ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const ph = fract(t * 1.8 + hash01(i, 71));
    const x0 = (hash01(i, 72) - 0.5) * 420;
    const y0 = 40 - ph * 520;
    ctx.lineWidth = 5 * (1 - ph) + 1;
    ctx.beginPath();
    for (let j = 0; j <= 6; j++) {
      const yy = y0 - j * 16;
      const xx = x0 + 7 * Math.sin(j * 1.3 + t * 18 + i);
      j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  // embers streaming up past the hull
  for (let i = 0; i < 10; i++) {
    const ph = fract(t * 1.3 + hash01(i, 81));
    const side = hash01(i, 82) < 0.5 ? -1 : 1;
    const px = side * (150 + 110 * hash01(i, 83) + 40 * ph);
    const py = 40 - ph * 700;
    sparkle(ctx, px, py, 10 * (1 - ph) + 3, '#fff2b0', g * (1 - ph));
  }
  ctx.restore();
}

// ---------------------------------------------------------------- frame skeleton
function drawFrame(ctx, C, lw, lwS, det) {
  const steel = C.steelShade;
  const rib = (pts, w, col) => strokeLimb(ctx, pts, w, col, lwS * 0.6);
  // back stringers (thin, darker)
  for (const th of [-2.2, -2.7, 2.2, 2.7, Math.PI]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const y = lerp(BODY_B, BODY_T + 6, i / 16); const h = hwY(y); pts.push([h * Math.sin(th), y + E * h * Math.cos(th)]); }
    rib(pts, 4, C.frameBack);
  }
  // rings: back halves then front halves
  const ringsV = [0.0, 0.14, 0.3, 0.46, 0.62, 0.74, 0.86];
  for (const v of ringsV) {
    const y = lerp(BODY_B, BODY_T, v), h = hwY(y);
    ctx.beginPath(); ctx.ellipse(0, y, h, E * h, 0, Math.PI, TAU);
    ctx.strokeStyle = INK; ctx.lineWidth = 6 + lwS * 1.2; ctx.stroke();
    ctx.strokeStyle = C.frameBack; ctx.lineWidth = 6; ctx.stroke();
  }
  // floor + two little seats visible inside
  if (det) {
    const fy = lerp(BODY_B, BODY_T, 0.46);
    for (const [sx, sy, sc] of [[-20, fy - 4, 1], [-20, lerp(BODY_B, BODY_T, 0.3) - 4, 0.8]]) {
      rrectPath(ctx, sx - 30 * sc, sy - 60 * sc, 60 * sc, 56 * sc, 14 * sc); ink(ctx, C.red, lw * 0.6);
      rrectPath(ctx, sx - 36 * sc, sy - 14 * sc, 72 * sc, 14 * sc, 6 * sc); ink(ctx, C.redShade, lw * 0.6);
    }
  }
  // front stringers
  for (const th of [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const y = lerp(BODY_B, BODY_T + 6, i / 16); const h = hwY(y); pts.push([h * Math.sin(th), y + E * h * Math.cos(th)]); }
    rib(pts, 7, steel);
  }
  for (const v of ringsV) {
    const y = lerp(BODY_B, BODY_T, v), h = hwY(y);
    ctx.beginPath(); ctx.ellipse(0, y, h, E * h, 0, 0, Math.PI);
    ctx.strokeStyle = INK; ctx.lineWidth = 9 + lwS * 1.2; ctx.stroke();
    ctx.strokeStyle = C.steel; ctx.lineWidth = 9; ctx.stroke();
    if (det) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const th = -1.3 + (i / 6) * 2.6;
        pts.push([h * Math.sin(th), y + E * h * Math.cos(th), 2.6]);
      }
      rivets(ctx, pts, C.steelDark, C.hi7);
    }
  }
  // tip cap
  circlePath(ctx, 0, BODY_T + 6, 9); ink(ctx, C.steel, lwS * 0.7);
  // fin frames
  for (const sg of [-1, 1]) {
    finPath(ctx, sg, true);
    ctx.strokeStyle = INK; ctx.lineWidth = 8 + lwS * 1.2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = C.steel; ctx.lineWidth = 8; ctx.stroke();
    rib([[sg * 118, -300], [sg * 214, -30]], 6, steel);
    rib([[sg * 120, -170], [sg * 200, -170]], 6, steel);
  }
  rib([[0, -176], [0, 2]], 8, C.steel);
}

// ---------------------------------------------------------------- main draw
// (x, y) = bottom centre of the main stage (fin tips; with legs deployed = the foot pads).
export function drawRocket(ctx, x, y, s = 1, o = {}) {
  const {
    t = 0, flame = 0, booster = false, boosterOffset = 0, boosterRot = 0, hatch = 0, crew = false,
    crewPose = {}, glow: heat = 0, chute = 0, legs = 0, build = 'done', stickers = false, shake = 0, rot = 0,
  } = o;
  const paint = o.paint ?? 1;
  const eff = effScale(ctx, s);
  const { lw, lwS } = widths(eff);
  const det = eff > 0.28; // small details (rivets, bolts, text)
  const stage = ['frame', 'panels', 'painted', 'done'].indexOf(build);
  const st = stage < 0 ? 3 : stage;
  const C = palFor(o.light);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (shake > 0) {
    ctx.translate(shake * 7 * noise1(t * 41, 1), shake * 5 * noise1(t * 43, 2));
    ctx.rotate(shake * 0.012 * noise1(t * 37, 3));
  }
  if (rot) { ctx.translate(0, -ROCKET_HEIGHT / 2); ctx.rotate(rot); ctx.translate(0, ROCKET_HEIGHT / 2); }
  const lift = legs > 0 ? LEG_LIFT * ease.outBack(clamp(legs)) : 0;
  ctx.translate(0, -lift);

  const hullCol = st === 1 ? C.bare : C.cream;
  const hullShade = st === 1 ? C.bareShade : C.creamShade;
  const accent = (i) => (st >= 2 ? paintFrac(paint, i) : 0); // how painted accent part i is
  const accentBase = st === 1 ? C.bare : C.primer;
  const accentShade = st === 1 ? C.bareShade : C.primerShade;

  // parachutes (behind the nose)
  drawChutes(ctx, C, chute, t, lw, lwS);
  // re-entry plasma behind the hull
  plasmaBehind(ctx, heat, t, lw);

  const attached = booster && boosterOffset <= 0.5;
  // main engine flame (not while the booster is still attached)
  if (flame > 0 && !attached) {
    const k = t ? kick(t) : 0;
    drawFlame(ctx, 0, NOZ_BOT - 8, flame * 360 * (1 + 0.28 * k), 150 * (0.8 + 0.2 * flame) * (1 + 0.08 * k), t, { seed: 5, lw, sparks: det });
  }
  // nozzle bell
  const nzShade = () => { polyPath(ctx, [[16, NOZ_TOP - 10], [90, NOZ_TOP - 10], [90, 10], [28, 10]]); ctx.fill(); };
  part(ctx, () => nozzlePath(ctx), C.steelShade, lwS, {
    shade: C.steelDark, shadeFn: nzShade,
    hiFn: () => { polyPath(ctx, [[-40, NOZ_TOP + 6], [-32, NOZ_TOP + 6], [-50, NOZ_BOT - 8], [-61, NOZ_BOT - 8]]); ctx.fill(); }, hi: C.hi,
    fx: () => {
      // lip band at the mouth of the bell
      ctx.beginPath();
      ctx.moveTo(-100, NOZ_BOT - 12); ctx.quadraticCurveTo(0, NOZ_BOT + 2, 100, NOZ_BOT - 12);
      ctx.lineTo(100, NOZ_BOT + 20); ctx.lineTo(-100, NOZ_BOT + 20); ctx.closePath();
      ctx.fillStyle = C.steelDark; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.45;
      ctx.beginPath(); ctx.moveTo(-100, NOZ_BOT - 12); ctx.quadraticCurveTo(0, NOZ_BOT + 2, 100, NOZ_BOT - 12); ctx.stroke();
      if (heat > 0) heatOverlay(ctx, heat, NOZ_TOP - 20, 4);
    },
  });
  // booster stage (below; its collar hides the main nozzle while attached)
  if (booster) {
    ctx.save();
    ctx.translate(0, BODY_B + boosterOffset);
    if (boosterRot) { ctx.translate(0, BOOSTER_HEIGHT / 2); ctx.rotate(boosterRot); ctx.translate(0, -BOOSTER_HEIGHT / 2); }
    boosterLocal(ctx, C, { t, flame: attached ? flame : (o.boosterFlame ?? 0) }, lw, lwS, det);
    ctx.restore();
    // separation puffs + sparkles in the gap
    if (!attached && boosterOffset < 260) {
      const u = clamp(boosterOffset / 260);
      for (let i = 0; i < 6; i++) {
        const sg = i % 2 ? 1 : -1;
        const px = sg * (70 + 150 * u * (0.6 + hash01(i, 5))), py = BODY_B + boosterOffset * (0.3 + 0.3 * hash01(i, 6));
        smokePuff(ctx, px, py, 26 + 30 * u, { seed: i + 11, u: 0.1 + 0.9 * u, n: 4, lw: lw * 0.8, fill: C.smoke, shadeCol: C.smokeShade });
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.4;
        sparkle(ctx, Math.cos(a) * (60 + 180 * u), BODY_B + boosterOffset * 0.5 + Math.sin(a) * 50 * (0.5 + u), 18 * (1 - u) + 4, '#fff6c0', 1 - u);
      }
    }
  }
  drawLegs(ctx, C, legs, lwS);

  if (st === 0) {
    drawFrame(ctx, C, lw, lwS, det);
  } else {
    // ---- side fins (shaded without clipping: a smaller copy scaled toward the lit corner) ----
    for (const sg of [-1, 1]) {
      const pi = sg < 0 ? 0 : 2;
      const f = accent(pi);
      const base = f >= 1 ? C.red : accentBase;
      const shadeCol = f >= 1 ? C.redShade : accentShade;
      finPath(ctx, sg); ctx.fillStyle = shadeCol; ctx.fill();
      ctx.save();
      ctx.translate(sg * 196, -176); ctx.scale(0.87, 0.87); ctx.translate(-sg * 196, 176);
      finPath(ctx, sg); ctx.fillStyle = base; ctx.fill();
      ctx.restore();
      if (f > 0 && f < 1) {
        ctx.save(); finPath(ctx, sg); ctx.clip();
        paintReveal(ctx, C, f, -330, 6, sg < 0 ? -250 : 50, sg < 0 ? -50 : 250, 3 + sg);
        crescent(ctx, () => finPath(ctx, sg), sg > 0 ? 14 : 6, 13, 'rgba(70,20,40,0.24)');
        ctx.restore();
      }
      if (heat > 0) { finPath(ctx, sg); ctx.fillStyle = rgba('#ff9a3d', 0.6 * heat); ctx.fill(); }
      // pale highlight just inside the leading edge
      ctx.beginPath();
      ctx.moveTo(sg * 128, -292);
      ctx.bezierCurveTo(sg * 180, -262, sg * 214, -170, sg * 216, -74);
      ctx.strokeStyle = C.hi45; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
      if (st === 1 && det) { // bare metal panel line
        ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(sg * 120, -220); ctx.quadraticCurveTo(sg * 186, -170, sg * 206, -90); ctx.stroke();
      }
      finPath(ctx, sg); ink(ctx, null, lwS);
    }

    // ---- hull (no clipping: every region is an exact polygon on the silhouette) ----
    const bp = () => bodyPath(ctx);
    bp(); ctx.fillStyle = hullCol; ctx.fill();
    // nose cone (accent 3)
    if (st >= 1) {
      const f = st >= 2 ? accent(3) : 0;
      hullBand(ctx, BODY_T, NOSE_Y);
      ctx.fillStyle = st === 1 ? C.bareNose : f >= 1 ? C.red : accentBase; ctx.fill();
      if (f > 0 && f < 1) {
        ctx.save(); hullBand(ctx, BODY_T, NOSE_Y); ctx.clip();
        paintRevealX(ctx, C, f, -130, 130, BODY_T - 20, NOSE_Y + 30, 9);
        ctx.restore();
      }
    }
    // red band (accent 1)
    if (st >= 2) {
      const f = accent(1);
      hullBand(ctx, BAND_T, BAND_B); ctx.fillStyle = f >= 1 ? C.red : accentBase; ctx.fill();
      if (f > 0 && f < 1) {
        ctx.save(); hullBand(ctx, BAND_T, BAND_B); ctx.clip();
        paintRevealX(ctx, C, f, -146, 146, BAND_T - 20, BAND_B + 22, 5);
        ctx.restore();
      }
    }
    // panels stage: plate seams and a few gaps showing the frame
    if (st === 1) {
      const rows = [0.0, 0.14, 0.28, 0.42, 0.56, 0.7];
      const gaps = [[1, 1], [0, 3], [3, 0]]; // clear of the portholes and the door
      for (const [ri, ci] of gaps) {
        const yA = lerp(BODY_B, BODY_T, rows[ri]), yB = lerp(BODY_B, BODY_T, rows[ri + 1]);
        const cols = ri % 2 ? [-1.5, -0.95, -0.35, 0.25, 0.85, 1.5] : [-1.5, -0.65, -0.05, 0.55, 1.15, 1.5];
        const th0 = cols[ci], th1 = cols[ci + 1];
        const cell = () => {
          ctx.beginPath();
          for (let j = 0; j <= 6; j++) { const [px, py] = cyl(yA, lerp(th0, th1, j / 6)); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          for (let j = 6; j >= 0; j--) { const [px, py] = cyl(yB, lerp(th0, th1, j / 6)); ctx.lineTo(px, py); }
          ctx.closePath();
        };
        cell(); ctx.fillStyle = C.gapDark; ctx.fill();
        ctx.save(); ctx.clip();
        const ym = (yA + yB) / 2;
        seamCurve(ctx, ym, th0 - 0.2, th1 + 0.2, 6);
        ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.stroke();
        ctx.strokeStyle = C.gapRib; ctx.lineWidth = 7; ctx.stroke();
        const [sx0, sy0] = cyl(yA, (th0 + th1) / 2), [sx1, sy1] = cyl(yB, (th0 + th1) / 2);
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1);
        ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.stroke();
        ctx.strokeStyle = C.gapRib2; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = 'rgba(20,10,40,0.35)'; ctx.fillRect(-300, yB - 14, 600, 30);
        ctx.restore();
        cell(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.6; ctx.stroke();
      }
      ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 2.5;
      for (let r = 1; r < rows.length; r++) { seamCurve(ctx, lerp(BODY_B, BODY_T, rows[r])); ctx.stroke(); }
      for (let r = 0; r < rows.length - 1; r++) {
        const cols = r % 2 ? [-0.95, -0.35, 0.25, 0.85] : [-0.65, -0.05, 0.55, 1.15];
        for (const th of cols) {
          const yA = lerp(BODY_B, BODY_T, rows[r]), yB = lerp(BODY_B, BODY_T, rows[r + 1]);
          const a = cyl(yA, th), b = cyl(yB, th);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
      if (det) for (let r = 1; r < rows.length; r++) rivetRow(ctx, C, lerp(BODY_B, BODY_T, rows[r]) - 7, C.bareShade, 24);
    }
    // shade strip on the right, highlight on the left (over every colour region)
    ctx.beginPath();
    for (let i = 0; i < BODY_R.length; i++) { const [h, yy] = BODY_R[i]; i ? ctx.lineTo(h * 0.5, yy) : ctx.moveTo(h * 0.5, yy + E * h * 0.87); }
    for (let i = BODY_R.length - 1; i >= 0; i--) { const [h, yy] = BODY_R[i]; ctx.lineTo(h + 1, yy); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,50,20,0.16)'; ctx.fill();
    ctx.fillStyle = C.hi;
    ctx.beginPath();
    for (let i = 4; i < 36; i++) { const [h, yy] = BODY_R[i]; i > 4 ? ctx.lineTo(-h * 0.7, yy) : ctx.moveTo(-h * 0.7, yy); }
    for (let i = 35; i >= 4; i--) { const [h, yy] = BODY_R[i]; ctx.lineTo(-h * 0.58, yy); }
    ctx.closePath(); ctx.fill();
    // underside shade
    hullBand(ctx, BODY_B - 28, BODY_B);
    ctx.fillStyle = 'rgba(120,50,20,0.14)'; ctx.fill();

    if (st >= 1) {
      // seam lines around the nose and band
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.55;
      seamCurve(ctx, NOSE_Y); ctx.stroke();
      if (st >= 2) { seamCurve(ctx, BAND_T); ctx.stroke(); seamCurve(ctx, BAND_B); ctx.stroke(); }
      if (det) {
        rivetRow(ctx, C, NOSE_Y + 12, st === 1 ? C.bareShade : C.creamShade, 21, -1.35, 1.35, 3.3,
          (px, py) => px > DOOR.xl - 10 && px < DOOR.xr + 10 && py > DOOR.yt - 8); // clear of the door arch
        if (st >= 2) {
          rivetRow(ctx, C, BAND_T - 10, C.creamShade, 22);
          rivetRow(ctx, C, BAND_B + 11, C.creamShade, 22);
        }
        // vertical seam with rivets on the left
        const TH = -1.15;
        ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const [px, py] = cyl(lerp(BODY_B + 6, NOSE_Y, i / 10), TH); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        const vr = [];
        for (let i = 1; i < 12; i++) {
          const yy = lerp(BODY_B + 6, NOSE_Y, i / 12);
          if (yy < BAND_T + 8 && yy > BAND_B - 12 && st >= 2) continue;
          const [px, py] = cyl(yy, TH);
          vr.push([px + 6, py, 2.6]);
        }
        rivets(ctx, vr, st === 1 ? C.bareShade : C.creamShade, C.hi7);
      }
    }
    // ---- decals (done) ----
    if (st === 3 && det) {
      // "S.S. BISCUIT" wrapped around the hull: small "S.S." + big "BISCUIT"
      const chars = [];
      for (const [txt, k] of [['S.S.', 0.6], [' ', 0.45], ['BISCUIT', 1]]) {
        for (const c of txt) {
          ctx.font = `bold ${54 * k}px ${FONT.title}`;
          chars.push([c, k, ctx.measureText(c).width + 2 * k]);
        }
      }
      const total = chars.reduce((a, c) => a + c[2], 0);
      const h = hwY(NAME_Y);
      const fit = Math.min(1, (h * 2.05) / total);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
      let acc = (-total * fit) / 2;
      for (const [c, k, cw0] of chars) {
        const cw = cw0 * fit;
        const th = (acc + cw / 2) / h;
        acc += cw;
        if (c === ' ') continue;
        const [px, py] = cyl(NAME_Y, th);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan(-E * Math.tan(th)));
        ctx.scale(Math.cos(th), 1);
        ctx.font = `bold ${54 * k * fit}px ${FONT.title}`;
        ctx.strokeStyle = INK; ctx.lineWidth = 6 * Math.sqrt(k); ctx.strokeText(c, 0, 0);
        ctx.fillStyle = C.red; ctx.fillText(c, 0, 0);
        ctx.restore();
      }
      // teal riveted patch (lower right)
      ctx.save();
      ctx.translate(78, -128); ctx.rotate(-0.08); ctx.scale(0.8, 1);
      const pp = () => rrectPath(ctx, -27, -24, 54, 48, 5);
      part(ctx, pp, C.teal, lw * 0.7, {
        shade: C.tealShade, shadeFn: () => { ctx.fillRect(12, -30, 30, 60); ctx.fillRect(-30, 14, 60, 20); },
        hiFn: () => ctx.fillRect(-21, -19, 16, 4), hi: C.hi,
      });
      rivets(ctx, [[-19, -16], [19, -16], [-19, 16], [19, 16], [0, -16], [0, 16], [-19, 0], [19, 0]].map(([a, b]) => [a, b, 2.8]), C.tealShade, C.hi7);
      ctx.restore();
      // paw-print decal (lower left), wrapped on the hull
      ctx.save();
      const pth = -0.62, [ppx, ppy] = cyl(-138, pth);
      ctx.translate(ppx, ppy); ctx.rotate(-0.25); ctx.scale(Math.cos(pth) * 1.05, 1.05);
      ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.moveTo(-18, 10);
      ctx.bezierCurveTo(-22, -8, 22, -8, 18, 10); ctx.bezierCurveTo(15, 20, -15, 20, -18, 10); ctx.fill();
      for (const [bx, by, br] of [[-19, -12, 6.5], [-7, -22, 7], [7, -22, 7], [19, -12, 6.5]]) { ellipsePath(ctx, bx, by, br * 0.85, br, 0); ctx.fill(); }
      ctx.restore();
    }
    if (heat > 0) { hullBand(ctx, BODY_B - 360, BODY_B); heatOverlay(ctx, heat, BODY_B - 360, BODY_B + 20, true); }
    bp(); ink(ctx, null, lwS);

    // stickers: a shiny gold star sticker at Juno's reach (+ a small one on the nose)
    if (stickers && st >= 2) {
      for (const [sx, sy, sr, rr] of [[96, -200, 19, -0.25], [40, -606, 15, 0.3]]) {
        softStarPath(ctx, sx, sy, sr + 5, (sr + 5) * 0.58, 5, -Math.PI / 2 + rr);
        ink(ctx, C.white, lw * 0.6);
        softStarPath(ctx, sx, sy, sr, sr * 0.55, 5, -Math.PI / 2 + rr);
        ctx.fillStyle = C.yellow; ctx.fill();
        ctx.fillStyle = C.starShade;
        ctx.save(); softStarPath(ctx, sx, sy, sr, sr * 0.55, 5, -Math.PI / 2 + rr); ctx.clip();
        ctx.fillRect(sx + sr * 0.1, sy - sr, sr, sr * 2); ctx.restore();
        ctx.fillStyle = C.white; circlePath(ctx, sx - sr * 0.3, sy - sr * 0.25, sr * 0.15); ctx.fill();
      }
    }

    // ---- portholes (the crew sit in the lit cabin: untinted unless crewPose.*.light is given) ----
    const girlPose = crewPose.girl || {}, dogPose = crewPose.dog || {};
    porthole(ctx, C, PORT_J, lw, det, crew ? () => {
      const sc = girlPose.s ?? 0.5;
      drawGirlHead(ctx, PORT_J.x + (girlPose.dx ?? 2), PORT_J.y + (girlPose.dy ?? 10), sc, { t, helmet: 1, suit: 'space', expr: 'happy', ...girlPose });
    } : null);
    porthole(ctx, C, PORT_B, lw, det, crew ? () => {
      const sc = dogPose.s ?? 0.5;
      drawDogHead(ctx, PORT_B.x + (dogPose.dx ?? -7 * (dogPose.facing ?? 1)), PORT_B.y + (dogPose.dy ?? 4), sc, { t, helmet: 1, expr: 'happy', ...dogPose });
    } : null);

    // ---- hatch ----
    drawHatch(ctx, C, hatch, hullCol, hullShade, lw, lwS, det, t, o);

    // ---- front fin (accent 2) ----
    {
      const f = accent(2);
      frontFinPath(ctx); ctx.fillStyle = f >= 1 ? C.red : accentBase; ctx.fill();
      if (f > 0 && f < 1) { ctx.save(); frontFinPath(ctx); ctx.clip(); paintReveal(ctx, C, f, -186, 6, -30, 30, 17, false); ctx.restore(); }
      ctx.beginPath();
      ctx.moveTo(4, -184); ctx.lineTo(11, -180); ctx.lineTo(25, -14);
      ctx.quadraticCurveTo(25, 4, 0, 4); ctx.lineTo(9, -14); ctx.closePath();
      ctx.fillStyle = 'rgba(70,20,40,0.24)'; ctx.fill();
      ctx.fillStyle = C.hi; ctx.fillRect(-13, -150, 5, 110);
      if (heat > 0) { frontFinPath(ctx); ctx.fillStyle = rgba('#ffd86b', 0.7 * heat); ctx.fill(); }
      frontFinPath(ctx); ink(ctx, null, lwS);
    }
  }

  plasmaFront(ctx, heat, t);
  ctx.restore();
}

// =====================================================================================
//                                   LAUNCH GANTRY (s05)
// =====================================================================================
// Laid out in the S.S. Biscuit's local units, so pass the SAME (x, y, s) as drawRocket: the tower
// stands to the rocket's right (the hatch side), its access-arm deck level with ROCKET_HATCH.sillY.
// o.base = px from y down to the ground under the tower (default 216·s: the attached booster's
// fin tips). Draw it BEFORE the rocket: the arm tucks behind the hull and the open door leaf.
const GT = { x: 340, hw: 56, back: [24, -16], rungSpacing: 46, ladderHW: 30, top: 170 };
function gantryLayout(s, o) {
  const baseL = (o.base ?? 216 * s) / s;
  const platY = ROCKET_HATCH.sillY;
  const span = Math.max(60, baseL - platY);
  const n = Math.max(2, Math.round(o.rungs ?? span / GT.rungSpacing));
  const sp = span / n;
  const rungs = [];
  for (let k = 1; k <= n; k++) rungs.push(baseL - sp * k);
  return { baseL, platY, n, sp, rungs, topY: platY - GT.top };
}
// Where to put Juno on the ladder: all values are px offsets from the gantry/rocket (x, y), at s.
// rungs = rung heights bottom → top (the last one is the deck); x = ladder centre.
export function gantryRungs(s = 1, o = {}) {
  const L = gantryLayout(s, o);
  return {
    x: GT.x * s, ladderW: GT.ladderHW * 2 * s,
    rungs: L.rungs.map((r) => r * s), spacing: L.sp * s,
    platformY: L.platY * s, baseY: L.baseL * s, topY: L.topY * s,
    armX0: (GT.x - GT.hw) * s, armX1: 128 * s, hatchX: ROCKET_HATCH.x * s,
  };
}
// o: { t (beacon blinks on beats), swing 0..1 (access arm swings away at liftoff), base px, rungs (count), light }
export function drawGantry(ctx, x, y, s = 1, o = {}) {
  const { t = 0, swing = 0 } = o;
  const eff = effScale(ctx, s);
  const { lw, lwS } = widths(eff);
  const det = eff > 0.28;
  const C = palFor(o.light);
  const L = gantryLayout(s, o);
  const { baseL, platY, topY } = L;
  const TX = GT.x, HW = GT.hw, [OX, OY] = GT.back;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);

  const bays = (yb, yt) => {
    const n = Math.max(1, Math.round((yb - yt) / 64));
    const ys = [];
    for (let i = 0; i <= n; i++) ys.push(lerp(yb, yt, i / n));
    return ys;
  };
  const lattice = (cx, yb, yt, legCol, braceCol, legW, braceW, lwL, shadeRight) => {
    const ys = bays(yb, yt);
    const segs = [];
    for (let i = 0; i < ys.length - 1; i++) {
      segs.push([cx - HW, ys[i + 1], cx + HW, ys[i + 1]]);
      segs.push([cx - HW, ys[i], cx + HW, ys[i + 1]]);
      segs.push([cx + HW, ys[i], cx - HW, ys[i + 1]]);
    }
    strokeBars(ctx, segs, braceW, braceCol, lwL);
    strokeLimb(ctx, [[cx - HW, yb], [cx - HW, yt]], legW, legCol, lwL);
    strokeLimb(ctx, [[cx + HW, yb], [cx + HW, yt]], legW, shadeRight || legCol, lwL);
  };

  // ---- back face (seen through the front lattice: darker, thinner) ----
  lattice(TX + OX, baseL + OY, topY + OY, C.braceBack, C.braceBack, 11, 5, lw * 0.6);
  // side bars joining front and back legs at the platform & top
  strokeBars(ctx, [[TX + HW, platY, TX + HW + OX, platY + OY], [TX + HW, topY, TX + HW + OX, topY + OY]], 7, C.steelShade, lw * 0.6);

  // ---- access arm (swings away about its hinge at the tower) ----
  {
    const hx = TX - HW, len = hx - 128;
    const th = ease.inOutCubic(clamp(swing)) * 1.45;
    const k = Math.cos(th);
    const ex = hx - len * k, dy = -Math.sin(th) * 18; // far end rises a touch as it turns away
    const railY = platY - 58;
    const segs = [];
    const nb = 4;
    for (let i = 0; i < nb; i++) {
      const a = lerp(hx, ex, i / nb), b = lerp(hx, ex, (i + 1) / nb);
      const ya = dy * (i / nb), yb2 = dy * ((i + 1) / nb);
      segs.push(i % 2 ? [a, platY + ya, b, railY + yb2] : [a, railY + ya, b, platY + yb2]);
      segs.push([b, platY + yb2, b, railY + yb2]);
    }
    strokeBars(ctx, segs, 5, C.steelShade, lw * 0.6);
    strokeLimb(ctx, [[hx, railY], [ex, railY + dy]], 7, C.red, lw * 0.7); // hand rail
    // deck beam
    const deck = () => { ctx.beginPath(); ctx.moveTo(hx, platY - 7); ctx.lineTo(ex, platY - 7 + dy); ctx.lineTo(ex, platY + 9 + dy); ctx.lineTo(hx, platY + 9); ctx.closePath(); };
    part(ctx, deck, C.steel, lw * 0.8, { shade: C.steelShade, shadeFn: () => { ctx.fillRect(Math.min(hx, ex) - 5, platY + 2 + Math.min(0, dy), Math.abs(hx - ex) + 10, 30); } });
  }

  // ---- front face ----
  lattice(TX, baseL, topY, C.steel, C.brace, 16, 7, lw * 0.8, C.steelShade);
  // leg highlights
  ctx.strokeStyle = C.hi; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(TX - HW - 3, baseL - 10); ctx.lineTo(TX - HW - 3, topY + 10); ctx.stroke();

  // ---- concrete footing ----
  const foot = () => rrectPath(ctx, TX - HW - 30, baseL - 16, 2 * HW + 60 + OX, 26, 6);
  part(ctx, foot, C.concrete, lwS, { shade: C.concreteShade, shadeFn: () => { ctx.fillRect(TX - HW - 40, baseL + 2, 2 * HW + 90, 20); ctx.fillRect(TX + HW + 10, baseL - 20, 60, 40); } });

  // ---- platform deck at hatch level, with hazard-striped edge + railing ----
  const railY = platY - 58;
  {
    const posts = [TX - HW - 8, TX + HW + OX - 4];
    const segs = posts.map((px) => [px, platY, px, railY]);
    segs.push([TX + 44, railY, TX + HW + OX - 4, railY], [TX + 44, railY + 28, TX + HW + OX - 4, railY + 28]);
    strokeBars(ctx, segs, 6, C.red, lw * 0.7);
    const dk = () => rrectPath(ctx, TX - HW - 12, platY - 8, 2 * HW + OX + 22, 20, 4);
    part(ctx, dk, C.steel, lwS * 0.8, {
      fx: () => {
        ctx.fillStyle = C.hazard; ctx.fillRect(TX - HW - 14, platY - 8, 2 * HW + OX + 30, 22);
        ctx.fillStyle = INK;
        ctx.beginPath();
        for (let xx = TX - HW - 30; xx < TX + HW + OX + 20; xx += 20) { ctx.moveTo(xx, platY + 14); ctx.lineTo(xx + 10, platY + 14); ctx.lineTo(xx + 20, platY - 8); ctx.lineTo(xx + 10, platY - 8); ctx.closePath(); }
        ctx.fill();
        ctx.fillStyle = 'rgba(40,30,60,0.25)'; ctx.fillRect(TX - HW - 14, platY + 4, 2 * HW + OX + 30, 12);
      },
    });
  }
  // ---- top deck, mast, floodlight and beacon ----
  {
    const tk = () => rrectPath(ctx, TX - HW - 10, topY - 8, 2 * HW + OX + 18, 16, 4);
    part(ctx, tk, C.steelShade, lwS * 0.8, { shade: C.steelDark, shadeFn: () => ctx.fillRect(TX - HW - 12, topY + 2, 2 * HW + OX + 30, 10) });
    strokeLimb(ctx, [[TX + 10, topY - 8], [TX + 10, topY - 76]], 8, C.steel, lw * 0.7);
    // floodlight aimed at the rocket
    ctx.save(); ctx.translate(TX - HW + 10, topY - 22); ctx.rotate(-0.25);
    rrectPath(ctx, -26, -14, 36, 28, 6); ink(ctx, C.steelShade, lw * 0.7);
    rrectPath(ctx, -30, -11, 8, 22, 3); ink(ctx, '#fff4c7', lw * 0.5); // lamp face (a light: untinted)
    ctx.restore();
    // red beacon, flashing on every beat (a light source: untinted)
    const on = t > 0 ? pulse(t, 5) : 0;
    const by = topY - 84;
    if (on > 0.02) halo(ctx, TX + 10, by, 34 * (0.6 + on), 34 * (0.6 + on), '#ff5040', 0.35 * on, 3);
    ctx.beginPath(); ctx.moveTo(TX - 1, by + 8); ctx.lineTo(TX - 1, by); ctx.arc(TX + 10, by, 11, Math.PI, 0); ctx.lineTo(TX + 21, by + 8); ctx.closePath();
    ink(ctx, mixColor(C.redShade, '#ff8a7a', on), lw * 0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; circlePath(ctx, TX + 6, by - 3, 2.6); ctx.fill();
  }

  // ---- ladder (front, red rails, steel rungs) ----
  {
    const lx0 = TX - GT.ladderHW, lx1 = TX + GT.ladderHW;
    const segs = [];
    for (const ry of L.rungs) segs.push([lx0, ry, lx1, ry]);
    strokeBars(ctx, segs, 8, C.rung, lw * 0.6);
    // red rails run from the footing up past the deck as grab handles
    strokeBars(ctx, [[lx0, baseL - 8, lx0, platY - 52], [lx1, baseL - 8, lx1, platY - 52]], 10, C.red, lw * 0.7);
    ctx.strokeStyle = C.hi; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(lx0 - 2, baseL - 14); ctx.lineTo(lx0 - 2, platY - 44); ctx.stroke();
    if (det) {
      // brackets tying the ladder to the tower every few rungs
      const br = [];
      for (let i = 1; i < L.rungs.length; i += 3) br.push([lx1, L.rungs[i] + L.sp * 0.5, TX + HW, L.rungs[i] + L.sp * 0.5]);
      strokeBars(ctx, br, 4, C.steelShade, lw * 0.5);
    }
  }
  // small amber deck lamps alternating on the beat (light sources: untinted)
  if (det) {
    const b = t > 0 ? Math.floor(beatAt(t) + 1e-6) : 0;
    [[TX - HW - 8, railY - 6], [TX + HW + OX - 4, railY - 6]].forEach(([lx, ly], i) => {
      const lit = ((b + i) & 1) === 0 && t > 0 ? pulse(t, 3) : 0;
      if (lit > 0.05) halo(ctx, lx, ly, 16, 16, '#ffc44d', 0.4 * lit, 2);
      circlePath(ctx, lx, ly, 5.5); ink(ctx, mixColor('#b07a2a', '#ffd76a', lit), lw * 0.5);
    });
  }
  ctx.restore();
}

// =====================================================================================
//                                   AIRLINER (s08)
// =====================================================================================
// Side-view cartoon jet. (x, y) = fuselage centre; ~800 x 250 px at s = 1 (facing right).
// o: { t, face 0..1 (the passenger pops from dozy to startled, outBack), facing 1|-1,
//      contrail (length in local units, default 1500), passenger (window index from the nose, default 2), light }
const JET_WIN = { y: -12, r: 17, x0: 244, dx: -48, n: 11 };
function fuselagePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-300, -52);
  ctx.lineTo(250, -52);
  ctx.bezierCurveTo(330, -52, 390, -30, 396, 2);
  ctx.bezierCurveTo(399, 34, 360, 54, 300, 56);
  ctx.lineTo(-150, 56);
  ctx.bezierCurveTo(-250, 56, -345, 22, -398, -26);
  ctx.quadraticCurveTo(-412, -40, -398, -50);
  ctx.quadraticCurveTo(-390, -53, -370, -53);
  ctx.closePath();
}
function passengerFace(ctx, C, f, t, lw, r) {
  const pop = ease.outBack(clamp(f));
  const sur = smoothstep(0.12, 0.45, f);
  // warm cabin + seat back behind the head
  ctx.fillStyle = C.cabin; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.fillStyle = C.seatBlue; rrectPath(ctx, -r * 0.8, -r * 0.35, r * 1.6, r * 1.8, 6); ctx.fill();
  const bob = sur ? 0 : 0.6 * Math.sin(t * 2.2);
  ctx.save();
  ctx.translate(0.5, r * 0.22 - 2.5 * pop + bob);
  const hs = 1 + 0.16 * pop;
  ctx.scale(hs, hs);
  const hr = 10.5;
  // hair tufts (behind the head): calm = neat side tufts; startled = sprung up
  ctx.fillStyle = C.hairGrey; ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.3; ctx.lineJoin = 'round';
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    if (sur < 0.5) { ctx.ellipse(sg * 9.5, -3, 3.8, 5, sg * 0.3, 0, TAU); }
    else {
      ctx.moveTo(sg * 7, -2); ctx.lineTo(sg * 15, -13); ctx.lineTo(sg * 10.5, -6.5); ctx.lineTo(sg * 13.5, -2); ctx.lineTo(sg * 8, 1); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
  }
  // head
  circlePath(ctx, 0, 0, hr); ink(ctx, C.skin, lw * 0.35);
  lunePath(ctx, 0, 0, hr - lw * 0.18, 2.4, 2.6); ctx.fillStyle = C.skinShade; ctx.fill();
  ctx.fillStyle = C.hi; ellipsePath(ctx, -4, -6.5, 2.6, 1.4, -0.5); ctx.fill();
  // cheeks
  ctx.fillStyle = rgba(C.cheek, 0.55);
  circlePath(ctx, -6.5, 3.5, 2.1); ctx.fill(); circlePath(ctx, 6.5, 3.5, 2.1); ctx.fill();
  const ey = -1;
  if (sur < 0.5) {
    // dozy: closed, content eyes + little smile
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.28; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-4, ey - 0.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.moveTo(6.2, ey + 0.3); ctx.arc(4, ey - 0.5, 2.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 5, 2.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else {
    // startled: huge eyes, tiny pupils, brows shot up, "O" mouth
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.18;
    circlePath(ctx, -4.2, ey, 3.7); ctx.fill(); ctx.stroke(); circlePath(ctx, 4.2, ey, 3.7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    circlePath(ctx, -3.5, ey + 0.3, 1.15); ctx.fill(); circlePath(ctx, 4.9, ey + 0.3, 1.15); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.3, 6.4, 2.2, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7a8a'; ctx.beginPath(); ctx.ellipse(0.3, 7.9, 1.2, 1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.24; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-4.4, ey - 4.2, 3, 1.25 * Math.PI, 1.75 * Math.PI); ctx.moveTo(6.5, ey - 6.3); ctx.arc(4.4, ey - 4.2, 3, 1.25 * Math.PI, 1.75 * Math.PI); ctx.stroke();
  }
  // round specs: on the nose when calm; popped up off the head, askew, when startled
  const gy = ey - 11 * sur;
  ctx.save(); ctx.translate(0, gy); ctx.rotate(0.3 * sur);
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.28;
  ctx.beginPath(); ctx.arc(-4.3, 0, 3.9, 0, TAU); ctx.moveTo(8.2, 0); ctx.arc(4.3, 0, 3.9, 0, TAU);
  ctx.moveTo(-0.6, -0.4); ctx.lineTo(0.6, -0.4); ctx.stroke();
  if (sur > 0.5) { ctx.fillStyle = 'rgba(210,235,255,0.55)'; circlePath(ctx, -4.3, 0, 3.5); ctx.fill(); circlePath(ctx, 4.3, 0, 3.5); ctx.fill(); }
  ctx.restore();
  // nose + moustache
  ctx.fillStyle = C.skinShade; circlePath(ctx, 0.8, 2.4, 1.8); ctx.fill();
  ctx.fillStyle = C.hairGrey; ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.22;
  ctx.beginPath(); ctx.ellipse(-1.8, 4 - sur * 0.6, 2.6, 1.3, 0.25, 0, TAU); ctx.moveTo(6.3, 4 - sur * 0.6); ctx.ellipse(3.6, 4 - sur * 0.6, 2.6, 1.3, -0.25, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
  // palms pressed to the glass
  if (sur > 0.01) {
    for (const sg of [-1, 1]) {
      const hx = sg * r * 0.64, hy = r * 0.5 - 2 * pop;
      ctx.save(); ctx.translate(hx, hy); ctx.scale(sur, sur);
      circlePath(ctx, 0, 0, 4.3); ink(ctx, C.skin, lw * 0.28);
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.18;
      ctx.beginPath(); for (let i = -1; i <= 1; i++) { ctx.moveTo(i * 1.7, -1.5); ctx.lineTo(i * 1.7, -4); } ctx.stroke();
      ctx.restore();
    }
  }
}
export function drawAirliner(ctx, x, y, s = 1, o = {}) {
  const { t = 0, face = 0, facing = 1, contrail = 1500, passenger = 2 } = o;
  const eff = effScale(ctx, s);
  const { lw, lwS } = widths(eff);
  const det = eff > 0.22;
  const C = palFor(o.light);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (facing < 0 ? -1 : 1), s);

  // ---- contrails (behind everything): tapered, fading vapour trails from both engines ----
  if (contrail > 0) {
    for (const [ex, ey, w0, a0] of [[-40, 62, 5, 0.55], [-40, 94, 7, 0.85]]) {
      const x0 = ex - 70, x1 = ex - 70 - contrail;
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, rgba(C.white, 0)); g.addColorStop(0.04, rgba(C.white, a0)); g.addColorStop(1, rgba(C.white, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      const N = 10;
      for (let i = 0; i <= N; i++) {
        const u = i / N, xx = lerp(x0, x1, u), w = lerp(w0, w0 * 3.2, u), wv = 3 * Math.sin(u * 9 + t * 1.5) * u;
        i ? ctx.lineTo(xx, ey - w / 2 + wv) : ctx.moveTo(xx, ey - w / 2 + wv);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N, xx = lerp(x0, x1, u), w = lerp(w0, w0 * 3.2, u), wv = 3 * Math.sin(u * 9 + t * 1.5) * u;
        ctx.lineTo(xx, ey + w / 2 + wv);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  // ---- horizontal tail plane (behind the fuselage) ----
  const hstab = () => { ctx.beginPath(); ctx.moveTo(-300, -24); ctx.lineTo(-392, -12); ctx.quadraticCurveTo(-430, -4, -418, 6); ctx.lineTo(-310, 0); ctx.closePath(); };
  part(ctx, hstab, C.jetShade, lwS * 0.85);
  // ---- vertical tail fin ----
  const fin = () => {
    ctx.beginPath();
    ctx.moveTo(-282, -50);
    ctx.bezierCurveTo(-318, -84, -346, -150, -360, -200);
    ctx.quadraticCurveTo(-364, -214, -380, -212);
    ctx.lineTo(-398, -210);
    ctx.quadraticCurveTo(-414, -208, -412, -190);
    ctx.lineTo(-404, -44);
    ctx.closePath();
  };
  part(ctx, fin, C.blue, lwS, {
    shade: C.blueShade, shadeFn: offsetShade(ctx, fin, C.blue, 8, 6),
    fx: () => {
      if (det) { softStarPath(ctx, -372, -128, 20, 11, 5, -Math.PI / 2 + 0.1); ink(ctx, C.yellow, lw * 0.5); }
      ctx.fillStyle = C.hi; ctx.fillRect(-352, -186, 5, 96);
    },
  });
  // ---- fuselage ----
  part(ctx, () => fuselagePath(ctx), C.jet, lwS, {
    fx: () => {
      // belly + cheatline
      ctx.fillStyle = C.jetBelly; ctx.fillRect(-460, 26, 900, 60);
      ctx.fillStyle = C.blue; ctx.fillRect(-460, 12, 900, 11);
      ctx.fillStyle = C.red; ctx.fillRect(-460, 26, 900, 4);
      // shade along the bottom, highlight along the top
      ctx.fillStyle = 'rgba(60,70,120,0.16)'; ctx.fillRect(-460, 36, 900, 40);
      ctx.fillStyle = C.hi; ctx.beginPath(); ctx.moveTo(-280, -44); ctx.lineTo(250, -44); ctx.quadraticCurveTo(300, -44, 330, -36); ctx.lineTo(320, -32); ctx.lineTo(-280, -36); ctx.closePath(); ctx.fill();
      // cockpit windscreen
      ctx.beginPath(); ctx.moveTo(322, -38); ctx.quadraticCurveTo(358, -36, 378, -16); ctx.lineTo(336, -16); ctx.closePath();
      ctx.fillStyle = C.glass; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.5; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.strokeStyle = C.hi75; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(334, -32); ctx.lineTo(346, -20); ctx.stroke();
      if (det) {
        // doors
        ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = lw * 0.35;
        rrectPath(ctx, 278, -40, 26, 62, 9); ctx.stroke();
        rrectPath(ctx, -292, -38, 24, 58, 9); ctx.stroke();
      }
    },
  });
  // ---- windows (batched), the passenger window drawn on its own ----
  const pi = clamp(Math.round(passenger), 0, JET_WIN.n - 1);
  const wx = (i) => JET_WIN.x0 + i * JET_WIN.dx;
  ctx.beginPath();
  for (let i = 0; i < JET_WIN.n; i++) { if (i === pi) continue; ctx.moveTo(wx(i) + JET_WIN.r, JET_WIN.y); ctx.arc(wx(i), JET_WIN.y, JET_WIN.r, 0, TAU); }
  ctx.fillStyle = C.glass; ctx.fill();
  ctx.lineWidth = lw * 0.55; ctx.strokeStyle = INK; ctx.stroke();
  if (det) {
    ctx.beginPath();
    for (let i = 0; i < JET_WIN.n; i++) { if (i === pi) continue; const cx = wx(i); ctx.moveTo(cx - 9.5, JET_WIN.y - 3); ctx.arc(cx, JET_WIN.y, 10, Math.PI * 1.05, Math.PI * 1.45); }
    ctx.strokeStyle = C.hi75; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  }
  {
    const cx = wx(pi), cy = JET_WIN.y, r = JET_WIN.r;
    ctx.save();
    ctx.translate(cx, cy);
    if (facing < 0) ctx.scale(-1, 1); // keep the face the right way round
    circlePath(ctx, 0, 0, r); ctx.save(); ctx.clip();
    passengerFace(ctx, C, face, t, lw, r);
    ctx.fillStyle = 'rgba(190,225,255,0.14)'; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
    circlePath(ctx, 0, 0, r); ink(ctx, null, lw * 0.6);
    ctx.strokeStyle = C.hi75; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r - 3.5, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
    ctx.restore();
  }
  // ---- near wing + engine ----
  const wing = () => {
    ctx.beginPath();
    ctx.moveTo(150, 24); ctx.lineTo(-86, 128); ctx.quadraticCurveTo(-110, 138, -134, 132);
    ctx.lineTo(-146, 128); ctx.lineTo(-40, 40); ctx.closePath();
  };
  part(ctx, wing, C.jetShade, lwS * 0.9, {
    shade: '#b8bfcf', shadeFn: () => { polyPath(ctx, [[-40, 40], [-146, 128], [-150, 150], [-20, 60]]); ctx.fill(); },
    hiFn: () => { polyPath(ctx, [[146, 26], [-80, 126], [-88, 124], [132, 24]]); ctx.fill(); }, hi: C.hi,
  });
  // winglet
  strokeLimb(ctx, [[-138, 130], [-152, 104]], 7, C.blue, lw * 0.7);
  // pylon + engine nacelle
  const pylon = () => polyPath(ctx, [[70, 52], [20, 52], [4, 72], [58, 72]]);
  part(ctx, pylon, C.jetShade, lw * 0.6);
  const nac = () => { ctx.beginPath(); ctx.moveTo(-26, 74); ctx.lineTo(96, 70); ctx.quadraticCurveTo(114, 70, 114, 94); ctx.quadraticCurveTo(114, 118, 96, 118); ctx.lineTo(-26, 112); ctx.quadraticCurveTo(-38, 93, -26, 74); ctx.closePath(); };
  part(ctx, nac, C.jet, lwS * 0.9, {
    shade: C.jetShade, shadeFn: () => ctx.fillRect(-40, 100, 160, 30),
    hiFn: () => ctx.fillRect(-10, 78, 90, 5), hi: C.hi,
    fx: () => { ctx.fillStyle = C.blue; ctx.fillRect(-40, 86, 26, 16); },
  });
  ctx.beginPath(); ctx.ellipse(110, 94, 8, 21, 0, 0, TAU); ink(ctx, C.intake, lw * 0.6);
  if (det) { // spinning fan hint
    ctx.strokeStyle = rgba('#8c8aa0', 0.8); ctx.lineWidth = 2;
    const a = t * 30;
    ctx.beginPath(); ctx.moveTo(110, 94 - 14 * Math.cos(a)); ctx.lineTo(110, 94 + 14 * Math.cos(a)); ctx.stroke();
  }
  // anti-collision beacon (a light: untinted), flashing on the beat
  const on = t > 0 ? pulse(t, 6) : 0;
  if (on > 0.05) halo(ctx, 40, -56, 22, 22, '#ff4a3a', 0.4 * on, 2);
  circlePath(ctx, 40, -55, 5.5); ink(ctx, mixColor('#b52d2d', '#ff7a6a', on), lw * 0.45);
  ctx.restore();
}
