// s02_soot — the aftermath. 7.34 → 16.94 (bars 3–6). Medium shot, the smoke parts to reveal
// Juno and Biscuit blackened, frizzed and frozen exactly as they were when it went bang.
//
// Beat plan (absolute seconds; hits fire on the frame nearest the beat — see LEAD in s01):
//   7.34  bar 3   straight cut through the smoke (same smokeWall as the end of s01); it parts to
//                 reveal a WIDE aftermath shot (both of them, doghouse, smoking crater), slow creep in
//   7.94  b1      blink (both, in sync) — white eyes in black faces
//   8.54  b2      blink again; Biscuit's paws slide off his ears
//   8.99  b2.75   Juno coughs a smoke ring
//   9.14  b3      "ah sh—": camera SNAPS in; "AH" O-mouth (9.14–9.31) then gritted-teeth rage, head
//                 jabbing with the vocal stem; spiky grawlix bubble "#@⚡%&!" one glyph per 16th;
//                 Biscuit looks up at her, ears droop
//  10.94  b4.3   bubble pops away, camera eases out to the medium two-shot
//  11.24  b4.3.5 the sigh: shoulders slump, a sooty exhale; the remote slips from her hand …
//  11.54  b4.4   … and clonks onto the lawn (little dust tufts)
//  11.84  b4.4.5 a whistle: Biscuit's ears prick, he looks up — the cone tumbles into frame
//  12.14  bar 5  BONK: the traffic cone (launched in s01) lands on Biscuit's head, dazed, party hat
//  12.74  b1     Juno rubs her eyes with both fists (16th-note rubs) …
//  13.34  b2     … hands whip down ON the beat: two clean circles round her eyes (+ ting)
//  13.49  b2.25  she whips out the old TEST #1 blueprint, 13.94 (b4) scrunches it,
//  14.24  b4.5   and tosses it over her shoulder
//  14.54  bar 6  whips out a NEW rolled blueprint — it unrolls: "S.S. BISCUIT — TAKE 2!"; lean in
//  15.14  b1     "again": fist punched up ON the beat (the sheet swings down from her left hand),
//                Biscuit barks WOOF (jaw wide on the beat)
//  16.24  —      total silence: hard cut to a tight two-shot, everything frozen at 16.24; both turn
//                to the lens (16.27–16.49), deadpan; one slow blink at 16.62; pixel-still to the cut.
import { W, H, PAL, INK, LW, FONT, camera, shake, cartoonText, speechBubble, smokePuff, glow, sparkle,
  cartoonStar, circlePath, ellipsePath, ink, speedLines, blobs } from '../draw.js';
import { clamp, lerp, ease, tween, spring, wobble, hash01, noise1, mixColor, rgba, TAU, smoothstep } from '../util.js';
import { barTime, beatAt, env, MOMENTS } from '../timing.js';
import { drawBackyard, longShadow, todTint } from '../props/backyard.js';
import { drawGirl, girlAnchors } from '../characters/girl.js';
import { drawDog, dogAnchors } from '../characters/dog.js';
import { drawTestDebris } from '../props/rockets.js';
import { remote, trafficCone, blueprint, BLUEPRINT_W } from '../props/items.js';
import { smokeWall, smokeCover, drawFallout, LEAD, S } from './s01_test_launch.js';

// ------------------------------------------------------------------ beat grid
const on = (k, b = 0) => barTime(k, b) - LEAD;
const T_CUT = barTime(3); // 7.34
const BLINKS = [on(3, 1), on(3, 2)]; // 7.94, 8.54
const T_PAWS = on(3, 2); // 8.54 paws slide down
const T_COUGH = on(3, 2.75); // 8.99
const T_SWEAR = on(3, 3); // 9.14 bubble
const T_AH_END = 9.31; // measured: the dip in the vocal stem between "AH—" and "sh—"
const T_BUBBLE_OUT = on(4, 2); // 10.94
const T_SIGH = on(4, 2.5); // 11.24
const T_CLONK = on(4, 3); // 11.54 remote hits the lawn
const T_WHISTLE = on(4, 3.5); // 11.84 Biscuit hears the whistle: ears prick, he looks up …
const T_CONE = on(5); // 12.14 BONK
const T_RUB = on(5, 1); // 12.74
const T_RINGS = on(5, 2); // 13.34
const T_OLD = on(5, 2.25); // 13.49 old blueprint out
const T_SCRUNCH = on(5, 3); // 13.94
const T_TOSS = on(5, 3.5); // 14.24
const T_NEW = on(6); // 14.54
const T_UNROLLED = on(6, 0.5); // 14.84
const T_PUMP = on(6, 1); // 15.14
const T_FREEZE = MOMENTS.silence - LEAD; // 16.24 (measured: the sound stops) — hard cut to the stare
const T_FLAT = T_FREEZE + 0.06; // 16.30 the grins drop (2 frames of frozen celebration first)
const T_TURN = [T_FREEZE + 0.03, T_FREEZE + 0.25]; // 16.27 → 16.49 both turn to the lens (then STILL)
const T_LAST_BLINK = on(6, 3.5); // 16.62 — one slow deadpan blink on the silent 8th, open again
//                                   by 16.80 so the eyes are wide open for the last frames
const END = barTime(7); // 16.94

const GOLD = todTint('golden');
const LIGHT = { mul: GOLD.mul, add: GOLD.add, addAmt: GOLD.addAmt, k: 0.7 };
const SOOT_SKIN = mixColor('#f2c49b', PAL.soot, 0.86);
// s01 had them at x 600 / 716; the blast scooted them a little (unseen in the smoke) so the medium
// shot holds them, the doghouse and the smoking wreck together. (Biscuit sits on his bone.)
const JUNO = [642, 884];
const DOG = [747, 890];

