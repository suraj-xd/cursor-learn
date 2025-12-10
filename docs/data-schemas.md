# Data Schemas for Enhanced Overview Generation

This document defines the TypeScript interfaces and database schemas for the enhanced overview system.

---

## 1. Ingestion Layer: DialogTurn

### TypeScript Interface

```typescript
// main/services/types/dialog-turn.ts

export type BubbleRole = 'user' | 'ai'

export type ImportanceLevel = 'high' | 'medium' | 'low'

export type CodeBlock = {
  id: string
  language: string
  code: string
  purpose?: string
  lineCount: number
  turnId: string
}

export type FileReference = {
  path: string
  action: 'created' | 'modified' | 'read' | 'deleted' | 'mentioned'
  turnId: string
}

export type ErrorMention = {
  id: string
  type: 'error' | 'warning' | 'bug' | 'fix'
  message: string
  resolution?: string
  turnId: string
}

export type Decision = {
  id: string
  description: string
  rationale?: string
  alternatives?: string[]
  turnId: string
}

export type DialogTurn = {
  id: string
  index: number
  role: BubbleRole
  content: string
  timestamp: number
  
  // Extracted artifacts
  codeBlocks: CodeBlock[]
  fileRefs: FileReference[]
  errorMentions: ErrorMention[]
  decisions: Decision[]
  
  // Computed metadata
  importance: ImportanceLevel
  importanceScore: number // 1-10
  tokenCount: number
  hasSubstantialCode: boolean
  isKeyDecision: boolean
  isProblemResolution: boolean
}

export type ParsedConversation = {
  id: string
  workspaceId: string
  conversationId: string
  title: string
  
  turns: DialogTurn[]
  
  // Aggregated stats
  stats: {
    totalTurns: number
    userTurns: number
    aiTurns: number
    totalTokens: number
    codeBlockCount: number
    fileCount: number
    errorCount: number
    decisionCount: number
    highImportanceTurns: number
  }
  
  parsedAt: number
}
```

### Parsing Implementation Outline

