# Generation Flows and API Design

This document details the generation pipelines, internal APIs, and UI integration points for the enhanced overview system.

---

## Generation Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USER TRIGGERS GENERATION                        │
│                   (Click "Generate Overview" button)                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 0: VALIDATION                                                 │
│  • Check API key available                                          │
│  • Check conversation has enough content                            │
│  • Check no active generation in progress                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: INGESTION                                                  │
│  • Parse bubbles → DialogTurns                                      │
│  • Extract code blocks, file refs, errors, decisions                │
│  • Score importance of each turn                                    │
│  • Cache parsed conversation                                        │
│  Progress: 0% → 10%                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: STRUCTURE GENERATION                                       │
│  • Truncate conversation if needed                                  │
│  • Send to AI for structure (XML)                                   │
│  • Parse XML → OverviewStructure skeleton                           │
│  • Cache structure                                                  │
│  Progress: 10% → 25%                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: SECTION CONTENT GENERATION                                 │
│  • For each section (parallel, max 3 concurrent):                   │
│    - Extract relevant turns                                         │
│    - Generate markdown content                                      │
│    - Parse citations                                                │
│  Progress: 25% → 75%                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: DIAGRAM GENERATION (Optional)                              │
│  • Identify sections needing diagrams                               │
│  • Generate Mermaid code                                            │
│  • Validate syntax                                                  │
│  • Cache rendered SVG                                               │
│  Progress: 75% → 85%                                                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5: POST-PROCESSING                                            │
│  • Validate all citations                                           │
│  • Deduplicate content across sections                              │
│  • Save to database                                                 │
│  • Optionally generate embeddings                                   │
│  Progress: 85% → 100%                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  COMPLETE: Return OverviewStructure to UI                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Internal API Design

### Main Entry Points

```typescript
// main/services/enhanced-overview-agent.ts

export interface GenerationOptions {
  generateDiagrams?: boolean
  generateEmbeddings?: boolean
  maxSections?: number
  tokenBudget?: number
}

export interface GenerationProgress {
  phase: 'ingestion' | 'structure' | 'sections' | 'diagrams' | 'postprocess'
  progress: number // 0-100
  currentStep: string
  sectionsCompleted?: number
  sectionsTotal?: number
}

export type ProgressCallback = (progress: GenerationProgress) => void

export async function generateEnhancedOverview(
  conversation: ConversationInput,
  options?: GenerationOptions,
  onProgress?: ProgressCallback
): Promise<OverviewStructure> {
  // Implementation
}

export async function regenerateSection(
  overviewId: string,
  sectionId: string,
  onProgress?: ProgressCallback
): Promise<OverviewSection> {
  // Re-generate a single section
}

export async function generateDiagramForSection(
  overviewId: string,
  sectionId: string,
  diagramType: DiagramType
): Promise<DiagramSpec> {
  // Generate a new diagram for a section
}

export function cancelGeneration(sessionId: string): boolean {
  // Cancel in-progress generation
}
```

### IPC Handlers (Electron)

```typescript
// main/background.ts - Add these IPC handlers

import { ipcMain } from 'electron'
import * as enhancedOverview from './services/enhanced-overview-agent'

// Generate overview
ipcMain.handle('overview:generate', async (event, { workspaceId, conversationId, title, bubbles, options }) => {
  return enhancedOverview.generateEnhancedOverview(
    { workspaceId, conversationId, title, bubbles },
    options,
    (progress) => {
      event.sender.send('overview:progress', { conversationId, progress })
    }
  )
})

// Get existing overview
ipcMain.handle('overview:get', async (event, { workspaceId, conversationId }) => {
  return enhancedOverview.getOverviewForConversation(workspaceId, conversationId)
})

// Cancel generation
ipcMain.handle('overview:cancel', async (event, { sessionId }) => {
  return enhancedOverview.cancelGeneration(sessionId)
})

// Export overview
ipcMain.handle('overview:export', async (event, { overviewId, format }) => {
  return enhancedOverview.exportOverview(overviewId, format)
})

// Regenerate section
ipcMain.handle('overview:regenerate-section', async (event, { overviewId, sectionId }) => {
  return enhancedOverview.regenerateSection(overviewId, sectionId)
})

// Generate diagram
ipcMain.handle('overview:generate-diagram', async (event, { overviewId, sectionId, type }) => {
  return enhancedOverview.generateDiagramForSection(overviewId, sectionId, type)
})
```

