import { randomUUID } from 'node:crypto'
import { generate } from './ai/helpers'
import { buildOverviewStructurePrompt, OVERVIEW_SECTION_PROMPT } from './ai/prompts'
import { hasAnyApiKey } from './ai/providers'
import { saveOverviewStructure, saveParsedConversation } from './agent-storage'
import { parseConversation, type ConversationBubble } from './turn-parser'
import { estimateTokens } from './compact-agent'
import type { DialogTurn, ParsedConversation } from './types/dialog-turn'
import type { OverviewStructure, OverviewSection, SectionType, DiagramSpec } from './types/overview-structure'
import { generateDiagram } from './diagram-agent'

export type GenerationOptions = {
  generateDiagrams?: boolean
  maxSections?: number
  tokenBudget?: number
  parallelSections?: number
}

export type GenerationProgress = {
  phase: 'ingestion' | 'structure' | 'sections' | 'diagrams' | 'postprocess'
  progress: number
  currentStep: string
  sectionsCompleted?: number
  sectionsTotal?: number
}

type StructureSection = {
  id: string
  title: string
  type: SectionType
  description: string
  importance: 'high' | 'medium' | 'low'
  relevantTurnIndices: number[]
}

type StructureResult = {
  title: string
  summary: string
  sections: StructureSection[]
}

const DEFAULT_CONFIG = {
  structureInputTokens: 8000,
  sectionInputTokens: 6000,
  parallelSections: 3,
  generateDiagrams: true,
}

