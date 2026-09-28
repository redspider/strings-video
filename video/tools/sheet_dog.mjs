// Biscuit character sheets:  node tools/sheet_dog.mjs [only]
//   sheets/dog_stances.png   all stances (front + back), facing ±1, small-scale row
//   sheets/dog_expr.png      every expression as a big head (+ gforce at scale)
//   sheets/dog_variants.png  soot/frizz, space suit + helmet, sunglasses, goggles, holdMouth,
//                            hat callback, float upside-down, paw gags, back views, s=0.3 row
//   sheets/dog_zoom.png      large close-ups for detail checks
//   sheets/dog_looks.png     soot sweep, `light` time-of-day tint (night/dusk/golden), s20 silhouette + rim,
//                            outline floor at wide-shot scales (next to a 6 px set-line post)
import { sheet, label } from './sheetkit.mjs';
import { drawDog, drawDogHead, dogAnchors, DOG_HEIGHT } from '../src/characters/dog.js';
import { PAL, INK, LW, ink, rrectPath, circle, groundShadow } from '../src/draw.js';
import { barTime } from '../src/timing.js';

const only = process.argv[2];
const T = barTime(10, 0.25); // some time mid-song, just after a beat

// placeholder props
const bone = (ctx) => {
  ctx.save();
  ctx.rotate(-0.08);
  const c = '#fff6e6';
  for (const sx of [-1, 1]) { circle(ctx, sx * 26, -7, 9, c, 4.5); circle(ctx, sx * 26, 7, 9, c, 4.5); }
  rrectPath(ctx, -27, -7, 54, 14, 6); ink(ctx, c, 4.5);
  ctx.fillStyle = c;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 26, -7, 6.5, 0, 7); ctx.arc(sx * 26, 7, 6.5, 0, 7); ctx.fill(); }
  ctx.fillRect(-26, -4.5, 52, 9);
  ctx.restore();
};
const cone = (ctx) => {
  ctx.save();
  ctx.rotate(0.18);
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-6, -70); ctx.quadraticCurveTo(0, -75, 6, -70); ctx.lineTo(26, 0); ctx.closePath();
  ink(ctx, PAL.orange, LW);
  ctx.save(); ctx.clip(); ctx.fillStyle = '#ffffff'; ctx.fillRect(-40, -46, 80, 12); ctx.fillRect(-40, -24, 80, 10); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-6, -70); ctx.quadraticCurveTo(0, -75, 6, -70); ctx.lineTo(26, 0); ctx.closePath(); ink(ctx, null, LW);
  rrectPath(ctx, -36, -6, 72, 12, 4); ink(ctx, PAL.orange, LW);
  ctx.restore();
};
const nailBox = (ctx) => {
  rrectPath(ctx, -24, 4, 48, 30, 5); ink(ctx, PAL.wood, 4.5);
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(0, -6, 8, 4); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = 'bold 13px "Arial Rounded MT Bold"'; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText('NAILS', 0, 24);
};

function ground(ctx, x, y, w = 200) { groundShadow(ctx, x, y, w, 26, 0.18); }

