import type { PatientReferences } from './patientReferencesTypes';

// Pregnancy information for patients, written in our own words from official pages (MoHFW/NHM, ICMR-NIN, WHO, NHS).
// Sources, checking notes and what still needs a native speaker's and a clinician's review: see patientReferences.notes.md.
export const patientReferences: PatientReferences = {
 "generatedFrom": "Checked on 2026-10-24. Every statement was written in the author's own words from official pages that were opened that day: HTML pages with WebFetch, and PDFs downloaded and read as text. Source priority was MoHFW/NHM/MWCD/ICMR-NIN (India), then WHO, then NHS (UK) for general medical topics. All listed URLs returned HTTP 200 on 2026-10-24 and are the final URLs after redirects. Several Indian documents are older (MCP card 2018 version, GDM guideline December 2014, Td guidelines about 2019, Safe Motherhood booklet undated) and should be re-checked against current MoHFW releases. UK-only details (phone numbers, NHS service names) were not used; only the general medical advice was. Not yet reviewed by a clinician or by native speakers of Hindi, Tamil and Telugu.",
 "categories": [
  {
   "id": "safety",
   "title": {
    "en": "Safety first",
    "hi": "सुरक्षा सबसे पहले",
    "ta": "பாதுகாப்பு முதலில்",
    "te": "భద్రత ముందు"
   }
  },
  {
   "id": "care",
   "title": {
    "en": "Your care",
    "hi": "आपकी देखभाल",
    "ta": "உங்கள் பராமரிப்பு",
    "te": "మీ సంరక్షణ"
   }
  },
  {
   "id": "body",
   "title": {
    "en": "Your body",
    "hi": "आपका शरीर",
    "ta": "உங்கள் உடல்",
    "te": "మీ శరీరం"
   }
  },
  {
   "id": "baby",
   "title": {
    "en": "Baby and birth",
    "hi": "शिशु और प्रसव",
    "ta": "குழந்தையும் பிரசவமும்",
    "te": "బిడ్డ మరియు కాన్పు"
   }
  },
  {
   "id": "support",
   "title": {
    "en": "Support",
    "hi": "सहायता और सहयोग",
    "ta": "ஆதரவு",
    "te": "మద్దతు"
   }
  }
 ],
 "topics": [
  {
   "id": "danger-signs",
   "category": "safety",
   "title": {
    "en": "Warning signs: when to get help right away",
    "hi": "खतरे के संकेत: कब तुरंत मदद लें",
    "ta": "ஆபத்து அறிகுறிகள்: உடனே உதவி பெற வேண்டிய நேரம்",
    "te": "ప్రమాద సూచనలు: వెంటనే సహాయం పొందాల్సిన సమయం"
   },
   "summary": {
    "en": "If you have any sign in the list below, go to the nearest hospital or call emergency services (112 or 108) immediately, day or night. These signs can mean a serious problem for you or your baby, and quick care protects you both. This is general information, so please follow the advice of your own care team.",
    "hi": "नीचे की सूची में से कोई भी संकेत दिखे तो तुरंत, दिन हो या रात, नज़दीकी अस्पताल जाएँ या आपातकालीन सेवा (112 या 108) पर कॉल करें। ये संकेत आपके या आपके शिशु के लिए गंभीर समस्या का इशारा हो सकते हैं, और जल्दी इलाज से आप दोनों की सुरक्षा होती है। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கீழே உள்ள பட்டியலில் ஏதேனும் ஓர் அறிகுறி இருந்தால், பகலோ இரவோ, உடனே அருகிலுள்ள மருத்துவமனைக்குச் செல்லுங்கள் அல்லது அவசரச் சேவையை (112 அல்லது 108) அழைக்கவும். இந்த அறிகுறிகள் உங்களுக்கோ உங்கள் குழந்தைக்கோ தீவிரமான பிரச்சினை இருப்பதைக் காட்டலாம்; விரைவான சிகிச்சை உங்கள் இருவரையும் பாதுகாக்கும். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "కింది జాబితాలో ఏ సూచన కనిపించినా, పగలైనా రాత్రైనా, వెంటనే దగ్గరలోని ఆసుపత్రికి వెళ్ళండి లేదా అత్యవసర సేవలకు (112 లేదా 108) కాల్ చేయండి. ఈ సూచనలు మీకు లేదా మీ బిడ్డకు తీవ్రమైన సమస్య ఉందని సూచించవచ్చు; త్వరగా చికిత్స అందితే మీ ఇద్దరినీ కాపాడుతుంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "If you have any sign in the ‘Get help’ list below, go to the nearest hospital or call emergency services (112 or 108) immediately, day or night.",
     "Do not wait to see if the sign goes away, and do not wait for your next check-up.",
     "Take your Mother and Child Protection (MCP) card with you, and ask a family member to come along.",
     "Plan ahead: know which hospital you will go to, how you will get there at night, and who will go with you.",
     "The government offers free ambulance transport to pregnant women under the JSSK scheme. The numbers 102 and 108 are used in many states, but availability differs by state."
    ],
    "hi": [
     "नीचे ‘मदद लें’ सूची में से कोई भी संकेत दिखे तो तुरंत, दिन हो या रात, नज़दीकी अस्पताल जाएँ या आपातकालीन सेवा (112 या 108) पर कॉल करें।",
     "यह देखने के लिए इंतज़ार न करें कि संकेत अपने आप ठीक होता है या नहीं, और अगली जाँच का भी इंतज़ार न करें।",
     "अपना मातृ एवं शिशु सुरक्षा कार्ड (MCP कार्ड) साथ ले जाएँ और परिवार के किसी सदस्य को साथ चलने को कहें।",
     "पहले से तैयारी रखें: किस अस्पताल जाना है, रात में वहाँ कैसे पहुँचेंगे, और आपके साथ कौन जाएगा, यह तय रखें।",
     "सरकार JSSK योजना के तहत गर्भवती महिलाओं को मुफ़्त एंबुलेंस सुविधा देती है। कई राज्यों में 102 और 108 नंबर चलते हैं, पर उपलब्धता राज्य के अनुसार अलग हो सकती है।"
    ],
    "ta": [
     "கீழே உள்ள ‘உதவி பெறுங்கள்’ பட்டியலில் ஏதேனும் ஓர் அறிகுறி இருந்தால், பகலோ இரவோ, உடனே அருகிலுள்ள மருத்துவமனைக்குச் செல்லுங்கள் அல்லது அவசரச் சேவையை (112 அல்லது 108) அழைக்கவும்.",
     "அறிகுறி தானாகச் சரியாகுமா என்று காத்திருக்காதீர்கள்; அடுத்த பரிசோதனை வரை காத்திருக்கவும் வேண்டாம்.",
     "உங்கள் தாய்-சேய் பாதுகாப்பு அட்டையை (MCP அட்டை) எடுத்துச் செல்லுங்கள்; குடும்பத்தில் ஒருவரையும் உடன் அழைத்துச் செல்லுங்கள்.",
     "முன்கூட்டியே திட்டமிடுங்கள்: எந்த மருத்துவமனைக்குச் செல்வீர்கள், இரவில் எப்படிச் செல்வீர்கள், உங்களுடன் யார் வருவார்கள் என்பதை முடிவு செய்து வையுங்கள்.",
     "JSSK திட்டத்தின் கீழ் கர்ப்பிணிகளுக்கு அரசு இலவச ஆம்புலன்ஸ் வசதி அளிக்கிறது. பல மாநிலங்களில் 102, 108 எண்கள் செயல்படுகின்றன; ஆனால் இந்த வசதி மாநிலத்துக்கு மாநிலம் மாறுபடும்."
    ],
    "te": [
     "కింద ఉన్న ‘సహాయం పొందండి’ జాబితాలో ఏ సూచన కనిపించినా, పగలైనా రాత్రైనా, వెంటనే దగ్గరలోని ఆసుపత్రికి వెళ్ళండి లేదా అత్యవసర సేవలకు (112 లేదా 108) కాల్ చేయండి.",
     "ఆ సూచన దానంతట అదే తగ్గుతుందేమో అని ఎదురుచూడకండి; తదుపరి పరీక్ష వరకు కూడా ఆగకండి.",
     "మీ తల్లి-బిడ్డ రక్షణ కార్డు (MCP కార్డు) వెంట తీసుకెళ్ళండి, కుటుంబ సభ్యులలో ఒకరిని తోడుగా రమ్మనండి.",
     "ముందుగానే ప్లాన్ చేసుకోండి: ఏ ఆసుపత్రికి వెళ్తారు, రాత్రి అక్కడికి ఎలా చేరుకుంటారు, మీతో ఎవరు వస్తారు అనేది నిర్ణయించుకోండి.",
     "JSSK పథకం కింద ప్రభుత్వం గర్భిణులకు ఉచిత అంబులెన్స్ రవాణా అందిస్తుంది. చాలా రాష్ట్రాల్లో 102, 108 నంబర్లు పనిచేస్తాయి, కానీ లభ్యత రాష్ట్రాన్ని బట్టి మారుతుంది."
    ]
   },
   "seekHelp": {
    "en": [
     "Bleeding from the vagina",
     "Fits (convulsions)",
     "Severe headache with blurred vision",
     "Severe pain in the belly",
     "High fever, or fever with feeling too weak to get out of bed",
     "Your baby moves much less than usual, or not at all",
     "Fluid leaking from the vagina, or the water bag breaking, before labour pains start",
     "Fast or difficult breathing, or sudden swelling of the face, hands or whole body"
    ],
    "hi": [
     "योनि से खून बहना",
     "दौरे (झटके) पड़ना",
     "तेज़ सिरदर्द के साथ धुंधला दिखना",
     "पेट में तेज़ दर्द",
     "तेज़ बुखार, या बुखार के साथ इतनी कमज़ोरी कि बिस्तर से उठा न जाए",
     "शिशु की हलचल सामान्य से बहुत कम हो जाना, या बिल्कुल न होना",
     "प्रसव पीड़ा शुरू होने से पहले योनि से पानी रिसना या पानी की थैली फट जाना",
     "साँस तेज़ चलना या साँस लेने में तकलीफ़, या चेहरे, हाथों या पूरे शरीर में अचानक सूजन"
    ],
    "ta": [
     "பிறப்புறுப்பிலிருந்து இரத்தப்போக்கு",
     "வலிப்பு (வலிப்புத் தாக்கம்)",
     "கடுமையான தலைவலியுடன் பார்வை மங்குதல்",
     "வயிற்றில் கடுமையான வலி",
     "அதிகக் காய்ச்சல், அல்லது காய்ச்சலுடன் படுக்கையிலிருந்து எழ முடியாத அளவு சோர்வு",
     "குழந்தையின் அசைவு வழக்கத்தைவிட மிகவும் குறைதல், அல்லது அசைவே இல்லாதிருத்தல்",
     "பிரசவ வலி தொடங்கும் முன் பிறப்புறுப்பிலிருந்து நீர் கசிதல் அல்லது பனிக்குடம் உடைதல்",
     "வேகமான அல்லது சிரமமான மூச்சு, அல்லது முகம், கைகள் அல்லது உடல் முழுவதும் திடீர் வீக்கம்"
    ],
    "te": [
     "యోని నుండి రక్తస్రావం",
     "మూర్ఛలు (ఫిట్స్)",
     "తీవ్రమైన తలనొప్పితో పాటు చూపు మసకబారడం",
     "కడుపులో తీవ్రమైన నొప్పి",
     "తీవ్రమైన జ్వరం, లేదా జ్వరంతో పాటు మంచం మీద నుండి లేవలేనంత నీరసం",
     "బిడ్డ కదలికలు మామూలు కంటే చాలా తగ్గడం, లేదా అసలు లేకపోవడం",
     "ప్రసవ నొప్పులు మొదలయ్యే ముందే యోని నుండి నీరు కారడం లేదా నీటి సంచి పగలడం",
     "శ్వాస వేగంగా ఆడటం లేదా శ్వాస తీసుకోవడం కష్టంగా ఉండటం, లేదా ముఖం, చేతులు లేదా శరీరమంతా అకస్మాత్తుగా వాపు"
    ]
   },
   "keywords": [
    "danger signs",
    "warning signs",
    "emergency",
    "bleeding",
    "khoon",
    "blood loss",
    "fits",
    "convulsion",
    "daura",
    "jhatke",
    "severe headache",
    "blurred vision",
    "dhundhla",
    "fever",
    "bukhar",
    "baby not moving",
    "leaking water",
    "water broke",
    "paani",
    "breathless",
    "saans",
    "swelling",
    "sujan",
    "severe stomach pain",
    "pet dard",
    "hospital",
    "ambulance",
    "urgent"
   ],
   "sources": [
    {
     "label": "Pregnancy, childbirth, postpartum and newborn care: a guide for essential practice (3rd edition) (PDF)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://iris.who.int/server/api/core/bitstreams/e9f751fd-6eab-42cb-9e0c-0eb86a0365bb/content"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Pregnancy symptoms you need to get help for - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/pregnancy-symptoms-you-need-to-get-help-for/"
    }
   ]
  },
  {
   "id": "antenatal-visits",
   "category": "care",
   "title": {
    "en": "Antenatal check-ups: why they matter",
    "hi": "गर्भावस्था की जाँच (ANC): क्यों ज़रूरी है",
    "ta": "கர்ப்பகால பரிசோதனைகள்: ஏன் முக்கியம்",
    "te": "గర్భిణీ పరీక్షలు: ఎందుకు ముఖ్యం"
   },
   "summary": {
    "en": "Regular check-ups help your care team find problems early and keep you and your baby healthy. Register your pregnancy at the nearest government health facility as soon as you know you are pregnant, and ask your ASHA or ANM to help. This is general information, so please follow the advice of your own care team.",
    "hi": "नियमित जाँच से आपकी देखभाल टीम समस्याओं को जल्दी पकड़ पाती है और आप व शिशु स्वस्थ रहते हैं। गर्भ का पता चलते ही अपने नज़दीकी सरकारी स्वास्थ्य केंद्र में पंजीकरण कराएँ, और इसके लिए आशा या ANM से मदद लें। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "வழக்கமான பரிசோதனைகள், பிரச்சினைகளை முன்கூட்டியே கண்டறிந்து உங்களையும் குழந்தையையும் ஆரோக்கியமாக வைத்திருக்க உங்கள் பராமரிப்புக் குழுவுக்கு உதவுகின்றன. கர்ப்பம் என்று தெரிந்தவுடன் அருகிலுள்ள அரசு சுகாதார மையத்தில் பதிவு செய்யுங்கள்; இதற்கு ஆஷா அல்லது ANM-இடம் உதவி கேளுங்கள். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "క్రమం తప్పని పరీక్షల వల్ల సమస్యలను ముందే గుర్తించి, మీరు మరియు మీ బిడ్డ ఆరోగ్యంగా ఉండేలా మీ సంరక్షణ బృందం చూసుకోగలదు. గర్భం అని తెలియగానే దగ్గరలోని ప్రభుత్వ ఆరోగ్య కేంద్రంలో నమోదు చేయించుకోండి; దీనికి ఆశా లేదా ANM సహాయం తీసుకోండి. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Register as early as possible. The Mother and Child Protection (MCP) card asks for registration in the first three months of pregnancy.",
     "The Government of India booklet lists at least four check-ups: in the first three months, in months 4 to 6, in months 7 to 8, and in month 9. WHO now recommends at least eight contacts with a health worker, the first within 12 weeks. Your care team will decide your schedule.",
     "At check-ups your blood level (haemoglobin), blood pressure, urine, weight and belly (to see the baby's growth) are checked. The MCP card also lists tests such as blood group, HIV and syphilis screening, a sugar test and an ultrasound.",
     "Under the PMSMA programme, the government site says free check-ups by a doctor are offered on the 9th of every month at designated government health facilities for women in the 2nd or 3rd trimester. Ask your ANM or ASHA for the nearest centre.",
     "Carry your MCP card and Safe Motherhood booklet to every visit."
    ],
    "hi": [
     "जितना जल्दी हो सके पंजीकरण कराएँ। मातृ एवं शिशु सुरक्षा (MCP) कार्ड के अनुसार गर्भावस्था के पहले तीन महीनों में पंजीकरण होना चाहिए।",
     "भारत सरकार की पुस्तिका के अनुसार कम से कम चार जाँच ज़रूरी हैं: पहले तीन महीनों में, 4 से 6 महीने में, 7 से 8 महीने में और 9वें महीने में। WHO अब स्वास्थ्यकर्मी से कम से कम आठ बार संपर्क की सलाह देता है, जिसमें पहला संपर्क 12 सप्ताह के भीतर हो। आपकी जाँच का कार्यक्रम आपकी देखभाल टीम तय करेगी।",
     "जाँच में आपका खून (हीमोग्लोबिन), रक्तचाप (BP), पेशाब, वज़न और पेट (शिशु के विकास को देखने के लिए) जाँचे जाते हैं। MCP कार्ड में ब्लड ग्रुप, HIV और सिफलिस की जाँच, शुगर की जाँच और अल्ट्रासाउंड जैसी जाँचें भी लिखी हैं।",
     "PMSMA कार्यक्रम के तहत सरकारी वेबसाइट के अनुसार, दूसरी या तीसरी तिमाही की महिलाओं के लिए तय सरकारी स्वास्थ्य केंद्रों पर हर महीने की 9 तारीख को डॉक्टर द्वारा मुफ़्त जाँच होती है। नज़दीकी केंद्र के बारे में अपनी ANM या आशा से पूछें।",
     "हर बार जाँच पर अपना MCP कार्ड और सुरक्षित मातृत्व पुस्तिका साथ ले जाएँ।"
    ],
    "ta": [
     "முடிந்தவரை விரைவில் பதிவு செய்யுங்கள். தாய்-சேய் பாதுகாப்பு (MCP) அட்டையின்படி, கர்ப்பத்தின் முதல் மூன்று மாதங்களுக்குள் பதிவு செய்ய வேண்டும்.",
     "இந்திய அரசின் கையேடு குறைந்தது நான்கு பரிசோதனைகளைக் குறிப்பிடுகிறது: முதல் மூன்று மாதங்களில், 4 முதல் 6 மாதங்களில், 7 முதல் 8 மாதங்களில், 9-ஆம் மாதத்தில். WHO தற்போது சுகாதாரப் பணியாளருடன் குறைந்தது எட்டு முறை தொடர்பு கொள்ள பரிந்துரைக்கிறது; முதல் தொடர்பு 12 வாரங்களுக்குள். உங்கள் பரிசோதனை அட்டவணையை உங்கள் பராமரிப்புக் குழு முடிவு செய்யும்.",
     "பரிசோதனைகளில் உங்கள் இரத்த அளவு (ஹீமோகுளோபின்), இரத்த அழுத்தம் (BP), சிறுநீர், எடை, வயிறு (குழந்தையின் வளர்ச்சியைப் பார்க்க) ஆகியவை பார்க்கப்படும். இரத்த வகை, HIV, சிபிலிஸ் பரிசோதனை, சர்க்கரைப் பரிசோதனை, அல்ட்ராசவுண்ட் போன்றவையும் MCP அட்டையில் குறிப்பிடப்பட்டுள்ளன.",
     "PMSMA திட்டத்தின் கீழ், 2-ஆம் அல்லது 3-ஆம் மூன்று மாதக் காலத்தில் உள்ள பெண்களுக்கு, குறிப்பிட்ட அரசு சுகாதார மையங்களில் ஒவ்வொரு மாதமும் 9-ஆம் தேதி மருத்துவரால் இலவசப் பரிசோதனை வழங்கப்படுவதாக அரசு இணையதளம் கூறுகிறது. அருகிலுள்ள மையம் எது என்று உங்கள் ANM அல்லது ஆஷாவிடம் கேளுங்கள்.",
     "ஒவ்வொரு முறையும் உங்கள் MCP அட்டை மற்றும் பாதுகாப்பான தாய்மைக் கையேட்டை எடுத்துச் செல்லுங்கள்."
    ],
    "te": [
     "వీలైనంత త్వరగా నమోదు చేయించుకోండి. తల్లి-బిడ్డ రక్షణ (MCP) కార్డు ప్రకారం గర్భం మొదటి మూడు నెలల్లోనే నమోదు చేయించుకోవాలి.",
     "భారత ప్రభుత్వ చిన్న పుస్తకం ప్రకారం కనీసం నాలుగు పరీక్షలు అవసరం: మొదటి మూడు నెలల్లో, 4 నుండి 6 నెలల్లో, 7 నుండి 8 నెలల్లో, 9వ నెలలో. WHO ఇప్పుడు ఆరోగ్య కార్యకర్తతో కనీసం ఎనిమిది సార్లు సంప్రదించమని సూచిస్తోంది; మొదటిది 12 వారాల లోపు. మీ పరీక్షల షెడ్యూల్‌ను మీ సంరక్షణ బృందం నిర్ణయిస్తుంది.",
     "పరీక్షల్లో మీ రక్తం స్థాయి (హిమోగ్లోబిన్), రక్తపోటు (BP), మూత్రం, బరువు, కడుపు (బిడ్డ ఎదుగుదల చూడటానికి) చూస్తారు. రక్త గ్రూపు, HIV మరియు సిఫిలిస్ పరీక్ష, షుగర్ పరీక్ష, అల్ట్రాసౌండ్ వంటివి కూడా MCP కార్డులో ఉన్నాయి.",
     "PMSMA కార్యక్రమం కింద, 2వ లేదా 3వ త్రైమాసికంలో ఉన్న మహిళలకు నిర్దేశిత ప్రభుత్వ ఆరోగ్య కేంద్రాల్లో ప్రతి నెలా 9వ తేదీన డాక్టర్ ఉచితంగా పరీక్షలు చేస్తారని ప్రభుత్వ వెబ్‌సైట్ చెబుతోంది. దగ్గరలోని కేంద్రం గురించి మీ ANM లేదా ఆశాను అడగండి.",
     "ప్రతి సారి పరీక్షకు వెళ్ళినప్పుడు మీ MCP కార్డు మరియు సురక్షిత మాతృత్వ పుస్తకం వెంట తీసుకెళ్ళండి."
    ]
   },
   "seekHelp": {
    "en": [],
    "hi": [],
    "ta": [],
    "te": []
   },
   "keywords": [
    "anc",
    "check up",
    "checkup",
    "check-up",
    "visit",
    "antenatal",
    "pmsma",
    "9th",
    "9 tarikh",
    "scan",
    "ultrasound",
    "sonography",
    "mcp card",
    "registration",
    "register",
    "doctor visit",
    "jaanch",
    "jaach",
    "how many visits",
    "pregnancy card"
   ],
   "sources": [
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    },
    {
     "label": "Pradhan Mantri Surakshit Matritva Abhiyan | PMSMA",
     "publisher": "Ministry of Health and Family Welfare, Government of India",
     "url": "https://pmsma.mohfw.gov.in/"
    },
    {
     "label": "What benefits would pregnant women receive (PMSMA)",
     "publisher": "Ministry of Health and Family Welfare, Government of India",
     "url": "https://pmsma.mohfw.gov.in/i-am/pregnant-woman/what-benefits-would-pregnant-women-receive/"
    },
    {
     "label": "New guidelines on antenatal care for a positive pregnancy experience",
     "publisher": "World Health Organization (WHO)",
     "url": "https://www.who.int/news/item/07-11-2016-new-guidelines-on-antenatal-care-for-a-positive-pregnancy-experience"
    }
   ]
  },
  {
   "id": "eating-well",
   "category": "care",
   "title": {
    "en": "Eating well in pregnancy",
    "hi": "गर्भावस्था में अच्छा खान-पान",
    "ta": "கர்ப்ப காலத்தில் நல்ல உணவு",
    "te": "గర్భధారణలో మంచి ఆహారం"
   },
   "summary": {
    "en": "In pregnancy you need some extra food, and it should be healthy and varied. Eat a mix of local foods, drink safe water and keep food clean. This is general information, so please follow the advice of your own care team.",
    "hi": "गर्भावस्था में आपको थोड़ा ज़्यादा खाना चाहिए, और वह पौष्टिक व अलग-अलग तरह का होना चाहिए। स्थानीय खाने की चीज़ें मिलाकर खाएँ, साफ़ पानी पिएँ और खाना साफ़-सुथरा रखें। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கர்ப்ப காலத்தில் உங்களுக்குச் சற்று கூடுதல் உணவு தேவை; அது சத்தானதாகவும் பலவகையாகவும் இருக்க வேண்டும். உள்ளூரில் கிடைக்கும் உணவுகளைக் கலந்து சாப்பிடுங்கள், பாதுகாப்பான தண்ணீர் குடியுங்கள், உணவைச் சுத்தமாக வைத்திருங்கள். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "గర్భధారణలో మీకు కొంచెం ఎక్కువ ఆహారం కావాలి; అది పౌష్టికంగా, రకరకాలుగా ఉండాలి. స్థానికంగా దొరికే ఆహారాలను కలిపి తినండి, సురక్షితమైన నీరు తాగండి, ఆహారాన్ని శుభ్రంగా ఉంచండి. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Eat a little more than usual. The government booklet advises one extra meal a day, and ICMR-NIN advises extra healthy food from the second trimester.",
     "Each day, eat a mix of foods: cereals or millets, dal and other pulses, milk or curd, vegetables, fruits and green leafy vegetables. Add eggs, fish or meat if you eat them.",
     "For iron, eat green leafy vegetables, pulses, dry fruits, jaggery, and meat, fish or eggs. For calcium, take milk, curd, buttermilk, paneer or sesame seeds. Fruits with vitamin C, such as guava, orange and amla, help your body use iron. Tea can make it harder for the body to use iron, so avoid it just before, during or soon after meals.",
     "Drink plenty of safe water: about two litres or more a day, counting other drinks. If you are not sure the water is safe, boil it for 10 to 15 minutes.",
     "Keep food safe: wash your hands with soap and water before touching food, wash fruits and vegetables well, cook meat thoroughly, keep raw and cooked food apart, and eat cooked food within 4 to 6 hours or reheat it well.",
     "You do not need to avoid foods because of old beliefs or taboos. Do not smoke, chew tobacco or drink alcohol, and do not take any medicine without a doctor's advice. Use iodised salt."
    ],
    "hi": [
     "सामान्य से थोड़ा ज़्यादा खाएँ। सरकारी पुस्तिका रोज़ एक अतिरिक्त भोजन की सलाह देती है, और ICMR-NIN दूसरी तिमाही से अतिरिक्त पौष्टिक आहार की सलाह देता है।",
     "रोज़ अलग-अलग चीज़ें खाएँ: अनाज या मोटे अनाज (मिलेट), दाल और दूसरी फलियाँ, दूध या दही, सब्ज़ियाँ, फल और हरी पत्तेदार सब्ज़ियाँ। अंडा, मछली या मांस खाती हों तो उन्हें भी शामिल करें।",
     "आयरन के लिए हरी पत्तेदार सब्ज़ियाँ, दालें, सूखे मेवे, गुड़, और मांस, मछली या अंडा खाएँ। कैल्शियम के लिए दूध, दही, छाछ, पनीर या तिल लें। अमरूद, संतरा और आँवला जैसे विटामिन-सी वाले फल शरीर को आयरन इस्तेमाल करने में मदद करते हैं। चाय से शरीर को आयरन लेना मुश्किल हो सकता है, इसलिए खाने से ठीक पहले, खाने के दौरान या तुरंत बाद चाय न पिएँ।",
     "खूब साफ़ पानी पिएँ: दूसरे पेय मिलाकर रोज़ लगभग दो लीटर या उससे ज़्यादा। पानी साफ़ है या नहीं, इसमें शक हो तो उसे 10 से 15 मिनट उबालें।",
     "खाना सुरक्षित रखें: खाना छूने से पहले साबुन-पानी से हाथ धोएँ, फल-सब्ज़ियाँ अच्छी तरह धोएँ, मांस को अच्छी तरह पकाएँ, कच्चा और पका खाना अलग रखें, और पका खाना 4 से 6 घंटे के अंदर खा लें या अच्छी तरह गरम करके खाएँ।",
     "पुरानी मान्यताओं या वर्जनाओं की वजह से कोई खाना छोड़ने की ज़रूरत नहीं है। धूम्रपान, तंबाकू चबाना और शराब से दूर रहें, और डॉक्टर की सलाह के बिना कोई दवा न लें। आयोडीन वाला नमक इस्तेमाल करें।"
    ],
    "ta": [
     "வழக்கத்தைவிடச் சற்று அதிகமாகச் சாப்பிடுங்கள். அரசுக் கையேடு தினமும் ஒரு கூடுதல் வேளை உணவைப் பரிந்துரைக்கிறது; ICMR-NIN இரண்டாவது மூன்று மாதக் காலத்திலிருந்து கூடுதல் சத்தான உணவைப் பரிந்துரைக்கிறது.",
     "தினமும் பலவகை உணவுகளைச் சாப்பிடுங்கள்: தானியங்கள் அல்லது சிறுதானியங்கள், பருப்பு வகைகள், பால் அல்லது தயிர், காய்கறிகள், பழங்கள், கீரை வகைகள். முட்டை, மீன், இறைச்சி சாப்பிடுபவர்கள் அவற்றையும் சேர்க்கலாம்.",
     "இரும்புச் சத்துக்கு கீரை, பருப்பு, உலர் பழங்கள், வெல்லம், இறைச்சி, மீன் அல்லது முட்டை சாப்பிடுங்கள். கால்சியத்துக்கு பால், தயிர், மோர், பனீர் அல்லது எள் சாப்பிடுங்கள். கொய்யா, ஆரஞ்சு, நெல்லிக்காய் போன்ற வைட்டமின் சி உள்ள பழங்கள் உடல் இரும்புச் சத்தைப் பயன்படுத்த உதவும். தேநீர் இரும்புச் சத்தை உடல் பயன்படுத்துவதைத் தடுக்கலாம்; எனவே சாப்பாட்டுக்கு சற்று முன், சாப்பிடும்போது, அல்லது சாப்பிட்டவுடன் தேநீர் குடிப்பதைத் தவிர்க்கவும்.",
     "பாதுகாப்பான தண்ணீரை நிறையக் குடியுங்கள்: மற்ற பானங்களையும் சேர்த்து தினமும் சுமார் இரண்டு லிட்டர் அல்லது அதற்கு மேல். தண்ணீர் பாதுகாப்பானதா என்று சந்தேகம் இருந்தால் 10 முதல் 15 நிமிடம் கொதிக்க வைக்கவும்.",
     "உணவைப் பாதுகாப்பாக வைத்திருங்கள்: உணவைத் தொடும் முன் சோப்பு போட்டுக் கை கழுவுங்கள், பழங்கள், காய்கறிகளை நன்றாகக் கழுவுங்கள், இறைச்சியை நன்றாக வேகவையுங்கள், பச்சை உணவையும் சமைத்த உணவையும் தனித்தனியாக வையுங்கள், சமைத்த உணவை 4 முதல் 6 மணி நேரத்துக்குள் சாப்பிடுங்கள் அல்லது நன்றாகச் சூடுபடுத்துங்கள்.",
     "பழைய நம்பிக்கைகள் காரணமாக எந்த உணவையும் தவிர்க்க வேண்டியதில்லை. புகைபிடித்தல், புகையிலை மெல்லுதல், மது குடித்தல் கூடாது; மருத்துவரின் ஆலோசனையின்றி எந்த மருந்தையும் எடுக்காதீர்கள். அயோடின் கலந்த உப்பைப் பயன்படுத்துங்கள்."
    ],
    "te": [
     "మామూలు కంటే కొంచెం ఎక్కువ తినండి. ప్రభుత్వ పుస్తకం రోజుకు ఒక అదనపు భోజనం సూచిస్తోంది; ICMR-NIN రెండవ త్రైమాసికం నుండి అదనపు పౌష్టికాహారం సూచిస్తోంది.",
     "ప్రతిరోజూ రకరకాల ఆహారాలు తినండి: ధాన్యాలు లేదా చిరుధాన్యాలు, పప్పులు, పాలు లేదా పెరుగు, కూరగాయలు, పండ్లు, ఆకుకూరలు. గుడ్లు, చేపలు, మాంసం తినేవారైతే వాటిని కూడా చేర్చండి.",
     "ఇనుము కోసం ఆకుకూరలు, పప్పులు, ఎండు ఫలాలు, బెల్లం, మాంసం, చేపలు లేదా గుడ్లు తినండి. కాల్షియం కోసం పాలు, పెరుగు, మజ్జిగ, పనీర్ లేదా నువ్వులు తీసుకోండి. జామ, నారింజ, ఉసిరి వంటి విటమిన్ సి ఉన్న పండ్లు శరీరం ఇనుమును ఉపయోగించుకోవడానికి సహాయపడతాయి. టీ వల్ల శరీరానికి ఇనుము అందడం కష్టమవుతుంది, కాబట్టి భోజనానికి ముందు, భోజనం సమయంలో లేదా వెంటనే తర్వాత టీ తాగకండి.",
     "సురక్షితమైన నీరు బాగా తాగండి: ఇతర పానీయాలతో కలిపి రోజుకు సుమారు రెండు లీటర్లు లేదా అంతకంటే ఎక్కువ. నీరు సురక్షితమో కాదో సందేహం ఉంటే 10 నుండి 15 నిమిషాలు మరిగించండి.",
     "ఆహారాన్ని సురక్షితంగా ఉంచండి: ఆహారం ముట్టుకునే ముందు సబ్బుతో చేతులు కడుక్కోండి, పండ్లు కూరగాయలు బాగా కడగండి, మాంసాన్ని బాగా ఉడికించండి, పచ్చి ఆహారాన్ని వండిన ఆహారాన్ని వేరుగా ఉంచండి, వండిన ఆహారాన్ని 4 నుండి 6 గంటల లోపు తినండి లేదా బాగా వేడి చేసి తినండి.",
     "పాత నమ్మకాల వల్ల ఏ ఆహారాన్నీ మానవలసిన అవసరం లేదు. పొగ తాగడం, పొగాకు నమలడం, మద్యం తాగడం చేయకండి; డాక్టర్ సలహా లేకుండా ఏ మందూ వేసుకోకండి. అయోడిన్ ఉప్పు వాడండి."
    ]
   },
   "seekHelp": {
    "en": [],
    "hi": [],
    "ta": [],
    "te": []
   },
   "keywords": [
    "diet",
    "food",
    "what to eat",
    "khana",
    "khaana",
    "aahar",
    "nutrition",
    "iron foods",
    "calcium",
    "milk",
    "dal",
    "green leafy",
    "palak",
    "water",
    "paani",
    "safe water",
    "boil water",
    "tea",
    "chai",
    "coffee",
    "weight gain",
    "protein",
    "fruits",
    "hygiene",
    "food safety",
    "jaggery",
    "gud"
   ],
   "sources": [
    {
     "label": "Dietary Guidelines for Indians 2024 (PDF)",
     "publisher": "ICMR-National Institute of Nutrition, Indian Council of Medical Research",
     "url": "https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    }
   ]
  },
  {
   "id": "iron-folic-calcium",
   "category": "care",
   "title": {
    "en": "Iron, folic acid and calcium",
    "hi": "आयरन, फोलिक एसिड और कैल्शियम",
    "ta": "இரும்பு, ஃபோலிக் அமிலம் மற்றும் கால்சியம்",
    "te": "ఇనుము, ఫోలిక్ యాసిడ్ మరియు కాల్షియం"
   },
   "summary": {
    "en": "Iron and folic acid help your body make blood and help prevent anaemia (low blood). The government programme gives pregnant women iron-folic acid (IFA) and calcium tablets, and you should take them as advised by your doctor or ANM. This is general information, so please follow the advice of your own care team.",
    "hi": "आयरन और फोलिक एसिड शरीर में खून बनाने में मदद करते हैं और खून की कमी (एनीमिया) से बचाते हैं। सरकारी कार्यक्रम में गर्भवती महिलाओं को आयरन-फोलिक एसिड (IFA) और कैल्शियम की गोलियाँ दी जाती हैं; इन्हें अपने डॉक्टर या ANM की सलाह के अनुसार ही लें। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "இரும்பும் ஃபோலிக் அமிலமும் உடல் இரத்தம் உருவாக்க உதவுகின்றன; இரத்தசோகையை (அனீமியா) தடுக்கவும் உதவுகின்றன. அரசுத் திட்டத்தில் கர்ப்பிணிகளுக்கு இரும்பு-ஃபோலிக் அமில (IFA) மாத்திரைகளும் கால்சியம் மாத்திரைகளும் வழங்கப்படுகின்றன; அவற்றை உங்கள் மருத்துவர் அல்லது ANM கூறியபடியே எடுத்துக்கொள்ளுங்கள். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "ఇనుము మరియు ఫోలిక్ యాసిడ్ శరీరంలో రక్తం తయారవడానికి సహాయపడతాయి, రక్తహీనత (ఎనీమియా) రాకుండా కాపాడతాయి. ప్రభుత్వ కార్యక్రమంలో గర్భిణులకు ఐరన్-ఫోలిక్ యాసిడ్ (IFA) మరియు కాల్షియం మాత్రలు ఇస్తారు; వాటిని మీ డాక్టర్ లేదా ANM చెప్పినట్లే వేసుకోండి. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Anaemia means too little haemoglobin, the part of blood that carries oxygen. It can make you tired and breathless. WHO links anaemia in pregnancy with early birth and low birth weight.",
     "Your haemoglobin is checked at check-ups. Ask your ANM or doctor for your result.",
     "The government programme advises iron-folic acid tablets from about the fourth month of pregnancy, and also after the baby is born. The government site says iron-folic acid and calcium tablets are given during antenatal care.",
     "Take the tablets exactly as advised by your doctor or ANM. If your blood level is low, your care team may change the plan. Do not stop or change the tablets on your own.",
     "Tea and coffee can make it harder for the body to take iron from food. Foods with vitamin C help. Ask your ANM or doctor what time of day is best for each tablet. WHO notes that iron and calcium supplements are best taken at different times of the day.",
     "Iron tablets can cause constipation in some women. Eat fibre-rich food and drink water, and tell your doctor or ANM if it troubles you. Do not stop the tablets yourself."
    ],
    "hi": [
     "एनीमिया का मतलब है खून में हीमोग्लोबिन की कमी, जो खून का वह हिस्सा है जो ऑक्सीजन ले जाता है। इससे थकान और साँस फूलना हो सकता है। WHO के अनुसार गर्भावस्था में एनीमिया समय से पहले जन्म और कम वज़न के शिशु से जुड़ा है।",
     "हर जाँच में आपका हीमोग्लोबिन देखा जाता है। अपनी ANM या डॉक्टर से उसकी रिपोर्ट पूछें।",
     "सरकारी कार्यक्रम में गर्भावस्था के लगभग चौथे महीने से आयरन-फोलिक एसिड की गोलियों की सलाह दी जाती है, और बच्चे के जन्म के बाद भी। सरकारी वेबसाइट के अनुसार गर्भावस्था की जाँच (ANC) के दौरान आयरन-फोलिक एसिड और कैल्शियम की गोलियाँ दी जाती हैं।",
     "गोलियाँ वैसे ही लें जैसे आपके डॉक्टर या ANM ने बताया है। अगर आपके खून की मात्रा कम है तो देखभाल टीम योजना बदल सकती है। गोलियाँ खुद से बंद या बदलें नहीं।",
     "चाय और कॉफ़ी से शरीर को खाने से आयरन लेने में मुश्किल हो सकती है। विटामिन-सी वाली चीज़ें मदद करती हैं। हर गोली दिन के किस समय लेना सबसे अच्छा है, यह अपनी ANM या डॉक्टर से पूछें। WHO के अनुसार आयरन और कैल्शियम की गोलियाँ दिन के अलग-अलग समय पर लेना बेहतर है।",
     "कुछ महिलाओं को आयरन की गोलियों से कब्ज़ हो सकती है। रेशेदार चीज़ें खाएँ और पानी पिएँ, और परेशानी हो तो डॉक्टर या ANM को बताएँ। गोलियाँ खुद से बंद न करें।"
    ],
    "ta": [
     "அனீமியா என்றால் இரத்தத்தில் ஹீமோகுளோபின் குறைவாக இருப்பது; இது இரத்தத்தில் ஆக்ஸிஜனைக் கொண்டு செல்லும் பகுதி. இதனால் சோர்வும் மூச்சிரைப்பும் ஏற்படலாம். கர்ப்பத்தில் அனீமியா குறைப்பிரசவம் மற்றும் குறைந்த எடையுள்ள குழந்தையுடன் தொடர்புடையது என்று WHO கூறுகிறது.",
     "ஒவ்வொரு பரிசோதனையிலும் உங்கள் ஹீமோகுளோபின் அளவு பார்க்கப்படும். அதன் முடிவை உங்கள் ANM அல்லது மருத்துவரிடம் கேளுங்கள்.",
     "அரசுத் திட்டம் கர்ப்பத்தின் சுமார் நான்காவது மாதத்திலிருந்து இரும்பு-ஃபோலிக் அமில மாத்திரைகளைப் பரிந்துரைக்கிறது; குழந்தை பிறந்த பிறகும் தொடர வேண்டும். கர்ப்ப கால பரிசோதனையின்போது இரும்பு-ஃபோலிக் அமிலம் மற்றும் கால்சியம் மாத்திரைகள் வழங்கப்படுவதாக அரசு இணையதளம் கூறுகிறது.",
     "மாத்திரைகளை உங்கள் மருத்துவர் அல்லது ANM கூறியபடியே எடுத்துக்கொள்ளுங்கள். உங்கள் இரத்த அளவு குறைவாக இருந்தால், பராமரிப்புக் குழு திட்டத்தை மாற்றக்கூடும். மாத்திரைகளை நீங்களாகவே நிறுத்தவோ மாற்றவோ வேண்டாம்.",
     "தேநீரும் காபியும் உணவிலிருந்து உடல் இரும்புச் சத்தைப் பெறுவதைக் கடினமாக்கலாம். வைட்டமின் சி உள்ள உணவுகள் உதவும். ஒவ்வொரு மாத்திரையையும் நாளின் எந்த நேரத்தில் எடுப்பது நல்லது என்று உங்கள் ANM அல்லது மருத்துவரிடம் கேளுங்கள். இரும்பு மற்றும் கால்சியம் மாத்திரைகளை நாளின் வெவ்வேறு நேரங்களில் எடுப்பது நல்லது என்று WHO குறிப்பிடுகிறது.",
     "சில பெண்களுக்கு இரும்பு மாத்திரைகளால் மலச்சிக்கல் ஏற்படலாம். நார்ச்சத்து உள்ள உணவுகளைச் சாப்பிட்டு, தண்ணீர் குடியுங்கள்; சிரமம் இருந்தால் மருத்துவர் அல்லது ANM-இடம் சொல்லுங்கள். மாத்திரைகளை நீங்களாகவே நிறுத்தாதீர்கள்."
    ],
    "te": [
     "ఎనీమియా అంటే రక్తంలో హిమోగ్లోబిన్ తక్కువగా ఉండటం; ఇది రక్తంలో ఆక్సిజన్‌ను మోసే భాగం. దీని వల్ల అలసట, ఆయాసం రావచ్చు. గర్భధారణలో ఎనీమియా నెలలు నిండకముందే కాన్పు, తక్కువ బరువు బిడ్డ పుట్టడంతో ముడిపడి ఉందని WHO చెబుతోంది.",
     "ప్రతి పరీక్షలో మీ హిమోగ్లోబిన్ చూస్తారు. దాని ఫలితం గురించి మీ ANM లేదా డాక్టర్‌ను అడగండి.",
     "ప్రభుత్వ కార్యక్రమం గర్భం నాలుగవ నెల నుండి ఐరన్-ఫోలిక్ యాసిడ్ మాత్రలను సూచిస్తోంది; బిడ్డ పుట్టిన తర్వాత కూడా కొనసాగించాలి. గర్భిణీ పరీక్షల సమయంలో ఐరన్-ఫోలిక్ యాసిడ్ మరియు కాల్షియం మాత్రలు ఇస్తారని ప్రభుత్వ వెబ్‌సైట్ చెబుతోంది.",
     "మాత్రలను మీ డాక్టర్ లేదా ANM చెప్పినట్లే వేసుకోండి. మీ రక్తం స్థాయి తక్కువగా ఉంటే సంరక్షణ బృందం ప్రణాళికను మార్చవచ్చు. మాత్రలను మీ అంతట మీరే ఆపకండి, మార్చకండి.",
     "టీ, కాఫీ వల్ల ఆహారంలోని ఇనుమును శరీరం తీసుకోవడం కష్టమవుతుంది. విటమిన్ సి ఉన్న ఆహారాలు సహాయపడతాయి. ప్రతి మాత్రను రోజులో ఏ సమయంలో వేసుకోవడం మంచిదో మీ ANM లేదా డాక్టర్‌ను అడగండి. ఇనుము, కాల్షియం మాత్రలను రోజులో వేర్వేరు సమయాల్లో వేసుకోవడం మంచిదని WHO పేర్కొంది.",
     "కొందరు మహిళలకు ఐరన్ మాత్రల వల్ల మలబద్ధకం రావచ్చు. పీచు ఎక్కువ ఉన్న ఆహారం తిని, నీరు తాగండి; ఇబ్బందిగా ఉంటే డాక్టర్ లేదా ANMకు చెప్పండి. మాత్రలను మీ అంతట మీరే ఆపకండి."
    ]
   },
   "seekHelp": {
    "en": [
     "Feeling very tired or weak, dizzy or light-headed, or having headaches",
     "Pale skin or nails, or cold hands and feet",
     "Shortness of breath or a fast heartbeat. If you are very breathless, go to the hospital right away."
    ],
    "hi": [
     "बहुत थकान या कमज़ोरी, चक्कर आना या सिर हल्का लगना, या सिरदर्द",
     "त्वचा या नाखूनों का पीला पड़ना, या हाथ-पैर ठंडे रहना",
     "साँस फूलना या दिल की धड़कन तेज़ होना। बहुत ज़्यादा साँस फूले तो तुरंत अस्पताल जाएँ।"
    ],
    "ta": [
     "மிகுந்த சோர்வு அல்லது பலவீனம், தலைச்சுற்றல் அல்லது மயக்க உணர்வு, தலைவலி",
     "தோல் அல்லது நகங்கள் வெளிறிப்போதல், கை கால்கள் குளிர்ந்திருத்தல்",
     "மூச்சுத் திணறல் அல்லது இதயத் துடிப்பு வேகமாக இருத்தல். மிகவும் மூச்சுத் திணறினால் உடனே மருத்துவமனைக்குச் செல்லுங்கள்."
    ],
    "te": [
     "చాలా అలసట లేదా నీరసం, తల తిరగడం లేదా తేలికగా అనిపించడం, తలనొప్పి",
     "చర్మం లేదా గోళ్ళు పాలిపోవడం, చేతులు కాళ్ళు చల్లగా ఉండటం",
     "ఆయాసం లేదా గుండె వేగంగా కొట్టుకోవడం. చాలా ఆయాసంగా ఉంటే వెంటనే ఆసుపత్రికి వెళ్ళండి."
    ]
   },
   "keywords": [
    "iron",
    "ifa",
    "iron tablet",
    "folic acid",
    "calcium",
    "calcium tablet",
    "anaemia",
    "anemia",
    "khoon ki kami",
    "hemoglobin",
    "hb",
    "haemoglobin",
    "weakness",
    "kamzori",
    "iron ki goli",
    "goli",
    "tablet",
    "supplement",
    "tonic"
   ],
   "sources": [
    {
     "label": "Anaemia Mukt Bharat :: National Health Mission",
     "publisher": "National Health Mission, Ministry of Health and Family Welfare, Government of India",
     "url": "https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=1448&lid=797"
    },
    {
     "label": "What benefits would pregnant women receive (PMSMA)",
     "publisher": "Ministry of Health and Family Welfare, Government of India",
     "url": "https://pmsma.mohfw.gov.in/i-am/pregnant-woman/what-benefits-would-pregnant-women-receive/"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Anaemia (fact sheet)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://www.who.int/news-room/fact-sheets/detail/anaemia"
    },
    {
     "label": "Dietary Guidelines for Indians 2024 (PDF)",
     "publisher": "ICMR-National Institute of Nutrition, Indian Council of Medical Research",
     "url": "https://nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf"
    },
    {
     "label": "Common health problems in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/common-health-problems/"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    }
   ]
  },
  {
   "id": "vaccines",
   "category": "care",
   "title": {
    "en": "Vaccines in pregnancy",
    "hi": "गर्भावस्था में टीके",
    "ta": "கர்ப்ப காலத்தில் தடுப்பூசிகள்",
    "te": "గర్భధారణలో టీకాలు"
   },
   "summary": {
    "en": "In India, pregnant women are given the Td vaccine, which protects against tetanus and diphtheria. It protects you and your newborn baby, and the Ministry of Health says it is safe in pregnancy. This is general information, so please follow the advice of your own care team.",
    "hi": "भारत में गर्भवती महिलाओं को टीडी (Td) टीका दिया जाता है, जो टिटनेस और डिप्थीरिया से बचाता है। यह आपको और आपके नवजात शिशु को सुरक्षा देता है, और स्वास्थ्य मंत्रालय के अनुसार यह गर्भावस्था में सुरक्षित है। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "இந்தியாவில் கர்ப்பிணிகளுக்கு Td தடுப்பூசி போடப்படுகிறது; இது டெட்டனஸ் மற்றும் டிப்தீரியாவிலிருந்து பாதுகாக்கிறது. இது உங்களையும் புதிதாகப் பிறக்கும் குழந்தையையும் பாதுகாக்கிறது; கர்ப்ப காலத்தில் இது பாதுகாப்பானது என்று சுகாதார அமைச்சகம் கூறுகிறது. இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "భారతదేశంలో గర్భిణులకు Td టీకా ఇస్తారు; ఇది ధనుర్వాతం (టెటనస్), డిఫ్తీరియా నుండి కాపాడుతుంది. ఇది మీకు, పుట్టబోయే నవజాత శిశువుకు రక్షణ ఇస్తుంది; గర్భధారణలో ఇది సురక్షితమని ఆరోగ్య మంత్రిత్వ శాఖ చెబుతోంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Td (tetanus and diphtheria) vaccine protects both mother and newborn baby from tetanus, and also protects against diphtheria.",
     "The Ministry of Health recommends Td instead of the older TT (tetanus toxoid) vaccine for pregnant women. Some centres may still use up TT stock, and earlier TT doses still count.",
     "The government schedule is a first Td dose early in pregnancy and a second dose four weeks later. If you become pregnant again within 3 years of your last pregnancy and already had two Td doses, a booster dose is given. Your ANM will check your card and tell you what you need.",
     "A sore arm where the injection was given can happen.",
     "Your ANM records each dose in your MCP card. Keep the card safe and show your old vaccine records."
    ],
    "hi": [
     "टीडी (टिटनेस और डिप्थीरिया) टीका माँ और नवजात शिशु दोनों को टिटनेस से बचाता है, और डिप्थीरिया से भी सुरक्षा देता है।",
     "स्वास्थ्य मंत्रालय गर्भवती महिलाओं के लिए पुराने टीटी (टिटनेस टॉक्सॉइड) टीके की जगह टीडी की सलाह देता है। कुछ केंद्रों में अभी पुराना टीटी का स्टॉक इस्तेमाल हो सकता है, और पहले लगे टीटी के टीके गिने जाते हैं।",
     "सरकारी कार्यक्रम में गर्भावस्था की शुरुआत में पहली खुराक और चार हफ़्ते बाद दूसरी खुराक दी जाती है। अगर पिछली गर्भावस्था के 3 साल के अंदर आप फिर गर्भवती हों और टीडी की दो खुराकें पहले ले चुकी हों, तो एक बूस्टर खुराक दी जाती है। आपकी ANM आपका कार्ड देखकर बताएँगी कि आपको क्या चाहिए।",
     "टीका लगने की जगह पर बाँह में दर्द हो सकता है।",
     "आपकी ANM हर खुराक आपके MCP कार्ड में लिखती हैं। कार्ड सँभालकर रखें और पुराने टीकों का रिकॉर्ड भी दिखाएँ।"
    ],
    "ta": [
     "Td (டெட்டனஸ் மற்றும் டிப்தீரியா) தடுப்பூசி தாயையும் பிறந்த குழந்தையையும் டெட்டனஸிலிருந்து பாதுகாக்கிறது; டிப்தீரியாவிலிருந்தும் பாதுகாக்கிறது.",
     "கர்ப்பிணிகளுக்கு பழைய TT (டெட்டனஸ் டாக்ஸாய்டு) தடுப்பூசிக்குப் பதிலாக Td பரிந்துரைக்கப்படுகிறது என்று சுகாதார அமைச்சகம் கூறுகிறது. சில மையங்களில் பழைய TT இருப்பு இன்னும் பயன்படுத்தப்படலாம்; முன்பு போட்ட TT தவணைகளும் கணக்கில் சேரும்.",
     "அரசின் அட்டவணைப்படி, கர்ப்பத்தின் தொடக்கத்தில் முதல் தவணையும், நான்கு வாரங்கள் கழித்து இரண்டாவது தவணையும் போடப்படும். முந்தைய கர்ப்பத்திலிருந்து 3 ஆண்டுகளுக்குள் மீண்டும் கர்ப்பமாகி, ஏற்கெனவே இரண்டு Td தவணைகள் போட்டிருந்தால், ஒரு பூஸ்டர் தவணை போடப்படும். உங்கள் அட்டையைப் பார்த்து உங்களுக்கு என்ன தேவை என்று உங்கள் ANM சொல்வார்.",
     "ஊசி போட்ட இடத்தில் கையில் வலி இருக்கலாம்.",
     "ஒவ்வொரு தவணையையும் உங்கள் ANM உங்கள் MCP அட்டையில் பதிவு செய்வார். அட்டையைப் பத்திரமாக வைத்து, பழைய தடுப்பூசிப் பதிவுகளையும் காட்டுங்கள்."
    ],
    "te": [
     "Td (ధనుర్వాతం మరియు డిఫ్తీరియా) టీకా తల్లిని, నవజాత శిశువును ధనుర్వాతం (టెటనస్) నుండి కాపాడుతుంది; డిఫ్తీరియా నుండి కూడా రక్షణ ఇస్తుంది.",
     "గర్భిణులకు పాత TT (టెటనస్ టాక్సాయిడ్) టీకాకు బదులు Td ఇవ్వాలని ఆరోగ్య మంత్రిత్వ శాఖ సిఫార్సు చేస్తోంది. కొన్ని కేంద్రాల్లో పాత TT నిల్వను ఇంకా వాడుతూ ఉండవచ్చు; ఇంతకుముందు వేయించుకున్న TT డోసులు కూడా లెక్కలోకి వస్తాయి.",
     "ప్రభుత్వ షెడ్యూల్ ప్రకారం గర్భం మొదట్లో మొదటి డోసు, నాలుగు వారాల తర్వాత రెండవ డోసు ఇస్తారు. గత గర్భం నుండి 3 సంవత్సరాల లోపు మళ్ళీ గర్భవతి అయి, ఇప్పటికే రెండు Td డోసులు తీసుకుని ఉంటే, ఒక బూస్టర్ డోసు ఇస్తారు. మీ కార్డు చూసి మీకు ఏం కావాలో మీ ANM చెబుతారు.",
     "ఇంజెక్షన్ వేసిన చోట చేయి నొప్పిగా ఉండవచ్చు.",
     "ప్రతి డోసును మీ ANM మీ MCP కార్డులో నమోదు చేస్తారు. కార్డును జాగ్రత్తగా ఉంచండి, పాత టీకా రికార్డులు కూడా చూపించండి."
    ]
   },
   "seekHelp": {
    "en": [],
    "hi": [],
    "ta": [],
    "te": []
   },
   "keywords": [
    "vaccine",
    "vaccination",
    "tetanus",
    "td",
    "tt",
    "injection",
    "tika",
    "teeka",
    "tikka",
    "injection in pregnancy",
    "diphtheria",
    "tt injection",
    "shot",
    "immunization",
    "immunisation"
   ],
   "sources": [
    {
     "label": "Tetanus and adult diphtheria (Td) Operational Guidelines (PDF)",
     "publisher": "Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/Guildelines_for_immunization/Td_vaccine_operational_guidelines.pdf"
    },
    {
     "label": "Tetanus and adult diphtheria (Td) Frequently Asked Questions (FAQs) (PDF)",
     "publisher": "Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/Guildelines_for_immunization/Td_vaccine_FAQs.pdf"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    }
   ]
  },
  {
   "id": "staying-active",
   "category": "care",
   "title": {
    "en": "Staying active and resting well",
    "hi": "सक्रिय रहना और अच्छा आराम",
    "ta": "சுறுசுறுப்பாக இருத்தலும் நன்றாக ஓய்வெடுத்தலும்",
    "te": "చురుకుగా ఉండటం, బాగా విశ్రాంతి తీసుకోవడం"
   },
   "summary": {
    "en": "Staying active in pregnancy is good for you and your baby, and rest is important too. WHO says women without a medical reason to avoid it should be active regularly throughout pregnancy. This is general information, so please follow the advice of your own care team.",
    "hi": "गर्भावस्था में सक्रिय रहना आपके और शिशु के लिए अच्छा है, और आराम भी ज़रूरी है। WHO के अनुसार जिन महिलाओं को किसी चिकित्सीय कारण से मना नहीं किया गया है, उन्हें पूरी गर्भावस्था में नियमित रूप से सक्रिय रहना चाहिए। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கர்ப்ப காலத்தில் சுறுசுறுப்பாக இருப்பது உங்களுக்கும் குழந்தைக்கும் நல்லது; ஓய்வும் முக்கியம். மருத்துவக் காரணத்தால் தவிர்க்கச் சொல்லப்படாத பெண்கள் கர்ப்பம் முழுவதும் தொடர்ந்து சுறுசுறுப்பாக இருக்க வேண்டும் என்று WHO கூறுகிறது. இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "గర్భధారణలో చురుకుగా ఉండటం మీకు, మీ బిడ్డకు మంచిది; విశ్రాంతి కూడా ముఖ్యమే. వైద్యపరమైన కారణంతో వద్దని చెప్పని మహిళలు గర్భం అంతా క్రమం తప్పకుండా చురుకుగా ఉండాలని WHO చెబుతోంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "WHO advises about 150 minutes (two and a half hours) of moderate activity a week, spread through the week, for pregnant women who have no medical reason to avoid it. Walking is one example.",
     "If you were not active before, start with small amounts and slowly do more. Some activity is better than none.",
     "Drink water before, during and after activity. Avoid activity in very hot, humid weather, activities where you could fall or be hit, and, after the first three months, exercises lying flat on your back.",
     "Household work and walking count as activity. Avoid lifting heavy weights and do not overwork; ask others to share tasks.",
     "Rest well: the government booklet advises about 8 hours of sleep at night and at least 2 hours of rest in the day. It is safest to go to sleep on your side. After 28 weeks, going to sleep on your back is linked to a higher risk of stillbirth, so if you wake on your back, turn onto your side.",
     "Ask your care team if there is any reason for you to limit activity, and which signs mean you should stop and call them."
    ],
    "hi": [
     "WHO सलाह देता है कि जिन गर्भवती महिलाओं को किसी चिकित्सीय कारण से मना नहीं किया गया है, वे हफ़्ते भर में फैलाकर लगभग 150 मिनट (ढाई घंटे) की मध्यम गतिविधि करें, जैसे चलना।",
     "अगर आप पहले सक्रिय नहीं थीं, तो थोड़े से शुरू करें और धीरे-धीरे बढ़ाएँ। कुछ न करने से कुछ करना बेहतर है।",
     "गतिविधि से पहले, उसके दौरान और बाद में पानी पिएँ। बहुत गरम और उमस वाले मौसम में, गिरने या चोट लगने का खतरा हो ऐसी गतिविधियों से, और पहले तीन महीने के बाद पीठ के बल सीधा लेटकर की जाने वाली कसरतों से बचें।",
     "घर के काम और चलना भी गतिविधि में गिने जाते हैं। भारी वज़न उठाने से बचें, ज़्यादा थकें नहीं और कुछ काम दूसरों को बाँट दें।",
     "अच्छा आराम करें: सरकारी पुस्तिका रात में लगभग 8 घंटे की नींद और दिन में कम से कम 2 घंटे आराम की सलाह देती है। करवट लेकर सोना सबसे सुरक्षित है। 28 हफ़्ते के बाद पीठ के बल सोने को मृत शिशु जन्म (स्टिलबर्थ) के ज़्यादा जोखिम से जोड़ा गया है, इसलिए अगर आपकी आँख पीठ के बल खुले तो करवट बदल लें।",
     "अपनी देखभाल टीम से पूछें कि क्या आपको गतिविधि सीमित रखनी चाहिए, और कौन से संकेत दिखें तो रुककर उन्हें बताना है।"
    ],
    "ta": [
     "மருத்துவக் காரணத்தால் தவிர்க்கச் சொல்லப்படாத கர்ப்பிணிகள் வாரத்தில் சுமார் 150 நிமிடம் (இரண்டரை மணி நேரம்), வாரம் முழுவதும் பிரித்து, மிதமான உடல் இயக்கத்தில் ஈடுபட WHO பரிந்துரைக்கிறது; எடுத்துக்காட்டாக நடைப்பயிற்சி.",
     "முன்பு சுறுசுறுப்பாக இல்லாதிருந்தால், சிறிய அளவில் தொடங்கி மெதுவாக அதிகரியுங்கள். எதுவும் செய்யாமல் இருப்பதைவிட ஓரளவு செய்வது நல்லது.",
     "உடல் இயக்கத்துக்கு முன்பும், போதும், பின்பும் தண்ணீர் குடியுங்கள். மிகுந்த வெப்பம், ஈரப்பதம் உள்ள வானிலையில், விழவோ அடிபடவோ வாய்ப்புள்ள செயல்களை, மேலும் முதல் மூன்று மாதங்களுக்குப் பிறகு முதுகு தரையில் படுத்துச் செய்யும் பயிற்சிகளைத் தவிர்க்கவும்.",
     "வீட்டு வேலையும் நடையும் உடல் இயக்கமாகவே கணக்கில் வரும். அதிக எடை தூக்குவதைத் தவிர்க்கவும்; அதிகமாக உழைக்க வேண்டாம்; சில வேலைகளை மற்றவர்களிடம் கொடுங்கள்.",
     "நன்றாக ஓய்வெடுங்கள்: இரவில் சுமார் 8 மணி நேரத் தூக்கமும், பகலில் குறைந்தது 2 மணி நேர ஓய்வும் வேண்டும் என்று அரசுக் கையேடு கூறுகிறது. பக்கவாட்டில் படுத்துத் தூங்குவது மிகவும் பாதுகாப்பானது. 28 வாரங்களுக்குப் பிறகு மல்லாந்து படுத்துத் தூங்குவது கருவிலேயே குழந்தை இறக்கும் (ஸ்டில்பர்த்) ஆபத்து அதிகரிப்பதுடன் தொடர்புடையது; எனவே மல்லாந்து படுத்திருப்பதை உணர்ந்தால் பக்கவாட்டில் திரும்பிக்கொள்ளுங்கள்.",
     "உங்கள் உடல் இயக்கத்தைக் குறைக்க வேண்டிய காரணம் ஏதேனும் உள்ளதா, எந்த அறிகுறிகள் வந்தால் நிறுத்திவிட்டு அவர்களை அழைக்க வேண்டும் என்று உங்கள் பராமரிப்புக் குழுவிடம் கேளுங்கள்."
    ],
    "te": [
     "వైద్యపరమైన కారణంతో వద్దని చెప్పని గర్భిణులు వారానికి సుమారు 150 నిమిషాలు (రెండున్నర గంటలు), వారం మొత్తం పంచుకుంటూ, మధ్యస్థ స్థాయి శారీరక కదలికలు చేయాలని WHO సూచిస్తోంది; ఉదాహరణకు నడక.",
     "ఇంతకుముందు చురుకుగా లేకపోతే, కొంచెంగా మొదలుపెట్టి నెమ్మదిగా పెంచండి. ఏమీ చేయకపోవడం కంటే కొంత చేయడం మంచిది.",
     "శారీరక కదలికకు ముందు, సమయంలో, తర్వాత నీరు తాగండి. చాలా వేడిగా, ఉక్కగా ఉండే వాతావరణంలో, పడిపోవడానికి లేదా దెబ్బ తగలడానికి అవకాశం ఉన్న పనులకు, మొదటి మూడు నెలల తర్వాత వెల్లకిలా పడుకుని చేసే వ్యాయామాలకు దూరంగా ఉండండి.",
     "ఇంటి పనులు, నడక కూడా శారీరక కదలికగానే లెక్కిస్తారు. బరువులు ఎత్తకండి, అతిగా శ్రమపడకండి, కొన్ని పనులు ఇతరులకు అప్పగించండి.",
     "బాగా విశ్రాంతి తీసుకోండి: రాత్రి సుమారు 8 గంటల నిద్ర, పగలు కనీసం 2 గంటల విశ్రాంతి అవసరమని ప్రభుత్వ పుస్తకం చెబుతోంది. పక్కకు తిరిగి పడుకుని నిద్రపోవడం అత్యంత సురక్షితం. 28 వారాల తర్వాత వెల్లకిలా పడుకుని నిద్రపోవడం గర్భంలోనే బిడ్డ మరణించే (స్టిల్‌బర్త్) ప్రమాదం పెరగడంతో ముడిపడి ఉంది; కాబట్టి వెల్లకిలా ఉన్నట్లు గమనిస్తే పక్కకు తిరగండి.",
     "మీరు శారీరక కదలికలను తగ్గించుకోవాల్సిన కారణం ఏదైనా ఉందేమో, ఏ సూచనలు కనిపిస్తే ఆపేసి వారికి చెప్పాలో మీ సంరక్షణ బృందాన్ని అడగండి."
    ]
   },
   "seekHelp": {
    "en": [],
    "hi": [],
    "ta": [],
    "te": []
   },
   "keywords": [
    "exercise",
    "walking",
    "walk",
    "yoga",
    "rest",
    "sleep",
    "sleeping position",
    "left side",
    "side",
    "back sleeping",
    "heavy work",
    "lifting",
    "kasrat",
    "vyayam",
    "aaram",
    "neend",
    "thakan",
    "active",
    "gym",
    "work",
    "household work",
    "stillbirth"
   ],
   "sources": [
    {
     "label": "WHO guidelines on physical activity and sedentary behaviour (PDF)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://iris.who.int/server/api/core/bitstreams/faa83413-d89e-4be9-bb01-b24671aef7ca/content"
    },
    {
     "label": "Physical activity (fact sheet)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://www.who.int/news-room/fact-sheets/detail/physical-activity"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Tiredness and sleep problems in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/tiredness/"
    }
   ]
  },
  {
   "id": "common-discomforts",
   "category": "body",
   "title": {
    "en": "Common discomforts in pregnancy",
    "hi": "गर्भावस्था की आम तकलीफ़ें",
    "ta": "கர்ப்ப காலத்தின் பொதுவான சிரமங்கள்",
    "te": "గర్భధారణలో సాధారణ ఇబ్బందులు"
   },
   "summary": {
    "en": "Many changes in pregnancy are common and not harmful, such as feeling sick, back pain, heartburn, constipation, leg cramps and tiredness. Simple self-care often helps, but tell your care team if you are worried or if a problem does not get better. This is general information, so please follow the advice of your own care team.",
    "hi": "गर्भावस्था में कई बदलाव आम होते हैं और नुकसानदेह नहीं होते, जैसे जी मिचलाना, कमर दर्द, सीने में जलन, कब्ज़, पैरों में ऐंठन और थकान। अक्सर आसान घरेलू देखभाल से राहत मिलती है, लेकिन चिंता हो या तकलीफ़ ठीक न हो तो अपनी देखभाल टीम को बताएँ। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "குமட்டல், முதுகுவலி, நெஞ்செரிச்சல், மலச்சிக்கல், கால் பிடிப்பு, சோர்வு போன்ற பல மாற்றங்கள் கர்ப்ப காலத்தில் சாதாரணமானவை; தீங்கு இல்லாதவை. எளிய சுயபராமரிப்பு பெரும்பாலும் உதவும்; ஆனால் கவலையாக இருந்தாலோ பிரச்சினை சரியாகாவிட்டாலோ உங்கள் பராமரிப்புக் குழுவிடம் சொல்லுங்கள். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "వికారం, నడుము నొప్పి, ఛాతీలో మంట, మలబద్ధకం, కాళ్ళ తిమ్మిర్లు, అలసట వంటి చాలా మార్పులు గర్భధారణలో సాధారణమే, హాని చేయవు. సులభమైన స్వీయ సంరక్షణ తరచూ సహాయపడుతుంది, కానీ మీకు ఆందోళన కలిగినా, సమస్య తగ్గకపోయినా మీ సంరక్షణ బృందానికి చెప్పండి. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Feeling sick (nausea) and vomiting are common in early pregnancy and usually ease by about weeks 16 to 20. Eat small, plain meals often, sip fluids little and often, rest, and stay away from smells that make you feel sick.",
     "Back pain is common because the joints and ligaments soften. Bend your knees when lifting, avoid heavy lifting, wear flat shoes, sit with your back supported, and rest. Gentle exercise may help.",
     "Heartburn: eat small meals, do not eat within 3 hours of bedtime, sit upright when eating, and use extra pillows to raise your head and shoulders in bed. Cut down on caffeine and on rich, spicy or fatty food.",
     "Constipation: eat fibre (whole grains, fruit, vegetables, pulses), drink plenty of water and stay active. Iron tablets can cause constipation, so tell your doctor or ANM, and do not stop them yourself.",
     "Leg cramps often come at night. Gentle ankle and leg movements may help prevent them. During a cramp, pull your toes up towards your ankle or rub the muscle.",
     "Tiredness is common, especially in the first three months. Rest, accept help, eat well and stay a little active; avoid tea or coffee in the evening. Slow swelling of the feet and ankles is common too; rest with your feet raised."
    ],
    "hi": [
     "शुरुआती गर्भावस्था में जी मिचलाना और उल्टी आम है और आमतौर पर लगभग 16 से 20 हफ़्ते तक कम हो जाती है। थोड़ा-थोड़ा सादा खाना बार-बार खाएँ, थोड़ा-थोड़ा पानी या तरल घूँट-घूँट करके पिएँ, आराम करें, और जिन गंधों से मितली हो उनसे दूर रहें।",
     "जोड़ और स्नायु (लिगामेंट) नरम पड़ने से कमर दर्द आम है। कुछ उठाते समय घुटने मोड़ें, भारी चीज़ें न उठाएँ, चप्पल या जूते समतल पहनें, पीठ को सहारा देकर बैठें और आराम करें। हल्की कसरत से राहत मिल सकती है।",
     "सीने में जलन: थोड़ा-थोड़ा करके कई बार खाएँ, सोने से 3 घंटे पहले तक कुछ न खाएँ, खाते समय सीधे बैठें, और बिस्तर पर सिर व कंधों को तकिए से ऊँचा रखें। कैफ़ीन और भारी, मसालेदार या चिकनाई वाला खाना कम करें।",
     "कब्ज़: रेशेदार चीज़ें (साबुत अनाज, फल, सब्ज़ियाँ, दालें) खाएँ, खूब पानी पिएँ और सक्रिय रहें। आयरन की गोलियों से कब्ज़ हो सकती है, इसलिए डॉक्टर या ANM को बताएँ, और गोलियाँ खुद बंद न करें।",
     "पैरों में ऐंठन अक्सर रात में होती है। टखने और पैरों की हल्की हरकतें इससे बचाने में मदद कर सकती हैं। ऐंठन के समय पैर की उँगलियों को टखने की ओर खींचें या मांसपेशी को सहलाएँ।",
     "थकान आम है, खासकर पहले तीन महीनों में। आराम करें, मदद लें, अच्छा खाएँ और थोड़ा सक्रिय रहें; शाम को चाय या कॉफ़ी से बचें। पैरों और टखनों में धीरे-धीरे सूजन आना भी आम है; पैर ऊपर करके आराम करें।"
    ],
    "ta": [
     "ஆரம்ப கர்ப்பத்தில் குமட்டலும் வாந்தியும் சாதாரணம்; பொதுவாக 16 முதல் 20 வாரங்களுக்குள் குறைந்துவிடும். சிறிது சிறிதாக சாதாரண உணவை அடிக்கடி சாப்பிடுங்கள், திரவங்களை அடிக்கடி சிறிது சிறிதாகக் குடியுங்கள், ஓய்வெடுங்கள், குமட்டல் வரவைக்கும் வாசனைகளைத் தவிர்க்கவும்.",
     "மூட்டுகளும் தசைநார்களும் தளர்வதால் முதுகுவலி சாதாரணம். பொருளைத் தூக்கும்போது முழங்காலை மடக்குங்கள், கனமானவற்றைத் தூக்காதீர்கள், தட்டையான காலணிகள் அணியுங்கள், முதுகுக்கு ஆதரவுடன் உட்காருங்கள், ஓய்வெடுங்கள். மென்மையான உடற்பயிற்சி உதவலாம்.",
     "நெஞ்செரிச்சல்: சிறிய அளவில் அடிக்கடி சாப்பிடுங்கள், படுக்கைக்குச் செல்வதற்கு 3 மணி நேரம் முன்பிருந்து சாப்பிடாதீர்கள், சாப்பிடும்போது நிமிர்ந்து உட்காருங்கள், படுக்கையில் தலையையும் தோள்களையும் தலையணைகளால் உயர்த்தி வையுங்கள். காஃபின், கனமான, காரமான அல்லது எண்ணெய் மிகுந்த உணவைக் குறையுங்கள்.",
     "மலச்சிக்கல்: நார்ச்சத்து உணவுகளை (முழு தானியங்கள், பழங்கள், காய்கறிகள், பருப்புகள்) சாப்பிடுங்கள், நிறையத் தண்ணீர் குடியுங்கள், சுறுசுறுப்பாக இருங்கள். இரும்பு மாத்திரைகளால் மலச்சிக்கல் வரலாம்; எனவே மருத்துவர் அல்லது ANM-இடம் சொல்லுங்கள்; மாத்திரைகளை நீங்களாக நிறுத்தாதீர்கள்.",
     "கால் பிடிப்பு பெரும்பாலும் இரவில் வரும். கணுக்கால் மற்றும் கால்களை மெதுவாக அசைப்பது அதைத் தடுக்க உதவலாம். பிடிப்பு வரும்போது கால் விரல்களை கணுக்காலை நோக்கி இழுங்கள் அல்லது தசையைத் தேய்த்துவிடுங்கள்.",
     "சோர்வு சாதாரணம், குறிப்பாக முதல் மூன்று மாதங்களில். ஓய்வெடுங்கள், உதவியை ஏற்றுக்கொள்ளுங்கள், நன்றாகச் சாப்பிடுங்கள், சிறிது சுறுசுறுப்பாக இருங்கள்; மாலையில் தேநீர் அல்லது காபியைத் தவிர்க்கவும். பாதங்களிலும் கணுக்கால்களிலும் மெதுவாக வீக்கம் வருவதும் சாதாரணம்; கால்களை உயர்த்தி வைத்து ஓய்வெடுங்கள்."
    ],
    "te": [
     "గర్భం తొలినాళ్ళలో వికారం, వాంతులు సాధారణం; సాధారణంగా 16 నుండి 20 వారాల లోపు తగ్గిపోతాయి. తక్కువ తక్కువగా సాదా భోజనం తరచుగా తినండి, ద్రవాలను కొద్దికొద్దిగా తరచుగా తాగండి, విశ్రాంతి తీసుకోండి, వికారం కలిగించే వాసనలకు దూరంగా ఉండండి.",
     "కీళ్ళు, స్నాయువులు మెత్తబడటం వల్ల నడుము నొప్పి సాధారణం. ఏదైనా ఎత్తేటప్పుడు మోకాళ్ళు వంచండి, బరువులు ఎత్తకండి, చదునైన చెప్పులు వేసుకోండి, వెన్నుకు ఆధారం ఇచ్చి కూర్చోండి, విశ్రాంతి తీసుకోండి. తేలికపాటి వ్యాయామం సహాయపడవచ్చు.",
     "ఛాతీలో మంట: కొద్దికొద్దిగా తరచుగా తినండి, పడుకోవడానికి 3 గంటల ముందు నుండి ఏమీ తినకండి, తినేటప్పుడు నిటారుగా కూర్చోండి, పడకపై తల, భుజాలను దిండ్లతో ఎత్తుగా ఉంచండి. కెఫీన్, బాగా నూనె, కారం ఉన్న ఆహారం తగ్గించండి.",
     "మలబద్ధకం: పీచు ఉన్న ఆహారం (పూర్తి ధాన్యాలు, పండ్లు, కూరగాయలు, పప్పులు) తినండి, బాగా నీరు తాగండి, చురుకుగా ఉండండి. ఐరన్ మాత్రల వల్ల మలబద్ధకం రావచ్చు; డాక్టర్ లేదా ANMకు చెప్పండి, మాత్రలను మీ అంతట మీరే ఆపకండి.",
     "కాళ్ళ తిమ్మిర్లు (పిక్కలు పట్టేయడం) తరచూ రాత్రి వస్తాయి. చీలమండ, కాళ్ళను మెల్లగా కదిలించడం వాటిని రాకుండా చేయడంలో సహాయపడవచ్చు. తిమ్మిరి వచ్చినప్పుడు కాలి వేళ్ళను చీలమండ వైపు లాగండి లేదా కండరాన్ని రుద్దండి.",
     "అలసట సాధారణం, ముఖ్యంగా మొదటి మూడు నెలల్లో. విశ్రాంతి తీసుకోండి, సహాయం స్వీకరించండి, బాగా తినండి, కొంచెం చురుకుగా ఉండండి; సాయంత్రం టీ లేదా కాఫీ మానండి. పాదాలు, చీలమండలు నెమ్మదిగా వాయడం కూడా సాధారణమే; కాళ్ళను ఎత్తుగా పెట్టి విశ్రాంతి తీసుకోండి."
    ]
   },
   "seekHelp": {
    "en": [
     "Vomiting so much that you cannot keep food or drink down for 24 hours, or you pass very dark urine or no urine for more than 8 hours",
     "Vomiting together with fever, belly pain, vomiting blood, or feeling very weak, dizzy or faint",
     "Back pain with fever, bleeding, pain when passing urine, or pain under the ribs",
     "Back pain with loss of feeling in your legs, bottom or genital area: go to hospital immediately",
     "Back pain in the second or third trimester, because it can be a sign of early labour",
     "Burning pain or blood when you pass urine: contact your care team within 24 hours",
     "Sudden swelling of the face, hands or feet, or a very bad headache or blurred vision",
     "Feeling faint again and again"
    ],
    "hi": [
     "उल्टी इतनी कि 24 घंटे तक खाना-पानी रुक न पाए, या पेशाब बहुत गहरे रंग का हो या 8 घंटे से ज़्यादा पेशाब न आए",
     "उल्टी के साथ बुखार, पेट दर्द, खून की उल्टी, या बहुत कमज़ोरी, चक्कर या बेहोशी जैसा लगना",
     "कमर दर्द के साथ बुखार, खून आना, पेशाब में दर्द, या पसलियों के नीचे दर्द",
     "कमर दर्द के साथ पैरों, नितंब या जननांग क्षेत्र में संवेदना (महसूस होना) खत्म हो जाना: तुरंत अस्पताल जाएँ",
     "दूसरी या तीसरी तिमाही में कमर दर्द, क्योंकि यह जल्दी प्रसव शुरू होने का संकेत हो सकता है",
     "पेशाब करते समय जलन या पेशाब में खून: 24 घंटे के अंदर अपनी देखभाल टीम से संपर्क करें",
     "चेहरे, हाथों या पैरों में अचानक सूजन, या बहुत तेज़ सिरदर्द या धुंधला दिखना",
     "बार-बार चक्कर या बेहोशी जैसा लगना"
    ],
    "ta": [
     "24 மணி நேரம் உணவோ நீரோ வயிற்றில் தங்காத அளவுக்கு வாந்தி, அல்லது மிகவும் அடர் நிற சிறுநீர், அல்லது 8 மணி நேரத்துக்கு மேல் சிறுநீர் வராமை",
     "வாந்தியுடன் காய்ச்சல், வயிற்று வலி, இரத்த வாந்தி, அல்லது மிகுந்த பலவீனம், தலைச்சுற்றல், மயக்கம்",
     "முதுகுவலியுடன் காய்ச்சல், இரத்தப்போக்கு, சிறுநீர் கழிக்கும்போது வலி, அல்லது விலா எலும்புகளுக்குக் கீழே வலி",
     "முதுகுவலியுடன் கால்கள், பிட்டம் அல்லது பிறப்புறுப்புப் பகுதியில் உணர்வு இல்லாமல் போதல்: உடனே மருத்துவமனைக்குச் செல்லுங்கள்",
     "இரண்டாவது அல்லது மூன்றாவது மூன்று மாதக் காலத்தில் முதுகுவலி, ஏனெனில் அது பிரசவம் முன்கூட்டியே தொடங்குவதன் அறிகுறியாக இருக்கலாம்",
     "சிறுநீர் கழிக்கும்போது எரிச்சல் அல்லது சிறுநீரில் இரத்தம்: 24 மணி நேரத்துக்குள் உங்கள் பராமரிப்புக் குழுவைத் தொடர்பு கொள்ளுங்கள்",
     "முகம், கைகள் அல்லது பாதங்களில் திடீர் வீக்கம், அல்லது மிகக் கடுமையான தலைவலி அல்லது பார்வை மங்குதல்",
     "அடிக்கடி மயக்கம் வருவது போல உணர்தல்"
    ],
    "te": [
     "24 గంటలు ఆహారం, నీరు కడుపులో నిలవనంత వాంతులు, లేదా చాలా ముదురు రంగు మూత్రం, లేదా 8 గంటల కంటే ఎక్కువసేపు మూత్రం రాకపోవడం",
     "వాంతులతో పాటు జ్వరం, కడుపు నొప్పి, రక్తం వాంతి, లేదా చాలా నీరసం, తల తిరగడం, స్పృహ తప్పేలా అనిపించడం",
     "నడుము నొప్పితో పాటు జ్వరం, రక్తస్రావం, మూత్రం పోసేటప్పుడు నొప్పి, లేదా పక్కటెముకల కింద నొప్పి",
     "నడుము నొప్పితో పాటు కాళ్ళు, పిరుదులు లేదా జననేంద్రియ ప్రాంతంలో స్పర్శ తెలియకపోవడం: వెంటనే ఆసుపత్రికి వెళ్ళండి",
     "రెండవ లేదా మూడవ త్రైమాసికంలో నడుము నొప్పి, ఎందుకంటే అది ముందస్తు ప్రసవానికి సూచన కావచ్చు",
     "మూత్రం పోసేటప్పుడు మంట లేదా మూత్రంలో రక్తం: 24 గంటల లోపు మీ సంరక్షణ బృందాన్ని సంప్రదించండి",
     "ముఖం, చేతులు లేదా పాదాలు అకస్మాత్తుగా వాయడం, లేదా చాలా తీవ్రమైన తలనొప్పి లేదా చూపు మసకబారడం",
     "మాటిమాటికీ స్పృహ తప్పేలా అనిపించడం"
    ]
   },
   "keywords": [
    "nausea",
    "vomiting",
    "ulti",
    "jee michlana",
    "morning sickness",
    "back pain",
    "kamar dard",
    "heartburn",
    "acidity",
    "seene mein jalan",
    "gas",
    "constipation",
    "kabz",
    "leg cramp",
    "cramps",
    "pair dard",
    "thakan",
    "tiredness",
    "weakness",
    "swelling",
    "sujan",
    "piles",
    "bawasir",
    "headache",
    "sar dard",
    "burning urine",
    "normal in pregnancy"
   ],
   "sources": [
    {
     "label": "Vomiting and morning sickness - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/vomiting-and-morning-sickness/"
    },
    {
     "label": "Back pain in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/back-pain/"
    },
    {
     "label": "Indigestion and heartburn in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/indigestion-and-heartburn/"
    },
    {
     "label": "Common health problems in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/common-health-problems/"
    },
    {
     "label": "Tiredness and sleep problems in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/tiredness/"
    },
    {
     "label": "Swollen ankles, feet and fingers in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/common-symptoms/swollen-ankles-feet-and-fingers/"
    }
   ]
  },
  {
   "id": "baby-movements",
   "category": "baby",
   "title": {
    "en": "Your baby's movements",
    "hi": "आपके शिशु की हलचल",
    "ta": "உங்கள் குழந்தையின் அசைவுகள்",
    "te": "మీ బిడ్డ కదలికలు"
   },
   "summary": {
    "en": "Most women first feel their baby move between about 16 and 24 weeks. Learn your baby's usual pattern, and if movements slow down, stop or change, contact your maternity team or go to the hospital straight away, the same day. This is general information, so please follow the advice of your own care team.",
    "hi": "ज़्यादातर महिलाएँ लगभग 16 से 24 हफ़्ते के बीच पहली बार शिशु की हलचल महसूस करती हैं। अपने शिशु की सामान्य हलचल को पहचानें, और अगर हलचल कम हो, रुक जाए या बदल जाए तो उसी दिन अपनी मातृत्व टीम से संपर्क करें या तुरंत अस्पताल जाएँ। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "பெரும்பாலான பெண்கள் சுமார் 16 முதல் 24 வாரங்களுக்குள் குழந்தையின் அசைவை முதன்முதலில் உணர்கிறார்கள். உங்கள் குழந்தையின் வழக்கமான அசைவு முறையை அறிந்துகொள்ளுங்கள்; அசைவு குறைந்தால், நின்றால் அல்லது மாறினால் அதே நாளில் உடனே உங்கள் மகப்பேறு குழுவைத் தொடர்பு கொள்ளுங்கள் அல்லது மருத்துவமனைக்குச் செல்லுங்கள். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "చాలామంది మహిళలు సుమారు 16 నుండి 24 వారాల మధ్య బిడ్డ కదలికను మొదటిసారి అనుభవిస్తారు. మీ బిడ్డ మామూలు కదలికల తీరును తెలుసుకోండి; కదలికలు తగ్గినా, ఆగినా లేదా మారినా అదే రోజు వెంటనే మీ ప్రసూతి బృందాన్ని సంప్రదించండి లేదా ఆసుపత్రికి వెళ్ళండి. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "At first you may feel a gentle swirling or fluttering. Later you may feel kicks and jerky movements. First-time mothers may not feel movement until after 20 weeks.",
     "There is no set number of movements that is normal, and every baby is different. What matters is knowing your baby's usual pattern from day to day.",
     "If your baby moves less than usual, you cannot feel any movement, or the pattern changes, contact your maternity team or go to the hospital straight away, even in the middle of the night. Do not wait until the next day.",
     "Do not use a home heartbeat device to check your baby. It is not reliable, and hearing a heartbeat does not mean the baby is well.",
     "Less movement can be a sign that the baby is not well. Finding a problem early means care can start sooner. The government MCP card also lists reduced baby movement as a danger sign."
    ],
    "hi": [
     "शुरू में आपको हल्की फड़फड़ाहट या घुमाव जैसा महसूस हो सकता है। बाद में लातें और झटके जैसी हरकतें महसूस हो सकती हैं। पहली बार माँ बनने वाली महिलाओं को 20 हफ़्ते के बाद ही हलचल महसूस हो सकती है।",
     "हलचल की कोई तय संख्या ‘सामान्य’ नहीं होती, और हर शिशु अलग होता है। ज़रूरी यह है कि आप रोज़-रोज़ अपने शिशु की सामान्य हलचल का तरीका पहचानें।",
     "अगर शिशु सामान्य से कम हिल रहा है, आपको कोई हलचल महसूस नहीं हो रही, या हलचल का तरीका बदल गया है, तो आधी रात में भी तुरंत अपनी मातृत्व टीम से संपर्क करें या अस्पताल जाएँ। अगले दिन तक इंतज़ार न करें।",
     "शिशु की धड़कन जाँचने के लिए घर पर इस्तेमाल होने वाले उपकरण का प्रयोग न करें। वह भरोसेमंद नहीं होता, और धड़कन सुनाई देने का मतलब यह नहीं कि शिशु ठीक है।",
     "हलचल कम होना इस बात का संकेत हो सकता है कि शिशु ठीक नहीं है। समस्या जल्दी पता चले तो इलाज जल्दी शुरू हो सकता है। सरकारी MCP कार्ड में भी शिशु की हलचल कम होना खतरे का संकेत बताया गया है।"
    ],
    "ta": [
     "தொடக்கத்தில் மென்மையான சுழல்வது அல்லது படபடப்பது போல் உணரலாம். பின்னர் உதைகளையும் திடீர் அசைவுகளையும் உணரலாம். முதல் குழந்தை என்றால் 20 வாரங்களுக்குப் பிறகுதான் அசைவை உணர முடியலாம்.",
     "‘இயல்பான’ அசைவுகளுக்கு நிர்ணயிக்கப்பட்ட எண்ணிக்கை எதுவும் இல்லை; ஒவ்வொரு குழந்தையும் வேறுபட்டது. நாளுக்கு நாள் உங்கள் குழந்தையின் வழக்கமான அசைவு முறையை அறிந்திருப்பதே முக்கியம்.",
     "குழந்தை வழக்கத்தைவிடக் குறைவாக அசைந்தாலோ, எந்த அசைவையும் உணர முடியாவிட்டாலோ, அசைவு முறை மாறினாலோ, நள்ளிரவாக இருந்தாலும் உடனே உங்கள் மகப்பேறு குழுவைத் தொடர்பு கொள்ளுங்கள் அல்லது மருத்துவமனைக்குச் செல்லுங்கள். மறுநாள் வரை காத்திருக்காதீர்கள்.",
     "குழந்தையின் இதயத் துடிப்பைச் சோதிக்க வீட்டில் பயன்படுத்தும் கருவியை நம்பாதீர்கள். அது நம்பகமானது அல்ல; இதயத் துடிப்பு கேட்டாலும் குழந்தை நலமாக இருக்கிறது என்று அர்த்தமல்ல.",
     "அசைவு குறைவது குழந்தை நலமாக இல்லை என்பதன் அறிகுறியாக இருக்கலாம். பிரச்சினையை முன்கூட்டியே கண்டறிந்தால் சிகிச்சையை விரைவில் தொடங்க முடியும். அரசின் MCP அட்டையிலும் குழந்தையின் அசைவு குறைவது ஆபத்து அறிகுறியாகக் குறிப்பிடப்பட்டுள்ளது."
    ],
    "te": [
     "మొదట్లో తేలికపాటి గిలిగింతలా, రెపరెపలాడినట్లు అనిపించవచ్చు. తర్వాత తన్నులు, కుదుపులు అనిపించవచ్చు. మొదటి కాన్పు అయితే 20 వారాల తర్వాతే కదలిక తెలియవచ్చు.",
     "‘సాధారణం’ అనదగిన కదలికల సంఖ్య అంటూ ఏదీ లేదు; ప్రతి బిడ్డ వేరు. రోజు రోజుకు మీ బిడ్డ మామూలు కదలికల తీరు మీకు తెలిసి ఉండటమే ముఖ్యం.",
     "బిడ్డ మామూలు కంటే తక్కువగా కదిలినా, అసలు కదలిక తెలియకపోయినా, లేదా కదలికల తీరు మారినా, అర్ధరాత్రి అయినా సరే వెంటనే మీ ప్రసూతి బృందాన్ని సంప్రదించండి లేదా ఆసుపత్రికి వెళ్ళండి. మరుసటి రోజు వరకు ఆగకండి.",
     "బిడ్డ గుండె చప్పుడు చూడటానికి ఇంట్లో వాడే పరికరాన్ని వాడకండి. అది నమ్మదగినది కాదు; గుండె చప్పుడు వినిపించినంత మాత్రాన బిడ్డ బాగున్నట్లు కాదు.",
     "కదలికలు తగ్గడం బిడ్డ బాగాలేదనడానికి సూచన కావచ్చు. సమస్యను ముందే గుర్తిస్తే చికిత్స త్వరగా మొదలవుతుంది. ప్రభుత్వ MCP కార్డులో కూడా బిడ్డ కదలికలు తగ్గడం ప్రమాద సూచనగా ఉంది."
    ]
   },
   "seekHelp": {
    "en": [
     "Your baby is moving less than usual",
     "You cannot feel your baby move any more",
     "The pattern of your baby's movements changes",
     "You have not felt any movement by 24 weeks"
    ],
    "hi": [
     "आपका शिशु सामान्य से कम हिल रहा है",
     "आपको शिशु की हलचल महसूस होनी बंद हो गई है",
     "शिशु की हलचल का तरीका बदल गया है",
     "24 हफ़्ते तक आपने कोई हलचल महसूस नहीं की"
    ],
    "ta": [
     "குழந்தை வழக்கத்தைவிடக் குறைவாக அசைகிறது",
     "குழந்தையின் அசைவை உங்களால் இனி உணர முடியவில்லை",
     "குழந்தையின் அசைவு முறை மாறிவிட்டது",
     "24 வாரங்களுக்குள் எந்த அசைவையும் நீங்கள் உணரவில்லை"
    ],
    "te": [
     "బిడ్డ మామూలు కంటే తక్కువగా కదులుతోంది",
     "బిడ్డ కదలిక మీకు ఇక తెలియడం లేదు",
     "బిడ్డ కదలికల తీరు మారింది",
     "24 వారాల వరకు మీకు ఏ కదలికా తెలియలేదు"
    ]
   },
   "keywords": [
    "baby movement",
    "baby moving",
    "kick",
    "kicks",
    "kick count",
    "fetal movement",
    "foetal movement",
    "hilna",
    "halchal",
    "baby not moving",
    "less movement",
    "baby kicking",
    "movement reduced",
    "stopped moving",
    "lat maarna"
   ],
   "sources": [
    {
     "label": "Your baby's movements - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/keeping-well/your-babys-movements/"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    }
   ]
  },
  {
   "id": "high-blood-pressure",
   "category": "body",
   "title": {
    "en": "High blood pressure and pre-eclampsia",
    "hi": "उच्च रक्तचाप (BP) और प्री-एक्लेम्पसिया",
    "ta": "உயர் இரத்த அழுத்தம் மற்றும் ப்ரீ-எக்லாம்ப்சியா",
    "te": "అధిక రక్తపోటు మరియు ప్రీ-ఎక్లాంప్సియా"
   },
   "summary": {
    "en": "High blood pressure (BP) in pregnancy can be dangerous for you and your baby, so your BP is checked at every visit. Pre-eclampsia is a pregnancy condition with high BP that usually starts after 20 weeks. This is general information, so please follow the advice of your own care team.",
    "hi": "गर्भावस्था में उच्च रक्तचाप (BP) आपके और शिशु के लिए खतरनाक हो सकता है, इसलिए हर जाँच में आपका BP देखा जाता है। प्री-एक्लेम्पसिया गर्भावस्था की एक स्थिति है जिसमें BP बढ़ जाता है और जो आमतौर पर 20 हफ़्ते के बाद शुरू होती है। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கர்ப்ப காலத்தில் உயர் இரத்த அழுத்தம் (BP) உங்களுக்கும் குழந்தைக்கும் ஆபத்தாக இருக்கலாம்; எனவே ஒவ்வொரு பரிசோதனையிலும் உங்கள் BP பார்க்கப்படுகிறது. ப்ரீ-எக்லாம்ப்சியா என்பது உயர் BP உடன் வரும் ஒரு கர்ப்பகால நிலை; இது பொதுவாக 20 வாரங்களுக்குப் பிறகு தொடங்கும். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "గర్భధారణలో అధిక రక్తపోటు (BP) మీకు, మీ బిడ్డకు ప్రమాదకరం కావచ్చు, అందుకే ప్రతి పరీక్షలో మీ BP చూస్తారు. ప్రీ-ఎక్లాంప్సియా అనేది అధిక BPతో వచ్చే గర్భధారణ సమస్య; ఇది సాధారణంగా 20 వారాల తర్వాత మొదలవుతుంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "BP and urine are checked at every check-up because high BP, with protein in the urine, can be the first sign of pre-eclampsia. You usually cannot feel these early signs yourself.",
     "Do not miss your check-ups. If your BP is high, your ANM may send you to a bigger hospital for more tests and care.",
     "Pre-eclampsia is most likely from 20 weeks, but it can happen at any time, including in the days or weeks after the birth.",
     "With the right care it can be watched and treated. Your doctor may give BP medicine, check you and the baby more often, and sometimes advise an earlier birth. Never start or stop BP medicine without your doctor's advice.",
     "Tell your care team if you have had high BP, diabetes or kidney disease, if you had pre-eclampsia before, or if you are expecting twins. These can raise the risk.",
     "Eating well, staying active and keeping a healthy weight may help lower the risk."
    ],
    "hi": [
     "हर जाँच में BP और पेशाब देखा जाता है, क्योंकि पेशाब में प्रोटीन के साथ बढ़ा हुआ BP प्री-एक्लेम्पसिया का पहला संकेत हो सकता है। शुरुआती संकेत आपको खुद आमतौर पर महसूस नहीं होते।",
     "अपनी जाँच न छोड़ें। अगर आपका BP ज़्यादा निकले तो ANM आपको और जाँच व इलाज के लिए बड़े अस्पताल भेज सकती हैं।",
     "प्री-एक्लेम्पसिया की संभावना 20 हफ़्ते के बाद सबसे ज़्यादा होती है, पर यह कभी भी हो सकता है, यहाँ तक कि बच्चे के जन्म के बाद के दिनों या हफ़्तों में भी।",
     "सही देखभाल से इसे निगरानी में रखकर इलाज किया जा सकता है। डॉक्टर BP की दवा दे सकते हैं, आपकी और शिशु की जाँच ज़्यादा बार कर सकते हैं, और कभी-कभी जल्दी प्रसव की सलाह दे सकते हैं। डॉक्टर की सलाह के बिना BP की दवा कभी शुरू या बंद न करें।",
     "अगर आपको पहले उच्च BP, मधुमेह (शुगर) या गुर्दे की बीमारी रही हो, पहले प्री-एक्लेम्पसिया हुआ हो, या आपके जुड़वाँ बच्चे हों, तो अपनी देखभाल टीम को बताएँ। इनसे खतरा बढ़ सकता है।",
     "अच्छा खाना, सक्रिय रहना और सही वज़न रखना खतरा कम करने में मदद कर सकता है।"
    ],
    "ta": [
     "ஒவ்வொரு பரிசோதனையிலும் BP-யும் சிறுநீரும் பார்க்கப்படுகின்றன; ஏனெனில் சிறுநீரில் புரதத்துடன் உயர் BP இருப்பது ப்ரீ-எக்லாம்ப்சியாவின் முதல் அறிகுறியாக இருக்கலாம். இந்த ஆரம்ப அறிகுறிகளை நீங்களாக உணர முடியாது.",
     "பரிசோதனைகளைத் தவறவிடாதீர்கள். உங்கள் BP அதிகமாக இருந்தால், மேலும் பரிசோதனைகளுக்கும் சிகிச்சைக்கும் உங்கள் ANM உங்களைப் பெரிய மருத்துவமனைக்கு அனுப்பலாம்.",
     "ப்ரீ-எக்லாம்ப்சியா 20 வாரங்களுக்குப் பிறகு வருவதற்கே வாய்ப்பு அதிகம்; ஆனால் எந்த நேரத்திலும் வரலாம், பிரசவத்துக்குப் பிந்தைய நாட்களிலோ வாரங்களிலோகூட வரலாம்.",
     "சரியான பராமரிப்பு இருந்தால் இதைக் கண்காணித்துச் சிகிச்சை அளிக்க முடியும். மருத்துவர் BP மருந்து கொடுக்கலாம், உங்களையும் குழந்தையையும் அடிக்கடி பரிசோதிக்கலாம், சில நேரம் முன்கூட்டிய பிரசவத்தைப் பரிந்துரைக்கலாம். மருத்துவரின் ஆலோசனையின்றி BP மருந்தை ஒருபோதும் தொடங்கவோ நிறுத்தவோ வேண்டாம்.",
     "உங்களுக்கு முன்பு உயர் BP, சர்க்கரை நோய் அல்லது சிறுநீரக நோய் இருந்தாலோ, முன்பு ப்ரீ-எக்லாம்ப்சியா வந்திருந்தாலோ, இரட்டைக் குழந்தைகள் இருந்தாலோ உங்கள் பராமரிப்புக் குழுவிடம் சொல்லுங்கள். இவை ஆபத்தை அதிகரிக்கலாம்.",
     "நல்ல உணவு, சுறுசுறுப்பு, ஆரோக்கியமான எடை ஆகியவை ஆபத்தைக் குறைக்க உதவலாம்."
    ],
    "te": [
     "ప్రతి పరీక్షలో BP, మూత్రం చూస్తారు, ఎందుకంటే మూత్రంలో ప్రోటీన్‌తో పాటు అధిక BP ఉండటం ప్రీ-ఎక్లాంప్సియా మొదటి సూచన కావచ్చు. ఈ తొలి సూచనలు మీకు సాధారణంగా తెలియవు.",
     "పరీక్షలు మానకండి. మీ BP ఎక్కువగా ఉంటే మరిన్ని పరీక్షలు, చికిత్స కోసం మీ ANM మిమ్మల్ని పెద్ద ఆసుపత్రికి పంపవచ్చు.",
     "ప్రీ-ఎక్లాంప్సియా 20 వారాల తర్వాత వచ్చే అవకాశం ఎక్కువ; కానీ ఎప్పుడైనా రావచ్చు, కాన్పు తర్వాత రోజుల్లో లేదా వారాల్లో కూడా రావచ్చు.",
     "సరైన సంరక్షణతో దీన్ని గమనిస్తూ చికిత్స చేయవచ్చు. డాక్టర్ BP మందు ఇవ్వవచ్చు, మిమ్మల్ని, బిడ్డను తరచుగా పరీక్షించవచ్చు, కొన్నిసార్లు ముందస్తు కాన్పును సూచించవచ్చు. డాక్టర్ సలహా లేకుండా BP మందును ఎప్పుడూ మొదలుపెట్టకండి, ఆపకండి.",
     "మీకు ఇంతకు ముందు అధిక BP, షుగర్ లేదా కిడ్నీ వ్యాధి ఉన్నా, గతంలో ప్రీ-ఎక్లాంప్సియా వచ్చినా, కవలలు ఉన్నా మీ సంరక్షణ బృందానికి చెప్పండి. వీటి వల్ల ప్రమాదం పెరగవచ్చు.",
     "మంచి ఆహారం, చురుకుగా ఉండటం, ఆరోగ్యకరమైన బరువు ప్రమాదాన్ని తగ్గించడంలో సహాయపడవచ్చు."
    ]
   },
   "seekHelp": {
    "en": [
     "A severe headache that does not go away",
     "Problems with your vision, such as blurring or flashing lights",
     "Pain just below your ribs",
     "Sudden swelling of the face, hands or feet",
     "Feeling very unwell",
     "Heartburn that does not go away",
     "Vomiting",
     "Fits (convulsions): this is an emergency, go to hospital immediately"
    ],
    "hi": [
     "तेज़ सिरदर्द जो ठीक न हो",
     "आँखों की समस्या, जैसे धुंधला दिखना या आँखों के आगे चमक दिखना",
     "पसलियों के ठीक नीचे दर्द",
     "चेहरे, हाथों या पैरों में अचानक सूजन",
     "बहुत बीमार महसूस करना",
     "सीने में जलन जो ठीक न हो",
     "उल्टी होना",
     "दौरे (झटके): यह आपातकाल है, तुरंत अस्पताल जाएँ"
    ],
    "ta": [
     "சரியாகாத கடுமையான தலைவலி",
     "பார்வைப் பிரச்சினை, எ.கா. பார்வை மங்குதல் அல்லது ஒளி மின்னுதல்",
     "விலா எலும்புகளுக்குக் கீழே வலி",
     "முகம், கைகள் அல்லது பாதங்களில் திடீர் வீக்கம்",
     "மிகவும் உடல்நிலை சரியில்லாதது போல் உணர்தல்",
     "சரியாகாத நெஞ்செரிச்சல்",
     "வாந்தி",
     "வலிப்பு: இது அவசர நிலை; உடனே மருத்துவமனைக்குச் செல்லுங்கள்"
    ],
    "te": [
     "తగ్గని తీవ్రమైన తలనొప్పి",
     "చూపు సమస్యలు, ఉదా. మసకబారడం లేదా కళ్ళ ముందు మెరుపులు కనిపించడం",
     "పక్కటెముకల కింద నొప్పి",
     "ముఖం, చేతులు లేదా పాదాలు అకస్మాత్తుగా వాయడం",
     "చాలా అనారోగ్యంగా అనిపించడం",
     "తగ్గని ఛాతీ మంట",
     "వాంతులు",
     "మూర్ఛలు (ఫిట్స్): ఇది అత్యవసరం, వెంటనే ఆసుపత్రికి వెళ్ళండి"
    ]
   },
   "keywords": [
    "bp",
    "blood pressure",
    "high bp",
    "hypertension",
    "pre-eclampsia",
    "preeclampsia",
    "eclampsia",
    "fits",
    "swelling",
    "sujan",
    "headache",
    "sar dard",
    "blurred vision",
    "dhundhla",
    "pressure",
    "bp high",
    "raktchap",
    "rakta chaap"
   ],
   "sources": [
    {
     "label": "Pre-eclampsia - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/conditions/pre-eclampsia/"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Maternal mortality (fact sheet)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://www.who.int/news-room/fact-sheets/detail/maternal-mortality"
    },
    {
     "label": "Pregnancy, childbirth, postpartum and newborn care: a guide for essential practice (3rd edition) (PDF)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://iris.who.int/server/api/core/bitstreams/e9f751fd-6eab-42cb-9e0c-0eb86a0365bb/content"
    }
   ]
  },
  {
   "id": "gestational-diabetes",
   "category": "body",
   "title": {
    "en": "Sugar in pregnancy (gestational diabetes)",
    "hi": "गर्भावस्था में शुगर (जेस्टेशनल डायबिटीज़)",
    "ta": "கர்ப்ப காலத்தில் சர்க்கரை (கர்ப்பகால சர்க்கரை நோய்)",
    "te": "గర్భధారణలో షుగర్ (గర్భధారణ మధుమేహం)"
   },
   "summary": {
    "en": "Gestational diabetes means high blood sugar that starts in pregnancy and usually goes away after the birth. A sugar test in pregnancy finds it early, and with food changes, activity and follow-up, most women have a healthy pregnancy. This is general information, so please follow the advice of your own care team.",
    "hi": "जेस्टेशनल डायबिटीज़ का मतलब है गर्भावस्था में शुरू होने वाली खून में शुगर की बढ़ी मात्रा, जो आमतौर पर प्रसव के बाद ठीक हो जाती है। गर्भावस्था में शुगर की जाँच से यह जल्दी पता चल जाती है, और खान-पान में बदलाव, सक्रियता और नियमित फॉलो-अप से ज़्यादातर महिलाओं की गर्भावस्था स्वस्थ रहती है। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கர்ப்பகால சர்க்கரை நோய் என்பது கர்ப்ப காலத்தில் தொடங்கும் இரத்தச் சர்க்கரை உயர்வு; இது பொதுவாக பிரசவத்துக்குப் பிறகு சரியாகிவிடும். கர்ப்ப காலத்தில் சர்க்கரைப் பரிசோதனை இதை முன்கூட்டியே கண்டறியும்; உணவு மாற்றங்கள், உடல் இயக்கம், தொடர் பரிசோதனை ஆகியவற்றால் பெரும்பாலான பெண்களுக்கு கர்ப்பம் ஆரோக்கியமாக அமைகிறது. இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "గర్భధారణ మధుమేహం అంటే గర్భంలో మొదలయ్యే అధిక రక్తంలో చక్కెర; ఇది సాధారణంగా కాన్పు తర్వాత తగ్గిపోతుంది. గర్భధారణలో షుగర్ పరీక్ష దీన్ని ముందే గుర్తిస్తుంది; ఆహారంలో మార్పులు, చురుకుదనం, తదుపరి పరీక్షలతో చాలామంది మహిళల గర్భం ఆరోగ్యంగా సాగుతుంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "The Ministry of Health guideline asks that all pregnant women be tested for gestational diabetes: at the first antenatal visit, and again at 24 to 28 weeks if the first test is normal. Services can differ between states and districts.",
     "For the test, you drink a glucose drink mixed in water and your blood sugar is checked 2 hours later. The Indian guideline says you do not need to be fasting.",
     "A high result means gestational diabetes, which can happen to any pregnant woman. It usually causes no symptoms, which is why the test matters. The signs of high sugar listed below are also common in normal pregnancy, so tell your care team if you are worried.",
     "Follow-up matters. If blood sugar stays high, the baby can grow very large and birth can be harder. There is also a higher chance of pre-eclampsia, early birth, and low sugar or jaundice in the newborn. Good control lowers these risks.",
     "Treatment starts with changes in food and more activity, such as walking, with a diet plan from your care team. Some women also need medicine from the doctor. Do not change any medicine on your own, and do not skip the extra check-ups.",
     "After the birth, your sugar usually returns to normal, but your risk of getting diabetes later is higher. The Indian guideline asks for a sugar test in hospital in the first few days after delivery and again around 6 weeks. Keep having regular sugar tests as your care team advises."
    ],
    "hi": [
     "स्वास्थ्य मंत्रालय के दिशानिर्देश के अनुसार सभी गर्भवती महिलाओं की जेस्टेशनल डायबिटीज़ की जाँच होनी चाहिए: पहली प्रसवपूर्व जाँच में, और अगर पहली जाँच सामान्य हो तो 24 से 28 हफ़्ते में दोबारा। सुविधाएँ राज्यों और ज़िलों में अलग हो सकती हैं।",
     "जाँच में आप पानी में घुला ग्लूकोज़ पीती हैं और 2 घंटे बाद आपके खून की शुगर जाँची जाती है। भारतीय दिशानिर्देश के अनुसार आपको खाली पेट रहने की ज़रूरत नहीं है।",
     "जाँच में शुगर ज़्यादा आने का मतलब जेस्टेशनल डायबिटीज़ है, जो किसी भी गर्भवती महिला को हो सकती है। इसमें आमतौर पर कोई लक्षण नहीं होते, इसीलिए जाँच ज़रूरी है। नीचे दिए गए ज़्यादा शुगर के संकेत सामान्य गर्भावस्था में भी आम हैं, इसलिए चिंता हो तो अपनी देखभाल टीम को बताएँ।",
     "फॉलो-अप ज़रूरी है। अगर खून की शुगर ज़्यादा बनी रहे तो शिशु बहुत बड़ा हो सकता है और प्रसव कठिन हो सकता है। प्री-एक्लेम्पसिया, समय से पहले जन्म, और नवजात में शुगर कम होने या पीलिया का खतरा भी बढ़ता है। शुगर काबू में रखने से ये खतरे कम होते हैं।",
     "इलाज की शुरुआत खान-पान में बदलाव और ज़्यादा सक्रियता (जैसे चलना) से होती है, जिसके लिए आपकी देखभाल टीम आहार योजना बताती है। कुछ महिलाओं को डॉक्टर से दवा भी लेनी पड़ती है। कोई भी दवा खुद से न बदलें, और अतिरिक्त जाँचें न छोड़ें।",
     "प्रसव के बाद शुगर आमतौर पर सामान्य हो जाती है, पर आगे चलकर डायबिटीज़ होने का खतरा ज़्यादा रहता है। भारतीय दिशानिर्देश में डिलीवरी के कुछ दिनों के अंदर अस्पताल में और लगभग 6 हफ़्ते बाद फिर शुगर जाँच की बात कही गई है। देखभाल टीम की सलाह के अनुसार नियमित रूप से शुगर की जाँच कराती रहें।"
    ],
    "ta": [
     "அனைத்து கர்ப்பிணிகளுக்கும் கர்ப்பகால சர்க்கரை நோய்ப் பரிசோதனை செய்ய வேண்டும் என்று சுகாதார அமைச்சக வழிகாட்டுதல் கூறுகிறது: முதல் கர்ப்பகாலப் பரிசோதனையில், முதல் பரிசோதனை இயல்பாக இருந்தால் 24 முதல் 28 வாரங்களில் மீண்டும். வசதிகள் மாநிலங்களுக்கும் மாவட்டங்களுக்கும் இடையே மாறுபடலாம்.",
     "பரிசோதனையில், தண்ணீரில் கலந்த குளுக்கோஸ் பானத்தைக் குடிப்பீர்கள்; 2 மணி நேரம் கழித்து இரத்தச் சர்க்கரை பார்க்கப்படும். இந்திய வழிகாட்டுதலின்படி நீங்கள் வெறும் வயிற்றில் இருக்க வேண்டியதில்லை.",
     "முடிவு அதிகமாக வந்தால் அது கர்ப்பகால சர்க்கரை நோய்; இது எந்த கர்ப்பிணிக்கும் வரலாம். இதற்குப் பொதுவாக அறிகுறிகள் இருக்காது; அதனால்தான் பரிசோதனை முக்கியம். கீழே உள்ள அதிகச் சர்க்கரை அறிகுறிகள் சாதாரண கர்ப்பத்திலும் பொதுவாக வரக்கூடியவை; எனவே கவலையாக இருந்தால் உங்கள் பராமரிப்புக் குழுவிடம் சொல்லுங்கள்.",
     "தொடர் கவனிப்பு முக்கியம். இரத்தச் சர்க்கரை தொடர்ந்து அதிகமாக இருந்தால் குழந்தை மிகப் பெரிதாக வளரலாம்; பிரசவம் கடினமாகலாம். ப்ரீ-எக்லாம்ப்சியா, குறைப்பிரசவம், பிறந்த குழந்தைக்கு சர்க்கரை குறைவு அல்லது மஞ்சள்காமாலை வருவதற்கான வாய்ப்பும் அதிகம். சர்க்கரையை கட்டுப்பாட்டில் வைத்தால் இந்த ஆபத்துகள் குறையும்.",
     "சிகிச்சை உணவு மாற்றங்களுடனும், நடைப்பயிற்சி போன்ற கூடுதல் உடல் இயக்கத்துடனும் தொடங்குகிறது; உங்கள் பராமரிப்புக் குழு உணவுத் திட்டம் தரும். சில பெண்களுக்கு மருத்துவரின் மருந்தும் தேவைப்படலாம். எந்த மருந்தையும் நீங்களாக மாற்றாதீர்கள்; கூடுதல் பரிசோதனைகளைத் தவறவிடாதீர்கள்.",
     "பிரசவத்துக்குப் பிறகு சர்க்கரை பொதுவாக இயல்பு நிலைக்கு வரும்; ஆனால் பிற்காலத்தில் சர்க்கரை நோய் வரும் ஆபத்து அதிகம். பிரசவத்துக்குப் பிறகு முதல் சில நாட்களுக்குள் மருத்துவமனையிலும், சுமார் 6 வாரங்களுக்குப் பிறகும் மீண்டும் சர்க்கரைப் பரிசோதனை செய்ய இந்திய வழிகாட்டுதல் கூறுகிறது. உங்கள் பராமரிப்புக் குழு கூறியபடி தொடர்ந்து சர்க்கரையைப் பரிசோதித்துக்கொள்ளுங்கள்."
    ],
    "te": [
     "గర్భిణులందరికీ గర్భధారణ మధుమేహ పరీక్ష చేయాలని ఆరోగ్య మంత్రిత్వ శాఖ మార్గదర్శకం చెబుతోంది: మొదటి గర్భ పరీక్షలో, మొదటి పరీక్ష సాధారణంగా ఉంటే 24 నుండి 28 వారాల్లో మళ్ళీ. సౌకర్యాలు రాష్ట్రాలు, జిల్లాల మధ్య మారవచ్చు.",
     "పరీక్షలో నీటిలో కలిపిన గ్లూకోజ్ పానీయం తాగుతారు; 2 గంటల తర్వాత రక్తంలో చక్కెర చూస్తారు. భారతీయ మార్గదర్శకం ప్రకారం మీరు ఖాళీ కడుపుతో ఉండాల్సిన అవసరం లేదు.",
     "ఫలితం ఎక్కువగా వస్తే అది గర్భధారణ మధుమేహం; ఇది ఏ గర్భిణికైనా రావచ్చు. దీనికి సాధారణంగా లక్షణాలు ఉండవు, అందుకే పరీక్ష ముఖ్యం. కింద ఉన్న అధిక చక్కెర సూచనలు సాధారణ గర్భధారణలో కూడా తరచూ ఉంటాయి, కాబట్టి ఆందోళనగా ఉంటే మీ సంరక్షణ బృందానికి చెప్పండి.",
     "తదుపరి పరీక్షలు ముఖ్యం. రక్తంలో చక్కెర ఎక్కువగానే ఉంటే బిడ్డ చాలా పెద్దగా పెరగవచ్చు, కాన్పు కష్టం కావచ్చు. ప్రీ-ఎక్లాంప్సియా, నెలలు నిండకముందే కాన్పు, నవజాత శిశువుకు చక్కెర తగ్గడం లేదా కామెర్లు వచ్చే అవకాశం కూడా పెరుగుతుంది. చక్కెరను అదుపులో ఉంచితే ఈ ప్రమాదాలు తగ్గుతాయి.",
     "చికిత్స ఆహారంలో మార్పులతో, నడక వంటి ఎక్కువ శారీరక కదలికతో మొదలవుతుంది; మీ సంరక్షణ బృందం ఆహార ప్రణాళిక ఇస్తుంది. కొందరు మహిళలకు డాక్టర్ ఇచ్చే మందు కూడా అవసరం కావచ్చు. ఏ మందునూ మీ అంతట మీరే మార్చకండి; అదనపు పరీక్షలను మానకండి.",
     "కాన్పు తర్వాత చక్కెర సాధారణంగా మామూలు స్థాయికి వస్తుంది, కానీ తర్వాత కాలంలో మధుమేహం వచ్చే ప్రమాదం ఎక్కువ. కాన్పు తర్వాత మొదటి కొన్ని రోజుల్లో ఆసుపత్రిలో, సుమారు 6 వారాలకు మళ్ళీ షుగర్ పరీక్ష చేయాలని భారతీయ మార్గదర్శకం చెబుతోంది. మీ సంరక్షణ బృందం చెప్పినట్లు క్రమం తప్పకుండా షుగర్ పరీక్షలు చేయించుకోండి."
    ]
   },
   "seekHelp": {
    "en": [
     "Feeling very thirsty, or having a dry mouth",
     "Passing urine much more often than usual",
     "Blurred vision, or feeling very tired",
     "Itching around the genital area, or thrush"
    ],
    "hi": [
     "बहुत प्यास लगना या मुँह सूखना",
     "सामान्य से बहुत ज़्यादा बार पेशाब आना",
     "धुंधला दिखना या बहुत थकान महसूस होना",
     "जननांग के आसपास खुजली या फंगल इन्फेक्शन (थ्रश)"
    ],
    "ta": [
     "மிகுந்த தாகம் அல்லது வாய் வறட்சி",
     "வழக்கத்தைவிட மிக அடிக்கடி சிறுநீர் கழிதல்",
     "பார்வை மங்குதல் அல்லது மிகுந்த சோர்வு",
     "பிறப்புறுப்புப் பகுதியில் அரிப்பு அல்லது பூஞ்சைத் தொற்று (திரஷ்)"
    ],
    "te": [
     "చాలా దాహం వేయడం లేదా నోరు ఎండిపోవడం",
     "మామూలు కంటే చాలా తరచుగా మూత్రం రావడం",
     "చూపు మసకబారడం లేదా చాలా అలసటగా అనిపించడం",
     "జననేంద్రియ ప్రాంతంలో దురద లేదా ఫంగల్ ఇన్ఫెక్షన్ (థ్రష్)"
    ]
   },
   "keywords": [
    "sugar",
    "gdm",
    "gestational diabetes",
    "diabetes",
    "madhumeh",
    "sugar test",
    "ogtt",
    "glucose",
    "glucose test",
    "sugar check",
    "blood sugar",
    "shugar",
    "meetha",
    "diabetes in pregnancy",
    "75 gm",
    "sugar level"
   ],
   "sources": [
    {
     "label": "National Guidelines for Diagnosis & Management of Gestational Diabetes Mellitus (December 2014) (PDF)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/National_Guidelines_for_Diagnosis_&_Management_of_Gestational_Diabetes_Mellitus.pdf"
    },
    {
     "label": "Gestational diabetes - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/conditions/gestational-diabetes/"
    },
    {
     "label": "What benefits would pregnant women receive (PMSMA)",
     "publisher": "Ministry of Health and Family Welfare, Government of India",
     "url": "https://pmsma.mohfw.gov.in/i-am/pregnant-woman/what-benefits-would-pregnant-women-receive/"
    }
   ]
  },
  {
   "id": "mental-wellbeing",
   "category": "support",
   "title": {
    "en": "Feelings and mental wellbeing",
    "hi": "भावनाएँ और मानसिक स्वास्थ्य",
    "ta": "உணர்வுகளும் மன நலமும்",
    "te": "భావాలు మరియు మానసిక ఆరోగ్యం"
   },
   "summary": {
    "en": "Feeling worried, sad or low is common during pregnancy and after birth, and it can be treated. WHO says about 1 in 10 pregnant women and 13 in 100 new mothers have a mental health problem, mostly depression, and it is more common in developing countries. This is general information, so please follow the advice of your own care team.",
    "hi": "गर्भावस्था में और प्रसव के बाद चिंता, उदासी या मन भारी रहना आम है, और इसका इलाज हो सकता है। WHO के अनुसार लगभग 10 में से 1 गर्भवती महिला और हर 100 में से 13 नई माँओं को मानसिक स्वास्थ्य की समस्या होती है, ज़्यादातर अवसाद (डिप्रेशन), और विकासशील देशों में यह और ज़्यादा आम है। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கர்ப்ப காலத்திலும் பிரசவத்துக்குப் பிறகும் கவலை, சோகம், மனச்சோர்வு ஏற்படுவது சாதாரணம்; இதற்குச் சிகிச்சை உண்டு. சுமார் 10 கர்ப்பிணிகளில் 1 பேருக்கும், 100 புதிய தாய்மார்களில் 13 பேருக்கும் மன நலப் பிரச்சினை (பெரும்பாலும் மனச்சோர்வு) இருப்பதாகவும், வளரும் நாடுகளில் இது இன்னும் அதிகம் என்றும் WHO கூறுகிறது. இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "గర్భధారణలో, కాన్పు తర్వాత ఆందోళన, బాధ, నిరుత్సాహం కలగడం సాధారణం, దీనికి చికిత్స ఉంది. సుమారు 10 మంది గర్భిణుల్లో ఒకరికి, ప్రతి 100 మంది కొత్త తల్లుల్లో 13 మందికి మానసిక ఆరోగ్య సమస్య (ఎక్కువగా డిప్రెషన్) ఉంటుందని, అభివృద్ధి చెందుతున్న దేశాల్లో ఇది ఇంకా ఎక్కువని WHO చెబుతోంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Any woman can feel this way. Poverty, great stress, violence at home and little support from family can raise the risk. Fathers and partners can also feel low after a baby is born.",
     "Feeling low, anxious or tearful for a few days after birth (the baby blues) is very common and usually passes within about two weeks. If the feelings last longer, get worse, or you cannot cope, ask for help.",
     "Talk to someone you trust, such as your ANM, ASHA, doctor or a family member. Say honestly how you feel.",
     "Support from your family helps. The government booklet says care and support from the husband and mother-in-law give emotional support and confidence.",
     "These problems are treatable. Trained health workers can give counselling and support, and sometimes a doctor may advise medicine. If you already take medicine, talk to your doctor before stopping it.",
     "Tele-MANAS is a free, 24-hour mental health helpline run under the Ministry of Health. The government lists the number as 14416, and you can choose your language. Availability can differ by state."
    ],
    "hi": [
     "कोई भी महिला ऐसा महसूस कर सकती है। गरीबी, बहुत ज़्यादा तनाव, घर में हिंसा और परिवार से कम सहारा खतरा बढ़ा सकते हैं। बच्चे के जन्म के बाद पिता या साथी भी उदास महसूस कर सकते हैं।",
     "बच्चे के जन्म के बाद कुछ दिन उदास, घबराया हुआ या रोने का मन होना (बेबी ब्लूज़) बहुत आम है और आमतौर पर लगभग दो हफ़्तों में ठीक हो जाता है। अगर ये भावनाएँ लंबी चलें, बढ़ें, या आप सँभाल न पा रही हों, तो मदद माँगें।",
     "किसी भरोसेमंद व्यक्ति से बात करें, जैसे ANM, आशा, डॉक्टर या परिवार का कोई सदस्य। अपनी भावनाएँ खुलकर बताएँ।",
     "परिवार का साथ मदद करता है। सरकारी पुस्तिका के अनुसार पति और सास की देखभाल और सहयोग से भावनात्मक सहारा और आत्मविश्वास मिलता है।",
     "इन समस्याओं का इलाज हो सकता है। प्रशिक्षित स्वास्थ्यकर्मी परामर्श (काउंसलिंग) और सहयोग दे सकते हैं, और कभी-कभी डॉक्टर दवा की सलाह दे सकते हैं। अगर आप पहले से कोई दवा ले रही हैं तो उसे बंद करने से पहले डॉक्टर से बात करें।",
     "टेली-मानस (Tele-MANAS) स्वास्थ्य मंत्रालय के तहत चलने वाली मुफ़्त, 24 घंटे की मानसिक स्वास्थ्य हेल्पलाइन है। सरकार इसका नंबर 14416 बताती है, और आप अपनी भाषा चुन सकती हैं। उपलब्धता राज्य के अनुसार अलग हो सकती है।"
    ],
    "ta": [
     "எந்தப் பெண்ணுக்கும் இப்படி உணர்வுகள் ஏற்படலாம். வறுமை, கடுமையான மன அழுத்தம், வீட்டில் வன்முறை, குடும்பத்தின் ஆதரவு குறைவு ஆகியவை ஆபத்தை அதிகரிக்கலாம். குழந்தை பிறந்த பிறகு தந்தைகளும் துணைவர்களும்கூட மனச்சோர்வடையலாம்.",
     "குழந்தை பிறந்த சில நாட்களுக்கு மனச்சோர்வு, பதற்றம், அழுகை வருவது (பேபி ப்ளூஸ்) மிகவும் சாதாரணம்; பொதுவாக சுமார் இரண்டு வாரங்களில் சரியாகிவிடும். இந்த உணர்வுகள் நீண்ட நாள் நீடித்தாலோ, மோசமானாலோ, உங்களால் சமாளிக்க முடியாவிட்டாலோ உதவி கேளுங்கள்.",
     "நம்பிக்கைக்குரிய ஒருவரிடம், உதாரணமாக உங்கள் ANM, ஆஷா, மருத்துவர் அல்லது குடும்பத்தினரிடம், பேசுங்கள். உங்கள் உணர்வுகளை வெளிப்படையாகச் சொல்லுங்கள்.",
     "குடும்பத்தின் ஆதரவு உதவும். கணவர் மற்றும் மாமியாரின் அக்கறையும் ஆதரவும் உணர்வு ரீதியான ஆதரவையும் தன்னம்பிக்கையையும் தரும் என்று அரசுக் கையேடு கூறுகிறது.",
     "இந்தப் பிரச்சினைகளுக்குச் சிகிச்சை உண்டு. பயிற்சி பெற்ற சுகாதாரப் பணியாளர்கள் ஆலோசனையும் ஆதரவும் தரலாம்; சில நேரம் மருத்துவர் மருந்தைப் பரிந்துரைக்கலாம். ஏற்கெனவே ஏதேனும் மருந்து எடுத்துக்கொண்டிருந்தால், நிறுத்தும் முன் மருத்துவரிடம் பேசுங்கள்.",
     "Tele-MANAS என்பது சுகாதார அமைச்சகத்தின் கீழ் இயங்கும் இலவச, 24 மணி நேர மனநல உதவி எண். அரசு இதன் எண்ணை 14416 எனக் குறிப்பிடுகிறது; உங்கள் மொழியைத் தேர்வு செய்யலாம். இந்தச் சேவை மாநிலத்துக்கு மாநிலம் மாறுபடலாம்."
    ],
    "te": [
     "ఏ మహిళకైనా ఇలా అనిపించవచ్చు. పేదరికం, తీవ్రమైన ఒత్తిడి, ఇంట్లో హింస, కుటుంబం నుండి తక్కువ తోడ్పాటు ప్రమాదాన్ని పెంచవచ్చు. బిడ్డ పుట్టిన తర్వాత తండ్రులు, భాగస్వాములు కూడా నిరుత్సాహపడవచ్చు.",
     "కాన్పు తర్వాత కొన్ని రోజులు బాధగా, కంగారుగా, ఏడుపు వచ్చేలా అనిపించడం (బేబీ బ్లూస్) చాలా సాధారణం; సాధారణంగా రెండు వారాల్లో తగ్గిపోతుంది. ఈ భావాలు ఎక్కువకాలం ఉన్నా, పెరిగినా, లేదా మీరు తట్టుకోలేకపోతున్నా సహాయం అడగండి.",
     "మీకు నమ్మకమైన వారితో, ఉదాహరణకు మీ ANM, ఆశా, డాక్టర్ లేదా కుటుంబ సభ్యులతో మాట్లాడండి. మీ భావాలను నిజాయితీగా చెప్పండి.",
     "కుటుంబ తోడ్పాటు సహాయపడుతుంది. భర్త, అత్తగారి శ్రద్ధ, తోడ్పాటు మానసిక ఆసరా, ఆత్మవిశ్వాసం ఇస్తాయని ప్రభుత్వ పుస్తకం చెబుతోంది.",
     "ఈ సమస్యలకు చికిత్స ఉంది. శిక్షణ పొందిన ఆరోగ్య కార్యకర్తలు కౌన్సెలింగ్, తోడ్పాటు ఇవ్వగలరు; కొన్నిసార్లు డాక్టర్ మందు సూచించవచ్చు. మీరు ఇప్పటికే ఏదైనా మందు వాడుతుంటే, ఆపే ముందు డాక్టర్‌తో మాట్లాడండి.",
     "Tele-MANAS అనేది ఆరోగ్య మంత్రిత్వ శాఖ కింద నడిచే ఉచిత, 24 గంటల మానసిక ఆరోగ్య హెల్ప్‌లైన్. ప్రభుత్వం దీని నంబర్‌ను 14416గా పేర్కొంది; మీరు మీ భాషను ఎంచుకోవచ్చు. ఈ సేవ రాష్ట్రాన్ని బట్టి మారవచ్చు."
    ]
   },
   "seekHelp": {
    "en": [
     "Thoughts of harming yourself or your baby: tell someone now and get urgent help (nearest hospital, 112, or Tele-MANAS 14416)",
     "Low mood, or not enjoying things you usually enjoy, that does not go away",
     "Feeling hopeless, guilty, worthless or unable to cope",
     "Constant fear, worry or restlessness",
     "Trouble sleeping even when you have time to rest, or trouble concentrating",
     "Difficulty bonding with your baby, or feeling negative about your baby"
    ],
    "hi": [
     "खुद को या अपने शिशु को नुकसान पहुँचाने के विचार: तुरंत किसी को बताएँ और फ़ौरन मदद लें (नज़दीकी अस्पताल, 112, या टेली-मानस 14416)",
     "मन उदास रहना, या जिन चीज़ों में पहले मन लगता था उनमें मन न लगना, और यह ठीक न होना",
     "निराशा, अपराध-बोध, खुद को बेकार समझना या सँभाल न पाने का एहसास",
     "लगातार डर, चिंता या बेचैनी",
     "आराम का समय होने पर भी नींद न आना, या ध्यान लगाने में परेशानी",
     "शिशु से लगाव महसूस करने में कठिनाई, या शिशु के बारे में नकारात्मक भावनाएँ"
    ],
    "ta": [
     "உங்களுக்கோ உங்கள் குழந்தைக்கோ தீங்கு செய்யும் எண்ணங்கள்: உடனே யாரிடமாவது சொல்லுங்கள்; அவசர உதவி பெறுங்கள் (அருகிலுள்ள மருத்துவமனை, 112, அல்லது Tele-MANAS 14416)",
     "மனச்சோர்வு, அல்லது வழக்கமாக விரும்பும் விஷயங்களில் ஆர்வம் இல்லாமை; இது சரியாகாமல் இருத்தல்",
     "நம்பிக்கையற்ற நிலை, குற்ற உணர்வு, தனக்கு மதிப்பில்லை என்ற உணர்வு, அல்லது சமாளிக்க முடியாத உணர்வு",
     "தொடர்ந்த பயம், கவலை அல்லது அமைதியின்மை",
     "ஓய்வெடுக்க நேரம் இருந்தும் தூக்கம் வராமை, அல்லது கவனம் செலுத்துவதில் சிரமம்",
     "குழந்தையுடன் பாசப் பிணைப்பு ஏற்படுவதில் சிரமம், அல்லது குழந்தையைப் பற்றி எதிர்மறையாக உணர்தல்"
    ],
    "te": [
     "మిమ్మల్ని లేదా మీ బిడ్డను హాని చేసుకోవాలనే ఆలోచనలు: వెంటనే ఎవరికైనా చెప్పండి, అత్యవసర సహాయం పొందండి (దగ్గరలోని ఆసుపత్రి, 112, లేదా Tele-MANAS 14416)",
     "నిరుత్సాహంగా ఉండటం, లేదా మీకు మామూలుగా నచ్చే వాటిపై ఆసక్తి లేకపోవడం; ఇది తగ్గకపోవడం",
     "నిరాశ, అపరాధ భావన, తాను పనికిరానని అనిపించడం, లేదా తట్టుకోలేకపోతున్నట్లు అనిపించడం",
     "నిరంతర భయం, ఆందోళన లేదా అశాంతి",
     "విశ్రాంతికి సమయం ఉన్నా నిద్ర పట్టకపోవడం, లేదా ఏకాగ్రత కుదరకపోవడం",
     "బిడ్డతో అనుబంధం ఏర్పడటంలో ఇబ్బంది, లేదా బిడ్డ గురించి ప్రతికూలంగా అనిపించడం"
    ]
   },
   "keywords": [
    "depression",
    "stress",
    "tension",
    "anxiety",
    "sad",
    "low mood",
    "crying",
    "mood swings",
    "baby blues",
    "postpartum depression",
    "postnatal depression",
    "ppd",
    "mental health",
    "manasik",
    "udaas",
    "udasi",
    "chinta",
    "ghabrahat",
    "sleep problem",
    "neend nahi",
    "tele manas",
    "14416",
    "helpline",
    "counselling"
   ],
   "sources": [
    {
     "label": "Perinatal mental health",
     "publisher": "World Health Organization (WHO)",
     "url": "https://www.who.int/teams/mental-health-and-substance-use/promotion-prevention/perinatal-mental-health"
    },
    {
     "label": "Mental health in pregnancy - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/mental-health-in-pregnancy-and-after-the-birth/mental-health/"
    },
    {
     "label": "Postnatal depression - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/mental-health/conditions/postnatal-depression/"
    },
    {
     "label": "Tele Mental Health Assistance and Networking Across States (Tele-MANAS) initiative launched on occasion of World Mental Health Day",
     "publisher": "Press Information Bureau, Ministry of Health and Family Welfare, Government of India",
     "url": "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1866498&reg=48&lang=2"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    }
   ]
  },
  {
   "id": "labour-and-birth-plan",
   "category": "baby",
   "title": {
    "en": "Getting ready for the birth",
    "hi": "प्रसव की तैयारी",
    "ta": "பிரசவத்துக்குத் தயாராகுதல்",
    "te": "కాన్పుకు సిద్ధం కావడం"
   },
   "summary": {
    "en": "Plan for the birth during pregnancy: decide where you will give birth, how you will get there, and who will go with you. The government advises giving birth in a health facility with a skilled birth attendant, because help is quickly available if a problem comes up. This is general information, so please follow the advice of your own care team.",
    "hi": "गर्भावस्था के दौरान ही प्रसव की योजना बना लें: कहाँ प्रसव कराना है, वहाँ कैसे पहुँचेंगी, और आपके साथ कौन जाएगा। सरकार की सलाह है कि प्रसव स्वास्थ्य केंद्र में प्रशिक्षित स्वास्थ्यकर्मी (कुशल प्रसव सहायक) की देखरेख में कराएँ, क्योंकि कोई समस्या आने पर वहाँ जल्दी मदद मिल जाती है। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "கர்ப்ப காலத்திலேயே பிரசவத்துக்குத் திட்டமிடுங்கள்: எங்கே பிரசவிப்பீர்கள், அங்கே எப்படிச் செல்வீர்கள், உங்களுடன் யார் வருவார்கள் என்பதை முடிவு செய்யுங்கள். பிரசவத்தை சுகாதார மையத்தில், பயிற்சி பெற்ற பிரசவ உதவியாளரின் உதவியுடன் நடத்துமாறு அரசு அறிவுறுத்துகிறது; ஏனெனில் ஏதேனும் பிரச்சினை வந்தால் அங்கு விரைவாக உதவி கிடைக்கும். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "గర్భధారణ సమయంలోనే కాన్పుకు ప్రణాళిక వేసుకోండి: ఎక్కడ కాన్పు చేయించుకుంటారు, అక్కడికి ఎలా వెళ్తారు, మీతో ఎవరు వస్తారు అనేది నిర్ణయించుకోండి. శిక్షణ పొందిన ప్రసవ సహాయకుని సమక్షంలో ఆరోగ్య కేంద్రంలో కాన్పు చేయించుకోవాలని ప్రభుత్వం సూచిస్తోంది, ఎందుకంటే ఏదైనా సమస్య వస్తే అక్కడ త్వరగా సహాయం అందుతుంది. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Ask your ANM or ASHA early where you will give birth, and choose the hospital in advance. If your MCP card has a red sticker (high-risk pregnancy), plan to give birth at a hospital that can handle emergencies, such as a First Referral Unit (FRU).",
     "Plan transport in advance: how you will reach the hospital by day or night. Write your local ambulance number in your MCP card. The government offers free transport for pregnant women under the JSSK scheme.",
     "Keep money ready and identify a blood donor in case of an emergency. Decide who will go with you and who will look after your home and other children.",
     "Keep ready to take: your MCP card and Safe Motherhood booklet, clean cloths, clean clothes for you and the baby, and food and water for you and your companion.",
     "Register under Janani Suraksha Yojana (JSY) and, if you are eligible, PMMVY through your ASHA, ANM or Anganwadi worker (see the page on government support).",
     "Go through your birth plan at every check-up. It can change if a problem comes up. Plan to stay in the health facility for at least 48 hours after the birth."
    ],
    "hi": [
     "अपनी ANM या आशा से शुरू में ही पूछें कि प्रसव कहाँ कराना है, और अस्पताल पहले से तय कर लें। अगर आपके MCP कार्ड पर लाल स्टिकर है (जोखिम वाली गर्भावस्था), तो ऐसे अस्पताल में प्रसव की योजना बनाएँ जहाँ आपात स्थिति सँभाली जा सके, जैसे प्रथम रेफरल इकाई (FRU)।",
     "परिवहन की योजना पहले से बनाएँ: दिन या रात में अस्पताल कैसे पहुँचेंगी। अपने इलाके का एंबुलेंस नंबर अपने MCP कार्ड में लिख लें। सरकार JSSK योजना के तहत गर्भवती महिलाओं को मुफ़्त परिवहन देती है।",
     "आपात स्थिति के लिए पैसे तैयार रखें और किसी रक्तदाता का पहले से इंतज़ाम रखें। तय करें कि आपके साथ कौन जाएगा और घर व दूसरे बच्चों की देखभाल कौन करेगा।",
     "साथ ले जाने के लिए तैयार रखें: MCP कार्ड और सुरक्षित मातृत्व पुस्तिका, साफ़ कपड़े, आपके और शिशु के लिए साफ़ पहनने के कपड़े, और आपके व साथ वाले के लिए खाना-पानी।",
     "अपनी आशा, ANM या आँगनवाड़ी कार्यकर्ता के ज़रिए जननी सुरक्षा योजना (JSY) में और, पात्र हों तो, PMMVY में पंजीकरण कराएँ (सरकारी सहायता वाला पृष्ठ देखें)।",
     "हर जाँच में अपनी प्रसव योजना पर बात करें। कोई समस्या आने पर योजना बदल सकती है। प्रसव के बाद कम से कम 48 घंटे स्वास्थ्य केंद्र में रुकने की योजना रखें।"
    ],
    "ta": [
     "பிரசவம் எங்கே என்பதை உங்கள் ANM அல்லது ஆஷாவிடம் முன்கூட்டியே கேட்டு, மருத்துவமனையை முன்பே தேர்வு செய்யுங்கள். உங்கள் MCP அட்டையில் சிவப்பு ஸ்டிக்கர் இருந்தால் (அதிக ஆபத்துள்ள கர்ப்பம்), அவசர நிலைகளைக் கையாளக்கூடிய மருத்துவமனையில், அதாவது முதல் பரிந்துரை அலகில் (FRU), பிரசவிக்கத் திட்டமிடுங்கள்.",
     "போக்குவரத்தை முன்கூட்டியே திட்டமிடுங்கள்: பகலிலும் இரவிலும் மருத்துவமனைக்கு எப்படிச் செல்வீர்கள். உங்கள் பகுதியின் ஆம்புலன்ஸ் எண்ணை MCP அட்டையில் எழுதி வையுங்கள். JSSK திட்டத்தின் கீழ் கர்ப்பிணிகளுக்கு அரசு இலவசப் போக்குவரத்து வழங்குகிறது.",
     "அவசரத்துக்காக பணம் தயாராக வைத்திருங்கள்; இரத்த தானம் செய்யக்கூடிய ஒருவரை முன்பே அடையாளம் காணுங்கள். உங்களுடன் யார் வருவார்கள், வீட்டையும் மற்ற குழந்தைகளையும் யார் கவனிப்பார்கள் என்பதை முடிவு செய்யுங்கள்.",
     "எடுத்துச் செல்லத் தயாராக வையுங்கள்: MCP அட்டை, பாதுகாப்பான தாய்மைக் கையேடு, சுத்தமான துணிகள், உங்களுக்கும் குழந்தைக்கும் சுத்தமான உடைகள், உங்களுக்கும் துணைக்கு வருபவருக்கும் உணவும் தண்ணீரும்.",
     "உங்கள் ஆஷா, ANM அல்லது அங்கன்வாடிப் பணியாளர் மூலம் ஜனனி சுரக்ஷா யோஜனா (JSY)-வில், தகுதி இருந்தால் PMMVY-யிலும் பதிவு செய்யுங்கள் (அரசு உதவிகள் பக்கத்தைப் பார்க்கவும்).",
     "ஒவ்வொரு பரிசோதனையிலும் உங்கள் பிரசவத் திட்டத்தைப் பற்றிப் பேசுங்கள். பிரச்சினை வந்தால் திட்டம் மாறலாம். பிரசவத்துக்குப் பிறகு குறைந்தது 48 மணி நேரம் சுகாதார மையத்தில் தங்கத் திட்டமிடுங்கள்."
    ],
    "te": [
     "కాన్పు ఎక్కడ చేయించుకోవాలో మీ ANM లేదా ఆశాను ముందుగానే అడిగి, ఆసుపత్రిని ముందే నిర్ణయించుకోండి. మీ MCP కార్డుపై ఎరుపు స్టిక్కర్ ఉంటే (అధిక ప్రమాద గర్భం), అత్యవసర పరిస్థితులను నిర్వహించగల ఆసుపత్రిలో, అంటే మొదటి రెఫరల్ యూనిట్ (FRU)లో, కాన్పుకు ప్లాన్ చేసుకోండి.",
     "రవాణాను ముందే ప్లాన్ చేసుకోండి: పగలైనా రాత్రైనా ఆసుపత్రికి ఎలా చేరుకుంటారు. మీ ప్రాంతపు అంబులెన్స్ నంబర్‌ను MCP కార్డులో రాసుకోండి. JSSK పథకం కింద ప్రభుత్వం గర్భిణులకు ఉచిత రవాణా అందిస్తుంది.",
     "అత్యవసరం కోసం డబ్బు సిద్ధంగా ఉంచుకోండి, రక్తదాతను ముందే గుర్తించండి. మీతో ఎవరు వస్తారు, ఇంటిని, ఇతర పిల్లలను ఎవరు చూసుకుంటారు అనేది నిర్ణయించుకోండి.",
     "వెంట తీసుకెళ్ళడానికి సిద్ధంగా ఉంచుకోండి: MCP కార్డు, సురక్షిత మాతృత్వ పుస్తకం, శుభ్రమైన గుడ్డలు, మీకు, బిడ్డకు శుభ్రమైన బట్టలు, మీకు, తోడుగా వచ్చేవారికి ఆహారం, నీరు.",
     "మీ ఆశా, ANM లేదా అంగన్‌వాడీ కార్యకర్త ద్వారా జననీ సురక్ష యోజన (JSY)లో, అర్హత ఉంటే PMMVYలో నమోదు చేయించుకోండి (ప్రభుత్వ సహాయం పేజీ చూడండి).",
     "ప్రతి పరీక్షలో మీ కాన్పు ప్రణాళిక గురించి మాట్లాడండి. సమస్య వస్తే ప్రణాళిక మారవచ్చు. కాన్పు తర్వాత కనీసం 48 గంటలు ఆరోగ్య కేంద్రంలో ఉండేలా ప్లాన్ చేసుకోండి."
    ]
   },
   "seekHelp": {
    "en": [
     "Painful contractions every 20 minutes or less (go to the health facility)",
     "Your water bag breaks or fluid leaks",
     "A bloody, sticky discharge (the ‘show’)",
     "Labour pains or leaking of fluid before 9 months (before 37 weeks): go to a hospital immediately",
     "Heavy vaginal bleeding",
     "Your baby moves less than usual",
     "Labour pains lasting more than 12 hours",
     "Any danger sign: fits, severe headache with blurred vision, severe belly pain, high fever, or fast or difficult breathing"
    ],
    "hi": [
     "हर 20 मिनट या उससे कम अंतर पर दर्द वाले संकुचन (स्वास्थ्य केंद्र जाएँ)",
     "पानी की थैली फटना या पानी रिसना",
     "खून मिला चिपचिपा स्राव (‘शो’)",
     "9 महीने पूरे होने से पहले (37 हफ़्ते से पहले) प्रसव पीड़ा या पानी रिसना: तुरंत अस्पताल जाएँ",
     "योनि से ज़्यादा खून बहना",
     "शिशु की हलचल सामान्य से कम होना",
     "प्रसव पीड़ा 12 घंटे से ज़्यादा चलना",
     "कोई भी खतरे का संकेत: दौरे, तेज़ सिरदर्द के साथ धुंधला दिखना, पेट में तेज़ दर्द, तेज़ बुखार, या साँस तेज़ चलना/साँस लेने में तकलीफ़"
    ],
    "ta": [
     "ஒவ்வொரு 20 நிமிடத்துக்கோ அதற்குக் குறைவான இடைவெளியிலோ வலியுடன் கூடிய சுருக்கங்கள் (சுகாதார மையத்துக்குச் செல்லுங்கள்)",
     "பனிக்குடம் உடைதல் அல்லது நீர் கசிதல்",
     "இரத்தம் கலந்த பிசுபிசுப்பான வெளியேற்றம் (‘ஷோ’)",
     "9 மாதம் முடியும் முன் (37 வாரங்களுக்கு முன்) பிரசவ வலி அல்லது நீர் கசிதல்: உடனே மருத்துவமனைக்குச் செல்லுங்கள்",
     "பிறப்புறுப்பிலிருந்து அதிக இரத்தப்போக்கு",
     "குழந்தையின் அசைவு வழக்கத்தைவிடக் குறைதல்",
     "பிரசவ வலி 12 மணி நேரத்துக்கு மேல் நீடித்தல்",
     "ஏதேனும் ஆபத்து அறிகுறி: வலிப்பு, கடுமையான தலைவலியுடன் பார்வை மங்குதல், வயிற்றில் கடுமையான வலி, அதிகக் காய்ச்சல், அல்லது வேகமான/சிரமமான மூச்சு"
    ],
    "te": [
     "ప్రతి 20 నిమిషాలకు లేదా అంతకంటే తక్కువ వ్యవధికి నొప్పితో కూడిన సంకోచాలు (ఆరోగ్య కేంద్రానికి వెళ్ళండి)",
     "నీటి సంచి పగలడం లేదా నీరు కారడం",
     "రక్తం కలిసిన జిగురు స్రావం (‘షో’)",
     "9 నెలలు నిండకముందే (37 వారాల ముందే) ప్రసవ నొప్పులు లేదా నీరు కారడం: వెంటనే ఆసుపత్రికి వెళ్ళండి",
     "యోని నుండి ఎక్కువగా రక్తస్రావం",
     "బిడ్డ కదలికలు మామూలు కంటే తగ్గడం",
     "ప్రసవ నొప్పులు 12 గంటలకు మించి కొనసాగడం",
     "ఏదైనా ప్రమాద సూచన: మూర్ఛలు, తీవ్రమైన తలనొప్పితో పాటు చూపు మసకబారడం, కడుపులో తీవ్రమైన నొప్పి, తీవ్రమైన జ్వరం, లేదా శ్వాస వేగంగా ఆడటం/కష్టంగా ఉండటం"
    ]
   },
   "keywords": [
    "labour",
    "labor",
    "delivery",
    "birth",
    "pain",
    "labour pain",
    "contractions",
    "water broke",
    "show",
    "hospital bag",
    "bag",
    "what to pack",
    "transport",
    "ambulance",
    "birth plan",
    "institutional delivery",
    "normal delivery",
    "c section",
    "caesarean",
    "pravas",
    "prasav",
    "dard",
    "prasav peeda",
    "due date",
    "edd",
    "blood donor",
    "emergency plan"
   ],
   "sources": [
    {
     "label": "Signs that labour has begun - NHS",
     "publisher": "NHS (UK)",
     "url": "https://www.nhs.uk/pregnancy/labour-and-birth/signs-that-labour-has-begun/"
    },
    {
     "label": "Pregnancy, childbirth, postpartum and newborn care: a guide for essential practice (3rd edition) (PDF)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://iris.who.int/server/api/core/bitstreams/e9f751fd-6eab-42cb-9e0c-0eb86a0365bb/content"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    },
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "What benefits would pregnant women receive (PMSMA)",
     "publisher": "Ministry of Health and Family Welfare, Government of India",
     "url": "https://pmsma.mohfw.gov.in/i-am/pregnant-woman/what-benefits-would-pregnant-women-receive/"
    }
   ]
  },
  {
   "id": "after-birth",
   "category": "baby",
   "title": {
    "en": "After the birth: mother and newborn",
    "hi": "प्रसव के बाद: माँ और नवजात की देखभाल",
    "ta": "பிரசவத்துக்குப் பிறகு: தாய் மற்றும் புதிதாகப் பிறந்த குழந்தை",
    "te": "కాన్పు తర్వాత: తల్లి మరియు నవజాత శిశువు"
   },
   "summary": {
    "en": "The first days after the birth are important for both mother and baby, because most problems happen then. Stay in the health facility for at least 48 hours, and have check-ups on the day of birth, day 3, day 7 and at 6 weeks. This is general information, so please follow the advice of your own care team.",
    "hi": "प्रसव के बाद के पहले दिन माँ और शिशु दोनों के लिए बहुत अहम होते हैं, क्योंकि ज़्यादातर समस्याएँ तभी होती हैं। कम से कम 48 घंटे स्वास्थ्य केंद्र में रुकें, और जन्म के दिन, तीसरे दिन, सातवें दिन और 6 हफ़्ते पर जाँच कराएँ। यह सामान्य जानकारी है, इसलिए कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "பிரசவத்துக்குப் பிந்தைய முதல் நாட்கள் தாய்க்கும் குழந்தைக்கும் மிக முக்கியம்; ஏனெனில் பெரும்பாலான பிரச்சினைகள் அப்போதுதான் ஏற்படுகின்றன. குறைந்தது 48 மணி நேரம் சுகாதார மையத்தில் தங்குங்கள்; பிறந்த நாள், 3-ஆம் நாள், 7-ஆம் நாள், 6-ஆம் வாரம் ஆகியவற்றில் பரிசோதனை செய்துகொள்ளுங்கள். இது பொதுவான தகவல்; எனவே உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "కాన్పు తర్వాత మొదటి రోజులు తల్లికి, బిడ్డకు ఇద్దరికీ చాలా ముఖ్యం, ఎందుకంటే ఎక్కువ సమస్యలు అప్పుడే వస్తాయి. కనీసం 48 గంటలు ఆరోగ్య కేంద్రంలో ఉండండి; పుట్టిన రోజు, 3వ రోజు, 7వ రోజు, 6 వారాల వద్ద పరీక్షలు చేయించుకోండి. ఇది సాధారణ సమాచారం, కాబట్టి దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "For the mother: rest when you can, eat extra healthy food, drink plenty of clean water, and wash daily, especially the genital area. Change pads every 4 to 6 hours.",
     "Start breastfeeding within one hour of birth. The first milk (colostrum) is full of protection against infections. Give only breast milk for the first six months, and no water, honey or gripe water. Breastfeed whenever the baby wants.",
     "Newborn care: dry and wrap the baby straight after birth, and keep the head and feet covered and the baby warm. Do not bathe the baby for the first 48 hours. Keep the cord stump clean and dry, and put nothing on it.",
     "Take your baby for vaccines: the booklet lists BCG, polio and, where recommended, hepatitis B at birth. Then follow the immunisation schedule on the MCP card.",
     "Family planning: you can become pregnant again within weeks of the birth if you are not exclusively breastfeeding. A gap of at least two years before the next pregnancy is good for you and the baby. Talk to your ANM about the choices.",
     "Continue the iron-folic acid and calcium tablets after the birth as advised by your doctor or ANM, and keep eating well."
    ],
    "hi": [
     "माँ के लिए: जब भी हो सके आराम करें, ज़्यादा पौष्टिक खाना खाएँ, खूब साफ़ पानी पिएँ, और रोज़ नहाएँ, खासकर जननांग क्षेत्र को साफ़ रखें। पैड हर 4 से 6 घंटे में बदलें।",
     "जन्म के एक घंटे के अंदर स्तनपान शुरू करें। पहला दूध (खीस/कोलोस्ट्रम) संक्रमणों से बचाने वाले तत्वों से भरपूर होता है। पहले छह महीने सिर्फ़ माँ का दूध दें; पानी, शहद या घुट्टी (ग्राइप वॉटर) न दें। जब भी शिशु माँगे, दूध पिलाएँ।",
     "नवजात की देखभाल: जन्म के तुरंत बाद शिशु को पोंछकर कपड़े में लपेट दें, सिर और पैर ढके रखें और उसे गरम रखें। पहले 48 घंटे तक नहलाएँ नहीं। नाभि की डंडी (कॉर्ड) को साफ़ और सूखा रखें, उस पर कुछ न लगाएँ।",
     "शिशु को टीके लगवाएँ: पुस्तिका के अनुसार जन्म के समय BCG, पोलियो और, जहाँ सिफ़ारिश हो, हेपेटाइटिस-बी का टीका लगता है। उसके बाद MCP कार्ड में दिया टीकाकरण कार्यक्रम अपनाएँ।",
     "परिवार नियोजन: अगर आप सिर्फ़ स्तनपान नहीं करा रहीं तो प्रसव के कुछ ही हफ़्तों में फिर गर्भवती हो सकती हैं। अगली गर्भावस्था से पहले कम से कम दो साल का अंतर आपके और शिशु के लिए अच्छा है। विकल्पों के बारे में अपनी ANM से बात करें।",
     "प्रसव के बाद भी आयरन-फोलिक एसिड और कैल्शियम की गोलियाँ अपने डॉक्टर या ANM की सलाह के अनुसार जारी रखें, और अच्छा खाना खाती रहें।"
    ],
    "ta": [
     "தாய்க்கு: முடிந்தபோது ஓய்வெடுங்கள், கூடுதல் சத்தான உணவு உண்ணுங்கள், நிறையச் சுத்தமான தண்ணீர் குடியுங்கள், தினமும் குளியுங்கள், குறிப்பாக பிறப்புறுப்புப் பகுதியைச் சுத்தமாக வைத்திருங்கள். நாப்கினை 4 முதல் 6 மணி நேரத்துக்கு ஒருமுறை மாற்றுங்கள்.",
     "பிறந்த ஒரு மணி நேரத்துக்குள் தாய்ப்பால் கொடுக்கத் தொடங்குங்கள். முதல் பால் (சீம்பால்) தொற்றுகளிலிருந்து பாதுகாக்கும் சத்துகள் நிறைந்தது. முதல் ஆறு மாதங்கள் தாய்ப்பால் மட்டுமே கொடுங்கள்; தண்ணீர், தேன், கிரைப் வாட்டர் எதுவும் வேண்டாம். குழந்தை கேட்கும்போதெல்லாம் பால் கொடுங்கள்.",
     "பிறந்த குழந்தையின் பராமரிப்பு: பிறந்தவுடனே குழந்தையைத் துடைத்து துணியில் சுற்றுங்கள்; தலையையும் பாதங்களையும் மூடி, குழந்தையைக் கதகதப்பாக வையுங்கள். முதல் 48 மணி நேரம் குளிப்பாட்டாதீர்கள். தொப்புள் கொடிக் காம்பைச் சுத்தமாகவும் உலர்வாகவும் வையுங்கள்; அதன் மேல் எதையும் தடவாதீர்கள்.",
     "குழந்தைக்குத் தடுப்பூசிகள் போடுங்கள்: கையேட்டின்படி பிறக்கும்போது BCG, போலியோ, பரிந்துரைக்கப்பட்ட இடங்களில் ஹெபடைடிஸ் பி ஆகியவை போடப்படும். பிறகு MCP அட்டையில் உள்ள தடுப்பூசி அட்டவணையைப் பின்பற்றுங்கள்.",
     "குடும்பக் கட்டுப்பாடு: தாய்ப்பால் மட்டுமே கொடுக்கவில்லை என்றால், பிரசவத்துக்குப் பின் சில வாரங்களிலேயே மீண்டும் கர்ப்பமாகலாம். அடுத்த கர்ப்பத்துக்கு முன் குறைந்தது இரண்டு ஆண்டு இடைவெளி உங்களுக்கும் குழந்தைக்கும் நல்லது. விருப்பங்களைப் பற்றி உங்கள் ANM-இடம் பேசுங்கள்.",
     "பிரசவத்துக்குப் பிறகும் இரும்பு-ஃபோலிக் அமிலம், கால்சியம் மாத்திரைகளை உங்கள் மருத்துவர் அல்லது ANM கூறியபடி தொடருங்கள்; தொடர்ந்து நன்றாகச் சாப்பிடுங்கள்."
    ],
    "te": [
     "తల్లికి: వీలైనప్పుడు విశ్రాంతి తీసుకోండి, అదనపు పౌష్టికాహారం తినండి, శుభ్రమైన నీరు బాగా తాగండి, రోజూ స్నానం చేయండి, ముఖ్యంగా జననేంద్రియ ప్రాంతాన్ని శుభ్రంగా ఉంచండి. ప్యాడ్‌ను ప్రతి 4 నుండి 6 గంటలకు మార్చండి.",
     "పుట్టిన ఒక గంటలోపు తల్లిపాలు ఇవ్వడం మొదలుపెట్టండి. మొదటి పాలు (ముర్రుపాలు) ఇన్ఫెక్షన్ల నుండి కాపాడే పదార్థాలతో నిండి ఉంటాయి. మొదటి ఆరు నెలలు తల్లిపాలు మాత్రమే ఇవ్వండి; నీరు, తేనె, గ్రైప్ వాటర్ ఇవ్వకండి. బిడ్డ అడిగినప్పుడల్లా పాలు ఇవ్వండి.",
     "నవజాత శిశువు సంరక్షణ: పుట్టిన వెంటనే బిడ్డను తుడిచి గుడ్డలో చుట్టండి; తల, పాదాలను కప్పి వెచ్చగా ఉంచండి. మొదటి 48 గంటలు స్నానం చేయించకండి. బొడ్డు తాడు మొదలును శుభ్రంగా, పొడిగా ఉంచండి; దానిపై ఏమీ రాయకండి.",
     "బిడ్డకు టీకాలు వేయించండి: పుస్తకం ప్రకారం పుట్టినప్పుడు BCG, పోలియో, సిఫార్సు ఉన్నచోట హెపటైటిస్ బి టీకాలు వేస్తారు. తర్వాత MCP కార్డులోని టీకా షెడ్యూల్ పాటించండి.",
     "కుటుంబ నియంత్రణ: మీరు తల్లిపాలు మాత్రమే ఇవ్వకపోతే, కాన్పు తర్వాత కొన్ని వారాల్లోనే మళ్ళీ గర్భం దాల్చవచ్చు. తదుపరి గర్భానికి ముందు కనీసం రెండు సంవత్సరాల విరామం మీకు, బిడ్డకు మంచిది. ఎంపికల గురించి మీ ANMతో మాట్లాడండి.",
     "కాన్పు తర్వాత కూడా ఐరన్-ఫోలిక్ యాసిడ్, కాల్షియం మాత్రలను మీ డాక్టర్ లేదా ANM చెప్పినట్లు కొనసాగించండి, బాగా తింటూ ఉండండి."
    ]
   },
   "seekHelp": {
    "en": [
     "Mother: heavy bleeding, or bleeding that is getting more",
     "Mother: fits, or a severe headache with blurred vision",
     "Mother: fast or difficult breathing, chest pain, or fainting",
     "Mother: fever, or smelly vaginal discharge",
     "Mother: pain, redness or swelling in the calf of the leg",
     "Baby: difficulty breathing or fast breathing, or fits",
     "Baby: not feeding or unable to suck, fever or feeling cold, or very sleepy and dull",
     "Baby: yellow skin or eyes, a red cord stump or one with pus, bleeding, or diarrhoea"
    ],
    "hi": [
     "माँ: बहुत ज़्यादा खून बहना, या खून बहना बढ़ते जाना",
     "माँ: दौरे पड़ना, या तेज़ सिरदर्द के साथ धुंधला दिखना",
     "माँ: साँस तेज़ चलना या साँस लेने में तकलीफ़, सीने में दर्द, या बेहोशी",
     "माँ: बुखार, या योनि से बदबूदार स्राव",
     "माँ: पिंडली में दर्द, लालिमा या सूजन",
     "शिशु: साँस लेने में तकलीफ़ या तेज़ साँस, या दौरे",
     "शिशु: दूध न पीना या चूस न पाना, बुखार या शरीर ठंडा लगना, या बहुत सुस्त और बेदम रहना",
     "शिशु: त्वचा या आँखों का पीला पड़ना, नाभि की डंडी लाल होना या उसमें मवाद आना, खून आना, या दस्त"
    ],
    "ta": [
     "தாய்: அதிக இரத்தப்போக்கு, அல்லது இரத்தப்போக்கு அதிகரித்துக்கொண்டே போதல்",
     "தாய்: வலிப்பு, அல்லது கடுமையான தலைவலியுடன் பார்வை மங்குதல்",
     "தாய்: வேகமான அல்லது சிரமமான மூச்சு, நெஞ்சு வலி, அல்லது மயக்கம்",
     "தாய்: காய்ச்சல், அல்லது துர்நாற்றமுள்ள பிறப்புறுப்பு வெளியேற்றம்",
     "தாய்: கெண்டைக்காலில் வலி, சிவப்பு அல்லது வீக்கம்",
     "குழந்தை: மூச்சுவிடச் சிரமம் அல்லது வேகமான மூச்சு, அல்லது வலிப்பு",
     "குழந்தை: பால் குடிக்காமல் இருத்தல் அல்லது உறிஞ்ச முடியாமை, காய்ச்சல் அல்லது உடல் குளிர்ந்து இருத்தல், அல்லது மிகவும் தூக்கக் கலக்கத்துடனும் சோர்வுடனும் இருத்தல்",
     "குழந்தை: தோல் அல்லது கண்கள் மஞ்சளாதல், தொப்புள் கொடிக் காம்பு சிவந்திருத்தல் அல்லது சீழ் இருத்தல், இரத்தப்போக்கு, அல்லது வயிற்றுப்போக்கு"
    ],
    "te": [
     "తల్లి: ఎక్కువ రక్తస్రావం, లేదా రక్తస్రావం పెరుగుతూ ఉండటం",
     "తల్లి: మూర్ఛలు, లేదా తీవ్రమైన తలనొప్పితో పాటు చూపు మసకబారడం",
     "తల్లి: శ్వాస వేగంగా ఆడటం లేదా శ్వాస తీసుకోవడం కష్టంగా ఉండటం, ఛాతీ నొప్పి, లేదా స్పృహ తప్పడం",
     "తల్లి: జ్వరం, లేదా యోని నుండి దుర్వాసనతో స్రావం",
     "తల్లి: పిక్కలో నొప్పి, ఎరుపు లేదా వాపు",
     "బిడ్డ: శ్వాస తీసుకోవడంలో ఇబ్బంది లేదా వేగంగా శ్వాస, లేదా మూర్ఛలు",
     "బిడ్డ: పాలు తాగకపోవడం లేదా పీల్చలేకపోవడం, జ్వరం లేదా ఒళ్ళు చల్లగా ఉండటం, లేదా చాలా నిద్రమత్తుగా, నిస్త్రాణంగా ఉండటం",
     "బిడ్డ: చర్మం లేదా కళ్ళు పసుపు రంగులోకి మారడం, బొడ్డు తాడు మొదలు ఎర్రగా ఉండటం లేదా చీము రావడం, రక్తస్రావం, లేదా విరేచనాలు"
    ]
   },
   "keywords": [
    "after delivery",
    "postpartum",
    "postnatal",
    "newborn",
    "new born",
    "baby care",
    "breastfeeding",
    "breast feeding",
    "feeding",
    "milk",
    "colostrum",
    "khees",
    "doodh",
    "cord",
    "nabhi",
    "jaundice",
    "peelia",
    "bleeding after delivery",
    "stitches",
    "family planning",
    "contraception",
    "vaccination baby",
    "bcg",
    "after birth",
    "prasav ke baad",
    "delivery ke baad",
    "bath baby",
    "mother care"
   ],
   "sources": [
    {
     "label": "Booklet for expecting mothers (My Safe Motherhood Booklet)",
     "publisher": "Maternal Health Division, Ministry of Health and Family Welfare, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/my_safe_motherhood_booklet_english.pdf"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    },
    {
     "label": "Pregnancy, childbirth, postpartum and newborn care: a guide for essential practice (3rd edition) (PDF)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://iris.who.int/server/api/core/bitstreams/e9f751fd-6eab-42cb-9e0c-0eb86a0365bb/content"
    },
    {
     "label": "Infant and young child feeding (fact sheet)",
     "publisher": "World Health Organization (WHO)",
     "url": "https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding"
    }
   ]
  },
  {
   "id": "schemes-and-entitlements",
   "category": "support",
   "title": {
    "en": "Government support for mothers",
    "hi": "माताओं के लिए सरकारी सहायता",
    "ta": "தாய்மார்களுக்கான அரசு உதவிகள்",
    "te": "తల్లులకు ప్రభుత్వ సహాయం"
   },
   "summary": {
    "en": "The Government of India has schemes that give free care and some cash support to mothers. Ask your ASHA, ANM or the nearest government health facility how to register. Rules and amounts can change and can differ by state, so this is general information; please follow the advice of your own care team.",
    "hi": "भारत सरकार की कुछ योजनाएँ माताओं को मुफ़्त देखभाल और कुछ नकद सहायता देती हैं। पंजीकरण कैसे कराना है, यह अपनी आशा, ANM या नज़दीकी सरकारी स्वास्थ्य केंद्र से पूछें। नियम और राशि बदल सकते हैं और राज्य के अनुसार अलग हो सकते हैं, इसलिए यह सामान्य जानकारी है; कृपया अपनी देखभाल टीम की सलाह मानें।",
    "ta": "இந்திய அரசின் சில திட்டங்கள் தாய்மார்களுக்கு இலவசப் பராமரிப்பையும் சிறிது பண உதவியையும் வழங்குகின்றன. எப்படிப் பதிவு செய்வது என்று உங்கள் ஆஷா, ANM அல்லது அருகிலுள்ள அரசு சுகாதார மையத்தில் கேளுங்கள். விதிமுறைகளும் தொகைகளும் மாறலாம், மாநிலத்துக்கு மாநிலம் வேறுபடலாம்; எனவே இது பொதுவான தகவல்; உங்கள் பராமரிப்புக் குழுவின் ஆலோசனையைப் பின்பற்றுங்கள்.",
    "te": "భారత ప్రభుత్వ పథకాలు తల్లులకు ఉచిత సంరక్షణ, కొంత నగదు సహాయం అందిస్తాయి. ఎలా నమోదు చేయించుకోవాలో మీ ఆశా, ANM లేదా దగ్గరలోని ప్రభుత్వ ఆరోగ్య కేంద్రాన్ని అడగండి. నియమాలు, మొత్తాలు మారవచ్చు, రాష్ట్రాన్ని బట్టి వేరుగా ఉండవచ్చు; కాబట్టి ఇది సాధారణ సమాచారం; దయచేసి మీ సంరక్షణ బృందం సలహాను పాటించండి."
   },
   "keyPoints": {
    "en": [
     "Janani Suraksha Yojana (JSY) is a safe-motherhood scheme under the National Health Mission. It gives cash help to eligible women who give birth in a government (or accredited private) health facility. Who is eligible and how much is paid differ by state and by rural or urban area. ASHA workers help women register and reach the facility.",
     "Janani Shishu Suraksha Karyakram (JSSK) gives free services in government health facilities: delivery including caesarean, medicines, tests, blood, and food during the hospital stay (3 days after a normal delivery, 7 days after a caesarean). It also covers free transport from home to the hospital, between hospitals, and back home, and free treatment for sick newborns up to one year.",
     "In many states, the 102 ambulance service is meant mainly for pregnant women and children, and 108 is for emergencies. Availability differs by state, so ask what works in your state.",
     "Pradhan Mantri Matru Vandana Yojana (PMMVY) is a cash support scheme from the Ministry of Women and Child Development for pregnant women and new mothers. The MCP card says registration is done at the Anganwadi Centre or an approved health facility. Amounts can change, so check with your ASHA or Anganwadi worker.",
     "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA) offers free check-ups by a doctor on the 9th of every month at designated government facilities.",
     "How to ask: tell your ASHA, ANM or Anganwadi worker early in pregnancy, or go to the nearest government health facility. Carry your MCP card, ID and bank account details."
    ],
    "hi": [
     "जननी सुरक्षा योजना (JSY) राष्ट्रीय स्वास्थ्य मिशन के तहत सुरक्षित मातृत्व की योजना है। इसमें सरकारी (या मान्यता प्राप्त निजी) स्वास्थ्य केंद्र में प्रसव कराने वाली पात्र महिलाओं को नकद सहायता मिलती है। कौन पात्र है और कितनी राशि मिलती है, यह राज्य और ग्रामीण या शहरी क्षेत्र के अनुसार अलग है। आशा कार्यकर्ता महिलाओं को पंजीकरण कराने और स्वास्थ्य केंद्र पहुँचने में मदद करती हैं।",
     "जननी शिशु सुरक्षा कार्यक्रम (JSSK) में सरकारी स्वास्थ्य केंद्रों में मुफ़्त सेवाएँ मिलती हैं: सिज़ेरियन सहित प्रसव, दवाएँ, जाँचें, खून, और अस्पताल में रहने के दौरान भोजन (सामान्य प्रसव के बाद 3 दिन, सिज़ेरियन के बाद 7 दिन)। इसमें घर से अस्पताल, एक अस्पताल से दूसरे अस्पताल और वापस घर तक मुफ़्त परिवहन, और एक साल तक के बीमार नवजात शिशुओं का मुफ़्त इलाज भी शामिल है।",
     "कई राज्यों में 102 एंबुलेंस सेवा मुख्य रूप से गर्भवती महिलाओं और बच्चों के लिए है, और 108 आपात स्थितियों के लिए। उपलब्धता राज्य के अनुसार अलग है, इसलिए अपने राज्य में क्या चलता है, यह पूछ लें।",
     "प्रधानमंत्री मातृ वंदना योजना (PMMVY) महिला एवं बाल विकास मंत्रालय की नकद सहायता योजना है, जो गर्भवती महिलाओं और नई माँओं के लिए है। MCP कार्ड के अनुसार पंजीकरण आँगनवाड़ी केंद्र या मान्यता प्राप्त स्वास्थ्य केंद्र में होता है। राशि बदल सकती है; अपनी आशा या आँगनवाड़ी कार्यकर्ता से पूछ लें।",
     "प्रधानमंत्री सुरक्षित मातृत्व अभियान (PMSMA) में तय सरकारी केंद्रों पर हर महीने की 9 तारीख को डॉक्टर द्वारा मुफ़्त जाँच होती है।",
     "कैसे पूछें: गर्भावस्था की शुरुआत में ही अपनी आशा, ANM या आँगनवाड़ी कार्यकर्ता को बताएँ, या नज़दीकी सरकारी स्वास्थ्य केंद्र जाएँ। अपना MCP कार्ड, पहचान पत्र और बैंक खाते की जानकारी साथ रखें।"
    ],
    "ta": [
     "ஜனனி சுரக்ஷா யோஜனா (JSY) தேசிய சுகாதார இயக்கத்தின் கீழ் உள்ள பாதுகாப்பான தாய்மைத் திட்டம். அரசு (அல்லது அங்கீகரிக்கப்பட்ட தனியார்) சுகாதார மையத்தில் பிரசவிக்கும் தகுதியுள்ள பெண்களுக்கு இது பண உதவி வழங்குகிறது. யார் தகுதி பெறுவார்கள், எவ்வளவு வழங்கப்படும் என்பது மாநிலத்துக்கும் கிராமம்/நகரம் என்பதற்கும் ஏற்ப மாறுபடும். பெண்கள் பதிவு செய்யவும் சுகாதார மையத்தை அடையவும் ஆஷா பணியாளர்கள் உதவுகிறார்கள்.",
     "ஜனனி சிசு சுரக்ஷா கார்யக்ரம் (JSSK) அரசு சுகாதார மையங்களில் இலவச சேவைகளை வழங்குகிறது: சிசேரியன் உட்பட பிரசவம், மருந்துகள், பரிசோதனைகள், இரத்தம், மருத்துவமனையில் தங்கும் காலத்தில் உணவு (சாதாரணப் பிரசவத்துக்குப் பிறகு 3 நாட்கள், சிசேரியனுக்குப் பிறகு 7 நாட்கள்). வீட்டிலிருந்து மருத்துவமனைக்கும், மருத்துவமனைகளுக்கு இடையிலும், மீண்டும் வீட்டுக்கும் இலவசப் போக்குவரத்து, ஒரு வயது வரை நோயுற்ற பிறந்த குழந்தைகளுக்கு இலவச சிகிச்சை ஆகியவையும் இதில் அடங்கும்.",
     "பல மாநிலங்களில் 102 ஆம்புலன்ஸ் சேவை முக்கியமாக கர்ப்பிணிகள் மற்றும் குழந்தைகளுக்கானது; 108 அவசர நிலைகளுக்கானது. இந்த வசதி மாநிலத்துக்கு மாநிலம் மாறுபடும்; உங்கள் மாநிலத்தில் எது செயல்படுகிறது என்று கேட்டு அறிந்துகொள்ளுங்கள்.",
     "பிரதம மந்திரி மாத்ரு வந்தனா யோஜனா (PMMVY) மகளிர் மற்றும் குழந்தை மேம்பாட்டு அமைச்சகத்தின் பண உதவித் திட்டம்; கர்ப்பிணிகளுக்கும் புதிய தாய்மார்களுக்கும் உரியது. MCP அட்டையின்படி, பதிவு அங்கன்வாடி மையத்தில் அல்லது அங்கீகரிக்கப்பட்ட சுகாதார மையத்தில் செய்யப்படுகிறது. தொகை மாறலாம்; உங்கள் ஆஷா அல்லது அங்கன்வாடிப் பணியாளரிடம் கேளுங்கள்.",
     "பிரதம மந்திரி சுரக்ஷித் மாத்ரித்வ அபியான் (PMSMA) திட்டத்தில் குறிப்பிட்ட அரசு மையங்களில் ஒவ்வொரு மாதமும் 9-ஆம் தேதி மருத்துவரால் இலவசப் பரிசோதனை வழங்கப்படுகிறது.",
     "எப்படிக் கேட்பது: கர்ப்பத்தின் தொடக்கத்திலேயே உங்கள் ஆஷா, ANM அல்லது அங்கன்வாடிப் பணியாளரிடம் சொல்லுங்கள், அல்லது அருகிலுள்ள அரசு சுகாதார மையத்துக்குச் செல்லுங்கள். உங்கள் MCP அட்டை, அடையாள அட்டை, வங்கிக் கணக்கு விவரங்களை எடுத்துச் செல்லுங்கள்."
    ],
    "te": [
     "జననీ సురక్ష యోజన (JSY) జాతీయ ఆరోగ్య మిషన్ కింద సురక్షిత మాతృత్వ పథకం. ప్రభుత్వ (లేదా గుర్తింపు పొందిన ప్రైవేట్) ఆరోగ్య కేంద్రంలో కాన్పు చేయించుకునే అర్హులైన మహిళలకు ఇది నగదు సహాయం ఇస్తుంది. ఎవరు అర్హులు, ఎంత చెల్లిస్తారు అనేది రాష్ట్రాన్ని బట్టి, గ్రామీణ లేదా పట్టణ ప్రాంతాన్ని బట్టి మారుతుంది. మహిళలు నమోదు చేయించుకోవడానికి, ఆరోగ్య కేంద్రానికి చేరుకోవడానికి ఆశా కార్యకర్తలు సహాయం చేస్తారు.",
     "జననీ శిశు సురక్ష కార్యక్రమం (JSSK) ప్రభుత్వ ఆరోగ్య కేంద్రాల్లో ఉచిత సేవలు ఇస్తుంది: సిజేరియన్ సహా కాన్పు, మందులు, పరీక్షలు, రక్తం, ఆసుపత్రిలో ఉన్న సమయంలో ఆహారం (సాధారణ కాన్పు తర్వాత 3 రోజులు, సిజేరియన్ తర్వాత 7 రోజులు). ఇంటి నుండి ఆసుపత్రికి, ఆసుపత్రుల మధ్య, తిరిగి ఇంటికి ఉచిత రవాణా, ఒక సంవత్సరం వరకు అనారోగ్యంగా ఉన్న నవజాత శిశువులకు ఉచిత చికిత్స కూడా ఇందులో ఉన్నాయి.",
     "చాలా రాష్ట్రాల్లో 102 అంబులెన్స్ సేవ ప్రధానంగా గర్భిణులు, పిల్లల కోసం, 108 అత్యవసర పరిస్థితుల కోసం. ఈ సౌకర్యం రాష్ట్రాన్ని బట్టి మారుతుంది; మీ రాష్ట్రంలో ఏది పనిచేస్తుందో అడిగి తెలుసుకోండి.",
     "ప్రధానమంత్రి మాతృ వందన యోజన (PMMVY) మహిళా శిశు అభివృద్ధి మంత్రిత్వ శాఖ నగదు సహాయ పథకం; ఇది గర్భిణులకు, కొత్త తల్లులకు. MCP కార్డు ప్రకారం నమోదు అంగన్‌వాడీ కేంద్రంలో లేదా ఆమోదిత ఆరోగ్య కేంద్రంలో జరుగుతుంది. మొత్తం మారవచ్చు; మీ ఆశా లేదా అంగన్‌వాడీ కార్యకర్తను అడగండి.",
     "ప్రధానమంత్రి సురక్షిత మాతృత్వ అభియాన్ (PMSMA)లో నిర్దేశిత ప్రభుత్వ కేంద్రాల్లో ప్రతి నెలా 9వ తేదీన డాక్టర్ ఉచితంగా పరీక్షలు చేస్తారు.",
     "ఎలా అడగాలి: గర్భం తొలినాళ్ళలోనే మీ ఆశా, ANM లేదా అంగన్‌వాడీ కార్యకర్తకు చెప్పండి, లేదా దగ్గరలోని ప్రభుత్వ ఆరోగ్య కేంద్రానికి వెళ్ళండి. మీ MCP కార్డు, గుర్తింపు కార్డు, బ్యాంకు ఖాతా వివరాలు వెంట తీసుకెళ్ళండి."
    ]
   },
   "seekHelp": {
    "en": [],
    "hi": [],
    "ta": [],
    "te": []
   },
   "keywords": [
    "jsy",
    "janani suraksha",
    "jssk",
    "janani shishu",
    "pmmvy",
    "matru vandana",
    "free delivery",
    "cash",
    "money",
    "paise",
    "scheme",
    "yojana",
    "government scheme",
    "free ambulance",
    "102",
    "108",
    "benefit",
    "anganwadi",
    "asha",
    "anm",
    "pmsma",
    "free treatment",
    "cashless",
    "entitlement",
    "sarkari yojana",
    "mat vandana"
   ],
   "sources": [
    {
     "label": "Janani Suraksha Yojana :: National Health Mission",
     "publisher": "National Health Mission, Ministry of Health and Family Welfare, Government of India",
     "url": "https://nhm.gov.in/index1.php?lang=1&level=3&lid=309&sublinkid=841"
    },
    {
     "label": "Janani-Shishu Suraksha Karyakram :: National Health Mission",
     "publisher": "National Health Mission, Ministry of Health and Family Welfare, Government of India",
     "url": "https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=842&lid=308"
    },
    {
     "label": "ERS/Patient Transport Service :: National Health Mission",
     "publisher": "National Health Mission, Ministry of Health and Family Welfare, Government of India",
     "url": "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=1217&lid=189"
    },
    {
     "label": "Foundations of Women Empowerment (PIB Backgrounder, posted 06 March 2026)",
     "publisher": "Press Information Bureau, Government of India",
     "url": "https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2235796&reg=3&lang=1"
    },
    {
     "label": "Pradhan Mantri Matru Vandana Yojana - Home",
     "publisher": "Ministry of Women and Child Development, Government of India",
     "url": "https://pmmvy.wcd.gov.in/"
    },
    {
     "label": "Mother and Child Protection Card (MCP Card), 2018 version",
     "publisher": "Ministry of Health and Family Welfare and Ministry of Women and Child Development, Government of India (hosted by NHM)",
     "url": "https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-&-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-(28-05-2018).pdf"
    },
    {
     "label": "Pradhan Mantri Surakshit Matritva Abhiyan | PMSMA",
     "publisher": "Ministry of Health and Family Welfare, Government of India",
     "url": "https://pmsma.mohfw.gov.in/"
    }
   ]
  }
 ],
 "helplines": [
  {
   "number": "112",
   "label": {
    "en": "National emergency number",
    "hi": "राष्ट्रीय आपातकालीन नंबर",
    "ta": "தேசிய அவசர எண்",
    "te": "జాతీయ అత్యవసర నంబర్"
   },
   "note": {
    "en": "A single emergency number for police, fire, health and other emergencies. The government says it connects callers to an Emergency Response Centre in the state. It started in different states at different times, so availability can differ by state.",
    "hi": "पुलिस, फायर, स्वास्थ्य और अन्य आपात स्थितियों के लिए एक ही आपातकालीन नंबर। सरकार के अनुसार यह कॉल करने वाले को राज्य के आपातकालीन प्रतिक्रिया केंद्र से जोड़ता है। यह अलग-अलग राज्यों में अलग-अलग समय पर शुरू हुआ, इसलिए उपलब्धता राज्य के अनुसार अलग हो सकती है।",
    "ta": "காவல், தீயணைப்பு, சுகாதாரம் மற்றும் பிற அவசரநிலைகளுக்கான ஒரே அவசர எண். இது அழைப்பவரை மாநிலத்தின் அவசரகால மறுமொழி மையத்துடன் இணைக்கும் என்று அரசு கூறுகிறது. இது வெவ்வேறு மாநிலங்களில் வெவ்வேறு காலங்களில் தொடங்கப்பட்டது; எனவே இந்தச் சேவை மாநிலத்துக்கு மாநிலம் மாறுபடலாம்.",
    "te": "పోలీసు, అగ్నిమాపక, ఆరోగ్యం మరియు ఇతర అత్యవసరాల కోసం ఒకే అత్యవసర నంబర్. ఇది కాల్ చేసినవారిని రాష్ట్రంలోని అత్యవసర స్పందన కేంద్రానికి కలుపుతుందని ప్రభుత్వం చెబుతోంది. ఇది వేర్వేరు రాష్ట్రాల్లో వేర్వేరు సమయాల్లో మొదలైంది; కాబట్టి లభ్యత రాష్ట్రాన్ని బట్టి మారవచ్చు."
   },
   "source": {
    "label": "Pan-India Emergency Number '112' launched (PIB, Ministry of Home Affairs)",
    "url": "https://www.pib.gov.in/newsite/PrintRelease.aspx?relid=188727&reg=3&lang=2"
   }
  },
  {
   "number": "108",
   "label": {
    "en": "Emergency ambulance",
    "hi": "आपातकालीन एंबुलेंस",
    "ta": "அவசர ஆம்புலன்ஸ்",
    "te": "అత్యవసర అంబులెన్స్"
   },
   "note": {
    "en": "The National Health Mission describes Dial 108 as mainly an emergency response service for serious illness, accidents and trauma. Availability can differ by state.",
    "hi": "राष्ट्रीय स्वास्थ्य मिशन के अनुसार 108 मुख्य रूप से गंभीर बीमारी, दुर्घटना और चोट जैसी आपात स्थितियों के लिए सेवा है। उपलब्धता राज्य के अनुसार अलग हो सकती है।",
    "ta": "தேசிய சுகாதார இயக்கத்தின்படி, 108 என்பது முக்கியமாக தீவிர நோய், விபத்து, காயம் போன்ற அவசர நிலைகளுக்கான சேவை. இந்தச் சேவை மாநிலத்துக்கு மாநிலம் மாறுபடலாம்.",
    "te": "జాతీయ ఆరోగ్య మిషన్ ప్రకారం 108 ప్రధానంగా తీవ్రమైన అనారోగ్యం, ప్రమాదాలు, గాయాల వంటి అత్యవసరాల కోసం సేవ. లభ్యత రాష్ట్రాన్ని బట్టి మారవచ్చు."
   },
   "source": {
    "label": "ERS/Patient Transport Service :: National Health Mission",
    "url": "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=1217&lid=189"
   }
  },
  {
   "number": "102",
   "label": {
    "en": "Ambulance for pregnant women and children (free JSSK transport)",
    "hi": "गर्भवती महिलाओं और बच्चों के लिए एंबुलेंस (JSSK के तहत मुफ़्त परिवहन)",
    "ta": "கர்ப்பிணிகள் மற்றும் குழந்தைகளுக்கான ஆம்புலன்ஸ் (JSSK இலவசப் போக்குவரத்து)",
    "te": "గర్భిణులు, పిల్లల కోసం అంబులెన్స్ (JSSK ఉచిత రవాణా)"
   },
   "note": {
    "en": "The National Health Mission says Dial 102 is basic patient transport, mainly for pregnant women and children. It is the key service for free JSSK transport: home to hospital, between hospitals, and back home. Availability can differ by state.",
    "hi": "राष्ट्रीय स्वास्थ्य मिशन के अनुसार 102 बुनियादी रोगी परिवहन सेवा है, जो मुख्य रूप से गर्भवती महिलाओं और बच्चों के लिए है। JSSK के तहत मुफ़्त परिवहन (घर से अस्पताल, अस्पतालों के बीच, और वापस घर) की मुख्य सेवा यही है। उपलब्धता राज्य के अनुसार अलग हो सकती है।",
    "ta": "தேசிய சுகாதார இயக்கத்தின்படி, 102 என்பது அடிப்படை நோயாளிப் போக்குவரத்துச் சேவை; முக்கியமாக கர்ப்பிணிகள், குழந்தைகளுக்கானது. JSSK-இன் கீழ் இலவசப் போக்குவரத்துக்கு (வீட்டிலிருந்து மருத்துவமனைக்கு, மருத்துவமனைகளுக்கு இடையில், மீண்டும் வீட்டுக்கு) இதுவே முக்கிய சேவை. இந்தச் சேவை மாநிலத்துக்கு மாநிலம் மாறுபடலாம்.",
    "te": "జాతీయ ఆరోగ్య మిషన్ ప్రకారం 102 ప్రాథమిక రోగి రవాణా సేవ; ప్రధానంగా గర్భిణులు, పిల్లల కోసం. JSSK కింద ఉచిత రవాణాకు (ఇంటి నుండి ఆసుపత్రికి, ఆసుపత్రుల మధ్య, తిరిగి ఇంటికి) ఇదే ముఖ్యమైన సేవ. లభ్యత రాష్ట్రాన్ని బట్టి మారవచ్చు."
   },
   "source": {
    "label": "ERS/Patient Transport Service :: National Health Mission",
    "url": "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=1217&lid=189"
   }
  },
  {
   "number": "181",
   "label": {
    "en": "Women Helpline",
    "hi": "महिला हेल्पलाइन",
    "ta": "பெண்கள் உதவி எண்",
    "te": "మహిళా హెల్ప్‌లైన్"
   },
   "note": {
    "en": "Run by the Ministry of Women and Child Development. It gives 24-hour emergency and non-emergency help to women, links them to police, hospitals and other services, and gives information about schemes for women. Availability can differ by state.",
    "hi": "महिला एवं बाल विकास मंत्रालय द्वारा संचालित। यह महिलाओं को 24 घंटे आपातकालीन और गैर-आपातकालीन मदद देती है, उन्हें पुलिस, अस्पताल और अन्य सेवाओं से जोड़ती है, और महिलाओं की योजनाओं की जानकारी देती है। उपलब्धता राज्य के अनुसार अलग हो सकती है।",
    "ta": "மகளிர் மற்றும் குழந்தை மேம்பாட்டு அமைச்சகம் நடத்துகிறது. பெண்களுக்கு 24 மணி நேரமும் அவசர மற்றும் அவசரமற்ற உதவி வழங்குகிறது; காவல்துறை, மருத்துவமனைகள், பிற சேவைகளுடன் இணைக்கிறது; பெண்களுக்கான திட்டங்கள் பற்றிய தகவலையும் தருகிறது. இந்தச் சேவை மாநிலத்துக்கு மாநிலம் மாறுபடலாம்.",
    "te": "మహిళా శిశు అభివృద్ధి మంత్రిత్వ శాఖ నిర్వహిస్తోంది. ఇది మహిళలకు 24 గంటలూ అత్యవసర, అత్యవసరం కాని సహాయం అందిస్తుంది; పోలీసు, ఆసుపత్రులు, ఇతర సేవలతో అనుసంధానిస్తుంది; మహిళల పథకాల సమాచారం ఇస్తుంది. లభ్యత రాష్ట్రాన్ని బట్టి మారవచ్చు."
   },
   "source": {
    "label": "Mission Shakti | Women Safety, Security & Empowerment (Ministry of Women and Child Development)",
    "url": "https://missionshakti.wcd.gov.in/"
   }
  },
  {
   "number": "14416",
   "label": {
    "en": "Tele-MANAS (free mental health helpline)",
    "hi": "टेली-मानस (मुफ़्त मानसिक स्वास्थ्य हेल्पलाइन)",
    "ta": "Tele-MANAS (இலவச மனநல உதவி எண்)",
    "te": "Tele-MANAS (ఉచిత మానసిక ఆరోగ్య హెల్ప్‌లైన్)"
   },
   "note": {
    "en": "Free mental health support, 24 hours a day, under the Ministry of Health and Family Welfare. You can choose your language. Calls go to the Tele-MANAS cell of your state, so availability can differ by state.",
    "hi": "स्वास्थ्य एवं परिवार कल्याण मंत्रालय के तहत मुफ़्त मानसिक स्वास्थ्य सहायता, दिन-रात 24 घंटे। आप अपनी भाषा चुन सकती हैं। कॉल आपके राज्य के टेली-मानस सेल में जाती हैं, इसलिए उपलब्धता राज्य के अनुसार अलग हो सकती है।",
    "ta": "சுகாதாரம் மற்றும் குடும்ப நல அமைச்சகத்தின் கீழ், 24 மணி நேரமும் இலவச மனநல உதவி. உங்கள் மொழியைத் தேர்வு செய்யலாம். அழைப்புகள் உங்கள் மாநிலத்தின் Tele-MANAS மையத்துக்குச் செல்லும்; எனவே இந்தச் சேவை மாநிலத்துக்கு மாநிலம் மாறுபடலாம்.",
    "te": "ఆరోగ్య, కుటుంబ సంక్షేమ మంత్రిత్వ శాఖ కింద 24 గంటలూ ఉచిత మానసిక ఆరోగ్య సహాయం. మీరు మీ భాషను ఎంచుకోవచ్చు. కాల్స్ మీ రాష్ట్రంలోని Tele-MANAS సెల్‌కు వెళ్తాయి, కాబట్టి లభ్యత రాష్ట్రాన్ని బట్టి మారవచ్చు."
   },
   "source": {
    "label": "Tele Mental Health Assistance and Networking Across States (Tele-MANAS) initiative launched on occasion of World Mental Health Day (PIB, Ministry of Health and Family Welfare)",
    "url": "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1866498&reg=48&lang=2"
   }
  }
 ]
};
