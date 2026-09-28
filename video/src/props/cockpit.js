// The S.S. Biscuit's capsule interior, shared by s06 countdown, s09 zero-g, s14 cockpit,
// s15 nebula, s17 homeward and s18 re-entry.
//
//   drawCockpit(ctx, o)       background layer, full 1920x1080 frame
//   drawCockpitFront(ctx, o)  foreground layer (dashboard / near frame) — call AFTER the
//                             scene has drawn the seated characters
//   COCKPIT_SEATS             where to put the characters (+ handy control positions)
//
// o: { t, view 'dash'|'cabin', window fn(ctx, cx, cy, r) (content seen through the window,
//      clipped for you; default = starfield), lights 0..1 (dashboard lights blink on beats),
//      shake 0..1, redButton 0..1 (pressed), homeSwitch 0..1 (HOME toggle flipped on),
//      tint 0..1 (red alarm wash + beacons), stick [dx, dy] (joystick tilt, -1..1),
//      joystick 'back'|'front'|'none' (layer the joystick is drawn in; default 'back' so a
//      hand drawn by the scene sits on top of the knob), photo bool (cabin photo, default true) }
//
// Pure function of its arguments; everything inside save()/restore().
import { W, H, INK, LW, PAL, FONT, ink, circlePath, rrectPath, sparkle, softStarPath } from '../draw.js';
import { TAU, clamp, lerp, hash01, noise1, rgba, ease, mixColor } from '../util.js';
import { pulse, beatAt, sway, kick, hat } from '../timing.js';
import { drawGirlHead } from '../characters/girl.js';
import { drawDogHead } from '../characters/dog.js';

// ---------------------------------------------------------------- layout
const WIN = { x: 960, y: 350, r: 250, rim: 40 }; // dash front window
const CWIN = { x: 1170, y: 400, r: 150, rim: 30 }; // cabin porthole
const CONSOLE_Y = 772; // top of the dashboard lip at the centre
const CONSOLE_DROP = 46; // how much lower the lip is at the frame edges
const consoleTop = (x) => CONSOLE_Y + CONSOLE_DROP * Math.pow((x - W / 2) / (W / 2), 2);
const JOY = { x: 600, y: 700 }; // joystick knob (rest)
const BTN = { x: 958, y: 722 }; // big red button cap
const HOME = { x: 848, y: 718 }; // HOME toggle plate centre
const BENCH = { x0: 600, x1: 1330, y: 742 }; // cabin bench seat top

export const COCKPIT_SEATS = {
  // dash: characters face the camera; heads/shoulders show above the dashboard.
  // (x, y, s) are for drawGirl/drawDog with stance 'sit' (girl facing 1, dog facing -1);
  // head = the resulting head centre (for drawGirlHead/drawDogHead close-ups at the same s).
  // arms = girl arm poses whose hands land on the controls (hands drawn over the knob/button).
  dash: {
    girl: {
      x: 730, y: 840, s: 1.2, head: { x: 734, y: 560 },
      arms: {
        joystick: { armL: { a: 1.8, b: -1.05 } }, // left hand (screen-left) on the joystick knob
        home: { armR: { a: 2.5, b: -2.25 } }, // right hand on the HOME lever knob (off)
        homeOn: { armR: { a: 1.95, b: -1.0 } }, // ...and after flipping it on (homeSwitch 1)
        redButton: { armR: { a: 2.0, b: 0 }, tilt: 0.4 }, // lean over and slam the button
      },
    },
    dog: { x: 1275, y: 790, s: 1.25, head: { x: 1242, y: 612 } },
    window: { x: WIN.x, y: WIN.y, r: WIN.r },
    joystick: { x: JOY.x, y: JOY.y + 12 }, // grip point
    redButton: { x: BTN.x, y: BTN.y - 14 }, // top of the cap
    homeSwitch: { x: HOME.x, y: HOME.y },
    consoleY: CONSOLE_Y,
  },
  // cabin: side cutaway; girl & dog sitting on the padded bench (floating scenes ignore it)
  cabin: {
    girl: { x: 860, y: 735, s: 0.95, head: { x: 863, y: 514 } },
    dog: { x: 1085, y: 722, s: 0.95, head: { x: 1060, y: 587 } }, // stance 'sit' or 'lie' on the bench
    lap: { x: 870, y: 712 }, // Juno's lap when she sits on the bench (curl Biscuit up here)
    window: { x: CWIN.x, y: CWIN.y, r: CWIN.r },
    benchY: BENCH.y - 22, // cushion top
    float: { x: 960, y: 560 }, // a good centre for zero-g floating
  },
};

// ---------------------------------------------------------------- palette
const C = {
  wall: '#3d6c7a', wallDark: '#2b5160', wallDeep: '#203f4c', wallLight: '#4f8391',
  bulk: '#4b7f8c', bulkShade: '#3b6b78',
  rib: '#77a6b1', ribShade: '#5a8894', ribHi: '#a6d0d8',
  brass: PAL.gold, brassShade: '#c7841c', brassHi: '#ffe7a6',
  copper: '#dd8a4c', copperShade: '#ad5f2c',
  face: '#2b3556', faceShade: '#1f2742', faceHi: '#3a4670',
  lip: '#f1e3c6', lipShade: '#cbb690',
  dial: '#fff6e2', steel: PAL.steel, steelShade: '#a3adc0', steelDark: PAL.greyDark,
  seat: PAL.red, seatShade: PAL.redDark, seatHi: '#ff8074',
  cream: PAL.cream, creamShade: '#e3cc9f',
  floor: '#4c5f86', floorShade: '#3b4b6e',
};
const LIGHT_COLS = ['#ff5a4f', '#5ef08a', '#ffd23f', '#5ab8ff', '#ff9a3d'];

