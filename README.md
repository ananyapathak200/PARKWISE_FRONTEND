# ParkWise — frontend

Plain HTML / CSS / JavaScript. No build step.

## Run it

1. Start your backend (FastAPI). The URL is set once, at the top of `js/api.js`:
   `const API_BASE_URL = "http://127.0.0.1:9000";`
2. Serve this folder with any static server, for example:
   `python -m http.server 5500`  then open http://127.0.0.1:5500/
   (VS Code "Live Server" also works.)

## Images you add yourself (`assets/`)

| File | Used for |
|------|----------|
| `assets/hero.jpg` | Landing page hero photo (falls back to `parking.png`, then plain dark) |
| `assets/parking.png` | Landing page "Platform" and "How it works" cards |

## Pages

| Page | Who | What |
|------|-----|------|
| `index.html` | everyone | Landing page |
| `about.html`, `contact.html`, `privacy.html`, `terms.html` | everyone | Static pages |
| `login.html`, `signup.html`, `forgot-password.html`, `reset-password.html` | everyone | Account |
| `search.html` | driver | Driver home: active ticket, stats, recent bookings |
| `find-parking.html` | driver | Nearby parking + filters |
| `listing-detail.html` | driver | One listing, reviews |
| `booking.html` | driver | Reserve a slot |
| `active-ticket.html` | driver | QR ticket + check-in |
| `checkout.html` | driver | Pay with Razorpay and check out |
| `receipt.html` | driver | Receipt + star rating |
| `booking-history.html` | driver | All bookings |
| `dashboard.html` | owner | Stats, new listing form, my listings |
| `edit-listing.html`, `slot-status.html` | owner | Edit / delete a listing, live slot grid |
| `admin.html` | admin | Stats + approve / reject listings |

After login: driver → `search.html`, owner → `dashboard.html`, admin → `admin.html`.

## Folders

```
css/
  tokens.css        colours, fonts, radii (the only place hex values live)
  base.css          reset + typography
  layout.css        header, nav, stripe, main container
  components.css    buttons, panels, forms, ticket cards, pills, tables ...
  footer.css        site footer
  pages/            one small file per page that needs its own styles
js/
  layout.js         header + footer for every page (edit nav links here)
  api.js            every backend call (+ API_BASE_URL)
  auth.js           session, login / signup, role bar, account menu
  components.js     shared render helpers (escapeHtml, ticket card, ...)
  geolocation.js    GPS, address -> coordinates, Google Maps link
  <page>.js         one script per page
```

## Things to check against your backend

* `checkout.js` reads the Razorpay order from the `/checkout` response as
  `razorpay_order_id | order_id` and `razorpay_key_id | key_id | key` (function `readOrder`).
* `dashboard.js` reads the owner summary under a few common key names (function `readSummary`),
  and sends `name, address, price_per_hour, total_slots, latitude, longitude,
  opening_time, closing_time, vehicle_type` when creating a listing.
* `driver-dashboard.js` shows the listing name / Navigate button only if the booking
  includes `parking_area_id` (or the name directly); otherwise it shows the vehicle number.
* The App Store / Google Play badges in the footer are marked "Soon" — add real links in `js/layout.js` when the apps exist.
* `privacy.html` and `terms.html` contain placeholder text — have them reviewed before going public.
