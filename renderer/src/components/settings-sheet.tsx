"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Settings2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { codeThemeOptions } from "@/lib/code-themes"
import { useSettingsStore } from "@/store/settings"
import type { CodeThemeId } from "@/lib/code-themes"
import { Badge } from "./ui/badge"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { agentsIpc } from "@/lib/agents/ipc"
import type { ProviderId } from "@/types/agents"
import { useTheme } from "./theme-provider"
import { UI_THEMES, type UiThemeId } from "@/styles/themes"

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Access GPT-4.1, o1, and lightweight GPT models.",
    placeholder: "sk-...",
  },
  {
    id: "google",
    name: "Google (Gemini)",
    description: "Use Gemini 2.0, Gemini 1.5, and experimental models.",
    placeholder: "AIz...",
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    description: "Claude 3.5 Sonnet, Haiku, and future releases.",
    placeholder: "sk-ant-...",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Multiprovider gateway for meta, mistral, and more.",
    placeholder: "or-...",
  },
] as const satisfies ReadonlyArray<{
  id: ProviderId
  name: string
  description: string
  placeholder: string
}>

type ProviderKey = (typeof PROVIDERS)[number]["id"]

type ProviderFormState = {
  key: string
  label: string
  hasKey: boolean
  saving: boolean
  message: string | null
  messageType: "success" | "error" | null
}

const createInitialProviderState = (): Record<ProviderKey, ProviderFormState> => {
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
  }, {} as Record<ProviderKey, ProviderFormState>)
}

const isProviderKey = (value: string): value is ProviderKey => {
  return PROVIDERS.some((provider) => provider.id === value)
}

export function SettingsSheet() {
  const codeTheme = useSettingsStore((state) => state.codeTheme)
  const setCodeTheme = useSettingsStore((state) => state.setCodeTheme)
  const { uiTheme, setUiTheme } = useTheme()
  const [providerForms, setProviderForms] = useState<Record<ProviderKey, ProviderFormState>>(createInitialProviderState)
  const [isLoadingProviders, setIsLoadingProviders] = useState(false)

  const activeCodeOption = useMemo(() => {
    return codeThemeOptions.find((option) => option.id === codeTheme) ?? codeThemeOptions[0]
  }, [codeTheme])

  const activeUiTheme = useMemo(() => {
    return UI_THEMES.find((t) => t.id === uiTheme) ?? UI_THEMES[0]
  }, [uiTheme])

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
            if (!isProviderKey(record.provider)) {
              return
            }
            next[record.provider] = {
              ...next[record.provider],
              hasKey: true,
              label: record.label ?? "",
              message: null,
              messageType: null,
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

  const updateProviderState = (id: ProviderKey, partial: Partial<ProviderFormState>) => {
    setProviderForms((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...partial,
      },
    }))
  }

  const handleSave = async (id: ProviderKey) => {
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
        message: "Key saved",
        messageType: "success",
      })
    } catch (error) {
      updateProviderState(id, {
        saving: false,
        message: error instanceof Error ? error.message : "Unable to save key",
        messageType: "error",
      })
    }
  }

  const handleRemove = async (id: ProviderKey) => {
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
    } catch (error) {
      updateProviderState(id, {
        saving: false,
        message: error instanceof Error ? error.message : "Unable to remove key",
        messageType: "error",
      })
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 className="size-4" />
          <span className="sr-only">Open settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full max-w-sm flex-col gap-6 p-0">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Adjust how your workspace looks and feels.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <section className="space-y-3">
            <header>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</p>
            </header>
            <div className="space-y-4 rounded-lg border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Color mode</span>
                <ThemeToggle />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">UI theme</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {activeUiTheme.preview.map((color) => (
                            <span
                              key={color}
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span>{activeUiTheme.name}</span>
                      </div>
                      <ChevronDown className="size-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60 max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>UI theme</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={uiTheme}
                      onValueChange={(value) => setUiTheme(value as UiThemeId)}
                    >
                      {UI_THEMES.map((theme) => (
                        <DropdownMenuRadioItem key={theme.id} value={theme.id}>
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {theme.preview.map((color) => (
                                  <span
                                    key={`${theme.id}-${color}`}
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <span>{theme.name}</span>
                            </div>
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Code theme</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {activeCodeOption.preview.map((color) => (
                            <span
                              key={color}
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span>{activeCodeOption.label}</span>
                      </div>
                      <ChevronDown className="size-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60 max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>Code theme</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={codeTheme}
                      onValueChange={(value) => setCodeTheme(value as CodeThemeId)}
                    >
                      {codeThemeOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.id} value={option.id}>
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {option.preview.map((color) => (
                                  <span
                                    key={`${option.id}-${color}`}
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                              <span>{option.label}</span>
                            </div>
                          </div>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <header className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Providers</p>
              {isLoadingProviders && <span className="text-xs text-muted-foreground">Loading…</span>}
            </header>
            <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Connect your own API keys for each provider. Keys never leave your device and are saved securely in local storage.
              </p>
              <div className="space-y-4">
                {PROVIDERS.map((provider) => {
                  const state = providerForms[provider.id]
                  const disabled = state?.saving
                  const labelValue = state?.label ?? ""
                  const keyValue = state?.key ?? ""
                  return (
                    <div key={provider.id} className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{provider.name}</p>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                        <Badge variant={state?.hasKey ? "default" : "secondary"}>
                          {state?.hasKey ? "Connected" : "Not configured"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-label`} className="text-xs text-muted-foreground">
                          Label (optional)
                        </Label>
                        <Input
                          id={`${provider.id}-label`}
                          placeholder="Personal workspace"
                          value={labelValue}
                          onChange={(event) => updateProviderState(provider.id, { label: event.target.value })}
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-key`} className="text-xs text-muted-foreground">
                          API key
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${provider.id}-key`}
                            type="password"
                            placeholder={provider.placeholder}
                            value={keyValue}
                            onChange={(event) => updateProviderState(provider.id, { key: event.target.value })}
                            disabled={disabled}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={() => handleSave(provider.id)}
                            disabled={disabled || keyValue.trim().length === 0}
                          >
                            {state?.saving ? "Saving..." : state?.hasKey ? "Update" : "Save"}
                          </Button>
                        </div>
                        {state?.hasKey && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(provider.id)}
                            disabled={disabled}
                          >
                            Remove key
                          </Button>
                        )}
                        {state?.message && (
                          <p
                            className={
                              state.messageType === "error"
                                ? "text-xs text-destructive"
                                : "text-xs text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {state.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

