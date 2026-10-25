"""The care assistant's scheduling, referral, WhatsApp, paperwork, handover and reporting workflows, and the four-language
wording the server writes into Updates. Same isolated synthetic database as the other tests."""
import string
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import config, handover_content, models, server_text
from backend.app.ai_coordinator import controls, orchestrator, policy, reporting, scheduling, tools
from backend.app.database import SessionLocal
from backend.app.referral_communication import ReferralCommunicationService
from backend.app.seed_assistant import ensure_assistant_user

from test_assistant_caregiver import Base

ASSIST = "/api/v2/assistant"
ROOT = "/api/v2/continuity"


def utcnow():
    return datetime.now(timezone.utc)


class WorkflowBase(Base):
    def setUp(self):
        self.created = []  # (table, id) rows this test made, removed afterwards so other test modules see the database as they expect
        self.addCleanup(self.clean_up)
        self.set_language("patient", "en")

    def clean_up(self):
        with SessionLocal() as db:
            for table, row_id in reversed(self.created):
                row = db.get(table, row_id)
                if row is not None:
                    db.delete(row)
            controls.set_scheduling(db, None, {})
            controls.set_flag(db, None, controls.REVIEW_ALL, False)
            db.commit()
        self.set_language("patient", "en")
        self.set_language("doctor", "en")

    def track(self, table, row_id):
        self.created.append((table, row_id))

    def set_language(self, who, language):
        self.call("PATCH", f"{ROOT}/preferences", who, {"language": language})

    def set_rules(self, **over):
        rules = {"days": [0, 1, 2, 3, 4, 5, 6], "start": "00:00", "end": "23:30", "minutes": 30, "noticeHours": 0, "offsetMinutes": 0, "graceHours": 2, **over}
        return self.call("PUT", f"{ASSIST}/scheduling-rules", "doctor", rules)

    def request_visit(self, when):
        row = self.call("POST", f"{ROOT}/episodes/{self.ep}/appointments", "patient", {"scheduledAt": when.isoformat(), "appointmentType": "Antenatal visit"})
        self.track(models.Appointment, row["id"])
        return row["id"]

    def proposals(self, source_id):
        return [i for i in self.items_for(source_id) if i.kind == "proposal"]

    def approve(self, item_id):
        return self.call("POST", f"{ASSIST}/exceptions/{item_id}/decide", "doctor", {"decision": "approve"})

    def action_for(self, tool, **match):
        for row in self.call("GET", f"{ASSIST}/activity?limit=200", "doctor"):
            if row["tool"] == tool and row["status"] in ("DONE", "UNDONE") and all(row.get(k) == v for k, v in match.items()):
                return row
        return None

    def updates(self, who="patient"):
        path = "/api/v2/patient/updates" if who == "patient" else "/api/v2/doctor/updates"
        return self.call("GET", path, who)

    def notes_about(self, entity_id):
        with SessionLocal() as db:
            return [(n.message_key, n.recipient_user_id) for n in db.query(models.Notification).filter_by(related_entity_id=entity_id).all()]

    def far_day(self, days=40, hour=3):
        return (utcnow() + timedelta(days=days)).replace(hour=hour, minute=0, second=0, microsecond=0)


