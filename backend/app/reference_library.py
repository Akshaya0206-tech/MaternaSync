"""The doctor's personal Reference Library: real, publisher-sourced documents only.

Content comes from backend/app/data/reference_library_*.json. Every entry there was checked against the issuing
body's own page (title, date, edition note, link, licence wording). Nothing is invented and no synthetic or
demonstration guideline is created.

The library is a private shelf: no approval, no versions, and nothing here feeds any other part of the app.
  * Every entry carries its citation, official links, a short summary in our own words and the publisher's reuse terms.
  * Documents whose licence allows it also have their PDF kept on this server. `python fetch_reference_documents.py`
    downloads them into backend/reference_documents/ (not committed to git); they are split into passages here so a
    search can return the page that answers the question.
"""
import json
from collections import Counter
from pathlib import Path

from sqlalchemy import func

from . import models, reference_search, semantic_search
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


def move_old_library_entries(db):
    """An earlier version kept references as approvable, versioned resources. They are plain references now.

    The drafts it loaded from the data files are removed (the data files load them again). Anything a doctor added
    themselves is copied across to that doctor's own shelf, and the old record is retired rather than deleted.
    """
    removed = moved = 0
    old = db.query(models.ClinicalResource).filter(models.ClinicalResource.kind == "guideline").all()
    for resource in old:
        if resource.family_id.startswith("ref-"):
            if resource.status == "DRAFT":
                db.query(models.ReferenceAttachment).filter_by(resource_id=resource.id).delete()
                db.delete(resource)
                removed += 1
            elif resource.status != "RETIRED":
                resource.status = "RETIRED"
            continue
        if resource.family_id.startswith("starter-") or resource.status == "RETIRED":
            continue
        key = f"legacy-{resource.id}"
        if db.query(models.ReferenceItem).filter_by(ref_key=key).first():
            continue
        db.add(models.ReferenceItem(
            owner_user_id=resource.created_by_user_id, ref_key=key, title=resource.title, issuer=resource.issuer, topic=resource.topic,
            jurisdiction=resource.jurisdiction, publication_date=resource.publication_date, source_url=resource.source_url,
            summary=resource.content or "", rights_note=resource.rights_note, tags=[]))
        resource.status = "RETIRED"
        moved += 1
    if removed or moved:
        _audit(db, "reference_library_simplified", "Reference Library is now a personal shelf",
               f"{removed} loaded draft(s) removed (reloaded from the data files); {moved} reference(s) added by doctors moved to their own shelf.")
        print(f"Reference Library: {removed} old draft(s) removed, {moved} doctor-added reference(s) moved.")


def remove_review_queue_copies(db):
    """The earlier version also queued each downloaded PDF for approval on the Guidelines page. Untouched copies go."""
    ids = {entry["id"] for entry in load_manifest()}
    removed = 0
    for source in db.query(models.GuidelineSource).filter(models.GuidelineSource.status == "AWAITING_REVIEW").all():
        name = Path(source.file_path).name
        if name.startswith("ref-") and name[4:-4] in ids:
            try:
                Path(source.file_path).unlink(missing_ok=True)
            except OSError:
                pass
            db.delete(source)
            removed += 1
    if removed:
        print(f"Removed {removed} duplicate review-queue copies of library PDFs from the Guidelines page.")


def sync_items(db):
    added = updated = 0
    for entry in load_manifest():
        values = dict(title=entry["title"], issuer=entry["issuer"], topic=entry["topic"], category=entry["category"],
                      jurisdiction=entry["jurisdiction"], publication_date=entry.get("publication_date"), edition_note=entry["version_note"],
                      source_url=entry["source_url"], document_url=entry.get("document_url"), summary=entry["summary"], rights_note=entry["rights"])
        item = db.query(models.ReferenceItem).filter_by(ref_key=entry["id"]).first()
        if not item:
            db.add(models.ReferenceItem(ref_key=entry["id"], owner_user_id=None, tags=[], **values))
            added += 1
        elif any(getattr(item, key) != value for key, value in values.items()):
            for key, value in values.items():
                setattr(item, key, value)
            item.updated_at = now()
            updated += 1
    if added or updated:
        print(f"Reference Library: {added} reference(s) added, {updated} updated from the data files.")
    db.flush()


# A passage is read as a unit, so it should be about a short paragraph. The PDF reader hands over one piece per layout block, and many
# blocks are a list item, a table cell or a caption of a few words ("for the woman and baby."), which makes a poor search result.
TARGET_CHARS = 700
MAX_CHARS = 1400
HEADING_BREAK_CHARS = 300  # a new heading starts a new passage once the one before has this much text
SMALL_PASSAGE_CHARS = 350  # a PDF whose passages average less than this was split the old way and is split again


_DANGLING = ("and", "or", "of", "the", "to", "in", "a", "an", "for", "with", "that", "by", "on", "at", "as", "is", "are")


def _plain(text: str) -> str:
    return text.replace("\u00ad", "").strip()  # soft hyphens are invisible in the PDF and break "pre-eclampsia" into two words for the search


def looks_like_heading(label: str) -> bool:
    """The PDF reader calls any short block that does not end in a full stop a heading, and many are the first words of a sentence that wrapped
    ("gers are held in the vagina below the cervix to prevent inadvertent"). A real heading is short, starts with a capital or a number and
    does not stop mid-phrase."""
    words = label.split()
    return bool(words) and len(label) <= 70 and (label[0].isupper() or label[0].isdigit()) and words[-1].lower().rstrip(",;") not in _DANGLING and not label.endswith("-")


