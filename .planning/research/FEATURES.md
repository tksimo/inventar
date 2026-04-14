# Feature Landscape: Home Inventory / Pantry Tracker

**Domain:** Home inventory webapp (food, cleaning, personal care)
**Researched:** 2026-04-14
**Confidence note:** Web access unavailable; findings are from training knowledge of Grocy, Out of Milk, Pantry Check, Bring!, OurGroceries, and community discussions (Reddit r/selfhosted, r/homeautomation) up to August 2025. Confidence levels reflect this.

---

## Table Stakes

Features users expect in any inventory or pantry app. Missing = product feels broken or pointless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Add item with name + quantity | Core verb of the product | Low | Without this there's no app |
| Assign a category to items | Users mentally group by type; browsing without categories is chaos | Low | Food, fridge, cleaning, personal care — plus custom |
| View current inventory list | The entire point of tracking | Low | Must be fast and filterable |
| Edit / update quantity in-place | Stock levels change constantly; friction here = abandonment | Low | Tapping to decrement or set exact count |
| Mark item as "out" or "running low" | Simpler than exact counts; matches how people think | Low | Fuzzy status (have / low / out) alongside exact counts |
| Delete / remove an item | Items get discontinued, replaced, or removed from household | Low | |
| Shopping list generation | The #1 user-stated goal: "know what to buy" | Low-Med | Auto-populate from items flagged low/out |
| Add item to shopping list manually | Not everything needs tracking; people want a hybrid list | Low | One-tap "add this to shop" |
| Mark shopping list items as bought | Close the loop after shopping | Low | Should update inventory quantity when marked bought |
| Barcode scan to identify items | Eliminates typing; critical for fast data entry | Med | Open Food Facts lookup covers most packaged goods; manual fallback required |
| Share inventory across household members | 2-3 people — if only one person can update, app fails | Med | Real-time sync; last-write-wins is fine at this scale |
| Reorder threshold per item | Answers "when should I buy more?" | Low | Users set min quantity; app flags when below |
| Storage location per item | "Where is it?" is the other half of inventory value | Low | Free-text or pick from list; this project explicitly needs it |
| Search / filter inventory | At 50+ items, browsing a flat list is unusable | Low | Filter by category, location, status |
| Mobile-friendly interface | Barcode scanning happens on phones at the pantry shelf | Med | Not a native app, but must feel usable on a phone screen |

**Confidence:** HIGH — these are universal across every app in the category.

---

## Differentiators

Features that existing apps do poorly, or that make this app distinctly valuable for the HA household context. Not expected, but valued when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Storage location with visual/hierarchical layout | Grocy has locations but as a flat list; hierarchical ("Kitchen > Top shelf > Left side") helps newcomers find items | Med | Even two levels (room > spot) beats a flat list |
| Quick-add from shopping list after buying | Scan barcode at store OR tap "bought" and auto-increment stock at home | Med | Reduces the re-entry step that causes abandonment |
| HA sensor entities per item/category | Power users want "show fridge stock on HA dashboard" or automations like "notify when milk is low" | Med-High | v1 display-only; v2 could expose MQTT or REST entities |
| Smart reorder suggestions | "You always buy milk every 2 weeks" — suggest adding it to list before it runs out, based on consumption history | High | Requires consumption tracking; probably v3+ |
| Consumption rate tracking | Track how fast you go through items to predict reorder timing | Med | Passive: compute from "added X on date, ran out on date" |
| One-tap "I just bought this" UX | Speed of update is the #1 friction point — make it a single action from the shopping list | Low | Differentiator is in UX, not feature complexity |
| Bulk stock-up mode | "Just got back from Costco" — add many items quickly without going through full add flow per item | Med | Scan barcode, enter quantity, next — no category/location required if item already exists |
| Product database enrichment via Open Food Facts | Auto-fill name, category, image from barcode — reduces manual typing to near zero for known products | Med | OFFs API is free and well-maintained; covers EU/US packaged goods well |
| "Last purchased" date visibility | At a glance, see if something has been sitting untouched for 6 months | Low | Passive, derived from purchase history |
| Item image / photo | Visual identification is faster than reading names, especially for household members who didn't add the item | Low-Med | OFFs provides images for food; upload for others |

**Confidence:** MEDIUM — based on community complaints ("Grocy is powerful but complex", "Out of Milk is simple but can't track location") and feature gap patterns across the category.

---

## Anti-Features

