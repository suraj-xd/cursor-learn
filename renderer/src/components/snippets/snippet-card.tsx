"use client"

import { useState, type ComponentType } from "react"
import { Pin, Trash2, Copy, Check, Edit2, ChevronDown, ChevronUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { DeleteConfirm } from "@/components/ui/delete-confirm"
import { LanguageIcon } from "@/lib/language-icons"
import type { Snippet } from "@/types/snippets"

interface SnippetCardProps {
  snippet: Snippet
  codeStyle: Record<string, React.CSSProperties>
  onPin: () => void
  onDelete: () => void
  onEdit: () => void
}

const MAX_LINES = 20

export function SnippetCard({ snippet, codeStyle, onPin, onDelete, onEdit }: SnippetCardProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<{
    style: Record<string, React.CSSProperties>
    language: string
    PreTag: string
    customStyle: React.CSSProperties
    wrapLongLines: boolean
    children: string
  }>

  const lineCount = snippet.code.split("\n").length
  const shouldCollapse = lineCount > MAX_LINES
  const displayCode = shouldCollapse && !isExpanded
    ? snippet.code.split("\n").slice(0, MAX_LINES).join("\n")
    : snippet.code

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const title = snippet.title || `${snippet.language} snippet`

  return (
    <div className="group rounded-lg border bg-card overflow-hidden max-w-3xl">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          {snippet.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
          <Badge variant="secondary" className="font-mono text-[10px] py-0 shrink-0">
            <LanguageIcon language={snippet.language} className="size-3" />
          </Badge>
          <span className="text-sm font-medium truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleCopy}
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onEdit}
            title="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 w-7 p-0", snippet.isPinned && "text-primary")}
            onClick={onPin}
            title={snippet.isPinned ? "Unpin" : "Pin"}
          >
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <DeleteConfirm
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={onDelete}
        title="Delete snippet?"
        description="This will permanently delete this snippet. This action cannot be undone."
      />

      <div className="relative">
        <div className="overflow-x-auto text-xs">
          <Highlighter
            style={codeStyle}
            language={snippet.language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: "0.75rem",
              borderRadius: 0,
              fontSize: "0.75rem",
            }}
            wrapLongLines={false}
          >
            {displayCode}
          </Highlighter>
        </div>
        {shouldCollapse && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2 pt-6">
            <Button
              variant="secondary"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show {lineCount - MAX_LINES} more lines
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {(snippet.labels.length > 0 || snippet.sourceContext) && (
        <div className="px-3 py-2 border-t flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {snippet.labels.map((label) => (
              <Badge key={label} variant="outline" className="text-[9px] py-0 px-1.5">
                {label}
              </Badge>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(snippet.updatedAt, { addSuffix: true })}
          </span>
        </div>
      )}
    </div>
  )
}

