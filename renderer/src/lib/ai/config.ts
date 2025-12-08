export type ProviderId = 'openai' | 'google' | 'anthropic' | 'openrouter'
export type SearchProviderId = 'tavily' | 'perplexity'
export type ResourcesProviderId = 'auto' | 'perplexity' | 'tavily' | 'google' | 'openai' | 'anthropic'
export type ModelCapability = 'vision' | 'reasoning' | 'streaming' | 'function_calling'
export type ModelRole = 'chat' | 'title' | 'compact' | 'summarization' | 'overview' | 'resources'

export type ModelOption = {
  id: string
  label: string
  description: string
  maxTokens: number
  isNew?: boolean
  capabilities?: ModelCapability[]
}

export type ProviderConfig = {
  id: ProviderId
  name: string
  description: string
  icon: string
  placeholder: string
  apiBase: string
  supported: boolean
}

export type SearchProviderConfig = {
  id: SearchProviderId
  name: string
  description: string
  placeholder: string
  apiBase: string
}

export const SEARCH_PROVIDERS: SearchProviderConfig[] = [
  {
    id: 'perplexity',
    name: 'Perplexity Sonar',
    description: 'Deep research API - best for comprehensive learning resources.',
    placeholder: 'pplx-...',
    apiBase: 'https://api.perplexity.ai',
  },
  {
    id: 'tavily',
    name: 'Tavily Search',
    description: 'AI-powered search API for resource discovery.',
    placeholder: 'tvly-...',
    apiBase: 'https://api.tavily.com',
  },
]

export const RESOURCES_PROVIDER_OPTIONS: { id: ResourcesProviderId; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Best available (Perplexity → Tavily → AI)' },
  { id: 'perplexity', label: 'Perplexity', description: 'Deep research with Sonar' },
  { id: 'tavily', label: 'Tavily', description: 'Web search + AI generation' },
  { id: 'google', label: 'Gemini', description: 'Google AI generation' },
  { id: 'openai', label: 'GPT', description: 'OpenAI generation' },
  { id: 'anthropic', label: 'Claude', description: 'Anthropic generation' },
]

export function getSearchProvider(id: SearchProviderId): SearchProviderConfig | undefined {
  return SEARCH_PROVIDERS.find((p) => p.id === id)
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    name: 'Google (Gemini)',
    description: 'Use Gemini 2.5, Gemini 2.0, and other Google models.',
    icon: 'google',
    placeholder: 'AIz...',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    supported: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Access GPT-4o, o3, o4-mini, and more.',
    icon: 'openai',
    placeholder: 'sk-...',
    apiBase: 'https://api.openai.com/v1',
    supported: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 4, Claude 3.7 Sonnet, and Claude 3.5 models.',
    icon: 'anthropic',
    placeholder: 'sk-ant-...',
    apiBase: 'https://api.anthropic.com/v1',
    supported: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Multiprovider gateway for Meta, Mistral, DeepSeek, and more.',
    icon: 'openrouter',
    placeholder: 'sk-or-...',
    apiBase: 'https://openrouter.ai/api/v1',
    supported: true,
  },
]

const GOOGLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Superior reasoning with hybrid thinking capabilities.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Best in price-performance with thinking capabilities.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: 'Fastest and most cost-efficient 2.5 model.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'streaming'],
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Multimodal model with native tool use.',
    maxTokens: 1048576,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    description: 'Lightweight version optimized for cost.',
    maxTokens: 1048576,
    capabilities: ['streaming'],
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'High quality responses with 1M token context.',
    maxTokens: 1048576,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
]

const OPENAI_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Flagship multimodal model with vision and reasoning.',
    maxTokens: 128000,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Fast, affordable GPT-4o variant.',
    maxTokens: 128000,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Improved coding and long-context comprehension.',
    maxTokens: 1047576,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    description: 'Fast and efficient version of GPT-4.1.',
    maxTokens: 1047576,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'o3',
    label: 'o3',
    description: 'Most advanced reasoning model with extended thinking.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning', 'vision'],
  },
  {
    id: 'o3-mini',
    label: 'o3 Mini',
    description: 'Cost-efficient reasoning for coding and math.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning'],
  },
  {
    id: 'o4-mini',
    label: 'o4 Mini',
    description: 'Fast reasoning for math, coding, and visual tasks.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning', 'vision'],
  },
  {
    id: 'o1',
    label: 'o1',
    description: 'Advanced reasoning model for complex problems.',
    maxTokens: 200000,
    capabilities: ['reasoning'],
  },
]

const ANTHROPIC_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    description: 'State-of-the-art coding and reasoning.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    description: 'World\'s best coding model for complex tasks.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    label: 'Claude 3.7 Sonnet',
    description: 'Hybrid reasoning with rapid and extended thinking.',
    maxTokens: 200000,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    description: 'Balanced flagship model with excellent reasoning.',
    maxTokens: 200000,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    description: 'Fast model for lightweight tasks.',
    maxTokens: 200000,
    capabilities: ['streaming'],
  },
]

