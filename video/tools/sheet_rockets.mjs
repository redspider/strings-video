// Rockets sheets: node tools/sheet_rockets.mjs [name]  → sheets/rockets_*.png
//   test debris build hero hatch flight fx flame small gantry airliner night lw
import { sheet, label as label0 } from './sheetkit.mjs';
import {
  drawTestRocket, drawTestDebris, drawRocket, drawFlame, drawBooster, drawGantry, gantryRungs, drawAirliner,
  ROCKET_HEIGHT, BOOSTER_HEIGHT, TEST_ROCKET_HEIGHT, ROCKET_HATCH, TEST_DEBRIS_KINDS,
} from '../src/props/rockets.js';
import { drawGirl } from '../src/characters/girl.js';
import { drawDog } from '../src/characters/dog.js';
import { drawBackyard, BACKYARD } from '../src/props/backyard.js';
import * as BY from '../src/props/backyard.js';
import { vGradient, starfield, camera } from '../src/draw.js';
import * as IT from '../src/props/items.js';

const only = process.argv[2];
// label on a pale pill so it reads on dark backgrounds too
function label(ctx, text, x, y, size = 22) {
  ctx.save();
  ctx.font = `bold ${size}px "Arial Rounded MT Bold"`;
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 3, w, size + 8, 8); ctx.fill();
  ctx.restore();
  label0(ctx, text, x, y, size);
}
const want = (n) => !only || only === n;
const ground = (ctx, y, x0 = 0, w = 1920) => { ctx.fillStyle = '#b9c9a8'; ctx.fillRect(x0, y, w, 1080 - y); };
const space = (ctx, x, y, w, h, seed = 3) => {
  vGradient(ctx, [[0, '#0e0b26'], [1, '#2a1f5c']], x, y, w, h);
  starfield(ctx, { x0: x, y0: y, w, h, count: Math.round((w * h) / 9000), seed, t: 20 });
};
const dashedBox = (ctx, x, y, w, h, col = '#33e6ff') => {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([8, 6]); ctx.strokeRect(x, y, w, h); ctx.restore();
};
// time-of-day tints (use the backyard's export when it exists)
const TINTS = {
  night: { mul: '#6a7cc6', add: '#1c2764', addAmt: 0.14, k: 1 },
  dusk: { mul: '#d9b6df', add: '#4a3a8a', addAmt: 0.1, k: 1 },
  golden: { mul: '#ffe6c8', add: '#ff9a55', addAmt: 0.07, k: 1 },
};
const tint = (tod) => (typeof BY.todTint === 'function' ? BY.todTint(tod) : TINTS[tod]);

// ---------------------------------------------------------------- test rocket
if (want('test')) await sheet('sheets/rockets_test.png', 1920, 1080, (ctx) => {
  ground(ctx, 470);
  const s = 1.0;
  const row1 = [
    ['plain', {}],
    ['flame .4 t=4.10', { t: 4.1, flame: 0.4 }],
    ['flame 1 t=4.22', { t: 4.22, flame: 1 }],
    ['flame 1 t=4.37', { t: 4.37, flame: 1 }],
    ['flame 1 t=4.55', { t: 4.55, flame: 1 }],
    ['flame 1 t=4.80', { t: 4.8, flame: 1 }],
  ];
  row1.forEach(([n, o], i) => {
    const x = 170 + i * 316;
    drawTestRocket(ctx, x, 440, s, o);
    label(ctx, n, x, 10);
  });
  // height ruler for the first one
  ctx.save(); ctx.strokeStyle = '#ff2255'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(40, 440); ctx.lineTo(40, 440 - TEST_ROCKET_HEIGHT); ctx.lineTo(300, 440 - TEST_ROCKET_HEIGHT); ctx.stroke(); ctx.restore();
  label(ctx, `TEST_ROCKET_HEIGHT ${TEST_ROCKET_HEIGHT}`, 150, 440 - TEST_ROCKET_HEIGHT - 32, 16);
  const row2 = [
    ['wobble 1 t=4.3', { t: 4.3, wobble: 1, flame: 1 }],
    ['wobble 1 t=4.6', { t: 4.6, wobble: 1, flame: 1 }],
    ['wobble .5 t=3.5', { t: 3.5, wobble: 0.5 }],
    ['charred .5', { t: 6, charred: 0.5 }],
    ['charred 1', { t: 6.2, charred: 1 }],
    ['shake 1', { t: 3.3, shake: 1 }],
  ];
  row2.forEach(([n, o], i) => {
    const x = 170 + i * 316;
    drawTestRocket(ctx, x, 910, s, o);
    label(ctx, n, x, 490);
  });
  // small versions as in the wide shot, next to Juno for scale
  drawGirl(ctx, 1370, 1070, 0.42, { t: 4.4, expr: 'determined', goggles: 'eyes' });
  [0.42, 0.3].forEach((ss, i) => drawTestRocket(ctx, 1500 + i * 150, 1070, ss, { t: 4.4, flame: i === 0 ? 1 : 0 }));
  drawTestRocket(ctx, 1820, 1070, 0.42, { t: 4.4, light: tint('night') });
  label(ctx, 'Juno .42 | TR .42 flame | .3 | .42 night', 1600, 925, 18);
});

