import type { ChatRecord, ContextSummaryRecord, MessageRecord } from './agent-storage'
import {
  getApiKey,
  getChatById,
  insertMessage,
  listMessagesForChat,
  getContextSummary,
  upsertContextSummary,
  updateChatTitle,
} from './agent-storage'

type CompletionResult = {
  message: MessageRecord
}

type TitleResult = {
  title: string
}

const TITLE_MODEL = 'gpt-4o-mini'

const SUPPORTED_PROVIDERS = ['openai', 'google', 'anthropic'] as const

const isSupportedProvider = (provider: string): provider is (typeof SUPPORTED_PROVIDERS)[number] => {
  return SUPPORTED_PROVIDERS.includes(provider as (typeof SUPPORTED_PROVIDERS)[number])
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

export async function generateAssistantMessage(chatId: string): Promise<CompletionResult> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  if (!isSupportedProvider(chat.provider)) {
    throw new Error(`Provider "${chat.provider}" is not supported yet`)
  }

  if (chat.provider === 'openai') {
    return runOpenAICompletion(chat)
  }

  if (chat.provider === 'google') {
    return runGeminiCompletion(chat)
  }

  if (chat.provider === 'anthropic') {
    return runAnthropicCompletion(chat)
  }

  throw new Error('No provider handler found')
}

function mapMessagesForProvider(messages: MessageRecord[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

async function runOpenAICompletion(chat: ChatRecord): Promise<CompletionResult> {
  const keyRecord = getApiKey('openai')
  if (!keyRecord?.secret) {
    throw new Error('Missing OpenAI API key')
  }

  const messages = listMessagesForChat(chat.id)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const modelId = sanitizeModelId(chat.modelId) || 'gpt-4o-mini'

  const payload = {
    model: modelId,
    messages: mapMessagesForProvider(messages),
    temperature: 0.4,
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keyRecord.secret}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`OpenAI error: ${errorMessage}`)
  }

  const data = await response.json()
  const completion = data?.choices?.[0]?.message?.content?.trim()

  if (!completion) {
    throw new Error('OpenAI returned an empty response')
  }

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: completion,
    metadata: {
      provider: 'openai',
      model: payload.model,
    },
    tokenUsage: data?.usage?.total_tokens || 0,
  })

  return { message }
}

export type StreamCallback = (chunk: string, done: boolean) => void

export async function generateAssistantMessageStreaming(
  chatId: string,
  onChunk: StreamCallback
): Promise<CompletionResult> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  if (!isSupportedProvider(chat.provider)) {
    throw new Error(`Provider "${chat.provider}" is not supported yet`)
  }

  if (chat.provider === 'openai') {
    return runOpenAICompletionStreaming(chat, onChunk)
  }

  if (chat.provider === 'google') {
    return runGeminiCompletionStreaming(chat, onChunk)
  }

  if (chat.provider === 'anthropic') {
    return runAnthropicCompletionStreaming(chat, onChunk)
  }

  throw new Error('No provider handler found')
}

async function runOpenAICompletionStreaming(
  chat: ChatRecord,
  onChunk: StreamCallback
): Promise<CompletionResult> {
  const keyRecord = getApiKey('openai')
  if (!keyRecord?.secret) {
    throw new Error('Missing OpenAI API key')
  }

  const messages = listMessagesForChat(chat.id)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const modelId = sanitizeModelId(chat.modelId) || 'gpt-4o-mini'

  const payload = {
    model: modelId,
    messages: mapMessagesForProvider(messages),
    temperature: 0.4,
    stream: true,
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keyRecord.secret}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`OpenAI error: ${errorMessage}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter((line) => line.trim() !== '')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          onChunk('', true)
          continue
        }

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            onChunk(content, false)
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }
  }

  onChunk('', true)

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: fullContent.trim(),
    metadata: {
      provider: 'openai',
      model: payload.model,
    },
    tokenUsage: 0,
  })

  return { message }
}

function mapMessagesForGemini(messages: MessageRecord[]) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))
}

async function runGeminiCompletion(chat: ChatRecord): Promise<CompletionResult> {
  const keyRecord = getApiKey('google')
  if (!keyRecord?.secret) {
    throw new Error('Missing Google API key')
  }

  const messages = listMessagesForChat(chat.id)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const modelId = sanitizeModelId(chat.modelId) || DEFAULT_GEMINI_MODEL

  const payload = {
    contents: mapMessagesForGemini(messages),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
    },
  }

  const url = `${GEMINI_API_BASE}/models/${modelId}:generateContent?key=${keyRecord.secret}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`Gemini error: ${errorMessage}`)
  }

  const data = await response.json()
  const completion = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

  if (!completion) {
    throw new Error('Gemini returned an empty response')
  }

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: completion,
    metadata: {
      provider: 'google',
      model: modelId,
    },
    tokenUsage: data?.usageMetadata?.totalTokenCount || 0,
  })

  return { message }
}

