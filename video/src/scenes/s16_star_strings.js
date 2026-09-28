// s16_star_strings — 96.14 → 105.74 (bars 40–43) · transition: flash (THE PEAK)
// The baby star leads, the S.S. Biscuit follows, and the rocket's exhaust becomes a glowing RAINBOW
// STRING that connects the stars into giant constellation pictures — the rocket lands on a key star
// exactly on every beat (snap burst + twang), one picture per bar, each picture completing on the next
// downbeat, where the camera punches out to reveal the growing sky gallery:
//   bar 40 (96.14)  HEART        — the rocket bursts out of the white flash at the heart's top-right lobe
//   bar 41 (98.54)  BISCUIT FACE — a linking string whips across the sky from the heart; nose BOOP on b3,
//                                  smiling "w" muzzle, the eyes light up as it completes
//   bar 42 (100.94) JUNO with pigtails (head, dress, left bun + arm, then smile + right bun and her right
//                   arm goes up on the downbeat — she ends holding the string to the next picture)
//   bar 43 (103.34) the S.S. BISCUIT (completes on beat 3); meanwhile the baby star breaks away and
//                   lands in the middle of the gallery on 105.14, winks; the rocket loops round it.
// Each completed picture gets a flare + a double rainbow shockwave; the camera pulls back on every
// downbeat and drifts in on the next picture during the bar; the sky blooms softly on every kick.
// Everything is analytic in t: the rocket's route is a precomputed polyline per picture with key
// stars pinned to beats; constellation() is fed the matching progress (linear) so the string tip is
// always exactly at the rocket's nozzle.
// !! s17_homeward OPENS ON THIS SCENE'S LAST FRAME (1.2 s crossfade). Its copy of the end state must
//    match: it should import S16_GALLERY / s16AlivePts / s16RocketPos (exported at the bottom) rather
//    than duplicating PICS, and keep mirroring the last three CAM keys and the star at HOME (r 80).
import { W, H, INK, PAL, camera, glow, sparkle, circlePath } from '../draw.js';
import { TAU, clamp, lerp, ease, keyframes, hash01, noise1, rgba, fract, mixColor } from '../util.js';
import { barTime, beatAt, pulse, kick, hat, sway, SPB } from '../timing.js';
import { drawRocket } from '../props/rockets.js';
import { spaceBg, nebula, drawBabyStar, constellation, placeConstellation, CONSTELLATIONS, shootingStar } from '../props/space.js';

// ------------------------------------------------------------------ beat grid
const T40 = barTime(40); // 96.14 white flash, heart begins
const T41 = barTime(41); // 98.54 heart complete → pull back, link → Biscuit
const T42 = barTime(42); // 100.94 Biscuit complete → pull back, link → Juno
const T43 = barTime(43); // 103.34 Juno complete → pull back, link → rocket
const T_BREAK = barTime(43, 2); // 104.54 the baby star breaks away toward the middle
const T_HOME = barTime(43, 3); // 105.14 rocket picture complete; the star takes its place + winks
const T44 = barTime(44); // 105.74 scene end (s17 fades in over 1.2 s)
const HOME = [0, 30]; // the baby star's place in the middle of the gallery (world)
// Hit convention: the scene is evaluated half a 30 fps frame ahead, so each snap / downbeat burst
// shows on the frame NEAREST its beat (≤ 1/60 s early) rather than on the first frame after it.
const NEAR = 1 / 60;

// Biscuit's face: the shared dogFace picture, plus two up-turned mouth corners, so the inverted-V
// muzzle under the nose becomes a happy "w" smile (the plain ^ read as a frown at gallery size).
// All original points/segments are kept (same indices), so s17's copy of the gallery still overlays.
const DOG_FACE = {
  pts: [...CONSTELLATIONS.dogFace.pts, [-0.38, 0.27, 0.55], [0.38, 0.27, 0.55]],
  segments: [...CONSTELLATIONS.dogFace.segments, [12, 16], [13, 17]],
};

