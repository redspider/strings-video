// Juno character sheets:  node tools/sheet_girl.mjs [girl faces arms fixes zoom]
//   sheets/girl.png        stances, walk/run cycles, spacesuit, back views, soot, small scale
//   sheets/girl_faces.png  every expression as big heads + head variants (goggles, soot, helmet, float, bust…)
//   sheets/girl_arms.png   arm presets (incl. cup), holding items, custom {a,b}, facing -1, anchors check
//   sheets/girl_fixes.png  AD fixes: night light, outline floor, helmet Y-arms, frizz, soot ramp, g-force,
//                          silhouette, cupped hands, hairFloat
//   sheets/girl_zoom.png   detail crops at large scale: fishbowl torus, busts, cup, g-force, frizz, soot 0.5
import { sheet, label } from './sheetkit.mjs';
import { drawGirl, drawGirlHead, girlAnchors, drawFishbowl, GIRL_HEIGHT } from '../src/characters/girl.js';
import { PAL, INK, rrect, circle, softStarPath, glow, camera } from '../src/draw.js';

const only = process.argv.slice(2);
const want = (k) => only.length === 0 || only.includes(k);

const T = 20.2; // a time mid-song (between beats: buns up)
const NIGHT = { mul: '#6a7cc6', add: '#1c2764', addAmt: 0.14 }; // backyard night tint
const GOLDEN = { mul: '#ffe6c8', add: '#ff9a55', addAmt: 0.07 };
const ground = (ctx, y, x0 = 0, x1 = 2400) => {
  ctx.save(); ctx.strokeStyle = 'rgba(29,26,47,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore();
};
const edge = (ctx, x, y, w = 200) => { // a crate edge for sitting poses
  ctx.save(); ctx.fillStyle = PAL.wood; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.fillRect(x - w / 2, y, w, 70); ctx.strokeRect(x - w / 2, y, w, 70); ctx.restore();
};
const heightMark = (ctx, x, y, s) => {
  ctx.save(); ctx.strokeStyle = 'rgba(232,69,60,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 90 * s, y - GIRL_HEIGHT * s); ctx.lineTo(x + 90 * s, y - GIRL_HEIGHT * s); ctx.stroke(); ctx.restore();
};
const panel = (ctx, x, y, w, h, bg, fn) => {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); fn(); ctx.restore();
};
const wlabel = (ctx, text, x, y, size = 20) => { // white label for dark panels
  ctx.save(); ctx.font = `bold ${size}px "Arial Rounded MT Bold"`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(text, x, y); ctx.restore();
};
// placeholder held items (the real ones come from src/props/items.js)
const remote = (ctx) => { rrect(ctx, -12, -34, 24, 44, 6, '#ffd23f', 4); circle(ctx, 0, -20, 6, PAL.red, 3); };
const hammer = (ctx) => { rrect(ctx, -6, -40, 12, 70, 5, PAL.wood, 4); rrect(ctx, -22, -54, 44, 20, 5, PAL.grey, 4); };
const card = (ctx, info) => { // text un-mirrored when facing -1: flip x and draw on the other side
  ctx.save(); const k = info && info.dir < 0 ? -1 : 1; ctx.scale(k, 1);
  rrect(ctx, k > 0 ? 6 : -66, -30, 60, 44, 6, '#bfe6ff', 4);
  ctx.fillStyle = INK; ctx.font = 'bold 18px sans-serif'; ctx.fillText('AB', k > 0 ? 20 : -52, -2); ctx.restore();
};
// placeholder baby star for the cupped hands (the real one is drawBabyStar in space.js)
const babyStar = (ctx) => {
  glow(ctx, 0, -6, 60, '#fff3a0', 0.55);
  softStarPath(ctx, 0, -6, 22, 12); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-6, -7, 2.6, 0, 7); ctx.arc(6, -7, 2.6, 0, 7); ctx.fill();
};
const place = (ctx, x, y, s, p) => {
  if (p.stance === 'sit') { edge(ctx, x, y - 90 * s / 0.62); drawGirl(ctx, x, y - 90 * s / 0.62, s, { t: T, ...p }); }
  else if (p.stance === 'float') drawGirl(ctx, x, y - 40, s, { t: T, ...p });
  else if (p.stance === 'jump') drawGirl(ctx, x, y, s, { t: T, lift: 80, ...p });
  else drawGirl(ctx, x, y, s, { t: T, ...p });
};

