// s09 — Zero-G fun in the capsule (bars 21–22, 50.54 → 55.34). Bass out, floaty.
//
// One continuous cabin shot (drawCockpit view 'cabin'), helmets off, everything floating:
//   * Juno (left) does ONE slow forward somersault across the two bars, laughing, pigtails floating.
//   * Biscuit (right) floats upside-down, paddling, while kibble pops out of a torn floating bag (one per
//     beat, the bag puffs) and drifts into his mouth — CHOMP, one piece per beat from 51.14 (mouth wide open
//     just before, snapped shut ON the beat, squash + crumbs + a "nom!"; the 6th is a "GULP!").
//   * 54.74 (bar 22 b4): the ringed planet has slid into the porthole — Juno gasps and points, Biscuit
//     whip-rolls upright with a "!" (the 7th kibble sails past his gaping mouth), the camera pushes in on the
//     porthole and keeps creeping through the 0.6 s fade into s10's wide shot of the planet.
import { W, H, PAL, LW, camera, cartoonText, circlePath, ink, glow } from '../draw.js';
import { TAU, clamp, lerp, ease, hash01, rgba, smoothstep } from '../util.js';
import { barTime, beatAt, sway, pulse, hat, SPB } from '../timing.js';
import { drawCockpit, drawCockpitFront } from '../props/cockpit.js';
import { drawGirl } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { kibble } from '../props/items.js';
import { drawEarth } from '../props/space.js';
import { ORBIT, planetRot, ringedPlanet, cam10 } from './s10_gravity.js';

// ---------------------------------------------------------------- beat grid
const T_IN = barTime(21); //                      50.54 cut in
const CHOMPS = [1, 2, 3, 4, 5, 6].map((b) => barTime(21, b)); // 51.14 51.74 52.34 52.94 53.54 54.14
const T_LOOK = barTime(22, 3); //                 54.74 planet in the porthole, both stare
const T_OUT = barTime(23); //                     55.34 (engine crossfades to s10 until 55.94)
const SOM_A = barTime(21, 0.25), SOM_B = barTime(22, 2); // the somersault (one full turn)
const PLANET_A = barTime(22, 2.5); //             planet starts to slide into the porthole
// the push THROUGH the porthole: the camera dives at the window so its planet lands exactly on s10's giant
// planet (same screen spot + size) by the middle of the 0.6 s dissolve
const T_PUSH = barTime(22, 3.75), T_MATCH = barTime(23, 0.6); // 55.19 → 55.70

// ---------------------------------------------------------------- layout (cabin frame coords)
const PORT = { x: 1170, y: 400, r: 150 };
const GIRL_S = 0.95, DOG_S = 1.25, KIB_R = 21;
const CAM_LOOK = { x: 1140, y: 458, zoom: 1.8 };

