/*
  driver-dashboard.js  (search.html — the driver's home)
  Built entirely from GET /bookings/mine: the active / upcoming ticket
  with a live countdown, three stats and the five latest bookings.
*/
(function () {
  if (!requireRole("driver")) return;

  const $ = (id) => document.getElementById(id);
  let timer = null;

  const ICON = {
    navigate: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Z"/></svg>',
    exit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  };

  // the booking object may carry the listing name under a few different keys
  const pick = (obj, keys) => { for (const k of keys) if (obj && obj[k] != null && obj[k] !== "") return obj[k]; return null; };
  const placeName = (b) => pick(b, ["parking_area_name", "listing_name", "area_name", "place_name"]) || (b.parking_area && b.parking_area.name) || null;
  const areaId = (b) => pick(b, ["parking_area_id", "area_id", "listing_id"]) || (b.parking_area && b.parking_area.id) || null;
  const hoursOf = (b) => Math.max(0, (new Date(b.end_time) - new Date(b.start_time)) / 3600000);

  function pickActive(bookings) {
    const now = Date.now();
    const running = bookings.filter((b) => b.status === "checked_in").sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    if (running.length) return running[0];
    const upcoming = bookings.filter((b) => b.status === "reserved" && new Date(b.end_time) > now).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    return upcoming[0] || null;
  }

  // ---------- active ticket ----------
  async function renderActive(b) {
    const card = $("pd-active");
    const empty = $("pd-empty");
    if (!b) { card.hidden = true; empty.hidden = false; return; }
    empty.hidden = true;
    card.hidden = false;

    const running = b.status === "checked_in";
    const id = encodeURIComponent(b.id);
    const live = $("pd-live");
    live.className = `pd-live${running ? "" : " is-reserved"}`;
    live.innerHTML = `<i></i>${running ? "Active now" : "Reserved"}`;

    $("pd-active-place").textContent = placeName(b) || "Parking booking";
    $("pd-active-meta").textContent = `${b.vehicle_number} · ${formatDate(b.start_time)}, ${formatTime(b.start_time)} – ${formatTime(b.end_time)}`;

    // try to enrich with listing name + coordinates (for the Navigate button)
    let coords = pick(b, ["latitude", "lat"]) != null ? { lat: pick(b, ["latitude", "lat"]), lng: pick(b, ["longitude", "lng"]) } : null;
    const listingId = areaId(b);
    if (listingId) {
      try {
        const listing = await api.getListing(listingId);
        $("pd-active-place").textContent = listing.name;
        $("pd-active-meta").textContent = `${listing.address} · ${b.vehicle_number}`;
        if (listing.latitude != null) coords = { lat: listing.latitude, lng: listing.longitude };
      } catch (err) { /* keep the generic text */ }
    }

    const link = (href, label, icon, primary, external) =>
      `<a href="${href}" class="pd-btn${primary ? " pd-btn--primary" : ""}"${external ? ' target="_blank" rel="noopener"' : ""}>${icon}${label}</a>`;
    $("pd-actions").innerHTML =
      (running ? link(`checkout.html?bookingId=${id}`, "Check out", ICON.exit, true) : link(`active-ticket.html?bookingId=${id}`, "Show QR &amp; check in", ICON.ticket, true)) +
      (coords ? link(googleMapsDirectionsUrl(coords.lat, coords.lng), "Navigate", ICON.navigate, false, true) : "");

    startCountdown(b, running);
  }

  function startCountdown(b, running) {
    const card = $("pd-active");
    const start = new Date(b.start_time).getTime();
    const end = new Date(b.end_time).getTime();
    if (timer) clearInterval(timer);

    function tick() {
      const now = Date.now();
      const beforeStart = !running && now < start;
      const target = beforeStart ? start : end;
      const left = Math.max(0, target - now);
      const s = Math.floor(left / 1000);
      $("pd-time-label").textContent = beforeStart ? "Starts in" : "Time left";
      $("pd-time").textContent = `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
      const progress = running ? Math.min(100, Math.round(((now - start) / Math.max(1, end - start)) * 100)) : 0;
      $("pd-bar-fill").style.width = `${Math.max(0, progress)}%`;
      card.classList.toggle("is-expired", left === 0 && !beforeStart);
      if (left === 0 && !beforeStart) clearInterval(timer);
    }
    tick();
    timer = setInterval(tick, 1000);
  }

  // ---------- stats ----------
  function renderStats(bookings) {
    const done = bookings.filter((b) => b.status === "completed");
    $("pd-stat-bookings").textContent = bookings.length;
    $("pd-stat-hours").textContent = `${Math.round(done.reduce((n, b) => n + hoursOf(b), 0) * 10) / 10} h`;
    $("pd-stat-spent").textContent = formatINR(done.reduce((n, b) => n + (Number(b.amount) || 0), 0));
  }

  // ---------- recent bookings ----------
  const CHIP = {
    completed: ["Completed", ""],
    checked_in: ["Active", "pd-chip--active"],
    reserved: ["Reserved", "pd-chip--reserved"],
    cancelled: ["Cancelled", "pd-chip--cancelled"],
  };

  function rowHref(b) {
    const id = encodeURIComponent(b.id);
    if (b.status === "completed") return `receipt.html?bookingId=${id}`;
    if (b.status === "checked_in") return `checkout.html?bookingId=${id}`;
    if (b.status === "reserved") return `active-ticket.html?bookingId=${id}`;
    return "booking-history.html";
  }

  function renderRecent(bookings) {
    const box = $("pd-recent");
    if (bookings.length === 0) {
      box.innerHTML = '<p class="pd-none">No bookings yet. <a href="find-parking.html">Find a spot</a> to get started.</p>';
      return;
    }
    const latest = [...bookings].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 5);
    box.innerHTML = latest.map((b) => {
      const [label, cls] = CHIP[b.status] || [b.status, ""];
      return `<a class="pd-row" href="${rowHref(b)}">
        <div><span class="pd-row__name">${escapeHtml(placeName(b) || b.vehicle_number)}</span>
          <span class="pd-row__sub">${escapeHtml(b.vehicle_number)} · ${escapeHtml(formatDate(b.start_time))}</span></div>
        <span class="pd-row__amt">${b.amount != null ? escapeHtml(formatINR(b.amount)) : "—"}</span>
        <span class="pd-chip ${cls}">${escapeHtml(label)}</span>
      </a>`;
    }).join("");
  }

  async function init() {
    try {
      const bookings = await api.getMyBookings();
      renderStats(bookings);
      renderRecent(bookings);
      const lastDone = bookings.filter((b) => b.status === "completed").sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
      if (lastDone) $("pd-receipts-link").href = `receipt.html?bookingId=${encodeURIComponent(lastDone.id)}`;
      await renderActive(pickActive(bookings));
    } catch (err) {
      $("pd-empty").hidden = false;
      $("pd-recent").innerHTML = `<p class="pd-none">Couldn't load your bookings — ${escapeHtml(err.message)}</p>`;
    }
  }

  init();
})();
