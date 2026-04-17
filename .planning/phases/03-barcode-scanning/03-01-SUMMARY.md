---
phase: "03-barcode-scanning"
plan: "01"
subsystem: "backend"
tags: ["barcode", "off-proxy", "tdd", "security", "fastapi"]
dependency_graph:
  requires: []
  provides: ["GET /api/barcode/{code}", "BarcodeProduct schema"]
  affects: ["backend/main.py", "backend/routers/barcode.py", "backend/tests/test_barcode.py"]
tech_stack:
  added: []
  patterns: ["FastAPI APIRouter", "httpx async proxy", "Pydantic extra=forbid whitelist", "TDD red-green"]
key_files:
  created:
    - backend/routers/barcode.py
    - backend/tests/test_barcode.py
  modified:
    - backend/main.py
decisions:
  - "Path traversal (../secret) returns 404 not 422 — Starlette normalizes the path before FastAPI routing; test accepts both 404 and 422 as valid rejections since neither reaches the handler"
  - "BarcodeProduct uses ConfigDict(extra='forbid') to enforce whitelist at Pydantic serialization layer"
  - "httpx.AsyncClient(timeout=5.0) with async context manager per request — no connection pooling needed for low-frequency barcode lookups"
metrics:
  duration_seconds: 163
  completed_date: "2026-04-17T16:49:56Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 3 Plan 1: Barcode Backend Router Summary

**One-liner:** FastAPI OFF proxy at `GET /api/barcode/{code}` with digit-only path validation, Pydantic whitelist (7 fields), 5s timeout, and 8 passing Wave 0 tests covering ITEM-02 and ITEM-08.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write Wave 0 tests for barcode router (RED) | ba5121d | backend/tests/test_barcode.py |
| 2 | Implement barcode router + register in main (GREEN) | 2b0d3f3 | backend/routers/barcode.py, backend/main.py, backend/tests/test_barcode.py |

---

## What Was Built

### `backend/routers/barcode.py`

New FastAPI router registered at prefix `/api/barcode`. Single endpoint `GET /{code}`:

- **Path validation:** `Path(..., pattern=r"^[0-9]{8,20}$")` — rejects non-digit and overlong codes with HTTP 422 before the handler runs (T-03-01 mitigation).
- **Outbound call:** `httpx.AsyncClient(timeout=5.0)` with `User-Agent: Inventar/0.1 (home-assistant-addon)` hits `world.openfoodfacts.net/api/v2/product/{code}?fields=product_name,image_url,nutriments`.
- **Error mapping:** `httpx.TimeoutException` → 504; OFF `status_code != 200` → 404; OFF `status != 1` → 404. Both 404 cases use `{"detail": "Product not found"}`.
- **Response whitelist:** `BarcodeProduct` Pydantic model with `ConfigDict(extra="forbid")` exposes exactly 7 fields: `barcode, name, image_url, calories, protein, carbs, fat` (T-03-02 mitigation).
- **Empty name coercion:** `product.get("product_name") or None` converts `""` to `None` (Pitfall 6).
- **Nutriment mapping:** `energy-kcal_100g` → `calories`, `proteins_100g` → `protein`, `carbohydrates_100g` → `carbs`, `fat_100g` → `fat`.

### `backend/main.py`

Added `barcode` to router import and `app.include_router(barcode.router)` after `access_info.router`, before the SPA catch-all.

### `backend/tests/test_barcode.py`

8 Wave 0 tests covering all must-have truths:
1. `test_barcode_found_returns_normalized_product` — full happy path with all 7 fields
2. `test_barcode_not_found_returns_404` — OFF status:0 → 404 (ITEM-08)
3. `test_barcode_empty_product_name_coerced_to_null` — empty string → None for name/image/all nutrition
4. `test_barcode_rejects_non_digit_code` — abc123 → 422; ../secret → 404/422; httpx never called
5. `test_barcode_rejects_too_long_code` — 21-digit code → 422
6. `test_barcode_timeout_returns_504` — TimeoutException → 504
7. `test_barcode_off_5xx_returns_404` — upstream 503 → 404
8. `test_barcode_response_only_whitelisted_fields` — extra OFF fields (brands, ingredients_text) not present in response

---

## Verification

```
cd backend && python -m pytest tests/test_barcode.py -v
# 8 passed

cd backend && python -m pytest
# 81 passed, 84 warnings
```

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Path traversal assertion adjusted for HTTP stack normalization**

- **Found during:** Task 2 (GREEN phase)
- **Issue:** Test 4 asserted `../secret` → 422, but Starlette normalizes path traversal segments before FastAPI routing, resolving `../secret` to `/secret` which returns 404 from the SPA fallback, not 422 from the path validator. The handler is never reached in either case — the security property is preserved.
- **Fix:** Updated `test_barcode_rejects_non_digit_code` to accept `status_code in (404, 422)` for the `../secret` case, with a comment explaining the HTTP stack normalization. The key invariant (httpx never called) is unchanged.
- **Files modified:** backend/tests/test_barcode.py
- **Commit:** 2b0d3f3

---

## Known Stubs

None — all 7 response fields are wired to real OFF nutriment data. No placeholder values.

---

## Threat Flags

No new security surface introduced beyond what was declared in the plan's threat model. All five STRIDE threats (T-03-01 through T-03-05) are addressed as designed.

---

## Self-Check: PASSED

- [x] `backend/routers/barcode.py` exists
- [x] `backend/tests/test_barcode.py` exists (8 test functions)
- [x] `backend/main.py` contains `barcode` import and `include_router(barcode.router)`
- [x] Commits `ba5121d` and `2b0d3f3` exist in git log
- [x] All 8 barcode tests pass; full suite 81 passed, 0 failed