// ---------------------------------------------------------------- sheet 1: bodies
if (want('girl')) await sheet('sheets/girl.png', 2400, 2050, (ctx) => {
  const s = 0.62;
  let y = 400; ground(ctx, y);
  const row1 = [
    ['stand', { stance: 'stand' }], ['stand facing 0', { stance: 'stand', facing: 0 }],
    ['walk .00', { stance: 'walk', phase: 0 }], ['walk .25', { stance: 'walk', phase: 0.25 }],
    ['walk .50', { stance: 'walk', phase: 0.5 }], ['walk .75', { stance: 'walk', phase: 0.75 }],
    ['run .00', { stance: 'run', phase: 0 }], ['run .25', { stance: 'run', phase: 0.25 }],
    ['run .50', { stance: 'run', phase: 0.5 }], ['run .75', { stance: 'run', phase: 0.75 }],
  ];
  row1.forEach(([n, p], i) => { const x = 120 + i * 232; heightMark(ctx, x, y, s); drawGirl(ctx, x, y, s, { t: T, ...p }); label(ctx, n, x, y + 14); });
  y = 800; ground(ctx, y);
  const row2 = [
    ['walk front .25', { stance: 'walk', phase: 0.25, facing: 0 }], ['run front .75', { stance: 'run', phase: 0.75, facing: 0 }],
    ['sit (edge)', { stance: 'sit', expr: 'happy' }], ['float hairFloat 1', { stance: 'float', expr: 'excited' }],
    ['crouch', { stance: 'crouch', expr: 'determined' }], ['jump', { stance: 'jump', expr: 'excited' }],
    ['jump facing 0', { stance: 'jump', facing: 0, expr: 'laugh' }], ['facing -1 walk', { stance: 'walk', phase: 0.25, facing: -1 }],
    ['facing -1 point', { facing: -1, armR: 'point', expr: 'excited' }],
  ];
  row2.forEach(([n, p], i) => { const x = 120 + i * 232; place(ctx, x, y, s, p); label(ctx, n, x, y + 14); });
  // lie: rotated -90° as a scene would lay her on a blanket (top-down)
  ctx.save(); ctx.fillStyle = '#3f8f46'; ctx.fillRect(2110, 560, 280, 220); ctx.fillStyle = '#e8453c'; ctx.fillRect(2125, 575, 250, 190); ctx.restore();
  ctx.save(); ctx.translate(2360, 670); ctx.rotate(-Math.PI / 2); drawGirl(ctx, 0, 0, 0.5, { t: T, stance: 'lie', expr: 'awe', facing: 0 }); ctx.restore();
  label(ctx, 'lie (rotated)', 2250, y + 14);
  y = 1270; ground(ctx, y);
  const row3 = [
    ['space, no helmet', { suit: 'space' }], ['space helmet', { suit: 'space', helmet: 1, expr: 'grin' }],
    ['helmet 0.5 (plonk)', { suit: 'space', helmet: 0.5, expr: 'surprised' }],
    ['space walk', { suit: 'space', helmet: 1, stance: 'walk', phase: 0.25 }],
    ['space run', { suit: 'space', helmet: 1, stance: 'run', phase: 0.75, expr: 'determined' }],
    ['space float', { suit: 'space', helmet: 1, stance: 'float', expr: 'laugh' }],
    ['space sit', { suit: 'space', helmet: 1, stance: 'sit' }],
    ['space jump f0 (Y arms)', { suit: 'space', helmet: 1, stance: 'jump', facing: 0, expr: 'excited' }],
    ['space back', { suit: 'space', helmet: 1, view: 'back' }],
    ['space crouch', { suit: 'space', helmet: 1, stance: 'crouch', facing: -1 }],
  ];
  row3.forEach(([n, p], i) => { const x = 125 + i * 232; place(ctx, x, y, s, p); label(ctx, n, x, y + 14); });
  y = 1700; ground(ctx, y);
  const row4 = [
    ['back stand', { view: 'back' }], ['back walk', { view: 'back', stance: 'walk', phase: 0.25 }],
    ['back sit (edge)', { view: 'back', stance: 'sit', armR: 'point' }], ['back frizz+soot', { view: 'back', frizz: 1, soot: 1, goggles: 'askew' }],
    ['soot+frizz+askew', { soot: 1, frizz: 1, goggles: 'askew', expr: 'dazed' }],
    ['soot annoyed', { soot: 1, frizz: 1, goggles: 'askew', expr: 'annoyed', armR: 'hips', armL: 'hips' }],
    ['soot clean rings', { soot: 1, frizz: 0.6, goggles: 'forehead', cleanGoggleRings: 1, expr: 'determined' }],
    ['soot 0.5', { soot: 0.5, frizz: 0.3, expr: 'wince' }],
    ['goggles eyes', { goggles: 'eyes', expr: 'determined', armR: 'hold', holdR: remote }],
    ['squash .8 / tilt', { squash: 0.8, tilt: 0.15, expr: 'laugh' }],
  ];
  row4.forEach(([n, p], i) => { const x = 125 + i * 232; place(ctx, x, y, s, p); label(ctx, n, x, y + 14); });
  y = 2000; ground(ctx, y);
  const small = [{}, { stance: 'walk', phase: 0.25 }, { stance: 'run', phase: 0.75 }, { suit: 'space', helmet: 1 }, { view: 'back' },
    { soot: 1, frizz: 1, goggles: 'askew', expr: 'dazed' }, { stance: 'jump', expr: 'excited' }, { armR: 'wave', expr: 'laugh' },
    { facing: -1, armR: 'point' }, { suit: 'space', helmet: 1, stance: 'float' }, { stance: 'crouch' }, { facing: 0, expr: 'surprised' },
    { armL: 'cup', armR: 'cup', holdCup: babyStar, expr: 'awe' }, { silhouette: 1, armL: 'cheer', armR: 'cheer', stance: 'jump' }];
  small.forEach((p, i) => drawGirl(ctx, 100 + i * 115, y - (p.stance === 'float' ? 20 : 0), 0.3, { t: T, lift: p.stance === 'jump' ? 60 : 0, ...p }));
  label(ctx, 's = 0.3 (wide shot, outline floor)', 2000, y - 60, 24);
  label(ctx, 'Juno — drawGirl(ctx, x, y, s, pose)   dashed red line = GIRL_HEIGHT', 1200, 8, 26);
});

