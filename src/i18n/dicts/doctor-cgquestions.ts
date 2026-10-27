type Entry = { hi: string; ta: string; te: string };
const e = (hi: string, ta: string, te: string): Entry => ({ hi, ta, te });

// The two sentences the doctor's Audit trail shows when a trusted person adds to a question they asked for her (Questions tab: a file, "I still have a question").
// English text is the key. Wording below was written by an assistant and should be checked by a native speaker.
export const entries: Record<string, Entry> = {
  "A trusted person asked a follow-up question for her": e("एक भरोसेमंद व्यक्ति ने उनके लिए अगला प्रश्न पूछा", "ஒரு நம்பகமான நபர் அவருக்காக ஒரு தொடர்ச்சிக் கேள்வி கேட்டார்", "ఒక నమ్మకమైన వ్యక్తి ఆమె కోసం ఒక కొనసాగింపు ప్రశ్న అడిగారు"),
  "A trusted person attached a file to a question for her": e("एक भरोसेमंद व्यक्ति ने उनके लिए प्रश्न के साथ एक फ़ाइल जोड़ी", "ஒரு நம்பகமான நபர் அவருக்காக ஒரு கேள்வியுடன் ஒரு கோப்பை இணைத்தார்", "ఒక నమ్మకమైన వ్యక్తి ఆమె కోసం ఒక ప్రశ్నకు ఒక ఫైల్‌ను జతచేశారు"),
};
