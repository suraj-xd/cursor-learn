"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Sparkles } from "lucide-react"
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
import {
  getProviderModels,
  getDefaultModel,
  getProvider,
  PREFERRED_MODELS,
  type ModelOption,
  type ProviderId,
} from "@/lib/ai/config"

interface AssistantModelPickerProps {
  availableProviders: ProviderId[]
  selectedProvider: ProviderId
  selectedModel: string
  onSelect: (provider: ProviderId, modelId: string) => void
}

export function AssistantModelPicker({
  availableProviders,
  selectedProvider,
  selectedModel,
  onSelect,
}: AssistantModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const isSingleProvider = availableProviders.length === 1

  const currentModels = useMemo(() => getProviderModels(selectedProvider), [selectedProvider])

  const selectedModelInfo = useMemo(
    () => currentModels.find((m) => m.id === selectedModel),
    [currentModels, selectedModel]
  )

  const preferredModels = useMemo(() => {
    const preferred = PREFERRED_MODELS[selectedProvider] || []
    return currentModels.filter((m) => preferred.includes(m.id))
  }, [selectedProvider, currentModels])

  const otherModels = useMemo(() => {
    const preferred = PREFERRED_MODELS[selectedProvider] || []
    return currentModels.filter((m) => !preferred.includes(m.id))
  }, [selectedProvider, currentModels])

  const handleSelect = (provider: ProviderId, modelId: string) => {
    onSelect(provider, modelId)
    setOpen(false)
    setShowAll(false)
  }

  if (isSingleProvider) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
            <span className="max-w-24 truncate">{selectedModelInfo?.label || selectedModel}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {preferredModels.map((model) => (
            <ModelItem
              key={model.id}
              model={model}
              isSelected={model.id === selectedModel}
              onSelect={() => handleSelect(selectedProvider, model.id)}
            />
          ))}
          {!showAll && otherModels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  setShowAll(true)
                }}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                More models...
              </DropdownMenuItem>
            </>
          )}
          {showAll && otherModels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase">
                All Models
              </DropdownMenuLabel>
              {otherModels.map((model) => (
                <ModelItem
                  key={model.id}
                  model={model}
                  isSelected={model.id === selectedModel}
                  onSelect={() => handleSelect(selectedProvider, model.id)}
                />
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
          <span className="max-w-28 truncate">
            {getProvider(selectedProvider)?.name}: {selectedModelInfo?.label || selectedModel}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {availableProviders.map((provider) => {
          const info = getProvider(provider) || { name: provider }
          const models = getProviderModels(provider)
          const preferred = PREFERRED_MODELS[provider] || []
          const preferredList = models.filter((m) => preferred.includes(m.id))
          const otherList = models.filter((m) => !preferred.includes(m.id))

          return (
            <DropdownMenuSub key={provider}>
              <DropdownMenuSubTrigger className={`text-xs ${provider === selectedProvider ? "text-primary" : "text-muted-foreground"}`}>
                {info.name}
                {/* {provider === selectedProvider && (
                  <Check className="ml-auto h-3 w-3 text-primary" />
                )} */}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60">
                {preferredList.map((model) => (
                  <ModelItem
                    key={model.id}
                    model={model}
                    isSelected={provider === selectedProvider && model.id === selectedModel}
                    onSelect={() => handleSelect(provider, model.id)}
                  />
                ))}
                {otherList.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase">
                      More
                    </DropdownMenuLabel>
                    {otherList.slice(0, 5).map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        isSelected={provider === selectedProvider && model.id === selectedModel}
                        onSelect={() => handleSelect(provider, model.id)}
                      />
                    ))}
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelItem({
  model,
  isSelected,
  onSelect,
}: {
  model: ModelOption
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="cursor-pointer py-1.5">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs truncate">{model.label}</span>
          {model.isNew && (
            <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />
          )}
        </div>
        {isSelected && <Check className="h-3 w-3 shrink-0 text-primary" />}
      </div>
    </DropdownMenuItem>
  )
}

export function getInitialModel(providers: ProviderId[]): { provider: ProviderId; model: string } {
  if (providers.length === 0) {
    return { provider: "openai", model: "gpt-4o-mini" }
  }
  const provider = providers[0]
  const model = getDefaultModel(provider, "chat")
  return { provider, model }
}

