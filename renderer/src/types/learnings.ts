export type ExerciseType = 'interactive' | 'mcq' | 'tf'
export type ExerciseDifficulty = 'easy' | 'medium' | 'hard'
export type ExerciseStatus = 'fresh' | 'attempted' | 'correct' | 'incorrect'
export type ChallengeType = 'fill-blank' | 'fix-bug' | 'complete-function' | 'refactor' | 'predict-output'

export type InteractivePlaceholder = {
  id: string
  label: string
  expected: string
  hint?: string
}

export type TieredHint = {
  level: 1 | 2 | 3
  hint: string
}

export type InteractiveExercise = {
  id: string
  type: 'interactive'
  prompt: string
  difficulty: ExerciseDifficulty
  challengeType: ChallengeType
  starterCode: string
  language: string
  placeholders: InteractivePlaceholder[]
  expectedSolution: string
  hints?: string[]
  tieredHints?: TieredHint[]
  stepGoals?: string[]
  estimatedMinutes?: number
  topics?: string[]
  contextSummaryId?: string
  createdAt: number
  reviewAt?: number | null
}

export type McqOption = {
  id: string
  label: string
  isCorrect: boolean
}

export type McqExercise = {
  id: string
  type: 'mcq'
  prompt: string
  difficulty: ExerciseDifficulty
  options: McqOption[]
  explanation: string
  topics?: string[]
  contextSummaryId?: string
  createdAt: number
}

export type TrueFalseExercise = {
  id: string
  type: 'tf'
  prompt: string
  difficulty: ExerciseDifficulty
  statement: string
  correct: boolean
  explanation: string
  topics?: string[]
  contextSummaryId?: string
  createdAt: number
}

export type Exercise = InteractiveExercise | McqExercise | TrueFalseExercise

export type ExerciseAttempt = {
  exerciseId: string
  status: ExerciseStatus
  userAnswer: string | string[] | boolean | null
  feedback?: string
  attemptsCount: number
  lastAttemptAt?: number
  revealedHintLevel?: 0 | 1 | 2 | 3
}

export type ConversationBubble = {
  type: 'user' | 'ai'
  text: string
  timestamp?: number
}

export type GenerateExercisesRequest = {
  chatContext?: string
  bubbles?: ConversationBubble[]
  conversationTitle: string
  existingPromptHashes: string[]
  desiredCounts: {
    interactive: number
    mcq: number
    tf: number
  }
  difficultyBalance?: {
    easy: number
    medium: number
    hard: number
  }
  userRequest?: string
  tokenBudget?: number
}

export type GenerateExercisesResponse = {
  exercises: Exercise[]
  contextSummaryId: string
  message?: string
}

export type EvaluateInteractiveRequest = {
  exerciseId: string
  prompt: string
  starterCode: string
  expectedSolution: string
  userCode: string
  language: string
  placeholders: InteractivePlaceholder[]
}

export type EvaluateInteractiveResponse = {
  isCorrect: boolean
  feedback: string
  missingElements?: string[]
  suggestions?: string[]
}

export type LearningsState = {
  exercises: Exercise[]
  attempts: Record<string, ExerciseAttempt>
  contextSummaryId: string | null
  isGenerating: boolean
  isEvaluating: boolean
  generationError: string | null
  evaluationError: string | null
  activeTab: ExerciseType
  generationJobId: string | null
  generationStatus: 'idle' | 'loading' | 'success' | 'error'
}
