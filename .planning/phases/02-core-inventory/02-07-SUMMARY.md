---
phase: 02-core-inventory
plan: "07"
subsystem: backend
tags: [data-model, migration, api, integer, access-info, uat-gap-fix]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [integer-quantity-contract, access-info-endpoint]
  affects: [02-08]
tech_stack:
  added: []
  patterns:
    - Alembic batch_alter_table for SQLite-safe column type changes
    - Pydantic Optional[int] for strict integer boundary enforcement
key_files:
  created:
    - backend/alembic/versions/0003_quantity_to_integer.py
    - backend/routers/access_info.py
    - backend/tests/test_quantity_integer_migration.py
    - backend/tests/test_access_info.py
  modified:
    - backend/models/__init__.py
    - backend/schemas/item.py
    - backend/routers/items.py
    - backend/main.py
    - backend/tests/test_items.py
decisions:
  - "Keep Transaction.delta as Float — audit trail may contain pre-migration fractional deltas; int() cast applied defensively at boundary"
  - "Migration 0003 uses batch_alter_table for SQLite ALTER COLUMN compatibility"
  - "Pre-existing fractional quantities truncated on migration (acceptable — no UI ever produced fractional values)"
metrics:
  duration: ~25min
  completed: "2026-04-16"
  tasks_completed: 2
  files_changed: 9
---

# Phase 02 Plan 07: UAT Gap Fixes — Integer Quantity & Access-Info Endpoint Summary

**One-liner:** Float-to-integer quantity migration via Alembic batch_alter_table plus GET /api/access-info ingress-detection endpoint for UAT Gap 1 and Gap 2.

---

## What Was Built

### Task 1: Quantity as Integer at the Data Layer

Closed UAT Gap 1 (root causes #2 and #3) by switching the entire quantity stack from `float` to `int`:

- **`backend/models/__init__.py`**: `Item.quantity` and `Item.reorder_threshold` columns changed from `Column(Float)` to `Column(Integer)`.
- **`backend/schemas/item.py`**: `ItemCreate`, `ItemUpdate`, `ItemResponse` — `quantity` and `reorder_threshold` retyped from `Optional[float]` to `Optional[int]`. Pydantic now rejects fractional values (e.g. `2.5`) with HTTP 422.
- **`backend/routers/items.py`**: Delta arithmetic updated — `0.0` literals removed, `int()` defensive cast added for pre-migration rows in flight.
- **`backend/alembic/versions/0003_quantity_to_integer.py`**: New migration converting both columns from Float to Integer using `batch_alter_table` (SQLite-safe). Downgrade mirrors the change back to Float.

**Migration chain after this plan:** `0001 → 0002 → 0003`

**Schema breaking change note:** Clients must now send `quantity` as an integer JSON value (e.g. `2`, not `2.0`). Non-integer floats will be rejected with HTTP 422.

### Task 2: GET /api/access-info Endpoint

Provides the backend half of UAT Gap 2's fix — a discoverable signal that the frontend (Plan 08) uses to decide whether to show a "direct port" banner:

- **`backend/routers/access_info.py`**: New router at `GET /api/access-info` returning `{via_ingress: bool, user_name: str | null}`. `via_ingress` is `true` iff `X-Ingress-Path` header is present (only set by HA Supervisor proxy). `user_name` comes from `X-Ingress-Remote-User-Name` via `IngressUserMiddleware`.
- **`backend/main.py`**: `access_info.router` registered after `locations.router`.

**New API endpoint contract:**

```
GET /api/access-info
Response: {"via_ingress": bool, "user_name": str | null}

Examples:
  Via ingress with user:  {"via_ingress": true,  "user_name": "Alice"}
  Direct port access:     {"via_ingress": false, "user_name": null}
  Ingress, no user name:  {"via_ingress": true,  "user_name": null}
```

---

## Test Coverage

| File | Tests | Coverage |
|------|-------|----------|
| `test_items.py` | +5 new int-contract tests, 3 float literals updated | Behaviours 1-5 |
| `test_quantity_integer_migration.py` | 3 new migration tests | Behaviours 6-8 |
| `test_access_info.py` | 4 new endpoint tests | All 4 behaviours |

Full backend suite: **69 tests, 0 failures**.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed json.dumps serialization in test**
- **Found during:** Task 1 GREEN phase
- **Issue:** `test_item_response_quantity_is_int_not_float` used `json.dumps(model_dump())` which fails because `datetime` objects are not JSON-serializable by stdlib `json`.
- **Fix:** Replaced with `model_dump_json()` — Pydantic's own serializer handles datetime fields correctly.
- **Files modified:** `backend/tests/test_items.py`
- **Commit:** b926962

---

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | b926962 | feat(02-07): quantity as integer at data layer (model, schema, migration, router) |
| Task 2 | edaff41 | feat(02-07): add GET /api/access-info endpoint for direct-vs-ingress detection |

---

## Known Stubs

None — all data flows are wired. The `access-info` endpoint uses live `request.state.user` from `IngressUserMiddleware`. The Plan 08 frontend integration (banner rendering) is intentionally deferred to Plan 08.

---

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-02G-01 through T-02G-04). The `/api/access-info` endpoint is informational only; no security decision is made on its output.

## Self-Check: PASSED

All created files confirmed present. Both task commits verified in git history.
