// Hand-held props. Each draws at the origin at "life size" relative to Juno at s = 1 (she is 420 px tall).
// Handle-type items have their GRIP at the origin with the handle running along the y axis and the business
// end at -y (hand frame: +x along the forearm, the fist grips across it). See the notes on each export.
import { INK, LW, PAL, FONT, circlePath, ellipsePath, rrectPath, smoothPath, softStarPath, glow, sparkle } from '../draw.js';
import { TAU, clamp, lerp, hash01, noise1, mixColor, rgba, ease, fract } from '../util.js';
import { beatAt, pulse } from '../timing.js';

const PI = Math.PI;
const DW = LW * 0.5; // inner detail line width

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function strokeInk(ctx, lw = LW, color = INK) {
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}
// Several path builders filled as one shape with a single clean outline (ink band `lw` wide, outside).
function union(ctx, builders, fill, lw = LW) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (lw > 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = lw * 2;
    for (const b of builders) { b(); ctx.stroke(); }
  }
  ctx.fillStyle = fill;
  for (const b of builders) { b(); ctx.fill(); }
  ctx.restore();
}
// Fill + ink in one (outline centred on the edge, like draw.js ink()).
function inked(ctx, build, fill, lw = LW) {
  build();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) strokeInk(ctx, lw);
}
function clipTo(ctx, build, fn) { ctx.save(); build(); ctx.clip(); fn(); ctx.restore(); }
// Outlined thick stroke (limb technique): ink stroke w + 2lw, then colour stroke w.
function tube(ctx, build, w, color, lw = LW, cap = 'round') {
  ctx.save();
  ctx.lineCap = cap; ctx.lineJoin = 'round';
  build(); ctx.strokeStyle = INK; ctx.lineWidth = w + 2 * lw; ctx.stroke();
  build(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}
const rr = (ctx, x, y, w, h, r) => () => rrectPath(ctx, x, y, w, h, r);
const circ = (ctx, x, y, r) => () => circlePath(ctx, x, y, r);
function hiliteStroke(ctx, build, color = 'rgba(255,255,255,0.7)', w = 3) {
  build(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
}
function text(ctx, str, x, y, size, color, { font = FONT.hand, align = 'center', rot = 0, weight = 'bold', maxW = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (maxW > 0) { const w = ctx.measureText(str).width; if (w > maxW) ctx.scale(maxW / w, maxW / w); }
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}
const STEEL = '#cfd6e3', STEEL_D = '#9aa3b5', STEEL_L = '#f2f5fa';
const WOOD = '#d69a5c', WOOD_D = '#a8693a', WOOD_L = '#f0c28c';

// ---------------------------------------------------------------------------
// hammer — grip at origin, head at y ≈ -92 (striking face toward +x, claw toward -x). ~95 x 150 px
// ---------------------------------------------------------------------------
export function hammer(ctx, o = {}) {
  ctx.save();
  // handle
  const handle = rr(ctx, -8, -84, 16, 118, 8);
  inked(ctx, handle, WOOD);
  clipTo(ctx, handle, () => {
    ctx.fillStyle = WOOD_D; ctx.fillRect(2, -90, 10, 130);
    ctx.fillStyle = WOOD_L; ctx.fillRect(-6, -80, 3, 100);
  });
  handle(); strokeInk(ctx);
  // rubber grip
  const grip = rr(ctx, -10, -16, 20, 50, 9);
  inked(ctx, grip, PAL.red);
  clipTo(ctx, grip, () => {
    ctx.fillStyle = PAL.redDark; ctx.fillRect(3, -20, 10, 60);
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 2;
    for (let y = -8; y < 32; y += 8) { ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(12, y + 3); ctx.stroke(); }
  });
  grip(); strokeInk(ctx);
  // head (body + face + claw as one silhouette)
  const body = rr(ctx, -30, -106, 56, 28, 6);
  const face = rr(ctx, 20, -111, 16, 38, 6);
  const claw = () => {
    ctx.beginPath();
    ctx.moveTo(-26, -106);
    ctx.quadraticCurveTo(-48, -108, -60, -86);
    ctx.lineTo(-54, -82);
    ctx.quadraticCurveTo(-44, -92, -26, -80);
    ctx.closePath();
  };
  union(ctx, [body, face, claw], STEEL);
  // shading
  clipTo(ctx, body, () => { ctx.fillStyle = STEEL_D; ctx.fillRect(-40, -88, 80, 14); });
  clipTo(ctx, face, () => { ctx.fillStyle = STEEL_D; ctx.fillRect(30, -120, 10, 50); ctx.fillRect(10, -84, 30, 14); });
  clipTo(ctx, claw, () => { ctx.fillStyle = STEEL_D; ctx.beginPath(); ctx.moveTo(-60, -84); ctx.quadraticCurveTo(-44, -94, -26, -86); ctx.lineTo(-26, -70); ctx.lineTo(-60, -70); ctx.fill(); });
  // face edge line + claw split notch
  ctx.beginPath(); ctx.moveTo(20, -103); ctx.lineTo(20, -81); strokeInk(ctx, DW);
  ctx.beginPath(); ctx.moveTo(-58, -85); ctx.lineTo(-47, -92); strokeInk(ctx, DW * 0.8);
  // highlights
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-22, -100); ctx.lineTo(12, -100); }, 'rgba(255,255,255,0.85)', 4);
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(25, -104); ctx.lineTo(25, -94); }, 'rgba(255,255,255,0.85)', 3);
  // collar where handle meets head
  inked(ctx, rr(ctx, -11, -80, 22, 9, 3), STEEL_D, DW);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// wrench — grip at origin, open jaw at y ≈ -92. ~52 x 160 px
