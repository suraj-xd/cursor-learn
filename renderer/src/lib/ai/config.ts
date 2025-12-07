export type ProviderId = 'openai' | 'google' | 'anthropic' | 'openrouter'

export type SearchProviderId = 'tavily' | 'perplexity'

export type ResourcesProviderId = 'auto' | 'perplexity' | 'tavily' | 'google' | 'openai' | 'anthropic'

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
  { id: 'tavily', label: 'Tavily', description: 'Web search + AI generation' },
  { id: 'google', label: 'Gemini', description: 'Google AI generation' },
  { id: 'openai', label: 'GPT', description: 'OpenAI generation' },
  { id: 'anthropic', label: 'Claude', description: 'Anthropic generation' },
]

export function getSearchProvider(id: SearchProviderId): SearchProviderConfig | undefined {
  return SEARCH_PROVIDERS.find((p) => p.id === id)
}

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
    description: 'Access GPT-5, o3, o4-mini, GPT-4.1, and more.',
    icon: 'openai',
    placeholder: 'sk-...',
    apiBase: 'https://api.openai.com/v1',
    supported: true,
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    description: 'Use Gemini 2.5, Gemini 2.0, and Gemini 3 models.',
    icon: 'google',
    placeholder: 'AIz...',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
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
    description: 'Multiprovider gateway for meta, mistral, deepseek, and more.',
    icon: 'openrouter',
    placeholder: 'or-...',
    apiBase: 'https://openrouter.ai/api/v1',
    supported: true,
  },
]

const OPENAI_MODELS: ModelOption[] = [
  {
    id: 'gpt-5',
    label: 'GPT-5',
    description: 'Most advanced GPT model with superior reasoning and coding.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'Fast and efficient version of GPT-5.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    description: 'Lightweight GPT-5 optimized for speed.',
    maxTokens: 128000,
    isNew: true,
    capabilities: ['streaming'],
  },
  {
    id: 'gpt-5.1',
    label: 'GPT-5.1',
    description: 'Latest GPT model with adaptive reasoning and improved instruction following.',
    maxTokens: 400000,
    isNew: true,
    capabilities: ['reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-5.1-codex',
    label: 'GPT-5.1 Codex',
    description: 'Specialized coding model based on GPT-5.1 reasoning stack.',
    maxTokens: 400000,
    isNew: true,
    capabilities: ['reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-5.1-codex-max',
    label: 'GPT-5.1 Codex Max',
    description: 'Agentic coding model for long-running software development tasks.',
    maxTokens: 400000,
    isNew: true,
    capabilities: ['reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-4.5',
    label: 'GPT-4.5',
    description: 'Enhanced emotional intelligence and human-like conversations.',
    maxTokens: 128000,
    isNew: true,
    capabilities: ['vision', 'streaming', 'function_calling'],
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    description: 'Improved coding and long-context comprehension with 1M token window.',
    maxTokens: 1047576,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    description: 'Fast and efficient version of GPT-4.1.',
    maxTokens: 1047576,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
    description: 'Lightweight model optimized for speed.',
    maxTokens: 1047576,
    capabilities: ['streaming'],
  },
  {
    id: 'o3',
    label: 'o3',
    description: 'Most advanced reasoning model with extended thinking capabilities.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning', 'vision'],
  },
  {
    id: 'o3-mini',
    label: 'o3 Mini',
    description: 'Cost-efficient reasoning model optimized for coding, math, and science.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning'],
  },
  {
    id: 'o3-pro',
    label: 'o3 Pro',
    description: 'Premium reasoning model designed to think longer for complex tasks.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning'],
  },
  {
    id: 'o4-mini',
    label: 'o4 Mini',
    description: 'Fast, cost-efficient reasoning optimized for math, coding, and visual tasks.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning', 'vision'],
  },
  {
    id: 'o4-mini-high',
    label: 'o4 Mini High',
    description: 'Enhanced o4-mini with higher reasoning capability.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning', 'vision'],
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
]

const GOOGLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3-pro',
    label: 'Gemini 3 Pro',
    description: 'Most advanced Gemini model with state-of-the-art multimodal reasoning.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
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
    description: 'Best in price-performance with thinking capabilities and agentic use cases.',
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
    id: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image',
    description: 'State-of-the-art image generation and editing model.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['vision', 'streaming'],
  },
  {
    id: 'gemini-2.5-computer-use',
    label: 'Gemini 2.5 Computer Use',
    description: 'Specialized model for UI interaction and browser control.',
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
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Most intelligent model with state-of-the-art coding and frontier performance.',
    maxTokens: 1000000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Best balance of intelligence, speed, and cost with exceptional coding.',
    maxTokens: 1000000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-opus-4-1',
    label: 'Claude Opus 4.1',
    description: 'Enhanced Opus 4 with improved capabilities.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-opus-4',
    label: 'Claude Opus 4',
    description: 'World\'s best coding model for sustained performance on complex tasks.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'State-of-the-art coding and reasoning with hybrid thinking modes.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['vision', 'reasoning', 'streaming', 'function_calling'],
  },
  {
    id: 'claude-3-7-sonnet',
    label: 'Claude 3.7 Sonnet',
    description: 'Hybrid reasoning model with rapid and extended thinking modes.',
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
    maxTokens: 200000,
    capabilities: ['streaming'],
  },
  {
    id: 'anthropic/claude-opus-4-5',
    label: 'Claude Opus 4.5',
    description: 'Most intelligent Claude via OpenRouter.',
    maxTokens: 1000000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Best Claude for production via OpenRouter.',
    maxTokens: 1000000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
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
    id: 'openai/gpt-5',
    label: 'GPT-5',
    description: 'Latest OpenAI flagship via OpenRouter.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'openai/gpt-5.1',
    label: 'GPT-5.1',
    description: 'Most advanced GPT via OpenRouter.',
    maxTokens: 400000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'openai/gpt-5.1-codex-max',
    label: 'GPT-5.1 Codex Max',
    description: 'Agentic coding model via OpenRouter.',
    maxTokens: 400000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'openai/o4-mini',
    label: 'o4 Mini',
    description: 'Fast reasoning via OpenRouter.',
    maxTokens: 200000,
    isNew: true,
    capabilities: ['reasoning', 'streaming'],
  },
  {
    id: 'google/gemini-3-pro',
    label: 'Gemini 3 Pro',
    description: 'Google\'s most advanced model via OpenRouter.',
    maxTokens: 1048576,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    description: 'Google flagship via OpenRouter.',
    maxTokens: 1048576,
    isNew: true,
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
    id: 'meta-llama/llama-3.1-405b-instruct',
    label: 'Llama 3.1 405B',
    description: 'Meta\'s largest open model.',
    maxTokens: 128000,
    capabilities: ['streaming', 'function_calling'],
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
  {
    id: 'x-ai/grok-4',
    label: 'Grok 4',
    description: 'Latest xAI model with 2M token context.',
    maxTokens: 2000000,
    isNew: true,
    capabilities: ['streaming', 'function_calling'],
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
  openai: OPENAI_MODELS,
  google: GOOGLE_MODELS,
  anthropic: ANTHROPIC_MODELS,
  openrouter: OPENROUTER_MODELS,
}

export const PROVIDER_PRIORITY: ProviderId[] = ['google', 'anthropic', 'openai', 'openrouter']

export const PREFERRED_MODELS: Record<ProviderId, string[]> = {
  openai: ['gpt-5', 'o4-mini', 'gpt-4o'],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  anthropic: ['claude-sonnet-4-5', 'claude-sonnet-4', 'claude-3-5-sonnet-20241022'],
  openrouter: ['openrouter/auto'],
}

export type ModelRole = 'chat' | 'title' | 'compact' | 'summarization'

export const DEFAULT_MODELS: Record<ProviderId, Record<ModelRole, string>> = {
  openai: {
    chat: 'gpt-5',
    title: 'gpt-5-mini',
    compact: 'gpt-4o-mini',
    summarization: 'gpt-4o-mini',
  },
  google: {
    chat: 'gemini-2.5-flash',
    title: 'gemini-2.5-flash-lite',
    compact: 'gemini-2.0-flash-lite',
    summarization: 'gemini-2.5-flash',
  },
  anthropic: {
    chat: 'claude-sonnet-4-5',
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