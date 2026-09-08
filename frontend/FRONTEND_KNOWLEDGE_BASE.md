# ORCA / MIRA — Complete Frontend Knowledge Base & Technical Master Guide
**Document Version**: 2.0 (SIH Finale & Production Reference)  
**System Name**: ORCA — Marine Intelligence & Reasoning Agent (MIRA)  
**Target Audience**: Developers, Judges, Evaluators, Technical Architects, Presenters

---

## Table of Contents
1. [Executive Overview & Platform Mission](#1-executive-overview--platform-mission)
2. [Frontend Technology Stack](#2-frontend-technology-stack)
3. [Source Code Directory & Architecture](#3-source-code-directory--architecture)
4. [Complete Page-by-Page & Frame Breakdown](#4-complete-page-by-page--frame-breakdown)
5. [Complete Exhaustive Network Calls (GET, POST, PUT, SSE)](#5-complete-exhaustive-network-calls-get-post-put-sse)
6. [State Management & Context Architecture](#6-state-management--context-architecture)
7. [The Intelligent Marine AI Engine (`marineChatEngine.js`)](#7-the-intelligent-marine-ai-engine-marinechatenginejs)
8. [Geospatial & Map Engine (Leaflet + Turf.js)](#8-geospatial--map-engine-leaflet--turfjs)
9. [Multilingual i18n & Voice Speech System](#9-multilingual-i18n--voice-speech-system)
10. [Data Honesty & Free-Data Architecture](#10-data-honesty--free-data-architecture)
11. [Viva, Evaluation & Hackathon Q&A Defense](#11-viva-evaluation--hackathon-qa-defense)

---

## 1. Executive Overview & Platform Mission

### What is ORCA / MIRA?
**ORCA (Oceanic Reasoning & Coastal Advisory)**, powered by the **MIRA (Marine Intelligence and Reasoning Agent)** engine, is a mission-critical, AI-driven marine intelligence and navigation copilot designed specifically for India's 4+ million coastal mariners, motorized fishing crews, mechanized trawlers, and regional maritime authorities.

### Core Problem It Solves
1. **Safety at Sea**: Indian fishermen often face sudden monsoonal squalls, rough swells (>2.5m), and cyclonic depressions without accessible, real-time safety advisories.
2. **Economic Waste (Diesel Costs)**: Marine diesel accounts for 60–70% of voyage operational costs. Traditional trial-and-error searching wastes hundreds of liters of fuel.
3. **Hazard Navigation**: Vessels frequently run into coral reefs, shipping traffic separation lanes (TSS), submerged wrecks, or cross maritime boundary lines (IMBL).
4. **Language & Literacy Barriers**: Traditional government marine weather bulletins are issued as complex English/Hindi text PDFs that mariners cannot interpret at sea.

### The ORCA Solution
* **Zero-Cost, Free-Data Infrastructure**: 100% free of paid API keys. Uses open-access satellites (NASA GIBS, Open-Meteo, OpenStreetMap, NOAA).
* **AI Conversational Copilot**: Multi-turn marine intelligence in English, Hindi, and Kannada with full voice speech-to-text and text-to-speech.
* **Predictive Fishing Zones (PFZ)**: Real-time XGBoost ML model combining Sea Surface Temperature (SST), Chlorophyll-a, and oceanic current vectors to guide boats directly to fish aggregations.
* **Turbulent Hazard Avoidance Routing**: Computational geometry (Turf.js) calculates obstacle-free nautical transit lines connecting the mariner's designated coastal **Safe House** port to offshore fishing zones.

---

## 2. Frontend Technology Stack

| Layer | Technology | Version | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React | `^18.3.1` | Concurrent rendering, component reusability, rich ecosystem |
| **Build & Bundler** | Vite | `^5.4.21` | Sub-second HMR (Hot Module Replacement), optimized rollup production bundles |
| **Routing** | React Router DOM | `^6.22.0` | Client-side declarative routing, deep linking, query parameter management |
| **Styling & Design System** | Tailwind CSS | `^3.4.1` | Custom maritime dark palette (`orca-bg`, `orca-surface`, `orca-teal`, `orca-violet`, `orca-amber`) |
| **Spatial / Maps** | Leaflet & React-Leaflet | `^1.9.4` / `^4.2.1` | Lightweight, high-performance canvas & tile map rendering |
| **Spatial Math / GIS** | Turf.js (`@turf/turf`) | `^7.2.0` | Point-in-polygon checks, geodesic distance, bearing, waypoint hazard avoidance |
| **Icons** | Lucide React | `^0.344.0` | High-clarity, lightweight SVG maritime and system icons |
| **Internationalization** | i18next & react-i18next | `^13.5.0` / `^23.10.0` | Zero-overhead runtime switching for English, Hindi, and Kannada |
| **Voice Processing** | Web Speech API | Native Browser | Zero-latency browser-native SpeechRecognition (STT) and SpeechSynthesis (TTS) |

---

## 3. Source Code Directory & Architecture

```
orca-app/src/
├── App.jsx                    # Core route definitions & Provider wrappers
├── main.jsx                   # React root mount point & i18n initialization
├── index.css                  # Tailwind directives & maritime custom scrollbar styles
│
├── components/
│   ├── layout/
│   │   ├── Header.jsx         # Persistent top bar: Location badge, quick nav, language & profile initials
│   │   ├── Sidebar.jsx        # Conversational threads history & active pipeline badge
│   │   └── StatusBanner.jsx   # Top maritime alert / dev-bypass notification banner
│   │
│   ├── welcome/
│   │   └── WelcomePage.jsx    # Frame 01: Hero landing screen with quick actions & live sea state summary
│   │
│   ├── maps/
│   │   ├── MapsPage.jsx       # Frame 02: Full geospatial canvas shell with layer controls & info drawer
│   │   ├── MapArea.jsx        # Leaflet MapContainer, dynamic center controller, click-to-inspect
│   │   ├── MapComponent.jsx   # Base Leaflet map wrapper with dark tile basemap
│   │   ├── MapsTopNav.jsx     # Geocoder search bar & rapid coastal sector bookmarks
│   │   └── layers/
│   │       ├── SstLayer.jsx           # NASA GIBS Sea Surface Temp WMTS + ML telemetry points + legend
│   │       ├── ChlorophyllLayer.jsx   # NASA GIBS MODIS Chlorophyll-a WMTS + telemetry points + legend
│   │       ├── HazardsLayer.jsx       # Offshore cyclone, storm surge & reef exclusion buffer zones
│   │       ├── SafeRouteLayer.jsx     # Safe House to PFZ polyline with distance & waypoint markers
│   │       └── PfzLayer.jsx           # XGBoost predicted fish grounds (High, Moderate, Low clusters)
│   │
│   ├── chat/
│   │   ├── ChatPage.jsx               # Frames 03-05: Main chat interface, user-scoped threads, action chips
│   │   ├── marineChatEngine.js        # Natural conversational AI reasoning engine (19 marine intents)
│   │   ├── AgentProcessingCard.jsx    # Multi-agent streaming pipeline trace (Planner, Weather, PFZ, Risk)
│   │   ├── EvidenceCards.jsx          # Collapsible telemetry evidence drawer with raw environmental data
│   │   └── VerdictBanner.jsx          # High-visibility maritime safety verdict (GO / CAUTION / NO-GO)
│   │
│   ├── auth/
│   │   └── LoginPage.jsx              # Mobile OTP verification, New Mariner registration tab, Active session badge
│   │
│   ├── profile/
│   │   └── ProfilePage.jsx            # Captain & vessel registration, Safe House port selector, Aadhaar, i18n
│   │
│   ├── pfz/
│   │   └── PfzExplorationPage.jsx     # Frame 06: Dedicated PFZ exploration grid with confidence metrics
│   │
│   ├── hazards/
│   │   └── HazardsPage.jsx            # Frame 07: Active maritime hazards, SACHET cyclone alerts & IMBL warnings
│   │
│   ├── route/
│   │   └── RoutePlanningPage.jsx      # Frame 08: Interactive route calculator with fuel & ETA estimation
│   │
│   ├── analytics/
│   │   └── OceanAnalyticsPage.jsx     # Frame 09: Oceanographic telemetry charts (wave, SST, chlorophyll trends)
│   │
│   └── dashboard/
│       └── AuthorityDashboardPage.jsx # Frame 10: Coast Guard / Fisheries department fleet oversight & SAR status
│
├── context/
│   ├── AuthContext.jsx        # Mariner session, SQLite token, profile storage & new user creation
│   └── LocationContext.jsx    # Monitored coastal basin, Safe House sync, 25+ coastal ports, geocoding
│
├── data/                      # Offline-first datasets & fallback telemetry
│   ├── boundaries.js          # India Exclusive Economic Zone (EEZ) polygon loader
│   ├── chlorophyll.js         # Chlorophyll concentration datasets & observation generators
│   ├── hazards.js             # Navigational hazard zones, shallow reefs, cyclone buffer zones
│   ├── pfz.js                 # PFZ fishing grounds coordinates, target species & confidence scores
│   ├── routing.js             # Waypoint routing algorithms & fuel consumption calculations
│   ├── sst.js                 # Sea Surface Temperature observation stations & thermal boundaries
│   ├── vessels.js             # Nearby vessel AIS simulation for collision avoidance
│   └── weather.js             # Open-Meteo live API integration & Beaufort scale wind converters
│
└── i18n/
    ├── i18n.js                # i18next configuration with LanguageDetector
    └── locales/
        ├── en.json            # English translations
        ├── hi.json            # Hindi translations (हिंदी)
        └── kn.json            # Kannada translations (ಕನ್ನಡ)
```

---

## 4. Complete Page-by-Page & Frame Breakdown

### Frame 01: Welcome Screen (`/welcome` or `/`)
* **Purpose**: Mariner's homepage and initial daily voyage orientation.
* **Features**:
  * Visual hero banner with vessel name (*"Matsya 3"*) and active monitored coastal sector.
  * Live sea state card: Instant wave height (m), wind speed (knots), and surface water temperature.
  * 4 quick-launch entry points: *Launch Marine Chat*, *Explore PFZ Maps*, *Plot Safe Passage*, *View Hazards*.
  * Recent activity feed: Summarizes the latest weather alerts and regional advisory bulletins.

### Frame 02: Marine Maps Canvas (`/maps`)
* **Purpose**: Geospatial command center displaying multi-layer oceanographic and navigational data.
* **Features**:
  * **Map Tile Engine**: High-contrast dark CartoDB basemap with smooth zoom and pan controls.
  * **Safe House Haven Marker**: Solid violet pin (`#8B5CF6`) anchored permanently to the mariner's registered home port (from `user.safe_house`). Independent of computer GPS.
  * **Vessel "You" Marker**: Solid gold/amber pin (`#FBBF24`) representing the vessel's current sea position.
  * **Safe Route Polyline**: High-contrast navigational corridor extending from the coastal haven out to the target PFZ, guaranteed never to cut across inland terrain.
  * **Real Satellite SST Layer**: Live NASA GIBS MUR-SST satellite heat tiles with floating temperature scale legend (26°C – 32°C).
  * **Real Satellite Chlorophyll Layer**: NASA GIBS MODIS Chlorophyll-a satellite tiles with plankton density scale legend (0.01 – 5.0 mg/m³).
  * **Hazard Buffer Circles**: Strictly offshore circular exclusion zones (25–55 km radii) representing cyclonic gale conditions, naval exercise zones, and submerged shoals.
  * **India EEZ Boundary**: 200-nautical-mile sovereign maritime boundary polygon.
  * **Click-to-Inspect**: Clicking any water point displays coordinates, depth estimate, SST, and wave height.

### Frames 03, 04, 05: Conversational AI Copilot (`/chat`)
* **Purpose**: Natural-language conversational interface answering questions about weather, fishing, routes, safety, and regulations.
* **Features**:
  * **Conversational Reasoning**: Replaced repetitive robotic blocks with a natural, friendly mariner assistant that addresses the captain by name (*"Captain Ramanath"*).
  * **User-Scoped Thread History**: All conversations are stored in `localStorage` under keys scoped to `user.id`. Switching users provides a fresh, clean workspace with zero data leakage.
  * **Cross-Tab Persistence**: Synchronous storage writes guarantee no messages are lost when switching to Maps or Profile and returning.
  * **Location-Grounded Queries**: General questions (*"can I sail today?"*, *"where to fish?"*) automatically evaluate the sea conditions of the user's registered home port.
  * **Rich Visual Telemetry Cards**:
    1. *Designated Safe House Card*: Shows refuge port name, GPS coordinates, distance in km and nautical miles, compass bearing (e.g., `273 km WSW`), with 1-click transit routing and map buttons.
    2. *Nearest Coastal Ports Card*: Ranks the 3 closest operational harbors with distances and directional headings.
    3. *Sailing Safety Assessment Card*: Instant GO / CAUTION / NO-GO evaluation based on wave swell, surface wind, and active cyclonic alerts.
    4. *Active Geographic Datum Card*: Details active basin coordinates, INCOIS sector code, and sea state.
  * **Dynamic Action Suggestion Chips**: 4 contextual 1-click follow-up chips generated dynamically for every response.
  * **Multi-Agent Pipeline Trace** (`AgentProcessingCard`): Displays live step-by-step progress of the 4 backend specialized agents: *Planner Agent*, *Weather Agent*, *PFZ Agent*, and *Risk Assessment Agent*.
  * **Voice Interface**: Real-time microphone speech recognition (STT) and synthesized voice playback (TTS).

### Frame 06: PFZ Exploration Page (`/pfz`)
* **Purpose**: Dedicated scientific dashboard for Potential Fishing Zones.
* **Features**:
  * Evaluates environmental indicators: SST gradient (fronts), chlorophyll bloom concentration, and ocean current speed.
  * Classifies fishing grounds into **BEST (High Pelagic Aggregation)**, **GOOD (Moderate Pelagic)**, and **POOR (Dispersed)** based on XGBoost model output.
  * Displays target species: Yellowfin Tuna, Skipjack, Indian Mackerel, Sardine, and Squid.
  * 1-click *"Navigate to Zone"* button sends coordinates directly to the route planner.

### Frame 07: Safety & Hazards View (`/hazards`)
* **Purpose**: Real-time maritime safety monitor and early warning center.
* **Features**:
  * Live integration with India's NDMA / SACHET disaster management alert system.
  * Displays active cyclonic depressions, storm surges, rough sea warnings, and high-wave alerts.
  * International Maritime Boundary Line (IMBL) proximity alarms to prevent accidental border crossings into Sri Lankan or Pakistani waters.
  * Emergency Coast Guard broadcast frequency directory (VHF Ch 16, MRCC contacts).

### Frame 08: Safe Route Planning (`/route`)
* **Purpose**: Autonomous nautical passage planner with obstacle avoidance.
* **Features**:
  * Anchors start point at the mariner's registered **Safe House** port and end point at the selected PFZ zone.
  * Calculates total nautical distance (nm), estimated transit time (hours at 8.5 knots cruising speed), and diesel fuel consumption (liters).
  * Automatically detects intersections with active hazard polygons and bends the route around obstacles using Turf.js waypoint insertion.

### Frame 09: Ocean Analytics Dashboard (`/analytics`)
* **Purpose**: Deep oceanographic trend exploration for commercial fishing operators and vessel masters.
* **Features**:
  * 7-day retrospective and 48-hour predictive charts for Sea Surface Temperature (°C).
  * Significant wave height and swell period trend lines.
  * Chlorophyll-a concentration heat maps showing seasonal upwelling patterns.
  * Diesel efficiency calculator comparing direct sailing vs current-assisted route sailing.

### Frame 10: Authority Fleet Dashboard (`/dashboard`)
* **Purpose**: Oversight portal for Coastal Marine Police, State Fisheries Departments, and the Indian Coast Guard.
* **Features**:
  * Monitored fleet tracker showing active registered fishing vessels in the sector.
  * Search and Rescue (SAR) alert queue showing SOS distress beacons with GPS coordinates.
  * Coastal fishing ban compliance monitoring (Monsoon Ban status).
  * Weather advisory broadcast tool to dispatch mass alerts to vessels at sea.

### Authentication & Registration (`/login`)
* **Active Session Management**: If a user is already logged in, displays an **Active Mariner Session** badge with their captain name, mobile, and safe house port, offering options to:
  * *Continue to Marine Workspace*
  * *Register as New Mariner (Fresh Profile)* (clears session and opens new registration)
  * *Sign In with Another Mobile* (clears session and opens clean OTP verification)
* **New Mariner Registration Tab**: One-click registration form capturing Captain Name, Mobile Number, Home Port / Safe House dropdown (25+ Indian coastal harbors), Language, and Vessel ID.

### Mariner & Vessel Profile (`/profile`)
* **Purpose**: Captain credentials and vessel operational parameters.
* **Features**:
  * Home Port / Safe House configuration: Updating this updates all maps and chatbot default locations immediately.
  * Vessel specifications: Engine power (HP), fuel tank capacity (L), hull type (Fiberglass / Wooden / Steel), and gear type (Gillnet / Trawler / Longline).
  * Government Aadhaar / Fisher Registration Number storage.
  * Preferred UI language toggle (English, Hindi, Kannada).

---

## 5. Complete Exhaustive Network Calls (GET, POST, PUT, SSE)

Below is the complete inventory of **every network request** executed by the frontend codebase.

### A. External Open-Access APIs (100% Free, Zero API Keys)

#### 1. Open-Meteo Marine Weather API
* **Endpoint**: `https://marine-api.open-meteo.com/v1/marine`
* **Method**: `GET`
* **Code Location**: `src/data/weather.js`
* **Query Parameters**:
  * `latitude`: Float (e.g. `12.914`)
  * `longitude`: Float (e.g. `74.856`)
  * `current`: `wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height`
  * `hourly`: `wave_height,wave_period`
  * `timezone`: `auto`
* **Sample Response**:
  ```json
  {
    "current": {
      "wave_height": 1.1,
      "wave_direction": 245,
      "wave_period": 7.5,
      "swell_wave_height": 0.8
    }
  }
  ```
* **Purpose**: Fetches live oceanographic wave swell, wave period, and swell direction for the monitored basin.
* **Fallback**: Pre-calculated seasonal coastal baselines if network is unavailable.

#### 2. Open-Meteo Atmospheric Forecast API
* **Endpoint**: `https://api.open-meteo.com/v1/forecast`
* **Method**: `GET`
* **Code Location**: `src/data/weather.js`
* **Query Parameters**:
  * `latitude`: Float
  * `longitude`: Float
  * `current`: `temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure`
  * `timezone`: `auto`
* **Sample Response**:
  ```json
  {
    "current": {
      "temperature_2m": 29.4,
      "wind_speed_10m": 14.2,
      "wind_direction_10m": 260,
      "wind_gusts_10m": 19.8,
      "surface_pressure": 1011.2
    }
  }
  ```
* **Purpose**: Fetches real-time surface wind speed, gusts, barometric pressure, and ambient temperature.
* **Fallback**: Sector-specific climatological averages.

#### 3. NASA GIBS WMTS Real SST Satellite Tiles
* **Endpoint**: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`
* **Method**: `GET` (Tile Image Request)
* **Code Location**: `src/components/maps/layers/SstLayer.jsx`
* **Parameters**: Standard Web Mercator tile coordinates (`z`, `y`, `x`) and UTC date string (`YYYY-MM-DD`).
* **Response**: 256x256 PNG raster tile showing real global sea surface temperature gradients.
* **Purpose**: Renders visual thermal fronts where cold upwellings meet warm waters (prime fish aggregation zones).

#### 4. NASA GIBS WMTS Real Chlorophyll-a Satellite Tiles
* **Endpoint**: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_Chlorophyll_A/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`
* **Method**: `GET` (Tile Image Request)
* **Code Location**: `src/components/maps/layers/ChlorophyllLayer.jsx`
* **Parameters**: Standard Web Mercator tile coordinates (`z`, `y`, `x`) and UTC date string (`YYYY-MM-DD`).
* **Response**: 256x256 PNG raster tile showing phytoplankton concentration density.
* **Purpose**: Visualizes biological ocean productivity where fish schools feed.

#### 5. OpenStreetMap Nominatim Geocoder & Reverse Geocoding
* **Endpoint**: `https://nominatim.openstreetmap.org/search` & `/reverse`
* **Method**: `GET`
* **Code Location**: `src/context/LocationContext.jsx` & `src/components/maps/MapsTopNav.jsx`
* **Headers**: `User-Agent: ORCA-Marine-Intelligence-SIH/2.0`
* **Query Parameters**:
  * `q`: Search string (e.g. `Kochi Harbour`, sanitized to remove stop words)
  * `lat`, `lon`: Coordinates for reverse lookup
  * `format`: `json`
  * `limit`: `5`
* **Sample Response**:
  ```json
  [
    {
      "place_id": 12345,
      "lat": "9.9312",
      "lon": "76.2673",
      "display_name": "Kochi, Ernakulam, Kerala, India"
    }
  ]
  ```
* **Purpose**: Enables search bar port lookup and converts map clicks into human-readable harbor names.
* **Sanitization**: Filters out words like *"where is my"*, *"save house"*, *"for me"* to prevent geocoding corruption.

#### 6. CartoDB Dark Matter Basemap Tiles
* **Endpoint**: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
* **Method**: `GET` (Tile Image Request)
* **Code Location**: `src/components/maps/MapComponent.jsx`
* **Purpose**: High-contrast, non-distracting maritime basemap optimized for night vision on ship wheelhouses.

#### 7. Local Static EEZ GeoJSON
* **Endpoint**: `/data/india_eez.geojson`
* **Method**: `GET`
* **Code Location**: `src/data/boundaries.js`
* **Response**: GeoJSON FeatureCollection defining India's 200-nautical-mile Exclusive Economic Zone polygon.

---

### B. Internal Microservice 1: PFZ Machine Learning API (`:8000`)
Base URL: `http://127.0.0.1:8000` (Powered by FastAPI, XGBoost, Scikit-Learn)

#### 1. Batch Coordinate Prediction & Telemetry Synthesis
* **Endpoint**: `POST /api/v1/predict/batch_coords`
* **Code Location**: `src/data/pfz.js`, `src/data/sst.js`, `src/data/chlorophyll.js`
* **Request Headers**: `Content-Type: application/json`
* **Request Payload**:
  ```json
  {
    "points": [
      { "latitude": 12.914, "longitude": 74.856 },
      { "latitude": 13.150, "longitude": 74.450 },
      { "latitude": 12.750, "longitude": 74.300 }
    ]
  }
  ```
* **Response Payload**:
  ```json
  {
    "count": 3,
    "predictions": [
      {
        "latitude": 12.914,
        "longitude": 74.856,
        "predicted_zone": "BEST",
        "probabilities": { "BEST": 0.842, "GOOD": 0.125, "POOR": 0.033 },
        "input_features": {
          "sst": 28.6,
          "chlorophyll": 1.45,
          "current_speed": 0.38,
          "salinity": 34.8
        }
      }
    ]
  }
  ```
* **Purpose**: Feeds coordinates to the pre-trained XGBoost model to generate live classified fishing zones with full oceanographic telemetry.

#### 2. Single Point Prediction
* **Endpoint**: `POST /api/v1/predict/single`
* **Code Location**: `src/services/pfz.js`
* **Request Payload**: Single latitude/longitude object with optional environmental overrides.
* **Purpose**: Real-time zone evaluation when inspecting a specific waypoint on the map.

---

### C. Internal Microservice 2: Auth & Mariner Profile SQLite API (`:8001`)
Base URL: `http://127.0.0.1:8001` (Powered by FastAPI, SQLite, zero external database requirement)

#### 1. Request OTP for Mobile Login
* **Endpoint**: `POST /api/v1/auth/request-otp`
* **Code Location**: `src/context/AuthContext.jsx` & `src/services/auth.js`
* **Request Payload**:
  ```json
  {
    "phone": "+9177003955505"
  }
  ```
* **Response Payload**:
  ```json
  {
    "status": "otp_sent",
    "phone": "+9177003955505",
    "dev_otp": "654321",
    "expires_in": 300
  }
  ```
* **Purpose**: Generates a 6-digit OTP stored in SQLite. For local dev and hackathon demonstrations, returns `dev_otp` for instantaneous one-click sign-in without SMS gateway delays.

#### 2. Verify OTP & Authenticate Session
* **Endpoint**: `POST /api/v1/auth/verify-otp`
* **Code Location**: `src/context/AuthContext.jsx`
* **Request Payload**:
  ```json
  {
    "phone": "+9177003955505",
    "otp": "654321"
  }
  ```
* **Response Payload**:
  ```json
  {
    "status": "authenticated",
    "session_token": "orca_sess_a8f92b7c4e1...",
    "user": {
      "id": "mariner-101",
      "name": "Captain Rishit Kapoor",
      "phone": "+9177003955505",
      "safe_house": {
        "key": "paradip",
        "label": "Paradip Marine Basin",
        "lat": 20.264,
        "lon": 86.672,
        "sector": "Sector 17 — Odisha Coast"
      },
      "preferred_language": "en"
    }
  }
  ```
* **Purpose**: Authenticates the mariner and establishes the user session.

#### 3. Fetch User Profile
* **Endpoint**: `GET /api/v1/profile`
* **Code Location**: `src/context/AuthContext.jsx`
* **Headers**: `Authorization: Bearer <session_token>`
* **Response**: Complete mariner record including vessel specifications, safe house port, and language preference.

#### 4. Update User Profile & Safe House
* **Endpoint**: `PUT /api/v1/profile`
* **Code Location**: `src/context/AuthContext.jsx` & `src/components/profile/ProfilePage.jsx`
* **Request Payload**:
  ```json
  {
    "name": "Captain Rishit Kapoor",
    "safe_house": {
      "key": "kochi",
      "label": "Kochi Harbour Waters",
      "lat": 9.9312,
      "lon": 76.2673,
      "sector": "Sector 08 — Central Kerala"
    },
    "vessel_name": "Matsya 3",
    "vessel_type": "Mechanized Trawler (32ft)",
    "preferred_language": "kn"
  }
  ```
* **Response**: `{ "status": "updated", "user": { ... } }`
* **Purpose**: Persists profile modifications to SQLite. Synchronously updates `LocationContext` and `ChatPage` locations.

#### 5. Session Logout
* **Endpoint**: `POST /api/v1/auth/logout`
* **Code Location**: `src/context/AuthContext.jsx`
* **Purpose**: Invalidates server-side session tokens and clears cookies.

---

### D. Multi-Agent Reasoning SSE Stream (`:8000/api/v1/chat`)
* **Endpoint**: `POST /api/v1/chat` (Server-Sent Events)
* **Code Location**: `src/services/chat.js`
* **Request Payload**:
  ```json
  {
    "query": "Is it safe to sail from Kochi today?",
    "thread_id": "thread-2026-09-08",
    "location": { "lat": 9.9312, "lon": 76.2673, "name": "Kochi" },
    "language": "en"
  }
  ```
* **Streaming Event Flow**:
  1. `event: status` -> `{"agent": "planner", "status": "Decomposing query..."}`
  2. `event: status` -> `{"agent": "weather", "status": "Fetching Open-Meteo swell data..."}`
  3. `event: status` -> `{"agent": "pfz", "status": "Querying XGBoost zone model..."}`
  4. `event: status` -> `{"agent": "risk", "status": "Evaluating Beaufort scale risk..."}`
  5. `event: text_chunk` -> `{"text": "Sea state is favorable with 1.1m wave swell..."}`
  6. `event: verdict` -> `{"verdict": "GO", "confidence": 0.94}`
  7. `event: done` -> `{"finished": true}`

---

## 6. State Management & Context Architecture

### 1. `AuthContext.jsx`
* **State Managed**:
  * `user`: Current mariner object (`id`, `name`, `phone`, `safe_house`, `preferred_language`, `vessel_name`).
  * `sessionToken`: Active session string.
  * `isAuthenticated`: Boolean flag.
  * `safeHouse`: Shortcut object for the mariner's designated haven.
* **Key Functions**:
  * `loginWithOtp(phone, otp)`: Calls `:8001` or fallback local authenticator.
  * `registerNewUser({ name, phone, safe_house, preferred_language, aadhaar })`: Creates a fresh mariner record with a unique ID (`mariner-${Date.now()}`), sets home port coordinates, and immediately navigates to workspace.
  * `updateProfile(fields)`: Synchronously updates user record in SQLite and local storage.
  * `logout()`: Clears session, resets active user state, and re-routes to `/login`.
* **Zero-Failure Offline Fallback**: If the `:8001` Python backend is offline, `AuthContext` falls back gracefully to client-side localStorage simulation so the app never crashes.

### 2. `LocationContext.jsx`
* **State Managed**:
  * `currentLocation`: Active monitored basin object (`name`, `lat`, `lon`, `region`, `sector`, `key`).
  * `knownLocations`: Array of 25+ curated Indian coastal ports.
* **Profile Synchronization**:
  * Connected directly to `useAuth()`. Whenever an authenticated user with a registered `safe_house` logs in, `LocationContext` automatically aligns `currentLocation` to their home harbor (e.g., Paradip, Kochi, Vizag) instead of falling back to Mangalore.
* **Sanitized Nominatim Geocoding**:
  * Strips conversational words (*"me"*, *"save house"*, *"for me"*) before querying OpenStreetMap to eliminate corrupted place names.
* **25+ Known Coastal Ports**: Pre-calibrated coordinates for Mangalore, Kochi, Kannur, Kozhikode, Mumbai, Ratnagiri, Goa, Chennai, Tuticorin, Visakhapatnam, Paradip, Haldia, Port Blair, etc.

---

## 7. The Intelligent Marine AI Engine (`marineChatEngine.js`)

The engine is built on deterministic nautical reasoning combined with dynamic maritime calculations.

### A. Mathematical Algorithms
1. **Haversine Nautical Distance Formula**:
   $$\Delta\sigma = 2 \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)} \right)$$
   $$d = R \cdot \Delta\sigma \quad (\text{where } R = 6371 \text{ km or } 3440.065 \text{ nautical miles})$$
2. **16-Point Compass Bearing Formula**:
   $$\theta = \text{atan2}\left(\sin(\Delta\lambda)\cos(\phi_2), \cos(\phi_1)\sin(\phi_2) - \sin(\phi_1)\cos(\phi_2)\cos(\Delta\lambda)\right)$$
   Converts radian angle into 16 cardinal compass points: `N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW`.

### B. 19 Intent Classifications

| # | Intent Name | Trigger Keywords / Patterns | Output Generated |
| :---: | :--- | :--- | :--- |
| **1** | `safe_house` | "safe house", "save house", "refuge", "haven", "shelter" | Designated Safe House Card with GPS, distance, bearing, 1-click transit route button |
| **2** | `nearest_port` | "nearest port", "closest harbour", "nearby dock", "ports near me" | Nearest Coastal Ports Card ranking top 3 harbors by distance & bearing |
| **3** | `safety_check` | "can i sail", "safe to go", "go out to sea", "is it safe today" | Sailing Safety Assessment Card with GO/CAUTION/NO-GO verdict and wave/wind gauges |
| **4** | `region_info` | "my region", "my area", "where am i", "current sector" | Active Maritime Geographic Datum Card with coordinates and INCOIS sector |
| **5** | `vessel_info` | "my vessel", "my boat", "vessel status", "trawler info" | Vessel profile summary (cruising speed, hull type, fuel autonomy) |
| **6** | `diesel_savings` | "fuel", "diesel", "save fuel", "consumption", "mileage" | Hydrodynamic fuel optimization guidelines (RPM reduction, hull trim, current riding) |
| **7** | `radio_protocol`| "vhf", "channel 16", "radio", "mayday", "pan pan", "sos" | Official Marine VHF Channel 16 distress call script and emergency frequencies |
| **8** | `monsoon_ban` | "ban", "monsoon ban", "trawling ban", "closed season" | Uniform fishing ban dates: East Coast (Apr 15–Jun 14), West Coast (Jun 1–Jul 31) |
| **9** | `pfz` | "fish", "pfz", "tuna", "mackerel", "catch", "fishing zone" | Top predicted fishing grounds with distance, depth, SST, and target species |
| **10**| `route` | "route", "passage", "navigation", "plot", "course", "waypoint" | Safe passage waypoint guidance avoiding shoals and hazards |
| **11**| `weather` | "weather", "wind", "wave", "swell", "sea state", "cyclone" | Live marine weather report card with Beaufort scale and swell period |
| **12**| `hazards` | "hazard", "reef", "danger", "cyclone warning", "sachet" | Active navigational hazards and cyclone exclusion zones report |
| **13**| `analytics` | "analytics", "temperature trend", "chlorophyll level", "sst" | Oceanographic telemetry summary with historical anomaly markers |
| **14**| `regulations` | "license", "permit", "mesh size", "cricket ban", "fisheries act" | Indian Marine Fisheries Regulation Act (MFRA) legal guidelines |
| **15**| `gear_advice` | "gear", "mesh", "hooks", "trolling line", "gillnet" | Technical gear recommendations tailored to tuna, seer fish, and mackerel |
| **16**| `first_aid` | "first aid", "drowning", "hypothermia", "sting", "injury" | Emergency maritime medical response protocols at sea |
| **17**| `market_rates` | "market", "price", "landing center", "auction rate" | Coastal fish landing center price estimation guidance |
| **18**| `greeting` | "hello", "hi", "namaste", "vanakkam", "namaskara" | Warm, personalized greeting with vessel and basin details |
| **19**| `general` | *Any conversational query* | Contextual, dynamic operational overview of the active basin |

---

## 8. Geospatial & Map Engine (Leaflet + Turf.js)

### Leaflet Layer Architecture
1. **Base Tile Layer**: Dark Matter CartoDB tiles (`z-index: 1`).
2. **NASA Satellite WMTS Raster Layers**: SST (`GHRSST_L4_MUR`) and Chlorophyll (`MODIS_Aqua`) with opacity sliders (`z-index: 2`).
3. **EEZ Polygon Layer**: Stroke `#38BDF8` with dashed boundary line (`z-index: 3`).
4. **Hazard Circle Buffers**: Red/Orange translucent polygons (`#EF4444`, `#F97316`) representing 25–55 km storm radii (`z-index: 4`).
5. **Safe Route Polyline**: Neon emerald line (`#10B981`) with animated dashed direction pulses (`z-index: 5`).
6. **Marker Pin Layer**:
   * **Safe House**: Solid Violet Pin (`#8B5CF6`) with harbor anchor icon.
   * **Vessel (You)**: Solid Amber Pin (`#FBBF24`) with mariner boat icon.
   * **PFZ Zones**: Emerald target markers with confidence badges.

### Turf.js Hazard Avoidance Algorithm
1. Draws direct great-circle line between `Safe House` and target `PFZ`.
2. Evaluates line intersection against all active `hazard.polygon` geometries using `turf.lineIntersect`.
3. If an intersection occurs within an exclusion radius:
   * Computes the tangential tangent vector around the obstacle circle perimeter.
   * Inserts 2 intermediate safe waypoints outside the hazard buffer (+5 km clearance).
   * Generates a collision-free multi-segment polyline.

---

## 9. Multilingual i18n & Voice Speech System

### Internationalization Architecture (`i18next`)
* Languages supported:
  * **English (`en`)**: International maritime standard.
  * **Hindi (`hi`)**: Northern and Central coastal regions.
  * **Kannada (`kn`)**: Karnataka coastal fisheries (Mangalore, Malpe, Karwar).
* Switching is 100% instantaneous on the client side without page reload via `i18n.changeLanguage(lang)`.
* Persistent: User's choice is saved in `localStorage.getItem('i18nextLng')` and synced to the user profile in SQLite.

### Voice Speech-to-Text (STT)
* Utilizes browser-native `window.webkitSpeechRecognition` or `window.SpeechRecognition`.
* Dynamically sets recognition dialect based on active language:
  * English: `en-IN`
  * Hindi: `hi-IN`
  * Kannada: `kn-IN`
* Continuous listening with auto-silence cutoff.

### Voice Text-to-Speech (TTS)
* Utilizes browser-native `window.speechSynthesis`.
* Filters available system voice synthesizers for Indian dialects (`hi-IN`, `kn-IN`, `en-IN`).
* Pitch, rate, and volume optimized for clarity over noisy vessel marine engines.

---

## 10. Data Honesty & Free-Data Architecture

A cornerstone of ORCA is the **100% Free Data Rule**:
* **No Google Maps API Key**: Powered entirely by OpenStreetMap and CartoDB.
* **No Weather API Bills**: Powered entirely by Open-Meteo's open-access European weather center models.
* **No Commercial Satellite Subscriptions**: Powered entirely by NASA GIBS open public WMTS satellite endpoints.
* **Zero Database Hosting Costs**: Uses lightweight, self-contained SQLite on the edge/local machine.
* **Offline Resilience**: All critical coastal port data, emergency procedures, and baseline weather maps function offline even when vessels sail beyond 4G cellular range (12–15 nautical miles offshore).

---

## 11. Viva, Evaluation & Hackathon Q&A Defense

Here are the exact questions evaluators, judges, or examiners ask, and the winning answers you should give:

### Q1: "What happens when the boat loses 4G internet connection offshore?"
> **Answer**: *"ORCA is designed with an offline-first architecture. Before leaving the harbor, the mariner's safe route, offline tile cache, and pre-computed PFZ coordinates are stored locally in the browser's `localStorage` and Service Worker cache. The distance math, 16-point compass bearings, and navigational calculations run client-side using Turf.js and Haversine algorithms without requiring an active internet connection."*

### Q2: "Where does your Sea Surface Temperature (SST) and Chlorophyll data come from?"
> **Answer**: *"We connect directly to NASA's GIBS (Global Imagery Browse Services) open WMTS tile service using the GHRSST Level 4 MUR (Multi-scale Ultra-high Resolution) Sea Surface Temperature dataset and the MODIS Aqua Chlorophyll-a satellite feeds. In parallel, our FastAPI Python service (`services/pfz-api`) uses an XGBoost machine learning model trained on historical oceanographic datasets to predict pelagic fish aggregation zones."*

### Q3: "How does the chatbot understand local fishermen who speak regional languages?"
> **Answer**: *"We implemented a dual-layer accessibility system. First, our UI uses `react-i18next` with full translation dictionaries in English, Hindi, and Kannada. Second, we integrate the Web Speech API configured to regional dialect codes (`kn-IN` for Kannada, `hi-IN` for Hindi). This allows fishermen to speak questions naturally into their phone microphone and hear synthesized audio replies spoken back to them."*

### Q4: "Why do you have both a 'Safe House' and a 'You' marker on the map?"
> **Answer**: *"A critical maritime safety rule is separating the vessel's live location from its home refuge haven. The 'Safe House' marker (solid violet pin `#8B5CF6`) is permanently anchored to the mariner's registered home port in their profile (e.g. Paradip or Kochi). The 'You' marker (amber pin `#FBBF24`) represents where the boat currently is at sea. This allows our algorithm to always draw a safe return polyline from the boat's location back to their designated haven without relying on inaccurate device GPS inland."*

### Q5: "How does your route planner avoid hazards like storms or shallow reefs?"
> **Answer**: *"We use computational geometry powered by Turf.js. We represent coastal hazards, cyclonic gale zones, and shallow reefs as geospatial polygon buffers. When plotting a route from the Safe House to a PFZ, our algorithm runs `turf.lineIntersect`. If a direct line cuts through a hazard, it calculates tangent avoidance waypoints around the hazard perimeter, generating an obstacle-free route with estimated diesel consumption and transit time."*

### Q6: "What backend architecture connects to this frontend?"
> **Answer**: *"The frontend communicates with three modular endpoints:  
> 1. `services/pfz-api` (Port 8000): FastAPI service executing our pre-trained XGBoost ML model for PFZ predictions.  
> 2. `services/auth-api` (Port 8001): Lightweight SQLite identity service handling mobile OTP and profile persistence.  
> 3. LangGraph Multi-Agent Orchestrator: An SSE (Server-Sent Events) pipeline dispatching specialized agents (Planner, Weather, PFZ, Risk) to stream step-by-step reasoning into the chat workspace."*
