# Research Summary: Inventar

**Project:** Home inventory webapp as a Home Assistant add-on
**Synthesized:** 2026-04-14
**Research files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

Inventar is a local-first home inventory tracker deployed as an HA add-on. The recommended
approach is a Python/FastAPI backend serving a React SPA, with SQLite as the datastore,
all running in a single Docker container managed by the HA Supervisor. The stack is
low-overhead on a NUC, requires no additional services, and fits naturally into the HA
add-on model. The UI is accessed through HA ingress, which provides HTTPS termination
and sidebar embedding at zero cost to the application.

The central UX lesson from competitive analysis is: match Grocy data model depth
(locations, thresholds, categories, transaction history) but invert its UX philosophy.
Grocy requires extensive setup before first use; Inventar should deliver immediate value
from the first scan with progressive complexity. The barcode scan flow is the primary
onboarding path and must be friction-free. Most users scan existing items more often than
they add new ones, so the update-quantity path is more important than add-new-item.

The dominant risks are all infrastructure-level: the ingress path prefix breaks SPAs that
use absolute URLs, the camera API requires HTTPS (provided by ingress), and data written
outside /data is silently lost on container updates. All three must be solved in Phase 1
before any feature work begins. Subsequent feature risks are well-understood and
addressable with the specific schema and API design choices documented in this research.

---

## Key Findings

### Stack (from STACK.md)

| Technology | Version | Decision |
|------------|---------|----------|
| Python | 3.11+ | Backend runtime; pre-installed in HA base images |
| FastAPI | 0.110+ | REST API; async, auto-docs, minimal boilerplate |
| Uvicorn | 0.29+ | ASGI server; single process correct at this scale |
| React | 18.x | Frontend SPA; best barcode library compatibility |
| Vite | 5.x | Build tool; base must be "./" for ingress compatibility |
| SQLite | 3.x | Database; WAL mode; /data/inventar.db |
| html5-qrcode | latest | Barcode scanning; handles iOS quirks |
| httpx | 0.27+ | Async HTTP client for Open Food Facts lookups |
| SQLAlchemy core | 2.x | Query builder only; no full ORM needed |
| Alembic | 1.x | Schema migrations across add-on updates |

Explicitly rejected: Node.js backend (doubles runtime footprint), Django (overweight),
Nginx inside container (FastAPI StaticFiles sufficient), JWT/custom auth (HA ingress
handles auth), QuaggaJS original (unmaintained since ~2017).

Critical build requirement: Vite base must be "./" not "/".

### Features (from FEATURES.md)

Table stakes for v1:
- Add item: barcode scan + manual entry
- Quantity tracking: exact count AND fuzzy status (have/low/out) from day 1
- Storage location per item (explicitly requested; clear whitespace vs all competitors)
- Category organization: Food and Pantry, Fridge and Freezer, Cleaning and Household, Personal Care + custom
- Reorder threshold per item with auto-flagging
- Shopping list: auto-populated from flagged items + manual add
- Multi-user shared state (no auth; 2-3 household members; last-write-wins for v1)
- Mobile-friendly UI (barcode scanning happens on phones)

Differentiators to pursue:
- Storage location (no competitor does this well)
- Zero-setup onboarding: scan a barcode, done
- One-tap update for existing items as the primary scan path
- HA read-only sensor endpoint for dashboard display

Defer to v2+:
- Product images from Open Food Facts
- Hierarchical location display
- Bulk stock-up mode
- HA entity sensors per item (bidirectional)
- Consumption rate / smart reorder timing

Do not build unless user-validated:
- Expiry date tracking
- Recipe / meal planning
- Nutritional data
- Price tracking
- Native iOS/Android app

### Architecture (from ARCHITECTURE.md)

Backend components:
- Item Registry: catalog (what exists, independent of stock state)
- Stock Manager: state (how much, where, threshold)
- Category Manager: built-in + custom
- Location Manager: free-form named locations
- Transaction Log: immutable history, written from day 1
- Shopping List: derived query, server-persisted
- Barcode Resolver: OFFs proxy + barcode_cache table
- HA Sensor Bridge: Phase 2 only