// ---------------------------------------------------------------- Juno
// she floats up a little while upside-down so her head clears the bench
const J_LIFT = (t) => Math.sin(Math.PI * clamp((t - SOM_A) / (SOM_B - SOM_A)));
function junoState(t) {
  const u = clamp((t - SOM_A) / (SOM_B - SOM_A));
  const turn = ease.inOutSine(u);
  const ang = TAU * turn; // forward (clockwise) somersault
  // tuck amount: 0 upright → 1 in the fast middle of the flip
  const tuck = Math.sin(Math.PI * u) ** 1.5;
  // drift: from the left bay toward the porthole, gentle tempo-locked bob
  const d = ease.inOutSine(clamp((t - T_IN) / (T_LOOK - T_IN)));
  const look = ease.outCubic(clamp((t - (T_LOOK - 0.18)) / 0.35));
  const cx = lerp(745, 846, d) + 6 * look;
  // the handrail crosses her thighs (she's clearly in front of it) and her boots hover between the rail and the
  // bench cushion, right of the pillow — so she never reads as standing on the rail or the bench
  const cy = lerp(492, 514, d) - 60 * J_LIFT(t) + 14 * sway(t, 4) * (1 - 0.7 * look);
  // when upright she rocks gently (4-beat sway) — nothing in zero-g stands still
  const rock = 0.09 * sway(t + 0.3, 4) * (1 - tuck) * (1 - 0.6 * look);
  return { cx, cy, ang: ang + rock, tuck, u, look };
}
function drawJuno(ctx, t) {
  const J = junoState(t);
  const surprised = t >= T_LOOK;
  let expr = 'happy';
  if (J.u > 0.12 && J.u < 0.9) expr = 'laugh';
  if (surprised) expr = t < T_LOOK + 0.32 ? 'surprised' : 'awe';
  // arms: floaty spread → swept overhead like a gymnast through the fast middle of the flip → spread again;
  // at the look she points at the porthole
  // after the flip she treads zero-g with slow breaststroke sweeps, one per 2 beats
  const tread = clamp((t - SOM_B + 0.3) / 0.5) * (1 - clamp((t - T_LOOK + 0.2) / 0.2));
  const aOut = 1.75 + 0.12 * sway(t, 2) + 0.28 * tread * sway(t, 2);
  const armL = { a: lerp(aOut, 2.3, J.tuck), b: lerp(-0.25, 0.2, J.tuck) };
  let armR = { a: lerp(aOut + 0.1, 2.3, J.tuck), b: lerp(-0.2, 0.2, J.tuck) };
  let armLf = armL;
  if (J.look > 0) {
    armR = { a: lerp(armR.a, 2.15, J.look), b: lerp(armR.b, -0.35, J.look), hand: J.look > 0.5 ? 'point' : 'open' };
    armLf = { a: lerp(armL.a, 0.55, J.look), b: lerp(armL.b, 2.35, J.look) }; // hand to her cheek: "whoa"
  }
  const pose = {
    t, stance: 'float', facing: 1, suit: 'space', helmet: 0, expr,
    mouth: surprised ? 0.55 + 0.15 * (1 - clamp((t - T_LOOK) / 0.4)) : undefined,
    // a glance at the porthole as the planet slides in (54.44)… then the double-take ON the beat (54.74)
    look: surprised ? [1, -0.25] : t > PLANET_A + 0.08 ? [0.9, -0.15] : [0.5, 0.1],
    squash: lerp(1, 0.9, J.tuck) + 0.05 * Math.sin(Math.PI * clamp((J.u - 0.8) / 0.2)),
    headTilt: -0.12 * J.look,
    armL: armLf, armR,
    blush: 0.3,
  };
  ctx.save();
  ctx.translate(J.cx, J.cy);
  ctx.rotate(J.ang);
  // body centre ≈ 205 px (s=1) above the ground point
  drawGirl(ctx, 0, 205 * GIRL_S, GIRL_S, pose);
  ctx.restore();
}

