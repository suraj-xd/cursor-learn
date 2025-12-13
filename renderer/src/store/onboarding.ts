"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

type OnboardingState = {
  isComplete: boolean
  step: number
  avatarSeed: string
  setStep: (step: number) => void
  setAvatarSeed: (seed: string) => void
  complete: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      isComplete: false,
      step: 0,
      avatarSeed: "",
      setStep: (step) => set({ step }),
      setAvatarSeed: (seed) => set({ avatarSeed: seed }),
      complete: () => set({ isComplete: true }),
      reset: () => set({ isComplete: false, step: 0 }),
    }),
    { name: "app-onboarding" }
  )
)
