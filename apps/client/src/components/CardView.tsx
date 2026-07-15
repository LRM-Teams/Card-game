import type { Card } from '@card-game/rules';
import { SUIT_SYMBOL, cardColor } from '../lib/cards';

interface Props {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  /** 小尺寸（用于对手 / 牌桌展示）。 */
  small?: boolean;
}

export function CardView({ card, selected, onClick, small }: Props) {
  const color = cardColor(card);
  const symbol = card.suit ? SUIT_SYMBOL[card.suit] : '';
  const isJoker = !card.suit;
  return (
    <button
      type="button"
      className={`card ${color} ${isJoker ? 'is-joker' : ''} ${selected ? 'is-selected' : ''} ${small ? 'is-small' : ''}`}
      onClick={onClick}
      disabled={!onClick}
      title={card.display}
      aria-label={card.display}
    >
      <span className="card-corner top">{card.display}</span>
      <span className="card-rank">{card.display}</span>
      {symbol && <span className="card-suit">{symbol}</span>}
      <span className="card-corner bottom">{symbol || '★'}</span>
    </button>
  );
}
