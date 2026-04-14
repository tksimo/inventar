# Architecture Patterns

**Domain:** Home inventory webapp — HA add-on deployment
**Researched:** 2026-04-14
**Confidence:** MEDIUM (HA add-on structure from training knowledge through Aug 2025; no live doc verification available)

---

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Home Assistant UI (browser)                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Sidebar → "Inventar" → HA Ingress proxy               │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │ https://<ha>/api/hassio_ingress/  │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│  Docker container (HA add-on)                                │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  FastAPI / Node server  (port 8099, ingress target)    │  │
│  │  ├── Static SPA assets  (Svelte/React build)           │  │
│  │  ├── REST API  /api/v1/...                             │  │
│  │  └── WebSocket (optional, for real-time qty updates)   │  │
│  └───────────────────────┬────────────────────────────────┘  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  SQLite  /data/inventar.db  (HA /data mount)           │  │
│  └────────────────────────────────────────────────────────┘  │
│  /data/  ← persistent volume provided by Supervisor         │
└──────────────────────────────────────────────────────────────┘
                           │
                 (external, optional)
                           │
                    Open Food Facts API
                    (barcode lookup, HTTPS)
```

---

## Home Assistant Add-on Structure

### Required Files

```
inventar/
├── config.yaml          # Add-on manifest (replaces config.json in newer HA)
├── Dockerfile
├── run.sh               # Entrypoint script (called by S6 or directly)
└── rootfs/              # Overlaid onto container filesystem
    └── etc/
        └── s6-overlay/  # Optional: s6 service definitions
```

### config.yaml (Manifest)

Key fields for an ingress-served webapp:

```yaml
name: "Inventar"
version: "1.0.0"
slug: "inventar"
description: "Home inventory tracker"
arch:
  - amd64
  - aarch64
ingress: true
ingress_port: 8099        # Port your server listens on inside the container
ingress_entry: "/"        # Path prefix for the app (passed as X-Ingress-Path header)
panel_icon: "mdi:archive-outline"
panel_title: "Inventar"
options: {}               # User-configurable options (none needed for v1)
schema: {}
map:
  - data:rw               # Gives /data persistent storage
hassio_api: false         # Don't need Supervisor API for v1
homeassistant_api: false  # Don't need HA core API for v1 (sensors come later)
```

**Notes on fields:**
- `ingress: true` tells Supervisor this add-on serves a UI through the proxy
- `ingress_port` must match what the server inside the container binds to
- `map: [data:rw]` is essential — this is the only path that survives container restarts
- `panel_icon` and `panel_title` control the HA sidebar entry
- `homeassistant_api: true` is needed only when pushing sensor entities to HA core (Phase 2+)

### Dockerfile Pattern

```dockerfile
ARG BUILD_FROM
FROM $BUILD_FROM  # ghcr.io/home-assistant/{arch}-base-python:3.12

# Install app dependencies
COPY requirements.txt /app/
RUN pip install -r /app/requirements.txt

COPY app/ /app/
COPY run.sh /
RUN chmod +x /run.sh

CMD ["/run.sh"]
```

`$BUILD_FROM` is injected by the HA build system from `build.yaml`. Using HA base images gives access to S6 overlay and correct arch support.

### run.sh Pattern

```bash
#!/usr/bin/with-contenv bashio
# bashio is available in HA base images — provides logging helpers

bashio::log.info "Starting Inventar..."
cd /app
exec python -m uvicorn main:app --host 0.0.0.0 --port 8099
```

---

## Ingress: How It Works

**Flow:**
1. User clicks "Inventar" in HA sidebar
2. HA frontend navigates to `https://<ha-host>/api/hassio_ingress/<token>/`
3. HA Supervisor reverse-proxies the request to the add-on container on `ingress_port`
4. Supervisor injects headers:
   - `X-Ingress-Path: /api/hassio_ingress/<token>` — the path prefix the app is mounted at
   - `X-Remote-User-Id`, `X-Remote-User-Name`, `X-Remote-User-Display-Name` — HA user identity
   - `X-Hass-User-ID` — HA user ID (numeric)
5. App receives requests at `/`, strips nothing — the Supervisor handles path rewriting

