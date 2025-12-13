"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { generateFromString } from "generate-avatar"
import {
  Check,
  Sun,
  Moon,
  Monitor,
  Wand2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  FolderOpen,
  BookOpen,
  Lightbulb,
  Link2,
  Bot,
  CheckSquare,
  StickyNote,
  FileDown,
  Key,
  Palette,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useOnboardingStore } from "@/store/onboarding"
import { useUsername } from "@/hooks"
import { useTheme } from "@/components/theme-provider"
import { UI_THEMES } from "@/styles/themes"
import { useSettingsStore } from "@/store/settings"
import { codeThemeOptions, codeThemeStyles, type CodeThemeId } from "@/lib/code-themes"
import { cn } from "@/lib/utils"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { agentsIpc } from "@/lib/agents/ipc"
import { toast } from "@/components/ui/toaster"
import { PROVIDERS, type ProviderId } from "@/lib/ai/config"

const SAMPLE_CODE = `// Welcome to Cursor Learn! 🚀
function greet(name) {
  const message = \`Hello, \${name}!\`;
  console.log(message);
  return { success: true, user: name };
}

greet("Developer");`

const PROVIDER_ICONS: Record<ProviderId, React.ReactNode> = {
  openai: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  ),
  google: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  anthropic: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918zm-10.608 0L0 20.459h3.744l1.464-3.816h7.2l1.464 3.816h3.744L10.92 3.541H6.696zm.456 10.296l2.544-6.624 2.544 6.624H7.152z" />
    </svg>
  ),
  openrouter: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

type ApiKeyState = Record<ProviderId, { key: string; saving: boolean; saved: boolean }>

const CodePreview = ({ code, theme }: { code: string; theme: CodeThemeId }) => (
  // @ts-expect-error - react-syntax-highlighter types are incomplete
  <SyntaxHighlighter
    language="javascript"
    style={codeThemeStyles[theme]}
    customStyle={{
      margin: 0,
      padding: "1rem",
      fontSize: "12px",
      lineHeight: 1.5,
      borderRadius: 0,
    }}
  >
    {code}
  </SyntaxHighlighter>
)

const colorModes = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const

const highlightOptions = codeThemeOptions.slice(0, 6)

