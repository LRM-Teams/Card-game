import type { ReactNode } from 'react';
import { narrativePixelGameScene } from '../lib/narrativePixelAssets';
import { NarrativeSceneElements } from './NarrativeSceneElements';

/** 叙事像素室内对局场景壳 — 木墙/暖光 + 精灵装饰，牌桌 UI 叠于上层 */
export function NarrativeGameScene({ children }: { children: ReactNode }) {
  return (
    <div className="np-game" data-theme="narrative-pixel">
      <div className="np-game__viewport">
        <img
          className="np-game__layer np-game__layer--wall"
          src={narrativePixelGameScene.layers.wall}
          alt=""
          aria-hidden
          draggable={false}
        />
        <NarrativeSceneElements variant="game" />
        <img
          className="np-game__layer np-game__layer--light"
          src={narrativePixelGameScene.layers.lighting}
          alt=""
          aria-hidden
          draggable={false}
        />
        <div className="np-game__playfield">{children}</div>
      </div>
    </div>
  );
}
