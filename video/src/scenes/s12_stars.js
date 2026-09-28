// s12_stars — "just me and the stars" (bars 25–28, 60.14 → 69.74)
// Engines off. The S.S. Biscuit coasts nose-up-left through a violet starfield; Juno and Biscuit sit on
// its nose cone (tethered to an eye-bolt), seen from behind, gazing up.
//   bar 25  match-dissolve on s11's last shot (small rocket, its golden sling-string, the ringed planet low-left),
//           then the camera flies in over their shoulders, landing just before bar 26
//   bar 26  a dog constellation strings itself together, one stroke per beat — Biscuit wags harder each time,
//           and a heart pops from his fishbowl once the picture has its ear + snout ("that's me!")
//   bar 27  Juno points; a girl-with-pigtails constellation follows her finger, one stroke per beat
//   bar 28  the sky-dog lifts a paw, a gold string joins it to sky-Juno's hand; the pair lean together and
//           their helmets CLINK on beat 2 (heart blooms on the string), a shooting star on 68.54, pull back to the cut.
// Every hit is keyed with hitAt() (half a frame early) so the impact frame is the video frame nearest the beat.
import { W, H, INK, PAL, camera, glow, sparkle } from '../draw.js';
import { clamp, lerp, ease, keyframes, hash01, TAU } from '../util.js';
import { barTime, beatAt, pulse, sway, hat, hitCount, HATS } from '../timing.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { drawRocket } from '../props/rockets.js';
import { spaceBg, constellation, CONSTELLATIONS, placeConstellation, shootingStar, drawRingedPlanet } from '../props/space.js';
import { drawLyric, LYRICS } from '../lyrics.js';

// ---------------------------------------------------------------- beat grid
// Impacts are keyed half a frame EARLY: at 30 fps every beat of this song falls ~6 ms after a frame boundary,
// so a plain `t >= beat` threshold would first show each hit on the following frame, 27 ms late. With the lead,
// the impact frame is the one nearest the beat.
const LEAD = 1 / 60;
const hitAt = (k, j = 0) => barTime(k, j) - LEAD;
const T_IN = barTime(25); // 60.139 scene start (0.6 s fade from s11)
const B26 = hitAt(26); // 62.539 dog constellation: strokes on each beat
const B27 = hitAt(27); // 64.939 Juno points; girl constellation: strokes on each beat
const B28 = hitAt(28); // 67.339 the joining string snaps
const T_CLINK = hitAt(28, 1); // 67.939 helmets touch
const T_SHOOT = hitAt(28, 2); // 68.540 shooting star
const T_OUT = barTime(29); // 69.740 cut to s13
const beat = hitAt;

// ---------------------------------------------------------------- layout
const RS = 2.7; // rocket scale
const PHI0 = -0.96; // rocket tilt (nose up-left) — the nose cone's upper edge becomes a flat ledge
const CS = 1.05; // character scale
// local (s = 1) rocket-frame points; seats lie on the cone's upper edge (x = right-profile half-width)
const SEAT_DOG = [49, -658];
const SEAT_GIRL = [90, -583];
const ANCHOR = [66, -625]; // this local point sits at world ANCHOR_W at rest
const ANCHOR_W = [930, 880];
const BOLT = [18, -640]; // tether eye-bolt on the camera-facing side of the cone

// sky pictures: dog upper-left, girl upper-right (sky-layer coords = screen coords in the medium shot)
const DOG_C = { cx: 560, cy: 372, size: 170, rot: -0.04 }; // (kept clear of the lyric line above)
const GIRL_C = { cx: 1372, cy: 366, size: 180, rot: 0.03 };
// Dog strokes (segments re-ordered so the HEAD is the payoff on beat 4):
//   b1 tail + back · b2 rump, hind leg, belly · b3 front leg, chest · b4 neck, ear, head, snout, jaw (+ eye star)
const DOG_SEGS = [[0, 1], [1, 2], [1, 11], [11, 12], [11, 9], [9, 10], [9, 8], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]];
const DOG_GROUPS = [[0, 2, beat(26, 0), 0.34], [2, 3, beat(26, 1), 0.4], [5, 2, beat(26, 2), 0.34], [7, 6, beat(26, 3), 0.5]];
// Girl (space.js build): head 0-6, dress 7-13, arms 14-15, legs 16-17, buns 18-29, smile 30-31.
//   b1 head · b2 dress · b3 arms, legs, smile · b4 both pigtail buns — "it's Juno!" (eyes light last)
const GIRL_BASE = CONSTELLATIONS.girl;
const GIRL_SEGS = [
  ...GIRL_BASE.segments.slice(0, 7),
  ...GIRL_BASE.segments.slice(7, 14),
  ...GIRL_BASE.segments.slice(14, 18), ...GIRL_BASE.segments.slice(30, 32),
  ...GIRL_BASE.segments.slice(18, 30),
];
const GIRL_GROUPS = [[0, 7, beat(27, 0), 0.46], [7, 7, beat(27, 1), 0.46], [14, 6, beat(27, 2), 0.44], [20, 12, beat(27, 3), 0.56]];
const DOG_PAW = 10, GIRL_HAND = 15; // point indices joined in bar 28