// ---------------------------------------------------------------- helpers
function part(ctx, pathFn, base, lw, { shade, shadeFn, fx } = {}) {
  pathFn(); ctx.fillStyle = base; ctx.fill();
  if (shadeFn || fx) {
    ctx.save(); pathFn(); ctx.clip();
    if (shadeFn) { ctx.fillStyle = shade; shadeFn(); }
    if (fx) fx();
    ctx.restore();
  }
  if (lw > 0) { pathFn(); ink(ctx, null, lw); }
}
function rivet(ctx, x, y, r, col) { rivets(ctx, [[x, y, r]], col); }
// many rivets in two fills (one path each) — far cheaper than a fill per rivet
function rivets(ctx, pts, col, hi = true) {
  if (!pts.length) return;
  ctx.beginPath();
  for (const [x, y, r] of pts) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ctx.fillStyle = col; ctx.fill();
  if (!hi) return;
  ctx.beginPath();
  for (const [x, y, r] of pts) { const hx = x - r * 0.35, hy = y - r * 0.35; ctx.moveTo(hx + r * 0.4, hy); ctx.arc(hx, hy, r * 0.4, 0, TAU); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}
// Lune: the part of circle (cx,cy,R) not covered by the same circle shifted by (-dx,-dy);
// an exact shade crescent on the (dx,dy) side — no clipping needed.
function lunePath(ctx, cx, cy, R, dx, dy) {
  const d = Math.hypot(dx, dy);
  if (d <= 0 || d >= 2 * R) { circlePath(ctx, cx, cy, R); return; }
  const a = Math.atan2(dy, dx), b = Math.acos(-d / (2 * R));
  const p1 = a - b, p2 = a + b, ox = cx - dx, oy = cy - dy;
  const q2 = Math.atan2(cy + Math.sin(p2) * R - oy, cx + Math.cos(p2) * R - ox);
  const q1 = Math.atan2(cy + Math.sin(p1) * R - oy, cx + Math.cos(p1) * R - ox);
  ctx.beginPath(); ctx.arc(cx, cy, R, p1, p2, false); ctx.arc(ox, oy, R, q2, q1, true); ctx.closePath();
}
function shadedCircle(ctx, x, y, r, base, shade, lw, k = 0.16) {
  circlePath(ctx, x, y, r); ctx.fillStyle = base; ctx.fill();
  lunePath(ctx, x, y, r, r * k, r * k * 1.15); ctx.fillStyle = shade; ctx.fill();
  if (lw > 0) { circlePath(ctx, x, y, r); ink(ctx, null, lw); }
}
// Rounded rect with its shade on the right & bottom: the lit part is the same rect shrunk
// toward its top-left corner (always inside, so no clip).
function shadedRect(ctx, x, y, w, h, r, base, shade, lw, dx = 8, dy = 8) {
  rrectPath(ctx, x, y, w, h, r); ctx.fillStyle = shade; ctx.fill();
  const r2 = Math.min(r, (w - dx) / 2, (h - dy) / 2);
  rrectPath(ctx, x, y, w - dx, h - dy, r2); ctx.fillStyle = base; ctx.fill();
  if (lw > 0) { rrectPath(ctx, x, y, w, h, r); ink(ctx, null, lw); }
}
// flat toon glow: stacked translucent discs with additive blending (cheap vs gradients)
function halo(ctx, x, y, r, col, a, n = 2) {
  if (r <= 0.5 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(col, a);
  for (let i = 0; i < n; i++) { circlePath(ctx, x, y, r * (1 - i / (n + 0.5))); ctx.fill(); }
  ctx.restore();
}
// cheap batched starfield for window views (twinkles on hi-hats)
function stars(ctx, x0, y0, w, h, count, seed, t) {
  const hp = hat(t);
  const buckets = [[], [], []];
  for (let i = 0; i < count; i++) {
    const px = x0 + hash01(i, seed) * w, py = y0 + hash01(i, seed + 1) * h;
    const r = 1 + 2.2 * Math.pow(hash01(i, seed + 2), 2.5);
    const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hash01(i, seed + 4) * 3) + hash01(i, seed + 3) * TAU);
    const boost = hash01(i, seed + 5) < 0.3 ? hp : 0;
    const k = Math.min(2, Math.floor(tw * 2.2 + boost * 1.5));
    buckets[k].push([px, py, r * (1 + 0.5 * boost)]);
  }
  [0.35, 0.65, 1].forEach((a, k) => {
    if (!buckets[k].length) return;
    ctx.beginPath();
    for (const [x, y, r] of buckets[k]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fillStyle = rgba('#ffffff', a); ctx.fill();
  });
  for (let i = 0; i < count * 0.05; i++) {
    const px = x0 + hash01(i, seed + 9) * w, py = y0 + hash01(i, seed + 10) * h;
    sparkle(ctx, px, py, 5 + 5 * hash01(i, seed + 11) + 5 * hp, '#ffffff', 0.9);
  }
}
function tube(ctx, pts, w, col, lw = LW, hi = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = w + 2 * lw; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
  if (hi) {
    ctx.save(); ctx.translate(-w * 0.18, -w * 0.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = w * 0.22; ctx.stroke();
    ctx.restore();
  }
}
function shakeOff(t, shake) {
  if (shake <= 0) return [0, 0, 0];
  return [shake * 9 * noise1(t * 31, 1), shake * 7 * noise1(t * 29, 2), shake * 0.004 * noise1(t * 23, 3)];
}
function applyShake(ctx, o) {
  const [dx, dy, r] = shakeOff(o.t || 0, o.shake || 0);
  if (dx || dy) ctx.translate(dx, dy);
  if (r) { ctx.translate(W / 2, H / 2); ctx.rotate(r); ctx.translate(-W / 2, -H / 2); }
}
function defaultWindow(ctx, cx, cy, r, t) {
  ctx.fillStyle = '#140e36'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.fillStyle = 'rgba(70,50,150,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.1, r * 1.3, r * 0.9, 0, 0, TAU); ctx.fill();
  stars(ctx, cx - r, cy - r, 2 * r, 2 * r, Math.round(r * 0.45), 17, t);
  // a far little ringed planet for charm
  const px = cx + r * 0.42, py = cy + r * 0.3, pr = r * 0.13;
  ctx.beginPath(); ctx.ellipse(px, py, pr * 2, pr * 0.5, -0.3, 0, TAU);
  ctx.strokeStyle = rgba('#ffd9a0', 0.8); ctx.lineWidth = pr * 0.25; ctx.stroke();
  circlePath(ctx, px, py, pr); ink(ctx, '#e39bd6', Math.max(2, pr * 0.12));
}
function windowGlass(ctx, cx, cy, r, o, t) {
  ctx.save();
  circlePath(ctx, cx, cy, r); ctx.clip();
  if (typeof o.window === 'function') o.window(ctx, cx, cy, r);
  else defaultWindow(ctx, cx, cy, r, t);
  // glass reflection: soft diagonal streaks + inner rim shading
  ctx.fillStyle = 'rgba(200,230,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.1, cy + r * 0.1); ctx.lineTo(cx + r * 0.1, cy - r * 1.1);
  ctx.lineTo(cx + r * 0.45, cy - r * 1.1); ctx.lineTo(cx - r * 1.1, cy + r * 0.45); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy + r * 1.1); ctx.lineTo(cx + r * 1.1, cy - r * 0.5);
  ctx.lineTo(cx + r * 1.1, cy - r * 0.32); ctx.lineTo(cx - r * 0.32, cy + r * 1.1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.arc(cx, cy, r * 0.9, 0, TAU, true);
  ctx.fillStyle = 'rgba(10,8,30,0.28)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, Math.PI * 1.1, Math.PI * 1.38); ctx.stroke();
  ctx.lineWidth = r * 0.03;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.84, Math.PI * 1.43, Math.PI * 1.5); ctx.stroke();
  ctx.restore();
}
function brassRing(ctx, cx, cy, r, rim, lw, bolts = 12) {
  const R = r + rim;
  const ring = () => { ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.arc(cx, cy, r, 0, TAU, true); ctx.closePath(); };
  ring(); ctx.fillStyle = C.brass; ctx.fill();
  lunePath(ctx, cx, cy, R, rim * 0.22, rim * 0.26); ctx.fillStyle = C.brassShade; ctx.fill();
  // inner lip in shade
  ctx.beginPath(); ctx.arc(cx, cy, r + rim * 0.28, 0, TAU); ctx.arc(cx, cy, r, 0, TAU, true); ctx.fillStyle = C.brassShade; ctx.fill();
  ctx.strokeStyle = C.brassHi; ctx.lineWidth = rim * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, R - rim * 0.3, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  ring(); ink(ctx, null, lw);
  ctx.beginPath(); ctx.arc(cx, cy, r + rim * 0.28, 0, TAU); ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = lw * 0.4; ctx.stroke();
  const pts = [];
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * TAU + 0.13, rr = r + rim * 0.64;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rim * 0.13]);
  }
  ctx.beginPath();
  for (const [x, y, br] of pts) { ctx.moveTo(x + br, y); ctx.arc(x, y, br, 0, TAU); }
  ink(ctx, C.brassShade, lw * 0.3);
  ctx.beginPath();
  for (const [x, y, br] of pts) { ctx.moveTo(x - br * 0.3 + br * 0.4, y - br * 0.3); ctx.arc(x - br * 0.3, y - br * 0.3, br * 0.4, 0, TAU); }
  ctx.fillStyle = C.brassHi; ctx.fill();
}
// ---------------------------------------------------------------- dashboard pieces
function dial(ctx, x, y, r, value, lw, label, o = {}) {
  // bezel
  shadedCircle(ctx, x, y, r + 10, C.brass, C.brassShade, lw, 0.1);
  circlePath(ctx, x, y, r); ink(ctx, o.face || C.dial, lw * 0.6);
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  // red zone
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, lerp(a0, a1, 0.78), a1);
  ctx.strokeStyle = PAL.red; ctx.lineWidth = r * 0.14; ctx.lineCap = 'butt'; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.8, a0, lerp(a0, a1, 0.35));
  ctx.strokeStyle = PAL.green; ctx.stroke();
  // ticks
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (const big of [true, false]) {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      if ((i % 5 === 0) !== big) continue;
      const a = lerp(a0, a1, i / 10), r0 = r * (big ? 0.58 : 0.66), r1 = r * 0.74;
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    ctx.lineWidth = big ? 3 : 2; ctx.stroke();
  }
  // needle
  const a = lerp(a0, a1, clamp(value, -0.05, 1.05));
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.07); ctx.lineTo(r * 0.72, 0); ctx.lineTo(-r * 0.15, r * 0.07); ctx.closePath();
  ink(ctx, PAL.red, 2);
  ctx.restore();
  circlePath(ctx, x, y, r * 0.12); ink(ctx, C.steelDark, 2);
  // glass glint
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = r * 0.08; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r * 0.82, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();
  if (label) plate(ctx, x, y + r + 30, label, lw);
}
function plate(ctx, x, y, text, lw, size = 18) {
  ctx.save();
  ctx.font = `bold ${size}px ${FONT.round}`;
  const w = ctx.measureText(text).width + 22;
  rrectPath(ctx, x - w / 2, y - size * 0.75, w, size * 1.5, 6); ink(ctx, C.lip, lw * 0.5);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}
