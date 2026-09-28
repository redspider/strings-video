// Contact sheets for src/props/space.js   —   node tools/sheet_space.mjs [name ...]
import { createCanvas } from '@napi-rs/canvas';
import { sheet, label } from './sheetkit.mjs';
import * as S from '../src/props/space.js';
import { W, H } from '../src/draw.js';
import { barTime } from '../src/timing.js';

const only = process.argv.slice(2);
const want = (n) => !only.length || only.includes(n);
const T = barTime(26, 0.02); // a beat-ish moment with drums
const lab = (ctx, s, x, y, size = 22, col = '#ffffff') => {
  ctx.save(); ctx.font = `bold ${size}px "Arial Rounded MT Bold"`; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(s, x, y); ctx.restore();
};
// render a full frame into a sub-rectangle
function inset(ctx, x, y, w, h, fn) {
  const c = createCanvas(W, H);
  const cx = c.getContext('2d');
  fn(cx);
  ctx.drawImage(c, x, y, w, h);
}
const dark = (ctx) => { ctx.fillStyle = '#15112e'; ctx.fillRect(0, 0, 4000, 4000); };

if (want('bg')) await sheet('sheets/space_bg.png', 1920, 1080, (ctx) => {
  const hs = [['violet', 0], ['blue', 0.6], ['teal', 1], ['magenta', 1]];
  hs.forEach(([hue, neb], i) => {
    const x = (i % 2) * 960, y = Math.floor(i / 2) * 540;
    inset(ctx, x, y, 960, 540, (c) => S.spaceBg(c, { t: T, hue, nebula: neb, seed: 1 + i }));
    lab(ctx, `spaceBg hue:'${hue}' nebula:${neb}`, x + 480, y + 12, 26);
  });
});

if (want('nebula')) await sheet('sheets/space_nebula.png', 1920, 1080, (ctx) => {
  dark(ctx);
  ['violet', 'blue', 'teal', 'magenta', 'pink'].forEach((hue, i) => {
    const x = (i % 3) * 640, y = Math.floor(i / 3) * 540;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, 640, 540); ctx.clip();
    ctx.fillStyle = '#0d0a28'; ctx.fillRect(x, y, 640, 540);
    S.nebula(ctx, { t: T, hue, x: x + 320, y: y + 270, scale: 0.42, seed: 3 + i });
    ctx.restore();
    lab(ctx, `nebula '${hue}' scale .42`, x + 320, y + 10);
  });
  // parallax drift test
  inset(ctx, 1280, 540, 640, 360, (c) => S.spaceBg(c, { t: T, hue: 'violet', driftX: 900, driftY: -300, nebula: 0.8 }));
  lab(ctx, 'spaceBg driftX 900 driftY -300', 1600, 910);
});

if (want('bodies')) await sheet('sheets/space_bodies.png', 1920, 1080, (ctx) => {
  inset(ctx, 0, 0, 1920, 1080, (c) => S.spaceBg(c, { t: T, hue: 'blue', stars: 200 }));
  [0, 2.1, 4.2].forEach((rot, i) => {
    S.drawEarth(ctx, 190 + i * 330, 210, 135, { t: T, rot });
    lab(ctx, `Earth rot ${rot}`, 190 + i * 330, 370);
  });
  S.drawMoon(ctx, 1130, 200, 110, { seed: 7 });
  lab(ctx, 'moon r110', 1130, 330);
  S.drawMoon(ctx, 1340, 200, 60, { seed: 7, rot: 1.2 });
  lab(ctx, 'moon r60 rot', 1340, 280);
  S.drawEarth(ctx, 1640, 210, 150, { t: T, rot: 1.0, glow: 0.3, night: 0.5 });
  lab(ctx, 'Earth glow .3 night .5', 1640, 380);
  for (let i = 0; i < 6; i++) {
    S.drawAsteroid(ctx, 150 + i * 200, 540, 70 + (i % 3) * 12, { seed: i + 1, rot: i * 0.7, color: i % 2 ? '#a595c4' : '#b08d73' });
    lab(ctx, `asteroid seed ${i + 1}`, 150 + i * 200, 630);
  }
  [0.3, 0.7, 1].forEach((c, i) => {
    S.drawAsteroid(ctx, 1380 + i * 190, 540, 75, { seed: 3, crack: c });
    lab(ctx, `crack ${c}`, 1380 + i * 190, 630);
  });
  [0.3, 0.8].forEach((sp, i) => {
    S.drawAsteroid(ctx, 180 + i * 260, 820, 90, { seed: 3, split: sp });
    lab(ctx, `split ${sp}`, 180 + i * 260, 940);
  });
  S.drawAsteroid(ctx, 760, 830, 150, { seed: 9, rot: 0.3 });
  lab(ctx, 'asteroid r150', 760, 990);
  // shooting stars
  [0.1, 0.3, 0.5, 0.75, 0.92].forEach((u, i) => {
    S.shootingStar(ctx, 1000 + i * 60, 720 + i * 50, 0.35, u, { dist: 500 });
  });
  lab(ctx, 'shootingStar u .1/.3/.5/.75/.92', 1500, 1000);
});

