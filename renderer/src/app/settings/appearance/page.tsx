"use client"

import { useMemo } from "react"
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSettingsStore } from "@/store/settings"
import { useTheme } from "@/components/theme-provider"
import { codeThemeOptions, type CodeThemeId } from "@/lib/code-themes"
import { UI_THEMES, type UiThemeId } from "@/styles/themes"
import { cn } from "@/lib/utils"

const COLOR_MODE_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const

export default function AppearancePage() {
  const codeTheme = useSettingsStore((state) => state.codeTheme)
  const setCodeTheme = useSettingsStore((state) => state.setCodeTheme)
  const { colorMode, setColorMode, uiTheme, setUiTheme } = useTheme()

  const activeCodeOption = useMemo(() => {
    return codeThemeOptions.find((option) => option.id === codeTheme) ?? codeThemeOptions[0]
  }, [codeTheme])

  const activeUiTheme = useMemo(() => {
    return UI_THEMES.find((t) => t.id === uiTheme) ?? UI_THEMES[0]
  }, [uiTheme])

  const activeColorMode = useMemo(() => {
    return COLOR_MODE_OPTIONS.find((m) => m.id === colorMode) ?? COLOR_MODE_OPTIONS[2]
  }, [colorMode])

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how the app looks and feels
        </p>
      </div>

      <div className="space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Color Mode</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose between light, dark, or system preference
            </p>
          </div>
          <div className="flex gap-2">
            {COLOR_MODE_OPTIONS.map((mode) => {
              const Icon = mode.icon
              const isActive = colorMode === mode.id
              return (
                <Button
                  key={mode.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "flex-1 gap-2",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setColorMode(mode.id)}
                >
                  <Icon className="h-4 w-4" />
                  {mode.label}
                </Button>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">UI Theme</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a color scheme for the interface
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {UI_THEMES.map((t) => {
              const isActive = uiTheme === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setUiTheme(t.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border/60 hover:border-border hover:bg-muted/30"
                  )}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {t.preview.map((color, i) => (
                      <span
                        key={`${t.id}-${i}`}
                        className="h-5 w-5 rounded-full ring-1 ring-border/30"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium">{t.name}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium">Code Theme</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Syntax highlighting style for code blocks
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between max-w-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {activeCodeOption.preview.map((color) => (
                      <span
                        key={color}
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span>{activeCodeOption.label}</span>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Code Theme</DropdownMenuLabel>
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
        </section>
      </div>
    </div>
  )
}

