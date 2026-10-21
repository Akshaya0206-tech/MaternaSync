# MaternaSync

React/TypeScript patient, doctor and care-team portals backed by FastAPI and SQLite. The roadmap implementation reuses the existing episodes, assignments, consultations, documents, questions, tasks, notifications, journeys and audit logs.

## Run locally (PowerShell)

```powershell
npm.cmd install
python -m venv backend/venv
backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/venv/Scripts/python.exe -m uvicorn backend.app.main:app --reload --port 8001
```

In another terminal, run `npm.cmd run dev`, then open `http://localhost:5173/signin`. Existing installations can retain their virtual environment and database. New tables are additive and created at API startup. Demo seeds are idempotent.

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
| Risk / next action              | Governed workflow review rules for overdue tasks and agreed missing check-ins; reviewer, version, comparison and source shown. No autonomous risk score or treatment selection.                                |
| Condition pathways              | Versioned administrative steps; doctor confirmation generates owned, dated tasks once per version/episode. GDM, pre-eclampsia and anaemia starter drafts require review.                                       |
| Prescription writer             | Document Studio: clinician-entered medicine, dose, route, frequency and duration with required fields and doctor signature. Interaction checks are explicitly **unchecked**, pending a verified drug database. |
| Mixed-language voice            | Consultations: auto detection, English, Hindi/Hinglish, Tamil and Telugu. The original transcript remains editable before approval.                                                                            |
| WhatsApp sharing                | Consent, recipient confirmation, purpose/expiry checks, minimal sign-in notification, composer link and recorded preparation/cancellation. No clinical text in the URL.                                        |
| Patient explanations            | Editable drafts from approved consultations with plain-language headings, source snapshots and clinician release.                                                                                              |
| Document generators             | Draft discharge summaries, referral letters, consent forms, certificates, operative notes and insurance paperwork from verified sources.                                                                       |
| Guideline-aware references      | Search and issuer/topic/type/date/jurisdiction filters; permitted PDF/text, OCR fallback, original downloads, review dates, version history and internal citations on notes, handovers and questions.          |
| ICD-10 candidates               | Import/approve verified phrase-code sets, find candidates in preserved source text, and record the final human-selected codes. No unverified code database is bundled.                                         |
| Custom note templates           | SOAP, ANC, follow-up and handover starter layouts; configurable fields, required fields, organization defaults and versions. Used in Document Studio.                                                          |
| Daily logging                   | Optional BP, weight, symptoms, mood, adherence, timestamps, units, skips and corrections with immutable history.                                                                                               |
| Kick counter                    | Count and timer saved as patient-reported observations. No interpretation, thresholds or reassurance; use clinician-provided instructions.                                                                     |
| Medicine/vaccine reminders      | Doctor-approved schedules from approved consultations. Care team can schedule visit/task reminders. Persistent repeats; done/skipped/needs-help responses; help requests create tasks.                         |
| Regional-language companion     | English, Hindi, Tamil and Telugu navigation, saved preference, approved education by language/stage, and medical questions routed to clinicians. Guided navigation, not a diagnostic chatbot.                  |
| Lab report explanation          | Verified-report-based editable draft, original source preserved, doctor review before release. No automatic interpretation is released.                                                                        |
| Consent controls                | Recipient, purpose, duration, revocation, opt-out and consent history for external notifications.                                                                                                              |
| Trimester/postpartum content    | Governed modules with language, stage, owner, source and review dates. Nutrition, movement, labour, birth-plan, recovery and lactation discussion guides start as drafts.                                      |
| Plain-language visit summary    | Reviewed output linked to an appointment; appears in My Care Plan, Appointments and the approved journey.                                                                                                      |
| Compliance/missed-log queue     | Only explicitly agreed check-in intervals trigger follow-up, with a named owner. Missing data is separated from clinical concern.                                                                              |
| Shared clinic dashboard         | Authorized caseload/clinician filters; open, overdue and unassigned tasks; upcoming visits, requests and monitoring ownership.                                                                                 |
| Pathway tasks and handover      | Tasks appear in existing queues. Owner, due date and source carry into handovers, along with unresolved document drafts and visit requests.                                                                    |
| Outcome tracking                | Verified-document-backed scan/delivery outcomes and actual no-shows; visible denominators exclude missing data.                                                                                                |
| Multilingual reply drafts       | Administrative starters in all four languages, edited and reviewed before release. Clinical questions require a doctor's approval, including on the existing care-team API.                                    |
| Reminder outreach               | Consent-checked external composer workflow; delivery remains unconfirmed without provider integration.                                                                                                         |
| Insurance/certificates          | Care team prepares drafts; doctor signs and optionally releases.                                                                                                                                               |
| Continuity and audit            | New data shares an episode. Backend role and assignment checks, material access/edit/approval/consent logs, and source snapshots.                                                                              |

### Governance and integrations

The PDF defers unvalidated clinical scoring, interaction checking and autonomous treatment. These are not represented as working clinical engines. Clinical resources start as **DRAFT**; approval records the acting doctor and requires a future review date. This is a single-clinic prototype governance workflow, not a claim of institutional or regulatory approval.

Starter links point to [FOGSI–ICOG](https://www.fogsi.org/fogsi-icog-gcpr/), [ICMR workflows](https://www.icmr.gov.in/standard-treatment-workflows-stws), [WHO antenatal care](https://www.who.int/publications/i/item/9789241549912), and [NICE NG201](https://www.nice.org.uk/guidance/ng201). Third-party guidance is not redistributed with the app. Reviewers must confirm version, usage permissions and applicability before adding permitted passages/files. Additional issuers can be curated through the library.

Drafting is deterministic and source-based. It does not silently call a remote LLM or automatically translate clinical text. ICD phrase matching may match historical/negated text, so candidates require review. Real-audio language accuracy still needs clinical validation; the automated voice test checks the API contract with a mocked decoder.

WhatsApp uses `wa.me` with a minimal sign-in notification. `PREPARED`, `COMPOSER_LINK_READY` and `CANCELLED` describe this app's actions. Automatic dispatch and delivery callbacks require an authorized provider. No external message is sent automatically. Due in-app reminders are materialized on portal activity; background push is not configured.

SQLite and keyword retrieval are retained. PostgreSQL/pgvector and passage-constrained LLM summaries are optional infrastructure from the PDF, not required dependencies added here.

## Validation

```powershell
npm.cmd run build
npm.cmd run lint
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
