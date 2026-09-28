// Biscuit — Juno's small scruffy terrier pup.
//
//   drawDog(ctx, x, y, s = 1, pose = {})      (x,y) = ground point under the body centre
//   drawDogHead(ctx, x, y, s = 1, pose = {})  (x,y) = head centre (close-ups / portholes)
//   dogAnchors(x, y, s, pose)                 → world positions { head, mouth, tail }
//   DOG_HEIGHT = 210                          px tall at s = 1 (standing, ears included)
//
// Everything is a pure function of the arguments (time comes in through pose.t).
// Local drawing frame faces screen-right; facing = -1 mirrors it. The caramel patch
// always sits on Biscuit's own LEFT eye (= the screen-right eye in any front view),
// so it swaps eyes correctly when he is mirrored.
//
// Look / lighting fields (besides the common STYLE.md pose fields):
//   light: { mul, add, addAmt, k = 1 }  time-of-day tint (pass the backyard's todTint): every colour is
//          multiplied by `mul`, mixed toward `add` by `addAmt`, applied with strength k after soot.
//          Eye whites / highlights / teeth take 0.5·k; INK outlines stay INK.
//   silhouette 0..1   mixes every fill toward #141024 (eye whites, tongue, tag join as it nears 1);
//   rim 0..1          warm upper-left rim light while silhouetted (default 1).
//   soot 0..1         soft smudges that grow with soot + a uniform darkening capped at a readable
//                     dark grey (cream 0.78, caramel 0.7 toward PAL.soot); eye whites stay white.
// Silhouette strokes (unions, limbs, paws, ears, tail, helmet glass) get an outline floor of
// ~4 px on screen in wide shots; interior face lines keep LW.
import { PAL, INK, LW, circlePath, ellipsePath, softStarPath } from '../draw.js';
import { TAU, clamp, lerp, ease, hash01, mixColor, rgba, hexToRgb, rgbToHex } from '../util.js';
import { beatAt, barAt, barTime } from '../timing.js';

export const DOG_HEIGHT = 210;

// ---------------------------------------------------------------- palette
// Every colour Biscuit uses lives here, so soot, the time-of-day `light` tint and the
// s20 `silhouette` mix reach all of it (only INK outlines/pupils stay INK).
const BASE = {
  fur: '#fdf3e1', furShade: '#e3d2b4', furFar: '#eadcc1', car: '#c9782f', carDeep: '#a65d22', earIn: '#f4b39a',
  nose: '#262130', tongue: '#ff7a8a', tongueDark: '#dd5068', mouth: '#6a1d34',
  collar: PAL.red, collarDark: PAL.redDark, gold: PAL.gold, goldDark: '#c98a1c',
  pad: '#f59aa8', brow: '#b86f2e', vest: PAL.red, vestDark: PAL.redDark, vestTrim: PAL.yellow, vestStar: '#fffaf0',
  steel: PAL.steel, strap: '#7a4a2a', lens: '#2f6a5c', shades: '#15121c',
  ring: PAL.orange, ringShade: '#d9662a', ringHole: '#3a2638', glass: '#c4e8ff', glassRim: '#96cdff', glassIn: '#aadcff',
  blush: '#ff8a9a', tear: '#bfe6ff', dazed: PAL.yellow, exclaim: PAL.red,
  blot: '#57525a', blotShade: '#4a4552', blotHalo: '#a9a39f', blotHaloShade: '#908a8a', sootLine: '#5d5668',
  eye: '#ffffff', hi: '#ffffff', teeth: '#ffffff',
  hiA: 0.85,
};
// soot: how far each colour mixes toward PAL.soot at soot = 1 (keys not listed keep their colour:
// eye whites, nose, mouth, tongue, lenses, glass). Cream fur caps at 0.78, caramel at 0.7, so a fully
// blackened Biscuit is still a readable warm/cool dark-grey dog, not a featureless blob.
const SOOT_AMT = {
  fur: 0.78, furFar: 0.8, car: 0.7, earIn: 0.72, brow: 0.6, pad: 0.6, blush: 0.75,
  collar: 0.55, collarDark: 0.55, gold: 0.55, goldDark: 0.55, vest: 0.55, vestDark: 0.55, vestTrim: 0.55, vestStar: 0.55,
  steel: 0.55, strap: 0.5, ring: 0.5, ringShade: 0.5,
};
const BRIGHT = new Set(['eye', 'hi', 'teeth']); // take half the night tint
const SIL_LATE = new Set(['eye', 'hi', 'teeth', 'tongue', 'tongueDark', 'gold', 'goldDark', 'mouth', 'nose']);
const SIL_COL = '#141024';
function mulC(a, m) {
  const A = hexToRgb(a), M = hexToRgb(m);
  return rgbToHex([(A[0] * M[0]) / 255, (A[1] * M[1]) / 255, (A[2] * M[2]) / 255]);
}
function palette(P) {
  const soot = P.soot, L = P.light, sil = P.silhouette;
  if (soot <= 0 && !L && sil <= 0) return BASE;
  const p = { ...BASE };
  if (soot > 0) {
    // uniform darkening grows slower than soot; the rest is carried by blotches (see sootBlots)
    const kU = Math.pow(soot, 1.5);
    for (const key in SOOT_AMT) p[key] = mixColor(BASE[key], PAL.soot, SOOT_AMT[key] * kU);
    // shade crescents: the sooty base mixed 20% toward INK
    p.furShade = mixColor(BASE.furShade, mixColor(p.fur, INK, 0.2), kU);
    p.carDeep = mixColor(BASE.carDeep, mixColor(p.car, INK, 0.2), kU);
    p.furFar = mixColor(BASE.furFar, mixColor(p.fur, INK, 0.1), kU);
    // smudges: light grey-brown dust at low soot, darkening to #4a4458 smears on the dark coat
    const dark = mixColor(BASE.fur, PAL.soot, 0.8);
    p.blot = soot < 0.75 ? mixColor(p.fur, dark, 0.45 + 0.55 * soot / 0.75) : mixColor(dark, '#4a4458', (soot - 0.75) / 0.25);
    p.blotHalo = mixColor(p.fur, p.blot, 0.5);
    p.blotShade = mixColor(p.blot, INK, 0.2);
    p.blotHaloShade = mixColor(p.blotHalo, INK, 0.2);
    p.hiA = lerp(0.85, 0.3, kU);
    // edge line for soot: #5d5668 lifted a touch so it separates from the capped fur
    p.sootLine = mixColor(p.fur, '#8d86a0', 0.85);
  }
  if (L) {
    for (const key in p) {
      if (key === 'hiA') continue;
      const k = BRIGHT.has(key) ? L.k * 0.5 : L.k;
      let x = L.mul ? mulC(p[key], L.mul) : p[key];
      if (L.addAmt) x = mixColor(x, L.add, L.addAmt);
      p[key] = k >= 1 ? x : mixColor(p[key], x, k);
    }
  }
  if (sil > 0) {
    const late = sil * sil * sil;
    for (const key in p) if (key !== 'hiA') p[key] = mixColor(p[key], SIL_COL, SIL_LATE.has(key) ? late : sil);
    p.hiA *= 1 - sil;
  }
  return p;
}
// pose.light = { mul, add, addAmt, k } (backyard todTint); null when absent / no-op
function normLight(l) {
  if (!l || typeof l !== 'object') return null;
  const hex = (c) => (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : null);
  const mul = hex(l.mul), add = hex(l.add) || '#ffffff', addAmt = clamp(Number(l.addAmt) || 0);
  const k = clamp(l.k ?? 1);
  if (k <= 0 || (!mul && addAmt <= 0)) return null;
  return { mul, add, addAmt, k };
}

// ---------------------------------------------------------------- expressions
// ears: 0 floppy .. 1 perked (negative = droopy/flattened). lid: upper-lid close 0..1,
// lidTilt: + = angry (inner corner lower), - = sad. lower: cheek-squint lower lid.
// smile: -1 frown .. 1 big smile. browY: brow raise. browA: + angry, - worried.
const EXPR = {
  neutral: { ears: 0.12, eyeS: 1, pupil: 1, lid: 0, lidTilt: 0, lower: 0, browY: 0, browA: 0, mouth: 0, smile: 0.55, tongue: 0, look: [0.25, 0] },
  happy: { ears: 0.2, lower: 0.28, browY: 0.35, mouth: 0.42, smile: 1, tongue: 1, blush: 0.35, pant: 1 },
  grin: { ears: 0.25, lower: 0.3, browY: 0.3, mouth: 0, smile: 1, blush: 0.3 },
  laugh: { ears: 0.3, closed: 'up', browY: 0.6, mouth: 0.8, smile: 1, tongue: 0.4, blush: 0.4 },
  excited: { ears: 0.95, eyeS: 1.14, pupil: 1.22, sparkle: true, browY: 0.9, mouth: 0.6, smile: 1, tongue: 0.75, blush: 0.5, pant: 1 },
  awe: { ears: 0.55, eyeS: 1.14, pupil: 1.25, sparkle: true, browY: 0.9, mouth: 0.3, shape: 'o', smile: 0.3 },
  alert: { ears: 1.08, eyeS: 1.12, pupil: 0.62, browY: 1, mouth: 0, smile: 0.1 },
  surprised: { ears: 0.75, eyeS: 1.18, pupil: 0.58, browY: 1.2, mouth: 0.65, shape: 'o', smile: 0 },
  sad: { ears: -0.45, pupil: 1.18, lidTilt: -0.55, lid: 0.18, browY: 0.2, browA: -1, mouth: 0, smile: -0.8, look: [0.1, 0.55], tear: true },
  dazed: { ears: 0.05, spiral: true, stars: true, mouth: 0.3, smile: 0.2, tongue: 0.75, lollTongue: true, browY: 0.3, browA: -0.4 },
  sleepy: { ears: -0.1, closed: 'down', browY: -0.1, mouth: 0, smile: 0.35 },
  annoyed: { ears: 0.05, lid: 0.5, lidTilt: 0.12, browY: -0.35, browA: 0.45, mouth: 0, smile: -0.35, look: [-0.7, 0] },
  determined: { ears: 0.62, lid: 0.26, lidTilt: 0.55, browY: -0.25, browA: 1, mouth: 0, smile: 0.35, firm: true, look: [0.5, 0] },
  wince: { ears: -0.2, closed: 'squeeze', browA: -0.7, mouth: 0.25, smile: -0.4, teeth: true },
  gforce: { ears: 0, gforce: 1, lid: 0.42, lower: 0.35, pupil: 0.7, browA: -0.4, browY: 0.5, mouth: 0.5, teeth: true, tongue: 1 },
};

const STANCES = new Set(['stand', 'sit', 'walk', 'run', 'float', 'jump', 'lie', 'beg']);

// ---------------------------------------------------------------- tiny helpers
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const normA = (a) => ((a % TAU) + TAU) % TAU;
const angDist = (a, b) => { const d = Math.abs(normA(a) - normA(b)); return Math.min(d, TAU - d); };
const fr = (x) => x - Math.floor(x);
const rot2 = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

// Blink: at most one quick blink per bar, landing on a (hashed) beat.
function autoBlink(t) {
  const k0 = Math.floor(barAt(t));
  for (let k = k0 - 1; k <= k0; k++) {
    if (hash01(k, 71) > 0.8) continue;
    const bt = barTime(k, Math.floor(hash01(k, 72) * 4));
    const d = t - bt;
    if (d >= 0 && d < 0.2) return d < 0.07 ? d / 0.07 : 1 - (d - 0.07) / 0.13;
    if (hash01(k, 74) < 0.3) { // occasional double blink
      const d2 = d - 0.26;
      if (d2 >= 0 && d2 < 0.18) return d2 < 0.06 ? d2 / 0.06 : 1 - (d2 - 0.06) / 0.12;
    }
  }
  return 0;
}

