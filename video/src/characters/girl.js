// Juno — the 8-year-old girl (see STYLE.md "Juno" and the pose table).
//
//   drawGirl(ctx, x, y, s = 1, pose = {})      (x,y) = ground point between the feet
//   drawGirlHead(ctx, x, y, s = 1, pose = {})  (x,y) = head centre (same head code path as drawGirl)
//   girlAnchors(x, y, s = 1, pose = {})        world points {head, handL, handR, hip, cup, neck, mouth, top,
//                                              eyeL, eyeR, footL, footR, shoulderL, shoulderR} + helmet {x,y,r}
//   drawFishbowl(ctx, cx, cy, r, o = {})       the shared glass fishbowl helmet + torus neck ring (dog.js may import it)
//   GIRL_HEIGHT = 420                          standing height at s = 1 (no helmet)
//
// pose fields (all optional)
//   t          seconds: tempo-locked blink (every 6th beat, ~0.13 s), bun bob (hop), breathing (sway/4 beats),
//              wave oscillation, dangling-leg kicks when sitting, zero-g drift, smoke wisps, g-force lip flap
//   facing     1 (3/4 toward screen-right) | -1 (mirrored) | 0 = straight front; values between blend the turn
//   view       'front' | 'back'
//   stance     'stand' 'walk' 'run' 'sit' 'float' 'crouch' 'jump' 'lie'
//              sit = on an edge at the ground point, lap + legs dangle toward camera (back view: legs hidden)
//              lie = relaxed front pose; rotate it yourself for a top-down lying shot (no ground shadow)
//   phase      walk/run cycle, 1.0 = two steps; feet contact at phase 0 and 0.5 (use beatAt(t)/2)
//   expr       happy grin laugh surprised determined dazed annoyed sad sleepy awe wince excited alert gforce
//   gforce 0..1 g-force squash: squeezed lids, cheeks + hair + buns streaming toward -x (behind her),
//              grimace with flapping lip corners (default 1 with expr 'gforce', else 0). Stays inside the helmet.
//   mouth 0..1 override mouth openness     blink 0..1 (1 = closed)     look [dx, dy] in -1..1
//   soot 0..1  blackened. Partial soot = smudges on clean-ish colours; the full sooty look arrives at ≥ 0.85
//              (eyes/teeth/tongue stay bright; smoke wisps above ~0.5)
//   frizz 0..1 frazzled spiky hair poof (≤ 1.35× the hair cap) + two spiky bun lumps
//   cleanGoggleRings 0..1 clean skin circles round the eyes
//   helmet 0..1 fishbowl helmet (scales in with overshoot); raised-arm presets become a Y-pose beside the glass
//   suit       'overalls' | 'space'
//   goggles    'forehead' | 'eyes' | 'askew' | 'none' (default 'forehead', or 'none' with suit 'space')
//   armL/armR  preset 'down' 'up' 'wave' 'hips' 'point' 'forward' 'hold' 'cheer' 'reach' 'cup'
//              or { a, b, hand?: 'open'|'fist'|'point'|'spread'|'cup' }  (see angle convention below)
//   holdR/holdL fn(ctx, info) item in the hand frame: origin = hand centre, +x along the forearm;
//              info = { dir, side, angle }. The frame is mirrored with the character when facing < 0:
//              to keep text readable do `if (info.dir < 0) ctx.scale(-1, 1)` (the item then extends to -x).
//   holdRFront/holdLFront  bool: draw the item over the hand instead of under the fingers
//   holdCup    fn(ctx, info) item cradled in 'cup' hands: origin = cup point (girlAnchors().cup), never mirrored;
//              drawn after the palms/thumbs and before the curled front fingers
//   tilt       whole-body lean in radians, clockwise on screen, pivot at the ground point
//   headTilt   radians, clockwise on screen     squash  vertical squash/stretch (volume-preserving)
//   hairFloat 0..1 zero-g: buns drift up, short swaying strands (default 1 when stance 'float')
//   blush 0..1 extra cheek blush
//   light      { mul, add, addAmt, k = 1 } time-of-day tint (pass backyard todTint(tod)); INK untouched,
//              eye whites / highlights / glass get half strength
//   silhouette 0..1 every fill → '#141024' (ink kept) + a thin warm rim on the upper-left
//   lift       px (at s = 1): raise her above the ground point (jumps/bounces); shadow stays and shrinks
//   shadow     bool: override the soft ground shadow (default on for stand/walk/run/crouch/jump)
//   drawGirlHead only: bust (default true: neck + wide shoulders under the head, clipped bustDepth px below
//              centre, default 170)
//
// Conventions
//   * Body-local space: origin = ground point, +x = the side she faces, y up = negative.
//     facing -1 mirrors the whole drawing (shading is kept lit from the upper-left on screen).
//   * armR is the arm on the side she faces (screen-right at facing 1), armL the other one.
//     Arm angles {a, b}: a = shoulder angle (0 hanging down, π/2 straight out sideways, π up;
//     negative swings across the front of the body), b = elbow bend added on top of a
//     (forearm direction = a + b). Each arm is mirror-symmetric, so {a: π/2} on both = T-pose.
//     Raised arms stretch slightly (cartoon cheat) so hands clear the big head.
//   * Silhouette outlines get an on-screen floor of ~4 px (wide shots); face detail lines stay LW.
//   * All motion is a pure function of pose.t (tempo-locked via src/timing.js). No module state.
import { PAL, INK, LW, ink, circlePath, ellipsePath, rrectPath, softStarPath, sparkle } from '../draw.js';
import { TAU, clamp, lerp, mixColor, rgba, hash01, ease, fract, hexToRgb, rgbToHex, smoothstep } from '../util.js';
import { hop, sway, beatAt, sinceBeat } from '../timing.js';

export const GIRL_HEIGHT = 420;

// ---------------------------------------------------------------- proportions
const HIP_Y = -118; // hip-joint height when standing
const THIGH = 50, SHIN = 44; // hip→ankle = 94 → ankle at y = -24
const LEG_W = 33;
const UARM = 44, FARM = 40, ARM_W = 23, HAND_R = 13;
const SH_X = 33; // shoulder joint x
const SH_DY = -114; // shoulder joint relative to hip
const TOP_DY = -128; // torso top relative to hip
const NECK_DY = -130; // head pivot (chin) relative to hip
const HEAD_DY = -216; // head centre relative to hip (standing: -334)
const FACE_RX = 80, FACE_RY = 75;
// fishbowl (head-local): bowl radius, neck opening half-width, ring seat
const HELM_R = 134, HELM_OPEN = 50, HELM_SEAT = 93;
const HELM_DY = Math.sqrt(HELM_R * HELM_R - HELM_OPEN * HELM_OPEN); // bowl centre → ring centre
const HELM_CY = HELM_SEAT - HELM_DY; // bowl centre, head-local (≈ -31)

// ---------------------------------------------------------------- colours
const HOLE = mixColor('#d6cfc2', INK, 0.3); // inside of the neck ring (suit shade darkened)
const BASE = {
  skin: '#f2c49b', skinShade: '#d9a37a', cheek: '#ff9b8a', freckle: '#c9774a',
  hair: '#e8672a', hairShade: '#b8461c', hairHi: '#ff9a5c', brow: '#8e3514',
  over: '#3f7fe8', overShade: '#2c5fb8', overHi: '#79a8f5', cuff: '#5b93ee',
  shirt: '#e8453c', shirtW: '#fffaf0',
  shoe: '#e8453c', shoeShade: '#b52d2d', shoeW: '#fffaf0',
  strap: '#7a4a2a', strapShade: '#5a341c', lens: '#ffc76b', lensShade: '#e89a3a', rim: '#f6b93b', rimShade: '#c98a1e',
  suit: '#f4efe6', suitShade: '#d6cfc2', trim: '#ff8a3d', trimShade: '#d9662a', patch: '#e8453c', hole: HOLE,
  pack: '#cfd6e3', packShade: '#9aa3b5', packDark: '#5d6679',
  star: '#ffd23f', button: '#f6b93b', tie: '#ffd23f', tieShade: '#e0a820',
  ledR: '#e8453c', ledY: '#ffd23f', ledG: '#5cc26b',
  mouth: '#6e1f33', tongue: '#ff7a8a', teeth: '#ffffff', eye: '#ffffff', pupil: '#1d1a2f', pupilRefl: '#4a4580',
  hi: '#ffffff', glass: '#c4e8ff', glassEdge: '#96cdff',
  smudge: '#5d5566', blot: '#221e29', smoke: '#8d8499', smokeHi: '#c3bccd', overlay: '#34246e',
  squig: '#ff9a5c', skinClean: '#f2c49b',
};
// keys that soot never darkens (the classic gag: eyes, teeth and mouth stay bright)
const NO_SOOT = new Set(['mouth', 'tongue', 'teeth', 'eye', 'pupil', 'pupilRefl', 'hi', 'glass', 'glassEdge',
  'smudge', 'blot', 'smoke', 'smokeHi', 'overlay', 'skinClean']);
// keys that take the time-of-day light at half strength (whites / glass keep some sparkle at night)
const HALF_LIGHT = new Set(['eye', 'hi', 'teeth', 'glass', 'glassEdge']);
const KEYS = Object.keys(BASE);
const BASE_RGB = KEYS.map((k) => hexToRgb(BASE[k]));
const SOOT_RGB = hexToRgb(PAL.soot), SQUIG_SOOT = hexToRgb('#6b4a3a'), SIL_RGB = hexToRgb('#141024');
const RIM_COL = 'rgba(255,240,200,0.5)';

// soot → global colour mix: gentle (0.35·soot) for partial soot, the full 0.86 look from soot ≥ 0.85
const sootMix = (soot) => (soot > 0 ? lerp(0.35 * soot, 0.86, smoothstep(0.55, 0.85, soot)) : 0);

// Per-draw palette: soot mix (m) → time-of-day light → silhouette. Computed once per draw call.
function makePalette(m, soot, light, sil) {
  const hasLight = !!(light && (light.mul || (light.add && light.addAmt > 0)));
  if (!(m > 0) && !hasLight && !(sil > 0)) return BASE;
  const lk = hasLight ? clamp(light.k ?? 1) : 0;
  const mul = hasLight && light.mul ? hexToRgb(light.mul) : null;
  const addC = hasLight && light.add ? hexToRgb(light.add) : null;
  const addAmt = addC ? clamp(light.addAmt || 0) : 0;
  const out = {};
  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    let [r, g, b] = BASE_RGB[i];
    if (m > 0 && !NO_SOOT.has(key)) {
      const T = key === 'squig' ? SQUIG_SOOT : SOOT_RGB;
      const k = key === 'cheek' || key === 'freckle' ? clamp(m * 1.3) : key === 'squig' ? clamp(soot * 1.2) : m;
      r = lerp(r, T[0], k); g = lerp(g, T[1], k); b = lerp(b, T[2], k);
    }
    if (lk > 0) {
      const k = HALF_LIGHT.has(key) ? lk * 0.5 : lk;
      let tr = r, tg = g, tb = b;
      if (mul) { tr = (tr * mul[0]) / 255; tg = (tg * mul[1]) / 255; tb = (tb * mul[2]) / 255; }
      if (addAmt) { tr = lerp(tr, addC[0], addAmt); tg = lerp(tg, addC[1], addAmt); tb = lerp(tb, addC[2], addAmt); }
      r = lerp(r, tr, k); g = lerp(g, tg, k); b = lerp(b, tb, k);
    }
    if (sil > 0) { r = lerp(r, SIL_RGB[0], sil); g = lerp(g, SIL_RGB[1], sil); b = lerp(b, SIL_RGB[2], sil); }
    out[key] = rgbToHex([r, g, b]);
  }
  return out;
}

