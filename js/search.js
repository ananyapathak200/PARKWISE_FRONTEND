/*
  search.js  (find-parking.html)

  How it works
  - Listings for the current location (+ vehicle type) are fetched ONCE and cached.
  - Typing filters those listings instantly by space name / address
    (typo-tolerant, ranked by relevance) and shows a suggestion dropdown.
  - Price and "free slots only" filter in the browser — no new request.
  - Only a location change or a vehicle-type change asks the backend again,
    and an older response can never overwrite a newer one.
  - If no listed space matches the text, the same text can be searched as an
    area (geocoded through the backend, results cached).
  - Search state is kept in the URL, so "Back" from a listing restores it.
*/
(function () {
  if (!requireLogin()) return;

  const $ = (id) => document.getElementById(id);
  const input = $("destination-input");
  const listbox = $("ps-suggest");
  const clearBtn = $("ps-clear");
  const resultsEl = $("listing-results");
  const countEl = $("ps-result-count");

  const CACHE_MS = 60 * 1000;          // listing data is reused for 1 minute
  const MAX_SUGGESTIONS = 6;
  const STOP_WORDS = new Set(["parking", "park", "space", "spaces", "spot", "spots", "stand", "lot", "near", "the", "in", "at", "of"]);

  let lastKnownLocation = null;
  let areaLabel = "";        // set when the user searched an area instead of a space name
  let allListings = [];      // backend result for current location + vehicle (unfiltered by price/text)
  let textQuery = "";        // text filter applied to the result list
  let loadSeq = 0;           // guards against out-of-order responses
  let suggestions = [];      // [{type:'listing', l} | {type:'area', q}]
  let activeIndex = -1;
  const listingCache = new Map();
  const geocodeCache = new Map();

  // ---------- small helpers ----------
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function norm(s) {
    return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }

  function tokensOf(q) {
    const all = norm(q).split(" ").filter(Boolean);
    const meaningful = all.filter((t) => !STOP_WORDS.has(t));
    return meaningful.length ? meaningful : all;
  }

  /* Levenshtein distance that gives up early once it passes `max`. */
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /* Pre-computed search fields, stored once per listing. */
  function indexOf(l) {
    if (l._idx) return l._idx;
    const name = norm(l.name), addr = norm(l.address);
    l._idx = {
      name, addr,
      nameWords: name.split(" ").filter(Boolean),
      addrWords: addr.split(" ").filter(Boolean),
      nameCompact: name.replace(/ /g, ""),
      addrCompact: addr.replace(/ /g, ""),
    };
    return l._idx;
  }

  /* 0..1 — how well one typed token matches a field. */
  function tokenScore(token, words, compact) {
    let best = 0;
    for (const w of words) {
      if (w === token) return 1;
      if (w.startsWith(token)) best = Math.max(best, 0.85);
      else if (token.length >= 3 && w.includes(token)) best = Math.max(best, 0.55);
      else if (token.length >= 4) {
        const allowed = token.length >= 7 ? 2 : 1;
        const d = Math.min(editDistance(token, w, allowed), editDistance(token, w.slice(0, token.length), allowed));
        if (d <= allowed) best = Math.max(best, d === 1 ? 0.5 : 0.35);
      }
    }
    if (!best && token.length >= 2 && compact.includes(token)) best = 0.5; // "a12" matches "A-12"
    return best;
  }

  /* Relevance of a listing for the query; 0 = not a match. */
  function relevance(l, tokens, phrase) {
    const ix = indexOf(l);
    let total = 0, matched = 0;
    for (const t of tokens) {
      const s = Math.max(tokenScore(t, ix.nameWords, ix.nameCompact), 0.6 * tokenScore(t, ix.addrWords, ix.addrCompact));
      if (s > 0) matched++;
      total += s;
    }
    const needed = tokens.length >= 3 ? tokens.length - 1 : tokens.length;
    if (matched < needed) return 0;
    let score = (total / tokens.length) * 100;
    if (phrase && ix.name === phrase) score += 40;
    else if (phrase && ix.name.startsWith(phrase)) score += 25;
    else if (phrase && ix.name.includes(phrase)) score += 15;
    if (l.available_slots > 0) score += 8;
    score += (Number(l.score) || 0) * 0.05; // backend match score breaks ties
    return score;
  }

  function rank(list, q) {
    const tokens = tokensOf(q);
    if (!tokens.length) return list.map((l) => ({ l, rel: null }));
    const phrase = norm(q);
    return list.map((l) => ({ l, rel: relevance(l, tokens, phrase) }))
      .filter((r) => r.rel > 0)
      .sort((a, b) => b.rel - a.rel);
  }

  /* Escapes text and wraps the parts that match the query in <mark>. */
  function highlight(text, q) {
    const raw = String(text ?? "");
    const lower = raw.toLowerCase();
    const ranges = [];
    for (const t of tokensOf(q)) {
      if (t.length < 2) continue;
      let i = lower.indexOf(t);
      while (i !== -1) { ranges.push([i, i + t.length]); i = lower.indexOf(t, i + t.length); }
    }
    if (!ranges.length) return escapeHtml(raw);
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0]];
    for (const r of ranges.slice(1)) {
      const last = merged[merged.length - 1];
      if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r);
    }
    let out = "", pos = 0;
    for (const [s, e] of merged) {
      out += escapeHtml(raw.slice(pos, s)) + "<mark>" + escapeHtml(raw.slice(s, e)) + "</mark>";
      pos = e;
    }
    return out + escapeHtml(raw.slice(pos));
  }

  // ---------- filters ----------
  function getActiveFilters() {
    const price = $("filter-max-price").value;
    return {
      maxPrice: price ? parseFloat(price) : null,
      vehicleType: $("filter-vehicle-type").value || null,
      freeOnly: $("chip-free").getAttribute("aria-pressed") === "true",
    };
  }

  function syncChips() {
    const vehicle = $("filter-vehicle-type").value;
    const price = $("filter-max-price").value;
    document.querySelectorAll(".ps-chip[data-vehicle]").forEach((c) => {
      const on = c.dataset.vehicle === vehicle;
      c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", on);
    });
    document.querySelectorAll(".ps-chip[data-price]").forEach((c) => {
      const on = c.dataset.price === price;
      c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", on);
    });
    const free = $("chip-free");
    free.classList.toggle("is-active", free.getAttribute("aria-pressed") === "true");
  }

  /* Price / free-slot / text changes: no network, just re-render. */
  function refilter() { syncChips(); saveState(); render(); }

  /* Vehicle type changes what the backend returns, so reload (cached). */
  function reload() { syncChips(); saveState(); if (lastKnownLocation) loadListings(lastKnownLocation); }

  let lastVehicle = $("filter-vehicle-type").value;
  function applyFromForm() {
    const v = $("filter-vehicle-type").value;
    if (v !== lastVehicle) { lastVehicle = v; reload(); } else refilter();
  }

  $("apply-filters-btn").addEventListener("click", applyFromForm);
  $("filter-vehicle-type").addEventListener("change", applyFromForm);
  $("filter-max-price").addEventListener("input", debounce(refilter, 250));
  $("filter-max-price").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); refilter(); } });

  document.querySelectorAll(".ps-chip[data-vehicle]").forEach((chip) =>
    chip.addEventListener("click", () => { $("filter-vehicle-type").value = chip.dataset.vehicle; applyFromForm(); })
  );
  document.querySelectorAll(".ps-chip[data-price]").forEach((chip) =>
    chip.addEventListener("click", () => { $("filter-max-price").value = chip.dataset.price; refilter(); })
  );
  $("chip-free").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed") === "true" ? "false" : "true");
    refilter();
  });

  // ---------- URL state (so Back from a listing keeps the search) ----------
  function saveState() {
    const p = new URLSearchParams();
    const f = getActiveFilters();
    if (input.value.trim()) p.set("q", input.value.trim());
    if (areaLabel) p.set("area", areaLabel);
    if (f.vehicleType) p.set("vehicle", f.vehicleType);
    if (f.maxPrice != null) p.set("price", f.maxPrice);
    if (f.freeOnly) p.set("free", "1");
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  function restoreState() {
    const p = new URLSearchParams(location.search);
    if (p.get("vehicle")) $("filter-vehicle-type").value = p.get("vehicle");
    if (p.get("price")) $("filter-max-price").value = p.get("price");
    if (p.get("free") === "1") $("chip-free").setAttribute("aria-pressed", "true");
    lastVehicle = $("filter-vehicle-type").value;
    if (p.get("q")) { input.value = p.get("q"); textQuery = p.get("q"); }
    clearBtn.hidden = !input.value;
    syncChips();
    return p.get("area");
  }

  // ---------- location banner ----------
  function setBanner(kind, html) {
    const el = $("location-banner");
    el.className = `status-banner banner-${kind}`;
    el.innerHTML = html;
  }

  function showGpsBanner(loc) {
    setBanner("go", '<span class="led-dot"></span> Finding your area…');
    reverseGeocode(loc.lat, loc.lng).then((placeName) => {
      if (areaLabel) return; // the user already searched somewhere else
      const label = placeName || `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`;
      setBanner("go", `<span class="led-dot"></span> Near <b>${escapeHtml(label)}</b> <button type="button" class="secondary" id="refresh-location">Refresh</button>`);
      $("refresh-location").addEventListener("click", () => location.reload());
    });
  }

  function showFallbackBanner() {
    setBanner("amber", "⚠️ Location unavailable — showing results near Varanasi city centre.");
  }

  // ---------- suggestion dropdown (ARIA combobox) ----------
  function openList(open) {
    listbox.hidden = !open;
    input.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) { activeIndex = -1; input.removeAttribute("aria-activedescendant"); }
  }

  function buildSuggestions() {
    const q = input.value.trim();
    clearBtn.hidden = !q;
    if (!q) { suggestions = []; openList(false); return; }

    const matches = rank(allListings, q).slice(0, MAX_SUGGESTIONS);
    suggestions = matches.map((m) => ({ type: "listing", l: m.l }));
    suggestions.push({ type: "area", q });
    activeIndex = -1;

    listbox.innerHTML =
      (matches.length ? `<li class="ps-suggest__head" role="presentation">Parking spaces</li>` : "") +
      suggestions.map((s, i) => {
        if (s.type === "area") {
          return `<li id="ps-opt-${i}" role="option" class="ps-opt ps-opt--area" data-i="${i}" aria-selected="false">
              <span class="ps-opt__icon" aria-hidden="true">⌖</span>
              <span class="ps-opt__main"><span class="ps-opt__name">Search parking near “${escapeHtml(q)}”</span>
              <span class="ps-opt__sub">Look up this place on the map</span></span></li>`;
        }
        const l = s.l;
        const full = !(l.available_slots > 0);
        return `<li id="ps-opt-${i}" role="option" class="ps-opt" data-i="${i}" aria-selected="false">
            <span class="ps-opt__icon" aria-hidden="true">P</span>
            <span class="ps-opt__main">
              <span class="ps-opt__name">${highlight(l.name, q)}</span>
              <span class="ps-opt__sub">${highlight(l.address, q)}</span>
            </span>
            <span class="ps-opt__meta">
              <b>₹${escapeHtml(l.price_per_hour)}/hr</b>
              <span class="${full ? "is-full" : "is-free"}">${full ? "Full" : `${escapeHtml(l.available_slots)} free`}</span>
              ${l.distance_km != null ? `<span>${escapeHtml(l.distance_km)} km</span>` : ""}
            </span></li>`;
      }).join("");
    openList(true);
  }

  function setActive(i) {
    const opts = listbox.querySelectorAll(".ps-opt");
    if (!opts.length) return;
    activeIndex = (i + opts.length) % opts.length;
    opts.forEach((o, k) => {
      const on = k === activeIndex;
      o.classList.toggle("is-active", on);
      o.setAttribute("aria-selected", on ? "true" : "false");
      if (on) { input.setAttribute("aria-activedescendant", o.id); o.scrollIntoView({ block: "nearest" }); }
    });
  }

  function choose(i) {
    const s = suggestions[i];
    if (!s) return;
    openList(false);
    if (s.type === "listing") {
      saveState();
      window.location.href = `listing-detail.html?id=${encodeURIComponent(s.l.id)}`;
    } else {
      searchArea(s.q);
    }
  }

  const onType = debounce(() => {
    areaLabel = areaLabel && input.value.trim() === areaLabel ? areaLabel : "";
    textQuery = areaLabel ? "" : input.value.trim();
    buildSuggestions();
    saveState();
    render();
  }, 120);

  input.addEventListener("input", () => { clearBtn.hidden = !input.value; onType(); });
  input.addEventListener("focus", () => { if (input.value.trim() && !areaLabel) buildSuggestions(); });
  input.addEventListener("blur", () => setTimeout(() => openList(false), 120));
  input.addEventListener("keydown", (e) => {
    const isOpen = !listbox.hidden;
    if (e.key === "ArrowDown") { e.preventDefault(); if (!isOpen) buildSuggestions(); setActive(activeIndex + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (isOpen) setActive(activeIndex - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0) choose(activeIndex); else submitSearch();
    } else if (e.key === "Escape") {
      if (isOpen) { openList(false); } else if (input.value) { clearSearch(); }
    }
  });

  listbox.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
  listbox.addEventListener("click", (e) => {
    const li = e.target.closest(".ps-opt");
    if (li) choose(Number(li.dataset.i));
  });

  function clearSearch() {
    input.value = "";
    textQuery = "";
    clearBtn.hidden = true;
    openList(false);
    saveState();
    render();
    input.focus();
  }
  clearBtn.addEventListener("click", clearSearch);

  /* Search button / Enter: filter by space name if anything matches, otherwise treat it as an area. */
  function submitSearch() {
    const q = input.value.trim();
    $("destination-error").classList.remove("visible");
    openList(false);
    if (!q) { textQuery = ""; render(); return; }
    if (rank(allListings, q).length) {
      textQuery = q; areaLabel = ""; saveState(); render();
      resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      searchArea(q);
    }
  }

  $("destination-search-btn").addEventListener("click", submitSearch);

  // ---------- area search (geocoding, cached) ----------
  async function searchArea(query) {
    const errorEl = $("destination-error");
    const button = $("destination-search-btn");
    errorEl.classList.remove("visible");
    setBanner("loading", `<span class="led-dot"></span> Searching for "${escapeHtml(query)}"…`);
    setBusy(button, true, "Searching…");
    try {
      const key = norm(query);
      let result = geocodeCache.get(key);
      if (result === undefined) { result = await geocodeDestination(query); geocodeCache.set(key, result); }
      if (!result) {
        errorEl.textContent = `Couldn't find a space or place called "${query}" — try a more specific name.`;
        errorEl.classList.add("visible");
        setBanner("amber", `⚠️ No match for "${escapeHtml(query)}".`);
        if (!lastKnownLocation) {
          requestLocation(
            (loc) => { lastKnownLocation = loc; loadListings(loc); },
            (loc) => { lastKnownLocation = loc; loadListings(loc); }
          );
        }
        return;
      }
      areaLabel = query;
      textQuery = ""; // the text described a place, not a space name
      lastKnownLocation = result;
      setBanner("go", `<span class="led-dot"></span> Showing results near <b>${escapeHtml(query)}</b>`);
      saveState();
      loadListings(result);
    } catch (err) {
      errorEl.textContent = "Couldn't reach the location search service. Try GPS instead.";
      errorEl.classList.add("visible");
    } finally {
      setBusy(button, false);
    }
  }

  // ---------- listings (fetch once, cache, ignore stale responses) ----------
  function skeleton() {
    return Array.from({ length: 3 }, () => '<div class="ps-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>').join("");
  }

  async function loadListings(loc) {
    const seq = ++loadSeq;
    const { vehicleType } = getActiveFilters();
    const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}|${vehicleType || ""}`;
    const cached = listingCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      allListings = cached.data;
      resultsEl.removeAttribute("aria-busy");
      render();
      return;
    }

    resultsEl.setAttribute("aria-busy", "true");
    resultsEl.innerHTML = skeleton();
    countEl.textContent = "Loading nearby parking…";
    try {
      // price is filtered in the browser, so it isn't sent — changing it never needs a new request
      const listings = (await api.searchListings(loc.lat, loc.lng, { vehicleType })) || [];
      if (seq !== loadSeq) return; // a newer search started meanwhile
      listingCache.set(key, { at: Date.now(), data: listings });
      allListings = listings;
      resultsEl.removeAttribute("aria-busy");
      render();
      if (input.value.trim() && document.activeElement === input && !areaLabel) buildSuggestions();
    } catch (err) {
      if (seq !== loadSeq) return;
      allListings = [];
      countEl.textContent = "";
      resultsEl.innerHTML = `<div class="empty">Couldn't load listings — ${escapeHtml(err.message)}
        <br/><button type="button" class="secondary" data-action="retry">Try again</button></div>`;
    } finally {
      if (seq === loadSeq) resultsEl.removeAttribute("aria-busy");
    }
  }

  function render() {
    if (resultsEl.getAttribute("aria-busy") === "true") return;
    const f = getActiveFilters();
    const base = allListings.filter((l) =>
      (f.maxPrice == null || Number(l.price_per_hour) <= f.maxPrice) &&
      (!f.freeOnly || l.available_slots > 0)
    );
    const rows = rank(base, textQuery);
    const q = textQuery;

    // live count for screen readers and sighted users
    if (!allListings.length) countEl.textContent = "";
    else if (q) countEl.innerHTML = `<b>${rows.length}</b> space${rows.length === 1 ? "" : "s"} matching “${escapeHtml(q)}”`;
    else countEl.innerHTML = `<b>${rows.length}</b> of ${allListings.length} spaces shown`;

    if (!allListings.length) {
      resultsEl.innerHTML = '<div class="empty">No parking listed around here yet. Try searching another area.</div>';
      return;
    }
    if (!rows.length) {
      const anyNameMatch = q && rank(allListings, q).length > 0;
      resultsEl.innerHTML = `<div class="empty">
          ${q && !anyNameMatch ? `No listed space matches “${escapeHtml(q)}” nearby.` : "No spaces match your filters."}
          <div class="ps-empty-actions">
            ${q && !anyNameMatch ? `<button type="button" data-action="area">Search parking near “${escapeHtml(q)}”</button>` : ""}
            ${q ? `<button type="button" class="secondary" data-action="clear-text">Clear search</button>` : ""}
            ${f.maxPrice != null || f.freeOnly ? `<button type="button" class="secondary" data-action="reset-filters">Reset filters</button>` : ""}
          </div></div>`;
      return;
    }

    resultsEl.innerHTML = rows.map(({ l }, i) => renderTicketCard({
      figure: l.distance_km,
      unit: "km",
      ribbonText: i === 0 ? (q ? "Best match" : `Top match · ${l.score}%`) : null,
      metaLine: i === 0 ? null : `Match score ${escapeHtml(l.score)}%`,
      name: l.name,
      nameHtml: q ? highlight(l.name, q) : null,
      address: l.address,
      addressHtml: q ? highlight(l.address, q) : null,
      dots: renderSlotDots(l.total_slots, l.available_slots),
      price: l.price_per_hour,
      photoUrl: imageUrl(l.image_url),
      avgRating: l.avg_rating,
      reviewCount: l.review_count,
      actionHtml:
        (l.available_slots === 0
          ? `<button type="button" disabled>Full</button>`
          : `<a href="listing-detail.html?id=${encodeURIComponent(l.id)}" class="btn">Book</a>`) +
        `<br/><a href="${googleMapsDirectionsUrl(l.latitude, l.longitude)}" target="_blank" rel="noopener" class="btn secondary">Navigate</a>`,
    })).join("");
  }

  resultsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "area") searchArea(textQuery);
    else if (action === "clear-text") clearSearch();
    else if (action === "reset-filters") {
      $("filter-max-price").value = "";
      $("chip-free").setAttribute("aria-pressed", "false");
      refilter();
    } else if (action === "retry" && lastKnownLocation) {
      listingCache.clear();
      loadListings(lastKnownLocation);
    }
  });

  // ---------- start ----------
  const savedArea = restoreState();
  if (savedArea) {
    input.value = savedArea;
    clearBtn.hidden = false;
    searchArea(savedArea);
  } else {
    requestLocation(
      (loc) => { lastKnownLocation = loc; showGpsBanner(loc); loadListings(loc); },
      (loc) => { lastKnownLocation = loc; showFallbackBanner(); loadListings(loc); }
    );
  }
})();