// ---------------------------------------------------------------- pose
function resolvePose(pose = {}) {
  const hasT = Number.isFinite(pose.t);
  const t = hasT ? pose.t : 0;
  const beat = hasT ? beatAt(t) : 0;
  const stance = STANCES.has(pose.stance) ? pose.stance : 'stand';
  const view = pose.view === 'back' ? 'back' : 'front';
  const exprName = pose.expr && EXPR[pose.expr] ? pose.expr : stance === 'lie' ? 'sleepy' : 'neutral';
  const E = { ...EXPR.neutral, ...EXPR[exprName] };
  const hairFloat = clamp(pose.hairFloat ?? (stance === 'float' ? 1 : 0));
  const pawsUp = clamp(pose.pawsUp ?? 0);
  let ears = pose.ears ?? E.ears;
  ears = lerp(ears, -0.12, pawsUp);
  const bob = hasT ? (pose.bob ?? 1) : 0;
  const P = {
    t, hasT, beat, stance, view, exprName, E,
    facing: pose.facing < 0 ? -1 : 1,
    lx: pose.facing < 0 ? -1 : 1, // light stays upper-left on screen when mirrored
    turn: view === 'back' ? 0 : clamp(pose.turn ?? 1),
    phase: pose.phase ?? (stance === 'run' ? beat : stance === 'float' ? beat * 0.5 : beat * 0.5),
    ears,
    earBob: bob * 0.07 * Math.sin(TAU * (beat - 0.12)),
    mouth: clamp(pose.mouth ?? E.mouth),
    tongue: clamp(pose.tongue ?? E.tongue ?? 0),
    blink: clamp(pose.blink ?? (hasT && !E.closed ? autoBlink(t) : 0)),
    look: pose.look || E.look || [0.25, 0],
    tailOverride: Number.isFinite(pose.tail) ? pose.tail : null,
    wag: clamp(pose.wag ?? 0.6, 0, 1.5),
    wagRate: pose.wagRate ?? 2,
    soot: clamp(pose.soot ?? 0),
    frizz: clamp(pose.frizz ?? 0),
    helmet: clamp(pose.helmet ?? 0),
    suit: pose.suit === 'space' ? 'space' : 'none',
    goggles: pose.goggles === 'eyes' || pose.goggles === 'forehead' ? pose.goggles : 'none',
    sunglasses: !!pose.sunglasses,
    pawsUp,
    pawWave: clamp(pose.pawWave ?? 0),
    holdMouth: typeof pose.holdMouth === 'function' ? pose.holdMouth : null,
    hat: typeof pose.hat === 'function' ? pose.hat : null,
    tilt: pose.tilt || 0,
    pivot: pose.pivot === 'center' ? 'center' : 'ground',
    headTilt: pose.headTilt || 0,
    squash: pose.squash > 0 ? pose.squash : 1,
    hairFloat,
    blush: clamp(pose.blush ?? E.blush ?? 0),
    exclaim: clamp(pose.exclaim ?? 0),
    gforce: clamp(pose.gforce ?? E.gforce ?? 0),
    bob,
    small: 0,
    collar: pose.collar !== false,
    neck: pose.neck,
    light: normLight(pose.light),
    silhouette: clamp(pose.silhouette ?? 0),
    // outline floor (set per draw from the current transform): silhouette strokes use lwO
    lwO: LW, lwX: 0,
  };
  // s20 rim light on the upper-left edges (default on with the silhouette)
  P.rimA = 0.5 * P.silhouette * clamp(pose.rim ?? 1);
  // tail wag (tempo locked: wagRate cycles per beat)
  const wagOsc = hasT ? Math.sin(TAU * P.wagRate * beat) : 0;
  P.wagOsc = wagOsc;
  // breathing, 1 breath per 2 beats (slower when asleep)
  P.breath = hasT ? Math.sin((TAU * beat) / (stance === 'lie' ? 4 : 2)) : 0;
  P.hop = hasT ? Math.abs(Math.sin(Math.PI * beat)) : 1;
  return P;
}

// ---------------------------------------------------------------- path builders
// Ellipse outline with pointy fur tufts. tufts: [{a, w, h, lean, k}] sorted by a.
function fuzzyEllipse(ctx, cx, cy, rx, ry, rot, tufts) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const E = (a) => { const px = rx * Math.cos(a), py = ry * Math.sin(a); return [cx + px * cr - py * sr, cy + px * sr + py * cr]; };
  const N = (a) => {
    let nx = Math.cos(a) / rx, ny = Math.sin(a) / ry; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    return [nx * cr - ny * sr, nx * sr + ny * cr];
  };
  if (!tufts || !tufts.length) {
    const p = E(0); ctx.moveTo(p[0], p[1]); ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.closePath(); return;
  }
  const start = tufts[0].a - tufts[0].w;
  const p0 = E(start); ctx.moveTo(p0[0], p0[1]);
  let cur = start;
  for (const tf of tufts) {
    const a0 = tf.a - tf.w, a1 = tf.a + tf.w;
    if (a0 > cur + 1e-4) ctx.ellipse(cx, cy, rx, ry, rot, cur, a0);
    const b0 = E(a0), b1 = E(a1), bc = E(tf.a);
    const n = N(tf.a + tf.lean * tf.w);
    const tb = E(tf.a + tf.lean * tf.w * 1.2);
    const tip = [tb[0] + n[0] * tf.h, tb[1] + n[1] * tf.h];
    const k = tf.k ?? 0.35;
    const m0 = mid(b0, tip), m1 = mid(tip, b1);
    ctx.quadraticCurveTo(lerp(m0[0], bc[0], k), lerp(m0[1], bc[1], k), tip[0], tip[1]);
    ctx.quadraticCurveTo(lerp(m1[0], bc[0], k), lerp(m1[1], bc[1], k), b1[0], b1[1]);
    cur = a1;
  }
  if (cur < start + TAU - 1e-4) ctx.ellipse(cx, cy, rx, ry, rot, cur, start + TAU);
  ctx.closePath();
}

// Build a tuft list: base = [[a, w, h, lean, k]], plus frizz spikes all round.
function tufts(base, frizz, seed, n, hScale = 1) {
  const out = base.map(([a, w, h, lean = 0, k = 0.35]) => ({ a: normA(a), w, h: h * (1 + frizz * 0.9), lean, k }));
  if (frizz > 0.02) {
    for (let i = 0; i < n; i++) {
      const a = normA(((i + 0.35 * (hash01(i, seed) - 0.5)) / n) * TAU);
      const w = (TAU / n) * 0.4;
      if (out.some((q) => angDist(q.a, a) < q.w + w + 0.01)) continue;
      out.push({ a, w, h: frizz * (8 + 9 * hash01(i, seed + 1)) * hScale, lean: (hash01(i, seed + 2) - 0.5) * 0.9, k: 0.45 });
    }
  }
  out.sort((p, q) => p.a - q.a);
  const res = [];
  for (const q of out) {
    const prev = res[res.length - 1];
    if (prev && q.a - q.w < prev.a + prev.w) continue;
    res.push(q);
  }
  while (res.length > 1 && res[res.length - 1].a + res[res.length - 1].w > res[0].a - res[0].w + TAU) res.pop();
  return res;
}

