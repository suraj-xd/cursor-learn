"use client"

import { useEffect, useCallback, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  List, 
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Undo,
  Redo,
  Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NoteLabels } from "./note-labels"
import { useNotesStore } from "@/store/notes"
import { cn } from "@/lib/utils"
import type { Note } from "@/types/notes"

interface NoteEditorProps {
  note: Note
  className?: string
}

export function NoteEditor({ note, className }: NoteEditorProps) {
  const { updateNote, labels: allLabels, fetchLabels } = useNotesStore()
  const [title, setTitle] = useState(note.title || "")
  const [noteLabels, setNoteLabels] = useState(note.labels)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content: (() => {
      try {
        return JSON.parse(note.content)
      } catch {
        return note.content
      }
    })(),
    onUpdate: () => setHasChanges(true),
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  useEffect(() => {
    setTitle(note.title || "")
    setNoteLabels(note.labels)
    setHasChanges(false)
    if (editor) {
      try {
        const content = JSON.parse(note.content)
        editor.commands.setContent(content)
      } catch {
        editor.commands.setContent(note.content)
      }
    }
  }, [note.id, editor])

  const handleSave = useCallback(async () => {
    if (!editor) return
    
    setIsSaving(true)
    const content = JSON.stringify(editor.getJSON())
    const plainText = editor.getText()
    
    await updateNote({
      id: note.id,
      title: title || null,
      content,
      plainText,
      labels: noteLabels,
    })
    
    setHasChanges(false)
    setIsSaving(false)
  }, [editor, note.id, title, noteLabels, updateNote])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleSave])

  if (!editor) return null

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    icon: Icon, 
    title 
  }: { 
    onClick: () => void
    isActive?: boolean
    icon: typeof Bold
    title: string 
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("h-7 w-7 p-0", isActive && "bg-muted")}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="border-b p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setHasChanges(true)
            }}
            placeholder="Note title"
            className="text-lg font-medium border-0 px-0 h-auto focus-visible:ring-0"
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="shrink-0"
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
        <NoteLabels
          labels={noteLabels}
          onChange={(labels) => {
            setNoteLabels(labels)
            setHasChanges(true)
          }}
          suggestions={allLabels}
        />
      </div>

      <div className="border-b px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          title="Bold (⌘B)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={Italic}
          title="Italic (⌘I)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          icon={Strikethrough}
          title="Strikethrough"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          icon={Code}
          title="Inline Code"
        />
        
        <div className="w-px h-4 bg-border mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          icon={Heading1}
          title="Heading 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          icon={Heading2}
          title="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          icon={Heading3}
          title="Heading 3"
        />
        
        <div className="w-px h-4 bg-border mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          icon={List}
          title="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          icon={ListOrdered}
          title="Numbered List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          icon={Quote}
          title="Quote"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          title="Horizontal Rule"
        />
        
        <div className="w-px h-4 bg-border mx-1" />
        
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          icon={Undo}
          title="Undo (⌘Z)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          icon={Redo}
          title="Redo (⌘⇧Z)"
        />
      </div>

      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

