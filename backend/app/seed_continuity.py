"""Idempotent synthetic demo entries and unapproved starter resources.

Official links are pointers, not redistributed guidance or claims of currency.
Nothing clinical is pre-approved on behalf of a real clinician.
"""
import json
from datetime import timedelta
from pathlib import Path
from . import models
from .continuity_service import now


EDUCATION_TOPICS = [("Nutrition", "first"), ("Safe movement", "second"), ("Labour preparation", "third"),
                    ("Birth-plan discussions", "third"), ("Postpartum recovery", "postpartum"), ("Lactation", "postpartum")]
# Non-prescriptive discussion guides in each supported language. They start as drafts: a doctor
# reviews and approves them before patients (or the care companion) can see them.
EDUCATION_LOCAL = {
    "hi": {"Nutrition": "पोषण", "Safe movement": "सुरक्षित गतिविधि", "Labour preparation": "प्रसव की तैयारी", "Birth-plan discussions": "जन्म योजना",
           "Postpartum recovery": "प्रसव के बाद स्वास्थ्य लाभ", "Lactation": "स्तनपान"},
    "ta": {"Nutrition": "ஊட்டச்சத்து", "Safe movement": "பாதுகாப்பான உடல் இயக்கம்", "Labour preparation": "பிரசவத் தயாரிப்பு", "Birth-plan discussions": "பிரசவத் திட்டம்",
           "Postpartum recovery": "பிரசவத்திற்குப் பிந்தைய மீட்பு", "Lactation": "தாய்ப்பால் ஊட்டல்"},
    "te": {"Nutrition": "పోషకాహారం", "Safe movement": "సురక్షితమైన కదలిక", "Labour preparation": "ప్రసవ సన్నద్ధత", "Birth-plan discussions": "ప్రసవ ప్రణాళిక",
           "Postpartum recovery": "ప్రసవానంతర కోలుకోవడం", "Lactation": "తల్లిపాలు ఇవ్వడం"},
}
EDUCATION_TITLE = {"hi": "{topic} पर चर्चा की तैयारी", "ta": "{topic} பற்றி உரையாடத் தயாராகுதல்", "te": "{topic} గురించి చర్చకు సిద్ధం కావడం"}
EDUCATION_BODY = {
    "hi": "अपनी अगली मुलाक़ात में अपनी मातृत्व देखभाल टीम से {topic} पर बात करें। अपने प्रश्न साथ लाएँ और टीम से कहें कि आपके लिए लागू निर्देश लिख दें। यह भाग केवल चर्चा का मार्गदर्शन है और आपकी दर्ज देखभाल योजना को नहीं बदलता।",
    "ta": "உங்கள் அடுத்த சந்திப்பில் உங்கள் மகப்பேறு பராமரிப்புக் குழுவுடன் {topic} பற்றிப் பேசுங்கள். உங்கள் கேள்விகளைக் கொண்டு வாருங்கள்; உங்களுக்குப் பொருந்தும் அறிவுரைகளை எழுதித் தருமாறு குழுவிடம் கேளுங்கள். இந்தப் பகுதி உரையாடலுக்கான வழிகாட்டி மட்டுமே; உங்கள் பதிவு செய்யப்பட்ட பராமரிப்புத் திட்டத்தை இது மாற்றாது.",
    "te": "మీ తదుపరి సందర్శనలో మీ ప్రసూతి సంరక్షణ బృందంతో {topic} గురించి చర్చించండి. మీ ప్రశ్నలను తీసుకురండి, మీకు వర్తించే సూచనలను రాసివ్వమని బృందాన్ని అడగండి. ఈ విభాగం చర్చకు మార్గదర్శి మాత్రమే; మీ నమోదైన సంరక్షణ ప్రణాళికను ఇది మార్చదు.",
}