// ------------------------------------------------------------------ helpers
const arm = (a, b, hand = 'fist') => ({ a, b, hand });
const mixArm = (A, B, k) => ({ a: lerp(A.a, B.a, k), b: lerp(A.b, B.b, k), hand: k < 0.5 ? A.hand : B.hand });
// quick eye blink: shut ON the beat (one frame of close-in before), reopen over ~0.14 s
function blinkAt(t, bt, hold = 0.05, open = 0.16) {
  const d = t - bt;
  if (d < -0.04 || d > hold + open) return 0;
  if (d < 0) return 1 + d / 0.04;
  if (d < hold) return 1;
  return 1 - (d - hold) / open;
}
const speech = (t) => clamp((env('vocals', t) - 0.05) * 1.7);

// ------------------------------------------------------------------ camera
// (world points at screen centre) — one idea per framing:
const CAM_WIDE = { x: 905, y: 700, zoom: 2.05 }; // the aftermath: both of them, doghouse, smoking crater
const CAM_CREEP = { x: 850, y: 712, zoom: 2.3 }; // slow creep-in over the two blinks
const CAM_SWEAR = { x: 712, y: 702, zoom: 2.85 }; // SNAP in on "ah sh—" (Juno + bubble)
const CAM_MED = { x: 772, y: 738, zoom: 2.5 }; // medium two-shot: sigh, BONK, rub, blueprints
const CAM_TAKE2 = { x: 730, y: 748, zoom: 2.72 }; // lean in on the TAKE 2 reveal
const lerpCam = (A, B, k) => ({ x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), zoom: lerp(A.zoom, B.zoom, k) });
function camBase(t) {
  let c = lerpCam(CAM_WIDE, CAM_CREEP, ease.inOutSine(clamp((t - T_CUT - 0.3) / (T_SWEAR - T_CUT - 0.45))));
  // punch-in lands ON the swear (2-frame snap, small overshoot)
  c = lerpCam(c, CAM_SWEAR, ease.outBack(clamp((t - T_SWEAR + 0.02) / 0.13), 1.4));
  c = lerpCam(c, CAM_MED, ease.inOutSine(clamp((t - T_BUBBLE_OUT - 0.05) / 0.6)));
  c = lerpCam(c, CAM_TAKE2, ease.inOutSine(clamp((t - T_NEW) / 0.45)));
  return c;
}
// the silence: hard cut to a still two-shot for the deadpan stare into the lens
const CAM_STARE = { x: 708, y: 757, zoom: 3.75, dx: 0, dy: 0, rot: 0 };
function cam(t) {
  if (t >= T_FREEZE) return CAM_STARE;
  const c = camBase(t);
  const s1 = shake(t, T_CONE, 16, 7, 24), s2 = shake(t, T_CLONK, 5, 12, 30), s3 = shake(t, T_PUMP, 7, 9, 26);
  return { ...c, dx: s1.dx + s2.dx + s3.dx, dy: s1.dy + s2.dy + s3.dy, rot: 0 }; // no rot: keeps the backyard on its fast path
}
const toScreen = (c, [x, y]) => [W / 2 + c.dx + (x - c.x) * c.zoom, H / 2 + c.dy + (y - c.y) * c.zoom];

