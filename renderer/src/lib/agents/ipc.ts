import type { AgentApiKeyMetadata, AgentChat, AgentChatBundle, AgentChatContext, AgentMention, AgentMessage } from '@/types/agents'

const ensureIpc = () => {
  if (typeof window === 'undefined' || !window.ipc) {
    throw new Error('IPC bridge unavailable')
  }
  return window.ipc
}

export const agentsIpc = {
  apiKeys: {
    list: async (): Promise<AgentApiKeyMetadata[]> => {
      const ipc = ensureIpc()
      return ipc.agents.apiKeys.list()
    },
    save: async (payload: { provider: string; secret: string; label?: string | null }) => {
      const ipc = ensureIpc()
      return ipc.agents.apiKeys.save(payload)
    },
    delete: async (provider: string) => {
      const ipc = ensureIpc()
      return ipc.agents.apiKeys.delete(provider)
    },
  },
  chats: {
    list: async (payload?: { limit?: number; search?: string; workspaceConversationId?: string | null }) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.list(payload) as Promise<AgentChat[]>
    },
    create: async (payload: {
      id?: string
      title: string
      modelId: string
      provider: string
      summary?: string | null
      workspaceConversationId?: string | null
    }) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.create(payload) as Promise<AgentChat>
    },
    get: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.get(chatId) as Promise<AgentChatBundle | null>
    },
    delete: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.delete(chatId)
    },
    complete: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.complete(chatId) as Promise<{ message: AgentMessage }>
    },
    completeStream: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.completeStream(chatId) as Promise<{ message: AgentMessage }>
    },
    onStreamChunk: (callback: (data: { chatId: string; chunk: string; done: boolean }) => void) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.onStreamChunk(callback)
    },
    updateModel: async (payload: { chatId: string; modelId: string }) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.updateModel(payload) as Promise<AgentChat | null>
    },
    updateTitle: async (payload: { chatId: string; title: string }) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.updateTitle(payload) as Promise<AgentChat | null>
    },
    generateTitle: async (payload: { chatId: string; userMessage: string }) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.generateTitle(payload) as Promise<{ title: string }>
    },
    prepareContext: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.chats.prepareContext(chatId) as Promise<AgentChatContext>
    },
  },
  messages: {
    list: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.messages.list(chatId) as Promise<AgentMessage[]>
    },
    append: async (payload: {
      id?: string
      chatId: string
      role: 'user' | 'assistant' | 'system'
      content: string
      metadata?: unknown
      tokenUsage?: number
      createdAt?: number
    }) => {
      const ipc = ensureIpc()
      return ipc.agents.messages.append(payload) as Promise<AgentMessage>
    },
  },
  mentions: {
    list: async (chatId: string) => {
      const ipc = ensureIpc()
      return ipc.agents.mentions.list(chatId) as Promise<AgentMention[]>
    },
    add: async (payload: { chatId: string; mentionedChatId: string }) => {
      const ipc = ensureIpc()
      return ipc.agents.mentions.add(payload) as Promise<AgentMention[]>
    },
  },
}

export type UsageFeature = 'chat' | 'title' | 'compact' | 'summarization'

export type UsageStats = {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  totalCost: number
  totalCalls: number
}

export type UsageByProvider = {
  provider: string
  totalTokens: number
  totalCalls: number
  costEstimate: number
}

export type UsageByModel = {
  provider: string
  model: string
  totalTokens: number
  totalCalls: number
  costEstimate: number
}

export type UsageByDay = {
  date: string
  totalTokens: number
  totalCalls: number
  costEstimate: number
}

export type UsageRecord = {
  id: string
  provider: string
  model: string
  feature: UsageFeature
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costEstimate: number
  chatId: string | null
  metadata: unknown
  createdAt: number
}

export const usageIpc = {
  stats: async (since?: number): Promise<UsageStats> => {
    const ipc = ensureIpc()
    return ipc.usage.stats(since)
  },
  byProvider: async (since?: number): Promise<UsageByProvider[]> => {
    const ipc = ensureIpc()
    return ipc.usage.byProvider(since)
  },
  byModel: async (since?: number): Promise<UsageByModel[]> => {
    const ipc = ensureIpc()
    return ipc.usage.byModel(since)
  },
  byDay: async (since?: number): Promise<UsageByDay[]> => {
    const ipc = ensureIpc()
    return ipc.usage.byDay(since)
  },
  list: async (options?: { limit?: number; since?: number; provider?: string; feature?: UsageFeature }): Promise<UsageRecord[]> => {
    const ipc = ensureIpc()
    return ipc.usage.list(options)
  },
}

