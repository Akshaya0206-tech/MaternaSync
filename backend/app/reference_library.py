"""The doctor's Reference Library: real, publisher-sourced documents only.

Content comes from backend/app/data/reference_library_*.json. Every entry there was checked against the issuing
body's own page (title, date, version note, link, licence wording). Nothing is invented and no synthetic or
demonstration guideline is created.

Two layers, both waiting for a doctor's review before they are used:
  * Library entries (ClinicalResource, kind "guideline"): citation, official links, a short summary written in our
    own words, the publisher's reuse terms. The original text is never copied into the app.
  * Passage search (GuidelineSource): only for documents whose licence allows it. Their PDFs are downloaded by
    `python fetch_reference_documents.py` into backend/reference_documents/ (not committed to git) and indexed here.
"""
import json
from datetime import timedelta
from pathlib import Path

from . import models
from .config import UPLOAD_DIR
from .continuity_service import now

DATA_DIR = Path(__file__).resolve().parent / "data"
DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "reference_documents"
# Earlier placeholder links (one index page per publisher), replaced by the specific documents in the data files.
RETIRED_PLACEHOLDERS = ("starter-fogsi", "starter-icmr", "starter-who", "starter-nice")


def load_manifest():
    entries = []
    for path in sorted(DATA_DIR.glob("reference_library_*.json")):
        entries.extend(json.loads(path.read_text(encoding="utf-8")))
    return entries


def _audit(db, action, title, details):
    db.add(models.AuditLog(episode_id=None, actor_user_id=None, actor_role=None, actor_display_name="System", action=action,
                           title=title, details=details, object_type="ReferenceLibrary", object_id=None))


def remove_synthetic_sources(db):
    """Delete any demonstration guideline documents left by earlier versions. Real uploads are untouched."""
    removed = db.query(models.GuidelineSource).filter(models.GuidelineSource.is_demo_content.is_(True)).all()
    for source in removed:
        try:
            Path(source.file_path).unlink(missing_ok=True)
        except OSError:
            pass
        db.delete(source)  # passages and reviews go with it
    if removed:
        _audit(db, "synthetic_guidelines_removed", "Synthetic demonstration guidelines removed", f"{len(removed)} document(s) removed; only real documents remain.")
        print(f"Removed {len(removed)} synthetic demonstration guideline document(s).")


def remove_placeholders(db):
    """Drafts of the old index-page links are deleted; an approved one is retired, so its approval history stays in the audit log."""
    retired = 0
    for family in RETIRED_PLACEHOLDERS:
        for item in db.query(models.ClinicalResource).filter_by(family_id=family).all():
            if item.status == "DRAFT":
                db.delete(item)
            elif item.status in ("APPROVED", "SUPERSEDED"):
                item.status = "RETIRED"
                retired += 1
    if retired:
        _audit(db, "placeholder_references_retired", "Placeholder reference links retired", f"{retired} publisher index-page link(s) retired; the specific documents replace them.")
        print(f"Retired {retired} placeholder reference link(s).")


def _resource_values(entry):
    content = entry["summary"] + "\n\nVersion and currency: " + entry["version_note"] + "\n\nThis entry cites the document and links to the publisher. It does not reproduce the document."
    return dict(kind="guideline", title=entry["title"], topic=entry["topic"], issuer=entry["issuer"], jurisdiction=entry["jurisdiction"],
                publication_date=entry.get("publication_date"), source_url=entry["source_url"], section=entry["section"], content=content,
                rights_note=entry["rights"], language="en", stage="all",
                configuration={"documentUrl": entry.get("document_url"), "category": entry["category"], "referenceId": entry["id"]})


def add_library_entries(db, doctor):
    added = 0
    for entry in load_manifest():
        family = "ref-" + entry["id"]
        if db.query(models.ClinicalResource).filter_by(family_id=family).first():
            continue
        db.add(models.ClinicalResource(**_resource_values(entry), family_id=family, version=1, status="DRAFT",
                                       review_due=(now().date() + timedelta(days=180)).isoformat(), created_by_user_id=doctor.id))
        added += 1
    if added:
        _audit(db, "reference_documents_added", "Reference documents added", f"{added} verified real document(s) added to the Reference Library as drafts for doctor review.")
        print(f"Added {added} reference document(s) to the Reference Library (drafts awaiting a doctor's approval).")


def index_downloaded_documents(db, doctor):
    """Index passages from PDFs that were downloaded from their publishers (see fetch_reference_documents.py)."""
    from .routers.clinical_guidelines import ingest_source  # imported here: the router imports models at load time

    indexed = 0
    for entry in load_manifest():
        pdf = DOCUMENTS_DIR / f"{entry['id']}.pdf"
        if not entry.get("passage_search") or not pdf.exists() or db.query(models.GuidelineSource).filter_by(title=entry["title"]).first():
            continue
        if pdf.read_bytes()[:5] != b"%PDF-":
            continue
        folder = UPLOAD_DIR / "guidelines"
        folder.mkdir(parents=True, exist_ok=True)
        stored = folder / f"ref-{entry['id']}.pdf"
        stored.write_bytes(pdf.read_bytes())
        source = models.GuidelineSource(
            title=entry["title"], issuing_organization=entry["issuer"], source_url=entry["source_url"], version=entry["version_note"][:240],
            publication_date=entry.get("publication_date"), category=entry["category"], document_type="Clinical Practice Guideline",
            jurisdiction=entry["jurisdiction"], filename=pdf.name, file_path=str(stored), uploaded_by_user_id=doctor.id,
            uploaded_by_role="doctor", is_demo_content=False, status="PROCESSING")
        db.add(source)
        db.flush()
        ingest_source(db, source, stored)
        source.status = "AWAITING_REVIEW"
        _audit(db, "guideline_source_added", f"Reference document indexed: {source.title}",
               f"{len(source.chunks)} passage(s) extracted from the publisher's PDF ({entry['rights']}). Awaiting a doctor's review.")
        indexed += 1
    if indexed:
        print(f"Indexed {indexed} reference document(s) for passage search (awaiting a doctor's review).")


def sync_reference_library(db):
    """Idempotent. Safe to run on every start."""
    remove_synthetic_sources(db)
    remove_placeholders(db)
    doctor = db.query(models.User).filter(models.User.role == "doctor").order_by(models.User.created_at).first()
    if doctor:
        add_library_entries(db, doctor)
        index_downloaded_documents(db, doctor)
    db.commit()
