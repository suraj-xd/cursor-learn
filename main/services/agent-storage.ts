import { randomUUID } from 'node:crypto'
import type { Database as BetterSqliteDatabase, Statement } from 'better-sqlite3'
import { getAgentDatabase } from './database'
import type { ParsedConversation, DialogTurn } from './types/dialog-turn'
import type { OverviewStructure, OverviewSection, DiagramSpec } from './types/overview-structure'
import type { LearningConcept } from './types/learning-concept'

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

export type CompactStrategy = 'full_context' | 'chunked_parallel' | 'hierarchical'
export type CompactStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type CompactStep = 'analyzing' | 'chunking' | 'mapping' | 'reducing' | 'finalizing'

export type CompactedChatRecord = {
  id: string
  workspaceId: string
  conversationId: string
  conversationTitle: string | null
  compactedContent: string
  structuredData: unknown
  originalTokenCount: number | null
  compactedTokenCount: number | null
  compressionRatio: number | null
  modelUsed: string
  strategyUsed: CompactStrategy
  chunkCount: number
  status: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

export type CompactSessionRecord = {
  id: string
  compactedChatId: string | null
  workspaceId: string
  conversationId: string
  status: CompactStatus
  progress: number
  currentStep: CompactStep | null
  chunksTotal: number
  chunksProcessed: number
  logs: CompactSessionLog[]
  error: string | null
  startedAt: number
  completedAt: number | null
}

export type CompactSessionLog = {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: unknown
}

const TIMESTAMP = () => Date.now()

const serialize = (value: unknown) => JSON.stringify(value ?? null)
const deserialize = <T>(value: string | null) => (value ? (JSON.parse(value) as T) : null)

const EMPTY_PARSED_STATS = {
  totalTurns: 0,
  userTurns: 0,
  aiTurns: 0,
  totalTokens: 0,
  codeBlockCount: 0,
  fileCount: 0,
  errorCount: 0,
  decisionCount: 0,
  highImportanceTurns: 0,
}

const EMPTY_OVERVIEW_METADATA = {
  totalTurns: 0,
  processedTurns: 0,
  truncatedTurns: 0,
  tokenBudgetUsed: 0,
  generationTimeMs: 0,
  modelUsed: '',
  structureVersion: 1,
}

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

  return getApiKey(provider)!
}

export const getApiKey = (provider: string): ApiKeyRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT provider, label, secret, created_at as createdAt, updated_at as updatedAt
       FROM api_keys WHERE provider = ?`
    )
  )

  const record = stmt.get(provider) as ApiKeyRecord | undefined
  return record ?? null
}

export const listApiKeys = (): ApiKeyRecord[] => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT provider, label, secret, created_at as createdAt, updated_at as updatedAt
       FROM api_keys ORDER BY provider ASC`
    )
  )

  return stmt.all() as ApiKeyRecord[]
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

  const record = stmt.get({ chatId, summary, updatedAt: now }) as ChatRecord | undefined
  return record ?? null
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

  return stmt.all(params) as ChatRecord[]
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

  const record = stmt.get(chatId) as ChatRecord | undefined
  return record ?? null
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

  const record = stmt.get({ chatId, modelId }) as ChatRecord | undefined
  return record ?? null
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

  const record = stmt.get({ chatId, title }) as ChatRecord | undefined
  return record ?? null
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

  const rows = stmt.all(chatId) as (MessageRecord & { metadata: string | null })[]
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

  return stmt.all(chatId) as ChatMentionRecord[]
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

  const record = stmt.get(chatId) as ContextSummaryRecord | undefined
  return record ?? null
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

  const record = stmt.get({
    chatId,
    summary,
    coveredMessageCount,
    coveredUntil,
    tokenEstimate,
    strategy,
    createdAt: now,
    updatedAt: now,
  }) as ContextSummaryRecord | undefined

  return record!
}

export const deleteContextSummary = (chatId: string): void => {
  const stmt = dbStatement((database) =>
    database.prepare(`DELETE FROM context_summaries WHERE chat_id = ?`)
  )
  stmt.run(chatId)
}

export const createCompactedChat = ({
  id = randomUUID(),
  workspaceId,
  conversationId,
  conversationTitle,
  compactedContent,
  structuredData,
  originalTokenCount,
  compactedTokenCount,
  compressionRatio,
  modelUsed,
  strategyUsed,
  chunkCount = 1,
  status = 'completed',
  metadata,
}: {
  id?: string
  workspaceId: string
  conversationId: string
  conversationTitle?: string | null
  compactedContent: string
  structuredData?: unknown
  originalTokenCount?: number | null
  compactedTokenCount?: number | null
  compressionRatio?: number | null
  modelUsed: string
  strategyUsed: CompactStrategy
  chunkCount?: number
  status?: string
  metadata?: unknown
}): CompactedChatRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO compacted_chats (
         id, workspace_id, conversation_id, conversation_title, compacted_content,
         structured_data, original_token_count, compacted_token_count, compression_ratio,
         model_used, strategy_used, chunk_count, status, metadata, created_at, updated_at
       ) VALUES (
         @id, @workspaceId, @conversationId, @conversationTitle, @compactedContent,
         @structuredData, @originalTokenCount, @compactedTokenCount, @compressionRatio,
         @modelUsed, @strategyUsed, @chunkCount, @status, @metadata, @createdAt, @updatedAt
       )
       ON CONFLICT(workspace_id, conversation_id) DO UPDATE SET
         conversation_title = excluded.conversation_title,
         compacted_content = excluded.compacted_content,
         structured_data = excluded.structured_data,
         original_token_count = excluded.original_token_count,
         compacted_token_count = excluded.compacted_token_count,
         compression_ratio = excluded.compression_ratio,
         model_used = excluded.model_used,
         strategy_used = excluded.strategy_used,
         chunk_count = excluded.chunk_count,
         status = excluded.status,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at
       RETURNING
         id, workspace_id as workspaceId, conversation_id as conversationId,
         conversation_title as conversationTitle, compacted_content as compactedContent,
         structured_data as structuredData, original_token_count as originalTokenCount,
         compacted_token_count as compactedTokenCount, compression_ratio as compressionRatio,
         model_used as modelUsed, strategy_used as strategyUsed, chunk_count as chunkCount,
         status, metadata, created_at as createdAt, updated_at as updatedAt`
    )
  )

  const result = stmt.get({
    id,
    workspaceId,
    conversationId,
    conversationTitle: conversationTitle ?? null,
    compactedContent,
    structuredData: serialize(structuredData),
    originalTokenCount: originalTokenCount ?? null,
    compactedTokenCount: compactedTokenCount ?? null,
    compressionRatio: compressionRatio ?? null,
    modelUsed,
    strategyUsed,
    chunkCount,
    status,
    metadata: serialize(metadata),
    createdAt: now,
    updatedAt: now,
  }) as (CompactedChatRecord & { structuredData: string | null; metadata: string | null }) | undefined

  const record = result!

  return {
    ...record,
    structuredData: deserialize(record.structuredData),
    metadata: deserialize(record.metadata),
  }
}

export const getCompactedChat = (id: string): CompactedChatRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, workspace_id as workspaceId, conversation_id as conversationId,
              conversation_title as conversationTitle, compacted_content as compactedContent,
              structured_data as structuredData, original_token_count as originalTokenCount,
              compacted_token_count as compactedTokenCount, compression_ratio as compressionRatio,
              model_used as modelUsed, strategy_used as strategyUsed, chunk_count as chunkCount,
              status, metadata, created_at as createdAt, updated_at as updatedAt
       FROM compacted_chats WHERE id = ?`
    )
  )

  const result = stmt.get(id) as
    | (CompactedChatRecord & { structuredData: string | null; metadata: string | null })
    | undefined
  if (!result) return null

  const record = result as CompactedChatRecord & { structuredData: string | null; metadata: string | null }

  return {
    ...record,
    structuredData: deserialize(record.structuredData),
    metadata: deserialize(record.metadata),
  }
}

