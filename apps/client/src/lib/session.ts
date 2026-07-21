/** 游客身份 + 房间会话（localStorage，刷新/重进保留）。 */

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
  name: string;
  avatarId: string;
  beans: number;
};

/** 刷新后用于自动重回房间（仅 /room、/game 路径会消费）。 */
export type PlayerSession = {
  name: string;
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

export function readIdentity(): GuestIdentity {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestIdentity>;
      if (parsed?.guestId && parsed?.name) {
        return {
          guestId: parsed.guestId,
          name: String(parsed.name).trim() || '游客',
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
    name: '游客',
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
  name: string,
  roomId?: string | null,
  extra?: { guestId?: string; avatarId?: string },
): void {
  try {
    const payload: PlayerSession = {
      name: name.trim(),
      roomId: roomId?.trim() || null,
      guestId: extra?.guestId,
      avatarId: extra?.avatarId,
    };
    if (!payload.name) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readPlayerSession(): PlayerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession;
    if (!parsed?.name?.trim()) return null;
    return {
      name: parsed.name.trim(),
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
