import { generateText, generateObject, streamText, type CoreMessage } from 'ai'
import { jsonrepair } from 'jsonrepair'
import type { z } from 'zod'
import { getProvider, getAvailableProviders, getModelForRole, type ProviderInstance } from './providers'
import { type ProviderId, type ModelRole, getDefaultModel } from './models'
import { recordUsage, type UsageFeature } from '../agent-storage'

export type GenerateOptions = {
  provider?: ProviderId
  model?: string
  role?: ModelRole
  temperature?: number
  maxTokens?: number
  system?: string
  messages?: CoreMessage[]
  prompt?: string
  feature?: UsageFeature
  chatId?: string
  maxRetries?: number
  retryDelayMs?: number
}

export type TokenUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type GenerateResult<T = string> = {
  content: T
  usage: TokenUsage
  provider: ProviderId
  model: string
}

export type StreamCallback = (chunk: string, done: boolean) => void

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 1000

type GenerateWithSchemaOptions<T> = GenerateOptions & {
  schema: z.ZodType<T>
  schemaName?: string
  fallbackToText?: boolean
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractStructuredFromText<T>(raw: string, schema: z.ZodType<T>): T | null {
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

  const match = raw.match(/\{[\s\S]*\}/)
  const candidate = match?.[0] ?? raw
  const parsed = tryParse(candidate)
  if (!parsed) return null

  const result = schema.safeParse(parsed)
  if (result.success) return result.data

  const repairedParsed = tryParse(raw)
  if (!repairedParsed) return null

  const repairedResult = schema.safeParse(repairedParsed)
  return repairedResult.success ? repairedResult.data : null
}

function resolveProviderAndModel(options: GenerateOptions): { instance: ProviderInstance; modelId: string } | null {
  if (options.provider && options.model) {
    const instance = getProvider(options.provider)
    if (instance) {
      return { instance, modelId: options.model }
    }
  }
  
  if (options.role) {
    const result = getModelForRole(options.role)
    if (result) {
      return { instance: result.provider, modelId: result.modelId }
    }
  }
  
  const availableProviders = getAvailableProviders()
  for (const providerId of availableProviders) {
    const instance = getProvider(providerId)
    if (instance) {
      const modelId = options.model || getDefaultModel(providerId, options.role || 'chat')
      return { instance, modelId }
    }
  }
  
  return null
}

function getFallbackProviders(excludeProvider?: ProviderId): Array<{ instance: ProviderInstance; modelId: string }> {
  const available = getAvailableProviders()
  const fallbacks: Array<{ instance: ProviderInstance; modelId: string }> = []
  
  for (const providerId of available) {
    if (providerId === excludeProvider) continue
    const instance = getProvider(providerId)
    if (instance) {
      fallbacks.push({
        instance,
        modelId: getDefaultModel(providerId, 'chat'),
      })
    }
  }
  
  return fallbacks
}

async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries) {
        onRetry?.(attempt, lastError)
        await sleep(retryDelayMs * attempt)
      }
    }
  }
  
  throw lastError
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const resolved = resolveProviderAndModel(options)
  if (!resolved) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }
  
  const { instance, modelId } = resolved
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  
  const attemptGenerate = async (provider: ProviderInstance, model: string): Promise<GenerateResult> => {
    const baseParams = {
      model: provider.createModel(model),
      system: options.system,
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens,
    }
    
    const result = options.messages
      ? await generateText({ ...baseParams, messages: options.messages })
      : await generateText({ ...baseParams, prompt: options.prompt ?? '' })
    
    const usage: TokenUsage = {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    }
    
    if (options.feature) {
      recordUsage({
        provider: provider.provider,
        model,
        feature: options.feature,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        chatId: options.chatId,
      })
    }
    
    return {
      content: result.text,
      usage,
      provider: provider.provider,
      model,
    }
  }
  
  try {
    return await executeWithRetry(
      () => attemptGenerate(instance, modelId),
      maxRetries,
      retryDelayMs
    )
  } catch (primaryError) {
    const fallbacks = getFallbackProviders(instance.provider)
    
    for (const fallback of fallbacks) {
      try {
        return await executeWithRetry(
          () => attemptGenerate(fallback.instance, fallback.modelId),
          2,
          retryDelayMs
        )
      } catch {
        continue
      }
    }
    
    throw primaryError
  }
}

