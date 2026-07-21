import { useEffect, useMemo, useState } from 'react';
import {
  HandType,
  RANK,
  type Card,
  type MultiplierBreakdown,
  type PlayRecord,
  type Seat,
  type Suit,
} from '@card-game/rules';
import { HandView } from './HandView';
import { SeatPlayZone } from './SeatPlayZone';
import { SettleCoins } from './SettleCoins';
import { PlayerAvatar } from './PlayerAvatar';
import { MultiplierBreakdownView } from './MultiplierBreakdownView';
import { FX_DEMO_SCENES, MOTION, type FxDemoScene } from '../lib/motionSpec';

function demoCard(id: string, rank: number, suit: Suit | undefined): Card {
  const display =
    rank === RANK.BIG_JOKER
      ? '大王'
      : rank === RANK.SMALL_JOKER
        ? '小王'
        : rank === 11
          ? 'J'
          : rank === 12
            ? 'Q'
            : rank === 13
              ? 'K'
              : rank === 14
                ? 'A'
                : rank === 15
                  ? '2'
                  : String(rank);
  return { id, rank, suit, display };
}

const DEMO_HAND: Card[] = [
  demoCard('d1', 3, 'spade'),
  demoCard('d2', 4, 'heart'),
  demoCard('d3', 5, 'club'),
  demoCard('d4', 6, 'diamond'),
  demoCard('d5', 7, 'spade'),
  demoCard('d6', 8, 'heart'),
  demoCard('d7', 9, 'club'),
  demoCard('d8', 10, 'diamond'),
  demoCard('d9', 11, 'spade'),
  demoCard('d10', 12, 'heart'),
  demoCard('d11', 13, 'club'),
  demoCard('d12', 14, 'diamond'),
  demoCard('d13', 15, 'spade'),
  demoCard('d14', 3, 'heart'),
  demoCard('d15', 4, 'club'),
  demoCard('d16', RANK.SMALL_JOKER, undefined),
  demoCard('d17', RANK.BIG_JOKER, undefined),
];

const DEMO_BREAKDOWN: MultiplierBreakdown = {
  base: 1,
  reveal: true,
  doubleCount: 2,
  doubleSeats: [0, 1] as Seat[],
  bombCount: 1,
  spring: false,
  current: 8,
};

function bombRecord(): PlayRecord {
  const bombCards = (['spade', 'heart', 'club', 'diamond'] as Suit[]).map((suit, i) =>
    demoCard(`bomb-${i}`, 8, suit),
  );
  return {
    seat: 0,
    hand: { type: HandType.BOMB, cards: bombCards, mainRank: 8, length: 1 },
  };
}

function rocketRecord(): PlayRecord {
  return {
    seat: 0,
    hand: {
      type: HandType.ROCKET,
      cards: [
        demoCard('rj1', RANK.SMALL_JOKER, undefined),
        demoCard('rj2', RANK.BIG_JOKER, undefined),
      ],
      mainRank: RANK.BIG_JOKER,
      length: 1,
    },
  };
}

function readScene(): FxDemoScene {
  const q = new URLSearchParams(window.location.search).get('scene');
  if (q && (FX_DEMO_SCENES as string[]).includes(q)) return q as FxDemoScene;
  return 'deal';
}

/**
 * 动效 / UI 演示页：不依赖服务端，供 Playwright 录屏举证。
 * 路由：/fx-demo?scene=deal|select|turn|bomb|rocket|settle|reveal|double|mult
 */
