"use client"

import { memo, useMemo, useCallback, useState, useEffect, Suspense } from 'react'
import { useSettingsStore } from '@/store/settings'
import { codeThemeStyles } from '@/lib/code-themes'
import { ChatBubble } from './chat-bubble'
import type { ChatTab } from '@/types/workspace'
import { useTheme } from '../theme-provider'
import { cn } from '@/lib/utils'

interface ChatViewProps {
  chat: ChatTab
}

const BubbleSkeleton = memo(function BubbleSkeleton() {
  return (
    <div className="p-4 rounded-lg bg-muted border border-border animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-12 bg-muted-foreground/20 rounded" />
        <div className="h-4 w-32 bg-muted-foreground/20 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted-foreground/20 rounded" />
        <div className="h-4 w-3/4 bg-muted-foreground/20 rounded" />
        <div className="h-4 w-1/2 bg-muted-foreground/20 rounded" />
      </div>
    </div>
  )
})

const INITIAL_BATCH = 10
const LOAD_MORE_BATCH = 10

export const ChatView = memo(function ChatView({ chat }: ChatViewProps) {
  const codeTheme = useSettingsStore(state => state.codeTheme);
  const { uiTheme } = useTheme();
  const codeThemeStyle = useMemo(() => 
    codeThemeStyles[codeTheme] ?? codeThemeStyles.vscDarkPlus,
    [codeTheme]
  )

  const isRetroBoy = uiTheme === 'retro-boy'

  const [loadedCount, setLoadedCount] = useState(INITIAL_BATCH)

  const filteredBubbles = useMemo(() => {
    return chat.bubbles.filter(bubble => bubble.text && bubble.text.trim().length > 0)
  }, [chat.bubbles])

  const visibleBubbles = useMemo(() => {
    return filteredBubbles.slice(0, loadedCount)
  }, [filteredBubbles, loadedCount])

  const hasMore = loadedCount < filteredBubbles.length
  const remainingCount = filteredBubbles.length - loadedCount

  useEffect(() => {
    setLoadedCount(INITIAL_BATCH)
  }, [chat.id])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore) return
    
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 300

    if (scrolledToBottom) {
      setLoadedCount(prev => Math.min(prev + LOAD_MORE_BATCH, filteredBubbles.length))
    }
  }, [hasMore, filteredBubbles.length])

  return (
    <div 
      className={cn(
        "h-full overflow-y-auto p-4 space-y-4",
        isRetroBoy ? "bg-card" : "dark:bg-[#111] bg-[#F5F5F5]"
      )}
      onScroll={handleScroll}
    >
      {visibleBubbles.map((bubble, index) => (
        <Suspense key={`${chat.id}-${index}`} fallback={<BubbleSkeleton />}>
          <ChatBubble
            type={bubble.type}
            text={bubble.text}
            timestamp={bubble.timestamp}
            codeThemeStyle={codeThemeStyle}
            isRetroBoy={isRetroBoy}
          />
        </Suspense>
      ))}
      {hasMore && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Scroll to load more ({remainingCount} remaining)
        </div>
      )}
    </div>
  )
})