function lamp(ctx, x, y, r, col, on, lw) { lamps(ctx, [[x, y, r, col, on]], lw); }
function lamps(ctx, list, lw) {
  const q = (on) => (on > 0.02 ? Math.round(on * 4) / 4 : 0);
  const groups = new Map();
  for (const [x, y, r, col, on0] of list) {
    const on = q(on0);
    if (on > 0) { const k = 'h' + col + on; if (!groups.has(k)) groups.set(k, { col, a: 0.11 * on, halo: true, pts: [] }); groups.get(k).pts.push([x, y, r * 2.2]); }
    const fill = on > 0 ? mixColor(mixColor(col, INK, 0.55), col, on) : mixColor(col, INK, 0.6);
    if (!groups.has(fill)) groups.set(fill, { fill, pts: [] });
    groups.get(fill).pts.push([x, y, r]);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of groups.values()) if (g.halo) {
    ctx.beginPath(); for (const [x, y, r] of g.pts) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fillStyle = rgba(g.col, g.a); ctx.fill();
  }
  ctx.restore();
  for (const g of groups.values()) if (!g.halo) {
    ctx.beginPath(); for (const [x, y, r] of g.pts) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fillStyle = g.fill; ctx.fill();
  }
  ctx.beginPath(); for (const [x, y, r] of list) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  ink(ctx, null, lw * 0.45);
  ctx.beginPath();
  for (const [x, y, r, , on] of list) if (on > 0.3) { const hx = x - r * 0.3, hy = y - r * 0.3; ctx.moveTo(hx + r * 0.3, hy); ctx.arc(hx, hy, r * 0.3, 0, TAU); }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
}
function toggles(ctx, list, lw) {
  ctx.beginPath();
  for (const [x, y] of list) { ctx.moveTo(x - 8, y - 8); ctx.roundRect ? ctx.roundRect(x - 12, y - 8, 24, 16, 4) : ctx.rect(x - 12, y - 8, 24, 16); }
  ink(ctx, C.steelShade, lw * 0.4);
  const tips = list.map(([x, y, up, cap]) => {
    const a = up ? -0.45 : 0.45;
    return [x, y, x + Math.sin(a) * 22, y - Math.cos(a) * 22 * (up ? 1 : -0.4) - (up ? 0 : 8), cap];
  });
  ctx.beginPath();
  for (const [x, y, tx, ty] of tips) { ctx.moveTo(x, y); ctx.lineTo(tx, ty); }
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = C.steel; ctx.lineWidth = 4; ctx.stroke();
  const byCol = new Map();
  for (const tp of tips) { if (!byCol.has(tp[4])) byCol.set(tp[4], []); byCol.get(tp[4]).push(tp); }
  for (const [col, arr] of byCol) {
    ctx.beginPath(); for (const [, , tx, ty] of arr) { ctx.moveTo(tx + 5.5, ty); ctx.arc(tx, ty, 5.5, 0, TAU); }
    ctx.fillStyle = col; ctx.fill();
  }
  ctx.beginPath(); for (const [, , tx, ty] of tips) { ctx.moveTo(tx + 5.5, ty); ctx.arc(tx, ty, 5.5, 0, TAU); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
}
function lightsPattern(i, t, lights, seed) {
  // which lamps are lit; on beats (lights > 0) the pattern re-rolls and flashes
  const b = Math.floor(beatAt(t) + 1e-6);
  const steady = hash01(i, seed) < 0.55 ? 0.8 : 0;
  if (lights <= 0) return steady;
  const lit = hash01(i * 7 + 3, b * 13 + seed) < 0.55 ? 1 : 0;
  const p = pulse(t, 6);
  return lerp(steady, lit * (0.6 + 0.4 * p), clamp(lights));
}

// ---------------------------------------------------------------- DASH view
function dashBack(ctx, o) {
  const t = o.t || 0, lw = LW;
  // walls: flat tone steps around the window (lighter near it); rib rings hide the steps
  ctx.fillStyle = C.wallDeep; ctx.fillRect(-80, -80, W + 160, H + 160);
  circlePath(ctx, WIN.x, WIN.y, WIN.r + WIN.rim + 650); ctx.fillStyle = mixColor(C.wallDeep, C.wall, 0.55); ctx.fill();
  circlePath(ctx, WIN.x, WIN.y, WIN.r + WIN.rim + 360); ctx.fillStyle = C.wall; ctx.fill();
  circlePath(ctx, WIN.x, WIN.y, WIN.r + WIN.rim + 150); ctx.fillStyle = mixColor(C.wall, C.wallLight, 0.5); ctx.fill();
  // radial stringers (behind the ribs)
  const strAngles = [-2.75, -2.25, -1.82, -1.32, -0.9, -0.4, 0.08, 3.05];
  for (const a of strAngles) {
    const r0 = WIN.r + WIN.rim + 60, r1 = 1500;
    const w0 = 16, w1 = 70;
    const px = -Math.sin(a), py = Math.cos(a);
    ctx.beginPath();
    ctx.moveTo(WIN.x + Math.cos(a) * r0 + px * w0, WIN.y + Math.sin(a) * r0 + py * w0);
    ctx.lineTo(WIN.x + Math.cos(a) * r1 + px * w1, WIN.y + Math.sin(a) * r1 + py * w1);
    ctx.lineTo(WIN.x + Math.cos(a) * r1 - px * w1, WIN.y + Math.sin(a) * r1 - py * w1);
    ctx.lineTo(WIN.x + Math.cos(a) * r0 - px * w0, WIN.y + Math.sin(a) * r0 - py * w0);
    ctx.closePath();
    ink(ctx, C.wallDark, lw * 0.6);
  }
  // front bulkhead disc around the window
  {
    shadedCircle(ctx, WIN.x, WIN.y, WIN.r + WIN.rim + 70, C.bulk, C.bulkShade, lw, 0.06);
    {
      // panel seams radiating from the window
      ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.39;
        ctx.beginPath();
        ctx.moveTo(WIN.x + Math.cos(a) * (WIN.r + WIN.rim), WIN.y + Math.sin(a) * (WIN.r + WIN.rim));
        ctx.lineTo(WIN.x + Math.cos(a) * (WIN.r + WIN.rim + 80), WIN.y + Math.sin(a) * (WIN.r + WIN.rim + 80));
        ctx.stroke();
      }
      const bp = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const rr = WIN.r + WIN.rim + 48;
        bp.push([WIN.x + Math.cos(a) * rr, WIN.y + Math.sin(a) * rr, 4]);
      }
      rivets(ctx, bp, C.bulkShade);
    }
  }
  // hull rib rings (nearer = bigger & thicker)
  const rings = [[WIN.r + WIN.rim + 150, 24], [WIN.r + WIN.rim + 360, 34], [WIN.r + WIN.rim + 650, 50]];
  for (const [rr, w] of rings) {
    // visible angular spans only (the rest is off-frame or behind the dashboard)
    const spans = [];
    const N = 72;
    let st = null;
    for (let i = 0; i <= N; i++) {
      const a = -Math.PI + (i / N) * TAU;
      const px = WIN.x + Math.cos(a) * rr, py = WIN.y + Math.sin(a) * rr;
      const vis = px > -140 && px < W + 140 && py > -140 && py < CONSOLE_Y + 120;
      if (vis && st === null) st = a - TAU / N;
      if ((!vis || i === N) && st !== null) { spans.push([st, a + (vis ? 0 : 0)]); st = null; }
    }
    // filled annulus segments (cheaper than very wide strokes) + thin ink edges
    const band = (R0, R1) => {
      ctx.beginPath();
      for (const [a0, a1] of spans) {
        ctx.moveTo(WIN.x + Math.cos(a0) * R1, WIN.y + Math.sin(a0) * R1);
        ctx.arc(WIN.x, WIN.y, R1, a0, a1); ctx.arc(WIN.x, WIN.y, R0, a1, a0, true); ctx.closePath();
      }
    };
    band(rr - w / 2, rr + w / 2); ctx.fillStyle = C.rib; ctx.fill();
    band(rr + w * 0.08, rr + w / 2); ctx.fillStyle = C.ribShade; ctx.fill();
    ctx.beginPath();
    for (const [a0, a1] of spans) for (const R of [rr - w / 2, rr + w / 2]) {
      ctx.moveTo(WIN.x + Math.cos(a0) * R, WIN.y + Math.sin(a0) * R); ctx.arc(WIN.x, WIN.y, R, a0, a1);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.stroke();
    ctx.beginPath(); ctx.arc(WIN.x, WIN.y, rr - w * 0.3, Math.PI * 1.05, Math.PI * 1.6);
    ctx.strokeStyle = C.ribHi; ctx.lineWidth = w * 0.14; ctx.lineCap = 'round'; ctx.stroke();
    const n = Math.round((rr * TAU) / 80);
    const rp = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const bx = WIN.x + Math.cos(a) * rr, by = WIN.y + Math.sin(a) * rr;
      if (bx < -20 || bx > W + 20 || by < -20 || by > CONSOLE_Y + 20) continue;
      rp.push([bx, by, w * 0.12 + 1.5]);
    }
    rivets(ctx, rp, C.ribShade);
  }
  // copper pipes hugging the upper-left wall
  for (const [dr, col] of [[0, C.copper], [34, C.copper]]) {
    const pts = [];
    for (let i = 0; i <= 22; i++) { const a = lerp(Math.PI * 0.8, Math.PI * 1.4, i / 22); const rr = WIN.r + WIN.rim + 230 + dr; pts.push([WIN.x + Math.cos(a) * rr, WIN.y + Math.sin(a) * rr]); }
    tube(ctx, pts, 18, col, lw * 0.7);
    for (const k of [6, 14]) { const [px, py] = pts[k]; circlePath(ctx, px, py, 15); ink(ctx, C.copperShade, lw * 0.5); }
  }
  // valve wheel on the pipes
  {
    const a = Math.PI * 1.17, rr = WIN.r + WIN.rim + 247;
    const vx = WIN.x + Math.cos(a) * rr, vy = WIN.y + Math.sin(a) * rr;
    ctx.save(); ctx.translate(vx, vy); ctx.rotate(t * 0.5);
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = PAL.red; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = PAL.red; ctx.lineWidth = 7; ctx.stroke();
    circlePath(ctx, 0, 0, 7); ink(ctx, C.brass, 3);
    ctx.restore();
  }
  // star chart pinned on the upper-right wall (a nod to the constellations)
  {
    ctx.save(); ctx.translate(1560, 190); ctx.rotate(0.06);
    rrectPath(ctx, -110, -80, 220, 160, 8); ink(ctx, '#1f2f63', lw * 0.8);
    const pts = [[-70, 40], [-30, -10], [10, 20], [50, -40], [80, 10]];
    ctx.strokeStyle = rgba('#bfe6ff', 0.8); ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach(([x, y], i) => sparkle(ctx, x, y, 9 + 3 * hash01(i, 4), '#fff6c0'));
    ctx.fillStyle = PAL.red; circlePath(ctx, 0, -76, 8); ctx.fill(); // pin
    ctx.restore();
    ctx.save(); ctx.translate(1560, 190); ctx.rotate(0.06); ctx.fillStyle = INK; circlePath(ctx, 0, -76, 8); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  }
  // vent grille, left
  {
    ctx.save(); ctx.translate(250, 250); ctx.rotate(-0.25);
    rrectPath(ctx, -80, -48, 160, 96, 16); ink(ctx, C.wallDark, lw * 0.8);
    for (let i = 0; i < 5; i++) { rrectPath(ctx, -62, -34 + i * 15, 124, 7, 3.5); ctx.fillStyle = C.wallDeep; ctx.fill(); }
    ctx.restore();
  }
  // alarm beacons
  const tint = o.tint || 0;
  for (const bx of [300, 1620]) beacon(ctx, bx, 70, tint, t, lw);
  // window
  windowGlass(ctx, WIN.x, WIN.y, WIN.r, o, t);
  brassRing(ctx, WIN.x, WIN.y, WIN.r, WIN.rim, lw, 16);
  // swinging star charm hanging from the rim
  {
    const a = -1.05, ax = WIN.x + Math.cos(a) * (WIN.r + WIN.rim * 0.5), ay = WIN.y + Math.sin(a) * (WIN.r + WIN.rim * 0.5);
    const sw = 0.22 * sway(t, 2) + (o.shake || 0) * 0.5 * noise1(t * 9, 5);
    const L = 110;
    const ex = ax + Math.sin(sw) * L, ey = ay + Math.cos(sw) * L;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
    softStarPath(ctx, ex, ey + 22, 26, 15, 5, -Math.PI / 2 + sw); ink(ctx, PAL.yellow, lw * 0.7);
    ctx.fillStyle = '#ffffff'; circlePath(ctx, ex - 7, ey + 16, 4); ctx.fill();
    circlePath(ctx, ax, ay, 6); ink(ctx, C.brassShade, 2);
  }
  // seat backs
  seatBack(ctx, COCKPIT_SEATS.dash.girl.x, 332, 380, lw, 'star');
  seatBack(ctx, COCKPIT_SEATS.dash.dog.x, 420, 330, lw, 'bone');
  // controls that stick up above the console (drawn here so a hand can go over them)
  if ((o.joystick || 'back') === 'back') joystickItem(ctx, o, lw);
  redButtonItem(ctx, o.redButton || 0, t, lw);
  homeSwitchItem(ctx, o.homeSwitch || 0, t, lw);
}

