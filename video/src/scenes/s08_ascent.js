// s08_ascent — 43.34 → 50.54 (bars 18–20) · transition: cut
//
// SHOT C  (bar 18, 43.34 → 45.74)  side view, climbing: the S.S. Biscuit (pitched over a little)
//   rides up through a blue → indigo sky, speed streaks sliding past, the cloud tops dropping away.
//   An airliner slides into frame from the upper right and slows almost to a stop right beside the
//   portholes (camera pushes in): Juno spots it on beat 1 (43.94), and ON beat 2 (44.54) the dozing
//   passenger pops awake — startled face, specs flying up, palms on the glass — while Juno waves
//   (one wave per beat) and Biscuit paws at his porthole. On beat 4 the plane whooshes away down-left;
//   the first stars come out.
// SHOT D  (bar 19, 45.74 → 48.14)  CUT to space: the camera tilts down and pulls back to reveal the
//   curve of the Earth rising below with its thin blue glow; into black space, stars twinkling on
//   hats. From beat 2 the camera pushes in on the rocket; on the and-of-4 (47.84) the booster flame
//   cuts out — a breath of silence-in-picture (anticipation).
// SHOT E  (bar 20, 48.14 → 50.54)  STAGE SEPARATION exactly on 48.14: "POP!" — ring burst, bolt
//   sparks, smoke puffs, shake; the booster drops away tumbling toward Earth. ON beat 1 (48.74) the
//   main engine re-ignites with a whoomph and the rocket sails off, pitching over and shrinking into
//   the starfield. Cut to the capsule (s09) on 50.54.
import { H, INK, PAL, camera, shake, glow, sparkle, circlePath, ellipsePath, rrectPath, ink, blobs,
  cartoonText, starfield, vGradient } from '../draw.js';
import { clamp, lerp, ease, hash01, noise1, mixColor, rgba, smoothstep, keyframes, TAU } from '../util.js';
import { barTime, kick, beatAt, sway, hat } from '../timing.js';
import { drawRocket, drawBooster, drawAirliner, ROCKET_PORTHOLES } from '../props/rockets.js';
import { spaceBg, drawEarth } from '../props/space.js';

// ------------------------------------------------------------------ beat grid
// Hits are fully "on" half a frame early (EPS) so the 30 fps frame nearest the beat shows the impact.
const EPS = 1 / 60;
const T_IN = barTime(18); //           43.338  cut in: side view climbing
const T_SPOT = barTime(18, 1) - EPS; //      43.938  Juno spots the airliner
const T_EYE = barTime(18, 2) - EPS; //       44.538  passenger pops awake — eye contact, wave #1
const T_WAVE2 = barTime(18, 3) - EPS; //     45.138  wave #2, plane starts to peel away
const T_SPACE = barTime(19) - EPS; //        45.738  CUT: Earth's curve, into black space
const T_PUSH = barTime(19, 2) - EPS; //      46.938  camera starts pushing in
const T_CUTOFF = barTime(19, 3.5) - EPS; //  47.838  booster flame cuts out (anticipation)
const T_SEP = barTime(20) - EPS; //          48.138  STAGE SEPARATION
const T_REIGN = barTime(20, 1) - EPS; //     48.738  main engine re-ignites
const T_END = barTime(21); //          50.538  cut to s09

// =================================================================== SHOT C (bar 18)
// World: rocket fin tips at (0, 0), s = 1, pitched TH_C (nose to the right). Airliner flies level.
const TH_C = 0.3;
const PORT_G = ROCKET_PORTHOLES.girl, PORT_D = ROCKET_PORTHOLES.dog;
const rotP = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const PG_W = rotP([PORT_G.x, PORT_G.y], TH_C); // girl porthole in world
const PLANE_S = 1.7;
// passenger window (local x 148 from the origin toward the nose, y -12) sits left of Juno's porthole
const WIN_AT = [PG_W[0] - 300, PG_W[1] - 6];
const PLANE_AT = [WIN_AT[0] + 148 * PLANE_S, WIN_AT[1] + 12 * PLANE_S]; // plane origin at eye contact
const PLANE_DIR = (() => { const x = -0.42, y = 0.91, l = Math.hypot(x, y); return [x / l, y / l]; })();

