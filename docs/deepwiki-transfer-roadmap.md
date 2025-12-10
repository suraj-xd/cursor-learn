# DeepWiki → Cursor Learn Transfer Roadmap

## Executive Summary

This document outlines how to adapt DeepWiki's wiki/overview generation techniques to improve Cursor Learn's ability to extract learnings, generate structured overviews, and create diagrams from Cursor AI chat sessions. Unlike DeepWiki (which analyzes Git repositories via a Python backend with RAG), Cursor Learn operates entirely locally within an Electron app, using user-provided API keys and SQLite storage.

---

## Current State Analysis

### Cursor Learn Architecture
- **Runtime**: Electron app with Node.js backend, React frontend
- **Storage**: SQLite via `better-sqlite3` stored in user's app data
- **AI Integration**: Vercel AI SDK (`ai` package) with multiple provider support
- **Data Model**: Conversations → bubbles (user/ai messages) → compacted summaries → overviews → learnings → resources

### Current Limitations
1. **Overview Generation**: Single-pass prompt produces flat JSON output; no hierarchical structure or iterative refinement
2. **Compact Strategy**: Map-reduce chunking is functional but summaries lack structured extraction of decisions/patterns/concepts
3. **No Retrieval**: Cannot retrieve relevant past context; each generation is standalone
4. **No Diagrams**: Missing Mermaid/flowchart generation despite prompt mentions
5. **Flat Output**: Overview content is a single markdown blob; no navigation, sections, or linked artifacts

### DeepWiki Techniques to Adapt
| DeepWiki Feature | Cursor Learn Equivalent | Gap |
|------------------|------------------------|-----|
| WikiStructure hierarchy | ConversationOverview flat | Need hierarchical sections |
| Two-phase generation (structure → pages) | Single-pass overview | Need outline-first approach |
| RAG retrieval from embeddings | None | Add optional local vector store |
| Deep Research iterations | None | Add multi-turn refinement |
| Mermaid diagrams in content | Prompts mention but not implemented | Add diagram generation pass |
| Importance scoring (high/medium/low) | None | Add signal scoring |
| File path citations | None | Add turn/code citations |

---

## Proposed Architecture

### Phase 1: Enhanced Overview Generation

```
Chat Session
    │
    ▼
┌─────────────────────────────────────┐
│  INGESTION                          │
│  Parse bubbles → DialogTurns        │
│  Extract: code, decisions, errors   │
│  Compute importance scores          │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  STRUCTURE PASS (Outline)           │
│  Prompt: Analyze and return XML     │
│  structure with sections/pages      │
│  Token budget: ~2K input, ~1K out   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  CONTENT PASS (Per Section)         │
│  For each section in structure:     │
│    - Generate detailed markdown     │
│    - Include code snippets inline   │
│    - Add Mermaid where appropriate  │
│  Token budget: ~4K per section      │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  POST-PROCESSING                    │
│  - Deduplicate overlaps             │
│  - Validate citations               │
│  - Cache to SQLite                  │
└─────────────────────────────────────┘
```

### Phase 2: Local Retrieval Layer (Optional)

```
┌──────────────────────────────────────────────┐
│  EMBEDDING STORE                             │
│  - Embed chat turns + summaries              │
│  - Store in SQLite-based vector store        │
│  - Size cap: 200-500MB total                 │
│  - Eviction: LRU per workspace               │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  RETRIEVAL                                   │
│  - Query: user question or topic             │
│  - Return top-K relevant turns/summaries     │
│  - Use for chat context augmentation         │
└──────────────────────────────────────────────┘
```

---

## Data Schemas

### DialogTurn (Enhanced)
```typescript
type DialogTurn = {
  id: string
  index: number
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  
  // Extracted artifacts
  codeBlocks: CodeBlock[]
  fileRefs: string[]
  errorMentions: ErrorMention[]
  decisions: string[]
  
  // Computed
  importance: 'high' | 'medium' | 'low'
  tokenCount: number
}

type CodeBlock = {
  language: string
  code: string
  purpose?: string
  turnId: string
  startLine?: number
}

type ErrorMention = {
  type: 'error' | 'warning' | 'fix'
  description: string
  resolution?: string
}
```

### OverviewStructure (New)
```typescript
type OverviewStructure = {
  id: string
  conversationId: string
  title: string
  summary: string
  
  sections: OverviewSection[]
  
  metadata: {
    totalTurns: number
    importantTurns: number
    tokenBudgetUsed: number
    generatedAt: number
  }
}

type OverviewSection = {
  id: string
  title: string
  order: number
  type: 'goal' | 'context' | 'implementation' | 'decisions' | 'problems' | 'learnings' | 'next_steps'
  
  content: string  // Markdown
  codeSnippets: CodeBlock[]
  diagrams: DiagramSpec[]
  citations: Citation[]
  
  importance: 'high' | 'medium' | 'low'
}

type DiagramSpec = {
  type: 'mermaid' | 'flowchart' | 'sequence' | 'architecture'
  code: string
  caption?: string
}

type Citation = {
  turnId: string
  turnIndex: number
  excerpt?: string
}
```

