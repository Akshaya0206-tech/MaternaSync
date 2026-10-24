"""Guards the hackathon rule "no interpretation of medical data" on the server.

MaternaSync may move a value from a verified report into a draft, beside the range printed on that report. It may not label the
value, compare it with a range, grade a risk or turn it into advice. These tests fail if the server's fixed wording starts to do
that, if the lab explainer's words ever depend on a value, or if anything starts reading a note to pick topics or codes.
The screens are guarded the same way by tests/scope-guard.mjs.
"""
import ast
import inspect
import re
import typing
import unittest
from pathlib import Path

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

APP = Path(__file__).resolve().parents[1] / "app"

FORBIDDEN = {
    "calls a value abnormal": r"\babnormal(ly|ity|ities)?\b",
    "judges a value against a range": r"\b(within|outside|above|below|over|under)( the)? (normal|reference|expected|target|healthy|printed|safe)( range| limits?| values?)?\b|\bout of range\b",
    "risk label": r"\b(high|moderate|low|increased)[- ]risk\b|\bat (high |increased )?risk\b",
    "alarm word": r"\b(concerning|worrying|alarming|dangerous)\b",
    "draws an inference": r"\b(suggests?|suggestive of|indicates?|indicative of|consistent with|likely|probably|may have|might have)\b",
    "diagnosis": r"\bdiagnos(is|ed|es|e|ing|tic)\b",
    "says a value is normal": r"\bnormal(ly)?\b",
}
# A sentence that says the app does NOT do something is a disclaimer: the forbidden word counts as negated when a negation
# sits just before it in the same sentence.
NEGATION = re.compile(r"\b(not|never|no|nor|cannot|without|n't)\b[^.]{0,60}$", re.I)

# (file, pattern the whole text must match, why it is not an interpretation)
ALLOWED = [
    ("ai_coordinator/policy.py", r"^Low-risk administrative step\.$", "the assistant's operational tier for a routine admin step; it grades no patient"),
    ("ai_coordinator/prompts.py", r"^You help a maternity clinic route messages", "the instruction that tells the router to SEND such questions to a doctor, not to answer them"),
    ("automation/handlers.py", r"^(abnormal|normal)$", "a keyword that routes a patient's own message to a doctor; never shown as an answer"),
    ("companion.py", r"^is (it|this) normal$", "a patient's own phrase that the router recognises and hands to a doctor"),
    ("reference_search.py", r"^normal delivery$", "a search term for guideline documents about a type of delivery"),
]
# Synthetic doctor-written demo records. They are data a doctor would have typed, not wording the app produces.
NOT_APP_WORDING = {"seed_role_data.py", "migrations.py"}


def docstring_ids(tree):
    ids = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.body:
            first = node.body[0]
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                ids.add(id(first.value))
    return ids


def violations(text):
    """The rules `text` breaks, ignoring any word a disclaimer negates."""
    found = []
    for name, pattern in FORBIDDEN.items():
        for hit in re.finditer(pattern, text, re.I):
            if not NEGATION.search(text[:hit.start()]):
                found.append(f"{name}: “{hit.group(0)}”")
                break
    return found


class ServerWordingTests(unittest.TestCase):
    def test_fixed_server_wording_never_interprets_a_value(self):
        problems = []
        for path in sorted(APP.rglob("*.py")):
            if "__pycache__" in path.parts or path.name in NOT_APP_WORDING:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            skip = docstring_ids(tree)
            relative = path.relative_to(APP).as_posix()
            for node in ast.walk(tree):
                if not (isinstance(node, ast.Constant) and isinstance(node.value, str)) or id(node) in skip or len(node.value) < 7:
                    continue
                broken = violations(node.value)
                if broken and not any(relative == file and re.search(pattern, node.value, re.I) for file, pattern, _why in ALLOWED):
                    problems.append(f"{relative}:{node.lineno} {broken} :: {node.value[:120]!r}")
        self.assertEqual(problems, [], "server wording interprets or judges a value:\n" + "\n".join(problems))

    def test_the_guard_itself_catches_interpretation(self):
        for sentence in ("Your haemoglobin is below the normal range.", "This result is abnormal.", "This suggests anaemia.",
                         "You are at high risk of preterm birth.", "Systolic is within the target range.", "This is concerning."):
            with self.subTest(sentence=sentence):
                self.assertTrue(violations(sentence))
        for sentence in ("This page does not say whether a result is normal or not.", "They do not give a diagnosis.", "The range printed on your report is shown beside each result."):
            with self.subTest(sentence=sentence):
                self.assertEqual(violations(sentence), [])


