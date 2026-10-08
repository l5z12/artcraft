import { render, screen } from "@testing-library/react";
import { TabSelector } from "./tab-selector";

describe("TabSelector", () => {
  it("marks the active tab as selected", () => {
    render(<TabSelector tabs={[{ id: "scene", label: "Scene" }]} activeTab="scene" onTabChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Scene" }).getAttribute("aria-selected")).toBe("true");
  });
});
