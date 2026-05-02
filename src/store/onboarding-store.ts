import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  hasCompleted: boolean
  completeOnboarding: () => void
  resetOnboarding: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    set => ({
      hasCompleted: false,
      completeOnboarding: () => set({ hasCompleted: true }),
      resetOnboarding: () => set({ hasCompleted: false }),
    }),
    {
      name: 'axis-onboarding-storage',
    }
  )
)
