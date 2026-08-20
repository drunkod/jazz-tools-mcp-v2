import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRouter, MemoryRouter, Route, Routes, useLocation } from "react-router";
import { DataExplorer } from "./index";

const mockSetQueryPropagation = vi.fn();
const mockUseDevtoolsContext = vi.fn();
let originalClipboardDescriptor: PropertyDescriptor | undefined;

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
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  beforeEach(() => {
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    window.history.replaceState({}, "", "/");
    mockSetQueryPropagation.mockReset();
    mockUseDevtoolsContext.mockReset();
    mockUseDevtoolsContext.mockReturnValue({
      wasmSchema: {
        todos: { columns: [{ name: "title" }, { name: "done" }] },
        users: { columns: [{ name: "name" }] },
      },
      runtime: "overlay",
      queryPropagation: "local-only",
      setQueryPropagation: mockSetQueryPropagation,
    });
  });

  it("renders a resizable table list panel and hides copy links in overlay mode", () => {
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
    expect(screen.queryByRole("button", { name: "Copy view link" })).toBeNull();
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
    const table = "todos/archived #1";
    mockUseDevtoolsContext.mockReturnValue({
      wasmSchema: {
        [table]: { columns: [{ name: "message" }] },
      },
      runtime: "overlay",
      queryPropagation: "local-only",
      setQueryPropagation: mockSetQueryPropagation,
    });

    render(
      <MemoryRouter initialEntries={["/data-explorer/todos%2Farchived%20%231/data"]}>
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<div>table content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(`View ${table} data`).getAttribute("href")).toBe(
      "/data-explorer/todos%2Farchived%20%231/data",
    );
    expect(screen.getByLabelText(`View ${table} schema`).getAttribute("href")).toBe(
      "/data-explorer/todos%2Farchived%20%231/schema",
    );
  });

  it("focuses table search with slash unless the event comes from an editable target", () => {
    render(
      <MemoryRouter initialEntries={["/data-explorer/todos/data"]}>
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<input aria-label="Cell editor" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const searchInput = screen.getByLabelText("Search tables");
    const cellEditor = screen.getByLabelText("Cell editor");
    cellEditor.focus();

    fireEvent.keyDown(cellEditor, { key: "/" });
    expect(document.activeElement).toBe(cellEditor);

    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).toBe(searchInput);
  });

  it("copies the current filtered and sorted view URL in standalone mode", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockUseDevtoolsContext.mockReturnValue({
      wasmSchema: {
        todos: { columns: [{ name: "title" }, { name: "done" }] },
        users: { columns: [{ name: "name" }] },
      },
      runtime: "standalone",
      queryPropagation: "local-only",
      setQueryPropagation: mockSetQueryPropagation,
    });
    window.history.replaceState(
      {},
      "",
      "/data-explorer/todos/data?page=2&sort=title&direction=desc",
    );

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/data-explorer/:table/*" element={<DataExplorer />}>
            <Route path="data" element={<div>table content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy view link" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        new URL(
          "/data-explorer/todos/data?page=2&sort=title&direction=desc",
          window.location.origin,
        ).toString(),
      );
    });
    expect(screen.getByText("Copied")).not.toBeNull();
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
