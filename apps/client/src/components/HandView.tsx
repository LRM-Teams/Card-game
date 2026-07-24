import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { sortCards, type Card } from '@card-game/rules';
import { CardView } from './CardView';
import { MOTION } from '../lib/motionSpec';

interface Props {
  cards: Card[];
  selected: string[];
  onToggle?: (id: string) => void;
  /** 发牌散开动效触发键（dealt 时刷新）。 */
  dealKey?: number;
  /** 非行动回合：整手不可出态（降饱和）。 */
  muted?: boolean;
}

/** 我的手牌：按点数升序排列，可点选；发牌时从中央散开。 */
export function HandView({ cards, selected, onToggle, dealKey = 0, muted = false }: Props) {
  const sorted = sortCards(cards);
  const count = sorted.length || 1;
  const [dealing, setDealing] = useState(false);
  /** 仅在 dealKey 递增时用当时手牌张数算 stagger，避免出牌减牌重触发整手散开（LRM-199）。 */
  const dealCountRef = useRef(sorted.length);

  useLayoutEffect(() => {
    if (dealKey <= 0) {
      setDealing(false);
      return;
    }
    dealCountRef.current = sorted.length;
    setDealing(true);
    // 等 stagger 最长牌播完后去掉 is-dealing，避免 fill-mode 锁死 transform 盖住选中抬起
    const maxDelay = Math.max(0, dealCountRef.current - 1) * MOTION.dealStaggerMs;
    const t = window.setTimeout(() => setDealing(false), MOTION.dealMs + maxDelay + 40);
    return () => window.clearTimeout(t);
    // 故意不依赖 sorted.length：出牌后张数变化不得重播发牌动画
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dealKey 是唯一触发源
  }, [dealKey]);

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
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            unplayable={muted}
            onClick={onToggle ? () => onToggle(c.id) : undefined}
            style={
              {
                '--card-offset': offset,
                /* 左高右低：角标在左上，右侧牌不得盖住左侧可读区（Frank / LRM-579） */
                zIndex: selected.includes(c.id)
                  ? count - index + 40
                  : count - index,
                animationDelay: delay,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
