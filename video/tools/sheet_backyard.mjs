// Backyard world sheets:  node tools/sheet_backyard.mjs [which ...]
//   which: tods states tall details lawn small misc anim workshop props  (default: all)
// Cast is drawn at the shared scale contract: characters s = 0.42, Test Rocket #1 s = 0.42 (it has
// its own internal 1.35x), S.S. Biscuit s = 0.84; characters get todTint() + longShadow().
import { sheet, label } from './sheetkit.mjs';
import {
  drawBackyard, drawLawnTopDown, drawGarageDoor, drawWorkshop, drawStepladder, drawPaintCan, drawBird,
  longShadow, todTint, tintColor, BACKYARD, WORKSHOP, STEPLADDER, PAINT_CAN,
} from '../src/props/backyard.js';
import { camera, W, H, INK } from '../src/draw.js';
import { barTime } from '../src/timing.js';

let girl = null, dog = null, rockets = null, items = null;
try { girl = await import('../src/characters/girl.js'); } catch (e) { console.warn('girl.js import failed', e.message); }
try { dog = await import('../src/characters/dog.js'); } catch (e) { console.warn('dog.js import failed', e.message); }
try { rockets = await import('../src/props/rockets.js'); } catch (e) { console.warn('rockets.js import failed', e.message); }
try { items = await import('../src/props/items.js'); } catch (e) { console.warn('items.js import failed', e.message); }
const safe = (fn) => { try { fn(); } catch (e) { console.warn('placeholder draw failed:', e.message); } };

const CS = 0.42, TRS = 0.42, RS = 0.84; // the scale contract
const GY = BACKYARD.groundY;
// Characters in the yard: long shadow first, then the tinted character.
const Juno = (ctx, x, o, pose = {}, s = CS) => safe(() => {
  longShadow(ctx, x, GY, 70 * s / 0.42, 176 * s / 0.42, o);
  girl.drawGirl(ctx, x, GY, s, { t: o.t, light: todTint(o.tod), ...pose });
});
const Bisc = (ctx, x, o, pose = {}, s = CS) => safe(() => {
  longShadow(ctx, x, GY, 80 * s / 0.42, 88 * s / 0.42, o);
  dog.drawDog(ctx, x, GY, s, { t: o.t, light: todTint(o.tod), ...pose });
});
const TestRocket = (ctx, o, ro = {}) => safe(() => {
  longShadow(ctx, BACKYARD.padX, BACKYARD.padTop, 60, 140, { ...o, contact: false });
  rockets.drawTestRocket(ctx, BACKYARD.padX, BACKYARD.padTop, TRS, { t: o.t, light: todTint(o.tod), ...ro });
});
const SSB = (ctx, x, y, o, ro = {}, s = RS) => safe(() => rockets.drawRocket(ctx, x, y, s, { t: o.t, light: todTint(o.tod), ...ro }));
const remote = (c) => { if (!items) return; c.save(); c.rotate(Math.PI / 2); c.scale(0.55, 0.55); items.remote(c, { pressed: 0 }); c.restore(); };

// Render a full 1920x1080 frame into the sheet at (ox, oy) with scale sc, through camera cam.
function frame(ctx, ox, oy, sc, fn, cam) {
  ctx.save();
  ctx.translate(ox, oy); ctx.scale(sc, sc);
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (cam) camera(ctx, cam, () => fn(ctx)); else fn(ctx);
  ctx.restore();
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, W * sc, H * sc); ctx.restore();
}
const withCam = (o, cam) => (cam ? { ...o, camX: cam.x, camY: cam.y } : o);

const only = process.argv.slice(2);
const want = (k) => only.length === 0 || only.includes(k);

