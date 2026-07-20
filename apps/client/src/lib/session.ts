/** 刷新后用于自动重回房间（仅 /room、/game 路径会消费）。 */
export const SESSION_KEY = 'ddz_player_session';

export type PlayerSession = {
  name: string;
  roomId: string | null;
};

export function savePlayerSession(name: string, roomId?: string | null): void {
  try {
    const payload: PlayerSession = {
      name: name.trim(),
      roomId: roomId?.trim() || null,
    };
    if (!payload.name) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readPlayerSession(): PlayerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerSession;
    if (!parsed?.name?.trim()) return null;
    return { name: parsed.name.trim(), roomId: parsed.roomId?.trim() || null };
  } catch {
    return null;
  }
}

export function shouldAutoRejoinPath(): boolean {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/game' || path === '/room';
}
