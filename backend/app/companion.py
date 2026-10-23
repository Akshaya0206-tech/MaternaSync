"""Care companion engine: navigation help, reviewed-education lookup and safe routing.

It never generates medical content. Every answer is one of:
  * an urgent-safety message (fixed text) when the patient describes a warning sign,
  * a hand-off of a medical question to the clinician-reviewed question workflow,
  * a navigation pointer inside the app,
  * extracts of education modules that a doctor has approved, shown with their source,
  * an honest "nothing reviewed on this topic" with an offer to ask the care team.
Matching is keyword/TF-IDF based and runs entirely on this server.
"""
import math
import re
from collections import Counter

LANGUAGES = ("en", "hi", "ta", "te")

MSG = {
    "greeting": {
        "en": "Hello! I can help you find things in the app and show information that your clinic has reviewed. I cannot answer medical questions. I will pass those to your care team.",
        "hi": "नमस्ते! मैं ऐप में चीज़ें खोजने और आपके क्लिनिक द्वारा जाँची गई जानकारी दिखाने में मदद कर सकता हूँ। मैं चिकित्सा संबंधी प्रश्नों का उत्तर नहीं दे सकता। उन्हें मैं आपकी देखभाल टीम तक पहुँचाऊँगा।",
        "ta": "வணக்கம்! செயலியில் தேவையானதைக் கண்டுபிடிக்கவும், உங்கள் மருத்துவமனை மதிப்பாய்வு செய்த தகவல்களைக் காட்டவும் நான் உதவ முடியும். மருத்துவக் கேள்விகளுக்கு என்னால் பதில் சொல்ல முடியாது; அவற்றை உங்கள் பராமரிப்புக் குழுவுக்கு அனுப்புவேன்.",
        "te": "నమస్కారం! యాప్‌లో కావలసినవి కనుగొనడానికి, మీ క్లినిక్ సమీక్షించిన సమాచారం చూపించడానికి నేను సహాయం చేయగలను. వైద్య ప్రశ్నలకు నేను సమాధానం ఇవ్వలేను; వాటిని మీ సంరక్షణ బృందానికి పంపిస్తాను.",
    },
    "urgent": {
        "en": "What you describe may need urgent attention. Please contact your maternity unit or care team right now, or call your local emergency number (112 in India). Do not wait for an online reply.",
        "hi": "आप जो बता रही हैं उस पर तुरंत ध्यान देना ज़रूरी हो सकता है। कृपया अभी अपने प्रसूति विभाग या देखभाल टीम से संपर्क करें, या अपने स्थानीय आपातकालीन नंबर (भारत में 112) पर कॉल करें। ऑनलाइन उत्तर का इंतज़ार न करें।",
        "ta": "நீங்கள் குறிப்பிடுவதற்கு உடனடிக் கவனம் தேவைப்படலாம். உடனே உங்கள் மகப்பேறு பிரிவு அல்லது பராமரிப்புக் குழுவைத் தொடர்புகொள்ளுங்கள், அல்லது உங்கள் அவசர எண்ணை (இந்தியாவில் 112) அழையுங்கள். இணையப் பதிலுக்காகக் காத்திருக்காதீர்கள்.",
        "te": "మీరు వివరించిన దానికి తక్షణ శ్రద్ధ అవసరం కావచ్చు. దయచేసి ఇప్పుడే మీ ప్రసూతి విభాగాన్ని లేదా సంరక్షణ బృందాన్ని సంప్రదించండి, లేదా మీ స్థానిక అత్యవసర నంబర్‌కు (భారతదేశంలో 112) కాల్ చేయండి. ఆన్‌లైన్ సమాధానం కోసం వేచి ఉండకండి.",
    },
    "clinical": {
        "en": "This sounds like a medical question, so I cannot answer it. I can send it to your care team. A doctor will review it and the reply will appear in My Questions.",
        "hi": "यह चिकित्सा संबंधी प्रश्न लगता है, इसलिए मैं इसका उत्तर नहीं दे सकता। मैं इसे आपकी देखभाल टीम को भेज सकता हूँ। डॉक्टर इसकी समीक्षा करेंगे और उत्तर 'मेरे प्रश्न' में दिखेगा।",
        "ta": "இது மருத்துவக் கேள்வி போலத் தெரிகிறது; அதனால் என்னால் பதில் சொல்ல முடியாது. இதை உங்கள் பராமரிப்புக் குழுவுக்கு அனுப்ப முடியும். மருத்துவர் மதிப்பாய்வு செய்தபின் பதில் 'எனது கேள்விகள்' பகுதியில் தோன்றும்.",
        "te": "ఇది వైద్య ప్రశ్నలా అనిపిస్తోంది, కాబట్టి నేను సమాధానం ఇవ్వలేను. దీన్ని మీ సంరక్షణ బృందానికి పంపగలను. డాక్టర్ సమీక్షించాక సమాధానం 'నా ప్రశ్నలు'లో కనిపిస్తుంది.",
    },
    "navigate": {
        "en": "You can find that here:",
        "hi": "आप इसे यहाँ पा सकती हैं:",
        "ta": "இதை இங்கே காணலாம்:",
        "te": "దీన్ని ఇక్కడ చూడవచ్చు:",
    },
    "found": {
        "en": "Here is information that your clinic has reviewed. It is general and is not advice for your own situation.",
        "hi": "यह वह जानकारी है जिसकी आपके क्लिनिक ने समीक्षा की है। यह सामान्य है और आपकी अपनी स्थिति के लिए सलाह नहीं है।",
        "ta": "இது உங்கள் மருத்துவமனை மதிப்பாய்வு செய்த தகவல். இது பொதுவானது; உங்கள் சொந்த நிலைக்கான ஆலோசனை அல்ல.",
        "te": "ఇది మీ క్లినిక్ సమీక్షించిన సమాచారం. ఇది సాధారణమైనది; మీ స్వంత పరిస్థితికి సలహా కాదు.",
    },
    "english_fallback": {
        "en": "",
        "hi": "आपकी भाषा में अभी कोई जाँची हुई जानकारी नहीं है, इसलिए यह अंग्रेज़ी में दिखाई गई है।",
        "ta": "உங்கள் மொழியில் மதிப்பாய்வு செய்யப்பட்ட தகவல் இன்னும் இல்லை; அதனால் இது ஆங்கிலத்தில் காட்டப்படுகிறது.",
        "te": "మీ భాషలో ఇంకా సమీక్షించిన సమాచారం లేదు, కాబట్టి ఇది ఆంగ్లంలో చూపబడింది.",
    },
    "none": {
        "en": "I could not find reviewed information about that. I can send your question to your care team instead.",
        "hi": "मुझे इस बारे में कोई जाँची हुई जानकारी नहीं मिली। इसके बजाय मैं आपका प्रश्न आपकी देखभाल टीम को भेज सकता हूँ।",
        "ta": "இதைப் பற்றி மதிப்பாய்வு செய்யப்பட்ட தகவல் எனக்குக் கிடைக்கவில்லை. அதற்குப் பதிலாக உங்கள் கேள்வியை உங்கள் பராமரிப்புக் குழுவுக்கு அனுப்ப முடியும்.",
        "te": "దీని గురించి సమీక్షించిన సమాచారం నాకు దొరకలేదు. బదులుగా మీ ప్రశ్నను మీ సంరక్షణ బృందానికి పంపగలను.",
    },
}

