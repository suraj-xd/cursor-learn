"use client"

import { useRef, useEffect, useCallback } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Search, Plus, StickyNote } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NoteCard } from "./note-card"
import { useNotesStore } from "@/store/notes"
import { cn } from "@/lib/utils"

interface NotesListProps {
  compact?: boolean
  className?: string
}

export function NotesList({ compact = false, className }: NotesListProps) {
  const {
    notes,
    selectedNoteId,
    isLoading,
    searchQuery,
    hasMore,
    setSearchQuery,
    setSelectedNoteId,
    fetchNotes,
    fetchMoreNotes,
    createNote,
    deleteNote,
    togglePin,
  } = useNotesStore()

  const parentRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  })

  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !isLoading) {
      fetchMoreNotes()
    }
  }, [hasMore, isLoading, fetchMoreNotes])

  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 200)
  }

  const handleNewNote = async () => {
    const note = await createNote({
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      plainText: "",
    })
    setSelectedNoteId(note.id)
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className={cn("p-3 border-b space-y-2", compact && "p-2")}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              defaultValue={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn("pl-8 h-8 text-sm", compact && "h-7 text-xs")}
            />
          </div>
          <Button
            size={compact ? "icon" : "sm"}
            onClick={handleNewNote}
            className={cn(compact ? "h-7 w-7" : "h-8")}
          >
            <Plus className="h-4 w-4" />
            {!compact && <span className="ml-1">New</span>}
          </Button>
        </div>
      </div>

      <ScrollArea
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1"
      >
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <StickyNote className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">
              {searchQuery ? "No notes found" : "No notes yet"}
            </p>
            {!searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewNote}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create your first note
              </Button>
            )}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            <div
              className="p-2 space-y-2"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
              }}
            >
              {virtualItems.map((virtualRow) => {
                const note = notes[virtualRow.index]
                return (
                  <div
                    key={note.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                  >
                    <NoteCard
                      note={note}
                      isSelected={selectedNoteId === note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      onPin={() => togglePin(note.id)}
                      onDelete={() => deleteNote(note.id)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {isLoading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

