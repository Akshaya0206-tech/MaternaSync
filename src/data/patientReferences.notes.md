# Patient References: review notes

The text on the patient **References** page (`patientReferences.ts`) was written from official pages (MoHFW/NHM, ICMR-NIN, WHO, NHS) and every source link was opened and returned HTTP 200 when it was written. It is general information, not advice for one patient.

**Before real use, a clinician at the clinic should read the English text, and a native speaker should read the Hindi, Tamil and Telugu text.** Neither review has happened yet.

## How it was checked

Checked on 2026-10-24. Every statement was written in the author's own words from official pages that were opened that day: HTML pages with WebFetch, and PDFs downloaded and read as text. Source priority was MoHFW/NHM/MWCD/ICMR-NIN (India), then WHO, then NHS (UK) for general medical topics. All listed URLs returned HTTP 200 on 2026-10-24 and are the final URLs after redirects. Several Indian documents are older (MCP card 2018 version, GDM guideline December 2014, Td guidelines about 2019, Safe Motherhood booklet undated) and should be re-checked against current MoHFW releases. UK-only details (phone numbers, NHS service names) were not used; only the general medical advice was. Not yet reviewed by a clinician or by native speakers of Hindi, Tamil and Telugu.

## Edits made after the first draft

- The sentence saying mothers need not count kicks was removed, because a clinic may ask for movement counts.
- The PMMVY amount and instalments were removed: they came from a single source and differ between official documents.
- The 104 helpline was removed: it is a state-level service that may not exist where the patient lives.

## Things that could not be confirmed (left out or stated with care)

- A dedicated national maternal-health helpline for patients: none could be confirmed. The PMSMA portal shows a toll-free number (1800-180-1104), but the pages found link it to volunteer-doctor registration, so it was left out. 104 is included only as a state-level health helpline named in MoHFW guidelines; whether it works in a given state is not confirmed.
- Government scheme amounts: the NHM Janani Suraksha Yojana page lists cash amounts by state group and rural or urban area but has no 'as of' date for them, and later orders may have changed them, so they were left out. The PMMVY amount (Rs 5,000 in two instalments) is quoted only from the March 2026 PIB backgrounder, with attribution. The 2018 MCP card describes PMMVY in three instalments and the PMMVY portal homepage opened did not state amounts or eligibility, so figures may differ. The wcd.gov.in pages could not be opened (connection or certificate errors).
- Number of antenatal check-ups: Indian documents differ (booklet: 4 check-ups; MCP card: register and then at least 3; WHO: at least 8 contacts). All three are stated and the care team decides.
- Calcium supplement schedule: no dedicated MoHFW calcium page was opened. Calcium tablets are mentioned only on the PMSMA benefits page, the MCP card and the ICMR-NIN guideline, so no timing or quantity is given.
- Which signs should make a pregnant woman stop exercising: the WHO guideline says women should be told these signs but does not list them, so no list is given.
- Other vaccines in pregnancy (for example influenza or whooping cough): not named in the Indian official sources opened, so left out. Whether Td has fully replaced TT in every state is not confirmed.
- Sleep position: the Indian booklet says to lie on the left side; the NHS says either side is safe and warns against going to sleep on the back after 28 weeks. Both are stated.
- RCOG patient information on baby movements was not opened; NHS and the Indian MCP card were used instead.
- Gestational diabetes: the Indian guideline opened is from December 2014 and may have been updated. Testing is described as covering all pregnant women, but states choose where it is rolled out, so local availability is not confirmed.
- The ICMR-NIN 2024 guideline gives no pregnancy-specific food-safety list; general food-safety and safe-water points from the same document were applied to pregnancy.

## Wording a native speaker should look at

- All languages: abbreviations ANM, ASHA, MCP, IFA, BP, Td, TT, JSY, JSSK, PMMVY, PMSMA, FRU, BCG and Tele-MANAS are kept in Latin letters because that is how they appear on cards and posters. Please confirm whether a local-script form is preferred in each state.
- All languages: 'care team' and 'maternity team' follow the app vocabulary (hi देखभाल टीम / मातृत्व टीम; ta பராமரிப்புக் குழு / மகப்பேறு குழு; te సంరక్షణ బృందం / ప్రసూతి బృందం). In ta and te the 'maternity team' wording is used only in the baby-movements topic.
- All languages: the standard last sentence of each summary ('This is general information, so please follow the advice of your own care team') should be checked for a natural, respectful tone.
- hi: 'प्रसव' is used for both labour/birth and delivery; 'प्रसव पीड़ा' for labour pains. Please check it reads naturally. 'खीस' is used for colostrum (regional; some areas say 'पहला दूध').
- hi: 'योनि' (vagina) and 'जननांग' (genital area) are used plainly; please confirm they are acceptable in patient-facing text, or suggest softer wording.
- hi: 'मृत शिशु का जन्म (स्टिलबर्थ)' for stillbirth; 'अवसाद (डिप्रेशन)' for depression; 'जेस्टेशनल डायबिटीज़' is used because it is the term women hear in clinics (formal term: गर्भावधि मधुमेह).
- hi: 'घुट्टी (ग्राइप वॉटर)' for gripe water; confirm that 'घुट्टी' matches what families call it.
- hi: feminine forms are used for the reader ('आप ... रही हैं', 'कर सकती हैं'). Please check agreement everywhere.
- ta: 'பனிக்குடம்' (water bag), 'சீம்பால்' (colostrum), 'அனீமியா' (anaemia; 'இரத்தசோகை' is used once in the iron summary) - please decide on one term. 'ஸ்டில்பர்த்' is a transliteration; a descriptive phrase is used with it.
- ta: 'பிறப்புறுப்பு' is used for vagina and genital area; confirm it is the preferred everyday word. 'ப்ரீ-எக்லாம்ப்சியா' is a transliteration; there is no common lay word.
- ta: 'தாய்-சேய் பாதுகாப்பு அட்டை' is a translation of the Mother and Child Protection card and may not match the name on Tamil Nadu's own pregnancy card. 'ஆஷா' and 'அங்கன்வாடி' are transliterations.
- ta: 'முதல் பரிந்துரை அலகு (FRU)', 'சுரக்ஷித் மாத்ரித்வ அபியான்' and the other scheme names are transliterated or literally translated; please confirm the forms used in Tamil Nadu.
- te: 'నీటి సంచి' (water bag; some people say 'ఉమ్మనీరు పొర'), 'ముర్రుపాలు' (colostrum), 'కాన్పు' (delivery/birth; 'ప్రసవం' used for labour pains), 'పిక్కలు' (calf muscles). Please confirm these are the words used in Telangana and Andhra Pradesh.
- te: 'ఎనీమియా' is used with 'రక్తహీనత' once; 'స్టిల్‌బర్త్' is a transliteration; 'జననేంద్రియ ప్రాంతం' is used for the genital area - please confirm it is acceptable.
- te: 'సురక్షిత మాతృత్వ పుస్తకం' (Safe Motherhood booklet) and 'తల్లి-బిడ్డ రక్షణ కార్డు' (MCP card) are literal translations; local names may differ.
- All languages: sentences that quote what a government source says (for example the PMMVY amount, the PMSMA day, or the 24-hour helpline) are worded as 'the government site says ...'. Please keep that attribution when polishing.
