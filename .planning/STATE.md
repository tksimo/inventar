---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Phase 4 UI-SPEC approved
last_updated: "2026-04-19T15:10:25.730Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 22
  completed_plans: 22
  percent: 100
---

# Project State: Inventar

**Last updated:** 2026-04-15
**Session:** Phase 1 planning complete

---

## Project Reference

**Core value:** At a glance, know what you have, where it is, and what you need to buy — without having to walk through every cupboard.

**Current milestone:** 1 — Home inventory webapp as HA add-on

**Current focus:** Phase 04 — shopping-restock

---

## Current Position

Phase: 04 (shopping-restock) — EXECUTING
Plan: 1 of 6
**Phase:** 5
**Plan:** Not started
**Status:** Ready to plan

**Progress:**

[█████████░] 92%
[          ] Phase 1: Add-on Scaffolding
[          ] Phase 2: Core Inventory
[          ] Phase 3: Barcode Scanning
[          ] Phase 4: Shopping & Restock
[          ] Phase 5: Recipes
[          ] Phase 6: HA Display Integration

```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases defined | 6 |
| Requirements mapped | 38/38 |
| Plans created | 4 |
| Plans completed | 0 |
| Phases completed | 0 |

---
| Phase 01 P01 | 2 | 2 tasks | 7 files |
| Phase 01 P02 | 4 | 2 tasks | 23 files |
| Phase 01 P03 | 6 | 2 tasks | 23 files |
| Phase 01 P04 | 4 | 2 tasks | 7 files |
| Phase 02-core-inventory P01 | 12 | 2 tasks | 9 files |
| Phase 02 P03 | 6min | 3 tasks | 17 files |
| Phase 02-core-inventory P02 | 25min | 2 tasks | 7 files |
| Phase 02-core-inventory P09 | 10min | 2 tasks | 4 files |

## Accumulated Context

### Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Python + FastAPI + SQLite backend | Lightweight, pre-installed in HA base images, no extra processes |
| React + Vite frontend | Best barcode library compatibility; Vite base must be "./" |
| html5-qrcode for barcode scanning | Handles iOS Safari quirks; avoids unmaintained QuaggaJS |
| /data for all persistence | Only path that survives HA add-on updates |
| Separate items + stock tables | Clean catalog/state split; enables transaction history without complexity |
| quantity REAL nullable + status enum | Supports both exact counts and fuzzy "have/low/out" modes from day 1 |
| Open Food Facts proxied via backend | Consistent user-agent, server-side caching, avoids browser CORS |
| HA ingress for auth | No separate login needed; HA session passes through; X-Ingress-Remote-User-Name for attribution |
| Recipes included in v1 scope | RECP-01–05 are in REQUIREMENTS.md v1; research flags them as "validate first" |
| Display-only HA integration (v1) | REST sensor endpoint only; no bidirectional entity push needed |
| INVENTAR_DB_URL env var for test override | Tests never touch /data; conftest.py sets env var before any import |
| Unconditional SPA mount with INVENTAR_SKIP_SPA flag | Unit tests set INVENTAR_SKIP_SPA=1 before import; integration tests clear it; RuntimeError at startup if dist/ missing |
| All 5 v1 tables in Phase 1 migration 0001 | Phase 2+ adds zero infrastructure migrations; schema complete from day one |
| vitest.config.js esbuild.jsx='automatic' | vitest 3.2.4 bundles vite 7 internally; @vitejs/plugin-react 6 requires vite 8; esbuild option bypasses version gap |
| BrowserRouter test renders App directly | react-router 7 throws on nested routers; jsdom default URL is '/' so BrowserRouter matches Inventory route without MemoryRouter wrapper |
| apiFetch is the sole API call contract | All Phase 2+ code must use apiFetch(path) — never fetch('/path') — to preserve HA ingress token in URL |
| Alembic data migration for ORG-01 seed | Migration 0002 seeds 4 default categories — runs once at upgrade, idempotent via INSERT OR IGNORE, survives restarts |
| use_enum_values=True in Pydantic v2 ConfigDict | Serializes QuantityMode/StockStatus as lowercase strings ('exact', 'status', 'have', 'low', 'out') without custom serializers |
| CategoryCreate omits is_default | Clients cannot self-promote categories to default status; only migration 0002 sets is_default=1 (T-02-02) |

### Critical Implementation Constraints

- Vite `base` must be `"./"` not `"/"` — absolute paths break under HA ingress
- All data must write to `/data/inventar.db` — nothing else survives container updates
- Server must bind to `0.0.0.0` not `127.0.0.1` — Supervisor proxies from outside loopback
- Camera requires HTTPS — guaranteed by HA ingress; direct HTTP port must NOT be used for scanning
- iOS camera requires user-gesture gate + `playsinline autoplay muted` on the video element
- Transactions table must be append-only from Phase 2 day one — retrofitting breaks audit trail
- Categories must be FK'd entities, not free-text strings — enforce from Phase 2

### Open Questions (Verify Before Phase 1)

1. Ingress header names: `X-Remote-User-Name` vs `X-Hass-User-Name`, `X-Ingress-Path` vs `X-HA-Ingress-Path`
2. Base image tag format: `ghcr.io/home-assistant/amd64-base-python:3.12` vs `ARG BUILD_FROM` + `build.yaml` pattern
3. `config.yaml` field names: confirm `panel_icon`, `panel_title`, `map: [data:rw]` are current
4. Open Food Facts API version: v2 (`api/v2/`) vs v0 (`api/v0/`) — use v2
5. html5-qrcode maintenance status: verify no critical iOS Safari issues at implementation time

### Blockers

None.

### Todos

- [ ] Verify HA ingress header names before Phase 1 implementation
- [ ] Verify HA base image tag format before Phase 1 Dockerfile
- [ ] Verify Open Food Facts API version (v2 vs v0) before Phase 3

---

## Session Continuity

Last session: 2026-04-17T23:06:03.315Z
Stopped at: Phase 4 UI-SPEC approved
Resume file: .planning/phases/04-shopping-restock/04-UI-SPEC.md

To resume: `/clear` then `/gsd-execute-phase 1`

**Phase 1 plan summary:**

- 01-01 (Wave 1): HA add-on packaging — config.yaml, build.yaml, Dockerfile, run.sh
- 01-02 (Wave 1): FastAPI backend skeleton — SQLite, Alembic, ingress middleware, health endpoint
- 01-03 (Wave 1): React/Vite frontend SPA — nav shell with 3 stub routes, Vite base='./'
- 01-04 (Wave 2): Integration wiring + smoke tests — FastAPI serves SPA, end-to-end INFRA tests

---
*State initialized: 2026-04-14*