// ---------------- 1. four times of day (2x2 at 0.5), each staged as its storyboard moment
if (want('tods')) await sheet('sheets/backyard_tods.png', 1940, 1150, (ctx) => {
  const sc = 0.5;
  const cells = [
    ['golden — s01 test launch (default camera)', null, { tod: 'golden', t: 1.2 }, (c, o) => {
      TestRocket(c, o); Juno(c, 600, o, { goggles: 'forehead', expr: 'determined', armR: { a: 1.2, b: -0.6 }, holdR: remote }); Bisc(c, 720, o, { stance: 'sit', expr: 'alert' });
    }],
    ['day — S.S. Biscuit + booster on the pad (zoom .78)', { x: 1080, y: 400, zoom: 0.78 }, { tod: 'day', t: 31.9, garageDoor: 1 }, (c, o) => {
      SSB(c, BACKYARD.padX, BACKYARD.padTop - 216 * RS, o, { booster: true, stickers: true }); Juno(c, 860, o, { suit: 'space', helmet: 1, expr: 'grin' }); Bisc(c, 980, o, { suit: 'space', helmet: 1, expr: 'happy' });
    }],
    ['dusk — s04 roll-out: rocket in the open workshop (zoom .8)', { x: 1560, y: 470, zoom: 0.8 }, { tod: 'dusk', t: 27.2, garageDoor: 0.8 }, (c, o) => {
      const d = BACKYARD.garageDoor;
      c.save(); c.beginPath(); c.rect(d.x0, d.top, d.x1 - d.x0, d.bottom - d.top); c.clip();
      SSB(c, (d.x0 + d.x1) / 2, d.bottom - 6, o);
      c.restore();
      drawGarageDoor(c, o);
      Juno(c, 1430, o, { facing: 1, expr: 'excited', armR: 'cheer' }); Bisc(c, 1330, o, { facing: 1, stance: 'sit', expr: 'excited' });
    }],
    ['night — s19 landed by the old crater (zoom .8)', { x: 1000, y: 560, zoom: 0.8 }, { tod: 'night', t: 118.3, crater: true, craterSmoke: 0, pad: 'wrecked' }, (c, o) => {
      longShadow(c, 1560, GY + 10, 380, 600, o);
      SSB(c, 1560, GY + 10, o, { legs: 1, hatch: 1 }); Juno(c, 900, o, { suit: 'space', expr: 'awe', look: [0.3, -1] }); Bisc(c, 1030, o, { suit: 'space', stance: 'sit', facing: -1, look: [0, -1] });
    }],
  ];
  cells.forEach(([name, cam, o0, extra], i) => {
    const ox = 10 + (i % 2) * 970, oy = 10 + Math.floor(i / 2) * 570;
    const o = withCam(o0, cam);
    frame(ctx, ox, oy, sc, (c) => { drawBackyard(c, o); extra(c, o); }, cam);
    label(ctx, name, ox + 480, oy + 544, 20);
  });
});

// ---------------- 2. states: wrecked pad + crater, liftoff chaos, silhouettes, parallax
if (want('states')) await sheet('sheets/backyard_states.png', 1940, 1720, (ctx) => {
  const sc = 0.5;
  const cells = [
    ['s02: wrecked pad + crater + embers (zoom 1.45)', { x: 980, y: 660, zoom: 1.45 }, { tod: 'golden', t: 8.3, pad: 'wrecked', crater: true, craterSmoke: 0.6, embers: 0.8 }, (c, o) => {
      Juno(c, 820, o, { soot: 1, frizz: 1, goggles: 'askew', expr: 'dazed' }, 0.62); Bisc(c, 1010, o, { soot: 1, frizz: 1, stance: 'sit', facing: -1, expr: 'dazed' }, 0.62);
    }],
    ['s07 liftoff: fenceFlap 1, wind 1, gnome .55, birdsFly .3 (zoom .8)', { x: 1100, y: 500, zoom: 0.8 }, { tod: 'golden', t: 39.1, pad: 'none', crater: true, craterSmoke: 0, fenceFlap: 1, wind: 1, gnomeFall: 0.55, birdsFly: 0.3, garageDoor: 1 }, (c, o) => {
      SSB(c, BACKYARD.padX, GY - 160, o, { flame: 1, booster: true });
    }],
    ['s03 title card: silhouette 1 over the night sky (cam 800,250 zoom .8)', { x: 800, y: 250, zoom: 0.8 }, { tod: 'night', t: 18, silhouette: 1 }, () => {}],
    ['silhouette .5 + gnome fallen + door .5 (dusk)', null, { tod: 'dusk', t: 18, silhouette: 0.5, gnomeFall: 1, garageDoor: 0.5 }, () => {}],
    ['parallax camX 500 (zoom 1.2)', { x: 500, y: 560, zoom: 1.2 }, { tod: 'golden', t: 3 }, (c, o) => TestRocket(c, o)],
    ['parallax camX 1500 (zoom 1.2)', { x: 1500, y: 560, zoom: 1.2 }, { tod: 'golden', t: 3 }, (c, o) => TestRocket(c, o)],
  ];
  cells.forEach(([name, cam, o0, extra], i) => {
    const ox = 10 + (i % 2) * 970, oy = 10 + Math.floor(i / 2) * 570;
    const o = withCam(o0, cam);
    frame(ctx, ox, oy, sc, (c) => { drawBackyard(c, o); extra(c, o); }, cam);
    label(ctx, name, ox + 480, oy + 544, 20);
  });
});

