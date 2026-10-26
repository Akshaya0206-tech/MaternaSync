"""The obstetric additions: the "booking visit" note layout, the new plain-language terms (GCT, NT scan, PROM, PPROM, FGR/IUGR, CPD, PPH and the
G/P/L/A shorthand). Same isolated synthetic database as the other tests; the layout test puts back what it changes."""
import unittest
from types import SimpleNamespace

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from backend.app import models, plain_language as pl
from backend.app.database import SessionLocal

from test_assistant_caregiver import Base

ROOT = "/api/v2/continuity"
TITLE = "Obstetric history (booking visit)"
HEADINGS = ["Patient details", "Gravida, para, LMP, EDD and tetanus vaccination", "Chief complaints", "History of present illness", "History of present pregnancy",
            "Menstrual history", "Marital history", "Past obstetric history", "Past medical and drug history", "Past surgical history", "Family history", "Personal history"]
NEW_TERMS = {"GCT": "glucose challenge test", "NT scan": "early scan that measures the fluid", "PROM": "waters breaking before labour starts", "PPROM": "before 37 weeks",
             "FGR": "growing more slowly", "IUGR": "growing more slowly", "CPD": "pelvis", "PPH": "heavy bleeding after the birth"}


class GlossaryTests(unittest.TestCase):
    def test_every_glossary_entry_has_all_four_languages_and_no_nested_brackets(self):
        for entry in pl.GLOSSARY:
            for language in ("en", "hi", "ta", "te"):
                self.assertTrue(entry.get(language, "").strip(), (entry["aliases"], language))
                self.assertNotIn("(", entry[language], (entry["aliases"], language))  # the meaning is itself put in brackets after the word

    def test_each_new_term_is_explained_once_in_every_language(self):
        for term, fragment in NEW_TERMS.items():
            text, used = pl.explain_terms(f"The note says {term} today and {term} again.", "en")
            self.assertIn(fragment, text, term)
            self.assertEqual(text.count(fragment), 1, term)  # only the first time
            self.assertEqual(len(used), 1, term)
            for language in ("hi", "ta", "te"):
                other, used_other = pl.explain_terms(f"{term} was discussed.", language)
                self.assertIn(dict(used_other)[used[0][0]], other)
                self.assertNotIn(fragment, other)  # in her language, not English

    def test_a_longer_word_is_not_cut_short(self):
        text, used = pl.explain_terms("PPROM at 34 weeks, then PROM later.", "en")
        self.assertEqual([key for key, _ in used], ["PPROM", "PROM"])
        self.assertIn("before 37 weeks", text)
        text, used = pl.explain_terms("The PROMISE study and GCTs", "en")
        self.assertEqual(used, [])  # only the whole word counts

    def test_the_g_p_l_a_shorthand_is_explained_when_it_is_the_count_style_and_left_alone_otherwise(self):
        for written in ("G2P1", "G2 P1", "G2P1L1A0", "G2 P1 L1 A0", "G1P0"):
            text, used = pl.explain_terms(f"Booked: {written}.", "en")
            self.assertEqual([key for key, _ in used], ["G/P/L/A"], written)
            self.assertIn(f"{written} (G = pregnancies", text, written)
        for written in ("G2 P1001", "G2P1001", "Group 2", "GP", "G2"):
            text, used = pl.explain_terms(f"Booked: {written}.", "en")
            self.assertEqual(used, [], written)  # the other common notation has four digits after P and is not a count
            self.assertEqual(text, f"Booked: {written}.", written)
        text, used = pl.explain_terms("G2P1 (two pregnancies, one birth) booked.", "en")
        self.assertEqual(text.count("G = pregnancies"), 0)  # the doctor already explained it in brackets

    def test_the_shorthand_is_not_reported_as_an_unexplained_abbreviation(self):
        text, _ = pl.explain_terms("Booked at G2P1 and G1P0.", "en")
        output = SimpleNamespace(kind="visit_summary", language="en", content="", structured_data={"Discussed": text}, source_snapshot={})
        flagged = [n["text"] for n in pl.review_notes(output) if n["text"].startswith("Abbreviations not explained")]
        self.assertEqual(flagged, [])
        output.structured_data = {"Discussed": "Booked at XQZ."}
        self.assertTrue(any("XQZ" in n["text"] for n in pl.review_notes(output)))  # a real unknown abbreviation is still flagged

    def test_a_visit_summary_lists_the_new_words_under_words_explained_in_her_language(self):
        episode = SimpleNamespace(gestational_age_weeks=30, gestational_age_days=0)
        notes = "Booking visit G2P1L1A0. Earlier PPROM and PPH. NT scan and GCT discussed. FGR and CPD were not found."
        for language in ("en", "hi", "ta", "te"):
            draft = pl.build_visit_summary(kind="visit_summary", language=language, episode=episode, consult_date="01-01-2026",
                                                    approved_content={"documentedDiscussion": notes, "followUpNextSteps": "Return in two weeks."})
            section = draft["structured"][pl.tr("sec_terms", language)]
            for key in ("G/P/L/A", "PPROM", "PPH", "NT scan", "GCT", "FGR", "CPD"):
                self.assertIn(f"{key}: ", section, (language, key))
            self.assertIn(next(e for e in pl.GLOSSARY if "PPROM" in e["aliases"])[language], section)


