import { describe, expect, it } from "vitest";
import { buildRelationFilterHref } from "./relation-navigation.js";

describe("buildRelationFilterHref", () => {
  it("encodes table names as URL path segments without changing the relation id", () => {
    const href = buildRelationFilterHref("audit events/2026", "row/id with spaces");
    const [pathname, queryString] = href.split("?");

    expect(pathname).toBe("/data-explorer/audit%20events%2F2026/data");

    const params = new URLSearchParams(queryString);
    const filters = JSON.parse(params.get("filters") ?? "[]") as Array<{
      column: string;
      operator: string;
      value: string;
    }>;

    expect(filters).toEqual([
      expect.objectContaining({
        column: "id",
        operator: "eq",
        value: "row/id with spaces",
      }),
    ]);
  });
});
