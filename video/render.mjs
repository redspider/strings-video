#!/usr/bin/env node
// Render the music video (or stills / contact sheets) with Skia canvas + ffmpeg.
//
//   node render.mjs video  [--fps 30] [--scale 1] [--from 0] [--to 128] [--workers 8] [--out out/video.mp4] [--noaudio]
//   node render.mjs stills --times 1.2,3.4 [--scale 0.5] [--outdir out/stills] [--debug]
//   node render.mjs sheet  --from 0 --to 7.34 [--count 12] [--cols 4] [--tile 480] [--out sheets/x.png] [--debug]
//   node render.mjs sheet  --times 1,2,3 ...          (explicit times instead of from/to/count)
//   node render.mjs bench  [--from 0 --to 128 --count 40]   (ms per frame)
import { createCanvas } from '@napi-rs/canvas';
import { spawn, fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderFrame, W, H, DURATION } from './src/engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FFMPEG = process.env.FFMPEG ||
  path.join(ROOT, 'analysis/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1');
const AUDIO_FILE = path.join(ROOT, 'Strings.m4a');

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      a[k] = v;
    } else a._.push(argv[i]);
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
const mode = args._[0] || 'video';
const makeCanvas = (w, h) => createCanvas(w, h);

function frameCanvas(scale) {
  const c = createCanvas(Math.round(W * scale), Math.round(H * scale));
  const ctx = c.getContext('2d');
  return { c, ctx };
}
function draw(ctx, scale, t, debug) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  renderFrame(ctx, t, { makeCanvas, debug });
}

async function writePng(c, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = await c.encode('png');
  fs.writeFileSync(file, buf);
}

// ---------- segment renderer (child process) ----------
async function renderSegment({ f0, f1, fps, scale, out }) {
  const { c, ctx } = frameCanvas(scale);
  const w = c.width, h = c.height;
  const ff = spawn(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-g', String(fps * 2), '-bf', '2', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = f0; f < f1; f++) {
    // Sample the middle of the frame's display interval: every beat-locked event
    // then lands on the frame nearest to it (never more than half a frame off).
    const t = (f + 0.5) / fps;
    draw(ctx, scale, t, false);
    const data = ctx.getImageData(0, 0, w, h).data;
    const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (process.send && (f - f0) % 30 === 0) process.send({ progress: f - f0 });
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg ' + code)))));
}

async function renderVideo() {
  const fps = +(args.fps || 30);
  const scale = +(args.scale || 1);
  const from = +(args.from || 0);
  const to = +(args.to || DURATION);
  const out = path.resolve(args.out || path.join(HERE, 'out/video.mp4'));
  const workers = +(args.workers || Math.max(1, os.cpus().length - 4));
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  const total = f1 - f0;
  const tmp = path.join(HERE, `out/.segments-${process.pid}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(total / workers);
  const t0 = Date.now();
  const done = new Array(workers).fill(0);
  const segs = [];
  const jobs = [];
  for (let i = 0; i < workers; i++) {
    const a = f0 + i * per, b = Math.min(f1, a + per);
    if (a >= b) break;
    const seg = path.join(tmp, `seg${String(i).padStart(3, '0')}.mp4`);
    segs.push(seg);
    jobs.push(new Promise((res, rej) => {
      const child = fork(fileURLToPath(import.meta.url), ['segment', JSON.stringify({ f0: a, f1: b, fps, scale, out: seg })]);
      child.on('message', (m) => {
        if (m.progress !== undefined) {
          done[i] = m.progress;
          const d = done.reduce((x, y) => x + y, 0);
          process.stdout.write(`\r  rendering ${d}/${total} frames  (${((Date.now() - t0) / 1000).toFixed(0)}s)   `);
        }
      });
      child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`segment ${i} exited ${code}`))));
    }));
  }
  await Promise.all(jobs);
  process.stdout.write('\n');
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const withAudio = !args.noaudio;
  const ffArgs = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (withAudio) ffArgs.push('-ss', String(from), '-t', String(to - from), '-i', AUDIO_FILE, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  ffArgs.push('-c:v', 'copy', '-movflags', '+faststart', out);
  await new Promise((res, rej) => spawn(FFMPEG, ffArgs, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error('mux failed')))));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

function timesFromArgs(defCount = 12) {
  if (args.times) return String(args.times).split(',').map(Number);
  const from = +(args.from ?? 0), to = +(args.to ?? DURATION);
  const n = +(args.count || defCount);
  return Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 0.5)) / n);
}

async function renderStills() {
  const scale = +(args.scale || 0.5);
  const outdir = path.resolve(args.outdir || path.join(HERE, 'out/stills'));
  const { c, ctx } = frameCanvas(scale);
  for (const t of timesFromArgs()) {
    draw(ctx, scale, t, !!args.debug);
    const f = path.join(outdir, `t${t.toFixed(2).padStart(7, '0')}.png`);
    await writePng(c, f);
    console.log(f);
  }
}

async function renderSheet() {
  const times = timesFromArgs(12);
  const cols = +(args.cols || 4);
  const tile = +(args.tile || 480);
  const scale = tile / W;
  const th = Math.round(H * scale);
  const rows = Math.ceil(times.length / cols);
  const pad = 6, label = 30;
  const sheet = createCanvas(cols * (tile + pad) + pad, rows * (th + pad + label) + pad);
  const sctx = sheet.getContext('2d');
  sctx.fillStyle = '#222'; sctx.fillRect(0, 0, sheet.width, sheet.height);
  const { c, ctx } = frameCanvas(scale);
  times.forEach((t, i) => {
    draw(ctx, scale, t, !!args.debug);
    const x = pad + (i % cols) * (tile + pad), y = pad + Math.floor(i / cols) * (th + pad + label);
    sctx.drawImage(c, x, y + label);
    sctx.fillStyle = '#fff'; sctx.font = 'bold 22px "Arial Rounded MT Bold"'; sctx.textBaseline = 'middle';
    sctx.fillText(`${t.toFixed(2)}s`, x + 4, y + label / 2);
  });
  const out = path.resolve(args.out || path.join(HERE, 'sheets/sheet.png'));
  await writePng(sheet, out);
  console.log(out);
}

async function bench() {
  const scale = +(args.scale || 1);
  const { ctx } = frameCanvas(scale);
  const times = timesFromArgs(40);
  const t0 = performance.now();
  for (const t of times) { draw(ctx, scale, t, false); ctx.getImageData(0, 0, 4, 4); }
  const ms = (performance.now() - t0) / times.length;
  console.log(`${ms.toFixed(1)} ms/frame avg over ${times.length} frames`);
}

if (mode === 'segment') {
  renderSegment(JSON.parse(args._[1])).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
} else if (mode === 'video') renderVideo().catch((e) => { console.error(e); process.exit(1); });
else if (mode === 'stills') renderStills();
else if (mode === 'sheet') renderSheet();
else if (mode === 'bench') bench();
else console.error('unknown mode', mode);