**Critical implementation requirements:**
- The app server must bind to `0.0.0.0` (not `127.0.0.1`) on `ingress_port`
- All asset URLs in the SPA must be relative (not absolute) — or use the `X-Ingress-Path` header to prefix them
- The SPA base href must be set dynamically. The cleanest approach: serve `index.html` from the backend and inject the ingress path as a `<base href>` tag, or use a `/config` endpoint the SPA fetches before mounting
- WebSocket connections through ingress work but require the WS upgrade to be proxied — test this explicitly

**Authentication:** Supervisor handles authentication. Requests reaching the add-on are already authenticated against HA users. The `X-Remote-User-*` headers identify who is making the request — no separate auth layer needed for household use.

---

## Component Breakdown

### Backend Components

| Component | Responsibility |
|-----------|---------------|
| Item Registry | CRUD for items: name, barcode, category, unit, image_url |
| Stock Manager | Current quantity, status enum, location, last_updated, last_updated_by |
| Category Manager | Built-in + custom categories |
| Location Manager | Named locations (free-form strings, optionally hierarchical) |
| Transaction Log | Immutable history: item_id, delta, reason, user, timestamp |
| Shopping List | Derived view: items where quantity <= reorder_threshold or status = OUT |
| Barcode Resolver | Outbound call to Open Food Facts; cache results in DB |
| HA Sensor Bridge | (Phase 2) Push entities to HA via REST API |

### Frontend Components

| Component | Responsibility |
|-----------|---------------|
| Inventory View | Filterable/searchable item grid with status indicators |
| Scanner View | Camera feed + ZXing/barcode-detector; triggers lookup flow |
| Item Detail / Edit | Full item form; inline quantity adjustment |
| Shopping List View | Flagged items; one-tap "add to cart" / mark acquired |
| Location Browser | Items grouped by storage location |
| Settings / Admin | Manage categories, locations, add-on options |

---

## Data Model

### Core Tables (SQLite)

```sql
-- Items: the product catalog (what exists, not how much)
CREATE TABLE items (
    id          INTEGER PRIMARY KEY,
    barcode     TEXT UNIQUE,          -- EAN-13 / UPC-A / QR; nullable for manual items
    name        TEXT NOT NULL,
    brand       TEXT,
    category_id INTEGER REFERENCES categories(id),
    unit        TEXT DEFAULT 'units', -- "units", "g", "ml", "kg", etc.
    image_url   TEXT,                 -- from Open Food Facts or user-supplied
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock: one row per item (current state)
CREATE TABLE stock (
    item_id           INTEGER PRIMARY KEY REFERENCES items(id),
    location_id       INTEGER REFERENCES locations(id),
    quantity          REAL,           -- NULL when using status-only mode
    status            TEXT CHECK(status IN ('have','low','out')) DEFAULT 'have',
    reorder_threshold REAL,           -- NULL = no threshold set
    last_updated      DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated_by   TEXT            -- HA username from X-Remote-User-Name
);

-- Transactions: immutable audit log
CREATE TABLE transactions (
    id          INTEGER PRIMARY KEY,
    item_id     INTEGER REFERENCES items(id),
    delta       REAL,                 -- +N added, -N consumed; NULL for status-only
    new_status  TEXT,                 -- set when status changed
    reason      TEXT,                 -- "scan_add", "scan_remove", "manual", "shopping_list"
    user_name   TEXT,
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE categories (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    icon       TEXT,
    sort_order INTEGER DEFAULT 0,
    is_builtin INTEGER DEFAULT 0      -- 1 = built-in (Food, Fridge, Cleaning, Personal Care)
);

-- Locations
CREATE TABLE locations (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE, -- "Kitchen cabinet top shelf", "Bathroom under sink"
    description TEXT
);

-- Barcode cache (avoid re-fetching Open Food Facts)
CREATE TABLE barcode_cache (
    barcode     TEXT PRIMARY KEY,
    payload     TEXT NOT NULL,        -- JSON from Open Food Facts
    fetched_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key design decisions:**
- Items (catalog) and Stock (state) are separate tables. An item exists independently of whether it's currently stocked — this makes history and re-adding clean
- Quantity is REAL and nullable — when null, status is the source of truth. This supports both "I have 3 rolls of paper towels" and "I have toilet cleaner (have/low/out)"
- Transactions are append-only; never update or delete rows. This makes the audit log reliable and enables "undo last action"
- `last_updated_by` in stock and `user_name` in transactions use the HA username string — no separate user table needed at household scale

### Derived: Shopping List Query

```sql
SELECT i.*, s.*, c.name as category_name, l.name as location_name
FROM items i
JOIN stock s ON s.item_id = i.id
LEFT JOIN categories c ON c.id = i.category_id
LEFT JOIN locations l ON l.id = s.location_id
WHERE s.status = 'out'
   OR (s.status = 'low')
   OR (s.reorder_threshold IS NOT NULL AND s.quantity <= s.reorder_threshold)