export async function generateWithSchema<T>(
  options: GenerateWithSchemaOptions<T>
): Promise<GenerateResult<T>> {
  const resolved = resolveProviderAndModel(options)
  if (!resolved) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }
  
  const { instance, modelId } = resolved
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const fallbackToText = options.fallbackToText ?? true
  
  const attemptGenerate = async (provider: ProviderInstance, model: string): Promise<GenerateResult<T>> => {
    const baseParams = {
      model: provider.createModel(model),
      output: 'object' as const,
      schema: options.schema,
      schemaName: options.schemaName,
      system: options.system,
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens,
    }
    
    const result = options.messages
      ? await generateObject({ ...baseParams, messages: options.messages })
      : await generateObject({ ...baseParams, prompt: options.prompt ?? '' })
    
    const usage: TokenUsage = {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    }
    
    if (options.feature) {
      recordUsage({
        provider: provider.provider,
        model,
        feature: options.feature,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        chatId: options.chatId,
      })
    }
    
    return {
      content: result.object as T,
      usage,
      provider: provider.provider,
      model,
    }
  }
  
  const attemptTextFallback = async (provider: ProviderInstance, model: string): Promise<GenerateResult<T> | null> => {
    try {
      const { schema, schemaName: _schemaName, fallbackToText: _fallback, ...rest } = options
      const baseParams = {
        model: provider.createModel(model),
        system: rest.system,
        temperature: rest.temperature ?? 0.3,
        maxOutputTokens: rest.maxTokens,
      }
      
      const textResult = rest.messages
        ? await generateText({ ...baseParams, messages: rest.messages })
        : await generateText({ ...baseParams, prompt: rest.prompt ?? '' })
      
      const structured = extractStructuredFromText(textResult.text, schema)
      if (structured) {
        const usage: TokenUsage = {
          inputTokens: textResult.usage?.inputTokens ?? 0,
          outputTokens: textResult.usage?.outputTokens ?? 0,
          totalTokens: textResult.usage?.totalTokens ?? 0,
        }
        
        if (options.feature) {
          recordUsage({
            provider: provider.provider,
            model,
            feature: options.feature,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            chatId: options.chatId,
          })
        }
        return {
          content: structured,
          usage,
          provider: provider.provider,
          model,
        }
      }
    } catch {
      // Text fallback failed, continue
    }
    return null
  }
  
  try {
    return await executeWithRetry(
      () => attemptGenerate(instance, modelId),
      maxRetries,
      retryDelayMs
    )
  } catch (primaryError) {
    if (fallbackToText) {
      const textFallbackResult = await attemptTextFallback(instance, modelId)
      if (textFallbackResult) {
        return textFallbackResult
      }
    }
    
    const fallbacks = getFallbackProviders(instance.provider)
    
    for (const fallback of fallbacks) {
      try {
        return await executeWithRetry(
          () => attemptGenerate(fallback.instance, fallback.modelId),
          2,
          retryDelayMs
        )
      } catch {
        if (fallbackToText) {
          const textFallbackResult = await attemptTextFallback(fallback.instance, fallback.modelId)
          if (textFallbackResult) {
            return textFallbackResult
          }
        }
        continue
      }
    }

    if (!fallbackToText) {
      throw primaryError
    }

    const { schema, schemaName: _schemaName, fallbackToText: _fallback, ...rest } = options
    const textResult = await generate(rest)

    const structured = extractStructuredFromText(textResult.content as unknown as string, schema)
    if (!structured) {
      const errorMsg = primaryError instanceof Error ? primaryError.message : 'Unknown error'
      throw new Error(`Failed to generate structured output: ${errorMsg}`)
    }

    return {
      content: structured,
      usage: textResult.usage,
      provider: textResult.provider,
      model: textResult.model,
    }
  }
}

export async function generateStream(
  options: GenerateOptions,
  onChunk: StreamCallback
): Promise<GenerateResult> {
  const resolved = resolveProviderAndModel(options)
  if (!resolved) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }
  
  const { instance, modelId } = resolved
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  
  const attemptStream = async (provider: ProviderInstance, model: string): Promise<GenerateResult> => {
    const baseParams = {
      model: provider.createModel(model),
      system: options.system,
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens,
    }
    
    const result = options.messages
      ? streamText({ ...baseParams, messages: options.messages })
      : streamText({ ...baseParams, prompt: options.prompt ?? '' })
    
    let fullContent = ''
    
    for await (const chunk of result.textStream) {
      fullContent += chunk
      onChunk(chunk, false)
    }
    
    onChunk('', true)
    
    const rawUsage = await result.usage
    const usage: TokenUsage = {
      inputTokens: rawUsage?.inputTokens ?? 0,
      outputTokens: rawUsage?.outputTokens ?? 0,
      totalTokens: rawUsage?.totalTokens ?? 0,
    }
    
    if (options.feature) {
      recordUsage({
        provider: provider.provider,
        model,
        feature: options.feature,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        chatId: options.chatId,
      })
    }
    
    return {
      content: fullContent,
      usage,
      provider: provider.provider,
      model,
    }
  }
  
  try {
    return await executeWithRetry(
      () => attemptStream(instance, modelId),
      maxRetries,
      retryDelayMs
    )
  } catch (primaryError) {
    const fallbacks = getFallbackProviders(instance.provider)
    
    for (const fallback of fallbacks) {
      try {
        return await executeWithRetry(
          () => attemptStream(fallback.instance, fallback.modelId),
          2,
          retryDelayMs
        )
      } catch {
        continue
      }
    }
    
    throw primaryError
  }
}

export async function generateForChat(
  chatId: string,
  messages: CoreMessage[],
  options: Omit<GenerateOptions, 'messages' | 'chatId'>
): Promise<GenerateResult> {
  return generate({
    ...options,
    messages,
    chatId,
    feature: options.feature ?? 'chat',
  })
}

export async function generateForChatStream(
  chatId: string,
  messages: CoreMessage[],
  onChunk: StreamCallback,
  options: Omit<GenerateOptions, 'messages' | 'chatId'>
): Promise<GenerateResult> {
  return generateStream(
    {
      ...options,
      messages,
      chatId,
      feature: options.feature ?? 'chat',
    },
    onChunk
  )
}

export function buildMessages(
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string
): CoreMessage[] {
  const messages: CoreMessage[] = []
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  
  for (const msg of history) {
    if (msg.role === 'system' && systemPrompt) continue
    messages.push({ role: msg.role, content: msg.content })
  }
  
  return messages
}