// ---------------------------------------------------------------------------
export function wrench(ctx, o = {}) {
  ctx.save();
  const jawC = [0, -94], R = 26, slot = 10;
  const jaw = () => {
    ctx.save();
    ctx.translate(jawC[0], jawC[1]);
    ctx.rotate(0.28);
    const a1 = -Math.acos(slot / R), a0 = -PI + Math.acos(slot / R);
    ctx.beginPath();
    ctx.moveTo(-slot, -2);
    ctx.lineTo(-slot, Math.sin(a0) * R);
    ctx.arc(0, 0, R, a0, a1, true);
    ctx.lineTo(slot, -2);
    ctx.arc(0, -2, slot, 0, PI);
    ctx.closePath();
    ctx.restore();
  };
  const shaft = () => {
    ctx.beginPath();
    ctx.moveTo(-8, -76); ctx.lineTo(8, -76); ctx.lineTo(10, 52);
    ctx.arc(0, 52, 10, 0, PI); ctx.lineTo(-8, -76); ctx.closePath();
  };
  union(ctx, [shaft, jaw], STEEL);
  clipTo(ctx, jaw, () => {
    ctx.fillStyle = STEEL_D;
    ctx.beginPath(); ctx.arc(jawC[0] + 7, jawC[1] + 7, R, 0, TAU); ctx.arc(jawC[0] - 2, jawC[1] - 2, R, 0, TAU, true); ctx.fill('evenodd');
  });
  clipTo(ctx, shaft, () => { ctx.fillStyle = STEEL_D; ctx.fillRect(2, -80, 12, 150); });
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, -70); ctx.lineTo(-5, -20); }, 'rgba(255,255,255,0.85)', 3);
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.arc(jawC[0], jawC[1], R - 6, PI * 0.75, PI * 1.05); }, 'rgba(255,255,255,0.85)', 3);
  // red rubber grip with hanging hole
  const grip = rr(ctx, -12, -20, 24, 76, 11);
  inked(ctx, grip, PAL.red);
  clipTo(ctx, grip, () => { ctx.fillStyle = PAL.redDark; ctx.fillRect(4, -30, 12, 100); });
  grip(); strokeInk(ctx);
  inked(ctx, circ(ctx, 0, 44, 4.5), INK, 0);
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-6, 24); }, 'rgba(255,255,255,0.55)', 3);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// remote — homemade launch remote held around the origin. o: { pressed 0..1, t }
// box ~ 70 x 90 px, antenna tip at (32, -118)
// ---------------------------------------------------------------------------
export function remote(ctx, o = {}) {
  const p = clamp(o.pressed ?? 0);
  ctx.save();
  // antenna (behind box)
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(20, -44); ctx.lineTo(30, -112); }, 5, STEEL_D, LW * 0.8);
  inked(ctx, circ(ctx, 31, -117, 8), PAL.red, LW * 0.8);
  inked(ctx, circ(ctx, 28.5, -119.5, 2.5), '#ffffff', 0);
  inked(ctx, rr(ctx, 13, -52, 16, 11, 3), STEEL, LW * 0.7);
  // box
  const box = rr(ctx, -35, -48, 70, 86, 14);
  inked(ctx, box, PAL.yellow);
  clipTo(ctx, box, () => {
    ctx.fillStyle = '#f0a83a';
    ctx.fillRect(22, -60, 20, 110);
    ctx.fillRect(-40, 30, 90, 12);
    // hazard band
    ctx.save();
    ctx.beginPath(); ctx.rect(-40, 16, 80, 14); ctx.clip();
    ctx.fillStyle = INK; ctx.fillRect(-40, 16, 80, 14);
    ctx.fillStyle = PAL.yellow;
    for (let x = -50; x < 50; x += 14) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x + 7, 30); ctx.lineTo(x + 14, 16); ctx.lineTo(x + 7, 16); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-29, -42, 5, 30);
  });
  box(); strokeInk(ctx);
  ctx.beginPath(); ctx.moveTo(-35, 16); ctx.lineTo(35, 16); ctx.moveTo(-35, 30); ctx.lineTo(35, 30); strokeInk(ctx, DW * 0.8);
  // strip of silver tape (homemade) across the lower-right corner
  ctx.save();
  ctx.translate(27, 28); ctx.rotate(-0.75);
  inked(ctx, rr(ctx, -15, -6, 30, 12, 2), '#c9ced8', DW);
  ctx.strokeStyle = rgba(INK, 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.stroke();
  ctx.restore();
  // LED
  const ledCol = p > 0.5 ? '#ff4d4d' : '#5cc26b';
  if (p > 0.5) glow(ctx, -21, -35, 22, '#ff6b6b', 0.7);
  inked(ctx, circ(ctx, -21, -35, 4.5), ledCol, DW);
  inked(ctx, circ(ctx, -22.5, -36.5, 1.5), '#ffffff', 0);
  // big red button: bezel + protruding cap (height shrinks when pressed)
  const by = -6, h = lerp(8, 1.5, p);
  inked(ctx, circ(ctx, 0, by, 22), PAL.greyDark, LW * 0.8);
  inked(ctx, circ(ctx, 0, by, 18), '#3d4252', 0);
  const cap = () => {
    ctx.beginPath();
    ctx.arc(0, by, 16, 0, PI);
    ctx.lineTo(-16, by - h);
    ctx.arc(0, by - h, 16, PI, TAU);
    ctx.closePath();
  };
  inked(ctx, cap, PAL.redDark, LW * 0.8);
  inked(ctx, circ(ctx, 0, by - h, 16), p > 0.5 ? '#d63a33' : PAL.red, LW * 0.8);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ellipsePath(ctx, -6, by - h - 6, 6, 3.5, -0.5); ctx.fill();
  if (p > 0.6) {
    const k = (p - 0.6) / 0.4;
    ctx.strokeStyle = rgba('#ffffff', 1 - k * 0.3); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = -PI / 2 + (i - 2.5) * 0.45;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (26 + 4 * k), by + Math.sin(a) * (26 + 4 * k));
      ctx.lineTo(Math.cos(a) * (34 + 10 * k), by + Math.sin(a) * (34 + 10 * k));
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// paintbrush — flat decorator's brush. Grip at origin, bristles at y ≈ -50..-104. o: { color (paint), drip 0..1 }
// ---------------------------------------------------------------------------
export function paintbrush(ctx, o = {}) {
  const { color = PAL.red, drip = 0 } = o;
  const dark = mixColor(color, INK, 0.3), light = mixColor(color, '#ffffff', 0.45);
  ctx.save();
  // handle: slim end flaring toward the ferrule
  const handle = () => {
    ctx.beginPath();
    ctx.moveTo(-12, -22);
    ctx.bezierCurveTo(-12, -8, -8, -2, -8, 8);
    ctx.lineTo(-8, 30);
    ctx.bezierCurveTo(-8, 44, 8, 44, 8, 30);
    ctx.lineTo(8, 8);
    ctx.bezierCurveTo(8, -2, 12, -8, 12, -22);
    ctx.closePath();
  };
  inked(ctx, handle, WOOD);
  clipTo(ctx, handle, () => {
    ctx.fillStyle = WOOD_D; ctx.fillRect(3, -30, 16, 80);
    ctx.fillStyle = color; ctx.fillRect(-20, 28, 40, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-9, -18, 3, 36);
  });
  handle(); strokeInk(ctx);
  ctx.beginPath(); ctx.moveTo(-8, 28); ctx.lineTo(8, 28); strokeInk(ctx, DW * 0.7);
  inked(ctx, circ(ctx, 0, 34, 2.4), INK, 0);
  // bristles
  const bristles = () => {
    ctx.beginPath();
    ctx.moveTo(-16, -48);
    ctx.lineTo(-20, -90);
    ctx.quadraticCurveTo(-19, -104, 0, -104);
    ctx.quadraticCurveTo(19, -104, 20, -90);
    ctx.lineTo(16, -48);
    ctx.closePath();
  };
  inked(ctx, bristles, '#f2d29b');
  clipTo(ctx, bristles, () => {
    ctx.fillStyle = '#d9b373'; ctx.fillRect(7, -110, 20, 70);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-24, -76);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-24 + i * 6, -74 + (i % 2 ? 7 : -2) + (i === 3 ? 8 : 0));
    ctx.lineTo(24, -110); ctx.lineTo(-24, -110); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(8, -110); ctx.lineTo(24, -110); ctx.lineTo(24, -70); ctx.lineTo(8, -72); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba('#8a5a3b', 0.45); ctx.lineWidth = 1.6;
    for (let x = -12; x <= 12; x += 5) { ctx.beginPath(); ctx.moveTo(x, -50); ctx.lineTo(x * 1.1, -70); ctx.stroke(); }
    ctx.fillStyle = rgba(light, 0.9);
    ellipsePath(ctx, -10, -92, 3, 7, 0.1); ctx.fill();
  });
  bristles(); strokeInk(ctx);
  // ferrule
  const fer = rr(ctx, -18, -52, 36, 32, 5);
  inked(ctx, fer, STEEL);
  clipTo(ctx, fer, () => { ctx.fillStyle = STEEL_D; ctx.fillRect(7, -60, 14, 44); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-13, -48, 4, 24); });
  fer(); strokeInk(ctx);
  ctx.beginPath(); ctx.moveTo(-18, -40); ctx.lineTo(18, -40); ctx.moveTo(-18, -33); ctx.lineTo(18, -33); strokeInk(ctx, DW * 0.7);
  // drips running down over the ferrule
  if (drip > 0) {
    for (const [dx, k] of [[-9, 1], [6, 0.65], [13, 0.4]]) {
      const len = 34 * clamp(drip * 1.3) * k;
      if (len < 2) continue;
      const y0 = -58, y1 = y0 + len;
      const d = () => {
        ctx.beginPath();
        ctx.moveTo(dx - 3.2, y0); ctx.lineTo(dx - 3.2, y1);
        ctx.arc(dx, y1, 4.4, PI, 0, true);
        ctx.lineTo(dx + 3.2, y0); ctx.closePath();
      };
      union(ctx, [d], color, LW * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ellipsePath(ctx, dx - 1.4, y1 - 1, 1.2, 2); ctx.fill();
    }
    if (drip > 0.6) {
      const k = (drip - 0.6) / 0.4;
      const yy = -14 + k * 70;
      ctx.save();
      ctx.globalAlpha *= 1 - clamp((k - 0.8) / 0.2);
      const drop = () => { ctx.beginPath(); ctx.moveTo(-9, yy - 10); ctx.quadraticCurveTo(-4, yy - 2, -4, yy + 1); ctx.arc(-9, yy + 1, 5, 0, PI); ctx.quadraticCurveTo(-14, yy - 2, -9, yy - 10); ctx.closePath(); };
      union(ctx, [drop], color, LW * 0.5);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// blueprint — origin = centre of the TOP edge (where two hands hold it, at x = ±170). Sheet hangs down to y = 250.
// o: { open 0..1 (rolled scroll → unrolled), crossed 0..1 (red X draws on), crumple 0..1 (collapses into a ball
//      centred on the origin), title (string), drawing 'test'|'rocket', t }
// ---------------------------------------------------------------------------
export const BLUEPRINT_W = 340, BLUEPRINT_H = 250;
const BP = { bg: '#2f6fd1', bgD: '#1f55ad', line: '#eaf3ff', roll: '#3b7fe0' };

function bpContent(ctx, o) {
  const BW = BLUEPRINT_W, BH = BLUEPRINT_H;
  ctx.fillStyle = BP.bg; ctx.fillRect(-BW / 2, 0, BW, BH);
  // grid
  ctx.strokeStyle = rgba('#ffffff', 0.13); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -BW / 2 + 10; x < BW / 2; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, BH); }
  for (let y = 10; y < BH; y += 20) { ctx.moveTo(-BW / 2, y); ctx.lineTo(BW / 2, y); }
  ctx.stroke();
  ctx.strokeStyle = rgba(BP.line, 0.8); ctx.lineWidth = 2;
  ctx.strokeRect(-BW / 2 + 9, 9, BW - 18, BH - 18);
  // title
  const title = o.title ?? (o.drawing === 'test' ? 'TEST #1' : 'S.S. BISCUIT');
  if (title) {
    text(ctx, title, 0, 32, 26, '#ffffff', { maxW: BW - 50, rot: -0.02 });
    ctx.beginPath(); ctx.moveTo(-90, 50);
    for (let i = 1; i <= 12; i++) ctx.lineTo(-90 + i * 15, 50 + (i % 2 ? 2.5 : -1));
    ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
  }
  ctx.save();
  ctx.strokeStyle = BP.line; ctx.fillStyle = BP.line; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const L = (pts, close = false) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); if (close) ctx.closePath(); ctx.stroke(); };
  const label = (s, x, y, size = 13, rot = 0) => text(ctx, s, x, y, size, '#ffffff', { rot, align: 'left' });
  const arrow = (x0, y0, x1, y1) => {
    L([[x0, y0], [x1, y1]]);
    const a = Math.atan2(y1 - y0, x1 - x0);
    L([[x1 - Math.cos(a - 0.5) * 7, y1 - Math.sin(a - 0.5) * 7], [x1, y1], [x1 - Math.cos(a + 0.5) * 7, y1 - Math.sin(a + 0.5) * 7]]);
  };
  const cx = -58;
  if (o.drawing === 'test') {
    // traffic-cone nose
    L([[cx - 24, 116], [cx - 6, 66], [cx + 6, 66], [cx + 24, 116]]);
    L([[cx - 17, 96], [cx + 17, 96]]); L([[cx - 13, 86], [cx + 13, 86]]);
    // trash-can body with ribs + lid rim
    L([[cx - 32, 116], [cx + 32, 116], [cx + 28, 206], [cx - 28, 206]], true);
    L([[cx - 36, 116], [cx + 36, 116]]);
    for (let y = 136; y < 200; y += 18) L([[cx - 30 + (y - 116) * 0.04, y], [cx + 30 - (y - 116) * 0.04, y]]);
    // cardboard fins + tape crosses
    L([[cx - 28, 170], [cx - 52, 214], [cx - 27, 204]]);
    L([[cx + 28, 170], [cx + 52, 214], [cx + 27, 204]]);
    L([[cx - 42, 186], [cx - 32, 196]]); L([[cx - 42, 196], [cx - 32, 186]]);
    L([[cx + 42, 186], [cx + 32, 196]]); L([[cx + 42, 196], [cx + 32, 186]]);
    // flame doodle
    L([[cx - 10, 210], [cx - 6, 230], [cx, 216], [cx + 6, 232], [cx + 10, 210]]);
    // dimension line
    arrow(cx - 70, 150, cx - 70, 66); arrow(cx - 70, 150, cx - 70, 232);
    label('1.2m?', cx - 94, 158, 12, -PI / 2);
    // notes
    label('CONE', 20, 80); arrow(18, 82, cx + 16, 90);
    label('BIN (clean!)', 20, 120); arrow(18, 122, cx + 32, 140);
    label('cardboard fins', 20, 170); arrow(18, 172, cx + 44, 196);
    label('lots of TAPE', 20, 200);
    label('what could', 60, 222, 12, -0.08); label('go wrong?', 64, 236, 12, -0.08);
  } else {
    // S.S. Biscuit side view
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx, 62);
      ctx.bezierCurveTo(cx + 24, 76, cx + 32, 96, cx + 32, 112);
      ctx.lineTo(cx + 32, 200);
      ctx.quadraticCurveTo(cx + 30, 214, cx + 22, 218);
      ctx.lineTo(cx - 22, 218);
      ctx.quadraticCurveTo(cx - 30, 214, cx - 32, 200);
      ctx.lineTo(cx - 32, 112);
      ctx.bezierCurveTo(cx - 32, 96, cx - 24, 76, cx, 62);
      ctx.closePath();
    };
    body(); ctx.stroke();
    L([[cx - 31, 108], [cx + 31, 108]]);
    L([[cx - 32, 190], [cx + 32, 190]]);
    // fins
    ctx.beginPath(); ctx.moveTo(cx - 32, 168); ctx.quadraticCurveTo(cx - 60, 190, cx - 58, 228); ctx.lineTo(cx - 26, 214); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 32, 168); ctx.quadraticCurveTo(cx + 60, 190, cx + 58, 228); ctx.lineTo(cx + 26, 214); ctx.stroke();
    L([[cx, 196], [cx, 232]]);
    // nozzle
    L([[cx - 12, 218], [cx - 17, 234], [cx + 17, 234], [cx + 12, 218]]);
    // portholes
    for (const [py, pr] of [[132, 13], [166, 11]]) {
      ctx.beginPath(); ctx.arc(cx, py, pr, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, py, pr - 4.5, 0, TAU); ctx.stroke();
    }
    // rivets
    for (let y = 118; y < 188; y += 12) { ctx.beginPath(); ctx.arc(cx - 25, y, 1.4, 0, TAU); ctx.arc(cx + 25, y, 1.4, 0, TAU); ctx.fill(); }
    // paw print decal
    ctx.beginPath(); ctx.ellipse(cx + 17, 202, 4, 3.2, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx + 12 + i * 5, 196 - (i === 1 ? 1.5 : 0), 1.7, 0, TAU); ctx.fill(); }
    // dimension line
    arrow(cx - 76, 148, cx - 76, 62); arrow(cx - 76, 148, cx - 76, 234);
    label('SUPER TALL', cx - 98, 190, 12, -PI / 2);
    // labels
    label('JUNO', 26, 92); arrow(24, 96, cx + 16, 128);
    label('BISCUIT', 26, 136); arrow(24, 140, cx + 14, 164);
    label('FINS x3', 26, 180); arrow(24, 182, cx + 50, 204);
    label('snack hatch', 30, 214, 12);
    // doodles: star + heart
    ctx.save(); ctx.translate(132, 90); ctx.rotate(0.2);
    softStarPath(ctx, 0, 0, 12, 6); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(132, 236); ctx.bezierCurveTo(122, 226, 124, 216, 132, 222); ctx.bezierCurveTo(140, 216, 142, 226, 132, 236); ctx.stroke();
  }
  ctx.restore();
  // red X (marker)
  const cr = clamp(o.crossed || 0);
  if (cr > 0) {
    const stroke = (x0, y0, x1, y1, f) => {
      if (f <= 0) return;
      const ex = lerp(x0, x1, f), ey = lerp(y0, y1, f);
      const mx = (x0 + ex) / 2 + (ey - y0) * 0.04, my = (y0 + ey) / 2 - (ex - x0) * 0.04;
      tube(ctx, () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, ex, ey); }, 16, PAL.red, 3);
    };
    stroke(-130, 30, 130, 225, ease.outQuad(clamp(cr * 2)));
    stroke(125, 28, -125, 228, ease.outQuad(clamp(cr * 2 - 1)));
  }
}

