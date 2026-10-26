// Checks that every string the translated screens pass to t()/tx()/translate() has a Hindi, Tamil and Telugu
// translation, with the same {placeholders}. Run: node tests/i18n-coverage.mjs
//   node tests/i18n-coverage.mjs --unwrapped   also lists visible English text that is NOT wrapped in t() yet
//   node tests/i18n-coverage.mjs --only doctor/ConsultationsPage   limit the report to paths containing the text
// (Node 22.18+/24 can import the dictionaries directly because they use plain, erasable TypeScript.)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wantUnwrapped = args.includes("--unwrapped");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : "";

// Screens translated into the four languages. The care-team screens are not translated (that login is off), but the
// continuity components are shared with the doctor, so they are included.
const scanned = [
  join(root, "src", "roles", "patient"),
  join(root, "src", "roles", "caregiver"),
  join(root, "src", "roles", "doctor"),
  join(root, "src", "components", "continuity"),
  join(root, "src", "components", "auth"),
  join(root, "src", "components", "shared", "ReferralDetailView.tsx"),
  join(root, "src", "components", "shared", "LanguageSwitcher.tsx"),
  join(root, "src", "components", "shared", "RoleSidebar.tsx"),
  join(root, "src", "components", "HandoverPausedNotice.tsx"),
  join(root, "src", "components", "StatusBadge.tsx"),
  join(root, "src", "pages", "LandingPage.tsx"),
  join(root, "src", "routes", "LoadStates.tsx"), // the loading and "could not load this page" messages
];
const files = [];
const walk = (path) => {
  if (statSync(path).isDirectory()) readdirSync(path).forEach((name) => walk(join(path, name)));
  else if (/\.(tsx|jsx)$/.test(path) || /(tour|format|checkInRules|calendarEvents)\.ts$/.test(path)) files.push(path);
};
scanned.forEach(walk);
const rel = (file) => file.replace(root, "").replaceAll("\\", "/");

