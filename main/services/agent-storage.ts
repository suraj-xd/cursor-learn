import { randomUUID } from 'node:crypto'
import type { Database as BetterSqliteDatabase, Statement } from 'better-sqlite3'
import { getAgentDatabase } from './database'

type Timestamped = { createdAt: number; updatedAt: number }

export type ApiKeyRecord = {
  provider: string
  label: string | null
  secret: string
} & Timestamped

export type ChatRecord = {
  id: string
  title: string
  modelId: string
  provider: string
  summary: string | null
  workspaceConversationId: string | null
} & Timestamped

export type MessageRecord = {
  id: string
  chatId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: unknown
  tokenUsage: number
  createdAt: number
}

export type ChatMentionRecord = {
  id: number
  chatId: string
  mentionedChatId: string
  createdAt: number
}

export type ContextSummaryRecord = {
  chatId: string
  summary: string
  coveredMessageCount: number
  coveredUntil: number
  tokenEstimate: number
  strategy: 'summarized' | 'truncated'
  createdAt: number
  updatedAt: number
}

const TIMESTAMP = () => Date.now()

const serialize = (value: unknown) => JSON.stringify(value ?? null)
const deserialize = <T>(value: string | null) => (value ? (JSON.parse(value) as T) : null)

const dbStatement = <T extends Statement>(builder: (db: BetterSqliteDatabase) => T) => {
  const db = getAgentDatabase()
  return builder(db)
}

export const upsertApiKey = ({
  provider,
  secret,
  label,
}: {
  provider: string
  secret: string
  label?: string
}): ApiKeyRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO api_keys (provider, label, secret, created_at, updated_at)
       VALUES (@provider, @label, @secret, @createdAt, @updatedAt)
       ON CONFLICT(provider) DO UPDATE SET
         label=excluded.label,
         secret=excluded.secret,
         updated_at=excluded.updated_at`
    )
  )

  stmt.run({
    provider,
    label: label ?? null,
    secret,
    createdAt: now,
    updatedAt: now,
  })

  return getApiKey(provider)
}

export const getApiKey = (provider: string): ApiKeyRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare<ApiKeyRecord & { created_at: number; updated_at: number }>(
      `SELECT provider, label, secret, created_at as createdAt, updated_at as updatedAt
       FROM api_keys WHERE provider = ?`
    )
  )

  return stmt.get(provider) ?? null
}

export const listApiKeys = (): ApiKeyRecord[] => {
  const stmt = dbStatement((database) =>
    database.prepare<ApiKeyRecord & { created_at: number; updated_at: number }>(
      `SELECT provider, label, secret, created_at as createdAt, updated_at as updatedAt
       FROM api_keys ORDER BY provider ASC`
    )
  )

  return stmt.all()
}

export const deleteApiKey = (provider: string): void => {
  const stmt = dbStatement((database) => database.prepare(`DELETE FROM api_keys WHERE provider = ?`))
  stmt.run(provider)
}

export const createChat = ({
  id = randomUUID(),
  title,
  modelId,
  provider,
  summary,
  workspaceConversationId,
}: {
  id?: string
  title: string
  modelId: string
  provider: string
  summary?: string | null
  workspaceConversationId?: string | null
}): ChatRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO chats (id, title, model_id, provider, summary, workspace_conversation_id, created_at, updated_at)
       VALUES (@id, @title, @modelId, @provider, @summary, @workspaceConversationId, @createdAt, @updatedAt)`
    )
  )

  stmt.run({
    id,
    title,
    modelId,
    provider,
    summary: summary ?? null,
    workspaceConversationId: workspaceConversationId ?? null,
    createdAt: now,
    updatedAt: now,
  })

  return getChatById(id)!
}

export const updateChatSummary = ({
  chatId,
  summary,
}: {
  chatId: string
  summary: string
}): ChatRecord | null => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `UPDATE chats SET summary = @summary, updated_at = @updatedAt WHERE id = @chatId RETURNING
        id, title, model_id as modelId, provider, summary, workspace_conversation_id as workspaceConversationId,
        created_at as createdAt, updated_at as updatedAt`
    )
  )

  return stmt.get({ chatId, summary, updatedAt: now }) ?? null
}

