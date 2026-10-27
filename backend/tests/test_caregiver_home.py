"""Trusted person -> Home (the Today card, stopping), Updates (unread per woman, marking read, where each update leads) and Profile (their own password).

Same isolated synthetic database as the other tests. Every test removes what it made so the other modules see the database as they expect."""
import itertools
import unittest
from datetime import datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import caregiver_update_links, models, server_text
from backend.app.database import SessionLocal
from backend.app.models.caregiver import PERMISSIONS
from backend.app.seed_assistant import DEMO_CAREGIVER

from test_assistant_caregiver import Base

CG = "/api/v2/caregiver"
MINE = "/api/v2/patient/caregivers"
ROOT = "/api/v2/continuity"
NUMBER = "+919812300077"
PASSWORD = "Passw0rd!!"
NEW_PASSWORD = "NewPassw0rd!!"
COUNTER = itertools.count(1)


def utcnow():
    return datetime.now(timezone.utc)


def naive(moment):
    return moment.replace(tzinfo=None)


ALL_ON = {p: True for p in PERMISSIONS}
ALL_OFF = {p: False for p in PERMISSIONS}


class HomeBase(Base):
    def setUp(self):
        self.visits, self.logs, self.reminders, self.questions, self.notes, self.helpers = [], [], [], [], [], []
        self.addCleanup(self.clean_up)
        self.restore_ravi()
        self.set_link(permissions=dict(ALL_ON), access_until=None)
        with SessionLocal() as db:
            self.ravi_id = db.query(models.User).filter_by(email=DEMO_CAREGIVER["email"]).first().id

    def clean_up(self):
        with SessionLocal() as db:
            for visit_id in self.visits:
                appt = db.get(models.Appointment, visit_id)
                if appt is not None:
                    db.delete(appt)
            for ids, model in ((self.logs, models.DailyLog), (self.reminders, models.CareReminder), (self.notes, models.Notification)):
                for row_id in ids:
                    row = db.get(model, row_id)
                    if row is not None:
                        db.delete(row)
            for question_id in self.questions:
                db.query(models.QuestionResponse).filter_by(question_id=question_id).delete()
                question = db.get(models.PatientQuestion, question_id)
                if question is not None:
                    db.delete(question)
            db.commit()
        self.call("DELETE", f"{ROOT}/episodes/{self.ep}/checkin-helper", "doctor")
        for link_id in self.helpers:
            self.call("DELETE", f"{MINE}/{link_id}", "patient")
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "en"})
        self.restore_ravi()
        self.set_link(permissions=dict(ALL_ON), access_until=None)

    # ---- helpers
    def set_link(self, **changes):
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            for name, value in changes.items():
                setattr(link, name, value)
            db.commit()

    def new_helper(self, permissions=None, relationship="Aunt"):
        """A brand-new trusted person for Sarah with their own login. Returns (link id, the key of their headers, their email)."""
        made = self.call("POST", MINE, "patient", {"displayName": relationship, "relationship": relationship, "permissions": permissions if permissions is not None else dict(ALL_ON)})
        self.helpers.append(made["id"])
        n = next(COUNTER)
        email = f"home.helper{n}@example.org"
        registered = self.client.post("/api/auth/register", json={"fullName": f"Meena Helper{n}", "email": email, "password": PASSWORD, "confirmPassword": PASSWORD,
                                                                  "role": "caregiver", "inviteCode": made["code"]})
        self.assertEqual(registered.status_code, 200, registered.text)
        key = f"helper{n}"
        self.headers[key] = {"Authorization": "Bearer " + registered.json()["accessToken"]}
        return made["id"], key, email

    def upcoming_visit(self, minutes=90, status="scheduled"):
        with SessionLocal() as db:
            appt = models.Appointment(episode_id=self.ep, scheduled_at=naive(utcnow() + timedelta(minutes=minutes)), appointment_type="Antenatal visit", status=status,
                                      location="City Women's Hospital, 4 Lake Road, Chennai")
            db.add(appt)
            db.commit()
            self.visits.append(appt.id)
            return appt.id

    def add_note(self, user_id, key, episode_id, *, params=None, read=False, type_=None):
        with SessionLocal() as db:
            note = server_text.notify_key(db, user_id, key, episode_id=episode_id, type_=type_ or key, params=params or {}, flush=True)
            note.is_read = read
            db.commit()
            self.notes.append(note.id)
            return note.id

    def plain_note(self, user_id, title, body, episode_id, type_):
        with SessionLocal() as db:
            note = models.Notification(recipient_user_id=user_id, episode_id=episode_id, type=type_, title=title, body=body, is_read=False)
            db.add(note)
            db.commit()
            self.notes.append(note.id)
            return note.id

    def today(self, who="ravi", link=None):
        return self.call("GET", f"{CG}/{link or self.ravi_link}/today?tz_offset=0", who)


