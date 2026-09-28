// s07_liftoff — 38.54 → 43.34 (bars 16–17) · transition: flash
//
// SHOT A  (bar 16, 38.54 → 40.94)  golden backyard wide (same layout as s05: pad x 1240, gantry,
//   rocket s 0.84). LIFTOFF on the downbeat (engine flash): the booster ignites, the exhaust splashes
//   sideways along the lawn, smoke billows roll across the yard (left bank on the downbeat, right bank
//   a beat later — the wind blows left), fence planks flap, the fence birds bolt (birdsFly), leaves
//   blow off the tree, the gantry arm swings clear, and the gnome face-plants with a dust poof ON
//   beat 1 (39.14). The S.S. Biscuit creeps up, then accelerates; the camera tilts up after it
//   (drawBackyard skyExtend, no vertical parallax) past the altitude clouds, zooming out, then races
//   ahead to show a thick sunset-lit cloud ceiling; the nose pokes into it at 40.86 (poof).
// SHOT B  (bar 17, 40.94 → 43.34)  match-cut ON the downbeat: above the golden cloud sea the rocket
//   PUNCHES out of the cloud tops (white burst, shock ring, flung puffs, big shake). A flock of seven
//   bluebirds beside it freezes mid-air at 41.24 ("!" pops, wings stuck up), then SCATTERS on beat 1
//   (41.54) in every direction, leaving poofs and feathers. The camera locks on and pushes in on the
//   crew (Juno grinning, Biscuit in his sunglasses) while the cloud sea and altitude clouds rush down
//   past, the sky deepens to violet-indigo and the first stars come out; shake on every kick, a
//   tempo-locked waggle, speed lines and fin-tip vapour curls. On beat 3 (42.74) it squashes and
//   BOOSTS out of the top of frame ("ting" glint ~43.0), leaving its trail as we cut to s08.
import { W, H, INK, LW, PAL, camera, shake, smokePuff, glow, sparkle, blobs, ellipsePath, circlePath, cartoonText } from '../draw.js';
import { clamp, lerp, ease, hash01, noise1, mixColor, rgba, smoothstep, TAU } from '../util.js';
import { barTime, kick, beatAt, sway } from '../timing.js';
import { drawBackyard, drawBird, todTint, tintColor, BACKYARD } from '../props/backyard.js';
import { drawRocket, drawGantry, drawFlame } from '../props/rockets.js';

// ------------------------------------------------------------------ beat grid
// Hits are fully "on" half a frame early (EPS) so the 30 fps frame nearest the beat shows the impact.
const EPS = 1 / 60;
const T_IGN = barTime(16); //      38.537  LIFTOFF — ignition flash, smoke burst, big shake
const T_B1 = barTime(16, 1) - EPS; //    39.137  gnome thuds down; rocket clear of the lawn
const T_PUNCH = barTime(17) - EPS; //    40.937  CUT: rocket punches out of the cloud sea
const T_SCATTER = barTime(17, 1) - EPS; // 41.537 bird flock scatters
const T_EXIT = barTime(17, 3) - EPS; //  42.737  rocket boosts away out of frame
const T_END = barTime(18); //      43.338  cut to s08

// ------------------------------------------------------------------ set / scale contract
const RS = 0.84; // S.S. Biscuit at 2 × character scale
const GY = BACKYARD.groundY; // 860
const RX = BACKYARD.padX; // 1240
const RY0 = GY - 216 * RS; // main-stage fin tips while standing (booster fins on the lawn) — as in s05
const NOSE = 720 * RS; // fin tips → nose
const TINT = todTint('golden');
const SMOKE = tintColor('#f1ecf4', TINT, 0.8);
const SMOKE_SH = tintColor('#cdbfd6', TINT, 0.9);
const SMOKE_HI = tintColor('#ffffff', TINT, 0.5);
const CLOUD = '#ffe4d2'; // golden-hour cloud (matches backyard TOD.golden.cloud)
const CLOUD_SH = '#f2a494';
const CLOUD_HI = '#fff5ec';
const CEIL_FILL = '#ffb89c'; // sunset-lit undersides
const CEIL_SH = '#e0808e';
const CEIL_BACK = '#c9799c';

// Flat stepped glow (a few translucent discs) — far cheaper than a big radial gradient.
function halo(ctx, x, y, r, color, a) {
  if (a <= 0.01) return;
  ctx.fillStyle = rgba(color, a * 0.28);
  for (const k of [1, 0.62, 0.3]) { circlePath(ctx, x, y, r * k); ctx.fill(); }
}

// =================================================================== SHOT A (world = backyard)
// Rocket altitude (px the fin tips have risen) — slow creep, then accelerating.
const altA = (lt) => (lt <= 0 ? 0 : 260 * lt * lt + 50 * lt * lt * lt);
const T_POKE = T_PUNCH - 0.08; // the nose pokes into the ceiling a couple of frames before the cut
const CEIL = RY0 - altA(T_POKE - T_IGN) - NOSE - 40; // cloud-ceiling underside (the pad belly hangs 40 lower)
const ZOOM_END = 0.5;
const CAM_END = CEIL + (540 - 270) / ZOOM_END; // camera races ahead and settles with the ceiling near the top

