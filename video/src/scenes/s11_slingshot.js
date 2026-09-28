// s11 — THE DROP: slingshot round the ringed planet (bar 24, 57.74 → 60.14). Drums + bass slam back in.
//
//   A  57.74 (b1, flash)  WHOOSH — the camera locks onto the rocket exactly where s10 left it (same screen spot,
//                         same heading), the engine roars on the kick and the camera ROLLS ~65° as the ship whips
//                         round the limb: bands streaming underneath, the ring arching overhead, speed lines
//                         focused on the ship, streaks, star trails, shake on the hit.
//   B  58.34 (b2, cut)    g-force insert: a two-panel comic cut-in, Juno | Biscuit, big faces in 'gforce' (cheeks,
//                         buns, ears, tongue streaming back), heads dragged back and flapping, sweat flung off,
//                         wind streaks, everything jolting on the kick/snare.
//   C  58.94 (b3, cut)    wide pull-back: the rocket slings out of the curve trailing a golden glowing string — the
//                         dotted path from s10, now drawn in light. 59.54 (snare): the string TWANGS, sparkles
//                         burst, "WHEEE!" and the ship swoops round to nose-up-left; s12 opens with a match-dissolve
//                         on this framing (same screen spot, size, heading and planet).
// LYRICS.gravity keeps drawing until it has faded (its last word "me" lands at 57.84, gone by 59.8).
import { W, H, PAL, INK, LW, camera, glow, sparkle, speedLines, streaks, shake, cartoonText, softStarPath, ink, circlePath } from '../draw.js';
import { TAU, clamp, lerp, ease, hash01, rgba, smoothstep } from '../util.js';
import { barTime, beatAt, kick, snare, hat, pulse } from '../timing.js';
import { spaceBg } from '../props/space.js';
import { drawRocket } from '../props/rockets.js';
import { drawGirlHead } from '../characters/girl.js';
import { drawDogHead } from '../characters/dog.js';
import { drawLyric, LYRICS } from '../lyrics.js';
import { ORBIT, orbitPos, orbitDir, TH_DROP, planetRot, ringedPlanet } from './s10_gravity.js';

// ---------------------------------------------------------------- beat grid
const T_A = barTime(24); //          57.74 THE DROP — whoosh
const T_B = barTime(24, 1); //       58.34 g-force faces
const T_C = barTime(24, 2); //       58.94 wide: sling out
const T_TWANG = barTime(24, 3); //   59.54 the string twangs (snare)
const T_END = barTime(25); //        60.14 (dissolve to s12 until 60.74)
const DEG = Math.PI / 180;
const A_TILT = 1.1; // shot A redraws the planet spun so the bands run across the limb (speed cue) and the ring arches overhead

// ---------------------------------------------------------------- rocket orbit angle
const TH_A1 = 272 * DEG, TH_C0 = 298 * DEG;
function rocketTheta(t) {
  if (t < T_B) {
    const u = clamp((t - T_A) / (T_B - T_A));
    return lerp(TH_DROP, TH_A1, 0.45 * u + 0.55 * ease.inOutSine(u));
  }
  return lerp(TH_A1, TH_C0, clamp((t - T_B) / (T_C - T_B)));
}

