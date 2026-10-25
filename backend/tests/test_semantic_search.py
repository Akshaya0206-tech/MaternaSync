"""Searching the Reference Library by meaning. The model itself is not needed here: a stand-in embedder gives texts about the same thing the
same direction, whatever the language, which is what the real model does and what the search relies on. How well the real model does that
is measured separately by evaluate_semantic_search.py."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import testenv  # noqa: F401: sets the isolated database and settings before the app is imported

from fastapi.testclient import TestClient

from backend.app import config, models, reference_library, reference_search, semantic_search
from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.seed_role_data import PASSWORDS

# Words that mean the same thing to the stand-in embedder: one direction per idea, in English, Hindi, Tamil and Telugu.
IDEAS = [
    ["bleeding", "haemorrhage", "hemorrhage", "रक्तस्राव", "இரத்தப்போக்கு", "రక్తస్రావం"],
    ["glucose", "diabetes", "sugar", "शुगर", "சர்க்கரை", "షుగర్"],
    ["thyroid", "थायराइड", "தைராய்டு", "థైరాయిడ్"],
]


class StandInEmbedder:
    def __init__(self):
        self.asked = []

    def embed(self, texts, kind):
        self.asked.append((kind, list(texts)))
        out = np.zeros((len(texts), semantic_search.DIMENSIONS), np.float32)
        for row, text in enumerate(texts):
            lowered = text.lower()
            for direction, words in enumerate(IDEAS):
                if any(word in lowered for word in words):
                    out[row, direction] = 1.0
            if not out[row].any():  # about nothing in particular: a direction of its own, unlike every idea above and unlike any other such text
                out[row, 100 + int(semantic_search.text_key(text), 16) % 200] = 1.0
        return out / np.linalg.norm(out, axis=1, keepdims=True)


REFERENCE_LIST = ("REFERENCES 1. Kim TH, Lee HH, Kim JM, Ryu AL. Uterine artery embolization for primary postpartum haemorrhage. Iran J Reprod Med. 2012;10:1-9. "
                  "2. Smith AB, Jones C, et al. Haemorrhage after birth. Lancet. 2010;375:100-9. doi:10.1016/S0140-6736(09)61000-0")

# Passages are a short paragraph, and fragments under MIN_PASSAGE_CHARS are not ranked by meaning, so these are written at that length.
PASSAGES = {
    "pph": "A short introduction to the guideline, which sets out who it is written for and how it was prepared. Heavy haemorrhage after birth needs a uterotonic given at once. The next section covers record keeping and audit.",
    "gdm": "Women with diabetes in pregnancy should have a glucose test between 24 and 28 weeks of pregnancy, at a visit that is booked in advance. Repeat the test if it was missed, and record the result in the woman's notes.",
    "plain": "The meeting minutes were circulated to everyone on the working group before the end of the month, together with the agenda for the next meeting and the list of people who had sent their apologies.",
}


class SemanticSearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()
        login = cls.client.post("/api/auth/login", json={"email": "demo@maternasync.app", "password": PASSWORDS["demo@maternasync.app"]}).json()
        cls.headers = {"Authorization": "Bearer " + login["accessToken"]}
        cls.doctor_id = login["user"]["id"]
        with SessionLocal() as db:
            cls.item_ids = {}
            for key, title, topic, summary in [
                ("pph", "Unit protocol: after the birth", "Obstetric emergencies", "What the unit does when a woman is unwell after delivery."),
                ("gdm", "Unit protocol: blood tests", "Screening", "Which tests are done and when."),
            ]:
                item = models.ReferenceItem(owner_user_id=cls.doctor_id, title=title, issuer="Test unit", topic=topic, summary=summary, notes="")
                db.add(item)
                db.flush()
                sequence, counts = reference_search.analyse(PASSAGES[key])
                db.add(models.ReferenceChunk(item_id=item.id, chunk_index=0, page_number=7, section_label="Test", text=PASSAGES[key],
                                             term_freq=dict(counts), token_count=len(sequence)))
                if key == "pph":
                    sequence, counts = reference_search.analyse(REFERENCE_LIST)
                    db.add(models.ReferenceChunk(item_id=item.id, chunk_index=1, page_number=9, section_label=None, text=REFERENCE_LIST,
                                                 term_freq=dict(counts), token_count=len(sequence)))
                cls.item_ids[key] = item.id
            db.commit()
        reference_library.invalidate()

    @classmethod
    def tearDownClass(cls):
        with SessionLocal() as db:
            for item_id in cls.item_ids.values():
                item = db.get(models.ReferenceItem, item_id)
                if item:
                    db.delete(item)
            db.commit()
        reference_library.invalidate()
        semantic_search.reset_for_tests()
        cls.context.__exit__(None, None, None)

    def tearDown(self):
        semantic_search.reset_for_tests()

    def everything_indexed(self):
        texts = {semantic_search.text_key(text): text for text in PASSAGES.values()}
        with SessionLocal() as db:
            for item in db.query(models.ReferenceItem).filter_by(owner_user_id=self.doctor_id).all():
                texts[semantic_search.text_key(semantic_search.item_text(item))] = semantic_search.item_text(item)
        semantic_search.use_for_tests(StandInEmbedder(), texts)

    def search(self, question):
        reply = self.client.get("/api/v2/references", params={"q": question, "mine": "true"}, headers=self.headers)
        self.assertEqual(reply.status_code, 200, reply.text)
        return reply.json()

    # ---------------------------------------------------------------- merging the two searches
    def test_fuse_puts_what_both_searches_found_first_and_names_the_source(self):
        merged = semantic_search.fuse(["a", "b", "c"], ["c", "d"])
        self.assertEqual([ident for ident, _, _ in merged][0], "c")  # near the top of one list and in the other
        self.assertEqual({ident: source for ident, _, source in merged}, {"a": "words", "b": "words", "c": "both", "d": "meaning"})
        self.assertEqual(semantic_search.fuse([], []), [])
        self.assertEqual([i for i, _, s in semantic_search.fuse(["x"], [])], ["x"])

    # ---------------------------------------------------------------- how close is close enough
    def test_a_text_must_clear_the_floor_and_be_near_the_best_one(self):
        vectors = np.zeros((3, semantic_search.DIMENSIONS), np.float32)
        vectors[0, 0] = 1.0                                   # the question's direction exactly
        vectors[1, 0], vectors[1, 1] = 0.9, np.sqrt(1 - 0.81)  # similarity 0.90: close, but more than the margin below the best
        vectors[2, 1] = 1.0                                   # unrelated
        semantic_search.use_for_tests(StandInEmbedder(), None)
        semantic_search._state["index"] = semantic_search.Index(["best", "near", "far"], vectors)
        with patch.object(semantic_search, "_query_vector", return_value=np.eye(semantic_search.DIMENSIONS, dtype=np.float32)[0]):
            found = dict(semantic_search.rank("anything", ["best", "near", "far"], floor=0.8))
            self.assertEqual(list(found), ["best"])           # 0.90 is above the floor but outside the margin of the best (1.0)
            with patch.object(semantic_search, "MARGIN", 0.2):
                self.assertEqual(list(dict(semantic_search.rank("anything", ["best", "near", "far"], floor=0.8))), ["best", "near"])
            # nothing clears the floor: nothing is returned, not the least-bad text
            self.assertEqual(semantic_search.rank("anything", ["best", "near", "far"], floor=1.5), [])

    # ---------------------------------------------------------------- through the API
    def test_the_word_search_alone_cannot_read_hindi_and_marks_its_hits_as_words(self):
        self.assertFalse(semantic_search.enabled())  # the test environment has it off
        self.assertEqual(self.search("प्रसव के बाद रक्तस्राव")["passages"], [])
        reply = self.search("haemorrhage")
        self.assertFalse(reply["semantic"])
        self.assertTrue(reply["passages"] and all(p["matchedBy"] == "words" for p in reply["passages"]))

    def test_a_question_in_hindi_tamil_or_telugu_finds_the_english_passage_and_says_it_was_found_by_meaning(self):
        self.everything_indexed()
        for question in ("प्रसव के बाद रक्तस्राव", "பிரசவத்திற்குப் பிறகு இரத்தப்போக்கு", "ప్రసవం తర్వాత రక్తస్రావం"):
            with self.subTest(question=question):
                reply = self.search(question)
                self.assertTrue(reply["semantic"])
                self.assertEqual([p["itemId"] for p in reply["passages"]], [self.item_ids["pph"]])
                passage = reply["passages"][0]
                self.assertEqual((passage["matchedBy"], passage["page"]), ("meaning", 7))
                self.assertIn(passage["text"], PASSAGES["pph"])  # the document's own words, nothing written
                self.assertIn("haemorrhage", passage["text"])    # the sentence about the question, not the introduction
                self.assertEqual(passage["marks"], [])
                # the reference's own title and summary say nothing about bleeding: it is listed because a passage inside its PDF matched
                self.assertEqual((reply["items"][0]["id"], reply["items"][0]["matchedOn"]), (self.item_ids["pph"], ["pdf"]))

    def test_a_reference_list_is_never_returned_as_a_passage_by_either_search(self):
        for question in ("haemorrhage", "uterine artery embolization"):
            with self.subTest(question=question, meaning=False):
                self.assertTrue(all("REFERENCES 1." not in p["text"] for p in self.search(question)["passages"]))
        self.everything_indexed()
        semantic_search._state["index"] = semantic_search.Index(
            list(semantic_search._state["index"].rows) + [semantic_search.text_key(REFERENCE_LIST)],
            np.vstack([semantic_search._state["index"].matrix, StandInEmbedder().embed([REFERENCE_LIST], "passage")]))  # even if it were in the index
        for question in ("प्रसव के बाद रक्तस्राव", "haemorrhage"):
            with self.subTest(question=question, meaning=True):
                self.assertTrue(all("REFERENCES 1." not in p["text"] and p["page"] != 9 for p in self.search(question)["passages"]))

    def test_a_question_that_both_searches_understand_is_marked_as_both(self):
        self.everything_indexed()
        reply = self.search("haemorrhage after birth")
        self.assertEqual(reply["passages"][0]["matchedBy"], "both")
        self.assertIn("haemorrhage", reply["passages"][0]["text"])

    def test_a_question_with_no_answer_in_the_library_finds_nothing(self):
        self.everything_indexed()
        for question in ("cricket match score", "क्रिकेट मैच का स्कोर", "zzzzqqqq"):
            with self.subTest(question=question):
                reply = self.search(question)
                self.assertEqual((reply["items"], reply["passages"]), ([], []))

    def test_only_the_doctors_own_filtered_shelf_is_searched(self):
        self.everything_indexed()
        reply = self.client.get("/api/v2/references", params={"q": "प्रसव के बाद रक्तस्राव", "category": "NUTRITION", "mine": "true"}, headers=self.headers).json()
        self.assertEqual((reply["items"], reply["passages"]), ([], []))  # the passage matches by meaning, but its reference is outside the filter

    def test_a_reference_added_after_the_index_was_built_is_still_found_by_meaning(self):
        self.everything_indexed()
        with SessionLocal() as db:
            item = models.ReferenceItem(owner_user_id=self.doctor_id, title="Thyroid checks", issuer="Test unit", topic="Endocrine", summary="When to test thyroid function.", notes="")
            db.add(item)
            db.commit()
            new_id = item.id
        try:
            reply = self.search("गर्भावस्था में थायराइड")
            found = {i["id"]: i for i in reply["items"]}
            self.assertIn(new_id, found)  # not in the index file: embedded on the spot
            self.assertEqual(found[new_id]["matchedOn"], ["meaning"])  # its own title and summary are about thyroid, so it is found as a reference
        finally:
            with SessionLocal() as db:
                db.delete(db.get(models.ReferenceItem, new_id))
                db.commit()

    # ---------------------------------------------------------------- small guarantees
    def test_a_doctors_private_notes_are_never_part_of_what_is_embedded(self):
        item = models.ReferenceItem(title="Title", topic="Topic", summary="Summary", notes="private words nobody should embed", tags=["secret tag"])
        self.assertEqual(semantic_search.item_text(item), "Title. Topic. Summary")

    def test_the_index_keeps_what_it_has_and_only_embeds_new_texts(self):
        embedder = StandInEmbedder()
        semantic_search.use_for_tests(embedder, None)
        with tempfile.TemporaryDirectory() as folder, patch.object(semantic_search, "INDEX_FILE", Path(folder) / "index.npz"):
            first = semantic_search.build_index({"a": "haemorrhage text", "b": "diabetes text"}, progress=lambda _: None)
            self.assertEqual((first["texts"], first["new"], first["kept"]), (2, 2, 0))
            embedder.asked.clear()
            second = semantic_search.build_index({"a": "haemorrhage text", "b": "diabetes text", "c": "thyroid text"}, progress=lambda _: None)
            self.assertEqual((second["texts"], second["new"], second["kept"]), (3, 1, 2))
            self.assertEqual([texts for _, texts in embedder.asked], [["thyroid text"]])  # only the new one went through the model
            third = semantic_search.build_index({"a": "haemorrhage text"}, progress=lambda _: None)  # a text that went away drops out
            self.assertEqual(third["texts"], 1)
            keys, vectors = semantic_search.read_index_file()
            self.assertEqual((keys, vectors.shape), (["a"], (1, semantic_search.DIMENSIONS)))

    def test_the_library_is_taken_to_answer_a_question_only_on_strong_evidence(self):
        gate = semantic_search.PASSAGE_GATE
        self.assertFalse(semantic_search.confident([], []))
        self.assertFalse(semantic_search.confident([], [("p", gate - 0.01)]))      # one passage that is close, but not close enough to trust alone
        self.assertTrue(semantic_search.confident([], [("p", gate)]))              # one passage that is very close
        self.assertTrue(semantic_search.confident([("item", 0.81)], [("p", 0.83)]))  # a reference matched by its title and summary: the passages may be listed
        self.assertLess(semantic_search.PASSAGE_FLOOR, gate)                        # listing goes lower than trusting

    def test_the_setting_off_switches_it_off_and_an_unknown_value_means_off(self):
        with patch.object(semantic_search, "installed", return_value=True):
            with patch.object(config, "SEMANTIC_SEARCH", "auto"):
                self.assertTrue(semantic_search.enabled())
            with patch.object(config, "SEMANTIC_SEARCH", "off"):
                self.assertFalse(semantic_search.enabled())
        with patch.object(semantic_search, "installed", return_value=False):
            with patch.object(config, "SEMANTIC_SEARCH", "auto"):
                self.assertFalse(semantic_search.enabled())  # not installed: the word search carries on alone

    def test_a_text_is_filed_under_the_same_name_however_it_is_padded(self):
        self.assertEqual(semantic_search.text_key("same words"), semantic_search.text_key("  same words \n"))
        self.assertNotEqual(semantic_search.text_key("same words"), semantic_search.text_key("other words"))


class BoilerplateTests(unittest.TestCase):
    """Reference lists, licence pages and journal headers are full of the subject's words; they are recognised by how they look."""

    def test_reference_lists_licence_pages_and_journal_headers_are_recognised(self):
        for text in (
            "12. Smith AB, Jones C. Postpartum haemorrhage. Lancet. 2010;375:100-9. 13. Lee K, Kim H. Uterotonics in labour. BJOG. 2012;119:10-15.",
            "\u00a9 World Health Organization 2018. Some rights reserved. This work is available under the Creative Commons Attribution licence.",
            "Int J Gynecol Obstet. 2025;171:933-950. wileyonlinelibrary.com/journal/ijgo Received: 30 June 2025 | Accepted: 22 August 2025",
            "36. Langlois EV, Miszkurka M, Zunzunegui MV. Inequities in postnatal care. Bull World Health Organ. 2015;93:259-70G. doi:10.2471/BLT.14.140699",
        ):
            with self.subTest(text=text[:50]):
                self.assertTrue(reference_search.looks_like_boilerplate(text))

    def test_ordinary_paragraphs_are_not_mistaken_for_them(self):
        for text in (
            "Active management of the third stage of labour reduces postpartum haemorrhage (Smith et al., 2010). Give a uterotonic within one minute of birth.",
            "Women with gestational diabetes should have a glucose test between 24 and 28 weeks. Repeat the test if it was missed, and record the result.",
            "Resources Two trials evaluated cost implications of two models of antenatal care with reduced visits, one in the United Kingdom and one in two other countries.",
            "",
        ):
            with self.subTest(text=text[:50]):
                self.assertFalse(reference_search.looks_like_boilerplate(text))


