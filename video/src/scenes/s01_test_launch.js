// s01_test_launch — golden-hour backyard, the countdown, Test Rocket #1 and the KA-BOOM
// (the song's false start). 0.00 → 7.34 (bars 0–2).
//
// Beat plan (absolute seconds; every hit is placed with barTime and shown on the frame
// NEAREST the beat — see LEAD):
//   0.13  bar 0   establishing, slow push-in; Biscuit wags on the beats
//   0.73  b1      Juno snaps her goggles down (fist up at the strap 0.45 →, snap ON the beat)
//   1.33  b2      Biscuit clamps his paws over his ears
//   1.93  b3      "5"   2.54 "4"   3.14 "3"   3.74 "2"   4.34 "1"  (pop + overshoot, shrink out)
//   3.14  →       the rocket trembles;  3.74 → smoke puffs at its base (8th notes)
//   4.04 / 4.19   16th-note guitar run: pre-ignition jolts
//   4.34  "1"     Juno thrusts the remote and presses: click + radio waves → IGNITION
//   4.34–4.79     the rocket hiccups up one step per 16th, wobbling drunkenly
//   4.79 → 4.94   it swells like a balloon, light leaking from the seams (the wind-up)
//   4.94  bar 2   KA-BOOM: 1 inverted impact frame, fireball, white flash, shock ring,
//                 "KA-BOOM!" lettering, heavy shake decaying over ~1 s, camera blown back
//   4.94 → 5.8    smoke erupts from the blast and engulfs the whole frame (screen-space wall)
//   5.54  b1      the traffic-cone nose "ting"s out of sight at the top of frame (it comes
//                 back down on Biscuit's head in s02 at 12.14)
//   6.14  b2      the KA-BOOM letters lose their grip and fall
//   5.9 → 7.3     debris (fins, tape roll, lid, hoop, can, bolts) rains down through the smoke
//   → 7.34        the smoke lightens ("thins") but hides everything: straight cut to s02, which
//                 draws the SAME smoke wall (smokeWall() is exported) and clears it.
import { W, H, PAL, INK, LW, FONT, camera, shake, cartoonText, smokePuff, glow, sparkle,
  blobs, circlePath, ink, starPath, speedLines } from '../draw.js';
import { clamp, lerp, ease, tween, hash01, noise1, mixColor, rgba, TAU, smoothstep } from '../util.js';
import { barTime, sway, beatAt } from '../timing.js';
import { drawBackyard, longShadow, todTint } from '../props/backyard.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';
import { drawTestRocket, drawTestDebris } from '../props/rockets.js';
import { remote, trafficCone } from '../props/items.js';

// ------------------------------------------------------------------ beat grid
// Events fire half a frame (at 30 fps) early so the frame nearest the beat is the impact frame.
export const LEAD = 1 / 60;
const on = (k, b = 0) => barTime(k, b) - LEAD;
const T_GOGGLES = on(0, 1); // 0.73
const T_EARS = on(0, 2); // 1.33
const COUNT = [on(0, 3), on(1, 0), on(1, 1), on(1, 2), on(1, 3)]; // "5" "4" "3" "2" "1"
const T_TREMBLE = on(1, 1); // 3.14
const T_PUFFS = on(1, 2); // 3.74
const RUN = [2.5, 2.75, 3, 3.25, 3.5, 3.75].map((b) => on(1, b)); // 16th-note guitar run 4.04 … 4.79
const T_PRESS = RUN[2]; // 4.34 = "1"
export const T_BOOM = on(2); // 4.94  KA-BOOM
const T_TING = on(2, 1); // 5.54  cone twinkles out of sight
const T_LETTERS = on(2, 2); // 6.14  KA-BOOM letters fall
export const T_CUT = barTime(3); // 7.34  cut to s02 (smoke wall hand-over)
const FRAME = 1 / 30;

// ------------------------------------------------------------------ world layout
export const S = 0.5; // characters + test rocket (same s: TEST_ROCKET_HEIGHT already has its 1.35)
export const JUNO = [600, 880];
export const DOG = [716, 886];
const PAD = [1240, 756]; // rocket base on the crates
const GOLD = todTint('golden');
const LIGHT = { mul: GOLD.mul, add: GOLD.add, addAmt: GOLD.addAmt, k: 0.7 };

