# Phase 6: HA Display Integration - Research

**Researched:** 2026-04-24
**Domain:** FastAPI REST endpoint, HA REST sensor, iframe embedding, CORS/CSP headers
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Endpoint is `GET /api/ha/summary` (no auth, open on local network)
- **D-02:** Response shape:
  ```json
  {
    "low_stock_count": 3,
    "out_of_stock_count": 1,
    "total_items": 42,
    "low_stock_items": ["Milk", "Coffee", "Oat milk"],
    "out_of_stock_items": ["Pasta"]
  }
  ```
  - `low_stock_items`: item names where `quantity_mode=STATUS` and `status=LOW`, or `quantity_mode=EXACT` and `quantity <= reorder_threshold` (and `reorder_threshold` is set)
  - `out_of_stock_items`: item names where `status=OUT` or `quantity=0`
  - `total_items`: count of non-archived items
  - No cap on list length — return all matching items
- **D-03:** No authentication required on the endpoint — relies on local network trust (HAOS deployment, not internet-exposed)
- **D-04:** Add a sample HA `configuration.yaml` snippet to the add-on README showing how to wire up the REST sensor
- **D-05:** Document the direct port URL (`http://homeassistant.local:8099`) for HA Lovelace iframe card config
- **D-06:** Verify that the app does not send `X-Frame-Options: DENY` or a `Content-Security-Policy: frame-ancestors` restriction that would block iframe embedding. Fix response headers if needed.

### Claude's Discretion
- Exact HTTP status codes and error shape for `/api/ha/summary` (e.g. if DB is unavailable)
- Whether to add a CORS header for the summary endpoint (likely needed if HA polls via REST sensor)
- Sorting of `low_stock_items` and `out_of_stock_items` lists

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HA-01 | App exposes a REST endpoint that HA can poll for current stock levels as sensor entities | New router `backend/routers/ha_display.py`, query logic from existing `Item` ORM model using `QuantityMode`/`StockStatus` enums |
| HA-02 | App can be embedded as an iframe in HA Lovelace dashboards | FastAPI sends no X-Frame-Options by default (verified); SAMEORIGIN not set; direct port 8099 already open; only needs documentation |
</phase_requirements>

---

## Summary

Phase 6 is the smallest phase in the project: two focused deliverables that compose existing infrastructure. Both requirements are achievable with a single new router file, a one-line middleware addition (CORS), and documentation updates to README.md.

**For HA-01 (REST sensor):** HA REST sensors make server-side HTTP requests — there is no browser in the loop. CORS headers are technically not required for the sensor itself, but adding `CORSMiddleware` with `allow_origins=["*"]` is still the right call: it future-proofs the endpoint for any browser-based dashboard cards and costs nothing. The query logic is a straightforward two-filter SQLAlchemy query on the existing `Item` model using the `QuantityMode` and `StockStatus` enums already in production.

**For HA-02 (iframe card):** FastAPI does not add `X-Frame-Options` or `Content-Security-Policy` headers by default. A search of the codebase confirms no existing middleware sets them. The iframe will work without any header changes. The only work is documentation: add the Lovelace iframe YAML to README.md.

**Primary recommendation:** Create `backend/routers/ha_display.py`, register it in `main.py`, add `CORSMiddleware` scoped to the `/api/ha/` prefix (or globally since the app is local-only), and extend README.md with the HA YAML samples the user confirmed they want.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI (already installed) | in requirements.txt | API router | Project's existing framework |
| SQLAlchemy (already installed) | in requirements.txt | ORM query for stock counts | Project's existing ORM; `Item`, `QuantityMode`, `StockStatus` already defined |
| Pydantic v2 (already installed) | in requirements.txt | Response schema with `use_enum_values=True` pattern | Established project pattern |
| `fastapi.middleware.cors.CORSMiddleware` | bundled with starlette (already installed) | CORS headers | Ships with FastAPI/Starlette; zero new deps |

[VERIFIED: codebase grep — no CORS middleware currently present in `backend/main.py` or `backend/middleware/`]
[VERIFIED: fastapi.tiangolo.com — CORSMiddleware ships with Starlette, no extra install needed]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | — | — | No new dependencies needed for this phase |