const OPENROUTER_MODELS: ModelOption[] = [
  {
    id: 'openrouter/auto',
    label: 'Auto Router',
    description: 'Automatically selects the best model.',
    maxTokens: 200000,
    capabilities: ['streaming'],
  },
  {
    id: 'anthropic/claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'Latest Claude via OpenRouter.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI flagship via OpenRouter.',
    maxTokens: 128000,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Fast Gemini 2.5 via OpenRouter.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    description: 'Meta open model with strong performance.',
    maxTokens: 128000,
    capabilities: ['streaming'],
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1',
    description: 'Advanced reasoning model with open weights.',
    maxTokens: 64000,
    isNew: true,
    capabilities: ['reasoning', 'streaming'],
  },
  {
    id: 'x-ai/grok-3',
    label: 'Grok 3',
    description: 'xAI general purpose model.',
    maxTokens: 128000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
]

export const PROVIDER_MODELS: Record<ProviderId, ModelOption[]> = {
  google: GOOGLE_MODELS,
  openai: OPENAI_MODELS,
  anthropic: ANTHROPIC_MODELS,
  openrouter: OPENROUTER_MODELS,
}

export const PROVIDER_PRIORITY: ProviderId[] = ['google', 'anthropic', 'openai', 'openrouter']

export const PREFERRED_MODELS: Record<ProviderId, string[]> = {
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  openai: ['gpt-4o', 'o4-mini', 'gpt-4.1'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
  openrouter: ['openrouter/auto'],
}

export const DEFAULT_MODELS: Record<ProviderId, Record<ModelRole, string>> = {
  google: {
    chat: 'gemini-2.5-flash',
    title: 'gemini-2.0-flash-lite',
    compact: 'gemini-2.0-flash',
    summarization: 'gemini-2.5-flash',
    overview: 'gemini-2.0-flash',
    resources: 'gemini-2.0-flash',
  },
  openai: {
    chat: 'gpt-4o',
    title: 'gpt-4o-mini',
    compact: 'gpt-4o-mini',
    summarization: 'gpt-4o-mini',
    overview: 'gpt-4o',
    resources: 'gpt-4o',
  },
  anthropic: {
    chat: 'claude-sonnet-4-20250514',
    title: 'claude-3-5-haiku-20241022',
    compact: 'claude-3-5-haiku-20241022',
    summarization: 'claude-3-5-haiku-20241022',
    overview: 'claude-3-5-sonnet-20241022',
    resources: 'claude-3-5-sonnet-20241022',
  },
  openrouter: {
    chat: 'openrouter/auto',
    title: 'openrouter/auto',
    compact: 'openrouter/auto',
    summarization: 'openrouter/auto',
    overview: 'openrouter/auto',
    resources: 'openrouter/auto',
  },
}

export function getProvider(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

export function getProviderModels(provider: ProviderId): ModelOption[] {
  return PROVIDER_MODELS[provider] ?? []
}

export function getAllModels(): { provider: ProviderId; models: ModelOption[] }[] {
  return Object.entries(PROVIDER_MODELS).map(([provider, models]) => ({
    provider: provider as ProviderId,
    models,
  }))
}

export function getDefaultModel(provider: ProviderId, role: ModelRole = 'chat'): string {
  return DEFAULT_MODELS[provider]?.[role] ?? PROVIDER_MODELS[provider]?.[0]?.id ?? 'gpt-4o'
}

export function getPreferredModels(provider: ProviderId): ModelOption[] {
  const preferred = PREFERRED_MODELS[provider] ?? []
  const models = PROVIDER_MODELS[provider] ?? []
  return models.filter((m) => preferred.includes(m.id))
}

export function getMaxTokens(modelId: string): number {
  const [provider, model] = modelId.includes(':') ? modelId.split(':') : [null, modelId]
  
  if (provider) {
    const models = PROVIDER_MODELS[provider as ProviderId] ?? []
    const found = models.find((m) => m.id === model)
    if (found) return found.maxTokens
  }
  
  for (const models of Object.values(PROVIDER_MODELS)) {
    const found = models.find((m) => m.id === modelId || m.id === model)
    if (found) return found.maxTokens
  }
  
  return 128000
}

export function getModelInfo(modelId: string): ModelOption | undefined {
  const [provider, model] = modelId.includes(':') ? modelId.split(':') : [null, modelId]
  const searchId = model || modelId
  
  if (provider) {
    const models = PROVIDER_MODELS[provider as ProviderId] ?? []
    return models.find((m) => m.id === searchId)
  }
  
  for (const models of Object.values(PROVIDER_MODELS)) {
    const found = models.find((m) => m.id === searchId)
    if (found) return found
  }
  
  return undefined
}

export function findProviderForModel(modelId: string): ProviderId | null {
  for (const [provider, models] of Object.entries(PROVIDER_MODELS)) {
    if (models.some((m) => m.id === modelId)) {
      return provider as ProviderId
    }
  }
  return null
}

export function isProviderSupported(provider: ProviderId): boolean {
  return getProvider(provider)?.supported ?? false
}

export function parseModelId(fullModelId: string): { provider: ProviderId | null; model: string } {
  if (fullModelId.includes(':')) {
    const [provider, model] = fullModelId.split(':')
    return { provider: provider as ProviderId, model }
  }
  return { provider: findProviderForModel(fullModelId), model: fullModelId }
}

export function formatModelId(provider: ProviderId, modelId: string): string {
  return `${provider}:${modelId}`
}