// Map time → constellation progress (0..1) from stroke groups (segments inside a group draw back to back).
function groupProgress(t, groups, S) {
  let P = 0;
  for (const [s0, n, t0, d] of groups) {
    if (t <= t0) break;
    P = s0 + n * clamp((t - t0) / d);
  }
  return P / S;
}
// Decaying accent (1 on the hit, fading) from the most recent group start.
function groupHit(t, groups, decay = 6) {
  let v = 0;
  for (const g of groups) if (t >= g[2]) v = Math.exp(-decay * (t - g[2]));
  return v;
}

// ---------------------------------------------------------------- camera / rocket motion
// Bar 25 opens as a MATCH-DISSOLVE on s11's last shot: the rocket small (~180 px) at the same spot and heading
// s11 leaves it (nose up-left, just past the swoop), its golden sling-string curling away behind it and the
// ringed planet low-left. Then the camera flies in to the over-the-shoulder medium, arriving just before bar 26.
// (s11 keeps its last-shot camera + ship scale for this hand-off — see the NOTE in s11_slingshot.js.)
const T_DISS = T_IN + 0.6; // end of the engine's crossfade from s11
const T_ARRIVE = B26 - 0.12; // the fly-in lands on the medium shot
const Z_WIDE = 0.09; // 2.7 × 0.09 = 0.243 screen px per rocket unit = s11's rocket (s 0.27 at zoom 0.9)
const FOCUS_W = [945, 800]; // world point the fly-in homes in on (between the pair, shoulder height)
// s11's rocket centre on screen at 60.14 / 60.44 / 60.74 (measured) — s12's rocket rides the same path in the fade
const S11_ROCKET = [[T_IN, 1150, 318], [T_IN + 0.3, 1096, 364], [T_DISS, 1075, 366]];
const ROCKET_C = (() => { // static world position of the rocket's centre (local (0, -360))
  const c = Math.cos(PHI0), sn = Math.sin(PHI0);
  const ox = ANCHOR_W[0] - (ANCHOR[0] * c - ANCHOR[1] * sn) * RS, oy = ANCHOR_W[1] - (ANCHOR[0] * sn + ANCHOR[1] * c) * RS;
  return [ox + (360 * sn) * RS, oy - 360 * c * RS];
})();
const kf3 = (t, keys, i) => keyframes(t, keys.map((k) => [k[0], k[i], ease.inOutSine]));
// The fly-in as (screen position S of FOCUS_W, zoom z); null once the medium shot has been reached.
function flyAt(t) {
  if (t >= T_ARRIVE) return null;
  const tc = Math.max(t, T_IN - 1.5);
  if (tc < T_DISS) {
    const z = Z_WIDE * (1 + 0.1 * clamp((tc - T_IN) / 0.6));
    const rc = [kf3(tc, S11_ROCKET, 1), kf3(tc, S11_ROCKET, 2)];
    return { S: [(FOCUS_W[0] - ROCKET_C[0]) * z + rc[0], (FOCUS_W[1] - ROCKET_C[1]) * z + rc[1]], z };
  }
  // zoom in log space so the approach feels like a steady glide, not a lurch at the end
  const e = ease.inOutSine(clamp((tc - T_DISS) / (T_ARRIVE - T_DISS)));
  const z0 = Z_WIDE * 1.1, d = S11_ROCKET[2];
  const s0 = [(FOCUS_W[0] - ROCKET_C[0]) * z0 + d[1], (FOCUS_W[1] - ROCKET_C[1]) * z0 + d[2]];
  return { S: [lerp(s0[0], FOCUS_W[0], e), lerp(s0[1], FOCUS_W[1], e)], z: z0 * Math.pow(1 / z0, e) };
}
// the medium shot's own moves (bars 26–28): tiny pans toward each constellation as it draws, a slow push in
// on the pair through bar 27, and a pull back after the helmets clink to show the whole sky gallery
function camMed(t) {
  const zoom = keyframes(t, [[T_ARRIVE, 1], [B28, 1.06, ease.inOutSine], [T_CLINK, 1.07, ease.inOutSine], [T_OUT, 0.92, ease.inOutSine]]);
  const x = keyframes(t, [[T_ARRIVE, 960], [B27, 935, ease.inOutSine], [B28, 985, ease.inOutSine], [T_OUT, 960, ease.inOutSine]]);
  const y = keyframes(t, [[T_ARRIVE, 540], [B28, 565, ease.inOutSine], [T_CLINK, 570, ease.inOutSine], [T_OUT, 530, ease.inOutSine]]);
  return { x, y, zoom };
}
function camAt(t) {
  const f = flyAt(t);
  if (!f) return camMed(t);
  return { x: FOCUS_W[0] - (f.S[0] - W / 2) / f.z, y: FOCUS_W[1] - (f.S[1] - H / 2) / f.z, zoom: f.z };
}
// how far the fly-in still has to travel on screen (0 once arrived) — drives parallax of the far layers
function flyOff(t) {
  const f = flyAt(t);
  return f ? [f.S[0] - FOCUS_W[0], f.S[1] - FOCUS_W[1]] : [0, 0];
}
function rocketFrame(t) {
  const lt = Math.max(0, t - T_IN);
  // s11 hands over mid-way out of its swoop (heading ~5° short of ours): that last bit of turn settles out,
  // then a slow tempo-locked rock (8 beats) and bob (4 beats)
  const settle = 0.085 * Math.exp(-4 * lt);
  const phi = PHI0 + settle + 0.018 * sway(t, 8);
  const c = Math.cos(phi), sn = Math.sin(phi);
  const ax = ANCHOR_W[0], ay = ANCHOR_W[1] + 5 * sway(t, 4);
  const ox = ax - (ANCHOR[0] * c - ANCHOR[1] * sn) * RS;
  const oy = ay - (ANCHOR[0] * sn + ANCHOR[1] * c) * RS;
  const toW = (lx, ly) => [ox + (lx * c - ly * sn) * RS, oy + (lx * sn + ly * c) * RS];
  return { phi, ox, oy, toW };
}
// how far the ship has coasted (px of star drift): a little slingshot momentum bleeding off into a slow cruise
// (s11's stars drift at ~60 px/s at the handover, so this starts near that and calms down)
const coast = (t) => { const lt = Math.max(0, t - T_IN); return 60 * (1 - Math.exp(-1.2 * lt)) + 12 * lt; };