NAV = [
    {"id": "daily_log", "route": "/patient/daily-log",
     "label": {"en": "Daily check-in", "hi": "दैनिक जानकारी", "ta": "தினசரிப் பதிவு", "te": "రోజువారీ నమోదు"},
     "keywords": {"en": ["check-in", "check in", "checkin", "daily log", "kick counter", "movement counter", "log my", "enter my weight"],
                  "hi": ["दैनिक", "चेक-इन", "चेक इन", "हलचल गिनती", "वज़न दर्ज", "वजन दर्ज"],
                  "ta": ["தினசரி", "பதிவு செய்", "அசைவு எண்ணி", "எடையைப் பதிவு"],
                  "te": ["రోజువారీ", "చెక్-ఇన్", "చెక్ ఇన్", "కదలిక లెక్క", "బరువు నమోదు"]}},
    {"id": "care_plan", "route": "/patient/care-plan",
     "label": {"en": "My care plan", "hi": "मेरी देखभाल योजना", "ta": "எனது பராமரிப்புத் திட்டம்", "te": "నా సంరక్షణ ప్రణాళిక"},
     "keywords": {"en": ["reminder", "care plan", "visit summary", "my summary", "summaries", "request a visit", "request an appointment"],
                  "hi": ["रिमाइंडर", "याद दिलाना", "देखभाल योजना", "मुलाक़ात का सारांश", "सारांश", "अपॉइंटमेंट का अनुरोध"],
                  "ta": ["நினைவூட்டல்", "பராமரிப்புத் திட்டம்", "சுருக்கம்", "சந்திப்பு கோரிக்கை"],
                  "te": ["రిమైండర్", "గుర్తు చేయ", "సంరక్షణ ప్రణాళిక", "సారాంశం", "అపాయింట్‌మెంట్ అభ్యర్థన"]}},
    {"id": "records", "route": "/patient/records",
     "label": {"en": "My records", "hi": "मेरे रिकॉर्ड", "ta": "எனது பதிவுகள்", "te": "నా రికార్డులు"},
     "keywords": {"en": ["upload", "records", "documents", "my reports", "lab report", "scan report", "my files"],
                  "hi": ["अपलोड", "रिकॉर्ड", "दस्तावेज़", "रिपोर्ट अपलोड", "मेरी रिपोर्ट"],
                  "ta": ["பதிவேற்ற", "பதிவுகள்", "ஆவணங்கள்", "எனது அறிக்கை"],
                  "te": ["అప్‌లోడ్", "రికార్డులు", "పత్రాలు", "నా నివేదిక"]}},
    {"id": "questions", "route": "/patient/questions",
     "label": {"en": "My questions", "hi": "मेरे प्रश्न", "ta": "எனது கேள்விகள்", "te": "నా ప్రశ్నలు"},
     "keywords": {"en": ["my questions", "ask my care team", "ask the doctor", "ask my doctor", "my answers", "reply from"],
                  "hi": ["मेरे प्रश्न", "डॉक्टर से पूछ", "देखभाल टीम से पूछ", "उत्तर कहाँ"],
                  "ta": ["எனது கேள்விகள்", "மருத்துவரிடம் கேட்க", "குழுவிடம் கேட்க", "பதில் எங்கே"],
                  "te": ["నా ప్రశ్నలు", "డాక్టర్‌ను అడగ", "బృందాన్ని అడగ", "సమాధానం ఎక్కడ"]}},
    {"id": "appointments", "route": "/patient/appointments",
     "label": {"en": "Appointments", "hi": "अपॉइंटमेंट", "ta": "சந்திப்புகள்", "te": "అపాయింట్‌మెంట్లు"},
     "keywords": {"en": ["appointment", "next visit", "when is my visit", "booking"],
                  "hi": ["अपॉइंटमेंट", "अगली मुलाक़ात", "अगली विज़िट", "बुकिंग"],
                  "ta": ["சந்திப்பு", "அடுத்த வருகை", "முன்பதிவு"],
                  "te": ["అపాయింట్‌మెంట్", "తదుపరి సందర్శన", "బుకింగ్"]}},
    {"id": "consent", "route": "/patient/consent",
     "label": {"en": "Sharing & consent", "hi": "साझा करना और सहमति", "ta": "பகிர்வு & ஒப்புதல்", "te": "షేరింగ్ & సమ్మతి"},
     "keywords": {"en": ["consent", "sharing", "whatsapp", "opt out", "permission", "privacy"],
                  "hi": ["सहमति", "साझा", "व्हाट्सएप", "व्हाट्सऐप", "अनुमति", "गोपनीयता"],
                  "ta": ["ஒப்புதல்", "பகிர்வு", "வாட்ஸ்அப்", "அனுமதி", "தனியுரிமை"],
                  "te": ["సమ్మతి", "షేరింగ్", "వాట్సాప్", "అనుమతి", "గోప్యత"]}},
    {"id": "journey", "route": "/patient/journey",
     "label": {"en": "My journey", "hi": "मेरी यात्रा", "ta": "எனது பயணம்", "te": "నా ప్రయాణం"},
     "keywords": {"en": ["journey", "timeline", "history of my care"],
                  "hi": ["यात्रा", "टाइमलाइन"], "ta": ["பயணம்", "காலவரிசை"], "te": ["ప్రయాణం", "టైమ్‌లైన్"]}},
    {"id": "updates", "route": "/patient/updates",
     "label": {"en": "Updates", "hi": "अपडेट", "ta": "புதுப்பிப்புகள்", "te": "అప్‌డేట్‌లు"},
     "keywords": {"en": ["notification", "updates", "alerts"],
                  "hi": ["सूचना", "अपडेट", "नोटिफिकेशन"], "ta": ["அறிவிப்பு", "புதுப்பிப்பு"], "te": ["నోటిఫికేషన్", "అప్‌డేట్", "హెచ్చరిక"]}},
    {"id": "profile", "route": "/patient/profile",
     "label": {"en": "Profile", "hi": "प्रोफ़ाइल", "ta": "சுயவிவரம்", "te": "ప్రొఫైల్"},
     "keywords": {"en": ["profile", "phone number", "change my name", "date of birth"],
                  "hi": ["प्रोफ़ाइल", "फ़ोन नंबर", "फोन नंबर", "जन्म तिथि"],
                  "ta": ["சுயவிவரம்", "தொலைபேசி எண்", "பிறந்த தேதி"],
                  "te": ["ప్రొఫైల్", "ఫోన్ నంబర్", "పుట్టిన తేదీ"]}},
]

