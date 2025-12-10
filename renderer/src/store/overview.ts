"use client"

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { enhancedOverviewIpc, type OverviewStructure } from '@/lib/agents/enhanced-overview-ipc'

type Status = 'idle' | 'loading' | 'ready' | 'error'

type OverviewState = {
  items: Record<
    string,
    {
      status: Status
      overview: OverviewStructure | null
      error: string | null
    }
  >
  generate: (args: {
    workspaceId: string
    conversationId: string
    title: string
    bubbles: Array<{ type: 'user' | 'ai'; text: string; timestamp?: number }>
  }) => Promise<void>
}

export const useOverviewStore = create<OverviewState>()(
  subscribeWithSelector((set) => ({
    items: {},
    generate: async ({ workspaceId, conversationId, title, bubbles }) => {
      set((state) => ({
        items: {
          ...state.items,
          [conversationId]: { status: 'loading', overview: state.items[conversationId]?.overview ?? null, error: null },
        },
      }))
      try {
        const overview = await enhancedOverviewIpc.generate({ workspaceId, conversationId, title, bubbles })
        set((state) => ({
          items: {
            ...state.items,
            [conversationId]: { status: 'ready', overview, error: null },
          },
        }))
      } catch (err) {
        set((state) => ({
          items: {
            ...state.items,
            [conversationId]: {
              status: 'error',
              overview: state.items[conversationId]?.overview ?? null,
              error: err instanceof Error ? err.message : 'Failed to generate overview',
            },
          },
        }))
      }
    },
  }))
)
