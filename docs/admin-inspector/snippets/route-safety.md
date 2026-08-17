# Full snippet — runtime route safety

Prefer one helper for all Data Explorer paths:

```ts
export type TableView = "data" | "schema";

export function tablePath(tableName: string, view: TableView): string {
  return `/data-explorer/${encodeURIComponent(tableName)}/${view}`;
}
```

Use it everywhere:

```tsx
<Link to={tablePath(table, "data")}>Data</Link>
<Link to={tablePath(table, "schema")} aria-label="Schema">
  Schema
</Link>
```

Relations should encode the table segment and put the row ID into search params:

```ts
export function buildRelationFilterHref(table: string, relationId: string): string {
  const filters = JSON.stringify([
    { column: "id", operator: "eq", value: relationId },
  ]);
  const search = new URLSearchParams({ filters });
  return `/data-explorer/${encodeURIComponent(table)}/data?${search.toString()}`;
}
```

Regression tests:

```ts
import { describe, expect, it } from "vitest";

describe("tablePath", () => {
  it("encodes route-significant characters", () => {
    expect(tablePath("todos/archived #1", "schema")).toBe(
      "/data-explorer/todos%2Farchived%20%231/schema",
    );
  });
});
```

Grid toolbar regression:

```ts
it("URL-encodes the runtime table name in the schema toolbar link", () => {
  currentTable = "todos/archived #1";
  renderGrid();

  expect(screen.getByRole("link", { name: "Schema" }).getAttribute("href")).toBe(
    "/data-explorer/todos%2Farchived%20%231/schema",
  );
});
```
