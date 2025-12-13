import type { Exercise } from "@/types/learnings"
import { Badge } from "@/components/ui/badge"
import { Code2, ListChecks, ToggleLeft } from "lucide-react"

type InteractiveInlineProps = {
  exercises?: Exercise[]
  topics?: string[]
}

const typeIconMap = {
  interactive: Code2,
  mcq: ListChecks,
  tf: ToggleLeft,
}

export function InteractiveInline({ exercises = [], topics = [] }: InteractiveInlineProps) {
  const visible = exercises.slice(0, 4)

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">Interactive practice</p>
        <Badge variant="secondary" className="text-[10px]">Interactive</Badge>
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

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">Exercises will appear here.</p>
      ) : (
        <div className="space-y-1">
          {visible.map((ex) => {
            const Icon = typeIconMap[ex.type]
            return (
              <div
                key={ex.id}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 px-2.5 py-2"
              >
                <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-medium leading-snug line-clamp-2">{ex.prompt || "Exercise"}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-[10px] px-2 py-0 capitalize">
                      {ex.type}
                    </Badge>
                    {"difficulty" in ex && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 capitalize">
                        {ex.difficulty}
                      </Badge>
                    )}
                    {ex.topics?.slice(0, 2).map((topic) => (
                      <Badge key={`${ex.id}-${topic}`} variant="outline" className="text-[9px] px-1.5 py-0">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
