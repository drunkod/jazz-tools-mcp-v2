import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ProductionApp, {
  LEGACY_DIRECT_CONNECTION_STORAGE_KEYS,
  removeLegacyDirectConnectionState,
} from "./ProductionApp";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("ProductionApp", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("removes legacy direct credentials and the URL fragment with history replacement", () => {
    const [connectionStorageKey] = LEGACY_DIRECT_CONNECTION_STORAGE_KEYS;
    window.localStorage.setItem(
      connectionStorageKey,
      JSON.stringify({ adminSecret: "do-not-retain" }),
    );
    window.localStorage.setItem("unrelated-preference", "keep");
    window.history.replaceState(
      { sensitive: true },
      "",
      "/inspector?view=unavailable#adminSecret=do-not-retain&appId=app-id",
    );

    removeLegacyDirectConnectionState();

    expect(window.localStorage.getItem(connectionStorageKey)).toBeNull();
    expect(window.localStorage.getItem("unrelated-preference")).toBe("keep");
    expect(window.location.pathname).toBe("/inspector");
    expect(window.location.search).toBe("?view=unavailable");
    expect(window.location.hash).toBe("");
    expect(window.history.state).toBeNull();
  });

  it("renders only the fail-closed BFF-required state", () => {
    render(<ProductionApp />);

    expect(
      screen.getByRole("heading", { name: "Inspector unavailable in production" }),
    ).not.toBeNull();
    expect(screen.getByText("A trusted backend-for-frontend (BFF) is required.")).not.toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
