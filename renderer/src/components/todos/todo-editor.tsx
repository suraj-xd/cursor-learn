"use client"

import { useEffect, useRef } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Placeholder from "@tiptap/extension-placeholder"
import { Extension } from "@tiptap/core"
import { InputRule } from "@tiptap/core"
import { format, isToday, parseISO, addDays, subDays } from "date-fns"
import { useTodosStore } from "@/store/todos"
import { cn } from "@/lib/utils"

const TodoExtension = Extension.create({
  name: "todoExtension",
  addInputRules() {
    return [
      new InputRule({
        find: /^-\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run()
        },
      }),
      new InputRule({
        find: /^\[\]\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run()
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("taskItem")) {
          return this.editor.chain().focus().sinkListItem("taskItem").run()
        }
        return false
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("taskItem")) {
          return this.editor.chain().focus().liftListItem("taskItem").run()
        }
        return false
      },
    }
  },
})

interface TodoEditorProps {
  className?: string
}

export function TodoEditor({ className }: TodoEditorProps) {
  const { selectedDate, setSelectedDate, todos, upsertTodo, fetchTodo } = useTodosStore()
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentTodo = todos.get(selectedDate)
  const lastSavedContent = useRef<string>("")
  const isLoadingContent = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "todo-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "todo-item",
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing... Type '- ' to create a task",
      }),
      TodoExtension,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[400px] text-[#e8e8e8] text-base leading-relaxed",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isLoadingContent.current) return
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        const content = JSON.stringify(ed.getJSON())
        const plainText = ed.getText()
        if (content !== lastSavedContent.current && plainText.trim()) {
          lastSavedContent.current = content
          upsertTodo({ date: selectedDate, content, plainText })
        }
      }, 800)
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    fetchTodo(selectedDate)
  }, [selectedDate, fetchTodo])

  useEffect(() => {
    if (!editor) return
    
    const todoContent = currentTodo?.content
    if (todoContent === lastSavedContent.current) return
    
    isLoadingContent.current = true
    if (currentTodo) {
      try {
        const content = JSON.parse(currentTodo.content)
        lastSavedContent.current = currentTodo.content
        editor.commands.setContent(content)
      } catch {
        editor.commands.setContent(currentTodo.content)
      }
    } else {
      lastSavedContent.current = ""
      editor.commands.setContent("")
    }
    setTimeout(() => {
      isLoadingContent.current = false
    }, 100)
  }, [currentTodo, editor])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedDate, setSelectedDate])

  const displayDate = parseISO(selectedDate)
  const isTodayDate = isToday(displayDate)

  return (
    <div className={cn("flex flex-1 h-full overflow-y-auto scrollbar-hidden", className)}>
      <div className="w-40 shrink-0 pr-6 text-right">
        <div className="sticky top-0.5 pt-12">
          <div className="text-[#534E4C] text-sm">
            {format(displayDate, "MMM d, yyyy")}
          </div>
          {isTodayDate && (
            <div className="text-[#767676] text-xs mt-0.5">Today</div>
          )}
        </div>
      </div>

      <div className="flex-1 pt-12 pb-8 min-h-0 scrollbar-hidden max-w-5xl mr-auto">
        <EditorContent editor={editor} className="h-full scrollbar-hidden pb-20" />
      </div>

      <style jsx global>{`
        .todo-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .todo-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin: 0.5rem 0;
          padding: 0.25rem 0;
        }
        
        .todo-item > label {
          flex-shrink: 0;
          margin-top: 0.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .todo-item > label input[type="checkbox"] {
          appearance: none;
          width: 1.25rem;
          height: 1.25rem;
          border: 2px solid #444;
          border-radius: 0.375rem;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }
        
        .todo-item > label input[type="checkbox"]:hover {
          border-color: #666;
        }
        
        .todo-item > label input[type="checkbox"]:checked {
          background: #444;
          border-color: #444;
        }
        
        .todo-item > label input[type="checkbox"]:checked::after {
          content: "✓";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #e8e8e8;
          font-size: 0.75rem;
          font-weight: bold;
        }
        
        .todo-item > div {
          flex: 1;
          min-width: 0;
        }
        
        .todo-item > div p {
          margin: 0;
        }
        
        .todo-item[data-checked="true"] > div {
          text-decoration: line-through;
          opacity: 0.5;
        }
        
        .todo-list .todo-list {
          margin-left: 2rem;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #555;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
