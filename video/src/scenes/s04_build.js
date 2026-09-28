// s04_build — bars 8–11 (19.34 → 28.94). Drums in! Workshop montage: one shot per bar, whip-pans
// between shots (handled here), every hit / burst / stroke on a beat.
//
//  A  bar 8  (19.34) HAMMER — Juno on a crate hammers the rocket frame; the hammer lands on every
//            beat (19.34 20.54 19.94 21.14) with a star "TINK!" spark, and each hit zips a new band of
//            riveted panels up the frame (frame → panels). Biscuit bobs along holding the nail box.
//  B  bar 9  (21.74) WELD — close & low: goggles down, torch on the fin seam; spark bursts on every
//            beat, BIG on the snares (22.34, 23.54) with a blue-white flash; Biscuit in tiny goggles
//            flinches on the snares.
//  C  bar 10 (24.14) PAINT — Juno on the stepladder: one red part per beat (left fin, band, right
//            fin, nose) with a paint splat; Biscuit dips a paw in the can on b3 (25.34) and
//            high-fives the hull on b4 (25.94) — the paw-print decal.
//  D  bar 11 (26.54) REVEAL — outside the barn at golden hour: the door rolls up (26.54 → 27.14),
//            the finished S.S. BISCUIT rolls out on its dolly and stops on b3 (27.74); Juno and
//            Biscuit pop out from behind the fins; Juno SLAPS a star sticker on the fin on b4 (28.34),
//            a glint runs up the hull and "tings" a second sticker onto the nose; Biscuit WOOFs.
//  Whip-pans: 0.26 s ending exactly on each downbeat (the new shot lands on the beat with a jolt).
import {
  W, H, INK, LW, PAL, FONT, camera, shake, cartoonText, glow, sparkle, cartoonStar, groundShadow, circle,
  rrect, ink, ellipsePath, circlePath, rrectPath, line,
} from '../draw.js';
import { barTime, beatAt, SPB, pulse, sway, hop } from '../timing.js';
import { clamp, lerp, ease, keyframes, hash01, noise1, rgba, mixColor, TAU, wobble } from '../util.js';
import {
  drawWorkshop, WORKSHOP, drawStepladder, STEPLADDER, drawPaintCan, drawBackyard, drawGarageDoor, BACKYARD,
  todTint, longShadow,
} from '../props/backyard.js';
import { drawRocket } from '../props/rockets.js';
import { hammer, weldTorch, TORCH_TIP, TORCH_DIR, paintbrush, nailBox, starSticker } from '../props/items.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';

// ---------------------------------------------------------------- beat grid
const bt = (k, j = 0) => barTime(k, j);
const S_A = bt(8), S_B = bt(9), S_C = bt(10), S_D = bt(11), S_END = bt(12);
const LEAD = 1 / 60; // visual hits land half a frame early → the nearest 30 fps frame shows the impact
const hitT = (k, j) => bt(k, j) - LEAD;
const beatsOf = (k) => [0, 1, 2, 3].map((j) => hitT(k, j));
// seconds since the most recent hit in list (−1 if none yet)
function since(t, hits) {
  let d = -1;
  for (const h of hits) if (t >= h) d = t - h;
  return d;
}
function lastIdx(t, hits) {
  let k = -1;
  for (let i = 0; i < hits.length; i++) if (t >= hits[i]) k = i;
  return k;
}

// ---------------------------------------------------------------- set & scale
const RS = 0.85; // rocket scale in the workshop (≈ 2 × character scale, per the scale contract)
const CS = 0.45; // Juno / Biscuit
const RX = WORKSHOP.buildX, FY = WORKSHOP.floorY;
const WARM = { mul: '#fff0da', add: '#ffb45c', addAmt: 0.05 }; // bulb-lit interior grade

// S.S. Biscuit hull half-width (copy of the rockets.js profile, local units, y up = negative)
const PROF = [[0, 74], [0.05, 97], [0.13, 120], [0.26, 136], [0.4, 141], [0.52, 138], [0.63, 127], [0.72, 109],
  [0.8, 87], [0.87, 63], [0.93, 38], [0.975, 16], [1, 0]];
function hwAtV(v) {
  v = clamp(v);
  let i = 0;
  while (i < PROF.length - 2 && v > PROF[i + 1][0]) i++;
  const p0 = PROF[Math.max(0, i - 1)], p1 = PROF[i], p2 = PROF[i + 1], p3 = PROF[Math.min(PROF.length - 1, i + 2)];
  const u = (v - p1[0]) / (p2[0] - p1[0]);
  const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * (p2[0] - p1[0]);
  const m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * (p2[0] - p1[0]);
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1[1] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[1] + (u3 - u2) * m2;
}
const hwY = (y) => Math.max(0, hwAtV((y + 84) / -636));
const E = 0.1;
const cyl = (y, th) => { const h = hwY(y); return [h * Math.sin(th), y + E * h * Math.cos(th)]; };

