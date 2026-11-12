/* index.js — landing page: "you're already signed in" banner */
(function () {
  const banner = document.getElementById("returning-user-banner");
  const role = localStorage.getItem("parkwise_role");
  if (!banner || !localStorage.getItem("parkwise_token") || !role) return;
  banner.querySelector("a").href = homeForRole(role);
  banner.hidden = false;
})();