// ---------------- 3. tall skyExtend renders (tilt-up), scaled down
if (want('tall')) await sheet('sheets/backyard_tall.png', 2300, 1080, (ctx) => {
  const ext = 4000;
  const x0 = -400, x1 = 2320, y0 = -ext, y1 = 1100;
  const sc = 1030 / (y1 - y0);
  const cw = (x1 - x0) * sc;
  ['golden', 'day', 'dusk', 'night'].forEach((tod, i) => {
    const ox = 20 + i * (cw + 20), oy = 10;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc); ctx.translate(-x0, -y0);
    ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    const o = { tod, t: 40, skyExtend: ext, pad: 'none', crater: tod !== 'day', craterSmoke: 0.5 };
    drawBackyard(ctx, o);
    SSB(ctx, BACKYARD.padX, -1400, o, { flame: 1 });
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 8; ctx.setLineDash([30, 20]);
    ctx.strokeRect(0, 0, 1920, 1080); ctx.strokeRect(0, -2000, 1920, 1080); ctx.setLineDash([]);
    ctx.restore();
    label(ctx, `${tod}  skyExtend ${ext}`, ox + cw / 2, oy + 1040 - 4, 18);
  });
});

// ---------------- 4. detail crops
if (want('details')) await sheet('sheets/backyard_details.png', 1960, 1960, (ctx) => {
  const crop = (ox, oy, w, h, cx, cy, z, o, name, extra) => {
    ctx.save(); ctx.translate(ox, oy); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
    drawBackyard(ctx, o); if (extra) extra(ctx, o);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, w, h);
    label(ctx, name, ox + w / 2, oy + h - 26, 18);
  };
  const g = { tod: 'golden', t: 2 };
  crop(10, 10, 640, 640, 150, 560, 1.0, g, 'house corner + tree + swing (golden)');
  crop(660, 10, 640, 640, 150, 560, 1.0, { tod: 'night', t: 118 }, 'same at night (lit windows)');
  crop(1310, 10, 640, 640, 0, 560, 0.72, { tod: 'golden', t: 39.3, wind: 1, fenceFlap: 1 }, 'wind 1 + fence flap (leaves blow)');
  crop(10, 660, 640, 640, 870, 740, 1.4, { ...g, t: 2.3 }, 'doghouse + flower bed + bowl + birds');
  crop(660, 660, 640, 640, 1300, 760, 1.25, g, 'intact pad + gnome (full-weight crates)', (c, o) => TestRocket(c, o));
  crop(1310, 660, 640, 640, 1260, 780, 1.1, { tod: 'golden', t: 8.4, pad: 'wrecked', crater: true, embers: 1 }, 'wrecked pad + crater + smoke + embers');
  crop(10, 1310, 640, 640, 1840, 380, 0.66, { tod: 'day', t: 27, garageDoor: 0 }, 'workshop barn closed (day)');
  crop(660, 1310, 640, 640, 1840, 380, 0.66, { tod: 'golden', t: 27.3, garageDoor: 0.6 }, 'barn door 0.6 (golden)');
  crop(1310, 1310, 640, 640, 1840, 380, 0.66, { tod: 'night', t: 27.3, garageDoor: 1 }, 'barn open, bulb + lantern (night)');
});

