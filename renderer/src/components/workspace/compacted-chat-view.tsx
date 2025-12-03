"use client"

import { memo, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Zap,
  FileText,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  RefreshCw,
} from 'lucide-react'
import { compactIpc, type CompactedChat, type CompactSession, type CompactProgress } from '@/lib/agents/compact-ipc'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import type { ComponentType } from 'react'

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

interface CompactedChatViewProps {
  workspaceId: string
  conversationId: string
  conversationTitle: string
  bubbles: ConversationBubble[]
}

type ViewState = 'loading' | 'empty' | 'processing' | 'completed' | 'error'

const stepLabels: Record<string, string> = {
  analyzing: 'Analyzing conversation...',
  chunking: 'Splitting into chunks...',
  mapping: 'Summarizing chunks...',
  reducing: 'Combining summaries...',
  finalizing: 'Finalizing report...',
}

function DebugPanel({
  compactedChat,
  session,
}: {
  compactedChat: CompactedChat | null
  session: CompactSession | null
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (!compactedChat && !session) return null

  const metadata = compactedChat?.metadata as {
    processingTimeMs?: number
    bubbleCount?: number
  } | null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center justify-between w-full px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
          <span className="font-mono uppercase">Debug Info</span>
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 py-3 bg-muted/30 space-y-3 text-xs">
          {compactedChat && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Model</p>
                  <p className="font-mono">{compactedChat.modelUsed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Strategy</p>
                  <p className="font-mono">{compactedChat.strategyUsed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Original Tokens</p>
                  <p className="font-mono">{compactedChat.originalTokenCount?.toLocaleString() ?? 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Compacted Tokens</p>
                  <p className="font-mono">{compactedChat.compactedTokenCount?.toLocaleString() ?? 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Compression Ratio</p>
                  <p className="font-mono">
                    {compactedChat.compressionRatio
                      ? `${(compactedChat.compressionRatio * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Chunks Processed</p>
                  <p className="font-mono">{compactedChat.chunkCount}</p>
                </div>
                {metadata?.processingTimeMs && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Processing Time</p>
                    <p className="font-mono">{(metadata.processingTimeMs / 1000).toFixed(1)}s</p>
                  </div>
                )}
                {metadata?.bubbleCount && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Messages</p>
                    <p className="font-mono">{metadata.bubbleCount}</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Created</p>
                <p className="font-mono">{new Date(compactedChat.createdAt).toLocaleString()}</p>
              </div>
            </>
          )}
          {session?.logs && session.logs.length > 0 && (
            <div className="space-y-1">
              <p className="text-muted-foreground">Session Logs</p>
              <div className="max-h-32 overflow-y-auto bg-background rounded p-2 space-y-1">
                {session.logs.slice(-10).map((log) => (
                  <p
                    key={`${log.timestamp}-${log.message.slice(0, 20)}`}
                    className={`font-mono text-[10px] ${
                      log.level === 'error'
                        ? 'text-destructive'
                        : log.level === 'warn'
                        ? 'text-yellow-500'
                        : 'text-muted-foreground'
                    }`}
                  >
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function EmptyState({ onStart, isStarting }: { onStart: () => void; isStarting: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Compact this conversation</h3>
          <p className="text-sm text-muted-foreground">
            Use AI to create a comprehensive summary of this conversation while preserving all
            important code snippets, decisions, and technical details.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 justify-center">
            <Layers className="w-4 h-4" />
            <span>Preserves all code blocks verbatim</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Zap className="w-4 h-4" />
            <span>Smart chunking for large conversations</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <FileText className="w-4 h-4" />
            <span>Structured report with key decisions</span>
          </div>
        </div>
        <Button onClick={onStart} disabled={isStarting} className="gap-2">
          {isStarting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Start Session
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ProcessingState({
  progress,
  onCancel,
}: {
  progress: CompactProgress | null
  onCancel: () => void
}) {
  const stepLabel = progress?.currentStep ? stepLabels[progress.currentStep] : 'Processing...'
  const progressPercent = progress?.progress ?? 0
  const chunksInfo =
    progress?.chunksTotal && progress.chunksTotal > 1
      ? `Chunk ${progress.chunksProcessed}/${progress.chunksTotal}`
      : null

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <h3 className="text-lg font-semibold">Compacting conversation...</h3>
          <p className="text-sm text-muted-foreground">{stepLabel}</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{chunksInfo || 'Processing'}</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Compaction failed</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <Sparkles className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}

function CompactedContent({ content }: { content: string }) {
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<{
    style: Record<string, unknown>
    language: string
    PreTag: string
    customStyle: Record<string, unknown>
    codeTagProps: { style: Record<string, unknown> }
    children: string
  }>

  return (
    <ScrollArea className="h-full px-5">
      <div className=" prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/90">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const codeString = String(children).replace(/\n$/, '')
              const hasNewlines = codeString.includes('\n')
              const isInline = !match && !hasNewlines
              
              return isInline ? (
                <code 
                  className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <div className="my-4 rounded-lg overflow-hidden border border-border">
                  {match && (
                    <div className="bg-muted/80 px-3 py-1.5 border-b border-border">
                      <span className="text-xs font-mono text-muted-foreground uppercase">
                        {match[1]}
                      </span>
                    </div>
                  )}
                  <Highlighter
                    style={vscDarkPlus}
                    language={match?.[1] || 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'hsl(var(--muted) / 0.5)',
                      fontSize: '0.8rem',
                      lineHeight: '1.5',
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                      }
                    }}
                  >
                    {codeString}
                  </Highlighter>
                </div>
              )
            },
            pre({ children }) {
              return <>{children}</>
            },
            h1({ children }) {
              return <h1 className="text-xl font-bold mt-6 mb-4 text-foreground">{children}</h1>
            },
            h2({ children }) {
              return <h2 className="text-lg font-semibold mt-5 mb-3 text-foreground border-b border-border pb-2">{children}</h2>
            },
            h3({ children }) {
              return <h3 className="text-base font-medium mt-4 mb-2 text-foreground">{children}</h3>
            },
            ul({ children }) {
              return <ul className="list-disc pl-5 space-y-1 my-3">{children}</ul>
            },
            ol({ children }) {
              return <ol className="list-decimal pl-5 space-y-1 my-3">{children}</ol>
            },
            li({ children }) {
              return <li className="text-foreground/90">{children}</li>
            },
            p({ children }) {
              return <p className="my-3 text-foreground/90 leading-relaxed">{children}</p>
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-4 border-primary/50 pl-4 my-4 italic text-muted-foreground">
                  {children}
                </blockquote>
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  )
}

export const CompactedChatView = memo(function CompactedChatView({
  workspaceId,
  conversationId,
  conversationTitle,
  bubbles,
}: CompactedChatViewProps) {
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [compactedChat, setCompactedChat] = useState<CompactedChat | null>(null)
  const [session, setSession] = useState<CompactSession | null>(null)
  const [progress, setProgress] = useState<CompactProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  const loadExistingData = useCallback(async () => {
    try {
      const [existingChat, activeSession] = await Promise.all([
        compactIpc.get(workspaceId, conversationId),
        compactIpc.getActiveSession(workspaceId, conversationId),
      ])

      if (activeSession && (activeSession.status === 'pending' || activeSession.status === 'processing')) {
        setSession(activeSession)
        setProgress({
          sessionId: activeSession.id,
          workspaceId,
          conversationId,
          status: activeSession.status,
          progress: activeSession.progress,
          currentStep: activeSession.currentStep,
          chunksTotal: activeSession.chunksTotal,
          chunksProcessed: activeSession.chunksProcessed,
        })
        setViewState('processing')
      } else if (existingChat) {
        setCompactedChat(existingChat)
        setViewState('completed')
      } else {
        setViewState('empty')
      }
    } catch (err) {
      console.error('Failed to load compacted chat data:', err)
      setViewState('empty')
    }
  }, [workspaceId, conversationId])

  useEffect(() => {
    loadExistingData()
  }, [loadExistingData])

  useEffect(() => {
    if (viewState !== 'processing') return

    const unsubscribe = compactIpc.onProgress((data) => {
      if (data.workspaceId !== workspaceId || data.conversationId !== conversationId) return

      setProgress(data)

      if (data.status === 'completed') {
        compactIpc.get(workspaceId, conversationId).then((chat) => {
          if (chat) {
            setCompactedChat(chat)
            setViewState('completed')
          }
        })
      } else if (data.status === 'failed') {
        setError('Compaction failed. Please try again.')
        setViewState('error')
      } else if (data.status === 'cancelled') {
        setViewState('empty')
      }
    })

    return unsubscribe
  }, [viewState, workspaceId, conversationId])

  const handleStart = useCallback(async () => {
    setIsStarting(true)
    setError(null)

    try {
      const result = await compactIpc.start({
        workspaceId,
        conversationId,
        title: conversationTitle,
        bubbles,
      })

      setSession(result.session)
      setCompactedChat(result.compactedChat)
      setViewState('completed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start compaction'
      if (message.includes('already in progress')) {
        setViewState('processing')
      } else {
        setError(message)
        setViewState('error')
      }
    } finally {
      setIsStarting(false)
    }
  }, [workspaceId, conversationId, conversationTitle, bubbles])

  const handleCancel = useCallback(async () => {
    if (!session?.id) return

    try {
      await compactIpc.cancel(session.id)
      setViewState('empty')
      setProgress(null)
      setSession(null)
    } catch (err) {
      console.error('Failed to cancel session:', err)
    }
  }, [session?.id])

  const handleRetry = useCallback(() => {
    setError(null)
    setViewState('empty')
  }, [])

  const handleCompactAgain = useCallback(() => {
    setCompactedChat(null)
    setSession(null)
    setViewState('empty')
  }, [])

  if (viewState === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (viewState === 'empty') {
    return <EmptyState onStart={handleStart} isStarting={isStarting} />
  }

  if (viewState === 'processing') {
    return <ProcessingState progress={progress} onCancel={handleCancel} />
  }

  if (viewState === 'error') {
    return <ErrorState error={error || 'Unknown error'} onRetry={handleRetry} />
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">Compacted</span>
          {compactedChat?.strategyUsed && (
            <Badge variant="secondary" className="text-[10px]">
              {compactedChat.strategyUsed.replace('_', ' ')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {compactedChat?.compressionRatio && (
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>{(compactedChat.compressionRatio * 100).toFixed(0)}% size</span>
            </div>
          )}
          {compactedChat?.createdAt && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{new Date(compactedChat.createdAt).toLocaleDateString()}</span>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCompactAgain} className="gap-2 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
                Compact Again
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {compactedChat?.compactedContent && (
          <CompactedContent content={compactedChat.compactedContent} />
        )}
      </div>
      <DebugPanel compactedChat={compactedChat} session={session} />
    </div>
  )
})