# =============================================================================== scheduling
class SchedulingTests(WorkflowBase):
    def test_a_request_inside_the_rules_becomes_a_confirm_proposal_and_a_doctor_confirms_it(self):
        self.set_rules()
        appt = self.request_visit(self.far_day(40, 10))
        orchestrator.process_queue()
        (item,) = self.proposals(appt)
        self.assertEqual((item.proposed_tool, item.title), ("confirm_appointment", "Confirm a visit"))
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt).status, "requested")  # nothing happens until a doctor decides
        self.approve(item.id)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt).status, "scheduled")
        self.assertIn("Your visit is confirmed", [n["title"] for n in self.updates()])
        self.set_language("patient", "hi")
        self.assertIn("आपकी अपॉइंटमेंट पक्की हो गई", [n["title"] for n in self.updates()])  # the same Update, now in Hindi

    def test_a_request_outside_the_rules_proposes_free_times_and_undo_puts_it_back(self):
        sunday = self.far_day(40, 10)
        while sunday.weekday() != 6:
            sunday += timedelta(days=1)
        self.set_rules(days=[0, 1, 2, 3, 4])  # Monday to Friday
        appt = self.request_visit(sunday)
        orchestrator.process_queue()
        (item,) = self.proposals(appt)
        self.assertEqual(item.proposed_tool, "offer_new_times")
        self.assertIn("does not see patients on that day", item.summary)
        self.assertEqual(len(item.proposed_args["slots"]), 3)
        for slot in item.proposed_args["slots"]:
            self.assertLess(datetime.fromisoformat(slot).weekday(), 5)
        self.approve(item.id)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt).status, "cancelled")
        self.assertIn("Please choose another time", [n["title"] for n in self.updates()])
        action = self.action_for("offer_new_times")
        self.assertTrue(action["undoable"])
        self.call("POST", f"{ASSIST}/actions/{action['id']}/undo", "doctor", {"note": "I will phone her instead"})
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt).status, "requested")

    def test_a_time_that_is_already_booked_is_never_confirmed(self):
        self.set_rules()
        when = self.far_day(45, 11)
        first = self.request_visit(when)
        orchestrator.process_queue()
        self.approve(self.proposals(first)[0].id)
        second = self.request_visit(when)
        orchestrator.process_queue()
        (item,) = self.proposals(second)
        self.assertEqual(item.proposed_tool, "offer_new_times")
        self.assertIn("another visit is already booked", item.summary)

    def test_the_rules_are_checked_by_plain_code_not_by_anything_about_the_patient(self):
        with SessionLocal() as db:
            rules = scheduling.rules(db)
            soon = models.Appointment(episode_id=self.ep, scheduled_at=(utcnow() + timedelta(hours=1)).replace(tzinfo=None), appointment_type="Visit", status="requested")
            self.assertIn("notice", scheduling.problems(db, {**rules, "notice_hours": 24}, soon))
            past = models.Appointment(episode_id=self.ep, scheduled_at=(utcnow() - timedelta(hours=1)).replace(tzinfo=None), appointment_type="Visit", status="requested")
            self.assertEqual(scheduling.problems(db, rules, past), ["past"])

    def test_only_a_doctor_sets_the_rules_and_bad_rules_are_refused(self):
        good = {"days": [0, 1], "start": "09:00", "end": "13:00", "minutes": 30, "noticeHours": 2, "offsetMinutes": 330, "graceHours": 2}
        self.call("PUT", f"{ASSIST}/scheduling-rules", "patient", good, expected=403)
        self.call("GET", f"{ASSIST}/scheduling-rules", "patient", expected=403)
        self.call("PUT", f"{ASSIST}/scheduling-rules", "doctor", {**good, "start": "13:00", "end": "09:00"}, expected=422)
        self.call("PUT", f"{ASSIST}/scheduling-rules", "doctor", {**good, "days": [9]}, expected=422)
        self.call("PUT", f"{ASSIST}/scheduling-rules", "doctor", {**good, "start": "09:00", "end": "09:10", "minutes": 30}, expected=422)
        saved = self.call("PUT", f"{ASSIST}/scheduling-rules", "doctor", good)
        self.assertEqual((saved["days"], saved["start"], saved["weekdays"][0]), ([0, 1], "09:00", "Monday"))
        with SessionLocal() as db:
            self.assertTrue(db.query(models.AuditLog).filter_by(action="assistant_scheduling_rules_changed").count())

    def test_a_past_visit_still_marked_scheduled_is_a_question_for_a_doctor_not_an_automatic_no_show(self):
        with SessionLocal() as db:
            appt = models.Appointment(episode_id=self.ep, scheduled_at=(utcnow() - timedelta(hours=6)).replace(tzinfo=None), appointment_type="Antenatal visit", status="scheduled")
            db.add(appt)
            db.commit()
            appt_id = appt.id
        self.track(models.Appointment, appt_id)
        orchestrator.run_sweeps()
        (item,) = self.proposals(appt_id)
        self.assertEqual((item.proposed_tool, item.title), ("record_missed_visit", "Record a missed visit"))
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt_id).status, "scheduled")
        orchestrator.run_sweeps()
        self.assertEqual(len(self.proposals(appt_id)), 1)  # asked once
        self.approve(item.id)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt_id).status, "no_show")
        self.assertIn("We missed you at your visit", [n["title"] for n in self.updates()])
        action = self.action_for("record_missed_visit")
        self.call("POST", f"{ASSIST}/actions/{action['id']}/undo", "doctor", {"note": "She did come"})
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Appointment, appt_id).status, "scheduled")

    def test_a_confirmed_visit_gets_one_fixed_reminder_for_her_and_the_trusted_person_allowed_to_see_visits(self):
        self.restore_ravi()
        with SessionLocal() as db:
            appt = models.Appointment(episode_id=self.ep, scheduled_at=(utcnow() + timedelta(hours=3)).replace(tzinfo=None), appointment_type="Antenatal visit", status="scheduled")
            db.add(appt)
            db.commit()
            appt_id = appt.id
        self.track(models.Appointment, appt_id)
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        keys = self.notes_about(appt_id)
        self.assertEqual(sorted(keys), sorted([("visit_reminder", self.sarah_id), ("visit_reminder_caregiver", self.ravi_user())]))  # once each, however often the sweep runs
        self.set_language("patient", "ta")
        self.assertIn("சந்திப்பு நினைவூட்டல்", [n["title"] for n in self.updates()])

    def ravi_user(self):
        with SessionLocal() as db:
            return db.get(models.CaregiverLink, self.ravi_link).caregiver_user_id


