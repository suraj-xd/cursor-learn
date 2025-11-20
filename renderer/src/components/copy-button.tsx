import { Button } from "@/components/ui/button"
import { ChatTab } from "@/types/workspace"
import { copyMarkdown } from "@/lib/download"
import { Copy } from "lucide-react"

interface CopyButtonProps {
  tab: ChatTab
}

export function CopyButton({ tab }: CopyButtonProps) {
  return (
    <Button variant="outline" size="sm" onClick={() => {
      copyMarkdown(tab)
    }}>
      <Copy className="w-4 h-4 mr-2" />
      Copy All
    </Button>
  )
} 