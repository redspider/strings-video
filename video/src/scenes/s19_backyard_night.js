// s19 — Backyard, night (bars 48–51, 115.34 → 124.94). Gentle guitar outro.
//
//   A  bar 48  115.34  the S.S. Biscuit sinks out of the night sky under its three chutes (match-dissolve from s18),
//                      swinging like a pendulum on the beat; the camera tilts down with it, the lit yard rises into view.
//              116.54  landing legs clunk out (b3)
//   B  bar 49  117.74  TOUCHDOWN beside the old crater: squash, dust ring, shake; the crew wince in the portholes;
//                      the camera pushes in on the hatch
//              118.34  hatch pops open → Juno (cheering) + Biscuit rise into the warm doorway
//              118.94  Biscuit leaps out … 119.54 lands (puff) and barks up at Juno, who leaps after him
//   C  bar 50  120.14  cut: top-down on the picnic blanket (helmets off), the camera craning up
//              120.74  Biscuit wriggles in close (a little heart pops; Juno glances over, blushing)
//              121.34  Juno's arm goes round him
//              121.94  tilt-up (0.6 s): the lawn slides away and the sky follows it in …
//   D  bar 51  122.54  … their view: the constellations they made (heart / Biscuit / Juno); stars flash on guitar
//                      plucks; their heads pop up into the bottom of frame
//              122.84  Juno points at the baby star · 123.14 it winks back · Biscuit cocks his head
//   E          123.74  cut: insert on the blanket — Biscuit dozing ("z"), scrunches up (anticipation) …
//              124.04  … and s-t-r-e-t-c-h-e-s, flopping onto the old remote (guitar pluck) — click! "!" — the fuse fizzes
//              124.34  WHOOSH — the bottle rocket whistles up out of frame (camera tilts after it) → s20 bursts on 124.94
import { W, H, INK, LW, PAL, FONT, camera, shake, glow, sparkle, smokePuff, circlePath, ellipsePath, ink, starfield, cartoonText, cloud } from '../draw.js';
import { TAU, clamp, lerp, ease, keyframes, hash01, noise1, mixColor, rgba, smoothstep, wobble } from '../util.js';
import { barTime, sway, GUITAR } from '../timing.js';
import { drawBackyard, drawLawnTopDown, todTint, tintColor } from '../props/backyard.js';
import { drawRocket, ROCKET_HATCH } from '../props/rockets.js';
import { drawGirl, drawFishbowl } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';
import { remote, fireworkRocket } from '../props/items.js';
import { constellation, placeConstellation, drawBabyStar } from '../props/space.js';

// ---------------------------------------------------------------- beat grid
export const T_START = barTime(48); // 115.343 descent (fade in from the re-entry)
const T_LEGS = barTime(48, 2); // 116.543 landing legs out
const T_TOUCH = barTime(49); // 117.743 touchdown
const T_HATCH = barTime(49, 1); // 118.343 hatch pops
const T_DOG_JUMP = barTime(49, 2); // 118.943 Biscuit leaps out
const T_DOG_LAND = barTime(49, 3); // 119.543 Biscuit lands, Juno leaps
const T_BLANKET = barTime(50); // 120.143 cut: top-down blanket
const T_SNUGGLE = barTime(50, 1); // 120.743 Biscuit wriggles in
const T_HUG = barTime(50, 2); // 121.343 Juno's arm round him
const T_DISSOLVE = barTime(50, 3); // 121.943 dissolve to the sky begins
const T_SKY = barTime(51); // 122.543 sky fully in
const T_POINT = barTime(51, 0.5); // 122.843 Juno points at the baby star
const T_WINK = barTime(51, 1); // 123.143 it winks
const T_INSERT = barTime(51, 2); // 123.743 cut: insert on the remote
export const T_BUMP = barTime(51, 2.5); // 124.043 paws hit the remote (guitar pluck 124.06)
export const T_LAUNCH = barTime(51, 3); // 124.343 firework launches
export const T_END = barTime(52); // 124.943 final drum hit → s20

// ---------------------------------------------------------------- layout (backyard world coords)
const GY = 860;
const RS = 0.84; // S.S. Biscuit scale (AD scale contract)
const CS = 0.42; // character scale in the yard wides
const LEG_LIFT = 64 * RS;
export const NIGHT = todTint('night');
const LIGHT_ROCKET = { ...NIGHT, k: 0.72 };
const LIGHT_CHAR = { ...NIGHT, k: 0.62 };
const DUST = '#626b98', DUST_SH = '#4b5280';
// Shared with s20 (same yard, same props).
export const YARD = {
  rocketX: 1540,
  blanket: { x0: 690, x1: 950, yBack: 873, yFront: 905 },
  dog: [786, 894], // Biscuit dozing on the blanket (insert)
  remote: [866, 897], // the old launch remote, lying on the blanket
  bottle: [990, 893], // bottle rocket standing in a pop bottle on the grass
  bottleS: CS,
  fwOrigin: -118, // firework stick bottom, bottle-local (s = 1)
};
// hatch doorway in world coords once landed (legs out)
const DOOR = {
  x: YARD.rocketX + ROCKET_HATCH.x * RS,
  sill: GY - LEG_LIFT + ROCKET_HATCH.sillY * RS,
  top: GY - LEG_LIFT + ROCKET_HATCH.topY * RS,
  r: (ROCKET_HATCH.w / 2) * RS,
};