export const getCompactedChatByConversation = (
  workspaceId: string,
  conversationId: string
): CompactedChatRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, workspace_id as workspaceId, conversation_id as conversationId,
              conversation_title as conversationTitle, compacted_content as compactedContent,
              structured_data as structuredData, original_token_count as originalTokenCount,
              compacted_token_count as compactedTokenCount, compression_ratio as compressionRatio,
              model_used as modelUsed, strategy_used as strategyUsed, chunk_count as chunkCount,
              status, metadata, created_at as createdAt, updated_at as updatedAt
       FROM compacted_chats WHERE workspace_id = ? AND conversation_id = ?`
    )
  )

  const result = stmt.get(workspaceId, conversationId) as
    | (CompactedChatRecord & { structuredData: string | null; metadata: string | null })
    | undefined
  if (!result) return null

  const record = result as CompactedChatRecord & { structuredData: string | null; metadata: string | null }

  return {
    ...record,
    structuredData: deserialize(record.structuredData),
    metadata: deserialize(record.metadata),
  }
}

export const deleteCompactedChat = (id: string): void => {
  const stmt = dbStatement((database) =>
    database.prepare(`DELETE FROM compacted_chats WHERE id = ?`)
  )
  stmt.run(id)
}

export const createCompactSession = ({
  id = randomUUID(),
  workspaceId,
  conversationId,
  status = 'pending',
}: {
  id?: string
  workspaceId: string
  conversationId: string
  status?: CompactStatus
}): CompactSessionRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO compact_sessions (
         id, compacted_chat_id, workspace_id, conversation_id, status,
         progress, current_step, chunks_total, chunks_processed, logs, error, started_at, completed_at
       ) VALUES (
         @id, NULL, @workspaceId, @conversationId, @status,
         0, NULL, 0, 0, @logs, NULL, @startedAt, NULL
       )
       RETURNING
         id, compacted_chat_id as compactedChatId, workspace_id as workspaceId,
         conversation_id as conversationId, status, progress, current_step as currentStep,
         chunks_total as chunksTotal, chunks_processed as chunksProcessed,
         logs, error, started_at as startedAt, completed_at as completedAt`
    )
  )

  const result = stmt.get({
    id,
    workspaceId,
    conversationId,
    status,
    logs: serialize([]),
    startedAt: now,
  }) as (CompactSessionRecord & { logs: string | null }) | undefined

  const record = result!

  return {
    ...record,
    logs: (deserialize(record.logs) as CompactSessionLog[]) ?? [],
  }
}

export const getCompactSession = (id: string): CompactSessionRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, compacted_chat_id as compactedChatId, workspace_id as workspaceId,
              conversation_id as conversationId, status, progress, current_step as currentStep,
              chunks_total as chunksTotal, chunks_processed as chunksProcessed,
              logs, error, started_at as startedAt, completed_at as completedAt
       FROM compact_sessions WHERE id = ?`
    )
  )

  const result = stmt.get(id) as (CompactSessionRecord & { logs: string | null }) | undefined
  if (!result) return null

  return {
    ...result,
    logs: (deserialize(result.logs) as CompactSessionLog[]) ?? [],
  }
}

export const getActiveCompactSession = (
  workspaceId: string,
  conversationId: string
): CompactSessionRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, compacted_chat_id as compactedChatId, workspace_id as workspaceId,
              conversation_id as conversationId, status, progress, current_step as currentStep,
              chunks_total as chunksTotal, chunks_processed as chunksProcessed,
              logs, error, started_at as startedAt, completed_at as completedAt
       FROM compact_sessions
       WHERE workspace_id = ? AND conversation_id = ? AND status IN ('pending', 'processing')
       ORDER BY started_at DESC LIMIT 1`
    )
  )

  const result = stmt.get(workspaceId, conversationId) as
    | (CompactSessionRecord & { logs: string | null })
    | undefined
  if (!result) return null

  const record = result as CompactSessionRecord & { logs: string | null }

  return {
    ...record,
    logs: (deserialize(record.logs) as CompactSessionLog[]) ?? [],
  }
}

