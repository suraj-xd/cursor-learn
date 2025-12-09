import { z } from 'zod'
import { jsonrepair } from 'jsonrepair'
import { generate, generateWithSchema } from './ai/helpers'
import { hasAnyApiKey } from './ai/providers'
import { OVERVIEW_PROMPT } from './ai/prompts'
import {
  createConversationOverview,
  createOverviewSession,
  updateOverviewSession,
  getOverviewByConversation,
  getActiveOverviewSession,
  getOverviewSession,
  type ConversationOverviewRecord,
  type OverviewSessionRecord,
} from './agent-storage'

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type ConversationInput = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
}

type ProcessingResult = {
  overview: ConversationOverviewRecord
  session: OverviewSessionRecord
}

type OverviewData = {
  title: string
  summary: string
  topics: string[]
  content: string
}

function formatBubblesAsText(bubbles: ConversationBubble[]): string {
  return bubbles
    .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
    .join('\n\n')
}

function buildOverviewPrompt(title: string, conversationText: string): string {
  return `${OVERVIEW_PROMPT}

---
CONVERSATION TITLE: "${title}"

CONVERSATION:
${conversationText.slice(0, 80000)}`
}

const overviewSchema = z.object({
  title: z.string().min(1).max(200).default('Overview'),
  summary: z.string().min(1).max(1000).default('Summary unavailable'),
  topics: z.array(z.string().max(150)).max(15).default([]),
  content: z.string().min(1).default('Content unavailable'),
})

function normalizeOverviewData(data: z.infer<typeof overviewSchema>): OverviewData {
  return {
    title: data.title.slice(0, 100),
    summary: data.summary.slice(0, 600),
    topics: (data.topics || []).slice(0, 8).map((t) => t.trim()).filter(Boolean),
    content: data.content,
  }
}

function parseOverviewResponse(content: string): OverviewData | null {
  const tryParse = (input: string): unknown | null => {
    try {
      return JSON.parse(input)
    } catch {
      try {
        return JSON.parse(jsonrepair(input))
      } catch {
        return null
      }
    }
  }

  let cleanContent = content.trim()
  cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
  
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
  const candidate = jsonMatch?.[0] ?? cleanContent
  const parsed = tryParse(candidate)
  if (!parsed) return null

  const obj = parsed as Record<string, unknown>
  
  const hasTitle = typeof obj.title === 'string' && obj.title.length > 0
  const hasSummary = typeof obj.summary === 'string' && obj.summary.length > 0
  const hasContent = typeof obj.content === 'string' && obj.content.length > 0
  
  if (!hasTitle && !hasSummary && !hasContent) {
    return null
  }

  return normalizeOverviewData({
    title: hasTitle ? String(obj.title) : 'Overview',
    summary: hasSummary ? String(obj.summary) : 'Summary of conversation',
    topics: Array.isArray(obj.topics) ? obj.topics.map((t: unknown) => String(t)).filter(Boolean) : [],
    content: hasContent ? String(obj.content) : String(obj.summary || 'No detailed content available'),
  })
}

async function generateOverviewData(prompt: string): Promise<{ data: OverviewData; provider: string; model: string }> {
  let lastError: Error | null = null
  
  try {
    const result = await generateWithSchema({
      prompt,
      temperature: 0.3,
      maxTokens: 8192,
      role: 'overview',
      schema: overviewSchema,
      schemaName: 'ConversationOverview',
      maxRetries: 3,
      fallbackToText: true,
    })

    return {
      data: normalizeOverviewData(result.content),
      provider: result.provider,
      model: result.model,
    }
  } catch (structuredError) {
    lastError = structuredError instanceof Error ? structuredError : new Error('Structured generation failed')
    console.warn('Structured overview generation failed, trying text fallback:', lastError.message)
  }
  
  try {
    const fallbackResult = await generate({
      prompt: `${prompt}\n\nIMPORTANT: Return ONLY valid JSON with these exact keys: title, summary, topics (array), content. No markdown code blocks.`,
      temperature: 0.4,
      maxTokens: 8192,
      role: 'overview',
      maxRetries: 3,
    })

    const parsed = parseOverviewResponse(fallbackResult.content)
    if (parsed) {
      return {
        data: parsed,
        provider: fallbackResult.provider,
        model: fallbackResult.model,
      }
    }
  } catch (fallbackError) {
    console.warn('Text fallback also failed:', fallbackError instanceof Error ? fallbackError.message : 'Unknown error')
  }

  throw lastError ?? new Error('Failed to generate overview: no valid response from AI')
}

export async function startOverviewSession(
  conversation: ConversationInput,
  onProgress?: (session: OverviewSessionRecord) => void
): Promise<ProcessingResult> {
  const existingSession = getActiveOverviewSession(conversation.workspaceId, conversation.conversationId)
  if (existingSession) {
    throw new Error('An overview session is already in progress for this conversation')
  }

  if (!hasAnyApiKey()) {
    throw new Error('No API key configured. Please add your API key in settings.')
  }

  const session = createOverviewSession({
    workspaceId: conversation.workspaceId,
    conversationId: conversation.conversationId,
  })

  try {
    updateOverviewSession({ id: session.id, status: 'processing', currentStep: 'analyzing', progress: 10 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const conversationText = formatBubblesAsText(conversation.bubbles)
    
    updateOverviewSession({ id: session.id, currentStep: 'extracting', progress: 30 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const prompt = buildOverviewPrompt(conversation.title, conversationText)

    updateOverviewSession({ id: session.id, currentStep: 'generating', progress: 50 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const overviewResult = await generateOverviewData(prompt)

    updateOverviewSession({ id: session.id, currentStep: 'finalizing', progress: 80 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const overview = createConversationOverview({
      workspaceId: conversation.workspaceId,
      conversationId: conversation.conversationId,
      title: overviewResult.data.title,
      summary: overviewResult.data.summary,
      topics: overviewResult.data.topics,
      content: overviewResult.data.content,
      modelUsed: `${overviewResult.provider}:${overviewResult.model}`,
      metadata: {
        bubbleCount: conversation.bubbles.length,
        originalTitle: conversation.title,
      },
    })

    const updatedSession = updateOverviewSession({
      id: session.id,
      status: 'completed',
      progress: 100,
      overviewId: overview.id,
    })

    return {
      overview,
      session: updatedSession || session,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    updateOverviewSession({
      id: session.id,
      status: 'failed',
      error: errorMessage,
    })

    throw error
  }
}

export async function cancelOverviewSession(sessionId: string): Promise<OverviewSessionRecord | null> {
  const session = getOverviewSession(sessionId)
  if (!session) return null

  if (session.status !== 'pending' && session.status !== 'processing') {
    return session
  }

  return updateOverviewSession({
    id: sessionId,
    status: 'cancelled',
  })
}

export function getOverviewForConversation(
  workspaceId: string,
  conversationId: string
): ConversationOverviewRecord | null {
  return getOverviewByConversation(workspaceId, conversationId)
}

export function getSessionStatus(sessionId: string): OverviewSessionRecord | null {
  return getOverviewSession(sessionId)
}

export function getActiveSession(
  workspaceId: string,
  conversationId: string
): OverviewSessionRecord | null {
  return getActiveOverviewSession(workspaceId, conversationId)
}

export function checkApiKeyAvailable(): boolean {
  return hasAnyApiKey()
}

export { type ConversationInput, type ProcessingResult, type OverviewData }