export const listChats = ({
  limit = 50,
  search,
  workspaceConversationId,
}: {
  limit?: number
  search?: string
  workspaceConversationId?: string | null
} = {}): ChatRecord[] => {
  const db = getAgentDatabase()
  const trimmedSearch = search?.trim()
  const hasSearch = Boolean(trimmedSearch)
  const conditions: string[] = []
  const params: Record<string, unknown> = { limit }

  if (hasSearch) {
    conditions.push('title LIKE @pattern')
    params.pattern = `%${trimmedSearch}%`
  }

  if (workspaceConversationId) {
    conditions.push('workspace_conversation_id = @workspaceConversationId')
    params.workspaceConversationId = workspaceConversationId
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const stmt = db.prepare(
    `SELECT id, title, model_id as modelId, provider, summary,
      workspace_conversation_id as workspaceConversationId,
      created_at as createdAt, updated_at as updatedAt
     FROM chats
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT @limit`
  )

  return stmt.all(params)
}

export const getChatById = (chatId: string): ChatRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, title, model_id as modelId, provider, summary,
        workspace_conversation_id as workspaceConversationId,
        created_at as createdAt, updated_at as updatedAt
       FROM chats WHERE id = ?`
    )
  )

  return stmt.get(chatId) ?? null
}

export const deleteChat = (chatId: string): void => {
  const stmt = dbStatement((database) => database.prepare(`DELETE FROM chats WHERE id = ?`))
  stmt.run(chatId)
}

export const updateChatModel = ({
  chatId,
  modelId,
}: {
  chatId: string
  modelId: string
}): ChatRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `UPDATE chats
       SET model_id = @modelId,
           updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
       WHERE id = @chatId
       RETURNING id,
                 title,
                 model_id as modelId,
                 provider,
                 summary,
                 workspace_conversation_id as workspaceConversationId,
                 created_at as createdAt,
                 updated_at as updatedAt`,
    ),
  )

  return stmt.get({ chatId, modelId }) ?? null
}

export const updateChatTitle = ({
  chatId,
  title,
}: {
  chatId: string
  title: string
}): ChatRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `UPDATE chats
       SET title = @title,
           updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
       WHERE id = @chatId
       RETURNING id,
                 title,
                 model_id as modelId,
                 provider,
                 summary,
                 workspace_conversation_id as workspaceConversationId,
                 created_at as createdAt,
                 updated_at as updatedAt`,
    ),
  )

  return stmt.get({ chatId, title }) ?? null
}

export const insertMessage = ({
  id = randomUUID(),
  chatId,
  role,
  content,
  metadata,
  tokenUsage = 0,
  createdAt = TIMESTAMP(),
}: {
  id?: string
  chatId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: unknown
  tokenUsage?: number
  createdAt?: number
}): MessageRecord => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO messages (id, chat_id, role, content, metadata, token_usage, created_at)
       VALUES (@id, @chatId, @role, @content, @metadata, @tokenUsage, @createdAt)`
    )
  )

  stmt.run({
    id,
    chatId,
    role,
    content,
    metadata: serialize(metadata),
    tokenUsage,
    createdAt,
  })

  const touchChatStmt = dbStatement((database) =>
    database.prepare(`UPDATE chats SET updated_at = @updatedAt WHERE id = @chatId`),
  )

  touchChatStmt.run({
    chatId,
    updatedAt: TIMESTAMP(),
  })

  return {
    id,
    chatId,
    role,
    content,
    metadata: metadata ?? null,
    tokenUsage,
    createdAt,
  }
}

export const listMessagesForChat = (chatId: string): MessageRecord[] => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, chat_id as chatId, role, content, metadata, token_usage as tokenUsage, created_at as createdAt
       FROM messages
       WHERE chat_id = ?
       ORDER BY created_at ASC`
    )
  )

  const rows = stmt.all(chatId)
  return rows.map((row) => ({
    ...row,
    metadata: deserialize(row.metadata),
  }))
}

export const recordChatMention = ({
  chatId,
  mentionedChatId,
}: {
  chatId: string
  mentionedChatId: string
}): void => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT OR IGNORE INTO chat_mentions (chat_id, mentioned_chat_id, created_at)
       VALUES (@chatId, @mentionedChatId, @createdAt)`
    )
  )

  stmt.run({
    chatId,
    mentionedChatId,
    createdAt: TIMESTAMP(),
  })
}

export const listMentionsForChat = (chatId: string): ChatMentionRecord[] => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, chat_id as chatId, mentioned_chat_id as mentionedChatId, created_at as createdAt
       FROM chat_mentions
       WHERE chat_id = ?
       ORDER BY created_at DESC`
    )
  )

  return stmt.all(chatId)
}

export const getContextSummary = (chatId: string): ContextSummaryRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT chat_id as chatId,
              summary,
              covered_message_count as coveredMessageCount,
              covered_until as coveredUntil,
              token_estimate as tokenEstimate,
              strategy,
              created_at as createdAt,
              updated_at as updatedAt
       FROM context_summaries
       WHERE chat_id = ?`
    )
  )

  return stmt.get(chatId) ?? null
}

export const upsertContextSummary = ({
  chatId,
  summary,
  coveredMessageCount,
  coveredUntil,
  tokenEstimate,
  strategy,
}: {
  chatId: string
  summary: string
  coveredMessageCount: number
  coveredUntil: number
  tokenEstimate: number
  strategy: 'summarized' | 'truncated'
}): ContextSummaryRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO context_summaries (
         chat_id,
         summary,
         covered_message_count,
         covered_until,
         token_estimate,
         strategy,
         created_at,
         updated_at
       ) VALUES (
         @chatId,
         @summary,
         @coveredMessageCount,
         @coveredUntil,
         @tokenEstimate,
         @strategy,
         @createdAt,
         @updatedAt
       )
       ON CONFLICT(chat_id) DO UPDATE SET
         summary = excluded.summary,
         covered_message_count = excluded.covered_message_count,
         covered_until = excluded.covered_until,
         token_estimate = excluded.token_estimate,
         strategy = excluded.strategy,
         updated_at = excluded.updated_at
       RETURNING chat_id as chatId,
                 summary,
                 covered_message_count as coveredMessageCount,
                 covered_until as coveredUntil,
                 token_estimate as tokenEstimate,
                 strategy,
                 created_at as createdAt,
                 updated_at as updatedAt`
    )
  )

  return stmt.get({
    chatId,
    summary,
    coveredMessageCount,
    coveredUntil,
    tokenEstimate,
    strategy,
    createdAt: now,
    updatedAt: now,
  })
}

export const deleteContextSummary = (chatId: string): void => {
  const stmt = dbStatement((database) =>
    database.prepare(`DELETE FROM context_summaries WHERE chat_id = ?`)
  )
  stmt.run(chatId)
}