// ---------------------------------------------------------------- Biscuit
// Upside-down (facing -1 rolled by π → snout points screen-right, at the kibble bag), paddling in place while
// a queue of kibble drifts out of the torn bag into his mouth: one CHOMP per beat. At 54.74 he whip-rolls
// upright (snout now screen-left, toward the porthole) with a "!".
const DOG_C = { x: 1470, y: 420 };
const BAG = { x: 1715, y: 770 };
const TRAVEL = 2 * SPB; // s a kibble takes from the bag to his mouth: it pops out of the bag on a beat, eaten 2 beats later
// index of the last chomp at or before t (-1 before the first)
function lastChomp(t) {
  let k = -1;
  for (let i = 0; i < CHOMPS.length; i++) if (t >= CHOMPS[i] - 1e-6) k = i;
  return k;
}
function dogState(t) {
  const k = lastChomp(t);
  const next = t < T_LOOK - 0.3 ? CHOMPS[k + 1] : undefined;
  // anticipation: mouth opens wide + a little lunge toward the incoming kibble before each chomp
  let open = 0;
  if (next !== undefined && t > next - 0.3) open = ease.outQuad(clamp((t - (next - 0.3)) / 0.22));
  let chew = 0, squash = 1;
  if (k >= 0) {
    const dt = t - CHOMPS[k];
    squash = 1 - 0.14 * Math.exp(-8 * dt) * Math.cos(TAU * 2.6 * dt);
    chew = dt < 0.42 ? 0.22 * Math.abs(Math.sin((dt / 0.14) * Math.PI)) * (1 - dt / 0.42) : 0;
  }
  // the whip-roll at the look: wind-up (roll back a touch) then spin upright with overshoot
  const wind = t < T_LOOK ? -0.22 * smoothstep(T_LOOK - 0.22, T_LOOK, t) : 0;
  const roll = t >= T_LOOK ? Math.PI * ease.outBack(clamp((t - T_LOOK) / 0.3), 1.9) : wind;
  const drift = 0.14 * sway(t, 8) * (1 - clamp((t - T_LOOK) / 0.3));
  const cx = DOG_C.x + 12 * sway(t, 8) + 24 * open - 28 * ease.outCubic(clamp((t - T_LOOK) / 0.5));
  const cy = DOG_C.y + 20 * sway(t, 4) + 14 * open + 24 * ease.outCubic(clamp((t - T_LOOK) / 0.5)); // drops a bit so his "!" stays in frame
  return { cx, cy, open, chew, squash, tilt: Math.PI + roll + drift, k };
}
function dogPose(t) {
  const D = dogState(t);
  const stare = t >= T_LOOK;
  const pose = {
    t, stance: 'float', facing: -1, suit: 'space', helmet: 0,
    tilt: D.tilt, pivot: 'center', squash: D.squash,
    expr: stare ? 'alert' : 'happy',
    mouth: stare ? lerp(0.9, 0.55, clamp((t - T_LOOK) / 0.5)) : Math.max(D.open, D.chew),
    tongue: stare ? 0 : D.open > 0.05 || D.chew > 0 ? 0 : 0.8,
    exclaim: stare ? ease.outBack(clamp((t - T_LOOK - 0.08) / 0.22)) : 0,
    look: stare ? [1, 0.1] : [0.6, 0.3],
    blink: t > T_LOOK - 0.1 ? 0 : undefined, // no auto-blink in the wide-eyed reaction
    wag: 1.2,
    ears: stare ? 1 : undefined,
  };
  return { x: D.cx, y: D.cy + 66 * DOG_S, pose, D };
}
function mouthAt(t) {
  const { x, y, pose } = dogPose(t);
  return dogAnchors(x, y, DOG_S, pose).mouth;
}
function bagAt(t) {
  return { x: BAG.x + 8 * sway(t, 8), y: BAG.y + 14 * sway(t, 4), rot: -0.72 + 0.08 * sway(t, 8) };
}
const BAG_S = 1.2;
function bagMouth(t) {
  const b = bagAt(t), a = b.rot - Math.PI / 2;
  return [b.x + Math.cos(a) * 62 * BAG_S, b.y + Math.sin(a) * 62 * BAG_S];
}
// each eaten kibble lands exactly where the mouth is on its beat
const KIB_SPOT = CHOMPS.map((bt) => mouthAt(bt));
const KIB_TIMES = [...CHOMPS, T_LOOK]; // the 7th piece arrives as he whips round — and sails past
const KIB_END = [...KIB_SPOT, mouthAt(T_LOOK - 1e-3)];

function kibblePos(t, i) {
  const bt = KIB_TIMES[i];
  const t0 = bt - TRAVEL;
  if (t < t0) return null;
  const [sx, sy] = bagMouth(t0);
  const [ex, ey] = KIB_END[i];
  if (t >= bt) { // only the last one gets here: it keeps drifting on, tumbling
    const dt = t - bt, vx = (ex - sx) / TRAVEL * 0.55, vy = (ey - sy) / TRAVEL * 0.55;
    return [ex + vx * dt, ey + vy * dt - 40 * dt * dt, (t - t0) * 3];
  }
  const u = (t - t0) / TRAVEL;
  const e = 0.3 * u + 0.7 * u * u; // accelerates: slurped in
  const bow = Math.sin(Math.PI * u) * (22 + 10 * hash01(i, 3));
  const nx = -(ey - sy), ny = ex - sx, nl = Math.hypot(nx, ny) || 1;
  return [lerp(sx, ex, e) + (nx / nl) * bow, lerp(sy, ey, e) + (ny / nl) * bow, (t - t0) * (1.4 + hash01(i, 4))];
}

