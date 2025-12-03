export type ProviderId = 'openai' | 'google' | 'openrouter' | 'anthropic' | (string & {})

export type AgentApiKeyMetadata = {
  provider: ProviderId
  label: string | null
  createdAt: number
  updatedAt: number
}

export type AgentChat = {
  id: string
  title: string
  modelId: string
  provider: ProviderId
  summary: string | null
  workspaceConversationId: string | null
  createdAt: number
  updatedAt: number
}

export type AgentMessage = {
  id: string
  chatId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: unknown
  tokenUsage: number
  createdAt: number
}

export type AgentMention = {
  id: number
  chatId: string
  mentionedChatId: string
  createdAt: number
}

export type AgentChatBundle = {
  chat: AgentChat
  messages: AgentMessage[]
  mentions: AgentMention[]
}

export type AgentChatContext = {
  chatId: string
  title: string
  content: string
  wasSummarized: boolean
  summaryFromCache: boolean
  coveredMessageCount: number
  totalMessages: number
  recentMessageCount: number
  strategy: 'empty' | 'full' | 'summarized' | 'truncated'
  tokenEstimate: number
}