// ---------------------------------------------------------------- helpers
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
// unit direction for arm angle th on side (+1 = facing side, -1 = other side)
const adir = (th, side) => [side * Math.sin(th), Math.cos(th)];
function rotAbout(p, c, a) {
  if (!a) return p;
  const s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1];
  return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co];
}
// Two-bone IK. bend = +1 puts the knee on the +x side of the hip→ankle line (when the leg points down).
function ik(h, a, l1, l2, bend) {
  let dx = a[0] - h[0], dy = a[1] - h[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const maxd = l1 + l2 - 0.01;
  if (d > maxd) { a = [h[0] + (dx / d) * maxd, h[1] + (dy / d) * maxd]; dx = a[0] - h[0]; dy = a[1] - h[1]; d = maxd; }
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / d, uy = dy / d;
  return { knee: [h[0] + ux * along + uy * off * bend, h[1] + uy * along - ux * off * bend], ankle: a };
}

// Bumpy outline along an elliptical arc (appends to the current path). Bumps bulge outward.
// spike: 0 = round curls … 1 = frazzled zig-zag spikes.
function curlArc(ctx, cx, cy, rx, ry, a0, a1, n, bump, spike, seed, move) {
  n = Math.max(2, Math.round(n));
  const p0 = [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry];
  if (move) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, am = a0 + ((a1 - a0) * (i - 0.5)) / n;
    const j = hash01(i, seed);
    const qx = cx + Math.cos(a) * rx, qy = cy + Math.sin(a) * ry;
    let nx = Math.cos(am) * ry, ny = Math.sin(am) * rx;
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const mx = cx + Math.cos(am) * rx, my = cy + Math.sin(am) * ry;
    if (spike > 0.3) {
      const h = bump * (1 + spike * 2.6) * (0.55 + 0.9 * j);
      const sk = (hash01(i, seed + 5) - 0.5) * 0.9;
      ctx.lineTo(mx + nx * h - ny * h * sk, my + ny * h + nx * h * sk);
      ctx.lineTo(qx, qy);
    } else {
      const h = bump * (0.75 + 0.5 * j) * (1 + spike);
      ctx.quadraticCurveTo(mx + nx * h * 2, my + ny * h * 2, qx, qy);
    }
  }
}
// Hair tufts along an elliptical arc (appends). Tuft widths vary ±30%, each tuft length = lenFn(i, midAngle, rnd).
// spike 0 = round scallops … 1 = pointed licks that curve slightly (never identical sawblade triangles).
function tuftArc(ctx, cx, cy, rx, ry, a0, a1, n, lenFn, spike, seed, move) {
  n = Math.max(1, Math.round(n));
  let tot = 0;
  const w = [];
  for (let i = 0; i < n; i++) { const v = 0.7 + 0.6 * hash01(i, seed + 7); w.push(v); tot += v; }
  const pt = (a) => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  let a = a0;
  const p0 = pt(a0);
  if (move) ctx.moveTo(p0[0], p0[1]); else ctx.lineTo(p0[0], p0[1]);
  for (let i = 0; i < n; i++) {
    const da = ((a1 - a0) * w[i]) / tot, b = a + da;
    const am = a + da * (0.5 + (hash01(i, seed + 3) - 0.5) * 0.3);
    const A = pt(a), B = pt(b), M = pt(am);
    let nx = Math.cos(am) * ry, ny = Math.sin(am) * rx;
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const tx = -ny, ty = nx; // along the arc (toward increasing angle)
    const L = lenFn(i, am, hash01(i, seed + 11));
    const lean = (hash01(i, seed + 5) - 0.5) * 0.7;
    const T = [M[0] + nx * L + tx * L * lean, M[1] + ny * L + ty * L * lean];
    const bow = L * 0.16 * (lean >= 0 ? 1 : -1);
    const r1 = [A[0] + nx * L, A[1] + ny * L], s1 = [(A[0] + T[0]) / 2 + tx * bow, (A[1] + T[1]) / 2 + ty * bow];
    const r2 = [B[0] + nx * L, B[1] + ny * L], s2 = [(T[0] + B[0]) / 2 + tx * bow, (T[1] + B[1]) / 2 + ty * bow];
    ctx.quadraticCurveTo(lerp(r1[0], s1[0], spike), lerp(r1[1], s1[1], spike), T[0], T[1]);
    ctx.quadraticCurveTo(lerp(r2[0], s2[0], spike), lerp(r2[1], s2[1], spike), B[0], B[1]);
    a = b;
  }
}
// Scalloped line through pts (appends). Bumps bulge to the left of the travel direction
// (i.e. downward when travelling right→left).
function scallops(ctx, pts, bump, spike, seed) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l; // left normal (y-down coords)
    const j = hash01(i, seed);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    if (spike > 0.3) {
      const h = bump * (1 + spike * 1.7) * (0.6 + 0.8 * j);
      ctx.lineTo(mx - nx * h + dx * 0.15 * (j - 0.5), my - ny * h);
      ctx.lineTo(bx, by);
    } else {
      const h = bump * (0.8 + 0.4 * j);
      ctx.quadraticCurveTo(mx - nx * h * 2, my - ny * h * 2, bx, by);
    }
  }
}
// fill → shade crescent → ink outline (outline drawn last so the shade never eats into it).
// The shade is the part of the shape not covered by the shape shifted by (dx, dy).
function solid(ctx, pathFn, fill, shade, dx, dy, lw = LW) {
  ctx.beginPath(); pathFn(0, 0); ctx.fillStyle = fill; ctx.fill();
  if (shade) {
    ctx.save(); ctx.clip();
    ctx.beginPath(); pathFn(0, 0); pathFn(dx, dy); ctx.fillStyle = shade; ctx.fill('evenodd');
    ctx.restore();
  }
  if (lw > 0) { ctx.beginPath(); pathFn(0, 0); ink(ctx, null, lw); }
}
// union of circles / rounded rects with one outline, in 2 fills (all sub-paths clockwise)
function blobPath(ctx, shapes, g) {
  ctx.beginPath();
  for (const sh of shapes) {
    if (Array.isArray(sh)) { const r = Math.max(0, sh[2] + g); ctx.moveTo(sh[0] + r, sh[1]); ctx.arc(sh[0], sh[1], r, 0, TAU); }
    else { const [x, y, w, h, r] = sh.rr; ctx.moveTo(x - g + Math.max(0, r + g), y - g); ctx.roundRect(x - g, y - g, w + 2 * g, h + 2 * g, Math.max(0, r + g)); }
  }
}
function blobs1(ctx, shapes, fill, lw = LW) {
  blobPath(ctx, shapes, lw / 2); ctx.fillStyle = INK; ctx.fill();
  blobPath(ctx, shapes, -lw / 2 + 0.5); ctx.fillStyle = fill; ctx.fill();
}
// several small highlight arcs in one stroke; arcs are screen-oriented (lit from upper-left)
// arcs: [x, y, r, a0 = 0.95, a1 = 1.6] (angles in units of π)
function hiArcs(ctx, D, col, w, arcs) {
  ctx.beginPath();
  for (const [x, y, r, a0 = 0.95, a1 = 1.6] of arcs) {
    let s0 = Math.PI * a0, s1 = Math.PI * a1;
    if (D < 0) { const t0 = Math.PI - s1; s1 = Math.PI - s0; s0 = t0; }
    ctx.moveTo(x + Math.cos(s0) * r, y + Math.sin(s0) * r); ctx.arc(x, y, r, s0, s1);
  }
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
}
function polyCW(ctx, pts) { // adds a closed polygon with clockwise (screen) winding
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  const ps = a < 0 ? [...pts].reverse() : pts;
  ctx.moveTo(ps[0][0], ps[0][1]); for (let i = 1; i < ps.length; i++) ctx.lineTo(ps[i][0], ps[i][1]); ctx.closePath();
}
// Thick outlined limb along a polyline. opts: { stripes: colour, dash, lw }
function limb(ctx, pts, w, base, shade, D, opts = {}) {
  const path = () => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = INK; ctx.lineWidth = w + 2 * (opts.lw ?? LW); ctx.stroke();
  path(); ctx.strokeStyle = base; ctx.lineWidth = w; ctx.stroke();
  if (opts.stripes) {
    ctx.save();
    ctx.lineCap = 'butt'; ctx.setLineDash([opts.dash || 7, opts.dash || 7]);
    ctx.lineDashOffset = opts.dashOffset || 0;
    path(); ctx.strokeStyle = opts.stripes; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }
  if (shade) {
    ctx.save();
    ctx.translate(w * 0.21 * D, w * 0.13);
    path(); ctx.strokeStyle = shade; ctx.lineWidth = w * 0.4; ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
// irregular soot blotch (closed Catmull-Rom through jittered points, same maths as draw.js smoothPath; appends)
function blotPath(ctx, x, y, r, seed) {
  const n = 7, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash01(i, seed) * 0.6, rr = r * (0.6 + 0.6 * hash01(i, seed + 1));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.82]);
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.closePath();
}
// soot blotches: size and opacity grow with soot. list: [x, y, r]
function blotches(ctx, P, C, list, seed) {
  const sp = smoothstep(0.03, 0.7, P.soot);
  // dark smudges carry partial soot; on the fully blackened look they fade to a faint texture
  const a = 0.8 * sp * (1 - 0.8 * smoothstep(0.7, 0.95, P.soot));
  if (a <= 0.2) return; // invisible on the fully blackened look: skip
  ctx.save();
  ctx.globalAlpha *= a; ctx.fillStyle = C.blot;
  ctx.beginPath();
  for (let i = 0; i < list.length; i++) { const [x, y, r] = list[i]; blotPath(ctx, x, y, r * (0.45 + 0.55 * sp), seed + i * 7); }
  ctx.fill();
  ctx.restore();
}
// lighter smudges on the fully sooted look (texture on the black)
function smudges(ctx, P, C, cx, cy, sx, sy, n, seed) {
  const a = smoothstep(0.7, 0.95, P.soot);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= 0.3 * a; ctx.fillStyle = C.smudge;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = cx + (hash01(i, seed) - 0.5) * sx, y = cy + (hash01(i, seed + 1) - 0.5) * sy;
    blotPath(ctx, x, y, 9 + 7 * hash01(i, seed + 2), seed + 40 + i);
  }
  ctx.fill();
  ctx.restore();
}
// dashed soot smear along a limb segment
function limbSoot(ctx, P, C, a, b, w) {
  const sp = smoothstep(0.03, 0.7, P.soot);
  const al = 0.7 * sp * (1 - smoothstep(0.7, 0.9, P.soot));
  if (al <= 0.05) return;
  ctx.save();
  ctx.globalAlpha *= al;
  ctx.lineCap = 'round'; ctx.setLineDash([2, 9 - 3 * sp]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = C.blot; ctx.lineWidth = w * (0.4 + 0.35 * sp); ctx.stroke();
  ctx.restore();
}
// short open S-strands of hair (zero-g drift / g-force streaming). list: [x, y, angle, len, wiggle]
function strands(ctx, list, C, lw) {
  if (!list.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [x, y, a, len, wg] of list) {
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, w = 5.5 * wg;
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + ux * len * 0.36 + vx * w, y + uy * len * 0.36 + vy * w,
      x + ux * len * 0.68 - vx * w, y + uy * len * 0.68 - vy * w,
      x + ux * len + vx * w * 0.35, y + uy * len + vy * w * 0.35);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 5 + 2 * Math.max(2.6, lw * 0.45); ctx.stroke();
  ctx.strokeStyle = C.hair; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}
// small lighter curl squiggles inside a frizzed mass. list: [x, y, len, rot]
function squiggles(ctx, list, C, P) {
  const a = smoothstep(0.3, 0.65, P.frizz);
  if (a <= 0 || !P.fine) return;
  ctx.save();
  ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [x, y, len, rot] of list) {
    const c = Math.cos(rot), s = Math.sin(rot), h = len / 2;
    const P0 = [x - c * h, y - s * h], P1 = [x + c * h, y + s * h];
    ctx.moveTo(P0[0], P0[1]);
    ctx.bezierCurveTo(x - c * h * 0.3 + s * 9, y - s * h * 0.3 - c * 9, x + c * h * 0.3 - s * 9, y + s * h * 0.3 + c * 9, P1[0], P1[1]);
    ctx.arc(P1[0] + s * 4, P1[1] - c * 4, 4, rot + Math.PI / 2, rot + Math.PI * 2.1, true);
  }
  ctx.strokeStyle = C.squig; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- fishbowl (shared with dog.js)
// drawFishbowl(ctx, cx, cy, r, o): glass bowl centred (cx, cy) with an orange torus neck ring below.
// o: { lw = LW, dir = 1 (-1 when the caller's ctx is mirrored: keeps glints upper-left on screen),
//      open = 0.373 r (neck opening half-width), ringDy = √(r² − open²) (bowl centre → ring centre),
//      ringRx = open + 0.045 r, ring '#ff8a3d', ringShade '#d9662a', hole (inside of the ring),
//      glass '#c4e8ff', edge '#96cdff', white '#ffffff' (pre-tinted colours for night / silhouette),
//      neck: fn(ctx, {ringY, rx, ry}) drawn into the ring's hole (clipped), e.g. the wearer's neck }
export function drawFishbowl(ctx, cx, cy, r, o = {}) {
  const lw = o.lw ?? LW, dir = o.dir ?? 1;
  const glass = o.glass || '#c4e8ff', edge = o.edge || '#96cdff', white = o.white || '#ffffff';
  const ringCol = o.ring || '#ff8a3d', ringShade = o.ringShade || '#d9662a', hole = o.hole || HOLE;
  const open = o.open ?? r * 0.373;
  const rdy = o.ringDy ?? Math.sqrt(Math.max(0, r * r - open * open));
  const rx = o.ringRx ?? open + r * 0.045, ry = 0.27 * rx;
  const oa = Math.asin(clamp(open / r, 0, 1));
  ctx.save();
  ctx.translate(cx, cy);
  if (dir < 0) ctx.scale(-1, 1);
  const bowl = (close) => { ctx.beginPath(); ctx.arc(0, 0, r, Math.PI / 2 + oa, Math.PI * 2.5 - oa); if (close) ctx.closePath(); };
  bowl(true); ctx.fillStyle = rgba(glass, 0.12); ctx.fill();
  const gc = -0.15 * r;
  const gr = ctx.createRadialGradient(gc, gc, 0.6 * r, gc, gc, r);
  gr.addColorStop(0, rgba(edge, 0)); gr.addColorStop(1, rgba(edge, 0.35));
  ctx.fillStyle = gr; ctx.fill();
  bowl(false); ink(ctx, null, lw);
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(white, 0.92);
  ctx.beginPath(); ctx.arc(0, 0, 0.8 * r, -2.80, -1.95); ctx.lineWidth = 0.10 * r; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 0.8 * r, -1.80, -1.62); ctx.lineWidth = 0.055 * r; ctx.stroke();
  ctx.strokeStyle = rgba(white, 0.4);
  ctx.beginPath(); ctx.arc(0, 0, 0.86 * r, 0.15, 0.65); ctx.lineWidth = 0.05 * r; ctx.stroke();
  // torus neck ring
  const outer = (dx, dy) => { ctx.moveTo(dx + rx, rdy + dy); ctx.ellipse(dx, rdy + dy, rx, ry, 0, 0, TAU); };
  const hy = rdy - 0.12 * ry, hrx = 0.74 * rx, hry = 0.5 * ry;
  ctx.beginPath(); outer(0, 0); ctx.fillStyle = ringCol; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.beginPath(); outer(0, 0); outer(-0.05 * rx, -0.42 * ry); ctx.fillStyle = ringShade; ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(0, hy, hrx, hry, 0, 0, TAU); ctx.fillStyle = hole; ctx.fill();
  if (o.neck) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, hy, hrx, hry, 0, 0, TAU); ctx.rect(-hrx, rdy - ry, 2 * hrx, hy - (rdy - ry)); ctx.clip('nonzero');
    o.neck(ctx, { ringY: rdy, rx, ry });
    ctx.restore();
  }
  // inner rim: the far edge is hidden by the neck, the near edge is a crisp line
  ctx.beginPath(); ctx.ellipse(0, hy, hrx, hry, 0, o.neck ? 0.05 : 0, o.neck ? Math.PI - 0.05 : TAU);
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.55; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); outer(0, 0); ink(ctx, null, lw);
  ctx.beginPath(); ctx.ellipse(0, rdy, rx * 0.84, ry * 0.62, 0, Math.PI * 1.08, Math.PI * 1.32);
  ctx.strokeStyle = rgba(white, 0.6); ctx.lineWidth = Math.max(2, ry * 0.2); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- presets
const GIRL_ARM_PRESETS = {
  down: { a: 0.14, b: 0.1, hand: 'open' },
  up: { a: 2.3, b: 0.5, hand: 'spread', raise: { a: 2.1, b: 0.12 } },
  wave: { a: 2.0, b: 0.95, hand: 'spread', wave: 1, raise: { a: 2.02, b: 0.05 } },
  hips: { a: 1.0, b: -1.6, hand: 'fist' },
  point: { a: 1.62, b: -0.04, hand: 'point' },
  forward: { a: 1.2, b: 0.3, hand: 'open' },
  hold: { a: 0.3, b: 1.25, hand: 'fist' },
  cheer: { a: 2.05, b: 0.62, hand: 'fist', raise: { a: 2.05, b: 0.3 } },
  reach: { a: 2.2, b: 0.22, hand: 'spread', raise: { a: 2.15, b: 0.05 } },
  // forearms meet in front of the chest, hands (≈ ±22, -215 at s = 1) curled into a bowl
  cup: { a: 0.25, b: -2.685, hand: 'cup', ff: 0.67 },
};
// (raise = the Y-pose {a, b} used instead when the helmet is on; see rig)