export function blueprint(ctx, o = {}) {
  const open = clamp(o.open ?? 1), crumple = clamp(o.crumple || 0);
  const BW = BLUEPRINT_W, BH = BLUEPRINT_H;
  ctx.save();
  if (crumple > 0) {
    const e = ease.inOutCubic(crumple);
    const C = [0, lerp(BH / 2, 0, e)];
    const RB = 46;
    const N = 26;
    const pts = [];
    // perimeter samples of the sheet (relative to its centre) morphing to a lumpy ball
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const per = u * 2 * (BW + BH);
      let qx, qy;
      if (per < BW) { qx = -BW / 2 + per; qy = -BH / 2; }
      else if (per < BW + BH) { qx = BW / 2; qy = -BH / 2 + (per - BW); }
      else if (per < 2 * BW + BH) { qx = BW / 2 - (per - BW - BH); qy = BH / 2; }
      else { qx = -BW / 2; qy = BH / 2 - (per - 2 * BW - BH); }
      const a = Math.atan2(qy, qx);
      const jag = 1 + ((i % 2 ? -0.06 : 0.05) + 0.16 * (hash01(i, 5) - 0.5)) * Math.min(1, crumple * 2);
      const bx = Math.cos(a) * RB * jag, by = Math.sin(a) * RB * jag;
      const wob = Math.sin(crumple * PI) * 14 * (hash01(i, 9) - 0.5);
      pts.push([C[0] + lerp(qx, bx, e) + wob, C[1] + lerp(qy, by, e) + wob]);
    }
    const poly = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    poly(); ctx.fillStyle = BP.bg; ctx.fill();
    clipTo(ctx, poly, () => {
      ctx.save();
      const k = lerp(1, 0.32, e);
      ctx.translate(C[0], C[1]); ctx.scale(k, k); ctx.rotate(crumple * 0.6); ctx.translate(0, -BH / 2);
      bpContent(ctx, o);
      ctx.restore();
      // crease facets
      for (let i = 0; i < N; i += 2) {
        const p0 = pts[i], p1 = pts[(i + 2) % N];
        const c = [C[0] + (hash01(i, 21) - 0.5) * 30 * e, C[1] + (hash01(i, 22) - 0.5) * 30 * e];
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.closePath();
        ctx.fillStyle = hash01(i, 23) < 0.5 ? rgba(INK, 0.28 * crumple) : rgba('#ffffff', 0.14 * crumple);
        ctx.fill();
      }
      ctx.strokeStyle = rgba('#0e2d66', 0.6 * crumple); ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const p0 = pts[Math.floor(hash01(i, 31) * N)], p1 = pts[Math.floor(hash01(i, 32) * N)];
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(lerp(p0[0], p1[0], 0.5) + 6, lerp(p0[1], p1[1], 0.5)); ctx.stroke();
      }
    });
    poly(); strokeInk(ctx);
    ctx.restore();
    return;
  }
  const h = BH * open;
  const rb = lerp(19, 6, open);
  if (open > 0.02) {
    const sheetP = rr(ctx, -BW / 2, 0, BW, h, 3);
    clipTo(ctx, sheetP, () => {
      bpContent(ctx, o);
      // soft shadow under the bottom roll & gentle curl shading on the right
      const g = ctx.createLinearGradient(BW / 2 - 40, 0, BW / 2, 0);
      g.addColorStop(0, rgba(BP.bgD, 0)); g.addColorStop(1, rgba(BP.bgD, 0.5));
      ctx.fillStyle = g; ctx.fillRect(BW / 2 - 40, 0, 40, h);
    });
    sheetP(); strokeInk(ctx);
    // top curled edge
    const top = rr(ctx, -BW / 2 - 4, -8, BW + 8, 15, 7.5);
    inked(ctx, top, '#5b9af0');
    hiliteStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-BW / 2 + 4, -3); ctx.lineTo(BW / 2 - 4, -3); }, 'rgba(255,255,255,0.6)', 3);
  }
  // bottom roll (the whole scroll when closed)
  if (open < 0.999) {
    const y = h;
    const roll = rr(ctx, -BW / 2 - 3, y - rb, BW + 6, rb * 2, rb);
    inked(ctx, roll, BP.roll);
    clipTo(ctx, roll, () => {
      ctx.fillStyle = BP.bgD; ctx.fillRect(-BW, y + rb * 0.25, BW * 2, rb);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-BW / 2 + 6, y - rb * 0.6, BW - 12, Math.max(2, rb * 0.22));
      ctx.strokeStyle = rgba('#ffffff', 0.25); ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { const lx = -BW / 2 + 40 + i * 64; ctx.beginPath(); ctx.moveTo(lx, y - rb); ctx.lineTo(lx + 6, y + rb); ctx.stroke(); }
    });
    roll(); strokeInk(ctx);
    // end caps with spiral
    for (const sx of [-1, 1]) {
      const ex = sx * (BW / 2 + 3);
      inked(ctx, () => ellipsePath(ctx, ex, y, rb * 0.5, rb), '#dbe8ff', LW * 0.8);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) { const a = i * 0.8, r = rb * 0.85 * (i / 20); const px = ex + Math.cos(a) * r * 0.5, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      strokeInk(ctx, DW * 0.6, BP.bg);
    }
    if (open < 0.02) {
      // ribbon tie
      const band = rr(ctx, -9, y - rb - 2, 18, rb * 2 + 4, 4);
      inked(ctx, band, PAL.red, LW * 0.7);
      union(ctx, [() => { ctx.beginPath(); ctx.ellipse(-10, y - rb - 6, 10, 6, 0.4, 0, TAU); }, () => { ctx.beginPath(); ctx.ellipse(10, y - rb - 6, 10, 6, -0.4, 0, TAU); }], PAL.red, LW * 0.5);
      inked(ctx, circ(ctx, 0, y - rb - 5, 4.5), PAL.redDark, LW * 0.5);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// flag — grip at origin; pole from y = +120 (spike) to y = -236 (gold ball); paw-print flag flies toward +x.
// o: { t (waves, tempo-locked), color, wave 0..1 }
// ---------------------------------------------------------------------------
export const FLAG_POLE_BOTTOM = 124;
export function flag(ctx, o = {}) {
  const { t = 0, color = PAL.red, wave = 1 } = o;
  const FW = 150, FH = 96, top = -228;
  const ph = TAU * beatAt(t) / 2;
  const k = (TAU * 1.15) / FW;
  const yOff = (x) => wave * (2 + 11 * (x / FW)) * Math.sin(k * x - ph);
  const slope = (x) => wave * ((11 / FW) * Math.sin(k * x - ph) + (2 + 11 * (x / FW)) * k * Math.cos(k * x - ph));
  const xAt = (x) => x - wave * 5 * (x / FW) * (1 - Math.cos(k * x - ph));
  ctx.save();
  // pole
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 112); ctx.lineTo(0, -230); }, 9, STEEL, LW * 0.8, 'butt');
  inked(ctx, () => { ctx.beginPath(); ctx.moveTo(-4.5, 110); ctx.lineTo(0, 126); ctx.lineTo(4.5, 110); ctx.closePath(); }, STEEL_D, LW * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-2.5, -224, 2, 320);
  // cloth
  const N = 16;
  const cloth = () => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const x = (i / N) * FW; const px = 4 + xAt(x), py = top + yOff(x); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    for (let i = N; i >= 0; i--) { const x = (i / N) * FW; ctx.lineTo(4 + xAt(x), top + FH + yOff(x) * 1.1); }
    ctx.closePath();
  };
  const dark = mixColor(color, INK, 0.3), light = mixColor(color, '#ffffff', 0.18);
  const g = ctx.createLinearGradient(4, 0, 4 + FW, 0);
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * FW;
    const c = Math.cos(k * x - ph) * wave;
    g.addColorStop(i / 12, c > 0 ? mixColor(color, light, c) : mixColor(color, dark, -c * 0.9));
  }
  cloth(); ctx.fillStyle = g; ctx.fill();
  // paw print following the cloth
  clipTo(ctx, cloth, () => {
    const px = FW * 0.5, cx = 4 + xAt(px), cy = top + FH / 2 + yOff(px) * 1.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.transform(1, clamp(slope(px), -0.8, 0.8), 0, 1, 0, 0);
    ctx.scale(Math.max(0.55, 1 - 0.25 * Math.abs(slope(px))), 1);
    ctx.fillStyle = PAL.white;
    ellipsePath(ctx, 0, 10, 17, 14); ctx.fill();
    for (const [tx, ty, r] of [[-19, -8, 7], [-7, -18, 7.5], [7, -18, 7.5], [19, -8, 7]]) { circlePath(ctx, tx, ty, r); ctx.fill(); }
    ctx.restore();
  });
  cloth(); strokeInk(ctx);
  // grommets
  inked(ctx, circ(ctx, 4, top + 10, 4), STEEL, DW);
  inked(ctx, circ(ctx, 4, top + FH - 10, 4), STEEL, DW);
  // ball finial
  inked(ctx, circ(ctx, 0, -236, 9), PAL.gold, LW * 0.8);
  inked(ctx, circ(ctx, -3, -239, 2.8), '#ffffff', 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// net — big butterfly net. Grip at origin, pole up to the hoop (an upright ellipse centred at NET.hoop, seen
// three-quarter); the mesh bag trails toward +x (swing = -1 mirrors it).
// o: { t (bag sways, tempo-locked), swing ±1, glow 0..1 (something bright inside), full 0..1 (bag bulges),
//      inside: fn(ctx) drawn inside the bag, behind the mesh (origin = NET.bag, already mirrored with swing) }
// ---------------------------------------------------------------------------
export const NET = { hoop: [0, -300], rx: 30, ry: 62, bag: [78, -290] };
export function net(ctx, o = {}) {
  const { t = 0, swing = 1, glow: gl = 0, full = 0 } = o;
  const [hx, hy] = NET.hoop, RX = NET.rx, RY = NET.ry;
  const sw = Math.sin(TAU * beatAt(t) / 2);
  ctx.save();
  // pole
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, hy + RY - 2); }, 10, WOOD, LW * 0.8);
  ctx.fillStyle = rgba('#ffffff', 0.5); ctx.fillRect(-3, hy + RY + 8, 2, 250);
  inked(ctx, rr(ctx, -8, -24, 16, 48, 7), PAL.red, LW * 0.8);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(swing, 1);
  const tipX = 150 + 8 * sw + 18 * full, tipY = 62 + 10 * sw + 8 * full;
  const bag = () => {
    ctx.beginPath();
    ctx.moveTo(0, -RY);
    ctx.bezierCurveTo(70 + 12 * full, -RY - 6 - 10 * full, tipX + 16, tipY - 70, tipX, tipY);
    ctx.bezierCurveTo(tipX - 14, tipY + 20, 60, RY + 22 + 10 * full, 0, RY);
    ctx.ellipse(0, 0, RX, RY, 0, PI / 2, PI * 1.5);
    ctx.closePath();
  };
  bag(); ctx.fillStyle = rgba('#ffffff', 0.32); ctx.fill();
  const bx = NET.bag[0] - hx, by = NET.bag[1] - hy;
  if (gl > 0) glow(ctx, bx, by, 130, '#fff0a0', 0.85 * gl);
  if (o.inside) { ctx.save(); ctx.translate(bx, by); ctx.scale(swing, 1); o.inside(ctx); ctx.restore(); }
  // mesh
  clipTo(ctx, bag, () => {
    ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = -16; i < 26; i++) {
      const d = i * 12;
      ctx.moveTo(d - 110, -110); ctx.lineTo(d + 110, 110);
      ctx.moveTo(d + 110, -110); ctx.lineTo(d - 110, 110);
    }
    ctx.stroke();
    ctx.fillStyle = rgba('#7d8fb5', 0.28);
    ctx.beginPath(); ctx.ellipse(tipX * 0.6, tipY + 26, 110, 40, 0.35, 0, TAU); ctx.fill();
  });
  bag(); strokeInk(ctx, LW * 0.6);
  // hoop rim
  ctx.beginPath(); ctx.ellipse(0, 0, RX, RY, 0, 0, TAU);
  ctx.strokeStyle = INK; ctx.lineWidth = 7 + LW * 1.6; ctx.stroke();
  ctx.strokeStyle = PAL.yellow; ctx.lineWidth = 7; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, RX, RY, 0, PI * 1.1, PI * 1.4);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
  inked(ctx, rr(ctx, -7, hy + RY - 8, 14, 16, 4), STEEL_D, LW * 0.7);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// bone — centred at origin, ~100 px long (hold at the middle)
