"use client"

import { memo, useCallback, useMemo } from 'react'
import { MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ChatTab } from '@/types/workspace'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ConversationItemProps {
  tab: ChatTab
  isSelected: boolean
  collapsed: boolean
  onSelect: (id: string) => void
}

const ConversationItem = memo(function ConversationItem({ 
  tab, 
  isSelected, 
  collapsed, 
  onSelect 
}: ConversationItemProps) {
  const handleClick = useCallback(() => {
    onSelect(tab.id)
  }, [onSelect, tab.id])

  const displayTitle = tab.title || `Chat ${tab.id.slice(0, 8)}`
  const formattedDate = useMemo(() => {
    return new Date(tab.timestamp).toLocaleDateString()
  }, [tab.timestamp])

  const tooltipText = useMemo(() => {
    return `${displayTitle}\n${formattedDate}`
  }, [displayTitle, formattedDate])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isSelected}
        collapsed={collapsed}
        tooltip={tooltipText}
        onClick={handleClick}
      >
        <MessageSquare
          className={cn(
            "h-4 w-4 shrink-0",
            isSelected
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70"
          )}
        />
        {!collapsed && (
          <div className="flex flex-col items-start overflow-hidden">
            <span className="truncate w-full text-left">
              {displayTitle}
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 font-mono">
              {formattedDate}
            </span>
          </div>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
})

interface ConversationSidebarProps {
  tabs: ChatTab[]
  selectedId: string | null
  onSelect: (id: string) => void
  open: boolean
  collapsed: boolean
  onToggle: () => void
  onCollapse: (collapsed: boolean) => void
}

export const ConversationSidebar = memo(function ConversationSidebar({
  tabs,
  selectedId,
  onSelect,
  open,
  collapsed,
  onCollapse,
}: ConversationSidebarProps) {
  const handleCollapseToggle = useCallback(() => {
    onCollapse(!collapsed)
  }, [onCollapse, collapsed])

  return (
    <Sidebar side="left" open={open} collapsed={collapsed}>
      <SidebarHeader className="justify-between">
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
            Conversations
          </span>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCollapseToggle}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {tabs.map(tab => (
              <ConversationItem
                key={tab.id}
                tab={tab}
                isSelected={selectedId === tab.id}
                collapsed={collapsed}
                onSelect={onSelect}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
})
