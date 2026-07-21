import { useEffect, useMemo, useState } from 'react';
import { HandType, RANK, type Card, type PlayRecord, type Suit } from '@card-game/rules';
import { HandView } from './HandView';
import { SeatPlayZone } from './SeatPlayZone';
import { SettleCoins } from './SettleCoins';
import { PlayerAvatar } from './PlayerAvatar';
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
 * LRM-168 动效演示页：不依赖服务端，供 Playwright 录屏举证。
 * 路由：/fx-demo?scene=deal|turn|bomb|rocket|settle
 */
export function FxDemo() {
  const [scene, setScene] = useState<FxDemoScene>(readScene);
  const [dealKey, setDealKey] = useState(1);
  const [fxTick, setFxTick] = useState(1);

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
        <h1>LRM-168 动效演示</h1>
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

      {scene === 'turn' && (
        <div className="table fx-demo-table" data-fx="turn">
          <p className="fx-demo-caption">轮到谁金色脉冲 · {MOTION.turnPulseMs}ms · 局部、无全屏泛光</p>
          <div className="fx-demo-seats">
            <div className="seat-badge">
              <div className="avatar"><PlayerAvatar kind="player" /></div>
              <div className="seat-name">上家</div>
            </div>
            <div className="seat-badge active turn-pulse">
              <div className="avatar"><PlayerAvatar kind="player" /></div>
              <div className="seat-name">当前行动</div>
              <div className="seat-count">剩 12</div>
            </div>
            <div className="seat-badge">
              <div className="avatar"><PlayerAvatar kind="player" /></div>
              <div className="seat-name">下家</div>
            </div>
          </div>
          <div className="turn-line mine">👉 轮到你出牌</div>
          <div className="btn-row">
            <button type="button" className="btn">不出</button>
            <button type="button" className="btn primary cta">出牌</button>
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
            <button type="button" className="btn primary cta">出牌</button>
          </div>
        </div>
      )}

      {scene === 'settle' && (
        <div className="table settled settled-win fx-demo-table" data-fx="settle">
          <div className="result-card" data-fx="settle-pop">
            <SettleCoins win />
            <img className="result-badge" src="/states/victory-badge.svg" alt="" aria-hidden="true" />
            <h2>你赢了</h2>
            <p>农民胜 · 倍数 ×2 · 单注 1</p>
            <p className="scores">得分：你 +2　对手 -1　对手 -1</p>
            <div className="btn-row">
              <button type="button" className="btn primary cta">再来一局</button>
              <button type="button" className="btn">返回大厅</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