# (title, metric, "greater than" threshold, review priority, next action). Blood-pressure bands follow the severity
# definitions in NICE NG133 (mild 140/90, severe 160/110); a reading AT the band triggers, hence thresholds of 139/89/159/109.
REVIEW_RULES = [
    ("Severe-range systolic BP reading (160 mmHg or higher)", "systolic", 159, "urgent",
     "Review this reading today and decide what the patient needs, including whether to contact them now."),
    ("Severe-range diastolic BP reading (110 mmHg or higher)", "diastolic", 109, "urgent",
     "Review this reading today and decide what the patient needs, including whether to contact them now."),
    ("Raised systolic BP reading (140 mmHg or higher)", "systolic", 139, "soon",
     "Review at the next opportunity and decide whether to contact the patient or ask for a repeat reading."),
    ("Raised diastolic BP reading (90 mmHg or higher)", "diastolic", 89, "soon",
     "Review at the next opportunity and decide whether to contact the patient or ask for a repeat reading."),
    ("No agreed check-in for more than 7 days", "missing_days", 7, "routine",
     "Contact the patient to ask whether they need help completing check-ins. A missing entry is not evidence of a problem."),
    ("Overdue follow-up task", "overdue_task_days", 0, "routine",
     "Follow up the overdue task or reassign it."),
]


