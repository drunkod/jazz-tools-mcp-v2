import { describe, expect, it } from "vitest";
import { tableViewPath } from "./data-explorer-routes.js";

describe("tableViewPath", () => {
  it("encodes route-significant characters in runtime table names", () => {
    expect(tableViewPath("todos/archived #1", "schema")).toBe(
      "/data-explorer/todos%2Farchived%20%231/schema",
    );
  });

  it("encodes query, percent, and whitespace characters", () => {
    expect(tableViewPath("reports?100% ready", "data")).toBe(
      "/data-explorer/reports%3F100%25%20ready/data",
    );
  });

  it("builds ordinary data routes without changing table names", () => {
    expect(tableViewPath("todos", "data")).toBe("/data-explorer/todos/data");
  });
});
