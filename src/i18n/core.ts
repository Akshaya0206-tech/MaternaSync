import { createContext, useContext } from "react";
import { translations } from "./translations";

export type Language = "en" | "hi" | "ta" | "te";
export type Values = Record<string, string | number>;

export const LOCALES: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
};
export const STORAGE_KEY = "maternasync.language";
export const isLanguage = (value: unknown): value is Language =>
  value === "en" || value === "hi" || value === "ta" || value === "te";

// Read by helpers that run outside React (date formatting, shared status labels).
let active: Language = "en";
export const currentLanguage = () => active;
export const currentLocale = () => LOCALES[active];
export const setActiveLanguage = (language: Language) => {
  active = language;
};

export const fill = (text: string, values?: Values) =>
  values
    ? text.replace(/\{(\w+)\}/g, (match, key) =>
        key in values ? String(values[key]) : match,
      )
    : text;

/** Look the English text up in the dictionary; fall back to English, never to a blank. */
export function translateTo(
  language: Language,
  text: string,
  values?: Values,
): string {
  const entry = translations[text];
  const translated = language === "en" || !entry ? undefined : entry[language];
  return fill(translated ?? text, values);
}
export const translate = (text: string, values?: Values) =>
  translateTo(active, text, values);
/** Marks a literal that is translated later (labels held in maps or arrays). Returns it unchanged. */
export const tx = (text: string) => text;

export interface LanguageValue {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (text: string, values?: Values) => string;
}

// Outside the patient portal (doctor, care team) everything stays English.
export const LanguageContext = createContext<LanguageValue>({
  language: "en",
  setLanguage: async () => {},
  t: (text, values) => fill(text, values),
});

export const useLanguage = () => useContext(LanguageContext);

export function storedLanguage(): Language {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : "en";
  } catch {
    return "en";
  }
}
