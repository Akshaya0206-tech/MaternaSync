"""Search the Reference Library by meaning, so a question typed in Hindi, Tamil or Telugu finds the English passage that answers it.

How it works. A small multilingual model (multilingual-e5-small, MIT licence) turns every passage of every PDF, every reference's
title and summary, and every question into a list of 384 numbers. Text that means the same thing gets numbers that point the same
way, in any language the model knows, so a passage is "close" to a question when the two lists point the same way (cosine
similarity). The model runs on this server with onnxruntime. It is used for ranking only.

What it never does: write, translate, summarise or paraphrase. A result is still the document's own sentence with its page number,
exactly as the word search returns it; only the order, and which passages are found at all, differ. Nothing can be invented, and a
question in another language never produces text in that language about the document.

Optional. It is used only when the model files (fetch_search_model.py) and the index of the passages (build_semantic_index.py)
exist, and not when MATERNASYNC_SEMANTIC_SEARCH=off. Without them the search works by words, as before. The index holds one vector per
text, filed under a hash of the text, so a re-indexed PDF keeps its vectors and a changed passage simply has none until the index is
rebuilt (the word search still finds it meanwhile).
"""
import hashlib
import os
import re
import threading
from collections import OrderedDict
from pathlib import Path

import numpy as np

from . import config

MODEL_REPO = "Xenova/multilingual-e5-small"  # the ONNX form of intfloat/multilingual-e5-small
BACKEND_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BACKEND_DIR / "search_model" / "multilingual-e5-small"
INDEX_FILE = BACKEND_DIR / "search_model" / "multilingual-e5-small-index.npz"
DIMENSIONS = 384
MAX_TOKENS = 256  # a passage is a few hundred words; the model reads the first 256 tokens of it
BATCH = 16

# What counts as close enough. Similarities from this model sit in a narrow band (unrelated text still scores around 0.7), so a result
# must be above an absolute floor and within a margin of the best match. A reference is described by a short title and summary and a passage
# by a long stretch of text, and the two score differently, so each has its own floor.
#
# Whether the library answers a question at all is decided from strong evidence at either level (confident() below): a reference whose title and
# summary clear ITEM_FLOOR, or one passage that clears PASSAGE_GATE. Titles and summaries separate "has an answer" from "has none" cleanly; a passage
# is a long stretch of text and does not, so a single passage is trusted only when it is very close. Once the library is known to answer the
# question, passages are listed down to the lower PASSAGE_FLOOR. All four numbers were set from the evaluation set in evaluate_semantic_search.py,
# which includes questions that have no answer in the library (see its --sweep option).
ITEM_FLOOR = 0.80
PASSAGE_FLOOR = 0.82
PASSAGE_GATE = 0.86
MARGIN = 0.04
# A few words on their own (a running page header, a figure caption, a table cell) embed as "about the topic" and would outrank real paragraphs.
MIN_PASSAGE_CHARS = 150
LAZY_LIMIT = 64  # a doctor's own references that are not in the index yet are embedded on the spot, up to this many per search

_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_state: dict = {"embedder": None, "index": None, "index_stamp": None, "forced": False}
_lock = threading.Lock()
_queries: OrderedDict = OrderedDict()  # the last questions' vectors: a doctor types a few words, then edits them
_extra: dict = {}  # vectors of texts that were not in the index file when they were asked about


def text_key(text: str) -> str:
    """The name a text is filed under in the index."""
    return hashlib.sha1(text.strip().encode("utf-8")).hexdigest()[:20]


def item_text(item) -> str:
    """What is embedded for a reference: its title, topic and summary. A doctor's private notes are never included."""
    return ". ".join(part.strip() for part in (item.title or "", item.topic or "", item.summary or "") if part and part.strip())


