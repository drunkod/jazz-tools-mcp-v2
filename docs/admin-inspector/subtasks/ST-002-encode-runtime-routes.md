# ST-002 — Encode all runtime table routes

Parent: Task 00
Priority: P1
Status: partially implemented; grid toolbar follow-up remains

## Problem

Runtime table names are data, not URL syntax. Table names can contain characters such as `/`, `#`, spaces, `?`, or `%`; every route producer must encode the runtime table segment before inserting it into a path.

## Implemented

A shared helper now owns Data Explorer path construction:

```ts
export type TableView = "data" | "schema";

export function tableViewPath(tableName: string, view: TableView): string {
  return `/data-explorer/${encodeURIComponent(tableName)}/${view}`;
}
```

`Live Query -> Data Explorer` now uses:

```ts
const base = tableViewPath(table, "data");
```

Regression tests cover `/`, space, `#`, `?`, `%`, and ordinary table names.

Sidebar data/schema links, relation navigation, and the stale-table redirect were already encoded before this subtask.

## Remaining raw producer

### Data grid toolbar Schema link

```tsx
// current
<Link to={`/data-explorer/${table}/schema`} aria-label="Schema">

// required
<Link to={tableViewPath(table, "schema")} aria-label="Schema">
```

This file is large and also contains the separate alpha/current `useAll()` compatibility cleanup. Keep the remaining grid change in one focused full-file patch with ST-003 so the compatibility and route imports/tests can be reviewed together.

## Regression case

Use a runtime table name containing slash, space, and hash:

```text
todos/archived #1
```

Expected paths:

```text
/data-explorer/todos%2Farchived%20%231/data
/data-explorer/todos%2Farchived%20%231/schema
```

Filter/query values stay in `URLSearchParams`, not the path.

## Checklist

- [x] add centralized `tableViewPath()` helper;
- [x] patch Live Query `buildExplorerUrl()`;
- [x] add helper unit coverage for route-significant characters;
- [x] keep relation IDs/filter JSON in `URLSearchParams`;
- [ ] patch the grid toolbar Schema link;
- [ ] use the shared helper in that grid link;
- [ ] add a component regression for the Schema toolbar href;
- [ ] re-search every `data-explorer/${...}` producer after the grid patch;
- [ ] add browser coverage if the dynamic test schema can expose such a table safely.

## Acceptance

Complete when no runtime table string can accidentally create a new path segment, query string, fragment, or malformed navigation target. The Live Query path is fixed; the grid toolbar path remains explicit follow-up work.