# =============================================================================== referrals
class ReferralTests(WorkflowBase):
    def new_referral(self, destination="City Specialist Hospital"):
        row = self.call("POST", f"/api/v2/doctor/episodes/{self.ep}/referrals", "doctor",
                        {"episodeId": self.ep, "title": "Specialist review", "description": "Please review.", "destination": destination})
        self.track(models.Referral, row["id"])
        return row["id"]

    def test_a_new_referral_becomes_a_send_proposal_and_a_doctors_approval_sends_it(self):
        referral = self.new_referral()
        orchestrator.process_queue()
        (item,) = self.proposals(referral)
        self.assertEqual((item.proposed_tool, item.title), ("send_referral", "Send a referral"))
        with SessionLocal() as db:
            self.assertEqual(db.get(models.Referral, referral).status, "DRAFT")
        self.approve(item.id)
        with SessionLocal() as db:
            sent = db.get(models.Referral, referral)
            self.assertEqual((sent.status, sent.sent_by_user_id), ("SENT", self.doctor_id))  # sent under the doctor's own name
            self.assertTrue(db.query(models.Communication).filter_by(related_referral_id=referral, type="REFERRAL_OUTBOUND").count())
        self.assertIn("Referral update", [n["title"] for n in self.updates()])
        self.set_language("patient", "te")
        self.assertIn("రిఫరల్ అప్‌డేట్", [n["title"] for n in self.updates()])
        self.assertFalse(self.action_for("send_referral")["undoable"])  # a sent referral cannot be recalled

    def test_a_referral_with_no_destination_is_handed_to_the_doctor_not_proposed(self):
        referral = self.new_referral(destination="")
        orchestrator.process_queue()
        items = self.items_for(referral)
        self.assertEqual([(i.kind, i.title) for i in items], [("attention", "A referral has no destination")])

    def test_an_unanswered_referral_is_chased_twice_then_handed_to_the_doctor(self):
        referral = self.new_referral()
        orchestrator.process_queue()
        self.approve(self.proposals(referral)[0].id)

        def sent_days_ago(days):
            with SessionLocal() as db:
                db.get(models.Referral, referral).sent_at = (utcnow() - timedelta(days=days)).replace(tzinfo=None)
                db.commit()

        sent_days_ago(1)
        orchestrator.run_sweeps()
        self.assertEqual([i for i in self.proposals(referral) if i.proposed_tool == "chase_referral"], [])  # too early
        sent_days_ago(3)
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        (first,) = [i for i in self.proposals(referral) if i.proposed_tool == "chase_referral"]
        self.assertEqual(first.proposed_args["round"], 1)
        self.approve(first.id)
        with SessionLocal() as db:
            reminder = db.query(models.Communication).filter_by(related_referral_id=referral, subject="Reminder 1: referral " + db.get(models.Referral, referral).reference_code).first()
            self.assertIn("nothing is sent to a real hospital", reminder.content)
        action = self.action_for("chase_referral")
        self.call("POST", f"{ASSIST}/actions/{action['id']}/undo", "doctor", {"note": "Too soon"})
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Communication).filter(models.Communication.related_referral_id == referral, models.Communication.subject.like("Reminder%")).count(), 0)
        sent_days_ago(7)
        orchestrator.run_sweeps()
        handed = [i for i in self.items_for(referral) if i.kind == "attention" and i.title == "A referral has had no reply"]
        self.assertEqual(len(handed), 1)

    def test_a_referral_that_has_moved_on_cannot_be_sent_twice(self):
        referral = self.new_referral()
        orchestrator.process_queue()
        item = self.proposals(referral)[0]
        with SessionLocal() as db:
            ReferralCommunicationService(db).send_referral(db.get(models.Referral, referral), db.get(models.User, self.doctor_id))
            db.commit()
        result = self.approve(item.id)
        self.assertIn("already handled", result["message"])
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Communication).filter_by(related_referral_id=referral, type="REFERRAL_OUTBOUND").count(), 1)


