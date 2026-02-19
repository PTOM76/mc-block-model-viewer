import ja_jp from '../public/lang/ja_jp.json';
import en_us from '../public/lang/en_us.json';

const langs = {
  ja_jp,
  en_us,
} as const;

export type LangCode = keyof typeof langs;
export type LangKey = keyof typeof ja_jp;

let currentLang: LangCode = 'ja_jp';
let _t: Record<string, string> = langs[currentLang];

export function setLang(lang: LangCode) {
  if (langs[lang]) {
    currentLang = lang;
    _t = langs[lang];
  }
}

export function getLang(): LangCode {
  return currentLang;
}

export const t = (key: LangKey, vars?: Record<string, string|number>) => {
  let text = _t[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(`$${k}$`, String(v));
    });
  }
  return text;
};
