export type ConceptCategory =
  | 'pattern'
  | 'technique'
  | 'architecture'
  | 'debugging'
  | 'tool'
  | 'concept'

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export type ConceptExample = {
  id: string
  code?: string
  language?: string
  explanation: string
  turnId?: string
  turnIndex?: number
}

export type LearningConcept = {
  id: string
  workspaceId: string
  conversationId: string

  name: string
  category: ConceptCategory
  description: string

  examples: ConceptExample[]
  relatedTurnIds: string[]

  difficulty: DifficultyLevel
  tags: string[]

  searchableText: string

  createdAt: number
  updatedAt: number
}

export type ConversationLearnings = {
  id: string
  workspaceId: string
  conversationId: string

  concepts: LearningConcept[]

  metadata: {
    extractedAt: number
    modelUsed: string
    conceptCount: number
  }
}
