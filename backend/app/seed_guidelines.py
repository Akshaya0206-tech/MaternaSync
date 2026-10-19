"""Seeds 3 clearly-labeled SYNTHETIC guideline documents so the Clinical
Guidelines search has real, approved content to demonstrate on first run.
Idempotent — checked by fixed title before doing anything, safe to run
every startup. These are not real clinical guidance: every generated PDF
opens with an explicit disclaimer baked into its own text, every seeded
GuidelineSource is flagged is_demo_content=True, and the organizations
("Fictional Perinatal Alliance", "Example Maternal Health Collaborative",
"Sample Obstetric Practice Network") are invented."""

import fitz
from sqlalchemy.orm import Session

from . import models
from .config import UPLOAD_DIR
from .routers.clinical_guidelines import ingest_source

DISCLAIMER = "SYNTHETIC / DEMO CONTENT — NOT REAL CLINICAL GUIDANCE. For demonstration purposes only."


def _place(page: fitz.Page, y: float, text: str, fontsize: float) -> float:
    """Inserts a text block, growing the box until insert_textbox reports
    it fit (its return value is negative when the text didn't fit at the
    given height) — avoids fragile manual line-count estimation."""
    height = fontsize * 2.2
    for _ in range(20):
        rect = fitz.Rect(72, y, 523, y + height)
        rc = page.insert_textbox(rect, text, fontsize=fontsize, fontname="helv")
        if rc > 0:
            return y + height + 16
        height *= 1.4
    raise RuntimeError(f"Guideline seed PDF text did not fit after retries: {text[:40]!r}")


def _build_pdf(path, sections: list[tuple[str, str]]) -> None:
    """sections: list of (heading, body) pairs. The disclaimer is always
    the first block on the page."""
    doc = fitz.open()
    page = doc.new_page()
    y = 72.0
    y = _place(page, y, DISCLAIMER, 10)
    for heading, body in sections:
        if y > 650:
            page = doc.new_page()
            y = 72.0
        y = _place(page, y, heading, 12)
        y = _place(page, y, body, 10)
    doc.save(path)
    doc.close()


DEMO_SOURCES = [
    {
        "title": "Antenatal Screening Protocol",
        "issuing_organization": "Fictional Perinatal Alliance (FPA)",
        "version": "v2.1",
        "publication_date": "2024-03-01",
        "category": "SCREENING",
        "document_type": "Clinical Practice Guideline",
        "sections": [
            ("Gestational Diabetes Screening",
             "Oral glucose tolerance testing is recommended between 24 and 28 weeks of gestation for "
             "pregnant individuals without pre-existing risk factors identified at booking."),
            ("Early Screening for High-Risk Patients",
             "Screening for gestational diabetes should be considered earlier than 24 weeks in individuals "
             "with prior gestational diabetes, elevated pre-pregnancy BMI, or a first-degree relative with diabetes."),
            ("Repeat Testing",
             "Repeat testing may be indicated where early-pregnancy risk factors are identified but initial "
             "results are within the normal range."),
        ],
    },
    {
        "title": "Hypertensive Disorders of Pregnancy Guidance",
        "issuing_organization": "Example Maternal Health Collaborative (EMHC)",
        "version": "v1.0",
        "publication_date": "2023-11-15",
        "category": "HIGH_RISK",
        "document_type": "Clinical Practice Guideline",
        "sections": [
            ("Blood Pressure Monitoring",
             "Blood pressure should be assessed at every antenatal visit. A reading of 140/90 mmHg or higher "
             "on two occasions should prompt further evaluation for a hypertensive disorder of pregnancy."),
            ("Preeclampsia Risk Factors",
             "Risk factors for preeclampsia include a first pregnancy, a prior history of preeclampsia, "
             "chronic hypertension, and pregnancies conceived through assisted reproduction."),
            ("Gestational Diabetes Screening Timing",
             "Screening for gestational diabetes should be considered earlier than 24 weeks in individuals "
             "with prior gestational diabetes or elevated pre-pregnancy BMI."),
        ],
    },
    {
        "title": "Postpartum Care Pathway",
        "issuing_organization": "Sample Obstetric Practice Network (SOPN)",
        "version": "2025 edition",
        "publication_date": "2025-01-10",
        "category": "POSTPARTUM",
        "document_type": "Protocol",
        "sections": [
            ("Postpartum Follow-up Visit Timing",
             "A comprehensive postpartum visit should occur within three weeks for patients with hypertensive "
             "disorders of pregnancy, and no later than twelve weeks for all other patients."),
            ("Infant Feeding Support",
             "Patients should be offered lactation support resources regardless of feeding method chosen, "
             "with follow-up contact within the first week after discharge."),
            ("Mental Health Screening",
             "Postpartum depression screening should be completed at the postpartum visit using a validated "
             "screening tool."),
        ],
    },
]


def ensure_demo_guideline_sources(db: Session) -> None:
    uploader = db.query(models.User).filter(models.User.email == "demo@maternasync.app").first()
    if uploader is None:
        return  # role-based seed hasn't run yet; this will retry next startup

    guideline_dir = UPLOAD_DIR / "guidelines"
    guideline_dir.mkdir(exist_ok=True)

    created_any = False
    for spec in DEMO_SOURCES:
        if db.query(models.GuidelineSource).filter(models.GuidelineSource.title == spec["title"]).first():
            continue

        stored_name = f"demo-{spec['title'].lower().replace(' ', '-')}.pdf"
        dest_path = guideline_dir / stored_name
        _build_pdf(dest_path, spec["sections"])

        source = models.GuidelineSource(
            title=spec["title"], issuing_organization=spec["issuing_organization"],
            source_url=None, version=spec["version"], publication_date=spec["publication_date"],
            category=spec["category"], document_type=spec["document_type"], jurisdiction=None,
            filename=stored_name, file_path=str(dest_path),
            uploaded_by_user_id=uploader.id, uploaded_by_role="doctor",
            is_demo_content=True, status="PROCESSING",
        )
        db.add(source)
        db.flush()

        ingest_source(db, source, dest_path)
        source.status = "APPROVED"
        db.add(models.GuidelineReview(
            source_id=source.id, reviewer_user_id=None, reviewer_role="system_seed",
            action="APPROVE", notes="Auto-approved synthetic demo content on seed.",
        ))
        db.add(models.AuditLog(
            episode_id=None, actor_user_id=None, actor_role=None, actor_display_name="System",
            action="guideline_source_seeded", title=f"Seeded demo guideline source \"{source.title}\"",
            details=f"{len(source.chunks)} passage(s) extracted and auto-approved.",
            object_type="GuidelineSource", object_id=source.id,
        ))
        created_any = True

    if created_any:
        db.commit()
        print("Seeded synthetic demo guideline sources for Clinical Guidelines search.")
