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
import { learningsIpc } from "@/lib/agents/learnings-ipc"
import type { ProviderId } from "@/lib/ai/config"

type LearningsStore = LearningsState & {
  currentWorkspaceId: string | null
  currentConversationId: string | null
  setActiveTab: (tab: ExerciseType) => void
  loadCached: (workspaceId: string, conversationId: string) => Promise<boolean>
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
    opts: { workspaceId?: string; conversationId?: string } | undefined,
    type: ExerciseType,
    count?: number,
    userRequest?: string
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
  interactive: 6,
  mcq: 2,
  tf: 2,
}

const saveToCache = async (
  workspaceId: string | null,
  conversationId: string | null,
  exercises: Exercise[],
  attempts: Record<string, ExerciseAttempt>,
  modelUsed: string
) => {
  if (!workspaceId || !conversationId || exercises.length === 0) return
  try {
    await learningsIpc.save({
      workspaceId,
      conversationId,
      exercises,
      attempts,
      modelUsed,
    })
  } catch {
    // silent fail for cache
  }
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
  currentWorkspaceId: null,
  currentConversationId: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadCached: async (workspaceId, conversationId) => {
    const state = get()
    if (
      state.currentWorkspaceId === workspaceId &&
      state.currentConversationId === conversationId &&
      state.exercises.length > 0
    ) {
      return true
    }

    if (
      state.currentWorkspaceId !== workspaceId ||
      state.currentConversationId !== conversationId
    ) {
      set({
        exercises: [],
        attempts: {},
        currentWorkspaceId: workspaceId,
        currentConversationId: conversationId,
      })
    }

    try {
      const cached = await learningsIpc.get(workspaceId, conversationId)
      if (cached && cached.exercises.length > 0) {
        set({
          exercises: cached.exercises as Exercise[],
          attempts: cached.attempts as Record<string, ExerciseAttempt>,
          currentWorkspaceId: workspaceId,
          currentConversationId: conversationId,
        })
        return true
      }
    } catch {
      // no cache found
    }
    return false
  },

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

      let updatedExercises: Exercise[]
      if (type) {
        updatedExercises = [...state.exercises, ...newExercises.filter((ex) => ex.type === type)]
      } else {
        updatedExercises = [...state.exercises, ...newExercises]
      }

      set({
        exercises: updatedExercises,
        contextSummaryId: response.contextSummaryId,
        isGenerating: false,
        currentWorkspaceId: opts?.workspaceId ?? null,
        currentConversationId: opts?.conversationId ?? null,
      })

      saveToCache(
        opts?.workspaceId ?? null,
        opts?.conversationId ?? null,
        updatedExercises,
        get().attempts,
        modelId
      )
    } catch (error) {
      set({
        isGenerating: false,
        generationError: error instanceof Error ? error.message : "Failed to generate exercises",
      })
    }
  },

  addMoreExercises: async (chatContext, conversationTitle, provider, modelId, opts, type, count = 3, userRequest) => {
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
      userRequest,
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

      const updatedExercises = [...state.exercises, ...newExercises]
      set({
        exercises: updatedExercises,
        isGenerating: false,
      })

      saveToCache(
        opts?.workspaceId ?? null,
        opts?.conversationId ?? null,
        updatedExercises,
        get().attempts,
        modelId
      )
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

      const updatedAttempts = { ...state.attempts, [exercise.id]: newAttempt }
      set({
        attempts: updatedAttempts,
        isEvaluating: false,
      })

      saveToCache(
        opts?.workspaceId ?? state.currentWorkspaceId,
        opts?.conversationId ?? state.currentConversationId,
        state.exercises,
        updatedAttempts,
        modelId
      )
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

    const updatedAttempts = { ...state.attempts, [exerciseId]: newAttempt }
    set({ attempts: updatedAttempts })

    saveToCache(
      state.currentWorkspaceId,
      state.currentConversationId,
      state.exercises,
      updatedAttempts,
      "cached"
    )
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

    const updatedAttempts = { ...state.attempts, [exerciseId]: newAttempt }
    set({ attempts: updatedAttempts })

    saveToCache(
      state.currentWorkspaceId,
      state.currentConversationId,
      state.exercises,
      updatedAttempts,
      "cached"
    )
  },

  resetAttempt: (exerciseId) => {
    const state = get()
    const { [exerciseId]: _, ...rest } = state.attempts
    set({ attempts: rest })

    saveToCache(
      state.currentWorkspaceId,
      state.currentConversationId,
      state.exercises,
      rest,
      "cached"
    )
  },

  clearExercises: () => {
    const state = get()
    set({
      exercises: [],
      attempts: {},
      contextSummaryId: null,
      generationError: null,
      evaluationError: null,
    })

    if (state.currentWorkspaceId && state.currentConversationId) {
      learningsIpc.delete(state.currentWorkspaceId, state.currentConversationId).catch(() => {})
    }
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
  loadCached: useLearningsStore.getState().loadCached,
  generateForConversation: useLearningsStore.getState().generateForConversation,
  addMoreExercises: useLearningsStore.getState().addMoreExercises,
  evaluateInteractive: useLearningsStore.getState().evaluateInteractive,
  submitMcqAnswer: useLearningsStore.getState().submitMcqAnswer,
  submitTfAnswer: useLearningsStore.getState().submitTfAnswer,
  resetAttempt: useLearningsStore.getState().resetAttempt,
  clearExercises: useLearningsStore.getState().clearExercises,
}