function camA(t) {
  const lt = t - T_IGN;
  const rc = RY0 - altA(lt) - 200; // stack centre
  const w = smoothstep(0.25, 1.1, lt);
  const follow = lerp(530, rc + 60, w);
  const y = lerp(follow, CAM_END, smoothstep(1.6, 2.35, lt)); // then look up at the cloud ceiling
  const x = lerp(1150, RX - 20, smoothstep(0.2, 1.6, lt));
  const zoom = lerp(0.8, ZOOM_END, ease.inOutSine(smoothstep(0.35, 2.05, lt))) + 0.035 * Math.exp(-7 * Math.max(0, lt));
  // shake: ignition blast + ground rumble + kicks
  const sA = shake(t, T_IGN, 30, 3.2, 21);
  const rumble = 10 * (1 - smoothstep(0.9, 2.0, lt)) * clamp(lt / 0.05);
  const k = kick(t) * 7;
  return {
    x, y, zoom,
    dx: sA.dx + rumble * noise1(t * 31, 5) + k * noise1(t * 40, 9),
    dy: sA.dy + rumble * noise1(t * 29, 6) + k * noise1(t * 43, 10),
    // (no rotational shake: a rotated transform makes the backyard's axis-aligned fills ~40% slower)
  };
}

// A cheap smoke billow (ink + fill + one shade pass), grown by g 0..1.
function billow(ctx, x, y, r, seed, g) {
  const cs = [];
  const k = ease.outCubic(clamp(g));
  for (let i = 0; i < 5; i++) {
    const a = hash01(i, seed) * TAU, d = r * 0.5 * hash01(i, seed + 7) * k;
    cs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.48 + 0.3 * hash01(i, seed + 3)) * k]);
  }
  blobs(ctx, cs, SMOKE_SH, LW); // shade base, then the lit body pulled up-left leaves a lower-right crescent
  ctx.fillStyle = SMOKE;
  ctx.beginPath();
  for (const [cx, cy, cr] of cs) { const rr = cr * 0.84; ctx.moveTo(cx - cr * 0.1 + rr, cy - cr * 0.12); ctx.arc(cx - cr * 0.1, cy - cr * 0.12, rr, 0, TAU); }
  ctx.fill();
  ctx.fillStyle = SMOKE_HI;
  ctx.beginPath();
  for (const [cx, cy, cr] of cs) { const rr = cr * 0.26; ctx.moveTo(cx - cr * 0.34 + rr, cy - cr * 0.4); ctx.ellipse(cx - cr * 0.34, cy - cr * 0.4, rr, rr * 0.6, -0.5, 0, TAU); }
  ctx.fill();
}
// Ground billows: puffs pushed out from the base both ways, rolling along the lawn. The wind
// blows left, so the left bank bursts out on the downbeat and the right bank follows on beat 2
// (which keeps the gnome's rattle and face-plant on beat 1 in the clear).
const puffSpawn = (i) => (i < 14 ? i * 0.006 : 0.1 + (i - 14) * 0.055) + (i % 2 ? 1.1 : 0);
function groundSmoke(ctx, t, front, V) {
  const lt = t - T_IGN;
  if (lt <= 0 || V.y1 < GY - 520) return;
  const list = [];
  const N = 34;
  for (let i = 0; i < N; i++) {
    const sg = i % 2 ? 1 : -1;
    const age = lt - puffSpawn(i);
    if (age <= 0) continue;
    const kx = hash01(i, 11);
    const reach = (sg < 0 ? 1250 : 980) * (0.35 + 0.65 * kx); // left side rolls further (wind blows left)
    const roll = ease.outCubic(clamp(age / (1.3 + 0.9 * hash01(i, 12))));
    const x = RX + sg * (50 + reach * roll) + 30 * noise1(age * 1.3 + i, 13);
    const r = (88 + 150 * (0.55 + 0.45 * hash01(i, 14))) * (0.45 + 0.55 * ease.outCubic(clamp(age / 0.7))) * (1 + 0.25 * roll);
    const depth = hash01(i, 15); // 0 = back (fence side) .. 1 = front
    const y = GY + 10 + 50 * depth - r * (0.45 + 0.25 * hash01(i, 16)) - 40 * roll * hash01(i, 17);
    if ((depth > 0.55) !== front || y - r > V.y1) continue;
    list.push([depth, x, y, r, i]);
  }
  list.sort((a, b) => a[0] - b[0]);
  for (const [, x, y, r, i] of list) {
    const age = lt - puffSpawn(i);
    billow(ctx, x, y, r, 40 + i, Math.min(1, 0.35 + age * 1.3));
  }
}

// Exhaust column: puffs left hanging where the flame's tail was at spawn time.
// invert a monotonic rising altitude curve: time at which alt(lt) = a
function invAlt(fn, a, lo, hi) {
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fn(m) < a) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// Exhaust column: puffs laid down every 120 px of climb where the flame's tail was, so the
// column stays continuous however fast the rocket goes.
function columnSmoke(ctx, t, V) {
  const lt = t - T_IGN;
  if (lt <= 0.15) return;
  const hNow = altA(lt);
  for (let j = 0; j < 40; j++) {
    const hj = 260 + j * 120; // (the ground billows cover the first few hundred px)
    if (hj > hNow) break;
    const ts = invAlt(altA, hj, 0, 3);
    const age = lt - ts;
    const x = RX + 40 * (hash01(j, 21) - 0.5) - 70 * age * (0.5 + hash01(j, 22));
    const y = Math.min(RY0 - hj + 216 * RS + 170 + 160 * clamp(hj / 900) + 25 * age, GY - 90);
    const r = (100 + 60 * hash01(j, 23)) * (0.75 + 0.6 * ease.outCubic(clamp(age / 1.4)));
    if (x + r < V.x0 || x - r > V.x1 || y + r < V.y0 || y - r > V.y1) continue;
    smokePuff(ctx, x, y, r, { seed: 90 + j, u: clamp(0.3 + age / 4, 0, 0.97), fill: SMOKE, shadeCol: SMOKE_SH, lw: LW * 0.9, n: 5 });
  }
}