function planeS(t) {
  // relative slide: fast in from the upper right, slow-mo beside the portholes, whoosh away down-left
  return keyframes(t, [
    [T_IN, -2300],
    [T_EYE - 0.06, -30, ease.outCubic],
    [T_WAVE2 + 0.05, 36, ease.linear],
    [T_SPACE, 2600, ease.inCubic],
  ]);
}
function camC(t) {
  const push = ease.inOutSine(smoothstep(T_SPOT - 0.1, T_EYE - 0.05, t));
  const pull = ease.inOutSine(smoothstep(T_WAVE2 + 0.1, T_SPACE, t));
  const x = lerp(lerp(70, -110, push), 30, pull);
  const y = lerp(lerp(-330, -430, push), -380, pull);
  const zoom = lerp(lerp(0.92, 1.6, push), 1.05, pull);
  const k = kick(t) * 6;
  return { x, y, zoom, dx: k * noise1(t * 37, 1), dy: k * noise1(t * 41, 2) };
}
function skyC(t) {
  const u = smoothstep(T_IN, T_SPACE, t);
  return [
    [0, mixColor('#302f88', '#100d36', u)],
    [0.55, mixColor('#4b56bd', '#211d62', u)],
    [1, mixColor('#7584dc', '#36368e', u)],
  ];
}

// a waving glove (spacesuit mitten, orange cuff) — prop-scale, drawn in rocket-local units
function glove(ctx, x, y, r, ang) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  circlePath(ctx, -r * 0.82, r * 0.05, r * 0.36); ink(ctx, '#f4efe6', 2.4);
  ellipsePath(ctx, 0, -r * 0.1, r * 0.78, r * 0.95); ink(ctx, '#f4efe6', 2.6);
  ctx.fillStyle = '#d6cfc2'; ellipsePath(ctx, r * 0.25, 0, r * 0.4, r * 0.7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.95); ctx.lineTo(-r * 0.2, -r * 0.45); ctx.moveTo(r * 0.2, -r * 0.95); ctx.lineTo(r * 0.2, -r * 0.45); ctx.stroke();
  rrectPath(ctx, -r * 0.75, r * 0.7, r * 1.5, r * 0.75, r * 0.25); ink(ctx, '#ff8a3d', 2.4);
  ctx.restore();
}
function paw(ctx, x, y, r, ang) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  rrectPath(ctx, -r * 0.6, 0, r * 1.2, r * 2.2, r * 0.5); ink(ctx, '#fdf3e1', 2.4);
  circlePath(ctx, 0, 0, r); ink(ctx, '#fdf3e1', 2.6);
  ctx.fillStyle = '#ff9bb0';
  ellipsePath(ctx, 0, r * 0.25, r * 0.45, r * 0.34); ctx.fill();
  for (let i = -1; i <= 1; i++) { circlePath(ctx, i * r * 0.44, -r * 0.38 - (i === 0 ? r * 0.12 : 0), r * 0.19); ctx.fill(); }
  ctx.restore();
}