// ---------------------------------------------------------------- poses
const BASE_DOG = { view: 'back', stance: 'sit', suit: 'space', helmet: 1, facing: -1 };
const BASE_GIRL = { view: 'back', stance: 'sit', suit: 'space', helmet: 1 };
const LEAN_G = -0.15, LEAN_D = 0.2; // full-lean tilts (scaled by LEAN_K so the helmets just touch)
const HUG_HEAD = -0.05; // Juno's head tips toward Biscuit in the hug
const dogHelm = (x, y, pose) => { const a = dogAnchors(x, y, CS, pose); const r = (pose.tilt || 0); return { x: a.head[0] + 6 * CS * Math.sin(r), y: a.head[1] - 6 * CS * Math.cos(r), r: 67 * CS }; };
// Solve (once, at rest) for the lean that brings the two fishbowls into contact.
const LEAN_K = (() => {
  const R = rocketFrame(T_IN + 100);
  const d = R.toW(SEAT_DOG[0], SEAT_DOG[1]), g = R.toW(SEAT_GIRL[0], SEAT_GIRL[1]);
  const gap = (k) => {
    const gh = girlAnchors(g[0], g[1], CS, { ...BASE_GIRL, tilt: LEAN_G * k, headTilt: HUG_HEAD }).helmet;
    const dh = dogHelm(d[0], d[1], { ...BASE_DOG, tilt: LEAN_D * k });
    return Math.hypot(gh.x - dh.x, gh.y - dh.y) - gh.r - dh.r + 3; // a hair of squish
  };
  let lo = 0, hi = 1.6;
  if (gap(hi) > 0) return hi;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (gap(m) > 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
})();

// ---------------------------------------------------------------- local helpers
// Coiled tether cord from a (harness) to b (eye-bolt), sagging a little, with a carabiner at a.
function tether(ctx, a, b, t, col, seed) {
  const [ax, ay] = a, [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const sag = 22 + 7 * sway(t + seed * 0.3, 4);
  const cx = (ax + bx) / 2 + 8 * sway(t, 8), cy = (ay + by) / 2 + sag;
  const N = 90, coils = Math.max(5, Math.round(len / 15));
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * cx + u * u * bx;
    const py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * cy + u * u * by;
    const dx = 2 * (1 - u) * (cx - ax) + 2 * u * (bx - cx), dy = 2 * (1 - u) * (cy - ay) + 2 * u * (by - cy);
    const dl = Math.hypot(dx, dy) || 1;
    const amp = 6.5 * Math.sin(Math.PI * clamp(u * 7)) * Math.sin(Math.PI * clamp((1 - u) * 7));
    // a coil seen at an angle: offset across the cord + a little along it (reads as loops, not a sine)
    const ph = u * coils * TAU;
    const w = amp * Math.sin(ph), along = amp * 0.55 * Math.cos(ph);
    pts.push([px - (dy / dl) * w + (dx / dl) * along, py + (dx / dl) * w + (dy / dl) * along]);
  }
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = 8.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
  // carabiner at the harness end
  ctx.beginPath(); ctx.ellipse(ax, ay + 5, 6, 9, 0, 0, TAU);
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 3.8; ctx.strokeStyle = PAL.steel; ctx.stroke();
  ctx.restore();
}
function eyeBolt(ctx, x, y, s) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y + 3 * s, 12 * s, 5.5 * s, 0, 0, TAU);
  ctx.fillStyle = PAL.greyDark; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y - 6 * s, 8.5 * s, 0, TAU);
  ctx.lineWidth = 10.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = PAL.steel; ctx.stroke();
  ctx.restore();
}
// s11's golden sling-string, rebuilt behind the nozzle in rocket-local units (0.243 screen px per unit at the
// handover, exactly s11's scale) so the crossfade lines up: a straight run back from the nozzle, a 150° swoop
// (s11's 150-unit turn radius), then the long lazy curve away toward the planet. It hangs in space, so as the
// ship coasts on it slides back along itself; it dissolves as the camera flies in to the crew.
const SLIDE = (lt) => 520 * (1 - Math.exp(-1.2 * lt)) + 100 * lt; // coasting distance in rocket units
function slingPathLocal(t) {
  const lt = Math.max(0, t - T_IN);
  const pts = [];
  let x = 0, y = -14 + 40 + SLIDE(lt), h = Math.PI / 2; // heading "back" (+y local)
  pts.push([0, -14]);
  pts.push([x, y]);
  const RT = 555, TURN = (150 * Math.PI) / 180;
  const cx = x - RT * Math.sin(h) * 1, cy = y + RT * Math.cos(h); // centre on the right of travel (y-down)
  for (let i = 1; i <= 14; i++) {
    const hh = h + (TURN * i) / 14;
    pts.push([cx + RT * Math.sin(hh), cy - RT * Math.cos(hh)]);
  }
  h += TURN; [x, y] = pts[pts.length - 1];
  for (let i = 0; i < 26; i++) { // the long run back toward the planet, bending slowly down-left on screen
    h -= 0.022; x += Math.cos(h) * 175; y += Math.sin(h) * 175;
    pts.push([x, y]);
  }
  return pts;
}
function slingTrail(ctx, t, R, cam) {
  const fade = 1 - ease.inOutSine(clamp((t - (T_DISS + 0.15)) / 1.25));
  if (fade <= 0) return;
  const P = slingPathLocal(t).map(([x, y]) => R.toW(x, y));
  const N = P.length - 1;
  const gs = Math.pow(cam.zoom / Z_WIDE, 0.35) / cam.zoom; // screen px → world, growing a little as we close in
  const glowPulse = 1 + 0.6 * pulse(t, 5);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const CH = 8;
  for (const [w, a, col] of [[64, 0.13, '#ff9ed2'], [28, 0.3, '#ffd27a'], [9, 1, '#fffbea']]) {
    for (let c = 0; c < CH; c++) {
      const i0 = Math.floor((c / CH) * N), i1 = Math.floor(((c + 1) / CH) * N);
      const f = 1 - (c + 0.5) / CH; // 1 at the rocket, 0 at the far end
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) (i === i0 ? ctx.moveTo(P[i][0], P[i][1]) : ctx.lineTo(P[i][0], P[i][1]));
      ctx.globalAlpha = fade * Math.min(1, a * (0.3 + 0.7 * f) * (col === '#fffbea' ? 1 : glowPulse));
      ctx.strokeStyle = col; ctx.lineWidth = w * (0.4 + 0.6 * f) * gs;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // sparkles riding the string (twinkle on the beat, flare on hats)
  const hp = hat(t);
  for (let i = 0; i < 30; i++) {
    const u = (hash01(i, 81) + Math.max(0, t - T_IN) * 0.08) % 1; // 0 at the rocket → 1 far end
    const k = u * N, i0 = Math.min(N - 1, Math.floor(k)), fr = k - i0;
    const x = lerp(P[i0][0], P[i0 + 1][0], fr), y = lerp(P[i0][1], P[i0 + 1][1], fr);
    const f = 1 - u;
    const tw = 0.5 + 0.5 * Math.sin(TAU * (beatAt(t) + hash01(i, 82)));
    const r = (8 + 10 * tw + 12 * hp * (hash01(i, 83) < 0.4 ? 1 : 0)) * (0.45 + 0.55 * f) * gs;
    sparkle(ctx, x + (hash01(i, 84) - 0.5) * 36 * gs, y + (hash01(i, 85) - 0.5) * 36 * gs, r, i % 3 ? '#fff6c0' : '#ffd6ec', fade * 0.95 * (0.35 + 0.65 * f));
  }
  ctx.restore();
}
// The ringed planet they just slung round, low-left as s11 leaves it; it sinks out of frame as the camera
// tilts up off the rocket toward the sky.
const S11_PLANET = [[T_IN, 596, 1208], [T_IN + 0.3, 558, 1285], [T_DISS, 550, 1313]];
function planetBehind(ctx, t) {
  const f = flyAt(t);
  if (!f) return;
  let px = kf3(t, S11_PLANET, 1), py = kf3(t, S11_PLANET, 2);
  if (t > T_DISS) {
    const d = flyAt(T_DISS);
    px += (f.S[0] - d.S[0]) * 1.2; py += (f.S[1] - d.S[1]) * 1.2;
  }
  const r = 488;
  if (py - r * 1.05 > H + 20) return;
  drawRingedPlanet(ctx, px, py, r, { rot: t * 0.045, tilt: -0.36, open: 0.3 });
}
function heart(ctx, x, y, s, a) {
  if (a <= 0 || s <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  glow(ctx, x, y, s * 3.4, '#ff9ecb', 0.6);
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.45, -s * 0.1, -s * 0.7, -s * 1.15, 0, -s * 0.42);
  ctx.bezierCurveTo(s * 0.7, -s * 1.15, s * 1.45, -s * 0.1, 0, s * 0.9);
  ctx.closePath();
  ctx.fillStyle = '#ffc2df'; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  sparkle(ctx, -s * 0.45, -s * 0.35, s * 0.35, '#ffffff', 0.9);
  ctx.restore();
}
function rotAbout([x, y], [px, py], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c];
}

