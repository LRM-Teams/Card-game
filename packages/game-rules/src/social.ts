/**
 * 局内表情 / 快捷语（LRM-177）—— 固定白名单，禁止自由文字。
 * 资源为自制 SVG/CSS；服务端只做校验与限频广播。
 */

/** 内置表情 id（与客户端 SVG 一一对应）。 */
export const SOCIAL_EMOTE_IDS = [
  'like',
  'handshake',
  'surprise',
  'cry',
  'angry',
  'smug',
] as const;

export type SocialEmoteId = (typeof SOCIAL_EMOTE_IDS)[number];

/** 固定快捷句 id → 文案。 */
export const SOCIAL_PHRASES = {
  nice_play: '打得不错',
  hurry: '快点出牌',
  sorry: '不好意思',
  again: '再来一局',
  thanks: '谢谢',
  cheer: '加油',
} as const;

export type SocialPhraseId = keyof typeof SOCIAL_PHRASES;

export type SocialKind = 'emote' | 'phrase';

/** 发送冷却（毫秒）；服务端权威，客户端仅做按钮禁用。 */
export const SOCIAL_COOLDOWN_MS = 3000;

/** 气泡展示时长（毫秒）；纯客户端消失。 */
export const SOCIAL_BUBBLE_MS = 2800;

export function isSocialEmoteId(id: string): id is SocialEmoteId {
  return (SOCIAL_EMOTE_IDS as readonly string[]).includes(id);
}

export function isSocialPhraseId(id: string): id is SocialPhraseId {
  return Object.prototype.hasOwnProperty.call(SOCIAL_PHRASES, id);
}