function shotC(ctx, t) {
  const cam = camC(t);
  vGradient(ctx, skyC(t));
  // first stars
  const sA = smoothstep(T_EYE, T_SPACE, t);
  if (sA > 0.01) starfield(ctx, { t, seed: 818, count: 160, alpha: sA, minR: 1, maxR: 3, big: 0.08 });
  // cloud tops dropping away far below (screen space, slow parallax)
  const drop = (t - T_IN) * 520;
  for (let i = 0; i < 9; i++) {
    const x = ((hash01(i, 11) * 2400 - (t - T_IN) * 160) % 2400 + 2400) % 2400 - 240;
    const y = 930 + 60 * hash01(i, 12) + drop;
    if (y > H + 120) continue;
    const w = 260 + 200 * hash01(i, 13);
    const u = smoothstep(T_IN, T_IN + 1.2, t);
    ctx.save();
    ctx.globalAlpha = 1 - 0.5 * u;
    puffRow(ctx, x, y, w, i);
    ctx.restore();
  }
  // speed streaks sliding back along the flight line
  // thin vapour wisps whipping back along the flight line (speed without rain-streaks)
  {
    const ang = Math.PI / 2 + TH_C, ca = Math.cos(ang), sa = Math.sin(ang);
    const fade = 1 - 0.6 * smoothstep(T_IN, T_SPACE, t);
    for (let i = 0; i < 9; i++) {
      const span = 2600;
      const along = ((hash01(i, 41) * span + (t - T_IN) * (1500 + 900 * hash01(i, 42))) % span) - span / 2;
      const across = (hash01(i, 43) - 0.5) * 2200;
      const x = 960 + ca * along - sa * across, y = 540 + sa * along + ca * across;
      const len = 200 + 200 * hash01(i, 44), th = 16 + 14 * hash01(i, 45);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = rgba('#dfe4ff', (0.08 + 0.08 * hash01(i, 46)) * fade);
      ellipsePath(ctx, 0, 0, len / 2, th); ctx.fill();
      ellipsePath(ctx, -len * 0.1, th * 0.9, len * 0.28, th * 0.6); ctx.fill();
      ctx.restore();
    }
  }

  camera(ctx, { x: cam.x, y: cam.y, zoom: cam.zoom, dx: cam.dx, dy: cam.dy }, () => {
    // ---- airliner (behind the rocket)
    const S = planeS(t);
    const px = PLANE_AT[0] + PLANE_DIR[0] * S, py = PLANE_AT[1] + PLANE_DIR[1] * S;
    const face = clamp((t - (T_EYE - 0.085)) / 0.3);
    if (Math.abs(S) < 2400) {
      drawAirliner(ctx, px, py, PLANE_S, { t, face, facing: -1, contrail: 1600, passenger: 2 });
      // surprise lines around the passenger window
      const su = (t - T_EYE) / 0.35;
      if (su > 0 && su < 1) {
        const wx = px - 148 * PLANE_S, wy = py - 12 * PLANE_S;
        ctx.save();
        ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 5;
        ctx.globalAlpha = 1 - su;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI * 0.95 + (i / 6) * Math.PI * 0.9;
          const r0 = 30 + 20 * ease.outCubic(su), r1 = r0 + 26 * (1 - su) + 8;
          ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * r0, wy + Math.sin(a) * r0); ctx.lineTo(wx + Math.cos(a) * r1, wy + Math.sin(a) * r1); ctx.stroke();
        }
        ctx.restore();
      }
    }
    // ---- rocket (booster flaming), tempo-locked judder
    const bob = 5 * sway(t, 1);
    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(TH_C);
    const spot = t >= T_SPOT - 0.05;
    const eye = t >= T_EYE;
    drawRocket(ctx, 0, 0, 1, {
      t, booster: true, flame: 1, stickers: true, shake: 0.15 + 0.2 * kick(t),
      crew: true,
      crewPose: {
        girl: { expr: eye ? 'laugh' : spot ? 'excited' : 'grin', look: spot ? [-1, -0.1] : [0.3, 0] },
        dog: { expr: eye ? 'excited' : 'happy', sunglasses: true, tongue: 1, look: spot ? [-1, 0] : [0, 0], facing: spot ? -1 : 1, dx: spot ? 7 : -7 },
      },
    });
    // Juno's wave (one per beat) and Biscuit's paw, pressed to the glass
    const wv = smoothstep(T_EYE - 0.25, T_EYE - 0.05, t) * (1 - smoothstep(T_SPACE - 0.35, T_SPACE - 0.1, t));
    if (wv > 0) {
      const b = beatAt(t);
      ctx.save();
      circlePath(ctx, PORT_G.x, PORT_G.y, PORT_G.r - 1); ctx.clip();
      glove(ctx, PORT_G.x - 24, PORT_G.y + 62 - 40 * ease.outBack(wv), 14, -0.35 + 0.5 * Math.sin(TAU * b));
      ctx.restore();
      ctx.save();
      circlePath(ctx, PORT_D.x, PORT_D.y, PORT_D.r - 1); ctx.clip();
      const pw = smoothstep(T_EYE, T_EYE + 0.2, t);
      if (pw > 0) paw(ctx, PORT_D.x - 16, PORT_D.y + 44 - 30 * ease.outBack(pw), 8.5, -0.25 + 0.45 * Math.sin(TAU * (b + 0.5)));
      ctx.restore();
    }
    ctx.restore();
  });
}
// cloud-top clump for the far-below cloud deck
function puffRow(ctx, x, y, w, seed) {
  const n = 4;
  ctx.fillStyle = '#e6c7e8';
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const r = w * (0.16 + 0.1 * Math.sin((i / (n - 1)) * Math.PI)) * (0.85 + 0.3 * hash01(i, seed + 20));
    const cx = x - w / 2 + w * (0.15 + 0.7 * i / (n - 1));
    ctx.moveTo(cx + r, y); ctx.arc(cx, y, r, 0, TAU);
  }
  ctx.rect(x - w / 2, y, w, 400);
  ctx.stroke(); ctx.fill();
}

