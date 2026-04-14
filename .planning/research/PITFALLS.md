# Domain Pitfalls: Home Inventory HA Add-on

**Domain:** Home inventory webapp as a Home Assistant add-on
**Researched:** 2026-04-14
**Confidence note:** Web access unavailable. All findings from training data (cutoff Aug 2025).
HA add-on API and browser camera APIs are stable surfaces; confidence is MEDIUM-HIGH.
Verify HA Supervisor API docs at https://developers.home-assistant.io/docs/add-ons/ before implementation.

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or a project being abandoned.

---

### Pitfall C-1: Writing Data Outside /data — Wiped on Every Update

**What goes wrong:** The add-on stores its database or config files in `/app`, `/tmp`, `/config`,
or any path other than `/data`. Works fine during development. On the first add-on update (or
rebuild), the Supervisor recreates the container image and everything outside `/data` is silently
lost. All inventory data disappears with no warning to the user.

**Why it happens:** Developers familiar with Docker mount databases wherever they like. The HA
add-on `/data` persistence contract is not obvious unless you read the add-on docs carefully.
`/config` in a HA add-on context refers to the HA config share — it is not the same as the
add-on's own persistent storage and is not a reliable write target.

**Consequences:** Complete data loss on update. User trust destroyed. Potentially unrecoverable
if no backup strategy exists.

**Prevention:**
- All database files, user-generated data, and config MUST live under `/data` (maps to
  `/addon_configs/<slug>/data` on the host).
- Declare `map: ["data:rw"]` in `config.yaml`.
- On first boot, detect `/data` is empty and initialize schema there — never assume files exist.
- Smoke-test by stopping the container, deleting the image, and restarting before any release.

**Warning signs:**
- Database path is hardcoded to `/app/db.sqlite` or similar non-`/data` path.
- `config.yaml` is missing the `data:rw` map entry.
- Works in dev Docker but crashes or loses data after `docker pull`.

**Phase to address:** Add-on scaffolding phase (first phase). Bake this in before any feature work.

---

### Pitfall C-2: Ingress Breaks Absolute URL Paths and WebSocket Connections

**What goes wrong:** The app uses absolute asset paths (`/static/app.js`, `/api/items`),
hardcoded `window.location.origin` for API calls, or establishes WebSocket connections with
`ws://localhost`. When served through HA ingress, the app is mounted at a dynamic subpath
(`/api/hassio_ingress/<token>/`). All absolute paths 404. WebSocket handshakes fail. The app
appears blank or partially broken in the HA sidebar.

**Why it happens:** Ingress is essentially a reverse proxy that rewrites the path prefix but
cannot rewrite URLs embedded in your JavaScript bundle. The ingress token changes when the
add-on restarts, making it impossible to hardcode.

**Consequences:** The entire UI is broken when accessed via the HA sidebar. The add-on may
work fine when accessed directly by IP:port but fail for the intended use case.

**Prevention:**
- Use relative paths everywhere: `./static/app.js`, `./api/items`.
- Use `X-Ingress-Path` header (injected by HA Supervisor) as the base path for all API calls.
  Read it server-side on the first request and pass it to the frontend as a runtime config
  variable (e.g., inject into `index.html` as `window.__BASE_PATH__`).
- Configure your bundler (Vite/webpack) `base` option to `./` not `/`.
- If using WebSockets: derive the WS URL from `window.location` at runtime, not at build time.
- Test ingress early — do not leave this for the last phase.

**Warning signs:**
- Any hardcoded `/api/` prefix in frontend code.
- `fetch('/api/items')` instead of `fetch('./api/items')` or `fetch(BASE_PATH + '/api/items')`.
- Vite config has `base: '/'` (the default).

**Phase to address:** Add-on scaffolding / frontend skeleton phase. Must be solved before any
feature UI is built on top of it.

---

### Pitfall C-3: Barcode Scanning Requires HTTPS — HTTP Will Silently Fail on Phones

**What goes wrong:** `getUserMedia()` (the camera API) is blocked by browsers in non-secure
contexts. The add-on serves HTTP on the local network. On Android Chrome, camera access is
refused outright. On iOS Safari, the permission prompt never appears. The barcode scanner
silently fails to initialize. Users see nothing, or an unhelpful "camera not available" message.

