"use client"

import { useState, useEffect } from "react"
import { X, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NoteLabels } from "@/components/notes/note-labels"
import { useSnippetsStore } from "@/store/snippets"
import type { Snippet } from "@/types/snippets"

interface SnippetEditorProps {
  snippet: Snippet
  onClose: () => void
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-medium">New Snippet</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            <NoteLabels
              labels={snippetLabels}
              onChange={setSnippetLabels}
              suggestions={allLabels}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-code">Code</Label>
            <textarea
              id="new-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 p-3 rounded-md border bg-muted font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
              placeholder="Paste your code here..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-medium">Edit Snippet</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Snippet title (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="javascript, python, etc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            <NoteLabels
              labels={snippetLabels}
              onChange={setSnippetLabels}
              suggestions={allLabels}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <textarea
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-64 p-3 rounded-md border bg-muted font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
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

