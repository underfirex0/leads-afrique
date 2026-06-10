# Africa Manufacturer Leads — Discovery & Enrichment System

Finds and enriches paint / cement-glue (ciment colle) manufacturers across
African countries (Nigeria, Côte d'Ivoire, Niger, Cameroun, South Africa, etc.)
using Tavily web search + Claude for extraction, stored in Supabase.

## Stack
- Next.js (App Router) — UI + API routes — deployed on Vercel
- Supabase (Postgres) — stores the leads table
- Tavily API — web search
- Anthropic Claude API — extracts structured data from search results

---

## 1. Set up Supabase

1. Go to https://supabase.com → create a new project (free tier is enough).
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → run it.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → this is `SUPABASE_URL`
   - `service_role` secret key → this is `SUPABASE_SERVICE_ROLE_KEY`
   (Use the service_role key, NOT the anon key — it's used server-side only
   in API routes and never exposed to the browser.)

## 2. Get API keys

- **Anthropic**: https://console.anthropic.com → Settings → API Keys → create key (`ANTHROPIC_API_KEY`)
- **Tavily**: https://tavily.com → sign up → dashboard → copy API key (`TAVILY_API_KEY`)

## 3. Push to GitHub

```bash
cd leads-system
git init
git add .
git commit -m "Initial leads system"
gh repo create africa-leads-system --private --source=. --push
# (or create the repo manually on github.com and `git push`)
```

## 4. Deploy to Vercel

1. Go to https://vercel.com → **Add New Project** → import your GitHub repo.
2. In **Environment Variables**, add:
   - `ANTHROPIC_API_KEY`
   - `TAVILY_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy. Vercel auto-detects Next.js — no extra config needed.

For local testing first: copy `.env.example` to `.env.local`, fill in the
values, then run:

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## How to use it (step by step)

1. **Open the dashboard** (your Vercel URL or localhost:3000).

2. **Run discovery, country by country:**
   - Pick a country (e.g. Nigeria) and a sector (Ciment colle or Peinture).
   - Click **"Run discovery"**.
   - This runs one Tavily search for directories/associations/lists of
     manufacturers in that country+sector, has Claude extract company names
     + cities, and inserts new rows with status `discovered`.
   - Repeat for each country/sector combo. Each click usually adds
     somewhere between 0 and 15 new companies — run it several times per
     country (it auto-dedupes, so re-running is safe). You can also type a
     custom search query (e.g. try French vs English phrasing, or target a
     specific city/association) to surface different results.
   - Goal: get to roughly 250-350 rows with status `discovered` (some buffer
     since not all will enrich fully) before moving to step 3.

3. **Run enrichment:**
   - Click **"Enrich next 5"** repeatedly (or just keep clicking — it
     processes 5 `discovered` companies at a time).
   - For each company, it searches the web for the company's site, contact
     email, phone, and director/CEO name, and Claude fills in whatever it
     can find. Status becomes `enriched` (or `failed` if something errored —
     you can re-run discovery/enrich later to retry).
   - This is the slow part — each batch of 5 takes maybe 30-60 seconds. For
     250-300 companies that's roughly 50-60 clicks. You can leave the tab
     open and click through it, or automate with the optional cron note below.

4. **Export your data:**
   - Click **"Export CSV"** any time — downloads all rows (discovered +
     enriched) with: name, sector, country, city, website, phone, email,
     director_name, status, notes.
   - Open in Excel/Google Sheets, filter `status = enriched`, and you have
     your contact list. Rows still missing director_name/email can be
     manually checked or re-run through enrichment later.

### Tips for better results
- For "nom des dirigeants" specifically, expect a lower hit rate (often
  40-60%) — many smaller manufacturers don't publish this. LinkedIn searches
  sometimes surface it where company sites don't.
- If a country/sector returns few results, try custom queries like:
  - `"annuaire fabricants peinture [pays]"`
  - `"[pays] paint manufacturers association members"`
  - `"chambre de commerce [pays] industrie peinture"`
- Re-running discovery with different queries for the same country/sector is
  the main way to scale up to 250-300 — one query rarely returns more than
  10-15 new usable names.

### Optional: automate enrichment with a cron job
Vercel's free plan allows daily cron jobs. For faster automation, you can
instead trigger `/api/enrich` repeatedly from a free service like
cron-job.org (e.g. every 2 minutes) pointed at:
`https://your-app.vercel.app/api/enrich` (POST, body `{"batchSize":5}`).
