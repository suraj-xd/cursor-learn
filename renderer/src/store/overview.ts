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
  load: (args: { workspaceId: string; conversationId: string }) => Promise<void>
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
    load: async ({ workspaceId, conversationId }) => {
      set((state) => ({
        items: {
          ...state.items,
          [conversationId]: state.items[conversationId] ?? { status: 'idle', overview: null, error: null },
        },
      }))
      try {
        const existing = await enhancedOverviewIpc.get({ workspaceId, conversationId })
        if (existing) {
          set((state) => ({
            items: {
              ...state.items,
              [conversationId]: { status: 'ready', overview: existing, error: null },
            },
          }))
        }
      } catch (err) {
        set((state) => ({
          items: {
            ...state.items,
            [conversationId]: {
              status: 'error',
              overview: state.items[conversationId]?.overview ?? null,
              error: err instanceof Error ? err.message : 'Failed to load overview',
            },
          },
        }))
      }
    },
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