// ---------------------------------------------------------------- small local props
// Side-view picnic blanket lying on the lawn (a foreshortened gingham quad).
export function sideBlanket(ctx, B, light, k = 0.6) {
  const white = tintColor('#fffaf0', light, k), red = tintColor('#e8453c', light, k * 0.9);
  const hem = mixColor(red, INK, 0.25);
  const BL = [B.x0 + 12, B.yBack], BR = [B.x1 - 12, B.yBack], FL = [B.x0, B.yFront], FR = [B.x1, B.yFront];
  const P = (u, v) => [lerp(lerp(BL[0], BR[0], u), lerp(FL[0], FR[0], u), v), lerp(lerp(BL[1], BR[1], u), lerp(FL[1], FR[1], u), v)];
  const quad = (u0, u1, v0, v1) => {
    const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
    ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
  };
  ctx.save();
  // cloth thickness along the front edge
  ctx.beginPath(); ctx.moveTo(FL[0], FL[1]); ctx.lineTo(FR[0], FR[1]); ctx.lineTo(FR[0] - 2, FR[1] + 5); ctx.lineTo(FL[0] + 2, FL[1] + 5); ctx.closePath();
  ctx.fillStyle = hem; ctx.fill();
  ctx.beginPath(); quad(0, 1, 0, 1); ctx.fillStyle = white; ctx.fill();
  const nC = 11, nR = 3;
  ctx.fillStyle = rgba(red, 0.55);
  ctx.beginPath(); for (let c = 0; c < nC; c += 2) quad(c / nC, (c + 1) / nC, 0, 1); ctx.fill();
  ctx.beginPath(); for (let r = 0; r < nR; r += 2) quad(0, 1, r / nR, (r + 1) / nR); ctx.fill();
  ctx.beginPath(); ctx.moveTo(FL[0], FL[1]); ctx.lineTo(FR[0], FR[1]); ctx.lineTo(FR[0] - 2, FR[1] + 5); ctx.lineTo(FL[0] + 2, FL[1] + 5); ctx.closePath();
  ctx.beginPath(); quad(0, 1, 0, 1); ctx.moveTo(FL[0], FL[1]); ctx.lineTo(FL[0] + 2, FL[1] + 5); ctx.lineTo(FR[0] - 2, FR[1] + 5); ctx.lineTo(FR[0], FR[1]);
  ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
}

// A green glass pop bottle. (x, y) = bottom centre; ~200 px tall at s = 1.
export function popBottle(ctx, x, y, s, light, k = 0.55) {
  const g = tintColor('#6fd3a0', light, k), gs = tintColor('#3f9a70', light, k), lab = tintColor('#fff1d6', light, k);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-30, -8); ctx.quadraticCurveTo(-32, 0, -22, 0); ctx.lineTo(22, 0); ctx.quadraticCurveTo(32, 0, 30, -8);
    ctx.lineTo(32, -112); ctx.bezierCurveTo(32, -142, 13, -146, 12, -170); ctx.lineTo(12, -198);
    ctx.lineTo(-12, -198); ctx.lineTo(-12, -170); ctx.bezierCurveTo(-13, -146, -32, -142, -32, -112); ctx.closePath();
  };
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  path(); ctx.fillStyle = rgba(g, 0.72); ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = rgba(gs, 0.8); ctx.fillRect(12, -210, 26, 212);
  ctx.fillStyle = lab; ctx.fillRect(-34, -96, 70, 44);
  ctx.fillStyle = PAL.red; softStar(ctx, 0, -74, 13, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-24, -138, 7, 36); ctx.fillRect(-24, -44, 7, 30);
  ctx.restore();
  path(); ink(ctx, null, LW);
  ctx.beginPath(); ctx.moveTo(-34, -96); ctx.lineTo(34, -96); ctx.moveTo(-34, -52); ctx.lineTo(34, -52); ctx.lineWidth = LW * 0.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-15, -208, 30, 12, 4) : ctx.rect(-15, -208, 30, 12);
  ink(ctx, g, LW * 0.8);
  ctx.restore();
}
function softStar(ctx, x, y, r1, r2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / 5;
    i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
// Night sky as stepped opaque bands (a full-frame linear gradient costs ~4.5 ms in this Skia build).
export function bandSky(ctx, stops, n = 40, y0 = -60, y1 = H + 60) {
  const col = (u) => {
    let i = 1;
    while (i < stops.length - 1 && u > stops[i][0]) i++;
    const [ua, ca] = stops[i - 1], [ub, cb] = stops[i];
    return mixColor(ca, cb, clamp((u - ua) / Math.max(1e-6, ub - ua)));
  };
  const h = (y1 - y0) / n;
  // Band edges snapped to whole device pixels so the bands tile exactly (no overlap): overlapping
  // strips would show as lines whenever the sky is drawn translucent (the s19 dissolve).
  let snap = (y) => y;
  const m = ctx.getTransform ? ctx.getTransform() : null;
  if (m && Math.abs(m.b) < 1e-9 && Math.abs(m.c) < 1e-9 && m.d > 1e-6) snap = (y) => (Math.round(y * m.d + m.f) - m.f) / m.d;
  for (let k = 0; k < n; k++) {
    const ya = snap(y0 + k * h), yb = snap(y0 + (k + 1) * h);
    if (yb <= ya) continue;
    ctx.fillStyle = col((k + 0.5) / n);
    ctx.fillRect(-60, ya, W + 120, yb - ya);
  }
}
function heartPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.95);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.05, x - r * 0.75, y - r * 1.25, x, y - r * 0.42);
  ctx.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.5, y - r * 0.05, x, y + r * 0.95);
  ctx.closePath();
}

