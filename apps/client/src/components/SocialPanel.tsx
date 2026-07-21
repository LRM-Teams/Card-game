/**
 * 局内表情 / 快捷语面板（LRM-177）。
 * 仅固定白名单；无自由文字输入。冷却以服务端为准，本地按钮同步禁用。
 */
import { useEffect, useState } from 'react';
import {
  SOCIAL_COOLDOWN_MS,
  SOCIAL_EMOTE_IDS,
  SOCIAL_PHRASES,
  type SocialEmoteId,
  type SocialPhraseId,
} from '@card-game/rules';
import { EmoteIcon, emoteLabel } from './EmoteIcon';
import { useGameStore } from '../store/gameStore';

export function SocialPanel({ enabled }: { enabled: boolean }) {
  const sendSocial = useGameStore((s) => s.sendSocial);
  const socialCooldownUntil = useGameStore((s) => s.socialCooldownUntil);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (socialCooldownUntil <= Date.now()) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [socialCooldownUntil]);

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const cooling = socialCooldownUntil > now;
  const leftSec = cooling ? Math.ceil((socialCooldownUntil - now) / 1000) : 0;
  const canSend = enabled && !cooling;

  const onEmote = (id: SocialEmoteId) => {
    if (!canSend) return;
    sendSocial('emote', id);
    setOpen(false);
  };
  const onPhrase = (id: SocialPhraseId) => {
    if (!canSend) return;
    sendSocial('phrase', id);
    setOpen(false);
  };

  return (
    <div className="emote-chat-dock">
      {open && (
        <div className="emote-chat-panel" role="dialog" aria-label="表情与快捷语">
          <div className="emote-chat-section">
            <p className="emote-chat-label">表情</p>
            <div className="emote-grid">
              {SOCIAL_EMOTE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="emote-pick"
                  disabled={!canSend}
                  title={emoteLabel(id)}
                  aria-label={emoteLabel(id)}
                  onClick={() => onEmote(id)}
                >
                  <EmoteIcon id={id} className="emote-glyph" />
                  <span className="emote-pick-label">{emoteLabel(id)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="emote-chat-section">
            <p className="emote-chat-label">快捷语</p>
            <div className="phrase-list">
              {(Object.keys(SOCIAL_PHRASES) as SocialPhraseId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="phrase-pick"
                  disabled={!canSend}
                  onClick={() => onPhrase(id)}
                >
                  {SOCIAL_PHRASES[id]}
                </button>
              ))}
            </div>
          </div>
          {cooling && (
            <p className="emote-chat-hint">冷却中 {leftSec}s（约 {SOCIAL_COOLDOWN_MS / 1000}s 限频）</p>
          )}
        </div>
      )}
      <button
        type="button"
        className={`btn emote-chat-trigger${open ? ' is-open' : ''}`}
        disabled={!enabled}
        aria-expanded={open}
        aria-label={open ? '关闭表情面板' : '打开表情与快捷语'}
        onClick={() => setOpen((v) => !v)}
      >
        表情
        {cooling && <span className="emote-cd-badge">{leftSec}</span>}
      </button>
    </div>
  );
}
