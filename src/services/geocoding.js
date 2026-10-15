/**
 * Geocoding Service for Overland Park, Kansas
 * Nominatim OpenStreetMap Search and Reverse Geocoding with local caching and bounding.
 */

const OVERLAND_PARK_VIEWBOX = '-94.78,38.80,-94.62,39.02';

// In-memory cache to avoid redundant network requests
const geocodeCache = new Map();

/**
 * Search addresses specifically biased towards Overland Park, KS
 */
export async function searchAddress(query) {
  if (!query || query.trim().length < 3) return [];

  const cleanQuery = query.trim();
  const cacheKey = `search:${cleanQuery.toLowerCase()}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    // Add context if not specified
    let searchQuery = cleanQuery;
    if (!/overland park|kansas|ks/i.test(searchQuery)) {
      searchQuery += ', Overland Park, KS';
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&viewbox=${OVERLAND_PARK_VIEWBOX}&bounded=0&limit=6&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'FreshRouteOverlandParkApp/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const results = await resp.json();
      const parsed = results.map(item => {
        const addr = item.address || {};
        const houseNumber = addr.house_number || '';
        const road = addr.road || addr.street || item.name || '';
        const suburb = addr.suburb || addr.neighbourhood || '';
        const postcode = addr.postcode || '66212';
        const shortDisplay = [houseNumber, road].filter(Boolean).join(' ') || item.name || 'Overland Park Location';
        const fullDisplay = `${shortDisplay}, Overland Park, KS ${postcode}`;

        return {
          displayName: item.display_name,
          shortAddress: shortDisplay,
          fullAddress: fullDisplay,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type
        };
      });

      geocodeCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn('Geocoding search failed:', err);
  }

  return [];
}

/**
 * Reverse geocode a latitude/longitude point to an address in Overland Park
 */
export async function reverseGeocode(lat, lng) {
  const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'FreshRouteOverlandParkApp/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};
      const houseNum = addr.house_number || '';
      const road = addr.road || addr.pedestrian || 'Residential Way';
      const postcode = addr.postcode || '66212';

      const shortAddress = houseNum ? `${houseNum} ${road}` : road;
      const fullAddress = `${shortAddress}, Overland Park, KS ${postcode}`;

      const res = {
        shortAddress,
        fullAddress,
        lat,
        lng
      };

      geocodeCache.set(cacheKey, res);
      return res;
    }
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
  }

  // Graceful fallback coordinate label
  return {
    shortAddress: `Stop at (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    fullAddress: `Near Overland Park, KS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    lat,
    lng
  };
}