export const updateCompactSession = ({
  id,
  status,
  progress,
  currentStep,
  chunksTotal,
  chunksProcessed,
  compactedChatId,
  error,
}: {
  id: string
  status?: CompactStatus
  progress?: number
  currentStep?: CompactStep | null
  chunksTotal?: number
  chunksProcessed?: number
  compactedChatId?: string | null
  error?: string | null
}): CompactSessionRecord | null => {
  const updates: string[] = []
  const params: Record<string, unknown> = { id }

  if (status !== undefined) {
    updates.push('status = @status')
    params.status = status
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.push('completed_at = @completedAt')
      params.completedAt = TIMESTAMP()
    }
  }
  if (progress !== undefined) {
    updates.push('progress = @progress')
    params.progress = progress
  }
  if (currentStep !== undefined) {
    updates.push('current_step = @currentStep')
    params.currentStep = currentStep
  }
  if (chunksTotal !== undefined) {
    updates.push('chunks_total = @chunksTotal')
    params.chunksTotal = chunksTotal
  }
  if (chunksProcessed !== undefined) {
    updates.push('chunks_processed = @chunksProcessed')
    params.chunksProcessed = chunksProcessed
  }
  if (compactedChatId !== undefined) {
    updates.push('compacted_chat_id = @compactedChatId')
    params.compactedChatId = compactedChatId
  }
  if (error !== undefined) {
    updates.push('error = @error')
    params.error = error
  }

  if (updates.length === 0) return getCompactSession(id)

  const stmt = dbStatement((database) =>
    database.prepare(
      `UPDATE compact_sessions SET ${updates.join(', ')}
       WHERE id = @id
       RETURNING
         id, compacted_chat_id as compactedChatId, workspace_id as workspaceId,
         conversation_id as conversationId, status, progress, current_step as currentStep,
         chunks_total as chunksTotal, chunks_processed as chunksProcessed,
         logs, error, started_at as startedAt, completed_at as completedAt`
    )
  )

  const result = stmt.get(params) as (CompactSessionRecord & { logs: string | null }) | undefined
  if (!result) return null

  const record = result as CompactSessionRecord & { logs: string | null }

  return {
    ...record,
    logs: (deserialize(record.logs) as CompactSessionLog[]) ?? [],
  }
}

export const appendCompactSessionLog = (
  id: string,
  log: CompactSessionLog
): CompactSessionRecord | null => {
  const session = getCompactSession(id)
  if (!session) return null

  const logs = [...session.logs, log]
  const stmt = dbStatement((database) =>
    database.prepare(
      `UPDATE compact_sessions SET logs = @logs WHERE id = @id
       RETURNING
         id, compacted_chat_id as compactedChatId, workspace_id as workspaceId,
         conversation_id as conversationId, status, progress, current_step as currentStep,
         chunks_total as chunksTotal, chunks_processed as chunksProcessed,
         logs, error, started_at as startedAt, completed_at as completedAt`
    )
  )

  const result = stmt.get({ id, logs: serialize(logs) }) as
    | (CompactSessionRecord & { logs: string | null })
    | undefined
  if (!result) return null

  const record = result as CompactSessionRecord & { logs: string | null }

  return {
    ...record,
    logs: (deserialize(record.logs) as CompactSessionLog[]) ?? [],
  }
}

export const deleteCompactSession = (id: string): void => {
  const stmt = dbStatement((database) =>
    database.prepare(`DELETE FROM compact_sessions WHERE id = ?`)
  )
  stmt.run(id)
}

export type UsageFeature = 'chat' | 'title' | 'compact' | 'summarization'

export type UsageRecord = {
  id: string
  provider: string
  model: string
  feature: UsageFeature
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costEstimate: number
  chatId: string | null
  metadata: unknown
  createdAt: number
}

export type UsageStats = {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  totalCost: number
  totalCalls: number
}

export type UsageByProvider = {
  provider: string
  totalTokens: number
  totalCalls: number
  costEstimate: number
}

export type UsageByModel = {
  provider: string
  model: string
  totalTokens: number
  totalCalls: number
  costEstimate: number
}

