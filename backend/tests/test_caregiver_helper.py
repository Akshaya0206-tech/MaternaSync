"""The trusted person's visit helper, the end date on their access, and their WhatsApp reminders. Same isolated synthetic database
as the other tests; every test removes what it made so the other modules see the database as they expect."""
import hashlib
import hmac
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import caregiver_service, caregiver_whatsapp, models, server_text, whatsapp
from backend.app.ai_coordinator import orchestrator, tools
from backend.app.database import SessionLocal
from backend.app.seed_assistant import DEMO_CAREGIVER

from test_assistant_caregiver import Base

CG = "/api/v2/caregiver"
MINE = "/api/v2/patient/caregivers"
ROOT = "/api/v2/continuity"
NUMBER = "+919812300001"


def utcnow():
    return datetime.now(timezone.utc)


def naive(moment):
    return moment.replace(tzinfo=None)


class CgBase(Base):
    def setUp(self):
        self.visits = []
        self.addCleanup(self.clean_up)
        self.restore_ravi()

    def clean_up(self):
        with SessionLocal() as db:
            for visit_id in self.visits:
                db.query(models.CaregiverVisitHelp).filter_by(appointment_id=visit_id).delete()
                db.query(models.Outreach).filter_by(source_id=visit_id).delete()
                appt = db.get(models.Appointment, visit_id)
                if appt is not None:
                    db.delete(appt)
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.access_until = None
            ids = [c.id for c in db.query(models.SharingConsent).filter_by(episode_id=self.ep, purpose="caregiver_reminders").all()]
            if ids:
                db.query(models.Outreach).filter(models.Outreach.consent_id.in_(ids)).delete(synchronize_session=False)
                db.query(models.SharingConsent).filter(models.SharingConsent.id.in_(ids)).delete(synchronize_session=False)
            db.query(models.CaregiverWhatsApp).filter_by(link_id=self.ravi_link).delete()
            db.commit()
        self.restore_ravi()
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "en"})
        self.call("PATCH", f"{CG}/preferences", "ravi", {"language": "en"})

    # ---- helpers
    def upcoming_visit(self, hours=72, status="scheduled"):
        with SessionLocal() as db:
            appt = models.Appointment(episode_id=self.ep, scheduled_at=naive(utcnow() + timedelta(hours=hours)), appointment_type="Antenatal visit", status=status,
                                      location="City Women's Hospital, 4 Lake Road, Chennai")
            db.add(appt)
            db.commit()
            self.visits.append(appt.id)
            return appt.id

    def patient_titles(self):
        return [n["title"] for n in self.call("GET", "/api/v2/patient/updates", "patient")]

    def notes_for_her(self, key):
        with SessionLocal() as db:
            return db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key=key).count()

    def set_link(self, **changes):
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            for name, value in changes.items():
                setattr(link, name, value)
            db.commit()

    def turn_on_whatsapp(self, number=NUMBER):
        started = self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": number})
        return self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/confirm", "ravi", {"code": started["demoCode"]})

    def skip_cooldown(self):
        with SessionLocal() as db:
            wa = db.get(models.CaregiverWhatsApp, self.ravi_link)
            wa.requested_at = naive(utcnow() - timedelta(minutes=5))
            db.commit()

    def outreach_to_ravi(self, source_id=None):
        with SessionLocal() as db:
            query = db.query(models.Outreach).filter(models.Outreach.episode_id == self.ep, models.Outreach.source_type.like("caregiver_%"))
            if source_id:
                query = query.filter(models.Outreach.source_id == source_id)
            return [(o.source_type, o.status, o.message, o.recipient) for o in query.all()]