// ---------------------------------------------------------------- debris
if (want('debris')) await sheet('sheets/rockets_debris.png', 1920, 1080, (ctx) => {
  vGradient(ctx, [[0, '#ffc98a'], [1, '#e8789f']], 0, 0, 1920, 1080);
  const kinds = TEST_DEBRIS_KINDS;
  const s = 1.4;
  kinds.forEach((k, i) => {
    const x = 160 + i * 320;
    drawTestDebris(ctx, k, x, 190, s, {});
    drawTestDebris(ctx, k, x, 470, s, { rot: 0.9, charred: 0.6 });
    drawTestDebris(ctx, k, x, 740, s, { rot: -2.2, charred: 1 });
    label(ctx, `'${k}'`, x, 20);
  });
  label(ctx, 'charred 0, rot 0', 960, 318, 18);
  label(ctx, 'charred .6, rot .9', 960, 590, 18);
  label(ctx, 'charred 1, rot -2.2', 960, 858, 18);
  // at wide-shot scale next to the test rocket (s = .42)
  ctx.fillStyle = '#9fcf7c'; ctx.fillRect(0, 900, 1920, 180);
  drawTestRocket(ctx, 200, 1060, 0.42, { t: 4.5 });
  kinds.forEach((k, i) => drawTestDebris(ctx, k, 400 + i * 150, 1000, 0.42, { rot: i * 0.7, charred: 0.8 }));
  label(ctx, 'wide-shot scale .42 (next to the intact rocket)', 900, 910, 18);
});

// ---------------------------------------------------------------- build stages
if (want('build')) await sheet('sheets/rockets_build.png', 1920, 1080, (ctx) => {
  const s = 0.66;
  const items = [
    ['frame', { build: 'frame' }],
    ['panels', { build: 'panels' }],
    ['painted paint 0', { build: 'painted', paint: 0 }],
    ['painted .2', { build: 'painted', paint: 0.2 }],
    ['painted .5', { build: 'painted', paint: 0.5 }],
    ['painted .85', { build: 'painted', paint: 0.85 }],
    ['painted 1', { build: 'painted', paint: 1 }],
    ['done + stickers', { build: 'done', stickers: true }],
  ];
  items.forEach(([n, o], i) => {
    const x = 240 + (i % 4) * 480, y = i < 4 ? 520 : 1060;
    drawRocket(ctx, x, y, s, { t: 25, ...o });
    label(ctx, n, x, y - 510);
  });
});

// ---------------------------------------------------------------- hero / detail crop
if (want('hero')) await sheet('sheets/rockets_hero.png', 1920, 1080, (ctx) => {
  ground(ctx, 1040);
  drawRocket(ctx, 380, 1040, 1.38, { t: 30, stickers: true });
  drawRocket(ctx, 1000, 1040, 1.38, { t: 30, crew: true, hatch: 1, crewPose: { girl: { expr: 'grin' }, dog: { expr: 'happy' } } });
  // zoomed crop of the porthole area
  ctx.save();
  ctx.beginPath(); ctx.rect(1330, 20, 570, 1000); ctx.clip();
  ctx.fillStyle = '#dfe7ef'; ctx.fillRect(1330, 20, 570, 1000);
  drawRocket(ctx, 1640, 1900, 2.6, { t: 30, crew: true, stickers: true });
  ctx.restore();
  label(ctx, 'done + stickers', 380, 20);
  label(ctx, 'crew + hatch 1', 1000, 20);
  label(ctx, 'zoom 2.6x', 1615, 26);
});