export type UsageByDay = {
  date: string
  totalTokens: number
  totalCalls: number
  costEstimate: number
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5.2': { input: 5, output: 20 },
  'gpt-5.1': { input: 5, output: 20 },
  'gpt-4o-2024-11-20': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'o3': { input: 10, output: 40 },
  'o1': { input: 15, output: 60 },
  'o1-mini': { input: 3, output: 12 },
  'gemini-3-pro': { input: 2.5, output: 10 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-1.5-flash-002': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-opus-4-1': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) return 0
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

export const recordUsage = ({
  id = randomUUID(),
  provider,
  model,
  feature,
  inputTokens = 0,
  outputTokens = 0,
  chatId,
  metadata,
}: {
  id?: string
  provider: string
  model: string
  feature: UsageFeature
  inputTokens?: number
  outputTokens?: number
  chatId?: string | null
  metadata?: unknown
}): UsageRecord => {
  const now = TIMESTAMP()
  const totalTokens = inputTokens + outputTokens
  const costEstimate = calculateCost(model, inputTokens, outputTokens)

  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO usage_records (id, provider, model, feature, input_tokens, output_tokens, total_tokens, cost_estimate, chat_id, metadata, created_at)
       VALUES (@id, @provider, @model, @feature, @inputTokens, @outputTokens, @totalTokens, @costEstimate, @chatId, @metadata, @createdAt)`
    )
  )

  stmt.run({
    id,
    provider,
    model,
    feature,
    inputTokens,
    outputTokens,
    totalTokens,
    costEstimate,
    chatId: chatId ?? null,
    metadata: serialize(metadata),
    createdAt: now,
  })

  return {
    id,
    provider,
    model,
    feature,
    inputTokens,
    outputTokens,
    totalTokens,
    costEstimate,
    chatId: chatId ?? null,
    metadata: metadata ?? null,
    createdAt: now,
  }
}

export const getUsageStats = (since?: number): UsageStats => {
  const db = getAgentDatabase()
  const whereClause = since ? 'WHERE created_at >= @since' : ''
  
  const stmt = db.prepare(
    `SELECT 
       COALESCE(SUM(total_tokens), 0) as totalTokens,
       COALESCE(SUM(input_tokens), 0) as inputTokens,
       COALESCE(SUM(output_tokens), 0) as outputTokens,
       COALESCE(SUM(cost_estimate), 0) as totalCost,
       COUNT(*) as totalCalls
     FROM usage_records
     ${whereClause}`
  )

  const result = since ? stmt.get({ since }) : stmt.get()
  return result as UsageStats
}

export const getUsageByProvider = (since?: number): UsageByProvider[] => {
  const db = getAgentDatabase()
  const whereClause = since ? 'WHERE created_at >= @since' : ''
  
  const stmt = db.prepare(
    `SELECT 
       provider,
       COALESCE(SUM(total_tokens), 0) as totalTokens,
       COUNT(*) as totalCalls,
       COALESCE(SUM(cost_estimate), 0) as costEstimate
     FROM usage_records
     ${whereClause}
     GROUP BY provider
     ORDER BY totalTokens DESC`
  )

  return (since ? stmt.all({ since }) : stmt.all()) as UsageByProvider[]
}

export const getUsageByModel = (since?: number): UsageByModel[] => {
  const db = getAgentDatabase()
  const whereClause = since ? 'WHERE created_at >= @since' : ''
  
  const stmt = db.prepare(
    `SELECT 
       provider,
       model,
       COALESCE(SUM(total_tokens), 0) as totalTokens,
       COUNT(*) as totalCalls,
       COALESCE(SUM(cost_estimate), 0) as costEstimate
     FROM usage_records
     ${whereClause}
     GROUP BY provider, model
     ORDER BY totalTokens DESC`
  )

  return (since ? stmt.all({ since }) : stmt.all()) as UsageByModel[]
}

export const getUsageByDay = (since?: number): UsageByDay[] => {
  const db = getAgentDatabase()
  const whereClause = since ? 'WHERE created_at >= @since' : ''
  
  const stmt = db.prepare(
    `SELECT 
       date(created_at / 1000, 'unixepoch') as date,
       COALESCE(SUM(total_tokens), 0) as totalTokens,
       COUNT(*) as totalCalls,
       COALESCE(SUM(cost_estimate), 0) as costEstimate
     FROM usage_records
     ${whereClause}
     GROUP BY date(created_at / 1000, 'unixepoch')
     ORDER BY date DESC
     LIMIT 30`
  )

  return (since ? stmt.all({ since }) : stmt.all()) as UsageByDay[]
}

export const listUsageRecords = ({
  limit = 50,
  since,
  provider,
  feature,
}: {
  limit?: number
  since?: number
  provider?: string
  feature?: UsageFeature
} = {}): UsageRecord[] => {
  const db = getAgentDatabase()
  const conditions: string[] = []
  const params: Record<string, unknown> = { limit }

  if (since) {
    conditions.push('created_at >= @since')
    params.since = since
  }
  if (provider) {
    conditions.push('provider = @provider')
    params.provider = provider
  }
  if (feature) {
    conditions.push('feature = @feature')
    params.feature = feature
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const stmt = db.prepare(
    `SELECT id, provider, model, feature,
       input_tokens as inputTokens, output_tokens as outputTokens,
       total_tokens as totalTokens, cost_estimate as costEstimate,
       chat_id as chatId, metadata, created_at as createdAt
     FROM usage_records
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT @limit`
  )

  const rows = stmt.all(params)
  return rows.map((row: any) => ({
    ...row,
    metadata: deserialize(row.metadata),
  }))
}

export type OverviewStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type OverviewStep = 'analyzing' | 'extracting' | 'generating' | 'finalizing'

export type ConversationOverviewRecord = {
  id: string
  workspaceId: string
  conversationId: string
  title: string
  summary: string
  topics: string[]
  content: string
  modelUsed: string
  status: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

export type OverviewSessionRecord = {
  id: string
  overviewId: string | null
  workspaceId: string
  conversationId: string
  status: OverviewStatus
  progress: number
  currentStep: OverviewStep | null
  error: string | null
  startedAt: number
  completedAt: number | null
}

export const createConversationOverview = ({
  id = randomUUID(),
  workspaceId,
  conversationId,
  title,
  summary,
  topics,
  content,
  modelUsed,
  status = 'completed',
  metadata,
}: {
  id?: string
  workspaceId: string
  conversationId: string
  title: string
  summary: string
  topics: string[]
  content: string
  modelUsed: string
  status?: string
  metadata?: unknown
}): ConversationOverviewRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO conversation_overviews (
         id, workspace_id, conversation_id, title, description,
         topics, agendas, key_insights, model_used, status, metadata, created_at, updated_at
       ) VALUES (
         @id, @workspaceId, @conversationId, @title, @summary,
         @topics, @content, '[]', @modelUsed, @status, @metadata, @createdAt, @updatedAt
       )
       ON CONFLICT(workspace_id, conversation_id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         topics = excluded.topics,
         agendas = excluded.agendas,
         model_used = excluded.model_used,
         status = excluded.status,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at
       RETURNING
         id, workspace_id as workspaceId, conversation_id as conversationId,
         title, description as summary, topics, agendas as content,
         model_used as modelUsed, status, metadata, created_at as createdAt, updated_at as updatedAt`
    )
  )

  const result = stmt.get({
    id,
    workspaceId,
    conversationId,
    title,
    summary,
    topics: serialize(topics),
    content,
    modelUsed,
    status,
    metadata: serialize(metadata),
    createdAt: now,
    updatedAt: now,
  }) as ConversationOverviewRecord & { topics: string; metadata: string }

  return {
    ...result,
    topics: deserialize<string[]>(result.topics) ?? [],
    metadata: deserialize(result.metadata),
  }
}

export const getConversationOverview = (id: string): ConversationOverviewRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, workspace_id as workspaceId, conversation_id as conversationId,
              title, description as summary, topics, agendas as content,
              model_used as modelUsed, status, metadata, created_at as createdAt, updated_at as updatedAt
       FROM conversation_overviews WHERE id = ?`
    )
  )

  const result = stmt.get(id) as (ConversationOverviewRecord & { topics: string; metadata: string }) | undefined
  if (!result) return null

  return {
    ...result,
    topics: deserialize<string[]>(result.topics) ?? [],
    metadata: deserialize(result.metadata),
  }
}

export const getOverviewByConversation = (
  workspaceId: string,
  conversationId: string
): ConversationOverviewRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, workspace_id as workspaceId, conversation_id as conversationId,
              title, description as summary, topics, agendas as content,
              model_used as modelUsed, status, metadata, created_at as createdAt, updated_at as updatedAt
       FROM conversation_overviews WHERE workspace_id = ? AND conversation_id = ?`
    )
  )

  const result = stmt.get(workspaceId, conversationId) as (ConversationOverviewRecord & { topics: string; metadata: string }) | undefined
  if (!result) return null

  return {
    ...result,
    topics: deserialize<string[]>(result.topics) ?? [],
    metadata: deserialize(result.metadata),
  }
}

export const deleteConversationOverview = (id: string): void => {
  const stmt = dbStatement((database) =>
    database.prepare(`DELETE FROM conversation_overviews WHERE id = ?`)
  )
  stmt.run(id)
}