// ------------------------------------------------------------------ the gallery (world units)
// path: vertex indices in flying order; consecutive pairs that are a segment of the picture are drawn
// (or retraced when already drawn), pairs that aren't are hops (flown without a string).
// keys: path indices where the rocket must be ON a beat (beat 1, 2, 3, 4 = next downbeat).
const PICS = [
  { name: 'heart', cx: -700, cy: -290, size: 300, hue: 330, bar: 40,
    path: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], keys: [3, 6, 9, 12] },
  // Biscuit: left ear → top → right ear (b1) · right cheek + chin (b2) · jaw, smile → BOOP the nose (b3) ·
  // rest of the smile, left cheek + left ear (downbeat: complete, the eyes light up)
  { name: 'dogFace', shape: DOG_FACE, cx: 700, cy: -320, size: 330, hue: 20, bar: 41,
    path: [9, 0, 1, 7, 8, 2, 1, 2, 3, 4, 5, 4, 16, 12, 11, 13, 17, 5, 6, 10, 6, 0, 9, 10], keys: [3, 9, 14, 23] },
  // Juno: the link lands on her right bun · head outline (b1) · neck, dress + legs (b2) · left bun + left arm (b3)
  // · smile, right bun, and her right arm goes up to wave on the downbeat (complete). The face and silhouette come
  // before the second pigtail, so no partial state reads as mouse ears. She ends holding the string to the rocket.
  // (link in at vertex 22, out at vertex 14 = her raised right hand — s17's copy of the gallery uses the same ends)
  { name: 'girl', cx: -660, cy: 380, size: 330, hue: 90, bar: 42,
    path: [22, 18, 7, 6, 5, 4, 3, 2, 13, 12, 11, 17, 11, 10, 16, 10, 9, 8, 1, 0, 7,
      6, 5, 4, 23, 24, 25, 26, 27, 23, 4, 3, 2, 13, 15,
      30, 31, 32, 18, 19, 20, 21, 22, 18, 7, 0, 1, 8, 14],
    keys: [7, 20, 34, 48] },
  { name: 'rocket', cx: 700, cy: 370, size: 360, hue: 190, bar: 43,
    path: [7, 6, 5, 4, 5, 10, 4, 3, 2, 1, 0, 8, 7, 8, 9, 1], keys: [5, 10, 15] },
];

// Build every picture's geometry + the rocket's route (moves with times) once, at module load.
// (Pure precomputation of constants — no state changes between frames.)
const ROUTE = []; // { t0, t1, a:[x,y], b:[x,y], kind: 'draw'|'retrace'|'hop'|'link', pic, seg }
const KEYS = []; // { t, p:[x,y], pic, hue, last }
const segKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
for (let pi = 0; pi < PICS.length; pi++) {
  const P = PICS[pi];
  const shape = P.shape || CONSTELLATIONS[P.name];
  const pl = placeConstellation(shape, P.cx, P.cy, P.size);
  P.pts = pl.pts;
  const segSet = new Set(shape.segments.map(([a, b]) => segKey(a, b)));
  const drawn = new Set();
  P.segs = []; // drawn segments in flying order, oriented
  const moves = [];
  if (pi > 0) {
    const prev = PICS[pi - 1];
    moves.push({ a: prev.end, b: P.pts[P.path[0]], kind: 'link', pathIdx: 0 });
  }
  for (let i = 1; i < P.path.length; i++) {
    const va = P.path[i - 1], vb = P.path[i];
    const k = segKey(va, vb);
    let kind = 'hop', seg = -1;
    if (segSet.has(k)) {
      if (drawn.has(k)) kind = 'retrace';
      else { kind = 'draw'; drawn.add(k); seg = P.segs.length; P.segs.push([va, vb]); }
    }
    moves.push({ a: P.pts[va], b: P.pts[vb], kind, seg, pathIdx: i });
  }
  if (drawn.size !== shape.segments.length) throw new Error(`s16: ${P.name} route misses ${shape.segments.length - drawn.size} segments`);
  P.end = P.pts[P.path[P.path.length - 1]];
  P.S = P.segs.length;
  // strokes: consecutive key indices; stroke j ends at path index keys[j] on beat j+1 of its bar
  let mi = 0;
  let tPrev = barTime(P.bar);
  for (let j = 0; j < P.keys.length; j++) {
    const tKey = barTime(P.bar, j + 1);
    const stroke = [];
    while (mi < moves.length && moves[mi].pathIdx <= P.keys[j]) stroke.push(moves[mi++]);
    const lens = stroke.map((m) => Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) * (m.kind === 'retrace' ? 0.7 : 1));
    const total = lens.reduce((x, y) => x + y, 0) || 1;
    let acc = 0;
    stroke.forEach((m, k) => {
      const u0 = acc / total; acc += lens[k]; const u1 = acc / total;
      ROUTE.push({ ...m, pic: pi, s0: tPrev, s1: tKey, u0, u1 });
    });
    KEYS.push({ t: tKey, p: stroke[stroke.length - 1].b, pic: pi, hue: P.hue, last: j === P.keys.length - 1 });
    tPrev = tKey;
  }
  P.tStart = barTime(P.bar);
  P.tEnd = tPrev;
}
const ROUTE_T0 = ROUTE[0].s0, ROUTE_T1 = ROUTE[ROUTE.length - 1].s1;

