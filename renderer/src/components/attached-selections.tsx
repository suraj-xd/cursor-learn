"use client"

import { memo } from "react"
import { X, CornerDownRight } from "lucide-react"
import { useSelectionStore, selectionActions } from "@/store/selection"
import { cn } from "@/lib/utils"

interface AttachedSelectionProps {
  className?: string
}

export const AttachedSelection = memo(function AttachedSelection({
  className,
}: AttachedSelectionProps) {
  const selection = useSelectionStore((s) => s.selection)

  if (!selection) return null

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3",
        className
      )}
    >
      <CornerDownRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
      <p className="flex-1 text-sm text-muted-foreground leading-relaxed max-w-[200px] sm:max-w-none line-clamp-4">
        {selection.text}...
      </p>
      <button
        type="button"
        onClick={() => selectionActions.clearSelection()}
        className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
        aria-label="Remove selection"
      >
        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  )
})
