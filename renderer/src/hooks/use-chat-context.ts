import { useCallback, useMemo, useState } from "react"
import { compactIpc } from "@/lib/agents/compact-ipc"
import { workspaceService } from "@/services/workspace"

type AttachmentStatus = "pending" | "compacting" | "ready" | "failed"
export type ChatAttachmentType = "chat" | "composer"

export type ChatAttachment = {
  id: string
  workspaceId: string
  conversationId: string
  title: string
  type: ChatAttachmentType
  status: AttachmentStatus
  content?: string
  messageCount?: number
}

type AttachConversationParams = {
  workspaceId: string
  conversationId: string
  title: string
  type: ChatAttachmentType
}

type UseChatContextOptions = {
  limit?: number
}

export function useChatContext(options: UseChatContextOptions = {}) {
  const { limit = 1 } = options
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])

  const replaceWithLimited = useCallback(
    (next: ChatAttachment[]) => {
      if (limit <= 0) return next
      return next.slice(-limit)
    },
    [limit]
  )

  const attachConversation = useCallback(
    async ({ workspaceId, conversationId, title, type }: AttachConversationParams) => {
      setAttachments((prev) => {
        const filtered = prev.filter((a) => a.id !== conversationId)
        const next: ChatAttachment = {
          id: conversationId,
          workspaceId,
          conversationId,
          title,
          type,
          status: "pending",
        }
        return replaceWithLimited([...filtered, next])
      })

      const setStatus = (status: AttachmentStatus, content?: string, messageCount?: number) => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === conversationId
              ? { ...a, status, content: content ?? a.content, messageCount: messageCount ?? a.messageCount }
              : a
          )
        )
      }

      setStatus("compacting")

      try {
        const cached = await compactIpc.get(workspaceId, conversationId)
        if (cached?.compactedContent) {
          setStatus("ready", cached.compactedContent)
          return
        }

        const conversation = await workspaceService.getConversation(workspaceId, conversationId, type)
        if (!conversation) {
          setStatus("failed")
          return
        }

        const bubbles = conversation.messages.map((m) => ({
          type: m.role as "user" | "ai",
          text: m.text,
          timestamp: m.timestamp,
        }))

        const result = await compactIpc.start({
          workspaceId,
          conversationId,
          title,
          bubbles,
        })

        setStatus("ready", result.compactedChat.compactedContent, conversation.messages.length)
      } catch {
        setStatus("failed")
      }
    },
    [replaceWithLimited]
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
  }, [])

  const readyContexts = useMemo(
    () => attachments.filter((a) => a.status === "ready" && a.content),
    [attachments]
  )

  const getContextForSend = useCallback(() => readyContexts, [readyContexts])

  const isAnyCompacting = useMemo(
    () => attachments.some((a) => a.status === "compacting" || a.status === "pending"),
    [attachments]
  )

  return {
    attachments,
    attachConversation,
    removeAttachment,
    clearAttachments,
    isAnyCompacting,
    getContextForSend,
  }
}
