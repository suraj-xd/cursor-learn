"use client"

import { useEffect } from "react"
import { TodoEditor } from "@/components/todos/todo-editor"
import { DatePicker } from "@/components/todos/date-picker"
import { useTodosStore } from "@/store/todos"

export default function TodosPage() {
  const { fetchDates, fetchTodos, reset } = useTodosStore()

  useEffect(() => {
    fetchDates()
    fetchTodos()
    return () => reset()
  }, [fetchDates, fetchTodos, reset])

  return (
    <div className="flex h-[calc(100vh-55px)] bg-[#1D1715] border border-border rounded-[8px] overflow-hidden w-full relative">
      <div className="flex-1 flex w-full">
        <TodoEditor />
      </div>
        <DatePicker />
    </div>
  )
}
