import { runGeminiPrompt } from './agent-runtime'
import {
  createConversationOverview,
  createOverviewSession,
  updateOverviewSession,
  getOverviewByConversation,
  getActiveOverviewSession,
  getOverviewSession,
  getApiKey,
  type ConversationOverviewRecord,
  type OverviewSessionRecord,
} from './agent-storage'

const DEFAULT_MODEL = 'gemini-2.0-flash'

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

type ConversationInput = {
  workspaceId: string
  conversationId: string
  title: string
  bubbles: ConversationBubble[]
}

type ProcessingResult = {
  overview: ConversationOverviewRecord
  session: OverviewSessionRecord
}

type OverviewData = {
  title: string
  summary: string
  topics: string[]
  content: string
}

function formatBubblesAsText(bubbles: ConversationBubble[]): string {
  return bubbles
    .map((b) => `[${b.type.toUpperCase()}]: ${b.text}`)
    .join('\n\n')
}

const OVERVIEW_PROMPT = `You are creating a comprehensive, well-researched overview of a coding conversation. This overview helps developers understand and learn from the discussion.

Your output must be VALID JSON with this structure:
{
  "title": "Concise title capturing the main goal (max 60 chars)",
  "summary": "1-2 sentence high-level overview of what was accomplished",
  "topics": ["Topic1", "Topic2", "Topic3"],
  "content": "Full markdown content here..."
}

## Guidelines

### title
- Capture the main goal, feature, or problem being addressed
- Be specific, not generic (e.g., "Building Real-time Chat with WebSockets" not "Chat Feature")

### summary  
- 1-2 sentences only
- Focus on outcome: what was built, solved, or learned

### topics
- 3-5 in-depth topics only (not a laundry list)
- Focus on core technologies and concepts actually discussed
- Examples: "React Server Components", "WebSocket Architecture", "State Management with Zustand"

### content (IMPORTANT - This is the main body)
Generate rich, well-structured markdown. You have full freedom to include whatever is relevant:

**Use these markdown features as appropriate:**

1. **Mermaid diagrams** - for architecture, flows, or processes:
\`\`\`mermaid
flowchart LR
    A[User] --> B[API]
    B --> C[Database]
\`\`\`

2. **Tables** - for file changes, decisions, comparisons:
| File | Change | Purpose |
|------|--------|---------|
| api.ts | Created | API endpoints |

3. **Code blocks** - for key snippets worth remembering:
\`\`\`typescript
// Important pattern used
const example = ...
\`\`\`

4. **Headers** - organize naturally with ## and ###

5. **Lists** - for steps, outcomes, or learnings

**Adapt to conversation type:**
- Feature build → Show what was built, architecture, key code
- Debugging → Show the problem, investigation, solution
- Q&A/Learning → Focus on concepts explained, examples given
- Refactoring → Show before/after, decisions made

**Always include (when relevant):**
- What was built or accomplished
- Key decisions and why
- Important code patterns or snippets
- Files created/modified
- Gotchas or things to remember

Return ONLY valid JSON. Escape any quotes in the content field properly.

---
CONVERSATION TITLE: "{{TITLE}}"

CONVERSATION:
{{CONTENT}}
`

function parseOverviewResponse(content: string): OverviewData | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    
    if (!parsed.title || !parsed.summary || !parsed.content) {
      return null
    }
    
    return {
      title: String(parsed.title).slice(0, 100),
      summary: String(parsed.summary).slice(0, 500),
      topics: (parsed.topics || []).slice(0, 8).map((t: unknown) => String(t)),
      content: String(parsed.content),
    }
  } catch {
    return null
  }
}

export async function startOverviewSession(
  conversation: ConversationInput,
  onProgress?: (session: OverviewSessionRecord) => void
): Promise<ProcessingResult> {
  const existingSession = getActiveOverviewSession(conversation.workspaceId, conversation.conversationId)
  if (existingSession) {
    throw new Error('An overview session is already in progress for this conversation')
  }

  const apiKey = getApiKey('google')
  if (!apiKey?.secret) {
    throw new Error('Google API key not configured. Please add your API key in settings.')
  }

  const session = createOverviewSession({
    workspaceId: conversation.workspaceId,
    conversationId: conversation.conversationId,
  })

  try {
    updateOverviewSession({ id: session.id, status: 'processing', currentStep: 'analyzing', progress: 10 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const conversationText = formatBubblesAsText(conversation.bubbles)
    
    updateOverviewSession({ id: session.id, currentStep: 'extracting', progress: 30 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const prompt = OVERVIEW_PROMPT
      .replace('{{TITLE}}', conversation.title)
      .replace('{{CONTENT}}', conversationText.slice(0, 80000))

    updateOverviewSession({ id: session.id, currentStep: 'generating', progress: 50 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const { content } = await runGeminiPrompt(prompt, {
      model: DEFAULT_MODEL,
      temperature: 0.4,
      maxOutputTokens: 8192,
    })

    updateOverviewSession({ id: session.id, currentStep: 'finalizing', progress: 80 })
    if (onProgress) {
      const s = getOverviewSession(session.id)
      if (s) onProgress(s)
    }

    const overviewData = parseOverviewResponse(content)
    
    if (!overviewData) {
      throw new Error('Failed to parse overview response from AI')
    }

    const overview = createConversationOverview({
      workspaceId: conversation.workspaceId,
      conversationId: conversation.conversationId,
      title: overviewData.title,
      summary: overviewData.summary,
      topics: overviewData.topics,
      content: overviewData.content,
      modelUsed: DEFAULT_MODEL,
      metadata: {
        bubbleCount: conversation.bubbles.length,
        originalTitle: conversation.title,
      },
    })

    const updatedSession = updateOverviewSession({
      id: session.id,
      status: 'completed',
      progress: 100,
      overviewId: overview.id,
    })

    return {
      overview,
      session: updatedSession || session,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    updateOverviewSession({
      id: session.id,
      status: 'failed',
      error: errorMessage,
    })

    throw error
  }
}

export async function cancelOverviewSession(sessionId: string): Promise<OverviewSessionRecord | null> {
  const session = getOverviewSession(sessionId)
  if (!session) return null

  if (session.status !== 'pending' && session.status !== 'processing') {
    return session
  }

  return updateOverviewSession({
    id: sessionId,
    status: 'cancelled',
  })
}

export function getOverviewForConversation(
  workspaceId: string,
  conversationId: string
): ConversationOverviewRecord | null {
  return getOverviewByConversation(workspaceId, conversationId)
}

export function getSessionStatus(sessionId: string): OverviewSessionRecord | null {
  return getOverviewSession(sessionId)
}

export function getActiveSession(
  workspaceId: string,
  conversationId: string
): OverviewSessionRecord | null {
  return getActiveOverviewSession(workspaceId, conversationId)
}

export function checkApiKeyAvailable(): boolean {
  const apiKey = getApiKey('google')
  return Boolean(apiKey?.secret)
}

export { type ConversationInput, type ProcessingResult, type OverviewData }