if (want('planet')) await sheet('sheets/space_planet.png', 1920, 1080, (ctx) => {
  inset(ctx, 0, 0, 1920, 1080, (c) => {
    S.spaceBg(c, { t: T, hue: 'violet', nebula: 0.5 });
    S.drawRingedPlanet(c, 1450, 560, 700, { t: T, rot: 0.4 });
    S.drawRingedPlanet(c, 330, 330, 150, { t: T, rot: 2.5, tilt: 0.25, open: 0.42 });
    S.drawRingedPlanet(c, 420, 820, 90, { t: T, rot: 1, tilt: -0.1, open: 0.2 });
  });
  lab(ctx, 'drawRingedPlanet r700 rot .4  |  r150 tilt .25 open .42  |  r90 open .2', 700, 20, 24);
});

if (want('moon')) await sheet('sheets/space_moon.png', 1920, 1080, (ctx) => {
  S.spaceBg(ctx, { t: T, hue: 'violet', nebula: 0.4 });
  S.drawEarth(ctx, 1500, 260, 120, { t: T, rot: 1.3 });
  S.drawMoonSurface(ctx, { t: T, curve: 0.5 });
  // mark ground points
  for (const x of [300, 960, 1600]) {
    const y = S.moonSurfaceY(x, { curve: 0.5 });
    ctx.fillStyle = '#ff3355'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
  }
  label(ctx, 'drawMoonSurface curve .5 (red dots = moonSurfaceY)', 600, 30, 26);
  inset(ctx, 1280, 20, 620, 349, (c) => { S.spaceBg(c, { t: T, hue: 'blue' }); S.drawMoonSurface(c, { t: T, curve: 0.95, scroll: 400 }); });
  inset(ctx, 20, 60, 620, 349, (c) => { S.spaceBg(c, { t: T, hue: 'teal' }); S.drawMoonSurface(c, { t: T, curve: 0.1, scroll: -700, seed: 4 }); });
  lab(ctx, 'curve .95 scroll 400', 1590, 330);
  lab(ctx, 'curve .1 seed 4', 330, 370);
});

if (want('star')) await sheet('sheets/space_star.png', 1920, 1080, (ctx) => {
  inset(ctx, 0, 0, 1920, 1080, (c) => S.spaceBg(c, { t: T, hue: 'violet', stars: 150, band: 0 }));
  const exprs = ['happy', 'excited', 'surprised', 'scared', 'sleepy'];
  exprs.forEach((e, i) => {
    S.drawBabyStar(ctx, 200 + i * 380, 230, 120, { expr: e });
    lab(ctx, `expr '${e}'`, 200 + i * 380, 390, 26);
  });
  const row2 = [
    ['wink .5', { wink: 0.5 }], ['wink 1', { wink: 1 }], ['blink 1', { blink: 1 }], ['glow 0', { glow: 0 }],
    ['look [-1,-.5] rot .3', { look: [-1, -0.5], rot: 0.3 }], ['t (beat) + bob', { t: T + 0.3 }],
  ];
  row2.forEach(([l, o], i) => {
    S.drawBabyStar(ctx, 160 + i * 320, 600, 95, o);
    lab(ctx, l, 160 + i * 320, 730);
  });
  // small sizes
  [60, 40, 26, 16, 10].forEach((r, i) => S.drawBabyStar(ctx, 140 + i * 160, 930, r, { expr: i % 2 ? 'excited' : 'happy', wink: i === 3 ? 1 : 0 }));
  lab(ctx, 'r 60 / 40 / 26 / 16 / 10', 460, 1030);
  S.drawComet(ctx, 1500, 900, Math.PI, 500, { t: T, size: 38, star: 1 });
  lab(ctx, 'drawComet star:1 (caught!)', 1500, 1010);
});

