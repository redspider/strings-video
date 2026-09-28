// s05_suit_up — bars 12–14 (28.94 → 36.14). Humming vocal, golden backyard.
//
//   Shot A  bar 12  quick-change whirl → spacesuit POP (b1) → helmet plonked on Biscuit (b2)
//                   → Juno flicks her own helmet up and it lands on her head (b3)
//   Shot B  bar 13  heroic slow-mo walk toward camera, a step on every beat, rocket towering behind
//   Shot C  bar 14  up the gantry ladder a rung per beat (Biscuit tucked under her arm), turn + wave
//                   on b3, zip across the access arm, hatch SLAMS on the and-of-4, faces pop into
//                   the portholes just before the cut to the cockpit.
//
// Pure function of t. World = the backyard (ground y 860); rocket + gantry at the pad (x 1240) on the
// art director's scale contract: characters s 0.42, S.S. Biscuit s 0.84.
import { W, H, PAL, INK, LW, camera, shake, cartoonText, smokePuff, sparkle, glow, circlePath, ellipsePath,
  ink, withAlpha } from '../draw.js';
import { clamp, lerp, ease, tween, keyframes, spring, wobble, hash01, noise1, mixColor, rgba, TAU, smoothstep } from '../util.js';
import { barTime, beatAt, pulse, sway, hop } from '../timing.js';
import { drawGirl, girlAnchors, drawFishbowl } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { drawRocket, drawGantry, gantryRungs, ROCKET_HATCH } from '../props/rockets.js';
import { drawBackyard, longShadow, todTint } from '../props/backyard.js';

// ------------------------------------------------------------------ beat grid (absolute seconds)
const bt = (k, j = 0) => barTime(k, j);
const EPS = 1 / 60; // an impact is fully "on" half a frame early, so the frame nearest the beat shows it
const T_IN = bt(12); //            28.937 whip lands (engine whip spans 28.737–29.137)
const T_WHIRL = bt(12, 0.25); //   29.087 spin starts (the whip has landed)
const T_POP = bt(12, 1); //        29.537 POP — out of the whirl in the spacesuit
const T_REACH = bt(12, 1.5); //    29.837 turns to Biscuit, helmet held over his head
const T_DOGHELM = bt(12, 2); //    30.137 PLONK — helmet on Biscuit
const T_TOSS = bt(12, 2.4); //     30.377 flicks her own helmet up
const T_GIRLHELM = bt(12, 3); //   30.737 PLONK — helmet lands on Juno
const T_WALK = bt(13); //          31.337 hero walk (steps on 31.34, 31.94, 32.54, 33.14)
const T_CLIMB = bt(14); //         33.737 ladder: a rung on 33.74, 34.34, 34.94 → deck on 35.54
const T_WAVE = bt(14, 3); //       35.537 at the top: turn + wave
const T_ZIP = bt(14, 3.27); //     35.699 zip across the arm into the hatch (≈2 frames)
const T_SLAM = bt(14, 3.5); //     35.837 hatch SLAMS (and-of-4)
const T_FACES = bt(14, 3.7); //    35.957 faces pop up in the portholes
const T_END = bt(15); //           36.137 cut → cockpit

// ------------------------------------------------------------------ world layout
const GY = 860;
const CS = 0.42; // character scale (contract)
const RS = 0.84; // rocket scale (contract)
const RX = 1240, RY = GY - 216 * RS; // main-stage bottom (booster stands on the lawn)
const TINT = todTint('golden');
const RUNGS = 7; // gantry rungs (bigger steps so one rung per beat reads)
const GR = gantryRungs(RS, { rungs: RUNGS });
const LADDER_X = RX + GR.x;
const RUNG_Y = GR.rungs.map((r) => RY + r); // bottom → top (last = the deck)
const DECK_Y = RUNG_Y[RUNG_Y.length - 1];
const HATCH_X = RX + ROCKET_HATCH.x * RS;

const hitAt = (t, tb) => t >= tb - EPS; // impact frame reached
const since = (t, tb) => t - (tb - EPS);

