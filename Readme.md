# ORCA / MIRA — Marine Intelligence and Reasoning Agent

A conversational marine-safety and fishing-zone assistant for coastal fishermen in
Karnataka, India. Ask in plain language whether it is safe to sail, what the sea
will do, and where fish are likely to be — and see exactly which data the answer
rests on.

Built for Smart India Hackathon 2026 against `ORCA_Phase2_SRS.md` (SRS v1.1).

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Current status](#2-current-status)
3. [Architecture](#3-architecture)
4. [Repository layout](#4-repository-layout)
5. [Prerequisites](#5-prerequisites)
6. [Setup](#6-setup)
7. [Configuration](#7-configuration)
8. [Running the system](#8-running-the-system)
9. [Testing](#9-testing)
10. [Design principles](#10-design-principles)
11. [Requirements traceability](#11-requirements-traceability)
12. [Open issues](#12-open-issues)
13. [Troubleshooting](#13-troubleshooting)
14. [Roadmap](#14-roadmap)

---

## 1. What this is

ORCA answers three kinds of question for a fisherman about to go to sea:

| Question | What ORCA does |
|---|---|
| *"Is it safe to sail from Karwar tomorrow?"* | Retrieves wind, gusts, waves, visibility and any official hazard alert; applies IMD-derived thresholds deterministically; returns SAFE / CAUTION / UNSAFE with the reason |
| *"What are conditions at Malpe tonight?"* | Retrieves the forecast for the resolved place and time window, and reports the numbers with their timestamps |
| *"Where should I fish near Mangaluru?"* | Reads the batch-computed Potential Fishing Zone cache and reports the nearest qualifying zones with distance and bearing |

Every answer carries an **evidence panel** — each source, the values retrieved, the
timestamp the data describes, and any threshold applied — plus the applicable
safety disclosures.

### The design commitment

The system is built so that **it cannot quietly make things up**. A marine safety
tool that invents a plausible wave height when a data source fails is worse than
one that says it does not know. Several architectural decisions exist only to
enforce that, and they are documented in [Design principles](#10-design-principles).

---

## 2. Current status

### Working end to end

- Conversational chat with server-side multi-agent orchestration (LangGraph)
- Live SSE streaming of per-agent progress and token-by-token answers
- Deterministic safety verdict against IMD Fishermen Warning thresholds
- NDMA SACHET hazard alert ingestion, including circle and geocode area forms
- PFZ batch pipeline: real SST and currents → XGBoost classification → clustering → atomic publish
- Spatial coverage tracking, so the system refuses to answer for areas it did not analyse
- Evidence panel, disclosures, plan trace and per-agent latency, all persisted
- Frontend wired to the real backend with no silent fallbacks

### Known not working

- **PFZ publishes zero zones.** See [Open issues](#12-open-issues) — this is the largest outstanding item.
- **Phone authentication is not wired.** `DEV_AUTH_BYPASS` is used for local work.
- **Chlorophyll is not retrieved.** Passed to the model as a labelled null.

### Not built (later iterations)

Route planning (FR-E5), ocean analytics trends, authority dashboard (FR-F4),
proactive push/SMS alerting (FR-F3), speech input/output (FR-A6), Hindi and
Kannada answer translation.

---

## 3. Architecture

```
                        ┌──────────────────────────────┐
  Browser  ───────────► │  Vite + React  (port 5173)   │
                        │  src/services/  API layer    │
                        └──────────────┬───────────────┘
                                       │ HTTPS + httpOnly cookie
                                       │ SSE for /chat?stream=true
                        ┌──────────────▼───────────────┐
                        │  ORCA backend  (port 8000)   │
                        │  FastAPI                     │
                        │                              │
                        │  api/v1/   auth profile chat │
                        │            alerts pfz        │
                        │  agents/   orchestrator +    │
                        │            3 specialists     │
                        │  safety/   verdict engine    │
                        │            (no LLM)          │
                        │  tools/    deterministic     │
                        │  workers/  scheduled jobs    │
                        └───┬──────────┬───────────┬───┘
                            │          │           │
              ┌─────────────▼──┐  ┌────▼─────┐  ┌──▼──────────────┐
              │ PostgreSQL 16  │  │  Groq    │  │ pfz-api :8001   │
              │ + PostGIS      │  │  LLM     │  │ XGBoost model   │
              └────────────────┘  └──────────┘  └─────────────────┘
                            ▲
              ┌─────────────┴───────────────┐
              │  Open-Meteo (marine + fcst) │
              │  NDMA SACHET CAP feed       │
              └─────────────────────────────┘
```

### Request lifecycle for a chat turn

```
resolve_context → plan → execute_specialists → compute_verdict → explain_risk → synthesize
```

1. **resolve_context** — extracts place name, coordinates and relative time from the
   query text; falls back to the user's home port. FR-D1.2 precedence order.
   If nothing resolves, asks rather than assuming.
2. **plan** — LLM chooses which specialists to run, from a capability registry.
   Falls back to running all of them if the planner fails.
3. **execute_specialists** — runs concurrently. Each calls deterministic tools;
   the LLM only phrases what came back.
4. **compute_verdict** — **pure function, no LLM**. Applies thresholds, official
   alerts, and the FR-E2.4 cap.
5. **explain_risk** — the risk agent *explains* the verdict it was handed. It
   cannot change it.
6. **synthesize** — composes prose from structured findings only.

The turn, its plan, per-agent invocations with latencies, evidence and disclosures
are all persisted (NFR-A1).

### The three PFZ layers

| Layer | Where | When it runs |
|---|---|---|
| Feature retrieval | `workers/pfz_features.py` | Scheduled batch |
| Classification | `workers/pfz_client.py` → `services/pfz-api` | Scheduled batch |
| Clustering + publish | `workers/pfz_derive.py`, `pfz_batch.py` | Scheduled batch |
| **Serving** | `tools/pfz_tool.py` → `api/v1/pfz.py` | Request time, **cache read only** |

FR-E1.2 forbids deriving zones during a conversation turn. The frontend never
calls `pfz-api` directly, because doing so would bypass both the cache and the
coverage gate.

---

## 4. Repository layout

```
Project-Marine/
├── backend/                     ORCA backend (FastAPI)
│   ├── app/
│   │   ├── main.py              app factory, /health, CORS, lifespan
│   │   ├── core/
│   │   │   ├── config.py        pydantic-settings over .env
│   │   │   ├── constants.py     enums (DB-native only where vocabulary is closed)
│   │   │   ├── security.py      Firebase verify + signed session cookie
│   │   │   ├── thresholds.py    typed loader
│   │   │   └── thresholds.yaml  ALL tunable numbers
│   │   ├── db/
│   │   │   ├── models.py        8 tables, SQLAlchemy 2.0 + GeoAlchemy2
│   │   │   ├── session.py       async engine
│   │   │   └── init_db.py       dev schema creation (no Alembic yet)
│   │   ├── schemas/             pydantic I/O contracts
│   │   ├── api/v1/              auth, profile, chat, alerts, pfz, router
│   │   ├── tools/               deterministic, non-LLM
│   │   │   ├── base.py          SourceEnvelope, retry, source health
│   │   │   ├── weather_tool.py  Open-Meteo forecast + marine
│   │   │   ├── sachet_tool.py   CAP fetch/parse + alert reads
│   │   │   ├── pfz_tool.py      PostGIS cache reads
│   │   │   └── geo_tool.py      location/time resolution, gazetteer
│   │   ├── safety/
│   │   │   ├── verdict.py       FR-E2 — pure function, no LLM
│   │   │   └── disclosures.py   single disclosure registry
│   │   ├── agents/
│   │   │   ├── llm.py           Groq + schema validation + retry
│   │   │   ├── orchestrator/    state, planner, graph, streaming
│   │   │   └── specialists/     registry + weather / ocean / risk
│   │   └── workers/             scheduled jobs, outside the request path
│   ├── scripts/                 diagnose_cap.py, diagnose_pfz.py
│   └── tests/                   13 suites
│
├── frontend/                    Vite + React + Tailwind
│   └── src/
│       ├── services/            API layer (the only place fetch lives)
│       ├── context/             AuthContext, LocationContext
│       └── components/
│           ├── chat/            ChatPage, AgentProcessingCard,
│           │                    EvidenceTrace, VerdictBanner
│           ├── auth/            LoginPage
│           ├── profile/         ProfilePage
│           └── layout/          Header, Sidebar, StatusBanner
│
└── services/
    └── pfz-api/                 XGBoost model microservice (port 8001)
```

> `services/auth-api/` has been **removed**. It duplicated FR-H against a SQLite
> store and accepted `123456` as a master OTP.

---

## 5. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.12+ | Developed on 3.14 |
| Node.js | 20+ | Developed on 22 |
| Docker Desktop | current | For PostgreSQL + PostGIS |
| Groq API key | — | LLM provider |

No Firebase project is required for local development — use `DEV_AUTH_BYPASS`.
No NASA Earthdata account is required at present, since chlorophyll is not
retrieved.

---

## 6. Setup

### 6.1 Database

```bash
docker run --name orca-postgres \
  -e POSTGRES_USER=orca_user \
  -e POSTGRES_PASSWORD=<your-password> \
  -e POSTGRES_DB=orca \
  -p 5432:5432 \
  -d postgis/postgis:16-3.4
```

### 6.2 Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r ../requirements.txt

cp .env.example .env      # then fill in the values — see section 7
python -m app.db.init_db  # creates the PostGIS extension and 8 tables
```

Expected output: `created 8 tables`.

### 6.3 PFZ model service

```bash
cd services/pfz-api
pip install -r requirements.txt
```

### 6.4 Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

---

## 7. Configuration

### 7.1 `backend/.env`

Secrets and endpoints. **Never committed** — `.gitignore` has `.env` plus a
`!.env.example` negation so the template is tracked.

```bash
APP_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173

DATABASE_URL=postgresql+asyncpg://orca_user:<password>@localhost:5432/orca

SESSION_SECRET=<openssl rand -hex 32>
SESSION_LIFETIME_DAYS=30

# Local development only. Refuses to load when APP_ENV=production.
DEV_AUTH_BYPASS=true

FIREBASE_PROJECT_ID=
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json

GROQ_API_KEY=<your key>
GROQ_MODEL=openai/gpt-oss-120b

LANGUAGE_PROVIDER=sarvam
SARVAM_API_KEY=

PFZ_API_BASE_URL=http://localhost:8001
PFZ_API_TIMEOUT_SECONDS=30
PFZ_API_BATCH_SIZE=500

OPEN_METEO_FORECAST_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_MARINE_URL=https://marine-api.open-meteo.com/v1/marine
SACHET_FEED_URL=https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml
SACHET_POLL_INTERVAL_MINUTES=15
```

### 7.2 `backend/app/core/thresholds.yaml`

Tunable numbers, committed. RK-9 anticipates these being retuned, so they live
here rather than in code.

```yaml
pfz:
  grid:
    bbox: { min_lat: 12.0, max_lat: 15.2, min_lon: 73.6, max_lon: 74.9 }
    spacing_deg: 0.05
  min_zone_area_km2: 100
  composite_days: 3
  generations_retained: 2
  salinity_constant_psu: 34.5
  max_staleness_hours: 120
  min_coverage_fraction: 0.3

  # Model label -> ORCA vocabulary. NOBODY CAN VERIFY THIS FOR YOU:
  # model.classes_ gives the ORDER of classes, not their meaning. An inverted
  # mapping sends fishermen to the least productive water while telling them
  # it is the best, and unlike an unmapped label it looks like it is working.
  class_labels:
    "0": BEST
    "1": GOOD
    "2": POOR

alerts:
  default_radius_km: 25
  expired_retention_days: 7

# Derived from IMD Fishermen Warning criteria.
safety:
  wind_speed_caution_ms: 10.0
  wind_speed_unsafe_ms: 12.5     # IMD 45 km/h warning threshold
  wind_gust_caution_ms: 14.0
  wind_gust_unsafe_ms: 17.0
  wave_height_caution_m: 2.0
  wave_height_unsafe_m: 2.5      # IMD "Rough Sea" threshold
  current_caution_ms: 1.0
  visibility_caution_m: 2000
  max_forecast_age_hours: 6
```

### 7.3 `frontend/.env`

```bash
VITE_API_BASE=http://localhost:8000
```

One origin. `VITE_AUTH_API_BASE` and `VITE_PFZ_API_BASE` are retired.

---

## 8. Running the system

### 8.1 Services

Three terminals:

```bash
# 1 — PFZ model service
cd services/pfz-api && uvicorn main:app --port 8001

# 2 — ORCA backend
cd backend && uvicorn app.main:app --reload --port 8000

# 3 — Frontend
cd frontend && npm run dev
```

Open http://localhost:5173.

### 8.2 Workers

These are **not** started by the API. Until each has run at least once, the
system will correctly report missing data.

```bash
cd backend

# Hazard alerts. Until this succeeds, every verdict is capped at CAUTION
# because the hazard feed has never been read — which is correct behaviour,
# but means a demo without it looks permanently amber.
python -m app.workers.sachet_poll
python -m app.workers.sachet_poll --loop --interval 15   # continuous

# PFZ zones. Requires pfz-api running. Takes ~30s for the Karnataka grid.
python -m app.workers.pfz_batch --dry-run   # computes, writes nothing
python -m app.workers.pfz_batch
```

### 8.3 Diagnostics

```bash
python -m scripts.diagnose_cap 10        # what the live SACHET feed contains
python -m scripts.diagnose_pfz --labels  # what classes the model emits
python -m scripts.diagnose_pfz           # class distribution over real points
```

### 8.4 API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness, `app_env`, `dev_auth_bypass` |
| POST | `/api/v1/auth/verify` | Firebase ID token → session cookie |
| POST | `/api/v1/auth/logout` | Server-side revocation |
| GET | `/api/v1/auth/me` | Current session |
| GET/PUT | `/api/v1/profile` | Profile |
| PUT/DELETE | `/api/v1/profile/base-location` | Home port, consent-gated |
| POST | `/api/v1/chat` | Single JSON turn |
| POST | `/api/v1/chat?stream=true` | SSE stream |
| GET | `/api/v1/alerts` | Hazard alerts (never invokes agents) |
| GET | `/api/v1/pfz/zones` | Zone cache read |
| GET | `/api/v1/pfz/methodology` | How zones are derived |

Interactive docs at http://localhost:8000/docs.

### 8.5 SSE event contract

`POST /api/v1/chat?stream=true` emits, in order:

| Event | Payload |
|---|---|
| `turn_started` | `{query}` |
| `context_resolved` | `{latitude, longitude, resolution_route, label, window, window_assumed}` |
| `plan` | `{interpretation, steps[], needs_clarification}` |
| `agent_started` | `{agent}` |
| `agent_completed` | `{agent, status, summary, latency_ms, missing_inputs, findings}` |
| `verdict` | `{verdict, capped_by_missing_input, missing_inputs, reasons[]}` |
| `answer_delta` | `{text}` — **an increment; accumulate, do not replace** |
| `answer_fallback` | `{text}` — synthesis failed; **replaces** the accumulated text |
| `turn_completed` | `{turn_id, conversation_id, status, verdict, evidence[], disclosures[], latency_ms}` |
| `error` | `{message}` |

`: keepalive` comments arrive every 15 s. Use
`createTurnAccumulator()` from `src/services/chat.js` rather than reimplementing
the accumulation rule.

---

## 9. Testing

### Backend — 13 suites

```bash
cd backend
for t in test_base test_weather_tool test_sachet_tool test_verdict test_graph \
         test_extensibility test_architecture test_sachet_poll test_pfz_derive \
         test_pfz_coverage test_streaming test_context_extraction test_pfz_publish; do
  printf "%-26s " "$t"
  PYTHONPATH=. python tests/$t.py >/dev/null 2>&1 && echo PASS || echo FAIL
done
```

| Suite | What it proves |
|---|---|
| `test_base` | Bounded retry; 429 retried, 4xx not; unknown timestamp counts as stale |
| `test_weather_tool` | Window **maxima** drive the verdict, not means; out-of-horizon returns absence |
| `test_sachet_tool` | CAP lat,lon → WKT lon,lat swap; malformed geometry keeps the alert |
| `test_verdict` | **72 input combinations — none yields SAFE with missing data** |
| `test_graph` | Node ordering; verdict precedes the risk agent; clarification path |
| `test_extensibility` | Registers a 4th agent; SHA-256 proves no existing file changed |
| `test_architecture` | Import graph: alerts view never reaches agents; verdict engine has no LLM |
| `test_sachet_poll` | Self-intersecting polygon repaired; in-batch dedupe; partial failure tolerated |
| `test_pfz_derive` | Zone count is an output; sub-minimum clusters discarded, not padded |
| `test_pfz_coverage` | Replays the real partial run; 5 of 6 ports correctly refuse |
| `test_streaming` | Event order; turn persists after client disconnect and forced GC |
| `test_context_extraction` | Place/time extraction in 3 languages; unknown place asks |
| `test_pfz_publish` | Demote flushed before promote; poisoned session recovers |

### Frontend — 3 suites

```bash
cd frontend
node src/services/__tests__/sse.test.mjs        # 1-byte chunks parse identically
node src/services/__tests__/contract.test.mjs   # empty vs not_covered stay distinct
node src/context/authcontext.test.mjs           # 4 auth states never merge
```

---

## 10. Design principles

These exist because the alternative failure modes are silent.

### The system never substitutes data it does not have

FR-C6.3 forbids substituting a modelled, interpolated or default value when a
source is unavailable. This was not theoretical: the original `pfz-api`
`generator.py` sampled temperature, salinity, currents and chlorophyll from
`np.random.normal` — the same coordinate returned different oceanography on
each call. It was replaced with real retrieval.

Chlorophyll has no free real-time source, so it is passed to the model as a
**null with recorded provenance**, never a plausible-looking estimate. The
evidence panel renders it as *unavailable* rather than blank or zero.

### Source failure is data, not an exception

Tools return `SourceEnvelope.unavailable(...)` rather than raising. An exception
can only produce a 500 or a silent fallback; neither is a statement to the user.

### A forecast is not a measurement

Every envelope carries a `DataKind` — observation, forecast, derived,
climatology — alongside `valid_at` (what the data describes) and `fetched_at`.
Collapsing these into one "timestamp" is how a forecast ends up rendered as
something someone measured.

### The safety verdict is a pure function

`safety/verdict.py` imports no agent module and no LLM SDK — enforced statically
by `test_architecture.py`. The risk agent *explains* a verdict it is handed and
cannot override it. FR-E2.4 ("never SAFE when a required input is missing") is
therefore a unit test rather than a line in a prompt, applied as a hard cap
*after* every other check.

### "We did not look" is not "there is nothing there"

Each PFZ generation records **which 0.5° cells actually returned data**. A run
whose northern chunks were rate-limited holds real zones for the south and
nothing for the north; without this, a fisherman at Karwar is shown southern
zones as "nearest", or an empty list reading as "nothing biting". Four distinct
statuses — `ok`, `empty`, `not_covered`, `unavailable` — reach the UI as four
different screens.

### Publication is atomic

A partial unique index makes it impossible for two PFZ generations to be
`published` simultaneously. The worker builds into `building`, then demotes and
promotes inside one transaction.

### The frontend does not invent data either

`src/services/http.js` throws on every failure. There is no offline mode and no
sample-data fallback. When the backend is unreachable the UI says so — a
deliberate, visible change from the previous behaviour, which fabricated a
logged-in user and served bundled sample weather.

### Disclosures live in one registry

SRS §6.9's own rationale: safety obligations distributed across a document are
the ones that get dropped in implementation. `safety/disclosures.py` is the only
place disclosure text exists, checked by `test_architecture.py`.

---

## 11. Requirements traceability

| Requirement | Implementation |
|---|---|
| FR-A4.2 assumed time window stated | `geo_tool.resolve_window`, `assumed` flag surfaced in UI |
| FR-B1.1 explicit plan before agents | `orchestrator/planner.py`, streamed as `plan` |
| FR-B2.2 add an agent without touching others | `specialists/__init__.py` registry; proven by `test_extensibility` |
| FR-B3.2 no peer-to-peer messaging | Specialists never read each other's outputs |
| FR-B4.3 partial answers name what is missing | `TurnStatus.PARTIAL` + `missing_inputs` |
| FR-B5.2 plan trace inspectable | `turns.plan` + `agent_invocations` |
| FR-C4.2 alerts never LLM-inferred | `sachet_tool.parse_cap_alert` is plain XML parsing |
| FR-C6.1 true observation timestamp | `SourceEnvelope.valid_at`, mandatory |
| FR-D1.2 location precedence | `geo_tool.resolve_location` |
| FR-D1.4 ask rather than assume | Returns `None` → clarification |
| FR-E1.2 zones served from cache | `pfz_tool` has no HTTP client |
| FR-E1.7 zone count is an output | `pfz_derive.derive_zones` takes no target count |
| FR-E1.14 atomic publish | `uq_pfz_one_published` partial index |
| FR-E2.4 never SAFE on missing input | Hard cap applied last; 72 combinations tested |
| FR-F5.4 never an empty list as all-clear | `feed_status` + `feed_warning` + `ungeolocated_alerts` |
| FR-F5.7 original agency text preserved | Stored verbatim, never overwritten by translation |
| FR-F5.8 alerts view bypasses agents | Import graph checked statically |
| FR-G1.1 evidence panel | `EvidenceTrace.jsx` |
| FR-H2.2 revocable session | `users.session_revoked_at` |
| FR-H3.2 consent at capture | `ck_users_base_location_consent` CHECK constraint |
| NFR-A4 per-agent latency measurable | `agent_invocations.latency_ms` |
| NFR-I1 add a language without code change | `preferred_language` is `String(8)`, not a DB enum |

---

## 12. Open issues

Ordered by how much they matter.

### 12.1 PFZ publishes zero zones — **unresolved**

The batch completes, coverage reaches ~86%, and every point classifies as the
same class. `diagnose_pfz` fed chlorophyll at NaN, 0.3, 1.0 and 3.0 mg/m³ and
got an identical distribution each time, so chlorophyll is not the
discriminator.

Two possibilities remain: the model genuinely never predicts BEST or GOOD for
real Karnataka conditions, or the feature order in `pfz-api`'s `batch_custom`
is still wrong. XGBoost is positional; a mismatched order produces confident
nonsense rather than an error.

**Next step:** `python -m scripts.diagnose_pfz --labels` sweeps SST 24–31°C
across chlorophyll values. If class `0` or `1` never appears for *any* input,
the integration is broken rather than the ocean being unproductive.

The pipeline reports this honestly as `no_qualifying_conditions`, so nothing is
fabricated — but the PFZ feature currently demonstrates nothing.

### 12.2 `DEV_AUTH_BYPASS` disables authentication entirely

Guarded three ways — off by default, refuses to load under `APP_ENV=production`,
and shows a persistent amber banner. **Remove it from `.env` before any demo on
a reachable port.**

### 12.3 Gazetteer coordinates are hand-entered approximations

The eleven entries in `geo_tool.COASTAL_GAZETTEER` are good enough to resolve
"weather near Malpe" to the right stretch of coast and **not** good enough to
navigate by. They now decide which stretch of ocean a safety verdict describes,
so they warrant verification against an authoritative source. A place resolving
20 km off is invisible in the output and shifts every number in the answer.

### 12.4 No Alembic

`init_db.py --drop` is the schema-change path. Fine while the schema churns;
stops being fine once there is data worth keeping.

### 12.5 Salinity is a climatology constant

34.5 PSU for every grid point. No free real-time source exists. Recorded in
`feature_provenance` as `kind: climatology, observed: false`.

### 12.6 Reference pages have no backend

`/route`, `/analytics`, `/dashboard` are kept visible as roadmap references and
still render local sample data. They need the same labelling treatment as the
rest of the app before a public demo.

### 12.7 Rate limiting is in-process

`security.check_rate_limit` uses an in-memory window. Sufficient at demo scale;
does not survive multiple workers.

---

## 13. Troubleshooting

**`getProfile()` throws `NetworkError` from the browser**
CORS. The backend needs `CORS_ORIGINS=http://localhost:5173` and
`allow_credentials=True`. A wildcard origin will not work alongside credentials.

**`/chat?stream=true` returns JSON instead of SSE frames**
Uvicorn is serving an old `chat.py`. Check:
```bash
curl -s localhost:8000/openapi.json | python -c "import sys,json; print([p['name'] for p in json.load(sys.stdin)['paths']['/api/v1/chat']['post'].get('parameters',[])])"
```
Expect `['stream', 'accept']`.

**Every verdict is CAUTION with "hazard alert feed unreachable"**
`sachet_poll` has never succeeded. Run it once.

**Open-Meteo returns HTTP 429 during `pfz_batch`**
Requests are serial at 1.5 s intervals, and 429 is retried with backoff. If it
persists, tighten the bbox in `thresholds.yaml` — the grid is billed per
coordinate.

**All alerts store with `area_geom = NULL`**
NDMA often uses `<circle>` or `<geocode>` rather than `<polygon>`. Circles are
converted; geocode-only alerts cannot be placed without the FR-C5 district
boundary layer and surface via `ungeolocated_alerts`. Confirm with
`python -m scripts.diagnose_cap 10`.

**`UnmappedLabelError` during `pfz_batch`**
The model emitted a class with no `pfz.class_labels` entry. Run
`diagnose_pfz --labels`. This error is deliberate: an unmapped label would
otherwise fail the BEST/GOOD test silently and look like an empty ocean.

**`duplicate key value violates uq_pfz_one_published`**
Fixed in `pfz_batch`. If it recurs, the demote `UPDATE` is not being flushed
before the promote.

**Frontend shows a logged-in user with the backend down**
An old `AuthContext` is still being imported.

---

## 14. Roadmap

### Before submission

- [ ] Resolve the zero-zone PFZ issue (§12.1)
- [ ] Verify gazetteer coordinates (§12.3)
- [ ] Remove `DEV_AUTH_BYPASS` (§12.2)
- [ ] Label or gate the reference pages (§12.6)
- [ ] Wire Hazards and PFZ pages to the real endpoints (Phase 2 Step 5)

### Iteration 2

- Firebase Phone Auth client SDK
- Proactive alerting: deterministic geospatial matching, Web Push + SMS (FR-F3)
- Position sharing with consent (FR-H6)
- EEZ and MPA boundary layers (FR-C5), enabling geocode-only alert placement
- Hindi and Kannada answer translation via the language layer (FR-A6)

### Iteration 3

- Safe route planning (FR-E5)
- Historical PFZ activity (FR-E7)
- Regional authority dashboard (FR-F4)

---

## Attribution

- **Weather and marine data** — [Open-Meteo](https://open-meteo.com) (CC BY 4.0)
- **Hazard alerts** — NDMA SACHET, crediting the originating agency (IMD / INCOIS / CWC / GSI)
- **Safety thresholds** — derived from IMD Fishermen Warning criteria

ORCA provides guidance, not official warnings. Always follow instructions from
IMD, INCOIS and your local port authority.