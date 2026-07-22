/** 座位角标：区分真人 / 机器人（沿用服务端 isBot）。 */
export function PlayerKindBadge({ isBot }: { isBot: boolean }) {
  return (
    <span className={`player-kind-badge ${isBot ? 'bot' : 'human'}`} aria-hidden="true">
      {isBot ? '机器人' : '真人'}
    </span>
  );
}

/** 无障碍朗读：玩家类型文案。 */
export function playerKindLabel(isBot: boolean): string {
  return isBot ? '机器人' : '真人';
}
