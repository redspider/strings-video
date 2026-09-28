// Sequencer: picks the scene for time t, handles transitions between scenes,
// applies global post effects. Works in Node (@napi-rs/canvas) and the browser.
import { SCENES } from './scenes/index.js';
import { W, H, INK, PAL, vignette, starPath, circlePath, FONT } from './draw.js';
import { clamp, ease, rgba, TAU } from './util.js';
import { beatAt, barAt, DURATION } from './timing.js';

export { W, H, DURATION };

const sorted = [...SCENES].sort((a, b) => a.start - b.start);

// Frame-accurate sync is handled by the renderer sampling each frame at the
// middle of its display interval (see render.mjs), so cuts use exact times.
const EPS = 0;

export function sceneAt(t) {
  for (let i = sorted.length - 1; i >= 0; i--) if (t >= sorted[i].start - EPS) return i;
  return 0;
}

function drawScene(ctx, scene, t) {
  ctx.save();
  try {
    scene.draw(ctx, t, {
      lt: t - scene.start,
      dur: scene.end - scene.start,
      u: clamp((t - scene.start) / (scene.end - scene.start)),
    });
  } catch (e) {
    ctx.restore(); ctx.save();
    ctx.fillStyle = '#400'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`scene ${scene.id} threw: ${e.message}`, 40, 80);
    if (globalThis.process?.env?.STRICT) throw e;
  }
  ctx.restore();
}

// Buffers for transitions (created lazily via host-provided makeCanvas)
let bufA = null, bufB = null;
function buffers(makeCanvas) {
  if (!bufA) { bufA = makeCanvas(W, H); bufB = makeCanvas(W, H); }
  return [bufA, bufB];
}

// Transition types — `transition` on the INCOMING scene:
//   { type: 'cut' }                      hard cut (default)
//   { type: 'flash', dur: 0.4 }          hard cut + white flash decaying over dur
//   { type: 'fade', dur: 0.6, offset }   crossfade over [start+offset, start+offset+dur]
//   { type: 'dip', dur: 0.8, color }     dip through a colour centred on start
//   { type: 'iris', dur: 0.6, offset }   circular iris wipe revealing the new scene
//   { type: 'starwipe', dur: 0.6, offset } star-shaped reveal
//   { type: 'whip', dur: 0.4, dir: 1 }   whip-pan (both scenes slide with motion streaks)
function transitionState(t, idx) {
  const cur = sorted[idx];
  const tr = cur.transition || { type: 'cut' };
  if (idx === 0) return null;
  const off = tr.offset ?? (tr.type === 'dip' || tr.type === 'whip' ? -(tr.dur ?? 0.6) / 2 : 0);
  const dur = tr.dur ?? 0.6;
  const a = cur.start - EPS + off, b = a + dur;
  return { tr, a, b, dur };
}

export function renderFrame(ctx, t, { makeCanvas, debug = false } = {}) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // Find the scene. A transition with negative offset starts before cur.start,
  // so also look ahead to the next scene.
  let idx = sceneAt(t);
  let st = transitionState(t, idx);
  const next = sorted[idx + 1];
  if (next) {
    const nst = transitionState(t, idx + 1);
    if (nst && t >= nst.a && t < next.start - EPS) { idx = idx + 1; st = nst; }
  }
  const cur = sorted[idx];
  const prev = sorted[idx - 1];
  const inTrans = st && prev && t >= st.a && t < st.b && st.tr.type !== 'cut';

  if (!inTrans) {
    drawScene(ctx, cur, t);
  } else {
    const { tr, a, dur } = st;
    const u = clamp((t - a) / dur);
    const type = tr.type;
    if (type === 'flash') {
      drawScene(ctx, cur, t);
      ctx.fillStyle = rgba(tr.color || '#ffffff', Math.pow(1 - u, 2));
      ctx.fillRect(0, 0, W, H);
    } else if (type === 'dip') {
      if (u < 0.5) drawScene(ctx, prev, t); else drawScene(ctx, cur, t);
      ctx.fillStyle = rgba(tr.color || INK, 1 - Math.abs(u - 0.5) * 2);
      ctx.fillRect(0, 0, W, H);
    } else if (type === 'fade') {
      const [A] = buffers(makeCanvas);
      const actx = A.getContext('2d');
      actx.setTransform(1, 0, 0, 1, 0, 0);
      drawScene(actx, prev, t);
      drawScene(ctx, cur, t);
      ctx.globalAlpha = 1 - ease.inOutSine(u);
      ctx.drawImage(A, 0, 0, W, H);
      ctx.globalAlpha = 1;
    } else if (type === 'iris' || type === 'starwipe') {
      drawScene(ctx, prev, t);
      const R = ease.inCubic(u) * Math.hypot(W, H) * (type === 'starwipe' ? 1.25 : 0.62);
      const cx = tr.x ?? W / 2, cy = tr.y ?? H / 2;
      ctx.save();
      if (type === 'starwipe') starPath(ctx, cx, cy, R, R * 0.5, 5, -Math.PI / 2 + u * 1.2);
      else circlePath(ctx, cx, cy, R);
      ctx.lineWidth = 16; ctx.strokeStyle = tr.edge || PAL.yellow; ctx.stroke();
      ctx.clip();
      drawScene(ctx, cur, t);
      ctx.restore();
    } else if (type === 'whip') {
      const dir = tr.dir ?? 1;
      const e = ease.inOutCubic(u);
      // each scene is clipped to its own sliding rectangle
      ctx.save(); ctx.translate(-dir * e * W, 0); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); drawScene(ctx, prev, t); ctx.restore();
      ctx.save(); ctx.translate(dir * (1 - e) * W, 0); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); drawScene(ctx, cur, t); ctx.restore();
      // motion streaks
      const k = Math.sin(u * Math.PI);
      ctx.save();
      ctx.globalAlpha = 0.5 * k;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 28; i++) {
        const y = ((i * 97) % 108) * 10 + 5;
        const len = 300 + ((i * 53) % 7) * 120;
        const x = ((i * 211) % 1920);
        ctx.fillRect(x - len / 2, y, len, 4 + (i % 3) * 3);
      }
      ctx.restore();
    } else {
      drawScene(ctx, cur, t);
    }
  }

  // ---- global post: gentle vignette, fade in/out ----
  vignette(ctx, 0.22);
  const fadeIn = 1 - clamp(t / 0.14);
  const fadeOut = clamp((t - (DURATION - 1.2)) / 1.1);
  const f = Math.max(fadeIn, fadeOut);
  if (f > 0) { ctx.fillStyle = rgba(INK, f); ctx.fillRect(0, 0, W, H); }

  if (debug) {
    const b = beatAt(t);
    const bar = Math.floor(barAt(t));
    const beatInBar = Math.floor(b) - bar * 4 + 1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 64, 780, 64);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 34px ${FONT.round}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${t.toFixed(2)}s  bar ${bar}.${beatInBar}  ${cur.id}`, 18, H - 32);
    const on = 1 - (b - Math.floor(b));
    ctx.fillStyle = `rgba(255,210,63,${on})`;
    ctx.beginPath(); ctx.arc(750, H - 32, 20, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export const SCENE_LIST = sorted.map((s) => ({ id: s.id, start: s.start, end: s.end }));
