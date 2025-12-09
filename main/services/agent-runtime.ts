import type { ChatRecord, ContextSummaryRecord, MessageRecord } from './agent-storage'
import {
  getApiKey,
  getChatById,
  insertMessage,
  listMessagesForChat,
  getContextSummary,
  upsertContextSummary,
  updateChatTitle,
  recordUsage,
} from './agent-storage'
import {
  generate,
  generateStream,
  buildMessages,
  type StreamCallback,
  type GenerateOptions,
} from './ai/helpers'
import { getProvider, hasAnyApiKey, getModelForRole } from './ai/providers'
import { parseModelId, getDefaultModel, type ProviderId } from './ai/models'
import { buildTitlePrompt, buildSummarizationPrompt, CHAT_SYSTEM_PROMPT } from './ai/prompts'

type CompletionResult = {
  message: MessageRecord
}

type TitleResult = {
  title: string
}

export { type StreamCallback }

function sanitizeModelId(modelId: string): { provider: ProviderId | null; model: string } {
  if (!modelId) {
    return { provider: null, model: '' }
  }
  return parseModelId(modelId)
}

export async function generateAssistantMessage(chatId: string): Promise<CompletionResult> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  if (!hasAnyApiKey()) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }

  const messages = listMessagesForChat(chatId)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const { provider: providerId, model: modelId } = sanitizeModelId(chat.modelId)
  const provider = providerId ? getProvider(providerId) : null
  
  const coreMessages = buildMessages(
    messages.map((m) => ({ role: m.role, content: m.content }))
  )

  const options: GenerateOptions = {
    messages: coreMessages,
    temperature: 0.4,
    feature: 'chat',
    chatId: chat.id,
    maxRetries: 3,
  }

  if (provider && modelId) {
    options.provider = providerId!
    options.model = modelId
  } else {
    options.role = 'chat'
  }

  const result = await generate(options)

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: result.content,
    metadata: {
      provider: result.provider,
      model: result.model,
    },
    tokenUsage: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
  })

  return { message }
}

export async function generateAssistantMessageStreaming(
  chatId: string,
  onChunk: StreamCallback
): Promise<CompletionResult> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  if (!hasAnyApiKey()) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }

  const messages = listMessagesForChat(chatId)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const { provider: providerId, model: modelId } = sanitizeModelId(chat.modelId)
  const provider = providerId ? getProvider(providerId) : null
  
  const coreMessages = buildMessages(
    messages.map((m) => ({ role: m.role, content: m.content }))
  )

  const options: GenerateOptions = {
    messages: coreMessages,
    temperature: 0.4,
    feature: 'chat',
    chatId: chat.id,
    maxRetries: 3,
  }

  if (provider && modelId) {
    options.provider = providerId!
    options.model = modelId
  } else {
    options.role = 'chat'
  }

  const result = await generateStream(options, onChunk)

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: result.content,
    metadata: {
      provider: result.provider,
      model: result.model,
    },
    tokenUsage: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
  })

  return { message }
}

export type GeminiCompletionOptions = {
  model?: string
  temperature?: number
  maxOutputTokens?: number
  systemInstruction?: string
}

export async function runGeminiPrompt(
  prompt: string,
  options: GeminiCompletionOptions = {}
): Promise<{ content: string; tokenCount: number }> {
  const result = await generate({
    prompt,
    system: options.systemInstruction,
    temperature: options.temperature ?? 0.2,
    maxTokens: options.maxOutputTokens ?? 8192,
    role: 'chat',
    maxRetries: 3,
  })

  return {
    content: result.content,
    tokenCount: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
  }
}

export async function runGeminiPromptStreaming(
  prompt: string,
  onChunk: StreamCallback,
  options: GeminiCompletionOptions = {}
): Promise<{ content: string; tokenCount: number }> {
  const result = await generateStream(
    {
      prompt,
      system: options.systemInstruction,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxOutputTokens ?? 8192,
      role: 'chat',
      maxRetries: 3,
    },
    onChunk
  )

  return {
    content: result.content,
    tokenCount: (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0),
  }
}

