# Storage Policy and Retrieval Layer Design

This document covers local storage constraints, vector store options, eviction policies, and performance budgets for Cursor Learn.

---

## Current Storage Analysis

### Existing Storage
- **Location**: `app.getPath('userData')/storage/agents.db`
- **Format**: SQLite with WAL mode
- **Current Tables**: ~15 tables for chats, messages, compacted content, overviews, learnings, resources
- **Typical Size**: 10-50MB for moderate usage

### App Bundle Impact
- **Current Bundle**: ~300MB
- **Constraint**: No additional native dependencies that significantly increase bundle size
- **Target**: Keep storage layer additions under 5MB of additional bundle size

---

## Vector Store Options Analysis

### Option 1: SQLite-Based Vector Storage (Recommended)

**Implementation**: Store embeddings as BLOBs in SQLite, compute similarity in JavaScript.

**Pros**:
- No new dependencies
- Uses existing SQLite infrastructure
- Full control over storage and eviction
- Works offline with no external services

**Cons**:
- O(n) similarity search (acceptable for <50K embeddings)
- Must implement cosine similarity in JS

**Bundle Impact**: 0 (uses existing `better-sqlite3`)

**Performance**:
- 10K embeddings @ 1536 dims: ~60MB storage
- Query time: <100ms for 10K embeddings

```typescript
// Embedding storage in SQLite
const embeddingSize = dimensions * 4 // float32 = 4 bytes
// text-embedding-3-small: 1536 dims = 6KB per embedding
// 10,000 embeddings = 60MB
```

### Option 2: sqlite-vss (SQLite Vector Search Extension)

**Pros**:
- True vector indexing with FAISS under the hood
- Fast approximate nearest neighbor search
- SQLite native

**Cons**:
- Native dependency increases bundle size (~15-20MB)
- May have compatibility issues across platforms
- Less control over internals

**Bundle Impact**: ~20MB

**Not Recommended** due to bundle size concern.

### Option 3: In-Memory with Persistence

**Pros**:
- Fastest queries
- Simple implementation

**Cons**:
- Memory pressure on large datasets
- Requires loading all embeddings on startup
- May cause slowdowns with 50K+ embeddings

**Recommendation**: Use SQLite-based storage with lazy loading.

---

## Recommended Architecture

### Storage Strategy

```
SQLite Database (agents.db)
├── embeddings table (BLOB storage)
├── embedding_metadata table (quotas, stats)
└── embedding_cache table (frequently accessed)

On Query:
1. Check embedding_cache for recent queries
2. Load relevant embeddings from disk
3. Compute similarity in batches
4. Return top-K results
```

### Embedding Model Selection

| Model | Dimensions | Cost per 1K tokens | Notes |
|-------|-----------|-------------------|-------|
| text-embedding-3-small | 1536 | $0.00002 | Recommended for balance |
| text-embedding-3-large | 3072 | $0.00013 | Higher quality, more storage |
| text-embedding-ada-002 | 1536 | $0.0001 | Legacy, still works |

**Recommendation**: Use `text-embedding-3-small` for optimal cost/quality/size balance.

### Storage Size Calculations

```
Per embedding:
- Dimensions: 1536
- Size: 1536 * 4 bytes = 6,144 bytes ≈ 6KB

Typical workspace (100 conversations, 50 turns each = 5,000 turns):
- If we embed every turn: 5,000 * 6KB = 30MB
- If we embed summaries only: 500 * 6KB = 3MB

Target: Support up to 50,000 embeddings = 300MB max
```

---

## Storage Quotas and Limits

### Global Limits

```typescript
export const STORAGE_LIMITS = {
  // Embedding storage
  maxEmbeddingStorageBytes: 500 * 1024 * 1024, // 500MB total
  maxEmbeddingsPerWorkspace: 20_000,
  embeddingDimensions: 1536,
  
  // Overview storage
  maxOverviewContentBytes: 100 * 1024, // 100KB per overview
  maxSectionsPerOverview: 12,
  maxDiagramsPerSection: 3,
  
  // Cache
  maxCachedDiagramSvgs: 100,
  maxCachedDiagramSizeBytes: 50 * 1024, // 50KB per SVG
  
  // Token budgets
  maxTokensPerStructurePass: 10_000,
  maxTokensPerSectionPass: 10_000,
  maxTokensPerDiagramPass: 3_000,
}
```

### Per-Workspace Limits

```typescript
export const WORKSPACE_LIMITS = {
  maxEmbeddings: 10_000,
  maxOverviews: 500,
  maxLearningConcepts: 2_000,
  maxStorageBytes: 100 * 1024 * 1024, // 100MB per workspace
}
```

---

## Eviction Policies

### LRU-Based Eviction (Primary)

```typescript
type EvictionConfig = {
  strategy: 'lru' | 'importance' | 'age'
  triggerThreshold: number // % of max storage
  targetFreeSpace: number  // % to free when triggered
  minAgeBeforeEviction: number // ms, don't evict recent items
}

const DEFAULT_EVICTION: EvictionConfig = {
  strategy: 'lru',
  triggerThreshold: 0.9, // Trigger at 90% capacity
  targetFreeSpace: 0.2,  // Free 20% of space
  minAgeBeforeEviction: 7 * 24 * 60 * 60 * 1000, // 7 days
}
```

