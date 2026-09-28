// The backyard world — Juno's back garden, where the film starts (golden hour test launch)
// and ends (night, lying on the lawn under the stars).
//
//   drawBackyard(ctx, o)        side view in WORLD coords (wrap in camera()); ground line y = 860
//   drawGarageDoor(ctx, o)      just the roll-up door panel, for layering a rocket inside the barn
//   longShadow(ctx, x, gy, w, h, o)  the set's cast shadow, for characters / rockets
//   todTint(tod), tintColor(hex, tint, k)  the time-of-day grade, for characters / rockets
//   drawBird(ctx, x, y, s, o)   a fence bluebird (perched or flying) for flocks
//   drawWorkshop(ctx, o)        s04: full-frame workshop interior (SCREEN coords) + WORKSHOP layout
//   drawStepladder / drawPaintCan  s04 props (+ STEPLADDER / PAINT_CAN dimensions)
//   drawLawnTopDown(ctx, o)     full-frame top-down lawn + picnic blanket (final stargazing shot)
//   BACKYARD                    where everything is (world coords)
//
// All colours pass through a per-call "look" (time-of-day tint + silhouette mix), so the
// same scenery reads as golden hour, day, dusk or moonlit night.
//
// Performance notes (this Skia build, measured with a forced flush): gradients, AA clip masks and
// frame-wide multi-contour strokes are the expensive things. So: skies/lawns are opaque colour
// bands, glows are flat stepped discs (small ones use glow()), the fence is axis-aligned rects
// with an ink underlay, shading never uses clip(), and everything is culled to the view rect and
// against the big opaque set pieces (house, barn, doghouse, crates).
import {
  W, H, INK, LW, FONT, circle, ellipse, rrect, circlePath, ellipsePath, rrectPath, blobs, clipBlobs,
  glow, sparkle, ink, smoothPath,
} from '../draw.js';
import { TAU, clamp, lerp, hash01, noise1, mixColor, rgba, hexToRgb, rgbToHex, ease, smoothstep, fract } from '../util.js';
import { sway, pulse, beatAt, hat } from '../timing.js';

// ---------------------------------------------------------------- layout (world coords)
const GY = 860;
const XL = -460, XR = 2380; // scenery extent (a bit beyond the contract range [-400, 2320])
const FENCE = { base: 772, h: 200 };
const HOUSE = { L: -470, R: 250, base: 864, eave: 474, ridge: 244 };
const TREE = { x: 250, base: 872, cx: 262, cy: 318 };
const DOGH = { x: 860, base: 818 };
// Tall gambrel workshop barn: the door opening (440 x 640) takes the S.S. Biscuit at s = 0.84.
const GARAGE = {
  L: 1540, R: 2140, cx: 1840, base: 800, eave: 120, knee: 4, kneeIn: 84, peak: -66,
  doorL: 1620, doorR: 2060, doorTop: 160, panels: 11,
};
const PAD = { x: 1240, cw: 122, ch: 104, gap: 4 };
const GNOME = { x: 1470, base: 846 };
const SWING = { ax: 456, ay: 540, len: 205 };
const LWB = LW * 0.8; // set pieces behind the action (house, barn, tree, doghouse, gnome) draw lighter

export const BACKYARD = {
  groundY: GY,
  x0: -400, x1: 2320,
  padX: PAD.x, padTop: GY - PAD.ch, padW: PAD.cw * 2 + PAD.gap,
  craterX: 1240, craterY: 868,
  garageX: GARAGE.cx, garageBase: GARAGE.base, garageL: GARAGE.L, garageR: GARAGE.R, garagePeak: GARAGE.peak,
  garageDoor: { x0: GARAGE.doorL, x1: GARAGE.doorR, top: GARAGE.doorTop, bottom: GARAGE.base },
  houseX: (HOUSE.L + HOUSE.R) / 2, houseRight: HOUSE.R, houseDoorX: -120, houseWindowX: 110,
  treeX: TREE.x, swingX: SWING.ax,
  doghouseX: DOGH.x, doghouseBase: DOGH.base,
  gnomeX: GNOME.x,
  fenceBase: FENCE.base, fenceTop: FENCE.base - FENCE.h,
  horizonY: 560,
  birds: [[692, 1], [736, -1], [1012, 1]], // perch x on the fence top, facing
};

// ---------------------------------------------------------------- colours
const BASE = {
  lawnBack: '#a3d86f', lawn: '#72c35a', lawnFront: '#5aae4f', lawnDeep: '#43924a',
  patchL: '#86d066', patchD: '#5aa94f', tuft: '#4aa84b', tuftBack: '#5fb152', tuftLine: '#2f7a3c',
  daisy: '#fffaf0', daisyC: '#ffd23f',
  soil: '#8a5a3b', soilShade: '#6b4430', soilLight: '#a8734c',
  stone: '#c3bdc9', stoneShade: '#9c95a8',
  fence: '#e0af72', fence2: '#d6a164', fenceShade: '#b8844f', fenceGrain: '#bb8751', rail: '#cc975b', railShade: '#a4723f',
  wall: '#f6cf6a', wallShade: '#dcad4a', wallLine: '#e5bb58', trim: '#fff6e2', trimShade: '#e2d4ba',
  roof: '#5f6cab', roofShade: '#48538e', roofLine: '#4b5695', roofLight: '#8190cc',
  door: '#e0503f', doorShade: '#b73c2f', brass: '#f6b93b',
  glass: '#bfe6ff', glassShade: '#93c6ea', curtain: '#ff8fb1', curtainShade: '#e06a92',
  brick: '#c8664a', brickShade: '#a14c36', concrete: '#cbc6d2', concreteShade: '#a8a2b4',
  metal: '#aab3c4', metalShade: '#7b8499',
  bark: '#94603c', barkShade: '#6e452b', barkLine: '#5e3b27',
  leaf: '#4fae57', leafShade: '#3a8a48', leafLight: '#86d46c', leafDot: '#3a8f47',
  rope: '#e3bb74', tire: '#3f3d4f', tireLight: '#67657f',
  gwall: '#5fb1b9', gwallShade: '#468d97', gline: '#52a0a9', gdoor: '#f4ebd8', gdoorShade: '#d9ccb2', gdoorLine: '#c7b99c',
  sign: '#fff1d6', signInk: '#e8453c',
  dwall: '#e3a55e', dwallShade: '#bf8141', dline: '#c98d4a', droof: '#e8453c', droofShade: '#b52d2d', droofLight: '#ff8272',
  hole: '#2a1f2e', bowl: '#3a86ff', bowlShade: '#2a62c0', kibble: '#a0622f', bone: '#fff1d6', boneShade: '#e3d0ae',
  gHat: '#e8453c', gHatShade: '#b52d2d', gBeard: '#fffaf0', gBeardShade: '#dcd2c4', gSkin: '#f2c49b', gSkinShade: '#d9a37a',
  gCoat: '#3a86ff', gCoatShade: '#2a62c0', gBoot: '#8a5a3b', gBelt: '#3b2a2a', gNose: '#ff8f80',
  f1: '#ff7eb6', f2: '#ffd23f', f3: '#e8453c', f4: '#b48cff', f5: '#fffaf0', f6: '#ff9a3d', stem: '#3f8f46', stemLeaf: '#56ad4f',
  crate: '#dca865', crateLight: '#f3cb8b', crateShade: '#b27c40', crateFrame: '#c68d4d', crateStencil: '#9a3b2c', char: '#2f2830',
  bird: '#5b8ee6', birdShade: '#3f6cc0', birdBelly: '#ffe0b0', beak: '#ffb13b',
  dark: '#2a2338', darkWall: '#3b3149', peg: '#80604a', pegDot: '#5d4434', tool: '#1f1a28', bench: '#8f5a33', benchShade: '#6b4430',
  hillFar: '#94d27c', hillNear: '#6fbd64', hillTree: '#4f9f55',
};
const WARM = '#ffd98a';
const WARM2 = '#ffb45c';
const SIL = { near: '#0c0a1e', far: '#1f1b48', mid: '#15122f' };

// Time-of-day looks. sky stops span world y 0 (offset 0) .. 780 (offset 1).
const TOD = {
  day: {
    sky: [[0, '#3f96e3'], [0.55, '#7cc5f1'], [1, '#d2f0ff']], high: '#2b58bd', space: '#161454',
    mul: null, add: '#ffffff', addAmt: 0,
    haze: '#cdeeff', hazeFar: 0.45, hazeNear: 0.24,
    sun: { x: 560, y: 150, r: 60, core: '#fffbe8', rim: '#ffe57a', glow: '#fff4b0', glowR: 420, glowA: 0.6, rays: 0 },
    cloud: { fill: '#ffffff', shade: '#d6e6f5' },
    lowClouds: [[1180, 190, 300, 110, 3], [1760, 280, 230, 84, 8], [-160, 230, 260, 96, 5], [2300, 150, 280, 100, 11]],
    shadow: { col: '#24493a', a: 0.24, k: 0.14 },
    lights: 0, stars: 0,
  },
  golden: {
    sky: [[0, '#e8789f'], [0.42, '#ff9c7a'], [0.78, '#ffc98a'], [1, '#ffe3a3']], high: '#8a4fa6', space: '#241a5c',
    mul: '#ffe6c8', add: '#ff9a55', addAmt: 0.07,
    haze: '#ffcf98', hazeFar: 0.56, hazeNear: 0.32,
    sun: { x: 650, y: 470, r: 84, core: '#fff9df', rim: '#ffd06a', glow: '#ffd88c', glowR: 780, glowA: 0.72, rays: 1 },
    cloud: { fill: '#ffe4d2', shade: '#f2a494' },
    lowClouds: [[1260, 250, 360, 84, 4], [-120, 190, 300, 76, 9], [2020, 170, 260, 70, 6]],
    shadow: { col: '#6a2c62', a: 0.34, k: 1.25 },
    lights: 0.15, stars: 0,
  },
  dusk: {
    sky: [[0, '#2a2468'], [0.42, '#784a9a'], [0.76, '#ef7a78'], [1, '#ffb877']], high: '#1d1a52', space: '#0e0b26',
    mul: '#d9b6df', add: '#4a3a8a', addAmt: 0.1,
    haze: '#c77da2', hazeFar: 0.55, hazeNear: 0.33,
    sun: { x: 860, y: 590, r: 108, core: '#ffeaa8', rim: '#ff9e5a', glow: '#ff9a6a', glowR: 820, glowA: 0.7, rays: 0.45 },
    cloud: { fill: '#f2a6bf', shade: '#9a68ab' },
    lowClouds: [[1300, 300, 380, 76, 4], [-60, 250, 300, 70, 9]],
    shadow: { col: '#24153f', a: 0.3, k: 1.5 },
    lights: 0.85, stars: 0.35,
  },
  night: {
    sky: [[0, '#0a0e34'], [0.5, '#15215b'], [1, '#2c3f7e']], high: '#090b2c', space: '#06061a',
    mul: '#6a7cc6', add: '#1c2764', addAmt: 0.14,
    haze: '#2c3f7e', hazeFar: 0.45, hazeNear: 0.2,
    moon: { x: 1230, y: 150, r: 60 },
    cloud: { fill: '#3a4884', shade: '#262f68' },
    lowClouds: [[1060, 330, 320, 66, 4], [2150, 250, 260, 60, 7]],
    shadow: { col: '#040618', a: 0.3, k: 0.12 },
    lights: 1, stars: 1,
  },
};

function mulC(a, m) {
  const A = hexToRgb(a), M = hexToRgb(m);
  return rgbToHex([(A[0] * M[0]) / 255, (A[1] * M[1]) / 255, (A[2] * M[2]) / 255]);
}
const todKey = (tod) => (TOD[tod] ? tod : 'golden');

/**
 * todTint(tod) -> { tod, mul, add, addAmt, shadow, shadowA, rim }
 * The exact time-of-day grade every backyard colour goes through (multiply by `mul`, then mix
 * toward `add` by `addAmt`). Characters, dog and rockets use it (via tintColor) so they sit in
 * the same light as the set. `shadow`/`shadowA` = cast-shadow colour/alpha, `rim` = a light-source
 * colour for optional rim highlights. 'day' is the identity grade (mul '#ffffff', addAmt 0).
 */
export function todTint(tod) {
  const T = TOD[todKey(tod)];
  const rim = T.sun ? T.sun.glow : '#cfe0ff';
  return { tod: todKey(tod), mul: T.mul || '#ffffff', add: T.add, addAmt: T.addAmt, shadow: T.shadow.col, shadowA: T.shadow.a, rim };
}
/** tintColor(hex, tint, k = 1): apply a todTint() grade to one '#rrggbb' colour; k 0..1 blends it in. */
export function tintColor(hex, tint, k = 1) {
  if (!tint || k <= 0) return hex;
  let x = tint.mul && tint.mul !== '#ffffff' ? mulC(hex, tint.mul) : hex;
  if (tint.addAmt) x = mixColor(x, tint.add, tint.addAmt);
  return k >= 1 ? x : mixColor(hex, x, k);
}

// Build the per-call look: tinted palette C, ink colour, helpers.
function look(o) {
  const tod = todKey(o.tod);
  const T = TOD[tod];
  const sil = clamp(o.silhouette || 0);
  const tint = (c) => {
    let x = T.mul ? mulC(c, T.mul) : c;
    if (T.addAmt) x = mixColor(x, T.add, T.addAmt);
    return x;
  };
  const C = {};
  for (const k in BASE) {
    const c = tint(BASE[k]);
    C[k] = sil ? mixColor(c, SIL.near, sil) : c;
  }
  const farC = (c, haze, s = SIL.far) => { const x = mixColor(tint(c), T.haze, haze); return sil ? mixColor(x, s, sil) : x; };
  const farInk = (haze, s = SIL.far) => { const x = mixColor(INK, T.haze, haze); return sil ? mixColor(x, s, sil) : x; };
  return {
    tod, T, C, sil, farC, farInk, tint,
    inkC: sil ? mixColor(INK, SIL.near, sil) : INK,
    t: o.t || 0,
    wind: clamp(o.wind || 0), wd: o.windDir === undefined ? -1 : Math.sign(o.windDir) || -1,
    lights: clamp(o.lights === undefined ? T.lights : o.lights),
    ext: clamp(o.skyExtend || 0, 0, 6000),
    glowK: 1 - sil,
    night: tod === 'night' ? 1 : tod === 'dusk' ? 0.4 : 0,
    V: { x0: XL - 900, x1: XR + 900, y0: -7000, y1: 2400 },
    M: () => {},
    occ: [],
    haze: o.haze === undefined ? 0 : clamp(o.haze),
  };
}
// Light position (sun/moon, shifted by the same parallax as the sky bodies).
function lightPos(P, o) {
  const body = P.T.sun || P.T.moon;
  const pdx = o.camX === undefined ? 0 : (o.camX - 960) * 0.85, pdy = o.camY === undefined ? 0 : (o.camY - 540) * 0.85;
  P.lightX = body.x + pdx; P.lightY = body.y + pdy;
}

// Big opaque set pieces as convex polygons (world). Background details whose whole box lies
// inside one are skipped — they would be painted over anyway.
function occluders(P, o) {
  const list = [];
  if (o.garage !== false) list.push(barnFace().map(([x, y]) => [x + (x < GARAGE.cx ? 3 : -3), y + 3]));
  list.push([[HOUSE.L + 4, HOUSE.base - 2], [HOUSE.L + 4, HOUSE.ridge + 12], [96, HOUSE.ridge + 12], [HOUSE.R - 6, 426], [HOUSE.R - 6, HOUSE.base - 2]]);
  list.push([[DOGH.x - 88, DOGH.base - 2], [DOGH.x - 88, DOGH.base - 108], [DOGH.x, DOGH.base - 190], [DOGH.x + 88, DOGH.base - 108], [DOGH.x + 88, DOGH.base - 2]]);
  if ((o.pad || 'intact') === 'intact') list.push([[PAD.x - PAD.cw + 4, GY - 2], [PAD.x - PAD.cw + 4, GY - PAD.ch + 4], [PAD.x + PAD.cw - 4, GY - PAD.ch + 4], [PAD.x + PAD.cw - 4, GY - 2]]);
  return list;
}
function inConvex(poly, x, y) {
  let sgn = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % n];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c !== 0) { if (sgn === 0) sgn = Math.sign(c); else if (Math.sign(c) !== sgn) return false; }
  }
  return true;
}
const hidden = (P, x0, y0, x1, y1) => {
  for (const q of P.occ) if (inConvex(q, x0, y0) && inConvex(q, x1, y0) && inConvex(q, x0, y1) && inConvex(q, x1, y1)) return true;
  return false;
};

// World-x spans of [x0, x1] where the band yTop..yBot is NOT fully covered by an occluder
// (sampled every 16px; conservative). Used to skip hills / rails behind the house and barn.
function openSpans(P, x0, x1, yTop, yBot) {
  const spans = [];
  let start = null;
  for (let x = Math.floor(x0 / 16) * 16; x <= x1 + 16; x += 16) {
    let cov = false;
    for (const q of P.occ) if (inConvex(q, x - 16, yTop) && inConvex(q, x + 16, yTop) && inConvex(q, x - 16, yBot) && inConvex(q, x + 16, yBot)) { cov = true; break; }
    if (!cov && start === null) start = x - 16;
    if (cov && start !== null) { spans.push([Math.max(x0, start), Math.min(x1, x + 16)]); start = null; }
  }
  if (start !== null) spans.push([Math.max(x0, start), x1]);
  return spans.filter(([a, b]) => b > a);
}

// Visible world rectangle: invert the current transform on the canvas corners (+ margin).
// Every full-width fill and every scattered detail is culled to it.
function viewRect(ctx, m = 40) {
  let I;
  try { I = ctx.getTransform().inverse(); } catch (e) { return null; }
  const { a, b, c, d, e, f } = I;
  if (![a, b, c, d, e, f].every(Number.isFinite)) return null;
  const cw = (ctx.canvas && ctx.canvas.width) || W, ch = (ctx.canvas && ctx.canvas.height) || H;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) {
    const X = a * px + c * py + e, Y = b * px + d * py + f;
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
  }
  return {
    x0: Math.max(XL - 4000, x0 - m), x1: Math.min(XR + 4000, x1 + m),
    y0: Math.max(-12000, y0 - m), y1: Math.min(4000, y1 + m),
  };
}
const inV = (V, x0, y0, x1, y1) => x1 >= V.x0 && x0 <= V.x1 && y1 >= V.y0 && y0 <= V.y1;

// ---------------------------------------------------------------- small helpers
function poly(ctx, pts, close = true) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function fillPoly(ctx, pts, fill, lw, stroke) {
  ctx.beginPath(); poly(ctx, pts); ink(ctx, fill, lw, stroke);
}
// Thick strip along a polyline (miter joins, square ends) -> polygon points.
function thickStrip(pts, w) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    let nx, ny;
    const dirOf = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    if (i === 0 || i === n - 1) {
      const d = i === 0 ? dirOf(p, pts[1]) : dirOf(pts[n - 2], p);
      nx = -d[1]; ny = d[0];
    } else {
      const d1 = dirOf(pts[i - 1], p), d2 = dirOf(p, pts[i + 1]);
      const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
      let mx = n1[0] + n2[0], my = n1[1] + n2[1];
      const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const k = 1 / Math.max(0.3, mx * n1[0] + my * n1[1]);
      nx = mx * k; ny = my * k;
    }
    L.push([p[0] + (nx * w) / 2, p[1] + (ny * w) / 2]);
    R.push([p[0] - (nx * w) / 2, p[1] - (ny * w) / 2]);
  }
  return L.concat(R.reverse());
}
// Outlined limb stroke (branches, ropes, stems): ink pass then colour pass.
function limb(ctx, pts, w, fill, lw, inkC, smooth = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (smooth && pts.length > 2) {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], i === pts.length - 2 ? pts[i + 1][0] : mx, i === pts.length - 2 ? pts[i + 1][1] : my);
    }
  } else for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (lw > 0) { ctx.strokeStyle = inkC; ctx.lineWidth = w + 2 * lw; ctx.stroke(); }
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
// Union of circles / {rr} rects with one ink outline and a lower-right shade crescent, WITHOUT a
// clip (AA clip masks are the slowest thing in this Skia build): ink pass, shade pass, then the
// lit colour on copies shrunk by k*r and pulled up-left so they stay inside their own lobe.
function shapePathG(ctx, sh, grow, ox = 0, oy = 0) {
  if (Array.isArray(sh)) circlePath(ctx, sh[0] + ox, sh[1] + oy, sh[2] + grow);
  else { const [x, y, w, h, r] = sh.rr; rrectPath(ctx, x - grow + ox, y - grow + oy, w + 2 * grow, h + 2 * grow, Math.max(0, r + grow)); }
}
function shadedBlobs(ctx, shapes, fill, shadeCol, lw, inkC, k = 0.15) {
  if (lw > 0) { ctx.fillStyle = inkC; for (const sh of shapes) { shapePathG(ctx, sh, lw / 2); ctx.fill(); } }
  ctx.fillStyle = shadeCol; for (const sh of shapes) { shapePathG(ctx, sh, -lw / 2 + 0.5); ctx.fill(); }
  ctx.fillStyle = fill;
  for (const sh of shapes) {
    const r = Array.isArray(sh) ? sh[2] : Math.min(sh.rr[2], sh.rr[3]) / 2, d = k * r;
    shapePathG(ctx, sh, -lw / 2 - d, -d * 0.55, -d * 0.83); ctx.fill();
  }
}
function text(ctx, str, x, y, size, fill, rot = 0, font = FONT.hand) {
  ctx.save();
  ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = fill; ctx.fillText(str, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------- sky
function skyAt(T, alt) {
  const c = mixColor(T.sky[0][1], T.high, smoothstep(0, 2400, alt));
  return mixColor(c, T.space, smoothstep(2000, 4600, alt));
}
// Sky colour at world y (y < 0 = altitude above the frame top).
function skyColorAt(T, y) {
  if (y < 0) return skyAt(T, -y);
  const u = y / 780, st = T.sky;
  if (u <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) {
    if (u <= st[i][0]) return mixColor(st[i - 1][1], st[i][1], (u - st[i - 1][0]) / (st[i][0] - st[i - 1][0]));
  }
  return st[st.length - 1][1];
}
// Flat horizontal colour bands (opaque fills are nearly free; gradients are not). Bands are
// anchored to world y so they never crawl as the camera moves.
// World units per device pixel under the current transform (for seam-proof overlaps).
function pxSize(ctx) {
  try { const m = ctx.getTransform(); const d = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); return d > 1e-6 ? 1 / d : 1; } catch (e) { return 1; }
}
function bands(ctx, V, y0, y1, bh, colorAt) {
  y0 = Math.max(y0, V.y0); y1 = Math.min(y1, V.y1);
  if (y1 <= y0) return;
  const w = V.x1 - V.x0, ov = 2 * pxSize(ctx); // overlap >= 2 device px: no AA seams at any scale
  for (let k = Math.floor(y0 / bh), k1 = Math.ceil(y1 / bh); k < k1; k++) {
    const ya = Math.max(y0, k * bh), yb = Math.min(y1, (k + 1) * bh);
    ctx.fillStyle = colorAt((k + 0.5) * bh);
    ctx.fillRect(V.x0, ya, w, Math.min(y1, yb + ov) - ya);
  }
}
// Stars on a fixed world grid of 512px tiles: stable positions for any camera / skyExtend,
// and only visible tiles are visited. alphaAt(y) scales brightness by height.
function starTiles(ctx, P, V, y0, y1, density, seed, alphaAt, minR = 1, maxR = 3.2, big = 0.05) {
  const TS = 512, t = P.t, hp = hat(t);
  y0 = Math.max(y0, V.y0); y1 = Math.min(y1, V.y1);
  if (y1 <= y0) return;
  const n = Math.max(1, Math.round(TS * TS * density));
  ctx.save();
  ctx.fillStyle = '#fff8e2';
  for (let ty = Math.floor(y0 / TS); ty <= Math.floor(y1 / TS); ty++) {
    for (let tx = Math.floor(V.x0 / TS); tx <= Math.floor(V.x1 / TS); tx++) {
      const sd = (seed + tx * 7919 + ty * 104729) | 0;
      for (let i = 0; i < n; i++) {
        const px = (tx + hash01(i, sd)) * TS, py = (ty + hash01(i, sd + 1)) * TS;
        if (py < y0 || py > y1 || px < V.x0 || px > V.x1) continue;
        const ay = alphaAt(py);
        if (ay <= 0.01) continue;
        const r = lerp(minR, maxR, Math.pow(hash01(i, sd + 2), 2.5));
        const tw = 0.65 + 0.35 * Math.sin(t * (1.5 + hash01(i, sd + 4) * 3) + hash01(i, sd + 3) * TAU);
        const hb = hash01(i, sd + 5) < 0.3 ? hp : 0;
        const a = clamp(tw * 0.7 + hb * 0.6) * ay;
        if (hash01(i, sd + 6) < big) sparkle(ctx, px, py, r * (3.2 + 2.5 * hb), '#fff8e2', a);
        else {
          ctx.globalAlpha = a;
          const rr = r * (1 + 0.5 * hb);
          if (rr < 1.5) ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
          else { ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill(); }
        }
      }
    }
  }
  ctx.restore();
}
function drawSky(ctx, P) {
  const { T, ext, V } = P;
  const top = -ext - 700, bot = 836;
  bands(ctx, V, top, bot, V.y1 - V.y0 > 2600 ? 32 : 12, (y) => skyColorAt(T, y));
  // stars
  if (T.stars > 0) {
    starTiles(ctx, P, V, top, 660, 1 / 8500, 17, (y) => T.stars * (y < 380 ? 1 : 0.45 * (1 - (y - 380) / 280)));
  } else if (ext > 1700) {
    // stars appear as the sky deepens with altitude (tilt-up shots)
    starTiles(ctx, P, V, top, -1700, 1 / 9000, 23, (y) => 0.9 * smoothstep(-1700, -2900, y), 0.8, 3, 0.04);
  }
  // puffy clouds at altitude
  if (ext > 250) {
    const C = T.cloud;
    for (let k = 0; ; k++) {
      const yb = -380 - k * 640;
      if (yb < -ext - 200 || yb < -2900) break;
      for (let j = 0; j < 2; j++) {
        const id = k * 2 + j;
        const x = lerp(XL + 120, XR - 120, (j + hash01(id, 71)) / 2);
        const y = yb - hash01(id, 72) * 240;
        const cw = 300 + 300 * hash01(id, 73), chh = cw * (0.34 + 0.1 * hash01(id, 74));
        if (!inV(V, x - cw / 2 - 10, y - chh, x + cw / 2 + 10, y + chh)) continue;
        puff(ctx, x, y, cw, chh, { seed: 30 + id, fill: C.fill, shadow: C.shade, lw: LW });
      }
    }
  }
}

// Puffy cartoon cloud (same recipe as draw.js cloud(), but clip-free: the underside shade is an
// inset rounded rect inside the flat base, the highlight sits inside the top lobe).
function puff(ctx, x, y, w, h, { seed = 1, fill = '#ffffff', shadow = '#d7e6f5', lw = LW, inkC = INK } = {}) {
  const n = 4 + Math.floor(hash01(seed, 3) * 3);
  const shapes = [];
  const baseH = h * 0.42, baseY = y + h / 2 - baseH;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const cx = x - w / 2 + w * (0.16 + 0.68 * u);
    const bump = Math.sin(u * Math.PI);
    const r = h * (0.26 + 0.26 * bump) * (0.85 + 0.3 * hash01(i, seed));
    shapes.push([cx, baseY + baseH * 0.35 - r * (0.35 + 0.55 * bump), r]);
  }
  shapes.push({ rr: [x - w / 2, baseY, w, baseH, baseH / 2] });
  blobs(ctx, shapes, fill, lw, inkC);
  const ins = lw / 2 + 1;
  rrect(ctx, x - w / 2 + ins + baseH * 0.12, baseY + baseH * 0.5, w - 2 * ins - baseH * 0.24, baseH * 0.5 - ins, (baseH * 0.5 - ins) / 2, shadow, 0);
  const top = shapes[Math.floor(n / 2)];
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ellipsePath(ctx, top[0] - top[2] * 0.3, top[1] - top[2] * 0.45, top[2] * 0.35, top[2] * 0.18, -0.4); ctx.fill();
}

