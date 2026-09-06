/**
 * SST (Sea Surface Temperature) layer adapter — PLACEHOLDER.
 *
 * Returns null until the NASA Ocean Color / earthaccess pipeline is integrated.
 * The function signature is production-ready; swap the body to return real raster
 * tile URLs or processed grid data when the backend pipeline (Iteration 2) is ready.
 * Components calling this adapter will require zero changes.
 *
 * @param {number} _lat
 * @param {number} _lon
 * @param {string} _date  ISO date string
 * @returns {Promise<null>}
 */
export async function getSstLayer(_lat, _lon, _date) {
  // Future: return { tileUrl, colorScale, fetchedAt } from NASA GIBS or earthaccess
  return null;
}
