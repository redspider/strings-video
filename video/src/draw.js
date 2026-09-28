// Cartoon drawing primitives shared by every scene. House style:
//   flat fills + one darker shade + small highlight, thick rounded ink outline.
// All coordinates are in the 1920x1080 logical frame (the engine scales).
import { TAU, clamp, lerp, hash01, mixColor, rgba, noise1, ease } from './util.js';
import { hat } from './timing.js';

export const W = 1920;
export const H = 1080;
export const INK = '#1d1a2f'; // outline colour
export const LW = 6; // default outline width at 1080p

export const FONT = {
  title: '"Marker Felt", "Chalkboard SE", "Comic Sans MS", sans-serif',
  round: '"Arial Rounded MT Bold", "Avenir Next", sans-serif',
  hand: '"Chalkboard SE", "Comic Sans MS", sans-serif',
};

// Master palette — use these so every scene feels like one film.
export const PAL = {
  ink: INK,
  white: '#fffaf0',
  cream: '#fff1d6',
  red: '#e8453c',
  redDark: '#b52d2d',
  orange: '#ff8a3d',
  yellow: '#ffd23f',
  gold: '#f6b93b',
  green: '#5cc26b',
  grass: '#63b95a',
  grassDark: '#3f8f46',
  teal: '#2ec4b6',
  sky: '#7ec8f0',
  skyLight: '#bfe6ff',
  blue: '#3a86ff',
  navy: '#1b2a5c',
  space: '#0e0b26',
  spaceMid: '#231a4f',
  purple: '#7b4bd6',
  pink: '#ff7eb6',
  magenta: '#d6399a',
  brown: '#8a5a3b',
  wood: '#c98b52',
  woodDark: '#8f5a33',
  grey: '#9aa3b5',
  greyDark: '#5d6679',
  steel: '#cfd6e3',
  soot: '#2b2733',
};

// ---------- transforms ----------
export function withT(ctx, x, y, rot, sx, sy, fn) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== undefined && (sx !== 1 || (sy ?? sx) !== 1)) ctx.scale(sx, sy ?? sx);
  fn();
  ctx.restore();
}
export function withAlpha(ctx, a, fn) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  fn();
  ctx.restore();
}
// Camera: (cx, cy) is the world point shown at screen centre.
export function camera(ctx, { x = W / 2, y = H / 2, zoom = 1, rot = 0, dx = 0, dy = 0 } = {}, fn) {
  ctx.save();
  ctx.translate(W / 2 + dx, H / 2 + dy);
  if (rot) ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}
// Screen shake offset after an impact at t0.
export function shake(t, t0, amp = 30, decay = 5, freq = 23) {
  if (t < t0) return { dx: 0, dy: 0, rot: 0 };
  const k = amp * Math.exp(-decay * (t - t0));
  return {
    dx: k * noise1((t - t0) * freq, 11),
    dy: k * noise1((t - t0) * freq, 29),
    rot: (k / 2000) * noise1((t - t0) * freq, 47),
  };
}

// ---------- paths ----------
export function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
export function ellipsePath(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
}
export function rrectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Smooth Catmull-Rom curve through points [[x,y],...]
export function smoothPath(ctx, pts, closed = true, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const k = tension / 3;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k,
      p2[0], p2[1],
    );
  }
  if (closed) ctx.closePath();
}
export function starPath(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// Rounded star (softer, cuter) — control points pulled toward centre
export function softStarPath(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n;
    const a1 = a0 + Math.PI / n;
    const a2 = a0 + TAU / n;
    const p0 = [x + Math.cos(a0) * r1, y + Math.sin(a0) * r1];
    const c = [x + Math.cos(a1) * r2, y + Math.sin(a1) * r2];
    const p2 = [x + Math.cos(a2) * r1, y + Math.sin(a2) * r1];
    if (i === 0) ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(c[0], c[1], p2[0], p2[1]);
  }
  ctx.closePath();
}