# =============================================================================== 1. the visit helper
class VisitHelperTests(CgBase):
    def test_a_trusted_persons_answer_is_seen_by_her_and_she_is_told_once_per_change(self):
        visit = self.upcoming_visit()
        shown = next(a for a in self.call("GET", f"{CG}/{self.ravi_link}/appointments", "ravi") if a["id"] == visit)
        self.assertIsNone(shown["help"])
        self.assertIn("Lake Road", shown["location"])
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi", {"status": "WILL_TAKE"})
        answers = self.call("GET", f"{MINE}/visit-help", "patient")
        self.assertEqual([(a["name"], a["status"]) for a in answers[visit]], [("Ravi (husband)", "WILL_TAKE")])
        self.assertIn("Ravi (husband) will take you to your visit", self.patient_titles())
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi", {"status": "WILL_TAKE"})  # the same answer again
        self.assertEqual(self.notes_for_her("caregiver_visit_yes"), 1)
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi", {"status": "CANNOT"})
        self.assertIn("Ravi (husband) cannot take you to your visit", self.patient_titles())
        self.assertEqual(self.call("GET", f"{MINE}/visit-help", "patient")[visit][0]["status"], "CANNOT")
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "hi"})
        self.assertIn("Ravi (husband) आपको अपॉइंटमेंट पर नहीं ले जा सकेंगे", self.patient_titles())  # the same note, worded in her language now
        self.call("DELETE", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi")
        self.assertNotIn(visit, self.call("GET", f"{MINE}/visit-help", "patient"))
        with SessionLocal() as db:
            self.assertTrue(db.query(models.AuditLog).filter_by(action="caregiver_visit_help", episode_id=self.ep).count())

    def test_it_needs_the_visit_permission_and_one_of_her_own_upcoming_visits(self):
        visit = self.upcoming_visit()
        self.set_link(permissions={"appointments": False, "check_in": True})
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi", {"status": "WILL_TAKE"}, expected=403)
        self.restore_ravi()
        with SessionLocal() as db:
            other = models.Appointment(episode_id=self.elena_ep, scheduled_at=naive(utcnow() + timedelta(days=3)), appointment_type="Visit", status="scheduled")
            db.add(other)
            db.commit()
            other_id = other.id
        try:
            self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{other_id}/help", "ravi", {"status": "WILL_TAKE"}, expected=404)  # another woman's visit
        finally:
            with SessionLocal() as db:
                db.delete(db.get(models.Appointment, other_id))
                db.commit()
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{self.upcoming_visit(status='cancelled')}/help", "ravi", {"status": "WILL_TAKE"}, expected=409)
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{self.upcoming_visit(hours=-5)}/help", "ravi", {"status": "WILL_TAKE"}, expected=409)  # already past
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi", {"status": "MAYBE"}, expected=422)
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "patient", {"status": "WILL_TAKE"}, expected=403)  # her own login is not a trusted person's
        self.set_link(access_until=naive(utcnow() - timedelta(hours=1)))
        self.call("PUT", f"{CG}/{self.ravi_link}/appointments/{visit}/help", "ravi", {"status": "WILL_TAKE"}, expected=403)  # past the end date

    def test_she_is_told_whenever_a_trusted_person_acts_for_her(self):
        checks = self.notes_for_her("caregiver_acted_checkin")
        self.call("POST", f"{CG}/{self.ravi_link}/check-ins", "ravi", {"recordedAt": utcnow().isoformat(), "mood": "okay", "symptoms": "Tired but eating well."})
        self.assertEqual(self.notes_for_her("caregiver_acted_checkin"), checks + 1)
        asked = self.notes_for_her("caregiver_acted_question")
        self.call("POST", f"{CG}/{self.ravi_link}/questions", "ravi", {"questionText": "Where do we park at the clinic?"})
        self.assertEqual(self.notes_for_her("caregiver_acted_question"), asked + 1)
        talked = self.notes_for_her("caregiver_acted_talk")
        self.call("POST", f"{CG}/{self.ravi_link}/talk-to-a-person", "ravi", {"message": "Please call us."})
        self.assertEqual(self.notes_for_her("caregiver_acted_talk"), talked + 1)
        self.assertIn("Ravi (husband) helped you", self.patient_titles())
        with SessionLocal() as db:
            note = db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key="caregiver_acted_talk").order_by(models.Notification.created_at.desc()).first()
            self.assertNotIn("Please call us", note.body)  # the note says what they did, not what they wrote