// ---------------- 5. top-down lawn
if (want('lawn')) await sheet('sheets/backyard_lawn.png', 1940, 1150, (ctx) => {
  frame(ctx, 10, 10, 0.5, (c) => {
    drawLawnTopDown(c, { t: 121.3 });
    safe(() => { c.save(); c.translate(820, 560); c.rotate(Math.PI / 2 - 0.05); girl.drawGirl(c, 0, 190, 0.9, { t: 121.3, stance: 'lie', expr: 'awe', look: [0, -1], light: todTint('night') }); c.restore(); });
    safe(() => { c.save(); c.translate(1120, 600); c.rotate(-0.2); dog.drawDog(c, 0, 60, 0.9, { t: 121.3, stance: 'lie', light: todTint('night') }); c.restore(); });
  });
  label(ctx, 'night (default blanket) + lying cast, night-tinted', 490, 554, 18);
  frame(ctx, 980, 10, 0.5, (c) => drawLawnTopDown(c, { t: 121.3, blanket: { x: 1000, y: 600, w: 1200, h: 720, rot: 0.12 } }));
  label(ctx, 'night, big blanket rot 0.12, t=121.3 (firefly flash)', 1460, 554, 18);
  frame(ctx, 10, 580, 0.5, (c) => drawLawnTopDown(c, { t: 30, tod: 'day' }));
  label(ctx, 'tod day', 490, 1124, 18);
  frame(ctx, 980, 580, 0.5, (c) => drawLawnTopDown(c, { t: 30, tod: 'golden', blanket: { rot: -0.3 } }));
  label(ctx, 'tod golden, rot -0.3', 1460, 1124, 18);
});

// ---------------- 6. small-scale versions (as in wide shots / transitions)
if (want('small')) await sheet('sheets/backyard_small.png', 1940, 590, (ctx) => {
  const sc = 0.24;
  const list = [
    ['golden', { tod: 'golden', t: 1 }], ['day', { tod: 'day', t: 30 }], ['dusk', { tod: 'dusk', t: 30 }], ['night', { tod: 'night', t: 118 }],
    ['wrecked', { tod: 'golden', t: 8, pad: 'wrecked', crater: true, embers: 1 }], ['liftoff', { tod: 'golden', t: 39, wind: 1, fenceFlap: 1, gnomeFall: 1, pad: 'none', birdsFly: 0.25 }],
    ['silhouette', { tod: 'night', t: 18, silhouette: 1 }], ['garage open', { tod: 'golden', t: 27, garageDoor: 1 }],
  ];
  list.forEach(([name, o], i) => {
    const ox = 10 + (i % 4) * 482, oy = 10 + Math.floor(i / 4) * 280;
    frame(ctx, ox, oy, sc, (c) => { drawBackyard(c, o); if (i < 4) { Juno(c, 600, o); Bisc(c, 700, o, { stance: 'sit' }); } });
    label(ctx, name, ox + 230, oy + 262, 16);
  });
});

