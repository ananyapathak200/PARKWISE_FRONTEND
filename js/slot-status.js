/* slot-status.js — live slot grid for one listing (?id=...) */
(function () {
  if (!requireRole("owner")) return;

  const $ = (id) => document.getElementById(id);
  const areaId = new URLSearchParams(window.location.search).get("id");

  async function loadSlots() {
    const grid = $("slot-grid");
    if (!areaId) { grid.innerHTML = '<div class="empty">No listing specified.</div>'; return; }
    try {
      const listing = await api.getListing(areaId);
      $("listing-name").textContent = listing.name;
      $("listing-summary").textContent = `${listing.address} · ${listing.available_slots} of ${listing.total_slots} slots open right now`;

      const slots = await api.getListingSlots(areaId);
      grid.innerHTML = slots.length
        ? slots.map((s) => `<div class="slot-chip slot-chip-${escapeHtml(s.status)}">
            <div class="slot-num">${escapeHtml(s.slot_number)}</div>
            <div class="slot-status">${escapeHtml(s.status)}</div></div>`).join("")
        : '<div class="empty">This listing has no slots yet.</div>';
    } catch (err) {
      grid.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  $("refresh-btn").addEventListener("click", loadSlots);
  loadSlots();
  setInterval(loadSlots, 20000); // keep the grid fresh while the page is open
})();
