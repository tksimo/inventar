# Technology Stack

**Project:** Inventar — Home Inventory Webapp
**Researched:** 2026-04-14
**Confidence note:** No live web access was available during this research. All findings are from training knowledge (cutoff August 2025). Confidence levels are assigned per section.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.11+ | Backend runtime | Ships in all HA add-on base images; strong ecosystem for REST APIs and SQLite; no Node.js runtime overhead |
| FastAPI | 0.110+ | REST API framework | Async, auto-generates OpenAPI docs, minimal boilerplate, excellent for small-to-medium APIs; lighter than Django, more structured than Flask |
| Uvicorn | 0.29+ | ASGI server | The standard production server for FastAPI; single process is fine at household scale |
| React | 18.x | Frontend UI | Large ecosystem, excellent barcode library compatibility, strong PWA support for phone camera access; Vite build toolchain keeps bundle small |
| Vite | 5.x | Frontend build tool | Fast HMR in dev, produces optimized static bundles; FastAPI can serve the built static files, eliminating a separate web server |

**Backend serves the built frontend static files directly.** No separate Nginx/Caddy needed inside the container — Uvicorn + FastAPI's `StaticFiles` mount handles it. This keeps the Docker image minimal and the add-on config simple.

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| SQLite | 3.x (system) | Primary datastore | See "Database Choice" section below |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker (HAOS managed) | — | Container runtime | Provided by HA Supervisor; add-on author only needs a Dockerfile |
| HA Supervisor | — | Add-on lifecycle, ingress proxy, auth | Handles HTTPS termination, sidebar embedding, port routing |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `html5-qrcode` or `@zxing/browser` | see Barcode section | Barcode scanning | Phase that implements scan-to-add |
| SQLAlchemy (core, not ORM) | 2.x | SQL query builder + connection pooling | Keeps SQL readable without full ORM overhead; or use raw `sqlite3` if schema is simple |
| Alembic | 1.x | Database migrations | Any phase that modifies the schema after initial deployment |
| Pydantic | 2.x | Request/response validation | Comes with FastAPI; use for all API models |
| `httpx` | 0.27+ | Outbound HTTP (barcode lookups) | When calling Open Food Facts API from backend |
| `python-multipart` | — | Form data / file uploads | If barcode images are ever uploaded server-side |

### Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | FastAPI | Flask | Flask has no async, no built-in validation, more boilerplate for a REST API |
| Backend framework | FastAPI | Node.js/Express | Adds a second runtime to the image; Python already present in HA base images |
| Backend framework | FastAPI | Django | Full ORM, admin, auth framework is overkill for a 2-3 user local app |
| Frontend framework | React | Vue 3 | Either works; React chosen for broader barcode library support and larger community |
| Frontend framework | React | HTMX + Jinja2 | Simpler server-side rendering path, but camera/barcode UX requires heavy JS anyway — React is appropriate here |
| Build tool | Vite | Webpack/CRA | CRA is deprecated; Vite is faster and produces smaller bundles |

---

## Barcode Scanning

**Confidence: HIGH** — This is a stable, well-documented browser capability area.

### Recommended: `html5-qrcode`

- **Library:** `html5-qrcode` (npm: `html5-qrcode`, GitHub: `mebjas/html5-qrcode`)
- **Why:** Purpose-built for in-browser camera scanning; handles camera permissions, stream lifecycle, and multi-format barcode decoding in a single package; well-maintained as of 2025; works on iOS Safari (15.4+) and Android Chrome
- **Formats supported:** QR, EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, and more — covers all standard grocery/household product barcodes
- **Usage pattern:** Mount a `<div>` element, instantiate `Html5QrcodeScanner`, pass a callback. No native app or plugin required.

```typescript
import { Html5QrcodeScanner } from "html5-qrcode";

const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
scanner.render((decodedText) => {
  // decodedText is the barcode value (e.g. "5000112637939")
  scanner.clear();
  onBarcodeScanned(decodedText);
}, () => {});
```

### Alternative: `@zxing/browser`

