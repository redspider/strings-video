// s14_comet_chase — bars 32–36 (76.94 → 88.94), the loudest section of the song.
// One shot per bar, hard cuts / a whip between shots, speed streaks, shake on kicks.
//
//   A  bar 32  76.94  blast-off from the lavender moon after the comet
//                     76.94 ignition + dust ring · 77.54 pitch toward the comet · 78.14 afterburner: the rocket
//                     surges in frame & closes the gap · 78.74 the comet jinks, the rocket banks after it · push-in
//   B  bar 33  79.34  cockpit: Juno's determined grin on the joystick, Biscuit g-force flapping,
//                     stick yanks + cabin banks on every beat, an asteroid looms in the window on 81.14
//   C  bar 34  81.74  asteroid field: the rocket swerves ON every beat (81.74, 82.34, 82.94, 83.54),
//                     near-miss rocks pass exactly on the beat (swoosh arcs trace each dodge), foreground rocks
//                     whoosh past camera, barrel roll through the 83.54 gate
//   D  bar 35  84.14  loop-the-loop round a big asteroid, leaving a sparkly star trail
//                     (stars pop on every half beat; 85.34 upside-down at the top: "WHEEE!")
//   E  bar 36  86.54  hatch bursts open, Juno winds up the butterfly net… 87.14 CATCH!
//                     push-in: it's a baby star · 87.74 sparkle burst, it pops out · 88.34 wink + hearts
import { W, H, INK, LW, PAL, camera, glow, sparkle, streaks, speedLines, smokePuff, circlePath, ellipsePath, cartoonText, ink } from '../draw.js';
import { TAU, clamp, lerp, ease, keyframes, spring, wobble, hash01, noise1, rgba, fract } from '../util.js';
import { barTime, beatAt, pulse, kick, hat, hop, sway, SPB } from '../timing.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';
import { drawRocket } from '../props/rockets.js';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../props/cockpit.js';
import { spaceBg, drawEarth, drawMoonSurface, moonSurfaceY, moonSurfaceAngle, drawComet, drawAsteroid, drawBabyStar } from '../props/space.js';
import { net as drawNet, flag as drawFlag } from '../props/items.js';

// ---------------------------------------------------------------- beat grid
const T_A = barTime(32); //        76.94  ignition (downbeat)
const A_TILT = barTime(32, 1); //  77.54  pitch toward the comet (snare)
const A_BOOST = barTime(32, 2); // 78.14  afterburner kick
const A_GONE = barTime(32, 3); //  78.74  (snare) rocket leaves frame
const T_B = barTime(33); //        79.34  cockpit
const B_BEATS = [0, 1, 2, 3].map((b) => barTime(33, b)); // stick yanks
const T_C = barTime(34); //        81.74  asteroid field
const C_SW = [0, 1, 2, 3].map((b) => barTime(34, b)); // 81.74 82.34 82.94 83.54 — swerves
const T_D = barTime(35); //        84.14  loop-the-loop
const D_LOOP0 = barTime(35, 1); // 84.74  loop starts (bottom)
const D_TOP = barTime(35, 2); //   85.34  upside-down at the top (snare)
const D_LOOP1 = barTime(35, 3); // 85.94  loop closes
const T_E = barTime(36); //        86.54  hatch
const E_SWING = barTime(36, 1) - 0.07; // swing starts (anticipation ends)
const E_CATCH = barTime(36, 1); // 87.14  CATCH
const E_BURST = barTime(36, 2); // 87.74  sparkle burst, star pops out
const E_WINK = barTime(36, 3); //  88.34  wink
const T_END = barTime(37); //      88.94

const HUE = 'magenta';
const LEAD = 1 / 60;

// ---------------------------------------------------------------- helpers
// Kick-driven camera jitter (tempo-locked: only exists right after a kick)
function kickShake(t, amp, seed = 1) {
  const k = kick(t, 11) * amp;
  return { dx: k * noise1(t * 37, seed), dy: k * noise1(t * 41, seed + 7), rot: k * 0.0006 * noise1(t * 29, seed + 3) };
}
// Draw the S.S. Biscuit by its CENTRE (cx, cy), rotated by rot (0 = nose up, π/2 = nose right),
// with squash/stretch along its own axis (stretch > 1 = longer & thinner) and an optional roll (cos-squeeze).
function rocketAt(ctx, cx, cy, s, rot, o = {}, stretch = 1, roll = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const sx = roll / Math.sqrt(stretch);
  if (sx !== 1 || stretch !== 1) ctx.scale(Math.abs(sx) < 0.02 ? 0.02 * Math.sign(sx || 1) : sx, stretch);
  drawRocket(ctx, 0, 360 * s, s, o);
  ctx.restore();
}
// rotate a vector
const rotV = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
function heartPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.3, y + r * 0.05, x - r * 0.95, y - r * 1.05, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.95, y - r * 1.05, x + r * 1.3, y + r * 0.05, x, y + r * 0.9);
  ctx.closePath();
}
// 5-point sparkle star with ink (tiny cartoon star)
function popStar(ctx, x, y, r, rot, fill = PAL.yellow, a = 1) {
  if (r <= 0.5 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r;
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ink(ctx, fill, Math.max(2, r * 0.16));
  ctx.restore();
}
// burst lines radiating from (x, y) — impact accent. u 0..1 lifetime
function burstLines(ctx, x, y, r0, r1, u, n = 14, color = '#ffffff', lw = 8, seed = 3) {
  if (u <= 0 || u >= 1) return;
  const e = ease.outCubic(u);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.globalAlpha *= 1 - ease.inQuad(u);
  ctx.lineWidth = lw * (1 - u * 0.6);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash01(i, seed) * 0.3;
    const k = 0.75 + 0.5 * hash01(i, seed + 1);
    const a0 = lerp(r0, r1 * k, e * 0.55), a1 = lerp(r0 * 1.2, r1 * k, e);
    ctx.moveTo(x + Math.cos(a) * a0, y + Math.sin(a) * a0);
    ctx.lineTo(x + Math.cos(a) * a1, y + Math.sin(a) * a1);
  }
  ctx.stroke();
  ctx.restore();
}