// brow: dy (px, - = up), tilt (+ = inner ends up / worried, - = inner down / cross), arch
// eye: mode open|happy|squeeze|spiral, scale, pupil, lidTop, lidBot, lidTilt, sparkle
// mouth: type smile|o|wavy|grit|gforce, w, c (curve: + smile, - frown), o (open 0..1), teeth, tongue, smirk, off
const EXPR = {
  happy: { brow: { dy: 0, tilt: 0.12, arch: 3 }, eye: { mode: 'open' }, mouth: { w: 30, c: 1, o: 0.32, tongue: 1 } },
  grin: { brow: { dy: -2, tilt: 0, arch: 3 }, eye: { mode: 'open', lidBot: 0.3 }, mouth: { w: 46, c: 1.15, o: 0.5, teeth: 1 } },
  laugh: { brow: { dy: -6, tilt: 0.2, arch: 4 }, eye: { mode: 'happy' }, mouth: { w: 40, c: 1, o: 1, tongue: 1, teeth: 1 } },
  surprised: { brow: { dy: -13, tilt: 0.1, arch: 7 }, eye: { mode: 'open', scale: 1.1, pupil: 0.62 }, mouth: { type: 'o', w: 22, h: 28 } },
  determined: { brow: { dy: 5, tilt: -0.55, arch: 0 }, eye: { mode: 'open', lidTop: 0.3, lidTilt: 1, lidBot: 0.14 }, mouth: { w: 30, c: 0.55, o: 0, smirk: 1 } },
  dazed: { brow: { dy: -5, tilt: 0.35, arch: 2 }, eye: { mode: 'spiral' }, mouth: { type: 'wavy', w: 30 } },
  annoyed: { brow: { dy: 6, tilt: -0.22, arch: -1 }, eye: { mode: 'open', lidTop: 0.5, lidTilt: 0.3 }, mouth: { w: 22, c: -0.45, o: 0, off: 5 } },
  sad: { brow: { dy: -3, tilt: 0.62, arch: 1 }, eye: { mode: 'open', pupil: 1.12, lidTop: 0.2, lidTilt: -0.8, wet: 1 }, mouth: { w: 24, c: -1, o: 0.1 } },
  sleepy: { brow: { dy: 3, tilt: 0.12, arch: 1 }, eye: { mode: 'open', lidTop: 0.62, lidBot: 0.08 }, mouth: { type: 'o', w: 11, h: 10 } },
  awe: { brow: { dy: -10, tilt: 0.32, arch: 4 }, eye: { mode: 'open', scale: 1.12, pupil: 1.25, sparkle: 1 }, mouth: { w: 18, c: 0.3, o: 0.6 } },
  wince: { brow: { dy: 6, tilt: -0.4, arch: 0 }, eye: { mode: 'squeeze' }, mouth: { type: 'grit', w: 36 } },
  excited: { brow: { dy: -10, tilt: 0.15, arch: 5 }, eye: { mode: 'open', scale: 1.08, sparkle: 1, pupil: 1.1 }, mouth: { w: 42, c: 1.2, o: 0.85, tongue: 1, teeth: 1 } },
  alert: { brow: { dy: -9, tilt: 0.05, arch: 5 }, eye: { mode: 'open', scale: 1.05, pupil: 0.8 }, mouth: { w: 16, c: 0, o: 0.3 } },
  // lids scale with pose.gforce (1 → the visible eye is 35% of its height)
  gforce: { brow: { dy: -7, tilt: 0.4, arch: 1 }, eye: { mode: 'open', pupil: 0.72, lidTop: 0.33, lidBot: 0.32, lidTilt: -0.4, g: 1 }, mouth: { type: 'gforce', w: 54 } },
};

// ---------------------------------------------------------------- pose normalisation
function norm(pose = {}) {
  const P = Object.assign({}, pose);
  const hasT = typeof pose.t === 'number' && isFinite(pose.t);
  P.hasT = hasT; P.t = hasT ? pose.t : 0;
  P.beat = hasT ? beatAt(P.t) : 0;
  const f = typeof pose.facing === 'number' ? pose.facing : 1;
  P.dir = f < 0 ? -1 : 1;
  P.back = pose.view === 'back';
  P.turn = P.back ? 0 : clamp(Math.abs(f));
  P.stance = pose.stance || 'stand';
  P.space = pose.suit === 'space';
  P.goggles = pose.goggles || (P.space ? 'none' : 'forehead');
  P.expr = EXPR[pose.expr] ? pose.expr : 'happy';
  P.soot = clamp(pose.soot || 0);
  P.frizz = clamp(pose.frizz || 0);
  P.helmet = clamp(pose.helmet || 0);
  P.hairFloat = clamp(pose.hairFloat ?? (P.stance === 'float' ? 1 : 0));
  P.blush = clamp(pose.blush || 0);
  P.clean = clamp(pose.cleanGoggleRings || 0);
  P.gf = clamp(typeof pose.gforce === 'number' ? pose.gforce : P.expr === 'gforce' ? 1 : 0);
  P.sil = clamp(pose.silhouette || 0);
  P.tilt = pose.tilt || 0;
  P.headTilt = pose.headTilt || 0;
  P.squash = pose.squash > 0 ? pose.squash : 1;
  P.look = Array.isArray(pose.look) ? pose.look : [0, 0];
  P.phase = pose.phase || 0;
  // tempo-locked secondary motion
  P.bob = hasT ? hop(P.t, 1) : 0.6; // 0 on the beat, 1 between beats
  P.breath = hasT ? 0.5 + 0.5 * sway(P.t, 4) : 0.5;
  let blink = pose.blink;
  if (blink === undefined || blink === null) {
    blink = 0;
    if (hasT) {
      const n = Math.floor(P.beat + 1e-6);
      if ((((n % 6) + 6) % 6) === 3) {
        const u = sinceBeat(P.t) / 0.13;
        if (u < 1) blink = clamp(Math.sin(Math.PI * u) * 1.6);
      }
    }
  }
  P.blink = clamp(blink);
  // defaults for callers that skip setupDraw (girlAnchors)
  P.fine = true; P.lwO = LW; P.eff = 1;
  return P;
}
// screen-dependent bits: level of detail, outline floor (~4 px on screen for silhouette strokes)
function setupDraw(ctx, P, s) {
  let det = 1, sc = 1;
  if (ctx.getTransform) {
    const m = ctx.getTransform();
    det = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); sc = Math.hypot(m.a, m.b);
  }
  P.fine = det * s > 0.45; // small wide-shot sizes skip sub-pixel details
  P.eff = Math.max(1e-3, sc * s);
  P.lwO = LW * clamp(4 / (LW * P.eff), 1, 2);
}
function paletteFor(P, light) {
  return makePalette(sootMix(P.soot), P.soot, light, P.sil);
}

function resolveArm(spec, def, P) {
  const o = spec === undefined || spec === null ? def : typeof spec === 'string' ? GIRL_ARM_PRESETS[spec] || GIRL_ARM_PRESETS.down : spec;
  const helm = P.helmet >= 0.5 && o.raise;
  let a = o.a ?? 0.14, b = o.b ?? 0.1;
  if (helm) { a = o.raise.a; b = o.raise.b; }
  if (o.wave && P.hasT) b += (helm ? 0.34 : 0.42) * sway(P.t, 1);
  return { a, b, hand: o.hand || 'open', fu: o.fu ?? 1, ff: o.ff ?? 1, helm };
}

// Walk / run arm swing. f = 0 (arm back) .. 1 (arm forward). Blends a front-view pump
// (forearm swings toward camera) with a side-view swing according to how turned she is.
function swingArm(f, side, P, run) {
  const k = P.turn * 0.7;
  const fa = run ? 0.32 + 0.1 * f : 0.16 + 0.06 * f;
  const fb = run ? -0.35 - 0.95 * f : -0.55 * f;
  const ff = 1 - 0.45 * f;
  const sw = (f - 0.5) * 2;
  const amp = run ? 0.8 : 0.42;
  const sa = 0.12 + side * amp * sw;
  const sb = side * (run ? 1.45 : 0.25 * Math.max(0, sw) + 0.06);
  return { a: lerp(fa, sa, k), b: lerp(fb, sb, k), hand: run ? 'fist' : 'open', fu: 1, ff: lerp(ff, 1, k) };
}

// helmet scale (it plonks on with overshoot, scaling about the collar at head-local y 92)
const helmetK = (h) => ease.outBack(clamp(h * 1.2));

// ---------------------------------------------------------------- rig (body-local joints)
function rig(P) {
  const st = P.stance, turn = P.turn, t = P.t;
  let hipY = HIP_Y, lean = 0, shadow = true, custom = null;
  let ankL = [-25, -24], ankR = [25, -24], bendL = -1, bendR = 1;
  let defL = GIRL_ARM_PRESETS.down, defR = GIRL_ARM_PRESETS.down;
  let bunBob = P.bob, foreshorten = false;
  const w = TAU * P.phase, sn = Math.sin(w), cs = Math.cos(w);
  const kneeFwd = turn > 0.45;
  switch (st) {
    case 'walk': {
      hipY = HIP_Y + 4 - 6 * Math.abs(sn);
      const lR = Math.max(0, -sn), lL = Math.max(0, sn);
      ankR = [24 - 4 * lR + turn * 17 * cs, -24 - 20 * lR];
      ankL = [-24 + 4 * lL - turn * 17 * cs, -24 - 20 * lL];
      if (kneeFwd) bendL = bendR = 1;
      foreshorten = true;
      defR = swingArm((1 - cs) / 2, 1, P, false);
      defL = swingArm((1 + cs) / 2, -1, P, false);
      bunBob = Math.abs(sn);
      break;
    }
    case 'run': {
      hipY = HIP_Y + 9 - 17 * Math.abs(sn);
      const lR = Math.max(0, -sn), lL = Math.max(0, sn);
      ankR = [22 - 5 * lR + turn * 27 * cs, -24 - 40 * lR];
      ankL = [-22 + 5 * lL - turn * 27 * cs, -24 - 40 * lL];
      if (kneeFwd) bendL = bendR = 1;
      foreshorten = true;
      lean = 0.13 * turn;
      defR = swingArm((1 - cs) / 2, 1, P, true);
      defL = swingArm((1 + cs) / 2, -1, P, true);
      bunBob = Math.abs(sn);
      break;
    }
    case 'sit': {
      hipY = -16; shadow = false;
      const k = P.hasT ? sway(t, 2) : 0;
      const kR = Math.max(0, k), kL = Math.max(0, -k);
      custom = {
        R: { hip: [22, hipY], knee: [25 + turn * 6, 0], ankle: [22 + turn * 8 + 4 * kR, 52 - 16 * kR], sit: 1, kick: kR },
        L: { hip: [-22, hipY], knee: [-25 + turn * 6, 0], ankle: [-22 + turn * 8 - 4 * kL, 52 - 16 * kL], sit: 1, kick: kL },
      };
      defR = defL = { a: 0.3, b: -0.55, hand: 'open' };
      break;
    }
    case 'float': {
      shadow = false;
      const s2 = P.hasT ? sway(t, 4) : 0;
      ankR = [24 + 4 * s2, -36]; ankL = [-18, -44 - 5 * s2];
      bendR = 1; bendL = -1;
      defR = { a: 1.25 + 0.14 * s2, b: 0.45, hand: 'spread' };
      defL = { a: 1.05 - 0.14 * s2, b: 0.6, hand: 'spread' };
      break;
    }
    case 'crouch': {
      hipY = -70;
      ankR = [30, -24]; ankL = [-30, -24];
      if (kneeFwd) { bendL = bendR = 1; ankL = [-16, -24]; ankR = [22, -24]; }
      lean = 0.1 * turn;
      defR = defL = { a: 0.55, b: -1.15, hand: 'open' };
      break;
    }
    case 'jump': {
      ankR = [27, -66]; ankL = [-25, -58];
      if (kneeFwd) { bendL = bendR = 1; ankR = [4, -70]; ankL = [-22, -60]; }
      defR = defL = GIRL_ARM_PRESETS.cheer;
      bunBob = 1;
      break;
    }
    case 'lie': {
      shadow = false;
      ankR = [31, -24]; ankL = [-31, -24];
      defR = defL = { a: 0.55, b: 0.25, hand: 'open' };
      bunBob = 0.5;
      break;
    }
    default: break;
  }
  const br = P.breath * 1.6;
  // Legs: 2-bone IK in 3/4 view; in front view a lifted leg foreshortens toward camera instead of
  // bending sideways (blend by how turned she is).
  const fs = foreshorten ? 1 - clamp(turn / 0.6) : 0;
  const leg = (side, ank, bend) => {
    const h = [side * 22, hipY];
    const r = ik(h, ank, THIGH, SHIN, bend);
    if (fs <= 0) return { hip: h, knee: r.knee, ankle: r.ankle };
    const a = [ank[0], Math.min(ank[1], hipY + THIGH + SHIN)];
    const lift = clamp((HIP_Y + THIGH + SHIN - 24 - a[1] + (hipY - HIP_Y)) / 40);
    const kf = [(h[0] + a[0]) / 2 + side * 4 * lift, h[1] + (a[1] - h[1]) * 0.52];
    return { hip: h, knee: [lerp(r.knee[0], kf[0], fs), lerp(r.knee[1], kf[1], fs)], ankle: [lerp(r.ankle[0], a[0], fs), lerp(r.ankle[1], a[1], fs)] };
  };
  const legs = custom || { R: leg(1, ankR, bendR), L: leg(-1, ankL, bendL) };
  const shY = hipY + SH_DY - br;
  const neck = [turn * 2, hipY + NECK_DY - br];
  const head = [turn * 3, hipY + HEAD_DY - br * 1.4];
  const headRot = P.headTilt * P.dir;
  // helmet bowl centre + radius in body-local space (for keeping raised hands off the glass)
  const hk = helmetK(P.helmet);
  const hc = rotAbout([head[0], head[1] + 92 + (HELM_CY - 92) * hk], neck, headRot);
  const need = HELM_R * hk + 22;
  const arm = (spec, def, side) => {
    const A = resolveArm(spec, def, P);
    const S = [side * SH_X, shY];
    const place = (a, st) => {
      const d1 = adir(a, side), d2 = adir(a + A.b, side);
      const E = add(S, d1, UARM * A.fu * st);
      const Wr = add(E, d2, FARM * A.ff * st);
      return { a, st, d2, E, W: Wr, H: add(Wr, d2, HAND_R * 0.55) };
    };
    let st0 = 1 + 0.16 * clamp((Math.max(A.a, A.a + A.b) - 1.75) / 0.9);
    let g = place(A.a, st0);
    if (A.helm) {
      // Y-pose beside the bowl: stretch up to 1.3×, then lower the arm, until the hand clears the glass
      const ok = (q) => Math.hypot(q.H[0] - hc[0], q.H[1] - hc[1]) >= need;
      if (!ok(g)) {
        const g13 = place(A.a, 1.3);
        if (ok(g13)) {
          let lo = st0, hi = 1.3;
          for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (ok(place(A.a, m))) hi = m; else lo = m; }
          g = place(A.a, hi);
        } else {
          let lo = A.a - 1.2, hi = A.a; // lo is assumed clear
          for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (ok(place(m, 1.3))) lo = m; else hi = m; }
          g = place(lo, 1.3);
        }
      }
    }
    return { ...A, a: g.a, side, S, E: g.E, W: g.W, H: g.H, d2: g.d2, ang: Math.atan2(g.d2[1], g.d2[0]) };
  };
  return {
    hipY, lean, shadow, legs, bunBob, br,
    top: hipY + TOP_DY - br,
    neck, head, headRot,
    armR: arm(P.armR, defR, 1),
    armL: arm(P.armL, defL, -1),
    // in a 3/4 walk/run the far (facing-side) arm swings behind the body
    farBehind: (st === 'walk' || st === 'run') && turn > 0.3 && (P.armR === undefined || P.armR === null) && !P.back,
  };
}
// where cupped hands hold something (body-local)
function cupPoint(R) {
  const cl = R.armL.hand === 'cup', cr = R.armR.hand === 'cup';
  const L = R.armL.H, Rh = R.armR.H;
  if (cl && !cr) return [L[0] + 12, L[1] - 5];
  if (cr && !cl) return [Rh[0] - 12, Rh[1] - 5];
  return [(L[0] + Rh[0]) / 2, (L[1] + Rh[1]) / 2 - 5];
}

