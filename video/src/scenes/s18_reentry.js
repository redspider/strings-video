// s18 — Re-entry (bar 47, 112.94 → 115.34). Drums only, one hit per beat
// (112.94 kick+snare, 113.54 snare, 114.14 kick, 114.74 snare) → a jolt of shake on every beat.
//
//   SHOT A  FIREBALL  112.942 → 113.542  Hard cut into the heat (flash + big shake): the S.S. Biscuit
//           streaks diagonally down toward the night-side horizon, tail-first, underside white-hot,
//           plasma envelope wrapped round it and a long fire-to-smoke trail streaming back up-left.
//   SHOT B  INSERT    113.542 → 114.142  Cockpit, alarm red, fire rushing past the window: Juno clings
//           to the stick (gritted teeth, eyes squeezed), Biscuit's ears/cheeks/tongue flap in the
//           g-force. Everything rattles on the 113.54 snare.
//   SHOT C  CHUTES    114.142 → 115.342 (+0.6 s under the fade into s19's night backyard)
//           Lower, slower, night sky with the crescent moon over moonlit clouds. The fire dies as it
//           brakes and the rocket rights itself; the nose cap pops (streamers from 114.63, anticipation)
//           and on the 114.742 snare THREE RED/CREAM CANOPIES BLOOM OPEN — burst lines, a hard jolt
//           (yanked up, squash & stretch, big shake), then a pendulum swing settling into a gentle
//           beat-locked sway as it drifts down toward the clouds (s19: descending under parachutes).
import { W, H, INK, LW, PAL, camera, glow, sparkle, circlePath, ellipsePath, ink, smokePuff, streaks, shake, cloud, starfield } from '../draw.js';
import { clamp, lerp, ease, hash01, noise1, rgba, mixColor, TAU, smoothstep, fract, wobble, keyframes } from '../util.js';
import { barTime, pulse, sway } from '../timing.js';
import { drawGirl } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';
import { drawRocket, drawFlame } from '../props/rockets.js';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../props/cockpit.js';
import { todTint } from '../props/backyard.js';

// ------------------------------------------------------------------ beat grid
const T0 = barTime(47); // 112.942 FIREBALL (kick + snare)
const T_INS = barTime(47, 1); // 113.542 insert (snare)
const T_OUT = barTime(47, 2); // 114.142 back outside (kick)
const T_CHUTE = barTime(47, 3); // 114.742 PARACHUTES POP (snare)
const T_END = barTime(48); // 115.342 → crossfade into s19 until 115.942
const HITS = [T0, T_INS, T_OUT, T_CHUTE];
// Hit convention: an impact shows on the 30 fps frame NEAREST its beat (≤ half a frame early).
const NEAR = 1 / 60;

// time of the most recent drum hit (for shakes) — the impact frame may sit up to NEAR before the beat
function lastHit(t) { let h = -1e9; for (const x of HITS) if (t >= x - NEAR) h = x; return h; }
function camShake(t, amp, decay = 6) { const h = lastHit(t); return shake(Math.max(t, h), h, amp, decay, 26); }

// ------------------------------------------------------------------ flight model (pure)
// The rocket falls tail-first along dir(rot) = (-sin rot, cos rot) (its tail direction).
// Shot A: fast, steep diagonal. Shot C: braking, righting itself, chutes.
const ROT_A = -0.62;
function rotAt(t) {
  if (t < T_OUT) return ROT_A + 0.04 * noise1(t * 2.3, 7);
  return lerp(ROT_A + 0.2, 0, ease.inOutSine(clamp((t - T_OUT) / (T_CHUTE - T_OUT - 0.05))));
}
// travel direction keeps a diagonal drift while the hull rights itself (so the trail stays off to the up-left)
function moveRotAt(t) {
  if (t < T_OUT) return rotAt(t);
  return lerp(ROT_A + 0.2, -0.42, ease.inOutSine(clamp((t - T_OUT) / (T_CHUTE - T_OUT))));
}
function speedAt(t) {
  if (t < T_OUT) return 2300;
  if (t < T_CHUTE) return lerp(1500, 420, ease.outQuad((t - T_OUT) / (T_CHUTE - T_OUT)));
  return 60 + 360 * Math.exp(-7 * (t - T_CHUTE));
}
// displacement of the rocket between t0 and t1 (numeric, fixed steps → deterministic)
function travel(t0, t1, n = 16) {
  let x = 0, y = 0;
  const dt = (t1 - t0) / n;
  for (let i = 0; i < n; i++) {
    const tm = t0 + (i + 0.5) * dt, r = moveRotAt(tm), v = speedAt(tm);
    x += -Math.sin(r) * v * dt; y += Math.cos(r) * v * dt;
  }
  return [x, y];
}

