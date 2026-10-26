"""The Emergency help page's clinic side: the hospitals a doctor recommends, the clinic's own name and phone, and the MCP card number a patient can
add for the "Show this to the hospital" card. Same isolated synthetic database as the other tests; each test puts back what it changed."""
import unittest

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

CLINIC = "/api/v2/clinic/emergency"
MINE = "/api/v2/patient/emergency"


class ClinicEmergencyTests(Base):
    def setUp(self):
        self.original_profile = self.call("GET", MINE, "patient")["profile"]
        with SessionLocal() as db:
            self.had_contact = db.get(models.ClinicContact, "clinic") is not None
            self.had_hospitals = db.query(models.ClinicHospital).count()

    def tearDown(self):
        with SessionLocal() as db:
            db.query(models.ClinicHospital).delete()
            contact = db.get(models.ClinicContact, "clinic")
            if contact:
                db.delete(contact)
            db.commit()
        profile = self.original_profile
        self.call("PUT", MINE, "patient", {key: profile[key] for key in ("homeLabel", "homeLat", "homeLon", "contactName", "contactRelation", "contactPhone",
                                                                         "hospitalName", "hospitalPhone", "hospitalAddress", "mcpNumber", "liveLocation")})

    def hospitals(self, who="patient"):
        return self.call("GET", MINE, who)["clinic"]["hospitals"]

    # ---------------------------------------------------------------- who may change it
    def test_only_a_doctor_can_change_what_the_clinic_tells_patients(self):
        for who in ("patient", "ravi", "other_patient"):
            self.call("GET", CLINIC, who, expected=403)
            self.call("PUT", f"{CLINIC}/contact", who, {"clinicName": "Mine", "clinicPhone": "+914412345678"}, expected=403)
            self.call("POST", f"{CLINIC}/hospitals", who, {"name": "A Hospital"}, expected=403)
        self.assertEqual(self.client.get(CLINIC).status_code, 401)
        self.assertEqual(self.hospitals(), [])

    def test_a_doctor_sets_the_clinic_name_and_phone_and_patients_read_them(self):
        result = self.call("PUT", f"{CLINIC}/contact", "doctor", {"clinicName": "  St. Jude Clinic  ", "clinicPhone": "+91 44 2345 6789"})
        self.assertEqual((result["name"], result["phone"]), ("St. Jude Clinic", "+91 44 2345 6789"))
        mine = self.call("GET", MINE, "patient")
        self.assertEqual((mine["clinic"]["name"], mine["clinic"]["phone"]), ("St. Jude Clinic", "+91 44 2345 6789"))
        self.assertEqual(self.call("GET", MINE, "other_patient")["clinic"]["name"], "St. Jude Clinic")  # the clinic's, not hers alone
        cleared = self.call("PUT", f"{CLINIC}/contact", "doctor", {"clinicName": "", "clinicPhone": ""})
        self.assertEqual((cleared["name"], cleared["phone"]), (None, None))

    def test_a_clinic_phone_must_look_like_a_phone_number(self):
        self.call("PUT", f"{CLINIC}/contact", "doctor", {"clinicName": "X", "clinicPhone": "call us!"}, expected=422)
        self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": "Hospital", "phone": "12"}, expected=422)

    # ---------------------------------------------------------------- the hospitals
    def test_a_doctor_adds_changes_and_removes_hospitals_and_the_patient_sees_each_change(self):
        added = self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": "City Maternity Hospital", "address": "4 Lake Road, Chennai", "phone": "+91 44 2222 3333",
                                                                     "note": "Maternity ward, open all day"})["hospitals"]
        self.assertEqual(len(added), 1)
        hospital = added[0]
        self.assertEqual((hospital["name"], hospital["address"], hospital["phone"], hospital["note"]), ("City Maternity Hospital", "4 Lake Road, Chennai", "+91 44 2222 3333", "Maternity ward, open all day"))
        self.assertEqual(self.hospitals(), added)
        self.assertEqual(self.hospitals("other_patient"), added)

        changed = self.call("PATCH", f"{CLINIC}/hospitals/{hospital['id']}", "doctor", {"name": "City Maternity Hospital", "address": None, "phone": "+91 44 9999 0000", "note": ""})["hospitals"]
        self.assertEqual((changed[0]["address"], changed[0]["phone"], changed[0]["note"]), (None, "+91 44 9999 0000", None))
        self.assertEqual(self.hospitals()[0]["phone"], "+91 44 9999 0000")

        self.call("DELETE", f"{CLINIC}/hospitals/{hospital['id']}", "doctor")
        self.assertEqual(self.hospitals(), [])
        self.call("PATCH", f"{CLINIC}/hospitals/{hospital['id']}", "doctor", {"name": "Gone"}, expected=404)
        self.call("DELETE", f"{CLINIC}/hospitals/{hospital['id']}", "doctor", expected=404)

    def test_a_hospital_needs_a_name_and_the_list_is_kept_short(self):
        self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": " "}, expected=422)
        self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": "H", "bogus": 1}, expected=422)
        for number in range(20):
            self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": f"Hospital {number}"})
        self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": "One too many"}, expected=409)
        self.assertEqual(len(self.hospitals()), 20)
        self.assertEqual([h["name"] for h in self.hospitals()][:3], ["Hospital 0", "Hospital 1", "Hospital 2"])  # in the order the clinic added them

    def test_every_change_is_in_the_audit_log_with_what_it_was_before_and_after(self):
        self.call("PUT", f"{CLINIC}/contact", "doctor", {"clinicName": "Audit Clinic", "clinicPhone": "+914400001111"})
        hospital = self.call("POST", f"{CLINIC}/hospitals", "doctor", {"name": "Audit Hospital", "phone": "+914400002222"})["hospitals"][0]
        self.call("PATCH", f"{CLINIC}/hospitals/{hospital['id']}", "doctor", {"name": "Audit Hospital 2", "phone": "+914400003333"})
        self.call("DELETE", f"{CLINIC}/hospitals/{hospital['id']}", "doctor")
        with SessionLocal() as db:
            rows = db.query(models.AuditLog).filter(models.AuditLog.action.like("clinic_%")).order_by(models.AuditLog.timestamp).all()
            seen = {row.action: row for row in rows if row.object_id in (hospital["id"], "clinic")}
            self.assertEqual({"clinic_contact_changed", "clinic_hospital_added", "clinic_hospital_changed", "clinic_hospital_removed"} - set(seen), set())
            self.assertEqual(seen["clinic_hospital_added"].actor_user_id, self.doctor_id)
            self.assertEqual(seen["clinic_hospital_added"].actor_role, "doctor")
            self.assertIsNone(seen["clinic_hospital_added"].previous_state)
            self.assertEqual(seen["clinic_hospital_changed"].previous_state["name"], "Audit Hospital")
            self.assertEqual(seen["clinic_hospital_changed"].new_state["name"], "Audit Hospital 2")
            self.assertEqual(seen["clinic_hospital_removed"].previous_state["phone"], "+914400003333")
            self.assertIsNone(seen["clinic_hospital_removed"].new_state)
            self.assertEqual(seen["clinic_contact_changed"].new_state, {"name": "Audit Clinic", "phone": "+914400001111"})
            db.query(models.AuditLog).filter(models.AuditLog.action.like("clinic_%")).delete(synchronize_session=False)
            db.commit()

    # ---------------------------------------------------------------- what the card needs
    def test_the_page_carries_what_the_hospital_card_shows_and_nothing_about_her_health(self):
        self.call("PUT", f"{CLINIC}/contact", "doctor", {"clinicName": "Card Clinic", "clinicPhone": "+914455556666"})
        mine = self.call("GET", MINE, "patient")
        self.assertEqual(mine["me"]["name"], "Sarah Jenkins")
        self.assertTrue(mine["me"]["edd"])  # her estimated due date, as the record holds it
        self.assertTrue(mine["clinic"]["doctorName"])  # her own doctor
        self.assertEqual({"profile", "clinic", "me", "region", "numbers", "note"}, set(mine))
        self.assertEqual(set(mine["me"]), {"name", "edd"})
        self.assertEqual({n["number"] for n in mine["numbers"]}, {"112", "108", "102", "181"})
        saved = self.call("PUT", MINE, "patient", {key: mine["profile"][key] for key in ("homeLabel", "homeLat", "homeLon", "liveLocation")} | {"mcpNumber": "MCP 2026/0042"})
        self.assertEqual(saved["clinic"]["name"], "Card Clinic")  # the saved page keeps the clinic's details, so the card stays complete
        self.assertEqual(saved["me"]["name"], "Sarah Jenkins")

    def test_the_mcp_card_number_is_hers_to_add_and_is_not_shown_to_a_trusted_person(self):
        base = {key: self.original_profile[key] for key in ("homeLabel", "homeLat", "homeLon", "liveLocation")}
        saved = self.call("PUT", MINE, "patient", {**base, "mcpNumber": "  MCP-1234 / 5  "})
        self.assertEqual(saved["profile"]["mcpNumber"], "MCP-1234 / 5")
        self.assertEqual(self.call("GET", MINE, "patient")["profile"]["mcpNumber"], "MCP-1234 / 5")
        for bad in ("<script>", "12;34", "x" * 31):
            self.call("PUT", MINE, "patient", {**base, "mcpNumber": bad}, expected=422)
        info = self.call("GET", f"/api/v2/caregiver/{self.ravi_link}/emergency", "ravi")
        self.assertNotIn("mcpNumber", info)
        self.assertNotIn("MCP-1234", str(info))
        self.assertIsNone(self.call("PUT", MINE, "patient", {**base, "mcpNumber": ""})["profile"]["mcpNumber"])

    def test_a_form_that_does_not_send_the_mcp_number_keeps_it(self):
        """The Profile page's location form saves her emergency details without knowing about the card number."""
        base = {key: self.original_profile[key] for key in ("homeLabel", "homeLat", "homeLon", "liveLocation")}
        self.call("PUT", MINE, "patient", {**base, "mcpNumber": "KEEP-ME-9"})
        again = self.call("PUT", MINE, "patient", {**base, "contactName": "Meera", "contactPhone": "+919800000000"})
        self.assertEqual(again["profile"]["mcpNumber"], "KEEP-ME-9")
        self.assertEqual(again["profile"]["contactName"], "Meera")

    def test_the_mcp_number_and_the_clinic_list_are_not_reachable_through_another_patients_page(self):
        base = {key: self.original_profile[key] for key in ("homeLabel", "homeLat", "homeLon", "liveLocation")}
        self.call("PUT", MINE, "patient", {**base, "mcpNumber": "SARAH-ONLY-77"})
        self.assertNotIn("SARAH-ONLY-77", str(self.call("GET", MINE, "other_patient")))
        self.assertNotIn("SARAH-ONLY-77", str(self.call("GET", CLINIC, "doctor")))
        self.assertNotEqual(self.call("GET", MINE, "other_patient")["me"]["name"], "Sarah Jenkins")


if __name__ == "__main__":
    unittest.main()
