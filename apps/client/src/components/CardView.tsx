import type { CSSProperties } from 'react';
import { RANK, type Card } from '@card-game/rules';
import { SUIT_SYMBOL, cardColor } from '../lib/cards';

interface Props {
  card?: Card;
  selected?: boolean;
  onClick?: () => void;
  /** 小尺寸（用于对手 / 牌桌展示）。 */
  small?: boolean;
  /** 桌面中央出牌区（LRM-131/138：与手牌区分离）。 */
  tablePlay?: boolean;
  /** 牌背朝上（对手手牌 / 未翻底牌）。 */
  faceDown?: boolean;
  /** 不可出：降饱和半透明（LRM-206/207 规格）。 */
  unplayable?: boolean;
  style?: CSSProperties;
}

/** LRM-207/315：v2 纸面 SVG + 组件角标；大小王/牌背全图资产。 */
export function CardView({
  card,
  selected,
  onClick,
  small,
  tablePlay,
  faceDown,
  unplayable,
  style,
}: Props) {
  if (faceDown || !card) {
    return (
      <button
        type="button"
        className={`card is-face-down ${small ? 'is-small' : ''} ${tablePlay ? 'is-table-play' : ''}`}
        onClick={onClick}
        disabled={!onClick}
        title="牌背"
        aria-label="牌背"
        style={style}
      >
        <img className="card-back-art" src="/cards/card-back.svg" alt="" aria-hidden="true" />
      </button>
    );
  }

  const color = cardColor(card);
  const symbol = card.suit ? SUIT_SYMBOL[card.suit] : '';
  const isJoker = !card.suit;
  const jokerAsset =
    card.rank === RANK.BIG_JOKER
      ? '/cards/joker-big.svg'
      : card.rank === RANK.SMALL_JOKER
        ? '/cards/joker-small.svg'
        : null;

  return (
    <button
      type="button"
      className={`card ${color} ${isJoker ? 'is-joker' : ''} ${selected ? 'is-selected' : ''} ${small ? 'is-small' : ''} ${tablePlay ? 'is-table-play' : ''} ${unplayable ? 'is-unplayable' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      title={card.display}
      aria-label={card.display}
      style={style}
    >
      {jokerAsset ? (
        <img className="card-joker-art" src={jokerAsset} alt="" aria-hidden="true" />
      ) : (
        <>
          <img className="card-front-art" src="/cards/card-paper.svg" alt="" aria-hidden="true" />
          <span className="card-corner top">
            <span className="card-corner-rank">{card.display}</span>
            {symbol ? <span className="card-corner-suit">{symbol}</span> : null}
          </span>
          <span className="card-suit-center" aria-hidden="true">
            {symbol}
          </span>
          <span className="card-corner bottom">
            <span className="card-corner-rank">{card.display}</span>
            {symbol ? <span className="card-corner-suit">{symbol}</span> : null}
          </span>
        </>
      )}
    </button>
  );
}

/** 对手剩余手牌：扇形牌背（最多展示 10 张）。 */
export function OpponentBackFan({ count, align = 'center' }: { count: number; align?: 'left' | 'right' | 'center' }) {
  const n = Math.max(0, Math.min(count, 10));
  if (n <= 0) return null;
  return (
    <div
      className={`opponent-back-fan align-${align}`}
      aria-label={`剩余 ${count} 张`}
      data-hand-size={count}
    >
      {Array.from({ length: n }, (_, i) => (
        <CardView key={i} faceDown small style={{ zIndex: i + 1 } as CSSProperties} />
      ))}
    </div>
  );
}
