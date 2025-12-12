"use client"

import { memo, useCallback, useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  Sparkles,
  Clock,
  CheckCircle2,
  MoreVertical,
  RefreshCw,
  Settings,
  Key,
} from 'lucide-react'
import { AILoader } from '@/components/ui/ai-loader'
import { LanguageIcon } from '@/lib/language-icons'
import { CopyResponseButton } from '@/components/copy-response-button'
import { overviewIpc, type ConversationOverview, type OverviewSession, type OverviewProgress } from '@/lib/agents/overview-ipc'
import { useSettingsStore } from '@/store/settings'
import Link from 'next/link'
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

interface OverviewViewProps {
  workspaceId: string
  conversationId: string
  conversationTitle: string
  bubbles: ConversationBubble[]
}

type ViewState = 'loading' | 'empty' | 'processing' | 'completed' | 'error' | 'no-api-key'

const stepLabels: Record<string, string> = {
  analyzing: 'Analyzing conversation...',
  extracting: 'Extracting key topics...',
  generating: 'Generating overview...',
  finalizing: 'Finalizing...',
}

function NoApiKeyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Key className="w-8 h-8 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">API Key Required</h3>
          <p className="text-sm text-muted-foreground">
            To generate conversation overviews, you need to configure a Google API key in settings.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/settings/api-keys">
            <Settings className="w-4 h-4" />
            Configure API Keys
          </Link>
        </Button>
      </div>
    </div>
  )
}

function EmptyState({ onStart, isStarting }: { onStart: () => void; isStarting: boolean }) {
  if (isStarting) {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <AILoader variant="compact" mode="loading" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h3 className="text-sm font-departure uppercase text-muted-foreground">Overview</h3>
        <p className="text-xs text-muted-foreground/70 max-w-[200px]">
          AI-powered summary with diagrams & insights
        </p>
        <Button onClick={onStart} variant="outline" size="sm" className="gap-2 font-departure">
          <Sparkles className="w-3 h-3" />
          Generate
        </Button>
      </div>
    </div>
  )
}

