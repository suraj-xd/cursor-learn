import { Github } from "lucide-react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            <p>© 2025 Cursor Chat Browser. MIT License.</p>
          </div>
        </div>
      </div>
    </footer>
  )
} 