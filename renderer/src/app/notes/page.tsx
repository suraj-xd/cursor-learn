"use client"

import { useEffect } from "react"
import { NotesList } from "@/components/notes/notes-list"
import { NoteEditor } from "@/components/notes/note-editor"
import { useNotesStore } from "@/store/notes"
import { cn } from "@/lib/utils"

export default function NotesPage() {
  const { notes, selectedNoteId, setSelectedNoteId } = useNotesStore()
  
  const selectedNote = notes.find((n) => n.id === selectedNoteId)
  const isEditing = !!selectedNote

  useEffect(() => {
    return () => {
      setSelectedNoteId(null)
    }
  }, [setSelectedNoteId])

  return (
    <div className="flex h-[calc(100vh-64px)] border border-border rounded-[8px] mx-4 overflow-hidden">
      <aside
        className={cn(
          "border-r border-border/50 bg-muted/20 flex flex-col transition-all duration-200",
          isEditing ? "w-64" : "w-full  mx-auto border-x"
        )}
      >
        <NotesList compact={isEditing} className="flex-1" />
      </aside>

      {isEditing && selectedNote && (
        <main className="flex-1 bg-background overflow-hidden">
          <NoteEditor key={selectedNote.id} note={selectedNote} />
        </main>
      )}
    </div>
  )
}