function ProcessingState({
  progress,
  onCancel,
}: {
  progress: OverviewProgress | null
  onCancel: () => void
}) {
  const stepLabel = progress?.currentStep ? stepLabels[progress.currentStep] : null
  const progressPercent = progress?.progress ?? 0

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <AILoader description={stepLabel ?? undefined} />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs font-mono">
            [cancel]
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
      <AILoader error={error} onRetry={onRetry} />
    </div>
  )
}

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef<string>('')

  useEffect(() => {
    let mounted = true
    const id = `mermaid-${Math.random().toString(36).slice(2)}`
    idRef.current = id

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          suppressErrorRendering: true,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        })

        const { svg: renderedSvg } = await mermaid.render(id, code)
        
        if (mounted) {
          setSvg(renderedSvg)
          setError(null)
        }
      } catch {
        if (mounted) {
          setError('Failed to render diagram')
        }
      }
    }

    renderDiagram()

    return () => {
      mounted = false
      const el = document.getElementById(id)
      if (el) el.remove()
      const errorEl = document.querySelector(`#d${id}`)
      if (errorEl) errorEl.remove()
    }
  }, [code])

  useEffect(() => {
    const cleanup = () => {
      const strayErrors = Array.from(document.querySelectorAll('[id^="dmermaid-"]'))
      const straySvgs = Array.from(document.querySelectorAll('[id^="mermaid-"][id$="-svg"]'))
        .filter(el => !el.closest('[data-mermaid-container]'))
      strayErrors.concat(straySvgs).forEach(el => { el.remove() })
    }
    cleanup()
    return cleanup
  }, [])

  if (error) {
    return (
      <div className="my-4 p-2 text-xs text-muted-foreground">
        can't render the diagram
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 p-8 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-mermaid-container
      className="my-4 p-4 rounded-lg border border-border bg-muted/20 overflow-x-auto"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from mermaid library is safe
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function TopicBadges({ topics }: { topics: string[] }) {
  if (!topics.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs font-medium text-muted-foreground mr-1 self-center">Topics:</span>
      {topics.map((topic) => (
        <Badge
          key={topic}
          variant="secondary"
          className="px-3 py-1.5 border border-border/60 text-xs font-medium bg-primary/8 text-primary/90 hover:bg-primary/15 transition-all duration-200 cursor-default shadow-sm"
        >
          {topic}
        </Badge>
      ))}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<{
    style: Record<string, unknown>
    language: string
    PreTag: string
    customStyle: Record<string, unknown>
    codeTagProps: { style: Record<string, unknown> }
    children: string
  }>

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h2:text-lg prose-h3:text-base prose-p:text-foreground/85 prose-p:leading-relaxed prose-li:text-foreground/85 prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:not-italic prose-blockquote:text-foreground/70 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const codeString = String(children).replace(/\n$/, '')
            const hasNewlines = codeString.includes('\n')
            const isInline = !match && !hasNewlines
            const language = match?.[1] || ''

            if (language === 'mermaid') {
              return <MermaidDiagram code={codeString} />
            }

            return isInline ? (
              <code
                className="px-1.5 py-0.5 rounded bg-muted/80 text-foreground font-mono text-[0.85em] border border-border/40"
                {...props}
              >
                {children}
              </code>
            ) : (
              <div className="my-4 rounded-lg overflow-hidden border border-border w-fit max-w-full group">
                <div className="bg-muted/80 px-3 py-1.5 border-b border-border flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <LanguageIcon language={language || 'text'} className="size-3.5" />
                    <span className="text-xs font-mono text-muted-foreground capitalize">
                      {language || 'text'}
                    </span>
                  </div>
                  <CopyResponseButton
                    content={codeString}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                <Highlighter
                  style={vscDarkPlus}
                  language={language || 'text'}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'hsl(var(--muted) / 0.5)',
                    fontSize: '0.8rem',
                    lineHeight: '1.5',
                    width: 'fit-content',
                    maxWidth: '100%',
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    },
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function OverviewContent({ overview }: { overview: ConversationOverview }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-8">
        <div className="space-y-5">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">{overview.title}</h1>
            <p className="text-muted-foreground leading-relaxed text-sm font-medium">{overview.summary}</p>
          </div>
          {overview.topics.length > 0 && (
            <div className="pt-2">
              <TopicBadges topics={overview.topics} />
            </div>
          )}
        </div>

        <div className="border-t border-border/60 pt-8">
          <MarkdownContent content={overview.content} />
        </div>
      </div>
    </ScrollArea>
  )
}

export const OverviewView = memo(function OverviewView({
  workspaceId,
  conversationId,
  conversationTitle,
  bubbles,
}: OverviewViewProps) {
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [overview, setOverview] = useState<ConversationOverview | null>(null)
  const [session, setSession] = useState<OverviewSession | null>(null)
  const [progress, setProgress] = useState<OverviewProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(true)

  const autoRunOverview = useSettingsStore((state) => state.autoRunOverview)
  const setAutoRunOverview = useSettingsStore((state) => state.setAutoRunOverview)

  const loadExistingData = useCallback(async () => {
    try {
      const [existingOverview, activeSession, apiKeyAvailable] = await Promise.all([
        overviewIpc.get(workspaceId, conversationId),
        overviewIpc.getActiveSession(workspaceId, conversationId),
        overviewIpc.hasApiKey(),
      ])

      setHasApiKey(apiKeyAvailable)

      if (activeSession && (activeSession.status === 'pending' || activeSession.status === 'processing')) {
        setSession(activeSession)
        setProgress({
          sessionId: activeSession.id,
          workspaceId,
          conversationId,
          status: activeSession.status,
          progress: activeSession.progress,
          currentStep: activeSession.currentStep,
        })
        setViewState('processing')
      } else if (existingOverview) {
        setOverview(existingOverview)
        setViewState('completed')
      } else if (!apiKeyAvailable) {
        setViewState('no-api-key')
      } else {
        setViewState('empty')
      }
    } catch (err) {
      console.error('Failed to load overview data:', err)
      setViewState('empty')
    }
  }, [workspaceId, conversationId])

  const handleStart = useCallback(async () => {
    setIsStarting(true)
    setError(null)

    try {
      const result = await overviewIpc.start({
        workspaceId,
        conversationId,
        title: conversationTitle,
        bubbles,
      })

      setSession(result.session)
      setOverview(result.overview)
      setViewState('completed')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start generation'
      if (message.includes('already in progress')) {
        setViewState('processing')
      } else if (message.includes('API key')) {
        setHasApiKey(false)
        setViewState('no-api-key')
      } else {
        setError(message)
        setViewState('error')
      }
    } finally {
      setIsStarting(false)
    }
  }, [workspaceId, conversationId, conversationTitle, bubbles])

  useEffect(() => {
    loadExistingData()
  }, [loadExistingData])

  useEffect(() => {
    if (viewState === 'empty' && autoRunOverview && hasApiKey && bubbles.length > 0) {
      handleStart()
    }
  }, [viewState, autoRunOverview, hasApiKey, bubbles.length, handleStart])

  useEffect(() => {
    if (viewState !== 'processing') return

    const unsubscribe = overviewIpc.onProgress((data) => {
      if (data.workspaceId !== workspaceId || data.conversationId !== conversationId) return

      setProgress(data)

      if (data.status === 'completed') {
        overviewIpc.get(workspaceId, conversationId).then((result) => {
          if (result) {
            setOverview(result)
            setViewState('completed')
          }
        })
      } else if (data.status === 'failed') {
        setError('Generation failed. Please try again.')
        setViewState('error')
      } else if (data.status === 'cancelled') {
        setViewState('empty')
      }
    })

    return unsubscribe
  }, [viewState, workspaceId, conversationId])

  const handleCancel = useCallback(async () => {
    if (!session?.id) return

    try {
      await overviewIpc.cancel(session.id)
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

  const handleRegenerate = useCallback(() => {
    setOverview(null)
    setSession(null)
    setViewState('empty')
  }, [])

  if (viewState === 'loading') {
    return (
      <div className="h-full flex items-center justify-center min-h-[400px]">
        <AILoader variant="compact" mode="loading" />
      </div>
    )
  }

  if (viewState === 'no-api-key') {
    return <NoApiKeyState />
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
          <span className="text-sm font-medium">Overview</span>
          <Badge variant="secondary" className="text-[10px]">
            Cached
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {overview?.createdAt && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{new Date(overview.createdAt).toLocaleDateString()}</span>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleRegenerate} className="gap-2 cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm">Auto Run</span>
                <Switch
                  checked={autoRunOverview}
                  className="border border-border"
                  onCheckedChange={setAutoRunOverview}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {overview && <OverviewContent overview={overview} />}
      </div>
    </div>
  )
})