// ---------------------------------------------------------------- hatch + doorway content
if (want('hatch')) await sheet('sheets/rockets_hatch.png', 1920, 1080, (ctx) => {
  space(ctx, 0, 0, 1920, 1080, 12);
  const s = 1.0, yB = 800; // the upper hull, door centred in the top row
  const H = ROCKET_HATCH;
  const cols = [
    ['hatch 0', { hatch: 0 }],
    ['hatch .35', { hatch: 0.35 }],
    ['hatch .7', { hatch: 0.7 }],
    ['hatch 1 + Juno (no helmet)', { hatch: 1, hatchContent: (c) => drawGirl(c, H.x, H.sillY, 0.5, { t: 35.5, suit: 'space', expr: 'grin', armR: 'wave' }) }],
    ['Juno helmet, frame "sill"', { hatch: 1, hatchFrame: 'sill', hatchContent: (c) => drawGirl(c, H.x, H.sillY, 0.5, { t: 35.5, suit: 'space', helmet: 1, expr: 'excited', armR: 'wave' }) }],
  ];
  cols.forEach(([n, o], i) => {
    const x = 190 + i * 385;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 192, 0, 384, 550); ctx.clip();
    drawRocket(ctx, x - 40, yB, s, { t: 35.5, ...o });
    ctx.restore();
    label(ctx, n, x, 10, 18);
  });
  // clear-opening box (ROCKET_HATCH) on the first one
  dashedBox(ctx, 190 - 40 + (H.x - H.w / 2) * s, yB + H.topY * s, H.w * s, H.h * s);
  // second row: Biscuit in the doorway, hatchClip, hatchFront (net over the leaf), small scale
  const y2 = 1080 + 980;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 560, 1920, 520); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 560, 1920, 520);
  ctx.restore();
  const row2 = [
    ['Biscuit in doorway', { hatch: 1, hatchContent: (c) => drawDog(c, H.x, H.sillY, 0.5, { t: 70, stance: 'stand', suit: 'space', helmet: 1, expr: 'excited', facing: 1 }) }],
    ['hatchClip (inside)', { hatch: 1, hatchClip: true, hatchContent: (c) => drawGirl(c, H.x - 6, H.sillY + 30, 0.5, { t: 70, suit: 'space', helmet: 1, expr: 'awe', armL: 'up' }) }],
    ['hatchFront: net swing (s14)', { hatch: 1, hatchFront: (c) => drawGirl(c, H.x + 6, H.sillY, 0.5, { t: 87, suit: 'space', helmet: 1, expr: 'determined', tilt: 0.3, armR: { a: 2.2, b: -0.3 },
      holdR: (cc) => { cc.save(); cc.rotate(-0.4); cc.scale(0.6, 0.6); IT.net(cc, { t: 87, swing: 1 }); cc.restore(); } }) }],
  ];
  row2.forEach(([n, o], i) => {
    const x = 200 + i * 420;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 210, 560, 420, 520); ctx.clip();
    drawRocket(ctx, x - 40, y2 - 900, 0.85, { t: 70, ...o });
    ctx.restore();
    label(ctx, n, x, 566, 18);
  });
  // small: rocket at .42 (yard wides) hatch 1 with Juno .21 in the door
  ctx.save(); ctx.beginPath(); ctx.rect(1260, 560, 660, 520); ctx.clip();
  ctx.fillStyle = '#8fc56d'; ctx.fillRect(1260, 1010, 660, 70);
  drawRocket(ctx, 1450, 1030, 0.6, { t: 118, hatch: 1, legs: 1, hatchContent: (c) => drawGirl(c, H.x, H.sillY, 0.5, { t: 118, suit: 'space', expr: 'happy', armR: 'wave' }) });
  drawRocket(ctx, 1760, 1030, 0.42, { t: 118, hatch: 1, hatchContent: (c) => drawDog(c, H.x, H.sillY, 0.5, { t: 118, stance: 'sit', suit: 'space', expr: 'happy' }) });
  ctx.restore();
  label(ctx, 's .6 legs + Juno | s .42 + Biscuit', 1590, 566, 18);
});

