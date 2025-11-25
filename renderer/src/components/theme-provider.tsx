"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { ColorMode, UiThemeId } from "@/styles/themes"

type ThemeProviderProps = {
  children: React.ReactNode
}

type ThemeProviderState = {
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  uiTheme: UiThemeId
  setUiTheme: (theme: UiThemeId) => void
  resolvedColorMode: "light" | "dark"
}

const initialState: ThemeProviderState = {
  colorMode: "system",
  setColorMode: () => null,
  uiTheme: "retro-boy",
  setUiTheme: () => null,
  resolvedColorMode: "dark",
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

function getSystemColorMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("color-mode") as ColorMode) || "system"
    }
    return "system"
  })

  const [uiTheme, setUiTheme] = useState<UiThemeId>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ui-theme") as UiThemeId) || "retro-boy"
    }
    return "retro-boy"
  })

  const [resolvedColorMode, setResolvedColorMode] = useState<"light" | "dark">(() => {
    if (colorMode === "system") return getSystemColorMode()
    return colorMode
  })

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = () => {
      const resolved = colorMode === "system" ? getSystemColorMode() : colorMode
      setResolvedColorMode(resolved)

      root.classList.remove("light", "dark")
      root.classList.add(resolved)

      root.setAttribute("data-ui-theme", uiTheme)
    }

    applyTheme()
    localStorage.setItem("color-mode", colorMode)
    localStorage.setItem("ui-theme", uiTheme)

    if (colorMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => applyTheme()
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [colorMode, uiTheme])

  return (
    <ThemeProviderContext.Provider
      value={{ colorMode, setColorMode, uiTheme, setUiTheme, resolvedColorMode }}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
