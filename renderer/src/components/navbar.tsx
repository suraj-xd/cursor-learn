"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";
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
    return "workspace";
  };
  
  const active = getActiveTab();

  if (pathname.startsWith("/settings")) {
    return null;
  }

  return (
    <nav className="w-full relative">
      <div className="flex h-fit pt-2 items-center px-4 justify-between w-full">
        <Link href="/" className="flex items-center space-x-1">
          <span className="text-sm pb-1.5"><span className="text-xl"> {APP_CONFIG.logo} </span> {APP_CONFIG.name}</span>
        </Link>
        <div className="absolute top-1 left-0 w-full h-full flex justify-center items-center">
          <div className="flex items-center space-x-1">
            {NAV_TABS.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                className={cn(
                  "text-xs px-4 py-0 rounded-[8px] rounded-b-none hover:bg-muted/80 transition-colors",
                  active === tab.id ? "border border-border border-b-0 bg-muted" : ""
                )}
                asChild
              >
                <Link href={tab.href}>{tab.label}</Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4 z-[1]">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <Settings2 className="size-4" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
