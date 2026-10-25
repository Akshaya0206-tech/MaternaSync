"""Plain-words search for the personal Reference Library.

Two parts, both deterministic and with no language model:

1. Finding references ("SEO"): every reference is indexed under its title, tags, topic, publisher and summary, plus
   the everyday words, abbreviations and spelling variants that mean the same thing (a doctor can type "sugar" or
   "BP" or "bleeding after delivery" and still reach gestational diabetes, hypertension or postpartum
   haemorrhage). Typing mistakes and half-typed words are tolerated.
2. Finding passages (retrieval from the PDFs kept on this server): the same query, expanded the same way, is scored
   against every passage of every PDF with TF-IDF cosine similarity. A result is always an extract of the document with
   its page number. Nothing is generated or paraphrased, so nothing can be invented.
"""
import math
import re
from collections import Counter, defaultdict

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "by", "can", "do", "does", "for", "from", "how", "i", "in", "is",
    "it", "me", "my", "of", "on", "or", "should", "that", "the", "their", "there", "this", "to", "was", "were", "what",
    "when", "where", "which", "who", "will", "with", "would", "about", "after", "before", "during", "into", "than", "then",
}
# British and American spellings, and a few clinical variants, meet in one form.
SPELLING = {
    "labour": "labor", "programme": "program", "sulphate": "sulfate", "centre": "center", "tumour": "tumor",
    "behaviour": "behavior", "colour": "color", "foetus": "fetus", "oedema": "edema", "paracetamol": "acetaminophen",
}