export const createOverviewSession = ({
  id = randomUUID(),
  workspaceId,
  conversationId,
  status = 'pending',
}: {
  id?: string
  workspaceId: string
  conversationId: string
  status?: OverviewStatus
}): OverviewSessionRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO overview_sessions (
         id, overview_id, workspace_id, conversation_id, status,
         progress, current_step, error, started_at, completed_at
       ) VALUES (
         @id, NULL, @workspaceId, @conversationId, @status,
         0, NULL, NULL, @startedAt, NULL
       )
       RETURNING
         id, overview_id as overviewId, workspace_id as workspaceId,
         conversation_id as conversationId, status, progress, current_step as currentStep,
         error, started_at as startedAt, completed_at as completedAt`
    )
  )

  return stmt.get({
    id,
    workspaceId,
    conversationId,
    status,
    startedAt: now,
  }) as OverviewSessionRecord
}

export const getOverviewSession = (id: string): OverviewSessionRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, overview_id as overviewId, workspace_id as workspaceId,
              conversation_id as conversationId, status, progress, current_step as currentStep,
              error, started_at as startedAt, completed_at as completedAt
       FROM overview_sessions WHERE id = ?`
    )
  )

  return (stmt.get(id) as OverviewSessionRecord | undefined) ?? null
}

export const getActiveOverviewSession = (
  workspaceId: string,
  conversationId: string
): OverviewSessionRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT id, overview_id as overviewId, workspace_id as workspaceId,
              conversation_id as conversationId, status, progress, current_step as currentStep,
              error, started_at as startedAt, completed_at as completedAt
       FROM overview_sessions
       WHERE workspace_id = ? AND conversation_id = ? AND status IN ('pending', 'processing')
       ORDER BY started_at DESC LIMIT 1`
    )
  )

  return (stmt.get(workspaceId, conversationId) as OverviewSessionRecord | undefined) ?? null
}

export const updateOverviewSession = ({
  id,
  status,
  progress,
  currentStep,
  overviewId,
  error,
}: {
  id: string
  status?: OverviewStatus
  progress?: number
  currentStep?: OverviewStep | null
  overviewId?: string | null
  error?: string | null
}): OverviewSessionRecord | null => {
  const updates: string[] = []
  const params: Record<string, unknown> = { id }

  if (status !== undefined) {
    updates.push('status = @status')
    params.status = status
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.push('completed_at = @completedAt')
      params.completedAt = TIMESTAMP()
    }
  }
  if (progress !== undefined) {
    updates.push('progress = @progress')
    params.progress = progress
  }
  if (currentStep !== undefined) {
    updates.push('current_step = @currentStep')
    params.currentStep = currentStep
  }
  if (overviewId !== undefined) {
    updates.push('overview_id = @overviewId')
    params.overviewId = overviewId
  }
  if (error !== undefined) {
    updates.push('error = @error')
    params.error = error
  }

  if (updates.length === 0) return getOverviewSession(id)

  const stmt = dbStatement((database) =>
    database.prepare(
      `UPDATE overview_sessions SET ${updates.join(', ')}
       WHERE id = @id
       RETURNING
         id, overview_id as overviewId, workspace_id as workspaceId,
         conversation_id as conversationId, status, progress, current_step as currentStep,
         error, started_at as startedAt, completed_at as completedAt`
    )
  )

  return (stmt.get(params) as OverviewSessionRecord | undefined) ?? null
}

export const deleteOverviewSession = (id: string): void => {
  const stmt = dbStatement((database) =>
    database.prepare(`DELETE FROM overview_sessions WHERE id = ?`)
  )
  stmt.run(id)
}

export type LearningsRecord = {
  id: string
  workspaceId: string
  conversationId: string
  exercises: unknown[]
  attempts: Record<string, unknown>
  modelUsed: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

export const saveLearnings = ({
  id = randomUUID(),
  workspaceId,
  conversationId,
  exercises,
  attempts,
  modelUsed,
  metadata,
}: {
  id?: string
  workspaceId: string
  conversationId: string
  exercises: unknown[]
  attempts: Record<string, unknown>
  modelUsed: string
  metadata?: unknown
}): LearningsRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO conversation_learnings (
         id, workspace_id, conversation_id, exercises, attempts,
         model_used, metadata, created_at, updated_at
       ) VALUES (
         @id, @workspaceId, @conversationId, @exercises, @attempts,
         @modelUsed, @metadata, @createdAt, @updatedAt
       )
       ON CONFLICT(workspace_id, conversation_id) DO UPDATE SET
         exercises = excluded.exercises,
         attempts = excluded.attempts,
         model_used = excluded.model_used,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at
       RETURNING
         id, workspace_id as workspaceId, conversation_id as conversationId,
         exercises, attempts, model_used as modelUsed, metadata,
         created_at as createdAt, updated_at as updatedAt`
    )
  )

  const result = stmt.get({
    id,
    workspaceId,
    conversationId,
    exercises: serialize(exercises),
    attempts: serialize(attempts),
    modelUsed,
    metadata: serialize(metadata),
    createdAt: now,
    updatedAt: now,
  }) as LearningsRecord & { exercises: string; attempts: string; metadata: string }

  return {
    ...result,
    exercises: deserialize<unknown[]>(result.exercises) ?? [],
    attempts: deserialize<Record<string, unknown>>(result.attempts) ?? {},
    metadata: deserialize(result.metadata),
  }
}

