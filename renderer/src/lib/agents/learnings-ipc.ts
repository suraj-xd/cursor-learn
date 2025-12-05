import type { Exercise, ExerciseAttempt } from "@/types/learnings"

export type LearningsRecord = {
  id: string
  workspaceId: string
  conversationId: string
  exercises: Exercise[]
  attempts: Record<string, ExerciseAttempt>
  modelUsed: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

const ensureIpc = () => {
  if (typeof window === "undefined" || !window.ipc) {
    throw new Error("IPC bridge unavailable")
  }
  return window.ipc
}

export const learningsIpc = {
  save: async (payload: {
    workspaceId: string
    conversationId: string
    exercises: Exercise[]
    attempts: Record<string, ExerciseAttempt>
    modelUsed: string
    metadata?: unknown
  }): Promise<LearningsRecord> => {
    const ipc = ensureIpc()
    return ipc.learnings.save(payload) as Promise<LearningsRecord>
  },

  get: async (
    workspaceId: string,
    conversationId: string
  ): Promise<LearningsRecord | null> => {
    const ipc = ensureIpc()
    return ipc.learnings.get({ workspaceId, conversationId }) as Promise<LearningsRecord | null>
  },

  delete: async (workspaceId: string, conversationId: string): Promise<boolean> => {
    const ipc = ensureIpc()
    return ipc.learnings.delete({ workspaceId, conversationId })
  },
}