def merge_pieces(pieces: list[dict]) -> list[dict]:
    """Join consecutive pieces of one page into passages of about TARGET_CHARS, in reading order, never past MAX_CHARS. The words are the
    document's own, unchanged; only the cut points move. A piece's "section label" is text that came before it on the page, so it goes back
    in front of it; it stays as the passage's section name only when it really is a heading. A passage never spans two pages, so its page
    number stays exact."""
    merged: list[dict] = []
    current: dict | None = None
    for piece in pieces:
        label, body = _plain(piece.get("section_label") or ""), _plain(piece["text"])
        text = f"{label} {body}".strip() if label else body
        if not text:
            continue
        heading = label if label and looks_like_heading(label) else None
        starts_section = heading is not None and current is not None and len(current["text"]) >= HEADING_BREAK_CHARS
        if current and not starts_section and len(current["text"]) < TARGET_CHARS and len(current["text"]) + 1 + len(text) <= MAX_CHARS:
            current["text"] += " " + text
        else:
            if current:
                merged.append(current)
            current = {"text": text, "section_label": heading}
    if current:
        merged.append(current)
    return merged


def ingest_pdf(db, item, path: Path) -> int:
    """Split a PDF into passages (with page numbers) and store each passage's word counts. Returns the passage count."""
    from . import extraction
    from .routers.clinical_guidelines import _chunk_blocks  # imported here: the router imports models at load time

    db.query(models.ReferenceChunk).filter_by(item_id=item.id).delete()
    pages = extraction.extract_pages(path)
    index = 0
    for number, blocks in enumerate(pages, start=1):
        for piece in merge_pieces(_chunk_blocks(blocks)):
            sequence, counts = reference_search.analyse(piece["text"])
            db.add(models.ReferenceChunk(item_id=item.id, chunk_index=index, page_number=number, section_label=piece["section_label"],
                                         text=piece["text"], term_freq=dict(counts), token_count=len(sequence)))
            index += 1
    item.page_count = len(pages)
    item.file_path = str(path)
    item.updated_at = now()
    db.flush()
    invalidate()
    return index


def index_downloaded_documents(db):
    """Index the PDFs that were downloaded from their publishers (see fetch_reference_documents.py)."""
    indexed = 0
    for entry in load_manifest():
        item = db.query(models.ReferenceItem).filter_by(ref_key=entry["id"]).first()
        pdf = DOCUMENTS_DIR / f"{entry['id']}.pdf"
        if not item or not entry.get("passage_search") or not pdf.exists() or pdf.read_bytes()[:5] != b"%PDF-":
            continue
        if item.file_path != str(pdf):
            item.file_path = str(pdf)
        if db.query(models.ReferenceChunk).filter_by(item_id=item.id).first():
            continue
        ingest_pdf(db, item, pdf)
        indexed += 1
    if indexed:
        print(f"Indexed {indexed} reference PDF(s) for passage search.")


def refresh_small_passages(db):
    """An earlier version kept one passage per layout block, many only a few words long, and moved the first words of a wrapped sentence into
    the "section" label, and left soft hyphens in the words. A PDF stored that way (passages averaging under SMALL_PASSAGE_CHARS, a "section" that
    starts with a lower-case letter, which a real heading never does, or a soft hyphen in a passage) is split again into passages of a short paragraph, from the same pages."""
    stale = {item_id for item_id, label in db.query(models.ReferenceChunk.item_id, models.ReferenceChunk.section_label).filter(models.ReferenceChunk.section_label.isnot(None)).all()
             if label[:1].islower()}
    stale |= {item_id for (item_id,) in db.query(models.ReferenceChunk.item_id).filter(models.ReferenceChunk.text.contains("\u00ad")).distinct().all()}  # soft hyphens
    rows = db.query(models.ReferenceChunk.item_id, func.avg(func.length(models.ReferenceChunk.text))).group_by(models.ReferenceChunk.item_id).all()
    refreshed = 0
    for item_id, average in rows:
        if not (item_id in stale or (average is not None and average < SMALL_PASSAGE_CHARS)):
            continue
        item = db.get(models.ReferenceItem, item_id)
        path = Path(item.file_path) if item and item.file_path else None
        if path and path.is_file() and path.read_bytes()[:5] == b"%PDF-":
            ingest_pdf(db, item, path)
            refreshed += 1
    if refreshed:
        print(f"Split {refreshed} reference PDF(s) again into passages of a short paragraph.")


def sync_reference_library(db):
    """Idempotent. Safe to run on every start."""
    remove_synthetic_sources(db)
    remove_placeholders(db)
    move_old_library_entries(db)
    remove_review_queue_copies(db)
    sync_items(db)
    index_downloaded_documents(db)
    refresh_small_passages(db)
    db.commit()
    invalidate()


# ---------------------------------------------------------------- what a search looks through

_corpus: dict = {"signature": None, "chunks": [], "frequencies": Counter()}


def invalidate():
    _corpus["signature"] = None


def corpus(db):
    """Every PDF passage, kept in memory between searches (a few thousand short passages)."""
    signature = (db.query(func.count(models.ReferenceChunk.id)).scalar(), db.query(func.max(models.ReferenceItem.updated_at)).scalar())
    if _corpus["signature"] != signature:
        chunks = [{"id": c.id, "item_id": c.item_id, "page": c.page_number, "section": c.section_label, "text": c.text, "tf": c.term_freq, "len": c.token_count, "key": semantic_search.text_key(c.text),
                   "boiler": reference_search.looks_like_boilerplate(c.text)}
                  for c in db.query(models.ReferenceChunk).all()]
        frequencies: Counter = Counter()
        for chunk in chunks:
            frequencies.update(chunk["tf"].keys())
        _corpus.update(signature=signature, chunks=chunks, frequencies=frequencies)
    return _corpus


def reference_dir() -> Path:
    folder = UPLOAD_DIR / "references"
    folder.mkdir(parents=True, exist_ok=True)
    return folder
