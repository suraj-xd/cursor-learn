export interface Note {
  id: string
  title: string | null
  content: string
  plainText: string
  labels: string[]
  isPinned: boolean
  createdAt: number
  updatedAt: number
}

export interface NoteCreatePayload {
  id?: string
  title?: string | null
  content: string
  plainText: string
  labels?: string[]
}

export interface NoteUpdatePayload {
  id: string
  title?: string | null
  content?: string
  plainText?: string
  labels?: string[]
  isPinned?: boolean
}

export interface NotesListOptions {
  limit?: number
  offset?: number
  search?: string
}

