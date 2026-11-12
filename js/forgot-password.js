/* forgot-password.js */
(function () {
  const form = document.getElementById("forgot-form");
  const button = document.getElementById("forgot-btn");
  const errorEl = document.getElementById("forgot-error");
  const body = document.getElementById("forgot-body");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    const email = document.getElementById("email").value.trim();
    setBusy(button, true, "Sending…");
    try {
      await api.forgotPassword(email);
      // Same message whether or not the email exists — the backend doesn't reveal which emails are registered.
      body.innerHTML = `
        <div class="callout callout-go" style="margin-top:0;">
          <b>Check your inbox.</b><br/>
          If an account exists for <b>${escapeHtml(email)}</b>, we've sent a password reset link. It expires in 30 minutes.
        </div>
        <p class="fine-print" style="margin-top:14px;">
          Didn't get it? Check your spam folder, or <a href="forgot-password.html">try again</a>.
        </p>`;
    } catch (err) {
      errorEl.textContent = err.message || "Couldn't send the reset email. Try again.";
      errorEl.classList.add("visible");
      setBusy(button, false);
    }
  });
})();
