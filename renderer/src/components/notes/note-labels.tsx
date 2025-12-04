"use client"

import { useState, useRef, useEffect } from "react"
import { X, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface NoteLabelsProps {
  labels: string[]
  onChange: (labels: string[]) => void
  suggestions?: string[]
  className?: string
  editable?: boolean
}

export function NoteLabels({
  labels,
  onChange,
  suggestions = [],
  className,
  editable = true,
}: NoteLabelsProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  const handleAdd = () => {
    const value = inputValue.trim().toLowerCase()
    if (value && !labels.includes(value)) {
      onChange([...labels, value])
    }
    setInputValue("")
    setIsAdding(false)
  }

  const handleRemove = (label: string) => {
    onChange(labels.filter((l) => l !== label))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    } else if (e.key === "Escape") {
      setIsAdding(false)
      setInputValue("")
    }
  }

  const filteredSuggestions = suggestions.filter(
    (s) => !labels.includes(s) && s.includes(inputValue.toLowerCase())
  ).slice(0, 5)

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className="gap-1 py-0.5 text-[10px] font-normal"
        >
          {label}
          {editable && (
            <button
              type="button"
              onClick={() => handleRemove(label)}
              className="ml-0.5 hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </Badge>
      ))}
      {editable && (
        <>
          {isAdding ? (
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={() => {
                  if (!inputValue) setIsAdding(false)
                }}
                onKeyDown={handleKeyDown}
                placeholder="label"
                className="h-5 w-20 text-[10px] px-1.5"
              />
              {filteredSuggestions.length > 0 && inputValue && (
                <div className="absolute top-6 left-0 z-10 bg-popover border rounded-md shadow-md py-1 min-w-[100px]">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="w-full px-2 py-1 text-left text-xs hover:bg-muted"
                      onMouseDown={() => {
                        onChange([...labels, s])
                        setInputValue("")
                        setIsAdding(false)
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              <span>label</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}

