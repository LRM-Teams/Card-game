import { create } from 'zustand';
import {
  type OnboardingProgress,
  readOnboarding,
  patchOnboarding,
  resetOnboarding,
  lobbyGuideStep,
  tableGuideKind,
  type LobbyGuideStep,
  type TableGuideKind,
} from '../lib/onboarding';

interface OnboardingUiState extends OnboardingProgress {
  lobbyStep: LobbyGuideStep;
  refresh: () => void;
  skipAll: () => void;
  markIdentitySeen: () => void;
  markStartSeen: () => void;
  markBidSeen: () => void;
  markPlaySeen: () => void;
  resetGuide: () => void;
  tableKind: (opts: {
    biddingMyTurn: boolean;
    playingMyTurn: boolean;
  }) => TableGuideKind;
}

function withDerived(p: OnboardingProgress) {
  return {
    ...p,
    lobbyStep: lobbyGuideStep(p),
  };
}

export const useOnboardingStore = create<OnboardingUiState>((set, get) => ({
  ...withDerived(readOnboarding()),

  refresh: () => set(withDerived(readOnboarding())),

  skipAll: () => set(withDerived(patchOnboarding({ skipped: true }))),

  markIdentitySeen: () =>
    set(withDerived(patchOnboarding({ seenIdentityTip: true }))),

  markStartSeen: () =>
    set(withDerived(patchOnboarding({ seenStartTip: true }))),

  markBidSeen: () => set(withDerived(patchOnboarding({ seenBidTip: true }))),

  markPlaySeen: () => set(withDerived(patchOnboarding({ seenPlayTip: true }))),

  resetGuide: () => set(withDerived(resetOnboarding())),

  tableKind: (opts) => tableGuideKind(get(), opts),
}));