### Renderer API (React Hooks)

```typescript
// renderer/hooks/useEnhancedOverview.ts

import { useCallback, useState, useEffect } from 'react'

export type OverviewState = {
  overview: OverviewStructure | null
  isGenerating: boolean
  progress: GenerationProgress | null
  error: string | null
}

export function useEnhancedOverview(workspaceId: string, conversationId: string) {
  const [state, setState] = useState<OverviewState>({
    overview: null,
    isGenerating: false,
    progress: null,
    error: null,
  })
  
  // Load existing overview on mount
  useEffect(() => {
    async function load() {
      try {
        const existing = await window.api.invoke('overview:get', { workspaceId, conversationId })
        if (existing) {
          setState(prev => ({ ...prev, overview: existing }))
        }
      } catch (err) {
        setState(prev => ({ ...prev, error: err.message }))
      }
    }
    load()
  }, [workspaceId, conversationId])
  
  // Listen for progress updates
  useEffect(() => {
    const cleanup = window.api.on('overview:progress', ({ conversationId: cid, progress }) => {
      if (cid === conversationId) {
        setState(prev => ({ ...prev, progress }))
      }
    })
    return cleanup
  }, [conversationId])
  
  const generate = useCallback(async (bubbles: ConversationBubble[], title: string, options?: GenerationOptions) => {
    setState(prev => ({ ...prev, isGenerating: true, error: null }))
    
    try {
      const overview = await window.api.invoke('overview:generate', {
        workspaceId,
        conversationId,
        title,
        bubbles,
        options,
      })
      setState({ overview, isGenerating: false, progress: null, error: null })
      return overview
    } catch (err) {
      setState(prev => ({ ...prev, isGenerating: false, error: err.message }))
      throw err
    }
  }, [workspaceId, conversationId])
  
  const cancel = useCallback(async () => {
    // Implementation
  }, [])
  
  const regenerateSection = useCallback(async (sectionId: string) => {
    // Implementation
  }, [])
  
  const exportOverview = useCallback(async (format: 'markdown' | 'json') => {
    // Implementation
  }, [])
  
  return {
    ...state,
    generate,
    cancel,
    regenerateSection,
    exportOverview,
  }
}
```

---

## Learnings Extraction Flow

```typescript
// main/services/learnings-agent.ts

export interface LearningsExtractionOptions {
  maxConcepts?: number
  includeExamples?: boolean
  difficultyFilter?: DifficultyLevel[]
}

export async function extractLearnings(
  conversation: ConversationInput,
  options?: LearningsExtractionOptions
): Promise<LearningConcept[]> {
  // 1. Get compacted content if available, otherwise use raw
  const compacted = await getCompactedChatForConversation(
    conversation.workspaceId,
    conversation.conversationId
  )
  
  const content = compacted?.compactedContent ?? formatBubblesAsText(conversation.bubbles)
  
  // 2. Generate learnings via AI
  const prompt = buildLearningsExtractionPrompt(content, options)
  
  const result = await generate({
    prompt,
    temperature: 0.4,
    maxTokens: 3000,
    role: 'learnings',
  })
  
  // 3. Parse and validate
  const concepts = parseLearningsResponse(result.content)
  
  // 4. Save to database
  for (const concept of concepts) {
    await saveLearningConcept({
      ...concept,
      workspaceId: conversation.workspaceId,
      conversationId: conversation.conversationId,
    })
  }
  
  return concepts
}
```

---

## Diagram Generation Flow

