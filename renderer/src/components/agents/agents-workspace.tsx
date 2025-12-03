"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowDown,
  AtSign,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ApiKeyDialog } from "@/components/comman/api-key-dialog";
import { agentsIpc } from "@/lib/agents/ipc";
import { compactIpc, type CompactedChat, type CompactProgress } from "@/lib/agents/compact-ipc";
import { APP_CONFIG } from "@/lib/config";
import type {
  AgentApiKeyMetadata,
  AgentChat,
  AgentChatBundle,
  AgentChatContext,
  AgentMessage,
} from "@/types/agents";
import type { ProviderId } from "@/lib/ai/config";
import { toast } from "@/components/ui/toaster";
import { useMessages } from "@/hooks/use-messages";
import {
  Conversation,
  ConversationContent,
} from "@/components/elements/conversation";
import { AgentResponse } from "./agent-response";
import { ScrollArea } from "../ui/scroll-area";
import { ChatMenu } from "./chat-menu";
import { MentionPopover, type WorkspaceLog } from "./mention-popover";
import {
  getDefaultModel,
  getMaxTokens,
  PROVIDER_PRIORITY,
} from "@/lib/ai/config";
import { workspaceService } from "@/services/workspace";
import { CompactContext } from "./context";
import { ShiningText } from "@/components/comman/shinning-text";
import VerticalCutReveal from "../xd-ui/vertical-cut-reveal";
import { AssistantModelPicker, getInitialModel } from "@/components/workspace/assistant-model-picker";
import { UsageIndicator } from "./usage-indicator";

type MentionedConversation = {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  type: "chat" | "composer";
  wasSummarized: boolean;
  wasCompacted: boolean;
  messageCount?: number;
  compactingStatus?: "pending" | "compacting" | "ready" | "failed";
};

type AttachedContext = {
  id: string;
  title: string;
  type: "chat" | "composer";
  wasSummarized: boolean;
  messageCount?: number;
};

type ComposerState = {
  value: string;
  isSending: boolean;
  mentionedConversations: MentionedConversation[];
};

const defaultComposerState: ComposerState = {
  value: "",
  isSending: false,
  mentionedConversations: [],
};

const MAX_CONTEXT_TOKENS = 4000;

type DebugLog = {
  id: string;
  level: "info" | "error";
  message: string;
  timestamp: number;
};

