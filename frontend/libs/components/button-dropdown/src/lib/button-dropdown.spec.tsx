import { render, screen } from "@testing-library/react";
import { ButtonDropdown } from "./button-dropdown";

describe("ButtonDropdown", () => {
  it("renders the file menu trigger", () => {
    render(<ButtonDropdown label="File" options={[{ label: "Save" }]} />);
    expect(screen.getByRole("button", { name: "File" })).toBeTruthy();
  });
});
