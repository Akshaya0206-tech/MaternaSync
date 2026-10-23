# MaternaSync

React/TypeScript patient, doctor and care-team portals backed by FastAPI and SQLite. The roadmap implementation reuses the existing episodes, assignments, consultations, documents, questions, tasks, notifications, journeys and audit logs.

## Run locally (PowerShell)

```powershell
npm.cmd install
python -m venv backend/venv
backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/venv/Scripts/python.exe backend/fetch_reference_documents.py
backend/venv/Scripts/python.exe -m uvicorn backend.app.main:app --reload --port 8001
```

`fetch_reference_documents.py` is optional: it downloads the open-licence guideline PDFs for passage search (see Reference Library below). In another terminal, run `npm.cmd run dev`, then open `http://localhost:5173/signin`. Existing installations can retain their virtual environment and database. New tables are additive and created at API startup. Demo seeds are idempotent.

## Demo logins

The sign-in page has **Demo Patient**, **Demo Care Team**, and **Demo Doctor** buttons. Each performs a real authenticated login and opens its role workspace. Credentials can also be expanded on the page.

| Portal    | Email                         | Password        |
| --------- | ----------------------------- | --------------- |
| Patient   | sarah.jenkins@maternasync.app | SarahDemo123!   |
| Care Team | brenda.miller@maternasync.app | BrendaDemo123!  |
| Doctor    | demo@maternasync.app          | MaternaDemo123! |

These accounts use synthetic records. `MATERNASYNC_DEMO_ENABLED=false` hides shortcuts and prevents demo seeding. It does **not** delete or disable accounts already in a database. Legacy nurse/coordinator/other accounts retain their legacy workspace; the three PDF roles use the new portals.

## PDF feature coverage

