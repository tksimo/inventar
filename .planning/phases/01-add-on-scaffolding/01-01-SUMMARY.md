---
phase: 01-add-on-scaffolding
plan: "01"
subsystem: infra
tags: [home-assistant, docker, packaging, ingress, alpine]

requires: []
provides:
  - HA add-on manifest (config.yaml) with ingress, sidebar panel, and direct port 8099
  - Per-arch Docker base image mapping (build.yaml) for amd64 Alpine Python 3.12
  - Container build definition (Dockerfile) using ARG BUILD_FROM pattern
  - Container entry script (run.sh) that runs alembic migrations then starts uvicorn
  - HA custom repository metadata (repository.yaml)
  - LF enforcement and Docker build context trimming (.gitattributes, .dockerignore)
affects:
  - 01-02 (backend skeleton — Dockerfile and run.sh define the container environment)
  - 01-03 (frontend SPA — Dockerfile COPYs frontend/dist/)
  - 01-04 (integration wiring — ingress_port 8099 must match uvicorn bind)

tech-stack:
  added:
    - ghcr.io/home-assistant/base-python:3.12-alpine3.23 (HA Docker base image)
    - /usr/bin/with-contenv bashio (HA entry script shebang)
  patterns:
    - ARG BUILD_FROM + build.yaml architecture mapping
    - Single FastAPI process serving both HA ingress and direct IP:port traffic
    - Alembic migrations run on every container start (idempotent)

key-files:
  created:
    - config.yaml
    - build.yaml
    - repository.yaml
    - Dockerfile
    - run.sh
    - .gitattributes
    - .dockerignore
  modified: []

key-decisions:
  - "Ingress port 8099 used for both config.yaml ingress_port and uvicorn --port (no translation layer)"
  - "ARG BUILD_FROM defaults to exact verified tag so plain docker build works without build.yaml"
  - "run.sh uses LF endings enforced by .gitattributes to prevent Alpine exec failures on Windows dev machines"
  - "frontend/dist/ COPY in Dockerfile — frontend is pre-built on host; Alpine has no Node"
  - "chmod +x /run.sh inside Dockerfile layer — preserves execute bit lost on Windows NTFS"

patterns-established:
  - "Pattern: HA add-on packaging — config.yaml + build.yaml + Dockerfile + run.sh at repo root"
  - "Pattern: LF enforcement — .gitattributes eol=lf on *.sh prevents CRLF breaking Alpine exec"

requirements-completed: [INFRA-01, INFRA-02]

duration: 2min
completed: 2026-04-15
---

# Phase 01 Plan 01: HA Add-on Packaging Summary

**Root-level HA add-on packaging established: config.yaml + build.yaml + Dockerfile + run.sh + repository.yaml with ingress on port 8099, sidebar panel, and Alpine Python 3.12 base image.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-15T06:42:00Z
- **Completed:** 2026-04-15T06:43:20Z
- **Tasks:** 2 completed
- **Files modified:** 7 created

## Accomplishments

- Created verified HA add-on manifest satisfying INFRA-01 (container runs under Supervisor) and INFRA-02 (panel appears in HA sidebar)
- Established Dockerfile with ARG BUILD_FROM pattern pointing to `ghcr.io/home-assistant/base-python:3.12-alpine3.23`
- Created run.sh (LF-only) that runs alembic migrations idempotently then starts uvicorn on 0.0.0.0:8099
- Added .gitattributes to enforce LF for shell scripts (prevents Alpine exec failure on Windows dev machines)
- Added .dockerignore to exclude .git, .planning, .claude, frontend source, Python cache from build context

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HA add-on manifest, build.yaml, and repository.yaml** - `73bc929` (feat)
2. **Task 2: Create Dockerfile, run.sh, .gitattributes, and .dockerignore** - `798f984` (feat)

## Files Created/Modified

- `config.yaml` - HA add-on manifest: name, slug, arch, ingress, ingress_port, panel_icon, panel_title, ports, map
- `build.yaml` - Architecture to base image mapping: amd64 -> ghcr.io/home-assistant/base-python:3.12-alpine3.23
- `repository.yaml` - HA custom repository metadata (name, url, maintainer)
- `Dockerfile` - Container build: ARG BUILD_FROM, installs pip deps, copies backend/ and frontend/dist/, runs /run.sh
- `run.sh` - Entry script: mkdir -p /data, alembic upgrade head, exec uvicorn on 0.0.0.0:8099
- `.gitattributes` - LF enforcement for *.sh, Dockerfile, *.yaml
- `.dockerignore` - Excludes dev artifacts, .planning, frontend source (keeps frontend/dist/)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. This plan creates configuration/packaging files only; no UI rendering or data stubs exist.

## Threat Flags

None. All threat mitigations from the plan's threat model were addressed:
- T-01-02: .dockerignore excludes .git, .planning, .claude from image layers
- T-01-05: map: [data:rw] is the only persistent volume declared
- T-01-06: .gitattributes forces LF on *.sh; run.sh verified LF-only via Python byte check

## Self-Check: PASSED

- config.yaml: FOUND
- build.yaml: FOUND
- repository.yaml: FOUND
- Dockerfile: FOUND
- run.sh: FOUND
- .gitattributes: FOUND
- .dockerignore: FOUND
- Commit 73bc929: FOUND
- Commit 798f984: FOUND
