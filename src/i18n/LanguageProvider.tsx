import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import {
  LanguageContext,
  STORAGE_KEY,
  isLanguage,
  registerTranslations,
  setActiveLanguage,
  storedLanguage,
  translateTo,
} from "./core";
import type { Language, LanguageValue } from "./core";
import type { Loader } from "./dictionaries";

// Where the saved language lives. The patient and the doctor share the account endpoints; a trusted person (caregiver)
// has their own setting because the patient endpoints refuse them; the sign-in pages have no account yet, so they save nothing.
const ACCOUNT = { read: "/api/v2/continuity/context", write: "/api/v2/continuity/preferences" } as const;
const SOURCES = {
  patient: ACCOUNT,
  account: ACCOUNT,
  caregiver: { read: "/api/v2/caregiver/preferences", write: "/api/v2/caregiver/preferences" },
  local: null,
} as const;

// A language picked on the sign-in or sign-up page is kept for the moment the person gets in, then saved to their account.
const PENDING_KEY = "maternasync.language.pending";
const pendingChoice = (): Language | null => {
  try {
    const value = window.sessionStorage.getItem(PENDING_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
};
const setPendingChoice = (language: Language | null) => {
  try {
    if (language) window.sessionStorage.setItem(PENDING_KEY, language);
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode: the choice just will not carry over */
  }
};

/** Screen language: remembered on this device, saved to the account, applied to the page. */
export function LanguageProvider({
  children,
  variant = "patient",
  load,
}: {
  children: ReactNode;
  variant?: keyof typeof SOURCES;
  /** Extra wording for these screens, downloaded only when the language is not English. */
  load?: Loader;
}) {
  const source = SOURCES[variant];
  const [startedWith] = useState(() => (source ? pendingChoice() : null));
  const [language, setLanguageState] = useState<Language>(() => startedWith ?? storedLanguage());
  const dictionaryLoaded = useRef(!load);
  const [ready, setReady] = useState(() => !load || (startedWith ?? storedLanguage()) === "en");

  // Fetch the wording for a language before showing it, so a page never appears half translated.
  const prepare = useCallback(
    async (next: Language) => {
      if (next === "en" || !load || dictionaryLoaded.current) return;
      try {
        registerTranslations(await load());
        dictionaryLoaded.current = true;
      } catch {
        /* offline: the English text is shown instead of a blank page */
      }
    },
    [load],
  );

  const apply = useCallback(
    async (next: Language) => {
      await prepare(next);
      setActiveLanguage(next);
      document.documentElement.lang = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* private mode: the server preference still applies */
      }
      setLanguageState(next);
      setReady(true);
    },
    [prepare],
  );

  // Once the person has picked a language here, the saved one (which may arrive late, on a slow connection) must not undo it.
  const chosen = useRef(false);
  useEffect(() => {
    let current = true;
    if (!ready) {
      void prepare(language).finally(() => {
        if (current) setReady(true);
      });
    }
    if (startedWith && source) {
      // They chose this language on the sign-in page: it becomes their saved language.
      chosen.current = true;
      api.patch(source.write, { language: startedWith }).catch(() => undefined).finally(() => setPendingChoice(null));
      return () => {
        current = false;
      };
    }
    if (source) {
      api
        .get<{ language: Language }>(source.read)
        .then((context) => {
          if (current && !chosen.current && isLanguage(context.language)) void apply(context.language);
        })
        .catch(() => {
          /* keep the remembered language when offline */
        });
    }
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, source]);

  // Children render after this component, so set the language they read from before they do.
  setActiveLanguage(language);
  // Leaving this part of the app (logout, or a different role in the same tab) must not leave
  // a regional language behind for screens that are not translated.
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
      await apply(next);
      if (!source) {
        setPendingChoice(next);
        return;
      }
      await api.patch(source.write, { language: next });
    },
    [apply, source],
  );
  const value = useMemo<LanguageValue>(
    () => ({
      language,
      setLanguage,
      t: (text, values) => translateTo(language, text, values),
    }),
    [language, setLanguage],
  );
  return <LanguageContext.Provider value={value}>{ready ? children : null}</LanguageContext.Provider>;
}