// ---------------------------------------------------------------------------
export function bone(ctx, o = {}) {
  ctx.save();
  const shapes = [rr(ctx, -36, -10, 72, 20, 10), circ(ctx, -40, -11, 14), circ(ctx, -40, 11, 14), circ(ctx, 40, -11, 14), circ(ctx, 40, 11, 14)];
  union(ctx, shapes, PAL.cream);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-36, -10, 72, 20);
  for (const [x, y] of [[-40, -11], [-40, 11], [40, -11], [40, 11]]) { ctx.moveTo(x + 14, y); ctx.arc(x, y, 14, 0, TAU); }
  ctx.clip();
  ctx.fillStyle = '#e8d3ad';
  ctx.fillRect(-60, 5, 120, 30);
  ctx.beginPath(); ctx.arc(44, 14, 12, 0, TAU); ctx.arc(-36, 14, 12, 0, TAU); ctx.fill();
  ctx.restore();
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-24, -4); ctx.lineTo(22, -4); }, 'rgba(255,255,255,0.9)', 4);
  hiliteStroke(ctx, () => { ctx.beginPath(); ctx.arc(-40, -11, 8, PI * 1.1, PI * 1.5); }, 'rgba(255,255,255,0.9)', 3);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// clapperboard — origin = centre of the slate body (~300 x 235 incl. clapper). Hinge at top-left.
