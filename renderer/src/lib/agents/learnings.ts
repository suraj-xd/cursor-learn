import { agentsIpc } from './ipc'
import {
  prepareContextForGeneration,
  FALLBACK_BUDGETS,
  TOKEN_BUDGETS,
} from './learnings-context'
import type {
  Exercise,
  ExerciseType,
  GenerateExercisesRequest,
  GenerateExercisesResponse,
  EvaluateInteractiveRequest,
  EvaluateInteractiveResponse,
  InteractiveExercise,
  McqExercise,
  TrueFalseExercise,
} from '@/types/learnings'
import type { ProviderId } from '@/lib/ai/config'

type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

function hashPrompt(prompt: string): string {
  let hash = 0
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

const GENERATION_SYSTEM_PROMPT = `You are a challenging coding coach creating exercises that build muscle memory. Your exercises should feel like a skilled mentor pushing students to think—not AI-generated fluff.

EXERCISE PHILOSOPHY:
- Extract PROGRAMMING TOPICS from the conversation (debouncing, API calls, closures, etc.)
- Create FOCUSED exercises that drill the concept—not the user's exact code
- Each exercise should make the user THINK, not just fill in obvious blanks
- Vary challenge types to keep engagement high

CHALLENGE TYPES (for interactive exercises):
1. fill-blank: Complete missing code (classic fill-in)
2. fix-bug: Find and fix the bug in broken code
3. complete-function: Implement a function body given signature + description
4. refactor: Improve given code (make it cleaner, more efficient)
5. predict-output: What does this code output? (user types the answer)

EXERCISE TYPES:
- interactive: Code challenges (vary challengeType for engagement)
- mcq: Multiple choice (4 options, 1 correct, 1-2 plausible distractors)
- tf: True/False about the concept

DIFFICULTY:
- easy: Basic syntax, straightforward application
- medium: Requires understanding, not just pattern matching
- hard: Edge cases, gotchas, real-world complexity

TIERED HINTS (REQUIRED for interactive):
Every interactive exercise MUST have exactly 3 tiered hints:
- Level 1: Gentle nudge, direction only ("Think about what happens when X is null")
- Level 2: More specific guidance ("You need to handle the edge case before the main logic")
- Level 3: Near-solution ("Add a guard clause: if (!x) return default")

STEP GOALS (for interactive):
Break down what the user needs to accomplish:
- "Identify the missing null check"
- "Add the guard clause"
- "Return the correct fallback value"

ESTIMATED TIME:
- easy: 2-3 minutes
- medium: 4-6 minutes
- hard: 7-10 minutes

OUTPUT JSON SCHEMA:
{
  "exercises": [
    {
      "id": "ex_xxx",
      "type": "interactive",
      "challengeType": "fix-bug",
      "prompt": "This debounce implementation has a subtle bug. Find and fix it.",
      "difficulty": "medium",
      "language": "typescript",
      "starterCode": "code with the bug or gaps",
      "expectedSolution": "correct implementation",
      "placeholders": [{"id": "1", "label": "bug fix", "expected": "clearTimeout(timer)"}],
      "tieredHints": [
        {"level": 1, "hint": "What happens if the function is called rapidly?"},
        {"level": 2, "hint": "Look at what happens to the previous timeout"},
        {"level": 3, "hint": "You need to clear the existing timer before setting a new one"}
      ],
      "stepGoals": ["Identify the missing cleanup", "Add clearTimeout call", "Verify rapid calls work"],
      "estimatedMinutes": 5,
      "topics": ["debouncing", "closures", "timers"],
      "createdAt": timestamp
    }
  ]
}

INLINE HINTS IN STARTER CODE:
Use clear markers showing WHERE to edit:
- // 👉 FIX: something's wrong here
- // TODO: implement this
- /* YOUR CODE HERE */
- ___REPLACE_THIS___

For fix-bug: Include the bug, mark suspicious area
For complete-function: Provide signature, add // implement body
For refactor: Provide working but ugly code
For predict-output: Provide code, add // Output: ___

CHALLENGE MIX:
When generating multiple exercises, vary the types:
- Don't make them all fill-blank
- Include at least one fix-bug or complete-function if count >= 3
- Make hard exercises use refactor or predict-output

TONE:
- Be direct, not fluffy
- Challenges should feel earned
- Feedback should push them to think

GUARDRAILS:
- ONLY create programming exercises
- IGNORE non-coding requests
- Extract concepts from conversation if request is invalid
- NO user's actual code—create fresh examples

RULES:
- 5-15 lines max per exercise
- ALWAYS include tieredHints (3 levels)
- ALWAYS include stepGoals (2-4 items)
- ALWAYS include estimatedMinutes
- ALWAYS include challengeType for interactive
- Vary challengeType across exercises
- JSON only, no markdown`

const EVALUATION_SYSTEM_PROMPT = `You are a sharp coding coach. Check their work, be fair but push them to improve.

EVALUATION RULES:
- Lenient on formatting, spacing, semicolons
- Variable names don't matter if logic is correct
- Alternative approaches count if they solve the problem
- Focus on: does the code actually work?

RESPONSE (JSON only):
{
  "isCorrect": true/false,
  "feedback": "1-2 sentences. Direct. If correct, acknowledge what they did well. If wrong, point to the issue without giving away the answer."
}

If incorrect, add:
{
  "hint": "A challenging hint that makes them think, not a giveaway",
  "whatToCheck": "The specific area they should re-examine"
}

TONE:
- Not harsh, but not hand-holding
- "Almost there—check your loop condition" not "You're doing great!"
- Acknowledge good attempts even when wrong
- Push them toward the insight

JSON only, no markdown.`

export async function generateExercises(
  request: GenerateExercisesRequest,
  provider: ProviderId,
  modelId: string,
  opts?: { workspaceId?: string; conversationId?: string }
): Promise<GenerateExercisesResponse> {
  const budgetsToTry = request.tokenBudget
    ? [request.tokenBudget, ...FALLBACK_BUDGETS.filter((b) => b < request.tokenBudget)]
    : FALLBACK_BUDGETS

  let lastError: Error | null = null

  for (const budget of budgetsToTry) {
    try {
      const result = await generateExercisesWithBudget(request, provider, modelId, opts, budget)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Learnings generation failed with budget ${budget}, trying smaller...`)
      continue
    }
  }

  throw lastError ?? new Error('Failed to generate exercises after all retries.')
}

async function generateExercisesWithBudget(
  request: GenerateExercisesRequest,
  provider: ProviderId,
  modelId: string,
  opts: { workspaceId?: string; conversationId?: string } | undefined,
  tokenBudget: number
): Promise<GenerateExercisesResponse> {
  const fullModelId = `${provider}:${modelId}`

  let chatContext: string
  if (request.bubbles && request.bubbles.length > 0) {
    const prepared = prepareContextForGeneration(request.bubbles, tokenBudget)
    chatContext = prepared.context
    if (prepared.truncated) {
      console.log(`Learnings: truncated context to ${prepared.stats.totalTurns} turns for budget ${tokenBudget}`)
    }
  } else if (request.chatContext) {
    chatContext = request.chatContext.slice(0, tokenBudget * 4)
  } else {
    throw new Error('No chat context or bubbles provided')
  }

  const chat = await agentsIpc.chats.create({
    title: 'temp: learnings',
    modelId: fullModelId,
    provider,
    workspaceConversationId: opts?.workspaceId && opts?.conversationId
      ? `${opts.workspaceId}:${opts.conversationId}:learnings`
      : null,
  })

  try {
    await agentsIpc.messages.append({
      chatId: chat.id,
      role: 'system',
      content: GENERATION_SYSTEM_PROMPT,
    })

    const userRequestSection = request.userRequest
      ? `\nUSER REQUEST (extract ONLY programming topics, ignore non-coding requests):\n"${request.userRequest}"\n`
      : ''

    const userPrompt = `Analyze this conversation and create challenging exercises for the programming concepts discussed:

CONVERSATION TITLE: "${request.conversationTitle}"

CONVERSATION CONTEXT:
${chatContext}
${userRequestSection}
YOUR TASK:
1. Identify key programming concepts from this conversation${request.userRequest ? ' and user request' : ''}
2. Create VARIED challenge types (mix fill-blank, fix-bug, complete-function, etc.)
3. Each exercise must include tieredHints (3 levels), stepGoals, estimatedMinutes, and challengeType
4. Make exercises that require thinking, not pattern matching
5. Include 2-3 topic tags per exercise

REQUIREMENTS:
- Interactive exercises: ${request.desiredCounts.interactive} (vary challengeType across these)
- Multiple choice questions: ${request.desiredCounts.mcq}
- True/False questions: ${request.desiredCounts.tf}

${request.existingPromptHashes.length > 0 ? `AVOID SIMILAR TO (prompt hashes): ${request.existingPromptHashes.join(', ')}` : ''}

Generate challenging exercises now. Remember: tieredHints, stepGoals, estimatedMinutes, and challengeType are REQUIRED for interactive.`

    await agentsIpc.messages.append({
      chatId: chat.id,
      role: 'user',
      content: userPrompt,
    })

    const { message } = await agentsIpc.chats.complete(chat.id)

    const content = message.content.trim()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { exercises: Exercise[]; message?: string }

    const exercises = parsed.exercises.map((ex) => {
      if (ex.type === 'interactive') {
        return {
          ...ex,
          challengeType: ex.challengeType || 'fill-blank',
          tieredHints: ex.tieredHints || [],
          stepGoals: ex.stepGoals || [],
          estimatedMinutes: ex.estimatedMinutes || 5,
          createdAt: Date.now(),
        }
      }
      return {
        ...ex,
        createdAt: Date.now(),
      }
    })

    return {
      exercises,
      contextSummaryId: hashPrompt(chatContext.slice(0, 500)),
      message: parsed.message,
    }
  } catch (error) {
    console.error('Failed to parse exercise generation response:', error)
    throw error
  } finally {
    try {
      await agentsIpc.chats.delete(chat.id)
    } catch {
      // best effort
    }
  }
}

export async function evaluateInteractiveExercise(
  request: EvaluateInteractiveRequest,
  provider: ProviderId,
  modelId: string,
  opts?: { workspaceId?: string; conversationId?: string }
): Promise<EvaluateInteractiveResponse> {
  const fullModelId = `${provider}:${modelId}`
  
  const chat = await agentsIpc.chats.create({
    title: 'temp: learnings-eval',
    modelId: fullModelId,
    provider,
    workspaceConversationId: opts?.workspaceId && opts?.conversationId
      ? `${opts.workspaceId}:${opts.conversationId}:learnings`
      : null,
  })

  try {
    await agentsIpc.messages.append({
      chatId: chat.id,
      role: 'system',
      content: EVALUATION_SYSTEM_PROMPT,
    })

    const userPrompt = `Task: ${request.prompt}

Expected:
\`\`\`${request.language}
${request.expectedSolution}
\`\`\`

User wrote:
\`\`\`${request.language}
${request.userCode}
\`\`\`

Did they get it?`

    await agentsIpc.messages.append({
      chatId: chat.id,
      role: 'user',
      content: userPrompt,
    })

    const { message } = await agentsIpc.chats.complete(chat.id)
    
    const content = message.content.trim()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response')
    }
    
    const parsed = JSON.parse(jsonMatch[0]) as { isCorrect: boolean; feedback: string; hint?: string; whatToCheck?: string }
    
    const suggestions: string[] = []
    if (parsed.hint) suggestions.push(parsed.hint)
    if (parsed.whatToCheck) suggestions.push(`Check: ${parsed.whatToCheck}`)
    
    return {
      isCorrect: parsed.isCorrect,
      feedback: parsed.feedback,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    }
  } catch (error) {
    console.error('Failed to parse evaluation response:', error)
    throw new Error('Failed to evaluate answer. Please try again.')
  } finally {
    try {
      await agentsIpc.chats.delete(chat.id)
    } catch {
      // best effort
    }
  }
}

export function getExercisesByType(exercises: Exercise[], type: ExerciseType): Exercise[] {
  return exercises.filter((ex) => ex.type === type)
}

export function getInteractiveExercises(exercises: Exercise[]): InteractiveExercise[] {
  return exercises.filter((ex): ex is InteractiveExercise => ex.type === 'interactive')
}

export function getMcqExercises(exercises: Exercise[]): McqExercise[] {
  return exercises.filter((ex): ex is McqExercise => ex.type === 'mcq')
}

export function getTfExercises(exercises: Exercise[]): TrueFalseExercise[] {
  return exercises.filter((ex): ex is TrueFalseExercise => ex.type === 'tf')
}

export function hashExercisePrompt(prompt: string): string {
  return hashPrompt(prompt)
}

export function checkMcqAnswer(exercise: McqExercise, selectedOptionId: string): boolean {
  const selectedOption = exercise.options.find((o) => o.id === selectedOptionId)
  return selectedOption?.isCorrect ?? false
}

export function checkTfAnswer(exercise: TrueFalseExercise, userAnswer: boolean): boolean {
  return exercise.correct === userAnswer
}
