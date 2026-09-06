/**
 * Chlorophyll concentration layer adapter — PLACEHOLDER.
 *
 * Returns null until the NASA Ocean Color / earthaccess pipeline is integrated.
 * Same swap-in discipline as getSstLayer — components require zero changes
 * when the real feed is connected.
 *
 * @param {number} _lat
 * @param {number} _lon
 * @param {string} _date  ISO date string
 * @returns {Promise<null>}
 */
export async function getChlorophyllLayer(_lat, _lon, _date) {
  // Future: return { tileUrl, colorScale, fetchedAt } from NASA Ocean Color OB.DAAC
  return null;
}
