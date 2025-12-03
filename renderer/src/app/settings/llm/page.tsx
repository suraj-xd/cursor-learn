"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, Loader2, Sparkles, Trash2, Key, Bot, Zap, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { agentsIpc } from "@/lib/agents/ipc"
import { toast } from "@/components/ui/toaster"
import {
  PROVIDERS,
  PROVIDER_MODELS,
  PREFERRED_MODELS,
  getDefaultModel,
  getProviderModels,
  type ProviderId,
  type ModelOption,
  type ProviderConfig,
} from "@/lib/ai/config"
import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/store/settings"

type ProviderFormState = {
  key: string
  label: string
  hasKey: boolean
  saving: boolean
  message: string | null
  messageType: "success" | "error" | null
}

const createInitialProviderState = (): Record<ProviderId, ProviderFormState> => {
  return PROVIDERS.reduce((acc, provider) => {
    acc[provider.id] = {
      key: "",
      label: "",
      hasKey: false,
      saving: false,
      message: null,
      messageType: null,
    }
    return acc
  }, {} as Record<ProviderId, ProviderFormState>)
}

const PROVIDER_ICONS: Record<ProviderId, React.ReactNode> = {
  openai: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  ),
  google: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  anthropic: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918zm-10.608 0L0 20.459h3.744l1.464-3.816h7.2l1.464 3.816h3.744L10.92 3.541H6.696zm.456 10.296l2.544-6.624 2.544 6.624H7.152z" />
    </svg>
  ),
  openrouter: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
}

const MODEL_ROLES = [
  { id: "chat", label: "Default Chat", description: "Main model for conversations", icon: Bot },
  { id: "title", label: "Title Generation", description: "Generate chat titles", icon: FileText },
  { id: "compact", label: "Compact/Summary", description: "Summarize conversations", icon: Zap },
] as const

type ModelRole = typeof MODEL_ROLES[number]["id"]

