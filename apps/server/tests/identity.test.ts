import { describe, expect, it } from 'vitest';
import { DEFAULT_BEANS, IdentityStore } from '../src/identity';

describe('IdentityStore', () => {
  it('签发新游客默认豆子', () => {
    const store = new IdentityStore();
    const p = store.resolve({ name: '甲' });
    expect(p.guestId.startsWith('g-')).toBe(true);
    expect(p.beans).toBe(DEFAULT_BEANS);
    expect(p.avatarId).toBe('av-1');
  });

  it('同 guestId 续档保留豆子；允许改昵称重名', () => {
    const store = new IdentityStore();
    const a = store.resolve({ name: '甲', avatarId: 'av-2' });
    store.applyScore(a.guestId, 3);
    const again = store.resolve({ guestId: a.guestId, name: '乙', avatarId: 'av-5' });
    expect(again.guestId).toBe(a.guestId);
    expect(again.name).toBe('乙');
    expect(again.avatarId).toBe('av-5');
    expect(again.beans).toBe(DEFAULT_BEANS + 3);

    const b = store.resolve({ name: '乙' });
    expect(b.guestId).not.toBe(a.guestId);
    expect(b.name).toBe('乙');
  });

  it('服务端无档时用客户端本地豆子续写同一 guestId', () => {
    const store = new IdentityStore();
    const p = store.resolve({
      guestId: 'g-local',
      name: '本地',
      avatarId: 'av-3',
      beans: 8888,
    });
    expect(p.guestId).toBe('g-local');
    expect(p.beans).toBe(8888);
  });
});