class Embedder:
    """The model, loaded once. embed() returns one unit-length vector per text."""

    def __init__(self, model_dir: Path = MODEL_DIR):
        import onnxruntime
        from tokenizers import Tokenizer

        self.tokenizer = Tokenizer.from_file(str(model_dir / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=MAX_TOKENS)
        self.tokenizer.enable_padding(pad_id=self.tokenizer.token_to_id("<pad>") or 1, pad_token="<pad>")
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        self.session = onnxruntime.InferenceSession(str(model_dir / "model_quantized.onnx"), options, providers=["CPUExecutionProvider"])
        self.wants_token_types = "token_type_ids" in {i.name for i in self.session.get_inputs()}

    def embed(self, texts: list[str], kind: str) -> np.ndarray:
        """kind is "query" for a question and "passage" for text that is searched; the model was trained with those two prefixes."""
        out = []
        for start in range(0, len(texts), BATCH):
            encoded = self.tokenizer.encode_batch([f"{kind}: {text}" for text in texts[start:start + BATCH]])
            ids = np.array([e.ids for e in encoded], dtype=np.int64)
            mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
            feed = {"input_ids": ids, "attention_mask": mask}
            if self.wants_token_types:
                feed["token_type_ids"] = np.zeros_like(ids)
            hidden = self.session.run(None, feed)[0]
            weights = mask[..., None].astype(np.float32)
            pooled = (hidden * weights).sum(axis=1) / np.clip(weights.sum(axis=1), 1e-9, None)
            out.append(pooled / np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-9, None))
        return np.vstack(out).astype(np.float32) if out else np.zeros((0, DIMENSIONS), np.float32)


class Index:
    def __init__(self, keys: list[str], vectors: np.ndarray):
        self.rows = {key: row for row, key in enumerate(keys)}
        self.matrix = np.asarray(vectors, dtype=np.float32)  # kept in full precision in memory (about 24 MB for the whole library)


def installed() -> bool:
    return (MODEL_DIR / "model_quantized.onnx").exists() and (MODEL_DIR / "tokenizer.json").exists() and INDEX_FILE.exists()


def enabled() -> bool:
    """True when a search should also look by meaning."""
    if _state["forced"]:
        return True
    return config.SEMANTIC_SEARCH != "off" and installed()


def embedder():
    with _lock:
        if _state["embedder"] is None:
            _state["embedder"] = Embedder()
        return _state["embedder"]


def read_index_file(path: Path | None = None) -> tuple[list[str], np.ndarray]:
    with np.load(path or INDEX_FILE, allow_pickle=False) as data:
        return [str(k) for k in data["keys"]], data["vectors"]


def index() -> Index | None:
    if _state["forced"]:
        return _state["index"]
    try:
        stamp = INDEX_FILE.stat().st_mtime_ns
    except OSError:
        return None
    with _lock:
        if _state["index"] is None or _state["index_stamp"] != stamp:
            keys, vectors = read_index_file()
            _state.update(index=Index(keys, vectors), index_stamp=stamp)
        return _state["index"]


def _query_vector(query: str) -> np.ndarray:
    key = query.strip()
    if key in _queries:
        _queries.move_to_end(key)
        return _queries[key]
    vector = embedder().embed([key], "query")[0]
    _queries[key] = vector
    while len(_queries) > 64:
        _queries.popitem(last=False)
    return vector


def rank(query: str, keys, floor: float, limit: int = 24, lazy: dict | None = None) -> list[tuple[str, float]]:
    """The texts (named by key) that best match the question, best first: [(key, similarity)].

    Only texts the index knows are considered, plus the few in `lazy` ({key: text}) that are embedded on the spot. A text must score
    at least `floor` and be within MARGIN of the best, so a question with no answer in the library finds nothing, not the least-bad text."""
    idx = index()
    if idx is None or not query.strip():
        return []
    known = [(key, idx.rows[key]) for key in dict.fromkeys(keys) if key in idx.rows]
    missing = [key for key in dict.fromkeys(keys) if key not in idx.rows and lazy and key in lazy][:LAZY_LIMIT]
    if not known and not missing:
        return []
    vector = _query_vector(query)
    scored = []
    if known:
        sims = idx.matrix[[row for _, row in known]] @ vector
        scored += [(key, float(sim)) for (key, _), sim in zip(known, sims)]
    if missing:
        fresh = [key for key in missing if key not in _extra]
        if fresh:
            for key, vec in zip(fresh, embedder().embed([lazy[key] for key in fresh], "passage")):
                _extra[key] = vec
        scored += [(key, float(_extra[key] @ vector)) for key in missing]
    scored.sort(key=lambda r: -r[1])
    if not scored or scored[0][1] < floor:
        return []
    cut = max(floor, scored[0][1] - MARGIN)
    return [(key, sim) for key, sim in scored[:limit] if sim >= cut]