// ---------------------------------------------------------------- sheet 2: faces
if (want('faces')) await sheet('sheets/girl_faces.png', 2400, 1960, (ctx) => {
  const exprs = ['happy', 'grin', 'laugh', 'surprised', 'determined', 'dazed', 'annoyed', 'sad', 'sleepy', 'awe', 'wince', 'excited', 'alert', 'gforce'];
  const hs = 0.95;
  exprs.forEach((e, i) => {
    const col = i % 7, row = Math.floor(i / 7);
    const x = 170 + col * 340, y = 190 + row * 360;
    drawGirlHead(ctx, x, y, hs, { t: T, expr: e, facing: i % 2 ? 0.6 : 0, bust: false });
    label(ctx, e, x, y + 118, 24);
  });
  const vars = [
    ['goggles eyes', { goggles: 'eyes', expr: 'grin' }],
    ['askew + soot + frizz', { goggles: 'askew', soot: 1, frizz: 1, expr: 'dazed' }],
    ['clean rings', { goggles: 'forehead', soot: 1, frizz: 0.7, cleanGoggleRings: 1, expr: 'annoyed' }],
    ['helmet f0', { helmet: 1, suit: 'space', goggles: 'none', facing: 0, expr: 'awe' }],
    ['helmet 3/4 + float', { helmet: 1, suit: 'space', hairFloat: 1, expr: 'laugh' }],
    ['back', { view: 'back' }],
    ['facing -1 blush', { facing: -1, blush: 1, expr: 'happy', look: [-1, 0] }],
  ];
  vars.forEach(([n, p], i) => {
    const x = 170 + i * 340, y = 1000;
    drawGirlHead(ctx, x, y, hs * (p.helmet ? 0.8 : 1), { t: T, bust: false, ...p });
    label(ctx, n, x, y + 128, 24);
  });
  const more = [
    ['look up-left', { look: [-1, -1], expr: 'awe' }], ['look down-right', { look: [1, 1], expr: 'happy' }],
    ['blink 0.5', { blink: 0.5 }], ['blink 1', { blink: 1 }], ['mouth 1 (talk)', { mouth: 1, expr: 'determined' }],
    ['mouth .4 surprised', { mouth: 0.4, expr: 'surprised' }], ['back frizz', { view: 'back', frizz: 1 }],
  ];
  more.forEach(([n, p], i) => {
    const x = 170 + i * 340, y = 1340;
    drawGirlHead(ctx, x, y, 0.75, { t: T, bust: false, ...p });
    label(ctx, n, x, y + 100, 22);
  });
  // busts (drawGirlHead default)
  const busts = [
    ['bust overalls', { expr: 'grin' }], ['bust space', { suit: 'space', expr: 'happy' }],
    ['bust space helmet', { suit: 'space', helmet: 1, expr: 'awe' }], ['bust helmet gforce', { suit: 'space', helmet: 1, expr: 'gforce' }],
    ['bust headTilt .3', { headTilt: 0.3, expr: 'grin' }], ['bust back', { view: 'back' }], ['bust space f-1', { suit: 'space', facing: -1, expr: 'excited' }],
  ];
  busts.forEach(([n, p], i) => {
    const x = 170 + i * 340, y = 1690;
    drawGirlHead(ctx, x, y, 0.7, { t: T, ...p });
    label(ctx, n, x, y + 128, 22);
  });
});

