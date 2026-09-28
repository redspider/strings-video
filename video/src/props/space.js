// Space scenery, the baby star character and the constellation "strings" motif.
// Everything is a pure function of its arguments (and of `o.t` for animation).
import { W, H, INK, LW, circlePath, ellipsePath, smoothPath, glow, sparkle } from '../draw.js';
import { TAU, clamp, lerp, hash01, noise1, mixColor, rgba, ease, fract } from '../util.js';
import { hat, pulse, hop, sway, beatAt } from '../timing.js';

// Uniform scale of the current transform (for level-of-detail decisions).
function transformScale(ctx) {
  if (!ctx.getTransform) return 1;
  const m = ctx.getTransform();
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}
// Parameter sub-ranges [[b0,b1],..] of the ellipse arc (rx, ry, a0..a1), in the current frame, that land on the
// canvas (plus a margin) and lie outside the disc of radius `hide` (something opaque drawn over it later).
// Used to avoid stroking long arcs that nobody will see.
function visibleArcs(ctx, rx, ry, a0, a1, hide = 0, margin = 24) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const cw = ctx.canvas && ctx.canvas.width, ch = ctx.canvas && ctx.canvas.height;
  const N = 48, out = [];
  const vis = (a) => {
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    if (hide > 0 && x * x + y * y < hide * hide) return false;
    if (!m || !cw || !ch) return true;
    const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f;
    return X > -margin && X < cw + margin && Y > -margin && Y < ch + margin;
  };
  let start = -1;
  for (let i = 0; i <= N; i++) {
    const v = vis(a0 + ((a1 - a0) * i) / N);
    if (v && start < 0) start = Math.max(0, i - 1);
    if (start >= 0 && (!v || i === N)) { out.push([a0 + ((a1 - a0) * start) / N, a0 + ((a1 - a0) * i) / N]); start = -1; }
  }
  return out;
}
// Returns inside(x, y, extra = 0): is the current-frame point on the canvas (± margin + extra device px)?
// Always true when the transform / canvas size can't be read.
function canvasTest(ctx, margin = 30) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const cw = ctx.canvas && ctx.canvas.width, ch = ctx.canvas && ctx.canvas.height;
  if (!m || !cw || !ch) return () => true;
  const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  return (x, y, extra = 0) => {
    const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f, g = margin + extra * sc;
    return X > -g && X < cw + g && Y > -g && Y < ch + g;
  };
}
// Adds polyline pts to the current path, leaving out runs whose points (and neighbours) are all off canvas.
function polyOnCanvas(ctx, pts, inside) {
  const n = pts.length, vis = pts.map(([x, y]) => inside(x, y));
  let pen = false;
  for (let j = 0; j < n; j++) {
    if (!(vis[j] || (j > 0 && vis[j - 1]) || (j < n - 1 && vis[j + 1]))) { pen = false; continue; }
    pen ? ctx.lineTo(pts[j][0], pts[j][1]) : ctx.moveTo(pts[j][0], pts[j][1]);
    pen = true;
  }
}
// Outline width for an object of radius r drawn directly in frame pixels.
const olw = (r, k = 0.035) => clamp(r * k, 2, LW * 1.15);
const PI = Math.PI;

// ---------------------------------------------------------------------------
// palettes
// ---------------------------------------------------------------------------
export const SPACE_HUES = {
  violet: { top: '#0d0a28', mid: '#1f1650', bot: '#3d2772', glow: '#8a5cf0',
    neb: ['#8a5cf0', '#ff7eb6', '#4f6bd8', '#2ec4b6', '#c77dff'] },
  blue: { top: '#050b24', mid: '#0e2152', bot: '#1d4288', glow: '#3a86ff',
    neb: ['#3a86ff', '#2ec4b6', '#7b4bd6', '#8fd3ff', '#5f7cff'] },
  teal: { top: '#031218', mid: '#082d3a', bot: '#0f5058', glow: '#2ec4b6',
    neb: ['#2ec4b6', '#3a86ff', '#6fe8b8', '#7b4bd6', '#4fd1e0'] },
  magenta: { top: '#130620', mid: '#341046', bot: '#661d68', glow: '#e0489e',
    neb: ['#e0489e', '#ff7eb6', '#7b4bd6', '#ffab6b', '#c24fd6'] },
  pink: { top: '#0f0a26', mid: '#2a1450', bot: '#51246e', glow: '#ff7eb6',
    neb: ['#ff7eb6', '#2ec4b6', '#b388ff', '#ffc2e0', '#4fd1e0'] },
};
const STAR_TINTS = ['#ffffff', '#ffffff', '#ffffff', '#fff1c4', '#cfe4ff', '#ffd6ec'];

