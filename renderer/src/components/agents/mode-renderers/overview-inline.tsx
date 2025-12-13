import type { ConversationOverview } from "@/lib/agents/overview-ipc"
import { Badge } from "@/components/ui/badge"

type OverviewInlineProps = {
  overview: ConversationOverview
}

export function OverviewInline({ overview }: OverviewInlineProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-tight">{overview.title}</p>
          <p className="text-xs text-muted-foreground leading-snug line-clamp-3">{overview.summary}</p>
        </div>
        {overview.topics.length > 0 && (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            Overview
          </Badge>
        )}
      </div>

      {overview.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {overview.topics.slice(0, 6).map((topic) => (
            <Badge key={topic} variant="outline" className="text-[10px] px-2 py-0">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border/60 bg-background/60 p-2 text-xs leading-relaxed max-h-48 overflow-y-auto">
        {overview.content}
      </div>
    </div>
  )
}
