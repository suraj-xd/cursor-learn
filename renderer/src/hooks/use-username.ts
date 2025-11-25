"use client";

import { create } from "zustand";

interface UsernameState {
  firstName: string | null;
  fullName: string | null;
  isLoading: boolean;
  fetch: () => Promise<void>;
}

export const useUsername = create<UsernameState>()((set, get) => ({
  firstName: null,
  fullName: null,
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
}));

