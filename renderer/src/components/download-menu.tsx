import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { SquareArrowOutUpRight } from "lucide-react"
import { ChatTab } from "@/types/workspace"
import { downloadMarkdown, downloadPDF, downloadHTML } from "@/lib/download"

interface DownloadMenuProps {
  tab: ChatTab
}

export function DownloadMenu({ tab }: DownloadMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <SquareArrowOutUpRight className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => downloadMarkdown(tab)}>
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadHTML(tab)}>
          Export as HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadPDF(tab)}>
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 