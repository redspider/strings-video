// s17 — Homeward (bars 44–46, 105.74 → 112.94). Bass out, humming continues to 111.7. Calm.
//
//   SHOT 1  EARTHRISE   105.74 → ~108.40  (fades in from s16's sky gallery)
//           The camera tilts down off the constellation gallery: the gallery drifts up and out,
//           a HUGE blue Earth rises from the bottom. The little S.S. Biscuit glides toward home
//           trailing the last of its rainbow string. The limb starts to glow gold (b3 107.54),
//           the sun's rim peeks (b4 107.84), and on the bar-45 downbeat (108.14) the sunrise
//           FLARES over the limb (star rays pop, lens ghosts, bloom) and whites the frame out.
//   SHOT 2  SLEEPY CAPSULE  ~108.40 → 110.54  (cut under the white; the wash decays)
//           Cabin, morning sun streaming through the porthole. Biscuit curled asleep in Juno's
//           lap; "z" bubbles pop from him on the beats (108.74, 109.34, 109.94).
//           Juno yawns a big stretching yawn (arms-up peak 108.74), arms land back round Biscuit
//           on 109.34, she reaches over and flips the HOME switch ON exactly on 109.94 (lamp → green,
//           click burst), then dozes off with a smile.
//   SHOT 3  TURN TAIL-FIRST  110.54 → 112.94
//           Exterior over the big Earth: the rocket coasts nose-first toward home, crew asleep in the
//           portholes (upside down!). Autopilot: an RCS thruster puff on 111.14 starts a slow
//           180° flip; the crew rotate right-way-up; a counter-puff on 112.34 stops it tail-first
//           toward Earth (with a little overshoot wobble). It starts to sink toward the atmosphere.
import { W, H, INK, LW, PAL, FONT, camera, glow, sparkle, circlePath, ink, rrectPath, smokePuff, starfield, streaks } from '../draw.js';
import { clamp, lerp, ease, tween, keyframes, hash01, noise1, rgba, mixColor, TAU, smoothstep, fract } from '../util.js';
import { barTime, beatAt, pulse, sway, kick, SPB } from '../timing.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { drawRocket } from '../props/rockets.js';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../props/cockpit.js';
import { spaceBg, nebula, drawEarth, drawBabyStar, constellation, placeConstellation, CONSTELLATIONS, shootingStar } from '../props/space.js';

// ------------------------------------------------------------------ beat grid
const T0 = barTime(44); // 105.742 scene start (fade from s16 until 106.942)
const T_GOLD = barTime(44, 2); // 107.542 limb begins to glow gold
const T_PEEK = barTime(44, 3); // 107.842 sun's rim peeks over the limb
const T_FLARE = barTime(45); // 108.142 SUNRISE FLARE (bar 45 downbeat)
const T_CUT2 = T_FLARE + 0.26; // ~108.40 cut to the capsule under the white-out
const Z_BEATS = [barTime(45, 1), barTime(45, 2), barTime(45, 3)]; // 108.742 109.342 109.942 z bubbles
const T_YAWN0 = T_CUT2 + 0.06; // yawn starts (anticipation squash)
const T_YAWN_PEAK = barTime(45, 1); // 108.742 arms fully up, mouth wide
const T_YAWN_END = barTime(45, 1) + 0.33; // arms start coming down
const T_ARMS_DOWN = barTime(45, 2); // 109.342 arms land back round Biscuit
const T_REACH = barTime(45, 2) + 0.12; // she turns and reaches for the switch
const T_FLIP = barTime(45, 3); // 109.942 HOME switch flips ON
const T_DOZE = barTime(45, 3) + 0.2; // arm returns, eyes close, happy doze
const T_EXT = barTime(46); // 110.542 cut to exterior
const T_PUFF1 = barTime(46, 1); // 111.142 thruster puff: flip begins
const T_PUFF2 = barTime(46, 3); // 112.342 counter-puff: flip stops tail-first
const Z3_BEATS = [barTime(46), barTime(46, 2)]; // 110.542, 111.742 — sleepy z's out of the portholes (off the puff beats)
const T_WAKE = barTime(46, 3.5); // 112.642 (the "and" of b4): it starts to fall, the heat builds — the crew jolt awake
const T_END = barTime(47); // 112.942

// Hit convention: an impact shows on the frame NEAREST its beat (≤ half a 30 fps frame early).
const NEAR = 1 / 60;

// ------------------------------------------------------------------ shared little helpers
const kHit = (t, t0, d = 7) => (t >= t0 ? Math.exp(-d * (t - t0)) : 0);