// =====================================================================================
// SHOT A — bar 32: blast-off from the moon after the comet
// =====================================================================================
// World = s13's moon frame, so the flash cut from s13 is a MATCH CUT: same camera (1265, 555, zoom 1.13),
// same rocket (feet at x 1470 on the curve-0.42 moon, tilted with the slope, s 0.84), same planted flag.
const A_S = 0.84;
const A_CURVE = 0.42;
const A_X0 = 1470;
const A_G = moonSurfaceY(A_X0, { curve: A_CURVE });
const A_SLOPE = moonSurfaceAngle(A_X0, { curve: A_CURVE });
const A_CAM0 = { x: 1265, y: 555, zoom: 1.13 };
const A_FX = 735; // s13's planted paw-print flag
const A_FS = 0.42 * 1.2;
// the flight track (feet point, no rotation offset, no jink)
function aTrack(t) {
  const lt = t - T_A;
  let dx = 0, dy = 0;
  if (lt > 0) {
    // 0 → 0.6: heavy lift-off (slow then accelerating); 0.6 → 1.2 climbing; 1.2+: afterburner
    dy = -230 * ease.inQuad(clamp(lt / 0.6));
    if (lt > 0.6) {
      const tl = Math.min(lt, 1.2) - 0.6;
      dy = -230 - 800 * tl - 280 * tl * tl;
      dx = 110 * ease.inOutSine(tl / 0.6);
    }
    if (lt > 1.2) {
      const tau = lt - 1.2;
      const d = 1150 * tau + 2300 * tau * tau;
      const [hx, hy] = aHeading();
      dx += hx * d;
      dy += hy * d;
    }
  }
  return [A_X0 + dx, A_G + dy];
}
// 78.74 (snare): the comet JINKS sideways (right of the flight line) — extreme ON the beat — and the
// rocket banks after it a beat-fraction later
const A_JINK = 170;
const A_PERP = [Math.cos(0.68), Math.sin(0.68)]; // right of the flight line
const aJinkC = (t) => A_JINK * swerveP(t - A_GONE);
const aJinkR = (t) => A_JINK * swerveP(t - A_GONE - 0.1);
function aRocket(t) {
  const [fx, fy] = aTrack(t);
  const j = aJinkR(t);
  const rot = aRot(t);
  // centre = feet − R(rot)·(0, 360·s): the rocket stands on (and first pivots about) its feet
  const [ox, oy] = rotV(0, -360 * A_S, rot);
  return { x: fx + ox + A_PERP[0] * j, y: fy + oy + A_PERP[1] * j, rot };
}
// stands on the slope → straightens as it lifts → pitches toward the comet on the snare (after a tiny
// counter-lean = anticipation) → banks harder on 78.74
function aRot(t) {
  return keyframes(t, [[T_A, A_SLOPE], [T_A + 0.45, 0.02, ease.inOutSine], [A_TILT - 0.1, 0], [A_TILT - 0.03, -0.07, ease.outQuad],
    [A_TILT + 0.28, 0.62, ease.outBack], [A_GONE - 0.04, 0.6], [A_GONE + 0.22, 0.78, ease.outBack]]);
}
// flight direction after the afterburner (fixed so the path is a clean straight dash)
function aHeading() { return [Math.sin(0.68), -Math.cos(0.68)]; }
function aCam(t) {
  // opens on s13's final framing, then pulls back and tracks the chase: a point between the rocket and
  // the comet (weighted to the rocket, ~0.03 s behind) so both stay in frame while the moon falls away
  const tl = Math.max(T_A, t - 0.03);
  const r = aRocket(tl), m = aComet(tl);
  let tx = 0.62 * r.x + 0.38 * m.x + 40, ty = 0.62 * r.y + 0.38 * m.y + 30;
  // afterburner: the camera can't keep up for a moment — the rocket SURGES forward in frame toward the
  // comet — then the camera catches up
  const tau = t - A_BOOST;
  if (tau > 0) {
    const lag = 300 * ease.outCubic(clamp(tau / 0.22)) * (1 - ease.inOutSine(clamp((tau - 0.3) / 0.8)));
    const [hx, hy] = aHeading();
    tx -= hx * lag; ty -= hy * lag;
  }
  const k = keyframes(t, [[T_A + 0.05, 0], [A_BOOST + 0.2, 1, ease.inOutSine]]);
  // pull back for the lift-off, then push in as the rocket closes on the comet; zoom punches on 78.14 / 78.74
  const punch = (t0, a) => (t > t0 ? a * Math.exp(-7 * (t - t0)) * clamp((t - t0) / 0.04) : 0);
  const zoom = keyframes(t, [[T_A + 0.1, A_CAM0.zoom], [A_BOOST, 0.84, ease.inOutSine], [T_B, 1.0, ease.inOutSine]]) +
    punch(A_BOOST, 0.07) + punch(A_GONE, 0.04);
  return { x: lerp(A_CAM0.x, tx, k), y: lerp(A_CAM0.y, ty, k), zoom };
}
// the comet before the afterburner (its own arc), from the boost on it is defined relative to the rocket's
// track: the afterburner closes the gap (front-loaded), and it jinks on 78.74
function aComet0(t) {
  const l1 = clamp(t - T_A, 0, 1.2);
  return [1990 + 200 * l1, 250 - 250 * l1 - 380 * l1 * l1];
}
const A_OFF0 = (() => { const c = aComet0(A_BOOST), f = aTrack(A_BOOST); return [c[0] - f[0], c[1] - f[1]]; })();
function aComet(t) {
  const lt = Math.max(0, t - T_A);
  const tau = Math.max(0, lt - 1.2);
  if (tau <= 0) { const [x, y] = aComet0(t); return { x, y, a: -0.42, curve: 0 }; }
  const [fx, fy] = aTrack(t);
  const g = 1 - 0.2 * ease.outCubic(clamp(tau / 0.9)); // gap 640 → ~510 (nose right on its tail)
  const j = aJinkC(t);
  const vj = (aJinkC(t + 0.01) - aJinkC(t - 0.01)) / 0.02; // lateral speed (px/s) — bends the tail
  const vf = 1150 + 4600 * tau;
  return {
    x: fx + A_OFF0[0] * g + A_PERP[0] * j,
    y: fy + A_OFF0[1] * g + A_PERP[1] * j,
    a: -0.42 - 0.35 * clamp(tau / 0.5) + 0.8 * Math.atan2(vj, vf),
    curve: clamp(vj * 0.06, -160, 160),
  };
}
// s13's far-sky layer (Earth): moves a quarter as much, zooms a third as much — same transform as s13
function aSky(ctx, cam, dx, dy, fn) {
  const z = Math.pow(cam.zoom, 0.33);
  ctx.save();
  ctx.translate(W / 2 + dx * 0.4, H / 2 + dy * 0.4);
  ctx.scale(z, z);
  ctx.translate(-(W / 2 + (cam.x - W / 2) * 0.25), -(H / 2 + (cam.y - H / 2) * 0.25));
  fn();
  ctx.restore();
}
function shotA(ctx, t) {
  const lt = Math.max(0, t - T_A);
  const tt = Math.max(t, T_A);
  const cam = aCam(tt);
  const R = aRocket(tt);
  // shake: big on ignition, again on the afterburner, plus kicks
  const s1 = shakeAt(tt, T_A, 26, 4.5), s2 = shakeAt(tt, A_BOOST, 18, 5), s3 = shakeAt(tt, A_GONE, 9, 7), ks = kickShake(tt, 7, 2);
  const dx = s1.dx + s2.dx + s3.dx + ks.dx, dy = s1.dy + s2.dy + s3.dy + ks.dy;
  spaceBg(ctx, { t: tt, seed: 2, hue: 'violet', stars: 260, driftX: (cam.x - 960) * 0.3, driftY: (cam.y - 540) * 0.3 });
  // s13's Earth (match cut): far parallax, it sinks away as we climb
  aSky(ctx, cam, dx, dy, () => drawEarth(ctx, 330, 232, 62, { t: tt, rot: 0.9 + (tt - 69.74) * 0.04 }));
  // speed streaks after the afterburner (streaming opposite to the flight)
  const streakA = keyframes(tt, [[A_BOOST - 0.05, 0], [A_BOOST + 0.25, 0.5], [T_B, 0.55]]);
  if (streakA > 0) streaks(ctx, tt, { angle: 0.68 + Math.PI / 2, count: 34, speed: 3600, alpha: streakA, seed: 21, lw: 4, len: 320 });
  camera(ctx, { x: cam.x, y: cam.y, zoom: cam.zoom, dx, dy, rot: s1.rot }, () => {
    // comet high up-right, fleeing (already on screen in s13's last frame — no fade-in)
    const cm = aComet(tt);
    drawComet(ctx, cm.x, cm.y, cm.a, 820, { t: tt, size: 38, seed: 5, curve: cm.curve });
    // moon ground (same surface as s13; falls away as the camera tilts up)
    drawMoonSurface(ctx, { t: tt, curve: A_CURVE, seed: 11, dust: 1 });
    // s13's planted flag, whipped and bent by the blast
    const blast = lt > 0 ? Math.exp(-1.2 * lt) * clamp(lt / 0.12) : 0;
    ctx.save();
    ctx.translate(A_FX, moonSurfaceY(A_FX, { curve: A_CURVE }) - (124 - 20) * A_FS);
    ctx.translate(0, 124 * A_FS); ctx.rotate(moonSurfaceAngle(A_FX, { curve: A_CURVE }) - 0.32 * blast + 0.08 * wobble(tt, T_A + 0.9, 2.5, 3)); ctx.translate(0, -124 * A_FS);
    ctx.scale(-A_FS, A_FS);
    drawFlag(ctx, { t: tt, wave: 1 + 1.4 * blast });
    ctx.restore();
    // exhaust puffs left behind along the flight path
    aExhaust(ctx, tt);
    // the rocket
    const legs = 1 - ease.inOutCubic(clamp((lt - 0.05) / 0.4));
    const stretch = t < T_A ? 1 : 1 - 0.16 * wobble(tt, T_A, 3, 5) + 0.08 * clamp(lt / 0.4) +
      0.1 * (tt > A_BOOST ? Math.exp(-4 * (tt - A_BOOST)) : 0) - 0.14 * Math.exp(-30 * lt);
    const flame = t < T_A ? 0 : 1.05 + 0.4 * Math.exp(-6 * lt) + (tt > A_BOOST ? 0.6 * (1 - Math.exp(-8 * (tt - A_BOOST))) : 0);
    if (t >= T_A) { const [gx, gy2] = rotV(0, 380 * A_S, R.rot); glow(ctx, R.x + gx, R.y + gy2, 360 + 80 * kick(tt), '#ffcf6b', 0.35); }
    // afterburner shock ring at the nozzle (78.14)
    const bu = (tt - A_BOOST) / 0.35;
    if (bu > 0 && bu < 1) {
      const [nx, ny] = rotV(0, 400 * A_S, R.rot);
      ctx.save();
      ctx.translate(R.x + nx, R.y + ny); ctx.rotate(R.rot);
      ctx.globalAlpha = 1 - bu; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 16 * (1 - bu) + 3;
      ellipsePath(ctx, 0, 0, 90 + 280 * ease.outCubic(bu), 32 + 100 * ease.outCubic(bu)); ctx.stroke();
      ctx.restore();
      glow(ctx, R.x + nx, R.y + ny, 380 * (1 - bu * 0.5), '#fff0a0', 0.6 * (1 - bu));
    }
    rocketAt(ctx, R.x, R.y, A_S, R.rot, { t: tt, flame, legs, crew: true, shake: 0.35 + 0.4 * kick(tt),
      crewPose: { girl: { expr: 'determined' }, dog: { expr: 'excited' } } }, stretch);
    // ignition dust ring rolling along the ground + burst lines on the downbeat
    aDust(ctx, tt);
    burstLines(ctx, A_X0, A_G - 60, 140, 760, (tt - T_A) / 0.45, 16, '#fff6d8', 12, 5);
  });
}
function shakeAt(t, t0, amp, decay) {
  if (t < t0) return { dx: 0, dy: 0, rot: 0 };
  const k = amp * Math.exp(-decay * (t - t0));
  return { dx: k * noise1((t - t0) * 23, 11), dy: k * noise1((t - t0) * 23, 29), rot: (k / 2000) * noise1((t - t0) * 23, 47) };
}
function aExhaust(ctx, t) {
  if (t <= T_A + 0.05) return;
  // lift-off smoke: puffs left hanging above the pad (before the afterburner)
  for (let i = 0; i < 9; i++) {
    const tb = T_A + 0.05 + i * 0.13; // spawn time
    if (tb > t || tb > A_BOOST) break;
    const age = t - tb, u = age / (1.1 + 0.4 * hash01(i, 71));
    if (u >= 1) continue;
    const r = aRocket(tb);
    const [ox, oy] = rotV(0, 390 * A_S, r.rot);
    const x = r.x + ox + (hash01(i, 72) - 0.5) * 60, y = r.y + oy + 30 + age * 40;
    smokePuff(ctx, x, y, 66 + 56 * hash01(i, 73) + age * 70, { seed: 80 + i, u: clamp(0.1 + u * 0.9), fill: '#efe8ff', shadeCol: '#c3b6ea', lw: 5, n: 5 });
  }
  // afterburner: a glittering trail of sparkles strung out behind the nozzle
  if (t > A_BOOST) {
    for (let i = 0; i < 26; i++) {
      const tb = A_BOOST + i * 0.045;
      if (tb > t) break;
      const age = t - tb;
      if (age > 0.7) continue;
      const r = aRocket(tb);
      const [ox, oy] = rotV((hash01(i, 74) - 0.5) * 70, 420 * A_S, r.rot);
      const a = 1 - age / 0.7;
      const x = r.x + ox, y = r.y + oy;
      glow(ctx, x, y, 44 * a + 10, '#ffcf6b', 0.35 * a);
      sparkle(ctx, x, y, (12 + 14 * hash01(i, 75)) * a, i % 3 ? '#ffffff' : '#fff2a8', a);
    }
  }
}
function aDust(ctx, t) {
  const lt = t - T_A;
  if (lt <= 0 || lt > 2.2) return;
  for (let i = 0; i < 11; i++) {
    const side = i % 2 ? 1 : -1;
    const h = hash01(i, 41);
    const u = clamp(lt / (1.3 + 0.6 * hash01(i, 42)));
    if (u >= 1) continue;
    const d = (100 + 820 * h) * ease.outCubic(clamp(lt / 0.9));
    const x = A_X0 + side * d;
    const y = moonSurfaceY(x, { curve: A_CURVE }) - 26 - 70 * hash01(i, 43) * u;
    smokePuff(ctx, x, y, (68 + 78 * hash01(i, 44)) * (0.7 + 0.6 * u), { seed: 20 + i, u: clamp(0.08 + u), fill: '#e8e0ff', shadeCol: '#b3a3e0', lw: 5, n: 5 });
  }
  // flat shock ring on the ground
  const u = clamp(lt / 0.5);
  if (u < 1) {
    ctx.save();
    ctx.globalAlpha = 0.8 * (1 - u);
    ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 12 * (1 - u) + 2;
    ellipsePath(ctx, A_X0, A_G + 6, 110 + 1000 * ease.outCubic(u), 24 + 80 * ease.outCubic(u));
    ctx.stroke();
    ctx.restore();
  }
}