async function stances() {
  await sheet('sheets/dog_stances.png', 1920, 1300, (ctx) => {
    const st = ['stand', 'walk', 'run', 'jump', 'sit', 'beg', 'float', 'lie'];
    st.forEach((s, i) => {
      const x = 130 + i * 235, y = 330;
      ground(ctx, x, y);
      drawDog(ctx, x, y, 1, { t: T, stance: s });
      label(ctx, s, x, y + 20);
    });
    // walk + run cycles (phase strip)
    for (let i = 0; i < 6; i++) {
      const x = 110 + i * 155, y = 600;
      ground(ctx, x, y, 150);
      drawDog(ctx, x, y, 0.7, { stance: 'walk', phase: i / 6, expr: 'happy' });
      label(ctx, `walk ${(i / 6).toFixed(2)}`, x, y + 12, 18);
    }
    for (let i = 0; i < 6; i++) {
      const x = 1030 + i * 150, y = 600;
      ground(ctx, x, y, 150);
      drawDog(ctx, x, y, 0.7, { stance: 'run', phase: i / 6, expr: 'excited' });
      label(ctx, `run ${(i / 6).toFixed(2)}`, x, y + 12, 18);
    }
    // facing -1 + back view
    const row3 = [
      ['stand f-1', { stance: 'stand', facing: -1 }], ['sit f-1', { stance: 'sit', facing: -1, expr: 'happy' }],
      ['walk f-1', { stance: 'walk', facing: -1, phase: 0.3 }], ['back sit', { view: 'back', stance: 'sit' }],
      ['back sit look up', { view: 'back', stance: 'sit', look: [0.4, -1] }], ['back stand', { view: 'back', stance: 'stand' }],
      ['back walk', { view: 'back', stance: 'walk', phase: 0.7 }], ['turn 0', { stance: 'sit', turn: 0 }],
    ];
    row3.forEach(([name, p], i) => {
      const x = 130 + i * 235, y = 930;
      ground(ctx, x, y);
      drawDog(ctx, x, y, 1, { t: T, ...p });
      label(ctx, name, x, y + 20);
    });
    // small scale row
    const small = ['stand', 'walk', 'run', 'jump', 'sit', 'beg', 'float', 'lie'];
    small.forEach((s, i) => {
      const x = 100 + i * 110, y = 1230;
      drawDog(ctx, x, y, 0.3, { t: T, stance: s });
    });
    [['back', { view: 'back', stance: 'sit' }], ['space', { suit: 'space', helmet: 1 }], ['soot', { soot: 1, frizz: 1 }], ['excited', { expr: 'excited' }], ['sad', { expr: 'sad' }], ['alert', { expr: 'alert', stance: 'sit' }], ['dazed', { expr: 'dazed' }], ['float', { stance: 'float', helmet: 1, suit: 'space', tilt: Math.PI }]].forEach(([n, p], i) => {
      const x = 1000 + i * 110, y = 1230;
      drawDog(ctx, x, y + (p.tilt ? -60 : 0), 0.3, { t: T, ...p });
    });
    label(ctx, 's = 0.3', 60, 1250, 18);
  });
}

async function exprs() {
  const E = ['neutral', 'happy', 'grin', 'laugh', 'excited', 'awe', 'alert', 'surprised', 'sad', 'dazed', 'sleepy', 'annoyed', 'determined', 'wince', 'gforce'];
  await sheet('sheets/dog_expr.png', 1920, 1080, (ctx) => {
    E.forEach((e, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 200 + col * 380, y = 170 + row * 350;
      drawDogHead(ctx, x, y, 1.6, { t: T, expr: e, blink: 0 });
      label(ctx, e, x, y + 130);
    });
  });
}

