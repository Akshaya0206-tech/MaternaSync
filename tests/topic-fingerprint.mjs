// Checks the fingerprint of a patient References topic: our small SHA-256 gives the same answer as Node's own, the fingerprint is stable, and it
// changes when the English text changes but not when only a Hindi, Tamil or Telugu sentence does. Run: node tests/topic-fingerprint.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalTopicText, sha256, topicFingerprint } from "../src/data/topicFingerprint.ts";
import { patientReferences } from "../src/data/patientReferences.ts";

const reference = (text) => createHash("sha256").update(text, "utf8").digest("hex");

for (const text of ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(63), "a".repeat(64), "a".repeat(119), "a".repeat(1000), "नमस्ते தமிழ் తెలుగు", "emoji \u{1F930} and “quotes”", "line\nbreak\r\n"]) {
  assert.equal(sha256(text), reference(text), `same as Node for ${JSON.stringify(text.slice(0, 20))} (${text.length} characters)`);
}
assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "the standard test value");

const topics = patientReferences.topics;
assert.ok(topics.length >= 18, "the topics are there");
const all = Object.fromEntries(topics.map((topic) => [topic.id, topicFingerprint(topic)]));
for (const topic of topics) {
  assert.match(all[topic.id], /^[0-9a-f]{64}$/, `${topic.id} has a fingerprint`);
  assert.equal(all[topic.id], reference(canonicalTopicText(topic)), `${topic.id}: ours is Node's`);
  assert.equal(topicFingerprint(topic), all[topic.id], `${topic.id}: stable`);
}
assert.equal(new Set(Object.values(all)).size, topics.length, "no two topics share a fingerprint");

const first = topics[0];
const copy = (change) => ({ ...first, ...change });
const same = topicFingerprint(first);
assert.notEqual(topicFingerprint(copy({ summary: { ...first.summary, en: first.summary.en + " " } })), same, "a changed English summary changes it");
assert.notEqual(topicFingerprint(copy({ title: { ...first.title, en: first.title.en + "!" } })), same, "a changed title changes it");
assert.notEqual(topicFingerprint(copy({ keyPoints: { ...first.keyPoints, en: [...first.keyPoints.en, "One more point."] } })), same, "a new point changes it");
assert.notEqual(topicFingerprint(copy({ keyPoints: { ...first.keyPoints, en: [...first.keyPoints.en].reverse() } })), first.keyPoints.en.length > 1 ? same : "x", "a different order changes it");
assert.notEqual(topicFingerprint(copy({ seekHelp: { ...first.seekHelp, en: [...first.seekHelp.en, "Go to hospital."] } })), same, "a new get-help line changes it");
assert.notEqual(topicFingerprint(copy({ sources: [...first.sources, { label: "x", publisher: "y", url: "https://example.org" }] })), same, "a new source changes it");
assert.equal(topicFingerprint(copy({ summary: { ...first.summary, hi: first.summary.hi + " बदला", ta: first.summary.ta + " x", te: first.summary.te + " x" } })), same, "a change only in Hindi, Tamil or Telugu does not");
assert.equal(topicFingerprint(copy({ keywords: [...first.keywords, "extra"] })), same, "search words are not part of what was read");
console.log(`OK: the fingerprint of all ${topics.length} topics is a SHA-256 that matches Node's, is stable, and changes only with the English text.`);
