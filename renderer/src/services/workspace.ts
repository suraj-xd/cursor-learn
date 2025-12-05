import type { ChatTab, ComposerData } from '@/types/workspace'

export interface ConversationPreview {
  id: string
  name: string
  lastUpdatedAt: number
  createdAt: number
  messageCount: number
}

export interface WorkspaceProject {
  id: string
  name: string
  path?: string
  conversationCount: number
  lastModified: string
  conversations: ConversationPreview[]
}

export interface WorkspaceTabsPayload {
  tabs: ChatTab[]
  composers?: ComposerData
}

export interface SearchResult {
  workspaceId: string
  workspaceFolder?: string
  chatId: string
  chatTitle: string
  timestamp: string | number
  matchingText: string
  type: 'chat' | 'composer'
}

class WorkspaceService {
  private static instance: WorkspaceService
  private cache = new Map<string, { data: unknown; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000

  static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService()
    }
    return WorkspaceService.instance
  }

  private getIpc() {
    if (typeof window === 'undefined' || !window.ipc) {
      return null
    }
    return window.ipc
  }

  private getCacheKey(method: string, ...args: unknown[]): string {
    return `${method}:${JSON.stringify(args)}`
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key)
      return null
    }
    return cached.data as T
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  clearCache(): void {
    this.cache.clear()
  }

  invalidateWorkspace(workspaceId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(workspaceId)) {
        this.cache.delete(key)
      }
    }
  }

  async listWorkspaces(): Promise<WorkspaceProject[]> {
    const cacheKey = this.getCacheKey('list')
    const cached = this.getFromCache<WorkspaceProject[]>(cacheKey)
    if (cached) return cached

    const ipc = this.getIpc()
    if (!ipc) return []

    try {
      const data = await ipc.workspace.list()
      const result = data || []
      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
      return []
    }
  }

  async getWorkspaceTabs(workspaceId: string): Promise<WorkspaceTabsPayload> {
    const cacheKey = this.getCacheKey('tabs', workspaceId)
    const cached = this.getFromCache<WorkspaceTabsPayload>(cacheKey)
    if (cached) return cached

    const ipc = this.getIpc()
    if (!ipc) return { tabs: [] }

    try {
      const data = await ipc.workspace.tabs(workspaceId)
      const result = { tabs: data.tabs || [], composers: data.composers }
      this.setCache(cacheKey, result)
      return result
    } catch (error) {
      console.error('Failed to fetch workspace tabs:', error)
      return { tabs: [] }
    }
  }

  async search(query: string, type: 'all' | 'chat' | 'composer' = 'all'): Promise<SearchResult[]> {
    if (!query.trim()) return []

    const ipc = this.getIpc()
    if (!ipc) return []

    try {
      return await ipc.workspace.search(query, type)
    } catch (error) {
      console.error('Failed to search:', error)
      return []
    }
  }

  async getConversation(workspaceId: string, conversationId: string, type: 'chat' | 'composer'): Promise<ConversationContent | null> {
    const ipc = this.getIpc()
    if (!ipc) return null

    try {
      return await ipc.workspace.conversation(workspaceId, conversationId, type)
    } catch (error) {
      console.error('Failed to fetch conversation:', error)
      return null
    }
  }
}

export interface ConversationContent {
  id: string
  workspaceId: string
  title: string
  type: 'chat' | 'composer'
  messages: Array<{ role: 'user' | 'ai'; text: string; timestamp?: number }>
  totalTokenEstimate: number
}

export const workspaceService = WorkspaceService.getInstance()

