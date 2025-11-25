"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { colorMode, setColorMode } = useTheme()

  const cycle = () => {
    if (colorMode === "light") setColorMode("dark")
    else if (colorMode === "dark") setColorMode("system")
    else setColorMode("light")
  }

  return (
    <Button variant="ghost" size="icon" onClick={cycle}>
      {colorMode === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
      {colorMode === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
      {colorMode === "system" && <Monitor className="h-[1.2rem] w-[1.2rem]" />}
      <span className="sr-only">Toggle color mode</span>
    </Button>
  )
}
