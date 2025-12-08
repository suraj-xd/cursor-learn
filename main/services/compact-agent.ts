import { randomUUID } from 'node:crypto'
import { generate, type StreamCallback } from './ai/helpers'
import {
  buildCompactMapPrompt,
  buildCompactReducePrompt,
  buildCompactFullContextPrompt,
  buildSuggestionsPrompt,
} from './ai/prompts'
import {
  createCompactedChat,
  createCompactSession,
  updateCompactSession,
  appendCompactSessionLog,
  getCompactedChatByConversation,
  getActiveCompactSession,
  getCompactSession,
  type CompactStrategy,
  type CompactStep,
  type CompactSessionLog,
  type CompactedChatRecord,
  type CompactSessionRecord,
} from './agent-storage'

const TOKENS_PER_CHAR = 3.5
const CHUNK_TARGET_TOKENS = 8000
const FULL_CONTEXT_THRESHOLD = 100_000
const CHUNKED_PARALLEL_THRESHOLD = 500_000

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

type ChunkInfo = {
  index: number
  startBubble: number
  endBubble: number
  content: string
  tokenEstimate: number
}

type ProcessingResult = {
  compactedChat: CompactedChatRecord
  session: CompactSessionRecord
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKENS_PER_CHAR)
}

function formatBubblesAsText(bubbles: ConversationBubble[]): string {
  return bubbles
    .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
    .join('\n\n')
}

function selectStrategy(tokenCount: number): CompactStrategy {
  if (tokenCount < FULL_CONTEXT_THRESHOLD) {
    return 'full_context'
  }
  if (tokenCount < CHUNKED_PARALLEL_THRESHOLD) {
    return 'chunked_parallel'
  }
  return 'hierarchical'
}

function findCodeBlockBoundaries(text: string): { start: number; end: number }[] {
  const boundaries: { start: number; end: number }[] = []
  const regex = /```[\s\S]*?```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    boundaries.push({ start: match.index, end: match.index + match[0].length })
  }
  return boundaries
}

function chunkConversation(bubbles: ConversationBubble[]): ChunkInfo[] {
  const chunks: ChunkInfo[] = []
  let currentChunk: ConversationBubble[] = []
  let currentStartIndex = 0
  let currentTokens = 0

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i]
    const bubbleText = `[${bubble.type.toUpperCase()}]: ${bubble.text}\n\n`
    const bubbleTokens = estimateTokens(bubbleText)

    const codeBlocks = findCodeBlockBoundaries(bubble.text)
    const hasCodeBlock = codeBlocks.length > 0

    if (currentTokens + bubbleTokens > CHUNK_TARGET_TOKENS && currentChunk.length > 0) {
      if (hasCodeBlock && currentTokens < CHUNK_TARGET_TOKENS * 1.5) {
        currentChunk.push(bubble)
        currentTokens += bubbleTokens
      } else {
        chunks.push({
          index: chunks.length,
          startBubble: currentStartIndex,
          endBubble: i - 1,
          content: formatBubblesAsText(currentChunk),
          tokenEstimate: currentTokens,
        })
        currentChunk = [bubble]
        currentStartIndex = i
        currentTokens = bubbleTokens
      }
    } else {
      currentChunk.push(bubble)
      currentTokens += bubbleTokens
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      index: chunks.length,
      startBubble: currentStartIndex,
      endBubble: bubbles.length - 1,
      content: formatBubblesAsText(currentChunk),
      tokenEstimate: currentTokens,
    })
  }

  return chunks
}

function createLog(
  level: CompactSessionLog['level'],
  message: string,
  data?: unknown
): CompactSessionLog {
  return { timestamp: Date.now(), level, message, data }
}

async function processFullContext(
  sessionId: string,
  conversation: ConversationInput,
  onProgress?: (session: CompactSessionRecord) => void
): Promise<string> {
  appendCompactSessionLog(sessionId, createLog('info', 'Processing with full context strategy'))

  const conversationText = formatBubblesAsText(conversation.bubbles)
  const prompt = buildCompactFullContextPrompt(conversation.title, conversationText)

  updateCompactSession({ id: sessionId, currentStep: 'finalizing', progress: 50 })
  const session = getCompactSession(sessionId)
  if (session && onProgress) onProgress(session)

  appendCompactSessionLog(sessionId, createLog('info', 'Sending to AI for summarization'))

  const result = await generate({
    prompt,
    temperature: 0.2,
    maxTokens: 16384,
    role: 'compact',
    maxRetries: 3,
  })

  appendCompactSessionLog(sessionId, createLog('info', `Received summary from ${result.provider}`))

  return result.content
}

