---
status: partial
phase: 04-shopping-restock
source: [04-VERIFICATION.md]
started: 2026-04-19T12:00:00Z
updated: 2026-04-19T12:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Nav badge satisfies in-app alert intent (SHOP-04)
expected: The badge count on the Shopping List nav item updates reactively when stock drops below threshold. D-16 explicitly defines a persistent count badge as the accepted form; human must confirm this matches product intent for SC-4.
result: [pending]

### 2. CheckOffSheet increment semantics match product intent (SHOP-03)
expected: Tapping checkbox opens CheckOffSheet with stepper (default 1). Entering N and tapping 'Add to stock' increments item.quantity by N; if new_quantity >= threshold the entry is removed. Human must confirm increment-by-N (D-07/D-08) satisfies "restocked to its threshold" in SC-3.
result: [pending]

### 3. Restock scan loop end-to-end on device (RSTO-01, RSTO-02, RSTO-03)
expected: Tap 'Start restocking', scan a barcode matching an inventory item, enter quantity in RestockQuickSheet, tap 'Add to stock' — item quantity updates, entry disappears from shopping list, camera re-opens. Scanning unknown barcode shows 'Item not found' toast then camera re-opens. 'Done restocking' exits.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
