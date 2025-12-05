"use client"

import { create } from "zustand"
import { format } from "date-fns"
import type { Todo, TodoUpsertPayload, TodosListOptions } from "@/types/todos"

interface TodosState {
  todos: Map<string, Todo>
  datesWithTodos: string[]
  selectedDate: string
  isLoading: boolean
  searchQuery: string

  setSelectedDate: (date: string) => void
  setSearchQuery: (query: string) => void

  fetchTodo: (date: string) => Promise<Todo | null>
  fetchDates: () => Promise<void>
  fetchTodos: (options?: TodosListOptions) => Promise<void>

  upsertTodo: (payload: TodoUpsertPayload) => Promise<Todo>
  deleteTodo: (date: string) => Promise<boolean>

  searchTodos: (query: string) => Promise<Todo[]>

  reset: () => void
}

const getToday = () => format(new Date(), "yyyy-MM-dd")

export const useTodosStore = create<TodosState>((set, get) => ({
  todos: new Map(),
  datesWithTodos: [],
  selectedDate: getToday(),
  isLoading: false,
  searchQuery: "",

  setSelectedDate: (date) => {
    set({ selectedDate: date })
    get().fetchTodo(date)
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  fetchTodo: async (date) => {
    const cached = get().todos.get(date)
    if (cached) return cached

    try {
      const todo = await window.ipc.todos.get(date)
      if (todo) {
        set((state) => {
          const newTodos = new Map(state.todos)
          newTodos.set(date, todo)
          return { todos: newTodos }
        })
      }
      return todo
    } catch (error) {
      console.error("Failed to fetch todo:", error)
      return null
    }
  },

  fetchDates: async () => {
    try {
      const dates = await window.ipc.todos.dates()
      set({ datesWithTodos: dates })
    } catch (error) {
      console.error("Failed to fetch dates:", error)
    }
  },

  fetchTodos: async (options) => {
    set({ isLoading: true })
    try {
      const todosList = await window.ipc.todos.list(options)
      const todosMap = new Map<string, Todo>()
      for (const todo of todosList) {
        todosMap.set(todo.date, todo)
      }
      set({ todos: todosMap, isLoading: false })
    } catch (error) {
      console.error("Failed to fetch todos:", error)
      set({ isLoading: false })
    }
  },

  upsertTodo: async (payload) => {
    const todo = await window.ipc.todos.upsert(payload)
    set((state) => {
      const newTodos = new Map(state.todos)
      newTodos.set(todo.date, todo)
      const newDates = state.datesWithTodos.includes(todo.date)
        ? state.datesWithTodos
        : [todo.date, ...state.datesWithTodos].sort().reverse()
      return { todos: newTodos, datesWithTodos: newDates }
    })
    return todo
  },

  deleteTodo: async (date) => {
    const success = await window.ipc.todos.delete(date)
    if (success) {
      set((state) => {
        const newTodos = new Map(state.todos)
        newTodos.delete(date)
        return {
          todos: newTodos,
          datesWithTodos: state.datesWithTodos.filter((d) => d !== date),
        }
      })
    }
    return success
  },

  searchTodos: async (query) => {
    try {
      return await window.ipc.todos.search(query)
    } catch (error) {
      console.error("Failed to search todos:", error)
      return []
    }
  },

  reset: () => {
    set({
      todos: new Map(),
      datesWithTodos: [],
      selectedDate: getToday(),
      isLoading: false,
      searchQuery: "",
    })
  },
}))
