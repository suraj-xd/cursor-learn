export {
  type ProviderId,
  type ModelRole,
  DEFAULT_MODELS,
  PROVIDER_PRIORITY,
  getDefaultModel,
  parseModelId,
  formatModelId,
} from './ai/models'

export {
  getProvider,
  getAvailableProviders,
  getPreferredProvider,
  getModelForRole,
  hasAnyApiKey,
  hasApiKey,
  invalidateProviderCache,
} from './ai/providers'

export const SUPPORTED_PROVIDERS: string[] = ['openai', 'google', 'anthropic', 'openrouter']

export const PROVIDER_API_BASES: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  anthropic: 'https://api.anthropic.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

export function getApiBase(provider: string): string {
  return PROVIDER_API_BASES[provider] ?? PROVIDER_API_BASES.openai
}

export function isSupportedProvider(provider: string): boolean {
  return SUPPORTED_PROVIDERS.includes(provider)
}

