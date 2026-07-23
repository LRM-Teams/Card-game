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

/** 室外·大厅叙事元素 */
export const narrativeLobbyScenePlacements: ScenePlacement[] = [
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

/** @deprecated 使用 narrativeLobbyScenePlacements */
export const narrativeScenePlacements = narrativeLobbyScenePlacements;

/** 室内·对局页装饰元素（茶馆牌桌环境，角色站位参考 concept-indoor-game） */
export const narrativeGameScenePlacements: ScenePlacement[] = [
  // 墙面装饰 z=5
  { id: 'G01', category: 'tiles', sprite: 'window_lit_56x72', left: 6, top: 7, width: 10, z: 5 },
  { id: 'G02', category: 'tiles', sprite: 'window_lit_56x72', left: 83, top: 6, width: 11, z: 5 },
  { id: 'G03', category: 'props', sprite: 'sign_mahjong_faded', left: 12, top: 22, width: 9, z: 6 },
  { id: 'G04', category: 'props', sprite: 'poster_peeling', left: 78, top: 20, width: 4, z: 6 },
  // 吊灯 z=8
  { id: 'G05', category: 'props', sprite: 'lantern_hanging', left: 48, top: 2, width: 4, z: 8 },
  { id: 'G06', category: 'tiles', sprite: 'lantern_glow', left: 46, top: 6, width: 8, z: 7 },
  // 两侧置物架 z=10
  { id: 'G07', category: 'tiles', sprite: 'wood_plank', left: 3, top: 65, width: 8, z: 10 },
  { id: 'G08', category: 'tiles', sprite: 'wood_plank', left: 89, top: 63, width: 7, z: 10 },
  { id: 'G09', category: 'props', sprite: 'bottle_crate_stack', left: 4, top: 58, width: 6, z: 11 },
  { id: 'G10', category: 'tiles', sprite: 'tea_cup', left: 5, top: 64, width: 2, z: 12 },
  { id: 'G11', category: 'tiles', sprite: 'beer_bottle', left: 90, top: 66, width: 2, z: 12 },
  { id: 'G12', category: 'props', sprite: 'pot_plant', left: 91, top: 58, width: 4, z: 11 },
  // 角色站位（装饰 NPC，与真实座位错开） z=15
  { id: 'G13', category: 'characters', sprite: 'npc_player_idle', left: 8, top: 38, width: 5, z: 15 },
  { id: 'G14', category: 'characters', sprite: 'npc_old_man_walk', left: 86, top: 36, width: 5, z: 15, flip: true },
  { id: 'G15', category: 'characters', sprite: 'npc_shadow', left: 9, top: 44, width: 4, z: 14 },
  { id: 'G16', category: 'characters', sprite: 'npc_shadow', left: 87, top: 42, width: 4, z: 14 },
  // 凳椅 z=12
  { id: 'G17', category: 'props', sprite: 'chair_stool', left: 14, top: 72, width: 3, z: 12 },
  { id: 'G18', category: 'props', sprite: 'chair_stool', left: 83, top: 72, width: 3, z: 12 },
  // 前景 dust z=20
  { id: 'G19', category: 'tiles', sprite: 'dust_particle', left: 42, top: 12, width: 1, z: 20 },
  { id: 'G20', category: 'tiles', sprite: 'dust_particle', left: 55, top: 10, width: 1, z: 20 },
];
