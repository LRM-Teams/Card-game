import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { GamePhase, canPlay, identifyHand } from '@card-game/rules';
import type { BidRound, DoubleChoice } from '@card-game/rules';
import { cardOf, HAND_TYPE_LABEL } from '../lib/cards';
import { useGameStore } from '../store/gameStore';
import { HandView } from './HandView';
import { CardView } from './CardView';
import { PlayerAvatar } from './PlayerAvatar';
// 开源可商用图标（Iconify MDI 集，Apache-2.0），离线打包避免运行时网络依赖。
// 来源：https://icon-sets.iconify.sh/mdi/  License: https://github.com/Templarian/MaterialDesign/blob/master/LICENSE
import { Icon } from '@iconify/react';
import crownIcon from '@iconify-icons/mdi/crown';
import wheatIcon from '@iconify-icons/mdi/wheat';
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
  const double_ = useGameStore((s) => s.double);
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
  const bidRound: BidRound | null = snapshot.bidRound ?? null;
  const bids = snapshot.bids ?? [];
  const doubles = snapshot.doubles ?? [];
  const nameOf = (seat: number | null | undefined) =>
    seat == null ? '' : snapshot.players.find((p) => p.seat === seat)?.name ?? `座位${seat}`;

  const bidLabelFor = (seat: number): string | null => {
    const last = [...bids].reverse().find((b) => b.seat === seat);
    if (!last) return null;
    if (last.choice === 'claim') return last.round === 'grab' ? '抢地主！' : '叫地主！';
    return last.round === 'grab' ? '不抢' : '不叫';
  };
  const doubleChoiceLabel = (c: DoubleChoice) =>
    c === 'double' ? '加倍' : c === 'super' ? '超级加倍' : '不加倍';
  const myDoubleChoice = doubles.find((d) => d.seat === mySeat)?.choice ?? null;
  const doublePhaseHint: string | null =
    phase === GamePhase.DOUBLING
      ? isMyTurn && !myDoubleChoice
        ? '加倍阶段 · 你的决策'
        : myDoubleChoice
          ? `已选：${doubleChoiceLabel(myDoubleChoice)}`
          : `等待 ${nameOf(snapshot.turnSeat)} 加倍决策`
      : null;

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
    return (
      <div className="table settled">
        <div className="result-card">
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
        <SeatBadge
          p={opponents[0]}
          active={snapshot.turnSeat === opponents[0]?.seat}
          bidBubble={opponents[0] ? bidLabelFor(opponents[0].seat) : null}
          doublePill={opponents[0] ? (doubles.find((d) => d.seat === opponents[0]!.seat)?.choice ?? null) : null}
        />
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
        <SeatBadge
          p={opponents[1]}
          active={snapshot.turnSeat === opponents[1]?.seat}
          bidBubble={opponents[1] ? bidLabelFor(opponents[1].seat) : null}
          doublePill={opponents[1] ? (doubles.find((d) => d.seat === opponents[1]!.seat)?.choice ?? null) : null}
        />
      </div>

      <div className={`turn-line ${isMyTurn ? 'mine' : ''}`}>
        {snapshot.turnSeat != null && (phase === GamePhase.BIDDING || phase === GamePhase.PLAYING || phase === GamePhase.DOUBLING) && (
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
              ? bidRound === 'grab'
                ? '👉 你来抢地主'
                : '👉 轮到你叫地主'
              : bidRound === 'grab'
                ? `等待 ${nameOf(snapshot.turnSeat ?? null)} 抢地主`
                : `等待 ${nameOf(snapshot.turnSeat ?? null)} 叫地主`
            : phase === GamePhase.PLAYING
              ? isMyTurn
                ? '👉 轮到你出牌'
                : `等待 ${nameOf(snapshot.turnSeat ?? null)} 出牌`
              : doublePhaseHint ?? phaseLabel(phase)}
        </span>
        {me?.role === 'landlord' && <span className="badge">地主</span>}
        {me?.role === 'farmer' && <span className="badge farmer">农民</span>}
        {myDoubleChoice && phase !== GamePhase.PLAYING && (
          <span className="bid-bubble self">{doubleChoiceLabel(myDoubleChoice)}</span>
        )}
      </div>

      <HandView cards={myHand} selected={selected} onToggle={toggleSelect} />

      <div className="controls">
        <div className={`hint ${canPlayNow ? 'ok' : 'warn'}`}>{hintMessage ?? liveHint}</div>

        {phase === GamePhase.BIDDING && isMyTurn ? (
          <div className="btn-row">
            <button className="btn primary" onClick={() => bid('claim')}>
              {bidRound === 'grab' ? '抢地主' : '叫地主'}
            </button>
            <button className="btn" onClick={() => bid('pass')}>
              {bidRound === 'grab' ? '不抢' : '不叫'}
            </button>
          </div>
        ) : phase === GamePhase.DOUBLING && isMyTurn && !myDoubleChoice ? (
          <div className="btn-row">
            <button className="btn primary" onClick={() => double_('double')}>加倍</button>
            <button className="btn" onClick={() => double_('super')}>超级加倍</button>
            <button className="btn ghost" onClick={() => double_('pass')}>不加倍</button>
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
  bidBubble,
  doublePill,
}: {
  p: { name: string; isBot: boolean; handSize: number; role?: string } | undefined;
  active: boolean;
  bidBubble?: string | null;
  doublePill?: DoubleChoice | null;
}) {
  if (!p) return <div className="seat-badge" />;
  const roleIcon = p.role === 'landlord' ? crownIcon : p.role === 'farmer' ? wheatIcon : null;
  const roleLabel = p.role === 'landlord' ? '地主' : p.role === 'farmer' ? '农民' : null;
  const doublePillLabel = doublePill === 'double' ? '加倍' : doublePill === 'super' ? '超级加倍' : doublePill === 'pass' ? '不加倍' : null;
  return (
    <div className={`seat-badge ${active ? 'active' : ''} ${p.role ?? ''}`}>
      {bidBubble && <div className="bid-bubble" key={bidBubble}>{bidBubble}</div>}
      <div className="avatar">
        <PlayerAvatar kind="player" />
        {roleIcon && (
          <Icon
            className="role-icon"
            icon={roleIcon}
            aria-label={roleLabel ?? undefined}
          />
        )}
      </div>
      <div className="seat-name">{p.name}{roleLabel ? `（${roleLabel}）` : ''}</div>
      <div className="seat-count">剩 {p.handSize}</div>
      {doublePillLabel && <div className="double-pill">{doublePillLabel}</div>}
    </div>
  );
}

function phaseLabel(phase: GamePhase | string): string {
  switch (phase) {
    case GamePhase.WAITING:
      return '等待开局';
    case GamePhase.DEALING:
      return '发牌中';
    case GamePhase.BIDDING:
      return '叫地主';
    case 'doubling':
      return '加倍阶段';
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