- **Library:** `@zxing/browser` (ZXing-JS, Google's ZXing port)
- **Strengths:** More control over camera selection, active development
- **Weakness:** Lower-level API requires more integration code; `html5-qrcode` uses ZXing under the hood anyway
- **Use when:** You need precise camera control (e.g. rear camera selection, torch/flashlight API)

### Browser Requirements

- **HTTPS or localhost required** — `getUserMedia()` (camera access) is gated behind a secure context. HA's ingress proxy provides HTTPS automatically. Local LAN access over HTTP will **not** work for camera scanning unless the user connects via `homeassistant.local` (which uses HTTPS).
- **iOS Safari 15.4+** — `BarcodeDetector` API not available on iOS; `html5-qrcode` uses its own decoder (ZXing WASM) instead, which works.
- **Android Chrome** — Full support including native `BarcodeDetector` API if desired.

### Native BarcodeDetector API (Web Platform)

Chrome/Edge (desktop and Android) support `BarcodeDetector` natively since ~2023. Safari does not. `html5-qrcode` polyfills this gap. **Do not use `BarcodeDetector` directly** — it will silently fail on iOS.

---

## Product Databases

**Confidence: HIGH** for Open Food Facts; MEDIUM for others.

### Primary: Open Food Facts

- **URL:** `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- **Coverage:** 3M+ products globally; best coverage for European and North American grocery items
- **Authentication:** None required for read access; anonymous requests are permitted
- **Rate limits:** Unofficial — no hard published limit for read-only lookups. For a household app doing single-item lookups on demand, this is not a concern. Add a user-agent header identifying your app as per their API guidelines.
- **Key fields returned per product:**
  - `product.product_name` — display name
  - `product.brands` — brand name
  - `product.categories_tags` — hierarchical categories
  - `product.image_url` / `product.image_front_url` — product image
  - `product.quantity` — package size (e.g. "500g")
  - `product.nutriments` — nutritional data (not needed for v1)
- **Integration pattern:** Backend receives barcode from frontend, calls OFF API, returns normalized product info. Do not call OFF directly from the browser — keeps the app's user-agent consistent and allows caching.

```python
# Backend endpoint pattern
import httpx

async def lookup_barcode(barcode: str) -> dict | None:
    url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
    headers = {"User-Agent": "Inventar/1.0 (home-assistant-addon)"}
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=5.0)
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == 1:
                return data["product"]
    return None
```

### Alternative: Open Beauty Facts / Open Products Facts

- Same API format as Open Food Facts, different domain
- `https://world.openbeautyfacts.org/api/v2/product/{barcode}.json` — cosmetics/personal care
- `https://world.openproductsfacts.org/api/v2/product/{barcode}.json` — non-food household products
- **Strategy:** Try all three in sequence for a barcode not found in the primary DB. Adds latency; cache results locally in SQLite.

### UPC Item DB / Barcode Lookup APIs (commercial)

- Services like `upcitemdb.com`, `barcodelookup.com` exist
- **Recommendation: avoid for v1.** They have free tier limits (100-500 req/day), require registration, and OFF covers most grocery items. Add as fallback in a later phase if OFF coverage gaps are reported.

### Local Cache Strategy

Cache every successful OFF lookup in SQLite (`product_cache` table keyed by barcode). On subsequent scans of the same barcode, return the cached entry. This avoids repeated network calls, allows offline operation after first scan, and respects OFF's usage guidelines.

---

## HA Add-on Integration

**Confidence: HIGH** — HA add-on architecture is stable and well-documented.

### Add-on Structure

A minimal HA add-on requires:

```
inventar/
  config.yaml          # Add-on manifest
  Dockerfile           # Container definition
  run.sh               # Entrypoint script
  rootfs/              # Files copied into container filesystem
```

### config.yaml (key fields)

```yaml
name: "Inventar"
version: "0.1.0"
slug: "inventar"
description: "Home inventory tracker"
arch:
  - amd64
  - aarch64
  - armv7
ingress: true           # Enables sidebar embedding and HTTPS proxy
ingress_port: 8080      # Port your app listens on inside the container
panel_icon: mdi:package-variant
panel_title: Inventar
map:
  - share:rw            # Mount /share for persistent SQLite DB storage
options: {}
schema: {}
```

