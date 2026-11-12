/*
  booking.js
  Loads the listing, then submits the booking form to POST /bookings
  using the listing's first available slot.
*/
(function () {
  if (!requireLogin()) return;

  const $ = (id) => document.getElementById(id);
  const areaId = new URLSearchParams(window.location.search).get("areaId");
  let currentListing = null;

  // sensible defaults: next quarter-hour, for two hours (capped at midnight)
  function setDefaults() {
    const start = new Date();
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
    const end = new Date(start.getTime() + 2 * 3600000);
    $("booking-date").value = localDateValue(start);
    $("booking-date").min = localDateValue(new Date());
    $("booking-start").value = localTimeValue(start);
    $("booking-end").value = end.getDate() === start.getDate() ? localTimeValue(end) : "23:59";
  }

  async function loadListing() {
    setDefaults();
    if (!areaId) {
      $("booking-subtitle").textContent = "No listing specified.";
      $("booking-submit").disabled = true;
      return;
    }
    try {
      currentListing = await api.getListing(areaId);
      $("booking-title").textContent = currentListing.name;
      $("booking-subtitle").textContent = `${currentListing.address} · ₹${currentListing.price_per_hour}/hr`;
    } catch (err) {
      $("booking-subtitle").textContent = "Couldn't load this listing.";
      $("booking-submit").disabled = true;
    }
  }

  $("booking-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = $("booking-error");
    const button = $("booking-submit");
    errorEl.classList.remove("visible");

    const fail = (msg) => { errorEl.textContent = msg; errorEl.classList.add("visible"); };

    if (!currentListing || !currentListing.first_available_slot_id) {
      return fail("No available slot on this listing right now.");
    }
    const date = $("booking-date").value;
    const start = $("booking-start").value;
    const end = $("booking-end").value;
    if (end <= start) return fail("End time must be after the start time.");

    setBusy(button, true, "Booking…");
    try {
      const booking = await api.createBooking({
        slot_id: currentListing.first_available_slot_id,
        vehicle_number: $("booking-vehicle").value.trim().toUpperCase(),
        start_time: `${date}T${start}:00`,
        end_time: `${date}T${end}:00`,
      });
      window.location.href = `active-ticket.html?bookingId=${encodeURIComponent(booking.id)}`;
    } catch (err) {
      fail(err.message || "Couldn't create the booking.");
      setBusy(button, false);
    }
  });

  loadListing();
})();
