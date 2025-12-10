# Implementation Guide: DeepWiki-Inspired Enhancements

Quick reference for implementing the enhanced overview system in Cursor Learn.

---

## Implementation Order

### Phase 1: Foundation (Week 1-2)

**Priority: Critical**

1. **Turn Parser** (`main/services/turn-parser.ts`)
   - Parse bubbles into structured DialogTurns
   - Extract code blocks, file refs, errors, decisions
   - No new dependencies

2. **Importance Scorer** (`main/services/importance-scorer.ts`)
   - Score turns 1-10 based on content signals
   - Classify as high/medium/low
   - Used for truncation decisions

3. **Structure Prompt** (`main/services/ai/prompts/overview-structure.md`)
   - XML output for section hierarchy
   - Copy from `prompt-library.md`

4. **Database Migrations**
   - Add tables from `data-schemas.md`
   - Backward compatible with existing data

### Phase 2: Two-Phase Generation (Week 2-3)

**Priority: High**

5. **Enhanced Overview Agent** (`main/services/enhanced-overview-agent.ts`)
   - Phase 1: Structure generation
   - Phase 2: Section content (parallel)
   - Progress callbacks
   - Error recovery

6. **Section Content Prompt** (`main/services/ai/prompts/overview-section.md`)
   - Per-section markdown generation
   - Citation format

7. **IPC Handlers**
   - Add handlers in `main/background.ts`
   - `overview:generate`, `overview:get`, `overview:cancel`

8. **React Hook** (`renderer/hooks/useEnhancedOverview.ts`)
   - State management
   - Progress tracking

### Phase 3: Diagrams (Week 3-4)

**Priority: Medium**

9. **Diagram Agent** (`main/services/diagram-agent.ts`)
   - Architecture and flow diagrams
   - Mermaid syntax validation
   - SVG caching

10. **Diagram Prompts**
    - `diagram-architecture.md`
    - `diagram-flow.md`

11. **Mermaid Integration**
    - Already have Mermaid in markdown renderer
    - Add diagram render caching

### Phase 4: Learnings (Week 4-5)

**Priority: Medium**

12. **Learnings Agent** (`main/services/learnings-agent.ts`)
    - Concept extraction
    - Structured output

13. **Learnings Prompt** (`main/services/ai/prompts/learnings-extract.md`)

14. **Learnings UI**
    - Display extracted concepts
    - Link to source turns

### Phase 5: Optional Retrieval (Week 5-6)

**Priority: Low (can defer)**

15. **Embedding Storage** (`main/services/retrieval/vector-store.ts`)
    - SQLite BLOB storage
    - Cosine similarity

16. **Eviction Logic**
    - LRU-based cleanup
    - Storage quotas

---

## File Checklist

### New Files to Create

```
main/services/
├── types/
│   ├── dialog-turn.ts          ← DialogTurn, CodeBlock, etc.
│   ├── overview-structure.ts   ← OverviewStructure, OverviewSection
│   ├── learning-concept.ts     ← LearningConcept, ConceptExample
│   └── errors.ts               ← Custom error classes
├── turn-parser.ts              ← parseConversation()
├── importance-scorer.ts        ← scoreImportance()
├── enhanced-overview-agent.ts  ← generateEnhancedOverview()
├── diagram-agent.ts            ← generateDiagram()
├── learnings-agent.ts          ← extractLearnings()
├── export-agent.ts             ← exportAsMarkdown(), exportAsJson()
├── ai/prompts/
│   ├── overview-structure.md   ← Structure XML generation
│   ├── overview-section.md     ← Section content
│   ├── diagram-architecture.md ← Architecture diagrams
│   ├── diagram-flow.md         ← Flow diagrams
│   ├── learnings-extract.md    ← Concept extraction
│   ├── importance-score.md     ← Turn scoring (optional)
│   ├── research-first.md       ← Deep research (optional)
│   ├── research-intermediate.md
│   └── research-final.md
└── retrieval/                  ← Optional
    ├── vector-store.ts
    ├── embedder.ts
    └── retriever.ts

renderer/
├── hooks/
│   └── useEnhancedOverview.ts
└── components/overview/
    ├── EnhancedOverviewPanel.tsx
    ├── SectionNav.tsx
    ├── SectionContent.tsx
    ├── GenerationProgress.tsx
    └── DiagramViewer.tsx
```

### Files to Modify

