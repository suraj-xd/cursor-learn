"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { toast, useToastStore } from "@/lib/toast"

const variantClasses: Record<string, string> = {
  default: "bg-background text-foreground border-border",
  success: "bg-emerald-600 text-white border-emerald-700",
  error: "bg-destructive text-destructive-foreground border-destructive",
  warning: "bg-amber-500 text-black border-amber-600",
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const remove = useToastStore((state) => state.remove)

  useEffect(() => {
    const timers = toasts.map((entry) =>
      window.setTimeout(() => {
        remove(entry.id)
      }, entry.duration),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [toasts, remove])

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            "pointer-events-auto rounded-lg border px-4 py-3 shadow-lg transition-all",
            variantClasses[entry.variant] ?? variantClasses.default,
          )}
        >
          <div className="flex justify-between gap-3">
            <div className="space-y-1">
              {entry.title && <p className="text-sm font-semibold">{entry.title}</p>}
              {entry.description && <p className="text-sm opacity-90">{entry.description}</p>}
            </div>
            <button
              type="button"
              className="text-sm opacity-70 transition hover:opacity-100"
              onClick={() => remove(entry.id)}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export { toast }

