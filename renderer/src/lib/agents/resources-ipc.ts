import type { Resource, ConversationAnalysis, ResourcesProviderId } from '@/types/resources'

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
    const result = (await window.ipc.resources.generate(input)) as GenerateResult
    return {
      resources: result.resources,
      topics: result.topics,
      analysis: result.analysis,
    }
  },

  async addMore(input: AddMoreInput): Promise<GenerateResult> {
    const result = (await window.ipc.resources.addMore(input)) as GenerateResult
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
    const result = (await window.ipc.resources.get({ workspaceId, conversationId })) as
      | (ResourcesRecord & { resources: unknown[] })
      | null

    if (!result) return null

    return {
      ...result,
      resources: result.resources as Resource[],
    }
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