export const getLearnings = (
  workspaceId: string,
  conversationId: string
): LearningsRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT
         id, workspace_id as workspaceId, conversation_id as conversationId,
         exercises, attempts, model_used as modelUsed, metadata,
         created_at as createdAt, updated_at as updatedAt
       FROM conversation_learnings
       WHERE workspace_id = ? AND conversation_id = ?`
    )
  )

  const result = stmt.get(workspaceId, conversationId) as
    | (LearningsRecord & { exercises: string; attempts: string; metadata: string })
    | undefined

  if (!result) return null

  return {
    ...result,
    exercises: deserialize<unknown[]>(result.exercises) ?? [],
    attempts: deserialize<Record<string, unknown>>(result.attempts) ?? {},
    metadata: deserialize(result.metadata),
  }
}

export const deleteLearnings = (workspaceId: string, conversationId: string): boolean => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `DELETE FROM conversation_learnings WHERE workspace_id = ? AND conversation_id = ?`
    )
  )
  const result = stmt.run(workspaceId, conversationId)
  return result.changes > 0
}

export type ResourcesRecord = {
  id: string
  workspaceId: string
  conversationId: string
  resources: unknown[]
  topics: string[]
  modelUsed: string
  metadata: unknown
  createdAt: number
  updatedAt: number
}

export const saveResources = ({
  id = randomUUID(),
  workspaceId,
  conversationId,
  resources,
  topics,
  modelUsed,
  metadata,
}: {
  id?: string
  workspaceId: string
  conversationId: string
  resources: unknown[]
  topics: string[]
  modelUsed: string
  metadata?: unknown
}): ResourcesRecord => {
  const now = TIMESTAMP()
  const stmt = dbStatement((database) =>
    database.prepare(
      `INSERT INTO conversation_resources (
         id, workspace_id, conversation_id, resources, topics,
         model_used, metadata, created_at, updated_at
       ) VALUES (
         @id, @workspaceId, @conversationId, @resources, @topics,
         @modelUsed, @metadata, @createdAt, @updatedAt
       )
       ON CONFLICT(workspace_id, conversation_id) DO UPDATE SET
         resources = excluded.resources,
         topics = excluded.topics,
         model_used = excluded.model_used,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at
       RETURNING
         id, workspace_id as workspaceId, conversation_id as conversationId,
         resources, topics, model_used as modelUsed, metadata,
         created_at as createdAt, updated_at as updatedAt`
    )
  )

  const result = stmt.get({
    id,
    workspaceId,
    conversationId,
    resources: serialize(resources),
    topics: serialize(topics),
    modelUsed,
    metadata: serialize(metadata),
    createdAt: now,
    updatedAt: now,
  }) as ResourcesRecord & { resources: string; topics: string; metadata: string }

  return {
    ...result,
    resources: deserialize<unknown[]>(result.resources) ?? [],
    topics: deserialize<string[]>(result.topics) ?? [],
    metadata: deserialize(result.metadata),
  }
}

export const getResources = (
  workspaceId: string,
  conversationId: string
): ResourcesRecord | null => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `SELECT
         id, workspace_id as workspaceId, conversation_id as conversationId,
         resources, topics, model_used as modelUsed, metadata,
         created_at as createdAt, updated_at as updatedAt
       FROM conversation_resources
       WHERE workspace_id = ? AND conversation_id = ?`
    )
  )

  const result = stmt.get(workspaceId, conversationId) as
    | (ResourcesRecord & { resources: string; topics: string; metadata: string })
    | undefined

  if (!result) return null

  return {
    ...result,
    resources: deserialize<unknown[]>(result.resources) ?? [],
    topics: deserialize<string[]>(result.topics) ?? [],
    metadata: deserialize(result.metadata),
  }
}

export const deleteResources = (workspaceId: string, conversationId: string): boolean => {
  const stmt = dbStatement((database) =>
    database.prepare(
      `DELETE FROM conversation_resources WHERE workspace_id = ? AND conversation_id = ?`
    )
  )
  const result = stmt.run(workspaceId, conversationId)
  return result.changes > 0
}

// Parsed conversations
export const saveParsedConversation = (parsed: ParsedConversation): ParsedConversation => {
  const db = getAgentDatabase()
  const now = TIMESTAMP()

  const getExisting = db.prepare(
    `SELECT id FROM parsed_conversations WHERE workspace_id = ? AND conversation_id = ?`
  )

  const insertParsed = db.prepare(
    `INSERT INTO parsed_conversations (id, workspace_id, conversation_id, title, stats, parsed_at)
     VALUES (@id, @workspaceId, @conversationId, @title, @stats, @parsedAt)`
  )

  const updateParsed = db.prepare(
    `UPDATE parsed_conversations SET title = @title, stats = @stats, parsed_at = @parsedAt
     WHERE id = @id`
  )

  const deleteTurns = db.prepare(`DELETE FROM dialog_turns WHERE parsed_conversation_id = ?`)

  const insertTurn = db.prepare(
    `INSERT INTO dialog_turns (
       id, parsed_conversation_id, turn_index, role, content, timestamp,
       code_blocks, file_refs, error_mentions, decisions,
       importance, importance_score, token_count,
       has_substantial_code, is_key_decision, is_problem_resolution
     ) VALUES (
       @id, @parsedConversationId, @turnIndex, @role, @content, @timestamp,
       @codeBlocks, @fileRefs, @errorMentions, @decisions,
       @importance, @importanceScore, @tokenCount,
       @hasSubstantialCode, @isKeyDecision, @isProblemResolution
     )`
  )

  let usedId = parsed.id

  const tx = db.transaction(() => {
    const existing = getExisting.get(parsed.workspaceId, parsed.conversationId) as { id: string } | undefined

    if (existing) {
      usedId = existing.id
      deleteTurns.run(usedId)
      updateParsed.run({
        id: usedId,
        title: parsed.title,
        stats: serialize(parsed.stats),
        parsedAt: parsed.parsedAt ?? now,
      })
    } else {
      insertParsed.run({
        id: parsed.id,
        workspaceId: parsed.workspaceId,
        conversationId: parsed.conversationId,
        title: parsed.title,
        stats: serialize(parsed.stats),
        parsedAt: parsed.parsedAt ?? now,
      })
    }

    for (const turn of parsed.turns) {
      insertTurn.run({
        id: turn.id,
        parsedConversationId: usedId,
        turnIndex: turn.index,
        role: turn.role,
        content: turn.content,
        timestamp: turn.timestamp,
        codeBlocks: serialize(turn.codeBlocks),
        fileRefs: serialize(turn.fileRefs),
        errorMentions: serialize(turn.errorMentions),
        decisions: serialize(turn.decisions),
        importance: turn.importance,
        importanceScore: turn.importanceScore,
        tokenCount: turn.tokenCount,
        hasSubstantialCode: turn.hasSubstantialCode ? 1 : 0,
        isKeyDecision: turn.isKeyDecision ? 1 : 0,
        isProblemResolution: turn.isProblemResolution ? 1 : 0,
      })
    }
  })

  tx()
  return { ...parsed, id: usedId }
}

export const getParsedConversation = (
  workspaceId: string,
  conversationId: string
): ParsedConversation | null => {
  const db = getAgentDatabase()
  const parsedStmt = db.prepare(
    `SELECT id, workspace_id as workspaceId, conversation_id as conversationId, title, stats, parsed_at as parsedAt
     FROM parsed_conversations
     WHERE workspace_id = ? AND conversation_id = ?`
  )

  const parsedRow = parsedStmt.get(workspaceId, conversationId) as
    | { id: string; workspaceId: string; conversationId: string; title: string; stats: string; parsedAt: number }
    | undefined

  if (!parsedRow) return null

  const turnsStmt = db.prepare(
    `SELECT
       id, parsed_conversation_id as parsedConversationId, turn_index as turnIndex, role, content, timestamp,
       code_blocks as codeBlocks, file_refs as fileRefs, error_mentions as errorMentions, decisions,
       importance, importance_score as importanceScore, token_count as tokenCount,
       has_substantial_code as hasSubstantialCode, is_key_decision as isKeyDecision, is_problem_resolution as isProblemResolution
     FROM dialog_turns
     WHERE parsed_conversation_id = ?
     ORDER BY turn_index ASC`
  )

  const turnRows = turnsStmt.all(parsedRow.id) as Array<{
    id: string
    turnIndex: number
    role: DialogTurn['role']
    content: string
    timestamp: number
    codeBlocks: string | null
    fileRefs: string | null
    errorMentions: string | null
    decisions: string | null
    importance: DialogTurn['importance']
    importanceScore: number
    tokenCount: number
    hasSubstantialCode: number
    isKeyDecision: number
    isProblemResolution: number
  }>

  const turns: DialogTurn[] = turnRows.map((row) => ({
    id: row.id,
    index: row.turnIndex,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    codeBlocks: deserialize(row.codeBlocks) ?? [],
    fileRefs: deserialize(row.fileRefs) ?? [],
    errorMentions: deserialize(row.errorMentions) ?? [],
    decisions: deserialize(row.decisions) ?? [],
    importance: row.importance,
    importanceScore: row.importanceScore,
    tokenCount: row.tokenCount,
    hasSubstantialCode: !!row.hasSubstantialCode,
    isKeyDecision: !!row.isKeyDecision,
    isProblemResolution: !!row.isProblemResolution,
  }))

  return {
    id: parsedRow.id,
    workspaceId: parsedRow.workspaceId,
    conversationId: parsedRow.conversationId,
    title: parsedRow.title,
    turns,
    stats: (deserialize<ParsedConversation['stats']>(parsedRow.stats) ?? EMPTY_PARSED_STATS),
    parsedAt: parsedRow.parsedAt,
  }
}

// Overview structures
export const saveOverviewStructure = (structure: OverviewStructure): OverviewStructure => {
  const db = getAgentDatabase()
  const now = TIMESTAMP()

  const getExisting = db.prepare(
    `SELECT id FROM overview_structures WHERE workspace_id = ? AND conversation_id = ?`
  )

  const insertStructure = db.prepare(
    `INSERT INTO overview_structures (
       id, workspace_id, conversation_id, title, summary, metadata, created_at, updated_at
     ) VALUES (
       @id, @workspaceId, @conversationId, @title, @summary, @metadata, @createdAt, @updatedAt
     )`
  )

  const updateStructure = db.prepare(
    `UPDATE overview_structures SET title = @title, summary = @summary, metadata = @metadata, updated_at = @updatedAt
     WHERE id = @id`
  )

  const deleteSections = db.prepare(`DELETE FROM overview_sections WHERE structure_id = ?`)
  const deleteDiagrams = db.prepare(
    `DELETE FROM overview_diagrams WHERE section_id IN (SELECT id FROM overview_sections WHERE structure_id = ?)`
  )

  const insertSection = db.prepare(
    `INSERT INTO overview_sections (
       id, structure_id, order_index, type, title, description, content,
       code_snippets, citations, importance, relevant_turn_ids, token_count, generated_at
     ) VALUES (
       @id, @structureId, @orderIndex, @type, @title, @description, @content,
       @codeSnippets, @citations, @importance, @relevantTurnIds, @tokenCount, @generatedAt
     )`
  )

  const insertDiagram = db.prepare(
    `INSERT INTO overview_diagrams (
       id, section_id, type, mermaid_code, caption, cached_svg, created_at
     ) VALUES (
       @id, @sectionId, @type, @mermaidCode, @caption, @cachedSvg, @createdAt
     )`
  )

  let usedId = structure.id

  const tx = db.transaction(() => {
    const existing = getExisting.get(structure.workspaceId, structure.conversationId) as { id: string } | undefined

    if (existing) {
      usedId = existing.id
      deleteDiagrams.run(usedId)
      deleteSections.run(usedId)
      updateStructure.run({
        id: usedId,
        title: structure.title,
        summary: structure.summary,
        metadata: serialize(structure.metadata),
        updatedAt: now,
      })
    } else {
      insertStructure.run({
        id: structure.id,
        workspaceId: structure.workspaceId,
        conversationId: structure.conversationId,
        title: structure.title,
        summary: structure.summary,
        metadata: serialize(structure.metadata),
        createdAt: structure.createdAt ?? now,
        updatedAt: now,
      })
    }

    for (const section of structure.sections) {
      insertSection.run({
        id: section.id,
        structureId: usedId,
        orderIndex: section.order,
        type: section.type,
        title: section.title,
        description: section.description,
        content: section.content,
        codeSnippets: serialize(section.codeSnippets),
        citations: serialize(section.citations),
        importance: section.importance,
        relevantTurnIds: serialize(section.relevantTurnIds),
        tokenCount: section.tokenCount,
        generatedAt: section.generatedAt ?? now,
      })

      for (const diagram of section.diagrams) {
        insertDiagram.run({
          id: diagram.id,
          sectionId: section.id,
          type: diagram.type,
          mermaidCode: diagram.mermaidCode,
          caption: diagram.caption ?? null,
          cachedSvg: diagram.cachedSvg ?? null,
          createdAt: now,
        })
      }
    }
  })

  tx()
  return { ...structure, id: usedId }
}

export const getOverviewStructure = (
  workspaceId: string,
  conversationId: string
): OverviewStructure | null => {
  const db = getAgentDatabase()
  const structureRow = db
    .prepare(
      `SELECT id, workspace_id as workspaceId, conversation_id as conversationId,
        title, summary, metadata, created_at as createdAt, updated_at as updatedAt
       FROM overview_structures
       WHERE workspace_id = ? AND conversation_id = ?`
    )
    .get(workspaceId, conversationId) as
    | {
        id: string
        workspaceId: string
        conversationId: string
        title: string
        summary: string
        metadata: string
        createdAt: number
        updatedAt: number
      }
    | undefined

  if (!structureRow) return null

  const sectionRows = db
    .prepare(
      `SELECT
         id, structure_id as structureId, order_index as orderIndex, type, title, description,
         content, code_snippets as codeSnippets, citations, importance, relevant_turn_ids as relevantTurnIds,
         token_count as tokenCount, generated_at as generatedAt
       FROM overview_sections
       WHERE structure_id = ?
       ORDER BY order_index ASC`
    )
    .all(structureRow.id) as Array<{
    id: string
    orderIndex: number
    type: OverviewSection['type']
    title: string
    description: string | null
    content: string
    codeSnippets: string | null
    citations: string | null
    importance: OverviewSection['importance']
    relevantTurnIds: string | null
    tokenCount: number
    generatedAt: number
  }>

  const diagramsRows = db
    .prepare(
      `SELECT id, section_id as sectionId, type, mermaid_code as mermaidCode, caption, cached_svg as cachedSvg, created_at as createdAt
       FROM overview_diagrams
       WHERE section_id IN (SELECT id FROM overview_sections WHERE structure_id = ?)`
    )
    .all(structureRow.id) as Array<{
    id: string
    sectionId: string
    type: DiagramSpec['type']
    mermaidCode: string
    caption: string | null
    cachedSvg: string | null
    createdAt: number
  }>

  const diagramsBySection = diagramsRows.reduce<Record<string, DiagramSpec[]>>((acc, row) => {
    const list = acc[row.sectionId] || (acc[row.sectionId] = [])
    list.push({
      id: row.id,
      type: row.type,
      mermaidCode: row.mermaidCode,
      caption: row.caption ?? undefined,
      sectionId: row.sectionId,
      cachedSvg: row.cachedSvg ?? undefined,
    })
    return acc
  }, {})

  const sections: OverviewSection[] = sectionRows.map((row) => ({
    id: row.id,
    order: row.orderIndex,
    type: row.type,
    title: row.title,
    description: row.description ?? '',
    content: row.content,
    codeSnippets: deserialize(row.codeSnippets) ?? [],
    citations: deserialize(row.citations) ?? [],
    importance: row.importance,
    relevantTurnIds: deserialize(row.relevantTurnIds) ?? [],
    tokenCount: row.tokenCount,
    generatedAt: row.generatedAt,
    diagrams: diagramsBySection[row.id] ?? [],
  }))

  return {
    id: structureRow.id,
    workspaceId: structureRow.workspaceId,
    conversationId: structureRow.conversationId,
    title: structureRow.title,
    summary: structureRow.summary,
    sections,
    metadata:
      deserialize<OverviewStructure['metadata']>(structureRow.metadata) ?? EMPTY_OVERVIEW_METADATA,
    createdAt: structureRow.createdAt,
    updatedAt: structureRow.updatedAt,
  }
}

// Learning concepts
export const saveLearningConcepts = (
  workspaceId: string,
  conversationId: string,
  concepts: LearningConcept[]
): LearningConcept[] => {
  const db = getAgentDatabase()
  const now = TIMESTAMP()

  const deleteStmt = db.prepare(
    `DELETE FROM learning_concepts WHERE workspace_id = ? AND conversation_id = ?`
  )

  const insertStmt = db.prepare(
    `INSERT INTO learning_concepts (
       id, workspace_id, conversation_id, name, category, description,
       examples, related_turn_ids, difficulty, tags, searchable_text,
       created_at, updated_at
     ) VALUES (
       @id, @workspaceId, @conversationId, @name, @category, @description,
       @examples, @relatedTurnIds, @difficulty, @tags, @searchableText,
       @createdAt, @updatedAt
     )`
  )

  const tx = db.transaction(() => {
    deleteStmt.run(workspaceId, conversationId)
    for (const concept of concepts) {
      insertStmt.run({
        id: concept.id,
        workspaceId,
        conversationId,
        name: concept.name,
        category: concept.category,
        description: concept.description,
        examples: serialize(concept.examples),
        relatedTurnIds: serialize(concept.relatedTurnIds),
        difficulty: concept.difficulty,
        tags: serialize(concept.tags),
        searchableText: concept.searchableText,
        createdAt: concept.createdAt ?? now,
        updatedAt: now,
      })
    }
  })

  tx()
  return concepts
}

export const getLearningConcepts = (
  workspaceId: string,
  conversationId: string
): LearningConcept[] => {
  const db = getAgentDatabase()
  const rows = db
    .prepare(
      `SELECT
         id, workspace_id as workspaceId, conversation_id as conversationId,
         name, category, description, examples, related_turn_ids as relatedTurnIds,
         difficulty, tags, searchable_text as searchableText,
         created_at as createdAt, updated_at as updatedAt
       FROM learning_concepts
       WHERE workspace_id = ? AND conversation_id = ?
       ORDER BY created_at ASC`
    )
    .all(workspaceId, conversationId) as Array<{
    id: string
    name: string
    category: LearningConcept['category']
    description: string
    examples: string
    relatedTurnIds: string | null
    difficulty: LearningConcept['difficulty']
    tags: string | null
    searchableText: string
    createdAt: number
    updatedAt: number
  }>

  return rows.map((row) => ({
    id: row.id,
    workspaceId,
    conversationId,
    name: row.name,
    category: row.category,
    description: row.description,
    examples: deserialize(row.examples) ?? [],
    relatedTurnIds: deserialize(row.relatedTurnIds) ?? [],
    difficulty: row.difficulty,
    tags: deserialize(row.tags) ?? [],
    searchableText: row.searchableText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

export const hasEnhancedOverview = (
  workspaceId: string,
  conversationId: string
): boolean => {
  const db = getAgentDatabase()
  const row = db
    .prepare(
      `SELECT 1 FROM overview_structures WHERE workspace_id = ? AND conversation_id = ? LIMIT 1`
    )
    .get(workspaceId, conversationId)
  return row !== undefined
}

export const getEnhancedOverviewConversationIds = (
  workspaceId: string
): Set<string> => {
  const db = getAgentDatabase()
  const rows = db
    .prepare(
      `SELECT conversation_id FROM overview_structures WHERE workspace_id = ?`
    )
    .all(workspaceId) as Array<{ conversation_id: string }>
  return new Set(rows.map((r) => r.conversation_id))
}