export async function generateEnhancedOverview(
  input: {
    workspaceId: string
    conversationId: string
    title: string
    bubbles: ConversationBubble[]
  },
  options: GenerationOptions = {},
  onProgress?: (progress: GenerationProgress) => void
): Promise<OverviewStructure> {
  if (!hasAnyApiKey()) {
    throw new Error('No API key configured. Please add your API key in settings.')
  }

  onProgress?.({ phase: 'ingestion', progress: 5, currentStep: 'parse' })

  const parsed = parseConversation(input.workspaceId, input.conversationId, input.title, input.bubbles)
  saveParsedConversation(parsed)

  const strategy = buildFallbackStrategy(options)
  let overview: OverviewStructure | null = null

  for (const attempt of strategy) {
    const truncatedForStructure = truncateForBudget(parsed.turns, attempt.tokenBudget)

    onProgress?.({ phase: 'structure', progress: 15, currentStep: `structure:${attempt.tokenBudget}` })

    const structurePrompt = buildOverviewStructurePrompt(input.title, formatTurnsAsText(truncatedForStructure))

    const structureRaw = await generate({
      prompt: structurePrompt,
      temperature: 0.2,
      maxTokens: 2000,
      role: 'overview',
    })

    const structure = parseStructureXml(structureRaw.content)
    if (!structure) {
      continue
    }

    onProgress?.({ phase: 'sections', progress: 35, currentStep: 'sections:start' })

    const sections = await generateSections(
      structure,
      parsed,
      options.parallelSections,
      attempt.tokenBudget,
      options.maxSections,
      onProgress
    )

    if (attempt.generateDiagrams) {
      onProgress?.({ phase: 'diagrams', progress: 80, currentStep: 'diagrams:start' })
      await maybeGenerateDiagrams(sections, parsed, attempt.tokenBudget)
    }

    overview = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      title: structure.title || input.title,
      summary: structure.summary,
      sections,
      metadata: {
        totalTurns: parsed.turns.length,
        processedTurns: truncatedForStructure.length,
        truncatedTurns: parsed.turns.length - truncatedForStructure.length,
        tokenBudgetUsed: estimateTokens(structureRaw.content),
        generationTimeMs: 0,
        modelUsed: structureRaw.model,
        structureVersion: 1,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    break
  }

  if (!overview) {
    throw new Error('Failed to generate overview after fallbacks')
  }

  saveOverviewStructure(overview)
  onProgress?.({ phase: 'postprocess', progress: 100, currentStep: 'done' })
  return overview
}

async function generateSections(
  structure: StructureResult,
  parsed: ParsedConversation,
  parallel: number | undefined,
  tokenBudget: number,
  maxSections: number | undefined,
  onProgress?: (progress: GenerationProgress) => void
): Promise<OverviewSection[]> {
  const limiter = createLimiter(parallel ?? DEFAULT_CONFIG.parallelSections)
  const limitedSections = maxSections ? structure.sections.slice(0, maxSections) : structure.sections

  const results = await Promise.all(
    limitedSections.map((section, idx) =>
      limiter(() => generateSectionContent(section, idx, parsed, DEFAULT_CONFIG.sectionInputTokens, tokenBudget))
    )
  )

  onProgress?.({
    phase: 'sections',
    progress: 75,
    currentStep: 'sections:complete',
    sectionsCompleted: results.length,
    sectionsTotal: limitedSections.length,
  })

  return results.sort((a, b) => a.order - b.order)
}

async function generateSectionContent(
  section: StructureSection,
  order: number,
  parsed: ParsedConversation,
  sectionTokenBudget: number,
  conversationBudget: number
): Promise<OverviewSection> {
  const relevantTurns = pickRelevantTurns(parsed.turns, section.relevantTurnIndices, conversationBudget)
  const relevantText = formatTurnsAsText(relevantTurns)

  const prompt = OVERVIEW_SECTION_PROMPT.replace('{section_title}', section.title)
    .replace('{section_type}', section.type)
    .replace('{section_description}', section.description || section.title)
    .replace('{relevant_turns}', relevantText || 'No relevant turns provided.')

  const result = await generate({
    prompt,
    temperature: 0.3,
    maxTokens: 4000,
    role: 'overview',
  })

  const sectionId = randomUUID()
  const diagrams = extractMermaidDiagrams(result.content, sectionId)

  return {
    id: sectionId,
    order,
    type: section.type,
    title: section.title,
    description: section.description,
    content: result.content.trim(),
    codeSnippets: [],
    diagrams,
    citations: extractCitations(relevantTurns),
    importance: section.importance,
    relevantTurnIds: section.relevantTurnIndices.map((i) => parsed.turns[i]?.id).filter(Boolean),
    tokenCount: result.usage.totalTokens,
    generatedAt: Date.now(),
  }
}

async function maybeGenerateDiagrams(
  sections: OverviewSection[],
  parsed: ParsedConversation,
  tokenBudget: number
): Promise<void> {
  await Promise.all(
    sections.map(async (section) => {
      if (section.diagrams.length > 0) return
      if (section.type !== 'diagram') return

      const relevantTurns = pickRelevantTurns(parsed.turns, section.citations.map((c) => c.turnIndex), tokenBudget)
      const excerpt = formatTurnsAsText(relevantTurns)

      try {
        const diagram = await generateDiagram({
          type: 'flowchart',
          conversationExcerpt: excerpt,
        })
        section.diagrams.push({ ...diagram, sectionId: section.id })
      } catch {
        // swallow diagram failures
      }
    })
  )
}

function truncateForBudget(turns: DialogTurn[], budget: number): DialogTurn[] {
  let total = turns.reduce((sum, t) => sum + t.tokenCount, 0)
  if (total <= budget) return turns

  const preserved = new Set<number>()
  for (let i = 0; i < Math.min(3, turns.length); i++) preserved.add(i)
  for (let i = Math.max(0, turns.length - 5); i < turns.length; i++) preserved.add(i)

  const sorted = turns.map((t, idx) => ({ t, idx }))
    .sort((a, b) => {
      const imp = importanceWeight(b.t.importance) - importanceWeight(a.t.importance)
      if (imp !== 0) return imp
      return b.t.importanceScore - a.t.importanceScore
    })

  const keep = new Set<number>(preserved)
  for (const { t, idx } of sorted) {
    if (keep.has(idx)) continue
    if (total <= budget) break
    keep.add(idx)
    total -= t.tokenCount
  }

  const kept = turns
    .map((t, idx) => ({ t, idx }))
    .filter(({ idx }) => keep.has(idx))
    .sort((a, b) => a.idx - b.idx)
    .map(({ t }) => t)

  return kept
}

function importanceWeight(level: DialogTurn['importance']): number {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  return 1
}

function formatTurnsAsText(turns: DialogTurn[]): string {
  return turns
    .map((t) => `[Turn ${t.index}] [${t.role.toUpperCase()}]: ${t.content}`)
    .join('\n\n')
}

function parseStructureXml(raw: string): StructureResult | null {
  const clean = raw.trim()
  const titleMatch = clean.match(/<title>([\s\S]*?)<\/title>/i)
  const summaryMatch = clean.match(/<summary>([\s\S]*?)<\/summary>/i)
  const sectionRegex =
    /<section[^>]*id="([^"]+)"[^>]*type="([^"]+)"[^>]*importance="([^"]+)"[^>]*>\s*<title>([\s\S]*?)<\/title>\s*<description>([\s\S]*?)<\/description>\s*<relevant_turns>([\s\S]*?)<\/relevant_turns>\s*<\/section>/gi

  const sections: StructureSection[] = []
  let match: RegExpExecArray | null
  while ((match = sectionRegex.exec(clean)) !== null) {
    const [, id, type, importance, title, description, turns] = match
    const indices = (turns || '')
      .split(',')
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => !Number.isNaN(n))
    sections.push({
      id,
      title: title.trim(),
      type: (type.trim() as SectionType) || 'context',
      description: description.trim(),
      importance: importance.trim() as 'high' | 'medium' | 'low',
      relevantTurnIndices: indices,
    })
  }

  if (!sections.length) return null

  return {
    title: titleMatch?.[1]?.trim() || 'Overview',
    summary: summaryMatch?.[1]?.trim() || '',
    sections,
  }
}

