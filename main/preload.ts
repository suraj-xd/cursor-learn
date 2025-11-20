import { contextBridge, ipcRenderer } from 'electron'
import type {
  WorkspaceProject,
  WorkspaceDetails,
  WorkspaceTabsPayload,
  WorkspaceLog,
  SearchResult,
} from './services/workspace-service'
import type { EnvironmentInfo } from './services/config-service'

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
  },
  pdf: {
    generate: async (markdown: string, title: string) => {
      const buffer: Buffer = await ipcRenderer.invoke('pdf:generate', { markdown, title })
      return Uint8Array.from(buffer)
    },
  },
}

contextBridge.exposeInMainWorld('ipc', api)

export type IpcHandler = typeof api
