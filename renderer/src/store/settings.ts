"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CodeThemeId } from "@/lib/code-themes"

type ModelRole = "chat" | "title" | "compact"

type PreferredModels = {
  [key in ModelRole]?: string
}

type SettingsState = {
  codeTheme: CodeThemeId
  setCodeTheme: (theme: CodeThemeId) => void
  preferredModels: PreferredModels
  setPreferredModel: (role: ModelRole, modelId: string) => void
  getPreferredModel: (role: ModelRole) => string | undefined
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      codeTheme: "vscDarkPlus",
      setCodeTheme: (theme) => set({ codeTheme: theme }),
      preferredModels: {},
      setPreferredModel: (role, modelId) =>
        set((state) => ({
          preferredModels: { ...state.preferredModels, [role]: modelId },
        })),
      getPreferredModel: (role) => get().preferredModels[role],
    }),
    {
      name: "app-settings",
    }
  )
)
