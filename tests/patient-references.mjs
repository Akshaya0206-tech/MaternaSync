// Checks the patient References content: every text exists in all four languages, lists line up across
// languages, every source is a web link, and nothing that changes often (scheme amounts) has crept in.
// Run: node tests/patient-references.mjs   (Node 22.18+/24 can import the TypeScript data file directly.)
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { patientReferences: data } = await import(pathToFileURL(join(root, "src", "data", "patientReferences.ts")).href);

const LANGS = ["en", "hi", "ta", "te"];
const problems = [];
const fail = (message) => problems.push(message);
const say = (label, value) => {
  for (const lang of LANGS) if (typeof value?.[lang] !== "string" || !value[lang].trim()) fail(`${label}: missing ${lang}`);
};
const list = (label, value, { optional = false } = {}) => {
  const lengths = LANGS.map((lang) => (Array.isArray(value?.[lang]) ? value[lang].length : -1));
  if (lengths.some((n) => n < 0) || new Set(lengths).size !== 1) fail(`${label}: lists differ across languages (${lengths.join("/")})`);
  else if (!optional && lengths[0] === 0) fail(`${label}: empty`);
  for (const lang of LANGS) for (const [i, text] of (value?.[lang] ?? []).entries()) if (!String(text).trim()) fail(`${label}[${i}] ${lang}: empty`);
};

const categoryIds = new Set(data.categories.map((c) => c.id));
data.categories.forEach((c) => say(`category ${c.id}`, c.title));
const ids = new Set();
for (const topic of data.topics) {
  if (ids.has(topic.id)) fail(`duplicate topic id ${topic.id}`);
  ids.add(topic.id);
  if (!categoryIds.has(topic.category)) fail(`${topic.id}: unknown category ${topic.category}`);
  say(`${topic.id} title`, topic.title);
  say(`${topic.id} summary`, topic.summary);
  list(`${topic.id} keyPoints`, topic.keyPoints);
  list(`${topic.id} seekHelp`, topic.seekHelp, { optional: true });
  if (!topic.sources.length) fail(`${topic.id}: no sources`);
  for (const source of topic.sources) if (!/^https:\/\/\S+$/.test(source.url) || !source.label || !source.publisher) fail(`${topic.id}: bad source ${JSON.stringify(source)}`);
  if (!topic.keywords.length) fail(`${topic.id}: no search keywords`);
}
if (data.topics[0]?.id !== "danger-signs") fail("the warning signs topic must come first");
if (!data.topics.find((t) => t.id === "danger-signs")?.seekHelp.en.length) fail("danger-signs needs its list of warning signs");
for (const helpline of data.helplines) {
  if (!/^\d{3,5}$/.test(helpline.number)) fail(`helpline ${helpline.number}: not a plain number`);
  say(`helpline ${helpline.number} label`, helpline.label);
  say(`helpline ${helpline.number} note`, helpline.note);
}
const everything = JSON.stringify(data);
if (/₹\s?\d|Rs\.? ?\d/.test(everything)) fail("a rupee amount appeared: scheme amounts change and differ by state, so they are not shown");
if (data.helplines.some((h) => h.number === "104")) fail("104 is a state-level service and must not be listed");

console.log(`${data.topics.length} topics, ${data.helplines.length} helplines, ${data.topics.reduce((n, t) => n + t.sources.length, 0)} source links.`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("OK: every topic is complete in English, Hindi, Tamil and Telugu.");
