"""Download the openly licensed reference PDFs from their publishers so the Guidelines page can search them.

Run from the backend folder:   python fetch_reference_documents.py
Only entries marked "passage_search" in app/data/reference_library_*.json are fetched; those are the documents whose
licence allows it (WHO publications under CC BY-NC-SA 3.0 IGO, and the MoHFW gestational diabetes guideline, which
states that excerpts may be reproduced with acknowledgement). Everything else stays a link. Files go to
backend/reference_documents/, which git ignores. Restart the API afterwards to index them.
"""
import sys
import urllib.error
import urllib.request

from app.reference_library import DOCUMENTS_DIR, load_manifest

UA = "Mozilla/5.0 (compatible; MaternaSync reference fetch)"
MAX_BYTES = 60 * 1024 * 1024


def fetch(entry):
    target = DOCUMENTS_DIR / f"{entry['id']}.pdf"
    if target.exists():
        return "already downloaded"
    request = urllib.request.Request(entry["document_url"], headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read(MAX_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return f"FAILED ({error})"
    if len(data) > MAX_BYTES:
        return "FAILED (file larger than 60 MB)"
    if data[:5] != b"%PDF-":
        return "FAILED (the link did not return a PDF)"
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return f"saved {len(data) / 1e6:.1f} MB"


if __name__ == "__main__":
    wanted = [e for e in load_manifest() if e.get("passage_search") and e.get("document_url")]
    failures = 0
    for number, entry in enumerate(wanted, start=1):
        result = fetch(entry)
        failures += result.startswith("FAILED")
        print(f"[{number}/{len(wanted)}] {entry['id']}: {result}")
    sys.exit(1 if failures else 0)
