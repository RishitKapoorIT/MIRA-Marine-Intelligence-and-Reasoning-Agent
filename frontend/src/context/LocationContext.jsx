import React, { createContext, useContext, useState, useEffect } from 'react';
import { NOMINATIM_URL, NOMINATIM_UA, MANGALORE_FALLBACK } from '../config/map.js';

const LocationContext = createContext(null);

export const KNOWN_COASTAL_LOCATIONS = [
  // West Coast (North to South)
  { key: 'porbandar', name: 'Porbandar Coastal Shelf', lat: 21.642, lon: 69.609, region: 'Gujarat', sector: 'Sector 1' },
  { key: 'veraval', name: 'Veraval Offshore Grounds', lat: 20.900, lon: 70.367, region: 'Gujarat', sector: 'Sector 2' },
  { key: 'gujarat', name: 'Gujarat Coastal Shelf (Veraval)', lat: 20.900, lon: 70.367, region: 'Gujarat', sector: 'Sector 2' },
  { key: 'mumbai', name: 'Mumbai Harbor & Continental Shelf', lat: 18.918, lon: 72.825, region: 'Maharashtra', sector: 'Sector 3' },
  { key: 'bombay', name: 'Mumbai Harbor & Continental Shelf', lat: 18.918, lon: 72.825, region: 'Maharashtra', sector: 'Sector 3' },
  { key: 'maharashtra', name: 'Maharashtra Shelf (Mumbai)', lat: 18.918, lon: 72.825, region: 'Maharashtra', sector: 'Sector 3' },
  { key: 'ratnagiri', name: 'Ratnagiri Deep Shelf Basin', lat: 16.984, lon: 73.281, region: 'Maharashtra', sector: 'Sector 4' },
  { key: 'goa', name: 'Goa Coastal Waters (Mormugao)', lat: 15.417, lon: 73.798, region: 'Goa', sector: 'Sector 5' },
  { key: 'karwar', name: 'Karwar Shelf & Anjadip Waters', lat: 14.808, lon: 74.120, region: 'Karnataka', sector: 'Sector 6' },
  { key: 'malpe', name: 'Malpe Fisheries Basin', lat: 13.348, lon: 74.701, region: 'Karnataka', sector: 'Sector 7' },
  { key: 'mangalore', name: 'Mangalore Coastal Shelf Basin', lat: 12.914, lon: 74.856, region: 'Karnataka', sector: 'Sector 7' },
  { key: 'karnataka', name: 'Karnataka Coastal Waters (Mangalore)', lat: 12.914, lon: 74.856, region: 'Karnataka', sector: 'Sector 7' },
  { key: 'kannur', name: 'Kannur / Ayikkara Waters', lat: 11.854, lon: 75.372, region: 'Kerala', sector: 'Sector 8' },
  { key: 'kochi', name: 'Kochi (Cochin) Shelf & Mud Banks', lat: 9.967, lon: 76.242, region: 'Kerala', sector: 'Sector 9' },
  { key: 'cochin', name: 'Kochi (Cochin) Shelf & Mud Banks', lat: 9.967, lon: 76.242, region: 'Kerala', sector: 'Sector 9' },
  { key: 'kerala', name: 'Kerala Coastal Shelf (Kochi)', lat: 9.967, lon: 76.242, region: 'Kerala', sector: 'Sector 9' },
  { key: 'kollam', name: 'Kollam / Neendakara Shelf', lat: 8.893, lon: 76.550, region: 'Kerala', sector: 'Sector 9' },
  { key: 'thiruvananthapuram', name: 'Vizhinjam / Trivandrum Offshore', lat: 8.382, lon: 76.995, region: 'Kerala', sector: 'Sector 10' },
  { key: 'vizhinjam', name: 'Vizhinjam / Trivandrum Offshore', lat: 8.382, lon: 76.995, region: 'Kerala', sector: 'Sector 10' },

  // South & East Coast (South to North)
  { key: 'kanyakumari', name: 'Kanyakumari Confluence', lat: 8.088, lon: 77.538, region: 'Tamil Nadu', sector: 'Sector 10' },
  { key: 'tuticorin', name: 'Gulf of Mannar / Thoothukudi', lat: 8.764, lon: 78.134, region: 'Tamil Nadu', sector: 'Sector 11' },
  { key: 'thoothukudi', name: 'Gulf of Mannar / Thoothukudi', lat: 8.764, lon: 78.134, region: 'Tamil Nadu', sector: 'Sector 11' },
  { key: 'rameswaram', name: 'Palk Bay / Rameswaram', lat: 9.288, lon: 79.313, region: 'Tamil Nadu', sector: 'Sector 11' },
  { key: 'nagapattinam', name: 'Nagapattinam Pelagic Shelf', lat: 10.767, lon: 79.843, region: 'Tamil Nadu', sector: 'Sector 12' },
  { key: 'chennai', name: 'Chennai Offshore Basin', lat: 13.083, lon: 80.283, region: 'Tamil Nadu', sector: 'Sector 13' },
  { key: 'tamil nadu', name: 'Tamil Nadu Basin (Chennai)', lat: 13.083, lon: 80.283, region: 'Tamil Nadu', sector: 'Sector 13' },
  { key: 'tamilnadu', name: 'Tamil Nadu Basin (Chennai)', lat: 13.083, lon: 80.283, region: 'Tamil Nadu', sector: 'Sector 13' },
  { key: 'kakinada', name: 'Godavari Delta / Kakinada Bay', lat: 16.989, lon: 82.247, region: 'Andhra Pradesh', sector: 'Sector 14' },
  { key: 'visakhapatnam', name: 'Visakhapatnam Deepwater Sector', lat: 17.687, lon: 83.218, region: 'Andhra Pradesh', sector: 'Sector 15' },
  { key: 'vizag', name: 'Visakhapatnam Deepwater Sector', lat: 17.687, lon: 83.218, region: 'Andhra Pradesh', sector: 'Sector 15' },
  { key: 'andhra', name: 'Andhra Coastal Waters (Vizag)', lat: 17.687, lon: 83.218, region: 'Andhra Pradesh', sector: 'Sector 15' },
  { key: 'andhra pradesh', name: 'Andhra Coastal Waters (Vizag)', lat: 17.687, lon: 83.218, region: 'Andhra Pradesh', sector: 'Sector 15' },
  { key: 'puri', name: 'Puri Coastal Waters', lat: 19.813, lon: 85.831, region: 'Odisha', sector: 'Sector 16' },
  { key: 'paradip', name: 'Paradip Marine Basin', lat: 20.260, lon: 86.670, region: 'Odisha', sector: 'Sector 17' },
  { key: 'odisha', name: 'Odisha Marine Waters (Paradip)', lat: 20.260, lon: 86.670, region: 'Odisha', sector: 'Sector 17' },
  { key: 'orissa', name: 'Odisha Marine Waters (Paradip)', lat: 20.260, lon: 86.670, region: 'Odisha', sector: 'Sector 17' },
  { key: 'kolkata', name: 'Bengal Shelf / Kolkata Maritime Approach', lat: 21.626, lon: 88.200, region: 'West Bengal', sector: 'Sector 18' },
  { key: 'calcutta', name: 'Bengal Shelf / Kolkata Maritime Approach', lat: 21.626, lon: 88.200, region: 'West Bengal', sector: 'Sector 18' },
  { key: 'digha', name: 'Digha Coast & Swatch of No Ground', lat: 21.550, lon: 87.550, region: 'West Bengal', sector: 'Sector 18' },
  { key: 'bengal', name: 'Bengal Shelf & Marine Waters', lat: 21.626, lon: 88.200, region: 'West Bengal', sector: 'Sector 18' },
  { key: 'west bengal', name: 'Bengal Shelf & Marine Waters', lat: 21.626, lon: 88.200, region: 'West Bengal', sector: 'Sector 18' },
  { key: 'sundarbans', name: 'Sundarbans Estuarine Delta', lat: 21.750, lon: 88.850, region: 'West Bengal', sector: 'Sector 19' },
  { key: 'port blair', name: 'Andaman Trench / Port Blair', lat: 11.623, lon: 92.726, region: 'Andaman & Nicobar', sector: 'Sector 20' },
  { key: 'andaman', name: 'Andaman Trench / Port Blair', lat: 11.623, lon: 92.726, region: 'Andaman & Nicobar', sector: 'Sector 20' },
];

