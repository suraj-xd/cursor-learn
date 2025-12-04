"use client"

import { create } from "zustand"
import type { Note, NoteCreatePayload, NoteUpdatePayload, NotesListOptions } from "@/types/notes"

interface NotesState {
  notes: Note[]
  selectedNoteId: string | null
  isLoading: boolean
  searchQuery: string
  labels: string[]
  hasMore: boolean
  offset: number
  
  setSearchQuery: (query: string) => void
  setSelectedNoteId: (id: string | null) => void
  
  fetchNotes: (options?: NotesListOptions) => Promise<void>
  fetchMoreNotes: () => Promise<void>
  fetchLabels: () => Promise<void>
  
  createNote: (payload: NoteCreatePayload) => Promise<Note>
  updateNote: (payload: NoteUpdatePayload) => Promise<Note | null>
  deleteNote: (id: string) => Promise<boolean>
  togglePin: (id: string) => Promise<Note | null>
  
  reset: () => void
}

const LIMIT = 50

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  isLoading: false,
  searchQuery: "",
  labels: [],
  hasMore: true,
  offset: 0,

  setSearchQuery: (query) => {
    set({ searchQuery: query, offset: 0, hasMore: true })
    get().fetchNotes({ search: query })
  },

  setSelectedNoteId: (id) => {
    set({ selectedNoteId: id })
  },

  fetchNotes: async (options) => {
    set({ isLoading: true })
    try {
      const notes = await window.ipc.notes.list({
        limit: LIMIT,
        offset: 0,
        search: options?.search || get().searchQuery || undefined,
      })
      set({ 
        notes, 
        offset: notes.length,
        hasMore: notes.length === LIMIT,
        isLoading: false 
      })
    } catch (error) {
      console.error("Failed to fetch notes:", error)
      set({ isLoading: false })
    }
  },

  fetchMoreNotes: async () => {
    const { hasMore, isLoading, offset, searchQuery, notes } = get()
    if (!hasMore || isLoading) return

    set({ isLoading: true })
    try {
      const moreNotes = await window.ipc.notes.list({
        limit: LIMIT,
        offset,
        search: searchQuery || undefined,
      })
      set({
        notes: [...notes, ...moreNotes],
        offset: offset + moreNotes.length,
        hasMore: moreNotes.length === LIMIT,
        isLoading: false,
      })
    } catch (error) {
      console.error("Failed to fetch more notes:", error)
      set({ isLoading: false })
    }
  },

  fetchLabels: async () => {
    try {
      const labels = await window.ipc.notes.labels()
      set({ labels })
    } catch (error) {
      console.error("Failed to fetch labels:", error)
    }
  },

  createNote: async (payload) => {
    const note = await window.ipc.notes.create(payload)
    set((state) => ({ notes: [note, ...state.notes] }))
    return note
  },

  updateNote: async (payload) => {
    const updated = await window.ipc.notes.update(payload)
    if (updated) {
      set((state) => ({
        notes: state.notes.map((n) => (n.id === updated.id ? updated : n)),
      }))
    }
    return updated
  },

  deleteNote: async (id) => {
    const success = await window.ipc.notes.delete(id)
    if (success) {
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        selectedNoteId: state.selectedNoteId === id ? null : state.selectedNoteId,
      }))
    }
    return success
  },

  togglePin: async (id) => {
    const updated = await window.ipc.notes.togglePin(id)
    if (updated) {
      set((state) => ({
        notes: state.notes
          .map((n) => (n.id === updated.id ? updated : n))
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1
            return b.updatedAt - a.updatedAt
          }),
      }))
    }
    return updated
  },

  reset: () => {
    set({
      notes: [],
      selectedNoteId: null,
      isLoading: false,
      searchQuery: "",
      hasMore: true,
      offset: 0,
    })
  },
}))

