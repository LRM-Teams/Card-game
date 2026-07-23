import { npElement } from '../lib/narrativePixelElements';
import { narrativeScenePlacements } from '../lib/narrativeSceneLayout';

/** 叙事像素场景元素层 — 独立精灵按布局摆放 */
export function NarrativeSceneElements() {
  return (
    <div className="np-scene-elements" aria-hidden>
      {narrativeScenePlacements.map((p) => {
        const src = npElement(p.category, p.sprite);
        if (!src) return null;
        return (
          <img
            key={p.id}
            className="np-scene-element"
            src={src}
            alt=""
            draggable={false}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.width}%`,
              zIndex: p.z,
              transform: p.flip ? 'scaleX(-1)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
