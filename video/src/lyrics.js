// On-screen lyric captions — the song only has two sung lines, so they get a
// special treatment: each word pops in on its syllable, glowing like a star.
import { cartoonText, FONT, PAL, glow, sparkle } from './draw.js';
import { clamp, ease } from './util.js';

// Word timings measured from the isolated vocal stem (analysis/syl.py).
export const LYRICS = {
  gravity: {
    words: [['go', 55.61], ['where', 55.95], ['the', 56.3], ['gravity', 56.51], ['takes', 57.1], ['me', 57.84]],
    end: 59.2,
  },
  stars1: { words: [['just', 61.36], ['me', 61.8], ['and', 62.2], ['the', 62.4], ['stars', 62.55]], end: 64.9 },
  stars2: { words: [['just', 65.79], ['me', 66.2], ['and', 66.55], ['the', 66.8], ['stars', 67.04]], end: 69.4 },
};

// Draw a lyric line centred at (x,y). Words pop in (scale overshoot) at their time,
// the whole line fades out at `end`.
export function drawLyric(ctx, t, line, x, y, { size = 78, fill = PAL.cream, accent = PAL.yellow, font = FONT.title } = {}) {
  const { words, end } = line;
  if (t < words[0][1] - 0.05 || t > end + 0.6) return;
  const out = 1 - clamp((t - end) / 0.6);
  ctx.save();
  ctx.font = `bold ${size}px ${font}`;
  const space = size * 0.32;
  const widths = words.map(([w]) => ctx.measureText(w).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
  let cx = x - total / 2;
  words.forEach(([w, wt], i) => {
    const k = clamp((t - wt) / 0.22);
    if (k > 0) {
      const s = ease.outBack(k, 2.2);
      const wx = cx + widths[i] / 2;
      const isKey = i === words.length - 1;
      if (isKey) glow(ctx, wx, y, size * 1.6, accent, 0.35 * k * out);
      cartoonText(ctx, w, wx, y + (1 - k) * size * 0.3, {
        size, font, fill: isKey ? accent : fill, scale: s, alpha: k * out, lw: size * 0.14,
      });
      if (isKey && k < 1) sparkle(ctx, wx + widths[i] * 0.55, y - size * 0.45, size * 0.4 * (1 - k) + 6, '#fff', k);
    }
    cx += widths[i] + space;
  });
  ctx.restore();
}
