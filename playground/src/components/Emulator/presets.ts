/**
 * Default pixel art presets for the LED simulator.
 *
 * Each pattern is a 16-row array of 16-character strings. Each character
 * maps to an RGB color via PALETTE. '.' is off (black).
 */

import { LED_MATRIX_CONFIG } from '../../wasm/types';

type Rgb = [number, number, number];

const PALETTE: Record<string, Rgb> = {
  '.': [0, 0, 0],
  R: [220, 20, 30], // ruby red
  H: [255, 120, 130], // highlight
  w: [240, 240, 240], // white
  b: [30, 30, 40], // dark gray
};

function patternToPixels(rows: readonly string[]): number[] {
  const { width, height } = LED_MATRIX_CONFIG;
  const pixels = new Array(width * height * 3).fill(0);
  for (let y = 0; y < Math.min(rows.length, height); y++) {
    const row = rows[y];
    for (let x = 0; x < Math.min(row.length, width); x++) {
      const char = row[x];
      const rgb = PALETTE[char] ?? PALETTE['.'];
      const i = (y * width + x) * 3;
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
    }
  }
  return pixels;
}

const RUBY_GEM_ROWS = [
  '................',
  '................',
  '................',
  '.....RRRRRR.....',
  '....RHRRRRHR....',
  '...RHHRRRRHHR...',
  '..RRRRRRRRRRRR..',
  '..RRRRRRRRRRRR..',
  '...RRRRRRRRRR...',
  '....RRRRRRRR....',
  '.....RRRRRR.....',
  '......RRRR......',
  '.......RR.......',
  '................',
  '................',
  '................',
];

export const RUBY_GEM_PIXELS: number[] = patternToPixels(RUBY_GEM_ROWS);
