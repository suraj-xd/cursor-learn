# Resilience Patterns for Robust Overview Generation

This document covers error handling, retry strategies, token limit management, and persistence guarantees inspired by DeepWiki's production patterns.

---

## Design Philosophy

**The Promise**: When a user requests an overview, we deliver—even if it takes multiple attempts, fallback strategies, or degraded quality.

**Key Principles**:
1. **Never fail silently** - Always inform user of issues
2. **Degrade gracefully** - Partial results > no results
3. **Persist progress** - Resume interrupted generations
4. **Budget defensively** - Assume tokens will overflow

---

## Retry Strategy with Exponential Backoff

### Implementation

```typescript
// main/services/utils/retry.ts

import { sleep } from './sleep'

export type RetryConfig = {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'rate_limit',
    'timeout',
    'connection_error',
    'server_error',
    '429',
    '500',
    '502',
    '503',
    '504',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
  ],
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | null = null
  let delay = cfg.initialDelayMs
  
  for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if error is retryable
      const isRetryable = cfg.retryableErrors.some(pattern => 
        lastError!.message.toLowerCase().includes(pattern.toLowerCase()) ||
        lastError!.name.toLowerCase().includes(pattern.toLowerCase())
      )
      
      if (!isRetryable || attempt > cfg.maxRetries) {
        throw lastError
      }
      
      // Calculate delay with jitter
      const jitter = Math.random() * 0.3 * delay
      const actualDelay = Math.min(delay + jitter, cfg.maxDelayMs)
      
      onRetry?.(attempt, lastError, actualDelay)
      
      await sleep(actualDelay)
      delay *= cfg.backoffMultiplier
    }
  }
  
  throw lastError
}
```

### Usage in Generation

```typescript
// main/services/enhanced-overview-agent.ts

async function generateStructureWithRetry(
  turns: DialogTurn[],
  title: string,
  onProgress: ProgressCallback
): Promise<OverviewStructureSkeleton> {
  return withRetry(
    () => generateStructure(turns, title),
    {
      maxRetries: 3,
      initialDelayMs: 2000,
    },
    (attempt, error, delay) => {
      onProgress({
        phase: 'structure',
        progress: 15,
        currentStep: `Retry ${attempt}/3 after error: ${error.message.slice(0, 50)}...`,
      })
      console.warn(`Structure generation retry ${attempt}: ${error.message}`)
    }
  )
}
```

---

## Token Limit Detection and Fallback

### Error Detection Patterns

```typescript
// main/services/utils/token-errors.ts

const TOKEN_LIMIT_PATTERNS = [
  'maximum context length',
  'token limit',
  'too many tokens',
  'context_length_exceeded',
  'max_tokens',
  'input too long',
  'request too large',
  'payload too large',
  'content too long',
]

const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'rate_limit_exceeded',
  'too many requests',
  '429',
  'quota exceeded',
  'requests per minute',
  'tokens per minute',
]

export function isTokenLimitError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return TOKEN_LIMIT_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()))
}

export function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return RATE_LIMIT_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()))
}

export function getRetryDelay(error: Error): number {
  // Try to extract retry-after from error
  const match = error.message.match(/retry.?after[:\s]*(\d+)/i)
  if (match) {
    return parseInt(match[1], 10) * 1000
  }
  
  // Default delays
  if (isRateLimitError(error)) return 60000 // 1 minute
  if (isTokenLimitError(error)) return 0 // Immediate retry with reduced input
  return 2000 // Default
}
```

### Fallback Strategy

