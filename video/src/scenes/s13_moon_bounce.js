// s13_moon_bounce — bars 29–31 (69.74 → 76.94) · cut in, flash out to s14.
// One continuous shot on a small lavender moon, the camera gliding with the action:
//   bar 29  CUT ON THE TOUCHDOWN (69.74): legs squash, dust ring, a floaty low-g re-bounce that
//           settles on 70.34 and jolts the hatch open; Juno pops into the doorway, Biscuit pops up
//           beside her (70.64), a crouch… and they LEAP on 70.94.
//   bar 30  low-gravity bounces landing every 2 beats (72.14, 73.34) with dust puffs; Juno whips out
//           the paw-print flag mid-air on the snare (72.74), lands, winds up and PLANTS it on 73.94;
//           Biscuit turns his second bounce into a slow backflip…
//   bar 31  …and lands it on 74.54 — FREEZE, ears up, "!" (punch-in). A comet streaks overhead
//           (74.54 → 76.30); Juno points (75.14), Biscuit quivers; both whip round after it (75.74,
//           ARF!), wind up, and ZIP back into the rocket on 76.34; hatch slams 76.64, rocket rumbles.
import { W, H, INK, PAL, glow, sparkle, smokePuff, cartoonText, circlePath, ellipsePath, ink } from '../draw.js';
import { TAU, clamp, lerp, ease, keyframes, wobble, hash01, noise1, rgba } from '../util.js';
import { barTime, beatAt } from '../timing.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { drawRocket, ROCKET_HATCH } from '../props/rockets.js';
import { spaceBg, drawEarth, drawMoonSurface, moonSurfaceY, moonSurfaceAngle, drawComet } from '../props/space.js';
import { flag as flagItem } from '../props/items.js';

// ---------------------------------------------------------------- beat grid (absolute seconds)
const START = barTime(29); // 69.74
const END = barTime(32); // 76.94
const T_LAND = barTime(29, 0); // 69.74 touchdown (first frame of the scene)
const T_SETTLE = barTime(29, 1); // 70.34 low-g re-bounce settles, hatch jolts open
const T_PEEK = barTime(29, 1.5); // 70.64 Biscuit pops up in the doorway
const T_LEAP = barTime(29, 2); // 70.94 they leap out
const T_B1 = barTime(30, 0); // 72.14 bounce landing 1
const T_FLAG = barTime(30, 1); // 72.74 flag whipped out mid-air (snare)
const T_B2 = barTime(30, 2); // 73.34 bounce landing 2
const T_PLANT = barTime(30, 3); // 73.94 flag planted (snare)
const T_B3 = barTime(31, 0); // 74.54 Biscuit lands his flip → freeze + "!" (bass out)
const T_POINT = barTime(31, 1); // 75.14 Juno points at the comet, Biscuit quivers
const T_TURN = barTime(31, 2); // 75.74 both whip round after it, ARF!
const T_WIND = barTime(31, 2.5); // 76.04 wind-up (legs blur, lean back)
const T_ZIP = barTime(31, 3); // 76.34 ZIP to the rocket
const T_SLAM = barTime(31, 3.5); // 76.64 hatch slams
const T_COMET_IN = barTime(31, 0); // 74.54
const LEAD = 1 / 60;
const DW = 0.07; // ground dwell (squash frames) at each bounce contact
const ZIP_DUR = 0.17;

// ---------------------------------------------------------------- layout (world = moon-surface frame)
const CURVE = 0.42;
const gy = (x) => moonSurfaceY(x, { curve: CURVE });
const ga = (x) => moonSurfaceAngle(x, { curve: CURVE });
const S = 0.42; // characters (scale contract)
const SR = 0.84; // rocket
const SL = S / SR; // character scale inside the rocket's local frame (doorway)
const LEG_LIFT = 64;
const RX = 1470, RGY = gy(RX), RANG = ga(RX);
const HX = ROCKET_HATCH.x, SILL = ROCKET_HATCH.sillY;
// ground points (x) of each landing
const J1 = 1070, J2 = 805;
const D1 = 1215, D2 = 1035, D3 = 985;
const DUST = '#e6ddfc', DUST_SH = '#bcaee8';

// ---------------------------------------------------------------- helpers
const imp = (t, t0, f = 2.2, d = 11) => (t < t0 ? 0 : Math.exp(-(t - t0) * d) * Math.cos((t - t0) * TAU * f));

function rocketState(t) {
  let hop = 0;
  const a = T_LAND + 0.05, b = T_SETTLE;
  if (t > a && t < b) { const u = (t - a) / (b - a); hop = 34 * 4 * u * (1 - u); }
  const sq = 0.2 * imp(t, T_LAND) + 0.06 * imp(t, T_SETTLE) + 0.04 * imp(t, T_ZIP + ZIP_DUR, 3, 14) + 0.05 * imp(t, T_SLAM);
  return { hop, sy: 1 - sq, sx: 1 + 0.6 * sq };
}
// rocket-local (s = 1 units, fin-tip origin, before the leg lift) → world
function rocketToWorld(t, lx, ly) {
  const st = rocketState(t);
  let x = lx * SR * st.sx, y = ((ly - LEG_LIFT) * SR - st.hop) * st.sy;
  const c = Math.cos(RANG), s = Math.sin(RANG);
  return [RX + x * c - y * s, RGY + x * s + y * c];
}
const DJ = rocketToWorld(T_LEAP, HX - 14, SILL); // Juno's launch point (doorway sill)
const DB = rocketToWorld(T_LEAP, HX + 22, SILL); // Biscuit's
const DOOR = rocketToWorld(T_LEAP, HX, SILL - 90); // doorway centre (zip target)

// parabolic low-g arc from (x0,y0) at t0 to (x1,y1) at t1, apex h above the chord
// xe > 1 front-loads the horizontal travel (an explosive push-off that clears the hull quickly)
function arcAt(t, t0, t1, x0, y0, x1, y1, h, xe = 1) {
  const u = clamp((t - t0) / (t1 - t0));
  return {
    x: lerp(x0, x1, 1 - Math.pow(1 - u, xe)), y: lerp(y0, y1, u) - 4 * h * u * (1 - u), u,
    vy: (y1 - y0 - 4 * h * (1 - 2 * u)) / (4 * h + Math.abs(y1 - y0)), // normalised vertical speed
  };
}
const stretchOf = (A) => 1 + 0.13 * Math.pow(Math.abs(A.vy), 1.5);