# =============================================================================== 2. an end date on their access
class AccessLimitTests(CgBase):
    def day(self, days):
        return (utcnow() + timedelta(days=days)).date().isoformat()

    def test_an_end_date_must_be_a_real_date_in_the_next_two_years(self):
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": self.day(-1)}, expected=400)
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": self.day(900)}, expected=400)
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": "next week"}, expected=422)
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "ravi", {"accessUntil": self.day(5)}, expected=403)  # only the woman sets it
        done = self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": self.day(5)})
        self.assertTrue(done["accessUntil"].startswith(self.day(5)) and not done["ended"])
        again = self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"relationship": "Husband"})  # leaving it out changes nothing
        self.assertTrue(again["accessUntil"].startswith(self.day(5)))
        cleared = self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": None})
        self.assertIsNone(cleared["accessUntil"])

    def test_after_the_end_date_the_person_sees_nothing_and_extending_gives_it_back(self):
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": self.day(2)})
        self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi")
        self.set_link(access_until=naive(utcnow() - timedelta(hours=1)))  # the day has passed
        for path in ("home", "appointments", "check-ins", "care-plan", "questions", "emergency", "whatsapp"):
            denied = self.client.get(f"{CG}/{self.ravi_link}/{path}", headers=self.headers["ravi"])
            self.assertEqual(denied.status_code, 403, path)
            self.assertIn("has ended", denied.json()["detail"], path)
        self.call("POST", f"{CG}/{self.ravi_link}/talk-to-a-person", "ravi", {"message": "x"}, expected=403)
        self.call("POST", f"{CG}/{self.ravi_link}/check-ins", "ravi", {"recordedAt": utcnow().isoformat(), "mood": "okay", "symptoms": "x"}, expected=403)
        women =self.call("GET", f"{CG}/women", "ravi")
        mine = next(w for w in women if w["linkId"] == self.ravi_link)
        self.assertTrue(mine["ended"])  # still listed, so they can see why and ask her
        listed = next(i for i in self.call("GET", MINE, "patient")["items"] if i["id"] == self.ravi_link)
        self.assertTrue(listed["ended"])
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            self.assertEqual((link.status, caregiver_service.is_current(link)), ("ACTIVE", False))
            self.assertNotIn(link.id, [l.id for l in caregiver_service.active_links_for_episode(db, self.ep)])
        self.call("PATCH", f"{MINE}/{self.ravi_link}", "patient", {"accessUntil": self.day(10)})
        self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi")  # extended: back at once

    def forget_access_notes(self):
        """The notices are once per end date, so earlier tests' runs and notes are cleared to make the counts here mean something."""
        with SessionLocal() as db:
            db.query(models.AIRun).filter(models.AIRun.trigger_key.like(f"caregiver_access:{self.ravi_link}:%")).delete(synchronize_session=False)
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"caregiver_access:{self.ravi_link}:%")).delete(synchronize_session=False)
            db.query(models.Notification).filter(models.Notification.recipient_user_id == self.sarah_id, models.Notification.message_key.in_(["access_ending", "access_ended"])).delete(synchronize_session=False)
            db.commit()

    def test_she_is_warned_three_days_before_and_told_when_it_ends_once_each(self):
        self.forget_access_notes()
        self.set_link(access_until=naive(utcnow() + timedelta(days=2)))
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        self.assertEqual(self.notes_for_her("access_ending"), 1)
        self.assertEqual(self.notes_for_her("access_ended"), 0)
        self.assertIn("A trusted person's access ends soon", self.patient_titles())
        self.set_link(access_until=naive(utcnow() - timedelta(hours=2)))
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        self.assertEqual(self.notes_for_her("access_ended"), 1)
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "ta"})
        self.assertIn("நம்பகமான ஒருவரின் அணுகல் முடிந்துவிட்டது", self.patient_titles())
        with SessionLocal() as db:
            body = db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key="access_ended").first().message_params
            self.assertEqual(body["name"], "Ravi (husband)")

    def test_an_ended_person_gets_no_reminders_from_the_assistant(self):
        visit = self.upcoming_visit(hours=3)
        self.set_link(access_until=naive(utcnow() - timedelta(hours=2)))
        orchestrator.run_sweeps()
        with SessionLocal() as db:
            ravi = db.get(models.CaregiverLink, self.ravi_link).caregiver_user_id
            self.assertEqual(db.query(models.Notification).filter_by(recipient_user_id=ravi, related_entity_id=visit).count(), 0)
            self.assertEqual(db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, related_entity_id=visit, message_key="visit_reminder").count(), 1)  # she still gets hers

    def test_an_invite_can_carry_an_end_date_from_the_start(self):
        made = self.call("POST", MINE, "patient", {"displayName": "Aunt Meena", "relationship": "Aunt", "permissions": {"appointments": True}, "accessUntil": self.day(30)})
        try:
            self.assertTrue(made["accessUntil"].startswith(self.day(30)))
            self.call("POST", MINE, "patient", {"displayName": "Late", "accessUntil": self.day(-2)}, expected=400)
        finally:
            with SessionLocal() as db:
                db.delete(db.get(models.CaregiverLink, made["id"]))
                db.commit()