// A cartoon "poof" for dark space: grows, then SHRINKS away fully opaque (lobes staggered) — the
// shared smoke puff fades through alpha, which turns its ink outline into a grey ghost on black.
function poof(ctx, x, y, r, { seed = 1, u = 0.5, fill = '#eceef8', shadeCol = '#a9aecc', lw = 4, n = 5 } = {}) {
  if (u <= 0 || u >= 1) return;
  const grow = ease.outCubic(clamp(u * 2.2));
  const cs = [];
  for (let i = 0; i < n; i++) {
    const sh = 1 - ease.inCubic(clamp((u - 0.4 - 0.12 * hash01(i, seed + 5)) / 0.48));
    const rr = r * (0.45 + 0.35 * hash01(i, seed + 3)) * grow * sh;
    if (rr < 0.8) continue;
    const a = hash01(i, seed) * TAU, d = r * 0.55 * hash01(i, seed + 7) * (0.4 + 0.6 * grow);
    cs.push([x + Math.cos(a) * d, y + Math.sin(a) * d - u * r * 0.3, rr]);
  }
  if (!cs.length) return;
  blobs(ctx, cs, fill, lw);
  blobs(ctx, cs.map(([a, b, rr]) => [a + rr * 0.15, b + rr * 0.2, rr * 0.7]), shadeCol, 0);
  blobs(ctx, cs.map(([a, b, rr]) => [a - rr * 0.1, b - rr * 0.1, rr * 0.72]), fill, 0);
}

// =================================================================== SHOTS D + E (bars 19–20)
// World: rocket fin tips at RW(t); the Earth is a huge disc below. Camera eases around.
const TH_D = 0.38; // flight angle (nose right of vertical)
const EARTH = { x: 260, y: 250 + 3000, r: 3000 };
const AX = (a) => [Math.sin(a), -Math.cos(a)]; // unit vector along the rocket axis (toward the nose)
const RS_D = 1; // rocket world scale

