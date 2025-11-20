"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
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
    <div className="space-y-2 mx-4 border border-border rounded-[8px] pt-2 pb-0">
      <div className="flex items-center justify-between border-b border-border relative pb-2">
        <div className="flex justify-between w-full">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </Link>
          </Button>
          <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border flex justify-start items-center gap-2 absolute left-1/2 -translate-x-1/2">
            <h2 className="font-semibold text-accent font-mono uppercase text-xs">
              {state.projectName}
            </h2>
            <p className="text-xs text-green-500 uppercase font-mono">
              {state.tabs.length} conversations
            </p>
          </div>
          <div className="flex gap-2">
            {selectedChat && <CopyButton tab={selectedChat} />}
            {selectedChat && <DownloadMenu tab={selectedChat} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 space-y-4 border-r border-border px-2">
          {state.tabs.length > 0 && (
            <div className="space-y-4">
              {/* <h2 className="text-md font-bold">Conversations</h2> */}
              <div className="space-y-2">
                {state.tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant={
                      state.selectedId === tab.id ? "default" : "outline"
                    }
                    className="w-full justify-start px-4 py-3 h-auto"
                    onClick={() => handleSelect(tab.id)}
                    title={tab.title}
                  >
                    <div className="text-left w-full">
                      <div className="font-medium truncate">
                        {tab.title || `Chat ${tab.id.slice(0, 8)}`}
                      </div>
                      <div className="text-xs uppercase font-mono">
                        {new Date(tab.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-9">
          {selectedChat ? (
            <div className="">
              <div className="flex items-center justify-between mt-2 border-b border-border pb-2">
                {/* <h2 className="text-lg">{selectedChat.title}</h2> */}
                {/* <Badge variant="default">
                  Conversation
                </Badge> */}
                <div className="flex items-center gap-2">
                <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border flex justify-start items-center gap-2 mr-2">
                  <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                    {"Learnings"}
                  </h2>
                </div>
                <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border flex justify-start items-center gap-2">
                  <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                    {"Raw Chat History"}
                  </h2>
                </div>
                </div>


                <div className="bg-muted/50 dark:bg-muted/10 px-4 py-2 rounded-lg border flex justify-start items-center gap-2 mr-2">
                  <h2 className="font-semibold text-accent font-mono uppercase text-xs">
                    {"Assistant"}
                  </h2>
                </div>
              </div>

              <div className="space-y-4 max-h-[calc(100vh-230px)] overflow-y-auto">
                {selectedChat.bubbles
                  .filter(
                    (bubble) => bubble.text && bubble.text.trim().length > 0
                  )
                  .map((bubble, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg ${
                        bubble.type === "user"
                          ? "bg-muted border border-accent"
                          : "bg-muted border border-muted-foreground/30"
                      }`}
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
            <Card className="p-6">
              <div className="text-center text-muted-foreground">
                <p>No conversation selected</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
