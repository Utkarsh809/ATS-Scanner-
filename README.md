# AI-Powered Resume & ATS Compatibility Scanner

A web app that scores a resume against a specific job description and returns a 0-100 compatibility score, missing keywords by importance, ATS formatting risks, rewrite ideas for weak bullet points, and a score history per job.

Built to the SRS *"AI-Powered Resume & ATS Compatibility Scanner", Version 1.0* (Department of IT, Manipal University Jaipur).

| Layer | Technology |
|---|---|
| Presentation | Next.js 14 (React 18), plain CSS |
| Application | Node.js + Express REST API, JWT in HTTP-only cookies |
| Processing | pdf-parse (PDF), mammoth (DOCX), keyword + entity extraction, Hugging Face sentence-transformers (relevance), Google Gemini 2.5 Flash (rewrites) |
| Data | PostgreSQL (Neon or Supabase) |

---

## 1. Run it on your computer

You need **Node.js 18.17 or newer** (check with `node -v`) and a free **Neon** or **Supabase** Postgres database.

### Step 1: Create the database

**Neon** (recommended): sign up at https://neon.tech, create a project, and copy the connection string from the dashboard. It looks like:
`postgresql://user:password@ep-xxxx.aws.neon.tech/neondb?sslmode=require`

**Supabase**: create a project at https://supabase.com, then go to *Project Settings > Database > Connection string > URI* and copy it (replace `[YOUR-PASSWORD]`).

### Step 2: Start the backend

```bash
cd backend
npm install
cp .env.example .env        # on Windows: copy .env.example .env
npm run gen:key             # run twice: once for JWT_SECRET, once for ENCRYPTION_KEY
```

Open `backend/.env` and fill in:
- `DATABASE_URL`: your Neon/Supabase connection string
- `JWT_SECRET`: the first generated key
- `ENCRYPTION_KEY`: the second generated key (exactly 64 characters)

Then:
```bash
npm run db:migrate          # creates the tables
npm run dev                 # API on http://localhost:5000
```
Check http://localhost:5000/api/health. It should show `"ok": true`.

### Step 3: Start the frontend (in a second terminal)

```bash
cd frontend
npm install
cp .env.example .env.local  # BACKEND_URL=http://localhost:5000
npm run dev                 # app on http://localhost:3000
```

Open http://localhost:3000, create an account, and run your first scan. Sample files for testing are in `backend/test/fixtures/` (`resume_clean.docx`, `resume_risky.docx`, `jd_fullstack.txt`).

### Step 4 (optional): Turn on the AI services

The app works fully **without any API keys**:

| Feature | Without a key | With a key |
|---|---|---|
| Relevance match | Built-in TF-IDF text similarity | Hugging Face `all-MiniLM-L6-v2` embeddings |
| Rewrite ideas | Built-in rule-based writer | Gemini 2.5 Flash |

To switch to the real APIs, add the keys to `backend/.env` and restart the backend:
- `HF_API_TOKEN`: free at https://huggingface.co/settings/tokens (choose a "Read" token)
- `GEMINI_API_KEY`: free at https://aistudio.google.com/app/apikey

If an API is down or rate-limited, the app automatically falls back to the built-in version for that request, so a scan never fails because of it.

### Run the tests

```bash
cd backend
npm test
```
30 unit tests cover parsing, keyword extraction, all three sub-scores, formatting checks, rewrites, caching keys and encryption. They need no database or API keys.

---

## 2. Deploy (SRS 2.4)

**Backend on Render** (Railway is the same idea):
1. Push this project to GitHub.
2. On Render, create a *Web Service* from the repo. Root directory: `backend`. Build command: `npm install`. Start command: `npm start`.
3. Add the environment variables from `backend/.env`, plus `NODE_ENV=production` and `FRONTEND_URL=https://<your-app>.vercel.app`.
4. Run the migration once from your computer with the production `DATABASE_URL` (`npm run db:migrate`).

**Frontend on Vercel**:
1. Import the repo on Vercel. Root directory: `frontend`.
2. Add the environment variable `BACKEND_URL=https://<your-api>.onrender.com`.
3. Deploy.