// ------------------------------------------------------------------ Juno
function sootyRemote(pressed) {
  return (ctx, info) => {
    ctx.rotate(-info.angle);
    if (info.dir < 0) ctx.scale(-1, 1);
    ctx.translate(2, -30);
    ctx.scale(0.62, 0.62);
    drawSootyRemote(ctx, pressed);
  };
}
function drawSootyRemote(ctx, pressed) {
  remote(ctx, { pressed });
  ctx.save();
  ctx.fillStyle = rgba(PAL.soot, 0.5);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(-24 + 13 * i, -30 + 22 * hash01(i, 3), 13, 9, 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// which blueprint is in her hands (and how)
function sheetState(t) {
  if (t >= T_OLD && t < T_TOSS) return { which: 'old', pop: ease.outBack(clamp((t - T_OLD + 0.03) / 0.1), 2.5), crumple: ease.inOutCubic(clamp((t - (T_SCRUNCH - 0.16)) / 0.16)) };
  if (t >= T_NEW) return { which: 'new', pop: ease.outBack(clamp((t - T_NEW + 0.03) / 0.1), 2.5), open: ease.outBounce(clamp((t - (T_NEW + 0.04)) / (T_UNROLLED - T_NEW - 0.04))) };
  return null;
}

function junoPose(tReal) {
  // "everything freezes" in the silence: every automatic/decaying motion is evaluated at 16.24;
  // only the turn to the lens and the blink (the freeze block below) use the real time
  const t = Math.min(tReal, T_FREEZE);
  const pose = {
    t, facing: 0.6, stance: 'stand', soot: 1, frizz: 1, goggles: 'askew', light: LIGHT,
    expr: 'alert', mouth: 0, blink: 0,
  };
  // frozen exactly as the blast left her: remote thrust out, left arm flung up
  const THRUST = arm(1.05, 0.42), FLUNG = arm(0.22, 0.08, 'fist');
  let armR = THRUST, armL = FLUNG;
  let squash = 1, tilt = 0.1, headTilt = 0, lift = 0;
  let remoteInHand = true;
  // blinks
  let blink = Math.max(blinkAt(t, BLINKS[0]), blinkAt(t, BLINKS[1]));
  // --- the cough (anticipation: chest swells, then a jolt)
  if (t >= T_COUGH - 0.15) {
    const k = t < T_COUGH ? ease.inOutSine((t - T_COUGH + 0.15) / 0.15) : 0;
    squash *= 1 + 0.035 * k - (t >= T_COUGH ? 0.05 * Math.exp(-(t - T_COUGH) * 12) : 0);
    if (t >= T_COUGH && t < T_SWEAR) { pose.expr = 'surprised'; pose.mouth = 0.45 * Math.exp(-(t - T_COUGH) * 5); }
    armL = mixArm(FLUNG, arm(0.35, 0.15), ease.inOutCubic(clamp((t - T_COUGH + 0.1) / 0.25)));
    tilt = lerp(0.1, 0, ease.inOutCubic(clamp((t - T_COUGH + 0.1) / 0.3)));
  }
  // --- "ah sh—": yell with fists clenched, shaking with rage
  if (t >= T_SWEAR - 0.03 && t < T_BUBBLE_OUT + 0.1) {
    // (full soot hides her brows, so an open mouth reads as a laugh: the rage has to be the
    // squeezed >< eyes + gritted teeth.) "AH—" is a wide O for a few frames, then "sh—" GRRR.
    const sp = speech(t);
    if (t < T_AH_END) { pose.expr = 'surprised'; pose.mouth = 0.75 + 0.25 * sp; }
    else { pose.expr = 'wince'; pose.mouth = undefined; }
    const rage = (0.6 + 0.4 * sp) * (1 - clamp((t - T_BUBBLE_OUT) / 0.1));
    tilt = 0.025 * rage * noise1(t * 26, 5);
    // the head jabs forward with every loud syllable
    headTilt = -0.1 - 0.07 * sp + 0.035 * rage * noise1(t * 22, 9);
    squash *= 1 + 0.03 * ease.outBack(clamp((t - T_SWEAR) / 0.1), 3) - 0.025 * sp;
    armL = arm(0.42 + 0.06 * rage * noise1(t * 24, 3), 0.25);
    armR = mixArm(THRUST, arm(0.55 + 0.08 * rage * noise1(t * 24, 4), 0.6), ease.outBack(clamp((t - T_SWEAR) / 0.12)));
  }
  // --- the sigh
  if (t >= T_BUBBLE_OUT + 0.1) {
    const k = ease.inOutSine(clamp((t - T_SIGH) / 0.55));
    pose.expr = 'sad';
    pose.mouth = 0.35 * speech(t) + (t > T_SIGH && t < T_SIGH + 0.5 ? 0.25 * Math.sin(Math.PI * (t - T_SIGH) / 0.5) : 0);
    squash = lerp(1, 0.93, k);
    headTilt = 0.16 * k;
    tilt = -0.02 * k;
    const LIMP = arm(0.05, 0.05, 'open');
    armL = mixArm(arm(0.42, 0.25), LIMP, k);
    armR = mixArm(arm(0.55, 0.6), LIMP, ease.inOutSine(clamp((t - T_SIGH + 0.05) / 0.3)));
    if (t >= T_SIGH + 0.02) remoteInHand = false;
  }
  // --- BONK next to her: flinch + look
  if (t >= T_CONE) {
    const d = t - T_CONE;
    squash *= 1 - 0.06 * Math.exp(-d * 10);
    if (d < 0.6) { pose.expr = 'surprised'; pose.look = [1, 0.4]; headTilt = lerp(0.16, 0.05, clamp(d / 0.12)); }
    else pose.look = [0.6, 0.3];
  }
  // --- rub eyes: both fists up, alternating 16th-note rubs; hands drop on b2 → clean rings
  if (t >= T_RUB - 0.12) {
    const up = ease.inOutCubic(clamp((t - T_RUB + 0.12) / 0.14));
    const down = ease.inOutCubic(clamp((t - T_RINGS + 0.1) / 0.1)); // hands whip down, done ON the beat
    const k = up * (1 - down);
    const rub = t >= T_RUB && t < T_RINGS - 0.1 ? Math.sin(TAU * 2 * beatAt(t)) : 0; // 2 rubs per beat
    const RUBL = arm(2.9 + 0.09 * rub, 0.35 - 0.1 * rub), RUBR = arm(2.9 - 0.09 * rub, 0.35 + 0.1 * rub);
    const REST = arm(0.1, 0.15, 'open');
    // via an elbows-out / fists-up key, so the arms fold up to the face instead of swinging
    // out through a T-pose
    const MID = arm(1.15, 1.85, 'fist');
    const path = (A) => (k < 0.5 ? mixArm(REST, MID, k * 2) : mixArm(MID, A, k * 2 - 1));
    armL = path(RUBL); armR = path(RUBR);
    if (k > 0.3) pose.expr = 'wince';
    headTilt = lerp(0.05, -0.03, k) + 0.03 * rub * k;
    pose.cleanGoggleRings = ease.inCubic(clamp((t - T_RUB) / (T_RINGS - T_RUB)));
    if (t >= T_RINGS - 0.02) {
      pose.cleanGoggleRings = 1;
      pose.expr = 'alert'; pose.look = [0.2, 0];
      blink = Math.max(blink, blinkAt(t, T_RINGS + 0.15, 0.02));
    }
  }
  // --- the old blueprint: out, scrunch, toss
  const sh = sheetState(t);
  if (t >= T_OLD - 0.08 && t < T_NEW - 0.1) {
    const HOLD = arm(0.95, 0.75, 'fist');
    const kin = ease.outBack(clamp((t - T_OLD + 0.08) / 0.1), 2);
    armL = mixArm(armL, HOLD, kin);
    armR = mixArm(armR, HOLD, kin);
    pose.expr = 'sad'; pose.look = [0.3, 0.9];
    pose.mouth = 0.6 * speech(t);
    if (t >= T_SCRUNCH - 0.16) {
      // squeeze the hands together
      const kc = ease.inOutCubic(clamp((t - T_SCRUNCH + 0.16) / 0.16));
      armL = mixArm(HOLD, arm(0.62, -1.05, 'fist'), kc);
      armR = mixArm(HOLD, arm(0.62, -1.05, 'fist'), kc);
      pose.expr = 'annoyed';
      squash *= 1 - 0.05 * Math.exp(-Math.max(0, t - T_SCRUNCH) * 10) * (t >= T_SCRUNCH ? 1 : 0);
    }
    if (t >= T_SCRUNCH) {
      // wind up (ball in right hand) … and toss it over her shoulder
      const kw = ease.inOutCubic(clamp((t - T_SCRUNCH - 0.02) / (T_TOSS - T_SCRUNCH - 0.02)));
      armL = mixArm(arm(0.62, -1.05, 'fist'), arm(0.2, 0.2, 'open'), clamp(kw * 1.5));
      armR = mixArm(arm(0.62, -1.05, 'fist'), arm(2.2, 1.0, 'fist'), kw);
      tilt = -0.05 * kw;
      if (t >= T_TOSS) {
        const kt = ease.outBack(clamp((t - T_TOSS) / 0.1), 2);
        armR = mixArm(arm(2.2, 1.0, 'fist'), arm(2.7, -0.4, 'open'), kt);
        tilt = lerp(-0.05, 0.04, kt);
      }
    }
  }
  // --- the new blueprint: out, unrolled, fist pump
  if (t >= T_NEW - 0.1) {
    const HOLD = arm(0.95, 0.75, 'fist');
    const kin = ease.outBack(clamp((t - T_NEW + 0.1) / 0.12), 2);
    armL = mixArm(armL, HOLD, kin);
    armR = mixArm(armR, HOLD, kin);
    pose.expr = 'determined'; pose.look = [0.2, 0.1];
    pose.mouth = 0.7 * speech(t);
    tilt = 0.03;
    if (t >= T_PUMP - 0.1) {
      // anticipation dip, then the pump ON the beat
      const TP = T_PUMP - 0.07; // the punch starts 2 frames early so the fist is UP on the beat
      const kd = t < TP ? ease.inOutSine(clamp((t - T_PUMP + 0.16) / 0.09)) : 0;
      const kp = t >= TP ? ease.outBack(clamp((t - TP) / 0.09), 2.2) : 0;
      squash *= 1 - 0.05 * kd + 0.05 * kp * Math.exp(-Math.max(0, t - T_PUMP) * 4) * (t >= TP ? 1 : 0);
      armR = mixArm(HOLD, arm(0.3, 1.6, 'fist'), kd);
      // fist punches up and out (clear of the frizz) ON "again"
      if (t >= TP) armR = mixArm(arm(0.3, 1.6, 'fist'), arm(2.05, 0.55, 'fist'), kp);
      pose.expr = t >= TP ? 'grin' : 'determined';
      lift = t >= TP ? 26 * Math.max(0, Math.sin(Math.PI * clamp((t - TP) / 0.3))) : 0;
      headTilt = -0.05 * kp;
    }
  }
  // --- the silence: freeze, then turn to the lens (deadpan)
  if (tReal >= T_FREEZE) {
    const kt = ease.inOutSine(clamp((tReal - T_TURN[0]) / (T_TURN[1] - T_TURN[0])));
    pose.facing = lerp(0.6, 0.0001, kt);
    pose.look = [lerp(0.2, 0, kt), lerp(0.1, 0, kt)];
    if (tReal >= T_FLAT) { pose.expr = 'annoyed'; pose.mouth = 0; }
    headTilt = lerp(headTilt, 0, kt);
    blink = blinkAt(tReal, T_LAST_BLINK, 0.07, 0.12);
  }
  Object.assign(pose, { armL, armR, squash, tilt, headTilt, lift, blink });
  if (remoteInHand) pose.holdR = sootyRemote(1);
  return pose;
}

// ------------------------------------------------------------------ Biscuit
function coneHat(t) {
  const d = t - T_CONE;
  const tt = Math.min(t, T_FREEZE);
  // lands with a squash, then bounces with the bark
  const sq = 0.35 * wobble(t, T_CONE, 4, 7);
  const hop = t >= T_PUMP ? 18 * Math.max(0, Math.sin(Math.PI * clamp((t - T_PUMP) / 0.22))) : 0;
  return (ctx) => {
    ctx.save();
    ctx.translate(0, -hop + 6);
    ctx.rotate(0.12 + 0.1 * wobble(t, T_CONE, 3, 5) + (hop ? 0.15 * Math.sin(Math.PI * clamp((t - T_PUMP) / 0.22)) : 0));
    ctx.scale(1 + sq, 1 - sq);
    trafficCone(ctx, { charred: 0.75, t: tt, smoke: clamp(1 - d / 3) * 0.8 });
    ctx.restore();
  };
}
function dogPose(tReal) {
  const t = Math.min(tReal, T_FREEZE); // frozen in the silence (see junoPose)
  const pose = { t, stance: 'sit', facing: 1, soot: 1, frizz: 1, light: LIGHT, expr: 'alert', pawsUp: 1, wag: 0, tail: 2.4, blink: 0 };
  let squash = 1, blink = Math.max(blinkAt(t, BLINKS[0]), blinkAt(t, BLINKS[1]));
  // paws slide off the ears (after the 2nd blink)
  pose.pawsUp = 1 - ease.inOutCubic(clamp((t - T_PAWS - 0.12) / 0.35));
  if (t > T_PAWS + 0.12) pose.ears = lerp(0.9, -0.2, ease.outBounce(clamp((t - T_PAWS - 0.25) / 0.4)));
  // looks up at Juno during the swear, ears drooping
  if (t >= T_SWEAR + 0.2) {
    pose.facing = -1;
    pose.look = [0.55, -0.8];
    pose.ears = lerp(0.3, -0.5, ease.inOutSine(clamp((t - T_SWEAR - 0.6) / 0.5)));
    pose.expr = 'surprised'; pose.mouth = 0.15;
    if (t > T_SWEAR + 0.7) { pose.expr = 'sad'; pose.mouth = undefined; }
    pose.headTilt = -0.12;
  }
  if (t >= T_SIGH) { pose.expr = 'sad'; pose.look = [0.5, -0.5]; pose.headTilt = 0; }
  // … a whistle from above: ears prick, eyes roll up to the sky (the cone is coming)
  if (t >= T_WHISTLE && t < T_CONE) {
    const k = ease.outBack(clamp((t - T_WHISTLE) / 0.1), 2.5);
    pose.expr = 'alert'; pose.look = [0.15, -1]; pose.ears = lerp(-0.3, 1, k); pose.mouth = undefined;
    pose.headTilt = -0.16 * k;
    squash *= 1 + 0.04 * k;
  }
  // BONK
  if (t >= T_CONE) {
    const d = t - T_CONE;
    pose.hat = coneHat(t);
    squash = 1 - 0.28 * Math.exp(-d * 6) * Math.cos(d * 22);
    pose.expr = 'dazed'; pose.look = undefined; pose.ears = undefined; pose.headTilt = 0.1 * Math.sin(d * 6) * Math.exp(-d);
    if (t >= T_RINGS) { pose.expr = 'annoyed'; pose.look = [0.7, -0.4]; pose.headTilt = 0; }
  } else if (t >= T_CONE - 0.02) squash = 0.9;
  // the TAKE 2 blueprint: excited, then the bark
  if (t >= T_NEW + 0.1) {
    pose.expr = 'excited'; pose.look = [0.7, -0.3]; pose.wag = 1.2; pose.tail = undefined;
    if (t >= T_PUMP - 0.08) {
      const d = t - T_PUMP;
      const k = d < 0 ? clamp((d + 0.05) / 0.05) : 1 - ease.inQuad(clamp(d / 0.35)); // jaw wide ON the beat
      pose.mouth = k; pose.ears = 1;
      squash *= d < 0 ? 0.94 : 1 + 0.08 * k;
      pose.headTilt = -0.15 * k;
    }
  }
  // the silence: freeze, then turn to camera
  if (tReal >= T_FREEZE) {
    const kt = ease.inOutSine(clamp((tReal - T_TURN[0] - 0.03) / (T_TURN[1] - T_TURN[0])));
    pose.turn = 1 - kt;
    pose.look = [lerp(0.7, 0, kt), lerp(-0.3, 0, kt)];
    pose.headTilt = lerp(pose.headTilt || 0, 0, kt);
    if (tReal >= T_FLAT) { pose.expr = 'annoyed'; pose.mouth = 0; pose.ears = 0.2; }
    pose.wag = 0; pose.tail = 2.2;
    blink = blinkAt(tReal, T_LAST_BLINK, 0.07, 0.12);
  }
  pose.squash = squash; pose.blink = blink;
  return pose;
}

// ------------------------------------------------------------------ props & fx
// debris that rained down in s01, now lying around the lawn
const LITTER = [
  { kind: 'fin', x: 1000, y: 884, rot: 2.5, sc: 1, ch: 0.6 },
  { kind: 'tape', x: 492, y: 902, rot: 0.3, sc: 1.2, ch: 0.5 },
  { kind: 'bolt', x: 868, y: 904, rot: 0.5, sc: 1.2, ch: 0.4 },
  { kind: 'bolt', x: 566, y: 914, rot: -0.9, sc: 1.2, ch: 0.4 },
  { kind: 'lid', x: 1112, y: 898, rot: 3.0, sc: 0.95, ch: 0.8 },
  { kind: 'can', x: 1245, y: 862, rot: 0.25, sc: 1, ch: 0.9 },
];
function drawLitter(ctx, t) {
  for (const L of LITTER) drawTestDebris(ctx, L.kind, L.x, L.y, S * L.sc, { rot: L.rot, charred: L.ch, t, light: LIGHT });
}

function drawRemoteDrop(ctx, t) {
  if (t < T_SIGH + 0.02) return;
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(T_SIGH + 0.01));
  const p0 = [A.handR[0], A.handR[1] - 14], p1 = [JUNO[0] + 48, JUNO[1] + 14];
  const u = clamp((t - T_SIGH - 0.02) / (T_CLONK - T_SIGH - 0.02));
  let x = lerp(p0[0], p1[0], u), y = lerp(p0[1], p1[1], u * u);
  let rot = lerp(0, 1.45, ease.inQuad(u));
  if (t > T_CLONK) { // little bounce
    const d = t - T_CLONK;
    y -= 10 * Math.max(0, Math.sin(Math.PI * clamp(d / 0.18)));
    rot = 1.45 + 0.12 * wobble(t, T_CLONK, 5, 8);
  }
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(S * 0.62, S * 0.62);
  ctx.translate(0, 5);
  drawSootyRemote(ctx, 1);
  ctx.restore();
  if (t > T_CLONK && t < T_CLONK + 0.4) {
    // two little tufts of dust kicked out sideways
    const u2 = (t - T_CLONK) / 0.4;
    const o = { u: 0.15 + 0.85 * u2, n: 3, lw: 1.6, fill: '#d8ccb2', shadeCol: '#b3a589' };
    smokePuff(ctx, p1[0] - 14 - 14 * ease.outCubic(u2), p1[1] + 6, 8, { ...o, seed: 5 });
    smokePuff(ctx, p1[0] + 16 + 14 * ease.outCubic(u2), p1[1] + 6, 7, { ...o, seed: 9 });
  }
}

// smoke ring coughed out of her mouth
function drawSmokeRing(ctx, t) {
  const d = t - T_COUGH;
  if (d < 0 || d > 0.85) return; // gone before the bubble fills up
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(T_COUGH));
  const u = d / 0.85;
  // puffed out sideways, drifting right (away from where the bubble will be) and a little up
  const x = A.mouth[0] + 30 + 95 * ease.outCubic(clamp(d / 0.6)) + 6 * Math.sin(d * 5);
  const y = A.mouth[1] - 4 - 45 * ease.outCubic(u) - 10 * d;
  const r = 5 + 18 * ease.outCubic(clamp(d / 0.5)) + 6 * u;
  // a donut of little puffs (one union outline) — reads as smoke, not as a metal washer
  const n = 9, pr = r * 0.36 + 1.5;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + d * 1.5;
    const k = 1 + 0.12 * Math.sin(i * 2.3 + d * 7);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, pr * k]);
  }
  ctx.save();
  ctx.globalAlpha *= 1 - ease.inCubic(u);
  blobs(ctx, pts, '#a79fb2', 2.2);
  blobs(ctx, pts.map(([px, py, rr]) => [px - rr * 0.18, py - rr * 0.22, rr * 0.62]), '#cdc6d6', 0);
  ctx.restore();
}
// sooty exhale on the sigh: three little puffs out of the mouth, sinking and fading
function drawSighPuff(ctx, t) {
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(T_SIGH + 0.25));
  for (let i = 0; i < 3; i++) {
    const d = t - T_SIGH - 0.05 - i * 0.08;
    if (d < 0 || d > 0.42) continue;
    const u = d / 0.42;
    smokePuff(ctx, A.mouth[0] + 10 + 40 * ease.outCubic(u) + i * 4, A.mouth[1] + 4 + 22 * u + i * 3, 7 + 6 * u, { seed: 41 + i, u: 0.2 + 0.8 * u, n: 3, lw: 1.8, fill: '#8a8296', shadeCol: '#6c6578' });
  }
}

