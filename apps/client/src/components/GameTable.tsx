import { useMemo } from 'react';
import { canBeat, identifyHand } from '@card-game/rules';
import { useGameStore } from '../store/gameStore';
import { HAND_TYPE_LABEL } from '../lib/cards';
import { HandView } from './HandView';
import { CardView } from './CardView';

/** 对局桌面：座位 + 桌面（上一手） + 我的手牌 + 选牌出牌交互。 */
export function GameTable() {
  const s = useGameStore();

  const selectedCards = useMemo(
    () => s.myHand.filter((c) => s.selected.includes(c.id)),
    [s.myHand, s.selected],
  );

  const identified = selectedCards.length > 0 ? identifyHand(selectedCards) : null;
  const beatsLast = identified && (!s.lastPlay || canBeat(s.lastPlay.hand, identified));
  const canPlay = identified != null && beatsLast;

  const hint =
    selectedCards.length === 0
      ? s.lastPlay
        ? `轮到你：管上或不出（上家出的是 ${HAND_TYPE_LABEL[s.lastPlay.hand.type]}）`
        : '轮到你出牌'
      : identified == null
        ? '选中的牌不是合法牌型（提示）'
        : `${HAND_TYPE_LABEL[identified.type]} · ${beatsLast ? '可压过' : '管不上'}`;

  const mySeat = s.seats.find((x) => x.seat === s.mySeat);
  const leftSeat = s.seats.find((x) => x.seat === 1);
  const rightSeat = s.seats.find((x) => x.seat === 2);
  const isMyTurn = s.turn === s.mySeat;

  if (s.phase === 'settled') {
    return (
      <div className="table settled">
        <div className="result-card">
          <h2>🎉 本局结束（mock）</h2>
          <p>你出完了所有手牌。</p>
          <div className="actions">
            <button className="btn primary big" onClick={s.reset}>再来一局</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="table">
      <div className="opponents">
        <SeatBadge seat={leftSeat} active={s.turn === 1} />
        <div className="center">
          <div className="last-play">
            {s.lastPlay ? (
              <>
                <div className="last-label">
                  {s.lastPlay.seat === s.mySeat ? '我' : `座位 ${s.lastPlay.seat}`} 出：
                  <b>{HAND_TYPE_LABEL[s.lastPlay.hand.type]}</b>
                </div>
                <div className="last-cards">
                  {s.lastPlay.hand.cards.map((c) => (
                    <CardView key={c.id} card={c} small />
                  ))}
                </div>
              </>
            ) : (
              <div className="last-label muted">桌面空空，自由出牌</div>
            )}
          </div>
        </div>
        <SeatBadge seat={rightSeat} active={s.turn === 2} />
      </div>

      <div className={`turn-line ${isMyTurn ? 'mine' : ''}`}>
        {isMyTurn ? '👉 轮到你' : `等待中（座位 ${s.turn}）`}
        {mySeat?.role === 'landlord' && <span className="badge">地主</span>}
      </div>

      <HandView cards={s.myHand} selected={s.selected} onToggle={s.toggleSelect} />

      <div className="controls">
        <div className={`hint ${canPlay ? 'ok' : 'warn'}`}>{hint}</div>
        <div className="btn-row">
          <button className="btn" onClick={s.clearSelect} disabled={s.selected.length === 0}>
            清空
          </button>
          <button className="btn" onClick={s.pass} disabled={!s.lastPlay}>
            不出
          </button>
          <button
            className="btn primary"
            onClick={s.play}
            disabled={!canPlay}
          >
            出牌
          </button>
          <button className="btn ghost" onClick={s.reset}>重开</button>
        </div>
      </div>

      <details className="log">
        <summary>操作日志</summary>
        <ul>
          {s.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function SeatBadge({
  seat,
  active,
}: {
  seat: { name: string; isBot: boolean; cardCount: number; role?: string } | undefined;
  active: boolean;
}) {
  if (!seat) return null;
  return (
    <div className={`seat-badge ${active ? 'active' : ''}`}>
      <div className="avatar">{seat.isBot ? '🤖' : '🙂'}</div>
      <div className="seat-name">{seat.name}</div>
      <div className="seat-count">剩余 {seat.cardCount}</div>
    </div>
  );
}
