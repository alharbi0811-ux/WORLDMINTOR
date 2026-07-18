import en from '../locales/en.json';
import ar from '../locales/ar.json';

export type Lang = 'en' | 'ar';

const translations: Record<Lang, typeof en> = { en, ar };

export function t(lang: Lang, path: string): string {
  const keys = path.split('.');
  let val: any = translations[lang];
  for (const k of keys) {
    val = val?.[k];
  }
  return val ?? path;
}

export function isRTL(lang: Lang): boolean {
  return lang === 'ar';
}
