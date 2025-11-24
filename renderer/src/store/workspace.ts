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
  
  setWorkspaceId: (id: string | null, initialTab?: string | null) => void
  setSelectedId: (id: string) => void
  fetchTabs: () => Promise<void>
  reset: () => void
}

export const useWorkspaceDetailStore = create<WorkspaceDetailState>((set, get) => ({
  workspaceId: null,
  projectName: 'Select a workspace',
  tabs: [],
  selectedId: null,
  isLoading: false,
  error: null,

  setWorkspaceId: (id, initialTab) => {
    const state = get()
    if (state.workspaceId === id) {
      if (initialTab && state.selectedId !== initialTab) {
        set({ selectedId: initialTab })
      }
      return
    }
    
    const projectName = id === 'global' 
      ? 'Global Storage' 
      : id 
        ? `Project ${id.slice(0, 8)}` 
        : 'Select a workspace'

    set({ 
      workspaceId: id, 
      projectName,
      selectedId: initialTab || null,
      tabs: [],
      isLoading: Boolean(id),
      error: null 
    })

    if (id) {
      get().fetchTabs()
    }
  },

  setSelectedId: (id) => {
    set({ selectedId: id })
  },

  fetchTabs: async () => {
    const { workspaceId } = get()
    if (!workspaceId) return

    set({ isLoading: true, error: null })
    try {
      const data = await workspaceService.getWorkspaceTabs(workspaceId)
      const tabs = data.tabs || []
      const state = get()
      
      set({ 
        tabs, 
        isLoading: false,
        selectedId: state.selectedId || (tabs.length > 0 ? tabs[0].id : null)
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch workspace',
        isLoading: false 
      })
    }
  },

  reset: () => {
    set({
      workspaceId: null,
      projectName: 'Select a workspace',
      tabs: [],
      selectedId: null,
      isLoading: false,
      error: null
    })
  }
}))

export const selectSelectedChat = (state: WorkspaceDetailState): ChatTab | undefined => {
  return state.tabs.find(tab => tab.id === state.selectedId)
}

