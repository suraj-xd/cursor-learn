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

import type { ConversationOverview } from "@/lib/agents/overview-ipc"
import type { Exercise } from "@/types/learnings"
import type { ConversationAnalysis, Resource } from "@/types/resources"

export type AgentChatMode = "agent" | "overview" | "interactive" | "resources"

export type AgentAttachedContext = {
  id: string
  title: string
  type: "chat" | "composer"
  wasSummarized?: boolean
  messageCount?: number
}

export type AgentModeData = {
  overview?: ConversationOverview
  learnings?: {
    exercises?: Exercise[]
    topics?: string[]
    contextSummaryId?: string | null
  }
  resources?: {
    resources?: Resource[]
    topics?: string[]
    analysis?: ConversationAnalysis | null
  }
}

export type AgentMessageMetadata = {
  attachedContexts?: AgentAttachedContext[]
  mode?: AgentChatMode
  modeData?: AgentModeData
}

export type AgentMessage = {
  id: string
  chatId: string
  role: "user" | "assistant" | "system"
  content: string
  metadata: AgentMessageMetadata | null
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

