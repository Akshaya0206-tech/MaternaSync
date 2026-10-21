"""Idempotent synthetic demo entries and unapproved starter resources.

Official links are pointers, not redistributed guidance or claims of currency.
Nothing clinical is pre-approved on behalf of a real clinician.
"""
from datetime import timedelta
from . import models
from .continuity_service import now


def run_seed_continuity(db):
    doctor = db.query(models.User).filter_by(email="demo@maternasync.app").first()
    if not doctor:
        return
    resources = [
        dict(key="fogsi", kind="guideline", title="FOGSI–ICOG Good Clinical Practice Recommendations", issuer="FOGSI–ICOG", topic="Antenatal care", jurisdiction="India",
             source_url="https://www.fogsi.org/fogsi-icog-gcpr/", section="Official collection index",
             content="Official index of FOGSI–ICOG recommendations. Select a specific document, confirm its version and usage permission, and add a permitted passage before approval.", rights_note="Link only; redistribution permission not established."),
        dict(key="icmr", kind="guideline", title="Antenatal Diagnosis and Management — Standard Treatment Workflow", issuer="ICMR", topic="Antenatal care", jurisdiction="India",
             source_url="https://www.icmr.gov.in/icmrobject/uploads/STWs/1771568619_ante-natalmanagementofnormalpregnancy-7.pdf", section="Original workflow PDF",
             content="Official ICMR antenatal workflow. Publication/version and applicability require clinician verification before use.", rights_note="Link only; original material is not bundled."),
        dict(key="who", kind="guideline", title="WHO recommendations on antenatal care for a positive pregnancy experience", issuer="WHO", topic="Antenatal care", jurisdiction="International", publication_date="2016-11-28",
             source_url="https://www.who.int/publications/i/item/9789241549912", section="Publication overview",
             content="WHO reference on routine antenatal care. The 2016 publication may have topic-specific updates; a reviewer must confirm the applicable version.", rights_note="Bibliographic metadata and link only."),
        dict(key="nice", kind="guideline", title="Antenatal care — NG201", issuer="NICE", topic="Antenatal care", jurisdiction="United Kingdom", publication_date="2021-08-19",
             source_url="https://www.nice.org.uk/guidance/ng201", section="Guideline overview",
             content="NICE antenatal care reference, supplementary to local practice. Confirm updates and jurisdictional applicability before approval.", rights_note="Bibliographic metadata and link only."),
    ]
    for title, fields in [
        ("SOAP", ["Subjective", "Objective", "Assessment", "Plan"]),
        ("ANC visit", ["Visit context", "Patient concerns", "Verified findings", "Confirmed plan"]),
        ("Follow-up", ["Since last visit", "Outstanding items", "Confirmed next steps"]),
        ("Handover", ["Context", "What happened", "What remains", "Owner", "What to discuss"]),
    ]:
        resources.append(dict(key="template-" + title, kind="template", title=title, issuer="Clinic template owner", topic="Documentation",
            content="Blank documentation structure. Complete from recorded facts and review before approval.", configuration={"fields": fields, "required": fields, "default": title == "SOAP"}))
    for topic in ("GDM", "Pre-eclampsia", "Anaemia"):
        resources.append(dict(key="pathway-" + topic, kind="pathway", title=f"{topic} — coordination pathway", issuer="Clinical governance review required", topic=topic,
            source_url="https://www.icmr.gov.in/standard-treatment-workflows-stws", section="Local administrative pathway",
            content="Starter administrative workflow only. A clinician must adapt the steps and timing to the documented care plan, approve the version, and confirm enrollment.",
            configuration={"steps": [{"title": "Confirm the documented follow-up plan with the assigned clinician", "days": 0}, {"title": "Contact patient to arrange the clinician-requested follow-up", "days": 1}]}))
    for topic, stage in [("Nutrition", "first"), ("Safe movement", "second"), ("Labour preparation", "third"), ("Birth-plan discussions", "third"), ("Postpartum recovery", "postpartum"), ("Lactation", "postpartum")]:
        resources.append(dict(key="education-" + topic, kind="education", title=f"Preparing to discuss {topic.lower()}", issuer="Clinic education owner", topic=topic, stage=stage,
            source_url="https://www.who.int/publications/i/item/9789241549912", section="Local patient education draft",
            content=f"Use your next visit to discuss {topic.lower()} with your maternity team. Bring your questions and ask the team to write down the instructions that apply to you. This module is a discussion guide and does not change your documented care plan."))
    for item in resources:
        key = "starter-" + item.pop("key")
        if not db.query(models.ClinicalResource).filter_by(family_id=key).first():
            db.add(models.ClinicalResource(**item, family_id=key, version=1, status="DRAFT", review_due=(now().date() + timedelta(days=180)).isoformat(), created_by_user_id=doctor.id))
    # Keep a small reproducible synthetic trend, never modify patient-entered logs.
    ep = db.query(models.PregnancyEpisode).join(models.User, models.User.id == models.PregnancyEpisode.patient_user_id).filter(models.User.email == "sarah.jenkins@maternasync.app").first()
    if ep and not db.query(models.AuditLog).filter_by(action="continuity_demo_seeded", episode_id=ep.id).first():
        for offset, systolic, weight in [(12, 112, 66.0), (8, 116, 66.4), (5, 114, 66.5), (2, 118, 66.8)]:
            db.add(models.DailyLog(episode_id=ep.id, recorded_at=now() - timedelta(days=offset), systolic=systolic, diastolic=74, weight_kg=weight,
                mood="okay", adherence="not_recorded", symptoms="Synthetic demo check-in"))
        db.add(models.AuditLog(episode_id=ep.id, actor_user_id=doctor.id, actor_role="doctor", action="continuity_demo_seeded", title="Synthetic continuity demo data created"))
    db.commit()
