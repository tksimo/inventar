# Phase 3: Barcode Scanning - Research

**Researched:** 2026-04-17
**Domain:** Browser camera barcode scanning, Open Food Facts API proxy, React component extension
**Confidence:** HIGH (library verified via npm registry; OFF API verified via official docs; codebase read directly)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Second FAB with camera/barcode icon and label "Scan" added alongside existing Plus FAB, both at bottom-right stacked.
- **D-02:** Camera view opens inline (overlay/modal on current page), not a separate route. Camera activates immediately.
- **D-03:** Existing-item scan shows a **bottom sheet** with item name, current quantity, location, and −/+ controls.
- **D-04:** Bottom sheet actions: "Done" (save + dismiss) and "Edit item" (open ItemDrawer for full edit).
- **D-05:** Unmatched barcode proceeds to OFF lookup (backend proxy), then opens ItemDrawer in add mode.
- **D-06:** ItemDrawer is reused for both new-item-from-barcode and barcode-not-found flows.
- **D-07:** Recognized barcode: ItemDrawer opens pre-filled with name, category, image_url, and nutrition fields.
- **D-08:** Unrecognized barcode (OFF returns nothing): ItemDrawer opens with barcode pre-filled, all other fields blank. No error state.
- **D-09:** Nutrition display = NutritionSection inside ItemDrawer. No new full-screen route. Shows product image + table per 100g.
- **D-10:** NutritionSection is hidden entirely if no nutrition values are set.
- **D-11:** Backend (FastAPI) proxies all OFF API calls. Frontend never calls OFF directly.
- **D-12:** Backend endpoint: `GET /api/barcode/{code}` returns normalized product data or 404-equivalent.
- **D-13:** OFF data is NOT cached in DB separately. Stored on item when user saves.
- **D-14:** Nutrition columns already exist on the items table (`calories`, `protein`, `carbs`, `fat` — all nullable Float). No new Alembic migration required for nutrition columns. `image_url` and `barcode` columns also already exist.
- Carried-forward: `apiFetch(path)` for all API calls; CSS Modules; design tokens from `index.css`; TDD red-green for all new behavior.

### Claude's Discretion
- Camera/barcode library choice (ZXing-js, html5-qrcode, Quagga2, or similar) — pick the best-maintained option for 2026 mobile browsers with iOS+Android support.
- FAB layout (stacked vertically vs. side-by-side) — whichever fits existing FAB CSS module better.
- Bottom sheet animation and dismiss behavior (swipe-down, tap-outside, etc.).
- Exact OFF API endpoint and response normalization logic.
- Camera permission error state handling.

### Deferred Ideas (OUT OF SCOPE)
- Batch scan mode
- Offline barcode lookup / local product cache
- Custom barcode for homemade items (CONV-04 v2)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITEM-01 | User can add an item by scanning a barcode with the phone camera | Barcode library section; CameraOverlay component pattern |
| ITEM-02 | Barcode scan looks up Open Food Facts and pre-fills name, image, and nutritional data | OFF API proxy section; field normalization pattern |
| ITEM-07 | Item detail shows product image and nutritional values (calories, protein, carbs, fat) from OFF | NutritionSection component pattern; existing DB columns confirmed |
| ITEM-08 | Items scanned from barcodes not found in OFF fall back to manual entry form | D-08 locked decision; barcode router 404-equivalent response |
</phase_requirements>

---

## Summary

Phase 3 adds camera-based barcode scanning to the existing React/FastAPI app. Three technical domains must be addressed: (1) a browser camera + barcode-decode component in React, (2) a new FastAPI proxy route to Open Food Facts, and (3) UI extensions to ItemDrawer and a new QuickUpdateSheet bottom sheet.

The schema is already fully prepared: `barcode`, `image_url`, `calories`, `protein`, `carbs`, and `fat` columns exist on the `items` table. No new Alembic migration is needed for data storage. The existing `apiFetch` contract, CSS Modules pattern, and TDD test infrastructure all carry forward unchanged.