// =====================================================================================
// SHOT B — bar 33: cockpit close-up
// =====================================================================================
const B_STICK = [-0.4, 0.6, -0.35, 1]; // stick yanked on every beat (left throw limited: her arm can't reach further)
// Juno's joystick arm {a, b} solved with girlAnchors so the fist stays on the knob for each stick tilt
const JOY_ARM = [[-0.4, 1.385, -0.16], [-0.2, 1.65, -0.71], [0, 1.82, -1.08], [0.25, 1.9, -1.37], [0.5, 1.93, -1.59], [0.75, 1.92, -1.76], [1, 1.88, -1.9]];
function joyArm(st) {
  st = clamp(st, -0.4, 1);
  let i = 0;
  while (i < JOY_ARM.length - 2 && st > JOY_ARM[i + 1][0]) i++;
  const [s0, a0, b0] = JOY_ARM[i], [s1, a1, b1] = JOY_ARM[i + 1];
  const u = clamp((st - s0) / (s1 - s0));
  return { a: lerp(a0, a1, u), b: lerp(b0, b1, u), hand: 'fist' };
}
function bStick(t) {
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const d = t - B_BEATS[k];
    if (d < -0.05) break;
    const prev = k ? B_STICK[k - 1] : 0;
    s = lerp(prev, B_STICK[k], ease.outBack(clamp((d + 0.05) / 0.2), 2.4));
  }
  return s;
}
function bWindow(t) {
  return (ctx, cx, cy, r) => {
    const st = bStick(t);
    ctx.fillStyle = '#1a0a2e'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    glow(ctx, cx, cy + r * 0.8, r * 1.3, '#d6399a', 0.35);
    // warp: stars streaming outward from the vanishing point
    const vx = cx - st * 40, vy = cy - 20;
    speedLines(ctx, vx, vy, t, { count: 44, inner: 20, outer: r * 1.3, color: '#ffffff', alpha: 0.8, seed: 33, lw: 3.5 });
    // the comet ahead (tail streaming back toward us), sways as we bank
    const kx = vx + 30 + 26 * Math.sin(TAU * beatAt(t) / 4) - st * 70, ky = vy - 40 + 14 * sway(t, 2);
    miniComet(ctx, kx, ky, -Math.PI / 2 - 0.5 + st * 0.3, 200, 20, t);
    // an asteroid looms on beat 4 (81.14) → next shot
    const u = clamp((t - B_BEATS[3] + 0.05) / 0.62);
    if (u > 0) {
      // rushes at the glass from the vanishing point: by the cut it fills the window
      const e = ease.inCubic(u);
      const ar = 10 + 300 * e;
      glow(ctx, vx + 90 * e, vy + 30 * e, ar * 1.6, '#ff7eb6', 0.25 * u);
      drawAsteroid(ctx, vx + 40 + 90 * e, vy + 10 + 60 * e, ar, { seed: 6, rot: t * 2, lw: clamp(ar * 0.05, 2, 8) });
    }
  };
}
// Lightweight comet for inside the cockpit window (drawComet's ~60 gradient fills are very slow under
// the window's circular clip). Head at (x, y) moving along ang; tail len px.
function miniComet(ctx, x, y, ang, len, size, t) {
  const b = beatAt(t);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang + Math.PI); // tail along +x
  for (const [w, L, c0, a0] of [[2.6, 1, '#8fd3ff', 0.35], [1.4, 0.75, '#ffe27a', 0.6], [0.55, 0.5, '#fffbe6', 0.9]]) {
    const Ls = len * L, ww = size * w;
    const g = ctx.createLinearGradient(0, 0, Ls, 0);
    g.addColorStop(0, rgba(c0, a0)); g.addColorStop(1, rgba(c0, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -ww * 0.5);
    ctx.quadraticCurveTo(Ls * 0.5, -ww * 0.45 + Math.sin(b * Math.PI) * size * 0.3, Ls, 0);
    ctx.quadraticCurveTo(Ls * 0.5, ww * 0.45 + Math.sin(b * Math.PI) * size * 0.3, 0, ww * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 5; i++) {
    const u = fract(hash01(i, 3) + b * 0.4);
    sparkle(ctx, u * len * 0.9, (hash01(i, 4) - 0.5) * size * 1.6 * u, size * 0.45 * (1 - u), '#ffffff', 1 - u);
  }
  glow(ctx, 0, 0, size * 3.6, '#fff0a0', 0.6);
  circlePath(ctx, 0, 0, size * 0.75); ctx.fillStyle = '#fffbe6'; ctx.fill();
  ctx.rotate(b * Math.PI * 0.25);
  sparkle(ctx, 0, 0, size * 2 * (1 + 0.15 * pulse(t)), '#ffffff', 0.9);
  ctx.restore();
}
function shotB(ctx, t) {
  const lt = t - T_B;
  const st = bStick(t);
  const ks = kickShake(t, 10, 5);
  // punch in on the downbeat, then a slow push toward Juno; tiny bump on every kick
  const zoom = 1.42 + 0.16 * Math.exp(-9 * Math.max(0, lt)) + 0.08 * ease.inOutSine(clamp(lt / 2.4)) + 0.018 * kick(t);
  const rot = -0.03 * st + ks.rot;
  const o = { t, view: 'dash', window: bWindow(t), lights: 1, shake: 0.08, stick: [st, 0] };
  camera(ctx, { x: 985 - 40 * clamp(lt / 2.4), y: 545, zoom, rot, dx: ks.dx, dy: ks.dy }, () => {
    drawCockpit(ctx, o);
    const G = COCKPIT_SEATS.dash.girl, D = COCKPIT_SEATS.dash.dog;
    const alarm = t > B_BEATS[3] ? 1 : 0;
    drawGirl(ctx, G.x, G.y, G.s, {
      t, stance: 'sit', facing: 1, suit: 'space', helmet: 1,
      expr: 'determined', look: t > B_BEATS[3] + 0.25 ? [0.5, -0.5] : [0.3 + 0.2 * st, -0.2],
      blink: t > B_BEATS[3] - 0.25 ? 0 : undefined,
      armL: joyArm(st),
      armR: { a: 1.25, b: -1.5 + 0.25 * pulse(t, 6), hand: 'fist' },
      tilt: 0.05 * st, headTilt: 0.04 * st,
    });
    // g-force rattle: Biscuit's head buzzes on 16th notes (tempo-locked), calming once he spots the rock
    const buzz = Math.sin(TAU * 4 * beatAt(t)) * (alarm ? 0.25 : 1);
    drawDog(ctx, D.x, D.y, D.s, {
      t, stance: 'sit', facing: -1, suit: 'space', helmet: 1,
      expr: alarm ? 'alert' : 'gforce', gforce: 1, exclaim: 0,
      tilt: 0.06 * st - 0.04 + 0.012 * buzz, headTilt: 0.07 * buzz, look: [-0.6, -0.2],
    });
    // the "!" — drawn here, big and yellow, so it doesn't vanish against his red seat
    if (alarm) bangMark(ctx, 1150, 468, 1.9 * ease.outBack(clamp((t - B_BEATS[3] + 0.03) / 0.15), 2.6), -0.16 + 0.06 * wobble(t, B_BEATS[3], 5, 6));
    drawCockpitFront(ctx, o);
  });
}
// cartoon "!" with burst lines (yellow, ink outline), centred on (x, y)
function bangMark(ctx, x, y, s, rot) {
  if (s <= 0.01) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 5;
  ctx.beginPath();
  for (const [a, r0, r1] of [[-2.55, 36, 52], [-0.6, 36, 52], [-1.57, 42, 58], [-3.2, 30, 42], [0.05, 30, 42]]) {
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 - 4); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -30); ctx.quadraticCurveTo(0, -38, 10, -30); ctx.lineTo(4.5, 7); ctx.quadraticCurveTo(0, 10, -4.5, 7); ctx.closePath();
  ink(ctx, PAL.yellow, 5);
  circlePath(ctx, 0, 22, 7.5); ink(ctx, PAL.yellow, 5);
  ctx.restore();
}