// Thick cloud ceiling seen from below (world coords): a back tier of dusky bellies and a front
// tier of big sunset-lit bellies hanging down to y = yb.
function cloudCeiling(ctx, yb, x0, x1, t) {
  const step = 230;
  const back = [], front = [], shade = [], lit = [];
  for (let k = Math.floor(x0 / step) - 1; k <= Math.ceil(x1 / step) + 1; k++) {
    const r = 160 + 120 * hash01(k, 301);
    const x = k * step + 70 * (hash01(k, 302) - 0.5);
    const y = yb - r - 70 * hash01(k, 303) + 10 * Math.sin(t * 1.3 + k);
    front.push([x, y, r]);
    shade.push([x + r * 0.08, y + r * 0.2, r * 0.82]);
    lit.push([x - r * 0.16, y - r * 0.12, r * 0.74]);
    const r2 = 150 + 90 * hash01(k, 304);
    back.push([x + step * 0.5, yb - 200 - r2 * 0.5 - 60 * hash01(k, 305), r2]);
  }
  // the big belly right over the pad the rocket punches into
  front.push([RX + 10, yb - 150, 190]);
  shade.push([RX + 25, yb - 116, 160]);
  lit.push([RX - 20, yb - 173, 140]);
  back.push({ rr: [x0 - 400, yb - 3400, x1 - x0 + 800, 3000, 0] });
  blobs(ctx, back, CEIL_BACK, LW * 1.3);
  blobs(ctx, front, CEIL_SH, LW * 1.3);
  blobs(ctx, lit, CEIL_FILL, 0);
  ctx.fillStyle = rgba('#ffd9b8', 0.9);
  for (const [x, y, r] of lit) { ellipsePath(ctx, x - r * 0.3, y + r * 0.35, r * 0.42, r * 0.16, 0.25); ctx.fill(); }
}

// Gnome: rattles on its base in the rumble (anticipation — it can only rock toward its fall side),
// then topples so the outBounce's first impact lands ON beat 1.
const G_FALL = T_B1 - 0.33; // outBounce first contact at f = 1/2.75 → 0.9 s × 0.364 = 0.33 s
function gnomeF(t) {
  if (t >= G_FALL) return clamp((t - G_FALL) / 0.9);
  const d = G_FALL - T_IGN;
  const x = (t - T_IGN) / d;
  return x > 0 ? 0.1 * Math.abs(Math.sin(Math.PI * 3 * x)) : 0;
}
// where its head lands (world): pivot (gnomeX - 22, 846) rotated by -1.42 rad
const GNOME_HEAD = [BACKYARD.gnomeX - 92, 814];
const GANTRY_DX = 50;

