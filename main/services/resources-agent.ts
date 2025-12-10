import { generate } from './ai/helpers'
import { getAvailableProviders, hasAnyApiKey, getProvider } from './ai/providers'
import { getDefaultModel, type ProviderId } from './ai/models'
import { buildResourcesAnalysisPrompt, buildResourcesGeneratePrompt } from './ai/prompts'
import {
  saveResources,
  getResources,
  deleteResources,
  getApiKey,
  listApiKeys,
} from './agent-storage'
import { estimateTokens } from './compact-agent'

const TAVILY_API_BASE = 'https://api.tavily.com'
const PERPLEXITY_API_BASE = 'https://api.perplexity.ai'

const TOKEN_BUDGETS = {
  default: 8000,
  medium: 6000,
  small: 4000,
  minimal: 2000,
}

const FALLBACK_BUDGETS = [
  TOKEN_BUDGETS.default,
  TOKEN_BUDGETS.medium,
  TOKEN_BUDGETS.small,
  TOKEN_BUDGETS.minimal,
]

export type ResourcesProviderId = 'auto' | 'perplexity' | 'tavily' | 'google' | 'openai' | 'anthropic'

export type ResourceCategory = 'core' | 'deep_dive' | 'practical' | 'reference'

export type ResourceQuality = 'essential' | 'recommended' | 'supplementary'

type ConversationAnalysis = {
  coreProblem: string
  solutionApproach: string
  conceptsUsed: string[]
  knowledgeGaps: string[]
  implementationDetails: string[]
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  technologies: string[]
}

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type ResourceType = 'documentation' | 'video' | 'article' | 'tool' | 'github'

type Resource = {
  id: string
  type: ResourceType
  category: ResourceCategory
  title: string
  url: string
  description: string
  whyUseful: string
  quality: ResourceQuality
  relevanceScore: number
  thumbnail?: string
  source: 'ai' | 'tavily' | 'perplexity'
  embedUrl?: string
  favicon?: string
  domain?: string
  author?: string
  createdAt: number
}

type ParsedTurn = {
  index: number
  role: 'user' | 'ai'
  content: string
  tokenCount: number
  importance: 'high' | 'medium' | 'low'
  importanceScore: number
  hasCode: boolean
  hasError: boolean
}

const CODE_BLOCK_REGEX = /```[\s\S]*?```/g
const ERROR_PATTERNS = [/error:/i, /exception:/i, /failed:/i, /typeerror:/i]
const HIGH_IMPORTANCE_KEYWORDS = ['important', 'critical', 'key', 'solved', 'fixed', 'works']
const LOW_IMPORTANCE_KEYWORDS = ['thanks', 'thank you', 'got it', 'ok', 'okay']

function parseAndScoreBubbles(bubbles: ConversationBubble[]): ParsedTurn[] {
  return bubbles.map((bubble, index) => {
    const hasCode = CODE_BLOCK_REGEX.test(bubble.text)
    const hasError = ERROR_PATTERNS.some((p) => p.test(bubble.text))
    const lowered = bubble.text.toLowerCase()

    let score = 5
    if (hasCode) score += 2
    if (hasError) score += 1
    if (HIGH_IMPORTANCE_KEYWORDS.some((kw) => lowered.includes(kw))) score += 1
    if (LOW_IMPORTANCE_KEYWORDS.some((kw) => lowered.includes(kw))) score -= 2
    if (bubble.text.length < 50) score -= 1

    const clamped = Math.max(1, Math.min(10, score))

    return {
      index,
      role: bubble.type,
      content: bubble.text,
      tokenCount: estimateTokens(bubble.text),
      importance: clamped >= 8 ? 'high' : clamped >= 5 ? 'medium' : 'low',
      importanceScore: clamped,
      hasCode,
      hasError,
    }
  })
}

