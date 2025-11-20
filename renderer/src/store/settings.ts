"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CodeThemeId } from "@/lib/code-themes"

type SettingsState = {
  codeTheme: CodeThemeId
  setCodeTheme: (theme: CodeThemeId) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      codeTheme: "vscDarkPlus",
      setCodeTheme: (theme) => set({ codeTheme: theme }),
    }),
    {
      name: "app-settings",
    }
  )
)