// ---------- fill + ink ----------
export function ink(ctx, fill, lw = LW, stroke = INK) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) {
    ctx.lineWidth = lw; ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }
}
export function line(ctx, x1, y1, x2, y2, lw = LW, color = INK) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}
export function circle(ctx, x, y, r, fill, lw = LW, stroke = INK) { circlePath(ctx, x, y, r); ink(ctx, fill, lw, stroke); }
export function ellipse(ctx, x, y, rx, ry, fill, lw = LW, stroke = INK, rot = 0) { ellipsePath(ctx, x, y, rx, ry, rot); ink(ctx, fill, lw, stroke); }
export function rrect(ctx, x, y, w, h, r, fill, lw = LW, stroke = INK) { rrectPath(ctx, x, y, w, h, r); ink(ctx, fill, lw, stroke); }

// Draw a union of shapes with a single clean outline.
// shapes: [x, y, r] circles, or { rr: [x, y, w, h, radius] } rounded rects.
function shapePath(ctx, sh, grow) {
  if (Array.isArray(sh)) circlePath(ctx, sh[0], sh[1], sh[2] + grow);
  else { const [x, y, w, h, r] = sh.rr; rrectPath(ctx, x - grow, y - grow, w + 2 * grow, h + 2 * grow, r + grow); }
}
export function blobs(ctx, shapes, fill, lw = LW, stroke = INK) {
  if (lw > 0) {
    ctx.fillStyle = stroke;
    for (const sh of shapes) { shapePath(ctx, sh, lw / 2); ctx.fill(); }
  }
  ctx.fillStyle = fill;
  for (const sh of shapes) { shapePath(ctx, sh, -lw / 2 + 0.5); ctx.fill(); }
}
// Clip to the union of shapes (call inside save/restore)
export function clipBlobs(ctx, shapes) {
  ctx.beginPath();
  for (const sh of shapes) {
    if (Array.isArray(sh)) { ctx.moveTo(sh[0] + sh[2], sh[1]); ctx.arc(sh[0], sh[1], Math.max(0, sh[2]), 0, TAU); }
    else { const [x, y, w, h, r] = sh.rr; ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  }
  ctx.clip();
}

// Soft ground shadow
export function groundShadow(ctx, x, y, w, h = w * 0.18, a = 0.25) {
  ctx.save();
  ctx.fillStyle = rgba(INK, a);
  ellipsePath(ctx, x, y, w / 2, h / 2); ctx.fill();
  ctx.restore();
}

// Radial glow (additive-looking)
export function glow(ctx, x, y, r, color = '#fff6c0', a = 0.6) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.4, rgba(color, a * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------- stars & sparkles ----------
export function cartoonStar(ctx, x, y, r, fill = PAL.yellow, lw = LW * 0.8, rot = -Math.PI / 2) {
  softStarPath(ctx, x, y, r, r * 0.55, 5, rot);
  ink(ctx, fill, lw);
  // highlight
  ctx.save();
  ctx.globalAlpha *= 0.6;
  circlePath(ctx, x - r * 0.18, y - r * 0.2, r * 0.14); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}
// 4-point twinkle sparkle
export function sparkle(ctx, x, y, r, color = '#ffffff', a = 1) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

// Deterministic starfield covering (x0,y0,w,h). Twinkles on hi-hats.
// opts: { seed, count, x0, y0, w, h, minR, maxR, t, twinkle (0..1), color, big (fraction drawn as sparkles) }
export function starfield(ctx, opts) {
  const { seed = 1, count = 200, x0 = 0, y0 = 0, w = W, h = H, minR = 1, maxR = 3.2, t = 0,
    twinkle = 1, color = '#ffffff', big = 0.06, alpha = 1 } = opts;
  const hp = hat(t);
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < count; i++) {
    const px = x0 + hash01(i, seed) * w;
    const py = y0 + hash01(i, seed + 1) * h;
    const r = lerp(minR, maxR, Math.pow(hash01(i, seed + 2), 2.5));
    const ph = hash01(i, seed + 3) * TAU;
    const tw = 0.65 + 0.35 * Math.sin(t * (1.5 + hash01(i, seed + 4) * 3) + ph);
    const hatBoost = hash01(i, seed + 5) < 0.3 ? hp * twinkle : 0;
    const a = clamp(tw * (1 - 0.3 * twinkle) + hatBoost * 0.6);
    if (hash01(i, seed + 6) < big) {
      sparkle(ctx, px, py, r * (3.2 + 2.5 * hatBoost), color, a);
    } else {
      ctx.globalAlpha = alpha * a;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, r * (1 + 0.5 * hatBoost), 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- clouds / smoke / explosions ----------
// Puffy cartoon cloud centred at (x,y), roughly w x h, flat-ish base.
export function cloud(ctx, x, y, w, h, { seed = 1, fill = '#ffffff', shadow = '#d7e6f5', lw = LW, flatBase = true } = {}) {
  const n = 4 + Math.floor(hash01(seed, 3) * 3);
  const shapes = [];
  const baseH = h * 0.42;
  const baseY = y + h / 2 - baseH;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const cx = x - w / 2 + w * (0.16 + 0.68 * u);
    const bump = Math.sin(u * Math.PI);
    const r = h * (0.26 + 0.26 * bump) * (0.85 + 0.3 * hash01(i, seed));
    const cy = baseY + baseH * 0.35 - r * (0.35 + 0.55 * bump);
    shapes.push([cx, cy, r]);
  }
  if (flatBase) shapes.push({ rr: [x - w / 2, baseY, w, baseH, baseH / 2] });
  else shapes.push([x - w * 0.3, y + h * 0.1, h * 0.35], [x + w * 0.3, y + h * 0.1, h * 0.33]);
  blobs(ctx, shapes, fill, lw);
  // underside shade + top highlight, clipped to the cloud
  ctx.save();
  clipBlobs(ctx, shapes.map((s) => (Array.isArray(s) ? [s[0], s[1], s[2] - lw / 2] : { rr: [s.rr[0] + lw / 2, s.rr[1] + lw / 2, s.rr[2] - lw, s.rr[3] - lw, s.rr[4]] })));
  ctx.fillStyle = shadow;
  ellipsePath(ctx, x + w * 0.04, y + h / 2 + h * 0.02, w * 0.56, h * 0.26); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const top = shapes[Math.floor(n / 2)];
  ellipsePath(ctx, top[0] - top[2] * 0.3, top[1] - top[2] * 0.45, top[2] * 0.35, top[2] * 0.18, -0.4); ctx.fill();
  ctx.restore();
}

// A cluster of smoke puffs. u = 0..1 lifetime (grows, drifts, fades).
export function smokePuff(ctx, x, y, r, { seed = 1, u = 0.5, fill = '#e9e4ef', shadeCol = '#bdb5c9', lw = LW, n = 6 } = {}) {
  if (u <= 0 || u >= 1) return;
  const grow = ease.outCubic(clamp(u * 1.6));
  const fade = 1 - ease.inCubic(clamp((u - 0.55) / 0.45));
  const cs = [];
  for (let i = 0; i < n; i++) {
    const a = hash01(i, seed) * TAU;
    const d = r * 0.55 * hash01(i, seed + 7) * grow;
    cs.push([x + Math.cos(a) * d, y + Math.sin(a) * d - u * r * 0.3, r * (0.45 + 0.35 * hash01(i, seed + 3)) * grow]);
  }
  withAlpha(ctx, fade, () => {
    blobs(ctx, cs, fill, lw);
    blobs(ctx, cs.map(([a, b, rr]) => [a + rr * 0.15, b + rr * 0.2, rr * 0.7]), shadeCol, 0);
    blobs(ctx, cs.map(([a, b, rr]) => [a - rr * 0.1, b - rr * 0.1, rr * 0.72]), fill, 0);
  });
}

// Classic cartoon explosion. u: 0 (ignite) .. 1 (gone). Big spiky burst then smoke.
export function explosion(ctx, x, y, r, u, seed = 3) {
  if (u <= 0 || u >= 1) return;
  const burst = ease.outBack(clamp(u / 0.18));
  const fade = 1 - clamp((u - 0.35) / 0.4);
  // smoke ring behind
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + hash01(i, seed) * 0.5;
    const d = r * (0.5 + 0.9 * ease.outCubic(clamp(u * 1.4)));
    smokePuff(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * 0.45, {
      seed: seed + i, u: clamp(0.15 + u * 0.95), fill: '#8d8499', shadeCol: '#6b6378', n: 5,
    });
  }
  if (fade > 0) {
    withAlpha(ctx, fade, () => {
      const spikes = 11;
      const pts = (rr, jitter, sd) => {
        const p = [];
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * TAU + u * 0.6;
          const k = i % 2 ? 0.55 : 1 + jitter * (hash01(i, sd) - 0.5);
          p.push([x + Math.cos(a) * rr * k, y + Math.sin(a) * rr * k]);
        }
        return p;
      };
      const R = r * burst * (1 + 0.25 * u);
      ctx.beginPath(); pts(R * 1.15, 0.5, seed).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
      ink(ctx, PAL.red, LW * 1.2);
      ctx.beginPath(); pts(R * 0.85, 0.5, seed + 1).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
      ink(ctx, PAL.orange, 0);
      ctx.beginPath(); pts(R * 0.55, 0.6, seed + 2).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
      ink(ctx, PAL.yellow, 0);
      circle(ctx, x, y, R * 0.22, '#fffbe0', 0);
    });
  }
}

// Radial speed lines around (cx,cy) — anime/cartoon "whoosh"
export function speedLines(ctx, cx, cy, t, { count = 40, inner = 350, outer = 1300, color = '#ffffff', alpha = 0.5, seed = 5, lw = 5 } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const a = hash01(i, seed) * TAU;
    const ph = fractT(t * (1.5 + hash01(i, seed + 1) * 2) + hash01(i, seed + 2));
    const r0 = lerp(inner, outer, ph);
    const len = 80 + 220 * hash01(i, seed + 3);
    ctx.globalAlpha = alpha * Math.sin(ph * Math.PI);
    ctx.lineWidth = lw * (0.5 + hash01(i, seed + 4));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
  ctx.restore();
}
const fractT = (x) => x - Math.floor(x);

// Parallel speed streaks moving in direction `angle` (radians)
export function streaks(ctx, t, { angle = Math.PI, count = 30, speed = 2500, color = '#ffffff', alpha = 0.45, seed = 9, lw = 4, len = 260 } = {}) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(angle);
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  const span = 2600;
  for (let i = 0; i < count; i++) {
    const y = (hash01(i, seed) - 0.5) * 2000;
    const x = ((hash01(i, seed + 1) * span + t * speed * (0.6 + 0.8 * hash01(i, seed + 2))) % span) - span / 2;
    ctx.globalAlpha = alpha * (0.4 + 0.6 * hash01(i, seed + 3));
    ctx.lineWidth = lw * (0.5 + hash01(i, seed + 4));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * (0.5 + hash01(i, seed + 5)), y); ctx.stroke();
  }
  ctx.restore();
}