function pickRelevantTurns(turns: DialogTurn[], indices: number[], budget: number): DialogTurn[] {
  const selected = indices
    .map((i) => turns[i])
    .filter(Boolean) as DialogTurn[]
  if (!selected.length) return turns.slice(0, Math.min(turns.length, 8))

  let total = selected.reduce((sum, t) => sum + t.tokenCount, 0)
  if (total <= budget) return selected

  return selected
    .sort((a, b) => importanceWeight(b.importance) - importanceWeight(a.importance))
    .reduce<DialogTurn[]>((acc, turn) => {
      const newTotal = acc.reduce((s, t) => s + t.tokenCount, 0) + turn.tokenCount
      if (newTotal <= budget) acc.push(turn)
      return acc
    }, [])
}

function extractCitations(turns: DialogTurn[]) {
  return turns.map((t) => ({
    turnId: t.id,
    turnIndex: t.index,
  }))
}

function extractMermaidDiagrams(content: string, sectionId: string): DiagramSpec[] {
  const diagrams: DiagramSpec[] = []
  const regex = /```mermaid\s+([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    diagrams.push({
      id: randomUUID(),
      type: 'flowchart',
      mermaidCode: match[1].trim(),
      sectionId,
    })
  }
  return diagrams
}

function createLimiter(limit: number) {
  let active = 0
  const queue: Array<() => void> = []

  const next = () => {
    const fn = queue.shift()
    if (fn) fn()
  }

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active--
            if (queue.length > 0 && active < limit) {
              next()
            }
          })
      }

      if (active < limit) {
        run()
      } else {
        queue.push(run)
      }
    })
  }
}

function buildFallbackStrategy(options: GenerationOptions) {
  const generateDiagrams =
    options.generateDiagrams === undefined ? DEFAULT_CONFIG.generateDiagrams : options.generateDiagrams
  const base = options.tokenBudget ?? DEFAULT_CONFIG.structureInputTokens
  return [
    { tokenBudget: base, generateDiagrams },
    { tokenBudget: Math.min(base, 6000), generateDiagrams },
    { tokenBudget: Math.min(base, 4000), generateDiagrams: false },
    { tokenBudget: Math.min(base, 2000), generateDiagrams: false },
  ]
}
