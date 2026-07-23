/** 构建私房邀请链接（深链 ?room=）。 */
export function buildInviteLink(roomId: string, origin = window.location.origin): string {
  return `${origin}/?room=${encodeURIComponent(roomId)}`;
}

export function shortRoomLabel(roomId: string): string {
  return roomId.length > 6 ? `#${roomId.slice(0, 6)}` : `#${roomId}`;
}

export type WebShareResult = 'shared' | 'unsupported' | 'aborted' | 'failed';

/** Web Share API；不支持时由调用方回退复制链接。 */
export async function tryWebShare(roomId: string): Promise<WebShareResult> {
  const url = buildInviteLink(roomId);
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (!nav.share) return 'unsupported';
  const payload: ShareData = {
    title: '斗地主 · 邀请你同桌',
    text: `房间号 ${roomId}，一起来玩斗地主！`,
    url,
  };
  try {
    if (nav.canShare && !nav.canShare(payload)) return 'unsupported';
    await nav.share(payload);
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
    return 'failed';
  }
}
