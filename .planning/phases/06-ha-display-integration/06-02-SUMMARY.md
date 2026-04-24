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
  duration: "< 5 minutes"
  completed: "2026-04-24"
  tasks: 1
  files: 1
requirements:
  - HA-01
  - HA-02
---

# Phase 6 Plan 2: HA Documentation + Human Verification Summary

**One-liner:** README.md extended with a "Home Assistant Integration" section providing copy-pasteable YAML for the REST sensor (HA-01) and Lovelace iframe card (HA-02), with a response-shape reference; human verification of live iframe render pending user approval.

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

---

## Checkpoint Status

**Task 2 — Human verify iframe renders in HA Lovelace (HA-02 phase gate)**

Status: **AWAITING USER APPROVAL**

This is a `checkpoint:human-verify` gate. Execution paused here. The user must follow the verification procedure below and reply `approved` to complete the plan.

### Verification Procedure

1. Ensure the add-on is installed and running on the target HAOS instance (rebuild/reinstall if backend code was updated in Plan 01).
2. Confirm the backend endpoint responds from HA's host:
   - SSH into HAOS or use Terminal add-on: `curl -sS http://homeassistant.local:8099/api/ha/summary`
   - Expect a JSON object with keys `low_stock_count`, `out_of_stock_count`, `total_items`, `low_stock_items`, `out_of_stock_items`.
3. Add the REST sensor to `configuration.yaml` using the YAML from the README section. Restart HA. In Developer Tools → States, locate `sensor.inventar_low_stock`; confirm state is a number and attributes include `low_stock_items`, `out_of_stock_items`, `total_items`.
4. Open a Lovelace dashboard → Edit → Add Card → Manual → paste the iframe YAML from the README.
5. Save the dashboard. Confirm the Inventar app UI renders inside the iframe with NO blocked-content error, NO "refused to connect" message, and NO blank frame.
6. Click through one app route inside the iframe (e.g. open an inventory item) to confirm the SPA is functional inside the frame.
7. Reload the dashboard — confirm the iframe still renders after a fresh load.

### Resume Signal

Type `approved` if the sensor state updates correctly AND the iframe renders the app with a working route. If any step fails, paste the exact error text and we will diagnose.

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