```
main/
├── background.ts               ← Add IPC handlers
├── services/database.ts        ← Add new migrations
└── services/ai/prompts.ts      ← Add new prompt loaders

renderer/
├── pages/[workspace]/[conversation].tsx  ← Integrate new panel
└── components/settings/        ← Add overview settings
```

---

## Key Code Snippets

### 1. Basic Turn Parsing

```typescript
// main/services/turn-parser.ts

const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g

export function extractCodeBlocks(text: string, turnId: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  let match
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blocks.push({
      id: crypto.randomUUID(),
      language: match[1] || 'text',
      code: match[2].trim(),
      lineCount: match[2].split('\n').length,
      turnId,
    })
  }
  return blocks
}
```

### 2. Structure Generation Call

```typescript
// main/services/enhanced-overview-agent.ts

async function generateStructure(
  turns: DialogTurn[],
  title: string
): Promise<OverviewStructureSkeleton> {
  const truncated = truncateForBudget(turns, 8000)
  const conversationText = formatTurnsAsText(truncated)
  
  const prompt = STRUCTURE_PROMPT
    .replace('{title}', title)
    .replace('{conversation}', conversationText)
  
  const result = await generate({
    prompt,
    temperature: 0.2,
    maxTokens: 2000,
    role: 'overview',
  })
  
  return parseStructureXml(result.content)
}
```

### 3. Parallel Section Generation

```typescript
// main/services/enhanced-overview-agent.ts

const SECTION_SEMAPHORE = new Semaphore(3)

async function generateAllSections(
  skeleton: OverviewStructureSkeleton,
  turns: DialogTurn[],
  onProgress: (completed: number, total: number) => void
): Promise<OverviewSection[]> {
  let completed = 0
  
  return Promise.all(
    skeleton.sections.map(async (sectionDef) => {
      await SECTION_SEMAPHORE.acquire()
      try {
        const section = await generateSectionContent(sectionDef, turns)
        completed++
        onProgress(completed, skeleton.sections.length)
        return section
      } finally {
        SECTION_SEMAPHORE.release()
      }
    })
  )
}
```

### 4. IPC Handler

```typescript
// main/background.ts

ipcMain.handle('overview:generate', async (event, args) => {
  const { workspaceId, conversationId, title, bubbles, options } = args
  
  return generateEnhancedOverview(
    { workspaceId, conversationId, title, bubbles },
    options,
    (progress) => {
      event.sender.send('overview:progress', {
        conversationId,
        progress,
      })
    }
  )
})
```

### 5. React Hook Usage

```tsx
// renderer/components/ConversationView.tsx

function ConversationView({ workspace, conversation }) {
  const { overview, isGenerating, progress, generate } = useEnhancedOverview(
    workspace.id,
    conversation.id
  )
  
  return (
    <Tabs>
      <Tab label="Chat">
        <ChatView conversation={conversation} />
      </Tab>
      <Tab label="Overview">
        {isGenerating ? (
          <GenerationProgress progress={progress} />
        ) : overview ? (
          <EnhancedOverviewPanel overview={overview} />
        ) : (
          <Button onClick={() => generate(conversation.bubbles, conversation.title)}>
            Generate Overview
          </Button>
        )}
      </Tab>
    </Tabs>
  )
}
```

### 6. Retry with Exponential Backoff

```typescript
// main/services/utils/retry.ts

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: { maxRetries: number; initialDelayMs: number } = { maxRetries: 3, initialDelayMs: 1000 }
): Promise<T> {
  let lastError: Error | null = null
  let delay = config.initialDelayMs
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt > config.maxRetries) throw lastError
      
      await new Promise(r => setTimeout(r, delay))
      delay *= 2 // Exponential backoff
    }
  }
  throw lastError
}
```

### 7. Token Limit Fallback