// ---------------------------------------------------------------- sky layer
// A handful of "hero" stars in the open sky that flare on the hi-hats — each hat hit lights a different
// quarter of them, so the sky shimmers in rotation rather than blinking all at once.
const HERO = Array.from({ length: 16 }, (_, i) => [hash01(i, 71), hash01(i, 72), hash01(i, 73)]).map(([u, v, m], i) => {
  // keep them out of the pictures, the lyric and the crew: left/right margins, lower-left, lower-right
  const zones = [[40, 330, 60, 560], [1600, 1880, 80, 600], [60, 560, 580, 1000], [1480, 1880, 620, 860], [1200, 1540, 580, 700]];
  const z = zones[i % zones.length];
  return { x: lerp(z[0], z[1], u), y: lerp(z[2], z[3], v), r: 5 + 5 * m, q: i % 4 };
});
function heroStars(ctx, t) {
  const n = hitCount(t, HATS), hp = hat(t, 10);
  for (const s of HERO) {
    const on = n > 0 && ((n - 1) % 4) === s.q ? hp : 0;
    const base = 0.55 + 0.2 * Math.sin(TAU * (beatAt(t) / 4 + s.x * 0.01));
    glow(ctx, s.x, s.y, s.r * (4 + 5 * on), '#dfe8ff', 0.18 + 0.35 * on);
    sparkle(ctx, s.x, s.y, s.r * (1.6 + 2.6 * on), '#ffffff', clamp(base + on));
  }
}
// sky-Juno (in sky coords); her left hand reaches out to meet the sky-dog's paw in bar 28
function girlPicture(t) {
  const reach = ease.outBack(clamp((t - (B28 - 0.42)) / 0.4));
  const shape = { pts: GIRL_BASE.pts.map((p) => p.slice()), segments: GIRL_SEGS };
  shape.pts[GIRL_HAND][0] = lerp(-0.74, -0.98, reach); shape.pts[GIRL_HAND][1] = lerp(-0.2, 0.1, reach);
  return placeConstellation(shape, GIRL_C.cx, GIRL_C.cy, GIRL_C.size, GIRL_C.rot);
}
// Where the string is being drawn right now (sky coords) — the tip of the current stroke, or the end of
// the last one while waiting for the next beat. Juno's pointing finger follows it: she draws with it.
function girlTip(t, pts) {
  const S = GIRL_SEGS.length;
  const P = groupProgress(t, GIRL_GROUPS, S) * S;
  if (P <= 0) return pts[GIRL_SEGS[0][0]];
  const k = Math.min(S - 1, Math.floor(P - 1e-9)), f = P - k;
  const [a, b] = GIRL_SEGS[k];
  const e = ease.outCubic(clamp(f));
  return [lerp(pts[a][0], pts[b][0], e), lerp(pts[a][1], pts[b][1], e)];
}
// sky-layer camera: gentle parallax against the medium shot's moves; during the bar-25 fly-in the sky slides
// down into place (the camera tilting up off the rocket toward the stars)
const SKY_FLY = 0.6;
function skyCam(t) {
  const m = camMed(t), fo = flyOff(t);
  return { x: 960 + (m.x - 960) * 0.35, y: 540 + (m.y - 540) * 0.35, zoom: 1 + (m.zoom - 1) * 0.28, dx: fo[0] * SKY_FLY, dy: fo[1] * SKY_FLY };
}
// sky coords → foreground world coords (through the screen)
function skyToWorld([x, y], t, cam) {
  const sc = skyCam(t);
  const sx = (x - sc.x) * sc.zoom + W / 2 + sc.dx, sy = (y - sc.y) * sc.zoom + H / 2 + sc.dy;
  return [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
}
function drawSky(ctx, t) {
  heroStars(ctx, t);
  // dog picture: dim stars fade in during bar 25; in bar 28 its front paw lifts to meet Juno's hand
  const paw = ease.outBack(clamp((t - (B28 - 0.42)) / 0.4));
  const dogShape = { pts: CONSTELLATIONS.dog.pts.map((p) => p.slice()), segments: DOG_SEGS };
  dogShape.pts[DOG_PAW][0] = lerp(0.45, 0.9, paw); dogShape.pts[DOG_PAW][1] = lerp(0.66, 0.2, paw);
  const dc = placeConstellation(dogShape, DOG_C.cx, DOG_C.cy, DOG_C.size, DOG_C.rot);
  const din = ease.inOutSine(clamp((t - (T_ARRIVE - 1.0)) / 0.9)); // dim stars appear as the sky settles into place
  constellation(ctx, dc.pts, groupProgress(t, DOG_GROUPS, DOG_SEGS.length), { t, segments: DOG_SEGS, color: '#bfe3ff', alpha: din, lw: 3.3, starSize: 10.5 });

  const gc = girlPicture(t);
  const gin = ease.inOutSine(clamp((t - (T_ARRIVE - 0.8)) / 1.0));
  constellation(ctx, gc.pts, groupProgress(t, GIRL_GROUPS, GIRL_SEGS.length), { t, segments: GIRL_SEGS, color: '#ffd9f0', alpha: gin, lw: 3.3, starSize: 10.5 });

  // anticipation: each stroke's first star swells in the 0.2 s before its beat
  const cue = (groups, segs, pts) => {
    for (const [s0, , t0] of groups) {
      const k = clamp((t - (t0 - 0.2)) / 0.2);
      if (k > 0 && k < 1) {
        const [x, y] = pts[segs[s0][0]];
        glow(ctx, x, y, 64 * k, '#ffffff', 0.5 * k);
        sparkle(ctx, x, y, 28 * ease.inQuad(k), '#ffffff', k);
      }
    }
  };
  cue(DOG_GROUPS, DOG_SEGS, dc.pts);
  cue(GIRL_GROUPS, GIRL_SEGS, gc.pts);

  // bar 28: the joining string, hanging in a soft arc from the sky-dog's paw to sky-Juno's hand
  if (t > B28 - 0.25) {
    const a = dc.pts[DOG_PAW], b = gc.pts[GIRL_HAND];
    const m = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 38];
    if (t < B28) { const k = clamp((t - (B28 - 0.25)) / 0.25); glow(ctx, a[0], a[1], 80 * k, '#ffe9a8', 0.6 * k); sparkle(ctx, a[0], a[1], 30 * k, '#fff', k); }
    const jp = ease.outCubic(clamp((t - B28) / 0.45)); // one stroke that snaps off the paw on the beat
    constellation(ctx, [[a[0], a[1], 1.1], [m[0], m[1], 0.8], [b[0], b[1], 1.1]], jp, { t, color: '#ffe27a', lw: 4.5, starSize: 12, glow: 1.2, linear: true });
    // the knot in the middle blooms into a heart on beat 2 (with the helmet clink)
    const hk = clamp((t - (T_CLINK - 0.09)) / 0.24); // blooms to full size right on the clink
    if (hk > 0) heart(ctx, m[0], m[1] + 2 * sway(t, 2), 30 * ease.outBack(hk, 2.6) * (1 + 0.1 * pulse(t, 5)), clamp(hk * 2));
  }

  // shooting star on 68.54 — a wind-up twinkle, then it falls through the open sky right of sky-Juno
  const su = (t - T_SHOOT) / SHOOT_DUR;
  if (su > -0.12 && su < 0) sparkle(ctx, SHOOT0[0], SHOOT0[1], 34 * (1 + su / 0.12), '#ffffff', 1 + su / 0.12);
  if (su > 0 && su < 1) {
    shootingStar(ctx, SHOOT0[0], SHOOT0[1], SHOOT_ANG, su, { dist: SHOOT_DIST, len: 560, size: 17, tint: '#ffd9f0' });
    const k = 1 - clamp(su / 0.2);
    if (k > 0) sparkle(ctx, SHOOT0[0], SHOOT0[1], 46 * k, '#ffffff', k);
  }
}
// it streaks in from the top-right corner and falls down-left, clear of sky-Juno, toward the pair's side of the sky
const SHOOT0 = [1890, 100], SHOOT_ANG = 2.0, SHOOT_DIST = 740, SHOOT_DUR = 1.1;
// 0..1 progress of the shooting star's head (for the characters' eyes)
const shootProg = (t) => ease.outQuad(clamp((t - T_SHOOT) / SHOOT_DUR));

