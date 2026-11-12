/*
  components.js
  Reusable render helpers shared by several pages. Anything that comes
  from the backend or from a user is passed through escapeHtml() before
  it goes into innerHTML.
*/

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatINR(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/* Local YYYY-MM-DD for <input type="date"> (toISOString would give the UTC date). */
function localDateValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* Local HH:MM for <input type="time">. */
function localTimeValue(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/*
  A parking ticket card. metaLine, actionHtml, nameHtml and addressHtml are trusted HTML that the
  caller has already escaped; everything else is escaped here.
*/
function renderTicketCard({ figure, unit, ribbonText, metaLine, name, address, dots, price, actionHtml, photoUrl, avgRating, reviewCount, nameHtml, addressHtml }) {
  const ratingHtml = avgRating != null
    ? `<span style="color:var(--amber-dark); font-weight:700; font-size:12.5px;">★ ${escapeHtml(avgRating)}</span> <span style="color:var(--muted); font-size:11.5px;">(${escapeHtml(reviewCount)})</span>`
    : `<span style="color:var(--muted); font-size:11.5px;">No reviews yet</span>`;

  return `
    <div class="ticket">
      <div class="ticket-stub">
        <div class="stub-figure">${escapeHtml(figure)}</div>
        <div class="stub-unit">${escapeHtml(unit)}</div>
      </div>
      <div class="ticket-body">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          ${photoUrl ? `<img src="${escapeHtml(photoUrl)}" class="ticket-thumb" alt="${escapeHtml(name)}" loading="lazy" decoding="async" onerror="this.style.display='none';" />` : ""}
          <div>
            ${ribbonText
              ? `<span class="ribbon">${escapeHtml(ribbonText)}</span><br class="ribbon-spacer"/><br class="ribbon-spacer"/>`
              : (metaLine ? `<div class="listing-meta">${metaLine}</div>` : "")}
            <div class="listing-name">${nameHtml || escapeHtml(name)}</div>
            <div class="listing-meta">${addressHtml || escapeHtml(address)}</div>
            <div style="margin-top:3px;">${ratingHtml}</div>
            ${dots ? `<div class="slot-dots">${dots}</div>` : ""}
          </div>
        </div>
        <div class="ticket-price">
          <div class="amt">₹${escapeHtml(price)}</div>
          <div class="unit">per hour</div>
          ${actionHtml || ""}
        </div>
      </div>
    </div>
  `;
}

function renderSlotDots(totalSlots, availableSlots) {
  return Array.from({ length: totalSlots })
    .map((_, idx) => `<i class="${idx < availableSlots ? "dot-free" : "dot-taken"}"></i>`)
    .join("");
}

function renderStatusPill(status) {
  const map = {
    approved: ["pill-go", "approved"],
    checked_in: ["pill-go", "checked in"],
    completed: ["pill-go", "completed"],
    pending: ["pill-amber", "pending"],
    reserved: ["pill-amber", "reserved"],
    rejected: ["pill-stop", "rejected"],
    cancelled: ["pill-stop", "cancelled"],
  };
  const [cls, label] = map[status] || ["pill-amber", status || "unknown"];
  return `<span class="status-pill ${cls}"><i></i>${escapeHtml(label)}</span>`;
}

function renderStatTile(num, label) {
  return `<div class="stat-tile"><div class="num">${escapeHtml(num)}</div><div class="label">${escapeHtml(label)}</div></div>`;
}

/* Deterministic pixel pattern from the token — a visual placeholder for a real QR image. */
function renderQrGrid(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
  let cells = "";
  for (let i = 0; i < 64; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    cells += `<div class="${hash % 100 < 46 ? "qr-cell-on" : "qr-cell-off"}"></div>`;
  }
  return `<div class="qr-box">${cells}</div>`;
}
