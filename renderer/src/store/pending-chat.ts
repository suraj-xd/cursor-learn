"use client"

import { AgentChatMode } from "@/types/agents"
import { create } from "zustand"
export type PendingChat = {
  chatId: string
  needsCompletion: boolean
  mode: AgentChatMode
  createdAt: number
}

type PendingChatState = {
  pending: Record<string, PendingChat>
  setPending: (chatId: string, mode: AgentChatMode) => void
  consume: (chatId: string) => PendingChat | null
  clearAll: () => void
}

export const usePendingChatStore = create<PendingChatState>((set, get) => ({
  pending: {},

  setPending: (chatId, mode) => {
    set((state) => ({
      pending: {
        ...state.pending,
        [chatId]: {
          chatId,
          mode,
          needsCompletion: true,
          createdAt: Date.now(),
        },
      },
    }))
  },

  consume: (chatId) => {
    const current = get().pending[chatId]
    if (!current) return null
    set((state) => {
      const next = { ...state.pending }
      delete next[chatId]
      return { pending: next }
    })
    return current
  },

  clearAll: () => set({ pending: {} }),
}))

export const pendingChatActions = {
  setPending: usePendingChatStore.getState().setPending,
  consume: usePendingChatStore.getState().consume,
  clearAll: usePendingChatStore.getState().clearAll,
}