```typescript
// main/services/enhanced-overview-agent.ts

async function generateWithFallback(
  conversation: ParsedConversation,
  options: GenerationOptions,
  onProgress: ProgressCallback
): Promise<OverviewStructure> {
  const strategies = [
    { name: 'full', tokenBudget: 10000, includeDiagrams: true },
    { name: 'reduced', tokenBudget: 6000, includeDiagrams: true },
    { name: 'minimal', tokenBudget: 4000, includeDiagrams: false },
    { name: 'emergency', tokenBudget: 2000, includeDiagrams: false },
  ]
  
  let lastError: Error | null = null
  
  for (const strategy of strategies) {
    try {
      onProgress({
        phase: 'structure',
        progress: 10,
        currentStep: strategy.name === 'full' 
          ? 'Generating structure...'
          : `Retrying with ${strategy.name} strategy...`,
      })
      
      const truncated = truncateForBudget(conversation.turns, strategy.tokenBudget)
      
      const skeleton = await generateStructure(truncated.turns, conversation.title)
      
      const sections = await generateAllSections(
        skeleton,
        truncated.turns,
        { ...options, generateDiagrams: strategy.includeDiagrams },
        onProgress
      )
      
      return assembleOverview(conversation, skeleton, sections, {
        strategy: strategy.name,
        truncatedTurns: truncated.truncatedCount,
      })
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (isTokenLimitError(lastError)) {
        console.warn(`Token limit hit with ${strategy.name} strategy, trying next...`)
        continue
      }
      
      if (isRateLimitError(lastError)) {
        const delay = getRetryDelay(lastError)
        onProgress({
          phase: 'structure',
          progress: 10,
          currentStep: `Rate limited. Waiting ${Math.round(delay/1000)}s...`,
        })
        await sleep(delay)
        continue
      }
      
      // Non-recoverable error
      throw lastError
    }
  }
  
  throw new OverviewGenerationError(
    `Failed after all fallback strategies: ${lastError?.message}`,
    'fallback',
    false,
    lastError!
  )
}
```

---

## Session Persistence and Recovery

### Generation Session Schema

```sql
-- Add to database.ts MIGRATIONS

CREATE TABLE IF NOT EXISTS generation_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  
  -- Progress tracking
  status TEXT NOT NULL, -- 'pending' | 'structure' | 'sections' | 'diagrams' | 'complete' | 'failed'
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  
  -- Partial results (JSON)
  structure_skeleton TEXT,
  completed_sections TEXT, -- JSON array of section IDs
  section_contents TEXT,   -- JSON map of sectionId -> content
  
  -- Error tracking
  last_error TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  
  UNIQUE(workspace_id, conversation_id)
);
```

### Session Management

```typescript
// main/services/generation-session.ts

export type GenerationSessionStatus = 
  | 'pending'
  | 'structure'
  | 'sections'
  | 'diagrams'
  | 'complete'
  | 'failed'

export type GenerationSession = {
  id: string
  workspaceId: string
  conversationId: string
  status: GenerationSessionStatus
  progress: number
  currentStep: string | null
  
  // Partial results
  structureSkeleton: OverviewStructureSkeleton | null
  completedSections: string[]
  sectionContents: Record<string, OverviewSection>
  
  // Error state
  lastError: string | null
  retryCount: number
  
  startedAt: number
  updatedAt: number
  completedAt: number | null
}

export function saveSession(session: Partial<GenerationSession> & { id: string }): void {
  const stmt = db.prepare(`
    INSERT INTO generation_sessions (
      id, workspace_id, conversation_id, status, progress, current_step,
      structure_skeleton, completed_sections, section_contents,
      last_error, retry_count, started_at, updated_at, completed_at
    ) VALUES (
      @id, @workspaceId, @conversationId, @status, @progress, @currentStep,
      @structureSkeleton, @completedSections, @sectionContents,
      @lastError, @retryCount, @startedAt, @updatedAt, @completedAt
    )
    ON CONFLICT(workspace_id, conversation_id) DO UPDATE SET
      status = excluded.status,
      progress = excluded.progress,
      current_step = excluded.current_step,
      structure_skeleton = COALESCE(excluded.structure_skeleton, structure_skeleton),
      completed_sections = excluded.completed_sections,
      section_contents = excluded.section_contents,
      last_error = excluded.last_error,
      retry_count = excluded.retry_count,
      updated_at = excluded.updated_at,
      completed_at = excluded.completed_at
  `)
  
  stmt.run({
    id: session.id,
    workspaceId: session.workspaceId,
    conversationId: session.conversationId,
    status: session.status ?? 'pending',
    progress: session.progress ?? 0,
    currentStep: session.currentStep ?? null,
    structureSkeleton: session.structureSkeleton ? JSON.stringify(session.structureSkeleton) : null,
    completedSections: JSON.stringify(session.completedSections ?? []),
    sectionContents: JSON.stringify(session.sectionContents ?? {}),
    lastError: session.lastError ?? null,
    retryCount: session.retryCount ?? 0,
    startedAt: session.startedAt ?? Date.now(),
    updatedAt: Date.now(),
    completedAt: session.completedAt ?? null,
  })
}

export function getActiveSession(
  workspaceId: string,
  conversationId: string
): GenerationSession | null {
  const stmt = db.prepare(`
    SELECT * FROM generation_sessions
    WHERE workspace_id = ? AND conversation_id = ?
    AND status NOT IN ('complete', 'failed')
    ORDER BY started_at DESC LIMIT 1
  `)
  
  const row = stmt.get(workspaceId, conversationId)
  if (!row) return null
  
  return deserializeSession(row)
}

export function canResumeSession(session: GenerationSession): boolean {
  // Can resume if:
  // 1. Not already complete or failed
  // 2. Has partial results to continue from
  // 3. Less than max retries
  return (
    session.status !== 'complete' &&
    session.status !== 'failed' &&
    session.retryCount < 5 &&
    (session.structureSkeleton !== null || session.completedSections.length > 0)
  )
}
```

