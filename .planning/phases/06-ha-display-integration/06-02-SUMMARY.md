---
phase: 06
plan: 02
subsystem: docs
tags: [ha-integration, readme, documentation, iframe, rest-sensor]
dependency_graph:
  requires: [06-01]
  provides: [README HA integration section, copy-pasteable HA sensor YAML, copy-pasteable iframe YAML]
  affects: [README.md]
tech_stack:
  added: []
  patterns: [README documentation of REST sensor + iframe card]
key_files:
  created: []
  modified:
    - README.md
decisions:
  - "scan_interval: 60 recommended in README (not 30s default) per RESEARCH Pitfall 5 guidance"
  - "Direct port URL (port 8099) used for both sensor and iframe — ingress URL cannot be used for Lovelace iframes"
metrics:
  duration: "< 10 minutes"
  completed: "2026-04-24"
  tasks: 2
  files: 1
requirements:
  - HA-01
  - HA-02
---

# Phase 6 Plan 2: HA Documentation + Human Verification Summary

**One-liner:** README.md extended with a "Home Assistant Integration" section providing copy-pasteable YAML for the REST sensor (HA-01) and Lovelace iframe card (HA-02), verified on a live HAOS instance — endpoint returns valid JSON and iframe renders the app in Lovelace.

---

## What Was Built

### Files Modified

| File | Change |
|------|--------|
| `README.md` | Added `## Home Assistant Integration` section (50 lines) after `## Architecture`, before `## Local build workflow` |

The new section contains:
- `### REST sensor (HA-01)` — complete `configuration.yaml` snippet with `scan_interval: 60` and all 4 `json_attributes`
- `### Lovelace iframe card (HA-02)` — Lovelace card YAML using direct port 8099 URL
- `### Response shape` — example JSON response with field-level description

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `cad0474` | feat(06-02): add Home Assistant Integration section to README |
| Task 2 | — | checkpoint:human-verify (no code change; user approval recorded) |

---

## Human Verification Result

**Task 2 — Human verify iframe renders in HA Lovelace (HA-02 phase gate)**

Status: **APPROVED**

Verified on live HAOS instance (2026-04-24):

- `curl http://192.168.2.186:8099/api/ha/summary` returns valid JSON:
  `{"low_stock_count":0,"out_of_stock_count":0,"total_items":0,"low_stock_items":[],"out_of_stock_items":[]}`
- Iframe renders at `https://home.meowhain.de/5f0d53a9_inventar` (ingress path) — app displays correctly in Lovelace dashboard.

Environmental notes:
- The live instance was accessed via its LAN IP (`192.168.2.186:8099`) directly rather than the `homeassistant.local` mDNS alias; both reach the same port 8099 endpoint.
- The ingress panel URL (`5f0d53a9_inventar`) was used to confirm the sidebar panel also works alongside the direct-port iframe card.
- Inventory was empty at time of verification (`total_items: 0`); endpoint shape confirmed correct.

---

## Deviations from Plan

None — Task 1 executed exactly as written.

---

## Known Stubs

None — the documentation references the live endpoint from Plan 01. No hardcoded values or placeholders in the README section.

---

## Threat Flags

No new security surface beyond Plan 01. Documentation of the direct-port URL (T-06-06) is accepted per threat register — URL was already public via `config.yaml` ports_description. Spoofing risk of wrong URL in iframe (T-06-07) is mitigated by the explicit note in README.

---

## Self-Check: PASSED

- [x] `README.md` contains `## Home Assistant Integration`
- [x] `README.md` contains `### REST sensor (HA-01)`
- [x] `README.md` contains `### Lovelace iframe card (HA-02)`
- [x] `README.md` contains `### Response shape`
- [x] `README.md` contains `http://homeassistant.local:8099/api/ha/summary`
- [x] `README.md` contains `platform: rest`
- [x] `README.md` contains `scan_interval: 60`
- [x] `README.md` contains `value_template: "{{ value_json.low_stock_count }}"`
- [x] `README.md` contains `type: iframe`
- [x] `README.md` contains all 4 `json_attributes` lines
- [x] Top-level heading count increased from 8 to 9 (exactly +1)
- [x] No TODO/TBD/FIXME in new section
- [x] Commit `cad0474` exists
- [x] Task 2 human verification APPROVED — live HAOS instance confirmed endpoint + iframe render
