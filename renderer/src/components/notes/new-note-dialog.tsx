"use client"

import { useState, useEffect, useCallback } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { X, Save, Bold, Italic, List, ListOrdered, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NoteLabels } from "./note-labels"
import { useNotesStore } from "@/store/notes"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

interface NewNoteDialogProps {
  onClose: () => void
  initialContent?: string
}

export function NewNoteDialog({ onClose, initialContent = "" }: NewNoteDialogProps) {
  const router = useRouter()
  const { createNote, labels: allLabels, fetchLabels, setSelectedNoteId } = useNotesStore()
  const [title, setTitle] = useState("")
  const [noteLabels, setNoteLabels] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content: initialContent 
      ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: initialContent }] }] }
      : "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-3",
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  const handleSave = useCallback(async (openAfter = false) => {
    if (!editor) return
    
    setIsSaving(true)
    const content = JSON.stringify(editor.getJSON())
    const plainText = editor.getText()
    
    const note = await createNote({
      title: title || null,
      content,
      plainText,
      labels: noteLabels,
    })
    
    setIsSaving(false)
    
    if (openAfter) {
      setSelectedNoteId(note.id)
      router.push("/notes")
    }
    
    onClose()
  }, [editor, title, noteLabels, createNote, onClose, setSelectedNoteId, router])

  if (!editor) return null

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    icon: Icon, 
  }: { 
    onClick: () => void
    isActive?: boolean
    icon: typeof Bold
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("h-7 w-7 p-0", isActive && "bg-muted")}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-medium">New Note</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            <NoteLabels
              labels={noteLabels}
              onChange={setNoteLabels}
              suggestions={allLabels}
            />
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <div className="border rounded-md">
              <div className="border-b px-2 py-1 flex items-center gap-0.5">
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  isActive={editor.isActive("bold")}
                  icon={Bold}
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  isActive={editor.isActive("italic")}
                  icon={Italic}
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  isActive={editor.isActive("code")}
                  icon={Code}
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  isActive={editor.isActive("bulletList")}
                  icon={List}
                />
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  isActive={editor.isActive("orderedList")}
                  icon={ListOrdered}
                />
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <Button variant="ghost" onClick={onClose}>
            Discard
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving}>
              Save & Open
            </Button>
            <Button onClick={() => handleSave(false)} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

