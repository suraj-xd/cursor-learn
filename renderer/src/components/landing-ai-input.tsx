"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FolderIcon,
  FolderOpen,
  Loader2,
  MessageSquare,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useWorkspaceListStore } from "@/store/workspace";
import {
  workspaceService,
  type ConversationPreview,
} from "@/services/workspace";
import { agentsIpc } from "@/lib/agents/ipc";
import { compactIpc } from "@/lib/agents/compact-ipc";
import type { ProviderId } from "@/lib/ai/config";
import { PROVIDER_PRIORITY } from "@/lib/ai/config";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import {
  AssistantModelPicker,
  getInitialModel,
} from "@/components/workspace/assistant-model-picker";
import { AgentModeSelector, type AgentMode } from "@/components/agent-mode-selector";
import { APP_CONFIG } from "@/lib/config";
import { ChatBubbleIcon, FilePlusIcon } from "@radix-ui/react-icons";

type AttachedChat = {
  id: string;
  workspaceId: string;
  title: string;
  type: "chat" | "composer";
  status: "pending" | "compacting" | "ready" | "failed";
  content?: string;
};

const AnthropicLogo = memo(function AnthropicLogo({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 46 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Anthropic"
      role="img"
    >
      <path d="M32.73 0H26.39L38.85 32H45.2L32.73 0Z" />
      <path d="M13.61 0L0 32H6.62L9.29 25.61H22.58L25.26 32H32.73L19.12 0H13.61ZM11.21 20.08L15.94 8.54H16.01L20.74 20.08H11.21Z" />
    </svg>
  );
});

