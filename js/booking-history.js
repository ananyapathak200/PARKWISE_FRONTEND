/* booking-history.js — GET /bookings/mine as a table */
(function () {
  if (!requireLogin()) return;

  function action(b) {
    const id = encodeURIComponent(b.id);
    if (b.status === "reserved") return `<a href="active-ticket.html?bookingId=${id}" class="btn secondary">View ticket</a>`;
    if (b.status === "checked_in") return `<a href="checkout.html?bookingId=${id}" class="btn">Check out</a>`;
    if (b.status === "completed") return `<a href="receipt.html?bookingId=${id}" class="btn secondary">Receipt</a>`;
    return "";
  }

  async function loadHistory() {
    const tbody = document.querySelector("#bookings-table tbody");
    try {
      const bookings = await api.getMyBookings();
      if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No bookings yet. <a href="find-parking.html">Find a parking spot</a></td></tr>';
        return;
      }
      bookings.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      tbody.innerHTML = bookings.map((b) => `
        <tr>
          <td data-label="Vehicle"><b>${escapeHtml(b.vehicle_number)}</b></td>
          <td data-label="Date">${escapeHtml(formatDate(b.start_time))}</td>
          <td data-label="Time">${escapeHtml(formatTime(b.start_time))} – ${escapeHtml(formatTime(b.end_time))}</td>
          <td data-label="Amount">${b.amount != null ? escapeHtml(formatINR(b.amount)) : "—"}</td>
          <td data-label="Status">${renderStatusPill(b.status)}</td>
          <td class="td-action">${action(b)}</td>
        </tr>`).join("");
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  loadHistory();
})();