async function runGeminiCompletionStreaming(
  chat: ChatRecord,
  onChunk: StreamCallback
): Promise<CompletionResult> {
  const keyRecord = getApiKey('google')
  if (!keyRecord?.secret) {
    throw new Error('Missing Google API key')
  }

  const messages = listMessagesForChat(chat.id)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const modelId = sanitizeModelId(chat.modelId) || DEFAULT_GEMINI_MODEL

  const payload = {
    contents: mapMessagesForGemini(messages),
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
    },
  }

  const url = `${GEMINI_API_BASE}/models/${modelId}:streamGenerateContent?alt=sse&key=${keyRecord.secret}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`Gemini error: ${errorMessage}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter((line) => line.trim() !== '')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          const parsed = JSON.parse(data)
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (content) {
            fullContent += content
            onChunk(content, false)
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }
  }

  onChunk('', true)

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: fullContent.trim(),
    metadata: {
      provider: 'google',
      model: modelId,
    },
    tokenUsage: 0,
  })

  return { message }
}

function mapMessagesForAnthropic(messages: MessageRecord[]) {
  return messages
    .filter((msg) => msg.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }))
}

function getSystemPromptFromMessages(messages: MessageRecord[]): string | undefined {
  const systemMsg = messages.find((m) => m.role === 'system')
  return systemMsg?.content
}

async function runAnthropicCompletion(chat: ChatRecord): Promise<CompletionResult> {
  const keyRecord = getApiKey('anthropic')
  if (!keyRecord?.secret) {
    throw new Error('Missing Anthropic API key')
  }

  const messages = listMessagesForChat(chat.id)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const modelId = sanitizeModelId(chat.modelId) || DEFAULT_ANTHROPIC_MODEL
  const systemPrompt = getSystemPromptFromMessages(messages)

  const payload: Record<string, unknown> = {
    model: modelId,
    messages: mapMessagesForAnthropic(messages),
    max_tokens: 8192,
    temperature: 0.4,
  }

  if (systemPrompt) {
    payload.system = systemPrompt
  }

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': keyRecord.secret,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`Anthropic error: ${errorMessage}`)
  }

  const data = await response.json()
  const completion = data?.content?.[0]?.text?.trim()

  if (!completion) {
    throw new Error('Anthropic returned an empty response')
  }

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: completion,
    metadata: {
      provider: 'anthropic',
      model: modelId,
    },
    tokenUsage: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
  })

  return { message }
}

async function runAnthropicCompletionStreaming(
  chat: ChatRecord,
  onChunk: StreamCallback
): Promise<CompletionResult> {
  const keyRecord = getApiKey('anthropic')
  if (!keyRecord?.secret) {
    throw new Error('Missing Anthropic API key')
  }

  const messages = listMessagesForChat(chat.id)
  if (messages.length === 0) {
    throw new Error('Conversation is empty')
  }

  const modelId = sanitizeModelId(chat.modelId) || DEFAULT_ANTHROPIC_MODEL
  const systemPrompt = getSystemPromptFromMessages(messages)

  const payload: Record<string, unknown> = {
    model: modelId,
    messages: mapMessagesForAnthropic(messages),
    max_tokens: 8192,
    temperature: 0.4,
    stream: true,
  }

  if (systemPrompt) {
    payload.system = systemPrompt
  }

  const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': keyRecord.secret,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`Anthropic error: ${errorMessage}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter((line) => line.trim() !== '')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const content = parsed.delta.text
            fullContent += content
            onChunk(content, false)
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }
  }

  onChunk('', true)

  const message = insertMessage({
    chatId: chat.id,
    role: 'assistant',
    content: fullContent.trim(),
    metadata: {
      provider: 'anthropic',
      model: modelId,
    },
    tokenUsage: 0,
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
  const keyRecord = getApiKey('google')
  if (!keyRecord?.secret) {
    throw new Error('Missing Google API key')
  }

  const model = options.model || DEFAULT_GEMINI_MODEL
  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  }

  if (options.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: options.systemInstruction }] }
  }

  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${keyRecord.secret}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`Gemini error: ${errorMessage}`)
  }

  const data = await response.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  const tokenCount = data?.usageMetadata?.totalTokenCount || 0

  return { content, tokenCount }
}