**Installation:** No new packages. All dependencies already in `requirements.txt`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── routers/
│   └── ha_display.py    # NEW: GET /api/ha/summary
├── schemas/
│   └── ha_display.py    # NEW: HASummaryResponse Pydantic schema
└── main.py              # MODIFIED: include_router + CORSMiddleware
```

```
README.md                # MODIFIED: add HA sensor + iframe YAML section
```

### Pattern 1: New Router (follows established project pattern)

**What:** Add `ha_display.py` to `backend/routers/` following the exact same structure as `health.py`, `access_info.py`, and `items.py`.

**When to use:** Every new API domain gets its own router file.

**Example (from project codebase):**
```python
# Source: backend/routers/access_info.py — established pattern
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.database import get_db
from models import Item, QuantityMode, StockStatus

router = APIRouter(prefix="/api/ha", tags=["ha-display"])

@router.get("/summary")
def ha_summary(db: Session = Depends(get_db)) -> dict:
    # No auth check — D-03 decision
    ...
```

**Registration in main.py (follows established line order):**
```python
# Source: backend/main.py — existing include_router pattern
from routers import health, items, categories, locations, access_info, barcode, shopping_list, recipes, ha_display
app.include_router(ha_display.router)
```
Note: register before the SPA catch-all (the existing ordering constraint from RESEARCH.md Pitfall 5).

### Pattern 2: Stock Query Logic

**What:** Two SQLAlchemy queries (or one filtered query) to identify low-stock and out-of-stock items.

**Logic per D-02:**
```python
# Source: derived from backend/models/__init__.py — Item, QuantityMode, StockStatus

from sqlalchemy import or_, and_

active_items = db.query(Item).filter(Item.archived == False).all()

# out_of_stock: status=OUT or quantity=0
out_of_stock = [
    i for i in active_items
    if (i.quantity_mode == QuantityMode.STATUS and i.status == StockStatus.OUT)
    or (i.quantity_mode == QuantityMode.EXACT and i.quantity == 0)
]

# low_stock: status=LOW, or exact mode at/below threshold (threshold must be set)
low_stock = [
    i for i in active_items
    if (i.quantity_mode == QuantityMode.STATUS and i.status == StockStatus.LOW)
    or (
        i.quantity_mode == QuantityMode.EXACT
        and i.reorder_threshold is not None
        and i.quantity is not None
        and i.quantity <= i.reorder_threshold
    )
]
```

At household scale (<1000 items) a single Python-side filter pass is adequate. No subqueries needed.

### Pattern 3: CORSMiddleware Addition

**What:** Add `CORSMiddleware` to `main.py` so browsers (Lovelace custom cards, future dashboards) can call the endpoint.

**Important:** HA REST sensor makes server-side requests — CORS is not required for the sensor itself. [CITED: home-assistant.io/integrations/sensor.rest/] But it is good practice for a publicly accessible endpoint and costs nothing.

```python
# Source: fastapi.tiangolo.com/tutorial/cors/
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # local-only add-on, no credential risk
    allow_credentials=False,    # credentials + wildcard is not allowed by spec
    allow_methods=["GET"],      # read-only endpoint
    allow_headers=["*"],
)
```

**Middleware ordering note:** `add_middleware` calls stack in reverse; the first `add_middleware` call is the outermost layer. `IngressUserMiddleware` is already registered — add CORS after it so both execute. [CITED: FastAPI docs on middleware ordering]

### Pattern 4: Pydantic Response Schema

**What:** Define a typed `HASummaryResponse` schema following the `use_enum_values=True` pattern from existing schemas.

```python
# Source: backend/schemas/item.py — established Pydantic v2 pattern
from pydantic import BaseModel, ConfigDict
from typing import List

class HASummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    low_stock_count: int
    out_of_stock_count: int
    total_items: int
    low_stock_items: List[str]
    out_of_stock_items: List[str]