if (want('const')) await sheet('sheets/space_const.png', 1920, 1080, (ctx) => {
  inset(ctx, 0, 0, 1920, 1080, (c) => S.spaceBg(c, { t: T, hue: 'violet', stars: 250 }));
  [0.3, 0.7, 1].forEach((p, i) => {
    const d = S.placeConstellation('dog', 200 + i * 300, 210, 120);
    S.constellation(ctx, d.pts, p, { t: T, segments: d.segments });
    lab(ctx, `dog progress ${p}`, 200 + i * 300, 370);
  });
  [0.3, 0.7, 1].forEach((p, i) => {
    const d = S.placeConstellation('heart', 200 + i * 300, 560, 120);
    S.constellation(ctx, d.pts, p, { t: T, segments: d.segments, color: '#ffc2e0' });
    lab(ctx, `heart progress ${p}`, 200 + i * 300, 710);
  });
  // Juno (girl): progress .45 / .8 / 1 white, and the rainbow s16 look
  [0.3, 0.6, 1].forEach((p, i) => {
    const g = S.placeConstellation('girl', 1050 + i * 300, 210, 125);
    S.constellation(ctx, g.pts, p, { t: T, segments: g.segments, color: '#ffd9f0' });
    lab(ctx, `girl ${p} (${S.CONSTELLATIONS.girl.segments.length} segs)`, 1050 + i * 300, 370);
  });
  const g2 = S.placeConstellation('girl', 1110, 580, 140);
  S.constellation(ctx, g2.pts, 1, { t: T, segments: g2.segments, rainbow: true, lw: 4 });
  lab(ctx, 'girl rainbow 1', 1110, 740);
  const f = S.placeConstellation('dogFace', 1470, 580, 130);
  S.constellation(ctx, f.pts, 1, { t: T, segments: f.segments, rainbow: true, hue: 30, lw: 4 });
  lab(ctx, 'dogFace rainbow 1', 1470, 740);
  const r = S.placeConstellation('rocket', 1780, 580, 130);
  S.constellation(ctx, r.pts, 0.55, { t: T, segments: r.segments, color: '#fff1a8', starSize: 14, lw: 4 });
  lab(ctx, 'rocket .55 gold', 1780, 740);
  // tiny, as in the backyard sky (s19)
  const d3 = S.placeConstellation('dog', 150, 950, 55);
  S.constellation(ctx, d3.pts, 1, { t: T, segments: d3.segments, lw: 1.5, starSize: 5 });
  const g3 = S.placeConstellation('girl', 300, 950, 55);
  S.constellation(ctx, g3.pts, 1, { t: T, segments: g3.segments, lw: 1.5, starSize: 5 });
  const h3 = S.placeConstellation('heart', 450, 950, 55);
  S.constellation(ctx, h3.pts, 1, { t: T, segments: h3.segments, lw: 1.5, starSize: 5, alpha: 0.8 });
  lab(ctx, 'small (lw 1.5, starSize 5)', 300, 1030);
  // simple chain
  S.constellation(ctx, [[640, 960], [740, 920], [860, 990], [990, 940], [1090, 1000]], 0.62, { t: T, color: '#8fffd6' });
  lab(ctx, 'chain .62 teal', 860, 1030);
  const h2 = S.placeConstellation('heart', 1500, 930, 95);
  S.constellation(ctx, h2.pts, 1, { t: T, segments: h2.segments, rainbow: true, lw: 5, starSize: 12 });
  lab(ctx, 'heart rainbow lw5', 1500, 1040);
});

