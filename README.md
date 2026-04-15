# Inventar

A Home Assistant add-on that turns HA into a home inventory tracker.
Know what you have, where it is, and what you need to buy — without
walking through every cupboard.

## Phase 1 scope

Phase 1 ships the add-on scaffolding only: a Docker container that boots
on HAOS, appears in the HA sidebar via ingress, serves a React nav shell
with three stub routes (Inventory, Shopping List, Settings), and
persists data at `/data/inventar.db`. No item CRUD yet — that lands in
Phase 2.

## Architecture

- **Backend:** FastAPI (Python 3.12) + SQLAlchemy 2 + Alembic, single
  uvicorn process on port 8099. Serves both HA ingress traffic and
  direct IP:port traffic from one binary.
- **Frontend:** React 19 + Vite 8 + react-router-dom 7, built to
  `frontend/dist/` with `base: './'` so every asset URL is relative
  (mandatory for HA ingress compatibility).
- **Database:** SQLite at `/data/inventar.db` (the only path that
  survives HA add-on updates).
- **Supervisor contract:** `config.yaml` + `build.yaml` + `Dockerfile`
  + `run.sh` at repo root. `arch: [amd64]` in Phase 1 (aarch64 deferred).

## Local build workflow

The Docker build COPIES a pre-built `frontend/dist/` into the image
rather than running Node inside the container. This keeps the image
Alpine+Python only. That means you must build the frontend BEFORE
`docker build`.

### Linux / macOS

```bash
./scripts/build.sh
docker build -t inventar-addon .
```

### Windows PowerShell

```powershell
.\scripts\build.ps1
docker build -t inventar-addon .
```

The build helper runs `npm install` and `npm run build` in `frontend/`
and verifies that `frontend/dist/index.html` was produced.

## Running tests

### Backend

```bash
cd backend
pytest tests/ -q
```

The backend test suite covers all five INFRA-0X requirements:

- **INFRA-01** — container health endpoint (`/healthz` → 200 JSON)
- **INFRA-02** — SPA root route serves `frontend/dist/index.html`
- **INFRA-03** — default DB URL is `sqlite:////data/inventar.db`; Alembic
  migration creates all five v1 tables
- **INFRA-04** — `X-Ingress-Remote-User-*` headers are read by the
  ingress middleware; no login challenge is raised
- **INFRA-05** — direct-port access works without HA auth headers

Integration tests in `test_spa_integration.py` and `test_smoke_stack.py`
only run when `frontend/dist/` exists. Run the build helper first so
they don't skip.

### Frontend

```bash
cd frontend
npx vitest run
```

Covers `apiFetch` (the ingress-safe fetch helper) and `AppLayout` (nav
shell + route rendering).

## Installing on HAOS

1. On the target HA instance, add this repository as a custom add-on
   repository (Supervisor → Add-on Store → Repositories).
2. Open the Inventar add-on page and click *Install*. Supervisor reads
   `config.yaml` + `build.yaml` + `Dockerfile` and builds the image.
3. Start the add-on. The `Open WebUI` button opens the app through HA
   ingress (HTTPS, no separate login required).
4. Optional: hit `http://<haos-ip>:8099/healthz` from LAN to verify
   direct-port access (INFRA-05).

## Critical implementation constraints

These are non-negotiable; any change to them requires a new roadmap
decision:

- Vite `base: './'` — absolute paths break under ingress
- All data writes go to `/data/inventar.db` — nothing else survives
  add-on updates
- Server binds to `0.0.0.0` — Supervisor proxies from outside loopback
- `run.sh` must be LF-only — CRLF breaks the bashio shebang
- Ingress user headers are `X-Ingress-Remote-User-*` (NOT
  `X-Remote-User-*` — the latter is a pre-release name never set by
  Supervisor)

## Project layout

```
inventar/
├── config.yaml                 # HA add-on manifest
├── build.yaml                  # arch → base image mapping
├── Dockerfile                  # container build
├── run.sh                      # container entry script (LF only)
├── repository.yaml             # HA custom repo metadata
├── scripts/
│   ├── build.sh                # Linux/macOS build helper
│   └── build.ps1               # Windows build helper
├── backend/                    # FastAPI app (see backend/ README — TBD)
│   ├── main.py
│   ├── db/
│   ├── models/
│   ├── routers/
│   ├── middleware/
│   ├── alembic/
│   └── tests/
└── frontend/                   # Vite + React SPA (see frontend/ README — TBD)
    ├── vite.config.js          # base: './' is mandatory
    └── src/
```

## Phase roadmap

- **Phase 1** (this one) — add-on scaffolding
- **Phase 2** — core inventory CRUD + categories + locations
- **Phase 3** — barcode scanning + Open Food Facts lookup
- **Phase 4** — shopping list + reorder thresholds + restock mode
- **Phase 5** — recipes
- **Phase 6** — HA display integration (REST sensor + iframe card)

See `.planning/ROADMAP.md` for full detail.
