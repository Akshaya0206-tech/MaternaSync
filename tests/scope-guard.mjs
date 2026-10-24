// Guards the hackathon's "no interpretation of medical data" rule. Fails if any English text a person reads on a translated screen
// (everything passed to t()/tx()/translate(), plus the English fixed sentences in the dictionaries) uses wording that judges or
// explains a clinical value: "abnormal", "within/above/below the range", risk labels, alarm words, inference words, "diagnosis".
// Run: node tests/scope-guard.mjs        (add --list to print every allowed exception with its reason)
// The server's fixed wording is guarded the same way by backend/tests/test_scope_guard.py.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const showAllowed = process.argv.includes("--list");

const FORBIDDEN = {
  "calls a value abnormal": /\babnormal(ly|ity|ities)?\b/i,
  "judges a value against a range": /\b(within|outside|above|below|over|under)( the)? (normal|reference|expected|target|healthy|printed|safe)( range| limits?| values?)?\b|\bout of range\b/i,
  "risk label": /\b(high|moderate|low|increased)[- ]risk\b|\bat (high |increased )?risk\b/i,
  "alarm word": /\b(concerning|worrying|alarming|dangerous)\b/i,
  "draws an inference": /\b(suggests?|suggestive of|indicates?|indicative of|consistent with|likely|probably|may have|might have)\b/i,
  "diagnosis": /\bdiagnos(is|ed|es|e|ing|tic)\b/i,
  "says a value is normal": /\bnormal(ly)?\b/i,
};

// Every exception, with the reason it is not an interpretation. A new one needs a reason a reviewer can read.
const ALLOWED = [
  [/does not (say|give|offer|make|check|interpret)|do not (say|give)|never (diagnose|diagnoses|advises)|not (a|an) (diagnosis|diagnostic)|no diagnosis|It never diagnoses|nor diagnoses/i,
    "a sentence that says the app does NOT do this"],
  [/\b(is|are) it normal|normal to feel|whether (it|something|this|a result) is normal/i, "a patient's own question, or a sentence saying the app does not answer it"],
  [/Low-risk administrative step|low-risk administrative|Low-risk/i, "the assistant's operational tier for a routine admin step, not a grade of a patient"],
  [/not (evidence of|a sign of)|not (about|specific to) your|general information/i, "a disclaimer"],
  [/\bnormal\b.{0,60}\bplaceholder|bracketed/i, "an instruction about the app's own placeholders"],
  [/^Normal text$/, "the text-size option on the page header, not a statement about a value"],
  [/^High[- ][Rr]isk( pregnancy)?$/, "a category label on a reference-document filter (Guidelines, Reference Library); it groups documents and grades no patient"],
];

// A sentence that says the app does NOT do something ("does not diagnose", "not labelled normal", "never look at...") is a disclaimer.
// The forbidden word counts as negated only when a negation sits just before it.
const NEGATION = /\b(not|never|no|nor|cannot|without|n't)\b[^.]{0,60}$/i;
const negated = (text, pattern) => {
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const hits = [...text.matchAll(new RegExp(pattern.source, flags))];
  return hits.length > 0 && hits.every((hit) => NEGATION.test(text.slice(0, hit.index)));
};

const files = [];
const walk = (path) => {
  if (statSync(path).isDirectory()) readdirSync(path).forEach((name) => walk(join(path, name)));
  else if (/\.(tsx|jsx)$/.test(path) || /(tour|format)\.ts$/.test(path)) files.push(path);
};
[
  join(root, "src", "roles"), join(root, "src", "components"), join(root, "src", "pages"), join(root, "src", "routes", "LoadStates.tsx"),
].forEach(walk);
const rel = (file) => file.replace(root, "").replaceAll("\\", "/");

const literal = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|` + "`(?:[^`\\\\$]|\\\\.)*`";
const call = new RegExp(String.raw`(?<![\w.])(?:t|tx|translate)\(\s*(${literal})`, "g");
const decode = (raw) => (raw[0] === '"' ? JSON.parse(raw) : raw.slice(1, -1).replace(/\\(['`\\])/g, "$1").replace(/\\n/g, "\n"));

const found = new Map();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(call)) {
    const text = decode(match[1]);
    if (!found.has(text)) found.set(text, rel(file));
  }
}
// The dictionaries' English keys are what screens look up, so check them too (this also covers text fetched through t(variable)).
const { translations, serverStrings } = await import(pathToFileURL(join(root, "src", "i18n", "translations.ts")).href);
const dicts = [];
for (const name of readdirSync(join(root, "src", "i18n", "dicts")).filter((n) => n.endsWith(".ts"))) {
  const { entries, serverStrings: more = [] } = await import(pathToFileURL(join(root, "src", "i18n", "dicts", name)).href);
  dicts.push(...Object.keys(entries), ...more);
}
for (const text of [...Object.keys(translations), ...serverStrings, ...dicts]) if (!found.has(text)) found.set(text, "a dictionary");

const problems = [];
const allowed = [];
for (const [text, where] of found) {
  for (const [name, pattern] of Object.entries(FORBIDDEN)) {
    if (!pattern.test(text)) continue;
    const exception = ALLOWED.find(([safe]) => safe.test(text)) ?? (negated(text, pattern) ? [null, "a sentence that says the app does NOT do this"] : undefined);
    if (exception) allowed.push(`${name}: “${text.slice(0, 110)}” (${where}) — ${exception[1]}`);
    else problems.push(`${name}: “${text.slice(0, 140)}”  (${where})`);
  }
}
console.log(`Checked ${found.size} English strings from the translated screens and dictionaries.`);
if (showAllowed || allowed.length) console.log(`${allowed.length} allowed exception(s)${showAllowed ? ":\n  " + allowed.join("\n  ") : " (run with --list to read them)"}`);
if (problems.length) {
  console.error(`\n${problems.length} string(s) interpret or judge a value:\n- ` + problems.join("\n- "));
  process.exit(1);
}
console.log("OK: nothing on these screens labels a value, compares it with a range, grades a risk or draws a clinical conclusion.");
