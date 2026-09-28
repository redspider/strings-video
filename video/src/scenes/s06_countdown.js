// s06_countdown — bar 15 (36.14 → 38.54). Bass drops out: tension. Cockpit close-up (dash view).
//
//   "4" 36.137  cut in: Juno grips the joystick, Biscuit nervous. Numbers fill the screen on the beats,
//   "3" 36.737  each with a zoom-punch toward the beat's gag and increasing shake.
//   "2" 37.337  "deal with it": shades slide down inside Biscuit's helmet and SNAP onto his face.
//   "1" 37.937  Juno winds up (from ~37.5) and SLAMS the big red button: flash, alarm beacons,
//               everything rattles harder and harder, engine smoke billows past the window → s07 liftoff.
//
// Pure function of t. Characters sit between the cockpit's back and front layers (COCKPIT_SEATS.dash).
import { W, H, PAL, INK, camera, shake, cartoonText, smokePuff, sparkle, glow, cloud, circlePath,
  vGradient, FONT } from '../draw.js';
import { clamp, lerp, ease, keyframes, wobble, hash01, noise1, rgba, TAU, smoothstep } from '../util.js';
import { barTime, pulse, beatAt, sway } from '../timing.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../props/cockpit.js';
import { sunglasses } from '../props/items.js';

// ------------------------------------------------------------------ beat grid
const bt = (k, j = 0) => barTime(k, j);
const EPS = 1 / 60; // impacts land on the frame nearest the beat
const T4 = bt(15, 0); // 36.137 "4"
const T3 = bt(15, 1); // 36.737 "3"
const T2 = bt(15, 2); // 37.337 "2" — shades snap on
const T1 = bt(15, 3); // 37.937 "1" — button SLAM
const T_END = bt(16); // 38.537 liftoff (s07)
const BEATS = [T4, T3, T2, T1];
const T_SHADES0 = bt(15, 1.35); // 36.947 shades start sliding down
const T_WIND = bt(15, 2.35); //   37.547 Juno winds up
const T_SWING = T1 - 0.1; //      swing down onto the button

const hitAt = (t, tb) => t >= tb - EPS;
const since = (t, tb) => t - (tb - EPS);
const impact = (t, tb, k = 9) => (hitAt(t, tb) ? Math.exp(-k * since(t, tb)) : 0);

const SEAT = COCKPIT_SEATS.dash;
const G = SEAT.girl, D = SEAT.dog;

// ------------------------------------------------------------------ the number cards
const CARDS = [
  // [text, fill, x, y, rot, focus (camera punches toward the beat's gag)]
  ['4', PAL.yellow, 960, 480, -0.06, [960, 540]],
  ['3', PAL.orange, 770, 480, 0.07, [1100, 560]],
  ['2', PAL.pink, 630, 480, -0.08, [1180, 560]], // left: Biscuit's shades snap on this beat, keep him clear
  ['1', PAL.red, 1660, 470, 0.06, [880, 640]], // right edge: keeps the slam AND Biscuit's cool face clear
];
function drawCard(ctx, t, i) {
  const tb = BEATS[i];
  const u = since(t, tb);
  if (u < 0 || u > 0.34) return;
  const [txt, fill, x, y, rot] = CARDS[i];
  const inK = ease.outBack(clamp(u / 0.09), 2.6);
  const outK = clamp((u - 0.22) / 0.11);
  const sc = lerp(1.3, 1, inK) * (1 - ease.inBack(outK, 2.2)) * (1 + 0.04 * Math.sin(u * 40) * (1 - clamp(u / 0.22)));
  const a = outK < 1 ? 1 : 0;
  if (sc <= 0.01) return;
  // radial burst (a quick flash of rays) + shockwave ring behind the digit
  ctx.save();
  ctx.globalAlpha = 0.22 * (1 - clamp(u / 0.2));
  ctx.translate(x, y);
  ctx.rotate(i * 0.4 + u * 0.8);
  ctx.fillStyle = '#fff6c0';
  const R = 1250;
  for (let k = 0; k < 12; k++) {
    const an = (k / 12) * TAU;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an - 0.05) * R, Math.sin(an - 0.05) * R); ctx.lineTo(Math.cos(an + 0.05) * R, Math.sin(an + 0.05) * R); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const ring = 120 + 900 * ease.outCubic(clamp(u / 0.4));
  ctx.save();
  ctx.globalAlpha = 0.7 * (1 - clamp(u / 0.4));
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 18 * (1 - clamp(u / 0.4)) + 2;
  circlePath(ctx, x, y, ring); ctx.stroke();
  ctx.restore();
  cartoonText(ctx, txt, x, y, { size: 900, font: FONT.title, fill, lw: 46, rot, scale: sc, alpha: a });
  // highlight dab on the digit
  if (a > 0.05 && u < 0.2) sparkle(ctx, x - 150 * sc, y - 260 * sc, 40 * (1 - u / 0.2) + 10, '#ffffff', a);
}

