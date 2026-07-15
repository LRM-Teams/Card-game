import { useMemo } from 'react';
import { GamePhase, type PlayerView } from '@card-game/rules';
import { useNavigate } from '@tanstack/react-router';
import { CardView } from './CardView';
import { HandView } from './HandView';
import { HAND_TYPE_LABEL } from '../lib/cards';
import { describeSelection, useGameStore } from '../store/gameStore';

/** 对局桌面：服务端镜像状态 + 选牌 / 出牌 / 叫地主。 */
export function GameTable() {
  const navigate = useNavigate();
  const status = useGameStore((s) => s.status);
  const errorMsg = useGameStore((s) => s.errorMsg);
  const toast = useGameStore((s) => s.toast);
  const roomId = useGameStore((s) => s.roomId);
  const mySeat = useGameStore((s) => s.mySeat);
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const turnSeat = useGameStore((s) => s.turnSeat);
  const landlordSeat = useGameStore((s) => s.landlordSeat);
  const bottom = useGameStore((s) => s.bottom);
  const bottomRevealed = useGameStore((s) => s.bottomRevealed);
  const lastPlay = useGameStore((s) => s.lastPlay);
  const multiplier = useGameStore((s) => s.multiplier);
  const result = useGameStore((s) => s.result);
  const myHand = useGameStore((s) => s.myHand);
  const selected = useGameStore((s) => s.selected);
  const start = useGameStore((s) => s.start);
  const bid = useGameStore((s) => s.bid);
  const toggleSelect = useGameStore((s) => s.toggleSelect);
  const clearSelect = useGameStore((s) => s.clearSelect);
  const play = useGameStore((s) => s.play);
  const pass = useGameStore((s) => s.pass);
  const playAgain = useGameStore((s) => s.playAgain);
  const clearToast = useGameStore((s) => s.clearToast);

  const selectedHint = useMemo(
    () => describeSelection(myHand, selected, lastPlay),
    [lastPlay, myHand, selected],
  );
  const isMyTurn = mySeat !== null && turnSeat === mySeat;
  const canBid = phase === GamePhase.BIDDING && isMyTurn;
  const canPlay = phase === GamePhase.PLAYING && isMyTurn && selectedHint.playable;

  const myPlayer = players.find((p) => p.seat === mySeat);
  const leftSeat = players.find((p) => p.seat === 1);
  const rightSeat = players.find((p) => p.seat === 2);

  const hint = selectedHint.label
    ? selectedHint.label
    : phase === GamePhase.BIDDING
      ? isMyTurn
        ? '轮到你叫地主 / 不叫'
        : '等待叫地主'
      : phase === GamePhase.PLAYING
        ? lastPlay
          ? `轮到你：管上或不出（上家出的是 ${HAND_TYPE_LABEL[lastPlay.hand.type]}）`
          : '轮到你出牌'
        : '等待开局';

  if (!roomId) {
    return (
      <div className="panel room">
        <h1 className="title">对局</h1>
        <p className="subtitle">你还没加入房间，先去大厅匹配。</p>
        <div className="actions">
          <button className="btn primary big" onClick={() => navigate({ to: '/' })}>
            返回大厅
          </button>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.SETTLED && result) {
    return (
      <div className="table settled">
        <div className="result-card">
          <h2>{result.winnerSide === 'landlord' ? '🎉 地主胜' : '🎉 农民胜'}</h2>
          <p>本局结束（联网）</p>
          <div className="summary-grid">
            <div>地主：座位 {result.landlordSeat}</div>
            <div>赢家：座位 {result.winnerSeat}</div>
            <div>倍数：×{result.multiplier}</div>
            <div>单注：{result.unit}</div>
          </div>
          <div className="score-list">
            <span>座位 0：{result.scores[0]}</span>
            <span>座位 1：{result.scores[1]}</span>
            <span>座位 2：{result.scores[2]}</span>
          </div>
          <div className="actions">
            <button className="btn primary big" onClick={playAgain}>
              再来一局
            </button>
            <button className="btn big" onClick={() => navigate({ to: '/room' })}>
              回房间
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="table">
      <div className="topbar">
        <div className="tag">房间 #{roomId}</div>
        <div className="tag">连接：{status}</div>
        <div className="tag">阶段：{phase}</div>
        <div className="tag">倍数 ×{multiplier}</div>
        {landlordSeat !== null && <div className="tag">地主：座位 {landlordSeat}</div>}
        {bottomRevealed && <div className="tag">底牌：{bottom.join(' / ')}</div>}
      </div>

      {(toast || errorMsg) && (
        <button className="error-banner" type="button" onClick={clearToast}>
          {toast ?? errorMsg}
        </button>
      )}

      <div className="opponents">
        <SeatBadge seat={leftSeat} active={turnSeat === 1} />
        <div className="center">
          <div className="last-play">
            {lastPlay ? (
              <>
                <div className="last-label">
                  {lastPlay.seat === mySeat ? '我' : `座位 ${lastPlay.seat}`} 出：
                  <b>{HAND_TYPE_LABEL[lastPlay.hand.type]}</b>
                </div>
                <div className="last-cards">
                  {lastPlay.hand.cards.map((c) => (
                    <CardView key={c.id} card={c} small />
                  ))}
                </div>
              </>
            ) : (
              <div className="last-label muted">桌面空空，自由出牌</div>
            )}
          </div>
        </div>
        <SeatBadge seat={rightSeat} active={turnSeat === 2} />
      </div>

      <div className={`turn-line ${isMyTurn ? 'mine' : ''}`}>
        {phase === GamePhase.BIDDING
          ? isMyTurn
            ? '👉 轮到你叫地主'
            : `等待叫地主（座位 ${turnSeat ?? '-'}）`
          : phase === GamePhase.PLAYING
            ? isMyTurn
              ? '👉 轮到你出牌'
              : `等待出牌（座位 ${turnSeat ?? '-'}）`
            : '等待开局'}
        {myPlayer?.role === 'landlord' && <span className="badge">地主</span>}
      </div>

      <HandView cards={myHand} selected={selected} onToggle={toggleSelect} />

      <div className="controls">
        <div className={`hint ${canPlay || canBid ? 'ok' : 'warn'}`}>{hint}</div>
        <div className="btn-row">
          {phase === GamePhase.WAITING && (
            <>
              <button className="btn primary" onClick={start}>
                请求开局
              </button>
              <button className="btn" onClick={() => navigate({ to: '/room' })}>
                回房间
              </button>
            </>
          )}
          {phase === GamePhase.BIDDING && (
            <>
              <button className="btn primary" onClick={() => bid('claim')} disabled={!canBid}>
                叫地主
              </button>
              <button className="btn" onClick={() => bid('pass')} disabled={!canBid}>
                不叫
              </button>
            </>
          )}
          {phase === GamePhase.PLAYING && (
            <>
              <button className="btn" onClick={clearSelect} disabled={selected.length === 0}>
                清空
              </button>
              <button className="btn" onClick={pass} disabled={!lastPlay || !isMyTurn}>
                不出
              </button>
              <button className="btn primary" onClick={play} disabled={!canPlay}>
                出牌
              </button>
            </>
          )}
        </div>
      </div>

      <div className="player-strip">
        {players.map((p) => (
          <SeatBadge key={p.seat} seat={p} active={turnSeat === p.seat} />
        ))}
      </div>
    </div>
  );
}

function SeatBadge({ seat, active }: { seat: PlayerView | undefined; active: boolean }) {
  if (!seat) return <div className="seat-badge muted">等待</div>;
  return (
    <div className={`seat-badge ${active ? 'active' : ''}`}>
      <div className="avatar">{seat.isBot ? '🤖' : '🙂'}</div>
      <div className="seat-name">{seat.name}</div>
      <div className="seat-count">剩余 {seat.handSize}</div>
      {seat.role && <div className="seat-role">{seat.role === 'landlord' ? '地主' : '农民'}</div>}
    </div>
  );
}