function truncateForBudget(turns: ParsedTurn[], budget: number): ParsedTurn[] {
  let total = turns.reduce((sum, t) => sum + t.tokenCount, 0)
  if (total <= budget) return turns

  const preserved = new Set<number>()
  for (let i = 0; i < Math.min(3, turns.length); i++) preserved.add(i)
  for (let i = Math.max(0, turns.length - 5); i < turns.length; i++) preserved.add(i)

  const sorted = [...turns].sort((a, b) => a.importanceScore - b.importanceScore)

  const drop = new Set<number>()
  for (const t of sorted) {
    if (total <= budget) break
    if (preserved.has(t.index)) continue
    drop.add(t.index)
    total -= t.tokenCount
  }

  return turns.filter((t) => !drop.has(t.index))
}

function formatTurnsAsText(turns: ParsedTurn[]): string {
  return turns
    .map((t) => `[${t.role.toUpperCase()}]: ${t.content}`)
    .join('\n\n')
}

type GenerateInput = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
  existingUrls?: string[]
  userRequest?: string
  preferredProvider?: ResourcesProviderId
}

type GenerateResult = {
  resources: Resource[]
  topics: string[]
  analysis?: ConversationAnalysis
}

function formatBubblesAsText(bubbles: ConversationBubble[]): string {
  return bubbles
    .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
    .join('\n\n')
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
    /youtube\.com\/shorts\/([^&?\s]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

function generateResourceId(): string {
  return `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function parseAnalysisResponse(content: string): ConversationAnalysis | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    
    return {
      coreProblem: parsed.coreProblem || 'Understanding programming concepts',
      solutionApproach: parsed.solutionApproach || 'Various programming techniques',
      conceptsUsed: Array.isArray(parsed.conceptsUsed) ? parsed.conceptsUsed : [],
      knowledgeGaps: Array.isArray(parsed.knowledgeGaps) ? parsed.knowledgeGaps : [],
      implementationDetails: Array.isArray(parsed.implementationDetails) ? parsed.implementationDetails : [],
      skillLevel: ['beginner', 'intermediate', 'advanced'].includes(parsed.skillLevel) 
        ? parsed.skillLevel 
        : 'intermediate',
      technologies: Array.isArray(parsed.technologies) ? parsed.technologies : [],
    }
  } catch {
    return null
  }
}

type RawResource = {
  type?: string
  title?: string
  url?: string
  description?: string
  whyUseful?: string
  quality?: string
  relevanceScore?: number
  author?: string
}

function parseCategorizedResourcesResponse(content: string): { 
  categories: Record<ResourceCategory, RawResource[]>
} | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    
    const categoryMap: Record<ResourceCategory, RawResource[]> = {
      core: [],
      deep_dive: [],
      practical: [],
      reference: [],
    }
    
    const categoryKeys: ResourceCategory[] = ['core', 'deep_dive', 'practical', 'reference']
    
    for (const category of categoryKeys) {
      const items = parsed[category]
      if (Array.isArray(items)) {
        categoryMap[category] = items.filter((r: RawResource) => r.url && r.title)
      }
    }
    
    return { categories: categoryMap }
  } catch {
    return null
  }
}

function enrichResource(
  raw: RawResource,
  category: ResourceCategory,
  source: 'ai' | 'tavily' | 'perplexity'
): Resource {
  let type: ResourceType = 'article'
  if (raw.type === 'video' || raw.url?.includes('youtube.com') || raw.url?.includes('youtu.be')) {
    type = 'video'
  } else if (raw.type === 'documentation' || raw.url?.includes('docs.') || raw.url?.includes('.dev/')) {
    type = 'documentation'
  } else if (raw.type === 'github' || raw.url?.includes('github.com')) {
    type = 'github'
  } else if (raw.type === 'tool') {
    type = 'tool'
  } else if (raw.type === 'article') {
    type = 'article'
  }

  const quality: ResourceQuality = 
    raw.quality === 'essential' ? 'essential' :
    raw.quality === 'recommended' ? 'recommended' : 'supplementary'

  const resource: Resource = {
    id: generateResourceId(),
    type,
    category,
    title: raw.title || 'Untitled Resource',
    url: raw.url || '',
    description: raw.description || '',
    whyUseful: raw.whyUseful || raw.description || '',
    quality,
    relevanceScore: typeof raw.relevanceScore === 'number' ? raw.relevanceScore : 5,
    source,
    author: raw.author,
    createdAt: Date.now(),
    domain: getDomain(raw.url || ''),
  }

  if (type === 'video') {
    const videoId = extractYouTubeVideoId(resource.url)
    if (videoId) {
      resource.embedUrl = `https://www.youtube.com/embed/${videoId}`
      resource.thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    }
  }

  if (resource.domain) {
    resource.favicon = `https://www.google.com/s2/favicons?domain=${resource.domain}&sz=32`
  }

  return resource
}

