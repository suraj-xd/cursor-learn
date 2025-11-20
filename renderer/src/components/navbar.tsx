"use client"

import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"
import { SquareMousePointerIcon } from "lucide-react";
export function Navbar() {
  return (
    <nav className="border-b">
      <div className="flex h-fit py-2 items-center px-4">
        <Link href="/" className="flex items-center space-x-1.5">
        <SquareMousePointerIcon className="w-5 h-5" />

          <span className="text-lg">Cursor Learn</span>
        </Link>
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
} 