async function variants() {
  await sheet('sheets/dog_variants.png', 1920, 1300, (ctx) => {
    const cells = [
      ['soot 1 frizz 1', { soot: 1, frizz: 1, stance: 'sit', expr: 'dazed' }],
      ['soot .5', { soot: 0.5, stance: 'sit' }],
      ['frizz 1', { frizz: 1, stance: 'stand', expr: 'surprised' }],
      ['space suit + helmet', { suit: 'space', helmet: 1, stance: 'sit', expr: 'happy' }],
      ['helmet .5 (drop in)', { suit: 'space', helmet: 0.5, stance: 'stand' }],
      ['sunglasses', { sunglasses: true, stance: 'sit', expr: 'grin' }],
      ['goggles eyes', { goggles: 'eyes', stance: 'sit' }],
      ['goggles forehead', { goggles: 'forehead', stance: 'stand', expr: 'happy' }],
      ['holdMouth bone', { holdMouth: bone, stance: 'stand' }],
      ['holdMouth box f-1', { holdMouth: nailBox, stance: 'sit', facing: -1 }],
      ['hat cone (dazed)', { hat: cone, stance: 'sit', expr: 'dazed', soot: 1, frizz: 0.6 }],
      ['pawsUp 1', { pawsUp: 1, stance: 'sit', expr: 'wince' }],
      ['pawsUp .5', { pawsUp: 0.5, stance: 'sit', expr: 'surprised' }],
      ['pawWave', { pawWave: 1, stance: 'sit', expr: 'happy' }],
      ['float upside-down', { stance: 'float', tilt: Math.PI, suit: 'space', helmet: 1, expr: 'excited' }],
      ['float', { stance: 'float', suit: 'space', helmet: 1, expr: 'happy' }],
      ['back space', { view: 'back', stance: 'sit', suit: 'space', helmet: 1, look: [0.3, -0.6] }],
      ['alert + exclaim', { stance: 'stand', expr: 'alert', exclaim: 1 }],
      ['beg excited', { stance: 'beg', expr: 'excited' }],
      ['bark mouth 1', { stance: 'stand', expr: 'excited', mouth: 1, tongue: 0 }],
      ['headTilt + look', { stance: 'sit', headTilt: 0.3, look: [-0.8, -0.6], expr: 'awe' }],
      ['squash .8', { stance: 'stand', squash: 0.8 }],
      ['hairFloat', { stance: 'stand', hairFloat: 1, suit: 'space', helmet: 1 }],
      ['lie + blush', { stance: 'lie', blush: 1 }],
    ];
    cells.forEach(([name, p], i) => {
      const col = i % 8, row = Math.floor(i / 8);
      const x = 125 + col * 237, y = 300 + row * 330 + (p.tilt ? -140 : 0);
      if (!p.tilt) ground(ctx, x, y);
      drawDog(ctx, x, y, 1, { t: T, ...p });
      label(ctx, name, x, 300 + row * 330 + 18, 19);
      if (p.holdMouth || p.hat) {
        const a = dogAnchors(x, y, 1, { t: T, ...p });
        for (const k of ['mouth', 'crown', 'tail']) { ctx.fillStyle = '#00c'; ctx.fillRect(a[k][0] - 2, a[k][1] - 2, 4, 4); }
      }
    });
    // small-scale row
    const small = [
      { stance: 'sit', soot: 1, frizz: 1 }, { stance: 'sit', suit: 'space', helmet: 1 }, { sunglasses: true, stance: 'sit' }, { goggles: 'eyes', stance: 'stand' },
      { holdMouth: nailBox, stance: 'walk' }, { hat: cone, stance: 'sit', expr: 'dazed' }, { pawsUp: 1, stance: 'sit' }, { stance: 'float', helmet: 1, suit: 'space' },
      { view: 'back', stance: 'sit', helmet: 1, suit: 'space' }, { expr: 'alert', exclaim: 1 }, { stance: 'lie' }, { stance: 'beg', expr: 'happy' },
    ];
    small.forEach((p, i) => drawDog(ctx, 80 + i * 150, 1250, 0.3, { t: T, ...p }));
  });
}

async function zoom() {
  await sheet('sheets/dog_zoom.png', 1920, 1080, (ctx) => {
    drawDogHead(ctx, 330, 470, 3, { t: T, expr: 'happy', blink: 0 });
    drawDogHead(ctx, 960, 470, 3, { t: T, expr: 'gforce', helmet: 1, suit: 'space' });
    drawDogHead(ctx, 1590, 470, 3, { t: T, expr: 'excited', facing: -1, blink: 0 });
  });
}

async function zoom2() {
  await sheet('sheets/dog_zoom2.png', 1920, 1080, (ctx) => {
    const cells = [
      ['pawsUp 1', { stance: 'sit', pawsUp: 1, expr: 'wince' }],
      ['alert', { stance: 'stand', expr: 'alert' }],
      ['back sit', { view: 'back', stance: 'sit', suit: 'space' }],
      ['beg', { stance: 'beg', expr: 'happy' }],
      ['sit space', { stance: 'sit', suit: 'space', helmet: 1, expr: 'excited' }],
      ['frizz', { stance: 'stand', frizz: 1, soot: 0.15, expr: 'surprised' }],
    ];
    cells.forEach(([n, p], i) => {
      const x = 330 + (i % 3) * 630, y = 500 + Math.floor(i / 3) * 520;
      drawDog(ctx, x, y, 1.9, { t: T, ...p });
      label(ctx, n, x, y + 6);
    });
  });
}

