// s15_nebula — 88.94 → 96.14 (bars 37–39) · transition: fade 1.0 s
// Bass out, floaty build inside a pink/teal nebula.
//   bar 37  CABIN: the baby star glows in Juno's cupped hands (the cabin is dimmed, the star is the
//           key light, pulsing on every beat); Biscuit sniffs it (b1), they look at each other (b2),
//           nod — let it go (b3); Juno lifts her cupped hands (anticipation for the cut).
//   bar 38  EXTERIOR at the open hatch: CUT on the downbeat, hands fly open, the star pops out (b0),
//           turns back and winks (b1), crouches… ZOOMS off leaving a glowing string (b2), Juno waves;
//           they duck inside, the hatch SLAMS (cartoon impact burst riding on the door, squash-rebound of
//           the whole rocket, exhaust puffs billowing out of the nozzle) and the engine lights (b3); the
//           rocket follows the string.
//   bar 39  SPIRAL: tunnel view down the string — the rocket corkscrews after the baby star, faster
//           and faster, warp rings on every beat (then 8ths, 16ths), stars streak, the star's glow
//           swells and whites the frame out exactly on 96.14 (s16 opens with a white flash).
import { W, H, INK, LW, PAL, camera, glow, sparkle, circlePath, ellipsePath, speedLines, starPath, ink, smokePuff } from '../draw.js';
import { TAU, clamp, lerp, ease, keyframes, spring, wobble, hash01, noise1, mixColor, rgba, fract, smoothstep } from '../util.js';
import { barTime, beatAt, pulse, kick, hat, hop, sway, SPB } from '../timing.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../props/cockpit.js';
import { drawRocket, ROCKET_HATCH } from '../props/rockets.js';
import { spaceBg, nebula, drawBabyStar } from '../props/space.js';

// ------------------------------------------------------------------ beat grid
const B37 = barTime(37); // 88.94 scene start (crossfade from s14 until 89.94)
const SNIFF = barTime(37, 1); // 89.54 Biscuit sniffs (and 89.84)
const LOOK = barTime(37, 2); // 90.14 they look at each other
const NOD = barTime(37, 3); // 90.74 nod: let it go
const B38 = barTime(38); // 91.34 CUT exterior, hands open, star pops out
const WINK = barTime(38, 1); // 91.94 the star winks at Juno
const ZOOM = barTime(38, 2); // 92.54 the star zooms off (string), Juno waves
const SLAM = barTime(38, 3); // 93.14 hatch slams + engine ignites, rocket follows
const B39 = barTime(39); // 93.74 CUT spiral
const B40 = barTime(40); // 96.14 white-out (s16 flash)
const BEAT = SPB;
// Hit convention: the whole scene is evaluated half a 30 fps frame ahead, so every cut / impact
// shows on the frame NEAREST its beat (≤ 1/60 s early) instead of on the first frame after it.
const NEAR = 1 / 60;

// nebula palette (pink / teal)
const NEB = ['#ff7eb6', '#2ec4b6', '#b388ff', '#ffc2e0', '#4fd1e0'];
const NEB2 = ['#2ec4b6', '#ff7eb6', '#6fe8b8', '#c77dff', '#ffa6c9'];

