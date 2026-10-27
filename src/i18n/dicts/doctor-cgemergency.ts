type Entry = { hi: string; ta: string; te: string };
const e = (hi: string, ta: string, te: string): Entry => ({ hi, ta, te });

// The sentence the doctor's Audit trail shows when a trusted person opens "Show this to the hospital" on their Emergency help page.
// English text is the key. Wording below was written by an assistant and should be checked by a native speaker.
export const entries: Record<string, Entry> = {
  "A trusted person opened the hospital card": e("एक भरोसेमंद व्यक्ति ने अस्पताल कार्ड खोला", "ஒரு நம்பகமான நபர் மருத்துவமனை அட்டையைத் திறந்தார்", "ఒక నమ్మకమైన వ్యక్తి ఆసుపత్రి కార్డును తెరిచారు"),
};
