"use client"

import { SnippetsList } from "@/components/snippets/snippets-list"

export default function SnippetsPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] border border-border rounded-[8px] mx-4 overflow-hidden">
      <div className="flex-1 overflow-hidden mx-auto w-full">
        <SnippetsList />
      </div>
    </div>
  )
}

