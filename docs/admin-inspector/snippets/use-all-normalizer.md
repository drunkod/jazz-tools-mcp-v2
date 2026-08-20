# Full snippet — `useAll()` compatibility adapter

```ts
export interface NormalizedUseAllResult<T> {
  data: T[];
  isLoading: boolean;
  error: unknown;
}

const EMPTY_DATA: never[] = [];
const LEGACY_LOADING_RESULT: NormalizedUseAllResult<never> = {
  data: EMPTY_DATA,
  isLoading: true,
  error: null,
};

function unsupportedUseAllShape<T>(result: unknown): NormalizedUseAllResult<T> {
  const received =
    result !== null && typeof result === "object"
      ? `object with keys [${Object.keys(result).sort().join(", ")}]`
      : `${typeof result} (${String(result)})`;
  return {
    data: EMPTY_DATA,
    isLoading: false,
    error: new Error(
      `Unsupported useAll() result shape: expected undefined, an array, or structured state; received ${received}.`,
    ),
  };
}

export function normalizeUseAllResult<T>(result: unknown): NormalizedUseAllResult<T> {
  if (result === undefined) return LEGACY_LOADING_RESULT;

  if (Array.isArray(result)) {
    return { data: result as T[], isLoading: false, error: null };
  }

  if (typeof result !== "object" || result === null) {
    return unsupportedUseAllShape<T>(result);
  }

  const state = result as Record<string, unknown>;
  if (
    (state.data === undefined || Array.isArray(state.data)) &&
    typeof state.isLoading === "boolean" &&
    Object.prototype.hasOwnProperty.call(state, "error")
  ) {
    return {
      data: (state.data as T[] | undefined) ?? EMPTY_DATA,
      isLoading: state.isLoading,
      error: state.error,
    };
  }

  return unsupportedUseAllShape<T>(result);
}
```

The implementation's `unsupportedUseAllShape()` includes the received type/object keys in the error so version drift is diagnosable. `EMPTY_DATA` is module-stable to avoid retriggering row effects on every legacy loading render. Remove the adapter only after the minimum `jazz-tools` version no longer includes `2.0.0-alpha.53` and guarantees structured results.

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
expect(normalizeUseAllResult(undefined)).toEqual({ data: [], isLoading: true, error: null });
expect(normalizeUseAllResult([row])).toEqual({ data: [row], isLoading: false, error: null });
expect(normalizeUseAllResult({ data: [row], isLoading: false, error: null })).toEqual({
  data: [row],
  isLoading: false,
  error: null,
});
```