// ---------------------------------------------------------------- flight: booster, flames, separation
if (want('flight')) await sheet('sheets/rockets_flight.png', 1920, 1080, (ctx) => {
  space(ctx, 0, 0, 1920, 1080);
  const s = 0.42;
  const items = [
    ['booster, flame t=38.6', { t: 38.6, booster: true, flame: 1 }],
    ['booster, flame t=38.75', { t: 38.75, booster: true, flame: 1 }],
    ['sep 60', { t: 48.2, booster: true, boosterOffset: 60, boosterRot: 0.05, flame: 0 }],
    ['sep 180 + main flame .6', { t: 48.5, booster: true, boosterOffset: 180, boosterRot: 0.25, flame: 0.6 }],
    ['sep 420 tumbling', { t: 48.9, booster: true, boosterOffset: 420, boosterRot: 0.9, flame: 1 }],
  ];
  items.forEach(([n, o], i) => {
    const x = 190 + i * 385;
    drawRocket(ctx, x, 360, s, o);
    label(ctx, n, x, 8);
  });
  // flame at several t (main engine)
  [50.0, 50.1, 50.2, 50.3].forEach((t, i) => {
    const x = 110 + i * 170;
    drawRocket(ctx, x, 860, 0.26, { t, flame: 1 });
  });
  label(ctx, 'main flame t = 50.0 / 50.1 / 50.2 / 50.3', 360, 650);
  // rotated in-flight versions
  ctx.save();
  ctx.translate(1000, 860); ctx.rotate(0.95);
  drawRocket(ctx, 0, 150, 0.36, { t: 60.3, flame: 1, crew: true });
  ctx.restore();
  drawRocket(ctx, 1330, 900, 0.32, { t: 61, flame: 0.8, rot: -0.6 });
  label(ctx, 'rotated (ctx) / o.rot', 1150, 650);
  drawBooster(ctx, 1560, 700, 0.42, { t: 50, rot: 2.2, flame: 0 });
  label(ctx, 'drawBooster rot 2.2', 1600, 650);
  // tiny
  drawRocket(ctx, 1790, 1050, 0.15, { t: 62, flame: 1 });
  drawRocket(ctx, 1870, 1050, 0.15, { crew: true });
  label(ctx, 's = 0.15', 1830, 860);
});

// ---------------------------------------------------------------- fx: hatch, crew, glow, chutes, legs
if (want('fx')) await sheet('sheets/rockets_fx.png', 1920, 1080, (ctx) => {
  vGradient(ctx, [[0, '#7ec8f0'], [1, '#bfe6ff']], 0, 0, 1920, 540);
  space(ctx, 0, 540, 1920, 540, 9);
  const s = 0.33;
  const top = [
    ['chute 0', { chute: 0 }],
    ['hatch .3', { hatch: 0.3 }],
    ['hatch .6', { hatch: 0.6 }],
    ['hatch 1 crew', { hatch: 1, crew: true }],
    ['chute .2', { chute: 0.2 }],
    ['chute .6', { chute: 0.6 }],
    ['chute 1', { chute: 1 }],
    ['legs .5', { legs: 0.5 }],
    ['legs 1', { legs: 1 }],
  ];
  top.forEach(([n, o], i) => {
    const x = 100 + i * 215;
    drawRocket(ctx, x, 520, s, { t: 115, ...o });
    label(ctx, n, x, 10, 18);
  });
  const bot = [
    ['glow .3', { glow: 0.3 }],
    ['glow .7', { glow: 0.7 }],
    ['glow 1', { glow: 1 }],
    ['glow 1 + shake', { glow: 1, shake: 1 }],
    ['chute 1 + legs 1', { chute: 1, legs: 1, crew: true }],
  ];
  bot.forEach(([n, o], i) => {
    const x = 170 + i * 380;
    ctx.save();
    // tail-first re-entry: rotated 180 for the glow shots
    if (n.startsWith('glow')) { ctx.translate(x, 700); ctx.rotate(Math.PI); drawRocket(ctx, 0, -120, s, { t: 113.3, ...o }); }
    else drawRocket(ctx, x, 1060, s * 0.72, { t: 116, ...o });
    ctx.restore();
    label(ctx, n, x, 548, 18);
  });
});

// ---------------------------------------------------------------- flames
if (want('flame')) await sheet('sheets/rockets_flame.png', 1920, 1080, (ctx) => {
  vGradient(ctx, [[0, '#231a4f'], [1, '#0e0b26']]);
  [0, 0.08, 0.16, 0.24, 0.32, 0.4].forEach((dt, i) => {
    drawFlame(ctx, 160 + i * 300, 60, 380, 130, 20 + dt);
    drawFlame(ctx, 160 + i * 300, 560, 300, 110, 20 + dt, { color: 'blue' });
  });
  label(ctx, 'normal flame (t +0.08 steps)', 960, 20);
  label(ctx, 'blue flame', 960, 520);
});