// ---------------------------------------------------------------- camera
const E = ease;
// [time, x, y, zoom, ease-into-this-key]
const CAM = [
  [T_LAND, 1395, 545, 1.2],
  [T_SETTLE, 1400, 550, 1.24, E.inOutSine],
  [T_SETTLE + 0.3, 1440, 575, 1.45, E.inOutCubic],
  [T_LEAP - 0.05, 1440, 580, 1.48, E.linear],
  [T_B1 - 0.25, 1165, 630, 1.42, E.inOutSine],
  [T_B1 + 0.35, 1050, 628, 1.55, E.inOutSine],
  [T_B2 - 0.2, 975, 640, 1.58, E.inOutSine],
  [T_PLANT, 910, 658, 1.64, E.inOutSine],
  [T_B3, 915, 664, 1.64, E.inOutSine],
  [T_B3 + 0.12, 935, 722, 1.98, (u) => E.outBack(u, 2.2)],
  [T_B3 + 0.34, 935, 720, 2.0, E.linear],
  [T_POINT + 0.1, 950, 640, 1.52, E.inOutCubic],
  [T_TURN, 960, 648, 1.56, E.inOutSine],
  [T_ZIP, 970, 655, 1.6, E.inOutSine],
  [T_ZIP + 0.26, 1250, 560, 1.1, E.outCubic],
  [END, 1265, 555, 1.13, E.inOutSine], // = s14's opening camera (A_CAM0)
];
const CAM_X = CAM.map(([t, x, , , e]) => [t, x, e]);
const CAM_Y = CAM.map(([t, , y, , e]) => [t, y, e]);
const CAM_Z = CAM.map(([t, , , z, e]) => [t, z, e]);
const camBase = (t) => ({ x: keyframes(t, CAM_X), y: keyframes(t, CAM_Y), zoom: keyframes(t, CAM_Z) });
// world ↔ screen under the shake-free camera
const toScreen = (c, x, y) => [W / 2 + (x - c.x) * c.zoom, H / 2 + (y - c.y) * c.zoom];
const toWorld = (c, sx, sy) => [c.x + (sx - W / 2) / c.zoom, c.y + (sy - H / 2) / c.zoom];
// sky layer (see withSky): screen ↔ sky coordinates
const skyZ = (c) => Math.pow(c.zoom, 0.33);
const skyToScreen = (c, px, py) => { const z = skyZ(c); return [W / 2 + z * (px - (W / 2 + (c.x - W / 2) * 0.25)), H / 2 + z * (py - (H / 2 + (c.y - H / 2) * 0.25))]; };
const screenToSky = (c, sx, sy) => { const z = skyZ(c); return [(sx - W / 2) / z + W / 2 + (c.x - W / 2) * 0.25, (sy - H / 2) / z + H / 2 + (c.y - H / 2) * 0.25]; };
function camAt(t) {
  let dx = 0, dy = 0, rot = 0;
  const sh = (t0, amp, dec = 5, f = 23) => {
    if (t < t0) return;
    const k = amp * Math.exp(-dec * (t - t0));
    dx += k * noise1((t - t0) * f, 11); dy += k * noise1((t - t0) * f, 29); rot += (k / 2400) * noise1((t - t0) * f, 47);
  };
  sh(T_LAND, 26, 6); sh(T_SETTLE, 8, 8); sh(T_PLANT, 9, 9); sh(T_B3, 7, 9); sh(T_SLAM, 12, 7);
  if (t > T_SLAM) { const k = 3.5 * clamp((t - T_SLAM) / 0.2); dx += k * noise1(t * 31, 3); dy += k * noise1(t * 29, 4); }
  return { x: keyframes(t, CAM_X), y: keyframes(t, CAM_Y), zoom: keyframes(t, CAM_Z), dx, dy, rot };
}
function withCam(ctx, c, fn) {
  ctx.save();
  ctx.translate(W / 2 + c.dx, H / 2 + c.dy);
  if (c.rot) ctx.rotate(c.rot);
  ctx.scale(c.zoom, c.zoom);
  ctx.translate(-c.x, -c.y);
  fn();
  ctx.restore();
}
// far sky layer (Earth, comet): moves a quarter as much, zooms a third as much
function withSky(ctx, c, fn) {
  const z = Math.pow(c.zoom, 0.33);
  ctx.save();
  ctx.translate(W / 2 + c.dx * 0.4, H / 2 + c.dy * 0.4);
  ctx.scale(z, z);
  ctx.translate(-(W / 2 + (c.x - W / 2) * 0.25), -(H / 2 + (c.y - H / 2) * 0.25));
  fn();
  ctx.restore();
}

