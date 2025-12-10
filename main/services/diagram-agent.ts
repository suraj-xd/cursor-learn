import { randomUUID } from 'node:crypto'
import { generate } from './ai/helpers'
import { DIAGRAM_ARCHITECTURE_PROMPT, DIAGRAM_FLOW_PROMPT } from './ai/prompts'
import type { DiagramSpec, DiagramType } from './types/overview-structure'

type DiagramOptions = {
  type: DiagramType
  conversationExcerpt: string
}

const PROMPT_MAP: Record<DiagramType, string> = {
  architecture: DIAGRAM_ARCHITECTURE_PROMPT,
  flowchart: DIAGRAM_FLOW_PROMPT,
  sequence: DIAGRAM_FLOW_PROMPT,
  component: DIAGRAM_ARCHITECTURE_PROMPT,
  state: DIAGRAM_FLOW_PROMPT,
}

export async function generateDiagram({
  type,
  conversationExcerpt,
}: DiagramOptions): Promise<DiagramSpec> {
  const promptTemplate = PROMPT_MAP[type] ?? DIAGRAM_FLOW_PROMPT
  const prompt = promptTemplate.replace('{conversation_excerpt}', conversationExcerpt)

  const result = await generate({
    prompt,
    temperature: 0.2,
    maxTokens: 1000,
    role: 'overview',
  })

  const mermaid = extractMermaid(result.content)
  if (!mermaid) {
    throw new Error('Failed to generate diagram')
  }

  return {
    id: randomUUID(),
    type,
    mermaidCode: mermaid,
    sectionId: '',
    caption: undefined,
    cachedSvg: undefined,
  }
}

function extractMermaid(content: string): string | null {
  const match = content.match(/```mermaid\s+([\s\S]*?)```/i)
  if (match && match[1]) return match[1].trim()
  if (content.trim().startsWith('flowchart')) return content.trim()
  return null
}