// within a stroke, time → distance: mild ease so the rocket "lands" on each key star
const strokeEase = (u) => lerp(u, ease.inOutSine(u), 0.45);

// Where is the rocket (the string tip) at time t? Returns { x, y, move index, f (0..1 in move) }.
function routeAt(t) {
  const tc = clamp(t, ROUTE_T0, ROUTE_T1);
  let i = 0;
  while (i < ROUTE.length - 1 && ROUTE[i].s1 < tc) i++; // first move whose stroke ends at/after tc
  const s0 = ROUTE[i].s0, s1 = ROUTE[i].s1;
  const u = strokeEase(clamp((tc - s0) / (s1 - s0)));
  while (i < ROUTE.length - 1 && ROUTE[i + 1].s0 === s0 && ROUTE[i].u1 < u) i++;
  const m = ROUTE[i];
  const f = clamp((u - m.u0) / Math.max(1e-6, m.u1 - m.u0));
  return { x: lerp(m.a[0], m.b[0], f), y: lerp(m.a[1], m.b[1], f), i, f };
}
// constellation progress (in segments) of picture pi at time t, and the link progress into it
function progressOf(pi, t) {
  const P = PICS[pi];
  if (t < P.tStart) return { P: 0, link: 0 };
  if (t >= P.tEnd) return { P: P.S, link: 1 };
  const r = routeAt(t);
  const m = ROUTE[r.i];
  if (m.pic !== pi) return { P: m.pic > pi ? P.S : 0, link: m.pic > pi ? 1 : 0 };
  let done = 0, link = 1;
  for (let i = 0; i < r.i; i++) if (ROUTE[i].pic === pi && ROUTE[i].kind === 'draw') done++;
  if (m.kind === 'link') link = r.f;
  const P2 = m.kind === 'draw' ? done + r.f : done;
  return { P: P2, link };
}

