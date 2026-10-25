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

> Nothing here has been run on Vercel or Render. What *was* tested: the site built exactly as below, served on one address and calling the API on
> another (sign-in, JSON, PATCH, PUT, a file upload with the token, error messages), and the API's cross-origin rules. The Docker image build and the
> Render blueprint were not run (Docker was not available when this was written).

## 1. The API (do this first, you need its address)

### Render (a blueprint is in `render.yaml`)

1. Push the repository to GitHub.
2. Render dashboard → **New → Blueprint** → choose the repository. Render reads `render.yaml`, builds `backend/Dockerfile` and attaches a 1 GB disk at `/data`.
   A persistent disk needs a paid plan; without it the database and uploads are erased at every restart.
3. When it asks for `MATERNASYNC_CORS_ORIGINS`, type the address the website will have, for example `https://maternasync.vercel.app`. You can change it later.
4. Wait for the first start (a minute or more: it creates the database, adds the demonstration data and indexes the reference PDFs).
   Check `https://YOUR-API.onrender.com/api/health` shows `{"status": "ok"}`.

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
| Sign-in page loads but every request is a 404 from Vercel | `VITE_API_BASE_URL` was not set when the site was built | Set it, redeploy the site |
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