// Flat stepped halo (cartoon glow rings) — a fraction of the cost of a radial gradient.
function halo(ctx, x, y, r, color, a, steps = 4, inner = 0.35) {
  if (a <= 0 || r <= 0) return;
  for (let i = 0; i < steps; i++) {
    const f = 1 - (i / Math.max(1, steps - 1)) * (1 - inner);
    ctx.fillStyle = rgba(color, (a / steps) * 1.6 * (i === 0 ? 0.5 : 1)); // softer outer edge
    circlePath(ctx, x, y, r * f); ctx.fill();
  }
}
function drawSun(ctx, P) {
  const s = P.T.sun, t = P.t;
  const k = 1 - 0.6 * P.sil;
  const bp = pulse(t, 3);
  if (s.rays > 0) {
    // flat single-colour ray wedges (two lengths = a stepped fade), rotating with the beat
    const n = 16, rot = beatAt(t) * 0.025;
    for (const [R, al] of [[s.r * 7.6, 0.15]]) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU, hw = i % 2 ? 0.05 : 0.085;
        ctx.moveTo(s.x + Math.cos(a) * s.r * 1.1, s.y + Math.sin(a) * s.r * 1.1);
        ctx.lineTo(s.x + Math.cos(a - hw) * R, s.y + Math.sin(a - hw) * R);
        ctx.lineTo(s.x + Math.cos(a + hw) * R, s.y + Math.sin(a + hw) * R);
        ctx.closePath();
      }
      ctx.fillStyle = rgba(s.glow, al * s.rays * k * (1 + 0.3 * bp)); ctx.fill();
    }
  }
  halo(ctx, s.x, s.y, Math.min(350, s.glowR * 0.5) * (1 + 0.03 * bp), s.glow, s.glowA * 0.3 * k, 3, 0.36);
  circle(ctx, s.x, s.y, s.r * 1.2, rgba(s.rim, 0.35 * k), 0);
  circle(ctx, s.x, s.y, s.r, mixColor(s.rim, SIL.far, P.sil * 0.5), 0);
  circle(ctx, s.x - s.r * 0.1, s.y - s.r * 0.1, s.r * 0.8, mixColor(s.core, SIL.far, P.sil * 0.5), 0);
}

function crescentPath(ctx, x, y, r, dx, dy, r2) {
  const d = Math.hypot(dx, dy), phi = Math.atan2(dy, dx);
  const al = Math.acos(clamp((d * d + r * r - r2 * r2) / (2 * d * r), -1, 1));
  const cx2 = x + dx, cy2 = y + dy;
  const p1 = [x + r * Math.cos(phi + al), y + r * Math.sin(phi + al)];
  const p2 = [x + r * Math.cos(phi - al), y + r * Math.sin(phi - al)];
  const b1 = Math.atan2(p1[1] - cy2, p1[0] - cx2), b2 = Math.atan2(p2[1] - cy2, p2[0] - cx2);
  ctx.beginPath();
  ctx.arc(x, y, r, phi + al, phi - al + TAU, false);
  ctx.arc(cx2, cy2, r2, b2, b1, true);
  ctx.closePath();
}
function drawMoon(ctx, P) {
  const m = P.T.moon, t = P.t;
  halo(ctx, m.x, m.y, 200 * (1 + 0.04 * pulse(t, 3)), '#bcd0ff', 0.085, 4, 0.45);
  glow(ctx, m.x, m.y, 100, '#fff6d0', 0.32);
  const dx = m.r * 0.46, dy = -m.r * 0.26, r2 = m.r * 0.9;
  crescentPath(ctx, m.x, m.y, m.r, dx, dy, r2);
  ink(ctx, '#fff3c4', LW * 0.8, INK);
  ctx.save();
  crescentPath(ctx, m.x, m.y, m.r - 2, dx, dy, r2 + 2); ctx.clip();
  // soft shade along the inner edge + craters
  ctx.fillStyle = '#efd997';
  circlePath(ctx, m.x - m.r * 0.18, m.y + m.r * 0.5, m.r * 0.42); ctx.fill();
  ctx.fillStyle = '#e8d18e';
  ellipsePath(ctx, m.x - m.r * 0.62, m.y - m.r * 0.05, 7, 9); ctx.fill();
  ellipsePath(ctx, m.x - m.r * 0.35, m.y - m.r * 0.52, 5, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ellipsePath(ctx, m.x - m.r * 0.72, m.y - m.r * 0.36, 4, 9, 0.5); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- far layers (parallax)
const hillFar = (x) => 492 - 40 * Math.sin(x * 0.0022 + 0.8) - 24 * Math.sin(x * 0.0051 + 2.1) - 9 * Math.sin(x * 0.013 + 0.3);
const hillNear = (x) => 548 - 30 * Math.sin(x * 0.0031 + 2.6) - 16 * Math.sin(x * 0.0072 + 1.2) - 6 * Math.sin(x * 0.019);

// Hill band over the visible x-range only, filled down to `bottom` (local coords); the ink runs
// along the crest only (the sides/bottom are hidden behind the fence anyway).
function hill(ctx, f, x0, x1, bottom, fill, lw, inkC) {
  const a = Math.floor(x0 / 32) * 32, b = Math.ceil(x1 / 32) * 32;
  ctx.beginPath();
  ctx.moveTo(a, bottom);
  for (let x = a; x <= b; x += 32) ctx.lineTo(x, f(x));
  ctx.lineTo(b, bottom);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath();
  for (let x = a; x <= b; x += 32) x === a ? ctx.moveTo(x, f(x)) : ctx.lineTo(x, f(x));
  ctx.lineWidth = lw; ctx.strokeStyle = inkC; ctx.stroke();
}

const NB_HOUSES = [
  { x: -250, w: 330, yb: 590, rh: 128, wall: '#f2a7a0', roof: '#8d6a9c', type: 'gable', chim: 60, win: 1 },
  { x: 590, w: 300, yb: 596, rh: 96, wall: '#a6cde8', roof: '#b3604e', type: 'hip', chim: -70, win: 0 },
  { x: 1150, w: 250, yb: 596, rh: 84, wall: '#f5e0a8', roof: '#6b7aa8', type: 'hip', chim: 0, win: 0 },
  { x: 1440, w: 330, yb: 588, rh: 122, wall: '#f5e0a8', roof: '#7b5f93', type: 'gable', chim: -80, win: 1 },
  { x: 2290, w: 320, yb: 594, rh: 104, wall: '#b8e0c4', roof: '#a4564a', type: 'hip', chim: 70, win: 0 },
];
const NB_TREES = [
  [-560, 470, 88, 0], [80, 500, 76, 0], [370, 488, 70, 1], [860, 470, 84, 0], [985, 452, 40, 2], [1680, 468, 86, 0],
  [1880, 494, 70, 1], [2060, 440, 42, 2], [2560, 480, 84, 0], [-10, 450, 40, 2],
];

function drawNeighbours(ctx, P, L, bottom, ddx, ddy) {
  const { t } = P;
  const hz = 0.2;
  const ol = P.farInk(0.35, SIL.mid), lw = LW * 0.75;
  // trees behind the houses
  for (let i = 0; i < NB_TREES.length; i++) {
    const [x, y, r, kind] = NB_TREES[i];
    if (!inV(L, x - r * 1.8, y - r * 1.9, x + r * 1.8, y + r * 2.4)) continue;
    const ext = kind === 2 ? 0.66 : kind === 1 ? 1.46 : 1.62, top = kind === 2 ? 1.24 : kind === 1 ? 1.04 : 1.3;
    if (hidden(P, x - r * ext + ddx - 4, y - r * top + ddy - 4, x + r * ext + ddx + 4, Math.min(bottom, FENCE.base - 30) + ddy)) continue;
    const col = P.farC(i % 2 ? '#5aa65a' : '#4f9a5f', hz, SIL.mid);
    const sh = P.farC(i % 2 ? '#468a4c' : '#3f8052', hz, SIL.mid);
    const s = 1.5 * sway(t + i * 0.1, 4);
    let shapes;
    if (kind === 2) shapes = [{ rr: [x - r * 0.62 + s, y - r * 1.2, r * 1.24, r * 3.4, r * 0.62] }];
    else if (kind === 1) shapes = [[x + s, y, r], [x - r * 0.7 + s, y + r * 0.35, r * 0.72], [x + r * 0.72 + s, y + r * 0.4, r * 0.7]];
    else shapes = [[x + s, y, r], [x - r * 0.8 + s, y + r * 0.45, r * 0.75], [x + r * 0.8 + s, y + r * 0.5, r * 0.78], [x + s * 1.2, y - r * 0.55, r * 0.7]];
    shadedBlobs(ctx, shapes, col, sh, lw, ol, 0.22);
  }
  // rooftops peeking over the fence
  for (const hs of NB_HOUSES) {
    const { x, w, yb, rh } = hs;
    if (!inV(L, x - w / 2, yb - rh * 1.2, x + w / 2, bottom)) continue;
    if (hidden(P, x - w / 2 + ddx - 4, yb - rh - 6 - (hs.chim ? rh * 0.1 + 6 : 0) + ddy, x + w / 2 + ddx + 4, Math.min(bottom, FENCE.base - 30) + ddy)) continue;
    const wall = P.farC(hs.wall, hz, SIL.mid), roof = P.farC(hs.roof, hz, SIL.mid), roofSh = P.farC(mixColor(hs.roof, INK, 0.25), hz, SIL.mid);
    if (bottom > yb) rrect(ctx, x - w / 2 + 16, yb - 6, w - 32, bottom - yb + 6, 3, wall, lw, ol);
    // chimney
    if (hs.chim) {
      const cx = x + hs.chim;
      rrect(ctx, cx - 14, yb - rh * 0.92, 28, rh * 0.8, 2, P.farC('#c0705a', hz, SIL.mid), lw, ol);
      rrect(ctx, cx - 18, yb - rh * 0.96, 36, 10, 2, P.farC('#9a5a4a', hz, SIL.mid), lw * 0.8, ol);
    }
    let pts;
    if (hs.type === 'gable') pts = [[x - w / 2, yb], [x, yb - rh], [x + w / 2, yb]];
    else pts = [[x - w / 2, yb], [x - w / 2 + rh * 0.9, yb - rh], [x + w / 2 - rh * 0.9, yb - rh], [x + w / 2, yb]];
    fillPoly(ctx, pts, roof, 0);
    // roof shade on the right (the right-hand facet, as its own polygon)
    const sx = hs.type === 'gable' ? x : x + w / 2 - rh * 0.9;
    fillPoly(ctx, [[sx, yb - rh], [x + w / 2, yb], [sx, yb]], roofSh, 0);
    ctx.beginPath(); poly(ctx, pts); ink(ctx, null, lw, ol);
    // attic window (glows at night)
    if (hs.win) {
      const wy = yb - rh * 0.42, lit = P.lights;
      if (lit > 0) glow(ctx, x, wy, 60, WARM, 0.45 * lit);
      circle(ctx, x, wy, 17, lit > 0.3 ? mixColor(P.farC('#bfe6ff', hz, SIL.mid), WARM, lit) : P.farC('#bfe6ff', hz, SIL.mid), lw * 0.8, ol);
      ctx.beginPath(); ctx.moveTo(x - 16, wy); ctx.lineTo(x + 16, wy); ctx.moveTo(x, wy - 16); ctx.lineTo(x, wy + 16);
      ctx.strokeStyle = ol; ctx.lineWidth = 3; ctx.stroke();
    }
  }
}

function drawFar(ctx, P, o, withSky = true) {
  const off = (k) => [o.camX === undefined ? 0 : (o.camX - 960) * k, o.camY === undefined ? 0 : (o.camY - 540) * k];
  const T = P.T, V = P.V;
  // the layer's visible rect in its own (parallax-shifted) coordinates
  const local = (dx, dy) => ({ x0: V.x0 - dx, x1: V.x1 - dx, y0: V.y0 - dy, y1: V.y1 - dy });
  // world y below which the far layers are hidden: the solid fence (planks + rims) covers from its
  // top down; while it flaps, gaps open, so fill down to its foot.
  const fenceFoot = (o.fenceFlap || 0) > 0 || o.fence === false ? FENCE.base + 40 : FENCE.base - FENCE.h + 30;
  // sun / moon + low clouds
  let [dx, dy] = off(0.85);
  ctx.save(); ctx.translate(dx, dy);
  let L = local(dx, dy);
  if (withSky) {
    ctx.save();
    const hz = 545 - dy; // below this the far hills cover the sky (local y)
    if (L.y1 > hz) { ctx.beginPath(); ctx.rect(L.x0, L.y0, L.x1 - L.x0, Math.max(0, hz - L.y0)); ctx.clip(); }
    if (T.sun) drawSun(ctx, P);
    if (T.moon) drawMoon(ctx, P);
    ctx.restore();
  }
  if (withSky) for (const [x, y, w, h, seed] of T.lowClouds) {
    const drift = 14 * sway(P.t, 16);
    if (!inV(L, x + drift - w / 2 - 10, y - h, x + drift + w / 2 + 10, y + h)) continue;
    puff(ctx, x + drift, y, w, h, { seed, fill: mixColor(T.cloud.fill, SIL.far, P.sil), shadow: mixColor(T.cloud.shade, SIL.far, P.sil), lw: LW * 0.8 });
  }
  ctx.restore();
  // far hills
  [dx, dy] = off(0.78);
  L = local(dx, dy);
  if (fenceFoot - dy > 420 && L.y1 > 420 && L.y0 < fenceFoot - dy) {
    ctx.save(); ctx.translate(dx, dy);
    for (const [a, b] of openSpans(P, L.x0 + dx, L.x1 + dx, 418 + dy, fenceFoot)) hill(ctx, hillFar, a - dx, b - dx, fenceFoot - dy, P.farC(BASE.hillFar, T.hazeFar), LW * 0.6, P.farInk(0.5));
    ctx.restore();
  }
  // near hills + little lollipop trees
  [dx, dy] = off(0.7);
  L = local(dx, dy);
  if (fenceFoot - dy > 470 && L.y1 > 440 && L.y0 < fenceFoot - dy) {
    ctx.save(); ctx.translate(dx, dy);
    const treeC = P.farC(BASE.hillTree, T.hazeNear + 0.08, SIL.far), trunkC = P.farC('#7a5a48', T.hazeNear + 0.08, SIL.far), tol = P.farInk(0.42);
    const i0 = Math.max(-40, Math.floor((L.x0 - XL + 600 - 160) / 290)), i1 = Math.min(60, Math.ceil((L.x1 - XL + 600 + 40) / 290));
    for (let i = i0; i <= i1; i++) {
      const x = XL - 600 + i * 290 + hash01(i, 81) * 120;
      const y = hillNear(x) + 4;
      const r = 16 + 10 * hash01(i, 82);
      if (hidden(P, x - r - 4 + dx, y - r * 2.8 + dy, x + r + 4 + dx, y + 4 + dy)) continue;
      ctx.fillStyle = tol; ctx.fillRect(x - 3.5, y - r * 1.5, 7, r * 1.5 + 4);
      ctx.fillStyle = trunkC; ctx.fillRect(x - 1.5, y - r * 1.5, 3, r * 1.5 + 4);
      circle(ctx, x, y - r * 1.7, r, treeC, LW * 0.5, tol);
    }
    for (const [a, b] of openSpans(P, L.x0 + dx, L.x1 + dx, 494 + dy, fenceFoot)) hill(ctx, hillNear, a - dx, b - dx, fenceFoot - dy, P.farC(BASE.hillNear, T.hazeNear), LW * 0.65, P.farInk(0.38));
    ctx.restore();
  }
  // neighbours' rooftops & trees
  [dx, dy] = off(0.6);
  L = local(dx, dy);
  if (L.y0 < fenceFoot - dy) {
    ctx.save(); ctx.translate(dx, dy);
    drawNeighbours(ctx, P, L, fenceFoot - dy, dx, dy);
    ctx.restore();
  }
}

// Low-sun haze (golden / dusk): a few flat translucent discs around the sun, only over the sky
// and far layers (clipped above the fence foot). Foreground warmth lives in the TOD grade.
function drawHaze(ctx, P) {
  const s = P.T.sun;
  if (!s || !s.rays || P.sil >= 1) return;
  const V = P.V, yb = Math.min(V.y1, FENCE.base);
  if (yb <= V.y0) return;
  const a = (P.tod === 'golden' ? 0.075 : 0.06) * (1 - P.sil) * P.haze;
  if (a <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(V.x0, V.y0, V.x1 - V.x0, yb - V.y0); ctx.clip();
  ctx.fillStyle = rgba(s.glow, a);
  for (const R of [1300, 900, 560]) { circlePath(ctx, P.lightX, P.lightY, R); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- fence
const PITCH = 48;
function plankAt(i, t, flap) {
  const cx = XL - 30 + i * PITCH + PITCH / 2;
  const h = FENCE.h + (hash01(i, 21) - 0.5) * 14;
  let a = 0, dy = 0, pv = -24;
  if (flap > 0) {
    a = (hash01(i, 22) - 0.5) * 0.025;
    const d = cx - PAD.x, dir = d < 0 ? -1 : 1;
    const near = Math.exp(-Math.abs(d) / 900);
    const loose = hash01(i, 23) < 0.1;
    const n = noise1(t * (8 + 6 * hash01(i, 24)) + i * 1.7, 25);
    a += flap * (dir * 0.13 * near + n * (0.06 + 0.15 * near) * (loose ? 3.2 : 1));
    dy = -flap * 11 * Math.abs(noise1(t * 14 + i * 2.3, 26)) * (0.4 + near);
    if (loose) pv = -h + 40;
  }
  return { i, cx, h, a, dy, pv, alt: hash01(i, 27) < 0.45 };
}
const plankIndex = (x) => Math.round((x - (XL - 30) - PITCH / 2) / PITCH);
function fencePlanks(P, o) {
  const flap = clamp(o.fenceFlap || 0), V = P.V, planks = [];
  if (V.y0 > FENCE.base + 30 || V.y1 < FENCE.base - FENCE.h - 40) return planks;
  for (let i = plankIndex(V.x0) - 2, i1 = plankIndex(V.x1) + 2; i <= i1; i++) {
    const p = plankAt(i, P.t, flap);
    if (hidden(P, p.cx - 34, FENCE.base - p.h - 20, p.cx + 34, FENCE.base + 12)) continue; // behind house / barn
    planks.push(p);
  }
  return planks;
}
function plankPt(p, lx, ly) {
  const ca = Math.cos(p.a), sa = Math.sin(p.a), yy = ly - p.pv;
  return [p.cx + lx * ca - yy * sa, FENCE.base + p.dy + p.pv + lx * sa + yy * ca];
}
function drawFence(ctx, P, o) {
  const { C, t, V } = P, ik = P.inkC;
  const flap = clamp(o.fenceFlap || 0);
  const planks = fencePlanks(P, o);
  if (!planks.length) return planks;
  const hw = 22, e = 9;
  if (flap === 0) {
    // FAST PATH (no blast): planks are exactly vertical, so bodies, shade strips, side outlines,
    // grain and highlights are all axis-aligned rects (nearly free); only the cut-corner caps are
    // paths. The ink sides are 4.8px wide, which covers the 4px gaps between planks.
    const fb = FENCE.base, lw = LW * 0.8, d = lw / 2;
    // ink underlay: every plank grown by lw/2 (mitred chamfers) -> the plank fills leave a clean rim
    ctx.fillStyle = ik;
    ctx.beginPath();
    for (let k = 0; k < planks.length; k++) {
      const p = planks[k], top = fb - p.h, yc = top + e - 0.414 * d;
      // grown cap (a band just taller than the chamfer) + the gap strip to the next plank
      ctx.moveTo(p.cx - hw - d, yc + 4); ctx.lineTo(p.cx - hw - d, yc); ctx.lineTo(p.cx - hw + e - 0.414 * d, top - d); ctx.lineTo(p.cx + hw - e + 0.414 * d, top - d);
      ctx.lineTo(p.cx + hw + d, yc); ctx.lineTo(p.cx + hw + d, yc + 4); ctx.closePath();
      const q = planks[k + 1] && planks[k + 1].i === p.i + 1 ? planks[k + 1] : null;
      const gy = q ? Math.min(yc, fb - q.h + e - 0.414 * d) : yc;
      ctx.fillRect(p.cx + hw - d, gy, (q ? q.cx - hw + d : p.cx + hw + d) - (p.cx + hw - d), fb + 10 - gy);
      if (k === 0 || planks[k - 1].i !== p.i - 1) ctx.fillRect(p.cx - hw - d, yc, 2 * d, fb + 10 - yc);
    }
    ctx.fill();
    for (const alt of [false, true]) {
      ctx.fillStyle = alt ? C.fence2 : C.fence;
      ctx.beginPath();
      for (const p of planks) {
        if (p.alt !== alt) continue;
        const top = fb - p.h;
        ctx.fillRect(p.cx - hw, top + e, 2 * hw, p.h - e + 10);
        ctx.moveTo(p.cx - hw, top + e + 1); ctx.lineTo(p.cx - hw + e, top); ctx.lineTo(p.cx + hw - e, top); ctx.lineTo(p.cx + hw, top + e + 1); ctx.closePath();
      }
      ctx.fill();
    }
    ctx.fillStyle = C.fenceShade;
    ctx.beginPath();
    for (const p of planks) {
      const top = fb - p.h;
      ctx.fillRect(p.cx + hw - 11, top + e, 11, p.h - e + 10);
      ctx.moveTo(p.cx + hw - 11, top + e + 1); ctx.lineTo(p.cx + hw - 11, top); ctx.lineTo(p.cx + hw - e, top); ctx.lineTo(p.cx + hw, top + e + 1); ctx.closePath();
    }
    ctx.fill();
    // grain (a board line with a little jog), knots, highlight nicks
    ctx.fillStyle = C.fenceGrain;
    for (const p of planks) {
      if (hash01(p.i, 28) < 0.55) {
        const gx = p.cx - 12 + 12 * hash01(p.i, 29), y0 = fb - p.h + 26 + 30 * hash01(p.i, 30), y1 = fb - 40 - 30 * hash01(p.i, 31), ym = (y0 + y1) / 2;
        ctx.fillRect(gx - 1.3, y0, 2.6, ym - y0 + 1); ctx.fillRect(gx + 1.7, ym, 2.6, y1 - ym);
      }
    }
    ctx.strokeStyle = C.fenceGrain; ctx.lineWidth = 2.6;
    for (const p of planks) {
      if (hash01(p.i, 32) < 0.18) { ellipsePath(ctx, p.cx - 4, fb - p.h * (0.35 + 0.3 * hash01(p.i, 33)), 5, 7); ctx.stroke(); }
    }
    ctx.fillStyle = rgba('#ffffff', 0.35 * (1 - P.sil));
    for (const p of planks) ctx.fillRect(p.cx - hw + 4.5, fb - p.h + e + 6, 3, 28);
  } else {
    // flapping planks tilt and overlap, so each one is drawn whole (ink underlay grown by lw/2,
    // colour, shade strip) in order — no frame-wide outline stroke
    const d = LW * 0.4, q = 0.414 * d;
    for (const p of planks) {
      ctx.beginPath(); poly(ctx, [[-hw - d, 16], [-hw - d, -p.h + e - q], [-hw + e - q, -p.h - d], [hw - e + q, -p.h - d], [hw + d, -p.h + e - q], [hw + d, 16]].map(([x, y]) => plankPt(p, x, y)));
      ctx.fillStyle = ik; ctx.fill();
      ctx.beginPath(); poly(ctx, [[-hw, 16], [-hw, -p.h + e], [-hw + e, -p.h], [hw - e, -p.h], [hw, -p.h + e], [hw, 16]].map(([x, y]) => plankPt(p, x, y)));
      ctx.fillStyle = p.alt ? C.fence2 : C.fence; ctx.fill();
      ctx.beginPath(); poly(ctx, [[hw - 11, 16], [hw - 11, -p.h], [hw - e, -p.h], [hw, -p.h + e], [hw, 16]].map(([x, y]) => plankPt(p, x, y)));
      ctx.fillStyle = C.fenceShade; ctx.fill();
    }
    // grain (straight 3-point polylines: cheap) + knots
    ctx.beginPath();
    for (const p of planks) {
      if (hash01(p.i, 28) < 0.55) {
        const gx = -12 + 12 * hash01(p.i, 29), y0 = -p.h + 26 + 30 * hash01(p.i, 30), y1 = -40 - 30 * hash01(p.i, 31);
        const a = plankPt(p, gx, y0), b = plankPt(p, gx + 3, (y0 + y1) / 2), c = plankPt(p, gx - 1, y1);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]);
      }
    }
    ctx.strokeStyle = C.fenceGrain; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    for (const p of planks) {
      if (hash01(p.i, 32) < 0.18) {
        const k = plankPt(p, -4, -p.h * (0.35 + 0.3 * hash01(p.i, 33)));
        ellipsePath(ctx, k[0], k[1], 5, 7, p.a); ctx.stroke();
      }
    }
    // highlight nick on the left of the top
    ctx.beginPath();
    for (const p of planks) { const a = plankPt(p, -hw + 6, -p.h + e + 6), b = plankPt(p, -hw + 6, -p.h + e + 34); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.strokeStyle = rgba('#ffffff', 0.35 * (1 - P.sil)); ctx.lineWidth = 3; ctx.stroke();
  }
  // rails (in front) + nails
  for (const ry of [FENCE.base - 168, FENCE.base - 56]) {
    const s0 = Math.floor((V.x0 - XL + 40 - 432) / 432), s1 = Math.ceil((V.x1 - XL + 40) / 432);
    for (let s = s0; s <= s1; s++) {
      const x0 = XL - 40 + s * 432, x1 = x0 + 428;
      const jy = flap * 3 * noise1(t * 16 + s * 3.1 + ry, 35), ja = flap * 0.012 * noise1(t * 11 + s * 1.7 + ry, 36);
      if (flap === 0) { // axis-aligned: plain rects, only where not hidden behind the house / barn
        for (const [a, b] of openSpans(P, Math.max(x0, V.x0 - 20), Math.min(x1, V.x1 + 20), ry - 6, ry + 26)) {
          const ra = a <= x0 + 1 ? x0 : a - 8, rb = b >= x1 - 1 ? x1 : b + 8; // open ends tuck under the occluder
          ctx.fillStyle = C.rail; ctx.fillRect(ra, ry, rb - ra, 20);
          ctx.fillStyle = C.railShade; ctx.fillRect(ra, ry + 13, rb - ra, 7);
          ctx.strokeStyle = ik; ctx.lineWidth = LW * 0.75; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(ra, ry); ctx.lineTo(rb, ry); ctx.moveTo(ra, ry + 20); ctx.lineTo(rb, ry + 20);
          if (ra === x0) { ctx.moveTo(x0, ry); ctx.lineTo(x0, ry + 20); }
          if (rb === x1) { ctx.moveTo(x1, ry); ctx.lineTo(x1, ry + 20); }
          ctx.stroke();
        }
        continue;
      }
      ctx.save(); ctx.translate((x0 + x1) / 2, ry + 10 + jy); ctx.rotate(ja);
      rrectPath(ctx, -(x1 - x0) / 2, -10, x1 - x0, 20, 3); ctx.fillStyle = C.rail; ctx.fill();
      ctx.fillStyle = C.railShade; ctx.fillRect(-(x1 - x0) / 2, 3, x1 - x0, 7);
      rrectPath(ctx, -(x1 - x0) / 2, -10, x1 - x0, 20, 3); ink(ctx, null, LW * 0.75, ik);
      ctx.restore();
    }
    ctx.fillStyle = rgba(ik, 0.7);
    for (const p of planks) { if (p.pv < -100 && flap > 0) continue; ctx.fillRect(p.cx - 2.2, ry + 7.8, 4.4, 4.4); }
  }
  // a knot-hole peephole (fixed plank)
  const pk = plankAt(plankIndex(1030), t, flap);
  if (pk.cx > V.x0 - 40 && pk.cx < V.x1 + 40) {
    const kh = plankPt(pk, -2, -112);
    ellipse(ctx, kh[0], kh[1], 7, 9, mixColor('#2a1f2e', SIL.near, P.sil), 2.5, ik);
  }
  return planks;
}

// ---------------------------------------------------------------- birds
// One bluebird. Local frame: (0,0) = feet, facing +x, ~30 px long at s = 1.
// wing: 0 = up .. 1 = down (flying) — ignored when perched.
function birdBody(ctx, C, ik, flying, wing, bob, sil) {
  if (!flying) {
    fillPoly(ctx, [[-10, -9], [-24, -16], [-22, -6]], C.birdShade, 2.5, ik); // tail
    ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-3, 2); ctx.moveTo(3, -2); ctx.lineTo(3, 2); ctx.strokeStyle = ik; ctx.lineWidth = 2.2; ctx.stroke();
    blobs(ctx, [[0, -12, 12], [8, -22 + bob, 8.5]], C.bird, 2.8, ik);
    ctx.fillStyle = C.birdBelly; ellipsePath(ctx, 3.5, -7.5, 6, 4.2, -0.3); ctx.fill();
    ellipse(ctx, -2, -13, 7, 4.5, C.birdShade, 2, ik, -0.4); // wing
    fillPoly(ctx, [[15, -24 + bob], [22, -21 + bob], [15, -19 + bob]], C.beak, 2, ik);
    circle(ctx, 10.5, -24 + bob, 1.8, ik, 0);
    return;
  }
  // flying: streamlined body, wings flap about the shoulder (-1, -17)
  const wingPath = (k) => {
    ctx.save(); ctx.translate(-1, -17); ctx.rotate(0.35 - 1.75 * wing + k * 0.25);
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.quadraticCurveTo(-2, -24, -24, -30); ctx.quadraticCurveTo(-18, -8, -6, 3); ctx.closePath();
    ink(ctx, k ? C.birdShade : C.bird, 2.4, ik);
    if (!k) { ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(-12, -18, -20, -24); ctx.strokeStyle = rgba(ik, 0.3 * (1 - sil)); ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.restore();
  };
  wingPath(1); // far wing behind the body
  fillPoly(ctx, [[-10, -13], [-27, -19], [-24, -9]], C.birdShade, 2.4, ik); // tail
  blobs(ctx, [[0, -13, 10], [11, -18, 7.5]], C.bird, 2.6, ik);
  ctx.fillStyle = C.birdBelly; ellipsePath(ctx, 3, -8.5, 6, 3.4, -0.1); ctx.fill();
  fillPoly(ctx, [[17, -20], [24, -17.5], [17, -15]], C.beak, 2, ik);
  circle(ctx, 13, -20, 1.7, ik, 0);
  wingPath(0);
}
/**
 * drawBird(ctx, x, y, s = 1, o = {}) — a cartoon bluebird (the fence birds), for flocks.
 * (x,y) = feet (perched) / body centre-bottom (flying). o: { t, fly bool, facing 1|-1, wing 0..1
 * override (0 up .. 1 down; default: beat-locked flap, two strokes per beat), tod, silhouette, seed }.
 */
export function drawBird(ctx, x, y, s = 1, o = {}) {
  const P = look(o);
  const t = o.t || 0;
  const wing = o.wing !== undefined ? clamp(o.wing) : 0.5 + 0.5 * Math.cos(TAU * (2 * beatAt(t) + (o.seed || 0) * 0.37));
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.facing === -1 ? -1 : 1), s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  birdBody(ctx, P.C, P.inkC, !!o.fly, wing, 0, P.sil);
  ctx.restore();
}
function drawBirds(ctx, P, o, pass = 'perched') {
  if (o.birds === false || P.tod === 'night') return;
  const fly = o.birdsFly === undefined ? null : clamp(o.birdsFly);
  if (fly === null && (P.wind > 0.15 || (o.fenceFlap || 0) > 0.15)) return; // legacy: hidden in the blast
  if (fly !== null && fly >= 1) return;
  const { C, t } = P, ik = P.inkC;
  const flap = clamp(o.fenceFlap || 0);
  BACKYARD.birds.forEach(([bx, face], k) => {
    const p = plankAt(plankIndex(bx), t, flap);
    const top = plankPt(p, 0, -p.h)[1];
    const uk = fly === null ? 0 : clamp((fly - k * 0.07) / 0.86);
    if (uk <= 0) {
      if (pass !== 'perched' || !inV(P.V, bx - 30, top - 40, bx + 30, top + 5)) return;
      const hopY = k === 2 ? 0 : -9 * Math.pow(Math.max(0, Math.sin(Math.PI * beatAt(t + (k ? 0.6 : 0)) / 2)), 3);
      const bob = 1.5 * pulse(t, 6);
      ctx.save(); ctx.translate(bx, top + hopY); ctx.scale(face, 1);
      birdBody(ctx, C, ik, false, 0, bob, P.sil);
      ctx.restore();
      return;
    }
    if (pass !== 'flying') return;
    // take off: up and to the left in out-cubic arcs (height leads distance), gone by 1
    const ex = ease.outCubic(uk), ey = ease.outCubic(Math.min(1, uk * 1.25));
    const x = bx - (430 + 170 * k) * ex + 26 * Math.sin(uk * 9 + k);
    const y = top - (620 + 150 * k + 60 * hash01(k, 61)) * ey - 16 * Math.sin(uk * 7 + k * 2);
    const sc = 1.15 - 0.35 * uk;
    const al = clamp((1 - uk) / 0.18);
    const wing = 0.5 + 0.5 * Math.cos(TAU * (2 * beatAt(t) + k * 0.37));
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); ctx.rotate(0.3 * (1 - uk)); ctx.scale(-sc, sc);
    birdBody(ctx, C, ik, true, wing, 0, P.sil);
    ctx.restore();
  });
}

// ---------------------------------------------------------------- lawn
function lawnColorAt(C, y) {
  const u = (y - (FENCE.base - 6)) / (1500 - FENCE.base + 6);
  const st = [[0, C.lawnBack], [0.16, C.lawn], [0.46, C.lawnFront], [1, C.lawnDeep]];
  if (u <= 0) return st[0][1];
  for (let i = 1; i < st.length; i++) if (u <= st[i][0]) return mixColor(st[i - 1][1], st[i][1], (u - st[i - 1][0]) / (st[i][0] - st[i - 1][0]));
  return st[3][1];
}
function drawLawn(ctx, P) {
  const { C, V } = P, top = FENCE.base - 6;
  if (V.y1 <= top) return;
  // flat bands: fine near the horizon where the colour changes fastest
  bands(ctx, V, top, 1000, 6, (y) => lawnColorAt(C, y));
  bands(ctx, V, 1000, V.y1, 14, (y) => lawnColorAt(C, y));
  if (P.sil > 0.98) return;
  // mowed patches for texture
  for (const [col, seed, a] of [[C.patchL, 41, 0.5], [C.patchD, 43, 0.45]]) {
    ctx.beginPath();
    let any = false;
    for (let i = 0; i < 16; i++) {
      const y = 800 + Math.pow(hash01(i, seed), 1.2) * 640;
      const d = (y - 760) / 700;
      const x = XL + hash01(i, seed + 1) * (XR - XL);
      const rx = (70 + 150 * hash01(i, seed + 2)) * (0.6 + d), ry = rx * (0.1 + 0.1 * d);
      if (!inV(V, x - rx, y - ry, x + rx, y + ry)) continue;
      ctx.moveTo(x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); any = true;
    }
    if (any) { ctx.globalAlpha = a * (1 - P.sil); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; }
  }
  // soft shadow band at the fence foot (two flat steps)
  if (V.y0 < top + 40) {
    ctx.fillStyle = rgba(P.T.shadow.col, 0.13);
    ctx.fillRect(V.x0, top, V.x1 - V.x0, 26); ctx.fillRect(V.x0, top, V.x1 - V.x0, 11);
  }
}

// Grass tuft (open path: base is not stroked). bend in "fraction of height".
function tuftPath(ctx, x, y, s, bend) {
  const b = bend * s;
  ctx.moveTo(x - 11 * s, y);
  ctx.quadraticCurveTo(x - 9 * s, y - 8 * s, x - 13 * s + b * 15, y - 16 * s);
  ctx.quadraticCurveTo(x - 5 * s, y - 10 * s, x - 3 * s, y - 6 * s);
  ctx.quadraticCurveTo(x - 3 * s, y - 16 * s, x + b * 24, y - 25 * s);
  ctx.quadraticCurveTo(x + 3 * s, y - 14 * s, x + 4 * s, y - 6 * s);
  ctx.quadraticCurveTo(x + 7 * s, y - 11 * s, x + 14 * s + b * 17, y - 18 * s);
  ctx.quadraticCurveTo(x + 9 * s, y - 8 * s, x + 11 * s, y);
}
function tuftBend(P, x, k = 1) {
  return 0.22 * sway(P.t + x * 0.00015, 2) * k + P.wd * P.wind * (0.55 + 0.3 * noise1(P.t * 3 + x * 0.01, 44));
}
function inCrater(o, x, y) {
  return o.crater && Math.abs(x - 1240) < 280 && Math.abs(y - 870) < 70 && ((x - 1240) / 280) ** 2 + ((y - 870) / 62) ** 2 < 1;
}
// Tufts are drawn one path each: in this Skia build many small curved paths are ~2x cheaper
// than one frame-wide multi-contour path.
function tufts(ctx, P, list, fill, line, lw) {
  ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  for (const [x, y, s, bend] of list) { ctx.beginPath(); tuftPath(ctx, x, y, s, bend); ctx.fill(); ctx.stroke(); }
}
function drawBackTufts(ctx, P, o) {
  if (P.sil > 0.98) return;
  const { C, V } = P;
  const list = [];
  // row along the fence foot
  if (inV(V, V.x0, FENCE.base - 20, V.x1, FENCE.base + 10)) {
    for (let i = 0, x = XL; x < XR; i++, x += 34 + 18 * hash01(i, 45)) {
      if (x < V.x0 - 20 || x > V.x1 + 20) continue;
      const s = 0.55 + 0.35 * hash01(i, 46), y = FENCE.base + 3 + 4 * hash01(i, 47);
      if (hidden(P, x - 16 * s, y - 26 * s, x + 16 * s, y)) continue;
      list.push([x, y, s, tuftBend(P, x, 0.6)]);
    }
  }
  // scattered on the back lawn
  for (let i = 0; i < 44; i++) {
    const y = 790 + hash01(i, 48) * 110, x = XL + hash01(i, 49) * (XR - XL);
    const sc = 0.55 + 0.4 * ((y - 780) / 120);
    if (inCrater(o, x, y) || !inV(V, x - 20, y - 25, x + 20, y) || hidden(P, x - 16 * sc, y - 26 * sc, x + 16 * sc, y)) continue;
    list.push([x, y, sc, tuftBend(P, x)]);
  }
  ctx.fillStyle = C.tuftLine;
  for (const [x, y, s, bend] of list) { ctx.beginPath(); tuftPath(ctx, x, y + 0.6, s * 1.2, bend); ctx.fill(); }
  ctx.fillStyle = C.tuftBack;
  for (const [x, y, s, bend] of list) { ctx.beginPath(); tuftPath(ctx, x, y, s, bend); ctx.fill(); }
  // lawn daisies (back half)
  drawDaisies(ctx, P, o, 0, 30, 800, 930);
}
function drawDaisies(ctx, P, o, seed, n, y0, y1) {
  const { C, V } = P;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = XL + hash01(i, 90 + seed) * (XR - XL), y = y0 + hash01(i, 91 + seed) * (y1 - y0);
    if (inCrater(o, x, y) || !inV(V, x - 12, y - 8, x + 12, y + 8) || hidden(P, x - 12, y - 6, x + 12, y + 4)) continue;
    pts.push([x, y, 0.8 + ((y - 780) / 700) * 1.1]);
  }
  // (at lawn scale a daisy is a squashed white disc with a yellow eye)
  ctx.fillStyle = C.daisy;
  for (const [x, y, s] of pts) { ellipsePath(ctx, x, y, 6 * s, 3.6 * s); ctx.fill(); }
  ctx.fillStyle = C.daisyC;
  for (const [x, y, s] of pts) { circlePath(ctx, x, y, 2.2 * s); ctx.fill(); }
}
function drawFrontTufts(ctx, P, o) {
  if (P.sil > 0.98) return;
  const { C, V } = P;
  const list = [];
  for (let i = 0; i < 52; i++) {
    const y = 900 + Math.pow(hash01(i, 52), 0.9) * 580, x = XL + hash01(i, 53) * (XR - XL);
    const s = 0.9 + ((y - 900) / 580) * 1.3;
    if (inCrater(o, x, y) || !inV(V, x - 20 * s, y - 30 * s, x + 20 * s, y)) continue;
    list.push([x, y, s, tuftBend(P, x)]);
  }
  // tufts hugging object bases
  for (const [x, y, s] of [[200, 876, 1], [312, 878, 0.9], [352, 874, 0.7], [-300, 868, 0.9], [60, 868, 0.8], [780, 822, 0.7],
    [948, 824, 0.8], [1108, 866, 0.9], [1372, 866, 0.85], [1532, 806, 0.8], [2150, 806, 0.9], [1500, 852, 0.7]]) {
    if (!inCrater(o, x, y) && inV(V, x - 20, y - 30, x + 20, y)) list.push([x, y, s, tuftBend(P, x)]);
  }
  tufts(ctx, P, list, C.tuft, mixColor(P.inkC, C.tuftLine, 0.35), LW * 0.5);
  // light blade tips
  ctx.strokeStyle = rgba(C.lawnBack, 0.8 * (1 - P.sil)); ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const [x, y, s, bend] of list) { const b = bend * s; ctx.moveTo(x - 2 * s, y - 8 * s); ctx.lineTo(x - 2 * s, y - 13 * s); ctx.lineTo(x + b * 14 - 1 * s, y - 18 * s); }
  ctx.stroke();
  drawDaisies(ctx, P, o, 7, 24, 940, 1460);
}

