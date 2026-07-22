/** 游客身份 + 房间会话（localStorage，刷新/重进保留）。 */

import {
  defaultDisplayName,
  DISPLAY_NAME_MAX,
  isValidDisplayName,
  normalizeDisplayName,
} from '@card-game/rules';

export const IDENTITY_KEY = 'ddz_guest_identity';
export const SESSION_KEY = 'ddz_player_session';

export const BUILTIN_AVATARS = [
  'av-1',
  'av-2',
  'av-3',
  'av-4',
  'av-5',
  'av-6',
  'av-7',
  'av-8',
] as const;

export type GuestIdentity = {
  guestId: string;
  displayName: string;
  avatarId: string;
  beans: number;
};

/** 刷新后用于自动重回房间（仅 /room、/game 路径会消费）。 */
export type PlayerSession = {
  displayName: string;
  roomId: string | null;
  guestId?: string;
  avatarId?: string;
};

function newGuestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `g-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseStoredDisplayName(parsed: Partial<GuestIdentity & { name?: string }>): string {
  const raw = parsed.displayName ?? parsed.name ?? '';
  const normalized = normalizeDisplayName(String(raw));
  return isValidDisplayName(normalized) ? normalized : defaultDisplayName();
}

export function readIdentity(): GuestIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestIdentity & { name?: string }>;
      if (parsed?.guestId) {
        return {
          guestId: parsed.guestId,
          displayName: parseStoredDisplayName(parsed),
          avatarId: parsed.avatarId?.trim() || 'av-1',
          beans: typeof parsed.beans === 'number' ? parsed.beans : 1000,
        };
      }
    }
  } catch {
    /* ignore */
  }
  const fresh: GuestIdentity = {
    guestId: newGuestId(),
    displayName: defaultDisplayName(),
    avatarId: 'av-1',
    beans: 1000,
  };
  saveIdentity(fresh);
  return fresh;
}

export function saveIdentity(id: GuestIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
  } catch {
    /* quota / private mode */
  }
}

export function savePlayerSession(
  displayName: string,
  roomId?: string | null,
  extra?: { guestId?: string; avatarId?: string },
): void {
  try {
    const payload: PlayerSession = {
      displayName: normalizeDisplayName(displayName),
      roomId: roomId?.trim() || null,
      guestId: extra?.guestId,
      avatarId: extra?.avatarId,
    };
    if (!isValidDisplayName(payload.displayName)) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** 主动离开房间/对局回大厅时清除，避免 Lobby 自动跳回 /room。 */
export function clearPlayerSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function readPlayerSession(): PlayerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession & { name?: string };
    const displayName = normalizeDisplayName(parsed.displayName ?? parsed.name ?? '');
    if (!isValidDisplayName(displayName)) return null;
    return {
      displayName,
      roomId: parsed.roomId?.trim() || null,
      guestId: parsed.guestId,
      avatarId: parsed.avatarId,
    };
  } catch {
    return null;
  }
}

export function shouldAutoRejoinPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/game' || path === '/room';
}

export { DISPLAY_NAME_MAX, isValidDisplayName, normalizeDisplayName };
