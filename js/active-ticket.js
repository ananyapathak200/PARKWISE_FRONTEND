/*
  active-ticket.js
  Shows the QR token for a reserved booking and handles check-in.
  Other statuses are sent to the page that matches them.
*/
(function () {
  if (!requireLogin()) return;

  const bookingId = new URLSearchParams(window.location.search).get("bookingId");
  const container = document.getElementById("ticket-container");

  async function loadTicket() {
    if (!bookingId) {
      container.innerHTML = '<div class="empty">No booking specified.</div>';
      return;
    }
    try {
      const bookings = await api.getMyBookings();
      const booking = bookings.find((b) => String(b.id) === bookingId);
      if (!booking) {
        container.innerHTML = '<div class="empty">Booking not found.</div>';
        return;
      }

      if (booking.status === "checked_in") { window.location.href = `checkout.html?bookingId=${encodeURIComponent(bookingId)}`; return; }
      if (booking.status === "completed") { window.location.href = `receipt.html?bookingId=${encodeURIComponent(bookingId)}`; return; }

      if (booking.status === "cancelled") {
        container.innerHTML = `
          <div class="panel"><div class="panel-head">Booking</div><div class="panel-body">
            ${renderStatusPill("cancelled")}
            <p style="font-size:13px; color:var(--muted); margin-top:8px;">
              This reservation was auto-cancelled because it wasn't checked in within 15 minutes of the start time. The slot has been released.
            </p>
            <a href="find-parking.html" class="btn">Find another spot</a>
          </div></div>`;
        return;
      }

      container.innerHTML = `
        <div class="panel"><div class="panel-head">Booking</div><div class="panel-body">
          ${renderStatusPill(booking.status)}
          <div class="listing-meta">${escapeHtml(booking.vehicle_number)} · ${escapeHtml(formatDate(booking.start_time))}, ${escapeHtml(formatTime(booking.start_time))} – ${escapeHtml(formatTime(booking.end_time))}</div>
          <p style="font-size:13px; color:var(--muted); margin-top:12px;">Show this code at the gate to check in.</p>
          ${renderQrGrid(String(booking.qr_code_token || booking.id))}
          <div class="token">${escapeHtml(booking.qr_code_token || booking.id)}</div>
          <div class="form-error" id="checkin-error"></div>
          <div><button type="button" id="checkin-btn">Check in</button></div>
          <div class="callout callout-amber">Unclaimed reservations auto-cancel after 15 minutes.</div>
        </div></div>`;

      const button = document.getElementById("checkin-btn");
      button.addEventListener("click", async () => {
        const errorEl = document.getElementById("checkin-error");
        errorEl.classList.remove("visible");
        setBusy(button, true, "Checking in…");
        try {
          await api.checkIn(bookingId);
          window.location.href = `checkout.html?bookingId=${encodeURIComponent(bookingId)}`;
        } catch (err) {
          errorEl.textContent = err.message || "Couldn't check in.";
          errorEl.classList.add("visible");
          setBusy(button, false);
        }
      });
    } catch (err) {
      container.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  loadTicket();
})();