function drawStones(ctx, P) {
  const { C, V } = P, ik = P.inkC;
  for (const [x, y, rx, ry] of [[-150, 898, 38, 11], [-56, 934, 42, 13], [58, 968, 46, 14], [190, 998, 50, 15], [336, 1022, 52, 16]]) {
    if (!inV(V, x - rx - 5, y - ry - 5, x + rx + 5, y + ry + 5)) continue;
    ellipse(ctx, x, y, rx, ry, C.stone, LW * 0.7, ik);
    ctx.save(); ellipsePath(ctx, x, y, rx - 2, ry - 2); ctx.clip();
    ctx.fillStyle = C.stoneShade; ellipsePath(ctx, x + rx * 0.2, y + ry * 0.55, rx, ry * 0.8); ctx.fill();
    ctx.restore();
    ellipse(ctx, x - rx * 0.35, y - ry * 0.3, rx * 0.22, ry * 0.18, rgba('#ffffff', 0.5 * (1 - P.sil)), 0);
  }
}

// ---------------------------------------------------------------- shadows on the lawn
function castShadow(ctx, P, x, yb, w, hgt, extra, amt = 1, contact = true) {
  // Shadows radiate from the point on the ground below the sun/moon (perspective), long at
  // golden hour / dusk, short at midday. Soft: fades out along its length.
  const S = P.T.shadow;
  const L = hgt * S.k;
  const dx = x - P.lightX, dy = Math.max(80, yb - 600);
  const l = Math.hypot(dx, dy);
  const vx = (dx / l) * L * 1.15, vy = (dy / l) * L * 0.5 + hgt * 0.035;
  const a = S.a * (1 - 0.5 * P.sil) * amt;
  if (a <= 0) return;
  const V = P.V;
  const bx0 = Math.min(x - w * 0.6, x - w * 0.6 + vx), bx1 = Math.max(x + w * 0.6, x + w * 0.6 + vx);
  if (inV(V, bx0 - 20, yb - 20, bx1 + 20, yb + Math.max(0, vy) + 30)) {
    const g = ctx.createLinearGradient(x, yb, x + vx, yb + vy);
    g.addColorStop(0, rgba(S.col, a)); g.addColorStop(0.7, rgba(S.col, a * 0.55)); g.addColorStop(1, rgba(S.col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    poly(ctx, [[x - w / 2, yb], [x + w / 2, yb], [x + w * 0.6 + vx, yb + vy], [x - w * 0.6 + vx, yb + vy]]);
    if (extra) { const ex = x + vx * 0.85, ey = yb + vy * 0.85; ctx.moveTo(ex + extra[0], ey); ctx.ellipse(ex, ey, extra[0], extra[1], 0, 0, TAU); }
    ctx.fill();
  }
  // contact shadow
  if (contact) {
    ctx.fillStyle = rgba(S.col, Math.min(0.35, a * 1.2));
    ellipsePath(ctx, x, yb + 1, w * 0.54, 5 + w * 0.03); ctx.fill();
  }
}
function drawShadows(ctx, P, o) {
  if (o.garage !== false) castShadow(ctx, P, GARAGE.cx, GARAGE.base, GARAGE.R - GARAGE.L, 860);
  castShadow(ctx, P, DOGH.x, DOGH.base, 190, 200);
  castShadow(ctx, P, TREE.x, TREE.base - 4, 90, 520, [160, 30]);
  castShadow(ctx, P, GNOME.x, GNOME.base, 44, 110);
  if ((o.pad || 'intact') === 'intact') castShadow(ctx, P, PAD.x, GY, PAD.cw * 2, PAD.ch);
}
/**
 * longShadow(ctx, x, groundY, width, height, o = {}) — the same cast shadow the set pieces throw
 * (long and purple at golden hour, short at midday, soft blue at night), for Juno, Biscuit and
 * the rockets. World coords (inside the same camera() as drawBackyard). Draw it right after
 * drawBackyard and before the character.
 *   x, groundY  foot point; width = footprint width; height = object height (px, world)
 *   o: { tod, camX, camY (same as drawBackyard: the sun moves with parallax), silhouette,
 *        alpha 0..1 (default 1), contact bool (default true: soft ellipse under the feet) }
 */
export function longShadow(ctx, x, groundY, width, height, o = {}) {
  const P = look(o); lightPos(P, o);
  const V = viewRect(ctx); if (V) P.V = V;
  ctx.save();
  castShadow(ctx, P, x, groundY, width, height, null, o.alpha === undefined ? 1 : clamp(o.alpha, 0, 2), o.contact !== false);
  ctx.restore();
}

// ---------------------------------------------------------------- house
function windowPane(ctx, P, x, y, w, h, o = {}) {
  const { C } = P, ik = P.inkC, lit = P.lights;
  // frame
  rrect(ctx, x - w / 2 - 12, y - 12, w + 24, h + 24, 5, C.trim, LWB * 0.85, ik);
  // glass
  ctx.save();
  rrectPath(ctx, x - w / 2, y, w, h, 3); ctx.clip();
  if (lit > 0.02) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, mixColor(C.glass, '#fff0b8', lit)); g.addColorStop(1, mixColor(C.glassShade, WARM2, lit));
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w, h);
  } else {
    ctx.fillStyle = C.glass; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = C.glassShade; ctx.fillRect(x - w / 2, y + h * 0.55, w, h);
    ctx.fillStyle = rgba('#ffffff', 0.6 * (1 - P.sil));
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 10, y + h * 0.5); ctx.lineTo(x - w / 2 + 30, y + 8); ctx.lineTo(x - w / 2 + 44, y + 8); ctx.lineTo(x - w / 2 + 24, y + h * 0.5); ctx.fill();
  }
  // curtains
  if (o.curtains) {
    const cc = lit > 0.02 ? mixColor(C.curtain, '#ff9a5a', lit * 0.5) : C.curtain;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      const ex = x + s * (w / 2 + 2);
      ctx.moveTo(ex, y - 2); ctx.lineTo(ex - s * w * 0.3, y - 2);
      ctx.quadraticCurveTo(ex - s * w * 0.12, y + h * 0.45, ex - s * w * 0.2, y + h + 2);
      ctx.lineTo(ex, y + h + 2); ctx.closePath();
      ink(ctx, cc, LWB * 0.5, ik);
    }
    ctx.fillStyle = mixColor(C.curtainShade, SIL.near, P.sil);
    ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 12);
  }
  ctx.restore();
  rrectPath(ctx, x - w / 2, y, w, h, 3); ink(ctx, null, LWB * 0.7, ik);
  // mullions
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x + w / 2, y + h / 2);
  ctx.strokeStyle = ik; ctx.lineWidth = 12; ctx.stroke();
  ctx.strokeStyle = C.trim; ctx.lineWidth = 6; ctx.stroke();
  // sill
  rrect(ctx, x - w / 2 - 20, y + h + 8, w + 40, 14, 4, C.trim, LWB * 0.8, ik);
  ctx.fillStyle = C.trimShade; ctx.fillRect(x - w / 2 - 17, y + h + 16, w + 34, 4);
}
function drawHouseGlow(ctx, P) {
  const lit = P.lights;
  if (lit <= 0.25) return;
  // windows glow + light spilling onto the lawn
  for (const [x, y, w, h] of [[110, 540, 110, 124], [-340, 540, 110, 124]]) {
    glow(ctx, x, y + h / 2, 150, WARM, 0.4 * lit);
    if (P.sil >= 0.99) continue; // title card: windows glow, no light on the (black) lawn
    const g = ctx.createLinearGradient(0, 868, 0, 1010);
    g.addColorStop(0, rgba(WARM, 0.26 * lit * (1 - P.sil))); g.addColorStop(1, rgba(WARM, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); poly(ctx, [[x - w * 0.6, 868], [x + w * 0.6, 868], [x + w * 1.3 + 60, 1010], [x - w * 1.0 + 40, 1010]]); ctx.fill();
    ctx.strokeStyle = rgba('#000000', 0.06 * lit); ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x, 868); ctx.lineTo(x + 50, 1010); ctx.stroke();
  }
  glow(ctx, -40, 600, 100, WARM, 0.5 * lit); // porch light
}
function drawHouse(ctx, P) {
  if (!inV(P.V, HOUSE.L - 70, 130, HOUSE.R + 60, 1030)) return;
  const { C, t } = P, ik = P.inkC, H0 = HOUSE;
  // wall
  rrectPath(ctx, H0.L, H0.eave, H0.R - H0.L, H0.base - H0.eave, 0); ctx.fillStyle = C.wall; ctx.fill();
  ctx.save(); rrectPath(ctx, H0.L, H0.eave, H0.R - H0.L, H0.base - H0.eave, 0); ctx.clip();
  // weatherboards
  ctx.beginPath();
  for (let y = H0.eave + 30; y < H0.base - 20; y += 30) { ctx.moveTo(H0.L, y); ctx.lineTo(H0.R, y); }
  ctx.strokeStyle = C.wallLine; ctx.lineWidth = 3; ctx.stroke();
  // shade: band under the eave + right corner strip (one shape)
  ctx.fillStyle = C.wallShade;
  ctx.beginPath(); poly(ctx, [[H0.L, H0.eave], [H0.R, H0.eave], [H0.R, H0.base], [H0.R - 30, H0.base], [H0.R - 30, H0.eave + 34], [H0.L, H0.eave + 34]]); ctx.fill();
  // foundation
  ctx.fillStyle = C.concrete; ctx.fillRect(H0.L, H0.base - 22, H0.R - H0.L, 22);
  ctx.fillStyle = C.concreteShade; ctx.fillRect(H0.L, H0.base - 8, H0.R - H0.L, 8);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(H0.L, H0.base - 22); ctx.lineTo(H0.R, H0.base - 22); ctx.strokeStyle = ik; ctx.lineWidth = 3; ctx.stroke();
  rrectPath(ctx, H0.L, H0.eave, H0.R - H0.L, H0.base - H0.eave, 0); ink(ctx, null, LWB, ik);
  // corner board
  rrect(ctx, H0.R - 20, H0.eave, 20, H0.base - H0.eave - 22, 0, C.trim, LWB * 0.7, ik);
  drawHouseGlow(ctx, P);
  // windows
  windowPane(ctx, P, 110, 540, 110, 124, { curtains: true });
  windowPane(ctx, P, -340, 540, 110, 124, { curtains: true });
  // flower box under the right window
  rrect(ctx, 110 - 72, 684, 144, 30, 5, C.crateFrame, LWB * 0.8, ik);
  ctx.fillStyle = C.crateShade; ctx.fillRect(110 - 69, 700, 138, 10);
  for (let i = 0; i < 6; i++) {
    const fx = 110 - 58 + i * 23, fy = 678 - 6 * hash01(i, 55) + 2 * sway(t + i * 0.1, 2);
    const col = [C.f3, C.f1, C.f2][i % 3];
    blobs(ctx, [[fx - 6, fy, 7], [fx + 6, fy, 7], [fx, fy - 7, 7], [fx, fy + 5, 6]], col, LWB * 0.55, ik);
    circle(ctx, fx, fy - 1, 3.4, C.f2 === col ? C.f6 : C.f2, 0);
  }
  // back door + steps
  const dx0 = -180, dw = 120, dTop = 596, dBot = 836;
  rrect(ctx, dx0 - 12, dTop - 12, dw + 24, dBot - dTop + 12, 4, C.trim, LWB * 0.85, ik);
  rrect(ctx, dx0, dTop, dw, dBot - dTop, 3, C.door, LWB * 0.7, ik);
  ctx.save(); rrectPath(ctx, dx0, dTop, dw, dBot - dTop, 3); ctx.clip();
  ctx.fillStyle = C.doorShade; ctx.fillRect(dx0 + dw - 18, dTop, 18, dBot - dTop);
  ctx.restore();
  rrect(ctx, dx0 + 22, dTop + 20, dw - 44, 64, 4, P.lights > 0.02 ? mixColor(C.glass, WARM, P.lights) : C.glass, LWB * 0.6, ik);
  ctx.beginPath(); ctx.moveTo(dx0 + dw / 2, dTop + 20); ctx.lineTo(dx0 + dw / 2, dTop + 84); ctx.moveTo(dx0 + 22, dTop + 52); ctx.lineTo(dx0 + dw - 22, dTop + 52);
  ctx.strokeStyle = C.door; ctx.lineWidth = 5; ctx.stroke();
  rrect(ctx, dx0 + 20, dTop + 108, dw - 40, 96, 4, null, 3, mixColor(C.doorShade, ik, 0.3));
  circle(ctx, dx0 + dw - 20, dTop + 128, 7, C.brass, LWB * 0.5, ik);
  rrect(ctx, dx0 - 26, dBot, dw + 52, 14, 3, C.concrete, LWB * 0.7, ik);
  rrect(ctx, dx0 - 40, dBot + 14, dw + 80, 16, 3, C.concrete, LWB * 0.7, ik);
  ctx.fillStyle = C.concreteShade; ctx.fillRect(dx0 - 37, dBot + 24, dw + 74, 4);
  // porch light
  rrect(ctx, -52, 580, 24, 36, 5, P.lights > 0.02 ? mixColor('#fff3c0', WARM, 0.3) : C.glass, LWB * 0.6, ik);
  rrect(ctx, -56, 572, 32, 10, 3, C.metalShade, LWB * 0.5, ik);
  // roof: front slope with shingles + hip on the right
  const rL = H0.L - 60, rR = H0.R + 46, re = H0.eave + 6, rt = H0.ridge, hipX = H0.R - 150;
  const roof = [[rL, re], [rR, re], [hipX, rt], [rL, rt]];
  fillPoly(ctx, roof, C.roof, 0);
  ctx.save(); ctx.beginPath(); poly(ctx, roof); ctx.clip();
  // hip facet shade
  ctx.fillStyle = C.roofShade; ctx.beginPath(); poly(ctx, [[hipX, rt], [rR, re], [hipX + 20, re]]); ctx.fill();
  // shingle scallops (skipping the ones the tree crown will cover)
  const canopy = canopyCircles(P);
  ctx.beginPath();
  for (let r = 0, y = rt + 32; y < re; y += 32, r++) {
    for (let x = rL + (r % 2 ? 22 : 0); x < rR; x += 44) {
      if (x + 48 < P.V.x0 || x > P.V.x1 || y < P.V.y0 || y - 24 > P.V.y1) continue;
      if (canopy.some(([cx, cy, cr]) => Math.hypot(x + 22 - cx, y - 11 - cy) < cr - 36)) continue; // behind the tree
      ctx.moveTo(x, y); ctx.arc(x + 22, y, 22, Math.PI, 0, true);
    }
  }
  ctx.strokeStyle = C.roofLine; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); poly(ctx, roof); ink(ctx, null, LWB, ik);
  // ridge cap highlight
  ctx.beginPath(); ctx.moveTo(rL, rt + 4); ctx.lineTo(hipX - 6, rt + 4); ctx.strokeStyle = rgba('#ffffff', 0.3 * (1 - P.sil)); ctx.lineWidth = 5; ctx.stroke();
  // chimney
  const chx = -200;
  rrect(ctx, chx - 30, 150, 64, 106, 2, C.brick, LWB * 0.85, ik);
  ctx.save(); rrectPath(ctx, chx - 30, 150, 64, 106, 2); ctx.clip();
  ctx.fillStyle = C.brickShade; ctx.fillRect(chx + 14, 150, 20, 110);
  ctx.beginPath();
  for (let r = 0, y = 170; y < 256; y += 18, r++) { ctx.moveTo(chx - 30, y); ctx.lineTo(chx + 34, y); for (let x = chx - 30 + (r % 2 ? 16 : 0); x < chx + 34; x += 32) { ctx.moveTo(x, y - 18); ctx.lineTo(x, y); } }
  ctx.strokeStyle = C.brickShade; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
  rrect(ctx, chx - 38, 140, 80, 16, 3, C.concrete, LWB * 0.8, ik);
  // gutter
  rrect(ctx, rL - 4, re - 4, rR - rL + 8, 16, 7, C.metal, LWB * 0.75, ik);
}

