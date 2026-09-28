// s03_take_two — bar 7 (16.94 → 19.34). "Wait a beat" → TAKE 2.
//
//   16.94–17.47  silence: a Juno-scrawled clapperboard (SCENE 1 · TAKE 2) springs up into frame on a
//                dark night; a little held breath (it leans back) right before…
//   17.54 (b1)   CLACK — the guitar restarts: the arm slams shut ON the beat, burst lines, chalk dust,
//                tiny shake; the night "switches on" (sky brightens, house windows pop on).
//   17.62–17.95  the clapper hops and drops out of frame.
//   17.62–19.05  "STRINGS" is written across the sky as a constellation, letter by letter, by a
//                glowing string; letters complete ON the guitar plucks (18.15, 18.75, 18.90, 19.05)
//                and their stars pop; subtitle "a Juno & Biscuit adventure" pops on the 18.75 pluck.
//   19.05–19.34  hold: the title shimmers; Juno & Biscuit's tiny silhouettes on the barn roof
//                look up at it. (Flash cut to s04 on the drums.)
import { W, H, FONT, camera, shake, cartoonText, vGradient, glow, sparkle, starfield } from '../draw.js';
import { barTime, beatAt, pluck, GUITAR } from '../timing.js';
import { clamp, lerp, ease, hash01, noise1, rgba, TAU, mixColor } from '../util.js';
import { clapperboard } from '../props/items.js';
import { constellation } from '../props/space.js';
import { drawBackyard } from '../props/backyard.js';
import { drawGirl } from '../characters/girl.js';
import { drawDog } from '../characters/dog.js';

// ---------------------------------------------------------------- beat grid
const START = barTime(7); // 16.936 (silence)
const END = barTime(8); // 19.336 (drums in → s04)
const CLACK = barTime(7, 1); // 17.536 — guitar restarts
const LEAD = 1 / 60; // impact frames land half a frame early so the nearest 30 fps frame shows the hit
const HIT = CLACK - LEAD;

// guitar plucks after the clack (data-driven; fall back to the beat grid if the analysis changes)
const PL = GUITAR.filter((g) => g > CLACK + 0.2 && g < END - 0.15);
const P1 = PL[0] ?? barTime(7, 2); // 18.146
const P2 = PL[1] ?? barTime(7, 3); // 18.750
const P3 = PL[2] ?? barTime(7, 3.25); // 18.901
const P4 = PL[3] ?? barTime(7, 3.5); // 19.052

// ---------------------------------------------------------------- the title constellation
// Letters in a unit box (x right, y down, height 1 centred on 0). Points carry a star magnitude.
const L = {
  S: {
    pts: [[0.34, -0.36, 1], [0.12, -0.5, 0.7], [-0.16, -0.48, 0.8], [-0.33, -0.3, 0.7], [-0.2, -0.08, 0.7],
      [0.12, 0.04, 0.9], [0.33, 0.24, 0.7], [0.2, 0.46, 0.8], [-0.1, 0.5, 0.7], [-0.36, 0.36, 1]],
  },
  T: {
    pts: [[-0.4, -0.5, 1], [0, -0.5, 0.8], [0.4, -0.5, 1], [0, 0, 0.7], [0, 0.5, 1]],
    segments: [[0, 1], [1, 2], [1, 3], [3, 4]],
  },
  R: {
    pts: [[-0.3, 0.5, 1], [-0.3, 0, 0.7], [-0.3, -0.5, 1], [0.12, -0.5, 0.8], [0.34, -0.27, 0.9], [0.12, -0.02, 0.75], [0.36, 0.5, 1]],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [5, 6]],
  },
  I: {
    pts: [[-0.17, -0.5, 0.8], [0, -0.5, 1], [0.17, -0.5, 0.8], [0, 0, 0.7], [-0.17, 0.5, 0.8], [0, 0.5, 1], [0.17, 0.5, 0.8]],
    segments: [[0, 1], [1, 2], [1, 3], [3, 5], [4, 5], [5, 6]],
  },
  N: {
    pts: [[-0.32, 0.5, 1], [-0.32, 0, 0.7], [-0.32, -0.5, 1], [0, 0, 0.7], [0.32, 0.5, 1], [0.32, 0, 0.7], [0.32, -0.5, 1]],
  },
  G: {
    pts: [[0.33, -0.36, 1], [0.08, -0.5, 0.75], [-0.22, -0.42, 0.8], [-0.37, -0.08, 0.7], [-0.3, 0.3, 0.8], [0, 0.5, 0.75],
      [0.3, 0.4, 0.9], [0.36, 0.08, 0.8], [0.08, 0.08, 1]],
  },
};
const WORD = ['S', 'T', 'R', 'I', 'N', 'G', 'S'];
const LETTER_H = 232, ADV = 0.92 * LETTER_H, TITLE_Y = 330;
// Letter write windows: each letter is completed exactly on a pluck (T on P1, N on P2, G on P3, S on P4).
const WRITE0 = CLACK + 0.08;
const ENDS = [(WRITE0 + P1) / 2 + 0.05, P1, lerp(P1, P2, 0.42), lerp(P1, P2, 0.7), P2, P3, P4];
const WIN = ENDS.map((e, i) => [i === 0 ? WRITE0 : ENDS[i - 1], e]);
// pre-placed geometry (constant): a gentle smile-arc, letters tilted along it
const PLACED = WORD.map((ch, i) => {
  const def = L[ch];
  const k = i - (WORD.length - 1) / 2;
  const cx = W / 2 + k * ADV, cy = TITLE_Y + k * k * 7;
  const rot = k * 0.035 + (hash01(i, 71) - 0.5) * 0.05;
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = def.pts.map(([x, y, m]) => [cx + (x * c - y * s) * LETTER_H, cy + (x * s + y * c) * LETTER_H, m]);
  return { pts, segments: def.segments, cx, cy };
});
const STRING_COL = '#ffe3a0';