function beacon(ctx, x, y, tint, t, lw) {
  // base + red dome; with tint it lights up and throws rotating beams
  if (tint > 0) {
    const a = t * 7 + x;
    ctx.save();
    ctx.globalAlpha *= 0.28 * tint;
    ctx.fillStyle = '#ff3b30';
    for (const k of [0, Math.PI]) {
      const aa = a + k;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(aa - 0.22) * 900, y + Math.sin(aa - 0.22) * 900);
      ctx.lineTo(x + Math.cos(aa + 0.22) * 900, y + Math.sin(aa + 0.22) * 900);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    halo(ctx, x, y - 20, 140, '#ff3b30', 0.22 * tint, 3);
  }
  rrectPath(ctx, x - 34, y - 70, 68, 26, 6); ink(ctx, C.steelShade, lw * 0.7);
  ctx.beginPath(); ctx.moveTo(x - 26, y - 44); ctx.lineTo(x - 26, y - 6); ctx.arc(x, y - 6, 26, Math.PI, 0, true); ctx.lineTo(x + 26, y - 44); ctx.closePath();
  const on = tint > 0 ? 0.5 + 0.5 * Math.abs(Math.sin(t * 7 + x)) : 0;
  ink(ctx, mixColor('#8c2a2a', '#ff6b5f', on * tint), lw * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 17, y - 38, 6, 26);
}