**Why it happens:** As of Chrome 47+ and iOS Safari 11+, `getUserMedia` requires either
`https://` or `localhost`. A local IP address like `http://192.168.1.x` is not a secure context
even on a private network.

**Consequences:** The primary input method (barcode scanning) does not work on mobile, which
is where users will use it most. Workarounds are messy.

**Prevention:**
- Enable HTTPS in `config.yaml` with `ingress: true`. HA ingress is always served over HTTPS
  from the HA frontend (`https://homeassistant.local`), so ingress users get HTTPS automatically.
- If also exposing a direct port, configure a self-signed cert or use the HA SSL share.
- Do NOT assume "local network = HTTP is fine" for camera access — browsers no longer allow it.
- Test camera permission on a real phone over the actual network path (not localhost dev server)
  before declaring the feature done.

**Warning signs:**
- Add-on exposed on a plain HTTP port with no ingress.
- `getUserMedia` returns a `NotAllowedError` or never resolves on mobile.
- Works on desktop (where `localhost` exemption applies) but fails on phones.

**Phase to address:** Barcode scanning phase. Validate HTTPS/ingress path before implementing
scanner UI.

---

### Pitfall C-4: iOS Safari Barcode Scanning Has a Different Permission Model

**What goes wrong:** Camera permission works on Android Chrome but breaks on iOS Safari. The
permission request fires, the user grants it, but the video stream never starts or the
`<video>` element stays black. On iOS 14 and earlier, `getUserMedia` was not available in
non-Safari browsers at all (Chrome/Firefox on iOS use WebKit). On iOS 16.4+, the behavior
improved but quirks remain.

**Why it happens:** iOS Safari has a stricter camera permission model: the permission is bound
to the page origin AND must be triggered by a direct user gesture (a tap). If camera
initialization is called programmatically on page load without a user gesture, Safari blocks it
silently. Additionally, iOS Safari requires the `<video>` element to have `playsinline` and
`autoplay` attributes, or the stream will not render.

**Consequences:** Barcode scanning works on Android but not iPhones. Since households often
mix device types, this renders the feature unreliable for ~50% of users.

**Prevention:**
- Gate all `getUserMedia` calls behind a UI button tap — never call on page load.
- Add `playsinline autoplay muted` to the `<video>` element used for the camera stream.
- Test on an actual iPhone running Safari — simulators do not replicate permission behavior.
- Use a library like `html5-qrcode` (which handles iOS quirks) rather than raw `getUserMedia`.
  ZXing-js and QuaggaJS have historically had iOS issues; verify current status before choosing.
- Provide a manual barcode entry fallback for when camera access fails.

**Warning signs:**
- Camera initialized in a `useEffect` / `onMounted` hook without waiting for user interaction.
- `<video>` element missing `playsinline` attribute.
- Only tested on Android or desktop.

**Phase to address:** Barcode scanning phase. Test on real iOS device in first sprint of that phase.

---

## Moderate Pitfalls

---

### Pitfall M-1: Flat Quantity Model That Cannot Express "How Much"

**What goes wrong:** The data model stores quantity as a single integer (`quantity: 3`). This
works for canned goods but breaks immediately for: olive oil (half a bottle), rice (about 500g
left), dishwasher tablets (2 left out of 30), or eggs (7 left). Users either stop updating the
app because the model doesn't match reality, or they invent workarounds (entering "0.5" for a
half-bottle) that look nonsensical.

**Why it happens:** Integer quantity is the obvious first model. The complexity of unit-aware
quantity is not apparent until real items are entered.

**Consequences:** Users stop maintaining the inventory because updates feel wrong. The app
becomes inaccurate within weeks of use.

**Prevention:**
- Support two quantity modes from the start: exact count (integer) and status level
  (HAVE / LOW / OUT). The PROJECT.md already calls this out — build it in Phase 1.
- Store quantity as `{ type: "count" | "status", value: number | "have" | "low" | "out" }`.
- Do NOT add unit-of-measure tracking in v1 (it becomes a UX nightmare). Status mode covers
  the ambiguous cases (olive oil = LOW) without requiring unit input.
