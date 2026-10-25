"""Download the openly licensed reference PDFs from their publishers so the Guidelines page can search them.

Run from the backend folder:   python fetch_reference_documents.py
Only entries marked "passage_search" in app/data/reference_library_*.json are fetched; those are the documents whose
licence allows it (WHO publications under CC BY-NC-SA 3.0 IGO, the MoHFW gestational diabetes guideline, which states
that excerpts may be reproduced with acknowledgement, and four FIGO papers that are open access under CC BY or CC BY-NC). Everything else stays a link. Files go to
backend/reference_documents/, which git ignores. Restart the API afterwards to index them.
"""
import sys
import time
import urllib.error
import urllib.request

from app.reference_library import DOCUMENTS_DIR, load_manifest

UA = "Mozilla/5.0 (compatible; MaternaSync reference fetch)"
MAX_BYTES = 60 * 1024 * 1024
ATTEMPTS = 3
PAUSE_SECONDS = 5


def fetch(entry):
    target = DOCUMENTS_DIR / f"{entry['id']}.pdf"
    if target.exists():
        return "already downloaded"
    request = urllib.request.Request(entry["document_url"], headers={"User-Agent": UA})
    problem = "no attempt"
    for attempt in range(1, ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read(MAX_BYTES + 1)
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                # A publisher that asks a script to prove it is a browser (Europe PMC does this) is not retried and not worked around:
                # the document is open access, so it can be saved from the browser instead.
                return (f"FAILED (HTTP {error.code}: the publisher does not serve scripts. Open {entry['document_url']} in a browser and save the PDF as "
                        f"{target.name} in {DOCUMENTS_DIR})")
            problem = f"FAILED ({error})"
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            problem = f"FAILED ({error})"
        else:
            if len(data) > MAX_BYTES:
                return "FAILED (file larger than 60 MB)"
            if data[:5] == b"%PDF-":
                break
            return "FAILED (the link did not return a PDF)"
        if attempt < ATTEMPTS:
            time.sleep(PAUSE_SECONDS * attempt)  # a busy server or a dropped connection: wait and try again
    else:
        return problem
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
