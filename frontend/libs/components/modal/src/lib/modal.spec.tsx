import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "./modal";

describe("Modal", () => {
  it("renders an accessible dialog and handles Escape", () => {
    const onClose = vi.fn();
    render(<Modal isOpen title="Scene" onClose={onClose}><p>Local document</p></Modal>);
    expect(screen.getByRole("dialog", { name: "Scene" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
