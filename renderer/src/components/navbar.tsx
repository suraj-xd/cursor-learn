"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2, StickyNote, Code2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

const NAV_TABS = [
  { id: "workspace", label: "Workspace", href: "/" },
  { id: "chat", label: "Agents", href: "/agents" },
] as const;

export function Navbar() {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname.startsWith("/agents")) return "chat";
    if (pathname.startsWith("/settings")) return null;
    if (pathname.startsWith("/notes")) return null;
    if (pathname.startsWith("/snippets")) return null;
    return "workspace";
  };

  const active = getActiveTab();

  const isNotesActive = pathname.startsWith("/notes");
  const isSnippetsActive = pathname.startsWith("/snippets");
  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <nav className="w-full relative">
      <div className="flex h-fit pt-2 items-center px-4 justify-between w-full">
        <Link href="/" className="flex items-center space-x-1">
          <span className="text-sm pb-1.5">
            <span className="text-xl"> {APP_CONFIG.logo} </span>{" "}
            {APP_CONFIG.name}
          </span>
        </Link>
        <div className="absolute top-1 left-0 w-full h-full flex justify-center items-center">
          <div className="flex items-center space-x-1">
            {NAV_TABS.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                className={cn(
                  "text-xs px-4 py-0 rounded-[8px] rounded-b-none hover:bg-muted/80 transition-colors",
                  active === tab.id
                    ? "border border-border border-b-0 bg-muted"
                    : ""
                )}
                asChild
              >
                <Link href={tab.href}>{tab.label}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 z-[1] relative top-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs px-4 py-0 rounded-[8px] rounded-b-none hover:bg-muted/80 transition-colors",
              isNotesActive
                ? "border border-border border-b-0 bg-muted"
                : ""
            )}
            asChild
          >
            <Link href="/notes">
              <StickyNote className="w-2 h-2" />
              Notes
              <span className="sr-only">Notes</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs px-4 py-0 rounded-[8px] rounded-b-none hover:bg-muted/80 transition-colors",
              isSnippetsActive
                ? "border border-border border-b-0 bg-muted"
                : ""
            )}
            asChild
          >
            <Link href="/snippets">
              <Code2 className="w-2 h-2" />
              Snippets
              <span className="sr-only">Snippets</span>
            </Link>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "text-xs px-4 py-0 rounded-[8px] rounded-b-none hover:bg-muted/80 transition-colors",
                  isSettingsActive
                    ? "border border-border border-b-0 bg-muted"
                    : ""
                )}
                asChild
              >
                <Link href="/settings">
                  <Settings2 className="size-4" />
                  <span className="sr-only">Settings</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </nav>
  );
}