// Time strips + parameter sweeps (checks tempo-locked motion and that every knob is continuous)
async function anim() {
  await sheet('sheets/dog_anim.png', 1920, 1300, (ctx) => {
    const t0 = barTime(20);
    const rows = [
      ['sit happy, t += 1/8 beat', (i) => ({ t: t0 + i * 0.075, stance: 'sit', expr: 'happy' })],
      ['walk, t += 1/8 beat', (i) => ({ t: t0 + i * 0.075, stance: 'walk' })],
      ['run, t += 1/8 beat', (i) => ({ t: t0 + i * 0.075, stance: 'run', expr: 'excited' })],
      ['float, t += 1/4 beat', (i) => ({ t: t0 + i * 0.15, stance: 'float', helmet: 1, suit: 'space' })],
      ['helmet 0..1', (i) => ({ t: t0, stance: 'sit', suit: 'space', helmet: i / 9 })],
      ['ears 0..1', (i) => ({ t: t0, stance: 'stand', ears: i / 9, blink: 0 })],
      ['mouth 0..1 (bark)', (i) => ({ t: t0, stance: 'stand', mouth: i / 9, blink: 0, expr: 'alert' })],
      ['pawsUp 0..1', (i) => ({ t: t0, stance: 'sit', pawsUp: i / 9, blink: 0 })],
      ['blink 0..1 + wag/tail override', (i) => ({ t: t0, stance: 'stand', blink: i / 9, tail: -2.6 + i * 0.12 })],
      ['soot/frizz 0..1', (i) => ({ t: t0, stance: 'sit', soot: i / 9, frizz: i / 9, blink: 0 })],
    ];
    rows.forEach(([name, f], r) => {
      const y = 110 + r * 122;
      label(ctx, name, 170, y - 70, 18);
      for (let i = 0; i < 10; i++) drawDog(ctx, 330 + i * 160, y + (name.startsWith('float') ? -10 : 0), 0.52, f(i));
    });
  }, { bg: '#dfe7ef' });
}