// device-space capture of a point in the current local frame (pure: used within one draw call)
function devPt(ctx, x, y) { const m = ctx.getTransform(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
function fromDev(ctx, p) {
  const m = ctx.getTransform().inverse();
  return [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
}

// ---------------------------------------------------------------- small local props / FX
function drawCrate(ctx, cx, by, w, h, label = 'NUTS & BOLTS') {
  const x = cx - w / 2, y = by - h;
  ctx.save();
  rrect(ctx, x, y, w, h, 6, '#d69a5c', LW * 0.8);
  ctx.fillStyle = '#b87c44'; ctx.fillRect(x + w - 22, y + 4, 18, h - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 10, y + 8, w * 0.5, 5);
  ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 3;
  for (const f of [0.34, 0.67]) { ctx.beginPath(); ctx.moveTo(x + 4, y + h * f); ctx.lineTo(x + w - 4, y + h * f); ctx.stroke(); }
  // corner battens + brace
  ctx.lineWidth = LW * 0.6; ctx.strokeStyle = INK;
  rrect(ctx, x, y, 16, h, 4, '#c58a4f', LW * 0.6);
  rrect(ctx, x + w - 16, y, 16, h, 4, '#a86f3c', LW * 0.6);
  ctx.save(); ctx.globalAlpha *= 0.85;
  // stencil label, fitted between the corner battens
  let fs = Math.round(h * 0.16);
  ctx.font = `bold ${fs}px ${FONT.round}`;
  const tw = ctx.measureText(label).width, room = w - 44;
  if (tw > room) { fs = Math.floor((fs * room) / tw); ctx.font = `bold ${fs}px ${FONT.round}`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#9a3b2c'; ctx.fillText(label, cx, y + h * 0.5);
  ctx.restore();
  ctx.restore();
}

// "TINK!" hammer spark: star pop, radial sparks away from the hull (hull to the right), word
const TINK_WORDS = ['TINK!', 'TONK!', 'TINK!', 'CLANK!'];
function tinkSpark(ctx, x, y, d, i) {
  if (d < 0 || d > 0.5) return;
  const u = d / 0.5;
  glow(ctx, x, y, 110 * (1 - 0.4 * u), '#fff3b0', 0.95 * (1 - u) * (1 - u));
  ctx.save(); ctx.lineCap = 'round';
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * (0.52 + (0.96 * k) / 7) + (hash01(k, i + 3) - 0.5) * 0.3;
    const r0 = 12 + 80 * ease.outCubic(u) * (0.7 + 0.5 * hash01(k, i + 9));
    const len = 38 * (1 - u) + 4;
    ctx.strokeStyle = k % 2 ? '#fff6c0' : PAL.yellow;
    ctx.lineWidth = 6 * (1 - u) + 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
  ctx.restore();
  const k = ease.outBack(clamp(u * 5), 3) * (1 - ease.inCubic(clamp((u - 0.35) / 0.65)));
  if (k > 0.01) cartoonStar(ctx, x - 4, y - 2, 24 * k, PAL.yellow, 3.5, -Math.PI / 2 + u * 2.5);
  sparkle(ctx, x, y, 46 * (1 - u), '#ffffff', 1 - u);
  const wk = clamp(u * 4.5);
  cartoonText(ctx, TINK_WORDS[i % 4], x - 150 - 26 * u, y - 96 - 30 * u, {
    size: 40, fill: i === 3 ? PAL.yellow : '#fff6d8', lw: 7, scale: ease.outBack(wk, 2.6) * (i === 3 ? 1.15 : 1),
    alpha: 1 - clamp((u - 0.6) / 0.4), rot: -0.2 + 0.12 * (i % 2),
  });
}

// ---------------------------------------------------------------- rocket helpers (workshop)
// clip to the part of the rocket below a panel seam at local y `cut` (seam bulges down like the hull bands)
function seamPath(ctx, x0, y0, s, cut, dir) {
  const hw = hwY(Math.min(-90, cut)) * s + 1;
  const yc = y0 + cut * s;
  const bulge = E * hw;
  const L = x0 - 320 * s, R = x0 + 320 * s;
  if (dir > 0) { ctx.lineTo(L, yc); ctx.lineTo(x0 - hw, yc); ctx.quadraticCurveTo(x0, yc + 2 * bulge, x0 + hw, yc); ctx.lineTo(R, yc); }
  else { ctx.lineTo(R, yc); ctx.lineTo(x0 + hw, yc); ctx.quadraticCurveTo(x0, yc + 2 * bulge, x0 - hw, yc); ctx.lineTo(L, yc); }
}
function clipBand(ctx, x0, y0, s, top, bot) {
  ctx.beginPath();
  if (bot === null) { ctx.moveTo(x0 - 320 * s, y0 + 60); seamPath(ctx, x0, y0, s, top, 1); ctx.lineTo(x0 + 320 * s, y0 + 60); }
  else { const yb = y0 + bot * s; ctx.moveTo(x0 - 320 * s, yb); seamPath(ctx, x0, y0, s, top, 1); seamPath(ctx, x0, y0, s, bot, -1); }
  ctx.closePath();
  ctx.clip();
}
function seamLine(ctx, x0, y0, s, cut, lw = 4) {
  const hw = hwY(cut) * s;
  if (hw < 2) return;
  const yc = y0 + cut * s;
  ctx.beginPath(); ctx.moveTo(x0 - hw, yc); ctx.quadraticCurveTo(x0, yc + 2 * E * hw, x0 + hw, yc);
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
}
// paw-print decal exactly where the finished rocket has it (cyl(-138, -0.62)), in rocket-local units
function pawDecal(ctx, x0, y0, s, k = 1, col = PAL.red) {
  const pth = -0.62, [ppx, ppy] = cyl(-138, pth);
  ctx.save();
  ctx.translate(x0, y0); ctx.scale(s, s);
  ctx.translate(ppx, ppy); ctx.rotate(-0.25); ctx.scale(Math.cos(pth) * 1.05 * k, 1.05 * k);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-18, 10);
  ctx.bezierCurveTo(-22, -8, 22, -8, 18, 10); ctx.bezierCurveTo(15, 20, -15, 20, -18, 10); ctx.fill();
  for (const [bx, by, br] of [[-19, -12, 6.5], [-7, -22, 7], [7, -22, 7], [19, -12, 6.5]]) { ellipsePath(ctx, bx, by, br * 0.85, br, 0); ctx.fill(); }
  ctx.restore();
}
const PAW_AT = (x0, y0, s) => { const [px, py] = cyl(-138, -0.62); return [x0 + px * s, y0 + py * s]; };

// ================================================================= SHOT A — hammer (bar 8)
const A_HITS = beatsOf(8);
const A_CRATE = { x: 752, w: 156, h: 120 };
const A_JUNO = [772, FY - A_CRATE.h];
const A_DOG = [588, FY];
const A_CUTS = [-332, -446, -560, -760]; // panel seam after each hit (local y)
const HAM_S = 0.8;
const A_IMP = { a: 1.36, w: 0.2 };
// where the hammer face meets the frame at impact (analytic: the hand frame's +x = forearm direction)
const A_CONTACT = (() => {
  const pose = { facing: 1, armR: { a: A_IMP.a, b: 0 }, tilt: 0.07, squash: 0.95 };
  const an = girlAnchors(A_JUNO[0], A_JUNO[1], CS, pose);
  const th = Math.atan2(an.handR[1] - an.shoulderR[1], an.handR[0] - an.shoulderR[0]) + A_IMP.w;
  const fx = 40 * HAM_S, fy = -92 * HAM_S;
  return [an.handR[0] + (fx * Math.cos(th) - fy * Math.sin(th)) * CS, an.handR[1] + (fx * Math.sin(th) + fy * Math.cos(th)) * CS];
})();

// panel band zips up ON each hit (the hammer causes it): ~3 frames, outCubic
const ZIP = 0.12;
function aCut(t) {
  let y = 40;
  for (let j = 0; j < 4; j++) {
    const u = clamp((t - A_HITS[j]) / ZIP);
    y = lerp(y, A_CUTS[j], ease.outCubic(u));
  }
  return y;
}
function hammerPose(t) {
  // overhead chop: recoil → raise the hammer high above the head (hammer pointing skyward, so it
  // never crosses her face) → a little extra cock-back → CHOP down to the impact pose on the beat.
  // Hammer-head direction on screen = w - (a + b).
  const b = beatAt(t + LEAD) - beatAt(S_A);
  const p = b - Math.floor(b); // 0 = impact
  const K = [ // [phase, a, b, w, easeInto]
    [0, A_IMP.a, 0, A_IMP.w],
    [0.1, 1.55, -0.03, 0.1, ease.outQuad], // recoil bounce off the hull
    [0.55, 2.7, -0.1, 1.3, ease.inOutSine], // raised high
    [0.76, 2.86, -0.16, 1.5, ease.outQuad], // cock back (anticipation)
    [1, A_IMP.a, 0, A_IMP.w, ease.inQuad], // CHOP
  ];
  let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
  const [p0, a0, b0, w0] = K[i], [p1, a1, b1, w1, e1] = K[i + 1];
  const e = e1(clamp((p - p0) / (p1 - p0)));
  const imp = Math.exp(-16 * p);
  const up = clamp((p - 0.3) / 0.46) * (p < 0.76 ? 1 : 1 - ease.inQuad(clamp((p - 0.76) / 0.24)));
  const tilt = 0.08 * imp - 0.06 * up;
  return {
    a: lerp(a0, a1, e), b: lerp(b0, b1, e), w: lerp(w0, w1, e), tilt, squash: 1 - 0.06 * imp + 0.03 * up,
    chop: p > 0.76 ? (p - 0.76) / 0.24 : 0, // 0..1 during the down-swing (for the smear)
  };
}
function camA(t) {
  // close on Juno, then pull back & tilt up as the panels zip up to the nose (hit 4 = the reveal)
  const u = ease.inOutSine(clamp((t - S_A) / (A_HITS[3] + 0.1 - S_A)));
  const d = since(t, A_HITS);
  const punch = d >= 0 ? 0.016 * Math.exp(-12 * d) : 0;
  return { x: lerp(790, 858, u), y: lerp(772, 668, u), zoom: lerp(2.05, 1.42, u) * (1 + punch) };
}
function shotA(ctx, t) {
  camera(ctx, camA(t), () => {
    drawWorkshop(ctx, { t, bulb: 1 });
    // rocket: the frame, with panels zipping up band by band on each hit
    drawRocket(ctx, RX, FY, RS, { t, build: 'frame', light: WARM });
    const cut = aCut(t);
    if (cut < 30) {
      ctx.save(); clipBand(ctx, RX, FY, RS, cut, null);
      drawRocket(ctx, RX, FY, RS, { t, build: 'panels', light: WARM });
      ctx.restore();
      // white-hot flash on the newest band
      const k = lastIdx(t, A_HITS);
      const d = k >= 0 ? t - A_HITS[k] : 9;
      if (k >= 0 && d < 0.3) {
        // (cheap: a white fill clipped to the new band ∩ the hull silhouette, no third rocket draw)
        ctx.save();
        clipBand(ctx, RX, FY, RS, cut, k > 0 ? A_CUTS[k - 1] : null);
        ctx.beginPath();
        const y0 = k > 0 ? A_CUTS[k - 1] : -84;
        for (let q = 0; q <= 12; q++) { const ly = lerp(y0 + 12, cut - 12, q / 12); ctx.lineTo(RX - hwY(ly) * RS, FY + ly * RS); }
        for (let q = 12; q >= 0; q--) { const ly = lerp(y0 + 12, cut - 12, q / 12); ctx.lineTo(RX + hwY(ly) * RS, FY + ly * RS); }
        ctx.closePath(); ctx.clip();
        ctx.fillStyle = rgba('#fffbea', 0.7 * Math.pow(1 - clamp(d / 0.3), 2));
        ctx.fillRect(RX - 200 * RS, FY - 800 * RS, 400 * RS, 900 * RS);
        ctx.restore();
      }
      if (cut > -740) seamLine(ctx, RX, FY, RS, cut, 3.5);
    }
    // crate + Juno hammering
    drawCrate(ctx, A_CRATE.x, FY, A_CRATE.w, A_CRATE.h);
    const hp = hammerPose(t);
    const cap = {};
    const holdR = (c) => {
      c.save(); c.rotate(hp.w); c.scale(HAM_S, HAM_S);
      if (hp.chop > 0) cap.head = devPt(c, 0, -92);
      hammer(c); c.restore();
    };
    const jPose = {
      t, facing: 1, expr: 'determined', look: [0.7, -0.2], light: WARM,
      armR: { a: hp.a, b: hp.b, hand: 'fist' }, holdR, armL: 'hips',
      tilt: hp.tilt, squash: hp.squash,
    };
    drawGirl(ctx, A_JUNO[0], A_JUNO[1], CS, jPose);
    // swing smear: arcs trailing the hammer head round the shoulder during the chop
    if (cap.head && hp.chop > 0.15) {
      const [hx, hy] = fromDev(ctx, cap.head);
      const sh = girlAnchors(A_JUNO[0], A_JUNO[1], CS, jPose).shoulderR;
      const R = Math.hypot(hx - sh[0], hy - sh[1]);
      const a1 = Math.atan2(hy - sh[1], hx - sh[0]);
      const span = 1.1 * ease.outQuad(clamp((hp.chop - 0.15) / 0.5));
      ctx.save(); ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        if (span * (1 - 0.2 * k) < 0.2) continue; // (start must stay below end, or arc() wraps)
        const rr = R * (0.78 + 0.16 * k);
        ctx.strokeStyle = rgba('#fffaf0', 0.9 - 0.22 * k);
        ctx.lineWidth = (15 - 4 * k) * CS;
        ctx.beginPath(); ctx.arc(sh[0], sh[1], rr, a1 - span * (1 - 0.2 * k), a1 - 0.08); ctx.stroke();
      }
      ctx.restore();
    }
    // Biscuit, nail box in mouth, bobbing to the beat
    const dp = pulse(t + LEAD, 9);
    groundShadow(ctx, A_DOG[0], FY + 2, 110, 18, 0.28);
    drawDog(ctx, A_DOG[0], A_DOG[1], CS, {
      t, stance: 'sit', facing: 1, holdMouth: nailBox, look: [0.7, -0.6], light: WARM, bob: 1.5, squash: 1 - 0.06 * dp,
    });
    // TINK sparks
    for (let j = 0; j < 4; j++) tinkSpark(ctx, A_CONTACT[0], A_CONTACT[1], t - A_HITS[j], j);
  });
}

// ================================================================= SHOT B — weld (bar 9)
const B_HITS = beatsOf(9);
const B_JUNO = [1268, FY];
const B_DOG = [1418, FY];
const TORCH_S = 0.9;
const HOT = [TORCH_TIP[0] + Math.cos(TORCH_DIR) * 70, TORCH_TIP[1] + Math.sin(TORCH_DIR) * 70];
function camB(t) {
  const u = clamp((t - S_B) / 2.4);
  const d = since(t, B_HITS);
  const k = lastIdx(t, B_HITS);
  const punch = d >= 0 ? (k % 2 ? 0.035 : 0.014) * Math.exp(-12 * d) : 0;
  // close & low on the torch, Juno and Biscuit (slow creep in across the bar)
  return { x: lerp(1236, 1250, u), y: lerp(842, 850, u), zoom: lerp(2.6, 2.8, ease.inOutSine(u)) * (1 + punch) };
}
// the weld bead: grows up the fin's outer edge a notch on every beat; white-hot at the torch,
// cooling through orange to dull red further back
function weldBead(ctx, hx, hy, t) {
  let n = 0;
  for (let j = 0; j < 4; j++) n += ease.outCubic(clamp((t - B_HITS[j]) / 0.1));
  const len = 14 + 22 * n;
  const steps = Math.max(2, Math.round(len / 5));
  ctx.save();
  for (let i = steps; i >= 0; i--) {
    const q = i / steps; // 0 = at the torch, 1 = oldest
    const x = hx - 5 + 1.5 * Math.sin(q * 9), y = hy - q * len;
    const col = q < 0.15 ? '#fff8e0' : q < 0.4 ? '#ffc04d' : q < 0.7 ? '#ff7a33' : '#b8452a';
    if (q < 0.5) glow(ctx, x, y, 16, '#ffb45c', 0.35 * (1 - q * 2));
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, 4.2, 3.2, 0.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function weldBurst(ctx, x, y, d, big, seed) {
  const life = big ? 0.7 : 0.45;
  if (d < 0 || d > life) return;
  const n = big ? 52 : 22;
  const g = 1500;
  const pos = (i, tt) => {
    const sp = (big ? 1.7 : 1) * (240 + 480 * hash01(i, seed + 1));
    const a = -Math.PI * 0.95 + Math.PI * 1.25 * hash01(i, seed + 2);
    let px = x + Math.cos(a) * sp * tt, py = y + Math.sin(a) * sp * tt + 0.5 * g * tt * tt;
    if (py > FY) py = FY - (py - FY) * 0.3; // skitter along the floor
    return [px, py];
  };
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const li = life * (0.55 + 0.45 * hash01(i, seed + 3));
    if (d > li) continue;
    const q = d / li;
    const [x1, y1] = pos(i, d), [x0, y0] = pos(i, Math.max(0, d - 0.05));
    ctx.strokeStyle = hash01(i, seed + 4) < 0.35 ? '#ffffff' : hash01(i, seed + 4) < 0.7 ? '#ffe27a' : '#ffa94d';
    ctx.globalAlpha = 1 - q * q;
    ctx.lineWidth = (big ? 4.5 : 3.2) * (1 - 0.6 * q);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
  const f = Math.exp(-(big ? 7 : 11) * d);
  glow(ctx, x, y, big ? 340 : 190, '#cfe8ff', 0.55 * f);
  sparkle(ctx, x, y, (big ? 90 : 46) * f, '#ffffff', f);
}
function shotB(ctx, t) {
  const d = since(t, B_HITS);
  const k = lastIdx(t, B_HITS);
  const snareHit = k === 1 || k === 3 ? Math.exp(-9 * d) : 0;
  const cap = {};
  camera(ctx, camB(t), () => {
    drawWorkshop(ctx, { t, bulb: 0.7, flicker: 1 });
    drawRocket(ctx, RX, FY, RS, { t, build: 'panels', light: WARM });
    // Biscuit in tiny goggles, flinching on the snares
    groundShadow(ctx, B_DOG[0], FY + 2, 110, 18, 0.28);
    drawDog(ctx, B_DOG[0], B_DOG[1], CS, {
      t, stance: 'sit', facing: -1, goggles: 'eyes', expr: 'excited', look: [-0.8, -0.3], light: WARM,
      ears: 0.35 + 0.65 * snareHit, squash: 1 - 0.1 * snareHit, tilt: 0.08 * snareHit,
    });
    // Juno crouched at the right fin, goggles down, welding
    const jit = 0.015 * noise1(t * 23, 4);
    const holdR = (c) => {
      c.save(); c.rotate(0.62 + jit); c.scale(TORCH_S, TORCH_S);
      weldTorch(c, { t, on: 1, sparks: 0.7 });
      cap.hot = devPt(c, HOT[0], HOT[1]);
      c.restore();
    };
    drawGirl(ctx, B_JUNO[0], B_JUNO[1], CS, {
      t, stance: 'crouch', facing: -1, goggles: 'eyes', expr: 'determined', light: WARM,
      armR: { a: 1.32 + jit, b: 0.12, hand: 'fist' }, holdR, tilt: -0.04 - 0.03 * snareHit,
    });
    // spark bursts on every beat (big on 2 & 4)
    if (cap.hot) {
      const [hx, hy] = fromDev(ctx, cap.hot);
      weldBead(ctx, hx, hy, t);
      glow(ctx, hx, hy, 220, '#bfe6ff', 0.25 + 0.2 * pulse(t + LEAD, 8));
      for (let j = 0; j < 4; j++) weldBurst(ctx, hx, hy, t - B_HITS[j], j % 2 === 1, 40 + j * 13);
    }
  });
  // blue-white flash wash (bigger on snares)
  const fl = d >= 0 ? (k % 2 ? 0.3 : 0.1) * Math.exp(-10 * d) : 0;
  if (fl > 0.005) { ctx.fillStyle = rgba('#e3f2ff', fl); ctx.fillRect(-40, -40, W + 80, H + 80); }
}

// ================================================================= SHOT C — paint (bar 10)
// Juno is up the stepladder right of the rocket; her reach is ~80 px, so only the right fin is
// in brush range. The gag: b1 she brushes the right fin (+ front fin) directly; b2/b3/b4 she
// FLICKS paint globs that SPLAT onto the band, the far left fin and the nose — the flick is the
// anticipation, the splat lands ON the beat. The left-fin splat (b3) lands right where Biscuit
// dips his paw in the can; he trots over leaving red prints and stamps the paw decal on b4.
const C_HITS = beatsOf(10);
const LAD = { x: 1196, s: 0.95 };
const C_JUNO = [LAD.x + 4, FY - STEPLADDER.steps[2] * LAD.s];
const CAN = { x: 792, s: 0.62 };
const C_DOG0 = 684; // Biscuit's spot (facing right, toward the can / rocket)
const STAMP = hitT(10, 3); // 25.937 − lead: the paw-print high-five
const DIP = hitT(10, 2); // 25.337: paw into the can (with the left-fin splat)
const BRUSH_S = 0.85;
const FL = 0.17; // glob flight time: release FL before the beat, SPLAT on the beat
// rocket paint slots (drawRocket): 0 left fin, 1 band, 2 right fin + front fin, 3 nose.
// beat j paints slot C_SLOT[j]; the splat target (rocket-local) and arc height per beat
const C_SLOT = [2, 1, 0, 3];
const C_TGT = [[176, -262], [30, -210], [-186, -150], [0, -628]];
const C_ARC = [0, 70, 120, 60];
const w2 = (lx, ly) => [RX + lx * RS, FY + ly * RS];
const C_SH = [1185, 644]; // Juno's shoulder on the ladder (girlAnchors, facing -1)
// arm angle (facing -1) that points from the shoulder at a world point
const aimA = (p) => Math.atan2(-(p[0] - C_SH[0]), p[1] - C_SH[1]);
function slotProgress(t) {
  const f = [0, 0, 0, 0];
  for (let j = 0; j < 4; j++) {
    const dur = j === 0 ? 0.2 : 0.12; // brushed fin fills with the stroke; splats spread fast
    f[C_SLOT[j]] = ease.outCubic(clamp((t - C_HITS[j]) / dur));
  }
  return f;
}
// clip regions (world) that isolate each paint slot of the rocket at (RX, FY, RS). Hull bands
// bulge toward the camera (y + E·√(hw² − x²)), so the band / nose seams are followed exactly, and
// the front fin (drawn over the band's bulge) gets its own shape (a copy of rockets.js's path).
const seamYAt = (lx, ly) => ly + E * Math.sqrt(Math.max(0, hwY(ly) ** 2 - lx * lx));
function seamPoly(ctx, ly, dy, xa, xb, yEnd) {
  // closed polygon between the seam curve (at ly, shifted by dy) and the horizontal line yEnd
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const lx = lerp(xa, xb, k / n), [wx, wy] = w2(lx, seamYAt(lx, ly) + dy);
    k ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy);
  }
  const [ex, ey] = w2(xb, yEnd), [fx, fy] = w2(xa, yEnd);
  ctx.lineTo(ex, ey); ctx.lineTo(fx, fy); ctx.closePath();
}
function frontFinSub(ctx) {
  // the front fin's fill, grown ~3 units (outlines are INK in every paint state, so only fills matter)
  const m = (a) => ctx.moveTo(...w2(...a)), q = (c, a) => { const [cx, cy] = w2(...c), [ax, ay] = w2(...a); ctx.quadraticCurveTo(cx, cy, ax, ay); };
  m([-14, -181]); q([0, -192], [14, -181]); ctx.lineTo(...w2(28, -14)); q([28, 7], [0, 7]); q([-28, 7], [-28, -14]); ctx.closePath();
}
function slotClip(ctx, i) {
  const r = (x0, y0, x1, y1) => { const [ax, ay] = w2(x0, y0), [bx, by] = w2(x1, y1); ctx.rect(ax, ay, bx - ax, by - ay); };
  ctx.beginPath();
  if (i === 0) { r(-320, -340, -137, 20); seamPoly(ctx, -190, 5, -320, -28, 20); ctx.clip(); }
  else if (i === 2) { r(137, -340, 320, 20); seamPoly(ctx, -190, 5, 28, 320, 20); frontFinSub(ctx); ctx.clip(); }
  else if (i === 1) {
    seamPoly(ctx, -190, 5, -136, 136, -240); ctx.clip();
    // …minus the front fin (it is drawn over the band's bulge)
    ctx.beginPath(); ctx.rect(RX - 400, FY - 800, 800, 900); frontFinSub(ctx); ctx.clip('evenodd');
  } else { seamPoly(ctx, -548, 4, -220, 220, -790); ctx.clip(); }
}
// draw the painted rocket with independent per-slot progress: a base draw whose native paint
// value matches most slots, plus clipped overlays for the rest (≤ 2 extra draws in practice)
function paintedRocket(ctx, t, f) {
  const nat = (p, i) => clamp(p * 4 - i);
  let best = 0, bestMiss = 9;
  for (const p of [0, 1, (0 + f[0]) / 4, (1 + f[1]) / 4, (2 + f[2]) / 4, (3 + f[3]) / 4]) {
    let miss = 0;
    for (let i = 0; i < 4; i++) if (Math.abs(nat(p, i) - f[i]) > 1e-4) miss++;
    if (miss < bestMiss) { bestMiss = miss; best = p; }
  }
  drawRocket(ctx, RX, FY, RS, { t, build: 'painted', paint: best, light: WARM });
  for (let i = 0; i < 4; i++) {
    if (Math.abs(nat(best, i) - f[i]) <= 1e-4) continue;
    ctx.save(); slotClip(ctx, i);
    drawRocket(ctx, RX, FY, RS, { t, build: 'painted', paint: (i + f[i]) / 4, light: WARM });
    ctx.restore();
  }
}
// brush arm keyframes: stroke 0 = direct brush-down on the right fin; 1..3 = cock → FLICK → follow
const C_ARM = (() => {
  const kA = [], kW = [], kT = [];
  const push = (tt, a, w, tilt, e) => { kA.push([tt, a, e]); kW.push([tt, w, e]); kT.push([tt, tilt, e]); };
  const T0 = C_HITS[0];
  push(S_C - 0.5, 2.2, 0.1, 0.05);
  push(T0 - 0.12, 2.35, -0.1, 0.07, ease.inOutSine); // brush raised (held clear of her face)
  push(T0, 1.25, 0.25, -0.2, ease.inQuad); // brush hits the fin top ON the beat (lean in)
  push(T0 + 0.2, 0.75, 0.55, -0.24, ease.outQuad); // drag down the fin
  for (let j = 1; j < 4; j++) {
    const T = C_HITS[j], R = T - FL, aim = aimA(w2(...C_TGT[j]));
    push(R - 0.08, 2.3, -0.12, 0.1, ease.inOutSine); // wind-up: arm up, brush upright (clear of her face)
    push(R, aim + 0.35, 0.65, -0.12, ease.inQuad); // FLICK (release)
    push(R + 0.13, aim - 0.12, 0.95, -0.08, ease.outQuad); // follow-through
  }
  push(C_HITS[3] + 0.45, 1.25, 0.3, 0.02, ease.inOutSine); // relax (laughing)
  return { kA, kW, kT };
})();
function brushPose(t) { return { a: keyframes(t, C_ARM.kA), w: keyframes(t, C_ARM.kW), tilt: keyframes(t, C_ARM.kT) }; }
// the flicked glob: leaves the brush at release, lands ON the beat
const GLOB = [null, 1, 2, 3].map((j) => {
  if (j === null) return null;
  const T = C_HITS[j], R = T - FL;
  const an = girlAnchors(C_JUNO[0], C_JUNO[1], CS, { facing: -1, armR: { a: keyframes(R, C_ARM.kA), b: 0.18 }, tilt: keyframes(R, C_ARM.kT) });
  const P = w2(...C_TGT[j]);
  const dx = P[0] - an.handR[0], dy = P[1] - an.handR[1], dl = Math.hypot(dx, dy);
  return { R, T, B: [an.handR[0] + (dx / dl) * 36, an.handR[1] + (dy / dl) * 36 - 10], P, H: C_ARC[j] };
});
function globAt(g, u) { return [lerp(g.B[0], g.P[0], u), lerp(g.B[1], g.P[1], u) - g.H * 4 * u * (1 - u)]; }
function drawGlob(ctx, g, t) {
  const u = (t - g.R) / (g.T - g.R);
  if (u <= 0.04 || u >= 1) return;
  // trailing droplets + the stretched glob (ink outlined, like everything else)
  for (const [du, r] of [[0.22, 4], [0.12, 6]]) {
    if (u - du <= 0) continue;
    const [x, y] = globAt(g, u - du);
    circle(ctx, x, y, r, PAL.red, 2.5);
  }
  const [x, y] = globAt(g, u), [x2, y2] = globAt(g, Math.min(1, u + 0.03));
  const ang = Math.atan2(y2 - y, x2 - x);
  ellipsePath(ctx, x, y, 17, 10.5, ang); ink(ctx, PAL.red, 3);
  ellipsePath(ctx, x - 4, y - 3, 4, 2.5, ang); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
}
// the SPLAT: a spiky blob that pops ON the beat and melts into the freshly painted part
function splatBlob(ctx, x, y, d, seed, size = 1) {
  if (d < 0 || d > 0.24) return;
  const pop = ease.outBack(clamp(d / 0.07), 2.2);
  const a = 1 - clamp((d - 0.12) / 0.12);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i < n * 2; i++) {
    const ang = (i / (n * 2)) * TAU + seed;
    const rr = (i % 2 ? 16 : 30 + 16 * hash01(i, seed)) * size * pop;
    const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.8;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath(); ink(ctx, PAL.red, 3);
  for (let i = 0; i < 5; i++) {
    const ang = hash01(i, seed + 4) * TAU, rr = (40 + 18 * hash01(i, seed + 5)) * size * pop;
    circle(ctx, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8, (4 + 4 * hash01(i, seed + 6)) * size, PAL.red, 2.5);
  }
  ctx.restore();
}
function paintSplat(ctx, x, y, d, seed) {
  if (d < 0 || d > 0.4) return;
  const u = d / 0.4;
  // a few flecks flung off the fresh paint (fast, falling, fading) + a wet glint
  {
    ctx.save();
    ctx.globalAlpha *= 1 - u * u;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * (0.1 + 0.8 * hash01(i, seed)), sp = 260 + 260 * hash01(i, seed + 1);
      const px = x + Math.cos(a) * sp * d, py = y + Math.sin(a) * sp * d + 900 * d * d;
      circle(ctx, px, py, (4 + 3 * hash01(i, seed + 2)) * (1 - 0.5 * u), PAL.red, 2);
    }
    ctx.restore();
  }
  const k = 1 - u;
  sparkle(ctx, x - 16, y - 18, 30 * k, '#ffffff', k);
  sparkle(ctx, x + 22, y + 6, 16 * k, '#fff3d0', k);
}
// Biscuit: sit & bob → trot to the can → paw IN the can on b3 (with the splat) → trot to the hull
// leaving red prints → hop & stamp the paw decal ON b4 → proud
const DOG_CAN_X = 744;
const HOP_T = STAMP - 0.2;
function dogC(t) {
  const pawPt = PAW_AT(RX, FY, RS);
  const standX = pawPt[0] - 70; // where he stands before the hop
  if (t < DIP - 0.42) {
    return { x: C_DOG0, y: FY, pose: { stance: 'sit', facing: 1, look: [0.8, -0.8], expr: 'happy', squash: 1 - 0.05 * pulse(t + LEAD, 9) } };
  }
  if (t < DIP + 0.2) {
    // trot to the can, lean in, paw goes in ON the beat (the can is drawn over his front paws)
    const u = clamp((t - (DIP - 0.42)) / 0.3);
    const dipK = t >= DIP ? Math.exp(-9 * (t - DIP)) : 0;
    const up = 14 * Math.sin(Math.PI * clamp((t - (DIP - 0.42)) / 0.14)); // little hop masks sit → walk
    return {
      x: lerp(C_DOG0, DOG_CAN_X, ease.inOutSine(u)), y: FY - up, lift: up, inCan: t > DIP - 0.12,
      pose: {
        stance: u < 1 ? 'walk' : 'stand', facing: 1, tilt: 0.1 * clamp((t - (DIP - 0.12)) / 0.12) - 0.05 * dipK,
        squash: 1 - 0.08 * dipK, look: [0.9, 0.8], expr: t > DIP ? 'excited' : 'happy', ears: t > DIP ? 1 : 0.45,
      },
    };
  }
  if (t < HOP_T) {
    // trot from the can to the hull (red paws!)
    const u = clamp((t - (DIP + 0.2)) / (HOP_T - (DIP + 0.2)));
    return { x: lerp(DOG_CAN_X, standX, ease.inOutSine(u)), y: FY, pose: { stance: 'walk', facing: 1, look: [0.7, -0.4], expr: 'excited', ears: 0.8 } };
  }
  // hop: anticipation crouch, launch, paw to the decal ON the beat, then drop back down
  const ph = (t - HOP_T) / 0.2; // 0..1 up to the stamp
  const lift = t < STAMP ? 62 * ease.outQuad(clamp((ph - 0.25) / 0.75)) : 62 * (1 - ease.inQuad(clamp((t - STAMP - 0.08) / 0.2)));
  const squash = t < STAMP ? 1 - 0.14 * Math.sin(Math.PI * clamp(ph / 0.4)) : 1 - 0.1 * Math.exp(-14 * (t - STAMP));
  const dx = pawPt[0] - 18, dy = pawPt[1] + 50; // ground point that puts the raised near paw on the decal
  return {
    x: lerp(standX, dx, ease.outQuad(clamp(ph))), y: lerp(FY, dy, clamp(lift / 62)), lift,
    pose: { stance: 'stand', facing: 1, pawWave: t < STAMP + 0.3 ? 1 : 0, look: [0.6, -0.2], expr: t > STAMP ? 'happy' : 'excited', ears: 0.9, squash },
  };
}
// red paw prints on the floor between the can and the hull (appear as he steps, on 8ths)
const PRINTS = [0, 1, 2].map((i) => {
  const tt = DIP + 0.2 + (i + 0.5) * ((HOP_T - (DIP + 0.2)) / 3);
  return { t: tt, x: lerp(DOG_CAN_X + 20, PAW_AT(RX, FY, RS)[0] - 60, (i + 0.5) / 3), y: FY + 14 + (i % 2) * 12 };
});
function floorPrint(ctx, x, y, k) {
  ctx.save(); ctx.translate(x, y); ctx.scale(0.55 * k, 0.26 * k);
  ctx.fillStyle = rgba(PAL.red, 0.85);
  ctx.beginPath(); ctx.ellipse(0, 6, 16, 12, 0, 0, TAU); ctx.fill();
  for (const [bx, by] of [[-17, -10], [-6, -19], [6, -19], [17, -10]]) { ctx.beginPath(); ctx.ellipse(bx, by, 6, 7, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function camC(t) {
  // settle on Juno + the right fin for the first stroke, drift left to take in the far fin and
  // Biscuit for b3, then pull back so the nose is in frame before the b4 flick
  const T = C_HITS;
  const x = keyframes(t, [[S_C, 1050], [T[1], 1030, ease.inOutSine], [T[2] - FL - 0.05, 972, ease.inOutSine], [T[3] - FL - 0.06, 978, ease.inOutCubic], [S_END, 972, ease.outQuad]]);
  const y = keyframes(t, [[S_C, 764], [T[1], 766, ease.inOutSine], [T[2] - FL - 0.05, 770, ease.inOutSine], [T[3] - FL - 0.06, 690, ease.inOutCubic], [S_END, 682, ease.outQuad]]);
  const z = keyframes(t, [[S_C, 1.86], [T[1], 1.8, ease.inOutSine], [T[2] - FL - 0.05, 1.72, ease.inOutSine], [T[3] - FL - 0.06, 1.46, ease.inOutCubic], [S_END, 1.42, ease.outQuad]]);
  const d = since(t, C_HITS);
  const punch = d >= 0 ? 0.016 * Math.exp(-12 * d) : 0;
  return { x, y, zoom: z * (1 + punch) };
}
function shotC(ctx, t) {
  camera(ctx, camC(t), () => {
    drawWorkshop(ctx, { t, bulb: 1 });
    // red paw prints on the floor
    for (const p of PRINTS) if (t >= p.t) floorPrint(ctx, p.x, p.y, t - p.t < 0.08 ? 1.25 - 0.25 * ((t - p.t) / 0.08) : 1);
    paintedRocket(ctx, t, slotProgress(t));
    // the paw print (stamped on b4)
    const sd = t - STAMP;
    if (sd >= 0) {
      const k = sd < 0.25 ? lerp(1.35, 1, ease.outBack(clamp(sd / 0.25), 2)) : 1;
      pawDecal(ctx, RX, FY, RS, k);
    }
    // splats + flecks on each stroke
    for (let j = 0; j < 4; j++) {
      const [px, py] = w2(...C_TGT[j]);
      if (j > 0) splatBlob(ctx, px, py, t - C_HITS[j], 3 + j * 1.7, j === 2 ? 1.25 : 1);
      paintSplat(ctx, px, py, t - C_HITS[j], 60 + j * 7);
    }
    // ladder + Juno painting
    drawStepladder(ctx, LAD.x, FY, LAD.s, { t, wobble: 0.3 });
    const bp = brushPose(t);
    const holdR = (c) => { c.save(); c.rotate(1.15 + bp.w); c.scale(BRUSH_S, BRUSH_S); paintbrush(c, { color: PAL.red, drip: 0.6 }); c.restore(); };
    const after = t > STAMP + 0.1;
    const jIdx = lastIdx(t + FL + 0.1, C_HITS); // current target
    const tg = jIdx >= 0 ? w2(...C_TGT[jIdx]) : w2(...C_TGT[0]);
    const lk = [clamp((tg[0] - C_SH[0]) / 250, -1, 1), clamp((tg[1] - C_SH[1]) / 250, -1, 1)];
    drawGirl(ctx, C_JUNO[0], C_JUNO[1], CS, {
      t, facing: -1, expr: after ? 'laugh' : 'determined', look: after ? [-0.7, 0.9] : lk, light: WARM,
      armR: { a: bp.a, b: 0.18, hand: 'fist' }, holdR, armL: { a: 0.5, b: 0.9, hand: 'open' },
      tilt: bp.tilt, shadow: false,
    });
    // paint can + Biscuit (the can goes over his front paws while one is dipped in it)
    const dg = dogC(t);
    const canSplash = clamp((t - DIP) / 0.5);
    if (!dg.inCan) drawPaintCan(ctx, CAN.x, FY, CAN.s, { t, splash: canSplash });
    groundShadow(ctx, dg.x, FY + 2, 110 * (1 - 0.004 * (dg.lift || 0)), 18, 0.28);
    drawDog(ctx, dg.x, dg.y, CS, { t, light: WARM, ...dg.pose });
    if (dg.inCan) drawPaintCan(ctx, CAN.x, FY, CAN.s, { t, splash: canSplash });
    // flying globs (over everything but the FX)
    for (let j = 1; j < 4; j++) drawGlob(ctx, GLOB[j], t);
    // words: SPLAT! on the first flick (teaches the gag), SPLOSH! for the can
    {
      const d1 = t - C_HITS[1];
      if (d1 >= 0 && d1 < 0.36) {
        const u = d1 / 0.36, [px, py] = w2(...C_TGT[1]);
        cartoonText(ctx, 'SPLAT!', px - 40, py - 76 - 20 * u, { size: 34, fill: '#ffe3d6', lw: 6, scale: ease.outBack(clamp(u * 5), 2.6), alpha: 1 - clamp((u - 0.55) / 0.45), rot: -0.15 });
      }
      const d2 = t - DIP;
      if (d2 >= 0 && d2 < 0.45) {
        const u = d2 / 0.45;
        cartoonText(ctx, 'SPLOSH!', CAN.x - 70, FY - 150 - 20 * u, { size: 32, fill: '#ffe3d6', lw: 6, scale: ease.outBack(clamp(u * 5), 2.6), alpha: 1 - clamp((u - 0.6) / 0.4), rot: -0.2 });
      }
    }
    // stamp impact
    if (sd >= 0 && sd < 0.35) {
      const [px, py] = PAW_AT(RX, FY, RS);
      const u = sd / 0.35;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * 0.05 - (i / 6) * Math.PI * 0.95;
        const r0 = 34 + 40 * ease.outCubic(u);
        line(ctx, px + Math.cos(a) * r0, py + Math.sin(a) * r0, px + Math.cos(a) * (r0 + 22 * (1 - u)), py + Math.sin(a) * (r0 + 22 * (1 - u)), 5 * (1 - u) + 1, rgba('#fff6d8', 1 - u));
      }
      paintSplat(ctx, px, py, sd, 91);
    }
  });
}

// ================================================================= SHOT D — reveal (bar 11)
const D_B = beatsOf(11);
const GOLD = todTint('golden');
const DG = BACKYARD.garageDoor; // { x0 1620, x1 2060, top 160, bottom 800 }
const D_CAM = { x: 1552, y: 548, zoom: 1.14 };
const D_X0 = (DG.x0 + DG.x1) / 2, D_Y0 = DG.bottom; // rocket inside the barn (dolly wheels on the floor)
const D_X1 = 1276, D_Y1 = 886; // parked on the lawn
const DOLLY_H = 30;
const D_STICK_L = [-178, -72]; // sticker on the left fin (rocket-local), at Juno's reach
const D_NOSE_L = [40, -606]; // second sticker on the nose
function rocketD(t) {
  const u = clamp((t - (D_B[1] + 0.02)) / (D_B[2] - D_B[1] - 0.02));
  const uy = ease.inOutSine(clamp(u / 0.55));
  const ux = ease.inOutCubic(clamp((u - 0.15) / 0.85));
  const x = lerp(D_X0, D_X1, ux), g = lerp(D_Y0, D_Y1, uy);
  const s = lerp(0.8, 0.84, uy);
  // rocks forward when it stops on b3, then settles
  const rot = -0.05 * wobble(t, D_B[2], 1.6, 4.5) + 0.02 * Math.sin(Math.PI * u) * (u > 0 && u < 1 ? 1 : 0);
  const dist = (D_X0 - x) + (g - D_Y0);
  return { x, g, s, rot, dist, u };
}
function drawDolly(ctx, x, g, s, dist) {
  const w = 430 * s, h = DOLLY_H * s;
  ctx.save();
  // wheels
  for (const wx of [-0.38, 0.38]) {
    const cx = x + wx * w, cy = g - 13 * s;
    circle(ctx, cx, cy, 15 * s, '#3f3d4f', 4);
    circle(ctx, cx, cy, 6 * s, '#aab3c4', 2.5);
    const a = dist / (15 * s);
    ctx.strokeStyle = '#aab3c4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 11 * s, cy + Math.sin(a) * 11 * s); ctx.lineTo(cx - Math.cos(a) * 11 * s, cy - Math.sin(a) * 11 * s); ctx.stroke();
  }
  // platform
  rrect(ctx, x - w / 2, g - h - 14 * s, w, h, 6, '#c98b52', LW * 0.8);
  ctx.fillStyle = '#8f5a33'; ctx.fillRect(x - w / 2 + 6, g - 14 * s - 9 * s, w - 12, 6 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - w / 2 + 12, g - h - 14 * s + 5, w * 0.4, 4);
  ctx.restore();
}
function camD(t) {
  // on the barn for the door → pan left with the rocket → slow push while the kids pose
  // …then push in before the slap so the kids read bigger (the nose tip still clears the top edge)
  const x = keyframes(t, [[S_D, 1532], [D_B[1], 1532], [D_B[2] + 0.1, 1296, ease.inOutCubic], [D_B[3] - 0.04, 1262, ease.inOutSine], [S_END, 1252, ease.outQuad]]);
  const y = keyframes(t, [[S_D, 516], [D_B[1], 520], [D_B[2] + 0.1, 590, ease.inOutCubic], [D_B[3] - 0.04, 586, ease.inOutSine], [S_END, 584, ease.outQuad]]);
  const z = keyframes(t, [[S_D, 1.14], [D_B[1], 1.15], [D_B[2] + 0.1, 1.3, ease.inOutCubic], [D_B[3] - 0.04, 1.45, ease.inOutSine], [S_END, 1.5, ease.outQuad]]);
  const d = t - D_B[3];
  const punch = d >= 0 ? 0.018 * Math.exp(-10 * d) : 0;
  return { x, y, zoom: z * (1 + punch) };
}
// Juno's slap: stand so her hand lands on the fin sticker
const D_SLAP_POSE = { facing: 1, armR: { a: 1.75, b: 0.05 } };
function shotD(ctx, t) {
  const cam = camD(t);
  const door = ease.inOutCubic(clamp((t - (S_D - 0.02)) / (D_B[1] - S_D)));
  const R = rocketD(t);
  const base = R.g - (DOLLY_H + 14) * R.s; // rocket fin tips rest on the dolly
  const inside = R.u <= 0;
  // interior → golden light as it rolls out
  const outK = clamp((R.g - D_Y0) / 50);
  const rLight = { mul: mixColor('#c9a48e', GOLD.mul, outK), add: GOLD.add, addAmt: GOLD.addAmt * outK };
  const slapD = t - D_B[3];
  // characters
  const popJ = clamp((t - (D_B[2] - 0.12)) / 0.32), popB = clamp((t - (D_B[2] - 0.05)) / 0.32);
  const jLocal = lerp(-150, -330, ease.outBack(popJ, 1.4));
  const an = girlAnchors(0, 0, 0.42, D_SLAP_POSE);
  const stickW = [R.x + D_STICK_L[0] * R.s, base + D_STICK_L[1] * R.s];
  const jSlapX = stickW[0] - an.handR[0] - 4;
  const jx = t < D_B[2] + 0.3 ? R.x + jLocal * R.s : lerp(R.x - 330 * R.s, jSlapX, ease.inOutSine(clamp((t - (D_B[2] + 0.3)) / 0.22)));
  const jHop = popJ > 0 && popJ < 1 ? 46 * Math.sin(Math.PI * popJ) : 0;
  const bx = R.x + lerp(150, 305, ease.outBack(popB, 1.4)) * R.s;
  const bHop = popB > 0 && popB < 1 ? 40 * Math.sin(Math.PI * popB) : 0;
  const juno = () => {
    let armR = 'down', armL = 'down', expr = 'happy', holdR = null, holdRFront = false, look = [0.7, -0.3], stance = 'stand';
    if (popJ > 0 && popJ < 1) { stance = 'jump'; expr = 'excited'; }
    else if (popJ >= 1 && t < D_B[2] + 0.34) { armR = 'cheer'; armL = 'cheer'; expr = 'excited'; }
    if (t > D_B[2] + 0.3) {
      // sticker in hand → wind up → SLAP on b4 → press → proud
      const wind = clamp((t - (D_B[3] - 0.22)) / 0.14);
      const a = slapD < 0 ? lerp(1.2, 2.05, ease.inOutSine(wind)) : lerp(D_SLAP_POSE.armR.a, D_SLAP_POSE.armR.a, 1);
      const b = slapD < 0 ? lerp(0.6, 1.1, wind) : D_SLAP_POSE.armR.b;
      armR = { a: slapD < 0 && t > D_B[3] - 0.08 ? lerp(2.05, D_SLAP_POSE.armR.a, ease.inCubic(clamp((t - (D_B[3] - 0.08)) / 0.08))) : a, b, hand: slapD >= 0 ? 'open' : 'fist' };
      if (slapD < 0) { holdR = (c) => { c.save(); c.scale(0.38, 0.38); starSticker(c, { peel: 0.6, rot: 0.3 }); c.restore(); }; holdRFront = true; }
      expr = slapD >= 0 ? 'grin' : 'determined';
      look = [0.9, -0.1];
      if (slapD > 0.38) { armR = 'hips'; armL = 'hips'; expr = 'laugh'; }
    }
    longShadow(ctx, jx, R.g, 60, 170, { tod: 'golden', camX: cam.x, camY: cam.y });
    drawGirl(ctx, jx, R.g, 0.42, {
      t, facing: 1, stance, armR, armL, holdR, holdRFront, expr, look, light: GOLD, lift: jHop / 0.42,
      squash: slapD >= 0 && slapD < 0.3 ? 1 - 0.05 * Math.exp(-12 * slapD) : 1,
    });
  };
  const bark = t - (D_B[3] + SPB / 4); // a 16th after the slap: WOOF!
  const biscuit = () => {
    longShadow(ctx, bx, R.g, 60, 90, { tod: 'golden', camX: cam.x, camY: cam.y });
    drawDog(ctx, bx, R.g - bHop, 0.42, {
      t, stance: popB > 0 && popB < 1 ? 'jump' : 'sit', facing: -1, light: GOLD, expr: 'happy', look: [-0.7, -0.5],
      mouth: bark >= 0 && bark < 0.22 ? 1 : 0, ears: bark >= 0 && bark < 0.3 ? 1 : 0.5,
      squash: bark >= 0 ? 1 + 0.08 * Math.exp(-10 * bark) : 1,
    });
  };
  camera(ctx, cam, () => {
    drawBackyard(ctx, { t, tod: 'golden', garageDoor: door, bulb: 1, camX: cam.x, camY: cam.y, pad: 'none', crater: false });
    // rocket shadow on the lawn once it is outside
    if (outK > 0) longShadow(ctx, R.x, R.g, 380 * R.s, 600 * R.s, { tod: 'golden', camX: cam.x, camY: cam.y, alpha: outK });
    // hidden pushers behind the fins until the stop
    const behind = t < D_B[2] + 0.2;
    if (behind && !inside) { juno(); biscuit(); }
    if (behind && inside && door > 0.6) { juno(); biscuit(); }
    // the rocket on its dolly (while still inside: clipped to the visible part of the door opening,
    // which also saves raster time on these heavy golden-yard frames)
    ctx.save();
    if (inside) {
      const edge = DG.top + (DG.bottom - DG.top) * (1 - door) - 12;
      ctx.beginPath(); ctx.rect(DG.x0 - 10, edge, DG.x1 - DG.x0 + 20, DG.bottom + 60 - edge); ctx.clip();
    }
    ctx.translate(R.x, R.g); ctx.rotate(R.rot); ctx.translate(-R.x, -R.g);
    if (!inside || door > 0.01) {
      drawRocket(ctx, R.x, base, R.s, { t, build: 'done', light: rLight });
      drawDolly(ctx, R.x, R.g, R.s, R.dist);
    }
    // stickers
    if (slapD >= 0) {
      const k = slapD < 0.2 ? lerp(1.5, 1, ease.outBack(clamp(slapD / 0.2), 2.5)) : 1;
      ctx.save(); ctx.translate(stickW[0], stickW[1]); ctx.scale(0.5 * R.s * k, 0.5 * R.s * k); ctx.rotate(-0.2);
      starSticker(ctx, {}); ctx.restore();
    }
    const glintT = D_B[3] + 0.04, glintDur = 0.2;
    const nd = t - (glintT + glintDur);
    if (nd >= 0) {
      const k = nd < 0.2 ? lerp(1.6, 1, ease.outBack(clamp(nd / 0.2), 2.5)) : 1;
      ctx.save(); ctx.translate(R.x + D_NOSE_L[0] * R.s, base + D_NOSE_L[1] * R.s); ctx.scale(0.36 * R.s * k, 0.36 * R.s * k); ctx.rotate(0.3);
      starSticker(ctx, {}); ctx.restore();
    }
    ctx.restore();
    // door panel over a rocket that is still inside
    if (inside) drawGarageDoor(ctx, { t, tod: 'golden', garageDoor: door, bulb: 1 });
    if (!behind) { juno(); biscuit(); }
    // glint: a sparkle runs from the sticker up the hull's lit edge to the nose tip ("ting!")
    const gu = (t - glintT) / glintDur;
    if (gu >= 0 && gu < 1.6) {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const ly = lerp(-150, -716, i / 20);
        pts.push([R.x - hwY(ly) * 0.93 * R.s + (i === 0 ? 0 : 0), base + ly * R.s]);
      }
      pts[0] = stickW;
      const at = (q) => { const f = clamp(q) * 20, i = Math.min(19, Math.floor(f)), r = f - i; return [lerp(pts[i][0], pts[i + 1][0], r), lerp(pts[i][1], pts[i + 1][1], r)]; };
      const q = ease.inOutSine(clamp(gu));
      if (gu < 1) {
        ctx.save(); ctx.lineCap = 'round';
        for (let j = 0; j < 8; j++) {
          const q0 = Math.max(0, q - 0.03 * (j + 1)), q1 = Math.max(0, q - 0.03 * j);
          const [ax, ay] = at(q0), [bx2, by2] = at(q1);
          line(ctx, ax, ay, bx2, by2, 9 - j, rgba('#ffffff', 0.85 - j * 0.1));
        }
        ctx.restore();
        const [gx, gy] = at(q);
        glow(ctx, gx, gy, 80, '#fff6d0', 0.8);
        sparkle(ctx, gx, gy, 36, '#ffffff', 1);
      }
      const tq = gu - 1;
      if (tq >= 0 && tq < 0.6) {
        const tip = [R.x + D_NOSE_L[0] * R.s, base + D_NOSE_L[1] * R.s];
        const k = 1 - tq / 0.6;
        glow(ctx, tip[0], tip[1], 140, '#fff6d0', 0.8 * k);
        sparkle(ctx, tip[0], tip[1], 70 * ease.outBack(clamp(tq * 6)) * k, '#ffffff', k);
        sparkle(ctx, tip[0] + 30, tip[1] - 30, 26 * k, '#fff3b0', k);
      }
    }
    // SLAP impact
    if (slapD >= 0 && slapD < 0.35) {
      const u = slapD / 0.35;
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * (0.55 + (0.95 * i) / 7);
        const r0 = 30 + 50 * ease.outCubic(u);
        line(ctx, stickW[0] + Math.cos(a) * r0, stickW[1] + Math.sin(a) * r0, stickW[0] + Math.cos(a) * (r0 + 26 * (1 - u)), stickW[1] + Math.sin(a) * (r0 + 26 * (1 - u)), 6 * (1 - u) + 1, rgba('#fff6d8', 1 - u));
      }
      cartoonText(ctx, 'SLAP!', stickW[0] - 110, stickW[1] - 110 - 20 * u, { size: 46, fill: PAL.yellow, lw: 8, scale: ease.outBack(clamp(u * 5), 2.5), alpha: 1 - clamp((u - 0.6) / 0.4), rot: -0.2 });
    }
    // WOOF!
    if (bark >= 0 && bark < 0.45) {
      const u = bark / 0.45;
      cartoonText(ctx, 'WOOF!', bx + 40, R.g - 120 - 30 * u, { size: 42, fill: '#fff1d6', lw: 7, scale: ease.outBack(clamp(u * 5), 2.5), alpha: 1 - clamp((u - 0.6) / 0.4), rot: 0.18 });
    }
  });
}

// ================================================================= whip-pans + sequencing
const SHOTS = [
  { start: S_A, draw: shotA },
  { start: S_B, draw: shotB, dir: 1, smear: '#d99a5e' },
  { start: S_C, draw: shotC, dir: -1, smear: '#d99a5e' },
  { start: S_D, draw: shotD, dir: 1, smear: '#ffb98a' },
];
const WHIP = 0.26, WHIP_PX = 1050;

function whipOverlay(ctx, u, dir, col) {
  const k = Math.sin(Math.PI * u);
  ctx.save();
  ctx.fillStyle = rgba(col, 0.55 * Math.pow(k, 0.7));
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.55 * k;
  ctx.fillStyle = '#fff6e6';
  for (let i = 0; i < 34; i++) {
    const y = hash01(i, 5) * H;
    const len = 300 + 700 * hash01(i, 6);
    const x = ((hash01(i, 7) * (W + len) + dir * u * 2400) % (W + len) + (W + len)) % (W + len) - len;
    ctx.fillRect(x, y, len, 3 + 9 * hash01(i, 8));
  }
  ctx.restore();
}

export default {
  id: 's04_build',
  start: 19.336,
  end: 28.937,
  transition: { type: 'flash', dur: 0.35 },
  draw(ctx, t) {
    // which shot, and are we inside a whip?
    let idx = 0, off = 0, whip = null;
    for (let i = 1; i < SHOTS.length; i++) {
      const D = SHOTS[i].start;
      if (t >= D - WHIP) {
        idx = i;
        if (t < D) {
          const u = (t - (D - WHIP)) / WHIP;
          whip = { u, dir: SHOTS[i].dir, col: SHOTS[i].smear };
          if (u < 0.5) { idx = i - 1; off = -SHOTS[i].dir * WHIP_PX * ease.inCubic(u * 2); }
          else off = SHOTS[i].dir * WHIP_PX * (1 - ease.outCubic((u - 0.5) * 2));
        }
      }
    }
    const shot = SHOTS[idx];
    // landing jolt on the downbeat after a whip
    const sh = idx > 0 ? shake(t, shot.start - LEAD, 14, 9, 24) : { dx: 0, dy: 0, rot: 0 };
    ctx.save();
    // translation-only jolt: even a ~0.005 rad rotation knocks the rect-heavy workshop / backyard
    // off Skia's axis-aligned fast paths (+8 ms on the golden-yard frames) and isn't visible anyway
    ctx.translate(off + sh.dx, sh.dy);
    shot.draw(ctx, Math.max(t, S_A));
    ctx.restore();
    if (whip) whipOverlay(ctx, whip.u, whip.dir, whip.col);
  },
};
