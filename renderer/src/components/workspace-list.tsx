"use client"

import { memo, useEffect, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Loading } from "@/components/ui/loading"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { FolderX, GitBranch, ChevronRight } from "lucide-react"
import { useWorkspaceListStore } from '@/store/workspace'
import type { ConversationPreview } from '@/services/workspace'

const MAX_VISIBLE_CONVERSATIONS = 3

interface ConversationItemProps {
  conversation: ConversationPreview
  projectId: string
  isLast: boolean
}

const ConversationItem = memo(function ConversationItem({ 
  conversation, 
  projectId, 
  isLast 
}: ConversationItemProps) {
  const timeAgo = useMemo(() => {
    return formatDistanceToNow(new Date(conversation.lastUpdatedAt), { addSuffix: true })
  }, [conversation.lastUpdatedAt])

  return (
    <div className="relative flex items-start group">
      <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center">
        <div className="w-px bg-border h-3" />
        <div className="w-3 h-px bg-border" style={{ marginLeft: '3px' }} />
        {!isLast && <div className="w-px bg-border flex-1" />}
      </div>
      <div className="ml-4 pl-2 py-1 flex items-center gap-2 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
        <Link 
          href={`/workspace?id=${projectId}&tab=${conversation.id}`}
          className="text-sm text-muted-foreground hover:text-foreground truncate transition-colors"
        >
          {conversation.name}
        </Link>
        <span className="text-xs text-muted-foreground/60 shrink-0">
          {timeAgo}
        </span>
      </div>
    </div>
  )
})

interface ConversationBranchProps {
  conversations: ConversationPreview[]
  projectId: string
}

const ConversationBranch = memo(function ConversationBranch({ 
  conversations, 
  projectId 
}: ConversationBranchProps) {
  const visibleConversations = useMemo(() => 
    conversations.slice(0, MAX_VISIBLE_CONVERSATIONS), 
    [conversations]
  )
  
  const remainingCount = conversations.length - MAX_VISIBLE_CONVERSATIONS

  return (
    <div className="relative ml-4 mt-2">
      {visibleConversations.map((conv, index) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          projectId={projectId}
          isLast={index === visibleConversations.length - 1 && remainingCount <= 0}
        />
      ))}
      {remainingCount > 0 && (
        <div className="relative flex items-start">
          <div className="absolute left-0 top-0 flex flex-col items-center">
            <div className="w-px bg-border h-3" />
            <div className="w-3 h-px bg-border" style={{ marginLeft: '3px' }} />
          </div>
          <Link 
            href={`/workspace?id=${projectId}`}
            className="ml-4 pl-2 py-1 text-sm text-muted-foreground/70 hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <span className="text-xs">+{remainingCount} more</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  )
})

interface WorkspaceRowProps {
  project: {
    id: string
    name: string
    conversationCount: number
    conversations: ConversationPreview[]
  }
}

const WorkspaceRow = memo(function WorkspaceRow({ project }: WorkspaceRowProps) {
  const hasConversations = project.conversations && project.conversations.length > 0

  return (
    <div className="border-b border-border py-4 px-2 hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3">
        <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
        <Link 
          href={`/workspace?id=${project.id}`}
          className="font-medium hover:underline flex-1 truncate"
        >
          {project.name}
        </Link>
        <span className="text-xs text-muted-foreground font-mono">
          {project.conversationCount} conversation{project.conversationCount !== 1 ? 's' : ''}
        </span>
      </div>
      {hasConversations && (
        <ConversationBranch 
          conversations={project.conversations} 
          projectId={project.id}
        />
      )}
    </div>
  )
})

const EmptyState = memo(function EmptyState() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderX className="size-5" />
        </EmptyMedia>
        <EmptyTitle>No Projects Found</EmptyTitle>
        <EmptyDescription>
          No Cursor workspace projects were found. This could be due to an incorrect 
          workspace path configuration. Check the <Link href="/config" className="underline">configuration page</Link> to 
          verify your Cursor workspace storage location.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
})

export const WorkspaceList = memo(function WorkspaceList() {
  const { projects, isLoading, fetchProjects } = useWorkspaceListStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const projectsWithConversations = useMemo(() => 
    projects.filter(project => project.conversationCount > 0),
    [projects]
  )

  if (isLoading && projects.length === 0) {
    return <Loading message="Loading projects..." />
  }

  if (projects.length === 0) {
    return (
      <div className="pt-4 min-h-[calc(100vh-150px)] flex items-center justify-center">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="space-y-1 pt-4 min-h-[calc(100vh-150px)]">
      {projectsWithConversations.length > 0 && (
        <div className="space-y-0">
          {projectsWithConversations.map(project => (
            <WorkspaceRow key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
})