# Short, non-prescriptive explanations of conditions a visit note may mention. They start as drafts; the patient
# explanation generator and the care companion only use them after a doctor approves them. Each source is the
# guideline the topic belongs to; the wording is plain-language and for the clinician to confirm.
CONDITION_SOURCES = {
    "Gestational diabetes": "https://www.nice.org.uk/guidance/ng3",
    "High blood pressure in pregnancy": "https://www.nice.org.uk/guidance/ng133",
    "Anaemia in pregnancy": "https://www.nice.org.uk/guidance/ng201",
    "Ultrasound scans in pregnancy": "https://www.nice.org.uk/guidance/ng201",
}
CONDITION_TEXT = {
    "Gestational diabetes": {
        "en": ("About gestational diabetes", "Gestational diabetes means a higher than usual blood sugar that is found for the first time during pregnancy. In many women it goes away after the baby is born, but your team will tell you about follow-up tests. Your doctor will explain how your blood sugar is checked and what plan is right for you. Ask your team to write down your plan if you are unsure."),
        "hi": ("गर्भावस्था के मधुमेह के बारे में", "गर्भावस्था का मधुमेह यानी गर्भावस्था में पहली बार पता चला सामान्य से अधिक रक्त शर्करा स्तर। कई महिलाओं में यह बच्चे के जन्म के बाद ठीक हो जाता है, लेकिन आपकी टीम आपको आगे की जाँचों के बारे में बताएगी। आपका डॉक्टर समझाएगा कि आपकी रक्त शर्करा की जाँच कैसे होती है और आपके लिए कौन-सी योजना सही है। यदि आप निश्चित नहीं हैं तो टीम से योजना लिखकर देने को कहें।"),
        "ta": ("கர்ப்பகால நீரிழிவு பற்றி", "கர்ப்பகால நீரிழிவு என்பது கர்ப்பத்தில் முதன்முறையாகக் கண்டறியப்படும், வழக்கத்தை விட அதிகமான இரத்தச் சர்க்கரை அளவு ஆகும். பல பெண்களுக்கு குழந்தை பிறந்த பிறகு இது சரியாகிவிடும்; ஆனால் தொடர் பரிசோதனைகள் பற்றி உங்கள் குழு தெரிவிக்கும். உங்கள் இரத்தச் சர்க்கரை எவ்வாறு பரிசோதிக்கப்படுகிறது, உங்களுக்கு எந்தத் திட்டம் பொருந்தும் என்பதை மருத்துவர் விளக்குவார். உறுதியாகத் தெரியவில்லை என்றால் திட்டத்தை எழுதித் தருமாறு குழுவிடம் கேளுங்கள்."),
        "te": ("గర్భధారణ మధుమేహం గురించి", "గర్భధారణ మధుమేహం అంటే గర్భధారణలో మొదటిసారి కనుగొనే, సాధారణం కంటే ఎక్కువ రక్తంలో చక్కెర స్థాయి. చాలా మంది మహిళల్లో బిడ్డ పుట్టిన తర్వాత ఇది తగ్గిపోతుంది, కానీ తదుపరి పరీక్షల గురించి మీ బృందం చెబుతుంది. మీ రక్తంలో చక్కెరను ఎలా పరీక్షిస్తారో, మీకు ఏ ప్రణాళిక సరైనదో డాక్టర్ వివరిస్తారు. మీకు స్పష్టత లేకపోతే ప్రణాళికను రాసివ్వమని బృందాన్ని అడగండి."),
    },
    "High blood pressure in pregnancy": {
        "en": ("About high blood pressure in pregnancy", "Your blood pressure is checked at your visits because high blood pressure in pregnancy can affect you and your baby. Your team may also check your urine and ask how you are feeling. If you get a severe headache, changes in your vision, or pain just below your ribs, contact your maternity team straight away. Your doctor will explain what your readings mean for you."),
        "hi": ("गर्भावस्था में उच्च रक्तचाप के बारे में", "गर्भावस्था में उच्च रक्तचाप आपको और आपके बच्चे को प्रभावित कर सकता है, इसलिए हर मुलाक़ात में आपका रक्तचाप जाँचा जाता है। आपकी टीम मूत्र की जाँच भी कर सकती है और आपसे पूछ सकती है कि आप कैसा महसूस कर रही हैं। यदि आपको तेज़ सिरदर्द हो, दिखने में बदलाव आए, या पसलियों के ठीक नीचे दर्द हो, तो तुरंत अपनी मातृत्व टीम से संपर्क करें। आपकी रीडिंग का आपके लिए क्या मतलब है, यह डॉक्टर समझाएँगे।"),
        "ta": ("கர்ப்பகாலத்தில் அதிக இரத்த அழுத்தம் பற்றி", "கர்ப்பகாலத்தில் அதிக இரத்த அழுத்தம் உங்களையும் உங்கள் குழந்தையையும் பாதிக்கக்கூடும்; அதனால் ஒவ்வொரு வருகையிலும் உங்கள் இரத்த அழுத்தம் பரிசோதிக்கப்படுகிறது. உங்கள் குழு சிறுநீரையும் பரிசோதித்து, நீங்கள் எப்படி உணர்கிறீர்கள் என்றும் கேட்கலாம். கடுமையான தலைவலி, பார்வையில் மாற்றம், அல்லது விலா எலும்புகளுக்குக் கீழே வலி ஏற்பட்டால் உடனே உங்கள் மகப்பேறு குழுவைத் தொடர்புகொள்ளுங்கள். உங்கள் அளவீடுகள் உங்களுக்கு என்ன பொருள் என்பதை மருத்துவர் விளக்குவார்."),
        "te": ("గర్భధారణలో అధిక రక్తపోటు గురించి", "గర్భధారణలో అధిక రక్తపోటు మీపై మరియు మీ బిడ్డపై ప్రభావం చూపవచ్చు, అందుకే ప్రతి సందర్శనలో మీ రక్తపోటును పరీక్షిస్తారు. మీ బృందం మూత్ర పరీక్ష కూడా చేసి, మీరు ఎలా ఉన్నారో అడగవచ్చు. తీవ్రమైన తలనొప్పి, చూపులో మార్పులు, లేదా పక్కటెముకల కింద నొప్పి వస్తే వెంటనే మీ ప్రసూతి బృందాన్ని సంప్రదించండి. మీ రీడింగ్‌లు మీకు ఏమి సూచిస్తాయో డాక్టర్ వివరిస్తారు."),
    },
    "Anaemia in pregnancy": {
        "en": ("About anaemia in pregnancy", "Anaemia means your blood has less haemoglobin than it needs to carry oxygen around your body. It is common in pregnancy, and a blood test shows whether you have it. If your doctor advises iron and folic acid tablets, take them as directed and tell your team about any problems with them. Your doctor will explain what your result means for you."),
        "hi": ("गर्भावस्था में एनीमिया के बारे में", "एनीमिया का मतलब है कि आपके रक्त में शरीर में ऑक्सीजन पहुँचाने के लिए ज़रूरी हीमोग्लोबिन कम है। यह गर्भावस्था में आम है, और रक्त जाँच से पता चलता है कि आपको यह है या नहीं। यदि आपके डॉक्टर आयरन और फोलिक एसिड की गोलियाँ लेने की सलाह देते हैं, तो उन्हें निर्देशानुसार लें और उनसे कोई परेशानी हो तो अपनी टीम को बताएँ। आपके परिणाम का आपके लिए क्या मतलब है, यह डॉक्टर समझाएँगे।"),
        "ta": ("கர்ப்பகாலத்தில் இரத்தசோகை பற்றி", "இரத்தசோகை என்பது உங்கள் உடல் முழுவதும் ஆக்சிஜனைக் கொண்டு செல்லத் தேவையான ஹீமோகுளோபின் உங்கள் இரத்தத்தில் குறைவாக இருப்பதைக் குறிக்கும். இது கர்ப்பகாலத்தில் பொதுவானது; இரத்தப் பரிசோதனையில் உங்களுக்கு இது உள்ளதா என்று தெரியும். இரும்பு மற்றும் ஃபோலிக் அமில மாத்திரைகளை மருத்துவர் பரிந்துரைத்தால், அவற்றை அறிவுறுத்தப்பட்டபடி எடுத்துக்கொண்டு, ஏதேனும் சிரமம் இருந்தால் உங்கள் குழுவிடம் தெரிவியுங்கள். உங்கள் முடிவு உங்களுக்கு என்ன பொருள் என்பதை மருத்துவர் விளக்குவார்."),
        "te": ("గర్భధారణలో రక్తహీనత గురించి", "రక్తహీనత అంటే మీ శరీరమంతటా ఆక్సిజన్‌ను తీసుకెళ్లడానికి అవసరమైన హీమోగ్లోబిన్ మీ రక్తంలో తక్కువగా ఉండటం. ఇది గర్భధారణలో సాధారణం, రక్త పరీక్షలో మీకు ఇది ఉందో లేదో తెలుస్తుంది. ఇనుము మరియు ఫోలిక్ యాసిడ్ మాత్రలు తీసుకోమని డాక్టర్ సలహా ఇస్తే, వాటిని సూచించినట్లు తీసుకోండి, వాటితో ఏదైనా ఇబ్బంది ఉంటే మీ బృందానికి చెప్పండి. మీ ఫలితం మీకు ఏమి సూచిస్తుందో డాక్టర్ వివరిస్తారు."),
    },
    "Ultrasound scans in pregnancy": {
        "en": ("About ultrasound scans in pregnancy", "An ultrasound scan uses sound waves to make a picture of your baby. Scans can show how your baby is growing, the baby's position, where the placenta is and the amount of fluid around the baby. Your doctor will explain what a particular scan found. Scans do not replace your regular check-ups."),
        "hi": ("गर्भावस्था में अल्ट्रासाउंड स्कैन के बारे में", "अल्ट्रासाउंड स्कैन ध्वनि तरंगों से आपके बच्चे की तस्वीर बनाता है। स्कैन से पता चल सकता है कि बच्चा कैसे बढ़ रहा है, बच्चे की स्थिति क्या है, प्लेसेंटा कहाँ है और बच्चे के चारों ओर कितना तरल है। किसी विशेष स्कैन में क्या दिखा, यह आपका डॉक्टर समझाएगा। स्कैन आपकी नियमित जाँचों की जगह नहीं लेते।"),
        "ta": ("கர்ப்பகாலத்தில் அல்ட்ராசவுண்ட் ஸ்கேன் பற்றி", "அல்ட்ராசவுண்ட் ஸ்கேன் ஒலி அலைகளைப் பயன்படுத்தி உங்கள் குழந்தையின் படத்தை உருவாக்குகிறது. குழந்தை எவ்வாறு வளர்கிறது, குழந்தையின் நிலை, நஞ்சுக்கொடி எங்கே உள்ளது, குழந்தையைச் சுற்றியுள்ள திரவத்தின் அளவு ஆகியவற்றை ஸ்கேன் காட்டக்கூடும். ஒரு குறிப்பிட்ட ஸ்கேனில் என்ன தெரிந்தது என்பதை உங்கள் மருத்துவர் விளக்குவார். ஸ்கேன்கள் உங்கள் வழக்கமான பரிசோதனைகளுக்கு மாற்றல்ல."),
        "te": ("గర్భధారణలో అల్ట్రాసౌండ్ స్కాన్ల గురించి", "అల్ట్రాసౌండ్ స్కాన్ ధ్వని తరంగాలతో మీ బిడ్డ చిత్రాన్ని రూపొందిస్తుంది. బిడ్డ ఎలా ఎదుగుతోందో, బిడ్డ స్థితి, మాయ ఎక్కడ ఉందో, బిడ్డ చుట్టూ ఉన్న ద్రవం పరిమాణం స్కాన్‌లో తెలియవచ్చు. ఒక నిర్దిష్ట స్కాన్‌లో ఏమి కనిపించిందో మీ డాక్టర్ వివరిస్తారు. స్కాన్‌లు మీ క్రమం తప్పని పరీక్షలకు ప్రత్యామ్నాయం కావు."),
    },
}