// ------------------------------------------------------------------ window: golden sky seen from the pad
function skyWindow(t, rumble) {
  return (ctx, cx, cy, r) => {
    const j = rumble * 10;
    const jx = j * noise1(t * 30, 3), jy = j * noise1(t * 27, 4);
    vGradient(ctx, [[0, '#d9689a'], [0.45, '#ff9c7a'], [1, '#ffd08a']], cx - r, cy - r, 2 * r, 2 * r);
    // low sun glow off to the side
    glow(ctx, cx - r * 0.7 + jx, cy + r * 0.6 + jy, r * 1.1, '#fff1c0', 0.55);
    // clouds drifting slowly past (they sink faster once the engine lights)
    const drift = (t - T4) * 18 + rumble * rumble * 40;
    cloud(ctx, cx - r * 0.35 + jx, cy - r * 0.35 + drift + jy, r * 0.8, r * 0.3, { seed: 3, fill: '#ffe4d2', shadow: '#f2a494', lw: 4 });
    cloud(ctx, cx + r * 0.5 + jx, cy + r * 0.15 + drift * 1.4 + jy, r * 0.6, r * 0.24, { seed: 6, fill: '#ffe4d2', shadow: '#f2a494', lw: 4 });
    // a bird flaps across on the beats
    {
      const k = clamp((t - T4) / (T_END - T4));
      const bx = cx - r * 1.1 + 2.4 * r * k + jx, by = cy - r * 0.55 + 20 * Math.sin(k * 9) + jy;
      const fl = Math.sin(beatAt(t) * TAU * 2) * 10;
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 18, by - fl); ctx.quadraticCurveTo(bx - 8, by - 4, bx, by); ctx.quadraticCurveTo(bx + 8, by - 4, bx + 18, by - fl); ctx.stroke();
      ctx.restore();
    }
    // engine smoke billowing up past the glass after the button
    if (rumble > 0) {
      const s0 = since(t, T1);
      for (let i = 0; i < 6; i++) {
        const life = 0.7 + 0.4 * hash01(i, 5);
        const u = (s0 - i * 0.075) / life;
        if (u <= 0 || u >= 1) continue;
        const px = cx + (hash01(i, 1) - 0.5) * r * 1.8 + jx;
        const py = cy + r * 1.15 - u * r * (0.9 + 0.8 * hash01(i, 2)) + jy;
        smokePuff(ctx, px, py, r * (0.3 + 0.2 * hash01(i, 3)) * (0.6 + u), { seed: 20 + i, u: clamp(0.1 + u * 0.8), n: 5, lw: 4 });
      }
      // orange glow of the engine from below
      glow(ctx, cx, cy + r * 1.1, r * 1.4 * (0.8 + 0.2 * Math.sin(t * 40)), '#ffb04a', 0.45 * clamp(s0 / 0.2));
    }
  };
}

// the cockpit jiggles its own layers with this offset; the seated characters must ride along
function cockpitJiggle(t, s) {
  if (s <= 0) return [0, 0, 0];
  return [s * 9 * noise1(t * 31, 1), s * 7 * noise1(t * 29, 2), s * 0.004 * noise1(t * 23, 3)];
}

