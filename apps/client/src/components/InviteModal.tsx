import { useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import accountMultiplePlus from '@iconify-icons/mdi/account-multiple-plus';
import { copyText } from '../lib/clipboard';
import { buildInviteLink, shortRoomCode } from '../lib/invite';

export type InviteCopyKind = 'id' | 'link' | null;

interface InviteModalProps {
  roomId: string;
  copied: InviteCopyKind;
  onCopied: (kind: InviteCopyKind) => void;
  onClose: () => void;
}

/**
 * 邀请好友弹层（LRM-385）：展示房间号与分享链接，支持复制 / 系统分享。
 */
export function InviteModal({ roomId, copied, onCopied, onClose }: InviteModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shareLink = buildInviteLink(roomId);
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const flashCopied = (kind: InviteCopyKind) => {
    onCopied(kind);
    window.setTimeout(() => onCopied(null), 1200);
  };

  const copyRoomId = async () => {
    const ok = await copyText(roomId);
    if (ok) flashCopied('id');
  };

  const copyLink = async () => {
    const ok = await copyText(shareLink);
    if (ok) flashCopied('link');
  };

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: '斗地主 · 邀请你同桌',
        text: `房间号 ${shortRoomCode(roomId)}，一起来玩斗地主！`,
        url: shareLink,
      });
    } catch {
      /* 用户取消 */
    }
  };

  return (
    <div
      className="invite-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="invite-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        ref={cardRef}
      >
        <header className="invite-card__head">
          <div className="invite-card__title-row">
            <Icon icon={accountMultiplePlus} className="invite-card__icon" aria-hidden />
            <h2 id="invite-title" className="invite-card__title">
              邀请好友同桌
            </h2>
          </div>
          <button type="button" className="invite-card__close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <p className="invite-card__hint">把房间号或链接发给好友，好友打开即可加入本房间</p>

        <div className="invite-code-block">
          <span className="invite-code-block__label">房间号</span>
          <div className="invite-code-block__short">{shortRoomCode(roomId)}</div>
          <code className="invite-code-block__full">{roomId}</code>
        </div>

        <div className="invite-actions">
          <button className="btn primary" type="button" onClick={copyRoomId}>
            {copied === 'id' ? '已复制' : '复制房间号'}
          </button>
          <button className="btn" type="button" onClick={copyLink}>
            {copied === 'link' ? '已复制' : '复制链接'}
          </button>
          {canNativeShare && (
            <button className="btn invite-share-native" type="button" onClick={nativeShare}>
              系统分享
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
