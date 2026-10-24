import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import {
  LanguageContext,
  STORAGE_KEY,
  isLanguage,
  setActiveLanguage,
  storedLanguage,
  translateTo,
} from "./core";
import type { Language, LanguageValue } from "./core";

// Where the saved language lives. A trusted person (caregiver) has their own setting; the patient endpoints refuse them.
const SOURCES = {
  patient: { read: "/api/v2/continuity/context", write: "/api/v2/continuity/preferences" },
  caregiver: { read: "/api/v2/caregiver/preferences", write: "/api/v2/caregiver/preferences" },
} as const;

/** Patient-portal language: remembered on this device, saved to the account, applied to the page. */
export function LanguageProvider({ children, variant = "patient" }: { children: ReactNode; variant?: keyof typeof SOURCES }) {
  const source = SOURCES[variant];
  const [language, setLanguageState] = useState<Language>(storedLanguage);
  const apply = useCallback((next: Language) => {
    setActiveLanguage(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode: the server preference still applies */
    }
    setLanguageState(next);
  }, []);

  // Once the person has picked a language here, the saved one (which may arrive late, on a slow connection) must not undo it.
  const chosen = useRef(false);
  useEffect(() => {
    let current = true;
    api
      .get<{ language: Language }>(source.read)
      .then((context) => {
        if (current && !chosen.current && isLanguage(context.language)) apply(context.language);
      })
      .catch(() => {
        /* keep the remembered language when offline */
      });
    return () => {
      current = false;
    };
  }, [apply, source.read]);

  // Children render after this component, so set the language they read from before they do.
  setActiveLanguage(language);
  // Leaving the patient portal (logout, or a staff sign-in in the same tab) must not leave
  // a regional language behind for the other roles' screens.
  useEffect(() => {
    setActiveLanguage(language);
    document.documentElement.lang = language;
    return () => {
      setActiveLanguage("en");
      document.documentElement.lang = "en";
    };
  }, [language]);

  const setLanguage = useCallback(
    async (next: Language) => {
      chosen.current = true;
      apply(next);
      await api.patch(source.write, { language: next });
    },
    [apply, source.write],
  );
  const value = useMemo<LanguageValue>(
    () => ({
      language,
      setLanguage,
      t: (text, values) => translateTo(language, text, values),
    }),
    [language, setLanguage],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