// ------------------------------------------------------------------ little helpers
// World shoulder → hand 2-bone IK for Juno's arm; returns a {a, b} pose in her body-local convention.
// P = { x, y, s, facing, tilt } (same as drawGirl), side = 1 (armR) | -1 (armL). elbowOut: prefer the
// elbow away from the body (true) or below the reach line (false).
function armIK(P, side, target, { hand = 'fist', elbowOut = true, pose = {} } = {}) {
  const D = (P.facing ?? 1) < 0 ? -1 : 1;
  const A = girlAnchors(P.x, P.y, P.s, { ...pose, facing: P.facing, tilt: P.tilt || 0, armL: 'down', armR: 'down' });
  const S = side > 0 ? A.shoulderR : A.shoulderL;
  const ct = Math.cos(P.tilt || 0), st = Math.sin(P.tilt || 0);
  const toLocalDir = (wx, wy) => { const ux = wx * ct + wy * st, uy = -wx * st + wy * ct; return [ux * D, uy]; };
  let dx = target[0] - S[0], dy = target[1] - S[1];
  let stretch = 1, a = 0, b = 0;
  for (let it = 0; it < 3; it++) {
    const L1 = 44 * stretch * P.s, L2 = (40 * stretch + 7.15) * P.s;
    let d = Math.hypot(dx, dy);
    const dd = clamp(d, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
    const [lx, ly] = toLocalDir(dx, dy);
    const phi = Math.atan2(lx * side, ly); // "a" of the straight line to the target
    const al = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    const cands = [phi + al, phi - al].map((aa) => {
      const ex = side * Math.sin(aa) * L1, ey = Math.cos(aa) * L1; // elbow, local (scaled)
      const tx = lx * dd / Math.max(1e-6, Math.hypot(lx, ly)), ty = ly * dd / Math.max(1e-6, Math.hypot(lx, ly));
      const fa = Math.atan2((tx - ex) * side, ty - ey);
      return { a: aa, b: fa - aa, out: ex * side, low: ey };
    });
    const pick = elbowOut ? (cands[0].out >= cands[1].out ? cands[0] : cands[1]) : (cands[0].low >= cands[1].low ? cands[0] : cands[1]);
    a = pick.a; b = pick.b;
    while (a < -Math.PI / 2) a += TAU; // rig convention: 0 down, π up, small negatives = across the body
    while (a > 1.5 * Math.PI) a -= TAU;
    while (b > Math.PI) b -= TAU;
    while (b < -Math.PI) b += TAU;
    stretch = 1 + 0.16 * clamp((Math.max(a, a + b) - 1.75) / 0.9);
  }
  return { a, b, hand };
}

// Fishbowl helmet the scene holds / throws (same recipe as the girl's own helmet)
function bowl(ctx, x, y, r, rot = 0, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); if (rot) ctx.rotate(rot);
  circlePath(ctx, 0, 0, r); ctx.fillStyle = 'rgba(225,245,255,0.22)'; ctx.fill();
  drawFishbowl(ctx, 0, 0, r, { lw: Math.max(2.5, LW * r / 134) });
  ctx.restore();
}
// A white sheen sweeping across a glass bowl + a "ting" sparkle (after a plonk)
function glassGlint(ctx, x, y, r, u) {
  if (u <= 0 || u >= 1) return;
  ctx.save();
  circlePath(ctx, x, y, r * 0.97); ctx.clip();
  const gx = x + lerp(-1.6, 1.6, ease.inOutSine(u)) * r;
  ctx.globalAlpha = 0.55 * Math.sin(Math.PI * u);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(gx - r * 0.5, y + r); ctx.lineTo(gx - r * 0.1, y - r); ctx.lineTo(gx + r * 0.12, y - r); ctx.lineTo(gx - r * 0.28, y + r);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  const k = u < 0.25 ? ease.outBack(u / 0.25) : 1 - ease.inCubic((u - 0.25) / 0.75);
  sparkle(ctx, x - r * 0.55, y - r * 0.62, r * 0.55 * k, '#ffffff', 1);
  sparkle(ctx, x - r * 0.55, y - r * 0.62, r * 0.9 * k, '#fff6c0', 0.35);
}
// Impact "plonk" lines radiating around a point
function burstLines(ctx, x, y, r0, r1, u, n = 8, rot = 0, color = INK, lw = 5) {
  if (u <= 0 || u >= 1) return;
  const a = 1 - ease.inCubic(u);
  const g = ease.outCubic(u);
  ctx.save();
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.globalAlpha *= a;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const an = rot + (i / n) * TAU;
    const ra = lerp(r0, r1, g * 0.6), rb = lerp(r0, r1, 0.35 + g * 0.65);
    ctx.moveTo(x + Math.cos(an) * ra, y + Math.sin(an) * ra);
    ctx.lineTo(x + Math.cos(an) * rb, y + Math.sin(an) * rb);
  }
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ flying clothes (the quick-change gag)
function flyingShirt(ctx) {
  ctx.beginPath();
  ctx.moveTo(-30, -34); ctx.lineTo(-58, -14); ctx.lineTo(-48, 2); ctx.lineTo(-30, -8); ctx.lineTo(-28, 34);
  ctx.lineTo(28, 34); ctx.lineTo(30, -8); ctx.lineTo(48, 2); ctx.lineTo(58, -14); ctx.lineTo(30, -34);
  ctx.quadraticCurveTo(0, -24, -30, -34); ctx.closePath();
  ctx.fillStyle = PAL.white; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = PAL.red;
  for (let y = -34; y < 40; y += 16) ctx.fillRect(-60, y, 120, 8);
  ctx.restore();
  ink(ctx, null, LW);
}
function flyingOveralls(ctx) {
  ctx.beginPath();
  ctx.moveTo(-26, -40); ctx.lineTo(26, -40); ctx.lineTo(28, -6); ctx.lineTo(36, 0); ctx.lineTo(34, 60); ctx.lineTo(8, 60);
  ctx.lineTo(2, 14); ctx.lineTo(-4, 60); ctx.lineTo(-32, 60); ctx.lineTo(-36, 0); ctx.lineTo(-28, -6); ctx.closePath();
  ink(ctx, '#3f7fe8', LW);
  ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-30, -66); ctx.moveTo(20, -40); ctx.lineTo(30, -66); ctx.stroke();
  ctx.strokeStyle = '#3f7fe8'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-30, -66); ctx.moveTo(20, -40); ctx.lineTo(30, -66); ctx.stroke();
  ctx.fillStyle = '#2c5fb8'; ctx.fillRect(4, -2, 26, 58);
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(4, -20); ctx.lineTo(14, -19); ctx.lineTo(6, -12); ctx.lineTo(9, -2); ctx.lineTo(0, -8);
  ctx.lineTo(-9, -2); ctx.lineTo(-6, -12); ctx.lineTo(-14, -19); ctx.lineTo(-4, -20); ctx.closePath(); ink(ctx, PAL.yellow, 3);
}
function flyingShoe(ctx) {
  ctx.beginPath();
  ctx.moveTo(-26, -14); ctx.quadraticCurveTo(-10, -22, 4, -14); ctx.quadraticCurveTo(30, -10, 32, 8);
  ctx.lineTo(-28, 8); ctx.closePath(); ink(ctx, PAL.red, LW);
  ctx.beginPath(); ctx.moveTo(14, -10); ctx.quadraticCurveTo(30, -8, 32, 8); ctx.lineTo(12, 8); ctx.closePath(); ink(ctx, PAL.white, 4);
  ctx.fillStyle = PAL.white; ctx.fillRect(-28, 4, 60, 6);
}
function flyingGoggles(ctx) {
  ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(0, 6, 40, 16, 0, Math.PI * 1.05, Math.PI * 1.95, true); ctx.stroke();
  ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 6; ctx.stroke();
  for (const sx of [-17, 17]) { circlePath(ctx, sx, 0, 15); ink(ctx, PAL.gold, 5); circlePath(ctx, sx, 0, 9); ink(ctx, '#ffc76b', 3); }
}
const CLOTHES = [
  // [t0 (launch), drawFn, vx, vy, spin, scale]
  [bt(12, 0.3), flyingShirt, -620, -900, 7, 0.9],
  [bt(12, 0.48), flyingOveralls, 700, -1050, -6, 0.9],
  [bt(12, 0.62), flyingGoggles, -420, -1250, 11, 0.9],
  [bt(12, 0.76), flyingShoe, 520, -760, -12, 0.85],
];

// ------------------------------------------------------------------ SHOT A · the quick change (bar 12)
const JX = 636, DX = 742; // Juno / Biscuit world x (in front of the flower bed + doghouse)
const BY_OPTS = { tod: 'golden', pad: 'none', crater: false, garageDoor: 1 };
function impact(t, tb, k = 9) { return hitAt(t, tb) ? Math.exp(-k * since(t, tb)) : 0; }

