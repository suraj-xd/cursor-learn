import type { ConversationAnalysis, Resource } from "@/types/resources"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Lightbulb, Link2 } from "lucide-react"

type ResourcesInlineProps = {
  resources?: Resource[]
  topics?: string[]
  analysis?: ConversationAnalysis | null
}

export function ResourcesInline({ resources = [], topics = [], analysis }: ResourcesInlineProps) {
  const visible = resources.slice(0, 4)

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">Resources</p>
        <Badge variant="secondary" className="text-[10px]">Resources</Badge>
      </div>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.slice(0, 6).map((topic) => (
            <Badge key={topic} variant="outline" className="text-[10px] px-2 py-0">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {analysis?.coreProblem && (
        <div className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-primary" />
          <p className="text-xs leading-snug line-clamp-3">{analysis.coreProblem}</p>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">Resources will appear here.</p>
      ) : (
        <div className="space-y-1">
          {visible.map((res) => (
            <div
              key={res.id}
              className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2 space-y-1"
            >
              <div className="flex items-start gap-2">
                <Link2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-medium leading-snug line-clamp-2">{res.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{res.description}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
                      {res.type}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">
                      {res.category}
                    </Badge>
                    {res.quality && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
                        {res.quality}
                      </Badge>
                    )}
                  </div>
                </div>
                <a
                  href={res.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