// ---------------------------------------------------------------- background
function sky(ctx, t, on) {
  // near-black before the clack → deep indigo night after it
  const k = on;
  vGradient(ctx, [
    [0, mixColor('#07061a', '#0b0a2e', k)],
    [0.3, mixColor('#0b0a20', '#231f66', k)], // soft lift behind the title
    [0.58, mixColor('#0b0a22', '#1b1a5a', k)],
    [1, mixColor('#120e2c', '#3a2f7a', k)],
  ]);
  const pk = pluck(t, 6) * k;
  starfield(ctx, { seed: 31, count: 240, t, minR: 0.8, maxR: 2.6, big: 0.05, alpha: 0.25 + 0.75 * k + 0.2 * pk, twinkle: 0.6 });
  starfield(ctx, { seed: 47, count: 40, t, minR: 1.6, maxR: 3.4, big: 0.3, alpha: (0.15 + 0.85 * k) * (0.85 + 0.3 * pk), twinkle: 1 });
}

// Barn + house rooflines along the bottom, in silhouette (lights pop on with the clack).
const CAM = { x: 980, y: -250, zoom: 0.66 };
function rooflines(ctx, t, on) {
  camera(ctx, CAM, () => {
    drawBackyard(ctx, { t, tod: 'night', sky: false, far: true, silhouette: 1, lights: on, fireflies: 0, pad: 'none', birds: false, craterSmoke: 0 });
    // tiny Juno & Biscuit on the barn ridge, seen from behind, looking up at the title
    // (upper right roof slope: peak (1840, -66) → (2056, 4); the weather vane sits on the peak)
    // (kept right of the vane so its arrow never crosses Juno's hair)
    const roofY = (x) => lerp(-66, 4, (x - 1840) / 216);
    drawGirl(ctx, 1972, roofY(1972) + 10, 0.5, { t, view: 'back', stance: 'sit', silhouette: 1, headTilt: -0.1 });
    drawDog(ctx, 2034, roofY(2034) + 8, 0.5, { t, view: 'back', stance: 'sit', silhouette: 1, look: [-0.5, -1] });
  });
}

