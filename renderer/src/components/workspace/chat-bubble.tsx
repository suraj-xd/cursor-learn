"use client"

import { memo, useMemo, useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, Copy, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CollapsibleCodeBlock } from '@/components/collapsible-code-block'
import { TextSelectionToolbar } from '@/components/text-selection-toolbar'
import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'
import CursorCubeIcon from '../brand-icons/Cursor-cube-icon'

const MAX_COLLAPSED_HEIGHT = 150

interface ChatBubbleProps {
  type: 'user' | 'ai'
  text: string
  timestamp: number
  codeThemeStyle: { [key: string]: CSSProperties }
  isRetroBoy?: boolean
}

const CodeBlock = memo(function CodeBlock({
  code,
  language,
  style,
}: {
  code: string
  language: string
  style: { [key: string]: CSSProperties }
}) {
  return (
    <CollapsibleCodeBlock
      code={code}
      language={language}
      style={style}
    />
  )
})

const MarkdownContent = memo(function MarkdownContent({
  text,
  codeThemeStyle,
}: {
  text: string
  codeThemeStyle: { [key: string]: CSSProperties }
}) {
  const components = useMemo(
    () => ({
      code({
        inline,
        className,
        children,
        ...props
      }: {
        inline?: boolean
        className?: string
        children?: React.ReactNode
      }) {
        const match = /language-(\w+)/.exec(className || '')

        if (!inline) {
          const codeString = String(children).replace(/\n$/, '')
          return (
            <CodeBlock
              code={codeString}
              language={match ? match[1] : 'javascript'}
              style={codeThemeStyle}
            />
          )
        }

        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },
    }),
    [codeThemeStyle]
  )

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  )
})

export const ChatBubble = memo(function ChatBubble({
  type,
  text,
  timestamp: _timestamp,
  codeThemeStyle,
  isRetroBoy = false,
}: ChatBubbleProps) {
  const isUser = type === 'user'
  const [isExpanded, setIsExpanded] = useState(false)
  const [shouldShowExpand, setShouldShowExpand] = useState(false)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isUser && contentRef.current) {
      setShouldShowExpand(contentRef.current.scrollHeight > MAX_COLLAPSED_HEIGHT)
    }
  }, [isUser])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TextSelectionToolbar source="raw-chat">
      <div
        className={cn(
          "rounded-lg max-w-[90%] w-full",
          isUser
            ? isRetroBoy
              ? "bg-card border border-border ml-auto"
              : "dark:bg-[#1F1F1F] bg-[#F5F5F5] border border-border ml-auto"
            : isRetroBoy
              ? "bg-muted border border-border mr-auto"
              : "dark:bg-[#232323] bg-[#F5F5F5] border border-muted-foreground/30 mr-auto"
        )}
      >
        <div className="flex items-center justify-between mb-2 text-xs border-b border-border p-2">
          {isUser ? (
            <Badge
              className="border border-border font-departure"
              variant="default"
            >
              You
            </Badge>
          ) : (
            <>
              <CursorCubeIcon />
              <button
                type="button"
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </>
          )}
        </div>
        <div className="relative">
          <div
            ref={contentRef}
            className={cn(
              "prose dark:prose-invert max-w-none text-sm px-3 pb-3",
              isRetroBoy && "text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-em:text-foreground prose-li:text-foreground prose-a:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-blockquote:text-foreground prose-code:text-foreground prose-pre:text-foreground",
              isUser && !isExpanded && shouldShowExpand && "overflow-hidden"
            )}
            style={isUser && !isExpanded && shouldShowExpand ? { maxHeight: MAX_COLLAPSED_HEIGHT } : undefined}
          >
            <MarkdownContent text={text} codeThemeStyle={codeThemeStyle} />
          </div>
          {isUser && shouldShowExpand && !isExpanded && (
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t to-transparent pointer-events-none",
              isRetroBoy ? "from-card" : "dark:from-[#1F1F1F] from-[#F5F5F5]"
            )} />
          )}
        </div>
        {isUser && shouldShowExpand && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-3 pb-2 transition-colors"
          >
            Show {isExpanded ? 'less' : 'more'}
            <ChevronDown className={cn("size-3 transition-transform", isExpanded && "rotate-180")} />
          </button>
        )}
      </div>
    </TextSelectionToolbar>
  )
})