def confident(found_items: list, found_passages: list) -> bool:
    """Whether the library answers this question at all, judged from what rank() returned for the references and for the passages: a reference matched
    by its title and summary, or one passage matched very closely. When it does not, nothing found by meaning is shown."""
    return bool(found_items) or bool(found_passages and found_passages[0][1] >= PASSAGE_GATE)


def fuse(by_words: list, by_meaning: list, k: int = 60) -> list[tuple]:
    """Merge two rankings (lists of ids, best first) by reciprocal rank fusion: an id near the top of either list, or in both, comes first.
    Returns [(id, score, source)] best first, where source is "words", "meaning" or "both"."""
    scores: dict = {}
    seen_in: dict = {}
    for source, ranking in (("words", by_words), ("meaning", by_meaning)):
        for position, ident in enumerate(ranking, start=1):
            scores[ident] = scores.get(ident, 0.0) + 1.0 / (k + position)
            seen_in.setdefault(ident, set()).add(source)
    order = sorted(scores, key=lambda ident: -scores[ident])
    return [(ident, scores[ident], "both" if len(seen_in[ident]) == 2 else next(iter(seen_in[ident]))) for ident in order]


def best_extract(query: str, text: str, limit: int = 480) -> str:
    """The sentence of a passage that is closest in meaning to the question, with the sentences around it until it is long enough to be
    read on its own, exactly as written in the document. Used for a passage that was found by meaning, where there are no matching words
    to centre the extract on."""
    sentences = [s.strip() for s in _SENTENCE.split(text) if s.strip()]
    if len(sentences) > 1:
        try:
            sims = embedder().embed(sentences[:24], "passage") @ _query_vector(query)
            best = int(np.argmax(sims))
        except Exception:  # the extract is only a convenience: fall back to the start of the passage
            best = 0
        low = high = best
        length = len(sentences[best])
        while length < limit * 0.6 and (low > 0 or high + 1 < len(sentences)):  # the next sentence, then the one before, and so on
            if high + 1 < len(sentences):
                high += 1
                length += len(sentences[high]) + 1
            if length < limit * 0.6 and low > 0:
                low -= 1
                length += len(sentences[low]) + 1
        chosen = " ".join(sentences[low:high + 1])
    else:
        chosen = text.strip()
    if len(chosen) > limit:
        chosen = chosen[:limit].rsplit(" ", 1)[0] + "…"
    return chosen


def build_index(texts: dict[str, str], progress=print, rebuild: bool = False) -> dict:
    """Write the index file for {key: text}. Texts that already have a vector are kept, so only new texts are embedded."""
    kept: dict[str, np.ndarray] = {}
    if INDEX_FILE.exists() and not rebuild:
        old_keys, old_vectors = read_index_file()
        kept = {key: vec for key, vec in zip(old_keys, old_vectors) if key in texts}
    todo = sorted((key for key in texts if key not in kept), key=lambda key: len(texts[key]))  # similar lengths together: less padding
    model = embedder() if todo else None
    for done, start in enumerate(range(0, len(todo), 256), start=1):
        batch = todo[start:start + 256]
        for key, vec in zip(batch, model.embed([texts[key] for key in batch], "passage")):
            kept[key] = vec
        progress(f"  embedded {min(start + 256, len(todo))} of {len(todo)} new texts")
    keys = list(kept)
    vectors = np.array([kept[key] for key in keys], dtype=np.float16) if keys else np.zeros((0, DIMENSIONS), np.float16)
    INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = INDEX_FILE.with_name(INDEX_FILE.stem + ".tmp.npz")
    with open(temporary, "wb") as handle:
        np.savez_compressed(handle, keys=np.array(keys, dtype="<U20"), vectors=vectors)
    temporary.replace(INDEX_FILE)
    _state.update(index=None, index_stamp=None)
    return {"texts": len(keys), "new": len(todo), "kept": len(keys) - len(todo)}


def use_for_tests(fake_embedder, texts: dict[str, str] | None = None):
    """Tests: search by meaning with a stand-in embedder and an index built from {key: text}, whatever is installed."""
    vectors = fake_embedder.embed(list(texts.values()), "passage") if texts else np.zeros((0, DIMENSIONS), np.float32)
    _state.update(embedder=fake_embedder, index=Index(list(texts or {}), vectors), index_stamp=None, forced=True)
    _queries.clear()
    _extra.clear()


def reset_for_tests():
    _state.update(embedder=None, index=None, index_stamp=None, forced=False)
    _queries.clear()
    _extra.clear()
