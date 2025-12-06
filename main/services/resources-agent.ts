import { runGeminiPrompt } from './agent-runtime'
import {
  saveResources,
  getResources,
  deleteResources,
  getApiKey,
  listApiKeys,
} from './agent-storage'
import { getDefaultModel, isSupportedProvider, type ProviderId } from './ai-config'

const TAVILY_API_BASE = 'https://api.tavily.com'
const PERPLEXITY_API_BASE = 'https://api.perplexity.ai'

export type ResourcesProviderId = 'auto' | 'perplexity' | 'tavily' | 'google' | 'openai' | 'anthropic'

export type ResourceCategory = 
  | 'fundamentals'
  | 'documentation'
  | 'tutorials'
  | 'videos'
  | 'deep_dives'
  | 'tools'

type AvailableProvider = {
  provider: ProviderId
  model: string
}

type ConversationAnalysis = {
  coreProblem: string
  solutionApproach: string
  conceptsUsed: string[]
  knowledgeGaps: string[]
  implementationDetails: string[]
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  technologies: string[]
}

function getAnyAvailableProvider(): AvailableProvider | null {
  const keys = listApiKeys()
  const supportedKeys = keys.filter((k) => isSupportedProvider(k.provider))
  
  if (supportedKeys.length === 0) return null
  
  const priorityOrder: ProviderId[] = ['google', 'anthropic', 'openai', 'openrouter']
  for (const provider of priorityOrder) {
    if (supportedKeys.some((k) => k.provider === provider)) {
      return {
        provider,
        model: getDefaultModel(provider, 'chat'),
      }
    }
  }
  
  const firstKey = supportedKeys[0]
  return {
    provider: firstKey.provider as ProviderId,
    model: getDefaultModel(firstKey.provider as ProviderId, 'chat'),
  }
}

function getSpecificProvider(providerId: ResourcesProviderId): AvailableProvider | null {
  if (providerId === 'auto') return null
  if (providerId === 'perplexity' || providerId === 'tavily') return null
  
  const apiKey = getApiKey(providerId as ProviderId)
  if (!apiKey?.secret) return null
  
  return {
    provider: providerId as ProviderId,
    model: getDefaultModel(providerId as ProviderId, 'chat'),
  }
}

async function runPromptWithProvider(
  prompt: string,
  provider: ProviderId,
  model: string,
  maxTokens = 8192
): Promise<{ content: string }> {
  const apiKey = getApiKey(provider)
  if (!apiKey?.secret) {
    throw new Error(`No API key found for ${provider}`)
  }

  if (provider === 'google') {
    return runGeminiPrompt(prompt, { model, temperature: 0.4, maxOutputTokens: maxTokens })
  }

  if (provider === 'openai' || provider === 'openrouter') {
    const baseUrl = provider === 'openrouter' 
      ? 'https://openrouter.ai/api/v1' 
      : 'https://api.openai.com/v1'
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.secret}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error?.message || `${provider} API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error(`${provider} returned an empty response`)
    return { content }
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.secret,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error(errorBody?.error?.message || `Anthropic API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data?.content?.[0]?.text?.trim()
    if (!content) throw new Error('Anthropic returned an empty response')
    return { content }
  }

  throw new Error(`Unsupported provider: ${provider}`)
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
  relevanceReason?: string
  thumbnail?: string
  source: 'ai' | 'tavily' | 'perplexity'
  embedUrl?: string
  favicon?: string
  domain?: string
  createdAt: number
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

