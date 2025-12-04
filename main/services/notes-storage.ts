import { getAgentDatabase } from './database'

export interface NoteRecord {
  id: string
  title: string | null
  content: string
  plainText: string
  labels: string[]
  isPinned: boolean
  createdAt: number
  updatedAt: number
}

interface DbNoteRow {
  id: string
  title: string | null
  content: string
  plain_text: string
  labels: string | null
  is_pinned: number
  created_at: number
  updated_at: number
}

function rowToNote(row: DbNoteRow): NoteRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    plainText: row.plain_text,
    labels: row.labels ? JSON.parse(row.labels) : [],
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listNotes(options?: {
  limit?: number
  offset?: number
  search?: string
}): NoteRecord[] {
  const db = getAgentDatabase()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  const search = options?.search?.trim()

  if (search) {
    const searchPattern = `%${search}%`
    const stmt = db.prepare(`
      SELECT * FROM notes 
      WHERE title LIKE ? OR plain_text LIKE ? OR labels LIKE ?
      ORDER BY is_pinned DESC, updated_at DESC
      LIMIT ? OFFSET ?
    `)
    const rows = stmt.all(searchPattern, searchPattern, searchPattern, limit, offset) as DbNoteRow[]
    return rows.map(rowToNote)
  }

  const stmt = db.prepare(`
    SELECT * FROM notes 
    ORDER BY is_pinned DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `)
  const rows = stmt.all(limit, offset) as DbNoteRow[]
  return rows.map(rowToNote)
}

export function getNote(id: string): NoteRecord | null {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT * FROM notes WHERE id = ?')
  const row = stmt.get(id) as DbNoteRow | undefined
  return row ? rowToNote(row) : null
}

export function createNote(payload: {
  id?: string
  title?: string | null
  content: string
  plainText: string
  labels?: string[]
}): NoteRecord {
  const db = getAgentDatabase()
  const now = Date.now()
  const id = payload.id ?? crypto.randomUUID()
  const title = payload.title ?? null
  const labels = payload.labels ?? []

  const stmt = db.prepare(`
    INSERT INTO notes (id, title, content, plain_text, labels, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `)
  stmt.run(id, title, payload.content, payload.plainText, JSON.stringify(labels), now, now)

  return {
    id,
    title,
    content: payload.content,
    plainText: payload.plainText,
    labels,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateNote(
  id: string,
  payload: {
    title?: string | null
    content?: string
    plainText?: string
    labels?: string[]
    isPinned?: boolean
  }
): NoteRecord | null {
  const db = getAgentDatabase()
  const existing = getNote(id)
  if (!existing) return null

  const now = Date.now()
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (payload.title !== undefined) {
    updates.push('title = ?')
    values.push(payload.title)
  }
  if (payload.content !== undefined) {
    updates.push('content = ?')
    values.push(payload.content)
  }
  if (payload.plainText !== undefined) {
    updates.push('plain_text = ?')
    values.push(payload.plainText)
  }
  if (payload.labels !== undefined) {
    updates.push('labels = ?')
    values.push(JSON.stringify(payload.labels))
  }
  if (payload.isPinned !== undefined) {
    updates.push('is_pinned = ?')
    values.push(payload.isPinned ? 1 : 0)
  }

  if (updates.length === 0) return existing

  updates.push('updated_at = ?')
  values.push(now)
  values.push(id)

  const stmt = db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`)
  stmt.run(...values)

  return getNote(id)
}

export function deleteNote(id: string): boolean {
  const db = getAgentDatabase()
  const stmt = db.prepare('DELETE FROM notes WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function toggleNotePin(id: string): NoteRecord | null {
  const existing = getNote(id)
  if (!existing) return null
  return updateNote(id, { isPinned: !existing.isPinned })
}

export function getNotesCount(): number {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM notes')
  const result = stmt.get() as { count: number }
  return result.count
}

export function getAllLabels(): string[] {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT DISTINCT labels FROM notes WHERE labels IS NOT NULL')
  const rows = stmt.all() as { labels: string }[]
  
  const labelsSet = new Set<string>()
  for (const row of rows) {
    const parsed = JSON.parse(row.labels) as string[]
    for (const label of parsed) {
      labelsSet.add(label)
    }
  }
  return Array.from(labelsSet).sort()
}

