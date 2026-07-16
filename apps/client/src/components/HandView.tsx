import type { CSSProperties } from 'react';
import { sortCards, type Card } from '@card-game/rules';
import { CardView } from './CardView';

interface Props {
  cards: Card[];
  selected: string[];
  onToggle?: (id: string) => void;
}

/** 我的手牌：按点数升序排列，可点选。 */
export function HandView({ cards, selected, onToggle }: Props) {
  const sorted = sortCards(cards);
  const count = sorted.length || 1;
  return (
    <div className="hand">
      {sorted.map((c, index) => {
        const offset = index - (count - 1) / 2;
        return (
          <CardView
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            onClick={onToggle ? () => onToggle(c.id) : undefined}
            style={{ '--card-offset': offset } as CSSProperties}
          />
        );
      })}
    </div>
  );
}
