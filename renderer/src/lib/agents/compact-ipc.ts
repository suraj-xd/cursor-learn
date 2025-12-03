export type CompactedChat = {
  id: string
  workspaceId: string
  conversationId: string
  conversationTitle: string | null
  compactedContent: string
  structuredData: unknown
  originalTokenCount: number | null
  compactedTokenCount: number | null
  compressionRatio: number | null
  modelUsed: string
  strategyUsed: string
  chunkCount: number
  status: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

export type CompactSessionLog = {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: unknown
}

export type CompactSession = {
  id: string
  compactedChatId: string | null
  workspaceId: string
  conversationId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentStep: string | null
  chunksTotal: number
  chunksProcessed: number
  logs: CompactSessionLog[]
  error: string | null
  startedAt: number
  completedAt: number | null
}

export type CompactProgress = {
  sessionId: string
  workspaceId: string
  conversationId: string
  status: string
  progress: number
  currentStep: string | null
  chunksTotal: number
  chunksProcessed: number
}

export type SuggestedQuestion = {
  question: string
  icon: 'code' | 'lightbulb' | 'puzzle' | 'book' | 'rocket' | 'target'
}

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type StartPayload = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
}

const ensureIpc = () => {
  if (typeof window === 'undefined' || !window.ipc) {
    throw new Error('IPC bridge unavailable')
  }
  return window.ipc
}

export const compactIpc = {
  start: async (payload: StartPayload): Promise<{ session: CompactSession; compactedChat: CompactedChat }> => {
    const ipc = ensureIpc()
    return ipc.compact.start(payload)
  },

  cancel: async (sessionId: string): Promise<CompactSession | null> => {
    const ipc = ensureIpc()
    return ipc.compact.cancel(sessionId)
  },

  get: async (workspaceId: string, conversationId: string): Promise<CompactedChat | null> => {
    const ipc = ensureIpc()
    return ipc.compact.get({ workspaceId, conversationId })
  },

  getSessionStatus: async (sessionId: string): Promise<CompactSession | null> => {
    const ipc = ensureIpc()
    return ipc.compact.getSessionStatus(sessionId)
  },

  getActiveSession: async (workspaceId: string, conversationId: string): Promise<CompactSession | null> => {
    const ipc = ensureIpc()
    return ipc.compact.getActiveSession({ workspaceId, conversationId })
  },

  onProgress: (callback: (data: CompactProgress) => void): (() => void) => {
    const ipc = ensureIpc()
    return ipc.compact.onProgress(callback)
  },

  getSuggestions: async (compactedContent: string): Promise<SuggestedQuestion[]> => {
    const ipc = ensureIpc()
    return ipc.compact.getSuggestions(compactedContent) as Promise<SuggestedQuestion[]>
  },
}

