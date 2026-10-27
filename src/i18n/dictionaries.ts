import type { Entry } from "./translations";

// Wording that is only needed by some screens lives in its own file and is downloaded on first use, and only for a language other than English.
// Each file in ./dicts is self-contained (no imports) and exports `entries`, so tests/i18n-coverage.mjs can read it directly.
export type Loader = () => Promise<Record<string, Entry>>;

/** Sign-in, sign-up and the landing page. */
export const loadAuthDictionary: Loader = async () => (await import("./dicts/auth")).entries;

/** Everything a doctor sees. Split by area so each part can be maintained on its own. */
export const loadDoctorDictionary: Loader = async () => {
  const parts = await Promise.all([
    import("./dicts/doctor-shell"),
    import("./dicts/doctor-pages"),
    import("./dicts/doctor-workspace"),
    import("./dicts/doctor-studio"),
    import("./dicts/doctor-library"),
    import("./dicts/doctor-about"),
    import("./dicts/doctor-patientinfo"),
    import("./dicts/doctor-questions"),
    import("./dicts/doctor-emergency"),
    import("./dicts/doctor-careconn"),
    import("./dicts/doctor-refsettings"),
    import("./dicts/doctor-consultq"),
    import("./dicts/doctor-dashboard"),
    import("./dicts/doctor-overview"),
    import("./dicts/doctor-search"),
    import("./dicts/doctor-updprofile"),
    import("./dicts/doctor-workspace2"),
    import("./dicts/doctor-cgnudge"),
    import("./dicts/doctor-cgquestions"),
    import("./dicts/doctor-cgemergency"),
    import("./dicts/doctor-cghome"),
  ]);
  return Object.assign({}, ...parts.map((part) => part.entries));
};
