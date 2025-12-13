"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

type OnboardingState = {
  isComplete: boolean
  step: number
  avatarSeed: string
  _hasHydrated: boolean
  setStep: (step: number) => void
  setAvatarSeed: (seed: string) => void
  complete: () => void
  reset: () => void
  setHasHydrated: (state: boolean) => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      isComplete: false,
      step: 0,
      avatarSeed: "",
      _hasHydrated: false,
      setStep: (step) => set({ step }),
      setAvatarSeed: (seed) => set({ avatarSeed: seed }),
      complete: () => set({ isComplete: true, step: 0 }),
      reset: () => set({ isComplete: false, step: 0 }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "app-onboarding",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