- Make status mode the default — most items in a home are tracked by presence, not exact count.

**Warning signs:**
- Schema has `quantity INTEGER NOT NULL`.
- No enum/status alternative to numeric quantity.
- Early user testing reveals "I don't know what to put for a half-empty bag of flour."

**Phase to address:** Data model phase (first phase). Schema must support both modes from the
start; retrofitting is a migration headache.

---

### Pitfall M-2: Category Structure That Becomes a Mess

**What goes wrong:** Categories are free-text strings stored per-item. "Food", "food",
"Food & Pantry", "pantry", and "Pantry" all become separate categories. After three weeks,
the category list has 20 entries, several near-duplicates, and no structure. Filtering by
category becomes useless. Alternatively: fixed categories are too rigid and users create
"Misc" as a dumping ground.

**Why it happens:** Free-text is easiest to implement. Fixed taxonomies feel restrictive.
Neither extreme works.

**Prevention:**
- Use a hybrid: a small set of built-in categories (matching PROJECT.md's list: Food & Pantry,
  Fridge & Freezer, Cleaning & Household, Personal Care) plus the ability to add custom
  categories as first-class records (not free text).
- Categories are a separate table/collection with an ID. Items reference category by ID.
- Normalize category names on creation (trim, title-case). Reject duplicates.
- Provide category merge/rename as an admin operation for when the list drifts.

**Warning signs:**
- Category stored as `category TEXT` on the item row with no foreign key or normalization.
- No category management screen.
- Multiple near-identical category names appear in the database after integration testing.

**Phase to address:** Data model phase. Categories as first-class entities, not strings.

---

### Pitfall M-3: No Audit Trail Means No Trust

**What goes wrong:** The inventory shows "3 bottles of shampoo" but the user knows they used
one this morning. Who changed it? When? There's no way to know. In a 2-3 person household,
discrepancies lead to "who used the last one without updating the app?" arguments and then
nobody trusts the data. The app stops being used.

**Why it happens:** Audit trail feels like scope creep in v1. "We'll add history later."
Adding it later requires schema changes that invalidate existing data.

**Consequences:** Inventory accuracy degrades; trust is lost; app is abandoned.

**Prevention:**
- Store an `updated_by` field and `updated_at` timestamp on every inventory mutation.
- For v1: a simple `last_updated_by: string` (user identifier) and `updated_at: timestamp` on
  each item is sufficient — full event sourcing is not needed.
- Optionally: a lightweight `history` table (item_id, old_quantity, new_quantity, changed_by,
  changed_at) for items that change frequently.
- Do NOT build a full audit UI in v1, but DO capture the data so it can be surfaced later.

**Warning signs:**
- Items table has no `updated_at` or `updated_by` column.
- Quantity changes have no attribution.
- "We'll add history in v2" is the answer to "who changed this?"

**Phase to address:** Data model phase. Capture metadata from day one, even if no UI exposes it.

---

### Pitfall M-4: Open Food Facts Rate Limiting and Failure Modes

**What goes wrong:** Every barcode scan hits the Open Food Facts API directly from the client
or server. Open Food Facts has rate limits (undocumented but enforced). Scan 20 items in
rapid succession and some lookups fail silently. The app returns no product name for items
that exist in the database. Worse: Open Food Facts is sometimes slow (300-2000ms), making the
scan-to-add flow feel broken.

**A secondary failure mode:** A barcode that IS in Open Food Facts returns a product object
with missing or wrong fields — no name, wrong category, product name in a foreign language.
The app blindly uses the API response and creates an item called "Produkt" or with an empty name.

**Why it happens:** Direct API integration is the happy path. Error handling and data validation
are left for later.

**Prevention:**
- **Always proxy through your backend.** Never call Open Food Facts directly from the browser.
  This hides your IP, allows server-side caching, and lets you add rate limiting protection.
- **Cache aggressively.** Store successful lookups in your own database permanently. The same
  barcode will almost never change its product name. A local cache of scanned barcodes reduces
  API calls by 80%+ within weeks.