// ---------------------------------------------------------------- tiny
if (want('small')) await sheet('sheets/rockets_small.png', 1920, 1080, (ctx) => {
  space(ctx, 0, 0, 1920, 1080, 4);
  const ss = [0.1, 0.15, 0.2, 0.3];
  ss.forEach((s, i) => {
    drawRocket(ctx, 200 + i * 260, 500, s, { t: 50, flame: 1 });
    drawRocket(ctx, 200 + i * 260, 950, s, { t: 50, crew: true, chute: 1 });
    drawTestRocket(ctx, 1400 + i * 120, 500, s * 1.5, { t: 4.4, flame: 1 });
    drawAirliner(ctx, 1500, 700 + i * 90, s * 0.9, { t: 44, face: i / 3, contrail: 700 });
    label(ctx, `s=${s}`, 200 + i * 260, 20);
  });
});

// ---------------------------------------------------------------- outline floor at yard scale
if (want('lw')) await sheet('sheets/rockets_lw.png', 1920, 1080, (ctx) => {
  const t = 27.6;
  const CS = 0.42, RS = 0.84;
  const cam = { x: 1180, y: 540, zoom: 0.86 };
  camera(ctx, cam, () => {
    drawBackyard(ctx, { t, tod: 'golden', pad: 'intact', camX: cam.x, camY: cam.y });
    drawTestRocket(ctx, BACKYARD.padX, BACKYARD.padTop, CS, { t });
    drawRocket(ctx, 1830, BACKYARD.groundY - 20, RS, { t, stickers: true });
    drawGirl(ctx, 1560, BACKYARD.groundY + 10, CS, { t, facing: -1, expr: 'grin', armR: 'point' });
    drawDog(ctx, 1660, BACKYARD.groundY + 10, CS, { t, facing: -1, stance: 'sit', expr: 'happy' });
    drawGirl(ctx, 1000, BACKYARD.groundY + 10, CS, { t, facing: 1, expr: 'happy' });
    drawTestDebris(ctx, 'fin', 900, 720, CS, { rot: 0.6, charred: 0.8 });
    drawTestDebris(ctx, 'tape', 980, 640, CS, { rot: 0.6, charred: 0.5 });
  });
  label(ctx, `outline floor at yard scale: chars ${CS}, test rocket ${CS} (x1.35 internal), S.S.B. ${RS}, camera zoom ${cam.zoom}`, 960, 12, 20);
  // zoomed crop of the pad area at 3x to inspect line weights against the crates/fence
  ctx.save();
  ctx.beginPath(); ctx.rect(1420, 640, 480, 420); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(1420, 640, 480, 420);
  camera(ctx, { x: BACKYARD.padX, y: BACKYARD.padTop - 60, zoom: 0.86 * 2.2, dx: 700, dy: 310 }, () => {
    drawBackyard(ctx, { t, tod: 'golden', pad: 'intact', camX: BACKYARD.padX, camY: 700 });
    drawTestRocket(ctx, BACKYARD.padX, BACKYARD.padTop, CS, { t });
    drawGirl(ctx, BACKYARD.padX - 200, BACKYARD.groundY + 10, CS, { t, facing: 1, expr: 'happy' });
  });
  ctx.restore();
  ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(1420, 640, 480, 420); ctx.restore();
});

