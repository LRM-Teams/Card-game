import type { ErrorCode } from '@card-game/rules';

/** 构建私房邀请链接（深链 #/room/{id}，兼容 ?room= 解析）。 */
export function buildInviteLink(roomId: string, origin = window.location.origin): string {
  return `${origin}/#/room/${encodeURIComponent(roomId)}`;
}

export function shortRoomLabel(roomId: string): string {
  return roomId.length > 6 ? `#${roomId.slice(0, 6)}` : `#${roomId}`;
}

/** 从 URL 解析邀请房间号：优先 #/room/{id}，回退 ?room=。 */
export function parseInviteRoomId(loc: Location = window.location): string {
  const hash = loc.hash.replace(/^#/, '');
  const hashMatch = hash.match(/^\/room\/(.+)$/);
  if (hashMatch?.[1]) {
    try {
      return decodeURIComponent(hashMatch[1]).trim();
    } catch {
      return hashMatch[1].trim();
    }
  }
  try {
    return new URLSearchParams(loc.search).get('room')?.trim() ?? '';
  } catch {
    return '';
  }
}

/** 深链进房失败后清理 URL，避免刷新重复触发。 */
export function clearInviteFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    const bareHash = url.hash.replace(/^#/, '');
    if (/^\/room\//.test(bareHash)) url.hash = '';
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

const INVITE_JOIN_ERRORS: ErrorCode[] = ['room_not_found', 'room_full', 'game_already_started'];

export function isInviteJoinError(code: string): code is ErrorCode {
  return (INVITE_JOIN_ERRORS as string[]).includes(code);
}

/** LRM-526：深链进房错误文案（叙事站牌 ≤12 字）。 */
export function inviteJoinErrorLabel(code: string, fallback: string): string {
  const map: Record<string, string> = {
    room_not_found: '房间不存在',
    room_full: '房间已满',
    game_already_started: '对局已开始',
  };
  const label = map[code] ?? fallback;
  return label.length > 12 ? label.slice(0, 12) : label;
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
