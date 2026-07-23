/** 构建私房邀请链接（与 Lobby 深链 `?room=` 一致）。 */
export function buildInviteLink(roomId: string): string {
  return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
}

/** 房间号短码展示（前 6 位大写）。 */
export function shortRoomCode(roomId: string): string {
  return roomId.slice(0, 6).toUpperCase();
}

/** 从粘贴文本或 URL 中解析房间号。 */
export function parseRoomIdFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('room')?.trim();
    if (fromQuery) return fromQuery;
  } catch {
    /* 非 URL，当作纯房间号 */
  }
  return trimmed;
}
