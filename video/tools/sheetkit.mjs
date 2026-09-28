// Helper for character / prop sheets:  await sheet('sheets/girl.png', 1920, 1080, (ctx) => { ... })
// Draws on a light checker-free background, saves a PNG, prints the path.
import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

export async function sheet(file, w, h, drawFn, { bg = '#dfe7ef' } = {}) {
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  await drawFn(ctx, c);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, await c.encode('png'));
  console.log(path.resolve(file));
}

// Small label helper
export function label(ctx, text, x, y, size = 22) {
  ctx.save();
  ctx.font = `bold ${size}px "Arial Rounded MT Bold"`;
  ctx.fillStyle = '#1d1a2f'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}
