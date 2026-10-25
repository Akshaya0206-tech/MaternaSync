"""A doctor working with the woman's trusted people: the read-only "trusted people" view, asking one of them to help with check-ins, the
visit-preparation checklist, and reminders shown to a trusted person as prompts. Same isolated synthetic database as the other tests;
every test removes what it made so the other modules see the database as they expect."""
import json
import unittest
from datetime import datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import caregiver_service, models, server_text
from backend.app.ai_coordinator import orchestrator
from backend.app.security import hash_password
from backend.app.database import SessionLocal
from backend.app.seed_assistant import DEMO_CAREGIVER

from test_assistant_caregiver import Base

CG = "/api/v2/caregiver"
MINE = "/api/v2/patient/caregivers"
ROOT = "/api/v2/continuity"
MY_KEYS = ("visit_prep_added", "visit_prep_caregiver", "helper_asked_her", "helper_asked_caregiver", "helper_ended_caregiver", "caregiver_helper_yes", "caregiver_helper_no",
           "reminder_due_caregiver")
FULL = {"appointments": True, "check_in": True, "care_plan": True, "reminders": True, "questions": True, "emergency": True}


def utcnow():
    return datetime.now(timezone.utc)


def naive(moment):
    return moment.replace(tzinfo=None)


class PartnerBase(Base):
    def setUp(self):
        self.visits, self.extra_links, self.extra_users, self.reminders = [], [], [], []
        self.addCleanup(self.clean_up)
        self.set_ravi(FULL)

    def clean_up(self):
        with SessionLocal() as db:
            db.query(models.CheckInHelper).filter_by(episode_id=self.ep).delete()
            for visit_id in self.visits:
                db.query(models.VisitPrepItem).filter_by(appointment_id=visit_id).delete()
                appt = db.get(models.Appointment, visit_id)
                if appt is not None:
                    db.delete(appt)
            for reminder_id in self.reminders:
                db.query(models.Notification).filter_by(related_entity_type="CareReminder", related_entity_id=reminder_id).delete()
                reminder = db.get(models.CareReminder, reminder_id)
                if reminder is not None:
                    db.delete(reminder)
            for link_id in self.extra_links:
                db.query(models.CheckInHelper).filter_by(link_id=link_id).delete()
                link = db.get(models.CaregiverLink, link_id)
                if link is not None:
                    db.delete(link)
            for user_id in self.extra_users:
                db.query(models.Notification).filter_by(recipient_user_id=user_id).delete()
                user = db.get(models.User, user_id)
                if user is not None:
                    db.delete(user)
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is not None:
                plan.active = False
            db.query(models.Notification).filter(models.Notification.message_key.in_(list(MY_KEYS))).delete(synchronize_session=False)
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
            db.query(models.AIRun).filter(models.AIRun.trigger_key.like(f"missed_checkin:{self.ep}:%")).delete(synchronize_session=False)
            db.query(models.AIRun).filter(models.AIRun.trigger_key.like("fake-nudge-%")).delete(synchronize_session=False)
            db.query(models.Notification).filter(models.Notification.episode_id == self.ep, models.Notification.type == "assistant_reminder").delete(synchronize_session=False)
            db.commit()
        self.restore_ravi()
        self.call("PATCH", f"{ROOT}/preferences", "patient", {"language": "en"})

    # ---- helpers
    def set_ravi(self, permissions):
        with SessionLocal() as db:
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.status, link.revoked_at, link.access_until, link.permissions = "ACTIVE", None, None, dict(permissions)
            db.commit()

    def upcoming_visit(self, hours=72, status="scheduled"):
        with SessionLocal() as db:
            appt = models.Appointment(episode_id=self.ep, scheduled_at=naive(utcnow() + timedelta(hours=hours)), appointment_type="Antenatal visit", status=status,
                                      location="City Women's Hospital, 4 Lake Road, Chennai")
            db.add(appt)
            db.commit()
            self.visits.append(appt.id)
            return appt.id

    def release(self, visit, lines, expected=200):
        return self.call("POST", f"{ROOT}/episodes/{self.ep}/visit-prep", "doctor", {"appointmentId": visit, "items": lines}, expected=expected)

    def keys_for(self, user_id):
        with SessionLocal() as db:
            return [n.message_key for n in db.query(models.Notification).filter_by(recipient_user_id=user_id).order_by(models.Notification.created_at).all()]

    def ravi_user(self):
        with SessionLocal() as db:
            return db.query(models.User).filter_by(email=DEMO_CAREGIVER["email"]).first().id

    def second_helper(self, permissions=None, name="Meena"):
        """A second trusted person for the same woman, with a login of their own."""
        with SessionLocal() as db:
            user = models.User(full_name=f"{name} Kumar", email=f"{name.lower()}.kumar.partner@example.org", password_hash=hash_password("Whatever123!"), role="caregiver")
            db.add(user)
            db.flush()
            link = models.CaregiverLink(episode_id=self.ep, patient_user_id=self.sarah_id, caregiver_user_id=user.id, display_name=name, relationship="sister",
                                        permissions=permissions or {"appointments": True, "check_in": True}, status="ACTIVE", accepted_at=utcnow())
            db.add(link)
            db.commit()
            self.extra_users.append(user.id)
            self.extra_links.append(link.id)
            return link.id, user.id

    def lapse_in_check_ins(self, earlier_nudges=0):
        """She has not filled in a check-in for five days. `earlier_nudges` earlier reminders already went out for this lapse."""
        with SessionLocal() as db:
            plan = db.get(models.MonitoringPlan, self.ep)
            if plan is None:
                plan = models.MonitoringPlan(episode_id=self.ep, interval_days=1, active=True, owner_user_id=self.doctor_id)
                db.add(plan)
            plan.active, plan.interval_days, plan.agreed_at = True, 1, naive(utcnow() - timedelta(days=5))
            db.query(models.DailyLog).filter_by(episode_id=self.ep).delete()
            db.query(models.AIAction).filter(models.AIAction.idempotency_key.like(f"checkin:{self.ep}:%")).delete(synchronize_session=False)
            db.query(models.AIRun).filter(models.AIRun.trigger_key.like(f"missed_checkin:{self.ep}:%")).delete(synchronize_session=False)
            db.query(models.Notification).filter(models.Notification.episode_id == self.ep, models.Notification.type == "assistant_reminder").delete(synchronize_session=False)
            for number in range(earlier_nudges):
                db.add(models.AIRun(workflow="missed_checkin", episode_id=self.ep, source_type="MonitoringPlan", source_id=self.ep, trigger_key=f"fake-nudge-{number}",
                                    status="DONE", created_at=naive(utcnow() - timedelta(hours=number + 1))))
            db.commit()

    def nudged(self):
        with SessionLocal() as db:
            return {n.recipient_user_id for n in db.query(models.Notification).filter_by(type="assistant_reminder", episode_id=self.ep).all()}

    def due_reminder(self, kind, title, instructions="", hours_ago=1, status="pending"):
        with SessionLocal() as db:
            reminder = models.CareReminder(episode_id=self.ep, kind=kind, title=title, instructions=instructions, scheduled_at=naive(utcnow() - timedelta(hours=hours_ago)),
                                           source_id="x", created_by_user_id=self.doctor_id, approved_by_user_id=self.doctor_id, status=status,
                                           responded_at=naive(utcnow()) if status != "pending" else None)
            db.add(reminder)
            db.commit()
            self.reminders.append(reminder.id)
            return reminder.id