// =====================================================================================
// SHOT C — bar 34: asteroid field, a swerve ON every beat
// =====================================================================================
const C_S = 0.46;
const C_Y = [560, 285, 585, 295, 575]; // rocket lane before / after each swerve
const C_X = 700;
const C_V = 4000; // px/s the rocks rush past
function swerveP(d) {
  // d = t - beat. Anticipation (tiny counter-move) → a 0.12 s snap that lands ON the beat
  // (at its extreme, slight overshoot) → settle. The rock passes through the old lane on the beat.
  if (d < -0.2) return 0;
  if (d < -0.12) return -0.07 * ease.outQuad((d + 0.2) / 0.08);
  if (d < 0) return lerp(-0.07, 1.1, ease.inOutSine((d + 0.12) / 0.12));
  return 1 + 0.1 * Math.exp(-7 * d) * Math.cos(d * 16);
}
function cRocket(t) {
  let y = C_Y[0];
  for (let k = 0; k < 4; k++) y += (C_Y[k + 1] - C_Y[k]) * swerveP(t - C_SW[k]);
  // after the last dodge: punch forward, out of frame to the right
  const out = Math.max(0, t - (C_SW[3] + 0.2));
  const x = C_X + 40 * Math.sin(TAU * beatAt(t) / 4) + 8000 * out * out;
  return { x, y };
}
function cRocks() {
  // near-miss rocks: centre crosses the rocket's x exactly on the beat, in the lane the rocket just left
  const R = [];
  for (let k = 0; k < 3; k++) R.push({ t: C_SW[k], y: C_Y[k], r: 118 + 20 * (k % 2), seed: 3 + k * 2, spin: k % 2 ? 2.4 : -2.2, col: k === 1 ? '#b08d73' : '#a595c4' });
  // the gate on beat 4: two rocks either side of the gap the rocket threads
  R.push({ t: C_SW[3], y: C_Y[4] - 262, r: 150, seed: 11, spin: 1.6, col: '#a595c4' });
  R.push({ t: C_SW[3], y: C_Y[4] + 262, r: 150, seed: 12, spin: -1.8, col: '#b08d73' });
  return R;
}
const C_ROCKS = cRocks();
// A tapered white swoosh along the path of each dodge. Points are the rocket's tail position at earlier
// times, carried backward (left) at a stylised 2200 px/s so the lane change draws an S-arc, not a line.
function cSwoosh(ctx, t) {
  for (let k = 0; k < 4; k++) {
    const b = C_SW[k];
    const d = t - b;
    if (d < -0.1 || d > 0.34) continue;
    const fade = clamp((d + 0.1) / 0.05) * (1 - ease.inQuad(clamp(d / 0.34)));
    const s0 = b - 0.15, s1 = Math.min(t, b + 0.05);
    if (s1 <= s0 + 0.01) continue;
    const n = 14;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = lerp(s0, s1, i / n);
      const P = cRocket(s);
      pts.push([P.x - 110 - 2200 * (t - s), P.y]);
    }
    // ribbon edges (thin at the old end, wide at the rocket)
    const L = [], Rr = [];
    for (let i = 0; i <= n; i++) {
      const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[Math.min(n, i + 1)];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const w = 34 * Math.pow(i / n, 0.7);
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    ctx.save();
    ctx.globalAlpha = 0.3 * fade;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = n; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [edge, lw] of [[L, 5], [Rr, 5]]) {
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 3; i <= n; i++) (i > 3 ? ctx.lineTo(edge[i][0], edge[i][1]) : ctx.moveTo(edge[i][0], edge[i][1]));
      ctx.stroke();
    }
    ctx.restore();
  }
}
function shotC(ctx, t) {
  const ks = kickShake(t, 12, 9);
  // extra jolt on every near miss
  let jx = 0, jy = 0;
  for (const b of C_SW) { const s = shakeAt(t, b, 14, 9); jx += s.dx; jy += s.dy; }
  spaceBg(ctx, { t, seed: 21, hue: HUE, stars: 300, driftX: t * 700, band: 0.6 });
  ctx.save();
  ctx.translate(ks.dx + jx, ks.dy + jy);
  // far rock field (parallax, small, desaturated)
  for (let i = 0; i < 12; i++) {
    const v = 500 + 700 * hash01(i, 5);
    const span = W + 400;
    const x = W + 200 - fract(hash01(i, 6) + (t * v) / span) * span;
    const y = 80 + 920 * hash01(i, 7);
    const r = 16 + 30 * hash01(i, 8);
    ctx.save(); ctx.globalAlpha = 0.55 + 0.3 * (v / 1200);
    drawAsteroid(ctx, x, y, r, { seed: 30 + i, rot: t * (hash01(i, 9) - 0.5) * 3, color: '#8f7fb8', lw: 2.5 });
    ctx.restore();
  }
  // nearer parallax layer: medium rocks tumbling by (kept out of the rocket's corridor)
  for (let i = 0; i < 7; i++) {
    const v = 1500 + 900 * hash01(i, 15);
    const span = W + 500;
    const x = W + 250 - fract(hash01(i, 16) + (t * v) / span) * span;
    const band = i % 2 ? [40, 170] : [900, 1050];
    const y = lerp(band[0], band[1], hash01(i, 17));
    const r = 34 + 26 * hash01(i, 18);
    drawAsteroid(ctx, x, y, r, { seed: 60 + i, rot: t * (hash01(i, 19) - 0.5) * 4, color: i % 3 ? '#9d8cc4' : '#a8876f', lw: 3.5 });
  }
  streaks(ctx, t, { angle: Math.PI, count: 30, speed: 3400, alpha: 0.4, seed: 23, lw: 4, len: 300 });
  // rocket state
  const R = cRocket(t);
  const dt = 1 / 120;
  const vy = (cRocket(t + dt).y - cRocket(t - dt).y) / (2 * dt);
  const tilt = clamp(Math.atan2(vy, 2600), -0.5, 0.5);
  const stretch = 1 + clamp(Math.abs(vy) / 16000, 0, 0.14);
  // barrel roll through the gate (right after the beat-4 dodge). The cos-squeeze never goes thinner than
  // 0.3 (it flips across the edge-on frame instead) so the rocket never vanishes into a line.
  const rp = clamp((t - (C_SW[3] - 0.02)) / 0.5);
  const rc = Math.cos(TAU * ease.inOutCubic(rp));
  const roll = (rc < 0 ? -1 : 1) * (0.3 + 0.7 * Math.abs(rc));
  // near-miss rocks (behind the rocket for the upper lane, in front for the lower — depth)
  const drawRock = (rk) => {
    const x = R.x * 0 + C_X + C_V * (rk.t - t);
    if (x < -rk.r * 1.6 || x > W + rk.r * 1.6) return;
    // motion smear
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let j = 1; j <= 3; j++) drawAsteroid(ctx, x + j * 38, rk.y, rk.r * (1 - j * 0.04), { seed: rk.seed, rot: rk.spin * (t - j * 0.012), color: rk.col, lw: 0 });
    ctx.restore();
    drawAsteroid(ctx, x, rk.y, rk.r, { seed: rk.seed, rot: rk.spin * t, color: rk.col });
    // whoosh lines at the moment of passing
    const d = t - rk.t;
    if (d > -0.05 && d < 0.35) {
      ctx.save();
      ctx.globalAlpha = 1 - clamp((d + 0.05) / 0.4);
      ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = 7;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const yy = rk.y + (j - 1.5) * rk.r * 0.45;
        ctx.moveTo(x + rk.r * 0.9, yy); ctx.lineTo(x + rk.r * 0.9 + 180 + 60 * (j % 2), yy);
      }
      ctx.stroke();
      ctx.restore();
    }
  };
  for (const rk of C_ROCKS) if (rk.y <= R.y) drawRock(rk);
  // swoosh arcs tracing each dodge (the first one happens across the cut, so this is what sells it)
  cSwoosh(ctx, t);
  // the rocket (+ two ghost copies smeared along the snap = cartoon motion blur)
  const flame = 1.1 + 0.25 * kick(t);
  const snapping = C_SW.some((b) => t > b - 0.12 && t < b + 0.06);
  if (snapping) {
    for (const [lag, al] of [[0.05, 0.14], [0.025, 0.24]]) {
      const G = cRocket(t - lag);
      ctx.save(); ctx.globalAlpha = al;
      rocketAt(ctx, G.x, G.y, C_S, Math.PI / 2 + tilt, { t, flame: 0 }, stretch, roll);
      ctx.restore();
    }
  }
  rocketAt(ctx, R.x, R.y, C_S, Math.PI / 2 + tilt, {
    t, flame, crew: true, shake: 0.3 + 0.5 * kick(t),
    crewPose: { girl: { expr: 'gforce', gforce: 1 }, dog: { expr: 'gforce', gforce: 1 } },
  }, stretch, roll);
  for (const rk of C_ROCKS) if (rk.y > R.y) drawRock(rk);
  // roll marks: curved "spin" arcs wrapping the hull while it rolls
  if (rp > 0 && rp < 1) {
    const a = Math.sin(Math.PI * rp);
    ctx.save();
    ctx.translate(R.x, R.y);
    ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round'; ctx.lineWidth = 6;
    ctx.globalAlpha = 0.85 * a;
    for (const [ox, ry] of [[-95, 88], [15, 100], [110, 70]]) {
      const ph = TAU * ease.inOutCubic(rp) * 1.5 + ox * 0.01;
      ctx.beginPath();
      ctx.ellipse(ox, 0, 22, ry, 0, ph, ph + 2.1);
      ctx.stroke();
    }
    ctx.restore();
  }
  // foreground rocks whooshing past camera (between beats, top & bottom edges)
  for (const [tc, y, r, seed] of [[barTime(34, 1.5), 1130, 330, 41], [barTime(34, 3.4), -70, 380, 42]]) {
    const x = W / 2 + 7500 * (tc - t);
    if (x < -r * 2 || x > W + r * 2) continue;
    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let j = 1; j <= 3; j++) drawAsteroid(ctx, x + j * 120, y, r, { seed, rot: t * 1.5, color: '#4a3b6b', lw: 0 });
    ctx.restore();
    drawAsteroid(ctx, x, y, r, { seed, rot: t * 1.5, color: '#5b4a80', lw: 9 });
  }
  ctx.restore();
}

