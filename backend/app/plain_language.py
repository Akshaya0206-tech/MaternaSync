"""Deterministic plain-language drafting for visit summaries and lab explanations.

Nothing here calls a language model or machine-translates clinical text.
The builders reorganize what a clinician already approved (or what a verified
document literally says) into patient-friendly sections, expand a small
reviewed set of abbreviations, add general "what this test measures" notes,
and list each result next to the range *printed on the report*. It never says
whether a result is normal, high or low. Anything that would be a clinical
judgement (what a result means for this patient, what to do next) is left as
an explicit placeholder that blocks approval until the doctor writes or
removes it.
"""
import re
from datetime import datetime, timezone

LANGUAGES = ("en", "hi", "ta", "te")
SECTIONED_KINDS = ("visit_summary", "explanation", "lab_explanation")
PLACEHOLDER_MARKERS = ("[Clinician to", "[Complete from", "[Add with")

# --------------------------------------------------------------------------
# Fixed interface text (headings and standard sentences) in four languages.
# Placeholders addressed to the clinician are always English: they are never
# shown to a patient because approval is blocked while one remains.
# --------------------------------------------------------------------------
T = {
    "title_visit": {
        "en": "Plain-language visit summary",
        "hi": "सरल भाषा में मुलाक़ात का सारांश",
        "ta": "வருகையின் எளிய மொழிச் சுருக்கம்",
        "te": "సందర్శన సారాంశం (సులభ భాషలో)",
    },
    "title_explanation": {
        "en": "Plain-language explanation",
        "hi": "सरल भाषा में स्पष्टीकरण",
        "ta": "எளிய மொழி விளக்கம்",
        "te": "సులభ భాషలో వివరణ",
    },
    "title_lab": {
        "en": "Plain-language lab report explanation",
        "hi": "सरल भाषा में जाँच रिपोर्ट की व्याख्या",
        "ta": "ஆய்வக அறிக்கையின் எளிய மொழி விளக்கம்",
        "te": "ల్యాబ్ నివేదిక వివరణ (సులభ భాషలో)",
    },
    "intro_visit": {
        "en": "This is a plain-language summary of your visit on {date}. It was prepared from the notes your doctor approved, and your doctor reviewed it before sharing it with you. It does not replace advice from your care team.",
        "hi": "यह {date} की आपकी मुलाक़ात का सरल भाषा में सारांश है। इसे आपके डॉक्टर द्वारा स्वीकृत नोट्स से तैयार किया गया है और साझा करने से पहले डॉक्टर ने इसकी समीक्षा की है। यह आपकी देखभाल टीम की सलाह का विकल्प नहीं है।",
        "ta": "இது {date} அன்று நடந்த உங்கள் வருகையின் எளிய மொழிச் சுருக்கம். உங்கள் மருத்துவர் அங்கீகரித்த குறிப்புகளிலிருந்து இது தயாரிக்கப்பட்டது; உங்களுடன் பகிரும் முன் மருத்துவர் இதை மதிப்பாய்வு செய்தார். இது உங்கள் பராமரிப்புக் குழுவின் ஆலோசனைக்கு மாற்றல்ல.",
        "te": "ఇది {date} నాటి మీ సందర్శనకు సంబంధించిన సులభ భాషా సారాంశం. మీ డాక్టర్ ఆమోదించిన నోట్స్ నుండి దీన్ని తయారు చేశారు, మీతో పంచుకునే ముందు డాక్టర్ దీన్ని సమీక్షించారు. ఇది మీ సంరక్షణ బృందం సలహాకు ప్రత్యామ్నాయం కాదు.",
    },
    "intro_lab": {
        "en": "These notes explain your lab report in simple words. They do not give a diagnosis. Your doctor reviewed them before sharing them with you. Report: {title}.",
        "hi": "ये नोट्स आपकी जाँच रिपोर्ट को सरल शब्दों में समझाते हैं। ये निदान नहीं देते। आपके साथ साझा करने से पहले डॉक्टर ने इनकी समीक्षा की है। रिपोर्ट: {title}।",
        "ta": "இந்தக் குறிப்புகள் உங்கள் ஆய்வக அறிக்கையை எளிய சொற்களில் விளக்குகின்றன. இவை நோய் கண்டறிதல் அல்ல. உங்களுடன் பகிரும் முன் மருத்துவர் இவற்றை மதிப்பாய்வு செய்தார். அறிக்கை: {title}.",
        "te": "ఈ నోట్స్ మీ ల్యాబ్ నివేదికను సరళమైన మాటల్లో వివరిస్తాయి. ఇవి రోగ నిర్ధారణ ఇవ్వవు. మీతో పంచుకునే ముందు డాక్టర్ వీటిని సమీక్షించారు. నివేదిక: {title}.",
    },
    "sec_happened": {
        "en": "What happened at your visit",
        "hi": "आपकी मुलाक़ात में क्या हुआ",
        "ta": "உங்கள் வருகையில் என்ன நடந்தது",
        "te": "మీ సందర్శనలో ఏం జరిగింది",
    },
    "intro_explanation": {
        "en": "This explains the main topics from your visit on {date} in plain words. It was prepared from the notes your doctor approved, and your doctor reviewed it before sharing it with you. It does not replace advice from your care team.",
        "hi": "यह {date} की आपकी मुलाक़ात के मुख्य विषयों को सरल शब्दों में समझाता है। इसे आपके डॉक्टर द्वारा स्वीकृत नोट्स से तैयार किया गया है और साझा करने से पहले डॉक्टर ने इसकी समीक्षा की है। यह आपकी देखभाल टीम की सलाह का विकल्प नहीं है।",
        "ta": "இது {date} அன்று நடந்த உங்கள் வருகையின் முக்கியத் தலைப்புகளை எளிய சொற்களில் விளக்குகிறது. உங்கள் மருத்துவர் அங்கீகரித்த குறிப்புகளிலிருந்து இது தயாரிக்கப்பட்டது; உங்களுடன் பகிரும் முன் மருத்துவர் இதை மதிப்பாய்வு செய்தார். இது உங்கள் பராமரிப்புக் குழுவின் ஆலோசனைக்கு மாற்றல்ல.",
        "te": "ఇది {date} నాటి మీ సందర్శనలోని ముఖ్యమైన అంశాలను సులభమైన మాటల్లో వివరిస్తుంది. మీ డాక్టర్ ఆమోదించిన నోట్స్ నుండి దీన్ని తయారు చేశారు, మీతో పంచుకునే ముందు డాక్టర్ దీన్ని సమీక్షించారు. ఇది మీ సంరక్షణ బృందం సలహాకు ప్రత్యామ్నాయం కాదు.",
    },
    "sec_discussed": {
        "en": "What your doctor discussed",
        "hi": "आपके डॉक्टर ने क्या चर्चा की",
        "ta": "உங்கள் மருத்துவர் என்ன பேசினார்",
        "te": "మీ డాక్టర్ ఏం చర్చించారు",
    },
    "sec_record": {
        "en": "From your record",
        "hi": "आपके रिकॉर्ड से",
        "ta": "உங்கள் பதிவிலிருந்து",
        "te": "మీ రికార్డు నుండి",
    },
    "sec_next": {
        "en": "Your confirmed next steps",
        "hi": "आपके पुष्ट अगले कदम",
        "ta": "உறுதி செய்யப்பட்ட உங்கள் அடுத்த படிகள்",
        "te": "నిర్ధారించిన మీ తదుపరి అడుగులు",
    },
    "sec_general": {
        "en": "General information (not specific to you)",
        "hi": "सामान्य जानकारी (आपके लिए विशेष नहीं)",
        "ta": "பொதுவான தகவல் (உங்களுக்கே உரியது அல்ல)",
        "te": "సాధారణ సమాచారం (మీకు ప్రత్యేకమైనది కాదు)",
    },
    "sec_terms": {
        "en": "Words explained",
        "hi": "शब्दों की व्याख्या",
        "ta": "சொற்களின் விளக்கம்",
        "te": "పదాల వివరణ",
    },
    "sec_questions": {
        "en": "Your open questions",
        "hi": "आपके अनुत्तरित प्रश्न",
        "ta": "உங்கள் பதிலளிக்கப்படாத கேள்விகள்",
        "te": "మీ సమాధానం రాని ప్రశ్నలు",
    },
    "sec_results": {
        "en": "Results on your report",
        "hi": "आपकी रिपोर्ट के परिणाम",
        "ta": "உங்கள் அறிக்கையில் உள்ள முடிவுகள்",
        "te": "మీ నివేదికలోని ఫలితాలు",
    },
    "sec_measure": {
        "en": "About these tests (general information, not about your result)",
        "hi": "इन जाँचों के बारे में (सामान्य जानकारी, आपके परिणाम के बारे में नहीं)",
        "ta": "இந்தப் பரிசோதனைகள் பற்றி (பொதுவான தகவல், உங்கள் முடிவைப் பற்றியது அல்ல)",
        "te": "ఈ పరీక్షల గురించి (సాధారణ సమాచారం, మీ ఫలితం గురించి కాదు)",
    },
    "sec_means": {
        "en": "What this means for you",
        "hi": "आपके लिए इसका क्या मतलब है",
        "ta": "இது உங்களுக்கு என்ன பொருள்",
        "te": "ఇది మీకు అర్థం ఏమిటి",
    },
    "means_default": {
        "en": "Your doctor will explain what your results mean for you.",
        "hi": "आपके परिणामों का आपके लिए क्या मतलब है, यह आपके डॉक्टर समझाएँगे।",
        "ta": "உங்கள் முடிவுகள் உங்களுக்கு என்ன பொருள் என்பதை உங்கள் மருத்துவர் விளக்குவார்.",
        "te": "మీ ఫలితాలు మీకు ఏమి సూచిస్తాయో మీ డాక్టర్ వివరిస్తారు.",
    },
    "general_note": {
        "en": "This is general information that your clinic has reviewed. It is not advice for your own situation. Follow the instructions your doctor confirmed above.",
        "hi": "यह सामान्य जानकारी है जिसकी आपके क्लिनिक ने समीक्षा की है। यह आपकी अपनी स्थिति के लिए सलाह नहीं है। ऊपर आपके डॉक्टर द्वारा पुष्ट निर्देशों का पालन करें।",
        "ta": "இது உங்கள் மருத்துவமனை மதிப்பாய்வு செய்த பொதுவான தகவல். இது உங்கள் சொந்த நிலைக்கான ஆலோசனை அல்ல. மேலே உங்கள் மருத்துவர் உறுதிசெய்த அறிவுரைகளைப் பின்பற்றுங்கள்.",
        "te": "ఇది మీ క్లినిక్ సమీక్షించిన సాధారణ సమాచారం. ఇది మీ స్వంత పరిస్థితికి సలహా కాదు. పైన మీ డాక్టర్ నిర్ధారించిన సూచనలను పాటించండి.",
    },
    "pregnant_at": {
        "en": "At this visit you were {weeks} weeks pregnant.",
        "hi": "इस मुलाक़ात के समय आप {weeks} सप्ताह की गर्भवती थीं।",
        "ta": "இந்த வருகையின் போது நீங்கள் {weeks} வாரங்கள் கர்ப்பமாக இருந்தீர்கள்.",
        "te": "ఈ సందర్శన సమయంలో మీరు {weeks} వారాల గర్భవతి.",
    },
    "pregnant_at_days": {
        "en": "At this visit you were {weeks} weeks and {days} days pregnant.",
        "hi": "इस मुलाक़ात के समय आप {weeks} सप्ताह और {days} दिन की गर्भवती थीं।",
        "ta": "இந்த வருகையின் போது நீங்கள் {weeks} வாரங்கள் {days} நாட்கள் கர்ப்பமாக இருந்தீர்கள்.",
        "te": "ఈ సందర్శన సమయంలో మీరు {weeks} వారాలు {days} రోజుల గర్భవతి.",
    },
    "next_appt": {
        "en": "Your next appointment: {when} ({kind}).",
        "hi": "आपकी अगली अपॉइंटमेंट: {when} ({kind})।",
        "ta": "உங்கள் அடுத்த சந்திப்பு: {when} ({kind}).",
        "te": "మీ తదుపరి అపాయింట్‌మెంట్: {when} ({kind}).",
    },
    "range_note": {
        "en": "This page does not say whether a result is normal or not. The range printed on your report is shown beside each result.",
        "hi": "यह पृष्ठ यह नहीं बताता कि कोई परिणाम सामान्य है या नहीं। आपकी रिपोर्ट में छपी सीमा हर परिणाम के साथ दिखाई गई है।",
        "ta": "ஒரு முடிவு இயல்பானதா இல்லையா என்பதை இந்தப் பக்கம் சொல்லாது. உங்கள் அறிக்கையில் அச்சிடப்பட்ட வரம்பு ஒவ்வொரு முடிவுக்கும் அருகில் காட்டப்பட்டுள்ளது.",
        "te": "ఒక ఫలితం సాధారణమా కాదా అని ఈ పేజీ చెప్పదు. మీ నివేదికలో ముద్రించిన పరిధి ప్రతి ఫలితం పక్కన చూపబడింది.",
    },
    "range_word": {
        "en": "printed range",
        "hi": "छपी सीमा",
        "ta": "அச்சிடப்பட்ட வரம்பு",
        "te": "ముద్రించిన పరిధి",
    },
    "no_results": {
        "en": "No individual results were read from this report.",
        "hi": "इस रिपोर्ट से कोई अलग-अलग परिणाम नहीं पढ़े गए।",
        "ta": "இந்த அறிக்கையிலிருந்து தனித்தனி முடிவுகள் எதுவும் படிக்கப்படவில்லை.",
        "te": "ఈ నివేదిక నుండి ఏ ఫలితాలూ చదవబడలేదు.",
    },
}

