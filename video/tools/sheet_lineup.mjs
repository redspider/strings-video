// Art-direction LINEUP sheets: every shared asset together, at true relative scale, in context.
//   node tools/sheet_lineup.mjs            -> all sheets
//   node tools/sheet_lineup.mjs a b zoom   -> only those
// Sheets (1920x1080 each, under sheets/):
//   lineup_a1_golden_test.png   golden backyard wide: Juno + remote, Biscuit sitting, Test Rocket #1 on the crates
//   lineup_a2_golden_ssb.png    same yard, S.S. Biscuit + booster on the pad at TRUE crew scale, suited-up pair
//   lineup_b1_night_wreck.png   night yard, wrecked pad + crater, sooty/frizzed Juno & Biscuit (as briefed)
//   lineup_b2_golden_wreck.png  the same post-explosion look in the actual s02 lighting (golden)
//   lineup_c_space.png          violet space: ringed planet, floating suited pair, baby star, constellation
//   lineup_d1_dash.png          cockpit dash, Juno (joystick) + Biscuit (sunglasses) between the layers
//   lineup_d2_cabin.png         cabin: zero-g float (s09)  |  lineup_d3_cabin_lap.png  s17 sleepy lap
//   lineup_e1_flight.png        S.S. Biscuit flying over Earth, flame + crew in portholes
//   lineup_e2_moon.png          moon surface: landed rocket (legs, hatch), Juno & Biscuit standing, flag
//   lineup_f1_night_s19.png     s19 night yard, clean suited pair + landed rocket (night-tint mismatch check)
//   lineup_f2_s12_back.png      s12 back-view sit on the rocket nose under constellations
//   lineup_f3_s19_lawn.png      s19 top-down blanket with the real lying characters
//   lineup_g_scale_contract.png proposed yard scale contract (chars s, test rocket 1.4s, S.S.B. 2s) + door/hatch fit boxes
//   lineup_zoom.png             detail crops: faces/eyes side by side, helmets, soot, hatch fit, s=0.3 lineup
//   lineup_zoom2.png            hatch vs Juno at crew scale, porthole crew, ringed planet lower half, cabin lamp
//   lineup_zoom3.png            helmet + raised-arm presets (hands vs glass), dog float with vest
import { sheet, label } from './sheetkit.mjs';
import { drawGirl, drawGirlHead, girlAnchors, GIRL_HEIGHT } from '../src/characters/girl.js';
import { drawDog, drawDogHead, dogAnchors, DOG_HEIGHT } from '../src/characters/dog.js';
import { drawTestRocket, drawRocket, ROCKET_HEIGHT } from '../src/props/rockets.js';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../src/props/cockpit.js';
import { drawBackyard, drawLawnTopDown, BACKYARD } from '../src/props/backyard.js';
import {
  spaceBg, drawRingedPlanet, drawEarth, drawMoonSurface, moonSurfaceY, moonSurfaceAngle,
  drawBabyStar, constellation, placeConstellation, drawComet,
} from '../src/props/space.js';
import * as IT from '../src/props/items.js';
import { camera, INK, PAL, W, H } from '../src/draw.js';
import { barTime } from '../src/timing.js';

const only = process.argv.slice(2);
const want = (k) => only.length === 0 || only.includes(k);

// tag in the corner (kept small so it doesn't hide art)
function tag(ctx, text, x = 16, y = 14) {
  ctx.save();
  ctx.font = 'bold 22px "Arial Rounded MT Bold"';
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.beginPath(); ctx.roundRect(x - 8, y - 4, w + 16, 32, 8); ctx.fill();
  ctx.fillStyle = INK; ctx.textBaseline = 'top'; ctx.fillText(text, x, y);
  ctx.restore();
}
// dashed height ruler (world units) for scale checks
function ruler(ctx, x, yBase, h, text) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(x, yBase); ctx.lineTo(x, yBase - h); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 16px "Arial Rounded MT Bold"'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(text, x + 6, yBase - h + 4);
  ctx.restore();
}
const frame = (name, fn) => sheet(`sheets/${name}.png`, W, H, fn);

