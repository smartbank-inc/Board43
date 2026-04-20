import type { Locale } from '../../i18n';
import {
  type AnimationType,
  type Templates,
  createGenerator,
} from './pixelCodegenCore';
import enFade from './templates/en/fade.rb.tmpl?raw';
import enNoPixels from './templates/en/noPixels.rb.tmpl?raw';
import enPreamble from './templates/en/preamble.rb.tmpl?raw';
import enRotate from './templates/en/rotate.rb.tmpl?raw';
import enScrollDown from './templates/en/scrollDown.rb.tmpl?raw';
import enScrollLeft from './templates/en/scrollLeft.rb.tmpl?raw';
import enScrollRight from './templates/en/scrollRight.rb.tmpl?raw';
import enScrollUp from './templates/en/scrollUp.rb.tmpl?raw';
import enStatic from './templates/en/static.rb.tmpl?raw';
import headerTmpl from './templates/header.rb.tmpl?raw';
import jaFade from './templates/ja/fade.rb.tmpl?raw';
import jaNoPixels from './templates/ja/noPixels.rb.tmpl?raw';
import jaPreamble from './templates/ja/preamble.rb.tmpl?raw';
import jaRotate from './templates/ja/rotate.rb.tmpl?raw';
import jaScrollDown from './templates/ja/scrollDown.rb.tmpl?raw';
import jaScrollLeft from './templates/ja/scrollLeft.rb.tmpl?raw';
import jaScrollRight from './templates/ja/scrollRight.rb.tmpl?raw';
import jaScrollUp from './templates/ja/scrollUp.rb.tmpl?raw';
import jaStatic from './templates/ja/static.rb.tmpl?raw';

export type { AnimationType } from './pixelCodegenCore';

const enTemplates: Templates = {
  header: headerTmpl,
  noPixels: enNoPixels,
  preamble: enPreamble,
  static: enStatic,
  scrollLeft: enScrollLeft,
  scrollRight: enScrollRight,
  scrollUp: enScrollUp,
  scrollDown: enScrollDown,
  fade: enFade,
  rotate: enRotate,
};

const jaTemplates: Templates = {
  header: headerTmpl,
  noPixels: jaNoPixels,
  preamble: jaPreamble,
  static: jaStatic,
  scrollLeft: jaScrollLeft,
  scrollRight: jaScrollRight,
  scrollUp: jaScrollUp,
  scrollDown: jaScrollDown,
  fade: jaFade,
  rotate: jaRotate,
};

const generators: Record<Locale, ReturnType<typeof createGenerator>> = {
  en: createGenerator(enTemplates),
  ja: createGenerator(jaTemplates),
};

export function generatePixelCode(
  pixels: number[],
  config: { width: number; height: number; count: number },
  animation: AnimationType,
  speedMs: number,
  locale: Locale,
): string {
  return generators[locale](pixels, config, animation, speedMs);
}