### Resumable Generation

```typescript
// main/services/enhanced-overview-agent.ts

export async function generateEnhancedOverview(
  conversation: ConversationInput,
  options: GenerationOptions = {},
  onProgress?: ProgressCallback
): Promise<OverviewStructure> {
  // Check for resumable session
  const existingSession = getActiveSession(conversation.workspaceId, conversation.conversationId)
  
  if (existingSession && canResumeSession(existingSession)) {
    console.log(`Resuming generation from ${existingSession.status} phase`)
    return resumeGeneration(existingSession, conversation, options, onProgress)
  }
  
  // Start fresh
  const session = createSession(conversation.workspaceId, conversation.conversationId)
  
  try {
    return await executeGeneration(session, conversation, options, onProgress)
  } catch (error) {
    // Save failure state for potential retry
    saveSession({
      id: session.id,
      status: 'failed',
      lastError: error instanceof Error ? error.message : String(error),
      retryCount: session.retryCount + 1,
    })
    throw error
  }
}

async function resumeGeneration(
  session: GenerationSession,
  conversation: ConversationInput,
  options: GenerationOptions,
  onProgress?: ProgressCallback
): Promise<OverviewStructure> {
  const parsed = await parseConversation(
    conversation.workspaceId,
    conversation.conversationId,
    conversation.title,
    conversation.bubbles
  )
  
  // Resume from where we left off
  switch (session.status) {
    case 'pending':
    case 'structure':
      // Need to regenerate structure
      return executeGeneration(session, conversation, options, onProgress)
      
    case 'sections':
      // Have structure, resume section generation
      if (!session.structureSkeleton) {
        return executeGeneration(session, conversation, options, onProgress)
      }
      
      const remainingSections = session.structureSkeleton.sections
        .filter(s => !session.completedSections.includes(s.id))
      
      onProgress?.({
        phase: 'sections',
        progress: Math.round((session.completedSections.length / session.structureSkeleton.sections.length) * 50) + 25,
        currentStep: `Resuming: ${session.completedSections.length}/${session.structureSkeleton.sections.length} sections complete`,
        sectionsCompleted: session.completedSections.length,
        sectionsTotal: session.structureSkeleton.sections.length,
      })
      
      const newSections = await generateSectionsParallel(
        remainingSections,
        parsed.turns,
        options,
        (completed) => {
          saveSession({
            id: session.id,
            completedSections: [...session.completedSections, ...completed.map(s => s.id)],
            sectionContents: {
              ...session.sectionContents,
              ...Object.fromEntries(completed.map(s => [s.id, s])),
            },
          })
        }
      )
      
      const allSections = [
        ...Object.values(session.sectionContents),
        ...newSections,
      ]
      
      // Continue to diagrams if needed
      return finishGeneration(session, parsed, session.structureSkeleton, allSections, options, onProgress)
      
    case 'diagrams':
      // Have sections, just need diagrams
      return finishGeneration(
        session,
        parsed,
        session.structureSkeleton!,
        Object.values(session.sectionContents),
        options,
        onProgress
      )
      
    default:
      return executeGeneration(session, conversation, options, onProgress)
  }
}
```

---

## Citation Format (DeepWiki Style)

### Prompt Instruction