# =============================================================================== 3. WhatsApp reminders on their own number
class CaregiverWhatsAppTests(CgBase):
    def test_a_number_is_only_used_after_its_owner_confirms_a_code_and_is_never_shown_in_full(self):
        status = self.call("GET", f"{CG}/{self.ravi_link}/whatsapp", "ravi")
        self.assertEqual((status["available"], status["status"], status["number"]), (True, "off", None))
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": "98123"}, expected=422)  # far too short
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": "9812300001"}, expected=400)  # no country code
        started = self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER})
        self.assertEqual((started["status"], len(started["demoCode"])), ("waiting", 6))
        self.assertNotIn(NUMBER, json.dumps(started))
        self.assertTrue(started["number"].startswith("+91") and started["number"].endswith("0001") and "•" in started["number"])
        self.assertEqual(self.notes_for_her("caregiver_whatsapp_on"), 0)  # nothing is on, and she is told nothing, before the code
        with SessionLocal() as db:
            self.assertEqual(db.query(models.SharingConsent).filter_by(episode_id=self.ep, purpose="caregiver_reminders").count(), 0)
            self.assertNotIn(started["demoCode"], db.get(models.CaregiverWhatsApp, self.ravi_link).code_hash)  # only a hash is kept
        on = self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/confirm", "ravi", {"code": started["demoCode"]})
        self.assertEqual((on["status"], on["visits"], on["checkIns"]), ("on", True, True))
        self.assertEqual(self.notes_for_her("caregiver_whatsapp_on"), 1)
        self.assertIn("Ravi (husband) turned on WhatsApp reminders", self.patient_titles())
        # her Sharing & Consent list and the doctor's outreach list never carry a trusted person's own number
        for who in ("patient", "doctor"):
            self.assertNotIn(NUMBER, json.dumps(self.call("GET", f"{ROOT}/episodes/{self.ep}", who)))
        off = self.call("DELETE", f"{CG}/{self.ravi_link}/whatsapp", "ravi")
        self.assertEqual((off["status"], off["number"]), ("off", None))
        self.assertEqual(self.notes_for_her("caregiver_whatsapp_off"), 1)
        with SessionLocal() as db:
            self.assertTrue(all(c.revoked_at for c in db.query(models.SharingConsent).filter_by(episode_id=self.ep, purpose="caregiver_reminders").all()))

    def test_a_wrong_code_locks_after_five_tries_and_an_expired_code_is_refused(self):
        started = self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER})
        wrong = "000000" if started["demoCode"] != "000000" else "111111"
        for _ in range(5):
            self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/confirm", "ravi", {"code": wrong}, expected=400)
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/confirm", "ravi", {"code": started["demoCode"]}, expected=429)  # even the right one, now
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER}, expected=429)  # one minute between codes
        self.skip_cooldown()
        second = self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER})
        with SessionLocal() as db:
            wa = db.get(models.CaregiverWhatsApp, self.ravi_link)
            wa.code_expires_at = naive(utcnow() - timedelta(minutes=1))
            db.commit()
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/confirm", "ravi", {"code": second["demoCode"]}, expected=400)
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/whatsapp", "ravi")["status"], "off")

    def test_at_most_five_codes_a_day_and_none_without_something_to_be_reminded_of(self):
        for attempt in range(5):
            self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER})
            self.skip_cooldown()
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER}, expected=429)
        self.set_link(permissions={"appointments": False, "check_in": False, "care_plan": True})
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER}, expected=403)

    def test_without_automatic_sending_the_option_is_refused_plainly(self):
        with patch.dict(os.environ, {"MATERNASYNC_WHATSAPP_PROVIDER": "manual"}):
            status = self.call("GET", f"{CG}/{self.ravi_link}/whatsapp", "ravi")
            self.assertEqual((status["available"], status["mode"]), (False, "manual"))
            self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER}, expected=409)

    def test_in_a_real_account_the_code_goes_out_through_an_approved_template(self):
        env = {"MATERNASYNC_WHATSAPP_PROVIDER": "cloud_api", "MATERNASYNC_WHATSAPP_TOKEN": "t", "MATERNASYNC_WHATSAPP_PHONE_ID": "1",
               "MATERNASYNC_WHATSAPP_CODE_TEMPLATE": "login_code", "MATERNASYNC_WHATSAPP_TEMPLATE": "care_reminder"}
        with patch.dict(os.environ, env), patch.object(whatsapp, "_post", return_value={"messages": [{"id": "wamid.CODE"}]}) as post:
            started = self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/start", "ravi", {"number": NUMBER})
            payload = post.call_args.args[2]
        self.assertIsNone(started["demoCode"])  # a real phone gets the code; the screen does not
        self.assertEqual((payload["type"], payload["template"]["name"]), ("template", "login_code"))  # not the plain reminder template
        code = payload["template"]["components"][0]["parameters"][0]["text"]
        self.assertEqual(len(code), 6)
        self.call("POST", f"{CG}/{self.ravi_link}/whatsapp/confirm", "ravi", {"code": code})
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/whatsapp", "ravi")["status"], "on")

    def test_a_visit_reminder_goes_out_once_in_their_language_with_nothing_about_her(self):
        self.turn_on_whatsapp()
        self.call("PATCH", f"{CG}/preferences", "ravi", {"language": "ta"})
        visit = self.upcoming_visit(hours=3)
        orchestrator.run_sweeps()
        orchestrator.run_sweeps()
        sent = self.outreach_to_ravi(visit)
        self.assertEqual(sent, [("caregiver_visit", "SENT", server_text.outreach_text("caregiver_visit", "ta"), NUMBER)])  # once, in Tamil, labelled by the simulator
        self.assertNotRegex(sent[0][2], r"Sarah|Jenkins|\d")  # no name, no number: nothing to read off a lock screen
        row = next(a for a in self.call("GET", "/api/v2/assistant/activity?limit=200", "doctor") if a["tool"] == "send_caregiver_whatsapp")
        self.assertFalse(row["undoable"])  # a sent message cannot be recalled; the pause and review-every-step switches hold it

    def test_it_stops_the_moment_any_of_the_conditions_stops_holding(self):
        self.turn_on_whatsapp()

        def reminders_for(hours):
            visit = self.upcoming_visit(hours=hours)
            orchestrator.run_sweeps()
            return len(self.outreach_to_ravi(visit))

        self.assertEqual(reminders_for(3), 1)  # baseline: it works
        self.set_link(permissions={"appointments": False, "check_in": True})
        self.assertEqual(reminders_for(4), 0)  # she no longer lets them see visits
        self.restore_ravi()
        self.set_link(access_until=naive(utcnow() - timedelta(hours=1)))
        self.assertEqual(reminders_for(5), 0)  # past the end date she set
        self.set_link(access_until=None)
        self.set_link(status="REVOKED")
        self.assertEqual(reminders_for(6), 0)  # removed
        self.restore_ravi()
        with SessionLocal() as db:  # they replied STOP: the existing opt-out revokes the consent
            for consent in db.query(models.SharingConsent).filter_by(episode_id=self.ep, purpose="caregiver_reminders").all():
                consent.revoked_at = naive(utcnow())
            db.commit()
        self.assertEqual(reminders_for(7), 0)
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/whatsapp", "ravi")["status"], "off")
        with SessionLocal() as db:  # and asked directly, the tool itself refuses
            run = models.AIRun(workflow="outreach", episode_id=self.ep, source_type="CaregiverLink", source_id=self.ravi_link, trigger_key=f"direct:{utcnow().timestamp()}", status="DONE")
            db.add(run)
            db.flush()
            action = tools.act(db, run, "send_caregiver_whatsapp", {"link_id": self.ravi_link, "kind": "visit", "source_id": "x"}, key=f"direct:{utcnow().timestamp()}")
            self.assertEqual(action.status, "FAILED")
            self.assertIn("no longer apply", action.result)
            db.rollback()

    def test_a_stop_reply_from_the_trusted_persons_number_turns_it_off(self):
        self.turn_on_whatsapp()
        env = {"MATERNASYNC_WHATSAPP_PROVIDER": "cloud_api", "MATERNASYNC_WHATSAPP_TOKEN": "t", "MATERNASYNC_WHATSAPP_PHONE_ID": "1", "MATERNASYNC_WHATSAPP_APP_SECRET": "whsec"}
        stop = {"entry": [{"changes": [{"value": {"messages": [{"from": NUMBER.lstrip("+"), "type": "text", "text": {"body": " Stop "}}]}}]}]}
        raw = json.dumps(stop).encode()
        signature = "sha256=" + hmac.new(b"whsec", raw, hashlib.sha256).hexdigest()
        with patch.dict(os.environ, env):
            result = self.client.post("/api/v2/webhooks/whatsapp", content=raw, headers={"X-Hub-Signature-256": signature, "Content-Type": "application/json"})
        self.assertEqual(result.status_code, 200)
        self.assertGreaterEqual(result.json()["optOuts"], 1)
        self.assertEqual(self.call("GET", f"{CG}/{self.ravi_link}/whatsapp", "ravi")["status"], "off")

    def test_check_in_nudges_are_capped_at_three_per_lapse(self):
        self.turn_on_whatsapp()
        with SessionLocal() as db:
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is None:
                plan = models.MonitoringPlan(episode_id=self.ep, interval_days=1, active=True, owner_user_id=self.doctor_id)
                db.add(plan)
            plan.active, plan.interval_days, plan.agreed_at = True, 1, naive(utcnow() - timedelta(days=5))
            db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
            db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == self.ep).delete()
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"wa:checkin:{self.ep}:%")).delete(synchronize_session=False)
            for number in range(3):  # three earlier reminders in this lapse: today's would be the fourth
                db.add(models.AIRun(workflow="missed_checkin", episode_id=self.ep, source_type="MonitoringPlan", source_id=self.ep, trigger_key=f"missed_checkin:{self.ep}:old{number}", status="DONE"))
            db.commit()
        try:
            orchestrator.run_sweeps()
            self.assertEqual([r for r in self.outreach_to_ravi() if r[0] == "caregiver_checkin"], [])  # the in-app reminder still went; the WhatsApp one did not
            with SessionLocal() as db:
                self.assertTrue(db.query(models.Notification).filter_by(type="assistant_reminder", episode_id=self.ep).count())
                db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == self.ep).delete()
                db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
                for number in range(2):
                    db.add(models.AIRun(workflow="missed_checkin", episode_id=self.ep, source_type="MonitoringPlan", source_id=self.ep, trigger_key=f"missed_checkin:{self.ep}:fresh{number}", status="DONE"))
                db.commit()
            orchestrator.run_sweeps()
            sent = [r for r in self.outreach_to_ravi() if r[0] == "caregiver_checkin"]
            self.assertEqual(len(sent), 1)
            self.assertEqual(sent[0][2], server_text.outreach_text("caregiver_checkin", "en"))
        finally:
            with SessionLocal() as db:
                db.query(models.AIRun).filter(models.AIRun.workflow == "missed_checkin", models.AIRun.episode_id == self.ep).delete()
                db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
                db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"wa:checkin:{self.ep}:%")).delete(synchronize_session=False)
                plan = db.get(models.MonitoringPlan, self.ep)
                if plan:
                    plan.active = False
                db.commit()

    def test_the_policy_checks_the_link_belongs_to_the_same_patient(self):
        with SessionLocal() as db:
            from backend.app.ai_coordinator import policy
            link = db.query(models.CaregiverLink).filter(models.CaregiverLink.episode_id == self.elena_ep).first()
            run = models.AIRun(workflow="outreach", episode_id=self.ep, source_type="x", source_id="x", trigger_key=f"policy:{utcnow().timestamp()}", status="DONE")
            db.add(run)
            db.flush()
            if link is not None:
                self.assertEqual(policy.decide(db, run, "send_caregiver_whatsapp", {"link_id": link.id}, None).outcome, "deny")
            self.assertEqual(policy.TOOLS["send_caregiver_whatsapp"], "T0")
            db.rollback()


if __name__ == "__main__":
    unittest.main()
