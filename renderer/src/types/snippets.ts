export interface Snippet {
  id: string
  code: string
  language: string
  title: string | null
  labels: string[]
  sourceContext: string | null
  isPinned: boolean
  createdAt: number
  updatedAt: number
}

export interface SnippetCreatePayload {
  id?: string
  code: string
  language: string
  title?: string | null
  labels?: string[]
  sourceContext?: string | null
}

export interface SnippetUpdatePayload {
  id: string
  code?: string
  language?: string
  title?: string | null
  labels?: string[]
  isPinned?: boolean
}

export interface SnippetsListOptions {
  limit?: number
  offset?: number
  search?: string
  language?: string
}

export interface LanguageCount {
  language: string
  count: number
}

