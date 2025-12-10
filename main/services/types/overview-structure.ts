import type { ImportanceLevel } from './dialog-turn'

export type SectionType =
  | 'goal'
  | 'context'
  | 'implementation'
  | 'decisions'
  | 'problems'
  | 'learnings'
  | 'next_steps'
  | 'diagram'

export type DiagramType = 'architecture' | 'flowchart' | 'sequence' | 'component' | 'state'

export type Citation = {
  turnId: string
  turnIndex: number
  excerpt?: string
}

export type DiagramSpec = {
  id: string
  type: DiagramType
  mermaidCode: string
  caption?: string
  sectionId: string
  cachedSvg?: string
}

export type OverviewSection = {
  id: string
  order: number
  type: SectionType
  title: string
  description: string

  content: string
  codeSnippets: {
    code: string
    language: string
    purpose?: string
    turnId?: string
  }[]
  diagrams: DiagramSpec[]
  citations: Citation[]

  importance: ImportanceLevel
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