```

### Pattern 5: Iframe — No Code Change Required

**What:** FastAPI does not add `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` headers by default. [CITED: github.com/fastapi/fastapi/discussions/8548 — headers are opt-in not default]

**Verified:** Grepping the entire `backend/` directory finds zero occurrences of `X-Frame-Options`, `frame-ancestors`, or `Content-Security-Policy`. [VERIFIED: codebase grep]

**Result:** The iframe card will work with the direct port URL out of the box. The only task is documentation.

### Anti-Patterns to Avoid

- **Setting `allow_credentials=True` with `allow_origins=["*"]`:** The spec forbids this combination. Browsers reject it. [CITED: fastapi.tiangolo.com/tutorial/cors/]
- **Registering `ha_display.router` after the SPA catch-all:** The `/{full_path:path}` catch-all in `main.py` swallows all unmatched GETs. New routers must be registered before the `if not _SKIP_SPA:` block. [VERIFIED: backend/main.py lines 25-32]
- **Filtering archived items incorrectly:** Use `Item.archived == False` (not `is False`) — SQLAlchemy boolean filter syntax. [VERIFIED: backend/routers/items.py line 110]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS headers | Custom middleware reading Origin header | `fastapi.middleware.cors.CORSMiddleware` | Handles preflight, vary headers, edge cases |
| JSON response schema | Raw dict with no validation | Pydantic `HASummaryResponse` | Follows project pattern; ensures correct field types |
| Stock logic | Raw SQL string queries | SQLAlchemy ORM filter on existing models | Models already tested; enum comparison is type-safe |

---

## Common Pitfalls

### Pitfall 1: Confusing HA REST sensor with browser AJAX
**What goes wrong:** Over-engineering CORS because "the endpoint is called by HA". HA REST sensors run in the HA process — they make server-to-server HTTP requests with no browser Origin header. CORS preflight never fires.
**Why it happens:** Confusing "called from a dashboard" (browser) with "polled by HA Core" (server).
**How to avoid:** Add CORS anyway (it is zero-cost) but don't block on it for HA-01 correctness.
**Warning signs:** If you're debugging CORS for the sensor, you're in the wrong place.

### Pitfall 2: Middleware ordering with `add_middleware`
**What goes wrong:** `CORSMiddleware` added in the wrong position, causing CORS headers to not appear on responses that also go through `IngressUserMiddleware`.
**Why it happens:** Starlette middleware wraps in reverse registration order.
**How to avoid:** Add `CORSMiddleware` immediately after `app = FastAPI(...)` and before `app.add_middleware(IngressUserMiddleware)`, or test both orderings to confirm headers appear. [CITED: fastapi.tiangolo.com/tutorial/cors/]

### Pitfall 3: `quantity == 0` vs `quantity is None`
**What goes wrong:** An item with `quantity=None` (never set) is classified as out-of-stock when it shouldn't be.
**Why it happens:** `None <= 0` raises TypeError in Python; `None == 0` is False — but the intent must be explicit.
**How to avoid:** In the out-of-stock filter, require `quantity is not None and quantity == 0` for EXACT mode items. [VERIFIED: backend/models/__init__.py — `quantity` column is nullable]

### Pitfall 4: Low-stock items that are also out-of-stock
**What goes wrong:** An item appears in both `low_stock_items` and `out_of_stock_items`.
**Why it happens:** An EXACT mode item with `quantity=0` and `reorder_threshold=5` matches both filters.
**How to avoid:** Build `out_of_stock` list first, then exclude those item IDs from the `low_stock` list. Makes the counts exclusive and matches HA dashboard expectations.

### Pitfall 5: HA REST sensor scan interval
**What goes wrong:** HA polls the endpoint every 30 seconds by default. If the endpoint is slow (full table scan), it creates unnecessary load.
**Why it happens:** Default `scan_interval` is 30s. [CITED: home-assistant.io/integrations/sensor.rest/]
**How to avoid:** The query is a single `SELECT * FROM items WHERE archived=0` — at household scale this is sub-millisecond. No optimization needed. Document `scan_interval: 60` in the README sample as a reasonable default.

---

## Code Examples

### Complete router skeleton
```python
# backend/routers/ha_display.py
# Source: pattern from backend/routers/access_info.py
from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.database import get_db
from models import Item, QuantityMode, StockStatus

router = APIRouter(prefix="/api/ha", tags=["ha-display"])