// ---------------------------------------------------------------- tree + tire swing
const CANOPY = [
  [0, -10, 150], [-150, 35, 110], [150, 40, 112], [-90, -125, 108], [92, -120, 110],
  [0, -180, 95], [-205, -45, 82], [212, -35, 86], [-70, 118, 96], [80, 120, 98],
];
function treeWind(P) {
  const gust = P.wind * (0.75 + 0.25 * noise1(P.t * 1.7, 5));
  return { gust, bend: P.wd * gust * 88 + 2.5 * sway(P.t, 4) };
}
function canopyCircles(P) {
  const { bend } = treeWind(P);
  return CANOPY.map(([x, y, r], i) => {
    const hgt = clamp((260 - y) / 460);
    const fl = P.wind * 7 * noise1(P.t * 6 + i * 3.3, 60);
    return [TREE.cx + x + bend * (0.55 + 0.6 * hgt) + fl, TREE.cy + y + Math.abs(bend) * 0.05 * (x / 100) + fl * 0.5, r];
  });
}
function swingState(P) {
  const { bend, gust } = treeWind(P);
  const ax = SWING.ax + bend * 0.45, ay = SWING.ay;
  const th = 0.06 * sway(P.t, 4) + P.wd * gust * 0.55 + P.wind * 0.18 * noise1(P.t * 3, 7);
  // th > 0 swings the tire to the right
  return { ax, ay, th, tx: ax + Math.sin(th) * SWING.len, ty: ay + Math.cos(th) * SWING.len };
}
function drawTree(ctx, P) {
  if (!inV(P.V, TREE.cx - 430, 20, TREE.cx + 450, 900)) return;
  const { C, t } = P, ik = P.inkC;
  const { bend } = treeWind(P);
  const x = TREE.x, b = TREE.base, topY = 430, tb = bend * 0.5;
  // branches (behind canopy)
  limb(ctx, [[x + 8 + tb * 0.6, 640], [x + 120 + tb * 0.7, 560], [SWING.ax + bend * 0.45 + 40, 536]], 22, C.bark, LWB, ik);
  limb(ctx, [[x - 10 + tb * 0.7, 560], [x - 80 + tb * 0.85, 490], [x - 130 + bend * 0.9, 440]], 22, C.bark, LWB, ik);
  limb(ctx, [[x + 10 + tb * 0.8, 520], [x + 90 + bend * 0.9, 430], [x + 140 + bend, 380]], 20, C.bark, LWB, ik);
  // trunk
  const tr = [
    [x - 72, b], [x - 44, b - 22], [x - 40, b - 120], [x - 30 + tb * 0.5, b - 280], [x - 26 + tb, topY],
    [x + 26 + tb, topY], [x + 30 + tb * 0.5, b - 280], [x + 40, b - 120], [x + 46, b - 22], [x + 80, b],
  ];
  ctx.beginPath(); ctx.moveTo(tr[0][0], tr[0][1]);
  ctx.quadraticCurveTo(tr[1][0], tr[1][1] + 6, tr[2][0], tr[2][1]);
  ctx.quadraticCurveTo(tr[3][0], tr[3][1], tr[4][0], tr[4][1]);
  ctx.lineTo(tr[5][0], tr[5][1]);
  ctx.quadraticCurveTo(tr[6][0], tr[6][1], tr[7][0], tr[7][1]);
  ctx.quadraticCurveTo(tr[8][0], tr[8][1] + 6, tr[9][0], tr[9][1]);
  ctx.closePath();
  ctx.fillStyle = C.bark; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = C.barkShade;
  ctx.beginPath(); ctx.moveTo(x + 14 + tb, topY); ctx.quadraticCurveTo(x + 18 + tb * 0.5, b - 280, x + 22, b - 110); ctx.quadraticCurveTo(x + 30, b - 20, x + 50, b); ctx.lineTo(x + 120, b); ctx.lineTo(x + 120, topY); ctx.fill();
  ctx.beginPath();
  for (const [bx, y0, y1] of [[-16, 800, 740], [6, 700, 620], [-8, 560, 500], [20, 780, 720]]) {
    const k = (b - y0) / (b - topY);
    ctx.moveTo(x + bx + tb * k, y0); ctx.quadraticCurveTo(x + bx + 6 + tb * k, (y0 + y1) / 2, x + bx + tb * k, y1);
  }
  ctx.strokeStyle = C.barkLine; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
  ink(ctx, null, LWB, ik);
  // knot hole
  ellipse(ctx, x - 4 + tb * 0.3, 690, 11, 15, mixColor('#2a1a20', SIL.near, P.sil), LWB * 0.6, ik);
  // canopy
  const cs = canopyCircles(P);
  // ink pass; a lobe whose outline ring is entirely inside other lobes never shows its ink: skip it
  ctx.fillStyle = ik;
  cs.forEach(([a, bb, r], i) => {
    let interior = true;
    for (let k = 0; k < 20 && interior; k++) {
      const ang = (k / 20) * TAU, px = a + Math.cos(ang) * (r + LWB), py = bb + Math.sin(ang) * (r + LWB);
      interior = cs.some(([a2, b2, r2], j) => j !== i && Math.hypot(px - a2, py - b2) < r2 - LWB);
    }
    if (!interior) { circlePath(ctx, a, bb, r + LWB / 2); ctx.fill(); }
  });
  ctx.fillStyle = C.leafShade;
  for (const [a, bb, r] of cs) { circlePath(ctx, a, bb, r - LWB / 2 + 0.5); ctx.fill(); }
  ctx.fillStyle = C.leaf;
  for (const [a, bb, r] of cs) { const k = 0.15 * r; circlePath(ctx, a - k * 0.55, bb - k * 0.83, r - LWB / 2 - k); ctx.fill(); }
  ctx.save(); // (the texture + highlights below sit well inside the lobes: no clip needed)
  // leaf texture: little "u" clumps
  ctx.strokeStyle = C.leafDot; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const c = cs[i % cs.length];
    const a = hash01(i, 63) * TAU, d = Math.sqrt(hash01(i, 64)) * c[2] * 0.8;
    const lx = c[0] + Math.cos(a) * d, ly = c[1] + Math.sin(a) * d;
    if (lx < P.V.x0 - 12 || lx > P.V.x1 + 12 || ly < P.V.y0 - 12 || ly > P.V.y1 + 12) continue;
    ctx.beginPath(); ctx.moveTo(lx - 9, ly - 3); ctx.quadraticCurveTo(lx, ly + 7, lx + 9, ly - 3); ctx.stroke();
  }
  // highlights (upper-left)
  ctx.fillStyle = C.leafLight;
  ctx.beginPath();
  for (const k of [0, 3, 5, 6, 1]) { const [a, bb, r] = cs[k]; ctx.moveTo(a - r * 0.35 + r * 0.32, bb - r * 0.42); ctx.ellipse(a - r * 0.35, bb - r * 0.42, r * 0.32, r * 0.18, -0.5, 0, TAU); }
  ctx.fill();
  ctx.restore();
  // an apple or two (tiny red dots) for charm
  for (const [dx, dy] of [[-40, 60], [120, -20], [-150, 20]]) {
    const c = cs[0];
    circle(ctx, c[0] + dx, c[1] + dy, 8, C.f3, LWB * 0.45, ik);
  }
  // tire swing
  const s = swingState(P);
  limb(ctx, [[s.ax, s.ay], [s.tx - 38 * Math.sin(s.th), s.ty - 38 * Math.cos(s.th)]], 5, C.rope, 2.5, ik, false);
  ctx.save(); ctx.translate(s.tx, s.ty); ctx.rotate(-s.th);
  ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU);
  ctx.strokeStyle = ik; ctx.lineWidth = 22 + 2 * LWB; ctx.stroke();
  ctx.strokeStyle = C.tire; ctx.lineWidth = 22; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 31, Math.PI * 1.05, Math.PI * 1.6); ctx.strokeStyle = C.tireLight; ctx.lineWidth = 6; ctx.stroke();
  // tread ticks
  ctx.beginPath(); for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; ctx.moveTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42); }
  ctx.strokeStyle = mixColor(C.tire, ik, 0.4); ctx.lineWidth = 2.5; ctx.stroke();
  // rope knot
  circle(ctx, 0, -38, 6, C.rope, 2.5, ik);
  ctx.restore();
}

// ---------------------------------------------------------------- doghouse
function drawDoghouse(ctx, P) {
  if (!inV(P.V, DOGH.x - 150, DOGH.base - 240, DOGH.x + 190, DOGH.base + 50)) return;
  const { C, t } = P, ik = P.inkC;
  const x = DOGH.x, b = DOGH.base, hw = 92, eave = b - 112, peak = b - 196;
  const wall = [[x - hw, b], [x - hw, eave], [x, peak], [x + hw, eave], [x + hw, b]];
  fillPoly(ctx, wall, C.dwall, 0);
  ctx.fillStyle = C.dline;
  for (let px = x - hw + 23; px < x + hw - 4; px += 23) { const y0 = lerp(peak, eave, Math.abs(px - x) / hw) + 2; ctx.fillRect(px - 1.5, y0, 3, b - y0); }
  ctx.fillStyle = C.dwallShade;
  ctx.beginPath(); poly(ctx, [[x - hw, eave], [x, peak], [x + hw, eave], [x + hw, b], [x + hw - 26, b], [x + hw - 26, eave + 20], [x, peak + 30], [x - hw, eave + 26]]); ctx.fill();
  ctx.beginPath(); poly(ctx, wall); ink(ctx, null, LWB, ik);
  // door arch
  ctx.beginPath(); ctx.moveTo(x - 32, b); ctx.lineTo(x - 32, b - 54); ctx.arc(x, b - 54, 32, Math.PI, 0); ctx.lineTo(x + 32, b); ctx.closePath();
  ink(ctx, C.hole, LWB, ik);
  // cushion peeking + trim arch
  ctx.beginPath(); ctx.ellipse(x + 3, b - 2, 26, 11, 0, Math.PI, TAU); ctx.closePath();
  ctx.fillStyle = mixColor(C.droofShade, C.hole, 0.35); ctx.fill();
  ctx.beginPath(); ctx.arc(x, b - 54, 38, Math.PI, 0); ctx.strokeStyle = ik; ctx.lineWidth = 12; ctx.stroke(); ctx.strokeStyle = C.dwallShade; ctx.lineWidth = 5; ctx.stroke();
  // roof strip
  const rw = 30;
  const roof = thickStrip([[x - hw - 24, eave + 12], [x, peak - 14], [x + hw + 24, eave + 12]], rw);
  fillPoly(ctx, roof, C.droof, 0);
  fillPoly(ctx, [roof[1], roof[2], roof[3], roof[4]], C.droofShade, 0); // right half ([L0,L1,L2,R2,R1,R0])
  // shingle bumps
  ctx.beginPath();
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
    const u = (k + 0.5) / 6;
    const px = x + s * (hw + 24) * u, py = lerp(peak - 14, eave + 12, u) + 7;
    ctx.moveTo(px + 7, py); ctx.arc(px, py, 7, 0, Math.PI);
  }
  ctx.strokeStyle = rgba(ik, 0.35); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); poly(ctx, roof); ink(ctx, null, LWB, ik);
  ctx.beginPath(); ctx.moveTo(x - hw - 14, eave - 4); ctx.lineTo(x - 8, peak - 26); ctx.strokeStyle = rgba('#ffffff', 0.4 * (1 - P.sil)); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
  // BISCUIT sign
  ctx.save(); ctx.translate(x, b - 134); ctx.rotate(-0.05 + 0.02 * sway(t, 8));
  rrect(ctx, -58, -15, 116, 30, 5, C.sign, LWB * 0.7, ik);
  ctx.fillStyle = mixColor(C.boneShade, SIL.near, P.sil); ctx.fillRect(-55, 7, 110, 5);
  if (P.sil < 0.95) text(ctx, 'BISCUIT', 0, 1, 21, C.signInk, 0, FONT.title);
  circle(ctx, -50, -7, 2.5, ik, 0); circle(ctx, 50, -7, 2.5, ik, 0);
  ctx.restore();
  // bowl
  const bx = x + 136, by = b + 14;
  ctx.beginPath(); ctx.moveTo(bx - 34, by - 22); ctx.lineTo(bx + 34, by - 22); ctx.lineTo(bx + 26, by); ctx.lineTo(bx - 26, by); ctx.closePath();
  ink(ctx, C.bowl, LWB * 0.8, ik);
  ctx.fillStyle = C.bowlShade; ctx.fillRect(bx + 8, by - 20, 20, 18);
  blobs(ctx, [[bx - 16, by - 24, 7], [bx - 4, by - 27, 7], [bx + 9, by - 25, 7], [bx + 20, by - 23, 6]], C.kibble, LWB * 0.5, ik);
  ellipse(ctx, bx, by - 22, 34, 5, null, LWB * 0.8, ik);
  // bone on the lawn
  ctx.save(); ctx.translate(x - 118, b + 30); ctx.rotate(-0.3);
  blobs(ctx, [[-17, -5, 7], [-17, 5, 7], [17, -5, 7], [17, 5, 7], { rr: [-17, -5, 34, 10, 4] }], C.bone, LWB * 0.6, ik);
  ctx.restore();
}

