import { describe, expect, it } from 'vitest';
import {
  defaultDisplayName,
  isValidDisplayName,
  normalizeDisplayName,
} from '../src/displayName';

describe('displayName', () => {
  it('折叠空白并 trim', () => {
    expect(normalizeDisplayName('  小  林  ')).toBe('小 林');
  });

  it('校验 2–12 字符', () => {
    expect(isValidDisplayName('a')).toBe(false);
    expect(isValidDisplayName('ab')).toBe(true);
    expect(isValidDisplayName('abcdefghijkl')).toBe(true);
    expect(isValidDisplayName('abcdefghijklm')).toBe(false);
  });

  it('默认昵称形如 玩家+4位数字', () => {
    const n = defaultDisplayName();
    expect(n).toMatch(/^玩家\d{4}$/);
    expect(isValidDisplayName(n)).toBe(true);
  });
});
