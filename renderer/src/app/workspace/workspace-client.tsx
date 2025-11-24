"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, PanelLeft, Bot, AsteriskIcon } from "lucide-react";
import Link from "next/link";
import { Loading } from "@/components/ui/loading";
import { DownloadMenu } from "@/components/download-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatTab, ComposerChat } from "@/types/workspace";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { format } from "date-fns";
import { useSettingsStore } from "@/store/settings";
import { codeThemeStyles } from "@/lib/code-themes";
import { CollapsibleCodeBlock } from "@/components/collapsible-code-block";
import { useSidebar } from "@/hooks/use-sidebar";
import { ConversationSidebar } from "@/components/workspace/conversation-sidebar";
import { AssistantSidebar } from "@/components/workspace/assistant-sidebar";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface WorkspaceState {
  projectName: string;
  tabs: ChatTab[];
  composers: ComposerChat[];
  selectedId: string | null;
  isLoading: boolean;
}

export default function WorkspaceClient() {
  const codeTheme = useSettingsStore((state) => state.codeTheme);
  const codeThemeStyle =
    codeThemeStyles[codeTheme] ?? codeThemeStyles.vscDarkPlus;
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceId = searchParams.get("id");
  const initialTab = searchParams.get("tab");

  const {
    leftOpen,
    rightOpen,
    leftCollapsed,
    toggleLeft,
    toggleRight,
    setLeftCollapsed,
    setRightOpen,
  } = useSidebar();

  const [state, setState] = useState<WorkspaceState>({
    projectName:
      workspaceId === "global"
        ? "Global Storage"
        : workspaceId
        ? `Project ${workspaceId.slice(0, 8)}`
        : "Select a workspace",
    tabs: [],
    composers: [],
    selectedId: initialTab,
    isLoading: Boolean(workspaceId),
  });

  const handleSelect = (id: string) => {
    setState((prev) => ({ ...prev, selectedId: id }));
    const query = new URLSearchParams();
    if (workspaceId) {
      query.set("id", workspaceId);
    }
    query.set("tab", id);
    router.replace(`/workspace?${query.toString()}`, { scroll: false });
  };

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId || !window?.ipc) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }
    try {
      const data = await window.ipc.workspace.tabs(workspaceId);
      setState((prev) => ({
        ...prev,
        projectName:
          workspaceId === "global"
            ? "Global Storage"
            : `Project ${workspaceId.slice(0, 8)}`,
        tabs: data.tabs || [],
        composers: data.composers?.allComposers || [],
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to fetch workspace:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        tabs: [],
        composers: [],
        projectName: "Select a workspace",
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      isLoading: true,
      selectedId: initialTab,
    }));
    fetchWorkspace();
  }, [workspaceId, initialTab, fetchWorkspace]);

  useEffect(() => {
    if (!state.selectedId && state.tabs.length > 0) {
      setState((prev) => ({ ...prev, selectedId: state.tabs[0].id }));
    }
  }, [state.tabs, state.selectedId]);

  if (!workspaceId) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>Select a workspace from the home page to view conversations.</p>
        </div>
      </Card>
    );
  }

  if (state.isLoading) {
    return <Loading />;
  }

  const selectedChat = state.tabs.find((tab) => tab.id === state.selectedId);

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-64px)] border border-border rounded-[8px] mx-4 overflow-hidden">
        <ConversationSidebar
          tabs={state.tabs}
          selectedId={state.selectedId}
          onSelect={handleSelect}
          open={leftOpen}
          collapsed={leftCollapsed}
          onToggle={toggleLeft}
          onCollapse={setLeftCollapsed}
        />

        <SidebarInset className="flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              {!leftOpen && (
                <SidebarTrigger side="left" onClick={toggleLeft} />
              )}
              <Button variant="ghost" size="sm" asChild className="gap-2">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4" />
                  Back to workspace
                </Link>
              </Button>
            </div>

            <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border flex justify-start items-center gap-2">
              <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                {state.projectName}
              </h2>
              <p className="text-xs text-green-500 uppercase font-mono">
                {state.tabs.length} conversations
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedChat && <CopyButton tab={selectedChat} />}
              {selectedChat && <DownloadMenu tab={selectedChat} />}
              <Button
                variant={rightOpen ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={toggleRight}
              >
                <AsteriskIcon  className="w-4 h-4" />
                Assistant
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {selectedChat ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border">
                      <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                        Overview
                      </h2>
                    </div>
                    <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border">
                      <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                        Learnings
                      </h2>
                    </div>
                    <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border">
                      <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                        Sources
                      </h2>
                    </div>
                  </div>
                  <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border">
                    <h2 className="font-semibold text-primary font-mono uppercase text-xs">
                      Raw Chat History
                    </h2>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedChat.bubbles
                    .filter(
                      (bubble) => bubble.text && bubble.text.trim().length > 0
                    )
                    .map((bubble, index) => (
                      <div
                        key={index}
                        className={cn(
                          "p-4 rounded-lg",
                          bubble.type === "user"
                            ? "bg-muted border border-accent"
                            : "bg-muted border border-muted-foreground/30"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          <Badge
                            className="border border-border"
                            variant={
                              bubble.type === "user" ? "default" : "secondary"
                            }
                          >
                            {bubble.type === "user" ? "You" : "AI"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(bubble.timestamp), "PPp")}
                          </span>
                        </div>
                        <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({
                                inline,
                                className,
                                children,
                                ...props
                              }: {
                                inline?: boolean;
                                className?: string;
                                children?: React.ReactNode;
                              }) {
                                const match = /language-(\w+)/.exec(
                                  className || ""
                                );

                                if (!inline) {
                                  const codeString = String(children).replace(
                                    /\n$/,
                                    ""
                                  );
                                  return (
                                    <CollapsibleCodeBlock
                                      code={codeString}
                                      language={match ? match[1] : "javascript"}
                                      style={codeThemeStyle}
                                    />
                                  );
                                }

                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {bubble.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <Card className="p-6">
                  <div className="text-center text-muted-foreground">
                    <p>No conversation selected</p>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </SidebarInset>

        <AssistantSidebar open={rightOpen} onClose={() => setRightOpen(false)} />
      </div>
    </TooltipProvider>
  );
}