// ---------------- 7. misc: windDir +1, sky:false, garage-door layering recipe, long shadows
if (want('misc')) await sheet('sheets/backyard_misc.png', 1940, 1150, (ctx) => {
  const sc = 0.5;
  frame(ctx, 10, 10, sc, (c) => drawBackyard(c, { tod: 'day', t: 39.4, wind: 0.8, windDir: 1, fenceFlap: 0.6, gnomeFall: 1, gnomeDir: -1 }));
  label(ctx, 'day: wind .8 windDir +1, fenceFlap .6, gnome falls left (gnomeDir -1)', 490, 554, 18);
  frame(ctx, 980, 10, sc, (c) => {
    c.fillStyle = '#231a4f'; c.fillRect(-2000, -2000, 6000, 6000);
    drawBackyard(c, { tod: 'night', t: 18, silhouette: 1, sky: false, garage: false });
  }, { x: 960, y: 420 });
  label(ctx, 'sky:false + garage:false + silhouette 1 (scene supplies sky)', 1460, 554, 18);
  // garage roll-out layering: backyard (door open, interior) -> rocket clipped to the door -> door on top
  frame(ctx, 10, 580, sc, (c) => {
    const d = BACKYARD.garageDoor, o = { tod: 'golden', t: 26.9, garageDoor: 0.45, camX: 1700, camY: 470 };
    drawBackyard(c, o);
    c.save(); c.beginPath(); c.rect(d.x0, d.top, d.x1 - d.x0, d.bottom - d.top); c.clip();
    SSB(c, (d.x0 + d.x1) / 2, d.bottom - 6, o);
    c.restore();
    drawGarageDoor(c, o);
    Juno(c, 1480, o, { facing: 1, expr: 'excited' });
  }, { x: 1700, y: 470, zoom: 1.0 });
  label(ctx, 'S.S.B. s=.84 inside: clip to BACKYARD.garageDoor, then drawGarageDoor()', 490, 1124, 18);
  frame(ctx, 980, 580, sc, (c) => {
    const o = { tod: 'golden', t: 2, camX: 1000, camY: 760 };
    drawBackyard(c, o); TestRocket(c, o); Juno(c, 820, o); Bisc(c, 930, o, { stance: 'sit' }); Juno(c, 1520, o, { facing: -1 }); Bisc(c, 1640, o, { facing: -1 });
  }, { x: 1000, y: 760, zoom: 1.5 });
  label(ctx, 'golden: longShadow() on the cast matches the set (zoom 1.5)', 1460, 1124, 18);
});

// ---------------- 8. animation strips (params over time)
if (want('anim')) await sheet('sheets/backyard_anim.png', 1940, 1560, (ctx) => {
  const cell = (ox, oy, w, h, cx, cy, z, o) => {
    ctx.save(); ctx.translate(ox, oy); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
    drawBackyard(ctx, o);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(ox, oy, w, h);
  };
  const W8 = 236, H8 = 220;
  const rows = [
    ['gnomeFall 0 .. 1 (outBounce)', (k) => ({ tod: 'golden', t: 2, gnomeFall: k / 7 }), 1470, 790, 1.1],
    ['garageDoor 0 .. 1 (11 panels roll up under the header)', (k) => ({ tod: 'dusk', t: 27 + k * 0.1, garageDoor: k / 7 }), 1840, 420, 0.24],
    ['beat strip: 8 frames over 2 beats (bar 12) — tufts / flowers / birds / swing', (k) => ({ tod: 'day', t: barTime(12) + k * 0.15 }), 690, 760, 1.0],
    ['fenceFlap 1 + wind 1, frames 1/15 s apart', (k) => ({ tod: 'golden', t: 39 + k / 15, fenceFlap: 1, wind: 1 }), 1000, 700, 0.55],
    ['birdsFly 0 .. 1 (beat-locked flaps, out-cubic arcs up + left)', (k) => ({ tod: 'golden', t: 39 + k * 0.12, birdsFly: k / 7, fenceFlap: 0.3 }), 620, 360, 0.28],
    ['night fireflies over 2 beats', (k) => ({ tod: 'night', t: barTime(49) + k * 0.15 }), 900, 780, 0.5],
  ];
  rows.forEach(([name, fn, cx, cy, z], r) => {
    const oy = 10 + r * 256;
    for (let k = 0; k < 8; k++) cell(10 + k * (W8 + 4), oy, W8, H8, cx, cy, z, fn(k));
    label(ctx, name, 970, oy + H8 + 4, 18);
  });
});