// camera that puts world point `wp` at screen point P with screen rotation rot
function lockCam(wp, P, zoom, rot) {
  const vx = (W / 2 - P[0]) / zoom, vy = (H / 2 - P[1]) / zoom;
  const c = Math.cos(-rot), s = Math.sin(-rot);
  return { x: wp[0] + vx * c - vy * s, y: wp[1] + vx * s + vy * c, zoom, rot };
}
function toScreen(cam, [x, y]) {
  const dx = (x - cam.x) * cam.zoom, dy = (y - cam.y) * cam.zoom, c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

// Tapered glowing ribbon: pts[0] = head (width w0, alpha a0) → tail (w1, a1). One filled polygon per layer
// (no overlapping chunks, so no alpha beads at the joins).
function ribbon(ctx, pts, layers) {
  const n = pts.length;
  if (n < 2) return;
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)];
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
    nrm.push([-dy / d, dx / d]);
  }
  for (const [w0, w1, col, a0, a1] of layers) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const w = lerp(w0, w1, Math.pow(i / (n - 1), 0.8)) / 2;
      const X = pts[i][0] + nrm[i][0] * w, Y = pts[i][1] + nrm[i][1] * w;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const w = lerp(w0, w1, Math.pow(i / (n - 1), 0.8)) / 2;
      ctx.lineTo(pts[i][0] - nrm[i][0] * w, pts[i][1] - nrm[i][1] * w);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[n - 1][0], pts[n - 1][1]);
    g.addColorStop(0, rgba(col, a0)); g.addColorStop(1, rgba(col, a1));
    ctx.fillStyle = g; ctx.fill();
  }
}

function drawShip(ctx, x, y, dir, s, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir + Math.PI / 2 + (o.yaw || 0));
  const st = o.stretch || 1;
  ctx.scale(1 / Math.sqrt(st), st);
  drawRocket(ctx, 0, 360 * s, s, { t: o.t, flame: o.flame ?? 1, crew: true, crewPose: o.crewPose, shake: o.shake || 0 });
  ctx.restore();
}

// stars scattered round the planet in world space (they spin with the camera), streaked along the orbit
function worldStars(ctx, t, n, a0, a1, rA, rB, streak, zoom) {
  const hp = hat(t);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, hash01(i, 61));
    const R = lerp(rA, rB, Math.sqrt(hash01(i, 62)));
    const x = ORBIT.cx + R * Math.cos(a), y = ORBIT.cy + R * Math.sin(a);
    const tx = -Math.sin(a), ty = Math.cos(a);
    const big = hash01(i, 63) < 0.12;
    const w = ((big ? 3.2 : 1.8) / zoom) * (1 + (hash01(i, 64) < 0.3 ? hp * 0.7 : 0));
    ctx.strokeStyle = rgba(hash01(i, 65) < 0.2 ? '#ffd6ec' : '#ffffff', 0.55 + 0.45 * hash01(i, 66));
    ctx.lineWidth = w * 2;
    const L = streak * (0.6 + 0.4 * hash01(i, 67)) + 0.01;
    ctx.beginPath(); ctx.moveTo(x - tx * L * 0.5, y - ty * L * 0.5); ctx.lineTo(x + tx * L * 0.5, y + ty * L * 0.5); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- shot A: WHOOSH
