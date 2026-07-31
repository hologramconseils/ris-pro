# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RIS Pro (hologramconseils) analyzes French pension/career statements (RIS, EIG PDFs) and produces an AI-generated retirement audit: validated vs. required quarters ("trimestres"), anomalies in the administration's record, and personalized optimization strategies. Client-facing site: `ris.hologramconseils.com`.

## Two parallel implementations — know which one is live

This repo contains **two separate backends that are not wired together**. Almost all active development happens in the first one.

### 1. `frontend/api/*.js` — the live production system (Vercel serverless)
- **This is what's deployed and actively developed.** Check `git log` on `frontend/api/` vs `backend/` before assuming where to make a change.
- Auth: **Clerk** (`@clerk/backend` server-side token verification, `@clerk/clerk-react` client-side).
- Database: **Neon Postgres** (serverless driver, `@neondatabase/serverless`) via the singleton pool in `frontend/api/db.js`. Schema lives in `neon_schema.sql` at repo root (tables: `profiles` keyed by Clerk user ID, `analyses` with JSONB `results`).
- File storage: **Vercel Blob** (upload) with the PDF's base64 also persisted to the `analyses.file_base64` column so `analyze.js` doesn't depend on re-reading Blob storage.
- Payments: **Stripe** (`checkout.js`, `webhook.js` — webhook grants credits and sends a Resend email receipt).
- Each file in `frontend/api/` is a standalone Vercel serverless function (default-exported handler, manual CORS headers, `OPTIONS` short-circuit). There is no shared framework/router — copy the CORS/auth boilerplate pattern from a sibling file (e.g. `get-analysis.js`) when adding a new endpoint.
- Deployment routing (`vercel.json` at repo root): `/api/*` → `frontend/api/*.js`, everything else → the built Vite SPA (`frontend/dist`).

### 2. `backend/` — legacy/parallel FastAPI service
- Its own auth (JWT via `python-jose`/`passlib`), its own SQLAlchemy models (`backend/models.py`), Supabase Storage integration, SQLite/Postgres via `DATABASE_URL`. Not wired into the current frontend.
- **Still actively used** as the source of the regulatory content pipeline (see below) — don't assume this directory is dead code, but don't assume it's the runtime the live site hits either.
- `backend/wealth_advisor_agent.py` was previously the Python analysis agent; a commit ("remove legacy Python agent, enforce Node.js 3-agent architecture") moved live analysis to `frontend/api/analyze.js`. Treat `wealth_advisor_agent.py` as compliance-content plumbing, not the production analysis path.

## The regulatory rules pipeline

The `regles_*.md` files at the repo root (e.g. `regles_depart_anticipe_2023.md`, `regles_cumul_emploi_retraite_createur_droits.md`) are the source of truth for French pension law facts fed into the LLM writer prompt in `analyze.js`. They are:
1. **Read directly** by `frontend/api/analyze.js` at request time and injected verbatim into the Gemini "writer agent" prompt (`<regles_reglementaires>` block) — this is how the AI stays grounded instead of hallucinating legal thresholds.
2. **Kept up to date automatically** by `backend/regulatory_watch_agent.py`, run daily by `.github/workflows/regulatory-watch-v2.yml` (cron `0 8 * * *` + manual dispatch). It uses Gemini with Google Search grounding to check each rules file against current law, rewrites the file if law changed, and can also discover and create entirely new `regles_*.md` topics not yet covered. Changes are pushed to a dated branch (`regulatory-update-YYYYMMDD`) and opened as a PR automatically — **never hand-edit `regles_*.md` files expecting them to stick**; understand that an automated PR may supersede manual edits.

When adding a new pension-rule topic, add the filename to both `FILES_TO_WATCH` in `backend/regulatory_watch_agent.py` and the `allRuleFiles` array in `frontend/api/analyze.js`.

## The analysis pipeline (`frontend/api/analyze.js`)

A single request runs a 3-agent pattern, all in one serverless invocation (`maxDuration = 300`s):
1. **Agent 1 — Extractor** (`gemini-2.5-pro`, structured JSON schema output): reads the uploaded PDF directly (inline base64) and extracts two *separate, unmerged* tables — `synthese_annees` (per-year quarter/point totals) and `detail_employeurs` (per-employer periods and raw salary strings, FRF or EUR). Retries once if extraction comes back empty on a document flagged valid.
2. **Agent 2 — Calculator** (plain JS, deterministic): merges the two tables by year, converts FRF→EUR, deduplicates salaries that appear twice for the same year (base regime + complementary regime double-counting), derives `trimestres_requis` from the NIR-encoded birth year when not stated explicitly, and flags candidate anomalies using salary-vs-quarters heuristics. This step never calls the LLM — it's the "zero hallucination" arithmetic layer.
3. **Agent 3 — Writer** (`gemini-2.5-pro`, structured JSON schema output): takes the calculated totals + candidate anomalies + the full `regles_*.md` corpus and produces the client-facing `summary` (Markdown, no bullet points by house style), a filtered/enriched `anomalies` list (the writer is instructed to *discard* false-positive anomalies from Agent 2, not just decorate them), `strategies` (with a quantified `impact` field), and `action_plan`.