// ------------------------------------------------------------------ camera
function camBase(t) {
  // slow push-in over bars 0–1, drifting toward the rocket once it starts to misbehave
  const x = tween(t, 0, T_PRESS, 915, 935, ease.inOutSine) + tween(t, T_PRESS - 0.3, T_BOOM, 0, 48, ease.inOutSine);
  const y = tween(t, 0, T_PRESS, 612, 640, ease.inOutSine) + tween(t, T_PRESS - 0.3, T_BOOM, 0, -6, ease.inOutSine);
  let zoom = tween(t, 0, T_PRESS, 1.55, 1.8, ease.inOutSine) + tween(t, T_PRESS - 0.3, T_BOOM, 0, 0.2, ease.inQuad);
  // BOOM: the camera gets blown back (fast zoom-out with overshoot), then drifts up with the debris
  const kb = clamp((t - T_BOOM) / 0.22);
  const zb = ease.outBack(kb, 2.2);
  zoom = lerp(zoom, 1.12, zb);
  const cx = lerp(x, 1040, zb), cy = lerp(y, 590, zb) - tween(t, T_BOOM + 0.3, T_CUT, 0, 60, ease.inOutSine);
  return { x: cx, y: cy, zoom };
}
function cam(t) {
  const c = camBase(t);
  let dx = 0, dy = 0, rot = 0;
  // tiny jolts on the 16th-note run, growing
  for (let i = 0; i < RUN.length; i++) {
    if (t >= RUN[i]) { const s = shake(t, RUN[i], 3 + i * 1.6, 14, 30); dx += s.dx; dy += s.dy; }
  }
  // countdown bumps
  for (let i = 0; i < COUNT.length; i++) {
    if (t >= COUNT[i]) { const s = shake(t, COUNT[i], 2 + i * 1.2, 12, 26); dx += s.dx; dy += s.dy; }
  }
  const s = shake(t, T_BOOM, 70, 3.4, 19);
  // translation-only shake: any camera rotation drops the backyard's axis-aligned fast paths
  // (≈ 2.5x its raster cost), so the rumble stays in x/y
  return { ...c, dx: dx + s.dx, dy: dy + s.dy, rot };
}
const toScreen = (c, [x, y]) => [W / 2 + c.dx + (x - c.x) * c.zoom, H / 2 + c.dy + (y - c.y) * c.zoom];

// screen point the smoke wall erupts from (the rocket, as framed just after the boom)
const BOOM_WORLD = [PAD[0], PAD[1] - 150];
export const SMOKE_E = (() => { const c = camBase(T_BOOM + 0.3); return toScreen({ ...c, dx: 0, dy: 0 }, BOOM_WORLD); })();

