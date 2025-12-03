"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronRight, Cpu, Sparkles, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getProviderModels, getProvider, isProviderSupported, type ModelOption, type ProviderId } from "@/lib/ai/config"
import { cn } from "@/lib/utils"
import type { AgentApiKeyMetadata } from "@/types/agents"
import { agentsIpc } from "@/lib/agents/ipc"
import { Badge } from "@/components/ui/badge"

type ModelSelectorProps = {
  provider: ProviderId
  selectedModelId: string
  onModelChange: (modelId: string, newProvider?: ProviderId) => void
  className?: string
}

export function ModelSelector({
  provider,
  selectedModelId,
  onModelChange,
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<ProviderId[]>([provider])

  useEffect(() => {
    agentsIpc.apiKeys.list().then((keys: AgentApiKeyMetadata[]) => {
      const providers = keys.map((k) => k.provider as ProviderId)
      if (providers.length > 0) {
        setAvailableProviders(Array.from(new Set([provider, ...providers])))
      }
    }).catch(() => {})
  }, [provider])

  const currentProviderModels = useMemo(
    () => getProviderModels(provider),
    [provider]
  )

  const selectedModel = useMemo(
    () => currentProviderModels.find((model) => model.id === selectedModelId),
    [currentProviderModels, selectedModelId]
  )

  const currentProviderInfo = getProvider(provider) || { name: provider, supported: false }

  const handleModelSelect = (modelId: string, targetProvider?: ProviderId) => {
    setOpen(false)
    if (targetProvider && targetProvider !== provider) {
      onModelChange(modelId, targetProvider)
    } else {
      onModelChange(modelId)
    }
  }

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-2 px-2.5 text-xs font-medium",
            className
          )}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span className="hidden sm:inline max-w-32 truncate">
            {selectedModel?.label || selectedModelId}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80"
      >
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{currentProviderInfo.name}</span>
        </DropdownMenuLabel>
        
        {currentProviderModels.map((model) => (
          <ModelMenuItem
            key={model.id}
            model={model}
            isSelected={model.id === selectedModelId}
            onSelect={() => handleModelSelect(model.id)}
          />
        ))}

        {availableProviders.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Other Providers
            </DropdownMenuLabel>
            
            {availableProviders
              .filter((p) => p !== provider)
              .map((otherProvider) => {
                const info = getProvider(otherProvider) || { name: otherProvider, supported: false }
                const models = getProviderModels(otherProvider)
                const supported = isProviderSupported(otherProvider)
                
                if (models.length === 0) return null
                
                return (
                  <DropdownMenuSub key={otherProvider}>
                    <DropdownMenuSubTrigger className="gap-2" disabled={!supported}>
                      <span>{info.name}</span>
                      {!supported && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 text-muted-foreground">
                          Soon
                        </Badge>
                      )}
                      {supported && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
                    </DropdownMenuSubTrigger>
                    {supported && (
                      <DropdownMenuSubContent className="w-72">
                        {models.map((model) => (
                          <ModelMenuItem
                            key={model.id}
                            model={model}
                            isSelected={false}
                            onSelect={() => handleModelSelect(model.id, otherProvider)}
                          />
                        ))}
                      </DropdownMenuSubContent>
                    )}
                  </DropdownMenuSub>
                )
              })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelMenuItem({
  model,
  isSelected,
  onSelect,
}: {
  model: ModelOption
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className="cursor-pointer py-2"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{model.label}</span>
            {model.isNew && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] font-medium bg-primary/10 text-primary">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                New
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground line-clamp-1">
            {model.description}
          </span>
        </div>
        {isSelected && (
          <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        )}
      </div>
    </DropdownMenuItem>
  )
}
