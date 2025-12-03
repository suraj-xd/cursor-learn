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
} from './services/agent-storage'
import type { ChatContext } from './services/agent-runtime'

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
}

contextBridge.exposeInMainWorld('ipc', api)

export type IpcHandler = typeof api
