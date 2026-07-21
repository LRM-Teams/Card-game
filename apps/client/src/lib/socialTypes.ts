import type { SocialEmoteId, SocialKind, SocialPhraseId } from '@card-game/rules';

export interface SocialBubbleData {
  kind: SocialKind;
  id: SocialEmoteId | SocialPhraseId;
  key: number;
}