// Sunrise flare: sun glow + star rays + anamorphic streak + lens ghosts.  amt 0..1 overall, rays 0..1.
function sunFlare(ctx, sx, sy, amt, rays, t, { ghosts = 1, scale = 1, rot = 0 } = {}) {
  if (amt <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const s = scale;
  glow(ctx, sx, sy, 520 * s * (0.5 + 0.5 * amt), '#ffcf7a', 0.55 * amt);
  glow(ctx, sx, sy, 190 * s * (0.6 + 0.4 * amt), '#fff4d6', 0.9 * amt);
  // star rays: long thin spikes, slowly rotating (tempo-locked: 1/64 turn per beat)
  if (rays > 0) {
    const n = 12;
    const base = rot + beatAt(t) * (TAU / 64);
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * TAU + (hash01(i, 5) - 0.5) * 0.12;
      const L = (i % 2 ? 360 : 720) * s * rays * (0.75 + 0.5 * hash01(i, 7));
      const w = (i % 2 ? 7 : 12) * s * (0.6 + 0.4 * rays);
      const ca = Math.cos(a), sa = Math.sin(a);
      const g = ctx.createLinearGradient(sx, sy, sx + ca * L, sy + sa * L);
      g.addColorStop(0, rgba('#fff6dc', 0.85 * amt));
      g.addColorStop(0.35, rgba('#ffd98a', 0.35 * amt));
      g.addColorStop(1, rgba('#ffb45a', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx - sa * w, sy + ca * w);
      ctx.lineTo(sx + ca * L, sy + sa * L);
      ctx.lineTo(sx + sa * w, sy - ca * w);
      ctx.closePath(); ctx.fill();
    }
    // anamorphic streak
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(1, 0.035);
    const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 1100 * s * rays);
    g2.addColorStop(0, rgba('#fff2d0', 0.75 * amt));
    g2.addColorStop(0.3, rgba('#ffc26b', 0.25 * amt));
    g2.addColorStop(1, rgba('#ff9a3d', 0));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(0, 0, 1100 * s * rays, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // lens ghosts along the line sun → frame centre
  if (ghosts > 0 && rays > 0) {
    const dx = W / 2 - sx, dy = H / 2 - sy;
    const G = [[0.55, 26, '#ffd98a', 0.16], [0.9, 60, '#9fe3ff', 0.09], [1.25, 18, '#ffffff', 0.22], [1.55, 110, '#ff9ec7', 0.07], [1.9, 40, '#b8ffcd', 0.1]];
    for (const [k, r, c, a] of G) {
      const gx = sx + dx * k, gy = sy + dy * k;
      const A = a * amt * rays * ghosts;
      ctx.fillStyle = rgba(c, A);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const aa = (i / 6) * TAU + 0.3; const px = gx + Math.cos(aa) * r * s, py = gy + Math.sin(aa) * r * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(c, A * 1.4); ctx.lineWidth = 2; ctx.stroke();
    }
  }
  ctx.restore();
}

// Golden sunrise light spreading along the limb of a planet (centre cx,cy radius r) around angle ang.
function limbGold(ctx, cx, cy, r, ang, amt, spread = 0.5) {
  if (amt <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const layers = [[40, '#ff7a2a', 0.3], [20, '#ffb45a', 0.5], [9, '#ffe6a6', 0.85], [3.5, '#fffbe6', 1]];
  for (const [w, c, a] of layers) {
    const sp = spread * (0.6 + 0.4 * amt) * (w > 20 ? 1.3 : 1);
    const n = 3;
    for (let i = 0; i < n; i++) {
      // taper: inner sub-arcs brighter
      const k = (i + 1) / n;
      ctx.beginPath();
      ctx.arc(cx, cy, r + w * 0.25, ang - sp * k, ang + sp * k);
      ctx.strokeStyle = rgba(c, (a * amt) / n * 1.6);
      ctx.lineWidth = w;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// A little "z" bubble (translucent, inked, with a highlight and a Z inside).
function zBubble(ctx, x, y, r, a, rot = 0) {
  if (a <= 0 || r <= 0.5) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.translate(x, y); ctx.rotate(rot);
  circlePath(ctx, 0, 0, r);
  ink(ctx, 'rgba(226,240,255,0.78)', Math.max(2, r * 0.13));
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.68, Math.PI * 1.1, Math.PI * 1.42); ctx.stroke();
  ctx.font = `bold ${Math.round(r * 1.25)}px ${FONT.title}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = PAL.navy;
  ctx.fillText('z', r * 0.04, r * 0.02);
  ctx.restore();
}
// z bubbles popping on the given beats from a source point, rising and drifting (dir = -1 left / 1 right)
function zStream(ctx, t, beats, src, { dir = -1, size = 1, life = 1.7, rise = 250, kill = Infinity } = {}) {
  beats.forEach((bt, i) => {
    // the pop starts ~3 frames early so the bubble is at its outBack overshoot ON the beat frame
    const t0 = bt - NEAR - 0.08;
    const u = (t - t0) / life;
    if (u <= 0 || u >= 1) return;
    const pop = ease.outBack(clamp((t - t0) / 0.14), 2.6);
    // `kill`: the bubble bursts (swells + vanishes in 0.1 s) when the dreamer wakes up
    const burst = clamp((t - kill) / 0.1);
    if (burst >= 1) return;
    const r = (19 + 5 * i) * size * pop * (1 + 0.45 * u) * (1 + 0.5 * burst);
    const x = src[0] + dir * (60 * u + 110 * ease.outSine(u)) * size + 14 * sway(t + i * 0.3, 2) * u * size;
    const y = src[1] - rise * size * ease.outSine(u) - 10 * size;
    const a = (1 - smoothstep(0.7, 1, u)) * (1 - burst);
    zBubble(ctx, x, y, r, a, 0.25 * sway(t + i, 4) * dir);
  });
}

// HOME switch box (local copy of the dash toggle, clamped to the cabin handrail).
// (px, py) = lever pivot; k = scale; knob = [x, y] world pos of the lever knob; on 0..1 (lamp/label)
function homeSwitch(ctx, px, py, k, knob, on, t, click) {
  const lw = LW * 0.9;
  ctx.save();
  // bracket to the rail
  ctx.fillStyle = '#7d8aa3';
  rrectPath(ctx, px - 10 * k, py + 40 * k, 20 * k, 26 * k, 4 * k); ink(ctx, '#a3adc0', lw * 0.6);
  // plate
  const x0 = px - 56 * k, y0 = py - 46 * k, w = 112 * k, h = 96 * k;
  rrectPath(ctx, x0, y0, w, h, 14 * k); ctx.fillStyle = '#cbb690'; ctx.fill();
  rrectPath(ctx, x0, y0, w - 8 * k, h - 8 * k, 12 * k); ctx.fillStyle = '#f1e3c6'; ctx.fill();
  rrectPath(ctx, x0, y0, w, h, 14 * k); ink(ctx, null, lw);
  const lit = on > 0.5;
  const txtCol = lit ? PAL.red : '#9a5a52';
  if (lit && click > 0) glow(ctx, px + 10 * k, py + 30 * k, 90 * k, '#ffd9a0', 0.6 * click);
  ctx.font = `bold ${Math.round(22 * k)}px ${FONT.round}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = txtCol; ctx.fillText('HOME', px + 12 * k, py + 30 * k);
  // tiny house icon
  ctx.beginPath();
  ctx.moveTo(px - 45 * k, py + 32 * k); ctx.lineTo(px - 36 * k, py + 20 * k); ctx.lineTo(px - 27 * k, py + 32 * k);
  ctx.lineTo(px - 27 * k, py + 40 * k); ctx.lineTo(px - 45 * k, py + 40 * k); ctx.closePath();
  ink(ctx, txtCol, 2.5);
  // lamp
  const lx = px + 42 * k, ly = py - 6 * k;
  if (lit) { glow(ctx, lx, ly, 60 * k * (1 + click), '#5ef08a', 0.55); }
  circlePath(ctx, lx, ly, 9 * k); ink(ctx, lit ? '#5ef08a' : '#8c3a36', lw * 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; circlePath(ctx, lx - 3 * k, ly - 3 * k, 3 * k); ctx.fill();
  // lever slot + lever to the knob
  rrectPath(ctx, px - 15 * k, py - 8 * k, 30 * k, 17 * k, 5 * k); ink(ctx, '#a3adc0', lw * 0.5);
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(knob[0], knob[1]);
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 11 * k; ctx.stroke();
  ctx.strokeStyle = PAL.steel; ctx.lineWidth = 5.5 * k; ctx.stroke();
  circlePath(ctx, knob[0], knob[1], 9 * k); ink(ctx, PAL.red, lw * 0.5);
  ctx.restore();
}

// ------------------------------------------------------------------ SHOT 1: earthrise
// It OPENS ON s16's LAST FRAME: an exact replica of s16_star_strings.js's end state — the same sky
// gallery (PICS layout, flying-order segments so the rainbow hues match, the pictures still dancing
// on the beat, the completion flare + snap bursts dying away), the baby star (r 80) at HOME, s16's
// camera (keys + lean + roll), magenta sky, nebula and last shooting star, and the rocket finishing
// its loop round the star and shooting off down-right. So the engine's 1.2 s crossfade is invisible;
// only once s16 has (almost) faded out (b2.5, 106.64) does MY camera tilt down off the gallery: the
// sky deepens to blue and a HUGE Earth rises from below.
//   !! If s16's PICS / CAM / rocketPos / star change, mirror them here (search "s16:").
const T_HOME16 = barTime(43, 3); // 105.142 s16: rocket picture complete, star lands at HOME
const T44_16 = barTime(44);
const HOME16 = [0, 30];
// s16: PICS (paths = flying order; keys → the beat each stroke lands on)
const G16 = [
  { name: 'heart', cx: -700, cy: -290, size: 300, hue: 330, bar: 40,
    path: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2], keys: 4 },
  { name: 'dogFace', cx: 700, cy: -320, size: 330, hue: 20, bar: 41,
    path: [9, 0, 1, 7, 8, 2, 1, 2, 3, 4, 5, 4, 13, 11, 12, 5, 6, 10, 6, 0, 9, 10], keys: 4 },
  { name: 'girl', cx: -660, cy: 380, size: 330, hue: 90, bar: 42,
    path: [2, 3, 4, 5, 6, 7, 0, 1, 8, 14, 8, 9, 10, 16, 10, 11, 17, 11, 12, 13, 15, 13, 2, 3, 4, 23, 24, 25, 26, 27, 23,
      4, 5, 6, 7, 18, 19, 20, 21, 22, 18, 30, 31, 32], keys: 4 },
  { name: 'rocket', cx: 700, cy: 370, size: 360, hue: 190, bar: 43,
    path: [7, 6, 5, 4, 5, 10, 4, 3, 2, 1, 0, 8, 7, 8, 9, 1], keys: 3 },
].map((P) => {
  const shape = CONSTELLATIONS[P.name];
  const { pts } = placeConstellation(shape, P.cx, P.cy, P.size);
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const segSet = new Set(shape.segments.map(([a, b]) => key(a, b)));
  const drawn = new Set(), segs = [];
  for (let i = 1; i < P.path.length; i++) {
    const k = key(P.path[i - 1], P.path[i]);
    if (segSet.has(k) && !drawn.has(k)) { drawn.add(k); segs.push([P.path[i - 1], P.path[i]]); }
  }
  return { ...P, pts, segs, first: P.path[0], last: P.path[P.path.length - 1], tEnd: barTime(P.bar, P.keys) };
});
const R16_END = G16[3].pts[1];
const T_TILT0 = barTime(44, 1.5); // 106.642 my tilt starts once s16 is ~all faded (its alpha < 10 %, eased in)
const T_TILT1 = T_FLARE - 0.12;

// s16: alivePts — once complete, each picture dances on the beat
function alive16(P, t) {
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
    const k = 1 + a * (0.1 * pulse(t, 6) + 0.035 * pulse(t - SPB * 0.25, 9)); // lub-dub
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

// s16: snapBurst (ring + rays + sparkles), used for the two bursts still dying away at 105.74
function snap16(ctx, t, t0, x, y, R, hue, seed) {
  const u = (t - t0 + 0.017) / 0.9;
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
  ctx.lineWidth *= 0.6; ctx.beginPath(); ctx.arc(x, y, R * 1.6 * ease.outCubic(clamp(u * 1.2)), 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + hash01(seed, 3) * 0.6;
    const r0 = R * (0.25 + 0.55 * e), r1 = r0 + R * 0.35 * (1 - u);
    ctx.lineWidth = R * 0.04 * (1 - u) + 1;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + hash01(i, seed) * 0.8 + 0.3;
    const d = R * (0.5 + 0.9 * hash01(i, seed + 1)) * e;
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.14 * (1 - u) * (0.6 + 0.8 * hash01(i, seed + 2)),
      i % 2 ? '#ffffff' : `hsl(${(hue + i * 30) % 360},100%,85%)`, 1 - u);
  }
}

// s16's rocket after its route (loop round the star, then away down-right) — identical maths
function rocket16(t) {
  const d = Math.max(0, t - T_HOME16);
  const R = 170;
  const a0 = Math.atan2(R16_END[1] - HOME16[1], R16_END[0] - HOME16[0]);
  const a = a0 - TAU * 1.05 * ease.inOutSine(clamp(d / 1.0));
  const rr = lerp(Math.hypot(R16_END[0] - HOME16[0], R16_END[1] - HOME16[1]), R, ease.outCubic(clamp(d / 0.5)));
  let x = HOME16[0] + Math.cos(a) * rr, y = HOME16[1] + Math.sin(a) * rr;
  if (d > 1.0) { const e = ease.inQuad(clamp((d - 1.0) / 1.2)); x += e * 1400; y += e * 700; }
  if (d > 2.2) { x += (d - 2.2) * 2333; y += (d - 2.2) * 1167; } // keeps going (off frame)
  return [x, y];
}
function cam1(t) {
  // s16: camAt's final keys (+ its lean toward the rocket and its roll, both dying out by ~106.0) …
  const z = Math.exp(keyframes(t, [[T_HOME16, Math.log(0.78)], [T_HOME16 + 0.9, Math.log(0.68), ease.outCubic], [T44_16 + 1.6, Math.log(0.65), ease.inOutSine]]));
  let x = keyframes(t, [[T_HOME16, 80], [T_HOME16 + 0.9, 0, ease.outCubic]]);
  let y = keyframes(t, [[T_HOME16, 90], [T_HOME16 + 0.9, 76, ease.outCubic]]);
  const rot = keyframes(t, [[T_HOME16, -0.03], [T_HOME16 + 0.9, 0, ease.outCubic]]);
  const f = 0.22 * (1 - clamp((t - T_HOME16) / 0.8));
  if (f > 0) {
    let rx = 0, ry = 0;
    for (const d of [-0.24, -0.12, 0, 0.12, 0.24]) { const p = rocket16(t + d); rx += p[0] / 5; ry += p[1] / 5; }
    x += (rx - x) * f; y += (ry - y) * f;
  }
  // … plus my tilt down toward the Earth
  const tilt = ease.inOutSine(clamp((t - T_TILT0) / (T_TILT1 - T_TILT0)));
  return { x, y: y + 1650 * tilt, zoom: z, rot, tilt };
}
const E1 = { x: 1010, r: 1500, y0: 3000, y1: 2150 };
const SUN_ANG = -Math.PI / 2 - 0.36; // where on the limb the sun rises
const earthY1 = (t, tilt) => lerp(E1.y0, E1.y1, tilt) - 25 * clamp((t - T_FLARE) / 1.5);

// s16's gallery (pictures + linking threads + completion flare + the last snap bursts)
function drawGallery(ctx, t, cam) {
  const zc = Math.pow(1 / cam.zoom, 0.55);
  const lw = 6 * zc, starSize = 13 * zc;
  const onScreen = (wy) => (wy - cam.y) * cam.zoom + H / 2 > -60; // below the top edge?
  const live = G16.map((P) => (onScreen(P.cy + P.size * 1.4) ? alive16(P, t) : null));
  G16.forEach((P, i) => {
    if (!live[i]) return;
    if (i > 0) {
      const prev = G16[i - 1];
      constellation(ctx, [(live[i - 1] || prev.pts)[prev.last], live[i][P.first]], 1, {
        t, rainbow: true, hue: P.hue - 60, lw: lw * 0.55, glow: 0.8, starSize: 0.01, alpha: 0.8 * 0.45, linear: true, dust: 1,
      });
    }
    const flare = t >= P.tEnd ? Math.exp(-3.5 * (t - P.tEnd)) : 0;
    const breathe = 0.12 * pulse(t, 4);
    if (flare > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, P.cx, P.cy, P.size * 1.4, `hsl(${P.hue},100%,70%)`, 0.34 * flare);
      ctx.restore();
    }
    constellation(ctx, live[i], 1, {
      t, segments: P.segs, rainbow: true, hue: P.hue, lw: lw * (1 + 0.5 * flare + breathe), glow: 1.15 + 0.6 * flare + breathe,
      starSize: starSize * (1 + 0.3 * flare), linear: true, alpha: 1,
    });
  });
  // s16: the rocket picture's last-key burst (KEYS index 14) — still dying away at the cut
  snap16(ctx, t, T_HOME16, R16_END[0], R16_END[1], 260 * zc, 190 + 40 * 14, 7 + 14);
}

// s16: the baby star at HOME (r 80, landed + winked on 105.14). Once s16 has faded it watches the rocket go.
function drawStar16(ctx, t, cam) {
  if ((HOME16[1] + 260 - cam.y) * cam.zoom + H / 2 < -60) return;
  const zc = Math.pow(1 / cam.zoom, 0.55);
  const land = t - T_HOME16;
  const squash = 1 - 0.22 * Math.exp(-6 * land) * Math.cos(land * 22);
  const wink = keyframes(t, [[T_HOME16 + 0.12, 0], [T_HOME16 + 0.24, 1, ease.outBack], [T_HOME16 + 0.75, 1], [T_HOME16 + 0.9, 0]]);
  const [rx, ry] = rocket16(t);
  const dx = rx - HOME16[0], dy = ry - HOME16[1], dl = Math.hypot(dx, dy) || 1;
  const k = smoothstep(T_TILT0 + 0.05, T_TILT0 + 0.45, t);
  const look = [lerp(0.1, clamp(dx / dl), k), lerp(0.1, clamp(dy / dl + 0.25), k)];
  drawBabyStar(ctx, HOME16[0], HOME16[1], 80, { t, expr: 'happy', look, wink, squash, glow: 1.5 + 0.4 * pulse(t, 3), rays: 0.9 });
  snap16(ctx, t, T_HOME16, HOME16[0], HOME16[1], 260 * zc, 50, 99);
}

function drawRocket16(ctx, t, cam) {
  const zc = Math.pow(1 / cam.zoom, 0.55);
  const p = rocket16(t), pa = rocket16(t - 0.035), pb = rocket16(t + 0.035);
  let dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  if (Math.hypot(dx, dy) < 1e-3) { dx = 1; dy = -0.3; }
  const head = Math.atan2(dy, dx), speed = Math.hypot(dx, dy) / 0.07;
  const s = 0.2 * Math.min(1.3, zc * 0.95);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 24; i++) {
    const q0 = rocket16(t - i * 0.03), q1 = rocket16(t - (i + 1) * 0.03);
    ctx.strokeStyle = `hsla(${(i * 15 + beatAt(t) * 40) % 360},100%,70%,${0.5 * (1 - i / 24)})`;
    ctx.lineWidth = 16 * zc * (1 - i / 30);
    ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 8; i++) {
    const back = (i + fract(t * 6)) * 0.035;
    const q = rocket16(t - back), tw = 1 - i / 8;
    sparkle(ctx, q[0] + noise1(i * 3 + t * 5, 2) * 16 * zc, q[1] + noise1(i * 3 + t * 5, 4) * 16 * zc, 9 * zc * tw, '#ffffff', 0.8 * tw);
  }
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(head + Math.PI / 2);
  const st = 1 + clamp(speed / 9000, 0, 0.18) + 0.05 * kick(t);
  ctx.scale(1 / Math.sqrt(st), st);
  drawRocket(ctx, 0, 14 * s, s, { t, flame: 0.75 + 0.25 * kick(t) });
  ctx.restore();
}

function drawShot1(ctx, t) {
  const cam = cam1(t);
  const tilt = cam.tilt;
  // sky: s16's magenta space (same seed/stars/drift) deepening to blue as we look down toward Earth
  spaceBg(ctx, { t, hue: 'magenta', stars: 320, driftX: cam.x * 0.25, driftY: cam.y * 0.25, nebula: 0, band: 0.7, seed: 6 });
  // deep blue sky rising up from the Earth as we tilt down (one gradient instead of a second background)
  const blue = smoothstep(0.0, 0.8, tilt);
  if (blue > 0) {
    const top = lerp(H + 100, -500, blue);
    const g = ctx.createLinearGradient(0, top, 0, top + 1100);
    g.addColorStop(0, 'rgba(8,18,60,0)');
    g.addColorStop(0.45, rgba('#0b1d52', 0.62 * blue));
    g.addColorStop(1, rgba('#1d4a9a', 0.8 * blue));
    ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, top), W, H);
    // a sprinkle of crisp stars over the deepened sky (twinkle on the hats)
    starfield(ctx, { t, seed: 17, count: 120, y0: -cam.y * 0.25 % 200 - 200, h: H + 200, maxR: 2.4, alpha: 0.85 * blue, big: 0.08 });
  }
  // s16's far nebula (same params; it parallaxes up with my tilt and fades as the sky turns blue)
  const nz = Math.pow(cam.zoom, 0.3);
  const nebA = 0.5 * (1 - smoothstep(0.1, 0.6, tilt));
  if (nebA > 0.01) nebula(ctx, { t, x: W * 0.52 - cam.x * 0.16 * nz, y: H * 0.5 - cam.y * 0.16 * nz, scale: 1.12 * nz,
    colors: ['#ff7eb6', '#2ec4b6', '#b388ff', '#ffc2e0', '#4fd1e0'], seed: 9, alpha: nebA });
  // s16's last shooting star (bar 43 b4) finishing its streak
  {
    const sd = 43 * 4 + 3, u = (t - (barTime(43, 3) - 0.05)) / 0.75;
    if (u > 0 && u < 1) {
      const x0 = W * (0.1 + 0.8 * hash01(sd, 41)), y0 = H * (0.05 + 0.35 * hash01(sd, 42));
      const ang = (hash01(sd, 43) < 0.5 ? 0.35 : Math.PI - 0.35) + (hash01(sd, 44) - 0.5) * 0.3;
      shootingStar(ctx, x0, y0, ang, u, { dist: 520, len: 260, size: 6, alpha: 0.75, tint: '#bff5ef' });
    }
  }
  // the gallery + rocket + baby star, in s16's world coordinates (s16's draw order)
  camera(ctx, cam, () => {
    if (tilt < 0.985) drawGallery(ctx, t, cam);
    if (t < T_HOME16 + 2.6) drawRocket16(ctx, t, cam);
    if (tilt < 0.985) drawStar16(ctx, t, cam);
  });

  const ey = earthY1(t, tilt);
  const sunX = E1.x + Math.cos(SUN_ANG) * E1.r, sunY = ey + Math.sin(SUN_ANG) * E1.r;
  // sun disc behind the Earth: rises out from behind the limb
  const rise = smoothstep(T_PEEK - 0.3, T_FLARE + 0.1, t);
  const out = lerp(-70, 26, rise);
  const scx = E1.x + Math.cos(SUN_ANG) * (E1.r + out), scy = ey + Math.sin(SUN_ANG) * (E1.r + out);
  if (rise > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, scx, scy, 230, '#ffd27a', 0.7 * rise);
    ctx.restore();
    circlePath(ctx, scx, scy, 62); ctx.fillStyle = '#fffbe6'; ctx.fill();
  }
  if (ey - E1.r < H + 60) {
    drawEarth(ctx, E1.x, ey, E1.r, { t, rot: 0.9 + (t - T0) * 0.02, pitch: -0.85, tilt: -0.2, glow: 1 });
    // golden limb light, growing from b3
    limbGold(ctx, E1.x, ey, E1.r, SUN_ANG, smoothstep(T_GOLD - 0.3, T_FLARE, t), 0.55);
  }
  const gold = smoothstep(T_GOLD - 0.3, T_FLARE, t);

  // flare: sun swells from the peek, rays POP on the downbeat
  const pre = smoothstep(T_PEEK - 0.2, T_FLARE, t) * 0.7;
  // impact frame = the 30 fps frame nearest the downbeat: rays slam in overshooting (1.3×) and settle
  const tPop = T_FLARE - NEAR;
  const pop = t >= tPop ? 1 + 0.3 * Math.exp(-9 * (t - tPop)) : 0;
  const amt = clamp(Math.max(gold * 0.35, pre) + 0.5 * clamp(pop));
  const rays = Math.max(pre * 0.4, pop * 1.05);
  sunFlare(ctx, lerp(sunX, scx, 0.8), lerp(sunY, scy, 0.8), amt, rays, t, { ghosts: 1 });
  // bloom → white-out into the capsule (additive: the frame burns up to warm white)
  const bl = t < T_FLARE - 0.034 ? 0 : ease.inQuad(clamp((t - T_FLARE + 0.034) / (T_CUT2 - T_FLARE + 0.034)));
  if (bl > 0) {
    const bx = lerp(sunX, scx, 0.8), by = lerp(sunY, scy, 0.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // expanding bloom (kept ≤ 1800 px: a frame-filling radial gradient costs ~5 ms; the wash below does the rest)
    glow(ctx, bx, by, 600 + 1200 * bl, '#fff0d0', 0.55 + 0.45 * bl);
    // warm additive burn (peachy midtones instead of a grey veil), ending in pure warm white
    ctx.fillStyle = rgba(mixColor('#ff9a50', '#fff4e0', bl), bl);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ SHOT 2: sleepy capsule
const CAB = COCKPIT_SEATS.cabin;
const GJ = { x: CAB.girl.x, y: CAB.girl.y, s: CAB.girl.s };
const DOG = { x: CAB.lap.x, y: CAB.lap.y, s: CAB.girl.s };
const ARM = {
  hold: { a: 0.3, b: 1.25, hand: 'fist' },
  holdR: { a: 0.3, b: 1.2, hand: 'open' },
  up: { a: 2.25, b: 0.3, hand: 'fist' }, // big V stretch, fists clear of the head

  reach0: { a: 1.62, b: -0.55, hand: 'open' }, // hand on the knob, lever OFF (left)
  reach1: { a: 1.9, b: -0.5, hand: 'open' }, // pushed: lever ON (right)
};
// where Juno's right hand lands for the two switch poses (the switch is built around them)
const HAND0 = girlAnchors(GJ.x, GJ.y, GJ.s, { stance: 'sit', suit: 'space', facing: 1, armR: ARM.reach0 }).handR;
const HAND1 = girlAnchors(GJ.x, GJ.y, GJ.s, { stance: 'sit', suit: 'space', facing: 1, armR: ARM.reach1 }).handR;
const SW_K = 0.72;
const SW_PIV = [(HAND0[0] + HAND1[0]) / 2, Math.max(HAND0[1], HAND1[1]) + 20];
const knobRest = (v) => { const a = lerp(-0.72, 0.72, ease.outBack(clamp(v))); return [SW_PIV[0] + Math.sin(a) * 34 * SW_K, SW_PIV[1] - Math.cos(a) * 34 * SW_K]; };

const mixArm = (A, B, u) => ({ a: lerp(A.a, B.a, u), b: lerp(A.b, B.b, u), hand: u < 0.5 ? A.hand : B.hand });

function girlPose2(t) {
  // yawn/stretch 0..1 (up) and back
  const up = t < T_YAWN_PEAK ? ease.inOutSine(clamp((t - T_YAWN0 - 0.08) / (T_YAWN_PEAK - T_YAWN0 - 0.08)))
    : 1 - ease.inOutCubic(clamp((t - T_YAWN_END) / (T_ARMS_DOWN - T_YAWN_END)));
  const antic = kHit(t, T_YAWN0, 1) * (t < T_YAWN0 + 0.12 ? Math.sin(Math.PI * (t - T_YAWN0) / 0.12) : 0); // tiny squash before the stretch
  // reach for the switch
  const reach = t < T_FLIP ? ease.inOutCubic(clamp((t - T_REACH) / (T_FLIP - 0.16 - T_REACH))) : 1 - ease.inOutCubic(clamp((t - T_DOZE) / 0.3));
  // push: from knob-off to knob-on, landing ON the beat (a frame early)
  // wind-up (hand eases back a touch), then the push lands the lever ON the beat
  const windup = Math.sin(Math.PI * clamp((t - (T_FLIP - 0.24)) / 0.18));
  const push = ease.inQuad(clamp((t - (T_FLIP - NEAR - 0.06)) / 0.06)) - 0.35 * windup * (t < T_FLIP - 0.07 ? 1 : 0);
  const land = kHit(t, T_ARMS_DOWN, 9); // arms land on Biscuit: tiny settle
  let armL = mixArm(ARM.hold, ARM.up, up);
  let armR = mixArm(ARM.holdR, ARM.up, up);
  if (reach > 0) armR = mixArm(armR, mixArm(ARM.reach0, ARM.reach1, push), reach);
  const facing = lerp(0.35, 1, ease.inOutSine(clamp((t - T_REACH + 0.1) / 0.4))) - 0.55 * ease.inOutSine(clamp((t - T_DOZE) / 0.5));
  // face: sleepy → yawn (eyes shut, O mouth) → sleepy peek at the switch → content doze
  const yawnMouth = t < T_YAWN_PEAK ? ease.outCubic(clamp((t - T_YAWN0) / (T_YAWN_PEAK - T_YAWN0))) : 1 - ease.inCubic(clamp((t - T_YAWN_END - 0.1) / 0.3));
  const doze = smoothstep(T_DOZE, T_DOZE + 0.3, t);
  const expr = t > T_FLIP - NEAR ? 'happy' : 'sleepy';
  // (an explicit blink overrides the 'sleepy' lids, so keep a heavy-lidded floor all shot)
  let blink = Math.max(0.48, clamp(yawnMouth * 1.4 - 0.2), doze);
  // a drowsy half-lidded peek at the switch (she's still sleepy), a satisfied little blink-open on the click
  if (t > T_REACH && t < T_FLIP - NEAR) blink = Math.min(blink, 0.42);
  else if (t >= T_FLIP - NEAR) blink = lerp(0.4, 1, doze); // content heavy lids on the click … then asleep
  // look at the switch, then back down at Biscuit as she dozes off
  const lookBack = smoothstep(T_DOZE - 0.05, T_DOZE + 0.2, t);
  const look = t > T_REACH ? [lerp(0.8, -0.35, lookBack), lerp(-0.1, 0.6, lookBack)] : [0, 0.3];
  return {
    t, stance: 'sit', suit: 'space', helmet: 0, expr, facing,
    armL, armR,
    mouth: yawnMouth > 0.02 ? yawnMouth : undefined,
    blink,
    headTilt: -0.14 * yawnMouth + 0.12 * doze,
    squash: 1 + 0.05 * up - 0.04 * antic + 0.03 * land,
    look,
  };
}

function cabinWindow(t) {
  return (ctx, cx, cy, r) => {
    ctx.fillStyle = '#0a0f2e'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    const er = r * 3.2, ex = cx + r * 0.4, ey = cy + r * 0.55 + er;
    drawEarth(ctx, ex, ey, er, { t, rot: 1.4 + t * 0.02, pitch: -0.85, glow: 1, lw: 3 });
    const ang = -Math.PI / 2 - 0.28;
    limbGold(ctx, ex, ey, er, ang, 1, 0.5);
    const sx = ex + Math.cos(ang) * (er + 14), sy = ey + Math.sin(ang) * (er + 14);
    circlePath(ctx, sx, sy, 16); ctx.fillStyle = '#fffbe6'; ctx.fill();
    sunFlare(ctx, sx, sy, 0.55, 0.3, t, { ghosts: 0, scale: 0.28 });
  };
}

// Morning sun shaft from the porthole down-left across the pair.
function sunbeam(ctx, t, amt) {
  if (amt <= 0) return;
  const { x: wx, y: wy, r } = CAB.window;
  const dir = [-0.78, 0.63];
  const nx = -dir[1], ny = dir[0];
  const L = 1100;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(wx, wy, wx + dir[0] * L, wy + dir[1] * L);
  g.addColorStop(0, rgba('#ffd48a', 0.2 * amt));
  g.addColorStop(0.5, rgba('#ffc070', 0.1 * amt));
  g.addColorStop(1, rgba('#ffb060', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(wx + nx * r * 0.9, wy + ny * r * 0.9);
  ctx.lineTo(wx + nx * r * 1.5 + dir[0] * L, wy + ny * r * 1.5 + dir[1] * L);
  ctx.lineTo(wx - nx * r * 1.2 + dir[0] * L, wy - ny * r * 1.2 + dir[1] * L);
  ctx.lineTo(wx - nx * r * 0.9, wy - ny * r * 0.9);
  ctx.closePath(); ctx.fill();
  // floating dust motes in the beam (tempo-locked drift)
  for (let i = 0; i < 18; i++) {
    const d = (hash01(i, 3) * 0.8 + 0.1) * L * 0.8;
    const w = (hash01(i, 4) - 0.5) * 2 * r * 1.1;
    const b = beatAt(t);
    const px = wx + dir[0] * d + nx * w + 14 * Math.sin(b * 0.5 + i);
    const py = wy + dir[1] * d + ny * w - 10 * Math.sin(b * 0.25 + i * 2) ;
    sparkle(ctx, px, py, 3 + 3 * hash01(i, 6), '#fff2c4', amt * (0.35 + 0.35 * Math.sin(b * Math.PI / 2 + i)));
  }
  ctx.restore();
}

function drawShot2(ctx, t) {
  const zoom = tween(t, T_CUT2, T_EXT, 1.62, 1.78, ease.inOutSine);
  const cam = { x: 950, y: 585, zoom };
  const o = { t, view: 'cabin', lights: 0.35, window: cabinWindow(t) };
  // lever: rest positions + hand contact while pushing
  const v = clamp((t - (T_FLIP - NEAR - 0.06)) / 0.06);
  const pose = girlPose2(t);
  const hand = girlAnchors(GJ.x, GJ.y, GJ.s, pose).handR;
  const contact = smoothstep(T_FLIP - 0.24, T_FLIP - 0.12, t) * (1 - smoothstep(T_DOZE - 0.05, T_DOZE + 0.1, t));
  const kr = knobRest(v);
  const knob = [lerp(kr[0], hand[0], contact * 0.85), lerp(kr[1], hand[1], contact * 0.85)];
  const click = kHit(t, T_FLIP - NEAR, 5);
  camera(ctx, cam, () => {
    drawCockpit(ctx, o);
    sunbeam(ctx, t, 1);
    homeSwitch(ctx, SW_PIV[0], SW_PIV[1], SW_K, knob, t >= T_FLIP - NEAR ? 1 : 0, t, click);
    drawGirl(ctx, GJ.x, GJ.y, GJ.s, pose);
    // he snuggles in (squash + settle) as her arms land round him on 109.34
    const snug = t >= T_ARMS_DOWN - NEAR ? 0.09 * Math.exp(-5 * (t - T_ARMS_DOWN)) * Math.cos(TAU * 2.2 * (t - T_ARMS_DOWN)) : 0;
    drawDog(ctx, DOG.x, DOG.y, DOG.s, { t, stance: 'lie', suit: 'space', facing: -1, expr: 'sleepy', wag: 0.3, squash: 1 - snug });
    // switch click burst
    if (click > 0.02) {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.5;
        const r0 = 30 + 40 * (1 - click), r1 = r0 + 22 * click;
        ctx.save(); ctx.strokeStyle = rgba(PAL.yellow, click); ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(SW_PIV[0] + Math.cos(a) * r0, SW_PIV[1] - 20 + Math.sin(a) * r0);
        ctx.lineTo(SW_PIV[0] + Math.cos(a) * r1, SW_PIV[1] - 20 + Math.sin(a) * r1); ctx.stroke(); ctx.restore();
      }
    }
    const da = dogAnchors(DOG.x, DOG.y, DOG.s, { stance: 'lie', facing: -1 });
    zStream(ctx, t, Z_BEATS, [da.head[0] - 88, da.head[1] - 34], { dir: -1, size: 1, rise: 210 });
    drawCockpitFront(ctx, o);
  });
  // warm morning wash + fade in from the white-out
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba('#ffb060', 0.06);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const wash = 1 - ease.outCubic(clamp((t - T_CUT2) / 0.45));
  if (wash > 0) { ctx.fillStyle = rgba('#fff6e0', wash); ctx.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ SHOT 3: turn tail-first
const E3 = { x: 1180, y: 2420, r: 1600 };
const R3 = { x: 880, y: 430, s: 0.72 };
// rotation (0 = nose up = tail toward Earth). Starts nose-down toward Earth (π + a little lean).
function rot3(t) {
  const start = Math.PI + 0.32;
  // anticipation: tiny counter-twist before the puff, then a smooth flip, overshoot & settle
  const antic = -0.06 * Math.sin(Math.PI * clamp((t - (T_PUFF1 - 0.18)) / 0.18));
  const u = clamp((t - T_PUFF1) / (T_PUFF2 - T_PUFF1));
  const flip = ease.inOutSine(u);
  const settle = t > T_PUFF2 ? 0.1 * Math.exp(-4 * (t - T_PUFF2)) * Math.sin(TAU * 1.6 * (t - T_PUFF2)) : 0;
  return start + (TAU - start) * flip + antic - settle + 0.02 * sway(t, 4);
}
// thruster puffs: emitted at the nose (P1, pushing it round) and the opposite side at the tail (P2, stopping)
function rcsPuffs(ctx, t, cx, cy, s) {
  const emit = (t0, localY, side, seed) => {
    const u = (t - t0) / 0.9;
    if (u <= 0 || u >= 1) return;
    const r0 = rot3(t0);
    // local point on the hull side → world; puff direction = sideways out of the hull
    const lx = side * 70, ly = localY;
    const c = Math.cos(r0), sn = Math.sin(r0);
    const wx = cx + (lx * c - ly * sn) * s, wy = cy + (lx * sn + ly * c) * s;
    const dx = side * c, dy = side * sn;
    for (let i = 0; i < 4; i++) {
      const d = (30 + 170 * ease.outCubic(u)) * (0.6 + 0.25 * i) * s * 1.6;
      smokePuff(ctx, wx + dx * d + (hash01(i, seed) - 0.5) * 30 * u, wy + dy * d + (hash01(i, seed + 1) - 0.5) * 30 * u,
        (26 + 18 * i) * s * 1.4, { seed: seed + i, u: clamp(u * 1.1 + i * 0.05), n: 5, lw: 4 });
    }
    // "pfft" dashes flying out with the jet
    if (u < 0.3) {
      ctx.save(); ctx.strokeStyle = rgba('#ffffff', 1 - u / 0.3); ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (const k of [-1, 0, 1]) {
        const a = Math.atan2(dy, dx) + k * 0.45;
        const r0 = (60 + 260 * u) * s, r1 = r0 + 40 * s;
        ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * r0, wy + Math.sin(a) * r0); ctx.lineTo(wx + Math.cos(a) * r1, wy + Math.sin(a) * r1); ctx.stroke();
      }
      ctx.restore();
    }
  };
  emit(T_PUFF1 - 0.02, -250, -1, 10); // near the nose (local y from centre; -360 = nose tip): starts the flip
  emit(T_PUFF2 - 0.02, -250, 1, 30); // opposite side: stops it
}

// Re-entry heat building under a tail-first rocket: (x, y) = bottom of the fins, s = rocket scale.
// Re-entry heat on a tail-first rocket, drawn BEFORE the hull: (x, y) = fin-bottom centre, s = scale.
// Flame tongues licking UP along the outside of the fins (flames trail opposite the motion) and a
// white-hot plate under the nozzle — deliberately no downward plume, so it can't read as thrust.
function bowShock(ctx, t, x, y, s, k) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - 60 * s, (320 + 180 * k) * s, '#ff6a1a', 0.5 * k);
  ctx.restore();
  const tongue = (bx, by, w, h, lean) => {
    ctx.beginPath();
    ctx.moveTo(bx - w, by);
    ctx.quadraticCurveTo(bx - w * 1.1, by - h * 0.55, bx + lean, by - h);
    ctx.quadraticCurveTo(bx + w * 1.1, by - h * 0.55, bx + w, by);
    ctx.arc(bx, by, w, 0, Math.PI, false);
    ctx.closePath();
  };
  // [local x, local y, width, height] along the fin's outer edge (fin tip ≈ (±236, 0))
  const T = [[246, -6, 30, 190], [222, -110, 26, 160], [190, -210, 22, 130], [120, 22, 26, 120]];
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.8);
  ctx.lineJoin = 'round';
  for (let side = -1; side <= 1; side += 2) {
    T.forEach(([lx, ly, w, h], i) => {
      const f = 0.5 + 0.5 * noise1(t * 11 + i * 2.3 + side, 17 + i);
      const hh = h * (0.35 + 0.65 * k) * (0.75 + 0.4 * f) * s;
      const bx = x + side * lx * s, by = y + ly * s, ww = w * s * (0.8 + 0.3 * k);
      const lean = side * (10 + 18 * f) * s;
      tongue(bx, by, ww, hh, lean); ink(ctx, PAL.orange, LW * 0.8);
      tongue(bx + side * 2 * s, by + ww * 0.15, ww * 0.6, hh * 0.68, lean * 0.7); ink(ctx, PAL.yellow, 0);
      tongue(bx + side * 3 * s, by + ww * 0.3, ww * 0.28, hh * 0.38, lean * 0.4); ink(ctx, '#fff6d0', 0);
    });
  }
  // white-hot plate under the nozzle
  const pr = (120 + 40 * k) * s, pry = (14 + 16 * k) * s;
  ctx.beginPath(); ctx.ellipse(x, y + 6 * s, pr, pry, 0, 0, TAU); ink(ctx, PAL.orange, LW * 0.8);
  ctx.beginPath(); ctx.ellipse(x, y + 4 * s, pr * 0.78, pry * 0.6, 0, 0, TAU); ink(ctx, '#fff2b0', 0);
  ctx.restore();
}

function drawShot3(ctx, t) {
  const lt = t - T_EXT;
  // after the counter-puff it tips over into a FALL toward Earth: accelerating sink, the Earth rising to
  // meet it, relative wind streaking up past it, the tail heating up → s18's fireball on the downbeat
  const fall = ease.inQuad(clamp((t - (T_PUFF2 + 0.1)) / (T_END - T_PUFF2 - 0.1)));
  const sink = 250 * fall;
  const zoom = tween(t, T_EXT, T_END, 1.0, 1.08, ease.inOutSine);
  const ey = E3.y - lt * 6 - 90 * fall;
  const wake = t >= T_WAKE - NEAR;
  const jolt = wake ? Math.exp(-9 * (t - T_WAKE)) : 0;
  spaceBg(ctx, { t, hue: 'blue', seed: 9, stars: 300, driftX: lt * 8, driftY: -sink * 0.4, band: 0.6 });
  // risen sun, upper left
  sunFlare(ctx, 230, 150, 0.8, 0.55, t, { ghosts: 0.6, scale: 0.8 });
  camera(ctx, { x: W / 2 + 6 * jolt * noise1(t * 40, 3), y: H / 2 + 20 + 6 * jolt * noise1(t * 40, 5), zoom }, () => {
    drawEarth(ctx, E3.x, ey, E3.r, { t, rot: 2.3 + lt * 0.015, pitch: -0.85, tilt: -0.25, glow: 1 });
    limbGold(ctx, E3.x, ey, E3.r, -Math.PI / 2 - 0.5, 0.45, 0.45);
    const cx = R3.x + 8 * sway(t, 4), cy = R3.y + 10 * sway(t, 8) + sink;
    const r = rot3(t);
    // relative wind: streaks rushing UP past the falling rocket
    if (fall > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cx - 560, -200, 1120, H + 400); ctx.clip();
      streaks(ctx, t, { angle: -Math.PI / 2, count: 34, speed: 3200, alpha: 0.75 * Math.sqrt(fall), color: '#e6f2ff', lw: 6, len: 200 + 260 * fall, seed: 23 });
      ctx.restore();
    }
    rcsPuffs(ctx, t, cx, cy, R3.s);
    // the tail starts to glow as it bites the atmosphere: a glowing bow-shock cap hugging the underside
    // with heat streaming UP the flanks (no downward plume, so it can't read as thrust)
    const warm = smoothstep(T_PUFF2 + 0.15, T_END, t);
    const tail = [cx, cy + 360 * R3.s]; // fin-bottom centre
    if (warm > 0) bowShock(ctx, t, tail[0], tail[1], R3.s, warm);
    drawRocket(ctx, cx, cy + 360 * R3.s, R3.s, {
      t, rot: r, crew: true, shake: 0.5 * warm + 0.6 * jolt,
      // asleep upside-down … then eyes POP open as the heat builds
      crewPose: wake
        ? { girl: { t, expr: 'surprised', blink: 0 }, dog: { t, expr: 'surprised', blink: 0, ears: 1 } }
        : { girl: { expr: 'happy', blink: 1, headTilt: 0.15 }, dog: { expr: 'sleepy', blink: 1 } },
    });
    // heat sparks stripped off the tail, flying up past the hull
    if (warm > 0.05) {
      for (let i = 0; i < 14; i++) {
        const u = fract(hash01(i, 71) + t * (1.6 + hash01(i, 72)));
        const side = hash01(i, 73) < 0.5 ? -1 : 1;
        const px = tail[0] + side * (70 + 110 * hash01(i, 74)) * R3.s * (1 + 0.4 * u);
        const py = tail[1] - u * 420 * R3.s;
        sparkle(ctx, px, py, (6 + 7 * hash01(i, 75)) * (1 - u), i % 3 ? '#ffb45a' : '#fff2c4', warm * (1 - u));
      }
    }
    // z's float up out of the portholes (emitted where the porthole was on the beat; they rise screen-up)
    // — and burst the moment the crew wake up
    Z3_BEATS.forEach((bt, i) => {
      const rr = rot3(bt), c = Math.cos(rr), sn = Math.sin(rr);
      const [lx, ly] = i === 0 ? [-22, -98] : [-22, 18]; // Juno's / Biscuit's porthole, from the stage centre
      const px = R3.x + (lx * c - ly * sn) * R3.s, py = R3.y + (lx * sn + ly * c) * R3.s;
      zStream(ctx, t, [bt], [px - 30, py - 30], { dir: -1, size: 1.5, life: 1.5, rise: 150, kill: T_WAKE - NEAR });
    });
  });
}

export default {
  id: 's17_homeward',
  start: 105.742,
  end: 112.942,
  transition: { type: 'fade', dur: 1.2 },
  draw(ctx, t) {
    if (t < T_CUT2) drawShot1(ctx, Math.max(t, T0 - 1.5));
    else if (t < T_EXT - NEAR) drawShot2(ctx, t); // cut on the 30 fps frame nearest the bar-46 downbeat
    else drawShot3(ctx, Math.min(t, T_END + 1.5));
  },
};