// ---------------------------------------------------------------- gantry (s05)
if (want('gantry')) await sheet('sheets/rockets_gantry.png', 1920, 1080, (ctx) => {
  const t = 34.1;
  vGradient(ctx, [[0, '#e8789f'], [0.6, '#ffc98a'], [1, '#ffe3a3']], 0, 0, 1920, 1080);
  ctx.fillStyle = '#72c35a'; ctx.fillRect(0, 1000, 1920, 80);
  // main: rocket + booster on the ground at the contract scale (.84), gantry, Juno climbing
  const RS = 0.84, CS = 0.42;
  const rx = 520, gy = 1000, ry = gy - 216 * RS;
  const G = gantryRungs(RS);
  drawGantry(ctx, rx, ry, RS, { t });
  drawRocket(ctx, rx, ry, RS, { t, booster: true, hatch: 1 });
  // Juno on rung 6, seen from behind, Biscuit tucked under her arm
  const k = 6;
  drawGirl(ctx, rx + G.x, ry + G.rungs[k], CS, { t, view: 'back', stance: 'stand', suit: 'space', helmet: 1, armL: 'up', armR: 'hold' });
  // rung markers
  ctx.save(); ctx.fillStyle = '#ff2255';
  G.rungs.forEach((r, i) => { ctx.beginPath(); ctx.arc(rx + G.x + G.ladderW / 2 + 16, ry + r, 4, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
  label(ctx, `swing 0 · ${G.rungs.length} rungs, spacing ${G.spacing.toFixed(1)} px · platform = hatch sill`, 620, 10, 18);
  // swing states
  [[0.5, 1100], [1, 1440]].forEach(([sw, x]) => {
    const s2 = RS * 0.62, y2 = gy - 216 * s2;
    drawGantry(ctx, x, y2, s2, { t: t + sw, swing: sw });
    drawRocket(ctx, x, y2 - (sw > 0.9 ? 60 : 0), s2, { t, booster: true, flame: sw > 0.9 ? 1 : 0 });
    label(ctx, `swing ${sw}${sw > 0.9 ? ' + liftoff' : ''}`, x + 100, 10, 18);
  });
  // small (wide-shot) version on a backyard ground strip
  drawGantry(ctx, 1770, 1000 - 216 * 0.3, 0.3, { t: t + 0.3 });
  drawRocket(ctx, 1770, 1000 - 216 * 0.3, 0.3, { t, booster: true });
  label(ctx, 's .3', 1810, 640, 18);
});

// ---------------------------------------------------------------- airliner (s08)
if (want('airliner')) await sheet('sheets/rockets_airliner.png', 1920, 1080, (ctx) => {
  vGradient(ctx, [[0, '#3a3f9e'], [0.6, '#5f86d6'], [1, '#9fd0f5']], 0, 0, 1920, 1080);
  drawAirliner(ctx, 1400, 170, 1.0, { t: 43.4, face: 0, contrail: 1100 });
  label(ctx, 'face 0 (dozing), s 1, contrail 1100', 1400, 12, 18);
  drawAirliner(ctx, 560, 470, 1.0, { t: 43.9, face: 1, facing: -1, contrail: 900 });
  label(ctx, 'face 1, facing -1', 560, 312, 18);
  // face pop sequence, zoomed on the passenger window
  const fs = [0, 0.15, 0.3, 0.5, 0.75, 1];
  fs.forEach((f, i) => {
    const cx = 1080 + (i % 3) * 280, cy = 420 + Math.floor(i / 3) * 260;
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx - 130, cy - 110, 260, 220, 14); ctx.clip();
    drawAirliner(ctx, cx - 150 * 4.2, cy + 12 * 4.2, 4.2, { t: 44, face: f, contrail: 0 });
    ctx.restore();
    label(ctx, `face ${f}`, cx, cy + 116, 16);
  });
  // wide-shot sizes
  drawAirliner(ctx, 300, 900, 0.5, { t: 44.2, face: 1, contrail: 800 });
  drawAirliner(ctx, 800, 960, 0.3, { t: 44.2, face: 1, contrail: 800 });
  drawAirliner(ctx, 1200, 1000, 0.18, { t: 44.2, contrail: 800 });
  label(ctx, 's .5 / .3 / .18', 700, 1040, 16);
});

// ---------------------------------------------------------------- night tint
if (want('night')) await sheet('sheets/rockets_night.png', 1920, 1080, (ctx) => {
  const t = 118.3;
  const cam = { x: 1000, y: 560, zoom: 0.8 };
  const L = tint('night');
  camera(ctx, cam, () => {
    drawBackyard(ctx, { t, tod: 'night', pad: 'wrecked', crater: true, craterSmoke: 0, camX: cam.x, camY: cam.y });
    drawRocket(ctx, 1560, BACKYARD.groundY + 10, 0.8, { t, legs: 1, hatch: 1, chute: 0.7, light: L });
    drawRocket(ctx, 350, BACKYARD.groundY + 10, 0.55, { t, light: null });
    drawTestDebris(ctx, 'fin', 1010, 850, 0.42, { rot: 1.4, charred: 1, light: L });
    drawTestDebris(ctx, 'can', 1180, 860, 0.42, { rot: 0.2, charred: 1, light: L });
  });
  label(ctx, 'night: right rocket o.light = night tint (chutes, hatch leaf tinted; doorway lit) · left rocket UNTINTED for comparison', 960, 12, 18);
  // tint strip: golden / dusk / night test rocket + booster
  const tods = [['none', null], ['golden', tint('golden')], ['dusk', tint('dusk')], ['night', tint('night')]];
  tods.forEach(([n, l], i) => {
    const x = 90 + i * 110;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 52, 800, 104, 270);
    drawTestRocket(ctx, x, 1060, 0.4, { t, light: l });
    drawBooster(ctx, x, 830, 0.3, { light: l });
    label(ctx, n, x, 806, 14);
  });
});
