import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { GamePhase, canPlay, identifyHand } from '@card-game/rules';
import { cardOf, HAND_TYPE_LABEL } from '../lib/cards';
import { useGameStore } from '../store/gameStore';
import { HandView } from './HandView';
import { CardView } from './CardView';
import { PlayerAvatar } from './PlayerAvatar';
import { SeatPlayZone } from './SeatPlayZone';
import { relativeSeats } from '../lib/playFx';
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
  const seatLastPlays = useGameStore((s) => s.seatLastPlays);
  const playFx = useGameStore((s) => s.playFx);
  const clearPlayFx = useGameStore((s) => s.clearPlayFx);
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

  useEffect(() => {
    if (!playFx) return;
    const t = window.setTimeout(() => clearPlayFx(), 2000);
    return () => window.clearTimeout(t);
  }, [playFx, clearPlayFx]);

  if (status !== 'connected') {
    return (
      <TableShell
        message={status === 'connecting' ? '正在连接服务器…' : '未连接服务器'}
        sub="连接恢复后将自动同步牌桌；也可返回大厅重新匹配。"
      />
    );
  }

  if (!snapshot) {
    return (
      <TableShell
        message="正在恢复对局…"
        sub="强刷后会自动重回房间；若长时间无响应请返回大厅。"
      />
    );
  }

  const phase = snapshot.phase;
  const isMyTurn = snapshot.turnSeat === mySeat;
  const me = snapshot.players.find((p) => p.seat === mySeat);
  const seats =
    mySeat != null ? relativeSeats(mySeat) : { left: 0, right: 1 };
  const playerAt = (seat: number) => snapshot.players.find((p) => p.seat === seat);
  const leftPlayer = playerAt(seats.left);
  const rightPlayer = playerAt(seats.right);
  const lastPlay = snapshot.lastPlay;
  const botThinkingSeat = snapshot.botThinkingSeat;
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
      <div className="meta-corner" aria-hidden="true">
        <span>倍数 ×{snapshot.multiplier}</span>
        <span>阶段：{phaseLabel(phase)}</span>
      </div>

      <div className="table-stage">
        <div className="opponents">
          <div className="opponent-anchor left">
            <SeatBadge
              p={leftPlayer}
              active={snapshot.turnSeat === leftPlayer?.seat}
              play={
                <SeatPlayZone
                  record={seatLastPlays[seats.left]}
                  fxActive={playFx?.seat === seats.left}
                  align="left"
                />
              }
            />
          </div>
          <div className="opponent-anchor right">
            <SeatBadge
              p={rightPlayer}
              active={snapshot.turnSeat === rightPlayer?.seat}
              play={
                <SeatPlayZone
                  record={seatLastPlays[seats.right]}
                  fxActive={playFx?.seat === seats.right}
                  align="right"
                />
              }
            />
          </div>
        </div>

        <div className="table-center-play" aria-label="桌面中央区">
          {snapshot.bottomRevealed && snapshot.bottom.length > 0 && (
            <div className="bottom-row">
              <span className="last-label">底牌：</span>
              {snapshot.bottom.map((id) => {
                const c = cardOf(id);
                return c ? <CardView key={id} card={c} small tablePlay /> : null;
              })}
            </div>
          )}
        </div>
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
          {botThinkingSeat != null
            ? `🤔 ${nameOf(botThinkingSeat)} 思考中…`
            : phase === GamePhase.BIDDING
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

      {mySeat != null && (
        <div className="self-seat-play">
          <SeatPlayZone
            record={seatLastPlays[mySeat]}
            fxActive={playFx?.seat === mySeat}
            align="center"
          />
        </div>
      )}

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

/** 牌桌占位壳：加载/重连时保持与对局相同的尺寸，避免强刷后布局坍缩跳动。 */
function TableShell({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="table table-shell" aria-busy="true">
      <div className="table-stage">
        <div className="opponents">
          <div className="opponent-anchor left">
            <div className="seat-badge seat-placeholder" aria-hidden="true" />
          </div>
          <div className="opponent-anchor right">
            <div className="seat-badge seat-placeholder" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="turn-line table-shell-status">
        <span>{message}</span>
      </div>
      {sub ? <p className="table-shell-sub">{sub}</p> : null}
      <div className="hand hand-skeleton" aria-hidden="true" />
      <div className="controls controls-skeleton" aria-hidden="true">
        <div className="hint warn table-shell-hint">同步中…</div>
        <div className="btn-row">
          <span className="btn btn-skeleton" />
          <span className="btn btn-skeleton primary" />
        </div>
      </div>
    </div>
  );
}

function SeatBadge({
  p,
  active,
  play,
}: {
  p: { name: string; isBot: boolean; handSize: number; role?: string } | undefined;
  active: boolean;
  play?: ReactNode;
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
      {play}
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