// ------------------------------------------------------------------ helpers
// two-stop radial glow (Skia shades gradients with more stops about twice as slowly)
function glow2(ctx, x, y, r, col, a) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
const easeIn = (t, a, b, f = ease.inOutCubic) => f(clamp((t - a) / (b - a)));
function strokeGlowPath(ctx, pts, lw, col, core, a = 1) {
  if (pts.length < 2) return;
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [w, al, c] of [[lw * 7, 0.1, col], [lw * 3.2, 0.26, col], [lw, 0.95, core]]) {
    path(); ctx.globalAlpha = a * al; ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke();
  }
  ctx.restore();
}
function rotSparkle(ctx, x, y, r, rot, col, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); sparkle(ctx, 0, 0, r, col, a); ctx.restore();
}
// a burst of 4-point sparkles flying out from (x, y) over `life` seconds after t0
function sparkBurst(ctx, t, t0, x, y, R, n = 10, seed = 1, life = 0.6, col = '#fff6c0') {
  const u = (t - t0) / life;
  if (u <= 0 || u >= 1) return;
  const e = ease.outCubic(u);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash01(i, seed) * 0.5;
    const d = R * (0.35 + 0.75 * hash01(i, seed + 1)) * e;
    const r = R * 0.12 * (1 - u) * (0.6 + 0.8 * hash01(i, seed + 2));
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r, i % 3 ? '#ffffff' : col, 1 - u * u);
  }
}
// nebula seen through the cabin porthole
function portholeView(t) {
  return (ctx, cx, cy, r) => {
    ctx.fillStyle = '#1a0f3a'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // cheap nebula: a few soft pink / teal clouds drifting on a 16-beat cycle
    const d = sway(t, 16) * 14;
    glow(ctx, cx - 40 + d, cy + 40, r * 0.95, '#ff7eb6', 0.6);
    glow(ctx, cx + 70 - d, cy - 50, r * 0.75, '#2ec4b6', 0.55);
    for (let i = 0; i < 26; i++) {
      const px = cx + (hash01(i, 71) - 0.5) * 2 * r, py = cy + (hash01(i, 72) - 0.5) * 2 * r;
      const tw = 0.6 + 0.4 * Math.sin(TAU * (beatAt(t) / 2 + hash01(i, 73))) + 0.4 * hat(t) * (i % 3 === 0);
      if (i % 6 === 0) sparkle(ctx, px, py, 7 * tw, '#ffffff', clamp(tw));
      else { ctx.fillStyle = rgba('#ffffff', clamp(0.7 * tw)); ctx.fillRect(px - 1.5, py - 1.5, 3, 3); }
    }
  };
}

