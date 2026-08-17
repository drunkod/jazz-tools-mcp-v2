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

function describeResultShape(result: unknown): string {
  if (result === null) return "null";
  if (Array.isArray(result)) return "array";
  if (typeof result !== "object") return `${typeof result} (${String(result)})`;

  const keys = Object.keys(result).sort();
  return `object with keys [${keys.join(", ")}]`;
}

function impossibleShapeResult<T>(result: unknown): NormalizedUseAllResult<T> {
  return {
    data: EMPTY_DATA,
    isLoading: false,
    error: new Error(
      `Unsupported useAll() result shape: expected undefined, an array, or ` +
        `{ data: T[] | undefined, isLoading: boolean, error: unknown }; received ${describeResultShape(result)}.`,
    ),
  };
}

/**
 * Bridges jazz-tools 2.0.0-alpha.53's published `useAll()` array/undefined
 * result with the structured result used by current upstream Jazz.
 *
 * Remove this adapter once the Inspector's minimum jazz-tools version guarantees
 * the structured `{ data, isLoading, error }` contract and alpha.53 compatibility
 * is no longer supported.
 */
export function normalizeUseAllResult<T>(result: unknown): NormalizedUseAllResult<T> {
  if (result === undefined) {
    return LEGACY_LOADING_RESULT;
  }

  if (Array.isArray(result)) {
    return {
      data: result as T[],
      isLoading: false,
      error: null,
    };
  }

  if (typeof result !== "object" || result === null) {
    return impossibleShapeResult<T>(result);
  }

  const structuredResult = result as Record<string, unknown>;
  if (
    (structuredResult.data === undefined || Array.isArray(structuredResult.data)) &&
    typeof structuredResult.isLoading === "boolean" &&
    Object.prototype.hasOwnProperty.call(structuredResult, "error")
  ) {
    return {
      data: (structuredResult.data as T[] | undefined) ?? EMPTY_DATA,
      isLoading: structuredResult.isLoading,
      error: structuredResult.error,
    };
  }

  return impossibleShapeResult<T>(result);
}
