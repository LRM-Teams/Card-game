import type { ErrorCode } from '@card-game/rules';
import { npErrorLabel } from './narrativePixelElements';

const INVITE_ERROR_LABEL: Partial<Record<ErrorCode, string>> = {
  room_not_found: '房间不存在',
  room_full: '房间已满员',
  game_already_started: '对局已开始',
};

/** 深链/进房失败 → 叙事 stamp 文案（≤12 字） */
export function npInviteErrorLabel(code?: string | null, message?: string | null): string | null {
  if (!code && !message) return null;
  const mapped = code ? INVITE_ERROR_LABEL[code as ErrorCode] : undefined;
  return npErrorLabel(mapped ?? message ?? '', '进房失败');
}