- **Always validate the response.** A successful HTTP 200 from Open Food Facts does not mean
  the product has a usable name. Check `product.product_name` (or `product_name_en`). Fall back
  to `product.generic_name`. If both are empty, treat as "not found" and prompt manual entry.
- **Handle 404 gracefully.** Many barcodes (non-food items, regional products, store brands)
  are not in Open Food Facts. Always show a manual entry form as the fallback path, not an error.
- **Timeout the request.** Set a 3-second timeout. If the API is slow, fall back to manual
  entry immediately rather than blocking the user.

**Warning signs:**
- Frontend JavaScript directly calls `https://world.openfoodfacts.org/api/v0/product/...`.
- No local cache table for barcode lookups.
- `product_name` used without null/empty check.
- No fallback UI for "barcode not found" or "lookup failed."

**Phase to address:** Barcode scanning / product lookup phase.

---

### Pitfall M-5: Multi-User Conflicts with No Concurrency Strategy

**What goes wrong:** Two household members update the same item's quantity at the same moment
(e.g., one person scans "used 1" while another is editing the item on a different device).
The last write wins. One update is silently lost. For a 2-3 person household this is rare but
will happen, and when it does the inventory quietly becomes wrong.

**Why it happens:** "Last write wins" is the simplest implementation and works for a single
user. Multi-user edge cases are easy to defer.

**Prevention:**
- Use `updated_at` timestamps for optimistic locking: when a client submits an update, include
  the `updated_at` value it read. If the server's current `updated_at` differs, reject with a
  409 Conflict.
- For v1 with 2-3 users: a simple "show conflict, let user resolve" UI is sufficient. Full
  CRDT-style merging is out of scope.
- Real-time updates via SSE (Server-Sent Events) or WebSocket are valuable here: push quantity
  changes to all connected clients so stale reads are minimized.

**Warning signs:**
- UPDATE queries have no WHERE condition on `updated_at` or version field.
- No mechanism to notify other clients of changes.

**Phase to address:** Multi-user / real-time phase. Acceptable to defer past v1 single-user
build, but must be addressed before household rollout.

---

### Pitfall M-6: HA Supervisor API Token Confusion

**What goes wrong:** The add-on calls the HA Supervisor REST API (for reading entity states,
pushing sensors) using the wrong token or wrong base URL. The Supervisor API is at
`http://supervisor/` inside the add-on network, authenticated with the
`SUPERVISOR_TOKEN` environment variable (injected automatically). Developers sometimes:
- Use `HASSIO_TOKEN` (old name, may still work but deprecated)
- Call `http://homeassistant:8123` instead of `http://supervisor`
- Use a long-lived HA token created manually instead of the injected Supervisor token
- Forget to declare `hassio_api: true` and `homeassistant_api: true` in `config.yaml`

**Consequences:** API calls silently return 401. HA integration appears to work in dev but
fails in the packaged add-on. The HA sensor entities for inventory data never appear.

**Prevention:**
- Declare `hassio_api: true` in `config.yaml` if you need Supervisor API access.
- Declare `homeassistant_api: true` if you need to push state to HA entities.
- Always use `process.env.SUPERVISOR_TOKEN` (the injected token) for auth — never create a
  manual long-lived token for add-on-to-HA communication.
- Base URL for Supervisor API is `http://supervisor/` — not `localhost`, not the HA IP.
- For v1 display-only integration, consider using an iframe instead of sensor entities —
  it eliminates Supervisor API complexity entirely and matches the PROJECT.md constraint of
  "display-only, v1."

**Warning signs:**
- `config.yaml` missing `hassio_api` or `homeassistant_api` declaration.
- Hardcoded HA IP or port in backend code.
- Authentication using a manually created token stored in config.

**Phase to address:** HA integration phase.

---

### Pitfall M-7: HAOS Docker Constraints — No Privileged Access, No Host Networking by Default

**What goes wrong:** The developer assumes they can use standard Docker capabilities (host
networking, privileged mode, bind-mounting arbitrary paths) because "it's just Docker." On
HAOS, the Supervisor tightly controls what add-ons can do. Requesting capabilities your add-on
doesn't need is a security red flag and will block official community add-on submission. Even
for a private add-on, some capabilities require explicit declaration and user approval.