function seatBack(ctx, x, top, w, lw, emblem) {
  const h = H - top + 40;
  const sp = (xl = x - w / 2, xr = x + w / 2) => {
    const ww = xr - xl, xm = (xl + xr) / 2;
    ctx.beginPath();
    ctx.moveTo(xl, top + h);
    ctx.lineTo(xl, top + 90);
    ctx.bezierCurveTo(xl, top - 8, xm - ww * 0.3, top, xm, top);
    ctx.bezierCurveTo(xm + ww * 0.3, top, xr, top - 8, xr, top + 90);
    ctx.lineTo(xr, top + h);
    ctx.closePath();
  };
  sp(); ctx.fillStyle = C.seatShade; ctx.fill();
  sp(x - w / 2, x + w / 2 - 28); ctx.fillStyle = C.seat; ctx.fill();
  {
    {
      // tufted cushion panels + buttons
      ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 3;
      for (const k of [-0.2, 0.2]) {
        ctx.beginPath(); ctx.moveTo(x + k * w, top + 40); ctx.lineTo(x + k * w, top + h); ctx.stroke();
      }
      const bt = [];
      for (let r = 0; r < 4; r++) for (const k of [-0.2, 0.2]) bt.push([x + k * w, top + 90 + r * 95, 6]);
      rivets(ctx, bt, C.seatShade, false);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(x - w * 0.32, top + 70, 12, 34, 0.15, 0, TAU); ctx.fill();
      // emblem stitched at the top
      if (emblem === 'star') {
        // tucked into the upper-left corner so it clears the top of Juno's helmet (~28 px)
        softStarPath(ctx, x - w * 0.385, top + 50, 17, 9.5, 5, -Math.PI / 2 - 0.15); ink(ctx, PAL.yellow, lw * 0.5);
      } else {
        ctx.save(); ctx.translate(x, top + 46);
        for (const sg of [-1, 1]) {
          circlePath(ctx, sg * 20, -7, 9); ink(ctx, PAL.cream, lw * 0.5);
          circlePath(ctx, sg * 20, 7, 9); ink(ctx, PAL.cream, lw * 0.5);
        }
        rrectPath(ctx, -20, -7, 40, 14, 5); ctx.fillStyle = PAL.cream; ctx.fill();
        ctx.beginPath(); ctx.moveTo(-18, -7); ctx.lineTo(18, -7); ctx.moveTo(-18, 7); ctx.lineTo(18, 7);
        ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.5; ctx.stroke();
        ctx.restore();
      }
    }
  }
  sp(); ink(ctx, null, lw);
}

function joystickItem(ctx, o, lw) {
  const t = o.t || 0;
  const [sx0 = 0, sy0 = 0] = o.stick || [];
  const jig = (o.shake || 0) * 0.3;
  const sx = clamp(sx0 + jig * noise1(t * 17, 7), -1, 1), sy = clamp(sy0, -1, 1);
  const bx = JOY.x, by = CONSOLE_Y + 70;
  const kx = JOY.x + sx * 46, ky = JOY.y + Math.abs(sx) * 8 + sy * 16;
  // rubber boot
  ctx.beginPath(); ctx.ellipse(bx, by - 40, 46, 22, 0, 0, TAU); ink(ctx, '#2e2a3a', lw);
  ctx.beginPath(); ctx.ellipse(bx, by - 60, 30, 14, 0, 0, TAU); ink(ctx, '#3b3649', lw * 0.8);
  // shaft
  tube(ctx, [[bx, by - 60], [kx, ky + 20]], 14, C.steel, lw * 0.8);
  // grip + knob
  ctx.save(); ctx.translate(kx, ky); ctx.rotate(sx * 0.35);
  rrectPath(ctx, -17, -6, 34, 44, 12); ink(ctx, '#3b3649', lw * 0.8);
  shadedCircle(ctx, 0, -14, 28, PAL.red, PAL.redDark, lw, 0.25);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-10, -25, 8, 5, -0.6, 0, TAU); ctx.fill();
  rrectPath(ctx, 12, 0, 12, 14, 4); ink(ctx, PAL.yellow, lw * 0.5); // trigger
  ctx.restore();
}