// ---------------------------------------------------------------------------
// small local helpers
// ---------------------------------------------------------------------------
function softBlob(ctx, x, y, rx, ry, col, a, rot = 0) {
  if (a <= 0 || rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.45, rgba(col, a * 0.55));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
}
// Radial glow filled as a disc (or an annulus when inner > 0) — cheaper than filling the bounding square.
function glowRing(ctx, x, y, r0, r1, color, a0, a1 = 0) {
  if (r1 <= r0 || (a0 <= 0 && a1 <= 0)) return;
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, rgba(color, a0));
  g.addColorStop(0.35, rgba(color, a0 * 0.4 + a1 * 0.6));
  g.addColorStop(1, rgba(color, a1));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r1, 0, TAU);
  if (r0 > 0) { ctx.moveTo(x + r0, y); ctx.arc(x, y, r0, 0, TAU, true); }
  ctx.fill();
}
// Vertical gradient drawn as opaque horizontal bands (much cheaper than a gradient fill; steps are sub-8-bit).
function bandFill(ctx, stops, y0, y1, x0 = -4, x1 = W + 4, n = 72) {
  const h = (y1 - y0) / n;
  const colAt = (u) => {
    for (let i = 1; i < stops.length; i++) {
      if (u <= stops[i][0]) { const [ua, ca] = stops[i - 1], [ub, cb] = stops[i]; return mixColor(ca, cb, (u - ua) / (ub - ua || 1)); }
    }
    return stops[stops.length - 1][1];
  };
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colAt((i + 0.5) / n);
    ctx.fillRect(x0, y0 + i * h, x1 - x0, h + 1);
  }
}
function noisyBlobPath(ctx, x, y, rx, ry, seed, n = 12, jag = 0.35, rot = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 - jag / 2 + jag * hash01(i, seed);
    const px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
    pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  smoothPath(ctx, pts, true);
}
function blobPts(x, y, rx, ry, seed, n = 12, jag = 0.3, rot = 0) {
  const pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 - jag / 2 + jag * hash01(i, seed);
    const px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
    pts.push([x + px * c - py * s, y + px * s + py * c]);
  }
  return pts;
}
// Feathered flat fill: three nested copies of a noisy blob (scaled about (x,y) by 1 / .88 / .76) sharing the alpha
// .35 / .35 / .3, so the edge fades out in three soft steps (a tiny twist per copy keeps the steps from reading as
// perfectly parallel contour rings).
const FEATHER = [[1, 0.35], [0.88, 0.35], [0.76, 0.3]];
function featherBlob(ctx, x, y, rx, ry, seed, col, a, rot = 0, n = 12, jag = 0.3) {
  if (a <= 0) return;
  for (let j = 0; j < 3; j++) {
    const [k, f] = FEATHER[j];
    smoothPath(ctx, blobPts(x, y, rx * k, ry * k, seed, n, jag, rot + (j - 1) * 0.045), true);
    ctx.fillStyle = rgba(col, a * f);
    ctx.fill();
  }
}
function rotSparkle(ctx, x, y, r, rot, color, a) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  sparkle(ctx, 0, 0, r, color, a);
  ctx.restore();
}
function strokeInk(ctx, lw, color = INK) {
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
// Crescent = disc A minus disc B (exact path, so no clip is needed).
function crescentPath(ctx, ax, ay, ar, bx, by, br) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  ctx.beginPath();
  if (d + ar <= br) return false; // A fully covered by B
  if (d >= ar + br || d < 1e-6) { ctx.arc(ax, ay, ar, 0, TAU); return true; }
  const phi = Math.atan2(dy, dx);
  const alpha = Math.acos(clamp((ar * ar - br * br + d * d) / (2 * d * ar), -1, 1));
  const p1 = phi + alpha, p2 = phi - alpha;
  ctx.arc(ax, ay, ar, p1, p2 + TAU, false);
  const q2 = Math.atan2(ay + ar * Math.sin(p2) - by, ax + ar * Math.cos(p2) - bx);
  const q1 = Math.atan2(ay + ar * Math.sin(p1) - by, ax + ar * Math.cos(p1) - bx);
  ctx.arc(bx, by, br, q2, q1, true);
  ctx.closePath();
  return true;
}
// Crescent shadow on the side away from the light (upper-left light).
function discShade(ctx, x, y, r, color, a, off = 0.42, grow = 1.12) {
  if (a <= 0) return;
  if (!crescentPath(ctx, x, y, r, x - r * off, y - r * off * 0.9, r * grow)) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// starfield layers + background
// ---------------------------------------------------------------------------
function starLayer(ctx, L) {
  const { t, seed, count, rate, dx, dy, minR, maxR, bigFrac, bright, band, bandAng } = L;
  const M = 40, SW = W + 2 * M, SH = H + 2 * M;
  const b = beatAt(t), hp = hat(t);
  const base = ctx.globalAlpha;
  for (let i = 0; i < count; i++) {
    let hx = hash01(i, seed), hy = hash01(i, seed + 1);
    if (band && hash01(i, seed + 9) < band) {
      // cluster along a diagonal "milky way" band
      const off = (hash01(i, seed + 10) + hash01(i, seed + 11) + hash01(i, seed + 12) - 1.5) * 0.16;
      hy = 0.5 + (hx - 0.5) * Math.tan(bandAng) * (SW / SH) + off;
    }
    const px = ((((hx * SW - dx * rate) % SW) + SW) % SW) - M;
    const py = ((((hy * SH - dy * rate) % SH) + SH) % SH) - M;
    const rr = lerp(minR, maxR, Math.pow(hash01(i, seed + 2), 2.4));
    const per = [2, 4, 8][Math.floor(hash01(i, seed + 3) * 3)];
    const tw = 0.74 + 0.26 * Math.sin(TAU * (b / per + hash01(i, seed + 4)));
    const hb = hash01(i, seed + 5) < 0.32 ? hp : 0;
    const a = clamp(bright * (tw + hb * 0.8));
    const col = STAR_TINTS[Math.floor(hash01(i, seed + 6) * STAR_TINTS.length)];
    if (hash01(i, seed + 7) < bigFrac) {
      ctx.globalAlpha = base;
      glow(ctx, px, py, rr * 8 * (1 + 0.4 * hb), col, 0.3 * a);
      sparkle(ctx, px, py, rr * (3.2 + 3 * hb), col, a);
      ctx.globalAlpha = base * a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, rr * 0.8, 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = base * a;
      ctx.fillStyle = col;
      const rad = rr * (1 + 0.5 * hb);
      if (rad < 1.25) ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      else { ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill(); }
    }
  }
  ctx.globalAlpha = base;
}

// Full-frame deep-space background.
// o: { t, seed, hue 'violet'|'blue'|'teal'|'magenta'|'pink', stars (≈350), driftX, driftY (parallax px), nebula 0..1, band 0..1 (milky way) }
export function spaceBg(ctx, o = {}) {
  const { t = 0, seed = 1, hue = 'violet', stars = 350, driftX = 0, driftY = 0, nebula: neb = 0, band = 1 } = o;
  const P = SPACE_HUES[hue] || SPACE_HUES.violet;
  ctx.save();
  bandFill(ctx, [[0, P.top], [0.55, P.mid], [1, P.bot]], -4, H + 4);
  // soft colour pool
  const wrapX = (x, span) => ((x % span) + span) % span;
  const gx = wrapX(W * (0.2 + 0.6 * hash01(1, seed)) - driftX * 0.04, W * 1.6) - W * 0.3;
  softBlob(ctx, gx, H * (0.8 + 0.15 * hash01(2, seed)) - driftY * 0.04, W * 0.42, H * 0.36, P.glow, 0.24);
  // milky-way band
  const bandAng = -0.42 + 0.3 * (hash01(3, seed) - 0.5);
  if (band > 0) {
    ctx.save();
    ctx.translate(W / 2 - ((driftX * 0.08) % (W * 1.2)), H / 2 - driftY * 0.08);
    ctx.rotate(bandAng);
    softBlob(ctx, 0, 0, W * 0.75, H * 0.13, mixColor(P.glow, '#ffffff', 0.45), 0.14 * band);
    ctx.restore();
  }
  if (neb > 0) {
    const span = W * 2.4;
    const nx = wrapX(W * 1.32 - driftX * 0.12, span) - W * 0.7;
    nebula(ctx, { t, hue, x: nx, y: H * 0.46 - driftY * 0.12, scale: 1.25, alpha: neb, seed: seed + 5 });
    if (nx > W * 0.9) nebula(ctx, { t, hue, x: nx - span, y: H * 0.46 - driftY * 0.12, scale: 1.25, alpha: neb, seed: seed + 5 });
  }
  const n = Math.max(0, stars | 0);
  const tan = bandAng;
  starLayer(ctx, { t, seed: seed * 7 + 1, count: Math.round(n * 0.58), rate: 0.15, dx: driftX, dy: driftY, minR: 0.7, maxR: 1.6, bigFrac: 0, bright: 0.7, band: band * 0.45, bandAng: tan });
  starLayer(ctx, { t, seed: seed * 7 + 2, count: Math.round(n * 0.3), rate: 0.4, dx: driftX, dy: driftY, minR: 1.0, maxR: 2.4, bigFrac: 0.05, bright: 0.9, band: 0, bandAng: tan });
  starLayer(ctx, { t, seed: seed * 7 + 3, count: Math.round(n * 0.12), rate: 1, dx: driftX, dy: driftY, minR: 1.6, maxR: 3.4, bigFrac: 0.3, bright: 1, band: 0, bandAng: tan });
  ctx.restore();
}

// Soft painterly nebula cloud. o: { t, hue, x, y, scale, alpha, seed, colors: [..] }
// Spans roughly 1500 x 800 px at scale 1, centred on (x, y).
export function nebula(ctx, o = {}) {
  const { t = 0, hue = 'violet', x = W / 2, y = H / 2, scale = 1, alpha = 1, seed = 3 } = o;
  if (alpha <= 0 || scale <= 0) return;
  const cols = o.colors || (SPACE_HUES[hue] || SPACE_HUES.violet).neb;
  const nc = cols.length;
  const b = beatAt(t);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= clamp(alpha);
  const spine = (u) => [u * 1350, Math.sin(u * 3.2 + seed) * 170 + (hash01(7, seed) - 0.5) * 120 * u];
  // 1. big soft wash (two wide radial glows under everything)
  for (let i = 0; i < 2; i++) {
    const [sx, sy] = spine(i ? 0.2 : -0.22);
    const drift = Math.sin(TAU * (b / 32) + i * 1.7) * 22;
    const r = 240 + 70 * hash01(i, seed + 1);
    softBlob(ctx, sx + drift, sy + (hash01(i, seed + 2) - 0.5) * 90, r * 1.35, r * 0.72, cols[i * 2 % nc], 0.32, (hash01(i, seed + 3) - 0.5) * 0.5);
  }
  // 2. painterly cloud masses: flat noisy shapes, each FEATHERED (three nested copies at scale 1 / .88 / .76
  //    sharing its alpha .35 / .35 / .3), so every edge fades out in soft steps instead of a cellophane cut.
  //    Blobs shrink and round off toward the ends of the spine, so no flat edge hangs across empty sky.
  const NB = 5;
  for (let i = 0; i < NB; i++) {
    const u = (i + 0.5) / NB - 0.5;
    const [sx, sy] = spine(u);
    const taper = 1 - 1.6 * u * u; // 1 in the middle → .74 at the ends
    const breathe = 1 + 0.03 * Math.sin(TAU * (b / 16) + i);
    const rx = (210 + 120 * hash01(i, seed + 4)) * breathe * taper, ry = rx * (0.5 + 0.2 * hash01(i, seed + 5));
    const rot = (hash01(i, seed + 6) - 0.5) * 0.9;
    const ox = sx + Math.sin(TAU * (b / 32) + i) * 16, oy = sy + (hash01(i, seed + 8) - 0.5) * 100 * taper;
    featherBlob(ctx, ox, oy, rx, ry, seed * 31 + i * 7, cols[(i + 1) % nc], 0.2, rot);
  }
  // lighter inner masses (fewer, smaller, also feathered)
  for (let i = 0; i < 3; i++) {
    const [sx, sy] = spine((i - 1) * 0.27 + (hash01(i, seed + 9) - 0.5) * 0.08);
    const rx = 150 + 70 * hash01(i, seed + 10), ry = rx * (0.45 + 0.15 * hash01(i, seed + 11));
    const ox = sx + 16 + Math.sin(TAU * (b / 32) + i * 2) * 12, oy = sy - 14 + (hash01(i, seed + 12) - 0.5) * 60;
    featherBlob(ctx, ox, oy, rx, ry, seed * 37 + i * 5, mixColor(cols[(i + 3) % nc], '#ffffff', 0.32), 0.17, (hash01(i, seed + 13) - 0.5) * 0.8, 11);
  }
  // 3. brush-stroke wisps, feathered the same way (three widths sharing the alpha)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const u0 = hash01(i, seed + 20) * 0.7 - 0.35;
    const off = (i - 1.5) * 38 + (hash01(i, seed + 23) - 0.5) * 40;
    const pts = [];
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = spine(u0 + (k - 1.5) * 0.1);
      pts.push([sx, sy + off + (hash01(i * 5 + k, seed + 21) - 0.5) * 50]);
    }
    const w = 40 + 46 * hash01(i, seed + 22);
    const wc = mixColor(cols[(i + 2) % nc], '#ffffff', 0.45);
    smoothPath(ctx, pts, false);
    for (const [k, f] of FEATHER) {
      ctx.lineWidth = w * k * k * k; // 1, .68, .44 of the width
      ctx.strokeStyle = rgba(wc, 0.13 * f);
      ctx.stroke();
    }
  }
  // 4. bright cores
  for (let i = 0; i < 2; i++) {
    const [sx, sy] = spine((i - 0.5) * 0.36 + (hash01(i, seed + 30) - 0.5) * 0.2);
    softBlob(ctx, sx, sy, 130 + 60 * hash01(i, seed + 31), 72, mixColor(cols[i % nc], '#ffffff', 0.55), 0.26);
  }
  // 5. soft dark dust lane
  const [dx0, dy0] = spine(-0.1 + 0.2 * hash01(1, seed + 40));
  softBlob(ctx, dx0, dy0 + 30, 420, 55, mixColor(cols[2 % nc], '#0b0822', 0.82), 0.24, -0.2 + 0.4 * hash01(2, seed + 40));
  // 6. embedded young stars
  const hp = hat(t);
  for (let i = 0; i < 9; i++) {
    const [sx, sy] = spine(hash01(i, seed + 50) - 0.5);
    const px = sx + (hash01(i, seed + 51) - 0.5) * 300, py = sy + (hash01(i, seed + 52) - 0.5) * 260;
    const tw = 0.7 + 0.3 * Math.sin(TAU * (b / 4 + hash01(i, seed + 53))) + (i % 3 === 0 ? hp * 0.5 : 0);
    const r = 3 + 5 * hash01(i, seed + 54);
    glowRing(ctx, px, py, 0, r * 7, mixColor(cols[i % nc], '#ffffff', 0.6), 0.4 * tw);
    sparkle(ctx, px, py, r * 2.6 * tw, '#ffffff', clamp(tw));
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Earth
// ---------------------------------------------------------------------------
// [lon, lat, angular radius] circles; sand/forest are drawn on top.
const CONTINENTS = [
  { c: [[-1.9, 0.98, 0.26], [-2.12, 0.78, 0.3], [-1.74, 0.82, 0.3], [-1.52, 0.7, 0.24], [-1.8, 0.57, 0.28], [-2.02, 0.52, 0.19],
    [-1.5, 0.47, 0.17], [-1.62, 0.35, 0.15], [-1.48, 0.22, 0.1], [-1.38, 0.13, 0.08], [-2.45, 0.9, 0.16]],
    sand: [[-1.88, 0.5, 0.13]], forest: [[-1.72, 0.8, 0.15], [-1.55, 0.55, 0.1]] },
  { c: [[-1.12, 0.06, 0.22], [-0.95, -0.1, 0.25], [-1.05, -0.35, 0.21], [-1.12, -0.56, 0.15], [-1.16, -0.76, 0.09]],
    forest: [[-1.0, -0.08, 0.16]], sand: [[-1.12, -0.52, 0.09]] },
  { c: [[-0.78, 1.12, 0.17], [-0.62, 1.04, 0.12]], ice: true },
  { c: [[0.15, 0.88, 0.14], [0.34, 0.8, 0.16], [0.2, 0.7, 0.12], [0.72, 0.92, 0.28], [1.2, 0.97, 0.32], [1.75, 0.92, 0.3], [2.25, 0.82, 0.26],
    [0.82, 0.68, 0.22], [1.3, 0.66, 0.3], [1.85, 0.6, 0.28], [2.38, 0.56, 0.16], [1.35, 0.36, 0.16], [1.42, 0.22, 0.1],
    [1.92, 0.33, 0.15], [2.02, 0.17, 0.09], [0.75, 0.47, 0.16], [2.6, 0.72, 0.12]],
    sand: [[0.82, 0.5, 0.12], [1.2, 0.62, 0.15], [1.65, 0.68, 0.12]], forest: [[1.5, 0.92, 0.17], [2.02, 0.8, 0.15], [1.95, 0.35, 0.08]] },
  { c: [[0.08, 0.52, 0.16], [0.32, 0.47, 0.23], [0.56, 0.4, 0.18], [0.34, 0.2, 0.25], [0.52, 0.0, 0.22], [0.53, -0.22, 0.19], [0.5, -0.43, 0.12], [0.8, -0.32, 0.05]],
    sand: [[0.22, 0.44, 0.17], [0.47, 0.37, 0.12]], forest: [[0.46, 0.0, 0.14]] },
  { c: [[2.3, -0.42, 0.17], [2.55, -0.4, 0.16], [2.42, -0.27, 0.09], [2.0, -0.04, 0.06], [2.17, -0.1, 0.06], [2.95, -0.62, 0.06]],
    sand: [[2.42, -0.44, 0.11]] },
];
const POLAR_CAPS = [[0, 1.57, 0.3], [0, -1.57, 0.36]];
for (let k = 0; k < 8; k++) POLAR_CAPS.push([k * PI / 4, 1.3, 0.16 + 0.05 * ((k * 7) % 3) / 2], [k * PI / 4 + 0.3, -1.25, 0.2 + 0.06 * ((k * 5) % 3) / 2]);
// puffy cloud clusters [lon, lat, count, size]
const EARTH_CLOUDS = [
  [-2.5, 0.35, 4, 0.07], [-1.35, -0.28, 3, 0.08], [-0.55, 0.55, 5, 0.075], [0.05, -0.5, 5, 0.07], [0.85, 0.12, 3, 0.07],
  [1.5, -0.2, 4, 0.08], [2.3, 0.3, 4, 0.07], [2.9, -0.58, 5, 0.065], [-0.2, 0.08, 3, 0.06], [-2.9, -0.15, 4, 0.07],
  [1.1, 0.75, 4, 0.06], [-1.9, -0.65, 4, 0.06],
];
const CYCLONES = [[-0.9, 0.42, 1], [1.95, -0.35, -1], [0.55, 0.62, 1]];
function cloudCircles(spinOff) {
  const out = [];
  // little cyclone swirls: puffs along a spiral arm
  CYCLONES.forEach(([lon, lat, dir], ci) => {
    for (let k = 0; k < 14; k++) {
      const u = k / 13, ang = dir * u * 4.2 + ci, rad = 0.19 * (1 - u * 0.9);
      out.push([lon + Math.cos(ang) * rad * 1.2 + spinOff, lat + Math.sin(ang) * rad, 0.058 * (1 - u * 0.5)]);
    }
  });
  EARTH_CLOUDS.forEach(([lon, lat, n, a], ci) => {
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? 0 : k / (n - 1) - 0.5;
      const bump = 1 - Math.abs(u) * 1.1;
      out.push([lon + u * n * a * 1.25 + spinOff, lat + 0.02 * Math.sin(k * 2.1 + ci) + bump * a * 0.25, a * (0.65 + 0.5 * bump) * (0.85 + 0.3 * hash01(k, ci + 7))]);
    }
  });
  return out;
}

