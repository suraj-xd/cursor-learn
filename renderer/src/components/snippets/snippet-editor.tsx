"use client"

import { useState, useEffect } from "react"
import { X, Save } from "lucide-react"
import CodeMirror from "@uiw/react-codemirror"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { json } from "@codemirror/lang-json"
import { css } from "@codemirror/lang-css"
import { markdown } from "@codemirror/lang-markdown"
import { yaml } from "@codemirror/lang-yaml"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NoteLabels } from "@/components/notes/note-labels"
import { useSnippetsStore } from "@/store/snippets"
import { useTheme } from "@/components/theme-provider"
import type { Snippet } from "@/types/snippets"

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  placeholder?: string
}

function CodeEditor({ value, onChange, language }: CodeEditorProps) {
  const { resolvedColorMode } = useTheme()

  const getLanguageExtension = (lang: string) => {
    const langKey = lang.toLowerCase()
    switch (langKey) {
      case "javascript":
      case "js":
        return javascript()
      case "typescript":
      case "ts":
        return javascript({ typescript: true })
      case "jsx":
        return javascript({ jsx: true })
      case "tsx":
        return javascript({ jsx: true, typescript: true })
      case "python":
      case "py":
        return python()
      case "json":
        return json()
      case "css":
        return css()
      case "markdown":
      case "md":
        return markdown()
      case "yaml":
      case "yml":
        return yaml()
      default:
        return javascript()
    }
  }

  return (
    <div className="h-full min-h-[300px] rounded-md border overflow-hidden [&_.cm-scroller]:overflow-auto">
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[getLanguageExtension(language)]}
        theme={resolvedColorMode}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: false,
        }}
        className="text-xs h-full [&_.cm-editor]:!outline-none [&_.cm-focused]:ring-2 [&_.cm-focused]:ring-primary/50 [&_.cm-editor]:h-full [&_.cm-scroller]:h-full"
        style={{
          fontSize: "0.75rem",
          height: "100%",
        }}
      />
    </div>
  )
}

interface NewSnippetEditorProps {
  onClose: () => void
  onSaveAndOpen?: (id: string) => void
  initialCode?: string
  initialLanguage?: string
}

export function NewSnippetEditor({ onClose, onSaveAndOpen, initialCode = "", initialLanguage = "javascript" }: NewSnippetEditorProps) {
  const { createSnippet, labels: allLabels, fetchLabels } = useSnippetsStore()
  const [title, setTitle] = useState("")
  const [language, setLanguage] = useState(initialLanguage)
  const [code, setCode] = useState(initialCode)
  const [snippetLabels, setSnippetLabels] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const handleSave = async (openAfter = false) => {
    if (!code.trim()) return
    setIsSaving(true)
    const snippet = await createSnippet({
      title: title || null,
      language,
      code,
      labels: snippetLabels,
    })
    setIsSaving(false)
    if (openAfter && onSaveAndOpen) {
      onSaveAndOpen(snippet.id)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4  border-b">
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

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <Button variant="ghost" onClick={onClose}>
            Discard
          </Button>
          <div className="flex items-center gap-2">
            {onSaveAndOpen && (
              <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving || !code.trim()}>
                Save & Open
              </Button>
            )}
            <Button onClick={() => handleSave(false)} disabled={isSaving || !code.trim()}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
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