// ---------------------------------------------------------------- the clapperboard
const CL_S = 2.6;
const CL_Y = 545;
function clapper(ctx, t) {
  if (t > CLACK + 0.55) return;
  // rise in (spring), hold, breath, CLACK, hop + drop
  const rise = ease.outBack(clamp((t - (START + 0.02)) / 0.36), 1.4);
  let y = lerp(H + 480, CL_Y, rise);
  let rot = lerp(-0.22, -0.03, rise);
  // handheld float while held
  y += 6 * Math.sin((t - START) * 5.1) * (t < HIT ? 1 : 0);
  rot += 0.012 * noise1((t - START) * 2.3, 5);
  // anticipation: lean back + lift a touch 0.16 s before the clack
  const ant = t < HIT ? ease.inOutQuad(clamp((t - (HIT - 0.2)) / 0.14)) : 0;
  y -= 14 * ant; rot -= 0.05 * ant;
  // clap arm: open until 2 frames before, slams shut ON the beat
  const clap = t >= HIT ? 1 : ease.inQuad(clamp((t - (HIT - 0.06)) / 0.06));
  // impact squash + recoil
  let sx = 1, sy = 1;
  if (t >= HIT) {
    const d = t - HIT;
    const sq = Math.exp(-14 * d) * Math.cos(d * 38);
    sx = 1 + 0.07 * sq; sy = 1 - 0.07 * sq;
    // hop then drop away
    const hop = ease.outQuad(clamp((d - 0.06) / 0.1));
    const fall = ease.inCubic(clamp((d - 0.16) / 0.3));
    y += -26 * hop * (1 - fall) + 900 * fall;
    rot += 0.5 * fall + 0.04 * Math.exp(-10 * d) * Math.sin(d * 30);
  }
  // burst lines at the clack: radiate from an ellipse that clears the slate, drawn BEHIND it
  // (the slate spans x 570..1350, arm top ≈ y 176, clap seam ≈ y 254)
  if (t >= HIT && t < HIT + 0.4) {
    const d = t - HIT, u = d / 0.4;
    const cx = W / 2, cy = CL_Y - 250; // centre of the stick area
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 15; i++) {
      const a = -Math.PI - 0.32 + (i / 14) * (Math.PI + 0.64) + (hash01(i, 3) - 0.5) * 0.1;
      const along = i % 2 ? 1.12 : 1;
      const r0 = along + 0.55 * ease.outCubic(u);
      const len = (120 + 90 * hash01(i, 5)) * (1 - u);
      const ox = cx + Math.cos(a) * 480 * r0, oy = cy + Math.sin(a) * 175 * r0;
      const nx = Math.cos(a) * 480, ny = Math.sin(a) * 175, nl = Math.hypot(nx, ny);
      ctx.strokeStyle = rgba('#fff6d8', 1 - u);
      ctx.lineWidth = 12 * (1 - u) + 2;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + (nx / nl) * len, oy + (ny / nl) * len);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(rot);
  ctx.scale(CL_S * sx, CL_S * sy);
  clapperboard(ctx, { clap, scene: '1', take: '2', title: 'STRINGS' });
  ctx.restore();
  // chalk dust knocked out of the jaw: a puff from the seam, mostly at the arm's free end (right)
  if (t >= HIT && t < HIT + 0.45) {
    const d = t - HIT, u = d / 0.45;
    const seamY = CL_Y - 112 * CL_S; // clap seam (hinge line)
    ctx.save();
    for (let i = 0; i < 30; i++) {
      const f = Math.pow(hash01(i, 9), 0.6); // biased toward the free end
      const px = lerp(620, 1340, f);
      const py = seamY + (hash01(i, 13) - 0.5) * 30;
      const vx = (f - 0.45) * 520 + (hash01(i, 10) - 0.5) * 200, vy = -140 - 320 * hash01(i, 11);
      const x = px + vx * d, yy = py + vy * d + 900 * d * d;
      const r = (2.5 + 4.5 * hash01(i, 12)) * (1 - 0.7 * u);
      ctx.fillStyle = rgba('#f4f1e6', 0.9 * (1 - u));
      ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU); ctx.fill();
    }
    // soft chalk haze at the striking end
    for (let i = 0; i < 3; i++) {
      const px = 1290 + 50 * i + 80 * ease.outCubic(u) * (0.5 + hash01(i, 21));
      const py = seamY - 6 - 40 * ease.outCubic(u) * hash01(i, 22);
      glow(ctx, px, py, (40 + 70 * ease.outCubic(u)) * (0.7 + 0.5 * hash01(i, 23)), '#f4f1e6', 0.3 * (1 - u));
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- title
function title(ctx, t, on) {
  if (on <= 0) return;
  for (let i = 0; i < WORD.length; i++) {
    const P = PLACED[i];
    const [a, b] = WIN[i];
    // the letter's stars fade in (dim) as the sky switches on; then the string writes it
    const pre = clamp((t - (CLACK + 0.05 + i * 0.05)) / 0.35);
    if (pre <= 0) continue;
    const prog = clamp((t - a) / (b - a));
    constellation(ctx, P.pts, prog, {
      t, segments: P.segments, color: STRING_COL, lw: 4.2, starSize: 11, glow: 0.9, alpha: pre, linear: false,
      vibrate: 0.8, dust: 0.8,
    });
    // pop on the pluck that completes the letter: flash + ring of sparkles
    const d = t - b;
    if (d >= -LEAD && d < 0.5) {
      const k = Math.exp(-7 * Math.max(0, d));
      const big = i === WORD.length - 1 ? 1.4 : 1;
      for (const [x, y, m] of P.pts) {
        glow(ctx, x, y, 70 * m * big * (0.6 + k), '#fff2c4', 0.55 * k);
        sparkle(ctx, x, y, 26 * m * big * (0.4 + 0.9 * k), '#ffffff', k);
      }
      const R = (50 + 150 * ease.outCubic(clamp(d / 0.45))) * big;
      for (let j = 0; j < 8; j++) {
        const ang = (j / 8) * TAU + i;
        sparkle(ctx, P.cx + Math.cos(ang) * R, P.cy + Math.sin(ang) * R * 0.9, 12 * (1 - clamp(d / 0.5)), '#fff6d0', 1 - clamp(d / 0.5));
      }
    }
  }
  // a twinkle wave runs across the finished word (19.1 → 19.34)
  const sw = (t - (P4 + 0.06)) / 0.26;
  if (sw > 0 && sw < 1.4) {
    PLACED.forEach((P, i) => {
      const k = Math.exp(-Math.pow((sw * 1.2 - i / (WORD.length - 1)) * 5, 2));
      if (k < 0.02) return;
      P.pts.forEach(([x, y, m], j) => {
        if ((j + i) % 2) return;
        sparkle(ctx, x, y, 30 * m * k, '#ffffff', k);
      });
    });
  }
  // subtitle pops on the 3rd-beat pluck
  const sub = clamp((t - (P2 - LEAD)) / 0.3);
  if (sub > 0) {
    const s = ease.outBack(sub, 2.2);
    const y = TITLE_Y + 232 + 12 * (1 - sub);
    cartoonText(ctx, 'a Juno & Biscuit adventure', W / 2, y, {
      size: 58, font: FONT.hand, fill: '#fff1d6', lw: 9, scale: s, alpha: sub, rot: -0.015,
    });
    // twinkles at the ends of the line
    const tw = 0.6 + 0.4 * Math.sin(beatAt(t) * Math.PI * 2);
    sparkle(ctx, W / 2 - 400 * s, y - 14, 18 * s * tw, '#fff6d0', sub);
    sparkle(ctx, W / 2 + 400 * s, y - 20, 14 * s * (1.4 - tw), '#fff6d0', sub);
  }
}

export default {
  id: 's03_take_two',
  start: 16.936,
  end: 19.336,
  transition: { type: 'cut' },
  draw(ctx, t) {
    // the night switches on at the clack
    const on = t < HIT ? 0 : ease.outCubic(clamp((t - HIT) / 0.45));
    const sh = shake(t, HIT, 16, 9, 26);
    ctx.save();
    ctx.translate(W / 2 + sh.dx, H / 2 + sh.dy);
    ctx.rotate(sh.rot);
    ctx.translate(-W / 2, -H / 2);
    // overscan so the shake never shows an edge
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1.03, 1.03); ctx.translate(-W / 2, -H / 2);
    sky(ctx, t, on);
    title(ctx, t, on);
    rooflines(ctx, t, on);
    ctx.restore();
    clapper(ctx, t);
    // flash pop at the clack
    if (t >= HIT && t < HIT + 0.12) {
      ctx.fillStyle = rgba('#fff8e8', 0.14 * (1 - (t - HIT) / 0.12));
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  },
};
