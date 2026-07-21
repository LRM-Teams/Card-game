import type { PlayRecord } from '@card-game/rules';
import { HAND_TYPE_LABEL } from '../lib/cards';
import { handTypeFxClass, isBombLike } from '../lib/playFx';
import { CardView } from './CardView';

type Props = {
  record: PlayRecord | null;
  /** 本座位刚出牌时飘字动效（约 2s 后由父级关闭）。 */
  fxActive?: boolean;
  align?: 'left' | 'right' | 'center';
};

/** 某座位最近一次有效出牌：牌面 + 可选牌型字幕（不挡手牌/按钮）。 */
export function SeatPlayZone({ record, fxActive, align = 'center' }: Props) {
  if (!record) {
    return <div className={`seat-play-zone empty align-${align}`} aria-hidden="true" />;
  }

  const label = HAND_TYPE_LABEL[record.hand.type];
  const fxClass = handTypeFxClass(record.hand.type);
  const bombLike = isBombLike(record.hand.type);

  return (
    <div
      className={`seat-play-zone align-${align}`}
      aria-label={`最近出牌：${label}`}
    >
      {fxActive && (
        <div className={`play-type-fx ${fxClass}`} aria-hidden="true">
          {bombLike && (
            <img className="play-type-fx-bomb" src="/states/bomb.svg" alt="" />
          )}
          <span className="play-type-fx-text">{label}</span>
        </div>
      )}
      {!fxActive && <div className="play-type-caption muted">{label}</div>}
      <div className="seat-play-cards">
        {record.hand.cards.map((c) => (
          <CardView key={c.id} card={c} small tablePlay />
        ))}
      </div>
    </div>
  );
}
