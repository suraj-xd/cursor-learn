import { useCallback, useEffect, useRef, useState } from "react"
import { agentsIpc } from "@/lib/agents/ipc"
import type { AgentChatContext } from "@/types/agents"

type ContextStatus = "idle" | "preparing" | "ready" | "error"

type CachedContext = {
  context: AgentChatContext | null
  status: ContextStatus
  error?: string | null
  updatedAt: number
}

type ContextState = {
  context: AgentChatContext | null
  status: ContextStatus
  error: string | null
  stale: boolean
}

const CACHE_KEY = "agent-chat-context-cache"
const CACHE_TTL_MS = 5 * 60 * 1000
const inMemoryCache = new Map<string, CachedContext>()

const readPersistedCache = (): Record<string, CachedContext> => {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, CachedContext>
  } catch {
    return {}
  }
}

const writePersistedCache = (payload: Record<string, CachedContext>) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota issues
  }
}

const getCached = (chatId: string): CachedContext | null => {
  const now = Date.now()
  const fromMemory = inMemoryCache.get(chatId)
  if (fromMemory && now - fromMemory.updatedAt < CACHE_TTL_MS) {
    return fromMemory
  }

  const persisted = readPersistedCache()
  const entry = persisted[chatId]
  if (entry && now - entry.updatedAt < CACHE_TTL_MS) {
    inMemoryCache.set(chatId, entry)
    return entry
  }

  return null
}

const setCached = (chatId: string, payload: CachedContext) => {
  inMemoryCache.set(chatId, payload)
  const persisted = readPersistedCache()
  persisted[chatId] = payload
  writePersistedCache(persisted)
}

export function useAgentContext(chatId: string | null | undefined) {
  const [state, setState] = useState<ContextState>({
    context: null,
    status: "idle",
    error: null,
    stale: false,
  })

  const abortRef = useRef<AbortController | null>(null)
  const lastChatIdRef = useRef<string | null>(null)

  const warm = useCallback(
    async (force = false) => {
      if (!chatId) {
        setState({ context: null, status: "idle", error: null, stale: false })
        return
      }

      const cachedValue = getCached(chatId)
      if (cachedValue && !force) {
        setState({
          context: cachedValue.context,
          status: cachedValue.status,
          error: cachedValue.error || null,
          stale: false,
        })
        if (cachedValue.status === "ready") {
          return
        }
      }

      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller
      lastChatIdRef.current = chatId

      setState((prev) => ({
        context: prev.context ?? cachedValue?.context ?? null,
        status: "preparing",
        error: null,
        stale: !!prev.context || !!cachedValue?.context,
      }))

      try {
        const context = await agentsIpc.chats.prepareContext(chatId)
        if (controller.signal.aborted) return
        const next: CachedContext = {
          context,
          status: "ready",
          error: null,
          updatedAt: Date.now(),
        }
        setCached(chatId, next)
        setState({ context, status: "ready", error: null, stale: false })
      } catch (err) {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : "Unable to prepare context"
        const fallbackContext = cachedValue?.context ?? null
        const next: CachedContext = {
          context: fallbackContext,
          status: fallbackContext ? "ready" : "error",
          error: message,
          updatedAt: Date.now(),
        }
        setCached(chatId, next)
        setState({
          context: fallbackContext,
          status: fallbackContext ? "ready" : "error",
          error: message,
          stale: !!fallbackContext,
        })
      }
    },
    [chatId]
  )

  useEffect(() => {
    if (!chatId) {
      setState({ context: null, status: "idle", error: null, stale: false })
      return
    }
    warm()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [chatId, warm])

  return {
    context: state.context,
    status: state.status,
    error: state.error,
    stale: state.stale,
    refresh: useCallback(() => warm(true), [warm]),
  }
}

export type AgentChatMode = "agent" | "overview" | "interactive" | "resources"

const MODE_STORAGE_KEY = "agent-chat-mode"

export function useAgentChatMode(chatId: string | null | undefined, fallback: AgentChatMode = "agent") {
  const [mode, setMode] = useState<AgentChatMode>(fallback)

  useEffect(() => {
    if (!chatId) return
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(MODE_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as Record<string, AgentChatMode>) : {}
      if (parsed[chatId]) {
        setMode(parsed[chatId])
      } else {
        setMode(fallback)
      }
    } catch {
      setMode(fallback)
    }
  }, [chatId, fallback])

  const updateMode = useCallback(
    (next: AgentChatMode) => {
      setMode(next)
      if (!chatId || typeof window === "undefined") return
      try {
        const raw = window.localStorage.getItem(MODE_STORAGE_KEY)
        const parsed = raw ? (JSON.parse(raw) as Record<string, AgentChatMode>) : {}
        parsed[chatId] = next
        window.localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify(parsed))
      } catch {
        // ignore quota issues
      }
    },
    [chatId]
  )

  return [mode, updateMode] as const
}
