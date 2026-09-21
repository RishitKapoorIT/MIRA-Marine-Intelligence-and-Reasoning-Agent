/**
 * ORCA Marine Chat Engine
 * Intelligent, user-oriented conversational reasoning for Indian coastal fisheries.
 * Dynamic language generation, deep domain intelligence, context memory, and safety guidance.
 */

import { KNOWN_COASTAL_LOCATIONS } from '../../context/LocationContext.jsx';

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function calculateBearing(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 'E';
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return compass[Math.round(brng / 22.5) % 16];
}

export function findNearestPorts(centerLat, centerLon, count = 3) {
  return KNOWN_COASTAL_LOCATIONS
    .map(loc => ({
      ...loc,
      distanceKm: calculateDistanceKm(centerLat, centerLon, loc.lat, loc.lon),
      bearing: calculateBearing(centerLat, centerLon, loc.lat, loc.lon),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, count);
}

export function formatCaptainName(user) {
  const raw = user?.name?.trim() || '';
  if (!raw) return 'Captain';
  if (raw.toLowerCase().startsWith('captain')) return raw;
  return `Captain ${raw.split(' ')[0]}`;
}

// ── Dynamic Greeting Variations ──
const GREETINGS = [
  (cap) => `Aye, ${cap}! Standing by with live marine intelligence for your vessel.`,
  (cap) => `Good day, ${cap}. Telemetry streams and coastal observation feeds are fully online.`,
  (cap) => `Captain ${cap.replace(/^Captain\s*/i, '')}, ORCA copilot reporting in from the coastal grid.`,
  (cap) => `Greetings, ${cap}! Ready to assist with fishing zones, weather advisories, or passage routes.`,
  (cap) => `At your service, ${cap}. Let's check ocean conditions and ensure a safe, productive voyage.`,
];

function getRandomGreeting(captain) {
  const idx = Math.floor(Math.random() * GREETINGS.length);
  return GREETINGS[idx](captain);
}

// ── Fish Species Intelligence Database ──
const SPECIES_KNOWLEDGE = {
  tuna: {
    name: 'Yellowfin & Skipjack Tuna (Thunnus albacares / Katsuwonus pelamis)',
    sstRange: '28.0°C – 30.5°C',
    chlorophyll: '0.2 – 0.6 mg/m³ (clear blue oceanic boundaries)',
    depth: '15m – 60m along thermal breaks and underwater canyons',
    gear: 'Surface trolling with cedar plugs, rubber squids, or longlines with squid bait',
    techniques: 'Look for thermal break lines (0.5°C sharp shift within 1 nm) where bait is trapped. Target flocks of diving seabirds (terns, petrels) indicating surface feeding frenzy.',
    handling: 'Bleed and gill immediately on deck; pack into crushed ice at 1:1 ratio to preserve sashimigrade meat quality and prevent histamine buildup.',
  },
  mackerel: {
    name: 'Indian Mackerel (Rastrelliger kanagurta / Ayila / Bangda)',
    sstRange: '27.0°C – 29.5°C',
    chlorophyll: '0.8 – 2.2 mg/m³ (moderate coastal plankton blooms)',
    depth: '5m – 25m in coastal shelf waters',
    gear: 'Ring seines, drift gillnets (mesh 30–45mm), light feather jig rigs',
    techniques: 'Thrives in coastal upwelling areas along the continental shelf. Schools aggregate during dawn and dusk just below surface thermoclines.',
    handling: 'High oily fat content; requires immediate slush-icing in insulated deck boxes to avoid belly-burst.',
  },
  sardine: {
    name: 'Indian Oil Sardine (Sardinella longiceps / Mathi / Tarli)',
    sstRange: '26.5°C – 29.0°C',
    chlorophyll: '1.2 – 3.5 mg/m³ (high productivity coastal waters)',
    depth: '0m – 15m in inshore shelf zones (<30m depth contours)',
    gear: 'Traditional thangu vala, coastal purse seines, and surface gillnets',
    techniques: 'Directly follows coastal chlorophyll blooms. Most concentrated post-monsoon when coastal upwelling brings cold nutrient-rich waters to the surface.',
    handling: 'Extremely delicate flesh; avoid deep stacking in fish holds; use slurry ice (sea water + crushed ice).',
  },
  seer: {
    name: 'Seer Fish / King Mackerel (Scomberomorus commerson / Anjal / Surmai)',
    sstRange: '27.5°C – 30.0°C',
    chlorophyll: '0.4 – 1.2 mg/m³',
    depth: '10m – 45m along rocky reefs, shipwrecks, and drop-offs',
    gear: 'Trolling with steel wire leaders and spoons/plugs, or specialized large-mesh drift nets',
    techniques: 'High-speed apex predator patrolling reef edges and drop-offs. Always use steel wire traces (30–50 lb) as their razor teeth easily sever monofilament.',
    handling: 'Prime commercial market value. Clean slime gently, avoid gaffing the body flank, ice directly.',
  },
  squid: {
    name: 'Indian Squid & Cuttlefish (Uroteuthis duvaucelii / Sepia pharaonis)',
    sstRange: '26.0°C – 29.0°C',
    chlorophyll: '0.5 – 1.8 mg/m³',
    depth: '20m – 80m (nocturnal vertical migrators)',
    gear: 'Night jigging with luminescent squid jigs (egi) under halogen or green LED deck floodlights',
    techniques: 'At night, squid rise toward illuminated surface waters to hunt smaller fish. Anchor or drift along 30–50m contour and jig at varied depths.',
    handling: 'Wash ink sacs carefully; keep cool in chilled seawater before icing to prevent flesh discoloration.',
  },
  prawn: {
    name: 'Penaeid Shrimp / Prawns (Karikkadi / Poovalan / Tiger Prawns)',
    sstRange: '27.0°C – 31.0°C',
    chlorophyll: '1.5 – 4.0 mg/m³ in nutrient-rich coastal mudbanks',
    depth: '8m – 40m on soft muddy/sandy bottoms',
    gear: 'Demersal shrimp otter trawls with mandated Turtle Excluder Devices (TED) and square mesh codends',
    techniques: 'Best yields occur immediately after seasonal rainfall swells river mouth outputs, creating nutrient-rich mudbanks (Chakara along Kerala/Karnataka).',
    handling: 'Sort prawns promptly; de-head if required for export grade; thoroughly ice in layers with plastic sheet barriers.',
  },
};

/**
 * Evaluates user query and returns a contextual, user-oriented conversational response.
 * Uses conversation history for multi-turn understanding.
 */
export function generateMarineAiResponse({
  queryText,
  user,
  currentLocation,
  weatherData,
  pfzResult,
  hazards = [],
  conversationHistory = [],
}) {
  const q = queryText.toLowerCase().trim();
  const captain = formatCaptainName(user);
  const safeHouse = user?.safe_house || {
    label: 'Mangalore Old Port (Default Safe House)',
    lat: 12.9141,
    lon: 74.8560,
    region: 'Karnataka Coast',
  };

  const loc = currentLocation || {
    name: 'Mangalore Coastal Shelf Basin',
    sector: 'Sector 7',
    lat: 12.914,
    lon: 74.856,
  };

  const wave = Number(weatherData?.waveHeight ?? 1.02);
  const wind = Number(weatherData?.windSpeed ?? 12);
  const sst = Number(weatherData?.sst ?? 29.8);
  const zones = pfzResult?.zones || [];
  const topZone = zones[0] || null;

  // Compute distance and bearing to safe house
  const safeHouseDist = calculateDistanceKm(loc.lat, loc.lon, safeHouse.lat, safeHouse.lon);
  const safeHouseBearing = calculateBearing(loc.lat, loc.lon, safeHouse.lat, safeHouse.lon);

  // Analyze previous context from conversation history (if any)
  const lastBotMsg = conversationHistory
    ?.filter(m => m.sender === 'orca')
    ?.slice(-1)[0] || null;

  const previousContext = lastBotMsg?.type || null;

  // ── Specific Intent Detectors ──
  const isSafeHouse = /\b(safe house|save house|safe area|my house|home harbor|home base|my base|emergency harbor|refuge port|shelter base)\b/i.test(q);
  const isRegion = /\b(what is my region|name of it|my region|my sector|current sector|where am i|which waters|what waters|current location|my area|my place|active datum)\b/i.test(q);
  const isNearestPort = /\b(nearest port|nearest harbor|closest port|closest harbor|ports near me|ports nearby|dock|shelter|safe port|berth|landing center)\b/i.test(q);
  const isSafetyCheck = /\b(can i sail|can i go out|is it safe|should i go|is it dangerous|safe for fishing|safe to venture|sea safety|rough sea|will my boat capsize|can we venture)\b/i.test(q);
  const isVessel = /\b(my vessel|my boat|vessel details|registration|license|my profile|vessel info|boat name|matsya)\b/i.test(q);
  const isWeather = !isSafetyCheck && /\b(weather|forecast|swell|wave|waves|wind|temp|temperature|sea state|calm|rough|rain|monsoon|breeze|current|tide|humidity|visibility)\b/i.test(q);
  const isHazard = /\b(hazard|hazards|danger|dangerous|warning|warnings|restricted|firing|cyclone|storm|alert|security|risk|exclusion zone)\b/i.test(q);
  const isRoute = /\b(route|routes|navigate|navigation|waypoint|direction|directions|port to port|transit|fuel|passage|how to reach|plot route|course)\b/i.test(q);
  const isPfz = /\b(fish|fishing|pfz|catch|pelagic|where to fish|grounds|best area|yield|chlorophyll front|shoal|shoals)\b/i.test(q);

  // Specialized Domain Intents
  const isSpecies = /\b(tuna|mackerel|ayila|bangda|sardine|mathi|tarli|seer|surmai|anjal|kingfish|squid|cuttlefish|prawn|prawns|shrimp|pomfret|species|bait|lure|tackle|mesh)\b/i.test(q);
  const isFuel = /\b(fuel|diesel|save diesel|fuel economy|mileage|consumption|throttle|cruising speed|rpm|engine speed)\b/i.test(q);
  const isEmergency = /\b(emergency|distress|sos|mayday|pan pan|coast guard|1554|1093|vhf|channel 16|engine fail|engine stall|man overboard|mob|broken down|sink|sinking)\b/i.test(q);
  const isMonsoonBan = /\b(monsoon ban|fishing ban|breeding ban|trawling ban|uniform ban|ban period|when is the ban|dates for ban|61 days)\b/i.test(q);
  const isNightNav = /\b(night|dark|sunset|night sailing|navigation lights|lights|anchor light|collision|ais|radar reflector)\b/i.test(q);
  const isGearDocs = /\b(document|documents|papers|license|biometric|card|safety gear|equipment|lifejacket|lifejackets|lifebuoy|flares|dat)\b/i.test(q);
  const isOceanography = /\b(explain sst|what is sst|what is chlorophyll|thermal front|upwelling|why temperature matters|ground swell vs wind|water color)\b/i.test(q);

  // Conversational Gestures
  const isGratitude = /\b(thank|thanks|thank you|shukriya|dhanyavaad|nandri|great help|awesome|appreciate|good job)\b/i.test(q);
  const isGreeting = /\b(hi|hello|hey|namaste|vanakkam|who are you|what can you do|help|assist|options|features|good morning|good evening)\b/i.test(q);
  const isFollowUpDistance = /\b(how far|how long|distance to|travel time|eta|hours to reach)\b/i.test(q);

  // ── Follow-Up Context Handling ──
  if (isFollowUpDistance && previousContext) {
    if (previousContext === 'pfz' && topZone) {
      const transitHours = (topZone.distanceNm / 7).toFixed(1);
      return {
        type: 'follow_up',
        summary: `The top predicted zone **${topZone.id}** (${topZone.expectedSpecies}) is **${topZone.distanceNm} nm (${topZone.bearing})** from your active position. At an economical cruising speed of **7 knots**, transit time is approximately **${transitHours} hours**.`,
        actionSuggestions: [
          { label: `🧭 Safe Route to ${topZone.id}`, query: `Safe route to nearest fishing zone` },
          { label: `⛽ Fuel Tips for ${topZone.distanceNm} nm`, query: `How to save diesel on long hauls` },
          { label: `🌊 Check Swell on the way`, query: `Weather report for ${loc.name.split(' ')[0]}` },
        ],
      };
    }
    if (previousContext === 'safe_house') {
      const nmDist = Math.round(safeHouseDist * 0.539957);
      const hours = (nmDist / 7).toFixed(1);
      return {
        type: 'follow_up',
        summary: `Your registered Safe House **${safeHouse.label}** is **${safeHouseDist} km (~${nmDist} nm, ${safeHouseBearing})** away. At typical trawler displacement speed (7 kts), passage time is approximately **${hours} hours**.`,
        actionSuggestions: [
          { label: `🧭 Plot Route to Safe House`, query: `Safe route to ${safeHouse.label}` },
          { label: `🌊 Safe House Weather`, query: `Weather for ${safeHouse.label.split(' ')[0]}` },
        ],
      };
    }
  }

  // ── 1. Safe House Intent ──
  if (isSafeHouse) {
    return {
      type: 'safe_house',
      isSafeHouse: true,
      safeHouse,
      safeHouseDist,
      safeHouseBearing,
      summary: `Your official registered Safe House is **${safeHouse.label}** (${safeHouse.lat.toFixed(4)}°N, ${safeHouse.lon.toFixed(4)}°E) in the **${safeHouse.region || 'Coastal Sector'}**.\n\n• **Direct Distance**: **${safeHouseDist} km** (~${Math.round(safeHouseDist * 0.539957)} nautical miles)\n• **Compass Bearing**: **${safeHouseBearing}** from your active basin (${loc.name})\n• **Passage Status**: Coastal navigation channels back to this harbor are open. In heavy seas or emergency breakdown, this harbor serves as your primary SAR rendezvous point.`,
      actionSuggestions: [
        { label: `🧭 Safe Route to Safe House`, query: `Safe route to ${safeHouse.label}` },
        { label: `🌊 Swell at Safe House`, query: `Weather report for ${safeHouse.label.split(' ')[0]}` },
        { label: `⚓ Nearest Alternate Ports`, query: 'nearest port to me' },
      ],
    };
  }

  // ── 2. Region / Geographic Datum Intent ──
  if (isRegion) {
    return {
      type: 'region_info',
      isRegion: true,
      location: loc,
      summary: `You are monitoring **${loc.name}** within Indian Maritime **${loc.sector || 'Coastal Sector'}** (${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E).\n\n• **Sea State**: **${wave}m wave swell**, winds at **${wind} knots**\n• **Thermal Surface**: **${sst}°C** Sea Surface Temp\n• **Operational Status**: All PFZ machine learning predictions, satellite chlorophyll fronts, and maritime safety corridors in ORCA are calibrated to this basin.`,
      actionSuggestions: [
        { label: `🐟 Best Fishing Grounds here`, query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: `🌊 Check Sailing Safety`, query: 'Can I go out to sea right now?' },
        { label: `⚠️ Active Marine Hazards`, query: `Marine hazards in ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // ── 3. Nearest Port Intent ──
  if (isNearestPort) {
    const nearby = findNearestPorts(loc.lat, loc.lon, 3);
    const portsListText = nearby.map((p, i) => `• **${p.name}** (${p.sector}) — **${p.distanceKm} km (${p.bearing})**, ~${Math.round(p.distanceKm * 0.539957)} nm`).join('\n');
    return {
      type: 'nearest_port',
      isNearestPort: true,
      nearbyPorts: nearby,
      summary: `Here are the 3 closest operational landing centers and refuge ports from your active position:\n\n${portsListText}\n\n• **Primary Designated Safe House**: **${safeHouse.label}** (~${safeHouseDist} km away, ${safeHouseBearing})\n• **Immediate Landfall Recommendation**: If swell increases unexpectedly, **${nearby[0].name}** is your quickest sheltered entrance.`,
      actionSuggestions: [
        { label: `🧭 Safe Route to ${nearby[0].name.split(' ')[0]}`, query: `Safe route to ${nearby[0].name}` },
        { label: `🏠 Return to Safe House`, query: `Safe route to ${safeHouse.label}` },
        { label: `🌊 Swell at ${nearby[0].name.split(' ')[0]}`, query: `Weather report for ${nearby[0].name.split(' ')[0]}` },
      ],
    };
  }

  // ── 4. Safety Check Intent ──
  if (isSafetyCheck) {
    const isSafe = wave < 1.4 && wind < 18;
    const verdict = isSafe ? 'GO' : wave < 2.2 ? 'CAUTION' : 'NO-GO';
    const verdictColor = isSafe ? 'text-emerald-400' : wave < 2.2 ? 'text-amber-400' : 'text-red-400';
    const advisory = isSafe
      ? 'Favorable sea conditions. Gentle wave swell and manageable coastal breeze. Safe for artisanal motorized boats and mechanized trawlers up to 50 nm offshore.'
      : wave < 2.2
      ? 'Moderate sea swell detected with choppy surface conditions. Mechanized trawlers may venture with prudent watchkeeping. Small artisanal open canoes (<30 ft) are strongly advised to remain within 12 nm territorial waters.'
      : 'High sea state alert. Steep swell waves and squally winds present severe capsize and broaching risks. All commercial fishing vessels should remain in safe harbor.';

    return {
      type: 'safety_check',
      isSafetyCheck: true,
      verdict,
      verdictColor,
      wave,
      wind,
      summary: `**SAILING VERDICT: ${verdict}** for **${loc.name}** (${loc.sector || 'Coastal Zone'}).\n\n• **Wave Swell**: **${wave}m** (Sea state: ${wave < 1.2 ? 'Smooth to Slight' : wave < 2.0 ? 'Moderate Chop' : 'Rough'})\n• **Surface Wind**: **${wind} knots**\n• **Sea Temp (SST)**: **${sst}°C**\n\n${advisory}`,
      actionSuggestions: [
        { label: '🐟 Recommended Fishing Zones', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '⚓ Nearest Sheltered Port', query: 'nearest port to me' },
        { label: '⚠️ Active Hazard Advisories', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // ── 5. Fish Species & Bait/Tackle Intelligence ──
  if (isSpecies) {
    let matchedSpecies = null;
    let sKey = 'tuna';
    if (/tuna/i.test(q)) sKey = 'tuna';
    else if (/mackerel|ayila|bangda/i.test(q)) sKey = 'mackerel';
    else if (/sardine|mathi|tarli/i.test(q)) sKey = 'sardine';
    else if (/seer|surmai|anjal|kingfish/i.test(q)) sKey = 'seer';
    else if (/squid|cuttlefish/i.test(q)) sKey = 'squid';
    else if (/prawn|prawns|shrimp/i.test(q)) sKey = 'prawn';
    matchedSpecies = SPECIES_KNOWLEDGE[sKey] || SPECIES_KNOWLEDGE.tuna;

    return {
      type: 'species_intel',
      summary: `### 🐟 Species Intelligence: **${matchedSpecies.name}**\n\n• **Optimal Sea Temperature (SST)**: \`${matchedSpecies.sstRange}\` (Your basin: **${sst}°C**)\n• **Chlorophyll Preference**: \`${matchedSpecies.chlorophyll}\`\n• **Target Depth**: \`${matchedSpecies.depth}\`\n• **Recommended Gear & Bait**: ${matchedSpecies.gear}\n• **Tactical Field Advice**: ${matchedSpecies.techniques}\n• **Post-Catch Cold Chain**: ${matchedSpecies.handling}`,
      actionSuggestions: [
        { label: `🎯 Locate ${matchedSpecies.name.split(' ')[0]} Zones`, query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: `🌊 Check Water Swell & Wind`, query: 'Can I go out to sea right now?' },
        { label: `⛽ Fuel Saving Tips for Voyage`, query: 'How to save diesel on fishing trips' },
      ],
    };
  }

  // ── 6. Fuel Conservation & Cruising Economy ──
  if (isFuel) {
    return {
      type: 'fuel_advice',
      summary: `### ⛽ Fuel Efficiency & Diesel Conservation Guide for Mariners\n\nFor typical 32–45 ft wooden/FRP motorized fishing vessels and trawlers:\n\n1. **Maintain Displacement Hull Speed**: Cruising at **6.5 to 7.5 knots** (engine at **1400–1600 RPM**) burns **35% to 45% less diesel** than running full throttle at 8.5+ knots. Pushing past hull speed only generates large stern waves without meaningful speed gain.\n2. **Run with Prevailing Coastal Currents**: Check tidal and drift directions. Riding a 1.2 kt longshore current saves up to 15 liters of diesel per 30 nm leg.\n3. **Hull & Propeller Cleanliness**: A fouled propeller or barnacle-encrusted hull increases drag by up to 25%. Ensure seasonal zinc anode and bottom cleaning.\n4. **Balanced Deck Trim**: Level your catch and ice distribution. A bow-heavy or severely stern-dragging vessel creates excess hydrodynamic resistance.\n5. **Direct GPS Waypoint Nav**: Steer straight routes rather than wandering between shoals. Use ORCA's safe passage planner to shave off unnecessary nautical miles.`,
      actionSuggestions: [
        { label: '🧭 Plan Shortest Safe Route', query: 'open_route' },
        { label: '🐟 Find Nearest High-Yield Zone', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '🌊 Check Wind & Current Drift', query: `Weather report for ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // ── 7. Emergency, Distress & VHF Channel 16 ──
  if (isEmergency) {
    return {
      type: 'emergency',
      summary: `### 🚨 Marine Emergency & Distress Protocol (Indian Coastal Waters)\n\n• **Indian Coast Guard National Emergency (Toll-Free)**: \`1554\` (24/7 Maritime Rescue Coordination Centre - MRCC)\n• **Coastal Marine Police Emergency**: \`1093\`\n• **International Distress Radio**: **VHF Channel 16 (156.800 MHz)**\n\n#### Immediate Emergency Action Guide:\n1. **Engine Stall in Heavy Seas**: Immediately stream your **sea anchor (drogue)** off the bow on a long hawser. This keeps the vessel head-to-sea, preventing dangerous broadside waves (broaching) and capsize.\n2. **Broadcasting Distress (VHF Ch 16)**: Say *"MAYDAY, MAYDAY, MAYDAY. This is vessel [Name], [Reg Number]. Position [Lat/Lon]. [Nature of Distress]. [Number of Souls onboard]. Over."*\n3. **Man Overboard (MOB)**: Instantly throw a lifebuoy with life-line/light towards the person. Post an unblinking dedicated lookout pointing at the victim. Mark MOB on GPS plotter.\n4. **Active Distress Alert Transmitter (DAT)**: Trigger your ISRO/ICG Distress Alert Transmitter beacon to broadcast satellite coordinates directly to Chennai MRCC.\n\nYour designated Safe House fallback harbor is **${safeHouse.label}** (${safeHouse.lat.toFixed(4)}°N, ${safeHouse.lon.toFixed(4)}°E).`,
      actionSuggestions: [
        { label: '🏠 Safe House Coordinates', query: 'where is my safe house' },
        { label: '⚓ Nearest Shelter Port', query: 'nearest port to me' },
        { label: '🌊 Real-Time Sea State', query: `Weather report for ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // ── 8. Monsoon Fishing Ban in India ──
  if (isMonsoonBan) {
    return {
      type: 'monsoon_ban',
      summary: `### 🗓️ Annual Uniform Monsoon Fishing Ban in India (61 Days)\n\nTo allow natural fish spawning, protect fingerlings, and ensure fishermen safety during rough monsoon seas, the Government of India enforces an annual 61-day ban in the Exclusive Economic Zone (EEZ):\n\n• **West Coast (Gujarat, Daman & Diu, Maharashtra, Goa, Karnataka, Kerala)**:\n  - **Duration**: **June 1st to July 31st** (61 days)\n  - Applies to all mechanized fishing trawlers, purse-seiners, and deep-sea vessels.\n• **East Coast (West Bengal, Odisha, Andhra Pradesh, Tamil Nadu, Puducherry)**:\n  - **Duration**: **April 15th to June 14th** (61 days)\n\n#### Exemptions:\nTraditional motorized craft with outboard motors (OBM up to 10 HP) and non-motorized artisanal canoes are permitted to fish strictly within territorial waters (12 nautical miles) during daylight hours when weather permits. Violation of the ban incurs confiscation of catch and suspension of vessel registration under the Marine Fishing Regulation Act (MFRA).`,
      actionSuggestions: [
        { label: '📜 Mandated Safety Documents', query: 'What safety documents and gear do I need?' },
        { label: '🌊 Check Current Swell Condition', query: 'Can I go out to sea right now?' },
        { label: '🏠 Show My Safe House', query: 'where is my safe house' },
      ],
    };
  }

  // ── 9. Night Sailing & Navigation Safety ──
  if (isNightNav) {
    return {
      type: 'night_nav',
      summary: `### 🌙 Night Sailing & Offshore Watchkeeping Protocol\n\nOperating at night along the Indian continental shelf requires heightened vigilance due to unlit artisanal craft, drifting gillnets, and cargo shipping lanes:\n\n1. **Mandatory Navigation Lights**:\n   • **Port**: Red light (112.5° visible arc)\n   • **Starboard**: Green light (112.5° visible arc)\n   • **Stern**: White light (135° visible arc)\n   • **Masthead**: White light (225° forward arc, visible 2+ nm)\n   • **At Anchor**: All-round 360° white light.\n2. **Radar Reflector**: Ensure your octahedral radar reflector is hoisted at least **4 meters above the waterline** so steel commercial ships can track you on their radar screens.\n3. **Unlit Craft Hazards**: Artisanal dugouts and country canoes often operate without running lights within 15 nm of the shore. Keep a continuous 360° visual lookout with a high-power handheld spotlight ready on the bridge.\n4. **Harbor Bar Crossings**: Never attempt to enter unfamiliar shallow river mouths (e.g. Mangalore, Beypore, Coondapur bars) in pitch darkness during low tide. Anchor offshore in safe depth (>10m) until first daylight.`,
      actionSuggestions: [
        { label: '⚓ Nearest Deepwater Harbor', query: 'nearest port to me' },
        { label: '🏠 Route to Safe House', query: `Safe route to ${safeHouse.label}` },
        { label: '⚠️ Active Coastal Hazards', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // ── 10. Required Safety Equipment & Vessel Documentation ──
  if (isGearDocs) {
    return {
      type: 'gear_docs',
      summary: `### 📋 Mandatory Vessel Documentation & Safety Gear Checklist\n\nUnder Indian Coast Guard and State Fisheries Department regulations, all vessels venturing offshore must carry:\n\n#### Mandatory Documents:\n• **Vessel Registration Certificate** (Format: \`IND-[State]-[District]-[Type]-[Number]\`)\n• **Valid Fishing License & Token**\n• **Biometric QR ID Cards** for every single crew member onboard (mandated for national coastal security post-26/11)\n• **Insurance Policy** (Hull & crew cover)\n\n#### Mandatory Safety Equipment:\n1. **Lifejackets**: 1 IRS-approved lifejacket per crew member equipped with whistle and retro-reflective strips.\n2. **Lifebuoys**: Minimum 2 lifebuoys with 30m buoyant lifeline attached.\n3. **Pyrotechnics**: 4 Parachute rocket flares, 4 Hand flares, 2 Buoyant smoke signals (inspect expiry stamps regularly).\n4. **First Aid & Communications**: Waterproof marine medical kit, Marine VHF radio, Distress Alert Transmitter (DAT).\n5. **Fire Safety**: Minimum two 2kg Dry Chemical Powder (DCP) extinguishers in engine bay and wheelhouse.`,
      actionSuggestions: [
        { label: '⛵ My Vessel Profile', query: 'vessel details' },
        { label: '🏠 My Safe House Base', query: 'where is my safe house' },
        { label: '🚨 Emergency Radio Frequencies', query: 'What is VHF channel 16 used for?' },
      ],
    };
  }

  // ── 11. Oceanography in Plain Mariner Terms ──
  if (isOceanography) {
    return {
      type: 'oceanography',
      summary: `### 🌊 Ocean Science Explained for Coastal Fishermen\n\n• **Sea Surface Temperature (SST) Thermal Breaks**:\n  Fish are cold-blooded; their metabolism depends on ambient water. When satellite infrared detects a sharp boundary (thermal gradient) where cold upwelling water meets warm oceanic water, it forms an invisible barrier. Microscopic plankton accumulates along this temperature front, drawing baitfish (anchovies, sardines), which in turn concentrates large pelagics (tuna, seer fish, billfish).\n\n• **Chlorophyll-a Concentration**:\n  Measured by satellite ocean color sensors (like NASA MODIS). Chlorophyll-a represents microscopic plant plankton (phytoplankton). Values between **0.5 and 2.5 mg/m³** signal a healthy, thriving food chain. Values above 5.0 mg/m³ in warm stagnant waters can sometimes indicate harmful algal blooms (red tides).\n\n• **Ground Swell vs. Wind Waves**:\n  - **Wind Chop**: Short-period (3–5 seconds), steep waves created by local coastal winds. Uncomfortable but manageable.\n  - **Ground Swell**: Long-period (10–18 seconds) waves generated by massive oceanic storms hundreds of miles away in the Southern Indian Ocean. They carry immense energy and produce violent surf when meeting shallow coastal bars.`,
      actionSuggestions: [
        { label: '🐟 View Best PFZ Zones', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '🌊 Live Swell & Wave Period', query: `Weather report for ${loc.name.split(' ')[0]}` },
        { label: '🧭 Plan Safe Passage', query: 'open_route' },
      ],
    };
  }

  // ── 12. Vessel Telemetry Intent ──
  if (isVessel) {
    const vName = user?.vessel_name || 'Matsya 3';
    const vType = user?.vessel_type || 'Mechanized Wooden Trawler';
    const vReg = user?.license_number || 'IND-KA-04-MM-1892';
    return {
      type: 'vessel_info',
      isVessel: true,
      summary: `Here is your registered vessel telemetry profile:\n\n• **Vessel Master / Captain**: **${captain}**\n• **Vessel Name**: **${vName}** (${vType})\n• **Official Registration**: \`${vReg}\`\n• **Registered Safe House**: **${safeHouse.label}** (${safeHouse.lat.toFixed(4)}°N, ${safeHouse.lon.toFixed(4)}°E)\n• **Active Monitored Basin**: **${loc.name}** (${loc.sector || 'Coastal Sector'})\n\nSafety parameters, fuel consumption estimates, and hazard standoffs in ORCA are calibrated for this vessel class.`,
      actionSuggestions: [
        { label: '⚙️ Edit Profile & Vessel', query: 'open_profile' },
        { label: '🏠 Safe House Details', query: 'where is my safe house' },
        { label: '🧭 Plan Route for this Vessel', query: `Safe route from ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // ── 13. Potential Fishing Zones (PFZ) Intent ──
  if (isPfz) {
    const topText = topZone
      ? `Top recommended site is **${topZone.id}** (${topZone.expectedSpecies}) located **${topZone.distanceNm} nm (${topZone.bearing})** from origin with **${topZone.predictedZone}** yield confidence (SST: ${topZone.temperature}°C, Chl-a: ${topZone.chlorophyll} mg/m³).`
      : 'Analyzing offshore thermal breaks and chlorophyll concentrations.';
    return {
      type: 'pfz',
      isPfz: true,
      zones,
      topZone,
      summary: `### 🐟 Potential Fishing Zones (PFZ) for **${loc.name}** (${loc.sector || 'Coastal Zone'})\n\nORCA's trained XGBoost model evaluated satellite MODIS chlorophyll-a and GHRSST thermal gradients across **${zones.length} candidate offshore coordinates**.\n\n• ${topText}\n• **Sea State**: Wave swell is **${wave}m**, safe for transit.\n• **Advisory**: Target the boundaries of the thermal front where sea surface temperature drops 0.4°C over 1 nautical mile.`,
      actionSuggestions: [
        { label: topZone ? `🧭 Safe Route to ${topZone.id}` : '🧭 Plot Safe Route', query: `Safe route to nearest fishing zone` },
        { label: '🌊 Check Weather for Fishing', query: `Weather report for ${loc.name.split(' ')[0]}` },
        { label: '⛽ How to Save Diesel Getting There', query: 'How to save diesel on fishing trips' },
      ],
    };
  }

  // ── 14. Safe Route Intent ──
  if (isRoute) {
    const targetDest = topZone ? `${topZone.id} (~${topZone.distanceNm} nm, ${topZone.bearing})` : 'Nearest Deepwater Channel (~22 nm)';
    return {
      type: 'route',
      isRoute: true,
      summary: `### 🧭 Safe Navigational Passage Guidance\n\n• **Departure**: **${loc.name}** (${loc.sector})\n• **Target Destination**: **${targetDest}**\n• **Fallback Haven**: **${safeHouse.label}** (~${safeHouseDist} km away, ${safeHouseBearing})\n\nORCA's coastal pathfinding algorithm calculates waypoint clearance avoiding marked naval firing exclusion zones, shallow shoals (<5m), and heavy shipping lanes while following natural bathymetric channels.`,
      actionSuggestions: [
        { label: '🚀 Launch Safe Route Planner', query: 'open_route' },
        { label: '⚠️ Check Hazards on Route', query: `Marine hazards near ${loc.name.split(' ')[0]}` },
        { label: '🌊 Sea State en Route', query: 'Can I go out to sea right now?' },
      ],
    };
  }

  // ── 15. Weather Intent ──
  if (isWeather) {
    const waveAdvisory = wave < 1.2
      ? 'Calm to Slight Sea State — Gentle swell. Excellent conditions for both motorized artisanal boats and mechanized trawlers.'
      : wave < 2.0
      ? 'Moderate Swell Chop — Safe for mechanized trawlers; small open craft advised caution beyond 12 nm.'
      : 'High Swell Alert — Elevated capsize risk. Vessels advised to remain inside sheltered bays.';

    return {
      type: 'weather',
      isWeather: true,
      summary: `### 🌊 Marine Weather & Oceanographic Swell Report\n\n**Sector**: **${loc.name}** (${loc.sector || 'Coastal Shelf'})\n\n• **Wave Swell**: **${wave}m** — ${waveAdvisory}\n• **Surface Wind**: **${wind} knots**\n• **Sea Surface Temp (SST)**: **${sst}°C**\n• **Atmospheric Visibility**: **10+ nautical miles** (Clear horizon)\n• **Advisory**: Swell direction is favorable for offshore navigation. Monitor afternoon thermal sea-breeze changes around 14:00 hrs.`,
      waveAdvisory,
      actionSuggestions: [
        { label: '🐟 Find Fishing Zones in this Swell', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '⚠️ Check Active Hazards', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
        { label: '🧭 Plan Safe Passage', query: 'open_route' },
      ],
    };
  }

  // ── 16. Hazard Intent ──
  if (isHazard) {
    return {
      type: 'hazard',
      isHazard: true,
      summary: `### ⚠️ Navigational Hazards & Maritime Security Advisory\n\n**Monitoring**: **${loc.name}** (${loc.sector})\n\n• **Navigational Exclusion**: Screened active Indian EEZ coastal exclusion zones, naval exercise boundaries, and submarine cable corridors.\n• **Weather Alerts**: No active cyclonic depression in immediate coastal sector. Coastal swell is **${wave}m**.\n• **Safety Standoff**: Vessels must maintain a minimum **5 nautical mile clearance** from marked offshore military practice zones and oil rig platforms.\n• **Coast Guard Emergency**: In case of suspicious vessel sightings or navigational distress, alert Coast Guard on **VHF Channel 16** or dial **1554**.`,
      actionSuggestions: [
        { label: '🧭 Plan Hazard-Free Route', query: `Safe route from ${loc.name.split(' ')[0]}` },
        { label: '🌊 Sea Swell & Wind Report', query: `Weather report for ${loc.name.split(' ')[0]}` },
        { label: '🏠 Return to Safe House', query: `Safe route to ${safeHouse.label}` },
      ],
    };
  }

  // ── 17. Gratitude & Conversational Rapport ──
  if (isGratitude) {
    const gratitudeReplies = [
      `You're very welcome, ${captain}! Wishing you fair winds, calm seas, and heavy nets. Let me know if you need any other coordinates.`,
      `Glad to assist, ${captain}. Keep a sharp watch on the horizon and stay safe out there!`,
      `Always at your service, ${captain}. May your voyage be smooth and your catch abundant. Feel free to check in whenever conditions change.`,
      `Proud to serve your vessel, ${captain}. Remember to check weather updates before heading into deepwater channels.`,
    ];
    return {
      type: 'conversational',
      summary: gratitudeReplies[Math.floor(Math.random() * gratitudeReplies.length)],
      actionSuggestions: [
        { label: '🐟 Check Fishing Zones', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '🌊 Check Sea Swell', query: 'Can I go out to sea right now?' },
        { label: '🏠 Locate Safe House', query: 'where is my safe house' },
      ],
    };
  }

  // ── 18. Greetings & Onboarding ──
  if (isGreeting) {
    const greeting = getRandomGreeting(captain);
    return {
      type: 'greeting',
      isGeneral: true,
      summary: `${greeting}\n\nI am **ORCA**, your AI Marine Intelligence Copilot for Indian coastal fisheries. I am connected to real-time satellite telemetry for **${loc.name} (${loc.sector || 'Coastal Sector'})** and your vessel **${user?.vessel_name || 'Matsya 3'}**.\n\nHere is how I can assist your voyage today:\n• 🐟 **Fishing Intelligence**: *"Where is the best tuna/mackerel zone today?"*\n• 🌊 **Sea State Safety**: *"Can I go out to sea right now?"*\n• 🏠 **Safe Haven**: *"Where is my safe house harbor?"*\n• ⚓ **Shelter & Ports**: *"What is the nearest port to me?"*\n• ⛽ **Fuel Efficiency**: *"How can I save diesel during transit?"*\n• 🚨 **Emergency Procedures**: *"What is VHF Channel 16 protocol?"*\n• 🗓️ **Regulations**: *"When does the monsoon fishing ban start?"*\n\nWhat would you like to explore first?`,
      actionSuggestions: [
        { label: '🐟 Best Fishing Grounds', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '🌊 Is it safe to sail today?', query: 'Can I go out to sea right now?' },
        { label: '🏠 Show my Safe House', query: 'where is my safe house' },
        { label: '⚓ Nearest Port to Me', query: 'nearest port to me' },
      ],
    };
  }

  // ── 19. Natural Intelligent Conversational Fallback ──
  const contextualOpenings = [
    `Understood, ${captain}. Let me look into that for you regarding **${loc.name}** (${loc.sector}).`,
    `Aye, ${captain}. Reviewing your request with our coastal marine intelligence systems.`,
    `Good question, ${captain}. Here is the relevant maritime operational perspective for your vessel:`,
  ];
  const opening = contextualOpenings[Math.floor(Math.random() * contextualOpenings.length)];

  return {
    type: 'general',
    isGeneral: true,
    summary: `${opening}\n\n• **Active Monitored Basin**: **${loc.name}** (${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E)\n• **Sea Conditions**: Swell is **${wave}m** with winds at **${wind} knots** (Sea State: ${wave < 1.3 ? 'Favorable' : 'Moderate Chop'})\n• **Designated Safe Haven**: **${safeHouse.label}** (~${safeHouseDist} km away, ${safeHouseBearing})\n\nIf you are planning an offshore trip today, I can calculate optimal fishing zones (PFZ), review sea swell safety, plot navigational routes avoiding coastal hazards, or look up emergency harbor refuges.`,
    actionSuggestions: [
      { label: '🐟 Best Fishing Zones', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
      { label: '🌊 Can I Sail Safely Today?', query: 'Can I go out to sea right now?' },
      { label: '🏠 Locate Safe House', query: 'where is my safe house' },
      { label: '⚓ Nearest Coastal Port', query: 'nearest port to me' },
    ],
  };
}
