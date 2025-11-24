"use client";

import { MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { ChatTab } from "@/types/workspace";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ConversationSidebarProps {
  tabs: ChatTab[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCollapse: (collapsed: boolean) => void;
}

export function ConversationSidebar({
  tabs,
  selectedId,
  onSelect,
  open,
  collapsed,
  onToggle,
  onCollapse,
}: ConversationSidebarProps) {
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
            onClick={() => onCollapse(!collapsed)}
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
            {tabs.map((tab) => (
              <SidebarMenuItem key={tab.id}>
                <SidebarMenuButton
                  isActive={selectedId === tab.id}
                  collapsed={collapsed}
                  tooltip={tab.title || `Chat ${tab.id.slice(0, 8)}`}
                  onClick={() => onSelect(tab.id)}
                >
                  <MessageSquare
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selectedId === tab.id
                        ? "text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70"
                    )}
                  />
                  {!collapsed && (
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="truncate w-full text-left">
                        {tab.title || `Chat ${tab.id.slice(0, 8)}`}
                      </span>
                      <span className="text-[10px] text-sidebar-foreground/50 font-mono">
                        {new Date(tab.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