// ------------------------------------------------------------------ pictures come alive
// Once a picture is complete it dances on the beat: the heart beats, Biscuit's ears flap, Juno
// cheers (hands pump, buns bounce), the rocket's flame kicks with the kick drum.
function alivePts(P, t) {
  const a = t >= P.tEnd ? ease.outCubic(clamp((t - P.tEnd) / 0.35)) : 0;
  if (a <= 0) return P.pts;
  const S = P.size, b = beatAt(t);
  const pts = P.pts.map((p) => p.slice());
  const rotAbout = (i, c, ang) => {
    const [x, y] = P.pts[i], [cx, cy] = P.pts[c];
    const ca = Math.cos(ang * a), sa = Math.sin(ang * a);
    pts[i][0] = cx + (x - cx) * ca - (y - cy) * sa; pts[i][1] = cy + (x - cx) * sa + (y - cy) * ca;
  };
  if (P.name === 'heart') {
    const k = 1 + a * (0.1 * pulse(t, 6) + 0.035 * (t - SPB * 0.25 > T40 ? pulse(t - SPB * 0.25, 9) : 0)); // lub-dub
    for (const p of pts) { p[0] = P.cx + (p[0] - P.cx) * k; p[1] = P.cy + (p[1] - P.cy) * k; }
  } else if (P.name === 'dogFace') {
    const th = 0.2 * Math.sin(TAU * b);
    rotAbout(7, 1, -th); rotAbout(8, 1, -th); rotAbout(9, 0, th); rotAbout(10, 0, th);
    const nod = 10 * a * Math.abs(Math.sin(Math.PI * b));
    for (const p of pts) p[1] -= nod;
  } else if (P.name === 'girl') {
    const w = Math.sin(Math.PI * b);
    pts[14][1] -= a * S * 0.16 * Math.max(0, w); pts[14][0] += a * S * 0.04 * Math.max(0, w);
    pts[15][1] -= a * S * 0.16 * Math.max(0, -w); pts[15][0] -= a * S * 0.04 * Math.max(0, -w);
    const bun = a * S * 0.05 * Math.abs(Math.sin(Math.PI * b));
    for (let i = 18; i <= 27; i++) pts[i][1] -= bun;
  } else if (P.name === 'rocket') {
    pts[10][1] += a * S * 0.16 * kick(t);
    const bob = a * 10 * Math.sin(TAU * b / 2);
    for (const p of pts) p[1] -= bob;
  }
  return pts;
}

// ------------------------------------------------------------------ camera
// Each downbeat the camera punches OUT (outCubic) to reveal the gallery, then eases in during the bar.
const punch = (u) => ease.outBack(u, 1.1); // pull-backs overshoot a touch, then settle
// Framing rule: the picture being strung is big and fully in frame; the finished picture stays fully in
// frame through its downbeat pull-back; during each bar the camera drifts in toward the new picture.
// (world boxes: heart x -994..-406 y -545..-5 · dog x 370..1030 y -577..-82 · girl x -911..-409 y 17..710 ·
//  rocket x 477..923 y 10..730)  The last three keys are mirrored by s17's opening camera — keep them.
const CAM = [ // [time, x, y, zoom, ease into this key, roll]
  [T40 - 1.5, -700, -262, 1.36, undefined, 0.03],
  [T40, -700, -262, 1.36, undefined, 0.03],
  [T41, -700, -266, 1.48, ease.inOutSine, 0.04], // heart fills the frame as it completes
  [T41 + 0.6, 10, -300, 0.84, punch, -0.02], // pull back: heart + the empty sky for Biscuit
  [T42, 300, -312, 1.06, ease.inOutSine, -0.035], // drift in on Biscuit's face (heart peeks in at the left)
  [T42 + 0.7, -40, -50, 0.72, punch, 0.02], // pull back: heart + Biscuit, Juno begins below
  [T43, -330, 190, 0.86, ease.inOutSine, 0.03], // drift in on Juno (the heart floats above her)
  [T43 + 0.7, 40, 60, 0.72, punch, -0.015], // pull back: three pictures + the rocket begins
  [T_HOME, 80, 90, 0.78, ease.inOutSine, -0.03],
  [T_HOME + 0.9, 0, 76, 0.68, ease.outCubic, 0],
  [T44 + 1.6, 0, 76, 0.65, ease.inOutSine, 0],
];
function camAt(t) {
  const k = (col) => keyframes(t, CAM.map((r) => [r[0], r[col], r[4]]));
  const x = k(1), y = k(2), zoom = Math.exp(keyframes(t, CAM.map((r) => [r[0], Math.log(r[3]), r[4]])));
  // lean a little toward the (smoothed) rocket so the action never leaves the frame
  let rx = 0, ry = 0;
  for (const d of [-0.24, -0.12, 0, 0.12, 0.24]) { const p = rocketPos(t + d); rx += p[0] / 5; ry += p[1] / 5; }
  const f = 0.22 * (1 - clamp((t - T_HOME) / 0.8));
  const rot = keyframes(t, CAM.map((r) => [r[0], r[5], r[4]]));
  return { x: x + (rx - x) * f, y: y + (ry - y) * f, zoom, rot };
}

