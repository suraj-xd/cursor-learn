"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarClose,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { agentsIpc } from "@/lib/agents/ipc";
import type { ChatTab } from "@/types/workspace";
import { toast } from "@/components/ui/toaster";
import { Message, MessageContent } from "@/components/elements/message";
import { Response } from "@/components/elements/response";
import { estimateTokenCount } from "@/lib/utils";
import { ApiKeyDialog } from "@/components/comman/api-key-dialog";
import { CompactContext } from "@/components/agents/context";

interface AssistantSidebarProps {
  open: boolean;
  onClose: () => void;
  currentConversation?: ChatTab;
}

type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

type CachedContextEntry = {
  message: AssistantMessage;
  stats: { tokens: number; messageCount: number };
};

export function AssistantSidebar({ open, onClose, currentConversation }: AssistantSidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [contextStats, setContextStats] = useState({ tokens: 0, messageCount: 0 });
  const contextCacheRef = useRef<Map<string, CachedContextEntry>>(new Map());

  useEffect(() => {
    if (!open) return;
    
    agentsIpc.apiKeys.list().then((keys) => {
      setHasApiKey(keys.some((k) => k.provider === "openai"));
    });
  }, [open]);

  useEffect(() => {
    if (!open || !currentConversation) {
      setMessages([]);
      setChatId(null);
      setContextStats({ tokens: 0, messageCount: 0 });
      return;
    }

    const cacheKey = currentConversation.id;
    const cached = contextCacheRef.current.get(cacheKey);
    if (cached) {
      setMessages([cached.message]);
      setContextStats(cached.stats);
      return;
    }

    const conversationContext = currentConversation.bubbles
      .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
      .join("\n\n");

    const messageCount = currentConversation.bubbles.length;
    const tokens = estimateTokenCount(conversationContext);

    const contextMessage: AssistantMessage = {
      id: "context",
      role: "system",
      content: `You are helping the user understand and work with their Cursor AI conversation. Here is the conversation they're viewing:\n\n--- Conversation: "${currentConversation.title}" ---\n${conversationContext}\n--- End Conversation ---\n\nProvide helpful insights, summaries, or answer questions about this conversation.`,
    };

    contextCacheRef.current.set(cacheKey, {
      message: contextMessage,
      stats: { tokens, messageCount },
    });

    setMessages([contextMessage]);
    setContextStats({ tokens, messageCount });
  }, [open, currentConversation]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !hasApiKey) return;

    const userMessage: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let currentChatId = chatId;
      
      if (!currentChatId) {
        const chat = await agentsIpc.chats.create({
          title: `Assistant: ${currentConversation?.title || "Quick Chat"}`,
          modelId: "openai:gpt-4o-mini",
          provider: "openai",
        });
        currentChatId = chat.id;
        setChatId(chat.id);

        const systemMessage = messages.find((m) => m.role === "system");
        if (systemMessage) {
          await agentsIpc.messages.append({
            chatId: currentChatId,
            role: "system",
            content: systemMessage.content,
          });
        }
      }

      await agentsIpc.messages.append({
        chatId: currentChatId,
        role: "user",
        content: userMessage.content,
      });

      const { message: assistantMessage } = await agentsIpc.chats.complete(currentChatId);

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessage.id,
          role: "assistant",
          content: assistantMessage.content,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, hasApiKey, chatId, messages, currentConversation?.title]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== "system"),
    [messages]
  );

  return (
    <Sidebar side="right" open={open} width="400px">
      <SidebarHeader className="justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Assistant</span>
          {currentConversation && contextStats.tokens > 0 && (
            <CompactContext
              usedTokens={contextStats.tokens}
              maxTokens={128000}
              messageCount={contextStats.messageCount}
              modelId="openai:gpt-4o-mini"
            />
          )}
        </div>
        <SidebarClose onClick={onClose} />
      </SidebarHeader>
      <SidebarContent className="flex flex-col">
        {!hasApiKey ? (
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
        ) : visibleMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              {/* <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary/50" /> */}
              <h3 className="text-sm font-medium mb-1">
                {currentConversation ? "Ask about this conversation" : "Hello!"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                {currentConversation
                  ? `I've loaded "${currentConversation.title}". Ask me to summarize, explain code, or find insights.`
                  : "Start a conversation to get help."}
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
                      <Response>{msg.content}</Response>
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
              hasApiKey
                ? currentConversation
                  ? "Ask about this conversation..."
                  : "Ask anything..."
                : "Add API key in Agents tab"
            }
            className="flex-1 min-h-[40px] max-h-24 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasApiKey || isLoading}
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
        {!hasApiKey && (
          <button
            type="button"
            onClick={() => setShowApiKeyDialog(true)}
            className="text-[10px] text-amber-500 text-center mt-1 hover:underline"
          >
            Add OpenAI API key →
          </button>
        )}
      </SidebarFooter>
      <ApiKeyDialog
        open={showApiKeyDialog}
        onOpenChange={setShowApiKeyDialog}
        provider="OpenAI"
        feature="the assistant"
      />
    </Sidebar>
  );
}
