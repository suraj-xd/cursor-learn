"use client"

import { create } from "zustand"
import { persist, subscribeWithSelector } from "zustand/middleware"
import type { CodeThemeId } from "@/lib/code-themes"
import type { ResourcesProviderId } from "@/types/resources"
import type { ProviderId } from "@/lib/ai/config"

type ModelRole = "chat" | "title" | "compact" | "summarization" | "overview" | "resources"

type PreferredModels = {
  [key in ModelRole]?: string
}

type SettingsState = {
  codeTheme: CodeThemeId
  setCodeTheme: (theme: CodeThemeId) => void
  preferredModels: PreferredModels
  setPreferredModel: (role: ModelRole, modelId: string) => void
  getPreferredModel: (role: ModelRole) => string | undefined
  clearPreferredModels: () => void
  autoRunOverview: boolean
  setAutoRunOverview: (enabled: boolean) => void
  autoRunLearnings: boolean
  setAutoRunLearnings: (enabled: boolean) => void
  autoRunResources: boolean
  setAutoRunResources: (enabled: boolean) => void
  resourcesProvider: ResourcesProviderId
  setResourcesProvider: (provider: ResourcesProviderId) => void
  preferredProvider: ProviderId | null
  setPreferredProvider: (provider: ProviderId | null) => void
  apiKeysVersion: number
  incrementApiKeysVersion: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      codeTheme: "vscDarkPlus",
      setCodeTheme: (theme) => set({ codeTheme: theme }),
      preferredModels: {},
      setPreferredModel: (role, modelId) =>
        set((state) => ({
          preferredModels: { ...state.preferredModels, [role]: modelId },
        })),
      getPreferredModel: (role) => get().preferredModels[role],
      clearPreferredModels: () => set({ preferredModels: {} }),
      autoRunOverview: false,
      setAutoRunOverview: (enabled) => set({ autoRunOverview: enabled }),
      autoRunLearnings: false,
      setAutoRunLearnings: (enabled) => set({ autoRunLearnings: enabled }),
      autoRunResources: false,
      setAutoRunResources: (enabled) => set({ autoRunResources: enabled }),
      resourcesProvider: "auto",
      setResourcesProvider: (provider) => set({ resourcesProvider: provider }),
      preferredProvider: null,
      setPreferredProvider: (provider) => set({ preferredProvider: provider }),
      apiKeysVersion: 0,
      incrementApiKeysVersion: () =>
        set((state) => ({ apiKeysVersion: state.apiKeysVersion + 1 })),
    })),
    {
      name: "app-settings",
      partialize: (state) => ({
        codeTheme: state.codeTheme,
        preferredModels: state.preferredModels,
        autoRunOverview: state.autoRunOverview,
        autoRunLearnings: state.autoRunLearnings,
        autoRunResources: state.autoRunResources,
        resourcesProvider: state.resourcesProvider,
        preferredProvider: state.preferredProvider,
      }),
    }
  )
)

export function notifyApiKeyChange() {
  useSettingsStore.getState().incrementApiKeysVersion()
}
