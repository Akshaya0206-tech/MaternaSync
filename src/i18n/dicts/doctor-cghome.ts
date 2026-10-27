type Entry = { hi: string; ta: string; te: string };
const e = (hi: string, ta: string, te: string): Entry => ({ hi, ta, te });

// The sentence the doctor's Audit trail shows when a trusted person stops helping a patient (their Home page, "Stop helping").
// English text is the key. Wording below was written by an assistant and should be checked by a native speaker.
export const entries: Record<string, Entry> = {
  "A trusted person stopped helping her": e("एक भरोसेमंद व्यक्ति ने उनकी मदद करना बंद कर दिया", "ஒரு நம்பகமான நபர் அவருக்கு உதவுவதை நிறுத்தினார்", "ఒక నమ్మకమైన వ్యక్తి ఆమెకు సహాయం చేయడం ఆపేశారు"),
};
