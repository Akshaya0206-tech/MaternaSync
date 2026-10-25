"""The doctor's personal Reference Library: search it in plain words, add to it, keep notes on it.

Doctor-only and deliberately standalone: nothing here is approved, versioned, attached to a patient or note, or used
by any other feature. References that come with the app are the same for every doctor and read-only; a doctor can add
their own, and keep private notes on any of them.
"""
import re
import uuid
from collections import Counter
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, reference_library, reference_search as search, semantic_search
from ..continuity_schemas import Input
from ..continuity_service import now
from ..database import get_db
from ..deps import require_role

router = APIRouter(prefix="/api/v2/references", tags=["reference-library"])
doctor = require_role("doctor")

MAX_PDF_BYTES = 25 * 1024 * 1024
MAX_PDF_PAGES = 400
_DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")


class ReferenceIn(Input):
    title: str = Field(min_length=3, max_length=300)
    issuer: str | None = Field(None, max_length=200)
    topic: str | None = Field(None, max_length=120)
    category: str | None = Field(None, max_length=60)
    jurisdiction: str | None = Field(None, max_length=120)
    publication_date: str | None = Field(None, max_length=10)
    source_url: str | None = Field(None, max_length=1000)
    summary: str = Field("", max_length=20000)
    notes: str = Field("", max_length=20000)
    tags: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("publication_date")
    @classmethod
    def partial_date(cls, value):
        if value and not _DATE.match(value):
            raise ValueError("Use a year, a year and month (2025-12) or a full date.")
        return value or None

    @field_validator("source_url")
    @classmethod
    def web_address(cls, value):
        if value and not re.match(r"^https?://\S+$", value):
            raise ValueError("A web link must start with http:// or https://.")
        return value or None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value):
        return list(dict.fromkeys(t.strip()[:40] for t in value if t.strip()))


class NoteIn(Input):
    text: str = Field("", max_length=20000)


def _visible(db: Session, user: models.User):
    return db.query(models.ReferenceItem).filter(or_(models.ReferenceItem.owner_user_id.is_(None), models.ReferenceItem.owner_user_id == user.id))


