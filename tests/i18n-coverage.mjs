// Checks that every string the patient portal passes to t()/tx()/translate() has a Hindi, Tamil and Telugu
// translation, with the same {placeholders}. Run: node tests/i18n-coverage.mjs
// (Node 22.18+/24 can import the dictionary directly because it uses plain, erasable TypeScript.)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scanned = [
  join(root, "src", "roles", "patient"),
  join(root, "src", "components", "continuity", "shared.tsx"),
];
const files = [];
const walk = (path) => {
  if (statSync(path).isDirectory()) readdirSync(path).forEach((name) => walk(join(path, name)));
  else if (/\.(tsx?|jsx?)$/.test(path)) files.push(path);
};
scanned.forEach(walk);

const literal = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + "`(?:[^`\\\\$]|\\\\.)*`";
const call = new RegExp(String.raw`(?<![\w.])(?:t|tx|translate)\(\s*(${literal})`, "g");
const decode = (raw) => {
  const body = raw.slice(1, -1);
  if (raw[0] === '"') return JSON.parse(raw);
  return body.replace(/\\(['`\\])/g, "$1").replace(/\\n/g, "\n");
};

const used = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(call)) {
    const key = decode(match[1]);
    if (!used.has(key)) used.set(key, file.replace(root, "").replaceAll("\\", "/"));
  }
}

const { translations, serverStrings } = await import(pathToFileURL(join(root, "src", "i18n", "translations.ts")).href);
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
const problems = [];
const check = (key, where) => {
  const entry = translations[key];
  if (!entry) return problems.push(`MISSING   ${JSON.stringify(key)}  (${where})`);
  for (const language of ["hi", "ta", "te"]) {
    if (!entry[language]?.trim()) problems.push(`EMPTY ${language}  ${JSON.stringify(key)}`);
    else if (placeholders(entry[language]) !== placeholders(key))
      problems.push(`PLACEHOLDERS ${language}  ${JSON.stringify(key)}`);
  }
};
for (const [key, where] of used) check(key, where);
for (const key of serverStrings) check(key, "text sent by the server");

const unused = Object.keys(translations).filter((key) => !used.has(key) && !serverStrings.includes(key));
console.log(`${used.size} strings used in the patient portal, ${serverStrings.length} server strings, ${Object.keys(translations).length} dictionary entries.`);
if (unused.length) console.log(`note: ${unused.length} dictionary entries are not referenced by the scanned files.`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("OK: every string has hi, ta and te translations with matching placeholders.");
