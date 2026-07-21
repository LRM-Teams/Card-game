/** 新手引导进度（LRM-181）：localStorage，可跳过 / 可重置。 */

export const ONBOARDING_KEY = 'ddz_onboarding_v1';

export type OnboardingState = {
  /** 用户点过「跳过」，之后不再强制弹。 */
  skipped: boolean;
  /** 大厅：已看过昵称/头像引导。 */
  seenIdentity: boolean;
  /** 大厅：已看过「开始游戏」引导。 */
  seenStart: boolean;
  /** 首局叫分：已看过叫分说明。 */
  seenBidTip: boolean;
  /** 首局出牌：已看过出牌区高亮。 */
  seenPlayTip: boolean;
};

export const DEFAULT_ONBOARDING: OnboardingState = {
  skipped: false,
  seenIdentity: false,
  seenStart: false,
  seenBidTip: false,
  seenPlayTip: false,
};

export function readOnboarding(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { ...DEFAULT_ONBOARDING };
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      skipped: Boolean(parsed.skipped),
      seenIdentity: Boolean(parsed.seenIdentity),
      seenStart: Boolean(parsed.seenStart),
      seenBidTip: Boolean(parsed.seenBidTip),
      seenPlayTip: Boolean(parsed.seenPlayTip),
    };
  } catch {
    return { ...DEFAULT_ONBOARDING };
  }
}

export function writeOnboarding(next: OnboardingState): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

export function resetOnboarding(): OnboardingState {
  const fresh = { ...DEFAULT_ONBOARDING };
  writeOnboarding(fresh);
  return fresh;
}

/** 引导是否仍应主动弹出（未跳过且未走完关键步骤）。 */
export function isGuideActive(s: OnboardingState): boolean {
  if (s.skipped) return false;
  return !(s.seenIdentity && s.seenStart && s.seenBidTip && s.seenPlayTip);
}
