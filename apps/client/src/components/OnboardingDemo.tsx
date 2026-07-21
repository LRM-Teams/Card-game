import { useMemo } from 'react';
import { CoachTip } from './CoachTip';
import { HandView } from './HandView';
import { PlayerAvatar } from './PlayerAvatar';
import { RANK, type Card, type Suit } from '@card-game/rules';

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
  demoCard('o1', 3, 'spade'),
  demoCard('o2', 4, 'heart'),
  demoCard('o3', 5, 'club'),
  demoCard('o4', 6, 'diamond'),
  demoCard('o5', 7, 'spade'),
  demoCard('o6', 8, 'heart'),
  demoCard('o7', 9, 'club'),
  demoCard('o8', 10, 'diamond'),
  demoCard('o9', 11, 'spade'),
  demoCard('o10', 12, 'heart'),
  demoCard('o11', 13, 'club'),
  demoCard('o12', 14, 'diamond'),
  demoCard('o13', 15, 'spade'),
];

/**
 * LRM-181 引导态静态预览（不依赖对局服务端）。
 * /onboarding-demo?scene=identity|start|bid|play|settings
 */
export function OnboardingDemo() {
  const scene = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('scene');
    return q && q.length > 0 ? q : 'identity';
  }, []);

  return (
    <div className="panel onboarding-demo" data-onboarding-scene={scene}>
      <h2 className="title">LRM-181 引导预览 · {scene}</h2>

      {scene === 'identity' && (
        <section className="lobby-player coach-target" aria-label="身份引导">
          <CoachTip
            message="先起个昵称、选个头像，牌友好认出你。"
            primaryLabel="下一步"
            onPrimary={() => undefined}
            onSkip={() => undefined}
          />
          <div className="lobby-identity">
            <PlayerAvatar kind="player" avatarId="av-1" />
            <div>
              <div className="lobby-beans">豆子 1000</div>
              <div className="hint">游客 ID 已本地保存，刷新不清</div>
            </div>
          </div>
          <label className="field lobby-field">
            <span>昵称</span>
            <input type="text" value="游客" readOnly />
          </label>
        </section>
      )}

      {scene === 'start' && (
        <div className="lobby-cta coach-target">
          <CoachTip
            placement="above"
            message="点「开始游戏」快速匹配开局，人不够时 AI 补位。"
            primaryLabel="知道了"
            onPrimary={() => undefined}
            onSkip={() => undefined}
          />
          <button type="button" className="btn primary cta lobby-start">
            开始游戏
          </button>
          <p className="lobby-cta-hint">快速匹配，自动配桌开局</p>
        </div>
      )}

      {scene === 'bid' && (
        <div className="table is-bidding onboarding-demo-table">
          <div className="turn-line mine">
            <span>👉 轮到你叫地主</span>
          </div>
          <div className="bid-cta-layer coach-target" role="group" aria-label="叫地主操作">
            <CoachTip
              className="table-coach"
              placement="above"
              message="叫地主：争抢当地主拿底牌；不叫则跳过。手气好再叫。"
              primaryLabel="知道了"
              onPrimary={() => undefined}
              onSkip={() => undefined}
            />
            <div className="bid-cta-panel">
              <p className="bid-cta-title">请选择</p>
              <div className="bid-cta-row">
                <button type="button" className="btn bid-pass coach-pulse">
                  不叫
                </button>
                <button type="button" className="btn primary cta bid-claim coach-pulse">
                  叫地主
                </button>
              </div>
            </div>
          </div>
          <HandView cards={DEMO_HAND} selected={[]} onToggle={() => undefined} />
        </div>
      )}

      {scene === 'play' && (
        <div className="table onboarding-demo-table">
          <div className="turn-line mine">
            <span>👉 轮到你出牌</span>
          </div>
          <HandView cards={DEMO_HAND} selected={[]} onToggle={() => undefined} />
          <div className="controls coach-target">
            <CoachTip
              className="table-coach"
              placement="above"
              message="选牌后点「出牌」；管不上点「不出」；不会出可点「提示」。"
              primaryLabel="知道了"
              onPrimary={() => undefined}
              onSkip={() => undefined}
            />
            <div className="hint warn">自由出牌</div>
            <div className="btn-row">
              <button type="button" className="btn" disabled>
                清空
              </button>
              <button type="button" className="btn coach-pulse">
                提示
              </button>
              <button type="button" className="btn coach-pulse" disabled>
                不出
              </button>
              <button type="button" className="btn primary cta coach-pulse" disabled>
                出牌
              </button>
            </div>
          </div>
        </div>
      )}

      {scene === 'settings' && (
        <div className="audio-settings-panel onboarding-demo-settings" role="dialog">
          <header className="audio-settings-head">
            <strong>声音设置</strong>
          </header>
          <div className="audio-settings-guide">
            <button type="button" className="btn audio-settings-reset-guide">
              重置新手引导
            </button>
            <p className="audio-settings-guide-hint">
              将重新引导：设昵称头像 → 开始游戏 → 首局操作
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