// ---------------------------------------------------------------- scale decisions
// One consistent scale per shot: characters and the test rocket share SG. The S.S. Biscuit is
// drawn at SR = 2*SG, because its porthole crew heads are drawn at 0.5 x the rocket's scale.
const SG = 0.5; // Juno/Biscuit in the backyard wide
const GY = BACKYARD.groundY;

// ================================================================ (a1) golden, test rocket
if (want('a')) await frame('lineup_a1_golden_test', (ctx) => {
  const t = barTime(1, 1) + 0.12; // countdown "3" just popped
  camera(ctx, {}, () => {
    drawBackyard(ctx, { t, tod: 'golden', pad: 'intact' });
    drawTestRocket(ctx, BACKYARD.padX, BACKYARD.padTop, SG, { t, flame: 0, wobble: 0.15 });
    drawGirl(ctx, 600, GY, SG, {
      t, facing: 1, stance: 'stand', expr: 'determined', goggles: 'eyes', suit: 'overalls',
      armR: { a: 1.2, b: -0.6, hand: 'fist' }, holdR: (c) => { c.save(); c.rotate(Math.PI / 2); c.scale(0.55, 0.55); IT.remote(c, { pressed: 0 }); c.restore(); },
      armL: 'down',
    });
    drawDog(ctx, 740, GY, SG, { t, facing: 1, stance: 'sit', expr: 'alert', pawsUp: 0.9 });
    ruler(ctx, 470, GY, GIRL_HEIGHT * SG, `Juno ${Math.round(GIRL_HEIGHT * SG)}px`);
  });
  tag(ctx, `(a1) golden · Juno/Biscuit/TestRocket s=${SG} · t=${t.toFixed(2)}`);
});

// ================================================================ (a2) golden, S.S. Biscuit + booster
if (want('a')) await frame('lineup_a2_golden_ssb', (ctx) => {
  const t = 31.9; // s05 hero walk
  const SR = 2 * SG; // true crew scale
  const zoom = 0.72;
  const cam = { x: 1000, y: 330, zoom };
  camera(ctx, cam, () => {
    drawBackyard(ctx, { t, tod: 'golden', pad: 'intact', camX: cam.x, camY: cam.y, skyExtend: 600 });
    const yMain = BACKYARD.padTop - 216 * SR; // booster fins stand on the crates
    drawRocket(ctx, BACKYARD.padX, yMain, SR, { t, booster: true, crew: false, stickers: true });
    drawGirl(ctx, 820, GY, SG, { t, facing: 0, stance: 'walk', phase: 0.25, suit: 'space', helmet: 1, expr: 'grin' });
    drawDog(ctx, 960, GY, SG, { t, facing: 1, stance: 'walk', suit: 'space', helmet: 1, expr: 'happy' });
    ruler(ctx, 1480, BACKYARD.padTop, (720 + 216) * SR, `S.S.B.+booster ${Math.round(936 * SR)}px (s=${SR})`);
    // garage door opening for the s04 roll-out
    const gd = BACKYARD.garageDoor;
    ctx.save(); ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]);
    ctx.strokeRect(gd.x0, gd.top, gd.x1 - gd.x0, gd.bottom - gd.top); ctx.restore();
  });
  tag(ctx, `(a2) golden · S.S. Biscuit+booster at crew-true s=${SR}, suited pair s=${SG}, zoom ${zoom} · red box = garage door opening`);
});

// ================================================================ (b) post-explosion
const sootGirl = (t, extra = {}) => ({
  t, facing: 1, stance: 'stand', soot: 1, frizz: 1, goggles: 'askew', expr: 'dazed', armL: 'down', armR: 'down', ...extra,
});
const sootDog = (t, extra = {}) => ({ t, facing: -1, stance: 'sit', soot: 1, frizz: 1, expr: 'dazed', ...extra });
if (want('b')) for (const [name, tod] of [['lineup_b1_night_wreck', 'night'], ['lineup_b2_golden_wreck', 'golden']]) {
  await frame(name, (ctx) => {
    const t = 8.3;
    const cam = { x: 980, y: 660, zoom: 1.45 };
    camera(ctx, cam, () => {
      drawBackyard(ctx, { t, tod, pad: 'wrecked', crater: true, craterSmoke: 0.6, embers: 0.7, camX: cam.x, camY: cam.y });
      drawGirl(ctx, 820, GY + 20, 0.62, sootGirl(t));
      drawDog(ctx, 1010, GY + 30, 0.62, sootDog(t, { hat: (c) => IT.trafficCone(c, { charred: 0.6, t, smoke: 0.3 }) }));
    });
    tag(ctx, `(b) ${tod} · wrecked pad + crater · soot 1 frizz 1 · Juno & Biscuit s=0.62, zoom 1.45`);
  });
}