# Groups of words that mean the same thing to a clinician in practice. A search for any member also looks for the others.
# Plain words come first on purpose: they are what someone types when they do not remember the formal term.
GROUPS_RAW = [
    ["sugar", "diabetes", "diabetic", "gdm", "gestational diabetes", "glucose", "blood sugar", "ogtt", "insulin", "hyperglycaemia", "metformin", "dm"],
    ["bp", "blood pressure", "hypertension", "hypertensive", "htn", "high bp", "pih", "pregnancy induced hypertension", "gestational hypertension", "antihypertensive", "labetalol", "nifedipine", "methyldopa"],
    ["preeclampsia", "pre-eclampsia", "eclampsia", "toxaemia", "toxemia", "fits", "convulsion", "convulsions", "seizure", "seizures", "magnesium sulphate", "mgso4"],
    ["bleeding", "haemorrhage", "hemorrhage", "pph", "postpartum haemorrhage", "postpartum bleeding", "blood loss", "aph", "antepartum haemorrhage", "tranexamic acid", "txa", "uterotonic", "uterotonics", "oxytocin", "misoprostol", "carbetocin"],
    ["anaemia", "anemia", "anaemic", "hb", "haemoglobin", "hemoglobin", "iron", "ifa", "iron deficiency", "folic acid", "folate", "transfusion"],
    ["caesarean", "cesarean", "c-section", "c section", "cs", "lscs", "vbac", "operative delivery", "surgical birth"],
    ["preterm", "premature", "prematurity", "tocolysis", "tocolytic", "tocolytics", "antenatal corticosteroids", "corticosteroids", "steroids", "betamethasone", "dexamethasone", "early labour", "threatened preterm labour"],
    ["labour", "labor", "delivery", "childbirth", "birth", "intrapartum", "partograph", "augmentation", "normal delivery"],
    ["induction", "induce", "induced", "induction of labour", "post term", "post-term", "prolonged pregnancy", "overdue", "postdates"],
    ["postpartum", "postnatal", "puerperium", "puerperal", "after delivery", "after birth", "pnc"],
    ["newborn", "neonate", "neonatal", "baby", "infant", "kmc", "kangaroo mother care", "breastfeeding", "lactation", "breast feeding"],
    ["antenatal", "prenatal", "anc", "booking visit", "pregnancy care", "routine care", "antenatal care"],
    ["ultrasound", "usg", "scan", "scans", "sonography", "anomaly scan", "dating scan"],
    ["infection", "sepsis", "uti", "urinary tract infection", "fever", "chorioamnionitis", "antibiotic", "antibiotics"],
    ["hiv", "hepatitis", "syphilis", "malaria", "tb", "tuberculosis", "covid", "sti"],
    ["vaccine", "vaccines", "vaccination", "immunisation", "immunization", "td", "tt", "tetanus", "tdap", "influenza", "flu"],
    ["thyroid", "hypothyroidism", "hyperthyroidism", "tsh", "levothyroxine", "thyroxine"],
    ["miscarriage", "abortion", "early pregnancy loss", "pregnancy loss", "mtp", "ectopic", "molar pregnancy", "termination of pregnancy"],
    ["stillbirth", "fetal death", "iufd", "intrauterine death"],
    ["twins", "twin", "multiple pregnancy", "multiples"],
    ["growth restriction", "fgr", "iugr", "small baby", "low birth weight", "lbw", "small for gestational age", "sga"],
    ["fetal movement", "baby movement", "baby movements", "kick count", "kicks", "reduced movements"],
    ["mental health", "depression", "anxiety", "perinatal depression", "postnatal depression", "psychosis", "stress", "mood"],
    ["nutrition", "diet", "food", "supplement", "supplements", "micronutrient", "micronutrients", "mms", "vitamin", "calcium", "vitamin d", "multiple micronutrient"],
    ["obesity", "overweight", "bmi", "weight gain", "underweight"],
    ["smoking", "tobacco", "alcohol", "substance use", "smokeless tobacco"],
    ["epilepsy", "antiepileptic", "anticonvulsant"],
    ["heart disease", "cardiac", "cardiomyopathy", "peripartum cardiomyopathy", "rheumatic heart"],
    ["asthma", "respiratory", "breathlessness"],
    ["kidney", "renal", "ckd"],
    ["liver", "cholestasis", "icp", "itching", "obstetric cholestasis"],
    ["rh", "rhesus", "anti-d", "anti d", "blood group", "alloimmunisation"],
    ["thrombosis", "vte", "dvt", "clot", "anticoagulant", "heparin", "lmwh", "thromboprophylaxis"],
    ["amniotic fluid", "oligohydramnios", "polyhydramnios", "liquor"],
    ["membranes", "prom", "pprom", "rupture of membranes", "water breaking", "waters breaking"],
    ["placenta", "praevia", "previa", "abruption", "accreta", "placental"],
    ["breech", "malpresentation", "external cephalic version", "ecv"],
    ["shoulder dystocia", "dystocia", "obstructed labour", "prolonged labour", "cephalopelvic disproportion"],
    ["perineal", "tear", "tears", "episiotomy", "obstetric anal sphincter injury", "oasis"],
    ["contraception", "family planning", "iucd", "iud", "postpartum family planning", "ppiucd"],
    ["medicines", "drugs in pregnancy", "teratogen", "teratogenic", "safe medicines", "medication"],
    ["guideline", "guidelines", "protocol", "recommendation", "recommendations", "standard treatment", "sop", "handbook", "manual", "toolkit"],
    ["adolescent", "teenage", "young mothers"],
]

_WORD = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def normalise(text: str) -> str:
    text = (text or "").lower()
    for british, american in SPELLING.items():
        text = text.replace(british, american)
    return text.replace("ae", "e").replace("oe", "e")


def stem(word: str) -> str:
    if len(word) <= 3 or word.isdigit():
        return word
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("sses"):
        return word[:-2]
    if word.endswith("ing") and len(word) > 5:
        return word[:-3]
    if word.endswith("ed") and len(word) > 4:
        return word[:-2]
    if word.endswith(("ches", "shes", "xes", "zes")) and len(word) > 4:
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def analyse(text: str) -> tuple[list[str], Counter]:
    """(sequence, counts). A hyphenated word counts as one word in the sequence ("pre-eclampsia" is "preeclampsia"),
    and its parts are counted too, so either way of typing it finds it."""
    sequence: list[str] = []
    counts: Counter = Counter()
    for match in _WORD.finditer(normalise(text)):
        word = match.group()
        parts = word.split("-")
        joined = stem("".join(parts))
        if joined in STOPWORDS:
            continue
        sequence.append(joined)
        counts[joined] += 1
        if len(parts) > 1:
            for part in parts:
                if part not in STOPWORDS:
                    counts[stem(part)] += 1
    return sequence, counts