# Warning signs: fixed safety-net wording, no assessment. Substring match, all languages.
URGENT = {
    "en": ["heavy bleeding", "bleeding", "severe pain", "severe headache", "blurred vision", "blurry vision", "seizure", "convulsion", "fits",
           "baby not moving", "baby is not moving", "no movement", "less movement", "reduced movement", "movements have reduced", "water broke", "waters broke",
           "leaking fluid", "fever", "difficulty breathing", "can't breathe", "cannot breathe", "chest pain", "fainted", "unconscious"],
    "hi": ["रक्तस्राव", "खून", "तेज़ दर्द", "तेज दर्द", "बहुत दर्द", "तेज़ सिरदर्द", "तेज सिरदर्द", "धुंधला", "दौरे", "झटके", "बच्चा हिल नहीं", "हलचल कम", "हलचल नहीं",
           "पानी निकल", "पानी टूट", "बुखार", "साँस", "सांस", "बेहोश", "सीने में दर्द"],
    "ta": ["இரத்தப்போக்கு", "இரத்தம்", "கடுமையான வலி", "கடுமையான தலைவலி", "பார்வை மங்க", "வலிப்பு", "குழந்தை அசைவு இல்லை", "அசைவு குறைவு", "அசைவு இல்லை",
           "தண்ணீர் வெளியேற", "நீர் வெளியேற", "காய்ச்சல்", "மூச்சு", "மயக்கம்", "நெஞ்சு வலி"],
    "te": ["రక్తస్రావం", "రక్తం", "తీవ్రమైన నొప్పి", "తీవ్రమైన తలనొప్పి", "మసకగా", "మూర్ఛ", "బిడ్డ కదలడం లేదు", "కదలిక తగ్గ", "కదలిక లేదు",
           "నీరు కారడం", "జ్వరం", "శ్వాస", "స్పృహ", "ఛాతీ నొప్పి"],
    "romanized": ["khoon", "dard", "bukhar", "chakkar", "behosh", "rattham", "jwaram", "noppi"],
}
# Symptom / medicine / interpretation wording: a clinician must answer these.
MEDICAL = {
    "en": ["pain", "cramp", "vomit", "nausea", "dizzy", "dizziness", "swelling", "swollen", "headache", "itching", "rash", "discharge", "contraction", "infection",
           "is it safe", "can i take", "should i take", "can i eat", "dose", "dosage", "overdose", "side effect", "symptom", "diagnos", "is it normal", "is this normal",
           "my result", "my scan", "my test", "my blood sugar", "my blood pressure is", "medicine for", "tablet for", "treatment"],
    "hi": ["दर्द", "ऐंठन", "उल्टी", "मतली", "चक्कर", "सूजन", "सिरदर्द", "खुजली", "दाने", "संक्रमण", "सुरक्षित है", "ले सकती", "खुराक", "दुष्प्रभाव", "लक्षण", "सामान्य है",
           "मेरा परिणाम", "मेरी रिपोर्ट में", "दवा", "इलाज"],
    "ta": ["வலி", "பிடிப்பு", "வாந்தி", "குமட்டல்", "தலைசுற்றல்", "வீக்கம்", "தலைவலி", "அரிப்பு", "தடிப்பு", "தொற்று", "பாதுகாப்பானதா", "எடுத்துக்கொள்ளலாமா", "மருந்தளவு",
           "பக்க விளைவு", "அறிகுறி", "இயல்பானதா", "என் முடிவு", "மருந்து", "சிகிச்சை"],
    "te": ["నొప్పి", "తిమ్మిరి", "వాంతి", "వికారం", "తల తిరగ", "వాపు", "తలనొప్పి", "దురద", "దద్దుర్లు", "ఇన్ఫెక్షన్", "సురక్షితమేనా", "తీసుకోవచ్చా", "మోతాదు",
           "దుష్ప్రభావం", "లక్షణం", "సాధారణమేనా", "నా ఫలితం", "మందు", "చికిత్స"],
    "romanized": ["dawai", "dava", "marundhu", "mandu"],
}
GREETINGS = {
    "en": ["hello", "hi", "hey", "help", "what can you do", "good morning", "good evening"],
    "hi": ["नमस्ते", "नमस्कार", "मदद", "सहायता", "आप क्या कर सकते"],
    "ta": ["வணக்கம்", "உதவி", "நீங்கள் என்ன செய்ய"],
    "te": ["నమస్కారం", "హలో", "సహాయం", "మీరు ఏమి చేయగలరు"],
    "romanized": ["namaste", "vanakkam", "namaskaram"],
}
# Everyday topic words that point at a reviewed education module's topic.
TOPIC_HINTS = {
    "Nutrition": {"en": ["nutrition", "diet", "food", "eat", "eating", "meal"], "hi": ["पोषण", "आहार", "खाना", "भोजन", "खान-पान"],
                  "ta": ["ஊட்டச்சத்து", "உணவு", "சாப்பிட"], "te": ["పోషకాహారం", "ఆహారం", "తిన", "భోజనం"]},
    "Safe movement": {"en": ["exercise", "movement", "walk", "walking", "yoga", "activity", "workout"], "hi": ["व्यायाम", "कसरत", "योग", "चलना", "गतिविधि"],
                      "ta": ["உடற்பயிற்சி", "யோகா", "நடை", "இயக்கம்"], "te": ["వ్యాయామం", "యోగా", "నడక", "కదలిక"]},
    "Labour preparation": {"en": ["labour", "labor", "delivery", "hospital bag", "prepare for birth"], "hi": ["प्रसव", "डिलीवरी", "प्रसव की तैयारी"],
                           "ta": ["பிரசவம்", "பிரசவத் தயாரிப்பு"], "te": ["ప్రసవం", "ప్రసవ సన్నద్ధత"]},
    "Birth-plan discussions": {"en": ["birth plan", "birthing plan", "plan for birth"], "hi": ["जन्म योजना", "बर्थ प्लान"],
                               "ta": ["பிரசவத் திட்டம்"], "te": ["ప్రసవ ప్రణాళిక"]},
    "Postpartum recovery": {"en": ["postpartum", "after delivery", "after birth", "recovery", "postnatal"], "hi": ["प्रसव के बाद", "डिलीवरी के बाद", "पोस्टपार्टम"],
                            "ta": ["பிரசவத்திற்குப் பிறகு", "பிரசவத்திற்குப் பிந்தைய"], "te": ["ప్రసవం తర్వాత", "ప్రసవానంతర"]},
    "Lactation": {"en": ["breastfeeding", "breast feeding", "lactation", "feeding my baby", "breast milk"], "hi": ["स्तनपान", "दूध पिलाना"],
                  "ta": ["தாய்ப்பால்"], "te": ["తల్లిపాలు", "పాలివ్వడం"]},
}