export function AgentsWorkspace() {
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get("chat");

  const [chats, setChats] = useState<AgentChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId);
  const [bundle, setBundle] = useState<AgentChatBundle | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState(defaultComposerState);
  const [apiKeys, setApiKeys] = useState<AgentApiKeyMetadata[]>([]);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [isLoadingMention, setIsLoadingMention] = useState(false);
  const [workspaceLogs, setWorkspaceLogs] = useState<WorkspaceLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [contextPreview, setContextPreview] = useState<AgentChatContext | null>(
    null
  );
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [availableProviders, setAvailableProviders] = useState<ProviderId[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("google");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.0-flash");
  const [mentionCompactProgress, setMentionCompactProgress] = useState<Record<string, CompactProgress | null>>({});
  const [usageRefreshTrigger, setUsageRefreshTrigger] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pushDebug = useCallback((level: DebugLog["level"], message: string) => {
    setDebugLogs((prev) => {
      const entry: DebugLog = {
        id: crypto.randomUUID(),
        level,
        message,
        timestamp: Date.now(),
      };
      return [entry, ...prev].slice(0, 20);
    });
  }, []);

  const loadWorkspaceLogs = useCallback(async () => {
    if (workspaceLogs.length > 0 || isLoadingLogs) return;
    setIsLoadingLogs(true);
    try {
      const ipc = window.ipc;
      if (ipc) {
        const logs = await ipc.workspace.logs();
        setWorkspaceLogs(logs || []);
      }
    } catch (err) {
      pushDebug("error", "Failed to load workspace conversations");
    } finally {
      setIsLoadingLogs(false);
    }
  }, [workspaceLogs.length, isLoadingLogs, pushDebug]);

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await agentsIpc.apiKeys.list();
      setApiKeys(keys);
      pushDebug("info", `Loaded ${keys.length} API key(s)`);

      const providers = keys
        .map((k) => k.provider as ProviderId)
        .filter((p) => PROVIDER_PRIORITY.includes(p));
      const sortedProviders = Array.from(new Set(providers)).sort(
        (a, b) => PROVIDER_PRIORITY.indexOf(a) - PROVIDER_PRIORITY.indexOf(b)
      );
      setAvailableProviders(sortedProviders);

      if (sortedProviders.length > 0) {
        const initial = getInitialModel(sortedProviders);
        setSelectedProvider(initial.provider);
        setSelectedModel(initial.model);
      }
    } catch (err) {
      pushDebug(
        "error",
        err instanceof Error ? err.message : "Failed to load API keys"
      );
      toast.error("Unable to load API keys");
    }
  }, [pushDebug]);

  const hasProviderKey = useMemo(() => {
    return apiKeys.some((key) => PROVIDER_PRIORITY.includes(key.provider as ProviderId));
  }, [apiKeys]);

  const preferredProvider = useMemo((): ProviderId | null => {
    for (const provider of PROVIDER_PRIORITY) {
      if (apiKeys.some((key) => key.provider === provider)) {
        return provider;
      }
    }
    return null;
  }, [apiKeys]);

  const ensureApiKey = useCallback(
    (provider: ProviderId) => {
      const hasKey = apiKeys.some((key) => key.provider === provider);
      if (!hasKey) {
        setShowApiKeyDialog(true);
        pushDebug("error", `Missing API key for provider: ${provider}`);
        toast.error("Add an API key in Settings to use agents");
      }

      return hasKey;
    },
    [apiKeys, pushDebug]
  );

  const fetchChats = useCallback(async () => {
    setIsLoadingChats(true);
    try {
      const data = await agentsIpc.chats.list({ limit: 200 });
      setChats(data);

      if (data.length > 0 && !selectedChatId) {
        setSelectedChatId(data[0].id);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load chats";
      pushDebug("error", message);
      toast.error(message);
    } finally {
      setIsLoadingChats(false);
    }
  }, [pushDebug, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      setContextPreview(null);
      return;
    }

    let cancelled = false;
    setIsLoadingContext(true);

    agentsIpc.chats
      .prepareContext(selectedChatId)
      .then((ctx) => {
        if (!cancelled) {
          setContextPreview(ctx);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to prepare context";
          pushDebug("error", message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingContext(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChatId, pushDebug]);

  useEffect(() => {
    loadApiKeys();
    fetchChats();
  }, [fetchChats, loadApiKeys]);

  useEffect(() => {
    const chatFromUrl = searchParams.get("chat");
    if (chatFromUrl && chatFromUrl !== selectedChatId) {
      setSelectedChatId(chatFromUrl);
    }
  }, [searchParams, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      setBundle(null);
      return;
    }

    let cancelled = false;
    setIsLoadingMessages(true);
    setAssistantError(null);

    agentsIpc.chats
      .get(selectedChatId)
      .then((chatBundle) => {
        if (cancelled) return;
        if (!chatBundle) {
          setBundle(null);
          return;
        }
        setBundle(chatBundle);
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to load chat";
          pushDebug("error", message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingMessages(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pushDebug, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId) {
      setContextPreview(null);
      return;
    }

    let cancelled = false;
    setIsLoadingContext(true);

    agentsIpc.chats
      .prepareContext(selectedChatId)
      .then((ctx) => {
        if (!cancelled) {
          setContextPreview(ctx);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to prepare context";
          pushDebug("error", message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingContext(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedChatId, pushDebug]);

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return chats;
    }
    return chats.filter((chat) => chat.title.toLowerCase().includes(query));
  }, [search, chats]);

  const handleCreateChat = async () => {
    if (isCreatingChat || availableProviders.length === 0) {
      if (availableProviders.length === 0) {
        setShowApiKeyDialog(true);
        toast.error("Add an API key in Settings to use agents");
      }
      return;
    }

    setIsCreatingChat(true);
    setAssistantError(null);
    try {
      const newChat = await agentsIpc.chats.create({
        title: "Untitled chat",
        modelId: `${selectedProvider}:${selectedModel}`,
        provider: selectedProvider,
      });

      setChats((prev) => [newChat, ...prev]);
      setSelectedChatId(newChat.id);
      setBundle({ chat: newChat, messages: [], mentions: [] });
      toast.success("Chat created");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create chat";
      pushDebug("error", message);
      toast.error(message);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleModelSelect = useCallback((provider: ProviderId, modelId: string) => {
    setSelectedProvider(provider);
    setSelectedModel(modelId);
  }, []);

  const handleModelChange = useCallback(
    async (modelId: string, newProvider?: ProviderId) => {
      if (!selectedChatId || !bundle?.chat) {
        return;
      }

      const provider = newProvider || bundle.chat.provider;

      if (newProvider && !ensureApiKey(newProvider)) {
        return;
      }

      try {
        const fullModelId = `${provider}:${modelId}`;
        const updatedChat = await agentsIpc.chats.updateModel({
          chatId: selectedChatId,
          modelId: fullModelId,
        });

        if (updatedChat) {
          setBundle((prev) =>
            prev
              ? {
                  ...prev,
                  chat: { ...updatedChat, provider },
                }
              : prev
          );
          setChats((prev) =>
            prev.map((chat) =>
              chat.id === selectedChatId ? { ...updatedChat, provider } : chat
            )
          );
          toast.success(`Switched to ${modelId}`);
          pushDebug(
            "info",
            `Model changed to ${modelId}${
              newProvider ? ` (${newProvider})` : ""
            }`
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to change model";
        pushDebug("error", message);
        toast.error(message);
      }
    },
    [selectedChatId, bundle?.chat, pushDebug, ensureApiKey]
  );

  const currentModelId = useMemo(() => {
    if (!bundle?.chat?.modelId) {
      return bundle?.chat?.provider
        ? getDefaultModel(bundle.chat.provider as ProviderId, "chat")
        : null;
    }
    const parts = bundle.chat.modelId.split(":");
    return parts.length > 1 ? parts[1] : parts[0];
  }, [bundle?.chat?.modelId, bundle?.chat?.provider]);

  const fullModelId = useMemo(
    () => `${selectedProvider}:${selectedModel}`,
    [selectedProvider, selectedModel]
  );

  const anyMentionCompacting = useMemo(
    () => composer.mentionedConversations.some((m) => m.compactingStatus === "compacting"),
    [composer.mentionedConversations]
  );

  const requestAssistantCompletion = useCallback(
    async (chatId: string) => {
      if (!chatId) {
        return;
      }
      setAssistantBusy(true);
      setAssistantError(null);
      setStreamingContent("");
      pushDebug("info", "Requesting assistant response (streaming)");

      const unsubscribe = agentsIpc.chats.onStreamChunk(
        ({ chatId: chunkChatId, chunk, done }) => {
          if (chunkChatId !== chatId) return;
          if (!done && chunk) {
            setStreamingContent((prev) => prev + chunk);
          }
        }
      );

      try {
        const { message } = await agentsIpc.chats.completeStream(chatId);
        setStreamingContent("");
        setBundle((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages, message],
              }
            : prev
        );
        pushDebug("info", "Assistant response received");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to reach assistant";
        setAssistantError(message);
        toast.error(message);
        pushDebug("error", message);
      } finally {
        unsubscribe();
        setAssistantBusy(false);
        setStreamingContent("");
        setUsageRefreshTrigger((prev) => prev + 1);
        fetchChats();
      }
    },
    [fetchChats, pushDebug]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      try {
        await agentsIpc.chats.delete(chatId);
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (selectedChatId === chatId) {
          setSelectedChatId(null);
          setBundle(null);
        }
        toast.success("Chat deleted");
        pushDebug("info", `Deleted chat ${chatId}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to delete chat";
        pushDebug("error", message);
        toast.error(message);
        throw err;
      }
    },
    [selectedChatId, pushDebug]
  );

  const handleMentionSelect = useCallback(
    async (log: WorkspaceLog) => {
      setMentionOpen(false);
      setMentionQuery("");
      setIsLoadingMention(true);

      try {
        const conversation = await workspaceService.getConversation(
          log.workspaceId,
          log.id,
          log.type
        );
        if (!conversation) {
          throw new Error("Conversation not found");
        }

        setComposer((prev) => {
          const valueWithoutMention = prev.value
            .replace(/@[^\n]*$/, "")
            .trimEnd();
          return {
            ...prev,
            value: valueWithoutMention,
            mentionedConversations: [
              ...prev.mentionedConversations.filter((m) => m.id !== log.id),
              {
                id: log.id,
                workspaceId: log.workspaceId,
                title: conversation.title,
                content: "",
                type: log.type,
                wasSummarized: false,
                wasCompacted: false,
                messageCount: conversation.messages.length,
                compactingStatus: "pending",
              },
            ],
          };
        });

        pushDebug("info", `Starting compaction for "${conversation.title}"`);

        const existingCompacted = await compactIpc.get(log.workspaceId, log.id);
        if (existingCompacted) {
          setComposer((prev) => ({
            ...prev,
            mentionedConversations: prev.mentionedConversations.map((m) =>
              m.id === log.id
                ? {
                    ...m,
                    content: existingCompacted.compactedContent,
                    wasCompacted: true,
                    compactingStatus: "ready" as const,
                  }
                : m
            ),
          }));
          pushDebug("info", `Using cached compact for "${conversation.title}"`);
          setIsLoadingMention(false);
          return;
        }

        setMentionCompactProgress((prev) => ({
          ...prev,
          [log.id]: { sessionId: "", workspaceId: log.workspaceId, conversationId: log.id, status: "pending", progress: 0, currentStep: "Starting...", chunksTotal: 0, chunksProcessed: 0 },
        }));

        setComposer((prev) => ({
          ...prev,
          mentionedConversations: prev.mentionedConversations.map((m) =>
            m.id === log.id ? { ...m, compactingStatus: "compacting" as const } : m
          ),
        }));

        const bubbles = conversation.messages.map((m) => ({
          type: m.role as "user" | "ai",
          text: m.text,
          timestamp: m.timestamp,
        }));

        const result = await compactIpc.start({
          workspaceId: log.workspaceId,
          conversationId: log.id,
          title: conversation.title,
          bubbles,
        });

        setComposer((prev) => ({
          ...prev,
          mentionedConversations: prev.mentionedConversations.map((m) =>
            m.id === log.id
              ? {
                  ...m,
                  content: result.compactedChat.compactedContent,
                  wasCompacted: true,
                  compactingStatus: "ready" as const,
                }
              : m
          ),
        }));

        setMentionCompactProgress((prev) => {
          const next = { ...prev };
          delete next[log.id];
          return next;
        });

        pushDebug("info", `Compacted "${conversation.title}" successfully`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load conversation";
        pushDebug("error", message);

        setComposer((prev) => ({
          ...prev,
          mentionedConversations: prev.mentionedConversations.map((m) =>
            m.id === log.id ? { ...m, compactingStatus: "failed" as const } : m
          ),
        }));

        toast.error(message);
      } finally {
        setIsLoadingMention(false);
      }
    },
    [pushDebug]
  );

  const handleRemoveMention = useCallback((conversationId: string) => {
    setComposer((prev) => ({
      ...prev,
      mentionedConversations: prev.mentionedConversations.filter(
        (m) => m.id !== conversationId
      ),
    }));
  }, []);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setComposer((prev) => ({ ...prev, value }));

      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);

      if (mentionOpen) {
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");
        if (lastAtIndex !== -1) {
          const queryAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
          if (!queryAfterAt.includes("\n")) {
            setMentionQuery(queryAfterAt);
            return;
          }
        }
        setMentionOpen(false);
        setMentionQuery("");
      } else {
        const mentionMatch = textBeforeCursor.match(/@([^\n]*)$/);
        if (mentionMatch && !mentionMatch[1].includes("@")) {
          setMentionQuery(mentionMatch[1]);
          loadWorkspaceLogs();
          setMentionPosition({
            top: -280,
            left: 0,
          });
          setMentionOpen(true);
        }
      }
    },
    [mentionOpen, loadWorkspaceLogs]
  );

  const handleSendMessage = async () => {
    if (!selectedChatId || composer.isSending) {
      return;
    }
    if (!bundle?.chat) {
      toast.error("Select a chat to continue");
      return;
    }
    if (!ensureApiKey(bundle.chat.provider as ProviderId)) {
      return;
    }

    const trimmed = composer.value.trim();
    if (!trimmed) {
      return;
    }

    setComposer((prev) => ({ ...prev, isSending: true }));
    setAssistantError(null);

    const attachedContexts: AttachedContext[] =
      composer.mentionedConversations.map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        wasSummarized: m.wasSummarized,
        messageCount: m.messageCount,
      }));

    if (composer.mentionedConversations.length > 0) {
      const contextSection = composer.mentionedConversations
        .map(
          (m) =>
            `--- Referenced Conversation: "${m.title}" (${m.type}) ---\n${m.content}\n--- End Referenced Conversation ---`
        )
        .join("\n\n");

      const systemContext = await agentsIpc.messages.append({
        chatId: selectedChatId,
        role: "system",
        content: `The user is referencing the following Cursor AI conversation history for context. Use this to understand their previous work and provide relevant assistance:\n\n${contextSection}`,
      });

      setBundle((prev) =>
        prev ? { ...prev, messages: [...prev.messages, systemContext] } : prev
      );
    }

    try {
      const message = await agentsIpc.messages.append({
        chatId: selectedChatId,
        role: "user",
        content: trimmed,
        metadata:
          attachedContexts.length > 0 ? { attachedContexts } : undefined,
      });

      const isFirstMessage = bundle.messages.length === 0;
      const shouldGenerateTitle =
        isFirstMessage && bundle.chat.title === "Untitled chat";

      setBundle((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, message],
            }
          : prev
      );

      if (shouldGenerateTitle) {
        agentsIpc.chats
          .generateTitle({
            chatId: selectedChatId,
            userMessage: trimmed,
          })
          .then(({ title }) => {
            setBundle((prev) =>
              prev && prev.chat.id === selectedChatId
                ? { ...prev, chat: { ...prev.chat, title } }
                : prev
            );
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === selectedChatId ? { ...chat, title } : chat
              )
            );
          })
          .catch(() => {
            pushDebug("error", "Failed to generate title");
          });
      }

      setComposer(defaultComposerState);
      await requestAssistantCompletion(selectedChatId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to send message";
      setComposer((prev) => ({ ...prev, isSending: false }));
      toast.error(message);
      pushDebug("error", message);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionOpen(false);
        setMentionQuery("");
        return;
      }
      if (["ArrowUp", "ArrowDown", "Tab"].includes(event.key)) {
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const selectedChatTitle = bundle?.chat.title ?? "Select a chat";

  return (
    <div className="flex h-[calc(100vh-58px)] gap-4 rounded-xl border border-border bg-card p-4">
      <aside className="flex w-64 shrink-0 flex-col gap-3">
        <Button
          size="sm"
          className="w-full text-sm"
          onClick={handleCreateChat}
          disabled={isCreatingChat}
        >
          {isCreatingChat ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-2 h-3.5 w-3.5" />
          )}
          {isCreatingChat ? "Creating…" : "New chat"}
        </Button>
        <div className="relative">
          <Input
            placeholder="Search chats…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 pl-8 text-sm"
          />
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="flex flex-col gap-0.5">
            {isLoadingChats && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoadingChats && filteredChats.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No chats
              </div>
            )}
            {filteredChats.map((chat) => {
              const isActive = chat.id === selectedChatId;
              return (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors cursor-pointer ${
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedChatId(chat.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(chat.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <ChatMenu
                    chatId={chat.id}
                    chatTitle={chat.title}
                    onDelete={handleDeleteChat}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/40 bg-background/50">
        <header className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selectedChatTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {availableProviders.length > 0 && (
              <AssistantModelPicker
                availableProviders={availableProviders}
                selectedProvider={bundle?.chat.provider as ProviderId || selectedProvider}
                selectedModel={currentModelId || selectedModel}
                onSelect={(provider, model) => {
                  if (bundle?.chat) {
                    handleModelChange(model, provider);
                  } else {
                    handleModelSelect(provider, model);
                  }
                }}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fetchChats()}
              disabled={isLoadingChats}
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${
                  isLoadingChats ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          {!hasProviderKey && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Add an API key in Settings before chatting.</span>
            </div>
          )}

          {!bundle && !isLoadingMessages && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {chats.length === 0 ? "No chats yet" : "Select a chat"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {chats.length === 0
                  ? "Create a new chat to begin"
                  : "Choose from the sidebar"}
              </p>
            </div>
          )}

          {isLoadingMessages && (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {bundle && (
            <>
              <MessagesView
                messages={bundle.messages}
                isLoading={assistantBusy}
                streamingContent={streamingContent}
              />

              <div className="border-t border-border/40 p-3">
                {assistantError && (
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <span className="truncate">{assistantError}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        selectedChatId &&
                        requestAssistantCompletion(selectedChatId)
                      }
                      disabled={assistantBusy}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {composer.mentionedConversations.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {composer.mentionedConversations.map((m) => (
                      <Badge
                        key={m.id}
                        variant="secondary"
                        className={`gap-1 pr-1 text-xs ${
                          m.compactingStatus === "compacting" ? "animate-pulse" : ""
                        }`}
                      >
                        {m.compactingStatus === "compacting" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <AtSign className="h-3 w-3" />
                        )}
                        <span className="max-w-24 truncate">{m.title}</span>
                        {m.wasCompacted && (
                          <span className="text-[10px] text-emerald-500">✓</span>
                        )}
                        {m.compactingStatus === "failed" && (
                          <span className="text-[10px] text-destructive">!</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveMention(m.id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                          disabled={m.compactingStatus === "compacting"}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <MentionPopover
                      isOpen={mentionOpen}
                      onClose={() => {
                        setMentionOpen(false);
                        setMentionQuery("");
                      }}
                      conversations={workspaceLogs}
                      isLoading={isLoadingLogs}
                      filterQuery={mentionQuery}
                      onSelect={handleMentionSelect}
                      position={mentionPosition}
                    />
                    <textarea
                      ref={textareaRef}
                      className="min-h-[80px] w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={anyMentionCompacting ? "Compacting context..." : "Ask a question… (@ to reference)"}
                      value={composer.value}
                      onChange={handleTextareaChange}
                      onKeyDown={handleKeyDown}
                      disabled={
                        composer.isSending || assistantBusy || isLoadingMention || anyMentionCompacting
                      }
                    />
                    {isLoadingMention && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={
                      composer.isSending ||
                      !composer.value.trim() ||
                      assistantBusy ||
                      isLoadingMention ||
                      anyMentionCompacting
                    }
                    className="h-[80px] w-10 shrink-0"
                  >
                    {composer.isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {anyMentionCompacting ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Compacting context…
                      </span>
                    ) : assistantBusy ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking…
                      </span>
                    ) : (
                      <span>⇧↵ newline</span>
                    )}
                    <UsageIndicator refreshTrigger={usageRefreshTrigger} />
                  </div>
                  {contextPreview && bundle?.chat.modelId && (
                    <CompactContext
                      usedTokens={contextPreview.tokenEstimate}
                      maxTokens={getMaxTokens(bundle.chat.modelId)}
                      modelId={bundle.chat.modelId}
                      messageCount={contextPreview.totalMessages}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
      <ApiKeyDialog
        open={showApiKeyDialog}
        onOpenChange={setShowApiKeyDialog}
        provider="an AI provider (Google, Anthropic, or OpenAI)"
        feature="agents"
      />
    </div>
  );
}

function MessagesView({
  messages,
  isLoading = false,
  streamingContent = "",
}: {
  messages: AgentMessage[];
  isLoading?: boolean;
  streamingContent?: string;
}) {
  const { containerRef, endRef, isAtBottom, scrollToBottom } = useMessages({
    status: isLoading ? "streaming" : "idle",
  });
  const prevMessagesLengthRef = useRef(messages.length);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== "system"),
    [messages]
  );

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    if (isLoading && !streamingContent) {
      wasAtBottomRef.current = isAtBottom;
    }
  }, [isLoading, streamingContent, isAtBottom]);

  useEffect(() => {
    if (isLoading && wasAtBottomRef.current) {
      scrollToBottom();
    }
  }, [isLoading, streamingContent, scrollToBottom]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <Conversation ref={containerRef} className="h-full overflow-y-auto">
        <ConversationContent className="px-4 py-3">
          {visibleMessages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
              {/* <p className="text-sm text-muted-foreground">No messages yet</p> */}
              <div className="flex justify-end items-end flex-col">
                <VerticalCutReveal
                  splitBy="characters"
                  staggerDuration={0.025}
                  staggerFrom="first"
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 21,
                  }}
                  containerClassName="text-3xl"
                >
                  {`TALK TO YOUR`}
                </VerticalCutReveal>
                <VerticalCutReveal
                  splitBy="characters"
                  staggerDuration={0.025}
                  staggerFrom="last"
                  reverse={true}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 21,
                    delay: 0.5,
                  }}
                  containerClassName="font-medium  text-black dark:text-white font-mono"
                  wordLevelClassName=""
                >
                  {`AGENTIC_CODING`}
                </VerticalCutReveal>
                <VerticalCutReveal
                  splitBy="characters"
                  staggerDuration={0.025}
                  staggerFrom="center"
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 21,
                    delay: 1.1,
                  }}
                  containerClassName="mt-1 text-xs text-center text-muted-foreground font-light"
                >
                  {`w // ${APP_CONFIG.name}`}
                </VerticalCutReveal>
              </div>
            </div>
          )}
          {visibleMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex w-full justify-start mb-3">
              <div className="max-w-[80%] min-w-0">
                <div className="rounded-2xl px-3.5 py-2.5 text-sm bg-muted/50">
                  {streamingContent ? (
                    <AgentResponse className="text-sm">
                      {streamingContent}
                    </AgentResponse>
                  ) : (
                    <ShiningText className="text-sm" text="✽ Thinking..." />
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} className="h-4" />
        </ConversationContent>
      </Conversation>
      {!isAtBottom && (
        <Button
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full shadow-lg"
          onClick={() => scrollToBottom()}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDown className="size-4" />
        </Button>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  const metadata = message.metadata as {
    attachedContexts?: AttachedContext[];
  } | null;
  const attachedContexts = metadata?.attachedContexts ?? [];

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[80%] min-w-0 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {attachedContexts.length > 0 && (
          <div
            className={`flex flex-wrap gap-1.5 mb-1.5 ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            {attachedContexts.map((ctx) => (
              <div
                key={ctx.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs"
              >
                {ctx.type === "composer" ? (
                  <svg
                    className="h-3 w-3 text-primary/70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                ) : (
                  <MessageSquare className="h-3 w-3 text-primary/70" />
                )}
                <span className="font-medium text-primary/90 max-w-32 truncate">
                  {ctx.title}
                </span>
                {ctx.messageCount && (
                  <span className="text-primary/50 text-[10px]">
                    {ctx.messageCount} msgs
                  </span>
                )}
                {ctx.wasSummarized && (
                  <span className="text-amber-500 text-[10px]">•</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser
              ? "bg-accent text-primary-foreground"
              : "bg-muted border border-border"
          }`}
        >
          <AgentResponse className="text-sm">{message.content}</AgentResponse>
        </div>
        <p
          className={`mt-1 px-1 text-[11px] text-muted-foreground ${
            isUser ? "text-right" : "text-left"
          }`}
        >
          {formatDistanceToNow(new Date(message.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );
}