// o: { t, rot (radians of spin), glow 0..1 (atmosphere halo), tilt (2D axial tilt, default -0.3),
//      pitch (view latitude: + shows more of the north, - tips it away; use ≈ -0.9 when only the top of a huge Earth
//      is in frame so the curve shows oceans/continents rather than the ice cap), clouds 0..1, night 0..1, lw }
export function drawEarth(ctx, x, y, r, o = {}) {
  const { t = 0, rot = 0, glow: gl = 1, tilt = -0.3, pitch = 0.2, clouds = 1, night = 1 } = o;
  const cP = Math.cos(pitch), sP = Math.sin(pitch);
  const lw = o.lw ?? olw(r);
  ctx.save();
  if (gl > 0) {
    const R1 = r * (1.22 + 0.12 * gl);
    const g = ctx.createRadialGradient(x, y, r * 0.97, x, y, R1);
    g.addColorStop(0, rgba('#bfe8ff', 0.75 * gl));
    g.addColorStop(0.15, rgba('#7cc6ff', 0.42 * gl));
    g.addColorStop(0.45, rgba('#5aa8ff', 0.14 * gl));
    g.addColorStop(1, rgba('#5aa8ff', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R1, 0, TAU); ctx.moveTo(x + r * 0.97, y); ctx.arc(x, y, r * 0.97, 0, TAU, true); ctx.fill();
  }
  circlePath(ctx, x, y, r);
  ctx.fillStyle = '#2f7fe0';
  ctx.fill();
  ctx.save();
  circlePath(ctx, x, y, r);
  ctx.clip();
  // lighter shallow water toward the light
  ctx.fillStyle = rgba('#5fb0ff', 0.55);
  ellipsePath(ctx, x - r * 0.28, y - r * 0.3, r * 0.72, r * 0.66, -0.6); ctx.fill();
  ctx.fillStyle = rgba('#7cc2ff', 0.45);
  ellipsePath(ctx, x - r * 0.38, y - r * 0.4, r * 0.4, r * 0.34, -0.6); ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const proj = (lon, lat, spin) => {
    const l = lon + spin, cl = Math.cos(lat);
    const Y = -Math.sin(lat), Z = cl * Math.cos(l);
    return [r * cl * Math.sin(l), r * (Y * cP + Z * sP), -Y * sP + Z * cP];
  };
  const eachCircle = (list, spin, grow, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (const [lon, lat, a] of list) {
      const [px, py, z] = proj(lon, lat, spin);
      if (z < 0.03) continue;
      const ang = Math.atan2(py, px);
      const ra = Math.max(0.5, a * r * z + grow), ta = a * r + grow;
      ctx.moveTo(px + Math.cos(ang) * ra, py + Math.sin(ang) * ra);
      ctx.ellipse(px, py, ra, ta, ang, 0, TAU);
    }
    ctx.fill();
  };
  const clw = Math.max(1.2, lw * 0.55);
  // continents: dark rim, then green, then sand & forest
  for (const C of CONTINENTS) eachCircle(C.c, rot, clw, C.ice ? '#b9d6ee' : '#2f8a45');
  for (const C of CONTINENTS) eachCircle(C.c, rot, 0, C.ice ? '#f4fbff' : '#5cc26b');
  for (const C of CONTINENTS) if (C.forest) eachCircle(C.forest, rot, 0, '#45a857');
  for (const C of CONTINENTS) if (C.sand) eachCircle(C.sand, rot, 0, '#ecd08a');
  // polar caps (projected, so they foreshorten with pitch)
  eachCircle(POLAR_CAPS, rot * 0.2, 0, '#f4fbff');
  // puffy clouds (soft shade underneath, then white)
  if (clouds > 0) {
    const cc = cloudCircles(t * 0.012 + rot * 0.12);
    ctx.globalAlpha = clouds;
    eachCircle(cc.map(([lo, la, a]) => [lo, la - a * 0.25, a]), rot, 0, '#cfe4f7');
    eachCircle(cc, rot, 0, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.rotate(-tilt);
  ctx.translate(-x, -y);
  // atmosphere rim inside the limb
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = rgba('#bfe8ff', 0.35 * Math.max(0.4, gl));
  circlePath(ctx, x, y, r); ctx.stroke();
  // night side
  if (night > 0) {
    discShade(ctx, x, y, r, '#0c1646', 0.3 * night, 0.28, 1.08);
    discShade(ctx, x, y, r, '#0c1646', 0.38 * night, 0.5, 1.14);
  }
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ellipsePath(ctx, x - r * 0.45, y - r * 0.52, r * 0.26, r * 0.13, -0.7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ellipsePath(ctx, x - r * 0.62, y - r * 0.3, r * 0.05, r * 0.03, -1.0); ctx.fill();
  ctx.restore();
  circlePath(ctx, x, y, r);
  strokeInk(ctx, lw);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Moon (small lavender moon)
// ---------------------------------------------------------------------------
const MOON = { base: '#c6b7ee', shade: '#8f7bcc', bowl: '#9c89d6', bowlLit: '#b5a4e6', light: '#ece5ff' };
const SURF_CRATER = { bowl: '#7560b8', bowlLit: '#a08dda', light: '#f4f0ff' };

// Crater seen on a sphere or ground. rot = ellipse rotation. (No clipping: the shadowed upper wall is an exact crescent.)
function crater(ctx, cx, cy, rx, ry, rot, lw, pal = MOON) {
  rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  ctx.fillStyle = pal.bowlLit; ctx.fill();
  // dark upper-left inner wall = bowl minus the bowl shifted toward the lower-right (in the crater's local frame)
  const off = Math.min(rx, ry);
  const ox = off * 0.35, oy = off * 0.45;
  const c = Math.cos(-rot), sn = Math.sin(-rot);
  const lx = ox * c - oy * sn, ly = (ox * sn + oy * c) * (rx / ry);
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(1, ry / rx);
  if (crescentPath(ctx, 0, 0, rx, lx, ly, rx)) { ctx.fillStyle = pal.bowl; ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  strokeInk(ctx, lw);
  // lit outer rim upper-left
  ctx.beginPath(); ctx.ellipse(cx, cy, rx + lw * 0.95, ry + lw * 0.95, rot, PI * 1.02, PI * 1.62);
  ctx.strokeStyle = pal.light; ctx.lineWidth = lw * 0.7; ctx.stroke();
}

// o: { t, rot (spin of the crater pattern), seed, glow 0..1, lw }
export function drawMoon(ctx, x, y, r, o = {}) {
  const { rot = 0, seed = 7, glow: gl = 0.6 } = o;
  const lw = o.lw ?? olw(r);
  ctx.save();
  if (gl > 0) glow(ctx, x, y, r * 1.9, '#d9ccff', 0.35 * gl);
  circlePath(ctx, x, y, r);
  ctx.fillStyle = MOON.base; ctx.fill();
  ctx.save();
  circlePath(ctx, x, y, r); ctx.clip();
  // soft maria patches
  for (let i = 0; i < 3; i++) {
    const a = hash01(i, seed + 40) * TAU + rot, d = r * (0.2 + 0.4 * hash01(i, seed + 41));
    noisyBlobPath(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.32, r * 0.24, seed + i * 3, 9, 0.4, a);
    ctx.fillStyle = rgba('#a996dc', 0.55); ctx.fill();
  }
  const cr = [[-0.35, -0.3, 0.2], [0.3, 0.1, 0.24], [-0.15, 0.45, 0.14], [0.45, -0.45, 0.12], [-0.6, 0.2, 0.1], [0.1, -0.62, 0.09], [0.62, 0.42, 0.1]];
  cr.forEach(([cx0, cy0, s], i) => {
    const jx = cx0 + (hash01(i, seed) - 0.5) * 0.15, jy = cy0 + (hash01(i, seed + 1) - 0.5) * 0.15;
    const c = Math.cos(rot), sn = Math.sin(rot);
    const px = jx * c - jy * sn, py = jx * sn + jy * c;
    const d = Math.min(0.97, Math.hypot(px, py));
    const sq = Math.sqrt(1 - d * d);
    crater(ctx, x + px * r, y + py * r, Math.max(0.5, s * r * sq), s * r * 0.9, Math.atan2(py, px), lw * 0.5);
  });
  discShade(ctx, x, y, r, MOON.shade, 0.75, 0.42, 1.12);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipsePath(ctx, x - r * 0.42, y - r * 0.5, r * 0.25, r * 0.12, -0.7); ctx.fill();
  ctx.restore();
  circlePath(ctx, x, y, r);
  strokeInk(ctx, lw);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Moon surface (s13): huge curved horizon, ground at y ≈ 860 at screen centre
// ---------------------------------------------------------------------------
const moonR = (curve) => 1100 + 7000 * Math.pow(1 - clamp(curve), 2);
// Ground height (screen y) of the moon's horizon/crest at screen x.
export function moonSurfaceY(x, o = {}) {
  const R = moonR(o.curve ?? 0.5), dx = x - W / 2;
  return 860 + R - Math.sqrt(Math.max(0, R * R - dx * dx));
}
// Slope angle (radians) of the crest at x — rotate things standing on the surface by this.
export function moonSurfaceAngle(x, o = {}) {
  const R = moonR(o.curve ?? 0.5), dx = clamp(x - W / 2, -R * 0.99, R * 0.99);
  return Math.atan2(dx, Math.sqrt(R * R - dx * dx));
}

function rockShape(ctx, x, y, s, seed, ang = 0) {
  const pts = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3;
    const k = 0.82 + 0.28 * hash01(i, seed);
    let py = Math.sin(a) * s * 0.72 * k;
    if (py > 0) py *= 0.3; // flat-ish bottom
    pts.push([Math.cos(a) * s * k, py - s * 0.1]);
  }
  const c = Math.cos(ang), sn = Math.sin(ang);
  smoothPath(ctx, pts.map(([px, py]) => [x + px * c - py * sn, y + px * sn + py * c]), true, 0.5);
}

// o: { t, curve 0..1 (0 ≈ flat, 1 = tiny moon; default 0.5), seed, scroll (px, pans the features), dust 0..1 }
export function drawMoonSurface(ctx, o = {}) {
  const { t = 0, curve = 0.5, seed = 11, scroll = 0, dust = 1 } = o;
  const R = moonR(curve), cx = W / 2, cy = 860 + R;
  const surf = (x) => cy - Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx)));
  const slope = (x) => { const dx = clamp(x - cx, -R * 0.99, R * 0.99); return Math.atan2(dx, Math.sqrt(R * R - dx * dx)); };
  const lw = LW;
  ctx.save();
  // faint glow above the horizon
  const hg = ctx.createRadialGradient(cx, cy, R * 0.998, cx, cy, R + 170);
  hg.addColorStop(0, rgba('#cdb8ff', 0.3));
  hg.addColorStop(1, rgba('#cdb8ff', 0));
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(cx, cy, R + 170, 0, TAU); ctx.moveTo(cx + R * 0.998, cy); ctx.arc(cx, cy, R * 0.998, 0, TAU, true); ctx.fill();
  // ground body
  circlePath(ctx, cx, cy, R);
  const gg = ctx.createLinearGradient(0, 860, 0, H + 60);
  gg.addColorStop(0, '#cdbff2'); gg.addColorStop(0.4, '#b7a6e6'); gg.addColorStop(1, '#9885cf');
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.save();
  circlePath(ctx, cx, cy, R); ctx.clip();
  // large low-contrast undulations (distant dunes)
  for (let i = 0; i < 7; i++) {
    const sx = ((((hash01(i, seed + 60) * 2600 + scroll * 0.6) % 2600) + 2600) % 2600) - 340;
    const d = 0.12 + 0.5 * hash01(i, seed + 61);
    const yy = surf(sx) + (H + 40 - surf(sx)) * d;
    ctx.beginPath();
    ctx.ellipse(sx, yy, 260 + 200 * d, 26 + 40 * d, slope(sx) * (1 - d), 0, TAU);
    ctx.fillStyle = rgba(i % 2 ? '#a591d8' : '#d8ccf7', 0.35);
    ctx.fill();
  }
  // rim light along the crest
  ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, TAU);
  ctx.strokeStyle = '#e9e1ff'; ctx.lineWidth = 12; ctx.stroke();
  // speckle texture
  for (let i = 0; i < 140; i++) {
    const sx = ((((hash01(i, seed + 70) * 2400 + scroll) % 2400) + 2400) % 2400) - 240;
    const d = hash01(i, seed + 71);
    const yy = surf(sx) + (H + 30 - surf(sx)) * Math.pow(d, 0.8);
    const s = 1.2 + 3 * d;
    ctx.fillStyle = hash01(i, seed + 72) < 0.6 ? rgba('#7d69b8', 0.35) : rgba('#f1ebff', 0.45);
    ctx.beginPath(); ctx.ellipse(sx, yy, s, s * (0.4 + 0.3 * d), 0, 0, TAU); ctx.fill();
  }
  // soft darkening toward the bottom edge
  const bg = ctx.createLinearGradient(0, H - 90, 0, H);
  bg.addColorStop(0, rgba('#5a4796', 0)); bg.addColorStop(1, rgba('#5a4796', 0.25));
  ctx.fillStyle = bg; ctx.fillRect(0, H - 90, W, 90);
  ctx.restore();
  // features, far → near (no clip needed: everything sits on the ground)
  const feats = [];
  const SPAN = 2800;
  for (let i = 0; i < 13; i++) {
    const d = 0.08 + 0.88 * Math.pow(hash01(i, seed + 1), 0.9);
    feats.push({ kind: 'crater', i, d, s0: hash01(i, seed + 2) * SPAN, size: 40 + 70 * hash01(i, seed + 3) });
  }
  for (let i = 0; i < 9; i++) {
    const d = 0.02 + 0.95 * hash01(i, seed + 11);
    feats.push({ kind: 'rock', i, d, s0: hash01(i, seed + 12) * SPAN, size: 12 + 26 * hash01(i, seed + 13) });
  }
  feats.push({ kind: 'rock', i: 50, d: 0.55, s0: (SPAN - W) / 2 + 190, size: 48 });
  feats.push({ kind: 'rock', i: 51, d: 0.62, s0: (SPAN - W) / 2 + W - 260, size: 40 });
  for (let i = 0; i < 26; i++) {
    const d = 0.05 + 0.95 * hash01(i, seed + 21);
    feats.push({ kind: 'pebble', i, d, s0: hash01(i, seed + 22) * SPAN, size: 3 + 6 * hash01(i, seed + 23) });
  }
  feats.sort((a, b) => a.d - b.d);
  for (const f of feats) {
    const par = 0.55 + 0.9 * f.d;
    const sx = ((((f.s0 + scroll * par) % SPAN) + SPAN) % SPAN) - (SPAN - W) / 2;
    const top = surf(sx);
    const yy = top + (H + 50 - top) * Math.pow(f.d, 1.15);
    const sc = 0.35 + 1.0 * f.d;
    const ang = slope(sx) * (1 - f.d * 0.8);
    if (f.kind === 'crater') {
      const rx = f.size * sc, ry = rx * (0.17 + 0.2 * f.d);
      if (yy - ry > H + 10 || sx + rx < -20 || sx - rx > W + 20) continue;
      // raised rim mound
      ctx.beginPath(); ctx.ellipse(sx + rx * 0.06, yy + ry * 0.35, rx * 1.24, ry * 1.5, ang, 0, TAU);
      ctx.fillStyle = rgba('#6f5bb0', 0.32); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx, yy - ry * 0.1, rx * 1.22, ry * 1.55, ang, 0, TAU);
      ctx.fillStyle = '#ddd3f9'; ctx.fill();
      crater(ctx, sx + rx * 0.02, yy, rx, ry, ang, lw * (0.4 + 0.35 * f.d), SURF_CRATER);
    } else if (f.kind === 'rock') {
      const s = f.size * sc;
      if (yy - s > H + 10 || sx + s < -20 || sx - s > W + 20) continue;
      ctx.fillStyle = rgba('#5d4b95', 0.3);
      ctx.beginPath(); ctx.ellipse(sx + s * 0.25, yy + s * 0.08, s * 1.05, s * 0.22, ang, 0, TAU); ctx.fill();
      rockShape(ctx, sx, yy, s, seed * 13 + f.i, ang);
      ctx.fillStyle = '#8b77c6'; ctx.fill();
      rockShape(ctx, sx - s * 0.1, yy - s * 0.1, s * 0.8, seed * 13 + f.i, ang);
      ctx.fillStyle = '#b3a2e2'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(sx - s * 0.35, yy - s * 0.42, s * 0.2, s * 0.09, ang - 0.4, 0, TAU); ctx.fill();
      rockShape(ctx, sx, yy, s, seed * 13 + f.i, ang);
      strokeInk(ctx, lw * (0.45 + 0.4 * f.d));
    } else {
      const s = f.size * sc;
      ctx.fillStyle = '#8f7bcc';
      ctx.beginPath(); ctx.ellipse(sx, yy, s, s * 0.55, ang, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba('#efe9ff', 0.8);
      ctx.beginPath(); ctx.ellipse(sx - s * 0.3, yy - s * 0.2, s * 0.35, s * 0.18, ang, 0, TAU); ctx.fill();
    }
  }
  // crest outline
  circlePath(ctx, cx, cy, R);
  strokeInk(ctx, lw);
  // floating dust motes
  if (dust > 0) {
    const b = beatAt(t);
    for (let i = 0; i < 34; i++) {
      const sx = ((((hash01(i, seed + 80) * (W + 100) + b * 7 * (0.5 + hash01(i, seed + 81)) + scroll * 0.8) % (W + 100)) + W + 100) % (W + 100)) - 50;
      const rise = fract(hash01(i, seed + 82) + b * 0.04 * (0.5 + hash01(i, seed + 83)));
      const yy = surf(sx) + 40 * hash01(i, seed + 84) - rise * 120;
      const a = dust * 0.5 * Math.sin(PI * rise);
      ctx.fillStyle = rgba('#f2ecff', a);
      ctx.beginPath(); ctx.arc(sx, yy, 1.5 + 2 * hash01(i, seed + 85), 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Ringed gas giant
// ---------------------------------------------------------------------------
const GIANT_BANDS = ['#ffe6c7', '#ff9ec7', '#ffd0a8', '#b889e8', '#ffb07a', '#ffe6c7', '#f28ab8', '#9d6fe0', '#ffc59a', '#ffe0ef', '#c28ae8', '#ff9d6c'];
const GIANT_LATS = [1.2, 0.98, 0.86, 0.66, 0.52, 0.43, 0.22, 0.03, -0.08, -0.3, -0.5, -0.6, -0.8];
const RING_BANDS = [
  [1.26, 1.37, '#d9c8f2', 1], [1.37, 1.56, '#fff1d6', 1], [1.56, 1.66, '#ffe0b8', 1],
  [1.73, 1.88, '#ffc98f', 1], [1.92, 1.98, '#ffb3d1', 1],
];
const RING_GROUPS = [[1.26, 1.66], [1.73, 1.88], [1.92, 1.98]];
const RING_GAPS = [[1.66, 1.73], [1.88, 1.92]];

// o: { t, rot (band drift, radians), tilt (radians, default -0.32), open (ring opening, default 0.3), glow 0..1, lw,
//      detail (bool: force the level of detail on/off; default = automatic from the on-screen radius) }
export function drawRingedPlanet(ctx, x, y, r, o = {}) {
  const { rot = 0, tilt = -0.32, open = 0.3, glow: gl = 1 } = o;
  const lw = o.lw ?? olw(r, 0.02);
  const sB = Math.sin(open), cB = Math.cos(open);
  // level of detail: on-screen radius (current transform scale × r). Below 250 px the pinstripes, eddy ovals and
  // curly wisps are skipped (they read as noise that small); below 70 px the storm's spiral and the striations go too.
  const onScreenR = r * transformScale(ctx);
  const detail = o.detail ?? onScreenR >= 250, fine = o.detail ?? onScreenR >= 70;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // halo: 1.35r on small planets, thinning to ~1.2r on huge ones (a 250 px halo at r700 cost a lot of gradient fill)
  if (gl > 0) glowRing(ctx, 0, 0, r * 0.98, r + Math.min(r * 0.35, 60 + r * 0.12), '#ff9ec7', 0.3 * gl, 0);

  const halfRing = (ro, ri, front) => {
    const a0 = front ? -0.01 : PI - 0.01, a1 = front ? PI + 0.01 : TAU + 0.01;
    ctx.beginPath();
    ctx.ellipse(0, 0, ro * r, ro * r * sB, 0, a0, a1);
    ctx.ellipse(0, 0, ri * r, ri * r * sB, 0, a1, a0, true);
    ctx.closePath();
  };
  const drawRing = (front) => {
    const a0 = front ? 0 : PI, a1 = front ? PI : TAU;
    for (const [ri, ro, col, a] of RING_BANDS) {
      halfRing(ro, ri, front);
      ctx.fillStyle = col;
      ctx.globalAlpha = a;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // fine striations (one batched stroke). Long thin arcs are costly to stroke, so each is limited to the parts
    // that are on screen and (for the back half) not hidden behind the planet.
    const hide = front ? 0 : r * 0.985;
    if (fine) {
      ctx.lineWidth = Math.max(1, r * 0.004);
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const rr = lerp(1.28, 1.96, (i + 0.5) / 12);
        if (RING_GAPS.some(([g0, g1]) => rr > g0 - 0.01 && rr < g1 + 0.01)) continue;
        for (const [b0, b1] of visibleArcs(ctx, rr * r, rr * r * sB, a0, a1, hide)) {
          ctx.moveTo(Math.cos(b0) * rr * r, Math.sin(b0) * rr * r * sB);
          ctx.ellipse(0, 0, rr * r, rr * r * sB, 0, b0, b1);
        }
      }
      ctx.strokeStyle = rgba('#ffffff', 0.3);
      ctx.stroke();
    }
    // ink edges of each ring group (outer/inner edges thick, gap edges thinner)
    for (const thick of [true, false]) {
      ctx.beginPath();
      for (const [ri, ro] of RING_GROUPS) {
        for (const rr of [ri, ro]) {
          if ((rr === 1.98 || rr === 1.26) !== thick) continue;
          for (const [b0, b1] of visibleArcs(ctx, rr * r, rr * r * sB, a0 - 0.002, a1 + 0.002, hide)) {
            ctx.moveTo(Math.cos(b0) * rr * r, Math.sin(b0) * rr * r * sB);
            ctx.ellipse(0, 0, rr * r, rr * r * sB, 0, b0, b1);
          }
        }
      }
      strokeInk(ctx, lw * (thick ? 1 : 0.7));
    }
  };

  // back half of ring + planet shadow on it
  drawRing(false);
  ctx.save();
  halfRing(2.02, 1.24, false); ctx.clip();
  ctx.beginPath(); ctx.arc(r * 0.42, -r * 0.1, r * 1.03, 0, TAU);
  ctx.fillStyle = rgba('#241040', 0.42); ctx.fill();
  ctx.restore();

  // planet body
  circlePath(ctx, 0, 0, r);
  ctx.fillStyle = GIANT_BANDS[0]; ctx.fill();
  ctx.save();
  // latitude bands — strips bounded analytically by the disc edge (no clip: much faster)
  const N = 26;
  const boundary = (k) => {
    const phi = GIANT_LATS[k];
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const drift = rot * (1 + 0.35 * (hash01(k, 91) - 0.5));
    const amp = r * 0.018 * (0.5 + hash01(k, 92));
    const pts = [];
    for (let j = 0; j <= N; j++) {
      const lam = -PI / 2 + (j / N) * PI;
      const cl = Math.cos(lam);
      const wave = amp * Math.sin(lam * (4 + (k % 3)) + drift * (4 + (k % 3)) + k * 1.3) * cl;
      pts.push([r * cp * Math.sin(lam), r * (-sp * cB + cp * cl * sB) + wave]);
    }
    return pts;
  };
  const bounds = GIANT_LATS.map((_, k) => (k ? boundary(k) : null));
  const ang = (p) => Math.atan2(p[1], p[0]);
  for (let k = 1; k < GIANT_LATS.length; k++) {
    // strip between boundary k and k+1 (the last one runs round the bottom of the disc)
    const pts = bounds[k], nxt = bounds[k + 1];
    const eL = pts[0], eR = pts[pts.length - 1];
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang(eL)) * r, Math.sin(ang(eL)) * r);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    if (nxt) {
      const nL = nxt[0], nR = nxt[nxt.length - 1];
      ctx.arc(0, 0, r, ang(eR), ang(nR), false);
      for (let j = nxt.length - 1; j >= 0; j--) ctx.lineTo(nxt[j][0], nxt[j][1]);
      ctx.arc(0, 0, r, ang(nL), ang(eL), false);
    } else ctx.arc(0, 0, r, ang(eR), ang(eL), false);
    ctx.closePath();
    ctx.fillStyle = GIANT_BANDS[k % GIANT_BANDS.length];
    ctx.fill();
  }
  // thin darker lines along the band boundaries (one batched stroke; off-canvas runs are skipped, which matters
  // for the huge half-in-frame planet of s10)
  const onCanvas = canvasTest(ctx, 30);
  ctx.beginPath();
  for (let k = 1; k < GIANT_LATS.length; k++) polyOnCanvas(ctx, bounds[k], onCanvas);
  ctx.strokeStyle = rgba('#6a3a7a', 0.2);
  ctx.lineWidth = Math.max(1, r * 0.006);
  ctx.stroke();
  // pinstripes inside bands (two batched strokes: light / dark)
  for (const pass of detail ? [0, 1] : []) {
    ctx.beginPath();
    for (let k = pass; k < GIANT_LATS.length - 1; k += 2) {
      const phi = (GIANT_LATS[k] + GIANT_LATS[k + 1]) / 2 + 0.03 * (hash01(k, 95) - 0.5);
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const drift = rot * (1 + 0.35 * (hash01(k, 91) - 0.5));
      const line = [];
      for (let j = 0; j <= N; j++) {
        const lam = -PI / 2 + (j / N) * PI, cl = Math.cos(lam);
        line.push([r * cp * Math.sin(lam), r * (-sp * cB + cp * cl * sB) + r * 0.01 * Math.sin(lam * 5 + drift * 5 + k) * cl]);
      }
      polyOnCanvas(ctx, line, onCanvas);
    }
    ctx.lineCap = 'butt';
    ctx.strokeStyle = pass ? rgba('#ffffff', 0.35) : rgba('#7a4a8a', 0.16);
    ctx.lineWidth = r * (pass ? 0.008 : 0.012);
    ctx.stroke();
  }
  // eddies: little ovals and curly wisps riding the band edges
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < (detail ? 30 : 0); i++) {
    const k = 1 + Math.floor(hash01(i, 71) * (GIANT_LATS.length - 2));
    const drift = rot * (1 + 0.35 * (hash01(k, 91) - 0.5));
    const lam0 = fract(hash01(i, 72) + drift / TAU) * TAU - PI;
    if (Math.cos(lam0) < 0.1) continue;
    const phi0 = GIANT_LATS[k] + (i % 3 === 0 ? -0.05 : 0.01);
    const pt = (lam, phi) => {
      const cl = Math.cos(lam), cp = Math.cos(phi), sp = Math.sin(phi);
      return [r * cp * Math.sin(lam), r * (-sp * cB + cp * cl * sB)];
    };
    { const [ax, ay] = pt(lam0, phi0); if (!onCanvas(ax, ay, r * 0.5)) continue; } // eddy fully off canvas
    const fade = clamp(Math.cos(lam0) * 3);
    const bandCol = GIANT_BANDS[(k + 1) % GIANT_BANDS.length];
    if (i % 3 === 0) {
      // oval eddy
      const [px, py] = pt(lam0, phi0);
      const ex = r * (0.05 + 0.04 * hash01(i, 73)) * Math.cos(lam0), ey = r * 0.028;
      ctx.beginPath(); ctx.ellipse(px, py, ex, ey, 0, 0, TAU);
      ctx.fillStyle = rgba(mixColor(bandCol, '#ffffff', 0.55), 0.9 * fade); ctx.fill();
      ctx.strokeStyle = rgba(mixColor(bandCol, INK, 0.3), 0.6 * fade); ctx.lineWidth = r * 0.005; ctx.stroke();
    } else {
      // wisp: runs along the edge then curls up
      const len = 0.35 + 0.35 * hash01(i, 74), dir = hash01(i, 75) < 0.5 ? 1 : -1;
      const cr = 0.022 + 0.018 * hash01(i, 76);
      ctx.beginPath();
      for (let s2 = 0; s2 <= 22; s2++) {
        const u = s2 / 22;
        let lam, phi;
        if (u < 0.6) { lam = lam0 - dir * len * (1 - u / 0.6); phi = phi0 + 0.012 * Math.sin(u * 9); }
        else { const w = (u - 0.6) / 0.4, ang = w * PI * 1.6, rad = cr * (1 - 0.6 * w); lam = lam0 + dir * Math.sin(ang) * rad * 1.4; phi = phi0 + (1 - Math.cos(ang)) * rad; }
        if (Math.cos(lam) < 0.05) continue;
        const [px, py] = pt(lam, phi);
        s2 ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      const col = i % 2 ? mixColor(bandCol, '#ffffff', 0.5) : mixColor(GIANT_BANDS[k % GIANT_BANDS.length], '#ffffff', 0.4);
      ctx.strokeStyle = rgba(col, 0.95 * fade);
      ctx.lineWidth = r * 0.016;
      ctx.stroke();
    }
  }
  // great storm spot
  {
    const phi = 0.14, lam = fract(0.44 + rot / TAU) * TAU - PI;
    const cl = Math.cos(lam);
    if (cl > 0.02) {
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const px = r * cp * Math.sin(lam), py = r * (-sp * cB + cp * cl * sB);
      const ex = r * 0.2 * cl, ey = r * 0.1;
      ctx.save();
      ctx.globalAlpha = clamp(cl * 4);
      ctx.beginPath(); ctx.ellipse(px, py, ex * 1.25, ey * 1.35, 0, 0, TAU);
      ctx.fillStyle = '#ffd0a8'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(px, py, ex, ey, 0, 0, TAU);
      ctx.fillStyle = '#e8674a'; ctx.fill();
      strokeInk(ctx, lw * 0.5, mixColor('#e8674a', INK, 0.45));
      ctx.beginPath(); ctx.ellipse(px - ex * 0.1, py - ey * 0.1, ex * 0.62, ey * 0.55, 0, 0, TAU);
      ctx.fillStyle = '#ff9d6c'; ctx.fill();
      if (fine) { // spiral
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const u = s / 16, ang = u * PI * 2.2 + rot * 3, rad = 1 - 0.8 * u;
          const qx = px + Math.cos(ang) * ex * 0.55 * rad, qy = py + Math.sin(ang) * ey * 0.5 * rad;
          s ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
        }
        ctx.strokeStyle = rgba('#c84a3a', 0.8); ctx.lineWidth = Math.max(1, r * 0.01); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(px - ex * 0.35, py - ey * 0.45, ex * 0.22, ey * 0.14, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  // ring shadow on the planet (just below the front ring) — the only part that needs a clip
  ctx.save();
  circlePath(ctx, 0, 0, r); ctx.clip();
  ctx.translate(r * 0.03, r * 0.13);
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.98 * r, 1.98 * r * sB, 0, 0, PI);
  ctx.ellipse(0, 0, 1.26 * r, 1.26 * r * sB, 0, PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = rgba('#3a1a5a', 0.38); ctx.fill();
  ctx.restore();
  // terminator & highlight (screen-space light from upper-left: undo tilt)
  ctx.rotate(-tilt);
  discShade(ctx, 0, 0, r, '#3b1d63', 0.46, 0.3, 1.08);
  ctx.fillStyle = rgba('#ffffff', 0.2);
  ellipsePath(ctx, -r * 0.5, -r * 0.55, r * 0.22, r * 0.1, -0.75); ctx.fill();
  ctx.rotate(tilt);
  ctx.restore();
  circlePath(ctx, 0, 0, r);
  strokeInk(ctx, lw);

  // front half of ring (+ planet's shadow does not reach it)
  drawRing(true);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Asteroids
// ---------------------------------------------------------------------------
function asteroidPts(r, seed, rot) {
  const n = 9 + Math.floor(hash01(1, seed) * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU + (hash01(i, seed + 3) - 0.5) * 0.3;
    const k = 0.78 + 0.3 * hash01(i, seed + 4);
    const sx = 1 + 0.25 * (hash01(2, seed) - 0.5);
    pts.push([Math.cos(a) * r * k * sx, Math.sin(a) * r * k / sx]);
  }
  return pts;
}
function crackLine(r, seed, rot) {
  // main crack from one edge across the rock, jagged
  const a = rot + hash01(5, seed) * TAU;
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const u = i / n - 0.5;
    const jag = (i % 2 ? 1 : -1) * r * 0.1 * (0.5 + hash01(i, seed + 30)) * (i === 0 || i === n ? 0 : 1);
    pts.push([Math.cos(a) * u * r * 2.3 - Math.sin(a) * jag, Math.sin(a) * u * r * 2.3 + Math.cos(a) * jag]);
  }
  return { pts, a };
}

// o: { seed, rot, crack 0..1, split 0..1 (halves drift apart), color, lw }
export function drawAsteroid(ctx, x, y, r, o = {}) {
  const { seed = 1, rot = 0, crack = 0, split = 0, color = '#a595c4' } = o;
  const lw = o.lw ?? olw(r, 0.05);
  const shadeC = mixColor(color, INK, 0.38), bowl = mixColor(color, INK, 0.25), lit = mixColor(color, '#ffffff', 0.3);
  const pts = asteroidPts(r, seed, rot);
  const body = (ox = 0, oy = 0, k = 1) => smoothPath(ctx, pts.map(([px, py]) => [ox + px * k, oy + py * k]), true);
  const drawBody = () => {
    body();
    ctx.fillStyle = shadeC; ctx.fill();
    ctx.save();
    body(); ctx.clip();
    body(-r * 0.16, -r * 0.18, 0.96);
    ctx.fillStyle = color; ctx.fill();
    // craters
    const nc = 3 + Math.floor(hash01(8, seed) * 3);
    for (let i = 0; i < nc; i++) {
      const a = rot + hash01(i, seed + 10) * TAU, d = r * 0.6 * Math.sqrt(hash01(i, seed + 11));
      const cr = r * (0.1 + 0.14 * hash01(i, seed + 12));
      const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
      const sq = Math.sqrt(Math.max(0.2, 1 - (d / r) ** 2));
      crater(ctx, cx, cy, cr * sq, cr, Math.atan2(cy, cx), lw * 0.5, { bowl: shadeC, bowlLit: bowl, light: lit });
    }
    ctx.fillStyle = rgba('#ffffff', 0.4);
    ellipsePath(ctx, -r * 0.38, -r * 0.42, r * 0.2, r * 0.09, -0.7); ctx.fill();
    ctx.restore();
    body(); strokeInk(ctx, lw);
  };
  const cr = crackLine(r, seed, rot);
  const drawCracks = (amt) => {
    if (amt <= 0) return;
    ctx.save();
    body(); ctx.clip();
    const n = cr.pts.length - 1;
    // grows outward from the middle
    const mid = n / 2;
    const reach = amt * (mid + 0.001);
    const side = (dir) => {
      ctx.beginPath();
      ctx.moveTo(cr.pts[Math.round(mid)][0], cr.pts[Math.round(mid)][1]);
      for (let s = 1; s <= Math.ceil(reach); s++) {
        const i = Math.round(mid) + dir * s;
        if (i < 0 || i > n) break;
        const f = clamp(reach - (s - 1));
        const p0 = cr.pts[i - dir], p1 = cr.pts[i];
        ctx.lineTo(lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f));
      }
      strokeInk(ctx, lw * 0.9);
    };
    side(1); side(-1);
    // branches
    for (let b = 0; b < 3; b++) {
      const i = 1 + Math.floor(hash01(b, seed + 40) * (n - 1));
      const f = clamp(amt * 1.6 - 0.4 - b * 0.15);
      if (f <= 0) continue;
      const [bx, by] = cr.pts[i];
      const ba = cr.a + (hash01(b, seed + 41) < 0.5 ? 1 : -1) * (0.9 + 0.5 * hash01(b, seed + 42));
      const bl = r * (0.25 + 0.25 * hash01(b, seed + 43)) * f;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ba) * bl * 0.55 + Math.sin(ba) * r * 0.05, by + Math.sin(ba) * bl * 0.55 - Math.cos(ba) * r * 0.05);
      ctx.lineTo(bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl);
      strokeInk(ctx, lw * 0.6);
    }
    ctx.restore();
  };

  ctx.save();
  ctx.translate(x, y);
  if (split > 0) {
    // two halves drifting apart along the crack normal
    const nx = -Math.sin(cr.a), ny = Math.cos(cr.a);
    const d = split * r * 0.45;
    for (const sgn of [-1, 1]) {
      ctx.save();
      ctx.translate(nx * d * sgn, ny * d * sgn);
      ctx.rotate(sgn * split * 0.25);
      ctx.beginPath();
      cr.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      const far = r * 3;
      const e1 = cr.pts[cr.pts.length - 1], e0 = cr.pts[0];
      ctx.lineTo(e1[0] + nx * far * sgn, e1[1] + ny * far * sgn);
      ctx.lineTo(e0[0] + nx * far * sgn, e0[1] + ny * far * sgn);
      ctx.closePath();
      ctx.clip();
      drawBody();
      // exposed inner face along the crack (clipped to the rock)
      body(); ctx.clip();
      ctx.beginPath();
      cr.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.strokeStyle = '#ffb35c'; ctx.lineWidth = lw * 3.2; ctx.stroke();
      strokeInk(ctx, lw * 1.4);
      ctx.restore();

    }
    glow(ctx, 0, 0, r * 1.2 * split, '#ffcf6b', 0.5 * (1 - split * 0.6));
  } else {
    drawBody();
    drawCracks(crack);
    if (crack > 0.85) glow(ctx, 0, 0, r * 0.7, '#ffcf6b', (crack - 0.85) * 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Comet (head at x,y; tail along angle + π)
// ---------------------------------------------------------------------------
// o: { t, size (head radius, default 34), seed, alpha, tailColors [near, far] (default yellow → pale blue), curve (px sideways tail bend),
//      star 0..1 (the baby star's face shows in the head), starExpr }
export function drawComet(ctx, x, y, angle, len, o = {}) {
  const { t = 0, size = 34, seed = 5, alpha = 1, curve = 0 } = o;
  const [cNear, cFar] = o.tailColors || ['#ffe27a', '#8fd3ff'];
  if (alpha <= 0) return;
  const b = beatAt(t);
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.translate(x, y);
  ctx.rotate(angle + PI); // tail along +x
  const bend = (u) => curve * u * u;
  // soft flowing strands: each is a tapered ribbon drawn wide/faint → narrow/bright for soft edges
  const ribbon = (Ls, w0, cy) => {
    ctx.beginPath();
    const N = 18;
    const wAt = (u) => w0 * Math.pow(1 - u, 0.75) * (0.42 + 0.58 * Math.sin(Math.min(1, u * 2.4) * PI / 2));
    for (let i = 0; i <= N; i++) { const u = i / N; const px = u * Ls, py = cy(u) - wAt(u); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(u * Ls, cy(u) + wAt(u)); }
    ctx.closePath();
  };
  const strands = [
    { w: 2.7, L: 1.0, amp: 0.35, ph: 0, col: cFar },
    { w: 1.8, L: 0.8, amp: 0.5, ph: 2.1, col: mixColor(cNear, cFar, 0.45) },
    { w: 1.1, L: 0.6, amp: 0.35, ph: 4.2, col: cNear },
  ];
  for (const st of strands) {
    const Ls = len * st.L;
    const cy = (u) => bend(u * st.L) + Math.sin(u * 5.5 - b * PI + st.ph) * size * st.amp * u;
    for (let layer = 0; layer < 3; layer++) {
      const wk = [1, 0.62, 0.3][layer], ak = [0.15, 0.24, 0.42][layer];
      const c0 = layer === 2 ? '#fffbe6' : st.col;
      const g = ctx.createLinearGradient(0, 0, Ls, 0);
      g.addColorStop(0, rgba(c0, ak)); g.addColorStop(0.45, rgba(st.col, ak * 0.6)); g.addColorStop(1, rgba(st.col, 0));
      ribbon(Ls, size * st.w * wk, cy);
      ctx.fillStyle = g; ctx.fill();
    }
  }
  // flowing puffs
  const NP = 16;
  for (let i = 0; i < NP; i++) {
    const u = fract(i / NP + b * 0.35 + hash01(i, seed) * 0.05);
    const px = u * len * 0.95, py = bend(u) + Math.sin(u * 7 + i) * size * 0.45 * u;
    const rad = size * (1.5 - u * 1.1) * (0.8 + 0.4 * hash01(i, seed + 1));
    glow(ctx, px, py, rad * 1.9, mixColor(cNear, cFar, u), 0.55 * (1 - u) * Math.min(1, u * 8));
  }
  // sparkles
  const NS = 36;
  for (let i = 0; i < NS; i++) {
    const sp = 0.4 + 0.5 * hash01(i, seed + 2);
    const u = fract(hash01(i, seed + 3) + b * sp * 0.5);
    const px = u * len, py = bend(u) + (hash01(i, seed + 4) - 0.5) * size * 2.6 * (0.3 + u);
    const tw = 0.6 + 0.4 * Math.sin(TAU * (b * 2 + hash01(i, seed + 5)));
    const s = size * (0.2 + 0.42 * hash01(i, seed + 6)) * (1 - u * 0.6) * tw;
    sparkle(ctx, px, py, s, i % 3 ? '#ffffff' : '#fff2a8', (1 - u) * tw);
  }
  // head
  glow(ctx, 0, 0, size * 4.2, '#fff0a0', 0.55);
  glow(ctx, 0, 0, size * 2.2, '#ffffff', 0.8);
  const hg = ctx.createRadialGradient(-size * 0.15, -size * 0.15, 0, 0, 0, size);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.55, '#fff8d8'); hg.addColorStop(1, '#ffe27a');
  ctx.fillStyle = hg;
  circlePath(ctx, 0, 0, size); ctx.fill();
  const spin = b * PI * 0.25;
  rotSparkle(ctx, 0, 0, size * 2.1 * (1 + 0.15 * pulse(t)), spin, '#ffffff', 0.85);
  rotSparkle(ctx, 0, 0, size * 1.35, spin + PI / 4, '#fff6c0', 0.7);
  ctx.restore();
  if ((o.star || 0) > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp(o.star) * clamp(alpha);
    drawBabyStar(ctx, x, y, size * 1.05, { t, expr: o.starExpr || 'excited', glow: 0.4, sparkles: false, rot: 0 });
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// The baby star
// ---------------------------------------------------------------------------
const BS = { base: '#ffd23f', shade: '#f59a2e', inner: '#fff3a6', hi: '#fffbe6', cheek: '#ff8a7a', glow: '#ffe27a' };

function babyStarPath(ctx, R) {
  const ri = R * 0.62;
  const V = [];
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5;
    const rr = i % 2 ? ri : R;
    V.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  ctx.beginPath();
  ctx.moveTo((V[9][0] + V[0][0]) / 2, (V[9][1] + V[0][1]) / 2);
  for (let i = 0; i < 10; i++) {
    const v = V[i], n = V[(i + 1) % 10];
    ctx.arcTo(v[0], v[1], (v[0] + n[0]) / 2, (v[1] + n[1]) / 2, i % 2 ? R * 0.34 : R * 0.19);
  }
  ctx.closePath();
}

// o: { t, expr 'happy'|'scared'|'excited'|'sleepy'|'surprised', blink 0..1, wink 0..1, glow 0..1, rot,
//      look [dx,dy], bob bool (beat bob & squash when t given, default true), sparkles bool, rays 0..1 (default .6), squash, lw }
export function drawBabyStar(ctx, x, y, r, o = {}) {
  const { expr = 'happy', wink = 0, glow: gl0 = 1, rot = 0, look = [0, 0.15], sparkles = true, rays = 0.6 } = o;
  const hasT = o.t !== undefined;
  const t = o.t || 0;
  const b = beatAt(t);
  const lw = o.lw ?? clamp(r * 0.075, 1.6, LW);
  // beat bob & squash
  let bob = 0, sx = 1, sy = 1, rr = rot;
  if (hasT && o.bob !== false) {
    const p = pulse(t, 8), h = hop(t, 1);
    bob = -h * r * 0.1;
    sx = 1 + 0.07 * p - 0.02 * h; sy = 1 - 0.07 * p + 0.03 * h;
    rr += 0.07 * sway(t, 4);
  }
  if (o.squash) { sy *= o.squash; sx /= Math.sqrt(o.squash); }
  if (expr === 'sleepy') { sy *= 0.97; sx *= 1.02; }
  let jx = 0, jy = 0;
  if (expr === 'scared' && hasT) { jx = noise1(t * 40, 3) * r * 0.03; jy = noise1(t * 40, 9) * r * 0.02; }
  // auto blink every 8 beats
  let blink = o.blink;
  if (blink === undefined) {
    blink = 0;
    if (hasT) { const ph = ((b % 8) + 8) % 8; if (ph > 6.7 && ph < 7.0) blink = Math.sin(((ph - 6.7) / 0.3) * PI); }
  }
  if (expr === 'sleepy') blink = Math.max(blink, 0.5);
  const gl = gl0 * (expr === 'sleepy' ? 0.6 : 1) * (hasT ? 0.85 + 0.3 * pulse(t, 5) : 1);

  ctx.save();
  ctx.translate(x + jx, y + bob + jy);
  // halo + a few thin soft rays
  if (gl > 0) {
    const hg = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 2.1);
    hg.addColorStop(0, rgba('#fff3b0', 0.6 * Math.min(1, gl)));
    hg.addColorStop(0.3, rgba('#ffe27a', 0.26 * Math.min(1, gl)));
    hg.addColorStop(1, rgba('#ffe27a', 0));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.moveTo(r * 0.5, 0); ctx.arc(0, 0, r * 0.5, 0, TAU, true); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowRing(ctx, 0, 0, 0, r * 3.1, '#ffc94a', 0.16 * gl, 0);
    if (rays > 0) {
      ctx.rotate(b * PI / 16 + rot);
      const rg = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 2.8);
      rg.addColorStop(0, rgba('#fff2b0', 0.26 * gl * rays)); rg.addColorStop(1, rgba('#fff2b0', 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + PI / 10;
        const L = r * (i % 2 ? 2.0 : 2.8), w = i % 2 ? 0.03 : 0.045;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L);
        ctx.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L);
      }
      ctx.fill();
    }
    ctx.restore();
  }
  // orbiting sparkles, one pops on each beat
  if (sparkles) {
    for (let k = 0; k < 4; k++) {
      const a = -PI / 2 + PI / 5 + k * (TAU / 4) + (hasT ? b * TAU / 32 : 0);
      const d = r * (1.45 + 0.12 * (k % 2));
      let pop = 0.7;
      if (hasT) {
        const bi = Math.floor(b), ph = b - bi;
        const mine = (((bi % 4) + 4) % 4) === k;
        pop = mine ? 0.45 + 0.75 * Math.exp(-ph * 3) : 0.45;
      }
      rotSparkle(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.2 * pop, 0, '#ffffff', clamp(0.35 + pop * 0.6));
    }
  }
  ctx.rotate(rr);
  ctx.scale(sx, sy);
  // body
  babyStarPath(ctx, r);
  ctx.fillStyle = BS.shade; ctx.fill();
  ctx.save();
  babyStarPath(ctx, r); ctx.clip();
  ctx.save();
  ctx.rotate(-rr); // shade offset is in screen space (light from upper-left)
  ctx.translate(-r * 0.09, -r * 0.11);
  ctx.rotate(rr);
  babyStarPath(ctx, r * 0.985);
  ctx.fillStyle = BS.base; ctx.fill();
  ctx.restore();
  // inner warm light
  const ig = ctx.createRadialGradient(-r * 0.12, -r * 0.12, 0, -r * 0.05, -r * 0.05, r * 0.75);
  ig.addColorStop(0, rgba(BS.inner, 0.9)); ig.addColorStop(1, rgba(BS.inner, 0));
  ctx.fillStyle = ig;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  // highlights: top arm + left arm
  ctx.fillStyle = rgba(BS.hi, 0.95);
  ellipsePath(ctx, -r * 0.11, -r * 0.62, r * 0.055, r * 0.16, 0.18); ctx.fill();
  ellipsePath(ctx, -r * 0.62, -r * 0.24, r * 0.13, r * 0.045, -0.2); ctx.fill();
  circlePath(ctx, -r * 0.14, -r * 0.36, r * 0.035); ctx.fill();
  ctx.restore();
  babyStarPath(ctx, r);
  strokeInk(ctx, lw);

  // ---- face ----
  const faceY = r * 0.07;
  const eyeX = r * 0.225;
  let ew = r * 0.148, eh = r * 0.182, pr = r * 0.108;
  if (expr === 'excited') { ew *= 1.06; eh *= 1.06; pr *= 1.1; }
  if (expr === 'surprised') { ew *= 1.1; eh *= 1.14; pr *= 0.68; }
  if (expr === 'scared') { ew *= 1.06; eh *= 1.1; pr *= 0.6; }
  const lx = clamp(look[0], -1, 1), ly = clamp(look[1], -1, 1);
  const elw = lw * 0.62;
  // lid 0 = open .. 1 = closed (drawn as a line)
  const drawEye = (side, lid, winkStyle) => {
    const ex = side * eyeX, ey = faceY;
    if (lid > 0.9) {
      ctx.beginPath();
      if (winkStyle) ctx.arc(ex, ey + eh * 0.62, ew * 1.05, PI * 1.2, PI * 1.8); // ^ happy wink
      else ctx.arc(ex, ey - eh * 0.35, ew * 1.02, PI * 0.22, PI * 0.78); // ‿ closed
      strokeInk(ctx, elw * 1.2);
      return;
    }
    ctx.beginPath(); ctx.ellipse(ex, ey, ew, eh, 0, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.save(); ctx.clip();
    const px = ex + lx * ew * 0.32, py = ey + ly * eh * 0.28 + lid * eh * 0.25;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 1.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (expr === 'excited') {
      rotSparkle(ctx, px - pr * 0.28, py - pr * 0.32, pr * 0.66, 0, '#ffffff', 1);
      circlePath(ctx, px + pr * 0.4, py + pr * 0.45, pr * 0.16); ctx.fill();
    } else {
      circlePath(ctx, px - pr * 0.36, py - pr * 0.42, pr * 0.38); ctx.fill();
      circlePath(ctx, px + pr * 0.42, py + pr * 0.44, pr * 0.16); ctx.fill();
    }
    if (lid > 0.02) {
      // eyelid comes down from the top
      const ly0 = ey - eh + lid * eh * 2;
      ctx.beginPath();
      ctx.moveTo(ex - ew * 1.2, ey - eh * 1.3);
      ctx.lineTo(ex + ew * 1.2, ey - eh * 1.3);
      ctx.lineTo(ex + ew * 1.2, ly0);
      ctx.quadraticCurveTo(ex, ly0 + eh * 0.28, ex - ew * 1.2, ly0);
      ctx.closePath();
      ctx.fillStyle = '#ffc93a'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex - ew * 1.2, ly0);
      ctx.quadraticCurveTo(ex, ly0 + eh * 0.28, ex + ew * 1.2, ly0);
      strokeInk(ctx, elw * 1.1);
    }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(ex, ey, ew, eh, 0, 0, TAU);
    strokeInk(ctx, elw);
  };
  drawEye(-1, blink, false);
  drawEye(1, Math.max(blink, wink), wink > blink);
  // brows
  if (expr === 'scared' || expr === 'surprised') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const bx = side * eyeX, by = faceY - eh * (expr === 'surprised' ? 1.75 : 1.5);
      if (expr === 'scared') { ctx.moveTo(bx - side * ew * 0.9, by + eh * 0.05); ctx.quadraticCurveTo(bx, by - eh * 0.1, bx + side * ew * 0.7, by + eh * 0.4); }
      else { ctx.moveTo(bx - ew * 0.8, by + eh * 0.2); ctx.quadraticCurveTo(bx, by - eh * 0.35, bx + ew * 0.8, by + eh * 0.2); }
      strokeInk(ctx, elw * 0.9);
    }
  }
  // cheeks
  ctx.fillStyle = rgba(BS.cheek, expr === 'excited' || wink > 0.5 ? 0.85 : 0.65);
  for (const side of [-1, 1]) { ellipsePath(ctx, side * r * 0.36, faceY + r * 0.17, r * 0.085, r * 0.05); ctx.fill(); }
  // mouth
  const my = faceY + r * 0.2;
  const mouthOpen = (w, h, tongue = true) => {
    ctx.beginPath();
    ctx.moveTo(-w, my - h * 0.1);
    ctx.quadraticCurveTo(0, my - h * 0.25, w, my - h * 0.1);
    ctx.quadraticCurveTo(w * 0.9, my + h, 0, my + h);
    ctx.quadraticCurveTo(-w * 0.9, my + h, -w, my - h * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#7a2334'; ctx.fill();
    if (tongue) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#ff7a8a';
      ellipsePath(ctx, 0, my + h * 0.95, w * 0.62, h * 0.5); ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-w, my - h * 0.1);
    ctx.quadraticCurveTo(0, my - h * 0.25, w, my - h * 0.1);
    ctx.quadraticCurveTo(w * 0.9, my + h, 0, my + h);
    ctx.quadraticCurveTo(-w * 0.9, my + h, -w, my - h * 0.1);
    ctx.closePath();
    strokeInk(ctx, elw * 0.9);
  };
  if (expr === 'excited') mouthOpen(r * 0.1, r * 0.13);
  else if (expr === 'surprised') {
    ellipsePath(ctx, 0, my + r * 0.03, r * 0.045, r * 0.06); ctx.fillStyle = '#7a2334'; ctx.fill(); strokeInk(ctx, elw * 0.9);
  } else if (expr === 'scared') {
    ctx.beginPath();
    const w = r * 0.09;
    for (let i = 0; i <= 6; i++) { const px = -w + (i / 6) * 2 * w, py = my + r * 0.025 + (i % 2 ? -1 : 1) * r * 0.018; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    strokeInk(ctx, elw * 0.85);
  } else if (expr === 'sleepy') {
    ellipsePath(ctx, r * 0.01, my + r * 0.02, r * 0.03, r * 0.035 * (hasT ? 0.8 + 0.2 * sway(t, 4) : 1)); ctx.fillStyle = '#7a2334'; ctx.fill(); strokeInk(ctx, elw * 0.8);
  } else if (wink > 0.5) mouthOpen(r * 0.085, r * 0.09);
  else {
    ctx.beginPath(); ctx.arc(0, my - r * 0.035, r * 0.075, PI * 0.2, PI * 0.8);
    strokeInk(ctx, elw * 0.95);
  }
  ctx.restore();

  // extras in screen-ish space (no squash)
  ctx.save();
  ctx.translate(x + jx, y + bob + jy);
  if (expr === 'scared') {
    // sweat drop
    const dx = r * 0.55, dy = -r * 0.15 + (hasT ? hop(t, 1) * r * 0.04 : 0);
    ctx.beginPath();
    ctx.moveTo(dx, dy - r * 0.16);
    ctx.quadraticCurveTo(dx + r * 0.1, dy, dx, dy + r * 0.05);
    ctx.quadraticCurveTo(dx - r * 0.1, dy, dx, dy - r * 0.16);
    ctx.fillStyle = '#8fd3ff'; ctx.fill(); strokeInk(ctx, lw * 0.6);
  }
  if (expr === 'sleepy' && hasT) {
    for (let k = 0; k < 2; k++) {
      const u = fract(b / 4 + k * 0.5);
      const zs = r * (0.16 + 0.12 * u);
      ctx.save();
      ctx.globalAlpha *= Math.sin(PI * u);
      ctx.translate(r * (0.6 + 0.35 * u) + Math.sin(u * 6) * r * 0.08, -r * (0.55 + 0.7 * u));
      ctx.font = `bold ${zs.toFixed(1)}px "Arial Rounded MT Bold", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = lw * 0.9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.strokeText('z', 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillText('z', 0, 0);
      ctx.restore();
    }
  }
  if (wink > 0.6) {
    const a = clamp((wink - 0.6) / 0.4);
    rotSparkle(ctx, r * 0.55, -r * 0.35, r * 0.2 * ease.outBack(a), a * 0.6, '#ffffff', a);
    rotSparkle(ctx, r * 0.72, -r * 0.1, r * 0.1 * ease.outBack(a), 0, '#fff3b0', a);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Constellation "strings" — THE MOTIF
// ---------------------------------------------------------------------------
// pts = [[x,y] or [x,y,mag],...] (mag = optional star size multiplier, e.g. from CONSTELLATIONS / placeConstellation);
// progress 0..1 animates the strings on in order (equal time per segment).
// o: { t, color, rainbow, hue (rainbow start hue), lw, glow 0..1, starSize, alpha, segments [[i,j],..], closed,
//      vibrate 0..1 (strings twang on the beat), dust 0..1 (glitter along strings), linear (no per-segment ease) }
export function constellation(ctx, pts, progress = 1, o = {}) {
  const n = pts.length;
  if (!n) return;
  const { color = '#bfe3ff', rainbow = false, hue = 200, lw = 3, glow: gl = 1, starSize = 10, alpha = 1, closed = false,
    vibrate = 1, dust = 1, linear = false } = o;
  if (alpha <= 0) return;
  const hasT = o.t !== undefined;
  const t = o.t || 0;
  const b = beatAt(t);
  let segs = o.segments;
  if (!segs) {
    segs = [];
    for (let i = 0; i < n - 1; i++) segs.push([i, i + 1]);
    if (closed && n > 2) segs.push([n - 1, 0]);
  }
  const S = segs.length;
  const P = clamp(progress) * S;
  // when does each star get connected (in segment units)?
  // (end stars light up as the tip arrives; stars in no segment light up just before the picture completes)
  const conn = new Array(n).fill(Infinity);
  segs.forEach(([a, c], k) => { conn[a] = Math.min(conn[a], k); conn[c] = Math.min(conn[c], k + 0.6); });
  for (let i = 0; i < n; i++) if (conn[i] === Infinity) conn[i] = Math.max(0, S - 0.4);
  const hueAt = (s) => (hue + (s / Math.max(1, S)) * 300 + b * 12) % 360;
  const rainCol = (s, l) => `hsl(${hueAt(s).toFixed(1)}, 100%, ${l}%)`;
  const core = mixColor(color, '#ffffff', 0.6);

  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // geometry of drawn segments
  const drawn = [];
  let tip = null;
  for (let k = 0; k < S; k++) {
    const f = clamp(P - k);
    if (f <= 0) break;
    const [ia, ib] = segs[k];
    if (!pts[ia] || !pts[ib]) continue;
    const [ax, ay] = pts[ia], [bx, by] = pts[ib];
    const fe = linear ? f : ease.outCubic(f);
    const ex = lerp(ax, bx, fe), ey = lerp(ay, by, fe);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let off = 0;
    if (f >= 1) {
      const since = P - (k + 1);
      const twang = Math.exp(-since * 2.2) * Math.sin(since * TAU * 2.5) * Math.min(len * 0.06, 26);
      const beatTw = hasT ? pulse(t, 4) * Math.sin(TAU * (b * 3) + k) * Math.min(len * 0.025, 10) : 0;
      off = vibrate * (twang + beatTw);
    } else tip = { x: ex, y: ey, dx: (bx - ax) / len, dy: (by - ay) / len, k, f };
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    drawn.push({ ax, ay, ex, ey, cx: (ax + ex) / 2 + nx * off * 2, cy: (ay + ey) / 2 + ny * off * 2, k, f, fe, len });
  }
  const pathOf = (d) => { ctx.moveTo(d.ax, d.ay); ctx.quadraticCurveTo(d.cx, d.cy, d.ex, d.ey); };
  // strings: glow layers then core
  const layers = [[lw * 7, 0.09 * gl, false], [lw * 3.2, 0.24 * gl, false], [lw, 0.95, true]];
  for (const [w, a, isCore] of layers) {
    if (a <= 0) continue;
    ctx.lineWidth = w;
    if (!rainbow) {
      ctx.globalAlpha = alpha * a;
      ctx.strokeStyle = isCore ? core : color;
      ctx.beginPath();
      drawn.forEach(pathOf);
      ctx.stroke();
    } else {
      ctx.globalAlpha = alpha * a;
      for (const d of drawn) {
        const g = ctx.createLinearGradient(d.ax, d.ay, d.ex + 0.01, d.ey + 0.01);
        g.addColorStop(0, rainCol(d.k, isCore ? 88 : 66));
        g.addColorStop(1, rainCol(d.k + d.fe, isCore ? 88 : 66));
        ctx.strokeStyle = g;
        ctx.beginPath(); pathOf(d); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = alpha;
  // beads of light travelling along completed strings
  if (dust > 0) {
    for (const d of drawn) {
      if (d.f < 1) continue;
      for (let j = 0; j < 1; j++) {
        const u = fract(hash01(d.k * 3 + j, 17) + b * 0.1 * (0.6 + hash01(d.k * 3 + j, 18)));
        const px = lerp(lerp(d.ax, d.cx, u), lerp(d.cx, d.ex, u), u);
        const py = lerp(lerp(d.ay, d.cy, u), lerp(d.cy, d.ey, u), u);
        const a = dust * Math.sin(PI * u);
        glow(ctx, px, py, lw * 5, rainbow ? '#ffffff' : core, 0.7 * a);
        circlePath(ctx, px, py, lw * 0.9); ctx.fillStyle = rgba('#ffffff', a); ctx.fill();
      }
    }
  }
  // stars
  const hp = hat(t);
  for (let i = 0; i < n; i++) {
    if (!pts[i]) continue;
    const [x, y] = pts[i];
    const mag = pts[i][2] ?? 1; // optional per-star brightness/size (3rd element)
    const on = P >= conn[i] && conn[i] !== Infinity;
    const since = on ? P - conn[i] : 0;
    const pop = on ? lerp(1.85, 1, ease.outQuad(clamp(since / 0.4))) : 1;
    const tw = hasT ? 0.88 + 0.12 * Math.sin(TAU * (b / 2 + hash01(i, 5))) + (hash01(i, 6) < 0.5 ? 0.35 * hp : 0) : 1;
    const sz = starSize * mag * (on ? 1 : 0.5) * pop * tw;
    const col = color;
    if (rainbow) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 3.4);
      g.addColorStop(0, `hsla(${hueAt(Math.min(conn[i], S)).toFixed(1)},100%,75%,${(on ? 0.55 : 0.25) * gl})`);
      g.addColorStop(1, `hsla(${hueAt(Math.min(conn[i], S)).toFixed(1)},100%,75%,0)`);
      ctx.fillStyle = g; ctx.fillRect(x - sz * 3.4, y - sz * 3.4, sz * 6.8, sz * 6.8);
    } else glow(ctx, x, y, sz * 3.4, col, (on ? 0.55 : 0.25) * gl);
    sparkle(ctx, x, y, sz * 1.5, '#ffffff', on ? 1 : 0.75);
    rotSparkle(ctx, x, y, sz * 0.8, PI / 4, '#ffffff', on ? 0.8 : 0.4);
    ctx.fillStyle = '#ffffff';
    circlePath(ctx, x, y, sz * 0.3); ctx.fill();
  }
  // drawing tip
  if (tip) {
    const s = starSize * 1.2 + lw * 2;
    glow(ctx, tip.x, tip.y, s * 3.5, rainbow ? '#fff4d6' : core, 0.75);
    for (let j = 0; j < 7; j++) {
      const back = (j + 1) * lw * 3.2 * (0.6 + hash01(j, 23));
      const perp = (hash01(j + (hasT ? Math.floor(t * 24) : 0) * 7, 24) - 0.5) * lw * 6;
      sparkle(ctx, tip.x - tip.dx * back - tip.dy * perp, tip.y - tip.dy * back + tip.dx * perp, lw * (1.8 - j * 0.18), '#ffffff', 0.9 - j * 0.11);
    }
    rotSparkle(ctx, tip.x, tip.y, s * 1.9, b * 0.8, '#ffffff', 1);
    rotSparkle(ctx, tip.x, tip.y, s * 1.1, b * 0.8 + PI / 4, '#fffbe0', 0.9);
  }
  ctx.restore();
}

// Juno as a constellation (32 segments = 8 per beat over one bar):
//   head   = 8-point ring (r .42 about (0,-.5), flat top & chin); its outline is left open at the chin, where it
//            flows into the neck/shoulders, so head + dress read as one continuous silhouette
//   buns   = 5-point rings (r .2 at (±.56,-.9)), each tied to its nearest head point by ONE segment
//   dress  = shoulders (±.26,.06) → hem corners (±.5,.62), hem with two inner points for the legs
//   arms up-and-out from the shoulders, two legs, a 2-segment smile, and the eyes as lone stars at (±.15,-.52).
// Draw order: head outline → dress outline (one continuous loop) → arms → legs → buns → smile; the eyes light up
// last, as the picture completes. The buns come late on purpose: every partial state reads as a little girl
// (head + buns alone would read as mouse ears), and the pigtails arrive as the "it's Juno!" reveal.
// Each point carries a star magnitude (3rd element): key stars bright, in-between stars smaller.
function buildGirlConstellation() {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const ring = (cx, cy, r, n, a0) => Array.from({ length: n }, (_, i) => [r3(cx + r * Math.cos(a0 + (i * TAU) / n)), r3(cy + r * Math.sin(a0 + (i * TAU) / n))]);
  const pts = [];
  const add = (p, m) => pts.push([p[0], p[1], m]) - 1;
  // head: index 0 = lower-right side, 1 = chin right, 2 = chin left, 3 lower-left, 4 upper-left, 5/6 top, 7 upper-right
  const head = ring(0, -0.5, 0.42, 8, PI / 8).map((p, i) => add(p, [0.7, 0.75, 0.75, 0.7, 0.8, 0.9, 0.9, 0.8][i]));
  const shR = add([0.26, 0.06], 0.8), hemR = add([0.5, 0.62], 0.95), hemMR = add([0.17, 0.62], 0.7);
  const hemML = add([-0.17, 0.62], 0.7), hemL = add([-0.5, 0.62], 0.95), shL = add([-0.26, 0.06], 0.8);
  const handR = add([0.74, -0.2], 1), handL = add([-0.74, -0.2], 1);
  const footR = add([0.19, 1.0], 0.9), footL = add([-0.19, 1.0], 0.9);
  const bunOf = (side) => {
    const cx = side * 0.56, cy = -0.9;
    let hv = head[0], best = Infinity; // nearest head vertex; the bun ring points one vertex straight at it
    for (const h of head) { const d = Math.hypot(pts[h][0] - cx, pts[h][1] - cy); if (d < best) { best = d; hv = h; } }
    const ids = ring(cx, cy, 0.2, 5, Math.atan2(pts[hv][1] - cy, pts[hv][0] - cx)).map((p, i) => add(p, [0.55, 0.6, 0.85, 0.85, 0.6][i]));
    const segs = [[hv, ids[0]]];
    for (let i = 0; i < 5; i++) segs.push([ids[i], ids[(i + 1) % 5]]);
    return { hv, segs };
  };
  const bR = bunOf(1), bL = bunOf(-1);
  add([0.15, -0.52], 1); add([-0.15, -0.52], 1); // eyes (lone stars)
  const m0 = add([-0.17, -0.31], 0.5), m1 = add([0, -0.235], 0.6), m2 = add([0.17, -0.31], 0.5);
  const segments = [];
  for (let i = 0; i < 7; i++) segments.push([head[(i + 2) % 8], head[(i + 3) % 8]]); // chin-left → over the top → chin-right
  segments.push([head[1], shR], [shR, hemR], [hemR, hemMR], [hemMR, hemML], [hemML, hemL], [hemL, shL], [shL, head[2]]);
  segments.push([shR, handR], [shL, handL], [hemMR, footR], [hemML, footL]);
  segments.push(...bR.segs, ...bL.segs, [m0, m1], [m1, m2]);
  return { pts, segments };
}

const withMags = (c, mags) => ({ pts: c.pts.map((p, i) => [p[0], p[1], mags[i] ?? 1]), segments: c.segments });

// Ready-made constellation pictures in a unit box (x right, y down, roughly -1..1). Each point is [x, y, mag]
// (mag = relative star size: key stars 1, in-between stars smaller).
export const CONSTELLATIONS = {
  heart: withMags({
    pts: [[0, -0.45], [0.3, -0.85], [0.75, -0.8], [0.98, -0.4], [0.8, 0.12], [0.42, 0.55], [0, 0.95],
      [-0.42, 0.55], [-0.8, 0.12], [-0.98, -0.4], [-0.75, -0.8], [-0.3, -0.85]],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0]],
  }, [0.9, 0.75, 1, 0.8, 0.7, 0.75, 1, 0.75, 0.7, 0.8, 1, 0.75]),
  dog: withMags({ // standing dog facing right: tail up, pointy ear, boxy snout, four legs; lone star = eye
    pts: [[-1.0, -0.92], [-0.6, -0.3], [0.25, -0.35], [0.36, -0.68], [0.34, -1.08], [0.62, -0.82], [1.0, -0.64],
      [0.98, -0.44], [0.66, -0.4], [0.45, -0.05], [0.45, 0.66], [-0.55, 0.0], [-0.62, 0.66], [0.64, -0.63]],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [9, 11], [11, 12], [11, 1]],
  }, [1, 0.85, 0.7, 0.7, 1, 0.75, 1, 0.7, 0.65, 0.75, 0.95, 0.75, 0.95, 1]),
  dogFace: withMags({ // Biscuit's face: head, floppy ears, nose + mouth, eyes are lone stars (light up at the end)
    pts: [[-0.42, -0.78], [0.42, -0.78], [0.62, -0.1], [0.42, 0.52], [0, 0.72], [-0.42, 0.52], [-0.62, -0.1],
      [1.0, -0.5], [0.86, 0.3], [-1.0, -0.5], [-0.86, 0.3],
      [0, 0.18], [-0.2, 0.4], [0.2, 0.4], [-0.27, -0.22], [0.27, -0.22]],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 7], [7, 8], [8, 2], [0, 9], [9, 10], [10, 6],
      [11, 12], [11, 13]],
  }, [0.8, 0.8, 0.7, 0.7, 0.85, 0.7, 0.7, 1, 0.9, 1, 0.9, 1, 0.6, 0.6, 1, 1]),
  girl: buildGirlConstellation(),
  rocket: withMags({
    pts: [[0, -1.0], [0.3, -0.55], [0.32, 0.4], [0.62, 0.8], [0.25, 0.65], [-0.25, 0.65], [-0.62, 0.8], [-0.32, 0.4],
      [-0.3, -0.55], [0, -0.2], [0, 1.0]],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [4, 10], [10, 5], [1, 9], [9, 8]],
  }, [1, 0.8, 0.75, 1, 0.7, 0.7, 1, 0.75, 0.8, 0.9, 1]),
};
// Scale/rotate a CONSTELLATIONS entry (or {pts, segments}) into screen space: returns { pts, segments }.
export function placeConstellation(shape, cx, cy, size, rot = 0) {
  const s = typeof shape === 'string' ? CONSTELLATIONS[shape] : shape;
  const c = Math.cos(rot), sn = Math.sin(rot);
  return {
    pts: s.pts.map(([x, y, m]) => (m === undefined ? [cx + (x * c - y * sn) * size, cy + (x * sn + y * c) * size]
      : [cx + (x * c - y * sn) * size, cy + (x * sn + y * c) * size, m])),
    segments: s.segments,
  };
}

// ---------------------------------------------------------------------------
// Shooting star: (x,y) = start point, travels o.dist px along angle over u = 0..1
// ---------------------------------------------------------------------------
// o: { dist 700, len 320 (max streak length), size 9, color, tint, alpha }
export function shootingStar(ctx, x, y, angle, u, o = {}) {
  if (u <= 0 || u >= 1) return;
  const { dist = 700, len = 320, size = 9, color = '#ffffff', tint = '#bfe3ff', alpha = 1 } = o;
  const d = dist * ease.outQuad(u);
  const L = len * Math.pow(Math.sin(PI * Math.min(1, u * 1.3)), 0.6) + size;
  const a = alpha * clamp(u / 0.08) * (1 - clamp((u - 0.7) / 0.3));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.rotate(angle);
  // wide soft streak
  let g = ctx.createLinearGradient(d - L, 0, d, 0);
  g.addColorStop(0, rgba(tint, 0)); g.addColorStop(1, rgba(tint, 0.35));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(d - L, 0); ctx.lineTo(d, -size * 1.6); ctx.lineTo(d, size * 1.6); ctx.closePath(); ctx.fill();
  // bright core streak
  g = ctx.createLinearGradient(d - L, 0, d, 0);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.7, rgba(color, 0.7)); g.addColorStop(1, rgba(color, 1));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(d - L, 0); ctx.lineTo(d, -size * 0.55); ctx.arc(d, 0, size * 0.55, -PI / 2, PI / 2); ctx.closePath(); ctx.fill();
  // crumbs
  for (let i = 0; i < 6; i++) {
    const k = hash01(i, 61);
    const px = d - L * (0.15 + 0.7 * k), py = (hash01(i, 62) - 0.5) * size * 2.5 + u * 40 * k;
    sparkle(ctx, px, py, size * (0.5 + 0.5 * hash01(i, 63)) * (1 - k), '#ffffff', (1 - k) * 0.9);
  }
  glow(ctx, d, 0, size * 6, tint, 0.6);
  sparkle(ctx, d, 0, size * 2.6, '#ffffff', 1);
  circlePath(ctx, d, 0, size * 0.6); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}