// Soot sweep, time-of-day `light` tint, s20 silhouette, and the outline floor at wide-shot scales.
const NIGHT = { mul: '#6a7cc6', add: '#1c2764', addAmt: 0.14 }; // backyard todTint 'night'
const DUSK = { mul: '#d9b6df', add: '#4a3a8a', addAmt: 0.1 };
const GOLDEN = { mul: '#ffe6c8', add: '#ff9a55', addAmt: 0.07 };
async function looks() {
  await sheet('sheets/dog_looks.png', 1920, 1500, (ctx) => {
    // row 1: soot sweep (frizz 0) + soot 1 frizz 1 variants
    const sw = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];
    sw.forEach((k, i) => {
      const x = 110 + i * 205, y = 300;
      ground(ctx, x, y, 170);
      drawDog(ctx, x, y, 0.85, { t: T, stance: 'sit', soot: k, blink: 0, expr: k > 0.6 ? 'annoyed' : 'neutral' });
      label(ctx, `soot ${k}`, x, y + 14, 18);
    });
    [[{ stance: 'sit', soot: 1, frizz: 1, expr: 'dazed' }, 'soot1 frizz1'], [{ stance: 'stand', soot: 1, frizz: 0.6, expr: 'wince', facing: -1 }, 'stand f-1 frizz.6']].forEach(([p, n], i) => {
      const x = 1560 + i * 210, y = 300;
      ground(ctx, x, y, 170);
      drawDog(ctx, x, y, 0.85, { t: T, ...p });
      label(ctx, n, x, y + 14, 18);
    });
    // row 2: night yard — untinted vs light: night / dusk / golden (+ k 0.5)
    ctx.fillStyle = '#15215b'; ctx.fillRect(0, 380, 1920, 330);
    ctx.fillStyle = '#dfe7ef'; ctx.fillRect(0, 380, 1660, 34);
    ctx.fillStyle = '#1f3d45'; ctx.fillRect(0, 620, 1920, 90);
    const lit = [
      ['no light (bug)', {}], ['light: night', { light: NIGHT }], ['night k .5', { light: { ...NIGHT, k: 0.5 } }],
      ['night + space', { light: NIGHT, suit: 'space', stance: 'stand', expr: 'happy' }],
      ['night + helmet', { light: NIGHT, suit: 'space', helmet: 1, stance: 'sit', expr: 'excited' }],
      ['night lie', { light: NIGHT, stance: 'lie' }], ['night soot', { light: NIGHT, soot: 1, frizz: 1, expr: 'dazed' }],
    ];
    lit.forEach(([n, p], i) => {
      const x = 130 + i * 250, y = 660;
      drawDog(ctx, x, y, 0.8, { t: T, stance: 'sit', expr: 'happy', ...p });
      label(ctx, n, x, 392, 18);
    });
    ctx.save(); ctx.fillStyle = '#ffd9a0'; ctx.fillRect(1780, 380, 140, 330); ctx.restore();
    ctx.save(); ctx.fillStyle = '#c9789a'; ctx.fillRect(1660, 380, 120, 330); ctx.restore();
    drawDog(ctx, 1720, 660, 0.55, { t: T, stance: 'sit', light: DUSK, expr: 'happy' });
    drawDog(ctx, 1850, 660, 0.55, { t: T, stance: 'sit', light: GOLDEN, expr: 'happy' });
    label(ctx, 'dusk', 1720, 392, 16); label(ctx, 'golden', 1850, 392, 16);
    // row 3: silhouette sweep on a firework sky (s20)
    const g = ctx.createLinearGradient(0, 720, 0, 1060);
    g.addColorStop(0, '#2a1d5c'); g.addColorStop(1, '#ff8a5c');
    ctx.fillStyle = g; ctx.fillRect(0, 720, 1920, 340);
    ctx.fillStyle = '#dfe7ef'; ctx.fillRect(0, 720, 1920, 34);
    ctx.fillStyle = '#141024'; ctx.fillRect(0, 1010, 1920, 50);
    const sil = [
      ['sil 0', { silhouette: 0 }], ['sil .5', { silhouette: 0.5 }], ['sil 1', { silhouette: 1 }], ['sil 1 rim 0', { silhouette: 1, rim: 0 }],
      ['sil 1 beg', { silhouette: 1, stance: 'beg', expr: 'excited' }], ['sil 1 jump', { silhouette: 1, stance: 'jump', expr: 'excited' }],
      ['sil 1 f-1 wave', { silhouette: 1, facing: -1, pawWave: 1, expr: 'happy' }], ['sil 1 helmet', { silhouette: 1, suit: 'space', helmet: 1 }],
    ];
    sil.forEach(([n, p], i) => {
      const x = 120 + i * 238, y = 1020;
      drawDog(ctx, x, y, 0.8, { t: T, stance: 'sit', expr: 'happy', ...p });
      label(ctx, n, x, 730, 18);
    });
    // row 4: outline floor — the dog at wide-shot scales next to a 6 px "set line" reference
    ctx.fillStyle = '#f2c98e'; ctx.fillRect(0, 1060, 1920, 440);
    ctx.fillStyle = '#7cb65c'; ctx.fillRect(0, 1400, 1920, 100);
    const scales = [0.25, 0.3, 0.42, 0.5, 0.62, 0.8];
    let x = 110;
    for (const s of scales) {
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(x - 60, 1150, 26, 250); ctx.restore(); // fence-post reference
      drawDog(ctx, x + 40, 1440, s, { t: T, stance: 'sit', expr: 'happy' });
      drawDog(ctx, x + 40 + 190 * s + 40, 1440, s, { t: T, stance: 'stand', suit: 'space', helmet: 1, expr: 'happy' });
      label(ctx, `s ${s}`, x + 40, 1080, 18);
      x += 150 + 420 * s;
    }
  });
}

if (!only || only === 'looks') await looks();
if (!only || only === 'anim') await anim();
if (!only || only === 'stances') await stances();
if (!only || only === 'zoom2') await zoom2();
if (!only || only === 'expr') await exprs();
if (!only || only === 'variants') await variants();
if (!only || only === 'zoom') await zoom();
