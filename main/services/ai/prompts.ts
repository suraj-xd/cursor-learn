import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { app } from 'electron'

function getPromptsDir(): string {
  const isProd = process.env.NODE_ENV === 'production' || app?.isPackaged
  
  if (isProd) {
    const appPath = app?.getAppPath?.() || process.cwd()
    return join(appPath, 'main', 'services', 'ai', 'prompts')
  }
  
  return join(__dirname, 'prompts')
}

function loadPrompt(filename: string): string {
  const candidates = [
    join(getPromptsDir(), filename),
    join(dirname(__dirname), 'ai', 'prompts', filename),
    join(process.cwd(), 'main', 'services', 'ai', 'prompts', filename),
  ]

  for (const filePath of candidates) {
    try {
      if (existsSync(filePath)) {
        return readFileSync(filePath, 'utf-8').trim()
      }
    } catch {
      continue
    }
  }

  console.warn(`Prompt file not found: ${filename}`)
  return ''
}

export const CHAT_SYSTEM_PROMPT = loadPrompt('chat-system.md')
export const TITLE_PROMPT = loadPrompt('title.md')
export const SUMMARIZATION_PROMPT = loadPrompt('summarization.md')
export const COMPACT_MAP_PROMPT = loadPrompt('compact-map.md')
export const COMPACT_REDUCE_PROMPT = loadPrompt('compact-reduce.md')
export const COMPACT_FULL_CONTEXT_PROMPT = loadPrompt('compact-full.md')
export const SUGGESTIONS_PROMPT = loadPrompt('suggestions.md')
export const OVERVIEW_PROMPT = loadPrompt('overview.md')
export const OVERVIEW_STRUCTURE_PROMPT = loadPrompt('overview-structure.md')
export const OVERVIEW_SECTION_PROMPT = loadPrompt('overview-section.md')
export const DIAGRAM_ARCHITECTURE_PROMPT = loadPrompt('diagram-architecture.md')
export const DIAGRAM_FLOW_PROMPT = loadPrompt('diagram-flow.md')
export const LEARNINGS_EXTRACT_PROMPT = loadPrompt('learnings-extract.md')
export const RESOURCES_ANALYSIS_PROMPT = loadPrompt('resources-analysis.md')
export const RESOURCES_GENERATE_PROMPT = loadPrompt('resources-generate.md')

export function buildTitlePrompt(userMessage: string): string {
  return `${TITLE_PROMPT}\n\nMessage: "${userMessage.slice(0, 500)}"`
}

export function buildSummarizationPrompt(title: string, conversationText: string): string {
  return `${SUMMARIZATION_PROMPT}\n\nChat Title: "${title}"\n\nConversation:\n${conversationText.slice(0, 12000)}`
}

export function buildCompactMapPrompt(title: string, segmentIndex: number, totalSegments: number, content: string): string {
  return `${COMPACT_MAP_PROMPT}\n\n---\nConversation Title: "${title}"\nSegment ${segmentIndex} of ${totalSegments}\n\n${content}`
}

export function buildCompactReducePrompt(title: string, segmentSummaries: string): string {
  return `${COMPACT_REDUCE_PROMPT}\n\n---\nOriginal Title: "${title}"\n\n${segmentSummaries}`
}

export function buildCompactFullContextPrompt(title: string, conversationText: string): string {
  return `${COMPACT_FULL_CONTEXT_PROMPT}\n\n---\nTitle: "${title}"\n\n${conversationText}`
}

export function buildSuggestionsPrompt(content: string): string {
  return `${SUGGESTIONS_PROMPT}\n\n---\nCONVERSATION SUMMARY:\n${content}`
}

export function buildOverviewPrompt(title: string, conversationText: string): string {
  return `${OVERVIEW_PROMPT}\n\n---\nCONVERSATION TITLE: "${title}"\n\nCONVERSATION:\n${conversationText.slice(0, 80000)}`
}

export function buildOverviewStructurePrompt(title: string, conversationText: string): string {
  return `${OVERVIEW_STRUCTURE_PROMPT}\n\nCONVERSATION TITLE: "${title}"\n\nCONVERSATION:\n${conversationText.slice(0, 80000)}`
}

export function buildResourcesAnalysisPrompt(title: string, conversationText: string): string {
  return `${RESOURCES_ANALYSIS_PROMPT}\n\nCONVERSATION TITLE: "${title}"\n\nCONVERSATION:\n${conversationText.slice(0, 40000)}\n\nAnalyze this Cursor AI chat conversation now and output JSON.`
}

export function buildResourcesGeneratePrompt(analysis: {
  coreProblem: string
  solutionApproach: string
  conceptsUsed: string[]
  knowledgeGaps: string[]
  implementationDetails: string[]
  skillLevel: string
  technologies: string[]
}): string {
  return `${RESOURCES_GENERATE_PROMPT}

THE USER'S SITUATION:
- Problem they solved: ${analysis.coreProblem}
- Solution approach used: ${analysis.solutionApproach}
- Key concepts in the solution: ${analysis.conceptsUsed.join(', ') || 'programming concepts'}
- What they might not fully understand: ${analysis.knowledgeGaps.join(', ') || 'deeper understanding needed'}
- Implementation details to learn: ${analysis.implementationDetails.join(', ') || 'implementation details'}
- Skill level: ${analysis.skillLevel}
- Technologies involved: ${analysis.technologies.join(', ') || 'general programming'}

JSON only.`
}