// ---------------------------------------------------------------- head

function bunGeom(P, side, fx, bob) {
  const hf = P.hairFloat, fr = P.frizz, gf = P.gf;
  const drift = P.hasT ? hf * 0.12 * sway(P.t + side * 0.37, 4) : 0;
  const ang = -0.56 - hf * 0.4 + drift - fr * 0.06; // elevation above horizontal
  const dist = 94 + hf * 3 + fr * 6 - P.helmet * 6;
  const land = (1 - bob) * (1 - hf);
  let cx = side * Math.cos(ang) * dist - fx * 0.35;
  const cy = -12 + Math.sin(ang) * dist - 4 * bob * (1 - hf);
  const r = 37 * (1 - 0.2 * fr) * (1 - P.helmet * 0.06);
  let sx = (1 + 0.06 * land) * (1 - 0.03 * hf), sy = Math.min(1.2, (1 - 0.06 * land) * (1 + 0.12 * hf));
  if (gf > 0) { // g-force: buns stream toward -x (behind her), stretched along x — kept inside the helmet
    const off = -0.25 * FACE_RX * gf, stx = 0.3 * gf;
    let k = 1;
    if (P.helmet > 0.3) {
      const ext = (q) => Math.hypot(cx + off * q, cy - HELM_CY) + r * Math.max(sx * (1 + stx * q), sy);
      if (ext(1) > HELM_R - 8) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (ext(m) > HELM_R - 8) hi = m; else lo = m; }
        k = lo;
      }
    }
    cx += off * k; sx *= 1 + stx * k;
  }
  return { cx, cy, r, sx, sy, side };
}
function drawBun(ctx, g, P, C, D) {
  ctx.save(); ctx.translate(g.cx, g.cy); ctx.scale(g.sx, g.sy);
  const seed = g.side > 0 ? 21 : 37, fr = P.frizz;
  let pf;
  if (fr > 0) { // frazzled bun lump: 10 small tufts
    const sp = smoothstep(0.15, 0.7, fr);
    pf = (dx, dy) => { tuftArc(ctx, dx, dy, g.r, g.r, -0.3, TAU - 0.3, 10, (i, am, h) => lerp(4.5, 11 * (0.6 + 0.7 * h), fr), sp, seed, true); ctx.closePath(); };
  } else {
    pf = (dx, dy) => { curlArc(ctx, dx, dy, g.r, g.r, -0.3, TAU - 0.3, 9, 4.4, 0, seed, true); ctx.closePath(); };
  }
  solid(ctx, pf, C.hair, C.hairShade, -g.r * 0.3 * D, -g.r * 0.28, P.lwO);
  if (fr < 0.5) {
    hiArcs(ctx, D, C.hairHi, 5, [[-g.r * 0.28 * D, -g.r * 0.22, g.r * 0.34]]);
    if (P.fine) hiArcs(ctx, D, C.hairShade, 4, [[g.r * 0.25 * D, g.r * 0.2, g.r * 0.26, 0.1, 0.75]]);
  } else squiggles(ctx, [[-4 * D, -6, 18, 0.5 * D]], C, P);
  if (P.soot > 0.03) blotches(ctx, P, C, [[g.r * 0.2 * D, g.r * 0.15, g.r * 0.45]], seed + 50);
  ctx.restore();
}
// zero-g strands off the buns (3 short open S-strands each), or g-force strands streaming to -x
function hairStrands(ctx, gL, gR, P, C) {
  const hf = P.hairFloat, gf = P.gf, list = [];
  if (hf > 0.12 && P.frizz < 0.5) {
    for (const g of [gL, gR]) {
      for (let i = 0; i < 3; i++) {
        const sw = P.hasT ? sway(P.t + i * 0.45 + g.side * 0.8, 4) : 0;
        // roots spread over the upper-outer side of the bun; locks lean outward along the surface
        const base = -Math.PI / 2 + g.side * (-0.2 + 0.5 * i) + 0.12 * sw;
        const bx = g.cx + Math.cos(base) * g.r * 0.8 * g.sx, by = g.cy + Math.sin(base) * g.r * 0.8 * g.sy;
        const len = (16 + 8 * hash01(i, g.side > 0 ? 3 : 9)) * hf + g.r * 0.2;
        list.push([bx, by, base + g.side * 0.55 + 0.25 * sw, len, 1.25 + 0.35 * sw]);
      }
    }
  }
  if (gf > 0.05) {
    const fl = P.hasT ? Math.sin(8 * Math.PI * P.beat) : 0;
    const g = gL; // trailing bun (side -1 = local -x)
    const lim = P.helmet > 0.3 ? 0.6 : 1;
    list.push([g.cx - g.r * g.sx * 0.6, g.cy - 6, Math.PI + 0.25, (18 + 6 * gf) * lim * gf + 8, 0.6 + 0.4 * fl]);
    list.push([g.cx - g.r * g.sx * 0.5, g.cy + 14, Math.PI - 0.1, (16 + 6 * gf) * lim * gf + 6, 0.6 - 0.4 * fl]);
    list.push([-62 - 6 * gf, -62, Math.PI + 0.35, (14 + 5 * gf) * lim * gf + 6, 0.6 + 0.3 * fl]);
  }
  strands(ctx, list, C, P.lwO);
}
const FRINGE = [[77, -16], [62, -31], [40, -39], [16, -42], [-8, -41], [-31, -38], [-51, -33], [-67, -25], [-77, -16]];
function fringePts(P, fx, dx, dy) {
  const last = FRINGE.length - 1, gf = P.gf;
  return FRINGE.map(([x, y], i) => (i === 0 || i === last ? [dx + x, dy + y]
    : [dx + x + fx * 0.55 - gf * (7 + 7 * (i / last)), dy + y - P.hairFloat * 5 - P.frizz * 4 - gf * 2 * (i / last)]));
}
function capPath(ctx, P, fx, dx, dy) {
  const fr = P.frizz;
  const cy = -6 + dy;
  curlArc(ctx, dx - P.gf * 3, cy, 85, 84, Math.PI + 0.17, TAU - 0.17, 9, 5.6 * (1 - fr), 0, 11, true);
  const pts = fringePts(P, fx, dx, dy);
  ctx.lineTo(pts[0][0], pts[0][1]);
  scallops(ctx, pts, 5.4 - P.hairFloat * 1.6, fr, 3);
  ctx.closePath();
}
// the frizzed poof: 16 tufts over the top (none below the ear line), top tufts longer than the sides,
// outer radius ≤ 1.35 × the hair cap (85)
const FRIZZ_R = 85, FRIZZ_CY = -8;
function frizzLen(fr) {
  return (i, am, h) => lerp(5, 17 * (0.6 + 0.7 * h) * (0.8 + 0.5 * Math.max(0, -Math.sin(am))), fr);
}
function frizzTop(ctx, P, dx, dy, move) {
  const fr = P.frizz;
  tuftArc(ctx, dx - P.gf * 6, FRIZZ_CY + dy, FRIZZ_R, FRIZZ_R, Math.PI - 0.14, TAU + 0.14, 16, frizzLen(fr), smoothstep(0.15, 0.7, fr), 5, move);
}
function backHairPath(ctx, P, dx, dy) {
  const fr = P.frizz, hf = P.hairFloat, gf = P.gf;
  if (fr > 0) {
    frizzTop(ctx, P, dx, dy, true);
    tuftArc(ctx, dx - gf * 6, FRIZZ_CY + dy, FRIZZ_R, FRIZZ_R * 0.95, 0.14, Math.PI - 0.14, 8, () => 3.5, 0, 9, false);
    ctx.closePath();
    return;
  }
  const rx = 86 + gf * 6, ry = 76 + hf * 8, cy = -14 - hf * 6 + dy;
  curlArc(ctx, dx - gf * 8, cy, rx, ry, -0.2, TAU - 0.2, 16, 5.2, 0, 5, true);
  ctx.closePath();
}
function backHeadPath(ctx, P, dx, dy) {
  const fr = P.frizz;
  const pts = [[66, 44], [42, 52], [14, 58], [-14, 58], [-42, 52], [-66, 44]].map(([x, y]) => [x + dx, y + dy]);
  if (fr > 0) {
    tuftArc(ctx, dx, FRIZZ_CY + dy, FRIZZ_R, FRIZZ_R, Math.PI * 0.8, Math.PI - 0.14, 2, () => 4, 0, 13, true);
    frizzTop(ctx, P, dx, dy, false);
    tuftArc(ctx, dx, FRIZZ_CY + dy, FRIZZ_R, FRIZZ_R, TAU + 0.14, Math.PI * 2.2, 2, () => 4, 0, 17, false);
  } else {
    curlArc(ctx, dx, -6 + dy, 85, 84, Math.PI * 0.8, Math.PI * 2.2, 16, 5.6, 0, 13, true);
  }
  ctx.lineTo(pts[0][0], pts[0][1]);
  scallops(ctx, pts, 4.2, fr, 17);
  ctx.closePath();
}
const facePath = (ctx, dx, dy) => { ctx.moveTo(dx + FACE_RX, 1 + dy); ctx.ellipse(dx, 1 + dy, FACE_RX, FACE_RY, 0, 0, TAU); };

function drawEars(ctx, list, P, C, D) {
  ctx.beginPath();
  for (const [x, y] of list) { ctx.moveTo(x + 11.5, y); ctx.ellipse(x, y, 11.5, 14.5, 0, 0, TAU); }
  ink(ctx, C.skin, P.lwO);
  hiArcs(ctx, D, C.skinShade, 3.5, list.map(([x, y]) => [x + D, y + 1, 6, -0.38, 0.5]));
}

function drawEye(ctx, cx, cy, E, P, C, side, wsc, D, lidCol) {
  const sc = E.scale || 1, rx = 16 * sc * wsc, ry = 20.5 * sc;
  const mode = E.mode || 'open';
  const gk = E.g ? P.gf : 1; // g-force lids scale with pose.gforce
  const blink = Math.max((E.lidTop || 0) * gk, P.blink);
  const lidBot = (E.lidBot || 0) * gk;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  const lashes = (y0) => {
    if (!P.fine) return;
    const ox = cx + side * rx * 0.72;
    ctx.beginPath();
    ctx.moveTo(ox, y0); ctx.lineTo(ox + side * 7, y0 - 6);
    ctx.moveTo(ox - side * 5, y0 - 3.5); ctx.lineTo(ox - side * 1, y0 - 10);
    ctx.lineWidth = 3.5; ctx.stroke();
  };
  if (mode === 'happy') {
    ctx.beginPath(); ctx.arc(cx, cy + ry * 0.5, rx * 1.05, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineWidth = 6; ctx.stroke();
    lashes(cy - ry * 0.3);
  } else if (mode === 'squeeze') {
    const inw = -side;
    ctx.beginPath();
    ctx.moveTo(cx - inw * rx * 0.85, cy - ry * 0.55);
    ctx.lineTo(cx + inw * rx * 0.75, cy + 1);
    ctx.lineTo(cx - inw * rx * 0.85, cy + ry * 0.5);
    ctx.lineWidth = 6; ctx.stroke();
  } else if (mode === 'open' && blink >= 0.9) {
    ctx.beginPath(); ctx.arc(cx, cy - ry * 0.25, rx * 1.02, Math.PI * 0.12, Math.PI * 0.88);
    ctx.lineWidth = 5.5; ctx.stroke();
    lashes(cy + ry * 0.2);
  } else {
    const pf = () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); };
    pf(); ctx.fillStyle = C.eye; ctx.fill();
    ctx.save(); pf(); ctx.clip();
    if (mode === 'spiral') {
      const rot = side * P.t * 7;
      ctx.beginPath();
      for (let k = 0; k <= 28; k++) {
        const a = rot + k * 0.62 * side, rr = (k / 28) * rx * 0.95;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * (ry / rx);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.lineWidth = 3.6; ctx.stroke();
    } else {
      const pr = 11.8 * sc * (E.pupil || 1);
      const lx = clamp((P.look[0] || 0) + P.turn * 0.25, -1, 1), ly = clamp(P.look[1] || 0, -1, 1);
      const px = cx + lx * Math.max(0, rx - pr * 0.8), py = cy + 2 + ly * Math.max(0, ry - pr) * 0.85;
      circlePath(ctx, px, py, pr); ctx.fillStyle = C.pupil; ctx.fill();
      // cool reflection on the lower side of the pupil
      if (P.fine) {
        ctx.beginPath(); ctx.arc(px, py, pr * 0.72, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = C.pupilRefl; ctx.lineWidth = pr * 0.22; ctx.stroke();
      }
      const h1 = pr * (E.sparkle ? 0.42 : 0.36), hx = px - pr * 0.36 * D, hy = py - pr * 0.38;
      ctx.beginPath(); ctx.moveTo(hx + h1, hy); ctx.arc(hx, hy, h1, 0, TAU);
      ctx.moveTo(px + pr * 0.4 * D + pr * 0.15, py + pr * 0.32); ctx.arc(px + pr * 0.4 * D, py + pr * 0.32, pr * 0.15, 0, TAU);
      ctx.fillStyle = C.hi; ctx.fill();
      if (E.sparkle) sparkle(ctx, px + pr * 0.42 * D, py - pr * 0.05, pr * 0.62, C.hi, 1);
      if (E.wet) {
        ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.78, rx * 0.72, ry * 0.2, 0, Math.PI * 1.05, Math.PI * 1.95);
        ctx.strokeStyle = rgba(C.hi, 0.9); ctx.lineWidth = 3; ctx.stroke();
      }
    }
    // lids
    ctx.fillStyle = lidCol; ctx.strokeStyle = INK;
    if (blink > 0.02) {
      const ly0 = cy - ry + 2 * ry * blink * 0.95;
      const tp = (E.lidTilt || 0) * 5.5 * clamp(blink * 4);
      const yIn = ly0 + tp, yOut = ly0 - tp * 0.6;
      const xIn = cx - side * rx * 1.1, xOut = cx + side * rx * 1.1;
      ctx.beginPath(); ctx.moveTo(xOut, cy - ry - 4); ctx.lineTo(xIn, cy - ry - 4); ctx.lineTo(xIn, yIn);
      ctx.quadraticCurveTo(cx, (yIn + yOut) / 2 + 2, xOut, yOut); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(xIn, yIn); ctx.quadraticCurveTo(cx, (yIn + yOut) / 2 + 2, xOut, yOut);
      ctx.lineWidth = 4.5; ctx.stroke();
    }
    if (lidBot > 0.01) {
      const by = cy + ry - 2 * ry * lidBot;
      ctx.beginPath(); ctx.moveTo(cx - rx * 1.1, cy + ry + 4); ctx.lineTo(cx - rx * 1.1, by + 5);
      ctx.quadraticCurveTo(cx, by - 6, cx + rx * 1.1, by + 5); ctx.lineTo(cx + rx * 1.1, cy + ry + 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - rx * 1.1, by + 5); ctx.quadraticCurveTo(cx, by - 6, cx + rx * 1.1, by + 5);
      ctx.lineWidth = 3.5; ctx.stroke();
    }
    ctx.restore();
    pf(); ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.75; ctx.stroke();
    if (mode === 'open') lashes(cy - ry * 0.62 + (blink > 0.3 ? 2 * ry * blink * 0.5 : 0));
  }
  ctx.restore();
}