# Prefix of the line the consultation draft generates by itself for "relevant information".
AUTO_RECORD_PREFIX = "Most recent prior record:"

# Placeholders for the clinician (English by design; blocking until resolved).
PH_DISCUSSED = "[Clinician to describe what was discussed at this visit]"
PH_NEXT = "[Clinician to confirm the next steps for this patient]"
PH_MEANS = "[Clinician to add the explanation for this patient, or delete this bracketed line]"
PH_RESULTS = "[Clinician to enter the results from the original report]"


def tr(key, language, **values):
    text = T[key].get(language) or T[key]["en"]
    return text.format(**values) if values else text


SECTION_KEYS = ("happened", "discussed", "record", "next", "general", "terms", "questions", "results", "measure", "means")


def section_kinds(language, headings=()):
    """Heading (in the output's language) -> section kind, so screens can label confirmed vs general content.
    Any other heading on an explanation is a condition explanation taken from approved education."""
    kinds = {tr(f"sec_{key}", language): key for key in SECTION_KEYS}
    return {**{h: "about" for h in headings if h not in kinds}, **kinds}


# --------------------------------------------------------------------------
# Abbreviation glossary: first occurrence is followed by its plain meaning.
# --------------------------------------------------------------------------
GLOSSARY = [
    {"aliases": ["BP", "B.P."], "en": "blood pressure", "hi": "रक्तचाप", "ta": "இரத்த அழுத்தம்", "te": "రక్తపోటు"},
    {"aliases": ["EDD"], "en": "expected due date", "hi": "अनुमानित प्रसव तिथि", "ta": "எதிர்பார்க்கப்படும் பிரசவ தேதி", "te": "అంచనా ప్రసవ తేదీ"},
    {"aliases": ["LMP"], "en": "first day of last period", "hi": "आख़िरी माहवारी का पहला दिन", "ta": "கடைசி மாதவிடாயின் முதல் நாள்", "te": "చివరి నెలసరి మొదటి రోజు"},
    {"aliases": ["USG", "USS"], "en": "ultrasound scan", "hi": "अल्ट्रासाउंड स्कैन", "ta": "அல்ட்ராசவுண்ட் ஸ்கேன்", "te": "అల్ట్రాసౌండ్ స్కాన్"},
    {"aliases": ["ANC"], "en": "antenatal check-up", "hi": "प्रसवपूर्व जाँच", "ta": "கர்ப்பகால பரிசோதனை", "te": "గర్భధారణ సమయ పరీక్ష"},
    {"aliases": ["GDM"], "en": "diabetes that starts in pregnancy", "hi": "गर्भावस्था में शुरू होने वाला मधुमेह", "ta": "கர்ப்பத்தில் தொடங்கும் நீரிழிவு", "te": "గర్భధారణలో మొదలయ్యే మధుమేహం"},
    {"aliases": ["OGTT"], "en": "glucose tolerance test", "hi": "ग्लूकोज़ सहनशीलता जाँच", "ta": "குளுக்கோஸ் சகிப்புத்தன்மை பரிசோதனை", "te": "గ్లూకోజ్ టాలరెన్స్ పరీక్ష"},
    {"aliases": ["Hb", "Hgb", "HB"], "en": "haemoglobin", "hi": "हीमोग्लोबिन", "ta": "ஹீமோகுளோபின்", "te": "హీమోగ్లోబిన్"},
    {"aliases": ["CBC"], "en": "complete blood count", "hi": "संपूर्ण रक्त गणना", "ta": "முழு இரத்த எண்ணிக்கை", "te": "పూర్తి రక్త గణన"},
    {"aliases": ["TSH"], "en": "thyroid stimulating hormone", "hi": "थायरॉइड उत्तेजक हार्मोन", "ta": "தைராய்டு தூண்டும் ஹார்மோன்", "te": "థైరాయిడ్ ఉత్తేజక హార్మోన్"},
    {"aliases": ["HbA1c"], "en": "average blood sugar over about 3 months", "hi": "लगभग 3 महीने का औसत रक्त शर्करा", "ta": "சுமார் 3 மாத சராசரி இரத்தச் சர்க்கரை", "te": "సుమారు 3 నెలల సగటు రక్తంలో చక్కెర"},
    {"aliases": ["BMI"], "en": "body mass index", "hi": "बॉडी मास इंडेक्स", "ta": "உடல் நிறை குறியீடு", "te": "బాడీ మాస్ ఇండెక్స్"},
    {"aliases": ["FHR"], "en": "baby's heart rate", "hi": "शिशु की हृदय गति", "ta": "குழந்தையின் இதயத் துடிப்பு", "te": "శిశువు గుండె వేగం"},
    {"aliases": ["LSCS"], "en": "caesarean birth", "hi": "सिज़ेरियन प्रसव", "ta": "சிசேரியன் பிரசவம்", "te": "సిజేరియన్ ప్రసవం"},
    {"aliases": ["IFA"], "en": "iron and folic acid tablets", "hi": "आयरन और फोलिक एसिड की गोलियाँ", "ta": "இரும்பு மற்றும் ஃபோலிக் அமில மாத்திரைகள்", "te": "ఐరన్ మరియు ఫోలిక్ యాసిడ్ మాత్రలు"},
    {"aliases": ["Td", "TT"], "en": "tetanus vaccine", "hi": "टिटनेस का टीका", "ta": "டெட்டனஸ் தடுப்பூசி", "te": "ధనుర్వాతం టీకా"},
    # Words an obstetric note often uses. Each is only what the word means; none says anything about this patient.
    {"aliases": ["GCT"], "en": "glucose challenge test, a blood sugar check after a sweet drink",
     "hi": "ग्लूकोज़ चैलेंज जाँच, यानी मीठा पेय पीने के बाद रक्त शर्करा की जाँच",
     "ta": "குளுக்கோஸ் சவால் பரிசோதனை, அதாவது இனிப்புப் பானம் குடித்த பின் இரத்தச் சர்க்கரை பரிசோதனை",
     "te": "గ్లూకోజ్ ఛాలెంజ్ పరీక్ష, అంటే తీపి పానీయం తాగిన తర్వాత రక్తంలో చక్కెర పరీక్ష"},
    {"aliases": ["NT scan", "NT"], "en": "early scan that measures the fluid at the back of the baby's neck",
     "hi": "शिशु की गर्दन के पीछे के द्रव को मापने वाला शुरुआती स्कैन",
     "ta": "குழந்தையின் கழுத்தின் பின்புற திரவத்தை அளவிடும் ஆரம்பகால ஸ்கேன்",
     "te": "శిశువు మెడ వెనుక ఉన్న ద్రవాన్ని కొలిచే ప్రారంభ స్కాన్"},
    {"aliases": ["PROM"], "en": "waters breaking before labour starts",
     "hi": "प्रसव शुरू होने से पहले पानी की थैली का फटना", "ta": "பிரசவ வலி தொடங்கும் முன் பனிக்குடம் உடைதல்", "te": "ప్రసవ నొప్పులు మొదలవక ముందే ఉమ్మనీరు పోవడం"},
    {"aliases": ["PPROM"], "en": "waters breaking before labour starts and before 37 weeks",
     "hi": "37 सप्ताह से पहले, प्रसव शुरू होने से पहले पानी की थैली का फटना", "ta": "37 வாரங்களுக்கு முன், பிரசவ வலி தொடங்கும் முன் பனிக்குடம் உடைதல்",
     "te": "37 వారాలకు ముందు, ప్రసవ నొప్పులు మొదలవక ముందే ఉమ్మనీరు పోవడం"},
    {"aliases": ["FGR", "IUGR"], "en": "baby growing more slowly than expected",
     "hi": "शिशु का अपेक्षा से धीमे बढ़ना", "ta": "குழந்தை எதிர்பார்த்ததை விட மெதுவாக வளர்தல்", "te": "శిశువు ఊహించిన దానికంటే నెమ్మదిగా పెరగడం"},
    {"aliases": ["CPD"], "en": "baby's head and the mother's pelvis not matching in size",
     "hi": "शिशु के सिर और माँ के श्रोणि यानी पेल्विस के आकार का मेल न होना", "ta": "குழந்தையின் தலைக்கும் தாயின் இடுப்பு எலும்புக்கும் அளவு பொருந்தாமை",
     "te": "శిశువు తల మరియు తల్లి పెల్విస్ పరిమాణం సరిపోకపోవడం"},
    {"aliases": ["PPH"], "en": "heavy bleeding after the birth",
     "hi": "प्रसव के बाद अधिक रक्तस्राव", "ta": "பிரசவத்திற்குப் பின் அதிக இரத்தப்போக்கு", "te": "ప్రసవం తర్వాత ఎక్కువ రక్తస్రావం"},
    # Added with the My Journey word list: the shorthand that the entries of a pregnancy record use most.
    {"aliases": ["NST"], "en": "non-stress test, a short check of the baby's heartbeat and movements while the mother rests",
     "hi": "नॉन-स्ट्रेस टेस्ट, माँ के आराम करते समय शिशु की धड़कन और हलचल की एक छोटी जाँच",
     "ta": "நான்-ஸ்ட்ரெஸ் பரிசோதனை, தாய் ஓய்வெடுக்கும்போது குழந்தையின் இதயத் துடிப்பையும் அசைவுகளையும் பார்க்கும் குறுகிய பரிசோதனை",
     "te": "నాన్-స్ట్రెస్ టెస్ట్, తల్లి విశ్రాంతిలో ఉన్నప్పుడు శిశువు గుండె చప్పుడు మరియు కదలికలను చూసే చిన్న పరీక్ష"},
    {"aliases": ["GDMA1"], "en": "diabetes that starts in pregnancy and is managed with changes to food and activity",
     "hi": "गर्भावस्था में शुरू होने वाला मधुमेह, जिसे खान-पान और गतिविधि में बदलाव से संभाला जाता है",
     "ta": "கர்ப்பத்தில் தொடங்கும் நீரிழிவு, உணவு மற்றும் செயல்பாட்டில் மாற்றங்கள் செய்து கட்டுப்படுத்தப்படுவது",
     "te": "గర్భధారణలో మొదలయ్యే మధుమేహం, ఆహారం మరియు కార్యకలాపాలలో మార్పులతో నియంత్రించేది"},
    {"aliases": ["GDMA2"], "en": "diabetes that starts in pregnancy and is treated with medicine as well as changes to food and activity",
     "hi": "गर्भावस्था में शुरू होने वाला मधुमेह, जिसमें खान-पान और गतिविधि में बदलाव के साथ दवा भी दी जाती है",
     "ta": "கர்ப்பத்தில் தொடங்கும் நீரிழிவு, உணவு மற்றும் செயல்பாட்டு மாற்றங்களுடன் மருந்தாலும் சிகிச்சை அளிக்கப்படுவது",
     "te": "గర్భధారణలో మొదలయ్యే మధుమేహం, ఆహారం మరియు కార్యకలాపాల మార్పులతో పాటు మందులతో కూడా చికిత్స చేసేది"},
    {"aliases": ["EFW"], "en": "estimated fetal weight, the scan's estimate of the baby's weight",
     "hi": "अनुमानित शिशु वज़न, स्कैन से लगाया गया शिशु के वज़न का अनुमान",
     "ta": "மதிப்பிடப்பட்ட குழந்தை எடை, ஸ்கேனில் கணிக்கப்படும் குழந்தையின் எடை",
     "te": "అంచనా శిశువు బరువు, స్కాన్ ద్వారా అంచనా వేసిన శిశువు బరువు"},
    {"aliases": ["NIPT", "NIPS"], "en": "a blood test of the mother that looks at the baby's DNA in her blood to screen for some chromosome conditions",
     "hi": "माँ के रक्त में मौजूद शिशु के डीएनए को देखकर कुछ क्रोमोसोम संबंधी स्थितियों की स्क्रीनिंग करने वाली रक्त जाँच",
     "ta": "தாயின் இரத்தத்திலுள்ள குழந்தையின் டி.என்.ஏ-வைப் பார்த்து சில குரோமோசோம் நிலைகளைத் திரையிடும் இரத்தப் பரிசோதனை",
     "te": "తల్లి రక్తంలోని శిశువు డీఎన్ఏను చూసి కొన్ని క్రోమోజోమ్ పరిస్థితులను స్క్రీనింగ్ చేసే రక్త పరీక్ష"},
    {"aliases": ["MFM"], "en": "maternal-fetal medicine, specialist care for pregnancies that need extra attention",
     "hi": "मातृ-भ्रूण चिकित्सा, उन गर्भावस्थाओं की विशेषज्ञ देखभाल जिन पर अतिरिक्त ध्यान चाहिए",
     "ta": "தாய்-கரு மருத்துவம், கூடுதல் கவனம் தேவைப்படும் கர்ப்பங்களுக்கான சிறப்பு மருத்துவம்",
     "te": "మాతృ-పిండ వైద్యం, అదనపు శ్రద్ధ అవసరమయ్యే గర్భధారణలకు ప్రత్యేక వైద్యం"},
    {"aliases": ["CRL"], "en": "crown-rump length, the baby's length from head to bottom measured on an early scan",
     "hi": "क्राउन-रंप लंबाई, शुरुआती स्कैन में मापी गई शिशु की सिर से नितंब तक की लंबाई",
     "ta": "கிரவுன்-ரம்ப் நீளம், ஆரம்பகால ஸ்கேனில் அளக்கப்படும் குழந்தையின் தலையிலிருந்து பின்புறம் வரையிலான நீளம்",
     "te": "క్రౌన్-రంప్ పొడవు, ప్రారంభ స్కాన్‌లో కొలిచే శిశువు తల నుండి పిరుదుల వరకు పొడవు"},
    {"aliases": ["AFI"], "en": "amniotic fluid index, a scan measure of the water around the baby",
     "hi": "एम्नियोटिक द्रव सूचकांक, स्कैन में शिशु के चारों ओर के पानी का माप",
     "ta": "பனிக்குட நீர் குறியீடு, ஸ்கேனில் குழந்தையைச் சுற்றியுள்ள நீரின் அளவீடு",
     "te": "ఉమ్మనీరు సూచిక, స్కాన్‌లో శిశువు చుట్టూ ఉన్న నీటి కొలత"},
    {"aliases": ["Doppler"], "en": "a scan that shows how blood is flowing in the blood vessels of the baby or the mother",
     "hi": "एक स्कैन जो शिशु या माँ की रक्त नलिकाओं में रक्त के बहाव को दिखाता है",
     "ta": "குழந்தை அல்லது தாயின் இரத்தக் குழாய்களில் இரத்தம் எப்படி ஓடுகிறது என்பதைக் காட்டும் ஸ்கேன்",
     "te": "శిశువు లేదా తల్లి రక్తనాళాలలో రక్తం ఎలా ప్రవహిస్తోందో చూపే స్కాన్"},
    {"aliases": ["Trisomy"], "en": "an extra copy of one chromosome in the baby's cells",
     "hi": "शिशु की कोशिकाओं में किसी एक क्रोमोसोम की एक अतिरिक्त प्रति",
     "ta": "குழந்தையின் செல்களில் ஒரு குரோமோசோமின் கூடுதல் நகல்",
     "te": "శిశువు కణాలలో ఒక క్రోమోజోమ్ అదనపు కాపీ"},
    {"aliases": ["Fetal fraction"], "en": "the share of the DNA in the mother's blood that comes from the baby",
     "hi": "माँ के रक्त के डीएनए का वह हिस्सा जो शिशु से आता है",
     "ta": "தாயின் இரத்தத்திலுள்ள டி.என்.ஏ-வில் குழந்தையிடமிருந்து வரும் பகுதி",
     "te": "తల్లి రక్తంలోని డీఎన్ఏలో శిశువు నుండి వచ్చిన భాగం"},
    {"aliases": ["Fundal height", "fundal height"], "en": "the measurement from the pubic bone to the top of the womb",
     "hi": "जघन की हड्डी से गर्भाशय के ऊपरी सिरे तक की माप",
     "ta": "அந்தரங்க எலும்பிலிருந்து கருப்பையின் மேல் பகுதி வரையிலான அளவு",
     "te": "జఘన ఎముక నుండి గర్భాశయం పై భాగం వరకు కొలత"},
]
# "G2P1", "G2 P1" or "G2 P1 L1 A0", as an antenatal card writes it. The numbers differ from woman to woman, so this one is matched by its shape
# (one or two digits after each letter, which also keeps "P1001" in the other common notation from being read as a count of births).
_GPLA_ENTRY = {"aliases": ["G/P/L/A"], "en": "G = pregnancies, P = births, L = living children, A = miscarriages or abortions; the number after each letter is the count",
               "hi": "G = गर्भधारण, P = प्रसव, L = जीवित बच्चे, A = गर्भपात या गर्भसमापन; हर अक्षर के बाद की संख्या उसकी गिनती है",
               "ta": "G = கர்ப்பங்கள், P = பிரசவங்கள், L = உயிருடன் உள்ள குழந்தைகள், A = கருச்சிதைவு அல்லது கருக்கலைப்பு; ஒவ்வொரு எழுத்தின் பின் உள்ள எண் அதன் எண்ணிக்கை",
               "te": "G = గర్భాలు, P = ప్రసవాలు, L = జీవించి ఉన్న పిల్లలు, A = గర్భస్రావం లేదా గర్భవిచ్ఛిత్తి; ప్రతి అక్షరం తర్వాత సంఖ్య దాని లెక్క"}
