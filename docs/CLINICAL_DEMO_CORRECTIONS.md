# Clinical demonstration content corrections

Updated 4 November 2026 following mentor feedback. These are synthetic demonstration records, not changes to real patient findings or a new diagnostic feature.

- **Glucose screening:** the example now uses the Indian single-step DIPSI protocol: 75 g oral glucose irrespective of the last meal, followed by a two-hour measurement. Sarah's illustrative result is 162 mg/dL; her first-contact example is 118 mg/dL, with repeat testing at 24–28 weeks. The source document ID stays `LAB-OGTT-8812` to preserve existing links. Titles, raw example payloads, summaries and full example notes are consistent. Ananya's separate example also uses DIPSI.
- **Fetal sex:** removed from the synthetic NIPT summary and full report, so neither the journey nor its source example discloses it. This is a correction to the supplied demonstration content, not a claim that arbitrary uploaded documents are automatically redacted.
- **First visit:** hemoglobin, blood group/Rh, patient-reported pre-pregnancy weight and measured intake weight are visible in the first-visit record. The preparation checklist also asks patients to bring existing Hb and blood-group reports and earlier weight/BP records. New items are appended so saved checklist ticks keep their meaning.
- **Hypertension and weight:** the example distinguishes documented pre-existing hypertension from the current BP reading and separately records weight change. Weight gain alone is not used to diagnose hypertension or pre-eclampsia. Existing clinical-value risk rules remain disabled.
- **Doppler:** the synthetic referral documents chronic hypertension as the indication for fetal growth, amniotic fluid and umbilical artery Doppler assessment. Diabetes remains a separately documented condition.

## Sources checked

- [MoHFW/NHM: Diagnosis & Management of Gestational Diabetes Mellitus, Technical and Operational Guidelines](https://nhm.gov.in/New_Updates_2018/NHM_Components/RMNCH_MH_Guidelines/Gestational-Diabetes-Mellitus.pdf): single-step 75 g testing, two-hour threshold of 140 mg/dL or above, first-contact testing and repeat at 24–28 weeks after a negative first test. The document calls this an OGTT; the demo uses the explicit DIPSI label and protocol rather than confusing it with a 50 g challenge test.
- [MoHFW: Mother and Child Protection Card, 2018](https://nhm.gov.in/New-Update-2022-24/CH-Programmes/HBNC-%26-HBYC-Resource-%20Material/Revised-India-MCP-Card-English-%2828-05-2018%29.pdf): antenatal hemoglobin, blood group/Rh, weight and blood-pressure recording.
- [NICE NG133, recommendations 1.6.1–1.6.4](https://www.nice.org.uk/guidance/ng133/chapter/Recommendations#fetal-monitoring): growth, fluid and umbilical artery Doppler surveillance for hypertensive pregnancies. This supports the example's referral indication; it is not an India-specific scheduling rule implemented by the app.

## Deployment

Deploy both the backend and frontend revisions. With demo mode enabled, backend startup updates exact known older demonstration fields in existing seeded accounts. Uploaded files, clinician-edited fields, approved consultations, identity links and workflow status are preserved. No database reset or patient-data deletion is required. The frontend supplies the added checklist items and translated DIPSI title; the backend supplies corrected journey/source content and glossary definitions.