// ---------------- 9. workshop interior (s04)
if (want('workshop')) await sheet('sheets/backyard_workshop.png', 1940, 1720, (ctx) => {
  const sc = 0.5, WS = 0.45, F = WORKSHOP.floorY, BX = WORKSHOP.buildX;
  const Jw = (c, x, pose) => safe(() => girl.drawGirl(c, x, F, WS, pose));
  const Bw = (c, x, pose) => safe(() => dog.drawDog(c, x, F, WS, pose));
  const Rw = (c, t, ro) => safe(() => rockets.drawRocket(c, BX, F, 0.9, { t, ...ro }));
  const cells = [
    ['bar 8 hammering: build "frame", hook on the pegboard is empty', { t: barTime(8, 1) }, (c, t) => {
      Rw(c, t, { build: 'frame' });
      Jw(c, 700, { t, facing: 1, expr: 'determined', goggles: 'forehead', armR: { a: 2.3, b: -0.9 }, holdR: (h) => { if (items) { h.save(); h.rotate(Math.PI / 2); h.scale(0.6, 0.6); items.hammer(h, {}); h.restore(); } } });
      Bw(c, 1260, { t, facing: -1, stance: 'sit', holdMouth: (h) => { if (items) { h.save(); h.scale(0.5, 0.5); items.nailBox(h, {}); h.restore(); } } });
    }],
    ['bar 9 welding: flicker 1 (pulses with the beat)', { t: barTime(9, 1) + 0.03, flicker: 1 }, (c, t) => {
      Rw(c, t, { build: 'panels' });
      Jw(c, 700, { t, facing: 1, expr: 'determined', goggles: 'eyes', armR: { a: 1.6, b: -0.4 }, holdR: (h) => { if (items) { h.save(); h.scale(0.6, 0.6); items.weldTorch(h, { t, on: true }); h.restore(); } } });
      Bw(c, 1260, { t, facing: -1, stance: 'sit', expr: 'alert' });
    }],
    ['bar 10 painting: stepladder + paint can splash', { t: barTime(10, 3) + 0.1 }, (c, t) => {
      Rw(c, t, { build: 'painted', paint: 0.7 });
      drawStepladder(c, 660, F, WS);
      safe(() => girl.drawGirl(c, 660, F - STEPLADDER.steps[2] * WS, WS, { t, facing: 1, expr: 'grin', armR: 'reach', holdR: (h) => { if (items) { h.save(); h.scale(0.6, 0.6); items.paintbrush(h, { color: '#e8453c' }); h.restore(); } } }));
      drawPaintCan(c, 1270, F, WS * 1.3, { splash: 0.4 });
      Bw(c, 1340, { t, facing: -1, expr: 'excited' });
    }],
    ['bar 11: doorOpen .5 — golden yard glows in', { t: barTime(11) + 0.3, doorOpen: 0.5 }, (c, t) => { Rw(c, t, {}); Jw(c, 660, { t, facing: 1, expr: 'excited', armR: 'cheer' }); Bw(c, 1280, { t, facing: -1, expr: 'happy' }); }],
    ['doorOpen 1 (light shaft on the floor)', { t: barTime(11) + 0.8, doorOpen: 1 }, (c, t) => Rw(c, t, {})],
    ['bulb 0 (lights off)', { t: 20, bulb: 0 }, () => {}],
  ];
  cells.forEach(([name, o, extra], i) => {
    const ox = 10 + (i % 2) * 970, oy = 10 + Math.floor(i / 2) * 570;
    frame(ctx, ox, oy, sc, (c) => { drawWorkshop(c, o); extra(c, o.t); });
    label(ctx, name, ox + 480, oy + 544, 20);
  });
});

