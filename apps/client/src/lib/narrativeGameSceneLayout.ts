/** LRM-518/520：室内对局场景层与装饰热点（1920×1080 基准，百分比定位） */

const NP_INDOOR = '/narrative-pixel/indoor';

export const indoorGameLayers = {
  wall: `${NP_INDOOR}/layer-wall-1920x1080.png`,
  lamp: `${NP_INDOOR}/layer-lamp-glow-1920x1080.png`,
  vignette: `${NP_INDOOR}/layer-vignette-indoor-1920x1080.png`,
} as const;

export type IndoorDecorPlacement = {
  id: string;
  src: string;
  left: number;
  top: number;
  width: number;
  z?: number;
};

export const indoorGameDecor: IndoorDecorPlacement[] = [
  {
    id: 'shelf',
    src: `${NP_INDOOR}/shelf_props_128.png`,
    left: 3,
    top: 16,
    width: 7,
    z: 4,
  },
  {
    id: 'tea-steam',
    src: `${NP_INDOOR}/tea_steam_16.png`,
    left: 86,
    top: 58,
    width: 1.2,
    z: 4,
  },
];

export const indoorSeatMarkers = {
  landlord: `${NP_INDOOR}/seat_landlord_marker.png`,
  farmer: `${NP_INDOOR}/seat_farmer_marker.png`,
} as const;