def tokens(text: str) -> list[str]:
    return analyse(text)[0]


def _build_groups():
    groups, index = [], defaultdict(list)
    for gid, raw in enumerate(GROUPS_RAW):
        members = []
        for phrase in raw:
            sequence = tuple(tokens(phrase))
            if sequence:
                members.append(sequence)
        groups.append({"raw": raw, "members": members, "tokens": {t for m in members for t in m}})
        for member in set(members):
            index[member].append(gid)
    return groups, index


GROUPS, MEMBER_INDEX = _build_groups()
MAX_PHRASE = max(len(m) for g in GROUPS for m in g["members"])


def groups_in(sequence: list[str]) -> set[int]:
    found = set()
    for size in range(1, MAX_PHRASE + 1):
        for start in range(len(sequence) - size + 1):
            found.update(MEMBER_INDEX.get(tuple(sequence[start:start + size]), ()))
    return found


# ---------------------------------------------------------------- spelling tolerance


def _within(a: str, b: str, limit: int) -> bool:
    """True when the edit distance between a and b is at most `limit` (small banded dynamic programme)."""
    if abs(len(a) - len(b)) > limit:
        return False
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i] + [0] * len(b)
        lowest = current[0]
        for j, cb in enumerate(b, 1):
            current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ca != cb))
            lowest = min(lowest, current[j])
        if lowest > limit:
            return False
        previous = current
    return previous[-1] <= limit


def nearest(word: str, vocabulary: Counter) -> str | None:
    """The most frequent known word within one typing slip (two for long words), or None."""
    if len(word) < 4:
        return None
    limit = 1 if len(word) < 8 else 2
    best, best_count = None, 0
    for candidate, count in vocabulary.items():
        if candidate[0] != word[0] and candidate[-1] != word[-1]:
            continue
        if count > best_count and _within(word, candidate, limit):
            best, best_count = candidate, count
    return best


# ---------------------------------------------------------------- the query

Alternative = tuple  # one or more normalised words that must all be present together


class Unit:
    """One thing the user asked for: a word or a known phrase, with the other phrases that would also satisfy it.

    Alternatives are whole phrases and are matched as whole phrases, so "blood sugar" can be satisfied by the word
    "glucose" but not by any document that merely contains "blood".
    """

    def __init__(self, label: str, alternatives: dict[Alternative, float]):
        self.label = label
        self.alternatives = alternatives

    def words(self) -> set[str]:
        return {t for alt in self.alternatives for t in alt}


def plan(query: str, vocabulary: Counter, surfaces: dict[str, str]) -> dict:
    sequence = tokens(query)
    units: list[Unit] = []
    corrections: list[dict] = []
    also: list[str] = []
    i = 0
    while i < len(sequence):
        matched_size, matched_groups = 0, set()
        for size in range(min(MAX_PHRASE, len(sequence) - i), 0, -1):
            candidate = tuple(sequence[i:i + size])
            if candidate in MEMBER_INDEX:
                matched_size, matched_groups = size, set(MEMBER_INDEX[candidate])
                break
        if matched_size:
            asked = tuple(sequence[i:i + matched_size])
            alternatives: dict[Alternative, float] = {asked: 1.0}
            for gid in matched_groups:
                for member in GROUPS[gid]["members"]:
                    if member != asked:
                        alternatives.setdefault(member, 0.6)
                also.extend(r for r in GROUPS[gid]["raw"] if tuple(tokens(r)) != asked)
            units.append(Unit(" ".join(asked), alternatives))
            i += matched_size
            continue
        word = sequence[i]
        alternatives = {(word,): 1.0}
        if word not in vocabulary:
            fixed = nearest(word, vocabulary)
            if fixed:
                alternatives[(fixed,)] = 0.85
                corrections.append({"from": word, "to": surfaces.get(fixed, fixed)})
            if len(word) >= 3 and i == len(sequence) - 1:  # a half-typed last word, such as "preecl"
                for t in sorted((t for t in vocabulary if t.startswith(word) and t != word), key=lambda t: -vocabulary[t])[:6]:
                    alternatives.setdefault((t,), 0.6)
        units.append(Unit(word, alternatives))
        i += 1
    return {"units": units, "corrections": corrections, "also": list(dict.fromkeys(also))[:8], "tokens": sequence}


