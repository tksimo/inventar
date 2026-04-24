---
phase: 06
plan: 01
subsystem: backend
tags: [ha-integration, rest-api, cors, tdd]
dependency_graph:
  requires: []
  provides: [GET /api/ha/summary, HASummaryResponse schema, CORSMiddleware]
  affects: [backend/main.py]
tech_stack:
  added: []
  patterns: [FastAPI router with prefix, Pydantic v2 response schema, CORSMiddleware wildcard+no-credentials pattern, TDD RED→GREEN wave]
key_files:
  created:
    - backend/routers/ha_display.py
    - backend/schemas/ha_display.py
    - backend/tests/test_ha_display.py
  modified:
    - backend/main.py
decisions:
  - "CORSMiddleware registered before IngressUserMiddleware (outermost layer, reverse stacking order)"
  - "out_ids exclusion set built before low-stock filter to prevent double-counting (Pitfall 4)"
  - "quantity is not None guard applied before quantity == 0 comparison (Pitfall 3)"
  - "Lists sorted alphabetically via sorted() — deterministic and dashboard-friendly"
metrics:
  duration: "3 minutes"
  completed: "2026-04-24"
  tasks: 2
  files: 4
requirements:
  - HA-01
  - HA-02
---

# Phase 6 Plan 1: HA Summary Endpoint Summary

**One-liner:** Public `GET /api/ha/summary` endpoint returning low/out-of-stock counts and item name lists, with CORSMiddleware (`allow_origins=["*"]`, `allow_credentials=False`, `allow_methods=["GET"]`) for browser-based HA dashboard card compatibility.

---

## What Was Built

### Files Created

| File | Purpose |
|------|---------|
| `backend/schemas/ha_display.py` | `HASummaryResponse` Pydantic v2 model with 5 fields matching D-02 locked shape |
| `backend/routers/ha_display.py` | `GET /api/ha/summary` router (prefix `/api/ha`, no auth, D-03) |
| `backend/tests/test_ha_display.py` | 17 contract tests covering HA-01 and HA-02 requirements |

### Files Modified

| File | Change |
|------|--------|
| `backend/main.py` | Added `CORSMiddleware` registration + `ha_display` import and `include_router` |

---

## Contract Verified

All 17 tests in `backend/tests/test_ha_display.py` pass. Full suite: **169 passed, 0 failed**.

Test coverage includes:
- `test_no_auth_required` — D-03: no headers needed, 200 response
- `test_response_shape_has_all_keys` — D-02: exactly 5 keys
- `test_empty_inventory` — zeroed baseline
- `test_low_stock_status_mode`, `test_low_stock_exact_mode`, `test_low_stock_exact_at_threshold_boundary` — low-stock logic
- `test_low_stock_exact_requires_threshold_set` — threshold must be set for EXACT low-stock
- `test_out_of_stock_status_mode`, `test_out_of_stock_exact_zero` — out-of-stock logic
- `test_no_double_count` — Pitfall 4 guard
- `test_exact_quantity_none_not_out_of_stock` — Pitfall 3 guard
- `test_archived_excluded`, `test_total_items_counts_active_only` — archived exclusion
- `test_item_names_sorted_alphabetically` — deterministic sort
- `test_no_xframe_options_header`, `test_no_csp_frame_ancestors` — HA-02 iframe headers
- `test_cors_header_present_on_origin_request` — CORS wildcard response

---

## Implementation Notes

**Low-stock logic:** Items match low-stock when `quantity_mode=STATUS` and `status=LOW`, or when `quantity_mode=EXACT`, `reorder_threshold` is set (not None), `quantity` is not None, and `quantity <= reorder_threshold` (boundary inclusive).

**Out-of-stock logic:** Items match out-of-stock when `quantity_mode=STATUS` and `status=OUT`, or when `quantity_mode=EXACT`, `quantity` is not None, and `quantity == 0`. Items where `quantity=None` are excluded (Pitfall 3 guard).

**No-double-count guard:** The out-of-stock list is computed first and its item IDs are collected into `out_ids`. The low-stock filter explicitly excludes any item in `out_ids` (Pitfall 4). An item with `quantity=0` and `reorder_threshold=5` appears only in `out_of_stock_items`.

**CORS configuration:** `CORSMiddleware(allow_origins=["*"], allow_credentials=False, allow_methods=["GET"], allow_headers=["*"])` registered before `IngressUserMiddleware` in `main.py`. The `allow_credentials=False` + wildcard combination is the spec-safe pattern for public read-only data (T-06-02).

**Header verification for iframe compatibility (HA-02):** FastAPI does not emit `X-Frame-Options` or `Content-Security-Policy` headers by default. No existing middleware set them (verified by grep). Tests confirm both headers are absent on `/api/ha/summary` responses.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (RED) | `1edeffe` | test(06-01): add failing test suite for HA summary endpoint (RED) |
| Task 2 (GREEN) | `175f44e` | feat(06-01): implement /api/ha/summary router + Pydantic schema + CORS (GREEN) |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — the endpoint returns live data from the database. No hardcoded values or placeholders.

---

## Threat Flags

No new security-relevant surface beyond what is documented in the plan's `<threat_model>`. The endpoint is intentionally unauthenticated per D-03 (T-06-01 accepted). CORS wildcard is mitigated by `allow_credentials=False` + `allow_methods=["GET"]` (T-06-02 mitigated). No new tables, no new auth paths, no file access patterns introduced.

---

## Self-Check: PASSED

- [x] `backend/schemas/ha_display.py` exists
- [x] `backend/routers/ha_display.py` exists
- [x] `backend/tests/test_ha_display.py` exists
- [x] `backend/main.py` contains `ha_display` import and `include_router`
- [x] `backend/main.py` contains `CORSMiddleware` registration before `IngressUserMiddleware`
- [x] Commit `1edeffe` exists (RED tests)
- [x] Commit `175f44e` exists (GREEN implementation)
- [x] 17 tests pass, full suite 169 passed 0 failed