// o: { clap 0..1 (0 open ~35°, 1 shut), scene '1', take '2', title 'STRINGS' }
// ---------------------------------------------------------------------------
export function clapperboard(ctx, o = {}) {
  const { clap = 0, scene = '1', take = '2', title = 'STRINGS' } = o;
  const BW = 300, top = -82, bot = 112, stickH = 30;
  const chalk = '#f4f1e6';
  ctx.save();
  // slate body
  const body = rr(ctx, -BW / 2, top, BW, bot - top, 12);
  inked(ctx, body, '#2d2a38');
  clipTo(ctx, body, () => {
    ctx.fillStyle = '#211f2a'; ctx.fillRect(BW / 2 - 18, top, 30, bot - top); ctx.fillRect(-BW / 2, bot - 12, BW, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.moveTo(-BW / 2, top); ctx.lineTo(-BW / 2 + 90, top); ctx.lineTo(-BW / 2, top + 90); ctx.fill();
    // chalk grid
    ctx.strokeStyle = rgba(chalk, 0.75); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-BW / 2 + 12, top + 50); ctx.lineTo(BW / 2 - 12, top + 49);
    ctx.moveTo(-BW / 2 + 12, top + 132); ctx.lineTo(BW / 2 - 12, top + 133);
    ctx.moveTo(1, top + 50); ctx.lineTo(-1, top + 132);
    ctx.moveTo(1, top + 133); ctx.lineTo(0, bot - 10);
    ctx.stroke();
    // smudges
    ctx.fillStyle = rgba(chalk, 0.06);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-100 + i * 50, top + 30 + (i % 3) * 60, 40, 12, 0.3, 0, TAU); ctx.fill(); }
  });
  body(); strokeInk(ctx);
  const ch = (s, x, y, size, rot = 0, a = 0.95) => {
    text(ctx, s, x + 1.2, y + 1, size, chalk, { rot, alpha: a * 0.25 });
    text(ctx, s, x, y, size, chalk, { rot, alpha: a });
  };
  ch('PROD.', -112, top + 25, 15, 0, 0.8);
  ch(title, 20, top + 26, 30, -0.03);
  ch('SCENE', -74, top + 64, 15, 0, 0.8);
  ch('TAKE', 74, top + 64, 15, 0, 0.8);
  ch(String(scene), -72, top + 102, 50, -0.06);
  ch(String(take), 76, top + 102, 54, 0.05);
  ch('DIR. JUNO', -72, top + 160, 18, -0.04);
  ch('CAM. BISCUIT', 74, top + 160, 18, 0.03);
  // chalk paw doodle
  ctx.save();
  ctx.globalAlpha *= 0.8;
  ctx.fillStyle = chalk;
  ctx.translate(126, top + 180); ctx.rotate(0.3);
  ellipsePath(ctx, 0, 3, 5, 4); ctx.fill();
  for (const [tx, ty] of [[-6, -3], [-2, -6], [2, -6], [6, -3]]) { circlePath(ctx, tx, ty, 2); ctx.fill(); }
  ctx.restore();
  // fixed stick
  const stripes = (x, y, w, h, dir) => {
    ctx.fillStyle = PAL.white; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2d2a38';
    for (let sx = x - 40; sx < x + w + 40; sx += 44) {
      ctx.beginPath();
      if (dir > 0) { ctx.moveTo(sx, y + h); ctx.lineTo(sx + 22, y + h); ctx.lineTo(sx + 22 + h * 0.8, y); ctx.lineTo(sx + h * 0.8, y); }
      else { ctx.moveTo(sx, y); ctx.lineTo(sx + 22, y); ctx.lineTo(sx + 22 + h * 0.8, y + h); ctx.lineTo(sx + h * 0.8, y + h); }
      ctx.fill();
    }
  };
  const fixed = rr(ctx, -BW / 2, top - stickH, BW, stickH, 5);
  inked(ctx, fixed, PAL.white);
  clipTo(ctx, fixed, () => stripes(-BW / 2, top - stickH, BW, stickH, 1));
  fixed(); strokeInk(ctx);
  // arm (hinged at top-left of the fixed stick)
  const ang = -lerp(0.5, 0, clamp(clap));
  ctx.save();
  ctx.translate(-BW / 2 + 2, top - stickH);
  ctx.rotate(ang);
  const arm = rr(ctx, -2, -stickH, BW, stickH, 5);
  inked(ctx, arm, PAL.white);
  clipTo(ctx, arm, () => stripes(-2, -stickH, BW, stickH, -1));
  arm(); strokeInk(ctx);
  ctx.restore();
  // hinge
  inked(ctx, circ(ctx, -BW / 2 + 4, top - stickH, 8), STEEL, LW * 0.8);
  inked(ctx, circ(ctx, -BW / 2 + 4, top - stickH, 2.5), INK, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// nailBox — little wooden tool caddy full of nails. Origin = middle of the carry handle (dog bites here).
// Box hangs below: ~96 x 66 px.
// ---------------------------------------------------------------------------
export function nailBox(ctx, o = {}) {
  ctx.save();
  // back rim
  inked(ctx, rr(ctx, -44, 16, 88, 8, 3), WOOD_D, LW * 0.8);
  // nails
  const nails = [[-34, -0.3], [-25, -0.12], [-15, 0.05], [15, -0.05], [25, 0.14], [34, 0.32]];
  nails.forEach(([nx, a], i) => {
    const L = 38 + 8 * hash01(i, 3);
    const x0 = nx, y0 = 30, x1 = nx + Math.sin(a) * L, y1 = y0 - Math.cos(a) * L;
    tube(ctx, () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }, 3, STEEL_D, 1.6, 'butt');
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(a);
    inked(ctx, () => ellipsePath(ctx, 0, 0, 6.5, 2.8), STEEL, 1.8);
    ctx.restore();
  });
  // end posts + dowel handle
  inked(ctx, rr(ctx, -44, -9, 10, 36, 3), WOOD);
  inked(ctx, rr(ctx, 34, -9, 10, 36, 3), WOOD);
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); }, 9, WOOD_L, LW * 0.8);
  // box front
  const box = rr(ctx, -48, 22, 96, 40, 5);
  inked(ctx, box, WOOD);
  clipTo(ctx, box, () => {
    ctx.fillStyle = WOOD_D; ctx.fillRect(-60, 50, 120, 20); ctx.fillRect(34, 20, 20, 50);
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-48, 42); ctx.lineTo(48, 42); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-42, 26, 60, 3);
  });
  box(); strokeInk(ctx);
  text(ctx, 'NAILS', -4, 42, 15, PAL.redDark, { font: FONT.hand, rot: -0.04 });
  // nail-head dots
  for (const x of [-42, 42]) for (const y of [28, 56]) { circlePath(ctx, x, y, 1.8); ctx.fillStyle = INK; ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// weldTorch — grip at origin, neck bends forward (+x) to the nozzle. o: { t, on 0..1, sparks 0..1 }
// TORCH_TIP = flame origin; TORCH_DIR = flame direction (radians).
// ---------------------------------------------------------------------------
export const TORCH_TIP = [64, -100];
export const TORCH_DIR = -0.52;
export function weldTorch(ctx, o = {}) {
  const { t = 0, on = 0, sparks = on } = o;
  ctx.save();
  // hoses
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(-4, 40); ctx.bezierCurveTo(-6, 70, -30, 80, -58, 104); }, 7, PAL.red, LW * 0.7);
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(5, 40); ctx.bezierCurveTo(4, 74, -18, 86, -44, 112); }, 7, '#3a86ff', LW * 0.7);
  // neck
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -58); ctx.quadraticCurveTo(0, -78, 42, -89); }, 8, STEEL, LW * 0.8);
  // nozzle (copper, tapered) along TORCH_DIR
  ctx.save();
  ctx.translate(40, -88); ctx.rotate(TORCH_DIR);
  inked(ctx, () => { ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(24, -4); ctx.lineTo(28, 0); ctx.lineTo(24, 4); ctx.lineTo(-2, 7); ctx.closePath(); }, '#e39a58', LW * 0.8);
  ctx.fillStyle = '#b86b35'; ctx.fillRect(0, 2, 24, 3);
  ctx.restore();
  // handle
  const handle = rr(ctx, -12, -34, 24, 76, 10);
  inked(ctx, handle, '#f6b93b');
  clipTo(ctx, handle, () => {
    ctx.fillStyle = '#d98f26'; ctx.fillRect(4, -40, 12, 90);
    ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 1.8;
    for (let y = -26; y < 40; y += 7) { ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(12, y + 4); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-8, -28, 3, 60);
  });
  handle(); strokeInk(ctx);
  // valve knobs
  inked(ctx, circ(ctx, -16, 30, 7), PAL.red, LW * 0.7);
  inked(ctx, circ(ctx, 16, 30, 7), '#3a86ff', LW * 0.7);
  inked(ctx, rr(ctx, -14, -40, 28, 10, 4), STEEL_D, LW * 0.8);
  // flame + sparks
  const [tx, ty] = TORCH_TIP;
  if (on > 0) {
    const fl = 0.85 + 0.15 * noise1(t * 30, 3);
    glow(ctx, tx, ty, 90 * on, '#bfe6ff', 0.55 * on);
    glow(ctx, tx, ty, 34 * on, '#ffffff', 0.9 * on);
    ctx.save();
    ctx.translate(tx, ty); ctx.rotate(TORCH_DIR);
    ctx.globalAlpha *= on;
    ctx.fillStyle = rgba('#4d9dff', 0.85);
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.quadraticCurveTo(60 * fl, -10, 88 * fl, 0); ctx.quadraticCurveTo(60 * fl, 10, 0, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.quadraticCurveTo(26 * fl, -5, 38 * fl, 0); ctx.quadraticCurveTo(26 * fl, 5, 0, 5.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (sparks > 0 && on > 0) {
    const amt = sparks * (0.5 + 0.5 * pulse(t, 6));
    const fx = tx + Math.cos(TORCH_DIR) * 80, fy = ty + Math.sin(TORCH_DIR) * 80;
    const frame = Math.floor(t * 24);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const sd = frame * 31 + i;
      const a = TORCH_DIR + PI + (hash01(sd, 1) - 0.5) * 3.2;
      const d0 = 8 + 50 * hash01(sd, 2) * amt, len = 10 + 26 * hash01(sd, 3) * amt;
      ctx.strokeStyle = hash01(sd, 4) < 0.5 ? '#fff6c0' : '#ffb347';
      ctx.lineWidth = 2 + 1.5 * hash01(sd, 5);
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * d0, fy + Math.sin(a) * d0 + d0 * 0.15);
      ctx.lineTo(fx + Math.cos(a) * (d0 + len), fy + Math.sin(a) * (d0 + len) + (d0 + len) * 0.25);
      ctx.stroke();
    }
    sparkle(ctx, fx, fy, 22 * (0.7 + 0.5 * amt), '#ffffff', 0.9);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// joystick — origin = pivot at the top of the base (base plate sits below, y 0..30). o: { tilt (radians, + = right) }
// ---------------------------------------------------------------------------
export function joystickGrip(tilt = 0) { return [Math.sin(tilt) * 88, -Math.cos(tilt) * 88]; }
export function joystick(ctx, o = {}) {
  const tilt = clamp(o.tilt || 0, -0.8, 0.8);
  ctx.save();
  const plate = rr(ctx, -56, 6, 112, 26, 10);
  inked(ctx, plate, PAL.greyDark);
  clipTo(ctx, plate, () => { ctx.fillStyle = '#474e5e'; ctx.fillRect(-60, 22, 120, 12); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-48, 10, 70, 3); });
  plate(); strokeInk(ctx);
  for (const x of [-44, 44]) { inked(ctx, circ(ctx, x, 19, 4), STEEL, DW * 0.8); }
  // rubber boot (leans with the stick)
  ctx.save();
  ctx.translate(0, 8);
  ctx.transform(1, 0, Math.sin(tilt) * -0.5, 1, 0, 0);
  const boot = () => { ctx.beginPath(); ctx.moveTo(-34, 0); ctx.bezierCurveTo(-32, -26, -12, -30, 0, -30); ctx.bezierCurveTo(12, -30, 32, -26, 34, 0); ctx.closePath(); };
  inked(ctx, boot, '#2d2a38');
  ctx.strokeStyle = rgba('#ffffff', 0.18); ctx.lineWidth = 2;
  for (const k of [0.35, 0.65]) { ctx.beginPath(); ctx.ellipse(0, -30 * k + 4, 34 * (1 - k * 0.6), 5, 0, 0, PI); ctx.stroke(); }
  ctx.restore();
  // stick + grip
  ctx.save();
  ctx.translate(0, -12);
  ctx.rotate(tilt);
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -58); }, 10, STEEL, LW * 0.8);
  const grip = () => {
    ctx.beginPath();
    ctx.moveTo(-14, -56);
    ctx.bezierCurveTo(-18, -80, -18, -104, -10, -114);
    ctx.quadraticCurveTo(0, -120, 12, -114);
    ctx.bezierCurveTo(18, -104, 17, -80, 14, -56);
    ctx.closePath();
  };
  inked(ctx, grip, '#2d2a38');
  clipTo(ctx, grip, () => {
    ctx.fillStyle = '#1f1c26'; ctx.fillRect(5, -130, 20, 80);
    ctx.strokeStyle = rgba('#ffffff', 0.2); ctx.lineWidth = 2;
    for (const y of [-68, -78, -88]) { ctx.beginPath(); ctx.moveTo(-18, y); ctx.lineTo(4, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-12, -106, 3, 44);
  });
  grip(); strokeInk(ctx);
  // trigger + top button
  inked(ctx, () => { ctx.beginPath(); ctx.moveTo(14, -92); ctx.quadraticCurveTo(24, -88, 18, -76); ctx.lineTo(14, -78); ctx.closePath(); }, PAL.red, LW * 0.6);
  inked(ctx, () => ellipsePath(ctx, 0, -116, 9, 5), PAL.red, LW * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ellipsePath(ctx, -3, -117.5, 3, 1.4); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// redButton — the big launch button on its housing (3/4 top view). Origin = centre of the housing top.
// o: { pressed 0..1, label (text on the plate, '' for none) }   ~ 120 x 80 px
// ---------------------------------------------------------------------------
export function redButton(ctx, o = {}) {
  const p = clamp(o.pressed || 0);
  const label = o.label ?? 'LAUNCH';
  ctx.save();
  // housing cylinder
  const side = () => { ctx.beginPath(); ctx.ellipse(0, 0, 58, 21, 0, PI, TAU); ctx.lineTo(58, 22); ctx.ellipse(0, 22, 58, 21, 0, 0, PI); ctx.closePath(); };
  inked(ctx, side, '#3d4252');
  clipTo(ctx, side, () => { ctx.fillStyle = '#2d313d'; ctx.fillRect(20, -30, 50, 80); });
  side(); strokeInk(ctx);
  // hazard ring on top
  const ring = () => { ctx.beginPath(); ctx.ellipse(0, 0, 58, 21, 0, 0, TAU); };
  inked(ctx, ring, PAL.yellow);
  clipTo(ctx, ring, () => {
    ctx.fillStyle = INK;
    for (let a = 0; a < 16; a++) {
      const a0 = (a / 16) * TAU, a1 = a0 + TAU / 32;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a0) * 80, Math.sin(a0) * 30); ctx.lineTo(Math.cos(a1) * 80, Math.sin(a1) * 30); ctx.closePath(); ctx.fill();
    }
  });
  ring(); strokeInk(ctx);
  inked(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, 44, 15.5, 0, 0, TAU); }, '#2d313d', LW * 0.8);
  // cap cylinder
  const h = lerp(24, 5, p);
  const capSide = () => { ctx.beginPath(); ctx.ellipse(0, 0, 36, 12.5, 0, 0, PI); ctx.lineTo(-36, -h); ctx.ellipse(0, -h, 36, 12.5, 0, PI, 0, true); ctx.closePath(); };
  inked(ctx, capSide, PAL.redDark);
  clipTo(ctx, capSide, () => { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-30, -h - 20, 7, h + 30); ctx.fillStyle = rgba(INK, 0.25); ctx.fillRect(14, -h - 20, 30, h + 40); });
  capSide(); strokeInk(ctx);
  const top = () => { ctx.beginPath(); ctx.ellipse(0, -h, 36, 12.5, 0, 0, TAU); };
  inked(ctx, top, p > 0.5 ? '#d63a33' : PAL.red);
  clipTo(ctx, top, () => { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-8, -h - 4, 22, 6, -0.1, 0, TAU); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ellipsePath(ctx, -14, -h - 5, 8, 2.8, -0.15); ctx.fill();
  if (p > 0.6) {
    const k = (p - 0.6) / 0.4;
    ctx.strokeStyle = rgba('#ffffff', 1 - k * 0.4); ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = PI + (i / 6) * PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (66 + 6 * k), -h * 0.3 + Math.sin(a) * (30 + 6 * k));
      ctx.lineTo(Math.cos(a) * (80 + 14 * k), -h * 0.3 + Math.sin(a) * (40 + 12 * k));
      ctx.stroke();
    }
  }
  if (label) {
    const plate = rr(ctx, -34, 32, 68, 18, 4);
    inked(ctx, plate, PAL.white, LW * 0.6);
    text(ctx, label, 0, 41.5, 12, INK, { font: FONT.round, maxW: 60 });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// starSticker — shiny gold star sticker with a white die-cut border, centred. ~84 px across. o: { rot, peel 0..1 }
// ---------------------------------------------------------------------------
function roundStar(ctx, R, ratio = 0.5, tipR = 0.14, valR = 0.12, ox = 0, oy = 0) {
  const V = [];
  for (let i = 0; i < 10; i++) {
    const a = -PI / 2 + (i * PI) / 5, r = i % 2 ? R * ratio : R;
    V.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]);
  }
  ctx.beginPath();
  ctx.moveTo((V[9][0] + V[0][0]) / 2, (V[9][1] + V[0][1]) / 2);
  for (let i = 0; i < 10; i++) {
    const v = V[i], n = V[(i + 1) % 10];
    ctx.arcTo(v[0], v[1], (v[0] + n[0]) / 2, (v[1] + n[1]) / 2, R * (i % 2 ? valR : tipR));
  }
  ctx.closePath();
}
export function starSticker(ctx, o = {}) {
  const { rot = 0, peel = 0 } = o;
  ctx.save();
  ctx.rotate(rot);
  roundStar(ctx, 44, 0.54, 0.2, 0.3); ctx.fillStyle = '#ffffff'; ctx.fill(); strokeInk(ctx, LW * 0.8);
  const star = () => roundStar(ctx, 34, 0.5, 0.12, 0.1);
  star(); ctx.fillStyle = PAL.yellow; ctx.fill();
  clipTo(ctx, star, () => {
    ctx.fillStyle = '#f5a524';
    ctx.beginPath(); ctx.rect(-50, -50, 100, 100); roundStar(ctx, 34, 0.5, 0.12, 0.1, -4, -5); ctx.fill('evenodd');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(-22, -40); ctx.lineTo(-11, -40); ctx.lineTo(-31, 20); ctx.lineTo(-42, 20); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, -40); ctx.lineTo(-1, -40); ctx.lineTo(-21, 20); ctx.lineTo(-25, 20); ctx.fill();
  });
  star(); strokeInk(ctx, DW * 0.7, '#c9861d');
  if (peel > 0) {
    // lower-right point lifting off, showing the white backing
    const k = clamp(peel);
    const a = PI / 2 - (2 * PI) / 5;
    const tx = Math.cos(a) * 44, ty = Math.sin(a) * 44;
    const bx = Math.cos(a) * 26, by = Math.sin(a) * 26;
    const nx = -Math.sin(a) * 13, ny = Math.cos(a) * 13;
    ctx.beginPath();
    ctx.moveTo(bx + nx, by + ny);
    ctx.quadraticCurveTo(tx + 6 * k, ty - 26 * k, bx - nx * 0.2 + 22 * k * 0.2, by - ny - 4 * k);
    ctx.lineTo(bx - nx, by - ny);
    ctx.closePath();
    ctx.fillStyle = '#eef0f5'; ctx.fill(); strokeInk(ctx, DW);
  }
  sparkle(ctx, 20, -20, 9, '#ffffff', 0.95);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// trafficCone — origin = centre of the BASE (bottom), cone points to -y (so it can sit on a head). ~80 x 92 px.