const ANALYSIS_PROMPT = `You are an expert at understanding programming conversations between developers and AI assistants.

This is a conversation from Cursor (AI code editor). Your job is to deeply understand:
1. What SPECIFIC PROBLEM was the user trying to solve?
2. What APPROACH/SOLUTION did the AI suggest?
3. What parts might the user still NOT FULLY UNDERSTAND?
4. What would help them MASTER the solution and apply it elsewhere?

ANALYZE THE CONVERSATION AND EXTRACT:

1. CORE_PROBLEM: What is the exact, specific problem the user came to solve? Be precise:
   - NOT "learning React" but "fixing a useEffect infinite loop when fetching user data"
   - NOT "API issues" but "handling race conditions in concurrent API calls"
   - Focus on the ACTUAL bug, feature, or implementation challenge

2. SOLUTION_APPROACH: What solution or approach was discussed/implemented?
   - The pattern or technique used
   - Key code changes or architecture decisions
   - Why this approach was chosen

3. CONCEPTS_USED: What programming concepts are central to the solution?
   - Design patterns (singleton, observer, etc.)
   - Language features (closures, async/await, generics)
   - Framework patterns (hooks, middleware, etc.)
   - NOT just library names, but the actual concepts

4. KNOWLEDGE_GAPS: What might the user NOT fully understand yet?
   - Parts of the solution that were complex
   - Concepts that were used but not fully explained
   - Error handling or edge cases that weren't covered
   - "Why" questions that weren't answered

5. IMPLEMENTATION_DETAILS: What specific implementation aspects need deeper understanding?
   - Specific APIs or methods used
   - Configuration or setup details
   - Integration points

6. SKILL_LEVEL: Based on their questions and understanding:
   - "beginner": Needs foundational explanations
   - "intermediate": Understands basics, needs pattern/architecture help
   - "advanced": Needs optimization, edge cases, best practices

OUTPUT FORMAT (JSON only, no markdown):
{
  "coreProblem": "the specific problem being solved",
  "solutionApproach": "the approach/solution discussed",
  "conceptsUsed": ["concept1", "concept2"],
  "knowledgeGaps": ["gap1", "gap2"],
  "implementationDetails": ["detail1", "detail2"],
  "skillLevel": "beginner|intermediate|advanced",
  "technologies": ["tech1", "tech2"]
}`

const DEEP_RESOURCES_PROMPT = `You are an expert programming educator known for finding UNEXPECTED, MIND-EXPANDING resources that developers never knew they needed.

THE USER'S SITUATION:
- Problem they solved: {coreProblem}
- Solution approach used: {solutionApproach}
- Key concepts in the solution: {conceptsUsed}
- What they might not fully understand: {knowledgeGaps}
- Implementation details to learn: {implementationDetails}
- Skill level: {skillLevel}
- Technologies involved: {technologies}

YOUR MISSION: Find 25-30 resources that will BLOW THEIR MIND - not the obvious stuff they could Google in 2 seconds!

WHAT TO AVOID (CRITICAL):
❌ Basic tutorials they've probably already seen
❌ "Getting started" or "101" content
❌ Generic documentation homepages
❌ Obvious first-page Google results
❌ Content that just restates what they already implemented
❌ Easy concepts they clearly already understand

WHAT TO FIND (THIS IS WHAT MAKES YOU VALUABLE):
✅ The ADVANCED article that even senior devs don't know about
✅ The obscure conference talk that changes how you think
✅ The GitHub repo with a clever alternative approach
✅ The "why does this actually work under the hood" deep dives
✅ Content that makes them go "I never thought about it that way"
✅ Resources that EXTEND their solution into unexplored territory
✅ Cross-domain insights (how other fields solve similar problems)
✅ The controversial/opinionated takes that challenge assumptions

CATEGORIES (provide resources for EACH):

1. FUNDAMENTALS (5-7): NOT "learn the basics" - instead:
   - The underlying CS/engineering THEORY behind what they built
   - How the runtime/compiler actually handles their code
   - The mathematical or architectural principles at play
   - Mental models that senior engineers use
   - Example: Not "what is useEffect" but "how React's fiber reconciler schedules effects"

2. DOCUMENTATION (5-7): The HIDDEN GEMS in docs they missed:
   - Advanced API options they didn't know existed
   - The "internals" or "advanced patterns" sections
   - RFCs and design documents explaining WHY things work this way
   - Deprecated approaches and why they were replaced
   - Example: Not react.dev homepage but React RFC discussions on GitHub

3. TUTORIALS (5-7): ADVANCED implementations, not basics:
   - "Building X from scratch" where X is a library they're using
   - Production-grade implementations with error handling, testing
   - Tutorials that solve the NEXT problem they'll face
   - Cross-technology comparisons (how would this work in Rust/Go/etc)

4. VIDEOS (4-6): The TALKS that change how you think:
   - Prefer: Strange Loop, Deconstruct, Papers We Love, React/Next.js Conf deep talks
   - Creator channels: Fireship (advanced), Theo (hot takes), ThePrimeagen (performance), Low Level JavaScript
   - Conference talks where library authors explain design decisions
   - "X is broken and here's why" style critical analysis

5. DEEP_DIVES (3-5): For the intellectually curious:
   - Performance benchmarks and why they matter
   - Security implications they haven't considered
   - Scaling challenges and architectural patterns
   - How big companies solved this same problem
   - Historical context: how we got here, what failed before

6. TOOLS (3-5): Tools they DON'T know they need:
   - Debugging tools for their specific tech stack
   - Alternative libraries with different tradeoffs
   - CLI tools that improve their workflow
   - Visualization/profiling tools
   - GitHub repos that showcase advanced patterns

CRITICAL RULES:
1. SURPRISE THEM - if they could have easily found it themselves, don't include it
2. PUSH THEIR LEVEL UP - assume they want to become an expert, not stay comfortable
3. Include "relevanceReason" explaining the NON-OBVIOUS connection to their work
4. URLs must be REAL - use URLs you're confident exist
5. Prefer content from: conference talks, library authors, staff+ engineers
6. Include at least 3 resources that connect to ADJACENT domains or technologies

OUTPUT FORMAT (JSON only):
{
  "fundamentals": [
    {"type": "documentation|video|article", "title": "...", "url": "...", "description": "...", "relevanceReason": "This connects to your work because..."}
  ],
  "documentation": [...],
  "tutorials": [...],
  "videos": [...],
  "deep_dives": [...],
  "tools": [...]
}

Generate resources that will EXPAND their mind, not just confirm what they already know. JSON only.`

