export type BubbleRole = 'user' | 'ai'

export type ImportanceLevel = 'high' | 'medium' | 'low'

export type CodeBlock = {
  id: string
  language: string
  code: string
  purpose?: string
  lineCount: number
  turnId: string
}

export type FileReference = {
  path: string
  action: 'created' | 'modified' | 'read' | 'deleted' | 'mentioned'
  turnId: string
}

export type ErrorMention = {
  id: string
  type: 'error' | 'warning' | 'bug' | 'fix'
  message: string
  resolution?: string
  turnId: string
}

export type Decision = {
  id: string
  description: string
  rationale?: string
  alternatives?: string[]
  turnId: string
}

export type DialogTurn = {
  id: string
  index: number
  role: BubbleRole
  content: string
  timestamp: number

  codeBlocks: CodeBlock[]
  fileRefs: FileReference[]
  errorMentions: ErrorMention[]
  decisions: Decision[]

  importance: ImportanceLevel
  importanceScore: number
  tokenCount: number
  hasSubstantialCode: boolean
  isKeyDecision: boolean
  isProblemResolution: boolean
}

export type ParsedConversation = {
  id: string
  workspaceId: string
  conversationId: string
  title: string

  turns: DialogTurn[]

  stats: {
    totalTurns: number
    userTurns: number
    aiTurns: number
    totalTokens: number
    codeBlockCount: number
    fileCount: number
    errorCount: number
    decisionCount: number
    highImportanceTurns: number
  }

  parsedAt: number
}
