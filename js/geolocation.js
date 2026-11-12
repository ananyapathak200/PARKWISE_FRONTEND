/*
  geolocation.js
  - requestLocation(): the browser's GPS
  - geocodeDestination(): place name -> coordinates (via the backend's /geocode, which asks OpenStreetMap)
  - locateAddress(): same, but falls back to a broader place when the exact one isn't known
  - reverseGeocode(): coordinates -> short place name
  - googleMapsDirectionsUrl(): turn-by-turn link
*/

const FALLBACK_LOCATION = { lat: 25.3176, lng: 82.9739 }; // Varanasi city centre

function requestLocation(onGranted, onFallback) {
  if (!navigator.geolocation) {
    onFallback(FALLBACK_LOCATION);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onGranted({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => onFallback(FALLBACK_LOCATION),
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

/* Returns { lat, lng, label } or null when nothing was found. Goes through the backend (GET /geocode). */
async function geocodeDestination(query) {
  return api.geocode(query);
}

/*
  For listing forms: tries the full address first, then simpler versions
  (last two parts, then just the city), because OpenStreetMap often doesn't
  know a small locality or a spelling. Returns { lat, lng, label, exact, matched }
  or null. exact === false means only a broader place was found.
*/
async function locateAddress(address) {
  const clean = address.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  const tries = [clean];
  if (parts.length > 2) tries.push(parts.slice(-2).join(", "));
  if (parts.length > 1) tries.push(parts[parts.length - 1]);

  for (let i = 0; i < tries.length; i++) {
    const place = await geocodeDestination(tries[i]);
    if (place) return { ...place, exact: i === 0, matched: tries[i] };
  }
  return null;
}

/* Returns e.g. "Sigra, Varanasi", or null if it can't be worked out. */
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const area = addr.suburb || addr.neighbourhood || addr.town || addr.village || addr.city_district;
    const city = addr.city || addr.town || addr.county;
    if (area && city && area !== city) return `${area}, ${city}`;
    if (city) return city;
    return data.display_name ? data.display_name.split(",").slice(0, 2).join(",") : null;
  } catch (err) {
    return null;
  }
}

function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}