// ---------------------------------------------------------------- comet (sky coords)
// It streaks in from the left (Biscuit senses it first), passes right over the pair, then recedes up-right and
// hangs there, still visible above the rocket when they whip round and zip, ending exactly where s14's comet
// fades in (s14 aComet(76.94) = world (1990, 250) under A_CAM0, heading -0.42). Keys are SCREEN targets under
// the shake-free camera, converted once to sky coordinates (constant data, so frames stay pure functions of t).
const COMET_KEYS = [ // [t, screenX, screenY, head size, tail len]  (size/len in sky px)
  [T_COMET_IN, -420, 650, 18, 320],
  [T_B3 + 0.36, -30, 505, 30, 680],
  [T_POINT, 330, 375, 42, 920],
  [T_POINT + 0.3, 760, 225, 52, 1060],
  [T_TURN, 1230, 170, 46, 980],
  [T_ZIP, 1515, 150, 38, 840],
  [END, 1779, 195, 34, 760],
];
const CK = COMET_KEYS.map(([t, sx, sy, size, len]) => [t, ...screenToSky(camBase(t), sx, sy), size, len]);
{ // phantom key after END so the exit tangent matches s14's heading (-0.42)
  const [t1, x1, y1] = CK[CK.length - 1];
  CK.push([t1 + 0.6, x1 + 0.6 * 420 * Math.cos(-0.42), y1 + 0.6 * 420 * Math.sin(-0.42), 30, 700]);
}
// cubic Hermite through time-keyed samples (Catmull-Rom tangents) → value and d/dt for column j
function hermite(keys, t, j) {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2[0] - k1[0];
  const m1 = (k2[j] - k0[j]) / (k2[0] - k0[0]) * h, m2 = (k3[j] - k1[j]) / (k3[0] - k1[0]) * h;
  const u = clamp((t - k1[0]) / h), u2 = u * u, u3 = u2 * u;
  const v = (2 * u3 - 3 * u2 + 1) * k1[j] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * k2[j] + (u3 - u2) * m2;
  const dv = ((6 * u2 - 6 * u) * k1[j] + (3 * u2 - 4 * u + 1) * m1 + (-6 * u2 + 6 * u) * k2[j] + (3 * u2 - 2 * u) * m2) / h;
  return [v, dv];
}
function cometAt(t) {
  const tt = clamp(t, T_COMET_IN, END);
  const [x, vx] = hermite(CK, tt, 1), [y, vy] = hermite(CK, tt, 2);
  return { x, y, ang: Math.atan2(vy, vx), size: hermite(CK, tt, 3)[0], len: hermite(CK, tt, 4)[0], on: t > T_COMET_IN };
}
// the comet's position in WORLD coordinates (for aiming Juno's point / the characters' gaze)
function cometWorld(t) {
  const c = camBase(t), C = cometAt(t);
  const [sx, sy] = skyToScreen(c, C.x, C.y);
  return toWorld(c, sx, sy);
}
// ---------------------------------------------------------------- dust
// A landing burst on the ground at x: a flat dust skirt + two puffs per side sliding outward + a few
// specks of grit drifting in slow low-g arcs. Visible from the impact frame on (u starts > 0).
function dustBurst(ctx, t, t0, x, k, seed, { ring = false, dirs = [-1, 1], puffs = 1 } = {}) {
  const dt = t - t0;
  if (dt < 0 || dt > 1.3) return;
  const y0 = gy(x);
  // flat skirt of dust hugging the ground
  if (dt < 0.9) {
    const u = dt / 0.9;
    ctx.save();
    ctx.translate(x, y0); ctx.rotate(ga(x));
    ctx.fillStyle = rgba('#efe9ff', 0.55 * (1 - u) * (1 - u));
    ellipsePath(ctx, 0, -6, (50 + 170 * E.outCubic(u)) * k, (12 + 20 * E.outCubic(u)) * k); ctx.fill();
    if (ring && dt < 0.45) {
      const r = dt / 0.45;
      ctx.globalAlpha *= 1 - r;
      ctx.strokeStyle = '#f7f3ff'; ctx.lineWidth = 7 * (1 - r) + 1.5;
      ellipsePath(ctx, 0, 0, 70 + 420 * k * E.outCubic(r), 10 + 44 * k * E.outCubic(r)); ctx.stroke();
    }
    ctx.restore();
  }
  // grit specks
  const G = 300;
  const n = Math.round(4 + 5 * k);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? -1 : 1;
    const vx = dir * (60 + 200 * hash01(i, seed + 1)) * (0.6 + 0.5 * k);
    const vy = -(120 + 240 * hash01(i, seed + 2)) * (0.6 + 0.5 * k);
    const px = x + dir * 16 + vx * dt, py = y0 - 6 + vy * dt + 0.5 * G * dt * dt;
    if (dt > 0.2 && py > gy(px) - 1) continue;
    ctx.globalAlpha = clamp(1.3 - dt / 1.0);
    ctx.fillStyle = hash01(i, seed + 4) < 0.5 ? '#f6f2ff' : '#cbbdf3';
    circlePath(ctx, px, py, (1.6 + 2.2 * hash01(i, seed + 3)) * (0.8 + 0.4 * k)); ctx.fill();
  }
  ctx.restore();
  // puffs
  for (const d of dirs) {
    for (let i = 0; i < puffs; i++) {
      const life = (0.48 + 0.16 * hash01(i, seed + 20 + d)) * (0.75 + 0.35 * k);
      const u = 0.22 + 0.78 * dt / life;
      if (u >= 1) continue;
      const reach = (40 + 70 * i) * (0.6 + 0.7 * k);
      const px = x + d * (20 + reach * E.outCubic(clamp(dt / 0.45)));
      const py = gy(px) - 8 - 18 * k * dt;
      ctx.save();
      ctx.globalAlpha *= 0.88;
      ctx.translate(px, py); ctx.scale(1.25, 0.8);
      smokePuff(ctx, 0, 0, (i ? 17 : 27) * (0.6 + 0.6 * k), {
        seed: seed + i * 7 + (d > 0 ? 3 : 0), u, fill: DUST, shadeCol: DUST_SH, lw: 3.4, n: i ? 3 : 5,
      });
      ctx.restore();
    }
  }
}
function shadowAt(ctx, x, h, w) {
  const k = 1 / (1 + Math.max(0, h) / 170);
  ctx.save();
  ctx.translate(x, gy(x)); ctx.rotate(ga(x));
  ctx.fillStyle = rgba('#3a2a72', 0.3 * k);
  ellipsePath(ctx, 0, 3, w * k, w * 0.17 * k); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- Juno
const JB = { suit: 'space', helmet: 1, shadow: false };
function junoState(t) {
  if (t < T_SETTLE) return { mode: 'crew' };
  if (t < T_LEAP) {
    // in the doorway: pushes out → looks around (awe) → crouch wind-up
    const crouch = t > T_LEAP - 0.2;
    const k = clamp((t - (T_LEAP - 0.2)) / 0.12);
    return {
      mode: 'door',
      pose: {
        ...JB, t, facing: -1, stance: crouch ? 'crouch' : 'stand',
        expr: t < T_PEEK ? 'awe' : 'excited', mouth: t < T_PEEK ? 0.6 : undefined, blink: 0, // (auto-blink falls on 70.34)
        armR: t < T_SETTLE + 0.16 ? { a: 1.4, b: 0.2, hand: 'spread' } : crouch ? { a: -0.5, b: 0.4 } : 'cheer',
        armL: crouch ? { a: -0.7, b: 0.4 } : t < T_SETTLE + 0.16 ? 'down' : 'cheer',
        squash: crouch ? 1 - 0.12 * k : 1 + 0.05 * Math.exp(-(t - T_SETTLE) * 8),
        look: t < T_PEEK ? [-0.6, -0.3] : [-0.4, 0.1],
      },
    };
  }
  if (t >= T_ZIP) return { mode: 'zip', from: [J2, gy(J2)], to: DOOR };
  const facing = -1;
  const P = { ...JB, t, facing, hairFloat: 0.35 };
  const flagOn = t >= T_FLAG;
  // --- airborne arcs ---
  let A = null, x0, x1;
  if (t < T_B1) { A = arcAt(t, T_LEAP, T_B1, DJ[0], DJ[1], J1, gy(J1), 235, 1.45); x0 = DJ[0]; x1 = J1; }
  else if (t >= T_B1 + DW && t < T_B2) { A = arcAt(t, T_B1 + DW, T_B2, J1, gy(J1), J2, gy(J2), 265); x0 = J1; x1 = J2; }
  if (A) {
    const ends = A.u < 0.1 || A.u > 0.86;
    const tiltBase = lerp(ga(x0), ga(x1), A.u);
    const lean = -0.14 * (1 - 2 * A.u); // lean into the rise, rock back to land
    return {
      mode: 'body', x: A.x, y: A.y, h: gy(A.x) - A.y, flag: flagOn ? 'hand' : null,
      pose: {
        ...P, stance: ends ? 'stand' : 'jump', expr: t < T_B1 ? 'laugh' : 'excited',
        tilt: tiltBase + lean, squash: stretchOf(A),
        armR: flagOn ? { a: 2.12, b: 0.08, hand: 'fist' } : ends ? { a: 2.2, b: 0.3 } : undefined,
        armL: ends ? { a: 2.0, b: 0.3 } : undefined,
      },
    };
  }
  // --- contact dwell at landing 1 ---
  if (t < T_B2) {
    const k = clamp((t - T_B1) / DW);
    return {
      mode: 'body', x: J1, y: gy(J1), h: 0, flag: null,
      pose: { ...P, stance: 'crouch', expr: 'laugh', tilt: ga(J1), squash: 0.86 + 0.08 * k, armR: { a: 1.6, b: 0.4 }, armL: { a: 1.5, b: 0.4 } },
    };
  }
  // --- on the ground at J2: land, wind up, PLANT, proud ---
  const base = { x: J2, y: gy(J2), h: 0 };
  const tg = ga(J2);
  if (t < T_B2 + DW) {
    return { ...base, mode: 'body', flag: 'hand', pose: { ...P, stance: 'crouch', expr: 'excited', tilt: tg, squash: 0.86, armR: { a: 2.12, b: 0.08, hand: 'fist' } } };
  }
  // a little low-g hop during the wind-up so she drives the flag DOWN on the snare
  const hopU = clamp((t - (T_B2 + DW + 0.08)) / (T_PLANT - (T_B2 + DW + 0.08)));
  const hopH = 46 * 4 * hopU * (1 - hopU);
  if (t < T_PLANT - 0.1) { // wind-up: spring up, flag high, lean back
    const k = E.inOutSine(clamp((t - T_B2 - DW) / (T_PLANT - 0.1 - T_B2 - DW)));
    return {
      ...base, y: base.y - hopH, h: hopH, mode: 'body', flag: 'hand',
      pose: { ...P, stance: 'stand', expr: 'determined', tilt: tg + 0.13 * k, squash: 1 + 0.05 * k, armR: { a: 2.12 + 0.2 * k, b: 0.08 - 0.1 * k, hand: 'fist' }, armL: { a: 0.9 + 0.5 * k, b: 0.5 } },
    };
  }
  if (t < T_PLANT) { // the swing down (3 frames)
    const k = E.inQuad(clamp((t - (T_PLANT - 0.1)) / 0.1));
    return {
      ...base, y: base.y - hopH, h: hopH, mode: 'body', flag: 'swing', swing: k,
      pose: { ...P, stance: k > 0.5 ? 'crouch' : 'stand', expr: 'determined', tilt: tg + lerp(0.13, -0.08, k), squash: lerp(1.05, 0.92, k), armR: { a: lerp(2.32, PLANT_ARM.a, k), b: lerp(-0.02, PLANT_ARM.b, k), hand: 'fist' }, armL: { a: 0.6, b: 0.6 } },
    };
  }
  if (t < T_PLANT + 0.3) { // planted! hold the pole, squash recovers
    const k = clamp((t - T_PLANT) / 0.3);
    return { ...base, mode: 'body', flag: 'planted', pose: { ...PLANT_POSE, t, squash: 0.9 + 0.1 * E.outBack(k), expr: k < 0.4 ? 'determined' : 'grin', blink: 0 } };
  }
  if (t < T_B3) { // stand tall, turn to camera, hands on hips
    const k = E.outBack(clamp((t - T_PLANT - 0.3) / 0.22));
    return { ...base, mode: 'body', flag: 'planted', pose: { ...P, stance: 'stand', expr: 'grin', facing: lerp(-1, -0.15, k), tilt: tg, armR: 'hips', armL: 'hips', squash: 1 + 0.04 * wobble(t, T_PLANT + 0.3, 3, 6) } };
  }
  // ---- bar 31: the comet ----
  if (t < T_B3 + 0.28) { // "what is it, boy?" — glance at Biscuit
    return { ...base, mode: 'body', flag: 'planted', pose: { ...P, stance: 'stand', expr: 'surprised', facing: 0.45, tilt: tg, look: [0.9, 0.1], armR: 'down', armL: 'down', headTilt: 0.08 } };
  }
  if (t < T_POINT) { // follows his gaze up-left… where's he looking?
    return { ...base, mode: 'body', flag: 'planted', pose: { ...P, stance: 'stand', expr: 'awe', mouth: 0.5, facing: -0.8, tilt: tg, look: [0.75, -0.85], armR: 'down', armL: { a: 0.35, b: 0.3 }, headTilt: 0.1 } };
  }
  if (t < T_TURN - 0.03) { // POINTS at the comet (snare) and tracks it overhead, leaning back further and further
    const pk = E.outBack(clamp((t - T_POINT + 0.02) / 0.1), 2.2);
    const aim = aimArm(t, -1, tg);
    return {
      ...base, mode: 'body', flag: 'planted',
      pose: { ...P, stance: 'stand', expr: 'awe', mouth: 0.8, blink: 0, facing: -1, tilt: tg + aim.lean, look: [0.35, -1], headTilt: 0.12 + 0.6 * aim.lean,
        armR: { a: lerp(0.9, aim.a, pk), b: aim.b * pk, hand: 'point' }, armL: { a: 0.45 + 1.2 * aim.lean, b: 0.6, hand: 'spread' } },
    };
  }
  if (t < T_WIND) { // whip round after it — "LET'S GO!" (the snap lands on the beat frame)
    const k = clamp((t - (T_TURN - 0.03)) / 0.08);
    const aim = aimArm(t, 1, tg);
    const f = k < 0.3 ? -0.35 : lerp(0.55, 1, E.outCubic(clamp((k - 0.3) / 0.7)));
    return {
      ...base, mode: 'body', flag: 'planted', whip: 1 - clamp((t - T_TURN) / 0.25),
      pose: { ...P, stance: 'stand', expr: 'excited', mouth: clamp(1.1 * Math.exp(-(t - T_TURN) * 2.2)), blink: 0, facing: f,
        tilt: tg + aim.lean * E.outCubic(k) + 0.05 * wobble(t, T_TURN, 3, 6), squash: 1 + 0.08 * Math.sin(Math.PI * k),
        armR: k < 0.3 ? { a: 2.2, b: 0.1, hand: 'spread' } : { a: aim.a, b: aim.b, hand: 'point' },
        armL: k < 0.3 ? { a: 2.2, b: 0.1, hand: 'spread' } : { a: 0.5, b: 0.9, hand: 'fist' }, look: [0.8, -0.6] },
    };
  }
  // wind-up: lean back, legs a blur
  const k = clamp((t - T_WIND) / 0.1);
  return {
    ...base, mode: 'body', flag: 'planted', blur: k,
    pose: { ...P, stance: 'run', phase: (t - T_WIND) * 7, expr: 'determined', facing: 1, tilt: tg - 0.26 * E.outBack(k), squash: 0.96 },
  };
}
// Point Juno's facing-side arm at the comet (girl rig: a = 0 hanging, π/2 forward, π up; forearm = a + b).
// Her shoulder sits on the fishbowl's rim, so a straight raised arm lies over the glass: steep points use a
// bent elbow (upper arm out, forearm up, hand stays clear of the bowl) and beyond FA_MAX she LEANS BACK.
const FA_MAX = 2.55;
function aimArm(t, facing, tg) {
  const [cx, cy] = cometWorld(t);
  const sx = J2 + facing * 14, sy = gy(J2) - 234 * S; // ≈ shoulder (rig shoulder at y -234)
  const th = Math.atan2(cy - sy, cx - sx); // screen angle to the comet
  const armA = (th2) => { // rig angle whose direction is screen angle th2 (continuous past "straight up")
    const a = facing < 0 ? Math.atan2(-Math.cos(th2), Math.sin(th2)) : Math.atan2(Math.cos(th2), Math.sin(th2));
    return a < -1 ? a + TAU : a;
  };
  const need = armA(th - tg);
  const lean = clamp((need - FA_MAX) * 0.85, 0, 0.42) * (facing < 0 ? 1 : -1); // + = clockwise on screen
  const fa = clamp(armA(th - tg - lean), 1.1, FA_MAX);
  const a = fa < 1.9 ? fa : lerp(1.9, 1.45, clamp((fa - 1.9) / 0.5));
  return { a, b: fa - a, fa, lean };
}
const PLANT_ARM = { a: 1.45, b: -0.15 };
const PLANT_POSE = { ...JB, facing: -1, stance: 'crouch', tilt: ga(J2) - 0.1, armR: { ...PLANT_ARM, hand: 'fist' }, armL: { a: 0.5, b: 0.8 }, expr: 'determined' };
// the flag planted where Juno's fist is when she drives it in
const HAND_PLANT = girlAnchors(J2, gy(J2), S, PLANT_POSE).handR;
const FX = HAND_PLANT[0] - 6;
const FS = S * 1.2; // the flag is cheated a touch bigger than Juno-scale so it reads
const FLAG_BURY = 20;
const flagGround = () => [FX, gy(FX) - (124 - FLAG_BURY) * FS]; // grip origin of the planted flag

function drawFlag(ctx, x, y, rot, sc, t, wave = 1) {
  if (sc <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(-FS * sc, FS * sc); // cloth flies to screen-left
  flagItem(ctx, { t, wave });
  ctx.restore();
}

// ---------------------------------------------------------------- Biscuit
const DBASE = { suit: 'space', helmet: 1 };
function biscuitState(t) {
  if (t < T_PEEK) return { mode: t < T_SETTLE ? 'crew' : 'hidden' };
  if (t < T_LEAP) {
    const pop = E.outBack(clamp((t - T_PEEK + 0.02) / 0.1), 2.4); // ~full height on the half-beat frame
    const crouch = clamp((t - (T_LEAP - 0.16)) / 0.1);
    return {
      mode: 'door', pop,
      pose: { ...DBASE, t, facing: -1, stance: 'stand', expr: 'excited', squash: (0.7 + 0.3 * pop) * (1 - 0.18 * crouch), wag: 1.2, look: [-0.5, -0.2] },
    };
  }
  if (t >= T_ZIP) return { mode: 'zip', from: [D3, gy(D3)], to: DOOR };
  const P = { ...DBASE, t, facing: -1, hairFloat: 0.5 };
  let A = null, x0, x1, flip = false;
  if (t < T_B1) { A = arcAt(t, T_LEAP, T_B1, DB[0], DB[1], D1, gy(D1), 205, 1.45); x0 = DB[0]; x1 = D1; }
  else if (t >= T_B1 + DW && t < T_B2) { A = arcAt(t, T_B1 + DW, T_B2, D1, gy(D1), D2, gy(D2), 215); x0 = D1; x1 = D2; }
  else if (t >= T_B2 + DW && t < T_B3) { A = arcAt(t, T_B2 + DW, T_B3, D2, gy(D2), D3, gy(D3), 300); x0 = D2; x1 = D3; flip = true; }
  if (A) {
    const tiltBase = lerp(ga(x0), ga(x1), A.u);
    const spin = flip ? TAU * E.inOutSine(clamp((A.u - 0.08) / 0.8)) : 0; // backflip (clockwise when facing left)
    const ends = A.u < 0.08 || A.u > 0.9;
    return {
      mode: 'body', x: A.x, y: A.y, h: gy(A.x) - A.y,
      pose: { ...P, stance: ends ? 'stand' : 'jump', expr: flip ? 'laugh' : 'happy', tilt: tiltBase + spin - 0.12 * (1 - 2 * A.u) * (flip ? 0 : 1), pivot: 'center', squash: stretchOf(A), wag: 1 },
    };
  }
  if (t < T_B2) { // contact dwell 1 / 2
    const tc = t < T_B1 + DW ? T_B1 : T_B2;
    const xc = t < T_B1 + DW ? D1 : D2;
    const k = clamp((t - tc) / DW);
    return { mode: 'body', x: xc, y: gy(xc), h: 0, pose: { ...P, stance: 'stand', expr: 'happy', tilt: ga(xc), squash: 0.85 + 0.08 * k } };
  }
  if (t < T_B2 + DW) {
    const k = clamp((t - T_B2) / DW);
    return { mode: 'body', x: D2, y: gy(D2), h: 0, pose: { ...P, stance: 'stand', expr: 'laugh', tilt: ga(D2), squash: 0.85 + 0.08 * k } };
  }
  // ---- landed the flip: FREEZE ----
  const base = { mode: 'body', x: D3, y: gy(D3), h: 0 };
  const tg = ga(D3);
  const Q = { ...P, hairFloat: 0, stance: 'stand' };
  if (t < T_B3 + 0.07) return { ...base, pose: { ...Q, expr: 'laugh', tilt: tg, squash: 0.84 } };
  if (t < T_POINT) { // rigid, ears up, staring up-left
    const k = clamp((t - T_B3 - 0.07) / 0.1);
    return {
      ...base, exclaim: true,
      pose: { ...Q, expr: 'alert', ears: 1, tilt: tg, squash: 1 + 0.1 * E.outBack(k) * Math.exp(-(t - T_B3) * 3) + 0.02, wag: 0, tail: -1.1, look: [0.85, -0.9], headTilt: -0.42 * E.outBack(k), blink: 0 },
    };
  }
  if (t < T_TURN) { // quivering with excitement, tracking the comet
    const k = clamp((t - T_POINT) / (T_TURN - T_POINT));
    const amp = 0.35 + 0.65 * k;
    const q = Math.sin(TAU * beatAt(t) * 8); // 8 shivers per beat
    // gaze follows the comet: local look-x is mirrored (facing -1 → +x = screen-left)
    const [cx, cy] = cometWorld(t);
    const gx = clamp(-(cx - D3) / 260, -0.8, 0.9);
    return {
      ...base, exclaim: t < T_POINT + 0.3, quiver: amp,
      pose: { ...Q, expr: 'excited', ears: 1, blink: 0, tilt: tg + 0.035 * amp * q, squash: 1 + 0.03 * amp * Math.sin(TAU * beatAt(t) * 8 + 1), wag: 1.5, wagRate: 4,
        look: [gx, cy < gy(D3) - 200 ? -0.95 : -0.5], headTilt: -0.42 - 0.25 * clamp(1 - Math.abs(gx)) },
    };
  }
  if (t < T_WIND) { // whips round after it: ARF!
    const k = E.outBack(clamp((t - T_TURN) / 0.1));
    return {
      ...base, bark: true, quiver: 1,
      pose: { ...Q, facing: 1, turn: clamp(Math.abs(k * 2 - 1)), expr: 'excited', ears: 1, blink: 0, mouth: clamp(1.2 * Math.exp(-(t - T_TURN) * 4)), tilt: tg + 0.03 * Math.sin(TAU * beatAt(t) * 8), wag: 1.5, wagRate: 4, headTilt: -0.15, look: [0.8, -0.5] },
    };
  }
  const k = clamp((t - T_WIND) / 0.1);
  return {
    ...base, blur: k,
    pose: { ...Q, facing: 1, stance: 'run', phase: (t - T_WIND) * 8, expr: 'determined', ears: 1, tilt: tg - 0.22 * E.outBack(k), squash: 0.94, wag: 1.5 },
  };
}

// ---------------------------------------------------------------- FX
function exclaimBurst(ctx, x, y, k, t) {
  if (k <= 0) return;
  const sc = E.outBack(clamp(k), 2.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.1 + 0.06 * wobble(t, T_B3, 5, 5));
  ctx.scale(sc, sc);
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 5;
  for (const a of [-2.55, -1.57, -0.6, -3.3, 0.15]) {
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 44 - 6); ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62 - 6); ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-13, -42); ctx.quadraticCurveTo(0, -52, 13, -42); ctx.lineTo(5, 10); ctx.quadraticCurveTo(0, 14, -5, 10); ctx.closePath();
  ink(ctx, PAL.red, 5);
  circlePath(ctx, 0, 30, 9); ink(ctx, PAL.red, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ellipsePath(ctx, -4, -32, 3.5, 9, 0.15); ctx.fill();
  ctx.restore();
}
function quiverMarks(ctx, x, y, amp, t) {
  if (amp <= 0) return;
  const j = Math.sin(TAU * beatAt(t) * 8);
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 4;
  ctx.globalAlpha *= clamp(amp * 1.4);
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const r = 58 + i * 14 + 3 * j * sd;
      ctx.beginPath(); ctx.arc(x, y, r, sd < 0 ? Math.PI - 0.32 : -0.32, sd < 0 ? Math.PI + 0.32 : 0.32); ctx.stroke();
    }
  }
  ctx.restore();
}
// wind-up: cartoon "wheel" of motion arcs where the legs are spinning
function legBlur(ctx, x, y, r, k, t, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ga(x));
  ctx.scale(1, 0.62);
  ctx.lineCap = 'round';
  const spin = -(t - T_WIND) * 38;
  for (let i = 0; i < 4; i++) {
    const a0 = spin + i * (TAU / 4) + hash01(i, seed) * 0.4;
    ctx.globalAlpha = 0.75 * k;
    ctx.strokeStyle = i % 2 ? '#ffffff' : '#ffb27a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, r * (0.75 + 0.25 * hash01(i, seed + 3)), a0, a0 + 1.1); ctx.stroke();
  }
  ctx.restore();
}
// ---- the ZIP: a curved cartoon streak from where they stood, arcing up over the portholes and diving into
// the doorway. The head leads; the tail follows ZIP_LAG behind along the same curve, so after the head
// arrives the streak collapses into the door instead of lingering across the hull.
const ZIP_LAG = 0.08;
function zipPath(from) { // cubic Bézier control points in world coords (rocket-local points via rocketToWorld at rest)
  const p1 = [from[0] + 140, from[1] - 340];
  const p2 = rocketToWorld(T_LEAP, -60, -790); // high over the portholes, then dive into the door
  const p3 = DOOR;
  return [from, p1, p2, p3];
}
function bez(P, s) {
  const a = 1 - s;
  const b0 = a * a * a, b1 = 3 * a * a * s, b2 = 3 * a * s * s, b3 = s * s * s;
  const d0 = -3 * a * a, d1 = 3 * a * a - 6 * a * s, d2 = 6 * a * s - 3 * s * s, d3 = 3 * s * s;
  return {
    x: b0 * P[0][0] + b1 * P[1][0] + b2 * P[2][0] + b3 * P[3][0],
    y: b0 * P[0][1] + b1 * P[1][1] + b2 * P[2][1] + b3 * P[3][1],
    dx: d0 * P[0][0] + d1 * P[1][0] + d2 * P[2][0] + d3 * P[3][0],
    dy: d0 * P[0][1] + d1 * P[1][1] + d2 * P[2][1] + d3 * P[3][1],
  };
}
const zipEase = (u) => 1 - (1 - u) * (1 - u); // explosive start
// tapered ribbon along the path between curve params s0 (tail, width 0) and s1 (head, width w)
function zipRibbon(ctx, P, s0, s1, w, fill, alpha) {
  if (s1 - s0 < 0.005 || alpha <= 0) return;
  const N = 14, L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const s = lerp(s0, s1, i / N), b = bez(P, s);
    const m = Math.hypot(b.dx, b.dy) || 1, nx = -b.dy / m, ny = b.dx / m;
    const ww = w * Math.pow(i / N, 0.7) * 0.5;
    L.push([b.x + nx * ww, b.y + ny * ww]); R.push([b.x - nx * ww, b.y - ny * ww]);
  }
  const h = bez(P, s1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.arc(h.x, h.y, w * 0.5, Math.atan2(h.dy, h.dx) - Math.PI / 2, Math.atan2(h.dy, h.dx) + Math.PI / 2);
  for (let i = N; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}
// Road-Runner dust cloud left where a character stood
function dustPoof(ctx, t, t0, x, k, seed) {
  const dt = t - t0;
  if (dt < 0 || dt > 0.6) return;
  const u = dt / 0.6, y0 = gy(x);
  const offs = [[-38, -16, 24], [36, -14, 22], [0, -30, 30], [-16, -58, 22], [20, -54, 19]];
  offs.forEach(([ox, oy, r], i) => {
    smokePuff(ctx, x + ox * k * (1 + 0.6 * u), y0 + oy * k - 14 * u, r * k * (1 + 0.25 * u), {
      seed: seed + i * 3, u: 0.14 + 0.84 * u, fill: DUST, shadeCol: DUST_SH, lw: 3.2, n: 4,
    });
  });
}
// cartoon speed lines behind a zipping character
function speedDashes(ctx, p, ang, t, n, seed, alpha) {
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const off = (hash01(i, seed) - 0.5) * 120;
    const back = 40 + 160 * hash01(i, seed + 1);
    const len = 60 + 120 * hash01(i, seed + 2);
    const bx = p[0] - Math.cos(ang) * back - Math.sin(ang) * off;
    const by = p[1] - Math.sin(ang) * back + Math.cos(ang) * off;
    ctx.globalAlpha = alpha * (0.5 + 0.5 * hash01(i, seed + 3));
    ctx.lineWidth = 3 + 4 * hash01(i, seed + 4);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(ang) * len, by - Math.sin(ang) * len); ctx.stroke();
  }
  ctx.restore();
}