**Specific constraints:**
- No host networking by default — add-ons communicate via the internal `hassio` network.
- The `/data` path is the only reliable persistent path. `/share` and `/config` are available
  but are shared with other add-ons and HA itself.
- ARM vs x86 architecture: the NUC is x86_64 but if the add-on is ever run on a Pi, the image
  must declare supported architectures in `config.yaml`. Multi-arch Docker builds are required
  for wide compatibility.
- The base image must be one of the official HA base images OR a reasonably slim public image.
  Heavyweight images (e.g., full Ubuntu) work but are frowned upon and slow to update.

**Prevention:**
- Use the official HA base images (`ghcr.io/home-assistant/amd64-base-python`, etc.) or a
  minimal Alpine/Debian image. This ensures OS compatibility with HAOS update cycles.
- Declare only the minimum required ports and capabilities in `config.yaml`.
- Never hardcode architecture; use the `{arch}` template variable in `config.yaml` image field.
- For the NUC (amd64 only): `amd64: true` in `config.yaml` arch list is sufficient for v1.

**Warning signs:**
- `config.yaml` has `privileged: true` with no explanation.
- Image uses `FROM ubuntu:latest` with 20+ apt packages installed.
- `network_mode: host` in any docker-compose or config reference.

**Phase to address:** Add-on scaffolding phase.

---

## Minor Pitfalls

---

### Pitfall Mi-1: Reorder Threshold UX That Nobody Sets

