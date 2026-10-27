# Deploying MaternaSync

The project is two programs, and they go to two different places.

```
 browser ──► Vercel (the website: static files built from src/)
    │
    └──────► the API host (FastAPI + SQLite on a persistent disk, runs all the time)
```

**Why two places.** Vercel is excellent for the website. It cannot run the API as it is: the API keeps its database and uploaded files on disk,
runs background jobs (the care assistant's queue every 5 seconds, reminder sweeps every 5 and 30 minutes), takes about a minute to start for the first
time, and uses OCR and speech packages that do not fit a serverless function. So the website goes on Vercel and the API goes on a host that keeps a
process running (Render is set up below; Railway, Fly.io or any server with Docker work the same way).

> What was tested: the site built exactly as below, served on one address and calling the API on another (sign-in, JSON, PATCH, PUT, a file upload with the
> token, error messages), the API's cross-origin rules, and a real deployment of the website to Vercel (see "Deployed so far" at the end). The Docker image
> build and the Render blueprint were not run (Docker was not available when this was written).

## 1. The API (do this first, you need its address)

### Render (a blueprint is in `deploy/render.yaml`)

1. Push the repository to GitHub.
2. Render dashboard → **New → Blueprint** → choose the repository and set the **Blueprint file path** to `deploy/render.yaml`. Render builds `backend/Dockerfile` and attaches a 1 GB disk at `/data`.
   A persistent disk needs a paid plan; without it the database and uploads are erased at every restart.
   (The blueprint is in `deploy/`, not at the root, on purpose: Vercel reads a root `render.yaml` as a backend "service" and then refuses the build settings in `vercel.json`.)
3. When it asks for `MATERNASYNC_CORS_ORIGINS`, type the address the website will have, for example `https://maternasync.vercel.app`. You can change it later.
4. Wait for the first start (a minute or more: it creates the database, adds the demonstration data and indexes the reference PDFs).
   Check `https://YOUR-API.onrender.com/api/health` shows `{"status": "ok"}`.

### Render, free plan (what is running now)

No blueprint is needed: the public repository can be built straight from its address. With the Render CLI (`render login` first):

```bash
render services create --name maternasync-api --type web_service --runtime docker \
  --repo https://github.com/Akshaya0206-tech/MaternaSync --branch main --root-directory backend \
  --plan free --region singapore --health-check-path /api/health --auto-deploy=false \
  --env-var "MATERNASYNC_JWT_SECRET=<a long random value>" --env-var "MATERNASYNC_DEMO_ENABLED=true" \
  --env-var "MATERNASYNC_CORS_ORIGINS=https://maternasync.vercel.app" --output json --confirm
```
`--root-directory backend` makes `backend/Dockerfile` the image. `--auto-deploy=false` because a public repository connected by address has no webhook: after a push, use
**Manual Deploy** in the dashboard (or `render deploys create SERVICE_ID`).

What the free plan means:
- **It sleeps after 15 minutes without traffic.** The next request wakes it, and the API then starts from scratch (measured: about 90 seconds). Open the site a couple of minutes before a demonstration.
- **There is no disk, so the database and uploads are erased at every sleep, restart and deploy.** The demonstration accounts come back each time (`MATERNASYNC_DEMO_ENABLED=true`); anything entered during a session does not.
- **The background jobs (assistant queue, reminders) only run while it is awake.**
- **512 MB of memory.** It started and served requests within that in the first checks; if it is ever killed for memory, a paid instance is the fix.
- All free web services in one Render workspace share **750 instance-hours a month**.
For anything that must keep data, use the paid blueprint above (a persistent disk needs a paid plan).

### Anywhere else with Docker

```bash
docker build -t maternasync-api backend
docker run -p 8000:8000 -v maternasync-data:/data \
  -e MATERNASYNC_JWT_SECRET="$(openssl rand -hex 32)" \
  -e MATERNASYNC_CORS_ORIGINS="https://maternasync.vercel.app" \
  maternasync-api
```
Always run **one** worker (the Dockerfile does): the database is SQLite and the background jobs must not run twice.

### Backend settings

| Variable | Meaning |
|---|---|
| `MATERNASYNC_JWT_SECRET` | **Required.** Signs every sign-in. Render generates one. If it changes, everyone is signed out. Without it the API warns at start-up and uses a public development secret. |
| `MATERNASYNC_CORS_ORIGINS` | **Required for Vercel.** The website's address(es), comma separated, no trailing slash. Only these pages may call the API from a browser. A bare `*` is ignored on purpose. |
| `MATERNASYNC_CORS_ORIGIN_REGEX` | Optional. For Vercel preview addresses, for example `^https://maternasync-[a-z0-9-]+\.vercel\.app$`. Keep it as narrow as you can. |
| `MATERNASYNC_DEMO_ENABLED` | `true` seeds the demonstration accounts and shows the demo buttons (good for a judges' demo). `false` for anything real. |
| `MATERNASYNC_SEMANTIC_SEARCH` | Optional. Searching the Reference Library by meaning (Hindi, Tamil and Telugu questions find English passages) needs a 135 MB model and about 300 MB of memory, so it is **not** in the Docker image and cannot run on the free Render plan: there the search works by words, as before. On a bigger host or locally: `python fetch_search_model.py`, `python build_semantic_index.py`, restart. |
| `MATERNASYNC_DATABASE_URL`, `MATERNASYNC_UPLOAD_DIR` | Already set to `/data/...` in the image. |
| WhatsApp, care assistant, handover | See the README table. In demo mode WhatsApp is simulated and sends nothing. |

## 2. The website on Vercel

The site needs to know where the API is. That is **one setting**, chosen when the site is built:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | The API's address with no trailing slash, for example `https://maternasync-api.onrender.com` |

It is read at **build** time, so changing it needs a new deployment.

### With the dashboard (recommended)

1. vercel.com → **Add New → Project** → import the GitHub repository.
2. Vercel reads `vercel.json`. Check it shows: Framework **Vite**, Build Command `npm run build`, Output Directory `dist`, Install Command `npm ci`,
   Root Directory `./`. Under **Settings → General → Node.js Version** choose 22.x or 24.x.
3. **Environment Variables**: add `VITE_API_BASE_URL` (Production, Preview and Development).
4. **Deploy.** Then go back to the API and make sure `MATERNASYNC_CORS_ORIGINS` contains the address Vercel gave you (for example `https://maternasync.vercel.app`).

### With the command line

```bash
npm i -g vercel
vercel login
vercel link                                   # creates a project and the .vercel/ folder (git ignores it)
vercel env add VITE_API_BASE_URL production   # paste the API address when asked
vercel env add VITE_API_BASE_URL preview
vercel --prod
```
`vercel` uploads your source (not `backend/`, `tests/` or `node_modules/`: see `.vercelignore`) and builds it on Vercel.

### What `vercel.json` does

- builds the Vite app and serves `dist`;
- sends any other address (`/patient/profile`, ...) to `index.html`, so a refresh or a shared link works; `/api/...` is excluded on purpose, so a missing
  API shows an error instead of a page of HTML;
- serves `sw.js` (the service worker that lets the app open without a signal) with `no-cache`, so a new version is picked up at once, and the web app manifest with its own type;
- caches the built files for a year (their names change when they change) and adds basic safety headers. `Permissions-Policy` keeps the microphone (voice
  input) and location (the Emergency and Profile pages) available to the site itself only.

## 3. Check it

```bash
curl https://YOUR-API.onrender.com/api/health
curl -i -X OPTIONS https://YOUR-API.onrender.com/api/v2/continuity/preferences \
  -H "Origin: https://maternasync.vercel.app" -H "Access-Control-Request-Method: PATCH" \
  -H "Access-Control-Request-Headers: authorization,content-type"     # expect access-control-allow-origin: https://maternasync.vercel.app
```
Then open the Vercel address and sign in with a demo account.

## If something is wrong

| What you see | Why | Fix |
|---|---|---|
| "Can't reach the server right now" on sign-in, and a CORS error in the browser console | The API does not list the website's address | Put the exact address (`https://...`, no trailing slash) in `MATERNASYNC_CORS_ORIGINS`, redeploy the API |
| Sign-in page loads, but sign-in says "Something went wrong. Please try again." and every request is a 404 from Vercel | `VITE_API_BASE_URL` was not set when the site was built (this is how the site behaves until an API exists) | Set it, redeploy the site |
| Works, then everyone is signed out | `MATERNASYNC_JWT_SECRET` changed or is not set the same on every restart | Set it once and keep it |
| First request is slow, or fails once | The API host was starting or waking up | Wait a minute; use an always-on plan for a demo |
| Data disappears after a restart | No persistent disk on `/data` | Attach one (Render: a paid plan) |
| Preview deployments cannot sign in | The preview address is not allowed | Add `MATERNASYNC_CORS_ORIGIN_REGEX` |
| Visitors are asked to log in to Vercel | Deployment Protection on the preview/production address | Vercel → Settings → Deployment Protection |

## An alternative: let Vercel proxy `/api`

Instead of `VITE_API_BASE_URL`, `vercel.json` can forward `/api` to the API, and the browser then only ever talks to Vercel (no CORS needed).
Add this **before** the existing rewrite, with your API's address (Vercel cannot read an environment variable here):

```json
{ "source": "/api/:path*", "destination": "https://YOUR-API.onrender.com/api/:path*" }
```
and, so signed-in answers are never cached by Vercel's network:
```json
{ "source": "/api/:path*", "headers": [{ "key": "x-vercel-enable-rewrite-caching", "value": "0" }] }
```
Leave `VITE_API_BASE_URL` empty. The trade-offs: the address is fixed in a file, and Vercel's limits on request size apply to uploads (not tested here).

## Before this holds real patients

- Set `MATERNASYNC_DEMO_ENABLED=false` and a strong `MATERNASYNC_JWT_SECRET`; use HTTPS everywhere (Vercel and Render both do).
- Back up the `/data` disk. SQLite on one disk is a prototype choice, not a clinical-grade store.
- Do not put real patient data on a demonstration deployment.
- The hackathon rules still apply: this is an assistive, administrative tool. Read the README's scope section.

## Deployed so far

- **Website:** https://maternasync.vercel.app (Vercel project `maternasync`, team `andy-bf71`, Hobby plan, account comeonletse@gmail.com), deployed with `vercel deploy --prod` on 25 October 2026, on 26 October 2026 (commit `bfe9358`) and on 27 October 2026 (commit `b7db027`: the doctor rounds, the caregiver round and the cross-login fixes).
  `VITE_API_BASE_URL=https://maternasync-api.onrender.com` is set for Production, so a new build is needed whenever the API address changes.
- **API:** https://maternasync-api.onrender.com (Render service `maternasync-api`, free plan, Singapore, built from `backend/Dockerfile` on `main`, account andryandurai@gmail.com). See "Render, free plan" for its limits.
  Its `MATERNASYNC_CORS_ORIGINS` is `https://maternasync.vercel.app`.
  Redeployed on 26 October 2026 from commit `bfe9358` and on 27 October 2026 from commit `b7db027` (deploy `dep-dbgcp7ugekts738hndf0`), each with `render deploys create srv-dbf1lei9lscs738g2g40` (live about three minutes after it started). Pushing to GitHub does not redeploy either host; the API went first and the website after it, so the new screens never met an older API.
- **Checked on the live pair** (a real browser on the Vercel address, 32 API calls, every one to the Render address): the patient, doctor and caregiver demonstration accounts sign in and open
  their pages (patient profile with the trusted person, doctor Care Assistant page, caregiver home); a wrong password gives the plain message; no CORS error in the console; the API answers a preflight for the Vercel
  address and refuses a stranger's. The website also serves deep links, answers 404 (not a page of HTML) on `/api/...` at its own address, and has the safety headers and the one-year cache on built files.
- **Checked again on 27 October 2026** (a real browser on the Vercel address, demonstration accounts, nothing created): the live API listed 254 routes (202 before), including the doctor search, audit trail and setup checklist and the caregiver Today card, Stop helping, hospital card and Remind her. On the live site the caregiver Home (Today card, "What Sarah has allowed", "Stop helping"), the new caregiver Profile tab, Emergency help ("Show this to the hospital"), Appointments and Daily Check-in; the doctor Dashboard ("Set up your clinic", "Needs you", the search box), Patient Questions, My Patients, Updates and Profile; and the patient Emergency help and Profile all load, with no accessibility problems on the pages checked, no console errors and every API call going to the Render address.
- **Not tested:** the paid Render blueprint (`deploy/render.yaml`) and a local Docker build (Docker was not available); WhatsApp, real hospital systems and the Claude provider.
- The address `https://maternasync.vercel.app` is public. The long per-deployment addresses (`maternasync-xxxx-andy-bf71.vercel.app`) ask for a Vercel login: that is Vercel's default Deployment Protection.
- Deploying from this folder without a `.vercel/` link needs `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` set (both are in the project's Settings → General), or run `vercel link` once.