function hullShadow(ctx, x, y, r, a) {
  if (a <= 0.005) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba('#5a3a52', a));
  g.addColorStop(0.55, rgba('#5a3a52', a * 0.6));
  g.addColorStop(1, rgba('#5a3a52', 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
// the whip-round: three short curved "turn" marks on the side she spun away from (k: 1 → 0 fades them)
function whipSwoosh(ctx, x, y, k) {
  if (k <= 0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  ctx.globalAlpha *= clamp(k * 1.5);
  for (let i = 0; i < 3; i++) {
    const r = 70 + 16 * i, a0 = Math.PI * (0.78 + 0.05 * i), a1 = a0 + 0.42 * (0.4 + 0.6 * k);
    ctx.lineWidth = 4.5 - i;
    ctx.beginPath(); ctx.arc(x + 8, y - 8 * i, r, a0, a1); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- draw
function drawJuno(ctx, t, J) {
  if (J.mode !== 'body') return;
  drawGirl(ctx, J.x, J.y, S, J.pose);
}
function drawBiscuit(ctx, t, D) {
  if (D.mode !== 'body') return;
  drawDog(ctx, D.x, D.y, S, D.pose);
}

// Held: Juno grips the pole low (local y = GRIP_Y, just above the spike) so it rises clear of her helmet.
const GRIP_Y = 92;
function heldOrigin(hand, rot) { // flag origin such that local (0, GRIP_Y) sits in her fist
  const d = GRIP_Y * FS;
  return [hand[0] + Math.sin(rot) * d, hand[1] - Math.cos(rot) * d];
}
function drawJunoFlag(ctx, t, J) {
  const flagWob = (tt) => 0.11 * wobble(tt, T_PLANT, 2.6, 3.2);
  if (t >= T_PLANT && (J.mode !== 'body' || J.flag === 'planted' || J.mode === 'zip')) {
    const [fx, fy] = flagGround();
    const u = clamp((t - T_PLANT) / 0.5);
    drawFlag(ctx, fx, fy, ga(FX) + flagWob(t), 1, t, 1 + 0.6 * (1 - u));
    return;
  }
  if (J.mode !== 'body' || !J.flag) return;
  const hand = girlAnchors(J.x, J.y, S, J.pose).handR;
  if (J.flag === 'hand') {
    const pop = E.outBack(clamp((t - T_FLAG + 0.02) / 0.1), 2.2); // ~full size on the snare frame
    const rot = -0.12 + 0.16 * Math.sin(clamp((t - T_FLAG) / 0.9) * Math.PI) + 0.12 * wobble(t, T_B2, 2.5, 4);
    const o = heldOrigin(hand, rot);
    // pops out of her fist: scale about the grip
    drawFlag(ctx, lerp(hand[0], o[0], pop), lerp(hand[1], o[1], pop), rot, pop, t, 1.3);
  } else if (J.flag === 'swing') {
    const [gx, gyy] = flagGround();
    const k = J.swing;
    const o = heldOrigin(hand, -0.12);
    drawFlag(ctx, lerp(o[0], gx, k), lerp(o[1], gyy, k), lerp(-0.12, ga(FX), k), 1, t, 1.3);
  }
}

function sparkBurst(ctx, x, y, t, t0, r = 40, n = 6, seed = 3) {
  const dt = t - t0;
  if (dt < 0 || dt > 0.5) return;
  const u = dt / 0.5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash01(i, seed) * 0.6;
    const d = r * (0.3 + 1.1 * E.outCubic(u));
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, (10 + 8 * hash01(i, seed + 1)) * (1 - u), '#fff6c0', 1 - u * u);
  }
  sparkle(ctx, x, y, r * 0.9 * (1 - u), '#ffffff', 1 - u);
}

export default {
  id: 's13_moon_bounce',
  start: 69.74,
  end: 76.94,
  transition: { type: 'cut' },
  draw(ctx, tIn) {
    // Half-frame lead: at 30 fps the frames land ~2 ms BEFORE each beat (beats sit at …x.x35 s), so
    // without it every impact would show one frame late. With it, the frame nearest the beat is the hit.
    const t = clamp(tIn, START, END - 1e-4) + LEAD;
    const cam = camAt(t);
    const J = junoState(t), D = biscuitState(t);
    const C = cometAt(t);

    // ---- sky ----
    spaceBg(ctx, { t, hue: 'violet', seed: 2, stars: 320, driftX: (cam.x - W / 2) * 0.3, driftY: (cam.y - H / 2) * 0.3 });
    withSky(ctx, cam, () => {
      drawEarth(ctx, 330, 232, 62, { t, rot: 0.9 + (t - START) * 0.04 });
      if (C.on) drawComet(ctx, C.x, C.y, C.ang, C.len, { t, size: C.size, seed: 5, curve: -40 });
    });

    // ---- world ----
    withCam(ctx, cam, () => {
      drawMoonSurface(ctx, { t, curve: CURVE, seed: 11, dust: 1 });
      // footprints left by the bounces
      const prints = [[J1, T_B1], [J2, T_B2], [D1, T_B1], [D2, T_B2]];
      for (const [px, pt] of prints) {
        if (t < pt) continue;
        ctx.save(); ctx.translate(px, gy(px) + 4); ctx.rotate(ga(px));
        ctx.fillStyle = rgba('#7a66c2', 0.35 * clamp((t - pt) / 0.2));
        ellipsePath(ctx, -12, 0, 10, 3.2); ctx.fill(); ellipsePath(ctx, 12, 0, 10, 3.2); ctx.fill();
        ctx.restore();
      }
      // shadows
      if (J.mode === 'body') shadowAt(ctx, J.x, J.h, 62);
      if (D.mode === 'body') shadowAt(ctx, D.x, D.h, 58);
      if (t >= T_PLANT) shadowAt(ctx, FX - 8, 0, 22);

      // rocket
      const rs = rocketState(t);
      const hatchOpen = t < T_SETTLE ? 0 : t < T_ZIP + ZIP_DUR ? E.outBack(clamp((t - T_SETTLE) / 0.3), 1.4) : 1 - E.inQuad(clamp((t - T_ZIP - ZIP_DUR) / (T_SLAM - T_ZIP - ZIP_DUR)));
      const crew = t < T_SETTLE || t >= T_ZIP + ZIP_DUR;
      const late = t >= T_ZIP;
      ctx.save();
      ctx.translate(RX, RGY); ctx.rotate(RANG); ctx.scale(rs.sx, rs.sy); ctx.translate(0, -rs.hop);
      drawRocket(ctx, 0, 0, SR, {
        t, legs: 1, hatch: clamp(hatchOpen, 0, 1.08), crew, hatchFrame: 'sill',
        flame: t > T_SLAM + 0.1 ? 0.07 + 0.09 * clamp((t - T_SLAM - 0.1) / 0.2) * (0.6 + 0.4 * Math.abs(noise1(t * 30, 5))) : 0,
        crewPose: late ? { girl: { expr: 'determined', t }, dog: { expr: 'determined', t } } : { girl: { expr: 'excited', t }, dog: { expr: 'excited', t } },
        shake: t > T_SLAM ? 0.5 * clamp((t - T_SLAM) / 0.15) : 0,
        hatchContent: (J.mode === 'door' || D.mode === 'door') ? (c) => {
          if (J.mode === 'door') drawGirl(c, HX - 14, SILL, SL, J.pose);
          if (D.mode === 'door') {
            c.save(); c.translate(HX + 22, SILL); c.scale(1, D.pop); drawDog(c, 0, 0, SL, D.pose); c.restore();
          }
        } : null,
      });
      ctx.restore();
      // touchdown: motion lines streaming up off the hull's flanks + "pow" ticks at the foot pads
      if (t < T_LAND + 0.22) {
        const a = 1 - (t - T_LAND) / 0.22;
        ctx.save();
        ctx.translate(RX, RGY); ctx.rotate(RANG);
        ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const sd = i % 2 ? 1 : -1;
          const xx = sd * (125 + 22 * hash01(i, 4) + 26 * (i >> 1));
          const y0 = -330 - 230 * hash01(i, 5) - 40 * a;
          ctx.globalAlpha = a * 0.75; ctx.lineWidth = 4 + 3 * hash01(i, 6);
          ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 - (70 + 80 * hash01(i, 7)) * (0.4 + 0.6 * a)); ctx.stroke();
        }
        ctx.restore();
      }
      if (t < T_LAND + 0.12) {
        const u = (t - T_LAND) / 0.12;
        for (const fx of [RX - 190, RX + 190, RX + 20]) {
          const fy = gy(fx);
          ctx.save(); ctx.translate(fx, fy); ctx.rotate(ga(fx));
          ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 5;
          ctx.globalAlpha = 1 - u;
          for (const ang of [-2.6, -2.1, -1.05, -0.55]) {
            const r0 = 26 + 40 * u, r1 = r0 + 30 * (1 - u) + 8;
            ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0 * 0.7); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1 * 0.7); ctx.stroke();
          }
          ctx.restore();
        }
      }
      // rocket landing dust
      dustBurst(ctx, t, T_LAND, RX - 150, 1.6, 31, { ring: true, puffs: 2 });
      dustBurst(ctx, t, T_LAND, RX + 150, 1.6, 37, { dirs: [1], puffs: 2 });
      dustBurst(ctx, t, T_SETTLE, RX, 0.55, 41);

      // landing dust (behind the characters so they stay readable)
      dustBurst(ctx, t, T_B1, J1, 0.8, 51);
      dustBurst(ctx, t, T_B1, D1, 0.7, 57);
      dustBurst(ctx, t, T_B2, J2, 0.8, 61);
      dustBurst(ctx, t, T_B2, D2, 0.7, 67);
      dustBurst(ctx, t, T_PLANT, FX, 0.55, 71);
      dustBurst(ctx, t, T_B3, D3, 0.6, 77);
      dustBurst(ctx, t, T_ZIP, J2, 0.7, 81);
      dustBurst(ctx, t, T_ZIP, D3, 0.7, 87);
      // flag (behind Juno so her fist wraps the pole)
      drawJunoFlag(ctx, t, J);
      // leaping out across the hull: soft cast shadows on the cream hull (light from upper-left) so the
      // cream-suited pair separates from it (invisible against the dark sky)
      if (t > T_LEAP && t < T_B1) {
        const over = (x) => clamp(1.4 - Math.abs(x - (RX + 30)) / 170);
        if (J.mode === 'body') hullShadow(ctx, J.x + 46, J.y - 64, 100, 0.5 * over(J.x));
        if (D.mode === 'body') hullShadow(ctx, D.x + 36, D.y - 14, 64, 0.5 * over(D.x));
      }
      // characters
      drawJuno(ctx, t, J);
      if (J.whip > 0) whipSwoosh(ctx, J.x, J.y - 150, J.whip);
      drawBiscuit(ctx, t, D);
      if (J.blur) legBlur(ctx, J.x, J.y - 34, 46, J.blur, t, 1);
      if (D.blur) legBlur(ctx, D.x, D.y - 26, 42, D.blur, t, 2);

      // wind-up dust kicked from spinning feet
      if (t > T_WIND && t < T_ZIP) {
        for (const [x, sd] of [[J2, 83], [D3, 89]]) {
          for (let i = 0; i < 3; i++) {
            const ph = ((t - T_WIND) * 5 + i / 3) % 1;
            smokePuff(ctx, x - 30 - 70 * ph, gy(x - 30 - 70 * ph) - 10 - 20 * ph, 16 + 10 * ph, { seed: sd + i, u: 0.2 + 0.7 * ph, fill: DUST, shadeCol: DUST_SH, lw: 3, n: 4 });
          }
        }
      }

      // flag reveal + plant sparkles
      if (J.mode === 'body' && t >= T_FLAG && t < T_FLAG + 0.5) {
        const hand = girlAnchors(J.x, J.y, S, J.pose).handR;
        sparkBurst(ctx, hand[0] - 20, hand[1] - 50, t, T_FLAG, 50, 7, 9);
      }
      if (t >= T_PLANT && t < T_PLANT + 0.5) {
        const [fx, fy] = flagGround();
        sparkBurst(ctx, fx, fy - 236 * FS, t, T_PLANT, 46, 6, 13);
      }

      // Biscuit's "!" + quiver marks + ARF!
      if (D.mode === 'body' && t >= T_B3) {
        const an = dogAnchors(D.x, D.y, S, D.pose);
        const ek = t < T_POINT + 0.3 ? clamp((t - T_B3 + 0.02) / 0.1) : 1 - clamp((t - T_POINT - 0.3) / 0.14); // pops ON the downbeat frame
        exclaimBurst(ctx, an.crown[0] - 6, an.crown[1] - 62, ek, t);
        if (D.quiver) quiverMarks(ctx, an.head[0] + 2, an.head[1] + 22, D.quiver * (t < T_TURN ? 1 : 1 - clamp((t - T_TURN) / 0.3)), t);
        if (D.bark) {
          const bk = clamp((t - T_TURN + 0.02) / 0.08), fade = 1 - clamp((t - T_TURN - 0.24) / 0.15); // pops on the beat frame
          cartoonText(ctx, 'ARF!', an.mouth[0] + 58, an.mouth[1] - 44, { size: 46, fill: PAL.yellow, scale: E.outBack(bk, 2.5), alpha: fade, rot: 0.12, lw: 7 });
        }
      }

      // ---- the ZIP ----
      if (t >= T_ZIP) {
        // dust clouds hang where they stood (drawn first: the streaks launch out of them)
        dustPoof(ctx, t, T_ZIP, J2, 1.15, 91);
        dustPoof(ctx, t, T_ZIP, D3, 0.95, 95);
        // Biscuit first (he's lower / behind), then Juno on top
        for (const [who, st, cOut, cIn, w, sd] of [['d', D, '#c9782f', '#fff6e2', 30, 7], ['j', J, '#ff8a3d', '#fffaf0', 38, 3]]) {
          const P = zipPath([st.from[0], st.from[1] - (who === 'j' ? 80 : 44)]);
          const lagD = who === 'd' ? 0.02 : 0; // the dog is a hair behind
          const uH = clamp((t - T_ZIP - lagD) / ZIP_DUR), h1 = zipEase(uH);
          const h0 = zipEase(clamp((t - T_ZIP - lagD - ZIP_LAG) / ZIP_DUR));
          zipRibbon(ctx, P, h0, h1, w * 1.25, cOut, 0.95);
          zipRibbon(ctx, P, lerp(h0, h1, 0.25), h1, w * 0.6, cIn, 1);
          if (t >= T_ZIP && uH < 0.62) { // (the dog's 1-frame lag: he's drawn at the start point, not missing) // the character itself, smeared along the motion, then lost in the streak
            const b = bez(P, h1), ang = Math.atan2(b.dy, b.dx);
            const sm = Math.sin(Math.PI * Math.min(1, uH / 0.62));
            if (uH > 0.14) speedDashes(ctx, [b.x, b.y], ang, t, 6, sd + 20, 0.75 * (1 - uH)); // (not while still at the ground: they'd streak into it)
            ctx.save();
            ctx.globalAlpha *= 1 - clamp((uH - 0.45) / 0.17);
            ctx.translate(b.x, b.y);
            ctx.rotate(ang); ctx.scale(1 + 0.8 * sm, 1 - 0.3 * sm); ctx.rotate(-ang);
            if (who === 'j') drawGirl(ctx, 0, 80, S * 0.95, { ...JB, t, facing: 1, stance: 'run', phase: t * 9, expr: 'determined', blink: 0, tilt: 0.35 });
            else drawDog(ctx, 0, 44, S * 0.95, { ...DBASE, t, facing: 1, stance: 'run', phase: t * 9, expr: 'determined', ears: 1, blink: 0 });
            ctx.restore();
          }
        }
        // a little "fwoomp" puff in the doorway as they shoot inside
        const ta = T_ZIP + ZIP_DUR;
        if (t >= ta && t < ta + 0.3) {
          const k = (t - ta) / 0.3;
          ctx.save(); ctx.globalAlpha *= 1 - k;
          ctx.strokeStyle = '#fff6d8'; ctx.lineCap = 'round'; ctx.lineWidth = 5 * (1 - k) + 1;
          for (let i = 0; i < 5; i++) {
            const a = -2.6 + i * 0.5, r0 = 50 + 60 * E.outCubic(k), r1 = r0 + 28 * (1 - k);
            ctx.beginPath(); ctx.moveTo(DOOR[0] + Math.cos(a) * r0, DOOR[1] + Math.sin(a) * r0);
            ctx.lineTo(DOOR[0] + Math.cos(a) * r1, DOOR[1] + Math.sin(a) * r1); ctx.stroke();
          }
          ctx.restore();
        }
      }
      // hatch slam bang
      if (t >= T_SLAM && t < T_SLAM + 0.35) {
        const [hx, hy] = rocketToWorld(t, HX, SILL - 110);
        sparkBurst(ctx, hx, hy, t, T_SLAM, 70, 8, 21);
      }
      // pre-ignition rumble: a warm glow under the nozzle and smoke squeezing out and rolling away along the
      // ground both ways (low, overlapping billows), handing off to s14's ignition on the downbeat
      if (t > T_SLAM + 0.04) {
        const k = clamp((t - T_SLAM - 0.04) / 0.22);
        const [nx, ny] = rocketToWorld(t, 0, -4);
        glow(ctx, nx, ny + 10, 90 + 150 * k, '#ffcf7a', (0.35 + 0.2 * Math.abs(noise1(t * 26, 9))) * k);
        for (let i = 0; i < 10; i++) {
          const side = i % 2 ? 1 : -1;
          const tb = T_SLAM + 0.04 + 0.026 * i;
          const age = t - tb;
          if (age <= 0) continue;
          const roll = E.outCubic(clamp(age / 0.45));
          const px = nx + side * (18 + (70 + 90 * hash01(i, 5)) * roll);
          const r = (20 + 22 * hash01(i, 6)) * (0.45 + 0.75 * E.outCubic(clamp(age / 0.3)));
          ctx.save();
          ctx.translate(px, gy(px) - r * 0.55 - 4);
          ctx.scale(1.3, 0.78);
          smokePuff(ctx, 0, 0, r, { seed: 100 + i * 7, u: 0.18 + 0.5 * clamp(age / 0.35), fill: '#f3eefa', shadeCol: '#c9bfdf', lw: 3.4, n: 5 });
          ctx.restore();
        }
      }
    });
  },
};

// debugging / review helpers (not used by the engine)
export const _dbg = { camBase, cometAt, cometWorld, skyToScreen, toScreen, junoState, biscuitState, aimArm, DOOR, DJ, DB };