export function OnboardingDialog() {
  const { isComplete, step, setStep, complete, avatarSeed, setAvatarSeed, _hasHydrated } = useOnboardingStore()
  const [open, setOpen] = useState(false)
  const { customName, firstName, setCustomName, fetch, getDisplayName } = useUsername()
  const [nameInput, setNameInput] = useState("")
  const { colorMode, setColorMode, uiTheme, setUiTheme } = useTheme()
  const codeTheme = useSettingsStore((state) => state.codeTheme)
  const setCodeTheme = useSettingsStore((state) => state.setCodeTheme)
  const [apiKeys, setApiKeys] = useState<ApiKeyState>(() =>
    PROVIDERS.reduce((acc, p) => {
      acc[p.id] = { key: "", saving: false, saved: false }
      return acc
    }, {} as ApiKeyState)
  )

  const updateApiKey = useCallback((id: ProviderId, value: string) => {
    setApiKeys((prev) => ({ ...prev, [id]: { ...prev[id], key: value, saved: false } }))
  }, [])

  const saveApiKey = useCallback(async (id: ProviderId) => {
    const keyValue = apiKeys[id].key.trim()
    if (!keyValue) return
    setApiKeys((prev) => ({ ...prev, [id]: { ...prev[id], saving: true } }))
    try {
      await agentsIpc.apiKeys.save({ provider: id, secret: keyValue })
      setApiKeys((prev) => ({ ...prev, [id]: { key: "", saving: false, saved: true } }))
      toast.success(`${PROVIDERS.find((p) => p.id === id)?.name} key saved`)
    } catch {
      setApiKeys((prev) => ({ ...prev, [id]: { ...prev[id], saving: false } }))
      toast.error("Failed to save key")
    }
  }, [apiKeys])

  useEffect(() => {
    fetch()
  }, [fetch])

  useEffect(() => {
    setNameInput(customName || firstName || "")
  }, [customName, firstName])

  useEffect(() => {
    if (_hasHydrated && !isComplete) setOpen(true)
  }, [_hasHydrated, isComplete])

  const seed = avatarSeed || nameInput || getDisplayName() || "intern"

  const avatarUrl = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(generateFromString(seed))}`,
    [seed]
  )

  const steps = [
    {
      title: "Welcome",
      description: "Personalize ⁕ Cursor Learn before you start",
      content: (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-start gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Make it yours</p>
              <p className="text-xs text-muted-foreground">
                Set your display name, avatar, theme, and drop in API keys up front.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Name & avatar",
      description: "Choose how we should greet you",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6 items-center">
          <div className="space-y-3">
            <Input
              placeholder="Enter your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="h-10"
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const randomString = Math.random().toString(36).slice(2, 10)
                  setNameInput(randomString)
                  setAvatarSeed(randomString)
                }}
                className="h-9"
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Surprise me
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAvatarSeed(nameInput || seed)}
                className="h-9"
              >
                Refresh avatar
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <img src={avatarUrl} alt="Avatar" className="h-32 w-32 rounded-2xl border border-border/70 shadow-sm" />
              <Badge variant="secondary" className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap border border-border">
                {seed}
              </Badge>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Theme",
      description: "Pick a vibe and color mode",
      content: (
        <div className="space-y-5">
          <div className="flex gap-2 flex-wrap">
            {colorModes.map((mode) => {
              const Icon = mode.icon
              const active = colorMode === mode.id
              return (
                <Button
                  key={mode.id}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => setColorMode(mode.id)}
                  className={cn(
                    "gap-2 h-9",
                    active && "bg-primary text-primary-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {mode.label}
                </Button>
              )
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {UI_THEMES.map((t) => {
              const active = uiTheme === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setUiTheme(t.id)}
                  className={cn(
                    "rounded-lg border-2 p-3 flex flex-col gap-2 transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/60 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {t.preview.map((color, idx) => (
                      <span
                        key={`${t.id}-${idx}`}
                        className="h-5 w-5 rounded-full ring-1 ring-border/40"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{t.name}</span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ),
    },
    {
      title: "Code theme",
      description: "Syntax highlighting for snippets and answers",
      content: (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <CodePreview code={SAMPLE_CODE} theme={codeTheme} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {highlightOptions.map((option) => {
              const active = codeTheme === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCodeTheme(option.id as CodeThemeId)}
                  className={cn(
                    "rounded-lg border-2 p-2.5 flex items-center gap-2 transition-all text-left",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-1">
                    {option.preview.map((color, idx) => (
                      <span
                        key={`${option.id}-${idx}`}
                        className="h-3 w-3 rounded-full ring-1 ring-border/40"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium flex-1">{option.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      ),
    },
    {
      title: "API keys",
      description: "Connect providers now or later",
      content: (
        <div className="space-y-3">
          {PROVIDERS.map((provider) => {
            const state = apiKeys[provider.id]
            return (
              <div
                key={provider.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  state.saved ? "border-primary/40 bg-primary/5" : "border-border/60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-md",
                    state.saved ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {PROVIDER_ICONS[provider.id]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{provider.name}</span>
                      {state.saved && (
                        <Badge variant="default" className="text-[10px] h-5">Connected</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                  </div>
                </div>
                {!state.saved && (
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="password"
                      placeholder={provider.placeholder}
                      value={state.key}
                      onChange={(e) => updateApiKey(provider.id, e.target.value)}
                      disabled={state.saving}
                      className="flex-1 h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => saveApiKey(provider.id)}
                      disabled={state.saving || !state.key.trim()}
                      className="h-8"
                    >
                      {state.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-muted-foreground text-center pt-1">
            Keys stay local on your device. You can edit anytime in Settings.
          </p>
        </div>
      ),
    },
    {
      title: "Feature packed",
      description: "Everything you need to learn from your coding sessions",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: FolderOpen, label: "Workspace", hint: "Organize projects" },
              { icon: BookOpen, label: "Overviews", hint: "Session insights" },
              { icon: Lightbulb, label: "Learnings", hint: "Auto-extracted" },
              { icon: Link2, label: "Resources", hint: "Curated links" },
              { icon: Bot, label: "Agents", hint: "Context-aware AI" },
              { icon: CheckSquare, label: "Todos", hint: "Task tracking" },
              { icon: StickyNote, label: "Notes & Snippets", hint: "Save code" },
              { icon: FileDown, label: "Export", hint: "PDF, MD, HTML" },
              { icon: Key, label: "Multi Model", hint: "BYOK support" },
              { icon: Palette, label: "Theming", hint: "Dark & light" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/60 bg-muted/20"
              >
                <feature.icon className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium block">{feature.label}</span>
                  {/* <span className="text-[10px] text-muted-foreground">{feature.hint}</span> */}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ]

  const isLast = step === steps.length - 1

  function next() {
    if (step === 1) {
      setCustomName(nameInput.trim() || null)
      setAvatarSeed(seed)
    }
    if (isLast) {
      complete()
      setOpen(false)
      return
    }
    setStep(step + 1)
  }

  function back() {
    if (step === 0) return
    setStep(step - 1)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="!max-w-2xl w-full p-0 overflow-hidden" showCloseButton={false}>
        <div className="p-6 space-y-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-departure uppercase">{steps[step].title}</DialogTitle>
            <DialogDescription>{steps[step].description}</DialogDescription>
          </DialogHeader>
          <div className="animate-in fade-in-50 slide-in-from-right-2 duration-300">
            {steps[step].content}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              {steps.map((s, idx) => (
                <span
                  key={s.title}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 border border-border",
                    step === idx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={back}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isLast ? "Get Started" : "Next"}
                {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
                {/* {isLast && <Sparkles className="h-4 w-4 ml-1" />} */}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
