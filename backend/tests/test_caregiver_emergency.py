"""A trusted person's Emergency help: the hospital card, the hospitals her clinic recommends, and who is refused. Same isolated synthetic database as the
other tests; every test puts back what it changed."""
import json
import unittest
from datetime import datetime, timedelta, timezone

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import clinic_emergency, models
from backend.app.database import SessionLocal
from backend.app.routers.caregiver_emergency import CARD_FIELDS

from test_assistant_caregiver import Base

CG = "/api/v2/caregiver"
MINE = "/api/v2/patient/caregivers"
PATIENT_EMERGENCY = "/api/v2/patient/emergency"


def utcnow():
    return datetime.now(timezone.utc)


class CaregiverEmergencyTests(Base):
    def setUp(self):
        self.restore_ravi()
        with SessionLocal() as db:
            profile = db.get(models.PatientEmergencyProfile, self.sarah_id)
            self.had_profile = profile is not None
            self.profile_before = {c.name: getattr(profile, c.name) for c in models.PatientEmergencyProfile.__table__.columns} if profile else None
            contact = db.get(models.ClinicContact, clinic_emergency.CLINIC_KEY)
            self.contact_before = (contact.clinic_name, contact.clinic_phone, contact.clinic_hours) if contact else None
            self.hospital_ids_before = {h.id for h in db.query(models.ClinicHospital).all()}
            db.commit()
        self.addCleanup(self.clean_up)

    def clean_up(self):
        with SessionLocal() as db:
            profile = db.get(models.PatientEmergencyProfile, self.sarah_id)
            if self.had_profile:
                for name, value in self.profile_before.items():
                    setattr(profile, name, value)
            elif profile is not None:
                db.delete(profile)
            contact = db.get(models.ClinicContact, clinic_emergency.CLINIC_KEY)
            if self.contact_before is None and contact is not None:
                db.delete(contact)
            elif self.contact_before is not None:
                contact.clinic_name, contact.clinic_phone, contact.clinic_hours = self.contact_before
            for hospital in db.query(models.ClinicHospital).all():
                if hospital.id not in self.hospital_ids_before:
                    db.delete(hospital)
            db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_hospital_card_opened", models.AuditLog.object_id == self.ravi_link).delete()
            db.query(models.CaregiverLink).filter(models.CaregiverLink.episode_id == self.elena_ep, models.CaregiverLink.display_name == "Not Ravi").delete()
            link = db.get(models.CaregiverLink, self.ravi_link)
            link.access_until = None
            db.commit()
        self.restore_ravi()

    # ---- helpers
    def save_emergency_details(self, **fields):
        with SessionLocal() as db:
            profile = db.get(models.PatientEmergencyProfile, self.sarah_id)
            if profile is None:
                profile = models.PatientEmergencyProfile(user_id=self.sarah_id)
                db.add(profile)
            for name, value in fields.items():
                setattr(profile, name, value)
            db.commit()

    def set_clinic(self, phone, name="Test Clinic"):
        with SessionLocal() as db:
            contact = db.get(models.ClinicContact, clinic_emergency.CLINIC_KEY)
            if contact is None:
                contact = models.ClinicContact(key=clinic_emergency.CLINIC_KEY)
                db.add(contact)
            contact.clinic_name, contact.clinic_phone = name, phone
            db.commit()

    def opened_rows(self):
        with SessionLocal() as db:
            return db.query(models.AuditLog).filter_by(action="caregiver_hospital_card_opened", object_id=self.ravi_link).order_by(models.AuditLog.timestamp).all()

    def notes_for_her(self):
        with SessionLocal() as db:
            return db.query(models.Notification).filter_by(recipient_user_id=self.sarah_id).count()

    # ---- the card
    def test_the_hospital_card_holds_exactly_five_things(self):
        self.save_emergency_details(mcp_number="MCP 4471/26", contact_name="Asha Pillai", contact_phone="+919800000001", contact_relation="Sister",
                                    hospital_name="St Mary's", hospital_phone="+914440000000", hospital_address="12 Lake Road", home_label="Adyar")
        self.set_clinic("+914425550100")
        card = self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi")
        self.assertEqual(set(card), set(CARD_FIELDS))
        self.assertEqual(sorted(CARD_FIELDS), sorted(["name", "dueDate", "doctorName", "clinicPhone", "mcpNumber"]))
        self.assertEqual(card["name"], self.patient_name)
        self.assertEqual(card["clinicPhone"], "+914425550100")
        self.assertEqual(card["mcpNumber"], "MCP 4471/26")
        self.assertTrue(card["doctorName"])
        with SessionLocal() as db:
            self.assertEqual(card["dueDate"], db.get(models.PregnancyEpisode, self.ep).edd)

    def test_nothing_else_about_her_leaks_into_the_card(self):
        self.save_emergency_details(mcp_number="MCP 1", contact_name="Asha Pillai", contact_phone="+919800000001", hospital_name="St Mary's",
                                    hospital_address="12 Lake Road", home_label="Adyar", home_lat=13.0, home_lon=80.2)
        text = json.dumps(self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi"))
        for secret in ("Asha Pillai", "+919800000001", "St Mary's", "12 Lake Road", "Adyar", "13.0", self.mrn):
            self.assertNotIn(secret, text)
        for word in ("blood", "allerg", "medicine", "diagnos", "result", "note", "risk"):
            self.assertNotIn(word, text.lower())

    def test_a_missing_value_is_null_and_never_made_up(self):
        self.save_emergency_details(mcp_number=None)
        with SessionLocal() as db:
            contact = db.get(models.ClinicContact, clinic_emergency.CLINIC_KEY)
            if contact is not None:
                contact.clinic_phone = None
                db.commit()
        card = self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi")
        self.assertIsNone(card["mcpNumber"])
        self.assertIsNone(card["clinicPhone"])
        self.assertEqual(set(card), set(CARD_FIELDS))

    # ---- the clinic's hospitals
    def test_the_clinics_hospitals_are_the_list_she_sees_herself(self):
        with SessionLocal() as db:
            db.add(models.ClinicHospital(name="Test Maternity Hospital", address="5 Park Street", phone="+914430000001", note="open all day"))
            db.commit()
        mine = self.call("GET", PATIENT_EMERGENCY, "patient")["clinic"]["hospitals"]
        theirs = self.call("GET", f"{CG}/{self.ravi_link}/clinic-hospitals", "ravi")["hospitals"]
        self.assertEqual(theirs, mine)
        self.assertTrue(any(h["name"] == "Test Maternity Hospital" and h["address"] == "5 Park Street" for h in theirs))

    # ---- who is refused
    def test_each_new_route_needs_the_emergency_permission(self):
        for permissions in ({"appointments": True}, {"appointments": True, "check_in": True, "care_plan": True, "reminders": True, "questions": True, "emergency": False}):
            with SessionLocal() as db:
                db.get(models.CaregiverLink, self.ravi_link).permissions = permissions
                db.commit()
            self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi", expected=403)
            self.call("GET", f"{CG}/{self.ravi_link}/clinic-hospitals", "ravi", expected=403)
            self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {}, expected=403)
        self.assertEqual(self.opened_rows(), [])

    def test_a_removed_person_gets_nothing(self):
        self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi")
        self.call("DELETE", f"{MINE}/{self.ravi_link}", "patient")
        self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi", expected=403)
        self.call("GET", f"{CG}/{self.ravi_link}/clinic-hospitals", "ravi", expected=403)
        self.call("GET", f"{CG}/{self.ravi_link}/emergency", "ravi", expected=403)
        self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {}, expected=403)

    def test_after_the_end_date_the_card_is_refused_too(self):
        with SessionLocal() as db:
            db.get(models.CaregiverLink, self.ravi_link).access_until = (utcnow() - timedelta(hours=1)).replace(tzinfo=None)
            db.commit()
        for path in ("hospital-card", "clinic-hospitals"):
            denied = self.client.get(f"{CG}/{self.ravi_link}/{path}", headers=self.headers["ravi"])
            self.assertEqual(denied.status_code, 403, path)
            self.assertIn("has ended", denied.json()["detail"])
        self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {}, expected=403)

    def test_someone_elses_link_and_other_roles_are_refused(self):
        with SessionLocal() as db:
            other = models.CaregiverLink(episode_id=self.elena_ep, patient_user_id=self.elena_user, caregiver_user_id=self.doctor_id, display_name="Not Ravi",
                                         relationship="", permissions={"emergency": True}, status="ACTIVE")
            db.add(other)
            db.commit()
            other_id = other.id
        for path in ("hospital-card", "clinic-hospitals"):
            self.call("GET", f"{CG}/{other_id}/{path}", "ravi", expected=403)  # a link that belongs to another person
            for who in ("patient", "doctor", "staff"):
                self.call("GET", f"{CG}/{self.ravi_link}/{path}", who, expected=403)  # only a trusted person's login
        self.call("POST", f"{CG}/{other_id}/hospital-card/opened", "ravi", {}, expected=403)
        self.call("GET", f"{CG}/no-such-link/hospital-card", "ravi", expected=403)

    # ---- opening the card is written down for her, but does not ping her
    def test_opening_the_card_is_logged_for_her_without_a_note(self):
        notes = self.notes_for_her()
        self.call("GET", f"{CG}/{self.ravi_link}/hospital-card", "ravi")
        self.assertEqual(self.opened_rows(), [])  # fetching the card so it can be kept on the phone is not opening it
        self.assertEqual(self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {})["recorded"], True)
        rows = self.opened_rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0].actor_role, rows[0].episode_id), ("caregiver", self.ep))
        shown = self.call("GET", f"{MINE}/{self.ravi_link}/activity", "patient")
        self.assertTrue(any(a["title"] == "A trusted person opened the hospital card" for a in shown))
        self.assertEqual(self.notes_for_her(), notes)  # no note to her for a view

    def test_a_double_tap_is_one_row_and_a_late_report_keeps_its_own_time(self):
        self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {})
        again = self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {})
        self.assertFalse(again["recorded"])
        self.assertEqual(len(self.opened_rows()), 1)
        earlier = (utcnow() - timedelta(hours=3)).isoformat()
        self.assertTrue(self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {"at": earlier})["recorded"])
        rows = self.opened_rows()
        self.assertEqual(len(rows), 2)
        self.assertIn("opened on the phone at", rows[-1].details)
        with SessionLocal() as db:
            db.query(models.AuditLog).filter_by(action="caregiver_hospital_card_opened", object_id=self.ravi_link).delete()
            db.commit()
        ancient = (utcnow() - timedelta(days=30)).isoformat()  # too old to trust: written without its own time
        self.assertTrue(self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {"at": ancient})["recorded"])
        self.assertNotIn("opened on the phone at", self.opened_rows()[-1].details)

    def test_the_doctors_audit_trail_knows_the_new_action(self):
        self.call("POST", f"{CG}/{self.ravi_link}/hospital-card/opened", "ravi", {})
        rows = self.call("GET", f"/api/v2/doctor/episodes/{self.ep}/audit-trail?limit=100&kind=trusted", "doctor")["items"]
        mine = [r for r in rows if r["action"] == "caregiver_hospital_card_opened"]
        self.assertTrue(mine)
        self.assertEqual(mine[0]["kind"], "trusted")  # grouped with the other things a trusted person does, not under "other"

    def test_the_numbers_page_still_works_as_before(self):
        info = self.call("GET", f"{CG}/{self.ravi_link}/emergency", "ravi")
        self.assertEqual([n["number"] for n in info["numbers"]], ["112", "108", "102", "181"])
        self.assertIn("contactName", info)


if __name__ == "__main__":
    unittest.main()
