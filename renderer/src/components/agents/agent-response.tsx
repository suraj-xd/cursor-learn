"use client"

import { type ComponentProps, type CSSProperties, memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/store/settings"
import { codeThemeStyles } from "@/lib/code-themes"
import { AgentCodeBlock } from "./agent-code-block"

type AgentResponseProps = ComponentProps<"div"> & {
  children: string
  codeThemeStyle?: { [key: string]: CSSProperties }
  onSaveSnippet?: (code: string, language: string) => void
}

const AgentMarkdownContent = memo(function AgentMarkdownContent({
  text,
  codeThemeStyle,
  onSaveSnippet,
}: {
  text: string
  codeThemeStyle: { [key: string]: CSSProperties }
  onSaveSnippet?: (code: string, language: string) => void
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
        const match = /language-(\w+)/.exec(className || "")

        if (!inline) {
          const codeString = String(children).replace(/\n$/, "")
          return (
            <AgentCodeBlock
              code={codeString}
              language={match ? match[1] : "plaintext"}
              style={codeThemeStyle}
              onSaveSnippet={onSaveSnippet}
            />
          )
        }

        return (
          <code
            className={cn(
              "bg-muted px-1.5 py-0.5 rounded text-sm font-mono",
              className
            )}
            {...props}
          >
            {children}
          </code>
        )
      },
    }),
    [codeThemeStyle, onSaveSnippet]
  )

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  )
})

export const AgentResponse = memo(
  ({ className, children, codeThemeStyle: customStyle, onSaveSnippet, ...props }: AgentResponseProps) => {
    const codeTheme = useSettingsStore((state) => state.codeTheme)
    const themeStyle = useMemo(
      () => customStyle ?? codeThemeStyles[codeTheme] ?? codeThemeStyles.vscDarkPlus,
      [customStyle, codeTheme]
    )

    return (
      <div
        className={cn(
          "size-full min-w-0 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose dark:prose-invert prose-pre:p-0 prose-pre:bg-transparent prose-p:break-words prose-p:overflow-wrap-anywhere",
          className
        )}
        {...props}
      >
        <AgentMarkdownContent 
          text={children} 
          codeThemeStyle={themeStyle} 
          onSaveSnippet={onSaveSnippet}
        />
      </div>
    )
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.codeThemeStyle === nextProps.codeThemeStyle
)

AgentResponse.displayName = "AgentResponse"