// the grawlix bubble (screen space)
const GLYPHS = [['#', PAL.red], ['@', PAL.purple], ['bolt', PAL.yellow], ['%', PAL.orange], ['&', PAL.blue], ['!', PAL.red]];
function boltPath(ctx, x, y, s) {
  const P = [[-0.15, -1], [0.55, -1], [0.15, -0.2], [0.5, -0.2], [-0.35, 1.05], [-0.05, 0.12], [-0.45, 0.12]];
  ctx.beginPath();
  P.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)));
  ctx.closePath();
}
function drawGrawlix(ctx, t, c) {
  if (t < T_SWEAR - 0.03 || t > T_BUBBLE_OUT + 0.25) return;
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(t));
  const hd = toScreen(c, A.head);
  const pop = ease.outBack(clamp((t - T_SWEAR + 0.03) / 0.12), 2.6);
  const out = ease.inBack(clamp((t - T_BUBBLE_OUT) / 0.16), 2);
  const sc = pop * (1 - out);
  if (sc <= 0.01) return;
  const loud = speech(t);
  const jx = 6 * loud * noise1(t * 30, 1), jy = 5 * loud * noise1(t * 30, 2);
  // parked above her head as framed by the swear punch-in (fixed, so it doesn't swim with her)
  const cs = cam(T_SWEAR + 0.2);
  const h0 = toScreen(cs, girlAnchors(JUNO[0], JUNO[1], S, junoPose(T_SWEAR + 0.2)).head);
  const bx = clamp(h0[0] - 70, 420, W - 420) + jx, by = clamp(h0[1] - 345, 185, 420) + jy;
  const w = 740, h = 250;
  // tail aims past the right side of her (frizzed) head, toward the yelling mouth
  const hr = 80 * S * c.zoom * 1.25;
  speechBubble(ctx, bx, by, w, h, hd[0] + hr * 1.15, hd[1] + hr * 0.1, { spiky: true, scale: sc, lw: 9, seed: 4 + (Math.floor(t * 10) % 2) }, () => {
    const size = 150;
    const n = GLYPHS.length;
    const gap = 112;
    GLYPHS.forEach(([ch, col], i) => {
      const k = clamp((t - (T_SWEAR + i * 0.15) + 0.03) / 0.1);
      if (k <= 0) return;
      const s2 = ease.outBack(k, 3);
      const gx = bx + (i - (n - 1) / 2) * gap + 5 * noise1(t * 18, i * 5 + 1);
      const gy = by + 6 + (i % 2 ? -10 : 10) + 8 * noise1(t * 18, i * 5 + 2) - 12 * loud * Math.abs(noise1(t * 12, i));
      const rot = (i % 2 ? 0.14 : -0.12) + 0.12 * noise1(t * 14, i * 5 + 3);
      if (ch === 'bolt') {
        ctx.save();
        ctx.translate(gx, gy); ctx.rotate(rot); ctx.scale(s2, s2);
        boltPath(ctx, 4, 6, 62); ctx.fillStyle = rgba(INK, 0.35); ctx.fill();
        boltPath(ctx, 0, 0, 62); ink(ctx, col, 9);
        ctx.restore();
        return;
      }
      cartoonText(ctx, ch, gx, gy, { size, font: FONT.round, fill: col, scale: s2, rot, lw: 20, shadow: true });
    });
  });
}

