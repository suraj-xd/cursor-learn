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
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(600),
  topics: z.array(z.string().min(1).max(120)).max(10).default([]),
  content: z.string().min(1),
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

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  const candidate = jsonMatch?.[0] ?? content
  const parsed = tryParse(candidate)
  if (!parsed) return null

  if (!(parsed as { title?: unknown }).title || !(parsed as { summary?: unknown }).summary || !(parsed as { content?: unknown }).content) {
    return null
  }

  return normalizeOverviewData({
    title: String((parsed as { title: unknown }).title),
    summary: String((parsed as { summary: unknown }).summary),
    topics: ((parsed as { topics?: unknown[] }).topics || []).map((t: unknown) => String(t)),
    content: String((parsed as { content: unknown }).content),
  })
}

async function generateOverviewData(prompt: string): Promise<{ data: OverviewData; provider: string; model: string }> {
  try {
    const result = await generateWithSchema({
      prompt,
      temperature: 0.3,
      maxTokens: 8192,
      role: 'overview',
      schema: overviewSchema,
      schemaName: 'ConversationOverview',
      maxRetries: 3,
    })

    return {
      data: normalizeOverviewData(result.content),
      provider: result.provider,
      model: result.model,
    }
  } catch (structuredError) {
    const fallbackResult = await generate({
      prompt,
      temperature: 0.4,
      maxTokens: 8192,
      role: 'overview',
      maxRetries: 3,
    })

    const parsed = parseOverviewResponse(fallbackResult.content)
    if (!parsed) {
      throw structuredError instanceof Error ? structuredError : new Error('Failed to parse overview response from AI')
    }

    return {
      data: parsed,
      provider: fallbackResult.provider,
      model: fallbackResult.model,
    }
  }
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
