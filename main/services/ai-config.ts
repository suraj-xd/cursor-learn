export type ProviderId = 'openai' | 'google' | 'anthropic' | 'openrouter'
export type ModelRole = 'chat' | 'title' | 'compact' | 'summarization'

export const PROVIDER_API_BASES: Record<ProviderId, string> = {
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  anthropic: 'https://api.anthropic.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

export const DEFAULT_MODELS: Record<ProviderId, Record<ModelRole, string>> = {
  openai: {
    chat: 'gpt-4o',
    title: 'gpt-4o-mini',
    compact: 'gpt-4o-mini',
    summarization: 'gpt-4o-mini',
  },
  google: {
    chat: 'gemini-2.0-flash',
    title: 'gemini-2.0-flash-lite',
    compact: 'gemini-2.0-flash-lite',
    summarization: 'gemini-2.0-flash',
  },
  anthropic: {
    chat: 'claude-sonnet-4-20250514',
    title: 'claude-3-5-haiku-20241022',
    compact: 'claude-3-5-haiku-20241022',
    summarization: 'claude-3-5-haiku-20241022',
  },
  openrouter: {
    chat: 'openrouter/auto',
    title: 'openrouter/auto',
    compact: 'openrouter/auto',
    summarization: 'openrouter/auto',
  },
}

export const SUPPORTED_PROVIDERS: ProviderId[] = ['openai', 'google', 'anthropic', 'openrouter']

export function getDefaultModel(provider: ProviderId, role: ModelRole = 'chat'): string {
  return DEFAULT_MODELS[provider]?.[role] ?? 'gpt-4o'
}

export function getApiBase(provider: ProviderId): string {
  return PROVIDER_API_BASES[provider] ?? PROVIDER_API_BASES.openai
}

export function isSupportedProvider(provider: string): provider is ProviderId {
  return SUPPORTED_PROVIDERS.includes(provider as ProviderId)
}

export function parseModelId(fullModelId: string): { provider: ProviderId | null; model: string } {
  if (fullModelId.includes(':')) {
    const [provider, model] = fullModelId.split(':')
    return { provider: provider as ProviderId, model }
  }
  return { provider: null, model: fullModelId }
}