### Ingress (Sidebar Access)

**Ingress is the correct mechanism for sidebar-embedded add-ons.** When `ingress: true`:
- HA Supervisor proxies requests from the sidebar iframe through to your container's `ingress_port`
- HTTPS is handled by HA — your app speaks plain HTTP internally
- Users authenticate via HA's session; no separate login needed for the add-on UI
- The app receives requests at a path prefix like `/api/hassio_ingress/{token}/` — use `ingress_entry` from the Supervisor API or configure your app to work under any base path (React Router `basename`, FastAPI `root_path`)

**Critical:** Set `root_path` in Uvicorn to handle the ingress path prefix:
```python
# In run.sh or startup code
uvicorn main:app --host 0.0.0.0 --port 8080 --root-path $INGRESS_PATH
```
The `INGRESS_PATH` env var is injected by the Supervisor.

### Supervisor API

Available at `http://supervisor/` (or `$SUPERVISOR_API`) inside the container. Token is in `$SUPERVISOR_TOKEN`.

Useful endpoints:
- `GET /core/api/` — proxy to HA Core REST API (for writing sensor entities)
- `GET /addons/self/info` — get add-on's own ingress URL
- `POST /core/api/states/{entity_id}` — create/update a HA sensor entity

For v1 display-only integration, the simplest approach is exposing a REST endpoint on your add-on that HA's template sensors or REST integration can poll — **no Supervisor API calls needed from your side** for read-only display.

### HA REST API (v1 Integration)

To expose inventory data to HA dashboards:
- Add-on exposes `GET /api/inventory/summary` (returns JSON: item counts, low-stock list)
- HA's `rest` sensor platform polls this endpoint
- Data appears as sensor entities in HA, usable in dashboards

This is simpler than writing to `POST /core/api/states/` because it requires no `SUPERVISOR_TOKEN` handling in v1.

### Persistent Storage

