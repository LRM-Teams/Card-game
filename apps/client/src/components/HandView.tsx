import type { CSSProperties } from 'react';
import { sortCards, type Card } from '@card-game/rules';
import { CardView } from './CardView';
import { MOTION } from '../lib/motionSpec';

interface Props {
  cards: Card[];
  selected: string[];
  onToggle?: (id: string) => void;
  /** 发牌散开动效触发键（dealt 时刷新）。 */
  dealKey?: number;
}

/** 我的手牌：按点数升序排列，可点选；发牌时从中央散开。 */
export function HandView({ cards, selected, onToggle, dealKey = 0 }: Props) {
  const sorted = sortCards(cards);
  const count = sorted.length || 1;
  const dealing = dealKey > 0;
  return (
    <div
      className={`hand${dealing ? ' is-dealing' : ''}`}
      style={{ '--hand-count': sorted.length || 1 } as CSSProperties}
      data-count={sorted.length}
      data-deal-key={dealKey || undefined}
    >
      {sorted.map((c, index) => {
        const offset = index - (count - 1) / 2;
        const delay = dealing ? `${index * MOTION.dealStaggerMs}ms` : undefined;
        return (
          <CardView
            key={`${dealKey}-${c.id}`}
            card={c}
            selected={selected.includes(c.id)}
            onClick={onToggle ? () => onToggle(c.id) : undefined}
            style={
              {
                '--card-offset': offset,
                zIndex: index + 1,
                animationDelay: delay,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