**What goes wrong:** The app has a reorder threshold field per item, but it is a raw number
input with no default. Users never fill it in because it requires judgment upfront ("what IS
my threshold for olive oil?"). Without thresholds set, the shopping list is empty. The feature
appears broken.

**Prevention:**
- Provide smart defaults: if quantity mode is "count," default threshold to 1. If status mode,
  LOW triggers reorder automatically.
- Allow setting threshold to NULL / "not tracked" rather than requiring a value.
- Consider a bulk-set threshold screen ("set reorder for all Food items") as a quick setup tool.

**Phase to address:** Shopping list / alerts phase.

---

### Pitfall Mi-2: Shopping List That Doesn't Survive a Browser Refresh

**What goes wrong:** The shopping list is computed client-side as a derived view and not
persisted. User opens the shopping list in the store, then their phone locks and Safari
kills the tab. The list disappears. They have to go back home, re-open the app, and hope
they remember what was in the list.

**Prevention:**
- The shopping list should be server-side state: either a persisted derived view (refreshed on
  every item update) or a separate "shopping list" entity users can pin/complete items on.
- At minimum, the list must survive a page refresh.

**Phase to address:** Shopping list phase.

---

### Pitfall Mi-3: Friction in the Add/Update Flow Kills Engagement

**What goes wrong:** Adding a new item requires: scan barcode → confirm product name → select
category → select location → enter quantity → hit save. Five steps. Users do this twice and
then stop scanning. The app becomes a record of what was entered in the first week.

**Why it happens:** Completeness bias — "let's capture everything while we're here." Every
field seems justified individually.

**Prevention:**
- Minimize required fields: name and category are required; everything else is optional.
- Default location to last used location (users tend to scan items in one area at a time).
- Default category from Open Food Facts data when available.
- Default quantity to 1 for new items; default status to HAVE.
- The "scan to update quantity" flow (item already exists — just increment/decrement) must be
  a single tap after scan, not a form.
- Design the "update existing" path as the primary path — most scans are updates, not new items.

**Phase to address:** Barcode scanning UX phase. Conduct friction audit before shipping.

---

### Pitfall Mi-4: HA Long-Lived Access Tokens as a Substitute for Proper Auth

**What goes wrong:** Since the app runs inside HA, developers sometimes use HA's long-lived
access token mechanism to authenticate users to the inventory app itself. This creates coupling
to HA's auth system, requires users to generate and paste tokens, and breaks if HA auth
configuration changes.

**Prevention:**
- For v1 with 2-3 household members on a local network: no authentication is the right call.
  The app is on a private network inside HA — HA itself handles access control via the sidebar.
- If authentication is needed later, use a simple shared PIN or username/password per household
  member stored in the add-on's own config — do not couple to HA auth for an inventory app.

**Phase to address:** Not a v1 concern if local-only. Flag for v2 if external access is added.

---

### Pitfall Mi-5: QuaggaJS Is Unmaintained; Library Choice Matters

**What goes wrong:** PROJECT.md mentions QuaggaJS as a candidate. QuaggaJS (original, not
Quagga2) has not been actively maintained since ~2017. It has known issues with iOS Safari,
modern bundlers, and recent Chrome versions. Projects using it encounter unexplained scan
failures and no upstream fixes.

**Prevention:**
- Do not use the original `quagga` npm package.
- Evaluate: `@ericblade/quagga2` (community fork, actively maintained as of 2024),
  `html5-qrcode` (high-level wrapper, good iOS support, active), or `zxing-js/browser`
  (ZXing port, robust, lower-level).
- `html5-qrcode` is the lowest-friction option for a webapp with minimal scanner customization
  needs. `zxing-js/browser` is better if you need precise control over decode settings.
- Verify maintenance status (last commit, open issues) at selection time — this space moves.

**Warning signs:**
- `npm install quagga` (not quagga2).
- Library's last GitHub commit is >18 months ago.

**Phase to address:** Barcode scanning phase, library selection step.

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Add-on scaffolding | Data written outside `/data` | Map `/data:rw`, init DB there |
| Add-on scaffolding | Ingress breaks absolute paths | Use relative paths + `X-Ingress-Path` header |
| Add-on scaffolding | HAOS Docker constraints | Use HA base image, minimal capabilities |
| Data model | Flat integer quantity | Support count + status modes from day 1 |
| Data model | Free-text categories | Categories as FK'd entities, not strings |
| Data model | No audit trail | Add `updated_by` + `updated_at` from day 1 |
| Barcode scanning | HTTP blocks camera API | Use ingress (HTTPS) for mobile scanning |
| Barcode scanning | iOS Safari permission quirks | User-gesture gate + `playsinline` + test on device |
| Barcode scanning | QuaggaJS unmaintained | Use html5-qrcode or zxing-js/browser |
| Product lookup | OFF rate limiting + bad data | Proxy + cache + validate response fields |
| Shopping list | List lost on page refresh | Server-side persisted list |
| Shopping list | Thresholds never configured | Smart defaults + bulk-set UI |
| HA integration | Wrong token / URL for Supervisor | Use injected `SUPERVISOR_TOKEN`, `http://supervisor/` |
| Multi-user | Last-write-wins conflicts | Optimistic locking on `updated_at` |
| UX / adoption | Too many required fields on add | Minimize required fields, smart defaults |

---

## Sources

All findings from training data (cutoff Aug 2025). No live verification was possible in this
session due to tool access restrictions. Confidence levels:

- HA add-on `/data` persistence, ingress path, Supervisor token: HIGH (stable, well-documented)
- iOS Safari `getUserMedia` + `playsinline` requirements: HIGH (stable browser behavior)
- HTTPS required for `getUserMedia` on local IPs: HIGH (browser security spec, stable)
- Open Food Facts API structure and failure modes: MEDIUM (API behavior; verify current rate limits)
- QuaggaJS maintenance status: MEDIUM (accurate as of mid-2025; verify at selection time)
- Inventory data model pitfalls: MEDIUM (derived from community post-mortems and open-source projects)
- UX adoption patterns: MEDIUM (derived from Grocy, Pantry Tracker, and similar project discussions)

**Verify before implementing:**
- Current HA add-on config.yaml schema: https://developers.home-assistant.io/docs/add-ons/configuration
- Ingress documentation: https://developers.home-assistant.io/docs/add-ons/ingress
- Open Food Facts API v2 (newer than v0): https://openfoodfacts.github.io/openfoodfacts-server/api/
- html5-qrcode current status: https://github.com/mebjas/html5-qrcode
- zxing-js/browser: https://github.com/zxing-js/library