_WORD = re.compile(r"[a-z0-9]+|[ऀ-ॣ०-ॿ஀-௿ఀ-౿]+")
_STOP = {"the", "a", "an", "is", "are", "was", "what", "how", "do", "does", "i", "my", "me", "can", "to", "of", "in", "and", "for", "about", "tell", "please", "should", "on", "it"}


_JOINERS = re.compile("[‌‍]")  # zero-width (non-)joiners: typed inconsistently in Indic scripts


def _normalize(text):
    return re.sub(r"\s+", " ", _JOINERS.sub("", text).lower()).strip()


def _contains(text, term):
    """Single ASCII words need a word start (and an end when short, so 'hi' never matches 'high');
    phrases and non-Latin terms are matched as substrings because Indian-language words inflect."""
    term = _JOINERS.sub("", term).lower()
    if term.isascii() and " " not in term:
        pattern = r"(?<![a-z0-9])" + re.escape(term) + (r"(?![a-z0-9])" if len(term) <= 4 else "")
        return re.search(pattern, text) is not None
    return term in text


def _any_language(text, groups):
    return any(_contains(text, term) for terms in groups.values() for term in terms)


def _stem(token):
    if token.isascii():
        return token[:-1] if len(token) > 3 and token.endswith("s") else token
    return token[:6]