Data model key decisions:
- items (catalog) and stock (state) are separate tables
- quantity is REAL and nullable; when NULL, status (have/low/out) is source of truth
- transactions table is append-only from day 1
- barcode_cache table prevents repeated OFFs API calls
- User identity from X-Remote-User-Name header; no separate users table needed

Barcode flow: Camera (browser) -> decoded string -> POST /api/v1/scan -> DB lookup ->
OFFs proxy (if new barcode) -> pre-filled form OR one-tap update (if item exists).

HA integration phases:
- v1: Sidebar embed via ingress, no additional code
- v2: GET /api/v1/ha/summary polled by HA REST sensor
- v3+: Push entities via Supervisor API

### Pitfalls (from PITFALLS.md)

Critical, must solve in Phase 1 scaffolding:

| Pitfall | Prevention |
|---------|------------|
| Data outside /data lost on update | DB at /data/inventar.db; map data:rw in config.yaml |
| Ingress breaks absolute URLs, blank app | Vite base "./"; inject X-Ingress-Path as window.__BASE_PATH__ |
| HAOS Docker constraints | HA base image; no privileged mode; amd64 for NUC v1 |

Critical, must solve in data model (Phase 1/2):

| Pitfall | Prevention |
|---------|------------|
| Integer-only quantity, users stop updating | quantity REAL nullable + status enum from day 1 |
| Free-text categories create duplicates | Categories as FK table entities, not strings |
| No audit trail, trust loss in household | last_updated_by + last_updated_at on stock; append-only transactions |

Critical, must solve in barcode scanning phase:

| Pitfall | Prevention |
|---------|------------|
| Camera API requires HTTPS, fails on phones | HA ingress provides HTTPS; never expose HTTP-only port |
| iOS Safari permission quirks | Gate getUserMedia behind user tap; playsinline on video; test on real iPhone |
| OFFs rate limiting and bad data | Proxy through backend; cache; validate product_name; 3s timeout + fallback |
| QuaggaJS unmaintained | Use html5-qrcode |

Moderate, address in their respective phases:

| Pitfall | Phase | Prevention |
|---------|-------|------------|
| Shopping list lost on page refresh | Shopping list | Server-side persisted derived view |
| Reorder thresholds never configured | Shopping list | Default 1 for count-mode; LOW triggers for status-mode |
| Last-write-wins silent conflicts | Multi-user | Optimistic locking on updated_at |
| Too many required fields, abandonment | Barcode UX | Required: name and category only; smart defaults |
| HA Supervisor token confusion | HA integration | Use injected SUPERVISOR_TOKEN; URL http://supervisor/ |

---

## Implications for Roadmap

### Suggested Phase Structure

**Phase 1: Add-on Scaffolding**
Build the container first, features second. Every downstream phase depends on a correctly
configured add-on that boots, serves through ingress, and persists data.
Delivers: Working HA add-on showing placeholder page in HA sidebar.
Must resolve: data outside /data, absolute URL paths, HAOS Docker constraints.
Research flag: NONE. Well-documented stable HA patterns.

**Phase 2: Data Model and Item CRUD**
Define the full schema upfront, then build manual item management. The barcode flow
pre-fills this form, so it must exist before barcode scanning is built.
Delivers: Full inventory CRUD via forms; category and location management; transaction
log; inventory list view filtered by category, location, and status.
Must resolve: flat quantity model, free-text categories, missing audit trail.
Research flag: NONE. Data model fully specified in ARCHITECTURE.md.

**Phase 3: Barcode Scanning**
Add the primary input method. All infrastructure must be in place first.
Delivers: Camera barcode scan; OFFs lookup with local cache; scan-to-form prefill;
one-tap quantity update for existing items.
Must resolve: HTTPS requirement, iOS Safari quirks, OFFs failure modes, library choice.
Research flag: VERIFY OFFs API v2 endpoint and current rate limit behavior before coding.

