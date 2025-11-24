"use client"

import { memo, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ArrowLeft, AsteriskIcon, MessageSquareOff, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { Loading } from '@/components/ui/loading'
import { DownloadMenu } from '@/components/download-menu'
import { CopyButton } from '@/components/copy-button'
import { useSidebar } from '@/hooks/use-sidebar'
import { ConversationSidebar } from '@/components/workspace/conversation-sidebar'
import { AssistantSidebar } from '@/components/workspace/assistant-sidebar'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useWorkspaceDetailStore, selectSelectedChat, workspaceDetailActions } from '@/store/workspace'
import { ChatView } from '@/components/workspace/chat-view'

const ChatViewSkeleton = memo(function ChatViewSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-lg bg-muted border border-border animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-12 bg-muted-foreground/20 rounded" />
            <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted-foreground/20 rounded" />
            <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
            <div className="h-4 w-1/2 bg-muted-foreground/20 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
})

const WorkspaceHeader = memo(function WorkspaceHeader({ 
  projectName, 
  tabCount,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  selectedChat
}: { 
  projectName: string
  tabCount: number
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  selectedChat: ReturnType<typeof selectSelectedChat>
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-2">
        {!leftOpen && (
          <SidebarTrigger side="left" onClick={onToggleLeft} />
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
          {projectName}
        </h2>
        <p className="text-xs text-green-500 uppercase font-mono">
          {tabCount} conversations
        </p>
      </div>

      <div className="flex items-center gap-2">
        {selectedChat && <CopyButton tab={selectedChat} />}
        {selectedChat && <DownloadMenu tab={selectedChat} />}
        <Button
          variant={rightOpen ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={onToggleRight}
        >
          <AsteriskIcon className="w-4 h-4" />
          Assistant
        </Button>
      </div>
    </div>
  )
})

const ChatContentTabs = memo(function ChatContentTabs() {
  return (
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
  )
})

const NoConversationSelected = memo(function NoConversationSelected() {
  return (
    <div className="h-full flex items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareOff className="size-5" />
          </EmptyMedia>
          <EmptyTitle>No conversation selected</EmptyTitle>
          <EmptyDescription>
            Select a conversation from the sidebar to view its contents.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
})

const NoWorkspaceSelected = memo(function NoWorkspaceSelected() {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen className="size-5" />
          </EmptyMedia>
          <EmptyTitle>No workspace selected</EmptyTitle>
          <EmptyDescription>
            Select a workspace from the home page to view conversations.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
})

function WorkspaceClientInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const workspaceId = searchParams.get('id')
  const initialTab = searchParams.get('tab')
  const initializedRef = useRef<string | null>(null)

  const {
    leftOpen,
    rightOpen,
    leftCollapsed,
    toggleLeft,
    toggleRight,
    setLeftCollapsed,
    setRightOpen,
  } = useSidebar()

  const projectName = useWorkspaceDetailStore(state => state.projectName)
  const tabs = useWorkspaceDetailStore(state => state.tabs)
  const selectedId = useWorkspaceDetailStore(state => state.selectedId)
  const isLoading = useWorkspaceDetailStore(state => state.isLoading)
  const selectedChat = useWorkspaceDetailStore(selectSelectedChat)

  useEffect(() => {
    const key = `${workspaceId}:${initialTab}`
    if (initializedRef.current === key) return
    initializedRef.current = key
    
    workspaceDetailActions.initialize(workspaceId, initialTab)
  }, [workspaceId, initialTab])

  const handleSelect = useCallback((id: string) => {
    workspaceDetailActions.setSelectedId(id)
    const query = new URLSearchParams()
    if (workspaceId) {
      query.set('id', workspaceId)
    }
    query.set('tab', id)
    router.replace(`/workspace?${query.toString()}`, { scroll: false })
  }, [workspaceId, router])

  if (!workspaceId) {
    return <NoWorkspaceSelected />
  }

  if (isLoading) {
    return <Loading />
  }

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-64px)] border border-border rounded-[8px] mx-4 overflow-hidden">
        <ConversationSidebar
          tabs={tabs}
          selectedId={selectedId}
          onSelect={handleSelect}
          open={leftOpen}
          collapsed={leftCollapsed}
          onToggle={toggleLeft}
          onCollapse={setLeftCollapsed}
        />

        <SidebarInset className="flex flex-col">
          <WorkspaceHeader
            projectName={projectName}
            tabCount={tabs.length}
            leftOpen={leftOpen}
            rightOpen={rightOpen}
            onToggleLeft={toggleLeft}
            onToggleRight={toggleRight}
            selectedChat={selectedChat}
          />

          <div className="flex-1 overflow-hidden">
            {selectedChat ? (
              <div className="h-full flex flex-col">
                <ChatContentTabs />
                <div className="flex-1 overflow-hidden">
                  <Suspense fallback={<ChatViewSkeleton />}>
                    <ChatView chat={selectedChat} />
                  </Suspense>
                </div>
              </div>
            ) : (
              <NoConversationSelected />
            )}
          </div>
        </SidebarInset>

        <AssistantSidebar open={rightOpen} onClose={() => setRightOpen(false)} />
      </div>
    </TooltipProvider>
  )
}

export default memo(WorkspaceClientInner)
