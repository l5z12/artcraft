import { fireEvent, render, screen } from "@testing-library/react";
import { SaveIcon } from "lucide-react";
import { ButtonIcon } from "./button-icon";

describe("ButtonIcon", () => {
  it("calls the click handler", () => {
    const onClick = vi.fn();
    render(<ButtonIcon icon={SaveIcon} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
