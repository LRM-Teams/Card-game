import type { CSSProperties } from 'react';
import { RANK, type Card } from '@card-game/rules';
import { SUIT_SYMBOL, cardColor } from '../lib/cards';

interface Props {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  /** 小尺寸（用于对手 / 牌桌展示）。 */
  small?: boolean;
  style?: CSSProperties;
}

export function CardView({ card, selected, onClick, small, style }: Props) {
  const color = cardColor(card);
  const symbol = card.suit ? SUIT_SYMBOL[card.suit] : '';
  const isJoker = !card.suit;
  const jokerAsset = card.rank === RANK.BIG_JOKER ? '/cards/joker-big.svg' : card.rank === RANK.SMALL_JOKER ? '/cards/joker-small.svg' : null;
  return (
    <button
      type="button"
      className={`card ${color} ${isJoker ? 'is-joker' : ''} ${selected ? 'is-selected' : ''} ${small ? 'is-small' : ''}`}
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
          <span className="card-corner top">{card.display}</span>
          <span className="card-rank">{card.display}</span>
          {symbol && <span className="card-suit">{symbol}</span>}
          <span className="card-corner bottom">{symbol || '★'}</span>
        </>
      )}
    </button>
  );
}
