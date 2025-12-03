"use client"

import { useEffect, useState } from "react"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUsername } from "@/hooks"

export default function SettingsOverviewPage() {
  const { customName, firstName, fetch, setCustomName, getDisplayName } = useUsername()
  const [inputValue, setInputValue] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch()
  }, [fetch])

  useEffect(() => {
    setInputValue(customName || "")
  }, [customName])

  const displayName = getDisplayName()

  const handleSave = () => {
    const trimmed = inputValue.trim()
    setCustomName(trimmed || null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    setInputValue("")
    setCustomName(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight">
            {displayName ? `Hello, ${displayName}!` : "Hello there!"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Welcome to your settings. Customize your experience below.
        </p>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 p-4 rounded-lg border border-border/60 bg-muted/20">
          <div>
            <h2 className="text-sm font-medium">What should we call you?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set a custom name for a more personal experience
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="display-name" className="text-xs text-muted-foreground">
                Display name
              </Label>
              <div className="flex gap-2">
                <Input
                  id="display-name"
                  placeholder={firstName || "Enter your name"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                  }}
                />
                <Button onClick={handleSave} disabled={saved}>
                  {saved ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
            {customName && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs">
                Use system name instead
              </Button>
            )}
            {firstName && !customName && (
              <p className="text-xs text-muted-foreground">
                Currently using your system name: <span className="font-medium">{firstName}</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
