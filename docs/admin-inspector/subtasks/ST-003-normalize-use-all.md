# ST-003 — Normalize `useAll()` result shapes

Parent: Task 01
Priority: P1
Status: complete

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

- [x] add `src/utility/normalize-use-all-result.ts`;
- [x] unit-test all three supported shapes;
- [x] preserve explicit `isLoading: false` for empty structured data;
- [x] preserve `error`;
- [x] replace duplicated casts in `TableDataGrid`;
- [x] replace duplicated casts in `RelationCell`;
- [x] document removal condition tied to the pinned Jazz version.

Removal condition: delete the adapter after the Inspector no longer supports the pinned `jazz-tools@2.0.0-alpha.53` array/`undefined` contract and its minimum Jazz version guarantees structured `{data,isLoading,error}` results.

## Acceptance

`TableDataGrid` consumes one stable query-state shape and contains no local legacy/current branching.