@router.get("/summary")
def ha_summary(db: Session = Depends(get_db)) -> dict:
    """Public read-only summary for HA REST sensor (D-01, D-03).
    No auth required — local network trust.
    """
    active = db.query(Item).filter(Item.archived == False).all()  # noqa: E712

    out_of_stock = [
        i for i in active
        if (i.quantity_mode == QuantityMode.STATUS and i.status == StockStatus.OUT)
        or (i.quantity_mode == QuantityMode.EXACT and i.quantity is not None and i.quantity == 0)
    ]
    out_ids = {i.id for i in out_of_stock}

    low_stock = [
        i for i in active
        if i.id not in out_ids  # exclude items already counted as out-of-stock
        and (
            (i.quantity_mode == QuantityMode.STATUS and i.status == StockStatus.LOW)
            or (
                i.quantity_mode == QuantityMode.EXACT
                and i.reorder_threshold is not None
                and i.quantity is not None
                and i.quantity <= i.reorder_threshold
            )
        )
    ]

    return {
        "low_stock_count": len(low_stock),
        "out_of_stock_count": len(out_of_stock),
        "total_items": len(active),
        "low_stock_items": sorted(i.name for i in low_stock),
        "out_of_stock_items": sorted(i.name for i in out_of_stock),
    }
```

### CORSMiddleware registration in main.py
```python
# Source: fastapi.tiangolo.com/tutorial/cors/
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Inventar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)
app.add_middleware(IngressUserMiddleware)  # already present
```

### HA configuration.yaml sample (for README — from CONTEXT.md specifics)
```yaml
# configuration.yaml
sensor:
  - platform: rest
    name: Inventar Low Stock
    resource: http://homeassistant.local:8099/api/ha/summary
    value_template: "{{ value_json.low_stock_count }}"
    scan_interval: 60
    json_attributes:
      - low_stock_items
      - out_of_stock_count
      - out_of_stock_items
      - total_items

# Lovelace dashboard card
type: iframe
url: http://homeassistant.local:8099
title: Inventar
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HA REST sensor `scan_interval` default 30s | Still 30s — but `scan_interval: 60` is recommended for non-critical sensors | — | Reduce polling for inventory data that changes infrequently |
| X-Frame-Options sameorigin | Superseded by CSP `frame-ancestors` in modern browsers | ~2015, widely supported now | Both work; HA Lovelace uses iframe; neither header is set by this app so no action needed |

---

## Open Questions

1. **Sorting of item name lists**
   - What we know: D-02 says "no cap on list length" but does not specify sort order
   - What's unclear: alphabetical vs insertion order vs update-recency?
   - Recommendation: Use `sorted()` (alphabetical by name) — deterministic, predictable, matches user mental model when scanning a dashboard

2. **Error response when DB is unavailable**
   - What we know: CONTEXT.md marks this as Claude's Discretion
   - What's unclear: Should `/api/ha/summary` return 503 or a "safe" degraded response?
   - Recommendation: Return HTTP 503 with `{"detail": "Database unavailable"}` — HA REST sensor will mark the sensor as unavailable, which is the correct HA signal and avoids silently serving stale zero-counts

---

## Environment Availability

Step 2.6: SKIPPED — this phase adds no external dependencies. All required libraries (`FastAPI`, `SQLAlchemy`, `Starlette/CORSMiddleware`, `Pydantic`) are already in `requirements.txt` and installed. Port 8099 is already open and validated (INFRA-05, Phase 1).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (pytest.ini present in `backend/`) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && pytest tests/test_ha_display.py -q` |
| Full suite command | `cd backend && pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HA-01 | `GET /api/ha/summary` returns correct counts and name lists | unit | `pytest tests/test_ha_display.py -q` | Wave 0 |
| HA-01 | Low-stock logic: STATUS mode LOW | unit | `pytest tests/test_ha_display.py::test_low_stock_status_mode -q` | Wave 0 |
| HA-01 | Low-stock logic: EXACT mode at/below threshold | unit | `pytest tests/test_ha_display.py::test_low_stock_exact_mode -q` | Wave 0 |
| HA-01 | Out-of-stock: STATUS=OUT and EXACT quantity=0 | unit | `pytest tests/test_ha_display.py::test_out_of_stock -q` | Wave 0 |
| HA-01 | Archived items excluded from all counts | unit | `pytest tests/test_ha_display.py::test_archived_excluded -q` | Wave 0 |
| HA-01 | Items in both out/low not double-counted | unit | `pytest tests/test_ha_display.py::test_no_double_count -q` | Wave 0 |
| HA-01 | No auth required — request without HA headers succeeds | unit | `pytest tests/test_ha_display.py::test_no_auth_required -q` | Wave 0 |
| HA-02 | Response does not contain X-Frame-Options header | unit | `pytest tests/test_ha_display.py::test_no_xframe_options -q` | Wave 0 |
| HA-02 | CORS header present when Origin header sent | unit | `pytest tests/test_ha_display.py::test_cors_header -q` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/test_ha_display.py -q`
- **Per wave merge:** `cd backend && pytest tests/ -q`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_ha_display.py` — covers all HA-01 and HA-02 test cases above

