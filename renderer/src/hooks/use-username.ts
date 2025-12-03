"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UsernameState {
  firstName: string | null;
  fullName: string | null;
  customName: string | null;
  isLoading: boolean;
  fetch: () => Promise<void>;
  setCustomName: (name: string | null) => void;
  getDisplayName: () => string | null;
}

export const useUsername = create<UsernameState>()(
  persist(
    (set, get) => ({
      firstName: null,
      fullName: null,
      customName: null,
      isLoading: true,
      fetch: async () => {
        if (get().fullName !== null) return;
        try {
          const name = await window.ipc.environment.username();
          const trimmed = name?.trim() || "";
          if (trimmed) {
            const first = trimmed.split(/[\s_-]/)[0];
            set({
              firstName: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
              fullName: trimmed,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch {
          set({ isLoading: false });
        }
      },
      setCustomName: (name) => {
        const trimmed = name?.trim() || null;
        set({ customName: trimmed });
      },
      getDisplayName: () => {
        const state = get();
        return state.customName || state.firstName;
      },
    }),
    {
      name: "user-profile",
      partialize: (state) => ({ customName: state.customName }),
    }
  )
);