if (want('fx')) await sheet('sheets/space_fx.png', 1920, 1080, (ctx) => {
  inset(ctx, 0, 0, 1920, 1080, (c) => S.spaceBg(c, { t: T, hue: 'magenta', stars: 200 }));
  S.drawComet(ctx, 1500, 200, 0, 900, { t: T });
  lab(ctx, 'comet angle 0 len 900', 1500, 270);
  S.drawComet(ctx, 500, 600, -2.5, 600, { t: T + 0.3, size: 28, curve: 80 });
  lab(ctx, 'angle -2.5 curve 80', 500, 660);
  S.drawComet(ctx, 1300, 850, -0.6, 400, { t: T + 0.6, size: 20, tailColors: ['#ffb3d1', '#b388ff'] });
  lab(ctx, 'angle -.6 pink tail', 1300, 900);
  for (let i = 0; i < 6; i++) S.shootingStar(ctx, 900 + i * 100, 380 + i * 20, 0.5, 0.1 + i * 0.16, { dist: 300, len: 220 });
  lab(ctx, 'shootingStar u .1 → .9', 1250, 560);
});

if (want('small')) await sheet('sheets/space_small.png', 1920, 540, (ctx) => {
  inset(ctx, 0, 0, 1920, 1080, (c) => S.spaceBg(c, { t: T, hue: 'blue', stars: 200 }));
  S.drawEarth(ctx, 90, 120, 50, { t: T, rot: 1 });
  S.drawEarth(ctx, 220, 120, 28, { t: T, rot: 2 });
  S.drawMoon(ctx, 320, 120, 30, {});
  S.drawMoon(ctx, 390, 120, 14, {});
  S.drawRingedPlanet(ctx, 560, 130, 70, { rot: 1 });
  S.drawRingedPlanet(ctx, 760, 130, 30, { rot: 1 });
  for (let i = 0; i < 5; i++) S.drawAsteroid(ctx, 880 + i * 60, 120, 12 + i * 5, { seed: i + 3 });
  S.drawBabyStar(ctx, 1250, 120, 22, { t: T });
  S.drawBabyStar(ctx, 1330, 120, 12, { wink: 1 });
  S.drawComet(ctx, 1600, 110, 0.2, 280, { t: T, size: 14 });
  S.drawComet(ctx, 1850, 110, 0.2, 140, { t: T, size: 7 });
  const d = S.placeConstellation('dog', 300, 380, 110);
  S.constellation(ctx, d.pts, 1, { t: T, segments: d.segments, lw: 2, starSize: 7 });
  const h = S.placeConstellation('heart', 620, 380, 90);
  S.constellation(ctx, h.pts, 1, { t: T, segments: h.segments, lw: 2, starSize: 7, rainbow: true });
  label(ctx, 'small-scale versions (wide shots)', 1200, 480, 26);
});

// quick in-context compositions (each a full 1920x1080 frame, shown at half size)
if (want('scenes')) await sheet('sheets/space_scenes.png', 1920, 1080, (ctx) => {
  const frames = [
    ['s08 Earth curve (r1500)', (c) => { S.spaceBg(c, { t: 46, hue: 'blue', stars: 300 }); S.drawEarth(c, 960, 2250, 1500, { t: 46, rot: 1.2, pitch: -0.95 }); }],
    ['s10 gravity (planet r700)', (c) => { S.spaceBg(c, { t: 56, hue: 'violet', nebula: 0.4 }); S.drawRingedPlanet(c, 1500, 600, 700, { t: 56, rot: 0.2 }); }],
    ['s12 stars (constellations)', (c) => {
      S.spaceBg(c, { t: 66, hue: 'violet', nebula: 0.7 });
      const d = S.placeConstellation('dog', 600, 360, 190); S.constellation(c, d.pts, 1, { t: 66, segments: d.segments });
      const g = S.placeConstellation('girl', 1300, 380, 200); S.constellation(c, g.pts, 0.8, { t: 66, segments: g.segments });
      S.shootingStar(c, 300, 120, 0.3, 0.45, {});
    }],
    ['s14 comet chase (asteroids)', (c) => {
      S.spaceBg(c, { t: 82, hue: 'magenta', driftX: 800 });
      S.drawComet(c, 1500, 300, 0.25, 800, { t: 82 });
      for (let i = 0; i < 7; i++) S.drawAsteroid(c, 150 + i * 280, 700 + (i % 2) * 180, 60 + (i % 3) * 40, { seed: i + 2, rot: i });
    }],
  ];
  frames.forEach(([l, f], i) => {
    const x = (i % 2) * 960, y = Math.floor(i / 2) * 540;
    inset(ctx, x, y, 960, 540, f);
    lab(ctx, l, x + 480, y + 10);
  });
});
