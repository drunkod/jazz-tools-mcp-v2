import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Link, MemoryRouter, Outlet, useParams } from "react-router";
import { InspectorRoutes } from "./routes";

const mockUseDevtoolsContext = vi.fn();
const mockGridState = vi.hoisted(() => ({ nextInstance: 0 }));

vi.mock("./contexts/devtools-context.js", () => ({
  useDevtoolsContext: () => mockUseDevtoolsContext(),
}));

vi.mock("./components/inspector-layout", () => ({
  InspectorLayout: () => (
    <div>
      layout
      <Outlet />
    </div>
  ),
}));

vi.mock("./pages/data-explorer", () => ({
  DataExplorer: () => (
    <div>
      data explorer
      <Link to="/data-explorer/todos%2Factive/data">todos</Link>
      <Link to="/data-explorer/users%2Farchived/data">users</Link>
      <Outlet />
    </div>
  ),
}));

vi.mock("./components/data-explorer/TableDataGrid", () => ({
  TableDataGrid: () => {
    const { table } = useParams();
    const [instance] = useState(() => ++mockGridState.nextInstance);
    const [draft, setDraft] = useState("");

    return (
      <div>
        <output aria-label="Grid table">{table}</output>
        <output aria-label="Grid instance">{instance}</output>
        <input
          aria-label="Grid local state"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
    );
  },
}));

vi.mock("./components/data-explorer/TableSchemaDefinition", () => ({
  TableSchemaDefinition: () => <div>schema definition</div>,
}));

vi.mock("./pages/live-query", () => ({
  LiveQuery: () => <div>live query page</div>,
}));

describe("InspectorRoutes", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockUseDevtoolsContext.mockReset();
    mockGridState.nextInstance = 0;
  });

  it("remounts the data grid when navigating between decoded table routes", () => {
    mockUseDevtoolsContext.mockReturnValue({ runtime: "overlay" });

    render(
      <MemoryRouter initialEntries={["/data-explorer/todos%2Factive/data"]}>
        <InspectorRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Grid table").textContent).toBe("todos/active");
    expect(screen.getByLabelText("Grid instance").textContent).toBe("1");
    fireEvent.change(screen.getByLabelText("Grid local state"), {
      target: { value: "queued mutation" },
    });

    fireEvent.click(screen.getByRole("link", { name: "users" }));

    expect(screen.getByLabelText("Grid table").textContent).toBe("users/archived");
    expect(screen.getByLabelText("Grid instance").textContent).toBe("2");
    expect((screen.getByLabelText("Grid local state") as HTMLInputElement).value).toBe("");
  });

  it("exposes the live query route in overlay mode", () => {
    mockUseDevtoolsContext.mockReturnValue({ runtime: "overlay" });

    render(
      <MemoryRouter initialEntries={["/live-query"]}>
        <InspectorRoutes />
      </MemoryRouter>,
    );

    expect(screen.getByText("live query page")).not.toBeNull();
  });
});
