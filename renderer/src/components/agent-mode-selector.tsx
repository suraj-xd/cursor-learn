"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Infinity as InfinityIcon,
  Pencil,
  Check,
  LayoutList,
  Code,
  BookOpenCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type AgentMode = "agent" | "overview" | "interactive" | "resources";

interface AgentModeSelectorProps {
  value?: AgentMode;
  onChange?: (mode: AgentMode) => void;
}

const MODE_CONFIG: Record<
  AgentMode,
  { label: string; icon: typeof InfinityIcon; colorClass: string }
> = {
  agent: {
    label: "Agent",
    icon: InfinityIcon,
    colorClass: "bg-muted text-muted-foreground hover:bg-muted/80",
  },
  overview: {
    label: "Overview",
    icon: LayoutList,
    colorClass: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/30",
  },
  interactive: {
    label: "Interactive",
    icon: Code,
    colorClass: "bg-green-500/20 text-green-600 dark:text-green-500 hover:bg-green-500/30",
  },
  resources: {
    label: "Resources",
    icon: BookOpenCheck,
    colorClass: "bg-blue-500/20 text-blue-600 dark:text-blue-500 hover:bg-blue-500/30",
  },
};

const MODE_ORDER: AgentMode[] = ["agent", "overview", "interactive", "resources"];

export function AgentModeSelector({
  value = "agent",
  onChange,
}: AgentModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<AgentMode>(value);

  const currentMode = onChange ? value : selectedMode;
  const config = MODE_CONFIG[currentMode];
  const Icon = config.icon;

  const handleModeChange = useCallback(
    (mode: AgentMode) => {
      if (onChange) {
        onChange(mode);
      } else {
        setSelectedMode(mode);
      }
    },
    [onChange]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        const currentIndex = MODE_ORDER.indexOf(currentMode);
        const nextIndex = (currentIndex + 1) % MODE_ORDER.length;
        const nextMode = MODE_ORDER[nextIndex];
        handleModeChange(nextMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMode, handleModeChange]);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors",
            config.colorClass
          )}
        >
          <Icon className="size-3" />
          <span>{config.label}</span>
          <ChevronDown className="size-2" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 p-1" sideOffset={8}>
        <DropdownMenuItem
          className={cn(
            "flex items-center justify-between text-xs py-1.5 px-2",
            currentMode === "agent"
              ? "bg-muted/50 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => handleModeChange("agent")}
        >
          <div className="flex items-center gap-1.5">
            <InfinityIcon className="size-4" />
            <span>Agent</span>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenuShortcut className="text-[10px]">⌘.</DropdownMenuShortcut>
            <button
              type="button"
              className="p-0.5 hover:bg-accent rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(e);
              }}
            >
              <Pencil className="size-2" />
            </button>
            <button
              type="button"
              className="p-0.5 hover:bg-accent rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleSave(e);
              }}
            >
              <Check className="size-2" />
            </button>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "text-xs py-1.5 px-2",
            currentMode === "overview"
              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => handleModeChange("overview")}
        >
          <LayoutList className="size-2" />
          <span>Overview</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "text-xs py-1.5 px-2",
            currentMode === "interactive"
              ? "bg-green-500/10 text-green-600 dark:text-green-500"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => handleModeChange("interactive")}
        >
          <Code className="size-2" />
          <span>Interactive</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "text-xs py-1.5 px-2",
            currentMode === "resources"
              ? "bg-blue-500/10 text-blue-600 dark:text-blue-500"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => handleModeChange("resources")}
        >
          <BookOpenCheck className="size-2" />
          <span>Resources</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