// ================================================================ (c) space
if (want('c')) await frame('lineup_c_space', (ctx) => {
  const t = barTime(26, 2) + 0.1;
  spaceBg(ctx, { t, hue: 'violet', nebula: 0.5 });
  drawRingedPlanet(ctx, 1640, 330, 300, { rot: 0.4 });
  const c = placeConstellation('dog', 520, 250, 170);
  constellation(ctx, c.pts, 1, { t, segments: c.segments, glow: 1 });
  const g = placeConstellation('girl', 1060, 190, 130);
  constellation(ctx, g.pts, 0.999, { t, segments: g.segments, color: '#ffd9f0' });
  drawGirl(ctx, 760, 900, 0.85, { t, stance: 'float', suit: 'space', helmet: 1, facing: 1, expr: 'awe', tilt: -0.15, look: [0.6, -0.6] });
  drawDog(ctx, 1150, 820, 0.85, { t, stance: 'float', suit: 'space', helmet: 1, facing: -1, expr: 'excited', tilt: 0.25, pivot: 'center' });
  drawBabyStar(ctx, 980, 560, 60, { t, expr: 'happy' });
  tag(ctx, `(c) violet space · planet r300 · dog + girl constellations · pair float s=0.85 · baby star r60`);
});

// ================================================================ (d) cockpit
if (want('d')) await frame('lineup_d1_dash', (ctx) => {
  const t = 36.62;
  const S = COCKPIT_SEATS.dash;
  const o = { t, view: 'dash', lights: 1, stick: [0.3, 0] };
  drawCockpit(ctx, o);
  drawGirl(ctx, S.girl.x, S.girl.y, S.girl.s, { t, stance: 'sit', facing: 1, suit: 'space', helmet: 1, expr: 'determined', ...S.girl.arms.joystick });
  drawDog(ctx, S.dog.x, S.dog.y, S.dog.s, { t, stance: 'sit', facing: -1, suit: 'space', helmet: 1, sunglasses: true, expr: 'grin' });
  drawCockpitFront(ctx, o);
  tag(ctx, '(d1) cockpit dash · COCKPIT_SEATS.dash · joystick arm preset · Biscuit sunglasses');
});
if (want('d')) await frame('lineup_d2_cabin', (ctx) => {
  const t = 52.2;
  const S = COCKPIT_SEATS.cabin;
  const o = { t, view: 'cabin', window: (c, cx, cy, r) => { c.fillStyle = PAL.space; c.fillRect(cx - r, cy - r, 2 * r, 2 * r); drawEarth(c, cx + r * 0.2, cy + r * 0.9, r * 0.9, { t }); } };
  drawCockpit(ctx, o);
  drawGirl(ctx, 760, 700, 0.95, { t, stance: 'float', suit: 'space', helmet: 1, facing: 1, expr: 'laugh', tilt: -0.35 });
  drawDog(ctx, 1150, 480, 0.95, { t, stance: 'float', suit: 'space', helmet: 1, facing: -1, expr: 'happy', tilt: Math.PI, pivot: 'center' });
  drawCockpitFront(ctx, o);
  tag(ctx, '(d2) cabin · zero-g · Juno float s=.95 tilt -.35 · Biscuit upside-down (pivot center)');
});
if (want('d')) await frame('lineup_d3_cabin_lap', (ctx) => {
  const t = 109.3;
  const S = COCKPIT_SEATS.cabin;
  const o = { t, view: 'cabin' };
  drawCockpit(ctx, o);
  drawGirl(ctx, S.girl.x, S.girl.y, S.girl.s, { t, stance: 'sit', suit: 'space', helmet: 0, facing: 1, expr: 'sleepy', mouth: 0.8, armL: 'hold', armR: 'hold' });
  drawDog(ctx, S.lap.x, S.lap.y, S.girl.s, { t, stance: 'lie', suit: 'space', facing: 1 });
  drawCockpitFront(ctx, o);
  tag(ctx, '(d3) cabin s17 · Juno sit (no helmet) + Biscuit lie at COCKPIT_SEATS.cabin.lap, same s');
});

