"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CodeThemeId } from "@/lib/code-themes"
import type { ResourcesProviderId } from "@/types/resources"

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
  autoRunOverview: boolean
  setAutoRunOverview: (enabled: boolean) => void
  autoRunLearnings: boolean
  setAutoRunLearnings: (enabled: boolean) => void
  autoRunResources: boolean
  setAutoRunResources: (enabled: boolean) => void
  resourcesProvider: ResourcesProviderId
  setResourcesProvider: (provider: ResourcesProviderId) => void
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
      autoRunOverview: false,
      setAutoRunOverview: (enabled) => set({ autoRunOverview: enabled }),
      autoRunLearnings: false,
      setAutoRunLearnings: (enabled) => set({ autoRunLearnings: enabled }),
      autoRunResources: false,
      setAutoRunResources: (enabled) => set({ autoRunResources: enabled }),
      resourcesProvider: "auto",
      setResourcesProvider: (provider) => set({ resourcesProvider: provider }),
    }),
    {
      name: "app-settings",
    }
  )
)