// ---------------------------------------------------------------- firework (shared timing with the insert)
// Height (px at s = 1, local, up = +) the bottle rocket has climbed above its perch at time t.
export function fireworkClimb(t) {
  const d = t - T_LAUNCH - 0.04;
  return d <= 0 ? 0 : 250 * d + 2000 * d * d; // leaves the insert's frame at ~124.8, just before the cut
}
export function fireworkLit(t) {
  if (t < T_BUMP + 0.04) return 0;
  if (t < T_LAUNCH) return 0.3 * clamp((t - T_BUMP - 0.04) / (T_LAUNCH - T_BUMP - 0.04));
  return lerp(0.3, 1, clamp((t - T_LAUNCH) / 0.12));
}
// Bottle + firework, world coords. `detached` draws only what stays (bottle) when the rocket has flown.
function bottleRocket(ctx, t, light, bx = YARD.bottle[0], by = YARD.bottle[1], s = YARD.bottleS) {
  const lit = fireworkLit(t), climb = fireworkClimb(t);
  // launch puff at the bottle mouth
  const pu = (t - T_LAUNCH) / 0.55;
  if (pu > 0 && pu < 1) {
    ctx.save(); ctx.globalAlpha *= 0.8;
    smokePuff(ctx, bx - 4 - 30 * s * pu, by - 212 * s - 60 * s * pu, 34 * s, { seed: 44, u: pu, fill: '#8f98c8', shadeCol: '#6f78aa', lw: 2 + 2.5 * s, n: 4 });
    ctx.restore();
  }
  // ignition spark shower spilling off the bottle mouth
  const su = (t - T_LAUNCH) / 0.55;
  if (su > 0 && su < 1) {
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (hash01(i, 61) - 0.5) * 2.6, v = (90 + 160 * hash01(i, 62)) * s;
      const tt = su * 0.55;
      const px = bx + Math.cos(a) * v * tt, py = by - 212 * s + Math.sin(a) * v * tt + 700 * s * tt * tt;
      sparkle(ctx, px, py, (5 + 7 * hash01(i, 63)) * s * (1 - su), i % 3 ? '#ffd27a' : '#ffffff', 1 - su);
    }
  }
  // firework first (its stick shows through the glass), rocking a little while the fuse fizzes
  const fizz = t > T_BUMP && t < T_LAUNCH + 0.1 ? 0.04 * noise1(t * 30, 5) : 0;
  const lean = climb > 0 ? 0.05 * Math.sin((t - T_LAUNCH) * 9) : fizz;
  ctx.save();
  ctx.translate(bx, by + (YARD.fwOrigin - climb) * s);
  ctx.rotate(lean);
  ctx.scale(s, s);
  if (climb > 0) glow(ctx, -13, -92, 90, '#ffc861', 0.45);
  fireworkLitDraw(ctx, { t, lit, trail: 300 + Math.min(420, climb * 0.6) }, light, 0.5);
  ctx.restore();
  popBottle(ctx, bx, by, s, light);
}

// ---------------------------------------------------------------- shot A/B: the yard, descent + landing
// The backyard's own sky stops at world y = -(SKY_EXT + 700); above it we paint the same night colours
// ourselves. (A skyExtend > 250 would also switch on the backyard's altitude clouds, and one of them sits
// exactly behind the canopies during the descent — the chutes read as "holding a cloud".)
const SKY_EXT = 200;
const SKY_TOP = -(SKY_EXT + 700);
function upperSky(ctx, t, camY, zoom) {
  const y0 = Math.max(-2400, camY - 560 / zoom), y1 = SKY_TOP + 12;
  if (y1 <= y0) return;
  // night skyAt(): '#0a0e34' → high '#090b2c' by 2400 px of altitude (backyard.js)
  const n = Math.max(2, Math.ceil((y1 - y0) / 60));
  for (let k = 0; k < n; k++) {
    const ya = lerp(y0, y1, k / n), yb = lerp(y0, y1, (k + 1) / n);
    ctx.fillStyle = mixColor('#0a0e34', '#090b2c', smoothstep(0, 2400, -(ya + yb) / 2));
    ctx.fillRect(-700, ya - 1, 3300, yb - ya + 2);
  }
  starfield(ctx, { seed: 4819, count: 420, t, x0: -600, y0: -2400, w: 3100, h: 2400 + SKY_TOP, maxR: 3, big: 0.05, color: '#fff8e2' });
  // two hand-placed clouds that drift past the tilt, well clear of the canopies
  for (const [x, y, w, h, seed] of [[380, -1180, 520, 170, 3], [2230, -700, 440, 150, 8], [760, -520, 300, 96, 5]]) {
    cloud(ctx, x + 16 * sway(t, 16), y, w, h, { seed, fill: '#3a4884', shadow: '#262f68', lw: LW });
  }
}
const T_CHUTE18 = barTime(47, 3); // s18: the chutes popped (its swing wobble is still dying away as we take over)
function yardShot(ctx, t) {
  // descent: fins (finY) from high in the sky to the ground, landing with ~30% speed (a soft bump)
  const u = clamp((t - T_START) / (T_TOUCH - T_START));
  const finY = lerp(-360, GY - LEG_LIFT, 0.3 * u + 0.7 * ease.outSine(u));
  const rx = lerp(1600, YARD.rocketX, ease.outSine(u));
  const legs = clamp((t - (T_LEGS - 0.26)) / 0.4);
  const legsE = legs > 0 ? ease.outBack(legs) : 0;
  const damp = 1 - smoothstep(T_TOUCH - 1.3, T_TOUCH - 0.12, t);
  // pendulum under the canopies, tempo-locked — the same swing (and pivot) as s18's last frames, so the
  // match dissolve doesn't double the canopies
  const swingA = (0.13 * wobble(t, T_CHUTE18, 0.8, 1.8) + 0.055 * sway(t, 4)) * damp;
  const pivot = [rx, finY - 1394 * RS];
  const landed = t >= T_TOUCH;
  const lx = t - T_TOUCH;
  const sy = landed ? 1 - 0.13 * Math.exp(-7 * lx) * Math.cos(TAU * 2.3 * lx) : 1;

  // camera: tilt down with the rocket, hold the wide for the touchdown, then push in on the hatch
  // (arriving just before it pops on the beat)
  const camY = keyframes(t, [[T_START, -780], [T_TOUCH - 0.1, 470, ease.inOutSine], [T_TOUCH + 0.1, 470], [T_HATCH - 0.02, 640, ease.inOutCubic], [T_BLANKET, 655, ease.linear]]);
  const camX = keyframes(t, [[T_START, 1000], [T_TOUCH + 0.1, 1000], [T_HATCH - 0.02, 1620, ease.inOutCubic], [T_BLANKET, 1640, ease.linear]]);
  const zoom = keyframes(t, [[T_START, 0.7], [T_TOUCH + 0.1, 0.7], [T_HATCH - 0.02, 1.5, ease.inOutCubic], [T_BLANKET, 1.58, ease.linear]]);
  const sh = shake(t, T_TOUCH, 15, 6);
  const shL = shake(t, T_LEGS, 3, 9);
  // Parallax camera for the far layers: the true camera while s18's match dissolve needs the moon where it
  // put it, then flattened (60 %) so the neighbours' rooftops don't stretch into tall plain blocks when
  // we're high above them.
  const parY = camY + smoothstep(T_START + 0.6, T_START + 1.25, t) * 0.6 * (540 - camY);

  // (no camera roll: a rotated transform doubles the backyard's raster cost)
  camera(ctx, { x: camX, y: camY, zoom, dx: sh.dx + shL.dx, dy: sh.dy + shL.dy }, () => {
    upperSky(ctx, t, camY, zoom);
    drawBackyard(ctx, { t, tod: 'night', crater: true, craterSmoke: 0, pad: 'wrecked', skyExtend: SKY_EXT, camX, camY: parY });
    // the waiting picnic blanket, remote and bottle rocket (payoff in shot E / s20)
    sideBlanket(ctx, YARD.blanket, NIGHT);
    drawRemoteSide(ctx, t, 0, NIGHT);
    bottleRocket(ctx, t, NIGHT);

    // ---- rocket
    if (landed) {
      ctx.save();
      ctx.fillStyle = rgba('#040618', 0.3);
      ellipsePath(ctx, rx + 20, GY + 6, 260 * (2 - sy), 20); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(pivot[0], pivot[1]); ctx.rotate(swingA); ctx.translate(-pivot[0], -pivot[1]);
    ctx.translate(rx, GY); ctx.scale(1 / Math.sqrt(sy), sy); ctx.translate(-rx, -GY);
    const inPorthole = t < T_HATCH + 0.05;
    const wince = landed && lx < 0.35;
    drawRocket(ctx, rx, finY + LEG_LIFT * legsE, RS, {
      t, chute: 1, legs, hatch: hatchOpen(t), light: LIGHT_ROCKET,
      crew: inPorthole,
      crewPose: {
        girl: { t, expr: wince ? 'wince' : landed ? 'laugh' : 'grin', light: LIGHT_CHAR },
        dog: { t, expr: wince ? 'surprised' : 'happy', light: LIGHT_CHAR },
      },
    });
    ctx.restore();
    // clunk sparkles as the legs lock
    const lk = (t - T_LEGS) / 0.3;
    if (lk > 0 && lk < 1) {
      const fy = finY + LEG_LIFT * legsE;
      for (const fx of [-186, 0, 186]) sparkle(ctx, rx + fx * RS - swingA * 1394 * RS, fy - 6, 26 * (1 - lk), '#fff6c0', 1 - lk);
    }
    // touchdown dust ring: already a fat puff on the impact frame, then rolling outward
    if (landed && lx < 1.4) {
      for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
        const pu = clamp(lx / (0.5 + 0.07 * k)); // thinned out by the time the camera arrives at the hatch
        const out = ease.outCubic(clamp(lx / 0.45));
        const px = i === 6 ? rx : rx + side * (110 + 150 * out * (0.8 + 0.45 * k));
        smokePuff(ctx, px, GY - 4 - 6 * k, 36 + 8 * k, { seed: 70 + i, u: 0.14 + 0.85 * pu, fill: DUST, shadeCol: DUST_SH, lw: 3.5, n: 5 });
      }
      // skid lines kicked out along the ground
      const sk = clamp(lx / 0.3);
      if (sk < 1) {
        ctx.save();
        ctx.strokeStyle = rgba('#c9d2ff', 0.8 * (1 - sk)); ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
          const r0 = 230 + 170 * ease.outCubic(sk), y = GY - 18 - j * 26;
          ctx.beginPath(); ctx.moveTo(rx + side * (r0 + j * 20), y); ctx.lineTo(rx + side * (r0 + 90 + j * 20), y - 8 * j); ctx.stroke();
        }
        ctx.restore();
      }
    }
    // ---- crew at the door
    if (t >= T_HATCH + 0.06) crewAtDoor(ctx, t);
  });
}

