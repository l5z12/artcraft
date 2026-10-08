import { fireEvent, render, screen } from "@testing-library/react";
import { MenuIconSelector } from "./menu-icon-selector";

describe("MenuIconSelector", () => {
  it("reports the clicked menu item", () => {
    const onMenuChange = vi.fn();
    render(<MenuIconSelector menuItems={[{ id: "scene", label: "Scene", icon: <span>Scene</span> }]} activeMenu="scene" onMenuChange={onMenuChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    expect(onMenuChange).toHaveBeenCalledWith("scene");
  });
});
