// s10 — "go where the gravity takes me" (bar 23, 55.34 → 57.74). Drums drop out; dreamy, held breath.
//
// Wide: a tiny S.S. Biscuit (engines off) drifts in from the lower-left toward a HUGE banded ringed planet
// filling the right of frame. A dotted trajectory arc (Juno's plan) draws itself in surges on the sung
// words — go / where / the / gravity — curving tight round the planet's upper-left limb and away over the top.
// The rocket starts to fall along it, accelerating; the camera creeps in, then on the last beat (57.14)
// the whole frame gets sucked toward the limb (anticipation) for s11's WHOOSH on the drop at 57.74.
//
// The orbit geometry (ORBIT, orbitPos, …) is exported so s11 can fly the very same curve.
import { W, H, INK, camera, glow, sparkle, circlePath, speedLines } from '../draw.js';
import { TAU, clamp, lerp, ease, hash01, rgba } from '../util.js';
import { barTime, beatAt, sway, hat, pulse } from '../timing.js';
import { spaceBg, drawRingedPlanet } from '../props/space.js';
import { drawRocket } from '../props/rockets.js';
import { drawLyric, LYRICS } from '../lyrics.js';

// ---------------------------------------------------------------- beat grid
const T_IN = barTime(23); //         55.34 (fade in from s09 over 0.6 s)
const T_B3 = barTime(23, 3); //      57.14 last beat: the suck-in
const T_DROP = barTime(24); //       57.74 THE DROP (s11)
// the dotted arc draws itself on the sung words (LYRICS.gravity)
const W_GO = LYRICS.gravity.words[0][1], W_WHERE = LYRICS.gravity.words[1][1];
const W_THE = LYRICS.gravity.words[2][1], W_GRAV = LYRICS.gravity.words[3][1];

// ---------------------------------------------------------------- shared orbit (world = s10 frame px)
// Planet centre / drawn radius, and a hyperbolic fly-by with its focus at the planet centre:
//   R(θ) = p / (1 + e·cos(θ − θp)),  θ increasing = clockwise on screen (left → top → right).
export const ORBIT = {
  cx: 1430, cy: 720, r: 540, tilt: -0.32, open: 0.3,
  e: 1.25, rp: 615, thp: (245 * Math.PI) / 180,
};
ORBIT.p = ORBIT.rp * (1 + ORBIT.e);
const DEG = Math.PI / 180;
export function orbitR(th) { return ORBIT.p / (1 + ORBIT.e * Math.cos(th - ORBIT.thp)); }
export function orbitPos(th) {
  const R = orbitR(th);
  return [ORBIT.cx + R * Math.cos(th), ORBIT.cy + R * Math.sin(th)];
}
// direction of travel (radians, screen) at θ
export function orbitDir(th) {
  const a = orbitPos(th - 0.002), b = orbitPos(th + 0.002);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}
// rocket's orbit angle over s10 → s11 (accelerating fall, whip round the top, sling out)
export const TH_S10_A = 186 * DEG, TH_DROP = 226 * DEG;
export function rocketTheta10(t) {
  const u = clamp((t - T_IN) / (T_DROP - T_IN));
  return lerp(TH_S10_A, TH_DROP, 0.3 * u + 0.25 * u * u + 0.45 * u * u * u * u);
}
// planet band drift, shared so the cut to s11 doesn't jump
export const planetRot = (t) => t * 0.045;

