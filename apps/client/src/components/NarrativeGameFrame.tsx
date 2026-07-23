import type { ReactNode } from 'react';
import { NarrativeIndoorScene } from './NarrativeIndoorScene';

/** 对局页室内叙事像素视口：场景层在下，牌桌 HUD 在上 */
export function NarrativeGameFrame({ children }: { children: ReactNode }) {
  return (
    <div className="np-game" data-theme="narrative-pixel-indoor">
      <div className="np-game__viewport">
        <NarrativeIndoorScene />
        <div className="np-game__stage">{children}</div>
      </div>
    </div>
  );
}