// the cone falls from the sky (s01 launched it), BONK
function drawConeFall(ctx, t) {
  // falling under gravity: τ = time before impact, height above the crown = v·τ − g·τ²/2
  // (arrives at 1100 px/s; enters the medium shot's top edge ≈ 0.35 s = 10 frames before the hit)
  const tau = T_CONE - t;
  if (tau > 0.55 || tau <= 0) return;
  const pose = dogPose(T_CONE + 0.001);
  const cr = dogAnchors(DOG[0], DOG[1], S, { ...pose, squash: 1 }).crown;
  const y = cr[1] - (1100 * tau - 750 * tau * tau);
  const x = cr[0] + 70 * tau;
  const rot = 0.12 + tau * 9; // tumbling, lands point-up
  // whistle streaks trailing above it
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const len = 50 + 60 * clamp(tau / 0.3);
    ctx.beginPath(); ctx.moveTo(x - 14 + i * 14, y - 42 - i * 6); ctx.lineTo(x - 14 + i * 14 + 10, y - 42 - len - i * 10);
    ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 4; ctx.stroke();
  }
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(S, S); ctx.translate(0, 40);
  trafficCone(ctx, { charred: 0.75, t });
  ctx.restore();
}
function drawBonk(ctx, t, c) {
  const d = t - T_CONE;
  if (d < 0 || d > 0.7) return;
  const pose = dogPose(T_CONE + 0.001);
  const cr = dogAnchors(DOG[0], DOG[1], S, { ...pose, squash: 1 }).crown;
  const [x, y] = toScreen(c, [cr[0], cr[1] - 40]);
  const u = d / 0.7;
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    const r = 60 + 170 * ease.outCubic(u);
    const s = 26 * (1 - ease.inCubic(u)) * (0.8 + 0.4 * hash01(i, 7));
    if (s > 1) cartoonStar(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, s, i % 2 ? PAL.yellow : '#fff3a0', 4, u * 4 + i);
  }
  const kt = ease.outBack(clamp((d + 0.03) / 0.09), 3) * (1 - ease.inBack(clamp((d - 0.33) / 0.18)));
  cartoonText(ctx, 'BONK!', x + 250, y - 330, { size: 96, fill: PAL.yellow, scale: kt, rot: 0.18, lw: 14 });
  ctx.restore();
}
function drawRingsTing(ctx, t, c) {
  const d = t - T_RINGS;
  if (d < 0 || d > 0.45) return;
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(t));
  const k = ease.outBack(clamp(d / 0.08), 3) * (1 - clamp((d - 0.2) / 0.25));
  for (const e of [A.eyeL, A.eyeR]) {
    const [x, y] = toScreen(c, e);
    sparkle(ctx, x + 26, y - 26, 30 * k, '#ffffff', 1);
  }
}

