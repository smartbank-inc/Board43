/**
 * Type definitions for the LED Simulator
 */

/** RGB color as [r, g, b] tuple (0-255) */
export type RgbColor = [number, number, number];

/** Preset color palette entry */
export interface PaletteColor {
  name: string;
  color: RgbColor;
}

/** Default color palette */
export const DEFAULT_PALETTE: PaletteColor[] = [
  { name: 'Red', color: [255, 0, 0] },
  { name: 'Orange', color: [255, 128, 0] },
  { name: 'Yellow', color: [255, 255, 0] },
  { name: 'Lime', color: [128, 255, 0] },
  { name: 'Green', color: [0, 255, 0] },
  { name: 'Cyan', color: [0, 255, 255] },
  { name: 'Blue', color: [0, 0, 255] },
  { name: 'Purple', color: [128, 0, 255] },
  { name: 'Magenta', color: [255, 0, 255] },
  { name: 'Pink', color: [255, 128, 128] },
  { name: 'White', color: [255, 255, 255] },
  { name: 'Black', color: [0, 0, 0] },
];

/** Convert RGB to hex string */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Convert hex string to RGB */
export function hexToRgb(hex: string): RgbColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    Number.parseInt(result[1], 16),
    Number.parseInt(result[2], 16),
    Number.parseInt(result[3], 16),
  ];
}
