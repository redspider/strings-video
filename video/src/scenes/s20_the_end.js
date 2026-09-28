// s20 — THE END (bar 52, 124.94 → 128). The final drum hit.
//
//   124.94  the bottle rocket (launched in s19) BURSTS high over the yard on the final hit: white flash, a big
//           starburst + peony of sparks, and its sparks fly out to become the stars of "THE END", which the
//           glowing strings (the film's motif) then join up letter by letter (all legible by ~125.4).
//           Juno + Biscuit, silhouetted on the lawn below, leap up cheering — landing on every beat.
//   125.54  a pink star burst (left) · 126.14 a teal one (right) · 126.74 a gold one (top) — on the beats
//   …       glitter drips from the letters and drifts down; the engine fades to black 126.8 → 127.9.
import { W, H, camera, shake, glow, sparkle, starfield } from '../draw.js';
import { TAU, clamp, lerp, ease, hash01, rgba, mixColor } from '../util.js';
import { barTime, SPB, hop, pulse, sway } from '../timing.js';
import { drawBackyard } from '../props/backyard.js';
import { drawRocket } from '../props/rockets.js';
import { drawGirl } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';
import { constellation } from '../props/space.js';
import { YARD, popBottle, sideBlanket, bandSky } from './s19_backyard_night.js';

const T_HIT = barTime(52); // 124.943 final drum hit: BURST
const T_B1 = barTime(52, 1); // 125.543 pink burst
const T_B2 = barTime(52, 2); // 126.143 teal burst
const T_B3 = barTime(52, 3); // 126.743 gold burst (into the fade)

// ---------------------------------------------------------------- layout
const CAM = { x: 760, y: 247, zoom: 0.8 };
const toScreen = (wx, wy) => [W / 2 + (wx - CAM.x) * CAM.zoom, H / 2 + (wy - CAM.y) * CAM.zoom];
const BURST = [960, 250]; // screen
const SIL = { mul: '#1e1a3c', add: '#0c0a1e', addAmt: 0.62 }; // near-black grade for the landed rocket

// ---------------------------------------------------------------- "THE END" as constellations
// Letter skeletons in a unit box (x ≈ ±0.3, y −0.5 (top) .. 0.5 (baseline)); segments in draw order.
const GLYPHS = {
  T: { pts: [[-0.32, -0.5], [0, -0.5], [0.32, -0.5], [0, 0], [0, 0.5]], segs: [[0, 1], [1, 2], [1, 3], [3, 4]] },
  H: { pts: [[-0.28, -0.5], [-0.28, 0], [-0.28, 0.5], [0.28, -0.5], [0.28, 0], [0.28, 0.5]], segs: [[0, 1], [1, 2], [1, 4], [3, 4], [4, 5]] },
  E: { pts: [[0.27, -0.5], [-0.26, -0.5], [-0.26, 0], [0.16, 0], [-0.26, 0.5], [0.27, 0.5]], segs: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]] },
  N: { pts: [[-0.28, 0.5], [-0.28, 0], [-0.28, -0.5], [0.28, 0.5], [0.28, 0], [0.28, -0.5]], segs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  D: {
    pts: [[-0.26, -0.5], [-0.26, 0], [-0.26, 0.5], [0.06, 0.47], [0.27, 0.24], [0.31, 0], [0.27, -0.24], [0.06, -0.47]],
    segs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]],
  },
};
const LETTER_H = 200;
const LETTERS = (() => {
  const word = ['T', 'H', 'E', ' ', 'E', 'N', 'D'];
  const adv = 0.8 * LETTER_H, gap = 0.5 * LETTER_H;
  let x = 0;
  const xs = [];
  for (const ch of word) { if (ch === ' ') { x += gap; continue; } xs.push([ch, x]); x += adv; }
  const width = x - adv;
  const out = [];
  xs.forEach(([ch, lx], i) => {
    const g = GLYPHS[ch];
    const cx = BURST[0] - width / 2 + lx, cy = BURST[1] + 8;
    // a little hand-made jiggle so it looks written in the sky, not typeset
    const rot = (hash01(i, 5) - 0.5) * 0.12, bob = (hash01(i, 6) - 0.5) * 18;
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts = g.pts.map(([px, py], j) => {
      const x0 = px * LETTER_H, y0 = py * LETTER_H;
      return [cx + x0 * c - y0 * s, cy + bob + x0 * s + y0 * c, j === 0 || j === g.pts.length - 1 ? 1 : 0.8];
    });
    out.push({ ch, pts, segs: g.segs, i, col: ['#ffd23f', '#ffab5c', '#ff7eb6', '#c99bff', '#7fe0ff', '#8ff5c4'][i] });
  });
  return out;
})();
// when each letter's sparks land and its strings start drawing
const letterT0 = (i) => T_HIT + 0.1 + i * 0.045;
const STRING_DUR = 0.3;