### Eviction Algorithm

```typescript
async function evictEmbeddings(workspaceId: string, targetFreeBytes: number): Promise<number> {
  // 1. Get embeddings sorted by last access time
  const embeddings = await db.prepare(`
    SELECT id, created_at, last_accessed_at, 
           LENGTH(embedding) as size_bytes
    FROM embeddings
    WHERE workspace_id = ?
    AND created_at < ?
    ORDER BY COALESCE(last_accessed_at, created_at) ASC
  `).all(workspaceId, Date.now() - DEFAULT_EVICTION.minAgeBeforeEviction)
  
  // 2. Delete until we've freed enough space
  let freedBytes = 0
  const toDelete: string[] = []
  
  for (const emb of embeddings) {
    if (freedBytes >= targetFreeBytes) break
    toDelete.push(emb.id)
    freedBytes += emb.size_bytes
  }
  
  // 3. Batch delete
  if (toDelete.length > 0) {
    await db.prepare(`
      DELETE FROM embeddings WHERE id IN (${toDelete.map(() => '?').join(',')})
    `).run(...toDelete)
  }
  
  return freedBytes
}
```

### Importance-Weighted Eviction (Alternative)

For smarter eviction that preserves high-value embeddings:

```typescript
function getEvictionPriority(embedding: EmbeddingRecord): number {
  let priority = 0
  
  // Lower priority = evict first
  
  // Age factor (older = lower priority)
  const ageHours = (Date.now() - embedding.createdAt) / (1000 * 60 * 60)
  priority -= ageHours * 0.1
  
  // Source importance
  if (embedding.sourceType === 'section') priority += 50
  if (embedding.sourceType === 'concept') priority += 100
  if (embedding.sourceType === 'turn') priority += 10
  
  // Access recency
  if (embedding.lastAccessedAt) {
    const accessAgeHours = (Date.now() - embedding.lastAccessedAt) / (1000 * 60 * 60)
    priority += Math.max(0, 100 - accessAgeHours)
  }
  
  return priority
}
```

---

## Token Budget Strategy

### Overview Generation Pipeline

```
Total Budget Per Overview: ~40,000 tokens input, ~15,000 tokens output

Phase 1: Structure Pass
├── Input: Truncated conversation (8,000 tokens max)
├── Output: XML structure (2,000 tokens max)
└── Cost: ~$0.003

Phase 2: Section Content (per section, avg 5 sections)
├── Input: Relevant turns + context (6,000 tokens per section)
├── Output: Section markdown (4,000 tokens per section)
└── Cost: ~$0.01 total

Phase 3: Diagrams (optional, 2 diagrams avg)
├── Input: Section context (2,000 tokens per diagram)
├── Output: Mermaid code (1,000 tokens per diagram)
└── Cost: ~$0.002

Total Estimated Cost: ~$0.015 per overview
```

### Truncation Strategy for Long Conversations

```typescript
type TruncationConfig = {
  maxInputTokens: number
  preserveFirst: number  // Always keep first N turns
  preserveLast: number   // Always keep last N turns
  preserveHighImportance: boolean
  summarizeLowImportance: boolean
}

const DEFAULT_TRUNCATION: TruncationConfig = {
  maxInputTokens: 8000,
  preserveFirst: 3,
  preserveLast: 5,
  preserveHighImportance: true,
  summarizeLowImportance: true,
}

function truncateConversation(
  turns: DialogTurn[],
  config: TruncationConfig
): { turns: DialogTurn[], truncatedCount: number, summarized: string[] } {
  const totalTokens = turns.reduce((sum, t) => sum + t.tokenCount, 0)
  
  if (totalTokens <= config.maxInputTokens) {
    return { turns, truncatedCount: 0, summarized: [] }
  }
  
  // 1. Always keep first and last
  const kept = new Set<number>()
  for (let i = 0; i < config.preserveFirst; i++) kept.add(i)
  for (let i = turns.length - config.preserveLast; i < turns.length; i++) kept.add(i)
  
  // 2. Keep high importance turns
  if (config.preserveHighImportance) {
    turns.forEach((t, i) => {
      if (t.importance === 'high') kept.add(i)
    })
  }
  
  // 3. Fill remaining budget with medium importance
  let budgetUsed = [...kept].reduce((sum, i) => sum + turns[i].tokenCount, 0)
  const remaining = turns
    .map((t, i) => ({ turn: t, index: i }))
    .filter(({ index }) => !kept.has(index))
    .sort((a, b) => b.turn.importanceScore - a.turn.importanceScore)
  
  for (const { turn, index } of remaining) {
    if (budgetUsed + turn.tokenCount <= config.maxInputTokens) {
      kept.add(index)
      budgetUsed += turn.tokenCount
    }
  }
  
  // 4. Build result
  const keptTurns = turns.filter((_, i) => kept.has(i))
  const truncatedCount = turns.length - keptTurns.length
  
  // 5. Optionally summarize dropped sections
  const summarized: string[] = []
  if (config.summarizeLowImportance && truncatedCount > 0) {
    // Group consecutive dropped turns and summarize
    let start = -1
    for (let i = 0; i <= turns.length; i++) {
      if (!kept.has(i) && start === -1) {
        start = i
      } else if ((kept.has(i) || i === turns.length) && start !== -1) {
        const count = i - start
        summarized.push(`[${count} turns summarized: general discussion]`)
        start = -1
      }
    }
  }
  
  return { turns: keptTurns, truncatedCount, summarized }
}
```

