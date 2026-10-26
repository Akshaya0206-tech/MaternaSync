"""The kinds of document a patient can say a file is when she uploads it. The kind is only a label she chooses (or, for the demo records that came
with the app, a guess from their title); nothing in the app reads a document's contents to decide it."""
import re

DOCUMENT_TYPES = ["lab_report", "scan", "prescription", "discharge_summary", "vaccination_card", "visit_note", "other"]

# Words in a demo record's title or file reference that say what kind of record it is. First match wins.
_HINTS = [
    ("scan", r"\bultrasound\b|\bscan\b|\bnuchal\b|^RAD-|\bsonogra"),
    ("lab_report", r"\blab\b|^LAB-|\bculture\b|\bglucose tolerance\b|\bOGTT\b|\bNIPT\b|\bblood (test|count)\b|\bCBC\b"),
    ("discharge_summary", r"\bdischarge\b"),
    ("vaccination_card", r"\bvaccin|\bimmuni[sz]ation\b|\btetanus\b"),
    ("prescription", r"\bprescription\b|\bmedicine list\b"),
    ("visit_note", r"^EHR-CN-|\bvisit\b|\bconsult|\bantenatal\b|\bintake\b|\bassessment\b"),
]


def infer_document_type(*texts: str | None) -> str:
    """A best guess for a record that has no type yet, from its title and file reference."""
    for kind, pattern in _HINTS:
        if any(text and re.search(pattern, text, re.I) for text in texts):
            return kind
    return "other"
