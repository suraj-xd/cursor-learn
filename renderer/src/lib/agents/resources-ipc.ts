import type { Resource, ConversationAnalysis, ResourcesProviderId } from '@/types/resources'

type ProviderInfo = {
  available: boolean
  provider: string | null
  hasTavily: boolean
  hasPerplexity: boolean
  availableProviders: string[]
}

type GenerateResult = {
  resources: Resource[]
  topics: string[]
  analysis?: ConversationAnalysis
}

declare global {
  interface Window {
    ipc: {
      resources: {
        generate: (payload: {
          workspaceId: string
          conversationId: string
          title: string
          bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
          userRequest?: string
          preferredProvider?: ResourcesProviderId
        }) => Promise<GenerateResult>
        addMore: (payload: {
          workspaceId: string
          conversationId: string
          title: string
          bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
          existingResources: Resource[]
          userRequest?: string
        }) => Promise<GenerateResult>
        get: (payload: {
          workspaceId: string
          conversationId: string
        }) => Promise<{
          id: string
          workspaceId: string
          conversationId: string
          resources: Resource[]
          topics: string[]
          modelUsed: string
          metadata?: { analysis?: ConversationAnalysis }
          createdAt: number
          updatedAt: number
        } | null>
        clear: (payload: {
          workspaceId: string
          conversationId: string
        }) => Promise<boolean>
        hasTavilyKey: () => Promise<boolean>
        hasPerplexityKey: () => Promise<boolean>
        hasApiKey: () => Promise<boolean>
        getProviderInfo: () => Promise<ProviderInfo>
      }
    }
  }
}

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type GenerateInput = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
  userRequest?: string
  preferredProvider?: ResourcesProviderId
}

type AddMoreInput = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
  existingResources: Resource[]
  userRequest?: string
}

type ResourcesRecord = {
  id: string
  workspaceId: string
  conversationId: string
  resources: Resource[]
  topics: string[]
  modelUsed: string
  metadata?: { analysis?: ConversationAnalysis }
  createdAt: number
  updatedAt: number
}

export const resourcesIpc = {
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const result = await window.ipc.resources.generate(input)
    return {
      resources: result.resources,
      topics: result.topics,
      analysis: result.analysis,
    }
  },

  async addMore(input: AddMoreInput): Promise<GenerateResult> {
    const result = await window.ipc.resources.addMore(input)
    return {
      resources: result.resources,
      topics: result.topics,
      analysis: result.analysis,
    }
  },

  async get(
    workspaceId: string,
    conversationId: string
  ): Promise<ResourcesRecord | null> {
    return window.ipc.resources.get({ workspaceId, conversationId })
  },

  async clear(workspaceId: string, conversationId: string): Promise<boolean> {
    return window.ipc.resources.clear({ workspaceId, conversationId })
  },

  async hasTavilyKey(): Promise<boolean> {
    return window.ipc.resources.hasTavilyKey()
  },

  async hasPerplexityKey(): Promise<boolean> {
    return window.ipc.resources.hasPerplexityKey()
  },

  async hasApiKey(): Promise<boolean> {
    return window.ipc.resources.hasApiKey()
  },

  async getProviderInfo(): Promise<ProviderInfo> {
    return window.ipc.resources.getProviderInfo()
  },
}

export type { Resource, ResourcesRecord, ConversationBubble, GenerateInput, AddMoreInput, ProviderInfo, GenerateResult }
