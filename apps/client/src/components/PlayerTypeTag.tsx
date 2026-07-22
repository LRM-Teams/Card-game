/** 座位真人 / 机器人角标（LRM-308） */
export function PlayerTypeTag({ isBot }: { isBot: boolean }) {
  return (
    <span className={`player-type-tag ${isBot ? 'is-bot' : 'is-human'}`}>
      {isBot ? '机器人' : '真人'}
    </span>
  );
}
