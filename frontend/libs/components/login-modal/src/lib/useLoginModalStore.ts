import { create } from "zustand";

interface LoginModalStore {
  isOpen: boolean;
  recheckTrigger: number;
  openModal: () => void;
  closeModal: () => void;
  triggerRecheck: () => void;
}

export const useLoginModalStore = create<LoginModalStore>((set) => ({
  isOpen: false,
  recheckTrigger: 0,
  openModal: () =>
    set((state) => ({ isOpen: true, recheckTrigger: state.recheckTrigger + 1 })),
  closeModal: () => set({ isOpen: false }),
  triggerRecheck: () =>
    set((state) => ({ isOpen: true, recheckTrigger: state.recheckTrigger + 1 })),
}));
