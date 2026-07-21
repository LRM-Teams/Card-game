/** 轻量新手引导进度（localStorage；跳过 / 完成后刷新不再强制弹）。 */

export const ONBOARDING_KEY = 'ddz_onboarding_v1';

export type OnboardingProgress = {
  /** 用户点了「跳过」：之后不再强制弹出任何引导 */
  skipped: boolean;
  /** 大厅：身份（昵称+头像）步骤已看过 / 确认 */
  seenIdentityTip: boolean;
  /** 大厅：开始游戏 CTA 步骤已看过 / 已点击开局 */
  seenStartTip: boolean;
  /** 首局：叫分提示已看过 */
  seenBidTip: boolean;
  /** 首局：出牌 / 不出 / 提示 控件提示已看过 */
  seenPlayTip: boolean;
};

export const DEFAULT_ONBOARDING: OnboardingProgress = {
  skipped: false,
  seenIdentityTip: false,
  seenStartTip: false,
  seenBidTip: false,
  seenPlayTip: false,
};

export type LobbyGuideStep = 'identity' | 'start' | null;
export type TableGuideKind = 'bid' | 'play' | null;

export function readOnboarding(): OnboardingProgress {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { ...DEFAULT_ONBOARDING };
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    return {
      skipped: Boolean(parsed.skipped),
      seenIdentityTip: Boolean(parsed.seenIdentityTip),
      seenStartTip: Boolean(parsed.seenStartTip),
      seenBidTip: Boolean(parsed.seenBidTip),
      seenPlayTip: Boolean(parsed.seenPlayTip),
    };
  } catch {
    return { ...DEFAULT_ONBOARDING };
  }
}

export function saveOnboarding(progress: OnboardingProgress): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(progress));
  } catch {
    /* quota / private mode */
  }
}

export function resetOnboarding(): OnboardingProgress {
  const fresh = { ...DEFAULT_ONBOARDING };
  saveOnboarding(fresh);
  return fresh;
}

export function patchOnboarding(
  patch: Partial<OnboardingProgress>,
): OnboardingProgress {
  const next = { ...readOnboarding(), ...patch };
  saveOnboarding(next);
  return next;
}

/** 大厅当前应高亮的引导步；跳过后返回 null。 */
export function lobbyGuideStep(p: OnboardingProgress): LobbyGuideStep {
  if (p.skipped) return null;
  if (!p.seenIdentityTip) return 'identity';
  if (!p.seenStartTip) return 'start';
  return null;
}

/** 牌桌当前应展示的首局提示；跳过后返回 null。 */
export function tableGuideKind(
  p: OnboardingProgress,
  opts: { biddingMyTurn: boolean; playingMyTurn: boolean },
): TableGuideKind {
  if (p.skipped) return null;
  if (opts.biddingMyTurn && !p.seenBidTip) return 'bid';
  if (opts.playingMyTurn && !p.seenPlayTip) return 'play';
  return null;
}