// ---------------------------------------------------------------- garage (tall workshop barn)
// y of the barn's gambrel roofline at x
function barnTop(x) {
  const G = GARAGE, d = Math.abs(x - G.cx), half = G.cx - G.L;
  if (d >= half) return G.eave;
  if (d >= half - G.kneeIn) return lerp(G.knee, G.eave, (d - (half - G.kneeIn)) / G.kneeIn);
  return lerp(G.peak, G.knee, d / (half - G.kneeIn));
}
const barnFace = () => {
  const G = GARAGE;
  return [[G.L, G.base], [G.L, G.eave], [G.L + G.kneeIn, G.knee], [G.cx, G.peak], [G.R - G.kneeIn, G.knee], [G.R, G.eave], [G.R, G.base]];
};
function garageDoorPanel(ctx, P, open) {
  const { C } = P, ik = P.inkC, G = GARAGE;
  const w = G.doorR - G.doorL, h = G.base - G.doorTop, n = G.panels;
  const bottom = G.doorTop + h * (1 - open);
  if (bottom - G.doorTop < 1) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(G.doorL, G.doorTop, w, bottom - G.doorTop); ctx.clip();
  ctx.fillStyle = C.gdoor; ctx.fillRect(G.doorL, G.doorTop, w, h);
  const ph = h / n, off = -h * open;
  // one shade strip under each panel joint + a shade band on the right edge (light from upper-left)
  ctx.fillStyle = C.gdoorShade;
  for (let k = 0; k < n; k++) { const y = G.doorTop + off + (k + 1) * ph; if (y > G.doorTop - 12 && y < bottom + 12) ctx.fillRect(G.doorL, y - 11, w, 11); }
  ctx.fillRect(G.doorR - 22, G.doorTop, 22, h);
  ctx.beginPath();
  for (let k = 0; k < n; k++) { const y = G.doorTop + off + (k + 1) * ph; ctx.moveTo(G.doorL, y); ctx.lineTo(G.doorR, y); }
  for (let c = 1; c < 5; c++) {
    const x = G.doorL + (c * w) / 5;
    for (let r = 0; r < n; r++) { if (r === 2) continue; const y = G.doorTop + off + r * ph; ctx.moveTo(x, y + 12); ctx.lineTo(x, y + ph - 18); }
  }
  ctx.strokeStyle = C.gdoorLine; ctx.lineWidth = 3; ctx.stroke();
  // a row of windows in the third panel (warm at night when the bulb is on)
  const gl = P.lights * (P.bulb || 0) * (1 - P.sil);
  for (let c = 0; c < 5; c++) {
    const x = G.doorL + (c + 0.5) * (w / 5), y = G.doorTop + off + 2 * ph + 11;
    rrect(ctx, x - 30, y, 60, ph - 30, 5, gl > 0.02 ? mixColor(C.glassShade, WARM, gl) : C.glassShade, LWB * 0.6, ik);
    if (gl <= 0.02) { ctx.fillStyle = rgba('#ffffff', 0.45 * (1 - P.sil)); ctx.fillRect(x - 24, y + 4, 12, 5); }
  }
  // bottom seal + handle
  ctx.fillStyle = mixColor('#3b3344', SIL.near, P.sil); ctx.fillRect(G.doorL, bottom - 8, w, 8);
  rrect(ctx, G.doorL + w / 2 - 30, bottom - 32, 60, 12, 6, C.metal, LWB * 0.6, ik);
  ctx.restore();
  ctx.beginPath(); ctx.rect(G.doorL, G.doorTop, w, bottom - G.doorTop); ink(ctx, null, LWB * 0.9, ik);
}
// What you see through the open door: a dim workshop (pegboard, shelves of tins, bench + vice,
// rafters) lit by a bulb that swings on the beat.
function drawGarageInterior(ctx, P, bulb) {
  const { C, t } = P, ik = P.inkC, G = GARAGE;
  const x0 = G.doorL, x1 = G.doorR, y0 = G.doorTop, y1 = G.base, w = x1 - x0;
  const dk = (c, k = 0.45) => mixColor(c, C.dark, k);
  const lk = mixColor(ik, C.dark, 0.25);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, y1 - y0); ctx.clip();
  // back wall boards, darker toward the rafters
  ctx.fillStyle = C.darkWall; ctx.fillRect(x0, y0, w, y1 - y0);
  ctx.fillStyle = C.dark; ctx.fillRect(x0, y0, w, 70); ctx.fillRect(x0, y0, 20, y1 - y0); ctx.fillRect(x1 - 20, y0, 20, y1 - y0);
  ctx.beginPath(); for (let x = x0 + 40; x < x1 - 20; x += 38) { ctx.moveTo(x, y0 + 70); ctx.lineTo(x, y1 - 60); }
  ctx.strokeStyle = rgba(C.dark, 0.7); ctx.lineWidth = 3; ctx.stroke();
  // rafters + tie beam
  ctx.fillStyle = dk(C.bench, 0.62);
  ctx.beginPath(); poly(ctx, [[x0, y0 + 64], [x0 + w / 2, y0 + 8], [x1, y0 + 64], [x1, y0 + 80], [x0 + w / 2, y0 + 24], [x0, y0 + 80]]); ctx.fill();
  ctx.fillRect(x0, y0 + 62, w, 16);
  // pegboard + tools (left)
  const px = x0 + 36, py = y0 + 170, pw = 170, phh = 150;
  rrect(ctx, px, py, pw, phh, 3, dk(C.peg, 0.3), 2.5, lk);
  ctx.fillStyle = dk(C.pegDot, 0.2);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) ctx.fillRect(px + 12 + i * 21, py + 12 + j * 24, 3, 3);
  const tl = dk(C.metal, 0.45), th = dk(C.f3, 0.4), tw = dk(C.bench, 0.3);
  rrect(ctx, px + 20, py + 26, 12, 80, 3, tw, 2, lk); rrect(ctx, px + 8, py + 18, 38, 16, 3, tl, 2, lk); // hammer
  ctx.save(); ctx.translate(px + 70, py + 76); ctx.rotate(0.15);
  rrect(ctx, -5, -46, 10, 84, 4, tl, 2, lk); circle(ctx, 0, -48, 12, tl, 2, lk); circle(ctx, 0, -50, 5, dk(C.peg, 0.3), 0); ctx.restore(); // wrench
  ctx.beginPath(); poly(ctx, [[px + 98, py + 30], [px + 134, py + 30], [px + 134, py + 124], [px + 102, py + 56]]); ink(ctx, tl, 2, lk); // saw
  rrect(ctx, px + 96, py + 16, 42, 20, 6, th, 2, lk);
  rrect(ctx, px + 146, py + 30, 9, 44, 3, dk(C.f2, 0.4), 2, lk); rrect(ctx, px + 149, py + 74, 3, 40, 1, tl, 1.5, lk); // screwdriver
  // workbench + vice (left, under the pegboard)
  const by = y1 - 150;
  rrect(ctx, x0 + 16, by, 230, 22, 3, dk(C.bench, 0.35), 2.5, lk);
  ctx.fillStyle = dk(C.benchShade, 0.4); ctx.fillRect(x0 + 28, by + 22, 16, 128); ctx.fillRect(x0 + 216, by + 22, 16, 128); ctx.fillRect(x0 + 28, by + 92, 204, 12);
  rrect(ctx, x0 + 180, by - 30, 48, 30, 4, tl, 2, lk); rrect(ctx, x0 + 170, by - 22, 12, 14, 2, tl, 2, lk);
  rrect(ctx, x0 + 60, by - 24, 20, 24, 3, dk(C.f1, 0.45), 2, lk); // mug
  rrect(ctx, x0 + 90, by - 12, 70, 12, 6, dk(C.glass, 0.5), 2, lk); // rolled blueprint
  // shelves of paint tins (right)
  const sx0 = x1 - 190, sx1 = x1 - 20;
  const tins = [C.f3, C.gwall, C.f2, C.sign, C.f1, C.bowl];
  for (let r = 0; r < 3; r++) {
    const sy = y0 + 200 + r * 110;
    for (let i = 0; i < 3; i++) {
      const tx = sx0 + 14 + i * 52 + (r % 2) * 10, col = dk(tins[(r * 3 + i) % tins.length], 0.42);
      rrect(ctx, tx, sy - 46, 40, 46, 4, col, 2, lk);
      ctx.fillStyle = dk(C.metal, 0.5); ctx.fillRect(tx, sy - 46, 40, 7);
      ctx.fillStyle = rgba('#ffffff', 0.12 * (1 - P.sil)); ctx.fillRect(tx + 6, sy - 34, 6, 26);
    }
    rrect(ctx, sx0, sy, sx1 - sx0, 12, 2, dk(C.bench, 0.4), 2.5, lk);
  }
  // floor
  ctx.fillStyle = mixColor(C.dark, '#ffffff', 0.07); ctx.fillRect(x0, y1 - 56, w, 56);
  ctx.fillStyle = rgba(C.dark, 0.6); ctx.fillRect(x0, y1 - 58, w, 4);
  // hanging bulb (swings on the beat) + warm pool
  const sw = 0.12 * sway(t, 4);
  const bx0 = x0 + w * 0.46, by0 = y0 + 78, L = 150;
  const bx = bx0 + Math.sin(sw) * L, bby = by0 + Math.cos(sw) * L;
  if (bulb > 0) {
    glow(ctx, bx, bby, 240, WARM, 0.32 * bulb);
    glow(ctx, bx, bby, 90, WARM, 0.45 * bulb);
    ctx.save(); ctx.translate(bx, y1 - 28); ctx.scale(1, 0.2);
    glow(ctx, 0, 0, 220, WARM, 0.45 * bulb);
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx, bby - 10); ctx.strokeStyle = '#141019'; ctx.lineWidth = 3; ctx.stroke();
  rrect(ctx, bx - 6, bby - 14, 12, 11, 2, '#6d6778', 1.5, '#141019');
  circle(ctx, bx, bby + 5, 12, bulb > 0 ? mixColor('#8a8070', '#fff6c8', bulb) : '#8a8070', 2.5, '#141019');
  if (bulb > 0) glow(ctx, bx, bby + 5, 40, '#ffffff', 0.7 * bulb);
  ctx.restore();
}
// garage bulb: explicit o.bulb, else on at night, else switched on as the door starts to open
const defaultBulb = (o, P, open) => (o.bulb !== undefined ? clamp(o.bulb) : P.tod === 'night' ? 1 : clamp(open / 0.12));
function drawGarage(ctx, P, o) {
  const { C, t } = P, ik = P.inkC, G = GARAGE;
  if (!inV(P.V, G.L - 60, G.peak - 110, G.R + 60, G.base + 20)) return;
  const open = clamp(o.garageDoor || 0);
  const face = barnFace();
  fillPoly(ctx, face, C.gwall, 0);
  // vertical boards as rects from the roofline down (no clip)
  ctx.fillStyle = C.gline;
  for (let x = G.L + 26; x < G.R - 4; x += 30) { const y0 = barnTop(x) + 3; ctx.fillRect(x - 1.5, y0, 3, G.base - 16 - y0); }
  // one shade shape: band under the roofline + right side strip (light from upper-left)
  ctx.fillStyle = C.gwallShade;
  ctx.beginPath(); poly(ctx, [[G.L, G.eave], [G.L + G.kneeIn, G.knee], [G.cx, G.peak], [G.R - G.kneeIn, G.knee], [G.R, G.eave], [G.R, G.base],
    [G.R - 46, G.base], [G.R - 46, G.eave + 28], [G.R - G.kneeIn - 8, G.knee + 34], [G.cx, G.peak + 36], [G.L + G.kneeIn + 8, G.knee + 34], [G.L, G.eave + 36]]); ctx.fill();
  // base plinth
  ctx.fillStyle = C.concrete; ctx.fillRect(G.L, G.base - 16, G.R - G.L, 16);
  ctx.fillStyle = C.concreteShade; ctx.fillRect(G.L, G.base - 6, G.R - G.L, 6);
  ctx.beginPath(); poly(ctx, face); ink(ctx, null, LWB, ik);
  // white corner boards (barn trim)
  rrect(ctx, G.L, G.eave + 4, 18, G.base - G.eave - 20, 0, C.trim, LWB * 0.7, ik);
  rrect(ctx, G.R - 18, G.eave + 4, 18, G.base - G.eave - 20, 0, C.trimShade, LWB * 0.7, ik);
  // round vent high in the gable
  const vy = G.peak + 44;
  circle(ctx, G.cx, vy, 27, C.trim, LWB * 0.8, ik);
  circle(ctx, G.cx, vy, 17, mixColor(C.dark, C.gwallShade, 0.3), LWB * 0.5, ik);
  ctx.beginPath(); for (const d of [-8, 0, 8]) { ctx.moveTo(G.cx - 15, vy + d); ctx.lineTo(G.cx + 15, vy + d); }
  ctx.strokeStyle = C.trim; ctx.lineWidth = 3.5; ctx.stroke();
  // door frame, interior, door
  const w = G.doorR - G.doorL;
  rrect(ctx, G.doorL - 16, G.doorTop - 18, w + 32, G.base - G.doorTop + 18, 3, C.trim, LWB * 0.9, ik);
  ctx.fillStyle = C.trimShade; ctx.fillRect(G.doorR + 2, G.doorTop - 4, 11, G.base - G.doorTop);
  const bulb = defaultBulb(o, P, open);
  if (open > 0.001) drawGarageInterior(ctx, P, bulb);
  garageDoorPanel(ctx, { ...P, bulb }, open);
  // header strip the door rolls up under
  rrect(ctx, G.doorL - 16, G.doorTop - 18, w + 32, 20, 3, C.trim, LWB * 0.9, ik);
  // sign
  ctx.save(); ctx.translate(G.cx, G.doorTop - 64); ctx.rotate(0.015);
  rrect(ctx, -126, -27, 252, 54, 8, C.sign, LWB * 0.85, ik);
  ctx.fillStyle = mixColor(C.boneShade, SIL.near, P.sil); ctx.fillRect(-122, 15, 244, 8);
  if (P.sil < 0.95) {
    text(ctx, 'WORKSHOP', 12, 1, 33, mixColor('#2c5fb8', SIL.near, P.sil), 0, FONT.title);
    ctx.save(); ctx.translate(-98, 0); ctx.fillStyle = C.signInk; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 5.5 : 13; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  // wall lantern left of the door (lit at dusk / night)
  const lx = G.L + 42, ly = 300;
  const lamp = P.lights > 0.5 ? P.lights : 0;
  if (lamp > 0) {
    glow(ctx, lx, ly, 110, WARM, 0.5 * lamp * P.glowK + 0.15 * lamp);
    ctx.fillStyle = rgba(WARM, 0.1 * lamp * P.glowK);
    ctx.beginPath(); poly(ctx, [[lx - 12, ly + 24], [lx + 12, ly + 24], [lx + 36, G.base - 16], [lx - 36, G.base - 16]]); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(lx - 16, ly - 30); ctx.lineTo(lx - 16, ly - 44); ctx.lineTo(lx, ly - 44); ctx.lineTo(lx, ly - 22);
  ctx.strokeStyle = ik; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = C.metalShade; ctx.lineWidth = 3.5; ctx.stroke();
  rrect(ctx, lx - 13, ly - 24, 26, 42, 6, lamp > 0 ? mixColor('#fff3c0', WARM, 0.3) : C.glass, LWB * 0.6, ik);
  rrect(ctx, lx - 17, ly - 30, 34, 10, 3, C.metalShade, LWB * 0.5, ik);
  rrect(ctx, lx - 12, ly + 16, 24, 7, 3, C.metalShade, LWB * 0.5, ik);
  // roof edge (gambrel barge boards)
  const roof = thickStrip([[G.L - 34, G.eave + 16], [G.L + G.kneeIn - 2, G.knee - 10], [G.cx, G.peak - 16], [G.R - G.kneeIn + 2, G.knee - 10], [G.R + 34, G.eave + 16]], 32);
  fillPoly(ctx, roof, C.roof, 0);
  fillPoly(ctx, [roof[2], roof[3], roof[4], roof[5], roof[6], roof[7]], C.roofShade, 0); // right half (strip is [L0..L4, R4..R0])
  ctx.beginPath(); poly(ctx, roof); ink(ctx, null, LWB, ik);
  ctx.beginPath(); ctx.moveTo(G.L - 22, G.eave - 4); ctx.lineTo(G.L + G.kneeIn - 8, G.knee - 26); ctx.lineTo(G.cx - 12, G.peak - 30);
  ctx.strokeStyle = rgba('#ffffff', 0.35 * (1 - P.sil)); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  // rocket weather vane (spins with wind)
  const vx = G.cx, vy0 = G.peak - 32;
  const spin = P.wind > 0.05 ? t * 9 * P.wind : 0.25 * sway(t, 8);
  const sx = Math.cos(spin);
  ctx.beginPath(); ctx.moveTo(vx, vy0); ctx.lineTo(vx, vy0 - 66); ctx.strokeStyle = ik; ctx.lineWidth = 5; ctx.stroke();
  circle(ctx, vx, vy0 - 22, 6, C.metal, 2.5, ik);
  ctx.save(); ctx.translate(vx, vy0 - 64); ctx.scale(sx >= 0 ? Math.max(0.12, sx) : Math.min(-0.12, sx), 1);
  ctx.beginPath(); ctx.moveTo(34, 0); ctx.quadraticCurveTo(22, -10, -18, -8); ctx.lineTo(-30, -18); ctx.lineTo(-26, 0); ctx.lineTo(-30, 18); ctx.lineTo(-18, 8); ctx.quadraticCurveTo(22, 10, 34, 0); ctx.closePath();
  ink(ctx, C.f3, 3, ik);
  circle(ctx, 8, 0, 4, C.glass, 2, ik);
  ctx.restore();
}

// ---------------------------------------------------------------- gnome + flower beds
function drawGnome(ctx, P, o) {
  if (!inV(P.V, GNOME.x - 180, GNOME.base - 160, GNOME.x + 180, GNOME.base + 20)) return;
  const { C } = P, ik = P.inkC;
  const f = clamp(o.gnomeFall || 0);
  const ang = 1.42 * ease.outBounce(f);
  const dir = o.gnomeDir === undefined ? 1 : Math.sign(o.gnomeDir) || 1;
  ctx.save();
  ctx.translate(GNOME.x + dir * 22, GNOME.base); ctx.rotate(dir * ang); ctx.translate(-dir * 22, 0);
  const lw = LWB * 0.75;
  // boots
  ellipse(ctx, -12, -7, 14, 9, C.gBoot, lw, ik);
  ellipse(ctx, 13, -7, 14, 9, C.gBoot, lw, ik);
  // coat
  ctx.beginPath(); ctx.moveTo(-26, -10); ctx.quadraticCurveTo(-26, -58, -14, -66); ctx.lineTo(14, -66); ctx.quadraticCurveTo(26, -58, 26, -10); ctx.quadraticCurveTo(0, -4, -26, -10); ctx.closePath();
  ink(ctx, C.gCoat, lw, ik);
  ctx.save(); ctx.clip(); ctx.fillStyle = C.gCoatShade; ctx.fillRect(10, -70, 20, 70); ctx.restore();
  ctx.fillStyle = C.gBelt; ctx.fillRect(-24, -30, 48, 8);
  rrect(ctx, -6, -32, 12, 12, 2, C.brass, 2, ik);
  // arms + mittens holding a tiny spade
  limb(ctx, [[-20, -54], [-26, -36], [-14, -30]], 11, C.gCoat, lw * 0.8, ik);
  ctx.save(); ctx.translate(20, -40); ctx.rotate(0.25);
  ctx.fillStyle = C.bark; ctx.strokeStyle = ik; ctx.lineWidth = 2.5;
  rrectPath(ctx, -3, -36, 6, 44, 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(9, 6); ctx.lineTo(6, 22); ctx.quadraticCurveTo(0, 28, -6, 22); ctx.closePath(); ink(ctx, C.metal, 2.5, ik);
  ctx.restore();
  limb(ctx, [[20, -54], [24, -40], [20, -34]], 11, C.gCoat, lw * 0.8, ik);
  circle(ctx, -13, -30, 6, C.gSkin, 2.5, ik);
  circle(ctx, 20, -34, 6, C.gSkin, 2.5, ik);
  // beard
  const beard = [[0, -52, 17], [-11, -60, 12], [11, -60, 12], [0, -40, 10]];
  blobs(ctx, beard, C.gBeard, lw, ik);
  ctx.save(); clipBlobs(ctx, beard.map(([a, b, r]) => [a, b, r - lw / 2])); ctx.fillStyle = C.gBeardShade; ellipsePath(ctx, 10, -44, 14, 16); ctx.fill(); ctx.restore();
  // face
  circle(ctx, 0, -74, 14, C.gSkin, lw, ik);
  ellipse(ctx, 0, -66, 17, 9, C.gBeard, 0); // moustache
  blobs(ctx, [[-7, -66, 7], [7, -66, 7]], C.gBeard, lw * 0.7, ik);
  circle(ctx, 0, -71, 6.5, C.gNose, lw * 0.6, ik);
  circle(ctx, -2, -73, 1.8, rgba('#ffffff', 0.8 * (1 - P.sil)), 0);
  ctx.beginPath(); ctx.arc(-7, -78, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.moveTo(10, -78); ctx.arc(7, -78, 3, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = ik; ctx.lineWidth = 2.4; ctx.stroke();
  // hat
  ctx.beginPath(); ctx.moveTo(-18, -80); ctx.quadraticCurveTo(-12, -118, 6, -140); ctx.quadraticCurveTo(14, -146, 20, -140);
  ctx.quadraticCurveTo(10, -128, 18, -80); ctx.quadraticCurveTo(0, -86, -18, -80); ctx.closePath();
  ink(ctx, C.gHat, lw, ik);
  ctx.save(); ctx.clip(); ctx.fillStyle = C.gHatShade; ctx.beginPath(); ctx.moveTo(6, -80); ctx.quadraticCurveTo(4, -110, 12, -134); ctx.lineTo(30, -134); ctx.lineTo(30, -76); ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-18, -80); ctx.quadraticCurveTo(-12, -118, 6, -140); ctx.quadraticCurveTo(14, -146, 20, -140); ctx.quadraticCurveTo(10, -128, 18, -80); ctx.quadraticCurveTo(0, -86, -18, -80); ctx.closePath(); ink(ctx, null, lw, ik);
  ctx.restore();
}

const BEDS = [
  { x0: 560, x1: 744, y: 798, seed: 3 },
  { x0: 1404, x1: 1540, y: 850, seed: 9 },
];
function flowerHead(ctx, P, x, y, r, kind, col) {
  const { C } = P, ik = P.inkC, lw = LW * 0.55;
  if (kind === 0) {
    const pet = [];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; pet.push([x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.52]); }
    blobs(ctx, pet, col, lw, ik);
    circle(ctx, x, y, r * 0.36, col === C.f2 ? C.f6 : C.f2, lw * 0.7, ik);
  } else if (kind === 1) {
    ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.6); ctx.lineTo(x - r * 0.4, y - r * 0.2); ctx.lineTo(x, y - r * 0.8); ctx.lineTo(x + r * 0.4, y - r * 0.2); ctx.lineTo(x + r * 0.8, y - r * 0.6);
    ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.7, x, y + r * 0.7); ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.7, x - r * 0.8, y - r * 0.6); ctx.closePath();
    ink(ctx, col, lw, ik);
    ctx.save(); ctx.clip(); ctx.fillStyle = rgba(ik, 0.18); ctx.fillRect(x + r * 0.2, y - r, r, 2 * r); ctx.restore();
  } else {
    blobs(ctx, [[x, y, r * 0.6], [x - r * 0.45, y + r * 0.2, r * 0.45], [x + r * 0.45, y + r * 0.2, r * 0.45], [x, y - r * 0.45, r * 0.45]], col, lw, ik);
    circle(ctx, x - r * 0.2, y - r * 0.2, r * 0.18, rgba('#ffffff', 0.6 * (1 - P.sil)), 0);
  }
}
function drawBed(ctx, P, bed) {
  if (!inV(P.V, bed.x0 - 40, bed.y - 110, bed.x1 + 40, bed.y + 24)) return;
  const { C, t } = P, ik = P.inkC;
  const { x0, x1, y, seed } = bed, cx = (x0 + x1) / 2, rx = (x1 - x0) / 2;
  // soil mound
  ctx.beginPath(); ctx.ellipse(cx, y, rx, 20, 0, Math.PI, TAU); ctx.quadraticCurveTo(cx, y + 10, cx - rx, y); ctx.closePath();
  ink(ctx, C.soil, LW * 0.7, ik);
  const cols = [C.f1, C.f2, C.f3, C.f4, C.f5, C.f6];
  const n = Math.floor((x1 - x0) / 24);
  const fl = [];
  for (let i = 0; i < n; i++) {
    const fx = x0 + 16 + (i + 0.5) * ((x1 - x0 - 32) / n) + (hash01(i, seed) - 0.5) * 8;
    const hgt = 30 + 30 * hash01(i, seed + 1);
    const bob = 3.5 * sway(t + i * 0.08, 2) + P.wd * P.wind * 16 * (0.7 + 0.3 * noise1(t * 4 + i, 3));
    fl.push({ i, fx, hgt, bob, hx: fx + bob, hy: y - 6 - hgt });
  }
  // stems (one ink pass + one colour pass for the whole bed), then leaves, then heads
  ctx.beginPath();
  for (const f of fl) { ctx.moveTo(f.fx, y - 4); ctx.quadraticCurveTo(f.fx + f.bob * 0.4, y - 6 - f.hgt * 0.5, f.hx, f.hy); }
  ctx.lineCap = 'round'; ctx.strokeStyle = ik; ctx.lineWidth = 3.5 + 2 * LW * 0.45; ctx.stroke();
  ctx.strokeStyle = C.stem; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.beginPath();
  for (const f of fl) if (f.i % 2 === 0) { const lx = f.fx + f.bob * 0.3 + 7, ly = y - 14 - f.hgt * 0.3; ctx.moveTo(lx + 8 * Math.cos(-0.5), ly + 8 * Math.sin(-0.5)); ctx.ellipse(lx, ly, 8, 3.8, -0.5, 0, TAU); }
  ink(ctx, C.stemLeaf, LW * 0.4, ik);
  for (const f of fl) flowerHead(ctx, P, f.hx, f.hy, 11 + 4 * hash01(f.i, seed + 2), Math.floor(hash01(f.i, seed + 3) * 3), cols[Math.floor(hash01(f.i, seed + 4) * cols.length)]);
  // edging pebbles
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const px = cx - rx * 0.9 + (i / 5) * rx * 1.8, py = y + 6 + Math.sin((i / 5) * Math.PI) * 6;
    ctx.moveTo(px + 12, py); ctx.ellipse(px, py, 12, 7, 0, 0, TAU);
  }
  ink(ctx, C.stone, LW * 0.5, ik);
}

// ---------------------------------------------------------------- launch pad + crater
function crateBody(ctx, P, w, h, o = {}) {
  // local: bottom-left at (0,0), up is -y
  const { C } = P, ik = P.inkC;
  const top = o.jag ? o.jag : [[0, -h], [w, -h]];
  const outline = [[0, 0], ...top, [w, 0]];
  ctx.beginPath(); poly(ctx, outline); ctx.fillStyle = C.crate; ctx.fill();
  ctx.save(); ctx.beginPath(); poly(ctx, outline); ctx.clip();
  // inner slat gaps
  const fb = 13;
  ctx.beginPath();
  for (let k = 1; k < 3; k++) { const y = -fb - ((h - 2 * fb) * k) / 3; ctx.moveTo(fb, y); ctx.lineTo(w - fb, y); }
  ctx.strokeStyle = rgba(ik, 0.55); ctx.lineWidth = 2.5; ctx.stroke();
  // stencil
  if (o.label && P.sil < 0.9) {
    const sc = rgba(C.crateStencil, 0.75);
    text(ctx, o.label, w / 2 + 2, -h / 2 + 2, o.arrows ? 20 : 17, sc, -0.06, FONT.round);
    if (o.arrows) {
      ctx.fillStyle = sc; ctx.beginPath();
      for (const ax of [w / 2 - 30, w / 2 + 34]) { poly(ctx, [[ax - 3, -h / 2 + 12], [ax - 3, -h / 2 - 2], [ax - 8, -h / 2 - 2], [ax, -h / 2 - 12], [ax + 8, -h / 2 - 2], [ax + 3, -h / 2 - 2], [ax + 3, -h / 2 + 12]]); }
      ctx.fill();
    }
  }
  // frame boards + brace
  ctx.fillStyle = C.crateFrame;
  ctx.beginPath();
  ctx.rect(0, -h, w, fb); ctx.rect(0, -fb, w, fb); ctx.rect(0, -h, fb, h); ctx.rect(w - fb, -h, fb, h);
  ctx.moveTo(fb, -fb - 2); ctx.lineTo(fb + 12, -fb); ctx.lineTo(w - fb, -h + fb + 2); ctx.lineTo(w - fb - 12, -h + fb); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.rect(fb, -h + fb, w - 2 * fb, h - 2 * fb);
  ctx.moveTo(fb, -fb - 2); ctx.lineTo(fb + 12, -fb); ctx.lineTo(w - fb, -h + fb + 2); ctx.lineTo(w - fb - 12, -h + fb); ctx.closePath();
  ctx.strokeStyle = ik; ctx.lineWidth = 2.5; ctx.stroke();
  // shade (right side + bottom) & highlight
  ctx.fillStyle = rgba(C.crateShade, 0.75);
  ctx.beginPath(); poly(ctx, [[w - 22, -h], [w, -h], [w, 0], [0, 0], [0, -8], [w - 22, -8]]); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.35 * (1 - P.sil)); ctx.fillRect(3, -h + 3, w * 0.5, 4);
  // nails
  ctx.fillStyle = ik;
  ctx.beginPath(); for (const [nx, ny] of [[6, -h + 6], [w - 6, -h + 6], [6, -6], [w - 6, -6]]) { ctx.moveTo(nx + 2, ny); ctx.arc(nx, ny, 2, 0, TAU); } ctx.fill();
  // scorch
  if (o.scorch) {
    const g = ctx.createRadialGradient(o.sx, o.sy, 4, o.sx, o.sy, o.sr);
    g.addColorStop(0, rgba(C.char, 0.95 * o.scorch)); g.addColorStop(0.55, rgba(C.char, 0.6 * o.scorch)); g.addColorStop(1, rgba(C.char, 0));
    ctx.fillStyle = g; ctx.fillRect(-20, -h - 40, w + 40, h + 60);
  }
  ctx.restore();
  ctx.beginPath(); poly(ctx, outline); ink(ctx, null, LW, ik);
}
function loosePlank(ctx, P, x, y, len, rot, charred = 0.6) {
  const { C } = P, ik = P.inkC;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const pts = [[-len / 2, -7], [len / 2 - 8, -7], [len / 2, -2], [len / 2 - 5, 1], [len / 2 + 3, 7], [-len / 2, 7]];
  ctx.beginPath(); poly(ctx, pts); ctx.fillStyle = C.crateFrame; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = C.crateShade; ctx.fillRect(-len / 2, 2, len + 10, 6);
  const g = ctx.createLinearGradient(len / 2 - 30, 0, len / 2, 0);
  g.addColorStop(0, rgba(C.char, 0)); g.addColorStop(1, rgba(C.char, charred));
  ctx.fillStyle = g; ctx.fillRect(-len / 2, -10, len + 10, 20);
  ctx.restore();
  ctx.beginPath(); poly(ctx, pts); ink(ctx, null, LW * 0.85, ik);
  ctx.beginPath(); ctx.arc(-len / 2 + 8, 0, 2, 0, TAU); ctx.fillStyle = ik; ctx.fill();
  ctx.restore();
}
function drawPad(ctx, P, o) {
  const pad = o.pad || 'intact';
  if (pad === 'none' || !inV(P.V, 940, 690, 1560, 930)) return;
  const { C, t } = P;
  const { cw, ch, gap } = PAD;
  if (pad === 'intact') {
    const x0 = PAD.x - cw - gap / 2;
    ctx.save(); ctx.translate(x0, GY); crateBody(ctx, P, cw, ch, { label: 'FRAGILE' }); ctx.restore();
    ctx.save(); ctx.translate(PAD.x + gap / 2, GY); ctx.rotate(0.008); crateBody(ctx, P, cw, ch, { label: 'UP', arrows: true }); ctx.restore();
    return;
  }
  // wrecked: blown apart, tilted, splintered, scorched
  loosePlank(ctx, P, 1010, 884, 96, 0.28, 0.8);
  loosePlank(ctx, P, 1482, 882, 84, -0.2, 0.7);
  // left crate: tipped away from the blast, propped on debris
  loosePlank(ctx, P, 1122, 852, 70, -0.9, 0.9);
  ctx.save(); ctx.translate(1016, GY + 2); ctx.rotate(-0.3);
  crateBody(ctx, P, cw, ch, {
    label: 'FRAG', scorch: 1, sx: cw + 10, sy: -ch * 0.3, sr: 110,
    jag: [[0, -ch], [cw * 0.55, -ch], [cw * 0.62, -ch + 10], [cw * 0.72, -ch + 2], [cw * 0.8, -ch + 22], [cw * 0.9, -ch + 14], [cw, -ch + 34]],
  });
  ctx.restore();
  // right crate: splintered half
  ctx.save(); ctx.translate(1462, GY + 2); ctx.rotate(0.16); ctx.translate(-cw, 0);
  crateBody(ctx, P, cw, ch * 0.62, {
    scorch: 1, sx: -14, sy: -ch * 0.4, sr: 120,
    jag: [[0, -ch * 0.4], [cw * 0.12, -ch * 0.62 - 14], [cw * 0.2, -ch * 0.5], [cw * 0.32, -ch * 0.62 - 26], [cw * 0.44, -ch * 0.52], [cw * 0.56, -ch * 0.66], [cw * 0.7, -ch * 0.58], [cw * 0.84, -ch * 0.62 - 6], [cw, -ch * 0.62]],
  });
  ctx.restore();
  // plank stuck in the ground
  loosePlank(ctx, P, 1366, 834, 78, -1.15, 0.9);
  // splinters
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const sx = 1000 + hash01(i, 111) * 520, sy = 872 + hash01(i, 112) * 40, a = hash01(i, 113) * TAU, l = 10 + 10 * hash01(i, 114);
    if (Math.abs(sx - 1240) < 150 && sy < 890) continue;
    ctx.moveTo(sx - Math.cos(a) * l, sy - Math.sin(a) * l * 0.4); ctx.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l * 0.4);
  }
  ctx.strokeStyle = P.inkC; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = C.crateFrame; ctx.lineWidth = 3.5; ctx.stroke();
  // smouldering spots on the crate edges
  const em = clamp(o.embers === undefined ? 0 : o.embers);
  if (em > 0) {
    for (const [ex, ey, k] of [[1118, 790, 0], [1128, 822, 1], [1350, 806, 2], [1362, 836, 3]]) {
      const fl = 0.6 + 0.4 * noise1(t * 5 + k * 3, 120);
      glow(ctx, ex, ey, 26, '#ff8a3d', 0.7 * em * fl);
      circle(ctx, ex, ey, 3.2, rgba('#ffd06a', em * fl), 0);
    }
  }
}
function drawCrater(ctx, P, o) {
  if (!inV(P.V, 940, 780, 1540, 960)) return;
  const { C, t } = P, ik = P.inkC;
  const x = 1240, y = 870;
  // scorch starburst on the lawn
  ctx.beginPath();
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = i % 2 ? 0.62 + 0.12 * hash01(i, 101) : 0.9 + 0.35 * hash01(i, 102);
    const px = x + Math.cos(a) * 270 * k, py = y + Math.sin(a) * 58 * k;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = rgba(C.char, 0.5 + 0.2 * P.sil); ctx.fill();
  ellipse(ctx, x, y, 200, 40, rgba(C.char, 0.45), 0);
  // dirt rim
  const rim = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    rim.push([x + Math.cos(a) * 138, y + Math.sin(a) * 26 - 4, 16 + 8 * hash01(i, 103)]);
  }
  rim.push({ rr: [x - 140, y - 26, 280, 48, 24] });
  blobs(ctx, rim, C.soil, LW, ik);
  ctx.save(); clipBlobs(ctx, rim.map((s) => (Array.isArray(s) ? [s[0], s[1], s[2] - 3] : s)));
  ctx.fillStyle = C.soilShade; ctx.fillRect(x - 170, y + 6, 340, 40);
  ctx.fillStyle = C.soilLight; ellipsePath(ctx, x - 40, y - 26, 90, 8); ctx.fill();
  ctx.restore();
  // hole
  ellipse(ctx, x, y - 2, 112, 18, mixColor('#241a20', SIL.near, P.sil), LW * 0.9, ik);
  ctx.save(); ellipsePath(ctx, x, y - 2, 110, 16); ctx.clip();
  ctx.fillStyle = mixColor('#3b2a2c', SIL.near, P.sil); ellipsePath(ctx, x - 10, y - 12, 110, 14); ctx.fill();
  // glowing coals
  const em = clamp(o.embers === undefined ? 0 : o.embers);
  const hot = 0.25 + 0.75 * em;
  for (let i = 0; i < 7; i++) {
    const cx = x - 80 + i * 26 + 6 * hash01(i, 104), cy = y + 2 + 6 * hash01(i, 105);
    const fl = 0.55 + 0.45 * noise1(t * 4 + i * 2.1, 106);
    ellipse(ctx, cx, cy, 9, 4, rgba('#ff6a2a', hot * fl * (1 - P.sil)), 0);
  }
  ctx.restore();
  if (em > 0) glow(ctx, x, y, 150, '#ff7a3a', 0.35 * em);
  // clods
  for (let i = 0; i < 8; i++) {
    const a = hash01(i, 107) * TAU, d = 170 + 60 * hash01(i, 108);
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * 34 + 6, 5 + 4 * hash01(i, 109), C.soil, LW * 0.6, ik);
  }
}
function drawSmoke(ctx, P, o) {
  if (!inV(P.V, 900, 540, 1660, 880)) return;
  const amt = clamp(o.craterSmoke === undefined ? 1 : o.craterSmoke);
  if (amt <= 0) return;
  const { t, C } = P, ik = P.inkC;
  const col = mixColor(mixColor('#d3ccd9', C.stone, 0.3), SIL.near, P.sil);
  const sh = mixColor(mixColor('#9f97ad', C.stoneShade, 0.3), SIL.near, P.sil);
  // Columns of lobed billows: each billow rises, swells, then shrinks away (no alpha fades, so
  // the union outline stays clean). Period = 4 beats.
  const cs = [];
  const N = 6, per = 2.4;
  for (let i = 0; i < 3; i++) {
    const x0 = 1196 + i * 46, y0 = 860, Hh = (190 + 70 * i) * (0.55 + 0.45 * amt);
    for (let k = 0; k < N; k++) {
      const u = fract(t / per + k / N + i * 0.29);
      const grow = ease.outCubic(Math.min(1, u * 1.4));
      const R = (8 + 26 * grow) * ease.outQuad(clamp((1 - u) / 0.3)) * (0.55 + 0.45 * amt) * (1 - 0.12 * i);
      if (R < 2) continue;
      const cx = x0 + Math.sin(u * 5 + i * 2.1 + t * 0.7) * (4 + 18 * u) + P.wd * P.wind * u * 160;
      const cy = y0 - u * Hh;
      const a = hash01(k + i * 7, 151) * TAU;
      cs.push([cx, cy, R]);
      cs.push([cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.35 + R * 0.2, R * 0.66]);
      cs.push([cx + Math.cos(a + 2.4) * R * 0.7, cy + Math.sin(a + 2.4) * R * 0.3 + R * 0.15, R * 0.58]);
    }
  }
  if (!cs.length) return;
  shadedBlobs(ctx, cs, col, sh, LW * 0.7, ik, 0.16);
}
function drawEmbers(ctx, P, o) {
  const em = clamp(o.embers || 0);
  if (em <= 0) return;
  const { t } = P;
  const n = Math.round(22 * em);
  for (let i = 0; i < n; i++) {
    const per = 1.8 + 1.2 * hash01(i, 131);
    const u = fract(t / per + hash01(i, 132));
    const x = 1240 + (hash01(i, 133) - 0.5) * 260 + 30 * noise1(t * 1.3 + i * 4, 134) * u + P.wd * P.wind * 120 * u;
    const y = 862 - u * (140 + 160 * hash01(i, 135));
    const fl = 0.6 + 0.4 * noise1(t * 9 + i * 7, 136);
    const a = Math.sin(u * Math.PI) * fl * em;
    glow(ctx, x, y, 18, '#ff8a3d', 0.7 * a);
    circle(ctx, x, y, 2.4 + 1.6 * hash01(i, 137), rgba('#ffe08a', a), 0);
  }
}

