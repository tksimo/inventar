---
status: diagnosed
phase: 05-recipes
source: [05-VERIFICATION.md]
started: 2026-04-20T00:00:00Z
updated: 2026-04-20T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Check sheet visual rendering
expected: Status icon colors (green/amber/red CSS tokens) display correctly for have/low/missing ingredients; unit-mismatch note appears below ingredient name; slide-up animation triggers when sheet opens
result: pass

### 2. URL import with real HTTP
expected: Pasting a real recipe URL (e.g. a structured recipe site) extracts name and ingredient list; pasting a non-recipe URL shows fallback toast and opens blank RecipeForm
result: pass

### 3. Cook end-to-end flow
expected: After tapping Cook & deduct with quantities set, inventory quantities decrease by the deducted amounts in the main inventory view; cook transaction appears in any audit trail; sheet closes and RecipeDetail refreshes
result: issue
reported: "inventar wurde nicht upgedated"
severity: major

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After Cook & deduct, inventory quantities decrease by the deducted amounts"
  status: failed
  reason: "User reported: inventar wurde nicht upgedated"
  severity: major
  test: 3
  artifacts: []
  missing: []
