"use client"

import { useState, useEffect, useRef, useMemo, type ComponentType } from "react"
import { X, Save } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NoteLabels } from "@/components/notes/note-labels"
import { useSnippetsStore } from "@/store/snippets"
import { useSettingsStore } from "@/store/settings"
import { getCodeThemeStyle } from "@/lib/code-themes"
import type { Snippet } from "@/types/snippets"

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  placeholder?: string
}

function CodeEditor({ value, onChange, language, placeholder }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const { codeTheme } = useSettingsStore()
  const codeStyle = useMemo(() => getCodeThemeStyle(codeTheme), [codeTheme])
  const Highlighter = SyntaxHighlighter as unknown as ComponentType<{
    style: Record<string, React.CSSProperties>
    language: string
    PreTag: string
    customStyle: React.CSSProperties
    wrapLongLines: boolean
    children: string
  }>

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + "  " + value.substring(end)
      onChange(newValue)
      
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      })
    }
  }

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  return (
    <div className="relative h-full min-h-[300px] rounded-md border bg-muted/30">
      <div 
        ref={highlightRef}
        className="absolute inset-0 overflow-hidden pointer-events-none text-xs"
      >
        <Highlighter
          style={codeStyle}
          language={language || "javascript"}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            minHeight: "100%",
            background: "transparent",
            fontSize: "0.75rem",
          }}
          wrapLongLines={false}
        >
          {value || " "}
        </Highlighter>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="absolute inset-0 w-full h-full p-3 font-mono text-xs bg-transparent text-transparent caret-foreground resize-none focus:outline-none overflow-auto"
        spellCheck={false}
        placeholder={placeholder}
      />
    </div>
  )
}

interface NewSnippetEditorProps {
  onClose: () => void
}

export function NewSnippetEditor({ onClose }: NewSnippetEditorProps) {
  const { createSnippet, labels: allLabels, fetchLabels } = useSnippetsStore()
  const [title, setTitle] = useState("")
  const [language, setLanguage] = useState("javascript")
  const [code, setCode] = useState("")
  const [snippetLabels, setSnippetLabels] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const handleSave = async () => {
    if (!code.trim()) return
    setIsSaving(true)
    await createSnippet({
      title: title || null,
      language,
      code,
      labels: snippetLabels,
    })
    setIsSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-medium">New Snippet</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col xl:flex-row">
          <div className="xl:w-72 shrink-0 p-4 space-y-4 border-b xl:border-b-0 xl:border-r overflow-auto">
            <div className="space-y-2">
              <Label htmlFor="new-title">Title</Label>
              <Input
                id="new-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Snippet title (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-language">Language</Label>
              <Input
                id="new-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="javascript, python, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Labels</Label>
              <NoteLabels
                labels={snippetLabels}
                onChange={setSnippetLabels}
                suggestions={allLabels}
              />
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col min-h-0">
            <Label className="mb-2">Code</Label>
            <div className="flex-1 min-h-0">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
                placeholder="Paste your code here..."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !code.trim()}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SnippetEditorProps {
  snippet: Snippet
  onClose: () => void
}

export function SnippetEditor({ snippet, onClose }: SnippetEditorProps) {
  const { updateSnippet, labels: allLabels, fetchLabels } = useSnippetsStore()
  const [title, setTitle] = useState(snippet.title || "")
  const [language, setLanguage] = useState(snippet.language)
  const [code, setCode] = useState(snippet.code)
  const [snippetLabels, setSnippetLabels] = useState(snippet.labels)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const handleSave = async () => {
    setIsSaving(true)
    await updateSnippet({
      id: snippet.id,
      title: title || null,
      language,
      code,
      labels: snippetLabels,
    })
    setIsSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-medium">Edit Snippet</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col xl:flex-row">
          <div className="xl:w-72 shrink-0 p-4 space-y-4 border-b xl:border-b-0 xl:border-r overflow-auto">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Snippet title (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-language">Language</Label>
              <Input
                id="edit-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="javascript, python, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Labels</Label>
              <NoteLabels
                labels={snippetLabels}
                onChange={setSnippetLabels}
                suggestions={allLabels}
              />
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col min-h-0">
            <Label className="mb-2">Code</Label>
            <div className="flex-1 min-h-0">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={language}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
