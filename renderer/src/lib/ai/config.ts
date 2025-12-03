export type ProviderId = 'openai' | 'google' | 'anthropic' | 'openrouter'

export type ModelCapability = 'vision' | 'reasoning' | 'streaming' | 'function_calling'

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

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Access GPT-4.1, o1, and lightweight GPT models.',
    icon: 'openai',
    placeholder: 'sk-...',
    apiBase: 'https://api.openai.com/v1',
    supported: true,
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    description: 'Use Gemini 2.0, Gemini 1.5, and experimental models.',
    icon: 'google',
    placeholder: 'AIz...',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    supported: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet, Haiku, and future releases.',
    icon: 'anthropic',
    placeholder: 'sk-ant-...',
    apiBase: 'https://api.anthropic.com/v1',
    supported: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Multiprovider gateway for meta, mistral, and more.',
    icon: 'openrouter',
    placeholder: 'or-...',
    apiBase: 'https://openrouter.ai/api/v1',
    supported: true,
  },
]

const OPENAI_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Flagship multimodal model with vision and advanced reasoning.',
    maxTokens: 128000,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Fast, affordable GPT-4o variant for everyday tasks.',
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
    id: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    description: 'Lightweight model optimized for speed.',
    maxTokens: 1047576,
    isNew: true,
    capabilities: ['streaming'],
  },
  {
    id: 'o1',
    label: 'o1',
    description: 'Advanced reasoning model for complex problem-solving.',
    maxTokens: 200000,
    capabilities: ['reasoning'],
  },
  {
    id: 'o1-mini',
    label: 'o1 Mini',
    description: 'Fast reasoning model optimized for speed.',
    maxTokens: 128000,
    capabilities: ['reasoning'],
  },
  {
    id: 'o1-pro',
    label: 'o1 Pro',
    description: 'Enhanced reasoning with extended thinking time.',
    maxTokens: 200000,
    capabilities: ['reasoning'],
  },
  {
    id: 'o3-mini',
    label: 'o3 Mini',
    description: 'Next-gen reasoning model with improved efficiency.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning'],
  },
  {
    id: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'High performance model with 128K context window.',
    maxTokens: 128000,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
]

const GOOGLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-2.5-pro-preview-05-06',
    label: 'Gemini 2.5 Pro',
    description: 'Most advanced Gemini model with superior reasoning.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming'],
  },
  {
    id: 'gemini-2.5-flash-preview-05-20',
    label: 'Gemini 2.5 Flash',
    description: 'Fast and efficient with excellent performance.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'streaming'],
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Multimodal model with native tool use and code execution.',
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
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    description: 'Fast model for quick responses.',
    maxTokens: 1048576,
    capabilities: ['vision', 'streaming'],
  },
]

const ANTHROPIC_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    description: 'Latest balanced model with excellent reasoning and coding.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    description: 'Most capable model for complex, multi-step tasks.',
    maxTokens: 200000,
    isNew: true,
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
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    description: 'Previous flagship for complex analysis.',
    maxTokens: 200000,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
]

const OPENROUTER_MODELS: ModelOption[] = [
  {
    id: 'openrouter/auto',
    label: 'Auto Router',
    description: 'Automatically selects the best model for your task.',
    maxTokens: 128000,
    capabilities: ['streaming'],
  },
  {
    id: 'anthropic/claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'Latest Claude via OpenRouter.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['streaming'],
  },
  {
    id: 'google/gemini-2.5-pro-preview',
    label: 'Gemini 2.5 Pro',
    description: 'Google flagship via OpenRouter.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['streaming'],
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    description: 'Meta open model with strong performance.',
    maxTokens: 128000,
    isNew: true,
    capabilities: ['streaming'],
  },
  {
    id: 'mistralai/mistral-large-latest',
    label: 'Mistral Large',
    description: 'Strong reasoning model from Mistral AI.',
    maxTokens: 128000,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1',
    description: 'Advanced reasoning model with open weights.',
    maxTokens: 64000,
    isNew: true,
    capabilities: ['reasoning', 'streaming'],
  },
]

export const PROVIDER_MODELS: Record<ProviderId, ModelOption[]> = {
  openai: OPENAI_MODELS,
  google: GOOGLE_MODELS,
  anthropic: ANTHROPIC_MODELS,
  openrouter: OPENROUTER_MODELS,
}

export const PROVIDER_PRIORITY: ProviderId[] = ['google', 'anthropic', 'openai', 'openrouter']

export const PREFERRED_MODELS: Record<ProviderId, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  google: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
  openrouter: ['openrouter/auto'],
}

export type ModelRole = 'chat' | 'title' | 'compact' | 'summarization'

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

