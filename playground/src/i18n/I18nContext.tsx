import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { interpolate } from './format';
import { type MessageKey, messages } from './messages';
import type { Locale, TParams } from './types';

const STORAGE_KEY = 'board43playground.locale';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja';
}

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Ignore — SSR / disabled storage / etc.
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language : '';
  return browser?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export type TFn = (key: MessageKey, params?: TParams) => string;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures — the in-memory locale still updates.
    }
    setLocaleState(next);
  }, []);

  const t = useCallback<TFn>(
    (key, params) => {
      const template = messages[locale][key] ?? messages.en[key] ?? key;
      return interpolate(template, params);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>');
  }
  return ctx;
}
