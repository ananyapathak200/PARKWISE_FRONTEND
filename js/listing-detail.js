/* listing-detail.js — one parking listing: slots, price, reviews, book / navigate */
(function () {
  if (!requireLogin()) return;

  const container = document.getElementById("listing-container");
  const back = '<a href="find-parking.html" class="fine-print">&larr; Back to search</a>';

  async function loadListing() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      container.innerHTML = `${back}<div class="empty">No listing specified.</div>`;
      return;
    }
    try {
      const l = await api.getListing(id);
      document.title = `ParkWise — ${l.name}`;
      const img = imageUrl(l.image_url);
      const reviews = l.avg_rating != null
        ? `<span style="color:var(--amber-dark); font-weight:700;">★ ${escapeHtml(l.avg_rating)}</span> (${escapeHtml(l.review_count)} review${l.review_count === 1 ? "" : "s"})`
        : "No reviews yet";

      container.innerHTML = `
        ${back}
        <h1 style="margin-top:14px;">${escapeHtml(l.name)}</h1>
        <p class="subtitle">${escapeHtml(l.address)}${l.distance_km != null ? ` · ${escapeHtml(l.distance_km)} km away` : ""}</p>
        <p class="subtitle" style="margin-top:-14px;">${reviews}</p>

        <div class="panel"><div class="panel-body">
          ${img ? `<img src="${escapeHtml(img)}" style="width:100%; height:180px; object-fit:cover; border-radius:10px; margin-bottom:14px;" alt="${escapeHtml(l.name)}" onerror="this.style.display='none';" />` : ""}
          <span class="status-pill ${l.available_slots > 0 ? "pill-go" : "pill-stop"}"><i></i>${escapeHtml(l.available_slots)} of ${escapeHtml(l.total_slots)} slots open</span>

          <div class="form-row" style="margin-top:6px;">
            <div>
              <label>Price</label>
              <div style="font-family:var(--font-display); font-size:24px; font-weight:800;">₹${escapeHtml(l.price_per_hour)}<span style="font-size:12px; font-weight:400; color:var(--muted);">/hr</span></div>
            </div>
            <div>
              <label>Open hours</label>
              <div style="font-size:14px; padding-top:4px;">${escapeHtml(l.opening_time || "—")} – ${escapeHtml(l.closing_time || "—")}</div>
            </div>
          </div>

          <label>Slot availability</label>
          <div class="slot-dots" style="margin-top:2px;">${renderSlotDots(l.total_slots, l.available_slots)}</div>

          ${l.available_slots > 0
            ? `<a href="booking.html?areaId=${encodeURIComponent(l.id)}" class="btn full-width" style="margin-top:20px;">Book this spot</a>`
            : `<button type="button" class="full-width" disabled style="margin-top:20px;">Fully booked</button>`}
          <a href="${googleMapsDirectionsUrl(l.latitude, l.longitude)}" target="_blank" rel="noopener" class="btn secondary full-width" style="margin-top:8px;">Navigate with Google Maps</a>
        </div></div>

        <h3>Reviews</h3>
        <div id="reviews-container" class="panel"><div class="panel-body"><div class="empty">Loading reviews…</div></div></div>`;
      loadReviews(id);
    } catch (err) {
      container.innerHTML = `${back}<div class="empty">Couldn't load this listing — ${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadReviews(areaId) {
    const el = document.getElementById("reviews-container");
    try {
      const reviews = await api.getListingReviews(areaId);
      if (!reviews || reviews.length === 0) {
        el.innerHTML = '<div class="panel-body"><div class="empty">No reviews yet — be the first to park here and leave one.</div></div>';
        return;
      }
      el.innerHTML = reviews.map((r) => `
        <div class="panel-body" style="border-bottom:1px solid var(--border);">
          <div class="stars readonly">${[1, 2, 3, 4, 5].map((n) => `<span class="star ${n <= r.rating ? "filled" : ""}">★</span>`).join("")}</div>
          ${r.comment ? `<p style="font-size:13.5px; margin:6px 0 0;">${escapeHtml(r.comment)}</p>` : ""}
          <p class="fine-print" style="margin-top:4px;">${escapeHtml(formatDate(r.created_at))}</p>
        </div>`).join("");
    } catch (err) {
      el.innerHTML = `<div class="panel-body"><div class="empty">${escapeHtml(err.message)}</div></div>`;
    }
  }

  loadListing();
})();