DATA_DIR = Path(__file__).resolve().parent / "data"


def icd10_sets():
    """WHO ICD-10 obstetric codes as reviewed phrase->code sets (drafts until a doctor approves them).
    A set holds at most 200 phrase entries, so the list is split by code order."""
    source = json.loads((DATA_DIR / "icd10_obstetric.json").read_text(encoding="utf-8"))
    parts, current, count = [], [], 0
    for code in source["codes"]:
        if count + len(code["phrases"]) > 190 and current:
            parts.append(current)
            current, count = [], 0
        current.append(code)
        count += len(code["phrases"])
    parts.append(current)
    sets = []
    for number, codes in enumerate(parts, start=1):
        sets.append(dict(
            key=f"icd10-who-obstetric-{number}", kind="coding", title=f"WHO ICD-10 obstetric codes (part {number} of {len(parts)}: {codes[0]['code']} to {codes[-1]['code']})",
            issuer="WHO (ICD-10, 2019 version); matching phrases to be reviewed by the clinic", topic="ICD-10 coding", jurisdiction="International",
            source_url=source["browse_url"], section="Tabular list, 2019 version",
            publication_date="2019", content=source["note"],
            configuration={"entries": [{"code": c["code"], "label": c["title"], "match": phrase} for c in codes for phrase in c["phrases"]]}))
    return sets


