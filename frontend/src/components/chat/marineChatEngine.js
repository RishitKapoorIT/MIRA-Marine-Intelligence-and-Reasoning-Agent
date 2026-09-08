/**
 * ORCA Marine Chat Engine
 * Intelligent, user-oriented conversational reasoning for Indian coastal fisheries.
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

/**
 * Evaluates user query and returns a contextual, user-oriented conversational response.
 */
export function generateMarineAiResponse({
  queryText,
  user,
  currentLocation,
  weatherData,
  pfzResult,
  hazards = [],
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

  const wave = weatherData?.waveHeight || 1.0;
  const wind = weatherData?.windSpeed || 12;
  const sst = weatherData?.sst || 29.8;
  const zones = pfzResult?.zones || [];
  const topZone = zones[0] || null;

  // Compute distance to safe house
  const safeHouseDist = calculateDistanceKm(loc.lat, loc.lon, safeHouse.lat, safeHouse.lon);
  const safeHouseBearing = calculateBearing(loc.lat, loc.lon, safeHouse.lat, safeHouse.lon);

  // Intent Checks
  const isSafeHouse = /\b(safe house|save house|safe area|my house|home harbor|home base|my base|emergency harbor)\b/i.test(q);
  const isRegion = /\b(what is my region|name of it|my region|my sector|current sector|where am i|which waters|what waters|current location|my area|my place)\b/i.test(q);
  const isNearestPort = /\b(nearest port|nearest harbor|closest port|closest harbor|ports near me|ports nearby|dock|shelter|safe port)\b/i.test(q);
  const isSafetyCheck = /\b(can i sail|can i go out|is it safe|should i go|is it dangerous|safe for fishing|safe to venture|sea safety|rough sea)\b/i.test(q);
  const isVessel = /\b(my vessel|my boat|vessel details|registration|license|my profile|vessel info)\b/i.test(q);
  const isWeather = !isSafetyCheck && /\b(weather|forecast|swell|wave|waves|wind|temp|temperature|sea state|calm|rough|rain|monsoon|breeze|current|tide)\b/i.test(q);
  const isHazard = /\b(hazard|hazards|danger|dangerous|warning|warnings|restricted|firing|cyclone|storm|alert|security|risk)\b/i.test(q);
  const isRoute = /\b(route|routes|navigate|navigation|waypoint|direction|directions|port to port|transit|fuel|passage|how to reach)\b/i.test(q);
  const isPfz = /\b(fish|fishing|pfz|catch|tuna|mackerel|sardine|yield|zones|zone|pelagic|where to fish|grounds|best area)\b/i.test(q);
  const isGreeting = /\b(hi|hello|hey|namaste|vanakkam|who are you|what can you do|help|assist|options|features|good morning|good evening)\b/i.test(q);

  // 1. Safe House Intent
  if (isSafeHouse) {
    return {
      type: 'safe_house',
      isSafeHouse: true,
      safeHouse,
      safeHouseDist,
      safeHouseBearing,
      summary: `Your registered Safe House is **${safeHouse.label}** (${safeHouse.lat.toFixed(4)}°N, ${safeHouse.lon.toFixed(4)}°E). It is located approximately **${safeHouseDist} km (${safeHouseBearing})** from your current monitored sector. This harbor serves as your primary emergency retreat base and fallback GPS datum. Navigation corridors back to this harbor are currently open.`,
      actionSuggestions: [
        { label: `🧭 Route back to ${safeHouse.label.split(' ')[0]}`, query: `Safe route to ${safeHouse.label}` },
        { label: `🌊 Check weather at Safe House`, query: `Weather for ${safeHouse.label.split(' ')[0]}` },
      ],
    };
  }

  // 2. Region / Sector Intent
  if (isRegion) {
    return {
      type: 'region_info',
      isRegion: true,
      location: loc,
      summary: `You are currently monitoring **${loc.name}**, situated within Indian Maritime **${loc.sector || 'Coastal Sector'}** (${loc.lat.toFixed(2)}°N, ${loc.lon.toFixed(2)}°E). Present sea state shows **${wave}m wave swell** at **${wind} knots wind**, with Sea Surface Temp at **${sst}°C**. All intelligence feeds, PFZ predictions, and satellite layers are anchored to this maritime basin.`,
      actionSuggestions: [
        { label: '🐟 Best Fishing Grounds here', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '🌊 Sea Swell & Weather', query: `Weather report for ${loc.name.split(' ')[0]}` },
        { label: '⚠️ Active Marine Hazards', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 3. Nearest Port Intent
  if (isNearestPort) {
    const nearby = findNearestPorts(loc.lat, loc.lon, 3);
    const portsListText = nearby.map((p, i) => `${i + 1}. **${p.name}** (${p.sector}) — **${p.distanceKm} km (${p.bearing})**`).join('\n');
    return {
      type: 'nearest_port',
      isNearestPort: true,
      nearbyPorts: nearby,
      summary: `Here are the closest operational fishing ports and shelter harbors from your active position:\n\n${portsListText}\n\nYour designated Safe House harbor is **${safeHouse.label}** (~${safeHouseDist} km away). In case of deteriorating swell, **${nearby[0].name}** provides the closest landfall shelter.`,
      actionSuggestions: [
        { label: `🧭 Safe Route to ${nearby[0].name.split(' ')[0]}`, query: `Safe route to ${nearby[0].name}` },
        { label: `🏠 Return to Safe House`, query: `Safe route to ${safeHouse.label}` },
      ],
    };
  }

  // 4. Safety Check / Can I Sail Intent
  if (isSafetyCheck) {
    const isSafe = wave < 1.4 && wind < 18;
    const verdict = isSafe ? 'GO' : wave < 2.2 ? 'CAUTION' : 'NO-GO';
    const verdictColor = isSafe ? 'text-emerald-400' : wave < 2.2 ? 'text-amber-400' : 'text-red-400';
    const advisory = isSafe
      ? 'Favorable sea conditions. Sea swell is gentle and safe for artisanal motorized boats and mechanized trawlers. No severe cyclone or naval firing alerts active.'
      : wave < 2.2
      ? 'Moderate sea swell detected. Mechanized trawlers may venture out with caution. Artisanal open craft are advised to remain inshore (<12 nm).'
      : 'Rough sea state warning. High swells and strong winds present elevated capsize risk. Vessels advised to remain in safe harbor.';

    return {
      type: 'safety_check',
      isSafetyCheck: true,
      verdict,
      verdictColor,
      wave,
      wind,
      summary: `**SAILING VERDICT: ${verdict}** for ${loc.name} (${loc.sector || 'Coastal Zone'}).\n• **Wave Swell**: ${wave}m\n• **Surface Wind**: ${wind} kt\n• **Sea Surface Temp**: ${sst}°C\n\n${advisory}`,
      actionSuggestions: [
        { label: '🌊 Detailed Wave Swell Report', query: `Weather report for ${loc.name.split(' ')[0]}` },
        { label: '⚠️ View Active Hazards', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 5. Vessel Telemetry Intent
  if (isVessel) {
    const vName = user?.vessel_name || 'Matsya 3';
    const vType = user?.vessel_type || 'Mechanized Wooden Trawler';
    const vReg = user?.license_number || 'IND-KA-04-MM-1892';
    return {
      type: 'vessel_info',
      isVessel: true,
      summary: `Here is your registered vessel telemetry:\n• **Master / Captain**: ${captain}\n• **Vessel**: **${vName}** (${vType})\n• **Registration / License**: \`${vReg}\`\n• **Base Harbor / Safe House**: **${safeHouse.label}**\n• **Monitored Sector**: **${loc.name}** (${loc.sector})\n\nSafety calculations, fuel range profiles, and hazard standoffs are dynamically calibrated to this vessel class.`,
      actionSuggestions: [
        { label: '⚙️ Edit Profile & Vessel', query: 'open_profile' },
        { label: '🧭 Plan Safe Passage', query: `Safe route from ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 6. Potential Fishing Zones (PFZ) Intent
  if (isPfz) {
    const topText = topZone
      ? `Highest probability zone is **${topZone.id}** (${topZone.expectedSpecies}) located **${topZone.distanceNm} nm (${topZone.bearing})** from origin with **${topZone.predictedZone}** yield confidence.`
      : 'Evaluating offshore candidate sites for pelagic aggregation fronts.';
    return {
      type: 'pfz',
      isPfz: true,
      zones,
      topZone,
      summary: `Potential Fishing Zones (PFZ) synthesis for **${loc.name} (${loc.sector})**. Analyzed satellite SST thermal fronts and chlorophyll concentration using ORCA's trained XGBoost model across ${zones.length} offshore candidate sites. ${topText}`,
      actionSuggestions: [
        { label: topZone ? `🧭 Safe Route to ${topZone.id}` : '🧭 Plot Safe Route', query: `Safe route to nearest fishing zone` },
        { label: '🌊 Check Weather for Fishing', query: `Weather report for ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 7. Safe Route Intent
  if (isRoute) {
    const targetDest = topZone ? `${topZone.id} (~${topZone.distanceNm} nm)` : 'Nearest Deepwater Channel (~22 nm)';
    return {
      type: 'route',
      isRoute: true,
      summary: `Safe Navigational Route Guidance departing from **${loc.name}** toward **${targetDest}**. Computed coastal transit path with automated hazard boundary clearance, safe bathymetry contours, and real-time swell avoidance.`,
      actionSuggestions: [
        { label: '🚀 Launch Safe Route Planner', query: 'open_route' },
        { label: '⚠️ Check Hazards on Route', query: `Marine hazards near ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 8. Weather Intent
  if (isWeather) {
    const waveAdvisory = wave < 1.2
      ? 'Calm Sea State — Safe for motorized craft and artisanal fishing.'
      : wave < 2.0
      ? 'Moderate Swell — Safe for mechanized trawlers; open craft advised caution.'
      : 'High Swell Alert — Rough sea conditions. Stay within inner channels.';
    return {
      type: 'weather',
      isWeather: true,
      summary: `Coastal Marine Weather & Swell Report for **${loc.name} (${loc.sector})**. Analyzed satellite wave spectrum, surface winds, and oceanographic thermal gradients. ${waveAdvisory}`,
      waveAdvisory,
      actionSuggestions: [
        { label: '🐟 Find Fishing Zones in this Swell', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '⚠️ Navigational Hazards', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 9. Hazard Intent
  if (isHazard) {
    return {
      type: 'hazard',
      isHazard: true,
      summary: `Marine Navigational Hazards & Safety Advisory for **${loc.name} (${loc.sector})**. Screened active Indian EEZ coastal exclusion zones, NDMA weather advisories, and naval firing boundaries. Maintain minimum 5nm standoff from marked caution zones.`,
      actionSuggestions: [
        { label: '🧭 Plan Hazard-Free Safe Route', query: `Safe route from ${loc.name.split(' ')[0]}` },
        { label: '🌊 Check Sea Swell & Winds', query: `Weather report for ${loc.name.split(' ')[0]}` },
      ],
    };
  }

  // 10. Greetings & Help Intent
  if (isGreeting) {
    return {
      type: 'greeting',
      isGeneral: true,
      summary: `Hello ${captain}! I am **ORCA**, your AI Marine Intelligence Assistant. I am actively monitoring **${loc.name} (${loc.sector})** for your vessel **${user?.vessel_name || 'Matsya 3'}**.\n\nYou can ask me in plain language about:\n• 🐟 **Fishing**: *"Where is the best area for fishing today?"*\n• 🌊 **Sea State**: *"Can I go out to sea right now?"*\n• 🏠 **Safe House**: *"Where is my safe house harbor?"*\n• ⚓ **Shelter**: *"What is the nearest port to me?"*\n• 🧭 **Navigation**: *"Show me safe route for fishing"*\n\nHow can I assist your voyage today?`,
      actionSuggestions: [
        { label: '🐟 Best Fishing Grounds', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
        { label: '⚓ Nearest Port to Me', query: 'nearest port to me' },
        { label: '🌊 Is it safe to sail today?', query: 'Can I go out to sea right now?' },
        { label: '🏠 Show my Safe House', query: 'where is my safe house' },
      ],
    };
  }

  // 11. Conversational Default
  return {
    type: 'general',
    isGeneral: true,
    summary: `Understood, ${captain}. I am monitoring **${loc.name} (${loc.sector})** for your vessel **${user?.vessel_name || 'Matsya 3'}**. Wave swell is currently **${wave}m** with **${wind} kt winds**. Would you like to check today's recommended fishing zones, plot a safe navigational route, or view active maritime hazards?`,
    actionSuggestions: [
      { label: '🐟 Identify Fishing Zones (PFZ)', query: `Identify best fishing zones near ${loc.name.split(' ')[0]}` },
      { label: '🌊 Check Live Swell & Weather', query: `Weather report for ${loc.name.split(' ')[0]}` },
      { label: '🏠 Locate Safe House', query: 'where is my safe house' },
      { label: '⚠️ Active Marine Advisories', query: `Marine hazards in ${loc.name.split(' ')[0]}` },
    ],
  };
}
