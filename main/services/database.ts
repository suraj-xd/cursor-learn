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