ORDER BY c.sort_order, i.name;
```

---

## Barcode Lookup Flow

```
Phone camera
     │
     ▼
ZXing-js / BarcodeDetector API (browser)
     │  decoded barcode string
     ▼
POST /api/v1/scan  { barcode: "5000112637922" }
     │
     ├── DB lookup: items.barcode = ?
     │     ├── FOUND → return item + current stock  →  "Update quantity?" UI
     │     └── NOT FOUND
     │           │
     │           ├── DB lookup: barcode_cache
     │           │     ├── FOUND (< 30 days old) → use cached payload
     │           │     └── NOT FOUND → fetch Open Food Facts API
     │           │           │  GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json
     │           │           │  Store response in barcode_cache
     │           │
     │           └── Map OFf payload → pre-filled item form
     │                 name, brand, category suggestion, image_url
     │                 ▼
     │           User confirms/edits → POST /api/v1/items  (creates item + stock row)
     │
     └── Return: { found: bool, item?: Item, prefill?: PrefillData }
```

**Handling unknown barcodes (not in Open Food Facts):** Return a blank form with the barcode pre-filled. User types the name manually. This covers household products and regional items OFf doesn't index.

**Offline / OFf unreachable:** If the OFf fetch fails, proceed with empty prefill. Log a warning. The add-on is local-only so internet may be intermittent — never block the scan flow on external availability.

---

## HA Integration Patterns

### v1: Display-Only (iframe)

Add a panel or dashboard card pointing to the ingress URL. No code required beyond the add-on serving correctly through ingress. The Supervisor ingress token is stable per installation.

```yaml
# In a HA dashboard YAML card:
type: iframe
url: /api/hassio_ingress/<token>/
aspect_ratio: "100%"
```

The add-on sidebar entry created by `panel_icon` / `panel_title` in config.yaml is functionally equivalent and simpler.

### v2: REST Sensor (Phase 2 option)

Expose a JSON endpoint from the add-on that HA core polls as a REST sensor:

```yaml
# configuration.yaml
sensor:
  - platform: rest
    name: "Inventory low items count"
    resource: "http://localhost:8099/api/v1/ha/summary"
    value_template: "{{ value_json.low_count }}"
    json_attributes:
      - low_items
      - out_items
```

This requires the add-on to bind on a port accessible to HA core (the `ports` field in config.yaml, not just ingress). Alternatively, use `homeassistant_api: true` and push state via the Supervisor API — but the REST sensor approach is simpler and doesn't require Supervisor API authentication.

### v3: Native Entity Push (future)

With `homeassistant_api: true` in config.yaml, the add-on can call the HA WebSocket API to create/update entities. This is Phase 3+ scope.

---

## Build Order (Dependency-Driven)

### Phase 1 — Core Infrastructure
**Goal:** Add-on boots, serves a page, persists data.

1. `config.yaml` + `Dockerfile` + `run.sh` — valid add-on manifest
2. SQLite setup with migrations (Alembic or hand-rolled)
3. FastAPI skeleton with health endpoint
4. Ingress compatibility: base-href injection, relative asset URLs
5. Minimal SPA shell (router, nav)

Dependency: Everything downstream requires this.

### Phase 2 — Item Management (no barcode)
**Goal:** Full CRUD for items + stock via forms.

1. Categories + Locations CRUD
2. Items CRUD (manual entry)
3. Stock row creation / quantity update
4. Transaction log write on every stock change
5. Inventory list view with filter by category / location / status

Dependency: Barcode flow pre-fills this form, so form must exist first.

### Phase 3 — Barcode Scanning
**Goal:** Scan → lookup → create/update in one flow.

1. Browser barcode scanner component (ZXing-js or BarcodeDetector API)
2. `POST /api/v1/scan` endpoint + OFf client + barcode_cache table
3. Scan-to-form pre-fill UX
4. "Quick adjust" screen (scan existing item → tap +/-)

Dependency: Phase 2 items form must exist for the pre-fill target.

### Phase 4 — Shopping List + Alerts
**Goal:** Actionable reorder workflow.

1. Shopping list query + view
2. Reorder threshold per item (stock.reorder_threshold)
3. "Mark as purchased" action (clears flag, optionally restocks)
4. In-app alert banner for items below threshold

Dependency: Requires stable quantity/status model from Phase 2.

### Phase 5 — HA Display Integration
**Goal:** Inventory data visible on HA dashboards.

1. `GET /api/v1/ha/summary` JSON endpoint (low count, out count, list)
2. HA REST sensor configuration documentation
3. Optional: example dashboard YAML with Markdown card showing low items

Dependency: Requires stable data model; no frontend changes needed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Absolute Asset URLs in SPA
**What:** Hardcoding `/static/bundle.js` or `http://localhost:8099/...` in the frontend build.
**Why bad:** HA ingress mounts the app at a dynamic path. Absolute paths break all asset loads, the app renders blank.
**Instead:** Use relative URLs (`./static/bundle.js`) and set `<base href>` dynamically from the `X-Ingress-Path` header at index.html render time.

