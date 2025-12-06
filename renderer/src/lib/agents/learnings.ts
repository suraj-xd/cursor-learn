import { agentsIpc } from './ipc'
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

function hashPrompt(prompt: string): string {
  let hash = 0
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

const GENERATION_SYSTEM_PROMPT = `You are an AI tutor creating educational exercises to help users learn programming concepts.

IMPORTANT - EXERCISE PHILOSOPHY:
- Extract the PROGRAMMING TOPICS and CONCEPTS from the conversation (e.g., debouncing, API calls, state management, closures)
- Create GENERAL, EDUCATIONAL examples that teach these concepts - NOT the user's actual code
- Think textbook-style exercises: clean, focused snippets that illustrate the concept
- If the user discussed debounce, create a simple debounce example - don't copy their implementation
- Focus on teaching the underlying concept with minimal, clear code

EXERCISE TYPES:
- interactive: Fill-in-the-blank code exercises (general examples teaching the concept)
- mcq: Multiple choice about the concept (4 options, 1 correct)
- tf: True/False statements about the concept

DIFFICULTY:
- easy: Basic understanding of the concept
- medium: Applying the concept
- hard: Edge cases, gotchas, deeper understanding

TOPICS (REQUIRED):
- Each exercise MUST include a "topics" array with 2-3 relevant programming topics
- Topics should be short, lowercase tags like: "closures", "async/await", "react hooks", "typescript generics"
- Pick the most relevant concepts being tested

INTERACTIVE EXERCISES - CRITICAL:
The starterCode MUST have clear inline hints showing WHERE to add code. Use comment syntax appropriate for the language:

For JavaScript/TypeScript:
\`\`\`
const user = {
  name: "John",
  // 👉 ADD AGE PROPERTY HERE
};
\`\`\`

For JSON:
\`\`\`
{
  "name": "app",
  "___ADD_VERSION_HERE___": ""
}
\`\`\`

For YAML:
\`\`\`
name: app
# 👉 add port config here
\`\`\`

For shell/commands:
\`\`\`
git commit -m "___WRITE_MESSAGE___"
\`\`\`

For CSS:
\`\`\`
.button {
  /* 👉 add hover color */
}
\`\`\`

HINT STYLES (pick what fits):
- Comments: // 👉 add X here, /* add X */, # add X
- Placeholders: ___ADD_X_HERE___, <ADD_X>, [YOUR_CODE]
- Be specific: "add className prop" not just "add code"

OUTPUT JSON:
{
  "exercises": [
    {
      "id": "ex_xxx",
      "type": "interactive",
      "prompt": "Add the missing age property",
      "difficulty": "easy",
      "language": "javascript",
      "starterCode": "code with inline hints",
      "expectedSolution": "complete correct code",
      "placeholders": [{"id": "1", "label": "age property", "expected": "age: 25"}],
      "topics": ["objects", "properties"],
      "createdAt": timestamp
    }
  ]
}

For MCQ: options array with {id, label, isCorrect}, explanation, topics
For TF: statement, correct (boolean), explanation, topics

HANDLING USER REQUESTS (GUARDRAILS):
If user provides a custom request, apply these rules strictly:
- ONLY extract programming/coding topics from their request
- IGNORE any non-programming requests, personal questions, or off-topic content
- If they ask for "jokes" or "stories", ignore it and focus on any programming concepts mentioned
- If no valid programming topic can be extracted, use topics from the conversation context instead
- Examples of valid topics: "recursion", "promises", "CSS grid", "SQL joins", "React state"
- Examples of INVALID requests to ignore: "tell me a joke", "what's the weather", "write my homework"

RULES:
- DO NOT copy user's actual code - create fresh, simple examples
- Extract concepts and create textbook-style learning exercises
- Keep code snippets SHORT (5-15 lines max) and focused on ONE concept
- Inline hints are REQUIRED for interactive exercises
- User should know exactly WHERE to type
- Concise explanations (1-2 sentences)
- No duplicates from existingPromptHashes
- ALWAYS include 2-3 topics per exercise

JSON only, no markdown.`

const EVALUATION_SYSTEM_PROMPT = `You are a chill coding buddy helping someone learn. Check if their answer makes sense conceptually.

VIBE:
- Super lenient on formatting, spacing, quotes, semicolons
- Variable names don't matter if logic is right
- Typos are fine if intent is clear
- Alternative solutions totally count
- Focus on: did they get the idea?

RESPONSE (JSON only):
{
  "isCorrect": true/false,
  "feedback": "1 short sentence, casual tone, encouraging"
}

If incorrect, add:
- "hint": "one quick tip to fix it"

Keep it light. Learning should feel good.
JSON only, no markdown.`

export async function generateExercises(
  request: GenerateExercisesRequest,
  provider: ProviderId,
  modelId: string,
  opts?: { workspaceId?: string; conversationId?: string }
): Promise<GenerateExercisesResponse> {
  const fullModelId = `${provider}:${modelId}`
  
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

    const userPrompt = `Analyze this conversation and create learning exercises for the programming concepts discussed:

CONVERSATION TITLE: "${request.conversationTitle}"

CONVERSATION CONTEXT:
${request.chatContext}
${userRequestSection}
YOUR TASK:
1. Identify the key programming concepts/topics from this conversation${request.userRequest ? ' and user request' : ''}
2. Create GENERAL educational exercises that teach these concepts
3. Use simple, clean example code - NOT the user's actual code
4. Think: "What would a textbook exercise look like for this concept?"
5. Include 2-3 relevant topic tags for each exercise

REQUIREMENTS:
- Interactive exercises: ${request.desiredCounts.interactive}
- Multiple choice questions: ${request.desiredCounts.mcq}
- True/False questions: ${request.desiredCounts.tf}

${request.existingPromptHashes.length > 0 ? `AVOID SIMILAR TO (prompt hashes): ${request.existingPromptHashes.join(', ')}` : ''}

Generate the exercises now.`

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
    
    const exercises = parsed.exercises.map((ex) => ({
      ...ex,
      createdAt: Date.now(),
    }))
    
    return {
      exercises,
      contextSummaryId: hashPrompt(request.chatContext.slice(0, 500)),
      message: parsed.message,
    }
  } catch (error) {
    console.error('Failed to parse exercise generation response:', error)
    throw new Error('Failed to generate exercises. Please try again.')
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
    
    const parsed = JSON.parse(jsonMatch[0]) as { isCorrect: boolean; feedback: string; hint?: string }
    
    return {
      isCorrect: parsed.isCorrect,
      feedback: parsed.feedback,
      suggestions: parsed.hint ? [parsed.hint] : undefined,
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
