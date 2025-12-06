"use client"

import { create } from "zustand"
import type { Resource, ResourcesState, ConversationAnalysis, ResourcesProviderId } from "@/types/resources"
import { resourcesIpc } from "@/lib/agents/resources-ipc"

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type ResourcesStore = ResourcesState & {
  currentWorkspaceId: string | null
  currentConversationId: string | null
  hasApiKey: boolean
  availableProvider: string | null
  loadCached: (workspaceId: string, conversationId: string) => Promise<boolean>
  generateResources: (
    workspaceId: string,
    conversationId: string,
    title: string,
    bubbles: ConversationBubble[],
    opts?: { userRequest?: string; preferredProvider?: ResourcesProviderId }
  ) => Promise<void>
  addMoreResources: (
    workspaceId: string,
    conversationId: string,
    title: string,
    bubbles: ConversationBubble[],
    userRequest?: string
  ) => Promise<void>
  clearResources: () => void
  checkProviderStatus: () => Promise<void>
}

export const useResourcesStore = create<ResourcesStore>((set, get) => ({
  resources: [],
  topics: [],
  analysis: null,
  isGenerating: false,
  generationError: null,
  hasTavilyKey: false,
  hasPerplexityKey: false,
  availableProviders: [],
  hasApiKey: false,
  availableProvider: null,
  currentWorkspaceId: null,
  currentConversationId: null,

  loadCached: async (workspaceId, conversationId) => {
    const state = get()
    if (
      state.currentWorkspaceId === workspaceId &&
      state.currentConversationId === conversationId &&
      state.resources.length > 0
    ) {
      return true
    }

    if (
      state.currentWorkspaceId !== workspaceId ||
      state.currentConversationId !== conversationId
    ) {
      set({
        resources: [],
        topics: [],
        analysis: null,
        currentWorkspaceId: workspaceId,
        currentConversationId: conversationId,
      })
    }

    try {
      const cached = await resourcesIpc.get(workspaceId, conversationId)
      if (cached && cached.resources.length > 0) {
        set({
          resources: cached.resources as Resource[],
          topics: cached.topics,
          analysis: cached.metadata?.analysis || null,
          currentWorkspaceId: workspaceId,
          currentConversationId: conversationId,
        })
        return true
      }
    } catch {
      // no cache found
    }
    return false
  },

  generateResources: async (workspaceId, conversationId, title, bubbles, opts) => {
    const state = get()
    if (state.isGenerating) return

    set({
      isGenerating: true,
      generationError: null,
      currentWorkspaceId: workspaceId,
      currentConversationId: conversationId,
    })

    try {
      const result = await resourcesIpc.generate({
        workspaceId,
        conversationId,
        title,
        bubbles,
        userRequest: opts?.userRequest,
        preferredProvider: opts?.preferredProvider,
      })

      set({
        resources: result.resources,
        topics: result.topics,
        analysis: result.analysis || null,
        isGenerating: false,
      })
    } catch (error) {
      set({
        isGenerating: false,
        generationError: error instanceof Error ? error.message : "Failed to generate resources",
      })
    }
  },

  addMoreResources: async (workspaceId, conversationId, title, bubbles, userRequest) => {
    const state = get()
    if (state.isGenerating) return

    set({ isGenerating: true, generationError: null })

    try {
      const result = await resourcesIpc.addMore({
        workspaceId,
        conversationId,
        title,
        bubbles,
        existingResources: state.resources,
        userRequest,
      })

      set({
        resources: result.resources,
        topics: result.topics,
        analysis: result.analysis || state.analysis,
        isGenerating: false,
      })
    } catch (error) {
      set({
        isGenerating: false,
        generationError: error instanceof Error ? error.message : "Failed to add resources",
      })
    }
  },

  clearResources: () => {
    const state = get()
    if (state.currentWorkspaceId && state.currentConversationId) {
      resourcesIpc.clear(state.currentWorkspaceId, state.currentConversationId).catch(() => {})
    }
    set({
      resources: [],
      topics: [],
      analysis: null,
      generationError: null,
    })
  },

  checkProviderStatus: async () => {
    try {
      const info = await resourcesIpc.getProviderInfo()
      set({
        hasApiKey: info.available,
        availableProvider: info.provider,
        hasTavilyKey: info.hasTavily,
        hasPerplexityKey: info.hasPerplexity,
        availableProviders: info.availableProviders,
      })
    } catch {
      set({
        hasApiKey: false,
        availableProvider: null,
        hasTavilyKey: false,
        hasPerplexityKey: false,
        availableProviders: [],
      })
    }
  },
}))

export const resourcesActions = {
  loadCached: (workspaceId: string, conversationId: string) =>
    useResourcesStore.getState().loadCached(workspaceId, conversationId),
  generateResources: (
    workspaceId: string,
    conversationId: string,
    title: string,
    bubbles: ConversationBubble[],
    opts?: { userRequest?: string; preferredProvider?: ResourcesProviderId }
  ) => useResourcesStore.getState().generateResources(workspaceId, conversationId, title, bubbles, opts),
  addMoreResources: (
    workspaceId: string,
    conversationId: string,
    title: string,
    bubbles: ConversationBubble[],
    userRequest?: string
  ) => useResourcesStore.getState().addMoreResources(workspaceId, conversationId, title, bubbles, userRequest),
  clearResources: () => useResourcesStore.getState().clearResources(),
  checkProviderStatus: () => useResourcesStore.getState().checkProviderStatus(),
}