// Shapes: { e: [cx, cy, rx, ry, rot], tufts } (fuzzy ellipse).
function shapePath(ctx, sh) {
  const [cx, cy, rx, ry, rot = 0] = sh.e;
  fuzzyEllipse(ctx, cx, cy, rx, ry, rot, sh.tufts);
}
// Union of shapes with one clean outline (outline sits outside the nominal edge).
function unionFill(ctx, shapes, fill, lw = LW) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (lw > 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 2;
    for (const sh of shapes) { ctx.beginPath(); shapePath(ctx, sh); ctx.stroke(); }
  }
  ctx.fillStyle = fill;
  for (const sh of shapes) { ctx.beginPath(); shapePath(ctx, sh); ctx.fill(); }
}
function clipShapes(ctx, shapes) {
  ctx.beginPath();
  for (const sh of shapes) shapePath(ctx, sh);
  ctx.clip();
}
// ONE shade shape, clip-free: fill the union in the shade colour, then refill a copy that is
// shifted toward the light (upper-left on screen) AND shrunk by the same amount, so it always
// stays inside the outline → leaves a crescent of shade on the lower-right. Markings (patch,
// soot blotches) are drawn twice: shade tone clipped to the union, lit tone clipped to the lit copy.
const SH_S = 4.4, SH_D = 6.3;
function litShape(sh, lx, k = 1) {
  const [cx, cy, rx, ry, rot = 0] = sh.e;
  const d = SH_D * k;
  return {
    e: [cx - SH_S * k * lx, cy - SH_S * k, Math.max(1, rx - d), Math.max(1, ry - d), rot],
    tufts: sh.tufts && sh.tufts.map((t) => ({ ...t, w: t.w * 0.8, h: Math.max(0, t.h * 0.5 - d * 0.3) })),
  };
}
// o: { mark(ctx, dark), k (shade size), lw (outline), blots: [[x, y, r]...], pal }
function shadedUnion(ctx, shapes, base, shade, lx, o = {}) {
  const { mark = null, k = 1, lw = LW, blots = null, pal = null } = o;
  unionFill(ctx, shapes, shade, lw);
  const lit = shapes.map((sh) => litShape(sh, lx, k));
  ctx.fillStyle = base;
  for (const sh of lit) { ctx.beginPath(); shapePath(ctx, sh); ctx.fill(); }
  const hasBlots = blots && pal;
  if (mark || hasBlots) {
    for (const dark of [true, false]) {
      ctx.save(); clipShapes(ctx, dark ? shapes : lit);
      if (mark) mark(ctx, dark);
      if (hasBlots) {
        for (const [list, col] of [[blots.halo, dark ? pal.blotHaloShade : pal.blotHalo], [blots.core, dark ? pal.blotShade : pal.blot]]) {
          ctx.beginPath();
          for (const [x, y, r] of list) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
          ctx.fillStyle = col; ctx.fill();
        }
      }
      ctx.restore();
    }
  }
}
// Soot blotches for one ellipse shape: irregular clusters whose coverage grows with soot.
// Each smudge is a short smear (a few circles strung along a random direction); returned as
// { halo, core } circle lists: a wider half-tone halo under a darker core reads as a soft smudge.
function sootBlots(P, e, n, seed) {
  const s = P.soot;
  if (s <= 0.02) return null;
  const [cx, cy, rx, ry, rot = 0] = e;
  const halo = [], core = [];
  const m = Math.min(rx, ry);
  for (let i = 0; i < n; i++) {
    const a = hash01(i, seed) * TAU, d = 0.2 + 0.55 * Math.sqrt(hash01(i, seed + 1));
    const [ox, oy] = rot2(Math.cos(a) * rx * d, Math.sin(a) * ry * d, rot);
    const r = m * (0.1 + 0.2 * s) * (0.75 + 0.5 * hash01(i, seed + 2));
    const dir = hash01(i, seed + 5) * Math.PI, len = r * (1.1 + 0.9 * s);
    const dx = Math.cos(dir), dy = Math.sin(dir);
    for (let j = 0; j < 4; j++) {
      const u = j / 3 - 0.5, w = 1 - 0.55 * Math.abs(u) * 2;
      const jx = (hash01(i * 4 + j, seed + 3) - 0.5) * r * 0.5, jy = (hash01(i * 4 + j, seed + 4) - 0.5) * r * 0.5;
      const x = cx + ox + dx * len * u + jx, y = cy + oy + dy * len * u + jy;
      halo.push([x, y, r * w * 1.0 + 3]);
      core.push([x, y, r * w * 0.62]);
    }
  }
  return { halo, core };
}
function highlight(ctx, x, y, rx, ry, rot, a, col = '#ffffff') {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = col;
  ellipsePath(ctx, x, y, rx, ry, rot); ctx.fill();
  ctx.restore();
}
function strokeInk(ctx, lw, color = INK) {
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
// Outline floor for centred strokes: an extra ink ring OUTSIDE the edge (drawn before the fill),
// so small figures get a heavier silhouette without the ink eating into the fill.
function underInk(ctx, P) {
  if (P.lwX > 0.3) strokeInk(ctx, LW + 2 * P.lwX);
}
// s20 rim light: a thin warm arc just inside the upper-left edge of an ellipse (screen space light).
// Also used for soot: a cool light-grey edge line (P.sootRim) so a blackened Biscuit's
// overlapping forms (haunch over body, head over chest) still separate.
function rimArc(ctx, P, e, inset = 4.5, span = 0.85) {
  if (P.rimA <= 0.01 && !P.sootRim) return;
  const [cx, cy, rx, ry, rot = 0] = e;
  let a = -2.25; // upper-left on screen
  if (P.lx < 0) a = Math.PI - a; // local frame is mirrored
  a -= rot;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, rx - inset), Math.max(1, ry - inset), rot, a - span, a + span);
  ctx.lineCap = 'round';
  if (P.sootRim) { ctx.lineWidth = 3; ctx.strokeStyle = P.sootRim; ctx.stroke(); }
  if (P.rimA > 0.01) { ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(255,240,200,${P.rimA})`; ctx.stroke(); }
  ctx.restore();
}

// Smooth closed curve using points as quadratic control points (rounded corners).
function smoothClosed(ctx, pts) {
  const n = pts.length;
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % n]);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

// Ribbon along a spine with a width profile → closed outline points (rounded tip & base).
function ribbonPts(spine, widths, jag = 0, seed = 1) {
  const n = spine.length;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const j = jag > 0 && i > 0 && i < n - 1 ? jag * (i % 2 ? 1 : -0.3) * (0.7 + 0.6 * hash01(i, seed)) : 0;
    const w = widths[i] + j;
    L.push([spine[i][0] - dy * w, spine[i][1] + dx * w]);
    R.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
  }
  // tip cap
  const e = spine[n - 1], e2 = spine[n - 2];
  let tx = e[0] - e2[0], ty = e[1] - e2[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const wt = Math.max(widths[n - 1], 0.5);
  const tip = [e[0] + tx * wt * 0.9, e[1] + ty * wt * 0.9];
  const s0 = spine[0], s1 = spine[1];
  let bx = s0[0] - s1[0], by = s0[1] - s1[1]; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
  const base = [s0[0] + bx * widths[0] * 0.6, s0[1] + by * widths[0] * 0.6];
  return [...L, tip, ...R.reverse(), base];
}
function spineFrom(x, y, ang, len, curl, n = 10, wave = 0, wavePh = 0) {
  // ang: direction (radians, canvas convention). curl: total bend along the length.
  const pts = [[x, y]];
  let a = ang, px = x, py = y;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    a = ang + curl * u * u + wave * Math.sin(u * 5 + wavePh) * u;
    px += (Math.cos(a) * len) / n; py += (Math.sin(a) * len) / n;
    pts.push([px, py]);
  }
  return pts;
}

// ---------------------------------------------------------------- limbs & paws
function pawPath(ctx, o) {
  if (o.pad > 0.5) circlePath(ctx, 0, 0, 13 * (o.size || 1));
  else ellipsePath(ctx, 3, 0, 14.5 * (o.size || 1) * (o.long || 1), 9.5 * (o.size || 1));
}
// under = false skips the outline-floor ring (drawLeg draws it before the leg fill instead)
function drawPaw(ctx, x, y, ang, o, pal, P, under = true) {
  const col = o.far ? pal.furFar : pal.fur;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  if (under && P.lwX > 0.3) { pawPath(ctx, o); underInk(ctx, P); }
  if (o.pad > 0.5) {
    // sole toward camera: round paw with pink beans
    const r = 13 * (o.size || 1);
    pawPath(ctx, o); ctx.fillStyle = col; ctx.fill(); strokeInk(ctx, LW);
    ctx.fillStyle = pal.pad;
    ellipsePath(ctx, 0, r * 0.28, r * 0.46, r * 0.36); ctx.fill();
    for (let i = -1; i <= 1; i++) { circlePath(ctx, i * r * 0.44, -r * 0.34 - (i === 0 ? r * 0.14 : 0), r * 0.19); ctx.fill(); }
  } else {
    const rx = 14.5 * (o.size || 1) * (o.long || 1), ry = 9.5 * (o.size || 1);
    pawPath(ctx, o); ctx.fillStyle = col; ctx.fill(); strokeInk(ctx, LW);
    // toe notches
    ctx.beginPath();
    ctx.moveTo(3 + rx * 0.25, ry * 0.95); ctx.lineTo(3 + rx * 0.22, ry * 0.3);
    ctx.moveTo(3 + rx * 0.62, ry * 0.8); ctx.lineTo(3 + rx * 0.56, ry * 0.25);
    strokeInk(ctx, 3.2);
  }
  ctx.restore();
}
// leg: { hip, foot, bend, w, far, pad, pawAng, layer, size, long, noPaw }
function drawLeg(ctx, L, pal, P) {
  const col = L.far ? pal.furFar : pal.fur;
  const [hx, hy] = L.hip, [fx, fy] = L.foot;
  const dx = fx - hx, dy = fy - hy, len = Math.hypot(dx, dy) || 1;
  let kx = (hx + fx) / 2 + (-dy / len) * (L.bend || 0), ky = (hy + fy) / 2 + (dx / len) * (L.bend || 0);
  if (L.knee) { kx = L.knee[0]; ky = L.knee[1]; }
  const w = L.w || 21;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(kx, ky, fx, fy);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + P.lwO * 2; ctx.stroke();
  if (!L.pawFront && P.lwX > 0.3) { // paw's outer ink ring goes under the leg fill so leg + paw read as one silhouette
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(L.pawAng || 0); pawPath(ctx, L); underInk(ctx, P); ctx.restore();
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(kx, ky, fx, fy);
  }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  if (!L.far) { // shade stripe along the side away from the light (stays inside the limb)
    const lx = L.lx || 1;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = lerp(0.12, 0.9, i / 8), it = 1 - t;
      const px = it * it * hx + 2 * it * t * kx + t * t * fx, py = it * it * hy + 2 * it * t * ky + t * t * fy;
      let tx = 2 * it * (kx - hx) + 2 * t * (fx - kx), ty = 2 * it * (ky - hy) + 2 * t * (fy - ky);
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      let nx = -ty, ny = tx;
      if (nx * lx + ny < 0) { nx = -nx; ny = -ny; }
      const ox = px + nx * w * 0.3, oy = py + ny * w * 0.3;
      i ? ctx.lineTo(ox, oy) : ctx.moveTo(ox, oy);
    }
    ctx.lineCap = 'butt'; ctx.strokeStyle = pal.furShade; ctx.lineWidth = w * 0.36; ctx.stroke(); ctx.lineCap = 'round';
  }
  if (!L.pawFront) drawPaw(ctx, fx, fy, L.pawAng || 0, L, pal, P, false);
}

// ---------------------------------------------------------------- tail
function drawTail(ctx, T, P, pal) {
  if (!T) return;
  const spine = T.pts || spineFrom(T.base[0], T.base[1], T.ang, T.len, T.curl, 10, T.wave || 0, T.wavePh || 0);
  const n = spine.length;
  const fz = P.frizz;
  const w0 = T.w || 9;
  const widths = spine.map((_, i) => { const u = i / (n - 1); return w0 * (1 - 0.3 * u) * (1 + fz * 0.9) + (u > 0.75 ? w0 * 0.12 : 0); });
  const pts = ribbonPts(spine, widths, fz * 7, 5);
  const sx = -2.6 * P.lx, sy = -2.6, sd = 3.4;
  const litSpine = spine.map(([x, y]) => [x + sx, y + sy]);
  const litW = widths.map((w) => Math.max(0.5, w - sd));
  ctx.beginPath(); smoothClosed(ctx, pts);
  underInk(ctx, P);
  ctx.fillStyle = pal.furShade; ctx.fill();
  ctx.beginPath(); smoothClosed(ctx, ribbonPts(litSpine, litW, fz * 4, 5)); ctx.fillStyle = pal.fur; ctx.fill();
  // caramel tip: the last ~38% of the tail, with a tufty zig-zag boundary
  const iCut = Math.floor((n - 1) * 0.62);
  const tip = (sp, ws) => {
    const q = ribbonPts(sp.slice(iCut), ws.slice(iCut), fz * 7, 5);
    q.pop(); // drop the rounded base cap, replace it with zig-zag fur
    const m = sp.length - iCut; // points per side
    const Lp = q[0], Rp = q[q.length - 1];
    const c = sp[iCut], c2 = sp[iCut + 1];
    let dx = c2[0] - c[0], dy = c2[1] - c[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    for (let j = 1; j < 4; j++) {
      const u = j / 4, back = j % 2 ? -5 : 1;
      q.push([lerp(Rp[0], Lp[0], u) - dx * back, lerp(Rp[1], Lp[1], u) - dy * back]);
    }
    return q.length > m ? q : q;
  };
  ctx.beginPath(); smoothClosed(ctx, tip(spine, widths)); ctx.fillStyle = pal.carDeep; ctx.fill();
  ctx.beginPath(); smoothClosed(ctx, tip(litSpine, litW)); ctx.fillStyle = pal.car; ctx.fill();
  ctx.beginPath(); smoothClosed(ctx, pts); strokeInk(ctx, LW);
}

// ---------------------------------------------------------------- ears
// side: -1 = screen-left ear (near in 3/4), +1 = screen-right ear.
function earShape(ax, ay, ang, len, side, perk, fz, bend, fold, seed, bound = null, thin = 1) {
  const n = 10;
  const spine = [[ax, ay]];
  let px = ax, py = ay;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    // gentle curl along the length + a fold that only bends the tip (perked terrier ears)
    const f = u < 0.5 ? 0 : (u - 0.5) / 0.5;
    const a = ang + bend * u * u + fold * f * f * (3 - 2 * f);
    px += (-Math.sin(a) * len) / n; py += (Math.cos(a) * len) / n;
    spine.push([px, py]);
  }
  const pk = clamp(perk);
  const wb = 8.5 + pk * 1.5, wm = 17.5 - pk * 1.5;
  const widths = spine.map((_, i) => {
    const u = i / n;
    if (u <= 0.6) return lerp(wb, wm, Math.sin((u / 0.6) * Math.PI * 0.5));
    const v = (u - 0.6) / 0.4;
    const round = Math.sqrt(Math.max(0, 1 - v * v)), pointy = 1 - v;
    return Math.max(1.5, wm * lerp(round, pointy, 0.3 * pk));
  }).map((w) => w * thin);
  if (bound) { // inside a helmet: the ear slides along the glass instead of poking through
    // Re-walk the spine keeping every segment's length: a segment that would leave the glass
    // is wrapped around the circle instead (projecting points would bunch them into a blob).
    const [bx, by, br] = bound;
    const seg = [];
    for (let i = 1; i <= n; i++) seg.push([spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]]);
    // wrap direction: decided once from the ear's overall heading (a per-segment choice flips
    // sign on near-radial segments and zig-zags the ribbon)
    const tipX = spine[n][0] - spine[0][0], tipY = spine[n][1] - spine[0][1];
    const wrapDir = Math.sign((spine[0][0] - bx) * tipY - (spine[0][1] - by) * tipX) || -side;
    for (let i = 1; i <= n; i++) {
      const prev = spine[i - 1];
      let px = prev[0] + seg[i - 1][0], py = prev[1] + seg[i - 1][1];
      const lim = Math.max(8, br - widths[i] - LW);
      const d = Math.hypot(px - bx, py - by);
      if (d > lim) {
        const rx = prev[0] - bx, ry = prev[1] - by;
        const r0 = Math.max(1, Math.hypot(rx, ry));
        const r1 = Math.min(r0, lim);
        const sl = Math.hypot(seg[i - 1][0], seg[i - 1][1]);
        const th = Math.atan2(ry, rx) + wrapDir * (sl / Math.max(r1, 8));
        px = bx + Math.cos(th) * r1; py = by + Math.sin(th) * r1;
      }
      spine[i] = [px, py];
    }
  }
  return { pts: ribbonPts(spine, widths, fz * 6, seed), spine, widths };
}
function drawEar(ctx, ear, pal, perk, P, lw = LW) {
  const lx = P.lx;
  ctx.beginPath(); smoothClosed(ctx, ear.pts);
  underInk(ctx, P);
  ctx.fillStyle = pal.carDeep; ctx.fill();
  // lit part: shifted toward the light and narrowed so it stays inside the outline
  const sp = ear.spine.map(([x, y]) => [x - 3.4 * lx, y - 3.4]);
  const lw2 = ear.widths.map((w) => Math.max(0.5, w - 4.8));
  ctx.beginPath(); smoothClosed(ctx, ribbonPts(sp, lw2)); ctx.fillStyle = pal.car; ctx.fill();
  // inner ear shows when perked (only on the part that is not folded over)
  const inner = clamp((perk - 0.35) / 0.45);
  if (inner > 0) {
    const cut = Math.max(3, Math.round(ear.spine.length * (1 - 0.45 * perk)) - 1);
    const isp = ear.spine.slice(1, cut);
    const w = ear.widths.slice(1, cut).map((v) => v * 0.52);
    ctx.save();
    ctx.globalAlpha *= inner;
    ctx.beginPath(); smoothClosed(ctx, ribbonPts(isp, w)); ctx.fillStyle = pal.earIn; ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); smoothClosed(ctx, ear.pts); strokeInk(ctx, lw);
}

// ---------------------------------------------------------------- head geometry
function headGeo(P) {
  const u = P.turn;
  const T = 0.5 * u;
  const g = { u, rx: 50, ry: 45 };
  const eX = (yaw) => Math.sin(yaw + T) * 40 - 5 * u;
  const E = P.E;
  const eyeS = E.eyeS || 1;
  const mk = (yaw, side) => {
    const f = Math.cos(yaw + T);
    return { x: eX(yaw), y: -6, rx: 13.5 * (0.52 + 0.48 * f) * eyeS, ry: 16.5 * eyeS, side, f };
  };
  g.eyes = [mk(-0.56, -1), mk(0.56, 1)];
  g.mx = lerp(0, 30, u); g.my = 23; g.mrx = lerp(22, 26, u); g.mry = 16;
  g.nx = lerp(0, 47, u); g.ny = 12; g.nw = lerp(12, 11, u); g.nh = 8.5;
  // mouth anchor (under the nose)
  g.px = g.nx - lerp(0, 3, u); g.py = g.ny + g.nh + 6;
  g.Lx = g.px - lerp(15, 21, u); g.Rx = g.px + lerp(15, 7, u);
  g.patchEye = P.facing > 0 ? 1 : 0; // Biscuit's own LEFT eye is always screen-right
  g.lx = P.lx;
  return g;
}

function mouthOpenAmt(P) {
  let m = P.mouth;
  if (P.tongue > 0.05) m = Math.max(m, 0.28 * P.tongue);
  if (P.E.pant && P.hasT) m = clamp(m + 0.08 * P.hop - 0.04);
  if (P.holdMouth) m = Math.min(m, 0.12);
  return m;
}

function headShapes(P, g) {
  const fz = P.frizz, gf = P.gforce;
  const u = g.u;
  // crown tufts sit a little toward the back of the head; cheek tufts on the jowls
  const base = [
    // cowlick: three tufts swept toward the back of the head
    [-1.92 + u * 0.1, 0.13, 10, -0.75, 0.12], [-1.64 + u * 0.1, 0.15, 16, -0.85, 0.12], [-1.37 + u * 0.1, 0.12, 9, -0.7, 0.12],
    [2.45, 0.17, 12 + gf * 18 * (1 - 0.9 * P.helmet), 0.55 + gf * 0.5], [2.8, 0.15, 10 + gf * 22 * (1 - 0.95 * P.helmet), 0.4 + gf * 0.5],
  ];
  if (u < 0.5) base.push([0.69, 0.17, 12, -0.55], [0.34, 0.15, 10, -0.4]);
  else base.push([0.62, 0.12, 7, -0.3]);
  if (gf > 0) base.push([3.2, 0.16, gf * 24 * (1 - 0.95 * P.helmet), 0.4]);
  const shapes = [{ e: [0, 0, g.rx, g.ry, 0], tufts: tufts(base, fz, 13, 16) }];
  shapes.push({ e: [g.mx, g.my, g.mrx, g.mry, 0], tufts: [] });
  const m = mouthOpenAmt(P);
  if (m > 0.04 && P.E.shape !== 'o') {
    const oh = 6 + 22 * m;
    shapes.push({ e: [g.px - 2, g.py + oh - 1, lerp(12, 17, m), 9, 0], tufts: [] });
  }
  return shapes;
}

// ---------------------------------------------------------------- face parts
function drawEye(ctx, e, P, g, pal, isPatch, idx) {
  const E = P.E;
  const { x, y, rx, ry } = e;
  const inner = idx === 0 ? 1 : -1; // direction toward the nose/centre
  const lidCol = isPatch ? pal.car : pal.fur;
  const closedMode = E.closed || (P.blink >= 0.97 ? 'blink' : null);
  if (closedMode) {
    ctx.beginPath();
    if (closedMode === 'up') { // happy ^ ^
      ctx.moveTo(x - rx, y + 3); ctx.quadraticCurveTo(x, y - ry * 0.9, x + rx, y + 3);
    } else if (closedMode === 'squeeze') { // > <
      ctx.moveTo(x - rx * inner, y - ry * 0.55); ctx.lineTo(x + rx * 0.7 * inner, y); ctx.lineTo(x - rx * inner, y + ry * 0.55);
    } else { // content closed ‿
      ctx.moveTo(x - rx, y + 1); ctx.quadraticCurveTo(x, y + ry * 0.75, x + rx, y + 1);
    }
    strokeInk(ctx, 4.5);
    return;
  }
  ellipsePath(ctx, x, y, rx, ry);
  ctx.fillStyle = pal.eye; ctx.fill();
  ctx.save();
  ctx.clip();
  const [lx, ly] = P.look;
  const px = x + clamp(lx, -1, 1) * rx * 0.34 + g.u * 1.2, py = y + clamp(ly, -1, 1) * ry * 0.3 + 1;
  if (E.spiral) {
    ctx.beginPath();
    const turns = 2.6, rot = TAU * P.beat * 0.5 * (idx ? 1 : -1);
    for (let i = 0; i <= 40; i++) {
      const u = i / 40, a = rot + u * turns * TAU, r = u * Math.min(rx, ry) * 0.9;
      const qx = x + Math.cos(a) * r * (rx / ry), qy = y + Math.sin(a) * r;
      i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
    }
    strokeInk(ctx, 2.8);
  } else {
    const pr = (E.pupil || 1) * (1 + 0.22 * P.small);
    const prx = rx * 0.66 * pr, pry = ry * 0.68 * pr;
    ellipsePath(ctx, px, py, prx, pry); ctx.fillStyle = INK; ctx.fill();
    ctx.fillStyle = pal.hi;
    const lx = P.lx;
    circlePath(ctx, px - prx * 0.32 * lx, py - pry * 0.36, Math.max(1.6, prx * 0.4)); ctx.fill();
    circlePath(ctx, px + prx * 0.36 * lx, py + pry * 0.38, Math.max(0.9, prx * 0.17)); ctx.fill();
    if (E.sparkle) {
      const r = prx * 0.55, cx = px + prx * 0.28 * P.lx, cy = py - pry * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx, cy, cx + r * 0.7, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy + r); ctx.quadraticCurveTo(cx, cy, cx - r * 0.7, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy - r); ctx.fill();
    }
  }
  // upper lid (blink / annoyed / determined / sad)
  const lid = Math.max(E.lid || 0, P.blink);
  if (lid > 0.02) {
    const ly0 = y - ry + 2 * ry * lid;
    const tilt = (E.lidTilt || 0) * (1 - P.blink) * ry * 0.6;
    const yIn = ly0 + tilt, yOut = ly0 - tilt; // angry: inner corner lower
    const xa = x - rx * 1.2, xb = x + rx * 1.2;
    const ya = inner > 0 ? yOut : yIn, yb = inner > 0 ? yIn : yOut;
    ctx.beginPath();
    ctx.moveTo(xa, y - ry - 20); ctx.lineTo(xb, y - ry - 20); ctx.lineTo(xb, yb);
    ctx.quadraticCurveTo(x, (ya + yb) / 2 + ry * 0.1, xa, ya); ctx.closePath();
    ctx.fillStyle = lidCol; ctx.fill();
    ctx.beginPath(); ctx.moveTo(xb, yb); ctx.quadraticCurveTo(x, (ya + yb) / 2 + ry * 0.1, xa, ya);
    strokeInk(ctx, 4);
  }
  if (E.lower > 0) {
    const ly1 = y + ry - 2 * ry * E.lower;
    ctx.beginPath();
    ctx.moveTo(x - rx * 1.3, y + ry + 20); ctx.lineTo(x - rx * 1.3, ly1 + ry * 0.25);
    ctx.quadraticCurveTo(x, ly1 - ry * 0.3, x + rx * 1.3, ly1 + ry * 0.25); ctx.lineTo(x + rx * 1.3, y + ry + 20); ctx.closePath();
    ctx.fillStyle = lidCol; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - rx * 1.3, ly1 + ry * 0.25); ctx.quadraticCurveTo(x, ly1 - ry * 0.3, x + rx * 1.3, ly1 + ry * 0.25);
    strokeInk(ctx, 3.5);
  }
  ctx.restore();
  ellipsePath(ctx, x, y, rx, ry); strokeInk(ctx, 4.5);
  if (E.tear) { // watery glint under the eye
    ctx.save(); ctx.globalAlpha *= 0.85;
    ctx.fillStyle = pal.tear;
    ellipsePath(ctx, x + rx * 0.1, y + ry * 0.72, rx * 0.7, ry * 0.2); ctx.fill();
    ctx.restore();
  }
}

function drawBrows(ctx, P, g, pal) {
  const E = P.E;
  for (let i = 0; i < 2; i++) {
    const e = g.eyes[i];
    const inner = i === 0 ? 1 : -1;
    const by = e.y - e.ry - 8 - (E.browY || 0) * 6;
    const len = e.rx * 0.95 + 4;
    const a = (E.browA || 0) * 5;
    const x0 = e.x - inner * len * 0.6, x1 = e.x + inner * len * 0.6;
    const y0 = by - a, y1 = by + a;
    const col = i === g.patchEye ? mixColor(pal.car, INK, 0.5) : pal.brow;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(e.x, Math.min(y0, y1) - 3 - Math.abs(a) * 0.2, x1, y1);
    strokeInk(ctx, 5.5, col);
  }
}

function drawNose(ctx, g, pal) {
  const { nx, ny, nw, nh } = g;
  ctx.beginPath();
  ctx.moveTo(nx - nw, ny - nh * 0.3);
  ctx.bezierCurveTo(nx - nw, ny - nh * 1.1, nx + nw, ny - nh * 1.1, nx + nw, ny - nh * 0.3);
  ctx.bezierCurveTo(nx + nw, ny + nh * 0.45, nx + nw * 0.35, ny + nh, nx, ny + nh);
  ctx.bezierCurveTo(nx - nw * 0.35, ny + nh, nx - nw, ny + nh * 0.45, nx - nw, ny - nh * 0.3);
  ctx.closePath();
  ctx.fillStyle = pal.nose; ctx.fill(); strokeInk(ctx, 4.5);
  ctx.fillStyle = rgba(pal.hi, 0.9);
  ellipsePath(ctx, nx - nw * 0.38 * g.lx, ny - nh * 0.42, nw * 0.34, nh * 0.22, -0.25 * g.lx); ctx.fill();
}

function drawMouth(ctx, P, g, pal) {
  const E = P.E;
  const m = mouthOpenAmt(P);
  const { px, py, Lx, Rx } = g;
  const sm = E.smile ?? 0.5;
  const topY = py;
  const cornerY = topY - sm * 4.5 - 1;
  // philtrum
  ctx.beginPath(); ctx.moveTo(g.nx - g.u * 1, g.ny + g.nh - 1); ctx.lineTo(px, topY);
  strokeInk(ctx, 4);
  if (E.shape === 'o' && m > 0.04) {
    const ox = px - 1, oy = topY + 7 + m * 7, orx = 6 + m * 5, ory = 5 + m * 9;
    ellipsePath(ctx, ox, oy, orx, ory); ctx.fillStyle = pal.mouth; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = pal.tongue; ellipsePath(ctx, ox, oy + ory * 0.8, orx * 0.8, ory * 0.45); ctx.fill();
    ctx.restore();
    ellipsePath(ctx, ox, oy, orx, ory); strokeInk(ctx, 4);
    return;
  }
  if (m <= 0.04) {
    ctx.beginPath();
    ctx.moveTo(Lx, cornerY);
    ctx.quadraticCurveTo((Lx + px) / 2, topY + 3 + sm * 3, px, topY);
    ctx.quadraticCurveTo((Rx + px) / 2, topY + 3 + sm * 3, Rx, cornerY + 1);
    strokeInk(ctx, 4);
    if (E.firm) { // determined: little cheek dimple
      ctx.beginPath(); ctx.moveTo(Lx - 2, cornerY - 3); ctx.lineTo(Lx + 1, cornerY + 3); strokeInk(ctx, 3.5);
    }
    return;
  }
  // open mouth
  const oh = 6 + 22 * m;
  const gf = P.gforce;
  const Lxx = Lx - gf * 8, Rxx = Rx + gf * 3;
  const build = () => {
    ctx.beginPath();
    ctx.moveTo(Lxx, cornerY);
    ctx.quadraticCurveTo((Lxx + px) / 2, topY + 3 + sm * 2, px, topY);
    ctx.quadraticCurveTo((Rxx + px) / 2, topY + 3 + sm * 2, Rxx, cornerY + 1);
    ctx.quadraticCurveTo(Rxx + 1, topY + oh, px - 2, topY + oh);
    ctx.quadraticCurveTo(Lxx - 2, topY + oh, Lxx, cornerY);
    ctx.closePath();
  };
  build(); ctx.fillStyle = pal.mouth; ctx.fill();
  ctx.save(); ctx.clip();
  if (E.teeth) {
    ctx.fillStyle = pal.teeth;
    ctx.fillRect(Lxx - 4, topY - 6, Rxx - Lxx + 8, 6 + oh * 0.35);
    ctx.fillRect(Lxx - 4, topY + oh * 0.72, Rxx - Lxx + 8, oh);
    ctx.beginPath();
    for (let i = 1; i < 5; i++) { const xx = lerp(Lxx, Rxx, i / 5); ctx.moveTo(xx, topY - 4); ctx.lineTo(xx, topY + oh * 0.34); ctx.moveTo(xx, topY + oh * 0.74); ctx.lineTo(xx, topY + oh + 4); }
    strokeInk(ctx, 2);
  } else {
    ctx.fillStyle = pal.tongue;
    ellipsePath(ctx, px - 3, topY + oh + 1, 11 + m * 4, 6 + m * 5); ctx.fill();
    // little fangs
    ctx.fillStyle = pal.teeth;
    for (const fx of [Lxx + 5, Rxx - 3]) {
      ctx.beginPath(); ctx.moveTo(fx - 3, topY - 2); ctx.lineTo(fx + 3, topY - 2); ctx.lineTo(fx, topY + 5); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  build(); strokeInk(ctx, 4);
}

function drawTongue(ctx, P, g, pal) {
  const tg = P.tongue;
  if (tg <= 0.05 || P.holdMouth) return;
  const m = mouthOpenAmt(P);
  const oh = 6 + 22 * m;
  const gf = P.gforce;
  ctx.save();
  if (gf > 0.3) {
    // tongue streams backwards, flapping
    const x0 = g.Lx - 4, y0 = g.py + oh * 0.55;
    const ph = P.beat * TAU * 4;
    const sp = [];
    const tl = 58 * tg * (1 - 0.55 * P.helmet);
    for (let i = 0; i <= 8; i++) { const u = i / 8; sp.push([x0 - u * tl, y0 + Math.sin(ph + u * 5) * 6 * u + u * 6]); }
    const w = sp.map((_, i) => 7.5 - i * 0.25);
    ctx.beginPath(); smoothClosed(ctx, ribbonPts(sp, w)); ctx.fillStyle = pal.tongue; ctx.fill(); strokeInk(ctx, 4);
    ctx.restore();
    return;
  }
  const tx = g.px - 4 + g.u * 1, ty = g.py + oh - 7;
  const len = 12 + 17 * tg + (P.E.pant && P.hasT ? 3 * P.hop : 0);
  const tw = 9.5;
  ctx.translate(tx, ty);
  ctx.rotate(P.E.lollTongue ? 0.5 : 0.08);
  const body = () => {
    ctx.moveTo(-tw, 0); ctx.lineTo(-tw, len - tw);
    ctx.arc(0, len - tw, tw, Math.PI, 0, true);
    ctx.lineTo(tw, 0);
  };
  ctx.beginPath(); body(); ctx.closePath(); ctx.fillStyle = pal.tongue; ctx.fill();
  ctx.beginPath(); body(); strokeInk(ctx, 4);
  ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, len * 0.55); strokeInk(ctx, 2.5, pal.tongueDark);
  ctx.restore();
}

function drawPatch(ctx, g, color) {
  const e = g.eyes[g.patchEye];
  const out = e.side; // outward direction
  ctx.fillStyle = color;
  ctx.beginPath();
  // irregular blob: main oval + a lobe up/outward + a notch of fur
  const cx = e.x + out * 2, cy = e.y - 3;
  const pts = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    let r = 1 + 0.12 * Math.sin(a * 3 + 1.3) + (i % 2 ? 0.08 : 0);
    const up = Math.max(0, -Math.sin(a)) * Math.max(0, Math.cos(a) * out) * 0.5;
    r += up;
    pts.push([cx + Math.cos(a) * (e.rx + 10) * r, cy + Math.sin(a) * (e.ry + 9) * r]);
  }
  smoothClosed(ctx, pts); ctx.fill();
}

function drawDazedStars(ctx, P, g, front, pal) {
  if (!P.E.stars) return;
  for (let i = 0; i < 3; i++) {
    const a = TAU * P.beat * 0.5 + (i * TAU) / 3;
    const s = Math.sin(a);
    if ((s >= 0) !== front) continue;
    const x = Math.cos(a) * 58, y = -g.ry - 12 + s * 13;
    const r = 8 + s * 2;
    softStarPath(ctx, x, y, r, r * 0.5, 5, a * 0.5);
    ctx.fillStyle = pal.dazed; ctx.fill(); strokeInk(ctx, 3);
  }
}

function drawExclaim(ctx, P, g, pal) {
  const k = P.exclaim;
  if (k <= 0) return;
  const sc = ease.outBack(clamp(k));
  ctx.save();
  ctx.translate(-8, -g.ry - 48);
  ctx.scale(sc, sc);
  ctx.rotate(-0.12);
  // burst lines
  ctx.beginPath();
  for (const [a, r0, r1] of [[-2.6, 30, 42], [-0.55, 30, 42], [-1.57, 36, 46]]) {
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 4); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
  }
  strokeInk(ctx, 4.5);
  ctx.beginPath();
  ctx.moveTo(-8, -28); ctx.quadraticCurveTo(0, -34, 8, -28); ctx.lineTo(3.5, 6); ctx.quadraticCurveTo(0, 9, -3.5, 6); ctx.closePath();
  ctx.fillStyle = pal.exclaim; ctx.fill(); strokeInk(ctx, 4.5);
  circlePath(ctx, 0, 20, 6.5); ctx.fillStyle = pal.exclaim; ctx.fill(); strokeInk(ctx, 4.5);
  ctx.restore();
}

function drawGoggles(ctx, P, g, pal, mode) {
  const up = mode === 'forehead';
  const lensCol = pal.lens;
  const eyes = g.eyes;
  const y = up ? -g.ry * 0.62 : eyes[0].y;
  const sy = up ? 0.62 : 1;
  // strap across the head
  ctx.beginPath();
  ctx.moveTo(-g.rx - 2, y + (up ? 4 : 2));
  ctx.quadraticCurveTo(0, y - 4, g.rx + 2, y + (up ? 2 : 0));
  ctx.lineWidth = 10 + LW; ctx.strokeStyle = INK; ctx.lineCap = 'butt'; ctx.stroke();
  ctx.lineWidth = 10; ctx.strokeStyle = pal.strap; ctx.stroke();
  for (let i = 0; i < 2; i++) {
    const e = eyes[i];
    const r = 15 * (0.55 + 0.45 * e.f) + 2;
    ctx.save();
    ctx.translate(e.x, y); ctx.scale(1, sy);
    circlePath(ctx, 0, 0, r + 4.5); ctx.fillStyle = pal.gold; ctx.fill(); strokeInk(ctx, 4.5 / sy * 0.9);
    circlePath(ctx, 0, 0, r - 1); ctx.fillStyle = lensCol; ctx.fill(); strokeInk(ctx, 3.5);
    ctx.fillStyle = rgba(pal.hi, 0.75);
    ellipsePath(ctx, -r * 0.35, -r * 0.35, r * 0.34, r * 0.18, -0.7); ctx.fill();
    ctx.restore();
  }
  // bridge
  ctx.beginPath(); ctx.moveTo(eyes[0].x + 12, y); ctx.lineTo(eyes[1].x - 8, y);
  strokeInk(ctx, 4.5);
}

function drawSunglasses(ctx, P, g, pal) {
  const eyes = g.eyes;
  const y = eyes[0].y - 1;
  ctx.lineJoin = 'round';
  // arm back toward the near ear
  ctx.beginPath(); ctx.moveTo(eyes[0].x - 14, y - 6); ctx.lineTo(-g.rx + 2, y - 12); strokeInk(ctx, 5, pal.shades);
  for (let i = 0; i < 2; i++) {
    const e = eyes[i];
    const w = 17 * (0.5 + 0.5 * e.f) + 3, h = 13;
    const cx = e.x + (i ? 1 : -1);
    ctx.beginPath();
    ctx.moveTo(cx - w, y - h);
    ctx.lineTo(cx + w, y - h);
    ctx.quadraticCurveTo(cx + w + 1, y + h * 0.9, cx + w * 0.1, y + h);
    ctx.quadraticCurveTo(cx - w, y + h * 1.05, cx - w, y - h);
    ctx.closePath();
    ctx.fillStyle = pal.shades; ctx.fill(); strokeInk(ctx, 4.5);
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(pal.hi, 0.8); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - w * 0.5, y + h * 0.3); ctx.lineTo(cx - w * 0.05, y - h * 0.6); ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(cx - w * 0.02, y + h * 0.35); ctx.lineTo(cx + w * 0.28, y - h * 0.2); ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(eyes[0].x + 14, y - 9); ctx.quadraticCurveTo((eyes[0].x + eyes[1].x) / 2, y - 14, eyes[1].x - 12, y - 9);
  strokeInk(ctx, 5, pal.shades);
}

function drawHelmet(ctx, P, pal, isBack) {
  const k = P.helmet;
  if (k <= 0) return;
  // plonked on from above: drops in, overshoots a touch, fades in fast
  const drop = -(1 - ease.outCubic(clamp(k * 1.15))) * 90;
  const sc = lerp(1.12, 1, ease.outBack(clamp(k)));
  ctx.save();
  ctx.globalAlpha *= clamp(k * 2.5);
  ctx.translate(isBack ? 0 : 3, drop - 6);
  ctx.scale(sc, sc);
  if (P.lx < 0) ctx.scale(-1, 1); // glints stay on the upper-left of the screen
  const r = 68, ringY = 55;
  // the opening + neck ring turn to sit square on the neck (glints stay screen upper-left)
  fishbowl(ctx, P, pal, r, 0, Math.sqrt(r * r - ringY * ringY), isBack ? 0 : (P.ringTilt || 0) * (P.lx < 0 ? -1 : 1));
  ctx.restore();
}

// The shared fishbowl recipe (Juno's helmet numbers, scaled by r / 134): faint glass fill, full-rim
// blue edge gradient, ink rim, big glint arc upper-left + a dot at the top + a faint lower-right
// streak, then the orange neck ring drawn as a TORUS (band + dark hole), not a filled plate.
// Bowl centre (0, cy); `half` = half-width of the neck opening; `tilt` turns the opening + ring.
function fishbowl(ctx, P, pal, r, cy, half, tilt = 0) {
  const q = r / 134;
  const oa = Math.asin(half / r);
  const ringY = cy + Math.sqrt(r * r - half * half);
  const bowl = () => { ctx.beginPath(); ctx.arc(0, cy, r, Math.PI / 2 + oa + tilt, Math.PI * 2.5 - oa + tilt); };
  bowl(); ctx.closePath(); ctx.fillStyle = rgba(pal.glass, 0.1); ctx.fill();
  const gr = ctx.createRadialGradient(-20 * q, cy - 20 * q, r * 0.55, 0, cy, r);
  gr.addColorStop(0, rgba(pal.glassIn, 0)); gr.addColorStop(1, rgba(pal.glassRim, 0.4));
  bowl(); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
  bowl(); strokeInk(ctx, P.lwO);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, cy, r * 0.8, Math.PI * 1.1, Math.PI * 1.4);
  ctx.strokeStyle = rgba(pal.hi, 0.92); ctx.lineWidth = 14 * q; ctx.stroke();
  circlePath(ctx, 6 * q, cy - r * 0.8, 6.5 * q); ctx.fillStyle = rgba(pal.hi, 0.92); ctx.fill();
  ctx.beginPath(); ctx.arc(0, cy, r * 0.86, Math.PI * 0.04, Math.PI * 0.2);
  ctx.strokeStyle = rgba(pal.hi, 0.4); ctx.lineWidth = 7 * q; ctx.stroke();
  // neck ring: torus seen from slightly above
  ctx.save();
  if (tilt) { ctx.translate(0, cy); ctx.rotate(tilt); ctx.translate(0, -cy); }
  const rw = half + 6, rh = Math.max(10.5, 14 * q), yc = ringY + 2;
  const hx = rw * 0.7, hy = rh * 0.34, hyc = yc - rh * 0.3;
  ctx.beginPath(); ctx.ellipse(0, yc, rw, rh, 0, 0, TAU);
  underInk(ctx, P);
  ctx.fillStyle = pal.ringShade; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-2, yc - 1.6, rw - 3, rh - 2.6, 0, 0, TAU); ctx.fillStyle = pal.ring; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, hyc, hx, hy, 0, 0, TAU); ctx.fillStyle = pal.ringHole; ctx.fill(); strokeInk(ctx, 3);
  ctx.beginPath(); ctx.ellipse(0, yc, rw, rh, 0, 0, TAU); strokeInk(ctx, LW);
  // glint along the front of the band
  ctx.beginPath(); ctx.ellipse(0, yc, rw - 5, rh - 3.2, 0, Math.PI * 0.62, Math.PI * 0.86);
  ctx.strokeStyle = rgba(pal.hi, 0.7); ctx.lineWidth = 2.6; ctx.stroke();
  ctx.restore();
}

function drawCollar(ctx, P, pal, isBack) {
  if (!P.collar) return;
  const w = 12;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (isBack) { ctx.moveTo(-38, 34); ctx.quadraticCurveTo(0, 60, 38, 34); }
  else { ctx.moveTo(-40, 32); ctx.quadraticCurveTo(-6, 70, 32, 40); }
  ctx.strokeStyle = INK; ctx.lineWidth = w + LW * 2; ctx.stroke();
  ctx.strokeStyle = pal.collar; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
  if (isBack) return;
  // gold star tag
  const tx = -3, ty = 66;
  ctx.beginPath(); ctx.arc(-4, 56, 3.5, 0, TAU); strokeInk(ctx, 3.5, pal.goldDark);
  softStarPath(ctx, tx, ty, 11, 6.2, 5, -Math.PI / 2 + 0.15);
  ctx.fillStyle = pal.gold; ctx.fill(); strokeInk(ctx, 4);
  ctx.fillStyle = rgba(pal.hi, 0.8); circlePath(ctx, tx - 3 * P.lx, ty - 3, 2.2); ctx.fill();
}

// ---------------------------------------------------------------- head (front, 3/4)
function earParams(P, g, isBack) {
  const hf = P.hairFloat, gf = P.gforce;
  const runBack = P.stance === 'run' ? 0.55 : P.stance === 'jump' ? 0.35 : 0;
  const perk = clamp(P.ears, -1, 1.2);
  const pk = clamp(perk);
  const helmetShrink = lerp(1, 0.8, P.helmet);
  const out = [];
  const u = g.u;
  for (const side of [-1, 1]) {
    const far = !isBack && side > 0 && u > 0.35;
    // attach points (the far ear tucks behind the head in 3/4)
    let ax, ay;
    if (isBack) { ax = side * 34; ay = -26; }
    else if (side < 0) { ax = lerp(-36, -31, u); ay = lerp(-28, -29, u); }
    else { ax = lerp(36, 25, u); ay = lerp(-28, -36, u); }
    ay -= pk * 6;
    const floppy = side < 0 ? 0.3 : far ? -0.1 : -0.3;
    const perked = side < 0 ? Math.PI - 0.42 : -(Math.PI - 0.42);
    let a = perk >= 0 ? lerp(floppy, perked, pk) : floppy + perk * 0.55 * -side;
    a += P.earBob * (side < 0 ? 1 : -1) * (1 - hf);
    // zero-g float: drift up and outward, gently waving
    const floatA = (side < 0 ? Math.PI - 0.8 : -(Math.PI - 0.8)) + 0.2 * Math.sin(TAU * P.beat * 0.25 + side);
    a = lerp(a, floatA, hf * (1 - pk * 0.5));
    // running / g-force: stream backwards (-x)
    if (runBack) a = lerp(a, Math.PI / 2 + 0.2 + 0.1 * Math.sin(TAU * P.beat * 2 + side), runBack);
    if (gf > 0) a = lerp(a, Math.PI / 2 + (side < 0 ? 0.08 : 0.2) + 0.08 * Math.sin(TAU * P.beat * 4 + side * 2), gf);
    const bend = side * -0.3 * (1 - pk) * (1 - hf * 0.6) + hf * 0.6 * Math.sin(TAU * P.beat * 0.25 + 1 + side);
    // perked ears: the tip flops over outward (terrier "button" fold)
    const fold = side * 1.9 * pk * (1 - gf) * (1 - hf * 0.5);
    let len = 56 * helmetShrink * (1 - 0.04 * pk);
    if (gf > 0 && P.helmet > 0.5) { // pinned back against the glass
      len *= 1 - 0.4 * gf * P.helmet;
      a = lerp(a, Math.PI / 2 - 0.45 + 0.06 * Math.sin(TAU * P.beat * 4 + side * 2), gf * P.helmet);
    }
    out.push({ side, ax, ay, a, bend: gf > 0 && P.helmet > 0.5 ? bend - 0.5 * gf : bend, fold, len, perk: pk });
  }
  return out;
}

function headFront(ctx, P, pal) {
  const g = headGeo(P);
  const E = P.E;
  const ears = earParams(P, g, false);
  const nearEar = ears[0], farEar = ears[1];
  const bound = P.helmet >= 0.9 ? [3, -6, 67] : null; // helmet glass (see drawHelmet)
  const thin = 1 - 0.3 * P.gforce;
  const earNear = earShape(nearEar.ax, nearEar.ay, nearEar.a, nearEar.len, -1, nearEar.perk, P.frizz, nearEar.bend, nearEar.fold, 3, bound, thin);
  const earFar = earShape(farEar.ax, farEar.ay, farEar.a, farEar.len, 1, farEar.perk, P.frizz, farEar.bend, farEar.fold, 7, bound, thin);

  drawDazedStars(ctx, P, g, false, pal);
  // far ear behind the head (in 3/4); in straight-on view both ears are in front
  const farBehind = g.u > 0.35;
  if (farBehind) drawEar(ctx, earFar, pal, farEar.perk, P);

  const shapes = headShapes(P, g);
  shadedUnion(ctx, shapes, pal.fur, pal.furShade, P.lx, {
    mark: (c, dark) => drawPatch(c, g, dark ? pal.carDeep : pal.car), lw: P.lwO, pal,
    blots: sootBlots(P, [0, -4, g.rx, g.ry, 0], 3, 61),
  });
  if (P.blush > 0) {
    ctx.fillStyle = rgba(pal.blush, 0.5 * P.blush);
    for (const e of g.eyes) { ellipsePath(ctx, e.x - e.side * 3, e.y + e.ry + 9, 9 * (0.5 + 0.5 * e.f), 5); ctx.fill(); }
  }
  highlight(ctx, -g.rx * 0.42 * P.lx, -g.ry * 0.6, 11, 5.5, -0.55 * P.lx, pal.hiA, pal.hi);
  rimArc(ctx, P, [0, 0, g.rx, g.ry, 0]);

  drawMouth(ctx, P, g, pal);
  drawTongue(ctx, P, g, pal);
  for (let i = 0; i < 2; i++) drawEye(ctx, g.eyes[i], P, g, pal, i === g.patchEye, i);
  if (!P.sunglasses && P.goggles !== 'eyes') drawBrows(ctx, P, g, pal);
  drawNose(ctx, g, pal);

  if (P.holdMouth) {
    ctx.save();
    ctx.translate(g.px - 2, g.py + 5);
    if (P.facing < 0) ctx.scale(-1, 1); // keep text on held items readable
    P.holdMouth(ctx);
    ctx.restore();
    // jowl clamps over the item
    ellipsePath(ctx, g.Lx + 2, g.py + 1, 10, 7.5, 0.2); ctx.fillStyle = pal.fur; ctx.fill(); strokeInk(ctx, 4);
    ctx.beginPath(); ctx.moveTo(g.nx - 1, g.ny + g.nh - 1); ctx.lineTo(g.px, g.py); strokeInk(ctx, 4);
  }

  if (!farBehind) drawEar(ctx, earFar, pal, farEar.perk, P);
  drawEar(ctx, earNear, pal, nearEar.perk, P);

  if (P.goggles !== 'none') drawGoggles(ctx, P, g, pal, P.goggles);
  if (P.sunglasses) drawSunglasses(ctx, P, g, pal);
  if (P.hat) {
    ctx.save();
    ctx.translate(-4 + g.u * 2, -g.ry - 4);
    if (P.facing < 0) ctx.scale(-1, 1);
    P.hat(ctx);
    ctx.restore();
  }
  drawDazedStars(ctx, P, g, true, pal);
  drawHelmet(ctx, P, pal, false);
  drawExclaim(ctx, P, g, pal);
  return g;
}

// ---------------------------------------------------------------- head (back view)
function headBack(ctx, P, pal) {
  const g = { rx: 50, ry: 45, u: 0 };
  const ears = earParams(P, g, true);
  const fz = P.frizz;
  const lookUp = clamp(-(P.look[1] || 0), 0, 1);
  const turnX = clamp(P.look[0] || 0, -1, 1) * 0.6 + 0.35; // muzzle peeks out on the facing side
  // muzzle nub peeking out (behind cranium)
  const shapes = [{ e: [0, 0, g.rx, g.ry - lookUp * 3, 0], tufts: tufts([[-1.85, 0.14, 10, -0.6, 0.12], [-1.57, 0.16, 15, -0.7, 0.12], [-1.3, 0.13, 9, -0.5, 0.12], [2.5, 0.15, 9, 0.4, 0.3], [0.64, 0.15, 9, -0.4, 0.3]], fz, 17, 16) }];
  drawDazedStars(ctx, P, g, false, pal);
  // the snout peeks out on the side he's looking toward; looking up, it pokes over the crown
  if (turnX > 0.05 || lookUp > 0.05) {
    const k = ease.inOutSine(lookUp);
    const mx = lerp(36 + 14 * turnX, 8 + 22 * turnX, k), my = lerp(16, -55, k);
    const ang = lerp(-0.25, -1.2, k);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
    ellipsePath(ctx, 0, 0, 20, 14); underInk(ctx, P); ctx.fillStyle = pal.fur; ctx.fill(); strokeInk(ctx, LW);
    ellipsePath(ctx, 15, -1, 7, 6); ctx.fillStyle = pal.nose; ctx.fill(); strokeInk(ctx, 4);
    ctx.restore();
  }
  shadedUnion(ctx, shapes, pal.fur, pal.furShade, P.lx, { lw: P.lwO, pal, blots: sootBlots(P, [0, 0, g.rx, g.ry, 0], 3, 63) });
  highlight(ctx, -g.rx * 0.42 * P.lx, -g.ry * 0.55, 11, 5.5, -0.55 * P.lx, pal.hiA, pal.hi);
  rimArc(ctx, P, [0, 0, g.rx, g.ry, 0]);
  for (const e of ears) {
    const sh = earShape(e.ax, e.ay, e.a, e.len, e.side, e.perk, fz, e.bend, e.fold, 3 + e.side, P.helmet >= 0.9 ? [0, -6, 67] : null);
    drawEar(ctx, sh, pal, 0, P); // we see the back of the ears
  }
  if (P.goggles !== 'none') {
    const y = P.goggles === 'forehead' ? -g.ry * 0.5 : -4;
    ctx.beginPath(); ctx.moveTo(-g.rx - 2, y + 4); ctx.quadraticCurveTo(0, y + 10, g.rx + 2, y + 4);
    ctx.lineWidth = 10 + LW; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 10; ctx.strokeStyle = pal.strap; ctx.stroke();
  }
  if (P.hat) { ctx.save(); ctx.translate(0, -g.ry - 4); if (P.facing < 0) ctx.scale(-1, 1); P.hat(ctx); ctx.restore(); }
  drawDazedStars(ctx, P, g, true, pal);
  drawHelmet(ctx, P, pal, true);
  drawExclaim(ctx, P, g, pal);
  return g;
}

// ---------------------------------------------------------------- rigs
// Returns layout for the body in the (unmirrored) local frame, ground at y = 0.
function rigFront(P) {
  const st = P.stance, fz = P.frizz;
  const wagA = P.wag * 0.5 * P.wagOsc;
  const R = { legs: [], shapes: [], head: [48, -138], headRot: 0, tail: null, haunch: null, vest: null, feet: [] };
  const breath = 1 + 0.018 * P.breath;
  const beatDip = P.bob * 2.5 * Math.pow(1 - P.hop, 3); // head nods on each beat
  const B = (bx, by, rx, ry, rot, base, seed = 21) => ({ e: [bx, by, rx, ry, rot], tufts: tufts(base, fz, seed, 20, 1.2) });
  const toBody = (b, x, y) => { const [c0, c1, , , r] = b.e; const [qx, qy] = rot2(x, y, r); return [c0 + qx, c1 + qy]; };
  // chest ruff under the chin, a scruffy rump, one little tuft on the back
  const chestTufts = [[0.78, 0.15, 11, 0.5, 0.3], [1.1, 0.13, 9, 0.45, 0.3], [2.95, 0.14, 8, -0.5, 0.3], [4.3, 0.1, 6, -0.6, 0.3]];

  if (st === 'stand' || st === 'walk' || st === 'run' || st === 'jump' || st === 'float') {
    let bx = -8, by = -64, rx = 58, ry = 38 * breath, rot = -0.04;
    let head = [48, -138], headRot = 0;
    const ph = P.phase;
    const legSpec = [ // [hip x, hip y rel. body centre, far, front, walk phase offset]
      [-20, 12, true, false, 0.5], [44, 8, true, true, 0.75], [-32, 16, false, false, 0], [30, 16, false, true, 0.25],
    ];
    if (st === 'walk') {
      const bob = 2.5 * (0.5 - 0.5 * Math.cos(TAU * 2 * ph));
      by -= bob; head = [48, -138 - bob * 1.2 + 1.5 * Math.sin(TAU * 2 * ph - 0.8)];
    }
    if (st === 'run') {
      const th = TAU * ph;
      const s = Math.sin(th);
      rot = -0.04 - 0.1 * Math.cos(th);
      by = -64 - 10 * Math.max(0, s);
      rx = 60 * (1 + 0.08 * s); ry = 37 * (1 - 0.07 * s);
      head = [60 + 4 * s, by - 68 + 3 * Math.sin(th - 1.2)]; headRot = 0.1 + 0.05 * Math.cos(th);
    }
    if (st === 'jump') { rot = -0.26; by = -70; head = [44, -150]; headRot = -0.12; }
    if (st === 'float') { rx = 56; ry = 42 * breath; by = -68; rot = 0.04 * Math.sin((TAU * P.beat) / 4); head = [50, -142]; headRot = -0.06; }
    const body = B(bx, by, rx, ry, rot, chestTufts);
    R.shapes.push(body);
    const neck = toBody(body, 40, -30);
    R.shapes.push({ e: [neck[0], neck[1], 24, 22, 0], tufts: [] });
    R.head = [head[0], head[1] + beatDip * (st === 'stand' ? 1 : 0.4)];
    R.headRot = headRot;
    for (const [hx, hy, far, front, off] of legSpec) {
      const hip = toBody(body, hx * (rx / 58), hy - 8);
      let foot, bend = 0, pad = 0, pawAng = 0, knee = null;
      const groundY = far ? -12 : -8;
      if (st === 'stand') foot = [hip[0] + (front ? 4 : -2), groundY];
      else if (st === 'walk') {
        const p = fr(ph + off);
        let dx, lift;
        if (p < 0.6) { dx = lerp(12, -12, p / 0.6); lift = 0; } else { const q = (p - 0.6) / 0.4; dx = lerp(-12, 12, ease.inOutSine(q)); lift = 11 * Math.sin(Math.PI * q); }
        foot = [hip[0] + dx + (front ? 4 : -2), groundY - lift];
        bend = lift * (front ? -0.8 : 0.8);
        pawAng = lift * 0.02 * (front ? 1 : -1);
      } else if (st === 'run') {
        // rotary gallop: front pair reaches while the hind pair pushes, then they gather
        const th = TAU * (ph + (far ? 0.07 : 0) + (front ? 0 : 0.5));
        const sw = Math.sin(th); // +1 = reaching forward
        const rec = Math.max(0, Math.cos(th)); // recovering (leg folds)
        const Ll = 40;
        const a = sw * (front ? 0.95 : 0.8) + (front ? 0.1 : -0.1);
        const lift = rec * 12;
        foot = [hip[0] + Math.sin(a) * Ll, hip[1] + Math.cos(a) * Ll - lift];
        bend = (front ? -1 : 1) * (4 + 12 * rec);
        pawAng = a * 0.5 + (front ? rec * 0.6 : -rec * 0.6);
      } else if (st === 'jump') {
        if (front) { foot = [hip[0] + 26, hip[1] + 16]; bend = -12; pawAng = 0.7; }
        else { foot = [hip[0] - 30, hip[1] + 30]; bend = 6; pawAng = -0.5; }
      } else { // float: splayed paddling
        const pp = TAU * (ph * 2 + off);
        const out = front ? [30, far ? -6 : 26] : [-32, far ? -8 : 24];
        foot = [hip[0] + out[0] + Math.cos(pp) * 7, hip[1] + out[1] + Math.sin(pp) * 7];
        bend = (front ? -1 : 1) * 6;
        pad = far ? 0 : 1; pawAng = front ? -0.5 : 0.5;
      }
      R.legs.push({ hip, foot, knee, bend, far, front, pad, pawAng, layer: 'back', w: 21 });
    }
    // tail
    const tb = toBody(body, -52 * (rx / 58), -20);
    let tailAng = -2.05, curl = 0.55;
    if (st === 'run') { tailAng = Math.PI + 0.35 + rot + 0.15 * Math.sin(TAU * P.phase); curl = 0.25; }
    else if (st === 'jump') tailAng = -2.35;
    else if (st === 'float') tailAng = -1.95;
    R.tail = { base: tb, ang: tailAng + wagA, len: 42, curl, w: 9 };
    if (st === 'float') { R.tail.wave = 0.25; R.tail.wavePh = TAU * P.beat * 0.5; }
    R.vest = { body, A: -1.75, B: 1.8, hem: [-0.55, 0.02], star: [0.14, 0.02] };
    R.ring = toBody(body, 2, -ry + 2);
  } else if (st === 'sit' || st === 'beg') {
    const beg = st === 'beg';
    const body = beg ? B(-6, -70, 38, 52 * breath, 0.08, [[0.05, 0.15, 11, 0.5, 0.3], [0.4, 0.13, 8, 0.45, 0.3], [3.3, 0.13, 7, -0.4, 0.3]])
      : B(-10, -56, 42, 46 * breath, 0.3, [[0.1, 0.15, 11, 0.5, 0.3], [0.45, 0.13, 8, 0.45, 0.3], [3.3, 0.13, 7, -0.4, 0.3]]);
    R.shapes.push(body);
    const neck = beg ? [6, -116] : [16, -100];
    R.shapes.push({ e: [neck[0], neck[1], 23, 22, 0], tufts: [] });
    R.head = beg ? [10, -160 + beatDip] : [26, -142 + beatDip];
    R.headRot = beg ? -0.06 : 0;
    // haunch + hind foot peeking out in front of it
    R.haunch = beg ? { e: [-16, -30, 29, 25, -0.15], tufts: tufts([[3.4, 0.15, 8, -0.5, 0.3]], fz, 31, 10) }
      : { e: [-22, -30, 31, 27, -0.2], tufts: tufts([[3.4, 0.15, 8, -0.5, 0.3]], fz, 31, 10) };
    R.feet.push({ x: beg ? 12 : 8, y: -8, far: false, long: 1.25 });
    R.feet.push({ x: beg ? 0 : -2, y: -12, far: true, long: 1.15 });
    if (beg) {
      // forelegs held up in front of the chest, paws flopped down
      R.legs.push({ hip: [20, -108], knee: [46, -116], foot: [44, -90], far: true, front: true, layer: 'mid', w: 19, pawAng: 1.35, size: 0.92 });
      R.legs.push({ hip: [8, -102], knee: [36, -110], foot: [33, -84], far: false, front: true, layer: 'mid', w: 19, pawAng: 1.35, size: 0.95 });
    } else {
      R.legs.push({ hip: [32, -66], foot: [38, -12], bend: 0, far: true, front: true, layer: 'back', w: 21 });
      R.legs.push({ hip: [20, -60], foot: [25, -8], bend: -2, far: false, front: true, layer: 'mid', w: 22 });
    }
    R.tail = { base: beg ? [-40, -20] : [-46, -18], ang: -2.55 + wagA, len: 40, curl: 0.6, w: 9 };
    R.vest = beg ? { body, A: -2.68, B: -3.66, hem: [0, 0.8], C: 0.52, D: -0.46, top: [0, -0.24], star: [-0.3, 0.06] }
      : { body, A: -2.47, B: -3.66, hem: [0, 0.8], C: 0.52, D: -0.67, top: [0, -0.46], star: [-0.4, -0.24], starRot: -0.3 };
    R.ring = beg ? [-20, -104] : [-12, -96];
  } else if (st === 'lie') {
    const body = B(-8, -36, 70, 33 * breath, 0, [[3.75, 0.12, 7, -0.5, 0.3], [4.3, 0.11, 8, -0.5, 0.3], [3.25, 0.13, 7, -0.5, 0.3]]);
    R.shapes.push(body);
    R.head = [44, -58];
    R.headRot = 0.2;
    R.haunch = { e: [-38, -36, 31, 25, 0.08], tufts: tufts([[3.5, 0.14, 8, -0.5, 0.3]], fz, 33, 10) };
    R.feet.push({ x: -10, y: -8, far: false, long: 1.2 });
    R.frontPaws = [{ x: 72, y: -12, far: true }, { x: 56, y: -8, far: false }];
    // tail wraps along the front and its caramel tip tucks over the nose
    const wig = P.wag * 0.4 * P.wagOsc * 4;
    R.tail = { pts: [[-18, -12], [8, -2], [34, -2], [58, 0], [80, -6], [92 + wig * 0.3, -18 + wig]], w: 9, layer: 'front' };
    R.vest = { body, A: -2.3, B: 2.25, hem: [-1.0, 0], star: null }; // curled up: only the back shows
    R.ring = [-8, -68];
  }
  if (P.tailOverride !== null && R.tail && !R.tail.pts) R.tail.ang = P.tailOverride;
  if (!R.tail.layer) R.tail.layer = 'back';

  // --- paw gags: paws over the ears / one paw waving
  const head = R.head;
  const hr = R.headRot + P.headTilt;
  const hp = (x, y) => { const [qx, qy] = rot2(x, y, hr); return [head[0] + qx, head[1] + qy]; };
  const nearFront = R.legs.find((l) => l.front && !l.far);
  const farFront = R.legs.find((l) => l.front && l.far);
  const mixLeg = (L, foot, bend, pawAng, k) => {
    L.foot = [lerp(L.foot[0], foot[0], k), lerp(L.foot[1], foot[1], k)];
    if (L.knee) L.knee = [lerp(L.knee[0], (L.hip[0] + L.foot[0]) / 2, k), lerp(L.knee[1], (L.hip[1] + L.foot[1]) / 2, k)];
    L.bend = lerp(L.bend || 0, bend, k); L.pawAng = lerp(L.pawAng || 0, pawAng, k);
  };
  if (P.pawsUp > 0 && nearFront && farFront && st !== 'lie') {
    const k = ease.inOutSine(P.pawsUp);
    // near forearm runs up the side of the face; paw presses the near ear flat
    nearFront.hip = [lerp(nearFront.hip[0], nearFront.hip[0] - 12, k), lerp(nearFront.hip[1], nearFront.hip[1] - 26, k)];
    mixLeg(nearFront, hp(-47, -8), -14, 2.7, k);
    // far paw peeks over the top of the head onto the far ear
    mixLeg(farFront, hp(36, -40), 10, -2.5, k);
    if (k > 0.35) { nearFront.layer = 'front'; farFront.layer = 'mid'; nearFront.pad = 0; }
  }
  if (P.pawWave > 0 && nearFront && st !== 'lie') {
    const k = ease.inOutSine(P.pawWave);
    const w = P.hasT ? Math.sin(TAU * P.beat) : 0;
    const sh = nearFront.hip;
    mixLeg(nearFront, [sh[0] + 20 + w * 9, sh[1] - 50 + Math.abs(w) * 3], 12, 0.25 * w, k);
    nearFront.pad = k > 0.5 ? 1 : 0;
    if (k > 0.2) nearFront.layer = 'front';
  }
  return R;
}

function rigBack(P) {
  const st = P.stance, fz = P.frizz;
  const R = { legs: [], shapes: [], head: [0, -140], headRot: 0, tail: null, haunches: [], feet: [], headFirst: false };
  const breath = 1 + 0.018 * P.breath;
  const beatDip = P.bob * 2.5 * Math.pow(1 - P.hop, 3);
  const lookUp = clamp(-(P.look[1] || 0), 0, 1);
  const wagA = P.wag * 0.9 * P.wagOsc;
  if (st === 'stand' || st === 'walk' || st === 'run' || st === 'jump') {
    const body = { e: [0, -66, 50, 44 * breath, 0], tufts: tufts([[1.25, 0.13, 7, 0.3, 0.3], [1.9, 0.13, 7, -0.3, 0.3]], fz, 41, 20, 1.2) };
    R.shapes.push(body);
    R.head = [0, -142 + beatDip - lookUp * 6];
    R.headFirst = true;
    const ph = P.phase;
    for (const [x, far, off] of [[-16, true, 0.25], [16, true, 0.75], [-26, false, 0], [26, false, 0.5]]) {
      const p = fr(ph + off);
      const lift = st === 'walk' && p > 0.6 ? 10 * Math.sin(Math.PI * (p - 0.6) / 0.4) : 0;
      R.legs.push({ hip: [x, -40], foot: [x * 1.05, (far ? -14 : -8) - lift], far, w: 21, layer: 'back' });
    }
    R.tail = { base: [0, -94], ang: -Math.PI / 2 + 0.3 + wagA * 0.7, len: 40, curl: 0.7, w: 9.5, layer: 'front' };
    R.vest = { body, A: 0.3, B: -3.44, hem: [0, 0.62], star: [0, -0.22] };
    R.ring = [0, -104];
  } else { // sit (also used for float/lie/beg seen from behind)
    const body = { e: [0, -60, 46, 52 * breath, 0], tufts: tufts([[3.9, 0.11, 6, -0.4, 0.3], [5.5, 0.11, 6, 0.4, 0.3]], fz, 43, 20, 1.2) };
    R.shapes.push(body);
    R.shapes.push({ e: [0, -104, 27, 20, 0], tufts: [] });
    R.head = [0, -142 + beatDip - lookUp * 5];
    for (const side of [-1, 1]) {
      R.haunches.push({ e: [side * 30, -28, 23, 26, side * 0.12], tufts: tufts([[side < 0 ? 3.3 : 6.1, 0.14, 7, side * 0.5, 0.3]], fz, 45 + side, 8) });
      R.feet.push({ x: side * 42, y: -7, far: false, flip: side });
    }
    // tail swishes along the ground out to one side
    R.tail = { base: [8, -10], ang: 0.2 + 0.5 * P.wag * P.wagOsc, len: 44, curl: -0.55, w: 9, layer: 'front' };
    R.vest = { body, A: -0.52, B: 0.36, hem: [0, 0.62], C: 2.78, D: 3.66, top: [0, -0.3], star: [0, 0.0] };
    R.ring = [0, -106];
  }
  if (P.tailOverride !== null && R.tail) R.tail.ang = P.tailOverride;
  return R;
}

// ---------------------------------------------------------------- body parts
// Space vest: its own smooth garment path (NOT clipped to the tufty fur outline). It follows the
// body ellipse (outset a touch) along the silhouette and closes with ONE quadratic hem curve
// (plus an upper neckline curve for the band-shaped vests). Two-tone like the fur (the body's
// lit copy), a yellow trim stripe along the hem, a white star emblem.
// V: { body, A, B, hem: [u, v], C?, D?, top?: [u, v], star: [u, v], k? } — angles are the body
// ellipse's parametric angles, [u, v] in unit-ellipse coordinates.
const VEST_PAD = 1.5;
function vestFrame(V, pad = VEST_PAD) {
  const [cx, cy, rx0, ry0, rot = 0] = V.body.e;
  const rx = rx0 + pad, ry = ry0 + pad;
  const c = Math.cos(rot), s = Math.sin(rot);
  const M = (u, v) => [cx + u * rx * c - v * ry * s, cy + u * rx * s + v * ry * c];
  return { cx, cy, rx, ry, rot, M, E: (t) => M(Math.cos(t), Math.sin(t)) };
}
function vestPath(ctx, V) {
  const F = vestFrame(V);
  const arc = (a, b) => ctx.ellipse(F.cx, F.cy, F.rx, F.ry, F.rot, a, b, b < a);
  const p0 = F.E(V.A), q = F.M(V.hem[0], V.hem[1]);
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
  arc(V.A, V.B);
  if (V.C === undefined) ctx.quadraticCurveTo(q[0], q[1], p0[0], p0[1]);
  else {
    const pc = F.E(V.C), q2 = F.M(V.top[0], V.top[1]);
    ctx.quadraticCurveTo(q[0], q[1], pc[0], pc[1]);
    arc(V.C, V.D);
    ctx.quadraticCurveTo(q2[0], q2[1], p0[0], p0[1]);
  }
  ctx.closePath();
  return F;
}
// is angle a inside the arc from -> to (direction given by the sign of to - from)?
function inArc(a, from, to, margin = 0) {
  const lo = Math.min(from, to) - margin, hi = Math.max(from, to) + margin;
  const x = lo + normA(a - lo);
  return x <= hi;
}
// body tufts that the vest covers are dropped so no fur pokes through the garment edge
function vestTufts(sh, V) {
  if (!sh.tufts || !sh.tufts.length) return sh;
  const keep = sh.tufts.filter((tf) => !(inArc(tf.a, V.A, V.B, tf.w + 0.05) || (V.C !== undefined && inArc(tf.a, V.C, V.D, tf.w + 0.05))));
  return keep.length === sh.tufts.length ? sh : { e: sh.e, tufts: keep };
}
function drawVest(ctx, P, pal, V) {
  if (P.suit !== 'space' || !V) return;
  const k = V.k ?? 1.15;
  ctx.save();
  const F = vestPath(ctx, V);
  ctx.clip();
  ctx.fillStyle = pal.vestDark; ctx.fill();
  // lit part = the body's lit copy (same crescent as the fur underneath)
  const [cx, cy, rx, ry, rot = 0] = V.body.e;
  const d = SH_D * k;
  ctx.beginPath(); ctx.ellipse(cx - SH_S * k * P.lx, cy - SH_S * k, Math.max(1, rx - d), Math.max(1, ry - d), rot, 0, TAU);
  ctx.fillStyle = pal.vest; ctx.fill();
  const [hx, hy] = rot2(-rx * 0.45 * P.lx, -ry * 0.55, rot); // same sheen spot as the fur highlight
  highlight(ctx, cx + hx, cy + hy, rx * 0.2, 5, -0.35 * P.lx + rot, 0.35 * (1 - P.silhouette), pal.hi);
  // trim stripe just inside the hem (extended past the ends; the clip trims it)
  const h0 = F.E(V.B), hq = F.M(V.hem[0], V.hem[1]), h1 = F.E(V.C === undefined ? V.A : V.C);
  const st = V.star ? F.M(V.star[0], V.star[1]) : F.M(0.3, 0);
  let nx = -(h1[1] - h0[1]), ny = h1[0] - h0[0];
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  if ((st[0] - hq[0]) * nx + (st[1] - hq[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const t0 = unit(hq, h0), t1 = unit(hq, h1);
  const off = 7.5, ext = 14;
  ctx.beginPath();
  ctx.moveTo(h0[0] + t0[0] * ext + nx * off, h0[1] + t0[1] * ext + ny * off);
  ctx.quadraticCurveTo(hq[0] + nx * off, hq[1] + ny * off, h1[0] + t1[0] * ext + nx * off, h1[1] + t1[1] * ext + ny * off);
  ctx.lineCap = 'butt'; ctx.lineWidth = 4; ctx.strokeStyle = pal.vestTrim; ctx.stroke();
  ctx.restore();
  vestPath(ctx, V); strokeInk(ctx, Math.max(4.5, P.lwO * 0.85));
  if (!V.star) return;
  // star emblem
  softStarPath(ctx, st[0], st[1], 12, 6.5, 5, -Math.PI / 2 + (V.starRot || 0));
  ctx.fillStyle = pal.vestStar; ctx.fill(); strokeInk(ctx, 3.5);
  ctx.fillStyle = rgba(pal.hi, 0.6 * (1 - P.silhouette)); circlePath(ctx, st[0] - 3 * P.lx, st[1] - 3, 1.8); ctx.fill();
}
function drawTetherRing(ctx, P, pal, x, y) {
  if (P.suit !== 'space') return;
  ctx.beginPath(); ctx.ellipse(x, y - 7, 7, 8, 0, Math.PI * 0.9, Math.PI * 2.1);
  ctx.lineWidth = 4.5 + 2 * 3; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
  ctx.lineWidth = 4.5; ctx.strokeStyle = pal.steel; ctx.stroke();
}

function drawBodyUnion(ctx, P, pal, shapes, V) {
  const vest = P.suit === 'space' && V;
  const sh = vest ? [vestTufts(shapes[0], V), ...shapes.slice(1)] : shapes;
  const b = shapes[0].e;
  shadedUnion(ctx, sh, pal.fur, pal.furShade, P.lx, { k: 1.15, lw: P.lwO, pal, blots: sootBlots(P, b, 3, 67) });
  const [hx, hy] = rot2(-b[2] * 0.45 * P.lx, -b[3] * 0.55, b[4]);
  highlight(ctx, b[0] + hx, b[1] + hy, b[2] * 0.2, 5.5, -0.35 * P.lx + b[4], pal.hiA, pal.hi);
  if (vest) drawVest(ctx, P, pal, V);
  rimArc(ctx, P, b);
}
function drawHaunch(ctx, P, pal, sh) {
  shadedUnion(ctx, [sh], pal.fur, pal.furShade, P.lx, { k: 0.9, lw: P.lwO, pal, blots: sootBlots(P, sh.e, 1, 71 + Math.round(sh.e[0])) });
  rimArc(ctx, P, sh.e, 4, 0.6);
}

// ---------------------------------------------------------------- transforms
// Pivot for tilt: the ground point (contract default) or the body centre (pivot: 'center').
const pivotY = (P, s) => (P.pivot === 'center' ? -66 * s * P.squash : 0);
function applyRoot(ctx, x, y, s, P) {
  const pv = pivotY(P, s);
  ctx.translate(x, y + pv);
  if (P.tilt) ctx.rotate(P.tilt);
  if (pv) ctx.translate(0, -pv);
  const sy = P.squash, sx = 1 / sy;
  ctx.scale(s * P.facing * sx, s * sy);
}

function drawHeadAt(ctx, P, pal, hx, hy, rot, isBack) {
  ctx.save();
  ctx.translate(hx, hy);
  if (rot) ctx.rotate(rot);
  const g = isBack ? headBack(ctx, P, pal) : headFront(ctx, P, pal);
  ctx.restore();
  return g;
}

// ---------------------------------------------------------------- public API
// Effective on-screen scale of the current transform × s. Drives level of detail:
//   small: 0 at normal sizes → 1 when the dog is tiny on screen (wide shots): faces a little bolder.
//   lwO:   outline floor — silhouette strokes (unions, limbs, paws, ears, tail, glass) never drop
//          below ~4 px on screen: lwO = LW·clamp(4 / (LW·eff), 1, 2). Interior face lines stay LW.
function applyLod(ctx, s, P) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const eff = (m ? Math.hypot(m.a, m.b) : 1) * Math.abs(s);
  P.small = clamp((0.55 - eff) / 0.3);
  P.lwO = eff > 0 ? LW * clamp(4 / (LW * eff), 1, 2) : LW;
  P.lwX = P.lwO - LW;
}

function sootRimOf(P, pal) {
  const k = clamp((P.soot - 0.35) / 0.5) * (1 - P.silhouette);
  P.sootRim = k > 0.02 ? rgba(pal.sootLine, 0.9 * k) : null;
}

export function drawDog(ctx, x, y, s = 1, pose = {}) {
  const P = resolvePose(pose);
  applyLod(ctx, s, P);
  const pal = palette(P);
  sootRimOf(P, pal);
  ctx.save();
  applyRoot(ctx, x, y, s, P);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (P.view === 'back') drawBack(ctx, P, pal);
  else drawFront(ctx, P, pal);
  ctx.restore();
}

// Helmet neck-ring tilt (head space): square to the neck (neck blob → head centre), gently clamped.
function ringTiltOf(R, hr) {
  const nk = R.shapes[1];
  if (!nk) return 0;
  const vx = nk.e[0] - R.head[0], vy = nk.e[1] - R.head[1];
  return clamp((Math.atan2(-vx, vy) - hr) * 0.9, -0.45, 0.45);
}
function drawFront(ctx, P, pal) {
  const R = rigFront(P);
  for (const L of R.legs) L.lx = P.lx;
  const hr = R.headRot + P.headTilt;
  P.ringTilt = ringTiltOf(R, hr);
  if (R.tail.layer === 'back') drawTail(ctx, R.tail, P, pal);
  for (const L of R.legs) if (L.layer === 'back' && L.far) drawLeg(ctx, L, pal, P);
  for (const f of R.feet) if (f.far) drawPaw(ctx, f.x, f.y, 0, { far: true, long: f.long }, pal, P);
  for (const L of R.legs) if (L.layer === 'back' && !L.far) drawLeg(ctx, L, pal, P);
  drawBodyUnion(ctx, P, pal, R.shapes, R.vest);
  if (R.ring) drawTetherRing(ctx, P, pal, R.ring[0], R.ring[1]);
  for (const f of R.feet) if (!f.far) drawPaw(ctx, f.x, f.y, 0, { far: false, long: f.long }, pal, P);
  if (R.haunch) drawHaunch(ctx, P, pal, R.haunch);
  if (R.frontPaws) for (const f of R.frontPaws) drawPaw(ctx, f.x, f.y, 0, { far: f.far }, pal, P);
  for (const L of R.legs) if (L.layer === 'mid') drawLeg(ctx, L, pal, P);
  // collar in head space
  ctx.save(); ctx.translate(R.head[0], R.head[1]); ctx.rotate(hr); drawCollar(ctx, P, pal, false); ctx.restore();
  drawHeadAt(ctx, P, pal, R.head[0], R.head[1], hr, false);
  if (R.tail.layer === 'front') drawTail(ctx, R.tail, P, pal);
  for (const L of R.legs) if (L.pawFront) drawPaw(ctx, L.foot[0], L.foot[1], L.pawAng || 0, { ...L, pawFront: false }, pal, P);
  for (const L of R.legs) if (L.layer === 'front') drawLeg(ctx, L, pal, P);
}

function drawBack(ctx, P, pal) {
  const R = rigBack(P);
  for (const L of R.legs) L.lx = P.lx;
  const hr = R.headRot + P.headTilt;
  if (R.tail.layer === 'back') drawTail(ctx, R.tail, P, pal);
  if (R.headFirst) { // standing, seen from behind: the neck (and collar) is hidden by the body
    drawHeadAt(ctx, P, pal, R.head[0], R.head[1], hr, true);
  }
  for (const L of R.legs) if (L.far) drawLeg(ctx, L, pal, P);
  for (const L of R.legs) if (!L.far) drawLeg(ctx, L, pal, P);
  for (const f of R.feet) drawPaw(ctx, f.x, f.y, f.flip < 0 ? Math.PI : 0, { far: false, long: 1.05 }, pal, P);
  drawBodyUnion(ctx, P, pal, R.shapes, R.vest);
  for (const h of R.haunches) drawHaunch(ctx, P, pal, h);
  if (R.ring) drawTetherRing(ctx, P, pal, R.ring[0], R.ring[1]);
  if (!R.headFirst) {
    ctx.save(); ctx.translate(R.head[0], R.head[1]); ctx.rotate(hr); drawCollar(ctx, P, pal, true); ctx.restore();
    drawHeadAt(ctx, P, pal, R.head[0], R.head[1], hr, true);
  }
  if (R.tail.layer === 'front') drawTail(ctx, R.tail, P, pal);
}

export function drawDogHead(ctx, x, y, s = 1, pose = {}) {
  const P = resolvePose(pose);
  applyLod(ctx, s, P);
  const pal = palette(P);
  sootRimOf(P, pal);
  ctx.save();
  ctx.translate(x, y);
  const rot = (pose.tilt || 0) + P.headTilt;
  if (rot) ctx.rotate(rot);
  const sy = P.squash;
  ctx.scale(s * P.facing / sy, s * sy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const isBack = P.view === 'back';
  if (P.neck !== false) {
    // a little chest/neck stub so the head sits on something in close-ups
    const stub = { e: [isBack ? 0 : -4, 84, 54, 42, 0], tufts: tufts(isBack ? [] : [[-0.35, 0.14, 10, 0.5, 0.3], [-0.05, 0.13, 8, 0.5, 0.3], [3.5, 0.12, 7, -0.5, 0.3]], P.frizz, 51, 14) };
    const V = { body: stub, A: -0.1, B: Math.PI + 0.1, hem: [0, 0.22], star: [isBack ? 0 : 0.12, 0.5] };
    drawBodyUnion(ctx, P, pal, [stub], P.suit === 'space' ? V : null);
  }
  drawCollar(ctx, P, pal, isBack);
  if (isBack) headBack(ctx, P, pal); else headFront(ctx, P, pal);
  ctx.restore();
}

// Approximate world positions of useful points: { head, mouth, tail } ([x, y] each).
export function dogAnchors(x, y, s = 1, pose = {}) {
  const P = resolvePose(pose);
  const sy = P.squash, sx = 1 / sy;
  const pv = pivotY(P, s);
  const toWorld = ([lx, ly]) => {
    const px = lx * s * P.facing * sx, py = ly * s * sy - pv;
    const [rx, ry] = rot2(px, py, P.tilt);
    return [x + rx, y + pv + ry];
  };
  let R, g;
  if (P.view === 'back') { R = rigBack(P); g = { px: 0, py: 20 }; }
  else { R = rigFront(P); g = headGeo(P); }
  const hr = R.headRot + P.headTilt;
  const hp = (lx, ly) => { const [qx, qy] = rot2(lx, ly, hr); return [R.head[0] + qx, R.head[1] + qy]; };
  let tail;
  if (R.tail.pts) tail = R.tail.pts[R.tail.pts.length - 1];
  else { const sp = spineFrom(R.tail.base[0], R.tail.base[1], R.tail.ang, R.tail.len, R.tail.curl, 10); tail = sp[sp.length - 1]; }
  return {
    head: toWorld(R.head),
    mouth: toWorld(hp(P.view === 'back' ? 0 : g.px - 2, P.view === 'back' ? 20 : g.py + 5)),
    tail: toWorld(tail),
    crown: toWorld(hp(0, -48)),
  };
}
