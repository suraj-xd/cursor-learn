import { randomUUID } from 'node:crypto'
import { generate } from './ai/helpers'
import { LEARNINGS_EXTRACT_PROMPT } from './ai/prompts'
import { saveLearningConcepts } from './agent-storage'
import type { LearningConcept } from './types/learning-concept'

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

export async function extractLearnings(input: {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
}): Promise<LearningConcept[]> {
  const conversationText = formatBubblesAsText(input.bubbles)
  const prompt = LEARNINGS_EXTRACT_PROMPT.replace('{conversation}', conversationText)

  const result = await generate({
    prompt,
    temperature: 0.2,
    maxTokens: 3000,
    role: 'overview',
  })

  const parsed = parseConcepts(result.content)
  if (!parsed.length) {
    throw new Error('Failed to extract learnings')
  }

  const enriched = parsed.map((concept) => ({
    ...concept,
    id: concept.id || randomUUID(),
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    searchableText: buildSearchableText(concept),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }))

  saveLearningConcepts(input.workspaceId, input.conversationId, enriched)
  return enriched
}

function formatBubblesAsText(bubbles: ConversationBubble[]): string {
  return bubbles
    .map((b, idx) => `[Turn ${idx}] [${b.type.toUpperCase()}]: ${b.text}`)
    .join('\n\n')
}

function parseConcepts(content: string): LearningConcept[] {
  let clean = content.trim()
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')

  try {
    const data = JSON.parse(clean) as { concepts?: LearningConcept[] }
    return Array.isArray(data.concepts) ? data.concepts : []
  } catch {
    return []
  }
}

function buildSearchableText(concept: LearningConcept): string {
  return [concept.name, concept.description, ...(concept.tags || [])].join(' ').toLowerCase()
}
