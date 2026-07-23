import { useEffect, useState } from 'react';
import { copyText } from '../lib/clipboard';
import { buildInviteLink, shortRoomLabel, tryWebShare } from '../lib/invite';

type CopyKind = 'id' | 'link' | null;

/**
 * 私房邀请弹层（LRM-385）：房间号 + 链接复制 + Web Share。
 * 使用现有 --ddz-* token，无竞品美术资产。
 */
export function InviteSheet({
  roomId,
  open,
  onClose,
}: {
  roomId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<CopyKind>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const shareLink = buildInviteLink(roomId);
  const canWebShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  useEffect(() => {
    if (!open) {
      setCopied(null);
      setShareHint(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const flashCopied = (kind: CopyKind) => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const copyRoomId = async () => {
    if (await copyText(roomId)) flashCopied('id');
  };

  const copyLink = async () => {
    if (await copyText(shareLink)) flashCopied('link');
  };

  const shareInvite = async () => {
    const result = await tryWebShare(roomId);
    if (result === 'shared') {
      setShareHint('已唤起系统分享');
      window.setTimeout(() => setShareHint(null), 1500);
      return;
    }
    if (result === 'unsupported' || result === 'failed') {
      if (await copyText(shareLink)) {
        setShareHint('已复制链接，可粘贴发给好友');
        flashCopied('link');
      }
    }
  };

  return (
    <div className="invite-sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="invite-sheet"
        role="dialog"
        aria-labelledby="invite-sheet-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="invite-sheet__head">
          <h2 id="invite-sheet-title" className="invite-sheet__title">
            邀请好友同桌
          </h2>
          <button type="button" className="invite-sheet__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <p className="invite-sheet__hint">把房间号或链接发给好友，打开即可加入本房（满 3 人自动开局）。</p>

        <div className="invite-sheet__code" data-testid="invite-room-code">
          <span className="invite-sheet__code-label">房间号</span>
          <code>{roomId}</code>
          <span className="invite-sheet__code-short">{shortRoomLabel(roomId)}</span>
        </div>

        <div className="invite-sheet__link">
          <span className="invite-sheet__link-label">邀请链接</span>
          <p className="invite-sheet__link-value">{shareLink}</p>
        </div>

        <div className="invite-sheet__actions">
          <button type="button" className="btn invite-sheet__btn" onClick={copyRoomId}>
            {copied === 'id' ? '已复制' : '复制房间号'}
          </button>
          <button type="button" className="btn invite-sheet__btn" onClick={copyLink}>
            {copied === 'link' ? '已复制' : '复制链接'}
          </button>
          <button type="button" className="btn primary invite-sheet__btn" onClick={shareInvite}>
            {canWebShare ? '分享邀请' : '复制并分享'}
          </button>
        </div>

        {(shareHint || copied === 'link') && (
          <p className="invite-sheet__toast" role="status" aria-live="polite">
            {shareHint ?? '链接已复制'}
          </p>
        )}
      </div>
    </div>
  );
}