### Anti-Pattern 2: Binding to 127.0.0.1
**What:** Server starts with `--host 127.0.0.1`.
**Why bad:** Supervisor proxies from outside the container's loopback. Requests never reach the server.
**Instead:** Always bind to `0.0.0.0`.

### Anti-Pattern 3: Storing Data Outside /data
**What:** Writing SQLite to `/app/inventar.db` or `/tmp/`.
**Why bad:** Everything outside `/data` is ephemeral — wiped on update or reinstall.
**Instead:** `/data/inventar.db` — the Supervisor mounts this as persistent storage.

### Anti-Pattern 4: Blocking Scan Flow on External API
**What:** `POST /scan` waits synchronously for Open Food Facts, returns error if unreachable.
**Why bad:** Home network may have no internet access intermittently. Scan fails for unknown items when OFf is down.
**Instead:** Fire OFf fetch with a short timeout (3s), fall back to empty prefill, cache successful responses.

### Anti-Pattern 5: Single items Table for Both Catalog and Stock State
**What:** `quantity` and `location_id` as columns on the items table.
**Why bad:** Can't have the same product stocked in multiple locations; history joins become awkward; "out of stock" means deleting the item.
**Instead:** Separate `items` (catalog) and `stock` (state) tables with 1:1 relationship for v1. Can become 1:N later if multi-location stocking is needed.

### Anti-Pattern 6: Port-Forwarding the Ingress Port
**What:** Adding `ports: ["8099/tcp:8099"]` to expose the app directly on the host.
**Why bad:** Bypasses HA authentication entirely — any device on the local network can access inventory without login.
**Instead:** Ingress-only. If direct port access is needed for HA REST sensors, use a separate non-ingress port only accessible to HA core (127.0.0.1 binding inside the HA network).

---

## Scalability Considerations

This app is scoped to 2-3 users on a single household NUC. Scalability is not a design concern. The relevant operational concern is **reliability on constrained hardware:**

| Concern | Approach |
|---------|----------|
| SQLite concurrency (3 users) | WAL mode (`PRAGMA journal_mode=WAL`) — handles concurrent reads with single writer cleanly |
| Memory footprint | Single Python/Node process, no worker pool needed; target < 100MB RSS |
| Startup time | HA Supervisor waits for the add-on; keep startup under 5s |
| DB backup | `/data` is included in HA snapshot/backup — no separate backup logic needed |

---

## Sources

**Confidence notes:** All HA add-on structure claims (config.yaml fields, ingress headers, Supervisor mount points, base image names) are from training knowledge through August 2025. External search tools were unavailable during this research session. The HA developer documentation at `developers.home-assistant.io/docs/add-ons/` should be consulted to verify:
- Current config.yaml field names (some were renamed from config.json era)
- Exact ingress header names (`X-Ingress-Path` vs `X-HA-Ingress-Path`)
- Current base image tags (`ghcr.io/home-assistant/{arch}-base-python`)
- Whether `panel_icon`/`panel_title` are still config.yaml fields or moved to a separate UI registration

Everything else (data model, barcode flow, component breakdown, SQLite patterns) is implementation-level design that does not depend on external verification.