function drawDogAndKibble(ctx, t) {
  const { x, y, pose } = dogPose(t);
  drawDog(ctx, x, y, DOG_S, pose);
  // kibble in flight (drawn over him so the snap reads)
  for (let i = 0; i < KIB_TIMES.length; i++) {
    if (i < CHOMPS.length && t >= KIB_TIMES[i]) continue;
    const p = kibblePos(t, i);
    if (!p) continue;
    const grow = clamp((t - (KIB_TIMES[i] - TRAVEL)) / 0.18); // pops out of the bag
    ctx.save();
    ctx.translate(p[0], p[1]); ctx.scale(0.4 + 0.6 * grow, 0.4 + 0.6 * grow);
    kibble(ctx, { r: KIB_R, seed: 3 + i * 7, rot: p[2] });
    ctx.restore();
  }
  // chomp FX: crumbs + impact ticks + a little "nom!"
  const k = lastChomp(t);
  if (k >= 0) {
    const dt = t - CHOMPS[k];
    if (dt < 0.55) {
      const [mx, my] = KIB_SPOT[k];
      const f = 1 - dt / 0.55;
      for (let j = 0; j < 6; j++) {
        const a = -1.2 + 2.4 * hash01(j, 200 + k) - (j % 2) * Math.PI;
        const sp = 130 + 130 * hash01(j, 300 + k);
        const d = (sp * (1 - Math.exp(-4 * dt))) / 4 * 1.6;
        const cr = 4.2 + 3.2 * hash01(j, 400 + k);
        circlePath(ctx, mx + Math.cos(a) * d, my + Math.sin(a) * d, cr * (0.5 + 0.5 * f));
        ink(ctx, j % 2 ? '#c17f41' : '#a8672f', 1.6);
      }
      if (dt < 0.18) {
        const g = 1 - dt / 0.18;
        ctx.save();
        ctx.strokeStyle = rgba('#fffaf0', g); ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let j = 0; j < 5; j++) {
          const a = (j - 2) * 0.5 - 0.35;
          ctx.beginPath();
          ctx.moveTo(mx + Math.cos(a) * 36, my + Math.sin(a) * 36);
          ctx.lineTo(mx + Math.cos(a) * (58 + 26 * (1 - g)), my + Math.sin(a) * (58 + 26 * (1 - g)));
          ctx.stroke();
        }
        ctx.restore();
      }
      const pop = ease.outBack(clamp(dt / 0.15), 2.6);
      const words = ['nom!', 'nom!', 'crunch!', 'nom!', 'nom!', 'GULP!'];
      cartoonText(ctx, words[k], mx + 40 + (k % 2 ? 30 : -30), my - 120 - 50 * dt, {
        size: k === 5 ? 76 : 64, fill: k === 5 ? PAL.orange : PAL.yellow, scale: pop, alpha: clamp(f * 1.8),
        rot: k % 2 ? 0.16 : -0.16, lw: 9,
      });
    }
  }
}