function drawBrow(ctx, ex, ey, B, side, C, wsc) {
  const y = ey - 30 + (B.dy || 0), hw = 13 * wsc;
  const tilt = B.tilt || 0;
  const inX = ex - side * hw, outX = ex + side * hw;
  const inY = y - tilt * 11, outY = y + tilt * 4;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(outX, outY); ctx.quadraticCurveTo(ex, y - (B.arch || 0) - 2, inX, inY);
  ctx.strokeStyle = C.brow; ctx.lineWidth = 7.5; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}

function drawMouth(ctx, x, y, M0, P, C) {
  let M = M0;
  if (P.mouth !== undefined && P.mouth !== null && M0.type !== 'gforce') {
    const m = clamp(P.mouth);
    if (M0.type === 'o') M = { ...M0, w: lerp(9, 24, m), h: lerp(7, 30, m) };
    else M = { w: Math.max(26, M0.w || 30), c: M0.type ? 0.15 : Math.max(-1, Math.min(M0.c ?? 0.4, 1)), o: m, tongue: 1, teeth: M0.teeth, smirk: 0 };
  }
  x += M.off || 0;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  if (M.type === 'o') {
    const w = M.w, h = M.h;
    const pf = () => { ctx.beginPath(); ctx.ellipse(x, y + 2, w / 2, h / 2, 0, 0, TAU); };
    pf(); ctx.fillStyle = C.mouth; ctx.fill();
    ctx.save(); pf(); ctx.clip();
    ctx.beginPath(); ctx.ellipse(x, y + 2 + h * 0.42, w * 0.34, h * 0.24, 0, 0, TAU); ctx.fillStyle = C.tongue; ctx.fill();
    ctx.restore();
    pf(); ink(ctx, null, LW * 0.75);
  } else if (M.type === 'wavy') {
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const px = x - M.w / 2 + (M.w * i) / 16, py = y + 3.5 * Math.sin((i / 16) * Math.PI * 3);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.lineWidth = 4.5; ctx.stroke();
  } else if (M.type === 'grit') {
    const w = M.w;
    rrectPath(ctx, x - w / 2, y - 7, w, 17, 7); ink(ctx, C.teeth, LW * 0.7);
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 4, y + 1.5); ctx.lineTo(x + w / 2 - 4, y + 1.5);
    for (const k of [-1, 1]) { ctx.moveTo(x + (k * w) / 6, y - 5); ctx.lineTo(x + (k * w) / 6, y + 8); }
    ctx.lineWidth = 2.5; ctx.stroke();
  } else if (M.type === 'gforce') {
    // wide grimace: top + bottom teeth, lip corners flapping 4 u · sin(8π·beat), pulled back toward -x
    const g = Math.max(0.35, P.gf), hw = (M.w / 2) * lerp(0.75, 1, g);
    const fl = P.hasT ? 4 * g * Math.sin(8 * Math.PI * P.beat) : 0;
    const x0 = x - 5 * g;
    const L = [x0 - hw, y - 3 + fl], R = [x0 + hw, y - 5 - fl];
    const up = y - 11, lo = y + 12 + 6 * g;
    const path = () => {
      ctx.beginPath(); ctx.moveTo(L[0], L[1]);
      ctx.bezierCurveTo(x0 - hw * 0.5, up, x0 + hw * 0.5, up, R[0], R[1]);
      ctx.bezierCurveTo(x0 + hw * 0.55, lo, x0 - hw * 0.55, lo, L[0], L[1]); ctx.closePath();
    };
    path(); ctx.fillStyle = C.mouth; ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = C.teeth;
    ctx.fillRect(x0 - hw - 2, up - 4, 2 * hw + 4, y - 2 - up + 4);
    ctx.fillRect(x0 - hw - 2, y + 4, 2 * hw + 4, lo - y);
    ctx.beginPath();
    ctx.moveTo(x0 - hw, y - 2); ctx.lineTo(x0 + hw, y - 2); ctx.moveTo(x0 - hw, y + 4); ctx.lineTo(x0 + hw, y + 4);
    for (const k of [-0.5, 0, 0.5]) { ctx.moveTo(x0 + k * hw, up); ctx.lineTo(x0 + k * hw, y - 2); ctx.moveTo(x0 + k * hw * 0.9, y + 4); ctx.lineTo(x0 + k * hw * 0.9, lo); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.restore();
    path(); ink(ctx, null, LW * 0.75);
  } else {
    const hw = M.w / 2, c = M.c ?? 1, o = M.o ?? 0, sm = M.smirk || 0;
    const yL = y - c * 6 + sm * 2, yR = y - c * 6 - sm * 6;
    if (o < 0.06) {
      ctx.beginPath(); ctx.moveTo(x - hw, yL); ctx.quadraticCurveTo(x, y + c * 8, x + hw, yR);
      ctx.lineWidth = 5; ctx.stroke();
      if (c > 0.3) { // little dimple ticks
        ctx.beginPath(); ctx.moveTo(x + hw - 2, yR - 4); ctx.lineTo(x + hw + 2, yR + 3);
        if (!sm) { ctx.moveTo(x - hw + 2, yL - 4); ctx.lineTo(x - hw - 2, yL + 3); }
        ctx.lineWidth = 3; ctx.stroke();
      }
    } else {
      const up = y + c * 2 - o * 1.5, lo = y + c * 6 + o * 44;
      const aU = 0.25 * (yL + yR) + 0.5 * up, aL = 0.25 * (yL + yR) + 0.5 * lo;
      const path = () => {
        ctx.beginPath(); ctx.moveTo(x - hw, yL); ctx.quadraticCurveTo(x, up, x + hw, yR);
        ctx.quadraticCurveTo(x, lo, x - hw, yL); ctx.closePath();
      };
      path(); ctx.fillStyle = C.mouth; ctx.fill();
      ctx.save(); path(); ctx.clip();
      if (M.teeth) { ctx.fillStyle = C.teeth; ctx.fillRect(x - hw, aU - 20, 2 * hw, 20 + 4 + 3 * o); }
      if (M.tongue) { ctx.beginPath(); ctx.ellipse(x + 3, aL - 1, hw * 0.58, 4 + o * 8, 0, 0, TAU); ctx.fillStyle = C.tongue; ctx.fill(); }
      ctx.restore();
      path(); ink(ctx, null, LW * 0.75);
    }
  }
  ctx.restore();
}

function drawGoggles(ctx, P, C, Cg, fx, D, clipFn) {
  const g = P.goggles;
  if (!g || g === 'none') return;
  let cx, cy, rot = 0, sep, rr, onEyes = false, crack = false;
  if (g === 'eyes') { cx = fx; cy = 10; sep = 29; rr = 25; onEyes = true; }
  else if (g === 'askew') { cx = fx * 0.5 + 4; cy = -34; rot = -0.36 * D; sep = 22; rr = 18; crack = true; }
  else { cx = fx * 0.55; cy = -60; sep = 21; rr = 17.5; }
  if (P.back) { cx = 0; sep = 0; }
  // strap (clipped to the head so it wraps around out of sight)
  ctx.save();
  ctx.beginPath(); clipFn(); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-120, 8); ctx.quadraticCurveTo(0, P.back ? 14 : -8, 120, 8);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = INK; ctx.lineWidth = 12 + LW * 1.4; ctx.stroke();
  ctx.strokeStyle = Cg.strap; ctx.lineWidth = 12; ctx.stroke();
  if (P.back) { rrectPath(ctx, -9, -1, 18, 16, 3); ink(ctx, Cg.rim, LW * 0.6); }
  ctx.restore();
  if (P.back) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const xs = [-sep, sep];
  ctx.beginPath();
  for (const x of xs) { ctx.moveTo(x + rr * 0.78, 0); ctx.arc(x, 0, rr * 0.78, 0, TAU); }
  if (onEyes) { ctx.fillStyle = rgba(Cg.lens, 0.36); ctx.fill(); }
  else {
    ctx.fillStyle = Cg.lensShade; ctx.fill();
    ctx.beginPath();
    for (const x of xs) { ctx.moveTo(x - rr * 0.1 * D + rr * 0.62, -rr * 0.1); ctx.arc(x - rr * 0.1 * D, -rr * 0.1, rr * 0.62, 0, TAU); }
    ctx.fillStyle = Cg.lens; ctx.fill();
  }
  hiArcs(ctx, D, rgba(Cg.hi, 0.9), rr * 0.16, xs.map((x) => [x, 0, rr * 0.5, 1.08, 1.45]));
  ctx.beginPath();
  for (const x of xs) { ctx.moveTo(x + rr * 0.89, 0); ctx.arc(x, 0, rr * 0.89, 0, TAU); }
  ctx.strokeStyle = INK; ctx.lineWidth = rr * 0.24 + LW * 1.5; ctx.stroke();
  ctx.strokeStyle = Cg.rim; ctx.lineWidth = rr * 0.24; ctx.stroke();
  hiArcs(ctx, D, Cg.rimShade, rr * 0.12, xs.map((x) => [x, 0, rr * 0.89, 0.05, 0.7]));
  if (crack) {
    const x = sep;
    ctx.beginPath(); ctx.moveTo(x - 2, -3); ctx.lineTo(x + 6, -9); ctx.lineTo(x + 9, -12);
    ctx.moveTo(x - 2, -3); ctx.lineTo(x - 8, 2); ctx.lineTo(x - 9, 9);
    ctx.moveTo(x - 2, -3); ctx.lineTo(x + 5, 5);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke();
  }
  // bridge
  ctx.beginPath(); ctx.moveTo(-sep + rr * 0.9, 0); ctx.lineTo(sep - rr * 0.9, 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = Cg.strap; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
}

function drawHelmet(ctx, P, C, D) {
  const h = P.helmet;
  if (h <= 0) return;
  const k = helmetK(h);
  ctx.save();
  ctx.globalAlpha *= clamp(h * 2.5);
  ctx.translate(0, 92); ctx.scale(k, k); ctx.translate(0, -92);
  drawFishbowl(ctx, 0, HELM_CY, HELM_R, {
    lw: P.lwO, dir: D, open: HELM_OPEN, ringDy: HELM_DY, ringRx: HELM_OPEN + 6,
    glass: C.glass, edge: C.glassEdge, white: C.hi, ring: C.trim, ringShade: C.trimShade, hole: C.hole,
    neck: (c, g) => { c.fillStyle = C.skinShade; c.fillRect(-13, g.ringY - 40, 26, 60); },
  });
  if (P.sil > 0) hiArcs(ctx, D, rgba('#fff0c8', 0.5 * P.sil), 2 / P.eff, [[0, HELM_CY, HELM_R - P.lwO / 2 - 1 / P.eff, 1.02, 1.42]]);
  ctx.restore();
}

function smokeWisps(ctx, P, C) {
  const a = clamp((P.soot - 0.45) * 2.2);
  if (a <= 0) return;
  const top = -96 - P.frizz * 26;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const u = P.hasT ? fract(P.t * 0.45 + i * 0.5) : 0.35 + i * 0.3;
    const x0 = (i ? 26 : -22) + 8 * Math.sin(u * 5 + i), y = top - u * 80;
    ctx.globalAlpha = a * Math.sin(Math.PI * clamp(u * 1.3)) * 0.85;
    ctx.beginPath(); ctx.moveTo(x0, y + 30);
    ctx.bezierCurveTo(x0 + 18, y + 16, x0 - 16, y + 4, x0 + 4, y - 16);
    ctx.strokeStyle = C.smoke; ctx.lineWidth = 9 + 6 * u; ctx.stroke();
    ctx.strokeStyle = C.smokeHi; ctx.lineWidth = 3.5; ctx.stroke();
  }
  ctx.restore();
}

function drawTie(ctx, g, C) {
  const ux = g.cx, uy = g.cy + 12, l = Math.hypot(ux, uy) || 1;
  const k = g.r * 0.42;
  const x = g.cx - (ux / l) * k * g.sx, y = g.cy - (uy / l) * k * g.sy;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux));
  ctx.beginPath(); ctx.ellipse(0, 0, 6.5, 13.5, 0, 0, TAU); ink(ctx, C.tie, LW * 0.8);
  ctx.beginPath(); ctx.ellipse(1.5, 3, 2.5, 8, 0, -0.3, 1.9); ctx.strokeStyle = C.tieShade; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}

