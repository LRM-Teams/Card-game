import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { GamePhase, canPlay, identifyHand } from '@card-game/rules';
import { cardOf, HAND_TYPE_LABEL } from '../lib/cards';
import { useGameStore } from '../store/gameStore';
import { HandView } from './HandView';
import { CardView } from './CardView';
import { PlayerAvatar } from './PlayerAvatar';
import { useNavigate } from '@tanstack/react-router';

/** 对局桌面：渲染服务端 snapshot，出牌/叫地主交互发动作给服务端。 */
export function GameTable() {
  const snapshot = useGameStore((s) => s.snapshot);
  const mySeat = useGameStore((s) => s.mySeat);
  const myHand = useGameStore((s) => s.myHand);
  const selected = useGameStore((s) => s.selected);
  const status = useGameStore((s) => s.status);
  const lastError = useGameStore((s) => s.lastError);
  const toggleSelect = useGameStore((s) => s.toggleSelect);
  const clearSelect = useGameStore((s) => s.clearSelect);
  const requestHint = useGameStore((s) => s.requestHint);
  const hintMessage = useGameStore((s) => s.hintMessage);
  const hints = useGameStore((s) => s.hints);
  const play = useGameStore((s) => s.play);
  const pass = useGameStore((s) => s.pass);
  const bid = useGameStore((s) => s.bid);
  const start = useGameStore((s) => s.start);
  const dismissError = useGameStore((s) => s.dismissError);
  const navigate = useNavigate();

  const selectedCards = useMemo(
    () => myHand.filter((c) => selected.includes(c.id)),
    [myHand, selected],
  );
  const [secondsLeft, setSecondsLeft] = useState(20);

  useEffect(() => {
    setSecondsLeft(20);
    if (snapshot?.turnSeat == null || snapshot.phase === GamePhase.SETTLED) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((n) => Math.max(0, n - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.phase, snapshot?.turnSeat, snapshot?.lastPlay?.seat, snapshot?.lastPlay?.hand.cards.length]);

  if (status !== 'connected') {
    return (
      <div className="panel">
        <h1 className="title">未连接服务器</h1>
        <p className="subtitle">请先启动 apps/server（:3000），客户端会自动重连。</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="panel">
        <h1 className="title">等待对局…</h1>
        <p className="subtitle">先回大厅匹配并开始游戏。</p>
      </div>
    );
  }

  const phase = snapshot.phase;
  const isMyTurn = snapshot.turnSeat === mySeat;
  const me = snapshot.players.find((p) => p.seat === mySeat);
  const opponents = snapshot.players.filter((p) => p.seat !== mySeat);
  const lastPlay = snapshot.lastPlay;
  const nameOf = (seat: number | null | undefined) =>
    seat == null ? '' : snapshot.players.find((p) => p.seat === seat)?.name ?? `座位${seat}`;

  const identified = selectedCards.length > 0 ? identifyHand(selectedCards) : null;
  const beats = identified != null && canPlay(lastPlay?.hand ?? null, selectedCards);
  const canPlayNow = isMyTurn && phase === GamePhase.PLAYING && identified != null && beats;

  const liveHint =
    selectedCards.length === 0
      ? lastPlay
        ? `上家出 ${HAND_TYPE_LABEL[lastPlay.hand.type]}；管上或不出`
        : '自由出牌'
      : identified == null
        ? '不是合法牌型（提示，权威在服务端）'
        : `${HAND_TYPE_LABEL[identified.type]} · ${beats ? '可压过' : '管不上'}`;

  if (phase === GamePhase.SETTLED && snapshot.result) {
    const r = snapshot.result;
    const myWin =
      (r.winnerSide === 'landlord' && mySeat === r.landlordSeat) ||
      (r.winnerSide === 'farmer' && mySeat !== r.landlordSeat);
    const resultAsset = myWin ? '/states/victory-badge.svg' : '/states/defeat-badge.svg';
    return (
      <div className="table settled">
        <div className="result-card">
          <img className="result-badge" src={resultAsset} alt="" aria-hidden="true" />
          <h2>{myWin ? '🎉 你赢了' : '😞 你输了'}</h2>
          <p>
            {r.winnerSide === 'landlord' ? '地主' : '农民'}胜 · 倍数 ×{r.multiplier} · 单注 {r.unit}
          </p>
          <p className="scores">
            得分：{r.scores.map((sc, i) => `${nameOf(i)} ${sc >= 0 ? '+' : ''}${sc}`).join('　')}
          </p>
          <div className="btn-row">
            <button className="btn primary" onClick={() => start(false)}>
              <img src="/badges/restart.svg" alt="" className="btn-icon" />再来一局
            </button>
            <button className="btn" onClick={() => navigate({ to: '/' })}>返回大厅</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="table">
      <div className="opponents">
        <SeatBadge p={opponents[0]} active={snapshot.turnSeat === opponents[0]?.seat} />
        <div className="center">
          <div className="meta-row">
            <span>倍数 ×{snapshot.multiplier}</span>
            <span>阶段：{phaseLabel(phase)}</span>
          </div>
          <div className="last-play">
            {lastPlay ? (
              <>
                <div className="last-label">
                  <b className="last-player">{nameOf(lastPlay.seat)}</b> 出了
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
          {snapshot.bottomRevealed && snapshot.bottom.length > 0 && (
            <div className="bottom-row">
              <span className="last-label">底牌：</span>
              {snapshot.bottom.map((id) => {
                const c = cardOf(id);
                return c ? <CardView key={id} card={c} small /> : null;
              })}
            </div>
          )}
        </div>
        <SeatBadge p={opponents[1]} active={snapshot.turnSeat === opponents[1]?.seat} />
      </div>

      <div className={`turn-line ${isMyTurn ? 'mine' : ''}`}>
        {snapshot.turnSeat != null && (phase === GamePhase.BIDDING || phase === GamePhase.PLAYING) && (
          <span
            className={`turn-timer ${secondsLeft <= 3 ? 'danger' : ''}`}
            style={{ '--timer-deg': `${(secondsLeft / 20) * 360}deg` } as CSSProperties}
            aria-label={`倒计时 ${secondsLeft} 秒`}
          >
            {secondsLeft}
          </span>
        )}
        <span>
          {phase === GamePhase.BIDDING
            ? isMyTurn
              ? '👉 轮到你叫地主'
              : `等待 ${nameOf(snapshot.turnSeat ?? null)} 叫地主`
            : phase === GamePhase.PLAYING
              ? isMyTurn
                ? '👉 轮到你出牌'
                : `等待 ${nameOf(snapshot.turnSeat ?? null)} 出牌`
              : phaseLabel(phase)}
        </span>
        {me?.role === 'landlord' && <RoleBadge role="landlord" />}
        {me?.role === 'farmer' && <RoleBadge role="farmer" />}
      </div>

      <HandView cards={myHand} selected={selected} onToggle={toggleSelect} />

      <div className="controls">
        <div className={`hint ${canPlayNow ? 'ok' : 'warn'}`}>{hintMessage ?? liveHint}</div>

        {phase === GamePhase.BIDDING && isMyTurn ? (
          <div className="btn-row">
            <button className="btn primary" onClick={() => bid('claim')}>叫地主</button>
            <button className="btn" onClick={() => bid('pass')}>不叫</button>
          </div>
        ) : (
          <div className="btn-row">
            <button className="btn" onClick={clearSelect} disabled={selected.length === 0}>
              清空
            </button>
            <button
              className="btn"
              onClick={requestHint}
              disabled={!(isMyTurn && phase === GamePhase.PLAYING)}
              title="AI 出牌提示（DouZero）"
            >
              提示{hints.length > 1 ? ` ${hintIndexLabel(hints.length)}` : ''}
            </button>
            <button
              className="btn"
              onClick={pass}
              disabled={!(isMyTurn && phase === GamePhase.PLAYING && lastPlay)}
            >
              不出
            </button>
            <button className="btn primary cta" onClick={play} disabled={!canPlayNow}>
              出牌
            </button>
          </div>
        )}
      </div>

      {lastError && (
        <div className="err-toast" onClick={dismissError}>
          ⚠️ {lastError.message}（{lastError.code}）— 点击关闭
        </div>
      )}
    </div>
  );
}

function SeatBadge({
  p,
  active,
}: {
  p: { name: string; isBot: boolean; handSize: number; role?: string } | undefined;
  active: boolean;
}) {
  if (!p) return <div className="seat-badge" />;
  const roleAsset = p.role === 'landlord' ? '/identity/landlord-character.svg' : p.role === 'farmer' ? '/identity/farmer-character.svg' : null;
  const roleLabel = p.role === 'landlord' ? '地主' : p.role === 'farmer' ? '农民' : null;
  return (
    <div className={`seat-badge ${active ? 'active' : ''} ${p.role ?? ''}`}>
      <div className="avatar">
        {roleAsset ? <img className="role-character" src={roleAsset} alt={roleLabel ?? ''} /> : <PlayerAvatar kind="player" />}
      </div>
      <div className="seat-name">{p.name}{roleLabel ? `（${roleLabel}）` : ''}</div>
      <div className="seat-count">剩 {p.handSize}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: 'landlord' | 'farmer' }) {
  const label = role === 'landlord' ? '地主' : '农民';
  return (
    <span className={`badge ${role === 'farmer' ? 'farmer' : ''}`}>
      <img src={`/badges/${role}.svg`} alt="" aria-hidden="true" />{label}
    </span>
  );
}

function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case GamePhase.WAITING:
      return '等待开局';
    case GamePhase.DEALING:
      return '发牌中';
    case GamePhase.BIDDING:
      return '叫地主';
    case GamePhase.PLAYING:
      return '出牌中';
    case GamePhase.SETTLED:
      return '已结算';
    default:
      return String(phase);
  }
}

/** 提示按钮后缀：有多组建议时显示组数，提示可重复点切换。 */
function hintIndexLabel(count: number): string {
  return count > 1 ? ` ·${count}组` : '';
}
