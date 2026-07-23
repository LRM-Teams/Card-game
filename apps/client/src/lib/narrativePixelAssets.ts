/** LRM-417 叙事像素大厅资产路径与热点坐标（1920×1080 基准） */
export const NP_BASE = '/narrative-pixel';

export const narrativePixelScene = {
  full: `${NP_BASE}/scene/scene-full-1920x1080.png`,
  native: `${NP_BASE}/scene/ddz-street-scene-v3-640x360.png`,
  layers: {
    far: `${NP_BASE}/scene/layer-far-bg-1920x1080.png`,
    mid: `${NP_BASE}/scene/layer-mid-buildings-1920x1080.png`,
    fg: `${NP_BASE}/scene/layer-fg-occluder-1920x1080.png`,
    lighting: `${NP_BASE}/lighting/layer-lighting-1920x1080.png`,
  },
} as const;

export const narrativePixelUi = {
  tvStart: `${NP_BASE}/ui/ui-tv-start-200x140.png`,
  stationBoard: `${NP_BASE}/ui/ui-station-board-280x100.png`,
  ledgerPanel: `${NP_BASE}/ui/ui-ledger-panel-128x96.png`,
} as const;

export const narrativePixelCharacters = {
  row: `${NP_BASE}/characters/sprites-characters-row-512x128.png`,
} as const;

/** 世界化 UI 热点 — 百分比定位（left/top/width/height） */
export const narrativePixelHotspots = {
  /** 旧电视 = 开始游戏 CTA */
  tvStart: { left: 58, top: 42, width: 12, height: 14 },
  /** 木质站牌 = 房间码 */
  stationBoard: { left: 6, top: 62, width: 18, height: 10 },
  /** 登记簿 = 昵称/头像 */
  ledger: { left: 68, top: 68, width: 28, height: 22 },
  /** 茶馆门口牌桌区（装饰，无交互） */
  cardTable: { left: 38, top: 52, width: 22, height: 18 },
} as const;

export type NarrativePixelHotspot = keyof typeof narrativePixelHotspots;

/** 室内·对局页场景图层（LRM-518） */
export const narrativePixelGameScene = {
  layers: {
    wall: `${NP_BASE}/scene/layer-indoor-wall-1920x1080.png`,
    lighting: `${NP_BASE}/lighting/layer-indoor-lighting-1920x1080.png`,
  },
} as const;
