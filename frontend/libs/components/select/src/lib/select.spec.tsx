import { render, screen } from "@testing-library/react";
import { Select } from "./select";

describe("Select", () => {
  it("shows the selected option", () => {
    render(<Select options={[{ label: "Local", value: "local" }]} value="local" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Local" })).toBeTruthy();
  });
});
