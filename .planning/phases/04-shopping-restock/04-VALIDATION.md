---
phase: 4
slug: shopping-restock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vite.config.js` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ && cd ../frontend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SHOP-01 | — | N/A | migration | `cd backend && alembic upgrade head` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | SHOP-01 | — | N/A | unit | `cd backend && python -m pytest tests/test_shopping_list.py -x -q` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | SHOP-01/02 | — | N/A | unit | `cd backend && python -m pytest tests/test_shopping_list.py -x -q` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | SHOP-01/02/03 | — | N/A | component | `cd frontend && npx vitest run src/pages/ShoppingList.test.jsx` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | SHOP-04 | — | N/A | component | `cd frontend && npx vitest run src/components/NavBadge.test.jsx` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 3 | SHOP-05 | — | N/A | component | `cd frontend && npx vitest run src/pages/ShoppingList.test.jsx` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 3 | RSTO-01/02/03 | — | N/A | component | `cd frontend && npx vitest run src/hooks/useBarcodeScanner.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_shopping_list.py` — stubs for SHOP-01 through SHOP-05, RSTO-01 through RSTO-03
- [ ] `frontend/src/pages/ShoppingList.test.jsx` — stubs for shopping list UI
- [ ] `frontend/src/hooks/useBarcodeScanner.test.js` — extended stubs for restock mode
- [ ] `frontend/src/components/NavBadge.test.jsx` — stubs for low-stock badge

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop reordering persists across sessions | SHOP-02 | Requires real browser interaction with pointer events | Open ShoppingList, drag items, reload page, verify order preserved |
| Web Share API export opens native share sheet | SHOP-05 | Requires real mobile browser with navigator.share() | On mobile, tap share button, verify native share sheet opens with correct text |
| Camera scan in restock mode (physical barcode) | RSTO-01 | Requires physical camera + barcode | Open restock mode, scan physical barcode, verify QuickUpdateSheet opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
