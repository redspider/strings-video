// Contact sheets for src/props/items.js   —   node tools/sheet_items.mjs [name ...]
import { sheet, label } from './sheetkit.mjs';
import * as I from '../src/props/items.js';
import { barTime } from '../src/timing.js';
import { drawGirl } from '../src/characters/girl.js';
import { drawDog } from '../src/characters/dog.js';

const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const T = barTime(9, 0.05);
const at = (ctx, x, y, s, fn) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(ctx); ctx.restore(); };
const lab2 = (ctx, s, x, y) => { ctx.save(); ctx.font = 'bold 18px "Arial Rounded MT Bold"'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(s, x, y); ctx.restore(); };
const cross = (ctx, x, y) => { ctx.save(); ctx.strokeStyle = '#ff2d6f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke(); ctx.restore(); };

if (want('tools')) await sheet('sheets/items_tools.png', 1920, 1080, (ctx) => {
  const S = 1.6;
  const row1 = [
    ['hammer', (c) => I.hammer(c)], ['wrench', (c) => I.wrench(c)], ['paintbrush red', (c) => I.paintbrush(c)],
    ['paintbrush teal drip .5', (c) => I.paintbrush(c, { color: '#2ec4b6', drip: 0.5 })], ['paintbrush drip 1', (c) => I.paintbrush(c, { drip: 0.9 })],
    ['weldTorch off', (c) => I.weldTorch(c, { t: T })], ['weldTorch on', (c) => I.weldTorch(c, { t: T, on: 1 })],
  ];
  row1.forEach(([l, f], i) => { const x = 130 + i * 265, y = 330; at(ctx, x, y, S, f); cross(ctx, x, y); label(ctx, l, x, 470); });
  const row2 = [
    ['remote', (c) => I.remote(c)], ['remote pressed', (c) => I.remote(c, { pressed: 1 })],
    ['joystick', (c) => I.joystick(c)], ['joystick tilt .5', (c) => I.joystick(c, { tilt: 0.5 })],
    ['redButton', (c) => I.redButton(c)], ['redButton pressed', (c) => I.redButton(c, { pressed: 1 })],
  ];
  row2.forEach(([l, f], i) => { const x = 150 + i * 310, y = 820; at(ctx, x, y, S, f); cross(ctx, x, y); label(ctx, l, x, 1000); });
});

if (want('misc')) await sheet('sheets/items_misc.png', 1920, 1200, (ctx) => {
  const S = 1.6;
  const row1 = [
    ['bone', (c) => I.bone(c)], ['nailBox', (c) => I.nailBox(c)], ['starSticker', (c) => I.starSticker(c)], ['starSticker peel', (c) => I.starSticker(c, { peel: 1, rot: 0.2 })],
    ['sunglasses', (c) => I.sunglasses(c)], ['trafficCone', (c) => I.trafficCone(c)], ['cone charred .5', (c) => I.trafficCone(c, { charred: 0.5 })],
    ['cone charred 1 smoke', (c) => I.trafficCone(c, { charred: 1, smoke: 1, t: T })],
  ];
  row1.forEach(([l, f], i) => { const x = 120 + i * 235, y = 250; at(ctx, x, y, S, f); cross(ctx, x, y); label(ctx, l, x, 380); });
  [0, 0.25, 0.5].forEach((tt, i) => { const x = 110 + i * 300, y = 860; at(ctx, x, y, 1.25, (c) => I.flag(c, { t: T + tt })); cross(ctx, x, y); label(ctx, `flag t+${tt}`, x + 100, 1040); });
  [[1, 0, 1000], [1, 1, 1380], [-1, 0, 1880]].forEach(([sw, gl, x], i) => { const y = 1080; at(ctx, x, y, 1.2, (c) => I.net(c, { t: T + i * 0.3, swing: sw, glow: gl, full: gl })); cross(ctx, x, y); label(ctx, `net swing ${sw} glow ${gl}`, x - sw * 60, 1110, 18); });
});

if (want('paper')) await sheet('sheets/items_paper.png', 1920, 1080, (ctx) => {
  const S = 1.2;
  const bps = [
    ['open 0 (rolled)', { open: 0 }], ['open .5 test', { open: 0.5, drawing: 'test', title: 'TEST #1' }],
    ['open 1 test crossed .6', { open: 1, drawing: 'test', title: 'TEST #1', crossed: 0.6 }],
    ['rocket TAKE 2', { open: 1, drawing: 'rocket', title: 'S.S. BISCUIT — TAKE 2!' }],
  ];
  bps.forEach(([l, o], i) => { const x = 240 + i * 480, y = 60; at(ctx, x, y, S, (c) => I.blueprint(c, o)); cross(ctx, x, y); label(ctx, l, x, 380); });
  [0.3, 0.7, 1].forEach((cr, i) => { const x = 200 + i * 330, y = 520; at(ctx, x, y, 1, (c) => I.blueprint(c, { drawing: 'test', title: 'TEST #1', crossed: 1, crumple: cr })); cross(ctx, x, y); label(ctx, `crumple ${cr}`, x, 800); });
  [0, 0.5, 1].forEach((cl, i) => { const x = 1170 + i * 0 + (i % 2) * 380, y = 560 + Math.floor(i / 2) * 330; });
  at(ctx, 1260, 640, 1.0, (c) => I.clapperboard(c, { clap: 0 })); label(ctx, 'clapperboard clap 0', 1260, 770);
  at(ctx, 1640, 640, 1.0, (c) => I.clapperboard(c, { clap: 1 })); label(ctx, 'clap 1', 1640, 770);
  at(ctx, 1260, 940, 0.8, (c) => I.clapperboard(c, { clap: 0.5, scene: '3', take: '7' })); label(ctx, 'clap .5 scene 3 take 7', 1260, 1040);
});

if (want('scale')) await sheet('sheets/items_scale.png', 1920, 540, (ctx) => {
  // Juno-height ruler (420 px at s=1) and every item at s = 0.4 as in wide shots
  ctx.fillStyle = '#b9c4d2'; ctx.fillRect(40, 60, 30, 420 * 1.0);
  label(ctx, 'Juno 420', 55, 490, 16);
  const s1 = [['hammer', I.hammer], ['wrench', I.wrench], ['remote', I.remote], ['paintbrush', I.paintbrush], ['torch', (c) => I.weldTorch(c, { on: 1, t: T })],
    ['bone', I.bone], ['nailBox', I.nailBox], ['sticker', I.starSticker], ['cone', I.trafficCone], ['shades', I.sunglasses], ['joystick', I.joystick], ['button', I.redButton],
    ['can', I.paintCan], ['kibble', (c) => I.kibble(c, { seed: 2 })], ['firework', (c) => I.fireworkRocket(c, { lit: 1, t: T })]];
  s1.forEach(([l, f], i) => { const x = 110 + i * 60, y = 300; at(ctx, x, y, 0.4, f); label(ctx, l, x, 360, 12); });
  at(ctx, 190, 500, 0.4, (c) => I.stepladder(c)); label(ctx, 'ladder', 190, 510, 12);
  at(ctx, 1080, 330, 0.4, (c) => I.flag(c, { t: T })); label(ctx, 'flag', 1100, 380, 13);
  at(ctx, 1200, 360, 0.4, (c) => I.net(c, { t: T })); label(ctx, 'net', 1210, 390, 13);
  at(ctx, 1380, 200, 0.4, (c) => I.blueprint(c, { title: 'S.S. BISCUIT — TAKE 2!' })); label(ctx, 'blueprint', 1380, 320, 13);
  at(ctx, 1560, 250, 0.4, (c) => I.clapperboard(c, { clap: 1 })); label(ctx, 'clapper', 1560, 320, 13);
  at(ctx, 1720, 250, 0.4, (c) => I.blueprint(c, { open: 0 })); label(ctx, 'scroll', 1720, 320, 13);
  // life-size row
  at(ctx, 1080, 520, 1, (c) => I.hammer(c)); at(ctx, 1200, 520, 1, (c) => I.remote(c)); at(ctx, 1300, 500, 1, (c) => I.trafficCone(c));
  at(ctx, 1450, 470, 1, (c) => I.sunglasses(c)); at(ctx, 1620, 470, 1, (c) => I.bone(c)); at(ctx, 1800, 450, 1, (c) => I.nailBox(c));
});

// new props: stepladder (s04 bar 10), paintCan (s04), kibble (s09), fireworkRocket (s19)
if (want('new')) await sheet('sheets/items_new.png', 1920, 1200, (ctx) => {
  const T2 = barTime(10, 0.1);
  // --- stepladder
  const lad = [['stepladder h170', {}], ['h 220 splat 0', { h: 220, splat: 0 }], ['teal, paint teal', { color: '#5fb8c9', paint: '#2ec4b6', h: 150 }]];
  lad.forEach(([l, o], i) => { const x = 110 + i * 200, y = 470; at(ctx, x, y, 1, (c) => I.stepladder(c, o)); cross(ctx, x, y); cross(ctx, x, y - (o.h || 170)); label(ctx, l, x, 490, 18); });
  // Juno (s=1) standing on the ladder, painting (scale check)
  { const x = 760, y = 560, s = 0.9;
    at(ctx, x, y, s, (c) => I.stepladder(c, {}));
    drawGirl(ctx, x, y - 170 * s, s, { t: T2, facing: 1, stance: 'stand', expr: 'determined', armR: 'forward', holdR: (c) => { c.save(); c.rotate(-Math.PI / 2); I.paintbrush(c, { drip: 0.3 }); c.restore(); } });
    label(ctx, 'Juno s.9 on ladder s.9', x, 575, 18); }
  // --- paint can
  const cans = [['paintCan', {}], ['teal', { color: '#2ec4b6' }], ['splash .25', { splash: 0.25 }], ['splash .55', { splash: 0.55 }],
    ['tipped .45', { tipped: 0.45 }], ['tipped 1', { tipped: 1 }]];
  cans.forEach(([l, o], i) => { const x = 990 + i * 136, y = 250; at(ctx, x, y, 1.3, (c) => I.paintCan(c, o)); cross(ctx, x, y); label(ctx, l, x + (i === 5 ? 60 : 0), 270, 18); });
  // Biscuit stepping in the can (scale check)
  { const x = 1180, y = 540, s = 0.9;
    drawDog(ctx, x, y, s, { t: T2, facing: 1, stance: 'stand', expr: 'happy', tongue: 1 });
    at(ctx, x + 120, y, s, (c) => I.paintCan(c, { splash: 0.3 }));
    label(ctx, 'Biscuit s.9 + can s.9', x + 60, 560, 18);
    at(ctx, 1560, 540, s, (c) => I.paintCan(c, { tipped: 1, color: '#2ec4b6' })); label(ctx, 'tipped 1 s.9', 1600, 560, 18); }
  // --- kibble
  for (let i = 0; i < 10; i++) { const x = 90 + i * 60, y = 680; at(ctx, x, y, 1, (c) => I.kibble(c, { seed: i + 1 })); }
  label(ctx, 'kibble r14 seeds 1..10', 360, 710, 18);
  for (let i = 0; i < 5; i++) { const x = 110 + i * 120, y = 820; at(ctx, x, y, 1, (c) => I.kibble(c, { r: 42, seed: [1, 4, 5, 8, 2][i], rot: i * 0.4 })); }
  label(ctx, 'kibble r42 (detail)', 360, 880, 18);
  for (let i = 0; i < 12; i++) { const x = 70 + i * 45, y = 960; at(ctx, x, y, 0.5, (c) => I.kibble(c, { seed: i + 20 })); }
  label(ctx, 'kibble at s .5 (cabin scale)', 360, 985, 18);
  // --- firework rocket (on a night-sky panel: it's for s19)
  ctx.fillStyle = '#1b2a5c'; ctx.beginPath(); ctx.roundRect(740, 620, 1170, 570, 18); ctx.fill();
  const fw = [['unlit', { lit: 0 }], ['lit .12 (fuse)', { lit: 0.12 }], ['lit .25', { lit: 0.25 }], ['lit .45', { lit: 0.45 }], ['lit 1', { lit: 1 }]];
  fw.forEach(([l, o], i) => { const x = 820 + i * 150, y = 900; at(ctx, x, y, 1.4, (c) => I.fireworkRocket(c, { t: T2 + i * 0.07, ...o })); cross(ctx, x, y); lab2(ctx, l, x, 1150); });
  // in flight (rotated), at yard scale
  at(ctx, 1640, 1100, 0.6, (c) => { c.rotate(0.35); I.fireworkRocket(c, { t: T2, lit: 1, trail: 420 }); });
  at(ctx, 1820, 1100, 0.45, (c) => { c.rotate(-0.2); I.fireworkRocket(c, { t: T2 + 0.3, lit: 0.8 }); });
  ctx.save(); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Arial Rounded MT Bold"'; ctx.fillText('in flight s .6 / .45', 1640, 1170); ctx.restore();
}, { bg: '#dfe7ef' });