export function LocationProvider({ children }) {
  const [currentLocation, setCurrentLocation] = useState(() => {
    const saved = localStorage.getItem('orca_current_location');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name && !/\b(to me|connecting road|unnamed|road not having)\b/i.test(parsed.name)) {
          return parsed;
        }
      } catch {}
    }
    return KNOWN_COASTAL_LOCATIONS.find(l => l.key === 'mangalore');
  });

  useEffect(() => {
    if (currentLocation) {
      localStorage.setItem('orca_current_location', JSON.stringify(currentLocation));
    }
  }, [currentLocation]);

  /**
   * Resolves place names in a natural language string or search query.
   * Matches user-centric phrases ("my area", "here"), known ports/states, then falls back to Nominatim OSM geocoder.
   */
  const resolveLocationFromText = async (text) => {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    // 1. Check for user-centric or conversational phrases that refer to current context
    if (/\b(safe house|save house|safe area|my house|home harbor|my port|home port|my area|my place|my location|my region|my sector|here|local|around me|nearest port|closest port|what is my|name of it|where am i|which waters)\b/i.test(lower)) {
      return currentLocation;
    }

    // 2. Direct match with known coastal locations & states
    for (const loc of KNOWN_COASTAL_LOCATIONS) {
      const regex = new RegExp(`\\b${loc.key}\\b`, 'i');
      if (regex.test(lower)) {
        setCurrentLocation(loc);
        return loc;
      }
    }

    // 3. Extract potential city/place keyword (e.g. "near Odisha", "in Goa", "around Mumbai")
    const match = lower.match(/(?:near|around|at|in|off|basin|harbor|port|visiting)\s+([a-zA-Z\s]{4,25})/i);
    const candidate = match ? match[1].trim() : '';

    if (candidate) {
      for (const loc of KNOWN_COASTAL_LOCATIONS) {
        if (loc.key.toLowerCase() === candidate.toLowerCase() || candidate.toLowerCase().includes(loc.key)) {
          setCurrentLocation(loc);
          return loc;
        }
      }

      // Filter out conversational stop words from Nominatim
      const STOP_WORDS = new Set(['me', 'it', 'in', 'to', 'for', 'at', 'near', 'around', 'area', 'place', 'name', 'house', 'port', 'fishing', 'fish', 'route', 'weather', 'safe', 'save', 'what', 'where', 'how', 'when', 'who', 'is', 'my', 'the', 'of', 'and']);
      if (!STOP_WORDS.has(candidate.toLowerCase()) && candidate.length >= 4) {
        try {
          const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(candidate)}&limit=1&countrycodes=in`;
          const res = await fetch(url, { headers: { 'User-Agent': NOMINATIM_UA } });
          if (res.ok) {
            const results = await res.json();
            if (results && results.length > 0) {
              const item = results[0];
              const lat = parseFloat(item.lat);
              const lon = parseFloat(item.lon);
              const displayName = item.display_name.split(',')[0].trim();
              if (displayName.length > 2 && displayName.length < 30 && !displayName.includes('road')) {
                const resolved = {
                  key: displayName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                  name: `${displayName} Coastal Waters`,
                  lat,
                  lon,
                  region: 'Indian EEZ',
                  sector: getSectorForLatLon(lat, lon),
                };
                setCurrentLocation(resolved);
                return resolved;
              }
            }
          }
        } catch (err) {
          console.warn('Geocoding query fallback failed:', err);
        }
      }
    }

    return null;
  };

  const syncFromSafeHouse = (safeHouse) => {
    if (!safeHouse) return;
    const matched = KNOWN_COASTAL_LOCATIONS.find(
      l => Math.abs(l.lat - safeHouse.lat) < 0.2 && Math.abs(l.lon - safeHouse.lon) < 0.2
    );
    if (matched) {
      setCurrentLocation(matched);
    } else {
      setCurrentLocation({
        key: 'custom-safehouse',
        name: safeHouse.label || 'Safe House Anchor',
        lat: safeHouse.lat,
        lon: safeHouse.lon,
        region: 'Coastal Waters',
        sector: getSectorForLatLon(safeHouse.lat, safeHouse.lon),
      });
    }
  };

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        setCurrentLocation,
        syncFromSafeHouse,
        resolveLocationFromText,
        knownLocations: KNOWN_COASTAL_LOCATIONS,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationState() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationState must be used within a LocationProvider');
  return ctx;
}

export function getSectorForLatLon(lat, lon) {
  // Approximate Indian EEZ numbered sectors 1 to 20
  if (lon < 75) {
    if (lat > 20) return 'Sector 1'; // Gujarat north
    if (lat > 18) return 'Sector 3'; // Maharashtra
    if (lat > 15) return 'Sector 5'; // Goa
    if (lat > 13) return 'Sector 6'; // Karnataka
    return 'Sector 7';
  } else if (lon < 80) {
    if (lat < 10) return 'Sector 9'; // Kerala South
    if (lat < 12) return 'Sector 8'; // Kerala North
    if (lat < 14) return 'Sector 11'; // Tamil Nadu South
    return 'Sector 12'; // Tamil Nadu North
  } else if (lon < 85) {
    if (lat < 15) return 'Sector 13'; // Chennai / Andhra
    return 'Sector 15'; // Vizag
  } else if (lon < 90) {
    if (lat > 21) return 'Sector 18'; // Bengal Shelf
    return 'Sector 17'; // Odisha / Paradip
  } else {
    return 'Sector 20'; // Andaman & Nicobar
  }
}
