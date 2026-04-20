export type AnimationType =
  | 'none'
  | 'scroll_left'
  | 'scroll_right'
  | 'scroll_up'
  | 'scroll_down'
  | 'fade'
  | 'rotate';

export interface Templates {
  header: string;
  noPixels: string;
  preamble: string;
  static: string;
  scrollLeft: string;
  scrollRight: string;
  scrollUp: string;
  scrollDown: string;
  fade: string;
  rotate: string;
}

function renderTemplate(
  tmpl: string,
  vars: Record<string, string | number>,
): string {
  const rendered = tmpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) {
      throw new Error(`pixelCodegen: missing template variable {{${key}}}`);
    }
    return String(vars[key]);
  });
  return rendered.replace(/\n+$/, '');
}

function patternLiteral(
  pixels: number[],
  width: number,
  height: number,
): string {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      row.push(`[${pixels[i]}, ${pixels[i + 1]}, ${pixels[i + 2]}]`);
    }
    rows.push(`  [${row.join(', ')}],`);
  }
  return `pattern = [\n${rows.join('\n')}\n]`;
}

function computeRings(
  width: number,
  height: number,
): { rings: number[][]; numRings: number; outerPerimeter: number } {
  const numRings = Math.floor(Math.min(width, height) / 2);
  const rings: number[][] = [];
  for (let d = 0; d < numRings; d++) {
    const ring: number[] = [];
    const s = Math.min(width, height) - 2 * d;
    for (let x = d; x < d + s; x++) ring.push(d * width + x);
    for (let y = d + 1; y < d + s; y++) ring.push(y * width + (d + s - 1));
    for (let x = d + s - 2; x >= d; x--) ring.push((d + s - 1) * width + x);
    for (let y = d + s - 2; y >= d + 1; y--) ring.push(y * width + d);
    rings.push(ring);
  }
  return { rings, numRings, outerPerimeter: rings[0].length };
}

function ringsLiteral(rings: number[][]): string {
  const ringRows = rings.map((r) => `  [${r.join(', ')}],`).join('\n');
  const lens = rings.map((r) => r.length).join(', ');
  return `rings = [\n${ringRows}\n]\nring_lens = [${lens}]`;
}

export function createGenerator(templates: Templates) {
  return function generatePixelCode(
    pixels: number[],
    config: { width: number; height: number; count: number },
    animation: AnimationType,
    speedMs: number,
  ): string {
    const { width, height } = config;
    const baseVars = {
      WIDTH: width,
      HEIGHT: height,
      LED_COUNT: width * height,
      W_MINUS_1: width - 1,
      H_MINUS_1: height - 1,
    };

    const header = templates.header.replace(/\n+$/, '');

    if (!pixels.some((v) => v > 0)) {
      return `${header}\n\n${renderTemplate(templates.noPixels, baseVars)}`;
    }

    const preamble = renderTemplate(templates.preamble, {
      ...baseVars,
      SPEED_MS: speedMs,
      PATTERN: patternLiteral(pixels, width, height),
    });

    const body = ((): string => {
      switch (animation) {
        case 'none':
          return renderTemplate(templates.static, baseVars);
        case 'scroll_left':
          return renderTemplate(templates.scrollLeft, baseVars);
        case 'scroll_right':
          return renderTemplate(templates.scrollRight, baseVars);
        case 'scroll_up':
          return renderTemplate(templates.scrollUp, baseVars);
        case 'scroll_down':
          return renderTemplate(templates.scrollDown, baseVars);
        case 'fade':
          return renderTemplate(templates.fade, baseVars);
        case 'rotate': {
          const { rings, numRings, outerPerimeter } = computeRings(
            width,
            height,
          );
          return renderTemplate(templates.rotate, {
            ...baseVars,
            RINGS: ringsLiteral(rings),
            NUM_RINGS: numRings,
            OUTER_PERIMETER: outerPerimeter,
          });
        }
      }
    })();

    return `${header}\n\n${preamble}\n\n${body}`;
  };
}