async function processChunkedParallel(
  sessionId: string,
  conversation: ConversationInput,
  chunks: ChunkInfo[],
  onProgress?: (session: CompactSessionRecord) => void
): Promise<string> {
  appendCompactSessionLog(
    sessionId,
    createLog('info', `Processing with chunked parallel strategy (${chunks.length} chunks)`)
  )

  updateCompactSession({
    id: sessionId,
    currentStep: 'mapping',
    chunksTotal: chunks.length,
    chunksProcessed: 0,
  })

  const chunkSummaries: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const chunkPrompt = buildCompactMapPrompt(
      conversation.title,
      i + 1,
      chunks.length,
      chunk.content
    )

    appendCompactSessionLog(
      sessionId,
      createLog('debug', `Processing chunk ${i + 1}/${chunks.length}`, {
        tokens: chunk.tokenEstimate,
      })
    )

    const result = await generate({
      prompt: chunkPrompt,
      temperature: 0.2,
      maxTokens: 4096,
      role: 'compact',
      maxRetries: 3,
    })

    chunkSummaries.push(`### Segment ${i + 1}\n${result.content}`)

    const progress = Math.round(((i + 1) / chunks.length) * 70) + 10
    updateCompactSession({ id: sessionId, chunksProcessed: i + 1, progress })
    const session = getCompactSession(sessionId)
    if (session && onProgress) onProgress(session)
  }

  appendCompactSessionLog(sessionId, createLog('info', 'All chunks processed, starting reduce phase'))
  updateCompactSession({ id: sessionId, currentStep: 'reducing', progress: 80 })

  const reducePrompt = buildCompactReducePrompt(conversation.title, chunkSummaries.join('\n\n---\n\n'))

  const result = await generate({
    prompt: reducePrompt,
    temperature: 0.2,
    maxTokens: 16384,
    role: 'compact',
    maxRetries: 3,
  })

  appendCompactSessionLog(sessionId, createLog('info', 'Reduce phase complete'))

  return result.content
}

async function processHierarchical(
  sessionId: string,
  conversation: ConversationInput,
  chunks: ChunkInfo[],
  onProgress?: (session: CompactSessionRecord) => void
): Promise<string> {
  appendCompactSessionLog(
    sessionId,
    createLog('info', `Processing with hierarchical strategy (${chunks.length} chunks)`)
  )

  const chunkSummaries = await processChunkedParallel(sessionId, conversation, chunks, onProgress)

  if (estimateTokens(chunkSummaries) > FULL_CONTEXT_THRESHOLD) {
    appendCompactSessionLog(sessionId, createLog('info', 'Summary still large, performing second pass'))

    const secondPassChunks = chunkConversation([
      { type: 'ai', text: chunkSummaries },
    ])

    if (secondPassChunks.length > 1) {
      return processChunkedParallel(sessionId, conversation, secondPassChunks, onProgress)
    }
  }

  return chunkSummaries
}

