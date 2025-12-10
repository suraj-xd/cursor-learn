type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type ParsedTurn = {
  index: number
  role: 'user' | 'ai'
  content: string
  tokenCount: number
  importance: 'high' | 'medium' | 'low'
  importanceScore: number
  hasCode: boolean
  hasError: boolean
  hasDecision: boolean
}

type ParsedContext = {
  turns: ParsedTurn[]
  stats: {
    totalTurns: number
    totalTokens: number
    highImportanceTurns: number
  }
}

const CODE_BLOCK_REGEX = /```[\s\S]*?```/g
const ERROR_PATTERNS = [/error:/i, /exception:/i, /failed:/i, /typeerror:/i, /referenceerror:/i]
const DECISION_KEYWORDS = ['decided to', 'chose to', 'went with', 'instead of', 'because we', 'the reason']
const HIGH_IMPORTANCE_KEYWORDS = ['important', 'critical', 'key', 'finally', 'solved', 'fixed', 'works now']
const LOW_IMPORTANCE_KEYWORDS = ['thanks', 'thank you', 'got it', 'ok', 'okay', 'sure', 'hi', 'hello']

export const TOKEN_BUDGETS = {
  default: 8000,
  medium: 6000,
  small: 4000,
  minimal: 2000,
}

export const FALLBACK_BUDGETS = [
  TOKEN_BUDGETS.default,
  TOKEN_BUDGETS.medium,
  TOKEN_BUDGETS.small,
  TOKEN_BUDGETS.minimal,
]

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function scoreImportance(turn: ParsedTurn): void {
  let score = 5

  if (turn.hasCode) score += 2
  if (turn.hasDecision) score += 2
  if (turn.hasError) score += 1

  const lowered = turn.content.toLowerCase()
  if (HIGH_IMPORTANCE_KEYWORDS.some((kw) => lowered.includes(kw))) score += 1
  if (LOW_IMPORTANCE_KEYWORDS.some((kw) => lowered.includes(kw))) score -= 2
  if (turn.content.length < 50) score -= 1

  const clamped = Math.max(1, Math.min(10, score))
  turn.importanceScore = clamped
  turn.importance = clamped >= 8 ? 'high' : clamped >= 5 ? 'medium' : 'low'
}

export function parseContext(bubbles: ConversationBubble[]): ParsedContext {
  const turns: ParsedTurn[] = bubbles.map((bubble, index) => {
    const hasCode = CODE_BLOCK_REGEX.test(bubble.text)
    const hasError = ERROR_PATTERNS.some((p) => p.test(bubble.text))
    const hasDecision = DECISION_KEYWORDS.some((kw) => bubble.text.toLowerCase().includes(kw))

    const turn: ParsedTurn = {
      index,
      role: bubble.type,
      content: bubble.text,
      tokenCount: estimateTokens(bubble.text),
      importance: 'medium',
      importanceScore: 5,
      hasCode,
      hasError,
      hasDecision,
    }

    scoreImportance(turn)
    return turn
  })

  const totalTokens = turns.reduce((sum, t) => sum + t.tokenCount, 0)
  const highImportanceTurns = turns.filter((t) => t.importance === 'high').length

  return {
    turns,
    stats: {
      totalTurns: turns.length,
      totalTokens,
      highImportanceTurns,
    },
  }
}

function importanceWeight(level: ParsedTurn['importance']): number {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  return 1
}

export function truncateForBudget(turns: ParsedTurn[], budget: number): ParsedTurn[] {
  let total = turns.reduce((sum, t) => sum + t.tokenCount, 0)
  if (total <= budget) return turns

  const preserved = new Set<number>()
  for (let i = 0; i < Math.min(3, turns.length); i++) preserved.add(i)
  for (let i = Math.max(0, turns.length - 5); i < turns.length; i++) preserved.add(i)

  const sorted = turns
    .map((t, idx) => ({ t, idx }))
    .sort((a, b) => {
      const imp = importanceWeight(b.t.importance) - importanceWeight(a.t.importance)
      if (imp !== 0) return imp
      return b.t.importanceScore - a.t.importanceScore
    })

  const drop = new Set<number>()
  for (const { t, idx } of sorted.reverse()) {
    if (total <= budget) break
    if (preserved.has(idx)) continue
    drop.add(idx)
    total -= t.tokenCount
  }

  return turns.filter((_, idx) => !drop.has(idx))
}

export function formatTurnsAsText(turns: ParsedTurn[]): string {
  return turns
    .map((t) => `[Turn ${t.index + 1}] [${t.role.toUpperCase()}]: ${t.content}`)
    .join('\n\n')
}

export function truncateTurnContent(turn: ParsedTurn, maxChars: number = 2000): ParsedTurn {
  if (turn.content.length <= maxChars) return turn
  return {
    ...turn,
    content: turn.content.slice(0, maxChars) + '\n[...truncated...]',
    tokenCount: estimateTokens(turn.content.slice(0, maxChars)),
  }
}

export function prepareContextForGeneration(
  bubbles: ConversationBubble[],
  tokenBudget: number = TOKEN_BUDGETS.default
): { context: string; stats: ParsedContext['stats']; truncated: boolean } {
  const parsed = parseContext(bubbles)

  const truncatedTurns = truncateForBudget(
    parsed.turns.map((t) => truncateTurnContent(t)),
    tokenBudget
  )

  const context = formatTurnsAsText(truncatedTurns)
  const truncated = truncatedTurns.length < parsed.turns.length

  return {
    context,
    stats: {
      ...parsed.stats,
      totalTurns: truncatedTurns.length,
    },
    truncated,
  }
}
