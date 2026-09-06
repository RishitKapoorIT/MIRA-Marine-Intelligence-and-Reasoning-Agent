/**
 * Loads the bundled India EEZ boundary GeoJSON.
 * Source: simplified polygon derived from marineregions.org (VLIZ) — free, no key.
 * Bundled as a static public asset so there is zero runtime cost.
 *
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function getIndiaEEZ() {
  const res = await fetch('/data/india_eez.geojson');
  if (!res.ok) throw new Error('Failed to load India EEZ GeoJSON');
  return res.json();
}
