"""Pure-Python TF-IDF + cosine retrieval over approved guideline chunks.

Deliberately zero new dependencies (no numpy/scipy/scikit-learn, no
sentence-embedding model). At the scale this feature actually operates at
(dozens to low hundreds of chunks for a hackathon-scale guideline library),
hand-rolled dict-based cosine similarity runs in low single-digit
milliseconds — a vectorized-math dependency would be paid for a benefit
this project never exercises. Clinicians searching guideline text also tend
to use goal-oriented phrases that share vocabulary with the source text, so
keyword-overlap retrieval performs adequately here; it will not handle deep
paraphrase/synonymy well, and that limitation is surfaced in the UI rather
than oversold as semantic search.

Term frequency is computed once per chunk at ingestion time (stored on
GuidelineChunk.term_freq). IDF is recomputed fresh on every search over the
live approved-chunk set, because document frequency changes every time a
source is approved/excluded — a persisted dense vector would silently go
stale the moment the approved corpus changes; recomputing at query time
over a few hundred small dicts is computationally trivial and avoids that
correctness bug entirely.
"""

import math
import re
from collections import Counter

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
    "can", "do", "does", "did", "for", "from", "had", "has", "have", "how",
    "in", "into", "is", "it", "its", "may", "of", "on", "or", "should",
    "that", "the", "their", "there", "these", "this", "to", "was", "were",
    "what", "when", "where", "which", "who", "will", "with", "would",
}

_TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z'\-]+")


def tokenize(text: str) -> list[str]:
    tokens = [t.lower() for t in _TOKEN_RE.findall(text or "")]
    return [t for t in tokens if len(t) >= 2 and t not in _STOPWORDS]


def term_frequencies(tokens: list[str]) -> dict[str, int]:
    return dict(Counter(tokens))


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(weight * b.get(token, 0.0) for token, weight in a.items())
    if dot == 0.0:
        return 0.0
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def score_corpus(query: str, chunks: list) -> list[tuple[object, float]]:
    """chunks: a list of GuidelineChunk ORM rows (must have .term_freq).
    Returns (chunk, score) pairs sorted by score descending. An empty or
    all-zero result means nothing matched — callers treat that as
    insufficient evidence, not an error."""
    query_tokens = tokenize(query)
    if not query_tokens or not chunks:
        return []

    doc_freq: dict[str, int] = {}
    for chunk in chunks:
        for token in (chunk.term_freq or {}):
            doc_freq[token] = doc_freq.get(token, 0) + 1

    n_docs = len(chunks)

    def idf(token: str) -> float:
        df = doc_freq.get(token, 0)
        return math.log((1 + n_docs) / (1 + df)) + 1

    query_tf = term_frequencies(query_tokens)
    query_vec = {token: count * idf(token) for token, count in query_tf.items()}

    scored = []
    for chunk in chunks:
        chunk_tf = chunk.term_freq or {}
        chunk_vec = {token: count * idf(token) for token, count in chunk_tf.items()}
        score = _cosine(query_vec, chunk_vec)
        if score > 0:
            scored.append((chunk, score))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored
