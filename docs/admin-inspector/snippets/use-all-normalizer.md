# Full snippet — `useAll()` compatibility adapter

```ts
export interface NormalizedUseAllResult<T> {
  data: T[];
  isLoading: boolean;
  error: unknown;
}

interface QueryStateLike<T> {
  data?: T[];
  isLoading?: boolean;
  error?: unknown;
}

export function normalizeUseAllResult<T>(result: unknown): NormalizedUseAllResult<T> {
  if (Array.isArray(result)) {
    return { data: result as T[], isLoading: false, error: undefined };
  }

  if (result === undefined) {
    return { data: [], isLoading: true, error: undefined };
  }

  if (result === null || typeof result !== "object") {
    return {
      data: [],
      isLoading: false,
      error: new TypeError("Unexpected useAll() result shape."),
    };
  }

  const state = result as QueryStateLike<T>;
  return {
    data: Array.isArray(state.data) ? state.data : [],
    isLoading: state.isLoading ?? state.data === undefined,
    error: state.error,
  };
}
```

Main grid integration:

```ts
const queryResult = useAll<DynamicTableRow>(queryBuilder, queryOptions);
const { data: rows, isLoading: isInitialLoading, error: queryError } =
  normalizeUseAllResult<DynamicTableRow>(queryResult);
```

Relation integration:

```ts
const relationQueryResult = useAll<DynamicTableRow>(queryBuilder, queryOptions);
const { data: relationRows } = normalizeUseAllResult<DynamicTableRow>(relationQueryResult);
const relationRow = relationRows[0];
```

Minimum tests:

```ts
expect(normalizeUseAllResult(undefined)).toEqual({ data: [], isLoading: true, error: undefined });
expect(normalizeUseAllResult([row])).toEqual({ data: [row], isLoading: false, error: undefined });
expect(normalizeUseAllResult({ data: [row], isLoading: false, error: null })).toEqual({
  data: [row],
  isLoading: false,
  error: null,
});
```