# =============================================================================== WhatsApp reminders
class OutreachTests(WorkflowBase):
    def due_reminder(self, phone):
        with SessionLocal() as db:
            appt = db.query(models.Appointment).filter_by(episode_id=self.ep).first()
            if appt is None:
                appt = models.Appointment(episode_id=self.ep, scheduled_at=(utcnow() + timedelta(days=2)).replace(tzinfo=None), appointment_type="Visit", status="scheduled")
                db.add(appt)
                db.commit()
            appt_id = appt.id
        reminder = self.call("POST", f"{ROOT}/episodes/{self.ep}/reminders", "doctor",
                             {"kind": "appointment", "title": "Visit reminder", "sourceId": appt_id, "scheduledAt": (utcnow() - timedelta(minutes=5)).isoformat()})[0]
        self.track(models.CareReminder, reminder["id"])
        consent = self.call("POST", f"{ROOT}/episodes/{self.ep}/consents", "patient", {"recipient": phone, "purpose": "reminders", "expiresAt": (utcnow() + timedelta(days=1)).isoformat()})
        self.track(models.SharingConsent, consent["id"])
        return reminder["id"], consent["id"]

    def outreach_for(self, reminder_id):
        with SessionLocal() as db:
            rows = db.query(models.Outreach).filter_by(source_type="reminder", source_id=reminder_id).all()
            for row in rows:
                self.track(models.Outreach, row.id)
            return [(r.status, r.provider, r.message) for r in rows]

    def test_a_due_reminder_with_her_permission_goes_out_once_in_her_language_with_no_clinical_content(self):
        self.set_language("patient", "hi")
        reminder, _ = self.due_reminder("+917777711101")
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        rows = self.outreach_for(reminder)
        self.assertEqual(rows, [("SENT", "simulator", server_text.outreach_text("reminder", "hi"))])  # once, in Hindi, labelled simulator
        self.assertNotIn("Sarah", rows[0][2])
        action = self.action_for("send_outreach")
        self.assertFalse(action["undoable"])  # a sent message cannot be recalled; the pause and review-every-step switches are the control

    def test_without_her_permission_or_after_she_withdraws_it_nothing_is_sent(self):
        reminder, consent = self.due_reminder("+917777711102")
        self.call("POST", f"{ROOT}/consents/{consent}/revoke", "patient")
        orchestrator.run_sweeps()
        self.assertEqual(self.outreach_for(reminder), [])
        with SessionLocal() as db:  # and the tool itself refuses when called directly with a withdrawn permission
            run = models.AIRun(workflow="outreach", episode_id=self.ep, source_type="CareReminder", source_id=reminder, trigger_key=f"direct:{reminder}", status="DONE")
            db.add(run)
            db.flush()
            action = tools.act(db, run, "send_outreach", {"reminder_id": reminder, "consent_id": consent}, key=f"direct:{reminder}")
            self.assertEqual(action.status, "FAILED")
            self.assertIn("no active permission", action.result)
            db.rollback()

    def test_review_every_step_makes_the_message_wait_for_a_doctor(self):
        self.call("PATCH", f"{ASSIST}/settings", "doctor", {"reviewAll": True})
        reminder, _ = self.due_reminder("+917777711103")
        orchestrator.run_sweeps()
        self.assertEqual(self.outreach_for(reminder), [])
        (item,) = self.proposals(reminder)
        self.assertEqual(item.title, "Send a WhatsApp reminder")
        self.approve(item.id)
        self.assertEqual([r[0] for r in self.outreach_for(reminder)], ["SENT"])

    def test_the_reminder_text_is_the_same_minimal_sign_in_message_in_every_language(self):
        for language in server_text.LANGUAGES:
            text = server_text.outreach_text("reminder", language)
            self.assertTrue(text.startswith("MaternaSync:"))
            self.assertFalse(any(ch.isdigit() for ch in text))