function redButtonItem(ctx, p, t, lw) {
  const x = BTN.x, y = BTN.y;
  ctx.save();
  ctx.translate(x, y); ctx.scale(0.88, 0.88); ctx.translate(-x, -y);
  // pedestal with hazard stripes
  const ped = () => { ctx.beginPath(); ctx.moveTo(x - 84, CONSOLE_Y + 30); ctx.lineTo(x - 70, y + 14); ctx.lineTo(x + 70, y + 14); ctx.lineTo(x + 84, CONSOLE_Y + 30); ctx.closePath(); };
  part(ctx, ped, PAL.yellow, lw, {
    fx: () => {
      ctx.fillStyle = INK;
      for (let i = -6; i < 7; i++) {
        ctx.beginPath(); ctx.moveTo(x + i * 28, y + 14); ctx.lineTo(x + i * 28 + 14, y + 14); ctx.lineTo(x + i * 28 - 22, CONSOLE_Y + 40); ctx.lineTo(x + i * 28 - 36, CONSOLE_Y + 40); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(40,20,60,0.25)'; ctx.fillRect(x + 30, y, 70, 100);
    },
  });
  // bezel ring
  ctx.beginPath(); ctx.ellipse(x, y + 12, 66, 16, 0, 0, TAU); ink(ctx, C.steel, lw);
  // cap
  const pr = ease.outCubic(clamp(p));
  const capH = lerp(40, 16, pr), capY = y + 8;
  if (pr > 0.3) halo(ctx, x, capY - capH * 0.5, 150, '#ff5a4f', 0.14 * pr, 3);
  const cap = (k = 1) => {
    const hw = 50 * k, top = capY - capH * 1.3 * k;
    ctx.beginPath(); ctx.moveTo(x - 50, capY);
    ctx.bezierCurveTo(x - 50, top, x - 50 + 2 * hw, top, x - 50 + 2 * hw, capY);
    ctx.quadraticCurveTo(x - 50 + hw, capY + 12 * k, x - 50, capY); ctx.closePath();
  };
  cap(); ctx.fillStyle = PAL.redDark; ctx.fill();
  cap(0.8); ctx.fillStyle = pr > 0.3 ? '#ff5d4f' : PAL.red; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(x - 20, capY - capH * 0.68, 13, 6, -0.3, 0, TAU); ctx.fill();
  cap(); ink(ctx, null, lw);
  ctx.restore();
}

function homeSwitchItem(ctx, v, t, lw) {
  const x = HOME.x, y = HOME.y;
  const on = clamp(v);
  // plate: lever on top (so a hand can grab it), label along the bottom (stays readable)
  shadedRect(ctx, x - 56, y - 42, 112, 96, 14, C.lip, C.lipShade, lw);
  const txtCol = on > 0.5 ? PAL.red : '#9a5a52';
  ctx.save();
  ctx.font = `bold 22px ${FONT.round}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = txtCol; ctx.fillText('HOME', x + 10, y + 33);
  ctx.restore();
  // tiny house icon
  ctx.beginPath(); ctx.moveTo(x - 47, y + 35); ctx.lineTo(x - 38, y + 23); ctx.lineTo(x - 29, y + 35); ctx.lineTo(x - 29, y + 43); ctx.lineTo(x - 47, y + 43); ctx.closePath();
  ink(ctx, txtCol, 2.5);
  // indicator lamp
  lamp(ctx, x + 40, y - 2, 8, on > 0.5 ? '#5ef08a' : '#ff5a4f', on > 0.5 ? 1 : 0.3, lw);
  // toggle lever (flips from left/off to right/on)
  const a = lerp(-0.75, 0.75, ease.outBack(on));
  const px = x - 4, py = y + 4;
  rrectPath(ctx, px - 15, py - 8, 30, 17, 5); ink(ctx, C.steelShade, lw * 0.5);
  const tx = px + Math.sin(a) * 34, ty = py - Math.cos(a) * 34;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty);
  ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = C.steel; ctx.lineWidth = 5.5; ctx.stroke();
  circlePath(ctx, tx, ty, 8.5); ink(ctx, PAL.red, lw * 0.5);
}

function dashFront(ctx, o) {
  const t = o.t || 0, lw = LW;
  const lights = o.lights ?? 0.6;
  const shk = o.shake || 0;
  // console body
  const top = (x) => consoleTop(x);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-80, top(-80));
    for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, top(x)); }
    ctx.lineTo(W + 80, H + 80); ctx.lineTo(-80, H + 80); ctx.closePath();
  };
  body(); ctx.fillStyle = C.face; ctx.fill();
  // lip (top rounded edge) — exact band between curves, no clip needed
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); i ? ctx.lineTo(x, top(x) + 34) : ctx.moveTo(x, top(x) + 34); }
  for (let i = 24; i >= 0; i--) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, top(x)); }
  ctx.closePath();
  ctx.fillStyle = C.lip; ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); i ? ctx.lineTo(x, top(x) + 34) : ctx.moveTo(x, top(x) + 34); }
  for (let i = 24; i >= 0; i--) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, top(x) + 20); }
  ctx.closePath(); ctx.fillStyle = C.lipShade; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); i ? ctx.lineTo(x, top(x) + 6) : ctx.moveTo(x, top(x) + 6); }
  for (let i = 24; i >= 0; i--) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, top(x) + 11); }
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); i ? ctx.lineTo(x, top(x) + 34) : ctx.moveTo(x, top(x) + 34); }
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.8; ctx.stroke();
  // face panel shading: a flat darker band toward the bottom
  ctx.fillStyle = 'rgba(10,8,30,0.22)'; ctx.fillRect(-80, H - 70, W + 160, 160);
  // panel seams
  ctx.strokeStyle = rgba(INK, 0.6); ctx.lineWidth = 3;
  for (const x of [330, 660, 1260, 1590]) { ctx.beginPath(); ctx.moveTo(x, top(x) + 36); ctx.lineTo(x + (x - W / 2) * 0.08, H + 10); ctx.stroke(); }
  const fr = [];
  for (const x of [60, 320, 340, 650, 670, 1250, 1270, 1580, 1600, 1860]) for (const yy of [top(x) + 56, H - 40]) fr.push([x, yy, 4]);
  rivets(ctx, fr, C.faceHi);

  // --- left cluster (Juno) ---
  const wob = (i, base, amp = 0.08) => base + amp * noise1(t * 1.3 + i * 7, 31) + 0.06 * (t ? kick(t) : 0) + shk * 0.3 * noise1(t * 20 + i, 33);
  dial(ctx, 150, 900, 62, wob(0, 0.55), lw, 'FUEL');
  dial(ctx, 490, 900, 70, wob(1, 0.62 + 0.25 * shk, 0.12), lw, 'SPEED');
  // toggle row under Juno
  const tg = [], lp = [];
  for (let i = 0; i < 5; i++) {
    const up = hash01(i, 5) < 0.5 !== (shk > 0.5 && hash01(i, Math.floor(t * 8)) < 0.3);
    tg.push([250 + i * 34, 1030, up, i % 2 ? PAL.red : PAL.yellow]);
  }
  // --- centre: lamp rows + radar + toggles ---
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 11; i++) {
      const lx = 720 + i * 48, ly = 842 + r * 40;
      const on = lightsPattern(i + r * 11, t, lights, 3);
      lp.push([lx, ly, 11, LIGHT_COLS[(i + r * 2) % LIGHT_COLS.length], on]);
    }
  }
  radar(ctx, 960, 985, 70, t, lw, lights);
  for (let i = 0; i < 4; i++) {
    tg.push([740 + i * 38, 990, hash01(i, 9) < 0.6, LIGHT_COLS[i]]);
    tg.push([1066 + i * 38, 990, hash01(i, 11) < 0.4, LIGHT_COLS[(i + 2) % 5]]);
  }
  plate(ctx, 811, 1045, 'ZOOM', lw, 15);
  plate(ctx, 1123, 1045, 'BARK', lw, 15);
  // --- right cluster (Biscuit) ---
  dial(ctx, 1440, 900, 70, wob(2, 0.45 + 0.4 * (0.5 + 0.5 * Math.sin((t || 0) * Math.PI * 2 / 0.6))), lw, 'WAG-O-METER', { face: '#fff0f3' });
  dial(ctx, 1770, 900, 62, wob(3, 0.3), lw, 'SNACKS');
  // bone-shaped treat button
  {
    const x = 1610, y = 1030;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.1);
    const bone = () => {
      ctx.beginPath();
      for (const [cx, cy] of [[-26, -8], [-26, 8], [26, -8], [26, 8]]) { ctx.moveTo(cx + 11, cy); ctx.arc(cx, cy, 11, 0, TAU); }
      ctx.rect(-26, -8, 52, 16);
    };
    bone(); ctx.fillStyle = INK; ctx.lineWidth = lw * 1.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
    bone(); ctx.fillStyle = PAL.cream; ctx.fill();
    ctx.restore();
  }
  // right-edge small lamp column
  for (let i = 0; i < 4; i++) lp.push([1260 + 30 + i * 30, 1040, 9, LIGHT_COLS[(i + 3) % 5], lightsPattern(40 + i, t, lights, 8)]);
  for (let i = 0; i < 4; i++) lp.push([540 + i * 30, 1040, 9, LIGHT_COLS[(i + 1) % 5], lightsPattern(50 + i, t, lights, 9)]);
  lamps(ctx, lp, lw);
  toggles(ctx, tg, lw);
  body(); ink(ctx, null, lw);
  if (o.joystick === 'front') joystickItem(ctx, o, lw);
}

function radar(ctx, x, y, r, t, lw, lights) {
  circlePath(ctx, x, y, r + 10); ink(ctx, C.steelShade, lw);
  circlePath(ctx, x, y, r); ink(ctx, '#0f3b2e', lw * 0.5);
  ctx.save();
  circlePath(ctx, x, y, r); ctx.clip();
  ctx.strokeStyle = 'rgba(94,240,138,0.35)'; ctx.lineWidth = 2;
  for (const k of [0.33, 0.66]) { circlePath(ctx, x, y, r * k); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
  // sweep: one turn per bar (tempo-locked)
  const a = (beatAt(t) / 4) * TAU;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, a - (i + 1) * 0.12, a - i * 0.12);
    ctx.closePath(); ctx.fillStyle = rgba('#5ef08a', 0.32 * (1 - i / 6)); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  ctx.strokeStyle = '#b8ffcd'; ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const ba = hash01(i, 21) * TAU, br = r * (0.3 + 0.55 * hash01(i, 22));
    const since = ((a - ba) % TAU + TAU) % TAU;
    const f = Math.exp(-since * 1.2);
    ctx.fillStyle = rgba('#d8ffe4', 0.2 + 0.8 * f);
    circlePath(ctx, x + Math.cos(ba) * br, y + Math.sin(ba) * br, 4 + 3 * f); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r * 0.85, Math.PI * 1.1, Math.PI * 1.35); ctx.stroke();
}

// ---------------------------------------------------------------- CABIN view
const ceilY = (x) => 128 - 170 * Math.pow((x - W / 2) / (W / 2), 2);
const floorY = (x) => 872 + 130 * Math.pow((x - W / 2) / (W / 2), 2);
const RIBS_X = [150, 520, 1440, 1790];

function cabinBack(ctx, o) {
  const t = o.t || 0, lw = LW;
  // back wall: flat tone bands (lighter at eye level, where the lamp light pools)
  ctx.fillStyle = C.wallDark; ctx.fillRect(-80, -80, W + 160, H + 160);
  ctx.fillStyle = mixColor(C.wallDark, C.wall, 0.6); ctx.fillRect(-80, 250, W + 160, 620);
  ctx.fillStyle = C.wall; ctx.fillRect(-80, 330, W + 160, 440);
  // wall panels (seams)
  ctx.strokeStyle = rgba(INK, 0.25); ctx.lineWidth = 3;
  for (const x of [330, 760, 980, 1620]) { ctx.beginPath(); ctx.moveTo(x, ceilY(x)); ctx.lineTo(x, floorY(x)); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(-80, 330); ctx.lineTo(W + 80, 330); ctx.stroke();
  // ceiling (curved, darker, converging arches)
  const ceil = () => {
    ctx.beginPath(); ctx.moveTo(-80, -80);
    for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, ceilY(x)); }
    ctx.lineTo(W + 80, -80); ctx.closePath();
  };
  ceil(); ctx.fillStyle = C.wallDeep; ctx.fill();
  ctx.strokeStyle = rgba('#000000', 0.25); ctx.lineWidth = 12;
  for (let i = 1; i < 6; i++) {
    const x = lerp(-200, W + 200, i / 6);
    ctx.beginPath(); ctx.moveTo(x, ceilY(x) - 4); ctx.lineTo(W / 2 + (x - W / 2) * 0.35, -120); ctx.stroke();
  }
  ceil(); ink(ctx, null, lw);
  // floor: quilted padding
  const floor = () => {
    ctx.beginPath(); ctx.moveTo(-80, H + 80);
    for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, floorY(x)); }
    ctx.lineTo(W + 80, H + 80); ctx.closePath();
  };
  floor(); ctx.fillStyle = C.floor; ctx.fill();
  // shadow band where the floor meets the wall + quilting lines (computed to stay on the floor)
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); i ? ctx.lineTo(x, floorY(x)) : ctx.moveTo(x, floorY(x)); }
  for (let i = 24; i >= 0; i--) { const x = lerp(-80, W + 80, i / 24); ctx.lineTo(x, floorY(x) + 34); }
  ctx.closePath(); ctx.fillStyle = 'rgba(10,8,30,0.25)'; ctx.fill();
  ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = -8; i <= 8; i++) { const x0 = W / 2 + i * 150; ctx.moveTo(x0, floorY(x0) + 2); ctx.lineTo(W / 2 + i * 300, H + 40); }
  for (const dy of [60, 135]) {
    for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); i ? ctx.lineTo(x, floorY(x) + dy) : ctx.moveTo(x, floorY(x) + dy); }
  }
  ctx.stroke();
  floor(); ink(ctx, null, lw);
  // ribs: vertical arches continuing over the ceiling
  for (const x of RIBS_X) {
    const w = 40 + Math.abs(x - W / 2) * 0.03;
    const topPt = [W / 2 + (x - W / 2) * 0.45, -120];
    const pts = [[x, H + 60], [x, floorY(x)], [x, ceilY(x)], topPt];
    tube(ctx, [[x, floorY(x) + 6], [x, ceilY(x)]], w, C.rib, lw, false);
    tube(ctx, [[x, ceilY(x)], topPt], w * 0.9, C.ribShade, lw, false);
    ctx.fillStyle = C.ribShade; ctx.fillRect(x + w * 0.18, ceilY(x) + 4, w * 0.32, floorY(x) - ceilY(x) - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x - w * 0.36, ceilY(x) + 10, w * 0.12, floorY(x) - ceilY(x) - 20);
    const rr = [];
    for (let yy = ceilY(x) + 40; yy < floorY(x) - 20; yy += 70) rr.push([x, yy, 4.5]);
    rivets(ctx, rr, C.ribShade);
    void pts;
  }
  // handrail with brackets + handholds
  const railY = 610;
  tube(ctx, [[-80, railY], [W + 80, railY]], 14, C.steel, lw * 0.8);
  for (const x of RIBS_X) { rrectPath(ctx, x - 16, railY - 14, 32, 28, 6); ink(ctx, C.steelShade, lw * 0.6); }
  for (const x of [360, 690, 1400, 1640]) handhold(ctx, x, railY + 8, lw);
  // copper pipes along the ceiling edge + fairy lights
  for (const dy of [26, 60]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = lerp(-80, W + 80, i / 24); pts.push([x, ceilY(x) + dy]); }
    tube(ctx, pts, 20, C.copper, lw * 0.7);
    for (let i = 2; i < 24; i += 5) { const [px, py] = pts[i]; rrectPath(ctx, px - 9, py - 16, 18, 32, 5); ink(ctx, C.copperShade, lw * 0.5); }
  }
  fairyLights(ctx, t, lw, o.lights ?? 0.6);
  // lockers (left bay)
  locker(ctx, 196, 250, 150, 520, 'SNACKS', lw, 0);
  locker(ctx, 350, 250, 150, 520, 'TOYS', lw, 1);
  // photo of Juno & Biscuit taped up
  if (o.photo !== false) photo(ctx, 690, 330, t, lw);
  // round porthole (window fn)
  windowGlass(ctx, CWIN.x, CWIN.y, CWIN.r, o, t);
  brassRing(ctx, CWIN.x, CWIN.y, CWIN.r, CWIN.rim, lw, 12);
  // right bay: little wall panel with a screen + lamps
  wallPanel(ctx, 1615, 330, t, lw, o.lights ?? 0.6);
  // ceiling lamp + cosy warm light pools
  ceilingLamp(ctx, 760, ceilY(760) + 76, t, lw);
  halo(ctx, 760, 300, 560, '#ffb86b', 0.05, 3);
  // padded bench under the porthole
  bench(ctx, lw);
  // alarm beacon
  beacon(ctx, 1150, ceilY(1150) + 60, o.tint || 0, t, lw);
}

function handhold(ctx, x, y, lw) {
  ctx.beginPath(); ctx.moveTo(x - 28, y - 6); ctx.lineTo(x - 28, y + 30); ctx.quadraticCurveTo(x - 28, y + 50, x, y + 50); ctx.quadraticCurveTo(x + 28, y + 50, x + 28, y + 30); ctx.lineTo(x + 28, y - 6);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 12 + lw * 1.6; ctx.stroke();
  ctx.strokeStyle = PAL.yellow; ctx.lineWidth = 12; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 31, y + 4); ctx.lineTo(x - 31, y + 28); ctx.stroke();
}

function fairyLights(ctx, t, lw, lights) {
  const hooks = [];
  for (let i = 0; i <= 8; i++) { const x = lerp(40, W - 40, i / 8); hooks.push([x, ceilY(x) + 80]); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < hooks.length - 1; i++) {
    const [ax, ay] = hooks[i], [bx, by] = hooks[i + 1];
    ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 70, bx, by);
  }
  ctx.stroke();
  const bulbs = [];
  for (let i = 0; i < hooks.length - 1; i++) {
    const [ax, ay] = hooks[i], [bx, by] = hooks[i + 1];
    for (let k = 1; k <= 4; k++) {
      const u = k / 5;
      const px = lerp(ax, bx, u);
      const py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * ((ay + by) / 2 + 70) + u * u * by;
      const idx = i * 4 + k;
      bulbs.push([px, py + 10, LIGHT_COLS[idx % LIGHT_COLS.length], 0.55 + 0.45 * lightsPattern(idx, t, lights * 0.8, 77)]);
    }
  }
  lamps(ctx, bulbs.map(([px, py, col, on]) => [px, py, 7.5, col, on]), 2.5 / 0.45);
}
function locker(ctx, x, y, w, h, label, lw, seed) {
  shadedRect(ctx, x, y, w, h, 14, C.cream, C.creamShade, 0, 12, 10);
  ctx.fillStyle = rgba(INK, 0.55);
  for (let i = 0; i < 4; i++) { rrectPath(ctx, x + 28, y + 30 + i * 18, w - 56, 8, 4); ctx.fill(); }
  ctx.fillStyle = PAL.red; ctx.fillRect(x + 2, y + h - 36, w - 4, 12);
  rrectPath(ctx, x, y, w, h, 14); ink(ctx, null, lw);
  rrectPath(ctx, x + w - 34, y + h * 0.48, 14, 60, 7); ink(ctx, C.steel, lw * 0.6);
  plate(ctx, x + w / 2, y + 128, label, lw, 16);
  if (seed === 1) {
    softStarPath(ctx, x + 50, y + h * 0.62, 24, 13, 5, -1.3); ink(ctx, PAL.yellow, lw * 0.5);
  } else {
    // paw sticker
    ctx.fillStyle = PAL.red;
    ctx.save(); ctx.translate(x + 60, y + h * 0.63); ctx.rotate(0.2);
    ctx.beginPath(); ctx.ellipse(0, 6, 14, 11, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    for (const [bx, by] of [[-13, -9], [-4, -16], [6, -16], [14, -9]]) { ctx.moveTo(bx + 5, by); ctx.arc(bx, by, 5, 0, TAU); }
    ctx.fill();
    ctx.restore();
  }
}
function photo(ctx, x, y, t, lw) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.09);
  const pw = 170, ph = 190;
  rrectPath(ctx, -pw / 2, -ph / 2, pw, ph, 5); ink(ctx, '#fffdf5', lw * 0.7);
  // picture area (no clip: everything is placed to sit inside the window)
  const x0 = -pw / 2 + 12, y0 = -ph / 2 + 12, iw = pw - 24, ih = pw - 30;
  ctx.fillStyle = '#9fd6f6'; ctx.fillRect(x0, y0, iw, ih);
  ctx.fillStyle = '#c4e8fb'; ctx.fillRect(x0, y0 + ih * 0.45, iw, ih * 0.55);
  ctx.beginPath(); ctx.moveTo(x0, y0 + ih * 0.8); ctx.quadraticCurveTo(0, y0 + ih * 0.6, x0 + iw, y0 + ih * 0.78);
  ctx.lineTo(x0 + iw, y0 + ih); ctx.lineTo(x0, y0 + ih); ctx.closePath();
  ctx.fillStyle = PAL.grass; ctx.fill();
  drawGirlHead(ctx, -22, 2, 0.34, { expr: 'grin', t: 0, blink: 0, look: [0.3, 0], bust: false });
  drawDogHead(ctx, 38, 26, 0.32, { expr: 'happy', tongue: 1, t: 0, blink: 0, neck: false, facing: -1 });
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-pw / 2 + 12, -ph / 2 + 12, pw - 24, pw - 30);
  ctx.save();
  ctx.font = `bold 17px ${FONT.hand}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('me + Biscuit', -10, ph / 2 - 20);
  ctx.restore();
  ctx.save(); ctx.translate(58, ph / 2 - 21); ctx.scale(0.55, 0.55);
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-24, -6, -12, -22, 0, -10); ctx.bezierCurveTo(12, -22, 24, -6, 0, 10);
  ctx.fillStyle = PAL.red; ctx.fill();
  ctx.restore();
  // tape strips
  for (const [tx, ty, tr] of [[-pw / 2 + 8, -ph / 2 + 4, -0.7], [pw / 2 - 8, -ph / 2 + 4, 0.7]]) {
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(tr);
    ctx.fillStyle = 'rgba(255,248,210,0.75)'; ctx.fillRect(-24, -9, 48, 18);
    ctx.strokeStyle = 'rgba(29,26,47,0.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(-24, -9, 48, 18);
    ctx.restore();
  }
  ctx.restore();
}

