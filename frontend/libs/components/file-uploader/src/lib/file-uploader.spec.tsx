import { render, screen } from "@testing-library/react";
import { FileUploader } from "./file-uploader";

describe("FileUploader", () => {
  it("shows the supported upload type", () => {
    render(<FileUploader files={[]} fileTypes={["PNG"]} handleChange={vi.fn()} />);
    expect(screen.getByText("Upload a file")).toBeTruthy();
    expect(screen.getByText("PNG supported")).toBeTruthy();
  });
});
