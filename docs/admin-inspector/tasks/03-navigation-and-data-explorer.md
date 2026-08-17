# Task 03 — Navigation and Data Explorer ergonomics

Priority: P2
Dependency: Task 00
Status: complete

## Goal

Use WhoDB's useful database-console interaction priorities while keeping Jazz-native reads/writes.

## Subtasks

### T03.1 Runtime table navigation
- [x] Local case-insensitive table search.
- [x] Column counts.
- [x] Direct Data/Schema routes.
- [x] Selected-table state.
- [x] Recover when schema switch removes selected table.
- [x] `/` shortcut focuses table search without stealing input from editable targets.

### T03.2 URL-addressable state
- [x] page/pageSize in search params.
- [x] sort in search params.
- [x] typed filters in search params.
- [x] Copy-view-link action in standalone BrowserRouter mode (embedded MemoryRouter intentionally hides it because no restorable host URL exists).
- [x] Graceful malformed-filter fallback (the grid ignores malformed JSON; its regression test is owned with the grid workstream).

### T03.3 Relations
- [x] Useful display label.
- [x] Link to referenced table with row filter.
- [x] Encoded relation table route.
- [x] Browser-history back affordance after in-app relation navigation.

### T03.4 Columns
- [x] Persist visibility/order.
- [x] Reconcile preferences after schema changes.
- [x] Reset-to-schema-default action (schema order plus `hiddenByDefault` visibility).

### T03.5 Dense shell
- [x] Database-first sidebar.
- [x] Compact breadcrumb/header.
- [x] Narrow-width review.
- [x] Keep data grid dominant over decorative chrome.

## Acceptance

A user can discover a table, inspect data/schema, follow relations, and share a filtered/sorted view without app-specific UI code.

## Completion notes

- Route construction in the page/sidebar, schema back link, and relation navigation uses the shared `tableViewPath()` helper.
- The `/` shortcut is document-scoped but ignores input, textarea, select, and contenteditable targets.
- Copy view link lives in the database sidebar footer in standalone mode so it does not consume grid toolbar space; embedded mode hides it until the host supplies a deep-link contract.
- Relation links carry their source table in navigation state; the grid shows a compact source-aware browser-history back action after relation navigation.
- Malformed filter JSON falls back to an unfiltered query and has a grid regression.
- At widths up to 700px, the table navigator keeps a usable minimum width while secondary sidebar metadata collapses.