```markdown
**Source Citations (REQUIRED):**

For EVERY piece of significant information, you MUST cite the specific source:

Format: `[Turn N]` or `[Turn N-M]` for a range

Examples:
- "The user implemented debouncing for the search input [Turn 12]"
- "After several attempts, the pagination was fixed [Turn 15-18]"
- "The final solution used React Query for caching [Turn 23]"

For code snippets, cite the turn that contains the original code:
```typescript
// From [Turn 14]
const debouncedSearch = useMemo(() => debounce(search, 300), [])
```
```

### Citation Extraction

```typescript
// main/services/utils/citations.ts

export type Citation = {
  turnId: string
  turnIndex: number
  rangeStart?: number
  rangeEnd?: number
  context?: string
}

const CITATION_PATTERN = /\[Turn\s+(\d+)(?:\s*-\s*(\d+))?\]/gi

export function extractCitations(content: string): Citation[] {
  const citations: Citation[] = []
  let match
  
  while ((match = CITATION_PATTERN.exec(content)) !== null) {
    const startTurn = parseInt(match[1], 10)
    const endTurn = match[2] ? parseInt(match[2], 10) : undefined
    
    citations.push({
      turnId: `turn-${startTurn}`,
      turnIndex: startTurn,
      rangeStart: startTurn,
      rangeEnd: endTurn,
    })
  }
  
  return citations
}

export function validateCitations(
  content: string,
  turns: DialogTurn[]
): { valid: Citation[], invalid: Citation[], missing: string[] } {
  const citations = extractCitations(content)
  const maxTurnIndex = turns.length
  
  const valid: Citation[] = []
  const invalid: Citation[] = []
  
  for (const citation of citations) {
    if (citation.turnIndex > 0 && citation.turnIndex <= maxTurnIndex) {
      if (citation.rangeEnd && citation.rangeEnd > maxTurnIndex) {
        invalid.push(citation)
      } else {
        valid.push(citation)
      }
    } else {
      invalid.push(citation)
    }
  }
  
  // Check for missing citations (content that should have citations but doesn't)
  const missing: string[] = []
  const sentences = content.split(/[.!?]+/)
  
  for (const sentence of sentences) {
    const hasDecisionLanguage = /decided|chose|implemented|fixed|solved|used|added/i.test(sentence)
    const hasCitation = CITATION_PATTERN.test(sentence)
    
    if (hasDecisionLanguage && !hasCitation && sentence.trim().length > 20) {
      missing.push(sentence.trim().slice(0, 100))
    }
  }
  
  return { valid, invalid, missing }
}
```

---

## Provider-Specific Error Handling

### Error Handler Registry

```typescript
// main/services/ai/error-handlers.ts

export type ProviderErrorHandler = {
  isRetryable: (error: Error) => boolean
  getRetryDelay: (error: Error) => number
  formatUserMessage: (error: Error) => string
}

const handlers: Record<string, ProviderErrorHandler> = {
  openai: {
    isRetryable: (error) => {
      const msg = error.message.toLowerCase()
      return msg.includes('rate limit') ||
             msg.includes('timeout') ||
             msg.includes('server error') ||
             msg.includes('503') ||
             msg.includes('529')
    },
    getRetryDelay: (error) => {
      if (error.message.includes('rate limit')) return 60000
      return 2000
    },
    formatUserMessage: (error) => {
      if (error.message.includes('rate limit')) {
        return 'OpenAI rate limit reached. Waiting before retry...'
      }
      if (error.message.includes('context length')) {
        return 'Conversation too long for model. Reducing context...'
      }
      return `OpenAI error: ${error.message}`
    },
  },
  
  anthropic: {
    isRetryable: (error) => {
      const msg = error.message.toLowerCase()
      return msg.includes('overloaded') ||
             msg.includes('rate limit') ||
             msg.includes('529')
    },
    getRetryDelay: (error) => {
      if (error.message.includes('overloaded')) return 30000
      return 10000
    },
    formatUserMessage: (error) => {
      if (error.message.includes('overloaded')) {
        return 'Claude is currently overloaded. Retrying shortly...'
      }
      return `Anthropic error: ${error.message}`
    },
  },
  
  google: {
    isRetryable: (error) => {
      const msg = error.message.toLowerCase()
      return msg.includes('quota') ||
             msg.includes('resource exhausted') ||
             msg.includes('429')
    },
    getRetryDelay: (error) => {
      if (error.message.includes('quota')) return 60000
      return 5000
    },
    formatUserMessage: (error) => {
      if (error.message.includes('quota')) {
        return 'Google AI quota exceeded. Waiting before retry...'
      }
      return `Google AI error: ${error.message}`
    },
  },
}

export function getErrorHandler(provider: string): ProviderErrorHandler {
  return handlers[provider] ?? {
    isRetryable: (error) => 
      error.message.includes('rate') || 
      error.message.includes('timeout'),
    getRetryDelay: () => 5000,
    formatUserMessage: (error) => error.message,
  }
}
```

