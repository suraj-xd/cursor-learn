import { randomUUID } from 'node:crypto'
import { runGeminiPrompt, runGeminiPromptStreaming, type StreamCallback } from './agent-runtime'
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

const DEFAULT_MODEL = 'gemini-2.0-flash'
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

function isInsideCodeBlock(position: number, boundaries: { start: number; end: number }[]): boolean {
  return boundaries.some((b) => position >= b.start && position < b.end)
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

const MAP_PROMPT = `You are analyzing a segment of a coding conversation between a user and an AI assistant.

Extract and preserve the following information in a structured format:

## GOALS
What is the user trying to achieve in this segment?

## CONTEXT
- Files, technologies, and setup mentioned
- Any imports, dependencies, or configurations

## CODE
Preserve ALL code snippets exactly as written. Do not summarize or paraphrase any code.
Format each code block with its language and purpose:

\`\`\`language
// Purpose: description
code here
\`\`\`

## DECISIONS
Technical choices made and their rationale

## PROBLEMS & SOLUTIONS
Issues encountered and how they were resolved

## STATE
Current progress at the end of this segment

---
CONVERSATION SEGMENT:
`

const REDUCE_PROMPT = `You are combining multiple summaries of a coding conversation into one comprehensive report.

Maintain chronological flow and preserve ALL:
- Code snippets (keep exact formatting, never paraphrase code)
- Technical decisions with rationale
- Problem-solution pairs
- File/function references

Create a single comprehensive report with this structure:

# Conversation Summary

## Overview
2-3 sentences summarizing the entire conversation

## Goals & Objectives
What the user was trying to achieve

## Technical Context
- Files involved
- Technologies/stack used
- Setup and configuration

## Development Progress
Chronological summary of what was accomplished

## Code Artifacts
ALL significant code from the conversation, preserved exactly

## Decisions & Rationale
Key technical choices and why they were made

## Problems & Solutions
Issues encountered and their resolutions

## Current State & Next Steps
Where things stand and what remains to be done

---
SEGMENT SUMMARIES TO COMBINE:
`

const FULL_CONTEXT_PROMPT = `You are creating a comprehensive summary of a coding conversation between a user and an AI assistant.

Preserve ALL:
- Code snippets exactly as written (never paraphrase code)
- Technical decisions with rationale
- Problem-solution pairs
- File/function references

Create a comprehensive report with this structure:

# Conversation Summary

## Overview
2-3 sentences summarizing the entire conversation

## Goals & Objectives
What the user was trying to achieve

## Technical Context
- Files involved
- Technologies/stack used
- Setup and configuration

## Development Progress
Chronological summary of what was accomplished

## Code Artifacts
ALL significant code from the conversation, preserved exactly

## Decisions & Rationale
Key technical choices and why they were made

## Problems & Solutions
Issues encountered and their resolutions

## Current State & Next Steps
Where things stand and what remains to be done

---
CONVERSATION:
`

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
  const prompt = `${FULL_CONTEXT_PROMPT}\nTitle: "${conversation.title}"\n\n${conversationText}`

  updateCompactSession({ id: sessionId, currentStep: 'finalizing', progress: 50 })
  const session = getCompactSession(sessionId)
  if (session && onProgress) onProgress(session)

  appendCompactSessionLog(sessionId, createLog('info', 'Sending to Gemini for summarization'))

  const { content } = await runGeminiPrompt(prompt, {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 16384,
  })

  appendCompactSessionLog(sessionId, createLog('info', 'Received summary from Gemini'))

  return content
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
    const chunkPrompt = `${MAP_PROMPT}\nConversation Title: "${conversation.title}"\nSegment ${i + 1} of ${chunks.length} (messages ${chunk.startBubble + 1}-${chunk.endBubble + 1})\n\n${chunk.content}`

    appendCompactSessionLog(
      sessionId,
      createLog('debug', `Processing chunk ${i + 1}/${chunks.length}`, {
        tokens: chunk.tokenEstimate,
      })
    )

    const { content } = await runGeminiPrompt(chunkPrompt, {
      model: DEFAULT_MODEL,
      temperature: 0.2,
      maxOutputTokens: 4096,
    })

    chunkSummaries.push(`### Segment ${i + 1}\n${content}`)

    const progress = Math.round(((i + 1) / chunks.length) * 70) + 10
    updateCompactSession({ id: sessionId, chunksProcessed: i + 1, progress })
    const session = getCompactSession(sessionId)
    if (session && onProgress) onProgress(session)
  }

  appendCompactSessionLog(sessionId, createLog('info', 'All chunks processed, starting reduce phase'))
  updateCompactSession({ id: sessionId, currentStep: 'reducing', progress: 80 })

  const reducePrompt = `${REDUCE_PROMPT}\nOriginal Title: "${conversation.title}"\n\n${chunkSummaries.join('\n\n---\n\n')}`

  const { content: finalSummary } = await runGeminiPrompt(reducePrompt, {
    model: DEFAULT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 16384,
  })

  appendCompactSessionLog(sessionId, createLog('info', 'Reduce phase complete'))

  return finalSummary
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
      modelUsed: DEFAULT_MODEL,
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

const SUGGESTIONS_PROMPT = `Generate 4-5 SHORT, punchy questions about this coding conversation.

Rules:
- MAX 10-15 words per question
- Be curious, direct, slightly unhinged
- Focus on the juicy tech stuff: architecture, patterns, gotchas, trade-offs
- Questions should make the user go "ooh, good question"
- No boring generic questions

Return ONLY a JSON array with "question" and "icon" fields.
Icons: "code", "lightbulb", "puzzle", "book", "rocket", "target"

Good examples:
[
  {"question": "Why not just use Redux here?", "icon": "puzzle"},
  {"question": "What breaks if we remove that useEffect?", "icon": "code"},
  {"question": "Is this pattern overkill for the use case?", "icon": "lightbulb"},
  {"question": "What's the worst edge case hiding here?", "icon": "target"}
]

---
CONVERSATION SUMMARY:
`

export type SuggestedQuestion = {
  question: string
  icon: 'code' | 'lightbulb' | 'puzzle' | 'book' | 'rocket' | 'target'
}

export async function generateSuggestedQuestions(
  compactedContent: string
): Promise<SuggestedQuestion[]> {
  try {
    const prompt = `${SUGGESTIONS_PROMPT}${compactedContent}`

    const { content } = await runGeminiPrompt(prompt, {
      model: DEFAULT_MODEL,
      temperature: 0.7,
      maxOutputTokens: 1024,
    })

    const jsonMatch = content.match(/\[[\s\S]*\]/)
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

