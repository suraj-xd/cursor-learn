import type { ProviderId } from '@/types/agents'

export type ModelOption = {
  id: string
  label: string
  description: string
  maxTokens: number
}

const openAIModels: ModelOption[] = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Latest flagship model with advanced reasoning and multimodal capabilities.',
    maxTokens: 128000,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    description: 'Fast, affordable GPT-4o variant suitable for everyday chats.',
    maxTokens: 128000,
  },
  {
    id: 'o1-preview',
    label: 'o1-preview',
    description: 'Advanced reasoning model for complex problem-solving.',
    maxTokens: 128000,
  },
  {
    id: 'o1-mini',
    label: 'o1 mini',
    description: 'Fast reasoning model with structured output.',
    maxTokens: 128000,
  },
]

const googleModels: ModelOption[] = [
  {
    id: 'gemini-2.0-flash-exp',
    label: 'Gemini 2.0 Flash (Experimental)',
    description: 'Latest fast multimodal model with improved performance.',
    maxTokens: 1048576,
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'High quality responses with 1M token context window.',
    maxTokens: 1048576,
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    description: 'Fast and efficient model for quick responses.',
    maxTokens: 1048576,
  },
  {
    id: 'gemini-pro',
    label: 'Gemini Pro',
    description: 'Reliable general-purpose model for diverse tasks.',
    maxTokens: 32000,
  },
]

const claudeModels: ModelOption[] = [
  {
    id: 'claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    description: 'Anthropic\'s balanced flagship model with excellent reasoning.',
    maxTokens: 200000,
  },
  {
    id: 'claude-3.5-haiku',
    label: 'Claude 3.5 Haiku',
    description: 'Fast Claude tier for lightweight prompts and quick responses.',
    maxTokens: 200000,
  },
  {
    id: 'claude-3-opus',
    label: 'Claude 3 Opus',
    description: 'Most capable model for complex tasks requiring deep analysis.',
    maxTokens: 200000,
  },
  {
    id: 'claude-3-sonnet',
    label: 'Claude 3 Sonnet',
    description: 'Previous generation balanced model with strong performance.',
    maxTokens: 200000,
  },
]

const openRouterModels: ModelOption[] = [
  {
    id: 'openrouter/auto',
    label: 'OpenRouter Auto',
    description: 'Auto-selects the best community model.',
    maxTokens: 128000,
  },
  {
    id: 'mistralai/mistral-large-latest',
    label: 'Mistral Large',
    description: 'Strong reasoning model hosted via OpenRouter.',
    maxTokens: 128000,
  },
]

const providerModelMap: Record<ProviderId, ModelOption[]> = {
  openai: openAIModels,
  google: googleModels,
  claude: claudeModels,
  openrouter: openRouterModels,
}

const defaultModelMap: Record<ProviderId, string> = {
  openai: 'gpt-4o-mini',
  google: 'gemini-2.0-flash',
  claude: 'claude-3.5-sonnet',
  openrouter: 'openrouter/auto',
}

export const getModelsForProvider = (provider: ProviderId): ModelOption[] => providerModelMap[provider] ?? []

export const getDefaultModelForProvider = (provider: ProviderId): string => {
  if (defaultModelMap[provider]) {
    return defaultModelMap[provider]
  }
  const models = getModelsForProvider(provider)
  return models[0]?.id ?? 'gpt-4o-mini'
}

export const getMaxTokensForModel = (modelId: string): number => {
  const [provider, model] = modelId.includes(':') ? modelId.split(':') : ['openai', modelId]
  const models = providerModelMap[provider as ProviderId] ?? []
  const found = models.find((m) => m.id === model)
  return found?.maxTokens ?? 128000
}

