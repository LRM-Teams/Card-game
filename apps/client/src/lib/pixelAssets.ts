/** LRM-408/416：像素风资产路径（`public/pixel/` 镜像 `docs/assets/pixel/`） */
export const PIXEL = {
  backgrounds: {
    lobbyHero: '/pixel/backgrounds/lobby_hero.png',
    roomBg: '/pixel/backgrounds/room_bg.png',
  },
  tiles: {
    felt: '/pixel/tiles/felt_texture.png',
    rail: '/pixel/tiles/rail_texture.png',
  },
  ui: {
    cardFront: '/pixel/ui/card_front_template.png',
    cardBack: '/pixel/ui/card_back.png',
    jokerSmall: '/pixel/ui/joker_small.png',
    jokerBig: '/pixel/ui/joker_big.png',
    badgeLandlord: '/pixel/ui/badge_landlord.png',
    badgeFarmer: '/pixel/ui/badge_farmer.png',
    btnPrimary: '/pixel/ui/btn_primary.png',
    doubleBadge: '/pixel/ui/double_badge.png',
    victoryBadge: '/pixel/ui/victory_badge.png',
    defeatBadge: '/pixel/ui/defeat_badge.png',
  },
  characters: {
    landlord: '/pixel/characters/landlord_character.png',
    farmer: '/pixel/characters/farmer_character.png',
  },
  effects: {
    bomb: '/pixel/effects/bomb.png',
    spring: '/pixel/effects/spring.png',
  },
} as const;

export function roleBadgeSrc(role: 'landlord' | 'farmer'): string {
  return role === 'landlord' ? PIXEL.ui.badgeLandlord : PIXEL.ui.badgeFarmer;
}

export function roleCharacterSrc(role: 'landlord' | 'farmer'): string {
  return role === 'landlord' ? PIXEL.characters.landlord : PIXEL.characters.farmer;
}