// ------------------------------------------------------------------ the rocket's last moments
function rocketState(t) {
  let lift = 0, shakeAmt = 0, flame = 0, wob = 0;
  shakeAmt = tween(t, T_TREMBLE, RUN[0], 0.18, 0.7, ease.inQuad);
  // pre-ignition jolts (hops) on the first two 16ths
  for (let i = 0; i < 2; i++) {
    if (t >= RUN[i]) lift += 10 * Math.max(0, Math.sin(Math.min(Math.PI, (t - RUN[i]) * 22))) * Math.exp(-(t - RUN[i]) * 6);
  }
  if (t >= RUN[0]) flame = 0.22; // coughs
  if (t >= T_PRESS) { flame = 1; wob = tween(t, T_PRESS, RUN[5], 0.45, 1); shakeAmt = 1; }
  // one hiccup up per 16th after ignition
  for (let i = 2; i < RUN.length; i++) {
    if (t >= RUN[i]) {
      const k = clamp((t - RUN[i]) / 0.09);
      lift += 20 * ease.outBack(k, 3) - 4 * Math.sin(clamp((t - RUN[i] - 0.09) / 0.06) * Math.PI);
    }
  }
  // rattling: a little jump on the "3" and "2" beats before the run
  for (const bt of [T_TREMBLE, T_PUFFS]) {
    if (t >= bt) lift += 9 * Math.max(0, Math.sin(Math.min(Math.PI, (t - bt) * 16))) * Math.exp(-(t - bt) * 4);
  }
  const swell = ease.inCubic(clamp((t - RUN[5]) / (T_BOOM - RUN[5])));
  return { lift, shake: shakeAmt, flame, wob, swell };
}
function drawRocketLive(ctx, t) {
  const R = rocketState(t);
  const x = PAD[0], y = PAD[1] - R.lift;
  // pre-ignition puffs at the base on 8th notes (3.74 → ignition)
  if (t >= T_PUFFS && t < T_BOOM) {
    const step = 0.3; // 8th note
    const n0 = Math.floor((t - T_PUFFS) / step);
    for (let n = Math.max(0, n0 - 3); n <= n0; n++) {
      const u = (t - T_PUFFS - n * step) / 0.9;
      if (u <= 0 || u >= 1) continue;
      for (const side of [-1, 1]) {
        const px = PAD[0] + side * (26 + 70 * ease.outCubic(u) * (0.6 + 0.4 * hash01(n, 7 + side)));
        const py = PAD[1] - 8 - 30 * u;
        smokePuff(ctx, px, py, 26 + 20 * hash01(n, 3 + side), { seed: n * 3 + side + 20, u: 0.1 + 0.9 * u, n: 4, lw: LW * 0.5 });
      }
    }
  }
  ctx.save();
  if (R.swell > 0) {
    // the wind-up: it swells like a balloon, jittering
    const cy = y - 90, j = R.swell;
    ctx.translate(x + 4 * j * noise1(t * 60, 3), cy + 3 * j * noise1(t * 60, 5));
    ctx.scale(1 + 0.75 * j, 1 + 0.38 * j);
    ctx.translate(-x, -cy);
  }
  // extra nervous jitter on top of the prop's own shake
  const jx = R.shake * 2.5 * noise1(t * 38, 71), jr = R.shake * 0.03 * noise1(t * 31, 73);
  ctx.save();
  ctx.translate(x + jx, y); ctx.rotate(jr); ctx.translate(-x, -y);
  drawTestRocket(ctx, x, y, S, { t, flame: R.flame, wobble: R.wob, shake: R.shake, light: LIGHT });
  ctx.restore();
  if (R.swell > 0) {
    // light leaking from the seams
    const j = R.swell, cy = y - 90;
    glow(ctx, x, cy, 180 + 220 * j, '#fff2b0', 0.9 * j);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.62 + 0.2 * hash01(i, 9);
      ctx.beginPath();
      let px = x + Math.cos(a) * 12, py = cy + Math.sin(a) * 14;
      ctx.moveTo(px, py);
      const L = 20 + 55 * j;
      for (let k = 1; k <= 3; k++) {
        const aa = a + (k % 2 ? 0.35 : -0.35);
        px += Math.cos(aa) * L / 3; py += Math.sin(aa) * L / 3;
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba('#fffbe0', clamp(j * 2)); ctx.lineWidth = 3 + 3 * j; ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ Juno
function remoteHold(pressed, cap) {
  return (ctx, info) => {
    ctx.rotate(-info.angle); // upright in body space
    if (info.dir < 0) ctx.scale(-1, 1);
    ctx.translate(2, -30);
    ctx.scale(0.62, 0.62);
    remote(ctx, { pressed });
    if (cap) { // remember where the antenna ball is (for the radio waves), this frame only
      const m = ctx.getTransform();
      cap.x = m.a * 31 + m.c * -117 + m.e; cap.y = m.b * 31 + m.d * -117 + m.f;
      cap.sx = Math.hypot(m.a, m.b);
    }
  };
}
function arm(a, b, hand = 'fist') { return { a, b, hand }; }
function mixArm(A, B, k) { return { a: lerp(A.a, B.a, k), b: lerp(A.b, B.b, k), hand: k < 0.5 ? A.hand : B.hand }; }

function junoPose(t, cap) {
  const HOLD = arm(0.42, 1.12);
  const pose = { t, facing: 0.72, stance: 'stand', expr: 'excited', goggles: 'forehead', light: LIGHT };
  // --- left arm: snap goggles down on b1
  const UP = arm(2.82, 0.62), YANK = arm(2.35, 0.25), DOWN = arm(0.14, 0.1, 'open');
  let armL = DOWN;
  if (t < T_GOGGLES) armL = mixArm(DOWN, UP, ease.inOutCubic(clamp((t - (T_GOGGLES - 0.3)) / 0.26)));
  else if (t < T_GOGGLES + 0.07) armL = mixArm(UP, YANK, ease.outCubic((t - T_GOGGLES) / 0.07));
  else armL = mixArm(YANK, arm(0.25, 0.9), ease.inOutCubic(clamp((t - T_GOGGLES - 0.1) / 0.35)));
  pose.armL = armL;
  if (t >= T_GOGGLES) { pose.goggles = 'eyes'; pose.expr = 'determined'; }
  // squash on the snap
  let squash = 1 - 0.06 * Math.exp(-(t - T_GOGGLES) * 9) * (t >= T_GOGGLES ? Math.cos((t - T_GOGGLES) * 30) : 0);
  // --- countdown: a determined nod on every number
  let headTilt = 0;
  for (let i = 0; i < COUNT.length; i++) if (t >= COUNT[i] - 0.1) headTilt += 0.09 * Math.sin(clamp((t - COUNT[i] + 0.1) / 0.35) * Math.PI);
  // --- right arm: hold the remote; wind up, then thrust + press on "1"
  const WIND = arm(0.12, 1.55), THRUST = arm(1.05, 0.42);
  let armR = HOLD;
  if (t >= T_PRESS - 0.2 && t < T_PRESS) armR = mixArm(HOLD, WIND, ease.inOutCubic((t - T_PRESS + 0.2) / 0.2));
  else if (t >= T_PRESS) armR = mixArm(WIND, THRUST, ease.outBack(clamp((t - T_PRESS) / 0.08), 2));
  pose.armR = armR;
  const pressed = t >= T_PRESS ? 1 : clamp((t - T_PRESS + 0.04) / 0.04);
  pose.holdR = remoteHold(pressed, cap);
  let tilt = 0;
  if (t >= T_PRESS - 0.2) {
    tilt = t < T_PRESS ? -0.05 * ease.inOutCubic((t - T_PRESS + 0.2) / 0.2) : lerp(-0.05, 0.1, ease.outBack(clamp((t - T_PRESS) / 0.1)));
    if (t >= T_PRESS) squash *= 1 - 0.07 * Math.exp(-(t - T_PRESS) * 8);
    pose.expr = t < T_PRESS ? 'determined' : 'excited';
  }
  // rocket starts wobbling toward her: uh-oh
  if (t >= RUN[4]) { pose.expr = 'surprised'; tilt = lerp(0.1, -0.06, ease.outCubic(clamp((t - RUN[4]) / 0.15))); pose.look = [0.8, -0.2]; }
  // BOOM: blown back (hidden by the fireball / smoke almost at once)
  if (t >= T_BOOM) { pose.expr = 'wince'; tilt = -0.22; squash = 0.92; pose.armL = arm(1.3, 1.2); }
  pose.tilt = tilt; pose.squash = squash; pose.headTilt = headTilt;
  return pose;
}

// ------------------------------------------------------------------ Biscuit
function dogPose(t) {
  const pose = { t, stance: 'sit', facing: 1, expr: 'happy', light: LIGHT, wag: 0.9 };
  const kp = ease.inCubic(clamp((t - (T_EARS - 0.14)) / 0.14));
  pose.pawsUp = kp;
  let squash = 1;
  if (t >= T_EARS) {
    pose.expr = 'alert'; pose.wag = 0.25; pose.tongue = 0;
    squash = 1 - 0.1 * Math.exp(-(t - T_EARS) * 8) * Math.cos((t - T_EARS) * 25);
  }
  // flinch on every number
  for (let i = 0; i < COUNT.length; i++) if (t >= COUNT[i]) squash *= 1 - 0.05 * Math.exp(-(t - COUNT[i]) * 10);
  if (t >= T_TREMBLE) pose.expr = 'surprised';
  if (t >= T_PRESS) { pose.expr = 'wince'; squash *= 0.93; pose.wag = 0; pose.tail = 2.6; }
  if (t >= T_BOOM) { squash = 0.85; pose.tilt = -0.2; }
  pose.squash = squash;
  return pose;
}

// ------------------------------------------------------------------ countdown numbers (screen)
function drawCountdown(ctx, t) {
  const labels = ['5', '4', '3', '2', '1'];
  const cols = [PAL.yellow, PAL.yellow, PAL.orange, PAL.orange, PAL.red];
  for (let i = 0; i < COUNT.length; i++) {
    const lt = t - COUNT[i];
    const life = i === 4 ? 0.3 : 0.42;
    if (lt < -0.02 || lt > life + 0.14) continue;
    // overshoot peaks on the beat frame; the frame before shows (almost) nothing
    const pop = ease.outBack(clamp((lt + 0.02) / 0.08), 2.6);
    const out = ease.inBack(clamp((lt - life) / 0.14), 2);
    const sc = pop * (1 - out) * (1 + 0.05 * Math.exp(-lt * 6));
    if (sc <= 0.01) continue;
    const x = 930 + (i % 2 ? 26 : -26), y = 300 + (i === 4 ? -10 : 0);
    const rot = (i % 2 ? 0.1 : -0.1) * (1 - 0.5 * clamp(lt / 0.3));
    // burst behind
    ctx.save();
    ctx.globalAlpha = clamp(1 - lt / 0.35) * 0.9;
    ctx.translate(x, y); ctx.rotate(rot * 2);
    starPath(ctx, 0, 0, 230 * sc, 120 * sc, 10, -Math.PI / 2 + i * 0.3);
    ctx.fillStyle = rgba('#fff7d6', 0.65); ctx.fill();
    ctx.restore();
    cartoonText(ctx, labels[i], x, y + 8, { size: i === 4 ? 330 : 290, fill: cols[i], scale: sc, rot, lw: 34 });
  }
}

// ------------------------------------------------------------------ explosion bits
function drawShock(ctx, t, E) {
  const u = (t - T_BOOM) / 0.55;
  if (u < 0 || u > 1) return;
  ctx.save();
  const r = 120 + 2300 * ease.outCubic(u);
  ctx.globalAlpha = (1 - u) * 0.9;
  ctx.beginPath(); ctx.ellipse(E[0], E[1], r, r * 0.8, 0, 0, TAU);
  ctx.lineWidth = 60 * (1 - u) + 4; ctx.strokeStyle = '#fffbe8'; ctx.stroke();
  ctx.restore();
  speedLines(ctx, E[0], E[1], t * 3, { count: 36, inner: 420 + 900 * u, outer: 1900, alpha: 0.7 * (1 - u), lw: 9, seed: 17 });
}
function burstPath(ctx, x, y, r, n, seed) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU + 0.1;
    const k = i % 2 ? 0.52 + 0.1 * hash01(i, seed) : 1 + 0.35 * (hash01(i, seed + 1) - 0.4);
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// Boiling cartoon fireball (no smoke of its own — the smoke wall does that). lt = time since the
// hit: full size on the very first frame (outBack), spikes re-drawn every 2 frames (hand-drawn
// boil), then it collapses (inBack) into the smoke after `hold` seconds.
function fireball(ctx, x, y, R, lt, seed, hold = 0.6) {
  if (lt < -0.02) return;
  const g = ease.outBack(clamp((lt + 0.03) / 0.11), 2.2);
  const c = ease.inBack(clamp((lt - hold) / 0.3), 1.6);
  const r = R * g * (1 - c) * (1 + 0.12 * clamp(lt / hold));
  if (r <= 2) return;
  const sd = seed * 31 + Math.floor(Math.max(0, lt) * 15); // boil
  const rot = lt * 0.5 + seed;
  const layer = (rr, n, jit, s2) => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i / (n * 2)) * TAU + (hash01(i, s2 + 5) - 0.5) * 0.12;
      const k = i % 2 ? 0.56 + 0.08 * hash01(i, s2) : 1 + jit * (hash01(i, s2 + 1) - 0.45);
      const px = x + Math.cos(a) * rr * k, py = y + Math.sin(a) * rr * k;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  ctx.save();
  layer(r * 1.1, 12, 0.45, sd); ink(ctx, PAL.red, LW * 1.3);
  layer(r * 0.84, 11, 0.4, sd + 101); ink(ctx, PAL.orange, 0);
  layer(r * 0.58, 9, 0.5, sd + 202); ink(ctx, PAL.yellow, 0);
  circlePath(ctx, x, y, r * 0.26 * (1 + 0.08 * Math.sin(lt * 50))); ink(ctx, '#fffbe0', 0);
  // hot highlight dots
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 4; i++) {
    const a = rot * 2 + i * 1.7 + hash01(i, sd) * 0.5;
    circlePath(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.4, r * 0.035); ctx.fill();
  }
  ctx.restore();
}

// the inverted "impact frame": cream paper, ink burst, ink silhouettes
function drawImpactFrame(ctx, t) {
  const c = cam(T_BOOM + 0.001);
  ctx.fillStyle = '#fff4d0'; ctx.fillRect(0, 0, W, H);
  camera(ctx, c, () => {
    ctx.fillStyle = INK; ctx.fillRect(-2000, 872, 6000, 3000); // the ground
    burstPath(ctx, BOOM_WORLD[0], BOOM_WORLD[1] + 40, 430, 13, 5); ctx.fillStyle = INK; ctx.fill();
    burstPath(ctx, BOOM_WORLD[0], BOOM_WORLD[1] + 40, 190, 9, 8); ctx.fillStyle = '#fff4d0'; ctx.fill();
    drawGirl(ctx, JUNO[0], JUNO[1], S, { ...junoPose(t), silhouette: 1, light: null, holdR: null });
    drawDog(ctx, DOG[0], DOG[1], S, { ...dogPose(t), silhouette: 1, light: null, rim: 0 });
  });
}

// "KA-BOOM!" lettering (screen space): pops on the beat, jiggles, letters drop off at 6.14
const KB = 'KA-BOOM!';
function drawKaboom(ctx, t) {
  const lt = t - T_BOOM;
  if (lt < 0 || t > T_LETTERS + 1.2) return;
  const size = 210;
  ctx.save();
  ctx.font = `bold ${size}px ${FONT.title}`;
  const ws = [...KB].map((ch) => ctx.measureText(ch).width * 0.96);
  const total = ws.reduce((a, b) => a + b, 0);
  const cx = 900, cy = 270;
  let x = cx - total / 2;
  for (let i = 0; i < KB.length; i++) {
    const ch = KB[i];
    const w = ws[i];
    const d = i * 0.025; // letters arrive left→right
    const k = clamp((lt - d + 0.02) / 0.12);
    if (k > 0) {
      const sc = ease.outBack(k, 3) * (1 + 0.15 * Math.exp(-lt * 7) * Math.sin(lt * 40 + i));
      const jig = Math.exp(-lt * 1.2) * 0.6 + 0.25;
      let lx = x + w / 2 + 5 * jig * noise1(t * 14, i * 7 + 1);
      let ly = cy + (i % 2 ? -12 : 12) + 7 * jig * noise1(t * 14, i * 7 + 2);
      let rot = (i % 2 ? 0.1 : -0.08) + 0.08 * jig * noise1(t * 10, i * 7 + 3);
      let alpha = 1;
      const fall = t - (T_LETTERS + hash01(i, 71) * 0.25);
      if (fall > 0) {
        lx += (hash01(i, 72) - 0.5) * 300 * fall;
        ly += 2600 * fall * fall - 260 * fall;
        rot += (hash01(i, 73) - 0.5) * 9 * fall;
      }
      const fill = i < 2 ? PAL.yellow : i === 2 ? PAL.orange : PAL.red;
      if (ly < H + 200) {
        // cheap drop shadow (fill only)
        ctx.save();
        ctx.translate(lx + 12, ly + 14); ctx.rotate(rot); ctx.scale(sc, sc);
        ctx.fillStyle = rgba(INK, 0.45); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ch, 0, 0);
        ctx.restore();
        cartoonText(ctx, ch, lx, ly, { size, fill, stroke: INK, scale: sc, rot, lw: 38, shadow: false });
      }
    }
    x += w;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the smoke wall (shared with s02)
// Screen-space pile of cartoon smoke billows. They erupt from the blast (SMOKE_E), roll out and
// engulf the frame by ~5.8, boil and lighten; from T_CUT (s02) they part and drift off the frame.
const BILLOWS = (() => {
  const out = [];
  const cols = 7, rows = 4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    const x = -60 + ((c + 0.5 + (r % 2 ? 0.28 : -0.1)) * 2040) / cols + (hash01(i, 301) - 0.5) * 110;
    const y = -50 + ((r + 0.5) * 1180) / rows + (hash01(i, 302) - 0.5) * 80;
    const lobes = [];
    const nl = 4;
    for (let k = 0; k < nl; k++) {
      const a = (k / nl) * TAU + hash01(i * 7 + k, 305) * 0.9 - 0.4;
      lobes.push([Math.cos(a) * 0.5, Math.sin(a) * 0.42, 0.55 + 0.17 * hash01(i * 7 + k, 306)]);
    }
    lobes.push([0, 0, 0.8]);
    out.push({ i, x, y, r: 212 + 62 * hash01(i, 303), lobes });
  }
  return out;
})();
const SMOKE_C = [540, 650]; // s02 reveal centre (the characters in s02's wide), the smoke parts away from here
(() => {
  const E = SMOKE_E;
  let dmax = 1;
  for (const b of BILLOWS) { b.d = Math.hypot(b.x - E[0], b.y - E[1]); dmax = Math.max(dmax, b.d); }
  let cmax = 1;
  for (const b of BILLOWS) {
    // the smoke hugs the ground: low billows race out (and swallow Juno & Biscuit) first
    const low = smoothstep(420, 760, b.y);
    b.te = T_BOOM + 0.05 + 0.48 * Math.pow(b.d / dmax, 0.9) * lerp(1, 0.4, low) + 0.05 * hash01(b.i, 311);
    b.travel = lerp(0.75, 0.4, low);
    const dx = b.x - SMOKE_C[0], dy = b.y - SMOKE_C[1], l = Math.hypot(dx, dy) || 1;
    b.dir = [dx / l, dy / l]; b.dc = l; cmax = Math.max(cmax, l);
  }
  for (const b of BILLOWS) b.tc = T_CUT + 0.25 * (b.dc / cmax) + 0.05 * hash01(b.i, 312);
  BILLOWS.sort((a, b) => a.te - b.te);
})();
function smokeColors(t) {
  const k = smoothstep(T_BOOM + 0.3, T_CUT + 0.1, t);
  const fill = mixColor('#8a7f96', '#d3cbdc', k);
  return { fill, shade: mixColor(fill, '#4b4458', 0.42), hi: mixColor(fill, '#ffffff', 0.4) };
}
// coverage of the flat haze behind the billows (hides gaps; 1 across the cut)
export function smokeCover(t) {
  if (t < T_BOOM + 0.2) return 0;
  if (t < T_CUT) return smoothstep(T_BOOM + 0.2, T_BOOM + 0.64, t);
  return 1 - smoothstep(T_CUT + 0.1, T_CUT + 0.42, t); // opaque until the billows open gaps
}
const SMOKE_LW = LW * 1.25;
// where every billow is at time t (screen space); null = not born / gone / off frame
function billowStates(t) {
  const E = SMOKE_E;
  const out = [];
  for (const b of BILLOWS) {
    if (t < b.te) continue;
    const k = clamp((t - b.te) / b.travel);
    const e = ease.outCubic(k);
    let x = lerp(E[0] + (b.x - E[0]) * 0.1, b.x, e), y = lerp(E[1] + (b.y - E[1]) * 0.1, b.y, e);
    let r = b.r * lerp(0.3, 1, ease.outBack(k, 1.4));
    // boil
    const age = t - b.te;
    x += 18 * noise1(t * 0.7 + b.i * 1.3, b.i * 3 + 1);
    y += 14 * noise1(t * 0.6 + b.i * 1.7, b.i * 3 + 2) - 10 * age;
    r *= 1 + 0.035 * sway(t, 4 + (b.i % 3)) + 0.03 * noise1(t * 0.9, b.i * 3 + 3);
    let alpha = 1;
    if (t > b.tc) { // part and drift off (s02)
      const u = t - b.tc;
      const d = 1500 * ease.inQuad(clamp(u / 0.75)) + 420 * u;
      x += b.dir[0] * d; y += b.dir[1] * d * 0.8 - 80 * u;
      r *= lerp(1, 0.75, clamp(u / 0.9));
      alpha = 1 - smoothstep(0.55, 1.1, u);
      if (alpha <= 0) continue;
    }
    if (x + r * 1.3 < 0 || x - r * 1.3 > W || y + r * 1.3 < 0 || y - r * 1.3 > H) continue;
    out.push({ b, x, y, r, alpha, circ: b.lobes.map(([lx, ly, lr]) => [x + lx * r, y + ly * r, lr * r]) });
  }
  return out;
}
export function smokeWall(ctx, t) {
  if (t < T_BOOM + 0.05 || t > T_CUT + 1.6) return;
  const col = smokeColors(t);
  const cover = smokeCover(t);
  ctx.save();
  if (cover > 0) { ctx.fillStyle = rgba(col.shade, cover); ctx.fillRect(0, 0, W, H); }
  const S = billowStates(t);
  const lw = SMOKE_LW;
  for (let i = 0; i < S.length; i++) {
    const { x, y, r, alpha, circ, b } = S[i];
    // 3 single-path fills per billow (a union path rasterises each pixel once — and in Skia a
    // union fill is ~4x cheaper than stroking the circles): ink rim, shade, then the lit body
    // pulled up-left, leaving a shade crescent on the lower right
    const lobes = (grow, k, ox, oy) => {
      ctx.beginPath();
      for (const [cx0, cy0, lr] of circ) {
        const cx = cx0 + ox * lr, cy = cy0 + oy * lr, rr = Math.max(1, lr * k + grow);
        ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, TAU);
      }
    };
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    lobes(lw / 2, 1, 0, 0); ctx.fillStyle = INK; ctx.fill();
    lobes(-lw / 2, 1, 0, 0); ctx.fillStyle = col.shade; ctx.fill();
    lobes(0, 0.8, -0.1, -0.13); ctx.fillStyle = col.fill; ctx.fill();
    const top = b.lobes[0];
    const hx = x + top[0] * r, hy = y + top[1] * r, hr = top[2] * r;
    ctx.fillStyle = rgba(col.hi, 0.7);
    ctx.beginPath(); ctx.ellipse(hx - hr * 0.3, hy - hr * 0.45, hr * 0.3, hr * 0.14, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ debris (world space)
// Launched from the blast with air drag (terminal fall speed): up and out of the top of frame,
// then they rain back down through the smoke between ~5.8 and 7.35 (last one leaves at the cut).
const DEBRIS = [
  { kind: 'can', vx: 260, vy: -1900, k: 2.6, vt: 1070, spin: 2.2, sc: 2.1, ch: 0.45 },
  { kind: 'fin', vx: -1650, vy: -2500, k: 2.4, vt: 1060, spin: -6.5, sc: 2.2, ch: 0.25, flutter: 1 },
  { kind: 'fin', vx: 1500, vy: -2700, k: 2.4, vt: 880, spin: 7.5, sc: 2.2, ch: 0.2, flutter: 1 },
  { kind: 'tape', vx: -700, vy: -3000, k: 2.5, vt: 1020, spin: 8, sc: 3, ch: 0.1 },
  { kind: 'lid', vx: 900, vy: -3100, k: 2.5, vt: 990, spin: -3.5, sc: 2.1, ch: 0.35, flutter: 0.5 },
  { kind: 'hoop', vx: -200, vy: -3300, k: 2.4, vt: 960, spin: 4, sc: 2.1, ch: 0.2 },
  { kind: 'bolt', vx: -1100, vy: -2200, k: 2.2, vt: 1210, spin: 14, sc: 3.4, ch: 0 },
  { kind: 'bolt', vx: 700, vy: -2400, k: 2.2, vt: 1040, spin: -12, sc: 3.4, ch: 0 },
  { kind: 'bolt', vx: 250, vy: -3000, k: 2.3, vt: 1010, spin: 16, sc: 3, ch: 0 },
  { kind: 'bolt', vx: -450, vy: -2800, k: 2.3, vt: 870, spin: -15, sc: 3, ch: 0 },
];
function dragPos(v0, vt, k, dt) { return vt * dt + ((v0 - vt) * (1 - Math.exp(-k * dt))) / k; }
function drawDebris(ctx, t, noCone = false) {
  const dt = t - T_BOOM;
  if (dt <= 0) return;
  const c = camBase(t);
  const vy0 = c.y - 620 / c.zoom, vy1 = c.y + 620 / c.zoom; // visible world rows (+ margin)
  DEBRIS.forEach((d, i) => {
    // each piece starts spread along its own flight direction (inside the fireball, which is
    // drawn over it) so the first frames never show a clump of junk
    const sp = 90 / Math.hypot(d.vx, d.vy);
    const x = BOOM_WORLD[0] + d.vx * sp + dragPos(d.vx, 0, d.k, dt) + (d.flutter ? d.flutter * 40 * Math.sin(dt * 5 + i) * clamp(dt - 0.8) : 0);
    const y = BOOM_WORLD[1] + d.vy * sp + dragPos(d.vy, d.vt, d.k, dt);
    const rot = hash01(i, 91) * TAU + d.spin * (1 - Math.exp(-1.2 * dt)) / 1.2 + d.spin * 0.25 * dt;
    // grow a touch as they tumble toward camera
    const sc = S * d.sc * (1 + 0.25 * clamp(dt / 2));
    if (y < vy0 - 120 * sc || y > vy1 + 120 * sc) return; // off frame
    drawTestDebris(ctx, d.kind, x, y, sc, { rot, charred: d.ch, t, light: LIGHT });
  });
  // the traffic-cone nose: straight up and out of sight (it comes back in s02)
  if (noCone) return;
  const cx = BOOM_WORLD[0] + dragPos(120, 0, 1.2, dt);
  const cy = BOOM_WORLD[1] - 60 + dragPos(-3600, 600, 1.1, dt);
  if (cy > -900) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(0.3 + dt * 9);
    ctx.scale(S * 1.35, S * 1.35);
    trafficCone(ctx, { charred: 0.5, t });
    ctx.restore();
  }
}
// Debris still falling across the smoke-wall cut: s02 draws it over the shared smoke for a moment,
// in s01's camera space (the smoke is screen space, so the hand-over is seamless).
export function drawFallout(ctx, t) {
  if (t < T_CUT || t > T_CUT + 0.8) return;
  const c = cam(t);
  camera(ctx, c, () => drawDebris(ctx, t, true));
}
// "ting!" twinkle where the cone left the frame
function drawTing(ctx, t) {
  const lt = t - T_TING;
  if (lt < -0.03 || lt > 0.7) return;
  const c = cam(t);
  const x = toScreen(c, [BOOM_WORLD[0] + dragPos(120, 0, 1.2, 1.2), 0])[0];
  const y = 70;
  const k = lt < 0 ? 0.4 : ease.outBack(clamp(lt / 0.1), 3) * (1 - clamp((lt - 0.35) / 0.35));
  ctx.save();
  glow(ctx, x, y, 110 * k, '#fff6c0', 0.8);
  sparkle(ctx, x, y, 70 * k, '#ffffff', 1);
  sparkle(ctx, x, y, 30 * k, '#fff2a0', 1);
  ctx.restore();
}

// ------------------------------------------------------------------ radio waves from the remote
function drawWaves(ctx, t, cap) {
  const lt = t - T_PRESS;
  if (lt < 0 || lt > 0.55 || !cap.x) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const u = clamp((lt - i * 0.07) / 0.35);
    if (u <= 0 || u >= 1) continue;
    const r = (14 + 90 * u) * cap.sx * 1.4;
    ctx.globalAlpha = 1 - u;
    ctx.beginPath(); ctx.arc(cap.x, cap.y, r, -0.9, 0.5);
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff3a0'; ctx.stroke();
  }
  ctx.restore();
}

// goggle-snap accent lines
function drawSnap(ctx, t, c) {
  const lt = t - T_GOGGLES;
  if (lt < 0 || lt > 0.3) return;
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(t));
  const [x, y] = toScreen(c, [(A.eyeL[0] + A.eyeR[0]) / 2, (A.eyeL[1] + A.eyeR[1]) / 2]);
  const u = lt / 0.3;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - u;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    const r0 = 70 + 50 * u, r1 = r0 + 34;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff6c8'; ctx.stroke();
  }
  sparkle(ctx, x + 22, y - 12, 34 * (1 - u), '#ffffff', 1);
  ctx.restore();
}