// ---------------------------------------------------------------- particles
function drawLeaves(ctx, P) {
  const n = Math.round(64 * P.wind);
  if (!n) return;
  const { C, t } = P, ik = P.inkC;
  const cs = canopyCircles(P);
  const cols = [C.leaf, C.leafLight, C.leafShade, P.tod === 'golden' ? C.f6 : C.leafLight];
  for (let i = 0; i < n; i++) {
    const per = 2.8 + 1.8 * hash01(i, 141);
    const u = fract(t / per + hash01(i, 142));
    const age = u * per;
    const c = cs[i % cs.length];
    // spawn on the downwind / upper edge of the crown so they fly out into open sky
    const a0 = (P.wd < 0 ? Math.PI : 0) + (hash01(i, 143) - 0.5) * 2.4 - P.wd * 0.5;
    const sx = c[0] + Math.cos(a0) * c[2] * 0.95, sy = c[1] + Math.sin(a0) * c[2] * 0.8;
    const sp = (110 + 230 * hash01(i, 144)) * (0.5 + 0.6 * P.wind);
    const x = sx + P.wd * sp * age + 40 * Math.sin(age * 3.2 + i);
    const y = sy + (-190 + 140 * hash01(i, 145)) * age + 26 * age * age + 34 * Math.sin(age * 2.6 + i * 2);
    const rot = age * (4 + 5 * hash01(i, 146)) * (i % 2 ? 1 : -1);
    const al = clamp(u / 0.06) * clamp((1 - u) / 0.2);
    if (al <= 0) continue;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.5 + 0.5 * Math.abs(Math.cos(age * 6 + i)));
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -9, 11, 0); ctx.quadraticCurveTo(0, 9, -11, 0); ctx.closePath();
    ink(ctx, cols[i % cols.length], 2.5, ik);
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.strokeStyle = rgba(ik, 0.35); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}
function fireflies(ctx, t, n, x0, y0, w, h, seed, amt = 1, scale = 1, V = null) {
  const b = beatAt(t), nb = Math.floor(b), fb = b - nb;
  for (let i = 0; i < n; i++) {
    const x = x0 + hash01(i, seed) * w + 46 * noise1(t * 0.22 + i * 7, seed + 1) * scale;
    const y = y0 + hash01(i, seed + 2) * h + 30 * noise1(t * 0.27 + i * 5, seed + 3) * scale;
    if (V && !inV(V, x - 60, y - 60, x + 60, y + 60)) continue;
    const k = Math.floor(hash01(i, seed + 4) * 4);
    const flash = ((nb + k) % 4 + 4) % 4 === 0 ? Math.exp(-2.6 * fb) : 0;
    const bright = (0.22 + 0.78 * flash) * amt;
    glow(ctx, x, y, (22 + 34 * flash) * scale, '#e4ff8a', 0.85 * bright);
    circle(ctx, x, y, (2.6 + 1.6 * flash) * scale, rgba('#fbffd8', Math.min(1, 0.4 + 0.8 * bright)), 0);
  }
}

// ---------------------------------------------------------------- main entry
/**
 * drawBackyard(ctx, o) — the whole backyard in WORLD coordinates (ground line y = 860).
 * Everything is culled to the visible world rect (inverse of the current transform), so wrap it
 * in camera() and zoom freely. o: {
 *   t            seconds (drives all tempo-locked animation)
 *   tod          'golden' | 'day' | 'dusk' | 'night'            (default 'golden')
 *   pad          'intact' | 'wrecked' | 'none'                  (default 'intact')
 *   crater       bool   scorched crater at x = 1240
 *   craterSmoke  0..1   smoke wisps from the crater (default 1 when crater)
 *   embers       0..1   glowing embers rising from crater / wrecked pad
 *   skyExtend    px     sky continues above y = 0 (tilt-ups), deepening toward indigo, clouds at altitude
 *   camX, camY   camera centre (world) -> parallax of far layers (and the sun used by longShadow)
 *   garage       bool   the workshop barn (default true)
 *   garageDoor   0..1   roll-up door open amount (440 x 640 opening: BACKYARD.garageDoor)
 *   bulb         0..1   workshop bulb (default: on at night, else switches on as the door opens)
 *   fenceFlap    0..1   fence planks flap/rattle (blast)
 *   wind         0..1   tree bends, leaves blow off, grass/flowers lean, swing swings
 *   windDir      -1 | 1 direction the wind blows (default -1 = to the left, away from the pad)
 *   gnomeFall    0..1   gnome tips over (animate 0 -> 1; bounces)   gnomeDir: 1 falls right (default)
 *   silhouette   0..1   ground-level scenery -> dark silhouettes (title card)
 *   lights       0..1   house windows lit (default by tod)
 *   birds        bool   birds on the fence (default true; hidden at night)
 *   birdsFly     0..1   the three fence birds take off (beat-locked flaps, out-cubic arcs up + left,
 *                       gone by 1). If omitted, the birds simply hide when wind / fenceFlap > 0.15.
 *   fireflies    0..1   (default 1 at night, else 0)
 *   haze         0..1   extra low-sun haze discs over the sky + far layers (golden/dusk; default 0, +~1 ms)
 *   sky          bool   draw sky bands, stars, sun/moon, clouds (default true)
 *   far          bool   draw distant hills + neighbours' rooftops/trees (default true)
 *   _profile     fn(layerName)  internal perf probe, called after each layer
 * }
 */
export function drawBackyard(ctx, o = {}) {
  const P = look(o);
  lightPos(P, o);
  const V = viewRect(ctx);
  if (V) P.V = V;
  P.occ = occluders(P, o);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const M = typeof o._profile === 'function' ? o._profile : () => {}; // internal perf probe
  P.M = M;
  M('start');
  if (o.sky !== false) drawSky(ctx, P); M('sky');
  if (o.far !== false) drawFar(ctx, P, o, o.sky !== false); M('far');
  if (o.sky !== false || o.far !== false) drawHaze(ctx, P); M('haze');
  drawFence(ctx, P, o); M('fence');
  drawBirds(ctx, P, o); M('birds');
  drawLawn(ctx, P); M('lawn');
  drawShadows(ctx, P, o); M('shadows');
  drawBackTufts(ctx, P, o); M('backTufts');
  drawStones(ctx, P); M('stones');
  if (o.garage !== false) drawGarage(ctx, P, o); M('garage');
  drawBed(ctx, P, BEDS[0]); M('bedA');
  drawDoghouse(ctx, P); M('doghouse');
  drawBed(ctx, P, BEDS[1]); M('bedB');
  drawGnome(ctx, P, o); M('gnome');
  drawHouse(ctx, P); M('house');
  drawTree(ctx, P); M('tree');
  if (o.crater) drawCrater(ctx, P, o); M('crater');
  drawPad(ctx, P, o); M('pad');
  if (o.crater) drawSmoke(ctx, P, o); M('smoke');
  drawFrontTufts(ctx, P, o); M('frontTufts');
  drawLeaves(ctx, P); M('leaves');
  drawBirds(ctx, P, o, 'flying'); M('birdsFly');
  drawEmbers(ctx, P, o); M('embers');
  const ff = o.fireflies === undefined ? (P.tod === 'night' ? 1 : 0) : clamp(o.fireflies);
  if (ff > 0) fireflies(ctx, P.t, 18, XL + 200, 600, XR - XL - 400, 380, 150, ff, 1, P.V);
  M('fireflies');
  ctx.restore();
}

/** drawGarageDoor(ctx, o) — only the roll-up door panel (same o as drawBackyard), for drawing it
 *  over something the scene placed inside the garage (clip that to BACKYARD.garageDoor). */
export function drawGarageDoor(ctx, o = {}) {
  const P = look(o);
  const open = clamp(o.garageDoor || 0);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  garageDoorPanel(ctx, { ...P, bulb: defaultBulb(o, P, open) }, open);
  const G = GARAGE, w = G.doorR - G.doorL;
  rrect(ctx, G.doorL - 16, G.doorTop - 18, w + 32, 20, 3, P.C.trim, LWB * 0.9, P.inkC); // header strip on top
  ctx.restore();
}

// ---------------------------------------------------------------- workshop interior (s04)
// Full-frame barn interior in SCREEN coords (1920x1080), looking at the back wall, which holds the
// big roll-up door. Build area: centre floor (WORKSHOP.buildX, WORKSHOP.floorY).
export const WORKSHOP = {
  floorY: 960, // where the rocket / Juno / Biscuit stand (rocket at s 0.8-1.0 fits under the beam)
  buildX: 960,
  wallBase: 800, beamY: 64,
  door: { x0: 560, x1: 1360, top: 150, bottom: 800 },
  bench: { x0: 30, x1: 520, top: 640 }, // workbench top surface (vice at the right end)
  shelves: { x0: 1440, x1: 1860, ys: [270, 410, 550] },
  bulbPivot: [700, 100], bulbLen: 190,
};
const WS = {
  ceil: '#3b2a2e', rafter: '#553a34', board: '#c98f5a', board2: '#be8551', boardShade: '#a06a40', boardLine: '#94603c',
  post: '#9a6238', postShade: '#744a2c', beam: '#86532f', beamShade: '#633d24',
  floorFar: '#aaa1b3', floor: '#b9b0bf', floorNear: '#c9c1cd', floorLine: '#9d94a8', stain: '#8e859a', base: '#7d4e2e',
  peg: '#dcae76', pegShade: '#bb8a55', pegHole: '#8a6040', paint: '#8a6040',
  steel: '#b8c0cf', steelShade: '#8a93a6', steelLight: '#e3e8f0',
  red: '#e8453c', redShade: '#b52d2d', yellow: '#ffd23f', yellowShade: '#e0a82a', teal: '#2ec4b6', tealShade: '#1f9186',
  cream: '#fff1d6', creamShade: '#e8d4b0', blue: '#3a86ff', blueShade: '#2a62c0', green: '#5cc26b', greenShade: '#3f8f46',
  orange: '#ff8a3d', orangeShade: '#d0652a', pink: '#ff7eb6', purple: '#9b6bdc',
  handle: '#b0703e', handleShade: '#8a5530', rubber: '#3f3d4f',
  door: '#a9b4c8', doorShade: '#8793aa', doorLine: '#7d88a0', doorLight: '#c6cfdd',
  lamp: '#3f8f6a', lampDark: '#2d6b4f', paper: '#fffaf0', paperShade: '#eadfca', poster: '#1b2a5c', posterShade: '#141f47',
  crate: '#dca865', crateShade: '#b27c40', crateFrame: '#c68d4d', stencil: '#9a3b2c',
  cab: '#6f86a8', cabShade: '#566b8c',
};
function wsPalette(o) {
  const bulb = o.bulb === undefined ? 1 : clamp(o.bulb), open = clamp(o.doorOpen || 0);
  const dark = 0.44 * (1 - bulb) * (1 - 0.55 * open), warm = 0.07 * open + 0.04 * bulb;
  const K = {};
  for (const k in WS) K[k] = mixColor(mixColor(WS[k], '#ffcf98', warm), '#241a2c', dark);
  K.ink = mixColor(INK, '#241a2c', dark * 0.5);
  return { K, bulb, open, dark };
}
// --- small workshop props (local coords, drawn at their own size) ---
function wsHammer(ctx, K, lw) {
  rrect(ctx, -6, -8, 12, 104, 5, K.handle, lw, K.ink);
  ctx.fillStyle = K.handleShade; ctx.fillRect(1, -2, 4, 96);
  rrect(ctx, -30, -24, 60, 24, 5, K.steel, lw, K.ink);
  ctx.fillStyle = K.steelShade; ctx.fillRect(-27, -9, 54, 6);
  ctx.fillStyle = rgba('#ffffff', 0.5); ctx.fillRect(-24, -20, 18, 4);
}
function wsWrench(ctx, K, lw, len = 110) {
  rrect(ctx, -7, -len / 2 + 14, 14, len - 28, 6, K.steel, lw, K.ink);
  for (const [sy, r] of [[-1, 17], [1, 14]]) {
    const cy = sy * (len / 2 - 8);
    circle(ctx, 0, cy, r, K.steel, lw, K.ink);
    ctx.fillStyle = K.peg; ctx.beginPath(); ctx.rect(-r * 0.42, cy + sy * r * 0.1 - (sy > 0 ? 0 : r), r * 0.84, r); ctx.fill();
  }
  ctx.fillStyle = K.steelShade; ctx.fillRect(1.5, -len / 2 + 22, 4, len - 44);
}
function wsSaw(ctx, K, lw) {
  ctx.beginPath(); poly(ctx, [[-12, 0], [120, 12], [120, 44], [-12, 60]]); ink(ctx, K.steel, lw, K.ink);
  ctx.beginPath(); for (let x = 0; x < 118; x += 12) { const y0 = 58 - x * 0.12; ctx.moveTo(x, y0); ctx.lineTo(x + 6, y0 + 6); ctx.lineTo(x + 12, y0 - 1); }
  ctx.strokeStyle = K.ink; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = rgba('#ffffff', 0.45); ctx.fillRect(10, 14, 70, 5);
  ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(-50, -12); ctx.quadraticCurveTo(-62, 30, -50, 70); ctx.lineTo(-12, 66); ctx.closePath(); ink(ctx, K.red, lw, K.ink);
  ctx.beginPath(); ctx.ellipse(-34, 30, 7, 17, 0, 0, TAU); ink(ctx, K.peg, lw * 0.7, K.ink);
}
function wsScrewdriver(ctx, K, lw, col, colS) {
  rrect(ctx, -9, -60, 18, 50, 8, col, lw, K.ink);
  ctx.fillStyle = colS; ctx.fillRect(2, -54, 5, 40);
  rrect(ctx, -3, -12, 6, 58, 2, K.steel, lw * 0.7, K.ink);
}
function wsPliers(ctx, K, lw) {
  for (const sd of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sd * 3, -40); ctx.quadraticCurveTo(sd * 10, -10, sd * 20, 50); ctx.lineTo(sd * 8, 52); ctx.quadraticCurveTo(sd * 2, 0, -sd * 4, -38); ctx.closePath();
    ink(ctx, sd < 0 ? K.red : K.redShade, lw, K.ink);
  }
  ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(0, -78); ctx.lineTo(6, -40); ctx.closePath(); ink(ctx, K.steel, lw, K.ink);
  circle(ctx, 0, -38, 5, K.steelShade, lw * 0.6, K.ink);
}
function wsTape(ctx, K, lw) {
  rrect(ctx, -30, -30, 60, 60, 14, K.yellow, lw, K.ink);
  circle(ctx, -2, -2, 13, K.yellowShade, lw * 0.7, K.ink);
  ctx.fillStyle = K.ink; ctx.fillRect(26, 14, 14, 8);
}
function wsTin(ctx, K, x, y, w, h, col, colS, lw, o = {}) {
  // paint tin standing on y (bottom), label band, lid rim, optional drip
  rrect(ctx, x - w / 2, y - h, w, h, 5, col, lw, K.ink);
  ctx.fillStyle = colS; ctx.fillRect(x + w / 2 - w * 0.26, y - h + 4, w * 0.26 - 3, h - 8);
  rrect(ctx, x - w / 2 + 3, y - h * 0.62, w - 6, h * 0.34, 3, K.cream, 0);
  ctx.fillStyle = col; ctx.fillRect(x - w * 0.2, y - h * 0.55, w * 0.4, h * 0.2);
  rrect(ctx, x - w / 2 - 3, y - h - 5, w + 6, 10, 4, K.steel, lw * 0.8, K.ink);
  if (o.drip) { ctx.beginPath(); ctx.moveTo(x - w * 0.3, y - h); ctx.lineTo(x - w * 0.3, y - h + h * 0.36); ctx.strokeStyle = K.ink; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke(); }
  ctx.fillStyle = rgba('#ffffff', 0.35); ctx.fillRect(x - w / 2 + 6, y - h + 8, 5, h * 0.25);
}
function wsBox(ctx, K, x, y, w, h, label, lw) {
  rrect(ctx, x, y - h, w, h, 3, K.crate, lw, K.ink);
  ctx.fillStyle = K.crateShade; ctx.fillRect(x + w - 12, y - h + 3, 9, h - 6);
  ctx.beginPath(); ctx.moveTo(x + 4, y - h + h * 0.3); ctx.lineTo(x + w - 4, y - h + h * 0.3); ctx.strokeStyle = rgba(K.ink, 0.5); ctx.lineWidth = 2; ctx.stroke();
  if (label) text(ctx, label, x + w / 2 - 4, y - h * 0.4, Math.min(22, h * 0.34), rgba(K.stencil, 0.85), 0, FONT.round);
}

/**
 * drawWorkshop(ctx, o = {}) — s04 montage backdrop: the inside of the workshop barn, full frame in
 * SCREEN coords (1920x1080; drawn from x -480 to 2400 so whip-pans have slack). Pegboard wall with
 * outlined tools (one painted hammer outline is empty: Juno is holding it), workbench + vice,
 * shelves of paint tins, a wall clock that ticks on the beat, a pendant bulb swinging on
 * sway(t, 4) with a warm floor pool, concrete floor with a clear build area at
 * (WORKSHOP.buildX, WORKSHOP.floorY) for drawRocket at s 0.8-1.0, and the big roll-up door behind it.
 *   o: { t, bulb 0..1 (default 1), flicker 0..1 (blue-white welding flashes pulsing with pulse(t)),
 *        doorOpen 0..1 (door rolls up; the golden yard glows through and light floods the floor),
 *        tod (vista through the door, default 'golden'), hammer bool (default false: the hammer
 *        hook is empty) }
 */
