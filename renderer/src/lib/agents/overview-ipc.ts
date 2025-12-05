export type ConversationOverview = {
  id: string
  workspaceId: string
  conversationId: string
  title: string
  summary: string
  topics: string[]
  content: string
  modelUsed: string
  status: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

export type OverviewSession = {
  id: string
  overviewId: string | null
  workspaceId: string
  conversationId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentStep: string | null
  error: string | null
  startedAt: number
  completedAt: number | null
}

export type OverviewProgress = {
  sessionId: string
  workspaceId: string
  conversationId: string
  status: string
  progress: number
  currentStep: string | null
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

export const overviewIpc = {
  start: async (payload: StartPayload): Promise<{ session: OverviewSession; overview: ConversationOverview }> => {
    const ipc = ensureIpc()
    return ipc.overview.start(payload)
  },

  cancel: async (sessionId: string): Promise<OverviewSession | null> => {
    const ipc = ensureIpc()
    return ipc.overview.cancel(sessionId)
  },

  get: async (workspaceId: string, conversationId: string): Promise<ConversationOverview | null> => {
    const ipc = ensureIpc()
    return ipc.overview.get({ workspaceId, conversationId })
  },

  getSessionStatus: async (sessionId: string): Promise<OverviewSession | null> => {
    const ipc = ensureIpc()
    return ipc.overview.getSessionStatus(sessionId)
  },

  getActiveSession: async (workspaceId: string, conversationId: string): Promise<OverviewSession | null> => {
    const ipc = ensureIpc()
    return ipc.overview.getActiveSession({ workspaceId, conversationId })
  },

  onProgress: (callback: (data: OverviewProgress) => void): (() => void) => {
    const ipc = ensureIpc()
    return ipc.overview.onProgress(callback)
  },

  hasApiKey: async (): Promise<boolean> => {
    const ipc = ensureIpc()
    return ipc.overview.hasApiKey()
  },
}
