---
phase: 04-shopping-restock
plan: 02
subsystem: backend
tags: [shopping-list, backend, fastapi, transactions, tdd]
dependency_graph:
  requires: ["04-01"]
  provides: ["SHOP-02", "SHOP-03", "RSTO-03"]
  affects: ["backend/routers/shopping_list.py", "backend/tests/test_shopping_list.py"]
tech_stack:
  added: []
  patterns:
    - "Atomic check-off: update Item + insert Transaction + conditional delete ShoppingListEntry in single db.commit()"
    - "D-08 removal condition: threshold IS NULL → always remove; threshold IS NOT NULL → remove when new_quantity >= threshold"
    - "Status-mode → exact-mode flip on restock (quantity_mode=EXACT, status=None, quantity=quantity_added)"
    - "Application-level duplicate guard: query before INSERT to enforce one row per item_id"
key_files:
  created: []
  modified:
    - backend/routers/shopping_list.py
    - backend/tests/test_shopping_list.py
decisions:
  - "D-08 removal uses two-branch form for clarity: (threshold is None) OR (new_quantity >= threshold) — threshold=0 is covered because new_quantity >= 0 is always true after any positive add"
  - "check-off returns plain dict {ok, removed, item_id, new_quantity} rather than ShoppingListEntryResponse because the entry may be deleted; tests only check status_code and state via GET"
  - "Attribution header X-Ingress-Remote-User-Name matches pattern established in items router and test_items.py"
metrics:
  duration: "~15 min"
  completed_date: "2026-04-18"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 02: Shopping List Write Endpoints Summary

**One-liner:** POST/DELETE/PATCH/check-off endpoints with atomic restock, D-08 threshold-aware removal, status-mode flip, and Transaction attribution — 30 tests all green.

---

## What Was Built

Plan 01 shipped the GET skeleton. This plan delivered the four write endpoints under `/api/shopping-list`:

| Endpoint | Status | Key behaviour |
|---|---|---|
| `POST /` | 201 | Manual add; sort_order = max+1; 409 on duplicate; 404 on archived/unknown |
| `DELETE /{entry_id}` | 200 | Removes entry; item untouched; entry may re-appear on next GET if still below threshold |
| `PATCH /{entry_id}` | 200 | Updates sort_order for drag-and-drop persistence |
| `POST /{entry_id}/check-off` | 200 | Atomic: increment item.quantity + insert Transaction + conditional delete entry |

### D-08 Threshold Logic (check-off removal)

```python
should_remove = (threshold is None) or (new_quantity >= threshold)
```

- `threshold=None` (no threshold configured, or was status-mode item) → always remove on any restock
- `threshold=0` (default) → `new_quantity >= 0` is always true for any positive add → remove
- `threshold=N` → remove only when `old_qty + added >= N`

### Status-Mode → Exact-Mode Flip (RSTO-03)

When a status-mode item (`quantity_mode='status'`) is checked off:
- `quantity_mode` → `EXACT`
- `status` → `None`
- `quantity` → `quantity_added` (starts fresh from the restocked amount)
- Entry removed (threshold is NULL after flip logic)

### Transaction Attribution (T-04-11)

Every check-off appends a `quantity_change` Transaction row with `ha_user_name` populated from the `X-Ingress-Remote-User-Name` ingress header via `request.state.user`.

---

## Tasks Completed

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Append Wave 1 RED tests (13-30) | f38a380 | backend/tests/test_shopping_list.py |
| 2 | Implement write endpoints (GREEN) | a5476d5 | backend/routers/shopping_list.py |

---

## Test Results

- 30/30 shopping list tests pass (tests 1-12 original GET, tests 13-30 new writes)
- Full backend suite: **111 passed** (no regressions)

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — all endpoints are fully wired with real DB operations.

---

## Threat Flags

None — no new security surface beyond what the plan's threat model covers (T-04-08 through T-04-14 all mitigated as specified).

---

## Self-Check

- [x] `backend/routers/shopping_list.py` — modified, endpoints appended
- [x] `backend/tests/test_shopping_list.py` — modified, 30 test functions present
- [x] Commit f38a380 — RED tests
- [x] Commit a5476d5 — GREEN implementation