// ---------------------------------------------------------------- set dressing
// ambient floating kibble (spilled everywhere), tempo-locked drift
const AMBIENT = [
  [300, 190], [470, 860], [760, 170], [980, 800], [1010, 250], [1390, 800], [1560, 170], [640, 820], [230, 640], [1230, 700],
];
function drawAmbientKibble(ctx, t) {
  AMBIENT.forEach(([x, y], i) => {
    const ph = hash01(i, 5) * TAU;
    const px = x + 14 * Math.sin((TAU * beatAt(t)) / 8 + ph) + 6 * (t - T_IN);
    const py = y + 12 * Math.sin((TAU * beatAt(t)) / 4 + ph);
    ctx.save(); ctx.translate(px, py);
    kibble(ctx, { r: KIB_R * (0.75 + 0.3 * hash01(i, 6)), seed: 20 + i, rot: t * (0.4 + 0.5 * hash01(i, 7)) * (i % 2 ? 1 : -1) });
    ctx.restore();
  });
}
// the torn kibble bag Biscuit raided, floating lower-right with its mouth toward him
function drawKibbleBag(ctx, t) {
  const { x, y, rot } = bagAt(t);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(BAG_S, BAG_S);
  // little puff jiggle each time a kibble leaves (one per beat)
  const pj = 1 + 0.05 * pulse(t, 9);
  ctx.scale(pj, 2 - pj);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-58, -46);
    ctx.lineTo(-44, -60); ctx.lineTo(-30, -48); ctx.lineTo(-14, -64); ctx.lineTo(4, -50); ctx.lineTo(20, -63); ctx.lineTo(36, -49); ctx.lineTo(56, -58);
    ctx.quadraticCurveTo(66, 10, 58, 78);
    ctx.quadraticCurveTo(0, 90, -60, 78);
    ctx.quadraticCurveTo(-68, 10, -58, -46);
    ctx.closePath();
  };
  body(); ctx.fillStyle = '#d99a5b'; ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = '#b8783f'; ctx.fillRect(22, -80, 60, 180);
  ctx.fillStyle = '#5a2e1a'; ctx.beginPath(); ctx.ellipse(-2, -54, 50, 12, 0, 0, TAU); ctx.fill(); // dark opening
  ctx.fillStyle = PAL.red; ctx.fillRect(-70, -8, 140, 50); // label band
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-50, -30, 8, 100);
  ctx.restore();
  body(); ink(ctx, null, LW * 0.8);
  ctx.fillStyle = PAL.cream;
  ctx.beginPath(); ctx.ellipse(-30, 22, 9, 7, 0, 0, TAU); ctx.fill();
  for (const [bx, by] of [[-39, 13], [-33, 8], [-26, 8], [-20, 13]]) { circlePath(ctx, bx, by, 3.2); ctx.fill(); }
  ctx.font = 'bold 20px "Arial Rounded MT Bold", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('YUM', 12, 18);
  ctx.restore();
}

// ---------------------------------------------------------------- porthole view
// the ringed planet in the porthole (cabin-frame coords): slides in from the upper right, then keeps looming
function portPlanet(t) {
  const pu = ease.outCubic(clamp((t - PLANET_A) / (T_LOOK + 0.35 - PLANET_A)));
  const loom = clamp((t - T_LOOK) / (T_OUT + 0.6 - T_LOOK));
  return { pu, x: PORT.x + PORT.r * lerp(1.8, 0.28, pu), y: PORT.y + PORT.r * lerp(-1.3, 0.02, pu), r: PORT.r * (0.6 + 0.12 * pu + 0.12 * loom) };
}
function portholeView(t, cam) {
  return (ctx, cx, cy, r) => {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 1.2);
    g.addColorStop(0, '#2a1d63'); g.addColorStop(1, '#0c0928');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    // stars (twinkle on hats)
    const hp = hat(t);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 46; i++) {
      const sx = cx - r + hash01(i, 91) * 2 * r, sy = cy - r + hash01(i, 92) * 2 * r;
      const rr = 0.8 + 1.8 * hash01(i, 93) ** 2 + (hash01(i, 94) < 0.3 ? hp * 1.2 : 0);
      ctx.globalAlpha = 0.45 + 0.55 * hash01(i, 95);
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Earth, falling away behind us
    const eu = clamp((t - T_IN) / (T_OUT - T_IN));
    const er = r * lerp(0.62, 0.42, eu);
    const ex = cx - r * lerp(0.42, 0.62, eu), ey = cy + r * lerp(0.5, 0.82, eu);
    const [esx, esy] = toScreen(cam, [ex, ey]), erS = er * 1.3 * cam.zoom; // (skipped once the push-through has left it off-screen)
    if (esx + erS > 0 && esx - erS < W && esy + erS > 0 && esy - erS < H) drawEarth(ctx, ex, ey, er, { t, rot: t * 0.12, lw: 3 });
    // the giant ringed planet sliding in and looming (same bands/tilt as s10's, outline in proportion)
    const P = portPlanet(t);
    // (detail off: no pinstripes/eddies — cheap inside the porthole clip, and s10's detailed planet takes over
    //  as the push-through dissolves into it)
    if (P.pu > 0) ringedPlanet(ctx, P.x, P.y, P.r, { rot: planetRot(t), tilt: ORBIT.tilt, open: ORBIT.open, lw: (6.9 * P.r) / ORBIT.r, detail: false });
  };
}