// ================================================================ (e) flight + moon
if (want('e')) await frame('lineup_e1_flight', (ctx) => {
  const t = 45.1;
  spaceBg(ctx, { t, hue: 'blue', seed: 3 });
  drawEarth(ctx, 960, 1080 + 1250, 1500, { t, pitch: -0.9, rot: 2.2 });
  ctx.save(); ctx.translate(900, 540); ctx.rotate(0.35);
  drawRocket(ctx, 0, 330, 0.8, { t, flame: 1, crew: true, crewPose: { girl: { expr: 'grin', armR: 'wave' }, dog: { expr: 'excited' } } });
  ctx.restore();
  tag(ctx, '(e1) S.S. Biscuit s=0.8 rot .35 · flame 1 · crew · Earth r1500 pitch -.9');
});
if (want('e')) await frame('lineup_e2_moon', (ctx) => {
  const t = barTime(30, 3) + 0.05;
  const curve = 0.5;
  spaceBg(ctx, { t, hue: 'violet', seed: 2 });
  drawEarth(ctx, 1580, 210, 90, { t, rot: 1 });
  drawMoonSurface(ctx, { t, curve });
  const SGm = 0.42, SRm = 2 * SGm;
  const rx = 1330, ry = moonSurfaceY(rx, { curve });
  ctx.save(); ctx.translate(rx, ry); ctx.rotate(moonSurfaceAngle(rx, { curve }));
  drawRocket(ctx, 0, 0, SRm, { t, legs: 1, hatch: 1 });
  ctx.restore();
  const put = (x, fn) => { const y = moonSurfaceY(x, { curve }); ctx.save(); ctx.translate(x, y); ctx.rotate(moonSurfaceAngle(x, { curve })); fn(); ctx.restore(); };
  put(560, () => { ctx.save(); ctx.scale(SGm, SGm); IT.flag(ctx, { t }); ctx.restore(); });
  put(700, () => drawGirl(ctx, 0, 0, SGm, { t, stance: 'stand', suit: 'space', helmet: 1, facing: 1, expr: 'excited', armR: 'wave' }));
  put(860, () => drawDog(ctx, 0, 0, SGm, { t, stance: 'stand', suit: 'space', helmet: 1, facing: 1, expr: 'alert', exclaim: 1 }));
  drawComet(ctx, 520, 150, 0.25, 520, { t });
  tag(ctx, `(e2) moon · rocket s=${SRm} legs+hatch · Juno/Biscuit s=${SGm} · flag scaled to Juno`);
});