function wallPanel(ctx, x, y, t, lw, lights) {
  shadedRect(ctx, x - 110, y - 90, 220, 250, 16, C.face, C.faceShade, lw, 10, 10);
  // little screen with a beating heart-line
  rrectPath(ctx, x - 80, y - 66, 160, 90, 10); ink(ctx, '#0f3b2e', lw * 0.6);
  ctx.save(); rrectPath(ctx, x - 80, y - 66, 160, 90, 10); ctx.clip();
  ctx.strokeStyle = '#5ef08a'; ctx.lineWidth = 3; ctx.beginPath();
  const ph = beatAt(t);
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, xx = x - 80 + u * 160;
    const k = ((u * 2 + ph) % 1);
    const yy = y - 20 - (k > 0.45 && k < 0.55 ? Math.sin((k - 0.45) / 0.1 * TAU) * 26 : 0);
    i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
  }
  ctx.stroke(); ctx.restore();
  lamps(ctx, [0, 1, 2, 3].map((i) => [x - 66 + i * 44, y + 60, 10, LIGHT_COLS[i], lightsPattern(60 + i, t, lights, 12)]), lw);
  toggles(ctx, [0, 1, 2, 3].map((i) => [x - 66 + i * 44, y + 118, hash01(i, 31) < 0.5, LIGHT_COLS[(i + 2) % 5]]), lw);
}

