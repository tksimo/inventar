---
phase: 6
slug: ha-display-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini |
| **Quick run command** | `cd backend && python -m pytest tests/test_ha_display.py -q` |
| **Full suite command** | `cd backend && python -m pytest -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_ha_display.py -q`
- **After every plan wave:** Run `cd backend && python -m pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | HA-01 | T-06-01 / — | Endpoint open with no auth token required | unit | `cd backend && python -m pytest tests/test_ha_display.py -q` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | HA-01 | — | low/out counts match DB state | unit | `cd backend && python -m pytest tests/test_ha_display.py -q` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | HA-01 | — | item name lists include correct items | unit | `cd backend && python -m pytest tests/test_ha_display.py -q` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | HA-02 | — | No X-Frame-Options: DENY in response | unit | `cd backend && python -m pytest tests/test_ha_display.py -q` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | HA-02 | — | iframe renders correctly in HA Lovelace | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_ha_display.py` — stubs for HA-01 (summary endpoint) and HA-02 (iframe headers)
- [ ] `backend/tests/conftest.py` — shared fixtures (already exists from prior phases)

*Existing pytest infrastructure covers this phase — only new test file needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iframe renders in HA Lovelace dashboard | HA-02 | Requires live HA instance with Lovelace dashboard | Open HA > Dashboard > Edit > Add iframe card with url: http://homeassistant.local:8099 > Confirm app renders without blocked-content error |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