// glow() clipped to the frame (a full-size radial fill of a 1300 px glow costs ~6 ms; screen coords only)
function screenGlow(ctx, x, y, r, color, a) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(0.4, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0));
  const x0 = Math.max(-40, x - r), y0 = Math.max(-40, y - r), x1 = Math.min(W + 40, x + r), y1 = Math.min(H + 40, y + r);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// ---------------------------------------------------------------- fireworks
const BURST_COLS = ['#ffd23f', '#ff7eb6', '#7fe8ff', '#ffffff', '#b48cff', '#ffb45c'];
// Peony: n sparks from (x, y) at time t0; drag + gravity; streak + twinkly head; crackle as they die.
function peony(ctx, t, t0, x, y, { n = 60, speed = 520, seed = 1, cols = BURST_COLS, life = 1.5, size = 1 } = {}) {
  const tau = t - t0;
  if (tau < 0 || tau > life + 0.3) return;
  const drag = 2.6, g = 170;
  const pos = (i, tt) => {
    const a = (i / n) * TAU + (hash01(i, seed) - 0.5) * 0.25;
    const v = speed * (0.55 + 0.45 * hash01(i, seed + 1));
    const r = (v / drag) * (1 - Math.exp(-drag * tt));
    return [x + Math.cos(a) * r, y + Math.sin(a) * r + 0.5 * g * tt * tt];
  };
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const li = life * (0.7 + 0.3 * hash01(i, seed + 2));
    if (tau > li) continue;
    const k = tau / li;
    const col = cols[Math.floor(hash01(i, seed + 3) * cols.length)];
    const [px, py] = pos(i, tau);
    const [qx, qy] = pos(i, Math.max(0, tau - 0.09));
    const fade = 1 - ease.inQuad(k);
    const crackle = k > 0.65 ? (hash01(i + Math.floor(t * 24) * 131, seed + 4) > 0.45 ? 1 : 0.15) : 1;
    ctx.globalAlpha = 0.85 * fade * crackle;
    ctx.strokeStyle = col; ctx.lineWidth = 4 * size * (1 - 0.5 * k);
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
    sparkle(ctx, px, py, (9 + 6 * hash01(i, seed + 5)) * size * (1 - 0.4 * k), i % 3 ? '#ffffff' : col, fade * crackle);
  }
  ctx.restore();
  // core flash
  const f = Math.exp(-7 * tau);
  if (f > 0.02) {
    glow(ctx, x, y, 260 * size, '#fff2c4', 0.7 * f);
    sparkle(ctx, x, y, 90 * size * (0.6 + 0.4 * f), '#ffffff', f);
  }
}
// Big cartoon starburst rays at the main hit.
function starburst(ctx, t) {
  const tau = t - T_HIT;
  if (tau < 0 || tau > 0.6) return;
  const k = tau / 0.6;
  const [x, y] = BURST;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + 0.12;
    const r0 = 60 + 700 * ease.outCubic(k) * (0.6 + 0.4 * hash01(i, 88));
    const len = (i % 2 ? 90 : 170) * (1 - k);
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = i % 2 ? '#fff6c0' : '#ffffff';
    ctx.lineWidth = (i % 2 ? 6 : 10) * (1 - 0.6 * k);
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len)); ctx.stroke();
  }
  ctx.restore();
}
// Sparks that fly from the burst to each letter star, arriving as its string starts.
function letterSparks(ctx, t) {
  for (const L of LETTERS) {
    const t1 = letterT0(L.i);
    L.pts.forEach(([tx, ty], j) => {
      const u = (t - T_HIT) / (t1 + j * 0.02 - T_HIT);
      if (u <= 0 || u >= 1.25) return;
      const e = ease.outCubic(clamp(u));
      const bend = (hash01(L.i * 17 + j, 9) - 0.5) * 120 * Math.sin(Math.PI * clamp(u));
      const dx = tx - BURST[0], dy = ty - BURST[1], d = Math.hypot(dx, dy) || 1;
      const px = BURST[0] + dx * e - (dy / d) * bend, py = BURST[1] + dy * e + (dx / d) * bend;
      const a = u < 1 ? 1 : 1 - (u - 1) / 0.25;
      const e2 = ease.outCubic(clamp(u - 0.12));
      const qx = BURST[0] + dx * e2, qy = BURST[1] + dy * e2;
      ctx.save();
      ctx.globalAlpha = 0.8 * a;
      ctx.strokeStyle = mixColor(L.col, '#ffffff', 0.3); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
      ctx.restore();
      sparkle(ctx, px, py, 14, '#ffffff', a);
    });
  }
}
// Glitter dripping off the letters and drifting down.
function glitter(ctx, t) {
  const N = 70;
  for (let i = 0; i < N; i++) {
    const L = LETTERS[i % LETTERS.length];
    const p = L.pts[Math.floor(hash01(i, 31) * L.pts.length)];
    const t0 = letterT0(L.i) + STRING_DUR + hash01(i, 32) * 1.9;
    const tau = t - t0, life = 1.1 + 0.6 * hash01(i, 33);
    if (tau < 0 || tau > life) continue;
    const k = tau / life;
    const x = p[0] + (hash01(i, 34) - 0.5) * 30 + 16 * Math.sin(tau * 5 + i);
    const y = p[1] + 40 * tau + 70 * tau * tau;
    const tw = 0.6 + 0.4 * Math.sin(t * 22 + i * 1.7);
    sparkle(ctx, x, y, (5 + 5 * hash01(i, 35)) * (1 - 0.5 * k), hash01(i, 36) < 0.5 ? '#ffffff' : L.col, (1 - k) * tw);
  }
}