const ADD_MORE_PROMPT = `You are a programming educator known for finding the UNEXPECTED resources that developers never knew they needed.

THE USER'S SITUATION:
- Problem they solved: {coreProblem}
- Solution approach: {solutionApproach}
- Concepts involved: {conceptsUsed}
- Skill level: {skillLevel}

EXISTING RESOURCES (DO NOT REPEAT):
{existingUrls}

Generate 8-10 NEW resources that will SURPRISE and CHALLENGE them:

AVOID:
❌ Anything similar to what they already have
❌ Basic tutorials or getting started guides
❌ Obvious Google-first-page results

FIND:
✅ The controversial opinion piece that challenges their approach
✅ A completely different way to solve the same problem
✅ The obscure library that does it better
✅ Cross-domain knowledge (how other fields solve this)
✅ The "you're doing it wrong" articles that make them think
✅ Advanced performance or security considerations
✅ What could go wrong in production

OUTPUT FORMAT (JSON only):
{
  "fundamentals": [...],
  "documentation": [...],
  "tutorials": [...],
  "videos": [...],
  "deep_dives": [...],
  "tools": [...]
}

Each resource: {"type": "...", "title": "...", "url": "...", "description": "...", "relevanceReason": "The non-obvious connection to their work..."}

JSON only, no markdown.`

function parseAnalysisResponse(content: string): ConversationAnalysis | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    
    return {
      coreProblem: parsed.coreProblem || parsed.primaryGoal || 'Understanding programming concepts',
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
  relevanceReason?: string
  category?: string
}