// the door rattles as someone pushes on it (anticipation), then bangs open starting ON the beat and
// rebounds off its stop (drawRocket eases hatch with inOutSine internally, so it is fed fast here)
function hatchOpen(t) {
  const T0 = T_HATCH - 0.005;
  if (t < T0) {
    const r = clamp((t - (T_HATCH - 0.22)) / 0.2);
    return r <= 0 ? 0 : 0.14 * r * (0.6 + 0.4 * Math.abs(Math.sin((t - T_HATCH) * 60)));
  }
  const u = clamp((t - T0) / 0.1);
  if (u < 1) return lerp(0.14, 1, ease.outQuad(u));
  return 1 - 0.1 * Math.abs(wobble(t, T0 + 0.1, 2.5, 7));
}

// Items have no time-of-day option: multiply the night grade over the remote's box / the firework's body.
function remoteLit(ctx, o, light, k) {
  remote(ctx, o);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= k;
  ctx.fillStyle = light.mul;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-39, -52, 78, 94, 17) : ctx.rect(-39, -52, 78, 94); ctx.fill();
  ctx.restore();
}
function fireworkLitDraw(ctx, o, light, k) {
  fireworkRocket(ctx, o);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha *= k;
  ctx.fillStyle = light.mul;
  ctx.fillRect(-29, -180, 38, 90);
  ctx.restore();
}
// The remote lying on the side-view blanket (foreshortened flat), world coords.
function drawRemoteSide(ctx, t, pressed, light, x = YARD.remote[0], y = YARD.remote[1], s = CS) {
  ctx.save();
  ctx.translate(x, y - 26 * s);
  ctx.rotate(-0.12);
  ctx.scale(s * 1.05, s * 0.58);
  remoteLit(ctx, { pressed, t }, light, 0.55);
  ctx.restore();
}

