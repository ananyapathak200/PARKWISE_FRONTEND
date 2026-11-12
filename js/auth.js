/*
  auth.js
  Session helpers, the login / signup forms, the role bar under the
  header and the account dropdown. Needs layout.js and api.js first.
*/

function redirectForRole(role) {
  window.location.href = homeForRole(role);
}

function requireLogin() {
  if (!localStorage.getItem("parkwise_token")) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

/* Sends people to their own home if they open a page meant for another role. */
function requireRole(role) {
  if (!requireLogin()) return false;
  const current = localStorage.getItem("parkwise_role");
  if (current && current !== role) {
    redirectForRole(current);
    return false;
  }
  return true;
}

/* Disables a button while a request is running. */
function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText || "Please wait…";
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
}

// ---------- login ----------
(function () {
  const form = document.getElementById("login-form");
  if (!form) return;
  const button = document.getElementById("login-btn");
  const errorEl = document.getElementById("login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    setBusy(button, true, "Logging in…");
    try {
      const { access_token, role } = await api.login(
        document.getElementById("email").value.trim(),
        document.getElementById("password").value
      );
      localStorage.setItem("parkwise_token", access_token);
      localStorage.setItem("parkwise_role", role);
      try {
        const me = await api.getCurrentUser();
        localStorage.setItem("parkwise_name", me.name);
      } catch (err) { /* name is optional */ }
      redirectForRole(role);
    } catch (err) {
      errorEl.textContent = err.message || "Incorrect email or password.";
      errorEl.classList.add("visible");
      setBusy(button, false);
    }
  });
})();

// ---------- signup ----------
(function () {
  const form = document.getElementById("signup-form");
  if (!form) return;
  const button = document.getElementById("signup-btn");
  const errorEl = document.getElementById("signup-error");

  // highlight the chosen role card
  document.querySelectorAll(".role-option").forEach((option) => {
    option.addEventListener("click", () => {
      document.querySelectorAll(".role-option").forEach((o) => o.classList.remove("selected"));
      option.classList.add("selected");
      option.querySelector("input").checked = true;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    const payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      password: document.getElementById("password").value,
      role: form.querySelector('input[name="role"]:checked').value,
    };
    setBusy(button, true, "Creating account…");
    try {
      const { access_token, role } = await api.signup(payload);
      localStorage.setItem("parkwise_token", access_token);
      localStorage.setItem("parkwise_role", role);
      localStorage.setItem("parkwise_name", payload.name);
      redirectForRole(role);
    } catch (err) {
      errorEl.textContent = err.message || "Something went wrong. Try again.";
      errorEl.classList.add("visible");
      setBusy(button, false);
    }
  });
})();

// ---------- role bar (badge + quote under the header) ----------
const ROLE_QUOTES = {
  driver: { label: "Driver", cls: "role-badge-driver", quote: "Stop circling the block. Your spot is already waiting." },
  owner: { label: "Owner", cls: "role-badge-owner", quote: "That empty driveway? Someone nearby is looking for exactly that, right now." },
  admin: { label: "Admin", cls: "role-badge-admin", quote: "Every approval is a small promise that this platform can be trusted." },
};

(function () {
  const bar = document.getElementById("role-bar");
  if (!bar) return;
  const info = ROLE_QUOTES[localStorage.getItem("parkwise_role")];
  if (!info) { bar.style.display = "none"; return; }
  bar.innerHTML = `<span class="role-badge ${info.cls}">${info.label}</span><span class="quote-text">"${info.quote}"</span>`;
})();

// ---------- account dropdown (email + log out) ----------
let accountMenuLoaded = false;

function toggleAccountMenu() {
  const dropdown = document.getElementById("account-dropdown");
  const trigger = document.getElementById("account-trigger");
  if (!dropdown || !trigger) return;
  const isOpen = dropdown.classList.toggle("open");
  trigger.classList.toggle("open", isOpen);

  if (isOpen && !accountMenuLoaded) {
    accountMenuLoaded = true;
    api.getCurrentUser()
      .then((me) => { document.getElementById("account-email").textContent = me.email; })
      .catch(() => { document.getElementById("account-email").textContent = "Couldn't load"; accountMenuLoaded = false; });
  }
}

(function () {
  const trigger = document.getElementById("account-trigger");
  if (trigger) trigger.addEventListener("click", toggleAccountMenu);

  document.addEventListener("click", (e) => {
    const menu = document.querySelector(".account-menu");
    if (menu && !menu.contains(e.target)) {
      document.getElementById("account-dropdown").classList.remove("open");
      document.getElementById("account-trigger").classList.remove("open");
    }
  });
})();