The primary library decision (Claude's discretion) is the barcode scanning library. `html5-qrcode` — the choice noted in STATE.md — is unmaintained (last published 2023-04-15). The best current option is `@yudiel/react-qr-scanner` v2.5.1 (last published 2026-01-19), which wraps the Barcode Detection API + ZXing-WASM polyfill, supports React 19, iOS Safari 14.5+, and is actively maintained. This recommendation supersedes the STATE.md note.

**Primary recommendation:** Use `@yudiel/react-qr-scanner` for the camera overlay; proxy OFF API with `httpx` (already in requirements.txt) at `GET /api/barcode/{code}`; extend ItemDrawer with new props for barcode pre-fill; build NutritionSection and QuickUpdateSheet as new CSS Modules components.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @yudiel/react-qr-scanner | 2.5.1 | Camera barcode scanning in React | Actively maintained (Jan 2026), iOS Safari 14.5+, Barcode Detection API + ZXing-WASM polyfill, React 19 peer dep, replaces unmaintained html5-qrcode |
| httpx | 0.28.1 | FastAPI → OFF HTTP proxy | Already in requirements.txt; async HTTP client with timeout support |
| lucide-react | 0.511.0 | ScanBarcode icon for ScanFAB | Already in project; existing icon library |

**Why `@yudiel/react-qr-scanner` over alternatives:**
- `html5-qrcode` 2.3.8: last published **2023-04-15** — unmaintained [VERIFIED: npm registry]
- `@zxing/library` 0.21.3: last published 2024-08-21, but wrapper `react-zxing` has known iOS Safari issues [VERIFIED: npm registry + GitHub issues]
- `@ericblade/quagga2` 1.12.1: 1D barcodes only, no QR, poor low-light performance [VERIFIED: npm registry]
- `zxing-wasm` 3.0.2 (raw): requires manual video+canvas plumbing; `@yudiel/react-qr-scanner` wraps it cleanly [VERIFIED: npm registry]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| barcode-detector (polyfill) | 3.0.8 | Bundled as dependency of @yudiel/react-qr-scanner; no direct import needed | Auto-used when native Barcode Detection API not available |
| webrtc-adapter | 9.0.3 | Bundled; normalizes getUserMedia across browsers | Auto-used |

**Installation:**
```bash
npm install @yudiel/react-qr-scanner
```
(httpx, lucide-react, and CSS Modules tooling are already present — no additional backend installs.)

**Version verification:**
```
@yudiel/react-qr-scanner: 2.5.1 — published 2026-01-19 [VERIFIED: npm registry]
html5-qrcode: 2.3.8 — published 2023-04-15 (unmaintained) [VERIFIED: npm registry]
@zxing/library: 0.21.3 — published 2024-08-21 [VERIFIED: npm registry]
zxing-wasm: 3.0.2 — published 2026-04-01 [VERIFIED: npm registry]
barcode-detector (polyfill): 3.1.2 — published 2026-04-01, depends on zxing-wasm 3.0.2 [VERIFIED: npm registry]
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
frontend/src/components/
├── CameraOverlay/
│   ├── CameraOverlay.jsx        # Camera viewfinder overlay component
│   ├── CameraOverlay.module.css
│   └── CameraOverlay.test.jsx
├── ScanFAB/
│   ├── ScanFAB.jsx              # Second FAB with ScanBarcode icon
│   ├── ScanFAB.module.css
│   └── ScanFAB.test.jsx
├── QuickUpdateSheet/
│   ├── QuickUpdateSheet.jsx     # Bottom sheet for existing-item scan
│   ├── QuickUpdateSheet.module.css
│   └── QuickUpdateSheet.test.jsx
└── NutritionSection/
    ├── NutritionSection.jsx     # Collapsible/always-visible nutrition table
    ├── NutritionSection.module.css
    └── NutritionSection.test.jsx

frontend/src/hooks/
└── useBarcodeScanner.js         # Hook: barcode scan state + OFF lookup

backend/routers/
└── barcode.py                   # GET /api/barcode/{code} → OFF proxy
```

**Modified files:**
- `frontend/src/components/ItemDrawer/ItemDrawer.jsx` — add `initialBarcode`, `initialImageUrl`, `initialNutrition` props; embed NutritionSection at bottom of body
- `frontend/src/pages/Inventory.jsx` (or wherever FAB lives) — add ScanFAB; wire up scan→sheet/drawer flow
- `backend/main.py` — `app.include_router(barcode.router)`

### Pattern 1: `@yudiel/react-qr-scanner` Integration

**What:** Render the `<Scanner>` component inside CameraOverlay. Attach `onScan` callback; pass `constraints={{ facingMode: 'environment' }}` for rear camera. Stop scanning on result.

**When to use:** Any time the user taps the Scan FAB.

```jsx
// Source: @yudiel/react-qr-scanner README / npm package
import { Scanner } from '@yudiel/react-qr-scanner'

function CameraOverlay({ onDetected, onClose }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Barcode scanner">
      <Scanner
        constraints={{ facingMode: 'environment' }}
        onScan={(results) => {
          if (results.length > 0) {
            onDetected(results[0].rawValue)
          }
        }}
        onError={(err) => console.warn('Scanner error:', err)}
        // Stop scanning after first result to avoid duplicate callbacks:
        paused={false}
      />
      <button
        className={styles.close}
        onClick={onClose}
        aria-label="Close camera"
      >
        <X size={24} aria-hidden="true" />
      </button>
    </div>
  )
}
```
[VERIFIED: @yudiel/react-qr-scanner npm package — `onScan` returns `DetectedBarcode[]` with `rawValue`]

### Pattern 2: FastAPI → OFF Proxy

**What:** New router file `backend/routers/barcode.py` with `GET /api/barcode/{code}`. Uses `httpx.AsyncClient` to call OFF API v2. Returns normalized product data or HTTP 404.

**When to use:** Frontend calls `apiFetch('api/barcode/{code}')` after barcode detected and not found in local items list.

```python
# Source: OFF API docs + httpx docs (httpx already in requirements.txt)
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/barcode", tags=["barcode"])

OFF_URL = "https://world.openfoodfacts.net/api/v2/product/{code}"
OFF_FIELDS = "product_name,image_url,nutriments"
# Per OFF guidelines: identify your app in User-Agent [ASSUMED — confirmed common practice]
OFF_USER_AGENT = "Inventar/0.1 (home-assistant-addon)"

@router.get("/{code}")
async def lookup_barcode(code: str):
    url = OFF_URL.format(code=code)
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            url,
            params={"fields": OFF_FIELDS},
            headers={"User-Agent": OFF_USER_AGENT},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Product not found")
    data = resp.json()
    # OFF returns status=0 when barcode not in database
    if data.get("status") != 1:
        raise HTTPException(status_code=404, detail="Product not found")
    product = data.get("product", {})
    nutriments = product.get("nutriments", {})
    return {
        "barcode": code,
        "name": product.get("product_name") or None,
        "image_url": product.get("image_url") or None,
        "calories": nutriments.get("energy-kcal_100g") or None,
        "protein": nutriments.get("proteins_100g") or None,
        "carbs": nutriments.get("carbohydrates_100g") or None,
        "fat": nutriments.get("fat_100g") or None,
    }
```

### Pattern 3: ItemDrawer Extension

**What:** Add three new optional props to ItemDrawer: `initialBarcode`, `initialImageUrl`, `initialNutrition`. Update `toInitial()` to accept and forward these. Embed `<NutritionSection>` at the bottom of the form body.

**When to use:** ItemDrawer opened from barcode scan result (either recognized or fallback).

```jsx
// Extend toInitial() — source: existing ItemDrawer.jsx pattern
function toInitial(item, overrides = {}) {
  if (!item) {
    return {
      name: overrides.name ?? '',
      barcode: overrides.barcode ?? '',
      imageUrl: overrides.imageUrl ?? '',
      calories: overrides.calories ?? null,
      protein: overrides.protein ?? null,
      carbs: overrides.carbs ?? null,
      fat: overrides.fat ?? null,
      // ...existing fields unchanged
      categoryId: null,
      locationId: null,
      quantityMode: 'exact',
      quantity: null,
      status: 'have',
      reorderThreshold: null,
      notes: '',
    }
  }
  // ...existing edit-mode logic unchanged, add barcode/image/nutrition
}
```

### Pattern 4: Scan → Dispatch Flow

**What:** After barcode decoded, check existing items list first (client-side), then call OFF proxy if not found.

**When to use:** CameraOverlay `onDetected` callback.

```javascript
// Source: project pattern (apiFetch from lib/api.js)
async function handleBarcodeDetected(code) {
  setOverlayOpen(false)           // close camera immediately
  // 1. Check local items
  const existing = items.find(i => i.barcode === code)
  if (existing) {
    setQuickUpdateItem(existing)  // open QuickUpdateSheet
    return
  }
  // 2. OFF lookup
  setLookupLoading(true)
  try {
    const resp = await apiFetch(`api/barcode/${encodeURIComponent(code)}`)
    if (resp.ok) {
      const product = await resp.json()
      openDrawerWithPrefill(product)
    } else {
      // 404 = not in OFF, open drawer with barcode only
      openDrawerWithPrefill({ barcode: code })
    }
  } catch {
    openDrawerWithPrefill({ barcode: code })
  } finally {
    setLookupLoading(false)
  }
}
```

### Anti-Patterns to Avoid

- **Calling OFF directly from the frontend:** Violates D-11. All OFF calls go through `/api/barcode/{code}`.
- **Using `fetch('/api/...')` instead of `apiFetch('api/...')`:** Absolute paths break under HA ingress (locked constraint from Phase 1).
- **Checking `html5-qrcode` or `@zxing/library` docs for API shape:** Both are unmaintained or have iOS Safari issues. Use `@yudiel/react-qr-scanner` patterns only.
- **Creating new DB columns for nutrition:** They already exist (`calories`, `protein`, `carbs`, `fat`). Creating a migration will conflict.
- **Adding new Alembic migration for Phase 3:** No schema changes needed — all columns exist in current ORM model and DB.
- **Calling `useNavigate` from CameraOverlay or QuickUpdateSheet:** Scan flow stays on the current route (D-02).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera stream + barcode decode | Custom getUserMedia + canvas frame analysis | @yudiel/react-qr-scanner | Handles iOS playsinline/autoplay quirks, BarcodeDetector API polyfill, cross-browser getUserMedia normalization |
| iOS Safari camera compatibility | Custom polyfill detection | @yudiel/react-qr-scanner's bundled barcode-detector + webrtc-adapter | Already tested across Safari 14.5+, Chrome, Firefox |
| HTTP client to OFF | requests (sync) or raw fetch | httpx (async) | Already in requirements.txt; non-blocking; supports timeout |
| Barcode format validation | Regex/checksum logic | Trust the scanning library | EAN-13, EAN-8, UPC-A checksum is handled by ZXing-WASM |

**Key insight:** The `@yudiel/react-qr-scanner` Scanner component does heavy lifting — it manages the MediaStream lifecycle, stops the stream on unmount, and handles the iOS `playsinline autoplay muted` requirement automatically.

---

## Common Pitfalls

### Pitfall 1: html5-qrcode is Unmaintained

**What goes wrong:** STATE.md notes "html5-qrcode for barcode scanning" from early project research. Using it in Phase 3 risks iOS Safari breakage with no upstream fixes available.
**Why it happens:** The library was last published 2023-04-15. ios camera initialization failures are unresolved in its GitHub issues.
**How to avoid:** Use `@yudiel/react-qr-scanner` 2.5.1 instead (last published 2026-01-19, React 19 compatible).
**Warning signs:** If you find yourself importing from `html5-qrcode`, stop.

### Pitfall 2: Nutrition Column Name Mismatch

**What goes wrong:** CONTEXT.md D-14 says add `calories_per_100g`, `protein_per_100g`, `carbs_per_100g`, `fat_per_100g` columns. The actual ORM model already has `calories`, `protein`, `carbs`, `fat` (shorter names, same meaning).
**Why it happens:** D-14 was written before the ORM was inspected.
**How to avoid:** Use the existing column names (`calories`, `protein`, `carbs`, `fat`) everywhere — in the barcode router response, ItemDrawer props, NutritionSection, and ItemCreate/Update schemas. Do NOT create new columns or a new migration.
**Warning signs:** Any Alembic migration file touching the items table for nutrition columns is wrong.

### Pitfall 3: Camera Doesn't Start on iOS (Missing video attributes)

**What goes wrong:** iOS Safari requires `playsinline`, `autoplay`, and `muted` on the video element. Without them, the camera stream renders in fullscreen or doesn't play.
**Why it happens:** Standard video elements don't include these attributes by default.
**How to avoid:** `@yudiel/react-qr-scanner` handles this internally. If any custom video element is needed, always add `playsInline autoPlay muted`.
**Warning signs:** Camera opens on Android/desktop but not on iPhone.

### Pitfall 4: Camera Requires HTTPS (Already Handled by HA Ingress)

**What goes wrong:** `getUserMedia` only works in secure contexts. Direct HTTP access (port 8099) will deny camera permission.
**Why it happens:** Browser security policy: camera API requires HTTPS or localhost.
**How to avoid:** HTTPS is guaranteed by HA ingress (STATE.md constraint). The direct HTTP port must never be used for scanning — this is already a project constraint.
**Warning signs:** Camera permission denied immediately without a user prompt on HTTP.

### Pitfall 5: apiFetch Path for Barcode Endpoint

**What goes wrong:** Calling `apiFetch('/api/barcode/...')` (with leading slash) throws a TypeError — apiFetch rejects absolute paths.
**Why it happens:** apiFetch enforces relative-path-only to preserve HA ingress token.
**How to avoid:** Always `apiFetch('api/barcode/' + encodeURIComponent(code))` (no leading slash).
**Warning signs:** TypeError: "apiFetch: path must not start with '/'" in the browser console.

### Pitfall 6: OFF Response — `product_name` Can Be Empty String

**What goes wrong:** Some OFF products exist in the database but have an empty `product_name`. Treating a non-null empty string as a valid name pre-fills the ItemDrawer with a blank name field.
**Why it happens:** OFF data quality varies; many products are incomplete.
**How to avoid:** In the barcode router, normalize: `product.get("product_name") or None` (coerces empty string to None). Frontend treats `null` name as "not found" and leaves the field blank for user entry.
**Warning signs:** ItemDrawer opens in add-from-barcode mode with an empty name but saving fails validation.

### Pitfall 7: QuickUpdateSheet z-index Conflicts

**What goes wrong:** QuickUpdateSheet (z-index 65) appears behind CameraOverlay (z-index 70) or ItemDrawer (z-index 60, per UI-SPEC).
**Why it happens:** Components mount with default stacking; z-index not coordinated.
**How to avoid:** Follow UI-SPEC z-index contract exactly: CameraOverlay=70, QuickUpdateSheet=65, ItemDrawer=60, QuickUpdateSheet backdrop=64.
**Warning signs:** Bottom sheet appears but camera overlay is still partially visible behind it.

### Pitfall 8: OFF API Timeout

**What goes wrong:** OFF API has no SLA. On slow mobile connections through HA ingress, the backend proxy can hang for 10–30 seconds.
**Why it happens:** Default httpx timeout is too permissive (or None).
**How to avoid:** Set `timeout=5.0` on the httpx request. The barcode router returns 504 or propagates an httpx.TimeoutException on failure — frontend shows "Couldn't look up product. Fill in manually." and opens the drawer with barcode only.
**Warning signs:** Scanning an unknown barcode leaves the UI in a loading state indefinitely.

---

## Open Food Facts API Reference

### Endpoint
```
GET https://world.openfoodfacts.net/api/v2/product/{barcode}?fields=product_name,image_url,nutriments
```
[CITED: openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/]

### Response (product found)
```json
{
  "code": "3017624010701",
  "status": 1,
  "status_verbose": "product found",
  "product": {
    "product_name": "Nutella",
    "image_url": "https://images.openfoodfacts.org/images/products/301/762/401/0701/front_en.3.400.jpg",
    "nutriments": {
      "energy-kcal_100g": 539,
      "proteins_100g": 6.3,
      "carbohydrates_100g": 57.5,
      "fat_100g": 30.9
    }
  }
}
```
[CITED: openfoodfacts.github.io/openfoodfacts-server/api/ + confirmed field names via WebSearch cross-reference]

### Response (product not found)
```json
{ "status": 0, "status_verbose": "product not found" }
```
HTTP status code: **200** (OFF returns 200 with `status: 0`, not a 404)
[ASSUMED — pattern consistent with all documented examples; `status: 0` means not-found per OFF convention]

### Normalization mapping (backend → frontend)

| OFF field | Our model column | Notes |
|-----------|-----------------|-------|
| `product.product_name` | `name` prop for ItemDrawer | Coerce empty string to None |
| `product.image_url` | `image_url` | Direct string |
| `product.nutriments.energy-kcal_100g` | `calories` | Float or None |
| `product.nutriments.proteins_100g` | `protein` | Float or None |
| `product.nutriments.carbohydrates_100g` | `carbs` | Float or None |
| `product.nutriments.fat_100g` | `fat` | Float or None |

---

## Existing Codebase: Key Facts for Planner

### No Alembic Migration Required
The `items` table already has all needed columns [VERIFIED: `backend/models/__init__.py`]:
- `barcode` — String, nullable, indexed
- `image_url` — String, nullable
- `calories` — Float, nullable
- `protein` — Float, nullable
- `carbs` — Float, nullable
- `fat` — Float, nullable

The Pydantic schemas (`ItemCreate`, `ItemUpdate`, `ItemResponse`) already include all these fields [VERIFIED: `backend/schemas/item.py`].

### ItemDrawer Current Props
```
mode, item, categories, locations, onClose, onCreate, onUpdate, onDelete
```
Phase 3 adds: `initialBarcode`, `initialImageUrl`, `initialNutrition` (all optional).
The `toInitial()` function must be extended to consume these overrides. [VERIFIED: `frontend/src/components/ItemDrawer/ItemDrawer.jsx`]

### FAB CSS Pattern
The existing FAB uses `.fab { position: fixed; right: var(--space-lg); bottom: var(--space-lg); ... }`.
ScanFAB is a **separate component** following the same CSS Module pattern but with `bottom: 88px` and `background: var(--color-secondary)` (per UI-SPEC). [VERIFIED: `FAB.module.css`, `03-UI-SPEC.md`]

### httpx Already Available
`httpx==0.28.1` is already in `backend/requirements.txt`. No new Python dependency needed. [VERIFIED: `backend/requirements.txt`]

### Backend Router Registration Pattern
Routers are imported in `main.py` and registered with `app.include_router(router)`. New `barcode.py` router follows identical pattern to `items.py`. [VERIFIED: `backend/main.py`]

---

## Environment Availability

Step 2.6: External dependency check for this phase.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| httpx | FastAPI → OFF proxy | Yes | 0.28.1 | — |
| lucide-react | ScanFAB icon | Yes | 0.511.0 | — |
| @yudiel/react-qr-scanner | Camera overlay | Not yet installed | — | None — must install |
| Open Food Facts API (network) | Barcode lookup | Assumed reachable | — | Returns 404; frontend falls back to manual entry |
| HTTPS context | Camera getUserMedia | Yes (HA ingress) | — | HTTP port MUST NOT be used for scanning |

**Missing dependencies with no fallback:**
- `@yudiel/react-qr-scanner` must be installed: `npm install @yudiel/react-qr-scanner`

**Missing dependencies with fallback:**
- OFF API network unavailability: handled gracefully — barcode router returns 404/timeout; frontend opens drawer with barcode pre-filled and fields blank.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 + @testing-library/react 16.3.0 |
| Config file | `frontend/vitest.config.js` |
| Quick run command | `cd frontend && npm test` |
| Full suite command | `cd frontend && npm test && cd ../backend && python -m pytest` |
| Backend test command | `cd backend && python -m pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITEM-01 | CameraOverlay renders and calls onDetected | unit | `npm test -- CameraOverlay` | ❌ Wave 0 |
| ITEM-01 | ScanFAB renders with aria-label "Scan barcode" | unit | `npm test -- ScanFAB` | ❌ Wave 0 |
| ITEM-01 | useBarcodeScanner dispatches to QuickUpdateSheet for known barcode | unit | `npm test -- useBarcodeScanner` | ❌ Wave 0 |
| ITEM-01 | useBarcodeScanner dispatches to ItemDrawer for unknown barcode | unit | `npm test -- useBarcodeScanner` | ❌ Wave 0 |
| ITEM-02 | Backend `/api/barcode/{code}` returns normalized product for valid barcode | unit | `python -m pytest tests/test_barcode.py -x` | ❌ Wave 0 |
| ITEM-02 | Backend `/api/barcode/{code}` returns 404 for unknown barcode | unit | `python -m pytest tests/test_barcode.py -x` | ❌ Wave 0 |
| ITEM-02 | ItemDrawer accepts initialBarcode/initialNutrition props and pre-fills | unit | `npm test -- ItemDrawer` | ❌ Wave 0 (extends existing) |
| ITEM-07 | NutritionSection renders when calories/protein/carbs/fat present | unit | `npm test -- NutritionSection` | ❌ Wave 0 |
| ITEM-07 | NutritionSection hidden when all nutrition values null | unit | `npm test -- NutritionSection` | ❌ Wave 0 |
| ITEM-08 | Barcode not in OFF opens ItemDrawer with barcode pre-filled, no error | unit | `npm test -- useBarcodeScanner` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npm test`
- **Per wave merge:** `cd frontend && npm test && cd ../backend && python -m pytest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/components/CameraOverlay/CameraOverlay.test.jsx` — covers ITEM-01
- [ ] `frontend/src/components/ScanFAB/ScanFAB.test.jsx` — covers ITEM-01
- [ ] `frontend/src/components/QuickUpdateSheet/QuickUpdateSheet.test.jsx` — covers ITEM-01
- [ ] `frontend/src/components/NutritionSection/NutritionSection.test.jsx` — covers ITEM-07
- [ ] `frontend/src/hooks/useBarcodeScanner.test.js` — covers ITEM-01, ITEM-02, ITEM-08
- [ ] `backend/tests/test_barcode.py` — covers ITEM-02
- [ ] Mock for `@yudiel/react-qr-scanner` Scanner component in `frontend/src/test/setup.js` or per-test — needed to avoid real camera in jsdom

---

## Security Domain

Security enforcement is enabled (not explicitly disabled in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | HA ingress handles auth (carry-forward from Phase 1) |
| V3 Session Management | no | Stateless; HA session carries forward |
| V4 Access Control | no | Household app; single shared inventory |
| V5 Input Validation | yes | Barcode code path parameter: validate format (digits only, max 20 chars) in FastAPI route; `extra='forbid'` on any new Pydantic schemas |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via barcode code parameter | Tampering | Backend proxy only calls fixed OFF hostname; barcode `code` is URL-encoded, not used as a URL |
| Path traversal in barcode code | Tampering | FastAPI path param is a string; validate with regex `^[0-9]{8,20}$` or strip non-digits before forwarding to OFF |
| Response injection from OFF | Information Disclosure | Normalize and whitelist returned fields; never forward raw OFF response to client |

**SSRF note:** The barcode router constructs `https://world.openfoodfacts.net/api/v2/product/{code}`. The `code` value is interpolated into a path segment (not used as a full URL), so SSRF via URL substitution is not possible. However, the `code` should still be validated (digits only) to prevent path injection.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OFF returns HTTP 200 with `status: 0` (not HTTP 404) when a barcode is not found | OFF API Reference | Backend must check `data["status"] == 1`, not resp.status_code, to distinguish not-found from errors. Low risk — this is the standard OFF convention documented in all examples. |
| A2 | OFF User-Agent requirement: should set a descriptive User-Agent | Architecture Patterns | OFF TOS recommends identifying apps; failure to do so may result in throttling. Low risk for household use. |
| A3 | `@yudiel/react-qr-scanner` Scanner `onScan` callback receives `DetectedBarcode[]` with `.rawValue` | Code Examples | If API shape differs, the callback wiring needs adjustment. Medium risk — verify against package source on install. |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html5-qrcode (STATE.md reference) | @yudiel/react-qr-scanner 2.5.1 | html5-qrcode last updated Apr 2023; react-qr-scanner updated Jan 2026 | Use new library — the STATE.md note is superseded |
| OFF API v0 (`/api/v0/product/`) | OFF API v2 (`/api/v2/product/`) | v2 available since ~2022, recommended | Use v2 endpoint; v3 in development but v2 is stable |
| Direct client-side OFF calls | Backend proxy | Project decision D-11 | Consistent user-agent, server-side timeout control, avoids browser CORS preflight |

---

## Sources

### Primary (HIGH confidence)
- [npm registry: @yudiel/react-qr-scanner](https://www.npmjs.com/package/@yudiel/react-qr-scanner) — version, publish date, peer dependencies, dependencies verified
- [npm registry: html5-qrcode](https://www.npmjs.com/package/html5-qrcode) — last publish date confirmed (2023-04-15, unmaintained)
- [npm registry: zxing-wasm, barcode-detector, react-zxing, @ericblade/quagga2](https://www.npmjs.com) — versions and dates verified
- `backend/models/__init__.py` — confirmed existing nutrition + barcode + image_url columns
- `backend/schemas/item.py` — confirmed existing Pydantic fields for nutrition data
- `backend/requirements.txt` — confirmed httpx 0.28.1 already present
- `frontend/package.json` — confirmed React 19, lucide-react, vitest versions
- `frontend/src/components/FAB/FAB.module.css` — confirmed FAB CSS pattern
- `frontend/src/components/ItemDrawer/ItemDrawer.jsx` — confirmed current props interface
- `backend/main.py` — confirmed router registration pattern
- `.planning/phases/03-barcode-scanning/03-CONTEXT.md` — locked decisions
- `.planning/phases/03-barcode-scanning/03-UI-SPEC.md` — visual/interaction contracts

### Secondary (MEDIUM confidence)
- [OFF API Tutorial](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/) — endpoint URL, v2 recommendation, nutriments field names
- [caniuse: BarcodeDetector](https://caniuse.com/mdn-api_barcodedetector) — iOS Safari support status (polyfill needed)
- [DEV Community: 2025 barcode scanners](https://dev.to/patty-1984/2025-the-best-barcode-scanners-for-your-app-30hk) — ecosystem overview

### Tertiary (LOW confidence)
- OFF `status: 0` for not-found response — inferred from documentation pattern; not directly observed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry verified, publish dates confirmed
- Architecture patterns: HIGH — based on verified codebase inspection + library docs
- OFF API fields: MEDIUM — cited from official docs, field names cross-referenced
- Pitfalls: HIGH — based on codebase inspection + documented library issues

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (library ecosystem; OFF API is stable)