class PassageSizeTests(unittest.TestCase):
    """The PDF reader hands over one piece per layout block; a passage worth searching is about a short paragraph."""

    def test_short_pieces_of_a_page_become_passages_of_a_short_paragraph_with_the_same_words(self):
        pieces = [{"text": f"Entry {n}: a short list item of about sixty characters in all.", "section_label": None} for n in range(60)]
        merged = reference_library.merge_pieces(pieces)
        self.assertLess(len(merged), 12)
        self.assertTrue(all(len(m["text"]) <= reference_library.MAX_CHARS for m in merged))
        self.assertTrue(all(len(m["text"]) >= reference_library.TARGET_CHARS for m in merged[:-1]))
        self.assertEqual(" ".join(m["text"] for m in merged), " ".join(p["text"] for p in pieces))  # the document's words, in order, nothing added

    def test_a_heading_starts_a_new_passage_only_when_there_is_enough_before_it(self):
        body = "A sentence of ordinary body text that goes on for a while. " * 6  # about 350 characters
        merged = reference_library.merge_pieces([{"text": body, "section_label": None}, {"text": "Next part.", "section_label": "Heading"}])
        self.assertEqual([m["section_label"] for m in merged], [None, "Heading"])
        short = reference_library.merge_pieces([{"text": "Tiny.", "section_label": None}, {"text": "Next part.", "section_label": "Heading"}])
        self.assertEqual(len(short), 1)  # too little before it to stand alone

    def test_words_that_the_reader_took_for_a_heading_go_back_into_the_passage(self):
        wrapped = reference_library.merge_pieces([{"text": "balloon expulsion.", "section_label": "gers are held in the vagina below the cervix to prevent inadvertent"}])
        self.assertEqual(wrapped, [{"text": "gers are held in the vagina below the cervix to prevent inadvertent balloon expulsion.", "section_label": None}])
        real = reference_library.merge_pieces([{"text": "Give the first dose at once.", "section_label": "Recommendation 5"}])
        self.assertEqual(real, [{"text": "Recommendation 5 Give the first dose at once.", "section_label": "Recommendation 5"}])
        for label in ("con-", "ends with the", "starts lower case", "A heading that is far too long to be one, going on and on and on and on, and then on again"):
            self.assertFalse(reference_library.looks_like_heading(label), label)
        for label in ("Introduction", "1.2 Methods", "Recommendation 5"):
            self.assertTrue(reference_library.looks_like_heading(label), label)

    def test_soft_hyphens_are_removed_so_pre_eclampsia_is_one_word(self):
        merged = reference_library.merge_pieces([{"text": "Pre-\u00adeclampsia can occur.", "section_label": None}])
        self.assertEqual(merged[0]["text"], "Pre-eclampsia can occur.")

    def test_a_piece_that_is_already_long_is_not_joined_past_the_maximum(self):
        long_piece = {"text": "word " * 250, "section_label": None}  # 1250 characters
        merged = reference_library.merge_pieces([long_piece, {"text": "x" * 400, "section_label": None}])
        self.assertEqual(len(merged), 2)
        self.assertEqual(reference_library.merge_pieces([]), [])

    def test_a_pdf_split_the_old_way_is_split_again_into_readable_passages(self):
        import fitz
        folder = tempfile.TemporaryDirectory()
        path = Path(folder.name) / "legacy.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page()
            for n in range(14):
                page.insert_text((72, 72 + n * 40), f"Entry {n} is a short line of text about nothing in particular.")
            pdf.save(path)
        with SessionLocal() as db:
            item = models.ReferenceItem(title="Legacy split", issuer="Test unit", summary="", notes="", file_path=str(path))
            db.add(item)
            db.flush()
            for n in range(14):  # what the earlier version stored: one passage per line
                text = f"Entry {n} is a short line."
                sequence, counts = reference_search.analyse(text)
                db.add(models.ReferenceChunk(item_id=item.id, chunk_index=n, page_number=1, section_label=None, text=text, term_freq=dict(counts), token_count=len(sequence)))
            db.commit()
            item_id = item.id
            try:
                reference_library.refresh_small_passages(db)
                db.commit()
                chunks = db.query(models.ReferenceChunk).filter_by(item_id=item_id).all()
                self.assertLess(len(chunks), 14)
                self.assertGreaterEqual(sum(len(c.text) for c in chunks) / len(chunks), reference_library.SMALL_PASSAGE_CHARS)
                self.assertTrue(all(c.page_number == 1 for c in chunks))
                before = len(chunks)
                reference_library.refresh_small_passages(db)  # already readable: left alone this time
                self.assertEqual(db.query(models.ReferenceChunk).filter_by(item_id=item_id).count(), before)
            finally:
                db.rollback()
                db.delete(db.get(models.ReferenceItem, item_id))
                db.commit()
                reference_library.invalidate()
                folder.cleanup()


if __name__ == "__main__":
    unittest.main()