function shotA(ctx, t) {
  // camera: medium two-shot, slow push; zoom punches on the three hits
  const zoom = tween(t, T_IN - 0.3, T_WALK, 3.05, 3.3, ease.inOutSine);
  const camX = tween(t, T_IN - 0.3, T_WALK, 688, 676, ease.inOutSine);
  const camY = tween(t, T_IN - 0.3, T_WALK, 712, 722, ease.inOutSine);
  const sh1 = shake(t, T_POP - EPS, 7, 7), sh2 = shake(t, T_DOGHELM - EPS, 6, 8), sh3 = shake(t, T_GIRLHELM - EPS, 9, 7);
  const punch = 0.04 * impact(t, T_POP) + 0.025 * impact(t, T_DOGHELM) + 0.04 * impact(t, T_GIRLHELM);
  camera(ctx, { x: camX, y: camY, zoom: zoom * (1 + punch), dx: sh1.dx + sh2.dx + sh3.dx, dy: sh1.dy + sh2.dy + sh3.dy }, () => {
    drawBackyard(ctx, { t, ...BY_OPTS, camX, camY });
    drawGantry(ctx, RX, RY, RS, { t, rungs: RUNGS, light: TINT });
    drawRocket(ctx, RX, RY, RS, { t, booster: true, stickers: true, hatch: 1, light: TINT });
    quickChange(ctx, t);
  });
}

function quickChange(ctx, t) {
  const popped = hitAt(t, T_POP);
  const whirling = t >= T_WHIRL && !popped;
  const spun = t >= T_WHIRL;

  // ---------------- Biscuit (sitting beside her, facing her)
  const dogHelm = hitAt(t, T_DOGHELM);
  const dSince = since(t, T_DOGHELM);
  const dSquash = dogHelm ? 1 - 0.16 * wobble(t, T_DOGHELM - EPS, 3.2, 6) - 0.16 * Math.exp(-14 * dSince) : 1;
  let dExpr = 'happy', dEars, dLook = [-0.4, -0.1], dTilt = 0;
  if (whirling) { dExpr = 'surprised'; dEars = 1; dLook = [-0.9, -0.3]; dTilt = 0.18 * Math.sin((t - T_WHIRL) * 26); }
  else if (popped && !dogHelm) { dExpr = t < T_REACH ? 'awe' : 'surprised'; dLook = t < T_REACH ? [-0.6, -0.5] : [-0.1, -1]; dEars = t < T_REACH ? 0.8 : undefined; }
  else if (dogHelm && dSince < 0.3) { dExpr = 'surprised'; dLook = [0, -1]; }
  else if (dogHelm) { dExpr = 'excited'; dLook = t > T_GIRLHELM + 0.2 ? [0.3, 0] : [-0.6, -0.9]; }
  const dogPose = {
    t, stance: 'sit', facing: -1, suit: popped ? 'space' : 'none', helmet: dogHelm ? 1 : 0, expr: dExpr, ears: dEars,
    look: dLook, squash: dSquash, light: TINT, wag: dogHelm ? 1.2 : 0.8, headTilt: dTilt,
  };
  longShadow(ctx, DX + 4, GY, 64, 80, { ...BY_OPTS, camX: 690, camY: 700 });
  drawDog(ctx, DX, GY, CS, dogPose);
  const dA = dogAnchors(DX, GY, CS, { ...dogPose, squash: 1 });
  const dogBowl = { x: dA.head[0] - 3 * CS, y: dA.head[1] - 6 * CS, r: 68 * CS };

  // ---------------- Juno
  longShadow(ctx, JX, GY, 56, 176, { ...BY_OPTS, camX: 690, camY: 700 });
  // POP puff ring (behind her)
  if (popped) popPuffs(ctx, t, false);
  if (!spun) {
    // wind-up: crouch, fists, determined
    const k = smoothstep(T_IN - 0.3, T_WHIRL, t);
    drawGirl(ctx, JX, GY, CS, {
      t, facing: 0.6, expr: 'determined', squash: 1 - 0.12 * k, tilt: -0.08 * k,
      armL: { a: 0.6 + 0.5 * k, b: -1.5, hand: 'fist' }, armR: { a: 0.6 + 0.5 * k, b: -1.5, hand: 'fist' }, light: TINT,
    });
  } else if (whirling) {
    whirl(ctx, t);
  } else {
    drawSuited(ctx, t, dogBowl);
  }
  if (popped) popPuffs(ctx, t, true);
  // flying clothes (launched from the whirl, arcing off-frame)
  for (let i = 0; i < CLOTHES.length; i++) {
    const [t0, fn, vx, vy, spin, sc] = CLOTHES[i];
    const u = t - t0;
    if (u < 0 || u > 1.2) continue;
    const x = JX + vx * u * 1.1, y = GY - 110 + vy * u * 0.75 + 1500 * u * u;
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin * u); ctx.scale(sc * CS * 1.5, sc * CS * 1.5);
    ctx.globalAlpha *= clamp(u / 0.04);
    fn(ctx);
    ctx.restore();
  }
  // helmet plonk FX
  if (dogHelm) {
    glassGlint(ctx, dogBowl.x, dogBowl.y, dogBowl.r, dSince / 0.5);
    burstLines(ctx, dogBowl.x, dogBowl.y - dogBowl.r * 0.2, dogBowl.r * 1.2, dogBowl.r * 2.2, dSince / 0.28, 9, -0.2, INK, 2.5);
  }
}

function popPuffs(ctx, t, front) {
  const u = since(t, T_POP);
  if (u > 0.6) return;
  // a quick ring of puffs flung outward (small, gone in ~0.3 s so the new suit reads at once)
  for (let i = 0; i < 10; i++) {
    if ((i % 3 === 0) !== front) continue;
    const an = (i / 10) * TAU + 0.3;
    const d = 40 + 95 * ease.outCubic(clamp(u / 0.3));
    smokePuff(ctx, JX + Math.cos(an) * d * 1.1, GY - 78 + Math.sin(an) * d * 0.8, front ? 13 : 19, {
      seed: 40 + i, u: clamp(0.2 + u / 0.32), n: 5, lw: 2.5, fill: '#fff4e6', shadeCol: '#f0c9b8',
    });
  }
  if (!front) return;
  // star burst
  const a = 1 - clamp((u - 0.1) / 0.3);
  for (let i = 0; i < 7; i++) {
    const an = (i / 7) * TAU - 0.4, d = 60 + 110 * ease.outCubic(clamp(u / 0.4));
    sparkle(ctx, JX + Math.cos(an) * d, GY - 90 + Math.sin(an) * d * 0.9, 13 * a + 3, '#fff6c0', a);
  }
  burstLines(ctx, JX, GY - 90, 70, 150, u / 0.25, 12, 0.2, '#ffffff', 4);
}