async function analyzeConversation(
  conversationText: string,
  title: string
): Promise<ConversationAnalysis> {
  const prompt = buildResourcesAnalysisPrompt(title, conversationText)

  try {
    const result = await generate({
      prompt,
      temperature: 0.4,
      maxTokens: 2048,
      role: 'resources',
      maxRetries: 3,
    })

    const analysis = parseAnalysisResponse(result.content)
    
    if (analysis) {
      return analysis
    }
  } catch (error) {
    console.error('Analysis failed:', error)
  }
  
  return {
    coreProblem: `Working on: ${title}`,
    solutionApproach: 'Various programming techniques discussed',
    conceptsUsed: [],
    knowledgeGaps: [],
    implementationDetails: [],
    skillLevel: 'intermediate',
    technologies: [],
  }
}

async function generateResourcesFromAnalysis(
  analysis: ConversationAnalysis
): Promise<Resource[]> {
  const prompt = buildResourcesGeneratePrompt(analysis)

  const result = await generate({
    prompt,
    temperature: 0.3,
    maxTokens: 6000,
    role: 'resources',
    maxRetries: 3,
  })

  const parsed = parseCategorizedResourcesResponse(result.content)
  
  if (!parsed) {
    throw new Error('Failed to parse resources response')
  }
  
  const resources: Resource[] = []
  const categoryKeys: ResourceCategory[] = ['core', 'deep_dive', 'practical', 'reference']
  
  for (const category of categoryKeys) {
    const items = parsed.categories[category] || []
    for (const item of items) {
      if (item.url && item.title) {
        resources.push(enrichResource(item, category, 'ai'))
      }
    }
  }
  
  resources.sort((a, b) => b.relevanceScore - a.relevanceScore)
  
  return resources
}

async function runPerplexityResearch(
  analysis: ConversationAnalysis
): Promise<Resource[]> {
  const apiKey = getApiKey('perplexity')
  if (!apiKey?.secret) {
    throw new Error('Perplexity API key not configured')
  }

  const searchQuery = `Find UNEXPECTED, ADVANCED programming resources for a developer who just solved this problem:

PROBLEM: ${analysis.coreProblem}
SOLUTION USED: ${analysis.solutionApproach}
KEY CONCEPTS: ${analysis.conceptsUsed.join(', ')}
TECHNOLOGIES: ${analysis.technologies.join(', ')}
SKILL LEVEL: ${analysis.skillLevel}

DO NOT find basic tutorials or obvious first-page Google results.

INSTEAD find:
- Conference talks from Strange Loop, Deconstruct, or Papers We Love
- Advanced blog posts from library authors explaining design decisions
- GitHub repos with unconventional or clever approaches
- Performance deep-dives and benchmarks
- Security considerations they haven't thought about

For each resource, explain the NON-OBVIOUS connection to their work.`

  const response = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.secret}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a programming education expert. Find and recommend specific, real learning resources with working URLs.',
        },
        {
          role: 'user',
          content: searchQuery,
        },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Perplexity API error: ${error}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content || ''
  
  const resources: Resource[] = []
  const urlPattern = /https?:\/\/[^\s\])"']+/g
  
  const lines = content.split('\n')
  let currentTitle = ''
  let currentDescription = ''
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.match(/^\d+\.|^-|^\*/) && line.length > 10) {
      const titleMatch = line.match(/^\d+\.\s*\*?\*?([^*\[]+)/)
      if (titleMatch) {
        currentTitle = titleMatch[1].trim().replace(/[*_]/g, '')
      }
    }
    
    const urlMatch = line.match(urlPattern)
    if (urlMatch && currentTitle) {
      const url = urlMatch[0].replace(/[)\].,;:]+$/, '')
      
      let category: ResourceCategory = 'practical'
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        category = 'deep_dive'
      } else if (url.includes('github.com')) {
        category = 'practical'
      } else if (url.includes('docs.') || url.includes('.dev/') || url.includes('developer.')) {
        category = 'reference'
      }
      
      const nextLines = lines.slice(i + 1, i + 3).join(' ')
      currentDescription = nextLines.slice(0, 200).replace(/https?:\/\/[^\s]+/g, '').trim()
      
      resources.push(enrichResource({
        title: currentTitle || `Resource from ${getDomain(url)}`,
        url,
        description: currentDescription || `Learning resource about ${analysis.technologies[0] || 'programming'}`,
        whyUseful: `Found via Perplexity research for: ${analysis.coreProblem}`,
        quality: 'recommended',
        relevanceScore: 6,
      }, category, 'perplexity'))
      
      currentTitle = ''
      currentDescription = ''
    }
  }
  
  return resources
}