// trail of puffs left behind in world space: fire (young) → smoke (old)
function trail(ctx, t, rx, ry, { from, to, every = 0.045, life = 0.9, heatOf, scale = 1, seed = 1, fade = 1 }) {
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha *= fade;
  const k0 = Math.ceil(from / every), k1 = Math.floor(Math.min(to, t) / every);
  for (let k = k1; k >= k0; k--) {
    const te = k * every, age = t - te;
    if (age < 0 || age > life) continue;
    const u = age / life;
    const [dx, dy] = travel(te, t, 8);
    const hx = heatOf(te);
    // emitted at the tail, drifting a little sideways
    const jx = (hash01(k, seed) - 0.5) * 60 * u * scale, jy = (hash01(k, seed + 1) - 0.5) * 60 * u * scale;
    const px = rx - dx + jx, py = ry - dy + jy;
    const r = (40 + 90 * ease.outCubic(u)) * scale * (0.8 + 0.4 * hash01(k, seed + 2));
    const hot = hx * (1 - smoothstep(0.05, 0.45, u));
    const fill = hot > 0.5 ? mixColor('#ff8a3d', '#ffd23f', (hot - 0.5) * 2) : mixColor('#8d86a3', '#ff8a3d', hot * 2);
    const shadeCol = hot > 0.5 ? '#e8453c' : mixColor('#5d5878', '#c2281e', hot * 2);
    smokePuff(ctx, px, py, r, { seed: seed + (k % 97), u: 0.22 + 0.72 * u, n: 4, lw: 4 * scale + 1, fill, shadeCol });
    if (hot > 0.1) halo(ctx, px, py, r * 1.6, '#ff9a3d', 0.3 * hot, 2);
  }
  ctx.restore();
}

