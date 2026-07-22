/** 入座临时昵称：长度与空白规则（客户端默认生成 + 服务端校验共用）。 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 12;

/** 折叠连续空白并 trim。 */
export function normalizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function isValidDisplayName(raw: string): boolean {
  const n = normalizeDisplayName(raw);
  return n.length >= DISPLAY_NAME_MIN && n.length <= DISPLAY_NAME_MAX;
}

/** 客户端首次进入默认「玩家+随机4位」。 */
export function defaultDisplayName(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `玩家${n}`;
}