---

## Generation Guarantees

### What We Guarantee

| Scenario | Guarantee | Fallback |
|----------|-----------|----------|
| API timeout | Retry 3x with backoff | Show partial results if any |
| Token limit exceeded | Reduce context and retry | Minimal overview without diagrams |
| Rate limit hit | Wait and retry | Queue and notify user |
| Network failure | Retry with backoff | Save progress, allow resume |
| Invalid response | Parse error, retry once | Show raw response for debugging |
| App crash | Persist session state | Resume on next attempt |
| Provider outage | Try fallback provider | Notify user, offer manual retry |

### What We Don't Guarantee

- Exact same output on retry (AI is non-deterministic)
- Immediate response (rate limits may cause delays)
- All diagrams will render (Mermaid validation may fail)
- All citations will be accurate (AI may hallucinate)

---

## Monitoring and Diagnostics

### Error Telemetry

```typescript
// main/services/telemetry/errors.ts

export type ErrorEvent = {
  id: string
  timestamp: number
  
  // Context
  workspaceId: string
  conversationId: string
  phase: string
  
  // Error details
  errorType: string
  errorMessage: string
  provider?: string
  model?: string
  
  // Recovery
  wasRetried: boolean
  retryCount: number
  wasRecovered: boolean
  fallbackUsed?: string
}

export function logError(event: ErrorEvent): void {
  // Store locally for debugging
  db.prepare(`
    INSERT INTO error_events (id, timestamp, workspace_id, conversation_id, phase,
      error_type, error_message, provider, model, was_retried, retry_count, was_recovered, fallback_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.timestamp,
    event.workspaceId,
    event.conversationId,
    event.phase,
    event.errorType,
    event.errorMessage.slice(0, 1000),
    event.provider ?? null,
    event.model ?? null,
    event.wasRetried ? 1 : 0,
    event.retryCount,
    event.wasRecovered ? 1 : 0,
    event.fallbackUsed ?? null
  )
}

// Query for debugging
export function getRecentErrors(limit = 50): ErrorEvent[] {
  return db.prepare(`
    SELECT * FROM error_events
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit)
}
```

### Health Check

```typescript
// main/services/health.ts

export type HealthStatus = {
  healthy: boolean
  database: 'ok' | 'error'
  storage: {
    totalBytes: number
    usedBytes: number
    percentUsed: number
  }
  recentErrors: {
    last24h: number
    lastHour: number
    byType: Record<string, number>
  }
  activeGenerations: number
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const dbHealthy = await checkDatabaseHealth()
  const storage = await getStorageStats()
  const errors = await getErrorStats()
  const activeGens = countActiveGenerations()
  
  return {
    healthy: dbHealthy && storage.percentUsed < 90 && errors.lastHour < 10,
    database: dbHealthy ? 'ok' : 'error',
    storage,
    recentErrors: errors,
    activeGenerations: activeGens,
  }
}
```

---

## Summary

| Pattern | Implementation | DeepWiki Inspiration |
|---------|---------------|----------------------|
| Exponential backoff | `withRetry()` utility | Uses `backoff` library |
| Token limit detection | Pattern matching on errors | Same patterns |
| Fallback strategies | Reduce tokens, drop diagrams | Retry without RAG context |
| Session persistence | SQLite with partial results | N/A (web-based) |
| Citation format | `[Turn N]` syntax | `[file:line]` syntax |
| Provider error handling | Handler registry | Per-provider try/catch |
| Progress reporting | Callback with phases | WebSocket streaming |

This ensures that when a user asks for an overview, they get one—even if it takes multiple attempts, uses reduced context, or skips diagrams. The system is persistent and recoverable.