// ------------------------------------------------------------------ small helpers
function rotSparkle(ctx, x, y, r, rot, col, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); sparkle(ctx, 0, 0, r, col, a); ctx.restore();
}
// snap burst: ring + rays + sparkles, rainbow-tinted, over `life` s
function snapBurst(ctx, t, t0, x, y, R, hue, seed, big = false) {
  const life = big ? 0.9 : 0.5;
  const u = (t - t0) / life;
  if (u < 0 || u >= 1) return;
  const e = ease.outCubic(u);
  const col = `hsl(${hue % 360},100%,78%)`;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, R * (0.45 + 0.55 * e), '#fff6d8', 0.9 * (1 - u) * (1 - u));
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = (1 - u) * (1 - u);
  ctx.strokeStyle = col; ctx.lineWidth = R * 0.07 * (1 - u) + 1;
  ctx.beginPath(); ctx.arc(x, y, R * e, 0, TAU); ctx.stroke();
  // rays
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  const n = big ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash01(seed, 3) * 0.6;
    const r0 = R * (0.25 + 0.55 * e), r1 = r0 + R * 0.35 * (1 - u);
    ctx.lineWidth = R * 0.04 * (1 - u) + 1;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < (big ? 12 : 6); i++) {
    const a = (i / (big ? 12 : 6)) * TAU + hash01(i, seed) * 0.8 + 0.3;
    const d = R * (0.5 + 0.9 * hash01(i, seed + 1)) * e;
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.14 * (1 - u) * (0.6 + 0.8 * hash01(i, seed + 2)),
      i % 2 ? '#ffffff' : `hsl(${(hue + i * 30) % 360},100%,85%)`, 1 - u);
  }
}

