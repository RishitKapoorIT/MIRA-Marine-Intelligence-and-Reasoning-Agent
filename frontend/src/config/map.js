// Map tile provider — swap this one constant to change the entire tile source
// Current: OpenStreetMap standard tiles (free, no key, no billing)
// Alternative: 'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.png' (also free)
export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

// Default view: Indian coastline, zoom 5
export const INDIA_CENTER = [15.5, 80.0];
export const INDIA_ZOOM = 5;

// FR-H4: GPS unavailable → fall back to Mangalore as the base location
export const MANGALORE_FALLBACK = [12.8698, 74.8431];

// Preset centres for each water body (left sidebar clickable rows)
export const WATER_BODIES = {
  arabianSea:   { label: 'Arabian Sea',   center: [14.0, 68.0], zoom: 5, color: '#3B82F6' },
  bayOfBengal:  { label: 'Bay of Bengal', center: [14.0, 85.0], zoom: 5, color: '#8B5CF6' },
  laccadiveSea: { label: 'Laccadive Sea', center: [9.0,  74.0], zoom: 6, color: '#10B981' },
  gulfOfMannar:{ label: 'Gulf of Mannar', center: [8.5,  79.0], zoom: 7, color: '#F59E0B' },
};

// Open-Meteo endpoints (free, keyless, CORS-open)
export const OPEN_METEO_MARINE_URL   = 'https://marine-api.open-meteo.com/v1/marine';
export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Nominatim geocoding (free, no key — must send a descriptive User-Agent)
export const NOMINATIM_URL    = 'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_UA     = 'ORCA-Marine-App/1.0 (contact: orca-demo@sih.local)';

// NDMA SACHET CAP feed routed through allorigins.win to bypass browser CORS restrictions
export const SACHET_PROXY_URL =
  'https://api.allorigins.win/get?url=' +
  encodeURIComponent('https://sachet.ndma.gov.in/cap_public_website/FeedService');
