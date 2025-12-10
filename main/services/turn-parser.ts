import { randomUUID } from 'node:crypto'
import { estimateTokens } from './compact-agent'
import { scoreImportance } from './importance-scorer'
import type {
  CodeBlock,
  Decision,
  DialogTurn,
  ErrorMention,
  FileReference,
  ParsedConversation,
} from './types/dialog-turn'

export type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g
const FILE_PATH_REGEX = /(?:^|\s)([\/\w.-]+\.[a-z]{2,6})(?:\s|$|:|\))/gi
const ERROR_PATTERNS = [
  /error:\s*(.+)/gi,
  /exception:\s*(.+)/gi,
  /failed:\s*(.+)/gi,
  /typeerror:\s*(.+)/gi,
  /referenceerror:\s*(.+)/gi,
]
const DECISION_KEYWORDS = ['decided to', 'chose to', 'went with', 'instead of', 'because', 'the reason']

export function parseConversation(
  workspaceId: string,
  conversationId: string,
  title: string,
  bubbles: ConversationBubble[]
): ParsedConversation {
  const turns = bubbles.map((bubble, index) => parseTurn(bubble, index))
  scoreImportance(turns)

  return {
    id: generateId(),
    workspaceId,
    conversationId,
    title,
    turns,
    stats: computeStats(turns),
    parsedAt: Date.now(),
  }
}

function parseTurn(bubble: ConversationBubble, index: number): DialogTurn {
  const codeBlocks = extractCodeBlocks(bubble.text, index.toString())
  const fileRefs = extractFileReferences(bubble.text, index.toString())
  const errorMentions = extractErrorMentions(bubble.text, index.toString())
  const decisions = extractDecisions(bubble.text, index.toString())

  const isProblemResolution = errorMentions.some((e) => e.type === 'fix')

  return {
    id: generateId(),
    index,
    role: bubble.type,
    content: bubble.text,
    timestamp: bubble.timestamp ?? Date.now(),
    codeBlocks,
    fileRefs,
    errorMentions,
    decisions,
    importance: 'medium',
    importanceScore: 5,
    tokenCount: estimateTokens(bubble.text),
    hasSubstantialCode: codeBlocks.some((cb) => cb.lineCount >= 5),
    isKeyDecision: decisions.length > 0,
    isProblemResolution,
  }
}

function extractCodeBlocks(text: string, turnId: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  let match: RegExpExecArray | null
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blocks.push({
      id: generateId(),
      language: match[1] || 'text',
      code: match[2].trim(),
      lineCount: match[2].split('\n').length,
      turnId,
    })
  }
  return blocks
}

function extractFileReferences(text: string, turnId: string): FileReference[] {
  const refs: FileReference[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = FILE_PATH_REGEX.exec(text)) !== null) {
    const path = match[1]
    if (!seen.has(path) && isValidFilePath(path)) {
      seen.add(path)
      refs.push({
        path,
        action: inferFileAction(text, path),
        turnId,
      })
    }
  }
  return refs
}

function extractErrorMentions(text: string, turnId: string): ErrorMention[] {
  const mentions: ErrorMention[] = []
  for (const pattern of ERROR_PATTERNS) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      mentions.push({
        id: generateId(),
        type: 'error',
        message: match[1].slice(0, 200),
        turnId,
      })
    }
  }
  const lowered = text.toLowerCase()
  if (lowered.includes('fixed') || lowered.includes('resolved')) {
    mentions.forEach((m) => {
      m.type = 'fix'
    })
  }
  return mentions
}

function extractDecisions(text: string, turnId: string): Decision[] {
  const decisions: Decision[] = []
  for (const keyword of DECISION_KEYWORDS) {
    if (text.toLowerCase().includes(keyword)) {
      const sentences = text.split(/[.!?]+/)
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          decisions.push({
            id: generateId(),
            description: sentence.trim().slice(0, 300),
            turnId,
          })
          break
        }
      }
    }
  }
  return decisions
}

function computeStats(turns: DialogTurn[]): ParsedConversation['stats'] {
  let userTurns = 0
  let aiTurns = 0
  let codeBlockCount = 0
  let fileCount = 0
  let errorCount = 0
  let decisionCount = 0
  let highImportanceTurns = 0
  let totalTokens = 0

  for (const turn of turns) {
    if (turn.role === 'user') userTurns++
    if (turn.role === 'ai') aiTurns++
    codeBlockCount += turn.codeBlocks.length
    fileCount += turn.fileRefs.length
    errorCount += turn.errorMentions.length
    decisionCount += turn.decisions.length
    totalTokens += turn.tokenCount
    if (turn.importance === 'high') highImportanceTurns++
  }

  return {
    totalTurns: turns.length,
    userTurns,
    aiTurns,
    totalTokens,
    codeBlockCount,
    fileCount,
    errorCount,
    decisionCount,
    highImportanceTurns,
  }
}

function inferFileAction(text: string, targetPath: string): FileReference['action'] {
  const lower = text.toLowerCase()
  if (lower.includes('delete') || lower.includes('removed')) return 'deleted'
  if (lower.includes('create') || lower.includes('add ')) return 'created'
  if (lower.includes('update') || lower.includes('modify') || lower.includes('change')) return 'modified'
  if (lower.includes('read') || lower.includes('open')) return 'read'
  if (targetPath.includes(' ')) return 'mentioned'
  return 'mentioned'
}

function isValidFilePath(pathCandidate: string): boolean {
  if (!pathCandidate || pathCandidate.length < 3) return false
  if (pathCandidate.includes('://')) return false
  return pathCandidate.includes('/')
}

function generateId(): string {
  return randomUUID()
}