// ---------------- 10. props, tint grades, birds
if (want('props')) await sheet('sheets/backyard_props.png', 1940, 1400, (ctx) => {
  // (a) stepladder + paint cans
  ctx.fillStyle = '#efe6d8'; ctx.fillRect(10, 10, 1920, 430);
  drawStepladder(ctx, 150, 400, 1);
  drawStepladder(ctx, 380, 400, 0.6);
  safe(() => girl.drawGirl(ctx, 380, 400 - STEPLADDER.steps[1] * 0.6, 0.6, { t: 24.5, armR: 'up', expr: 'grin' }));
  drawStepladder(ctx, 560, 400, 0.6, { wobble: 1, t: 24.4, tod: 'golden' });
  drawPaintCan(ctx, 720, 400, 1);
  drawPaintCan(ctx, 830, 400, 1, { lid: 'on', color: '#2ec4b6' });
  drawPaintCan(ctx, 940, 400, 1, { color: '#fff1d6', drips: false });
  [0.1, 0.25, 0.45, 0.65, 0.85].forEach((u, i) => drawPaintCan(ctx, 1080 + i * 110, 400, 1, { splash: u }));
  drawPaintCan(ctx, 1680, 400, 0.6, { tod: 'night' });
  safe(() => dog.drawDog(ctx, 1830, 400, 0.45, { t: 25.9, facing: -1, expr: 'excited' }));
  label(ctx, 'drawStepladder (s 1 / Juno s .6 on tread 2 of a s .6 ladder / wobble, golden) · drawPaintCan (open, lid on, no drips, splash 0.1-0.85, night) · Biscuit s .45', 970, 412, 18);
  // (b) todTint grades: palette swatches + tinted cast on their own skies
  const tods = ['day', 'golden', 'dusk', 'night'];
  const sw = ['#e8453c', '#3f7fe8', '#f2c49b', '#fdf3e1', '#ffd23f', '#5cc26b', '#fff1d6', '#9aa3b5'];
  tods.forEach((tod, i) => {
    const ox = 10 + i * 482, oy = 450;
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, 472, 520); ctx.clip();
    ctx.translate(ox + 236, oy + 320); ctx.scale(0.55, 0.55); ctx.translate(-760, -GY + 140);
    drawBackyard(ctx, { tod, t: 2.4, garage: false, camX: 760, camY: GY - 140 });
    Juno(ctx, 700, { tod, t: 2.4, camX: 760, camY: GY - 140 }, { expr: 'happy' }, 0.8);
    Bisc(ctx, 880, { tod, t: 2.4, camX: 760, camY: GY - 140 }, { stance: 'sit', expr: 'happy' }, 0.8);
    ctx.restore();
    const T = todTint(tod);
    sw.forEach((c, k) => {
      ctx.fillStyle = c; ctx.fillRect(ox + 10 + k * 57, oy + 10, 26, 26);
      ctx.fillStyle = tintColor(c, T); ctx.fillRect(ox + 10 + k * 57 + 26, oy + 10, 26, 26);
    });
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(ox, oy, 472, 520);
    label(ctx, `${tod}: mul ${T.mul} add ${T.add} ${T.addAmt}`, ox + 236, oy + 492, 16);
  });
  label(ctx, 'todTint(tod) → girl/dog light param + tintColor swatches (left half raw, right half graded); longShadow under each', 970, 976, 18);
  // (c) drawBird: perched + flying flap cycle
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(10, 1010, 1920, 380);
  drawBird(ctx, 90, 1240, 2.5, { t: 2 });
  drawBird(ctx, 220, 1240, 2.5, { t: 2, facing: -1, tod: 'golden' });
  for (let k = 0; k < 8; k++) drawBird(ctx, 360 + k * 150, 1200 + (k % 2) * 30, 2.5, { fly: true, facing: -1, wing: k / 7 });
  for (let k = 0; k < 5; k++) drawBird(ctx, 1600 + k * 60, 1300 - k * 30, 1.1, { fly: true, facing: -1, t: 39 + k * 0.07, seed: k });
  label(ctx, 'drawBird: perched (day / golden) · flying wing 0 → 1 · a little flock (beat-locked flaps)', 970, 1360, 18);
});
