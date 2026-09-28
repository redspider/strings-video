// crop a region of a frame at full res: node crop.mjs t x y w h out
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import { renderFrame } from '/Users/richard/src/experiments/music_video/video/src/engine.js';
const [t, x, y, w, h, out, sc] = process.argv.slice(2);
const S = +(sc || 1);
const c = createCanvas(1920 * S, 1080 * S), ctx = c.getContext('2d');
ctx.setTransform(S, 0, 0, S, 0, 0);
renderFrame(ctx, +t, { makeCanvas: (a, b) => createCanvas(a, b) });
const o = createCanvas(+w * S, +h * S);
o.getContext('2d').drawImage(c, -x * S, -y * S);
fs.writeFileSync(out, await o.encode('png'));
