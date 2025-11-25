"use client"

import { Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: string
  feature?: string
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  provider = "OpenAI",
  feature = "this feature",
}: ApiKeyDialogProps) {
  const handleOpenSettings = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">API Key Required</DialogTitle>
          <DialogDescription className="text-sm">
            Add your {provider} API key in Settings to use {feature}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Configure in Settings</p>
            <p className="text-xs text-muted-foreground">Settings → AI Providers</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenSettings}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button size="sm" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  )
}