Features to deliberately NOT build, because they add friction, scope-creep, or solve a different problem.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Recipe management / meal planning | Different problem space; Grocy has this and users call it confusing overhead for those who just want inventory | Stay focused: inventory + shopping list only |
| Nutritional tracking / calorie counting | Requires accurate serving data, weight, per-portion breakdowns; builds toward a fitness app not an inventory app | Expose barcode data passively (OFFs has nutrition); don't surface it in UI |
| Expiry date tracking | Adds a required field that most users skip; creates an ever-growing overdue list that guilt-trips rather than helps | PROJECT.md already scoped this out; validate before adding |
| Full multi-tenant auth (accounts, permissions, roles) | Household scale doesn't need it; adds login friction for every family member | Single shared household — no login required or a simple PIN/name picker |
| Native iOS/Android app | PWA + phone browser is sufficient; native apps double maintenance burden | Invest in good responsive web UX instead |
| Nutritional goals / meal budgeting | Scope creep toward a different product | |
| Price tracking / cost analysis | Interesting but requires receipt scanning or manual price entry; adds significant data burden | |
| Multi-store shopping list routing | "Assign items to Costco vs Lidl" — useful in theory, rarely maintained in practice | Single shopping list; let user sort manually if needed |
| Automated restock ordering (Amazon Dash-style) | Smart home integration temptation; significant security/privacy surface; most users don't want auto-purchasing | Keep HA integration read-only; automation is the user's responsibility |
| Gamification / streaks / achievements | Home inventory is a utility, not a habit app; gamification feels condescending for adults managing household | |
| Social features (share lists with friends, recipe sharing) | Not a social product; adds auth complexity for no household benefit | |
| Barcode generation / label printing | Nice-to-have for custom items but adds UI complexity; defer unless requested | |
| Complex reporting / analytics dashboards | "Spending by category over time" requires price data; waste reports require expiry data — both out of scope | |

**Confidence:** HIGH for most — these are the features where user reviews consistently say "I don't use it" or "it got too complicated."

---

## Feature Dependencies

```
Barcode scan → Product DB lookup (OFFs) → Item name/category auto-fill
                                        → Image auto-fill

Storage location → Location list management → Location assignment per item

Reorder threshold → Inventory quantity tracking → Auto-flag below threshold
                                               → Shopping list auto-population

Shopping list → "Mark as bought" action → Inventory quantity update

Multi-user sync → Shared data store (no per-user isolation) → Last-write-wins conflict resolution
```

---

## What Grocy Does That Informs This Project

Grocy (HIGH confidence — well-documented open-source project) covers:

- Stock management with exact quantities, best-before dates, purchase price
- Multiple locations per product (e.g. item can be in fridge and pantry simultaneously)
- Shopping lists with store assignment
- Recipe management and meal planning
- Chores / task tracking
- Equipment / asset tracking
- REST API

**What Grocy gets right:** Comprehensive data model, barcode scanning, locations, shopping lists, REST API.

**What Grocy gets wrong (community consensus):**
- Overwhelmingly complex for casual household use — the UI assumes a power user who reads documentation
- Onboarding is a wall: you must define locations, quantity units, product groups before adding a single item
- Mobile experience is functional but not optimized for quick scan-and-update
- Expiry date pressure: the system nudges you to fill it even when irrelevant
- Chores/recipes/equipment clutter the nav for users who only want inventory

**Lesson for Inventar:** Match Grocy's data model depth (locations, thresholds, categories) but invert the UX approach — assume zero setup, progressive complexity, immediate value from first scan.

---

## What Out of Milk / Bring! / OurGroceries Do

These are shopping-list-first apps (MEDIUM confidence):

- Out of Milk: Strong shopping list UX, pantry tracking as secondary feature, cloud-dependent
- Bring!: Beautiful UI, collaboration, no location tracking, no reorder thresholds
- OurGroceries: Household sharing focus, simple, no barcode scanning on free tier

**Gap these apps leave:** None track storage locations. None run locally. None integrate with home automation. This is Inventar's clear white space.

---

## MVP Recommendation

Prioritize these for v1 (already reflected in PROJECT.md active requirements, included here for feature research context):

1. Add item (barcode scan + manual) — fast, zero-friction
2. Quantity tracking (exact count + fuzzy status)
3. Storage location assignment
4. Category organization (Food, Fridge, Cleaning, Personal Care + custom)
5. Reorder threshold + auto-flag
6. Shopping list (auto-populated + manual add)
7. Multi-user shared state (no auth, shared household)
8. HA display integration (read-only)

Defer for v2+:
- Consumption rate / smart reorder timing
- Hierarchical location display
- Bulk stock-up mode
- HA entity sensors per item (bidirectional)
- Product images from OFFs

Explicitly decline unless user-validated:
- Expiry date tracking
- Recipe / meal planning
- Nutritional data display
- Price tracking

---

## Sources

- Training knowledge of Grocy (github.com/grocy/grocy), confirmed feature-complete as of ~2024
- Community discussions: r/selfhosted, r/homeautomation, r/Grocy (up to training cutoff August 2025)
- App Store reviews and feature comparisons for Out of Milk, Bring!, OurGroceries, Pantry Check
- Note: No live web access was available during this research session. Confidence is based on training data only. Recommend spot-checking Grocy's current feature list and recent r/Grocy complaints before finalizing phase scope.