# =============================================================================== paperwork, handover, counts
class DraftAndReportTests(WorkflowBase):
    def approved_consultation(self, text="Discussed the scan and the plan for the next visit with the patient today."):
        consult = self.call("POST", "/api/v2/doctor/consultations", "doctor", {"episodeId": self.ep, "inputMode": "text"})
        self.call("PATCH", f"/api/v2/doctor/consultations/{consult['id']}", "doctor", {"rawTranscript": text})
        draft = self.call("POST", f"/api/v2/doctor/consultations/{consult['id']}/drafts", "doctor")
        self.call("PATCH", f"/api/v2/doctor/drafts/{draft['id']}", "doctor", {"followUpNextSteps": "Return in two weeks."})
        return self.call("POST", f"/api/v2/doctor/drafts/{draft['id']}/approve", "doctor")["id"]

    def drafts_for(self, approved_id):
        with SessionLocal() as db:
            rows = db.query(models.ClinicalOutput).filter_by(source_type="consultation", source_id=approved_id).all()
            for row in rows:
                self.track(models.ClinicalOutput, row.id)
            return [(r.id, r.kind, r.status, r.language, r.visible_to_patient, r.revision, r.created_by_user_id) for r in rows]

    def test_approving_a_consultation_prepares_an_unreleased_visit_summary_draft_in_her_language(self):
        self.set_language("patient", "hi")
        approved = self.approved_consultation()
        orchestrator.process_queue()
        (draft,) = self.drafts_for(approved)
        with SessionLocal() as db:
            assistant = ensure_assistant_user(db)
            self.assertEqual(draft[1:6], ("visit_summary", "DRAFT", "hi", False, 1))  # not released to her
            self.assertEqual(draft[6], assistant.id)
        self.assertIn("A draft is ready for you", [n["title"] for n in self.updates("doctor")])
        orchestrator.process_queue()
        self.assertEqual(len(self.drafts_for(approved)), 1)  # prepared once

    def test_a_draft_nobody_has_touched_can_be_undone_but_an_edited_one_is_kept(self):
        untouched = self.approved_consultation()
        edited = self.approved_consultation("Talked through the visit and the next steps with the patient today.")
        orchestrator.process_queue()
        (untouched_draft,) = self.drafts_for(untouched)
        (edited_draft,) = self.drafts_for(edited)
        shown = self.call("GET", f"{ROOT}/episodes/{self.ep}", "doctor")
        output = next(o for o in shown["outputs"] if o["id"] == edited_draft[0])
        self.call("PATCH", f"{ROOT}/outputs/{edited_draft[0]}", "doctor", {"content": output["content"] + "\nChecked.", "structuredData": output["structuredData"], "selectedCodes": [], "revision": output["revision"]})
        by_output = {}
        with SessionLocal() as db:
            for action in db.query(models.AIAction).filter_by(tool="prepare_draft", status="DONE").all():
                by_output[(action.undo or {}).get("output_id")] = action.id
        self.call("POST", f"{ASSIST}/actions/{by_output[edited_draft[0]]}/undo", "doctor", {}, expected=409)  # a doctor already worked on it
        self.call("POST", f"{ASSIST}/actions/{by_output[untouched_draft[0]]}/undo", "doctor", {"note": "Not needed"})
        with SessionLocal() as db:
            self.assertIsNone(db.get(models.ClinicalOutput, untouched_draft[0]))
            self.assertIsNotNone(db.get(models.ClinicalOutput, edited_draft[0]))

    def test_handover_stays_paused_so_the_assistant_prepares_nothing(self):
        self.assertTrue(config.HANDOVER_PAUSED)
        with SessionLocal() as db:
            before = db.query(models.AIRun).filter_by(workflow="handover").count()
        self.assertEqual(orchestrator.run_sweeps()["handover"], 0)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.AIRun).filter_by(workflow="handover").count(), before)
            run = models.AIRun(workflow="handover", episode_id=self.ep, source_type="PregnancyEpisode", source_id=self.ep, trigger_key=f"paused:{utcnow().timestamp()}", status="DONE")
            db.add(run)
            db.flush()
            action = tools.act(db, run, "prepare_handover", {"doctor_id": self.doctor_id}, key=f"paused:{utcnow().timestamp()}")
            self.assertEqual(action.status, "FAILED")  # even asked directly, it will not run while the pause is on
            db.rollback()

    def test_with_the_pause_lifted_a_handover_draft_is_prepared_in_the_doctors_language_and_can_be_undone(self):
        self.set_language("doctor", "hi")
        self.call("POST", "/api/v2/patient/questions", "patient", {"questionText": "When is my next appointment?"})
        with SessionLocal() as db:
            for handover in db.query(models.Handover).filter_by(episode_id=self.ep).all():
                handover.created_at = (utcnow() - timedelta(days=3)).replace(tzinfo=None)  # none counts as "today's"
            db.commit()
        with patch.object(config, "HANDOVER_PAUSED", False):
            self.assertGreaterEqual(orchestrator.run_sweeps()["handover"], 1)
            with SessionLocal() as db:
                draft = db.query(models.Handover).filter_by(episode_id=self.ep, status="DRAFT").order_by(models.Handover.created_at.desc()).first()
                self.assertEqual(draft.created_by_user_id, ensure_assistant_user(db).id)
                self.assertTrue(draft.context.startswith("गर्भावस्था:"))  # the doctor's language
                self.assertIn("(चिकित्सक)", draft.who_owns_it)
                draft_id = draft.id
            action = next(a for a in self.call("GET", f"{ASSIST}/activity?limit=200", "doctor") if a["tool"] == "prepare_handover" and a["status"] == "DONE")
            self.call("POST", f"{ASSIST}/actions/{action['id']}/undo", "doctor", {"note": "Not now"})
            with SessionLocal() as db:
                self.assertIsNone(db.get(models.Handover, draft_id))

    def test_handover_wording_has_the_same_blanks_in_every_language(self):
        for key, table in handover_content.PHRASES.items():
            fields = {language: {f for _, f, _, _ in string.Formatter().parse(text) if f} for language, text in table.items()}
            self.assertEqual(len({frozenset(v) for v in fields.values()}), 1, key)

    def test_the_summary_is_plain_counts_for_the_doctors_own_patients_and_only_a_doctor_sees_it(self):
        self.call("GET", f"{ASSIST}/summary", "patient", expected=403)
        before = self.call("GET", f"{ASSIST}/summary?days=7", "doctor")
        self.assertEqual(set(before), {"days", "from", "to", "questions", "documents", "checkIns", "tasks", "visits", "assistant"})
        qid = self.call("POST", "/api/v2/patient/questions", "patient", {"questionText": "Where do I upload my report?"})["id"]
        self.track(models.PatientQuestion, qid)
        after = self.call("GET", f"{ASSIST}/summary?days=7", "doctor")
        self.assertEqual(after["questions"]["received"], before["questions"]["received"] + 1)
        with SessionLocal() as db:
            mine = [a.episode_id for a in db.query(models.PatientDoctorAssignment).filter_by(doctor_user_id=self.doctor_id).all()]
            direct = reporting.summary(db, mine, 7)
        for section in ("questions", "documents", "checkIns", "tasks", "visits"):
            self.assertEqual(after[section], direct[section], section)  # the page and the code agree: the numbers are worked out by code, not written

    def test_each_doctor_gets_one_weekly_message_of_counts_in_their_language(self):
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        with SessionLocal() as db:
            iso = utcnow().isocalendar()
            self.assertEqual(db.query(models.AIRun).filter_by(trigger_key=f"weekly_summary:{self.doctor_id}:{iso.year}-W{iso.week:02d}").count(), 1)
            notes = db.query(models.Notification).filter_by(recipient_user_id=self.doctor_id, message_key="weekly_summary").count()
            self.assertGreaterEqual(notes, 1)
        self.set_language("doctor", "ta")
        self.assertIn("பராமரிப்பு உதவியாளருடன் உங்கள் வாரம்", [n["title"] for n in self.updates("doctor")])


