"use client"

import { memo, useState, useCallback } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"

interface CopyResponseButtonProps {
  content: string
  className?: string
  variant?: "ghost" | "outline"
  size?: "sm" | "icon"
  showLabel?: boolean
}

export const CopyResponseButton = memo(function CopyResponseButton({
  content,
  className,
  variant = "ghost",
  size = "icon",
  showLabel = false,
}: CopyResponseButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!content) return

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success("Response copied")
    } catch {
      toast.error("Failed to copy")
    }
  }, [content])

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(
        "transition-all",
        size === "icon" && "h-7 w-7",
        size === "sm" && showLabel && "h-7 gap-1.5 px-2",
        className
      )}
      aria-label="Copy response"
    >
      {copied ? (
        <Check className={cn("text-green-500", showLabel ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <Copy className={showLabel ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
      {showLabel && <span className="text-xs">{copied ? "Copied" : "Copy"}</span>}
    </Button>
  )
})

