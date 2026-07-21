/**
 * 游客身份内存仓（MVP，进程内）。
 * guestId → 昵称 / 头像 / 豆子；刷新后客户端带同一 guestId 续上。
 */
import { randomBytes } from 'node:crypto';

export const DEFAULT_AVATAR = 'av-1';
export const DEFAULT_BEANS = 1000;
export const BUILTIN_AVATARS = ['av-1', 'av-2', 'av-3', 'av-4', 'av-5', 'av-6', 'av-7', 'av-8'] as const;

export interface GuestProfile {
  guestId: string;
  name: string;
  avatarId: string;
  beans: number;
}

function newGuestId(): string {
  return `g-${randomBytes(6).toString('hex')}`;
}

function normalizeAvatar(avatarId?: string): string {
  const id = (avatarId ?? DEFAULT_AVATAR).trim();
  return id || DEFAULT_AVATAR;
}

export class IdentityStore {
  private profiles = new Map<string, GuestProfile>();

  /** 用客户端提交的身份 upsert；返回权威档案（含可能新生成的 guestId）。 */
  resolve(input: { name: string; guestId?: string; avatarId?: string; beans?: number }): GuestProfile {
    const name = input.name.trim() || '游客';
    const avatarId = normalizeAvatar(input.avatarId);
    const existingId = input.guestId?.trim();
    if (existingId && this.profiles.has(existingId)) {
      const p = this.profiles.get(existingId)!;
      p.name = name;
      p.avatarId = avatarId;
      return p;
    }
    const guestId = existingId || newGuestId();
    const beans =
      typeof input.beans === 'number' && Number.isFinite(input.beans)
        ? Math.max(0, Math.floor(input.beans))
        : DEFAULT_BEANS;
    const profile: GuestProfile = {
      guestId,
      name,
      avatarId,
      beans,
    };
    this.profiles.set(guestId, profile);
    return profile;
  }

  get(guestId: string): GuestProfile | undefined {
    return this.profiles.get(guestId);
  }

  applyScore(guestId: string, delta: number): number {
    const p = this.profiles.get(guestId);
    if (!p) return DEFAULT_BEANS;
    p.beans = Math.max(0, p.beans + delta);
    return p.beans;
  }
}