// o: { charred 0..1 (soot, scorch, bent tip), t, smoke 0..1 (curl of smoke from the tip) }
// ---------------------------------------------------------------------------
export function trafficCone(ctx, o = {}) {
  const { charred = 0, t = 0, smoke = 0 } = o;
  const c = clamp(charred);
  const tipX = 9 * c, tipY = -86 + 5 * c;
  ctx.save();
  const base = rr(ctx, -40, -13, 80, 13, 5);
  const cone = () => {
    ctx.beginPath();
    ctx.moveTo(-29, -12);
    ctx.lineTo(tipX - 7, tipY + 3);
    ctx.quadraticCurveTo(tipX, tipY - 5, tipX + 7, tipY + 3);
    ctx.lineTo(29, -12);
    ctx.closePath();
  };
  union(ctx, [base, cone], '#ff7a2a');
  clipTo(ctx, base, () => { ctx.fillStyle = '#d9541e'; ctx.fillRect(-50, -20, 100, 30); ctx.fillStyle = '#ff9a55'; ctx.fillRect(-36, -12, 60, 3); });
  clipTo(ctx, cone, () => {
    const lerpX = (y, side) => { const u = (y + 12) / (tipY + 12); return lerp(29 * side, tipX + 7 * side, u); };
    // bands
    ctx.fillStyle = mixColor('#fffaf0', '#6b6470', c * 0.7);
    ctx.beginPath(); ctx.moveTo(lerpX(-58, -1) - 5, -58); ctx.lineTo(lerpX(-58, 1) + 5, -58); ctx.lineTo(lerpX(-43, 1) + 5, -43); ctx.lineTo(lerpX(-43, -1) - 5, -43); ctx.fill();
    ctx.beginPath(); ctx.moveTo(lerpX(-30, -1) - 5, -30); ctx.lineTo(lerpX(-30, 1) + 5, -30); ctx.lineTo(lerpX(-25, 1) + 5, -25); ctx.lineTo(lerpX(-25, -1) - 5, -25); ctx.fill();
    // shade right side
    ctx.fillStyle = rgba('#b83f12', 0.55);
    ctx.beginPath(); ctx.moveTo(12, -12); ctx.lineTo(tipX + 2, tipY); ctx.lineTo(tipX + 20, tipY); ctx.lineTo(40, -12); ctx.closePath(); ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(-19, -16); ctx.lineTo(tipX - 5, tipY + 8); ctx.lineTo(tipX - 2, tipY + 8); ctx.lineTo(-13, -16); ctx.closePath(); ctx.fill();
    if (c > 0) {
      const g = ctx.createLinearGradient(0, tipY, 0, -10);
      g.addColorStop(0, rgba('#2b2733', 0.95 * c)); g.addColorStop(0.55, rgba('#2b2733', 0.55 * c)); g.addColorStop(1, rgba('#2b2733', 0.15 * c));
      ctx.fillStyle = g; ctx.fillRect(-40, tipY - 10, 80, 90);
      // soot streaks running down from the scorched tip
      ctx.fillStyle = rgba('#2b2733', 0.55 * c);
      for (let i = 0; i < 4; i++) {
        const sx = -14 + i * 9 + tipX * 0.5, len = 26 + 22 * hash01(i, 5);
        ctx.beginPath();
        ctx.moveTo(sx - 4, tipY + 12); ctx.quadraticCurveTo(sx - 3, tipY + 12 + len * 0.7, sx, tipY + 12 + len);
        ctx.quadraticCurveTo(sx + 3, tipY + 12 + len * 0.7, sx + 4, tipY + 12); ctx.closePath(); ctx.fill();
      }
    }
  });
  if (c > 0) clipTo(ctx, base, () => { ctx.fillStyle = rgba('#2b2733', 0.4 * c); ctx.fillRect(-50, -20, 100, 30); });
  if (c > 0.3) {
    // crumple dent
    ctx.beginPath(); ctx.moveTo(tipX - 8, tipY + 20); ctx.lineTo(tipX - 3, tipY + 16); ctx.lineTo(tipX + 1, tipY + 21); ctx.lineTo(tipX + 7, tipY + 17);
    strokeInk(ctx, DW * 0.7);
  }
  if (smoke > 0) {
    const b = beatAt(t);
    ctx.save();
    ctx.globalAlpha *= smoke * 0.8;
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const px = tipX + Math.sin(u * 5 + b * PI + k * 2) * 8 * u + k * 6, py = tipY - 6 - u * 60;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.strokeStyle = rgba('#8d8499', 0.7 - k * 0.3); ctx.lineWidth = 6 - k * 2; ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// sunglasses — sized for Biscuit (~124 px wide). Origin = bridge centre.
// ---------------------------------------------------------------------------
export function sunglasses(ctx, o = {}) {
  ctx.save();
  const lens = (cx) => () => {
    ctx.beginPath();
    ctx.moveTo(cx - 27, -14);
    ctx.lineTo(cx + 27, -14);
    ctx.quadraticCurveTo(cx + 29, 6, cx + 16, 16);
    ctx.quadraticCurveTo(cx, 22, cx - 16, 16);
    ctx.quadraticCurveTo(cx - 29, 6, cx - 27, -14);
    ctx.closePath();
  };
  const L = lens(-32), R = lens(32);
  // temples
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(-58, -10); ctx.lineTo(-66, -14); }, 5, '#2d2a38', LW * 0.6);
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(58, -10); ctx.lineTo(66, -14); }, 5, '#2d2a38', LW * 0.6);
  // frame (thick) = lenses stroked wide in dark
  ctx.save();
  ctx.lineJoin = 'round';
  for (const f of [L, R]) { f(); ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.stroke(); }
  for (const f of [L, R]) { f(); ctx.strokeStyle = '#2d2a38'; ctx.lineWidth = 8; ctx.stroke(); }
  ctx.restore();
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(-6, -11); ctx.quadraticCurveTo(0, -16, 6, -11); }, 6, '#2d2a38', LW * 0.6);
  for (const [f, cx] of [[L, -32], [R, 32]]) {
    const g = ctx.createLinearGradient(cx, -14, cx, 20);
    g.addColorStop(0, '#433478'); g.addColorStop(0.6, '#241f3d'); g.addColorStop(1, '#5b2f6b');
    f(); ctx.fillStyle = g; ctx.fill();
    clipTo(ctx, f, () => {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(cx - 14, -14); ctx.lineTo(cx - 6, -14); ctx.lineTo(cx - 22, 18); ctx.lineTo(cx - 30, 18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.moveTo(cx + 2, -14); ctx.lineTo(cx + 6, -14); ctx.lineTo(cx - 10, 18); ctx.lineTo(cx - 14, 18); ctx.fill();
    });
  }
  // top bar highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-54, -16.5); ctx.lineTo(-12, -16.5); ctx.moveTo(12, -16.5); ctx.lineTo(54, -16.5); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// stepladder — wooden A-frame stepladder in a slight 3/4 view (back legs splay out behind to the right).
// Grip-free: origin = centre of the base on the ground; the standing surface (front edge of the top cap) is at
// y = -h. o: { h (default 170: Juno stands ~40% of her height up), color (rail wood), splat 0..1 (paint dabs, default 1),
//              paint (splat colour, default PAL.red) }
// ---------------------------------------------------------------------------
export function stepladder(ctx, o = {}) {
  const { h = 170, color = WOOD, splat = 1, paint = PAL.red } = o;
  const dark = mixColor(color, INK, 0.28), light = mixColor(color, '#ffffff', 0.35);
  const topY = -h, capW = 50, railT = 13;
  const xTop = 38, xBot = 58; // front rails: centre-line x at the top / at the ground
  const railX = (y, side) => side * lerp(xBot, xTop, -y / h); // centre-line x of a front rail at height y
  const quad = (pts) => () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  // a rail as a quad between two centre-line points, width w
  const railPath = (x0, y0, x1, y1, w) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2;
    return quad([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]);
  };
  ctx.save();
  // back frame (further away: a little higher at the feet, shifted right, darker)
  // (3/4 view from the front-left: the back-left leg hides behind the front-left rail, the back-right one splays out)
  inked(ctx, railPath(-xTop + 8, topY + 14, -xBot + 12, -6, railT - 2), dark, LW * 0.8);
  inked(ctx, railPath(xTop + 4, topY + 14, xBot + 30, -7, railT - 2), dark, LW * 0.8);
  // steel spreader bar from the front-right rail to the back-right rail
  tube(ctx, () => { ctx.beginPath(); ctx.moveTo(railX(-h * 0.6, 1) + 4, -h * 0.6); ctx.lineTo(railX(-h * 0.6, 1) + 24, -h * 0.62); }, 3.5, STEEL_D, LW * 0.45);
  // front rails
  for (const side of [-1, 1]) {
    const r = railPath(railX(topY + 6, side), topY + 6, railX(0, side), 0, railT);
    inked(ctx, r, color);
    clipTo(ctx, r, () => {
      ctx.fillStyle = dark; // shade on the right edge of each rail
      ctx.beginPath(); ctx.moveTo(railX(topY, side) + 1.5, topY); ctx.lineTo(railX(0, side) + 1.5, 0); ctx.lineTo(railX(0, side) + 20, 0); ctx.lineTo(railX(topY, side) + 20, topY); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(railX(topY, side) - 4.5, topY); ctx.lineTo(railX(0, side) - 4.5, 0); ctx.lineTo(railX(0, side) - 2.5, 0); ctx.lineTo(railX(topY, side) - 2.5, topY); ctx.fill();
    });
    r(); strokeInk(ctx);
    // rubber foot
    inked(ctx, rr(ctx, railX(0, side) - 9, -6, 18, 7, 3), '#3d4252', LW * 0.6);
  }
  // steps: plank front + a sliver of top face
  const steps = [0.25, 0.5, 0.75];
  for (const f of steps) {
    const y = -h * f, xl = railX(y, -1) + railT / 2 - 2, xr = railX(y, 1) - railT / 2 + 2;
    const top = quad([[xl, y - 9], [xr, y - 9], [xr + 4, y - 14], [xl + 4, y - 14]]);
    inked(ctx, top, light, LW * 0.7);
    const plank = rr(ctx, xl, y - 9, xr - xl, 11, 2);
    inked(ctx, plank, color, LW * 0.8);
    clipTo(ctx, plank, () => { ctx.fillStyle = dark; ctx.fillRect(xl, y - 2, xr - xl, 6); });
    plank(); strokeInk(ctx, LW * 0.8);
  }
  // top cap (standing surface): top face + thick front face
  const capTop = quad([[-capW, topY], [capW, topY], [capW + 12, topY - 9], [-capW + 12, topY - 9]]);
  inked(ctx, capTop, light, LW * 0.8);
  const capFront = rr(ctx, -capW, topY, capW * 2, 15, 3);
  inked(ctx, capFront, color);
  clipTo(ctx, capFront, () => { ctx.fillStyle = dark; ctx.fillRect(-capW, topY + 9, capW * 2, 8); ctx.fillRect(capW - 12, topY, 14, 16); });
  capFront(); strokeInk(ctx);
  inked(ctx, circ(ctx, -capW + 11, topY + 7, 2.2), STEEL_D, 0);
  inked(ctx, circ(ctx, capW - 11, topY + 7, 2.2), STEEL_D, 0);
  // paint dabs & drips (it's a painter's ladder)
  if (splat > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp(splat);
    const dab = (x, y, s, col, seed) => {
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, k = i % 2 ? 0.55 + 0.25 * hash01(i, seed) : 1;
        const px = x + Math.cos(a) * s * k, py = y + Math.sin(a) * s * k * 0.55;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    };
    dab(-16, topY - 4, 10, paint, 3); dab(24, topY - 5, 5.5, '#2ec4b6', 5);
    dab(12, -h * 0.5 - 11, 7, paint, 7); dab(-22, -h * 0.25 - 11, 5.5, PAL.yellow, 9); dab(-8, -h * 0.75 - 11, 5, paint, 11);
    // drip down the left rail
    const dx = railX(-h * 0.62, -1);
    ctx.beginPath(); ctx.moveTo(dx - 3, -h * 0.66); ctx.lineTo(dx - 3, -h * 0.55); ctx.arc(dx, -h * 0.55, 3, PI, 0, true); ctx.lineTo(dx + 3, -h * 0.66); ctx.closePath();
    ctx.fillStyle = paint; ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// paintCan — steel paint tin, open, 3/4 view. Origin = centre of the base on the ground. ~56 x 58 px (+ handle).
// o: { color (paint, default PAL.red), tipped 0..1 (rolls over onto its right side about the bottom-right edge;
//      from ~.5 a puddle spreads out of the mouth), splash 0..1 (a crown splash + flying drops out of the mouth, for
//      the paw going in), t }
// ---------------------------------------------------------------------------
export function paintCan(ctx, o = {}) {
  const { color = PAL.red, tipped = 0, splash = 0 } = o;
  const RX = 28, RY = 9, CH = 58;
  const dark = mixColor(color, INK, 0.3), light = mixColor(color, '#ffffff', 0.45);
  const tip = clamp(tipped);
  ctx.save();
  // puddle (ground frame, not rotated) — spreads from the mouth once the can is down
  const pud = clamp((tip - 0.55) / 0.45);
  if (pud > 0) {
    const pe = ease.outCubic(pud);
    const px = RX + CH * 0.9 + 18 * pe, pw = 20 + 62 * pe, ph = 5 + 9 * pe;
    const puddle = () => {
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU, k = 0.85 + 0.25 * hash01(i, 41);
        const x = px + Math.cos(a) * pw * k, y = -2 + Math.sin(a) * ph * k;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    inked(ctx, puddle, color, LW * 0.7);
    ctx.fillStyle = rgba('#ffffff', 0.55); ellipsePath(ctx, px - pw * 0.3, -2 - ph * 0.3, pw * 0.25, ph * 0.22, -0.1); ctx.fill();
  }
  // roll over the bottom-right edge
  const ang = ease.inOutQuad(tip) * (PI / 2) * 0.98;
  ctx.translate(RX, 0);
  ctx.rotate(ang);
  ctx.translate(-RX, 0);
  // bail handle (behind, leaning back over the mouth)
  ctx.beginPath(); ctx.ellipse(0, -CH + 14, RX + 2, 34, 0, PI * 1.06, PI * 1.94);
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5 + LW * 0.7; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = STEEL_D; ctx.lineWidth = 3.5; ctx.stroke();
  // body (cylinder: side + front halves of the top/bottom ellipses)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-RX, -CH); ctx.lineTo(-RX, 0);
    ctx.ellipse(0, 0, RX, RY, 0, PI, 0, true);
    ctx.lineTo(RX, -CH);
    ctx.ellipse(0, -CH, RX, RY, 0, 0, PI, false);
    ctx.closePath();
  };
  inked(ctx, body, STEEL);
  clipTo(ctx, body, () => {
    ctx.fillStyle = STEEL_D; ctx.fillRect(RX - 13, -CH - 20, 20, CH + 40);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-RX + 6, -CH, 5, CH + 12);
    // label band (curves with the can)
    const y1 = -CH * 0.72, y2 = -CH * 0.26;
    ctx.beginPath(); ctx.moveTo(-RX, y1); ctx.ellipse(0, y1, RX, RY, 0, PI, 0, true); ctx.lineTo(RX, y2); ctx.ellipse(0, y2, RX, RY, 0, 0, PI, false); ctx.closePath();
    ctx.fillStyle = PAL.cream; ctx.fill();
    ctx.fillStyle = rgba(INK, 0.12); ctx.fillRect(RX - 13, -CH, 20, CH);
    ctx.beginPath(); ctx.moveTo(-RX, y1); ctx.ellipse(0, y1, RX, RY, 0, PI, 0, true); strokeInk(ctx, DW * 0.6);
    ctx.beginPath(); ctx.moveTo(-RX, y2); ctx.ellipse(0, y2, RX, RY, 0, PI, 0, true); strokeInk(ctx, DW * 0.6);
    // paint-splat logo on the label
    const lx = -4, ly = (y1 + y2) / 2 + RY * 0.8;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, k = i % 2 ? 0.6 : 1; const px = lx + Math.cos(a) * 12 * k, py = ly + Math.sin(a) * 9 * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  });
  body(); strokeInk(ctx);
  // paint lip spilling over the front rim + drips hanging from it (one clean union outline)
  {
    const lip = () => { ctx.beginPath(); ctx.ellipse(0, -CH + 1.5, RX - 0.5, RY, 0, PI * 0.96, PI * 0.04, true); };
    const drips = [[-15, 12], [-2, 22], [15, 15]].map(([dx, len]) => {
      const y0 = -CH + 1.5 + RY * Math.sqrt(Math.max(0, 1 - (dx / RX) ** 2));
      return [dx, y0, y0 + len];
    });
    const dripPath = ([dx, y0, y1]) => () => { ctx.beginPath(); ctx.moveTo(dx, y0 - 2); ctx.lineTo(dx, y1); };
    const blobPath = ([dx, , y1]) => () => { ctx.beginPath(); ctx.moveTo(dx, y1 + 0.5); ctx.lineTo(dx, y1 + 1); };
    const all = [[lip, 7], ...drips.map((d) => [dripPath(d), 5.5]), ...drips.map((d) => [blobPath(d), 8.5])];
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [b, w] of all) { b(); ctx.strokeStyle = INK; ctx.lineWidth = w + LW * 0.62; ctx.stroke(); }
    for (const [b, w] of all) { b(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (const [dx, , y1] of drips) { ellipsePath(ctx, dx - 1.3, y1 - 0.5, 1.1, 1.9); ctx.fill(); }
    ctx.restore();
  }
  // mouth: rim + paint surface
  inked(ctx, () => ellipsePath(ctx, 0, -CH, RX, RY), STEEL_D, LW * 0.8);
  inked(ctx, () => ellipsePath(ctx, 0, -CH + 1, RX - 4.5, RY - 2.8), color, DW * 0.7);
  ctx.fillStyle = rgba(light, 0.9); ellipsePath(ctx, -8, -CH - 0.5, 7, 2, -0.05); ctx.fill();
  // handle ears
  for (const sx of [-1, 1]) inked(ctx, circ(ctx, sx * (RX - 1), -CH + 14, 4), STEEL_D, LW * 0.5);
  // splash out of the mouth (in the can's frame, so a tipped can splashes sideways)
  const sp = clamp(splash);
  if (sp > 0 && sp < 1) {
    const crownH = 34 * Math.sin(PI * Math.min(1, sp * 1.5)) * (1 - sp * 0.3);
    const fade = 1 - clamp((sp - 0.75) / 0.25);
    ctx.save();
    ctx.globalAlpha *= fade;
    if (crownH > 1) {
      const n = 4, span = 2 * RX - 6;
      const tips = [];
      const crown = () => {
        ctx.beginPath();
        ctx.moveTo(-RX + 3, -CH);
        for (let i = 0; i < n; i++) {
          const xa = -RX + 3 + (i / n) * span, xb = -RX + 3 + ((i + 1) / n) * span, xm = (xa + xb) / 2;
          const lean = (xm / RX) * 10, hk = (0.75 + 0.4 * hash01(i, 13)) * crownH, tr = 3.4;
          const tx = xm + lean, ty = -CH - hk;
          tips.push([tx, ty, hk]);
          ctx.quadraticCurveTo(xa + 5, -CH - hk * 0.45, tx - tr, ty + tr);
          ctx.arc(tx, ty + tr, tr, PI, 0);
          ctx.quadraticCurveTo(xb - 5, -CH - hk * 0.45, xb, -CH - 1);
        }
        ctx.ellipse(0, -CH, RX - 3, RY - 2, 0, 0, PI, false);
        ctx.closePath();
      };
      inked(ctx, crown, color, LW * 0.5);
      ctx.fillStyle = rgba(light, 0.85);
      ellipsePath(ctx, -RX * 0.4, -CH - crownH * 0.3, 2.6, crownH * 0.16, -0.25); ctx.fill();
      // a droplet pinching off above each tip
      for (const [tx, ty, hk] of tips) {
        const dy = ty - 7 - hk * 0.3 * sp;
        inked(ctx, circ(ctx, tx + (tx / RX) * 4, dy, 4), color, LW * 0.45);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; circlePath(ctx, tx + (tx / RX) * 4 - 1.3, dy - 1.3, 1.2); ctx.fill();
      }
    }
    // flying drops
    for (let i = 0; i < 7; i++) {
      const a = -PI / 2 + (i - 3) * 0.36 + (hash01(i, 21) - 0.5) * 0.2;
      const v = 150 + 70 * hash01(i, 22), u = clamp(sp * 1.15 - 0.08 * hash01(i, 23));
      const x = Math.cos(a) * v * u, y = -CH + Math.sin(a) * v * u + 190 * u * u;
      const s = (4.5 + 3.5 * hash01(i, 24)) * (1 - u * 0.4);
      if (u <= 0) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(Math.sin(a) * v + 380 * u, Math.cos(a) * v) + PI / 2);
      const drop = () => { ctx.beginPath(); ctx.moveTo(0, s * 1.9); ctx.quadraticCurveTo(s * 0.9, s * 0.3, s, 0); ctx.arc(0, 0, s, 0, PI, true); ctx.quadraticCurveTo(-s * 0.9, s * 0.3, 0, s * 1.9); ctx.closePath(); };
      inked(ctx, drop, color, LW * 0.45);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; circlePath(ctx, -s * 0.3, -s * 0.3, s * 0.28); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// kibble — one piece of dog kibble, centred. o: { r (radius, default 14), seed (shape & tint: mostly lumpy balls,
// sometimes a mini bone or a rounded triangle), rot }. Outline is LW/2 at s = 1.
// ---------------------------------------------------------------------------
export function kibble(ctx, o = {}) {
  const { r = 14, seed = 1, rot = 0 } = o;
  const kind = [0, 0, 0, 1, 2][Math.floor(hash01(seed, 5) * 5)];
  const tint = hash01(seed, 6);
  const base = tint < 0.6 ? '#c17f41' : tint < 0.85 ? '#a8672f' : '#c96c40';
  const shadeC = mixColor(base, INK, 0.34), lit = mixColor(base, '#ffffff', 0.4);
  const lw = LW * 0.5;
  const spin = rot + hash01(seed, 7) * TAU;
  // the shape as one path of same-direction sub-paths (nonzero fill = their union)
  let path;
  if (kind === 0) { // lumpy ball
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, k = 0.88 + 0.16 * hash01(i, seed * 3 + 1);
      pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k * 0.92]);
    }
    path = () => smoothPath(ctx, pts, true);
  } else if (kind === 1) { // mini bone
    const s = r / 13;
    path = () => {
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-11 * s, -4.5 * s, 22 * s, 9 * s, 4.5 * s) : ctx.rect(-11 * s, -4.5 * s, 22 * s, 9 * s);
      for (const [x, y] of [[-12, -5], [-12, 5], [12, -5], [12, 5]]) { ctx.moveTo(x * s + 6 * s, y * s); ctx.arc(x * s, y * s, 6 * s, 0, TAU); }
    };
  } else { // rounded triangle
    const V = [0, 1, 2].map((i) => [Math.cos(-PI / 2 + (i * TAU) / 3) * r * 1.35, Math.sin(-PI / 2 + (i * TAU) / 3) * r * 1.35 + r * 0.2]);
    path = () => {
      ctx.beginPath();
      ctx.moveTo((V[2][0] + V[0][0]) / 2, (V[2][1] + V[0][1]) / 2);
      for (let i = 0; i < 3; i++) { const v = V[i], n = V[(i + 1) % 3]; ctx.arcTo(v[0], v[1], (v[0] + n[0]) / 2, (v[1] + n[1]) / 2, r * 0.42); }
      ctx.closePath();
    };
  }
  ctx.save();
  ctx.rotate(spin);
  ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 2; ctx.stroke(); // outer ink (inner half gets covered)
  path(); ctx.fillStyle = shadeC; ctx.fill();
  clipTo(ctx, path, () => {
    // lit face = the shape nudged toward the light (screen upper-left, so undo the spin)
    ctx.save();
    const a = -spin + PI * 1.25;
    ctx.translate(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    path(); ctx.fillStyle = base; ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba(shadeC, 0.8);
    for (let i = 0; i < 4; i++) { circlePath(ctx, (hash01(i, seed + 11) - 0.5) * r * 1.1, (hash01(i, seed + 12) - 0.5) * r * 0.9, r * 0.08); ctx.fill(); }
    if (kind === 0) { ctx.fillStyle = rgba(shadeC, 0.7); ellipsePath(ctx, r * 0.12, r * 0.12, r * 0.24, r * 0.17, 0.4); ctx.fill(); }
  });
  ctx.restore();
  // highlight (screen space: upper-left)
  ctx.save();
  ctx.fillStyle = rgba(lit, 0.95);
  ellipsePath(ctx, -r * 0.34, -r * 0.36, r * 0.19, r * 0.1, -0.7); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// fireworkRocket — small stick (bottle) rocket. Origin = bottom of the stick (it stands on the ground / sits in a
// bottle); the body rides on the stick's left side with its nozzle at FIREWORK_NOZZLE, so the flame is not hidden.
// o: { t, lit 0..1 (0 = unlit; 0..0.3 the fuse fizzes and burns down; 0.3..1 ignition: flame + a wiggly whistling
//      spark trail that grows toward o.trail px below the nozzle), trail (px, default 260), color (body, PAL.red) }
// Rotate the whole thing to fly it along a path (the trail follows the local +y axis).
// ---------------------------------------------------------------------------
export const FIREWORK_NOZZLE = [-13, -92];
export function fireworkRocket(ctx, o = {}) {
  const { t = 0, lit = 0, trail = 260, color = PAL.red } = o;
  const b = beatAt(t);
  const [nx, ny] = FIREWORK_NOZZLE;
  const BW = 22, BH = 54, top = ny - BH;
  ctx.save();
  // ---- spark trail + flame (behind everything)
  const ign = clamp((lit - 0.3) / 0.7);
  if (ign > 0) {
    const L = trail * ease.outCubic(ign);
    const wig = (y) => nx + Math.sin((y - ny) * 0.045 - t * 22) * Math.min(1, (y - ny) / 80) * 9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // a glowing trail (orange at low alpha would muddy to brown over the night sky)
    const g = ctx.createLinearGradient(0, ny, 0, ny + L);
    g.addColorStop(0, rgba('#fff2b8', 0.9)); g.addColorStop(0.3, rgba('#ffb54a', 0.55)); g.addColorStop(1, rgba('#ff6a3d', 0));
    ctx.beginPath();
    const N = 18;
    for (let i = 0; i <= N; i++) { const y = ny + (L * i) / N, w = 6.5 * (1 - i / N) + 1.5; ctx.lineTo(wig(y) - w, y); }
    for (let i = N; i >= 0; i--) { const y = ny + (L * i) / N, w = 6.5 * (1 - i / N) + 1.5; ctx.lineTo(wig(y) + w, y); }
    ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    glow(ctx, nx, ny + 10, 50, '#ffc861', 0.7 * ign);
    ctx.restore();
    // sparkles streaming back along the trail (jitter re-seeded 24x a second)
    const frame = Math.floor(t * 24);
    for (let i = 0; i < 20; i++) {
      const u = fract(hash01(i, 71) + t * 2.2);
      const y = ny + u * L, x = wig(y) + (hash01(i + frame * 17, 72) - 0.5) * 26 * u;
      const sz = (4 + 7 * hash01(i, 73)) * (1 - u) + 1.5;
      sparkle(ctx, x, y, sz, i % 3 ? '#fff6c0' : '#ffffff', 1 - u * 0.9);
    }
    // flame
    const fl = 0.8 + 0.2 * noise1(t * 30, 5);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.moveTo(nx - 7, ny); ctx.quadraticCurveTo(nx - 6, ny + 18 * fl, nx, ny + 32 * fl); ctx.quadraticCurveTo(nx + 6, ny + 18 * fl, nx + 7, ny); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath(); ctx.moveTo(nx - 3.5, ny); ctx.quadraticCurveTo(nx - 3, ny + 9 * fl, nx, ny + 17 * fl); ctx.quadraticCurveTo(nx + 3, ny + 9 * fl, nx + 3.5, ny); ctx.closePath(); ctx.fill();
    // whistle: little sound arcs puffing off twice a beat
    const wp = fract(b * 2);
    ctx.save();
    ctx.globalAlpha *= (1 - wp) * ign;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.arc(nx + sx * (18 + wp * 14), ny + 16, 7 + wp * 6, sx > 0 ? -0.9 : PI - 0.9, sx > 0 ? 0.9 : PI + 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }
  // ---- stick (behind the body, running down from its upper right side to the origin)
  const stick = rr(ctx, -2, top + 12, 6, -top - 12, 3);
  inked(ctx, stick, WOOD, LW * 0.6);
  clipTo(ctx, stick, () => { ctx.fillStyle = WOOD_D; ctx.fillRect(1.5, top, 4, -top); });
  stick(); strokeInk(ctx, LW * 0.6);
  // ---- fuse (unlit / fizzing), out of the nozzle
  const fuseLeft = lit < 0.3 ? 1 - lit / 0.3 : 0;
  if (fuseLeft > 0) {
    const fx = (u) => nx - 3 - 9 * u, fy = (u) => ny + 2 + 13 * u - 4 * u * u;
    ctx.beginPath(); ctx.moveTo(fx(0), fy(0));
    for (let i = 1; i <= 8; i++) { const u = (i / 8) * fuseLeft; ctx.lineTo(fx(u), fy(u)); }
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.strokeStyle = '#6b8f3a'; ctx.lineWidth = 2; ctx.stroke();
    if (lit > 0) {
      const ex = fx(fuseLeft), ey = fy(fuseLeft), fz = 0.8 + 0.4 * noise1(t * 40, 9);
      glow(ctx, ex, ey, 20, '#ffcf6b', 0.9);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(t * 9);
      sparkle(ctx, 0, 0, 9 * fz, '#fff6c0', 1);
      ctx.restore();
      const fr = Math.floor(t * 24);
      ctx.fillStyle = '#ffd27a';
      for (let i = 0; i < 5; i++) {
        const a = hash01(i + fr * 5, 81) * TAU, d = 6 + 8 * hash01(i + fr * 5, 82);
        circlePath(ctx, ex + Math.cos(a) * d, ey + Math.sin(a) * d, 1.4); ctx.fill();
      }
    }
  }
  // ---- body tube
  const body = rr(ctx, nx - BW / 2, top, BW, BH, 4);
  inked(ctx, body, color);
  clipTo(ctx, body, () => {
    ctx.fillStyle = PAL.white; // candy stripes
    for (let k = -1; k < 4; k++) {
      const y0 = top + 4 + k * 16;
      ctx.beginPath(); ctx.moveTo(nx - BW, y0 + 10); ctx.lineTo(nx + BW, y0 - 4); ctx.lineTo(nx + BW, y0 + 2); ctx.lineTo(nx - BW, y0 + 16); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = rgba(INK, 0.22); ctx.fillRect(nx + BW / 2 - 7, top, 8, BH);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(nx - BW / 2 + 3, top + 3, 3, BH - 8);
  });
  body(); strokeInk(ctx);
  // tape binding the stick
  inked(ctx, rr(ctx, nx + BW / 2 - 4, top + 14, 11, 7, 2), '#e9e4d6', LW * 0.45);
  inked(ctx, rr(ctx, nx + BW / 2 - 4, ny - 16, 11, 7, 2), '#e9e4d6', LW * 0.45);
  // nozzle ring
  inked(ctx, rr(ctx, nx - BW / 2 + 2, ny - 5, BW - 4, 8, 2), STEEL_D, LW * 0.6);
  // nose cone
  const nose = () => { ctx.beginPath(); ctx.moveTo(nx - BW / 2 - 2, top + 1); ctx.quadraticCurveTo(nx - BW / 2 + 2, top - 16, nx, top - 25); ctx.quadraticCurveTo(nx + BW / 2 - 2, top - 16, nx + BW / 2 + 2, top + 1); ctx.closePath(); };
  inked(ctx, nose, PAL.yellow);
  clipTo(ctx, nose, () => { ctx.fillStyle = '#f0a83a'; ctx.fillRect(nx + 3, top - 30, 14, 34); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(nx - 6, top - 12, 3, 10); });
  nose(); strokeInk(ctx);
  // tiny star decal
  softStarPath(ctx, nx - 1, top + BH * 0.5, 6.5, 3.4); ctx.fillStyle = PAL.yellow; ctx.fill(); strokeInk(ctx, 1.6);
  ctx.restore();
}

export const ITEMS = {
  hammer, wrench, remote, paintbrush, blueprint, flag, net, bone, clapperboard, nailBox, weldTorch,
  joystick, redButton, starSticker, trafficCone, sunglasses, stepladder, paintCan, kibble, fireworkRocket,
};