**Phase 4: Shopping List and Alerts**
Build the reorder workflow on top of the stable quantity model.
Delivers: Auto-populated shopping list; reorder thresholds with smart defaults;
mark-as-purchased action; in-app threshold alerts.
Must resolve: thresholds never configured, list lost on page refresh.
Research flag: NONE.

**Phase 5: HA Display Integration**
Expose inventory data to HA dashboards. Intentionally last: requires stable data model,
minimal frontend changes, delivers outsized value to HA users.
Delivers: GET /api/v1/ha/summary JSON endpoint; HA REST sensor configuration example.
Must resolve: Supervisor token confusion (REST sensor approach avoids this entirely).
Research flag: NONE. REST sensor requires no Supervisor API calls.

### Phase Order Rationale

- Phase 1 before everything: ingress and /data must be correct or all later work breaks.
- Phase 2 before Phase 3: barcode flow targets the item form; form must exist first.
- Phase 4 after Phase 2: reorder thresholds depend on stable quantity model.
- Phase 5 last: purely additive; no risk to core inventory phases.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| HA add-on structure (config.yaml, ingress, /data) | HIGH | Stable and well-documented since 2022 |
| FastAPI + SQLite backend | HIGH | Mature, widely deployed combination |
| Barcode scanning via html5-qrcode | HIGH | Stable library; browser camera APIs stable |
| Open Food Facts API structure and coverage | HIGH | Free, open data; format stable for years |
| Data model (items/stock split, transactions) | HIGH | Standard inventory pattern; no external deps |
| Feature scope (table stakes vs differentiators) | MEDIUM | Training data analysis of Grocy and community posts |
| Ingress header exact names | MEDIUM | Verify against current HA Supervisor source before coding |
| Multi-arch Docker base image tag format | MEDIUM | Verify ghcr.io/home-assistant/amd64-base-python format |
| OFFs rate limits | MEDIUM | Undocumented; household scale should be safe; verify |

Overall: HIGH. MEDIUM items are all verifiable in one documentation pass before Phase 1.

---

## Open Questions (Verify Before Coding)

Five items need live documentation checks. None block architecture decisions.

1. Ingress header names: confirm X-Remote-User-Name vs X-Hass-User-Name, and
   X-Ingress-Path vs X-HA-Ingress-Path.
   Source: https://developers.home-assistant.io/docs/add-ons/ingress

2. Base image tag format: confirm ghcr.io/home-assistant/amd64-base-python:3.12 is
   current, or whether ARG BUILD_FROM + build.yaml pattern is preferred.
   Source: https://github.com/home-assistant/docker-base

3. config.yaml field names: confirm panel_icon, panel_title still valid; confirm
   map: [data:rw] syntax is current.
   Source: https://developers.home-assistant.io/docs/add-ons/configuration

4. OFFs API version: STACK.md references api/v2/, ARCHITECTURE.md uses api/v0/.
   Confirm which is current and preferred.
   Source: https://openfoodfacts.github.io/openfoodfacts-server/api/

5. html5-qrcode maintenance status: verify actively maintained with no critical iOS
   Safari issues at implementation time.
   Source: https://github.com/mebjas/html5-qrcode

---

## Sources

All findings from training knowledge (cutoff August 2025). No live web access during research.

- Home Assistant Add-on Developer Docs: https://developers.home-assistant.io/docs/add-ons/
- HA Add-on Ingress: https://developers.home-assistant.io/docs/add-ons/ingress
- HA Add-on Configuration: https://developers.home-assistant.io/docs/add-ons/configuration
- Open Food Facts API: https://openfoodfacts.github.io/openfoodfacts-server/api/
- html5-qrcode: https://github.com/mebjas/html5-qrcode
- zxing-js/browser: https://github.com/zxing-js/library
- FastAPI docs: https://fastapi.tiangolo.com/
- SQLite WAL mode: https://www.sqlite.org/wal.html
- Grocy (competitive reference): https://github.com/grocy/grocy
