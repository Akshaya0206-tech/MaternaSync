"""Everything the server itself writes into a person's Updates, a WhatsApp reminder or a handover draft, in four languages.

A notification stores a message key and its fill-in values (`message_key`, `message_params`) as well as English text. When
it is read, the wording is chosen in the language of the person reading it, so a woman who switches to Tamil sees her older
Updates in Tamil too. Text that a person wrote (a question, a reply, a document name) is a fill-in value and is shown as
written. Nothing here names a symptom, a result or a medicine, and nothing is written by a model.

All Hindi, Tamil and Telugu wording below was written by an assistant and should be checked by a native speaker.
"""
from datetime import timezone

from . import models

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
    "document_verified_patient": (
        _m("Your care team reviewed your uploaded documents", "आपकी देखभाल टीम ने आपके अपलोड किए दस्तावेज़ों की समीक्षा की",
           "நீங்கள் பதிவேற்றிய ஆவணங்களை உங்கள் பராமரிப்புக் குழு பார்வையிட்டது", "మీరు అప్‌లోడ్ చేసిన పత్రాలను మీ సంరక్షణ బృందం సమీక్షించింది"),
        _m("Your journey has been updated.", "आपकी यात्रा अपडेट कर दी गई है।", "உங்கள் பயணம் புதுப்பிக்கப்பட்டது.", "మీ ప్రయాణం నవీకరించబడింది.")),
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
    # ---- to the doctor
    "appointment_requested": (
        _m("Appointment requested", "अपॉइंटमेंट का अनुरोध", "சந்திப்புக் கோரிக்கை", "అపాయింట్‌మెంట్ అభ్యర్థన"), _m("{kind}", "{kind}", "{kind}", "{kind}")),
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
}


class _Fill(dict):
    def __missing__(self, key):  # a missing fill-in value must never break reading someone's Updates
        return ""


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


def texts(db, reader_id: str, note: models.Notification) -> tuple[str, str]:
    """The title and body to show `reader_id`. Older notifications with no key keep the text they were stored with."""
    if note.message_key in CATALOG:
        return render(note.message_key, language_of(db, reader_id), note.message_params or {})
    return note.title, note.body or ""


def notification_out(db, reader, note: models.Notification):
    from .schemas_v2 import NotificationOut
    title, body = texts(db, reader.id, note)
    return NotificationOut(id=note.id, type=note.type, title=title, body=body, is_read=bool(note.is_read), created_at=note.created_at)