export const LandingAIInput = memo(function LandingAIInput() {
  const router = useRouter();
  const { projects, fetchProjects } = useWorkspaceListStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedChats, setAttachedChats] = useState<AttachedChat[]>([]);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(
    new Set()
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<ProviderId[]>(
    []
  );
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderId>("anthropic");
  const [selectedModel, setSelectedModel] = useState<string>(
    "claude-sonnet-4-20250514"
  );
  const [workspaceConversations, setWorkspaceConversations] = useState<
    Record<string, ConversationPreview[]>
  >({});
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<Set<string>>(
    new Set()
  );
  const [agentMode, setAgentMode] = useState<AgentMode>("agent");

  useEffect(() => {
    fetchProjects();
    agentsIpc.apiKeys.list().then((keys) => {
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
    });
  }, [fetchProjects]);

  const projectsWithConversations = useMemo(
    () =>
      projects
        .filter((p) => p.conversationCount > 0)
        .sort((a, b) => {
          const aLatest = a.conversations[0]?.lastUpdatedAt ?? 0;
          const bLatest = b.conversations[0]?.lastUpdatedAt ?? 0;
          return bLatest - aLatest;
        })
        .slice(0, 10),
    [projects]
  );

  const loadWorkspaceConversations = useCallback(
    async (workspaceId: string) => {
      if (
        workspaceConversations[workspaceId] ||
        loadingWorkspaces.has(workspaceId)
      )
        return;
      setLoadingWorkspaces((prev) => new Set(prev).add(workspaceId));
      try {
        const data = await workspaceService.getWorkspaceTabs(workspaceId);
        setWorkspaceConversations((prev) => ({
          ...prev,
          [workspaceId]: data.tabs.map((t) => ({
            id: t.id,
            name: t.title,
            lastUpdatedAt: Date.now(),
            createdAt: Date.now(),
            messageCount: t.bubbles.length,
            hasEnhancedOverview: false,
          })),
        }));
      } catch {
        toast.error("Failed to load conversations");
      } finally {
        setLoadingWorkspaces((prev) => {
          const next = new Set(prev);
          next.delete(workspaceId);
          return next;
        });
      }
    },
    [workspaceConversations, loadingWorkspaces]
  );

  const toggleWorkspace = useCallback(
    (workspaceId: string) => {
      setExpandedWorkspaces((prev) => {
        const next = new Set(prev);
        if (next.has(workspaceId)) {
          next.delete(workspaceId);
        } else {
          next.add(workspaceId);
          loadWorkspaceConversations(workspaceId);
        }
        return next;
      });
    },
    [loadWorkspaceConversations]
  );

  const handleAttachChat = useCallback(
    async (workspaceId: string, conversationId: string, title: string) => {
      if (attachedChats.some((c) => c.id === conversationId)) {
        setAttachedChats((prev) => prev.filter((c) => c.id !== conversationId));
        return;
      }

      setAttachedChats((prev) => [
        ...prev,
        {
          id: conversationId,
          workspaceId,
          title,
          type: "chat",
          status: "pending",
        },
      ]);
      setDropdownOpen(false);

      setAttachedChats((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, status: "compacting" as const } : c
        )
      );

      try {
        const existingCompacted = await compactIpc.get(
          workspaceId,
          conversationId
        );
        if (existingCompacted) {
          setAttachedChats((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    status: "ready" as const,
                    content: existingCompacted.compactedContent,
                  }
                : c
            )
          );
          return;
        }

        const conversation = await workspaceService.getConversation(
          workspaceId,
          conversationId,
          "chat"
        );
        if (!conversation) throw new Error("Conversation not found");

        const bubbles = conversation.messages.map((m) => ({
          type: m.role as "user" | "ai",
          text: m.text,
          timestamp: m.timestamp,
        }));

        const result = await compactIpc.start({
          workspaceId,
          conversationId,
          title,
          bubbles,
        });

        setAttachedChats((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  status: "ready" as const,
                  content: result.compactedChat.compactedContent,
                }
              : c
          )
        );
      } catch {
        setAttachedChats((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, status: "failed" as const } : c
          )
        );
        toast.error("Failed to prepare context");
      }
    },
    [attachedChats]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachedChats((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && attachedChats.length === 0) return;
    if (availableProviders.length === 0) {
      toast.error("Add an API key in Settings to use agents");
      router.push("/settings/llm");
      return;
    }

    const anyCompacting = attachedChats.some((c) => c.status === "compacting");
    if (anyCompacting) {
      toast.info("Please wait for context to finish loading");
      return;
    }

    setIsLoading(true);

    try {
      const newChat = await agentsIpc.chats.create({
        title: trimmed || "New chat",
        modelId: `${selectedProvider}:${selectedModel}`,
        provider: selectedProvider,
      });

      if (attachedChats.length > 0) {
        const readyChats = attachedChats.filter(
          (c) => c.status === "ready" && c.content
        );
        if (readyChats.length > 0) {
          const contextContent = readyChats
            .map(
              (c) =>
                `--- Referenced Conversation: "${c.title}" ---\n${c.content}\n--- End Referenced Conversation ---`
            )
            .join("\n\n");

          await agentsIpc.messages.append({
            chatId: newChat.id,
            role: "system",
            content: `The user is referencing the following conversations for context:\n\n${contextContent}`,
          });
        }
      }

      if (trimmed) {
        await agentsIpc.messages.append({
          chatId: newChat.id,
          role: "user",
          content: trimmed,
        });
      }

      router.push(`/agents?chat=${newChat.id}`);
    } catch {
      toast.error("Failed to create chat");
      setIsLoading(false);
    }
  }, [
    input,
    attachedChats,
    availableProviders,
    selectedProvider,
    selectedModel,
    router,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const anyCompacting = attachedChats.some((c) => c.status === "compacting");

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden shadow-lg">
        {/* <div className="flex items-center justify-between px-4 py-1 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-sm pb-1.5">
              <span className="text-xl"> {APP_CONFIG.logo} </span> {"ASK ME"}
            </span>
            <span className="font-medium">is free for you to use!</span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/agents")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Explore Cabbins →
          </button>
        </div> */}

        <div className=" px-4 pt-4">
          {attachedChats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedChats.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "gap-1.5 pr-1 text-xs flex items-center px-2 py-1 rounded-md bg-background border border-border",
                    chat.status === "compacting" && "animate-pulse"
                  )}
                >
                  {chat.status === "compacting" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FilePlusIcon className="h-3 w-3 text-green-500" />
                  )}
                  <span className="max-w-48 truncate">{chat.title}</span>
                  {chat.status === "ready" && (
                    <span className="text-[10px] text-emerald-500">✓</span>
                  )}
                  {chat.status === "failed" && (
                    <span className="text-[10px] text-destructive">!</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(chat.id)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    disabled={chat.status === "compacting"}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            placeholder="Ask cursor learn to breakdown your vibecoding, "
            className="w-full min-h-[50px] max-h-[200px] resize-none bg-transparent text-sm font-light placeholder:text-muted-foreground/60 focus:outline-none text-foreground"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between px-4 pb-2">
          <div className="flex justify-start items-center gap-2">
          <div className="flex items-center gap-2">
            <AgentModeSelector value={agentMode} onChange={setAgentMode} />
          </div>
          <div className="flex items-center gap-2">
            {availableProviders.length > 0 ? (
              <AssistantModelPicker
                availableProviders={availableProviders}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onSelect={(provider, model) => {
                  setSelectedProvider(provider);
                  setSelectedModel(model);
                }}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => router.push("/settings/llm")}
              >
                Add API Key
              </Button>
            )}
          </div>
          
          </div>

          <Button
            size="icon"
            className="h-7 w-7 rounded-full bg-muted-foreground"
            onClick={handleSubmit}
            disabled={
              isLoading ||
              anyCompacting ||
              (!input.trim() && attachedChats.length === 0)
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 -rotate-90" />
            )}
          </Button>
        </div>
      </div>

      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <p className="mt-2 pl-4 text-muted-foreground text-xs font-light normal-case flex items-center gap-1 shrink-0 rounded-md px-2 py-1 hover:bg-muted w-fit cursor-pointer transition-colors ">
            <FolderIcon className="h-3 w-3" />
            Select chat
            <ChevronDown className="h-3 w-3" />
          </p>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-0" sideOffset={8}>
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium">Attach Conversations</p>
            <p className="text-xs text-muted-foreground">
              Select chats to include as context
            </p>
          </div>
          <ScrollArea className="h-[300px]">
            <div className="p-2">
              {projectsWithConversations.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No workspaces found
                </div>
              ) : (
                projectsWithConversations.map((project) => (
                  <Collapsible
                    key={project.id}
                    open={expandedWorkspaces.has(project.id)}
                    onOpenChange={() => toggleWorkspace(project.id)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-muted/50 transition-colors">
                      {expandedWorkspaces.has(project.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <span className="flex-1 text-sm font-medium truncate text-left">
                        {project.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {project.conversationCount}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-2 border-l border-border/50 mt-1 space-y-0.5">
                        {loadingWorkspaces.has(project.id) ? (
                          <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading...
                          </div>
                        ) : (
                          (
                            workspaceConversations[project.id] ||
                            project.conversations
                          )
                            .slice(0, 8)
                            .map((conv) => {
                              const isAttached = attachedChats.some(
                                (c) => c.id === conv.id
                              );
                              return (
                                <button
                                  key={conv.id}
                                  type="button"
                                  onClick={() =>
                                    handleAttachChat(
                                      project.id,
                                      conv.id,
                                      conv.name
                                    )
                                  }
                                  className={cn(
                                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
                                    isAttached
                                      ? "bg-primary/10 text-primary"
                                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                                  <span className="flex-1 truncate text-left">
                                    {conv.name}
                                  </span>
                                  {isAttached && (
                                    <span className="text-xs">✓</span>
                                  )}
                                </button>
                              );
                            })
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </div>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
