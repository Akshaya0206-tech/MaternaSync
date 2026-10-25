"""Measure what searching by meaning adds to the Reference Library search, instead of assuming it helps.

Run from the backend folder, after build_semantic_index.py:   python evaluate_semantic_search.py [--details]
Each topic below is asked in English, Hindi, Tamil and Telugu, in plain words as a doctor or a patient would say it. A search is right when
one of the references that is about that topic is among the first 5 references listed (Reference@5), and, for the topics that have
a downloaded PDF, when one of the first 8 passages comes from such a reference AND contains the topic's own words (Passage@8: a reference list or a
page header from a right document does not count). Questions with no answer in the library must
find nothing. Every question is run twice, with the word search alone and with words and meaning together, on a copy of the database.

The Hindi, Tamil and Telugu wordings were written for this check and have not been reviewed by a native speaker: they are everyday
phrases for the topic, not a translation of the English line. Add your own to TOPICS to test more.
"""
import os
import re
import shutil
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
LANGUAGES = ("en", "hi", "ta", "te")

# topic -> (the references that are about it, {language: question})
TOPICS = {
    "bleeding after birth": (
        {"icmr-stw-pph-2025", "mohfw-pph-guidance-2015", "mohfw-uterotonics-2015", "figo-pph-2022", "figo-blood-loss-2025", "rcog-gtg52-pph", "acog-pb183-pph", "ranzcog-cobs43-pph", "who-pph-2025"},
        {"en": "heavy bleeding after delivery", "hi": "प्रसव के बाद ज़्यादा खून बहना", "ta": "பிரசவத்திற்குப் பிறகு அதிக இரத்தப்போக்கு", "te": "ప్రసవం తర్వాత ఎక్కువ రక్తస్రావం"}),
    "diabetes in pregnancy": (
        {"mohfw-gdm-2018", "figo-gdm-2015", "acog-pb190-gdm", "nice-ng3", "sign-171", "who-hyperglycaemia-2013", "who-diabetes-pregnancy-2025"},
        {"en": "sugar in pregnancy", "hi": "गर्भावस्था में शुगर", "ta": "கர்ப்ப காலத்தில் சர்க்கரை நோய்", "te": "గర్భధారణలో షుగర్ వ్యాధి"}),
    "anaemia": (
        {"mohfw-amb-abhiyaan-2026", "mohfw-iv-iron", "figo-anaemia-2025", "acog-pb233-anaemia", "who-hb-cutoffs-2024", "who-mms-2020"},
        {"en": "low haemoglobin in pregnancy", "hi": "गर्भावस्था में खून की कमी", "ta": "கர்ப்ப காலத்தில் இரத்த சோகை", "te": "గర్భధారణలో రక్తహీనత"}),
    "high blood pressure": (
        {"fogsi-gcpr-hdp-2019", "figo-pe-first-trimester-2019", "figo-pe-second-third-2021", "acog-pb222-hypertension", "ranzcog-cobs61-preeclampsia", "nice-ng133",
         "who-pe-eclampsia-2011", "who-calcium-2018", "who-antiplatelet-2021", "who-nonsevere-htn-2020", "smfm-aspirin-checklist-2026"},
        {"en": "high blood pressure in pregnancy", "hi": "गर्भावस्था में उच्च रक्तचाप", "ta": "கர்ப்ப காலத்தில் உயர் இரத்த அழுத்தம்", "te": "గర్భధారణలో అధిక రక్తపోటు"}),
    "starting labour": (
        {"fogsi-gcpr-induction-2018", "ranzcog-cobs22-prostaglandins", "nice-ng207", "who-induction-2022", "acog-cpg9-ripening"},
        {"en": "starting labour artificially", "hi": "प्रसव पीड़ा शुरू कराना", "ta": "பிரசவ வலியைத் தூண்டுதல்", "te": "ప్రసవ నొప్పులను ప్రేరేపించడం"}),
    "premature birth": (
        {"nice-ng25", "who-corticosteroids-2022", "who-tocolytics-2022", "smfm-consult70-cervix"},
        {"en": "premature birth", "hi": "समय से पहले प्रसव", "ta": "குறைப்பிரசவம்", "te": "నెలలు నిండకుండానే ప్రసవం"}),
    "caesarean": (
        {"nice-ng192", "ranzcog-cobs38-vbac", "who-caesarean-nonclinical-2018"},
        {"en": "caesarean section", "hi": "सिजेरियन ऑपरेशन से प्रसव", "ta": "சிசேரியன் அறுவை சிகிச்சை", "te": "సిజేరియన్ ఆపరేషన్"}),
    "care after birth": (
        {"mohfw-pnc-2023", "nice-ng194", "who-postnatal-2022"},
        {"en": "care of the mother after birth", "hi": "प्रसव के बाद माँ की देखभाल", "ta": "பிரசவத்திற்குப் பிறகு தாயின் பராமரிப்பு", "te": "ప్రసవం తర్వాత తల్లి సంరక్షణ"}),
    "baby moving less": (
        {"rcog-gtg57-rfm"},
        {"en": "baby moving less", "hi": "बच्चे की हलचल कम होना", "ta": "குழந்தையின் அசைவு குறைவு", "te": "బిడ్డ కదలికలు తగ్గడం"}),
    "infection after birth": (
        {"rcog-gtg64-sepsis", "who-peripartum-infections-2015"},
        {"en": "infection after delivery", "hi": "प्रसव के बाद संक्रमण", "ta": "பிரசவத்திற்குப் பிறகு தொற்று", "te": "ప్రసవం తర్వాత ఇన్ఫెక్షన్"}),
    "thyroid": (
        {"rcog-gtg76-thyroid"},
        {"en": "thyroid problems in pregnancy", "hi": "गर्भावस्था में थायराइड की समस्या", "ta": "கர்ப்ப காலத்தில் தைராய்டு பிரச்சனை", "te": "గర్భధారణలో థైరాయిడ్ సమస్య"}),
    "low mood": (
        {"nice-cg192", "sign-169"},
        {"en": "depression after having a baby", "hi": "बच्चे के जन्म के बाद अवसाद", "ta": "குழந்தை பிறந்த பிறகு மனச்சோர்வு", "te": "బిడ్డ పుట్టిన తర్వాత డిప్రెషన్"}),
    "twins": (
        {"nice-ng137"},
        {"en": "twin pregnancy", "hi": "जुड़वाँ बच्चों की गर्भावस्था", "ta": "இரட்டைக் குழந்தை கர்ப்பம்", "te": "కవలల గర్భం"}),
    "hepatitis B": (
        {"smfm-consult69-hepb"},
        {"en": "hepatitis B in pregnant women", "hi": "गर्भवती महिलाओं में हेपेटाइटिस बी", "ta": "கர்ப்பிணிகளில் ஹெபடைடிஸ் பி", "te": "గర్భిణీలలో హెపటైటిస్ బి"}),
    "blood clots": (
        {"rcog-gtg37a-vte"},
        {"en": "blood clots in pregnancy", "hi": "गर्भावस्था में खून के थक्के", "ta": "கர்ப்ப காலத்தில் இரத்த உறைவு", "te": "గర్భధారణలో రక్తం గడ్డకట్టడం"}),
    "early pregnancy loss": (
        {"nice-ng126"},
        {"en": "miscarriage and ectopic pregnancy", "hi": "गर्भपात और अस्थानिक गर्भावस्था", "ta": "கருச்சிதைவு மற்றும் கருப்பைக்கு வெளியே கர்ப்பம்", "te": "గర్భస్రావం మరియు ఎక్టోపిక్ గర్భం"}),
    "baby growing small": (
        {"rcog-gtg31-sga", "smfm-consult52-fgr"},
        {"en": "baby is growing small", "hi": "गर्भ में बच्चे का कम बढ़ना", "ta": "கருவில் குழந்தை சரியாக வளராதது", "te": "గర్భంలో బిడ్డ సరిగా ఎదగకపోవడం"}),
    "care in labour": (
        {"nice-ng235", "nice-ng229", "nice-ng121", "who-intrapartum-2018", "acog-cpg8-labor", "mohfw-dakshata-2015", "mohfw-laqshya-2017"},
        {"en": "care during labour", "hi": "प्रसव के दौरान देखभाल", "ta": "பிரசவத்தின் போது பராமரிப்பு", "te": "ప్రసవ సమయంలో సంరక్షణ"}),
}
# What a passage must actually say to count as an answer to the topic (a passage that merely comes from a right document, such as its reference list
# or a running page header, is not an answer).
TOPIC_TERMS = {
    "bleeding after birth": r"haemorrhage|hemorrhage|bleeding|blood loss|\bPPH\b|uterotonic|oxytocin|tranexamic",
    "diabetes in pregnancy": r"diabet|glucose|\bGDM\b|glyc[a]?emi|insulin",
    "anaemia": r"an[a]?emi|h[a]?emoglobin|\biron\b|ferritin",
    "high blood pressure": r"hypertens|pre-?eclampsia|blood pressure|eclampsia|antihypertensive",
    "starting labour": r"induc|prostaglandin|oxytocin|misoprostol|ripening|foley|labou?r",
    "premature birth": r"preterm|premature|tocoly|corticosteroid|short cervix",
    "caesarean": r"c[a]?esarean|c-?section|\bVBAC\b",
    "care after birth": r"postnatal|postpartum|puerper|after birth|after delivery",
    "baby moving less": r"f[o]?etal movement|reduced movement|\bkick|movements",
    "infection after birth": r"sepsis|infection|antibiotic|puerperal|endometritis",
    "thyroid": r"thyroid|levothyroxine|\bTSH\b",
    "low mood": r"depress|mental health|anxiety|psychiatric",
    "twins": r"\btwin|triplet|multiple pregnanc|chorionic",
    "hepatitis B": r"hepatitis|\bHBV\b|HBsAg",
    "blood clots": r"thrombo|embol|\bVTE\b|heparin|\bclot",
    "early pregnancy loss": r"miscarriage|ectopic|early pregnancy loss",
    "baby growing small": r"growth restrict|small[- ]for[- ]gestational|\bSGA\b|\bFGR\b|f[o]?etal growth",
    "care in labour": r"labou?r|intrapartum|partograph|birth",
}
TERMS_RE = {topic: re.compile(pattern, re.I) for topic, pattern in TOPIC_TERMS.items()}
# Not in the library: a good search finds nothing for these.
NO_ANSWER = {"en": ["cricket match score", "how to cook biryani", "knee replacement surgery", "mobile phone repair"],
             "hi": ["क्रिकेट मैच का स्कोर", "बिरयानी कैसे बनाएँ", "घुटना बदलने की सर्जरी"],
             "ta": ["கிரிக்கெட் போட்டி மதிப்பெண்", "பிரியாணி செய்வது எப்படி", "முழங்கால் மாற்று அறுவை சிகிச்சை"],
             "te": ["క్రికెట్ మ్యాచ్ స్కోర్", "బిర్యానీ ఎలా వండాలి", "మోకాలి మార్పిడి శస్త్రచికిత్స"]}


