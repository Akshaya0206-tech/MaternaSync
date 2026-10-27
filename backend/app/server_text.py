"""Everything the server itself writes into a person's Updates, a WhatsApp reminder or a handover draft, in four languages.

A notification stores a message key and its fill-in values (`message_key`, `message_params`) as well as English text. When
it is read, the wording is chosen in the language of the person reading it, so a woman who switches to Tamil sees her older
Updates in Tamil too. Text that a person wrote (a question, a reply, a document name) is a fill-in value and is shown as
written. Nothing here names a symptom, a result or a medicine, and nothing is written by a model.

All Hindi, Tamil and Telugu wording below was written by an assistant and should be checked by a native speaker.
"""
from datetime import timezone

from . import models
from .ai_coordinator import messages as _assistant
from .companion import MSG as _COMPANION

LANGUAGES = ("en", "hi", "ta", "te")


def _m(en, hi, ta, te):
    return {"en": en, "hi": hi, "ta": ta, "te": te}


# key -> (title, body). A body of None means "show the `text` value as written".
CATALOG = {
    # ---- to the woman and to a trusted person
    "caregiver_joined": (
        _m("A trusted person joined", "एक भरोसेमंद व्यक्ति जुड़ा", "நம்பகமான ஒருவர் இணைந்துள்ளார்", "ఒక నమ్మకమైన వ్యక్తి చేరారు"),
        _m("{name} can now use MaternaSync for you, within what you allowed.",
           "{name} अब आपकी ओर से MaternaSync का उपयोग कर सकते हैं, उतना ही जितना आपने अनुमति दी है।",
           "{name} இப்போது நீங்கள் அனுமதித்த அளவுக்கு உங்களுக்காக MaternaSync-ஐப் பயன்படுத்தலாம்.",
           "{name} ఇప్పుడు మీరు అనుమతించిన మేరకు మీ తరపున MaternaSync ఉపయోగించవచ్చు.")),
    "caregiver_removed": (
        _m("Your access was removed", "आपकी पहुँच हटा दी गई", "உங்கள் அணுகல் நீக்கப்பட்டது", "మీ యాక్సెస్ తొలగించబడింది"),
        _m("You can no longer see this person's information in MaternaSync.", "अब आप MaternaSync में इस व्यक्ति की जानकारी नहीं देख सकते।",
           "இனி MaternaSync-இல் இந்த நபரின் தகவலைப் பார்க்க முடியாது.", "ఇకపై MaternaSync లో ఈ వ్యక్తి సమాచారాన్ని మీరు చూడలేరు.")),
    "caregiver_nudged_reminder": (
        _m("{name} sent you a reminder", "{name} ने आपको एक रिमाइंडर भेजा", "{name} உங்களுக்கு ஒரு நினைவூட்டலை அனுப்பினார்", "{name} మీకు ఒక రిమైండర్ పంపారు"),
        _m("{name} is reminding you about one of your reminders. Open your care plan to see it.", "{name} आपको आपके एक रिमाइंडर की याद दिला रहे हैं। उसे देखने के लिए अपनी देखभाल योजना खोलें।",
           "{name} உங்கள் நினைவூட்டல்களில் ஒன்றை நினைவுபடுத்துகிறார். அதைப் பார்க்க உங்கள் பராமரிப்புத் திட்டத்தைத் திறக்கவும்.",
           "{name} మీ రిమైండర్లలో ఒకదాని గురించి మీకు గుర్తు చేస్తున్నారు. దాన్ని చూడటానికి మీ సంరక్షణ ప్రణాళికను తెరవండి.")),
    "caregiver_stopped": (
        _m("{name} stopped helping you", "{name} ने आपकी मदद करना बंद कर दिया", "{name} உங்களுக்கு உதவுவதை நிறுத்திவிட்டார்", "{name} మీకు సహాయం చేయడం ఆపేశారు"),
        _m("They can no longer see anything about you. If you want them back, you can invite them again from your Profile page.",
           "वे अब आपके बारे में कुछ नहीं देख सकते। अगर आप उन्हें वापस चाहती हैं, तो अपने प्रोफ़ाइल पेज से उन्हें फिर आमंत्रित कर सकती हैं।",
           "இனி அவர்களால் உங்களைப் பற்றி எதையும் பார்க்க முடியாது. அவர்கள் மீண்டும் வேண்டுமென்றால் உங்கள் சுயவிவரப் பக்கத்திலிருந்து மீண்டும் அழைக்கலாம்.",
           "వారు ఇకపై మీ గురించి ఏమీ చూడలేరు. వారు మళ్లీ కావాలంటే మీ ప్రొఫైల్ పేజీ నుండి మళ్లీ ఆహ్వానించవచ్చు.")),
    # ---- a doctor works with a trusted person (all four are worded for the person who reads them)
    "visit_prep_added": (
        _m("Your doctor added a checklist for your visit", "आपके डॉक्टर ने आपकी मुलाक़ात के लिए एक सूची जोड़ी", "உங்கள் மருத்துவர் உங்கள் வருகைக்கான ஒரு பட்டியலைச் சேர்த்தார்", "మీ డాక్టర్ మీ సందర్శన కోసం ఒక జాబితాను జోడించారు"),
        _m("For the visit on {when}. Open Appointments to see it.", "{when} की मुलाक़ात के लिए। देखने के लिए अपॉइंटमेंट खोलें।",
           "{when} அன்றைய வருகைக்கு. பார்க்க சந்திப்புகளைத் திறக்கவும்.", "{when} నాటి సందర్శన కోసం. చూడటానికి అపాయింట్‌మెంట్లు తెరవండి.")),
    "visit_prep_caregiver": (
        _m("A checklist for a visit is ready", "मुलाक़ात के लिए एक सूची तैयार है", "வருகைக்கான ஒரு பட்டியல் தயாராக உள்ளது", "సందర్శన కోసం ఒక జాబితా సిద్ధంగా ఉంది"),
        _m("{name}'s doctor added a checklist for the visit on {when}. Open Appointments to see it.",
           "{name} के डॉक्टर ने {when} की मुलाक़ात के लिए एक सूची जोड़ी है। देखने के लिए अपॉइंटमेंट खोलें।",
           "{when} அன்றைய வருகைக்கு {name} அவர்களின் மருத்துவர் ஒரு பட்டியலைச் சேர்த்துள்ளார். பார்க்க சந்திப்புகளைத் திறக்கவும்.",
           "{when} నాటి సందర్శన కోసం {name} డాక్టర్ ఒక జాబితాను జోడించారు. చూడటానికి అపాయింట్‌మెంట్లు తెరవండి.")),
    "helper_asked_her": (
        _m("Your doctor asked {name} to help with check-ins", "आपके डॉक्टर ने {name} से चेक-इन में मदद करने को कहा",
           "உங்கள் மருத்துவர் தினசரிப் பதிவுகளில் உதவ {name} அவர்களிடம் கேட்டார்", "మీ డాక్టర్ రోజువారీ చెక్-ఇన్‌లలో సహాయం చేయమని {name}ను కోరారు"),
        _m("{doctor} asked {name} to help you fill in your daily check-ins. {name} can say yes or no, and you can change what they may do on your Profile.",
           "{doctor} ने {name} से आपके दैनिक चेक-इन भरने में मदद करने को कहा है। {name} हाँ या ना कह सकते हैं, और आप अपनी प्रोफ़ाइल पर बदल सकती हैं कि वे क्या कर सकते हैं।",
           "{doctor} உங்கள் தினசரிப் பதிவுகளை நிரப்ப உதவுமாறு {name} அவர்களிடம் கேட்டுள்ளார். {name} ஆம் அல்லது இல்லை என்று சொல்லலாம்; அவர்கள் என்ன செய்யலாம் என்பதை உங்கள் சுயவிவரத்தில் மாற்றலாம்.",
           "{doctor} మీ రోజువారీ చెక్-ఇన్‌లు నింపడంలో సహాయం చేయమని {name}ను కోరారు. {name} అవును లేదా కాదు అనవచ్చు, మరియు వారు ఏమి చేయవచ్చో మీ ప్రొఫైల్‌లో మార్చవచ్చు.")),
    "helper_asked_caregiver": (
        _m("You were asked to help with check-ins", "आपसे चेक-इन में मदद करने को कहा गया", "பதிவுகளில் உதவ உங்களிடம் கேட்கப்பட்டது", "చెక్-ఇన్‌లలో సహాయం చేయమని మిమ్మల్ని కోరారు"),
        _m("{doctor} asked you to help {name} with her daily check-ins. Open Home to say yes or no.",
           "{doctor} ने आपसे {name} के दैनिक चेक-इन में मदद करने को कहा है। हाँ या ना कहने के लिए होम खोलें।",
           "{doctor} {name} அவர்களின் தினசரிப் பதிவுகளில் உதவுமாறு உங்களிடம் கேட்டுள்ளார். ஆம் அல்லது இல்லை என்று சொல்ல முகப்பைத் திறக்கவும்.",
           "{doctor} {name} రోజువారీ చెక్-ఇన్‌లలో సహాయం చేయమని మిమ్మల్ని కోరారు. అవును లేదా కాదు అనడానికి హోమ్ తెరవండి.")),
    "helper_ended_caregiver": (
        _m("A request was withdrawn", "एक अनुरोध वापस ले लिया गया", "ஒரு கோரிக்கை திரும்பப் பெறப்பட்டது", "ఒక అభ్యర్థన ఉపసంహరించబడింది"),
        _m("{doctor} no longer needs you to be the check-in helper for {name}. Nothing else changes.",
           "{doctor} को अब {name} के चेक-इन में आपके सहायक बनने की ज़रूरत नहीं है। और कुछ नहीं बदलता।",
           "{name} அவர்களின் பதிவுகளுக்கு நீங்கள் உதவியாளராக இருக்க {doctor}க்கு இனி தேவையில்லை. வேறு எதுவும் மாறாது.",
           "{name} చెక్-ఇన్‌లకు మీరు సహాయకులుగా ఉండాల్సిన అవసరం {doctor}కు ఇక లేదు. మరేమీ మారదు.")),
    "caregiver_helper_yes": (
        _m("{name} will help with your check-ins", "{name} आपके चेक-इन में मदद करेंगे", "{name} உங்கள் பதிவுகளில் உதவுவார்", "{name} మీ చెక్-ఇన్‌లలో సహాయం చేస్తారు"),
        _m("Your doctor asked, and {name} said yes. If you miss a check-in, they will be reminded first.",
           "आपके डॉक्टर ने कहा और {name} ने हाँ कहा। अगर आप कोई चेक-इन भूल जाती हैं, तो पहले उन्हें याद दिलाया जाएगा।",
           "உங்கள் மருத்துவர் கேட்டார், {name} சரி என்றார். ஒரு பதிவைத் தவறவிட்டால், முதலில் அவருக்கு நினைவூட்டப்படும்.",
           "మీ డాక్టర్ అడిగారు, {name} సరే అన్నారు. మీరు చెక్-ఇన్ మిస్ అయితే, ముందుగా వారికి గుర్తు చేయబడుతుంది.")),
    "caregiver_helper_no": (
        _m("{name} cannot help with check-ins", "{name} चेक-इन में मदद नहीं कर सकते", "{name} பதிவுகளில் உதவ முடியாது", "{name} చెక్-ఇన్‌లలో సహాయం చేయలేరు"),
        _m("{name} said no to your doctor's request. Nothing changes for you.", "{name} ने आपके डॉक्टर के अनुरोध पर ना कहा। आपके लिए कुछ नहीं बदलता।",
           "உங்கள் மருத்துவரின் கோரிக்கைக்கு {name} இல்லை என்றார். உங்களுக்கு எதுவும் மாறாது.", "మీ డాక్టర్ అభ్యర్థనకు {name} కాదన్నారు. మీకు ఏమీ మారదు.")),
    "reminder_due_caregiver": (
        _m("A reminder is due for {name}", "{name} के लिए एक रिमाइंडर का समय हो गया है", "{name} அவர்களுக்கான ஒரு நினைவூட்டல் நேரம் வந்துவிட்டது", "{name} కోసం ఒక రిమైండర్ సమయం వచ్చింది"),
        _m("Open Reminders to see what is due. You could remind her.", "क्या देय है, यह देखने के लिए रिमाइंडर खोलें। आप उन्हें याद दिला सकते हैं।",
           "என்ன நேரம் வந்துள்ளது என்று பார்க்க நினைவூட்டல்களைத் திறக்கவும். நீங்கள் அவருக்கு நினைவூட்டலாம்.", "ఏది సమయం వచ్చిందో చూడటానికి రిమైండర్లు తెరవండి. మీరు ఆమెకు గుర్తు చేయవచ్చు.")),
    "document_verified_patient": (
        _m("Your care team reviewed your uploaded documents", "आपकी देखभाल टीम ने आपके अपलोड किए दस्तावेज़ों की समीक्षा की",
           "நீங்கள் பதிவேற்றிய ஆவணங்களை உங்கள் பராமரிப்புக் குழு பார்வையிட்டது", "మీరు అప్‌లోడ్ చేసిన పత్రాలను మీ సంరక్షణ బృందం సమీక్షించింది"),
        _m("Your journey has been updated.", "आपकी यात्रा अपडेट कर दी गई है।", "உங்கள் பயணம் புதுப்பிக்கப்பட்டது.", "మీ ప్రయాణం నవీకరించబడింది.")),
    # Written from 2026-10-26 on, so the update says which document and where to read it. The two older messages above stay for the rows that already exist.
    "document_reviewed_named": (
        _m("Your document was reviewed: {title}", "आपका दस्तावेज़ जाँचा गया: {title}", "உங்கள் ஆவணம் பார்வையிடப்பட்டது: {title}", "మీ పత్రం సమీక్షించబడింది: {title}"),
        _m("It has been checked and added to your journey.", "इसकी जाँच हो गई है और इसे आपकी यात्रा में जोड़ दिया गया है।",
           "இது சரிபார்க்கப்பட்டு உங்கள் பயணத்தில் சேர்க்கப்பட்டுள்ளது.", "ఇది తనిఖీ చేయబడి మీ ప్రయాణంలో చేర్చబడింది.")),
    "document_rejected_patient": (
        _m("Your care team reviewed an uploaded document", "आपकी देखभाल टीम ने आपके अपलोड किए दस्तावेज़ की समीक्षा की",
           "நீங்கள் பதிவேற்றிய ஆவணத்தை உங்கள் பராமரிப்புக் குழு பார்வையிட்டது", "మీరు అప్‌లోడ్ చేసిన పత్రాన్ని మీ సంరక్షణ బృందం సమీక్షించింది"),
        None),
    "document_rejected_default": (
        _m("Your care team reviewed an uploaded document", "आपकी देखभाल टीम ने आपके अपलोड किए दस्तावेज़ की समीक्षा की",
           "நீங்கள் பதிவேற்றிய ஆவணத்தை உங்கள் பராமரிப்புக் குழு பார்வையிட்டது", "మీరు అప్‌లోడ్ చేసిన పత్రాన్ని మీ సంరక్షణ బృందం సమీక్షించింది"),
        _m("This document could not be used. Please check it and upload it again if needed.",
           "यह दस्तावेज़ उपयोग नहीं किया जा सका। कृपया जाँचें और ज़रूरत हो तो फिर से अपलोड करें।",
           "இந்த ஆவணத்தைப் பயன்படுத்த முடியவில்லை. சரிபார்த்து, தேவைப்பட்டால் மீண்டும் பதிவேற்றுங்கள்.",
           "ఈ పత్రాన్ని ఉపయోగించలేకపోయాం. దయచేసి సరిచూసి, అవసరమైతే మళ్లీ అప్‌లోడ్ చేయండి.")),
    "question_answered_doctor": (
        _m("Your doctor answered your question", "आपके डॉक्टर ने आपके प्रश्न का उत्तर दिया", "உங்கள் கேள்விக்கு உங்கள் மருத்துவர் பதிலளித்தார்", "మీ ప్రశ్నకు మీ డాక్టర్ సమాధానం ఇచ్చారు"),
        None),
    "question_handled_offline": (
        _m("Your doctor handled your question by phone or at the clinic", "आपके डॉक्टर ने आपके प्रश्न को फ़ोन पर या क्लिनिक में निपटा दिया", "உங்கள் கேள்வியை உங்கள் மருத்துவர் தொலைபேசியில் அல்லது கிளினிக்கில் கவனித்தார்", "మీ ప్రశ్నను మీ డాక్టర్ ఫోన్‌లో లేదా క్లినిక్‌లో చూసుకున్నారు"),
        _m("If you still have a question, open My Questions and ask again.", "अगर आपका कोई और प्रश्न है, तो मेरे प्रश्न खोलकर फिर से पूछें।", "இன்னும் கேள்வி இருந்தால், எனது கேள்விகளைத் திறந்து மீண்டும் கேளுங்கள்.", "ఇంకా ప్రశ్న ఉంటే, నా ప్రశ్నలు తెరిచి మళ్లీ అడగండి.")),
    "question_answered": (
        _m("Your question was answered", "आपके प्रश्न का उत्तर दिया गया", "உங்கள் கேள்விக்குப் பதில் அளிக்கப்பட்டது", "మీ ప్రశ్నకు సమాధానం ఇవ్వబడింది"),
        _m("Open My Questions to read the reply.", "उत्तर पढ़ने के लिए मेरे प्रश्न खोलें।", "பதிலைப் படிக்க எனது கேள்விகளைத் திறக்கவும்.", "సమాధానం చదవడానికి నా ప్రశ్నలు తెరవండి.")),
    "reminders_added": (
        _m("Your care team added reminders", "आपकी देखभाल टीम ने रिमाइंडर जोड़े", "உங்கள் பராமரிப்புக் குழு நினைவூட்டல்களைச் சேர்த்தது", "మీ సంరక్షణ బృందం రిమైండర్లను జోడించింది"),
        _m("{title}", "{title}", "{title}", "{title}")),
    "approved_document": (
        _m("New approved document: {title}", "नया स्वीकृत दस्तावेज़: {title}", "புதிய அங்கீகரிக்கப்பட்ட ஆவணம்: {title}", "కొత్త ఆమోదించిన పత్రం: {title}"),
        _m("Your care team reviewed and released this document.", "आपकी देखभाल टीम ने इस दस्तावेज़ की समीक्षा करके इसे जारी किया है।",
           "உங்கள் பராமரிப்புக் குழு இந்த ஆவணத்தைப் பார்வையிட்டு வெளியிட்டுள்ளது.", "మీ సంరక్షణ బృందం ఈ పత్రాన్ని సమీక్షించి విడుదల చేసింది.")),
    "reminder_due": (
        _m("Reminder: {title}", "रिमाइंडर: {title}", "நினைவூட்டல்: {title}", "రిమైండర్: {title}"), None),
    "appointment_scheduled": (
        _m("Appointment scheduled", "अपॉइंटमेंट तय हुई", "சந்திப்பு உறுதி செய்யப்பட்டது", "అపాయింట్‌మెంట్ ఖరారైంది"), _m("{kind}", "{kind}", "{kind}", "{kind}")),
    "appointment_cancelled": (
        _m("Appointment cancelled", "अपॉइंटमेंट रद्द हुई", "சந்திப்பு ரத்து செய்யப்பட்டது", "అపాయింట్‌మెంట్ రద్దు చేయబడింది"), _m("{kind}", "{kind}", "{kind}", "{kind}")),
    "appointment_completed": (
        _m("Appointment completed", "अपॉइंटमेंट पूरी हुई", "சந்திப்பு முடிந்தது", "అపాయింట్‌మెంట్ పూర్తయింది"), _m("{kind}", "{kind}", "{kind}", "{kind}")),
    "appointment_no_show": (
        _m("Missed appointment", "छूटी हुई अपॉइंटमेंट", "தவறிய சந்திப்பு", "తప్పిన అపాయింట్‌మెంట్"), _m("{kind}", "{kind}", "{kind}", "{kind}")),
    "referral_sent_patient": (
        _m("Referral update", "रेफ़रल की जानकारी", "பரிந்துரை புதுப்பிப்பு", "రిఫరల్ అప్‌డేట్"),
        _m("Your referral has been sent and is being processed.", "आपका रेफ़रल भेज दिया गया है और उस पर काम हो रहा है।",
           "உங்கள் பரிந்துரை அனுப்பப்பட்டு, செயலாக்கப்படுகிறது.", "మీ రిఫరల్ పంపబడింది, దానిపై పని జరుగుతోంది.")),
    "referral_appointment_patient": (
        _m("Referral update", "रेफ़रल की जानकारी", "பரிந்துரை புதுப்பிப்பு", "రిఫరల్ అప్‌డేట్"),
        _m("Your appointment has been scheduled.", "आपकी अपॉइंटमेंट तय हो गई है।", "உங்கள் சந்திப்பு உறுதி செய்யப்பட்டது.", "మీ అపాయింట్‌మెంట్ ఖరారైంది.")),
    "referral_response_patient": (
        _m("Referral update", "रेफ़रल की जानकारी", "பரிந்துரை புதுப்பிப்பு", "రిఫరల్ అప్‌డేట్"),
        _m("Your referral response has been received.", "आपके रेफ़रल का उत्तर मिल गया है।", "உங்கள் பரிந்துரைக்கான பதில் கிடைத்துள்ளது.", "మీ రిఫరల్‌కు సమాధానం అందింది.")),
    "visit_reminder": (
        _m("Visit reminder", "अपॉइंटमेंट की याद", "சந்திப்பு நினைவூட்டல்", "అపాయింట్‌మెంట్ రిమైండర్"),
        _m("You have a visit ({kind}) on {when}. Please arrive a little early. If you cannot come, tell your care team.",
           "आपकी {when} को अपॉइंटमेंट ({kind}) है। कृपया थोड़ा जल्दी आएँ। अगर आप नहीं आ सकतीं, तो अपनी देखभाल टीम को बताएँ।",
           "{when} அன்று உங்களுக்கு ஒரு சந்திப்பு ({kind}) உள்ளது. சற்று முன்னதாக வாருங்கள். வர முடியாவிட்டால் உங்கள் பராமரிப்புக் குழுவிடம் தெரிவியுங்கள்.",
           "{when} న మీకు అపాయింట్‌మెంట్ ({kind}) ఉంది. దయచేసి కొంచెం ముందుగా రండి. రాలేకపోతే మీ సంరక్షణ బృందానికి చెప్పండి.")),
    "visit_reminder_caregiver": (
        _m("Visit reminder", "अपॉइंटमेंट की याद", "சந்திப்பு நினைவூட்டல்", "అపాయింట్‌మెంట్ రిమైండర్"),
        _m("{name} has a visit ({kind}) on {when}. You may want to help her get there.", "{name} की {when} को अपॉइंटमेंट ({kind}) है। आप उन्हें वहाँ पहुँचने में मदद कर सकते हैं।",
           "{name} அவர்களுக்கு {when} அன்று சந்திப்பு ({kind}) உள்ளது. அங்கு செல்ல நீங்கள் உதவலாம்.", "{name} గారికి {when} న అపాయింట్‌మెంట్ ({kind}) ఉంది. అక్కడికి చేరడంలో మీరు సహాయపడవచ్చు.")),
    "visit_confirmed": (
        _m("Your visit is confirmed", "आपकी अपॉइंटमेंट पक्की हो गई", "உங்கள் சந்திப்பு உறுதி செய்யப்பட்டது", "మీ అపాయింట్‌మెంట్ ఖరారైంది"),
        _m("Your visit ({kind}) is on {when}.", "आपकी अपॉइंटमेंट ({kind}) {when} को है।", "உங்கள் சந்திப்பு ({kind}) {when} அன்று.", "మీ అపాయింట్‌మెంట్ ({kind}) {when} న.")),
    "new_times_offered": (
        _m("Please choose another time", "कृपया दूसरा समय चुनें", "வேறு நேரத்தைத் தேர்ந்தெடுங்கள்", "దయచేసి మరో సమయం ఎంచుకోండి"),
        _m("The time you asked for is not available. Free times: {slots}. Please request one of them on the Appointments page.",
           "आपका माँगा हुआ समय उपलब्ध नहीं है। खाली समय: {slots}। कृपया अपॉइंटमेंट पेज पर इनमें से एक का अनुरोध करें।",
           "நீங்கள் கேட்ட நேரம் கிடைக்கவில்லை. காலியான நேரங்கள்: {slots}. சந்திப்புகள் பக்கத்தில் இவற்றில் ஒன்றைக் கோரவும்.",
           "మీరు అడిగిన సమయం అందుబాటులో లేదు. ఖాళీ సమయాలు: {slots}. దయచేసి అపాయింట్‌మెంట్లు పేజీలో వాటిలో ఒకదాన్ని అభ్యర్థించండి.")),
    "visit_missed": (
        _m("We missed you at your visit", "आपकी अपॉइंटमेंट पर आप नहीं आ सकीं", "உங்கள் சந்திப்பில் உங்களைக் காண முடியவில்லை", "మీ అపాయింట్‌మెంట్‌కు మీరు రాలేకపోయారు"),
        _m("Your visit on {when} was recorded as missed. You can request a new time on the Appointments page. If you need help, tell your care team.",
           "{when} की आपकी अपॉइंटमेंट छूटी हुई दर्ज की गई है। आप अपॉइंटमेंट पेज पर नया समय माँग सकती हैं। मदद चाहिए तो अपनी देखभाल टीम को बताएँ।",
           "{when} அன்றைய உங்கள் சந்திப்பு தவறியதாகப் பதிவாகியுள்ளது. சந்திப்புகள் பக்கத்தில் புதிய நேரத்தைக் கோரலாம். உதவி தேவைப்பட்டால் உங்கள் பராமரிப்புக் குழுவிடம் சொல்லுங்கள்.",
           "{when} నాటి మీ అపాయింట్‌మెంట్ తప్పినట్లు నమోదైంది. అపాయింట్‌మెంట్లు పేజీలో కొత్త సమయం అభ్యర్థించవచ్చు. సహాయం కావాలంటే మీ సంరక్షణ బృందానికి చెప్పండి.")),
    # ---- a trusted person acted for her, or their access is changing (all go to the woman)
    "caregiver_acted_checkin": (
        _m("{name} helped you", "{name} ने आपकी मदद की", "{name} உங்களுக்கு உதவினார்", "{name} మీకు సహాయం చేశారు"),
        _m("{name} filled in a check-in for you.", "{name} ने आपके लिए चेक-इन भरा।", "{name} உங்களுக்காக ஒரு பதிவை நிரப்பினார்.", "{name} మీ కోసం చెక్-ఇన్ నింపారు.")),
    "caregiver_acted_question": (
        _m("{name} helped you", "{name} ने आपकी मदद की", "{name} உங்களுக்கு உதவினார்", "{name} మీకు సహాయం చేశారు"),
        _m("{name} asked your doctor a question for you.", "{name} ने आपकी ओर से आपके डॉक्टर से एक प्रश्न पूछा।",
           "{name} உங்கள் சார்பாக உங்கள் மருத்துவரிடம் ஒரு கேள்வி கேட்டார்.", "{name} మీ తరపున మీ డాక్టర్‌ను ఒక ప్రశ్న అడిగారు.")),
    "caregiver_acted_attachment": (
        _m("{name} helped you", "{name} ने आपकी मदद की", "{name} உங்களுக்கு உதவினார்", "{name} మీకు సహాయం చేశారు"),
        _m("{name} attached a file to a question for you.", "{name} ने आपके लिए एक प्रश्न के साथ एक फ़ाइल जोड़ी।",
           "{name} உங்களுக்காக ஒரு கேள்வியுடன் ஒரு கோப்பை இணைத்தார்.", "{name} మీ కోసం ఒక ప్రశ్నకు ఒక ఫైల్‌ను జతచేశారు.")),
    "caregiver_nudge_checkin": (
        _m("A reminder from {name}", "{name} की ओर से एक याद दिलाना", "{name} அனுப்பிய நினைவூட்டல்", "{name} నుండి ఒక గుర్తుచేయడం"),
        _m("{name} is reminding you to fill in today’s check-in.", "{name} आपको आज का चेक-इन भरने की याद दिला रहे हैं।",
           "{name} இன்றைய பதிவை நிரப்ப உங்களுக்கு நினைவூட்டுகிறார்.", "{name} ఈ రోజు చెక్-ఇన్ నింపమని మీకు గుర్తు చేస్తున్నారు.")),
    "caregiver_acted_talk": (
        _m("{name} helped you", "{name} ने आपकी मदद की", "{name} உங்களுக்கு உதவினார்", "{name} మీకు సహాయం చేశారు"),
        _m("{name} asked your doctor to get in touch.", "{name} ने कहा कि आपके डॉक्टर संपर्क करें।",
           "{name} உங்கள் மருத்துவர் தொடர்புகொள்ள வேண்டும் எனக் கேட்டார்.", "{name} మీ డాక్టర్ సంప్రదించాలని కోరారు.")),
    "caregiver_visit_yes": (
        _m("{name} will take you to your visit", "{name} आपको अपॉइंटमेंट पर ले जाएँगे", "{name} உங்களைச் சந்திப்புக்கு அழைத்துச் செல்வார்", "{name} మిమ్మల్ని అపాయింట్‌మెంట్‌కు తీసుకెళ్తారు"),
        _m("{kind} on {when}.", "{kind}, {when} को।", "{kind}, {when} அன்று.", "{kind}, {when} న.")),
    "caregiver_visit_no": (
        _m("{name} cannot take you to your visit", "{name} आपको अपॉइंटमेंट पर नहीं ले जा सकेंगे", "{name}-ஆல் உங்களைச் சந்திப்புக்கு அழைத்துச் செல்ல முடியாது", "{name} మిమ్మల్ని అపాయింట్‌మెంట్‌కు తీసుకెళ్లలేరు"),
        _m("{kind} on {when}. You may want to ask someone else.", "{kind}, {when} को। आप किसी और से कह सकती हैं।", "{kind}, {when} அன்று. வேறு ஒருவரிடம் கேட்கலாம்.", "{kind}, {when} న. మీరు మరొకరిని అడగవచ్చు.")),
    "caregiver_whatsapp_on": (
        _m("{name} turned on WhatsApp reminders", "{name} ने व्हाट्सऐप रिमाइंडर चालू किए", "{name} வாட்ஸ்அப் நினைவூட்டல்களை இயக்கினார்", "{name} వాట్సాప్ రిమైండర్లను ఆన్ చేశారు"),
        _m("They will get a short \"please sign in\" message before your visits and when a check-in is waiting. Nothing about you is in the message.",
           "उन्हें आपकी अपॉइंटमेंट से पहले और चेक-इन बाकी होने पर एक छोटा \"कृपया साइन इन करें\" संदेश मिलेगा। संदेश में आपके बारे में कुछ नहीं होता।",
           "உங்கள் சந்திப்புகளுக்கு முன்பும், பதிவு காத்திருக்கும் போதும் அவருக்கு ஒரு சிறிய \"உள்நுழையவும்\" செய்தி வரும். செய்தியில் உங்களைப் பற்றி எதுவும் இருக்காது.",
           "మీ అపాయింట్‌మెంట్లకు ముందు, చెక్-ఇన్ వేచి ఉన్నప్పుడు వారికి ఒక చిన్న \"సైన్ ఇన్ చేయండి\" సందేశం వస్తుంది. సందేశంలో మీ గురించి ఏమీ ఉండదు.")),
    "caregiver_whatsapp_off": (
        _m("{name} turned off WhatsApp reminders", "{name} ने व्हाट्सऐप रिमाइंडर बंद किए", "{name} வாட்ஸ்அப் நினைவூட்டல்களை நிறுத்தினார்", "{name} వాట్సాప్ రిమైండర్లను ఆఫ్ చేశారు"),
        _m("They will no longer get WhatsApp messages about you.", "उन्हें अब आपके बारे में व्हाट्सऐप संदेश नहीं मिलेंगे।", "இனி உங்களைப் பற்றிய வாட்ஸ்அப் செய்திகள் அவருக்கு வராது.", "ఇకపై మీ గురించి వాట్సాప్ సందేశాలు వారికి రావు.")),
    "access_ending": (
        _m("A trusted person's access ends soon", "एक भरोसेमंद व्यक्ति की पहुँच जल्द समाप्त होगी", "நம்பகமான ஒருவரின் அணுகல் விரைவில் முடிகிறது", "ఒక నమ్మకమైన వ్యక్తి యాక్సెస్ త్వరలో ముగుస్తుంది"),
        _m("{name}'s access ends on {date}. You can extend it from your Profile page.", "{name} की पहुँच {date} को समाप्त होगी। आप इसे अपने प्रोफ़ाइल पेज से बढ़ा सकती हैं।",
           "{name} அவர்களின் அணுகல் {date} அன்று முடிகிறது. உங்கள் சுயவிவரப் பக்கத்திலிருந்து நீட்டிக்கலாம்.", "{name} యాక్సెస్ {date} న ముగుస్తుంది. మీ ప్రొఫైల్ పేజీ నుండి పొడిగించవచ్చు.")),
    "access_ended": (
        _m("A trusted person's access has ended", "एक भरोसेमंद व्यक्ति की पहुँच समाप्त हो गई", "நம்பகமான ஒருவரின் அணுகல் முடிந்துவிட்டது", "ఒక నమ్మకమైన వ్యక్తి యాక్సెస్ ముగిసింది"),
        _m("{name} can no longer see your information. You can extend it from your Profile page.", "{name} अब आपकी जानकारी नहीं देख सकते। आप इसे अपने प्रोफ़ाइल पेज से बढ़ा सकती हैं।",
           "{name}-ஆல் இனி உங்கள் தகவலைப் பார்க்க முடியாது. உங்கள் சுயவிவரப் பக்கத்திலிருந்து நீட்டிக்கலாம்.", "{name} ఇకపై మీ సమాచారాన్ని చూడలేరు. మీ ప్రొఫైల్ పేజీ నుండి పొడిగించవచ్చు.")),
    "visit_change_sent": (
        _m("Your request about a visit was sent", "मुलाक़ात के बारे में आपका अनुरोध भेज दिया गया", "வருகை குறித்த உங்கள் கோரிக்கை அனுப்பப்பட்டது", "సందర్శన గురించి మీ అభ్యర్థన పంపబడింది"),
        _m("Your doctor’s clinic will answer. Your visit has not changed yet.", "आपके डॉक्टर का क्लिनिक जवाब देगा। आपकी मुलाक़ात अभी बदली नहीं है।",
           "உங்கள் மருத்துவரின் கிளினிக் பதிலளிக்கும். உங்கள் வருகை இன்னும் மாற்றப்படவில்லை.", "మీ డాక్టర్ క్లినిక్ సమాధానం ఇస్తుంది. మీ సందర్శన ఇంకా మారలేదు.")),
    # ---- to the doctor
    "appointment_requested": (
        _m("Appointment requested", "अपॉइंटमेंट का अनुरोध", "சந்திப்புக் கோரிக்கை", "అపాయింట్‌మెంట్ అభ్యర్థన"), _m("{kind}", "{kind}", "{kind}", "{kind}")),
    "visit_change_requested": (
        _m("A patient asked to change a visit", "एक रोगी ने मुलाक़ात बदलने को कहा", "ஒரு நோயாளி வருகையை மாற்றக் கேட்டார்", "ఒక రోగి సందర్శనను మార్చమని కోరారు"),
        _m("{what} Nothing has been changed yet.", "{what} अभी कुछ बदला नहीं गया है।", "{what} இன்னும் எதுவும் மாற்றப்படவில்லை.", "{what} ఇంకా ఏమీ మార్చబడలేదు.")),
    "visit_change_withdrawn": (
        _m("A patient withdrew a request to change a visit", "रोगी ने मुलाक़ात बदलने का अनुरोध वापस ले लिया", "நோயாளி வருகை மாற்றக் கோரிக்கையைத் திரும்பப் பெற்றார்", "రోగి సందర్శన మార్పు అభ్యర్థనను వెనక్కి తీసుకున్నారు"),
        _m("{what}", "{what}", "{what}", "{what}")),
    "question_attachment": (
        _m("A patient attached a file to a question", "एक रोगी ने प्रश्न के साथ एक फ़ाइल जोड़ी", "ஒரு நோயாளி கேள்வியுடன் ஒரு கோப்பை இணைத்தார்", "ఒక రోగి ప్రశ్నకు ఒక ఫైల్‌ను జోడించారు"),
        _m("{name} attached a file to a question. It is on your Patient Questions list.", "{name} ने एक प्रश्न के साथ फ़ाइल जोड़ी है। वह आपकी रोगियों के प्रश्न सूची में है।",
           "{name} ஒரு கேள்வியுடன் கோப்பை இணைத்துள்ளார். அது உங்கள் நோயாளிகளின் கேள்விகள் பட்டியலில் உள்ளது.", "{name} ఒక ప్రశ్నకు ఫైల్‌ను జోడించారు. అది మీ రోగుల ప్రశ్నల జాబితాలో ఉంది.")),
    "question_followup": (
        _m("A patient asked a follow-up question", "एक रोगी ने फ़ॉलो-अप प्रश्न पूछा", "ஒரு நோயாளி பின்தொடர்தல் கேள்வி கேட்டார்", "ఒక రోగి ఫాలో-అప్ ప్రశ్న అడిగారు"),
        _m("{name} asked a follow-up to an earlier question. It is on your Patient Questions list.", "{name} ने पहले के प्रश्न के बारे में फ़ॉलो-अप प्रश्न पूछा है। वह आपकी रोगियों के प्रश्न सूची में है।",
           "{name} முந்தைய கேள்வியைப் பற்றி பின்தொடர்தல் கேள்வி கேட்டுள்ளார். அது உங்கள் நோயாளிகளின் கேள்விகள் பட்டியலில் உள்ளது.", "{name} ముందటి ప్రశ్నకు ఫాలో-అప్ ప్రశ్న అడిగారు. అది మీ రోగుల ప్రశ్నల జాబితాలో ఉంది.")),
    "help_requested": (
        _m("A patient asked for help with a reminder", "रोगी ने रिमाइंडर में मदद माँगी", "நோயாளி நினைவூட்டலில் உதவி கேட்டார்", "రోగి రిమైండర్‌లో సహాయం కోరారు"),
        _m("{title}", "{title}", "{title}", "{title}")),
    "follow_up_assigned": (
        _m("Follow-up assigned", "फ़ॉलो-अप सौंपा गया", "பின்தொடர்தல் ஒதுக்கப்பட்டது", "ఫాలో-అప్ కేటాయించబడింది"), _m("{title}", "{title}", "{title}", "{title}")),
    "pathway_assigned": (
        _m("Pathway tasks assigned", "पाथवे के कार्य सौंपे गए", "பாதைப் பணிகள் ஒதுக்கப்பட்டன", "పాత్‌వే పనులు కేటాయించబడ్డాయి"), _m("{title}", "{title}", "{title}", "{title}")),
    "task_overdue": (
        _m("Task overdue", "कार्य की समय-सीमा निकल गई", "பணி தாமதமாகிவிட்டது", "పని గడువు దాటింది"), _m("{title}", "{title}", "{title}", "{title}")),
    "task_due_soon": (
        _m("Task due tomorrow", "कार्य कल देय है", "பணி நாளை முடிய வேண்டும்", "పని రేపు గడువు"), _m("{title}", "{title}", "{title}", "{title}")),
    "referral_sent_doctor": (
        _m("Your referral has been sent", "आपका रेफ़रल भेज दिया गया है", "உங்கள் பரிந்துரை அனுப்பப்பட்டது", "మీ రిఫరల్ పంపబడింది"),
        _m("{patient}: {title} sent to {destination}.", "{patient}: {title} {destination} को भेजा गया।", "{patient}: {title} {destination}-க்கு அனுப்பப்பட்டது.", "{patient}: {title} {destination} కు పంపబడింది.")),
    "referral_review_doctor": (
        _m("Referral response received: review needed", "रेफ़रल का उत्तर मिला: समीक्षा ज़रूरी", "பரிந்துரைக்கான பதில் வந்துள்ளது: பார்வையிட வேண்டும்", "రిఫరల్ సమాధానం అందింది: సమీక్ష అవసరం"),
        _m("{patient}: {title}", "{patient}: {title}", "{patient}: {title}", "{patient}: {title}")),
    "document_for_review": (
        _m("New document uploaded", "नया दस्तावेज़ अपलोड हुआ", "புதிய ஆவணம் பதிவேற்றப்பட்டது", "కొత్త పత్రం అప్‌లోడ్ అయింది"),
        _m("{filename} needs review.", "{filename} की समीक्षा ज़रूरी है।", "{filename}-ஐ பார்வையிட வேண்டும்.", "{filename} ను సమీక్షించాలి.")),
    "document_verified_doctor": (
        _m("A document was verified and added to the patient's journey", "एक दस्तावेज़ सत्यापित होकर रोगी की यात्रा में जोड़ा गया",
           "ஒரு ஆவணம் சரிபார்க்கப்பட்டு நோயாளியின் பயணத்தில் சேர்க்கப்பட்டது", "ఒక పత్రం ధృవీకరించబడి రోగి ప్రయాణంలో చేర్చబడింది"),
        _m("{filename}", "{filename}", "{filename}", "{filename}")),
    "question_needs_you": (
        _m("A patient question needs you", "एक रोगी के प्रश्न को आपकी ज़रूरत है", "நோயாளியின் கேள்விக்கு உங்கள் கவனம் தேவை", "రోగి ప్రశ్నకు మీ అవసరం ఉంది"), None),
    "question_warning_wording": (
        _m("Possible warning-sign wording in a patient question", "रोगी के प्रश्न में चेतावनी-संकेत जैसे शब्द हो सकते हैं",
           "நோயாளியின் கேள்வியில் எச்சரிக்கை அறிகுறி போன்ற சொற்கள் இருக்கலாம்", "రోగి ప్రశ్నలో హెచ్చరిక సంకేతం లాంటి పదాలు ఉండవచ్చు"), None),
    "assistant_item": (
        _m("Care assistant: something needs you", "केयर असिस्टेंट: आपकी ज़रूरत है", "பராமரிப்பு உதவியாளர்: உங்கள் கவனம் தேவை", "కేర్ అసిస్టెంట్: మీ అవసరం ఉంది"), None),
    "assistant_item_urgent": (
        _m("Care assistant: urgent item", "केयर असिस्टेंट: ज़रूरी मामला", "பராமரிப்பு உதவியாளர்: அவசர விஷயம்", "కేర్ అసిస్టెంట్: అత్యవసర అంశం"), None),
    "weekly_summary": (
        _m("Your week with the care assistant", "केयर असिस्टेंट के साथ आपका सप्ताह", "பராமரிப்பு உதவியாளருடன் உங்கள் வாரம்", "కేర్ అసిస్టెంట్‌తో మీ వారం"),
        _m("Questions: {questions} received, {answered} answered. Documents: {documents} uploaded, {verified} verified. Assistant steps: {steps}, of which {undone} undone. Open Care Assistant for the details.",
           "प्रश्न: {questions} मिले, {answered} के उत्तर दिए गए। दस्तावेज़: {documents} अपलोड हुए, {verified} सत्यापित हुए। असिस्टेंट के कदम: {steps}, जिनमें से {undone} वापस लिए गए। विवरण के लिए केयर असिस्टेंट खोलें।",
           "கேள்விகள்: {questions} வந்தன, {answered}-க்குப் பதில் அளிக்கப்பட்டது. ஆவணங்கள்: {documents} பதிவேற்றப்பட்டன, {verified} சரிபார்க்கப்பட்டன. உதவியாளரின் படிகள்: {steps}, அவற்றில் {undone} திரும்பப் பெறப்பட்டன. விவரங்களுக்கு பராமரிப்பு உதவியாளரைத் திறக்கவும்.",
           "ప్రశ్నలు: {questions} వచ్చాయి, {answered} కు సమాధానం ఇచ్చారు. పత్రాలు: {documents} అప్‌లోడ్ అయ్యాయి, {verified} ధృవీకరించబడ్డాయి. అసిస్టెంట్ చర్యలు: {steps}, వాటిలో {undone} వెనక్కి తీసుకున్నారు. వివరాల కోసం కేర్ అసిస్టెంట్ తెరవండి.")),
    "draft_ready": (
        _m("A draft is ready for you", "आपके लिए एक मसौदा तैयार है", "உங்களுக்கான வரைவு தயாராக உள்ளது", "మీ కోసం ఒక ముసాయిదా సిద్ధంగా ఉంది"),
        _m("{patient}: {title}. It is waiting for your review.", "{patient}: {title}। यह आपकी समीक्षा की प्रतीक्षा में है।",
           "{patient}: {title}. இது உங்கள் பார்வைக்காகக் காத்திருக்கிறது.", "{patient}: {title}. ఇది మీ సమీక్ష కోసం వేచి ఉంది.")),
    "account_closed": (
        _m("A patient closed her account", "एक रोगी ने अपना खाता बंद कर दिया", "ஒரு நோயாளி தன் கணக்கை மூடினார்", "ఒక రోగి తన ఖాతాను మూసివేశారు"),
        _m("{name} closed her account and asked for her data to be erased. Please follow your clinic's policy and the law. There is a task for it.",
           "{name} ने अपना खाता बंद कर दिया और अपना डेटा मिटाने को कहा है। कृपया अपने क्लिनिक की नीति और कानून का पालन करें। इसके लिए एक कार्य बनाया गया है।",
           "{name} தன் கணக்கை மூடி, தன் தரவை அழிக்கும்படி கேட்டுள்ளார். உங்கள் கிளினிக்கின் கொள்கையையும் சட்டத்தையும் பின்பற்றுங்கள். இதற்காக ஒரு பணி உருவாக்கப்பட்டுள்ளது.",
           "{name} తన ఖాతాను మూసివేసి, తన డేటాను తొలగించమని కోరారు. దయచేసి మీ క్లినిక్ విధానాన్ని మరియు చట్టాన్ని అనుసరించండి. దీనికి ఒక పని సృష్టించబడింది.")),
    "handover_ready": (
        _m("A handover draft is ready", "हैंडओवर का मसौदा तैयार है", "ஒப்படைப்பு வரைவு தயாராக உள்ளது", "హ్యాండోవర్ ముసాయిదా సిద్ధంగా ఉంది"),
        _m("{patient}: please review it, edit it if needed and share it yourself.", "{patient}: कृपया इसकी समीक्षा करें, ज़रूरत हो तो बदलें और स्वयं साझा करें।",
           "{patient}: தயவுசெய்து இதைப் பார்வையிட்டு, தேவைப்பட்டால் திருத்தி, நீங்களே பகிருங்கள்.", "{patient}: దయచేసి దీన్ని సమీక్షించి, అవసరమైతే మార్చి, మీరే పంచుకోండి.")),
}

