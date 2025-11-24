"use client"

import { create } from 'zustand'
import type { ChatTab } from '@/types/workspace'
import { workspaceService, type WorkspaceProject } from '@/services/workspace'

interface WorkspaceListState {
  projects: WorkspaceProject[]
  isLoading: boolean
  error: string | null
  lastFetched: number | null
  fetchProjects: () => Promise<void>
}

export const useWorkspaceListStore = create<WorkspaceListState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchProjects: async () => {
    const state = get()
    if (state.isLoading) return
    if (state.lastFetched && Date.now() - state.lastFetched < 30000) return

    set({ isLoading: true, error: null })
    try {
      const projects = await workspaceService.listWorkspaces()
      set({ projects, isLoading: false, lastFetched: Date.now() })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch projects',
        isLoading: false 
      })
    }
  }
}))

interface WorkspaceDetailState {
  workspaceId: string | null
  projectName: string
  tabs: ChatTab[]
  selectedId: string | null
  isLoading: boolean
  error: string | null
  _fetchPromise: Promise<void> | null
  
  initialize: (id: string | null, initialTab?: string | null) => void
  setSelectedId: (id: string) => void
  reset: () => void
}

export const useWorkspaceDetailStore = create<WorkspaceDetailState>((set, get) => ({
  workspaceId: null,
  projectName: 'Select a workspace',
  tabs: [],
  selectedId: null,
  isLoading: false,
  error: null,
  _fetchPromise: null,

  initialize: (id, initialTab) => {
    const state = get()
    
    if (state.workspaceId === id && state.tabs.length > 0) {
      if (initialTab && state.selectedId !== initialTab) {
        set({ selectedId: initialTab })
      }
      return
    }

    if (state.workspaceId === id && state.isLoading) {
      return
    }
    
    const projectName = id === 'global' 
      ? 'Global Storage' 
      : id 
        ? `Project ${id.slice(0, 8)}` 
        : 'Select a workspace'

    if (!id) {
      set({ 
        workspaceId: null, 
        projectName,
        selectedId: null,
        tabs: [],
        isLoading: false,
        error: null 
      })
      return
    }

    set({ 
      workspaceId: id, 
      projectName,
      selectedId: initialTab || null,
      tabs: [],
      isLoading: true,
      error: null 
    })

    const fetchPromise = (async () => {
      try {
        const data = await workspaceService.getWorkspaceTabs(id)
        const tabs = data.tabs || []
        const currentState = get()
        
        if (currentState.workspaceId !== id) return
        
        const selectedId = initialTab && tabs.some(t => t.id === initialTab)
          ? initialTab
          : tabs.length > 0 ? tabs[0].id : null

        set({ 
          tabs, 
          isLoading: false,
          selectedId,
          _fetchPromise: null
        })
      } catch (error) {
        const currentState = get()
        if (currentState.workspaceId !== id) return
        
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch workspace',
          isLoading: false,
          _fetchPromise: null
        })
      }
    })()

    set({ _fetchPromise: fetchPromise })
  },

  setSelectedId: (id) => {
    set({ selectedId: id })
  },

  reset: () => {
    set({
      workspaceId: null,
      projectName: 'Select a workspace',
      tabs: [],
      selectedId: null,
      isLoading: false,
      error: null,
      _fetchPromise: null
    })
  }
}))

export const selectSelectedChat = (state: WorkspaceDetailState): ChatTab | undefined => {
  return state.tabs.find(tab => tab.id === state.selectedId)
}

export const workspaceDetailActions = {
  initialize: useWorkspaceDetailStore.getState().initialize,
  setSelectedId: useWorkspaceDetailStore.getState().setSelectedId,
  reset: useWorkspaceDetailStore.getState().reset
}
