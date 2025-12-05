"use client"

import { create } from "zustand"
import type {
  Exercise,
  ExerciseType,
  ExerciseAttempt,
  LearningsState,
  GenerateExercisesRequest,
  EvaluateInteractiveRequest,
  InteractiveExercise,
} from "@/types/learnings"
import {
  generateExercises,
  evaluateInteractiveExercise,
  hashExercisePrompt,
  checkMcqAnswer,
  checkTfAnswer,
} from "@/lib/agents/learnings"
import type { ProviderId } from "@/lib/ai/config"

type LearningsStore = LearningsState & {
  setActiveTab: (tab: ExerciseType) => void
  generateForConversation: (
    chatContext: string,
    conversationTitle: string,
    provider: ProviderId,
    modelId: string,
    opts?: { workspaceId?: string; conversationId?: string },
    type?: ExerciseType
  ) => Promise<void>
  addMoreExercises: (
    chatContext: string,
    conversationTitle: string,
    provider: ProviderId,
    modelId: string,
    opts?: { workspaceId?: string; conversationId?: string },
    type: ExerciseType,
    count?: number
  ) => Promise<void>
  evaluateInteractive: (
    exercise: InteractiveExercise,
    userCode: string,
    provider: ProviderId,
    modelId: string,
    opts?: { workspaceId?: string; conversationId?: string }
  ) => Promise<void>
  submitMcqAnswer: (exerciseId: string, selectedOptionId: string) => void
  submitTfAnswer: (exerciseId: string, userAnswer: boolean) => void
  resetAttempt: (exerciseId: string) => void
  clearExercises: () => void
  getExercisesByType: (type: ExerciseType) => Exercise[]
  getAttempt: (exerciseId: string) => ExerciseAttempt | undefined
}

const DEFAULT_COUNTS = {
  interactive: 3,
  mcq: 2,
  tf: 2,
}

