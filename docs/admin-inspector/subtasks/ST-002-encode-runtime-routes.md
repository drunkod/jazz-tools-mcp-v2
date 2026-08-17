# ST-002 — Encode all runtime table routes

Parent: Task 00
Priority: P1
Status: complete

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

Regression tests cover `/`, space, `#`, `?`, `%`, and ordinary table names. Component regressions use the combined runtime name `todos/archived #1` for sidebar, schema-back, relation, and grid-toolbar paths. Browser coverage opens the deployed runtime table `reports/ready ?#%` through its encoded route.

Sidebar data/schema links, relation navigation, the schema back-to-data link, and the stale-table redirect now all call the shared helper rather than duplicating path interpolation or encoding.

## Grid toolbar producer

The final raw producer now uses the shared helper:

```tsx
<Link to={tableViewPath(table, "schema")} aria-label="Schema">
```

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
- [x] use `tableViewPath()` in every non-grid runtime route producer;
- [x] add component regressions for the sidebar, schema-back, and relation producers;
- [x] re-audit all route producers;
- [x] patch the grid toolbar Schema link;
- [x] use the shared helper in that grid link;
- [x] add a component regression for the Schema toolbar href;
- [x] re-search every `data-explorer/${...}` producer after the grid patch;
- [x] add browser coverage with a route-significant runtime table name.

## Acceptance

Complete: runtime table path construction is centralized, component regressions cover every producer, and browser E2E verifies an encoded route-significant runtime table.