// Everything above the neck, in head-local space (origin = head centre, facing +x).
function drawHeadLocal(ctx, P, C, Cg, bunBob) {
  const D = P.dir, fx = P.back ? 0 : P.turn * 13;
  const bob = bunBob ?? P.bob;
  const gL = bunGeom(P, -1, fx, bob), gR = bunGeom(P, 1, fx, bob);
  const E = EXPR[P.expr];
  const gf = P.gf;
  hairStrands(ctx, gL, gR, P, C);
  drawBun(ctx, gR, P, C, D);
  drawBun(ctx, gL, P, C, D);
  if (P.back) {
    drawEars(ctx, [[-79, 14], [79, 14]], P, C, D);
    ctx.beginPath(); facePath(ctx, 0, 0); ink(ctx, C.skin, P.lwO);
    const hp = (dx, dy) => backHeadPath(ctx, P, dx, dy);
    solid(ctx, hp, C.hair, C.hairShade, -15 * D, -12, P.lwO);
    if (P.frizz < 0.5) {
      hiArcs(ctx, D, C.hairHi, 5, [[-42 * D, -52, 13], [-12 * D, -70, 11], [-60 * D, -18, 10]]);
      if (P.fine) hiArcs(ctx, D, C.hairShade, 4, [[30 * D, 8, 12, 0.2, 0.9], [6 * D, 36, 11, 0.2, 0.9], [44 * D, -34, 10, 0.2, 0.9]]);
    }
    squiggles(ctx, [[-40, -52, 22, -0.4], [14, -72, 20, 0.2], [46, -22, 20, 0.9], [-18, 14, 18, 0.1]], C, P);
    if (P.soot > 0.03) {
      ctx.save(); ctx.beginPath(); hp(0, 0); ctx.clip();
      blotches(ctx, P, C, [[-30, -40, 16], [36, -10, 14], [0, 30, 12]], 301);
      ctx.restore();
    }
    drawTie(ctx, gL, C); drawTie(ctx, gR, C);
    drawGoggles(ctx, P, C, Cg, 0, D, () => backHeadPath(ctx, P, 0, 0));
  } else {
    const bh = (dx, dy) => backHairPath(ctx, P, dx, dy);
    solid(ctx, bh, C.hair, P.frizz > 0.3 ? C.hairShade : null, -14 * D, -8, P.lwO);
    drawEars(ctx, [[79 - fx * 0.8, 15], [-79 + fx * 0.35, 15]], P, C, D);
    const fp = (dx, dy) => facePath(ctx, dx, dy);
    solid(ctx, fp, C.skin, C.skinShade, -13 * D, -9, P.lwO);
    const ey = 10, eL = [-28 + fx, ey], eR = [28 + fx, ey];
    const wL = 1 + 0.03 * P.turn, wR = 1 - 0.15 * P.turn;
    const cleanSkin = P.clean > 0 ? mixColor(C.skin, C.skinClean, P.clean) : C.skin;
    ctx.save();
    ctx.beginPath(); fp(0, 0); ctx.clip();
    ctx.beginPath(); capPath(ctx, P, fx, 2 * D, 7); ctx.fillStyle = C.skinShade; ctx.fill();
    if (P.soot > 0.03) {
      // partial soot = smudges (cheek, forehead, nose bridge, chin, temple) on the face
      blotches(ctx, P, C, [[-50 + fx * 0.6, 40, 16], [55 + fx * 0.6, 26, 11], [22 + fx, -14, 12], [4 + fx, 18, 8], [-18 + fx, 64, 9], [-64, -2, 10]], 131);
      smudges(ctx, P, C, fx * 0.5, 14, 110, 70, 4, 71);
    }
    if (P.clean > 0) {
      ctx.fillStyle = cleanSkin;
      [[eL, wL, 7], [eR, wR, 9]].forEach(([e, w, sd]) => {
        ctx.beginPath(); curlArc(ctx, e[0], e[1], 26 * w, 27, 0, TAU, 12, 1.2, 0, sd, true); ctx.closePath(); ctx.fill();
      });
    }
    // g-force: skin pulled back on the trailing cheek
    if (gf > 0.3) {
      ctx.beginPath();
      for (const [yy, l] of [[24, 14], [40, 11]]) { ctx.moveTo(-60 - gf * 4, yy - l / 2); ctx.quadraticCurveTo(-68 - gf * 6, yy, -60 - gf * 4, yy + l / 2); }
      ctx.strokeStyle = C.skinShade; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
    }
    ctx.restore();
    // cheeks + freckles (g-force: stretched 1.3× and pushed back toward -x)
    const bl = P.blush, cheeks = [[-1, wL], [1, wR]], csh = -0.18 * FACE_RX * gf;
    ctx.beginPath();
    for (const [side, w] of cheeks) {
      const cx = side * 45 + fx * 0.8 + csh, rx = 13 * w * (1 + 0.3 * bl) * (1 + 0.3 * gf);
      ctx.moveTo(cx + rx, 34); ctx.ellipse(cx, 34, rx, 8.5 * (1 + 0.25 * bl), 0, 0, TAU);
    }
    ctx.fillStyle = rgba(C.cheek, 0.5 + 0.4 * bl); ctx.fill();
    if (P.soot < 0.7 && P.fine) {
      ctx.beginPath();
      for (const [side, w] of cheeks) {
        const cx = side * 45 + fx * 0.8 + csh;
        for (const [dx, dy] of [[-7, -5], [0, -8.5], [7, -4.5]]) { ctx.moveTo(cx + dx * w + 2.1, 34 + dy); ctx.arc(cx + dx * w, 34 + dy, 2.1, 0, TAU); }
      }
      ctx.fillStyle = C.freckle; ctx.fill();
    }
    // nose
    ctx.beginPath(); ctx.ellipse(fx * 1.3, 28, 6.5, 4.8, 0, 0, TAU); ctx.fillStyle = C.skinShade; ctx.fill();
    circlePath(ctx, fx * 1.3 - 2 * D, 26.5, 1.8); ctx.fillStyle = rgba(C.hi, 0.55); ctx.fill();
    drawMouth(ctx, fx * 1.15, 47, E.mouth, P, C);
    drawEye(ctx, eL[0], eL[1], E.eye, P, C, -1, wL, D, cleanSkin);
    drawEye(ctx, eR[0], eR[1], E.eye, P, C, 1, wR, D, cleanSkin);
    const headClip = () => { facePath(ctx, 0, 0); backHairPath(ctx, P, 0, 0); capPath(ctx, P, fx, 0, 0); };
    if (P.goggles === 'eyes') drawGoggles(ctx, P, C, Cg, fx, D, headClip);
    // hair cap + fringe
    const cp = (dx, dy) => capPath(ctx, P, fx, dx, dy);
    if (P.frizz > 0.5) { // frazzled: cap merges into the poof, only the fringe edge is inked
      solid(ctx, cp, C.hair, C.hairShade, -12 * D, -9, 0);
      const pts = fringePts(P, fx, 0, 0);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); scallops(ctx, pts, 5.4, P.frizz, 3);
      ink(ctx, null, LW);
    } else {
      solid(ctx, cp, C.hair, C.hairShade, -12 * D, -9, P.lwO);
    }
    if (P.frizz < 0.5) {
      hiArcs(ctx, D, C.hairHi, 5, [[-44 * D, -58, 12], [-18 * D, -74, 10], [-64 * D, -34, 8]]);
      if (P.fine) hiArcs(ctx, D, C.hairShade, 4, [[36 * D, -64, 10, 0.15, 0.85], [58 * D, -40, 8, 0.15, 0.85]]);
    }
    squiggles(ctx, [[-46 + fx * 0.4, -64, 22, -0.5], [-2 + fx * 0.5, -80, 20, 0.15], [44 + fx * 0.5, -60, 20, 0.7]], C, P);
    if (P.soot > 0.03) {
      ctx.save(); ctx.beginPath(); cp(0, 0); ctx.clip();
      blotches(ctx, P, C, [[-34 + fx * 0.4, -62, 17], [40 + fx * 0.4, -52, 13]], 171);
      ctx.restore();
    }
    drawTie(ctx, gL, C); drawTie(ctx, gR, C);
    if (P.goggles !== 'eyes') drawGoggles(ctx, P, C, Cg, fx, D, headClip);
    drawBrow(ctx, eL[0], ey, E.brow, -1, C, wL);
    drawBrow(ctx, eR[0], ey, E.brow, 1, C, wR);
  }
  smokeWisps(ctx, P, C);
  // silhouette: thin warm rim on the upper-left of the hair and the screen-left bun
  if (P.sil > 0 && P.helmet < 0.5) {
    const w = 2 / P.eff, col = rgba('#fff0c8', 0.5 * P.sil), inset = P.lwO / 2 + w / 2;
    const gS = D > 0 ? gL : gR;
    hiArcs(ctx, D, col, w, [[0, -6, 85 - inset - 4, 1.05, 1.42], [gS.cx, gS.cy, gS.r * gS.sx - inset - 3, 0.95, 1.5]]);
  }
  drawHelmet(ctx, P, C, D);
}

// ---------------------------------------------------------------- body
function torsoPath(ctx, R, dx, dy, bulk) {
  const H = R.hipY + dy, top = R.top + dy, x = dx;
  const w0 = 28 + bulk, w1 = 43 + bulk, w2 = 46 + bulk, bot = H + 17;
  ctx.moveTo(x - w0, top);
  ctx.lineTo(x + w0, top);
  ctx.bezierCurveTo(x + w0 + 12, top, x + w1, top + 7, x + w1, top + 26);
  ctx.bezierCurveTo(x + w1, top + 60, x + w2, H - 36, x + w2, H - 4);
  ctx.quadraticCurveTo(x + w2, bot, x + 28, bot);
  ctx.quadraticCurveTo(x + 7, bot, x, H + 7);
  ctx.quadraticCurveTo(x - 7, bot, x - 28, bot);
  ctx.quadraticCurveTo(x - w2, bot, x - w2, H - 4);
  ctx.bezierCurveTo(x - w2, H - 36, x - w1, top + 60, x - w1, top + 26);
  ctx.bezierCurveTo(x - w1, top + 7, x - w0 - 12, top, x - w0, top);
  ctx.closePath();
}
function quad(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
function buttons(ctx, list, C) { // list of [x, y, r]
  ctx.beginPath();
  for (const [x, y, r] of list) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ink(ctx, C.button, LW * 0.6);
  ctx.beginPath();
  for (const [x, y, r] of list) { ctx.moveTo(x - r * 0.3 + r * 0.3, y - r * 0.3); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); }
  ctx.fillStyle = rgba(C.hi, 0.7); ctx.fill();
}