export async function generateChatTitle(chatId: string, userMessage: string): Promise<TitleResult> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  if (!hasAnyApiKey()) {
    const fallback = extractTitleFromMessage(userMessage)
    updateChatTitle({ chatId, title: fallback })
    return { title: fallback }
  }

  const prompt = buildTitlePrompt(userMessage)

  try {
    const result = await generate({
      prompt,
      temperature: 0.3,
      maxTokens: 30,
      role: 'title',
      feature: 'title',
      chatId,
      maxRetries: 2,
    })

    let title = result.content.trim()
    title = title.replace(/^["']|["']$/g, '')
    title = title.replace(/\.$/g, '')

    if (!title || title.length > 80) {
      title = extractTitleFromMessage(userMessage)
    }

    updateChatTitle({ chatId, title })
    return { title }
  } catch {
    const fallback = extractTitleFromMessage(userMessage)
    updateChatTitle({ chatId, title: fallback })
    return { title: fallback }
  }
}

function extractTitleFromMessage(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return 'Untitled chat'

  const maxLength = 50
  const sentences = trimmed.split(/[.!?]\s+/)
  const firstSentence = sentences[0] || trimmed

  let title = firstSentence.trim()

  if (title.length > maxLength) {
    title = title.substring(0, maxLength).trim()
    const lastSpace = title.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.6) {
      title = title.substring(0, lastSpace)
    }
    title = title + '...'
  }

  title = title.replace(/^["']|["']$/g, '')

  return title || 'Untitled chat'
}

const SUMMARY_MESSAGE_THRESHOLD = 20
const SUMMARY_TOKEN_THRESHOLD = 100_000
const RECENT_CONTEXT_MESSAGES = 8
const TRUNCATION_SAMPLE_COUNT = 5

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

function formatMessagesToToon(messages: MessageRecord[], title: string): string {
  const lines: string[] = [
    `title: ${title}`,
    `messages[${messages.length}]{role,content}:`,
  ]
  for (const msg of messages) {
    const content = msg.content.replace(/\n/g, '\\n').replace(/,/g, '\\,')
    lines.push(`  ${msg.role},${content}`)
  }
  return lines.join('\n')
}

function buildTruncatedSummary(messages: MessageRecord[], title: string): string {
  if (messages.length <= TRUNCATION_SAMPLE_COUNT * 2) {
    return `[TRUNCATED CHAT: "${title}"]\n${formatMessagesToToon(messages, title)}`
  }

  const head = messages.slice(0, TRUNCATION_SAMPLE_COUNT)
  const tail = messages.slice(-TRUNCATION_SAMPLE_COUNT)

  return [
    `[TRUNCATED CHAT: "${title}" - ${messages.length} messages]`,
    '--- Opening Messages ---',
    formatMessagesToToon(head, title),
    '--- Middle omitted to respect local token budget ---',
    '--- Recent Messages ---',
    formatMessagesToToon(tail, title),
  ].join('\n')
}

export type ChatContext = {
  chatId: string
  title: string
  content: string
  wasSummarized: boolean
  summaryFromCache: boolean
  coveredMessageCount: number
  totalMessages: number
  recentMessageCount: number
  strategy: 'empty' | 'full' | 'summarized' | 'truncated'
  tokenEstimate: number
}

export async function prepareChatContext(chatId: string): Promise<ChatContext> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  const messages = listMessagesForChat(chatId)
  if (messages.length === 0) {
    return {
      chatId,
      title: chat.title,
      content: 'This chat has no messages.',
      wasSummarized: false,
      summaryFromCache: false,
      coveredMessageCount: 0,
      totalMessages: 0,
      recentMessageCount: 0,
      strategy: 'empty',
      tokenEstimate: 0,
    }
  }

  const toonContent = formatMessagesToToon(messages, chat.title)
  const tokenEstimate = estimateTokens(toonContent)
  const needsSummary =
    messages.length > SUMMARY_MESSAGE_THRESHOLD || tokenEstimate > SUMMARY_TOKEN_THRESHOLD

  if (!needsSummary) {
    return {
      chatId,
      title: chat.title,
      content: toonContent,
      wasSummarized: false,
      summaryFromCache: false,
      coveredMessageCount: messages.length,
      totalMessages: messages.length,
      recentMessageCount: messages.length,
      strategy: 'full',
      tokenEstimate,
    }
  }

  const hasApiKeyAvailable = hasAnyApiKey()
  let summaryRecord: ContextSummaryRecord | null = getContextSummary(chatId)
  let summaryGeneratedNow = false

  const latestMessageTimestamp = messages[messages.length - 1]?.createdAt ?? Date.now()
  const currentSummary = summaryRecord
  const uncoveredMessages = currentSummary
    ? messages.filter((msg) => msg.createdAt > currentSummary.coveredUntil)
    : messages

  const shouldRefreshSummary =
    !summaryRecord ||
    (summaryRecord.strategy === 'truncated' && hasApiKeyAvailable) ||
    uncoveredMessages.length > SUMMARY_MESSAGE_THRESHOLD

  if (shouldRefreshSummary) {
    const strategy: ContextSummaryRecord['strategy'] = hasApiKeyAvailable ? 'summarized' : 'truncated'
    const summaryText = hasApiKeyAvailable
      ? await summarizeChat(messages, chat.title)
      : buildTruncatedSummary(messages, chat.title)
    const summaryTokenEstimate = estimateTokens(summaryText)
    summaryRecord = upsertContextSummary({
      chatId,
      summary: summaryText,
      coveredMessageCount: messages.length,
      coveredUntil: latestMessageTimestamp,
      tokenEstimate: summaryTokenEstimate,
      strategy,
    })
    summaryGeneratedNow = true
  }

  if (!summaryRecord) {
    return {
      chatId,
      title: chat.title,
      content: buildTruncatedSummary(messages, chat.title),
      wasSummarized: true,
      summaryFromCache: false,
      coveredMessageCount: messages.length,
      totalMessages: messages.length,
      recentMessageCount: messages.length,
      strategy: 'truncated',
      tokenEstimate: tokenEstimate,
    }
  }

  const trailingMessages = messages
    .filter((msg) => msg.createdAt > summaryRecord.coveredUntil)
    .slice(-RECENT_CONTEXT_MESSAGES)

  const trailingBlock = trailingMessages.length
    ? formatMessagesToToon(trailingMessages, chat.title)
    : ''
  const trailingContent = trailingBlock
    ? `\n\n--- Recent Messages (${trailingMessages.length}) ---\n${trailingBlock}`
    : ''
  const trailingTokens = trailingBlock ? estimateTokens(trailingBlock) : 0
  const combinedTokenEstimate = summaryRecord.tokenEstimate + trailingTokens

  const content = `${summaryRecord.summary}${trailingContent}`

  return {
    chatId,
    title: chat.title,
    content,
    wasSummarized: true,
    summaryFromCache: !summaryGeneratedNow,
    coveredMessageCount: summaryRecord.coveredMessageCount,
    totalMessages: messages.length,
    recentMessageCount: trailingMessages.length,
    strategy: summaryRecord.strategy,
    tokenEstimate: combinedTokenEstimate,
  }
}

async function summarizeChat(
  messages: MessageRecord[],
  title: string
): Promise<string> {
  const conversationText = messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n\n')

  const prompt = buildSummarizationPrompt(title, conversationText)

  try {
    const result = await generate({
      prompt,
      temperature: 0.2,
      maxTokens: 2000,
      role: 'summarization',
      feature: 'summarization',
      maxRetries: 2,
    })

    const summary = result.content.trim()
    
    if (!summary) {
      return `[Summary unavailable - ${messages.length} messages about "${title}"]`
    }

    return `[SUMMARIZED CHAT: "${title}"]\n${summary}`
  } catch {
    return `[Summary unavailable - ${messages.length} messages about "${title}"]`
  }
}