```typescript
// main/services/diagram-agent.ts

import mermaid from 'mermaid'

export type DiagramContext = {
  sectionContent: string
  relevantTurns: DialogTurn[]
  existingDiagrams: DiagramSpec[]
}

export async function generateDiagram(
  type: DiagramType,
  context: DiagramContext
): Promise<DiagramSpec> {
  // 1. Select prompt based on type
  const prompt = type === 'architecture' 
    ? buildArchitectureDiagramPrompt(context)
    : buildFlowDiagramPrompt(context)
  
  // 2. Generate Mermaid code
  const result = await generate({
    prompt,
    temperature: 0.3,
    maxTokens: 1000,
    role: 'diagram',
  })
  
  // 3. Extract Mermaid code block
  const mermaidCode = extractMermaidCode(result.content)
  
  // 4. Validate syntax
  const isValid = await validateMermaidSyntax(mermaidCode)
  if (!isValid) {
    // Retry with syntax correction prompt
    const corrected = await correctMermaidSyntax(mermaidCode)
    if (!await validateMermaidSyntax(corrected)) {
      throw new Error('Failed to generate valid Mermaid diagram')
    }
    return {
      id: generateId(),
      type,
      mermaidCode: corrected,
      sectionId: context.sectionId,
    }
  }
  
  return {
    id: generateId(),
    type,
    mermaidCode,
    sectionId: context.sectionId,
  }
}

async function validateMermaidSyntax(code: string): Promise<boolean> {
  try {
    // Use mermaid's parse function to validate
    await mermaid.parse(code)
    return true
  } catch {
    return false
  }
}

function extractMermaidCode(response: string): string {
  const match = response.match(/```mermaid\n([\s\S]*?)```/)
  if (match) return match[1].trim()
  
  // Fallback: try to find flowchart/graph/sequenceDiagram directly
  const directMatch = response.match(/(flowchart|graph|sequenceDiagram|classDiagram)[\s\S]*/)
  if (directMatch) return directMatch[0].trim()
  
  return response.trim()
}
```

---

## Export Flows

### Markdown Export

```typescript
// main/services/export-agent.ts

export async function exportAsMarkdown(overviewId: string): Promise<string> {
  const overview = await getOverviewStructure(overviewId)
  if (!overview) throw new Error('Overview not found')
  
  const lines: string[] = []
  
  // Frontmatter
  lines.push('---')
  lines.push(`title: "${overview.title}"`)
  lines.push(`generated: "${new Date(overview.createdAt).toISOString()}"`)
  lines.push(`model: "${overview.metadata.modelUsed}"`)
  lines.push('---')
  lines.push('')
  
  // Title and summary
  lines.push(`# ${overview.title}`)
  lines.push('')
  lines.push(overview.summary)
  lines.push('')
  
  // Table of contents
  lines.push('## Table of Contents')
  for (const section of overview.sections) {
    lines.push(`- [${section.title}](#${slugify(section.title)})`)
  }
  lines.push('')
  
  // Sections
  for (const section of overview.sections) {
    lines.push(`## ${section.title}`)
    lines.push('')
    lines.push(section.content)
    lines.push('')
    
    // Diagrams
    for (const diagram of section.diagrams) {
      lines.push('```mermaid')
      lines.push(diagram.mermaidCode)
      lines.push('```')
      if (diagram.caption) {
        lines.push(`*${diagram.caption}*`)
      }
      lines.push('')
    }
  }
  
  return lines.join('\n')
}
```

### JSON Export

```typescript
export async function exportAsJson(overviewId: string): Promise<JsonExport> {
  const overview = await getOverviewStructure(overviewId)
  if (!overview) throw new Error('Overview not found')
  
  const learnings = await getLearningsForConversation(
    overview.workspaceId,
    overview.conversationId
  )
  
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    conversation: {
      id: overview.conversationId,
      title: overview.title,
      workspaceId: overview.workspaceId,
    },
    overview,
    learnings: learnings?.concepts ?? [],
    diagrams: overview.sections.flatMap(s => s.diagrams),
  }
}
```

---

## UI Component Integration

### Overview Panel

```tsx
// renderer/components/overview/EnhancedOverviewPanel.tsx

import { useEnhancedOverview } from '../../hooks/useEnhancedOverview'

type Props = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
}

