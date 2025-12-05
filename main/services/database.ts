import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import type { Database as BetterSqliteDatabase } from 'better-sqlite3'
import { app } from 'electron'

let db: BetterSqliteDatabase | null = null

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS api_keys (
  provider TEXT PRIMARY KEY,
  label TEXT,
  secret TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  summary TEXT,
  workspace_conversation_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  token_usage INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at
ON messages (chat_id, created_at);

CREATE TABLE IF NOT EXISTS chat_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  mentioned_chat_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(chat_id, mentioned_chat_id),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (mentioned_chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_summaries (
  chat_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  covered_message_count INTEGER NOT NULL,
  covered_until INTEGER NOT NULL,
  token_estimate INTEGER NOT NULL,
  strategy TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compacted_chats (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  conversation_title TEXT,
  compacted_content TEXT NOT NULL,
  structured_data TEXT,
  original_token_count INTEGER,
  compacted_token_count INTEGER,
  compression_ratio REAL,
  model_used TEXT NOT NULL,
  strategy_used TEXT NOT NULL,
  chunk_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'completed',
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS compact_sessions (
  id TEXT PRIMARY KEY,
  compacted_chat_id TEXT,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  chunks_total INTEGER DEFAULT 0,
  chunks_processed INTEGER DEFAULT 0,
  logs TEXT,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (compacted_chat_id) REFERENCES compacted_chats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compacted_chats_lookup
ON compacted_chats (workspace_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_compact_sessions_status
ON compact_sessions (status);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_estimate REAL DEFAULT 0,
  chat_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_records_created_at
ON usage_records (created_at);

CREATE INDEX IF NOT EXISTS idx_usage_records_provider
ON usage_records (provider, created_at);

CREATE INDEX IF NOT EXISTS idx_usage_records_feature
ON usage_records (feature, created_at);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  labels TEXT,
  is_pinned INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS snippets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  title TEXT,
  labels TEXT,
  source_context TEXT,
  is_pinned INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language);
CREATE INDEX IF NOT EXISTS idx_snippets_updated ON snippets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_snippets_pinned ON snippets(is_pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_overviews (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  topics TEXT NOT NULL,
  agendas TEXT NOT NULL,
  key_insights TEXT NOT NULL,
  model_used TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_overviews_lookup
ON conversation_overviews (workspace_id, conversation_id);

CREATE TABLE IF NOT EXISTS overview_sessions (
  id TEXT PRIMARY KEY,
  overview_id TEXT,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (overview_id) REFERENCES conversation_overviews(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_overview_sessions_status
ON overview_sessions (status);

CREATE TABLE IF NOT EXISTS todos (
  date TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_updated ON todos(updated_at DESC);
`

export function initAgentDatabase(dbFileName = 'agents.db'): BetterSqliteDatabase {
  if (db) {
    return db
  }

  const baseDir = app.getPath('userData')
  const dbDir = path.join(baseDir, 'storage')

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = path.join(dbDir, dbFileName)
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(MIGRATIONS)

  return db
}

export function getAgentDatabase(): BetterSqliteDatabase {
  if (!db) {
    throw new Error('Agent database has not been initialized. Call initAgentDatabase() first.')
  }

  return db
}

export function closeAgentDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