```typescript
// main/services/turn-parser.ts

import type { ConversationBubble } from './compact-agent'
import type { DialogTurn, ParsedConversation, CodeBlock, FileReference, ErrorMention, Decision } from './types/dialog-turn'

const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g
const FILE_PATH_REGEX = /(?:^|\s)([\/\w-]+\.[a-z]{2,4})(?:\s|$|:|\))/gi
const ERROR_PATTERNS = [
  /error:\s*(.+)/gi,
  /exception:\s*(.+)/gi,
  /failed:\s*(.+)/gi,
  /TypeError:\s*(.+)/gi,
  /ReferenceError:\s*(.+)/gi,
]
const DECISION_KEYWORDS = ['decided to', 'chose to', 'went with', 'instead of', 'because', 'the reason']
const IMPORTANCE_KEYWORDS = {
  high: ['important', 'critical', 'key', 'finally', 'solved', 'fixed', 'works now'],
  low: ['thanks', 'thank you', 'got it', 'ok', 'okay', 'sure'],
}

export function parseConversation(
  workspaceId: string,
  conversationId: string,
  title: string,
  bubbles: ConversationBubble[]
): ParsedConversation {
  const turns: DialogTurn[] = bubbles.map((bubble, index) => parseTurn(bubble, index))
  
  // Score importance after all turns are parsed
  scoreImportance(turns)
  
  return {
    id: generateId(),
    workspaceId,
    conversationId,
    title,
    turns,
    stats: computeStats(turns),
    parsedAt: Date.now(),
  }
}

function parseTurn(bubble: ConversationBubble, index: number): DialogTurn {
  const codeBlocks = extractCodeBlocks(bubble.text, index.toString())
  const fileRefs = extractFileReferences(bubble.text, index.toString())
  const errorMentions = extractErrorMentions(bubble.text, index.toString())
  const decisions = extractDecisions(bubble.text, index.toString())
  
  return {
    id: generateId(),
    index,
    role: bubble.type,
    content: bubble.text,
    timestamp: bubble.timestamp ?? Date.now(),
    codeBlocks,
    fileRefs,
    errorMentions,
    decisions,
    importance: 'medium', // Will be scored later
    importanceScore: 5,
    tokenCount: estimateTokens(bubble.text),
    hasSubstantialCode: codeBlocks.some(cb => cb.lineCount >= 5),
    isKeyDecision: decisions.length > 0,
    isProblemResolution: errorMentions.some(e => e.type === 'fix'),
  }
}

function extractCodeBlocks(text: string, turnId: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  let match
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blocks.push({
      id: generateId(),
      language: match[1] || 'text',
      code: match[2].trim(),
      lineCount: match[2].split('\n').length,
      turnId,
    })
  }
  return blocks
}

function extractFileReferences(text: string, turnId: string): FileReference[] {
  const refs: FileReference[] = []
  const seen = new Set<string>()
  let match
  while ((match = FILE_PATH_REGEX.exec(text)) !== null) {
    const path = match[1]
    if (!seen.has(path) && isValidFilePath(path)) {
      seen.add(path)
      refs.push({
        path,
        action: inferFileAction(text, path),
        turnId,
      })
    }
  }
  return refs
}

function extractErrorMentions(text: string, turnId: string): ErrorMention[] {
  const mentions: ErrorMention[] = []
  for (const pattern of ERROR_PATTERNS) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      mentions.push({
        id: generateId(),
        type: 'error',
        message: match[1].slice(0, 200),
        turnId,
      })
    }
  }
  // Check for fixes
  if (text.toLowerCase().includes('fixed') || text.toLowerCase().includes('resolved')) {
    mentions.forEach(m => m.type = 'fix')
  }
  return mentions
}

function extractDecisions(text: string, turnId: string): Decision[] {
  const decisions: Decision[] = []
  for (const keyword of DECISION_KEYWORDS) {
    if (text.toLowerCase().includes(keyword)) {
      // Extract sentence containing decision keyword
      const sentences = text.split(/[.!?]+/)
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(keyword)) {
          decisions.push({
            id: generateId(),
            description: sentence.trim().slice(0, 300),
            turnId,
          })
          break // One decision per keyword match
        }
      }
    }
  }
  return decisions
}

function scoreImportance(turns: DialogTurn[]): void {
  for (const turn of turns) {
    let score = 5 // Default medium
    
    // Boost factors
    if (turn.hasSubstantialCode) score += 2
    if (turn.isKeyDecision) score += 2
    if (turn.isProblemResolution) score += 2
    if (turn.errorMentions.length > 0) score += 1
    if (turn.fileRefs.length >= 3) score += 1
    if (IMPORTANCE_KEYWORDS.high.some(kw => turn.content.toLowerCase().includes(kw))) score += 1
    
    // Penalty factors
    if (IMPORTANCE_KEYWORDS.low.some(kw => turn.content.toLowerCase().includes(kw))) score -= 2
    if (turn.content.length < 50) score -= 1
    
    // Clamp and assign
    turn.importanceScore = Math.max(1, Math.min(10, score))
    turn.importance = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low'
  }
}
```

---

## 2. Overview Structure Schema

### TypeScript Interface

```typescript
// main/services/types/overview-structure.ts

export type SectionType = 
  | 'goal' 
  | 'context' 
  | 'implementation' 
  | 'decisions' 
  | 'problems' 
  | 'learnings' 
  | 'next_steps' 
  | 'diagram'

export type DiagramType = 
  | 'architecture' 
  | 'flowchart' 
  | 'sequence' 
  | 'component' 
  | 'state'

export type Citation = {
  turnId: string
  turnIndex: number
  excerpt?: string
}

export type DiagramSpec = {
  id: string
  type: DiagramType
  mermaidCode: string
  caption?: string
  sectionId: string
  cachedSvg?: string
}

export type OverviewSection = {
  id: string
  order: number
  type: SectionType
  title: string
  description: string // Brief description from structure pass
  
  // Generated content
  content: string // Full markdown
  codeSnippets: {
    code: string
    language: string
    purpose?: string
    turnId?: string
  }[]
  diagrams: DiagramSpec[]
  citations: Citation[]
  
  // Metadata
  importance: ImportanceLevel
  relevantTurnIds: string[]
  tokenCount: number
  generatedAt: number
}

export type OverviewStructure = {
  id: string
  workspaceId: string
  conversationId: string
  
  title: string
  summary: string
  
  sections: OverviewSection[]
  
  // Generation metadata
  metadata: {
    totalTurns: number
    processedTurns: number
    truncatedTurns: number
    tokenBudgetUsed: number
    generationTimeMs: number
    modelUsed: string
    structureVersion: number // For schema migrations
  }
  
  createdAt: number
  updatedAt: number
}
```