# ---------------------------------------------------------------- finding references

FIELD_WEIGHTS = {"title": 6.0, "tags": 5.0, "auto_core": 4.0, "topic": 4.0, "issuer": 2.5, "notes": 2.5, "summary": 2.0, "auto_wide": 1.0}


def index_item(item, personal_note: str = "") -> dict:
    """Everything a search looks at for one reference, as sets of normalised words."""
    title_seq, title_counts = analyse(item.title)
    tags_seq, tags_counts = analyse(" ".join(item.tags or []))
    topic_seq, topic_counts = analyse(" ".join(filter(None, [item.topic, item.category and item.category.replace("_", " ")])))
    summary_seq, summary_counts = analyse(item.summary or "")
    core_groups = groups_in(title_seq + tags_seq + topic_seq)
    wide_groups = groups_in(summary_seq) - core_groups

    def spread(groups):  # words of every phrase of the groups
        return {t for g in groups for t in GROUPS[g]["tokens"]}

    return {
        "title": set(title_counts), "tags": set(tags_counts), "topic": set(topic_counts),
        "issuer": set(analyse(" ".join(filter(None, [item.issuer, item.jurisdiction])))[1]),
        "summary": set(summary_counts), "notes": set(analyse(f"{item.notes or ''} {personal_note}")[1]),
        "auto_core": spread(core_groups), "auto_wide": spread(wide_groups),
        "core_groups": core_groups, "title_text": " ".join(title_seq),
    }


def search_terms(index: dict) -> list[str]:
    """Words the item can be found by besides the ones written on it: shown so the doctor sees why it matched."""
    seen, words = set(), []
    for gid in sorted(index["core_groups"]):
        for raw in GROUPS[gid]["raw"]:
            if raw not in seen:
                seen.add(raw)
                words.append(raw)
    return words


def score_item(units: list[Unit], index: dict, frequencies: Counter, total: int, query_text: str) -> tuple[float, list[str]]:
    idf = lambda token: math.log(1 + total / (1 + frequencies.get(token, 0)))
    score, matched, where = 0.0, 0, []
    for unit in units:
        best, best_field = 0.0, None
        for alternative, weight in unit.alternatives.items():
            strength = weight * sum(idf(t) for t in alternative)
            for field, field_weight in FIELD_WEIGHTS.items():
                # A phrase counts only where its words are all present together in that part of the reference.
                if strength * field_weight > best and all(t in index[field] for t in alternative):
                    best, best_field = strength * field_weight, field
        if best_field:
            score += best
            matched += 1
            if best_field not in where:
                where.append(best_field)
    if not matched:
        return 0.0, []
    if matched == len(units):
        score *= 1.4  # everything asked for is there
    elif len(units) > 2 and matched * 2 < len(units):
        return 0.0, []  # a long question that only brushes one word is not a match
    if query_text and query_text in index["title_text"]:
        score *= 1.25
    return score, where


# ---------------------------------------------------------------- finding passages

_K, _B = 1.2, 0.75


def passage_scores(units: list[Unit], chunks: list[dict]) -> list[tuple[dict, float, set[str]]]:
    """BM25 over the PDF passages. A passage must satisfy at least half of what was asked, and only passages close in
    strength to the best one are kept. Returns (passage, score, matched words), best first."""
    if not units or not chunks:
        return []
    frequencies: Counter = Counter()
    for chunk in chunks:
        frequencies.update(chunk["tf"].keys())
    total = len(chunks)
    average = (sum(c["len"] for c in chunks) / total) or 1
    idf = lambda token: math.log(1 + (total - frequencies.get(token, 0) + 0.5) / (frequencies.get(token, 0) + 0.5))
    needed = max(1, math.ceil(len(units) * 0.7))  # a passage is a short paragraph, so two stray words of a long question can meet in it by chance
    scored = []
    for chunk in chunks:
        tf, length = chunk["tf"], chunk["len"]
        norm = _K * (1 - _B + _B * length / average)
        score, hit_units, matched = 0.0, 0, set()
        for unit in units:
            best, best_alt = 0.0, None
            for alternative, weight in unit.alternatives.items():
                # A single letter ("c" in "c section") matches headings like "section C" in a long document; the synonyms
                # for the phrase (caesarean, LSCS...) already cover what was meant.
                if any(len(t) == 1 for t in alternative):
                    continue
                if all(t in tf for t in alternative):
                    value = weight * sum(idf(t) * tf[t] * (_K + 1) / (tf[t] + norm) for t in alternative)
                    if value > best:
                        best, best_alt = value, alternative
            if best_alt:
                score += best
                hit_units += 1
                matched.update(best_alt)
        if hit_units >= needed:
            scored.append((chunk, score * (0.6 + 0.4 * hit_units / len(units)), matched))
    scored.sort(key=lambda r: r[1], reverse=True)
    if not scored:
        return []
    floor = scored[0][1] * 0.4
    return [r for r in scored if r[1] >= floor]