def main() -> int:
    details = "--details" in sys.argv
    from app import config

    source = Path(config.DATABASE_URL.replace("sqlite:///", ""))
    if not source.exists():
        print(f"No database at {source}. Start the API once first.")
        return 1
    scratch = tempfile.mkdtemp(prefix="maternasync-eval-")  # a copy: the real database is only read
    shutil.copy(source, Path(scratch) / "copy.db")
    os.environ["MATERNASYNC_DATABASE_URL"] = "sqlite:///" + (Path(scratch) / "copy.db").as_posix()
    os.environ["MATERNASYNC_UPLOAD_DIR"] = scratch + "/uploads"
    for module in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[module]  # settings are read on import: import again against the copy
    from fastapi.testclient import TestClient

    from app import config, models, semantic_search
    from app.database import SessionLocal
    from app.main import app

    if not semantic_search.installed():
        print("The model or its index is missing. Run: python fetch_search_model.py, then python build_semantic_index.py")
        return 1
    with SessionLocal() as db:
        ids = {i.ref_key: i.id for i in db.query(models.ReferenceItem).filter(models.ReferenceItem.ref_key.isnot(None)).all()}
        searchable = {i.ref_key for i in db.query(models.ReferenceItem).all() if i.file_path and Path(i.file_path).is_file()}
    unknown = {r for refs, _ in TOPICS.values() for r in refs} - set(ids)
    if unknown:
        print("These ids are not in the library (fix TOPICS):", sorted(unknown))
        return 1

    def run(client, headers, setting):
        """One pass over every question with the given SEMANTIC_SEARCH setting: {(language): {"ref": [hits, asked], ...}} and the misses."""
        config.SEMANTIC_SEARCH = setting
        tallies: dict = defaultdict(lambda: defaultdict(lambda: [0, 0]))
        missed = []
        for topic, (refs, questions) in TOPICS.items():
            expected = {ids[r] for r in refs}
            with_pdf = bool(refs & searchable)
            for language in LANGUAGES:
                reply = client.get("/api/v2/references", params={"q": questions[language]}, headers=headers).json()
                tally = tallies[language]
                tally["ref"][1] += 1
                found = any(item["id"] in expected for item in reply["items"][:5])
                tally["ref"][0] += found
                if with_pdf:
                    tally["passage"][1] += 1
                    tally["passage"][0] += any(p["itemId"] in expected and TERMS_RE[topic].search(p["text"]) for p in reply["passages"])
                if not found:
                    missed.append((setting, language, topic, questions[language], [i["title"][:40] for i in reply["items"][:3]]))
        for language in LANGUAGES:
            for question in NO_ANSWER[language]:
                reply = client.get("/api/v2/references", params={"q": question}, headers=headers).json()
                tallies[language]["empty"][1] += 1
                tallies[language]["empty"][0] += not reply["items"] and not reply["passages"]
        return tallies, missed

    def totals(tallies):
        return [sum(tallies[l][k][0] for l in LANGUAGES) for k in ("ref", "passage", "empty")], [sum(tallies[l][k][1] for l in LANGUAGES) for k in ("ref", "passage", "empty")]

    results: dict = {}
    misses = []
    with TestClient(app) as client:
        token = client.post("/api/auth/login", json={"email": "demo@maternasync.app", "password": "MaternaDemo123!"}).json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}
        if "--sweep" in sys.argv:  # which floors keep the most right answers while still finding nothing for the unanswerable questions
            print(f"{'ref floor':>10}{'passage floor':>14}{'passage gate':>13}   {'Reference@5':>12}{'Passage@8':>11}{'no-answer ok':>14}   per language Reference@5 (en hi ta te)")
            for item_floor in (0.80, semantic_search.ITEM_FLOOR):
                for passage_floor in (0.82, 0.84):
                    for gate in (0.85, 0.86, 0.87):
                        semantic_search.ITEM_FLOOR, semantic_search.PASSAGE_FLOOR, semantic_search.PASSAGE_GATE = item_floor, passage_floor, gate
                        tallies, _ = run(client, headers, "auto")
                        (a, b, c), (x, y, z) = totals(tallies)
                        print(f"{item_floor:>10}{passage_floor:>14}{gate:>13}   {a:>8}/{x:<3}{b:>8}/{y:<3}{c:>10}/{z:<3}   " + "  ".join(f"{tallies[l]['ref'][0]:>2}" for l in LANGUAGES))
            config.SEMANTIC_SEARCH = "auto"
            shutil.rmtree(scratch, ignore_errors=True)
            return 0
        for mode, setting in (("words", "off"), ("words + meaning", "auto")):
            tallies, missed = run(client, headers, setting)
            for language in LANGUAGES:
                results[(mode, language)] = tallies[language]
            misses += [(mode,) + m[1:] for m in missed]
        config.SEMANTIC_SEARCH = "auto"

    print(f"{len(TOPICS)} topics x 4 languages; {sum(len(v) for v in NO_ANSWER.values())} questions with no answer in the library\n")
    print(f"{'':<5}" + "".join(f"{mode:^38}" for mode in ("words", "words + meaning")))
    print(f"{'lang':<5}" + "".join(f"{'Reference@5':>14}{'Passage@8':>12}{'no-answer ok':>12}" for _ in range(2)))
    for language in LANGUAGES:
        row = f"{language:<5}"
        for mode in ("words", "words + meaning"):
            t = results[(mode, language)]
            row += f"{t['ref'][0]:>9}/{t['ref'][1]:<4}{t['passage'][0]:>7}/{t['passage'][1]:<4}{t['empty'][0]:>8}/{t['empty'][1]:<3}"
        print(row)
    total = {mode: [sum(results[(mode, l)][k][0] for l in LANGUAGES) for k in ("ref", "passage", "empty")] for mode in ("words", "words + meaning")}
    asked = [sum(results[("words", l)][k][1] for l in LANGUAGES) for k in ("ref", "passage", "empty")]
    print(f"{'all':<5}" + "".join(f"{total[m][0]:>9}/{asked[0]:<4}{total[m][1]:>7}/{asked[1]:<4}{total[m][2]:>8}/{asked[2]:<3}" for m in ("words", "words + meaning")))
    if details:
        print("\nSearches where no right reference was in the first 5:")
        for mode, language, topic, question, got in misses:
            print(f"  [{mode:<15}] {language} {topic:<22} {question!r:<48} -> {got}")
    shutil.rmtree(scratch, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
