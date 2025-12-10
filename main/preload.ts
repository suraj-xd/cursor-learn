import { contextBridge, ipcRenderer } from 'electron'
import type {
  WorkspaceProject,
  WorkspaceDetails,
  WorkspaceTabsPayload,
  WorkspaceLog,
  SearchResult,
} from './services/workspace-service'
import type { EnvironmentInfo } from './services/config-service'
import type {
  ApiKeyRecord,
  ChatRecord,
  MessageRecord,
  ChatMentionRecord,
  CompactedChatRecord,
  CompactSessionRecord,
  ConversationOverviewRecord,
  OverviewSessionRecord,
  UsageRecord,
  UsageStats,
  UsageByProvider,
  UsageByModel,
  UsageByDay,
  UsageFeature,
  LearningsRecord,
  ResourcesRecord,
} from './services/agent-storage'
import type { OverviewStructure, DiagramSpec } from './services/types/overview-structure'
import type { LearningConcept } from './services/types/learning-concept'
import type { ChatContext } from './services/agent-runtime'
import type { NoteRecord } from './services/notes-storage'
import type { SnippetRecord } from './services/snippets-storage'
import type { TodoRecord } from './services/todos-storage'

type SearchType = 'all' | 'chat' | 'composer'

const api = {
  workspace: {
    list: () => ipcRenderer.invoke('workspace:list') as Promise<WorkspaceProject[]>,
    details: (workspaceId: string) =>
      ipcRenderer.invoke('workspace:details', workspaceId) as Promise<WorkspaceDetails | null>,
    tabs: (workspaceId: string) =>
      ipcRenderer.invoke('workspace:tabs', workspaceId) as Promise<WorkspaceTabsPayload>,
    logs: () => ipcRenderer.invoke('workspace:logs') as Promise<WorkspaceLog[]>,
    composers: () => ipcRenderer.invoke('workspace:composers'),
    composer: (composerId: string) =>
      ipcRenderer.invoke('workspace:composer', composerId),
    search: (query: string, type: SearchType) =>
      ipcRenderer.invoke('workspace:search', { query, type }) as Promise<SearchResult[]>,
    conversation: (workspaceId: string, conversationId: string, type: 'chat' | 'composer') =>
      ipcRenderer.invoke('workspace:conversation', { workspaceId, conversationId, type }) as Promise<{
        id: string
        workspaceId: string
        title: string
        type: 'chat' | 'composer'
        messages: Array<{ role: 'user' | 'ai'; text: string; timestamp?: number }>
        totalTokenEstimate: number
      } | null>,
  },
  config: {
    validatePath: (workspacePath: string) =>
      ipcRenderer.invoke('workspace:path:validate', workspacePath) as Promise<{
        valid: boolean
        workspaceCount: number
        error?: string
      }>,
    setPath: (workspacePath: string) =>
      ipcRenderer.invoke('workspace:path:set', workspacePath) as Promise<string>,
    getPath: () =>
      ipcRenderer.invoke('workspace:path:get') as Promise<{
        storedPath?: string
        resolvedPath: string
        defaultPath: string
      }>,
  },
  environment: {
    info: () => ipcRenderer.invoke('environment:info') as Promise<EnvironmentInfo>,
    username: () => ipcRenderer.invoke('environment:username') as Promise<string>,
    allUsernames: () => ipcRenderer.invoke('environment:usernames:all') as Promise<{
      osUserInfo: string | null
      envUser: string | null
      envLogname: string | null
      whoami: string | null
      homeDir: string | null
      gitConfigName: string | null
      macRealName: string | null
    }>,
  },
  pdf: {
    generate: async (markdown: string, title: string) => {
      const buffer: Buffer = await ipcRenderer.invoke('pdf:generate', { markdown, title })
      return Uint8Array.from(buffer)
    },
  },
  agents: {
    apiKeys: {
      list: () => ipcRenderer.invoke('agents:api-keys:list') as Promise<Array<Omit<ApiKeyRecord, 'secret'>>>,
      save: (payload: { provider: string; secret: string; label?: string | null }) =>
        ipcRenderer.invoke('agents:api-keys:set', payload) as Promise<Omit<ApiKeyRecord, 'secret'> | null>,
      delete: (provider: string) => ipcRenderer.invoke('agents:api-keys:delete', provider) as Promise<boolean>,
    },
    chats: {
      list: (payload?: { limit?: number; search?: string; workspaceConversationId?: string | null }) =>
        ipcRenderer.invoke('agents:chats:list', payload) as Promise<ChatRecord[]>,
      create: (payload: {
        id?: string
        title: string
        modelId: string
        provider: string
        summary?: string | null
        workspaceConversationId?: string | null
      }) => ipcRenderer.invoke('agents:chats:create', payload) as Promise<ChatRecord>,
      get: (chatId: string) =>
        ipcRenderer.invoke('agents:chats:get', chatId) as Promise<{
          chat: ChatRecord
          messages: MessageRecord[]
          mentions: ChatMentionRecord[]
        } | null>,
      delete: (chatId: string) => ipcRenderer.invoke('agents:chats:delete', chatId) as Promise<boolean>,
      complete: (chatId: string) =>
        ipcRenderer.invoke('agents:chat:complete', chatId) as Promise<{ message: MessageRecord }>,
      completeStream: (chatId: string) =>
        ipcRenderer.invoke('agents:chat:complete-stream', chatId) as Promise<{ message: MessageRecord }>,
      onStreamChunk: (callback: (data: { chatId: string; chunk: string; done: boolean }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { chatId: string; chunk: string; done: boolean }) => callback(data)
        ipcRenderer.on('agents:stream-chunk', handler)
        return () => ipcRenderer.removeListener('agents:stream-chunk', handler)
      },
      updateModel: (payload: { chatId: string; modelId: string }) =>
        ipcRenderer.invoke('agents:chats:update-model', payload) as Promise<ChatRecord | null>,
      updateTitle: (payload: { chatId: string; title: string }) =>
        ipcRenderer.invoke('agents:chat:updateTitle', payload) as Promise<ChatRecord | null>,
      generateTitle: (payload: { chatId: string; userMessage: string }) =>
        ipcRenderer.invoke('agents:chat:generateTitle', payload) as Promise<{ title: string }>,
      prepareContext: (chatId: string) =>
        ipcRenderer.invoke('agents:chat:prepareContext', chatId) as Promise<ChatContext>,
    },
    messages: {
      list: (chatId: string) =>
        ipcRenderer.invoke('agents:messages:list', chatId) as Promise<MessageRecord[]>,
      append: (payload: {
        id?: string
        chatId: string
        role: 'user' | 'assistant' | 'system'
        content: string
        metadata?: unknown
        tokenUsage?: number
        createdAt?: number
      }) => ipcRenderer.invoke('agents:messages:append', payload) as Promise<MessageRecord>,
    },
    mentions: {
      list: (chatId: string) =>
        ipcRenderer.invoke('agents:mentions:list', chatId) as Promise<ChatMentionRecord[]>,
      add: (payload: { chatId: string; mentionedChatId: string }) =>
        ipcRenderer.invoke('agents:mentions:add', payload) as Promise<ChatMentionRecord[]>,
    },
  },
  compact: {
    start: (payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
    }) =>
      ipcRenderer.invoke('compact:start', payload) as Promise<{
        session: CompactSessionRecord
        compactedChat: CompactedChatRecord
      }>,
    cancel: (sessionId: string) =>
      ipcRenderer.invoke('compact:cancel', sessionId) as Promise<CompactSessionRecord | null>,
    get: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('compact:get', payload) as Promise<CompactedChatRecord | null>,
    getSessionStatus: (sessionId: string) =>
      ipcRenderer.invoke('compact:session:status', sessionId) as Promise<CompactSessionRecord | null>,
    getActiveSession: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('compact:session:active', payload) as Promise<CompactSessionRecord | null>,
    onProgress: (
      callback: (data: {
        sessionId: string
        workspaceId: string
        conversationId: string
        status: string
        progress: number
        currentStep: string | null
        chunksTotal: number
        chunksProcessed: number
      }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          sessionId: string
          workspaceId: string
          conversationId: string
          status: string
          progress: number
          currentStep: string | null
          chunksTotal: number
          chunksProcessed: number
        }
      ) => callback(data)
      ipcRenderer.on('compact:progress', handler)
      return () => ipcRenderer.removeListener('compact:progress', handler)
    },
    getSuggestions: (compactedContent: string) =>
      ipcRenderer.invoke('compact:suggestions', compactedContent) as Promise<
        Array<{ question: string; icon: string }>
      >,
  },
  usage: {
    stats: (since?: number) =>
      ipcRenderer.invoke('usage:stats', since) as Promise<UsageStats>,
    byProvider: (since?: number) =>
      ipcRenderer.invoke('usage:by-provider', since) as Promise<UsageByProvider[]>,
    byModel: (since?: number) =>
      ipcRenderer.invoke('usage:by-model', since) as Promise<UsageByModel[]>,
    byDay: (since?: number) =>
      ipcRenderer.invoke('usage:by-day', since) as Promise<UsageByDay[]>,
    list: (options?: { limit?: number; since?: number; provider?: string; feature?: UsageFeature }) =>
      ipcRenderer.invoke('usage:list', options) as Promise<UsageRecord[]>,
  },
  notes: {
    list: (options?: { limit?: number; offset?: number; search?: string }) =>
      ipcRenderer.invoke('notes:list', options) as Promise<NoteRecord[]>,
    get: (id: string) =>
      ipcRenderer.invoke('notes:get', id) as Promise<NoteRecord | null>,
    create: (payload: { id?: string; title?: string | null; content: string; plainText: string; labels?: string[] }) =>
      ipcRenderer.invoke('notes:create', payload) as Promise<NoteRecord>,
    update: (payload: { id: string; title?: string | null; content?: string; plainText?: string; labels?: string[]; isPinned?: boolean }) =>
      ipcRenderer.invoke('notes:update', payload) as Promise<NoteRecord | null>,
    delete: (id: string) =>
      ipcRenderer.invoke('notes:delete', id) as Promise<boolean>,
    togglePin: (id: string) =>
      ipcRenderer.invoke('notes:toggle-pin', id) as Promise<NoteRecord | null>,
    count: () =>
      ipcRenderer.invoke('notes:count') as Promise<number>,
    labels: () =>
      ipcRenderer.invoke('notes:labels') as Promise<string[]>,
  },
  snippets: {
    list: (options?: { limit?: number; offset?: number; search?: string; language?: string }) =>
      ipcRenderer.invoke('snippets:list', options) as Promise<SnippetRecord[]>,
    get: (id: string) =>
      ipcRenderer.invoke('snippets:get', id) as Promise<SnippetRecord | null>,
    create: (payload: { id?: string; code: string; language: string; title?: string | null; labels?: string[]; sourceContext?: string | null }) =>
      ipcRenderer.invoke('snippets:create', payload) as Promise<SnippetRecord>,
    update: (payload: { id: string; code?: string; language?: string; title?: string | null; labels?: string[]; isPinned?: boolean }) =>
      ipcRenderer.invoke('snippets:update', payload) as Promise<SnippetRecord | null>,
    delete: (id: string) =>
      ipcRenderer.invoke('snippets:delete', id) as Promise<boolean>,
    togglePin: (id: string) =>
      ipcRenderer.invoke('snippets:toggle-pin', id) as Promise<SnippetRecord | null>,
    count: () =>
      ipcRenderer.invoke('snippets:count') as Promise<number>,
    languages: () =>
      ipcRenderer.invoke('snippets:languages') as Promise<{ language: string; count: number }[]>,
    labels: () =>
      ipcRenderer.invoke('snippets:labels') as Promise<string[]>,
    migrate: (snippets: Array<{ id: string; code: string; language: string; createdAt: string }>) =>
      ipcRenderer.invoke('snippets:migrate', snippets) as Promise<number>,
  },
  overview: {
    start: (payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
    }) =>
      ipcRenderer.invoke('overview:start', payload) as Promise<{
        session: OverviewSessionRecord
        overview: ConversationOverviewRecord
      }>,
    cancel: (sessionId: string) =>
      ipcRenderer.invoke('overview:cancel', sessionId) as Promise<OverviewSessionRecord | null>,
    get: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('overview:get', payload) as Promise<ConversationOverviewRecord | null>,
    getSessionStatus: (sessionId: string) =>
      ipcRenderer.invoke('overview:session:status', sessionId) as Promise<OverviewSessionRecord | null>,
    getActiveSession: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('overview:session:active', payload) as Promise<OverviewSessionRecord | null>,
    onProgress: (
      callback: (data: {
        sessionId: string
        workspaceId: string
        conversationId: string
        status: string
        progress: number
        currentStep: string | null
      }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: {
          sessionId: string
          workspaceId: string
          conversationId: string
          status: string
          progress: number
          currentStep: string | null
        }
      ) => callback(data)
      ipcRenderer.on('overview:progress', handler)
      return () => ipcRenderer.removeListener('overview:progress', handler)
    },
    hasApiKey: () => ipcRenderer.invoke('overview:hasApiKey') as Promise<boolean>,
  },
  enhancedOverview: {
    generate: (payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
      options?: { tokenBudget?: number; parallelSections?: number }
    }) => ipcRenderer.invoke('enhanced-overview:generate', payload) as Promise<OverviewStructure>,
  },
  diagram: {
    generate: (payload: {
      type: 'architecture' | 'flowchart' | 'sequence' | 'component' | 'state'
      conversationExcerpt: string
    }) => ipcRenderer.invoke('diagram:generate', payload) as Promise<DiagramSpec>,
  },
  todos: {
    list: (options?: { limit?: number; offset?: number; search?: string }) =>
      ipcRenderer.invoke('todos:list', options) as Promise<TodoRecord[]>,
    get: (date: string) =>
      ipcRenderer.invoke('todos:get', date) as Promise<TodoRecord | null>,
    upsert: (payload: { date: string; content: string; plainText: string }) =>
      ipcRenderer.invoke('todos:upsert', payload) as Promise<TodoRecord>,
    delete: (date: string) =>
      ipcRenderer.invoke('todos:delete', date) as Promise<boolean>,
    count: () =>
      ipcRenderer.invoke('todos:count') as Promise<number>,
    dates: () =>
      ipcRenderer.invoke('todos:dates') as Promise<string[]>,
    search: (query: string) =>
      ipcRenderer.invoke('todos:search', query) as Promise<TodoRecord[]>,
  },
  learnings: {
    save: (payload: {
      workspaceId: string
      conversationId: string
      exercises: unknown[]
      attempts: Record<string, unknown>
      modelUsed: string
      metadata?: unknown
    }) =>
      ipcRenderer.invoke('learnings:save', payload) as Promise<LearningsRecord>,
    get: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('learnings:get', payload) as Promise<LearningsRecord | null>,
    delete: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('learnings:delete', payload) as Promise<boolean>,
    extractConcepts: (payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
    }) => ipcRenderer.invoke('learnings:extract-concepts', payload) as Promise<LearningConcept[]>,
  },
  resources: {
    generate: (payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
      userRequest?: string
      preferredProvider?: string
    }) =>
      ipcRenderer.invoke('resources:generate', payload) as Promise<{
        resources: unknown[]
        topics: string[]
        analysis?: unknown
      }>,
    addMore: (payload: {
      workspaceId: string
      conversationId: string
      title: string
      bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
      existingResources: unknown[]
      userRequest?: string
    }) =>
      ipcRenderer.invoke('resources:add-more', payload) as Promise<{
        resources: unknown[]
        topics: string[]
        analysis?: unknown
      }>,
    get: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('resources:get', payload) as Promise<ResourcesRecord | null>,
    clear: (payload: { workspaceId: string; conversationId: string }) =>
      ipcRenderer.invoke('resources:clear', payload) as Promise<boolean>,
    hasTavilyKey: () =>
      ipcRenderer.invoke('resources:has-tavily-key') as Promise<boolean>,
    hasPerplexityKey: () =>
      ipcRenderer.invoke('resources:has-perplexity-key') as Promise<boolean>,
    hasApiKey: () =>
      ipcRenderer.invoke('resources:has-api-key') as Promise<boolean>,
    getProviderInfo: () =>
      ipcRenderer.invoke('resources:provider-info') as Promise<{
        available: boolean
        provider: string | null
        hasTavily: boolean
        hasPerplexity: boolean
        availableProviders: string[]
      }>,
  },
}

contextBridge.exposeInMainWorld('ipc', api)

export type IpcHandler = typeof api
