"use client"

import { useState } from "react"
import { Pin, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { DeleteConfirm } from "@/components/ui/delete-confirm"
import type { Note } from "@/types/notes"

interface NoteCardProps {
  note: Note
  isSelected: boolean
  onClick: () => void
  onPin: () => void
  onDelete: () => void
}

export function NoteCard({ note, isSelected, onClick, onPin, onDelete }: NoteCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const title = note.title || note.plainText.slice(0, 50) || "Untitled"
  const preview = note.plainText.slice(0, 100)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className={cn(
          "group relative p-3 rounded-lg border cursor-pointer transition-all",
          "hover:border-primary/50 hover:bg-muted/30",
          isSelected && "border-primary bg-muted/50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {note.isPinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
              <h3 className="font-medium text-sm truncate">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {preview || "No content"}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPin()
              }}
              className={cn(
                "p-1 rounded hover:bg-muted",
                note.isPinned && "text-primary"
              )}
              title={note.isPinned ? "Unpin" : "Pin"}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteConfirm(true)
              }}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      {note.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {note.labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="outline" className="text-[9px] py-0 px-1.5">
              {label}
            </Badge>
          ))}
          {note.labels.length > 3 && (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5">
              +{note.labels.length - 3}
            </Badge>
          )}
        </div>
      )}
        <p className="text-[10px] text-muted-foreground/60 mt-2">
          {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
        </p>
      </div>

      <DeleteConfirm
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={onDelete}
        title="Delete note?"
        description="This will permanently delete this note. This action cannot be undone."
      />
    </>
  )
}

