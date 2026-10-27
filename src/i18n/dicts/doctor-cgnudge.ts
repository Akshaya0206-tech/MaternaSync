type Entry = { hi: string; ta: string; te: string };
const e = (hi: string, ta: string, te: string): Entry => ({ hi, ta, te });

// The two sentences the doctor's Audit trail shows when a trusted person sends her a short "remind her" note (Reminders, Daily Check-in).
// English text is the key. Wording below was written by an assistant and should be checked by a native speaker.
export const entries: Record<string, Entry> = {
  "A trusted person reminded her about a reminder": e("एक भरोसेमंद व्यक्ति ने उन्हें एक रिमाइंडर की याद दिलाई", "ஒரு நம்பகமான நபர் அவருக்கு ஒரு நினைவூட்டலை நினைவுபடுத்தினார்", "ఒక నమ్మకమైన వ్యక్తి ఆమెకు ఒక రిమైండర్ గురించి గుర్తు చేశారు"),
  "A trusted person reminded her to fill in a check-in": e("एक भरोसेमंद व्यक्ति ने उन्हें चेक-इन भरने की याद दिलाई", "ஒரு நம்பகமான நபர் அவருக்குப் பதிவு நிரப்ப நினைவுபடுத்தினார்", "ఒక నమ్మకమైన వ్యక్తి ఆమెకు చెక్-ఇన్ నింపమని గుర్తు చేశారు"),
};