### SQLite Schema

```sql
-- Add to main/services/database.ts MIGRATIONS

CREATE TABLE IF NOT EXISTS overview_structures (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS overview_sections (
  id TEXT PRIMARY KEY,
  structure_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  code_snippets TEXT, -- JSON array
  citations TEXT, -- JSON array
  importance TEXT NOT NULL,
  relevant_turn_ids TEXT, -- JSON array
  token_count INTEGER DEFAULT 0,
  generated_at INTEGER NOT NULL,
  FOREIGN KEY (structure_id) REFERENCES overview_structures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS overview_diagrams (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  type TEXT NOT NULL,
  mermaid_code TEXT NOT NULL,
  caption TEXT,
  cached_svg TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (section_id) REFERENCES overview_sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_overview_structures_lookup
ON overview_structures (workspace_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_overview_sections_structure
ON overview_sections (structure_id, order_index);
```

---

## 3. Learning Concepts Schema

### TypeScript Interface

```typescript
// main/services/types/learning-concept.ts

export type ConceptCategory = 
  | 'pattern' 
  | 'technique' 
  | 'architecture' 
  | 'debugging' 
  | 'tool' 
  | 'concept'

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export type ConceptExample = {
  id: string
  code?: string
  language?: string
  explanation: string
  turnId?: string
  turnIndex?: number
}

export type LearningConcept = {
  id: string
  workspaceId: string
  conversationId: string
  
  name: string
  category: ConceptCategory
  description: string
  
  examples: ConceptExample[]
  relatedTurnIds: string[]
  
  difficulty: DifficultyLevel
  tags: string[]
  
  // For search/retrieval
  searchableText: string // Concatenated name + description + tags
  
  createdAt: number
  updatedAt: number
}

export type ConversationLearnings = {
  id: string
  workspaceId: string
  conversationId: string
  
  concepts: LearningConcept[]
  
  metadata: {
    extractedAt: number
    modelUsed: string
    conceptCount: number
  }
}
```

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS learning_concepts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  examples TEXT NOT NULL, -- JSON array
  related_turn_ids TEXT, -- JSON array
  difficulty TEXT NOT NULL,
  tags TEXT, -- JSON array
  searchable_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_concepts_conversation