// flat toon glow: stacked translucent discs, additive (much cheaper than big radial gradients)
function halo(ctx, x, y, r, col, a, n = 3) {
  if (r <= 1 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(col, a / n);
  for (let i = 0; i < n; i++) { circlePath(ctx, x, y, r * (1 - i / (n + 0.4))); ctx.fill(); }
  ctx.restore();
}

function skyGrad(ctx, top, mid, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(-80, -80, W + 160, H + 160);
}

// embers / sparks streaming past the camera along angle ang (analytic particles)
function embers(ctx, t, amt, ang, speed = 1500, seed = 3, count = 40) {
  if (amt <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(W / 2, H / 2); ctx.rotate(ang);
  const span = 2400;
  for (let i = 0; i < count; i++) {
    const y = (hash01(i, seed) - 0.5) * 1800;
    const x = fract(hash01(i, seed + 1) + t * speed * (0.6 + 0.8 * hash01(i, seed + 2)) / span) * span - span / 2;
    const r = 3 + 5 * hash01(i, seed + 3);
    const col = hash01(i, seed + 4) < 0.5 ? '#ffd23f' : '#ff8a3d';
    ctx.fillStyle = rgba(col, 0.85 * amt);
    ctx.beginPath(); ctx.ellipse(x, y, r * 3, r * 0.6, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ SHOT A: fireball
const RA = { x: 900, y: 430, s: 0.7 }; // rocket centre on screen
function drawShotA(ctx, t) {
  const lt = t - T0;
  const sh = camShake(t, 30, 4.5);
  const rot = rotAt(t);
  const dir = [-Math.sin(rot), Math.cos(rot)];
  const motion = Math.atan2(dir[1], dir[0]); // travel direction on screen
  skyGrad(ctx, '#0a0a2c', '#26164e', '#5a2152');
  ctx.save(); ctx.translate(-lt * 90, -lt * 170);
  starfield(ctx, { t, seed: 44, count: 110, x0: -100, y0: -100, w: W + 300, h: H + 400, maxR: 2.6, alpha: 0.8 });
  ctx.restore();
  camera(ctx, { x: W / 2 + sh.dx, y: H / 2 + sh.dy, rot: sh.rot }, () => {
    // night-side Earth horizon far below, rising slowly
    const ex = 1250 - lt * 40, ey = 3450 - lt * 110, er = 2600;
    ctx.save();
    // night-side Earth: dark ocean disc, a sliver of moonlit land, airglow along the limb
    circlePath(ctx, ex, ey, er); ctx.fillStyle = '#18285a'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; circlePath(ctx, ex, ey, er); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[40, 0.1], [18, 0.2], [6, 0.45]]) {
      ctx.lineWidth = w; ctx.strokeStyle = rgba('#78c8ff', a);
      ctx.beginPath(); ctx.arc(ex, ey, er + w * 0.3, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (hash01(i, 8) - 0.5) * 0.7, d = er - 30 - 260 * hash01(i, 9);
      const px = ex + Math.cos(a) * d, py = ey + Math.sin(a) * d;
      if (py < H + 20) { ctx.fillStyle = rgba('#ffd98a', 0.5 + 0.4 * hash01(i, 10)); ctx.beginPath(); ctx.arc(px, py, 2 + 2 * hash01(i, 11), 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    streaks(ctx, t, { angle: motion + Math.PI, count: 30, speed: 3800, alpha: 0.32, color: '#ffd9b0', lw: 4, len: 420, seed: 12 });
    const cx = RA.x + 12 * noise1(t * 3, 4) + lt * 40, cy = RA.y + lt * 70;
    // tail point (where the trail leaves): centre + dir * 330 s
    const tx = cx + dir[0] * 300 * RA.s, ty = cy + dir[1] * 300 * RA.s;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, tx, ty, 560, '#ff6a1a', 0.5 + 0.2 * pulse(t, 5));
    ctx.restore();
    trail(ctx, t, tx, ty, { from: T0 - 1.2, to: t, every: 0.03, life: 0.75, heatOf: () => 1, scale: 1.1, seed: 5 });
    drawRocket(ctx, cx, cy + 360 * RA.s, RA.s, { t, rot, glow: 1, shake: 0.6 + 0.4 * pulse(t, 5) });
    embers(ctx, t, 1, motion + Math.PI, 2600, 5, 42);
  });
  // heat flicker: warm additive wash that throbs with the fire
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const f = 0.5 + 0.5 * noise1(t * 11, 9);
  ctx.fillStyle = rgba('#ff5a1a', 0.05 + 0.04 * f);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // impact flash on the cut
  const fl = t >= T0 - 0.02 ? Math.exp(-11 * Math.max(0, t - T0)) : 0;
  if (fl > 0.01) { ctx.fillStyle = rgba('#fff2d0', 0.75 * fl); ctx.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ SHOT B: cockpit insert
const DASH = COCKPIT_SEATS.dash;
function fireWindow(t) {
  return (ctx, cx, cy, r) => {
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, '#ffe07a'); g.addColorStop(0.5, '#ff8a3d'); g.addColorStop(1, '#d2321f');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    // flames rushing up past the window
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * r * 0.45 + 20 * noise1(t * 4 + i, 3);
      ctx.save(); ctx.translate(x, cy + r * 1.1); ctx.rotate(Math.PI);
      drawFlame(ctx, 0, 0, r * (1.3 + 0.4 * hash01(i, 2)), r * 0.5, t * 2 + i * 0.37, { seed: 40 + i, lw: 4, glow: 0 });
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    streaks(ctx, t, { angle: -Math.PI / 2, count: 18, speed: 4200, alpha: 0.5, color: '#fff2c4', lw: 5, len: 200, seed: 31 });
    ctx.restore();
  };
}
function drawShotB(ctx, t) {
  const sh = camShake(t, 26, 5);
  const rattle = 0.45 + 0.55 * pulse(t, 5);
  const jig = (k, sd) => [k * 12 * noise1(t * 23, sd), k * 9 * noise1(t * 19, sd + 5)];
  const push = 1 + 0.09 * Math.exp(-7 * Math.max(0, t - (T_INS - NEAR))); // punch-in on the cut, relaxing
  // homeSwitch 1: she flipped HOME on in s17 — the lamp is green now
  const o = { t, view: 'dash', window: fireWindow(t), lights: 1, shake: 1, tint: 0.35, homeSwitch: 1, stick: [0.3 * noise1(t * 9, 2), 0.8] };
  camera(ctx, { x: 1000 + sh.dx, y: 575 + sh.dy, zoom: 1.34 * push, rot: sh.rot }, () => {
    drawCockpit(ctx, o);
    const [gx, gy] = jig(rattle, 3);
    drawGirl(ctx, DASH.girl.x + gx, DASH.girl.y + gy, DASH.girl.s, {
      t, stance: 'sit', facing: 1, suit: 'space', helmet: 0, expr: 'wince',
      ...DASH.girl.arms.joystick, armR: { a: 1.15, b: -1.4, hand: 'fist' },
      headTilt: 0.06 * noise1(t * 17, 4), squash: 1 - 0.04 * pulse(t, 8),
    });
    const [dx, dy] = jig(rattle, 9);
    drawDog(ctx, DASH.dog.x + dx, DASH.dog.y + dy, DASH.dog.s, {
      t, stance: 'sit', facing: -1, suit: 'space', helmet: 0, expr: 'gforce', gforce: 1,
      headTilt: 0.08 * noise1(t * 15, 6), squash: 1 - 0.05 * pulse(t, 8),
    });
    drawCockpitFront(ctx, o);
  });
  // orange fire-glow flicker from the window
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba('#ff6a20', 0.07 + 0.05 * noise1(t * 13, 4));
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------------ SHOT C: chutes
// Screen path of the rocket CENTRE (my own flight until the chutes have settled) …
const S19_S = 0.588;
const cxC = (t) => keyframes(t, [[T_OUT, 720], [T_CHUTE, 1320, ease.outCubic], [T_END, 1380, ease.inOutSine]]);
// (it comes in low so the jolt's upward yank peaks with the canopies well inside the frame)
const cyC = (t) => keyframes(t, [[T_OUT, 540], [T_CHUTE, 730, ease.outCubic], [T_END, 834 - 360 * S19_S, ease.inOutSine]]);
const sC = (t) => keyframes(t, [[T_OUT, 0.5], [T_CHUTE, 0.55, ease.outCubic], [T_END, S19_S, ease.inOutSine]]);
// … which converges on s19's descent: s19 yardShot's maths replicated (world → screen with camX 1000,
// zoom .7, camY −780 → 470), so from 115.34 the rocket, canopies, swing and moon are exactly s19's
// and the 0.6 s fade is a true match dissolve (sky/clouds → backyard).   !! mirror s19 if it changes
const S19 = { T: barTime(48), TOUCH: barTime(49), RS: 0.84, GY: 860, Z: 0.7, CAMX: 1000 };
const s19CamY = (t) => keyframes(t, [[S19.T, -780], [S19.TOUCH - 0.1, 470, ease.inOutSine]]);
function s19Pose(t) {
  const u = clamp((t - S19.T) / (S19.TOUCH - S19.T));
  const finY = lerp(-360, S19.GY - 64 * S19.RS, 0.3 * u + 0.7 * ease.outSine(u));
  const rx = lerp(1600, 1540, ease.outSine(u));
  const camY = s19CamY(t);
  const damp = 1 - smoothstep(S19.TOUCH - 1.3, S19.TOUCH - 0.12, t);
  return {
    fx: (rx - S19.CAMX) * S19.Z + W / 2, fy: (finY - camY) * S19.Z + H / 2,
    swing: 0.055 * sway(t, 4) * damp, pivUp: (605 * S19.RS + 360) * S19.Z,
  };
}
// s19's crescent moon (backyard night moon (1230,150) r 60, sky parallax .85)
function moonPos19(t) {
  const camY = s19CamY(t);
  return [(1230 + (S19.CAMX - 960) * 0.85 - S19.CAMX) * S19.Z + W / 2, (150 + (camY - 540) * 0.85 - camY) * S19.Z + H / 2];
}
const NIGHT = todTint('night');
// before the handoff the moon hangs further left, clear of the canopies as they pop, and slides in after
function moonAt(t) {
  const [mx, my] = moonPos19(t);
  if (t >= T_END) return [mx, my];
  return [keyframes(t, [[T_OUT, 880], [T_CHUTE + 0.1, 900], [T_END, mx, ease.inOutSine]]),
    keyframes(t, [[T_OUT, 320], [T_CHUTE + 0.1, 330], [T_END, my, ease.inOutSine]])];
}

function chuteAmt(t) {
  // streamers shoot out (114.63 →, anticipation) … the canopies BURST open onto the beat frame
  // (≥ .8 by 114.726 = full-size with outBack overshoot), then settle to 1
  const tb = T_CHUTE - NEAR;
  if (t < tb - 0.03) return 0.25 * ease.outCubic(clamp((t - (T_CHUTE - 0.11)) / 0.07));
  if (t < tb) return lerp(0.25, 0.82, ease.inQuad((t - (tb - 0.03)) / 0.03));
  return lerp(0.82, 1, ease.outCubic(clamp((t - tb) / 0.3)));
}
const heatC = (t) => (t < T_OUT ? 1 : 1 - smoothstep(T_OUT, T_CHUTE - 0.14, t)); // fire dies as it brakes

function crewC(t, heat, light) {
  const dtc = t - T_CHUTE;
  const jolt = dtc >= -0.02 && dtc < 0.4;
  const gl = light ? { ...light, k: 0.62 * (light.k / 0.72) } : undefined;
  return {
    girl: { t, expr: heat > 0.35 ? 'wince' : jolt ? 'surprised' : dtc >= 0 ? 'grin' : 'determined', light: gl },
    dog: { t, expr: heat > 0.35 ? 'wince' : jolt ? 'surprised' : dtc >= 0 ? 'happy' : 'alert', light: gl },
  };
}

function drawShotC(ctx, t) {
  // (the jolt's shake dies out before the handoff so s19's first frames match)
  const sh = camShake(t, (t >= T_CHUTE - NEAR ? 30 : 16) * (1 - smoothstep(T_END - 0.5, T_END, t)), 5);
  const heat = heatC(t);
  const night = smoothstep(T_OUT - 0.2, T_CHUTE, t);
  const s = sC(t);
  const [, fall] = travel(T_OUT, t, 20); // how far we've come down (for parallax)
  skyGrad(ctx, mixColor('#0a0a2c', '#0a0b2e', night), mixColor('#2a1850', '#141a48', night), mixColor('#5a2152', '#1f2d62', night));
  ctx.save(); ctx.translate(0, -fall * 0.05);
  starfield(ctx, { t, seed: 61, count: 170, x0: -50, y0: -50, w: W + 100, h: H + 300, maxR: 2.6, alpha: 0.9 });
  ctx.restore();
  const [mx, my] = moonAt(t);
  moon19(ctx, mx, my, t);
  camera(ctx, { x: W / 2 + sh.dx, y: H / 2 + sh.dy, rot: sh.rot }, () => {
    // moonlit cloud tops far below, rising as we descend
    cloudLayer(ctx, t, 1150 - fall * 0.2);
    if (heat > 0.02) {
      const mot = Math.atan2(Math.cos(moveRotAt(t)), -Math.sin(moveRotAt(t)));
      streaks(ctx, t, { angle: mot + Math.PI, count: 20, speed: 3000 * heat + 400, alpha: 0.28 * heat, color: '#ffd9b0', lw: 4, len: 260, seed: 14 });
    }
    // chute jolt (impact frame = nearest the beat): yanked up hard, then settles; pendulum swing
    const tj = T_CHUTE - NEAR;
    const dtc = t - tj;
    const yank = dtc >= 0 ? -95 * Math.exp(-5.5 * dtc) * Math.cos(TAU * 1.3 * dtc) : 0;
    let swing = dtc >= 0 ? 0.13 * wobble(t, tj, 0.8, 1.8) + 0.055 * sway(t, 4) * smoothstep(tj, tj + 0.6, t) : 0;
    const sq = dtc >= 0 ? 1 + 0.1 * Math.exp(-7 * dtc) * Math.cos(TAU * 2.2 * dtc) : 1 + 0.03 * heat * pulse(t, 6); // stretch as it's yanked, then squash
    let cx = cxC(t) + 10 * noise1(t * 3, 8) * heat;
    let cy = cyC(t) + yank;
    let pivUp = (360 + 674) * s; // pendulum pivot above the centre, up among the canopies
    // converge on s19's descent (exactly s19's from the scene end on — the fade is a match dissolve)
    const hw = smoothstep(T_END - 0.5, T_END, t);
    if (hw > 0) {
      const p = s19Pose(t);
      cx = lerp(cx, p.fx, hw); cy = lerp(cy, p.fy - 360 * s, hw);
      swing = lerp(swing, p.swing, hw); pivUp = lerp(pivUp, p.pivUp - 360 * s, hw);
    }
    const rot = rotAt(t);
    const dir = [-Math.sin(rot), Math.cos(rot)];
    const tx = cx + dir[0] * 300 * s, ty = cy + dir[1] * 300 * s;
    // fire → smoke trail streaming back up-left along the path we came down
    // (emission stops and the smoke thins away before the canopies need the sky)
    trail(ctx, t, tx, ty, { from: T_OUT - 0.9, to: T_CHUTE - 0.34, every: 0.03, life: 1.0, heatOf: heatC, scale: 0.85, seed: 9, fade: 1 - smoothstep(T_CHUTE - 0.34, T_CHUTE - 0.02, t) });
    if (heat > 0) halo(ctx, tx, ty, 520, '#ff7a2a', 0.3 * heat, 5);
    // moonlight grade creeps in to match the night yard (s19 tints the rocket k .72)
    const lk = 0.72 * smoothstep(T_CHUTE + 0.1, T_END, t);
    const light = lk > 0.01 ? { ...NIGHT, k: lk } : undefined;
    // rocket: squash anchored at the nose riser, swing about a pivot up among the canopies
    ctx.save();
    const nose = [cx, cy - 360 * s];
    const piv = [cx, cy - pivUp];
    ctx.translate(piv[0], piv[1]); ctx.rotate(swing); ctx.translate(-piv[0], -piv[1]);
    if (sq !== 1) { ctx.translate(nose[0], nose[1]); ctx.scale(1 / Math.sqrt(sq), sq); ctx.translate(-nose[0], -nose[1]); }
    const kick = dtc >= 0 ? Math.exp(-6 * dtc) : 0;
    // drawn under s19's zoom (.7) at s / .7, exactly like s19 draws it (identical line widths / LOD)
    ctx.translate(cx, cy + 360 * s); ctx.scale(S19.Z, S19.Z);
    drawRocket(ctx, 0, 0, s / S19.Z, {
      t, rot, glow: heat, chute: chuteAmt(t), shake: (0.5 * heat + 0.5 * kick) * (1 - hw), light,
      crew: true, crewPose: crewC(t, heat, light),
    });
    ctx.restore();
    // FWUMP: radial burst lines + sparkles round the canopies on the beat
    const k = clamp((t - (T_CHUTE - NEAR - 0.005)) / 0.42);
    if (k > 0 && k < 1) {
      const bx = cx, by = cy - 360 * s - 320 * s;
      ctx.save();
      ctx.strokeStyle = rgba('#ffffff', 0.9 * (1 - k)); ctx.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + 0.2;
        const r0 = 170 + 200 * ease.outCubic(k), r1 = r0 + 70 * (1 - k) + 10;
        ctx.lineWidth = 9 * (1 - k) + 2;
        ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0 * 0.75); ctx.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1 * 0.75); ctx.stroke();
      }
      ctx.restore();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.5;
        const d = 150 + 260 * ease.outCubic(k) * (0.7 + 0.5 * hash01(i, 3));
        sparkle(ctx, bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.7, 22 * (1 - k) + 5, '#fff6c0', 1 - k);
      }
    }
    if (heat > 0) embers(ctx, t, heat, -Math.PI / 2 - 0.4, 1800 * heat + 300, 7, 26);
  });
}

// s19's crescent moon — backyard.js drawMoon (night) replicated at s19's zoom .7, so the two match
// through the dissolve. (x, y) = screen centre.
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
function moon19(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(S19.Z, S19.Z);
  const r = 60;
  // flat halo rings (backyard halo(): 4 steps, inner .45) + soft glow
  const hr = 200 * (1 + 0.04 * pulse(t, 3));
  for (let i = 0; i < 4; i++) {
    const f = 1 - (i / 3) * (1 - 0.45);
    ctx.fillStyle = rgba('#bcd0ff', (0.085 / 4) * 1.6 * (i === 0 ? 0.5 : 1));
    circlePath(ctx, 0, 0, hr * f); ctx.fill();
  }
  glow(ctx, 0, 0, 100, '#fff6d0', 0.32);
  const dx = r * 0.46, dy = -r * 0.26, r2 = r * 0.9;
  crescentPath(ctx, 0, 0, r, dx, dy, r2);
  ink(ctx, '#fff3c4', LW * 0.8, INK);
  crescentPath(ctx, 0, 0, r - 2, dx, dy, r2 + 2); ctx.clip();
  ctx.fillStyle = '#efd997';
  circlePath(ctx, -r * 0.18, r * 0.5, r * 0.42); ctx.fill();
  ctx.fillStyle = '#e8d18e';
  ellipsePath(ctx, -r * 0.62, -r * 0.05, 7, 9); ctx.fill();
  ellipsePath(ctx, -r * 0.35, -r * 0.52, 5, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ellipsePath(ctx, -r * 0.72, -r * 0.36, 4, 9, 0.5); ctx.fill();
  ctx.restore();
}
function cloudLayer(ctx, t, top) {
  if (top > H + 260) return;
  ctx.save();
  ctx.fillStyle = '#5d6fae'; ctx.fillRect(-300, top + 120, W + 600, H + 600);
  for (let i = 0; i < 9; i++) {
    const x = -200 + i * 290 + 70 * hash01(i, 5);
    const y = top + 70 * hash01(i, 6) + 6 * sway(t + i * 0.2, 4);
    cloud(ctx, x, y, 440 + 140 * hash01(i, 7), 200, { seed: 50 + i, fill: '#8fa2da', shadow: '#6c7fbf', lw: 5 });
  }
  ctx.restore();
}

export default {
  id: 's18_reentry',
  start: 112.942,
  end: 115.343,
  transition: { type: 'cut' },
  draw(ctx, t) {
    // internal cuts land on the 30 fps frame nearest their beat
    if (t < T_INS - NEAR) drawShotA(ctx, Math.max(t, T0 - 1.5));
    else if (t < T_OUT - NEAR) drawShotB(ctx, t);
    else drawShotC(ctx, Math.min(t, T_END + 1.5));
  },
};