// ------------------------------------------------------------------ scene
function drawScene(ctx, t) {
  const slam = hitAt(t, T1);
  const sSlam = since(t, T1);
  const rumble = slam ? clamp(0.55 + sSlam / (T_END - T1) * 0.6, 0, 1) : 0;

  // ---- camera: base zoom steps up every number; a punch toward each beat's gag
  let zoom = 1.0, fx = 960, fy = 540, punch = 0;
  for (let i = 0; i < 4; i++) {
    const tb = BEATS[i];
    if (!hitAt(t, tb)) break;
    const next = i < 3 ? BEATS[i + 1] : T_END;
    const k = ease.outCubic(clamp(since(t, tb) / 0.25));
    const [px, py] = CARDS[i][5];
    zoom = lerp(zoom, 1.03 + 0.025 * i, k);
    fx = lerp(fx, lerp(960, px, 0.55), k); fy = lerp(fy, lerp(540, py, 0.55), k);
    punch = 0.06 * (1 + 0.35 * i) * Math.exp(-11 * since(t, tb));
    void next;
  }
  if (slam) zoom += 0.04 * ease.outCubic(clamp(sSlam / 0.5));
  // shakes: increasing on each number, then a growing rumble after the button
  let dx = 0, dy = 0, rot = 0;
  const amps = [7, 11, 16, 34];
  for (let i = 0; i < 4; i++) { const sh = shake(t, BEATS[i] - EPS, amps[i], 7); dx += sh.dx; dy += sh.dy; rot += sh.rot; }
  if (slam) {
    const r = 6 + 16 * clamp(sSlam / (T_END - T1));
    dx += r * noise1(t * 26, 71); dy += r * noise1(t * 24, 72); rot += r * 0.0006 * noise1(t * 21, 73);
  }
  const cpShake = slam ? 0.35 + 0.65 * clamp(sSlam / (T_END - T1)) : 0.06 * pulse(t, 8);
  const O = {
    t, view: 'dash', lights: 1, shake: cpShake, redButton: slam ? 1 : 0,
    tint: slam ? 0.18 + 0.12 * clamp(sSlam / 0.3) : 0,
    stick: [0.1 * sway(t, 2), -0.1], joystick: 'back',
    window: skyWindow(t, rumble),
  };

  camera(ctx, { x: fx, y: fy, zoom: zoom * (1 + punch), dx, dy, rot }, () => {
    drawCockpit(ctx, O);
    const [jx, jy, jr] = cockpitJiggle(t, cpShake);
    ctx.save();
    ctx.translate(jx, jy);
    if (jr) { ctx.translate(W / 2, H / 2); ctx.rotate(jr); ctx.translate(-W / 2, -H / 2); }
    drawBiscuit(ctx, t, slam, sSlam);
    drawJuno(ctx, t, slam, sSlam);
    ctx.restore();
    drawCockpitFront(ctx, O);
    // big flash of the button + rattle lines
    if (slam) {
      const b = SEAT.redButton;
      glow(ctx, b.x, b.y, 230 * (1 - 0.3 * clamp(sSlam / 0.4)), '#ff6a4f', 0.55 * Math.exp(-6 * sSlam) + 0.1);
      rattleLines(ctx, t, sSlam);
    }
  });
  // countdown cards on top of everything (screen space)
  for (let i = 0; i < 4; i++) drawCard(ctx, t, i);
  // slam white pop
  if (slam && sSlam < 0.12) {
    ctx.save(); ctx.fillStyle = rgba('#fff4e0', 0.2 * (1 - sSlam / 0.12)); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

function rattleLines(ctx, t, s) {
  const a = clamp(s / 0.1);
  const spots = [[430, 330, 1], [1500, 330, -1], [600, 760, 1], [1330, 760, -1], [960, 90, 1], [220, 640, 1], [1720, 640, -1]];
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 6;
  ctx.globalAlpha = 0.8 * a;
  for (let i = 0; i < spots.length; i++) {
    const [x, y, sg] = spots[i];
    const on = Math.floor(t * 15 + i) % 2;
    if (!on) continue;
    for (let k = 0; k < 3; k++) {
      const yy = y - 26 + k * 26;
      ctx.beginPath(); ctx.moveTo(x - sg * 20, yy); ctx.quadraticCurveTo(x, yy - 8, x + sg * 20, yy + 2); ctx.stroke();
    }
  }
  ctx.restore();
}


// World shoulder → hand 2-bone IK for Juno's arm → {a, b} in her body-local convention (see girl.js).
function armIK(P, side, target, hand = 'fist', pose = {}) {
  const Dir = (P.facing ?? 1) < 0 ? -1 : 1;
  const A = girlAnchors(P.x, P.y, P.s, { ...pose, facing: P.facing, tilt: P.tilt || 0, armL: 'down', armR: 'down' });
  const S = side > 0 ? A.shoulderR : A.shoulderL;
  const ct = Math.cos(P.tilt || 0), st = Math.sin(P.tilt || 0);
  const dx = target[0] - S[0], dy = target[1] - S[1];
  const lx = (dx * ct + dy * st) * Dir, ly = -dx * st + dy * ct;
  let stretch = 1, a = 0, b = 0;
  for (let it = 0; it < 3; it++) {
    const L1 = 44 * stretch * P.s, L2 = (40 * stretch + 7.15) * P.s;
    const d = Math.hypot(lx, ly);
    const dd = clamp(d, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
    const phi = Math.atan2(lx * side, ly);
    const al = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    const tx = (lx * dd) / Math.max(1e-6, d), ty = (ly * dd) / Math.max(1e-6, d);
    const c = [phi + al, phi - al].map((aa) => {
      const ex = side * Math.sin(aa) * L1, ey = Math.cos(aa) * L1;
      return { a: aa, b: Math.atan2((tx - ex) * side, ty - ey) - aa, low: ey };
    });
    const pick = c[0].low >= c[1].low ? c[0] : c[1]; // elbow down
    a = pick.a; b = pick.b;
    while (a < -Math.PI / 2) a += TAU;
    while (a > 1.5 * Math.PI) a -= TAU;
    while (b > Math.PI) b -= TAU;
    while (b < -Math.PI) b += TAU;
    stretch = 1 + 0.16 * clamp((Math.max(a, a + b) - 1.75) / 0.9);
  }
  return { a, b, hand };
}

// ---- Juno: grips the joystick; nods on each number; winds up and slams the button on "1"
function drawJuno(ctx, t, slam, sSlam) {
  const joy = G.arms.joystick.armL;
  let armR = { a: 0.35, b: -0.9, hand: 'fist' }, tilt = 0, expr = 'determined', look = [0.25, -0.1], mouth;
  // (raised arms carry `raise`, so girl.js keeps the fist OUTSIDE the fishbowl instead of in front of her face)
  const arm = (a, b) => ({ a, b, hand: 'fist', raise: { a, b } });
  if (t >= T_WIND && t < T_SWING) {
    // wind-up: fist cocked high beside the helmet, leans back, eyes on the button
    const k = ease.outBack(clamp((t - T_WIND) / 0.2));
    const shiver = 0.05 * smoothstep(T_WIND + 0.15, T_WIND + 0.25, t) * Math.sin((t - T_WIND) * 70); // fist trembles, aiming
    armR = arm(lerp(0.35, 2.3, k) + shiver, lerp(-0.9, 0.9, k));
    tilt = -0.16 * k;
    look = [0.6, 0.8];
    expr = 'determined';
  } else if (t >= T_SWING && !slam) {
    const k = ease.inQuad(clamp((t - T_SWING) / (T1 - EPS - T_SWING)));
    armR = arm(lerp(2.3, 2.0, k), lerp(0.9, 0, k));
    tilt = lerp(-0.16, 0.4, k);
    look = [0.6, 0.8];
  } else if (slam) {
    // hold the slam: a little recoil, then a big grin as everything shakes
    const rec = wobble(t, T1 - EPS, 3, 7);
    armR = { a: 2.0 + 0.08 * rec, b: 0, hand: 'fist' };
    tilt = 0.4 - 0.03 * rec;
    expr = sSlam < 0.18 ? 'wince' : 'excited';
    look = [0.2, -0.1];
  }
  // tiny nod on each number (anticipation for the cockpit rattle)
  let nod = 0;
  for (let i = 0; i < 3; i++) nod += 0.06 * wobble(t, BEATS[i] - EPS, 2.5, 8);
  const squash = 1 - (slam ? 0.06 * Math.exp(-10 * sSlam) : 0);
  const base = { t, stance: 'sit', facing: 1, suit: 'space', helmet: 1, squash };
  // left hand stays clamped on the joystick knob (which rattles with the cockpit)
  const sx = 0.1 * sway(t, 2);
  const armL = Math.abs(tilt) < 1e-3 ? joy : armIK({ x: G.x, y: G.y, s: G.s, facing: 1, tilt }, -1, [SEAT.joystick.x + sx * 46, SEAT.joystick.y - 6], 'fist', base);
  drawGirl(ctx, G.x, G.y, G.s, { ...base, expr, look, mouth, armL, armR, tilt, headTilt: nod });
}

// ---- Biscuit: nervous → "deal with it" shades snap on "2" → cool as everything rattles
function drawBiscuit(ctx, t, slam, sSlam) {
  const snapped = hitAt(t, T2);
  const sSnap = since(t, T2);
  let expr = 'alert', ears = 0.6, look = [0.4, -0.2], tongue;
  if (t >= T_SHADES0 && !snapped) { expr = 'neutral'; look = [0.1, -1]; ears = 0.2; } // eyes up at the descending shades
  if (snapped) { expr = 'grin'; ears = 0.3; look = [0.6, 0]; }
  if (t >= T_WIND && !slam) look = [0.9, 0.3]; // eyes on Juno's cocked fist
  if (slam) { expr = sSlam < 0.25 ? 'grin' : 'happy'; tongue = sSlam < 0.25 ? 0 : 1; ears = 0.5 + 0.4 * Math.sin(t * 30); }
  const squash = snapped ? 1 - 0.07 * Math.exp(-12 * sSnap) : 1;
  const pose = {
    t, stance: 'sit', facing: -1, suit: 'space', helmet: 1, expr, ears, look, tongue, sunglasses: snapped,
    squash, headTilt: snapped ? -0.08 * Math.exp(-8 * sSnap) : 0, wag: snapped ? 1.2 : 0.4,
  };
  drawDog(ctx, D.x, D.y, D.s, pose);
  const A = dogAnchors(D.x, D.y, D.s, pose);
  // the helmet bowl (dog.js: head-local centre (3, -6), r 68; mirrored for facing -1)
  const hx = A.head[0] - 3 * D.s, hy = A.head[1] - 6 * D.s, hr = 68 * D.s;
  // eyes line where the shades sit (head-local ≈ (11, -7)), mirrored → world
  const ex = A.head[0] - 11 * D.s, ey = A.head[1] - 7 * D.s;
  if (t >= T_SHADES0 && !snapped) {
    // "deal with it": they slide slowly down from the top of the helmet, inside the glass
    const k = clamp((t - T_SHADES0) / (T2 - EPS - T_SHADES0));
    const y = lerp(hy - hr - 30, ey, k);
    ctx.save();
    circlePath(ctx, hx, hy, hr - 3); ctx.clip();
    ctx.translate(ex, y); ctx.rotate(-0.04); ctx.scale(D.s * 0.62, D.s * 0.62);
    sunglasses(ctx);
    ctx.restore();
  }
  if (snapped) {
    // ting! glint across the lenses + a sparkle
    const u = sSnap / 0.45;
    if (u < 1) {
      const k = u < 0.25 ? ease.outBack(u / 0.25) : 1 - ease.inCubic((u - 0.25) / 0.75);
      sparkle(ctx, ex - 40, ey - 18, 46 * k, '#ffffff', 1);
      sparkle(ctx, ex - 40, ey - 18, 80 * k, '#fff6c0', 0.35);
      sparkle(ctx, ex + 30, ey - 8, 20 * k, '#ffffff', 0.9);
    }
  }
}

export default {
  id: 's06_countdown',
  start: 36.137,
  end: 38.537,
  transition: { type: 'cut' },
  draw(ctx, t) {
    drawScene(ctx, clamp(t, T4 - 1.5, T_END + 1.5));
  },
};
