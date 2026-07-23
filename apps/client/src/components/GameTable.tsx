import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { GamePhase, HandType, canPlay, identifyHand } from '@card-game/rules';
import { cardOf, HAND_TYPE_LABEL } from '../lib/cards';
import { useGameStore } from '../store/gameStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { HandView } from './HandView';
import { CardView, OpponentBackFan } from './CardView';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerKindBadge, playerKindLabel } from './PlayerKindBadge';
import { SeatPlayZone } from './SeatPlayZone';
import { SettleCoins } from './SettleCoins';
import { GuideSpot } from './GuideSpot';
import { SocialPanel } from './SocialPanel';
import { SocialBubble } from './SocialBubble';
import { MultiplierBreakdownView } from './MultiplierBreakdownView';
import { ConnectionBanner } from './ConnectionBanner';
import { relativeSeats } from '../lib/playFx';
import { MOTION } from '../lib/motionSpec';
import { PIXEL, roleBadgeSrc, roleCharacterSrc } from '../lib/pixelAssets';
import { useNavigate } from '@tanstack/react-router';
import type { ConnStatus } from '../net/socket';

/** 叫分/出牌回合倒计时（秒）。 */
const TURN_SECS = 20;
/** 明牌/加倍决策窗口（与服务端 DECISION_WINDOW_MS=15s 对齐）。 */
const DECISION_SECS = 15;

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
  const hintIndex = useGameStore((s) => s.hintIndex);
  const play = useGameStore((s) => s.play);
  const pass = useGameStore((s) => s.pass);
  const bid = useGameStore((s) => s.bid);
  const reveal = useGameStore((s) => s.reveal);
  const doubleChoice = useGameStore((s) => s.double);
  const guideActive = useOnboardingStore((s) => s.active);
  const seenBidTip = useOnboardingStore((s) => s.seenBidTip);
  const seenPlayTip = useOnboardingStore((s) => s.seenPlayTip);
  const mark = useOnboardingStore((s) => s.mark);
  const start = useGameStore((s) => s.start);
  const dismissError = useGameStore((s) => s.dismissError);
  const seatLastPlays = useGameStore((s) => s.seatLastPlays);
  const playFx = useGameStore((s) => s.playFx);
  const dealKey = useGameStore((s) => s.dealKey);
  const clearPlayFx = useGameStore((s) => s.clearPlayFx);
  const socialBubbles = useGameStore((s) => s.socialBubbles);
  const navigate = useNavigate();
  const leaveToLobby = useGameStore((s) => s.leaveToLobby);

  const selectedCards = useMemo(
    () => myHand.filter((c) => selected.includes(c.id)),
    [myHand, selected],
  );
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECS);

  useEffect(() => {
    if (!snapshot || snapshot.phase === GamePhase.SETTLED) return;
    const isDecision =
      snapshot.phase === GamePhase.REVEALING || snapshot.phase === GamePhase.DOUBLING;
    const maxSecs = isDecision ? DECISION_SECS : TURN_SECS;
    setSecondsLeft(maxSecs);
    if (!isDecision && snapshot.turnSeat == null) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((n) => Math.max(0, n - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [
    snapshot?.phase,
    snapshot?.turnSeat,
    snapshot?.lastPlay?.seat,
    snapshot?.lastPlay?.hand.cards.length,
    snapshot?.pendingDoubleSeats?.join(','),
  ]);

  useEffect(() => {
    if (!playFx) return;
    const hold =
      playFx.handType === HandType.ROCKET
        ? Math.max(MOTION.rocketMs, MOTION.playFxCaptionMs)
        : playFx.handType === HandType.BOMB
          ? Math.max(MOTION.bombMs, MOTION.playFxCaptionMs)
          : MOTION.playFxCaptionMs;
    const t = window.setTimeout(() => clearPlayFx(), hold);
    return () => window.clearTimeout(t);
  }, [playFx, clearPlayFx]);

  if (!snapshot) {
    if (status === 'reconnect_failed') {
      return (
        <>
          <ConnectionBanner status={status} />
          <TableShell message="无法恢复对局" sub="请返回大厅重新匹配或加入房间。" />
        </>
      );
    }
    if (status !== 'connected') {
      return (
        <>
          {status === 'reconnecting' && <ConnectionBanner status={status} />}
          <TableShell
            message={
              status === 'connecting'
                ? '正在连接服务器…'
                : status === 'reconnecting'
                  ? '连接已断开，正在重连…'
                  : '未连接服务器'
            }
            sub="连接恢复后将自动同步牌桌；也可返回大厅重新匹配。"
          />
        </>
      );
    }
    return (
      <TableShell
        message="正在恢复对局…"
        sub="强刷后会自动重回房间；若长时间无响应请返回大厅。"
      />
    );
  }

  const offline = status !== 'connected';

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
    seat == null ? '' : snapshot.players.find((p) => p.seat === seat)?.displayName ?? `座位${seat}`;

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
    const resultAsset = myWin ? PIXEL.ui.victoryBadge : PIXEL.ui.defeatBadge;
    const winnerRole = r.winnerSide === 'landlord' ? 'landlord' : 'farmer';
    const winnerRoleLabel = winnerRole === 'landlord' ? '地主' : '农民';
    const winnerIdentity = roleCharacterSrc(winnerRole);
    return (
      <GameTableFrame status={status} offline={offline}>
      <div className="table settled">
        <div className={`result-card ${myWin ? 'win' : 'lose'}`} data-fx="settle-pop">
          <SettleCoins win={myWin} />
          <img className="result-badge pixel-art" src={resultAsset} alt="" aria-hidden="true" />
          <h2 className="result-title">{myWin ? '你赢了' : '你输了'}</h2>
          <div className="result-identity">
            <img
              className="result-identity-img pixel-art"
              src={winnerIdentity}
              alt=""
              aria-hidden="true"
            />
            <p className="result-meta">
              {winnerRoleLabel}胜 · 单注 {r.unit}
            </p>
            <MultiplierBreakdownView
              variant="settle"
              multiplier={r.multiplier}
              breakdown={r.multiplierBreakdown ?? snapshot.multiplierBreakdown}
            />
          </div>
          <ul className="score-list" aria-label="本局得分">
            {r.scores.map((sc, i) => (
              <li key={i}>
                <span>{nameOf(i)}</span>
                <span className={`score-val ${sc >= 0 ? 'plus' : 'minus'}`}>
                  {sc >= 0 ? '+' : ''}
                  {sc}
                </span>
              </li>
            ))}
          </ul>

          {/* LRM-183：底牌 + 未出完手牌（缩略，不抢主层级） */}
          {((snapshot.bottomRevealed && snapshot.bottom.length > 0) ||
            (r.remainingHands ?? [[], [], []]).some((ids) => ids.length > 0)) && (
            <div className="result-reveal" aria-label="结算亮牌">
              {snapshot.bottomRevealed && snapshot.bottom.length > 0 && (
                <div className="result-reveal-row">
                  <span className="result-reveal-label">底牌</span>
                  <div className="result-reveal-cards">
                    {snapshot.bottom.map((id) => {
                      const c = cardOf(id);
                      return c ? <CardView key={id} card={c} small /> : null;
                    })}
                  </div>
                </div>
              )}
              {(r.remainingHands ?? [[], [], []]).map((ids, seat) => {
                if (!ids.length) return null;
                return (
                  <div className="result-reveal-row" key={seat}>
                    <span className="result-reveal-label">{nameOf(seat)} 余牌</span>
                    <div className="result-reveal-cards">
                      {ids.map((id) => {
                        const c = cardOf(id);
                        return c ? <CardView key={id} card={c} small /> : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="result-actions">
            {/* LRM-197：icon 仅刷新箭头；文案只在按钮文本，避免 SVG 内嵌「再来一局」胶囊套娃 */}
            <button type="button" className="btn primary cta" onClick={() => start(false)}>
              <img src="/badges/restart.svg" alt="" className="btn-icon" width={18} height={18} />
              再来一局
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                leaveToLobby();
                navigate({ to: '/' });
              }}
            >
              返回大厅
            </button>
          </div>
          <div className="emote-chat-bid-dock">
            <SocialPanel enabled />
          </div>
        </div>
      </div>
      </GameTableFrame>
    );
  }

  const isBidding = phase === GamePhase.BIDDING;
  const isRevealing = phase === GamePhase.REVEALING;
  const isDoubling = phase === GamePhase.DOUBLING;
  const canReveal = isRevealing && mySeat != null && mySeat === snapshot.landlordSeat;
  const canDouble =
    isDoubling &&
    mySeat != null &&
    (snapshot.pendingDoubleSeats ?? []).some((s) => s === mySeat);

  const showDecisionTimer = isRevealing || isDoubling;
  const showTurnTimer =
    snapshot.turnSeat != null && (phase === GamePhase.BIDDING || phase === GamePhase.PLAYING);
  const timerMax = showDecisionTimer ? DECISION_SECS : TURN_SECS;

  return (
    <GameTableFrame status={status} offline={offline}>
    <div className={`table${isBidding || isRevealing || isDoubling ? ' is-bidding' : ''}`}>
      <div className="meta-corner meta-corner--mult">
        {(showTurnTimer || showDecisionTimer) && (
          <span
            className={`turn-timer ${secondsLeft <= MOTION.timerDangerSec ? 'danger' : ''}`}
            style={{ '--timer-deg': `${(secondsLeft / timerMax) * 360}deg` } as CSSProperties}
            aria-label={`倒计时 ${secondsLeft} 秒`}
            data-timer-danger={secondsLeft <= MOTION.timerDangerSec ? '1' : '0'}
          >
            {secondsLeft}
          </span>
        )}
        <MultiplierBreakdownView
          variant="hud"
          multiplier={snapshot.multiplier}
          breakdown={snapshot.multiplierBreakdown}
        />
        <span className="meta-phase">阶段：{phaseLabel(phase)}</span>
      </div>

      <div className="table-stage">
        <div className="opponents">
          <div className="opponent-anchor left">
            <SeatBadge
              p={leftPlayer}
              active={
                snapshot.turnSeat === leftPlayer?.seat ||
                (isDoubling &&
                  leftPlayer != null &&
                  (snapshot.pendingDoubleSeats ?? []).includes(leftPlayer.seat))
              }
              bubble={<SocialBubble data={socialBubbles[seats.left]} align="left" />}
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
              active={
                snapshot.turnSeat === rightPlayer?.seat ||
                (isDoubling &&
                  rightPlayer != null &&
                  (snapshot.pendingDoubleSeats ?? []).includes(rightPlayer.seat))
              }
              bubble={<SocialBubble data={socialBubbles[seats.right]} align="right" />}
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
        <span>
          {botThinkingSeat != null
            ? `🤔 ${nameOf(botThinkingSeat)} 思考中…`
            : phase === GamePhase.BIDDING
            ? isMyTurn
              ? '👉 轮到你叫地主'
              : `等待 ${nameOf(snapshot.turnSeat ?? null)} 叫地主`
            : phase === GamePhase.REVEALING
              ? canReveal
                ? '👉 地主可选择明牌（×2）'
                : `等待地主决定是否明牌`
              : phase === GamePhase.DOUBLING
                ? canDouble
                  ? '👉 可选择加倍（×2）'
                  : '等待其他玩家加倍'
                : phase === GamePhase.PLAYING
                  ? isMyTurn
                    ? '👉 轮到你出牌'
                    : `等待 ${nameOf(snapshot.turnSeat ?? null)} 出牌`
                  : phaseLabel(phase)}
        </span>
        {me?.role === 'landlord' && <RoleBadge role="landlord" />}
        {me?.role === 'farmer' && <RoleBadge role="farmer" />}
        {me?.doubled && (
          <span className="badge double-self" aria-label="已加倍" title="已加倍">
            <img className="pixel-art" src={PIXEL.ui.doubleBadge} alt="" aria-hidden="true" />
          </span>
        )}
      </div>

      {/* 叫分主 CTA 弹层：居中于手牌上方，不遮挡手牌点数（baseline 状态2） */}
      {/* 自己座位社交气泡：叫分主 CTA 时也要挂，避免发送后看不到 */}
      {mySeat != null && (
        <div className="self-emote-zone">
          <SocialBubble data={socialBubbles[mySeat]} align="center" />
        </div>
      )}

      {isBidding && isMyTurn ? (
        <GuideSpot
          show={guideActive && !seenBidTip}
          title="叫地主是什么？"
          body="叫地主：争当地主拿底牌，赢了倍数更高；不叫则让下一家决定。选一个就行。"
          onDismiss={() => mark('seenBidTip')}
          className="guide-spot--bid"
        >
          <div className="bid-cta-layer" role="group" aria-label="叫地主操作">
            <div className="bid-cta-panel">
              <p className="bid-cta-title">请选择</p>
              <div className="bid-cta-row">
                <button
                  type="button"
                  className="btn bid-pass"
                  onClick={() => {
                    if (!seenBidTip) mark('seenBidTip');
                    bid('pass');
                  }}
                >
                  不叫
                </button>
                <button
                  type="button"
                  className="btn primary cta bid-claim"
                  onClick={() => {
                    if (!seenBidTip) mark('seenBidTip');
                    bid('claim');
                  }}
                >
                  叫地主
                </button>
              </div>
            </div>
          </div>
        </GuideSpot>
      ) : canReveal ? (
        <div className="bid-cta-layer" role="group" aria-label="明牌操作">
          <div className="bid-cta-panel">
            <p className="bid-cta-title">是否明牌（×2）</p>
            <p className="bid-cta-sub">明牌后全员可见你的手牌，本局倍数 ×2</p>
            <div className="bid-cta-row">
              <button type="button" className="btn bid-pass" onClick={() => reveal(false)}>
                不明牌
              </button>
              <button type="button" className="btn primary cta bid-claim" onClick={() => reveal(true)}>
                明牌
              </button>
            </div>
          </div>
        </div>
      ) : canDouble ? (
        <div className="bid-cta-layer" role="group" aria-label="加倍操作">
          <div className="bid-cta-panel">
            <p className="bid-cta-title">是否加倍（×2）</p>
            <p className="bid-cta-sub">可选；多人加倍可叠加</p>
            <div className="bid-cta-row">
              <button type="button" className="btn bid-pass" onClick={() => doubleChoice(false)}>
                不加倍
              </button>
              <button
                type="button"
                className="btn primary cta bid-claim"
                onClick={() => doubleChoice(true)}
              >
                加倍
              </button>
            </div>
          </div>
        </div>
      ) : isDoubling &&
        mySeat != null &&
        !(snapshot.pendingDoubleSeats ?? []).includes(mySeat as 0 | 1 | 2) ? (
        <div className="bid-cta-layer" role="status" aria-label="加倍已提交">
          <div className="bid-cta-panel bid-cta-panel--quiet">
            <p className="bid-cta-title">
              {me?.doubled ? '已加倍 · 等待他人' : '已跳过 · 等待他人'}
            </p>
          </div>
        </div>
      ) : (
        mySeat != null && (
          <div className="self-seat-play">
            <SeatPlayZone
              record={seatLastPlays[mySeat]}
              fxActive={playFx?.seat === mySeat}
              align="center"
            />
          </div>
        )
      )}

      <HandView
        cards={myHand}
        selected={selected}
        onToggle={toggleSelect}
        dealKey={dealKey}
        muted={phase === GamePhase.PLAYING && !isMyTurn}
      />

      {/* 出牌控件：叫分/明牌/加倍阶段隐藏 */}
      {!isBidding && !isRevealing && !isDoubling && (
        <GuideSpot
          show={guideActive && !seenPlayTip && isMyTurn && phase === GamePhase.PLAYING}
          title="出牌操作"
          body="点选手牌后点「出牌」；压不住可「不出」；「提示」会给出建议（可连点切换）。"
          onDismiss={() => mark('seenPlayTip')}
          className="guide-spot--play"
        >
          <div
            className={`controls${guideActive && !seenPlayTip && isMyTurn && phase === GamePhase.PLAYING ? ' controls--guide' : ''}`}
          >
            <div className={`hint ${canPlayNow ? 'ok' : 'warn'}`}>{hintMessage ?? liveHint}</div>
            <div className="btn-row">
              <button className="btn" onClick={clearSelect} disabled={selected.length === 0}>
                清空
              </button>
              <button
                className="btn guide-hot"
                onClick={() => {
                  if (!seenPlayTip) mark('seenPlayTip');
                  requestHint();
                }}
                disabled={!(isMyTurn && phase === GamePhase.PLAYING)}
                title="AI 出牌提示（DouZero）"
              >
                提示{hints.length > 0 ? ` ${hintIndexLabel(hintIndex, hints.length)}` : ''}
              </button>
              <button
                className="btn guide-hot"
                onClick={() => {
                  if (!seenPlayTip) mark('seenPlayTip');
                  pass();
                }}
                disabled={!(isMyTurn && phase === GamePhase.PLAYING && lastPlay)}
              >
                不出
              </button>
              <button
                className="btn primary cta guide-hot"
                onClick={() => {
                  if (!seenPlayTip) mark('seenPlayTip');
                  play();
                }}
                disabled={!canPlayNow}
              >
                出牌
              </button>
              <SocialPanel enabled={phase === GamePhase.PLAYING || phase === GamePhase.SETTLED} />
            </div>
          </div>
        </GuideSpot>
      )}

      {(isBidding || isRevealing || isDoubling) && (
        <div className="emote-chat-bid-dock">
          <SocialPanel enabled />
        </div>
      )}

      {lastError && (
        <div className="err-toast" onClick={dismissError}>
          ⚠️ {lastError.message}（{lastError.code}）— 点击关闭
        </div>
      )}
    </div>
    </GameTableFrame>
  );
}

/** 牌桌外层：断线 banner / 恢复 toast，离线时冻结交互。 */
function GameTableFrame({
  status,
  offline,
  children,
}: {
  status: ConnStatus;
  offline: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <ConnectionBanner status={status} />
      <div className={offline ? 'table-offline-wrap' : undefined}>{children}</div>
    </>
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
  bubble,
}: {
  p:
    | {
        displayName: string;
        isBot: boolean;
        handSize: number;
        role?: string;
        avatarId?: string;
        doubled?: boolean;
        openHand?: string[];
      }
    | undefined;
  active: boolean;
  play?: ReactNode;
  bubble?: ReactNode;
}) {
  if (!p) return <div className="seat-badge" />;
  const role = p.role === 'landlord' || p.role === 'farmer' ? p.role : null;
  const roleLabel = role === 'landlord' ? '地主' : role === 'farmer' ? '农民' : null;
  const roleClass = role ? `role-${role}` : '';
  const openCards = (p.openHand ?? [])
    .map((id) => cardOf(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .slice(0, 8);
  return (
    <div
      className={`seat-badge ${active ? 'is-turn turn-pulse' : ''} ${roleClass}${p.doubled ? ' is-doubled' : ''}`}
      aria-label={[
        p.displayName,
        playerKindLabel(p.isBot),
        roleLabel,
        p.doubled ? '已加倍' : null,
        active ? '行动中' : null,
      ]
        .filter(Boolean)
        .join('，')}
    >
      <div className="avatar-wrap">
        <div className="avatar">
          <PlayerAvatar kind="player" avatarId={p.avatarId} />
          <PlayerKindBadge isBot={p.isBot} />
          {role && (
            <img
              className="role-badge-corner pixel-art"
              src={roleBadgeSrc(role)}
              alt=""
              aria-hidden="true"
            />
          )}
          {p.doubled && (
            <img
              className="double-badge-corner pixel-art"
              src={PIXEL.ui.doubleBadge}
              alt=""
              aria-hidden="true"
            />
          )}
        </div>
        {bubble}
      </div>
      <div className="seat-name">
        {p.displayName}
        <span className={`seat-kind-inline ${p.isBot ? 'bot' : 'human'}`}>
          {playerKindLabel(p.isBot)}
        </span>
        {p.doubled ? <span className="seat-double-tag">加倍</span> : null}
      </div>
      <div className="seat-count">剩 {p.handSize}</div>
      {/* LRM-207：非明牌时展示牌背扇，避免只剩数字占位 */}
      {openCards.length === 0 && p.handSize > 0 ? (
        <OpponentBackFan count={p.handSize} />
      ) : null}
      {openCards.length > 0 && (
        <div className="seat-open-hand" aria-label="明牌手牌">
          {openCards.map((c) => (
            <CardView key={c.id} card={c} small />
          ))}
          {(p.openHand?.length ?? 0) > openCards.length ? (
            <span className="seat-open-more">+{(p.openHand?.length ?? 0) - openCards.length}</span>
          ) : null}
        </div>
      )}
      {play}
    </div>
  );
}

/** 身份角标：只留图标，文案走 aria-label，避免徽章+文字双叠。 */
function RoleBadge({ role }: { role: 'landlord' | 'farmer' }) {
  const label = role === 'landlord' ? '地主' : '农民';
  return (
    <span
      className={`badge identity-only ${role === 'farmer' ? 'farmer' : ''}`}
      aria-label={label}
      title={label}
    >
      <img className="pixel-art" src={roleBadgeSrc(role)} alt="" aria-hidden="true" />
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
    case GamePhase.REVEALING:
      return '明牌';
    case GamePhase.DOUBLING:
      return '加倍';
    case GamePhase.PLAYING:
      return '出牌中';
    case GamePhase.SETTLED:
      return '已结算';
    default:
      return String(phase);
  }
}

/** 提示按钮后缀：显示当前组 / 总组数，提示可重复点切换。 */
function hintIndexLabel(index: number, count: number): string {
  return ` ${index + 1}/${count}`;
}