// ---------------------------------------------------------------- foreground: rocket + crew
function drawForeground(ctx, t, cam) {
  const R = rocketFrame(t);
  // s11's sling-string behind the nozzle (bar 25 only)
  slingTrail(ctx, t, R, cam);
  // rocket — s11 leaves the engine ticking over at ~0.2; it cuts out in the first beat of the quiet
  ctx.save();
  ctx.translate(R.ox, R.oy);
  ctx.rotate(R.phi);
  drawRocket(ctx, 0, 0, RS, { t, stickers: true, flame: 0.3 * (1 - ease.inQuad(clamp((t - T_IN) / 0.55))) });
  ctx.restore();
  const bolt = R.toW(BOLT[0], BOLT[1]);
  eyeBolt(ctx, bolt[0], bolt[1], 1.35);

  // ---- acting ------------------------------------------------------------------------------------
  // lean in after the string connects, arriving in contact exactly on the clink beat, then a tiny bump-back
  // (a slow start, then the heads fall together and ARRIVE with speed on the beat — an ease-to-a-stop would
  // read as a soft touch, not a clink — a small bump apart, and they settle leaning on each other)
  const lu = clamp((t - (B28 + 0.08)) / (T_CLINK - B28 - 0.08));
  const lean = LEAN_K * (t < T_CLINK
    ? 0.45 * ease.inOutSine(lu) + 0.55 * ease.inCubic(lu)
    : 1 - 0.09 * Math.exp(-6 * (t - T_CLINK)) * Math.sin(Math.PI * clamp((t - T_CLINK) / 0.28)));
  const clink = t >= T_CLINK ? Math.exp(-7 * (t - T_CLINK)) : 0;
  // the crew ride the rocket: its roll (slingshot settle + slow rock) tilts them too; plus their own gentle sway
  const swayK = (R.phi - PHI0) + 0.028 * sway(t, 4) * (1 - 0.6 * clamp(lean / LEAN_K));
  // heads snap round to the shooting star on its beat, then follow it down
  const wish = ease.outBack(clamp((t - T_SHOOT) / 0.22)) * (1 - ease.inOutSine(clamp((t - (T_OUT - 0.5)) / 0.5)));
  const follow = shootProg(t);

  // bar 25, on "me": a glance at each other (heads tip together), then both look back up for the first stroke
  const glance = ease.inOutSine(clamp((t - (beat(25, 2) - 0.25)) / 0.35)) * (1 - ease.inOutSine(clamp((t - (B26 - 0.4)) / 0.35)));
  // Biscuit — bar 26: looks up-left at his picture, ears + bounce on every stroke, wag builds; head reveal = big wag
  const dSeat = R.toW(SEAT_DOG[0], SEAT_DOG[1]);
  const dStrokes = DOG_GROUPS.filter((g) => t >= g[2]).length;
  const dHit = groupHit(t, DOG_GROUPS, 6);
  const gHit = groupHit(t, GIRL_GROUPS, 6);
  const revealDog = t >= DOG_GROUPS[3][2] ? Math.exp(-3 * (t - DOG_GROUPS[3][2])) : 0;
  const toDog = ease.inOutSine(clamp((t - (B26 - 0.5)) / 0.5)) * (1 - ease.inOutSine(clamp((t - (B27 - 0.4)) / 0.5)));
  // look[0] > 0 = snout peeks toward screen-left (facing -1); look[1] < 0 = nose up over the crown.
  // (look[1] is kept ≥ -0.72: further up, dog.js pokes the nose through the fishbowl — see report)
  // The head tilt carries the gaze from behind: left toward his picture, right toward the shooting star.
  const dLookX = lerp(lerp(0.15, 0.85, toDog), -0.6, wish);
  const toGirl = ease.inOutSine(clamp((t - (B27 - 0.3)) / 0.5)) * (1 - ease.inOutSine(clamp((t - (B28 - 0.2)) / 0.5)));
  const dHead = 0.16 * glance - 0.2 * toDog - (t < B27 ? 0.1 * dHit + 0.1 * revealDog : 0) + 0.1 * toGirl + 0.05 * sway(t, 4) * (1 - toDog - toGirl) + wish * (0.12 + 0.12 * follow);
  const dogPose = {
    ...BASE_DOG, t,
    look: [dLookX, -0.7 + 0.25 * wish * follow],
    headTilt: dHead,
    wag: t < B26 ? 0.55 : Math.min(1.5, 0.7 + 0.2 * dStrokes + 0.4 * revealDog),
    ears: clamp(0.2 + 0.55 * dHit + 0.6 * revealDog + 0.3 * gHit * (t > B27 ? 0.5 : 0) + 0.5 * wish),
    tilt: swayK + LEAN_D * lean,
    squash: 1 + (t < B27 ? 0.08 * dHit + 0.1 * revealDog : 0) - 0.03 * clink - 0.02 * pulse(t, 6),
  };
  // Juno — bar 26 watches the dog picture; bar 27 points (wind-up 0.3 s before the beat) and "taps" each stroke
  const gSeat = R.toW(SEAT_GIRL[0], SEAT_GIRL[1]);
  // anticipation: the arm dips (−0.42…−0.2 s), then whips up accelerating so it STOPS on the beat, overshooting after
  const wind = ease.inOutSine(clamp((t - (B27 - 0.42)) / 0.22));
  const shootUp = t < B27 ? ease.inQuad(clamp((t - (B27 - 0.2)) / 0.2)) : 1 + 0.12 * Math.exp(-6 * (t - B27)) * Math.sin(TAU * 2.2 * (t - B27));
  const ptDown = ease.inOutCubic(clamp((t - (B28 + 0.04)) / 0.4)); // keeps pointing as the string connects
  const point = shootUp * (1 - ptDown);
  const tap = t > B27 && t < B28 ? 0.1 * groupHit(t, GIRL_GROUPS, 9) : 0;
  const rest = { a: 0.32, b: -0.5 };
  // aim: halfway between sky-Juno's centre and the drawing tip, so the finger "draws" each stroke
  const gp = girlPicture(t), tipW = skyToWorld(girlTip(t, gp.pts), t, cam), cenW = skyToWorld([GIRL_C.cx, GIRL_C.cy - 20], t, cam);
  const aimW = [lerp(cenW[0], tipW[0], 0.55), lerp(cenW[1], tipW[1], 0.55)];
  const shR = girlAnchors(gSeat[0], gSeat[1], CS, { ...BASE_GIRL, tilt: swayK }).shoulderR;
  // (horizontal offset exaggerated ×1.7 so the gesture reads as "that one, over there" rather than "up")
  const aim = Math.atan2((aimW[0] - shR[0]) * 1.7, aimW[1] - shR[1]) + swayK;
  const armR = {
    a: lerp(rest.a - 0.2 * wind * (1 - Math.min(1, shootUp)), aim - 0.02 + tap, point),
    b: lerp(rest.b, 0.04 - tap * 0.5, point),
    hand: point > 0.3 ? 'point' : 'open',
  };
  const hug = clamp(lean / LEAN_K);
  // arm draped round him: elbow up and out, forearm dropping onto his shoulder (a straight arm read as a poke)
  const armL = { a: lerp(rest.a, 1.95, hug), b: lerp(rest.b, -1.0, hug), hand: 'open' };
  const gLook = t < B27 ? -0.05 * toDog : 0.06 * point;
  const girlPose = {
    ...BASE_GIRL, t, armR, armL,
    tilt: swayK + LEAN_G * lean,
    headTilt: 0.04 * sway(t, 4) * (1 - hug) - 0.14 * glance + gLook + 0.07 * gHit * (t > B27 ? 1 : 0) + HUG_HEAD * hug + wish * (0.05 + 0.05 * follow),
    squash: 1 - 0.02 * pulse(t, 6) - 0.03 * clink + 0.05 * groupHit(t, [GIRL_GROUPS[3]], 5), // happy stretch as her buns appear
  };
  drawDog(ctx, dSeat[0], dSeat[1], CS, dogPose);
  drawGirl(ctx, gSeat[0], gSeat[1], CS, girlPose);

  // "that's me!" — a little heart floats up from Biscuit's fishbowl once his picture has its ear and snout
  // (~0.3 s into the head stroke; before that it still reads as an "H"), just ahead of Juno's point
  const hu = (t - DOG_GROUPS[3][2] - 0.3) / 1.0;
  if (hu > 0 && hu < 1) {
    const dh = dogHelm(dSeat[0], dSeat[1], dogPose);
    const hs = 17 * ease.outBack(clamp(hu / 0.25), 2.4);
    heart(ctx, dh.x + 14 * Math.sin(hu * 5), dh.y - dh.r - 16 - 70 * ease.outQuad(hu), hs, 1 - clamp((hu - 0.6) / 0.4));
  }
  // helmet clink glint on beat 2 of bar 28
  if (clink > 0.02) {
    const gh = girlAnchors(gSeat[0], gSeat[1], CS, girlPose).helmet;
    const dh = dogHelm(dSeat[0], dSeat[1], dogPose);
    const k = dh.r / (dh.r + gh.r);
    const px = lerp(dh.x, gh.x, k), py = lerp(dh.y, gh.y, k) - 8;
    const e = 1 - clink; // 0 on the impact frame → 1
    // biggest ON the beat frame, then shrinking: flash, a 4-point glint (+ a smaller diagonal one), "tink" ticks
    glow(ctx, px, py, 60 + 60 * clink, '#ffffff', 0.8 * clink);
    sparkle(ctx, px, py, 14 + 44 * clink, '#ffffff', Math.min(1, 1.4 * clink));
    ctx.save();
    ctx.translate(px, py); ctx.rotate(Math.PI / 4);
    sparkle(ctx, 0, 0, 8 + 22 * clink, '#fff6c0', clink);
    ctx.restore();
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#fffbe8'; ctx.globalAlpha *= clamp(clink * 1.2);
    ctx.lineWidth = 2 + 4 * clink;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.52;
      const r0 = 30 + 55 * ease.outCubic(e), r1 = r0 + 26 * clink + 6;
      ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
  }

  // tethers: harness → eye-bolt
  const ring = rotAbout([dSeat[0], dSeat[1] - 106 * CS * dogPose.squash], dSeat, dogPose.tilt);
  const ga = girlAnchors(gSeat[0], gSeat[1], CS, girlPose);
  const pack = [lerp(ga.neck[0], ga.hip[0], 0.82), lerp(ga.neck[1], ga.hip[1], 0.82)];
  tether(ctx, ring, bolt, t, PAL.red, 1);
  tether(ctx, pack, bolt, t, PAL.orange, 2);
}

