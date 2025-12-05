import { getAgentDatabase } from './database'

export interface TodoRecord {
  date: string
  content: string
  plainText: string
  createdAt: number
  updatedAt: number
}

interface DbTodoRow {
  date: string
  content: string
  plain_text: string
  created_at: number
  updated_at: number
}

function rowToTodo(row: DbTodoRow): TodoRecord {
  return {
    date: row.date,
    content: row.content,
    plainText: row.plain_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listTodos(options?: {
  limit?: number
  offset?: number
  search?: string
}): TodoRecord[] {
  const db = getAgentDatabase()
  const limit = options?.limit ?? 100
  const offset = options?.offset ?? 0
  const search = options?.search?.trim()

  if (search) {
    const searchPattern = `%${search}%`
    const stmt = db.prepare(`
      SELECT * FROM todos 
      WHERE plain_text LIKE ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `)
    const rows = stmt.all(searchPattern, limit, offset) as DbTodoRow[]
    return rows.map(rowToTodo)
  }

  const stmt = db.prepare(`
    SELECT * FROM todos 
    ORDER BY date DESC
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(limit, offset) as DbTodoRow[]
  return rows.map(rowToTodo)
}

export function getTodo(date: string): TodoRecord | null {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT * FROM todos WHERE date = ?')
  const row = stmt.get(date) as DbTodoRow | undefined
  return row ? rowToTodo(row) : null
}

export function upsertTodo(payload: {
  date: string
  content: string
  plainText: string
}): TodoRecord {
  const db = getAgentDatabase()
  const now = Date.now()
  const existing = getTodo(payload.date)

  if (existing) {
    const stmt = db.prepare(`
      UPDATE todos 
      SET content = ?, plain_text = ?, updated_at = ?
      WHERE date = ?
    `)
    stmt.run(payload.content, payload.plainText, now, payload.date)
  } else {
    const stmt = db.prepare(`
      INSERT INTO todos (date, content, plain_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(payload.date, payload.content, payload.plainText, now, now)
  }

  const result = getTodo(payload.date)
  if (!result) {
    throw new Error(`Failed to upsert todo for date ${payload.date}`)
  }
  return result
}

export function deleteTodo(date: string): boolean {
  const db = getAgentDatabase()
  const stmt = db.prepare('DELETE FROM todos WHERE date = ?')
  const result = stmt.run(date)
  return result.changes > 0
}

export function getTodosCount(): number {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM todos')
  const result = stmt.get() as { count: number }
  return result.count
}

export function getDatesWithTodos(): string[] {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT date FROM todos ORDER BY date DESC')
  const rows = stmt.all() as { date: string }[]
  return rows.map((row) => row.date)
}

export function searchTodos(query: string): TodoRecord[] {
  const db = getAgentDatabase()
  const searchPattern = `%${query}%`
  const stmt = db.prepare(`
    SELECT * FROM todos 
    WHERE plain_text LIKE ?
    ORDER BY date DESC
  `)
  const rows = stmt.all(searchPattern) as DbTodoRow[]
  return rows.map(rowToTodo)
}
