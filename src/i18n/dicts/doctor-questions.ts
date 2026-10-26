type Entry = { hi: string; ta: string; te: string };
const e = (hi: string, ta: string, te: string): Entry => ({ hi, ta, te });

// The doctor's Patient Questions page (files a patient attached, follow-up questions) and the usual reply time on the Care Assistant page.
// English text is the key. Wording below was written by an assistant and should be checked by a native speaker.
export const entries: Record<string, Entry> = {
  "Follow-up to an earlier question:": e("पहले के एक प्रश्न से जुड़ा अगला प्रश्न:", "முந்தைய கேள்விக்குத் தொடர்ச்சியாக:", "ముందటి ప్రశ్నకు కొనసాగింపు:"),
  "Files the patient attached:": e("रोगी की संलग्न की हुई फ़ाइलें:", "நோயாளி இணைத்த கோப்புகள்:", "రోగి జతచేసిన ఫైళ్లు:"),
  "Files attached: {count}": e("संलग्न फ़ाइलें: {count}", "இணைக்கப்பட்ட கோப்புகள்: {count}", "జతచేసిన ఫైళ్లు: {count}"),
  "The file could not be opened.": e("फ़ाइल खोली नहीं जा सकी।", "கோப்பைத் திறக்க முடியவில்லை.", "ఫైల్‌ను తెరవడం సాధ్యం కాలేదు."),
  "Usual reply time": e("उत्तर का सामान्य समय", "வழக்கமான பதில் நேரம்", "సాధారణ సమాధాన సమయం"),
  "Patients see this on their My Questions page. It is only a guide to when a reply usually comes. It promises nothing, and anything urgent is sent to the emergency numbers.":
    e("रोगी इसे अपने “मेरे प्रश्न” पेज पर देखते हैं। यह केवल एक अंदाज़ा है कि उत्तर आमतौर पर कब आता है। यह कोई वादा नहीं है, और जो भी ज़रूरी हो उसके लिए आपातकालीन नंबर बताए जाते हैं।",
      "நோயாளிகள் இதைத் தங்கள் “எனது கேள்விகள்” பக்கத்தில் பார்ப்பார்கள். பதில் பொதுவாக எப்போது வரும் என்பதற்கான வழிகாட்டி மட்டுமே இது. இது எந்த உறுதியும் அல்ல; அவசரமான எதற்கும் அவசர எண்கள் காட்டப்படும்.",
      "రోగులు దీన్ని తమ “నా ప్రశ్నలు” పేజీలో చూస్తారు. సమాధానం సాధారణంగా ఎప్పుడు వస్తుందో చెప్పే సూచన మాత్రమే ఇది. ఇది ఏ హామీ కాదు; అత్యవసరమైన వాటికి అత్యవసర నంబర్లు చూపబడతాయి."),
  "How long a reply usually takes": e("उत्तर में आमतौर पर कितना समय लगता है", "பதிலுக்கு பொதுவாக எவ்வளவு நேரம் ஆகும்", "సమాధానానికి సాధారణంగా ఎంత సమయం పడుతుంది"),
  "For example: within 1 working day": e("उदाहरण: 1 कार्यदिवस के भीतर", "எடுத்துக்காட்டு: 1 வேலை நாளுக்குள்", "ఉదాహరణ: 1 పని దినంలోపు"),
  "Leave it empty to show nothing.": e("कुछ न दिखाने के लिए इसे खाली छोड़ें।", "எதுவும் காட்டாமல் இருக்க இதைக் காலியாக விடுங்கள்.", "ఏమీ చూపకుండా ఉండాలంటే దీన్ని ఖాళీగా ఉంచండి."),
  "Save reply time": e("उत्तर का समय सहेजें", "பதில் நேரத்தைச் சேமிக்கவும்", "సమాధాన సమయాన్ని సేవ్ చేయండి"),
  "Reply time saved.": e("उत्तर का समय सहेज लिया गया।", "பதில் நேரம் சேமிக்கப்பட்டது.", "సమాధాన సమయం సేవ్ చేయబడింది."),
};