const literal = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + "`(?:[^`\\\\$]|\\\\.)*`";
const call = new RegExp(String.raw`(?<![\w.])(?:t|tx|translate)\(\s*(${literal})`, "g");
const decode = (raw) => {
  const body = raw.slice(1, -1);
  if (raw[0] === '"') return JSON.parse(raw);
  return body.replace(/\\(['`\\])/g, "$1").replace(/\\n/g, "\n");
};

// A screen only has the dictionaries its own part of the app loads: the sign-in pages load translations.ts + dicts/auth.ts, the
// doctor screens load translations.ts + dicts/doctor-*.ts, and the patient and caregiver screens only translations.ts.
const surfaceOf = (file) => {
  const path = rel(file);
  if (path.includes("/components/auth/") || path.includes("/pages/LandingPage") || path.includes("LanguageSwitcher")) return "auth";
  if (path.includes("/roles/patient/") || path.includes("/roles/caregiver/") || path.includes("LoadStates") || path.includes("RoleSidebar")) return "patient";
  return "doctor";
};
const used = new Map();
const surfacesOf = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(call)) {
    const key = decode(match[1]);
    if (!used.has(key)) used.set(key, rel(file));
    if (!surfacesOf.has(key)) surfacesOf.set(key, new Map());
    if (!surfacesOf.get(key).has(surfaceOf(file))) surfacesOf.get(key).set(surfaceOf(file), rel(file));
  }
}

// Dictionaries: the patient and caregiver wording, plus every self-contained file in src/i18n/dicts.
const { translations, serverStrings } = await import(pathToFileURL(join(root, "src", "i18n", "translations.ts")).href);
const dictDir = join(root, "src", "i18n", "dicts");
const dictionary = { ...translations };
const byFile = {}; // dictionary file name -> its keys
const origin = Object.fromEntries(Object.keys(translations).map((key) => [key, "translations.ts"]));
const problems = [];
const extraServerStrings = []; // English the server sends that a dictionary file promises to translate
for (const name of readdirSync(dictDir).filter((n) => n.endsWith(".ts")).sort()) {
  const { entries, serverStrings: fromFile = [] } = await import(pathToFileURL(join(dictDir, name)).href);
  extraServerStrings.push(...fromFile);
  byFile[name] = new Set(Object.keys(entries));
  for (const [key, value] of Object.entries(entries)) {
    const earlier = dictionary[key];
    if (earlier && ["hi", "ta", "te"].some((language) => earlier[language] !== value[language])) {
      problems.push(`CONFLICT  ${JSON.stringify(key)} is translated differently in ${origin[key]} and ${name}`);
    }
    dictionary[key] = earlier ?? value;
    origin[key] ??= name;
  }
}

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const check = (key, where) => {
  const entry = dictionary[key];
  if (!entry) return problems.push(`MISSING   ${JSON.stringify(key)}  (${where})`);
  for (const language of ["hi", "ta", "te"]) {
    if (!entry[language]?.trim()) problems.push(`EMPTY ${language}  ${JSON.stringify(key)}`);
    else if (placeholders(entry[language]) !== placeholders(key)) problems.push(`PLACEHOLDERS ${language}  ${JSON.stringify(key)}`);
  }
};
for (const [key, where] of used) check(key, where);
// Each screen must find its keys in the dictionaries that screen loads, not just somewhere in the app.
const loadedBy = { patient: () => false, auth: (name) => name === "auth.ts", doctor: (name) => name.startsWith("doctor-") };
for (const [key, surfaces] of surfacesOf) {
  for (const [surface, where] of surfaces) {
    const inStatic = key in translations;
    const inLoaded = Object.entries(byFile).some(([name, keys]) => loadedBy[surface](name) && keys.has(key));
    if (!inStatic && !inLoaded && dictionary[key]) problems.push(`NOT LOADED  ${JSON.stringify(key)} is used on a ${surface} screen (${where}) but only defined in a dictionary that screen does not load`);
  }
}
for (const key of [...serverStrings, ...extraServerStrings]) check(key, "text sent by the server");

// Visible English text that is not wrapped in t(): JSX text and the usual text attributes. A heuristic: it can flag
// a few things that need no translation (a product name, a unit), which is why it is a list and not a failure.
const unwrapped = [];
if (wantUnwrapped) {
  const lineOf = (source, index) => source.slice(0, index).split("\n").length;
  for (const file of files.filter((f) => f.endsWith(".tsx"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/>([^<>{}]*)</g)) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (!/[A-Za-z]{3}/.test(text) || /[()=;&|]|=>/.test(text)) continue;
      unwrapped.push(`${rel(file)}:${lineOf(source, match.index)}  ${JSON.stringify(text)}`);
    }
    for (const match of source.matchAll(/\b(placeholder|title|aria-label|alt)="([^"]*[A-Za-z]{3}[^"]*)"/g)) {
      unwrapped.push(`${rel(file)}:${lineOf(source, match.index)}  ${match[1]}=${JSON.stringify(match[2])}`);
    }
  }
}

const inScope = (text) => !only || text.includes(only);
const unused = Object.keys(dictionary).filter((key) => !used.has(key) && !serverStrings.includes(key) && !extraServerStrings.includes(key));
console.log(`${used.size} strings used in the translated screens, ${serverStrings.length + extraServerStrings.length} server strings, ${Object.keys(dictionary).length} dictionary entries.`);
if (unused.length) console.log(`note: ${unused.length} dictionary entries are not referenced by the scanned files.`);
if (wantUnwrapped) {
  const shown = unwrapped.filter(inScope);
  console.log(`\n${shown.length} possibly unwrapped visible strings${only ? ` matching "${only}"` : ""}:`);
  console.log(shown.join("\n"));
}
const reported = problems.filter(inScope);
if (reported.length) {
  console.error(`\n${reported.length} problem(s):\n` + reported.join("\n"));
  process.exit(1);
}
console.log("OK: every string has hi, ta and te translations with matching placeholders.");
