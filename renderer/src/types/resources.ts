export type ResourceType = 'documentation' | 'video' | 'article' | 'tool' | 'github'

export type ResourceSource = 'ai' | 'tavily' | 'perplexity'

export type ResourceCategory = 
  | 'fundamentals'
  | 'documentation'
  | 'tutorials'
  | 'videos'
  | 'deep_dives'
  | 'tools'

export type ResourcesProviderId = 'auto' | 'perplexity' | 'tavily' | 'google' | 'openai' | 'anthropic'

export type Resource = {
  id: string
  type: ResourceType
  category: ResourceCategory
  title: string
  url: string
  description: string
  relevanceReason?: string
  thumbnail?: string
  source: ResourceSource
  embedUrl?: string
  favicon?: string
  domain?: string
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

export type ResourcesState = {
  resources: Resource[]
  topics: string[]
  analysis: ConversationAnalysis | null
  isGenerating: boolean
  generationError: string | null
  hasTavilyKey: boolean
  hasPerplexityKey: boolean
  availableProviders: string[]
}

export const CATEGORY_INFO: Record<ResourceCategory, { label: string; description: string; iconName: string }> = {
  fundamentals: {
    label: 'Fundamentals',
    description: 'Theory and mental models behind your code',
    iconName: 'brain',
  },
  documentation: {
    label: 'Hidden Gems',
    description: 'Advanced docs and RFCs you missed',
    iconName: 'scroll-text',
  },
  tutorials: {
    label: 'Level Up',
    description: 'Advanced implementations and patterns',
    iconName: 'trending-up',
  },
  videos: {
    label: 'Mind-Expanding Talks',
    description: 'Conference talks that change how you think',
    iconName: 'presentation',
  },
  deep_dives: {
    label: 'Deep Dives',
    description: 'Performance, security, and architecture',
    iconName: 'microscope',
  },
  tools: {
    label: 'Power Tools',
    description: 'Tools you didn\'t know you needed',
    iconName: 'wrench',
  },
}
