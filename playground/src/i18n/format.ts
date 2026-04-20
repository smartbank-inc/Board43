import type { TFn } from './I18nContext';
import type { LocalizedMessage } from './messages';
import type { TParams } from './types';

/**
 * Replace `{name}`-style placeholders in a template with the corresponding
 * values from `params`. Missing keys are left as `{key}` so the gap is visible
 * at runtime rather than silently rendered as `undefined`.
 */
export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value != null ? String(value) : `{${key}}`;
  });
}

export function resolveMessage(t: TFn, message: LocalizedMessage): string {
  return 'key' in message ? t(message.key, message.params) : message.text;
}