def _tokens(text):
    return [_stem(t) for t in _WORD.findall(_normalize(text)) if len(t) > 1 and t not in _STOP]


def _search_education(question, modules, stage=None):
    """TF-IDF cosine over reviewed modules, plus a boost when the question names a module's topic.
    The patient's stage only breaks ties: a direct question finds its topic at any stage."""
    query = Counter(_tokens(question))
    docs = [(m, Counter(_tokens(f"{m['title']} {m['topic']} {m['content']}"))) for m in modules]
    if not docs:
        return []
    frequency = Counter(token for _, doc in docs for token in doc)

    def weight(token):
        return math.log((1 + len(docs)) / (1 + frequency.get(token, 0))) + 1

    q_vec = {t: c * weight(t) for t, c in query.items()}
    scored = []
    text = _normalize(question)
    for module, doc in docs:
        d_vec = {t: c * weight(t) for t, c in doc.items()}
        dot = sum(w * d_vec.get(t, 0.0) for t, w in q_vec.items())
        norm = math.sqrt(sum(v * v for v in q_vec.values())) * math.sqrt(sum(v * v for v in d_vec.values()))
        score = dot / norm if norm else 0.0
        hints = TOPIC_HINTS.get(module["topic"])
        if hints and _any_language(text, hints):
            score = max(score, 0.5)
        if score >= 0.12:
            scored.append((module, score + (0.05 if stage and module.get("stage") in (stage, "all") else 0)))
    return [m for m, _ in sorted(scored, key=lambda pair: pair[1], reverse=True)[:3]]


