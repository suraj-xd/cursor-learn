"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bot,
  Loader2,
  Send,
  Wand2,
  MoreVertical,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  ArrowUpRightSquare,
  MoreHorizontal,
} from "lucide-react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarClose,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { agentsIpc } from "@/lib/agents/ipc"
import { compactIpc, type CompactedChat, type CompactProgress, type SuggestedQuestion } from "@/lib/agents/compact-ipc"
import { UsageIndicator } from "@/components/agents/usage-indicator"
import type { ChatTab } from "@/types/workspace"
import type { AgentChat } from "@/types/agents"
import type { ProviderId } from "@/lib/ai/config"
import { toast } from "@/components/ui/toaster"
import { Message, MessageContent } from "@/components/elements/message"
import { Response } from "@/components/elements/response"
import { estimateTokenCount } from "@/lib/utils"
import { ApiKeyDialog } from "@/components/comman/api-key-dialog"
import { CompactContext } from "@/components/agents/context"
import { AssistantSuggestedQuestions } from "./assistant-suggested-questions"
import { AssistantModelPicker, getInitialModel } from "./assistant-model-picker"
import { PROVIDER_PRIORITY, getMaxTokens } from "@/lib/ai/config"

interface AssistantSidebarProps {
  open: boolean
  onClose: () => void
  currentConversation?: ChatTab
  workspaceId?: string
}

type AssistantMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

type SidebarState =
  | "no-api-key"
  | "idle"
  | "compacting"
  | "ready"
  | "chatting"

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