GLOSSARY.append(_GPLA_ENTRY)
_GPLA = r"G\d{1,2}\s?P\d{1,2}(?:\s?L\d{1,2})?(?:\s?A\d{1,2})?"
_ALIAS_TO_ENTRY = {alias: entry for entry in GLOSSARY for alias in entry["aliases"]}
_ALIAS_RE = re.compile(r"(?<![A-Za-z0-9])(" + _GPLA + "|" + "|".join(sorted((re.escape(a) for a in _ALIAS_TO_ENTRY), key=len, reverse=True)) + r")(?![A-Za-z0-9])")
_GPLA_FULL = re.compile(_GPLA)


def explain_terms(text, language):
    """Append the plain meaning after the first occurrence of each known abbreviation."""
    used, seen = [], set()

    def replace(match):
        alias = match.group(1)
        entry = _ALIAS_TO_ENTRY.get(alias) or _GPLA_ENTRY
        key = entry["aliases"][0]
        tail = text[match.end():match.end() + 3].lstrip()
        if key in seen:
            return alias
        seen.add(key)
        used.append((key, entry[language]))
        return alias if tail.startswith("(") else f"{alias} ({entry[language]})"

    return _ALIAS_RE.sub(replace, text), used


def _bullets(text):
    """Break recorded text into short lines without changing its wording."""
    parts = [p.strip(" \t•-*") for p in re.split(r"\n+|(?<=[.!?।])\s+", text) if p.strip(" \t•-*")]
    return "\n".join("• " + p for p in parts) if len(parts) > 1 else (parts[0] if parts else text.strip())


