# ST-003 — Normalize `useAll()` result shapes

Parent: Task 01
Priority: P1
Status: open follow-up

## Problem

The extracted Inspector runs against a published Jazz alpha whose `useAll()` result can differ from current upstream. Compatibility branching is duplicated in the main grid and relation cell.

## Target contract

```ts
interface NormalizedUseAllResult<T> {
  data: T[];
  isLoading: boolean;
  error: unknown;
}
```

Supported inputs:

- `undefined` -> legacy first-load state;
- `T[]` -> legacy loaded state;
- `{ data, isLoading, error }` -> current structured state.

## Checklist

- [ ] add `src/utility/normalize-use-all-result.ts`;
- [ ] unit-test all three supported shapes;
- [ ] preserve explicit `isLoading: false` for empty structured data;
- [ ] preserve `error`;
- [ ] replace duplicated casts in `TableDataGrid`;
- [ ] replace duplicated casts in `RelationCell`;
- [ ] document removal condition tied to the pinned Jazz version.

## Acceptance

`TableDataGrid` consumes one stable query-state shape and contains no local legacy/current branching.
