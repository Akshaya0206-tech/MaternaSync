"""A patient's workspace, for her doctor: the audit trail (who did what, for ONE patient, read-only, filtered and paged), the visit-change requests
waiting at the top of the brief, and the "login off" marker on names of care-team accounts that can no longer sign in. Same isolated synthetic
database as the other tests; every test puts back what it adds."""
import re
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import audit_trail, config, models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

ROOT = Path(__file__).resolve().parents[2]


def naive(moment):
    return moment.astimezone(timezone.utc).replace(tzinfo=None)


class WorkspaceTests(Base):
    def setUp(self):
        self.added = []

    def tearDown(self):
        with SessionLocal() as db:
            for model, ident in self.added:
                item = db.get(model, ident)
                if item is not None:
                    db.delete(item)
            db.commit()

    def trail(self, as_user="doctor", episode=None, expected=200, **params):
        episode = episode or self.ep
        result = self.client.get(f"/api/v2/doctor/episodes/{episode}/audit-trail", headers=self.headers[as_user], params=params)
        self.assertEqual(result.status_code, expected, f"{as_user}: {result.text}")
        return result.json()

    def log(self, action, *, episode=None, role="doctor", name="Dr. Test", when=None, title=None, details="", object_type=None, object_id=None, before=None, after=None, user_id=None):
        with SessionLocal() as db:
            row = models.AuditLog(episode_id=episode or self.ep, actor_user_id=user_id, actor_role=role, actor_display_name=name, action=action,
                                  title=title or action.replace("_", " ").capitalize(), details=details, object_type=object_type, object_id=object_id,
                                  previous_state=before, new_state=after, timestamp=when or naive(datetime.now(timezone.utc)))
            db.add(row)
            db.commit()
            self.added.append((models.AuditLog, row.id))
            return row.id

    # ---------------------------------------------------------------- who may read it
    def test_only_the_doctor_assigned_to_the_patient_can_read_the_trail(self):
        self.trail("doctor")
        self.trail("other_doctor", expected=403)
        self.trail("patient", expected=403)  # even her own trail: it is the clinic's record of what was done
        self.trail("ravi", expected=403)
        self.trail("staff", expected=403)
        refused = self.client.get(f"/api/v2/doctor/episodes/{self.ep}/audit-trail")
        self.assertIn(refused.status_code, (401, 403))

    def test_the_trail_never_holds_another_patients_rows(self):
        mine = self.log("patient_log_recorded", role="patient", name="Sarah")
        theirs = self.log("patient_log_recorded", episode=self.elena_ep, role="patient", name="Elena")
        ids = {item["id"] for item in self.trail(limit=100)["items"]}
        self.assertIn(mine, ids)
        self.assertNotIn(theirs, ids)
        with SessionLocal() as db:
            for item_id in ids:
                self.assertEqual(db.get(models.AuditLog, item_id).episode_id, self.ep)

    def test_a_row_without_a_patient_is_never_shown(self):
        with SessionLocal() as db:
            row = models.AuditLog(episode_id=None, actor_role="doctor", actor_display_name="Dr. Test", action="clinic_contact_changed", title="x")
            db.add(row)
            db.commit()
            self.added.append((models.AuditLog, row.id))
            row_id = row.id
        self.assertNotIn(row_id, {item["id"] for item in self.trail(limit=100)["items"]})

    # ---------------------------------------------------------------- what a row says
    def test_a_row_says_who_what_and_about_what(self):
        with SessionLocal() as db:
            document = db.query(models.MedicalDocument).filter_by(episode_id=self.ep).first()
            document_id, expected = document.id, document.description or document.filename
        row_id = self.log("document_verified", role="doctor", name="Dr. Eleanor Vance", object_type="MedicalDocument", object_id=document_id, details="Checked against the report.")
        item = next(i for i in self.trail(limit=100)["items"] if i["id"] == row_id)
        self.assertEqual((item["who"], item["whoName"], item["whoRole"], item["kind"], item["action"]), ("doctor", "Dr. Eleanor Vance", "doctor", "documents", "document_verified"))
        self.assertEqual((item["objectType"], item["objectLabel"]), ("MedicalDocument", expected[:80]))
        self.assertEqual(item["details"], "Checked against the report.")
        self.assertTrue(item["at"].endswith("Z"))

    def test_what_changed_is_compact_and_never_holds_a_secret(self):
        row_id = self.log("caregiver_permissions_changed", role="patient", name="Sarah",
                          before={"permissions": {"a": 1}, "password_hash": "x" * 30, "code_hash": "secret", "invite_token": "t", "status": "ACTIVE", "note": "a" * 400},
                          after={"permissions": {"a": 2}, "password_hash": "y" * 30, "code_hash": "other", "invite_token": "u", "status": "REVOKED", "note": "b" * 400})
        item = next(i for i in self.trail(limit=100)["items"] if i["id"] == row_id)
        fields = {c["field"]: c for c in item["changes"]}
        self.assertEqual(set(fields), {"status", "note"})  # nested values and secret-looking keys are left out
        self.assertLessEqual(len(fields["note"]["before"]), 80)
        self.assertNotIn("secret", str(item))

    def test_long_details_are_cut(self):
        row_id = self.log("question_logged", role="doctor", details="x" * 900)
        item = next(i for i in self.trail(limit=100)["items"] if i["id"] == row_id)
        self.assertEqual(len(item["details"]), 500)

    # ---------------------------------------------------------------- filters, order and pages
    def test_filter_by_who(self):
        patient = self.log("patient_log_recorded", role="patient", name="Sarah")
        trusted = self.log("caregiver_checkin_recorded", role="caregiver", name="Ravi")
        assistant = self.log("assistant_verify_document", role="ai_coordinator", name="MaternaSync care assistant")
        system = self.log("document_uploaded", role=None, name="System")
        other = self.log("task_created", role="care_team", name="Brenda")
        wanted = {"patient": {patient}, "trusted_person": {trusted}, "assistant": {assistant, system}, "other": {other}}
        for who, ids in wanted.items():
            got = {i["id"] for i in self.trail(who=who, limit=100)["items"]}
            self.assertTrue(ids <= got, who)
            self.assertTrue(all(i["who"] == who for i in self.trail(who=who, limit=100)["items"]), who)
        self.assertTrue(all(i["who"] == "doctor" for i in self.trail(who="doctor", limit=100)["items"]))

    def test_filter_by_kind_including_other_and_the_assistants_own_tools(self):
        checkin = self.log("patient_log_corrected", role="patient")
        consent = self.log("sharing_consent_granted", role="patient")
        approved = self.log("draft_approved", role="doctor")
        account = self.log("password_changed", role="patient")
        assistant_visit = self.log("assistant_confirm_appointment", role="ai_coordinator")
        unmapped = self.log("a_brand_new_action_nobody_listed", role="doctor")
        for kind, expected in {"checkins": checkin, "consents": consent, "approved": approved, "account": account, "visits": assistant_visit, "other": unmapped}.items():
            items = self.trail(kind=kind, limit=100)["items"]
            self.assertIn(expected, {i["id"] for i in items}, kind)
            self.assertTrue(all(i["kind"] == kind for i in items), kind)
        self.assertNotIn(checkin, {i["id"] for i in self.trail(kind="documents", limit=100)["items"]})

    def test_page_views_are_hidden_until_asked_for(self):
        view = self.log("continuity_viewed", role="doctor")
        self.assertNotIn(view, {i["id"] for i in self.trail(limit=100)["items"]})
        self.assertIn(view, {i["id"] for i in self.trail(limit=100, include_views=True)["items"]})

    def test_reading_the_trail_leaves_no_row_but_exporting_it_does(self):
        with SessionLocal() as db:
            before = db.query(models.AuditLog).filter_by(episode_id=self.ep).count()
        self.trail()
        self.trail(kind="documents")
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AuditLog).filter_by(episode_id=self.ep).count(), before)  # opening it is not logged
        self.call("POST", f"/api/v2/doctor/episodes/{self.ep}/audit-trail/export", "doctor", {"kind": "csv", "count": 12, "filters": {"who": "patient", "from": "2026-10-01"}})
        with SessionLocal() as db:
            rows = db.query(models.AuditLog).filter_by(episode_id=self.ep, action="audit_trail_exported").all()
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0].actor_role, "doctor")
            self.assertIn('"rows": 12', rows[0].details)
            self.assertIn('"who": "patient"', rows[0].details)
            for row in rows:
                self.added.append((models.AuditLog, row.id))
        self.call("POST", f"/api/v2/doctor/episodes/{self.ep}/audit-trail/export", "other_doctor", {"kind": "csv", "count": 1}, expected=403)
        self.call("POST", f"/api/v2/doctor/episodes/{self.ep}/audit-trail/export", "patient", {"kind": "csv", "count": 1}, expected=403)
        self.call("POST", f"/api/v2/doctor/episodes/{self.ep}/audit-trail/export", "doctor", {"kind": "xml", "count": 1}, expected=422)

    def ids_in(self, **params):
        """Every row id the trail returns for these filters, page by page (a full test run puts well over a page of rows on one day)."""
        found, offset = set(), 0
        while True:
            page = self.trail(limit=100, offset=offset, **params)
            found |= {i["id"] for i in page["items"]}
            if not page["hasMore"]:
                return found
            offset += 100

    def test_date_range_follows_the_doctors_own_clock(self):
        ist = -330
        local_now = datetime.now(timezone.utc) + timedelta(minutes=330)
        midnight = datetime(local_now.year, local_now.month, local_now.day) - timedelta(minutes=330)  # start of her day, in UTC
        today = local_now.strftime("%Y-%m-%d")
        yesterday = (local_now - timedelta(days=1)).strftime("%Y-%m-%d")
        just_after = self.log("patient_log_recorded", role="patient", when=midnight + timedelta(seconds=1))
        just_before = self.log("patient_log_recorded", role="patient", when=midnight - timedelta(seconds=1))
        only_today = self.ids_in(date_from=today, date_to=today, tz_offset=ist)
        self.assertIn(just_after, only_today)
        self.assertNotIn(just_before, only_today)
        only_yesterday = self.ids_in(date_from=yesterday, date_to=yesterday, tz_offset=ist)
        self.assertIn(just_before, only_yesterday)
        self.assertNotIn(just_after, only_yesterday)
        self.trail(expected=422, date_from="not-a-date")

    def test_newest_first_and_in_pages(self):
        base = naive(datetime.now(timezone.utc)) - timedelta(days=400)
        made = [self.log("patient_log_recorded", role="patient", when=base + timedelta(minutes=i)) for i in range(30)]
        first = self.trail(date_from=(base.date()).isoformat(), date_to=(base.date() + timedelta(days=1)).isoformat(), limit=10)
        self.assertEqual((first["total"], first["limit"], first["offset"], first["hasMore"]), (30, 10, 0, True))
        self.assertEqual([i["id"] for i in first["items"]], made[::-1][:10])  # newest first
        last = self.trail(date_from=(base.date()).isoformat(), date_to=(base.date() + timedelta(days=1)).isoformat(), limit=10, offset=20)
        self.assertEqual(([i["id"] for i in last["items"]], last["hasMore"]), (made[::-1][20:], False))
        self.trail(expected=422, limit=101)

    # ---------------------------------------------------------------- the names of switched-off accounts
    def test_a_care_team_account_with_its_login_off_is_marked(self):
        row_id = self.log("task_created", role="care_team", name="Brenda Miller")
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            item = next(i for i in self.trail(limit=100)["items"] if i["id"] == row_id)
            self.assertTrue(item["loginOff"])
        with patch.object(config, "CARE_TEAM_ENABLED", True):
            item = next(i for i in self.trail(limit=100)["items"] if i["id"] == row_id)
            self.assertFalse(item["loginOff"])
        doctor_row = self.log("task_created", role="doctor", name="Dr. Eleanor Vance")
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            self.assertFalse(next(i for i in self.trail(limit=100)["items"] if i["id"] == doctor_row)["loginOff"])

    def test_tasks_and_history_say_when_the_owner_cannot_sign_in(self):
        with SessionLocal() as db:
            brenda = db.query(models.User).filter_by(email="brenda.miller@maternasync.app").first()
            task = models.Task(episode_id=self.ep, title="A task Brenda holds", owner_user_id=brenda.id, created_by_user_id=self.doctor_id, status="OPEN", priority="routine")
            db.add(task)
            db.flush()
            db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=brenda.id, assigned_by_user_id=self.doctor_id))
            db.commit()
            task_id = task.id
            self.added.append((models.Task, task_id))
        brief_url = f"/api/v2/doctor/episodes/{self.ep}/todays-brief"
        tasks_url = f"/api/v2/continuity/episodes/{self.ep}/tasks"
        with patch.object(config, "CARE_TEAM_ENABLED", False):
            brief = self.client.get(brief_url, headers=self.headers["doctor"]).json()
            listed = next(t for t in brief["pendingItems"] if t["id"] == task_id)
            self.assertTrue(listed["ownerLoginOff"])
            self.assertFalse(listed["createdByLoginOff"])
            mine = next(t for t in self.client.get(tasks_url, headers=self.headers["doctor"]).json() if t["id"] == task_id)
            self.assertTrue(mine["ownerLoginOff"])
            self.assertTrue(mine["history"][0]["nameLoginOff"])
            self.assertFalse(mine["history"][0]["byLoginOff"])
        brief = self.client.get(brief_url, headers=self.headers["doctor"]).json()
        self.assertFalse(next(t for t in brief["pendingItems"] if t["id"] == task_id)["ownerLoginOff"])  # with the login on, she is an ordinary owner

    # ---------------------------------------------------------------- visit-change requests at the top of the brief
    def test_open_visit_change_requests_are_listed_until_dealt_with(self):
        url = f"/api/v2/doctor/episodes/{self.ep}/open-visit-changes"
        when = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()
        asked = self.call("POST", f"/api/v2/continuity/episodes/{self.ep}/appointments", "patient", {"scheduledAt": when, "appointmentType": "Check-up", "notes": ""})
        self.added.append((models.Appointment, asked["id"]))
        self.call("PATCH", f"/api/v2/continuity/appointments/{asked['id']}", "doctor", {"status": "scheduled"})
        self.assertEqual(self.call("GET", url, "doctor"), [])
        self.call("POST", f"/api/v2/patient/appointments/{asked['id']}/change-request", "patient",
                  {"kind": "reschedule", "preferredAt": (datetime.now(timezone.utc) + timedelta(days=9)).isoformat(), "note": "Travelling that day"})
        listed = self.call("GET", url, "doctor")
        self.assertEqual(len(listed), 1)
        self.assertEqual((listed[0]["kind"], listed[0]["note"], listed[0]["appointmentId"]), ("reschedule", "Travelling that day", asked["id"]))
        self.assertTrue(listed[0]["title"].startswith("Visit change requested"))
        for who, code in (("other_doctor", 403), ("patient", 403), ("ravi", 403)):
            self.call("GET", url, who, expected=code)
        self.call("PATCH", f"/api/v2/continuity/appointments/{asked['id']}", "doctor", {"status": "cancelled"})
        self.assertEqual(self.call("GET", url, "doctor"), [])  # cancelling the visit closes the request and its task
        with SessionLocal() as db:
            for other in db.query(models.Appointment).filter_by(episode_id=self.ep, appointment_type="Check-up").all():
                if (self.added and (models.Appointment, other.id) not in self.added):
                    self.added.append((models.Appointment, other.id))
            for task in db.query(models.Task).filter(models.Task.episode_id == self.ep, models.Task.title.like("Visit change requested%")).all():
                self.added.append((models.Task, task.id))

    # ---------------------------------------------------------------- the list of actions stays complete
    def test_every_recorded_action_is_filed_under_a_kind_and_has_a_sentence_on_screen(self):
        source = (ROOT / "src" / "roles" / "doctor" / "auditActions.ts").read_text(encoding="utf-8")
        sentences = source.split("export const AUDIT_SENTENCES")[1].split(chr(10) + "};")[0]  # not the assistant's step names below it
        in_sentences = set(re.findall(r"^\s{2}([a-z_]+):\s*tx\(", sentences, re.M))
        self.assertGreater(len(in_sentences), 80)
        for action in audit_trail.KIND_OF:
            if action.startswith("assistant_"):
                continue  # the assistant's steps share two sentences, built from the step's name
            self.assertIn(action, in_sentences, f"{action} has no sentence in auditActions.ts")
        for action in in_sentences:
            self.assertIn(action, audit_trail.KIND_OF, f"{action} has a sentence but no kind")
        names = source.split("export const ASSISTANT_STEP_NAMES")[1].split(chr(10) + "};")[0]
        named = set(re.findall(r"^\s{2}([a-z_]+):\s*tx\(", names, re.M))
        self.assertEqual(named, set(audit_trail.TOOL_KIND), "every step the care assistant can take needs a name in auditActions.ts, and only those")

    def test_no_action_written_for_a_patient_is_missing_from_the_list(self):
        """Every literal action name passed to audit(...) / AuditLog(...) in the backend is either listed or on a short list of actions that are not
        about one patient (the clinic's own settings, the reference shelf, the doctor's own saved replies)."""
        not_about_a_patient = {
            "clinic_contact_changed", "clinic_hospital_added", "clinic_hospital_changed", "clinic_hospital_removed", "reference_file_uploaded", "reference_file_viewed",
            "reference_search", "reply_snippet_added", "reply_snippet_changed", "reply_snippet_deleted", "reply_time_changed", "resource_approved", "resource_drafted",
            "resource_retired", "resource_superseded", "assistant_paused", "assistant_review_all_on", "assistant_scheduling_rules_changed",
            "continuity_demo_seeded", "patient_topic_reviewed", "patient_topic_review_cleared", "guideline_source_approved",
            # the clinic overview export and the doctor's own display name are not about one patient
            "clinic_report_exported", "doctor_shown_name_changed",
        }
        pattern = re.compile(r'\baudit\(\s*db\s*,\s*\w+\s*,\s*"([a-z_]+)"|\baction\s*=\s*"([a-z_]+)"|\b_log\(\s*db\s*,\s*[\w\.]+\s*,\s*\w+\s*,\s*"([a-z_]+)"|\b_record\(\s*db\s*,\s*\w+\s*,\s*\w+\s*,\s*"([a-z_]+)"')
        found = set()
        for path in (ROOT / "backend" / "app").rglob("*.py"):
            for match in pattern.finditer(path.read_text(encoding="utf-8")):
                found.update(g for g in match.groups() if g and g.islower())
        missing = {a for a in found if a not in audit_trail.KIND_OF and a not in not_about_a_patient and not a.startswith("guideline_") and not a.endswith("_failed")}
        self.assertEqual(missing, set(), "these actions are recorded but not listed in backend/app/audit_trail.py")


if __name__ == "__main__":
    unittest.main()