// ================================================================ zoom sheet: consistency checks
if (want('zoom')) await sheet('sheets/lineup_zoom.png', 1920, 1620, (ctx) => {
  const t = 20.35;
  // row 1: faces at matching head size on the same bg — eye style consistency
  ctx.fillStyle = '#2a2350'; ctx.fillRect(0, 0, 1920, 520);
  drawGirlHead(ctx, 220, 260, 1.0, { t, expr: 'happy', bust: false });
  drawDogHead(ctx, 560, 280, 1.2, { t, expr: 'happy', neck: false, turn: 0.4 });
  drawBabyStar(ctx, 880, 260, 110, { t, expr: 'happy', glow: 0.4 });
  // helmets side by side
  drawGirlHead(ctx, 1240, 260, 1.0, { t, expr: 'happy', helmet: 1, suit: 'space' });
  drawDogHead(ctx, 1640, 290, 1.4, { t, expr: 'happy', helmet: 1, suit: 'space' });
  label(ctx, 'faces: Juno s1 / Biscuit head s1.2 / baby star r110', 540, 470, 20);
  label(ctx, 'helmets: Juno head s1 / Biscuit head s1.4', 1440, 470, 20);
  // row 2: soot comparison on light + hatch fit test
  ctx.fillStyle = '#e9b98a'; ctx.fillRect(0, 520, 960, 560);
  drawGirl(ctx, 250, 1040, 1.0, sootGirl(t, { expr: 'annoyed', frizz: 0 }));
  drawDog(ctx, 560, 1040, 1.0, sootDog(t, { expr: 'annoyed', frizz: 0, facing: 1 }));
  drawGirl(ctx, 800, 1040, 0.5, sootGirl(t, { cleanGoggleRings: 1, expr: 'annoyed' }));
  label(ctx, 'soot 1 (frizz 0): Juno vs Biscuit, and clean rings', 480, 530, 20);
  // hatch-fit: rocket s=1 with hatch open, Juno bust at crew scale 0.5 in the doorway
  ctx.save(); ctx.beginPath(); ctx.rect(960, 520, 960, 560); ctx.clip();
  ctx.fillStyle = '#10163a'; ctx.fillRect(960, 520, 960, 560);
  drawRocket(ctx, 1300, 1500, 1.0, { t, hatch: 1, crew: true });
  drawGirlHead(ctx, 1300 + 82, 1500 - 454 + 8, 0.5, { t, helmet: 1, suit: 'space', expr: 'grin' });
  ctx.restore();
  label(ctx, 'hatch fit: Juno head at crew scale (0.5) placed in the open doorway', 1440, 530, 20);
  // row 3: small-scale lineup on a golden lawn
  ctx.save(); ctx.beginPath(); ctx.rect(0, 1080, 1920, 540); ctx.clip();
  ctx.translate(0, 1080 - 330);
  drawBackyard(ctx, { t, tod: 'golden' });
  ctx.restore();
  const gy = 1080 - 330 + GY;
  const xs = [150, 300, 450, 600, 760, 920, 1080, 1250, 1420];
  const sS = 0.3;
  drawGirl(ctx, xs[0], gy, sS, { t, expr: 'happy' });
  drawDog(ctx, xs[1], gy, sS, { t, stance: 'sit', expr: 'happy' });
  drawGirl(ctx, xs[2], gy, sS, { t, expr: 'surprised', suit: 'space', helmet: 1 });
  drawDog(ctx, xs[3], gy, sS, { t, stance: 'stand', expr: 'excited', suit: 'space', helmet: 1 });
  drawGirl(ctx, xs[4], gy, sS, sootGirl(t));
  drawDog(ctx, xs[5], gy, sS, sootDog(t, { facing: 1 }));
  drawGirl(ctx, xs[6], gy, sS, { t, view: 'back', stance: 'sit' });
  drawDog(ctx, xs[7], gy, sS, { t, view: 'back', stance: 'sit' });
  drawTestRocket(ctx, xs[8] + 60, gy, sS, { t });
  label(ctx, 's = 0.3 wide-shot lineup on the golden lawn', 960, 1090, 20);
});

// ================================================================ zoom 2: suspected craft bugs
if (want('zoom2')) await sheet('sheets/lineup_zoom2.png', 1920, 1620, (ctx) => {
  const t = 20.35;
  const panel = (x, y, w, h, bg, fn, title) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); fn(); ctx.restore();
    ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); ctx.restore();
    if (title) { ctx.save(); ctx.font = 'bold 20px "Arial Rounded MT Bold"'; ctx.fillStyle = '#fff'; ctx.fillText(title, x + 10, y + 26); ctx.restore(); }
  };
  // 1: hatch fit at crew-true scale: rocket s=1, Juno full body s=0.5 standing on the door sill
  panel(0, 0, 640, 810, '#141a44', () => {
    drawRocket(ctx, 330, 1000, 1.0, { t, hatch: 1 });
    // doorway: x 46..118, y -528..-380 (rocket units) -> sill at y 1000-380
    drawGirl(ctx, 330 + 82, 1000 - 380, 0.5, { t, suit: 'space', helmet: 0, expr: 'grin', armR: 'wave' });
  }, 'hatch vs Juno @crew scale (no helmet)');
  panel(640, 0, 640, 810, '#141a44', () => {
    drawRocket(ctx, 970, 1000, 1.0, { t, hatch: 1 });
    drawGirl(ctx, 970 + 82, 1000 - 380, 0.5, { t, suit: 'space', helmet: 1, expr: 'grin', armR: { a: 1.4, b: -0.4 },
      holdR: (c) => { c.save(); c.rotate(Math.PI / 2 + 0.5); c.scale(0.5, 0.5); IT.net(c, { t, swing: 1 }); c.restore(); } });
  }, '...with helmet + net (s14)');
  // 3: porthole crew framing at 2x
  panel(1280, 0, 640, 810, '#141a44', () => {
    drawRocket(ctx, 1600 + 44, 1500, 1.6, { t, crew: true });
  }, 'crew portholes at s=1.6');
  // 4: ringed planet lower half (suspected translucency)
  panel(0, 810, 960, 810, '#1a1440', () => {
    spaceBg(ctx, { t, hue: 'violet' });
    drawRingedPlanet(ctx, 520, 1180, 420, { rot: 0.4 });
  }, 'ringed planet r420: lower half');
  // 5: cabin lamp light pool edges
  panel(960, 810, 960, 810, '#000', () => {
    ctx.save(); ctx.translate(960 - 100, 810); ctx.scale(1.3, 1.3); ctx.translate(-200, -40);
    drawCockpit(ctx, { t, view: 'cabin', photo: false });
    ctx.restore();
  }, 'cabin lamp halo (1.3x)');
});

