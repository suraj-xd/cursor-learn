"use client"

import { memo } from 'react'
import { Code, Lightbulb, Puzzle, BookOpen, Rocket, Target, RefreshCw, Loader2 } from 'lucide-react'
import type { SuggestedQuestion } from '@/lib/agents/compact-ipc'

const iconMap = {
  code: Code,
  lightbulb: Lightbulb,
  puzzle: Puzzle,
  book: BookOpen,
  rocket: Rocket,
  target: Target,
}

interface AssistantSuggestedQuestionsProps {
  questions: SuggestedQuestion[]
  onSelect: (question: string) => void
  onRefresh?: () => Promise<void>
  isRefreshing?: boolean
}

export const AssistantSuggestedQuestions = memo(function AssistantSuggestedQuestions({
  questions,
  onSelect,
  onRefresh,
  isRefreshing = false,
}: AssistantSuggestedQuestionsProps) {
  if (questions.length === 0) return null

  return (
    <div className="space-y-1.5 px-1">
      {questions.map((q, idx) => {
        const Icon = iconMap[q.icon] || Lightbulb
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(q.question)}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left text-sm rounded-lg bg-muted/40 hover:bg-muted/70  hover:border-border/50 transition-all group border border-border"
          >
            <Icon className="w-4 h-4 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
            <span className="text-foreground/80 group-hover:text-foreground line-clamp-2 transition-colors">
              {q.question}
            </span>
          </button>
        )
      })}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          <span>{isRefreshing ? "Generating..." : "More suggestions"}</span>
        </button>
      )}
    </div>
  )
})