// =====================================================================================
// SHOT D — bar 35: loop-the-loop round a big asteroid, leaving a star trail
// =====================================================================================
const D_S = 0.34;
const D_C = [1000, 575]; // loop / asteroid centre
const D_R = 318; // loop radius
const D_V = (TAU * D_R) / (D_LOOP1 - D_LOOP0);
function dPath(t) {
  // returns centre + heading angle (drawRocket rot: 0 = nose up)
  const [cx, cy] = D_C;
  if (t <= D_LOOP0) {
    return { x: cx - D_V * (D_LOOP0 - t), y: cy + D_R, rot: Math.PI / 2 };
  }
  if (t <= D_LOOP1) {
    const phi = Math.PI / 2 - TAU * (t - D_LOOP0) / (D_LOOP1 - D_LOOP0);
    // velocity dir = (sin φ, -cos φ) → rot = atan2(vx, -vy)
    const vx = Math.sin(phi), vy = -Math.cos(phi);
    return { x: cx + D_R * Math.cos(phi), y: cy + D_R * Math.sin(phi), rot: Math.atan2(vx, -vy) };
  }
  // exit: climb away up-right, accelerating
  const tau = t - D_LOOP1;
  const x = cx + D_V * tau + 500 * tau * tau;
  const y = cy + D_R - 900 * tau * tau;
  const vx = D_V + 1000 * tau, vy = -1800 * tau;
  return { x, y, rot: Math.atan2(vx, -vy) };
}
function dTail(p) {
  // nozzle point behind the centre
  const [ox, oy] = rotV(0, 350 * D_S, p.rot);
  return [p.x + ox, p.y + oy];
}
function shotD(ctx, t) {
  const tt = Math.max(t, T_D);
  const ks = kickShake(tt, 8, 13);
  // camera: opens closer, low-left (the big rock looming right, the rocket streaking in), and pulls back to
  // the wide as the loop begins; a small zoom punch on the 85.34 "WHEEE!"
  const pb = ease.inOutSine(clamp((tt - T_D) / 0.8));
  const zTop = tt > D_TOP - 0.03 ? 0.05 * Math.exp(-5 * (tt - D_TOP + 0.03)) : 0;
  const zoom = lerp(1.22, 0.97, pb) + 0.05 * ease.inOutSine(clamp((tt - T_D) / 2.4)) + zTop;
  const camX = lerp(640, 980, pb), camY = lerp(700, 560, pb);
  spaceBg(ctx, { t: tt, seed: 35, hue: HUE, stars: 340, driftX: tt * 60 + (camX - 980) * 0.3, driftY: (camY - 560) * 0.3, band: 1 });
  // comet cameo high in the background, still out ahead
  const cu = (tt - T_D) / 1.3;
  if (cu > 0 && cu < 1) drawComet(ctx, lerp(-150, 2100, cu), lerp(210, 120, cu), -0.08, 420, { t: tt, size: 17, seed: 7, alpha: 0.9 });
  camera(ctx, { x: camX, y: camY, zoom, dx: ks.dx, dy: ks.dy, rot: 0.012 * sway(tt, 8) }, () => {
    const [cx, cy] = D_C;
    // the big asteroid, slowly tumbling
    glow(ctx, cx, cy, 420, '#ff7eb6', 0.12);
    drawAsteroid(ctx, cx, cy, 200, { seed: 8, rot: -0.3 + 0.25 * (tt - T_D), color: '#a595c4' });
    // star trail: a glowing string from the entry point to the nozzle
    const pts = [];
    const t0 = T_D - 0.05;
    const n = Math.max(2, Math.ceil((tt - t0) / (1 / 90)));
    for (let i = 0; i <= n; i++) pts.push(dTail(dPath(lerp(t0, tt, i / n))));
    const trail = (w, col, a) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = rgba(col, a); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    trail(54, '#ff7eb6', 0.1);
    trail(26, '#ffb35c', 0.22);
    trail(12, '#ffe27a', 0.4);
    ctx.restore();
    trail(4.5, '#fffbe6', 1);
    // beads of light running along the string toward the rocket
    const b = beatAt(tt);
    for (let i = 0; i < 7; i++) {
      const f = fract(i / 7 + b * 0.25);
      const [bx, by] = dTail(dPath(lerp(t0, tt, f)));
      glow(ctx, bx, by, 26, '#fff6c0', 0.6 * Math.sin(Math.PI * f));
    }
    // glitter dust twinkling on the hats
    const hp = hat(tt);
    for (let i = 0; i < 40; i++) {
      const ti = T_D + 0.03 + i * 0.058;
      if (ti > tt - 0.05) break;
      const P0 = dPath(ti);
      const [dx0, dy0] = dTail(P0);
      const side = (hash01(i, 51) - 0.5) * 46;
      const [ox, oy] = rotV(side, 0, P0.rot);
      const tw = 0.5 + 0.5 * Math.sin(TAU * (b / 2 + hash01(i, 52))) + (hash01(i, 53) < 0.4 ? hp : 0);
      sparkle(ctx, dx0 + ox, dy0 + oy, (5 + 7 * hash01(i, 54)) * (0.6 + 0.5 * tw), '#ffffff', clamp(0.35 + 0.5 * tw));
    }
    // stars pop along the trail on every half beat
    for (let j = 0; j < 12; j++) {
      const tj = T_D + (j * SPB) / 2;
      if (tj > tt) break;
      const [sx, sy] = dTail(dPath(tj));
      const age = tt - tj;
      const onBeat = j % 2 === 0;
      const sc = ease.outBack(clamp(age / 0.22), 3);
      const tw = 1 + 0.3 * hat(tt) * (j % 3 === 0 ? 1 : 0.4);
      const r = (onBeat ? 30 : 19) * sc * tw;
      glow(ctx, sx, sy, r * 3.2, '#fff0a0', 0.5);
      popStar(ctx, sx, sy, r, 0.3 * Math.sin(b * Math.PI / 2 + j), onBeat ? PAL.yellow : '#fff6c0');
      if (age < 0.3) sparkle(ctx, sx, sy, r * 2.6 * (1 - age / 0.3) + 4, '#ffffff', 1 - age / 0.3);
    }
    // the rocket
    const P = dPath(tt);
    const stretch = 1.08 + 0.06 * kick(tt);
    rocketAt(ctx, P.x, P.y, D_S, P.rot, { t: tt, flame: 1.2 + 0.2 * kick(tt), shake: 0.3 }, stretch);
    // "WHEEE!" at the top of the loop (snare)
    const wu = (tt - D_TOP + 0.03) / 0.55;
    if (wu > 0 && wu < 1) {
      const pop = ease.outBack(clamp(wu / 0.2), 2.6);
      cartoonText(ctx, 'WHEEE!', P.x - 60, 560 + (104 - 540) / zoom, { size: 76, fill: PAL.yellow, scale: pop, alpha: 1 - clamp((wu - 0.7) / 0.3), rot: -0.08 + 0.05 * Math.sin(TAU * 2 * beatAt(tt)) });
    }
  });
}

