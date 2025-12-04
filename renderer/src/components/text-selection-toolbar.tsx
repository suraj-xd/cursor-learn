"use client"

import { useCallback, useState, type ReactNode } from "react"
import { Popover } from "react-text-selection-popover"
import { MessageSquarePlus, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSelectionStore, type SelectionSource } from "@/store/selection"
import { cn } from "@/lib/utils"
import { DividerVerticalIcon } from "@radix-ui/react-icons"
import { NewNoteDialog } from "@/components/notes/new-note-dialog"

interface TextSelectionToolbarProps {
  children: ReactNode
  source: SelectionSource
  showAddToChat?: boolean
  showAddToNotes?: boolean
  onAddToChat?: (text: string) => void
  className?: string
}

export function TextSelectionToolbar({
  children,
  source,
  showAddToChat = true,
  showAddToNotes = true,
  onAddToChat,
  className,
}: TextSelectionToolbarProps) {
  const addSelection = useSelectionStore((s) => s.addSelection)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [selectedText, setSelectedText] = useState("")

  const handleAddToChat = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) return

    addSelection(text, source)
    selection?.removeAllRanges()
    onAddToChat?.(text)
  }, [addSelection, source, onAddToChat])

  const handleAddToNotes = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) return
    
    setSelectedText(text)
    selection?.removeAllRanges()
    setShowNoteDialog(true)
  }, [])

  return (
    <>
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
              </div>
            )
          }}
        />
      </div>

      {showNoteDialog && (
        <NewNoteDialog
          initialContent={selectedText}
          onClose={() => setShowNoteDialog(false)}
        />
      )}
    </>
  )
}

