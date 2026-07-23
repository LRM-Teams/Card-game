import { indoorGameDecor, indoorGameLayers } from '../lib/narrativeGameSceneLayout';

/** 叙事像素室内对局背景层（木墙 / 灯笼光晕 / 暗角 + 可选装饰） */
export function NarrativeIndoorScene() {
  return (
    <div className="np-game__scene" aria-hidden>
      <img className="np-game__layer np-game__layer--wall" src={indoorGameLayers.wall} alt="" draggable={false} />
      <img className="np-game__layer np-game__layer--lamp" src={indoorGameLayers.lamp} alt="" draggable={false} />
      {indoorGameDecor.map((d) => (
        <img
          key={d.id}
          className="np-game__decor"
          src={d.src}
          alt=""
          draggable={false}
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: `${d.width}%`,
            zIndex: d.z ?? 4,
          }}
        />
      ))}
      <img
        className="np-game__layer np-game__layer--vignette"
        src={indoorGameLayers.vignette}
        alt=""
        draggable={false}
      />
    </div>
  );
}