function ceilingLamp(ctx, x, y, t, lw) {
  ctx.beginPath(); ctx.moveTo(x, ceilY(x) + 30); ctx.lineTo(x, y - 30); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  halo(ctx, x, y + 14, 150, '#ffd98a', 0.13, 3);
  const shade = () => { ctx.beginPath(); ctx.moveTo(x - 20, y - 34); ctx.lineTo(x + 20, y - 34); ctx.lineTo(x + 52, y + 4); ctx.quadraticCurveTo(x, y + 14, x - 52, y + 4); ctx.closePath(); };
  shade(); ctx.fillStyle = PAL.teal; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 8, y - 34); ctx.lineTo(x + 20, y - 34); ctx.lineTo(x + 52, y + 4); ctx.quadraticCurveTo(x + 36, y + 8, x + 22, y + 9); ctx.closePath();
  ctx.fillStyle = '#1f968a'; ctx.fill();
  shade(); ink(ctx, null, lw * 0.8);
  circlePath(ctx, x, y + 12, 16); ink(ctx, '#fff4c2', lw * 0.6);
}

function bench(ctx, lw) {
  const { x0, x1, y } = BENCH;
  // base box
  const bh = floorY(x0) - y - 14;
  rrectPath(ctx, x0 + 20, y + 20, x1 - x0 - 40, bh, 10); ink(ctx, C.wallDark, lw);
  ctx.fillStyle = rgba(INK, 0.3);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) ctx.roundRect ? ctx.roundRect(x0 + 70 + i * 230, y + 50, 180, 50, 10) : ctx.rect(x0 + 70 + i * 230, y + 50, 180, 50);
  ctx.fill();
  // cushion
  shadedRect(ctx, x0, y - 22, x1 - x0, 50, 24, C.seat, C.seatShade, lw, 10, 12);
  ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { const xx = lerp(x0, x1, i / 4); ctx.moveTo(xx, y - 18); ctx.lineTo(xx, y + 22); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 + 30, y - 14, x1 - x0 - 200, 6);
  // pillow (left) + folded blanket with stars (right)
  ctx.save(); ctx.translate(x0 + 54, y - 44); ctx.rotate(-0.12);
  ctx.beginPath(); ctx.ellipse(0, 0, 58, 30, 0, 0, TAU); ctx.fillStyle = C.creamShade; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, -3, 52, 25, 0, 0, TAU); ctx.fillStyle = PAL.cream; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, 58, 30, 0, 0, TAU); ink(ctx, null, lw);
  ctx.restore();
  shadedRect(ctx, x1 - 170, y - 56, 150, 40, 14, '#5a7fe0', '#3f5fb8', lw, 6, 8);
  ctx.fillStyle = PAL.yellow;
  for (let i = 0; i < 3; i++) { softStarPath(ctx, x1 - 140 + i * 45, y - 36, 9, 5, 5); ctx.fill(); }
  shadedRect(ctx, x1 - 176, y - 24, 162, 22, 10, '#5a7fe0', '#3f5fb8', lw * 0.8, 4, 8);
}
function cabinFront(ctx, o) {
  const lw = LW;
  // near-camera frame ribs at the edges (darker: in shadow, close to camera)
  for (const [x, sg] of [[-30, 1], [W + 30, -1]]) {
    const r = () => {
      ctx.beginPath();
      ctx.moveTo(x - 90 * sg, -80); ctx.lineTo(x + 70 * sg, -80);
      ctx.quadraticCurveTo(x + 40 * sg, H / 2, x + 70 * sg, H + 80); ctx.lineTo(x - 90 * sg, H + 80); ctx.closePath();
    };
    r(); ctx.fillStyle = '#27495a'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + (sg > 0 ? 6 : -20), -80, 14, H + 160);
    const rr = [];
    for (let yy = 60; yy < H; yy += 110) rr.push([x + 26 * sg, yy, 6]);
    rivets(ctx, rr, '#1b3441');
    r(); ink(ctx, null, lw);
  }
  // hanging cable loop, top-left
  ctx.beginPath(); ctx.moveTo(40, -20); ctx.bezierCurveTo(140, 190, 330, 170, 420, -20);
  ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = '#3a5f70'; ctx.lineWidth = 8; ctx.stroke();
}

// ---------------------------------------------------------------- public API
export function drawCockpit(ctx, o = {}) {
  ctx.save();
  applyShake(ctx, o);
  if (o.view === 'cabin') cabinBack(ctx, o);
  else dashBack(ctx, o);
  ctx.restore();
}

export function drawCockpitFront(ctx, o = {}) {
  ctx.save();
  applyShake(ctx, o);
  if (o.view === 'cabin') cabinFront(ctx, o);
  else dashFront(ctx, o);
  ctx.restore();
  // alarm wash (unshaken, full frame)
  const tint = o.tint || 0;
  if (tint > 0) {
    const t = o.t || 0;
    const flash = 0.65 + 0.35 * Math.abs(Math.sin(t * 7));
    ctx.save();
    ctx.fillStyle = rgba('#ff2a2a', 0.26 * tint * flash);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}
