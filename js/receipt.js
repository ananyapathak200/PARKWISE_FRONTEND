/*
  receipt.js
  Final bill for a completed booking, plus a star rating and optional
  comment (POST /bookings/{id}/review).
*/
(function () {
  if (!requireLogin()) return;

  const bookingId = new URLSearchParams(window.location.search).get("bookingId");
  const container = document.getElementById("receipt-container");
  let selectedRating = 0;

  async function loadReceipt() {
    if (!bookingId) { container.innerHTML = '<div class="empty">No booking specified.</div>'; return; }
    try {
      const bookings = await api.getMyBookings();
      const booking = bookings.find((b) => String(b.id) === bookingId);
      if (!booking) { container.innerHTML = '<div class="empty">Booking not found.</div>'; return; }

      if (booking.status === "reserved") { window.location.href = `active-ticket.html?bookingId=${encodeURIComponent(bookingId)}`; return; }
      if (booking.status === "checked_in") { window.location.href = `checkout.html?bookingId=${encodeURIComponent(bookingId)}`; return; }

      const hours = Math.max(0, (new Date(booking.end_time) - new Date(booking.start_time)) / 3600000).toFixed(1);
      const completed = booking.status === "completed";

      container.innerHTML = `
        <div class="receipt">
          <h3>Parking session</h3>
          <div class="receipt-row"><span>VEHICLE</span><span>${escapeHtml(booking.vehicle_number)}</span></div>
          <div class="receipt-row"><span>DATE</span><span>${escapeHtml(formatDate(booking.start_time))}</span></div>
          <div class="receipt-row"><span>SCHEDULED</span><span>${hours} hr</span></div>
          <div class="receipt-row receipt-total"><span>TOTAL</span><span>${booking.amount != null ? formatINR(booking.amount) : "—"}</span></div>
          <div class="receipt-row"><span>PAYMENT</span>${completed ? '<span class="paid">✓ Paid via Razorpay</span>' : `<span>${renderStatusPill(booking.status)}</span>`}</div>

          ${completed ? `
          <div id="review-section" style="margin:18px 0 6px;">
            <label style="margin:0 0 6px;">Rate this parking spot</label>
            <div class="stars" id="star-rating">${[1, 2, 3, 4, 5].map((n) => `<span class="star" data-n="${n}">★</span>`).join("")}</div>
            <textarea id="review-comment" maxlength="1000" placeholder="Optional — say a bit about your experience" style="margin-top:10px;"></textarea>
            <div class="form-error" id="review-error"></div>
            <button type="button" id="submit-review-btn" disabled>Select a rating first</button>
          </div>` : ""}

          <div class="receipt-actions">
            <a href="find-parking.html" class="btn">Book another spot</a>
            <button type="button" class="secondary" id="print-btn">Print receipt</button>
          </div>
        </div>`;

      document.getElementById("print-btn").addEventListener("click", () => window.print());
      if (!completed) return;

      document.querySelectorAll("#star-rating .star").forEach((star) => {
        star.addEventListener("click", () => {
          selectedRating = parseInt(star.dataset.n, 10);
          document.querySelectorAll("#star-rating .star").forEach((s) => s.classList.toggle("filled", parseInt(s.dataset.n, 10) <= selectedRating));
          const button = document.getElementById("submit-review-btn");
          button.disabled = false;
          button.textContent = "Submit review";
        });
      });
      document.getElementById("submit-review-btn").addEventListener("click", submitReview);
    } catch (err) {
      container.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  async function submitReview() {
    if (selectedRating === 0) return;
    const errorEl = document.getElementById("review-error");
    const button = document.getElementById("submit-review-btn");
    errorEl.classList.remove("visible");
    setBusy(button, true, "Submitting…");
    try {
      await api.submitReview(bookingId, selectedRating, document.getElementById("review-comment").value.trim());
      document.getElementById("review-section").innerHTML = '<div class="callout callout-go">Thanks — your review has been posted.</div>';
    } catch (err) {
      if (err.status === 409) {
        document.getElementById("review-section").innerHTML = '<div class="callout callout-amber">You\'ve already reviewed this booking.</div>';
        return;
      }
      errorEl.textContent = err.message || "Couldn't submit the review.";
      errorEl.classList.add("visible");
      setBusy(button, false);
    }
  }

  loadReceipt();
})();
