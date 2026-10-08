import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge label="Local" />);
    expect(screen.getByText("Local")).toBeTruthy();
  });
});