// ================================================================ (f) storyboard spot-checks
// f1: s19 night yard, clean characters + landed rocket with chutes (tint mismatch check)
if (want('f')) await frame('lineup_f1_night_s19', (ctx) => {
  const t = 118.3;
  const cam = { x: 1000, y: 560, zoom: 0.8 };
  camera(ctx, cam, () => {
    drawBackyard(ctx, { t, tod: 'night', pad: 'wrecked', crater: true, craterSmoke: 0, camX: cam.x, camY: cam.y });
    drawRocket(ctx, 1560, GY + 10, 0.8, { t, legs: 1, hatch: 1, chute: 0.7 });
    drawGirl(ctx, 900, GY + 30, SG, { t, facing: 1, stance: 'stand', suit: 'space', helmet: 0, expr: 'awe', look: [0.3, -1] });
    drawDog(ctx, 1030, GY + 30, SG, { t, facing: -1, stance: 'sit', suit: 'space', expr: 'happy', look: [0, -1] });
  });
  tag(ctx, '(f1) s19 night yard · clean suited pair s=0.5 · rocket s=0.8 legs+hatch+chute .7 · note: no night tint on characters/rocket');
});
// f2: s12 — from behind, sitting on the rocket nose, constellation above
if (want('f')) await frame('lineup_f2_s12_back', (ctx) => {
  const t = barTime(27, 1) + 0.2;
  spaceBg(ctx, { t, hue: 'violet', nebula: 0.35, seed: 4 });
  const c = placeConstellation('dog', 620, 300, 190);
  constellation(ctx, c.pts, 1, { t, segments: c.segments });
  const g = placeConstellation('girl', 1300, 290, 190);
  constellation(ctx, g.pts, 0.6, { t, segments: g.segments, color: '#ffd9f0' });
  // rocket seen from behind-ish, nose up at bottom centre (big, cropped)
  drawRocket(ctx, 960, 1080 + 1250, 2.4, { t });
  const noseY = 1080 + 1250 - 720 * 2.4; // nose tip
  drawGirl(ctx, 930, noseY + 110, 0.95, { t, view: 'back', stance: 'sit', suit: 'space', helmet: 1, armR: 'point' });
  drawDog(ctx, 1090, noseY + 150, 0.95, { t, view: 'back', stance: 'sit', suit: 'space', helmet: 1, look: [0, -1] });
  tag(ctx, '(f2) s12 · back-view sit on the nose (s=0.95), helmets, dog + girl constellations');
});
// f3: s19 top-down blanket with the real lying characters
if (want('f')) await frame('lineup_f3_s19_lawn', (ctx) => {
  const t = 121.3;
  drawLawnTopDown(ctx, { t, tod: 'night' });
  ctx.save(); ctx.translate(820, 560); ctx.rotate(Math.PI / 2 - 0.05);
  drawGirl(ctx, 0, 190, 0.9, { t, stance: 'lie', expr: 'awe', look: [0, -1], suit: 'overalls', goggles: 'forehead' });
  ctx.restore();
  ctx.save(); ctx.translate(1120, 600); ctx.rotate(-0.2);
  drawDog(ctx, 0, 60, 0.9, { t, stance: 'lie' });
  ctx.restore();
  tag(ctx, '(f3) s19 top-down · girl lie rotated 90° · dog lie curled (s=0.9)');
});