Freemium gating happens after the 3 agents run: `analyze.js` computes the full result, persists the complete version to `analyses.results`, then — if the caller lacks `analysis_credits`/admin role — returns a redacted `clientResponse` with only the first and last anomaly visible and the rest masked (`is_restricted: true`). Credits are decremented only once per unique `nir_hash` (so re-analyzing the same document doesn't burn credits), except when a prior stored result was itself restricted or degenerate (all-zero), which forces a fresh paid analysis rather than replaying a broken cached one.

## Frontend structure

- Vite + React 19, `frontend/src/App.jsx` wraps everything in `ClerkProvider` (requires `VITE_CLERK_PUBLISHABLE_KEY`) and lazy-loads route pages.
- Key pages: `Diagnostic.jsx` (upload + free preview), `Bilan.jsx` (full paid report, PDF/DOCX export via `html2pdf.js`/`docx`), `Login.jsx`, plus static legal pages (`CGV`, `MentionsLegales`, `PolitiqueConfidentialite`, `Securite`).
- `frontend/src/config/labels.ts` centralizes user-facing copy/labels — check here before hardcoding French UI strings in a component.
- `AuthContext.jsx` wraps Clerk's `useUser`/`useSession` and layers on the app's own `profiles` row (credits, role) fetched from `/api/profile`.

## Commands

```bash
# Frontend (Vite React app + Vercel API routes) — primary dev surface
cd frontend
npm install
npm run dev       # vite dev server
npm run build     # production build -> frontend/dist
npm run lint      # eslint
npm run preview   # preview a production build

# Backend (legacy FastAPI service)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
python -m pytest tests/ -v              # or: python -m pytest tests/test_pdf_processing.py -v
python -m pytest tests/test_pdf_processing.py::TestPDFProcessing::test_ris_parser_native -v

# Root-level Python integration/E2E scripts (not a pytest suite — run individually)
python test_rules.py
python test_analysis_pipeline.py
python tests/test_e2e_playwright.py

# Regulatory watch agent (normally runs via GitHub Actions cron)
python backend/regulatory_watch_agent.py
```

There is no root-level or frontend automated test runner beyond `backend/tests/` (pytest) and the loose `test_*.py`/`test_*.js` scripts at the repo root and in `tests/` — most of those are manual/debug scripts (Playwright screenshots, DB connectivity checks, prompt experiments) rather than a CI-gated suite. Vercel serverless functions in `frontend/api/` have no automated tests; verify changes there by running `vercel dev` or by exercising the deployed preview.

## Conventions worth knowing

- **User-facing text is French.** Error messages, prompts, UI copy, and commit messages in this repo are frequently written in French — match the existing tone (formal "vous", no anglicisms) when touching user-visible strings or prompts sent to the LLM.
- **LLM prompts never mention "AI"/"agent"/"algorithm" to the end user** — the writer prompt explicitly forbids these words in generated copy; use "expert", "bilan", "notre analyse" instead. Preserve this constraint if you touch `analyze.js` prompts.
- **PII handling**: NIR (French SSN) is only ever stored hashed (`nirHash = sha256(nir + NIR_SALT)`), never in plaintext in the `analyses` table's queryable columns. `backend/services/anonymizer.py` masks NIRs/names in admin views. Keep this pattern — don't add plaintext NIR logging or columns.
- **Idempotency on Stripe operations**: checkout session creation uses a derived idempotency key (`checkout_<userId>_<sanitizedFilePath>`) to avoid double-charging on retries — replicate this if adding new payment flows.
- `README.md`'s "Modules Gelés" (frozen modules) section calls out `ris_parser.py` (non-native/OCR PDF extraction, `strict_years` phantom-year filtering, employer heuristics) and `DetailedResult.jsx`'s table structure as stable and not to be modified without an explicit request — that file predates the Node 3-agent migration, so verify against current code before treating it as gospel, but treat "don't touch without being asked" as the operating default for parser/extraction internals given how much prompt-tuning has gone into getting extraction right.
- Several `*.md` files at repo root (`audit_ris_pro_final.md`, `security-audit-report.md`, `cahier_des_charges_technique_ris_pro.md`, `walkthrough.md`, `frontend-design-spec.md`, etc.) are point-in-time audit/design documents, not living docs — useful for historical context but don't assume they reflect the current codebase state.
