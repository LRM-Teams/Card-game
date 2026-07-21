import { create } from 'zustand';
import {
  isGuideActive,
  readOnboarding,
  resetOnboarding,
  writeOnboarding,
  type OnboardingState,
} from '../lib/onboarding';

interface OnboardingStore extends OnboardingState {
  active: boolean;
  skip: () => void;
  reset: () => void;
  mark: (key: keyof Omit<OnboardingState, 'skipped'>) => void;
}

function persist(partial: Partial<OnboardingState>, prev: OnboardingState): OnboardingState {
  const next = { ...prev, ...partial };
  writeOnboarding(next);
  return next;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => {
  const initial = readOnboarding();
  return {
    ...initial,
    active: isGuideActive(initial),
    skip: () => {
      const next = persist({ skipped: true }, get());
      set({ ...next, active: false });
    },
    reset: () => {
      const next = resetOnboarding();
      set({ ...next, active: true });
    },
    mark: (key) => {
      const next = persist({ [key]: true }, get());
      set({ ...next, active: isGuideActive(next) });
    },
  };
});