def _documented(value):
    value = (value or "").strip()
    return "" if not value or value.lower() in ("not documented.", "not documented") else value


def stage_for_weeks(weeks):
    return "first" if weeks < 14 else "second" if weeks < 28 else "third"


# --------------------------------------------------------------------------
# Visit summary / patient explanation
# --------------------------------------------------------------------------
def build_visit_summary(*, kind, language, episode, approved_content, consult_date, next_appointment=None,
                        education=(), open_questions=(), education_available=True):
    notes = []
    weeks, days = episode.gestational_age_weeks, episode.gestational_age_days or 0
    pregnancy = tr("pregnant_at_days", language, weeks=weeks, days=days) if days else tr("pregnant_at", language, weeks=weeks)

    discussion = _documented(approved_content.get("documentedDiscussion"))
    follow_up = _documented(approved_content.get("followUpNextSteps"))
    record = _documented(approved_content.get("relevantInformation"))
    if record.startswith(AUTO_RECORD_PREFIX):
        record = ""  # the system's own pointer to a prior record, not something the clinician wrote for the patient
    glossary_used = []

    def simple(text):
        text, used = explain_terms(text, language)
        glossary_used.extend(used)
        return _bullets(text)

    happened = pregnancy + "\n" + (simple(discussion) if discussion else PH_DISCUSSED)
    steps = simple(follow_up) if follow_up else PH_NEXT
    if next_appointment:
        steps += "\n" + tr("next_appt", language, when=next_appointment["when"], kind=next_appointment["kind"])

    sections = {tr("sec_happened", language): happened}
    if record:
        sections[tr("sec_record", language)] = simple(record)
    sections[tr("sec_next", language)] = steps

    if education:
        lines = [tr("general_note", language)]
        for item in education:
            lines.append(f"{item['title']}\n{item['content']}\n— {item['issuer']} · v{item['version']} · {item['reviewer']}")
        sections[tr("sec_general", language)] = "\n\n".join(lines)
    elif not education_available:
        notes.append("No approved education modules exist in this language for the patient's stage, so the general-information section was left out.")

    if open_questions:
        sections[tr("sec_questions", language)] = "\n".join("• " + q for q in open_questions)

    unique_terms = list(dict.fromkeys(glossary_used))
    if unique_terms:
        sections[tr("sec_terms", language)] = "\n".join(f"{abbr}: {meaning}" for abbr, meaning in unique_terms)

    title = tr("title_explanation" if kind == "explanation" else "title_visit", language)
    return {"title": title, "content": tr("intro_visit", language, date=consult_date), "structured": sections, "notes": notes}