async function searchWithTavily(query: string, maxResults = 8): Promise<Resource[]> {
  const apiKey = getApiKey('tavily')
  if (!apiKey?.secret) {
    throw new Error('Tavily API key not configured.')
  }

  const response = await fetch(`${TAVILY_API_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey.secret,
      query,
      search_depth: 'advanced',
      include_domains: [
        'developer.mozilla.org',
        'react.dev',
        'nextjs.org',
        'nodejs.org',
        'typescriptlang.org',
        'github.com',
        'youtube.com',
        'dev.to',
        'medium.com',
        'css-tricks.com',
        'smashingmagazine.com',
        'stackoverflow.com',
        'kentcdodds.com',
        'joshwcomeau.com',
      ],
      max_results: maxResults,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Tavily API error: ${error}`)
  }

  const data = await response.json()
  
  return (data.results || []).map((result: { title: string; url: string; content: string }) => {
    let category: ResourceCategory = 'practical'
    if (result.url.includes('youtube.com') || result.url.includes('youtu.be')) {
      category = 'deep_dive'
    } else if (result.url.includes('github.com')) {
      category = 'practical'
    } else if (result.url.includes('docs.') || result.url.includes('.dev') || result.url.includes('developer.')) {
      category = 'reference'
    }
    
    return enrichResource({
      title: result.title,
      url: result.url,
      description: result.content?.slice(0, 200) || '',
      whyUseful: 'Found via Tavily web search',
      quality: 'recommended',
      relevanceScore: 5,
    }, category, 'tavily')
  })
}