# =============================================================================== the wording itself
class ServerTextTests(WorkflowBase):
    def test_every_message_has_all_four_languages_with_the_same_blanks(self):
        def blanks(text):
            return frozenset(f for _, f, _, _ in string.Formatter().parse(text) if f)

        for key, (title, body) in server_text.CATALOG.items():
            for table in (title, body):
                if table is None:
                    continue
                self.assertEqual(set(table), set(server_text.LANGUAGES), key)
                self.assertEqual(len({blanks(text) for text in table.values()}), 1, key)
                self.assertTrue(all(text.strip() for text in table.values()), key)

    def test_the_same_update_is_worded_in_whatever_language_the_reader_has_now(self):
        with SessionLocal() as db:
            note = server_text.notify_key(db, self.sarah_id, "appointment_cancelled", episode_id=self.ep, params={"kind": "Antenatal visit"}, flush=True)
            legacy = models.Notification(recipient_user_id=self.sarah_id, episode_id=self.ep, type="continuity", title="Written before keys existed", body="Old text")
            db.add(legacy)
            db.commit()
            note_id, legacy_id = note.id, legacy.id
        self.track(models.Notification, note_id)
        self.track(models.Notification, legacy_id)
        expected = {"en": "Appointment cancelled", "hi": "अपॉइंटमेंट रद्द हुई", "ta": "சந்திப்பு ரத்து செய்யப்பட்டது", "te": "అపాయింట్‌మెంట్ రద్దు చేయబడింది"}
        for language, title in expected.items():
            self.set_language("patient", language)
            shown = {n["id"]: n for n in self.updates()}
            self.assertEqual(shown[note_id]["title"], title)
            self.assertEqual(shown[note_id]["body"], "Antenatal visit")  # what a person wrote is shown as written
            self.assertEqual(shown[legacy_id]["title"], "Written before keys existed")  # older rows keep the text they had

    def test_a_trusted_persons_updates_are_worded_in_their_own_language(self):
        ravi = self.ravi_login()
        with SessionLocal() as db:
            note = server_text.notify_key(db, ravi, "caregiver_removed", episode_id=self.ep, flush=True)
            db.commit()
            note_id = note.id
        self.track(models.Notification, note_id)
        with SessionLocal() as db:
            pref = db.get(models.PatientPreference, ravi) or models.PatientPreference(user_id=ravi)
            pref.language = "ta"
            db.add(pref)
            db.commit()
        titles = {n["id"]: n["title"] for n in self.call("GET", "/api/v2/caregiver/notifications", "ravi")}
        self.assertEqual(titles[note_id], "உங்கள் அணுகல் நீக்கப்பட்டது")
        with SessionLocal() as db:
            db.get(models.PatientPreference, ravi).language = "en"
            db.commit()

    def ravi_login(self):
        with SessionLocal() as db:
            return db.get(models.CaregiverLink, self.ravi_link).caregiver_user_id

    def test_policy_refuses_a_message_permission_or_doctor_from_another_patient(self):
        with SessionLocal() as db:
            run = models.AIRun(workflow="outreach", episode_id=self.ep, source_type="x", source_id="x", trigger_key=f"policy:{utcnow().timestamp()}", status="DONE")
            db.add(run)
            db.flush()
            other = db.query(models.User).filter_by(email="dr.chen@maternasync.app").first()
            assigned = db.query(models.PatientDoctorAssignment).filter_by(episode_id=self.ep, doctor_user_id=other.id).first()
            if assigned is None:
                self.assertEqual(policy.decide(db, run, "prepare_handover", {"doctor_id": other.id}, None).outcome, "deny")
            self.assertEqual(policy.decide(db, run, "prepare_handover", {"doctor_id": self.sarah_id}, None).outcome, "deny")  # not a doctor
            elena_reminder = models.CareReminder(episode_id=self.elena_ep, kind="appointment", title="Someone else's", scheduled_at=datetime.utcnow(), source_id="x",
                                                 created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id)
            db.add(elena_reminder)
            db.flush()
            self.assertEqual(policy.decide(db, run, "send_outreach", {"reminder_id": elena_reminder.id}, None).outcome, "deny")
            db.rollback()
        self.assertEqual({t for t in policy.TOOLS if policy.TOOLS[t] == "T1"} >= {"confirm_appointment", "offer_new_times", "record_missed_visit", "send_referral", "chase_referral"}, True)


if __name__ == "__main__":
    unittest.main()
