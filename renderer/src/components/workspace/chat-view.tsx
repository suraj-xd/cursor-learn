"use client"

import { memo, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSettingsStore } from '@/store/settings'
import { codeThemeStyles } from '@/lib/code-themes'
import { ChatBubble } from './chat-bubble'
import type { ChatTab } from '@/types/workspace'
import { useTheme } from '../theme-provider'
import { cn } from '@/lib/utils'

interface ChatViewProps {
  chat: ChatTab
}

const ESTIMATED_BUBBLE_HEIGHT = 200

export const ChatView = memo(function ChatView({ chat }: ChatViewProps) {
  const codeTheme = useSettingsStore(state => state.codeTheme)
  const { uiTheme } = useTheme()
  const parentRef = useRef<HTMLDivElement>(null)
  
  const codeThemeStyle = useMemo(() => 
    codeThemeStyles[codeTheme] ?? codeThemeStyles.vscDarkPlus,
    [codeTheme]
  )

  const isRetroBoy = uiTheme === 'retro-boy'

  const filteredBubbles = useMemo(() => {
    return chat.bubbles.filter(bubble => bubble.text && bubble.text.trim().length > 0)
  }, [chat.bubbles])

  const virtualizer = useVirtualizer({
    count: filteredBubbles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => ESTIMATED_BUBBLE_HEIGHT, []),
    overscan: 5,
  })

  useEffect(() => {
    virtualizer.scrollToIndex(0)
  }, [chat.id, virtualizer])

  const items = virtualizer.getVirtualItems()

  return (
    <div 
      ref={parentRef}
      className={cn(
        "h-full overflow-y-auto",
        isRetroBoy ? "bg-card" : "dark:bg-[#111] bg-[#F5F5F5]"
      )}
    >
      <div
        className="relative w-full p-4"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {items.map((virtualItem) => {
          const bubble = filteredBubbles[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full px-4 pb-4"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatBubble
                type={bubble.type}
                text={bubble.text}
                timestamp={bubble.timestamp}
                codeThemeStyle={codeThemeStyle}
                isRetroBoy={isRetroBoy}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})
