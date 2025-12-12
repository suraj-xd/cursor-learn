"use client";

import { memo, useEffect, useMemo, useState, useCallback } from "react";
import { formatDistanceToNow, format, isToday } from "date-fns";
import Link from "next/link";
import { Loading } from "@/components/ui/loading";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { FolderX, FolderOpen, ChevronDown, ChevronUp, Search, Sparkles } from "lucide-react";
import { TextIcon, FileTextIcon, ClockIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { ConversationPreview } from "@/services/workspace";
import { cn } from "@/lib/utils";
import { useWorkspaceListStore } from "@/store/workspace";

const MAX_VISIBLE_ROWS = 10;

interface ConversationRowProps {
  conversation: ConversationPreview;
  projectId: string;
  isExpanded?: boolean;
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  projectId,
  isExpanded,
}: ConversationRowProps) {
  const timeAgo = useMemo(() => {
    return formatDistanceToNow(new Date(conversation.lastUpdatedAt), {
      addSuffix: true,
    });
  }, [conversation.lastUpdatedAt]);

  const createdDate = useMemo(() => {
    const date = new Date(conversation.createdAt || conversation.lastUpdatedAt);
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return format(date, "MMM d");
  }, [conversation.createdAt, conversation.lastUpdatedAt]);

  return (
    <Link
      href={`/workspace?id=${projectId}&tab=${conversation.id}`}
      className={cn(
        "grid grid-cols-[1fr_100px_150px_150px] gap-3 px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0",
        isExpanded && "animate-in fade-in-0 duration-300"
      )}
    >
      <span className="truncate text-muted-foreground/50 hover:text-foreground transition-colors flex items-center gap-2">
        {conversation.name}
      </span>
      <span className="flex items-center justify-end">
        {conversation.hasEnhancedOverview && (
          <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0.5">
            <Sparkles className="w-2.5 h-2.5" />
            Indexed
          </Badge>
        )}
      </span>
      <span
        className="text-xs text-muted-foreground text-right whitespace-nowrap font-departure uppercase tracking-wider"
        title={timeAgo}
      >
        {createdDate}
      </span>
      <span className="text-xs text-muted-foreground text-right tabular-nums font-departure uppercase tracking-wider">
        {conversation.messageCount} msg
      </span>
    </Link>
  );
});

interface WorkspaceCardProps {
  project: {
    id: string;
    name: string;
    conversationCount: number;
    conversations: ConversationPreview[];
  };
}

const WorkspaceCard = memo(function WorkspaceCard({
  project,
}: WorkspaceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreRows = project.conversations.length > MAX_VISIBLE_ROWS;
  const remainingCount = project.conversations.length - MAX_VISIBLE_ROWS;

  const visibleConversations = useMemo(() => {
    if (isExpanded) return project.conversations;
    return project.conversations.slice(0, MAX_VISIBLE_ROWS);
  }, [project.conversations, isExpanded]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  if (project.conversations.length === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <Link
        href={`/workspace?id=${project.id}`}
        className="flex items-center gap-2.5 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors border-b border-border"
      >
        <span className="font-medium truncate flex items-center gap-1 flex-1 bg-muted px-2 py-1 rounded-md border border-border/50 w-fit">
          <FolderOpen className="w-4 h-4 text-primary shrink-0" />
          {project.name}
        </span>
        <span className="text-xs text-muted-foreground/70 tabular-nums bg-muted p-2 rounded-md border border-border/50">
          {project.conversationCount} Chat
          {project.conversationCount !== 1 ? "s" : ""}
        </span>
      </Link>

      <div className="divide-y divide-border/50">
        <div className="grid grid-cols-[1fr_100px_150px_150px] gap-3 px-3 py-1.5 text-xs text-muted-foreground/50 uppercase tracking-wider font-medium border-b border-border/50">
          <span className="flex items-center gap-1">
            <TextIcon className="w-3 h-3" /> Name
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            Status
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            <ClockIcon className="w-3 h-3" /> Updated
          </span>
          <span className="text-right flex items-center justify-end gap-1">
            <FileTextIcon className="w-3 h-3" /> Messages
          </span>
        </div>

        {visibleConversations.map((conv, idx) => (
          <ConversationRow
            key={conv.id}
            conversation={conv}
            projectId={project.id}
            isExpanded={isExpanded && idx >= MAX_VISIBLE_ROWS}
          />
        ))}
      </div>

      {hasMoreRows && (
        <button
          type="button"
          onClick={toggleExpand}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/50"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show {remainingCount} more
            </>
          )}
        </button>
      )}
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderX className="size-5" />
        </EmptyMedia>
        <EmptyTitle>No Projects Found</EmptyTitle>
        <EmptyDescription>
          No Cursor workspace projects were found. This could be due to an
          incorrect workspace path configuration. Check the{" "}
          <Link href="/config" className="underline">
            configuration page
          </Link>{" "}
          to verify your Cursor workspace storage location.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
});

export const WorkspaceList = memo(function WorkspaceList() {
  const { projects, isLoading, fetchProjects } = useWorkspaceListStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [indexedOnly, setIndexedOnly] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return projects
      .filter((project) => project.conversationCount > 0)
      .map((project) => {
        let conversations = project.conversations;

        if (indexedOnly) {
          conversations = conversations.filter((c) => c.hasEnhancedOverview);
        }

        if (query) {
          conversations = conversations.filter((c) =>
            c.name.toLowerCase().includes(query)
          );
        }

        return {
          ...project,
          conversations,
          conversationCount: conversations.length,
        };
      })
      .filter((project) => project.conversationCount > 0)
      .sort((a, b) => {
        const aLatest = a.conversations[0]?.lastUpdatedAt ?? 0;
        const bLatest = b.conversations[0]?.lastUpdatedAt ?? 0;
        return bLatest - aLatest;
      });
  }, [projects, searchQuery, indexedOnly]);

  const indexedCount = useMemo(() => {
    return projects.reduce(
      (acc, p) => acc + p.conversations.filter((c) => c.hasEnhancedOverview).length,
      0
    );
  }, [projects]);

  if (isLoading && projects.length === 0) {
    return <Loading message="Loading projects..." />;
  }

  if (projects.length === 0) {
    return (
      <div className="pt-4 min-h-[calc(100vh-150px)] flex items-center justify-center">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4 min-h-[calc(100vh-150px)]">
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2  border border-border rounded-md px-2 py-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            Indexed
            <span className="text-xs text-muted-foreground font-departure uppercase tracking-wider">
            ({indexedCount})
            </span>
          </span>
          <Switch
            checked={indexedOnly}
            onCheckedChange={setIndexedOnly}
          />
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No conversations match your filters.
        </div>
      ) : (
        filteredProjects.map((project) => (
          <WorkspaceCard key={project.id} project={project} />
        ))
      )}
    </div>
  );
});
