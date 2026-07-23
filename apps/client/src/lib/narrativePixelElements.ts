/** LRM-417 叙事像素独立元素 — 由 elements-catalog.json 驱动 */
import catalog from './narrative-pixel-elements-catalog.json';

export const NP_BASE = '/narrative-pixel';

type CatalogEntry = { path: string; width: number; height: number };
type Catalog = Record<string, Record<string, CatalogEntry>>;

const cat = catalog as Catalog;

export type NpCategory = keyof typeof cat;

export function npElement(category: NpCategory, id: string): string {
  const entry = cat[category]?.[id];
  return entry ? `/${entry.path}` : '';
}

export function npMeta(category: NpCategory, id: string): CatalogEntry | undefined {
  return cat[category]?.[id];
}

/** 建筑 */
export const npBuildings = {
  teahouse: () => npElement('buildings', 'building_teahouse_main'),
  leftApt: () => npElement('buildings', 'building_left_apartment'),
  rightApt: () => npElement('buildings', 'building_right_apartment'),
  powerPole: () => npElement('buildings', 'power_pole'),
} as const;

/** 道具 */
export const npProps = {
  signTeahouse: () => npElement('props', 'sign_teahouse_neon'),
  signFaded: () => npElement('props', 'sign_mahjong_faded'),
  lantern: () => npElement('props', 'lantern_hanging'),
  cardTable: () => npElement('props', 'card_table_outdoor'),
  cardStack: () => npElement('props', 'card_stack'),
  chair: () => npElement('props', 'chair_stool'),
  crateStack: () => npElement('props', 'bottle_crate_stack'),
  cone: () => npElement('props', 'traffic_cone'),
  laundry: () => npElement('props', 'hanging_laundry'),
  puddle: () => npElement('tiles', 'puddle_reflection'),
  manhole: () => npElement('props', 'manhole'),
  newspaper: () => npElement('props', 'newspaper'),
  fence: () => npElement('props', 'fence_wood'),
} as const;

/** 人物/NPC */
export const npCharacters = {
  oldMan: () => npElement('characters', 'npc_old_man_walk'),
  cardPlayers: () => npElement('characters', 'npc_card_players'),
  idle: () => npElement('characters', 'npc_player_idle'),
  cat: () => npElement('characters', 'npc_cat_walk'),
  bicycle: () => npElement('characters', 'npc_bicycle'),
  scooter: () => npElement('characters', 'npc_scooter'),
  shadow: () => npElement('characters', 'npc_shadow'),
  bushFg: () => npElement('characters', 'bush_foreground'),
  bushLarge: () => npElement('characters', 'bush_large'),
} as const;

/** UI 状态帧 */
export const npUiStates = {
  tvOff: () => npElement('ui/states', 'tv_screen_off'),
  tvDefault: () => npElement('ui/states', 'tv_screen_default'),
  tvHover: () => npElement('ui/states', 'tv_screen_hover'),
  tvLoading: () => npElement('ui/states', 'tv_screen_loading'),
  tvError: () => npElement('ui/states', 'tv_screen_error'),
  stationBoard: () => npElement('ui/states', 'station_board_empty'),
  ledger: () => npElement('ui/states', 'ledger_book_open'),
  btnWoodDefault: () => npElement('ui/states', 'btn_wood_default'),
  btnWoodHover: () => npElement('ui/states', 'btn_wood_hover'),
  avatarFrame: () => npElement('ui/states', 'avatar_frame_default'),
  avatarFrameSelected: () => npElement('ui/states', 'avatar_frame_selected'),
} as const;

/** 元素统计 */
export const npElementCounts = Object.fromEntries(
  Object.entries(cat).map(([k, v]) => [k, Object.keys(v).length]),
) as Record<string, number>;

export const npTotalElements = Object.values(npElementCounts).reduce((a, b) => a + b, 0);
