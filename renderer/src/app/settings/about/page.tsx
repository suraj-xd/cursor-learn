"use client"

import { Heart } from "lucide-react"
import { APP_CONFIG, getShortVersionString } from "@/lib/config"

export default function AboutPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">About</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Learn more about {APP_CONFIG.name}
        </p>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 p-5 rounded-lg border border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{APP_CONFIG.logo}</span>
            <div>
              <h2 className="text-lg font-medium">{APP_CONFIG.name}</h2>
              <p className="text-xs text-muted-foreground">Version {APP_CONFIG.version}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {APP_CONFIG.description}
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Built with</h3>
          <div className="flex flex-wrap gap-2">
            {APP_CONFIG.techStack.map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 text-xs rounded-md bg-muted/50 border border-border/40"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        <section className="pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> for the curious
          </p>
        </section>
      </div>
    </div>
  )
}

