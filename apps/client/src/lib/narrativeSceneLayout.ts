/** 1920×1080 基准场景元素摆放（百分比） */
export type ScenePlacement = {
  id: string;
  category: 'buildings' | 'props' | 'characters' | 'tiles';
  sprite: string;
  left: number;
  top: number;
  width: number;
  z: number;
  flip?: boolean;
};

export const narrativeScenePlacements: ScenePlacement[] = [
  // 建筑层 z=10
  { id: 'B03', category: 'buildings', sprite: 'building_left_apartment', left: 0, top: 18, width: 28, z: 10 },
  { id: 'B01', category: 'buildings', sprite: 'building_teahouse_main', left: 30, top: 22, width: 40, z: 11 },
  { id: 'B04', category: 'buildings', sprite: 'building_right_apartment', left: 62, top: 20, width: 38, z: 10 },
  { id: 'B14', category: 'buildings', sprite: 'power_pole', left: 72, top: 0, width: 8, z: 12 },
  // 道具层 z=20
  { id: 'V08', category: 'props', sprite: 'hanging_laundry', left: 4, top: 32, width: 14, z: 20 },
  { id: 'P01', category: 'props', sprite: 'sign_teahouse_neon', left: 38, top: 28, width: 16, z: 21 },
  { id: 'P09', category: 'props', sprite: 'lantern_hanging', left: 34, top: 30, width: 4, z: 22 },
  { id: 'P09b', category: 'props', sprite: 'lantern_hanging', left: 58, top: 30, width: 4, z: 22 },
  { id: 'P06', category: 'props', sprite: 'card_table_outdoor', left: 40, top: 52, width: 14, z: 23 },
  { id: 'P07', category: 'props', sprite: 'card_stack', left: 44, top: 50, width: 3, z: 24 },
  { id: 'P05', category: 'props', sprite: 'traffic_cone', left: 82, top: 68, width: 2, z: 25 },
  { id: 'P03', category: 'props', sprite: 'bottle_crate_stack', left: 78, top: 62, width: 10, z: 24 },
  { id: 'P27', category: 'props', sprite: 'poster_peeling', left: 6, top: 42, width: 5, z: 21 },
  { id: 'P21', category: 'tiles', sprite: 'puddle_reflection', left: 28, top: 72, width: 12, z: 26 },
  { id: 'C05', category: 'characters', sprite: 'npc_bicycle', left: 3, top: 58, width: 8, z: 27 },
  // 人物层 z=30
  { id: 'C03', category: 'characters', sprite: 'npc_card_players', left: 38, top: 48, width: 18, z: 30 },
  { id: 'C02', category: 'characters', sprite: 'npc_old_man_walk', left: 52, top: 54, width: 6, z: 31 },
  { id: 'C04', category: 'characters', sprite: 'npc_cat_walk', left: 32, top: 68, width: 3, z: 32 },
  // 前景 z=40
  { id: 'V12', category: 'characters', sprite: 'bush_foreground', left: -2, top: 62, width: 22, z: 40 },
  { id: 'B17', category: 'props', sprite: 'fence_wood', left: 88, top: 55, width: 6, z: 41 },
];