def build_explanation(*, language, episode, approved_content, consult_date, chosen, modules, next_appointment=None):
    """Counselling text for the topics the DOCTOR chose, built from approved education. Nothing reads the note to decide which
    conditions it is about, and nothing is written by a model."""
    notes = []
    discussion = _documented(approved_content.get("documentedDiscussion"))
    follow_up = _documented(approved_content.get("followUpNextSteps"))
    glossary_used = []

    def simple(text):
        text, used = explain_terms(text, language)
        glossary_used.extend(used)
        return _bullets(text)

    sections = {tr("sec_discussed", language): simple(discussion) if discussion else PH_DISCUSSED}
    found = 0
    for topic in chosen:
        module = modules.get(topic)
        if not module:
            notes.append(f"No approved explanation of “{topic}” exists in this language, so that part was left out. Add one in Clinical Settings (Patient education) or write it here.")
            continue
        found += 1
        sections[module["title"]] = f"{module['content']}\n— {module['issuer']} · v{module['version']} · {module['reviewer']}"
    if not chosen:
        notes.append("No topic was chosen. Pick the topics to explain when you prepare the draft, or write the explanations here yourself.")
    elif found:
        notes.append("Topic explanations come from reviewed clinic education. They are general and do not describe this patient's own results.")
    steps = simple(follow_up) if follow_up else PH_NEXT
    if next_appointment:
        steps += "\n" + tr("next_appt", language, when=next_appointment["when"], kind=next_appointment["kind"])
    sections[tr("sec_next", language)] = steps
    unique_terms = list(dict.fromkeys(glossary_used))
    if unique_terms:
        sections[tr("sec_terms", language)] = "\n".join(f"{abbr}: {meaning}" for abbr, meaning in unique_terms)
    return {"title": tr("title_explanation", language), "content": tr("intro_explanation", language, date=consult_date), "structured": sections, "notes": notes}


