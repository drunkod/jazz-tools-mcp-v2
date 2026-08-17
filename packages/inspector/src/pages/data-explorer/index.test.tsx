import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { DataExplorer } from "./index";

const mockSetQueryPropagation = vi.fn();
const mockUseDevtoolsContext = vi.fn();

vi.mock("../../contexts/devtools-context.js", () => ({
  useDevtoolsContext: () => mockUseDevtoolsContext(),
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

describe("DataExplorer", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockSetQueryPropagation.mockReset();
    mockUseDevtoolsContext.mockReset();
    mockUseDevtoolsContext.mockReturnValue({
      wasmSchema: {
        todos: { columns: [{ name: "title" }, { name: "done" }] },
        users: { columns: [{ name: "name" }] },
      },
      runtime: "extension",
      queryPropagation: "local-only",
      setQueryPropagation: mockSetQueryPropagation,
    });
  });

  it("renders a resizable table list panel", () => {
    render(
      <MemoryRouter initialEntries={["/data-explorer/todos/data"]}>
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<div>table content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(screen.getByText("table content")).not.toBeNull();
    expect(screen.getByText("2 tables")).not.toBeNull();
    expect(screen.getByLabelText("View todos data")).not.toBeNull();
    expect(screen.getByLabelText("View todos schema")).not.toBeNull();
    expect(screen.getByText("Reactive table data")).not.toBeNull();
    expect(screen.queryByText(/^active$/i)).toBeNull();
  });

  it("filters the database table navigator by name", () => {
    render(
      <MemoryRouter initialEntries={["/data-explorer/todos/data"]}>
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<div>table content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Search tables"), {
      target: { value: "users" },
    });

    expect(screen.getByLabelText("View users data")).not.toBeNull();
    expect(screen.queryByLabelText("View todos data")).toBeNull();

    fireEvent.click(screen.getByLabelText("Clear table search"));

    expect(screen.getByLabelText("View todos data")).not.toBeNull();
    expect(screen.getByLabelText("View users data")).not.toBeNull();
  });

  it("encodes runtime table names when building data and schema links", () => {
    mockUseDevtoolsContext.mockReturnValue({
      wasmSchema: {
        "audit events/2026": { columns: [{ name: "message" }] },
      },
      runtime: "extension",
      queryPropagation: "local-only",
      setQueryPropagation: mockSetQueryPropagation,
    });

    render(
      <MemoryRouter initialEntries={["/data-explorer/audit%20events%2F2026/data"]}>
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<div>table content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("View audit events/2026 data").getAttribute("href")).toBe(
      "/data-explorer/audit%20events%2F2026/data",
    );
    expect(screen.getByLabelText("View audit events/2026 schema").getAttribute("href")).toBe(
      "/data-explorer/audit%20events%2F2026/schema",
    );
  });

  it("redirects to the first valid table when the selected table is absent", async () => {
    render(
      <MemoryRouter initialEntries={["/data-explorer/removed-table/data"]}>
        <LocationProbe />
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<div>table content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Current route").textContent).toBe(
        "/data-explorer/todos/data",
      );
    });
  });
});