// ------------------------------------------------------------------ draw
function drawScene(ctx, t) {
  const tt = clamp(t, T40 - 0.2, T44 + 1.6);
  const cam = camAt(tt);
  const b = beatAt(tt);
  // camera shake on snaps (tiny) and downbeats (a bit more)
  let shx = 0, shy = 0;
  for (const K of KEYS) {
    const d = tt - K.t;
    if (d >= 0 && d < 0.5) {
      const amp = (K.last ? 16 : 7) * Math.exp(-9 * d);
      shx += amp * noise1(d * 34, 3 + K.t); shy += amp * noise1(d * 34, 9 + K.t);
    }
  }
  const zc = Math.pow(1 / cam.zoom, 0.55); // keeps strings/stars readable at every zoom

  // --- background ---
  spaceBg(ctx, { t: tt, hue: 'magenta', stars: 320, driftX: cam.x * 0.25, driftY: cam.y * 0.25, nebula: 0, band: 0.7, seed: 6 });
  // far nebula (screen space, slow parallax, scales a little with the zoom)
  const nz = Math.pow(cam.zoom, 0.3);
  nebula(ctx, { t: tt, x: W * 0.52 - cam.x * 0.16 * nz, y: H * 0.5 - cam.y * 0.16 * nz, scale: 1.12 * nz,
    colors: ['#ff7eb6', '#2ec4b6', '#b388ff', '#ffc2e0', '#4fd1e0'], seed: 9, alpha: 0.5 });
  // shooting stars streak across the far sky on the snare beats (2 & 4)
  for (let k = 40; k <= 43; k++) {
    for (const j of [1, 3]) {
      const t0 = barTime(k, j) - 0.05, u = (tt - t0) / 0.75;
      if (u <= 0 || u >= 1) continue;
      const sd = k * 4 + j;
      const x0 = W * (0.1 + 0.8 * hash01(sd, 41)), y0 = H * (0.05 + 0.35 * hash01(sd, 42));
      const ang = (hash01(sd, 43) < 0.5 ? 0.35 : Math.PI - 0.35) + (hash01(sd, 44) - 0.5) * 0.3;
      shootingStar(ctx, x0, y0, ang, u, { dist: 520, len: 260, size: 6, alpha: 0.75, tint: j === 1 ? '#ffc2e0' : '#bff5ef' });
    }
  }
  camera(ctx, { x: cam.x, y: cam.y, zoom: cam.zoom, rot: cam.rot, dx: shx, dy: shy }, () => {

    // --- the gallery ---
    const lw = 6 * zc, starSize = 13 * zc;
    const live = PICS.map((P) => alivePts(P, tt));
    for (let pi = 0; pi < PICS.length; pi++) {
      const P = PICS[pi];
      const pr = progressOf(pi, tt);
      // linking string from the previous picture: bright while it is being strung, then it
      // settles into a faint thread between the pictures
      if (pi > 0 && pr.link > 0) {
        const prev = PICS[pi - 1];
        const settle = tt > P.tStart + 0.6 ? 1 - 0.55 * clamp((tt - P.tStart - 0.6) / 0.8) : 1;
        constellation(ctx, [live[pi - 1][prev.path[prev.path.length - 1]], live[pi][P.path[0]]], pr.link, {
          t: tt, rainbow: true, hue: P.hue - 60, lw: lw * 0.55, glow: 0.8, starSize: 0.01, alpha: 0.8 * settle, linear: true, dust: 1,
        });
      }
      // flare when a picture completes (on the downbeat)
      const flare = tt >= P.tEnd ? Math.exp(-3.5 * (tt - P.tEnd)) : 0;
      const breathe = tt >= P.tEnd ? 0.12 * pulse(tt, 4) : 0;
      if (flare > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, P.cx, P.cy, P.size * 1.4, `hsl(${P.hue},100%,70%)`, 0.34 * flare);
        // "ta-da" shockwave: a double rainbow ring rushes out of the finished picture
        const u = (tt - P.tEnd) / 0.75;
        if (u < 1) {
          const e = ease.outCubic(u);
          for (let k = 0; k < 2; k++) {
            const R = P.size * (0.95 + 0.85 * e) * (1 - 0.12 * k); // starts just outside the picture
            ctx.globalAlpha = 0.75 * (1 - u) * (1 - u);
            ctx.strokeStyle = `hsl(${(P.hue + 40 + 120 * k + 200 * u) % 360},100%,72%)`;
            ctx.lineWidth = (18 - 8 * k) * zc * (1 - 0.6 * u);
            ctx.beginPath(); ctx.arc(P.cx, P.cy, R, 0, TAU); ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
      // (stars of pictures still to come already twinkle faintly in the sky, waiting for their strings)
      constellation(ctx, live[pi], pr.P / P.S, {
        t: tt, segments: P.segs, rainbow: true, hue: P.hue, lw: lw * (1 + 0.5 * flare + breathe), glow: 1.15 + 0.6 * flare + breathe,
        starSize: starSize * (1 + 0.3 * flare), linear: true, alpha: 1,
      });
    }
    // --- snap bursts on every key star (beats) ---
    // burst out of the white flash where the rocket appears
    snapBurst(ctx, tt, T40, PICS[0].pts[PICS[0].path[0]][0], PICS[0].pts[PICS[0].path[0]][1], 330 * zc, 40, 3, true);
    KEYS.forEach((K, i) => snapBurst(ctx, tt, K.t, K.p[0], K.p[1], (K.last ? 260 : 140) * zc, K.hue + 40 * i, 7 + i, K.last));

    // --- the rocket ---
    drawRocketAt(ctx, tt, zc);
    // --- the baby star ---
    drawStar(ctx, tt, zc);
  });

  // the sky breathes with the full band: a soft pink bloom on every kick (the peak of the song)
  const kb = kick(tt, 7) * (1 - clamp((tt - T44) / 0.6));
  if (kb > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1150);
    g.addColorStop(0, rgba('#ff8fc8', 0.1 * kb)); g.addColorStop(1, rgba('#ff8fc8', 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // downbeat shimmer (screen) — the picture-complete "ta-da"
  for (const K of KEYS) {
    if (!K.last) continue;
    const d = tt - K.t;
    if (d >= 0 && d < 0.4) { ctx.fillStyle = rgba('#fff4fb', 0.22 * (1 - d / 0.4) ** 2); ctx.fillRect(0, 0, W, H); }
  }
}

// rocket position after the route: loop round the baby star's home, then fly off toward Earth (s17)
function rocketPos(t) {
  if (t <= ROUTE_T1) { const r = routeAt(t); return [r.x, r.y]; }
  const end = PICS[PICS.length - 1].end;
  const d = t - ROUTE_T1;
  // swing from the route end into a loop round HOME (radius 150), then away to the lower right
  const R = 170;
  const a0 = Math.atan2(end[1] - HOME[1], end[0] - HOME[0]);
  const loopU = clamp(d / 1.0);
  const a = a0 - TAU * 1.05 * ease.inOutSine(loopU) * 1;
  const rr = lerp(Math.hypot(end[0] - HOME[0], end[1] - HOME[1]), R, ease.outCubic(clamp(d / 0.5)));
  let x = HOME[0] + Math.cos(a) * rr, y = HOME[1] + Math.sin(a) * rr;
  if (d > 1.0) { const e = ease.inQuad(clamp((d - 1.0) / 1.2)); x += e * 1400; y += e * 700; }
  return [x, y];
}
function drawRocketAt(ctx, t, zc) {
  const p = rocketPos(t);
  const pa = rocketPos(t - 0.035), pb = rocketPos(t + 0.035);
  let dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  if (Math.hypot(dx, dy) < 1e-3) { dx = 1; dy = -0.3; }
  const head = Math.atan2(dy, dx);
  const speed = Math.hypot(dx, dy) / 0.07;
  const s = 0.2 * Math.min(1.3, zc * 0.95);
  // free-flight trail after the route (a short, fading rainbow ribbon)
  if (t > ROUTE_T1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 24; i++) {
      const q0 = rocketPos(t - i * 0.03), q1 = rocketPos(t - (i + 1) * 0.03);
      ctx.strokeStyle = `hsla(${(i * 15 + beatAt(t) * 40) % 360},100%,70%,${0.5 * (1 - i / 24)})`;
      ctx.lineWidth = 16 * zc * (1 - i / 30);
      ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
    }
    ctx.restore();
  }
  // glitter crumbs shed behind the nozzle
  for (let i = 0; i < 8; i++) {
    const back = (i + fract(t * 6)) * 0.035;
    const q = rocketPos(t - back);
    const tw = 1 - i / 8;
    sparkle(ctx, q[0] + noise1(i * 3 + t * 5, 2) * 16 * zc, q[1] + noise1(i * 3 + t * 5, 4) * 16 * zc, 9 * zc * tw, '#ffffff', 0.8 * tw);
  }
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(head + Math.PI / 2);
  // a little squash & stretch with speed + the kick drum
  const st = 1 + clamp(speed / 9000, 0, 0.18) + 0.05 * kick(t);
  ctx.scale(1 / Math.sqrt(st), st);
  drawRocket(ctx, 0, 14 * s, s, { t, flame: 0.75 + 0.25 * kick(t) });
  ctx.restore();
}

// baby star: leads the rocket along the route; breaks away at T_BREAK to its home, lands on T_HOME, winks
const LEAD = 0.2;
// the star glides ahead along the route (averaged over a window so it doesn't zig-zag at corners)
function leadPos(t) {
  let x = 0, y = 0;
  for (let k = 0; k < 6; k++) { const q = routeAt(t + LEAD + k * 0.07); x += q.x / 6; y += q.y / 6; }
  return [x, y];
}
// where the star is: ahead of the rocket until T_BREAK, then an arc home (lands ON T_HOME)
function starPos(t, zc) {
  if (t < T_BREAK) {
    const q = leadPos(t);
    // hover slightly off the line, bobbing with the beat
    return { x: q[0] + 26 * zc * sway(t, 2), y: q[1] - 34 * zc - 10 * zc * Math.abs(Math.sin(Math.PI * beatAt(t))), u: 0 };
  }
  const q = leadPos(T_BREAK);
  const sx = q[0] + 26 * zc * sway(T_BREAK, 2), sy = q[1] - 34 * zc;
  const u = clamp((t - T_BREAK) / (T_HOME - T_BREAK));
  const e = ease.inOutCubic(u);
  const c = [lerp(sx, HOME[0], 0.5) + 60, Math.min(sy, HOME[1]) - 260];
  return {
    x: (1 - e) * (1 - e) * sx + 2 * e * (1 - e) * c[0] + e * e * HOME[0],
    y: (1 - e) * (1 - e) * sy + 2 * e * (1 - e) * c[1] + e * e * HOME[1], u,
  };
}
const R_HOME = 80; // (s17 opens on this: the star at HOME, r 80, glow 1.5 + 0.4·pulse)
function drawStar(ctx, t, zc) {
  const r0 = 38 * zc;
  const sp = starPos(t, zc);
  const { x, y } = sp;
  let r = r0, expr = 'excited', wink = 0, squash = 1;
  const rp = rocketPos(t);
  const land = t - T_HOME;
  if (t >= T_BREAK) {
    r = lerp(r0, R_HOME, ease.inOutSine(sp.u));
    if (land >= 0) {
      squash = 1 - 0.22 * Math.exp(-6 * land) * Math.cos(land * 22);
      wink = keyframes(t, [[T_HOME + 0.12, 0], [T_HOME + 0.24, 1, ease.outBack], [T_HOME + 0.75, 1], [T_HOME + 0.9, 0]]);
      expr = 'happy';
    }
  }
  const dxr = rp[0] - x, dyr = rp[1] - y, dl = Math.hypot(dxr, dyr) || 1;
  const look = t >= T_HOME + 0.1 ? [0.1, 0.1] : [dxr / dl, dyr / dl];
  // sparkle trail behind the star (sampled along its own path)
  if (t < T_HOME) {
    for (let i = 1; i < 7; i++) {
      const q = starPos(t - i * 0.05, zc);
      sparkle(ctx, q.x + noise1(i + t * 4, 7) * 12 * zc, q.y + noise1(i + t * 4, 8) * 12 * zc, (12 - i) * zc, '#fff6c0', 0.8 - i * 0.1);
    }
  }
  if (land < 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * 3.2, '#ffe27a', 0.45);
    ctx.restore();
  }
  drawBabyStar(ctx, x, y, r, { t, expr, look, wink, squash, glow: land >= 0 ? 1.5 + 0.4 * pulse(t, 3) : 1.3, rays: 0.9 });
  if (land >= 0) snapBurst(ctx, t, T_HOME, x, y, 260 * zc, 50, 99, true);
}

export default {
  id: 's16_star_strings',
  start: 96.141,
  end: 105.742,
  transition: { type: 'flash', dur: 0.6 },
  draw(ctx, t) {
    drawScene(ctx, t + NEAR);
  },
};

// The finished sky gallery in world coordinates, for s17's opening (it crossfades from this scene's last
// frame): { name, cx, cy, size, hue, pts, segments, first, last } per picture — first/last = the vertices
// the linking threads attach to. Import this instead of re-deriving it, so the two scenes can't drift apart.
export const S16_GALLERY = PICS.map((P) => ({
  name: P.name, cx: P.cx, cy: P.cy, size: P.size, hue: P.hue, bar: P.bar, path: P.path, keys: P.keys.length,
  pts: P.pts, // world points (dogFace has 2 extra smile-corner stars, indices 16/17)
  segs: P.segs, // drawn segments in FLYING order — pass as constellation's `segments` so the rainbow hues match
  segments: (P.shape || CONSTELLATIONS[P.name]).segments,
  first: P.path[0], last: P.path[P.path.length - 1], tEnd: P.tEnd,
}));
export const S16_HOME = HOME;
export const s16AlivePts = alivePts; // (P from S16_GALLERY, t) → the dancing points
export const s16RocketPos = rocketPos;
