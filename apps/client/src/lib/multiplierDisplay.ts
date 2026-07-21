import type { MultiplierBreakdown } from '@card-game/rules';

/** 倍数构成单项（叫分 / 明牌 / 加倍 / 炸弹 / 春天）。 */
export interface MultiplierPart {
  key: 'bid' | 'reveal' | 'double' | 'bomb' | 'spring';
  label: string;
  factor: number;
  /** 是否实际触发翻倍（factor > 1）。 */
  active: boolean;
}

/** 将服务端 MultiplierBreakdown 拆成桌面/结算统一展示的 5 段。 */
export function breakdownParts(b: MultiplierBreakdown): MultiplierPart[] {
  const doubleFactor = b.doubleCount > 0 ? 2 ** b.doubleCount : 1;
  const bombFactor = b.bombCount > 0 ? 2 ** b.bombCount : 1;
  return [
    { key: 'bid', label: '叫分', factor: b.base || 1, active: true },
    { key: 'reveal', label: '明牌', factor: b.reveal ? 2 : 1, active: b.reveal },
    {
      key: 'double',
      label: '加倍',
      factor: doubleFactor,
      active: b.doubleCount > 0,
    },
    {
      key: 'bomb',
      label: '炸弹',
      factor: bombFactor,
      active: b.bombCount > 0,
    },
    { key: 'spring', label: '春天', factor: b.spring ? 2 : 1, active: b.spring },
  ];
}

/** 一行公式文案，如：叫分×1 · 明牌×2 · 加倍×2 · 炸弹×1 · 春天×1 */
export function formatBreakdownFormula(b: MultiplierBreakdown): string {
  return breakdownParts(b)
    .map((p) => `${p.label}×${p.factor}`)
    .join(' · ');
}

/** 演示 / 缺省构成（协议未带 breakdown 时的兜底）。 */
export function fallbackBreakdown(multiplier: number): MultiplierBreakdown {
  return {
    base: 1,
    reveal: false,
    doubleCount: 0,
    doubleSeats: [],
    bombCount: 0,
    spring: false,
    current: multiplier,
  };
}
