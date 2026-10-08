import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GenerationProvider } from "@storyteller/common";
import { ProviderBillingModal } from "./provider-billing-modal";

const events = vi.hoisted(() => ({
  onBilling: (_event: { provider: GenerationProvider }) => {},
}));

vi.mock("@storyteller/tauri-events", () => ({
  useShowProviderBillingModalEvent: (callback: typeof events.onBilling) => {
    events.onBilling = callback;
  },
}));
vi.mock("@storyteller/ui-modal", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock("@storyteller/ui-pricing-modal", () => ({
  PricingContent: () => <div>ArtCraft plans</div>,
}));

afterEach(cleanup);

it("explains an ArtCraft credit failure without an unsolicited pricing screen", async () => {
  render(<ProviderBillingModal />);
  await act(async () => events.onBilling({ provider: GenerationProvider.Artcraft }));
  expect(screen.getByText("ArtCraft credits unavailable")).toBeTruthy();
  expect(screen.getByText(/manage ArtCraft services in Settings/)).toBeTruthy();
  expect(screen.queryByText("ArtCraft plans")).toBeNull();
});

it("shows plan suggestions when enabled and removes them when disabled", async () => {
  const view = render(<ProviderBillingModal showArtcraftPlanSuggestions />);
  await act(async () => events.onBilling({ provider: GenerationProvider.Artcraft }));
  expect(screen.getByText("ArtCraft plans")).toBeTruthy();
  view.rerender(<ProviderBillingModal showArtcraftPlanSuggestions={false} />);
  expect(screen.queryByText("ArtCraft plans")).toBeNull();
  expect(screen.getByText("ArtCraft credits unavailable")).toBeTruthy();
});

it("retains billing guidance for a selected third-party provider", async () => {
  render(<ProviderBillingModal />);
  await act(async () => events.onBilling({ provider: GenerationProvider.Midjourney }));
  expect(screen.getByRole("heading", { name: "Set up Midjourney" })).toBeTruthy();
  expect(screen.queryByText("ArtCraft plans")).toBeNull();
});
