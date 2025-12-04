"use client"

import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { CollapsibleCodeBlock } from '@/components/collapsible-code-block'
import { TextSelectionToolbar } from '@/components/text-selection-toolbar'
import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

interface ChatBubbleProps {
  type: 'user' | 'ai'
  text: string
  timestamp: number
  codeThemeStyle: { [key: string]: CSSProperties }
}

const CodeBlock = memo(function CodeBlock({ 
  code, 
  language, 
  style 
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
  codeThemeStyle 
}: { 
  text: string
  codeThemeStyle: { [key: string]: CSSProperties }
}) {
  const components = useMemo(() => ({
    code({ inline, className, children, ...props }: {
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
  }), [codeThemeStyle])

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  )
})

export const ChatBubble = memo(function ChatBubble({ 
  type, 
  text, 
  timestamp, 
  codeThemeStyle 
}: ChatBubbleProps) {
  const formattedDate = useMemo(() => {
    return format(new Date(timestamp), 'PPp')
  }, [timestamp])

  const isUser = type === 'user'

  return (
    <TextSelectionToolbar source="raw-chat">
      <div
        className={cn(
          "p-4 rounded-lg",
          isUser
            ? "bg-muted border border-accent"
            : "bg-muted border border-muted-foreground/30"
        )}
      >
        <div className="flex items-center gap-2 mb-2 text-xs">
          <Badge
            className="border border-border"
            variant={isUser ? "default" : "secondary"}
          >
            {isUser ? "You" : "AI"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {formattedDate}
          </span>
        </div>
        <div className="prose dark:prose-invert max-w-none">
          <MarkdownContent text={text} codeThemeStyle={codeThemeStyle} />
        </div>
      </div>
    </TextSelectionToolbar>
  )
})