// ---------------------------------------------------------------- ringed planet (with a local fix)
// space.js drawRingedPlanet lays the planet's shadow on the back ring as a hard-edged disc (centre (.42r,-.1r),
// radius 1.03r) clipped to the whole back-half annulus. Wherever the back ring shows to the right of the planet
// (s11's wide sling shot, s09's push through the porthole) that reads as a flat grey card stuck to the ring.
// Work-around: draw the planet as usual, then repaint the back ring bands inside that disc (outside the planet)
// and lay a soft, curved contact shadow next to the limb instead. Band radii/colours mirror space.js.
const RING_BANDS_L = [[1.26, 1.37, '#d9c8f2'], [1.37, 1.56, '#fff1d6'], [1.56, 1.66, '#ffe0b8'], [1.73, 1.88, '#ffc98f'], [1.92, 1.98, '#ffb3d1']];
const RING_EDGES_L = [[1.26, 1], [1.98, 1], [1.66, 0.7], [1.73, 0.7], [1.88, 0.7], [1.92, 0.7]];
export function ringedPlanet(ctx, x, y, r, o = {}) {
  drawRingedPlanet(ctx, x, y, r, o);
  const tilt = o.tilt ?? -0.32, sB = Math.sin(o.open ?? 0.3);
  const lw = o.lw ?? clamp(r * 0.02, 2, 6.9);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  // skip when the horn (local x ∈ [0.8r, 2.05r], y ∈ [-0.65r, 0.02r]) is entirely off-canvas
  const m = ctx.getTransform(), cw = ctx.canvas?.width ?? 1e9, ch = ctx.canvas?.height ?? 1e9;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [px, py] of [[0.8, -0.65], [2.05, -0.65], [0.8, 0.02], [2.05, 0.02]]) {
    const X = m.a * px * r + m.c * py * r + m.e, Y = m.b * px * r + m.d * py * r + m.f;
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  if (x1 < 0 || y1 < 0 || x0 > cw || y0 > ch) { ctx.restore(); return; }
  // the "right horn" of the back ring: angles a ∈ (cross(ρ), 2π) of each ellipse lie outside the planet disc
  const RC = 1 + (lw * 0.5) / r;
  const cross = (rho) => TAU - Math.acos(clamp(Math.sqrt(Math.max(0, (RC * RC / (rho * rho) - sB * sB) / (1 - sB * sB)))));
  const limbAng = (rho, a) => Math.atan2(rho * sB * Math.sin(a), rho * Math.cos(a));
  const hornBand = (ro, ri) => { // band ri..ro restricted to the horn (exact path, no clip)
    const ao = cross(ro), ai = cross(ri);
    ctx.beginPath();
    ctx.moveTo(ro * r * Math.cos(ao), ro * r * sB * Math.sin(ao));
    ctx.ellipse(0, 0, ro * r, ro * r * sB, 0, ao, TAU + 0.004);
    ctx.lineTo(ri * r, 0);
    ctx.ellipse(0, 0, ri * r, ri * r * sB, 0, TAU + 0.004, ai, true);
    ctx.arc(0, 0, RC * r, limbAng(ri, ai), limbAng(ro, ao), true);
    ctx.closePath();
  };
  // gaps + the thin slivers just outside the ring's edges were darkened too: make them solid gap-dark
  for (const [ri, ro] of [[1.235, 1.262], [1.656, 1.734], [1.876, 1.924], [1.978, 2.021]]) { hornBand(ro, ri); ctx.fillStyle = '#1c1444'; ctx.fill(); }
  for (const [ri, ro, col] of RING_BANDS_L) { hornBand(ro, ri); ctx.fillStyle = col; ctx.fill(); }
  // soft contact shadow where the ring comes out from behind the limb
  const g = ctx.createRadialGradient(0, 0, r, 0, 0, r * 1.32);
  g.addColorStop(0, rgba('#3b1d63', 0.5)); g.addColorStop(1, rgba('#3b1d63', 0));
  hornBand(1.98, 1.26); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.004); ctx.strokeStyle = rgba('#ffffff', 0.3);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const rr = lerp(1.28, 1.96, (i + 0.5) / 12);
    if ((rr > 1.65 && rr < 1.74) || (rr > 1.87 && rr < 1.93)) continue;
    const a0 = cross(rr);
    ctx.moveTo(rr * r * Math.cos(a0), rr * r * sB * Math.sin(a0)); ctx.ellipse(0, 0, rr * r, rr * r * sB, 0, a0, TAU);
  }
  ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineCap = 'butt';
  for (const [rr, k] of RING_EDGES_L) {
    const a0 = cross(rr);
    ctx.beginPath(); ctx.ellipse(0, 0, rr * r, rr * r * sB, 0, a0, TAU + 0.004);
    ctx.lineWidth = lw * k; ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the dotted arc
const TH_ARC_END = 322 * DEG;
function arcDots(ctx, t, thFrom, reveal, zoom) {
  // walk the curve in ~equal screen steps; dots appear up to `reveal` (0..1 of the remaining arc)
  const steps = 200;
  const pts = [];
  let prev = orbitPos(thFrom), acc = 0;
  const spacing = 30;
  pts.push([prev[0], prev[1], 0]);
  for (let i = 1; i <= steps; i++) {
    const th = lerp(thFrom, TH_ARC_END, i / steps);
    const q = orbitPos(th);
    acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    if (acc >= spacing) { pts.push([q[0], q[1], i / steps]); acc -= spacing; }
    prev = q;
  }
  const b = beatAt(t);
  const n = pts.length;
  const rd = 5.2 / Math.sqrt(zoom);
  // soft glow under the whole revealed arc (one cheap stroke)
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 1; i < n; i++) {
    if (pts[i][2] > reveal) break;
    if (!started) { ctx.moveTo(pts[0][0], pts[0][1]); started = true; }
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.strokeStyle = rgba('#ffd9f0', 0.07 + 0.05 * pulse(t, 4)); ctx.lineWidth = 22; ctx.stroke();
  ctx.restore();
  // dots: marching shimmer travels along the arc (2 waves per beat) = direction of travel
  for (let i = 1; i < n; i++) {
    const [x, y, f] = pts[i];
    if (f > reveal) break;
    const fresh = clamp((reveal - f) / 0.06); // newest dots pop in
    const wave = 0.5 + 0.5 * Math.cos(TAU * (i / 7 - b * 2));
    const a = (0.55 + 0.45 * wave) * fresh;
    const r = rd * (0.8 + 0.35 * wave) * (fresh < 1 ? 1 + 0.8 * (1 - fresh) : 1);
    ctx.fillStyle = rgba('#fff4d6', a);
    circlePath(ctx, x, y, r); ctx.fill();
    if (i % 8 === 4) {
      // little chevrons pointing along the path
      const [px, py] = pts[i - 1];
      const ang = Math.atan2(y - py, x - px);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(3, 0); ctx.lineTo(-9, 9);
      ctx.strokeStyle = rgba('#ffe27a', 0.85 * fresh); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }
}

// a small "X marks the spot" style target sparkle at the planet's limb: where the whip happens
function limbSparkle(ctx, t, reveal) {
  const k = clamp((reveal - 0.55) / 0.2);
  if (k <= 0) return;
  const [x, y] = orbitPos(ORBIT.thp);
  const tw = 0.7 + 0.3 * hat(t);
  glow(ctx, x, y, 90, '#fff6c0', 0.35 * k * tw);
  sparkle(ctx, x, y, 22 * k * tw, '#ffffff', k);
}

// dreamy floating dust motes (screen space, slow, tempo-locked)
function motes(ctx, t) {
  const b = beatAt(t);
  for (let i = 0; i < 26; i++) {
    const x = (hash01(i, 11) * W + b * 9 * (0.5 + hash01(i, 12))) % W;
    const y = (hash01(i, 13) * H - b * 5 * (0.3 + hash01(i, 14)) + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(TAU * (b / 4 + hash01(i, 15)));
    sparkle(ctx, x, y, 3 + 5 * tw * hash01(i, 16), '#ffe9f6', 0.25 + 0.4 * tw);
  }
}

// ---------------------------------------------------------------- camera
export function cam10(t) {
  const u = clamp((t - T_IN) / (T_DROP - T_IN));
  const creep = ease.inOutSine(u);
  const suck = ease.inCubic(clamp((t - T_B3) / (T_DROP - T_B3))); // last-beat anticipation
  const [rx, ry] = orbitPos(rocketTheta10(t));
  // frame drifts from the full composition toward the rocket, then gets yanked onto it on the last beat
  const fx = lerp(lerp(960, 900, creep), rx + 60, 0.75 * suck);
  const fy = lerp(lerp(540, 470, creep), ry + 20, 0.75 * suck);
  return { x: fx, y: fy, zoom: 1 + 0.16 * creep + 1.0 * suck, rot: -0.14 * suck };
}

// ---------------------------------------------------------------- scene
export default {
  id: 's10_gravity',
  start: 55.339,
  end: 57.739,
  transition: { type: 'fade', dur: 0.6 },
  draw(ctx, t) {
    const tt = clamp(t, T_IN - 0.2, T_DROP + 0.1);
    const cam = cam10(tt);
    // background: violet deep space with a soft nebula, gentle parallax with the camera
    ctx.save();
    const bz = 1 + (cam.zoom - 1) * 0.15;
    ctx.translate(W / 2, H / 2); ctx.scale(bz, bz); ctx.translate(-W / 2, -H / 2);
    spaceBg(ctx, { t: tt, seed: 4, hue: 'violet', stars: 300, nebula: 0.55, driftX: (tt - T_IN) * 30 + (cam.x - 960) * 0.2, driftY: (cam.y - 540) * 0.2 });
    ctx.restore();

    // reveal of the dotted arc: four surges on the sung words
    const surge = (w, a, b2) => lerp(a, b2, ease.outCubic(clamp((tt - w) / 0.22)));
    let reveal = 0;
    if (tt >= W_GO - 0.02) reveal = surge(W_GO, 0, 0.26);
    if (tt >= W_WHERE) reveal = surge(W_WHERE, 0.26, 0.45);
    if (tt >= W_THE) reveal = surge(W_THE, 0.45, 0.58);
    if (tt >= W_GRAV) reveal = lerp(0.58, 1, ease.outCubic(clamp((tt - W_GRAV) / 0.5)));

    const th = rocketTheta10(tt);
    const suck = ease.inCubic(clamp((tt - T_B3) / (T_DROP - T_B3)));
    camera(ctx, cam, () => {
      ringedPlanet(ctx, ORBIT.cx, ORBIT.cy, ORBIT.r, { rot: planetRot(tt), tilt: ORBIT.tilt, open: ORBIT.open });
      arcDots(ctx, tt, th + 0.01, reveal, cam.zoom);
      limbSparkle(ctx, tt, reveal);
      // the rocket: engines off, drifting nose-first along the arc with a lazy tumble that straightens
      // out as gravity grabs it
      const [x, y] = orbitPos(th);
      const dir = orbitDir(th);
      const lazy = (0.22 * sway(tt, 8) + 0.1) * (1 - suck);
      const s = 0.155;
      // faint speed streaks behind it once it's really falling
      const fall = clamp((tt - (T_B3 - 0.3)) / 0.9);
      if (fall > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const off = (i - 2) * 16;
          const len = 60 + 160 * fall * (0.6 + 0.4 * hash01(i, 3));
          const px = -Math.sin(dir) * off, py = Math.cos(dir) * off;
          ctx.strokeStyle = rgba('#ffffff', 0.5 * fall);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x + px - Math.cos(dir) * 50, y + py - Math.sin(dir) * 50);
          ctx.lineTo(x + px - Math.cos(dir) * (50 + len), y + py - Math.sin(dir) * (50 + len));
          ctx.stroke();
        }
        ctx.restore();
      }
      glow(ctx, x, y, 120, '#ffe7c2', 0.22);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(dir + Math.PI / 2 + lazy);
      const st = 1 + 0.12 * suck; // stretch along the fall
      ctx.scale(1 / Math.sqrt(st), st);
      drawRocket(ctx, 0, 360 * s, s, { t: tt, flame: 0 });
      ctx.restore();
    });
    if (suck > 0.01) speedLines(ctx, W / 2 + 40, H / 2, tt, { count: 36, inner: 420, outer: 1300, alpha: 0.38 * suck, lw: 5, seed: 7 });
    motes(ctx, tt);
    drawLyric(ctx, t, LYRICS.gravity, 960, 900);
  },
};