# The minimal WhatsApp text. It never holds a name, a result or a medicine.
OUTREACH = {
    "reminder": _m("MaternaSync: you have a care reminder. Please sign in to view it.",
                   "MaternaSync: आपके लिए एक देखभाल रिमाइंडर है। देखने के लिए कृपया साइन इन करें।",
                   "MaternaSync: உங்களுக்கு ஒரு பராமரிப்பு நினைவூட்டல் உள்ளது. பார்க்க உள்நுழையவும்.",
                   "MaternaSync: మీకు ఒక సంరక్షణ రిమైండర్ ఉంది. చూడటానికి దయచేసి సైన్ ఇన్ చేయండి."),
    "output": _m("MaternaSync: your care team has shared an approved document. Please sign in to view it.",
                 "MaternaSync: आपकी देखभाल टीम ने एक स्वीकृत दस्तावेज़ साझा किया है। देखने के लिए कृपया साइन इन करें।",
                 "MaternaSync: உங்கள் பராமரிப்புக் குழு அங்கீகரிக்கப்பட்ட ஆவணத்தைப் பகிர்ந்துள்ளது. பார்க்க உள்நுழையவும்.",
                 "MaternaSync: మీ సంరక్షణ బృందం ఆమోదించిన పత్రాన్ని పంచుకుంది. చూడటానికి దయచేసి సైన్ ఇన్ చేయండి."),
    "caregiver_visit": _m("MaternaSync: a visit you are helping with is coming up. Please sign in to see the details.",
                          "MaternaSync: आप जिस अपॉइंटमेंट में मदद कर रहे हैं वह नज़दीक है। विवरण देखने के लिए कृपया साइन इन करें।",
                          "MaternaSync: நீங்கள் உதவும் சந்திப்பு நெருங்குகிறது. விவரங்களைப் பார்க்க உள்நுழையவும்.",
                          "MaternaSync: మీరు సహాయం చేస్తున్న అపాయింట్‌మెంట్ దగ్గరలో ఉంది. వివరాలు చూడటానికి దయచేసి సైన్ ఇన్ చేయండి."),
    "caregiver_checkin": _m("MaternaSync: a check-in you are helping with is waiting. Please sign in.",
                            "MaternaSync: जिस चेक-इन में आप मदद कर रहे हैं वह बाकी है। कृपया साइन इन करें।",
                            "MaternaSync: நீங்கள் உதவும் பதிவு காத்திருக்கிறது. உள்நுழையவும்.",
                            "MaternaSync: మీరు సహాయం చేస్తున్న చెక్-ఇన్ వేచి ఉంది. దయచేసి సైన్ ఇన్ చేయండి."),
}

