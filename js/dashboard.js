/*
  dashboard.js  (dashboard.html — the owner's home)
  Stats, recent activity, the "list a new space" form and "my listings".

  New listings need coordinates for nearby search, so the typed address
  is turned into latitude / longitude with geocodeDestination().

  getOwnerSummary() is read defensively (see readSummary) — if your
  backend names the fields differently, adjust that one function.
*/
(function () {
  if (!requireRole("owner")) return;

  const $ = (id) => document.getElementById(id);
  const asList = (x) => (Array.isArray(x) ? x : (x && (x.items || x.listings)) || []);
  const pick = (obj, keys, fallback = null) => { for (const k of keys) if (obj && obj[k] != null) return obj[k]; return fallback; };
  const num = (v) => Number(v) || 0;

  // ---------- stats + activity ----------
  function readSummary(summary, listings) {
    const withAvailability = listings.filter((l) => l.available_slots != null);
    return {
      listings: pick(summary, ["total_listings", "listings"], listings.length),
      slots: pick(summary, ["total_slots", "slots"], listings.reduce((n, l) => n + num(l.total_slots), 0)),
      occupied: pick(summary, ["occupied_now", "occupied_slots", "occupied"], withAvailability.reduce((n, l) => n + Math.max(0, num(l.total_slots) - num(l.available_slots)), 0)),
      revenueToday: pick(summary, ["revenue_today", "today_revenue", "todays_revenue", "revenue"], 0),
      activity: asList(pick(summary, ["recent_activity", "activity", "recent_bookings", "recent"], [])),
    };
  }

  function renderStats(s) {
    $("owner-stats").innerHTML =
      renderStatTile(s.listings, "Total listings") +
      renderStatTile(s.slots, "Total slots") +
      renderStatTile(s.occupied, "Occupied right now") +
      renderStatTile(formatINR(s.revenueToday), "Today's revenue");
  }

  function renderActivity(items) {
    const el = $("recent-activity");
    if (!items.length) { el.innerHTML = '<div class="empty">No bookings on your spaces yet.</div>'; return; }
    const dot = { completed: "go", checked_in: "go", reserved: "amber", cancelled: "stop" };
    el.innerHTML = items.slice(0, 8).map((a) => {
      const title = pick(a, ["listing_name", "area_name", "parking_area_name", "name", "title"], "Booking");
      const when = pick(a, ["created_at", "start_time", "time"]);
      const amount = pick(a, ["amount"]);
      return `<div class="activity-row">
        <span class="activity-dot activity-dot-${dot[a.status] || "amber"}"></span>
        <div class="activity-main">
          <div class="activity-title">${escapeHtml(title)} <span class="activity-muted">${a.vehicle_number ? "· " + escapeHtml(a.vehicle_number) : ""}</span></div>
          ${when ? `<div class="activity-time">${escapeHtml(formatDate(when))}, ${escapeHtml(formatTime(when))}</div>` : ""}
        </div>
        <div class="activity-right">${a.status ? renderStatusPill(a.status) : ""}${amount != null ? `<div class="activity-amount">${escapeHtml(formatINR(amount))}</div>` : ""}</div>
      </div>`;
    }).join("");
  }

  // ---------- my listings ----------
  function renderListings(listings) {
    const el = $("owner-listings");
    if (!listings.length) { el.innerHTML = '<div class="empty">You haven\'t listed a space yet. Use the form above to add your first one.</div>'; return; }
    el.innerHTML = listings.map((l) => {
      const id = encodeURIComponent(l.id);
      return renderTicketCard({
        figure: l.total_slots,
        unit: "slots",
        metaLine: renderStatusPill(l.status),
        name: l.name,
        address: l.address,
        dots: l.available_slots != null ? renderSlotDots(l.total_slots, l.available_slots) : "",
        price: l.price_per_hour,
        photoUrl: imageUrl(l.image_url),
        avgRating: l.avg_rating,
        reviewCount: l.review_count,
        actionHtml: `<a href="slot-status.html?id=${id}" class="btn">Slots</a><br/><a href="edit-listing.html?id=${id}" class="btn secondary">Edit</a>`,
      });
    }).join("");
  }

  async function loadAll() {
    const [listingsRes, summaryRes] = await Promise.allSettled([api.getMyListings(), api.getOwnerSummary()]);
    const listings = listingsRes.status === "fulfilled" ? asList(listingsRes.value) : [];
    const summary = summaryRes.status === "fulfilled" ? summaryRes.value || {} : {};

    const s = readSummary(summary, listings);
    renderStats(s);
    renderActivity(s.activity);
    if (listingsRes.status === "rejected") {
      $("owner-listings").innerHTML = `<div class="empty">Couldn't load your listings — ${escapeHtml(listingsRes.reason.message)}</div>`;
    } else {
      renderListings(listings);
    }
  }

  // ---------- new listing form ----------
  const form = $("new-listing-form");
  const errorEl = $("listing-error");
  const successEl = $("listing-success");
  const MAX_PHOTO = 5 * 1024 * 1024;

  $("listing-photo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const hint = $("photo-hint");
    if (!file) { hint.textContent = "JPEG, PNG, or WEBP — under 5 MB."; return; }
    hint.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    successEl.hidden = true;
    const fail = (msg) => { errorEl.textContent = msg; errorEl.classList.add("visible"); setBusy(button, false); };
    const button = $("listing-submit");

    const address = $("listing-address").value.trim();
    const price = parseFloat($("listing-price").value);
    const slots = parseInt($("listing-slots").value, 10);
    const photo = $("listing-photo").files[0];

    if (!(price > 0)) return fail("Enter a price per hour greater than 0.");
    if (!(slots >= 1)) return fail("You need at least 1 slot.");
    if (photo && !/^image\/(jpeg|png|webp)$/.test(photo.type)) return fail("The photo must be a JPEG, PNG or WEBP image.");
    if (photo && photo.size > MAX_PHOTO) return fail("The photo is larger than 5 MB.");

    setBusy(button, true, "Submitting…");
    try {
      // Finding the exact map spot must never block a listing: if the lookup fails,
      // the space is placed at the city centre and the admin checks the address.
      let place = null;
      try { place = await locateAddress(address); } catch (err) { /* lookup unavailable — carry on */ }
      const coords = place || FALLBACK_LOCATION;

      const created = await api.createListing({
        name: $("listing-name").value.trim(),
        address,
        price_per_hour: price,
        total_slots: slots,
        slots, // some backends name the field "slots" — extra fields are ignored if unused
        latitude: coords.lat,
        longitude: coords.lng,
        opening_time: $("listing-open").value,
        closing_time: $("listing-close").value,
        vehicle_type: $("listing-vehicle-type").value,
      });

      let note = "Submitted for approval — it will show up in search once an admin approves it.";
      if (!place || !place.exact) note += " The exact map spot couldn't be found, so the admin will check the address.";
      if (photo) {
        try { await api.uploadListingPhoto(created.id, photo); }
        catch (err) { note += ` (The photo couldn't be uploaded: ${err.message})`; }
      }
      form.reset();
      $("photo-hint").textContent = "JPEG, PNG, or WEBP — under 5 MB.";
      successEl.textContent = note;
      successEl.hidden = false;
      setBusy(button, false);
      loadAll();
    } catch (err) {
      fail(err.message || "Couldn't submit the listing.");
    }
  });

  loadAll();
})();