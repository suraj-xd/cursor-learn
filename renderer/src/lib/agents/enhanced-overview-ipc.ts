export type OverviewSection = {
  id: string
  order: number
  type:
    | 'goal'
    | 'context'
    | 'implementation'
    | 'decisions'
    | 'problems'
    | 'learnings'
    | 'next_steps'
    | 'diagram'
  title: string
  description: string
  content: string
  codeSnippets: Array<{
    code: string
    language: string
    purpose?: string
    turnId?: string
  }>
  diagrams: Array<{
    id: string
    type: 'architecture' | 'flowchart' | 'sequence' | 'component' | 'state'
    mermaidCode: string
    caption?: string
    sectionId: string
    cachedSvg?: string
  }>
  citations: Array<{
    turnId: string
    turnIndex: number
    excerpt?: string
  }>
  importance: 'high' | 'medium' | 'low'
  relevantTurnIds: string[]
  tokenCount: number
  generatedAt: number
}

export type OverviewStructure = {
  id: string
  workspaceId: string
  conversationId: string
  title: string
  summary: string
  sections: OverviewSection[]
  metadata: {
    totalTurns: number
    processedTurns: number
    truncatedTurns: number
    tokenBudgetUsed: number
    generationTimeMs: number
    modelUsed: string
    structureVersion: number
  }
  createdAt: number
  updatedAt: number
}

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

const ensureIpc = () => {
  if (typeof window === 'undefined' || !window.ipc) {
    throw new Error('IPC bridge unavailable')
  }
  return window.ipc
}

export const enhancedOverviewIpc = {
  generate: async (payload: {
    workspaceId: string
    conversationId: string
    title: string
    bubbles: ConversationBubble[]
    options?: { tokenBudget?: number; parallelSections?: number }
  }): Promise<OverviewStructure> => {
    const ipc = ensureIpc()
    return ipc.enhancedOverview.generate(payload)
  },
}
