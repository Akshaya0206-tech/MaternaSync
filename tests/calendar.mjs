// Checks the calendar file a trusted person downloads for a visit: valid structure, UTC times, escaped text, folded long lines.
// Run: node tests/calendar.mjs
import assert from "node:assert/strict";
import { buildCalendarFile, mapUrl } from "../src/roles/caregiver/calendar.ts";

const file = buildCalendarFile(
  { id: "abc-123", title: "Visit with Sarah: Antenatal visit", start: "2026-11-03T04:30:00.000Z", minutes: 45, location: "City Women's Hospital, 4 Lake Road; Chennai", description: "Line one\nLine two" },
  new Date("2026-10-25T10:00:00Z"),
);
const lines = file.split("\r\n");
assert.equal(lines[0], "BEGIN:VCALENDAR");
assert.equal(lines.at(-2), "END:VCALENDAR");
assert.equal(lines.at(-1), "", "the file ends with a line break");
assert.ok(lines.includes("DTSTART:20261103T043000Z") && lines.includes("DTEND:20261103T051500Z"), "times are UTC and the length is applied");
assert.ok(lines.includes("DTSTAMP:20261025T100000Z"));
assert.ok(lines.includes("UID:abc-123@maternasync"));
assert.ok(file.includes("SUMMARY:Visit with Sarah: Antenatal visit"), "a colon in the text is fine");
assert.ok(file.includes("LOCATION:City Women's Hospital\\, 4 Lake Road\\; Chennai"), "commas and semicolons are escaped");
assert.ok(file.includes("DESCRIPTION:Line one\\nLine two"), "a line break becomes \\n");
assert.ok(file.includes("TRIGGER:-PT120M") && file.includes("BEGIN:VALARM"), "a reminder two hours before");
for (const line of lines) assert.ok(line.length <= 75, `no line is longer than 75 characters: ${line.length}`);

const long = buildCalendarFile({ id: "x", title: "A".repeat(200), start: "2026-11-03T04:30:00Z" });
assert.ok(long.split("\r\n").some((line) => line.startsWith(" A")), "a long line is folded onto a continuation line");
assert.equal(long.split("\r\n").join("").replace(/ /g, "").includes("A".repeat(200)), true, "folding loses nothing");
assert.ok(!buildCalendarFile({ id: "y", title: "t", start: "2026-11-03T04:30:00Z" }).includes("LOCATION"), "no location line when there is none");

assert.equal(mapUrl("4 Lake Road & Co, Chennai"), "https://www.openstreetmap.org/search?query=4%20Lake%20Road%20%26%20Co%2C%20Chennai");
console.log("OK: the calendar file is valid, escaped, folded and in UTC.");
