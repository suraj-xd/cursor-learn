"use client";

import { Bot, Send } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarClose,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AssistantSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AssistantSidebar({ open, onClose }: AssistantSidebarProps) {
  return (
    <Sidebar side="right" open={open} width="400px">
      <SidebarHeader className="justify-end">
        <SidebarClose onClick={onClose} />
      </SidebarHeader>
      <SidebarContent className="flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-full bg-sidebar-accent/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="h-8 w-8 text-sidebar-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">AI Assistant</h3>
            <p className="text-sm text-sidebar-foreground/60 max-w-[280px]">
              Ask questions about your conversations, get summaries, or explore
              insights from your chat history.
            </p>
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex gap-2">
          <Input
            placeholder="Ask about your conversations..."
            className="flex-1 bg-sidebar-accent/5 border-sidebar-border"
            disabled
          />
          <Button size="icon" variant="default" disabled>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-sidebar-foreground/40 text-center mt-2">
          Coming soon
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