// ================================================================ (g) proposed yard scale contract
// characters CS, test rocket 1.4*CS, S.S. Biscuit 2*CS (crew-true); required garage door box in red,
// required hatch doorway (92x230 rocket units) in cyan, current doorway in magenta.
if (want('g')) await frame('lineup_g_scale_contract', (ctx) => {
  const t = 27.6;
  const CS = 0.42, TR = 1.4 * CS, RS = 2 * CS;
  const cam = { x: 1180, y: 520, zoom: 0.86 };
  camera(ctx, cam, () => {
    drawBackyard(ctx, { t, tod: 'golden', pad: 'intact', camX: cam.x, camY: cam.y, garageDoor: 1 });
    drawTestRocket(ctx, BACKYARD.padX, BACKYARD.padTop, TR, { t });
    drawRocket(ctx, 1830, GY - 20, RS, { t, hatch: 1 });
    drawGirl(ctx, 1560, GY + 10, CS, { t, facing: -1, stance: 'stand', expr: 'grin', armR: 'point' });
    drawDog(ctx, 1660, GY + 10, CS, { t, facing: -1, stance: 'sit', expr: 'happy' });
    drawGirl(ctx, 700, GY + 10, CS, { t, facing: 1, stance: 'stand', expr: 'happy', goggles: 'forehead' });
    drawDog(ctx, 800, GY + 10, CS, { t, facing: 1, stance: 'sit', expr: 'happy' });
    ctx.save(); ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
    // rocket envelope at RS: fin span 472, height 720 -> required door (with 10% clearance)
    const dw = 472 * RS * 1.1, dh = 720 * RS * 1.05;
    ctx.strokeStyle = '#ff2255'; ctx.strokeRect(1830 - dw / 2, GY - 20 - dh, dw, dh);
    const gd = BACKYARD.garageDoor;
    ctx.strokeStyle = '#ffffff'; ctx.strokeRect(gd.x0, gd.top, gd.x1 - gd.x0, gd.bottom - gd.top);
    // hatch doorway: current (72x148) and required (92x230) at rocket scale
    const hx = 1830 + 82 * RS, sill = GY - 20 - 380 * RS;
    ctx.strokeStyle = '#ff44ff'; ctx.strokeRect(hx - 36 * RS, sill - 148 * RS, 72 * RS, 148 * RS);
    ctx.strokeStyle = '#33e6ff'; ctx.strokeRect(hx - 46 * RS, sill - 230 * RS, 92 * RS, 230 * RS);
    ctx.restore();
    drawGirl(ctx, hx, sill, CS, { t, facing: 1, stance: 'stand', suit: 'space', helmet: 1, expr: 'happy', armR: 'wave' });
  });
  tag(ctx, `(g) proposal: chars s=${CS}, test rocket ${TR.toFixed(2)}, S.S.B. ${RS} · red = door S.S.B. needs, white = current door · magenta = hatch now, cyan = hatch needed`);
});

// ================================================================ zoom 3: helmets & raised arms, dog float
if (want('zoom3')) await sheet('sheets/lineup_zoom3.png', 1920, 900, (ctx) => {
  const t = 20.35;
  ctx.fillStyle = '#2a2350'; ctx.fillRect(0, 0, 1920, 900);
  const armsets = [['wave', 'wave'], ['up', 'up'], ['cheer', 'cheer'], ['reach', 'down']];
  armsets.forEach(([r, l], i) => drawGirl(ctx, 180 + i * 330, 820, 1.0, { t, suit: 'space', helmet: 1, armR: r, armL: l, expr: 'happy', facing: 0 }));
  drawDog(ctx, 1560, 700, 1.4, { t, stance: 'float', suit: 'space', helmet: 1, facing: 1, expr: 'happy' });
  label(ctx, 'helmet + raised-arm presets (wave/up/cheer/reach) · dog float s1.4', 960, 850, 22);
});