// the cartoon whirl (she spins so fast she is a blur; only her head reads)
function whirl(ctx, t) {
  const u = clamp((t - T_WHIRL) / (T_POP - T_WHIRL));
  const grow = ease.outBack(clamp(u / 0.2));
  const cx = JX, top = GY - 178, bot = GY - 4;
  const hw = (y) => lerp(20, 54, clamp((bot - y) / (bot - top))) * (0.5 + 0.5 * grow);
  const cols = u < 0.55 ? ['#3f7fe8', '#e8453c', '#fffaf0', '#e8453c', '#2c5fb8'] : ['#f4efe6', '#ff8a3d', '#fffaf0', '#e8453c', '#d6cfc2'];
  // dust at the base
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + t * 9;
    smokePuff(ctx, cx + Math.cos(a) * 42, GY - 6 + Math.sin(a) * 6, 18, { seed: 60 + i, u: 0.3 + 0.15 * Math.sin(t * 20 + i), n: 4, lw: 2.5 });
  }
  const shape = (yTop) => {
    ctx.beginPath();
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const y = lerp(bot, yTop, i / n), w = hw(y) * (1 + 0.1 * Math.sin(t * 40 + i * 1.7));
      i ? ctx.lineTo(cx + w, y) : ctx.moveTo(cx + w, y);
    }
    for (let i = n; i >= 0; i--) {
      const y = lerp(bot, yTop, i / n), w = hw(y) * (1 + 0.1 * Math.sin(t * 37 + i * 2.3));
      ctx.lineTo(cx - w, y);
    }
    ctx.closePath();
  };
  const streaks = (yTop, rows, speed, seed) => {
    ctx.save(); shape(yTop); ctx.clip();
    ctx.fillStyle = cols[2]; ctx.fillRect(cx - 80, yTop - 10, 160, bot - yTop + 20);
    for (let i = 0; i < rows; i++) {
      const y = lerp(bot, yTop, (i + 0.5) / rows);
      const off = ((t * speed + i * 97) % 240) - 120;
      ctx.fillStyle = cols[(i + seed) % cols.length];
      ctx.fillRect(cx - 100 + off * 0.6, y - 5, 60 + 50 * hash01(i, seed), 11);
      ctx.fillRect(cx - 100 + off * 0.6 - 150, y - 5, 60 + 50 * hash01(i, seed), 11);
    }
    ctx.restore();
  };
  // her head (spinning: front, 3/4, back …) with flailing hands above the blur
  const p = ((t - T_WHIRL) * 4.2) % 1;
  const back = p > 0.3 && p < 0.7;
  const sp = Math.sin(p * TAU);
  const facing = back ? 1 : sp >= 0 ? Math.max(0.05, sp) : Math.min(-0.05, sp);
  streaks(top, 16, 1500, 0);
  drawGirl(ctx, cx, GY - 14, CS * (0.8 + 0.2 * grow), {
    t, facing, view: back ? 'back' : 'front', expr: 'laugh', suit: u < 0.55 ? 'overalls' : 'space', goggles: 'none',
    armL: { a: 2.7, b: 0.3, hand: 'spread' }, armR: { a: 2.7, b: 0.3, hand: 'spread' }, shadow: false, light: TINT, lift: 14,
  });
  // the blur swallows her body (below the chin)
  const chin = GY - 14 - 14 * CS - 250 * CS;
  streaks(chin, 11, 1800, 2);
  ctx.save(); shape(chin); ink(ctx, null, 4); ctx.restore();
  // swirl arcs wrapping the column
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const y = lerp(bot - 16, top + 20, i / 5);
    const w = hw(y) + 18;
    const a0 = (t * 26 + i * 1.3) % TAU;
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.ellipse(cx, y, w, w * 0.24, 0, a0, a0 + 2.4); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const y = lerp(bot - 30, top + 40, i / 3);
    const w = hw(y) + 34;
    const a0 = (t * 22 + i * 2.1 + 1) % TAU;
    ctx.beginPath(); ctx.ellipse(cx, y, w, w * 0.25, 0, a0, a0 + 1.1); ctx.stroke();
  }
  ctx.restore();
}

