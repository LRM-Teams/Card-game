/**
 * 私房进房：房间号规范化 + 失败文案（LRM-318）。
 * 支持粘贴完整分享链接（含 ?room=），避免第三人进错/空白页。
 */

/** 从房间号输入或分享链接提取 roomId。 */
export function normalizeRoomInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes('?room=') || trimmed.includes('&room=')) {
      const url = /^https?:\/\//i.test(trimmed)
        ? new URL(trimmed)
        : new URL(trimmed, 'http://local.invalid');
      const fromQuery = url.searchParams.get('room')?.trim();
      if (fromQuery) return fromQuery;
    }
  } catch {
    /* fall through */
  }
  const m = trimmed.match(/[?&]room=([^&#]+)/i);
  if (m?.[1]) {
    try {
      return decodeURIComponent(m[1]).trim();
    } catch {
      return m[1].trim();
    }
  }
  return trimmed;
}

/** 进房失败时优先展示的友好文案（服务端 message 作兜底）。 */
export function joinErrorText(code: string, message: string): string {
  switch (code) {
    case 'room_not_found':
      return '房间不存在，请检查房间号或链接是否过期';
    case 'room_full':
      return '房间已满（3/3），请换一个房间';
    case 'game_started':
      return '对局已开始，无法中途加入';
    default:
      return message || '加入房间失败';
  }
}
