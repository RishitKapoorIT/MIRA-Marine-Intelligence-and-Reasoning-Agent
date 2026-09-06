/**
 * Coastal Authority Fleet Telemetry Adapter (Frame 10 / US-13, US-14).
 *
 * NOTE (FR-C6 & Safety Principle): Complete live satellite AIS vessel tracking requires
 * high-cost enterprise feeds (Spire / AISHub auth). This dataset provides a high-fidelity
 * simulated fleet registry and regional telemetry stream for regional authority testing,
 * designed for seamless drop-in replacement once a confirmed free stream is connected.
 */

export const FLEET_METRICS = {
  activeFleetCount: 142,
  emergencyBeaconsActive: 1,
  issuedWeatherWarnings: 3,
  fleetComplianceRate: 96.4,
  isSimulated: true,
  lastTelemetrySync: 'Just now · Indian Coastal Authority Node 04',
};

export const SAMPLE_VESSELS = [
  {
    id: 'IND-KA-0492',
    name: 'Matsya Ratna IV',
    type: 'Deep Sea Trawler (38ft)',
    homePort: 'Mangalore Old Port',
    lat: 12.824,
    lon: 74.450,
    speedKnots: 8.4,
    headingDeg: 275,
    status: 'NORMAL',
    lastContact: '2m ago',
    crewCount: 8,
  },
  {
    id: 'IND-KA-1102',
    name: 'Sagar Kanya III',
    type: 'Purse Seiner (44ft)',
    homePort: 'Malpe Harbor',
    lat: 13.310,
    lon: 74.315,
    speedKnots: 11.2,
    headingDeg: 240,
    status: 'NORMAL',
    lastContact: '5m ago',
    crewCount: 14,
  },
  {
    id: 'IND-KL-0881',
    name: 'Coastal Dolphin',
    type: 'Gillnetter (32ft)',
    homePort: 'Kannur Bunder',
    lat: 12.215,
    lon: 74.650,
    speedKnots: 1.2,
    headingDeg: 185,
    status: 'DISTRESS_SOS',
    lastContact: '1m ago',
    crewCount: 5,
    alertDetails: 'Emergency EPIRB distress beacon transmitted. Coast Guard ICGS Rajdoot dispatched.',
  },
  {
    id: 'IND-GA-0319',
    name: 'Varuna Star',
    type: 'Multi-day Trawler (42ft)',
    homePort: 'Mormugao Port',
    lat: 14.620,
    lon: 73.380,
    speedKnots: 9.8,
    headingDeg: 195,
    status: 'GEOFENCE_ALERT',
    lastContact: '7m ago',
    crewCount: 10,
    alertDetails: 'Vessel nearing Naval gunnery practice perimeter border (1.8nm to boundary).',
  },
  {
    id: 'IND-KA-0955',
    name: 'Jalashree II',
    type: 'Motorized Artisanal (28ft)',
    homePort: 'Mangalore Port',
    lat: 12.940,
    lon: 74.720,
    speedKnots: 6.5,
    headingDeg: 280,
    status: 'NORMAL',
    lastContact: '11m ago',
    crewCount: 4,
  },
  {
    id: 'IND-ICG-804',
    name: 'ICGS Amrit Kaur',
    type: 'Fast Patrol Vessel',
    homePort: 'New Mangalore Coast Guard Base',
    lat: 12.780,
    lon: 74.200,
    speedKnots: 19.5,
    headingDeg: 310,
    status: 'NORMAL',
    lastContact: 'Just now',
    crewCount: 22,
  },
];

export const REGIONAL_ACTIVITY_FEED = [
  {
    id: 'evt-001',
    timestamp: '17:02 IST',
    type: 'ALERT',
    badge: 'DISTRESS SOS',
    color: 'red',
    text: 'IND-KL-0881 (Coastal Dolphin) triggered 406 MHz beacon at 12.215°N, 74.650°E.',
  },
  {
    id: 'evt-002',
    timestamp: '16:48 IST',
    type: 'WARNING',
    badge: 'GEOFENCE',
    color: 'amber',
    text: 'IND-GA-0319 crossed 2nm buffer zone near Karwar Naval Restricted sector.',
  },
  {
    id: 'evt-003',
    timestamp: '16:30 IST',
    type: 'INFO',
    badge: 'WEATHER',
    color: 'blue',
    text: 'IMD High Wave Bulletin #08 broadcast to 84 registered fleet transponders.',
  },
  {
    id: 'evt-004',
    timestamp: '16:15 IST',
    type: 'SUCCESS',
    badge: 'PORT RETURN',
    color: 'emerald',
    text: 'IND-KA-0128 (Sea Pride) safely docked at Malpe Fisheries Wharf with 4.2T catch.',
  },
  {
    id: 'evt-005',
    timestamp: '15:52 IST',
    type: 'INFO',
    badge: 'PFZ ADVISORY',
    color: 'teal',
    text: 'ORCA PFZ Batch #2024-06 generated for Mangalore Coastal Sector.',
  },
];

export const DISTRICT_COMPLIANCE = [
  { district: 'Dakshina Kannada (Mangalore)', rate: 98.2, fleetActive: 54, status: 'EXCELLENT' },
  { district: 'Udupi (Malpe / Gangolli)', rate: 94.6, fleetActive: 46, status: 'GOOD' },
  { district: 'Uttara Kannada (Karwar / Tadadi)', rate: 97.1, fleetActive: 28, status: 'EXCELLENT' },
  { district: 'South Goa (Mormugao / Betul)', rate: 95.8, fleetActive: 14, status: 'GOOD' },
];

export async function getVesselsData() {
  return {
    metrics: FLEET_METRICS,
    vessels: SAMPLE_VESSELS,
    activityFeed: REGIONAL_ACTIVITY_FEED,
    districtCompliance: DISTRICT_COMPLIANCE,
    isSampleData: true,
  };
}