export async function startCompactSession(
  conversation: ConversationInput,
  onProgress?: (session: CompactSessionRecord) => void
): Promise<ProcessingResult> {
  const existingSession = getActiveCompactSession(conversation.workspaceId, conversation.conversationId)
  if (existingSession) {
    throw new Error('A compact session is already in progress for this conversation')
  }

  const session = createCompactSession({
    workspaceId: conversation.workspaceId,
    conversationId: conversation.conversationId,
  })

  const startTime = Date.now()

  try {
    updateCompactSession({ id: session.id, status: 'processing', currentStep: 'analyzing' })
    appendCompactSessionLog(session.id, createLog('info', 'Starting compact session'))

    const conversationText = formatBubblesAsText(conversation.bubbles)
    const totalTokens = estimateTokens(conversationText)

    appendCompactSessionLog(
      session.id,
      createLog('info', `Analyzed conversation: ${conversation.bubbles.length} messages, ~${totalTokens} tokens`)
    )

    const strategy = selectStrategy(totalTokens)
    appendCompactSessionLog(session.id, createLog('info', `Selected strategy: ${strategy}`))

    updateCompactSession({ id: session.id, currentStep: 'chunking', progress: 10 })
    if (onProgress) {
      const s = getCompactSession(session.id)
      if (s) onProgress(s)
    }

    let compactedContent: string
    let chunkCount = 1
    let modelUsed = 'ai-sdk'

    if (strategy === 'full_context') {
      compactedContent = await processFullContext(session.id, conversation, onProgress)
    } else {
      const chunks = chunkConversation(conversation.bubbles)
      chunkCount = chunks.length

      appendCompactSessionLog(
        session.id,
        createLog('info', `Created ${chunks.length} chunks`, {
          chunks: chunks.map((c) => ({ index: c.index, tokens: c.tokenEstimate })),
        })
      )

      if (strategy === 'chunked_parallel') {
        compactedContent = await processChunkedParallel(session.id, conversation, chunks, onProgress)
      } else {
        compactedContent = await processHierarchical(session.id, conversation, chunks, onProgress)
      }
    }

    updateCompactSession({ id: session.id, currentStep: 'finalizing', progress: 95 })

    const compactedTokens = estimateTokens(compactedContent)
    const compressionRatio = totalTokens > 0 ? compactedTokens / totalTokens : 1
    const processingTime = Date.now() - startTime

    const compactedChat = createCompactedChat({
      workspaceId: conversation.workspaceId,
      conversationId: conversation.conversationId,
      conversationTitle: conversation.title,
      compactedContent,
      originalTokenCount: totalTokens,
      compactedTokenCount: compactedTokens,
      compressionRatio,
      modelUsed,
      strategyUsed: strategy,
      chunkCount,
      metadata: {
        processingTimeMs: processingTime,
        bubbleCount: conversation.bubbles.length,
      },
    })

    appendCompactSessionLog(
      session.id,
      createLog('info', 'Compaction complete', {
        originalTokens: totalTokens,
        compactedTokens,
        compressionRatio: compressionRatio.toFixed(2),
        processingTimeMs: processingTime,
      })
    )

    const updatedSession = updateCompactSession({
      id: session.id,
      status: 'completed',
      progress: 100,
      compactedChatId: compactedChat.id,
    })

    return {
      compactedChat,
      session: updatedSession || session,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    appendCompactSessionLog(session.id, createLog('error', `Compaction failed: ${errorMessage}`))

    updateCompactSession({
      id: session.id,
      status: 'failed',
      error: errorMessage,
    })

    throw error
  }
}

export async function cancelCompactSession(sessionId: string): Promise<CompactSessionRecord | null> {
  const session = getCompactSession(sessionId)
  if (!session) return null

  if (session.status !== 'pending' && session.status !== 'processing') {
    return session
  }

  appendCompactSessionLog(sessionId, createLog('info', 'Session cancelled by user'))

  return updateCompactSession({
    id: sessionId,
    status: 'cancelled',
  })
}

export function getCompactedChatForConversation(
  workspaceId: string,
  conversationId: string
): CompactedChatRecord | null {
  return getCompactedChatByConversation(workspaceId, conversationId)
}

export function getSessionStatus(sessionId: string): CompactSessionRecord | null {
  return getCompactSession(sessionId)
}

export function getActiveSession(
  workspaceId: string,
  conversationId: string
): CompactSessionRecord | null {
  return getActiveCompactSession(workspaceId, conversationId)
}

export type SuggestedQuestion = {
  question: string
  icon: 'code' | 'lightbulb' | 'puzzle' | 'book' | 'rocket' | 'target'
}

export async function generateSuggestedQuestions(
  compactedContent: string
): Promise<SuggestedQuestion[]> {
  try {
    const prompt = buildSuggestionsPrompt(compactedContent)

    const result = await generate({
      prompt,
      temperature: 0.7,
      maxTokens: 1024,
      role: 'chat',
      maxRetries: 2,
    })

    const jsonMatch = result.content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return []
    }

    const parsed = JSON.parse(jsonMatch[0]) as SuggestedQuestion[]
    return parsed.slice(0, 5)
  } catch (error) {
    console.error('Failed to generate suggested questions:', error)
    return []
  }
}

export { type ConversationInput, type ProcessingResult }