# --------------------------------------------------------------------------
# Lab reports
# --------------------------------------------------------------------------
LAB_TESTS = [
    {"id": "hb", "aliases": ["haemoglobin", "hemoglobin", "hb", "hgb"], "en": "Measures haemoglobin, the part of red blood cells that carries oxygen around the body.", "hi": "हीमोग्लोबिन मापता है, जो लाल रक्त कोशिकाओं का वह भाग है जो शरीर में ऑक्सीजन पहुँचाता है।", "ta": "இரத்தச் சிவப்பணுக்களில் உடல் முழுவதும் ஆக்சிஜனைக் கொண்டு செல்லும் ஹீமோகுளோபினின் அளவை அளவிடுகிறது.", "te": "శరీరమంతటా ఆక్సిజన్‌ను తీసుకెళ్లే ఎర్ర రక్త కణాల భాగమైన హీమోగ్లోబిన్ మొత్తాన్ని కొలుస్తుంది."},
    {"id": "pcv", "aliases": ["packed cell volume", "haematocrit", "hematocrit", "pcv", "hct"], "en": "Shows what share of your blood is made up of red blood cells.", "hi": "यह दिखाता है कि आपके रक्त का कितना हिस्सा लाल रक्त कोशिकाओं से बना है।", "ta": "உங்கள் இரத்தத்தில் சிவப்பணுக்கள் எவ்வளவு பங்கு உள்ளன என்பதைக் காட்டுகிறது.", "te": "మీ రక్తంలో ఎర్ర రక్త కణాల వాటా ఎంతో చూపిస్తుంది."},
    {"id": "plt", "aliases": ["platelet count", "platelets", "plt"], "en": "Counts platelets, the small blood cells that help blood to clot.", "hi": "प्लेटलेट्स गिनता है, जो छोटी रक्त कोशिकाएँ हैं और रक्त को जमने में मदद करती हैं।", "ta": "இரத்தம் உறைய உதவும் சிறிய இரத்த அணுக்களான தட்டணுக்களை (பிளேட்லெட்) எண்ணுகிறது.", "te": "రక్తం గడ్డకట్టడానికి సహాయపడే చిన్న రక్త కణాలైన ప్లేట్‌లెట్లను లెక్కిస్తుంది."},
    {"id": "wbc", "aliases": ["total leucocyte count", "total leukocyte count", "total wbc count", "wbc count", "wbc", "tlc"], "en": "Counts white blood cells, which help your body fight infection.", "hi": "श्वेत रक्त कोशिकाएँ गिनता है, जो संक्रमण से लड़ने में शरीर की मदद करती हैं।", "ta": "நோய்த்தொற்றை எதிர்த்துப் போராட உதவும் வெள்ளை இரத்த அணுக்களை எண்ணுகிறது.", "te": "ఇన్ఫెక్షన్‌తో పోరాడటానికి శరీరానికి సహాయపడే తెల్ల రక్త కణాలను లెక్కిస్తుంది."},
    {"id": "rbc", "aliases": ["total rbc count", "red blood cell count", "rbc count", "rbc"], "en": "Counts red blood cells, which carry oxygen.", "hi": "लाल रक्त कोशिकाएँ गिनता है, जो ऑक्सीजन ले जाती हैं।", "ta": "ஆக்சிஜனைக் கொண்டு செல்லும் சிவப்பணுக்களை எண்ணுகிறது.", "te": "ఆక్సిజన్‌ను తీసుకెళ్లే ఎర్ర రక్త కణాలను లెక్కిస్తుంది."},
    {"id": "mcv", "aliases": ["mean corpuscular volume", "mcv"], "en": "Describes the average size of your red blood cells.", "hi": "आपकी लाल रक्त कोशिकाओं का औसत आकार बताता है।", "ta": "உங்கள் சிவப்பணுக்களின் சராசரி அளவைக் குறிக்கிறது.", "te": "మీ ఎర్ర రక్త కణాల సగటు పరిమాణాన్ని తెలియజేస్తుంది."},
    {"id": "fbs", "aliases": ["fasting blood sugar", "fasting plasma glucose", "fasting blood glucose", "fasting glucose", "fbs", "fpg"], "en": "Measures the sugar (glucose) in your blood after not eating overnight.", "hi": "रात भर कुछ न खाने के बाद आपके रक्त में शर्करा (ग्लूकोज़) की मात्रा मापता है।", "ta": "இரவு முழுவதும் சாப்பிடாமல் இருந்த பிறகு இரத்தத்தில் உள்ள சர்க்கரையின் (குளுக்கோஸ்) அளவை அளவிடுகிறது.", "te": "రాత్రంతా ఏమీ తినకుండా ఉన్న తర్వాత మీ రక్తంలోని చక్కెర (గ్లూకోజ్) స్థాయిని కొలుస్తుంది."},
    {"id": "ppbs", "aliases": ["post prandial blood sugar", "post-prandial blood sugar", "postprandial blood sugar", "post prandial glucose", "post-prandial glucose", "ppbs", "ogtt"], "en": "Measures blood sugar a set time after a meal or a glucose drink.", "hi": "भोजन या ग्लूकोज़ पेय के निर्धारित समय बाद रक्त शर्करा मापता है।", "ta": "உணவு அல்லது குளுக்கோஸ் பானத்திற்குப் பிறகு குறிப்பிட்ட நேரத்தில் இரத்தச் சர்க்கரையை அளவிடுகிறது.", "te": "భోజనం లేదా గ్లూకోజ్ పానీయం తర్వాత నిర్దిష్ట సమయంలో రక్తంలో చక్కెరను కొలుస్తుంది."},
    {"id": "rbs", "aliases": ["random blood sugar", "random blood glucose", "rbs"], "en": "Measures the sugar in your blood at the time the sample was taken.", "hi": "नमूना लेने के समय आपके रक्त में शर्करा की मात्रा मापता है।", "ta": "மாதிரி எடுக்கப்பட்ட நேரத்தில் இரத்தத்தில் உள்ள சர்க்கரையின் அளவை அளவிடுகிறது.", "te": "నమూనా తీసిన సమయంలో మీ రక్తంలోని చక్కెర స్థాయిని కొలుస్తుంది."},
    {"id": "hba1c", "aliases": ["glycosylated haemoglobin", "glycated haemoglobin", "glycosylated hemoglobin", "hba1c", "a1c"], "en": "Shows your average blood sugar over roughly the last three months.", "hi": "पिछले लगभग तीन महीनों का औसत रक्त शर्करा स्तर दिखाता है।", "ta": "கடந்த சுமார் மூன்று மாதங்களின் சராசரி இரத்தச் சர்க்கரை அளவைக் காட்டுகிறது.", "te": "గత సుమారు మూడు నెలల సగటు రక్తంలో చక్కెర స్థాయిని చూపిస్తుంది."},
    {"id": "tsh", "aliases": ["thyroid stimulating hormone", "tsh"], "en": "Measures a hormone that tells the thyroid gland how much hormone to make.", "hi": "एक हार्मोन मापता है जो थायरॉइड ग्रंथि को बताता है कि कितना हार्मोन बनाना है।", "ta": "தைராய்டு சுரப்பி எவ்வளவு ஹார்மோன் உற்பத்தி செய்ய வேண்டும் என்பதைத் தூண்டும் ஹார்மோனை அளவிடுகிறது.", "te": "థైరాయిడ్ గ్రంథి ఎంత హార్మోన్ తయారు చేయాలో సూచించే హార్మోన్‌ను కొలుస్తుంది."},
    {"id": "ferritin", "aliases": ["serum ferritin", "ferritin"], "en": "Shows how much iron your body has stored.", "hi": "आपके शरीर में कितना आयरन जमा है, यह दिखाता है।", "ta": "உங்கள் உடலில் எவ்வளவு இரும்புச்சத்து சேமிக்கப்பட்டுள்ளது என்பதைக் காட்டுகிறது.", "te": "మీ శరీరంలో ఎంత ఇనుము నిల్వ ఉందో చూపిస్తుంది."},
    {"id": "b12", "aliases": ["vitamin b12", "vit b12", "serum b12", "cyanocobalamin", "b12"], "en": "Measures vitamin B12, which helps make healthy blood cells and supports nerves.", "hi": "विटामिन बी12 मापता है, जो स्वस्थ रक्त कोशिकाएँ बनाने और नसों को सहारा देने में मदद करता है।", "ta": "ஆரோக்கியமான இரத்த அணுக்கள் உருவாகவும் நரம்புகளுக்கு ஆதரவாகவும் உதவும் வைட்டமின் பி12 அளவை அளவிடுகிறது.", "te": "ఆరోగ్యకరమైన రక్త కణాల తయారీకి, నరాలకు సహాయపడే విటమిన్ బి12 స్థాయిని కొలుస్తుంది."},
    {"id": "vitd", "aliases": ["25-hydroxy vitamin d", "25-oh vitamin d", "25 oh vitamin d", "vitamin d", "vit d"], "en": "Measures vitamin D, which helps your body use calcium for bones.", "hi": "विटामिन डी मापता है, जो हड्डियों के लिए कैल्शियम के उपयोग में मदद करता है।", "ta": "எலும்புகளுக்குக் கால்சியத்தைப் பயன்படுத்த உடலுக்கு உதவும் வைட்டமின் டி அளவை அளவிடுகிறது.", "te": "ఎముకల కోసం కాల్షియం ఉపయోగించుకోవడానికి శరీరానికి సహాయపడే విటమిన్ డి స్థాయిని కొలుస్తుంది."},
    {"id": "creat", "aliases": ["serum creatinine", "creatinine"], "en": "Checks how well your kidneys are filtering waste from the blood.", "hi": "जाँचता है कि आपकी किडनी रक्त से अपशिष्ट कितनी अच्छी तरह छान रही हैं।", "ta": "உங்கள் சிறுநீரகங்கள் இரத்தத்திலிருந்து கழிவுகளை எவ்வளவு நன்றாக வடிகட்டுகின்றன என்பதைச் சோதிக்கிறது.", "te": "మీ మూత్రపిండాలు రక్తం నుండి వ్యర్థాలను ఎంత బాగా వడపోస్తున్నాయో పరీక్షిస్తుంది."},
    {"id": "liver", "aliases": ["alanine aminotransferase", "alanine transaminase", "aspartate aminotransferase", "sgpt", "sgot", "alt", "ast"], "en": "Measures a liver enzyme, which helps show how your liver is working.", "hi": "लिवर एंज़ाइम मापता है, जो बताता है कि आपका लिवर कैसे काम कर रहा है।", "ta": "கல்லீரல் எவ்வாறு செயல்படுகிறது என்பதைக் காட்டும் கல்லீரல் நொதியை அளவிடுகிறது.", "te": "మీ కాలేయం ఎలా పనిచేస్తోందో చూపే కాలేయ ఎంజైమ్‌ను కొలుస్తుంది."},
    {"id": "uprotein", "text": True, "aliases": ["urine for albumin", "urine albumin", "urine protein", "protein (urine)", "albumin (urine)"], "en": "Checks for protein in the urine.", "hi": "मूत्र में प्रोटीन की जाँच करता है।", "ta": "சிறுநீரில் புரதம் உள்ளதா என்பதைச் சோதிக்கிறது.", "te": "మూత్రంలో ప్రోటీన్ ఉందేమో పరీక్షిస్తుంది."},
    {"id": "bloodgroup", "text": True, "aliases": ["blood group & rh", "blood group and rh", "abo blood group", "abo group", "blood group"], "en": "Shows your blood group and Rh type.", "hi": "आपका रक्त समूह और आरएच प्रकार दिखाता है।", "ta": "உங்கள் இரத்த வகையையும் Rh வகையையும் காட்டுகிறது.", "te": "మీ రక్త గ్రూప్ మరియు Rh రకాన్ని చూపిస్తుంది."},
    {"id": "hiv", "text": True, "sensitive": True, "aliases": ["hiv 1 & 2", "hiv 1/2", "hiv i & ii", "hiv"], "en": "Screens for HIV infection.", "hi": "एचआईवी संक्रमण की जाँच करता है।", "ta": "எச்.ஐ.வி தொற்றுக்கான பரிசோதனை.", "te": "హెచ్‌ఐవి ఇన్ఫెక్షన్ కోసం స్క్రీనింగ్."},
    {"id": "hbsag", "text": True, "sensitive": True, "aliases": ["hepatitis b surface antigen", "hbsag"], "en": "Screens for hepatitis B infection.", "hi": "हेपेटाइटिस बी संक्रमण की जाँच करता है।", "ta": "ஹெப்பாடைடிஸ் பி தொற்றுக்கான பரிசோதனை.", "te": "హెపటైటిస్ బి ఇన్ఫెక్షన్ కోసం స్క్రీనింగ్."},
    {"id": "vdrl", "text": True, "sensitive": True, "aliases": ["syphilis", "vdrl", "rpr"], "en": "Screens for syphilis infection.", "hi": "सिफलिस संक्रमण की जाँच करता है।", "ta": "சிபிலிஸ் தொற்றுக்கான பரிசோதனை.", "te": "సిఫిలిస్ ఇన్ఫెక్షన్ కోసం స్క్రీనింగ్."},
]
# Starter "About this test" notes are education resources whose family id starts with this.
LAB_NOTE_PREFIX = "starter-labtest-"

