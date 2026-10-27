type Entry = { hi: string; ta: string; te: string };
const e = (hi: string, ta: string, te: string): Entry => ({ hi, ta, te });

// The doctor's search box (top of every doctor page) and the page of all results. English text is the key.
// Run `node tests/i18n-coverage.mjs` after adding text. Wording below was written by an assistant and should be checked by a native speaker.
export const entries: Record<string, Entry> = {
  "Search patients, questions and documents": e("रोगी, प्रश्न और दस्तावेज़ खोजें", "நோயாளிகள், கேள்விகள், ஆவணங்களைத் தேடுங்கள்", "రోగులు, ప్రశ్నలు, పత్రాలను వెతకండి"),
  "Name, record number, phone, question or document": e("नाम, रिकॉर्ड नंबर, फ़ोन, प्रश्न या दस्तावेज़", "பெயர், பதிவு எண், தொலைபேசி, கேள்வி அல்லது ஆவணம்", "పేరు, రికార్డ్ నంబర్, ఫోన్, ప్రశ్న లేదా పత్రం"),
  "Clear search": e("खोज साफ़ करें", "தேடலை அழிக்கவும்", "శోధనను తొలగించండి"),
  "Search results": e("खोज के परिणाम", "தேடல் முடிவுகள்", "శోధన ఫలితాలు"),
  "Type at least 2 characters": e("कम से कम 2 अक्षर लिखें", "குறைந்தது 2 எழுத்துகளை உள்ளிடுங்கள்", "కనీసం 2 అక్షరాలు టైప్ చేయండి"),
  "Could not search. Please try again.": e("खोज नहीं हो सकी। कृपया फिर से कोशिश करें।", "தேட முடியவில்லை. மீண்டும் முயலுங்கள்.", "శోధించడం సాధ్యం కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి."),
  "Searching…": e("खोज रहे हैं…", "தேடுகிறது…", "వెతుకుతోంది…"),
  "No results for “{query}”": e("“{query}” के लिए कोई परिणाम नहीं", "“{query}” க்கு முடிவுகள் இல்லை", "“{query}” కోసం ఫలితాలు లేవు"),
  "Patients": e("रोगी", "நோயாளிகள்", "రోగులు"),
  "Show all {count} patients": e("सभी {count} रोगी दिखाएँ", "அனைத்து {count} நோயாளிகளையும் காட்டு", "మొత్తం {count} రోగులను చూపించండి"),
  "Show all {count} questions": e("सभी {count} प्रश्न दिखाएँ", "அனைத்து {count} கேள்விகளையும் காட்டு", "మొత్తం {count} ప్రశ్నలను చూపించండి"),
  "Show all {count} documents": e("सभी {count} दस्तावेज़ दिखाएँ", "அனைத்து {count} ஆவணங்களையும் காட்டு", "మొత్తం {count} పత్రాలను చూపించండి"),
  "1 patient": e("1 रोगी", "1 நோயாளி", "1 రోగి"),
  "{count} patients": e("{count} रोगी", "{count} நோயாளிகள்", "{count} రోగులు"),
  "1 question": e("1 प्रश्न", "1 கேள்வி", "1 ప్రశ్న"),
  "{count} questions": e("{count} प्रश्न", "{count} கேள்விகள்", "{count} ప్రశ్నలు"),
  "1 document": e("1 दस्तावेज़", "1 ஆவணம்", "1 పత్రం"),
  "{count} documents": e("{count} दस्तावेज़", "{count} ஆவணங்கள்", "{count} పత్రాలు"),
  "Record number: {value}": e("रिकॉर्ड नंबर: {value}", "பதிவு எண்: {value}", "రికార్డ్ నంబర్: {value}"),
  "Phone: {value}": e("फ़ोन: {value}", "தொலைபேசி: {value}", "ఫోన్: {value}"),
  "File name: {value}": e("फ़ाइल का नाम: {value}", "கோப்பின் பெயர்: {value}", "ఫైల్ పేరు: {value}"),
  "Follows a question that matched": e("एक मेल खाते प्रश्न का अनुवर्ती", "பொருந்திய ஒரு கேள்வியின் தொடர்ச்சி", "సరిపోలిన ఒక ప్రశ్నకు కొనసాగింపు"),
  "Results for “{query}”": e("“{query}” के परिणाम", "“{query}” க்கான முடிவுகள்", "“{query}” కోసం ఫలితాలు"),
  "Type at least 2 characters in the search box above.": e("ऊपर खोज बॉक्स में कम से कम 2 अक्षर लिखें।", "மேலே உள்ள தேடல் பெட்டியில் குறைந்தது 2 எழுத்துகளை உள்ளிடுங்கள்.", "పైన ఉన్న శోధన బాక్స్‌లో కనీసం 2 అక్షరాలు టైప్ చేయండి."),
  "Showing the first {count}. Type more words to narrow the search.": e("पहले {count} दिखाए जा रहे हैं। खोज को सीमित करने के लिए और शब्द लिखें।", "முதல் {count} காட்டப்படுகிறது. தேடலைச் சுருக்க மேலும் சொற்களை உள்ளிடுங்கள்.", "మొదటి {count} చూపిస్తున్నాము. శోధనను తగ్గించడానికి మరిన్ని పదాలు టైప్ చేయండి."),
  "Nothing matches “{query}”. Try part of a name, a record number or a word from the question.": e("“{query}” से कुछ मेल नहीं खाता। नाम का कोई हिस्सा, रिकॉर्ड नंबर या प्रश्न का कोई शब्द आज़माएँ।", "“{query}” உடன் எதுவும் பொருந்தவில்லை. பெயரின் ஒரு பகுதி, பதிவு எண் அல்லது கேள்வியிலுள்ள ஒரு சொல்லை முயலுங்கள்.", "“{query}” కు ఏదీ సరిపోలలేదు. పేరులోని కొంత భాగం, రికార్డ్ నంబర్ లేదా ప్రశ్నలోని ఒక పదాన్ని ప్రయత్నించండి."),
  "That question is not on your list.": e("वह प्रश्न आपकी सूची में नहीं है।", "அந்தக் கேள்வி உங்கள் பட்டியலில் இல்லை.", "ఆ ప్రశ్న మీ జాబితాలో లేదు."),
};
