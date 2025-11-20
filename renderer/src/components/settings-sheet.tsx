"use client"

import { useMemo } from "react"
import { ChevronDown, Settings2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet"
import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { codeThemeOptions } from "@/lib/code-themes"
import { useSettingsStore } from "@/store/settings"
import type { CodeThemeId } from "@/lib/code-themes"

export function SettingsSheet() {
  const codeTheme = useSettingsStore((state) => state.codeTheme)
  const setCodeTheme = useSettingsStore((state) => state.setCodeTheme)

  const activeOption = useMemo(() => {
    return codeThemeOptions.find((option) => option.id === codeTheme) ?? codeThemeOptions[0]
  }, [codeTheme])

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
                <span className="text-sm font-medium">Interface theme</span>
                <ThemeToggle />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Code theme</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {activeOption.preview.map((color) => (
                            <span
                              key={color}
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span>{activeOption.label}</span>
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
        </div>
      </SheetContent>
    </Sheet>
  )
}