# =============================================================================== 1. the Today card
class TodayTests(HomeBase):
    def test_each_part_appears_only_when_she_allowed_it_and_nothing_else_comes_with_it(self):
        self.upcoming_visit()
        for permission, key in {"check_in": "checkIn", "reminders": "remindersDue", "questions": "answeredRecently", "appointments": "nextVisit"}.items():
            self.set_link(permissions={p: p == permission for p in PERMISSIONS})
            self.assertEqual(list(self.today()), [key], permission)
        self.set_link(permissions={**ALL_OFF, "care_plan": True, "emergency": True})
        self.assertEqual(self.today(), {})  # nothing to show: the card has no data at all, so the page hides it
        self.set_link(permissions=dict(ALL_ON))
        self.assertEqual(sorted(self.today()), ["answeredRecently", "checkIn", "nextVisit", "remindersDue"])

    def test_a_visit_shown_is_the_next_confirmed_one_and_only_with_the_visit_permission(self):
        soon = self.upcoming_visit(minutes=3)
        self.upcoming_visit(minutes=1, status="requested")  # not confirmed: never "the next visit"
        self.upcoming_visit(minutes=-600)  # already past
        with SessionLocal() as db:
            expected = (db.query(models.Appointment).filter(models.Appointment.episode_id == self.ep, models.Appointment.status == "scheduled",
                                                            models.Appointment.scheduled_at > naive(utcnow())).order_by(models.Appointment.scheduled_at).first().id)
        shown = self.today()["nextVisit"]
        self.assertEqual(shown["id"], expected)
        self.assertIn(shown["id"], [soon, expected])
        self.assertIn("scheduledAt", shown)
        self.set_link(permissions={**ALL_ON, "appointments": False})
        self.assertNotIn("nextVisit", self.today())

    def test_check_in_today_is_none_then_skipped_then_recorded(self):
        # Other test files post a check-in dated now and leave it, so start from none and put theirs back afterwards.
        with SessionLocal() as db:
            kept = [{column.name: getattr(row, column.name) for column in models.DailyLog.__table__.columns} for row in db.query(models.DailyLog).filter_by(episode_id=self.ep).all()]
            db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
            db.commit()

        def put_back():
            with SessionLocal() as db:
                db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
                for values in kept:
                    db.add(models.DailyLog(**values))
                db.commit()
        self.addCleanup(put_back)
        self.assertEqual(self.today()["checkIn"], "none")
        with SessionLocal() as db:
            skipped = models.DailyLog(episode_id=self.ep, recorded_at=naive(utcnow()), skipped=True)
            db.add(skipped)
            db.commit()
            self.logs.append(skipped.id)
        self.assertEqual(self.today()["checkIn"], "skipped")
        with SessionLocal() as db:
            done = models.DailyLog(episode_id=self.ep, recorded_at=naive(utcnow()), systolic=110, diastolic=70, skipped=False)
            db.add(done)
            db.commit()
            self.logs.append(done.id)
        self.assertEqual(self.today()["checkIn"], "recorded")
        with SessionLocal() as db:  # yesterday's check-in is not today's
            for log_id in self.logs:
                db.delete(db.get(models.DailyLog, log_id))
            old = models.DailyLog(episode_id=self.ep, recorded_at=naive(utcnow() - timedelta(days=2)), skipped=False)
            db.add(old)
            db.commit()
            self.logs = [old.id]
        self.assertEqual(self.today()["checkIn"], "none")

    def test_reminders_are_counted_not_named_and_only_pending_ones_due_today(self):
        before = self.today()["remindersDue"]
        with SessionLocal() as db:
            for status, when in (("pending", utcnow() - timedelta(hours=1)), ("pending", utcnow() + timedelta(days=5)), ("done", utcnow() - timedelta(hours=2))):
                reminder = models.CareReminder(episode_id=self.ep, kind="medicine", title="Secret-medicine-name", instructions="Secret instructions", scheduled_at=naive(when),
                                               status=status, created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id)
                db.add(reminder)
                db.flush()
                self.reminders.append(reminder.id)
            db.commit()
        body = self.today()
        self.assertEqual(body["remindersDue"], before + 1)  # only the one that is pending and due
        self.assertNotIn("Secret", str(body))

    def test_answers_count_only_this_persons_own_questions_with_a_recent_approved_visible_reply(self):
        before = self.today()["answeredRecently"]
        with SessionLocal() as db:
            def question(asker, text, reply_status, visible, approved_days_ago):
                q = models.PatientQuestion(episode_id=self.ep, asked_by_user_id=asker, question_text=text, status="ANSWERED")
                db.add(q)
                db.flush()
                db.add(models.QuestionResponse(question_id=q.id, responder_user_id=self.doctor_id, responder_role="doctor", response_text="Reply", status=reply_status,
                                               visible_to_patient=visible, approved_at=naive(utcnow() - timedelta(days=approved_days_ago)),
                                               created_at=naive(utcnow() - timedelta(days=approved_days_ago))))
                self.questions.append(q.id)
            question(self.ravi_id, "Counts", "APPROVED", True, 1)
            question(self.ravi_id, "Too old", "APPROVED", True, 12)
            question(self.ravi_id, "Draft reply", "DRAFT", False, 1)
            question(self.sarah_id, "Her own question", "APPROVED", True, 1)  # hers, not theirs
            db.commit()
        self.assertEqual(self.today()["answeredRecently"], before + 1)

    def test_it_is_refused_for_a_link_that_is_not_theirs_was_removed_or_has_ended(self):
        other_link, other_key, _ = self.new_helper()
        self.call("GET", f"{CG}/{other_link}/today", "ravi", expected=403)  # someone else's link
        self.call("GET", f"{CG}/{self.ravi_link}/today", other_key, expected=403)
        self.call("GET", f"{CG}/{self.ravi_link}/today", "patient", expected=403)  # only the trusted person's own login
        self.call("GET", f"{CG}/{self.ravi_link}/today", "doctor", expected=403)
        self.call("DELETE", f"{MINE}/{other_link}", "patient")
        self.call("GET", f"{CG}/{other_link}/today", other_key, expected=403)  # removed
        self.set_link(access_until=naive(utcnow() - timedelta(days=1)))
        self.call("GET", f"{CG}/{self.ravi_link}/today", "ravi", expected=403)  # past the end date she set


