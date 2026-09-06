import { SACHET_PROXY_URL } from '../config/map.js';

/**
 * Pre-defined regional hazard zones for South-West Indian coastal waters.
 * Used for map circle overlays, exclusion zone collision checks in routing (Frame 08),
 * and fallback when the NDMA SACHET CAP live XML feed is unreachable (FR-C6).
 */
export const SAMPLE_HAZARD_ZONES = [
  {
    id: 'haz-crit-001',
    type: 'Cyclone Formation Watch',
    severity: 'CRITICAL',
    title: 'SEVERE CYCLONE INTENSIFICATION — Central Arabian Sea',
    area: 'Arabian Sea — Offshore Mangalore & Goa (>35nm W)',
    validity: 'Active until Sep 08 · 23:59 IST',
    onset: '2026-09-06T06:00:00Z',
    expires: '2026-09-08T18:30:00Z',
    guidance: 'Artisanal motorized craft strictly advised not to venture beyond 30nm. Return to nearest safe harbor immediately.',
    lat: 13.200,
    lon: 73.650,
    radiusKm: 55, // Exclusion zone circle
    color: '#EF4444', // Red
    fillColor: '#EF4444',
    fillOpacity: 0.22,
    isSample: true,
  },
  {
    id: 'haz-warn-002',
    type: 'High Swell Warning',
    severity: 'WARNING',
    title: 'ROUGH SWELL SURGE (2.8m — 3.5m) — Karnataka Shelf',
    area: 'Coastal Karnataka — Malpe to Mangalore Outer Channel',
    validity: 'Valid next 24 Hours',
    onset: '2026-09-06T10:00:00Z',
    expires: '2026-09-07T12:00:00Z',
    guidance: 'Safe transit restricted to inshore channels (<15nm). Secure all gear; navigate at reduced speed.',
    lat: 12.800,
    lon: 74.300,
    radiusKm: 32,
    color: '#F59E0B', // Amber
    fillColor: '#F59E0B',
    fillOpacity: 0.18,
    isSample: true,
  },
  {
    id: 'haz-adv-003',
    type: 'Naval Gunnery Practice / Security Perimeter',
    severity: 'ADVISORY',
    title: 'RESTRICTED BOUNDARY — Naval Firing Exercise Area',
    area: 'South Goa / Karwar Deep Offshore Sector',
    validity: 'Daily 08:00 - 16:00 IST',
    onset: '2026-09-06T02:30:00Z',
    expires: '2026-09-09T10:30:00Z',
    guidance: 'Commercial fishing vessels maintain minimum 10nm standoff from coordinates.',
    lat: 14.650,
    lon: 73.400,
    radiusKm: 40,
    color: '#3B82F6', // Blue
    fillColor: '#3B82F6',
    fillOpacity: 0.15,
    isSample: true,
  }
];

/**
 * Fetches NDMA SACHET CAP hazard alerts with automatic fallback to sample hazards (FR-C6).
 * @returns {Promise<{ alerts: Array, counts: { critical: number, warning: number, advisory: number }, isLive: boolean }>}
 */
export async function getHazardAlerts() {
  try {
    const res = await fetch(SACHET_PROXY_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Proxy responded ${res.status}`);

    const json = await res.json();
    const xmlText = json.contents;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const liveAlerts = parseSachetXml(doc);

    if (liveAlerts.length > 0) {
      // Merge with geo-tagged zone geometries for map display
      const merged = [...liveAlerts, ...SAMPLE_HAZARD_ZONES];
      return {
        alerts: merged,
        counts: countSeverities(merged),
        isLive: true,
      };
    }
    throw new Error('No entries in SACHET feed');
  } catch (err) {
    // Graceful fallback to verified sample hazards (clearly tagged)
    return {
      alerts: SAMPLE_HAZARD_ZONES,
      counts: countSeverities(SAMPLE_HAZARD_ZONES),
      isLive: false,
    };
  }
}

function countSeverities(alerts) {
  let critical = 0;
  let warning = 0;
  let advisory = 0;

  alerts.forEach(a => {
    const sev = (a.severity || '').toUpperCase();
    if (sev === 'CRITICAL' || sev === 'EXTREME' || sev === 'SEVERE') critical++;
    else if (sev === 'WARNING' || sev === 'MODERATE') warning++;
    else advisory++;
  });

  return { critical, warning, advisory };
}

function parseSachetXml(doc) {
  const entries = doc.querySelectorAll('entry');
  const alerts = [];

  entries.forEach((entry, i) => {
    const title = entry.querySelector('title')?.textContent ?? 'Marine Hazard Bulletin';
    const summary = entry.querySelector('summary')?.textContent ?? '';
    const updated = entry.querySelector('updated')?.textContent ?? new Date().toISOString();

    const isCrit = /extreme|severe|cyclone|gale/i.test(title + summary);
    const isWarn = /warning|rough|high wave|squall/i.test(title + summary);

    alerts.push({
      id: `sachet-live-${i}`,
      type: isCrit ? 'Severe Weather / Storm' : 'Marine Advisory',
      severity: isCrit ? 'CRITICAL' : isWarn ? 'WARNING' : 'ADVISORY',
      title,
      area: extractArea(summary) || 'India Coastal & EEZ Waters',
      validity: 'Next 24h Bulletin',
      onset: updated,
      expires: '',
      guidance: summary.slice(0, 160) + '...',
      lat: 13.0 + (i * 0.4),
      lon: 74.0 - (i * 0.3),
      radiusKm: isCrit ? 50 : 25,
      color: isCrit ? '#EF4444' : isWarn ? '#F59E0B' : '#3B82F6',
      fillColor: isCrit ? '#EF4444' : isWarn ? '#F59E0B' : '#3B82F6',
      fillOpacity: 0.2,
      isSample: false,
    });
  });

  return alerts;
}

function extractArea(text) {
  const match = text.match(/(?:area|region|district|waters)[:\s]+([^.]+)/i);
  return match ? match[1].trim() : null;
}
