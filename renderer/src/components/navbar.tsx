"use client";

import Link from "next/link";
import { SettingsSheet } from "./settings-sheet";
import { SquareMousePointerIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
export function Navbar() {
  const [active, setActive] = useState("workspace");
  const handleActive = (active: string) => {
    if (active === "workspace") {
      setActive("workspace");
    } else {
      setActive("chat");
    }
  };
  return (
    <nav className="w-full relative">
      <div className="flex h-fit pt-2 items-center px-4 justify-between w-full">
        <Link href="/" className="flex items-center space-x-1">
          <SquareMousePointerIcon className="w-4 h-4" />

          <span className="text-sm">Cursor Learn</span>
        </Link>
        <div className="absolute top-1 left-0 w-full h-full flex justify-center items-center">
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              className={cn(
                "text-xs px-2 py-0  rounded-[8px] rounded-b-none  hover:bg-muted/80",
                active === "workspace"
                  ? "border border-border border-b-0 bg-muted"
                  : ""
              )}
              onClick={() => handleActive("workspace")}
            >
              Workspace
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "text-xs px-4 py-0 rounded-[8px] rounded-b-none  hover:bg-muted/80",
                active === "chat"
                  ? "border border-border border-b-0 bg-muted"
                  : ""
              )}
              onClick={() => handleActive("chat")}
            >
              Agents
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-4 z-[1]">
          <SettingsSheet />
        </div>
      </div>
    </nav>
  );
}