### LearningConcept (Enhanced)
```typescript
type LearningConcept = {
  id: string
  name: string
  category: 'pattern' | 'technique' | 'architecture' | 'debugging' | 'tool' | 'concept'
  
  description: string
  examples: ConceptExample[]
  relatedTurns: string[]
  
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  
  createdAt: number
}

type ConceptExample = {
  code?: string
  language?: string
  explanation: string
  turnId?: string
}
```

---

## Token Budget Strategy

### Per-Generation Limits
| Stage | Input Tokens | Output Tokens | Notes |
|-------|-------------|---------------|-------|
| Structure Pass | 8,000 | 2,000 | Truncate low-importance turns |
| Section Content | 6,000 | 4,000 | Per section, include relevant turns only |
| Diagram Generation | 2,000 | 1,000 | Focused on specific flow/architecture |
| Learnings Extraction | 8,000 | 3,000 | From compacted content |

### Truncation Strategy
1. Score all turns by importance
2. For long chats (>50K tokens):
   - Always keep first 3 and last 5 turns
   - Keep all high-importance turns
   - Summarize blocks of low-importance turns
3. Target: fit within 32K context window with room for system prompt

---

## Implementation Todos

### Phase 1: Foundation
- [ ] Create `DialogTurnParser` to extract code blocks, file refs, errors from bubbles
- [ ] Add importance scoring based on: code presence, error mentions, decision keywords, user questions
- [ ] Create `OverviewStructureGenerator` with two-phase (outline → content) approach
- [ ] Add section-by-section content generation with parallel execution (max 3 concurrent)
- [ ] Implement citation linking back to source turns

### Phase 2: Diagrams
- [ ] Create diagram generation prompts for: architecture, flow, sequence
- [ ] Add `DiagramGenerator` service with Mermaid output
- [ ] Integrate Mermaid renderer in frontend (already has support via markdown)
- [ ] Cache rendered diagrams as SVG

### Phase 3: Learnings
- [ ] Enhance learnings extraction with structured concept schema
- [ ] Add concept categorization and difficulty rating
- [ ] Link concepts to specific code examples and turns
- [ ] Enable concept search and export

### Phase 4: Retrieval (Optional)
- [ ] Evaluate: `sqlite-vss`, `chromadb` (if Node bindings exist), or simple cosine similarity with small embeddings
- [ ] Implement embedding pipeline for turns + summaries
- [ ] Add storage quotas and cleanup
- [ ] Integrate retrieval into chat context

---

## File Structure

```
main/services/
├── ai/
│   ├── prompts/
│   │   ├── overview-structure.md      # NEW: Structure generation
│   │   ├── overview-section.md        # NEW: Section content
│   │   ├── diagram-architecture.md    # NEW: Architecture diagrams
│   │   ├── diagram-flow.md            # NEW: Flow diagrams
│   │   ├── learnings-extract.md       # ENHANCED: Concept extraction
│   │   └── ... existing ...
│   └── prompts.ts                     # Add new prompt loaders
├── overview-agent.ts                  # REFACTOR: Two-phase generation
├── diagram-agent.ts                   # NEW: Diagram generation
├── learnings-agent.ts                 # NEW: Concept extraction
├── turn-parser.ts                     # NEW: Bubble → DialogTurn
├── importance-scorer.ts               # NEW: Turn importance
└── retrieval/                         # NEW: Optional vector storage
    ├── embedder.ts
    ├── vector-store.ts
    └── retriever.ts
```

---

## Migration Path

### Step 1: Non-Breaking Additions
- Add new agents alongside existing ones
- New tables in SQLite for enhanced schemas
- Feature flag for new overview generation

### Step 2: Gradual Rollout
- A/B test new overview quality
- Gather user feedback
- Tune prompts based on results

### Step 3: Deprecation
- Mark old overview generation as legacy
- Migrate existing overviews on-demand
- Remove old code after confirmation

---

## Success Metrics

1. **Overview Quality**: Manual review of 20 sample chats; rate for completeness, accuracy, usefulness
2. **Diagram Relevance**: % of diagrams that accurately reflect conversation content
3. **Learning Extraction**: Number of distinct concepts extracted per chat; user upvotes
4. **Token Efficiency**: Average tokens per overview; stay under budget
5. **Performance**: Generation time < 30s for typical chat; no blocking of UI

---

## Resilience (Critical)

See `resilience-patterns.md` for full details. Key patterns:

1. **Exponential Backoff**: Retry API calls with increasing delays (1s → 2s → 4s)
2. **Token Limit Detection**: Catch "context length exceeded" errors and retry with reduced input
3. **Fallback Strategies**: Full → Reduced → Minimal → Emergency (progressively smaller token budgets)
4. **Session Persistence**: Save partial results to SQLite; resume interrupted generations
5. **Citation Validation**: Verify `[Turn N]` references point to real turns
6. **Provider Error Handling**: Per-provider retry logic for rate limits, timeouts, overloads

---

## Next Steps

1. Review this roadmap
2. Prioritize Phase 1 vs Phase 2 vs Phase 3
3. Begin with `turn-parser.ts` and new prompts
4. Add retry/fallback utilities early (they're used everywhere)
5. Iterate on prompt quality with sample chats
