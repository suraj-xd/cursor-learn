import { getAgentDatabase } from './database'

export interface SnippetRecord {
  id: string
  code: string
  language: string
  title: string | null
  labels: string[]
  sourceContext: string | null
  isPinned: boolean
  createdAt: number
  updatedAt: number
}

interface DbSnippetRow {
  id: string
  code: string
  language: string
  title: string | null
  labels: string | null
  source_context: string | null
  is_pinned: number
  created_at: number
  updated_at: number
}

function rowToSnippet(row: DbSnippetRow): SnippetRecord {
  return {
    id: row.id,
    code: row.code,
    language: row.language,
    title: row.title,
    labels: row.labels ? JSON.parse(row.labels) : [],
    sourceContext: row.source_context,
    isPinned: row.is_pinned === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listSnippets(options?: {
  limit?: number
  offset?: number
  search?: string
  language?: string
}): SnippetRecord[] {
  const db = getAgentDatabase()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  const search = options?.search?.trim()
  const language = options?.language

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (search) {
    conditions.push('(title LIKE ? OR code LIKE ? OR labels LIKE ?)')
    const searchPattern = `%${search}%`
    params.push(searchPattern, searchPattern, searchPattern)
  }

  if (language) {
    conditions.push('language = ?')
    params.push(language)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const stmt = db.prepare(`
    SELECT * FROM snippets 
    ${whereClause}
    ORDER BY is_pinned DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `)
  params.push(limit, offset)

  const rows = stmt.all(...params) as DbSnippetRow[]
  return rows.map(rowToSnippet)
}

export function getSnippet(id: string): SnippetRecord | null {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT * FROM snippets WHERE id = ?')
  const row = stmt.get(id) as DbSnippetRow | undefined
  return row ? rowToSnippet(row) : null
}

export function createSnippet(payload: {
  id?: string
  code: string
  language: string
  title?: string | null
  labels?: string[]
  sourceContext?: string | null
}): SnippetRecord {
  const db = getAgentDatabase()
  const now = Date.now()
  const id = payload.id ?? crypto.randomUUID()
  const title = payload.title ?? null
  const labels = payload.labels ?? []
  const sourceContext = payload.sourceContext ?? null

  const stmt = db.prepare(`
    INSERT INTO snippets (id, code, language, title, labels, source_context, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `)
  stmt.run(id, payload.code, payload.language, title, JSON.stringify(labels), sourceContext, now, now)

  return {
    id,
    code: payload.code,
    language: payload.language,
    title,
    labels,
    sourceContext,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function updateSnippet(
  id: string,
  payload: {
    code?: string
    language?: string
    title?: string | null
    labels?: string[]
    isPinned?: boolean
  }
): SnippetRecord | null {
  const db = getAgentDatabase()
  const existing = getSnippet(id)
  if (!existing) return null

  const now = Date.now()
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (payload.code !== undefined) {
    updates.push('code = ?')
    values.push(payload.code)
  }
  if (payload.language !== undefined) {
    updates.push('language = ?')
    values.push(payload.language)
  }
  if (payload.title !== undefined) {
    updates.push('title = ?')
    values.push(payload.title)
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

  const stmt = db.prepare(`UPDATE snippets SET ${updates.join(', ')} WHERE id = ?`)
  stmt.run(...values)

  return getSnippet(id)
}

export function deleteSnippet(id: string): boolean {
  const db = getAgentDatabase()
  const stmt = db.prepare('DELETE FROM snippets WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}

export function toggleSnippetPin(id: string): SnippetRecord | null {
  const existing = getSnippet(id)
  if (!existing) return null
  return updateSnippet(id, { isPinned: !existing.isPinned })
}

export function getSnippetsCount(): number {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT COUNT(*) as count FROM snippets')
  const result = stmt.get() as { count: number }
  return result.count
}

export function getLanguages(): { language: string; count: number }[] {
  const db = getAgentDatabase()
  const stmt = db.prepare(`
    SELECT language, COUNT(*) as count 
    FROM snippets 
    GROUP BY language 
    ORDER BY count DESC
  `)
  return stmt.all() as { language: string; count: number }[]
}

export function getAllSnippetLabels(): string[] {
  const db = getAgentDatabase()
  const stmt = db.prepare('SELECT DISTINCT labels FROM snippets WHERE labels IS NOT NULL')
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

export function migrateFromLocalStorage(snippets: Array<{
  id: string
  code: string
  language: string
  createdAt: string
}>): number {
  const db = getAgentDatabase()
  let migrated = 0

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO snippets (id, code, language, title, labels, source_context, is_pinned, created_at, updated_at)
    VALUES (?, ?, ?, NULL, '[]', 'migrated-from-local', 0, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const snippet of snippets) {
      const createdAt = new Date(snippet.createdAt).getTime()
      const result = insertStmt.run(snippet.id, snippet.code, snippet.language, createdAt, createdAt)
      if (result.changes > 0) migrated++
    }
  })

  transaction()
  return migrated
}

