"""Governed source library. No third-party material is fetched or approved implicitly."""
from datetime import date
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models
from ..config import UPLOAD_DIR
from ..database import get_db
from ..deps import require_role
from ..continuity_schemas import ResourceIn, ApprovalIn
from ..continuity_service import audit, current_resource, now, resource_out

router = APIRouter(prefix="/api/v2/library", tags=["clinical-library"])
staff = require_role("doctor", "care_team")
doctor = require_role("doctor")


@router.get("")
def search(q: str = Query("", max_length=200), kind: str = "", issuer: str = "", topic: str = "",
           jurisdiction: str = "", status: str = "", published_after: date | None = None,
           user=Depends(staff), db: Session = Depends(get_db)):
    query = db.query(models.ClinicalResource)
    for field, value in (("kind", kind), ("issuer", issuer), ("topic", topic), ("jurisdiction", jurisdiction), ("status", status)):
        if value:
            query = query.filter(getattr(models.ClinicalResource, field) == value)
    if published_after:
        query = query.filter(models.ClinicalResource.publication_date >= published_after.isoformat())
    if q:
        query = query.filter(or_(*[getattr(models.ClinicalResource, f).contains(q, autoescape=True) for f in ("title", "topic", "content", "issuer")]))
    resources = query.order_by(models.ClinicalResource.title, models.ClinicalResource.version.desc()).limit(200).all()
    audit(db, user, "reference_search", details=f"Query: {q}; kind: {kind}; results: {len(resources)}")
    db.commit()
    return [resource_out(db, r) for r in resources]


@router.post("")
def create(payload: ResourceIn, user=Depends(doctor), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"previous_version_id"})
    for key in ("publication_date", "review_due"):
        data[key] = data[key].isoformat() if data[key] else None
    family_id, version = str(uuid.uuid4()), 1
    if payload.previous_version_id:
        previous = db.get(models.ClinicalResource, payload.previous_version_id)
        if not previous or previous.kind != payload.kind:
            raise HTTPException(400, "Previous version must be of the same resource type.")
        family_id = previous.family_id
        latest = db.query(models.ClinicalResource).filter_by(family_id=family_id).order_by(models.ClinicalResource.version.desc()).first()
        if latest.id != previous.id:
            raise HTTPException(409, "Create the next version from the latest version.")
        version = latest.version + 1
    resource = models.ClinicalResource(**data, family_id=family_id, version=version, created_by_user_id=user.id)
    db.add(resource)
    db.flush()
    audit(db, user, "resource_drafted", resource, after=resource_out(db, resource))
    db.commit()
    return resource_out(db, resource)


@router.get("/education")
def education(language: str = "en", stage: str = "all", user=Depends(require_role("patient", "doctor", "care_team")), db: Session = Depends(get_db)):
    resources = db.query(models.ClinicalResource).filter_by(kind="education", status="APPROVED", language=language).all()
    return [resource_out(db, r) for r in resources if current_resource(r) and (stage == "all" or r.stage in (stage, "all"))]


@router.post("/{resource_id}/approve")
def approve(resource_id: str, payload: ApprovalIn, user=Depends(doctor), db: Session = Depends(get_db)):
    resource = db.get(models.ClinicalResource, resource_id)
    if not resource:
        raise HTTPException(404, "Resource not found.")
    if resource.status != "DRAFT":
        raise HTTPException(409, "Only a draft can be approved.")
    if not resource.review_due or resource.review_due <= date.today().isoformat():
        raise HTTPException(400, "A future review date is required; create a revised version.")
    if not resource.issuer or not resource.content.strip():
        raise HTTPException(400, "An owner/issuer and reviewed content are required.")
    if resource.kind != "template" and not resource.source_url:
        raise HTTPException(400, "A source URL is required before approval.")
    if resource.kind == "guideline" and (not resource.rights_note or not resource.section):
        raise HTTPException(400, "Record usage rights and the source section before approval.")
    # Validate configuration again, including resources seeded or imported by earlier releases.
    ResourceIn(**{k: getattr(resource, k) for k in ResourceIn.model_fields if k != "previous_version_id"})
    for old in db.query(models.ClinicalResource).filter_by(family_id=resource.family_id, status="APPROVED").all():
        old.status = "SUPERSEDED"
        audit(db, user, "resource_superseded", old)
    resource.status = "APPROVED"
    resource.approved_by_user_id = user.id
    resource.approved_at = resource.last_checked_at = now()
    audit(db, user, "resource_approved", resource, details="Reviewer confirmed source, applicability and governance review.")
    db.commit()
    return resource_out(db, resource)


@router.post("/{resource_id}/retire")
def retire(resource_id: str, payload: ApprovalIn, user=Depends(doctor), db: Session = Depends(get_db)):
    resource = db.get(models.ClinicalResource, resource_id)
    if not resource:
        raise HTTPException(404, "Resource not found.")
    resource.status = "RETIRED"
    audit(db, user, "resource_retired", resource)
    db.commit()
    return resource_out(db, resource)


@router.post("/{resource_id}/file")
async def upload(resource_id: str, file: UploadFile = File(...), user=Depends(doctor), db: Session = Depends(get_db)):
    resource = db.get(models.ClinicalResource, resource_id)
    if not resource or resource.kind != "guideline":
        raise HTTPException(404, "Guideline not found.")
    if resource.status != "DRAFT":
        raise HTTPException(409, "Create a new version before replacing an approved file.")
    if not resource.rights_note:
        raise HTTPException(400, "Record permission to store the original document first.")
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024 or not data.startswith(b"%PDF"):
        raise HTTPException(400, "Upload a PDF no larger than 15 MB.")
    import fitz
    try:
        with fitz.open(stream=data, filetype="pdf") as pdf:
            if len(pdf) > 300:
                raise ValueError("too many pages")
            pages = []
            for number, page in enumerate(pdf):
                text = page.get_text().strip()
                if not text:
                    # OCR only for scanned pages, and only when local Tesseract is installed.
                    try:
                        text = page.get_text(textpage=page.get_textpage_ocr()).strip()
                    except Exception:
                        text = "[Scanned page: OCR unavailable. A reviewer must enter a permitted excerpt.]"
                pages.append(f"Page {number + 1}\n{text}")
            extracted = "\n\n".join(pages)
            if len(extracted) > 1000000:
                raise ValueError("too much text")
    except Exception:
        raise HTTPException(422, "This PDF could not be parsed; choose an unencrypted PDF of up to 300 pages.")
    stored = f"guideline-{uuid.uuid4().hex}.pdf"
    (UPLOAD_DIR / stored).write_bytes(data)
    resource.file_path = stored
    resource.content = extracted
    audit(db, user, "reference_file_uploaded", resource, details="Original PDF preserved; extracted text requires review.")
    db.commit()
    return resource_out(db, resource)


@router.get("/{resource_id}/file")
def download(resource_id: str, user=Depends(staff), db: Session = Depends(get_db)):
    resource = db.get(models.ClinicalResource, resource_id)
    if not resource or not resource.file_path:
        raise HTTPException(404, "No stored original. Open the official source link.")
    path = UPLOAD_DIR / Path(resource.file_path).name
    if not path.is_file():
        raise HTTPException(404, "Original file is unavailable.")
    audit(db, user, "reference_file_viewed", resource)
    db.commit()
    return FileResponse(path, media_type="application/pdf", filename="guideline.pdf")
