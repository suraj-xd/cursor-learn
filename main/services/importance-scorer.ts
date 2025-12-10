import type { DialogTurn } from './types/dialog-turn'

const IMPORTANCE_KEYWORDS = {
  high: ['important', 'critical', 'key', 'finally', 'solved', 'fixed', 'works now'],
  low: ['thanks', 'thank you', 'got it', 'ok', 'okay', 'sure'],
}

export function scoreImportance(turns: DialogTurn[]): void {
  for (const turn of turns) {
    let score = 5

    if (turn.hasSubstantialCode) score += 2
    if (turn.isKeyDecision) score += 2
    if (turn.isProblemResolution) score += 2
    if (turn.errorMentions.length > 0) score += 1
    if (turn.fileRefs.length >= 3) score += 1
    if (IMPORTANCE_KEYWORDS.high.some((kw) => turn.content.toLowerCase().includes(kw))) score += 1

    if (IMPORTANCE_KEYWORDS.low.some((kw) => turn.content.toLowerCase().includes(kw))) score -= 2
    if (turn.content.length < 50) score -= 1

    const clamped = Math.max(1, Math.min(10, score))
    turn.importanceScore = clamped
    turn.importance = clamped >= 8 ? 'high' : clamped >= 5 ? 'medium' : 'low'
  }
}
