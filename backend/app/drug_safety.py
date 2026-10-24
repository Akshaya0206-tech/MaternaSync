"""Prescription safety check: documented allergies, pregnancy cautions and drug-drug interactions.

This is NOT a complete drug-interaction database. It checks only against reviewed lists that a doctor has
approved in Clinical Settings ("Drug safety checks"), each entry citing the product label it came from, plus
the allergies recorded for the patient. Medicines are matched by generic name or alias (no brand lookup). The screen
says so every time, and a doctor must acknowledge each alert before signing. Nothing here suggests a dose or a drug.
"""
import hashlib
import re

LIMITATION = ("Checked only against the reviewed lists named below and the allergies recorded for this patient, by generic name. "
              "An allergy to a drug class does not flag other members of that class. "
              "This is not a complete drug-interaction database. Check a full reference before prescribing.")
# Words that describe the product, not the drug, and are dropped before matching.
_NOISE = {"tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules", "inj", "injection", "syrup", "syp", "susp", "oral", "iv", "im", "sc", "po",
          "od", "bd", "bid", "tds", "tid", "qid", "hs", "once", "twice", "daily", "mg", "mcg", "ug", "g", "gm", "ml", "iu", "units", "unit", "sr", "er", "xr", "cr",
          "ds", "forte", "the", "of", "with", "for", "ip", "bp", "usp"}


def normalize(text):
    text = re.sub(r"[()\[\].:]", " ", (text or "").lower())
    text = re.sub(r"\d+(?:[.,]\d+)?\s*(?:mg|mcg|ug|g|gm|ml|iu|units?|%)?", " ", text)
    return " ".join(word for word in re.split(r"[^a-z]+", text) if word and word not in _NOISE)


def split_medicines(text):
    """One entry per medicine named in the Medicine field (commas, semicolons, new lines, '+', '&', 'and')."""
    parts = re.split(r"[,;\n+&/]|\band\b", text or "", flags=re.I)
    result = []
    for part in parts:
        name = normalize(part)
        if name:
            result.append((part.strip(" .-"), name))
    return result


def _aliases(entry):
    return [normalize(a) for a in [entry.get("name", ""), *entry.get("aliases", [])] if normalize(a)]


def _hits(medicines, entry):
    aliases = _aliases(entry)
    return [original for original, name in medicines if any(re.search(r"(?<![a-z])" + re.escape(alias) + r"(?![a-z])", name) for alias in aliases)]


def allergy_entry(allergy):
    """Allergies are recorded like 'Penicillin (Hives)' or 'Penicillins': match the substance, not the reaction or the plural."""
    substance = re.sub(r"\(.*?\)", " ", allergy or "").strip()
    singular = [w[:-1] if len(w) > 4 and w.endswith("s") else w for w in substance.split()]
    return {"name": substance, "aliases": [" ".join(singular)]}


def _key(*parts):
    return hashlib.sha1("|".join(parts).encode()).hexdigest()[:12]


def check(medicine_text, earlier_medicines, allergies, sets):
    """Return alerts for the medicines written now.

    earlier_medicines: Medicine text from the patient's earlier approved prescriptions (for pair checks only).
    allergies: strings recorded on the episode. sets: [{"title","version","configuration"}] (approved, in-date).
    """
    now_meds = split_medicines(medicine_text)
    earlier = [m for text in earlier_medicines for m in split_medicines(text)]
    everything = now_meds + earlier
    alerts = []
    for allergy in dict.fromkeys(a.strip() for a in allergies or [] if a and a.strip()):
        hit = _hits(now_meds, allergy_entry(allergy))
        if hit:
            alerts.append({"key": _key("allergy", allergy, *hit), "kind": "allergy", "severity": "major", "drugs": hit,
                           "message": f"A recorded allergy matches this medicine: {allergy}.", "management": "Confirm the allergy history with the patient before prescribing.",
                           "sourceUrl": None, "quote": None, "setTitle": "Recorded allergies"})
    for item in sets:
        config = item["configuration"]
        for pair in config.get("pairs", []):
            a_now, b_now = _hits(now_meds, pair["a"]), _hits(now_meds, pair["b"])
            a_all, b_all = _hits(everything, pair["a"]), _hits(everything, pair["b"])
            # Alert only when at least one side is being prescribed now; the other may be earlier.
            if (a_now and b_all) or (b_now and a_all):
                drugs = sorted({*a_all, *b_all}, key=str.lower)
                alerts.append({"key": _key("interaction", pair["a"]["name"], pair["b"]["name"], pair.get("sourceUrl", "")), "kind": "interaction", "severity": pair["severity"],
                               "drugs": drugs, "message": pair["effect"], "management": pair.get("management", ""), "sourceUrl": pair.get("sourceUrl"), "quote": pair.get("quote"),
                               "setTitle": item["title"], "withEarlier": not (a_now and b_now)})
        for caution in config.get("cautions", []):
            hit = _hits(now_meds, caution)
            if hit:
                alerts.append({"key": _key("pregnancy", caution["name"], caution.get("sourceUrl", "")), "kind": "pregnancy", "severity": caution["severity"], "drugs": hit,
                               "message": caution["statement"], "management": "Weigh the label warning for this pregnancy before prescribing.",
                               "sourceUrl": caution.get("sourceUrl"), "quote": caution.get("quote"), "setTitle": item["title"]})
    rank = {"major": 0, "moderate": 1, "minor": 2}
    alerts.sort(key=lambda a: (rank.get(a["severity"], 3), a["kind"]))
    return {"medicines": [original for original, _ in now_meds], "alerts": alerts}
