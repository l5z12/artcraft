import { create } from "zustand";

const STORAGE_KEY = "artcraft_billing_shortcuts_enabled";

interface BillingPreferences {
  showBillingShortcuts: boolean;
  setShowBillingShortcuts: (enabled: boolean) => void;
}

export const useBillingPreferencesStore = create<BillingPreferences>((set) => ({
  showBillingShortcuts: readPreference(),
  setShowBillingShortcuts: (enabled) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // The preference still applies for this session if storage is unavailable.
    }
    set({ showBillingShortcuts: enabled });
  },
}));

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
