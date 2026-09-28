// Musical time helpers. The song is a rock-steady 100 BPM in 4/4:
//   beat n  starts at  T0 + n*SPB        (n = 0 is the very first guitar note)
//   bar  k  starts at  T0 + k*BAR
// See STORYBOARD.md for what happens on which bar.
import { AUDIO } from './audio_data.js';
import { clamp } from './util.js';

export const T0 = AUDIO.t0; // ≈ 0.135 s
export const SPB = AUDIO.spb; // ≈ 0.600 s per beat
export const BAR = SPB * 4; // ≈ 2.400 s per bar
export const DURATION = AUDIO.duration; // 128 s

export const beatTime = (n) => T0 + n * SPB;
export const barTime = (k, beat = 0) => T0 + k * BAR + beat * SPB;
export const beatAt = (t) => (t - T0) / SPB; // fractional beat index
export const barAt = (t) => (t - T0) / BAR; // fractional bar index
export const beatPhase = (t) => { const b = beatAt(t); return b - Math.floor(b); };
export const sinceBeat = (t) => beatPhase(t) * SPB; // seconds since the last beat
export const sinceBar = (t) => { const b = barAt(t); return (b - Math.floor(b)) * BAR; };

// 1 exactly on each beat, decaying exponentially afterwards. Use for "thump" accents.
export const pulse = (t, decay = 7) => (t < T0 ? 0 : Math.exp(-decay * sinceBeat(t)));
export const barPulse = (t, decay = 3) => (t < T0 ? 0 : Math.exp(-decay * sinceBar(t)));
// Pulse only on beats that fall inside [from, to)
export function pulseIn(t, from, to, decay = 7) {
  if (t < from || t >= to + 1.5) return 0;
  const n = Math.floor(beatAt(t) + 1e-6);
  const bt = beatTime(n);
  if (bt < from - 1e-3 || bt >= to) return 0;
  return Math.exp(-decay * (t - bt));
}

// Bouncing curve: 0 on every beat, peaks at 1 halfway between (abs-sine). period in beats.
export const hop = (t, periodBeats = 1) => Math.abs(Math.sin((Math.PI * beatAt(t)) / periodBeats));
// Smooth sway in [-1,1] with a period of `periodBeats` beats, crossing zero on the beat.
export const sway = (t, periodBeats = 2) => Math.sin((Math.PI * 2 * beatAt(t)) / periodBeats);

// ---------- detected drum / guitar hits ----------
function lastBefore(arr, t) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
export const KICKS = AUDIO.kicks;
export const SNARES = AUDIO.snares;
export const HATS = AUDIO.hats;
export const GUITAR = AUDIO.guitar; // guitar-note onsets (other stem)
// Exponential-decay pulse from the most recent hit in arr (0 if none yet)
export function hitPulse(t, arr, decay = 10) {
  const i = lastBefore(arr, t);
  if (i < 0) return 0;
  return Math.exp(-decay * (t - arr[i]));
}
export const kick = (t, d = 9) => hitPulse(t, KICKS, d);
export const snare = (t, d = 9) => hitPulse(t, SNARES, d);
export const hat = (t, d = 18) => hitPulse(t, HATS, d);
export const pluck = (t, d = 8) => hitPulse(t, GUITAR, d);
// Count of hits in arr up to time t — handy for "advance one step per hit".
export const hitCount = (t, arr) => lastBefore(arr, t) + 1;

// ---------- loudness envelopes (0..1, 50 Hz) ----------
// names: 'mix' | 'vocals' | 'drums' | 'bass' | 'other'
export function env(name, t) {
  const a = AUDIO.env[name];
  const x = clamp(t * AUDIO.envRate, 0, a.length - 1.001);
  const i = Math.floor(x), f = x - i;
  return (a[i] * (1 - f) + a[i + 1] * f) / 99;
}
// Smoothed envelope (average over +/- win seconds)
export function envSmooth(name, t, win = 0.15) {
  let s = 0; const n = 7;
  for (let i = 0; i < n; i++) s += env(name, t - win + (2 * win * i) / (n - 1));
  return s / n;
}

// ---------- song structure (absolute seconds; see STORYBOARD.md) ----------
export const MOMENTS = {
  firstNote: 0.14,
  countdownStart: barTime(0, 3), // 1.94
  explosion: barTime(2), // 4.94 — last note of the false start
  sootReveal: barTime(3), // 7.34
  ahShit: 9.12, // spoken "ah sh.." 9.12–10.82
  startAgain: 13.58, // spoken "...start again" 13.58–15.54
  silence: 16.24, // total silence 16.24–17.48
  restart: 17.48, // guitar restarts ("take 2") — nearest beat 17.54
  drumsIn: barTime(8), // 19.34
  hum1: barTime(12), // 28.94 humming vocals until 35.52
  breakdown: barTime(15), // 36.14 bass out, countdown #2
  liftoff: barTime(16), // 38.54
  gravityBreak: barTime(23), // 55.34 drums drop, "go where the gravity takes me" 55.6–58.3
  drop: barTime(24), // 57.74 big drop back in
  stars: barTime(26), // 62.54 "just me and the stars" 61.3–64.6 & 65.8–69.0
  build: barTime(31), // 74.54 bass out build
  bigSection: barTime(32), // 76.94 loudest section
  bridge: barTime(37), // 88.94 bass out
  peak: barTime(40), // 96.14 vocals + full band
  homeward: barTime(44), // 105.74 bass out, vocals continue to 111.7
  reentry: barTime(47), // 112.94 drums only
  outro: barTime(48), // 115.34 guitar outro
  finalHit: barTime(52), // 124.94 last drum hit, fade to end
};