// Juno + Biscuit in the doorway, then leaping out (world coords).
function crewAtDoor(ctx, t) {
  const appear = ease.outBack(clamp((t - T_HATCH - 0.06) / 0.22), 2);
  // ---- Juno (behind Biscuit)
  const jumpU = clamp((t - T_DOG_LAND) / (T_BLANKET - T_DOG_LAND));
  const jGirl = t >= T_DOG_LAND;
  if (!jGirl) {
    ctx.save();
    sillClip(ctx);
    const crouch = clamp((t - (T_DOG_LAND - 0.2)) / 0.2);
    const cheer = t < T_DOG_JUMP - 0.1;
    drawGirl(ctx, DOOR.x - 6, DOOR.sill + (1 - appear) * 40, CS, {
      t, suit: 'space', helmet: 0, facing: 0.35, stance: crouch > 0 ? 'crouch' : 'stand',
      expr: cheer ? 'laugh' : 'happy',
      armL: cheer ? 'cheer' : 'down', armR: cheer ? 'cheer' : 'wave',
      look: cheer ? [0, 0] : [0.6, 0.7],
      squash: 1 - 0.12 * crouch, light: LIGHT_CHAR,
    });
    ctx.restore();
  } else {
    // she leaps out of the door side (screen-right, away from the hull) to land beside Biscuit on the cut
    const [x0, y0] = [DOOR.x - 6, DOOR.sill], [x1, y1] = [1712, 962];
    const x = lerp(x0, x1, ease.inOutSine(jumpU)), y = lerp(y0, y1, jumpU) - 170 * 4 * jumpU * (1 - jumpU);
    const s = lerp(CS, 0.47, jumpU);
    ctx.save();
    ctx.fillStyle = rgba('#040618', 0.25 * jumpU);
    ellipsePath(ctx, x1, y1, 50 * jumpU, 10); ctx.fill();
    ctx.restore();
    drawGirl(ctx, x, y, s, {
      t, suit: 'space', helmet: 0, facing: 0.5, stance: 'jump', expr: 'laugh', armL: 'cheer', armR: 'cheer',
      tilt: 0.18 * Math.sin(jumpU * Math.PI), squash: 1 + 0.08 * Math.sin(jumpU * Math.PI), light: LIGHT_CHAR,
    });
  }
  // ---- Biscuit
  const du = clamp((t - T_DOG_JUMP) / (T_DOG_LAND - T_DOG_JUMP));
  const [dx0, dy0] = [DOOR.x + 10, DOOR.sill], [dx1, dy1] = [1850, 948];
  if (t < T_DOG_JUMP) {
    ctx.save();
    sillClip(ctx);
    const crouch = clamp((t - (T_DOG_JUMP - 0.2)) / 0.2);
    drawDog(ctx, dx0, dy0 + (1 - appear) * 30, CS, {
      t, stance: 'stand', suit: 'space', helmet: 0, expr: 'excited', wag: 1.2,
      squash: 1 - 0.2 * ease.inQuad(crouch), light: LIGHT_CHAR,
    });
    ctx.restore();
  } else if (t < T_DOG_LAND) {
    const x = lerp(dx0, dx1, du), y = lerp(dy0, dy1, du) - 230 * 4 * du * (1 - du);
    const s = lerp(CS, 0.46, du);
    ctx.save();
    ctx.fillStyle = rgba('#040618', 0.25 * du);
    ellipsePath(ctx, dx1, dy1, 40 * du, 8); ctx.fill();
    ctx.restore();
    drawDog(ctx, x, y, s, {
      t, stance: 'jump', suit: 'space', helmet: 0, expr: 'excited', wag: 1.3,
      tilt: lerp(-0.35, 0.45, du), light: LIGHT_CHAR,
    });
  } else {
    const lx = t - T_DOG_LAND;
    const sq = 1 - 0.28 * Math.exp(-9 * lx) * Math.cos(TAU * 2.2 * lx);
    const bark = clamp((lx - 0.22) / 0.08) * (1 - clamp((lx - 0.42) / 0.1));
    ctx.save();
    ctx.fillStyle = rgba('#040618', 0.28);
    ellipsePath(ctx, dx1, dy1 + 2, 44, 9); ctx.fill();
    ctx.restore();
    drawDog(ctx, dx1, dy1, 0.46, {
      t, stance: 'stand', suit: 'space', helmet: 0, facing: -1, expr: 'excited', wag: 1.4,
      squash: sq, look: [-0.5, -0.8], mouth: bark > 0 ? 0.8 * bark : undefined, light: LIGHT_CHAR,
    });
    if (lx < 0.9) smokePuff(ctx, dx1 + 10, dy1 - 4, 22, { seed: 91, u: lx / 0.9, fill: DUST, shadeCol: DUST_SH, lw: 3, n: 5 });
    if (bark > 0.2) {
      // "woof!" lines
      ctx.save(); ctx.globalAlpha = bark; ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = -2.2 + i * 0.35;
        ctx.beginPath(); ctx.moveTo(dx1 - 40 + Math.cos(a) * 30, dy1 - 90 + Math.sin(a) * 30);
        ctx.lineTo(dx1 - 40 + Math.cos(a) * 52, dy1 - 90 + Math.sin(a) * 52); ctx.stroke();
      }
      ctx.restore();
    }
  }
  // warm light spilling from the doorway as it opens
  const lg = clamp((t - T_HATCH) / 0.2) * (1 - 0.5 * clamp((t - T_HATCH - 0.4) / 0.6));
  glow(ctx, DOOR.x, DOOR.sill - 60, 170, '#ffd98a', 0.28 * lg);
}
// they rise into the doorway from inside: hide what is below the sill
function sillClip(ctx) {
  ctx.beginPath(); ctx.rect(DOOR.x - 400, DOOR.top - 400, 800, DOOR.sill + 3 - (DOOR.top - 400)); ctx.clip();
}