def _get_visible(db: Session, user: models.User, item_id: str) -> models.ReferenceItem:
    item = _visible(db, user).filter(models.ReferenceItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Reference not found.")
    return item


def _get_own(db: Session, user: models.User, item_id: str) -> models.ReferenceItem:
    item = _get_visible(db, user, item_id)
    if item.owner_user_id != user.id:
        raise HTTPException(403, "References that come with the app cannot be changed. Add a personal note instead.")
    return item


def _my_notes(db: Session, user: models.User) -> dict[str, str]:
    return {n.item_id: n.text for n in db.query(models.ReferenceNote).filter_by(user_id=user.id).all()}


def _has_pdf(item: models.ReferenceItem) -> bool:
    return bool(item.file_path) and Path(item.file_path).is_file()


def item_out(item: models.ReferenceItem, user: models.User, my_note: str = "", index: dict | None = None, **extra) -> dict:
    return {
        "id": item.id, "title": item.title, "issuer": item.issuer, "topic": item.topic, "category": item.category,
        "jurisdiction": item.jurisdiction, "publicationDate": item.publication_date, "editionNote": item.edition_note,
        "sourceUrl": item.source_url, "documentUrl": item.document_url, "summary": item.summary or "", "notes": item.notes or "",
        "rightsNote": item.rights_note, "tags": item.tags or [], "hasPdf": _has_pdf(item), "pageCount": item.page_count,
        "mine": item.owner_user_id == user.id, "bundled": item.owner_user_id is None, "myNote": my_note,
        "searchTerms": search.search_terms(index)[:12] if index else [], **extra,
    }


def _filtered(db: Session, user: models.User, category, topic, issuer, mine, has_pdf) -> list[models.ReferenceItem]:
    query = _visible(db, user)
    if category:
        query = query.filter(models.ReferenceItem.category == category)
    if topic:
        query = query.filter(models.ReferenceItem.topic == topic)
    if issuer:
        query = query.filter(models.ReferenceItem.issuer == issuer)
    if mine:
        query = query.filter(models.ReferenceItem.owner_user_id == user.id)
    items = query.all()
    return [i for i in items if _has_pdf(i)] if has_pdf else items


@router.get("")
def find(q: str = Query("", max_length=300), category: str = "", topic: str = "", issuer: str = "", mine: bool = False,
         has_pdf: bool = False, user=Depends(doctor), db: Session = Depends(get_db)):
    notes = _my_notes(db, user)
    items = _filtered(db, user, category, topic, issuer, mine, has_pdf)
    if not q.strip():
        items.sort(key=lambda i: (i.title or "").lower())
        return {"query": "", "items": [item_out(i, user, notes.get(i.id, ""), search.index_item(i, notes.get(i.id, ""))) for i in items],
                "passages": [], "interpretation": None, "total": len(items), "semantic": semantic_search.enabled()}

    indexes = {i.id: search.index_item(i, notes.get(i.id, "")) for i in items}
    frequencies: Counter = Counter()
    surfaces: dict[str, str] = {}
    for item in items:
        frequencies.update(set().union(*(indexes[item.id][f] for f in search.FIELD_WEIGHTS)))
        for word in re.findall(r"[A-Za-z][A-Za-z\-']+", f"{item.title} {item.topic or ''}"):
            surfaces.setdefault((search.tokens(word) or [""])[0], word.lower())
    data = reference_library.corpus(db)
    allowed = {i.id for i in items}
    chunks = [c for c in data["chunks"] if c["item_id"] in allowed and not c["boiler"]]  # not the reference lists and licence pages of the PDFs
    vocabulary: Counter = Counter(frequencies)
    vocabulary.update(data["frequencies"])
    plan = search.plan(q, vocabulary, surfaces)
    units = plan["units"]
    normalised_query = " ".join(plan["tokens"])

    ranked = []
    for item in items:
        score, where = search.score_item(units, indexes[item.id], frequencies, len(items), normalised_query)
        if score > 0:
            ranked.append((score, item, where))
    ranked.sort(key=lambda r: (-r[0], (r[1].title or "").lower()))

    by_id = {i.id: i for i in items}
    # A passage from a document that is itself about the subject is worth more than one that merely mentions it.
    best = ranked[0][0] if ranked else 1.0
    boost = {item.id: 1 + 0.6 * score / best for score, item, _ in ranked}
    boosted = sorted(((c, s * boost.get(c["item_id"], 1.0), m) for c, s, m in search.passage_scores(units, chunks)), key=lambda r: r[1], reverse=True)

    # Looking by meaning as well, when the model is installed: the same references and passages, found by what they say and not by the
    # words typed, so a question in Hindi, Tamil or Telugu reaches the English text. The two searches are merged by rank. Nothing is
    # generated: a hit is still the document's own sentence and page, and every hit says whether it was found by words, meaning or both.
    meaning = semantic_search.enabled()
    ordered_items = [(item, list(where), "words") for _, item, where in ranked]
    ordered_passages = [(chunk, matched, "words") for chunk, _, matched in boosted[:40]]
    if meaning:
        item_names = {semantic_search.text_key(semantic_search.item_text(i)): i for i in items}
        found_items = semantic_search.rank(q, item_names, semantic_search.ITEM_FLOOR, limit=10, lazy={name: semantic_search.item_text(i) for name, i in item_names.items()})
        where_by_item = {item.id: list(where) for _, item, where in ranked}
        ordered_items = [(by_id[iid], where_by_item.get(iid, []) + ([] if source == "words" else ["meaning"]), source)
                         for iid, _, source in semantic_search.fuse([item.id for _, item, _ in ranked], [item_names[name].id for name, _ in found_items])]
        by_chunk, by_name = {c["id"]: c for c in chunks}, {}
        for c in chunks:
            by_name.setdefault(c["key"], c)
        found_passages = semantic_search.rank(q, [c["key"] for c in chunks if len(c["text"]) >= semantic_search.MIN_PASSAGE_CHARS], semantic_search.PASSAGE_FLOOR, limit=24)
        if not semantic_search.confident(found_items, found_passages):  # nothing in the library clearly answers it: do not show the nearest passages
            found_passages = []
        matched_words = {c["id"]: m for c, _, m in boosted}
        ordered_passages = [(by_chunk[cid], matched_words.get(cid, set()), source)
                            for cid, _, source in semantic_search.fuse([c["id"] for c, _, _ in boosted[:40]], [by_name[name]["id"] for name, _ in found_passages])]
    word_score = {c["id"]: s for c, s, _ in boosted}

    passages, per_item = [], Counter()
    for chunk, matched, source in ordered_passages[:40]:
        if per_item[chunk["item_id"]] >= 2 or len(passages) >= 8:
            continue
        per_item[chunk["item_id"]] += 1
        if source == "meaning":  # no matching words to centre the extract on: show the sentence closest in meaning to the question
            text, marks = semantic_search.best_extract(q, chunk["text"]), []
        else:
            text, marks = search.snippet(chunk["text"], matched)
        item = by_id[chunk["item_id"]]
        passages.append({"itemId": item.id, "title": item.title, "issuer": item.issuer, "page": chunk["page"], "section": chunk["section"],
                         "text": text, "marks": marks, "score": round(word_score.get(chunk["id"], 0.0), 2), "matchedBy": source})

    out = [item_out(i, user, notes.get(i.id, ""), indexes[i.id], matchedOn=where, foundInPdf=False, matchedBy=source) for i, where, source in ordered_items]
    listed = {o["id"] for o in out}
    out += [item_out(by_id[iid], user, notes.get(iid, ""), indexes[iid], matchedOn=["pdf"], foundInPdf=True) for iid in dict.fromkeys(p["itemId"] for p in passages) if iid not in listed]
    return {"query": q, "items": out, "passages": passages, "total": len(out), "semantic": meaning,
            "interpretation": {"corrections": plan["corrections"], "alsoSearched": plan["also"], "words": [u.label for u in units]}}


@router.post("")
def add(payload: ReferenceIn, user=Depends(doctor), db: Session = Depends(get_db)):
    item = models.ReferenceItem(owner_user_id=user.id, **payload.model_dump())
    db.add(item)
    db.commit()
    return item_out(item, user, index=search.index_item(item))


@router.put("/{item_id}")
def change(item_id: str, payload: ReferenceIn, user=Depends(doctor), db: Session = Depends(get_db)):
    item = _get_own(db, user, item_id)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.updated_at = now()
    db.commit()
    return item_out(item, user, _my_notes(db, user).get(item.id, ""), search.index_item(item))


@router.delete("/{item_id}")
def remove(item_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    item = _get_own(db, user, item_id)
    _drop_file(item)
    db.delete(item)
    db.commit()
    reference_library.invalidate()
    return {"deleted": item_id}


def _drop_file(item: models.ReferenceItem) -> None:
    """Remove a PDF this doctor uploaded. A PDF that came with the app is never touched."""
    if item.file_path and Path(item.file_path).parent == reference_library.reference_dir():
        Path(item.file_path).unlink(missing_ok=True)
    db_chunks = item.chunks
    for chunk in list(db_chunks):
        db_chunks.remove(chunk)
    item.file_path, item.page_count = None, None


@router.post("/{item_id}/file")
async def attach_pdf(item_id: str, file: UploadFile = File(...), user=Depends(doctor), db: Session = Depends(get_db)):
    item = _get_own(db, user, item_id)
    data = await file.read(MAX_PDF_BYTES + 1)
    if not data or len(data) > MAX_PDF_BYTES or not data.startswith(b"%PDF"):
        raise HTTPException(400, "Choose a PDF of up to 25 MB.")
    target = reference_library.reference_dir() / f"{uuid.uuid4().hex}.pdf"
    target.write_bytes(data)
    try:
        import fitz

        with fitz.open(target) as pdf:
            if len(pdf) > MAX_PDF_PAGES:
                raise ValueError("too many pages")
        _drop_file(item)
        passages = reference_library.ingest_pdf(db, item, target)
    except Exception:
        target.unlink(missing_ok=True)
        db.rollback()
        raise HTTPException(422, f"This PDF could not be read. Use an unprotected PDF of up to {MAX_PDF_PAGES} pages.")
    db.commit()
    reference_library.invalidate()
    # passages == 0 means no text could be read (for example a scanned PDF); the page tells the doctor.
    return item_out(item, user, _my_notes(db, user).get(item.id, ""), search.index_item(item), passages=passages)


@router.delete("/{item_id}/file")
def detach_pdf(item_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    item = _get_own(db, user, item_id)
    _drop_file(item)
    db.commit()
    reference_library.invalidate()
    return item_out(item, user, _my_notes(db, user).get(item.id, ""), search.index_item(item))


@router.get("/{item_id}/file")
def open_pdf(item_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    item = _get_visible(db, user, item_id)
    if not _has_pdf(item):
        raise HTTPException(404, "No PDF is kept for this reference. Open the publisher's link instead.")
    return FileResponse(item.file_path, media_type="application/pdf", filename=f"{re.sub(r'[^A-Za-z0-9._-]+', '_', item.title)[:80]}.pdf",
                        content_disposition_type="inline")


@router.put("/{item_id}/note")
def write_note(item_id: str, payload: NoteIn, user=Depends(doctor), db: Session = Depends(get_db)):
    item = _get_visible(db, user, item_id)
    note = db.query(models.ReferenceNote).filter_by(user_id=user.id, item_id=item.id).first()
    if not payload.text.strip():
        if note:
            db.delete(note)
    elif note:
        note.text, note.updated_at = payload.text, now()
    else:
        db.add(models.ReferenceNote(user_id=user.id, item_id=item.id, text=payload.text))
    db.commit()
    return {"id": item.id, "myNote": payload.text if payload.text.strip() else ""}