Mount `/share` (or `/data` — add-on's own writable directory) for the SQLite database file. `/data` is private to the add-on and persists across restarts and updates. **Use `/data` not `/share`** for the DB — `/share` is for files meant to be accessed by other add-ons or the host.

```yaml
# config.yaml — /data is always available, no explicit mapping needed
# Just write your SQLite file to /data/inventar.db
```

---

## Database Choice

**Confidence: HIGH**

### Recommendation: SQLite

**Use SQLite. No qualification needed for this use case.**

| Criterion | Assessment |
|-----------|------------|
| Scale | 2-3 users, hundreds to low-thousands of items. SQLite handles millions of rows without tuning. |
| Concurrency | Multiple household members writing simultaneously: SQLite WAL mode handles this cleanly. At 2-3 concurrent users doing occasional writes, WAL is more than sufficient. |
| Deployment | Zero configuration, zero additional processes. The DB is a single file in `/data/`. |
| Backup | Copy one file. Can be included in HA's own backup mechanism via the `/data` mount. |
| Migrations | Alembic handles schema changes across add-on updates. |
| Ops burden | None. No credentials, no network connection, no daemon to manage. |

**WAL mode configuration (do on startup):**
```python
# In FastAPI startup event
import sqlite3
conn = sqlite3.connect("/data/inventar.db")
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("PRAGMA synchronous=NORMAL")
conn.close()
```

### Why Not Postgres

- Requires a second container or a separate add-on (e.g. the community Postgres add-on)
- Adds ~200MB+ to resource footprint on the NUC
- Absolute overkill for 2-3 users
- Complicates backup and the single-container add-on model

### Why Not Redis / Others

- No caching layer needed at this scale
- SQLite with WAL is fast enough for all read patterns here

---

## What NOT to Use

### Do Not Use: Node.js for the Backend

**Why:** Python is already present in HA base Docker images (`homeassistant/alpine-addon-base`). Adding Node.js doubles the runtime footprint. FastAPI is equally productive for REST APIs. The ecosystem advantage of Node.js (npm packages) only applies to the frontend, which Vite handles at build time — the built static files contain no Node.js at runtime.

### Do Not Use: Django

**Why:** Django's ORM, admin, migrations framework, and auth system are all solved differently in this project (SQLite direct/SQLAlchemy, no admin needed, Alembic, HA auth). Django's startup time and memory overhead are meaningful in a container on a NUC.

### Do Not Use: QuaggaJS (legacy version)

**Why:** The original `quaggajs` (Serratus fork and others) is effectively unmaintained as of 2023-2024. `html5-qrcode` superseded it for practical use. `quaggajs-2` exists but has less community traction. Use `html5-qrcode` instead.

### Do Not Use: Nginx Inside the Container

**Why:** FastAPI/Uvicorn can serve static files directly via `StaticFiles`. Adding Nginx adds ~10MB to the image, a second process to supervise, and a config file to maintain. The ingress proxy in HA Supervisor already handles TLS and HTTP routing externally. Nginx inside the container provides no benefit.

### Do Not Use: JWT / Custom Auth

**Why:** HA's ingress mechanism handles authentication at the proxy layer. Users are already authenticated to HA when they open the sidebar. Building a separate user auth system (JWT tokens, sessions, passwords) adds complexity with no user benefit. For the multi-user requirement (2-3 household members), identify users by their HA username passed via the `X-Ingress-User` or `X-Remote-User-Id` header that HA Supervisor injects.

### Do Not Use: Separate Frontend Dev Server in Production

**Why:** Vite is a dev tool. The production build (`vite build`) produces static files that FastAPI serves. The Docker image should contain only the built artifacts, not `node_modules` or the Vite dev server. Use a multi-stage Dockerfile: stage 1 builds the React app, stage 2 copies the `dist/` folder into the Python image.

### Do Not Use: External Cloud Services for Barcode Lookup (Primary)

**Why:** The app runs on a local network. Depending on a paid or rate-limited cloud API for core functionality (scanning items) creates a runtime dependency on internet connectivity. Open Food Facts is free, open-data, and has multi-million item coverage. Use it as primary, cache results locally, and accept "not found" gracefully.

---

## Installation Sketch

**Multi-stage Dockerfile (pattern):**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime image
FROM ghcr.io/home-assistant/amd64-base:3.19
WORKDIR /app
RUN apk add --no-cache python3 py3-pip
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/dist ./static
COPY run.sh /
RUN chmod +x /run.sh
CMD ["/run.sh"]
```

**Backend dependencies (requirements.txt):**
```
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
sqlalchemy>=2.0.0
alembic>=1.13.0
httpx>=0.27.0
python-multipart>=0.0.9
```

**Frontend dependencies:**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install html5-qrcode
npm install react-router-dom
```

---

## Sources

**Note:** No live web access was available during this research session. The following are the authoritative sources these findings are based on — verify against current docs before implementation.

- Home Assistant Add-on Developer Documentation: `https://developers.home-assistant.io/docs/add-ons/`
- HA Add-on Communication: `https://developers.home-assistant.io/docs/add-ons/communication`
- Open Food Facts API: `https://openfoodfacts.github.io/openfoodfacts-server/api/`
- html5-qrcode: `https://github.com/mebjas/html5-qrcode`
- FastAPI documentation: `https://fastapi.tiangolo.com/`
- SQLite WAL mode: `https://www.sqlite.org/wal.html`

**Confidence summary:**
| Area | Level | Reason |
|------|-------|--------|
| HA add-on architecture | HIGH | Stable, well-documented, unchanged since 2022 |
| FastAPI + SQLite backend | HIGH | Mature, widely deployed combination |
| Barcode scanning (html5-qrcode) | HIGH | Stable library, browser APIs well-established |
| Open Food Facts API | HIGH | Free, open, widely used — API format stable for years |
| HA ingress / X-Remote-User-Id header | MEDIUM | Header name should be verified against current HA Supervisor source before coding auth logic |
| Multi-arch Docker base image tags | MEDIUM | Base image tag (`amd64-base:3.19`) should be verified against current releases |
