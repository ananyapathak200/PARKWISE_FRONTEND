/*
  api.js
  Every backend call goes through here.
  API_BASE_URL picks itself: your local FastAPI server while you develop,
  and https://api.<your-domain> once the site is live (always HTTPS, so
  logins and payments are never sent unencrypted).
*/

const API_BASE_URL = (() => {
  const host = window.location.hostname;
  const local = !host || host === "localhost" || host === "127.0.0.1" || window.location.protocol === "file:";
  if (local) return "http://127.0.0.1:9000";
  return "https://api." + host.replace(/^www\./, "");
})();

function authHeaders() {
  const token = localStorage.getItem("parkwise_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* Turns a relative image path from the backend into a full URL. */
function imageUrl(path) {
  if (!path) return null;
  return /^https?:/i.test(path) ? path : API_BASE_URL + path;
}

function errorMessage(detail) {
  if (!detail) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // validation errors: include the field name, e.g. "latitude: Field required"
    return detail.map((d) => {
      const field = Array.isArray(d.loc) ? d.loc.filter((part) => part !== "body").join(".") : "";
      return field ? `${field}: ${d.msg}` : d.msg || JSON.stringify(d);
    }).join(" · ");
  }
  return "Something went wrong.";
}

async function handleResponse(res) {
  if (!res.ok) {
    let detail;
    try { detail = (await res.json()).detail; } catch (e) { /* no JSON body */ }
    const error = new Error(errorMessage(detail));
    error.status = res.status;
    // Expired / rejected session on a logged-in page: send the user back to login.
    // (FastAPI answers "Not authenticated" with 401 or 403 depending on the version.)
    const sessionRejected = res.status === 401 || (res.status === 403 && /not authenticated/i.test(error.message));
    if (sessionRejected && localStorage.getItem("parkwise_token") && !/login\.html$/.test(location.pathname)) {
      localStorage.clear();
      window.location.href = "login.html";
    }
    throw error;
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function request(path, { method = "GET", body, auth = false, formData } = {}) {
  const headers = auth ? { ...authHeaders() } : {};
  let payload;
  if (formData) {
    payload = formData; // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(API_BASE_URL + path, { method, headers, body: payload });
  } catch (e) {
    const error = new Error("Can't reach the ParkWise server. Make sure the backend is running.");
    error.status = 0;
    throw error;
  }
  return handleResponse(res);
}

const api = {
  // ---------- auth ----------
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, newPassword) =>
    request("/auth/reset-password", { method: "POST", body: { token, new_password: newPassword } }),
  getCurrentUser: () => request("/auth/me", { auth: true }),

  // ---------- geocoding (the backend calls OpenStreetMap, so the browser never has to) ----------
  geocode: (q) => request(`/geocode?q=${encodeURIComponent(q)}`),

  // ---------- parking areas ----------
  searchListings(lat, lng, filters = {}) {
    const params = new URLSearchParams();
    if (lat != null && lng != null) { params.set("lat", lat); params.set("lng", lng); }
    if (filters.maxPrice != null) params.set("max_price", filters.maxPrice);
    if (filters.vehicleType) params.set("vehicle_type", filters.vehicleType);
    return request(`/parking-areas?${params.toString()}`);
  },
  getListing(id, lat, lng) {
    const params = new URLSearchParams();
    if (lat != null && lng != null) { params.set("lat", lat); params.set("lng", lng); }
    return request(`/parking-areas/${id}?${params.toString()}`);
  },
  getMyListings: () => request("/parking-areas/mine", { auth: true }),
  getOwnerSummary: () => request("/parking-areas/mine/summary", { auth: true }),
  createListing: (payload) => request("/parking-areas", { method: "POST", body: payload, auth: true }),
  uploadListingPhoto(id, file) {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/parking-areas/${id}/photo`, { method: "POST", formData, auth: true });
  },
  updateListing: (id, payload) => request(`/parking-areas/${id}`, { method: "PATCH", body: payload, auth: true }),
  deleteListing: (id) => request(`/parking-areas/${id}`, { method: "DELETE", auth: true }),
  getListingSlots: (id) => request(`/parking-areas/${id}/slots`, { auth: true }),

  // ---------- bookings ----------
  createBooking: (payload) => request("/bookings", { method: "POST", body: payload, auth: true }),
  checkIn: (bookingId) => request(`/bookings/${bookingId}/checkin`, { method: "POST", auth: true }),
  checkOut: (bookingId) => request(`/bookings/${bookingId}/checkout`, { method: "POST", auth: true }),
  verifyPayment: (bookingId, payload) =>
    request(`/bookings/${bookingId}/verify-payment`, { method: "POST", body: payload, auth: true }),
  getMyBookings: () => request("/bookings/mine", { auth: true }),

  // ---------- reviews ----------
  submitReview: (bookingId, rating, comment) =>
    request(`/bookings/${bookingId}/review`, { method: "POST", body: { rating, comment: comment || null }, auth: true }),
  getListingReviews: (areaId) => request(`/parking-areas/${areaId}/reviews`),

  // ---------- admin ----------
  getAdminStats: () => request("/admin/stats", { auth: true }),
  getPendingListings: () => request("/admin/pending-listings", { auth: true }),
  approveListing: (id) => request(`/admin/parking-areas/${id}/approve`, { method: "PATCH", auth: true }),
  rejectListing: (id) => request(`/admin/parking-areas/${id}/reject`, { method: "PATCH", auth: true }),
};