# =============================================================================== the doctor's read-only view of her trusted people
class TrustedPeopleViewTests(PartnerBase):
    def test_a_doctor_sees_who_helps_her_and_what_she_allows_but_nothing_that_could_be_used_to_join(self):
        listed = self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")
        ravi = next(p for p in listed["items"] if p["linkId"] == self.ravi_link)
        self.assertEqual(ravi["permissions"], FULL)
        self.assertTrue(ravi["canAskToHelp"])
        self.assertIsNone(ravi["checkInHelper"])
        self.assertIn("reminders", listed["permissions"])
        text = json.dumps(listed).lower()
        for secret in ("code", "hash", "password", "email", "phone", "number"):
            self.assertNotIn(secret, text, secret)

    def test_only_the_woman_can_change_it_and_only_the_doctor_of_this_woman_can_look(self):
        path = f"{ROOT}/episodes/{self.ep}/trusted-people"
        self.call("GET", path, "patient", expected=403)
        self.call("GET", path, "ravi", expected=403)
        self.assertIn(self.client.get(path, headers=self.headers["other_doctor"]).status_code, (403, 404))  # a doctor who is not hers
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            self.assertEqual(self.client.request(method, path, headers=self.headers["doctor"], json={}).status_code, 405, method)

    def test_the_view_reflects_what_she_switches_off_and_an_ended_access(self):
        self.set_ravi({**FULL, "check_in": False})
        ravi = next(p for p in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"] if p["linkId"] == self.ravi_link)
        self.assertFalse(ravi["permissions"]["check_in"])
        self.assertFalse(ravi["canAskToHelp"])
        with SessionLocal() as db:
            db.get(models.CaregiverLink, self.ravi_link).access_until = naive(utcnow() - timedelta(days=1))
            db.commit()
        ravi = next(p for p in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"] if p["linkId"] == self.ravi_link)
        self.assertTrue(ravi["ended"])
        self.assertFalse(ravi["canAskToHelp"])

    def test_a_removed_person_is_not_listed(self):
        link_id, _ = self.second_helper()
        self.assertIn(link_id, [p["linkId"] for p in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"]])
        self.call("DELETE", f"{MINE}/{link_id}", "patient")
        self.assertNotIn(link_id, [p["linkId"] for p in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"]])


# =============================================================================== asking a trusted person to help with check-ins
class CheckInHelperTests(PartnerBase):
    ask = lambda self, link, expected=200, who="doctor": self.call("PUT", f"{ROOT}/episodes/{self.ep}/checkin-helper", who, {"linkId": link}, expected=expected)  # noqa: E731

    def test_asking_tells_her_and_the_person_and_is_audited_and_shown_to_both(self):
        asked = self.ask(self.ravi_link)
        self.assertEqual(asked["status"], "ASKED")
        self.assertIn("helper_asked_her", self.keys_for(self.sarah_id))
        self.assertIn("helper_asked_caregiver", self.keys_for(self.ravi_user()))
        with SessionLocal() as db:
            row = db.query(models.AuditLog).filter_by(episode_id=self.ep, action="checkin_helper_asked").order_by(models.AuditLog.timestamp.desc()).first()
            self.assertEqual((row.actor_role, row.details), ("doctor", DEMO_CAREGIVER["display_name"]))
        ravi = next(p for p in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"] if p["linkId"] == self.ravi_link)
        self.assertEqual(ravi["checkInHelper"], "ASKED")
        home = self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi")
        self.assertEqual(home["checkInHelper"]["status"], "ASKED")
        self.assertTrue(home["checkInHelper"]["askedBy"])
        woman = next(p for p in self.call("GET", MINE, "patient")["items"] if p["id"] == self.ravi_link)
        self.assertEqual(woman["checkInHelper"], "ASKED")
        body = next(n["body"] for n in self.call("GET", "/api/v2/patient/updates", "patient") if n["title"].startswith("Your doctor asked Ravi"))
        self.assertIn("can say yes or no", body)

    def test_asking_again_changes_nothing_and_tells_nobody_twice(self):
        self.ask(self.ravi_link)
        before = self.keys_for(self.sarah_id).count("helper_asked_her")
        self.ask(self.ravi_link)
        self.assertEqual(self.keys_for(self.sarah_id).count("helper_asked_her"), before)

    def test_only_someone_she_already_allows_to_do_check_ins_can_be_asked(self):
        self.set_ravi({**FULL, "check_in": False})
        self.ask(self.ravi_link, expected=409)
        self.set_ravi(FULL)
        with SessionLocal() as db:
            db.get(models.CaregiverLink, self.ravi_link).access_until = naive(utcnow() - timedelta(days=1))
            db.commit()
        self.ask(self.ravi_link, expected=400)
        self.set_ravi(FULL)
        with SessionLocal() as db:
            elena = db.query(models.CaregiverLink).filter_by(episode_id=self.elena_ep).first()
            elena_link = elena.id if elena else None
        if elena_link:
            self.ask(elena_link, expected=400)  # another woman's trusted person
        self.ask("not-a-link", expected=400)
        self.ask(self.ravi_link, who="patient", expected=403)
        self.ask(self.ravi_link, who="ravi", expected=403)
        self.assertIsNone(self.client.get(f"{CG}/{self.ravi_link}/home", headers=self.headers["ravi"]).json().get("checkInHelper"))

    def test_the_person_can_say_yes_or_no_and_she_is_told_each_change(self):
        self.ask(self.ravi_link)
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "ACCEPTED"})
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "ACCEPTED"})  # the same answer again
        self.assertEqual(self.keys_for(self.sarah_id).count("caregiver_helper_yes"), 1)
        self.assertEqual(next(p for p in self.call("GET", f"{ROOT}/episodes/{self.ep}/trusted-people", "doctor")["items"] if p["linkId"] == self.ravi_link)["checkInHelper"], "ACCEPTED")
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "DECLINED"})
        self.assertEqual(self.keys_for(self.sarah_id).count("caregiver_helper_no"), 1)
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "MAYBE"}, expected=422)
        with SessionLocal() as db:
            self.assertTrue(db.query(models.AuditLog).filter_by(episode_id=self.ep, action="caregiver_helper_answered", actor_role="caregiver").count() >= 2)

    def test_a_person_nobody_asked_cannot_answer_and_neither_can_one_without_the_permission(self):
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "ACCEPTED"}, expected=404)
        self.ask(self.ravi_link)
        self.set_ravi({**FULL, "check_in": False})
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "ACCEPTED"}, expected=403)

    def test_the_doctor_can_withdraw_the_request_and_the_person_is_told(self):
        self.ask(self.ravi_link)
        self.call("DELETE", f"{ROOT}/episodes/{self.ep}/checkin-helper", "doctor")
        self.assertIn("helper_ended_caregiver", self.keys_for(self.ravi_user()))
        self.assertIsNone(self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi").get("checkInHelper"))
        self.call("DELETE", f"{ROOT}/episodes/{self.ep}/checkin-helper", "doctor")  # nothing left to clear, still fine

    def test_the_helpers_missed_check_in_reminder_comes_first_and_the_others_join_from_the_third(self):
        other_link, other_user = self.second_helper()
        ravi = self.ravi_user()
        self.lapse_in_check_ins()
        orchestrator.run_sweeps()
        self.assertTrue({self.sarah_id, ravi, other_user} <= self.nudged(), "with nobody named, everyone allowed is reminded")
        self.ask(self.ravi_link)
        self.lapse_in_check_ins()
        orchestrator.run_sweeps()
        self.assertIn(self.sarah_id, self.nudged())
        self.assertIn(ravi, self.nudged())
        self.assertNotIn(other_user, self.nudged(), "the named helper is reminded first, so the others are not yet")
        self.lapse_in_check_ins(earlier_nudges=2)
        orchestrator.run_sweeps()
        self.assertTrue({ravi, other_user} <= self.nudged(), "from the third reminder on, the others are reminded too")

    def test_a_helper_who_said_no_or_lost_the_permission_changes_nothing_for_the_others(self):
        other_link, other_user = self.second_helper()
        self.ask(self.ravi_link)
        self.call("PUT", f"{CG}/{self.ravi_link}/checkin-helper", "ravi", {"status": "DECLINED"})
        self.lapse_in_check_ins()
        orchestrator.run_sweeps()
        self.assertTrue({self.ravi_user(), other_user} <= self.nudged(), "a 'no' puts everyone back as before")
        self.set_ravi({**FULL, "check_in": True})
        self.call("PUT", f"{ROOT}/episodes/{self.ep}/checkin-helper", "doctor", {"linkId": self.ravi_link})
        self.set_ravi({**FULL, "check_in": False})  # she switches it off: the request no longer counts
        with SessionLocal() as db:
            self.assertIsNone(caregiver_service.helper_link(db, self.ep))
        self.lapse_in_check_ins()
        orchestrator.run_sweeps()
        self.assertIn(other_user, self.nudged())
        self.assertNotIn(self.ravi_user(), self.nudged())

    def test_removing_the_person_removes_the_request(self):
        link_id, _ = self.second_helper()
        self.ask(link_id)
        self.call("DELETE", f"{MINE}/{link_id}", "patient")
        with SessionLocal() as db:
            self.assertIsNone(caregiver_service.helper_link(db, self.ep))


# =============================================================================== the visit-preparation checklist
class VisitPrepTests(PartnerBase):
    def test_a_doctor_writes_the_lines_and_she_and_the_trusted_person_can_tick_them(self):
        visit = self.upcoming_visit()
        shown = self.release(visit, ["Bring your antenatal card", "  Bring   previous   reports ", "Bring your antenatal card"])
        lines = shown[visit]
        self.assertEqual([i["text"] for i in lines], ["Bring your antenatal card", "Bring previous reports"])  # tidied, and no duplicate
        self.assertFalse(any(i["done"] for i in lines))
        # she and Ravi are told
        self.assertIn("visit_prep_added", self.keys_for(self.sarah_id))
        self.assertIn("visit_prep_caregiver", self.keys_for(self.ravi_user()))
        with SessionLocal() as db:
            self.assertGreaterEqual(db.query(models.AuditLog).filter_by(episode_id=self.ep, action="visit_prep_released", actor_role="doctor").count(), 1)
        # both see the same list
        self.assertEqual([i["text"] for i in self.call("GET", f"{MINE}/visit-prep", "patient")[visit]], [i["text"] for i in lines])
        self.assertEqual([i["text"] for i in self.call("GET", f"{CG}/{self.ravi_link}/visit-prep", "ravi")[visit]], [i["text"] for i in lines])
        first, second = lines[0]["id"], lines[1]["id"]
        done = self.call("PUT", f"{CG}/{self.ravi_link}/visit-prep/{first}", "ravi", {"done": True})
        self.assertEqual((done["done"], done["doneByName"], done["doneByRole"]), (True, DEMO_CAREGIVER["name"], "caregiver"))
        self.call("PUT", f"{MINE}/visit-prep/{second}", "patient", {"done": True})
        # the doctor sees who did it
        seen = {i["text"]: i for i in self.call("GET", f"{ROOT}/episodes/{self.ep}/visit-prep", "doctor")[visit]}
        self.assertEqual((seen["Bring your antenatal card"]["done"], seen["Bring your antenatal card"]["doneByRole"]), (True, "caregiver"))
        self.assertEqual(seen["Bring previous reports"]["doneByRole"], "patient")
        # either can take a tick back
        self.call("PUT", f"{MINE}/visit-prep/{first}", "patient", {"done": False})
        self.assertFalse(next(i for i in self.call("GET", f"{MINE}/visit-prep", "patient")[visit] if i["id"] == first)["done"])
        with SessionLocal() as db:  # her trusted person's tick is in the log she can read
            row = db.query(models.AuditLog).filter_by(episode_id=self.ep, action="caregiver_visit_prep_ticked").first()
            self.assertEqual(row.details, "Bring your antenatal card")

    def test_only_a_confirmed_visit_still_to_come_gets_a_checklist(self):
        past = self.upcoming_visit(hours=-5)
        requested = self.upcoming_visit(status="requested")
        self.release(past, ["Bring your card"], expected=400)
        self.release(requested, ["Bring your card"], expected=400)
        self.release("nope", ["Bring your card"], expected=400)

    def test_the_lines_are_checked(self):
        visit = self.upcoming_visit()
        self.release(visit, [], expected=422)
        self.release(visit, ["   "], expected=422)
        self.release(visit, ["x" * 301], expected=422)
        self.release(visit, [f"Item {n}" for n in range(13)], expected=422)

    def test_who_can_do_what(self):
        visit = self.upcoming_visit()
        item = self.release(visit, ["Bring your card"])[visit][0]["id"]
        for who in ("patient", "ravi"):
            self.call("POST", f"{ROOT}/episodes/{self.ep}/visit-prep", who, {"appointmentId": visit, "items": ["x"]}, expected=403)
            self.call("DELETE", f"{ROOT}/visit-prep/{item}", who, expected=403)
        self.assertIn(self.client.post(f"{ROOT}/episodes/{self.ep}/visit-prep", headers=self.headers["other_doctor"], json={"appointmentId": visit, "items": ["x"]}).status_code, (403, 404))
        self.call("PUT", f"{MINE}/visit-prep/{item}", "other_patient", {"done": True}, expected=404)  # not her list
        self.set_ravi({**FULL, "appointments": False})
        self.call("GET", f"{CG}/{self.ravi_link}/visit-prep", "ravi", expected=403)
        self.call("PUT", f"{CG}/{self.ravi_link}/visit-prep/{item}", "ravi", {"done": True}, expected=403)
        self.assertEqual(self.keys_for(self.ravi_user()).count("visit_prep_caregiver"), 1)  # told once, while he could see visits

    def test_a_trusted_person_who_may_not_see_visits_is_not_told(self):
        self.set_ravi({**FULL, "appointments": False})
        before = self.keys_for(self.ravi_user()).count("visit_prep_caregiver")
        self.release(self.upcoming_visit(), ["Bring your card"])
        self.assertEqual(self.keys_for(self.ravi_user()).count("visit_prep_caregiver"), before)

    def test_a_line_can_be_removed_by_the_doctor_and_a_visit_that_has_passed_cannot_be_ticked(self):
        visit = self.upcoming_visit()
        lines = self.release(visit, ["One", "Two"])[visit]
        left = self.call("DELETE", f"{ROOT}/visit-prep/{lines[0]['id']}", "doctor")
        self.assertEqual([i["text"] for i in left[visit]], ["Two"])
        with SessionLocal() as db:
            db.get(models.Appointment, visit).scheduled_at = naive(utcnow() - timedelta(hours=2))
            db.commit()
        self.call("PUT", f"{CG}/{self.ravi_link}/visit-prep/{lines[1]['id']}", "ravi", {"done": True}, expected=409)
        self.assertNotIn(visit, self.call("GET", f"{MINE}/visit-prep", "patient"))  # it is no longer an upcoming visit

    def test_a_second_release_adds_after_the_first_in_order(self):
        visit = self.upcoming_visit()
        self.release(visit, ["First", "Second"])
        again = self.release(visit, ["Third"])
        self.assertEqual([i["text"] for i in again[visit]], ["First", "Second", "Third"])


# =============================================================================== reminders shown to a trusted person as prompts
class ReminderBuddyTests(PartnerBase):
    def test_the_time_and_kind_show_but_a_medicine_or_vaccine_name_does_not_unless_she_also_allows_her_summaries(self):
        self.set_ravi({**FULL, "care_plan": False})
        medicine = self.due_reminder("medicine", "Iron tablets", "Take one with water after food")
        vaccine = self.due_reminder("vaccine", "Tetanus dose")
        visit = self.due_reminder("appointment", "Antenatal visit tomorrow", "Bring your card")
        listed = self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")
        self.assertFalse(listed["detailsAllowed"])
        by_id = {i["id"]: i for i in listed["items"]}
        for reminder_id in (medicine, vaccine):
            item = by_id[reminder_id]
            self.assertTrue(item["detailsHidden"])
            self.assertIsNone(item["title"])
            self.assertIsNone(item["instructions"])
            self.assertIn(item["kind"], ("medicine", "vaccine"))
            self.assertIsNotNone(item["scheduledAt"])
        self.assertEqual(by_id[visit]["title"], "Antenatal visit tomorrow")  # a visit reminder carries no drug
        self.assertIsNone(by_id[visit]["instructions"])  # her doctor's instructions need the summaries permission
        text = json.dumps(listed)
        for hidden in ("Iron tablets", "Tetanus", "Take one with water"):
            self.assertNotIn(hidden, text)
        self.set_ravi(FULL)
        shown = {i["id"]: i for i in self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")["items"]}
        self.assertEqual((shown[medicine]["title"], shown[medicine]["instructions"], shown[medicine]["detailsHidden"]), ("Iron tablets", "Take one with water after food", False))

    def test_how_she_answered_is_never_shown_only_whether_she_has(self):
        done = self.due_reminder("medicine", "Iron tablets", status="skipped")
        needs_help = self.due_reminder("vaccine", "Tetanus dose", status="needs_help")
        waiting = self.due_reminder("appointment", "Visit", hours_ago=2)
        items = {i["id"]: i for i in self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")["items"]}
        self.assertTrue(items[done]["answered"] and items[needs_help]["answered"])
        self.assertFalse(items[waiting]["answered"])
        text = json.dumps(items)
        for word in ("skipped", "needs_help", "status", "done"):
            self.assertNotIn(word, text)

    def test_without_the_reminders_permission_nothing_is_shown_and_no_prompt_is_made(self):
        self.set_ravi({**FULL, "reminders": False})
        reminder = self.due_reminder("medicine", "Iron tablets")
        self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi", expected=403)
        self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi")
        self.call("GET", f"{CG}/notifications", "ravi")
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Notification).filter_by(recipient_user_id=self.ravi_user(), related_entity_id=reminder).count(), 0)

    def test_a_due_reminder_becomes_one_short_note_with_no_names_and_only_once(self):
        reminder = self.due_reminder("medicine", "Iron tablets", "Take one with water after food")
        for _ in range(3):
            self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi")
            self.call("GET", f"{CG}/notifications", "ravi")
            self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")
        with SessionLocal() as db:
            notes = db.query(models.Notification).filter_by(recipient_user_id=self.ravi_user(), related_entity_id=reminder).all()
            self.assertEqual(len(notes), 1)
            self.assertEqual(notes[0].message_key, "reminder_due_caregiver")
        shown = [n for n in self.call("GET", f"{CG}/notifications", "ravi") if n["type"] == "reminder_due_caregiver"]
        self.assertTrue(shown)
        self.assertEqual(shown[0]["title"], "A reminder is due for Sarah")
        self.assertNotIn("Iron", shown[0]["title"] + shown[0]["body"])
        self.assertNotIn("medicine", (shown[0]["title"] + shown[0]["body"]).lower())

    def test_an_old_or_future_reminder_makes_no_note_and_the_list_is_limited(self):
        old = self.due_reminder("appointment", "Long ago", hours_ago=24 * 10)
        future = self.due_reminder("appointment", "Next week", hours_ago=-24 * 7)
        listed = self.call("GET", f"{CG}/{self.ravi_link}/reminders", "ravi")["items"]
        ids = {i["id"] for i in listed}
        self.assertNotIn(old, ids)
        self.assertIn(future, ids)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.Notification).filter(models.Notification.recipient_user_id == self.ravi_user(), models.Notification.related_entity_id.in_([old, future])).count(), 0)

    def test_a_note_is_worded_in_the_readers_language(self):
        self.call("PATCH", f"{CG}/preferences", "ravi", {"language": "ta"})
        try:
            self.due_reminder("appointment", "Visit")
            self.call("GET", f"{CG}/{self.ravi_link}/home", "ravi")
            shown = next(n for n in self.call("GET", f"{CG}/notifications", "ravi") if n["type"] == "reminder_due_caregiver")
            self.assertIn("நினைவூட்டல்", shown["title"])
        finally:
            self.call("PATCH", f"{CG}/preferences", "ravi", {"language": "en"})

    def test_the_permission_is_new_off_by_default_and_hers_to_give(self):
        self.assertIn("reminders", self.call("GET", MINE, "patient")["permissions"])
        invited = self.call("POST", MINE, "patient", {"displayName": "Auntie", "relationship": "aunt", "permissions": {}})
        try:
            self.assertFalse(invited["permissions"]["reminders"])
            changed = self.call("PATCH", f"{MINE}/{invited['id']}", "patient", {"permissions": {"reminders": True}})
            self.assertTrue(changed["permissions"]["reminders"])
        finally:
            self.call("DELETE", f"{MINE}/{invited['id']}", "patient")
            with SessionLocal() as db:
                link = db.get(models.CaregiverLink, invited["id"])
                if link is not None:
                    db.delete(link)
                db.commit()


# =============================================================================== the fixed wording
class WordingTests(unittest.TestCase):
    def test_every_new_message_exists_in_four_languages_and_names_no_medicine(self):
        keys = ("visit_prep_added", "visit_prep_caregiver", "helper_asked_her", "helper_asked_caregiver", "helper_ended_caregiver", "caregiver_helper_yes", "caregiver_helper_no", "reminder_due_caregiver")
        for key in keys:
            for language in server_text.LANGUAGES:
                title, body = server_text.render(key, language, {"name": "Asha", "doctor": "Dr Rao", "when": "03-11-2026 10:30"})
                self.assertTrue(title and body, (key, language))
                self.assertNotIn("{", title + body, (key, language))
                if language == "en":
                    self.assertNotIn("medicine", (title + body).lower())


if __name__ == "__main__":
    unittest.main()