export async function generateResources(input: GenerateInput): Promise<GenerateResult> {
  if (!input.bubbles.length) {
    throw new Error('No conversation content to analyze. Please select a conversation with messages.')
  }

  const parsedTurns = parseAndScoreBubbles(input.bubbles)
  
  const preferredProvider = input.preferredProvider || 'auto'
  const perplexityKey = getApiKey('perplexity')
  const tavilyKey = getApiKey('tavily')
  
  let usePerplexity = false
  let useTavily = false
  let useAI = false
  
  if (preferredProvider === 'perplexity' && perplexityKey?.secret) {
    usePerplexity = true
  } else if (preferredProvider === 'tavily' && tavilyKey?.secret) {
    useTavily = true
  } else if (preferredProvider === 'auto') {
    if (perplexityKey?.secret) {
      usePerplexity = true
    } else if (tavilyKey?.secret) {
      useTavily = true
    }
    useAI = hasAnyApiKey()
  } else {
    useAI = hasAnyApiKey()
  }
  
  if (!usePerplexity && !useTavily && !useAI) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }

  let analysis: ConversationAnalysis | null = null
  let resources: Resource[] = []
  let source: 'ai' | 'perplexity' | 'tavily' = 'ai'
  let lastError: Error | null = null

  for (const budget of FALLBACK_BUDGETS) {
    try {
      const truncated = truncateForBudget(parsedTurns, budget)
      const conversationText = formatTurnsAsText(truncated)
      
      if (truncated.length < parsedTurns.length) {
        console.log(`Resources: truncated to ${truncated.length}/${parsedTurns.length} turns for budget ${budget}`)
      }

      analysis = await analyzeConversation(conversationText, input.title)
      
      if (usePerplexity) {
        try {
          resources = await runPerplexityResearch(analysis)
          source = 'perplexity'
        } catch (error) {
          console.error('Perplexity research failed, falling back to AI:', error)
          usePerplexity = false
        }
      }
      
      if (useTavily && resources.length < 6) {
        try {
          const searchQueries = [
            `${analysis.coreProblem} ${analysis.skillLevel} tutorial`,
            ...analysis.technologies.slice(0, 2).map(t => `${t} best practices`),
          ]
          
          const searchPromises = searchQueries.map(q => 
            searchWithTavily(q, 4).catch(() => [])
          )
          const searchResults = await Promise.all(searchPromises)
          const tavilyResources = searchResults.flat()
          
          const existingUrls = new Set(resources.map(r => r.url))
          const newTavilyResources = tavilyResources.filter(r => !existingUrls.has(r.url))
          resources = [...resources, ...newTavilyResources]
          
          if (source === 'ai') source = 'tavily'
        } catch (error) {
          console.error('Tavily search failed:', error)
        }
      }
      
      if (resources.length < 8 && useAI) {
        try {
          const aiResources = await generateResourcesFromAnalysis(analysis)
          
          const existingUrls = new Set(resources.map(r => r.url))
          const newAiResources = aiResources.filter(r => !existingUrls.has(r.url))
          resources = [...resources, ...newAiResources]
        } catch (error) {
          console.error('AI resource generation failed:', error)
          if (resources.length === 0) {
            throw error
          }
        }
      }

      if (resources.length > 0) {
        break
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Resources generation failed with budget ${budget}, trying smaller...`)
      continue
    }
  }
  
  if (resources.length === 0) {
    throw lastError ?? new Error('Failed to find any resources. Please try again.')
  }
  
  resources.sort((a, b) => {
    const qualityOrder = { essential: 0, recommended: 1, supplementary: 2 }
    const qDiff = qualityOrder[a.quality] - qualityOrder[b.quality]
    if (qDiff !== 0) return qDiff
    return b.relevanceScore - a.relevanceScore
  })
  
  const topics = Array.from(new Set([
    ...analysis!.conceptsUsed.slice(0, 5),
    ...analysis!.technologies.slice(0, 3),
  ]))
  
  const availableProviders = getAvailableProviders()
  const modelUsed = availableProviders.length > 0 
    ? `${availableProviders[0]}:${getDefaultModel(availableProviders[0], 'resources')}`
    : 'perplexity:sonar'
  
  saveResources({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    resources,
    topics,
    modelUsed,
    metadata: {
      analysis,
      source,
      bubbleCount: input.bubbles.length,
      originalTitle: input.title,
    },
  })
  
  return { resources, topics, analysis: analysis! }
}

export async function addMoreResources(input: GenerateInput & { existingResources: Resource[] }): Promise<GenerateResult> {
  if (!hasAnyApiKey()) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }

  const parsedTurns = parseAndScoreBubbles(input.bubbles)
  const truncated = truncateForBudget(parsedTurns, TOKEN_BUDGETS.medium)
  const conversationText = formatTurnsAsText(truncated)
  
  const analysis = await analyzeConversation(conversationText, input.title)
  
  const existingTitles = input.existingResources.map(r => r.title).join(', ')
  
  const prompt = `Find 4-6 NEW resources different from what they already have.

CONTEXT:
- Problem: ${analysis.coreProblem}
- Approach: ${analysis.solutionApproach}
- Technologies: ${analysis.technologies.join(', ')}
- Skill level: ${analysis.skillLevel}

ALREADY HAVE: ${existingTitles}

Find resources that:
- Cover a different angle or approach
- Go deeper on something they touched
- Introduce related tools or techniques

Categories: core, deep_dive, practical, reference

OUTPUT (JSON only):
{
  "core": [{"type": "...", "title": "...", "url": "...", "description": "...", "whyUseful": "...", "quality": "essential|recommended|supplementary", "relevanceScore": 7}],
  "deep_dive": [...],
  "practical": [...],
  "reference": [...]
}`

  const result = await generate({
    prompt,
    temperature: 0.3,
    maxTokens: 4000,
    role: 'resources',
    maxRetries: 3,
  })

  const parsed = parseCategorizedResourcesResponse(result.content)
  
  if (!parsed) {
    throw new Error('Failed to parse resources response')
  }
  
  const newResources: Resource[] = []
  const existingUrlSet = new Set(input.existingResources.map(r => r.url))
  const categoryKeys: ResourceCategory[] = ['core', 'deep_dive', 'practical', 'reference']
  
  for (const category of categoryKeys) {
    const items = parsed.categories[category] || []
    for (const item of items) {
      if (item.url && item.title && !existingUrlSet.has(item.url)) {
        newResources.push(enrichResource(item, category, 'ai'))
      }
    }
  }
  
  if (newResources.length === 0) {
    throw new Error('No new resources found. Try specifying different topics.')
  }
  
  const allResources = [...input.existingResources, ...newResources]
  allResources.sort((a, b) => {
    const qualityOrder = { essential: 0, recommended: 1, supplementary: 2 }
    const qDiff = qualityOrder[a.quality] - qualityOrder[b.quality]
    if (qDiff !== 0) return qDiff
    return b.relevanceScore - a.relevanceScore
  })
  
  const existingRecord = getResources(input.workspaceId, input.conversationId)
  const existingTopics = existingRecord?.topics || []
  const mergedTopics = Array.from(new Set([...existingTopics, ...analysis.technologies.slice(0, 3)]))
  
  const availableProviders = getAvailableProviders()
  const modelUsed = availableProviders.length > 0 
    ? `${availableProviders[0]}:${getDefaultModel(availableProviders[0], 'resources')}`
    : 'ai-sdk'

  saveResources({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    resources: allResources,
    topics: mergedTopics,
    modelUsed,
  })

  return {
    resources: allResources,
    topics: mergedTopics,
    analysis,
  }
}

export function getResourcesForConversation(
  workspaceId: string,
  conversationId: string
) {
  return getResources(workspaceId, conversationId)
}

export function clearResourcesForConversation(
  workspaceId: string,
  conversationId: string
): boolean {
  return deleteResources(workspaceId, conversationId)
}

export function checkTavilyKeyAvailable(): boolean {
  const apiKey = getApiKey('tavily')
  return Boolean(apiKey?.secret)
}

export function checkPerplexityKeyAvailable(): boolean {
  const apiKey = getApiKey('perplexity')
  return Boolean(apiKey?.secret)
}

export function checkAnyApiKeyAvailable(): boolean {
  return hasAnyApiKey()
}

export function getAvailableProviderInfo(): { 
  available: boolean
  provider: string | null
  hasTavily: boolean
  hasPerplexity: boolean
  availableProviders: string[]
} {
  const providers = getAvailableProviders()
  const tavilyKey = getApiKey('tavily')
  const perplexityKey = getApiKey('perplexity')
  
  const availableProviders: string[] = []
  if (perplexityKey?.secret) availableProviders.push('perplexity')
  if (tavilyKey?.secret) availableProviders.push('tavily')
  availableProviders.push(...providers)
  
  return {
    available: providers.length > 0 || Boolean(perplexityKey?.secret),
    provider: providers[0] || null,
    hasTavily: Boolean(tavilyKey?.secret),
    hasPerplexity: Boolean(perplexityKey?.secret),
    availableProviders,
  }
}
