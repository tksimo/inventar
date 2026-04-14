# Phase 1: Add-on Scaffolding - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap the complete Home Assistant add-on infrastructure: Docker container boots on HAOS, appears in the HA sidebar, serves a working React SPA through HA ingress with correct relative asset paths, persists all data in /data, and is also reachable at a direct local IP:port. The SPA is a real navigation shell — not throwaway placeholder code — so Phase 2 builds directly on top without rework.

This phase delivers infrastructure only. No item CRUD, no inventory data, no barcode scanning. The database schema IS defined in full so Phase 2 has zero migration work.

</domain>

<decisions>
## Implementation Decisions

### Repository Structure
- **D-01:** `frontend/` subdirectory holds the Vite + React app; `backend/` subdirectory holds the FastAPI app
- **D-02:** `config.yaml`, `Dockerfile`, and `build.yaml` live at the repo root — HA Supervisor expected layout for single-add-on repositories
- **D-03:** No nested add-on config directory (no `ha/` or `addon/` subdir) — Supervisor reads from root

### SPA Scope
- **D-04:** Phase 1 delivers a real navigation shell, not a minimal "it boots" page — routing, layout, and nav are production-quality so Phase 2 adds feature content without touching scaffolding
- **D-05:** Nav sections in Phase 1: **Inventory**, **Shopping List**, **Settings** — each as a stub route (empty content area with section title). Phase 2 populates Inventory; Phase 4 populates Shopping List.
- **D-06:** The Vite build config MUST use `base: "./"` (relative, not `"/"`). This is non-negotiable — absolute paths break all assets under HA ingress.

### Backend
- **D-07:** FastAPI exposes `GET /healthz` → `{"status": "ok"}` with HTTP 200. HA Supervisor uses this for container health; also useful for direct IP:port verification.
- **D-08:** FastAPI serves the built React SPA static files (from `frontend/dist/`) via `StaticFiles` mount.
- **D-09:** Server binds to `0.0.0.0` (not `127.0.0.1`) — HA Supervisor proxies from outside loopback.
- **D-10:** Both HA ingress traffic and direct IP:port traffic are served by the same FastAPI process on a single port (e.g., 8099). No separate nginx or second server process.

### Database
- **D-11:** Full v1 SQLAlchemy ORM schema defined in Phase 1 — all tables created on startup even though Phase 2 adds the UI. Tables: items, categories, locations, stock/quantity state, transactions (append-only audit log), users/sessions reference.
- **D-12:** SQLAlchemy ORM (not raw sqlite3, not SQLModel). Models defined as Python classes.
- **D-13:** Alembic migrations configured from day one. Phase 1 creates the initial migration (all tables). Later phases add incremental migrations.
- **D-14:** Database file at `/data/inventar.db` — the ONLY path that survives HA add-on updates. Nothing writes outside `/data`.

### HA Add-on Build Config
- **D-15:** Multi-arch pattern: `ARG BUILD_FROM` in Dockerfile + `build.yaml` mapping arch → base image (not hardcoded `ghcr.io` tags). Supervisor sets `BUILD_FROM` at build time.
- **D-16:** Architectures supported in Phase 1: **amd64 only** (Intel NUC target). `config.yaml` lists `arch: [amd64]`. Raspberry Pi (aarch64) support is deferred.

### Claude's Discretion
- Exact Python package management approach (pip + requirements.txt vs Poetry vs uv)
- Specific FastAPI folder structure within `backend/` (routers, models, db directories)
- React component library choice for the nav shell (or no component library)
- Specific port number for direct access (something in the 8000–9000 range)
- Ingress path-stripping middleware approach (how FastAPI handles `X-Ingress-Path` prefix)

</decisions>

<specifics>
## Specific Ideas

- The goal in STATE.md is explicit: "zero placeholder behavior that would require rework in later phases." The nav shell must be real routing and layout code.
- STATE.md critical constraints to enforce:
  - `base: "./"` in Vite config — absolute `/` breaks ingress
  - Write only to `/data/inventar.db`
  - Bind to `0.0.0.0`
  - Transactions table must be append-only from day one (not retrofittable)
  - Categories must be FK'd entities (not free-text strings) — enforced from Phase 1 schema
- STATE.md open questions that the researcher MUST verify before planning implementation:
  1. HA ingress header names: `X-Remote-User-Name` vs `X-Hass-User-Name`; `X-Ingress-Path` vs `X-HA-Ingress-Path`
  2. Base image Python tag: `ghcr.io/home-assistant/amd64-base-python:3.12-X.X.X` format confirmation
  3. `config.yaml` field names: confirm `panel_icon`, `panel_title`, `map: [data:rw]` are current HA Supervisor API

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and success criteria
- `.planning/ROADMAP.md` §"Phase 1: Add-on Scaffolding" — Goal, success criteria, dependencies

### Requirements
- `.planning/REQUIREMENTS.md` §"Add-on Infrastructure" — INFRA-01 through INFRA-05 (the five requirements this phase must satisfy)

### Architecture decisions and constraints
- `.planning/STATE.md` §"Key Decisions Made" — Tech stack decisions (FastAPI, SQLite, React/Vite, ingress auth)
- `.planning/STATE.md` §"Critical Implementation Constraints" — Non-negotiable constraints (Vite base, /data, 0.0.0.0 binding, append-only transactions)
- `.planning/STATE.md` §"Open Questions (Verify Before Phase 1)" — Items researcher must resolve before planner generates tasks

### Project context
- `.planning/PROJECT.md` — What this product is, user context, out-of-scope items

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- None yet — Phase 1 establishes the patterns that all later phases follow.

### Integration Points
- Phase 2 connects to the SQLAlchemy models and Alembic migrations defined in Phase 1
- Phase 2 connects to the React router structure and nav shell defined in Phase 1
- Phase 3 uses the same FastAPI backend structure for the barcode/Open Food Facts endpoints

</code_context>

<deferred>
## Deferred Ideas

- aarch64 (Raspberry Pi) support — deferred from multi-arch discussion; add to Phase 1 scope only if the NUC build is validated first
- Nginx reverse proxy for separate ingress + direct port handling — user chose single FastAPI process; revisit if port routing gets complex
- Full component library (e.g., shadcn/ui, Chakra) — deferred to Phase 2 when the first real UI is built

</deferred>

---

*Phase: 01-add-on-scaffolding*
*Context gathered: 2026-04-14*
