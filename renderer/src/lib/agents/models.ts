import {
  PROVIDERS,
  PROVIDER_MODELS,
  PROVIDER_PRIORITY,
  PREFERRED_MODELS,
  DEFAULT_MODELS,
  getProvider,
  getProviderModels,
  getAllModels,
  getDefaultModel,
  getPreferredModels,
  getMaxTokens,
  getModelInfo,
  findProviderForModel,
  isProviderSupported,
  parseModelId,
  formatModelId,
  type ProviderId,
  type ModelOption,
  type ProviderConfig,
  type ModelCapability,
  type ModelRole,
} from '@/lib/ai/config'

export type { ProviderId, ModelOption, ProviderConfig, ModelCapability, ModelRole }

export {
  PROVIDERS,
  PROVIDER_MODELS,
  PROVIDER_PRIORITY,
  PREFERRED_MODELS,
  DEFAULT_MODELS,
  getProvider,
  getProviderModels,
  getAllModels,
  getDefaultModel,
  getPreferredModels,
  getMaxTokens,
  getModelInfo,
  findProviderForModel,
  isProviderSupported,
  parseModelId,
  formatModelId,
}

export const providerModelMap = PROVIDER_MODELS
export const providerInfo: Record<ProviderId, { name: string; supported: boolean }> = {
  google: { name: 'Google', supported: true },
  anthropic: { name: 'Anthropic', supported: true },
  openai: { name: 'OpenAI', supported: true },
  openrouter: { name: 'OpenRouter', supported: true },
}

export const getModelsForProvider = getProviderModels
export const getDefaultModelForProvider = (provider: ProviderId): string => getDefaultModel(provider, 'chat')
export const getMaxTokensForModel = getMaxTokens
export const getProviderForModel = findProviderForModel
