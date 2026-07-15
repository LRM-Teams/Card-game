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
  return (
    <div className="hand">
      {sorted.map((c) => (
        <CardView
          key={c.id}
          card={c}
          selected={selected.includes(c.id)}
          onClick={onToggle ? () => onToggle(c.id) : undefined}
        />
      ))}
    </div>
  );
}