// ================================================================== SHOT 1 — cabin
function shotCabin(ctx, t) {
  const S = COCKPIT_SEATS.cabin;
  const tt = Math.max(t, B37 - 1.5);
  // --- acting curves ---
  const sniffK = keyframes(tt, [[SNIFF - 0.18, 0], [SNIFF, 1, ease.outBack], [LOOK - 0.1, 1], [LOOK + 0.1, 0.15, ease.inOutSine]]);
  // two quick sniffs (nose dips) on 89.54 and 89.84
  const sniffBob = (tt >= SNIFF && tt < LOOK) ? Math.exp(-9 * ((tt - SNIFF) % (BEAT / 2))) : 0;
  const lookK = easeIn(tt, LOOK - 0.1, LOOK + 0.08, ease.outCubic) * (1 - easeIn(tt, NOD + 0.26, NOD + 0.4));
  // nod: a dip that lands ON the beat (anticipation up just before)
  const nodK = tt < NOD - 0.12 ? 0 : tt < NOD ? -0.35 * Math.sin(((tt - NOD + 0.12) / 0.12) * Math.PI) : Math.exp(-5 * (tt - NOD)) * Math.cos((tt - NOD) * 9);
  const upK = easeIn(tt, NOD + 0.26, NOD + 0.46, ease.outCubic); // both look up at the porthole: "let's let it go"
  const liftK = easeIn(tt, NOD + 0.3, B38 - 0.03, ease.inOutSine); // hands rise before the cut
  // the star stretches up out of the cup, eager to go (anticipation for the pop at the cut)
  const eager = easeIn(tt, B38 - 0.42, B38 - 0.02, ease.inQuad);
  const pr = pulse(tt, 5);

  // --- camera: a slow floaty push in, a touch of drift ---
  const zoom = keyframes(tt, [[B37 - 1.5, 1.62], [B37, 1.68], [B38, 1.98, ease.inOutSine]]);
  const cx = keyframes(tt, [[B37, 900], [LOOK, 915, ease.inOutSine], [B38, 905, ease.inOutSine]]) + 5 * sway(tt, 8);
  const cy = keyframes(tt, [[B37, 560], [B38, 548, ease.inOutSine]]) + 4 * sway(tt, 4);

  // Juno pose (sitting on the bench, cupping the star)
  const girlPose = {
    t: tt, stance: 'sit', suit: 'space', helmet: 1, facing: 1, hairFloat: 0.45,
    armL: 'cup', armR: 'cup',
    expr: lookK > 0.5 ? 'happy' : 'awe',
    look: upK > 0 ? [lerp(0.15, 0.9, upK), lerp(0.75, -0.9, upK)] : [lerp(0.15, 1, lookK), lerp(0.75, -0.15, lookK)],
    headTilt: lerp(0.08, -0.06, lookK) + 0.16 * nodK - 0.1 * upK,
    tilt: -0.02 * liftK,
    blush: 0.4 + 0.3 * lookK,
    lift: 6 * liftK,
  };
  const GX = S.girl.x - 20;
  const ga = girlAnchors(GX, S.girl.y, S.girl.s, girlPose);
  // (the star stays IN the cup — it only bobs up a little, so it never covers Juno's face)
  const RISE = 12;
  const [sx, sy] = [ga.cup[0], ga.cup[1] - 18 - RISE * liftK];
  // the baby star cradled in the hands
  const starR = 38;
  const starLook = upK > 0.3 ? [0.8, -0.8] : sniffK > 0.3 && lookK < 0.5 ? [0.9, -0.2] : lookK > 0.5 ? [0.2, -0.9] : [-0.3, -0.7];
  girlPose.holdCup = (c) => {
    c.save();
    c.translate(0, -19 - RISE * liftK / S.girl.s);
    drawBabyStar(c, 0, 0, starR, {
      t: tt, expr: (sniffK > 0.3 && lookK < 0.3) || eager > 0.3 ? 'excited' : 'happy', look: starLook,
      squash: (1 - 0.14 * sniffBob) * (1 + 0.16 * eager), glow: 1.2 + 0.5 * eager, rays: 0.8 + 0.2 * eager,
    });
    c.restore();
  };
  // Biscuit: sitting on the bench beside her, leans in to sniff
  const dogPose = {
    t: tt, stance: 'sit', suit: 'space', helmet: 1, facing: -1,
    expr: lookK > 0.5 ? 'happy' : sniffK > 0.3 ? 'excited' : 'awe',
    tilt: -0.36 * sniffK - 0.07 * sniffBob,
    headTilt: -0.12 * sniffK - 0.2 * nodK + 0.12 * upK,
    look: upK > 0.3 ? [-0.6, -1] : lookK > 0.3 ? [0.8, -0.9] : [0.9, 0.5],
    ears: 0.4 + 0.5 * sniffK,
    wag: 0.8, hairFloat: 0.35, tongue: lookK > 0.5 ? 1 : 0,
  };

  camera(ctx, { x: cx, y: cy, zoom }, () => {
    drawCockpit(ctx, { t: tt, view: 'cabin', window: portholeView(tt), lights: 0.2 });
    // dim the room: the star is the key light (one radial falloff, brighter on each beat)
    const R0 = 40 + 30 * pr, R1 = 400 + 50 * pr;
    // (two colour stops only: Skia shades >2-stop gradients about twice as slowly)
    const dg = ctx.createRadialGradient(sx, sy, R0, sx, sy, R1);
    dg.addColorStop(0, rgba('#1a0d38', 0));
    dg.addColorStop(1, rgba('#100826', 0.74));
    ctx.fillStyle = dg;
    ctx.fillRect(cx - W / 2 / zoom - 20, cy - H / 2 / zoom - 20, W / zoom + 40, H / zoom + 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow2(ctx, sx, sy, 230 + 30 * pr, '#ffb35c', 0.2 + 0.13 * pr);
    ctx.restore();
    // the porthole glows pink/teal — the way out, where the star wants to go (brighter once they look up)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const CW = S.window;
    glow2(ctx, CW.x - 30, CW.y + 30, CW.r * 1.05, '#ff7eb6', 0.16 + 0.1 * upK);
    glow2(ctx, CW.x + 45, CW.y - 40, CW.r * 0.8, '#2ec4b6', 0.12 + 0.08 * upK);
    ctx.restore();
    drawGirl(ctx, GX, S.girl.y, S.girl.s, girlPose);
    // Biscuit scoots along the bench to sniff, then settles back a little
    drawDog(ctx, S.dog.x - 30 - 22 * sniffK, S.dog.y, S.dog.s, dogPose);
    // warm light spilling over faces + floating motes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow2(ctx, sx, sy - 30, 140, '#ffc46b', 0.14 + 0.1 * pr);
    ctx.restore();
    const b = beatAt(tt);
    for (let i = 0; i < 12; i++) {
      const u = fract(b / 4 + hash01(i, 3));
      const px = sx + (hash01(i, 4) - 0.5) * 120 + Math.sin(u * 5 + i) * 26;
      const py = sy - 30 - u * 260;
      sparkle(ctx, px, py, (5 + 7 * hash01(i, 5)) * (1 - u), '#fff3c0', Math.sin(Math.PI * u));
    }
    // sniff puffs: tiny sparkle "tickle" when Biscuit sniffs
    sparkBurst(ctx, tt, SNIFF, sx + 30, sy - 10, 90, 7, 11, 0.5);
    sparkBurst(ctx, tt, SNIFF + BEAT / 2, sx + 30, sy - 10, 80, 6, 12, 0.5);
    drawCockpitFront(ctx, { t: tt, view: 'cabin' });
  });
}

// ================================================================== SHOT 2 — exterior at the hatch
const RX = 700, RY = 1400, RS = 1.0; // rocket (world) — base at (RX, RY)
const HX = ROCKET_HATCH.x, SILL = ROCKET_HATCH.sillY;
const J_S = 0.35, D_S = 0.34; // character scales in rocket-local units
const L2W = (p) => [RX + p[0] * RS, RY + p[1] * RS];
const STAR_FAR = [2350, 120]; // where the star's string points (world)

function starPath2(t, cup) {
  // hover point above the hands, then zoom along a curve toward the far point
  const hover = [cup[0] + 62, cup[1] - 82];
  if (t < ZOOM) {
    const up = ease.outBack(clamp((t - B38) / 0.36), 2.2);
    const crouch = keyframes(t, [[ZOOM - 0.3, 0], [ZOOM - 0.04, 1, ease.outCubic]]);
    const x = lerp(cup[0], hover[0], up) - 14 * crouch + 8 * sway(t, 2) * up;
    const y = lerp(cup[1], hover[1], up) + 18 * crouch - 10 * hop(t, 1) * up;
    return { x, y, r: 26, u: 0, crouch, hover };
  }
  // (the first ~3 frames ease out of the hover so the stretched star is seen leaving, then it zips)
  const x = clamp((t - ZOOM) / 1.05);
  const u = ease.outQuart(x) * smoothstep(0, 0.09, x);
  const c = [lerp(hover[0], STAR_FAR[0], 0.25), hover[1] - 520];
  const p = bez(hover, c, STAR_FAR, u);
  return { x: p[0], y: p[1], r: lerp(26, 9, Math.sqrt(u)), u, crouch: 0, hover, c };
}
const bez = (a, c, b, u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]];