ON learning_concepts (workspace_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_learning_concepts_category
ON learning_concepts (category);

CREATE INDEX IF NOT EXISTS idx_learning_concepts_search
ON learning_concepts (searchable_text);
```

---

## 4. Parsed Conversation Cache Schema

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS parsed_conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  stats TEXT NOT NULL, -- JSON
  parsed_at INTEGER NOT NULL,
  UNIQUE(workspace_id, conversation_id)
);

CREATE TABLE IF NOT EXISTS dialog_turns (
  id TEXT PRIMARY KEY,
  parsed_conversation_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  code_blocks TEXT, -- JSON array
  file_refs TEXT, -- JSON array
  error_mentions TEXT, -- JSON array
  decisions TEXT, -- JSON array
  importance TEXT NOT NULL,
  importance_score INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  has_substantial_code INTEGER DEFAULT 0,
  is_key_decision INTEGER DEFAULT 0,
  is_problem_resolution INTEGER DEFAULT 0,
  FOREIGN KEY (parsed_conversation_id) REFERENCES parsed_conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dialog_turns_conversation
ON dialog_turns (parsed_conversation_id, turn_index);

CREATE INDEX IF NOT EXISTS idx_dialog_turns_importance
ON dialog_turns (importance);
```

---

## 5. Vector Embeddings Schema (Optional)

For local retrieval layer using SQLite-based vector storage.

### SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'turn' | 'section' | 'concept'
  source_id TEXT NOT NULL,
  text_content TEXT NOT NULL, -- Original text that was embedded
  embedding BLOB NOT NULL, -- Binary float32 array
  embedding_model TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS embedding_metadata (
  workspace_id TEXT PRIMARY KEY,
  total_embeddings INTEGER DEFAULT 0,
  total_size_bytes INTEGER DEFAULT 0,
  last_cleanup_at INTEGER,
  embedding_model TEXT
);

CREATE INDEX IF NOT EXISTS idx_embeddings_workspace
ON embeddings (workspace_id, source_type);

CREATE INDEX IF NOT EXISTS idx_embeddings_source
ON embeddings (source_id);
```

### Embedding Storage Utilities

```typescript
// main/services/retrieval/vector-store.ts

export type EmbeddingRecord = {
  id: string
  workspaceId: string
  sourceType: 'turn' | 'section' | 'concept'
  sourceId: string
  textContent: string
  embedding: Float32Array
  embeddingModel: string
  tokenCount: number
  createdAt: number
}

export type StorageQuota = {
  maxTotalBytes: number // e.g., 500MB
  maxEmbeddingsPerWorkspace: number // e.g., 10000
  evictionStrategy: 'lru' | 'oldest' | 'lowest_importance'
}

export const DEFAULT_QUOTA: StorageQuota = {
  maxTotalBytes: 500 * 1024 * 1024, // 500MB
  maxEmbeddingsPerWorkspace: 10000,
  evictionStrategy: 'lru',
}

export function storeEmbedding(record: EmbeddingRecord): void {
  // Check quota before storing
  const metadata = getEmbeddingMetadata(record.workspaceId)
  if (metadata.totalSizeBytes >= DEFAULT_QUOTA.maxTotalBytes) {
    evictOldestEmbeddings(record.workspaceId, /* targetFreeBytes */ 50 * 1024 * 1024)
  }
  
  // Store embedding as BLOB
  const stmt = db.prepare(`
    INSERT INTO embeddings (id, workspace_id, source_type, source_id, text_content, embedding, embedding_model, token_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    record.id,
    record.workspaceId,
    record.sourceType,
    record.sourceId,
    record.textContent,
    Buffer.from(record.embedding.buffer),
    record.embeddingModel,
    record.tokenCount,
    record.createdAt
  )
  
  // Update metadata
  updateEmbeddingMetadata(record.workspaceId)
}

export function queryEmbeddings(
  workspaceId: string,
  queryEmbedding: Float32Array,
  topK: number = 10
): Array<{ sourceId: string; sourceType: string; score: number }> {
  // Load all embeddings for workspace (in production, use a proper vector index)
  const stmt = db.prepare(`
    SELECT id, source_type, source_id, embedding FROM embeddings WHERE workspace_id = ?
  `)
  const rows = stmt.all(workspaceId)
  
  // Compute cosine similarity
  const results = rows.map(row => {
    const embedding = new Float32Array(row.embedding.buffer)
    const score = cosineSimilarity(queryEmbedding, embedding)
    return { sourceId: row.source_id, sourceType: row.source_type, score }
  })
  
  // Sort by score and return top K
  return results.sort((a, b) => b.score - a.score).slice(0, topK)
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

---

## 6. Export Schemas

### Markdown Export

```typescript
export type MarkdownExport = {
  title: string
  content: string // Full markdown document
  frontmatter: {
    title: string
    conversationId: string
    generatedAt: string
    modelUsed: string
    sectionCount: number
    conceptCount: number
  }
}
```

### JSON Export

```typescript
export type JsonExport = {
  version: '1.0'
  exportedAt: string
  conversation: {
    id: string
    title: string
    workspaceId: string
  }
  overview: OverviewStructure
  learnings: LearningConcept[]
  diagrams: DiagramSpec[]
}
```

---

## Migration Notes

1. **Backward Compatibility**: Existing `conversation_overviews` table remains; new system writes to `overview_structures`
2. **Feature Flag**: Use config to toggle between old and new overview generation
3. **On-Demand Migration**: When user views old overview, offer to regenerate with new system
4. **Storage Cleanup**: Add scheduled task to prune old embeddings based on quota
