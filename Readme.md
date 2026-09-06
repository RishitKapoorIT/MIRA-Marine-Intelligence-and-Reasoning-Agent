# ORCA / MIRA — Marine Intelligence and Reasoning Agent
**Autonomous Multi-Agent Ocean Intelligence & Potential Fishing Zone (PFZ) Advisory Platform**

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.1-FF6600)](https://xgboost.readthedocs.io/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Turf.js](https://img.shields.io/badge/Turf.js-Spatial-2ECC71)](https://turfjs.org/)
[![Branch](https://img.shields.io/badge/Git%20Branch-Frontend-brightgreen)](https://github.com/RishitKapoorIT/MIRA-Marine-Intelligence-and-Reasoning-Agent/tree/Frontend)

---

## 🌊 Overview

**ORCA (Marine Intelligence)** — also referred to as **MIRA (Marine Intelligence and Reasoning Agent)** — is an AI-powered maritime decision-support platform engineered for artisanal fishers, commercial vessel operators, and coastal maritime authorities. 

The system transitions traditional marine maps from static visualizations into an **explainable, multi-agent reasoning workspace**:
1. Users ask natural-language maritime queries (e.g., *"Where are the highest-yield fishing zones near Mangalore?"* or *"Is the sea swell safe for motorized craft today?"*).
2. A **visible multi-agent pipeline** orchestrates parallel sub-agent checks across oceanographic telemetry, weather models, and hazard zones.
3. The platform synthesizes an **evidence-backed recommendation** featuring real machine-learning PFZ predictions, a 2×2 satellite telemetry evidence grid (SST, Chlorophyll, Wave Swell, Bathymetry), and a transparent logical reasoning chain.
4. Integrated sub-views provide specialized interfaces for **PFZ Exploration (Frame 06)**, **Maritime Safety & Hazards (Frame 07)**, **Turf.js Hazard-Avoidance Routing (Frame 08)**, **Ocean Environmental Analytics (Frame 09)**, and a **Regional Coastal Authority Dashboard (Frame 10)**.

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
│   │   │   ├── useGeolocation.js               # Browser GPS with Mangalore fallback
│   │   │   └── useLayerState.js                # Map layer toggle state management
│   │   ├── components/
│   │   │   ├── layout/                         # Persistent global chrome
│   │   │   │   ├── Header.jsx                  # 64px top nav (Chat / Maps / Analytics / Dashboard)
│   │   │   │   └── Sidebar.jsx                 # 280px conversation history & session switcher
│   │   │   ├── welcome/                        # Frame 01: Welcome Screen
│   │   │   ├── maps/                           # Frame 02: Interactive Marine Maps with toggleable layers
│   │   │   ├── chat/                           # Frames 03, 04, 05: Conversational Workspace & Evidence
│   │   │   ├── pfz/                            # Frame 06: PFZ Discovery & Ranking View
│   │   │   ├── hazards/                        # Frame 07: Safety & Hazard Monitoring with Exclusion Zones
│   │   │   ├── route/                          # Frame 08: Safe Route Planning with Turf.js Avoidance
│   │   │   ├── analytics/                      # Frame 09: Ocean Environmental Analytics & Heatmaps
│   │   │   ├── dashboard/                      # Frame 10: Regional Coastal Authority Fleet Dashboard
│   │   │   └── ui/                             # Reusable badges, toggles, and chips
│   │   ├── App.jsx                             # Declarative React Router definitions (Frames 01-10)
│   │   ├── index.css                           # Tailwind CSS tokens, scrollbar, Leaflet overrides
│   │   └── main.jsx                            # React entry point
│   ├── package.json                            # Dependencies: React, Leaflet, Turf.js, Lucide-React
│   ├── tailwind.config.js                      # Curated marine palette (#0A0C0F, #00D8FF, #30E8B8)
│   └── vite.config.js                          # Vite build & bundler configuration
│
├── services/
│   └── pfz-api/                                # Standalone Potential Fishing Zone Backend Service
│       ├── main.py                             # FastAPI REST API with CORS enabled
│       ├── generator.py                        # Oceanographic feature synthesis engine
│       ├── xgboost_skin_fishing_model.pkl      # Trained XGBoost classifier artifact
│       ├── final_fishing_zone_ML_with_chlorophyll.csv # Empirical statistical training dataset
│       ├── requirements.txt                    # Python dependencies (fastapi, uvicorn, xgboost, etc.)
│       └── templates/                          # Standalone HTML dashboard
│           └── index.html
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
- Standard geographic coordinates (**WGS 84, EPSG:4326**) are used across all adapters and GeoJSON layers.
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

---

## 🚢 Detailed Breakdown: Frames 01 to 10

### Frame 01 — Welcome Screen (`/`)
- **Visual Reference**: Figma Frame 01.
- **Components**: `WelcomePage.jsx`, `HeroCard.jsx`, `QuickActionCard.jsx`.
- **Functionality**:
  - High-impact dark oceanic landing interface.
  - Headline: *"Understand the ocean. Make safer decisions."*
  - Quick action grid routing directly to deep features:
    - 🎣 *Find fishing zones* → `/chat?q=Identify best fishing zones`
    - 🌦 *Check sea safety* → `/chat?q=Check sea safety and swell conditions`
    - ⚠️ *View active hazards* → `/hazards`
    - 🧭 *Plan a safe route* → `/route`
  - Multilingual footer banner (English · Hindi · Kannada).

### Frame 02 — Interactive Marine Maps Shell (`/maps`)
- **Visual Reference**: Figma Frame 02.
- **Components**: `MapsPage.jsx`, `MapArea.jsx`, `LeftSidebar.jsx`, `LayersPanel.jsx`, `BottomTabBar.jsx`.
- **Functionality**:
  - Full-screen Leaflet map with dark maritime styling.
  - Collapsible layers panel toggling SST, Chlorophyll, Weather, Hazards, Boundaries, and PFZ markers.
  - Water body quick presets (Arabian Sea, Bay of Bengal, Laccadive Sea, Gulf of Mannar).
  - Search bar powered by OpenStreetMap Nominatim.

### Frame 03 — Conversational Workspace (`/chat`)
- **Visual Reference**: Figma Frame 03.
- **Components**: `ChatPage.jsx`, `Sidebar.jsx`.
- **Functionality**:
  - Right-aligned user bubbles; left-aligned ORCA responses with "O" avatar.
  - Natural language summary accompanied by a **Structured PFZ Prediction Table**:
    - Columns: `ZONE ID`, `DISTANCE & BEARING`, `EXPECTED SPECIES`, `SST · CHLOROPHYLL`, `CONFIDENCE`.
    - Populated by real predictions from the self-hosted XGBoost model.
  - Dual action buttons beneath table:
    - **"View on Map"**: Routes to `/maps` centering that specific zone.
    - **"Plot Safest Route"**: Routes to `/route` pre-filled with the target zone.
  - Input area with attach and microphone icons (visual indicators per FR-A5/A6).

### Frame 04 — Real-Time Multi-Agent Processing State (`/chat`)
- **Visual Reference**: Figma Frame 04.
- **Component**: `AgentProcessingCard.jsx`.
- **Functionality**:
  - Inline thinking state rendered while a query is executing: *"ORCA is thinking... analyzing marine layers"*.
  - 4-row live agent pipeline with animated progress spinners and elapsed timestamps:
    1. **Planner Agent** — *"Scheduled 4 sub-agent checks across oceanographic layers"* (Completed · 0.2s).
    2. **Weather Agent** — *"Fetched wind & wave data via Open-Meteo Marine telemetry"* (Driven by live API network latency).
    3. **PFZ Agent** — *"Synthesizing MODIS chlorophyll & running XGBoost classifier"* (Resolves upon FastAPI response).
    4. **Risk Assessment Agent** — *"Queueing boundary collision & hazard exclusion checks"* (Resolves upon boundary scan).

### Frame 05 — Satellite Telemetry Evidence & Explainability (`/chat`)
- **Visual Reference**: Figma Frame 05.
- **Component**: `EvidenceCards.jsx`.
- **Functionality**:
  - Recommended zone header with confidence pill (e.g., `94.2% Confidence`).
  - **2×2 Satellite & Telemetry Evidence Grid**:
    - **SST Card**: MODIS Thermal Front, recency (`2h ago`), temperature value, and plain-language physical interpretation.
    - **Chlorophyll Card**: MODIS Ocean Color, chlorophyll density (`mg/m³`), and forage productivity interpretation.
    - **Wave Swell Card**: Live Open-Meteo Marine feed, swell height, and vessel transit safety clearance.
    - **Bathymetry Card**: GEBCO depth ridge contour (honestly marked as `Static Sample` per FR-C6).
  - **Logical Reasoning Chain**: 3-step numbered narrative trace dynamically interpolating live values to explain *why* the zone was recommended.

### Frame 06 — PFZ Discovery & Exploration (`/pfz`)
- **Visual Reference**: Figma Frame 06.
- **Component**: `PfzExplorationPage.jsx`.
- **Functionality**:
  - Three client-side sorting filter pills:
    - **Highest Yield**: Sorts by `BEST` grade first, then by highest ML confidence.
    - **Nearest**: Sorts client-side by nautical distance from harbor.
    - **Safest**: Sorts by lowest hazard overlap, prioritizing vessels with limited range.
  - Ranked zone cards with distance, bearing, target species, and SST/Chlorophyll badges.
  - Prominent **"Navigate to Zone"** button on the top recommendation card.
  - Live Leaflet map displaying colored markers (Emerald for BEST, Cyan for GOOD, Amber for POOR) with pulsing selection halo.
  - Bottom advisory banner stating plainly: *"via ORCA's own PFZ model over public satellite data (not an INCOIS-certified advisory)"* per Section 10.2.

### Frame 07 — Maritime Safety & Hazards View (`/hazards`)
- **Visual Reference**: Figma Frame 07.
- **Component**: `HazardsPage.jsx`.
- **Functionality**:
  - Top critical emergency banner rendered when severe cyclone or weather alerts are active.
  - **Emergency Instruction Modal**: Accessible via *"VIEW INSTRUCTION"* button, listing coastal evacuation and VHF Channel 16 directives.
  - 3-number severity strip: **Critical** (Red), **Warnings** (Amber), **Advisories** (Blue).
  - Scrollable hazard cards list with affected coastal sector and validity windows.
  - Interactive Leaflet map rendering dashed translucent exclusion circle overlays (55km radius for cyclones).
  - Floating map legend card.

### Frame 08 — Safe Route Planning (`/route`)
- **Visual Reference**: Figma Frame 08.
- **Component**: `RoutePlanningPage.jsx`, `routing.js`.
- **Functionality**:
  - Indian ports database (Mangalore, New Mangalore, Malpe, Karwar, Mormugao, Panaji, Kochi, Kannur, Mumbai, Ratnagiri) with custom PFZ target pre-fill support.
  - Optional intermediate waypoint selection and departure-time picker.
  - **Turf.js Client-Side Spatial Routing Engine**:
    - Calculates great-circle waypoints between departure and destination.
    - Detects spatial intersections against active hazard exclusion circles.
    - Calculates detour offset points circumventing danger zones.
  - **2 Computed Route Alternatives**:
    - *Safest Optimal (Hazard-Free)* — Safety Score: 98/100, 124.4 nm, 0 hazard zones traversed.
    - *Alternative Inshore Contour* — Safety Score: 91/100, sheltered passage in rough swell.
  - Turn-by-turn navigation leg cards with compass headings (e.g. `274° WNW`) and leg nautical miles.
  - Route polyline and hazard exclusion overlays drawn on Leaflet map.

### Frame 09 — Ocean Environmental Analytics (`/analytics`)
- **Visual Reference**: Figma Frame 09.
- **Component**: `OceanAnalyticsPage.jsx`.
- **Functionality**:
  - Top metric row (4 cards): **SST Average** (°C), **Chlorophyll-A** (mg/m³), **Current Speed** (m/s), **Wave Height** (m) with trend indicators.
  - **Dual Visual Heatmap Panels**:
    - *Sea Surface Temperature Frontal Distribution*: Leaflet thermal overlay with a 24°C–31.5°C color gradient spectrum.
    - *Chlorophyll-a Oceanic Productivity*: Phytoplankton density overlay with an oligotrophic to active bloom gradient legend.
  - Attribution cards citing MODIS, VIIRS, and Open-Meteo sources.

### Frame 10 — Regional Maritime Authority Dashboard (`/dashboard`)
- **Visual Reference**: Figma Frame 10 / US-13, US-14.
- **Component**: `AuthorityDashboardPage.jsx`, `vessels.js`.
- **Functionality**:
  - Tailored for Persona 4 (Coastal Maritime & Fisheries Authorities).
  - 4 headline stat cards: **Monitored Vessel Fleet** (142 Active), **Emergency Beacons Active** (1 EPIRB Alert), **Active Warnings** (3 Bulletins), **Fleet Compliance Rate** (96.4%).
  - Searchable **Regional Vessel Registry & Telemetry Feed Table**:
    - Tracks vessel ID, name, vessel class, home harbor, live coordinates, speed (knots), and heading.
    - Live status tags: `NORMAL` (Green), `GEOFENCE_ALERT` (Amber), `DISTRESS_SOS` (Red pulsating alert).
  - Real-time **Regional Activity Event Log**: Timestamped dispatch log tracking emergency beacon alerts, buffer zone incursions, and port return docks.
  - **District Fleet Compliance Progress Meters**: Horizontal compliance bars for Dakshina Kannada, Udupi, Uttara Kannada, and South Goa.
  - Clear data honesty disclaimer indicating simulated AIS telemetry per project Iteration 3 specifications.

---

## ⚡ Quickstart & Local Execution Guide

### Prerequisites
- **Node.js**: v18+ or v20+
- **Python**: 3.10+ or 3.11+
- **Git**

---

### Step 1: Start the PFZ Prediction Backend (FastAPI)

```bash
# Navigate to the backend service directory
cd services/pfz-api

# Create and activate a Python virtual environment (if not already created)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Launch the FastAPI service on port 8000
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- **Health Check**: Visit `http://localhost:8000/health` to verify model status:
  ```json
  {
    "status": "online",
    "model_loaded": true,
    "model_type": "<class 'xgboost.sklearn.XGBClassifier'>",
    "expected_features": ["YEAR", "latitude", "longitude", "month", "temperature", "salinity", "eastward_current", "northward_current", "current_speed", "chlorophyll"]
  }
  ```
- **Interactive OpenAPI Documentation**: Visit `http://localhost:8000/docs`.

---

### Step 2: Start the Frontend Application (Vite + React)

In a separate terminal:

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server on port 5173
npm run dev
```

Open **`http://localhost:5173`** in your browser to explore all 10 frames.

---

### Step 3: Verifying Production Build

```bash
cd frontend
npm run build
```
Builds cleanly to `frontend/dist/` with 0 bundling errors.

---

## 🛡️ Data Honesty & Safety-First Disclosure (FR-C6)

In strict adherence to project requirements:
1. **No Mock Data Presented as Live**: Where live satellite or vessel feeds require enterprise commercial subscriptions (such as high-frequency satellite AIS or sub-meter bathymetry), UI elements are visibly and plainly labeled as **Sample / Simulated Telemetry**.
2. **PFZ Attribution**: All PFZ cards and advisories state plainly: *"via ORCA's own PFZ model over public satellite data (not an INCOIS-certified advisory)"*.
3. **Marine Routing Disclaimer**: Route alternatives generated via Turf.js are described as heuristic spatial solutions; they do not claim ECDIS or SOLAS navigation certification.

---

## 👨‍💻 Git Workflow & Credits

All code has been committed in granular, reviewable increments directly on the **`Frontend`** branch of [`RishitKapoorIT/MIRA-Marine-Intelligence-and-Reasoning-Agent`](https://github.com/RishitKapoorIT/MIRA-Marine-Intelligence-and-Reasoning-Agent/tree/Frontend):

```
ae62ef4 feat(dashboard): implement Frame 10 regional authority dashboard and fleet registry
c98b00d feat(analytics): implement Frame 09 ocean analytics and dual heatmaps
457a3e9 feat(route): implement Frame 08 safe route planning with Turf.js hazard avoidance
87b69cc feat(hazards): implement Frame 07 safety and hazard view with exclusion zones
ca44a5d feat(pfz): implement Frame 06 PFZ exploration with Nearest/Yield/Safety filters
cee6899 feat(chat): implement Frames 03, 04, 05 conversational workspace, agent pipeline, and evidence cards
3537a02 feat(frontend): scaffold React+Vite app shell, config, and Frames 01-02 base components
3fcef23 feat(backend): stand up FastAPI PFZ prediction service with XGBoost model
```

