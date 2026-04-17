# Phase 4: Shopping & Restock — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 04-shopping-restock
**Areas discussed:** Threshold setting, Shopping list UX, Restock scan mode, Alerts & list sharing

---

## Threshold Setting

| Option | Description | Selected |
|--------|-------------|----------|
| In ItemDrawer | Add threshold field to existing add/edit drawer | ✓ |
| Separate settings per item | Dedicated threshold editor, separate from item form | |
| Inline on inventory row | Set threshold directly from inventory list | |

**User's choice:** In ItemDrawer

---

| Option | Description | Selected |
|--------|-------------|----------|
| Default = 1 | Alert when quantity hits 1 or below | |
| Default = 0 (out of stock only) | Only appears on list when truly empty | ✓ |
| No default (blank/optional) | Field starts empty; threshold optional | |

**User's choice:** Default = 0 — items only auto-appear on the shopping list when quantity reaches 0 or status is "out"

---

## Shopping List UX

| Option | Description | Selected |
|--------|-------------|----------|
| Simple flat list | Single scrollable list, no grouping | ✓ |
| Grouped by category | Same grouping as inventory page | |
| Grouped by location | Grouped by storage location | |

**User's choice:** Simple flat list — **with drag-and-drop reordering** (user clarified this via free text: "i want a simple list but the order should be changeable via drag and drop")

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tap checkbox → auto-restock to threshold | One-tap, no confirmation | |
| Tap checkbox → prompt for actual quantity | Small quantity picker per item | ✓ |
| Swipe to check off | Swipe right gesture | |

**User's choice:** Prompt for actual quantity — user may have bought different amounts than the threshold

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + current quantity | "Milk — 0 left" | ✓ |
| Name + quantity + category | Adds category label | |
| Name only | Cleanest, no extra info | |

**User's choice:** Name + current quantity

---

## Restock Scan Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Button on shopping list page | "Start restocking" contextual entry | ✓ |
| Dedicated nav tab / icon | Always accessible from nav | |
| ScanFAB mode toggle | Long-press or toggle on existing FAB | |

**User's choice:** Button on the shopping list page

---

| Option | Description | Selected |
|--------|-------------|----------|
| QuickUpdateSheet with quantity prompt | Reuses Phase 3 component | ✓ |
| Inline confirmation toast | Small overlay, +1 button | |
| Full ItemDrawer | Full edit drawer, pre-filled | |

**User's choice:** QuickUpdateSheet with quantity prompt

---

| Option | Description | Selected |
|--------|-------------|----------|
| "Item not found" toast, stay in restock mode | Brief error, camera re-opens | ✓ |
| Open ItemDrawer to add item | Falls through to add-item flow | |
| Ignore silently, re-open camera | No feedback | |

**User's choice:** "Item not found" toast, stay in restock mode

---

## Alerts & List Sharing

| Option | Description | Selected |
|--------|-------------|----------|
| Badge on Shopping List nav item | Count badge, persistent and glanceable | ✓ |
| Toast notification on inventory page | Dismissible banner on threshold breach | |
| Dedicated alerts section | Separate screen / notification bell | |

**User's choice:** Badge on Shopping List nav item

---

| Option | Description | Selected |
|--------|-------------|----------|
| Web Share API with clipboard fallback | Native share sheet on mobile, clipboard on desktop | ✓ |
| Copy to clipboard only | Simpler, no share sheet | |
| Download as .txt file | File download | |

**User's choice:** Web Share API with clipboard fallback — user also expressed interest in sharing to a specific household "Notizen" note on Android (handled naturally by Web Share API's share sheet)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple checklist | "• Milk (0 left)" with "Einkaufsliste" header | ✓ |
| Name only, one per line | Just names | |
| Grouped by category | Category headers + items | |

**User's choice:** Simple checklist format

---

## Claude's Discretion

- Drag-and-drop library choice
- Exact placement of "Start restocking" button
- Quantity prompt UI detail (inline vs bottom sheet)
- Toast component for "Item not found" and "Copied!"

## Deferred Ideas

- **Google Nest / Google Assistant voice integration** — "Bitte X zur Einkaufsliste hinzufügen" — user explicitly requested this; deferred as its own phase after Phase 6
- **Push notifications** to household members' phones