# =============================================================================== 2. stopping
class StopHelpingTests(HomeBase):
    def endpoints(self, link_id):
        return [("GET", f"{CG}/{link_id}/home"), ("GET", f"{CG}/{link_id}/today"), ("GET", f"{CG}/{link_id}/appointments"), ("GET", f"{CG}/{link_id}/check-ins"),
                ("GET", f"{CG}/{link_id}/care-plan"), ("GET", f"{CG}/{link_id}/reminders"), ("GET", f"{CG}/{link_id}/questions"), ("GET", f"{CG}/{link_id}/emergency"),
                ("GET", f"{CG}/{link_id}/whatsapp"), ("GET", f"{CG}/{link_id}/visit-prep")]

    def test_stopping_ends_the_link_turns_off_whatsapp_leaves_the_helper_request_and_tells_her(self):
        link, key, _ = self.new_helper(relationship="Aunt")
        started = self.call("POST", f"{CG}/{link}/whatsapp/start", key, {"number": NUMBER})
        self.call("POST", f"{CG}/{link}/whatsapp/confirm", key, {"code": started["demoCode"]})
        self.assertEqual(self.call("GET", f"{CG}/{link}/whatsapp", key)["status"], "on")
        self.call("PUT", f"{ROOT}/episodes/{self.ep}/checkin-helper", "doctor", {"linkId": link})
        before = [i["name"] for i in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"]]
        self.assertIn("Aunt", before)

        self.assertEqual(self.call("POST", f"{CG}/{link}/stop-helping", key), {"stopped": True})

        with SessionLocal() as db:
            row = db.get(models.CaregiverLink, link)
            self.assertEqual((row.status, row.revoked_by), ("REVOKED", "caregiver"))
            self.assertIsNotNone(row.revoked_at)
            self.assertIsNone(row.code_hash)
            wa = db.get(models.CaregiverWhatsApp, link)
            self.assertTrue(wa is None or (wa.verified_at is None and wa.consent_id is None))  # their reminders about her have stopped
            self.assertIsNone(db.get(models.CheckInHelper, self.ep))  # a doctor's request to help with check-ins does not outlive them
            audit = db.query(models.AuditLog).filter_by(object_type="CaregiverLink", object_id=link, action="caregiver_stopped_helping").all()
            self.assertEqual(len(audit), 1)
            self.assertEqual(audit[0].actor_role, "caregiver")
            self.assertEqual(audit[0].episode_id, self.ep)

        # they see nothing about her any more, on any endpoint
        self.assertEqual(self.call("GET", f"{CG}/women", key), [])
        for method, path in self.endpoints(link):
            self.call(method, path, key, expected=403)
        self.call("POST", f"{CG}/{link}/questions", key, {"questionText": "Can I still ask?"}, expected=403)
        self.call("POST", f"{CG}/{link}/talk-to-a-person", key, {"message": "hello"}, expected=403)
        # a second call is refused and does nothing twice
        self.call("POST", f"{CG}/{link}/stop-helping", key, expected=403)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id, message_key="caregiver_stopped", related_entity_id=link).count(), 1)
            self.assertEqual(db.query(models.AuditLog).filter_by(object_id=link, action="caregiver_stopped_helping").count(), 1)

        # the doctor's Audit trail knows this action: under "trusted people", with the trusted person as who did it
        trail = self.call("GET", f"/api/v2/doctor/episodes/{self.ep}/audit-trail?kind=trusted&who=trusted_person", "doctor")["items"]
        stopped = [row for row in trail if row.get("action") == "caregiver_stopped_helping"]
        self.assertEqual(len(stopped), 1, trail[:3])
        self.assertEqual(stopped[0].get("kind"), "trusted")

        # she is told, in her own language, by the name she gave them
        english = [n for n in self.call("GET", "/api/v2/patient/updates", "patient") if n["title"] == "Aunt stopped helping you"]
        self.assertEqual(len(english), 1)
        self.assertEqual(english[0]["link"], "/patient/profile")
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "hi"})
        hindi_title, _ = server_text.render("caregiver_stopped", "hi", {"name": "Aunt"})
        self.assertIn(hindi_title, [n["title"] for n in self.call("GET", "/api/v2/patient/updates", "patient")])
        for language in ("ta", "te"):
            title, body = server_text.render("caregiver_stopped", language, {"name": "Aunt"})
            self.assertTrue(title and body and "{" not in title + body)

        # her list says they stopped (not that she removed them); the doctor's read-only list no longer shows them
        mine = next(p for p in self.call("GET", MINE, "patient")["items"] if p["id"] == link)
        self.assertEqual((mine["status"], mine["revokedBy"]), ("REVOKED", "caregiver"))
        self.assertNotIn("Aunt", [i["name"] for i in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"]])
        # she can invite them again, with a new code; the old link stays ended
        again = self.call("POST", MINE, "patient", {"displayName": "Aunt", "relationship": "Aunt", "permissions": {}})
        self.helpers.append(again["id"])
        self.assertNotEqual(again["id"], link)
        self.call("PATCH", f"{MINE}/{link}", "patient", {"displayName": "Back"}, expected=409)

    def test_removing_someone_is_recorded_as_her_doing(self):
        link, key, _ = self.new_helper()
        removed = self.call("DELETE", f"{MINE}/{link}", "patient")
        self.assertEqual((removed["status"], removed["revokedBy"]), ("REVOKED", "patient"))
        self.call("POST", f"{CG}/{link}/stop-helping", key, expected=403)  # already ended: nothing to stop
        active = self.call("GET", MINE, "patient")["items"]
        self.assertEqual(next(p for p in active if p["id"] == link)["revokedBy"], "patient")
        self.assertIsNone(next(p for p in active if p["id"] == self.ravi_link)["revokedBy"])

    def test_nobody_else_can_stop_someone_elses_link(self):
        link, key, _ = self.new_helper()
        self.call("POST", f"{CG}/{link}/stop-helping", "ravi", expected=403)  # another trusted person
        self.call("POST", f"{CG}/{link}/stop-helping", "patient", expected=403)  # she uses Remove instead
        self.call("POST", f"{CG}/{link}/stop-helping", "doctor", expected=403)
        with SessionLocal() as db:
            self.assertEqual(db.get(models.CaregiverLink, link).status, "ACTIVE")
            self.assertEqual(db.get(models.CaregiverLink, self.ravi_link).status, "ACTIVE")
        self.call("GET", f"{CG}/{link}/home", key)  # theirs still works

    def test_when_their_access_has_ended_they_cannot_use_it(self):
        self.set_link(access_until=naive(utcnow() - timedelta(days=1)))
        self.call("POST", f"{CG}/{self.ravi_link}/stop-helping", "ravi", expected=403)


# =============================================================================== 3. updates
class UpdatesTests(HomeBase):
    def second_woman(self):
        """Elena invites Ravi too, so he looks after two women. Returns the link id."""
        theirs = self.call("POST", MINE, "other_patient", {"displayName": "Ravi", "relationship": "Friend", "permissions": {"appointments": True, "reminders": True}})
        joined = self.call("POST", f"{CG}/accept", "ravi", {"code": theirs["code"]})
        self.addCleanup(lambda: self.call("DELETE", f"{MINE}/{joined['linkId']}", "other_patient"))
        return joined["linkId"]

    def test_unread_is_counted_for_each_woman_separately(self):
        elena_link = self.second_woman()
        before = self.call("GET", f"{CG}/updates-summary", "ravi")
        self.assertIn(self.ravi_link, before["byLink"])
        self.assertIn(elena_link, before["byLink"])
        self.add_note(self.ravi_id, "visit_prep_caregiver", self.ep, params={"name": "Sarah", "when": "01-01-2027 10:00"})
        self.add_note(self.ravi_id, "visit_prep_caregiver", self.ep, params={"name": "Sarah", "when": "02-01-2027 10:00"})
        self.add_note(self.ravi_id, "reminder_due_caregiver", self.elena_ep, params={"name": "Elena"})
        self.add_note(self.ravi_id, "helper_ended_caregiver", None, params={"name": "Sarah", "doctor": "Dr"})
        self.add_note(self.ravi_id, "visit_prep_caregiver", self.ep, params={"name": "Sarah", "when": "03-01-2027 10:00"}, read=True)  # already read: not counted
        after = self.call("GET", f"{CG}/updates-summary", "ravi")
        self.assertEqual(after["byLink"][self.ravi_link], before["byLink"][self.ravi_link] + 2)
        self.assertEqual(after["byLink"][elena_link], before["byLink"][elena_link] + 1)
        self.assertEqual(after["unassigned"], before["unassigned"] + 1)
        self.assertEqual(after["total"], before["total"] + 4)
        self.assertEqual(after["total"], sum(after["byLink"].values()) + after["unassigned"])

    def test_marking_one_or_all_read_touches_only_their_own_updates(self):
        mine = self.add_note(self.ravi_id, "visit_prep_caregiver", self.ep, params={"name": "Sarah", "when": "01-01-2027 10:00"})
        hers = self.add_note(self.sarah_id, "visit_prep_added", self.ep, params={"when": "01-01-2027 10:00"})
        patient_unread = self.call("GET", "/api/v2/patient/updates/unread-summary", "patient")["total"]
        before = self.call("GET", f"{CG}/updates-summary", "ravi")["total"]
        shown = self.call("PATCH", f"{CG}/notifications/{mine}/read", "ravi")
        self.assertTrue(shown["isRead"])
        self.assertEqual(self.call("GET", f"{CG}/updates-summary", "ravi")["total"], before - 1)
        self.call("PATCH", f"{CG}/notifications/{hers}/read", "ravi", expected=404)  # hers: not theirs to touch
        self.call("PATCH", f"{CG}/notifications/{mine}/read", "patient", expected=403)
        self.call("PATCH", f"{CG}/notifications/does-not-exist/read", "ravi", expected=404)
        self.add_note(self.ravi_id, "visit_prep_caregiver", self.ep, params={"name": "Sarah", "when": "05-01-2027 10:00"})
        after = self.call("POST", f"{CG}/notifications/read-all", "ravi")
        self.assertEqual(after["total"], 0)
        self.assertEqual(self.call("GET", f"{CG}/updates-summary", "ravi")["total"], 0)
        self.assertEqual(self.call("GET", "/api/v2/patient/updates/unread-summary", "patient")["total"], patient_unread)  # her unread are untouched
        self.call("POST", f"{CG}/notifications/read-all", "patient", expected=403)

    def test_each_update_says_which_woman_it_is_about_and_where_it_leads_only_if_she_allowed_that_page(self):
        elena_link = self.second_woman()
        reminder = self.add_note(self.ravi_id, "reminder_due_caregiver", self.ep, params={"name": "Sarah"})
        prep = self.add_note(self.ravi_id, "visit_prep_caregiver", self.ep, params={"name": "Sarah", "when": "01-01-2027 10:00"})
        removed = self.add_note(self.ravi_id, "caregiver_removed", self.ep)
        elena = self.add_note(self.ravi_id, "reminder_due_caregiver", self.elena_ep, params={"name": "Elena"})
        nudge = self.plain_note(self.ravi_id, "Daily check-in reminder", "A check-in is waiting.", self.ep, "assistant_reminder")
        unknown = self.plain_note(self.ravi_id, "Something else", "Nothing to open.", self.ep, "something_else")
        loose = self.add_note(self.ravi_id, "helper_asked_caregiver", None, params={"name": "Sarah", "doctor": "Dr"})

        def listed():
            return {n["id"]: n for n in self.call("GET", f"{CG}/notifications", "ravi")}

        rows = listed()
        self.assertEqual(rows[reminder]["link"], "/caregiver/reminders")
        self.assertEqual(rows[prep]["link"], "/caregiver/appointments")
        self.assertEqual(rows[removed]["link"], "/caregiver/home")
        self.assertEqual(rows[nudge]["link"], "/caregiver/check-in")
        self.assertIsNone(rows[unknown]["link"])
        self.assertEqual(rows[loose]["link"], "/caregiver/home")
        self.assertEqual((rows[reminder]["linkId"], rows[reminder]["womanName"]), (self.ravi_link, self.patient_name))
        self.assertEqual((rows[elena]["linkId"], rows[elena]["womanName"]), (elena_link, "Elena Rostova"))
        self.assertEqual(rows[elena]["link"], "/caregiver/reminders")  # Elena allowed reminders
        self.assertIsNone(rows[loose]["linkId"])
        self.assertIs(rows[reminder]["isRead"], False)
        self.assertTrue(rows[reminder]["title"] and rows[reminder]["createdAt"])

        # she turns pages off: the button goes, the update stays
        self.set_link(permissions={**ALL_ON, "reminders": False, "appointments": False, "check_in": False})
        rows = listed()
        for note_id in (reminder, prep, nudge):
            self.assertIsNone(rows[note_id]["link"], note_id)
        self.assertEqual(rows[removed]["link"], "/caregiver/home")
        self.assertEqual(rows[elena]["link"], "/caregiver/reminders")  # a different woman's choice
        # after the end date she set, no page opens (but Home is always theirs to open)
        self.set_link(permissions=dict(ALL_ON), access_until=naive(utcnow() - timedelta(days=1)))
        self.assertIsNone(listed()[reminder]["link"])

    def test_the_link_rules_in_one_place(self):
        link = models.CaregiverLink(episode_id=self.ep, patient_user_id=self.sarah_id, display_name="X", permissions={"reminders": True}, status="ACTIVE")
        note = models.Notification(recipient_user_id=self.ravi_id, episode_id=self.ep, type="reminder_due_caregiver", title="t", body="b", message_key="reminder_due_caregiver")
        self.assertEqual(caregiver_update_links.link_for(note, link), "/caregiver/reminders")
        self.assertIsNone(caregiver_update_links.link_for(note, None))  # no current link for that woman
        link.permissions = {}
        self.assertIsNone(caregiver_update_links.link_for(note, link))
        link.status = "REVOKED"
        link.permissions = {"reminders": True}
        self.assertIsNone(caregiver_update_links.link_for(note, link))
        gone = models.Notification(recipient_user_id=self.ravi_id, episode_id=self.ep, type="caregiver_removed", title="t", body="b", message_key="caregiver_removed")
        self.assertEqual(caregiver_update_links.link_for(gone, None), "/caregiver/home")
        # every key a trusted person is sent has a page, or is deliberately without one
        for key, (page, permission) in caregiver_update_links.BY_KEY.items():
            self.assertIn(key, server_text.CATALOG)
            self.assertTrue(page.startswith("/caregiver/"))
            self.assertIn(permission, (None, *PERMISSIONS))


# =============================================================================== 4. profile: their own password
class ProfileSecurityTests(HomeBase):
    def change(self, key, current, new):
        return self.client.post("/api/auth/change-password", headers=self.headers[key], json={"currentPassword": current, "newPassword": new, "confirmPassword": new})

    def test_a_trusted_person_changes_their_password_and_other_devices_are_signed_out(self):
        link, key, email = self.new_helper()
        old = dict(self.headers[key])
        self.assertEqual(self.change(key, "not-the-password", NEW_PASSWORD).status_code, 400)
        self.assertEqual(self.change(key, PASSWORD, PASSWORD).status_code, 400)  # must be different
        done = self.change(key, PASSWORD, NEW_PASSWORD)
        self.assertEqual(done.status_code, 200, done.text)
        self.headers[key] = {"Authorization": "Bearer " + done.json()["accessToken"]}
        self.assertEqual(self.client.get(f"{CG}/women", headers=old).status_code, 401)  # the old sign-in stopped working
        self.assertEqual(len(self.call("GET", f"{CG}/women", key)), 1)  # this one stays signed in
        self.assertEqual(self.client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": email, "password": NEW_PASSWORD}).status_code, 200)

        other = self.client.post("/api/auth/login", json={"email": email, "password": NEW_PASSWORD}).json()["accessToken"]  # another phone
        signed_out = self.client.post("/api/auth/sign-out-other-devices", headers=self.headers[key])
        self.assertEqual(signed_out.status_code, 200)
        self.assertEqual(self.client.get(f"{CG}/women", headers={"Authorization": "Bearer " + other}).status_code, 401)
        self.headers[key] = {"Authorization": "Bearer " + signed_out.json()["accessToken"]}
        self.call("GET", f"{CG}/women", key)
        with SessionLocal() as db:
            actions = {r.action for r in db.query(models.AuditLog).filter_by(actor_role="caregiver").all()}
        self.assertTrue({"password_changed", "other_devices_signed_out"} <= actions)

    def test_the_demonstration_caregiver_password_cannot_be_changed(self):
        refused = self.change("ravi", DEMO_CAREGIVER["password"], NEW_PASSWORD)
        self.assertEqual(refused.status_code, 403)
        self.assertIn("demonstration", refused.json()["detail"])
        self.call("GET", f"{CG}/women", "ravi")  # and nothing was signed out


if __name__ == "__main__":
    unittest.main()
