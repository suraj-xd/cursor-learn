"use client"

import { create } from "zustand"

export type ToastVariant = "default" | "success" | "error" | "warning"

export type ToastOptions = {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastEntry = Required<ToastOptions> & { id: string }

type ToastStore = {
  toasts: ToastEntry[]
  add: (toast: ToastOptions) => string
  remove: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = crypto.randomUUID()
    const entry: ToastEntry = {
      id,
      title: toast.title ?? "",
      description: toast.description ?? "",
      variant: toast.variant ?? "default",
      duration: toast.duration ?? 4000,
    }

    set((state) => ({ toasts: [...state.toasts, entry] }))
    return id
  },
  remove: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
  clear: () => set({ toasts: [] }),
}))

export const toast = {
  show: (options: ToastOptions) => useToastStore.getState().add(options),
  success: (description: string, title = "Success") =>
    useToastStore.getState().add({ title, description, variant: "success" }),
  error: (description: string, title = "Something went wrong") =>
    useToastStore.getState().add({ title, description, variant: "error", duration: 6000 }),
  info: (description: string, title = "Info") =>
    useToastStore.getState().add({ title, description, variant: "default" }),
}

