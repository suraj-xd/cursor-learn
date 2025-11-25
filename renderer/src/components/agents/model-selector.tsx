"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Cpu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getModelsForProvider, type ModelOption } from "@/lib/agents/models"
import { cn } from "@/lib/utils"
import type { ProviderId } from "@/types/agents"

export function ModelSelector({
  provider,
  selectedModelId,
  onModelChange,
  className,
}: {
  provider: ProviderId
  selectedModelId: string
  onModelChange: (modelId: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  const availableModels = useMemo(
    () => getModelsForProvider(provider),
    [provider]
  )

  const selectedModel = useMemo(
    () => availableModels.find((model) => model.id === selectedModelId),
    [availableModels, selectedModelId]
  )

  if (availableModels.length === 0) {
    return null
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-2 px-2 text-xs",
            className
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {selectedModel?.label || selectedModelId}
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[280px] max-w-[90vw] sm:min-w-[300px]"
      >
        {availableModels.map((model) => {
          const isSelected = model.id === selectedModelId

          return (
            <DropdownMenuItem
              key={model.id}
              onSelect={() => {
                setOpen(false)
                onModelChange(model.id)
              }}
              className="cursor-pointer"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex flex-col items-start gap-0.5">
                  <div className="text-sm font-medium">{model.label}</div>
                  <div className="line-clamp-2 text-muted-foreground text-xs">
                    {model.description}
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