# The one-time code that proves a number belongs to the person who typed it. It names nobody and says nothing about a patient.
CODE_TEXT = _m("MaternaSync: your code is {code}. It works for 10 minutes. If you did not ask for it, ignore this message.",
               "MaternaSync: आपका कोड {code} है। यह 10 मिनट तक काम करेगा। अगर आपने नहीं माँगा, तो इस संदेश को अनदेखा करें।",
               "MaternaSync: உங்கள் குறியீடு {code}. இது 10 நிமிடங்கள் செல்லும். நீங்கள் கேட்கவில்லை என்றால் இந்தச் செய்தியைப் புறக்கணிக்கவும்.",
               "MaternaSync: మీ కోడ్ {code}. ఇది 10 నిమిషాలు పనిచేస్తుంది. మీరు అడగకపోతే ఈ సందేశాన్ని విస్మరించండి.")


def code_text(code: str, language: str) -> str:
    return pick(CODE_TEXT, language).format(code=code)


def fmt_date(moment) -> str:
    """A date such as 30-11-2026 (UTC), for access messages."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%d-%m-%Y")


class _Fill(dict):
    def __missing__(self, key):  # a missing fill-in value must never break reading someone's Updates
        return ""


# What the care assistant says to a person (its fixed four-language wording in ai_coordinator/messages.py), kept as keys like the rest: the note is worded
# when it is READ, for the person reading it, so a change of language changes it and a trusted person never gets the patient's language.
CATALOG.update({
    "assistant_checkin_patient": (_assistant.CHECKIN_TITLE, _assistant.CHECKIN_PATIENT),
    "assistant_checkin_caregiver": (_assistant.CHECKIN_TITLE, _assistant.CHECKIN_CAREGIVER),  # {name}
    "assistant_urgent": (_assistant.URGENT_TITLE, _COMPANION["urgent"]),  # the same fixed emergency message the companion shows
})


def pick(table: dict, language: str) -> str:
    return table.get(language) or table["en"]


def render(key: str, language: str, params: dict | None = None) -> tuple[str, str]:
    """Title and body for `key` in `language`. Unknown keys are not rendered (callers keep the stored text)."""
    title_table, body_table = CATALOG[key]
    values = _Fill({k: ("" if v is None else v) for k, v in (params or {}).items()})
    title = pick(title_table, language).format_map(values)
    body = values["text"] if body_table is None else pick(body_table, language).format_map(values)
    return title, body


def language_of(db, user_id: str | None) -> str:
    pref = db.get(models.PatientPreference, user_id) if user_id else None
    return pref.language if pref and pref.language in LANGUAGES else "en"


def fmt_slot(moment) -> str:
    """A date and time such as 03-11-2026 10:30 (UTC), for visit messages."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%d-%m-%Y %H:%M")