export function AssistantSidebar({
  open,
  onClose,
  currentConversation,
  workspaceId,
}: AssistantSidebarProps) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [contextStats, setContextStats] = useState({ tokens: 0, messageCount: 0 })

  const [sidebarState, setSidebarState] = useState<SidebarState>("idle")
  const [compactedChat, setCompactedChat] = useState<CompactedChat | null>(null)
  const [compactProgress, setCompactProgress] = useState<CompactProgress | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([])
  const [chatHistory, setChatHistory] = useState<AgentChat[]>([])
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null)

  const [availableProviders, setAvailableProviders] = useState<ProviderId[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("google")
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash")
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false)
  const [usageRefreshTrigger, setUsageRefreshTrigger] = useState(0)

  const compactingRef = useRef(false)
  const conversationIdRef = useRef<string | null>(null)
  const pendingSendRef = useRef<{ message: string; context?: string } | null>(null)

  const fullModelId = useMemo(() => `${selectedProvider}:${selectedModel}`, [selectedProvider, selectedModel])
  const maxTokens = useMemo(() => getMaxTokens(fullModelId), [fullModelId])

  const loadSuggestedQuestions = useCallback(async (content: string) => {
    try {
      const questions = await compactIpc.getSuggestions(content)
      setSuggestedQuestions(questions)
    } catch {
      console.error("Failed to load suggestions")
    }
  }, [])

  const refreshSuggestions = useCallback(async () => {
    if (!compactedChat?.compactedContent) return
    setIsRefreshingSuggestions(true)
    try {
      const questions = await compactIpc.getSuggestions(compactedChat.compactedContent)
      setSuggestedQuestions(questions)
    } catch {
      console.error("Failed to refresh suggestions")
    } finally {
      setIsRefreshingSuggestions(false)
    }
  }, [compactedChat?.compactedContent])

  const getSystemContext = useCallback(() => {
    if (compactedChat) {
      return `You are helping the user understand and work with their Cursor AI conversation. Here is a comprehensive summary of the conversation they're viewing:\n\n--- Conversation Summary: "${currentConversation?.title}" ---\n${compactedChat.compactedContent}\n--- End Summary ---\n\nProvide helpful insights, answer questions, explain code, or help with anything related to this conversation. Be concise but thorough.`
    }
    const systemMessage = messages.find((m) => m.role === "system")
    return systemMessage?.content || ""
  }, [compactedChat, currentConversation?.title, messages])

  const handleSendWithContext = useCallback(async (messageContent: string, contextContent?: string) => {
    if (!hasApiKey || availableProviders.length === 0) return

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
    }

    setMessages((prev) => [...prev.filter((m) => m.role !== "system"), userMessage])
    setSidebarState("chatting")
    setIsLoading(true)

    try {
      const conversationKey = workspaceId && currentConversation
        ? `${workspaceId}:${currentConversation.id}`
        : null

      let currentChatId = chatId
      const isFirstMessage = !currentChatId

      if (!currentChatId) {
        const chat = await agentsIpc.chats.create({
          title: "New chat",
          modelId: fullModelId,
          provider: selectedProvider,
          workspaceConversationId: conversationKey,
        })
        currentChatId = chat.id
        setChatId(chat.id)

        const context = contextContent || getSystemContext()
        if (context) {
          await agentsIpc.messages.append({
            chatId: currentChatId,
            role: "system",
            content: context,
          })
        }

        if (conversationKey) {
          setChatHistory((prev) => [chat, ...prev])
        }
      }

      await agentsIpc.messages.append({
        chatId: currentChatId,
        role: "user",
        content: userMessage.content,
      })

      const { message: assistantMessage } = await agentsIpc.chats.complete(currentChatId)

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessage.id,
          role: "assistant",
          content: assistantMessage.content,
        },
      ])
      setUsageRefreshTrigger((prev) => prev + 1)

      if (isFirstMessage && currentChatId) {
        agentsIpc.chats
          .generateTitle({ chatId: currentChatId, userMessage: messageContent })
          .then(({ title }) => {
            setChatHistory((prev) =>
              prev.map((c) => (c.id === currentChatId ? { ...c, title } : c))
            )
          })
          .catch(() => {})
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get response")
    } finally {
      setIsLoading(false)
    }
  }, [hasApiKey, availableProviders, workspaceId, currentConversation, chatId, fullModelId, selectedProvider, getSystemContext])

  useEffect(() => {
    if (!open) return

    agentsIpc.apiKeys.list().then((keys) => {
      const providers = keys
        .map((k) => k.provider as ProviderId)
        .filter((p) => PROVIDER_PRIORITY.includes(p))

      const sortedProviders = Array.from(new Set(providers)).sort(
        (a, b) => PROVIDER_PRIORITY.indexOf(a) - PROVIDER_PRIORITY.indexOf(b)
      )

      setAvailableProviders(sortedProviders)

      if (sortedProviders.length > 0) {
        setHasApiKey(true)
        const initial = getInitialModel(sortedProviders)
        setSelectedProvider(initial.provider)
        setSelectedModel(initial.model)
        setSidebarState((prev) => prev === "no-api-key" ? "idle" : prev)
        conversationIdRef.current = null
      } else {
        setHasApiKey(false)
        setSidebarState("no-api-key")
      }
    })
  }, [open])

  useEffect(() => {
    if (!open || !currentConversation || !workspaceId || !hasApiKey) return

    const conversationKey = `${workspaceId}:${currentConversation.id}`
    agentsIpc.chats
      .list({ workspaceConversationId: conversationKey })
      .then(setChatHistory)
      .catch(console.error)
  }, [open, currentConversation, workspaceId, hasApiKey])

  useEffect(() => {
    if (!open || !currentConversation || !workspaceId) {
      setMessages([])
      setChatId(null)
      setContextStats({ tokens: 0, messageCount: 0 })
      setCompactedChat(null)
      setSuggestedQuestions([])
      setCompactProgress(null)
      compactingRef.current = false
      conversationIdRef.current = null
      if (hasApiKey) {
        setSidebarState("idle")
      }
      return
    }

    if (conversationIdRef.current === currentConversation.id) return
    conversationIdRef.current = currentConversation.id

    const applyFallbackContext = () => {
      const conversationContext = currentConversation.bubbles
        .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
        .join("\n\n")

      const messageCount = currentConversation.bubbles.length
      const tokens = estimateTokenCount(conversationContext)

      const contextMessage: AssistantMessage = {
        id: "context",
        role: "system",
        content: `You are helping the user understand and work with their Cursor AI conversation. Here is the conversation they're viewing:\n\n--- Conversation: "${currentConversation.title}" ---\n${conversationContext}\n--- End Conversation ---\n\nProvide helpful insights, summaries, or answer questions about this conversation.`,
      }

      setMessages([contextMessage])
      setContextStats({ tokens, messageCount })
      setSidebarState("ready")
    }

    const startCompaction = async (retryCount = 0) => {
      if (compactingRef.current) return
      compactingRef.current = true
      setSidebarState("compacting")

      try {
        const result = await compactIpc.start({
          workspaceId,
          conversationId: currentConversation.id,
          title: currentConversation.title,
          bubbles: currentConversation.bubbles,
        })

        setCompactedChat(result.compactedChat)
        const tokens = estimateTokenCount(result.compactedChat.compactedContent)
        setContextStats({ tokens, messageCount: currentConversation.bubbles.length })
        setSidebarState("ready")

        loadSuggestedQuestions(result.compactedChat.compactedContent)

        if (pendingSendRef.current) {
          const { message, context } = pendingSendRef.current
          pendingSendRef.current = null
          setTimeout(() => handleSendWithContext(message, context || result.compactedChat.compactedContent), 100)
        }
      } catch {
        console.error("Compaction failed")
        if (retryCount < MAX_RETRIES) {
          compactingRef.current = false
          setTimeout(() => startCompaction(retryCount + 1), RETRY_DELAY_MS * (retryCount + 1))
        } else {
          applyFallbackContext()
        }
      } finally {
        compactingRef.current = false
      }
    }

    const initializeContext = async () => {
      if (!hasApiKey) {
        setSidebarState("no-api-key")
        return
      }

      try {
        const existingCompacted = await compactIpc.get(workspaceId, currentConversation.id)

        if (existingCompacted) {
          setCompactedChat(existingCompacted)
          const tokens = estimateTokenCount(existingCompacted.compactedContent)
          setContextStats({ tokens, messageCount: currentConversation.bubbles.length })
          setSidebarState("ready")

          loadSuggestedQuestions(existingCompacted.compactedContent)
          return
        }

        const activeSession = await compactIpc.getActiveSession(workspaceId, currentConversation.id)
        if (activeSession && (activeSession.status === "pending" || activeSession.status === "processing")) {
          setSidebarState("compacting")
          setCompactProgress({
            sessionId: activeSession.id,
            workspaceId,
            conversationId: currentConversation.id,
            status: activeSession.status,
            progress: activeSession.progress,
            currentStep: activeSession.currentStep,
            chunksTotal: activeSession.chunksTotal,
            chunksProcessed: activeSession.chunksProcessed,
          })
          return
        }

        if (currentConversation.bubbles.length > 0) {
          startCompaction()
        } else {
          applyFallbackContext()
        }
      } catch {
        console.error("Failed to initialize context")
        applyFallbackContext()
      }
    }

    initializeContext()
  }, [open, currentConversation, workspaceId, hasApiKey, loadSuggestedQuestions, handleSendWithContext])

  useEffect(() => {
    if (sidebarState !== "compacting" || !workspaceId || !currentConversation) return

    const unsubscribe = compactIpc.onProgress((data) => {
      if (data.workspaceId !== workspaceId || data.conversationId !== currentConversation.id) return

      setCompactProgress(data)

      if (data.status === "completed") {
        compactIpc.get(workspaceId, currentConversation.id).then((chat) => {
          if (chat) {
            setCompactedChat(chat)
            const tokens = estimateTokenCount(chat.compactedContent)
            setContextStats({ tokens, messageCount: currentConversation.bubbles.length })
            setSidebarState("ready")
            loadSuggestedQuestions(chat.compactedContent)
          }
        })
      } else if (data.status === "failed" || data.status === "cancelled") {
        const conversationContext = currentConversation.bubbles
          .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
          .join("\n\n")

        const contextMessage: AssistantMessage = {
          id: "context",
          role: "system",
          content: `You are helping the user understand and work with their Cursor AI conversation. Here is the conversation they're viewing:\n\n--- Conversation: "${currentConversation.title}" ---\n${conversationContext}\n--- End Conversation ---\n\nProvide helpful insights, summaries, or answer questions about this conversation.`,
        }

        setMessages([contextMessage])
        setSidebarState("ready")
      }
    })

    return unsubscribe
  }, [sidebarState, workspaceId, currentConversation, loadSuggestedQuestions])

  const handleModelSelect = useCallback((provider: ProviderId, modelId: string) => {
    setSelectedProvider(provider)
    setSelectedModel(modelId)
  }, [])

  const handleSelectSuggestion = useCallback((question: string) => {
    if (sidebarState === "compacting") {
      setQueuedMessage(question)
      pendingSendRef.current = { message: question }
      toast.info("Message queued - will send after context is ready")
      return
    }
    handleSendWithContext(question)
  }, [sidebarState, handleSendWithContext])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading || !hasApiKey) return

    const messageContent = input.trim()
    setInput("")

    if (sidebarState === "compacting") {
      setQueuedMessage(messageContent)
      pendingSendRef.current = { message: messageContent }
      toast.info("Message queued - will send after context is ready")
      return
    }

    handleSendWithContext(messageContent)
  }, [input, isLoading, hasApiKey, sidebarState, handleSendWithContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = useCallback(() => {
    setMessages([])
    setChatId(null)
    setSuggestedQuestions([])
    if (compactedChat) {
      loadSuggestedQuestions(compactedChat.compactedContent)
    }
    setSidebarState(hasApiKey ? "ready" : "no-api-key")
  }, [compactedChat, hasApiKey, loadSuggestedQuestions])

  const handleLoadChat = useCallback(async (chatToLoad: AgentChat) => {
    try {
      const bundle = await agentsIpc.chats.get(chatToLoad.id)
      if (!bundle) return

      setChatId(chatToLoad.id)
      setMessages(
        bundle.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
      )
      setSidebarState("chatting")
      setSuggestedQuestions([])

      if (chatToLoad.modelId) {
        const [provider, model] = chatToLoad.modelId.split(":")
        if (provider && model) {
          setSelectedProvider(provider as ProviderId)
          setSelectedModel(model)
        }
      }
    } catch {
      toast.error("Failed to load chat")
    }
  }, [])

  const handleDeleteChat = useCallback(async (e: React.MouseEvent, chatToDelete: AgentChat) => {
    e.stopPropagation()
    try {
      await agentsIpc.chats.delete(chatToDelete.id)
      setChatHistory((prev) => prev.filter((c) => c.id !== chatToDelete.id))
      if (chatId === chatToDelete.id) {
        handleNewChat()
      }
      toast.success("Chat deleted")
    } catch {
      toast.error("Failed to delete chat")
    }
  }, [chatId, handleNewChat])

  const handleOpenInAgents = useCallback((e: React.MouseEvent, chat: AgentChat) => {
    e.stopPropagation()
    onClose()
    router.push(`/agents?chat=${chat.id}`)
  }, [onClose, router])

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== "system"),
    [messages]
  )

  const showSuggestions = sidebarState === "ready" && visibleMessages.length === 0 && suggestedQuestions.length > 0

  return (
    <Sidebar side="right" open={open} width="400px">
      <SidebarHeader className="justify-between">
        <div className="flex items-center gap-2">
          {currentConversation && hasApiKey && availableProviders.length > 0 && (
            <>
              <AssistantModelPicker
                availableProviders={availableProviders}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelect={handleModelSelect}
              />
              <CompactContext
                usedTokens={contextStats.tokens}
                maxTokens={maxTokens}
                messageCount={contextStats.messageCount}
                modelId={fullModelId}
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasApiKey && currentConversation && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleNewChat} className="gap-2 cursor-pointer">
                  <Plus className="h-4 w-4" />
                  New Chat
                </DropdownMenuItem>
                {chatHistory.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Recent Chats
                    </div>
                    {chatHistory.slice(0, 5).map((chat) => (
                      <div key={chat.id} className="flex items-center gap-1 px-2 py-1.5 hover:bg-accent rounded-sm">
                        <button
                          type="button"
                          onClick={() => handleLoadChat(chat)}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate text-xs">
                            {chat.title.replace("Assistant: ", "")}
                          </span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1 hover:bg-muted rounded opacity-60 hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => handleOpenInAgents(e as unknown as React.MouseEvent, chat)}
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <ArrowUpRightSquare className="h-3.5 w-3.5" />
                              Open in Agents
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleDeleteChat(e as unknown as React.MouseEvent, chat)}
                              className="gap-2 cursor-pointer text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <SidebarClose onClick={onClose} />
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        {sidebarState === "no-api-key" ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-2">
                API key required to use the assistant.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowApiKeyDialog(true)}
              >
                Add API Key
              </Button>
            </div>
          </div>
        ) : sidebarState === "compacting" ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-12 h-12">
                <Wand2 className="h-8 w-8 mx-auto text-primary animate-pulse" />
                <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-primary/70 animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-medium">Preparing smart context...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {compactProgress?.currentStep === "mapping"
                    ? `Processing chunk ${compactProgress.chunksProcessed}/${compactProgress.chunksTotal}`
                    : compactProgress?.currentStep === "reducing"
                    ? "Combining insights..."
                    : "Analyzing conversation..."}
                </p>
              </div>
              {compactProgress && (
                <div className="w-32 mx-auto h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${compactProgress.progress}%` }}
                  />
                </div>
              )}
              {queuedMessage && (
                <p className="text-xs text-muted-foreground italic">
                  Your message is queued and will be sent shortly...
                </p>
              )}
            </div>
          </div>
        ) : sidebarState === "idle" && !currentConversation ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="text-sm font-medium mb-1">Assistant</h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Select a conversation to get AI-powered insights.
              </p>
            </div>
          </div>
        ) : showSuggestions ? (
          <div className="flex-1 flex flex-col p-4 justify-end items-end">
            {/* <div className="text-center mb-4">
              <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary/50" />
              <p className="text-xs text-muted-foreground">
                Ask about this conversation
              </p>
            </div> */}
            <AssistantSuggestedQuestions
              questions={suggestedQuestions}
              onSelect={handleSelectSuggestion}
              onRefresh={refreshSuggestions}
              isRefreshing={isRefreshingSuggestions}
            />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/50" />
              <h3 className="text-sm font-medium mb-1">Ready to help</h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Ask me anything about this conversation.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-3 py-3">
              {visibleMessages.map((msg) => (
                <Message key={msg.id} from={msg.role === "user" ? "user" : "assistant"}>
                  <MessageContent
                    className={
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-2xl px-3 py-2"
                        : "bg-transparent px-0 py-0"
                    }
                  >
                    {msg.role === "assistant" ? (
                      <Response className="text-sm">{msg.content}</Response>
                    ) : (
                      msg.content
                    )}
                  </MessageContent>
                </Message>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex gap-2">
          <textarea
            placeholder={
              !hasApiKey
                ? "Add API key to start"
                : sidebarState === "compacting"
                ? "Preparing context..."
                : currentConversation
                ? "Ask anything..."
                : "Select a conversation"
            }
            className="flex-1 min-h-[40px] max-h-24 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasApiKey || isLoading || (!currentConversation && sidebarState !== "chatting")}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!hasApiKey || isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1">
          {!hasApiKey ? (
            <button
              type="button"
              onClick={() => setShowApiKeyDialog(true)}
              className="text-[10px] text-amber-500 hover:underline"
            >
              Add API key to get started →
            </button>
          ) : (
            <span />
          )}
          {hasApiKey && <UsageIndicator refreshTrigger={usageRefreshTrigger} />}
        </div>
      </SidebarFooter>

      <ApiKeyDialog
        open={showApiKeyDialog}
        onOpenChange={setShowApiKeyDialog}
        provider="an AI provider"
        feature="the assistant"
      />
    </Sidebar>
  )
}
