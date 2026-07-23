/** LRM-522：叙事像素结算面板 + 加倍/春天/炸弹特效资产 */
export const NP_SETTLE = {
  panel: '/narrative-pixel/settle/panel_backdrop_480x360.png',
  victory: '/narrative-pixel/settle/victory_illustration_128.png',
  defeat: '/narrative-pixel/settle/defeat_illustration_128.png',
  rematch: {
    default: '/narrative-pixel/settle/btn_rematch_default.png',
    hover: '/narrative-pixel/settle/btn_rematch_hover.png',
    press: '/narrative-pixel/settle/btn_rematch_press.png',
  },
} as const;

export const NP_FX = {
  double: {
    default: '/narrative-pixel/fx/badge_double_default.png',
    active: '/narrative-pixel/fx/badge_double_active.png',
    dim: '/narrative-pixel/fx/badge_double_dim.png',
  },
  spring: '/narrative-pixel/fx/stamp_spring_96x48.png',
  bomb: '/narrative-pixel/fx/stamp_bomb_96x48.png',
  bombFlash: '/narrative-pixel/fx/overlay_bomb_flash_128.png',
} as const;
