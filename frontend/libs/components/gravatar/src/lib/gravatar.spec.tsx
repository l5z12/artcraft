import { fireEvent, render, screen } from "@testing-library/react";
import { Gravatar } from "./gravatar";

describe("Gravatar", () => {
  it("falls back to the local avatar when the remote image fails", () => {
    render(<Gravatar size={32} username="Artist" avatarIndex={2} />);
    const avatar = screen.getByRole("img", { name: "Artist\'s gravatar" });
    fireEvent.error(avatar);
    expect(avatar.getAttribute("src")).toBe("/resources/avatars/2.webp");
  });
});
