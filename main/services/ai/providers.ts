import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'
import { getApiKey, listApiKeys } from '../agent-storage'
import { DEFAULT_MODELS, PROVIDER_PRIORITY, type ProviderId, type ModelRole } from '../ai/models'

export type ProviderInstance = {
  provider: ProviderId
  createModel: (modelId: string) => LanguageModel
}

const providerCache = new Map<ProviderId, ProviderInstance | null>()
let cacheTimestamp = 0
const CACHE_TTL_MS = 5000

function clearCacheIfStale() {
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    providerCache.clear()
    cacheTimestamp = Date.now()
  }
}

export function createProviderInstance(providerId: ProviderId): ProviderInstance | null {
  const apiKey = getApiKey(providerId)
  if (!apiKey?.secret) return null

  switch (providerId) {
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey: apiKey.secret })
      return {
        provider: 'google',
        createModel: (modelId: string) => google(modelId),
      }
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey: apiKey.secret })
      return {
        provider: 'openai',
        createModel: (modelId: string) => openai(modelId),
      }
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey: apiKey.secret })
      return {
        provider: 'anthropic',
        createModel: (modelId: string) => anthropic(modelId),
      }
    }
    case 'openrouter': {
      const openrouter = createOpenAI({
        apiKey: apiKey.secret,
        baseURL: 'https://openrouter.ai/api/v1',
      })
      return {
        provider: 'openrouter',
        createModel: (modelId: string) => openrouter(modelId),
      }
    }
    default:
      return null
  }
}

export function getProvider(providerId: ProviderId): ProviderInstance | null {
  clearCacheIfStale()
  
  if (providerCache.has(providerId)) {
    return providerCache.get(providerId) || null
  }
  
  const instance = createProviderInstance(providerId)
  providerCache.set(providerId, instance)
  return instance
}

export function getAvailableProviders(): ProviderId[] {
  clearCacheIfStale()
  
  const keys = listApiKeys()
  const available = keys
    .map((k) => k.provider as ProviderId)
    .filter((p) => PROVIDER_PRIORITY.includes(p))
  
  return Array.from(new Set(available)).sort(
    (a, b) => PROVIDER_PRIORITY.indexOf(a) - PROVIDER_PRIORITY.indexOf(b)
  )
}

export function getPreferredProvider(): ProviderInstance | null {
  const available = getAvailableProviders()
  
  for (const providerId of available) {
    const instance = getProvider(providerId)
    if (instance) return instance
  }
  
  return null
}

export function getModelForRole(role: ModelRole): { provider: ProviderInstance; modelId: string } | null {
  const available = getAvailableProviders()
  
  for (const providerId of available) {
    const instance = getProvider(providerId)
    if (instance) {
      const modelId = DEFAULT_MODELS[providerId]?.[role]
      if (modelId) {
        return { provider: instance, modelId }
      }
    }
  }
  
  return null
}

export function getSpecificModel(
  providerId: ProviderId,
  modelId: string
): { provider: ProviderInstance; model: LanguageModel } | null {
  const instance = getProvider(providerId)
  if (!instance) return null
  
  return {
    provider: instance,
    model: instance.createModel(modelId),
  }
}

export function invalidateProviderCache() {
  providerCache.clear()
  cacheTimestamp = 0
}

export function hasAnyApiKey(): boolean {
  return getAvailableProviders().length > 0
}

export function hasApiKey(providerId: ProviderId): boolean {
  const apiKey = getApiKey(providerId)
  return Boolean(apiKey?.secret)
}