def outreach_text(kind: str, language: str) -> str:
    return pick(OUTREACH[kind], language)


def notify_key(db, recipient_user_id: str, key: str, *, episode_id: str | None = None, type_: str = "continuity", params: dict | None = None,
               related_entity_type: str | None = None, related_entity_id: str | None = None, flush: bool = False) -> models.Notification:
    """Add a notification that is worded in the reader's language whenever it is read. English is stored as the fallback."""
    title, body = render(key, "en", params)
    note = models.Notification(recipient_user_id=recipient_user_id, episode_id=episode_id, type=type_, title=title, body=body,
                               message_key=key, message_params=params or {}, related_entity_type=related_entity_type, related_entity_id=related_entity_id)
    db.add(note)
    if flush:
        db.flush()
    return note


def _fixed(table: dict | None) -> str | None:
    """The English text of a table, if it has no blanks to fill in."""
    return None if table is None or "{" in table["en"] else table["en"]


# Notifications written before messages had keys (and the seeded demonstration ones) carry only text, in English or, for the assistant's own notes, in
# whatever language the person had that day. When that text is exactly one of the fixed messages above in ANY of the four languages, it is recognised and
# worded in the reader's language too. Anything with blanks or written by a person stays as stored.
_LEGACY = {}
for _key, (_title, _body) in CATALOG.items():
    if _body is None:
        continue
    for _language in LANGUAGES:
        if _language in _title and _language in _body and "{" not in _title[_language] and "{" not in _body[_language]:
            _LEGACY[(_title[_language], _body[_language])] = _key


def texts(db, reader_id: str, note: models.Notification) -> tuple[str, str]:
    """The title and body to show `reader_id`. Older notifications with no key are matched to a fixed message when they say exactly that."""
    key = note.message_key if note.message_key in CATALOG else _LEGACY.get((note.title, note.body or ""))
    if key:
        return render(key, language_of(db, reader_id), note.message_params or {})
    return note.title, note.body or ""


def notification_out(db, reader, note: models.Notification):
    from .schemas_v2 import NotificationOut
    from .update_links import link_for
    from .doctor_update_links import link_for as doctor_link_for
    title, body = texts(db, reader.id, note)
    link = link_for(note) if reader.role == "patient" else doctor_link_for(note) if reader.role == "doctor" else None
    return NotificationOut(id=note.id, type=note.type, title=title, body=body, is_read=bool(note.is_read), created_at=note.created_at, link=link)