// ---------------------------------------------------------------- shot C: top-down on the blanket
const TD = {
  blanket: { x: 960, y: 560, w: 1180, h: 740, rot: -0.05 },
  girl: { x: 868, y: 820, s: 1.0, rot: -0.08 }, // feet point; she lies head-up in the frame
  dog0: [1150, 470], dog1: [1068, 492], dogS: 1.12,
};
const LIGHT_TD = { ...NIGHT, k: 0.42 };
function topDownShot(ctx, t, sink = 0) {
  const u = clamp((t - T_BLANKET) / (T_SKY - T_BLANKET));
  const zoom = lerp(1.45, 1.12, ease.outSine(u));
  const rot = lerp(0.07, -0.015, ease.inOutSine(u));
  const cx = lerp(950, 975, ease.outSine(u)), cy = lerp(560, 580, ease.outSine(u));
  ctx.save();
  ctx.translate(W / 2, H / 2 + sink); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
  drawLawnTopDown(ctx, { t, blanket: TD.blanket });

  // the old remote, by Biscuit's paws
  ctx.save();
  ctx.translate(1375, 470); ctx.rotate(0.45); ctx.scale(0.95, 0.95);
  contactShadow(ctx, 0, 6, 44, 50);
  remoteLit(ctx, { t }, NIGHT, 0.42);
  ctx.restore();

  // ---- Juno lying on her back, looking up at the sky (= at us)
  const G = TD.girl;
  const hug = ease.inOutCubic(clamp((t - (T_HUG - 0.25)) / 0.4));
  const awe = t > T_DISSOLVE - 0.3;
  // she glances over at Biscuit as he wriggles in, then back up at the sky
  const glance = clamp((t - T_SNUGGLE + 0.1) / 0.15) * (1 - clamp((t - T_HUG - 0.2) / 0.3));
  ctx.save();
  ctx.translate(G.x, G.y); ctx.rotate(G.rot);
  contactShadow(ctx, 8, -205 * G.s, 120 * G.s, 250 * G.s);
  drawGirl(ctx, 0, 0, G.s, {
    t, stance: 'lie', suit: 'space', helmet: 0, facing: 0, expr: awe ? 'awe' : 'happy', look: [lerp(0.05, 0.75, glance), -0.05],
    blush: 0.6 * glance,
    armL: { a: 0.8, b: 0.35, hand: 'open' }, // relaxed on the blanket
    armR: { a: lerp(0.5, 1.5, hug), b: lerp(0.3, 0.75, hug), hand: 'open' },
    light: LIGHT_TD,
  });
  ctx.restore();

  // ---- Biscuit wriggles in close (120.74), curls up against her
  const sn = clamp((t - (T_SNUGGLE - 0.2)) / 0.35);
  const snE = ease.outBack(sn, 1.6);
  const dx = lerp(TD.dog0[0], TD.dog1[0], snE), dy = lerp(TD.dog0[1], TD.dog1[1], snE);
  const wig = sn > 0 && sn < 1 ? 0.12 * Math.sin(sn * Math.PI * 3) : 0;
  const sq = 1 + 0.12 * Math.sin(Math.PI * sn) - 0.06 * Math.exp(-8 * Math.max(0, t - T_SNUGGLE - 0.15)) * (t > T_SNUGGLE + 0.15 ? 1 : 0);
  ctx.save();
  ctx.translate(dx, dy); ctx.rotate(-0.35 + wig);
  contactShadow(ctx, 6, -30, 95, 50);
  drawDog(ctx, 0, 0, TD.dogS, {
    t, stance: 'lie', facing: -1, expr: t < T_SNUGGLE ? 'happy' : 'laugh', suit: 'space', squash: sq, wag: 1,
    light: LIGHT_TD,
  });
  ctx.restore();
  // a little heart floats up when he snuggles in
  const hu = (t - T_SNUGGLE) / 1.3;
  if (hu > 0 && hu < 1) {
    const hs = ease.outBack(clamp(hu / 0.22), 2.5) * (1 - 0.2 * hu);
    const hx = 990 + 18 * Math.sin(hu * 6), hy = 400 - 110 * ease.outCubic(hu);
    ctx.save();
    ctx.globalAlpha *= 1 - clamp((hu - 0.6) / 0.4);
    glow(ctx, hx, hy, 110 * hs, '#ff9ac0', 0.4);
    heartPath(ctx, hx, hy, 40 * hs); ink(ctx, '#ff6f9e', 6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ellipsePath(ctx, hx - 14 * hs, hy - 14 * hs, 9 * hs, 5 * hs, -0.6); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function contactShadow(ctx, x, y, rx, ry) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, 1);
  g.addColorStop(0, 'rgba(4,6,24,0.34)'); g.addColorStop(0.7, 'rgba(4,6,24,0.16)'); g.addColorStop(1, 'rgba(4,6,24,0)');
  ctx.translate(x, y); ctx.scale(rx, ry); ctx.translate(-x, -y);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 1, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- shot D: the sky they made
const SKY = (() => {
  const heart = placeConstellation('heart', 960, 205, 140);
  const dog = placeConstellation('dogFace', 440, 360, 190, -0.12);
  const girl = placeConstellation('girl', 1470, 350, 215, 0.1);
  return { heart, dog, girl, star: [968, 505], starR: 64 };
})();
// A = opacity of the whole sky layer (the C→D dissolve draws it over the lawn). Every shared helper used
// here either multiplies ctx.globalAlpha or takes an explicit alpha option, so a real crossfade works.
function skyShot(ctx, t, A = 1) {
  // their heads pop up into the bottom of frame once the dissolve has landed on the sky
  const headsDown = 380 * (1 - ease.outBack(clamp((t - T_SKY + 0.02) / 0.3), 1.4));
  // tilt: the sky slides down into place through the dissolve, then keeps drifting gently past their heads
  const drift = -90 * (1 - ease.outCubic(clamp((t - T_DISSOLVE) / 0.9))) + 30 * ease.inOutSine(clamp((t - T_SKY) / (T_INSERT - T_SKY)));
  ctx.save();
  ctx.globalAlpha = A;
  bandSky(ctx, [[0, '#050823'], [0.5, '#0e1748'], [0.85, '#1f2d68'], [1, '#2c3e7c']]);
  ctx.translate(0, drift);
  // milky band
  for (let i = 0; i < 5; i++) {
    const k = i / 4;
    glow(ctx, lerp(-60, 1980, k), lerp(760, -80, k) + 60 * Math.sin(k * 4), 300, '#6d7fd6', 0.15);
  }
  starfield(ctx, { seed: 1919, count: 240, t, x0: -20, y0: -120, w: W + 40, h: H + 80, maxR: 2.6, big: 0.05, alpha: 0.9 * A });
  // the three constellations, complete, twinkling (rainbow strings — the motif)
  const cOpts = { t, rainbow: true, lw: 3.4, glow: 1, starSize: 11, vibrate: 0.6, dust: 1, alpha: A };
  constellation(ctx, SKY.heart.pts, 1, { ...cOpts, segments: SKY.heart.segments, hue: 330 });
  constellation(ctx, SKY.dog.pts, 1, { ...cOpts, segments: SKY.dog.segments, hue: 30 });
  constellation(ctx, SKY.girl.pts, 1, { ...cOpts, segments: SKY.girl.segments, hue: 180 });
  ctx.globalAlpha = A;
  // a star flashes on each guitar pluck
  for (let k = 0; k < GUITAR.length; k++) {
    const gt = GUITAR[k];
    if (gt > t || gt < t - 0.6 || gt < T_DISSOLVE) continue;
    const e = Math.exp(-5 * (t - gt));
    const set = [SKY.heart, SKY.dog, SKY.girl][k % 3];
    const p = set.pts[Math.floor(hash01(k, 411) * set.pts.length)];
    glow(ctx, p[0], p[1], 60 * e, '#fff3c4', 0.5 * e);
    sparkle(ctx, p[0], p[1], 34 * e + 6, '#ffffff', e);
  }
  // the baby star, in the middle of the gallery, looking down at them — and winking back ON the beat
  const [sx, sy] = SKY.star, sr = SKY.starR;
  const wk = t < T_WINK - 0.1 ? 0 : t < T_WINK ? ease.inQuad((t - (T_WINK - 0.1)) / 0.1) : t < T_WINK + 0.4 ? 1 : 1 - clamp((t - T_WINK - 0.4) / 0.12);
  const wkPop = t >= T_WINK ? Math.exp(-7 * (t - T_WINK)) : 0;
  drawBabyStar(ctx, sx, sy, sr, { t, expr: 'happy', wink: wk, look: [-0.2, 0.6], rays: 0.5 + 0.5 * wkPop, squash: 1 - 0.12 * wkPop });
  if (wkPop > 0.02) {
    // "ting!" — a ring of tiny sparkles popping off the wink
    const k = 1 - wkPop;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.3, d = sr * (1.3 + 1.3 * ease.outCubic(k));
      sparkle(ctx, sx + Math.cos(a) * d, sy + Math.sin(a) * d, (i % 2 ? 9 : 15) * wkPop + 2, i % 2 ? '#fff3c4' : '#ffffff', wkPop);
    }
  }
  ctx.restore();

  if (headsDown >= 379) return;
  // their heads at the bottom of frame, gazing up (moonlit, leaning together)
  const pt = ease.outBack(clamp((t - (T_POINT - 0.22)) / 0.32), 1.4);
  const nod = t > T_WINK ? 0.05 * Math.exp(-5 * (t - T_WINK)) * Math.sin((t - T_WINK) * 18) : 0;
  drawGirl(ctx, 740, 1140 + headsDown, 1.22, {
    t, view: 'back', stance: 'sit', suit: 'space', helmet: 0, headTilt: 0.12 + nod,
    armR: { a: lerp(0.2, 2.25, pt), b: lerp(0.1, 0.02, pt), hand: pt > 0.5 ? 'point' : 'open' },
    armL: 'down', light: { ...NIGHT, k: 0.85 },
  });
  // Biscuit cocks his head at the winking star ("huh?"), ears up
  const huh = ease.outBack(clamp((t - T_WINK - 0.08) / 0.25), 2);
  drawDog(ctx, 1130, 1128 + headsDown, 1.32, {
    t, view: 'back', stance: 'sit', suit: 'space', look: [-0.2, -1], headTilt: lerp(-0.14, 0.2, huh), ears: lerp(0.3, 1, huh),
    light: { ...NIGHT, k: 0.85 },
  });
  const q = clamp((t - T_WINK - 0.12) / 0.2);
  if (q > 0) {
    cartoonText(ctx, '?', 1238, 800 + headsDown - 16 * ease.outCubic(q), {
      size: 92, fill: '#fffaf0', scale: ease.outBack(q, 2.4), rot: 0.2, font: FONT.hand, lw: 10,
      alpha: 1 - clamp((t - (T_INSERT - 0.18)) / 0.15),
    });
  }
}

// ---------------------------------------------------------------- shot E: the insert — stretch, click, whoosh
// Screen-space foreground layer (closer to camera than the yard behind it, so bigger).
const INS = {
  blanket: { x0: -140, x1: 1720, yBack: 790, yFront: 1075 },
  dog: [470, 990], dogS: 2.2,
  remote: [880, 1002], remoteS: 1.7,
  helmet: [110, 968], helmetR: 128,
  bottle: [1335, 1008], bottleS: 1.55,
};
function insertShot(ctx, t) {
  const lt = t - T_INSERT;
  // after the launch the camera tilts up a little after the rocket — but keeps Biscuit's face in frame
  const launch = ease.inOutSine(clamp((t - T_LAUNCH - 0.05) / (T_END - T_LAUNCH - 0.05)));
  const bgY = lerp(795, 772, launch), fgDy = lerp(0, 56, launch);
  const sh = shake(t, T_BUMP, 8, 9), sh2 = shake(t, T_LAUNCH, 10, 7);
  const dx = sh.dx + sh2.dx, dy = sh.dy + sh2.dy;
  camera(ctx, { x: 700 + 16 * ease.inOutSine(clamp(lt / 1.2)), y: bgY, zoom: 2.4, dx: dx * 0.6, dy: dy * 0.6 }, () => {
    drawBackyard(ctx, { t, tod: 'night', crater: true, craterSmoke: 0, pad: 'wrecked', camX: 700, camY: bgY });
  });
  ctx.save();
  ctx.translate(dx, fgDy + dy);
  sideBlanket(ctx, INS.blanket, NIGHT, 0.55);
  // Biscuit's helmet, set down on the blanket
  const [hx, hy] = INS.helmet, hr = INS.helmetR;
  contactShadow(ctx, hx + 8, hy + 2, hr * 0.8, hr * 0.14);
  drawFishbowl(ctx, hx, hy - hr * 1.04, hr, {
    lw: LW, glass: tintColor('#c4e8ff', NIGHT, 0.45), edge: tintColor('#96cdff', NIGHT, 0.45),
    ring: tintColor('#ff8a3d', NIGHT, 0.5), ringShade: tintColor('#d9662a', NIGHT, 0.5),
  });
  // the old remote, lying just in front of his nose; it jolts when he flops onto it
  const [rx, ry] = INS.remote;
  const kb = t - T_BUMP;
  const hopY = kb >= 0 ? -26 * Math.sin(Math.PI * clamp(kb / 0.16)) : 0;
  const rRot = kb >= 0 ? 0.16 * wobble(t, T_BUMP, 3, 7) : 0;
  const pressed = kb < 0 ? 0 : 1;
  contactShadow(ctx, rx + 4, ry + 2, 74 * (1 + hopY / 120), 13);
  ctx.save();
  ctx.translate(rx, ry); ctx.rotate(rRot); ctx.translate(-rx, -ry);
  drawRemoteSide(ctx, t, pressed, NIGHT, rx, ry + hopY, INS.remoteS);
  ctx.restore();
  bottleRocket(ctx, t, NIGHT, INS.bottle[0], INS.bottle[1], INS.bottleS);

  // Biscuit: dozing → scrunch (anticipation) → STRETCH onto the remote → eyes pop → watches it go
  const [x, y] = INS.dog;
  const pre = clamp((t - (T_BUMP - 0.3)) / 0.3); // scrunch up
  const hit = t >= T_BUMP;
  let sq = 1, ox = 0;
  if (!hit) { sq = 1 + 0.14 * ease.inOutSine(pre); ox = -22 * ease.inOutSine(pre); }
  else {
    const rec = 1 - Math.exp(-4 * Math.max(0, kb - 0.12)) * Math.cos(TAU * 1.4 * Math.max(0, kb - 0.12));
    sq = lerp(0.78, 1, clamp(rec)); ox = 60 * (1 - clamp(rec));
  }
  const awake = hit && kb > 0.1;
  const looking = t >= T_LAUNCH;
  const up = ease.inOutSine(clamp((t - T_LAUNCH) / 0.35));
  contactShadow(ctx, x + 14, y + 2, 210, 24);
  drawDog(ctx, x + ox, y, INS.dogS, {
    t, stance: 'lie', facing: 1, suit: 'space',
    expr: !awake ? 'sleepy' : looking ? 'awe' : 'surprised',
    ears: awake ? 1 : undefined,
    look: looking ? [lerp(1, 0.55, up), lerp(0.1, -1, up)] : awake ? [1, 0.2] : undefined,
    headTilt: looking ? -0.12 * up : 0,
    exclaim: awake && !looking ? clamp((kb - 0.1) / 0.12) : 0,
    squash: sq, light: { ...NIGHT, k: 0.55 },
  });
  if (hit) {
    // the LED goes red, and "click!"
    glow(ctx, rx - 34, ry - 66 + hopY, 90, '#ff6b6b', 0.55 * (0.7 + 0.3 * Math.sin(t * 40)));
    if (kb < 0.55) {
      const a = 1 - clamp((kb - 0.35) / 0.2);
      cartoonText(ctx, 'click!', rx + 110, ry - 150 - 36 * ease.outCubic(kb / 0.55), {
        size: 76, fill: '#fffaf0', alpha: a, scale: ease.outBack(clamp(kb / 0.12), 2.5), rot: -0.14, font: FONT.hand, lw: 9,
      });
      // click lines off the button
      if (kb < 0.25) {
        const k = kb / 0.25;
        ctx.save(); ctx.strokeStyle = rgba('#fffaf0', 1 - k); ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const ang = -Math.PI / 2 + (i - 1.5) * 0.45, r0 = 50 + 40 * ease.outCubic(k);
          ctx.beginPath(); ctx.moveTo(rx + Math.cos(ang) * r0, ry - 40 + Math.sin(ang) * r0);
          ctx.lineTo(rx + Math.cos(ang) * (r0 + 26), ry - 40 + Math.sin(ang) * (r0 + 26)); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  // snore "z"s while he dozes
  if (!hit) {
    for (let i = 0; i < 3; i++) {
      const zu = ((lt + i * 0.2) / 0.6) % 1;
      const a = Math.sin(Math.PI * zu) * (1 - pre);
      cartoonText(ctx, 'z', x + 150 + 46 * zu + i * 10, y - 190 - 120 * zu, { size: 48 + 14 * (i % 2), fill: '#fffaf0', alpha: a, lw: 7, font: FONT.hand, shadow: false });
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- draw
export default {
  id: 's19_backyard_night',
  start: 115.343,
  end: 124.943,
  transition: { type: 'fade', dur: 0.6 },
  draw(ctx, t) {
    if (t < T_BLANKET) {
      yardShot(ctx, t);
    } else if (t < T_DISSOLVE) {
      topDownShot(ctx, t);
    } else if (t < T_SKY) {
      // dissolve (one beat) from the blanket to what they are looking at: the lawn keeps craning away and
      // sinks as we tilt up, the sky with their constellations slides down over it
      const e = ease.inOutSine(clamp((t - T_DISSOLVE) / (T_SKY - T_DISSOLVE)));
      topDownShot(ctx, t, 140 * e * e);
      skyShot(ctx, t, e);
    } else if (t < T_INSERT) {
      skyShot(ctx, t);
    } else {
      insertShot(ctx, Math.min(t, T_END + 1.5));
    }
  },
};