```typescript
// main/services/enhanced-overview-agent.ts

async function generateWithFallback(conversation: ParsedConversation): Promise<OverviewStructure> {
  const strategies = [
    { tokenBudget: 10000, diagrams: true },
    { tokenBudget: 6000, diagrams: true },
    { tokenBudget: 4000, diagrams: false },
    { tokenBudget: 2000, diagrams: false },
  ]
  
  for (const strategy of strategies) {
    try {
      const truncated = truncateForBudget(conversation.turns, strategy.tokenBudget)
      return await generateOverview(truncated, { generateDiagrams: strategy.diagrams })
    } catch (error) {
      if (isTokenLimitError(error)) continue
      throw error
    }
  }
  throw new Error('Failed after all fallback strategies')
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Turn parser extracts code blocks correctly
- [ ] Turn parser extracts file references
- [ ] Turn parser identifies errors and fixes
- [ ] Importance scorer assigns correct levels
- [ ] Truncation preserves important turns
- [ ] Structure XML parsing handles edge cases
- [ ] Citation parsing is accurate

### Integration Tests
- [ ] Full generation pipeline completes
- [ ] Progress callbacks fire correctly
- [ ] Cancellation works mid-generation
- [ ] Error recovery kicks in on failure
- [ ] Database saves and retrieves correctly

### E2E Tests
- [ ] Generate button triggers generation
- [ ] Progress UI updates in real-time
- [ ] Completed overview renders correctly
- [ ] Section navigation works
- [ ] Diagrams render properly
- [ ] Export produces valid files

---

## Configuration Defaults

```typescript
// main/services/config/overview-config.ts

export const OVERVIEW_CONFIG = {
  // Generation
  maxSections: 8,
  generateDiagrams: true,
  parallelSections: 3,
  
  // Token budgets
  structureInputTokens: 8000,
  structureOutputTokens: 2000,
  sectionInputTokens: 6000,
  sectionOutputTokens: 4000,
  diagramInputTokens: 2000,
  diagramOutputTokens: 1000,
  
  // Truncation
  preserveFirstTurns: 3,
  preserveLastTurns: 5,
  preserveHighImportance: true,
  
  // Storage
  maxOverviewsPerWorkspace: 500,
  maxDiagramCacheSize: 100,
  
  // Retrieval (if enabled)
  enableEmbeddings: false,
  maxEmbeddingStorage: 500 * 1024 * 1024,
  embeddingModel: 'text-embedding-3-small',
}
```

---

## Rollout Strategy

### Feature Flags

```typescript
// renderer/hooks/useFeatureFlags.ts

export function useFeatureFlags() {
  return {
    enhancedOverview: true,      // Toggle new overview system
    overviewDiagrams: true,      // Toggle diagram generation
    overviewEmbeddings: false,   // Toggle embedding storage
    deepResearch: false,         // Toggle multi-turn research
  }
}
```

### Gradual Migration

1. **Week 1**: Ship behind feature flag, internal testing
2. **Week 2**: Enable for 10% of users, monitor
3. **Week 3**: Enable for 50%, gather feedback
4. **Week 4**: General availability
5. **Week 6**: Deprecate old overview system

---

## Monitoring

### Metrics to Track

```typescript
// main/services/telemetry.ts (local only)

export function trackOverviewGeneration(metrics: {
  conversationTurns: number
  tokenBudgetUsed: number
  sectionsGenerated: number
  diagramsGenerated: number
  generationTimeMs: number
  errors: string[]
}) {
  // Store locally for debugging/improvement
  db.prepare(`
    INSERT INTO generation_metrics (...)
    VALUES (...)
  `).run(...)
}
```

### Error Logging

```typescript
export function logGenerationError(error: OverviewGenerationError) {
  console.error('[Overview Generation Error]', {
    phase: error.phase,
    message: error.message,
    recoverable: error.recoverable,
    stack: error.stack,
  })
  
  // Store for analysis
  db.prepare(`
    INSERT INTO error_logs (type, phase, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run('overview_generation', error.phase, error.message, Date.now())
}
```

---

## Documentation References

| Document | Contents |
|----------|----------|
| `deepwiki-transfer-roadmap.md` | High-level architecture and migration plan |
| `prompt-library.md` | All prompts with usage notes |
| `data-schemas.md` | TypeScript types and SQLite schemas |
| `storage-policy.md` | Quotas, eviction, token budgets |
| `generation-flows.md` | Pipeline details and API design |
| `resilience-patterns.md` | Retry strategies, error handling, session persistence |
| This file | Quick implementation reference |

---

## Quick Start Commands

```bash
# Create new files
touch main/services/turn-parser.ts
touch main/services/importance-scorer.ts
touch main/services/enhanced-overview-agent.ts
touch main/services/types/dialog-turn.ts

# Create prompt files
touch main/services/ai/prompts/overview-structure.md
touch main/services/ai/prompts/overview-section.md

# Run tests
yarn test turn-parser
yarn test enhanced-overview
```

---

## Support

For questions about this implementation:
1. Review the referenced documentation files
2. Check DeepWiki source for additional patterns
3. Test with sample conversations before production rollout