export function FxDemo() {
  const [scene, setScene] = useState<FxDemoScene>(readScene);
  const [dealKey, setDealKey] = useState(1);
  const [fxTick, setFxTick] = useState(1);
  /** LRM-196：选中抬起演示（模拟提示命中） */
  const [selectedIds, setSelectedIds] = useState<string[]>(['d12', 'd8', 'd4']);
  /** LRM-199：可出牌减张，验证未打出牌不整手 remount */
  const [handCards, setHandCards] = useState<Card[]>(DEMO_HAND);

  useEffect(() => {
    const onPop = () => setScene(readScene());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('scene') !== scene) {
      params.set('scene', scene);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [scene]);

  useEffect(() => {
    if (scene === 'deal') {
      setDealKey((k) => k + 1);
      return;
    }
    if (scene === 'bomb' || scene === 'rocket') {
      setFxTick((t) => t + 1);
      const ms = scene === 'rocket' ? MOTION.rocketMs + 400 : MOTION.bombMs + 400;
      const t = window.setInterval(() => setFxTick((n) => n + 1), ms + 600);
      return () => window.clearInterval(t);
    }
  }, [scene]);

  const bombPlay = useMemo(() => bombRecord(), []);
  const rocketPlay = useMemo(() => rocketRecord(), []);

  return (
    <div className="fx-demo" data-scene={scene}>
      <header className="fx-demo-bar">
        <h1>UI / 动效演示</h1>
        <div className="btn-row">
          {FX_DEMO_SCENES.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn${scene === s ? ' primary' : ''}`}
              data-scene-btn={s}
              onClick={() => setScene(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      {scene === 'deal' && (
        <div className="table fx-demo-table" data-fx="deal">
          <p className="fx-demo-caption">发牌散开 · {MOTION.dealMs}ms · stagger {MOTION.dealStaggerMs}ms</p>
          <HandView cards={DEMO_HAND} selected={[]} dealKey={dealKey} />
          <div className="btn-row">
            <button type="button" className="btn primary cta" onClick={() => setDealKey((k) => k + 1)}>
              重播发牌
            </button>
          </div>
        </div>
      )}

      {scene === 'select' && (
        <div className="table fx-demo-table" data-fx="select" data-scene="select">
          <p className="fx-demo-caption">
            LRM-196/199 选中抬起 · 出牌减张后未打出牌不整手刷新（发牌结束后仍可抬起）
          </p>
          <HandView
            cards={handCards}
            selected={selectedIds}
            onToggle={(id) =>
              setSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            dealKey={dealKey}
          />
          <p className="hint" role="status">
            {selectedIds.length > 0 ? `已选 ${selectedIds.length} 张 · 可出` : '未选牌'}
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
            >
              清空
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => setSelectedIds(['d15', 'd5', 'd9'].filter((id) => handCards.some((c) => c.id === id)))}
            >
              提示 1/3
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setHandCards(DEMO_HAND);
                setSelectedIds(['d12', 'd8', 'd4']);
                setDealKey((k) => k + 1);
              }}
            >
              重播发牌
            </button>
            <button
              type="button"
              className="btn primary cta"
              data-play-hand
              disabled={selectedIds.length === 0}
              onClick={() => {
                const played = new Set(selectedIds);
                setHandCards((prev) => prev.filter((c) => !played.has(c.id)));
                setSelectedIds([]);
              }}
            >
              出牌
            </button>
          </div>
        </div>
      )}

      {scene === 'turn' && (
        <div className="table fx-demo-table" data-fx="turn">
          <p className="fx-demo-caption">轮到谁金色脉冲 · {MOTION.turnPulseMs}ms · 局部、无全屏泛光</p>
          <div className="fx-demo-seats">
            <div className="seat-badge">
              <div className="avatar">
                <PlayerAvatar kind="player" />
              </div>
              <div className="seat-name">上家</div>
            </div>
            <div className="seat-badge active turn-pulse">
              <div className="avatar">
                <PlayerAvatar kind="player" />
              </div>
              <div className="seat-name">当前行动</div>
              <div className="seat-count">剩 12</div>
            </div>
            <div className="seat-badge">
              <div className="avatar">
                <PlayerAvatar kind="player" />
              </div>
              <div className="seat-name">下家</div>
            </div>
          </div>
          <div className="turn-line mine">👉 轮到你出牌</div>
          <div className="btn-row">
            <button type="button" className="btn">
              不出
            </button>
            <button type="button" className="btn primary cta">
              出牌
            </button>
          </div>
        </div>
      )}

      {(scene === 'bomb' || scene === 'rocket') && (
        <div className="table fx-demo-table" data-fx={scene}>
          <p className="fx-demo-caption">
            {scene === 'bomb' ? '炸弹' : '王炸'}档位特效 ·
            {scene === 'bomb' ? MOTION.bombMs : MOTION.rocketMs}ms · 局部爆点、无大面积闪光
          </p>
          <div className="fx-demo-bomb-stage">
            <SeatPlayZone
              key={fxTick}
              record={scene === 'bomb' ? bombPlay : rocketPlay}
              fxActive
              align="center"
            />
          </div>
          <div className="btn-row">
            <button type="button" className="btn primary cta">
              出牌
            </button>
          </div>
        </div>
      )}

      {scene === 'settle' && (
        <div className="table settled settled-win fx-demo-table" data-fx="settle">
          <div className="result-card" data-fx="settle-pop">
            <SettleCoins win />
            <img className="result-badge" src="/states/victory-badge.svg" alt="" aria-hidden="true" />
            <h2>你赢了</h2>
            <p className="result-meta">农民胜 · 单注 8</p>
            <MultiplierBreakdownView variant="settle" multiplier={8} breakdown={DEMO_BREAKDOWN} />
            <p className="scores">得分：你 +16　对手 -8　对手 -8</p>
            <div className="result-actions">
              <button type="button" className="btn primary cta">
                <img src="/badges/restart.svg" alt="" className="btn-icon" width={18} height={18} />
                再来一局
              </button>
              <button type="button" className="btn secondary">
                返回大厅
              </button>
            </div>
          </div>
        </div>
      )}

      {scene === 'reveal' && (
        <div className="table is-bidding fx-demo-table" data-fx="reveal" data-scene="reveal">
          <p className="fx-demo-caption">LRM-194 明牌决策 CTA（地主窗口）</p>
          <div
            className="meta-corner meta-corner--mult"
            style={{ position: 'relative', top: 0, left: 0, transform: 'none' }}
          >
            <MultiplierBreakdownView
              variant="hud"
              multiplier={1}
              breakdown={{
                ...DEMO_BREAKDOWN,
                reveal: false,
                doubleCount: 0,
                bombCount: 0,
                current: 1,
              }}
            />
          </div>
          <div className="turn-line mine">👉 地主可选择明牌（×2）</div>
          <div className="bid-cta-layer" role="group" aria-label="明牌操作">
            <div className="bid-cta-panel">
              <p className="bid-cta-title">是否明牌（×2）</p>
              <p className="bid-cta-sub">明牌后全员可见你的手牌，本局倍数 ×2</p>
              <div className="bid-cta-row">
                <button type="button" className="btn bid-pass">
                  不明牌
                </button>
                <button type="button" className="btn primary cta bid-claim">
                  明牌
                </button>
              </div>
            </div>
          </div>
          <HandView cards={DEMO_HAND} selected={[]} />
        </div>
      )}

      {scene === 'double' && (
        <div className="table is-bidding fx-demo-table" data-fx="double" data-scene="double">
          <p className="fx-demo-caption">LRM-194 加倍决策 CTA + 座位加倍角标</p>
          <div className="fx-demo-seats">
            <div className="seat-badge is-doubled">
              <div className="avatar">
                <PlayerAvatar kind="player" />
                <img
                  className="double-badge-corner"
                  src="/states/double-badge.svg"
                  alt=""
                  aria-hidden="true"
                />
              </div>
              <div className="seat-name">
                上家
                <span className="seat-double-tag">加倍</span>
              </div>
            </div>
            <div className="seat-badge active turn-pulse">
              <div className="avatar">
                <PlayerAvatar kind="player" />
              </div>
              <div className="seat-name">你</div>
            </div>
            <div className="seat-badge">
              <div className="avatar">
                <PlayerAvatar kind="player" />
              </div>
              <div className="seat-name">下家</div>
            </div>
          </div>
          <div className="turn-line mine">👉 可选择加倍（×2）</div>
          <div className="bid-cta-layer" role="group" aria-label="加倍操作">
            <div className="bid-cta-panel">
              <p className="bid-cta-title">是否加倍（×2）</p>
              <p className="bid-cta-sub">可选；多人加倍可叠加</p>
              <div className="bid-cta-row">
                <button type="button" className="btn bid-pass">
                  不加倍
                </button>
                <button type="button" className="btn primary cta bid-claim">
                  加倍
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scene === 'mult' && (
        <div className="table fx-demo-table" data-fx="mult" data-scene="mult">
          <p className="fx-demo-caption">LRM-194 桌面倍数构成 HUD（叫分/明牌/加倍/炸弹/春天）</p>
          <div
            className="meta-corner meta-corner--mult"
            style={{ position: 'relative', top: 0, left: 0, transform: 'none', margin: '24px auto' }}
          >
            <span className="turn-timer" aria-hidden="true">
              12
            </span>
            <MultiplierBreakdownView variant="hud" multiplier={8} breakdown={DEMO_BREAKDOWN} />
            <span className="meta-phase">阶段：出牌中</span>
          </div>
        </div>
      )}
    </div>
  );
}