// ---------------------------------------------------------------- the scene
export default {
  id: 's12_stars',
  start: 60.139,
  end: 69.74,
  transition: { type: 'fade', dur: 0.6 },
  draw(ctx, t) {
    const cam = camAt(t);
    // ---- deep sky: coasting — the stars stream past early on, calming to a slow drift ----
    const cd = coast(t), m = camMed(t), fo = flyOff(t);
    spaceBg(ctx, {
      t, hue: 'violet', seed: 12, stars: 420, nebula: 0.6,
      driftX: -cd * 1.3 + (m.x - 960) * 0.3 - fo[0] * 0.3, driftY: -cd * 0.85 + (m.y - 540) * 0.3 - fo[1] * 0.3,
    });
    // ---- sky pictures: gentle parallax against the camera ----
    camera(ctx, skyCam(t), () => drawSky(ctx, t));
    // ---- the ringed planet, receding low-left (bar 25 only) ----
    planetBehind(ctx, t);
    // ---- rocket + crew ----
    camera(ctx, cam, () => drawForeground(ctx, t, cam));
    // ---- lyrics, high in the sky between the two pictures ----
    drawLyric(ctx, t, LYRICS.stars1, W / 2, 100, { size: 74 });
    // line 2 would still be fading at the hard cut (its own fade runs to 70.0) — finish it just before the cut
    ctx.save();
    ctx.globalAlpha *= 1 - ease.inOutSine(clamp((t - (T_OUT - 0.5)) / 0.46));
    drawLyric(ctx, t, LYRICS.stars2, W / 2, 100, { size: 74 });
    ctx.restore();
  },
};
