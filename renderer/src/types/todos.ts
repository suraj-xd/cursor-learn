export interface Todo {
  date: string
  content: string
  plainText: string
  createdAt: number
  updatedAt: number
}

export interface TodoUpsertPayload {
  date: string
  content: string
  plainText: string
}

export interface TodosListOptions {
  limit?: number
  offset?: number
  search?: string
}