function shotA(ctx, t) {
  const lt = t - T_IGN;
  const cam = camA(t);
  const h = altA(lt);
  const ry = RY0 - h;
  // full-throttle booster: overshoots on ignition, then settles long and roaring
  const flame = lt < 0 ? 0 : clamp(lt / 0.05) * (1.2 + 0.5 * Math.exp(-5 * lt));
  camera(ctx, cam, () => {
    // visible world rect (for culling our own FX)
    const hw = W / 2 / cam.zoom + 120, hh = H / 2 / cam.zoom + 120;
    const V = { x0: cam.x - hw, x1: cam.x + hw, y0: cam.y - hh, y1: cam.y + hh };
    const blast = clamp(lt / 0.22);
    drawBackyard(ctx, {
      t, tod: 'golden', pad: 'none', crater: false, garageDoor: 1,
      skyExtend: 4200, camX: cam.x, // a tilt is a pan: no vertical parallax
      fenceFlap: blast * (1 - 0.5 * smoothstep(1.4, 2.4, lt)),
      wind: blast * (1 - 0.3 * smoothstep(1.4, 2.4, lt)),
      gnomeFall: gnomeF(t), // rattles in the rumble, then face-plants ON beat 1
      gnomeDir: -1, // (falls into the open gap under the rising booster — the gantry tower hides its right side)
      birdsFly: clamp((lt - 0.04) / 1.5),
    });
    // flash-lit lawn glow under the engine
    if (lt > 0 && V.y1 > GY - 300) {
      const g = clamp(1 - h / 500) * (0.55 + 0.25 * kick(t));
      halo(ctx, RX, GY - 30, 380, '#ffcf7a', 0.5 * g);
    }
    columnSmoke(ctx, t, V);
    groundSmoke(ctx, t, false, V);
    // gantry stays behind; its access arm swings clear at ignition
    // (nudged GANTRY_DX right of its s05 spot — the s06 cockpit shot sits between — so its left leg
    // no longer hides the rattling gnome; the access arm is already swinging clear under the flash)
    if (V.y1 > GY - 900) drawGantry(ctx, RX + GANTRY_DX, RY0, RS, { t, rungs: 7, swing: ease.inOutCubic(clamp((lt + 0.12) / 0.5)), light: TINT });
    // exhaust splashing sideways along the lawn while the nozzle is near the ground (the wind bends
    // it left; the right-hand tongue flares on ignition, then shrinks so the gnome's pratfall reads)
    const splash = lt > 0 ? clamp(1 - h / 300) * clamp(lt / 0.05) : 0;
    if (splash > 0.02) {
      for (const sg of [-1, 1]) {
        const len = sg < 0 ? 440 : 150 * (1 - smoothstep(0.08, 0.3, lt)) + 40;
        ctx.save();
        ctx.translate(RX + sg * 40, GY - 16);
        ctx.rotate(-sg * Math.PI / 2 + sg * 0.18);
        drawFlame(ctx, 0, 0, len * splash * (1 + 0.3 * kick(t)), (sg < 0 ? 110 : 80) * splash, t + sg * 0.37, { seed: 60 + sg, lw: LW * 0.9, glow: 0, sparks: false });
        ctx.restore();
      }
    }
    const shakeR = lt < 0 ? 0 : 0.8 * (1 - smoothstep(0.6, 1.6, lt)) + 0.3 * kick(t);
    const lowClip = V.y1 > GY + 14; // the flame hits the lawn (and splashes sideways) instead of going through it
    if (lowClip) { ctx.save(); ctx.beginPath(); ctx.rect(V.x0, V.y0, V.x1 - V.x0, GY + 14 - V.y0); ctx.clip(); }
    drawRocket(ctx, RX, ry, RS, {
      t, booster: true, flame, shake: shakeR, light: TINT, stickers: true,
      // (no porthole faces in the wide: ~25 px heads cost ~5 ms/frame; the crew reads in shot B's push-in)
    });
    if (lowClip) ctx.restore();
    // the gnome's face-plant ON beat 1: dust poof, impact lines + a bonk star at its head
    const gAge = t - T_B1;
    if (gAge > -0.02 && gAge < 0.6) {
      const hx = GNOME_HEAD[0], hy = GNOME_HEAD[1];
      // dust kicked out at the hat tip and the boots (kept off the face so the pratfall reads)
      for (const [dx, sd] of [[-86, 811], [110, 812]]) {
        smokePuff(ctx, hx + dx, GY - 6, 34, { seed: sd, u: clamp(0.12 + gAge / 0.6, 0, 0.99), fill: tintColor('#f6e7cf', TINT), shadeCol: tintColor('#d9c09c', TINT), lw: LW * 0.5, n: 4 });
      }
      if (gAge >= 0) {
        const k = Math.exp(-6 * gAge);
        const e = ease.outCubic(clamp(gAge / 0.18));
        ctx.save();
        ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 6;
        ctx.globalAlpha = clamp(1 - gAge / 0.3);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI * (0.18 + 0.64 * (i / 4));
          const r0 = 52 + 34 * e, r1 = r0 + 34 * (1 - e) + 12;
          ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); ctx.stroke();
        }
        ctx.restore();
        sparkle(ctx, hx - 6, hy - 58, 62 * k, '#fff3b0', k);
      }
    }
    groundSmoke(ctx, t, true, V);
    // cloud ceiling (the rocket races up into it) + the poof where the nose goes in
    if (V.y0 < CEIL + 200) {
      cloudCeiling(ctx, CEIL, V.x0, V.x1, t);
      const pk = (t - T_POKE) / 0.35;
      if (pk > 0 && pk < 1) {
        for (let i = 0; i < 5; i++) {
          const a = Math.PI * (0.15 + 0.7 * (i / 4));
          const d = 150 * ease.outCubic(pk);
          smokePuff(ctx, RX + Math.cos(a) * (60 + d * 1.6), CEIL + 30 + Math.sin(a) * d * 0.4, 70 + 20 * hash01(i, 9), { seed: 850 + i, u: 0.2 + 0.8 * pk, fill: CEIL_FILL, shadeCol: CEIL_SH, lw: LW * 1.2, n: 5 });
        }
      }
    }
  });
  // ignition flare in screen space (on top of the engine's white flash)
  if (lt >= 0 && lt < 0.3) {
    const k = 1 - lt / 0.3;
    ctx.save();
    ctx.globalAlpha = 0.22 * k * k;
    ctx.fillStyle = '#fff3c8';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// =================================================================== SHOT B (above the cloud sea)
// World: cloud-sea top at y = 0 (rocket plane). Rocket fin tips at rocketB(lt2).
const rocketB = (lt2) => 20 - (1000 * lt2 + 500 * lt2 * lt2 + 300 * lt2 * lt2 * lt2); // half out on the cut
// BOOST on beat 3: extra climb the camera does NOT follow, so the rocket rockets out of the top of
// frame starting ON the beat (nose gone in ~2 frames, fins clear by ~43.15)
const LT_EXIT = T_EXIT - T_PUNCH;
const boostDisp = (lt2) => { const x = lt2 - LT_EXIT; return x > 0 ? 420 * x + 4000 * x * x : 0; };
const rocketY = (lt2) => rocketB(lt2) - boostDisp(lt2); // actual fin-tip world y
const ZB = 0.75, ZB_IN = 1.3;
const CAMB0 = -250;
function camB(t) {
  const lt2 = t - T_PUNCH;
  const zoom = lerp(ZB, ZB_IN, ease.inOutSine(smoothstep(0.7, 1.65, lt2))); // push in on the crew
  // lock onto the portholes (world point 400·RS above the fin tips held at screen y 400)
  const follow = rocketB(lt2) - 400 * RS + (540 - 400) / zoom;
  const w = smoothstep(0.05, 0.75, lt2);
  const y = lerp(CAMB0 - 40 * lt2, follow, w);
  const sP = shake(t, T_PUNCH, 36, 4.5, 22);
  const k = kick(t) * 12;
  return {
    y, zoom,
    dx: sP.dx + k * noise1(t * 37, 3), dy: sP.dy + k * noise1(t * 41, 4),
  };
}
// Sky colour by world altitude (continues the backyard's golden skyExtend ramp) and screen height:
// high up it settles on exactly the gradient s08 opens on (its skyC at u = 0), so the 43.34 cut
// only changes the camera angle, not the sky.
function endSky(fy) {
  return fy <= 0.55 ? mixColor('#302f88', '#4b56bd', clamp(fy / 0.55)) : mixColor('#4b56bd', '#7584dc', clamp((fy - 0.55) / 0.45));
}
function skyB(yw, fy) {
  const alt = 2900 - yw * 0.42;
  let c = mixColor('#e8789f', '#8a4fa6', smoothstep(0, 2400, alt));
  c = mixColor(c, endSky(fy), smoothstep(2000, 5400, alt));
  return mixColor(c, '#ffb49a', 0.7 * smoothstep(-900, 60, yw)); // warm glow just above the cloud sea
}

// A row of cloud-sea tops: bumps along yTop, flat body below. p = parallax factor.
function cloudRow(ctx, cam, yTop, p, seed, rMin, rMax, step, cols, hole) {
  const z = cam.zoom;
  const sy = 540 + (yTop - CAMB0 + (CAMB0 - cam.y) * p) * z; // screen y of this row's top
  if (sy - rMax * z * 1.6 > H + 20) return sy;
  const shapes = [], shade = [], hi = [];
  for (let k = -2; k * step < W / z + step * 2; k++) {
    const xw = k * step + (hash01(k, seed) - 0.5) * step * 0.4;
    const sx = 960 + (xw - W / (2 * z)) * z;
    if (hole && Math.abs(sx - hole.x) < hole.r) continue;
    const r = (rMin + (rMax - rMin) * hash01(k, seed + 1)) * z;
    const cy = sy - r * (0.35 + 0.35 * hash01(k, seed + 2));
    shapes.push([sx, cy, r]);
    shade.push([sx + r * 0.1, cy + r * 0.22, r * 0.86]);
    hi.push([sx - r * 0.12, cy - r * 0.16, r * 0.8]);
  }
  shapes.push({ rr: [-200, sy - 10, W + 400, H + 400 - sy, 0] });
  blobs(ctx, shapes, cols.fill, LW * z * 1.2);
  ctx.fillStyle = cols.shade;
  ctx.fillRect(-200, sy + (rMax * 0.6) * z, W + 400, H);
  blobs(ctx, shade, cols.shade, 0);
  blobs(ctx, hi, cols.fill, 0);
  ctx.fillStyle = rgba(CLOUD_HI, 0.7);
  for (const [x, y, r] of hi) { ellipsePath(ctx, x - r * 0.25, y - r * 0.45, r * 0.4, r * 0.18, -0.35); ctx.fill(); }
  return sy;
}

// Flock: 7 bluebirds in a V, flying right, just left of where the rocket bursts out.
const FLOCK = [[0, 0], [-130, 70], [-130, -66], [-260, 138], [-260, -130], [-390, 205], [-390, -196]];
const SCATTER_ANG = [-1.35, -2.45, 2.55, -2.95, 2.05, 1.95, -1.05]; // screen radians (y down)
const FLOCK_X = 560, FLOCK_Y = -610;
const FREEZE = 0.3; // lt2 when the rocket roars past the leader: everyone freezes
function flockPos(i, lt2) {
  const [fx, fy] = FLOCK[i];
  const glide = 150 * (Math.min(lt2, FREEZE) + 0.5);
  return [FLOCK_X + fx + glide, FLOCK_Y + fy + 7 * Math.sin((Math.min(lt2, FREEZE) + i * 0.4) * 6)];
}
function flock(ctx, t, cam) {
  const lt2 = t - T_PUNCH;
  const z = cam.zoom;
  const toS = (xw, yw) => [960 + (xw - 960) * z, 540 + (yw - cam.y) * z];
  const sc = 2.9 * z;
  const sAge = t - T_SCATTER;
  for (let i = 0; i < FLOCK.length; i++) {
    let [xw, yw] = flockPos(i, lt2);
    let wing, rot = 0, facing = 1, alpha = 1;
    if (lt2 < FREEZE) {
      wing = 0.5 + 0.5 * Math.cos(TAU * (2 * beatAt(t) + i * 0.37));
    } else if (sAge < 0) {
      // the take: wings stuck up, a little hop of fright, a tremble
      const q = clamp((lt2 - FREEZE - 0.03 * i) / 0.1);
      wing = lerp(0.5 + 0.5 * Math.cos(TAU * (2 * beatAt(T_PUNCH + FREEZE) + i * 0.37)), 0.02, q);
      yw -= 22 * ease.outBack(q);
      xw += 2.5 * Math.sin(t * 90 + i) * q;
      rot = -0.12 * q;
    } else {
      // SCATTER: bolt off in every direction
      const ang = SCATTER_ANG[i];
      const d = (1000 + 700 * hash01(i, 72)) * ease.outCubic(clamp(sAge / 1.1)) + 300 * Math.max(0, sAge - 1.1);
      yw -= 22;
      xw += Math.cos(ang) * d; yw += Math.sin(ang) * d;
      facing = Math.cos(ang) >= 0 ? 1 : -1;
      wing = 0.5 + 0.5 * Math.cos(TAU * (8 * sAge + i * 0.3));
      rot = (facing > 0 ? ang : ang - Math.PI) * 0.6 + 0.6 * Math.sin(sAge * 11 + i) * Math.exp(-3 * sAge);
      alpha = 1 - smoothstep(1.0, 1.5, sAge);
    }
    const [sx, sy] = toS(xw, yw);
    if (sx < -140 || sx > W + 140 || sy < -140 || sy > H + 140 || alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(sx, sy); ctx.rotate(rot);
    if (sAge >= 0 && sAge < 0.25) { const st = 1 + 0.4 * Math.sin(Math.PI * sAge / 0.25); ctx.scale(st, 1 / st); }
    drawBird(ctx, 0, 0, sc, { t, fly: true, facing, wing, tod: 'golden' });
    ctx.restore();
    // "!" of alarm between the freeze and the scatter
    const ex = clamp((lt2 - FREEZE - 0.05 * i) / 0.13);
    if (FLOCK[i][1] <= 0 && ex > 0 && sAge < 0.1) { // (upper arm of the V only: no marks over other birds)
      const pop = ease.outBack(ex, 2.4) * (1 - clamp(sAge / 0.1));
      cartoonText(ctx, '!', sx + 4 * sc, sy - 50 * sc, { size: 84, fill: PAL.yellow, scale: pop, lw: 10, shadow: false, rot: 0.15 * (i % 2 ? 1 : -1) });
    }
  }
  if (sAge > 0) {
    // take-off poofs where each bird was
    const pu = clamp(sAge / 0.45);
    if (pu < 1) {
      for (let i = 0; i < FLOCK.length; i++) {
        const [xw, yw] = flockPos(i, FREEZE);
        const [sx, sy] = toS(xw, yw - 30);
        ctx.save(); ctx.globalAlpha *= 0.75;
        smokePuff(ctx, sx, sy, 60 * z, { seed: 780 + i, u: 0.2 + 0.8 * pu, fill: '#fff4fb', shadeCol: '#e9d2ee', lw: 0, n: 4 });
        ctx.restore();
      }
    }
    // feathers left hanging in the air
    for (let i = 0; i < 12; i++) {
      const [bx, by] = flockPos(i % 7, FREEZE);
      const xw = bx + 60 * (hash01(i, 81) - 0.5) + 70 * Math.sin(sAge * 3 + i) * clamp(sAge * 2);
      const yw = by - 40 + 40 * (hash01(i, 82) - 0.5) + 110 * sAge;
      const [sx, sy] = toS(xw, yw);
      if (sy > H + 40) continue;
      const fs = 2 * z * ease.outBack(clamp(sAge / 0.15));
      ctx.save();
      ctx.globalAlpha *= clamp(1 - (sAge - 1.3) / 0.5);
      ctx.translate(sx, sy); ctx.rotate(0.9 * Math.sin(sAge * 4 + i * 2) + i);
      ctx.beginPath(); ctx.moveTo(-13 * fs, 0); ctx.quadraticCurveTo(0, -8 * fs, 13 * fs, 0); ctx.quadraticCurveTo(0, 8 * fs, -13 * fs, 0);
      ctx.fillStyle = i % 3 ? '#6d93e0' : '#ffe0b0'; ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-15 * fs, 0); ctx.lineTo(10 * fs, 0); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }
}

// Small puffy altitude cloud (clip-free), pinkish in the golden light.
function skyPuff(ctx, x, y, w, seed, fill, shadeCol, lw) {
  const n = 4 + Math.floor(hash01(seed, 3) * 2);
  const h = w * 0.36, shapes = [], sh = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), bump = Math.sin(u * Math.PI);
    const r = h * (0.3 + 0.32 * bump) * (0.85 + 0.3 * hash01(i, seed));
    const cx = x - w / 2 + w * (0.14 + 0.72 * u), cy = y - r * (0.2 + 0.6 * bump);
    shapes.push([cx, cy, r]);
    sh.push([cx + r * 0.1, cy + r * 0.3, r * 0.75]);
  }
  shapes.push({ rr: [x - w / 2, y - h * 0.25, w, h * 0.5, h * 0.25] });
  blobs(ctx, shapes, fill, lw);
  blobs(ctx, sh, shadeCol, 0);
  blobs(ctx, shapes.slice(0, n).map(([a, b2, r]) => [a - r * 0.12, b2 - r * 0.18, r * 0.72]), fill, 0);
}

