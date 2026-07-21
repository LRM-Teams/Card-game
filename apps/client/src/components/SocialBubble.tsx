/** 座位旁表情 / 快捷语气泡。 */
import {
  SOCIAL_PHRASES,
  isSocialEmoteId,
  isSocialPhraseId,
} from '@card-game/rules';
import type { SocialBubbleData } from '../lib/socialTypes';
import { EmoteIcon } from './EmoteIcon';

export type { SocialBubbleData };

export function SocialBubble({
  data,
  align = 'center',
}: {
  data: SocialBubbleData | null | undefined;
  align?: 'left' | 'right' | 'center';
}) {
  if (!data) return null;
  const alignClass =
    align === 'left' ? ' align-left' : align === 'right' ? ' align-right' : '';
  if (data.kind === 'emote' && isSocialEmoteId(data.id)) {
    return (
      <div className={`seat-emote-bubble${alignClass}`} key={data.key} role="status">
        <EmoteIcon id={data.id} className="emote-glyph emote-glyph--bubble" />
      </div>
    );
  }
  if (data.kind === 'phrase' && isSocialPhraseId(data.id)) {
    return (
      <div className={`seat-emote-bubble${alignClass}`} key={data.key} role="status">
        <span className="seat-emote-phrase">{SOCIAL_PHRASES[data.id]}</span>
      </div>
    );
  }
  return null;
}