export async function runGeminiPromptStreaming(
  prompt: string,
  onChunk: StreamCallback,
  options: GeminiCompletionOptions = {}
): Promise<{ content: string; tokenCount: number }> {
  const keyRecord = getApiKey('google')
  if (!keyRecord?.secret) {
    throw new Error('Missing Google API key')
  }

  const model = options.model || DEFAULT_GEMINI_MODEL
  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  }

  if (options.systemInstruction) {
    payload.systemInstruction = { parts: [{ text: options.systemInstruction }] }
  }

  const url = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${keyRecord.secret}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await safeJson(response)
    const errorMessage = errorBody?.error?.message || response.statusText
    throw new Error(`Gemini error: ${errorMessage}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter((line) => line.trim() !== '')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        try {
          const parsed = JSON.parse(data)
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (content) {
            fullContent += content
            onChunk(content, false)
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }
  }

  onChunk('', true)

  return { content: fullContent.trim(), tokenCount: 0 }
}

async function safeJson(response: Response): Promise<any | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function sanitizeModelId(modelId: string) {
  if (!modelId) {
    return null
  }
  if (modelId.includes(':')) {
    const [, raw] = modelId.split(':')
    return raw ?? modelId
  }
  return modelId
}

export async function generateChatTitle(chatId: string, userMessage: string): Promise<TitleResult> {
  const chat = getChatById(chatId)
  if (!chat) {
    throw new Error('Chat not found')
  }

  const keyRecord = getApiKey('openai')
  if (!keyRecord?.secret) {
    const fallback = extractTitleFromMessage(userMessage)
    updateChatTitle({ chatId, title: fallback })
    return { title: fallback }
  }

  const prompt = `Generate a very short title (max 6 words) for a chat that starts with this message. Return ONLY the title, no quotes, no explanation.

Message: "${userMessage.slice(0, 500)}"`

  const payload = {
    model: TITLE_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 30,
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keyRecord.secret}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const fallback = extractTitleFromMessage(userMessage)
      updateChatTitle({ chatId, title: fallback })
      return { title: fallback }
    }

    const data = await response.json()
    let title = data?.choices?.[0]?.message?.content?.trim() || ''
    
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

const SUMMARIZER_MODEL = 'gpt-4o-mini'
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

  const keyRecord = getApiKey('openai')
  let summaryRecord: ContextSummaryRecord | null = getContextSummary(chatId)
  let summaryGeneratedNow = false

  const latestMessageTimestamp = messages[messages.length - 1]?.createdAt ?? Date.now()
  const uncoveredMessages = summaryRecord
    ? messages.filter((msg) => msg.createdAt > summaryRecord.coveredUntil)
    : messages

  const shouldRefreshSummary =
    !summaryRecord ||
    (summaryRecord.strategy === 'truncated' && Boolean(keyRecord?.secret)) ||
    uncoveredMessages.length > SUMMARY_MESSAGE_THRESHOLD

  if (shouldRefreshSummary) {
    const strategy: ContextSummaryRecord['strategy'] = keyRecord?.secret ? 'summarized' : 'truncated'
    const summaryText = keyRecord?.secret
      ? await summarizeChat(messages, chat.title, keyRecord.secret)
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
  title: string,
  apiKey: string
): Promise<string> {
  const conversationText = messages
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n\n')

  const prompt = `Summarize this AI chat conversation comprehensively. Preserve all important details, decisions, code snippets, and context. The summary will be used as context for another conversation.

Chat Title: "${title}"

Conversation:
${conversationText.slice(0, 12000)}

Provide a structured summary that includes:
1. Main topic/goal of the conversation
2. Key decisions made
3. Important code or technical details (preserve exact snippets if any)
4. Current state/progress
5. Any unresolved questions`

  const payload = {
    model: SUMMARIZER_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 2000,
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return `[Summary unavailable - ${messages.length} messages about "${title}"]`
    }

    const data = await response.json()
    const summary = data?.choices?.[0]?.message?.content?.trim()
    
    if (!summary) {
      return `[Summary unavailable - ${messages.length} messages about "${title}"]`
    }

    return `[SUMMARIZED CHAT: "${title}"]\n${summary}`
  } catch {
    return `[Summary unavailable - ${messages.length} messages about "${title}"]`
  }
}