class BookingVisitLayoutTests(Base):
    def setUp(self):
        self.addCleanup(self.put_back)
        self.made_outputs = []

    def put_back(self):
        with SessionLocal() as db:
            for output_id in self.made_outputs:
                output = db.get(models.ClinicalOutput, output_id)
                if output is not None:
                    db.delete(output)
            row = db.query(models.ClinicalResource).filter_by(family_id="starter-template-" + TITLE).first()
            if row is not None:
                row.status = "DRAFT"
                for column in ("approved_by_user_id", "approved_at"):
                    if hasattr(row, column):
                        setattr(row, column, None)
            db.commit()

    def layout(self):
        return next(r for r in self.call("GET", "/api/v2/library", "doctor") if r["title"] == TITLE)

    def test_it_arrives_as_a_draft_with_only_the_headings_and_nothing_required(self):
        row = self.layout()
        self.assertEqual((row["kind"], row["status"]), ("template", "DRAFT"))
        self.assertEqual(row["configuration"]["fields"], HEADINGS)
        self.assertEqual(row["configuration"]["required"], [])
        self.assertFalse(row["configuration"]["default"])
        self.assertFalse(row["usable"])  # a doctor has to approve it before it can be chosen

    def test_once_a_doctor_approves_it_a_clinical_note_draft_has_every_heading_empty_and_can_be_approved_without_filling_them_all(self):
        row = self.layout()
        self.call("POST", f"/api/v2/library/{row['id']}/approve", "doctor", {"confirmed": True})
        self.assertTrue(self.layout()["usable"])
        workspace = self.call("GET", f"{ROOT}/episodes/{self.ep}", "doctor")
        source = next(s for s in workspace["sources"] if s["type"] == "document")["id"]
        draft = self.call("POST", f"{ROOT}/episodes/{self.ep}/outputs", "doctor", {"kind": "note", "sourceType": "document", "sourceId": source, "templateId": row["id"]})
        self.made_outputs.append(draft["id"])
        self.assertEqual(list(draft["structuredData"]), HEADINGS)
        self.assertTrue(all(value == "" for value in draft["structuredData"].values()))
        for heading in HEADINGS:
            self.assertIn(heading, draft["content"])
        edited = self.call("PATCH", f"{ROOT}/outputs/{draft['id']}", "doctor", {"content": "Booking history recorded by the doctor from the patient and her records.",
                                                                                 "structuredData": {"Patient details": "Recorded by the doctor.", "Family history": "None."},
                                                                                 "selectedCodes": [], "revision": draft["revision"]})
        approved = self.call("POST", f"{ROOT}/outputs/{draft['id']}/approve", "doctor", {"confirmed": True, "revision": edited["revision"]})
        self.assertEqual(approved["status"], "APPROVED")  # ten headings left empty, because none is required


if __name__ == "__main__":
    unittest.main()
