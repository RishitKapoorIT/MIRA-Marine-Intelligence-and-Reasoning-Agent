import { useState, useEffect } from 'react';
import { MANGALORE_FALLBACK } from '../config/map.js';

/**
 * Requests the browser geolocation API.
 * If denied or unavailable, falls back to the Mangalore base coordinate (FR-H4).
 * A "You" marker is ALWAYS available — never missing.
 *
 * @returns {{ position: [number,number], isReal: boolean, loading: boolean }}
 */
export function useGeolocation() {
  const [state, setState] = useState({
    position: MANGALORE_FALLBACK,
    isReal: false,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ position: MANGALORE_FALLBACK, isReal: false, loading: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: [pos.coords.latitude, pos.coords.longitude],
          isReal: true,
          loading: false,
        });
      },
      () => {
        // Permission denied or error → silent fallback
        setState({ position: MANGALORE_FALLBACK, isReal: false, loading: false });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return state;
}
