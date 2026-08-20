import { describe, expect, it } from "vitest";
import { normalizeUseAllResult } from "./normalize-use-all-result.js";

describe("normalizeUseAllResult", () => {
  it("normalizes the published-alpha undefined first-load result with stable empty data", () => {
    const first = normalizeUseAllResult<{ id: string }>(undefined);
    const second = normalizeUseAllResult<{ id: string }>(undefined);

    expect(first).toEqual({ data: [], isLoading: true, error: null });
    expect(second.data).toBe(first.data);
  });

  it("normalizes a published-alpha row array as loaded data", () => {
    const rows = [{ id: "row-1" }];

    expect(normalizeUseAllResult(rows)).toEqual({
      data: rows,
      isLoading: false,
      error: null,
    });
  });

  it("preserves structured empty, loading, and error state", () => {
    const error = new Error("query failed");
    const result = normalizeUseAllResult({ data: [], isLoading: false, error });

    expect(result.data).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBe(error);
  });

  it("uses the stable empty data reference for structured first-load state", () => {
    const first = normalizeUseAllResult({ data: undefined, isLoading: true, error: null });
    const second = normalizeUseAllResult({ data: undefined, isLoading: true, error: null });

    expect(second.data).toBe(first.data);
  });

  it.each([null, true, 42, "rows"]) (
    "returns an explicit diagnostic for impossible primitive shape %j",
    (value) => {
      const result = normalizeUseAllResult(value);

      expect(result).toMatchObject({ data: [], isLoading: false });
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toContain("Unsupported useAll() result shape");
      expect((result.error as Error).message).toContain(typeof value === "object" ? "null" : typeof value);
    },
  );

  it("diagnoses malformed structured objects", () => {
    const result = normalizeUseAllResult({ data: "not rows", isLoading: false, error: null });

    expect((result.error as Error).message).toContain("object with keys [data, error, isLoading]");
  });
});
