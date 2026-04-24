# Phase 6: HA Display Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 06-ha-display-integration
**Areas discussed:** Sensor data shape, HA polling auth, Iframe access path

---

## Sensor Data Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Counts only | `{ low_stock_count, out_of_stock_count, total_items }` | |
| Counts + item names | Adds `low_stock_items[]` and `out_of_stock_items[]` name lists | ✓ |
| Counts + category breakdown | Adds per-category low/out counts for multiple HA sensors | |

**User's choice:** Counts + item names

Follow-up — list cap:

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 10 | Max 10 names per list | |
| Return all | No cap — return every matching item | ✓ |

**Notes:** Return all low/out items by name with no cap.

---

## HA Polling Auth

| Option | Description | Selected |
|--------|-------------|----------|
| No auth | Open endpoint, relies on local network trust | ✓ |
| HA long-lived token | Bearer token in Authorization header | |

**User's choice:** No auth

Follow-up — sample YAML docs:

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include sample YAML | Add HA configuration.yaml snippet to README | ✓ |
| No, skip docs | Skip sample config | |

---

## Iframe Access Path

| Option | Description | Selected |
|--------|-------------|----------|
| Direct port URL | `http://homeassistant.local:8099` — simple, validated | ✓ |
| HA ingress URL | Dynamic `/api/hassio_ingress/TOKEN/` path | |
| Document both | Show both with trade-offs | |

**User's choice:** Direct port URL (`http://homeassistant.local:8099`)

Follow-up — header verification:

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + fix headers if needed | Check X-Frame-Options / CSP, fix if blocking iframe | ✓ |
| Docs only | Assume it works, skip header check | |

---

## Claude's Discretion

- HTTP error shape for `/api/ha/summary` if DB unavailable
- CORS header for the summary endpoint
- Sort order of `low_stock_items` and `out_of_stock_items` lists

## Deferred Ideas

None.