// rocket state: position of the fin tips, axis angle, depth scale, flames
function rocketD(t) {
  const dt = t - T_SPACE;
  const [ax, ay] = AX(TH_D);
  // steady climb before separation (slow in world: the camera rides along)
  const pre = 70 * Math.min(dt, T_SEP - T_SPACE) ;
  let x = ax * pre, y = ay * pre;
  let ang = TH_D, depth = 1;
  if (t > T_SEP) {
    const c = t - T_SEP; // coast after the pop: a little kick forward from the bolts
    const coast = 90 * ease.outCubic(clamp(c / 0.4)) + 50 * c;
    x += ax * coast; y += ay * coast;
  }
  if (t > T_REIGN) {
    // off it goes: accelerate along a path that pitches over, receding into depth
    const r = t - T_REIGN;
    ang = TH_D + 0.55 * ease.inOutSine(clamp(r / 1.8));
    const d = 120 * r + 220 * r * r;
    const [bx, by] = AX(lerp(TH_D, ang, 0.6));
    x += bx * d; y += by * d;
    depth = 1 - 0.5 * ease.outCubic(clamp(r / 1.8)); // recedes, but still reads as the S.S. Biscuit at the cut
  }
  // booster flame: full, sputters out on the and-of-4
  let bFlame = 1;
  if (t > T_CUTOFF - 0.1) {
    const c = clamp((t - (T_CUTOFF - 0.1)) / 0.12);
    bFlame = (1 - c) * (0.55 + 0.45 * Math.abs(Math.sin(t * 70)));
  }
  // main engine: re-ignites ON beat 1 with an overshoot
  let mFlame = 0;
  if (t >= T_REIGN - 0.01) {
    const r = t - T_REIGN;
    mFlame = clamp((r + 0.01) / 0.06) * (1 + 0.55 * Math.exp(-6 * Math.max(0, r)));
  }
  return { x, y, ang, depth, bFlame, mFlame };
}
// booster after separation: world top-centre, rotation, scale, alpha
function boosterD(t) {
  const R = rocketD(T_SEP);
  const [ax, ay] = AX(R.ang);
  const jx = R.x + ax * 84 * RS_D, jy = R.y + ay * 84 * RS_D; // collar joint (fin tips + 84 up the axis)
  const c = t - T_SEP;
  // kicked back by the bolts, then drifting down toward Earth
  const back = 70 * ease.outCubic(clamp(c / 0.3)) + 60 * c + 55 * c * c;
  const x = jx - ax * back - 35 * c;
  const y = jy - ay * back + 10 * c * c;
  const rot = R.ang + 0.25 * ease.outCubic(clamp(c / 0.4)) + 0.9 * c;
  const s = RS_D * (1 - 0.4 * ease.outQuad(clamp(c / 2.4)));
  return { x, y, rot, s };
}
function camD(t) {
  // 45.74: CUT to a wide — the Earth's curve fills the bottom, the rocket rising right off its limb
  // (a clear change of scale from shot C's close side view, so the cut reads as intentional) →
  // a slow creep in over beats 0–1 → from beat 2 a firmer push in on the stack (Earth kept along the
  // bottom) → hold through the pop → ease back and pan after the rocket as it sails off up-right
  const x = keyframes(t, [[T_SPACE, 110], [T_PUSH, 120, ease.inOutSine], [T_SEP, 40, ease.inOutSine], [T_REIGN, 70, ease.inOutSine], [T_END, 430, ease.inOutSine]]);
  const y = keyframes(t, [[T_SPACE, -150], [T_PUSH, -175, ease.inOutSine], [T_SEP, -292, ease.inOutSine], [T_REIGN, -300, ease.inOutSine], [T_END, -560, ease.inOutSine]]);
  const zoom = keyframes(t, [[T_SPACE, 0.5], [T_PUSH, 0.56, ease.inOutSine], [T_SEP, 0.72, ease.inOutCubic], [T_REIGN, 0.74], [T_END, 0.64, ease.inOutSine]]);
  const sS = shake(t, T_SEP, 30, 5.5, 22);
  const sR = shake(t, T_REIGN, 14, 6, 24);
  const k = kick(t) * 5;
  return {
    x, y, zoom,
    dx: sS.dx + sR.dx + k * noise1(t * 37, 3), dy: sS.dy + sR.dy + k * noise1(t * 41, 4), rot: sS.rot,
  };
}