// blueprints (world space, drawn in front of Juno)
function drawSheets(ctx, t) {
  const sh = sheetState(t);
  const tt = Math.min(t, T_FREEZE);
  if (sh) {
    const P = junoPose(t);
    const A = girlAnchors(JUNO[0], JUNO[1], S, P);
    const hl = A.handL, hr = A.handR;
    const sc = OLD_SC;
    ctx.save();
    if (sh.which === 'old') {
      const ball = sh.crumple >= 1;
      if (!ball) {
        const mx = (hl[0] + hr[0]) / 2, my = (hl[1] + hr[1]) / 2;
        ctx.translate(mx, my - 4); ctx.rotate(Math.atan2(hr[1] - hl[1], hr[0] - hl[0]) * (1 - sh.crumple));
        ctx.scale(sc * sh.pop, sc * sh.pop);
        blueprint(ctx, { open: 1, drawing: 'test', title: 'TEST #1', crumple: sh.crumple, t: tt });
        ctx.restore();
        drawThumbs(ctx, [hl, hr], sh.crumple < 0.6);
        return;
      }
      // the paper ball rides in her right hand
      ctx.translate(hr[0], hr[1] - 4); ctx.scale(sc, sc); ctx.translate(0, 0);
      blueprint(ctx, { open: 1, drawing: 'test', title: 'TEST #1', crumple: 1 });
      ctx.restore();
      return;
    }
    // the new one: unrolls downward from the top roll held in both hands; on the pump the
    // right hand lets go and it swings from the left
    const mx = (hl[0] + hr[0]) / 2, my = (hl[1] + hr[1]) / 2;
    if (t < T_PUMP - 0.07) {
      ctx.translate(mx, my - 4); ctx.rotate(Math.atan2(hr[1] - hl[1], hr[0] - hl[0]));
      ctx.scale(SHEET_SC * sh.pop, SHEET_SC * sh.pop);
      blueprint(ctx, { open: sh.open, drawing: 'rocket', title: 'S.S. BISCUIT — TAKE 2!', t: tt });
      ctx.restore();
      drawThumbs(ctx, [hl, hr], true);
      if (t < T_NEW + 0.3) whipLines(ctx, t, mx, my);
      return;
    }
    const sc0 = SHEET_SC;
    // let go with the pump hand: it drops and swings from the left-hand corner, settling at a
    // steep hang so it clears Biscuit
    const swing = 0.62 * spring(tt, T_PUMP - 0.07, 1.4, 3.2) + 0.03 * Math.sin(TAU * beatAt(tt) / 2) * clamp((tt - T_PUMP - 0.5) / 0.5);
    ctx.translate(hl[0], hl[1] - 4); ctx.rotate(swing);
    ctx.scale(sc0, sc0); ctx.translate(BLUEPRINT_W / 2, 0);
    blueprint(ctx, { open: 1, drawing: 'rocket', title: 'S.S. BISCUIT — TAKE 2!', t: tt });
    ctx.restore();
    drawThumbs(ctx, [hl], true);
    return;
  }
  // the scrunched ball flies over her shoulder
  if (t >= T_TOSS && t < T_TOSS + 1.2) {
    const P = junoPose(T_TOSS);
    const A = girlAnchors(JUNO[0], JUNO[1], S, P);
    const d = t - T_TOSS;
    const x = A.handR[0] - 520 * d, y = A.handR[1] - 700 * d + 900 * d * d;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-d * 9);
    ctx.scale(OLD_SC, OLD_SC);
    blueprint(ctx, { open: 1, drawing: 'test', title: 'TEST #1', crumple: 1 });
    ctx.restore();
  }
}
// sheet scales, measured once from the two-handed holds (constant so nothing pumps in size)
const OLD_SC = (() => {
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(T_OLD + 0.12));
  return (Math.hypot(A.handR[0] - A.handL[0], A.handR[1] - A.handL[1]) / BLUEPRINT_W) * 1.08;
})();
const SHEET_SC = (() => {
  const A = girlAnchors(JUNO[0], JUNO[1], S, junoPose(T_UNROLLED + 0.05));
  return (Math.hypot(A.handR[0] - A.handL[0], A.handR[1] - A.handL[1]) / BLUEPRINT_W) * 1.08;
})();
function drawThumbs(ctx, hands, show) {
  if (!show) return;
  ctx.save();
  for (const [x, y] of hands) {
    ctx.beginPath(); ctx.ellipse(x + 1, y - 6, 5.2, 7, 0.2, 0, TAU);
    ink(ctx, SOOT_SKIN, 2.6);
  }
  ctx.restore();
}
function whipLines(ctx, t, x, y) {
  const u = (t - T_NEW + 0.03) / 0.3;
  if (u < 0 || u > 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 0.8 + (i - 1) * 0.3;
    const r0 = 62 + 14 * u, r1 = r0 + 22;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.7); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.7);
    ctx.lineWidth = 3.6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#fff6c8'; ctx.stroke();
  }
  ctx.restore();
  sparkle(ctx, x + 60, y - 6, 16 * (1 - u), '#ffffff', 1);
}
function drawWoof(ctx, t, c) {
  const d = t - T_PUMP;
  if (d < 0 || d > 0.8) return;
  const A = dogAnchors(DOG[0], DOG[1], S, dogPose(t));
  const [x, y] = toScreen(c, A.mouth);
  const k = ease.outBack(clamp((d + 0.03) / 0.09), 3) * (1 - ease.inBack(clamp((d - 0.55) / 0.25)));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.4;
    const r0 = 40 + 40 * clamp(d / 0.3), r1 = r0 + 30;
    ctx.globalAlpha = 1 - clamp(d / 0.4);
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  cartoonText(ctx, 'WOOF!', x + 205, y - 70, { size: 92, fill: PAL.yellow, scale: k, rot: 0.12, lw: 13 });
  ctx.restore();
}