def drug_safety_set():
    """Label-sourced interaction pairs and pregnancy cautions for the prescription safety check (a draft until a doctor approves it)."""
    config = json.loads((DATA_DIR / "drug_safety_labels.json").read_text(encoding="utf-8"))
    return dict(
        key="drug-safety-labels", kind="interaction", title="Drug safety checks from US product labels (DailyMed)",
        issuer="FDA-approved product labelling on DailyMed; selection to be reviewed by the clinic", topic="Drug safety", jurisdiction="United States",
        source_url="https://dailymed.nlm.nih.gov/", section="Boxed warnings, contraindications and drug-interaction sections", publication_date="2026",
        content=(f"A limited list of {len(config['pairs'])} drug interactions and {len(config['cautions'])} pregnancy cautions taken from US FDA product labels on DailyMed (read in October 2026). "
                 "Every entry quotes the label wording and links to the label. Medicines are matched by generic name; brand names are not recognised. "
                 "US labels can differ from the products used in India, and this is not a complete interaction database. A doctor should review the entries "
                 "and can extend the list by creating a new version."),
        configuration=config)


# A home location for each demonstration patient, so Profile and Emergency help show a saved location. They are
# neighbourhood centres, marked "(demo)". A patient's own entry is never overwritten.
DEMO_LOCATIONS = {
    "sarah.jenkins@maternasync.app": ("Anna Nagar, Chennai (demo)", 13.0850, 80.2101),
    "priya.sharma@maternasync.app": ("Lajpat Nagar, New Delhi (demo)", 28.5677, 77.2433),
    "ananya.kumar@maternasync.app": ("Indiranagar, Bengaluru (demo)", 12.9719, 77.6412),
    "meera.raj@maternasync.app": ("Banjara Hills, Hyderabad (demo)", 17.4156, 78.4347),
}


def ensure_demo_locations(db):
    added = 0
    for email, (label, lat, lon) in DEMO_LOCATIONS.items():
        user = db.query(models.User).filter_by(email=email).first()
        if user and not db.get(models.PatientEmergencyProfile, user.id):
            db.add(models.PatientEmergencyProfile(user_id=user.id, home_label=label, home_lat=lat, home_lon=lon, live_location=False))
            added += 1
    if added:
        db.commit()
        print(f"Added a demonstration location for {added} demo patient(s).")