function shotDE(ctx, t) {
  const cam = camD(t);
  spaceBg(ctx, { t, hue: 'blue', seed: 4, stars: 340, driftX: cam.x * 0.15, driftY: cam.y * 0.15, band: 0.8 });
  camera(ctx, cam, () => {
    // ---- Earth: the curve rising below, thin blue atmosphere glow
    drawEarth(ctx, EARTH.x, EARTH.y, EARTH.r, { t, rot: 0.6 + 0.03 * (t - T_SPACE), pitch: -0.9, tilt: -0.12, night: 0.5, glow: 1 });
    const R = rocketD(t);
    const [ax, ay] = AX(R.ang);
    // ---- booster (after the pop), tumbling away toward Earth
    if (t >= T_SEP) {
      const B = boosterD(t);
      ctx.save();
      ctx.translate(B.x, B.y); ctx.rotate(B.rot);
      drawBooster(ctx, 0, 0, B.s, { t, rot: 0 });
      ctx.restore();
      // a last wisp of smoke from its nozzle
      const c = t - T_SEP;
      for (let i = 0; i < 4; i++) {
        const u = clamp((c - i * 0.18) / 1.4);
        if (u <= 0 || u >= 1) continue;
        const [bx, by] = AX(B.rot);
        poof(ctx, B.x - bx * (300 + 90 * i) * B.s, B.y - by * (300 + 90 * i) * B.s, 40 * B.s, { seed: 60 + i, u, n: 4, lw: 3, fill: '#d9dcef', shadeCol: '#9da3c4' });
      }
    }
    // ---- the rocket
    const s = RS_D * R.depth;
    const pre = t < T_SEP;
    const rattle = pre ? 0.12 + 0.5 * smoothstep(T_SEP - 0.2, T_SEP - 0.02, t) : 0.15 * kick(t);
    ctx.save();
    ctx.translate(R.x, R.y); ctx.rotate(R.ang);
    // squash just before the pop, stretch on the re-ignition kick
    const sq = pre ? 1 - 0.06 * smoothstep(T_SEP - 0.15, T_SEP - 0.01, t) : 1 + 0.12 * Math.exp(-6 * Math.max(0, t - T_REIGN)) * (t >= T_REIGN ? 1 : 0);
    ctx.scale(1 / Math.sqrt(sq), sq);
    drawRocket(ctx, 0, 0, s, {
      t, booster: pre, flame: pre ? R.bFlame : R.mFlame, stickers: true, shake: rattle,
      crew: true,
      crewPose: {
        girl: { expr: t >= T_REIGN ? 'laugh' : t >= T_CUTOFF ? 'determined' : 'grin' },
        dog: { expr: t >= T_REIGN ? 'excited' : 'grin', sunglasses: true, tongue: t >= T_REIGN ? 1 : 0 },
      },
    });
    ctx.restore();
    // ---- flame-out puff at the booster nozzle (and-of-4)
    const fo = (t - T_CUTOFF) / 0.5;
    if (fo > 0 && fo < 1 && t < T_SEP + 0.3) {
      const nx = R.x - ax * 200 * s, ny = R.y - ay * 200 * s;
      poof(ctx, nx, ny, 50 * s, { seed: 44, u: 0.15 + 0.85 * fo, n: 5, lw: 3.5, fill: '#e3e5f3', shadeCol: '#a4a9c9' });
    }
    // ---- SEPARATION FX (on 48.14)
    const c = t - T_SEP;
    if (c >= 0 && c < 1.2) {
      const jx = rocketD(T_SEP).x + AX(TH_D)[0] * 84, jy = rocketD(T_SEP).y + AX(TH_D)[1] * 84;
      // white flash at the joint
      const fl = Math.exp(-9 * c);
      glow(ctx, jx, jy, 520, '#ffffff', 0.9 * fl);
      glow(ctx, jx, jy, 260, '#fff2b0', 0.8 * fl);
      // shock ring around the collar (perpendicular to the axis)
      const e = ease.outCubic(clamp(c / 0.45));
      const ra = 1 - clamp(c / 0.45);
      if (ra > 0) {
        ctx.save();
        ctx.translate(jx, jy); ctx.rotate(TH_D);
        ctx.lineWidth = 18 * ra + 3; ctx.strokeStyle = rgba('#fff6d0', ra);
        ellipsePath(ctx, 0, 0, 120 + 420 * e, (120 + 420 * e) * 0.26); ctx.stroke();
        ctx.lineWidth = 6 * ra + 1; ctx.strokeStyle = rgba('#ffd23f', ra);
        ellipsePath(ctx, 0, 0, 100 + 330 * e, (100 + 330 * e) * 0.26); ctx.stroke();
        ctx.restore();
      }
      // smoke puffs flung sideways from the collar
      for (let i = 0; i < 8; i++) {
        const sg = i % 2 ? 1 : -1;
        const u = clamp(c / 1.1);
        const d = (90 + 230 * hash01(i, 7)) * ease.outCubic(clamp(c / 0.6));
        const px = jx + Math.cos(TH_D) * sg * (100 + d) - Math.sin(TH_D) * (hash01(i, 8) - 0.3) * 120 * u;
        const py = jy + Math.sin(TH_D) * sg * (100 + d) + Math.cos(TH_D) * (hash01(i, 8) - 0.3) * 120 * u;
        poof(ctx, px, py, 55 + 30 * hash01(i, 9), { seed: 70 + i, u: 0.12 + 0.87 * u, n: 5, lw: 4, fill: '#eceef8', shadeCol: '#a9aecc' });
      }
      // bolt sparks
      for (let i = 0; i < 12; i++) {
        const a = TH_D + (i / 12) * TAU + 0.2;
        const d = (80 + 320 * hash01(i, 12)) * ease.outCubic(clamp(c / 0.5));
        sparkle(ctx, jx + Math.cos(a) * d, jy + Math.sin(a) * d * 0.6, 26 * (1 - clamp(c / 0.7)) + 2, i % 3 ? '#fff6c0' : '#ffd23f', 1 - clamp(c / 0.8));
      }
      // "POP!" — full size (with a springy overshoot) ON the beat frame, then it scales away
      // (no alpha fade: a half-transparent inked word turns into a muddy grey ghost)
      const pk = (1 + 0.35 * Math.exp(-9 * c) * Math.cos(25 * c)) * (1 - ease.inBack(clamp((c - 0.36) / 0.14)));
      if (pk > 0.02) cartoonText(ctx, 'POP!', jx - 330, jy - 40, { size: 120, fill: PAL.yellow, rot: -0.2, scale: pk, lw: 14 });
    }
    // ---- re-ignition whoomph ring at the nozzle (on 48.74)
    const r2 = t - T_REIGN;
    if (r2 >= 0 && r2 < 0.8) {
      const nx = R.x - ax * 10 * s, ny = R.y - ay * 10 * s;
      glow(ctx, nx, ny, 380 * s, '#ffd27a', 0.8 * Math.exp(-7 * r2));
      for (let i = 0; i < 5; i++) {
        const a = R.ang + Math.PI / 2 + (i - 2) * 0.5;
        const d = 230 * ease.outCubic(clamp(r2 / 0.5)) * s;
        poof(ctx, nx + Math.cos(a) * d, ny + Math.sin(a) * d, 62 * s, { seed: 90 + i, u: 0.2 + 0.8 * clamp(r2 / 0.8), n: 5, lw: 4, fill: '#fff1d6', shadeCol: '#f0b27a' });
      }
    }
    // ---- sparkly trail as it sails away
    if (t > T_REIGN) {
      for (let i = 0; i < 16; i++) {
        const tt = t - i * 0.06;
        if (tt < T_REIGN) break;
        const P = rocketD(tt);
        const [qx, qy] = AX(P.ang);
        const ex = P.x - qx * 240 * RS_D * P.depth, ey = P.y - qy * 240 * RS_D * P.depth;
        const k = 1 - i / 16;
        sparkle(ctx, ex + 14 * noise1(i * 3.1, 5), ey + 14 * noise1(i * 2.7, 6), (16 + 10 * hat(t)) * k * P.depth + 3, '#fff3c4', k);
      }
    }
  });
}

export default {
  id: 's08_ascent',
  start: 43.338,
  end: 50.538,
  transition: { type: 'cut' },
  draw(ctx, t) {
    if (t < T_SPACE) shotC(ctx, Math.max(t, T_IN - 1.5));
    else shotDE(ctx, Math.min(t, T_END + 1.5));
  },
};