// ------------------------------------------------------------------ scene
export default {
  id: 's02_soot',
  start: 7.335,
  end: 16.936,
  transition: { type: 'cut' },
  draw(ctx, t) {
    t = clamp(t, T_CUT, END - 1e-4);
    const tt = Math.min(t, T_FREEZE);
    const c = cam(t);
    if (smokeCover(t) < 0.999) camera(ctx, c, () => {
      drawBackyard(ctx, { t: tt, tod: 'golden', camX: c.x, camY: c.y, pad: 'wrecked', crater: true, craterSmoke: 1, embers: 0.7, birds: false });
      drawLitter(ctx, tt);
      longShadow(ctx, JUNO[0], JUNO[1] - 6, 70, 210, { tod: 'golden', camX: c.x, camY: c.y });
      longShadow(ctx, DOG[0], DOG[1] - 6, 70, 100, { tod: 'golden', camX: c.x, camY: c.y });
      drawRemoteDrop(ctx, t);
      drawDog(ctx, DOG[0], DOG[1], S, dogPose(t));
      drawGirl(ctx, JUNO[0], JUNO[1], S, junoPose(t));
      drawSheets(ctx, t);
      drawSmokeRing(ctx, tt);
      drawSighPuff(ctx, tt);
      drawConeFall(ctx, t);
    });
    drawBonk(ctx, t, c);
    drawRingsTing(ctx, t, c);
    drawGrawlix(ctx, t, c);
    drawWoof(ctx, t, c);
    smokeWall(ctx, t);
    drawFallout(ctx, t);
  },
};
