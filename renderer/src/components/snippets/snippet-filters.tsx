"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LanguageIcon } from "@/lib/language-icons"
import type { LanguageCount } from "@/types/snippets"

interface SnippetFiltersProps {
  languages: LanguageCount[]
  selectedLanguage: string | null
  onSelect: (language: string | null) => void
  className?: string
}

const VISIBLE_COUNT = 8

export function SnippetFilters({
  languages,
  selectedLanguage,
  onSelect,
  className,
}: SnippetFiltersProps) {
  const [showAll, setShowAll] = useState(false)

  if (languages.length === 0) return null

  const visibleLanguages = showAll ? languages : languages.slice(0, VISIBLE_COUNT)
  const hiddenCount = languages.length - VISIBLE_COUNT

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Badge
        variant={selectedLanguage === null ? "default" : "outline"}
        className="cursor-pointer text-xs py-0.5"
        onClick={() => onSelect(null)}
      >
        All
      </Badge>
      {visibleLanguages.map(({ language, count }) => (
        <Badge
          key={language}
          variant={selectedLanguage === language ? "default" : "outline"}
          className="cursor-pointer text-xs py-0.5 gap-1.5 items-center"
          onClick={() => onSelect(language === selectedLanguage ? null : language)}
        >
          <LanguageIcon language={language} className="size-3" />
          {language}
          <span className="opacity-60">({count})</span>
        </Badge>
      ))}
      {hiddenCount > 0 && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-xs px-2 gap-1"
          onClick={() => setShowAll(true)}
        >
          +{hiddenCount} more
          <ChevronDown className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

