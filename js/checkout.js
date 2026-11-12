/*
  checkout.js
  Check-out + payment for a checked-in booking.

    1. api.checkOut(bookingId)  -> backend returns the Razorpay order
    2. Razorpay Checkout opens
    3. api.verifyPayment(...)   -> backend verifies the signature, then receipt.html

  The order fields are read from the checkout response under their usual
  names (razorpay_order_id / order_id, razorpay_key_id / key_id). If your
  backend uses other names, change readOrder() — it is the only place.
*/
(function () {
  if (!requireLogin()) return;

  const bookingId = new URLSearchParams(window.location.search).get("bookingId");
  const container = document.getElementById("checkout-container");
  const receiptUrl = () => `receipt.html?bookingId=${encodeURIComponent(bookingId)}`;

  function readOrder(order) {
    return {
      orderId: order.razorpay_order_id || order.order_id,
      key: order.razorpay_key_id || order.key_id || order.key,
      currency: order.currency || "INR",
      amountPaise: order.amount_paise || order.amount_in_paise || null,
    };
  }

  async function load() {
    if (!bookingId) { container.innerHTML = '<div class="empty">No booking specified.</div>'; return; }
    try {
      const bookings = await api.getMyBookings();
      const booking = bookings.find((b) => String(b.id) === bookingId);
      if (!booking) { container.innerHTML = '<div class="empty">Booking not found.</div>'; return; }

      if (booking.status === "completed") { window.location.href = receiptUrl(); return; }
      if (booking.status === "reserved") { window.location.href = `active-ticket.html?bookingId=${encodeURIComponent(bookingId)}`; return; }
      if (booking.status === "cancelled") {
        container.innerHTML = `<div class="panel"><div class="panel-body">${renderStatusPill("cancelled")}
          <p style="font-size:13px; color:var(--muted);">This booking was cancelled, so there is nothing to pay.</p>
          <a href="find-parking.html" class="btn">Find another spot</a></div></div>`;
        return;
      }

      const hours = Math.max(0, (new Date(booking.end_time) - new Date(booking.start_time)) / 3600000).toFixed(1);
      container.innerHTML = `
        <div class="receipt">
          <h3>Parking session</h3>
          ${renderStatusPill(booking.status)}
          <div class="receipt-row"><span>VEHICLE</span><span>${escapeHtml(booking.vehicle_number)}</span></div>
          <div class="receipt-row"><span>DATE</span><span>${escapeHtml(formatDate(booking.start_time))}</span></div>
          <div class="receipt-row"><span>SCHEDULED</span><span>${escapeHtml(formatTime(booking.start_time))} – ${escapeHtml(formatTime(booking.end_time))} (${hours} hr)</span></div>
          <div class="form-error" id="checkout-error"></div>
          <button type="button" id="pay-btn" class="full-width" style="margin-top:18px;">Pay &amp; check out</button>
          <p class="fine-print" style="margin-top:10px;">You'll see the final amount in the secure Razorpay window.</p>
        </div>`;
      document.getElementById("pay-btn").addEventListener("click", startPayment);
    } catch (err) {
      container.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  }

  async function startPayment() {
    const button = document.getElementById("pay-btn");
    const errorEl = document.getElementById("checkout-error");
    const fail = (msg) => { errorEl.textContent = msg; errorEl.classList.add("visible"); setBusy(button, false); };
    errorEl.classList.remove("visible");

    if (typeof Razorpay === "undefined") return fail("The payment window couldn't load. Check your internet connection and refresh.");

    setBusy(button, true, "Preparing payment…");
    try {
      const order = readOrder(await api.checkOut(bookingId));
      if (!order.orderId || !order.key) return fail("The server didn't return payment details. Please try again.");

      const options = {
        key: order.key,
        order_id: order.orderId,
        currency: order.currency,
        name: "ParkWise",
        description: "Parking session",
        theme: { color: "#FFB020" },
        handler: async (response) => {
          setBusy(button, true, "Confirming payment…");
          try {
            await api.verifyPayment(bookingId, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            window.location.href = receiptUrl();
          } catch (err) {
            fail(`Payment went through but we couldn't confirm it: ${err.message}. Please contact support with booking ${bookingId}.`);
          }
        },
        modal: { ondismiss: () => setBusy(button, false) },
      };
      if (order.amountPaise) options.amount = order.amountPaise;

      const checkout = new Razorpay(options);
      checkout.on("payment.failed", (r) => fail((r.error && r.error.description) || "Payment failed. Please try again."));
      checkout.open();
    } catch (err) {
      fail(err.message || "Couldn't start checkout.");
    }
  }

  load();
})();
