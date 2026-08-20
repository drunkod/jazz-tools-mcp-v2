import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColumnCustomizationModal } from "./ColumnCustomizationModal.js";

describe("ColumnCustomizationModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("resets column order and visibility to schema defaults", () => {
    const onApply = vi.fn();

    render(
      <ColumnCustomizationModal
        open
        columns={[
          { id: "title", header: "Title" },
          { id: "$createdBy", header: "$createdBy", hiddenByDefault: true },
          { id: "done", header: "Done" },
        ]}
        preferences={[
          { id: "done", visible: false },
          { id: "$createdBy", visible: true },
          { id: "title", visible: false },
        ]}
        onApply={onApply}
        onRequestClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith([
      { id: "title", visible: true },
      { id: "$createdBy", visible: false },
      { id: "done", visible: true },
    ]);
  });
});