| Feature                         | Implementation / location                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30-day trends and anomaly flags | Today's Brief and Connected Care: dated BP/weight charts, symptoms, mood, movements, adherence, units, missingness, corrections and sources. Flags require approved rules.                                     |
| Risk / next action              | Review rules a doctor approves (Reference Library → Review rules): each has a tier (urgent / soon / routine), a source and a written next action. Matching readings become flags with the rule, the recorded value and the next action; a doctor records a decision (create an owned task, or no action and why) and each decision is audited. The review priority is only the order to look in. It is not a clinical risk score, and nothing is sent or assigned until a doctor confirms. |
| Condition pathways              | Versioned administrative steps; doctor confirmation generates owned, dated tasks once per version/episode. GDM, pre-eclampsia and anaemia starter drafts require review.                                       |
| Prescription writer             | Document Studio: clinician-entered medicine, dose, route, frequency and duration with doctor signature. After each save a drug safety check runs on recorded allergies plus the doctor-approved list in Reference Library → Drug safety checks (21 interaction pairs and 29 pregnancy cautions quoted from US product labels on DailyMed, with links). Every alert must be acknowledged before signing, and the acknowledgement is audited. With no approved list the screen says the check is **unchecked**. This is not a complete interaction database: generic names only, US labels, no brand lookup, and an allergy to a drug class does not flag other members of the class. |
| Mixed-language voice            | Consultations: auto detection, English, Hindi/Hinglish, Tamil and Telugu. The original transcript remains editable before approval.                                                                            |
| WhatsApp sharing                | Consent, recipient confirmation, purpose/expiry checks and a minimal sign-in notification (no name, result or medicine). Three modes: `cloud_api` sends through the WhatsApp Business Cloud API and records sent / delivered / read / failed from the provider's webhook (a STOP reply withdraws consent); `simulator` (default in demo mode) generates statuses and labels everything SIMULATED; `manual` gives a `wa.me` composer link and a staff "I sent it" record with delivery unconfirmed. |
| Patient explanations            | Document Studio → Patient explanation: finds the conditions the approved note actually discusses (gestational diabetes, high blood pressure, anaemia, scans) and adds the clinic-approved plain-language explanation of each in the chosen language, next to what the doctor recorded. A condition with no approved explanation is flagged, not invented. The doctor edits and signs before release. |
| Document generators             | Draft discharge summaries, referral letters, consent forms, certificates, operative notes and insurance paperwork from verified sources.                                                                       |
| Guideline-aware references      | Reference Library: 76 real documents from WHO, MoHFW/ICMR/FOGSI and other Indian bodies, NICE and the major societies, each with publisher link, section, version/currency note and a rights note, seeded as drafts for a doctor to approve. Passage search covers only openly licensed PDFs (WHO, MoHFW GDM guideline), downloaded locally. Filters, review dates, version history and internal citations on notes, handovers and questions. |
| ICD-10 candidates               | Reference Library → ICD-10 code sets: 80 obstetric codes from the WHO ICD-10 (2019) tabular list as phrase-to-code sets. A doctor approves them, then Document Studio → "Find candidate ICD-10 codes" proposes codes for phrases actually present in the preserved source text, with the matched phrase and a link. Proposals need specific wording (for example "gestational hypertension", "anaemia in pregnancy"), may match negated or historical text, and nothing is assigned until the doctor selects it. |
| Custom note templates           | SOAP, ANC, follow-up and handover starter layouts; configurable fields, required fields, organization defaults and versions. Used in Document Studio.                                                          |
| Daily logging                   | Optional BP, weight, symptoms, mood, adherence, timestamps, units, skips and corrections with immutable history.                                                                                               |
| Kick counter                    | Count and timer saved as patient-reported observations. No interpretation, thresholds or reassurance; use clinician-provided instructions.                                                                     |
| Medicine/vaccine reminders      | Doctor-approved schedules from approved consultations. Care team can schedule visit/task reminders. Persistent repeats; done/skipped/needs-help responses; help requests create tasks.                         |
| Regional-language companion     | Whole patient portal (menu, pages, dates, statuses) in English, Hindi, Tamil and Telugu with a language switcher saved to the account. The companion is a chat for navigation and doctor-approved education: it matches keywords/TF-IDF against approved modules (never generates text), shows reviewer, version and review date, sends urgent warning signs to a fixed emergency message, and offers to pass medical questions to the care team only when the patient presses send. Optional browser voice input/read-aloud where the device supports the language. Not a diagnostic chatbot; the question text is not stored by the companion.                  |
| Lab report explanation          | Reads result rows that literally appear in a verified report (one-line and cell-per-line layouts), shows each next to its original line, compares it with the range printed on the report, and adds a general "what this test measures" note (about 20 antenatal tests, four languages). What the results mean for the patient and the next steps stay as placeholders that block approval until the doctor writes them. Infection-screening results trigger a sensitivity warning. No automatic interpretation is released.                                                                        |
| Consent controls                | Recipient, purpose, duration, revocation, opt-out and consent history for external notifications.                                                                                                              |
| Trimester/postpartum content    | Governed modules with language, stage, owner, source and review dates. Nutrition, movement, labour, birth-plan, recovery and lactation discussion guides start as drafts.                                      |
| Plain-language visit summary    | Pre-filled from the approved consultation in the patient's language: recorded wording as bullets, abbreviations explained once, the next appointment, open questions, and approved general education, with confirmed steps kept separate from general information. A visit with no documented next steps gets a blocking placeholder. Clinical text is not machine-translated; a review note warns when the notes are in a different language from the summary. Linked to the visit; appears in My Care Plan, Appointments and the approved journey.                                                                                                      |
| Compliance/missed-log queue     | Only explicitly agreed check-in intervals trigger follow-up, with a named owner. Missing data is separated from clinical concern.                                                                              |
| Shared clinic dashboard         | Authorized caseload/clinician filters; open, overdue and unassigned tasks; upcoming visits, requests and monitoring ownership.                                                                                 |
| Pathway tasks and handover      | Tasks appear in existing queues. Owner, due date and source carry into handovers, along with unresolved document drafts and visit requests.                                                                    |
| Outcome tracking                | Verified-document-backed scan/delivery outcomes and actual no-shows; visible denominators exclude missing data.                                                                                                |
| Multilingual reply drafts       | Administrative starters in all four languages, edited and reviewed before release. Clinical questions require a doctor's approval, including on the existing care-team API.                                    |
| Reminder outreach               | Consent-checked WhatsApp workflow (see WhatsApp sharing). Delivery is confirmed only by the Cloud API provider; the simulator and manual modes say so.                                                          |
| Insurance/certificates          | Care team prepares drafts; doctor signs and optionally releases.                                                                                                                                               |
| Continuity and audit            | New data shares an episode. Backend role and assignment checks, material access/edit/approval/consent logs, and source snapshots.                                                                              |

### Governance and integrations

Starter education modules are seeded in all four languages as drafts. A doctor approves them from the Reference Library, one at a time or as a batch with an explicit "I reviewed each" confirmation, before the care companion or summaries can use them. The Hindi, Tamil and Telugu wording of the app and of the starter modules should be checked by a native speaker from the clinic before real use. `node tests/i18n-coverage.mjs` fails if any patient-portal string lacks a translation.

Risk flags, drug-safety alerts and ICD-10 candidates are deterministic lookups into lists a doctor approved. They are not clinical scores, diagnoses or treatment advice, and nothing is acted on until a doctor decides. Clinical resources start as **DRAFT**; approval records the acting doctor and requires a future review date. This is a single-clinic prototype governance workflow, not a claim of institutional or regulatory approval.

**Reference Library.** Real documents only; the earlier demonstration guidelines and the one-link-per-publisher placeholders are removed at startup (an approved placeholder is retired, not deleted, so its audit history stays). The entries live in `backend/app/data/reference_library_*.json` and are added as drafts on startup, idempotently. Each cites the document, links to the publisher, summarises it in the app's own words and records its licence. Licences differ: only openly licensed documents (WHO under CC BY-NC-SA 3.0 IGO, and the MoHFW GDM guideline, which allows excerpts with acknowledgement) are indexed for passage search; ICMR, NICE (outside the UK), SIGN and the societies are link-only. Run `backend/venv/Scripts/python.exe backend/fetch_reference_documents.py` once to download those 15 PDFs from their publishers into `backend/reference_documents/` (ignored by git); the next API start indexes them for a doctor to approve on the Guidelines page. A few entries are flagged in their currency note as possibly superseded, and figo.org blocks automated checks, so a reviewer should confirm the current version of each before approving.