function shotHatch(ctx, t) {
  const tt = clamp(t, B38, B39 + 0.2);
  // --- camera: close on the hatch, then pull back and swing after the star ---
  const pull = easeIn(tt, ZOOM - 0.05, SLAM + 0.15, ease.inOutCubic);
  const z0 = keyframes(tt, [[B38, 4.6], [ZOOM, 4.9, ease.inOutSine]]);
  const zoom = Math.exp(lerp(Math.log(z0), Math.log(0.74), pull)) * (1 - 0.05 * easeIn(tt, SLAM, B39));
  const camX = lerp(812, 1400, pull) + 90 * easeIn(tt, SLAM, B39, ease.inQuad);
  const camY = lerp(1008, 800, pull) - 60 * easeIn(tt, SLAM, B39, ease.inQuad);
  const slamSh = tt >= SLAM ? 26 * Math.exp(-7 * (tt - SLAM)) * noise1((tt - SLAM) * 30, 3) : 0;

  // --- rocket motion: gentle float, then launches along the string after the slam ---
  const go = clamp((tt - SLAM) / (B39 - SLAM));
  const bob = 8 * sway(tt, 4);
  const HOPEN = 0.6; // door swung ~90°: seen edge-on, so it doesn't block the view out into the nebula
  const hatch = tt < SLAM - 0.24 ? HOPEN : Math.max(0, HOPEN * (1 - ease.inCubic(clamp((tt - (SLAM - 0.24)) / 0.24))));
  const inside = easeIn(tt, SLAM - 0.4, SLAM - 0.22, ease.inOutSine); // characters duck back inside

  // Juno in the doorway
  const open = easeIn(tt, B38, B38 + 0.14, ease.outBack);
  const wave = tt >= ZOOM;
  const armSpec = (side) => {
    if (wave && side > 0) return 'wave';
    if (open <= 0) return 'cup';
    return open >= 1 ? 'up' : { a: lerp(0.25, 2.1, open), b: lerp(-2.685, 0.12, open), hand: open > 0.4 ? 'spread' : 'cup' };
  };
  const girlPose = {
    t: tt, stance: 'stand', suit: 'space', helmet: 1, facing: 1,
    armL: armSpec(-1), armR: armSpec(1), hairFloat: 0.6,
    expr: tt < WINK + 0.1 ? 'awe' : tt < ZOOM ? 'laugh' : 'excited',
    look: [0.6, -0.8],
    headTilt: -0.12 * open,
  };
  const dogPose = {
    t: tt, stance: 'sit', suit: 'space', helmet: 1, facing: 1, hairFloat: 0.6,
    expr: 'excited', look: [0.6, -0.9], wag: 1.2, ears: 0.9,
    mouth: tt >= ZOOM + BEAT / 2 && tt < ZOOM + BEAT / 2 + 0.25 ? 1 : 0, // "woof!" on the and-of-2
  };
  const cupLocal = girlAnchors(HX, SILL, J_S, { ...girlPose, armL: 'cup', armR: 'cup' }).cup;
  const cupW = L2W(cupLocal);
  cupW[1] += bob;
  const star = starPath2(tt, cupW);

  const drawContent = (c) => {
    const k = inside;
    c.save();
    c.translate(HX - 10 * k, SILL);
    c.scale(1 - 0.12 * k, 1 - 0.12 * k);
    drawGirl(c, 4, 0, J_S, girlPose);
    drawDog(c, -30, 2, D_S, dogPose);
    c.restore();
  };

  ctx.save();
  ctx.translate(slamSh, slamSh * 0.5);
  // background (screen space, parallax with the camera)
  spaceBg(ctx, { t: tt, hue: 'pink', stars: 320, driftX: camX * 0.3, driftY: camY * 0.3, nebula: 0, band: 0.6, seed: 4 });
  // the pink/teal nebula (screen space, slow parallax, grows a little as the camera pushes in)
  const nz = Math.min(1.1, Math.pow(zoom, 0.2));
  const px = (camX - 1000) * 0.2 * nz, py = (camY - 800) * 0.2 * nz;
  glow2(ctx, W * 0.78 - px, H * 0.22 - py, 760, '#ff6fb0', 0.42);
  glow2(ctx, W * 0.3 - px, H * 0.95 - py, 680, '#23c9b8', 0.34);
  nebula(ctx, { t: tt, x: W * 0.62 - px, y: H * 0.42 - py, scale: 1.1 * nz, colors: NEB, seed: 7, alpha: 0.95 });
  camera(ctx, { x: camX, y: camY, zoom }, () => {
    // the string the star leaves
    if (tt >= ZOOM) {
      const n = 40, pts = [];
      for (let i = 0; i <= n; i++) pts.push(bez(star.hover, star.c, STAR_FAR, star.u * (i / n)));
      const tw = tt - ZOOM;
      strokeGlowPath(ctx, pts, 6, '#ffd27a', '#fffbe6', 1);
      // travelling beads
      for (let j = 0; j < 3; j++) {
        const q = fract(tw * 0.9 + j / 3) * star.u;
        const p = bez(star.hover, star.c, STAR_FAR, q);
        glow(ctx, p[0], p[1], 26, '#fff6c0', 0.8);
      }
    }
    // the rocket (with the characters in the hatch)
    const launch = ease.inCubic(go);
    const lp = bez([RX, RY - 360], [RX + 250, RY - 900], [STAR_FAR[0], STAR_FAR[1] + 200], launch * 0.8);
    const rot = 0.55 * ease.inOutSine(clamp(go * 2.2));
    const rx = lp[0], ry = lp[1] + 360 + bob;
    // ignition: exhaust puffs billow out sideways from the nozzle as the engine lights (stay behind)
    const ign = (tt - SLAM) / 1.1;
    if (ign > 0 && ign < 1) {
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
        const d = (70 + 110 * k) * ease.outCubic(clamp(ign * 1.8));
        smokePuff(ctx, RX + side * d, RY + 20 - 30 * k * ign, 70 + 22 * k, {
          seed: 60 + i, u: clamp(ign * (1.1 - 0.12 * k) + 0.04), fill: '#f3e8f8', shadeCol: '#c7b3dd', lw: 5, n: 5,
        });
      }
    }
    // the slam: the whole rocket squashes and rebounds (a wobble decaying over ~0.4 s)
    const sq = tt >= SLAM ? Math.exp(-8 * (tt - SLAM)) * Math.cos((tt - SLAM) * 30) : 0;
    ctx.save();
    ctx.translate(rx, ry); ctx.scale(1 + 0.035 * sq, 1 - 0.06 * sq); ctx.translate(-rx, -ry);
    drawRocket(ctx, rx, ry, RS, {
      t: tt, hatch, hatchFrame: 'sill', hatchContent: hatch > 0.02 ? drawContent : null, hatchClip: inside > 0.5,
      flame: tt >= SLAM ? 0.55 + 0.45 * ease.outBack(clamp((tt - SLAM) / 0.25)) : 0, rot,
      shake: tt >= SLAM ? 0.6 * Math.exp(-5 * (tt - SLAM)) : 0,
    });
    ctx.restore();
    // slam: a cartoon impact burst on the door + sparkles
    if (tt >= SLAM && tt < SLAM + 0.5) {
      const h = L2W([HX, (SILL + ROCKET_HATCH.topY) / 2]);
      const d = tt - SLAM;
      const pop = ease.outBack(clamp((d + 0.02) / 0.06), 2.5) * (1 - ease.inCubic(clamp((d - 0.1) / 0.2)));
      if (pop > 0.01) {
        ctx.save();
        // ride along with the door (the rocket is already moving/rotating after the slam)
        ctx.translate(rx, ry - 360 * RS); ctx.rotate(rot); ctx.translate(0, 360 * RS);
        ctx.translate(HX * RS + 30, (SILL + ROCKET_HATCH.topY) / 2 * RS);
        ctx.rotate(0.2 + d * 1.5);
        starPath(ctx, 0, 0, 125 * pop, 62 * pop, 9);
        ink(ctx, PAL.yellow, LW * 1.1);
        starPath(ctx, 0, 0, 70 * pop, 36 * pop, 9, -Math.PI / 2 + 0.3);
        ink(ctx, '#fffbe6', 0);
        ctx.restore();
      }
      sparkBurst(ctx, tt, SLAM, h[0] + 40, h[1] + bob, 220, 10, 21, 0.45, '#ffffff');
    }
    // the baby star
    if (star.u < 1) {
      const pop = tt < B38 + 0.4 ? 1 : 0;
      const winkK = keyframes(tt, [[WINK - 0.06, 0], [WINK + 0.06, 1, ease.outCubic], [WINK + 0.42, 1], [WINK + 0.55, 0]]);
      const stretch = tt >= ZOOM ? 1 + 0.5 * Math.exp(-4 * (tt - ZOOM)) : 1 - 0.18 * star.crouch;
      ctx.save();
      ctx.translate(star.x, star.y);
      if (tt >= ZOOM) {
        const p2 = bez(star.hover, star.c, STAR_FAR, Math.min(1, star.u + 0.02));
        ctx.rotate(Math.atan2(p2[1] - star.y, p2[0] - star.x) + Math.PI / 2);
        ctx.scale(1 / Math.sqrt(stretch), stretch);
        ctx.rotate(-(Math.atan2(p2[1] - star.y, p2[0] - star.x) + Math.PI / 2));
      }
      glow2(ctx, 0, 0, star.r * 3.4, '#ffe27a', 0.5);
      drawBabyStar(ctx, 0, 0, star.r, {
        t: tt, expr: tt < ZOOM - 0.3 ? 'happy' : 'excited', wink: winkK,
        look: tt < WINK + 0.5 ? [-0.7, 0.5] : [0.8, -0.6], squash: tt < ZOOM ? 1 - 0.18 * star.crouch : 1,
        glow: 1.3, rays: 0.9,
      });
      ctx.restore();
      sparkBurst(ctx, tt, B38, star.x, star.y, 150, 12, 31, 0.55);
      if (pop) glow2(ctx, star.x, star.y, 90, '#fff3b0', 0.7 * (1 - clamp((tt - B38) / 0.4)));
      sparkBurst(ctx, tt, WINK, star.x + 30, star.y - 20, 80, 6, 41, 0.45);
    }
    // zoom-off burst at the launch point
    if (tt >= ZOOM) sparkBurst(ctx, tt, ZOOM, star.hover[0], star.hover[1], 120, 10, 51, 0.5);
  });
  ctx.restore();
}