export default function LLMSettingsPage() {
  const [providerForms, setProviderForms] = useState<Record<ProviderId, ProviderFormState>>(createInitialProviderState)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>(null)
  
  const preferredModels = useSettingsStore((state) => state.preferredModels)
  const setPreferredModel = useSettingsStore((state) => state.setPreferredModel)

  useEffect(() => {
    let cancelled = false
    setIsLoadingProviders(true)
    agentsIpc.apiKeys
      .list()
      .then((records) => {
        if (cancelled) return
        setProviderForms((prev) => {
          const next = { ...prev }
          records.forEach((record) => {
            const providerId = record.provider as ProviderId
            if (next[providerId]) {
              next[providerId] = {
                ...next[providerId],
                hasKey: true,
                label: record.label ?? "",
                message: null,
                messageType: null,
              }
            }
          })
          return next
        })
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProviders(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateProviderState = useCallback((id: ProviderId, partial: Partial<ProviderFormState>) => {
    setProviderForms((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...partial },
    }))
  }, [])

  const handleSave = useCallback(async (id: ProviderId) => {
    const current = providerForms[id]
    const keyValue = current.key.trim()
    const labelValue = current.label.trim()

    if (!keyValue) {
      updateProviderState(id, { message: "API key is required", messageType: "error" })
      return
    }

    updateProviderState(id, { saving: true, message: null, messageType: null })

    try {
      await agentsIpc.apiKeys.save({
        provider: id,
        secret: keyValue,
        label: labelValue || undefined,
      })

      updateProviderState(id, {
        saving: false,
        hasKey: true,
        key: "",
        message: "Key saved successfully",
        messageType: "success",
      })
      toast.success(`${PROVIDERS.find(p => p.id === id)?.name} API key saved`)
    } catch (error) {
      updateProviderState(id, {
        saving: false,
        message: error instanceof Error ? error.message : "Unable to save key",
        messageType: "error",
      })
    }
  }, [providerForms, updateProviderState])

  const handleRemove = useCallback(async (id: ProviderId) => {
    updateProviderState(id, { saving: true, message: null, messageType: null })
    try {
      await agentsIpc.apiKeys.delete(id)
      updateProviderState(id, {
        saving: false,
        hasKey: false,
        label: "",
        key: "",
        message: "Key removed",
        messageType: "success",
      })
      toast.success("API key removed")
    } catch (error) {
      updateProviderState(id, {
        saving: false,
        message: error instanceof Error ? error.message : "Unable to remove key",
        messageType: "error",
      })
    }
  }, [updateProviderState])

  const connectedProviders = useMemo(() => {
    return PROVIDERS.filter((p) => providerForms[p.id]?.hasKey)
  }, [providerForms])

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">LLM Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure API keys and model preferences
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your API keys for each provider. Keys are stored securely on your device.
              </p>
            </div>
            {isLoadingProviders && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <div className="space-y-3">
            {PROVIDERS.map((provider) => {
              const state = providerForms[provider.id]
              const isExpanded = expandedProvider === provider.id
              const Icon = PROVIDER_ICONS[provider.id]

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "rounded-lg border transition-colors",
                    state?.hasKey ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className={cn(
                      "p-2 rounded-md",
                      state?.hasKey ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {Icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{provider.name}</span>
                        {state?.hasKey && (
                          <Badge variant="default" className="text-[10px] h-5">
                            Connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-label`} className="text-xs">
                          Label (optional)
                        </Label>
                        <Input
                          id={`${provider.id}-label`}
                          placeholder="e.g., Personal, Work"
                          value={state?.label ?? ""}
                          onChange={(e) => updateProviderState(provider.id, { label: e.target.value })}
                          disabled={state?.saving}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-key`} className="text-xs">
                          API Key
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider.id}-key`}
                            type="password"
                            placeholder={provider.placeholder}
                            value={state?.key ?? ""}
                            onChange={(e) => updateProviderState(provider.id, { key: e.target.value })}
                            disabled={state?.saving}
                            className="flex-1 h-9"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSave(provider.id)}
                            disabled={state?.saving || !state?.key?.trim()}
                            className="h-9"
                          >
                            {state?.saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : state?.hasKey ? (
                              "Update"
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                      {state?.hasKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(provider.id)}
                          disabled={state?.saving}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Remove key
                        </Button>
                      )}
                      {state?.message && (
                        <p className={cn(
                          "text-xs",
                          state.messageType === "error" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                          {state.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {connectedProviders.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Model Preferences
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose default models for different tasks
              </p>
            </div>

            <div className="space-y-4">
              {MODEL_ROLES.map((role) => {
                const Icon = role.icon
                const currentModel = preferredModels[role.id]
                
                return (
                  <div key={role.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/60 bg-card">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{role.label}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    </div>
                    <ModelSelector
                      providers={connectedProviders}
                      value={currentModel}
                      onChange={(modelId) => setPreferredModel(role.id, modelId)}
                    />
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function ModelSelector({
  providers,
  value,
  onChange,
}: {
  providers: ProviderConfig[]
  value?: string
  onChange: (modelId: string) => void
}) {
  const selectedModel = useMemo(() => {
    if (!value) return null
    const [providerId, modelId] = value.includes(':') ? value.split(':') : [null, value]
    
    for (const provider of providers) {
      const models = getProviderModels(provider.id)
      const found = models.find((m) => m.id === modelId || m.id === value)
      if (found) {
        return { provider, model: found }
      }
    }
    return null
  }, [value, providers])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 min-w-[160px] justify-between">
          <span className="truncate text-xs">
            {selectedModel ? selectedModel.model.label : "Select model"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        {providers.map((provider) => {
          const models = getProviderModels(provider.id)
          const preferred = PREFERRED_MODELS[provider.id] ?? []
          const preferredModels = models.filter((m) => preferred.includes(m.id))
          const otherModels = models.filter((m) => !preferred.includes(m.id))

          return (
            <div key={provider.id}>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {provider.name}
              </DropdownMenuLabel>
              {preferredModels.map((model) => (
                <ModelMenuItem
                  key={model.id}
                  model={model}
                  providerId={provider.id}
                  isSelected={value === `${provider.id}:${model.id}`}
                  onSelect={() => onChange(`${provider.id}:${model.id}`)}
                />
              ))}
              {otherModels.length > 0 && preferredModels.length > 0 && (
                <DropdownMenuSeparator />
              )}
              {otherModels.slice(0, 3).map((model) => (
                <ModelMenuItem
                  key={model.id}
                  model={model}
                  providerId={provider.id}
                  isSelected={value === `${provider.id}:${model.id}`}
                  onSelect={() => onChange(`${provider.id}:${model.id}`)}
                />
              ))}
              <DropdownMenuSeparator />
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelMenuItem({
  model,
  providerId,
  isSelected,
  onSelect,
}: {
  model: ModelOption
  providerId: ProviderId
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="cursor-pointer">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs truncate">{model.label}</span>
          {model.isNew && <Sparkles className="h-2.5 w-2.5 text-primary shrink-0" />}
        </div>
        {isSelected && <Check className="h-3 w-3 shrink-0 text-primary" />}
      </div>
    </DropdownMenuItem>
  )
}

