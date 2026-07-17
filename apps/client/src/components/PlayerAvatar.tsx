/** 统一的玩家头像占位/剪影，替代廉价感的 emoji（🤖/🙂）。 */

export function PlayerAvatar({ kind }: { kind: 'empty' | 'player' }) {
  if (kind === 'empty') {
    return (
      <span className="avatar-glyph plus" aria-hidden="true">
        ＋
      </span>
    );
  }
  return (
    <svg className="avatar-silhouette" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="24" r="13" />
      <path d="M11 57c0-12.6 9.4-19.5 21-19.5S53 44.4 53 57v3H11z" />
    </svg>
  );
}
