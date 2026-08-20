import { describe, expect, it } from "vitest";
import { buildRelationFilterHref } from "./relation-navigation.js";

describe("buildRelationFilterHref", () => {
  it("encodes table names as URL path segments without changing the relation id", () => {
    const href = buildRelationFilterHref("todos/archived #1", "row/id with spaces");
    const [pathname, queryString] = href.split("?");

    expect(pathname).toBe("/data-explorer/todos%2Farchived%20%231/data");

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
