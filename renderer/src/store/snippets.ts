"use client"

import { create } from "zustand"
import type { Snippet, SnippetCreatePayload, SnippetUpdatePayload, SnippetsListOptions, LanguageCount } from "@/types/snippets"

interface SnippetsState {
  snippets: Snippet[]
  selectedSnippetId: string | null
  editingSnippetId: string | null
  isLoading: boolean
  searchQuery: string
  selectedLanguage: string | null
  languages: LanguageCount[]
  labels: string[]
  hasMore: boolean
  offset: number
  
  setSearchQuery: (query: string) => void
  setSelectedLanguage: (language: string | null) => void
  setSelectedSnippetId: (id: string | null) => void
  setEditingSnippetId: (id: string | null) => void
  
  fetchSnippets: (options?: SnippetsListOptions) => Promise<void>
  fetchMoreSnippets: () => Promise<void>
  fetchLanguages: () => Promise<void>
  fetchLabels: () => Promise<void>
  
  createSnippet: (payload: SnippetCreatePayload) => Promise<Snippet>
  updateSnippet: (payload: SnippetUpdatePayload) => Promise<Snippet | null>
  deleteSnippet: (id: string) => Promise<boolean>
  togglePin: (id: string) => Promise<Snippet | null>
  
  migrateFromLocalStorage: () => Promise<number>
  reset: () => void
}

const LIMIT = 50

export const useSnippetsStore = create<SnippetsState>((set, get) => ({
  snippets: [],
  selectedSnippetId: null,
  editingSnippetId: null,
  isLoading: false,
  searchQuery: "",
  selectedLanguage: null,
  languages: [],
  labels: [],
  hasMore: true,
  offset: 0,

  setSearchQuery: (query) => {
    set({ searchQuery: query, offset: 0, hasMore: true })
    get().fetchSnippets({ search: query })
  },

  setSelectedLanguage: (language) => {
    set({ selectedLanguage: language, offset: 0, hasMore: true })
    get().fetchSnippets({ language: language || undefined })
  },

  setSelectedSnippetId: (id) => {
    set({ selectedSnippetId: id })
  },

  setEditingSnippetId: (id) => {
    set({ editingSnippetId: id })
  },

  fetchSnippets: async (options) => {
    set({ isLoading: true })
    try {
      const { searchQuery, selectedLanguage } = get()
      const snippets = await window.ipc.snippets.list({
        limit: LIMIT,
        offset: 0,
        search: (options?.search ?? searchQuery) || undefined,
        language: (options?.language ?? selectedLanguage) || undefined,
      })
      set({ 
        snippets, 
        offset: snippets.length,
        hasMore: snippets.length === LIMIT,
        isLoading: false 
      })
    } catch (error) {
      console.error("Failed to fetch snippets:", error)
      set({ isLoading: false })
    }
  },

  fetchMoreSnippets: async () => {
    const { hasMore, isLoading, offset, searchQuery, selectedLanguage, snippets } = get()
    if (!hasMore || isLoading) return

    set({ isLoading: true })
    try {
      const moreSnippets = await window.ipc.snippets.list({
        limit: LIMIT,
        offset,
        search: searchQuery || undefined,
        language: selectedLanguage || undefined,
      })
      set({
        snippets: [...snippets, ...moreSnippets],
        offset: offset + moreSnippets.length,
        hasMore: moreSnippets.length === LIMIT,
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to fetch more snippets:", error)
      set({ isLoading: false })
    }
  },

  fetchLanguages: async () => {
    try {
      const languages = await window.ipc.snippets.languages()
      set({ languages })
    } catch (error) {
      console.error("Failed to fetch languages:", error)
    }
  },

  fetchLabels: async () => {
    try {
      const labels = await window.ipc.snippets.labels()
      set({ labels })
    } catch (error) {
      console.error("Failed to fetch labels:", error)
    }
  },

  createSnippet: async (payload) => {
    const snippet = await window.ipc.snippets.create(payload)
    set((state) => ({ snippets: [snippet, ...state.snippets] }))
    get().fetchLanguages()
    return snippet
  },

  updateSnippet: async (payload) => {
    const updated = await window.ipc.snippets.update(payload)
    if (updated) {
      set((state) => ({
        snippets: state.snippets.map((s) => (s.id === updated.id ? updated : s)),
        editingSnippetId: null,
      }))
      get().fetchLanguages()
    }
    return updated
  },

  deleteSnippet: async (id) => {
    const success = await window.ipc.snippets.delete(id)
    if (success) {
      set((state) => ({
        snippets: state.snippets.filter((s) => s.id !== id),
        selectedSnippetId: state.selectedSnippetId === id ? null : state.selectedSnippetId,
        editingSnippetId: state.editingSnippetId === id ? null : state.editingSnippetId,
      }))
      get().fetchLanguages()
    }
    return success
  },

  togglePin: async (id) => {
    const updated = await window.ipc.snippets.togglePin(id)
    if (updated) {
      set((state) => ({
        snippets: state.snippets
          .map((s) => (s.id === updated.id ? updated : s))
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1
            return b.updatedAt - a.updatedAt
          }),
      }))
    }
    return updated
  },

  migrateFromLocalStorage: async () => {
    try {
      const stored = localStorage.getItem("agent-snippets")
      if (!stored) return 0
      
      const snippets = JSON.parse(stored) as Array<{
        id: string
        code: string
        language: string
        createdAt: string
      }>
      
      if (snippets.length === 0) return 0
      
      const migrated = await window.ipc.snippets.migrate(snippets)
      if (migrated > 0) {
        localStorage.removeItem("agent-snippets")
        get().fetchSnippets()
        get().fetchLanguages()
      }
      return migrated
    } catch (error) {
      console.error("Failed to migrate snippets:", error)
      return 0
    }
  },

  reset: () => {
    set({
      snippets: [],
      selectedSnippetId: null,
      editingSnippetId: null,
      isLoading: false,
      searchQuery: "",
      selectedLanguage: null,
      hasMore: true,
      offset: 0,
    })
  },
}))