def respond(question, language, modules, fallback_modules=(), stage=None):
    """Return the companion's reply. `modules` are current, approved education modules in `language`."""
    language = language if language in LANGUAGES else "en"
    text = _normalize(question)
    base = {"language": language, "actions": [], "education": [], "intent": "", "safety": None}

    if _any_language(text, URGENT):
        return {**base, "intent": "urgent", "safety": "urgent", "message": MSG["urgent"][language],
                "actions": [{"type": "send_to_care_team"}]}

    if _any_language(text, MEDICAL):
        return {**base, "intent": "clinical", "safety": "clinical", "message": MSG["clinical"][language],
                "actions": [{"type": "send_to_care_team"}]}

    for item in NAV:
        if _any_language(text, item["keywords"]):
            return {**base, "intent": f"navigate:{item['id']}", "message": MSG["navigate"][language],
                    "actions": [{"type": "navigate", "route": item["route"], "label": item["label"][language]}]}

    matches = _search_education(question, modules, stage)
    fallback_used = False
    if not matches and fallback_modules and language != "en":
        matches, fallback_used = _search_education(question, fallback_modules, stage), True
    if matches:
        message = MSG["found"][language]
        if fallback_used:
            message += " " + MSG["english_fallback"][language]
        return {**base, "intent": "education", "message": message, "education": matches}

    if _any_language(text, GREETINGS) or len(_tokens(text)) == 0:
        return {**base, "intent": "greeting", "message": MSG["greeting"][language]}

    return {**base, "intent": "no_match", "message": MSG["none"][language], "actions": [{"type": "send_to_care_team"}]}