def run_seed_continuity(db):
    doctor = db.query(models.User).filter_by(email="demo@maternasync.app").first()
    if not doctor:
        return
    # Guideline documents come from app/reference_library.py (real, verified publications), not from here.
    resources = []
    for title, fields in [
        ("SOAP", ["Subjective", "Objective", "Assessment", "Plan"]),
        ("ANC visit", ["Visit context", "Patient concerns", "Verified findings", "Confirmed plan"]),
        ("Follow-up", ["Since last visit", "Outstanding items", "Confirmed next steps"]),
        ("Handover", ["Context", "What happened", "What remains", "Owner", "What to discuss"]),
    ]:
        resources.append(dict(key="template-" + title, kind="template", title=title, issuer="Clinic template owner", topic="Documentation",
            content="Blank documentation structure. Complete from recorded facts and review before approval.", configuration={"fields": fields, "required": fields, "default": title == "SOAP"}))
    for topic in ("GDM", "Pre-eclampsia", "Anaemia"):
        resources.append(dict(key="pathway-" + topic, kind="pathway", title=f"{topic} — coordination pathway", issuer="Clinical governance review required", topic=topic,
            source_url="https://www.icmr.gov.in/standard-treatment-workflows-stws", section="Local administrative pathway",
            content="Starter administrative workflow only. A clinician must adapt the steps and timing to the documented care plan, approve the version, and confirm enrollment.",
            configuration={"steps": [{"title": "Confirm the documented follow-up plan with the assigned clinician", "days": 0}, {"title": "Contact patient to arrange the clinician-requested follow-up", "days": 1}]}))
    resources.extend(icd10_sets())
    resources.append(drug_safety_set())
    for topic, versions in CONDITION_TEXT.items():
        for language, (title, body) in versions.items():
            resources.append(dict(key=f"condition-{topic}-{language}", kind="education", language=language, title=title, issuer="Clinic education owner", topic=topic,
                stage="all", source_url=CONDITION_SOURCES[topic], section="Patient explanation draft for clinician confirmation", content=body))
    for title, metric, threshold, tier, action in REVIEW_RULES:
        resources.append(dict(key="rule-" + title, kind="rule", title=title, issuer="Clinic governance owner (thresholds from NICE NG133)", topic="Review rules",
            jurisdiction="United Kingdom", source_url="https://www.nice.org.uk/guidance/ng133", section="Hypertension in pregnancy: severity of hypertension",
            content=("Review flag for patient-reported values. A flag asks a clinician to look; it is not a diagnosis and it never contacts the patient or changes the record by itself. "
                     "Patient-entered readings may be inaccurate. Confirm the threshold against your own protocol before approving."
                     if metric in ("systolic", "diastolic") else
                     "Administrative review flag. It asks a clinician or coordinator to follow up; it is not evidence of a clinical problem or of non-adherence."),
            configuration={"metric": metric, "operator": "gt", "threshold": threshold, "tier": tier, "nextAction": action}))
    for topic, stage in EDUCATION_TOPICS:
        resources.append(dict(key="education-" + topic, kind="education", title=f"Preparing to discuss {topic.lower()}", issuer="Clinic education owner", topic=topic, stage=stage,
            source_url="https://www.who.int/publications/i/item/9789241549912", section="Local patient education draft",
            content=f"Use your next visit to discuss {topic.lower()} with your maternity team. Bring your questions and ask the team to write down the instructions that apply to you. This module is a discussion guide and does not change your documented care plan."))
        for language, names in EDUCATION_LOCAL.items():
            name = names[topic]
            resources.append(dict(key=f"education-{topic}-{language}", kind="education", language=language, title=EDUCATION_TITLE[language].format(topic=name),
                issuer="Clinic education owner", topic=topic, stage=stage, source_url="https://www.who.int/publications/i/item/9789241549912",
                section="Local patient education draft", content=EDUCATION_BODY[language].format(topic=name)))
    for item in resources:
        key = "starter-" + item.pop("key")
        if not db.query(models.ClinicalResource).filter_by(family_id=key).first():
            db.add(models.ClinicalResource(**item, family_id=key, version=1, status="DRAFT", review_due=(now().date() + timedelta(days=180)).isoformat(), created_by_user_id=doctor.id))
    # Keep a small reproducible synthetic trend, never modify patient-entered logs.
    ep = db.query(models.PregnancyEpisode).join(models.User, models.User.id == models.PregnancyEpisode.patient_user_id).filter(models.User.email == "sarah.jenkins@maternasync.app").first()
    if ep and not db.query(models.AuditLog).filter_by(action="continuity_demo_seeded", episode_id=ep.id).first():
        for offset, systolic, weight in [(12, 112, 66.0), (8, 116, 66.4), (5, 114, 66.5), (2, 118, 66.8)]:
            db.add(models.DailyLog(episode_id=ep.id, recorded_at=now() - timedelta(days=offset), systolic=systolic, diastolic=74, weight_kg=weight,
                mood="okay", adherence="not_recorded", symptoms="Synthetic demo check-in"))
        db.add(models.AuditLog(episode_id=ep.id, actor_user_id=doctor.id, actor_role="doctor", action="continuity_demo_seeded", title="Synthetic continuity demo data created"))
    db.commit()
