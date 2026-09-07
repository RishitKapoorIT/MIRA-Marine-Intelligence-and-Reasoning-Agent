# ORCA / MIRA — Marine Intelligence and Reasoning Agent
**Autonomous Multi-Agent Ocean Intelligence, Potential Fishing Zone (PFZ) Advisory & Maritime Decision-Support Platform**

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.1-FF6600)](https://xgboost.readthedocs.io/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Turf.js](https://img.shields.io/badge/Turf.js-Spatial-2ECC71)](https://turfjs.org/)
[![i18next](https://img.shields.io/badge/i18next-Multilingual-26A69A?logo=i18next&logoColor=white)](https://www.i18next.com/)
[![Git Branch](https://img.shields.io/badge/Git%20Branch-Frontend-brightgreen)](https://github.com/RishitKapoorIT/MIRA-Marine-Intelligence-and-Reasoning-Agent/tree/Frontend)

---

## 🌊 Overview

**ORCA (Marine Intelligence)** — developed as **MIRA (Marine Intelligence and Reasoning Agent)** — is an AI-powered maritime decision-support platform engineered for artisanal fishers, commercial vessel operators, and coastal maritime authorities. 

The system transitions traditional marine maps from static visualizations into an **explainable, multi-agent reasoning workspace**:
1. Users ask natural-language maritime queries (e.g., *"weather report of my area"*, *"where are the highest-yield fishing zones near Odisha?"*, or *"is the sea swell safe for motorized craft today?"*).
2. A **visible multi-agent pipeline** orchestrates parallel sub-agent checks across oceanographic telemetry, weather models, and hazard exclusion zones.
3. The platform synthesizes an **evidence-backed recommendation** featuring real machine-learning PFZ predictions, a 2×2 satellite telemetry evidence grid (SST, Chlorophyll, Wave Swell, Bathymetry), and transparent logical reasoning.
4. Dedicated navigation views provide specialized interfaces for **PFZ Exploration**, **Maritime Safety & Hazard Monitoring**, **Turf.js Hazard-Avoidance Routing**, **Ocean Environmental Analytics**, and a **Regional Coastal Authority Fleet Dashboard**.
5. The entire application is fully localized in **English**, **Hindi (हिन्दी)**, and **Kannada (ಕನ್ನಡ)** with instant switching.
6. Every external data source, map tile, and API is **100% free with zero billing accounts or commercial licenses required**.

---

## 📁 Repository Structure

```
MIRA-Marine-Intelligence-and-Reasoning-Agent/  (Branch: Frontend)
├── frontend/                                   # React + Vite Web Application
│   ├── public/                                 # Static GIS assets & fallback data
│   │   ├── data/
│   │   │   ├── india_eez.geojson               # Indian Exclusive Economic Zone boundaries
│   │   │   └── sachet_fallback.json            # NDMA SACHET hazard cache (FR-C6 zero-blank guarantee)
│   │   └── vite.svg
│   ├── src/
│   │   ├── assets/                             # Icons, graphics, logos
│   │   ├── config/                             # Map configurations & endpoints
│   │   │   └── map.js                          # Basemap URLs, bounding boxes, API bases
│   │   ├── context/                            # Global State Management
│   │   │   ├── AuthContext.jsx                 # Mobile OTP, session cookies, demo login & user profile
│   │   │   └── LocationContext.jsx             # Active focus coordinates, 20 coastal sectors & states
│   │   ├── data/                               # Data-adapter layer (every external call lives here)
│   │   │   ├── boundaries.js                   # Territorial waters & marine protected zones
│   │   │   ├── chlorophyll.js                  # MODIS Ocean Color chlor_a data adapter
│   │   │   ├── hazards.js                      # NDMA SACHET CAP feed & regional exclusion zones
│   │   │   ├── pfz.js                          # Client adapter for self-hosted FastAPI XGBoost service
│   │   │   ├── routing.js                      # Turf.js client-side marine routing & port registry
│   │   │   ├── sst.js                          # Sea Surface Temperature telemetry adapter
│   │   │   ├── vessels.js                      # Authority vessel fleet telemetry (P4 persona)
│   │   │   └── weather.js                      # Open-Meteo Marine & Forecast API adapter
│   │   ├── hooks/                              # Custom React state & geolocation hooks
│   │   │   ├── useBearingDistance.js           # Great-circle calculations
│   │   │   ├── useGeolocation.js               # Browser GPS with coastal fallback
│   │   │   └── useLayerState.js                # Map layer toggle state management
│   │   ├── i18n/                               # Multilingual localization
│   │   │   ├── i18n.js                         # i18next configuration
│   │   │   └── locales/
│   │   │       ├── en.json                     # English dictionary
│   │   │       ├── hi.json                     # Hindi dictionary (हिन्दी)
│   │   │       └── kn.json                     # Kannada dictionary (ಕನ್ನಡ)
│   │   ├── components/
│   │   │   ├── layout/                         # Persistent global chrome
│   │   │   │   ├── Header.jsx                  # 64px top nav, language switcher & profile avatar
│   │   │   │   └── Sidebar.jsx                 # 280px persistent conversation history & threads
│   │   │   ├── welcome/                        # Welcome Screen & Quick Action cards
│   │   │   ├── maps/                           # Interactive Marine Maps with toggleable layers
│   │   │   ├── chat/                           # Conversational Workspace, agent cards & evidence
│   │   │   ├── pfz/                            # PFZ Discovery & Ranking View
│   │   │   ├── hazards/                        # Safety & Hazard Monitoring with Exclusion Zones
│   │   │   ├── route/                          # Safe Route Planning with Turf.js Avoidance
│   │   │   ├── analytics/                      # Ocean Environmental Analytics & Heatmaps
│   │   │   ├── dashboard/                      # Regional Coastal Authority Fleet Dashboard
│   │   │   ├── profile/                        # Vessel Master Profile & Safe House settings
│   │   │   ├── auth/                           # Mobile OTP Login & Onboarding Wizard
│   │   │   └── ui/                             # Reusable badges, toggles, and chips
│   │   ├── App.jsx                             # Declarative React Router definitions
│   │   ├── index.css                           # Tailwind CSS tokens, scrollbar, Leaflet overrides
│   │   └── main.jsx                            # React entry point
│   ├── package.json                            # Dependencies: React, Leaflet, Turf.js, i18next, Lucide
│   ├── tailwind.config.js                      # Curated marine palette (#0A0C0F, #00D8FF, #30E8B8)
│   └── vite.config.js                          # Vite build & bundler configuration
│
├── services/
│   ├── pfz-api/                                # Standalone Potential Fishing Zone Backend Service (:8000)
│   │   ├── main.py                             # FastAPI REST API with CORS enabled
│   │   ├── generator.py                        # Oceanographic feature synthesis engine
│   │   ├── xgboost_skin_fishing_model.pkl      # Trained XGBoost classifier artifact
│   │   ├── final_fishing_zone_ML_with_chlorophyll.csv # Empirical statistical training dataset
│   │   ├── requirements.txt                    # Python dependencies (fastapi, uvicorn, xgboost, etc.)
│   │   └── templates/                          # Standalone HTML dashboard
│   │       └── index.html
│   │
│   └── auth-api/                               # User Profile & Authentication Service (:8001)
│       ├── main.py                             # FastAPI REST API with SQLite database & cookies
│       ├── users.db                            # SQLite database for profiles and OTP tokens
│       └── requirements.txt                    # Dependencies (fastapi, uvicorn, pydantic)
│
├── .gitignore                                  # Clean root ignore rules (node_modules, venvs, dist)
└── Readme.md                                   # Comprehensive platform documentation
```

---

## 🛰️ Where Data Is Taken From & How External Providers Work

Per the **hard constraints** of the project, **every external data source, map layer, and API is 100% free with zero billing accounts or paid tiers required**:

| Layer / Feature | Source & Provider | Technical Endpoint / Method | Key/Billing Requirement |
|---|---|---|---|
| **PFZ ML Prediction** | Self-hosted XGBoost Model (`services/pfz-api`) | `POST /api/v1/predict/batch_coords` | **None** (Self-contained FastAPI service) |
| **Ocean Telemetry Synthesis** | Empirical distributions over historical satellite data | `EnvironmentalFeatureGenerator` in `generator.py` | **None** (Statistical distributions from training dataset) |
| **Marine Maps Basemap** | OpenStreetMap / CARTO Dark standard tiles | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | **None** (Open-access tile servers) |
| **Wave Height & Swell** | Open-Meteo Marine API | `https://marine-api.open-meteo.com/v1/marine` | **None** (Keyless, free open-access) |
| **Wind Speed & Weather** | Open-Meteo Forecast API | `https://api.open-meteo.com/v1/forecast` | **None** (Keyless, free open-access) |
| **Hazards & Cyclones** | NDMA SACHET CAP Feed + Fallback | `https://sachet.ndma.gov.in/cap_public_website/FeedService` via CORS proxy | **None** (Public Indian emergency feed) |
| **EEZ Boundaries** | Marineregions.org / Survey of India | Bundled GeoJSON (`public/data/india_eez.geojson`) | **None** (Open GIS dataset) |
| **Marine Route Solving** | Turf.js Spatial Library | Client-side spatial geometry (`@turf/turf`) | **None** (Local client computation) |
| **Port Search & Geocoding**| OpenStreetMap Nominatim | `https://nominatim.openstreetmap.org/search` | **None** (Public geocoder with custom UA) |
| **Authority AIS Fleet** | Simulated telemetry feed (`vessels.js`) | Local adapter adhering to AIS specifications | **None** (Simulated per Iteration 3 specs) |

---

## 🗺️ How Maps & Spatial Layers Are Used

Maps are rendered using **Leaflet 1.9.4** and **React-Leaflet 4.2.1** with custom dark-themed container overrides (`#0e1822` background to match satellite water bodies):

### 1. Coordinate System & Projection
- Standard geographic coordinates (**WGS 84, EPSG:4326**) are used across all adapters, port registries, and GeoJSON layers.
- Leaflet projects coordinates automatically to Spherical Mercator (**EPSG:3857**) for tile rendering.

### 2. The Data-Adapter Pattern (`src/data/*`)
- In accordance with project rules, **no component calls external APIs directly**.
- All data flows through typed asynchronous functions in `src/data/*` (`getPfzLayer()`, `getWeatherData()`, `getHazardAlerts()`, `computeMarineRoutes()`, `getVesselsData()`).
- Components receive normalized JavaScript objects, ensuring zero disruption if backend URLs or endpoints are swapped.

### 3. Layer Toggling Architecture
- Map layers are managed through `useLayerState.js` providing boolean switches for:
  - **PFZ Layer**: Renders high-yield fishing zones with grade badges (`BEST`, `GOOD`, `POOR`), distance/bearing, and expected species.
  - **Hazards Layer**: Renders red translucent exclusion circles around critical storm/cyclone zones and amber circles around severe swell surges.
  - **Boundaries Layer**: Displays India's 200-nautical-mile Exclusive Economic Zone (EEZ) polygon boundary.
  - **SST & Chlorophyll Thermal Layers**: Visualizes satellite frontal boundaries and chlorophyll productivity.
  - **Weather Layer**: Floats live wind and swell vectors.

### 4. Dynamic Camera Controls
- Custom `MapController` sub-components hook into Leaflet's internal map context using `useMap()`.
- Automatically animates camera transitions (`flyTo`, `fitBounds`) when selecting a zone, changing departure ports, or refocusing on regional presets (Arabian Sea, Bay of Bengal, Laccadive Sea, Gulf of Mannar).

### 5. Turf.js Client-Side Spatial Engine
- **Great-Circle Trajectories**: Calculates geodesic arc waypoints between departure and destination harbors.
- **Hazard Collision Detection**: Cyclone watches and rough swell areas are buffered into polygon exclusion circles (`turf.buffer` with 55km and 32km radii). Intersections between the planned polyline and hazard circles are detected via `turf.lineIntersect`.
- **Automated Detour Routing**: When a collision is identified, the engine computes tangent avoidance waypoints around the exclusion perimeter.

---

## 🏗️ System Architecture & Data Flow

```mermaid
graph TD
    User([Fisher / Vessel Master / Authority]) -->|Natural Query / Port Focus| UI[ORCA React + Vite Frontend :5173]

    subgraph Frontend Architecture
        UI --> AuthCtx[AuthContext - Mobile OTP & Profile]
        UI --> LocCtx[LocationContext - 20 Sectors & States]
        UI --> i18n[i18next Engine - EN / HI / KN]
        UI --> Leaflet[Leaflet GIS & Turf.js Spatial Engine]
        UI --> ChatEngine[Persistent Chat Thread Storage]
    end

    subgraph Backend Microservices
        ChatEngine -->|Predict Zones & Telemetry| PFZ_API[PFZ ML Service :8000\nFastAPI + XGBoost]
        AuthCtx -->|OTP / Session / Profile| AUTH_API[Auth & Profile Service :8001\nFastAPI + SQLite3]
    end

    subgraph External Open Data Providers
        LocCtx -.->|Geocoding| OSM[OpenStreetMap Nominatim]
        Leaflet -.->|Dark Marine Basemap| Carto[CARTO Dark / OSM Tiles]
        UI -.->|Waves & Swell| OpenMeteoMarine[Open-Meteo Marine API]
        UI -.->|Surface Winds| OpenMeteoForecast[Open-Meteo Forecast API]
        UI -.->|Disaster Alerts| NDMA[NDMA SACHET CAP Feed]
        PFZ_API -.->|Historical Distribution| MODIS[MODIS Aqua/Terra Datasets]
    end
```

---

## ⚙️ Backend Microservices & API Specifications

ORCA runs two standalone, self-contained Python FastAPI backend microservices with zero external database dependencies (no PostgreSQL or cloud setup required).

### 1. PFZ Machine Learning API (`services/pfz-api` — Port 8000)
Serves machine learning predictions for Potential Fishing Zones using a trained gradient-boosted decision tree classifier.

* **Technology**: Python 3.10+, FastAPI, Uvicorn, XGBoost 2.1, NumPy, Scikit-Learn.
* **Trained Model**: `xgboost_skin_fishing_model.pkl`
  * Trained on empirical Indian coastal oceanographic features: `YEAR`, `latitude`, `longitude`, `month`, `temperature` (°C), `salinity` (PSU), `eastward_current` (m/s), `northward_current` (m/s), `current_speed` (knots), `chlorophyll` (mg/m³).
* **Feature Synthesis Engine**: `EnvironmentalFeatureGenerator` in `generator.py`
  * Synthesizes physical ocean variables using statistical distributions derived from historical MODIS Aqua satellite data, bounded by seasonal oceanic parameters.

#### Key Endpoints:
| Method | Endpoint | Description | Request Payload / Params |
|---|---|---|---|
| `GET` | `/health` | Health check & model status | Returns loaded model class and feature schema |
| `POST` | `/api/v1/predict/batch_coords` | Batch PFZ evaluation for candidate sites | `{ "center_lat": 12.91, "center_lon": 74.85, "count": 8 }` |
| `POST` | `/api/v1/predict/zone` | Diagnostic prediction for single coordinate | `{ "lat": 12.85, "lon": 74.70, "features": {...} }` |

* **Sample Response (`/api/v1/predict/batch_coords`)**:
  ```json
  {
    "status": "success",
    "total_evaluated": 8,
    "zones": [
      {
        "id": "PFZ-KA-01",
        "lat": 12.766,
        "lon": 74.829,
        "predicted_zone": "BEST",
        "probability": 0.942,
        "expected_species": "Indian Mackerel & Oil Sardine",
        "distance_nm": 9.2,
        "bearing": "190° S",
        "temperature": 30.49,
        "chlorophyll": 0.0778,
        "sector": "Sector 7"
      }
    ]
  }
  ```

---

### 2. Auth & User Profile API (`services/auth-api` — Port 8001)
Provides mobile OTP authentication, persistent session cookies, and user profile management (Safe House harbor, saved default route, optional Aadhaar verification, preferred language).

* **Technology**: Python 3.10+, FastAPI, Uvicorn, SQLite3 (`users.db`), Pydantic v2.
* **Storage**: Local SQLite database `users.db` created automatically on startup.
* **Session Management**: Dual authentication via HTTP-only persistent cookie (`orca_session`, 30 days expiry) and Bearer token in headers (`Authorization: Bearer <token>`).

#### Database Schema:
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    safe_house TEXT,         -- JSON: { lat, lon, label }
    safe_route TEXT,         -- JSON: { origin, destination, waypoint }
    aadhaar TEXT,            -- Optional identity verification
    preferred_language TEXT DEFAULT 'en',
    onboarding_completed INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE otp_tokens (
    phone TEXT PRIMARY KEY,
    otp TEXT NOT NULL,
    expires_at REAL NOT NULL
);
```

#### Key Endpoints:
| Method | Endpoint | Description | Details |
|---|---|---|---|
| `GET` | `/health` | Microservice & SQLite check | Returns online status |
| `POST` | `/api/v1/auth/request-otp` | Request 6-digit login OTP | In dev mode generates code `123456`, logs to console, returns `dev_otp` |
| `POST` | `/api/v1/auth/verify-otp` | Verify code & establish session | Validates code, creates new user or fetches existing, sets cookie, flags `is_new_user` |
| `GET` | `/api/v1/profile` | Retrieve active profile | Returns name, phone, safe house, safe route, language |
| `PUT` | `/api/v1/profile` | Update profile settings | Persists vessel master name, Safe House, Safe Route, Aadhaar, preferred language |
| `POST` | `/api/v1/auth/logout` | Revoke session | Deletes session cookie |

---

## 💻 Frontend Application Architecture

The frontend is a single-page application built with **React 18** and **Vite 5**, styled with custom **Tailwind CSS** marine tokens (`#0A0C0F` deep navy, `#00D8FF` cyan, `#30E8B8` seafoam green).

### 1. State Management & Context Architecture
* **[AuthContext.jsx](file:///r:/SIH_2.0/orca-app/src/context/AuthContext.jsx)**:
  * Manages user identity (`user`), authentication status (`isAuthenticated`), and token persistence.
  * Handles OTP verification, logout, profile updates, and a 1-click **`loginAsDemo()`** helper for instant testing.
  * Defaults unauthenticated visitors to `user = null` (no unauthorized auto-login).
* **[LocationContext.jsx](file:///r:/SIH_2.0/orca-app/src/context/LocationContext.jsx)**:
  * Manages the active focus harbor, coordinates, and coastal sector.
  * Registry of 20+ maritime locations and all Indian coastal states (**Odisha**, **Kerala**, **Karnataka**, **Maharashtra**, **Gujarat**, **Tamil Nadu**, **Andhra Pradesh**, **West Bengal**, **Goa**, **Andaman**).
  * Implements natural location parsing: queries like *"weather report of my area"*, *"how are waves here"*, or *"my place"* automatically resolve to the user's active harbor without needing rigid syntax.
* **Persistent Chat State**:
  * Stored in `localStorage` (`orca_chat_threads`, `orca_chat_messages_map`, `orca_active_thread_id`).
  * Switching tabs (**Chat ↔ Maps ↔ Analytics ↔ Profile**) preserves all conversation history and scroll position.

### 2. Application Modules & Routing (`App.jsx`)

| Route | View Component | Core Features |
|---|---|---|
| `/` | `WelcomePage.jsx` | Ocean landing page, regional status indicators, quick action navigation, language switcher. |
| `/chat` | `ChatPage.jsx` | Multi-agent reasoning conversational workspace. Dedicated cards for Weather/Swell, Hazards, Safe Routes, and PFZ Matrix. |
| `/maps` | `MapsPage.jsx` | Interactive full-screen Leaflet GIS map with toggleable layers (PFZ, Hazards, EEZ, Weather, SST, Chlorophyll). |
| `/pfz` | `PfzExplorationPage.jsx` | Ranked candidate fishing zones sortable by **Highest Yield**, **Nearest**, or **Safest**, with live Leaflet markers. |
| `/hazards` | `HazardsPage.jsx` | Real-time NDMA SACHET disaster warnings, 55km exclusion circle overlays, VHF Channel 16 emergency guidelines. |
| `/route` | `RoutePlanningPage.jsx` | Turf.js client-side marine routing engine with automated hazard collision detection and detour waypoints. |
| `/analytics`| `OceanAnalyticsPage.jsx` | Ocean environmental monitoring: live SST and Chlorophyll thermal gradient overlays, wave metrics, harbor switcher. |
| `/dashboard`| `AuthorityDashboardPage.jsx` | Coastal authority fleet dashboard: live vessel AIS tracking, SOS/EPIRB emergency alerts, district compliance meters. |
| `/profile` | `ProfilePage.jsx` | Manage Captain identity, Safe House harbor anchor, default safe route, optional Aadhaar, and language. |
| `/login` | `LoginPage.jsx` | Mobile phone login, 6-digit OTP verification, first-time vessel master onboarding wizard, active session card. |

---

## 🌐 Multilingual & Localization Architecture (`i18n`)

ORCA provides full app-wide localization to support Indian fishers in their native languages.

### 1. Engine & Implementation
* **Libraries**: `i18next` and `react-i18next`.
* **Configuration**: Initialized in `src/i18n/i18n.js`.
* **Supported Languages**:
  * **English (`en`)** — Default
  * **Hindi (`hi`)** — हिन्दी
  * **Kannada (`kn`)** — ಕನ್ನಡ

### 2. Storage & Dynamic Switching
* **Instant Switching**: Clicking the language selector buttons (`EN`, `HI`, `KN`) in the global header or welcome page immediately re-renders all text tokens across the application without reloading the page.
* **Dual Persistence**:
  1. Client-side in `localStorage.getItem('orca_language')`.
  2. Synced to the backend SQLite profile (`preferred_language`) so preferences persist across devices.

### 3. Locale Dictionary Structure
All translations live in `src/i18n/locales/` (`en.json`, `hi.json`, `kn.json`):
* `nav.*`: Header navigation tabs, buttons, and titles.
* `welcome.*`: Landing page hero headers, feature descriptions, and stats.
* `auth.*`: Login headings, phone labels, OTP prompts, and dev notices.
* `profile.*`: Identity fields, Safe House descriptions, Aadhaar notices, and save confirmations.
* `chat.*`: Agent pipeline labels, jump-to-scroll buttons, input placeholders.
* `analytics.*`: Metric cards, temperature scales, and telemetry citations.
* `hazards.*`: Emergency instruction modal, severity tags, and advisory text.
* `route.*`: Route planning headers, safety scores, and waypoint directions.
* `badges.*`: Standardized confidence badges (**Good catch chance**, **Moderate**, **Low**).

---

## ⚓ Safe House & User Profile System

The **Safe House** concept serves as the core anchor for vessel safety:

1. **GPS Denied Fallback**: When satellite GPS is denied, disabled, or inaccurate, the Safe House coordinates automatically provide the home anchor.
2. **Dynamic Context Provider**: Setting a Safe House in [ProfilePage.jsx](file:///r:/SIH_2.0/orca-app/src/components/profile/ProfilePage.jsx) automatically configures the default harbor, ocean analytics, weather forecast, and PFZ search area.
3. **Safe Route Pre-fill**: The user's saved default route (origin harbor to destination harbor) automatically pre-fills the route planner.
4. **Government Scheme Aadhaar**: An optional 12-digit Aadhaar identity field stored locally in encrypted form to qualify vessel operators for disaster relief funds and fuel subsidies without leaking data to third parties.

---

## 🛡️ Data Honesty & Safety-First Disclosure (FR-C6)

In strict adherence to project requirements:
1. **No Mock Data Presented as Live**: Where live satellite or vessel feeds require enterprise commercial subscriptions (such as high-frequency satellite AIS or sub-meter bathymetry), UI elements are visibly and plainly labeled as **Sample / Simulated Telemetry**.
2. **PFZ Attribution**: All PFZ cards and advisories state plainly: *"via ORCA's own PFZ model over public satellite data (not an INCOIS-certified advisory)"*.
3. **Marine Routing Disclaimer**: Route alternatives generated via Turf.js are described as heuristic spatial solutions; they do not claim ECDIS or SOLAS navigation certification.

---

## ⚡ Quickstart & Local Execution Guide

### Prerequisites
* **Node.js**: v18.0.0 or higher (v20+ recommended)
* **Python**: 3.10 or higher (with pip)
* **Git**

---

### Step 1: Start the PFZ Machine Learning Service (Port 8000)

```bash
# Navigate to the PFZ API directory
cd services/pfz-api

# Create and activate a Python virtual environment
python -m venv venv
# On Windows (PowerShell):
venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service on port 8000
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
* **Health Check**: Visit `http://127.0.0.1:8000/health` (returns `status: online`, `model_loaded: true`).
* **API Documentation**: Visit `http://127.0.0.1:8000/docs`.

---

### Step 2: Start the Auth & Profile Service (Port 8001)

In a second terminal:

```bash
# Navigate to the Auth API directory
cd services/auth-api

# Activate the virtual environment
# On Windows (PowerShell):
..\..\venv\Scripts\Activate.ps1
# On macOS/Linux:
source ../../venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service on port 8001
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
* **Health Check**: Visit `http://127.0.0.1:8001/health` (returns `status: online`, `db: sqlite3`).
* **API Documentation**: Visit `http://127.0.0.1:8001/docs`.

---

### Step 3: Start the Frontend Application (Port 5173)

In a third terminal:

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Launch Vite development server
npm run dev
```

Open **`http://127.0.0.1:5173`** in your browser to launch ORCA.

---

### Step 4: Verifying Production Build

```bash
cd frontend
npm run build
```
Builds cleanly to `dist/` with 0 bundling errors.

---

## 👨‍💻 Git Workflow & Commit History

All development is maintained directly on the **`Frontend`** branch of [`RishitKapoorIT/MIRA-Marine-Intelligence-and-Reasoning-Agent`](https://github.com/RishitKapoorIT/MIRA-Marine-Intelligence-and-Reasoning-Agent/tree/Frontend):

```
e6bfb56 docs: comprehensive update to Readme with API, backend, frontend, maps, and i18n specifications
8c26f5e fix(chat): persist threads across tab switches, support natural location queries, and add dedicated weather & hazard responses
c4c68ed feat(auth): fix new user login flow, remove auto-login, add onboarding and demo shortcuts
2be8817 feat(update3): implement Brief 3 fixes, SQLite auth backend, i18n switching, and sector zoning
ae62ef4 feat(dashboard): implement regional authority dashboard and fleet registry
c98b00d feat(analytics): implement ocean analytics and dual heatmaps
457a3e9 feat(route): implement safe route planning with Turf.js hazard avoidance
87b69cc feat(hazards): implement safety and hazard view with exclusion zones
ca44a5d feat(pfz): implement PFZ exploration with Nearest/Yield/Safety filters
cee6899 feat(chat): implement conversational workspace, agent pipeline, and evidence cards
3537a02 feat(frontend): scaffold React+Vite app shell, config, and base components
3fcef23 feat(backend): stand up FastAPI PFZ prediction service with XGBoost model
```

---

*Built with ❤️ for the Smart India Hackathon (SIH).*