// ---------------------------------------------------------------- draw
export default {
  id: 's20_the_end',
  start: 124.943,
  end: 128,
  transition: { type: 'cut' },
  draw(ctx, t) {
    t = Math.max(t, T_HIT - 0.5);
    // (the scene starts on the hit: never show a pre-burst frame even if a frame lands a hair before it)
    const tau = t >= 124.94 ? Math.max(0, t - T_HIT) : t - T_HIT;
    const flash = tau >= 0 ? Math.exp(-6 * tau) : 0;
    const sh = shake(t, T_HIT, 16, 5);

    // ---- sky (painted here; the yard below is silhouetted)
    bandSky(ctx, [[0, '#050823'], [0.45, '#111a4e'], [0.72, '#2c3d82'], [0.9, '#4d5da6'], [1, '#5a67aa']], 48);
    ctx.save();
    ctx.translate(sh.dx * 0.3, sh.dy * 0.3);
    starfield(ctx, { seed: 2020, count: 220, t, maxR: 2.4, big: 0.05, h: 820, alpha: 0.9 });
    // sky lit by the burst
    if (flash > 0.03) screenGlow(ctx, BURST[0], BURST[1], 760, '#ffe9b0', 0.45 * flash);
    ctx.restore();

    // ---- the burst + letters (behind the yard silhouettes)
    ctx.save();
    ctx.translate(sh.dx, sh.dy);
    // residual rising trail of the rocket from the bottle to the burst point
    const [bx, by] = toScreen(YARD.bottle[0], YARD.bottle[1] - 220 * YARD.bottleS);
    const tr = clamp(1 - tau / 0.45);
    if (tr > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6 * tr;
      ctx.strokeStyle = '#ffc861'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, y = lerp(by, BURST[1] + 30, u), x = lerp(bx, BURST[0], u) + Math.sin(u * 14) * 8 * (1 - u);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    starburst(ctx, t);
    peony(ctx, t, T_HIT, BURST[0], BURST[1], { n: 72, speed: 900, seed: 11, life: 1.7, size: 1.1 });
    // the letters: strings join the stars the sparks landed on
    for (const L of LETTERS) {
      const p = clamp((t - letterT0(L.i)) / STRING_DUR);
      if (t < letterT0(L.i) - 0.05) continue;
      const sag = Math.max(0, t - T_B2); // the letters start to droop like real firework letters
      const pts = sag > 0 ? L.pts.map(([x, y, m], j) => [x, y + 26 * sag * sag * (0.6 + 0.4 * hash01(L.i * 9 + j, 3)), m]) : L.pts;
      glow(ctx, (pts[0][0] + pts[pts.length - 1][0]) / 2, BURST[1] + 8, 125, L.col, 0.22 * p);
      constellation(ctx, pts, p, {
        t, segments: L.segs, color: L.col, lw: 7, glow: 1.2, starSize: 14, vibrate: 1, dust: 0.8,
        linear: false,
      });
    }
    letterSparks(ctx, t);
    glitter(ctx, t);
    peony(ctx, t, T_B1, 320, 170, { n: 50, speed: 680, seed: 21, cols: ['#ff7eb6', '#ffd1e6', '#ffffff'], life: 1.3, size: 0.95 });
    peony(ctx, t, T_B2, 1640, 150, { n: 50, speed: 680, seed: 31, cols: ['#7fe8ff', '#c9f6ff', '#ffffff'], life: 1.3, size: 0.95 });
    peony(ctx, t, T_B3, 1240, 60, { n: 44, speed: 600, seed: 41, cols: ['#ffd23f', '#fff1b0', '#ffffff'], life: 1.2, size: 0.9 });
    ctx.restore();

    // ---- the yard in silhouette (house windows stay lit), the landed rocket, the blanket
    camera(ctx, { x: CAM.x, y: CAM.y, zoom: CAM.zoom, dx: sh.dx, dy: sh.dy }, () => {
      drawBackyard(ctx, { t, tod: 'night', sky: false, far: false, silhouette: 0.84, crater: true, craterSmoke: 0, pad: 'wrecked', camX: CAM.x, camY: CAM.y, fireflies: 1 });
      drawRocket(ctx, YARD.rocketX, 860, 0.84, { t, legs: 1, hatch: 1, light: SIL });
      sideBlanket(ctx, YARD.blanket, SIL, 1);
      popBottle(ctx, YARD.bottle[0], YARD.bottle[1], YARD.bottleS, SIL, 1);
    });

    // ---- Juno + Biscuit cheering on the grass (foreground silhouettes), landing on every beat.
    // Juno from behind (watching the sky, arms up), Biscuit in profile bouncing beside her, nose up.
    const jumpK = tau < 0 ? 0 : clamp(tau / 0.08);
    const h = hop(t, 1);
    const firstBig = tau < SPB ? 1.35 : 1;
    const land = pulse(t, 12);
    const gx = 1010, gy = 1074; // in the sky gap between the tree and the rocket, under "END"
    // firework light spilling over the yard behind them (tinted by the latest burst), so the silhouettes
    // read against it
    // (one glow only: each extra near-full-frame radial fill costs ~1.2 ms here)
    const bursts = [[T_B1, '#ff7eb6'], [T_B2, '#7fe8ff'], [T_B3, '#ffd23f']];
    let tint = '#ffbf73', kick2 = 0;
    for (const [t0, col] of bursts) if (t >= t0) { const k = Math.exp(-4 * (t - t0)); tint = mixColor('#ffbf73', col, 0.6 * k); kick2 = k; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    screenGlow(ctx, gx + 130, gy - 230, 440, tint, 0.14 + 0.3 * flash + 0.08 * kick2);
    ctx.restore();
    ctx.save();
    ctx.translate(sh.dx * 0.8, sh.dy * 0.8);
    ctx.fillStyle = rgba('#000000', 0.35);
    ctx.beginPath(); ctx.ellipse(gx, gy + 4, 100 * (1 - 0.4 * h), 15, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(gx + 250, gy + 4, 70 * (1 - 0.4 * h), 12, 0, 0, TAU); ctx.fill();
    drawGirl(ctx, gx, gy, 1.05, {
      t, stance: 'jump', suit: 'space', helmet: 0, armL: 'cheer', armR: 'cheer', facing: 0.55,
      expr: 'laugh', look: [0.3, -0.8],
      lift: 115 * h * firstBig * jumpK, squash: 1 - 0.12 * land * jumpK, headTilt: 0.08 * sway(t, 2),
      silhouette: 0.72, shadow: false,
    });
    drawDog(ctx, gx + 250, gy - 160 * h * firstBig * jumpK, 1.0, {
      t, stance: 'jump', suit: 'space', facing: -1, expr: 'excited', wag: 1.4, look: [0, -1],
      tilt: 0.25 * h, squash: 1 - 0.15 * land * jumpK, silhouette: 0.72, rim: 1,
    });
    ctx.restore();
    // ---- flash
    if (flash > 0.01) { ctx.fillStyle = rgba('#fff1c8', 0.5 * Math.exp(-16 * Math.max(0, tau))); ctx.fillRect(0, 0, W, H); }
  },
};