// after the POP: spacesuit, two helmets.
//   small one presented on her right palm → a quick flick hops it onto Biscuit's head (PLONK on b2)
//   big one tucked under her left arm → dip, fling, it flips once overhead and lands on her (PLONK on b3)
const T_FLICK = T_DOGHELM - 0.15;
function drawSuited(ctx, t, dogBowl) {
  const u = since(t, T_POP);
  const girlHelm = hitAt(t, T_GIRLHELM);
  const gSince = since(t, T_GIRLHELM);
  const lean = keyframes(t, [[T_POP, 0], [T_REACH - 0.1, 0], [T_REACH + 0.1, 0.14, ease.outBack], [T_FLICK - 0.02, 0.1],
    [T_FLICK + 0.06, 0.2, ease.outCubic], [T_DOGHELM + 0.15, 0.04], [T_TOSS - 0.2, 0]]);
  let squash = 1 + 0.18 * wobble(t, T_POP - EPS, 3, 5.5) + 0.12 * Math.exp(-12 * u);
  squash -= 0.07 * smoothstep(T_TOSS - 0.2, T_TOSS - 0.06, t) * (1 - smoothstep(T_TOSS - 0.06, T_TOSS + 0.04, t));
  squash += 0.06 * smoothstep(T_TOSS - 0.06, T_TOSS, t) * (1 - smoothstep(T_TOSS + 0.02, T_TOSS + 0.15, t));
  if (girlHelm) squash -= 0.15 * Math.exp(-12 * gSince) + 0.07 * wobble(t, T_GIRLHELM - EPS, 3.3, 6);
  const facing = t < T_GIRLHELM + 0.2 ? 0.75 : lerp(0.75, 0.2, smoothstep(T_GIRLHELM + 0.2, T_GIRLHELM + 0.45, t));
  const base = { t, suit: 'space', light: TINT, squash, facing, tilt: lean };
  const bigR = 134 * CS, smR = dogBowl.r;

  // ---- right arm + small helmet
  let armR, small = null;
  if (t < T_FLICK) {
    const lift = smoothstep(T_REACH - 0.1, T_REACH + 0.12, t) + 0.25 * smoothstep(T_FLICK - 0.12, T_FLICK - 0.02, t);
    // presented on her fingertips, held out to the side so the glass stays clear of her face
    armR = { a: 1.05 + 0.6 * lift, b: 0.5 - 0.25 * lift, hand: 'open' };
    const h = girlAnchors(JX, GY, CS, { ...base, armR }).handR;
    small = { x: h[0] + smR * 0.45, y: h[1] - smR * 0.92, rot: 0.08 };
  } else if (t < T_DOGHELM - EPS) {
    // flick: palm snaps up, the bowl hops over onto his head
    const k = clamp((t - T_FLICK) / (T_DOGHELM - EPS - T_FLICK));
    const armF = { a: 1.8, b: 0.19, hand: 'open' }; // = the end of the presenting pose (lift 1.25)
    const h = girlAnchors(JX, GY, CS, { ...base, tilt: 0.1, armR: armF }).handR;
    const x0 = h[0] + smR * 0.45, y0 = h[1] - smR * 0.92;
    small = { x: lerp(x0, dogBowl.x, k), y: lerp(y0, dogBowl.y, k * k) - 34 * Math.sin(Math.PI * k), rot: lerp(0.08, 0, k) + 0.35 * Math.sin(Math.PI * k) };
    armR = { a: 1.8 + 0.2 * ease.outCubic(k), b: 0.19, hand: 'spread' };
  } else if (t < T_GIRLHELM + 0.15) {
    const k = smoothstep(T_DOGHELM + 0.1, T_DOGHELM + 0.4, t);
    armR = { a: lerp(1.95, 1.0, k), b: lerp(0.25, -1.6, k), hand: k > 0.6 ? 'fist' : 'spread' };
  } else {
    armR = { a: 1.0, b: -1.6, hand: 'fist' };
  }

  // ---- left arm + big helmet
  let armL, big = null, bigBehind = false;
  const fin = girlAnchors(JX, GY, CS, { ...base, tilt: 0, helmet: 1 }).helmet;
  if (t < T_TOSS - 0.06) {
    // tucked under her arm at the hip; dips as she crouches to fling it
    const dip = smoothstep(T_TOSS - 0.2, T_TOSS - 0.06, t);
    armL = { a: 0.45 + 0.1 * dip, b: 0.85, hand: 'open' };
    const h = girlAnchors(JX, GY, CS, { ...base, armL }).handL;
    big = { x: h[0] - bigR * 0.35, y: h[1] - bigR * 0.35 + 6 * dip, rot: 0.15 };
    bigBehind = true;
  } else if (!girlHelm) {
    // fling (arm whips up) → one flip overhead → drops onto her head
    const sw = smoothstep(T_TOSS - 0.06, T_TOSS + 0.03, t);
    armL = { a: lerp(0.55, 2.5, sw), b: lerp(0.85, 0.3, sw), hand: 'spread' };
    const h0 = girlAnchors(JX, GY, CS, { ...base, armL: { a: 0.55, b: 0.85 } }).handL;
    const x0 = h0[0] - bigR * 0.35, y0 = h0[1] - bigR * 0.35;
    const k = clamp((t - (T_TOSS - 0.06)) / (T_GIRLHELM - EPS - (T_TOSS - 0.06)));
    big = { x: lerp(x0, fin.x, ease.inOutSine(k)), y: lerp(y0, fin.y, k) - 230 * CS * 4 * k * (1 - k) - 40 * k * (1 - k), rot: 0.15 - (TAU + 0.15) * ease.inOutSine(k) };
    if (k > 0.7) armL = { a: lerp(2.5, 2.2, (k - 0.7) / 0.3), b: 0.3, hand: 'spread' };
  } else {
    armL = gSince < 0.3 ? { a: 2.2, b: 0.3, hand: 'spread' } : { a: 1.0, b: -1.6, hand: 'fist' };
  }
  const expr = t < T_REACH ? 'excited' : t < T_DOGHELM + 0.2 ? 'grin' : !girlHelm ? (t < T_TOSS ? 'determined' : 'awe') : gSince < 0.25 ? 'wince' : 'grin';
  const look = t < T_REACH ? [0.1, -0.2] : t < T_DOGHELM + 0.2 ? [0.7, 0.7] : !girlHelm ? (t < T_TOSS ? [0.3, 0] : [0, -1]) : [0.1, 0];
  const pose = { ...base, armL, armR, expr, look, helmet: girlHelm ? 1 : 0 };

  if (big && bigBehind) bowl(ctx, big.x, big.y, bigR, big.rot);
  drawGirl(ctx, JX, GY, CS, pose);
  if (small) bowl(ctx, small.x, small.y, smR, small.rot);
  if (big && !bigBehind) bowl(ctx, big.x, big.y, bigR, big.rot);
  if (girlHelm) {
    const hA = girlAnchors(JX, GY, CS, pose).helmet;
    glassGlint(ctx, hA.x, hA.y, hA.r, gSince / 0.55);
    burstLines(ctx, hA.x, hA.y - hA.r * 0.1, hA.r * 1.12, hA.r * 1.9, gSince / 0.28, 10, 0.1, INK, 3);
  }
}