// ------------------------------------------------------------------ scene
export default {
  id: 's01_test_launch',
  start: 0,
  end: 7.335,
  transition: { type: 'cut' },
  draw(ctx, t) {
    t = clamp(t, 0, T_CUT - 1e-4);
    if (t >= T_BOOM && t < T_BOOM + FRAME) { drawImpactFrame(ctx, t); return; }
    const c = cam(t);
    const boomed = t >= T_BOOM;
    const db = t - T_BOOM;
    const cap = {};
    // ---- world (skipped once the smoke wall is opaque — nothing behind it shows)
    const hidden = smokeCover(t) >= 0.999;
    if (!hidden) camera(ctx, c, () => {
      drawBackyard(ctx, {
        t, tod: 'golden', camX: c.x, camY: c.y,
        pad: boomed ? 'wrecked' : 'intact', crater: boomed, craterSmoke: 0, embers: 0, // (hidden by the fireball anyway)
        birdsFly: boomed ? clamp(db / 1.4) : 0,
        fenceFlap: boomed ? clamp(1.2 * Math.exp(-db * 1.8)) : 0,
        wind: boomed ? clamp(Math.exp(-db * 1.5)) : 0,
      });
      if (t < T_BOOM + 0.36) { // swallowed by the smoke after this
        longShadow(ctx, JUNO[0], JUNO[1] - 6, 70, 210, { tod: 'golden', camX: c.x, camY: c.y });
        longShadow(ctx, DOG[0], DOG[1] - 6, 70, 100, { tod: 'golden', camX: c.x, camY: c.y });
        drawDog(ctx, DOG[0], DOG[1], S, dogPose(t));
        drawGirl(ctx, JUNO[0], JUNO[1], S, junoPose(t, cap));
      }
      if (!boomed) drawRocketLive(ctx, t);
    });
    if (!boomed) {
      drawSnap(ctx, t, c);
      drawWaves(ctx, t, cap);
      drawCountdown(ctx, t);
      return;
    }
    // ---- KA-BOOM
    const E = toScreen(c, BOOM_WORLD);
    smokeWall(ctx, t);
    camera(ctx, c, () => {
      // debris first: it bursts OUT of the fireball instead of sitting on top of it
      drawDebris(ctx, t);
      fireball(ctx, BOOM_WORLD[0], BOOM_WORLD[1] + 30, 470, db, 3, 0.75);
      // two echo pops on the following 16ths
      fireball(ctx, BOOM_WORLD[0] - 330, BOOM_WORLD[1] + 120, 200, db - 0.15, 7, 0.5);
      fireball(ctx, BOOM_WORLD[0] + 310, BOOM_WORLD[1] - 110, 180, db - 0.3, 11, 0.45);
    });
    drawShock(ctx, t, E);
    // white flash
    const fl = 0.8 * Math.exp(-(db - FRAME) * 11);
    if (fl > 0.01) { ctx.fillStyle = rgba('#fffdf2', clamp(fl)); ctx.fillRect(0, 0, W, H); }
    drawKaboom(ctx, t);
    drawTing(ctx, t);
  },
};
