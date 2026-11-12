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
    `<a href="${href}" class="logo-link"><div class="logo-mark">P</div><div class="logo-text">Park<span>Wise</span></div></a>`;
  const navLink = (href, label, key) =>
    `<a href="${href}" class="nav-link${key === page ? " active" : ""}">${label}</a>`;
  const publicLink = (href, label, key) =>
    `<a href="${href}"${key === page ? ' class="is-active"' : ""}>${label}</a>`;
  const stripe = '<div class="stripe-bar"></div>';
  const roleBar = '<div class="role-bar" id="role-bar"></div>';
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
        <nav class="landing-nav-links">${publicLink("index.html", "Home", "home")}${publicLink("about.html", "About", "about")}${publicLink("contact.html", "Contact", "contact")}</nav>
        <div class="landing-auth-buttons">${buttons}</div></header>`;
    },
  };

  function footer() {
    const listSpace = role === "owner" ? "dashboard.html" : "signup.html";
    const account = token
      ? `<li><a href="${homeForRole(role)}">Dashboard</a></li><li><a href="login.html" data-logout>Log out</a></li>`
      : '<li><a href="login.html">Sign In</a></li><li><a href="signup.html">Sign Up</a></li>';
    return `<footer class="pw-footer"><div class="pw-footer__container">
      <div class="pw-footer__main">
        <div class="pw-footer__brand">
          <a href="index.html" class="pw-logo"><span class="pw-logo__icon">P</span><span class="pw-logo__text">PARK<span>WISE</span></span></a>
          <p class="pw-footer__tagline">Park smarter. Find your spot with ease.</p>
          <div class="pw-apps">
            <span class="pw-app"><span class="pw-app__soon">Soon</span>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff" aria-hidden="true"><path d="M16.37 12.63c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.58-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.82 1.4-.02 2.29-1.27 3.14-2.52.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.15ZM13.8 4.9c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.45Z"/></svg>
              <span><small>Download on the</small><strong>App Store</strong></span></span>
            <span class="pw-app"><span class="pw-app__soon">Soon</span>
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="#2196f3" d="M3.6 2.4 13.2 12 3.6 21.6c-.4-.2-.6-.6-.6-1.1V3.5c0-.5.2-.9.6-1.1Z"/><path fill="#4caf50" d="M16.3 8.9 13.2 12 3.6 2.4c.3-.1.7-.1 1.1.1l11.6 6.4Z"/><path fill="#ffc107" d="M20 10.9c.8.5.8 1.7 0 2.2l-3.7 2-3.1-3.1 3.1-3.1 3.7 2Z"/><path fill="#f44336" d="M16.3 15.1 4.7 21.5c-.4.2-.8.2-1.1.1l9.6-9.6 3.1 3.1Z"/></svg>
              <span><small>Get it on</small><strong>Google Play</strong></span></span>
          </div>
        </div>
        <div class="pw-footer__col"><h4 class="pw-footer__heading">Quick Links</h4><ul class="pw-footer__links">
          <li><a href="index.html">Home</a></li><li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li></ul></div>
        <div class="pw-footer__col"><h4 class="pw-footer__heading">For Users</h4><ul class="pw-footer__links">
          <li><a href="find-parking.html">Find Parking</a></li><li><a href="${listSpace}">List Your Space</a></li>${account}</ul></div>
        <div class="pw-footer__col pw-footer__col--contact"><h4 class="pw-footer__heading">Contact</h4>
          <div class="pw-contact">
            <svg class="pw-contact__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            <div><a href="mailto:support@parkwise.com" class="pw-contact__mail">support@parkwise.com</a><p class="pw-contact__note">Need help? Get in touch.</p></div>
          </div></div>
      </div>
      <div class="pw-footer__bottom">
        <p>&copy; ${new Date().getFullYear()} ParkWise. All rights reserved.</p>
        <div class="pw-footer__legal"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms &amp; Conditions</a></div>
      </div></div></footer>`;
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
  if (body.dataset.footer !== "off") body.insertAdjacentHTML("beforeend", footer());

  document.querySelectorAll("[data-logout]").forEach((el) =>
    el.addEventListener("click", () => localStorage.clear())
  );
})();