// ---------------------------------------------------------------- sheet 3: arms / holding / anchors
if (want('arms')) await sheet('sheets/girl_arms.png', 2400, 1880, (ctx) => {
  const s = 0.72;
  const presets = ['down', 'up', 'wave', 'hips', 'point', 'forward', 'hold', 'cheer', 'reach'];
  let y = 560; ground(ctx, y);
  presets.forEach((p, i) => {
    const x = 140 + i * 262;
    drawGirl(ctx, x, y, s, { t: T, armR: p, armL: p, expr: 'happy' });
    label(ctx, `armL=armR='${p}'`, x, y + 14, 20);
  });
  y = 1180; ground(ctx, y);
  const row = [
    ['holdR remote', { armR: 'hold', holdR: remote, expr: 'determined' }],
    ['holdL hammer up', { armL: 'cheer', holdL: hammer, armR: 'hips', expr: 'grin' }],
    ['holdR card f-1', { facing: -1, armR: 'forward', holdR: card, expr: 'excited' }],
    ['holdRFront', { armR: { a: 0.9, b: 1.2, hand: 'open' }, holdR: (c) => circle(c, 0, -14, 14, '#ffd23f', 4), holdRFront: true, expr: 'awe' }],
    ['{a:.5,b:-2} both', { armL: { a: 0.5, b: -2.0, hand: 'fist' }, armR: { a: 0.5, b: -2.0, hand: 'fist' }, expr: 'sad' }],
    ['across body', { armR: { a: -0.4, b: -0.8, hand: 'open' }, armL: 'point', expr: 'surprised' }],
    ['space hold', { suit: 'space', helmet: 1, armR: 'hold', holdR: remote, armL: 'wave' }],
    ['anchors', { armR: 'point', armL: 'wave', stance: 'walk', phase: 0.3, tilt: 0.1, anchors: true }],
    ['anchors f-1 squash', { facing: -1, armR: 'reach', armL: 'hips', squash: 0.85, headTilt: -0.3, anchors: true }],
  ];
  const drawAnchors = (x, y, s, p) => {
    const A = girlAnchors(x, y, s, { t: T, ...p });
    for (const [k, v] of Object.entries(A)) {
      if (!Array.isArray(v)) continue;
      ctx.save(); ctx.fillStyle = k === 'cup' ? '#00c8ff' : '#ff00aa'; ctx.beginPath(); ctx.arc(v[0], v[1], 5, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = '#ff00aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(A.helmet.x, A.helmet.y, A.helmet.r, 0, 7); ctx.stroke(); ctx.restore();
  };
  row.forEach(([n, p], i) => {
    const x = 140 + i * 262;
    drawGirl(ctx, x, y, s, { t: T, ...p });
    if (p.anchors) drawAnchors(x, y, s, p);
    label(ctx, n, x, y + 14, 20);
  });
  // row 3: cup preset + helmet raised arms (Y-pose beside the glass; dashed = hand clearance r + 22)
  y = 1800; ground(ctx, y);
  const row3 = [
    ['cup + holdCup', { armL: 'cup', armR: 'cup', holdCup: babyStar, expr: 'awe', look: [0, 1] }],
    ['cup f0 space', { armL: 'cup', armR: 'cup', holdCup: babyStar, suit: 'space', facing: 0, expr: 'excited', look: [0, 1] }],
    ['cup anchors', { armL: 'cup', armR: 'cup', expr: 'happy', anchors: true }],
    ['helmet up', { suit: 'space', helmet: 1, armR: 'up', armL: 'up', facing: 0, clear: true }],
    ['helmet cheer', { suit: 'space', helmet: 1, armR: 'cheer', armL: 'cheer', facing: 0, clear: true }],
    ['helmet wave', { suit: 'space', helmet: 1, armR: 'wave', armL: 'down', clear: true }],
    ['helmet reach f-1', { suit: 'space', helmet: 1, armR: 'reach', armL: 'reach', facing: -1, clear: true }],
    ['helmet .5 up', { suit: 'space', helmet: 0.5, armR: 'up', armL: 'up', facing: 0, clear: true }],
    ['helmet jump', { suit: 'space', helmet: 1, stance: 'jump', lift: 60, facing: 0.6, clear: true }],
  ];
  row3.forEach(([n, p], i) => {
    const x = 140 + i * 262;
    drawGirl(ctx, x, y, s, { t: T, ...p });
    if (p.anchors) drawAnchors(x, y, s, p);
    if (p.clear) {
      const A = girlAnchors(x, y, s, { t: T, ...p });
      ctx.save(); ctx.strokeStyle = 'rgba(255,0,170,0.7)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(A.helmet.x, A.helmet.y, A.helmet.r + 22 * s, 0, 7); ctx.stroke(); ctx.restore();
    }
    label(ctx, n, x, y + 14, 20);
  });
});

// ---------------------------------------------------------------- sheet 4: AD fixes
if (want('fixes')) await sheet('sheets/girl_fixes.png', 2400, 2360, (ctx) => {
  // (1) night light: same poses without / with pose.light, on a navy night yard colour
  panel(ctx, 0, 0, 1200, 560, '#1d2a5a', () => {
    ctx.fillStyle = '#233a44'; ctx.fillRect(0, 470, 1200, 90);
    const poses = [{ suit: 'space', expr: 'awe', look: [0.3, -1] }, { expr: 'happy' }, { suit: 'space', helmet: 1, facing: -1 }];
    poses.forEach((p, i) => drawGirl(ctx, 110 + i * 190, 480, 0.8, { t: T, ...p }));
    poses.forEach((p, i) => drawGirl(ctx, 690 + i * 190, 480, 0.8, { t: T, light: NIGHT, ...p }));
    wlabel(ctx, 'no light (pasted-on)', 300, 16); wlabel(ctx, 'light: night todTint', 880, 16);
  });
  panel(ctx, 1200, 0, 1200, 560, '#f0a870', () => {
    ctx.fillStyle = '#7da04a'; ctx.fillRect(1200, 470, 1200, 90);
    drawGirl(ctx, 1320, 480, 0.8, { t: T, expr: 'grin' });
    drawGirl(ctx, 1500, 480, 0.8, { t: T, expr: 'grin', light: GOLDEN });
    drawGirl(ctx, 1680, 480, 0.8, { t: T, expr: 'grin', light: { ...NIGHT, k: 0.5 } });
    drawGirl(ctx, 1860, 480, 0.8, { t: T, soot: 1, frizz: 1, goggles: 'askew', expr: 'dazed', light: NIGHT });
    drawGirlHead(ctx, 2150, 300, 0.9, { t: T, suit: 'space', helmet: 1, expr: 'happy', light: NIGHT });
    wlabel(ctx, 'none / golden / night k .5 / night soot / night helmet head', 1800, 16);
  });
  // (2) outline floor: s = 0.42 in a zoom-1 camera next to a 6 px set line; (6) wide lineup
  panel(ctx, 0, 560, 1200, 420, '#e6d6b8', () => {
    ctx.fillStyle = '#c98b52'; ctx.fillRect(0, 780, 1200, 30); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(-10, 780, 1220, 30);
    const list = [{}, { stance: 'walk', phase: 0.25 }, { suit: 'space', helmet: 1 }, { view: 'back' }, { soot: 1, frizz: 1, goggles: 'askew', expr: 'dazed' }, { armR: 'wave' }, { stance: 'sit' }];
    list.forEach((p, i) => drawGirl(ctx, 90 + i * 165, p.stance === 'sit' ? 780 : 950, 0.42, { t: T, ...p }));
    label(ctx, 's = 0.42 on a zoom-1 camera: silhouette ink ≈ 4 px (fence line = 6 px)', 600, 572, 20);
  });
  panel(ctx, 1200, 560, 1200, 420, '#e6d6b8', () => {
    camera(ctx, { x: 960, y: 540, zoom: 0.5 }, () => {
      [0, 1, 2, 3].forEach((i) => drawGirl(ctx, 1700 + i * 260, 900, 0.42, { t: T, expr: 'happy', facing: i % 2 ? -1 : 1, suit: i > 1 ? 'space' : 'overalls', helmet: i === 3 ? 1 : 0 }));
    });
    label(ctx, 'camera zoom 0.5 × s 0.42 (floor capped at 2×LW)', 1800, 572, 20);
  });
  // (3)+(11) helmet Y arms, hairFloat buns + strands
  panel(ctx, 0, 980, 1200, 560, '#2a2350', () => {
    [['wave', 'wave'], ['up', 'up'], ['cheer', 'cheer'], ['reach', 'down']].forEach(([r, l], i) =>
      drawGirl(ctx, 150 + i * 240, 1500, 0.72, { t: T, suit: 'space', helmet: 1, armR: r, armL: l, expr: 'happy', facing: 0 }));
    wlabel(ctx, 'helmet + wave / up / cheer / reach: Y-pose beside the glass', 520, 996);
    drawGirl(ctx, 1080, 1380, 0.62, { t: T + 0.3, stance: 'float', suit: 'space', helmet: 1, expr: 'awe', tilt: -0.15 });
  });
  panel(ctx, 1200, 980, 1200, 560, '#2a2350', () => {
    drawGirl(ctx, 1350, 1420, 0.72, { t: T, stance: 'float', suit: 'space', helmet: 1, expr: 'laugh' });
    drawGirl(ctx, 1620, 1420, 0.72, { t: T + 0.9, stance: 'float', suit: 'space', helmet: 1, expr: 'excited', tilt: -0.35 });
    drawGirl(ctx, 1880, 1420, 0.72, { t: T + 1.5, stance: 'float', suit: 'space', expr: 'happy', tilt: 0.2 });
    drawGirlHead(ctx, 2200, 1200, 0.8, { t: T + 0.4, suit: 'space', helmet: 1, hairFloat: 1, expr: 'awe', bust: false });
    wlabel(ctx, 'hairFloat: round buns (y-stretch ≤ 1.2) + 3 open S-strands per bun', 1800, 996);
  });
  // (4)+(10) frizz + soot ramp
  panel(ctx, 0, 1540, 1200, 420, '#e9b98a', () => {
    [0, 0.25, 0.5, 0.7, 0.85, 1].forEach((sv, i) => {
      drawGirl(ctx, 100 + i * 200, 1920, 0.62, { t: T, soot: sv, expr: sv > 0.8 ? 'annoyed' : 'surprised' });
      label(ctx, `soot ${sv}`, 100 + i * 200, 1548, 20);
    });
  });
  panel(ctx, 1200, 1540, 1200, 420, '#e9b98a', () => {
    drawGirl(ctx, 1330, 1920, 0.62, { t: T, frizz: 1, expr: 'surprised' });
    drawGirl(ctx, 1560, 1920, 0.62, { t: T, frizz: 1, soot: 1, goggles: 'askew', expr: 'dazed' });
    drawGirl(ctx, 1790, 1920, 0.62, { t: T, frizz: 0.5, soot: 0.6, expr: 'wince' });
    drawGirl(ctx, 2020, 1920, 0.62, { t: T, frizz: 1, soot: 1, view: 'back' });
    drawGirl(ctx, 2250, 1920, 0.62, { t: T, frizz: 1, soot: 1, goggles: 'forehead', cleanGoggleRings: 1, expr: 'annoyed', facing: -1 });
    label(ctx, 'frizz 1 / +soot / frizz .5 soot .6 / back / clean rings f-1', 1800, 1548, 20);
  });
  // (7) g-force  (8) silhouette  (9) cup
  panel(ctx, 0, 1960, 800, 400, '#141a44', () => {
    drawGirlHead(ctx, 150, 2130, 0.8, { t: T, expr: 'gforce', bust: false });
    drawGirlHead(ctx, 400, 2130, 0.8, { t: T + 0.07, suit: 'space', helmet: 1, expr: 'gforce', bust: false });
    drawGirlHead(ctx, 660, 2130, 0.8, { t: T, suit: 'space', helmet: 1, expr: 'gforce', gforce: 0.5, facing: -1, bust: false });
    wlabel(ctx, 'gforce 1 / helmet / 0.5 f-1', 400, 1970);
  });
  panel(ctx, 800, 1960, 800, 400, '#3a2a6a', () => {
    ctx.fillStyle = '#141024'; ctx.fillRect(800, 2300, 800, 60);
    drawGirl(ctx, 930, 2310, 0.62, { t: T, silhouette: 1, stance: 'jump', lift: 40, expr: 'excited' });
    drawGirl(ctx, 1130, 2310, 0.62, { t: T, silhouette: 1, armR: 'wave', facing: -1 });
    drawGirl(ctx, 1330, 2310, 0.62, { t: T, silhouette: 0.5, armL: 'cheer', armR: 'cheer' });
    drawGirl(ctx, 1510, 2310, 0.62, { t: T, silhouette: 1, suit: 'space', helmet: 1, armR: 'cheer', armL: 'cheer', facing: 0 });
    wlabel(ctx, 'silhouette 1 / 1 f-1 / 0.5 / suit', 1200, 1970);
  });
  panel(ctx, 1600, 1960, 800, 400, '#241c4a', () => {
    drawGirl(ctx, 1760, 2340, 0.72, { t: T, armL: 'cup', armR: 'cup', holdCup: babyStar, expr: 'awe', look: [0, 1], suit: 'space' });
    drawGirl(ctx, 2000, 2340, 0.72, { t: T, armL: 'cup', armR: 'cup', holdCup: babyStar, expr: 'excited', facing: 0, look: [0, 1] });
    drawGirl(ctx, 2240, 2340, 0.72, { t: T, armL: 'cup', armR: 'cup', holdCup: babyStar, expr: 'happy', facing: -1, suit: 'space', helmet: 1, look: [0, 1] });
    wlabel(ctx, "armL = armR = 'cup' + holdCup", 2000, 1970);
  });
});

// ---------------------------------------------------------------- sheet 5: detail zooms
if (want('zoom')) await sheet('sheets/girl_zoom.png', 2400, 1500, (ctx) => {
  panel(ctx, 0, 0, 800, 750, '#2a2350', () => {
    drawGirlHead(ctx, 400, 330, 2.0, { t: T, suit: 'space', helmet: 1, expr: 'happy' });
    wlabel(ctx, 'fishbowl torus + space bust (s 2)', 400, 12);
  });
  panel(ctx, 800, 0, 800, 750, '#8fc4ea', () => {
    drawGirlHead(ctx, 1200, 330, 2.0, { t: T, expr: 'grin' });
    label(ctx, 'overalls bust (s 2)', 1200, 12, 20);
  });
  panel(ctx, 1600, 0, 800, 750, '#2a2350', () => {
    drawGirlHead(ctx, 2000, 360, 2.0, { t: T + 0.05, suit: 'space', helmet: 1, expr: 'gforce' });
    wlabel(ctx, 'g-force inside the helmet (s 2)', 2000, 12);
  });
  panel(ctx, 0, 750, 800, 750, '#241c4a', () => {
    drawGirl(ctx, 400, 1480 + 480, 2.3, { t: T, armL: 'cup', armR: 'cup', holdCup: babyStar, expr: 'awe', look: [0, 1] });
    wlabel(ctx, 'cupped hands (s 2.3)', 400, 762);
  });
  panel(ctx, 800, 750, 800, 750, '#e9b98a', () => {
    drawGirlHead(ctx, 1200, 1110, 1.7, { t: T, frizz: 1, soot: 1, goggles: 'askew', expr: 'dazed' });
    label(ctx, 'frizz 1 soot 1 (s 1.7)', 1200, 762, 20);
  });
  panel(ctx, 1600, 750, 800, 750, '#e9b98a', () => {
    drawGirl(ctx, 2000, 1480 + 250, 1.55, { t: T, soot: 0.5, expr: 'surprised' });
    label(ctx, 'soot 0.5: smudges, not a skin tone (s 1.55)', 2000, 762, 20);
  });
});

// standalone fishbowl check (drawFishbowl with defaults, as dog.js would call it)
if (want('zoom')) await sheet('sheets/girl_fishbowl.png', 800, 400, (ctx) => {
  ctx.fillStyle = '#2a2350'; ctx.fillRect(0, 0, 800, 400);
  drawFishbowl(ctx, 200, 170, 134, {});
  const dogNeck = (c, g) => { c.fillStyle = '#e3d2b4'; c.fillRect(-26, g.ringY - 30, 52, 50); };
  drawFishbowl(ctx, 520, 190, 68, { open: 40, ringDy: 55, ringRx: 45, neck: dogNeck });
  ctx.save(); ctx.translate(700, 190); ctx.scale(-1, 1); // a mirrored caller passes dir -1: glints stay upper-left
  drawFishbowl(ctx, 0, 0, 68, { open: 40, ringDy: 55, ringRx: 45, dir: -1, neck: dogNeck });
  ctx.restore();
  wlabel(ctx, 'drawFishbowl: defaults r134 / dog-sized r68 + neck / mirrored ctx + dir -1', 400, 370);
});