export function drawWorkshop(ctx, o = {}) {
  const t = o.t || 0;
  const { K, bulb, open } = wsPalette(o);
  const V = viewRect(ctx) || { x0: -480, x1: 2400, y0: -40, y1: 1120 };
  const X0 = Math.max(-480, V.x0), X1 = Math.min(2400, V.x1), WW = X1 - X0;
  const D = WORKSHOP.door, FY = WORKSHOP.wallBase;
  const lw = LWB, lws = LWB * 0.7;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ---- ceiling + rafters
  ctx.fillStyle = K.ceil; ctx.fillRect(X0, -60, WW, 170);
  ctx.fillStyle = K.rafter;
  for (let i = -3; i <= 3; i++) {
    const x = 960 + i * 330;
    ctx.beginPath(); poly(ctx, [[x - 22, 70], [x + 22, 70], [960 + (x - 960) * 0.35 + 12, -60], [960 + (x - 960) * 0.35 - 12, -60]]); ctx.fill();
  }
  // ---- back wall: boards (rect stripes)
  ctx.fillStyle = K.board; ctx.fillRect(X0, 96, WW, FY - 96);
  ctx.fillStyle = K.board2;
  for (let x = Math.floor(X0 / 88) * 88; x < X1; x += 88) ctx.fillRect(x + 44, 96, 44, FY - 96);
  ctx.fillStyle = K.boardLine;
  for (let x = Math.floor(X0 / 44) * 44; x < X1; x += 44) ctx.fillRect(x - 1.5, 96, 3, FY - 96);
  ctx.fillStyle = rgba(K.boardShade, 0.9); ctx.fillRect(X0, 96, WW, 30); // shadow under the beam
  // posts framing the door + corner posts
  for (const [px, pw] of [[D.x0 - 44, 44], [D.x1, 44], [-20, 40], [1900, 40]]) {
    if (px + pw < X0 || px > X1) continue;
    rrect(ctx, px, 90, pw, FY - 90, 0, K.post, lw, K.ink);
    ctx.fillStyle = K.postShade; ctx.fillRect(px + pw - 12, 94, 9, FY - 98);
  }
  // diagonal braces from the door posts up to the beam
  for (const [x0, x1] of [[D.x0 - 22, D.x0 - 190], [D.x1 + 22, D.x1 + 190]]) {
    const pts = thickStrip([[x0, 260], [x1, 92]], 26);
    fillPoly(ctx, pts, K.post, lw, K.ink);
  }
  // tie beam
  rrect(ctx, X0 - 20, WORKSHOP.beamY, WW + 40, 36, 0, K.beam, lw, K.ink);
  ctx.fillStyle = K.beamShade; ctx.fillRect(X0 - 20, WORKSHOP.beamY + 24, WW + 40, 9);
  ctx.fillStyle = K.ink;
  for (let x = Math.floor(X0 / 330) * 330 + 45; x < X1; x += 330) { ctx.beginPath(); ctx.arc(x, 82, 4, 0, TAU); ctx.fill(); }

  // ---- the door opening: vista (when open) + roll-up door + tracks + drum housing
  const dw = D.x1 - D.x0, dh = D.bottom - D.top;
  if (open > 0.001) {
    ctx.save(); ctx.beginPath(); ctx.rect(D.x0, D.top, dw, dh); ctx.clip();
    const Tv = TOD[todKey(o.tod || 'golden')];
    const vV = { x0: D.x0, x1: D.x1, y0: D.top, y1: D.bottom };
    bands(ctx, vV, D.top, 640, 10, (y) => skyColorAt(Tv, 150 + (y - D.top) * 0.95));
    const sun = Tv.sun;
    if (sun) {
      halo(ctx, 800, 560, 260, sun.glow, 0.5, 4, 0.3);
      circle(ctx, 800, 560, 62, sun.core, 0);
    } else if (Tv.moon) { circle(ctx, 1180, 300, 34, '#fff3c4', 0); }
    const tv = (c) => { let x = Tv.mul ? mulC(c, Tv.mul) : c; return Tv.addAmt ? mixColor(x, Tv.add, Tv.addAmt) : x; };
    hill(ctx, (x) => 560 - 26 * Math.sin(x * 0.006 + 1) - 12 * Math.sin(x * 0.017), D.x0, D.x1, 700, mixColor(tv(BASE.hillFar), Tv.haze, 0.55), 3, mixColor(INK, Tv.haze, 0.5));
    hill(ctx, (x) => 610 - 18 * Math.sin(x * 0.009 + 2), D.x0, D.x1, 700, mixColor(tv(BASE.hillNear), Tv.haze, 0.35), 3, mixColor(INK, Tv.haze, 0.4));
    // yard fence + lawn, bright and hazy (we are looking out of a dark room)
    ctx.fillStyle = mixColor(tv(BASE.fence), Tv.haze, 0.3); ctx.fillRect(D.x0, 628, dw, 90);
    ctx.fillStyle = mixColor(tv(BASE.fenceShade), Tv.haze, 0.3);
    for (let x = D.x0 + 20; x < D.x1; x += 40) ctx.fillRect(x, 628, 5, 90);
    ctx.fillRect(D.x0, 650, dw, 8);
    bands(ctx, vV, 700, D.bottom, 10, (y) => mixColor(tv(BASE.lawn), tv(BASE.lawnBack), (D.bottom - y) / 100 * 0.5));
    ctx.fillStyle = rgba('#fff3d0', 0.22); ctx.fillRect(D.x0, D.top, dw, dh); // overexposed outdoors
    ctx.restore();
  }
  const bottom = D.top + dh * (1 - open);
  if (bottom - D.top > 1) {
    ctx.save(); ctx.beginPath(); ctx.rect(D.x0, D.top, dw, bottom - D.top); ctx.clip();
    ctx.fillStyle = K.door; ctx.fillRect(D.x0, D.top, dw, dh);
    const n = 12, ph = dh / n, off = -dh * open;
    ctx.fillStyle = K.doorShade;
    for (let k = 0; k < n; k++) { const y = D.top + off + (k + 1) * ph; ctx.fillRect(D.x0, y - 12, dw, 12); }
    ctx.fillStyle = K.doorLight;
    for (let k = 0; k < n; k++) { const y = D.top + off + k * ph; ctx.fillRect(D.x0, y + 3, dw, 4); }
    ctx.fillStyle = K.doorLine;
    for (let k = 0; k < n; k++) { const y = D.top + off + (k + 1) * ph; ctx.fillRect(D.x0, y - 1.5, dw, 3); }
    // daylight through the window row + along the bottom seal (warmer when the bulb is off)
    const day = mixColor('#fff0c2', '#ffd27a', 0.3);
    for (let c = 0; c < 6; c++) {
      const x = D.x0 + (c + 0.5) * (dw / 6), y = D.top + off + 2 * ph + 10;
      rrect(ctx, x - 40, y, 80, ph - 26, 5, day, lws, K.ink);
      ctx.fillStyle = rgba('#ffffff', 0.6); ctx.fillRect(x - 32, y + 5, 16, 5);
    }
    // pull rope + handle
    const hx = D.x0 + dw / 2 + 60;
    const ry = Math.min(FY - 8, bottom + 110);
    ctx.beginPath(); ctx.moveTo(hx, bottom - 24); ctx.quadraticCurveTo(hx + 6 * sway(t, 4), (bottom + ry) / 2, hx + 4 * sway(t, 4), ry);
    ctx.strokeStyle = K.ink; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = K.cream; ctx.lineWidth = 4; ctx.stroke();
    rrect(ctx, D.x0 + dw / 2 - 40, bottom - 30, 80, 14, 7, K.steel, lws, K.ink);
    ctx.fillStyle = mixColor('#ffe9a8', K.door, 0.2); ctx.fillRect(D.x0, bottom - 4, dw, 4); // light leak under the door
    ctx.restore();
    ctx.beginPath(); ctx.rect(D.x0, D.top, dw, bottom - D.top); ink(ctx, null, lws, K.ink);
  }
  if (open > 0.001 && bottom < D.bottom - 2) {
    // the rope dangles from the rising door's bottom edge
    const hx = D.x0 + dw / 2 + 60, ry = Math.min(D.bottom - 6, bottom + 110);
    ctx.beginPath(); ctx.moveTo(hx, bottom); ctx.lineTo(hx + 4 * sway(t, 4), ry);
    ctx.strokeStyle = K.ink; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = K.cream; ctx.lineWidth = 4; ctx.stroke();
  }
  // tracks + drum housing
  for (const x of [D.x0 - 6, D.x1 + 6]) { rrect(ctx, x - 8, D.top - 20, 16, dh + 20, 3, K.steel, lws, K.ink); ctx.fillStyle = K.steelShade; ctx.fillRect(x + 2, D.top - 16, 4, dh + 12); }
  rrect(ctx, D.x0 - 26, D.top - 46, dw + 52, 46, 8, K.steel, lw, K.ink);
  ctx.fillStyle = K.steelShade; ctx.fillRect(D.x0 - 22, D.top - 16, dw + 44, 11);
  ctx.fillStyle = rgba('#ffffff', 0.5); ctx.fillRect(D.x0 - 14, D.top - 40, dw * 0.4, 5);

  // ---- LEFT: poster, clock, pegboard with tools, bench + vice, toolbox
  // poster ("MOON OR BUST!")
  ctx.save(); ctx.translate(215, 180); ctx.rotate(-0.04);
  rrect(ctx, -92, -62, 184, 124, 3, K.poster, lws, K.ink);
  ctx.fillStyle = K.posterShade; ctx.fillRect(40, -58, 48, 116);
  circle(ctx, 50, -26, 22, K.paperShade, 2.5, K.ink);
  ctx.save(); ctx.translate(-26, 8); ctx.rotate(0.6);
  ctx.beginPath(); ctx.moveTo(0, -36); ctx.quadraticCurveTo(14, -18, 12, 18); ctx.lineTo(-12, 18); ctx.quadraticCurveTo(-14, -18, 0, -36); ctx.closePath(); ink(ctx, K.cream, 2.5, K.ink);
  ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(-20, 24); ctx.lineTo(-10, 20); ctx.moveTo(12, 10); ctx.lineTo(20, 24); ctx.lineTo(10, 20); ink(ctx, K.red, 2.5, K.ink);
  ctx.beginPath(); ctx.moveTo(-9, -22); ctx.quadraticCurveTo(0, -38, 9, -22); ctx.closePath(); ink(ctx, K.red, 2, K.ink);
  circle(ctx, 0, -6, 5, K.blue, 2, K.ink);
  ctx.beginPath(); ctx.moveTo(-6, 22); ctx.lineTo(0, 40); ctx.lineTo(6, 22); ctx.closePath(); ink(ctx, K.orange, 2, K.ink);
  ctx.restore();
  for (const [sx, sy] of [[-70, -40], [-40, 30], [70, 34], [20, -46]]) sparkleTiny(ctx, sx, sy, 5, K.yellow);
  text(ctx, 'MOON OR BUST!', 0, 46, 17, K.yellow, 0, FONT.title);
  ctx.fillStyle = rgba('#fff6d0', 0.8); ctx.fillRect(-60, -70, 30, 12); ctx.fillRect(34, 56, 30, 12); // tape
  ctx.restore();
  // wall clock: the second hand ticks on every beat
  const cx0 = 430, cy0 = 180;
  circle(ctx, cx0, cy0, 46, K.red, lw, K.ink);
  circle(ctx, cx0, cy0, 36, K.paper, lws, K.ink);
  ctx.fillStyle = K.ink;
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.beginPath(); ctx.arc(cx0 + Math.cos(a) * 29, cy0 + Math.sin(a) * 29, k % 3 ? 1.6 : 3, 0, TAU); ctx.fill(); }
  const nb = Math.floor(beatAt(t)), tick = nb + Math.min(1, (beatAt(t) - nb) * 10);
  const handA = (tick / 60) * TAU - Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + Math.cos(-2.1) * 17, cy0 + Math.sin(-2.1) * 17); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + Math.cos(-0.5) * 24, cy0 + Math.sin(-0.5) * 24);
  ctx.strokeStyle = K.ink; ctx.lineWidth = 4.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + Math.cos(handA) * 30, cy0 + Math.sin(handA) * 30); ctx.strokeStyle = K.red; ctx.lineWidth = 2.5; ctx.stroke();
  circle(ctx, cx0, cy0, 3.5, K.ink, 0);
  // pegboard
  const pb = { x: 60, y: 262, w: 440, h: 300 };
  rrect(ctx, pb.x, pb.y, pb.w, pb.h, 4, K.peg, lw, K.ink);
  ctx.fillStyle = K.pegShade; ctx.fillRect(pb.x + pb.w - 16, pb.y + 4, 12, pb.h - 8); ctx.fillRect(pb.x + 4, pb.y + pb.h - 14, pb.w - 8, 10);
  ctx.fillStyle = K.pegHole;
  for (let i = 0; i < 20; i++) for (let j = 0; j < 13; j++) ctx.fillRect(pb.x + 16 + i * 21.5, pb.y + 16 + j * 21.5, 3.5, 3.5);
  // painted tool outlines ("shadow board") — the hammer's hook is empty unless o.hammer
  ctx.save(); ctx.translate(pb.x + 64, pb.y + 58);
  ctx.globalAlpha *= 0.6;
  ctx.beginPath(); rrectPath(ctx, -6, -8, 12, 104, 5); ctx.rect(-30, -24, 60, 24);
  ctx.strokeStyle = K.paint; ctx.lineWidth = 3; ctx.setLineDash([2, 0]); ctx.stroke();
  ctx.restore();
  if (o.hammer) { ctx.save(); ctx.translate(pb.x + 64, pb.y + 58); wsHammer(ctx, K, lws); ctx.restore(); }
  const hook = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 6, y - 8); ctx.moveTo(x + 6, y); ctx.lineTo(x + 6, y - 8); ctx.strokeStyle = K.steelShade; ctx.lineWidth = 3; ctx.stroke(); };
  hook(pb.x + 64, pb.y + 32);
  ctx.save(); ctx.translate(pb.x + 150, pb.y + 110); ctx.rotate(0.08); wsWrench(ctx, K, lws, 130); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 196, pb.y + 100); ctx.rotate(-0.06); wsWrench(ctx, K, lws, 100); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 236, pb.y + 92); wsWrench(ctx, K, lws, 76); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 300, pb.y + 44); wsSaw(ctx, K, lws); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 60, pb.y + 234); wsScrewdriver(ctx, K, lws, K.red, K.redShade); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 100, pb.y + 234); wsScrewdriver(ctx, K, lws, K.yellow, K.yellowShade); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 140, pb.y + 234); wsScrewdriver(ctx, K, lws, K.teal, K.tealShade); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 214, pb.y + 230); wsPliers(ctx, K, lws); ctx.restore();
  ctx.save(); ctx.translate(pb.x + 300, pb.y + 214); wsTape(ctx, K, lws); ctx.restore();
  // cable coil on a hook
  ctx.beginPath(); ctx.ellipse(pb.x + 390, pb.y + 214, 34, 44, 0.1, 0, TAU); ctx.strokeStyle = K.ink; ctx.lineWidth = 16; ctx.stroke();
  ctx.strokeStyle = K.orange; ctx.lineWidth = 10; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(pb.x + 390, pb.y + 214, 34, 44, 0.1, 3.6, 4.6); ctx.strokeStyle = K.orangeShade; ctx.lineWidth = 4; ctx.stroke();
  // workbench
  const B = WORKSHOP.bench;
  for (const lx of [B.x0 + 24, B.x1 - 52]) { rrect(ctx, lx, B.top + 20, 28, FY - B.top - 18, 0, K.post, lws, K.ink); ctx.fillStyle = K.postShade; ctx.fillRect(lx + 18, B.top + 24, 7, FY - B.top - 26); }
  rrect(ctx, B.x0 + 30, FY - 64, B.x1 - B.x0 - 60, 16, 0, K.board2, lws, K.ink); // lower shelf
  rrect(ctx, B.x0, B.top, B.x1 - B.x0, 32, 3, K.handle, lw, K.ink);
  ctx.fillStyle = K.handleShade; ctx.fillRect(B.x0 + 3, B.top + 20, B.x1 - B.x0 - 6, 9);
  ctx.fillStyle = rgba('#ffffff', 0.3); ctx.fillRect(B.x0 + 10, B.top + 5, (B.x1 - B.x0) * 0.5, 4);
  // toolbox on the lower shelf + a bucket
  rrect(ctx, B.x0 + 56, FY - 132, 150, 68, 6, K.red, lws, K.ink);
  ctx.fillStyle = K.redShade; ctx.fillRect(B.x0 + 178, FY - 128, 24, 60);
  rrect(ctx, B.x0 + 56, FY - 132, 150, 18, 5, K.redShade, lws, K.ink);
  ctx.beginPath(); ctx.moveTo(B.x0 + 104, FY - 132); ctx.lineTo(B.x0 + 104, FY - 150); ctx.lineTo(B.x0 + 158, FY - 150); ctx.lineTo(B.x0 + 158, FY - 132);
  ctx.strokeStyle = K.ink; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = K.steel; ctx.lineWidth = 5; ctx.stroke();
  wsTin(ctx, K, B.x0 + 300, FY - 64, 64, 58, K.blue, K.blueShade, lws, { drip: true });
  // vice at the right end of the bench
  const vx = B.x1 - 84;
  rrect(ctx, vx - 8, B.top - 44, 76, 44, 5, K.steel, lws, K.ink);
  ctx.fillStyle = K.steelShade; ctx.fillRect(vx + 46, B.top - 40, 18, 38);
  rrect(ctx, vx - 26, B.top - 56, 26, 30, 3, K.steel, lws, K.ink);
  rrect(ctx, vx + 60, B.top - 30, 60, 10, 4, K.steelShade, lws, K.ink); // T-handle bar
  circle(ctx, vx + 122, B.top - 25, 8, K.red, lws, K.ink);
  // bench clutter: bolt jar, mug of pencils, rolled blueprint
  rrect(ctx, B.x0 + 40, B.top - 58, 50, 58, 10, mixColor(K.steelLight, K.board, 0.2), lws, K.ink);
  ctx.fillStyle = K.steelShade; for (let i = 0; i < 6; i++) ctx.fillRect(B.x0 + 48 + (i % 3) * 12, B.top - 26 - Math.floor(i / 3) * 12, 9, 9);
  rrect(ctx, B.x0 + 36, B.top - 66, 58, 12, 4, K.red, lws, K.ink);
  for (const [px, pa, col] of [[B.x0 + 140, -0.2, K.yellow], [B.x0 + 150, 0.15, K.red], [B.x0 + 160, 0.35, K.blue]]) {
    ctx.save(); ctx.translate(px, B.top - 40); ctx.rotate(pa); rrect(ctx, -3, -44, 6, 44, 2, col, 2.5, K.ink); ctx.restore();
  }
  rrect(ctx, B.x0 + 126, B.top - 48, 46, 48, 6, K.teal, lws, K.ink);
  ctx.beginPath(); ctx.arc(B.x0 + 176, B.top - 26, 12, -1.4, 1.4); ctx.strokeStyle = K.ink; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = K.teal; ctx.lineWidth = 4; ctx.stroke();
  rrect(ctx, B.x0 + 200, B.top - 28, 150, 28, 14, mixColor('#bfe6ff', K.board, 0.15), lws, K.ink);
  ctx.beginPath(); ctx.ellipse(B.x0 + 350, B.top - 14, 7, 14, 0, 0, TAU); ink(ctx, '#9cc8ea', 2.5, K.ink);
  ctx.beginPath(); ctx.moveTo(B.x0 + 230, B.top - 28); ctx.lineTo(B.x0 + 230, B.top); ctx.moveTo(B.x0 + 300, B.top - 28); ctx.lineTo(B.x0 + 300, B.top); ctx.strokeStyle = rgba(K.ink, 0.35); ctx.lineWidth = 2; ctx.stroke();

  // ---- RIGHT: shelves of tins and boxes, crate stack
  const S = WORKSHOP.shelves;
  const tinCols = [[K.red, K.redShade], [K.cream, K.creamShade], [K.teal, K.tealShade], [K.yellow, K.yellowShade], [K.blue, K.blueShade], [K.pink, K.red], [K.green, K.greenShade], [K.orange, K.orangeShade]];
  S.ys.forEach((sy, r) => {
    // brackets
    for (const bx of [S.x0 + 40, S.x1 - 40]) { ctx.beginPath(); poly(ctx, [[bx - 6, sy + 14], [bx + 6, sy + 14], [bx + 6, sy + 60], [bx - 6, sy + 24]]); ink(ctx, K.steelShade, lws, K.ink); }
    if (r === 0) {
      wsTin(ctx, K, S.x0 + 50, sy, 62, 70, ...tinCols[0], lws, { drip: true });
      wsTin(ctx, K, S.x0 + 124, sy, 62, 70, ...tinCols[1], lws);
      wsTin(ctx, K, S.x0 + 198, sy, 62, 70, ...tinCols[2], lws, { drip: true });
      wsBox(ctx, K, S.x0 + 250, sy, 150, 76, 'BOLTS', lws);
    } else if (r === 1) {
      wsTin(ctx, K, S.x0 + 46, sy, 52, 56, ...tinCols[3], lws);
      wsTin(ctx, K, S.x0 + 108, sy, 52, 56, ...tinCols[4], lws, { drip: true });
      // spray can
      rrect(ctx, S.x0 + 150, sy - 80, 34, 80, 8, K.purple, lws, K.ink); rrect(ctx, S.x0 + 156, sy - 94, 22, 16, 5, K.steel, lws, K.ink);
      // coiled rope
      circle(ctx, S.x0 + 250, sy - 42, 42, K.cream, lws, K.ink);
      ctx.beginPath(); for (const r2 of [30, 20, 10]) { ctx.moveTo(S.x0 + 250 + r2, sy - 42); ctx.arc(S.x0 + 250, sy - 42, r2, 0, TAU); }
      ctx.strokeStyle = rgba(K.ink, 0.45); ctx.lineWidth = 2.5; ctx.stroke();
      wsTin(ctx, K, S.x0 + 340, sy, 60, 64, ...tinCols[5], lws, { drip: true });
    } else {
      wsBox(ctx, K, S.x0 + 14, sy, 160, 84, 'FINS', lws);
      wsTin(ctx, K, S.x0 + 222, sy, 58, 64, ...tinCols[6], lws);
      wsTin(ctx, K, S.x0 + 292, sy, 58, 64, ...tinCols[7], lws, { drip: true });
      rrect(ctx, S.x0 + 334, sy - 40, 70, 40, 10, K.pink, lws, K.ink); // rags
      ctx.beginPath(); ctx.moveTo(S.x0 + 344, sy - 24); ctx.quadraticCurveTo(S.x0 + 370, sy - 34, S.x0 + 396, sy - 22); ctx.strokeStyle = rgba(K.ink, 0.4); ctx.lineWidth = 2.5; ctx.stroke();
    }
    rrect(ctx, S.x0, sy, S.x1 - S.x0, 16, 2, K.handle, lw, K.ink);
    ctx.fillStyle = K.handleShade; ctx.fillRect(S.x0 + 3, sy + 10, S.x1 - S.x0 - 6, 4);
  });
  // crate stack on the floor
  const crate = (x, y, w, h, label) => {
    rrect(ctx, x, y - h, w, h, 2, K.crate, lws, K.ink);
    ctx.fillStyle = K.crateFrame; ctx.fillRect(x + 3, y - h + 3, w - 6, 12); ctx.fillRect(x + 3, y - 15, w - 6, 12);
    ctx.fillStyle = K.crateShade; ctx.fillRect(x + w - 16, y - h + 3, 13, h - 6);
    ctx.beginPath(); ctx.moveTo(x + 10, y - 16); ctx.lineTo(x + w - 18, y - h + 16); ctx.strokeStyle = rgba(K.ink, 0.5); ctx.lineWidth = 3; ctx.stroke();
    if (label) text(ctx, label, x + w / 2 - 6, y - h / 2, 20, rgba(K.stencil, 0.8), -0.05, FONT.round);
  };
  crate(1470, FY, 176, 116, 'FRAGILE'); crate(1690, FY, 170, 104, null); crate(1714, FY - 104, 124, 84, 'UP');
  // off-frame extras for whip-pans: a steel cabinet (left) and more crates (right)
  if (X0 < -40) {
    rrect(ctx, -400, 190, 330, FY - 190, 6, K.cab, lw, K.ink);
    ctx.fillStyle = K.cabShade; ctx.fillRect(-100, 196, 26, FY - 202);
    ctx.beginPath(); ctx.moveTo(-235, 196); ctx.lineTo(-235, FY - 4); ctx.strokeStyle = K.ink; ctx.lineWidth = 4; ctx.stroke();
    rrect(ctx, -262, 470, 12, 60, 5, K.steel, lws, K.ink); rrect(ctx, -222, 470, 12, 60, 5, K.steel, lws, K.ink);
    circle(ctx, -320, 300, 26, K.yellow, lws, K.ink); text(ctx, '★', -320, 301, 26, K.red, 0, FONT.round);
  }
  if (X1 > 1960) { crate(1960, FY, 190, 150, 'TEST #2'); crate(2160, FY, 170, 130, null); crate(2000, FY - 150, 140, 110, 'FRAGILE'); }

  // ---- floor
  const fy1 = Math.max(1080, V.y1);
  ctx.fillStyle = K.base; ctx.fillRect(X0, FY - 4, WW, 16);
  bands(ctx, { x0: X0, x1: X1, y0: FY + 12, y1: fy1 }, FY + 12, fy1, 10, (y) => {
    const u = clamp((y - FY) / 280);
    return u < 0.5 ? mixColor(K.floorFar, K.floor, u * 2) : mixColor(K.floor, K.floorNear, (u - 0.5) * 2);
  });
  // slab joints (perspective, vanishing at (960, 420)) + one cross joint
  ctx.fillStyle = K.floorLine;
  ctx.beginPath();
  for (let x = -840; x <= 2760; x += 400) {
    const xb = 960 + (x - 960) * ((fy1 - 420) / (FY - 420));
    ctx.moveTo(x - 1.5, FY + 12); ctx.lineTo(x + 1.5, FY + 12); ctx.lineTo(xb + 3, fy1); ctx.lineTo(xb - 3, fy1); ctx.closePath();
  }
  ctx.fill();
  ctx.fillRect(X0, 930, WW, 3.5);
  // oil stain + paint splats
  ctx.fillStyle = rgba(K.stain, 0.55); ellipsePath(ctx, 420, 900, 90, 16); ctx.fill(); ellipsePath(ctx, 470, 910, 40, 8); ctx.fill();
  for (const [x, y, r, c] of [[1320, 1010, 14, K.red], [1350, 1030, 7, K.red], [1480, 900, 10, K.teal], [700, 1050, 9, K.yellow], [1200, 880, 6, K.red]]) {
    ctx.fillStyle = c; ellipsePath(ctx, x, y, r * 1.6, r * 0.55); ctx.fill();
  }
  // tape "X" marking the build spot
  ctx.fillStyle = rgba(K.yellow, 0.85);
  ctx.save(); ctx.translate(WORKSHOP.buildX, WORKSHOP.floorY - 2); ctx.scale(1, 0.3);
  ctx.rotate(0.6); ctx.fillRect(-120, -9, 240, 18); ctx.rotate(-1.2); ctx.fillRect(-120, -9, 240, 18);
  ctx.restore();

  // ---- light: door shaft (when open), bulb pool, pendant lamp
  if (open > 0.001) {
    const k = open, span = (D.x1 - D.x0) * (0.5 + 0.5 * k);
    ctx.fillStyle = rgba('#ffd98a', 0.28 * k);
    ctx.beginPath(); poly(ctx, [[960 - span / 2, FY], [960 + span / 2, FY], [960 + span / 2 + 360, fy1], [960 - span / 2 - 360, fy1]]); ctx.fill();
    ctx.fillStyle = rgba('#fff3d0', 0.18 * k);
    ctx.beginPath(); poly(ctx, [[960 - span / 2 + 60, FY], [960 + span / 2 - 60, FY], [960 + span / 2 + 200, fy1], [960 - span / 2 - 200, fy1]]); ctx.fill();
  }
  const [bpx, bpy] = WORKSHOP.bulbPivot, L = WORKSHOP.bulbLen;
  const sw = 0.12 * sway(t, 4);
  const bx = bpx + Math.sin(sw) * L, by = bpy + Math.cos(sw) * L;
  if (bulb > 0) {
    ctx.save(); ctx.translate(bx, WORKSHOP.floorY - 10); ctx.scale(1, 0.22);
    glow(ctx, 0, 0, 400, '#ffd98a', 0.42 * bulb);
    ctx.restore();
    ctx.fillStyle = rgba('#ffd98a', 0.07 * bulb);
    ctx.beginPath(); poly(ctx, [[bx - 30, by + 20], [bx + 30, by + 20], [bx + 260, WORKSHOP.floorY - 10], [bx - 260, WORKSHOP.floorY - 10]]); ctx.fill();
  }
  // cord + enamel shade + bulb
  ctx.beginPath(); ctx.moveTo(bpx, bpy); ctx.lineTo(bx - Math.sin(sw) * 34, by - Math.cos(sw) * 34);
  ctx.strokeStyle = K.ink; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); ctx.translate(bx, by); ctx.rotate(-sw);
  if (bulb > 0) { glow(ctx, 0, 16, 260, '#ffd98a', 0.34 * bulb); glow(ctx, 0, 16, 90, '#ffe7a8', 0.5 * bulb); }
  circle(ctx, 0, 16, 15, bulb > 0 ? mixColor('#b9b0a0', '#fffbe6', bulb) : '#b9b0a0', lws, K.ink);
  ctx.beginPath(); ctx.moveTo(-10, -34); ctx.lineTo(10, -34); ctx.lineTo(46, 8); ctx.quadraticCurveTo(0, 0, -46, 8); ctx.closePath(); ink(ctx, K.lamp, lws, K.ink);
  ctx.fillStyle = K.lampDark; ctx.beginPath(); poly(ctx, [[4, -31], [10, -31], [44, 6], [24, 4]]); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.4); ctx.beginPath(); poly(ctx, [[-8, -28], [-3, -28], [-26, 1], [-34, 3]]); ctx.fill();
  rrect(ctx, -8, -42, 16, 12, 3, K.steelShade, lws * 0.8, K.ink);
  ctx.restore();
  if (bulb > 0) glow(ctx, bx, by + 16, 36, '#ffffff', 0.8 * bulb);

  // ---- welding flicker: blue-white flashes on everything, pulsing with the beat
  const fl = clamp(o.flicker || 0);
  if (fl > 0) {
    const f = fl * (0.35 + 0.65 * pulse(t, 5)) * (0.6 + 0.4 * Math.abs(noise1(t * 41, 7)));
    ctx.fillStyle = rgba('#d6ecff', 0.3 * f); ctx.fillRect(X0, -60, WW, fy1 + 60);
  }
  ctx.restore();
}
function sparkleTiny(ctx, x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// ---------------------------------------------------------------- s04 props: paint can, stepladder
const propTint = (o) => { const k = o.tod ? todTint(o.tod) : null; return (h) => (k ? tintColor(h, k) : h); };
/**
 * drawPaintCan(ctx, x, y, s = 1, o = {}) — an open gallon paint tin, (x,y) = bottom centre;
 * ~76 x 86 px at s = 1 (a fifth of Juno's height). o: { color (paint, default red '#e8453c'),
 * lid 'off' | 'on' (default 'off'), drips bool (default true), splash 0..1 (a crown splash out of
 * the paint — animate 0 -> 1 when Biscuit's paw goes in), tod (optional grade), t }
 */
export const PAINT_CAN = { w: 76, h: 86, rimY: -86 };
export function drawPaintCan(ctx, x, y, s = 1, o = {}) {
  const tc = propTint(o), ik = INK, lw = LW * 0.8;
  const paint = tc(o.color || '#e8453c'), paintS = mixColor(paint, INK, 0.28), paintL = mixColor(paint, '#ffffff', 0.35);
  const metal = tc('#cfd6e3'), metalS = tc('#98a2b6'), label = tc('#fff1d6');
  const w = PAINT_CAN.w, h = PAINT_CAN.h, rx = w / 2, ry = 11;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // bail handle, resting back behind the can
  ctx.beginPath(); ctx.moveTo(-rx + 2, -h + 14); ctx.quadraticCurveTo(0, -h - 36, rx - 2, -h + 14);
  ctx.strokeStyle = ik; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = metalS; ctx.lineWidth = 2.5; ctx.stroke();
  // body
  const body = () => { ctx.beginPath(); ctx.moveTo(-rx, -h); ctx.lineTo(-rx, -ry); ctx.ellipse(0, -ry, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, -h); ctx.ellipse(0, -h, rx, ry, 0, 0, Math.PI, false); ctx.closePath(); };
  body(); ctx.fillStyle = metal; ctx.fill();
  ctx.save(); body(); ctx.clip();
  // label band (follows the curvature) + colour swatch
  ctx.beginPath(); ctx.ellipse(0, -h * 0.7, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, -h * 0.3); ctx.ellipse(0, -h * 0.3, rx, ry, 0, 0, Math.PI, false); ctx.closePath();
  ctx.fillStyle = label; ctx.fill();
  ellipsePath(ctx, -8, -h * 0.47, 15, 11); ctx.fillStyle = paint; ctx.fill();
  ctx.fillStyle = rgba(INK, 0.35); ctx.fillRect(12, -h * 0.52, 16, 3); ctx.fillRect(12, -h * 0.44, 12, 3);
  // shade on the right, highlight on the left
  ctx.fillStyle = rgba(metalS, 0.75); ctx.fillRect(rx * 0.5, -h - 20, rx, h + 30);
  ctx.fillStyle = rgba('#ffffff', 0.55); ctx.fillRect(-rx + 7, -h + 16, 6, h * 0.34);
  ctx.restore();
  body(); ink(ctx, null, lw, ik);
  // top: rim ring + paint surface (or lid)
  ellipse(ctx, 0, -h, rx, ry, metalS, lw, ik);
  if (o.lid === 'on') {
    ellipse(ctx, 0, -h, rx - 6, ry - 3, metal, 2.5, ik);
    ellipse(ctx, 0, -h, rx - 14, ry - 5, null, 2, metalS);
  } else {
    ellipse(ctx, 0, -h + 1, rx - 5, ry - 3, paint, 2.5, ik);
    ctx.beginPath(); ctx.ellipse(-6, -h - 1, rx - 20, ry - 7, 0, Math.PI * 1.1, Math.PI * 1.7); ctx.strokeStyle = paintL; ctx.lineWidth = 3; ctx.stroke();
  }
  // drips over the rim
  if (o.drips !== false && o.lid !== 'on') {
    for (const [dx, len] of [[-22, 26], [6, 44], [24, 18]]) {
      const top = -h + ry * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2)) - 1;
      ctx.beginPath(); ctx.moveTo(dx, top); ctx.lineTo(dx, top + len);
      ctx.strokeStyle = ik; ctx.lineWidth = 12; ctx.stroke(); ctx.strokeStyle = paint; ctx.lineWidth = 7; ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(0, -h + 1, rx - 5, ry - 3, 0, 0.2, Math.PI - 0.2); ctx.strokeStyle = paint; ctx.lineWidth = 7; ctx.stroke();
  }
  // crown splash: round-tipped tongues rising from the paint + flying droplets
  const u = clamp(o.splash || 0);
  if (u > 0 && u < 1 && o.lid !== 'on') {
    const up = Math.sin(Math.PI * Math.min(1, u * 1.15)), grow = ease.outCubic(Math.min(1, u * 1.6));
    const tongues = [];
    for (let k = 0; k < 5; k++) {
      const f = (k - 2) / 2, bx = f * (rx - 12) * (0.7 + 0.35 * grow);
      const hgt = (22 + 18 * (1 - Math.abs(f)) + 6 * hash01(k, 304)) * up;
      tongues.push([[bx, -h + 2], [bx + f * 10 * grow, -h - hgt * 0.55], [bx + f * 16 * grow, -h - hgt]]);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [col, wd] of [[ik, 15], [paint, 9]]) {
      ctx.beginPath();
      for (const [p0, p1, p2] of tongues) { ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); }
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.stroke();
    }
    ellipse(ctx, 0, -h + 1, (rx - 8) * (0.8 + 0.2 * grow), ry - 4, paint, 0);
    for (const [, , p2] of tongues) circle(ctx, p2[0], p2[1] - 3, 6.5, paint, 2.5, ik);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI + (k + 0.5) * (Math.PI / 6), d = 28 + 46 * grow * (0.7 + 0.5 * hash01(k, 301));
      const dx = Math.cos(a) * d, dy = -h - 40 * up - 50 * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (0.6 + 0.6 * hash01(k, 302)) + 60 * u * u;
      circle(ctx, dx, dy, (5 + 3 * hash01(k, 303)) * (1 - 0.45 * u), paint, 2.2, ik);
    }
  }
  ctx.restore();
}

