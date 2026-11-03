# Phone sign-in with Twilio Verify

MaternaSync can link a verified Indian mobile number to an existing account, then use SMS codes instead of a password at sign-in. Password sign-in remains available. This is optional passwordless sign-in, not a second factor required after every password login.

## Local setup

1. Finish a real SMS verification in Twilio's **Identity > Verify > Overview > Try out Verify**. The user confirmed that the initial console test reached their phone and was approved.
2. Put the Account SID (`AC...`), Auth Token, and Verify Service SID (`VA...`) into `backend/.env.local`. Use the service SID from the successful trial request. This file is ignored by git. `backend/phone-otp.env.example` documents the names. Never put the Auth Token in React, a `VITE_` variable, a screenshot, or chat.
3. Set `MATERNASYNC_PHONE_OTP_ENABLED=true` and a private `MATERNASYNC_JWT_SECRET`. Changing this secret requires signing in again. Phone sign-in stays hidden when disabled or incompletely configured.
4. Start the API from the project root:

   ```powershell
   backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --env-file backend/.env.local --host 127.0.0.1 --port 8001
   ```

5. In another terminal, start the frontend with `npm.cmd run dev`. Vite's existing default proxy points to port 8001.
6. Sign in with the existing account's password. Open **Profile > Security > Phone sign-in**. Enter your mobile number and current password, request a code, and verify it. This links the number to this account only.
7. Sign out. Select **Phone sign-in**, enter the linked number, request a new SMS, and verify it. A send cooldown of 60 seconds also applies immediately after enrollment; wait for it before requesting the sign-in code.

A number can belong to one login account at a time. Patient, doctor and caregiver accounts use the same flow and retain their own roles. To change the number, remove it in Profile with your current password, then verify the new one. Emergency contacts, medical profile phones and WhatsApp notification recipients never become login identities automatically. Registration still uses the existing account and caregiver-invitation flow.

## Trial restrictions and delivery

Twilio's current trial has 40 successful verification checks, a shared allowance of 100 SMS sends, a 30-day lifetime, and up to five verified recipient numbers. It uses Twilio's trial message wording and generated codes. The app calls Verify's send/check APIs; it does not send arbitrary text or choose a custom code. Confirm your trial's remaining allowance in the console.

The application starts with a global cap of 20 send requests per rolling day, five per number per hour, and 20 per source IP per hour. This is deliberately small for a trial; configure `MATERNASYNC_OTP_DAILY_SEND_LIMIT` deliberately if needed. Invalid/unknown-number requests count toward the application budget too. This cap is separate from Twilio's billing, credit and fraud controls.

Codes are checked only on the backend. The application challenge expires after five minutes even if the provider has a longer validity period. Resends retain that expiry and the attempt count. Five verification attempts are allowed. Request IDs, account/purpose bindings, attempt counts and one-time consumption live in SQLite; no OTP or Auth Token is stored in those tables. Expired challenges and rate records are cleaned up during subsequent sends after the retention window.

Twilio errors never issue a session. A provider acceptance response is not proof of SMS delivery. Use your phone and Twilio logs to confirm delivery. No live SMS was sent from MaternaSync during automated implementation tests; those tests inject a provider stand-in. The user's successful console test is a separate result.

## Deployment notes

For the existing Vercel website and Render API, add these variables under the **Render API service > Environment**:

| Variable | Value |
|---|---|
| `MATERNASYNC_PHONE_OTP_ENABLED` | `true` |
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID (`AC...`) |
| `TWILIO_AUTH_TOKEN` | Your private Twilio Auth Token |
| `TWILIO_VERIFY_SERVICE_SID` | The Verify Service SID (`VA...`) from the successful SMS test |
| `MATERNASYNC_OTP_DAILY_SEND_LIMIT` | `20` for the trial |

Keep the existing server's `MATERNASYNC_JWT_SECRET` if it is already a strong private value of at least 32 characters. The local `.env.local` file is not uploaded by Git or included in the Docker image. Do not put Twilio credentials in Vercel's frontend variables.

Deploy the API from the pushed commit, then deploy the Vercel frontend from the same commit. The deployment documented in `DEPLOYMENT.md` uses manual deployments; pushing alone does not update either host. Once the API has started, `/api/auth/options` should include `"phoneOtpEnabled": true`. Then follow the Profile enrollment and phone sign-in steps above on the Vercel site. On the existing free Render service, linked numbers disappear when its temporary database is reset; enrollment must then be repeated.

Configure these secrets on the API host and serve the application over HTTPS. Leave demo accounts disabled for real patient data. This integration uses the project's current shared SQLite database for limits and atomic challenge consumption. Set trusted proxy addresses correctly in Uvicorn so client-IP limits cannot be bypassed with untrusted forwarding headers. A publicly accessible rollout also needs appropriate bot/abuse controls and Twilio's geographic/fraud/spend restrictions; the small trial cap alone is not a complete production abuse policy.

The frontend cannot supply a role or choose an account ID during verification. Enrollment requires the current password and an SMS code. Account closure, session-version changes, number removal, and disabled roles prevent pending challenges from authenticating. Login responses for unknown numbers use the same generic challenge shape and send no SMS.

## Validation

```powershell
backend\venv\Scripts\python.exe -m unittest discover -s backend/tests -p test_phone_auth.py -v
node tests/i18n-coverage.mjs
node tests/scope-guard.mjs
npm.cmd run build
```

The provider has no environment-controlled fake mode or master OTP. Tests use FastAPI dependency overrides in an isolated process and database.

Provider references: [Verify trial](https://www.twilio.com/docs/usage/trials/try-out-verify), [start verification](https://www.twilio.com/docs/verify/api/verification), [check verification](https://www.twilio.com/docs/verify/api/verification-check).
