"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Paintbrush, Brain, BarChart3, User, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getVersionString } from "@/lib/config"

const SETTINGS_NAV = [
  {
    id: "overview",
    label: "Overview",
    href: "/settings",
    icon: User,
    description: "Your profile",
  },
  {
    id: "llm",
    label: "LLM Settings",
    href: "/settings/llm",
    icon: Brain,
    description: "API keys and model preferences",
  },
  {
    id: "appearance",
    label: "Appearance",
    href: "/settings/appearance",
    icon: Paintbrush,
    description: "Themes and visual settings",
  },
  {
    id: "usage",
    label: "Usage",
    href: "/settings/usage",
    icon: BarChart3,
    description: "Token usage and statistics",
  },
  {
    id: "about",
    label: "About",
    href: "/settings/about",
    icon: Info,
    description: "About this app",
  },
] as const

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const getActiveSection = () => {
    if (pathname === "/settings") return "overview"
    const match = SETTINGS_NAV.find((nav) => nav.href !== "/settings" && pathname.startsWith(nav.href))
    return match?.id ?? "overview"
  }

  const activeSection = getActiveSection()

  return (
    <div className="flex h-[calc(100vh-42px)] overflow-hidden">
      <aside className="w-56 shrink-0 border-r border-border/50 bg-muted/20 flex flex-col">
        <div className="p-3 border-b border-border/50">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8" asChild>
            <Link href="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="text-xs">Back to Home</span>
            </Link>
          </Button>
        </div>
        <div className="p-2 flex-1">
          <div className="space-y-1">
            {SETTINGS_NAV.map((nav) => {
              const Icon = nav.icon
              const isActive = activeSection === nav.id
              return (
                <Link
                  key={nav.id}
                  href={nav.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{nav.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="p-3 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            {getVersionString()}
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

