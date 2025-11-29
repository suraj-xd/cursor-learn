"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MessageSquare, Search, X, FileText, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export type WorkspaceLog = {
  id: string
  workspaceId: string
  workspaceFolder?: string
  title: string
  timestamp: number
  type: 'chat' | 'composer'
  messageCount: number
}

type MentionPopoverProps = {
  isOpen: boolean
  onClose: () => void
  conversations: WorkspaceLog[]
  isLoading?: boolean
  filterQuery: string
  onSelect: (conversation: WorkspaceLog) => void
  position: { top: number; left: number }
}

export function MentionPopover({
  isOpen,
  onClose,
  conversations,
  isLoading = false,
  filterQuery,
  onSelect,
  position,
}: MentionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredConversations = useMemo(() => {
    const query = filterQuery.toLowerCase()
    return conversations
      .filter((conv) => !query || conv.title.toLowerCase().includes(query))
      .slice(0, 10)
  }, [conversations, filterQuery])

  useEffect(() => {
    setSelectedIndex(0)
  }, [filterQuery])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredConversations.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        if (filteredConversations[selectedIndex]) {
          onSelect(filteredConversations[selectedIndex])
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, filteredConversations, selectedIndex, onSelect, onClose])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 w-80 rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: position.top - 40, left: position.left }}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1">
          {filterQuery ? `Searching: "${filterQuery}"` : "Reference a conversation"}
        </span>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-muted"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading conversations...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-muted-foreground">
            <MessageSquare className="h-6 w-6 opacity-50" />
            <span className="text-xs">No conversations found</span>
          </div>
        ) : (
          filteredConversations.map((conv, index) => (
            <button
              key={`${conv.workspaceId}-${conv.id}`}
              type="button"
              className={cn(
                "flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors border-b border-border/50 last:border-0",
                index === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
              )}
              onClick={() => onSelect(conv)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center gap-2 w-full">
                {conv.type === 'composer' ? (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium truncate flex-1">{conv.title}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {conv.messageCount} msgs
                </Badge>
              </div>
              {/* <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                <span>{formatDistanceToNow(new Date(conv.timestamp), { addSuffix: true })}</span>
                {conv.workspaceFolder && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-32">{conv.workspaceFolder.split('/').pop()}</span>
                  </>
                )}
              </div> */}
            </button>
          ))
        )}
      </div>
      {/* <div className="border-t border-border px-3 py-1.5 bg-muted/30">
        <span className="text-[10px] text-muted-foreground">
          ↑↓ navigate • Enter select • Esc close
        </span>
      </div> */}
    </div>
  )
}