# ---------------------------------------------------------------- passages that are not content

# A PDF's reference list, licence page and journal header are full of the words of the subject (every cited paper is about it), so a search that
# ranks by meaning or by words puts them above real paragraphs. They are recognised by what they look like, not by what they say.
_CITATION = re.compile(r"\b(?:19|20)\d{2}\s*;\s*\(?\d+\)?\s*(?:\([^)]{1,12}\))?\s*:\s*[\dA-Za-z]+")  # 2019;43:44-50   2012;10(56 Suppl):1-9   2020;(7):CD012129
_NUMBERED = re.compile(r"(?:^|[\s.;])\d{1,3}\.\s+[A-Z][A-Za-z'\u2019\-]+\s+[A-Z]{1,3}[,.\s]")  # "52. Shepherd E," "117. Grivell RM,"
_JOURNAL = re.compile(r"\b(?:Cochrane Database|Syst Rev|Obstet Gynecol|BJOG|Lancet|BMJ|N Engl J Med|JAMA|PLoS|Int J Gynaecol Obstet|J Matern Fetal|Geneva: World Health Organization|Geneva: WHO)\b")
_LINK = re.compile(r"\bdoi\b|https?://|www\.", re.I)
_ET_AL = re.compile(r"\bet al\b", re.I)
_FRONT = re.compile(r"some rights reserved|creative commons|all rights reserved|wileyonlinelibrary|\u00a9|\breceived:|\baccepted:|\brevised:|\bissn\b|\bisbn\b|\bprinted in\b"
                    r"|\bcorresponding author\b|\bconflict of interest\b|\bcite this\b|\bdisclaimer\b|\bdeclarations? of interests?\b", re.I)


def boilerplate_cues(text: str) -> float:
    return (2 * len(_CITATION.findall(text)) + 1.5 * len(_NUMBERED.findall(text)) + 1.5 * len(_JOURNAL.findall(text)) + len(_LINK.findall(text))
            + 2 * len(_FRONT.findall(text)) + 0.5 * len(_ET_AL.findall(text)))


def looks_like_boilerplate(text: str) -> bool:
    """True for a bibliography, a licence page or a journal header: text that is about the subject only because it lists papers about it."""
    return boilerplate_cues(text) >= BOILERPLATE_CUES


BOILERPLATE_CUES = 3.0


_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_SURFACE_WORD = re.compile(r"[A-Za-z][A-Za-z\-']*")


def snippet(text: str, matched: set[str], limit: int = 480) -> tuple[str, list[str]]:
    """The sentences of a passage that hold the most matched words, and the words to highlight in them."""
    sentences = _SENTENCE.split(text)
    scored = [(len({t for t in tokens(sentence)} & matched), -position, position) for position, sentence in enumerate(sentences)]
    best = max(scored)[2] if scored else 0
    chosen = sentences[best]
    if best + 1 < len(sentences) and len(chosen) < limit // 2:
        chosen += " " + sentences[best + 1]
    if len(chosen) > limit:
        chosen = chosen[:limit].rsplit(" ", 1)[0] + "…"
    marks = sorted({w.lower() for w in _SURFACE_WORD.findall(chosen) if (tokens(w) or [""])[0] in matched})
    return chosen, marks
