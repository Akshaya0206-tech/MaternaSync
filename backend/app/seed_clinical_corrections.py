"""Update untouched historical demo wording without rewriting clinical records.

The original seeds are one-time operations. This backfill is restricted to their
known synthetic accounts, source identifiers and episode provenance. SHA-256
fingerprints identify individual old default values; edits by a user, uploaded
files, approvals and workflow state are never replaced. Re-running is a no-op.
New installations already receive the corrected values from the seed JSON.
"""
import hashlib
import json
from pathlib import Path

from sqlalchemy.orm import Session

from . import models
from .seed_data import DEMO_EMAIL, SEED_JSON, _parse_dt
from .seed_role_data import ANANYA_GLUCOSE_REPORT


FINGERPRINTS = json.loads((Path(__file__).parent / "data" / "demo_clinical_v1_fingerprints.json").read_text(encoding="utf-8"))
RECORD_FIELDS = {"title": "title", "summaryText": "summary_text", "fullContent": "full_content",
                 "rawPayloadSnippet": "raw_payload_snippet", "tags": "tags"}


def _fingerprint(value) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _replace(row, field, old_fingerprint, value) -> int:
    if row is None or old_fingerprint is None:
        return 0
    current = getattr(row, field)
    if current != value and _fingerprint(current) == old_fingerprint:
        setattr(row, field, value)
        return 1
    return 0


def _seeded_episodes(db: Session, email: str, mrn: str):
    """A matching login alone must not allow changes to another pregnancy."""
    return (db.query(models.PregnancyEpisode)
            .join(models.User, models.User.id == models.PregnancyEpisode.patient_user_id)
            .filter(models.User.email == email, models.PregnancyEpisode.mrn == mrn)
            .filter(db.query(models.AuditLog.id).filter(
                models.AuditLog.episode_id == models.PregnancyEpisode.id,
                models.AuditLog.object_id == models.PregnancyEpisode.id,
                models.AuditLog.object_type == "PregnancyEpisode",
                models.AuditLog.action == "episode_seeded",
            ).exists()).all())


def _patch_sarah_role_data(db: Session, seed: dict) -> int:
    changed = 0
    records = {record["id"]: record for record in seed["records"]}
    workflows = {item["id"]: item for item in seed["workflowItems"]}
    for episode in _seeded_episodes(db, FINGERPRINTS["patientEmail"], FINGERPRINTS["mrn"]):
        changed += _replace(episode, "risk_notes", FINGERPRINTS["riskNotes"], seed["riskNotes"])
        for record_id, original in FINGERPRINTS["records"].items():
            new, hashes = records[record_id], original["fields"]
            docs = db.query(models.MedicalDocument).filter_by(
                episode_id=episode.id, uploaded_by_user_id=episode.patient_user_id,
                filename=original["sourceId"], file_path="",
                document_date=original["timestamp"][:10],
                uploaded_at=_parse_dt(original["timestamp"]),
            ).all()
            for doc in docs:
                changed += _replace(doc, "description", hashes.get("title"), new["title"])
                extraction = doc.extraction
                changed += _replace(extraction, "record_type", hashes.get("title"), new["title"])
                changed += _replace(extraction, "raw_text", hashes.get("fullContent"), new["fullContent"])
                # The structured extraction's value mirrors its title; keep the status intact.
                if extraction and "title" in hashes:
                    status = extraction.field_status or {}
                    field = status.get("recordType")
                    if isinstance(field, dict) and _fingerprint(field.get("value")) == hashes["title"]:
                        extraction.field_status = {**status, "recordType": {**field, "value": new["title"]}}
                        changed += 1
                for event in db.query(models.JourneyEvent).filter_by(
                    episode_id=episode.id, event_type="document", source_document_id=doc.id,
                    source_consultation_id=None, event_date=original["timestamp"][:10],
                ).all():
                    changed += _replace(event, "title", hashes.get("title"), new["title"])
                    changed += _replace(event, "summary", hashes.get("summaryText"), new["summaryText"])
        for item_id, original in FINGERPRINTS["workflowItems"].items():
            if original.get("type") != "pending_referral":
                continue
            new = workflows[item_id]
            for referral in db.query(models.Referral).filter_by(
                episode_id=episode.id, created_at=_parse_dt(original["dateCreated"]),
                referred_to=new.get("assignee"),
            ).all():
                for field in ("title", "description"):
                    changed += _replace(referral, field, original["fields"].get(field), new[field])
    return changed


def _patch_legacy(db: Session, seed: dict) -> int:
    patient = (db.query(models.Patient).join(models.User, models.User.id == models.Patient.owner_user_id)
               .filter(models.User.email == DEMO_EMAIL, models.Patient.id == FINGERPRINTS["episodeId"],
                       models.Patient.mrn == FINGERPRINTS["mrn"]).first())
    if patient is None:
        return 0
    changed = _replace(patient, "risk_notes", FINGERPRINTS["riskNotes"], seed["riskNotes"])
    for group, model, mapping in (
        ("records", models.Record, RECORD_FIELDS),
        ("workflowItems", models.WorkflowItem, {"title": "title", "description": "description"}),
        ("activityLogs", models.ActivityLog, {"title": "title", "details": "details"}),
    ):
        new_rows = {row["id"]: row for row in seed[group]}
        for row_id, original in FINGERPRINTS[group].items():
            row = db.query(model).filter_by(id=row_id, patient_id=patient.id).first()
            if row is None:
                continue
            if group == "records" and (row.source_id != original["sourceId"] or row.timestamp != original["timestamp"]
                                        or row.document_path or row.document_filename):
                continue
            if group == "workflowItems" and (row.type != original["type"] or row.record_id != original.get("recordId")):
                continue
            if group == "activityLogs" and (row.action != original["action"] or row.record_id != original.get("recordId")):
                continue
            for source, target in mapping.items():
                changed += _replace(row, target, original["fields"].get(source), new_rows[row_id][source])
    return changed


def _patch_ananya(db: Session) -> int:
    changed = 0
    old_hash = "9d5e15f0cc224f86f01ff26cca0b06419d6396c97c45d0a2ccc55b1f79df2536"
    for episode in _seeded_episodes(db, "ananya.kumar@maternasync.app", "MRN-10578"):
        for doc in db.query(models.MedicalDocument).filter_by(
            episode_id=episode.id, uploaded_by_user_id=episode.patient_user_id,
            filename="glucose-tolerance-test-results.pdf", file_path="",
        ).all():
            extraction = doc.extraction
            if extraction and extraction.facility == "Westfield Women's Hospital" and extraction.gestational_age == "30 weeks 0 days":
                changed += _replace(extraction, "raw_text", old_hash, ANANYA_GLUCOSE_REPORT)
    return changed


def ensure_demo_clinical_corrections(db: Session) -> int:
    """Return the number of corrected default fields; do not touch uploaded care records."""
    if not SEED_JSON.exists():
        return 0
    seed = next((ep for ep in json.loads(SEED_JSON.read_text(encoding="utf-8"))
                 if ep["id"] == FINGERPRINTS["episodeId"]), None)
    if seed is None:
        return 0
    changed = _patch_sarah_role_data(db, seed) + _patch_legacy(db, seed) + _patch_ananya(db)
    if changed:
        db.commit()
    return changed
