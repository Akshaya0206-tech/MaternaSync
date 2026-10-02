"""Local, rule-based document text extraction and field parsing.

No guessing: every field is either found verbatim in the source document
(status "extracted"), found but ambiguous/low-confidence (status
"needs_review"), or absent (status "not_found" and the value is left
empty). Nothing here infers or invents clinical information.
"""

import io
import re
from pathlib import Path

import fitz  # PyMuPDF

try:
    import pytesseract
    from PIL import Image
    _OCR_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    _OCR_AVAILABLE = False

MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec"
MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}

RECORD_TYPE_KEYWORDS = [
    ("ultrasound", "Ultrasound / Scan", "care_document"),
    ("sonograph", "Ultrasound / Scan", "care_document"),
    ("scan", "Ultrasound / Scan", "care_document"),
    ("consultation", "Consultation Note", "consultation_note"),
    ("progress note", "Consultation Note", "consultation_note"),
    ("visit note", "Consultation Note", "consultation_note"),
    ("referral", "Referral", "referral"),
    ("laboratory", "Lab / Investigation", "care_document"),
    ("lab report", "Lab / Investigation", "care_document"),
    ("blood test", "Lab / Investigation", "care_document"),
    ("glucose", "Lab / Investigation", "care_document"),
    ("follow-up", "Follow-up", "follow_up"),
    ("follow up", "Follow-up", "follow_up"),
]


def _ocr_image_bytes(png_bytes: bytes) -> str:
    if not _OCR_AVAILABLE:
        return ""
    try:
        image = Image.open(io.BytesIO(png_bytes))
        return pytesseract.image_to_string(image)
    except Exception:
        return ""


def extract_text(file_path: Path) -> tuple[str, bool, bool]:
    """Returns (text, used_ocr, ocr_attempted_but_unavailable)."""
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        doc = fitz.open(file_path)
        text_parts = [page.get_text() for page in doc]
        text = "\n".join(text_parts).strip()
        if len(text) >= 40:
            return text, False, False

        if not _OCR_AVAILABLE:
            return text, False, True

        ocr_parts = []
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            ocr_parts.append(_ocr_image_bytes(pix.tobytes("png")))
        ocr_text = "\n".join(ocr_parts).strip()
        return (ocr_text or text), True, False

    if suffix in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
        if not _OCR_AVAILABLE:
            return "", False, True
        with open(file_path, "rb") as f:
            raw = f.read()
        return _ocr_image_bytes(raw), True, False

    return "", False, False


def _field(value: str | None, status: str) -> dict:
    return {"value": value or "", "status": status}