// ================================================================== SHOT 3 — the spiral
// Tunnel view down the string: vanishing point C = the baby star far ahead.
const C = [W / 2, H / 2 - 20];
// orbit revolutions of the rocket since B39 (accelerating), u = 0..1 over the bar
const revs = (u) => 0.55 * u + 1.0 * u * u + 1.6 * u * u * u;
// forward distance travelled (drives the warp streaks), accelerating
const dist = (u) => 1.2 * u + 1.4 * u * u + 2.6 * u * u * u * u;
// warp rings: on every beat, then 8ths in the last beat, then 16ths
const RINGS = (() => {
  const r = [];
  for (let j = 0; j < 4; j++) r.push(barTime(39, j));
  r.push(barTime(39, 3.5));
  for (let j = 0; j < 4; j++) r.push(barTime(39, 3.5 + j * 0.125));
  return [...new Set(r.map((x) => +x.toFixed(4)))].sort((a, b) => a - b);
})();

function shotSpiral(ctx, t) {
  const tt = clamp(t, B39, B40 + 0.05);
  const u = clamp((tt - B39) / (B40 - B39));
  const white = ease.inCubic(clamp((tt - (B40 - 0.5)) / 0.5));
  const roll = TAU * 0.35 * revs(u) + 0.3;
  const b = beatAt(tt);
  const kk = kick(tt);

  // --- background: radial nebula tunnel (rotation-invariant; two-stop gradients are cheap) ---
  ctx.fillStyle = mixColor('#140b33', '#fff0fa', white * 0.5);
  ctx.fillRect(0, 0, W, H);
  glow2(ctx, C[0], C[1], 1150, mixColor('#7a2f9a', '#ffe6f6', white * 0.7), 0.95);
  glow2(ctx, C[0], C[1], 430 + 160 * u, mixColor('#ff7eb6', '#ffffff', white), 0.75);
  ctx.save();
  ctx.translate(C[0], C[1]);
  ctx.rotate(roll);
  // swirling nebula arms (soft blobs streaming outward, rotating with the roll)
  for (let i = 0; i < 12; i++) {
    const ph = fract(hash01(i, 5) + dist(u) * 0.22);
    const z = 1 - ph;
    const r = 90 / (z + 0.08);
    const a = hash01(i, 6) * TAU + ph * 1.2;
    const col = i % 2 ? '#2ec4b6' : '#ff7eb6';
    glow2(ctx, Math.cos(a) * r, Math.sin(a) * r, 170 * (1.2 - z), col, 0.2 * Math.sin(Math.PI * ph));
  }
  // warp star streaks
  const D = dist(u), D0 = dist(clamp(u - 0.03));
  ctx.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const a = hash01(i, 11) * TAU;
    const ph = fract(hash01(i, 12) + D * (0.5 + 0.5 * hash01(i, 13)));
    const ph0 = Math.min(ph, fract(hash01(i, 12) + D0 * (0.5 + 0.5 * hash01(i, 13))));
    const r1 = 40 / (1.02 - ph), r0 = 40 / (1.02 - ph0);
    if (r1 > 1400) continue;
    const ca = Math.cos(a), sa = Math.sin(a);
    const col = ['#ffffff', '#ffd6ec', '#bff5ef', '#fff1c4'][i % 4];
    const w = 1.2 + 3.2 * ph;
    ctx.globalAlpha = clamp(ph * 2) * (0.6 + 0.4 * hash01(i, 14));
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(ca * Math.min(r0, r1 - 2), sa * Math.min(r0, r1 - 2)); ctx.lineTo(ca * r1, sa * r1); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // warp rings (a hoop of light rushing past on each beat, 8ths/16ths at the end)
  // each hoop rushes out of the vanishing point and whooshes past the camera exactly ON its beat
  const RL = 0.5;
  ctx.globalCompositeOperation = 'lighter';
  RINGS.forEach((rt, ri) => {
    const q = (tt - rt + RL) / RL;
    if (q < 0 || q > 1.08) return;
    const r = 70 / Math.max(0.02, 1 - 0.92 * q);
    const a = 0.7 * smoothstep(0, 0.45, q) * (q > 1 ? 1 - (q - 1) / 0.08 : 1) * (rt > barTime(39, 3.4) ? 0.8 : 1);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 + r * 0.03;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a * 0.6; ctx.strokeStyle = ri % 2 ? '#3fe0d0' : '#ff5fb8'; ctx.lineWidth = 14 + r * 0.09; ctx.stroke();
  });
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- the baby star ahead (vanishing point), swelling as they catch up ---
  const starR = lerp(34, 84, ease.inQuad(u)) * (1 + 0.1 * kk);
  glow2(ctx, C[0], C[1], starR * (5 + 20 * white), '#fff3b0', 0.7 + 0.3 * white);
  drawBabyStar(ctx, C[0], C[1], starR, { t: tt, expr: 'excited', look: [0, 0.4], glow: 1.4, rays: 1 });

  // --- the rocket corkscrewing round the string, and its spiral trail (closer = bigger radius) ---
  const R0 = lerp(360, 250, ease.inOutSine(u));
  const phi = (uu) => TAU * revs(uu) + 2.2;
  const posAt = (uu, depth) => {
    const R = lerp(360, 250, ease.inOutSine(clamp(uu))) * depth;
    const a = phi(uu);
    return [C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R * 0.78];
  };
  // trail
  const pts = [];
  const NT = 110;
  for (let i = NT; i >= 0; i--) {
    const back = (i / NT) * 1.25; // seconds back
    const uu = u - back / (B40 - B39);
    const depth = 1 + back * (1.1 + 2.6 * u) + back * back * 0.8; // older = closer to the camera
    pts.push(posAt(uu, depth));
  }
  // rainbow-ish trail (luminous, additive): hue drifts along it; older = closer = thicker
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  const grow = (k) => lerp(3.2, 1, k);
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < NT; i += 5) {
      const seg = pts.slice(i, Math.min(NT + 1, i + 6));
      const k = i / NT; // 0 = oldest
      const hue = (300 + 330 * k + b * 40) % 360;
      const w = (layer === 0 ? 44 : layer === 1 ? 17 : 6) * grow(k);
      const a = layer === 2 ? 0.55 + 0.45 * k : (layer ? 0.4 : 0.16) * (0.3 + 0.7 * k);
      ctx.strokeStyle = `hsla(${hue.toFixed(0)},100%,${layer === 2 ? 84 : 62}%,${(a * (0.55 + 0.45 * u)).toFixed(3)})`;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); for (let j = 1; j < seg.length; j++) ctx.lineTo(seg[j][0], seg[j][1]); ctx.stroke();
    }
  }
  ctx.restore();
  // glitter along the trail
  for (let i = 3; i < NT; i += 7) {
    const k = i / NT, p = pts[i];
    const tw = 0.5 + 0.5 * Math.sin(TAU * (b * 2 + hash01(i, 8)));
    sparkle(ctx, p[0] + 14 * noise1(i + b * 3, 4) * grow(k), p[1] + 14 * noise1(i + b * 3, 5) * grow(k), (6 + 8 * tw) * grow(k) * 0.6, '#ffffff', 0.4 + 0.5 * k);
  }
  // the rocket itself (tangent to the orbit, nose pointing a little inward/forward)
  const p = posAt(u, 1);
  const pa = posAt(u - 0.004, 1);
  const head = Math.atan2(p[1] - pa[1], p[0] - pa[0]);
  const inward = Math.atan2(C[1] - p[1], C[0] - p[0]);
  const angDiff = Math.atan2(Math.sin(inward - head), Math.cos(inward - head));
  const dir = head + angDiff * 0.28;
  const rs = 0.3 * (1 + 0.05 * kk);
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(dir + Math.PI / 2);
  ctx.translate(0, 360 * rs * 0.5); // pivot near the middle of the rocket
  drawRocket(ctx, 0, 0, rs, { t: tt, flame: 0.8 + 0.2 * kk, shake: 0.3 + 0.5 * u });
  ctx.restore();
  // speed lines round the frame edge, growing
  speedLines(ctx, C[0], C[1], tt, { count: 26 + Math.round(30 * u), inner: 520 - 120 * u, outer: 1300, alpha: 0.25 + 0.35 * u, lw: 4, seed: 9 });

  // --- white-out ---
  if (white > 0) {
    ctx.fillStyle = rgba('#ffffff', white);
    ctx.fillRect(0, 0, W, H);
  }
}

// ================================================================== scene
export default {
  id: 's15_nebula',
  start: 88.941,
  end: 96.141,
  transition: { type: 'fade', dur: 1.0 },
  draw(ctx, t) {
    const tt = t + NEAR;
    if (tt < B38) shotCabin(ctx, tt);
    else if (tt < B39) shotHatch(ctx, tt);
    else shotSpiral(ctx, tt);
  },
};
