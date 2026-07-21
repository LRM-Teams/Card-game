/** 统一玩家头像：内置色块图集 + 剪影 fallback。 */

const AVATAR_COLORS: Record<string, string> = {
  'av-1': '#c45c26',
  'av-2': '#2f6fed',
  'av-3': '#1a9b6c',
  'av-4': '#8b5cf6',
  'av-5': '#db2777',
  'av-6': '#0ea5e9',
  'av-7': '#ca8a04',
  'av-8': '#64748b',
  bot: '#3d5a45',
};

export function PlayerAvatar({
  kind,
  avatarId,
}: {
  kind: 'empty' | 'player';
  avatarId?: string;
}) {
  if (kind === 'empty') {
    return (
      <span className="avatar-glyph plus" aria-hidden="true">
        ＋
      </span>
    );
  }
  const id = avatarId && AVATAR_COLORS[avatarId] ? avatarId : 'av-1';
  const fill = AVATAR_COLORS[id] ?? AVATAR_COLORS['av-1'];
  return (
    <svg className="avatar-silhouette" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill={fill} />
      <circle cx="32" cy="24" r="12" fill="rgba(255,255,255,0.92)" />
      <path d="M12 57c0-11.5 9-18 20-18s20 6.5 20 18v3H12z" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}
