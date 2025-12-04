"use client"

import { useRef, useEffect, useCallback, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useState } from "react"
import { Search, Code2, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SnippetCard } from "./snippet-card"
import { SnippetFilters } from "./snippet-filters"
import { SnippetEditor, NewSnippetEditor } from "./snippet-editor"
import { useSnippetsStore } from "@/store/snippets"
import { useSettingsStore } from "@/store/settings"
import { getCodeThemeStyle } from "@/lib/code-themes"

export function SnippetsList() {
  const {
    snippets,
    editingSnippetId,
    isLoading,
    searchQuery,
    selectedLanguage,
    languages,
    hasMore,
    setSearchQuery,
    setSelectedLanguage,
    setEditingSnippetId,
    fetchSnippets,
    fetchMoreSnippets,
    fetchLanguages,
    deleteSnippet,
    togglePin,
    migrateFromLocalStorage,
  } = useSnippetsStore()
  
  const { codeTheme } = useSettingsStore()
  const codeStyle = useMemo(() => getCodeThemeStyle(codeTheme), [codeTheme])
  const [isCreating, setIsCreating] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const hasMigrated = useRef(false)

  useEffect(() => {
    if (!hasMigrated.current) {
      hasMigrated.current = true
      migrateFromLocalStorage()
    }
  }, [migrateFromLocalStorage])

  useEffect(() => {
    fetchSnippets()
    fetchLanguages()
  }, [fetchSnippets, fetchLanguages])

  const virtualizer = useVirtualizer({
    count: snippets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 3,
  })

  const handleScroll = useCallback(() => {
    const el = parentRef.current
    if (!el) return
    
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !isLoading) {
      fetchMoreSnippets()
    }
  }, [hasMore, isLoading, fetchMoreSnippets])

  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 200)
  }

  const editingSnippet = snippets.find((s) => s.id === editingSnippetId)
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search snippets..."
              defaultValue={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        <SnippetFilters
          languages={languages}
          selectedLanguage={selectedLanguage}
          onSelect={setSelectedLanguage}
        />
      </div>

      <ScrollArea
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 gap-4"
      >
        {snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Code2 className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">
              {searchQuery || selectedLanguage ? "No snippets found" : "No snippets saved yet"}
            </p>
            <p className="text-xs mt-1 opacity-60">
              Save code from agent responses to see them here
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            <div
              className="p-4 space-y-3"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
              }}
            >
              {virtualItems.map((virtualRow) => {
                const snippet = snippets[virtualRow.index]
                return (
                  <div
                    key={snippet.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                  >
                    <SnippetCard
                      snippet={snippet}
                      codeStyle={codeStyle}
                      onPin={() => togglePin(snippet.id)}
                      onDelete={() => deleteSnippet(snippet.id)}
                      onEdit={() => setEditingSnippetId(snippet.id)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {isLoading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}
      </ScrollArea>

      {editingSnippet && (
        <SnippetEditor
          snippet={editingSnippet}
          onClose={() => setEditingSnippetId(null)}
        />
      )}

      {isCreating && (
        <NewSnippetEditor onClose={() => setIsCreating(false)} />
      )}
    </div>
  )
}

