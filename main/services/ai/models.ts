export type ProviderId = 'openai' | 'google' | 'anthropic' | 'openrouter'
export type ModelRole = 'chat' | 'title' | 'compact' | 'summarization' | 'overview' | 'resources'

export const PROVIDER_PRIORITY: ProviderId[] = ['google', 'anthropic', 'openai', 'openrouter']

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
    chat: 'openai/gpt-4o',
    title: 'openai/gpt-4o-mini',
    compact: 'openai/gpt-4o-mini',
    summarization: 'openai/gpt-4o-mini',
    overview: 'openai/gpt-4o',
    resources: 'openai/gpt-4o',
  },
}

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
}

export function getDefaultModel(provider: ProviderId, role: ModelRole = 'chat'): string {
  return DEFAULT_MODELS[provider]?.[role] ?? DEFAULT_MODELS.google.chat
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

export function parseModelId(fullModelId: string): { provider: ProviderId | null; model: string } {
  if (fullModelId.includes(':')) {
    const [provider, model] = fullModelId.split(':')
    return { provider: provider as ProviderId, model }
  }
  return { provider: null, model: fullModelId }
}

export function formatModelId(provider: ProviderId, modelId: string): string {
  return `${provider}:${modelId}`
}
