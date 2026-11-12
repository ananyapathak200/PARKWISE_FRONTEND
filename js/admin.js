/* admin.js — platform stats and the approval queue */
(function () {
  if (!requireRole("admin")) return;

  const statsEl = document.getElementById("admin-stats");
  const pendingEl = document.getElementById("admin-pending");

  async function loadStats() {
    try {
      const s = await api.getAdminStats();
      statsEl.innerHTML =
        renderStatTile(s.total_listings, "Total listings") +
        renderStatTile(s.approved, "Approved") +
        renderStatTile(s.active_bookings, "Active bookings") +
        renderStatTile(formatINR(s.revenue), "Revenue collected");
    } catch (err) {
      statsEl.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  async function loadPending() {
    try {
      const pending = await api.getPendingListings();
      if (!pending || pending.length === 0) {
        pendingEl.innerHTML = '<div class="empty">Nothing waiting on approval.</div>';
        return;
      }
      pendingEl.innerHTML = pending.map((l) => `
        <div class="ticket">
          <div class="ticket-stub"><div class="stub-figure">${escapeHtml(l.total_slots)}</div><div class="stub-unit">slots</div></div>
          <div class="ticket-body">
            <div><div class="listing-name">${escapeHtml(l.name)}</div><div class="listing-meta">${escapeHtml(l.address)} · ₹${escapeHtml(l.price_per_hour)}/hr</div></div>
            <div class="ticket-price">
              <button type="button" data-action="approve" data-id="${escapeHtml(l.id)}">Approve</button>
              <button type="button" class="danger" data-action="reject" data-id="${escapeHtml(l.id)}">Reject</button>
            </div>
          </div>
        </div>`).join("");
    } catch (err) {
      pendingEl.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  pendingEl.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "reject" && !confirm("Reject this listing?")) return;
    button.disabled = true;
    try {
      await (action === "approve" ? api.approveListing(id) : api.rejectListing(id));
      loadStats();
      loadPending();
    } catch (err) {
      button.disabled = false;
      alert(err.message || `Couldn't ${action} the listing.`);
    }
  });

  loadStats();
  loadPending();
})();