// ---------- backgrounds ----------
export function vGradient(ctx, stops, x = 0, y = 0, w = W, h = H) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
export function vignette(ctx, strength = 0.35, color = INK) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Cartoon planet with optional ring. opts: { base, dark, light, bands:[color..], ring, ringColor, craters, tilt, lw, seed }
export function planet(ctx, x, y, r, opts = {}) {
  const { base = PAL.orange, dark = mixColor(base, INK, 0.35), light = mixColor(base, '#ffffff', 0.35), bands = null,
    ring = false, ringColor = PAL.cream, craters = 0, tilt = -0.35, lw = LW, seed = 1, lightDir = -0.8 } = opts;
  const drawRing = (front) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt);
    ctx.beginPath();
    if (front) ctx.ellipse(0, 0, r * 1.9, r * 0.45, 0, 0, Math.PI);
    else ctx.ellipse(0, 0, r * 1.9, r * 0.45, 0, Math.PI, TAU);
    ctx.lineWidth = r * 0.22; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = r * 0.22 - lw * 2; ctx.strokeStyle = ringColor; ctx.stroke();
    ctx.lineWidth = r * 0.04; ctx.strokeStyle = mixColor(ringColor, INK, 0.25); ctx.stroke();
    ctx.restore();
  };
  if (ring) drawRing(false);
  circlePath(ctx, x, y, r);
  ctx.fillStyle = base; ctx.fill();
  ctx.save();
  circlePath(ctx, x, y, r); ctx.clip();
  if (bands) {
    bands.forEach((c, i) => {
      const by = y - r + ((i + 0.5) / bands.length) * 2 * r;
      ctx.save(); ctx.translate(x, by); ctx.rotate(tilt * 0.3);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.2, r * (0.08 + 0.06 * hash01(i, seed)), 0, 0, TAU); ctx.fill();
      ctx.restore();
    });
  }
  for (let i = 0; i < craters; i++) {
    const a = hash01(i, seed + 11) * TAU, d = Math.sqrt(hash01(i, seed + 12)) * r * 0.75;
    const cr = r * (0.06 + 0.1 * hash01(i, seed + 13));
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, cr, cr * 0.8, dark, lw * 0.5);
  }
  // terminator shade
  ctx.globalAlpha = 0.45;
  circlePath(ctx, x - lightDir * r * 0.35, y - lightDir * r * 0.35 * -0.6 + r * 0.25, r * 1.05);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.1, 0, TAU);
  ctx.arc(x + lightDir * r * 0.45, y - r * 0.3, r * 1.05, 0, TAU, true);
  ctx.fillStyle = dark; ctx.fill();
  ctx.globalAlpha = 0.5;
  ellipsePath(ctx, x + lightDir * r * 0.45, y - r * 0.5, r * 0.28, r * 0.16, -0.5);
  ctx.fillStyle = light; ctx.fill();
  ctx.restore();
  circlePath(ctx, x, y, r); ink(ctx, null, lw);
  if (ring) drawRing(true);
}