// s10's last frame has the ship at screen (892, 404) heading −41° (see s10 cam10 at 57.74). Shot A starts there,
// then the ship overtakes the camera (drifts right) while the camera rolls so its screen heading swings to +22°.
const A_P0 = [892, 404], A_P1 = [1290, 372];
const A_H0 = -41.4 * DEG, A_H1 = 22 * DEG;
const CREW_G = { girl: { expr: 'gforce', helmet: 0 }, dog: { expr: 'gforce', helmet: 0, suit: 'space' } };
function shotA(ctx, t) {
  const u = clamp((t - T_A) / (T_B - T_A));
  const e = ease.inOutSine(u);
  const th = rocketTheta(t);
  const rw = orbitPos(th), dir = orbitDir(th);
  const P = [lerp(A_P0[0], A_P1[0], 0.3 * u + 0.7 * e), lerp(A_P0[1], A_P1[1], e)];
  const Hs = lerp(A_H0, A_H1, e);
  const k = kick(t, 7);
  const zoom = lerp(3.0, 3.4, u) * (1 + 0.05 * k);
  const sh = shake(t, T_A, 28, 5);
  const cam = { ...lockCam(rw, P, zoom, Hs - dir), dx: sh.dx, dy: sh.dy };
  cam.rot += sh.rot * 3;

  spaceBg(ctx, { t, seed: 9, hue: 'violet', stars: 120, nebula: 0, band: 0.5, driftX: u * 900 });
  camera(ctx, cam, () => {
    worldStars(ctx, t, 150, 200 * DEG, 300 * DEG, ORBIT.r + 40, ORBIT.r + 420, 18 + 10 * u, zoom);
    ringedPlanet(ctx, ORBIT.cx, ORBIT.cy, ORBIT.r, { rot: planetRot(t) + u * 0.6, tilt: ORBIT.tilt + A_TILT, open: ORBIT.open });
    // friction glow on the limb under the ship
    glow(ctx, rw[0], rw[1], 95, '#ffd0f0', 0.35);
    // glowing trail from the nozzle back along the orbit
    const s = 0.13, st = 1.14 + 0.06 * k;
    const noz = 330 * s * st, dth = noz / Math.hypot(rw[0] - ORBIT.cx, rw[1] - ORBIT.cy);
    const tr = [];
    for (let i = 0; i <= 18; i++) tr.push(orbitPos(th - dth - (i / 18) * 20 * DEG));
    const zk = 1 / zoom;
    ribbon(ctx, tr, [[110 * zk, 20 * zk, '#ff9ed2', 0.32, 0], [46 * zk, 8 * zk, '#ffd27a', 0.7, 0], [15 * zk, 3 * zk, '#fffbea', 1, 0.1]]);
    drawShip(ctx, rw[0], rw[1], dir, s, {
      t, flame: 1, stretch: st, yaw: 0.05 * Math.sin(t * 40) * (1 - u), shake: 0.4,
      crewPose: { girl: { ...CREW_G.girl, t }, dog: { ...CREW_G.dog, t } },
    });
  });
  // whoosh: focus lines round the ship + parallel streaks flowing past it
  speedLines(ctx, P[0] + sh.dx, P[1] + sh.dy, t, { count: 44, inner: 330, outer: 1400, alpha: 0.42, lw: 6, seed: 12 });
  streaks(ctx, t, { angle: Hs + Math.PI, count: 26, speed: 4200, alpha: 0.35, len: 420, lw: 5, seed: 31 });
}