class LabExplainerTests(unittest.TestCase):
    """The lab explainer shows each value as printed. Whatever the value, the words around it must not change."""
    LANGUAGES = ("en", "hi", "ta", "te")
    NUMERIC = "Haemoglobin {v} g/dL 11.0 - 14.0\nTSH {v} uIU/mL 0.4 - 4.0\nFasting Blood Sugar {v} mg/dL 70 - 100"
    TEXT = "Blood Group: {v}\nHIV 1 & 2 {v}\nUrine Protein {v}"
    ABOUT = {"hb": {"content": "General note about haemoglobin."}, "tsh": {"content": "General note about TSH."}, "fbs": {"content": "General note about fasting sugar."},
             "bloodgroup": {"content": "General note about blood group."}, "hiv": {"content": "General note about HIV screening."}}

    def build(self, language, template, value, about=None):
        from backend.app.plain_language import build_lab_explanation
        draft = build_lab_explanation(language=language, text=template.format(v=value), document_title="Report", about=about)
        return re.sub(re.escape(value), "<VALUE>", repr(draft))

    def test_words_do_not_depend_on_a_numeric_value(self):
        for language in self.LANGUAGES:
            for about in (None, self.ABOUT):
                with self.subTest(language=language, about=bool(about)):
                    # Far below, inside and far above the printed range: the draft must read identically apart from the value itself.
                    drafts = {self.build(language, self.NUMERIC, value, about) for value in ("1.3", "12.7", "98.4")}
                    self.assertEqual(len(drafts), 1)

    def test_words_do_not_depend_on_a_text_result(self):
        for language in self.LANGUAGES:
            with self.subTest(language=language):
                drafts = {self.build(language, self.TEXT, value, self.ABOUT) for value in ("Positive", "Negative", "Reactive")}
                self.assertEqual(len(drafts), 1)

    def test_a_flag_printed_on_the_report_is_not_repeated(self):
        from backend.app.plain_language import build_lab_explanation
        report = "Haemoglobin 7.9 g/dL 11.0 - 14.0 Low\nTSH 9.1 uIU/mL 0.4 - 4.0 High\nFasting Blood Sugar 130 mg/dL 70 - 100 H"
        for language in self.LANGUAGES:
            with self.subTest(language=language):
                draft = build_lab_explanation(language=language, text=report, document_title="Report")
                body = draft["content"] + "\n" + "\n".join(draft["structured"].values())
                self.assertNotRegex(body, r"\b(Low|High)\b")
                self.assertFalse(re.search(r"\d\s*(g/dL|uIU/mL|mg/dL)?\s*\(.*\)\s*(H|L)\b", body))

    def test_english_draft_uses_no_interpretive_wording(self):
        from backend.app.plain_language import build_lab_explanation
        report = "Haemoglobin 7.9 g/dL 11.0 - 14.0 Low\nTSH 9.1 uIU/mL 0.4 - 4.0 High\nBlood Group: B Positive\nHIV 1 & 2 Non reactive"
        draft = build_lab_explanation(language="en", text=report, document_title="Report", about=self.ABOUT)
        text = "\n".join([draft["title"], draft["content"], *draft["structured"].keys(), *draft["structured"].values(), *draft["notes"]])
        self.assertEqual(violations(text), [])

    def test_a_note_appears_only_when_an_approved_one_is_supplied(self):
        from backend.app.plain_language import build_lab_explanation, tr
        without = build_lab_explanation(language="en", text=self.NUMERIC.format(v="10.8"), document_title="Report")
        self.assertNotIn(tr("sec_measure", "en"), without["structured"])
        self.assertTrue(any("No approved" in note for note in without["notes"]))
        with_note = build_lab_explanation(language="en", text=self.NUMERIC.format(v="10.8"), document_title="Report", about=self.ABOUT)
        self.assertIn("General note about haemoglobin.", with_note["structured"][tr("sec_measure", "en")])


class NothingReadsTheNoteTests(unittest.TestCase):
    def test_patient_explanation_uses_only_the_topics_the_doctor_chose(self):
        from types import SimpleNamespace
        from backend.app.plain_language import build_explanation
        episode = SimpleNamespace(gestational_age_weeks=30, gestational_age_days=0)
        note = {"documentedDiscussion": "Discussed gestational diabetes, high blood pressure and anaemia with the patient today.", "followUpNextSteps": "Return in two weeks."}
        modules = {"Anaemia": {"title": "Anaemia", "content": "Approved anaemia explanation.", "issuer": "Clinic", "version": 1, "reviewer": "Dr A"},
                   "Gestational diabetes": {"title": "Gestational diabetes", "content": "Approved explanation.", "issuer": "Clinic", "version": 1, "reviewer": "Dr A"}}
        none_chosen = build_explanation(language="en", episode=episode, approved_content=note, consult_date="01-01-2026", chosen=[], modules=modules)
        self.assertNotIn("Anaemia", none_chosen["structured"])
        self.assertNotIn("Gestational diabetes", none_chosen["structured"])
        self.assertTrue(any("No topic was chosen" in n for n in none_chosen["notes"]))
        one_chosen = build_explanation(language="en", episode=episode, approved_content=note, consult_date="01-01-2026", chosen=["Anaemia"], modules=modules)
        self.assertIn("Anaemia", one_chosen["structured"])
        self.assertNotIn("Gestational diabetes", one_chosen["structured"])

    def test_code_lookup_takes_a_query_not_a_note(self):
        from backend.app import continuity_service
        self.assertEqual(list(inspect.signature(continuity_service.search_codes).parameters), ["db", "query", "limit"])
        self.assertFalse(hasattr(continuity_service, "suggest_codes"))

    def test_the_old_note_scanning_code_endpoint_is_gone(self):
        from backend.app.main import app
        paths = {getattr(route, "path", "") for route in app.routes}
        self.assertFalse(any(path.endswith("/outputs/{output_id}/codes") for path in paths))
        self.assertTrue(any(path.endswith("/codes/search") for path in paths))

    def test_the_claude_option_can_only_answer_with_fixed_choices(self):
        from backend.app.ai_coordinator.providers import DocumentAnswer, QuestionAnswer
        for schema in (DocumentAnswer, QuestionAnswer):
            for name, field in schema.model_fields.items():
                with self.subTest(schema=schema.__name__, field=name):
                    self.assertNotIn(field.annotation, (str, typing.Optional[str]), "a free-text field would let the model write its own sentence")


if __name__ == "__main__":
    unittest.main()