**Drug safety data.** `backend/app/data/drug_safety_labels.json` holds the interaction pairs and pregnancy cautions with the label wording quoted and linked. They come from US labels on DailyMed (read October 2026), not Indian product information, and a clinic should review and extend them. ICD-10 codes in `backend/app/data/icd10_obstetric.json` were checked against the WHO ICD-10 (2019) tabular list.

Drafting is deterministic and source-based. It does not silently call a remote LLM or automatically translate clinical text. ICD phrase matching may match historical/negated text, so candidates require review. Real-audio language accuracy still needs clinical validation; the automated voice test checks the API contract with a mocked decoder.

WhatsApp messages are a minimal sign-in prompt with no clinical content. Real sending needs a WhatsApp Business account: set `MATERNASYNC_WHATSAPP_PROVIDER=cloud_api` with the token, phone-number id, app secret and webhook verify token below, and point Meta's webhook at `/api/v2/webhooks/whatsapp`. Sending through Meta has been tested here only against a mocked API, so try it with a test number first. Without credentials the app runs in `simulator` mode in demo mode (every status is labelled SIMULATED) or `manual` mode (composer link plus a staff "I sent it" record, delivery unconfirmed). Due in-app reminders are materialized on portal activity; background push is not configured.

SQLite and keyword retrieval are retained. PostgreSQL/pgvector and passage-constrained LLM summaries are optional infrastructure from the PDF, not required dependencies added here.

## Validation

```powershell
npm.cmd run build
npm.cmd run lint
node tests/i18n-coverage.mjs
backend/venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
backend/venv/Scripts/python.exe -m unittest discover -s backend/tests -v
```

Integration tests use a temporary database/upload directory. Coverage includes authentication, role isolation, corrections, rules/versioning, citations, approval, required fields, education visibility, pathways, task assignment, reminders, consent revocation, appointments, outcome denominators, codes/prescriptions, PDF extraction and existing consultation/question/handover flows.

`tests/browser-smoke.mjs` checks all three demo buttons, persistence, consent, Tamil navigation, appointment triage, document release, references, runtime errors and mobile layout. Use an installed Playwright package or set `PLAYWRIGHT_MODULE` to an existing Playwright `index.mjs`.

Optional browser dependencies:

```powershell
npm.cmd install --no-save --package-lock=false playwright
npx.cmd playwright install chromium
```

Run isolated test servers in separate terminals:

```powershell
New-Item -ItemType Directory .test-output -Force
$env:MATERNASYNC_DATABASE_URL='sqlite:///D:/Projects/MaternaSync/MaternaSync/.test-output/browser.db'
$env:MATERNASYNC_UPLOAD_DIR='D:/Projects/MaternaSync/MaternaSync/.test-output/uploads'
backend/venv/Scripts/python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8002
```

```powershell
$env:VITE_API_TARGET='http://127.0.0.1:8002'
npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

```powershell
node tests/browser-smoke.mjs
```

Adjust database/upload paths for a different checkout. Screenshots go to ignored `.test-output/`. Close the test servers and clear these shell overrides before returning to the normal app.

## Configuration

| Variable                    | Purpose                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `MATERNASYNC_DATABASE_URL`  | Alternate SQLite database (default `backend/maternasync.db`)                     |
| `MATERNASYNC_UPLOAD_DIR`    | Documents/recordings (default `backend/uploads`)                                 |
| `MATERNASYNC_DEMO_ENABLED`  | Demo shortcuts/seeding, default `true` for this prototype                        |
| `MATERNASYNC_JWT_SECRET`    | Signing secret for non-demo deployment                                           |
| `MATERNASYNC_WHISPER_MODEL` | Multilingual Whisper model/path; default `base`. First use may download weights. |
| `VITE_API_TARGET`           | Dev proxy destination, default `http://localhost:8001`                           |
| `MATERNASYNC_WHATSAPP_PROVIDER` | `cloud_api`, `simulator` or `manual`; default `simulator` in demo mode, else `manual` |
| `MATERNASYNC_WHATSAPP_TOKEN`, `_PHONE_ID` | WhatsApp Business Cloud API access token and phone-number id (`cloud_api`) |
| `MATERNASYNC_WHATSAPP_APP_SECRET`, `_VERIFY_TOKEN` | Verify the `X-Hub-Signature-256` signature and the webhook handshake |
| `MATERNASYNC_WHATSAPP_TEMPLATE`, `_LANGUAGE`, `_API_VERSION` | Optional approved message template, its language code and the Graph API version |