export function EnhancedOverviewPanel({ workspaceId, conversationId, title, bubbles }: Props) {
  const {
    overview,
    isGenerating,
    progress,
    error,
    generate,
    regenerateSection,
    exportOverview,
  } = useEnhancedOverview(workspaceId, conversationId)
  
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  
  const handleGenerate = async () => {
    await generate(bubbles, title, {
      generateDiagrams: true,
      generateEmbeddings: false,
    })
  }
  
  if (isGenerating && progress) {
    return <GenerationProgress progress={progress} />
  }
  
  if (error) {
    return <ErrorDisplay error={error} onRetry={handleGenerate} />
  }
  
  if (!overview) {
    return (
      <EmptyState
        title="No overview generated"
        description="Generate an AI-powered overview of this conversation"
        action={<Button onClick={handleGenerate}>Generate Overview</Button>}
      />
    )
  }
  
  return (
    <div className="enhanced-overview">
      <OverviewHeader
        title={overview.title}
        summary={overview.summary}
        onExport={(format) => exportOverview(format)}
        onRegenerate={handleGenerate}
        onSettings={() => setShowSettings(true)}
      />
      
      <div className="overview-content">
        <SectionNav
          sections={overview.sections}
          selectedId={selectedSection}
          onSelect={setSelectedSection}
        />
        
        <SectionContent
          section={overview.sections.find(s => s.id === selectedSection) || overview.sections[0]}
          onRegenerateSection={regenerateSection}
        />
      </div>
      
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
```

### Section Navigation

```tsx
// renderer/components/overview/SectionNav.tsx

type Props = {
  sections: OverviewSection[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function SectionNav({ sections, selectedId, onSelect }: Props) {
  return (
    <nav className="section-nav">
      {sections.map((section) => (
        <button
          key={section.id}
          className={cn(
            'section-nav-item',
            selectedId === section.id && 'active',
            `importance-${section.importance}`
          )}
          onClick={() => onSelect(section.id)}
        >
          <SectionIcon type={section.type} />
          <span>{section.title}</span>
          {section.diagrams.length > 0 && <DiagramBadge count={section.diagrams.length} />}
        </button>
      ))}
    </nav>
  )
}
```

### Generation Progress

```tsx
// renderer/components/overview/GenerationProgress.tsx

type Props = {
  progress: GenerationProgress
}

export function GenerationProgress({ progress }: Props) {
  const phaseLabels = {
    ingestion: 'Analyzing conversation...',
    structure: 'Creating structure...',
    sections: 'Generating content...',
    diagrams: 'Creating diagrams...',
    postprocess: 'Finalizing...',
  }
  
  return (
    <div className="generation-progress">
      <div className="progress-header">
        <Spinner />
        <span>{phaseLabels[progress.phase]}</span>
      </div>
      
      <ProgressBar value={progress.progress} />
      
      <div className="progress-details">
        <span>{progress.currentStep}</span>
        {progress.sectionsTotal && (
          <span>
            Section {progress.sectionsCompleted} of {progress.sectionsTotal}
          </span>
        )}
      </div>
    </div>
  )
}
```

---

## Settings and Configuration UI

### Overview Settings Panel

```tsx
// renderer/components/settings/OverviewSettings.tsx

export function OverviewSettings() {
  const [settings, setSettings] = useOverviewSettings()
  
  return (
    <SettingsSection title="Overview Generation">
      <SettingsItem
        label="Generate diagrams automatically"
        description="Create Mermaid diagrams for architecture and flows"
      >
        <Toggle
          checked={settings.generateDiagrams}
          onChange={(v) => setSettings({ ...settings, generateDiagrams: v })}
        />
      </SettingsItem>
      
      <SettingsItem
        label="Maximum sections"
        description="Limit the number of sections in generated overviews"
      >
        <Slider
          min={4}
          max={12}
          value={settings.maxSections}
          onChange={(v) => setSettings({ ...settings, maxSections: v })}
        />
      </SettingsItem>
      
      <SettingsItem
        label="Store embeddings for retrieval"
        description="Enable semantic search across conversations (uses more storage)"
      >
        <Toggle
          checked={settings.storeEmbeddings}
          onChange={(v) => setSettings({ ...settings, storeEmbeddings: v })}
        />
      </SettingsItem>
      
      <SettingsItem
        label="Storage usage"
        description="Current embedding storage usage"
      >
        <StorageUsageBar
          used={settings.storageUsed}
          max={settings.storageMax}
          onCleanup={() => cleanupStorage()}
        />
      </SettingsItem>
    </SettingsSection>
  )
}
```

---

## Error Handling

### Error Types

```typescript
// main/services/types/errors.ts

export class OverviewGenerationError extends Error {
  constructor(
    message: string,
    public phase: string,
    public recoverable: boolean,
    public cause?: Error
  ) {
    super(message)
    this.name = 'OverviewGenerationError'
  }
}

export class TokenLimitError extends OverviewGenerationError {
  constructor(phase: string, tokensRequired: number, tokensAvailable: number) {
    super(
      `Token limit exceeded: required ${tokensRequired}, available ${tokensAvailable}`,
      phase,
      true
    )
    this.name = 'TokenLimitError'
  }
}

export class DiagramValidationError extends OverviewGenerationError {
  constructor(mermaidCode: string, parseError: string) {
    super(
      `Invalid Mermaid syntax: ${parseError}`,
      'diagrams',
      true
    )
    this.name = 'DiagramValidationError'
  }
}
```

### Error Recovery

```typescript
async function generateWithRecovery(
  conversation: ConversationInput,
  options: GenerationOptions,
  onProgress: ProgressCallback
): Promise<OverviewStructure> {
  try {
    return await generateEnhancedOverview(conversation, options, onProgress)
  } catch (err) {
    if (err instanceof TokenLimitError) {
      // Retry with more aggressive truncation
      return await generateEnhancedOverview(conversation, {
        ...options,
        tokenBudget: options.tokenBudget ? options.tokenBudget * 0.7 : 6000,
      }, onProgress)
    }
    
    if (err instanceof DiagramValidationError) {
      // Retry without diagrams
      return await generateEnhancedOverview(conversation, {
        ...options,
        generateDiagrams: false,
      }, onProgress)
    }
    
    throw err
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/turn-parser.test.ts

describe('TurnParser', () => {
  it('extracts code blocks with language', () => {
    const bubble = { type: 'ai', text: '```typescript\nconst x = 1\n```' }
    const turn = parseTurn(bubble, 0)
    expect(turn.codeBlocks).toHaveLength(1)
    expect(turn.codeBlocks[0].language).toBe('typescript')
  })
  
  it('identifies high importance turns with code', () => {
    const bubble = { type: 'ai', text: '```ts\n// 10 lines of code\n```'.repeat(2) }
    const turn = parseTurn(bubble, 0)
    expect(turn.importance).toBe('high')
  })
  
  it('extracts file references', () => {
    const bubble = { type: 'user', text: 'Check src/components/Button.tsx' }
    const turn = parseTurn(bubble, 0)
    expect(turn.fileRefs).toHaveLength(1)
    expect(turn.fileRefs[0].path).toBe('src/components/Button.tsx')
  })
})
```

### Integration Tests

```typescript
// __tests__/overview-generation.test.ts

describe('Overview Generation', () => {
  it('generates complete overview for sample conversation', async () => {
    const conversation = loadTestConversation('pagination-feature')
    
    const overview = await generateEnhancedOverview(conversation, {
      generateDiagrams: true,
    })
    
    expect(overview.title).toBeTruthy()
    expect(overview.sections.length).toBeGreaterThanOrEqual(4)
    expect(overview.sections.some(s => s.type === 'goal')).toBe(true)
    expect(overview.sections.some(s => s.type === 'implementation')).toBe(true)
  })
  
  it('handles very long conversations with truncation', async () => {
    const conversation = loadTestConversation('long-debugging-session')
    
    const overview = await generateEnhancedOverview(conversation, {
      tokenBudget: 8000,
    })
    
    expect(overview.metadata.truncatedTurns).toBeGreaterThan(0)
    expect(overview.sections).toBeTruthy()
  })
})
```

---

## Summary

| Layer | Files | Purpose |
|-------|-------|---------|
| Agent | `enhanced-overview-agent.ts` | Main orchestration |
| Parser | `turn-parser.ts` | Bubble → DialogTurn |
| Scorer | `importance-scorer.ts` | Turn importance |
| Diagram | `diagram-agent.ts` | Mermaid generation |
| Learnings | `learnings-agent.ts` | Concept extraction |
| Export | `export-agent.ts` | MD/JSON export |
| IPC | `background.ts` (additions) | Electron handlers |
| Hooks | `useEnhancedOverview.ts` | React state |
| UI | `EnhancedOverviewPanel.tsx` | Main component |