The frontend forwards every `/api/*` request to the backend (see `frontend/next.config.js`). The browser only talks to the Vercel domain, so the login cookie is first-party and works without cross-site cookie setup. Both sides deploy independently with no shared filesystem (SRS 5.4).

---

## 3. How the score is calculated

**Composite score** = 50% keyword match + 30% relevance match + 20% completeness. This resolves SRS Appendix C, TBD #1. The weights live in `backend/.env` (`WEIGHT_KEYWORD`, `WEIGHT_SEMANTIC`, `WEIGHT_COMPLETENESS`) and are normalised to sum to 1. If a sub-score can't be computed, its weight is shared among the others.

**Keyword match (REQ-3.1).** Each JD term has a tier with a weight: required = 3, preferred = 1.5, implied = 1. Score = matched weight / total weight × 100. Matching understands aliases (JS = JavaScript, Postgres = PostgreSQL, k8s = Kubernetes) and avoids false matches ("C" inside "C++", "Java" inside "JavaScript", "the rest of the team" is not REST).

**Relevance match (REQ-3.2).** Each JD requirement line is compared with every resume bullet, summary and skills line using cosine similarity of embeddings. The best match per requirement is averaged, with required lines counting double. That average is blended 75/25 with whole-document similarity, then mapped onto 0-100 with a calibration range for each method (`semanticScore.js`).

**Completeness (REQ-3.3).** Points for email (8), phone (5), LinkedIn/GitHub (4), summary (8), skills (15), experience (18, or 9 if only projects), education (15), projects (10), certifications (2), and quantified bullets (15, full marks when at least half of bullets contain a number).

**Tier classification (REQ-2.3).** Section headings in the JD ("Requirements", "Nice to have", "Responsibilities", "Benefits") set the tier. Cues inside a sentence ("is a plus", "preferred", "must") can override it. Terms in benefits and about-the-company sections are ignored. If a JD has no headings, every skill counts as required.

---

## 4. Requirement traceability

| Requirement | Where it is implemented |
|---|---|
| REQ-1.1, 1.5: PDF/DOCX only, 5 MB, clear errors | `backend/src/middleware/upload.js`, `services/parsing/extractText.js`, `frontend/components/Dropzone.js` |
| REQ-1.2: sections (contact, summary, skills, experience, education, projects, certifications) | `services/parsing/sectionizer.js` |
| REQ-1.3: bullets as individually addressable units (`b1`, `b2`, ...) | `sectionizer.js` |
| REQ-1.4: whole-document fallback, low-confidence flag | `sectionizer.js` (`lowConfidence`), notice on preview and report |
| REQ-2.1, 2.4: paste text or URL; fall back to paste | `services/jd/fetchUrl.js`, `app/scan/new/page.js` |
| REQ-2.2, 2.3: keyword extraction + entity recognition; required/preferred/implied | `services/jd/extractKeywords.js`, `skillsDictionary.js` |
| REQ-3.1 to 3.4: sub-scores and 0-100 composite | `services/scoring/*` (each an independent module) |
| REQ-3.5: under 8 seconds | Local scoring takes about 10 ms; the HF call has a 6 s timeout with local fallback |
| REQ-4.1, 4.2: tables, text boxes, images, columns, fonts, header/footer contact | `services/formatting/docxChecks.js`, `pdfChecks.js` |
| REQ-4.3: missing or inconsistent dates | `services/formatting/dateChecks.js` |
| REQ-5.1, 5.2: missing keywords by tier; bullets without metrics | `components/report/KeywordGaps.js`, `textUtils.hasMetric` |
| REQ-5.3: 2-3 rewrites, no keyword stuffing | `services/rewrite/*` (at most one term per category, only terms related to the bullet) |
| REQ-5.4: cache per bullet + keyword set | `rewrite_suggestions.cache_key`, `routes/scans.js` |
| REQ-6.1 to 6.3: persist scans, trend per JD, delete | `routes/scans.js`, `routes/jobs.js` (`/trend`), `app/history/*` |
| 5.3: hashed passwords, encrypted files, HTTPS, delete account | bcrypt, AES-256-GCM (`utils/crypto.js`), `routes/account.js` |
| 5.5: owner-only access; scan only after both inputs are parsed | Every query is scoped by `user_id`; checks in `routes/scans.js` |
| 2.6: onboarding walkthrough + help panel | `components/Onboarding.js`, `components/HelpPanel.js` |
| 3.1: plain-language labels, help icon, error banner on every screen | `Header.js`, `ErrorBanner.js` |
| 6: privacy notice | `app/privacy/page.js`, footer, upload screen |

