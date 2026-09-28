// Cockpit sheets: node tools/sheet_cockpit.mjs [dash|dashstates|cabin|cabinstates]
import { sheet, label as label0 } from './sheetkit.mjs';
import { drawCockpit, drawCockpitFront, COCKPIT_SEATS } from '../src/props/cockpit.js';
import { drawGirl } from '../src/characters/girl.js';
import { drawDog } from '../src/characters/dog.js';
import { planet, glow } from '../src/draw.js';

const only = process.argv[2];
const want = (n) => !only || only === n;
function label(ctx, text, x, y, size = 26) {
  ctx.save();
  ctx.font = `bold ${size}px "Arial Rounded MT Bold"`;
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 3, w, size + 10, 8); ctx.fill();
  ctx.restore();
  label0(ctx, text, x, y, size);
}
const earthWindow = (ctx, cx, cy, r) => {
  ctx.fillStyle = '#0e0b26'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  glow(ctx, cx + r * 0.2, cy + r * 0.6, r * 1.2, '#7ec8f0', 0.5);
  planet(ctx, cx + r * 0.2, cy + r * 1.05, r * 0.95, { base: '#3a86ff', lw: 5 });
};
const ringWindow = (ctx, cx, cy, r) => {
  ctx.fillStyle = '#1a0f3a'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  planet(ctx, cx - r * 0.1, cy + r * 0.1, r * 0.55, { base: '#d67be0', bands: ['#b35ac0', '#f0a4e8', '#9c49b0'], ring: true, lw: 5 });
};

function seated(ctx, view, t, extra = {}) {
  const S = COCKPIT_SEATS[view];
  const arms = S.girl.arms || {};
  drawGirl(ctx, S.girl.x, S.girl.y, S.girl.s, { t, stance: 'sit', suit: 'space', helmet: 1, expr: 'determined', ...(arms.joystick || {}), ...(extra.girl || {}) });
  drawDog(ctx, S.dog.x, S.dog.y, S.dog.s, { t, stance: 'sit', suit: 'space', helmet: 1, expr: 'happy', tongue: 1, facing: -1, ...(extra.dog || {}) });
}
function frame(ctx, o, chars) {
  drawCockpit(ctx, o);
  if (chars) chars(ctx);
  drawCockpitFront(ctx, o);
}
// render a full 1920x1080 frame scaled into a cell
function cell(ctx, x, y, sc, fn) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, 1920 * sc, 1080 * sc); ctx.clip();
  ctx.translate(x, y); ctx.scale(sc, sc);
  fn(ctx);
  ctx.restore();
}

if (want('dash')) await sheet('sheets/cockpit_dash.png', 1920, 1080, (ctx) => {
  const t = 36.16;
  frame(ctx, { t, view: 'dash', lights: 1 }, (c) => seated(c, 'dash', t));
  label(ctx, 'dash, lights 1, t=36.16 (characters drawn between layers)', 960, 8);
});

if (want('dashstates')) await sheet('sheets/cockpit_dash_states.png', 1920, 1080, (ctx) => {
  const sc = 0.5;
  cell(ctx, 0, 0, sc, (c) => frame(c, { t: 20.3, view: 'dash', lights: 0 }, null));
  cell(ctx, 960, 0, sc, (c) => frame(c, { t: 37.96, view: 'dash', lights: 1, redButton: 1, tint: 1, shake: 1, stick: [0.6, 0] }, (cc) => seated(cc, 'dash', 37.96, { girl: { expr: 'determined', ...COCKPIT_SEATS.dash.girl.arms.redButton }, dog: { expr: 'alert', ears: 1, sunglasses: true } })));
  cell(ctx, 0, 540, sc, (c) => frame(c, { t: 109.3, view: 'dash', lights: 0.3, homeSwitch: 1, stick: [-1, 0.5], window: earthWindow }, (cc) => seated(cc, 'dash', 109.3, { girl: { expr: 'sleepy', ...COCKPIT_SEATS.dash.girl.arms.homeOn }, dog: { expr: 'sleepy' } })));
  cell(ctx, 960, 540, sc, (c) => frame(c, { t: 55.9, view: 'dash', lights: 0.6, homeSwitch: 0.5, window: ringWindow, joystick: 'front' }, null));
  label(ctx, 'empty, lights 0', 480, 6, 22);
  label(ctx, 'redButton 1, tint 1, shake 1, stick [.6,0]', 1440, 6, 22);
  label(ctx, 'homeSwitch 1, stick [-1,.5], window fn (Earth)', 480, 546, 22);
  label(ctx, 'homeSwitch .5 (mid-flip), joystick front, window fn', 1440, 546, 22);
});

if (want('cabin')) await sheet('sheets/cockpit_cabin.png', 1920, 1080, (ctx) => {
  const t = 108.5;
  frame(ctx, { t, view: 'cabin', lights: 0.5, window: earthWindow }, (c) => {
    const S = COCKPIT_SEATS.cabin;
    drawGirl(c, S.girl.x, S.girl.y, S.girl.s, { t, stance: 'sit', suit: 'space', helmet: 0, expr: 'sleepy' });
    drawDog(c, S.dog.x, S.dog.y, S.dog.s, { t, stance: 'lie', suit: 'space', expr: 'sleepy', facing: -1, blink: 1 });
  });
  label(ctx, 'cabin (window fn = Earth), sitting on the bench', 960, 1030);
});

if (want('cabinstates')) await sheet('sheets/cockpit_cabin_states.png', 1920, 1080, (ctx) => {
  const sc = 0.5;
  cell(ctx, 0, 0, sc, (c) => frame(c, { t: 51, view: 'cabin' }, null));
  cell(ctx, 960, 0, sc, (c) => frame(c, { t: 52.3, view: 'cabin', window: ringWindow }, (cc) => {
    const F = COCKPIT_SEATS.cabin.float;
    drawGirl(cc, F.x - 200, F.y + 180, 1, { t: 52.3, stance: 'float', suit: 'space', hairFloat: 1, expr: 'laugh', tilt: -0.4 });
    drawDog(cc, F.x + 260, F.y - 20, 1, { t: 52.3, stance: 'float', suit: 'space', hairFloat: 1, expr: 'happy', tongue: 1, tilt: 2.8 });
  }));
  cell(ctx, 0, 540, sc, (c) => frame(c, { t: 113.5, view: 'cabin', tint: 1, shake: 1, lights: 1 }, null));
  cell(ctx, 960, 540, sc, (c) => frame(c, { t: 90, view: 'cabin', lights: 1, photo: false }, null));
  label(ctx, 'cabin empty (default starfield window)', 480, 6, 22);
  label(ctx, 'zero-g floating (window fn)', 1440, 6, 22);
  label(ctx, 'tint 1 + shake 1', 480, 546, 22);
  label(ctx, 'lights 1, photo false', 1440, 546, 22);
});
