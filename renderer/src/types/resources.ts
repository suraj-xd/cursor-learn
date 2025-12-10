export type ResourceType = 'documentation' | 'video' | 'article' | 'tool' | 'github'

export type ResourceSource = 'ai' | 'tavily' | 'perplexity'

export type ResourceCategory = 
  | 'core'
  | 'deep_dive'
  | 'practical'
  | 'reference'

export type ResourcesProviderId = 'auto' | 'perplexity' | 'tavily' | 'google' | 'openai' | 'anthropic'

export type ResourceQuality = 'essential' | 'recommended' | 'supplementary'

export type Resource = {
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
  source: ResourceSource
  embedUrl?: string
  favicon?: string
  domain?: string
  author?: string
  createdAt: number
}

export type ConversationAnalysis = {
  coreProblem: string
  solutionApproach: string
  conceptsUsed: string[]
  knowledgeGaps: string[]
  implementationDetails: string[]
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  technologies: string[]
}

export type GenerateResourcesRequest = {
  chatContext: string
  conversationTitle: string
  existingResourceUrls: string[]
  desiredCount?: number
  userRequest?: string
  preferredProvider?: ResourcesProviderId
}

export type GenerateResourcesResponse = {
  resources: Resource[]
  topics: string[]
  analysis?: ConversationAnalysis
  message?: string
}

export type GenerationStatus = 'idle' | 'analyzing' | 'generating' | 'complete' | 'error'

export type ResourcesState = {
  resources: Resource[]
  topics: string[]
  analysis: ConversationAnalysis | null
  isGenerating: boolean
  generationStatus: GenerationStatus
  generationError: string | null
  hasTavilyKey: boolean
  hasPerplexityKey: boolean
  availableProviders: string[]
  lastGeneratedAt: number | null
}

export const CATEGORY_INFO: Record<ResourceCategory, { label: string; description: string; iconName: string }> = {
  core: {
    label: 'Start Here',
    description: 'Essential resources directly related to your problem',
    iconName: 'target',
  },
  deep_dive: {
    label: 'Go Deeper',
    description: 'Advanced content for thorough understanding',
    iconName: 'microscope',
  },
  practical: {
    label: 'Hands-On',
    description: 'Tutorials and examples you can follow along',
    iconName: 'code',
  },
  reference: {
    label: 'Reference',
    description: 'Official docs and API references to bookmark',
    iconName: 'book-open',
  },
}

export const QUALITY_INFO: Record<ResourceQuality, { label: string; color: string }> = {
  essential: { label: 'Must Read', color: 'text-green-600' },
  recommended: { label: 'Recommended', color: 'text-blue-600' },
  supplementary: { label: 'Extra', color: 'text-muted-foreground' },
}
