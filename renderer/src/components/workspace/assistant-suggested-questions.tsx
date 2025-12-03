"use client"

import { memo } from 'react'
import { Code, Lightbulb, Puzzle, BookOpen, Rocket, Target } from 'lucide-react'
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
}

export const AssistantSuggestedQuestions = memo(function AssistantSuggestedQuestions({
  questions,
  onSelect,
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
    </div>
  )
})