def parse_date(text: str) -> tuple[dict, str | None]:
    """Returns (field, iso_date_or_none)."""
    m = re.search(r"\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b", text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            iso = f"{y:04d}-{mo:02d}-{d:02d}"
            return _field(m.group(0), "extracted"), iso

    m = re.search(rf"\b(\d{{1,2}})\s+({MONTHS})[a-z]*\s+(\d{{4}})\b", text, re.IGNORECASE)
    if m:
        d, mon, y = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        iso = f"{y:04d}-{MONTH_NAMES[mon]:02d}-{d:02d}"
        return _field(m.group(0), "extracted"), iso

    m = re.search(rf"\b({MONTHS})[a-z]*\s+(\d{{1,2}}),?\s+(\d{{4}})\b", text, re.IGNORECASE)
    if m:
        mon, d, y = m.group(1).lower(), int(m.group(2)), int(m.group(3))
        iso = f"{y:04d}-{MONTH_NAMES[mon]:02d}-{d:02d}"
        return _field(m.group(0), "extracted"), iso

    return _field(None, "not_found"), None


def _lines(text: str) -> list[str]:
    return [ln.strip() for ln in text.splitlines() if ln.strip()]


def _search_lines(patterns: list[str], text: str) -> re.Match | None:
    """Matches each pattern against individual lines only, so a capture can
    never run on past a line break into unrelated text."""
    for pattern in patterns:
        for line in _lines(text):
            m = re.search(pattern, line, re.IGNORECASE)
            if m:
                return m
    return None


NAME_RE = r"[A-Z][a-zA-Z.\-]+(?:\s+[A-Z][a-zA-Z.\-]+){0,2}"


def parse_doctor(text: str) -> dict:
    m = _search_lines([
        rf"(?:Attending(?:\s+Physician)?|Physician|Provider|Doctor|Ordering Physician|Referring Physician)\s*[:\-]\s*(Dr\.?\s*{NAME_RE}|{NAME_RE})",
        rf"\b(Dr\.?\s+{NAME_RE})",
    ], text)
    if m:
        return _field(m.group(1).strip().rstrip(".,"), "extracted")
    return _field(None, "not_found")


def parse_facility(text: str) -> dict:
    m = _search_lines([
        r"(?:Facility|Hospital|Clinic|Center|Centre)\s*[:\-]\s*([A-Z][\w &.,'\-]{3,60})",
    ], text)
    if m:
        return _field(m.group(1).strip().rstrip(".,"), "extracted")

    m = _search_lines([
        r"^([A-Z][\w&.,'\-]*(?:\s+[A-Z][\w&.,'\-]*){0,4}\s+(?:Hospital|Clinic|Medical Center|Medical Centre|Health Center|Health Centre|Imaging Center|Laboratory|Diagnostics))\b",
    ], text)
    if m:
        return _field(m.group(1).strip().rstrip(".,"), "extracted")

    return _field(None, "not_found")


def parse_patient_name(text: str) -> dict:
    m = _search_lines([
        rf"Patient(?:\s+Name)?\s*[:\-]\s*({NAME_RE})",
        rf"^Name\s*[:\-]\s*({NAME_RE})",
    ], text)
    if m:
        return _field(m.group(1).strip().rstrip(".,"), "extracted")
    return _field(None, "not_found")


def parse_mrn(text: str) -> dict:
    m = _search_lines([
        r"(?:MRN|Medical Record Number|Patient ID)\s*[:\-#]?\s*([A-Za-z0-9\-]{3,20})",
    ], text)
    if m:
        return _field(m.group(1).strip(), "extracted")
    return _field(None, "not_found")


def parse_gestational_age(text: str) -> tuple[dict, int | None, int | None]:
    m = re.search(r"\b(\d{1,2})\s*(?:weeks?|wks?|w)\s*(?:[,+]?\s*(\d{1,2})\s*(?:days?|d))?\b", text, re.IGNORECASE)
    if m:
        weeks = int(m.group(1))
        days = int(m.group(2)) if m.group(2) else 0
        if 4 <= weeks <= 42:
            return _field(m.group(0).strip(), "extracted"), weeks, days

    m = re.search(r"\bGA\s*[:\-]?\s*(\d{1,2})w?(\d{1,2})?d?\b", text, re.IGNORECASE)
    if m:
        weeks = int(m.group(1))
        days = int(m.group(2)) if m.group(2) else 0
        return _field(m.group(0).strip(), "extracted"), weeks, days

    return _field(None, "not_found"), None, None


def parse_record_type(text: str) -> tuple[dict, str, str]:
    lowered = text.lower()
    for keyword, label, category in RECORD_TYPE_KEYWORDS:
        if keyword in lowered:
            return _field(label, "extracted"), label, category
    return _field(None, "not_found"), "Uploaded Medical Record", "care_document"


def extract_structured_fields(text: str, filename: str) -> dict:
    """Runs all heuristic parsers over extracted text and returns a single
    structured dict of field -> {value, status}, plus derived values used to
    build the pending Record row."""

    if not text or not text.strip():
        return {
            "fields": {
                "recordType": _field(None, "not_found"),
                "visitType": _field(None, "not_found"),
                "date": _field(None, "not_found"),
                "facility": _field(None, "not_found"),
                "responsibleDoctor": _field(None, "not_found"),
                "gestationalAge": _field(None, "not_found"),
                "patientName": _field(None, "not_found"),
                "mrn": _field(None, "not_found"),
            },
            "derived": {
                "title": filename,
                "category": "care_document",
                "timestamp": None,
                "gaWeeks": None,
                "gaDays": None,
                "summary": "No readable text could be extracted from this document.",
            },
        }

    date_field, iso_date = parse_date(text)
    doctor_field = parse_doctor(text)
    facility_field = parse_facility(text)
    ga_field, ga_weeks, ga_days = parse_gestational_age(text)
    patient_name_field = parse_patient_name(text)
    mrn_field = parse_mrn(text)
    record_type_field, record_type_label, category = parse_record_type(text)

    summary_source = " ".join(text.split())
    summary = summary_source[:280] + ("…" if len(summary_source) > 280 else "")

    fields = {
        "recordType": record_type_field,
        "visitType": _field("Antenatal Visit", "needs_review") if "antenatal" in text.lower() or "prenatal" in text.lower() else _field(None, "not_found"),
        "date": date_field,
        "facility": facility_field,
        "responsibleDoctor": doctor_field,
        "gestationalAge": ga_field,
        "patientName": patient_name_field,
        "mrn": mrn_field,
    }

    derived = {
        "title": record_type_label if record_type_field["status"] == "extracted" else (filename.rsplit(".", 1)[0]),
        "category": category,
        "timestamp": iso_date,
        "gaWeeks": ga_weeks,
        "gaDays": ga_days,
        "summary": summary or "No readable summary could be extracted from this document.",
    }

    return {"fields": fields, "derived": derived}