export const useLearningsStore = create<LearningsStore>((set, get) => ({
  exercises: [],
  attempts: {},
  contextSummaryId: null,
  isGenerating: false,
  isEvaluating: false,
  generationError: null,
  evaluationError: null,
  activeTab: "interactive",

  setActiveTab: (tab) => set({ activeTab: tab }),

  generateForConversation: async (chatContext, conversationTitle, provider, modelId, opts, type) => {
    const state = get()
    if (state.isGenerating) return

    set({ isGenerating: true, generationError: null })

    const existingHashes = state.exercises.map((ex) => hashExercisePrompt(ex.prompt))
    
    const desiredCounts = type 
      ? { interactive: 0, mcq: 0, tf: 0, [type]: DEFAULT_COUNTS[type] + 3 }
      : DEFAULT_COUNTS

    const request: GenerateExercisesRequest = {
      chatContext,
      conversationTitle,
      existingPromptHashes: existingHashes,
      desiredCounts,
    }

    try {
      const response = await generateExercises(request, provider, modelId, opts)
      
      const newExercises = response.exercises.filter((newEx) => {
        const newHash = hashExercisePrompt(newEx.prompt)
        return !existingHashes.includes(newHash)
      })

      set((s) => ({
        exercises: type ? s.exercises : [...s.exercises, ...newExercises],
        contextSummaryId: response.contextSummaryId,
        isGenerating: false,
      }))

      if (type) {
        set((s) => ({
          exercises: [...s.exercises, ...newExercises.filter((ex) => ex.type === type)],
        }))
      }
    } catch (error) {
      set({
        isGenerating: false,
        generationError: error instanceof Error ? error.message : "Failed to generate exercises",
      })
    }
  },

  addMoreExercises: async (chatContext, conversationTitle, provider, modelId, opts, type, count = 3) => {
    const state = get()
    if (state.isGenerating) return

    set({ isGenerating: true, generationError: null })

    const existingHashes = state.exercises.map((ex) => hashExercisePrompt(ex.prompt))
    
    const desiredCounts = {
      interactive: type === "interactive" ? count : 0,
      mcq: type === "mcq" ? count : 0,
      tf: type === "tf" ? count : 0,
    }

    const request: GenerateExercisesRequest = {
      chatContext,
      conversationTitle,
      existingPromptHashes: existingHashes,
      desiredCounts,
    }

    try {
      const response = await generateExercises(request, provider, modelId, opts)
      
      const newExercises = response.exercises.filter((newEx) => {
        const newHash = hashExercisePrompt(newEx.prompt)
        return !existingHashes.includes(newHash) && newEx.type === type
      })

      if (newExercises.length === 0 && response.message) {
        set({
          isGenerating: false,
          generationError: response.message,
        })
        return
      }

      set((s) => ({
        exercises: [...s.exercises, ...newExercises],
        isGenerating: false,
      }))
    } catch (error) {
      set({
        isGenerating: false,
        generationError: error instanceof Error ? error.message : "Failed to generate more exercises",
      })
    }
  },

  evaluateInteractive: async (exercise, userCode, provider, modelId, opts) => {
    const state = get()
    if (state.isEvaluating) return

    set({ isEvaluating: true, evaluationError: null })

    const request: EvaluateInteractiveRequest = {
      exerciseId: exercise.id,
      prompt: exercise.prompt,
      starterCode: exercise.starterCode,
      expectedSolution: exercise.expectedSolution,
      userCode,
      language: exercise.language,
      placeholders: exercise.placeholders,
    }

    try {
      const response = await evaluateInteractiveExercise(request, provider, modelId, opts)
      
      const currentAttempt = state.attempts[exercise.id]
      const feedbackText = response.suggestions?.length 
        ? `${response.feedback} ${response.suggestions[0]}`
        : response.feedback
        
      const newAttempt: ExerciseAttempt = {
        exerciseId: exercise.id,
        status: response.isCorrect ? "correct" : "incorrect",
        userAnswer: userCode,
        feedback: feedbackText,
        attemptsCount: (currentAttempt?.attemptsCount || 0) + 1,
        lastAttemptAt: Date.now(),
      }

      set((s) => ({
        attempts: { ...s.attempts, [exercise.id]: newAttempt },
        isEvaluating: false,
      }))
    } catch (error) {
      set({
        isEvaluating: false,
        evaluationError: error instanceof Error ? error.message : "Failed to evaluate answer",
      })
    }
  },

  submitMcqAnswer: (exerciseId, selectedOptionId) => {
    const state = get()
    const exercise = state.exercises.find((ex) => ex.id === exerciseId)
    if (!exercise || exercise.type !== "mcq") return

    const isCorrect = checkMcqAnswer(exercise, selectedOptionId)
    const currentAttempt = state.attempts[exerciseId]

    const newAttempt: ExerciseAttempt = {
      exerciseId,
      status: isCorrect ? "correct" : "incorrect",
      userAnswer: selectedOptionId,
      feedback: isCorrect ? "Correct!" : exercise.explanation,
      attemptsCount: (currentAttempt?.attemptsCount || 0) + 1,
      lastAttemptAt: Date.now(),
    }

    set((s) => ({
      attempts: { ...s.attempts, [exerciseId]: newAttempt },
    }))
  },

  submitTfAnswer: (exerciseId, userAnswer) => {
    const state = get()
    const exercise = state.exercises.find((ex) => ex.id === exerciseId)
    if (!exercise || exercise.type !== "tf") return

    const isCorrect = checkTfAnswer(exercise, userAnswer)
    const currentAttempt = state.attempts[exerciseId]

    const newAttempt: ExerciseAttempt = {
      exerciseId,
      status: isCorrect ? "correct" : "incorrect",
      userAnswer,
      feedback: isCorrect ? "Correct!" : exercise.explanation,
      attemptsCount: (currentAttempt?.attemptsCount || 0) + 1,
      lastAttemptAt: Date.now(),
    }

    set((s) => ({
      attempts: { ...s.attempts, [exerciseId]: newAttempt },
    }))
  },

  resetAttempt: (exerciseId) => {
    set((s) => {
      const { [exerciseId]: _, ...rest } = s.attempts
      return { attempts: rest }
    })
  },

  clearExercises: () => {
    set({
      exercises: [],
      attempts: {},
      contextSummaryId: null,
      generationError: null,
      evaluationError: null,
    })
  },

  getExercisesByType: (type) => {
    return get().exercises.filter((ex) => ex.type === type)
  },

  getAttempt: (exerciseId) => {
    return get().attempts[exerciseId]
  },
}))

export const learningsActions = {
  setActiveTab: useLearningsStore.getState().setActiveTab,
  generateForConversation: useLearningsStore.getState().generateForConversation,
  addMoreExercises: useLearningsStore.getState().addMoreExercises,
  evaluateInteractive: useLearningsStore.getState().evaluateInteractive,
  submitMcqAnswer: useLearningsStore.getState().submitMcqAnswer,
  submitTfAnswer: useLearningsStore.getState().submitTfAnswer,
  resetAttempt: useLearningsStore.getState().resetAttempt,
  clearExercises: useLearningsStore.getState().clearExercises,
}