function shotB(ctx, t) {
  const lt2 = t - T_PUNCH;
  const cam = camB(t);
  const z = cam.zoom;
  const RB = RS * z; // rocket screen scale
  const toSy = (yw) => 540 + (yw - cam.y) * z;
  ctx.save();
  ctx.translate(cam.dx, cam.dy);
  // --- sky: one smooth gradient sampled from the altitude ramp (no banding); the first stars are
  // saved for s08 ("first stars appear" in bar 18)
  {
    const g = ctx.createLinearGradient(0, -60, 0, H + 60);
    for (let k = 0; k <= 10; k++) {
      const y = -60 + (H + 120) * k / 10;
      g.addColorStop(k / 10, skyB(cam.y + (y - 540) / z, clamp(y / H)));
    }
    ctx.fillStyle = g;
    ctx.fillRect(-80, -60, W + 160, H + 120);
  }
  // --- altitude clouds rushing down past (parallax < 1 so they read)
  for (let k = 0; k < 14; k++) {
    const p = 0.25 + 0.3 * hash01(k, 95);
    const yw = -700 - k * 430 - 160 * hash01(k, 91);
    const sy = 540 + (yw - CAMB0 + (CAMB0 - cam.y) * p) * z;
    const w = (240 + 260 * hash01(k, 93)) * z * (0.5 + p);
    if (sy < -w || sy > H + w * 0.5) continue;
    const sx = 960 + (hash01(k, 92) - 0.5) * 2000;
    if (Math.abs(sx - 960) < 260 * z) continue; // keep the rocket's silhouette clear
    const skyC = skyB(cam.y + (sy - 540) / z, clamp(sy / H));
    skyPuff(ctx, sx, sy, w, 900 + k, mixColor('#ffd9e4', skyC, 0.3 + 0.4 * (1 - p)), mixColor('#e39ab8', skyC, 0.35), LW * z * p * 1.4);
  }
  // --- cloud sea: far + mid rows (behind the rocket)
  const cols = {
    far: { fill: mixColor(CLOUD, '#f3a7c0', 0.35), shade: mixColor(CLOUD_SH, '#c889b4', 0.4) },
    mid: { fill: CLOUD, shade: CLOUD_SH },
  };
  cloudRow(ctx, cam, -70, 0.55, 401, 45, 85, 120, cols.far, null);
  const syTop = cloudRow(ctx, cam, 0, 1, 411, 80, 135, 170, cols.mid, lt2 > 0 ? { x: 960, r: 90 * z * ease.outCubic(clamp(lt2 / 0.2)) } : null);
  // the hole it tore in the cloud tops
  if (syTop < H + 60 && lt2 > 0) {
    const hr = 120 * z * ease.outCubic(clamp(lt2 / 0.25));
    ctx.fillStyle = mixColor(CLOUD_SH, '#a0607a', 0.4);
    ellipsePath(ctx, 960, syTop + 12 * z, hr, hr * 0.3); ctx.fill();
  }
  // --- exhaust trail punching up out of the clouds (a puff every 130 px of climb)
  {
    const climb = (l) => 20 - rocketY(l);
    const cNow = climb(lt2);
    for (let j = 0; j < 160; j++) {
      const cj = -300 + j * 100;
      if (cj > cNow) break;
      const ts = invAlt(climb, cj, -0.6, 3);
      const age = lt2 - ts;
      const yw = 20 - cj + 216 * RS + 200 + 20 * age;
      const sy = toSy(yw);
      const r = (100 + 50 * hash01(j, 61)) * (0.8 + 0.5 * ease.outCubic(clamp(age / 1.2))) * z;
      if (sy - r > H || sy + r < -20 || yw > 60) continue;
      const sx = 960 + (40 * (hash01(j, 62) - 0.5) - 70 * age) * z;
      const skyC = skyB(yw, clamp(sy / H));
      smokePuff(ctx, sx, sy, r, { seed: 300 + j, u: clamp(0.32 + age / 2.2, 0, 0.97), fill: mixColor('#fff0ea', skyC, 0.2), shadeCol: mixColor(CLOUD_SH, skyC, 0.3), lw: LW * 0.8, n: 6 });
    }
  }
  // --- birds
  flock(ctx, t, cam);
  // --- speed lines streaming past the hull once we're really moving
  const yb = rocketY(lt2);
  const rsy = toSy(yb);
  const spd = smoothstep(0.6, 1.0, lt2) * (1 - smoothstep(T_EXIT - T_PUNCH + 0.2, T_EXIT - T_PUNCH + 0.5, lt2));
  if (spd > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const sg = i % 2 ? 1 : -1;
      const x = 960 + sg * (170 + 170 * hash01(i, 41)) * RB * 1.6;
      const ph = (hash01(i, 42) + (t - T_PUNCH) * (2.6 + 1.2 * hash01(i, 43))) % 1;
      const y0 = rsy - 900 * RB + ph * 1300 * RB * 1.6;
      const len = (260 + 260 * hash01(i, 44)) * RB;
      ctx.globalAlpha = spd * Math.sin(Math.PI * ph) * 0.45;
      ctx.strokeStyle = '#ffe9f4';
      ctx.lineWidth = 9 + 6 * hash01(i, 45);
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + len); ctx.stroke();
    }
    ctx.restore();
  }
  // --- the rocket (booster flaming; BOOST on beat 3)
  const boost = clamp((t - T_EXIT) / 0.08) * (1 + 0.4 * Math.exp(-6 * Math.max(0, t - T_EXIT)));
  const swayA = 0.03 * sway(t, 2) * smoothstep(0.6, 1.0, lt2); // tempo-locked waggle while it climbs
  // BOOST on beat 3: squash in anticipation, then stretch as it shoots off
  const pre = smoothstep(T_EXIT - 0.12, T_EXIT - 0.02, t) * (t < T_EXIT ? 1 : 0);
  const post = t >= T_EXIT ? Math.exp(-5 * (t - T_EXIT)) : 0;
  const sy = 1 - 0.08 * pre + 0.14 * post + (t >= T_EXIT ? 0.04 : 0);
  ctx.save();
  ctx.translate(960, rsy - 300 * RB); ctx.rotate(swayA); ctx.translate(-960, -(rsy - 300 * RB));
  ctx.translate(960, rsy); ctx.scale(1 / Math.sqrt(sy), sy); ctx.translate(-960, -rsy);
  drawRocket(ctx, 960, rsy, RB, {
    t, booster: true, stickers: true, flame: 1.2 + 0.4 * boost, shake: 0.25 * kick(t) + 0.5 * Math.exp(-6 * Math.max(0, lt2)), light: TINT,
    crew: true,
    crewPose: {
      // gasp at the frozen flock → giggle as it scatters → big grin; Biscuit's tongue flaps in the wind
      girl: { expr: lt2 > FREEZE && t < T_SCATTER ? 'surprised' : t < T_SCATTER + 0.75 && t >= T_SCATTER ? 'laugh' : 'grin' },
      dog: { expr: lt2 > FREEZE && t < T_SCATTER ? 'surprised' : 'happy', sunglasses: true, tongue: t >= T_SCATTER ? 1 : 0 },
    },
  });
  // vapour curls streaming off the fin tips
  if (spd > 0) {
    ctx.save();
    ctx.strokeStyle = rgba('#ffffff', 0.45 * spd); ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      const fx = 960 + sg * 232 * RB, fy = rsy - 12 * RB;
      ctx.moveTo(fx, fy);
      for (let j = 1; j <= 8; j++) {
        const v = j / 8;
        ctx.lineTo(fx + sg * 26 * v * RB + 14 * Math.sin(v * 7 - t * 16 + sg) * v, fy + v * 420 * RB);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  // cloud tufts clinging to the hull, peeling off
  if (lt2 < 0.6) {
    for (let i = 0; i < 2; i++) {
      const lx = [-205, 210][i], ly = [-60, -90][i];
      const peel = clamp((lt2 - 0.04 * i) / 0.55);
      const sx = 960 + (lx + Math.sign(lx) * 160 * ease.outQuad(peel)) * RB;
      const sy = rsy + (ly + 700 * peel * peel + 120 * peel) * RB;
      smokePuff(ctx, sx, sy, (60 + 20 * hash01(i, 5)) * RB, { seed: 500 + i, u: 0.3 + 0.69 * peel, fill: CLOUD, shadeCol: CLOUD_SH, lw: LW * 0.8, n: 5 });
    }
  }
  // --- front cloud row (covers the base of the rocket as it emerges)
  cloudRow(ctx, cam, 110, 1.35, 421, 120, 190, 230, cols.mid, lt2 > 0 ? { x: 960, r: 70 * z * ease.outCubic(clamp(lt2 / 0.25)) } : null);
  // --- punch burst: shock ring + flung cloud puffs
  if (lt2 >= 0 && lt2 < 1.3) {
    const e = ease.outCubic(clamp(lt2 / 0.32));
    const ringA = 1 - clamp(lt2 / 0.32);
    if (ringA > 0) {
      ctx.save();
      ctx.strokeStyle = rgba('#ffffff', 0.8 * ringA);
      ctx.lineWidth = 14 * ringA + 2;
      ellipsePath(ctx, 960, syTop, 120 + 760 * e, (120 + 760 * e) * 0.2); ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const a = (i % 2 ? -0.12 - 0.55 * (i / 9) : -Math.PI + 0.12 + 0.55 * (i / 9)) + (hash01(i, 31) - 0.5) * 0.2;
      const d = (340 + 320 * hash01(i, 32)) * ease.outCubic(clamp(lt2 / 0.8));
      const xw = 960 + Math.sign(Math.cos(a)) * 120 + Math.cos(a) * d * 1.5;
      const yw = -20 + Math.sin(a) * d * 0.6 + 200 * lt2 * lt2;
      const r = (95 + 55 * hash01(i, 33)) * z;
      smokePuff(ctx, 960 + (xw - 960) * z, toSy(yw), r, { seed: 600 + i, u: clamp(0.25 + lt2 / 1.3, 0, 0.99), fill: CLOUD, shadeCol: CLOUD_SH, lw: LW * 0.9, n: 6 });
    }
    const fl = Math.exp(-14 * lt2); // impact frame: white burst on the downbeat
    if (fl > 0.02) glow(ctx, 960, syTop - 40, 520, '#ffffff', 0.7 * fl);
    // cartoon burst lines fanning up out of the hole for a few frames
    const bl = clamp(lt2 / 0.28);
    if (bl < 1) {
      ctx.save();
      ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9 * (1 - bl);
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI * (0.06 + 0.88 * (i / 11)) + 0.06 * (hash01(i, 71) - 0.5);
        const r0 = (260 + 60 * hash01(i, 72)) * z + 520 * z * ease.outCubic(bl);
        const r1 = r0 + (150 + 120 * hash01(i, 73)) * z * (1 - bl);
        ctx.lineWidth = (10 + 6 * hash01(i, 74)) * (1 - 0.5 * bl);
        ctx.beginPath();
        ctx.moveTo(960 + Math.cos(a) * r0 * 1.35, syTop - 60 + Math.sin(a) * r0);
        ctx.lineTo(960 + Math.cos(a) * r1 * 1.35, syTop - 60 + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // --- "ting" glint as the nose leaves the top of frame
  if (t > T_EXIT) {
    // find when the nose crossed y = 0 (sample backwards; cheap)
    let tc = null;
    for (let k = 0; k <= 20; k++) {
      const tt = t - k * 0.02;
      if (tt < T_EXIT) break;
      const c2 = camB(tt);
      if (540 + (rocketY(tt - T_PUNCH) - NOSE - c2.y) * c2.zoom <= 20) tc = tt; else break;
    }
    if (tc !== null) {
      const k = Math.sin(Math.PI * clamp((t - tc) / 0.35));
      if (k > 0) { glow(ctx, 960, 34, 240, '#fff2b0', 0.55 * k); sparkle(ctx, 960, 34, 110 * k, '#fff6d0', k); }
    }
  }
  ctx.restore();
}

export default {
  id: 's07_liftoff',
  start: 38.537,
  end: 43.338,
  transition: { type: 'flash', dur: 0.3 }, // short: the ignition burst must read by ~38.7
  draw(ctx, t) {
    if (t < T_PUNCH) shotA(ctx, Math.max(t, T_IGN - 1.5));
    else shotB(ctx, Math.min(t, T_END + 1.5));
  },
};
