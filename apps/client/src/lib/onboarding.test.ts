/**
 * LRM-181 onboarding pure helpers — run with:
 *   pnpm --filter @card-game/client exec vitest run src/lib/onboarding.test.ts
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_ONBOARDING,
  lobbyGuideStep,
  tableGuideKind,
  type OnboardingProgress,
} from './onboarding';

function progress(patch: Partial<OnboardingProgress> = {}): OnboardingProgress {
  return { ...DEFAULT_ONBOARDING, ...patch };
}

describe('lobbyGuideStep', () => {
  it('shows identity first', () => {
    expect(lobbyGuideStep(progress())).toBe('identity');
  });

  it('advances to start after identity', () => {
    expect(lobbyGuideStep(progress({ seenIdentityTip: true }))).toBe('start');
  });

  it('returns null when path done or skipped', () => {
    expect(
      lobbyGuideStep(progress({ seenIdentityTip: true, seenStartTip: true })),
    ).toBeNull();
    expect(lobbyGuideStep(progress({ skipped: true }))).toBeNull();
  });
});

describe('tableGuideKind', () => {
  beforeEach(() => {
    /* no-op: pure */
  });

  it('prefers bid tip on bidding turn', () => {
    expect(
      tableGuideKind(progress(), { biddingMyTurn: true, playingMyTurn: false }),
    ).toBe('bid');
  });

  it('shows play tip on playing turn', () => {
    expect(
      tableGuideKind(progress({ seenBidTip: true }), {
        biddingMyTurn: false,
        playingMyTurn: true,
      }),
    ).toBe('play');
  });

  it('respects skip and seen flags', () => {
    expect(
      tableGuideKind(progress({ skipped: true }), {
        biddingMyTurn: true,
        playingMyTurn: true,
      }),
    ).toBeNull();
    expect(
      tableGuideKind(progress({ seenBidTip: true, seenPlayTip: true }), {
        biddingMyTurn: true,
        playingMyTurn: true,
      }),
    ).toBeNull();
  });
});