// Screen-space radial glow that only rasterises the part inside the frame (glow() fills the whole 2r box)
function screenGlow(ctx, x, y, r, color, a) {
  const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r), y1 = Math.min(H, y + r);
  if (x1 <= x0 || y1 <= y0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.4, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// ------------------------------------------------------------------ SHOT B · hero walk (bar 13)
// Low camera: the horizon sits low, the rocket towers out of frame, the pair walk toward the lens
// (growing), a footfall on every beat, the sun flaring just past Juno's helmet.
function shotB(ctx, t) {
  const u = clamp((t - T_WALK) / (T_CLIMB - T_WALK));
  const e = ease.inOutSine(u);
  // LOW ANGLE: the camera sits in the grass, so the horizon is low in frame and the rocket (centred
  // between the pair) towers into the sky; a slow push-in while the camera tilts up a touch.
  const zoom = lerp(1.26, 1.33, e);
  const camX = lerp(1092, 1084, u), camY = GY - (1062 - H / 2) / zoom; // the lawn's far edge stays at y ≈ 1062
  const sunW = [650 + (camX - 960) * 0.85, 470 + (camY - 540) * 0.85];
  const sun = [W / 2 + (sunW[0] - camX) * zoom, H / 2 + (sunW[1] - camY) * zoom];
  camera(ctx, { x: camX, y: camY, zoom }, () => {
    drawBackyard(ctx, { t, ...BY_OPTS, camX, camY });
    drawGantry(ctx, RX, RY, RS, { t, rungs: RUNGS, light: TINT });
    drawRocket(ctx, RX, RY, RS, { t, booster: true, stickers: true, hatch: 1, light: TINT });
  });
  // warm backlight haze: flat stepped halos (cheap, and in keeping with the flat style)
  ctx.save();
  ctx.fillStyle = '#ffd88c';
  for (const [r, a] of [[460, 0.1], [250, 0.11]]) { ctx.globalAlpha = a; circlePath(ctx, sun[0], sun[1], r); ctx.fill(); }
  ctx.restore();
  // characters in the foreground (screen space), walking toward the camera: a footfall on every beat
  const b = beatAt(t);
  const yJ = lerp(1012, 1056, e);
  const sJ = lerp(1.3, 1.6, e);
  const xJ = lerp(566, 540, e), xD = lerp(1452, 1478, e);
  const stepK = pulse(t, 8);
  // long backlit shadows reaching toward the camera
  for (const [x, w, hgt] of [[xJ, 120 * sJ, 520 * sJ], [xD, 130 * sJ, 240 * sJ]]) {
    const g = ctx.createLinearGradient(0, yJ, 0, yJ + hgt);
    g.addColorStop(0, rgba('#6a2c62', 0.42)); g.addColorStop(1, rgba('#6a2c62', 0));
    ctx.fillStyle = g;
    const lean = (x - sun[0]) * 0.35;
    ctx.beginPath(); ctx.moveTo(x - w / 2, yJ - 4); ctx.lineTo(x + w / 2, yJ - 4);
    ctx.lineTo(x + w + lean, yJ + hgt); ctx.lineTo(x - w + lean, yJ + hgt); ctx.closePath(); ctx.fill();
  }
  // footfall dust (slow-mo: drifts lazily)
  for (let i = 0; i < 4; i++) {
    const du = (t - bt(13, i)) / 1.8;
    if (du <= 0 || du >= 1) continue;
    const foot = i % 2 ? 1 : -1;
    smokePuff(ctx, xJ + foot * 26 * sJ - 40 * du, yJ + 2, 24 * sJ + 20 * du, { seed: 80 + i, u: du, n: 5, lw: 3, fill: '#f8e2c8', shadeCol: '#e0b9a0' });
    smokePuff(ctx, xD + foot * 34 * sJ + 40 * du, yJ, 20 * sJ + 16 * du, { seed: 90 + i, u: du, n: 4, lw: 3, fill: '#f8e2c8', shadeCol: '#e0b9a0' });
  }
  drawDog(ctx, xD, yJ - 6 - 7 * sJ * hop(t, 1), sJ * 0.96, {
    t, stance: 'walk', facing: -1, suit: 'space', helmet: 1, expr: 'determined', look: [0.35, 0.2], light: TINT,
    squash: 1 - 0.06 * stepK, turn: 0.6,
  });
  // Juno: heavy, deliberate slow-mo steps. She rises between footfalls and drops onto each beat
  // (squash), her weight rolls onto the planted leg, and her fists pump in time.
  const ph = b / 2, w = TAU * ph;
  const cs = Math.cos(w);
  const pump = (f) => ({ a: 0.24 + 0.2 * f, b: -0.04 - 0.62 * f, hand: 'fist' });
  drawGirl(ctx, xJ, yJ, sJ, {
    t, stance: 'walk', phase: ph, facing: 0.12, suit: 'space', helmet: 1, expr: 'determined', look: [0.05, 0.12], light: TINT,
    squash: 1 - 0.06 * stepK, lift: 13 * hop(t, 1), tilt: 0.04 * Math.sin(w), headTilt: -0.025 * Math.sin(w),
    armR: pump((1 - cs) / 2), armL: pump((1 + cs) / 2),
  });
  foregroundGrass(ctx, t);
  // drifting pollen motes (slow-mo)
  for (let i = 0; i < 24; i++) {
    const x = ((hash01(i, 5) * 2200 + (t - T_WALK) * (18 + 26 * hash01(i, 6))) % 2100) - 90;
    const y = hash01(i, 7) * 860 + 24 * Math.sin((t - T_WALK) * 0.9 + i) - (t - T_WALK) * (10 + 10 * hash01(i, 8));
    const r = 2 + 4 * hash01(i, 9);
    // soft halo as a flat low-alpha disc (a radial gradient per mote is needlessly expensive)
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffe7a6'; circlePath(ctx, x, y, r * 3); ctx.fill(); ctx.restore();
    sparkle(ctx, x, y, r * (1 + 0.6 * pulse(t, 5)), '#fff6d8', 0.7);
  }
  lensFlare(ctx, sun, t, 1);
}

function foregroundGrass(ctx, t) {
  ctx.save();
  for (let i = 0; i < 30; i++) {
    const x = -40 + i * 68 + 30 * hash01(i, 1);
    const h = 44 + 74 * hash01(i, 2);
    const sw = 12 * sway(t + hash01(i, 3) * 0.6, 2) + 6;
    const col = hash01(i, 4) < 0.5 ? '#3f8f46' : '#4aa84b';
    ctx.beginPath();
    ctx.moveTo(x - 11, H + 10);
    ctx.quadraticCurveTo(x - 4 + sw * 0.4, H - h * 0.5, x + sw, H - h);
    ctx.quadraticCurveTo(x + 6 + sw * 0.3, H - h * 0.45, x + 13, H + 10);
    ctx.closePath();
    ink(ctx, col, 4);
  }
  ctx.restore();
}

// Lens flare: glow + ghosts along the line from the sun through the frame centre + an anamorphic streak
function lensFlare(ctx, sun, t, amt) {
  if (amt <= 0) return;
  const [sx, sy] = sun;
  const vx = W / 2 - sx, vy = H / 2 - sy;
  const br = amt * (0.85 + 0.15 * pulse(t, 4));
  screenGlow(ctx, sx, sy, 240, '#fff6d8', 0.6 * br);
  ctx.save();
  ctx.globalAlpha = 0.4 * br;
  const gs = ctx.createLinearGradient(sx - 800, 0, sx + 800, 0);
  gs.addColorStop(0, 'rgba(255,220,170,0)'); gs.addColorStop(0.5, 'rgba(255,244,220,1)'); gs.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = gs; ctx.fillRect(sx - 800, sy - 3, 1600, 6);
  ctx.restore();
  const ghosts = [[0.3, 22, '#ffd07a', 0.28], [0.55, 54, '#ff9ac0', 0.13], [0.85, 14, '#bfe6ff', 0.34], [1.2, 86, '#b48cff', 0.09], [1.5, 34, '#ffe27a', 0.18], [1.75, 18, '#9af0e0', 0.2]];
  for (const [k, r, c, a] of ghosts) {
    const x = sx + vx * k, y = sy + vy * k;
    ctx.save();
    ctx.globalAlpha = a * br;
    ctx.fillStyle = c;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const an = (i / 6) * TAU + 0.3; const px = x + Math.cos(an) * r, py = y + Math.sin(an) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ SHOT C · gantry climb + hatch (bar 14)
const CLIMB_BEATS = [T_CLIMB, bt(14, 1), bt(14, 2), T_WAVE];
const START_RUNG = RUNG_Y.length - 4; // lands on this rung on 33.74, then +1 per beat → the deck on 35.54
function climbState(t) {
  let r = START_RUNG, land = CLIMB_BEATS[0];
  for (let i = 1; i < CLIMB_BEATS.length; i++) {
    const a = CLIMB_BEATS[i - 1] + 0.18, b2 = CLIMB_BEATS[i] - EPS;
    if (t >= b2) { r = START_RUNG + i; land = CLIMB_BEATS[i]; }
    else if (t > a) { r = START_RUNG + i - 1 + ease.inOutCubic((t - a) / (b2 - a)); break; }
    else break;
  }
  return { r, land };
}
const rungY = (r) => { const i = Math.floor(r), f = r - i; const a = RUNG_Y[clamp(i, 0, RUNG_Y.length - 1)], b = RUNG_Y[clamp(i + 1, 0, RUNG_Y.length - 1)]; return lerp(a, b, f); };

function shotC(ctx, t) {
  const cs = climbState(t);
  const feetY = rungY(cs.r);
  const zipK = clamp((t - T_ZIP) / 0.07);
  // camera: rides up with her (a beat behind), then settles on the deck + hatch and pushes in
  // (the camera trails her by ~a quarter of a rung, so each step lifts her in frame, then it catches up)
  const camY = keyframes(t, [[T_CLIMB - 0.1, rungY(START_RUNG) - 84], [T_WAVE, DECK_Y - 80, ease.inOutSine], [T_ZIP, DECK_Y - 82], [T_SLAM, DECK_Y - 86], [T_END, DECK_Y - 92]]);
  const camX = keyframes(t, [[T_CLIMB, LADDER_X - 44], [T_WAVE, LADDER_X - 58], [T_ZIP, LADDER_X - 64], [T_SLAM - 0.06, (LADDER_X + HATCH_X) / 2 + 6, ease.inOutCubic], [T_END, (LADDER_X + HATCH_X) / 2]]);
  const zoom = keyframes(t, [[T_CLIMB, 2.9], [T_WAVE, 3.0], [T_ZIP, 3.02], [T_SLAM - 0.06, 2.4, ease.inOutCubic], [T_END, 2.5]]);
  const sh = shake(t, T_SLAM - EPS, 18, 7);
  const sh2 = shake(t, T_WAVE - EPS, 4, 9);
  const onLadder = t < T_WAVE - EPS;
  const atTop = !onLadder && t < T_ZIP;
  const zipping = t >= T_ZIP && zipK < 1;
  const inside = zipK >= 1;
  const hatch = t < T_SLAM - 0.09 ? 1 : 1 - ease.inQuad(clamp((t - (T_SLAM - 0.09)) / (0.09 - EPS)));
  const slammed = hitAt(t, T_SLAM);
  const faceK = clamp((t - T_FACES) / 0.14);
  const punch = 0.05 * impact(t, T_SLAM, 10);

  camera(ctx, { x: camX, y: camY, zoom: zoom * (1 + punch), dx: sh.dx + sh2.dx, dy: sh.dy + sh2.dy, rot: sh.rot }, () => {
    drawBackyard(ctx, { t, ...BY_OPTS, camX, camY });
    drawGantry(ctx, RX, RY, RS, { t, rungs: RUNGS, light: TINT });
    // Juno + Biscuit on the ladder / deck / zipping along the arm (behind the hull + open door leaf)
    if (onLadder) climber(ctx, t, feetY, cs);
    else if (atTop) topWave(ctx, t);
    else if (zipping) zipper(ctx, t, zipK);
    const rShake = slammed ? Math.exp(-5 * since(t, T_SLAM)) : 0;
    drawRocket(ctx, RX, RY, RS, {
      t, booster: true, stickers: true, hatch, light: TINT, shake: rShake,
      hatchClip: true,
      hatchContent: inside && hatch > 0.02 ? (c) => doorwayWave(c, t) : null,
      crew: t >= T_FACES,
      crewPose: {
        girl: { dy: 10 + 120 * (1 - ease.outBack(faceK)), expr: 'grin' },
        dog: { dy: 4 + 90 * (1 - ease.outBack(clamp((t - T_FACES - 0.05) / 0.14))), expr: 'happy', tongue: 1 },
      },
    });
    if (zipping) zipLines(ctx, t, zipK);
    // slam FX
    if (slammed) {
      const u = since(t, T_SLAM);
      const hx = HATCH_X, hy = RY + (ROCKET_HATCH.sillY + ROCKET_HATCH.topY) / 2 * RS;
      // impact lines hug the door's tall outline and skip the porthole side (no lines across the glass)
      {
        const bu = u / 0.3;
        if (bu < 1) {
          const g = ease.outCubic(bu);
          ctx.save();
          ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.globalAlpha *= 1 - ease.inCubic(bu);
          ctx.beginPath();
          for (let i = 0; i < 14; i++) {
            const an = (i / 14) * TAU + 0.11;
            if (Math.cos(an) < -0.35 || Math.sin(an) > 0.8) continue; // left = the portholes, below = the name
            const ex = Math.cos(an), ey = Math.sin(an);
            const rx0 = 48 + 30 * g, rx1 = 70 + 60 * g, ry0 = 112 + 30 * g, ry1 = 134 + 60 * g;
            ctx.moveTo(hx + ex * rx0, hy + ey * ry0); ctx.lineTo(hx + ex * rx1, hy + ey * ry1);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
      // dust squeezed out all round the door seam (the door's outline: jambs + arch), puffing outward
      const H2 = ROCKET_HATCH, hw = H2.w / 2 + 4, archY = H2.topY + H2.w / 2;
      const seam = [[-1, 0.15], [-1, 0.55], [-1, 0.95], [1, 0.2], [1, 0.6], [1, 1.0], [0, 0]];
      for (let i = 0; i < seam.length; i++) {
        const [side, f] = seam[i];
        let lx, ly, nx, ny;
        if (side === 0) { lx = H2.x; ly = H2.topY - 2; nx = 0; ny = -1; } // arch top
        else if (f > 0.9) { const an = -Math.PI / 2 + side * 0.9; lx = H2.x + Math.cos(an) * hw; ly = archY + Math.sin(an) * hw; nx = Math.cos(an); ny = Math.sin(an); }
        else { lx = H2.x + side * hw; ly = lerp(H2.sillY, archY, f); nx = side; ny = 0; }
        const push = (6 + 20 * ease.outCubic(clamp(u / 0.25))) * (1 + 0.3 * hash01(i, 3));
        smokePuff(ctx, RX + lx * RS + nx * push, RY + ly * RS + ny * push, 12 + 5 * hash01(i, 4), { seed: 120 + i, u: clamp(0.18 + u / 0.4), n: 4, lw: 2.2 });
      }
      const k = u < 0.22 ? ease.outBack(clamp(u / 0.1), 3) : 1 - ease.inBack(clamp((u - 0.22) / 0.1), 2);
      cartoonText(ctx, 'KLANG!', hx + 128, hy - 70, { size: 46, fill: PAL.yellow, rot: 0.14 + 0.1 * wobble(t, T_SLAM - EPS, 5, 8), scale: k, lw: 7 });
    }
  });
}

// Biscuit tucked under her left (screen-left) arm; drawn before her so the arm wraps over him
function tuckedDog(ctx, t, jx, jy, s, extra = {}) {
  drawDog(ctx, jx - 40 * s / CS * 1.0, jy - 38 * s / CS, s * 0.95, {
    t, stance: 'float', hairFloat: 0.1, facing: -1, suit: 'space', helmet: 1, light: TINT, tilt: 0.1, ...extra,
  });
}
const HOLD_ARM = { a: 0.35, b: 1.2, hand: 'open' };

function climber(ctx, t, feetY, cs) {
  const jx = LADDER_X + 2;
  const sl = t - (cs.land - EPS);
  const squash = sl >= 0 ? 1 - 0.07 * Math.exp(-11 * sl) : 1;
  // right hand grips the rail above her helmet: it slides down relative to her as she hauls herself up
  // (a pull), then shoots up for a fresh grip just after each landing
  const railX = LADDER_X + GR.ladderW / 2 - 2;
  const fr = cs.r - Math.floor(cs.r + 1e-6);
  const rising = t > CLIMB_BEATS[0] && fr > 1e-4;
  let rel = rising ? lerp(150, 112, ease.inOutSine(fr)) : 150;
  if (!rising && sl >= 0 && sl < 0.14) rel = lerp(112, 150, ease.outBack(clamp((sl - 0.01) / 0.12)));
  const handY = feetY - rel * (CS / 0.42);
  const P = { x: jx, y: feetY, s: CS, facing: 1, tilt: 0 };
  // legs: the stepping knee lifts while she rises (run cycle, half a cycle per rung)
  const phase = 0.5 * Math.floor(cs.r + 1e-6) + 0.25 * Math.sin(Math.PI * fr) ** 0.7;
  const pose = { t, view: 'back', stance: 'run', phase, suit: 'space', helmet: 1, light: TINT, squash, shadow: false };
  const armR = armIK(P, 1, [railX, handY], { hand: 'fist', elbowOut: true, pose });
  tuckedDog(ctx, t, jx, feetY, CS, { expr: 'alert', look: [0.2, 0.9], ears: -0.2, wag: 0.3 });
  drawGirl(ctx, jx, feetY, CS, { ...pose, armR, armL: HOLD_ARM });
}

function topWave(ctx, t) {
  const u = since(t, T_WAVE);
  const hopY = 16 * Math.sin(Math.PI * clamp(u / 0.2));
  const lean = keyframes(t, [[T_WAVE, 0], [T_ZIP - 0.08, 0], [T_ZIP, 0.22, ease.outCubic]]); // anticipation: rocks back before the dash
  const crouch = keyframes(t, [[T_WAVE, 1], [T_ZIP - 0.08, 1], [T_ZIP, 0.86, ease.outCubic]]);
  const jx = LADDER_X + 2, jy = DECK_Y - hopY;
  tuckedDog(ctx, t, jx, jy, CS, { expr: 'excited', pawWave: 1, look: [0.5, 0.1] });
  drawGirl(ctx, jx, jy, CS, {
    t, facing: 0.2, suit: 'space', helmet: 1, light: TINT, expr: 'laugh', armR: 'wave', armL: HOLD_ARM,
    squash: crouch * (1 + 0.1 * wobble(t, T_WAVE - EPS, 3, 6)), tilt: lean, shadow: false,
  });
  if (u < 0.4) {
    const a = girlAnchors(jx, jy, CS, { facing: 0.2, suit: 'space', helmet: 1, armR: 'wave' }).handR;
    for (let i = 0; i < 3; i++) sparkle(ctx, a[0] + 16 + i * 12, a[1] - 18 - i * 14, (9 - i * 2) * (1 - u / 0.4), '#fff6c0', 1 - u / 0.4);
  }
}

function zipper(ctx, t, k) {
  // stretched smear from the ladder top to the doorway
  const x = lerp(LADDER_X + 2, HATCH_X + 10, k);
  ctx.save();
  ctx.translate(x, DECK_Y); ctx.scale(1 + 1.2 * Math.sin(Math.PI * k), 1 - 0.18 * Math.sin(Math.PI * k)); ctx.translate(-x, -DECK_Y);
  tuckedDog(ctx, t, x, DECK_Y, CS, { expr: 'surprised', ears: 1 });
  drawGirl(ctx, x, DECK_Y, CS, { t, facing: -1, stance: 'run', phase: 0.3, suit: 'space', helmet: 1, light: TINT, expr: 'grin', armL: HOLD_ARM, shadow: false, tilt: -0.2 });
  ctx.restore();
}
function zipLines(ctx, t, k) {
  const x0 = lerp(LADDER_X, HATCH_X, k);
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const y = DECK_Y - 18 - i * 26;
    const len = 90 + 60 * hash01(i, 3);
    ctx.globalAlpha = 0.85 * (1 - k * 0.4);
    ctx.lineWidth = 5 - i * 0.4;
    ctx.beginPath(); ctx.moveTo(x0 + 60 + 20 * hash01(i, 4), y); ctx.lineTo(x0 + 60 + len + 40 * k, y); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 3; i++) smokePuff(ctx, LADDER_X - 10 - i * 40, DECK_Y - 12, 20 - i * 3, { seed: 130 + i, u: clamp(0.25 + k * 0.5 - i * 0.08), n: 5, lw: 2.5 });
}
// inside the doorway (rocket-local units; s = character scale / rocket scale): waving bye-bye as the door shuts
function doorwayWave(ctx, t) {
  const x = ROCKET_HATCH.x - 2, y = ROCKET_HATCH.sillY - 6;
  const s = CS / RS;
  drawDog(ctx, x - 30, y + 2, s * 0.95, { t, stance: 'sit', facing: 1, suit: 'space', helmet: 1, expr: 'excited', pawWave: 1 });
  drawGirl(ctx, x + 12, y, s, { t, facing: 0, suit: 'space', helmet: 1, expr: 'laugh', armR: 'wave', shadow: false });
}

// ------------------------------------------------------------------ scene
export default {
  id: 's05_suit_up',
  start: 28.937,
  end: 36.137,
  transition: { type: 'whip', dur: 0.4, dir: 1 },
  draw(ctx, t) {
    // Clip to our own frame: during the engine's whip-in we are drawn translated, and the backyard
    // world (x -460..2380) would otherwise paint over the outgoing s04 frame.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    if (t < T_WALK - EPS) shotA(ctx, t);
    else if (t < T_CLIMB - EPS) shotB(ctx, t);
    else shotC(ctx, Math.min(t, T_END + 1.5));
    ctx.restore();
  },
};
