/* reset-password.js */
(function () {
  const token = new URLSearchParams(window.location.search).get("token");
  const body = document.getElementById("reset-body");

  if (!token) {
    body.innerHTML = `
      <div class="callout callout-amber" style="margin-top:0;">
        This reset link is missing its token. Please use the link from your email,
        or <a href="forgot-password.html">request a new one</a>.
      </div>`;
    return;
  }

  const form = document.getElementById("reset-form");
  const button = document.getElementById("reset-btn");
  const errorEl = document.getElementById("reset-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (newPassword !== confirmPassword) {
      errorEl.textContent = "The two passwords don't match.";
      errorEl.classList.add("visible");
      return;
    }

    setBusy(button, true, "Updating…");
    try {
      await api.resetPassword(token, newPassword);
      body.innerHTML = `
        <div class="callout callout-go" style="margin-top:0;"><b>Password updated.</b> Redirecting you to login…</div>
        <a href="login.html" class="btn full-width" style="margin-top:14px;">Go to login now</a>`;
      setTimeout(() => { window.location.href = "login.html"; }, 2500);
    } catch (err) {
      errorEl.innerHTML = escapeHtml(err.message || "Couldn't update password.") +
        ' <a href="forgot-password.html">Request a new link</a>.';
      errorEl.classList.add("visible");
      setBusy(button, false);
    }
  });
})();
