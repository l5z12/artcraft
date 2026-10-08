import { fireEvent, render, screen } from "@testing-library/react";
import { SaveIcon } from "lucide-react";
import { ButtonIconSelect } from "./button-icon-select";

describe("ButtonIconSelect", () => {
  it("reports the selected option", () => {
    const onOptionChange = vi.fn();
    render(<ButtonIconSelect options={[{ value: "save", text: "Save", icon: SaveIcon }]} onOptionChange={onOptionChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onOptionChange).toHaveBeenCalledWith("save");
  });
});
