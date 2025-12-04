"use client"

import { useCallback, type ReactNode } from "react"
import { Popover } from "react-text-selection-popover"
import { MessageSquarePlus, StickyNote, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSelectionStore, type SelectionSource } from "@/store/selection"
import { toast } from "@/components/ui/toaster"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { DividerVerticalIcon } from "@radix-ui/react-icons"

interface TextSelectionToolbarProps {
  children: ReactNode
  source: SelectionSource
  showAddToChat?: boolean
  showAddToNotes?: boolean
  showCopy?: boolean
  onAddToChat?: (text: string) => void
  className?: string
}

export function TextSelectionToolbar({
  children,
  source,
  showAddToChat = true,
  showAddToNotes = true,
  showCopy = true,
  onAddToChat,
  className,
}: TextSelectionToolbarProps) {
  const [copied, setCopied] = useState(false)
  const addSelection = useSelectionStore((s) => s.addSelection)

  const handleAddToChat = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) return

    addSelection(text, source)
    selection?.removeAllRanges()
    // toast.success("Added to chat context")
    onAddToChat?.(text)
  }, [addSelection, source, onAddToChat])

  const handleAddToNotes = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) return
    
    selection?.removeAllRanges()
    toast.info("Notes feature coming soon")
  }, [])

  const handleCopy = useCallback(async () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }, [])

  return (
    <div className={cn("relative", className)}>
      {children}
      <Popover
        render={({ clientRect, isCollapsed }) => {
          if (isCollapsed || !clientRect) return null

          return (
            <div
              className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
              style={{
                left: `${clientRect.left + clientRect.width / 2}px`,
                top: `${clientRect.top - 8}px`,
                transform: "translate(-50%, -100%)",
              }}
            >
              {showAddToChat && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddToChat}
                  className="h-7 gap-1.5 px-2 text-xs"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Add to Chat
                </Button>
              )}
              <DividerVerticalIcon/>
              {showAddToNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddToNotes}
                  className="h-7 gap-1.5 px-2 text-xs"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
              {/* {showCopy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 w-7 p-0"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              )} */}
            </div>
          )
        }}
      />
    </div>
  )
}