# Display names for the starter "About this test" notes in Clinical Settings. Their text is the general description above.
LAB_TEST_NAMES = {
    "hb": "Haemoglobin", "pcv": "Packed cell volume", "plt": "Platelet count", "wbc": "White blood cell count", "rbc": "Red blood cell count",
    "mcv": "Mean corpuscular volume", "fbs": "Fasting blood sugar", "ppbs": "Post-meal blood sugar", "rbs": "Random blood sugar", "hba1c": "HbA1c",
    "tsh": "TSH", "ferritin": "Ferritin", "b12": "Vitamin B12", "vitd": "Vitamin D", "creat": "Creatinine", "liver": "Liver enzymes",
    "uprotein": "Urine protein", "bloodgroup": "Blood group", "hiv": "HIV screening", "hbsag": "Hepatitis B screening", "vdrl": "Syphilis screening",
}
_ALIASES = sorted(((alias, test) for test in LAB_TESTS for alias in test["aliases"]), key=lambda pair: len(pair[0]), reverse=True)
_NAME_START = [(re.compile(r"^" + re.escape(alias).replace(r"\ ", r"\s+") + r"(?![A-Za-z0-9])\s*(?:\([^)]{0,30}\))?", re.I), test) for alias, test in _ALIASES]

_NUMBER = r"\d[\d,]*(?:\.\d+)?"
_RANGE = re.compile(r"\(?\s*(?:ref(?:erence)?\.?(?:\s*range)?\s*[:\-]?\s*)?(?P<lo>" + _NUMBER + r")\s*(?:-|–|—|to)\s*(?P<hi>" + _NUMBER + r")\s*\)?", re.I)
_UPPER = re.compile(r"[<≤]\s*(?P<hi>" + _NUMBER + ")")
_LOWER = re.compile(r"[>≥]\s*(?P<lo>" + _NUMBER + ")")
_VALUE = re.compile(r"^[:\s\-]*(?P<cmp>[<>])?\s*(?P<val>" + _NUMBER + r")(?![\d.])")
_UNIT = re.compile(r"^\s*(?P<unit>/?[A-Za-zµμ%][A-Za-z0-9µμ%^*./]*)")
_TEXT_RESULT = re.compile(r"(non[\s-]?reactive|reactive|not detected|detected|positive|negative|nil|trace|absent|present|\+{1,4}|\b(?:AB|A|B|O)\b[\s,]*(?:rh\s*)?(?:positive|negative|pos|neg|\+ve|-ve|\+|-)?)", re.I)
_SKIP_LINE = re.compile(r"^(patient|name|age|sex|gender|date|sample|specimen|page|phone|mobile|ref(?:erred)?\s*by|report|lab(?:oratory)?|address|mrn|uhid|collected|received|doctor|dr\.?)\b", re.I)
_FLAG_WORDS = {"H", "HIGH", "L", "LOW"}  # a bare flag the report prints after a value: skipped, never read as a unit or reported


def _num(text):
    return float(text.replace(",", ""))


def _clean_value(text):
    return text.strip()


def _parse_numeric_tail(rest):
    """Parse '10.8 g/dL (11.0 - 14.0) L' → dict, or None."""
    value = _VALUE.match(rest)
    if not value:
        return None
    tail = rest[value.end():]
    unit = None
    unit_match = _UNIT.match(tail)
    if unit_match:
        candidate = unit_match.group("unit")
        if candidate.upper() not in _FLAG_WORDS:
            unit = candidate
            tail = tail[unit_match.end():]
    lo = hi = None
    range_text = ""
    range_match = _RANGE.search(tail)
    if range_match:
        lo, hi = _num(range_match.group("lo")), _num(range_match.group("hi"))
        range_text = f"{range_match.group('lo')}–{range_match.group('hi')}"
    else:
        upper, lower = _UPPER.search(tail), _LOWER.search(tail)
        if upper:
            hi, range_text = _num(upper.group("hi")), f"< {upper.group('hi')}"
        elif lower:
            lo, range_text = _num(lower.group("lo")), f"> {lower.group('lo')}"
    return {"value": _num(value.group("val")), "valueText": value.group("val"), "comparator": value.group("cmp") or "",
            "unit": unit, "low": lo, "high": hi, "rangeText": range_text, "hasUnitOrRange": bool(unit or range_text)}


def _match_test(line):
    for pattern, test in _NAME_START:
        match = pattern.match(line)
        if match:
            return test, line[:match.end()].strip(), line[match.end():]
    return None, "", ""


