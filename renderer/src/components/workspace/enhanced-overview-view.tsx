"use client"

import { useEffect, useRef, useState, type ComponentType } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { AILoader } from '@/components/ui/ai-loader'
import { type OverviewStructure, type OverviewSection } from '@/lib/agents/enhanced-overview-ipc'
import { useOverviewStore } from '@/store/overview'
import { Sparkles, PanelLeftClose, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type Props = {
  workspaceId: string
  conversationId: string
  conversationTitle: string
  bubbles: ConversationBubble[]
}

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    let active = true
    setError(null)
    setSvg('')
    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        const { svg: renderedSvg } = await mermaid.render(id, code)
        if (active) setSvg(renderedSvg)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Diagram render failed')
      }
    })()
    return () => {
      active = false
    }
  }, [code])

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-2">
        <div className="text-destructive font-medium">Mermaid render failed</div>
        <div className="text-xs text-muted-foreground break-words">{error}</div>
        <Button variant="outline" size="sm" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide code' : 'Show code'}
        </Button>
        {showRaw && (
          <pre className="text-xs bg-background border border-border rounded-md p-2 overflow-x-auto whitespace-pre">
            {code}
          </pre>
        )}
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-border bg-muted/30 p-4 min-h-[400px]">
        <AILoader variant="compact" mode="loading" />
      </div>
    )
  }

  return (
    <div
      className="my-4 rounded-lg border border-border bg-muted/20 p-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function SectionCard({ section }: { section: OverviewSection }) {
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<any>
  const uniqueDiagrams =
    section.diagrams?.filter((d, idx, arr) => {
      const first = arr.findIndex(
        (x) => x.mermaidCode.trim() === d.mermaidCode.trim() && x.type === d.type
      )
      return first === idx
    }) ?? []

  return (
    <div className="bg-card shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
            {section.type}
          </Badge>
          <h3 className="font-semibold text-sm">{section.title}</h3>
        </div>
        <Badge variant={section.importance === 'high' ? 'default' : 'outline'} className="text-[10px]">
          {section.importance}
        </Badge>
      </div>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const codeContent = String(children).replace(/\n$/, '')
            if (className === 'language-mermaid') {
              return <MermaidBlock code={codeContent} />
            }
            return !inline ? (
              <Highlighter style={vscDarkPlus as any} language={match?.[1] || 'text'} PreTag="div" {...props}>
                {codeContent}
              </Highlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {section.content}
      </ReactMarkdown>

      {uniqueDiagrams.length ? (
        <div className="space-y-3">
          {uniqueDiagrams.map((d) => (
            <MermaidBlock key={d.id} code={d.mermaidCode} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function EnhancedOverviewView({ workspaceId, conversationId, conversationTitle, bubbles }: Props) {
  const load = useOverviewStore((s) => s.load)
  const generate = useOverviewStore((s) => s.generate)
  const entry = useOverviewStore((s) => s.items[conversationId])
  const overview = entry?.overview ?? null
  const status = entry?.status ?? 'idle'
  const error = entry?.error ?? null
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  const sections = overview?.sections ?? []

  useEffect(() => {
    if (!overview && status === 'idle') {
      void load({ workspaceId, conversationId })
    }
  }, [conversationId, load, overview, status, workspaceId])

  useEffect(() => {
    if (!sections.length) return

    observerRef.current?.disconnect()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id)
          }
        })
      },
      { threshold: 0.4 }
    )
    observerRef.current = observer

    sections.forEach((section) => {
      const el = sectionRefs.current[section.id]
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  const handleGenerate = async () => {
    await generate({
      workspaceId,
      conversationId,
      title: conversationTitle,
      bubbles,
    })
  }

  if (status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center">
        <AILoader description="Generating enhanced overview..." />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={handleGenerate}>
          Retry
        </Button>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="h-full flex items-center justify-center">
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <Sparkles className="w-4 h-4" />
          Generate Enhanced Overview
        </Button>
      </div>
    )
  }

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Overview</p>
          <h2 className="font-semibold">{overview.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {overview.metadata.modelUsed}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            Sections: {overview.sections.length}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-border bg-muted/30 transition-all duration-200",
            sidebarCollapsed ? "w-10" : "w-64"
          )}
        >
          <div className="flex items-center justify-between p-2 border-b border-border">
            {!sidebarCollapsed && (
              <p className="text-[11px] uppercase text-muted-foreground px-1">Sections</p>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-auto"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {!sidebarCollapsed && (
            <div className="p-2 flex-1 overflow-y-auto">
              <div className="space-y-1">
                {sections.map((section) => {
                  const isActive = activeSectionId === section.id
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        'w-full text-left text-sm rounded-md px-2 py-1.5 transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      )}
                    >
                      {section.order + 1}. {section.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {sections.map((section) => (
              <div
                key={section.id}
                id={section.id}
                ref={(el) => {
                  sectionRefs.current[section.id] = el
                }}
              >
                <SectionCard section={section} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