*(No framework install or conftest changes needed — existing `conftest.py` with temp SQLite and `INVENTAR_SKIP_SPA=1` is sufficient)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Endpoint is intentionally unauthenticated (D-03) |
| V3 Session Management | No | Read-only, no session state |
| V4 Access Control | Yes (minimal) | No auth — acceptable per D-03; local network only |
| V5 Input Validation | No | GET endpoint, no request body |
| V6 Cryptography | No | No secrets, no tokens |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated data exposure | Information Disclosure | Acceptable per D-03 (HAOS local network); endpoint returns only item names and counts, no PII |
| CORS wildcard allowing cross-origin read | Information Disclosure | `allow_credentials=False` + wildcard is the correct safe combination for public read-only data [CITED: fastapi.tiangolo.com/tutorial/cors/] |

**Security note:** The data exposed is household inventory names and counts. This is low-sensitivity data on a local network. The D-03 decision is appropriate. No additional controls are needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `quantity == 0` with EXACT mode means out-of-stock (not `quantity is None`) | Code Examples / Pitfall 3 | Items with unset quantity would be misclassified; confirmed by model nullable column but D-02 intent needs to be clear in implementation |
| A2 | Alphabetical sort order for item name lists is appropriate | Open Questions | Low risk — planner can override; no functional correctness impact |
| A3 | HTTP 503 is the right error code if the DB is unavailable | Open Questions | Low risk — HA REST sensor marks entity unavailable on any non-200 response |

---

## Sources

### Primary (HIGH confidence)
- `backend/models/__init__.py` [VERIFIED: codebase read] — `Item`, `QuantityMode`, `StockStatus` definitions
- `backend/main.py` [VERIFIED: codebase read] — router registration pattern, SPA ordering constraint, no CORS present
- `backend/middleware/ingress.py` [VERIFIED: codebase read] — `IngressUserMiddleware` is non-blocking
- `backend/routers/items.py` [VERIFIED: codebase read] — `Item.archived == False` filter pattern
- [home-assistant.io/integrations/sensor.rest/](https://www.home-assistant.io/integrations/sensor.rest/) [CITED] — REST sensor is server-side polling, no CORS issue, scan_interval default 30s, json_attributes config
- [fastapi.tiangolo.com/tutorial/cors/](https://fastapi.tiangolo.com/tutorial/cors/) [CITED] — CORSMiddleware import, allow_origins=["*"] + allow_credentials=False pattern

### Secondary (MEDIUM confidence)
- [github.com/fastapi/fastapi/discussions/8548](https://github.com/fastapi/fastapi/discussions/8548) — FastAPI does not add security headers (X-Frame-Options, CSP) by default
- Codebase grep for `X-Frame-Options|frame-ancestors|Content-Security-Policy` across all `*.py` files — zero matches [VERIFIED]

### Tertiary (LOW confidence)
- None — all critical claims verified above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; verified in codebase
- Architecture: HIGH — follows established project patterns directly observable in codebase
- Pitfalls: HIGH — derived from verified code (nullable quantity, archived filter, ORM ordering) plus official docs
- HA sensor behavior: HIGH — confirmed server-side polling from official HA docs

**Research date:** 2026-04-24
**Valid until:** 2026-07-24 (stable domain — FastAPI, SQLAlchemy, HA REST sensor API are stable)