---

## Backpressure and Rate Limiting

### Concurrent Generation Limits

```typescript
const CONCURRENCY_LIMITS = {
  maxParallelSectionGenerations: 3,
  maxParallelDiagramGenerations: 2,
  maxParallelEmbeddings: 5,
  
  // API rate limiting
  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 100_000,
  
  // Queue limits
  maxQueuedGenerations: 10,
}
```

### Semaphore Implementation

```typescript
class Semaphore {
  private permits: number
  private queue: Array<() => void> = []
  
  constructor(permits: number) {
    this.permits = permits
  }
  
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve)
    })
  }
  
  release(): void {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.permits++
    }
  }
}

// Usage
const sectionSemaphore = new Semaphore(CONCURRENCY_LIMITS.maxParallelSectionGenerations)

async function generateSectionsWithBackpressure(
  sections: OverviewSection[],
  context: GenerationContext
): Promise<OverviewSection[]> {
  return Promise.all(
    sections.map(async (section) => {
      await sectionSemaphore.acquire()
      try {
        return await generateSectionContent(section, context)
      } finally {
        sectionSemaphore.release()
      }
    })
  )
}
```

### Token Rate Limiter

```typescript
class TokenRateLimiter {
  private tokensUsed: number[] = [] // timestamps of token usage
  private readonly windowMs = 60_000 // 1 minute
  
  constructor(private maxTokensPerMinute: number) {}
  
  async waitForCapacity(tokens: number): Promise<void> {
    while (true) {
      this.pruneOldUsage()
      const currentUsage = this.tokensUsed.length
      
      if (currentUsage + tokens <= this.maxTokensPerMinute) {
        // Record usage
        for (let i = 0; i < tokens; i++) {
          this.tokensUsed.push(Date.now())
        }
        return
      }
      
      // Wait for oldest tokens to expire
      const waitTime = this.tokensUsed[0] + this.windowMs - Date.now() + 100
      await sleep(Math.max(waitTime, 1000))
    }
  }
  
  private pruneOldUsage(): void {
    const cutoff = Date.now() - this.windowMs
    this.tokensUsed = this.tokensUsed.filter(t => t > cutoff)
  }
}
```

---

## Storage Monitoring

### Health Check Queries

```typescript
async function getStorageHealth(): Promise<StorageHealth> {
  const embeddingStats = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      SUM(LENGTH(embedding)) as total_bytes,
      AVG(LENGTH(embedding)) as avg_bytes
    FROM embeddings
  `).get()
  
  const overviewStats = await db.prepare(`
    SELECT 
      COUNT(*) as count,
      SUM(LENGTH(content)) as total_bytes
    FROM overview_sections
  `).get()
  
  const dbFileSize = fs.statSync(dbPath).size
  
  return {
    totalDbSizeBytes: dbFileSize,
    embeddingCount: embeddingStats.count,
    embeddingStorageBytes: embeddingStats.total_bytes,
    overviewCount: overviewStats.count,
    overviewStorageBytes: overviewStats.total_bytes,
    quotaUsedPercent: embeddingStats.total_bytes / STORAGE_LIMITS.maxEmbeddingStorageBytes * 100,
    needsCleanup: embeddingStats.total_bytes > STORAGE_LIMITS.maxEmbeddingStorageBytes * 0.9,
  }
}
```

### Scheduled Cleanup

```typescript
function scheduleStorageCleanup(): void {
  // Run daily
  setInterval(async () => {
    const health = await getStorageHealth()
    
    if (health.needsCleanup) {
      console.log('Storage cleanup triggered, freeing 20% space')
      await evictEmbeddings('*', STORAGE_LIMITS.maxEmbeddingStorageBytes * 0.2)
    }
    
    // Also cleanup orphaned data
    await cleanupOrphanedDiagrams()
    await cleanupOrphanedEmbeddings()
  }, 24 * 60 * 60 * 1000)
}
```

---

## Summary

| Component | Storage Type | Max Size | Eviction |
|-----------|-------------|----------|----------|
| Embeddings | SQLite BLOB | 500MB total | LRU, 7-day min age |
| Overviews | SQLite JSON | 100KB each | Manual delete |
| Diagrams (cached SVG) | SQLite TEXT | 50KB each | LRU, 100 max |
| Learning Concepts | SQLite JSON | No limit | Manual delete |

**Key Decisions**:
1. Use SQLite BLOB storage for embeddings (no new dependencies)
2. Implement custom cosine similarity in JavaScript
3. LRU eviction with importance weighting
4. Aggressive truncation for token budgets
5. Semaphore-based backpressure for parallel operations