// =====================================================================================
// SHOT E — bar 36: the catch. Everything here is drawn in the ROCKET FRAME (RF):
// origin = rocket centre, +y toward the tail, units = screen px at camera zoom 1.
// =====================================================================================
const E_S = 1.25;
const E_ROT = 0.3;
const E_CEN = [560, 600];
const E_GS = 0.5 * E_S; // Juno's scale (0.5 × rocket, fits the doorway)
const E_SILL = [(76 + 8) * E_S, (-298 + 360) * E_S]; // Juno's ground point (doorway sill) in RF
const NET_K = 1.3; // net size in Juno units
const rfToScreen = ([x, y]) => { const [a, b] = rotV(x, y, E_ROT); return [E_CEN[0] + a, E_CEN[1] + b]; };

function eJuno(t) {
  // pop out of the hatch, wind up, swing, follow through, then turn to the star
  const pop = t < T_E ? 0 : spring(t, T_E, 2.6, 7);
  const lean = keyframes(t, [[T_E, 0.06], [T_E + 0.2, 0.2, ease.outBack], [E_SWING, 0.02], [E_CATCH, 0.34, ease.inCubic], [E_CATCH + 0.3, 0.22, ease.outBack], [E_BURST, 0.14]]);
  const a = keyframes(t, [[T_E, 2.5], [T_E + 0.12, 2.7, ease.outQuad], [E_SWING, 3.55, ease.inOutSine], [E_CATCH, 2.0, ease.inCubic], [E_CATCH + 0.12, 1.72, ease.outQuad], [E_CATCH + 0.5, 1.95, ease.inOutSine], [E_BURST, 1.95], [E_BURST + 0.45, 1.05, ease.inOutCubic]]);
  const tremble = t > E_SWING - 0.18 && t < E_SWING ? 0.03 * Math.sin(t * 90) : 0;
  const pose = {
    t, stance: 'stand', facing: 1, suit: 'space', helmet: 1,
    expr: t < E_CATCH ? 'determined' : t < E_BURST - 0.1 ? 'surprised' : 'awe',
    look: t < E_CATCH ? [1, -0.3] : [0.9, 0.1],
    tilt: lean + tremble, squash: 1 - 0.1 * wobble(t, T_E, 3, 7),
    armR: { a: a + tremble, b: 0, hand: 'fist' },
    armL: t < E_BURST ? { a: -0.35, b: -0.3, hand: 'fist' } : { a: lerp(-0.35, -0.55, ease.outBack(clamp((t - E_BURST) / 0.3))), b: lerp(-0.3, -1.9, ease.outBack(clamp((t - E_BURST) / 0.3))), hand: 'open' },
    blink: t > E_BURST - 0.1 && t < E_WINK + 0.6 ? 0 : undefined,
    blush: t > E_WINK ? clamp((t - E_WINK) / 0.3) : 0,
  };
  const x = E_SILL[0] - 30 * (1 - pop), y = E_SILL[1];
  return { x, y, pose };
}
// net transform in RF at time t: grip, direction angle (0 = pole up), bag swing side
function eNet(t) {
  const J = eJuno(t);
  const A = girlAnchors(J.x, J.y, E_GS, J.pose);
  const [hx, hy] = A.handR, [sx, sy] = A.shoulderR;
  let ang = Math.atan2(hx - sx, -(hy - sy));
  // the pole lags a touch during the swing (secondary motion), springs past after the catch
  ang += 0.18 * clamp((t - E_SWING) / 0.07) * (1 - clamp((t - E_CATCH) / 0.1)) - 0.12 * wobble(t, E_CATCH, 3, 6);
  const L = 300 * NET_K * E_GS;
  const hoop = [hx + Math.sin(ang) * L, hy - Math.cos(ang) * L];
  // bag trails behind the motion: +1 while winding up, flips through the swing, -1 after
  const swing = t < E_SWING ? 1 : t < E_CATCH ? lerp(1, -1, (t - E_SWING) / (E_CATCH - E_SWING)) : -1;
  return { grip: [hx, hy], ang, hoop, swing, juno: J, anchors: A };
}
const E_HOOP_CATCH = eNet(E_CATCH).hoop;
function eComet(t) {
  // relative to the rocket the comet slides back from ahead (up in RF) on a gentle arc, still
  // moving fast when it hits the hoop ON the beat (momentum into the net)
  const u = clamp((t - (T_E - 0.12)) / (E_CATCH - T_E + 0.12));
  const e = lerp(u, ease.inOutSine(u), 0.35);
  const x = lerp(E_HOOP_CATCH[0] + 520, E_HOOP_CATCH[0], e) - 90 * Math.sin(Math.PI * e);
  const y = lerp(E_HOOP_CATCH[1] - 1150, E_HOOP_CATCH[1], e);
  return { x, y };
}
function eStarPos(t, N) {
  // after the burst the baby star pops out of the net and hovers in front of Juno's helmet
  const bag = netToRF(N, [78, -290]);
  const face = [N.anchors.head[0] + 150, N.anchors.head[1] - 40];
  const u = clamp((t - E_BURST) / 0.34);
  const e = ease.outBack(u, 1.6);
  const x = lerp(bag[0], face[0], e);
  const y = lerp(bag[1], face[1], e) - 110 * Math.sin(Math.PI * clamp(u * 1.1));
  const bob = t > E_BURST + 0.34 ? -10 * hop(t, 1) : 0;
  return [x, y + bob];
}
function netToRF(N, [px, py]) {
  // net-local point (grip origin, pole up) → RF
  const k = NET_K * E_GS;
  const [a, b] = rotV(px * k * (px > 0 ? N.swing : 1), py * k, N.ang);
  return [N.grip[0] + a, N.grip[1] + b];
}
function shotE(ctx, t) {
  const tt = Math.max(t, T_E);
  // camera: tracking the rocket; after the catch push in on Juno + the star and level the horizon
  const N = eNet(tt);
  const push = ease.inOutCubic(clamp((tt - E_CATCH - 0.05) / (E_BURST + 0.25 - E_CATCH)));
  const head = N.anchors.head;
  const focusRF = [head[0] + 85, head[1] + 5];
  const [fx, fy] = rfToScreen(focusRF);
  const zoom = 1 + 1.45 * push;
  const crot = -0.34 * push;
  const s1 = shakeAt(tt, E_CATCH, 22, 6), ks = kickShake(tt, 7 * (1 - push * 0.6), 17);
  spaceBg(ctx, { t: tt, seed: 36, hue: HUE, stars: 300, driftX: tt * 500, driftY: -tt * 1100, band: 0.7 });
  const motion = -Math.PI / 2 + E_ROT; // rocket's travel direction (screen)
  streaks(ctx, tt, { angle: motion + Math.PI, count: 30, speed: 3000, alpha: 0.42 * (1 - push * 0.5), seed: 29, lw: 4, len: 300 });
  camera(ctx, { x: lerp(960, fx, push), y: lerp(540, fy, push), zoom, rot: crot + s1.rot, dx: s1.dx + ks.dx, dy: s1.dy + ks.dy }, () => {
    ctx.save();
    ctx.translate(E_CEN[0], E_CEN[1]);
    ctx.rotate(E_ROT);
    // gentle flight bob (tempo-locked)
    ctx.translate(6 * sway(tt, 4), 10 * sway(tt, 2));
    const hatch = t < T_E ? 0 : ease.outBack(clamp((tt - T_E + 0.02) / 0.12), 1.2) > 1 ? 1 : ease.outBack(clamp((tt - T_E + 0.02) / 0.12), 1.2);
    const dogPose = {
      expr: tt < E_CATCH ? 'excited' : tt < E_BURST ? 'surprised' : 'excited',
      look: [0.9, -0.4], ears: tt > E_CATCH ? 1 : 0.6, tongue: tt > E_BURST ? 1 : 0,
    };
    drawRocket(ctx, 0, 360 * E_S, E_S, {
      t: tt, flame: push > 0.6 ? 0 : 1.1, hatch: clamp(hatch), crew: true, shake: 0.25 + 0.4 * kick(tt), // flame is below frame once pushed in
      crewPose: { girl: { s: 0.05, dy: 900 }, dog: dogPose },
    });
    // comet (before the catch)
    if (tt < E_CATCH) {
      const C = eComet(tt);
      drawComet(ctx, C.x, C.y, -Math.PI / 2 - 0.25, 560, { t: tt, size: 28, seed: 5, star: clamp((tt - (E_CATCH - 0.25)) / 0.25) * 0.6, starExpr: 'surprised' });
    }
    // the net (pole under Juno's hand), then Juno
    eDrawNet(ctx, tt, N, crot + s1.rot);
    drawGirl(ctx, N.juno.x, N.juno.y, E_GS, N.juno.pose);
    // swing smear
    if (tt > E_SWING - 0.02 && tt < E_CATCH + 0.12) eSmear(ctx, tt);
    // catch burst on the beat
    const cu = (tt - E_CATCH) / 0.5;
    if (cu > 0 && cu < 1) {
      const [bx, by] = netToRF(N, [60, -300]);
      glow(ctx, bx, by, 380 * (1 - cu * 0.5), '#fff6c0', 0.9 * (1 - cu));
      burstLines(ctx, bx, by, 40, 330, cu, 16, '#fffbe6', 9, 61);
      // tail remnants scatter as sparkles
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + Math.PI + (hash01(i, 62) - 0.5) * 2.2;
        const d = (80 + 260 * hash01(i, 63)) * ease.outCubic(cu);
        sparkle(ctx, bx + Math.cos(a) * d, by + Math.sin(a) * d, (10 + 16 * hash01(i, 64)) * (1 - cu), i % 3 ? '#ffffff' : '#fff2a8', 1 - cu);
      }
    }
    // the baby star out of the net
    if (tt >= E_BURST) eBabyStar(ctx, tt, N);
    ctx.restore();
  });
  // catch flash (full frame, very brief)
  const fu = (t - E_CATCH) / 0.18;
  if (fu >= 0 && fu < 1) { ctx.fillStyle = rgba('#fffbe6', 0.55 * (1 - fu)); ctx.fillRect(0, 0, W, H); }
}
function eDrawNet(ctx, t, N, camRot = 0) {
  const k = NET_K * E_GS;
  const caught = t >= E_CATCH;
  const full = caught ? clamp(spring(t, E_CATCH, 2.2, 5) * 1.0, 0, 1.4) : 0;
  const gl = caught ? (t < E_BURST ? 1 - 0.45 * clamp((t - E_CATCH) / 0.6) : Math.max(0, 0.55 - (t - E_BURST) * 2)) : 0;
  ctx.save();
  ctx.translate(N.grip[0], N.grip[1]);
  ctx.rotate(N.ang);
  ctx.scale(k, k);
  drawNet(ctx, {
    t, swing: N.swing, glow: gl, full,
    inside: caught && t < E_BURST ? (c) => {
      // the caught comet: a glowing ball that settles into a startled baby star
      const u = clamp((t - E_CATCH) / 0.5);
      c.save();
      // net() already un-mirrors inside() (it applies the swing flip twice); undo the pole + rocket-frame +
      // camera rotation so the startled face sits upright on screen (with a little tilt), not on its side
      c.rotate(-(camRot + E_ROT + N.ang) + 0.12);
      glow(c, 0, 0, 150, '#fff0a0', 0.9 - 0.4 * u);
      drawBabyStar(c, -8, 6, 52, {
        t, expr: 'surprised', glow: 0.6, sparkles: false, bob: false,
        blink: t > E_CATCH + 0.36 && t < E_CATCH + 0.46 ? 1 : 0, rot: 0.25 * wobble(t, E_CATCH, 2.5, 4),
        squash: 1 + 0.25 * wobble(t, E_CATCH, 4, 7),
      });
      // white-hot cover fading off to reveal the face
      glow(c, 0, 0, 90, '#ffffff', 1 - ease.outCubic(u));
      c.restore();
    } : null,
  });
  ctx.restore();
}
function eSmear(ctx, t) {
  // curved speed arcs behind the hoop during the swing
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push(eNet(Math.max(E_SWING - 0.02, t - 0.1 + i * 0.01)).hoop);
  const a = 1 - clamp((t - E_CATCH) / 0.12);
  for (const [w, al] of [[34, 0.25], [14, 0.7]]) {
    ctx.globalAlpha = al * a; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  ctx.restore();
}
function eBabyStar(ctx, t, N) {
  const [x, y] = eStarPos(t, N);
  const bu = (t - E_BURST) / 0.8;
  const r = 58;
  // sparkle burst on 87.74
  if (bu > 0 && bu < 1) {
    glow(ctx, x, y, 230 * (1 - 0.3 * bu), '#fff3b0', 0.85 * (1 - bu)); // (kept small: at the push-in zoom a big glow is a full-screen gradient fill)
    // sparkles all round; the inked pop-stars fly up & out to the right (away from Juno) and are gone by the wink
    for (let i = 0; i < 18; i++) {
      const star = i % 3 === 0;
      const a = star ? lerp(-1.9, 0.6, (i / 3 + hash01(i, 90) * 0.5) / 6) - E_ROT : (i / 18) * TAU + hash01(i, 90) * 0.3;
      const su = star ? clamp(bu / 0.7) : bu;
      if (su >= 1) continue;
      const d = 70 + (60 + 260 * hash01(i, 91)) * ease.outCubic(su);
      const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
      if (star) popStar(ctx, sx, sy, (26 + 14 * hash01(i, 92)) * (1 - ease.inQuad(su)) * ease.outBack(clamp(su / 0.12), 2), a + su * 4, i % 2 ? PAL.yellow : PAL.pink, 1 - ease.inCubic(su));
      else sparkle(ctx, sx, sy, (18 + 20 * hash01(i, 93)) * (1 - su), '#ffffff', 1 - su);
    }
    const ring = ease.outCubic(clamp(bu * 1.4));
    ctx.save(); ctx.globalAlpha = 0.8 * (1 - clamp(bu * 1.4)); ctx.strokeStyle = '#fffbe6'; ctx.lineWidth = 10 * (1 - ring) + 2;
    circlePath(ctx, x, y, 60 + 300 * ring); ctx.stroke(); ctx.restore();
  }
  // hearts on the wink
  const hu = (t - E_WINK) / 1.2;
  if (hu > 0) {
    for (let i = 0; i < 3; i++) {
      const u = clamp(hu * 1.1 - i * 0.12);
      if (u <= 0 || u >= 1) continue;
      const hx = x + 62 + i * 30 + 14 * Math.sin(u * 7 + i), hy = y - 40 - 120 * ease.outCubic(u) - i * 16;
      const hr = (13 + 4 * i) * ease.outBack(clamp(u * 3), 3);
      ctx.save(); ctx.globalAlpha = 1 - ease.inQuad(u);
      heartPath(ctx, hx, hy, hr); ink(ctx, PAL.pink, 4);
      ctx.restore();
    }
  }
  const counter = -E_ROT * clamp((t - E_BURST) / 0.4) * 0.7; // stay upright-ish on screen
  drawBabyStar(ctx, x, y, r * ease.outBack(clamp((t - E_BURST) / 0.25), 2.4), {
    t, expr: t < E_WINK ? 'excited' : 'happy', rot: counter + 0.6 * (1 - ease.outCubic(clamp((t - E_BURST) / 0.4))),
    // the eye snaps shut ON the beat frame (starts closing a hair before), holds, reopens
    wink: t > E_WINK - 0.04 ? Math.min(1, ease.outBack(clamp((t - E_WINK + 0.04) / 0.08))) * (t < E_WINK + 0.9 ? 1 : 1 - clamp((t - E_WINK - 0.9) / 0.15)) : 0,
    look: [-0.7, 0.05], glow: 1,
  });
}

// =====================================================================================
export default {
  id: 's14_comet_chase',
  start: 76.94,
  end: 88.941,
  transition: { type: 'flash', dur: 0.5 },
  draw(ctx, tIn) {
    // Half-frame lead: at 30 fps the frames land a few ms BEFORE each beat, so without it every cut /
    // impact would show one frame late. With it, the frame nearest the beat is the hit (same as s13).
    const t = tIn + LEAD;
    if (t < T_B) shotA(ctx, t);
    else if (t < T_C) shotB(ctx, t);
    else if (t < T_D) shotC(ctx, t);
    else if (t < T_E) shotD(ctx, t);
    else shotE(ctx, Math.min(t, T_END + 1.6));
  },
};
