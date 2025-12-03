import type { ProviderId } from '@/types/agents'

export type ModelOption = {
  id: string
  label: string
  description: string
  maxTokens: number
  isNew?: boolean
}

const openAIModels: ModelOption[] = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Flagship multimodal model with vision and advanced reasoning.',
    maxTokens: 128000,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Fast, affordable GPT-4o variant for everyday tasks.',
    maxTokens: 128000,
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Improved coding and long-context comprehension.',
    maxTokens: 1047576,
    isNew: true,
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    description: 'Fast and efficient version of GPT-4.1.',
    maxTokens: 1047576,
    isNew: true,
  },
  {
    id: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    description: 'Lightweight model optimized for speed.',
    maxTokens: 1047576,
    isNew: true,
  },
  {
    id: 'o1',
    label: 'o1',
    description: 'Advanced reasoning model for complex problem-solving.',
    maxTokens: 200000,
  },
  {
    id: 'o1-mini',
    label: 'o1 Mini',
    description: 'Fast reasoning model optimized for speed.',
    maxTokens: 128000,
  },
  {
    id: 'o1-pro',
    label: 'o1 Pro',
    description: 'Enhanced reasoning with extended thinking time.',
    maxTokens: 200000,
  },
  {
    id: 'o3-mini',
    label: 'o3 Mini',
    description: 'Next-gen reasoning model with improved efficiency.',
    maxTokens: 200000,
    isNew: true,
  },
  {
    id: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'High performance model with 128K context window.',
    maxTokens: 128000,
  },
]

const googleModels: ModelOption[] = [
  {
    id: 'gemini-2.5-pro-preview-05-06',
    label: 'Gemini 2.5 Pro',
    description: 'Most advanced Gemini model with superior reasoning.',
    maxTokens: 1048576,
    isNew: true,
  },
  {
    id: 'gemini-2.5-flash-preview-05-20',
    label: 'Gemini 2.5 Flash',
    description: 'Fast and efficient with excellent performance.',
    maxTokens: 1048576,
    isNew: true,
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Multimodal model with native tool use and code execution.',
    maxTokens: 1048576,
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    description: 'Lightweight version optimized for cost.',
    maxTokens: 1048576,
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'High quality responses with 1M token context.',
    maxTokens: 1048576,
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    description: 'Fast model for quick responses.',
    maxTokens: 1048576,
  },
]

const claudeModels: ModelOption[] = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    description: 'Latest balanced model with excellent reasoning and coding.',
    maxTokens: 200000,
    isNew: true,
  },
  {
    id: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    description: 'Most capable model for complex, multi-step tasks.',
    maxTokens: 200000,
    isNew: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    description: 'Balanced flagship model with excellent reasoning.',
    maxTokens: 200000,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    description: 'Fast model for lightweight tasks.',
    maxTokens: 200000,
  },
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    description: 'Previous flagship for complex analysis.',
    maxTokens: 200000,
  },
]

const openRouterModels: ModelOption[] = [
  {
    id: 'openrouter/auto',
    label: 'Auto Router',
    description: 'Automatically selects the best model for your task.',
    maxTokens: 128000,
  },
  {
    id: 'anthropic/claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'Latest Claude via OpenRouter.',
    maxTokens: 200000,
    isNew: true,
  },
  {
    id: 'google/gemini-2.5-pro-preview',
    label: 'Gemini 2.5 Pro',
    description: 'Google flagship via OpenRouter.',
    maxTokens: 1048576,
    isNew: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    description: 'Meta open model with strong performance.',
    maxTokens: 128000,
    isNew: true,
  },
  {
    id: 'mistralai/mistral-large-latest',
    label: 'Mistral Large',
    description: 'Strong reasoning model from Mistral AI.',
    maxTokens: 128000,
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1',
    description: 'Advanced reasoning model with open weights.',
    maxTokens: 64000,
    isNew: true,
  },
]

export const providerModelMap: Record<ProviderId, ModelOption[]> = {
  openai: openAIModels,
  google: googleModels,
  anthropic: claudeModels,
  openrouter: openRouterModels,
}

export const providerInfo: Record<ProviderId, { name: string; supported: boolean }> = {
  google: { name: 'Google', supported: true },
  anthropic: { name: 'Anthropic', supported: true },
  openai: { name: 'OpenAI', supported: true },
  openrouter: { name: 'OpenRouter', supported: false },
}

export const PROVIDER_PRIORITY: ProviderId[] = ['google', 'anthropic', 'openai']

const defaultModelMap: Record<ProviderId, string> = {
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
  anthropic: 'claude-sonnet-4-20250514',
  openrouter: 'openrouter/auto',
}

export const getModelsForProvider = (provider: ProviderId): ModelOption[] => providerModelMap[provider] ?? []

export const getAllModels = (): { provider: ProviderId; models: ModelOption[] }[] => {
  return Object.entries(providerModelMap).map(([provider, models]) => ({
    provider: provider as ProviderId,
    models,
  }))
}

export const getDefaultModelForProvider = (provider: ProviderId): string => {
  if (defaultModelMap[provider]) {
    return defaultModelMap[provider]
  }
  const models = getModelsForProvider(provider)
  return models[0]?.id ?? 'gpt-4o'
}

export const getMaxTokensForModel = (modelId: string): number => {
  const [provider, model] = modelId.includes(':') ? modelId.split(':') : ['openai', modelId]
  const models = providerModelMap[provider as ProviderId] ?? []
  const found = models.find((m) => m.id === model)
  return found?.maxTokens ?? 128000
}

export const getProviderForModel = (modelId: string): ProviderId | null => {
  for (const [provider, models] of Object.entries(providerModelMap)) {
    if (models.some((m) => m.id === modelId)) {
      return provider as ProviderId
    }
  }
  return null
}

export const isProviderSupported = (provider: ProviderId): boolean => {
  return providerInfo[provider]?.supported ?? false
}
