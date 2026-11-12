/* edit-listing.js — change or delete one of the owner's listings (?id=...) */
(function () {
  if (!requireRole("owner")) return;

  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(window.location.search).get("id");
  const form = $("edit-listing-form");
  const errorEl = $("edit-error");
  const successEl = $("edit-success");
  let originalAddress = "";

  async function load() {
    if (!id) { $("edit-body").innerHTML = '<div class="empty">No listing specified.</div>'; return; }
    try {
      const l = await api.getListing(id);
      originalAddress = l.address || "";
      $("listing-heading").textContent = l.name;
      $("listing-status").innerHTML = renderStatusPill(l.status);
      $("listing-name").value = l.name || "";
      $("listing-address").value = l.address || "";
      $("listing-price").value = l.price_per_hour ?? "";
      $("listing-slots").value = l.total_slots ?? "";
      $("slots-link").href = `slot-status.html?id=${encodeURIComponent(id)}`;
      form.hidden = false;
    } catch (err) {
      $("edit-body").innerHTML = `<div class="empty">Couldn't load this listing — ${escapeHtml(err.message)}</div>`;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    successEl.hidden = true;
    const button = $("save-btn");
    const fail = (msg) => { errorEl.textContent = msg; errorEl.classList.add("visible"); setBusy(button, false); };

    const address = $("listing-address").value.trim();
    const payload = {
      name: $("listing-name").value.trim(),
      address,
      price_per_hour: parseFloat($("listing-price").value),
      total_slots: parseInt($("listing-slots").value, 10),
    };
    if (!(payload.price_per_hour > 0)) return fail("Enter a price per hour greater than 0.");
    if (!(payload.total_slots >= 1)) return fail("You need at least 1 slot.");

    setBusy(button, true, "Saving…");
    try {
      // a new address needs new coordinates, otherwise nearby search would use the old spot
      if (address !== originalAddress) {
        let place = null;
        try { place = await locateAddress(address); } catch (err) { /* lookup unavailable — save anyway */ }
        if (place) {
          payload.latitude = place.lat;
          payload.longitude = place.lng;
        }
      }
      await api.updateListing(id, payload);
      originalAddress = address;
      $("listing-heading").textContent = payload.name;
      successEl.textContent = "Changes saved.";
      successEl.hidden = false;
      setBusy(button, false);
    } catch (err) {
      fail(err.message || "Couldn't save your changes.");
    }
  });

  $("delete-listing-btn").addEventListener("click", async () => {
    if (!confirm("Delete this listing? This can't be undone.")) return;
    const button = $("delete-listing-btn");
    setBusy(button, true, "Deleting…");
    try {
      await api.deleteListing(id);
      window.location.href = "dashboard.html";
    } catch (err) {
      errorEl.textContent = err.message || "Couldn't delete the listing.";
      errorEl.classList.add("visible");
      setBusy(button, false);
    }
  });

  load();
})();