function drawTorso(ctx, P, C, R, D) {
  const bulk = P.space ? 4 : 0;
  const tp = (dx, dy) => torsoPath(ctx, R, dx, dy, bulk);
  const H = R.hipY, top = R.top, bx = P.back ? 0 : P.turn * 6;
  const waist = H - 46;
  const shadeDx = -11 * D, shadeDy = -6;
  const shadeOver = rgba(C.overlay, 0.26);
  if (P.space) {
    if (P.back) { // backpack sits on the back
      solid(ctx, tp, C.suit, C.suitShade, shadeDx, shadeDy, 0);
      solid(ctx, (dx, dy) => { ctx.moveTo(-40 + dx + 18, top + 14 + dy); pk2(ctx, -40 + dx, top + 14 + dy, 80, 90, 18); }, C.pack, C.packShade, -8 * D, -8, P.lwO);
      ctx.beginPath();
      for (const k of [-1, 1]) { ctx.moveTo(k * 20, top + 32); ctx.roundRect(k * 20 - 7, top + 32, 14, 40, 7); }
      ink(ctx, C.packShade, LW * 0.6);
      circlePath(ctx, 0, top + 88, 6); ink(ctx, C.ledR, LW * 0.6);
      circlePath(ctx, -2, top + 86, 2); ctx.fillStyle = C.hi; ctx.fill();
    } else {
      ctx.save(); ctx.beginPath(); tp(0, 0); ctx.fillStyle = C.suit; ctx.fill(); ctx.clip();
      ctx.fillStyle = C.trim; ctx.fillRect(-80, waist + 2, 160, 12); // belt
      ctx.beginPath(); ctx.rect(-90, top - 20, 180, 200); tp(shadeDx, shadeDy); ctx.fillStyle = C.suitShade; ctx.fill('evenodd');
      ctx.fillStyle = C.trimShade; ctx.fillRect(-80, waist + 2, 160, 12);
      ctx.beginPath(); tp(shadeDx, shadeDy); ctx.clip(); ctx.fillStyle = C.trim; ctx.fillRect(-80, waist + 2, 160, 12);
      ctx.restore();
      ctx.save(); ctx.beginPath(); tp(0, 0); ctx.clip();
      ctx.beginPath(); ctx.moveTo(-80, waist + 2); ctx.lineTo(80, waist + 2); ctx.moveTo(-80, waist + 14); ctx.lineTo(80, waist + 14);
      ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.6; ctx.stroke();
      blotches(ctx, P, C, [[bx - 14, top + 70, 14], [bx + 26, top + 18, 10]], 181);
      ctx.restore();
      rrectPath(ctx, bx - 9, waist + 1, 18, 14, 4); ink(ctx, C.pack, LW * 0.6);
      // mission patch
      const px = bx + 20, py = top + 46;
      circlePath(ctx, px, py, 15); ink(ctx, C.patch, LW * 0.7);
      softStarPath(ctx, px, py + 1, 9.5, 5); ctx.fillStyle = C.shirtW; ctx.fill();
      // little chest control box
      rrectPath(ctx, bx - 30, top + 36, 22, 18, 5); ink(ctx, C.pack, LW * 0.6);
      [[C.ledR, -24], [C.ledY, -19], [C.ledG, -14]].forEach(([c, dx]) => { circlePath(ctx, bx + dx, top + 45, 2.6); ctx.fillStyle = c; ctx.fill(); });
    }
    ctx.beginPath(); tp(0, 0); ink(ctx, null, P.lwO);
    // collar ring (the helmet seats on it)
    const ring = (dx, dy) => { ctx.moveTo(dx + 36, top + 4 + dy); ctx.ellipse(dx, top + 4 + dy, 36, 11, 0, 0, TAU); };
    solid(ctx, ring, C.trim, C.trimShade, -5 * D, -5, LW);
    return;
  }
  // ---- overalls over the striped shirt
  const bib = (dx, dy) => {
    const x0 = bx - 25 + dx, x1 = bx + 25 + dx, y0 = H - 98 + dy, y1 = waist + dy + 1;
    ctx.moveTo(x0, y1); ctx.lineTo(x0, y0 + 8); ctx.quadraticCurveTo(x0, y0, x0 + 8, y0);
    ctx.lineTo(x1 - 8, y0); ctx.quadraticCurveTo(x1, y0, x1, y0 + 8); ctx.lineTo(x1, y1); ctx.closePath();
  };
  const straps = P.back
    ? [[[-36, top - 6], [-24, top - 6], [22, waist + 4], [10, waist + 4]], [[24, top - 6], [36, top - 6], [-10, waist + 4], [-22, waist + 4]]]
    : [[[bx - 24, H - 95], [bx - 13, H - 95], [-20, top - 6], [-32, top - 6]], [[bx + 13, H - 95], [bx + 24, H - 95], [32, top - 6], [20, top - 6]]];
  const fillOver = (col) => {
    ctx.beginPath(); ctx.rect(-90, waist, 180, 110);
    if (!P.back) bib(0, 0);
    straps.forEach((q) => polyCW(ctx, q));
    ctx.fillStyle = col; ctx.fill();
  };
  ctx.save();
  ctx.beginPath(); tp(0, 0); ctx.fillStyle = C.shirt; ctx.fill(); ctx.clip();
  ctx.beginPath();
  for (let y = top + 7; y < waist + 8; y += 14) ctx.rect(-90, y, 180, 7);
  ctx.fillStyle = C.shirtW; ctx.fill();
  fillOver(C.over);
  // shade crescent
  ctx.save();
  ctx.beginPath(); tp(0, 0); tp(shadeDx, shadeDy); ctx.clip('evenodd');
  ctx.fillStyle = shadeOver; ctx.fillRect(-90, top - 10, 180, waist - top + 12);
  fillOver(C.overShade);
  ctx.restore();
  blotches(ctx, P, C, [[bx - 8, H - 58, 15], [bx + 30, top + 16, 11], [-30, H - 12, 10]], 191);
  smudges(ctx, P, C, 0, H - 60, 80, 110, 4, 91);
  // internal ink lines
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-90, waist); ctx.lineTo(90, waist); ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.7; ctx.stroke();
  ctx.beginPath(); straps.forEach((q) => quad(ctx, q)); ctx.lineWidth = LW * 0.6; ctx.stroke();
  if (!P.back) {
    ctx.beginPath(); bib(0, 0); ink(ctx, null, LW * 0.7);
    if (P.fine) {
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(bx - 20, waist - 4); ctx.lineTo(bx - 20, H - 88); ctx.quadraticCurveTo(bx - 20, H - 93, bx - 15, H - 93);
      ctx.lineTo(bx + 15, H - 93); ctx.quadraticCurveTo(bx + 20, H - 93, bx + 20, H - 88); ctx.lineTo(bx + 20, waist - 4);
      ctx.strokeStyle = C.overHi; ctx.lineWidth = 1.8; ctx.stroke(); ctx.setLineDash([]);
    }
    softStarPath(ctx, bx + 1, H - 69, 14, 7.5); ink(ctx, C.star, LW * 0.6);
    circlePath(ctx, bx - 3 * D, H - 73, 2.6); ctx.fillStyle = rgba(C.hi, 0.75); ctx.fill();
    buttons(ctx, [[bx - 18.5, H - 90, 5.5], [bx + 18.5, H - 90, 5.5], [-44, waist + 10, 4.5], [44, waist + 10, 4.5]], C);
  } else {
    buttons(ctx, [[16, waist + 7, 5.5], [-16, waist + 7, 5.5]], C);
    if (P.fine) {
      ctx.setLineDash([3, 4]);
      rrectPath(ctx, 6, H - 32, 26, 22, 5); ctx.strokeStyle = C.overHi; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
  ctx.beginPath(); tp(0, 0); ink(ctx, null, P.lwO);
}
function pk2(ctx, x, y, w, h, r) { // rounded rect without beginPath (for shadeIn)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawBackpackFront(ctx, P, C, R, D) {
  const top = R.top;
  const pk = (dx, dy) => { ctx.moveTo(-58 + dx + 20, top - 16 + dy); pk2(ctx, -58 + dx, top - 16 + dy, 116, 96, 20); };
  solid(ctx, pk, C.pack, C.packShade, -8 * D, -8, P.lwO);
}

function shoePath(ctx, cx, cy, rx, ry) {
  ctx.moveTo(cx - rx, cy + ry * 0.55);
  ctx.bezierCurveTo(cx - rx, cy - ry * 1.15, cx + rx, cy - ry * 1.15, cx + rx, cy + ry * 0.55);
  ctx.quadraticCurveTo(cx + rx, cy + ry, cx + rx - 7, cy + ry);
  ctx.lineTo(cx - rx + 7, cy + ry);
  ctx.quadraticCurveTo(cx - rx, cy + ry, cx - rx, cy + ry * 0.55);
  ctx.closePath();
}
function drawShoe(ctx, a, P, C, D) {
  const t = P.turn, cx = a[0] + t * 5, cy = a[1] + 10, rx = 23 + t * 4, ry = 15;
  const sp = (dx, dy) => shoePath(ctx, cx + dx, cy + dy, rx, ry);
  const main = P.space ? C.trim : C.shoe, sole = P.space ? C.suit : C.shoeW;
  if (P.space) { rrectPath(ctx, a[0] - 19, a[1] - 16, 38, 24, 10); ink(ctx, main, P.lwO); }
  ctx.save(); ctx.beginPath(); sp(0, 0); ctx.fillStyle = main; ctx.fill(); ctx.clip();
  ctx.beginPath(); ctx.rect(cx - rx - 2, cy + ry * 0.5, 2 * rx + 4, ry);
  if (!P.back && !P.space) { ctx.moveTo(cx + t * 8 + rx * 0.64, cy + ry * 0.35); ctx.ellipse(cx + t * 8, cy + ry * 0.35, rx * 0.64, ry * 0.62, 0, 0, TAU); }
  ctx.fillStyle = sole; ctx.fill();
  ctx.beginPath(); ctx.rect(cx - rx - 4, cy - ry - 4, 2 * rx + 8, 2 * ry + 8); sp(-7 * D, -6);
  ctx.fillStyle = rgba(C.overlay, 0.26); ctx.fill('evenodd');
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.5;
  ctx.beginPath(); ctx.moveTo(cx - rx + 2, cy + ry * 0.5); ctx.lineTo(cx + rx - 2, cy + ry * 0.5);
  if (!P.back && !P.space) { ctx.moveTo(cx + t * 8 + Math.cos(Math.PI * 1.05) * rx * 0.64, cy + ry * 0.35 + Math.sin(Math.PI * 1.05) * ry * 0.62); ctx.ellipse(cx + t * 8, cy + ry * 0.35, rx * 0.64, ry * 0.62, 0, Math.PI * 1.05, Math.PI * 1.95); }
  ctx.stroke();
  if (!P.back && !P.space && P.fine) {
    ctx.beginPath();
    ctx.moveTo(cx + t * 6 - 6, cy - ry * 0.62); ctx.lineTo(cx + t * 6 + 6, cy - ry * 0.4);
    ctx.moveTo(cx + t * 6 + 6, cy - ry * 0.62); ctx.lineTo(cx + t * 6 - 6, cy - ry * 0.4);
    ctx.strokeStyle = C.shoeW; ctx.lineWidth = 3; ctx.stroke();
  }
  if (P.back && !P.space && P.fine) { rrectPath(ctx, cx - 5, cy - ry - 3, 10, 9, 3); ink(ctx, C.shoeW, LW * 0.5); }
  ctx.restore();
  ctx.beginPath(); sp(0, 0); ink(ctx, null, P.lwO);
}

// Sitting on an edge, seen from the front: shins dangle below a foreshortened lap.
function drawSitLegs(ctx, R, P, C, D) {
  const { L, R: Rl } = R.legs;
  for (const leg of [Rl, L]) {
    ctx.save();
    const side = leg === Rl ? 1 : -1;
    // dangling feet: shoes swing a little and toe outward
    const a = leg.ankle;
    ctx.translate(a[0], a[1]); ctx.rotate(side * 0.12 - leg.kick * 0.25 * side); ctx.translate(-a[0], -a[1]);
    drawLeg(ctx, { ...leg, hip: leg.knee }, P, C, D);
    ctx.restore();
  }
  const fill = P.space ? C.suit : C.over, sh = P.space ? C.suitShade : C.overShade;
  const k = R.legs.R.knee, kl = R.legs.L.knee;
  const shapes = [[k[0], k[1] - 8, 24], [kl[0], kl[1] - 8, 24], { rr: [kl[0], k[1] - 30, k[0] - kl[0], 42, 12] }];
  blobs1(ctx, shapes, fill, P.lwO);
  ctx.save();
  clipBlobs2(ctx, shapes);
  ctx.beginPath();
  for (const sh2 of [[k[0], k[1] - 8, 24], [kl[0], kl[1] - 8, 24]]) { ctx.moveTo(sh2[0] + 30, sh2[1]); ctx.ellipse(sh2[0] + 7 * D, sh2[1] + 12, 26, 14, 0, 0, TAU); }
  ctx.fillStyle = sh; ctx.fill();
  blotches(ctx, P, C, [[kl[0] + 6, kl[1] - 12, 11]], 211);
  ctx.restore();
  // crease between the thighs + knee highlights
  ctx.save(); ctx.lineCap = 'round';
  const mx = (k[0] + kl[0]) / 2;
  ctx.beginPath(); ctx.moveTo(mx, k[1] - 22); ctx.quadraticCurveTo(mx + 1, k[1] + 2, mx, k[1] + 12);
  ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.6; ctx.stroke();
  ctx.fillStyle = rgba(C.hi, 0.25);
  for (const q of [k, kl]) { ctx.beginPath(); ctx.ellipse(q[0] - 6 * D, q[1] - 16, 9, 5, -0.3 * D, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function clipBlobs2(ctx, shapes) {
  ctx.beginPath();
  for (const sh of shapes) {
    if (Array.isArray(sh)) { ctx.moveTo(sh[0] + sh[2], sh[1]); ctx.arc(sh[0], sh[1], sh[2], 0, TAU); }
    else { const [x, y, w, h] = sh.rr; ctx.rect(x, y, w, h); }
  }
  ctx.clip();
}
function drawLeg(ctx, L, P, C, D) {
  const pts = [L.hip, L.knee, L.ankle];
  if (P.space) limb(ctx, pts, LEG_W + 3, C.suit, C.suitShade, D, { lw: P.lwO });
  else {
    limb(ctx, pts, LEG_W, C.over, C.overShade, D, { lw: P.lwO });
    const dx = L.ankle[0] - L.knee[0], dy = L.ankle[1] - L.knee[1], l = Math.hypot(dx, dy) || 1;
    limb(ctx, [[L.ankle[0] - (dx / l) * 9, L.ankle[1] - (dy / l) * 9], [L.ankle[0] - (dx / l) * 4, L.ankle[1] - (dy / l) * 4]], LEG_W + 2, C.cuff, null, D, { lw: LW * 0.7 });
  }
  if (P.soot > 0.03) limbSoot(ctx, P, C, [lerp(L.knee[0], L.ankle[0], 0.15), lerp(L.knee[1], L.ankle[1], 0.15)], [lerp(L.knee[0], L.ankle[0], 0.6), lerp(L.knee[1], L.ankle[1], 0.6)], LEG_W);
  drawShoe(ctx, L.ankle, P, C, D);
}

function drawHand(ctx, A, P, C, fn, front) {
  if (A.hand === 'cup') return; // drawn together with the other hand by drawCup
  const skin = P.space ? C.suit : C.skin, lw = P.lwO * 0.9;
  ctx.save(); ctx.translate(A.H[0], A.H[1]); ctx.rotate(A.ang);
  const info = { dir: P.dir, side: A.side, angle: A.ang };
  if (fn && !front) { ctx.save(); fn(ctx, info); ctx.restore(); }
  const ts = A.side * Math.sin(A.ang) - 0.8 * Math.cos(A.ang) >= 0 ? 1 : -1;
  const thumb = (x, r) => [x, ts * 9, r];
  let shapes;
  switch (A.hand) {
    case 'fist': shapes = [[2, 0, 12.5], thumb(-1, 5.5)]; break;
    case 'point': shapes = [[0, 0, 12], { rr: [4, -4.8, 25, 9.6, 4.8] }, thumb(-2, 5.5)]; break;
    case 'spread':
      shapes = [[1, 0, 11.5]];
      for (const a of [-0.8, -0.27, 0.27, 0.8]) shapes.push([Math.cos(a) * 13, Math.sin(a) * 13, 5.3]);
      shapes.push([Math.cos(ts * 1.5) * 11.5, Math.sin(ts * 1.5) * 11.5, 5.4]);
      break;
    default: shapes = [[3, 0, 13], [1, ts * 9.5, 6]];
  }
  blobs1(ctx, shapes, skin, lw);
  if (A.hand === 'fist' && P.fine) {
    ctx.beginPath(); ctx.arc(8, -ts * 3.5, 4.5, -0.9, 0.9); ctx.arc(8, ts * 4.5, 4.5, -0.9, 0.9);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.stroke();
  }
  if (fn && front) { ctx.save(); fn(ctx, info); ctx.restore(); }
  ctx.restore();
}
// Cupped hands (preset 'cup'): inside of the bowl (back) → holdCup item → the two hands as a bowl
// (scalloped fingertip rim, thumbs on the outer corners) in front.
function cupHandPath(ctx, cp, sd, dx, dy) {
  const X = (u) => cp[0] + sd * u + dx, Y = (v) => cp[1] + v + dy;
  const tips = [3, 10.2, 17.4, 24.6, 31]; // fingertip boundaries (u) along the rim
  ctx.moveTo(X(tips[0]), Y(4));
  for (let k = 1; k < tips.length; k++) {
    const u0 = tips[k - 1], u1 = tips[k], v0 = 4 - 7 * ((k - 1) / 4), v1 = 4 - 7 * (k / 4);
    ctx.quadraticCurveTo(X((u0 + u1) / 2), Y((v0 + v1) / 2 - 6), X(u1), Y(v1));
  }
  ctx.quadraticCurveTo(X(36), Y(8), X(28), Y(19));
  ctx.quadraticCurveTo(X(20), Y(28), X(8), Y(25));
  ctx.quadraticCurveTo(X(1), Y(23), X(1.5), Y(14));
  ctx.closePath();
}
function drawCup(ctx, R, P, C, D, fn) {
  const hands = [R.armL, R.armR].filter((A) => A.hand === 'cup');
  if (!hands.length) return;
  const cp = cupPoint(R);
  const skin = P.space ? C.suit : C.skin, shade = P.space ? C.suitShade : C.skinShade;
  const lw = P.lwO * 0.9;
  // inside of the bowl (palms seen from above)
  const both = hands.length === 2;
  ctx.beginPath();
  if (both) ctx.ellipse(cp[0], cp[1] - 3, 30, 8, 0, 0, TAU);
  else { const sd = hands[0].side; ctx.ellipse(cp[0] + sd * 16, cp[1] - 3, 16, 7, 0, 0, TAU); }
  ink(ctx, shade, LW * 0.7);
  if (fn) { ctx.save(); ctx.translate(cp[0], cp[1]); if (D < 0) ctx.scale(-1, 1); fn(ctx, { dir: D, cup: true }); ctx.restore(); }
  for (const A of hands) {
    const sd = A.side;
    solid(ctx, (dx, dy) => cupHandPath(ctx, cp, sd, dx, dy), skin, shade, -6 * D, -7, lw);
    // knuckle creases between the curled fingertips
    if (P.fine) {
      ctx.save();
      ctx.beginPath();
      for (let k = 1; k < 4; k++) { const u = 3 + 7.1 * k, v = 4 - 7 * (k / 4); ctx.moveTo(cp[0] + sd * u, cp[1] + v + 1); ctx.lineTo(cp[0] + sd * (u - 0.5), cp[1] + v + 5.5); }
      ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();
    }
    // thumb resting on the outer rim
    ctx.beginPath(); ctx.ellipse(cp[0] + sd * 31, cp[1] - 6, 6, 10, -sd * 0.45, 0, TAU); ink(ctx, skin, lw);
  }
}
function drawArm(ctx, A, P, C, D, fn, front) {
  const pts = [A.S, A.E, A.W];
  if (P.space) {
    limb(ctx, pts, ARM_W + 3, C.suit, C.suitShade, D, { lw: P.lwO });
    const cup = A.hand === 'cup';
    limb(ctx, [add(A.W, A.d2, cup ? -12 : -9), add(A.W, A.d2, cup ? -5 : -1)], ARM_W + (cup ? 4 : 8), C.trim, C.trimShade, D, { lw: LW * 0.8 });
  } else {
    limb(ctx, pts, ARM_W, C.shirt, rgba(C.overlay, 0.26), D, { stripes: C.shirtW, dash: 6.5, lw: P.lwO });
  }
  if (P.soot > 0.03) limbSoot(ctx, P, C, [lerp(A.S[0], A.E[0], 0.3), lerp(A.S[1], A.E[1], 0.3)], [lerp(A.E[0], A.W[0], 0.2), lerp(A.E[1], A.W[1], 0.2)], ARM_W);
  drawHand(ctx, A, P, C, fn, front);
}
function drawNeck(ctx, R, P, C) {
  rrectPath(ctx, -13, R.top - 26, 26, 34, 10); ink(ctx, C.skinShade, P.lwO);
}

// Close-up bust under drawGirlHead: shoulders ≥ 1.4× the helmet ring (suit) / the face (overalls),
// rounded deltoid caps, sleeve tops, mission patch or bib + straps. Head-local coords.
function bustPath(ctx, W, y0, dx, dy) {
  const x = dx, y = y0 + dy;
  ctx.moveTo(x - 20, y);
  ctx.lineTo(x + 20, y);
  ctx.bezierCurveTo(x + 44, y + 1, x + W - 52, y + 5, x + W - 24, y + 11);
  ctx.quadraticCurveTo(x + W, y + 17, x + W, y + 44);
  ctx.lineTo(x + W + 3, y + 400);
  ctx.lineTo(x - W - 3, y + 400);
  ctx.lineTo(x - W, y + 44);
  ctx.quadraticCurveTo(x - W, y + 17, x - W + 24, y + 11);
  ctx.bezierCurveTo(x - W + 52, y + 5, x - 44, y + 1, x - 20, y);
  ctx.closePath();
}
function drawBust(ctx, P, C, D, depth) {
  const y0 = 90, bx = P.back ? 0 : P.turn * 6;
  const W = P.space ? 88 : 112;
  ctx.save();
  ctx.beginPath(); ctx.rect(-400, -400, 800, 400 + depth); ctx.clip();
  rrectPath(ctx, -13, 56, 26, 46, 10); ink(ctx, C.skinShade, P.lwO);
  if (P.space && !P.back) { // backpack peeking over the shoulders
    solid(ctx, (dx, dy) => { ctx.moveTo(-60 + dx + 22, y0 - 12 + dy); pk2(ctx, -60 + dx, y0 - 12 + dy, 120, 90, 22); }, C.pack, C.packShade, -8 * D, -8, P.lwO);
  }
  const bp = (dx, dy) => bustPath(ctx, W, y0, dx, dy);
  const seams = () => {
    ctx.beginPath();
    for (const sd of [-1, 1]) { ctx.moveTo(sd * (W - 30), y0 + 28); ctx.quadraticCurveTo(sd * (W - 38), y0 + 70, sd * (W - 36), y0 + 400); }
    ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.7; ctx.lineCap = 'round'; ctx.stroke();
  };
  if (P.space) {
    solid(ctx, bp, C.suit, C.suitShade, -12 * D, -8, 0);
    seams();
    if (P.back) {
      solid(ctx, (dx, dy) => { ctx.moveTo(-46 + dx + 20, y0 + 16 + dy); pk2(ctx, -46 + dx, y0 + 16 + dy, 92, 200, 20); }, C.pack, C.packShade, -8 * D, -8, P.lwO);
    } else {
      const px = bx + 36, py = y0 + 52;
      circlePath(ctx, px, py, 17); ink(ctx, C.patch, LW * 0.7);
      softStarPath(ctx, px, py + 1, 11, 5.8); ctx.fillStyle = C.shirtW; ctx.fill();
      rrectPath(ctx, bx - 60, y0 + 40, 26, 20, 5); ink(ctx, C.pack, LW * 0.6);
      [[C.ledR, -53], [C.ledY, -47], [C.ledG, -41]].forEach(([c, dx]) => { circlePath(ctx, bx + dx, y0 + 50, 3); ctx.fillStyle = c; ctx.fill(); });
      ctx.save(); ctx.beginPath(); bp(0, 0); ctx.clip();
      blotches(ctx, P, C, [[bx - 20, y0 + 70, 14], [bx + 60, y0 + 30, 10]], 221);
      ctx.restore();
    }
    ctx.beginPath(); bp(0, 0); ink(ctx, null, P.lwO);
    if (P.helmet < 1) { // the suit's collar ring (the helmet's torus covers it)
      const ring = (dx, dy) => { ctx.moveTo(dx + 40, y0 + 4 + dy); ctx.ellipse(dx, y0 + 4 + dy, 40, 12, 0, 0, TAU); };
      solid(ctx, ring, C.trim, C.trimShade, -5 * D, -5, LW);
    }
  } else {
    const H = 216; // hip line, head-local (bib top at H - 98)
    const straps = P.back
      ? [[[-50, y0 + 6], [-36, y0 + 6], [30, y0 + 200], [16, y0 + 200]], [[36, y0 + 6], [50, y0 + 6], [-16, y0 + 200], [-30, y0 + 200]]]
      : [[[bx - 26, H - 95], [bx - 13, H - 95], [-38, y0 + 4], [-54, y0 + 7]], [[bx + 13, H - 95], [bx + 26, H - 95], [54, y0 + 7], [38, y0 + 4]]];
    const bib = () => { ctx.moveTo(bx - 27, 400); ctx.lineTo(bx - 27, H - 90); ctx.quadraticCurveTo(bx - 27, H - 98, bx - 19, H - 98); ctx.lineTo(bx + 19, H - 98); ctx.quadraticCurveTo(bx + 27, H - 98, bx + 27, H - 90); ctx.lineTo(bx + 27, 400); ctx.closePath(); };
    const fillOver = (col) => { ctx.beginPath(); if (!P.back) bib(); straps.forEach((q) => polyCW(ctx, q)); ctx.fillStyle = col; ctx.fill(); };
    ctx.save();
    ctx.beginPath(); bp(0, 0); ctx.fillStyle = C.shirt; ctx.fill(); ctx.clip();
    ctx.beginPath();
    for (let y = y0 + 8; y < 300; y += 14) ctx.rect(-200, y, 400, 7);
    ctx.fillStyle = C.shirtW; ctx.fill();
    fillOver(C.over);
    ctx.save();
    ctx.beginPath(); bp(0, 0); bp(-14 * D, -8); ctx.clip('evenodd');
    ctx.fillStyle = rgba(C.overlay, 0.26); ctx.fillRect(-200, y0 - 20, 400, 400);
    fillOver(C.overShade);
    ctx.restore();
    blotches(ctx, P, C, [[bx - 8, H - 60, 14], [-70, y0 + 40, 12], [bx + 60, y0 + 24, 10]], 231);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); straps.forEach((q) => quad(ctx, q)); ctx.strokeStyle = INK; ctx.lineWidth = LW * 0.6; ctx.stroke();
    if (!P.back) {
      ctx.beginPath(); bib(); ink(ctx, null, LW * 0.7);
      softStarPath(ctx, bx + 1, H - 69, 14, 7.5); ink(ctx, C.star, LW * 0.6);
      circlePath(ctx, bx - 3 * D, H - 73, 2.6); ctx.fillStyle = rgba(C.hi, 0.75); ctx.fill();
      buttons(ctx, [[bx - 19.5, H - 90, 5.5], [bx + 19.5, H - 90, 5.5]], C);
    }
    ctx.restore();
    seams();
    ctx.beginPath(); bp(0, 0); ink(ctx, null, P.lwO);
  }
  ctx.restore();
}

// silhouette rim along the screen-left side of the torso
function torsoRim(ctx, P, R, D) {
  const w = 2 / P.eff, x = -D * (43 + (P.space ? 4 : 0) - P.lwO / 2 - w / 2 - 1);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x, R.top + 26); ctx.lineTo(x - D * 1, R.hipY - 12);
  ctx.strokeStyle = rgba('#fff0c8', 0.5 * P.sil); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- exports
function gogglePalette(P, C, light) {
  if (!(P.soot > 0) || !P.goggles || P.goggles === 'none') return C;
  return makePalette(0.45 * sootMix(P.soot), P.soot * 0.45, light, P.sil);
}

export function drawGirl(ctx, x, y, s = 1, pose = {}) {
  const P = norm(pose), R = rig(P), D = P.dir;
  setupDraw(ctx, P, s);
  const C = paletteFor(P, pose.light), Cg = gogglePalette(P, C, pose.light);
  const lift = pose.lift || 0;
  const wantShadow = pose.shadow ?? (R.shadow || (lift > 0 && P.stance !== 'float'));
  ctx.save();
  ctx.translate(x, y);
  if (wantShadow) {
    const k = 1 / (1 + Math.max(0, lift) / 260);
    ctx.save(); ctx.fillStyle = rgba(INK, 0.2 * k);
    ellipsePath(ctx, 0, 0, 78 * s * k, 13 * s * k); ctx.fill(); ctx.restore();
  }
  if (lift) ctx.translate(0, -lift * s);
  if (P.tilt) ctx.rotate(P.tilt);
  const sy = P.squash, sx = Math.pow(sy, -0.6);
  ctx.scale(s * D * sx, s * sy);
  const hip = [0, R.hipY];
  if (P.space && !P.back) drawBackpackFront(ctx, P, C, R, D);
  const sitBack = P.stance === 'sit' && P.back;
  if (P.stance !== 'sit') { drawLeg(ctx, R.legs.R, P, C, D); drawLeg(ctx, R.legs.L, P, C, D); }
  ctx.save();
  if (R.lean) { ctx.translate(hip[0], hip[1]); ctx.rotate(R.lean); ctx.translate(-hip[0], -hip[1]); }
  if (R.farBehind) drawArm(ctx, R.armR, P, C, D, pose.holdR, pose.holdRFront);
  drawNeck(ctx, R, P, C);
  drawTorso(ctx, P, C, R, D);
  if (P.sil > 0) torsoRim(ctx, P, R, D);
  if (P.stance === 'sit' && !sitBack) drawSitLegs(ctx, R, P, C, D);
  ctx.save();
  ctx.translate(R.neck[0], R.neck[1]);
  if (R.headRot) ctx.rotate(R.headRot);
  ctx.translate(R.head[0] - R.neck[0], R.head[1] - R.neck[1]);
  drawHeadLocal(ctx, P, C, Cg, R.bunBob);
  ctx.restore();
  if (!R.farBehind) drawArm(ctx, R.armR, P, C, D, pose.holdR, pose.holdRFront);
  drawArm(ctx, R.armL, P, C, D, pose.holdL, pose.holdLFront);
  drawCup(ctx, R, P, C, D, pose.holdCup);
  ctx.restore();
  ctx.restore();
}

// Head only (plus a neck/shoulder bust unless pose.bust === false), (x,y) = head centre.
export function drawGirlHead(ctx, x, y, s = 1, pose = {}) {
  const P = norm(pose), D = P.dir;
  setupDraw(ctx, P, s);
  const C = paletteFor(P, pose.light), Cg = gogglePalette(P, C, pose.light);
  ctx.save();
  ctx.translate(x, y);
  if (P.headTilt) ctx.rotate(P.headTilt);
  ctx.scale(s * D, s);
  if (pose.bust !== false) {
    ctx.save();
    ctx.rotate(-P.headTilt * D * 0.6);
    drawBust(ctx, P, C, D, pose.bustDepth ?? 170);
    ctx.restore();
  }
  drawHeadLocal(ctx, P, C, Cg, P.bob);
  ctx.restore();
}

// Approximate world positions for effects. Keys: head, handL, handR, hip, cup (+ neck, mouth, top,
// eyeL, eyeR, footL, footR, shoulderL, shoulderR, helmet {x,y,r}).
export function girlAnchors(x, y, s = 1, pose = {}) {
  const P = norm(pose), R = rig(P), D = P.dir;
  const sy = P.squash, sx = Math.pow(sy, -0.6);
  const ct = Math.cos(P.tilt), st = Math.sin(P.tilt);
  const hip = [0, R.hipY];
  const y0 = y - (pose.lift || 0) * s;
  const W = ([px, py]) => { const lx = px * s * D * sx, ly = py * s * sy; return [x + lx * ct - ly * st, y0 + lx * st + ly * ct]; };
  const up = (p) => rotAbout(p, hip, R.lean);
  const hd = (p) => up(rotAbout([R.head[0] + p[0], R.head[1] + p[1]], R.neck, R.headRot));
  const fx = P.back ? 0 : P.turn * 13;
  const head = W(hd([0, 0]));
  const hk = helmetK(P.helmet || 1);
  const hc = W(hd([0, 92 + (HELM_CY - 92) * hk]));
  return {
    head,
    handL: W(up(R.armL.H)), handR: W(up(R.armR.H)),
    hip: W(hip),
    cup: W(up(cupPoint(R))),
    neck: W(up(R.neck)),
    mouth: W(hd([fx * 1.15, 47])),
    top: W(hd([0, -94 - 28 * P.frizz])),
    eyeL: W(hd([-28 + fx, 10])), eyeR: W(hd([28 + fx, 10])),
    footL: W(R.legs.L.ankle), footR: W(R.legs.R.ankle),
    shoulderL: W(up(R.armL.S)), shoulderR: W(up(R.armR.S)),
    helmet: { x: hc[0], y: hc[1], r: HELM_R * hk * s },
  };
}
