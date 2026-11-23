/*
  layout.js
  Renders the header and footer that every page shares, so the nav and
  footer links live in ONE place. Load this first on every page.

  Each page's <body> says what it needs:
    data-nav="driver | owner | admin | auth | public"
    data-page="dashboard | search | bookings | home | about | contact"   (highlights the nav link)
    data-auth-href / data-auth-label                                    (only for data-nav="auth")
*/

function homeForRole(role) {
  return { owner: "dashboard.html", admin: "admin.html" }[role] || "search.html";
}

(function () {
  const body = document.body;
  const type = body.dataset.nav || "none";
  const page = body.dataset.page || "";
  const token = localStorage.getItem("parkwise_token");
  const role = localStorage.getItem("parkwise_role");

  const logo = (href) =>
    `<a href="${href}" class="logo-link"><svg class="logo-mark-svg" viewBox="0 0 36 36" width="34" height="34" aria-hidden="true"><rect width="36" height="36" rx="10" fill="var(--asphalt)"/><path d="M12.5 27V9.5h7a5.5 5.5 0 0 1 0 11h-7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25.5" cy="25.5" r="3.6" fill="var(--amber)"/></svg><div class="logo-text">Park<span>Wise</span></div></a>`;
  const navLink = (href, label, key) =>
    `<a href="${href}" class="nav-link${key === page ? " active" : ""}">${label}</a>`;
  const publicLink = (href, label, key) =>
    `<a href="${href}"${key === page ? ' class="is-active"' : ""}>${label}</a>`;
  const stripe = "";   // the old hazard stripe and role/quote bar were retired for a calmer header
  const roleBar = "";
  const logout = '<a href="login.html" class="nav-link" data-logout>Log out</a>';

  const headers = {
    driver: () =>
      `<header>${logo("search.html")}<nav class="main-nav">
        ${navLink("search.html", "Dashboard", "dashboard")}
        ${navLink("find-parking.html", "Search", "search")}
        ${navLink("booking-history.html", "My bookings", "bookings")}
        <div class="account-menu">
          <button class="account-trigger" id="account-trigger" type="button">Account <span class="chevron">▾</span></button>
          <div class="account-dropdown" id="account-dropdown">
            <div class="account-email-label">Signed in as</div>
            <div class="account-email" id="account-email">Loading…</div>
            <a href="login.html" class="btn full-width" data-logout>Log out</a>
          </div>
        </div>
      </nav></header>${stripe}${roleBar}`,
    owner: () =>
      `<header>${logo("dashboard.html")}<nav class="main-nav">${navLink("dashboard.html", "Dashboard", "dashboard")}${logout}</nav></header>${stripe}${roleBar}`,
    admin: () =>
      `<header>${logo("admin.html")}<nav class="main-nav">${navLink("admin.html", "Admin", "dashboard")}${logout}</nav></header>${stripe}${roleBar}`,
    auth: () =>
      `<header>${logo("index.html")}<nav class="main-nav"><a href="${body.dataset.authHref || "login.html"}" class="nav-link">${body.dataset.authLabel || "Log in"}</a></nav></header>${stripe}`,
    public: () => {
      const buttons = token
        ? `<a href="${homeForRole(role)}" class="btn-outline">Dashboard</a><a href="login.html" class="btn-filled" data-logout>Log out</a>`
        : '<a href="login.html" class="btn-outline">Sign In</a><a href="signup.html" class="btn-filled">Sign Up</a>';
      return `<header class="landing-header">${logo("index.html")}
        <button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="landing-nav" aria-label="Open menu"><span></span><span></span><span></span></button>
        <nav class="landing-nav-links" id="landing-nav">${publicLink("index.html", "Home", "home")}${publicLink("find-parking.html", "Find parking", "search")}${publicLink("about.html", "About", "about")}${publicLink("contact.html", "Contact", "contact")}${token ? "" : '<a href="login.html" class="nav-only-menu">Sign in</a>'}</nav>
        <div class="landing-auth-buttons">${buttons}</div></header>`;
    },
  };

  function footer() {
    const listSpace = role === "owner" ? "dashboard.html" : "signup.html?role=owner";
    return `<footer class="pw-footer"><div class="pw-footer__container">
      <div class="pw-footer__grid">
        <div class="pw-footer__brand">
          <a href="index.html" class="logo-link"><svg class="logo-mark-svg" viewBox="0 0 36 36" width="34" height="34" aria-hidden="true"><rect width="36" height="36" rx="10" fill="var(--asphalt)"/><path d="M12.5 27V9.5h7a5.5 5.5 0 0 1 0 11h-7" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25.5" cy="25.5" r="3.6" fill="var(--amber)"/></svg><div class="logo-text">Park<span>Wise</span></div></a>
          <p>Find, book and park in a few taps.</p>
        </div>
        <div><h4>Quick links</h4><a href="index.html">Home</a><a href="find-parking.html">Find parking</a><a href="about.html">About</a></div>
        <div><h4>For owners</h4><a href="${listSpace}">List your space</a><a href="login.html">Owner login</a></div>
        <div><h4>Support</h4><a href="contact.html">Contact</a><a href="privacy.html">Privacy policy</a><a href="terms.html">Terms</a></div>
      </div>
      <p class="pw-footer__copy">&copy; ${new Date().getFullYear()} ParkWise. All rights reserved.</p>
    </div></footer>`;
  }

  /* Phone-only bottom tab bar for drivers (hidden on wider screens by css/mobile.css). */
  function tabBar() {
    const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const tab = (href, label, key, svg) =>
      `<a href="${href}"${key === page ? ' class="active" aria-current="page"' : ""}>${icon(svg)}<span>${label}</span></a>`;
    return `<nav class="tab-bar" aria-label="Main">
      ${tab("search.html", "Home", "dashboard", '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>')}
      ${tab("find-parking.html", "Find parking", "search", '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}
      ${tab("booking-history.html", "Bookings", "bookings", '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>')}
    </nav>`;
  }

  if (headers[type]) body.insertAdjacentHTML("afterbegin", headers[type]());
  if (type === "driver") { body.insertAdjacentHTML("beforeend", tabBar()); body.classList.add("has-tabbar"); }
  // the footer appears on the home page only; the app pages stay clean
  if (page === "home" && body.dataset.footer !== "off") body.insertAdjacentHTML("beforeend", footer());

  // phone menu (public pages)
  const toggle = document.getElementById("menu-toggle");
  if (toggle) {
    const headerEl = toggle.closest("header");
    toggle.addEventListener("click", () => {
      const open = headerEl.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }

  document.querySelectorAll("[data-logout]").forEach((el) =>
    el.addEventListener("click", () => localStorage.clear())
  );
})();
