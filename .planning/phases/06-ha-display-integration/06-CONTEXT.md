# Phase 6: HA Display Integration - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose read-only inventory data to Home Assistant in two ways:
1. A REST endpoint (`/api/ha/summary`) that HA can poll to create sensor entities showing low-stock and out-of-stock counts and item names.
2. The existing app UI, accessible at the direct port URL, embeds cleanly as an iframe card in HA Lovelace dashboards.

No new UI is added to the Inventar app itself. No bidirectional integration (display-only per PROJECT.md v1 constraint).

</domain>

<decisions>
## Implementation Decisions

### Sensor Endpoint — Data Shape
- **D-01:** Endpoint is `GET /api/ha/summary` (no auth, open on local network)
- **D-02:** Response shape:
  ```json
  {
    "low_stock_count": 3,
    "out_of_stock_count": 1,
    "total_items": 42,
    "low_stock_items": ["Milk", "Coffee", "Oat milk"],
    "out_of_stock_items": ["Pasta"]
  }
  ```
  - `low_stock_items`: item names where `quantity_mode=STATUS` and `status=LOW`, or `quantity_mode=EXACT` and `quantity <= reorder_threshold` (and `reorder_threshold` is set)
  - `out_of_stock_items`: item names where `status=OUT` or `quantity=0`
  - `total_items`: count of non-archived items
  - No cap on list length — return all matching items

### HA Polling Auth
- **D-03:** No authentication required on the endpoint — relies on local network trust (HAOS deployment, not internet-exposed)
- **D-04:** Add a sample HA `configuration.yaml` snippet to the add-on README showing how to wire up the REST sensor

### Iframe Embedding
- **D-05:** Document the direct port URL (`http://homeassistant.local:8099`) for HA Lovelace iframe card config — simple, always works, port 8099 already open (INFRA-05 validated)
- **D-06:** Verify that the app does not send `X-Frame-Options: DENY` or a `Content-Security-Policy: frame-ancestors` restriction that would block iframe embedding. Fix response headers if needed.

### Claude's Discretion
- Exact HTTP status codes and error shape for `/api/ha/summary` (e.g. if DB is unavailable)
- Whether to add a CORS header for the summary endpoint (likely needed if HA polls via REST sensor)
- Sorting of `low_stock_items` and `out_of_stock_items` lists

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Project context
- `.planning/PROJECT.md` — Product vision, out-of-scope items (HA integration is display-only in v1)
- `.planning/REQUIREMENTS.md` §HA Display Integration — HA-01 and HA-02 acceptance criteria
- `.planning/STATE.md` §Critical Implementation Constraints — Non-negotiable constraints (port binding, /data, append-only transactions)

### Prior phase summaries (relevant context)
- `.planning/phases/01-add-on-scaffolding/01-02-SUMMARY.md` — Backend schema, middleware, test patterns
- `.planning/phases/01-add-on-scaffolding/01-03-SUMMARY.md` — Frontend stack, design tokens, apiFetch contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/models/__init__.py` — `Item`, `QuantityMode`, `StockStatus` ORM models; query logic for low/out stock is a simple filter on `status` / `quantity <= reorder_threshold`
- `backend/main.py` — FastAPI app; new `/api/ha/summary` router registered here following existing pattern
- `backend/routers/` — All existing routers follow the same pattern (include_router in main.py, separate file per domain)

### Established Patterns
- No auth middleware on the summary endpoint — `IngressUserMiddleware` populates `request.state.user` but is non-blocking (graceful fallback exists, see 05-03-SUMMARY.md T-05-19)
- Direct port 8099 already open and tested (`config.yaml` ports section, INFRA-05 validated Phase 1)

### Integration Points
- New router: `backend/routers/ha_display.py` → registered in `backend/main.py`
- README at repo root — add HA sensor + iframe documentation section
- Backend middleware or response headers — check `backend/middleware/` for any existing `X-Frame-Options` or CSP header injection

</code_context>

<specifics>
## Specific Ideas

- Sample HA YAML the user confirmed they want in the README:
  ```yaml
  # configuration.yaml
  sensor:
    - platform: rest
      name: Inventar Low Stock
      resource: http://homeassistant.local:8099/api/ha/summary
      value_template: "{{ value_json.low_stock_count }}"
      json_attributes:
        - low_stock_items
        - out_of_stock_count
        - out_of_stock_items

  # Lovelace dashboard card
  type: iframe
  url: http://homeassistant.local:8099
  title: Inventar
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-ha-display-integration*
*Context gathered: 2026-04-24*