---

## 5. API reference

All routes are under `/api` and return JSON. Errors use the shape `{ "error": { "code": "...", "message": "..." } }`, and the message is safe to show to users.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register` | `{name, email, password}` creates an account and signs in |
| POST | `/auth/login` | `{email, password}` |
| POST | `/auth/logout` | Clears the session cookie |
| GET | `/auth/me` | Current user |
| POST | `/auth/onboarded` | Marks the walkthrough as seen |
| POST | `/resumes` | multipart field `resume` (PDF/DOCX, up to 5 MB). Parses and returns the preview |
| GET | `/resumes`, `/resumes/:id` | List / detail |
| GET | `/resumes/:id/file` | Download the original (decrypted) |
| DELETE | `/resumes/:id` | Deletes the resume and its scans |
| POST | `/jobs` | `{text}` or `{url}`, optional `{title}`. Extracts and classifies keywords |
| GET | `/jobs`, `/jobs/:id` | List with latest score / detail |
| PUT | `/jobs/:id/keywords` | `{keywords: [{term, tier}]}` saves the user-confirmed list |
| GET | `/jobs/:id/trend` | Every scan of this job, oldest first |
| DELETE | `/jobs/:id` | Deletes the job and its scans |
| POST | `/scans` | `{resumeId, jobDescriptionId}` runs a scan |
| GET | `/scans`, `/scans/:id` | List / full report |
| DELETE | `/scans/:id` | Deletes one scan |
| POST | `/scans/:id/rewrites` | `{bulletId}` returns 2-3 cached or new rewrites |
| GET | `/account/summary` | Counts |
| DELETE | `/account` | `{password}` permanently deletes everything |
| GET | `/health` | Status and which AI services are active |

---

## 6. Project structure

```
backend/
  src/
    app.js, index.js, config.js
    db/                schema.sql, migrate.js, pool.js
    middleware/        auth (JWT), upload (multer), errorHandler
    routes/            auth, resumes, jobs, scans, account
    services/
      parsing/         extractText (pdf-parse, mammoth), sectionizer
      jd/              extractKeywords, skillsDictionary, fetchUrl
      scoring/         keywordScore, semanticScore, completenessScore, composite, embeddings, tfidf
      formatting/      docxChecks, pdfChecks, dateChecks, flags, zip
      rewrite/         gemini, localRewriter, selectKeywords
      matching.js, textUtils.js
    utils/             crypto (AES-256-GCM), errors
  test/                node:test unit tests + fixtures
frontend/
  app/                 pages: landing, login, register, scan/new, scans/[id], history, history/[jobId], account, privacy
  components/          Header, HelpPanel, Onboarding, Dropzone, KeywordEditor, ResumePreview, TrendChart, report/*
  lib/                 api client, auth context, UI context, formatters
```

---

## 7. Decisions and known limits

- **Sign-in (Appendix C, TBD #2):** email and password only for v1.0. Google OAuth is left as future scope.
- **Scanned (image-only) resumes** are rejected with a clear message, because OCR is out of scope (SRS 2.7).
- **PDF text boxes** can't be reliably detected from a PDF, so that check is DOCX-only. PDF tables and columns are detected from text positions, so treat them as strong hints rather than certainties.
- **Encryption at rest** covers the uploaded files. The parsed text used for scoring is stored as JSONB so it can be queried. Neon and Supabase also encrypt their disks.
- **Job links:** many job sites (LinkedIn especially) block automated reading. When that happens, the app asks the user to paste the text (REQ-2.4).
- **English only** (SRS 2.5).
