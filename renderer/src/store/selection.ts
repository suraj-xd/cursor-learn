"use client"

import { create } from "zustand"

export type SelectionSource = "raw-chat" | "agent-chat" | "assistant-sidebar"

export type AttachedSelection = {
  id: string
  text: string
  source: SelectionSource
}

type SelectionState = {
  selection: AttachedSelection | null
  addSelection: (text: string, source: SelectionSource) => void
  clearSelection: () => void
}

const MAX_WORDS = 200

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return `${words.slice(0, maxWords).join(" ")}...`
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selection: null,
  
  addSelection: (text, source) => {
    const trimmed = text.trim()
    if (!trimmed) return
    
    set({
      selection: {
        id: crypto.randomUUID(),
        text: truncateToWords(trimmed, MAX_WORDS),
        source,
      },
    })
  },
  
  clearSelection: () => {
    set({ selection: null })
  },
}))

export const selectionActions = {
  addSelection: useSelectionStore.getState().addSelection,
  clearSelection: useSelectionStore.getState().clearSelection,
}