function parseCategorizedResourcesResponse(content: string): { 
  categories: Record<ResourceCategory, RawResource[]>
} | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    
    const categoryMap: Record<ResourceCategory, RawResource[]> = {
      fundamentals: [],
      documentation: [],
      tutorials: [],
      videos: [],
      deep_dives: [],
      tools: [],
    }
    
    const categoryKeys: ResourceCategory[] = ['fundamentals', 'documentation', 'tutorials', 'videos', 'deep_dives', 'tools']
    
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

  const resource: Resource = {
    id: generateResourceId(),
    type,
    category,
    title: raw.title || 'Untitled Resource',
    url: raw.url || '',
    description: raw.description || '',
    relevanceReason: raw.relevanceReason,
    source,
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
  title: string,
  provider: ProviderId,
  model: string
): Promise<ConversationAnalysis> {
  const prompt = `${ANALYSIS_PROMPT}

CONVERSATION TITLE: "${title}"

CONVERSATION:
${conversationText.slice(0, 40000)}

Analyze this Cursor AI chat conversation now and output JSON.`

  try {
    const { content } = await runPromptWithProvider(prompt, provider, model, 2048)
    const analysis = parseAnalysisResponse(content)
    
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
  analysis: ConversationAnalysis,
  provider: ProviderId,
  model: string
): Promise<Resource[]> {
  const prompt = DEEP_RESOURCES_PROMPT
    .replace('{coreProblem}', analysis.coreProblem)
    .replace('{solutionApproach}', analysis.solutionApproach)
    .replace('{conceptsUsed}', analysis.conceptsUsed.join(', ') || 'programming concepts')
    .replace('{knowledgeGaps}', analysis.knowledgeGaps.join(', ') || 'deeper understanding needed')
    .replace('{implementationDetails}', analysis.implementationDetails.join(', ') || 'implementation details')
    .replace('{skillLevel}', analysis.skillLevel)
    .replace('{technologies}', analysis.technologies.join(', ') || 'general programming')

  const { content } = await runPromptWithProvider(prompt, provider, model, 12000)
  const parsed = parseCategorizedResourcesResponse(content)
  
  if (!parsed) {
    throw new Error('Failed to parse resources response')
  }
  
  const resources: Resource[] = []
  const categoryKeys: ResourceCategory[] = ['fundamentals', 'documentation', 'tutorials', 'videos', 'deep_dives', 'tools']
  
  for (const category of categoryKeys) {
    const items = parsed.categories[category] || []
    for (const item of items) {
      if (item.url && item.title) {
        resources.push(enrichResource(item, category, 'ai'))
      }
    }
  }
  
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

DO NOT find basic tutorials or obvious first-page Google results. They can find those themselves.

INSTEAD find:
- Conference talks from Strange Loop, Deconstruct, or Papers We Love that relate to their problem
- Advanced blog posts from library authors explaining design decisions
- GitHub repos with unconventional or clever approaches
- The "you're doing it wrong" or controversial opinion pieces
- Cross-domain resources (how other programming paradigms solve similar problems)
- Performance deep-dives and benchmarks
- Security considerations they haven't thought about
- What big tech companies wrote about solving similar problems

Preferred channels: ThePrimeagen, Fireship (advanced videos), Low Level JavaScript, ByteByteGo
Preferred sites: GitHub discussions, RFCs, engineering blogs from Vercel/Meta/Google/Stripe

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
          content: 'You are a programming education expert. Find and recommend specific, real learning resources with working URLs. Always include the exact URL for each resource. Format your response as a list of resources with title, URL, description, and why it\'s relevant.',
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
      
      let category: ResourceCategory = 'tutorials'
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        category = 'videos'
      } else if (url.includes('github.com')) {
        category = 'tools'
      } else if (url.includes('docs.') || url.includes('.dev/') || url.includes('developer.')) {
        category = 'documentation'
      }
      
      const nextLines = lines.slice(i + 1, i + 3).join(' ')
      currentDescription = nextLines.slice(0, 200).replace(/https?:\/\/[^\s]+/g, '').trim()
      
      resources.push(enrichResource({
        title: currentTitle || `Resource from ${getDomain(url)}`,
        url,
        description: currentDescription || `Learning resource about ${analysis.technologies[0] || 'programming'}`,
        relevanceReason: `Found via Perplexity research for: ${analysis.primaryGoal}`,
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
    let category: ResourceCategory = 'tutorials'
    if (result.url.includes('youtube.com') || result.url.includes('youtu.be')) {
      category = 'videos'
    } else if (result.url.includes('github.com')) {
      category = 'tools'
    } else if (result.url.includes('docs.') || result.url.includes('.dev') || result.url.includes('developer.')) {
      category = 'documentation'
    }
    
    return enrichResource({
      title: result.title,
      url: result.url,
      description: result.content?.slice(0, 200) || '',
      relevanceReason: 'Found via Tavily web search',
    }, category, 'tavily')
  })
}

export async function generateResources(input: GenerateInput): Promise<GenerateResult> {
  const conversationText = formatBubblesAsText(input.bubbles)
  
  if (!conversationText.trim()) {
    throw new Error('No conversation content to analyze. Please select a conversation with messages.')
  }
  
  const preferredProvider = input.preferredProvider || 'auto'
  const perplexityKey = getApiKey('perplexity')
  const tavilyKey = getApiKey('tavily')
  
  let usePerplexity = false
  let useTavily = false
  let aiProvider: AvailableProvider | null = null
  
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
    aiProvider = getAnyAvailableProvider()
  } else {
    aiProvider = getSpecificProvider(preferredProvider) || getAnyAvailableProvider()
  }
  
  if (!usePerplexity && !useTavily && !aiProvider) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }
  
  const analysisProvider = aiProvider || getAnyAvailableProvider()
  if (!analysisProvider) {
    throw new Error('Need at least one AI provider (Google, OpenAI, Anthropic) for analysis.')
  }
  
  const analysis = await analyzeConversation(
    conversationText,
    input.title,
    analysisProvider.provider,
    analysisProvider.model
  )
  
  let resources: Resource[] = []
  let source: 'ai' | 'perplexity' | 'tavily' = 'ai'
  
  if (usePerplexity) {
    try {
      resources = await runPerplexityResearch(analysis, conversationText)
      source = 'perplexity'
    } catch (error) {
      console.error('Perplexity research failed, falling back to AI:', error)
      usePerplexity = false
    }
  }
  
  if (useTavily && resources.length < 10) {
    try {
      const searchQueries = [
        `${analysis.coreProblem} tutorial ${analysis.skillLevel}`,
        `${analysis.solutionApproach} guide`,
        ...analysis.conceptsUsed.slice(0, 2).map(c => `${c} explained`),
      ]
      
      const searchPromises = searchQueries.map(q => 
        searchWithTavily(q, 5).catch(() => [])
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
  
  if (resources.length < 20 && aiProvider) {
    try {
      const aiResources = await generateResourcesFromAnalysis(
        analysis,
        aiProvider.provider,
        aiProvider.model
      )
      
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
  
  if (resources.length === 0) {
    throw new Error('Failed to find any resources. Please try again.')
  }
  
  const topics = [...new Set([
    ...analysis.conceptsUsed.slice(0, 5),
    ...analysis.technologies.slice(0, 3),
  ])]
  
  const modelUsed = analysisProvider ? `${analysisProvider.provider}:${analysisProvider.model}` : 'perplexity:sonar'
  
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
  
  return { resources, topics, analysis }
}

export async function addMoreResources(input: GenerateInput & { existingResources: Resource[] }): Promise<GenerateResult> {
  const availableProvider = getAnyAvailableProvider()
  if (!availableProvider) {
    throw new Error('No API key configured. Please add an API key in Settings → LLM.')
  }

  const { provider, model } = availableProvider
  const conversationText = formatBubblesAsText(input.bubbles)
  
  const analysis = await analyzeConversation(conversationText, input.title, provider, model)
  
  const existingUrls = input.existingResources.map(r => r.url).join('\n- ')
  
  const prompt = ADD_MORE_PROMPT
    .replace('{coreProblem}', analysis.coreProblem)
    .replace('{solutionApproach}', analysis.solutionApproach)
    .replace('{conceptsUsed}', analysis.conceptsUsed.join(', '))
    .replace('{skillLevel}', analysis.skillLevel)
    .replace('{existingUrls}', existingUrls)

  const { content } = await runPromptWithProvider(prompt, provider, model, 8192)
  const parsed = parseCategorizedResourcesResponse(content)
  
  if (!parsed) {
    throw new Error('Failed to parse resources response')
  }
  
  const newResources: Resource[] = []
  const existingUrlSet = new Set(input.existingResources.map(r => r.url))
  const categoryKeys: ResourceCategory[] = ['fundamentals', 'documentation', 'tutorials', 'videos', 'deep_dives', 'tools']
  
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
  
  const existingRecord = getResources(input.workspaceId, input.conversationId)
  const existingTopics = existingRecord?.topics || []
  const mergedTopics = [...new Set([...existingTopics, ...analysis.technologies.slice(0, 3)])]
  const modelUsed = `${provider}:${model}`

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
  return getAnyAvailableProvider() !== null
}

export function getAvailableProviderInfo(): { 
  available: boolean
  provider: string | null
  hasTavily: boolean
  hasPerplexity: boolean
  availableProviders: string[]
} {
  const provider = getAnyAvailableProvider()
  const tavilyKey = getApiKey('tavily')
  const perplexityKey = getApiKey('perplexity')
  const keys = listApiKeys()
  
  const availableProviders: string[] = []
  if (perplexityKey?.secret) availableProviders.push('perplexity')
  if (tavilyKey?.secret) availableProviders.push('tavily')
  
  const aiProviders: ProviderId[] = ['google', 'openai', 'anthropic', 'openrouter']
  for (const p of aiProviders) {
    if (keys.some(k => k.provider === p)) {
      availableProviders.push(p)
    }
  }
  
  return {
    available: provider !== null || Boolean(perplexityKey?.secret),
    provider: provider?.provider || null,
    hasTavily: Boolean(tavilyKey?.secret),
    hasPerplexity: Boolean(perplexityKey?.secret),
    availableProviders,
  }
}