/**
 * drawStepladder(ctx, x, y, s = 1, o = {}) — a sunny-yellow A-frame stepladder (s04 painting),
 * (x,y) = ground point between the front feet. 300 px tall at s = 1 (Juno is 420).
 * Stand Juno on a tread at (x, y - STEPLADDER.steps[i] * s). o: { t, wobble 0..1 (a beat-locked
 * rock about the feet), splats bool (paint dots, default true), tod (optional grade) }
 */
export const STEPLADDER = { height: 300, steps: [74, 148, 222], top: 294, footW: 128 };
export function drawStepladder(ctx, x, y, s = 1, o = {}) {
  const tc = propTint(o), ik = INK, lw = LW * 0.8, t = o.t || 0;
  const rail = tc('#ffd23f'), railS = tc('#e0a82a'), tread = tc('#ffe27a'), treadS = tc('#e8b93a');
  const back = tc('#d9a826'), backS = tc('#b8871c'), cap = tc('#e8453c'), capS = tc('#b52d2d'), foot = tc('#3f3d4f'), metal = tc('#98a2b6');
  const H = STEPLADDER.height, fw = STEPLADDER.footW / 2;
  const railX = (side, hy) => side * lerp(fw, 40, hy / H); // front rails lean in toward the top
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.rotate(0.025 * clamp(o.wobble || 0) * sway(t, 1));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // back legs (behind, set back to the right)
  for (const side of [-1, 1]) {
    const bx0 = side * fw + 44, bx1 = side * 34 + 22;
    const pts = thickStrip([[bx0, 0], [bx1, -H + 18]], 16);
    fillPoly(ctx, pts, side < 0 ? back : backS, lw, ik);
  }
  // spreader braces
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(railX(side, 130), -130); ctx.lineTo(side * 36 + 36, -150);
    ctx.strokeStyle = ik; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = metal; ctx.lineWidth = 3.5; ctx.stroke();
  }
  // front rails
  for (const side of [-1, 1]) {
    const pts = [[side * fw - 11, 0], [side * fw + 11, 0], [side * 40 + 11, -H + 10], [side * 40 - 11, -H + 10]];
    fillPoly(ctx, pts, rail, lw, ik);
    ctx.fillStyle = railS; ctx.beginPath(); poly(ctx, [[side * fw + 3, -2], [side * fw + 10, -2], [side * 40 + 10, -H + 14], [side * 40 + 3, -H + 14]]); ctx.fill();
    rrect(ctx, side * fw - 13, -10, 26, 12, 4, foot, lw * 0.8, ik);
  }
  // treads (top face + front edge)
  STEPLADDER.steps.forEach((hy) => {
    const l = railX(-1, hy) - 8, r = railX(1, hy) + 8;
    ctx.beginPath(); poly(ctx, [[l, -hy], [r, -hy], [r + 10, -hy - 10], [l + 10, -hy - 10]]); ink(ctx, tread, lw * 0.8, ik);
    rrect(ctx, l, -hy, r - l, 14, 2, treadS, lw * 0.8, ik);
  });
  // top cap
  rrect(ctx, -58, -H - 6, 116, 22, 6, cap, lw, ik);
  ctx.fillStyle = capS; ctx.fillRect(22, -H + 4, 32, 8);
  ctx.fillStyle = rgba('#ffffff', 0.45); ctx.fillRect(-48, -H - 1, 34, 4);
  rrect(ctx, -18, -H - 2, 36, 8, 4, capS, 2, ik); // tool slot
  // paint splats
  if (o.splats !== false) {
    for (const [px, py, r, c] of [[-30, -STEPLADDER.steps[2] - 5, 5, '#e8453c'], [18, -STEPLADDER.steps[1] - 4, 4, '#2ec4b6'], [-46, -60, 4, '#e8453c'], [44, -H + 2, 4, '#fff1d6']]) {
      ctx.fillStyle = tc(c); ellipsePath(ctx, px, py, r * 1.4, r * 0.8); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- top-down lawn
/**
 * drawLawnTopDown(ctx, o) — full-frame (1920x1080 screen coords) top-down lawn at night with a
 * red/white gingham picnic blanket. o: { t, tod (default 'night'), blanket: {x, y, w, h, rot},
 * fireflies 0..1 (default 1 at night) }
 */
export function drawLawnTopDown(ctx, o = {}) {
  const P = look({ ...o, tod: o.tod || 'night' });
  const { C, t } = P, ik = P.inkC;
  const bl = { x: 960, y: 560, w: 1000, h: 640, rot: -0.05, ...(o.blanket || {}) };
  const X0 = -240, Y0 = -240, WW = 2400, HH = 1560;
  const night = P.tod === 'night' ? 1 : P.tod === 'dusk' ? 0.5 : 0;
  const ca = Math.cos(bl.rot), sa = Math.sin(bl.rot);
  // true when (x,y) +- pad lies well under the blanket (skip: it would be painted over)
  const under = (x, y, pad) => {
    const dx = x - bl.x, dy = y - bl.y, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
    return Math.abs(lx) < bl.w / 2 - pad - 12 && Math.abs(ly) < bl.h / 2 - pad - 12;
  };
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const M = typeof o._profile === 'function' ? o._profile : () => {};
  M('start');
  // base grass: opaque stepped rings (lighter where the moon falls, darker toward the corners);
  // the moonlight wash and vignette are baked into the ring colours (no full-frame gradients)
  const washAt = (u) => (u < 0.5 ? mixColor('#cfe0ff', '#8aa4ff', u * 2) : mixColor('#8aa4ff', '#050718', (u - 0.5) * 2));
  const washA = (u) => night * (u < 0.5 ? lerp(0.16, 0.04, u * 2) : lerp(0.04, 0.55, (u - 0.5) * 2));
  const grassAt = (u) => (u < 0.6 ? mixColor(C.lawn, C.lawnFront, u / 0.6) : mixColor(C.lawnFront, C.lawnDeep, (u - 0.6) / 0.4));
  const ringCol = (u) => mixColor(grassAt(u), washAt(u), washA(u));
  ctx.fillStyle = ringCol(1); ctx.fillRect(X0, Y0, WW, HH);
  const gx = 790, gy = 450;
  for (let k = 0; k < 9; k++) {
    // organic wobble so the steps read as a moonlit pool on the lawn, not a target
    const u = 0.92 - k * 0.088, R = 1400 * u, pts = [];
    for (let j = 0; j < 20; j++) {
      const a = (j / 20) * TAU, w = 1 + 0.035 * noise1(j * 0.9 + k * 3.7, 271) + 0.02 * Math.sin(a * 3 + k);
      pts.push([gx + Math.cos(a) * R * w * 1.08, gy + Math.sin(a) * R * w * 0.94]);
    }
    smoothPath(ctx, pts, true);
    ctx.fillStyle = ringCol(u - 0.04); ctx.fill();
  }
  M('rings');
  // mottling
  for (const [col, seed, a] of [[C.patchL, 201, 0.3], [C.patchD, 203, 0.35]]) {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const x = X0 + hash01(i, seed) * WW, y = Y0 + hash01(i, seed + 1) * HH, r = 60 + 130 * hash01(i, seed + 2);
      if (under(x, y, r) || x + r < -20 || x - r > 1940 || y + r < -20 || y - r > 1100) continue;
      ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * (0.55 + 0.3 * hash01(i, seed + 3)), hash01(i, seed + 4) * 3, 0, TAU);
    }
    ctx.globalAlpha = a; ctx.fillStyle = mixColor(col, washAt(0.6), washA(0.6)); ctx.fill(); ctx.globalAlpha = 1;
  }
  M('mottle');
  // grass blade clusters seen from above: small filled fans (fills are far cheaper than strokes),
  // swaying on the beat
  const sw = sway(t, 2);
  for (const [col, seed, n] of [[C.lawnDeep, 211, 130], [C.tuftBack, 213, 110], [C.lawnBack, 215, 55]]) {
    ctx.fillStyle = mixColor(col, washAt(0.55), washA(0.55) * 0.8);
    for (let i = 0; i < n; i++) {
      const x = -60 + hash01(i, seed) * 2040, y = -60 + hash01(i, seed + 1) * 1200;
      if (under(x, y, 20)) continue;
      const s = 0.8 + 0.7 * hash01(i, seed + 2), rot = -Math.PI / 2 + (hash01(i, seed + 3) - 0.5) * 1.2;
      const bend = 2.5 * sw * s;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = rot + (k - 2) * 0.42 + 0.15 * (hash01(i * 5 + k, seed + 4) - 0.5);
        const l = (9 + 9 * hash01(i * 5 + k, seed + 5)) * s * (k === 2 ? 1.25 : 1);
        const bx = x + (k - 2) * 1.5, px = -Math.sin(a) * 2.2 * s, py = Math.cos(a) * 2.2 * s;
        ctx.moveTo(bx + px, y + py); ctx.lineTo(x + Math.cos(a + 0.2) * l + bend, y + Math.sin(a + 0.2) * l); ctx.lineTo(bx - px, y - py);
      }
      ctx.fill();
    }
  }
  M('blades');
  // clover patches
  for (let i = 0; i < 16; i++) {
    const x = X0 + hash01(i, 221) * WW, y = Y0 + hash01(i, 222) * HH, r = 7 + 3 * hash01(i, 223), rot = hash01(i, 224) * TAU;
    if (under(x, y, 16) || x < -30 || x > 1950 || y < -30 || y > 1110) continue;
    const sh = [0, 1, 2].map((k) => [x + Math.cos(rot + (k * TAU) / 3) * r, y + Math.sin(rot + (k * TAU) / 3) * r, r * 0.95]);
    blobs(ctx, sh, C.stemLeaf, 2.5, C.tuftLine);
  }
  M('clover');
  // little flowers: daisies + buttercups (petals as one union path per pass)
  for (let i = 0; i < 34; i++) {
    const x = X0 + 120 + hash01(i, 231) * (WW - 240), y = Y0 + 120 + hash01(i, 232) * (HH - 240);
    if (under(x, y, 16) || x < -30 || x > 1950 || y < -30 || y > 1110) continue;
    const s = 0.8 + 0.5 * hash01(i, 233), bob = 1.5 * sw;
    const yellow = hash01(i, 234) < 0.35;
    const np = yellow ? 5 : 8, pr = (yellow ? 5.5 : 4.2) * s;
    for (const [grow, col] of [[1.1, ik], [-1.1, yellow ? C.f2 : C.daisy]]) {
      ctx.beginPath();
      for (let k = 0; k < np; k++) { const a = (k / np) * TAU + i, px = x + bob + Math.cos(a) * 7 * s, py = y + Math.sin(a) * 7 * s; ctx.moveTo(px + pr + grow, py); ctx.arc(px, py, pr + grow, 0, TAU); }
      ctx.fillStyle = col; ctx.fill();
    }
    circle(ctx, x + bob, y, 4 * s, yellow ? C.f6 : C.daisyC, 1.8, ik);
  }
  M('flowers');
  // pebbles
  for (let i = 0; i < 8; i++) {
    const x = X0 + hash01(i, 241) * WW, y = Y0 + hash01(i, 242) * HH, r = 7 + 8 * hash01(i, 243);
    if (under(x, y, r) || x < -30 || x > 1950 || y < -30 || y > 1110) continue;
    ellipse(ctx, x, y, r, r * 0.8, C.stone, 3, ik, hash01(i, 244) * 3);
  }
  M('pebbles');
  // blanket
  ctx.save();
  ctx.translate(bl.x, bl.y); ctx.rotate(bl.rot);
  const bw = bl.w, bh = bl.h;
  // edge polygon, optionally inset (same wobble), with the folded-over top-right corner cut
  const edgePts = (ins = 0) => {
    const pts = [], N = 10, k = 0.414 * ins;
    for (let i = 0; i < N; i++) pts.push([-bw / 2 + ins + ((bw - 2 * ins) * i) / N, -bh / 2 + ins + 5 * noise1(i * 0.9, 251)]);
    pts.push([bw / 2 - 70 - k, -bh / 2 + 2 + ins]);
    pts.push([bw / 2 - ins, -bh / 2 + 70 + k]);
    for (let i = 1; i < N; i++) pts.push([bw / 2 - ins + 5 * noise1(i * 0.9, 252), -bh / 2 + ins + ((bh - 2 * ins) * i) / N]);
    for (let i = 0; i < N; i++) pts.push([bw / 2 - ins - ((bw - 2 * ins) * i) / N, bh / 2 - ins + 5 * noise1(i * 0.9, 253)]);
    for (let i = 0; i < N; i++) pts.push([-bw / 2 + ins + 5 * noise1(i * 0.9, 254), bh / 2 - ins - ((bh - 2 * ins) * i) / N]);
    return pts;
  };
  const E0 = edgePts(0);
  const edge = () => { ctx.beginPath(); poly(ctx, E0); };
  // shadow on the grass
  ctx.save(); ctx.translate(10, 12); edge(); ctx.fillStyle = rgba(P.T.shadow.col, 0.35); ctx.fill(); ctx.restore();
  const white = mixColor('#fffaf0', C.f5, 0.45), red = mixColor('#e8453c', C.f3, 0.4);
  edge(); ctx.fillStyle = white; ctx.fill();
  // gingham WITHOUT a clip: stripes are rects inset past the edge wobble (the hem covers the
  // border), cut against the folded corner's diagonal
  const sq = 62, m = 12;
  const cutA = [bw / 2 - 70 - 8, -bh / 2], cutB = [bw / 2, -bh / 2 + 70 + 8];
  const side = (x, y) => (x - cutA[0]) * (cutB[1] - cutA[1]) - (y - cutA[1]) * (cutB[0] - cutA[0]);
  const rectCut = (x0, y0, x1, y1) => {
    // Sutherland-Hodgman against the corner cut line (keep the side the centre is on)
    const keep = Math.sign(side(0, 0));
    let pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    if (pts.every(([x, y]) => Math.sign(side(x, y)) === keep)) { ctx.rect(x0, y0, x1 - x0, y1 - y0); return; }
    const out = [];
    for (let i = 0; i < 4; i++) {
      const p = pts[i], q = pts[(i + 1) % 4], sp = side(...p) * keep, sq2 = side(...q) * keep;
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq2 >= 0)) { const u = sp / (sp - sq2); out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]); }
    }
    if (out.length > 2) poly(ctx, out);
  };
  // an odd number of columns / rows: the pattern is symmetric and every border is a red stripe
  const odd = (v) => { const n = Math.max(3, Math.round(v)); return n % 2 ? n : n + 1; };
  const nx = odd(bw / sq), ny = odd(bh / sq), sx = bw / nx, sy = bh / ny;
  ctx.fillStyle = rgba(red, 0.55);
  ctx.beginPath();
  for (let k = 0; k < nx; k += 2) rectCut(Math.max(-bw / 2 + k * sx, -bw / 2 + m), -bh / 2 + m, Math.min(-bw / 2 + (k + 1) * sx, bw / 2 - m), bh / 2 - m);
  ctx.fill();
  ctx.beginPath();
  for (let k = 0; k < ny; k += 2) rectCut(-bw / 2 + m, Math.max(-bh / 2 + k * sy, -bh / 2 + m), bw / 2 - m, Math.min(-bh / 2 + (k + 1) * sy, bh / 2 - m));
  ctx.fill();

  // soft wrinkles (shade) + moonlit highlight
  ctx.strokeStyle = rgba(ik, 0.06); ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(-bw * 0.42, bh * 0.3); ctx.quadraticCurveTo(-bw * 0.2, bh * 0.18, -bw * 0.05, bh * 0.42);
  ctx.moveTo(bw * 0.15, -bh * 0.38); ctx.quadraticCurveTo(bw * 0.28, -bh * 0.2, bw * 0.4, -bh * 0.26);
  ctx.moveTo(bw * 0.25, bh * 0.2); ctx.quadraticCurveTo(bw * 0.33, bh * 0.3, bw * 0.3, bh * 0.4);
  ctx.stroke();
  ctx.fillStyle = rgba('#ffffff', 0.05);
  ellipsePath(ctx, -bw * 0.28, -bh * 0.26, bw * 0.4, bh * 0.36, -0.2); ctx.fill();
  ellipsePath(ctx, -bw * 0.3, -bh * 0.3, bw * 0.24, bh * 0.2, -0.2); ctx.fill();
  // hem stripe: stroked along an inset copy of the edge, so it stays inside without a clip
  ctx.beginPath(); poly(ctx, edgePts(10)); ctx.strokeStyle = rgba(mixColor(red, ik, 0.2), 0.8); ctx.lineWidth = 20; ctx.lineJoin = 'miter'; ctx.stroke(); ctx.lineJoin = 'round';
  edge(); ink(ctx, null, LW, ik);
  // folded corner flap (underside, plain)
  const fx = bw / 2, fy = -bh / 2;
  ctx.beginPath(); ctx.moveTo(fx - 70, fy + 2); ctx.lineTo(fx, fy + 70); ctx.lineTo(fx - 58, fy + 58); ctx.closePath();
  ink(ctx, mixColor(white, red, 0.25), LW * 0.8, ik);
  ctx.beginPath(); ctx.moveTo(fx - 64, fy + 14); ctx.lineTo(fx - 58, fy + 58); ctx.lineTo(fx - 12, fy + 64); ctx.strokeStyle = rgba(ik, 0.2); ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  M('blanket');
  // grass tufts overlapping the blanket edge a little (grounds it)
  ctx.beginPath();
  for (let i = 0; i < 30; i++) {
    const side = i % 4, u = hash01(i, 261) - 0.5;
    let lx, ly;
    if (side === 0) { lx = u * bl.w; ly = -bl.h / 2; } else if (side === 1) { lx = bl.w / 2; ly = u * bl.h; } else if (side === 2) { lx = u * bl.w; ly = bl.h / 2; } else { lx = -bl.w / 2; ly = u * bl.h; }
    if (side === 1 && ly < -bl.h / 2 + 80) continue;
    const x = bl.x + lx * ca - ly * sa, y = bl.y + lx * sa + ly * ca;
    const rot = hash01(i, 262) * TAU;
    for (let k = 0; k < 3; k++) { const a = rot + k * 2.1; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14 + 2 * sw, y + Math.sin(a) * 14); }
  }
  ctx.strokeStyle = C.tuft; ctx.lineWidth = 4.5; ctx.stroke();
  M('edgeTufts');
  const ff = o.fireflies === undefined ? night : clamp(o.fireflies);
  if (ff > 0) fireflies(ctx, t, 16, 0, 0, 1920, 1080, 270, ff, 1.3);
  ctx.restore();
}
