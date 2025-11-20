"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Loading } from "@/components/ui/loading"
import { DownloadMenu } from "@/components/download-menu"
import ReactMarkdown from "react-markdown"
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import type { ComponentType } from 'react'
import { ChatTab, ComposerChat } from "@/types/workspace"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/copy-button"
import { format } from 'date-fns'

interface WorkspaceState {
  projectName: string;
  tabs: ChatTab[];
  composers: ComposerChat[];
  selectedId: string | null;
  isLoading: boolean;
}

export default function WorkspaceClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const workspaceId = searchParams.get('id')
  const initialTab = searchParams.get('tab')
  const [state, setState] = useState<WorkspaceState>({
    projectName: workspaceId === 'global'
      ? 'Global Storage'
      : workspaceId
        ? `Project ${workspaceId.slice(0, 8)}`
        : 'Select a workspace',
    tabs: [],
    composers: [],
    selectedId: initialTab,
    isLoading: Boolean(workspaceId),
  })

  const handleSelect = (id: string) => {
    setState(prev => ({ ...prev, selectedId: id }))
    const query = new URLSearchParams()
    if (workspaceId) {
      query.set('id', workspaceId)
    }
    query.set('tab', id)
    router.replace(`/workspace?${query.toString()}`, { scroll: false })
  }

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId || !window?.ipc) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }
    try {
      const data = await window.ipc.workspace.tabs(workspaceId)
      setState(prev => ({
        ...prev,
        projectName: workspaceId === 'global'
          ? 'Global Storage'
          : `Project ${workspaceId.slice(0, 8)}`,
        tabs: data.tabs || [],
        composers: data.composers?.allComposers || [],
        isLoading: false,
      }))
    } catch (error) {
      console.error('Failed to fetch workspace:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        tabs: [],
        composers: [],
        projectName: 'Select a workspace',
      }))
      return
    }
    setState(prev => ({
      ...prev,
      isLoading: true,
      selectedId: initialTab,
    }))
    fetchWorkspace()
  }, [workspaceId, initialTab, fetchWorkspace])

  useEffect(() => {
    if (!state.selectedId && state.tabs.length > 0) {
      setState(prev => ({ ...prev, selectedId: state.tabs[0].id }))
    }
  }, [state.tabs, state.selectedId])

  if (!workspaceId) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>Select a workspace from the home page to view conversations.</p>
        </div>
      </Card>
    )
  }

  if (state.isLoading) {
    return <Loading />
  }

  const selectedChat = state.tabs.find(tab => tab.id === state.selectedId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex justify-between w-full">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </Link>
          </Button>
          <div className="flex gap-2">
            {selectedChat && <CopyButton tab={selectedChat} />}
            {selectedChat && <DownloadMenu tab={selectedChat} />}
          </div>
        </div>
      </div>

      <div className="bg-muted/50 dark:bg-muted/10 p-6 rounded-lg border">
        <h2 className="font-semibold mb-2">{state.projectName}</h2>
        <p className="text-sm text-muted-foreground">
          {state.tabs.length} conversations
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4">
          {state.tabs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Conversations</h2>
              <div className="space-y-2">
                {state.tabs.map((tab) => (
                  <Button
                    key={tab.id}
                    variant={state.selectedId === tab.id ? "default" : "outline"}
                    className="w-full justify-start px-4 py-3 h-auto"
                    onClick={() => handleSelect(tab.id)}
                    title={tab.title}
                  >
                    <div className="text-left w-full">
                      <div className="font-medium truncate">
                        {tab.title || `Chat ${tab.id.slice(0, 8)}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
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
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  {selectedChat.title}
                </h2>
                <Badge variant="default">
                  Conversation
                </Badge>
              </div>

              <div className="space-y-4">
                {selectedChat.bubbles
                  .filter(bubble => bubble.text && bubble.text.trim().length > 0)
                  .map((bubble, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${
                      bubble.type === 'user'
                        ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={bubble.type === 'user' ? 'default' : 'secondary'}>
                        {bubble.type === 'user' ? 'You' : 'AI'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(bubble.timestamp), 'PPp')}
                      </span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({inline, className, children, ...props}: {inline?: boolean, className?: string, children?: React.ReactNode}) {
                            const match = /language-(\w+)/.exec(className || '')
                            const Highlighter = SyntaxHighlighter as unknown as ComponentType<any>
                            return !inline && match ? (
                              <Highlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </Highlighter>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {bubble.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
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
  )
}

