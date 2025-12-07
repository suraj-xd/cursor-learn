"use client"

import { useState, type CSSProperties, type ComponentType } from "react"
import { Check, Copy, Save } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toaster"
import { Button } from "../ui/button"
import { NewSnippetEditor } from "../snippets/snippet-editor"
import { LanguageIcon } from "@/lib/language-icons"

interface AgentCodeBlockProps {
  code: string
  language: string
  style: { [key: string]: CSSProperties }
  className?: string
  onSaveSnippet?: (code: string, language: string) => void
}

export function AgentCodeBlock({ 
  code, 
  language, 
  style, 
  className,
  onSaveSnippet 
}: AgentCodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [showSnippetEditor, setShowSnippetEditor] = useState(false)
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<any>

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const handleSaveSnippet = () => {
    if (onSaveSnippet) {
      onSaveSnippet(code, language)
    } else {
      setShowSnippetEditor(true)
    }
  }

  return (
    <>
      <div className={cn("relative group rounded-lg overflow-hidden", className)}>
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <CodeBlockAction
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy"}
            onClick={handleCopy}
            active={copied}
          />
          <CodeBlockAction
            icon={Save}
            label="Save to snippets"
            onClick={handleSaveSnippet}
          />
        </div>
      <div className="absolute top-2 left-3 z-10 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
        <LanguageIcon language={language} className="size-3.5" />
      </div>
        <div className="overflow-x-auto pt-7">
          <Highlighter
            style={style}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: "0.5rem",
              paddingTop: "0.75rem",
            }}
            wrapLongLines={false}
          >
            {code}
          </Highlighter>
        </div>
      </div>

      {showSnippetEditor && (
        <NewSnippetEditor
          initialCode={code}
          initialLanguage={language}
          onClose={() => setShowSnippetEditor(false)}
        />
      )}
    </>
  )
}

interface CodeBlockActionProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  active?: boolean
}

function CodeBlockAction({ icon: Icon, label, onClick, active }: CodeBlockActionProps) {
  return (
    <Button
      type="button"
      size={"sm"}
      onClick={onClick}
      title={label}
    >
      <Icon className="size-1" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}

