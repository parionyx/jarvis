---
name: hunter-osm-no-website-leads
description: "Gurgaon no-website leads via OSM + verify."
version: 1.0.0
author: JARVIS
license: MIT
platforms: [windows, linux, macos]
---

# Clean No-Website Lead Extraction (OSM + Verify)

The `google_maps_extractor` MCP silently falls back to a native OSM engine that
returns REAL business names but HARDCODED fake ratings/reviews/phones when Apify
credit is exhausted. Never treat its rows as real leads. Instead:

## Method (proven 2026-08-24)
1. Query live Overpass API for Gurgaon bbox (`28.34,76.93,28.56,77.12`) with OSM tags:
   - beauty: `node["shop"="beauty"]`
   - hairdresser: `node["shop"="hairdresser"]`
   - interior: `node["shop"="interior_decoration"]`
   - car: `node["shop"="car_repair"]`, `node["amenity"="car_wash"]`
   - real estate: `node["office"="estate_agent"]`
   Endpoint: `https://overpass-api.de/api/interpreter` (POST `data=` urlencoded).
2. Drop any row that HAS a `website`/`contact:website` OSM tag (these aren't targets).
3. Denylist chain/brand substrings (lowercased): looks, geetanjali, nykaa, mamaearth,
   lakme, jawed, habib, pepperfry, home town, maruti, suzuki, honda, hyundai, hero,
   tata, mahindra, 99acres, magicbricks, housing.com, squareyards, nobroker, truefitt,
   homelane, reliance, samsung, apple, bank, atm, hospital, clinic, hotel, restaurant,
   cafe, airtel, jio, etc. Keep small/local names.
4. **Mandatory web verification** — OSM "no website tag" ≠ truly no site. For each
   candidate run `web_search('"NAME" Gurgaon')` and classify result URLs:
   - REAL own site = brand domain ending `.in/.com/.co.in` that is the business's own
     (NOT justdial/magicpin/practo/sulekha/wedmegood/lorealprofessionnel/so.city/tracxn/
     dnb/webindia123/vyaparify/linkcentre/etc.).
   - If only directories/social OR no hits -> genuine no-website lead.
   - If a real own domain -> discard (has site).
5. Save final JSON: name, category, osm_phone, verify status, evidence, lat, lon.

## Output
`C:/jarvis/projects/hunter_leads/CLEAN_NO_WEBSITE_LEADS.json` (or notify path).

## Caveats
- OSM-only entries with "no web hits" may be stale/thin OSM nodes, not active businesses
  — confirm phone/address before outreach.
- Real-estate/interior tiers have many genuine no-site but LOW Hunter priority vs salons.
  Sort salon/beauty first.
- To get TRUE Google Business Profile data (ratings, real phones, reviews), recharge the
  Apify account (console.apify.com/billing) — Engine 1 then works.

## Recharge decision
If user wants real Google leads, do NOT loop the MCP. Either (a) recharge Apify, or
(b) use this OSM+verify method for the website-gap signal only.