def parse_lab_results(text):
    """Read result rows that appear verbatim in the report text. Never infer a missing value."""
    lines = [line.strip() for line in (text or "").splitlines()]
    results, consumed = [], set()
    for index, line in enumerate(lines):
        if index in consumed or not line or len(line) > 200 or _SKIP_LINE.match(line):
            continue
        test, printed_name, rest = _match_test(line)
        original = line
        if test and test.get("text"):
            if not rest.strip():  # cell-per-line layout
                for ahead in range(index + 1, min(index + 3, len(lines))):
                    if lines[ahead] and not _match_test(lines[ahead])[0]:
                        rest, original = lines[ahead], f"{line} | {lines[ahead]}"
                        consumed.add(ahead)
                        break
            found = _TEXT_RESULT.search(rest.strip(" :-"))
            if found and len(rest.strip()) <= 40:
                results.append({"name": printed_name, "testId": test["id"], "kind": "text", "valueText": rest.strip(" :-"),
                                "value": None, "unit": None, "low": None, "high": None, "rangeText": "", "originalLine": original})
            continue
        row = None
        if test:
            row = _parse_numeric_tail(rest)
            if row is None and not rest.strip(" :-"):  # cell-per-line layout: value, unit, range follow
                joined, used = [], []
                for ahead in range(index + 1, min(index + 5, len(lines))):
                    if not lines[ahead] or _match_test(lines[ahead])[0]:
                        break
                    joined.append(lines[ahead])
                    used.append(ahead)
                row = _parse_numeric_tail(" ".join(joined)) if joined else None
                if row:
                    consumed.update(used)
                    original = " | ".join([line] + joined)
        else:
            generic = re.match(r"^(?P<name>[A-Za-z][A-Za-z .()/%\-]{2,50}?)\s*[:\-]?\s+(?=[<>]?\d)(?P<rest>.*)$", line)
            if generic:
                row = _parse_numeric_tail(generic.group("rest"))
                if row and not row["hasUnitOrRange"]:
                    row = None
                printed_name = generic.group("name").strip(" :-")
        if row:
            row.update({"name": printed_name or line, "testId": test["id"] if test else None, "kind": "number", "originalLine": original})
            results.append(row)
    return results


def _result_line(row, language):
    if row["kind"] == "text":
        return f"{row['name']}: {row['valueText']}"
    unit = f" {row['unit']}" if row.get("unit") else ""
    value = f"{row['comparator']}{row['valueText']}{unit}"
    range_part = f" ({tr('range_word', language)} {row['rangeText']})" if row["rangeText"] else ""
    return f"{row['name']}: {value}{range_part}"


def build_lab_explanation(*, language, text, document_title, about=None):
    """`about` maps a test id to the clinic-approved education note for it. Nothing in this document depends on a value:
    each result is shown as printed, beside the range printed on the report, and the general notes sit in a separate section."""
    about = about or {}
    results = parse_lab_results(text)
    notes = ["Values were read automatically from the document text. Compare every value with the original report before approving."]
    if not results:
        notes.append("No individual results could be read automatically. Enter the results yourself from the original report.")
    if any(next((t for t in LAB_TESTS if t["id"] == r["testId"]), {}).get("sensitive") for r in results):
        notes.append("This report includes infection screening results. Confirm the patient should receive them in this written format.")
    if any(r["kind"] == "number" and r["testId"] is None for r in results):
        notes.append("Some rows are tests without a general description in the library; they are listed without an “About these tests” note.")
    results_text = ("\n".join(_result_line(r, language) for r in results) + "\n\n" + tr("range_note", language)) if results else tr("no_results", language) + "\n" + PH_RESULTS
    measured, missing, seen = [], [], set()
    for row in results:
        if not row["testId"] or row["testId"] in seen:
            continue
        seen.add(row["testId"])
        module = about.get(row["testId"])
        if module:
            measured.append(f"{row['name']}: {module['content']}")
        else:
            missing.append(row["name"])
    if missing:
        notes.append(f"No approved “About this test” note exists in this language for: {', '.join(missing)}. Approve them in Clinical Settings (Patient education, topic “About lab tests”), or leave this section out.")
    sections = {tr("sec_results", language): results_text}
    if measured:
        sections[tr("sec_measure", language)] = "\n".join(measured)
    sections[tr("sec_means", language)] = tr("means_default", language) + "\n" + PH_MEANS
    sections[tr("sec_next", language)] = PH_NEXT
    snapshot_rows = [{k: r[k] for k in ("name", "testId", "valueText", "unit", "rangeText", "originalLine")} for r in results]
    return {"title": tr("title_lab", language), "content": tr("intro_lab", language, title=document_title), "structured": sections,
            "notes": notes, "parsed": snapshot_rows}


# --------------------------------------------------------------------------
# Review notes shown to the doctor while a draft is open
# --------------------------------------------------------------------------
_SCRIPTS = {"hi": (0x0900, 0x097F), "ta": (0x0B80, 0x0BFF), "te": (0x0C00, 0x0C7F)}
_ACRONYM = re.compile(r"(?<![A-Za-z0-9])[A-Z][A-Z0-9]{1,5}(?![A-Za-z0-9])")
_ACRONYM_IGNORE = {"OK", "MRN", "ID", "ANC"} | set(_ALIAS_TO_ENTRY)


def unresolved_placeholders(content, structured):
    text = "\n".join([content or "", *(structured or {}).values()])
    return [marker for marker in PLACEHOLDER_MARKERS if marker in text]


def _script_letters(text, language):
    low, high = _SCRIPTS[language]
    return sum(low <= ord(ch) <= high for ch in text)


def _authored_text(structured, language):
    """The clinician-recorded parts only: no fixed headings, standard sentences or placeholders."""
    fixed_prefixes = [T["pregnant_at"][language].split("{")[0], T["next_appt"][language].split("{")[0]]
    parts = []
    for key in ("sec_happened", "sec_discussed", "sec_record", "sec_next"):
        body = structured.get(tr(key, language), "")
        for line in body.splitlines():
            if not any(line.startswith(prefix) for prefix in fixed_prefixes):
                parts.append(line)
    # Placeholders and the glossary explanations added in parentheses are not the clinician's own wording.
    return re.sub(r"\([^)]*\)", "", re.sub(r"\[[^\]]*\]", "", "\n".join(parts)))


def review_notes(output):
    """Doctor-facing checks computed from the live draft: blocking, warning or info."""
    notes = []
    structured = output.structured_data or {}
    if unresolved_placeholders(output.content, structured):
        notes.append({"level": "blocker", "text": "Replace or delete every bracketed placeholder before approval."})
    body = "\n".join([output.content or "", *structured.values()])
    snapshot = output.source_snapshot or {}
    if output.kind in SECTIONED_KINDS:
        for text in snapshot.get("draftNotes", []):
            notes.append({"level": "info", "text": text})
        free = re.sub(r"\[[^\]]*\]", "", body)
        unknown = sorted({m for m in _ACRONYM.findall(free) if m not in _ACRONYM_IGNORE and not _GPLA_FULL.fullmatch(m)})
        if unknown:
            notes.append({"level": "warning", "text": "Abbreviations not explained in plain words: " + ", ".join(unknown[:12]) + ". Spell them out or remove them."})
        long_sentences = [s for s in re.split(r"(?<=[.!?।])\s+|\n+", free) if len(s.split()) > 30]
        if long_sentences:
            notes.append({"level": "warning", "text": f"{len(long_sentences)} sentence(s) are longer than 30 words. Shorter sentences are easier to read."})
        language = output.language
        if language in _SCRIPTS and output.kind != "lab_explanation":
            authored = _authored_text(structured, language)
            if _script_letters(authored, language) < 10 and len(re.findall(r"[A-Za-z]", authored)) >= 20:
                notes.append({"level": "warning", "text": "The recorded notes are written in English, but this summary is set to another language. Clinical text is not machine-translated: add a translation or confirm the patient reads English."})
    return notes


def format_when(moment):
    """Date only: the exact local time is shown on the Appointments page."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%d-%m-%Y")
