import type { CSSProperties } from 'react';
import { sortCards, type Card } from '@card-game/rules';
import { CardView } from './CardView';

interface Props {
  cards: Card[];
  selected: string[];
  onToggle?: (id: string) => void;
  /** 发牌散开动效键（变化时重播）。 */
  dealAnimId?: number | null;
}

/** 我的手牌：按点数升序排列，可点选。 */
export function HandView({ cards, selected, onToggle, dealAnimId }: Props) {
  const sorted = sortCards(cards);
  const count = sorted.length || 1;
  const dealing = dealAnimId != null && sorted.length > 0;
  return (
    <div className={`hand${dealing ? ' hand--dealing' : ''}`} key={dealAnimId ?? 'hand'}>
      {sorted.map((c, index) => {
        const offset = index - (count - 1) / 2;
        return (
          <CardView
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            onClick={onToggle ? () => onToggle(c.id) : undefined}
            style={
              {
                '--card-offset': offset,
                '--deal-i': index,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
