# Task 03 — Navigation and Data Explorer ergonomics

Priority: P2
Dependency: Task 00

## Goal

Use WhoDB's useful database-console interaction priorities while keeping Jazz-native reads/writes.

## Subtasks

### T03.1 Runtime table navigation
- [x] Local case-insensitive table search.
- [x] Column counts.
- [x] Direct Data/Schema routes.
- [x] Selected-table state.
- [x] Recover when schema switch removes selected table.
- [ ] `/` shortcut focuses table search.

### T03.2 URL-addressable state
- [x] page/pageSize in search params.
- [x] sort in search params.
- [x] typed filters in search params.
- [ ] Copy-view-link action.
- [ ] Graceful malformed-filter fallback.

### T03.3 Relations
- [x] Useful display label.
- [x] Link to referenced table with row filter.
- [x] Encoded relation table route.
- [ ] Back/breadcrumb affordance after relation navigation.

### T03.4 Columns
- [x] Persist visibility/order.
- [x] Reconcile preferences after schema changes.
- [ ] Reset-to-schema-default action.

### T03.5 Dense shell
- [x] Database-first sidebar.
- [x] Compact breadcrumb/header.
- [ ] Narrow-width review.
- [ ] Keep data grid dominant over decorative chrome.

## Acceptance

A user can discover a table, inspect data/schema, follow relations, and share a filtered/sorted view without app-specific UI code.
