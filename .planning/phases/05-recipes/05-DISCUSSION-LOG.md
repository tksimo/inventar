# Phase 5: Recipes — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 05-recipes
**Areas discussed:** Ingredient model, URL import, Inventory matching, Cook & deduct (RECP-05)

---

## Ingredient model

| Option | Description | Selected |
|--------|-------------|----------|
| Free text | Each ingredient is one string (e.g. "250g Mehl") | |
| Structured (name + qty + unit), no links | Separate fields, no FK to inventory | |
| Structured + optional item_id link | Name + qty + unit + optional FK to items table | ✓ |
| Fully linked at creation | Every ingredient must link to an inventory item | |

**User's choice:** Structured + optional item_id link  
**Notes:** Best balance of flexibility and precision. Unlinked ingredients are allowed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-suggest at create time | App searches inventory and offers quick link when adding each ingredient | ✓ |
| Only at check-time | Ingredients created unlinked; matching happens at RECP-03 check | |
| You decide | Claude picks approach | |

**User's choice:** Auto-suggest at create time  
**Notes:** Reduces friction at check/cook time by resolving links early.

---

## URL import

| Option | Description | Selected |
|--------|-------------|----------|
| JSON-LD / Schema.org | Parse structured Recipe data embedded in page | ✓ |
| HTML scraping with heuristics | Parse headings, lists, recipe patterns | |
| AI/LLM parsing | Pass page content to LLM | |
| You decide | Claude picks approach | |

**User's choice:** JSON-LD / Schema.org  
**Notes:** Most reliable, no maintenance overhead, widely supported by recipe sites.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show error + fallback to manual entry | Toast error, pre-fill name from page title, user completes manually | ✓ |
| Show error only, no fallback | User retries or starts from scratch | |
| Allow user to paste raw text | Text-paste field for manual extraction | |

**User's choice:** Show error + fallback to manual entry  
**Notes:** Graceful degradation keeps the import flow useful even when parsing fails.

---

## Inventory matching

| Option | Description | Selected |
|--------|-------------|----------|
| Name substring match | Ingredient name appears anywhere in inventory item name (case-insensitive) | ✓ |
| Exact name match only | Must exactly match | |
| User manually links at check time | Unlinked shown as "unknown", user picks from list | |

**User's choice:** Name substring match  
**Notes:** Handles German compound words (e.g. "Weizenmehl" matches "Mehl") without extra effort.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Ingredient list with status icons | Per-ingredient ✅/⚠️/❌ icons with quantity comparison | ✓ |
| Split into two groups | "Available" and "Missing or low" sections | |
| Summary only | Count summary + add-missing button | |

**User's choice:** Ingredient list with status icons  
**Notes:** Most informative — user sees exactly which ingredients are fine vs. problematic.

---

## Cook & deduct (RECP-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Deduct 1 unit regardless | Always subtract 1 for count items, step down status items | |
| Ask user what to deduct per ingredient | Confirmation sheet with pre-filled quantities, user adjusts | ✓ |
| Skip mismatched units | Only deduct where units clearly match | |

**User's choice:** Ask user what to deduct per ingredient  
**Notes:** User wants control over deductions given unit mismatch reality in a household context.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show greyed-out / skipped | Unmatched ingredients appear dimmed with "not in inventory — skipped" | ✓ |
| Hide them | Only matched ingredients shown | |
| You decide | Claude picks | |

**User's choice:** Show greyed-out / skipped  
**Notes:** Full transparency — user sees the whole recipe in the confirmation sheet.

---

## Claude's Discretion

- Drag order of ingredients in recipe form
- Exact placement of action buttons on recipe detail screen
- Empty state for recipe list
- Toast reuse for import errors
- Wording for unit-mismatch notes

## Deferred Ideas

- AI/OCR photo import (RECP-06) — v2
- Dietary tags / filtering (RECP-07) — v2
- Recipe sharing / export — not in scope