// ---------- text ----------
// Cartoon title text with ink outline + drop shadow. opts: { size, font, fill, stroke, lw, align, shadow, rot, scale, alpha, baseline }
export function cartoonText(ctx, str, x, y, opts = {}) {
  const { size = 120, font = FONT.title, fill = PAL.yellow, stroke = INK, lw = size * 0.12, align = 'center',
    shadow = true, rot = 0, scale = 1, alpha = 1, baseline = 'middle', weight = 'bold' } = opts;
  if (alpha <= 0 || scale <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  if (shadow) {
    ctx.fillStyle = rgba(INK, 0.35);
    ctx.lineWidth = lw; ctx.strokeStyle = rgba(INK, 0.35);
    ctx.strokeText(str, size * 0.05, size * 0.07); ctx.fillText(str, size * 0.05, size * 0.07);
  }
  ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(str, 0, 0);
  ctx.fillStyle = fill; ctx.fillText(str, 0, 0);
  ctx.restore();
}

// Speech bubble with a tail pointing at (tx,ty). Content drawn by fn(ctx) centred at (x,y).
export function speechBubble(ctx, x, y, w, h, tx, ty, { fill = '#ffffff', scale = 1, lw = LW, spiky = false, seed = 2 } = {}, fn) {
  if (scale <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y);
  // tail
  const ang = Math.atan2(ty - y, tx - x);
  const bx = x + Math.cos(ang) * w * 0.3, by = y + Math.sin(ang) * h * 0.3;
  const perp = ang + Math.PI / 2;
  const tw = Math.min(w, h) * 0.16;
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(perp) * tw, by + Math.sin(perp) * tw);
    ctx.quadraticCurveTo((bx + tx) / 2, (by + ty) / 2, tx, ty);
    ctx.lineTo(bx - Math.cos(perp) * tw, by - Math.sin(perp) * tw);
    ctx.closePath();
  };
  const body = () => {
    if (spiky) {
      const pts = [];
      const n = 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const k = i % 2 ? 1.0 : 1.22 + 0.1 * hash01(i, seed);
        pts.push([x + Math.cos(a) * (w / 2) * k, y + Math.sin(a) * (h / 2) * k]);
      }
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
    } else ellipsePath(ctx, x, y, w / 2, h / 2);
  };
  tail(); ink(ctx, fill, lw);
  body(); ink(ctx, fill, lw);
  tail(); ctx.fillStyle = fill; ctx.fill();
  if (fn) fn(ctx);
  ctx.restore();
}
