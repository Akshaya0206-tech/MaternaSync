"""Friendly titles and a type for the demo records that came with the app (the ones with no file behind them and no description), so My Records shows
"28-Week Oral Glucose Tolerance Test (OGTT) & CBC" and a "Lab report" label instead of a bare reference like LAB-OGTT-8812. Runs at every start and
only fills in what is empty, so it also tidies a database that was seeded before types existed. It never touches a document someone uploaded."""
from sqlalchemy.orm import Session

from . import models
from .document_types import infer_document_type


def ensure_document_labels(db: Session) -> None:
    changed = 0
    for doc in db.query(models.MedicalDocument).filter(models.MedicalDocument.file_path == "").all():
        title = doc.extraction.record_type if doc.extraction is not None else None
        if not doc.description and title:
            doc.description = title
            changed += 1
        if not doc.document_type:
            doc.document_type = infer_document_type(doc.description or title, doc.filename)
            changed += 1
    if changed:
        db.commit()
        print(f"Gave {changed} demonstration record label(s) a plain title or a type.")