// ---------------------------------------------------------------- camera
// gentle zero-g float → a tiny wind-up → snap push-in on the porthole at 54.74 …
function camLook(t) {
  const push = ease.outCubic(clamp((t - T_LOOK) / 0.42));
  const wind = t < T_LOOK ? smoothstep(T_LOOK - 0.3, T_LOOK, t) : 0;
  const creep = clamp((t - T_LOOK - 0.42) / 1.4);
  const settle = ease.inOutSine(clamp((t - T_IN) / (T_LOOK - T_IN)));
  return {
    x: lerp(1095, CAM_LOOK.x, push) + 6 * sway(t, 8) * (1 - push),
    y: lerp(492, CAM_LOOK.y, push) + 5 * sway(t, 4) * (1 - push),
    zoom: lerp(1.26 + 0.06 * settle, CAM_LOOK.zoom, push) - 0.03 * wind + 0.1 * creep,
    rot: 0.012 * sway(t, 8) * (1 - push) - 0.02 * push * (1 - 0.5 * creep),
  };
}
function toScreen(c, [x, y]) {
  const dx = (x - c.x) * c.zoom, dy = (y - c.y) * c.zoom, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
  return [W / 2 + dx * cs - dy * sn, H / 2 + dx * sn + dy * cs];
}
function lockCam(wp, P, zoom, rot) {
  const vx = (W / 2 - P[0]) / zoom, vy = (H / 2 - P[1]) / zoom, c = Math.cos(-rot), s = Math.sin(-rot);
  return { x: wp[0] + vx * c - vy * s, y: wp[1] + vx * s + vy * c, zoom, rot };
}
// … then dive through the porthole: glide the window's planet onto s10's giant planet (screen spot + radius,
// size interpolated in log space) so the dissolve reads as one continuous push
function cam09(t) {
  const c = camLook(t);
  const m = ease.inOutCubic(clamp((t - T_PUSH) / (T_MATCH - T_PUSH)));
  if (m <= 0) return c;
  const P = portPlanet(t), c10 = cam10(t);
  const P0 = toScreen(c, [P.x, P.y]), r0 = P.r * c.zoom;
  const P1 = toScreen(c10, [ORBIT.cx, ORBIT.cy]), r1 = ORBIT.r * c10.zoom;
  const rm = r0 * Math.pow(r1 / r0, m);
  return lockCam([P.x, P.y], [lerp(P0[0], P1[0], m), lerp(P0[1], P1[1], m)], rm / P.r, lerp(c.rot, c10.rot, m));
}

// ---------------------------------------------------------------- scene
export default {
  id: 's09_zero_g',
  start: 50.538,
  end: 55.339,
  transition: { type: 'cut' },
  draw(ctx, t) {
    // hold gracefully outside the scene window (the engine calls us during the s10 fade)
    t = clamp(t, T_IN, T_OUT + 0.9);
    const cam = cam09(t);
    const co = { t, view: 'cabin', lights: 0.5, window: portholeView(t, cam) };
    camera(ctx, cam, () => {
      drawCockpit(ctx, co);
      // pink planet-light spilling from the porthole once the planet is there
      // (fades out as the camera dives through the window — it would only be a full-frame wash by then)
      const pl = ease.outCubic(clamp((t - PLANET_A) / 0.9)) * (1 - clamp((cam.zoom - 1.9) / 0.4));
      if (pl > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, PORT.x, PORT.y, 340, '#ff9ec7', 0.26 * pl);
        ctx.restore();
      }
      // during the push-through things leave the frame: skip what's entirely off-screen (perf in the dissolve)
      const onScr = (x, y, r) => { const [sx, sy] = toScreen(cam, [x, y]), rr = r * cam.zoom; return sx + rr > 0 && sx - rr < W && sy + rr > 0 && sy - rr < H; };
      drawAmbientKibble(ctx, t);
      const J = junoState(t);
      if (onScr(J.cx, J.cy, 300)) drawJuno(ctx, t);
      const B = bagAt(t);
      if (onScr(B.x, B.y, 140)) drawKibbleBag(ctx, t);
      const D = dogState(t);
      if (onScr(D.cx, D.cy, 330)) drawDogAndKibble(ctx, t);
      if (cam.zoom < 2.6) drawCockpitFront(ctx, co); // near-camera ribs at the frame edges: pushed out of shot
    });
  },
};