// ---------------------------------------------------------------- shot B: g-force two-panel cut-in
const GUT = { top: 1012, bot: 880, w: 11 }; // slanted white gutter between the panels
const gx = (y) => lerp(GUT.top, GUT.bot, y / H);
function panelPath(ctx, side) {
  const y0 = -60, y1 = H + 60;
  ctx.beginPath();
  if (side < 0) {
    ctx.moveTo(-60, y0); ctx.lineTo(gx(y0) - GUT.w, y0); ctx.lineTo(gx(y1) - GUT.w, y1); ctx.lineTo(-60, y1);
  } else {
    ctx.moveTo(gx(y0) + GUT.w, y0); ctx.lineTo(W + 60, y0); ctx.lineTo(W + 60, y1); ctx.lineTo(gx(y1) + GUT.w, y1);
  }
  ctx.closePath();
}
// padded seat back behind a head (same look as cockpit.js's red tufted seats)
function seatBack(ctx, x, top, w, emblem, lw) {
  const h = 1400;
  const sp = (xl, xr) => {
    const ww = xr - xl, xm = (xl + xr) / 2;
    ctx.beginPath();
    ctx.moveTo(xl, top + h); ctx.lineTo(xl, top + 150);
    ctx.bezierCurveTo(xl, top - 14, xm - ww * 0.3, top, xm, top);
    ctx.bezierCurveTo(xm + ww * 0.3, top, xr, top - 14, xr, top + 150);
    ctx.lineTo(xr, top + h); ctx.closePath();
  };
  sp(x - w / 2, x + w / 2); ctx.fillStyle = PAL.redDark; ctx.fill();
  sp(x - w / 2, x + w / 2 - 50); ctx.fillStyle = PAL.red; ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 5;
  ctx.beginPath();
  for (const k of [-0.2, 0.2]) { ctx.moveTo(x + k * w, top + 70); ctx.lineTo(x + k * w, top + h); }
  ctx.stroke();
  ctx.fillStyle = PAL.redDark;
  ctx.beginPath();
  for (let r = 0; r < 4; r++) for (const k of [-0.2, 0.2]) { const bx = x + k * w, by = top + 160 + r * 170; ctx.moveTo(bx + 11, by); ctx.arc(bx, by, 11, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(x - w * 0.34, top + 120, 20, 60, 0.15, 0, TAU); ctx.fill();
  if (emblem === 'star') { softStarPath(ctx, x - w * 0.36, top + 80, 30, 17, 5, -Math.PI / 2 - 0.15); ink(ctx, PAL.yellow, lw * 0.8); }
  sp(x - w / 2, x + w / 2); ink(ctx, null, lw);
}
// the capsule wall behind the seats: steel-teal with ribs and a couple of blinking lamps (on the beat)
function wallBg(ctx, t, x0, x1, lampX, seed) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b5160'); g.addColorStop(1, '#203f4c');
  ctx.fillStyle = g; ctx.fillRect(x0, -80, x1 - x0, H + 160);
  ctx.strokeStyle = '#4f8391'; ctx.lineWidth = 22;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { const xx = x0 + (i + 0.3) * (x1 - x0) / 3; ctx.moveTo(xx, -80); ctx.lineTo(xx - 120, H + 80); }
  ctx.stroke();
  const p = pulse(t, 6);
  for (let i = 0; i < 4; i++) {
    const on = hash01(i + Math.floor(beatAt(t)) * 7, seed) < 0.5;
    const lx = lampX + i * 64, ly = 62;
    circlePath(ctx, lx, ly, 14); ink(ctx, on ? ['#ff5a4f', '#5ef08a', '#ffd23f', '#5ab8ff'][i] : '#2a3a48', 4);
    if (on) glow(ctx, lx, ly, 50, '#fff6c0', 0.35 * p);
  }
}
function sweat(ctx, t, hx, hy, sc, sd) {
  for (let i = 0; i < 5; i++) {
    const life = 0.3, ph = (((t - T_B) / life + i / 5 + hash01(i, sd) * 0.2) % 1 + 1) % 1;
    const x = hx - ph * 330 * sc, y = hy - 40 * sc * Math.sin(ph * Math.PI) + (hash01(i, sd + 5) - 0.5) * 150 * sc + ph * 50 * sc;
    const r = 16 * sc * (1 - 0.45 * ph);
    ctx.save();
    ctx.globalAlpha *= clamp((1 - ph) * 3);
    ctx.translate(x, y); ctx.rotate(0.15);
    // teardrop: round head leading (screen-left), tail trailing right
    ctx.beginPath(); ctx.moveTo(r * 2.4, 0);
    ctx.bezierCurveTo(r * 0.8, -r * 0.9, -r, -r * 1.1, -r, 0);
    ctx.bezierCurveTo(-r, r * 1.1, r * 0.8, r * 0.9, r * 2.4, 0);
    ctx.fillStyle = '#d8f1ff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.28, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
// g-force distortion around a head centre: top dragged back (−x), face flattened, cheeks flapping
function gWarp(ctx, hx, hy, G, flap) {
  ctx.translate(hx, hy);
  ctx.transform(1 + 0.05 * G + 0.018 * flap, 0, 0.1 * G + 0.02 * flap, 1 - 0.045 * G, 0, 0);
  ctx.translate(-hx, -hy);
}
function shotB(ctx, t) {
  const u = clamp((t - T_B) / (T_C - T_B));
  const k = kick(t, 8), sn = snare(t, 8), hit = Math.max(k, sn);
  const G = 0.8 + 0.2 * hit;
  const flap = Math.sin(TAU * 13 * (t - T_B));
  const push = 1 + 0.05 * ease.outCubic(u) + 0.035 * hit;
  // --- left: Juno
  const shL = shake(t, T_B, 30, 4.5, 26);
  ctx.save();
  panelPath(ctx, -1); ctx.clip();
  camera(ctx, { x: 470, y: 540, zoom: push, rot: -0.04 + shL.rot * 2, dx: 470 - W / 2 + shL.dx, dy: shL.dy }, () => {
    wallBg(ctx, t, -200, 1100, 70, 3);
    seatBack(ctx, 520, 150, 720, 'star', LW * 1.6);
    streaks(ctx, t, { angle: Math.PI + 0.1, count: 12, speed: 5200, alpha: 0.28, len: 520, lw: 6, seed: 44 });
    ctx.save();
    gWarp(ctx, 470, 470, G, flap);
    drawGirlHead(ctx, 470, 470, 2.25, {
      t, facing: 1, suit: 'space', helmet: 0, expr: 'gforce', gforce: G, look: [0.6, 0], headTilt: -0.06 + 0.03 * flap, bustDepth: 190,
    });
    ctx.restore();
    sweat(ctx, t, 330, 330, 1.2, 1);
  });
  ctx.restore();
  // --- right: Biscuit
  const shR = shake(t, T_B, 34, 4.5, 29);
  ctx.save();
  panelPath(ctx, 1); ctx.clip();
  camera(ctx, { x: 1440, y: 540, zoom: push, rot: 0.03 + shR.rot * 2, dx: 1440 - W / 2 + shR.dy, dy: shR.dx }, () => {
    wallBg(ctx, t, 800, 2150, 1600, 5);
    seatBack(ctx, 1470, 200, 700, 'bone', LW * 1.6);
    streaks(ctx, t, { angle: Math.PI + 0.1, count: 12, speed: 5600, alpha: 0.28, len: 520, lw: 6, seed: 45 });
    ctx.save();
    gWarp(ctx, 1450, 470, G, -flap);
    // (plain collar + chest stub: the space-vest stub reads as a red bowl this close)
    drawDogHead(ctx, 1450, 470, 2.95, {
      t, facing: 1, helmet: 0, expr: 'gforce', gforce: G, headTilt: -0.08 - 0.03 * flap,
    });
    ctx.restore();
    sweat(ctx, t, 1270, 320, 1.25, 2);
  });
  ctx.restore();
  // --- gutter
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(gx(-60) - GUT.w, -60); ctx.lineTo(gx(-60) + GUT.w, -60); ctx.lineTo(gx(H + 60) + GUT.w, H + 60); ctx.lineTo(gx(H + 60) - GUT.w, H + 60);
  ctx.closePath();
  ctx.fillStyle = PAL.white; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(gx(-60) - GUT.w, -60); ctx.lineTo(gx(H + 60) - GUT.w, H + 60);
  ctx.moveTo(gx(-60) + GUT.w, -60); ctx.lineTo(gx(H + 60) + GUT.w, H + 60);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- shot C: sling out with a glowing string
// The exit path: s10's hyperbola up to θ = 310°, then a happy swoop turning back up-left (so the rocket leaves
// heading nose-up-left, the way s12 finds it), then a straight coast. Built once as a polyline with arc length.
const PATH_C = (() => {
  const pts = [];
  const th0 = 196 * DEG, thT = 310 * DEG;
  for (let i = 0; i <= 120; i++) pts.push(orbitPos(lerp(th0, thT, i / 120)));
  const [ex, ey] = pts[pts.length - 1];
  const h0 = orbitDir(thT);
  const rho = 150, turn = 150 * DEG; // left turn (counter-clockwise on screen)
  const ccx = ex + Math.cos(h0 - Math.PI / 2) * rho, ccy = ey + Math.sin(h0 - Math.PI / 2) * rho;
  const a0 = h0 + Math.PI / 2;
  for (let i = 1; i <= 60; i++) {
    const a = a0 - turn * (i / 60);
    pts.push([ccx + Math.cos(a) * rho, ccy + Math.sin(a) * rho]);
  }
  const hEnd = h0 - turn;
  const [lx, ly] = pts[pts.length - 1];
  for (let i = 1; i <= 40; i++) pts.push([lx + Math.cos(hEnd) * 20 * i, ly + Math.sin(hEnd) * 20 * i]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const dAt = (th) => { const q = orbitPos(th); let best = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; best = i; } }); return cum[best]; };
  return { pts, cum, total: cum[cum.length - 1], dC0: dAt(TH_C0), dTurn: cum[120], hEnd };
})();
function pathAt(d) {
  const { pts, cum } = PATH_C;
  d = clamp(d, 0, PATH_C.total - 0.01);
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const f = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
  const x = lerp(pts[lo][0], pts[hi][0], f), y = lerp(pts[lo][1], pts[hi][1], f);
  return [x, y, Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0])];
}
// distance along PATH_C over time: fast out of the sling, carving the swoop from 59.54, coasting into s12
function rocketDistC(t) {
  const d0 = PATH_C.dC0, dT = PATH_C.dTurn, dSw = dT + 150 * 150 * DEG;
  if (t < T_TWANG) { const v = (t - T_C) / (T_TWANG - T_C); return lerp(d0, dT - 10, ease.outQuad(v) * 0.85 + 0.15 * v); }
  if (t < T_END) return lerp(dT - 10, dSw + 20, ease.inOutSine((t - T_TWANG) / (T_END - T_TWANG)));
  return dSw + 20 + 170 * (t - T_END);
}
// NOTE: s12 opens with a match-dissolve that replays this shot's last 0.6 s (rocket centre (1150,318) → (1075,366),
// planet low-left at zoom 0.9, rot −0.04, string widths 64/28/9) — keep this camera + ship scale as they are.
function camC(t, rx, ry) {
  const pull = ease.outCubic(clamp((t - T_C) / 1.0));
  const follow = lerp(0.42, 0.78, smoothstep(T_TWANG - 0.1, T_END + 0.4, t)); // drift onto the ship for the dissolve
  return {
    x: lerp(rx - 110, lerp(1400, rx, follow), pull),
    y: lerp(ry + 60, lerp(430, ry + 40, follow), pull),
    zoom: lerp(2.1, 0.9, pull) * (1 + 0.02 * kick(t)),
    rot: lerp(0.12, -0.04, pull),
  };
}
function shotC(ctx, t) {
  const pull = ease.outCubic(clamp((t - T_C) / 1.0));
  const d = rocketDistC(t);
  const [rx, ry, rdir] = pathAt(d);
  const c0 = camC(t, rx, ry);
  const sh = shake(t, T_C, 16, 6);
  const cam = { ...c0, rot: c0.rot + sh.rot, dx: sh.dx, dy: sh.dy };
  const zoom = cam.zoom;
  spaceBg(ctx, { t, seed: 4, hue: 'violet', stars: 300, nebula: 0.55, driftX: (t - T_C) * 60, driftY: 0 });
  // the string twangs on the snare: a decaying standing wave across the trail
  const tw = t >= T_TWANG ? Math.exp(-4.2 * (t - T_TWANG)) * Math.sin(TAU * 6.5 * (t - T_TWANG)) : 0;
  const twHit = t >= T_TWANG ? Math.exp(-6 * (t - T_TWANG)) : 0;
  const s = lerp(0.16, 0.27, pull);
  camera(ctx, cam, () => {
    ringedPlanet(ctx, ORBIT.cx, ORBIT.cy, ORBIT.r, { rot: planetRot(t), tilt: ORBIT.tilt, open: ORBIT.open });
    // trail: from where s10's dotted arc began, round the top, through the swoop, to the ship's nozzle
    const dTail = lerp(0, 420, clamp((t - T_C) / 1.8));
    const dHead = d - 330 * s;
    const N = 110;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N; // 0 at the head (pts[0], by the nozzle) … 1 at the tail end
      const [x, y, ang] = pathAt(lerp(dHead, dTail, f));
      const off = 62 * tw * Math.sin(Math.PI * f * 3) * Math.sin(Math.PI * f);
      pts.push([x - Math.sin(ang) * off, y + Math.cos(ang) * off]);
    }
    const lwk = 1 / zoom;
    const gp = 1 + 0.5 * pulse(t, 5) + 0.8 * twHit;
    // bold while it slings; eased back to s12's copy of the string (64/28/9, α .13/.3/1) for the hand-off
    const b = 1 - smoothstep(T_END - 0.35, T_END + 0.05, t);
    ribbon(ctx, pts, [
      [lerp(64, 96, b) * lwk, 26 * lwk, '#ff9ed2', Math.min(1, lerp(0.13, 0.22, b) * gp), 0.04],
      [lerp(28, 40, b) * lwk, 10 * lwk, '#ffd27a', Math.min(1, lerp(0.3, 0.55, b) * gp), lerp(0.09, 0.12, b)],
      [lerp(9, 14, b) * lwk, 4 * lwk, '#fffbea', 1, lerp(0.3, 0.45, b)],
    ]);
    // sparkles riding the string (twinkle on hats, burst on the twang)
    const hp = hat(t);
    for (let i = 0; i < 34; i++) {
      const f = (hash01(i, 81) + (t - T_C) * 0.12) % 1; // 0 = head … 1 = tail
      const [x, y] = pts[Math.min(N, Math.floor(f * N))];
      const tw2 = 0.5 + 0.5 * Math.sin(TAU * (beatAt(t) + hash01(i, 82)));
      const near = 1 - 0.6 * f;
      const r = (10 + 12 * tw2 + 14 * hp * (hash01(i, 83) < 0.4 ? 1 : 0) + 26 * twHit) * lwk * near;
      const jx = (hash01(i, 84) - 0.5) * 44 * lwk, jy = (hash01(i, 85) - 0.5) * 44 * lwk;
      sparkle(ctx, x + jx, y + jy, r, i % 3 ? '#fff6c0' : '#ffd6ec', 0.95 * near);
    }
    // ship: flame roars out of the sling, eases off as it coasts into the quiet
    const flame = lerp(1, 0.2, smoothstep(T_TWANG, T_END + 0.45, t));
    glow(ctx, rx, ry, 110 * lwk + 60, '#fff1c4', 0.3);
    drawShip(ctx, rx, ry, rdir, s, {
      t, flame, stretch: lerp(1.14, 1, pull) + 0.08 * twHit,
      crewPose: { girl: { expr: 'excited', t, helmet: 0 }, dog: { expr: 'excited', t, helmet: 0, suit: 'space' } },
    });
    // "WHEEE!" as it carves the swoop (rides beside the ship, screen-sized)
    const wk = clamp((t - T_TWANG + 0.04) / 0.2);
    if (wk > 0) {
      const out = 1 - clamp((t - (T_END - 0.05)) / 0.3);
      cartoonText(ctx, 'WHEEE!', rx + 150, ry + 70, {
        size: 70 / zoom, fill: PAL.yellow, scale: ease.outBack(wk, 2.4), alpha: out,
        rot: -0.18 + 0.05 * Math.sin(t * 9) - cam.rot, lw: 10 / zoom,
      });
    }
  });
  // a small punch-flash on the cut (kick at 58.94)
  const fl = Math.exp(-14 * (t - T_C)) * 0.5;
  if (fl > 0.01) { ctx.fillStyle = rgba('#ffffff', fl); ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- scene
export default {
  id: 's11_slingshot',
  start: 57.739,
  end: 60.139,
  transition: { type: 'flash', dur: 0.35 }, // shorter than the default 0.5 so the whoosh isn't washed out
  draw(ctx, t) {
    const tt = clamp(t, T_A, T_END + 0.9);
    if (tt < T_B) shotA(ctx, tt);
    else if (tt < T_C) shotB(ctx, tt);
    else shotC(ctx, tt);
    drawLyric(ctx, t, LYRICS.gravity, 960, 900);
  },
};
