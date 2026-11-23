/* index.js — landing page */

/* Hero search: opens Find Parking with the typed place already searched */
(function () {
  const form = document.getElementById("hero-search");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const place = document.getElementById("hero-place").value.trim();
    window.location.href = place ? "find-parking.html?area=" + encodeURIComponent(place) : "find-parking.html";
  });
})();

/* Owner card: the yellow car drives in and parks in bay 07 when the card
   scrolls into view (and replays each time it comes back into view). */
(function () {
  const lot = document.querySelector(".lot");
  if (!lot || !("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  lot.classList.add("lot--animate");
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) lot.classList.add("is-in");
      else if (e.intersectionRatio === 0) lot.classList.remove("is-in");
    });
  }, { threshold: [0, 0.6] }).observe(lot);
})();
