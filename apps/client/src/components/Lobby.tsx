import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';
import { useOnboardingStore } from '../store/onboardingStore';
import {
  BUILTIN_AVATARS,
  DISPLAY_NAME_MAX,
  isValidDisplayName,
  normalizeDisplayName,
  readIdentity,
  saveIdentity,
  type GuestIdentity,
} from '../lib/session';
import { PlayerAvatar } from './PlayerAvatar';
import { GuideSpot } from './GuideSpot';

function readRoomQuery(): string {
  try {
    return new URLSearchParams(window.location.search).get('room')?.trim() ?? '';
  } catch {
    return '';
  }
}

/** 大厅：游客身份 + 唯一主 CTA「开始游戏」(匹配) + 次级房间码入口。 */
export function Lobby() {
  const navigate = useNavigate();
  const join = useGameStore((s) => s.join);
  const match = useGameStore((s) => s.match);
  const cancelMatch = useGameStore((s) => s.cancelMatch);
  const matching = useGameStore((s) => s.matching);
  const status = useGameStore((s) => s.status);
  const lastError = useGameStore((s) => s.lastError);
  const dismissError = useGameStore((s) => s.dismissError);
  const beans = useGameStore((s) => s.beans);
  const roomId = useGameStore((s) => s.roomId);
  const snapshot = useGameStore((s) => s.snapshot);
  const guideActive = useOnboardingStore((s) => s.active);
  const seenIdentity = useOnboardingStore((s) => s.seenIdentity);
  const seenStart = useOnboardingStore((s) => s.seenStart);
  const mark = useOnboardingStore((s) => s.mark);

  const [identity, setIdentity] = useState<GuestIdentity>(() => readIdentity());
  const [roomCode, setRoomCode] = useState(readRoomQuery);
  const deepLinkPending = useRef(Boolean(readRoomQuery()));
  const deepLinkDone = useRef(false);

  const trimmedNick = normalizeDisplayName(identity.displayName);
  const trimmedRoomCode = roomCode.trim();
  const canAct = isValidDisplayName(trimmedNick) && status === 'connected' && !matching;
  const canJoinRoom = canAct && trimmedRoomCode.length > 0;
  const showIdentityGuide = guideActive && !seenIdentity && !matching;
  const showStartGuide = guideActive && seenIdentity && !seenStart && !matching;

  // 匹配成功入房后跳转
  useEffect(() => {
    if (roomId && snapshot) navigate({ to: '/room' });
  }, [roomId, snapshot, navigate]);

  // 分享链接 ?room=xxx：连上后自动加入私房（只触发一次）
  useEffect(() => {
    if (!deepLinkPending.current || deepLinkDone.current || !canJoinRoom || roomId) return;
    deepLinkDone.current = true;
    saveIdentity(identity);
    join(identity, trimmedRoomCode);
    navigate({ to: '/room' });
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room')) {
        url.searchParams.delete('room');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      /* ignore */
    }
  }, [canJoinRoom, roomId, identity, trimmedRoomCode, join, navigate]);

  const persist = (next: GuestIdentity) => {
    setIdentity(next);
    saveIdentity(next);
  };

  const startMatch = () => {
    if (!canAct) return;
    saveIdentity(identity);
    if (!seenStart) mark('seenStart');
    match(identity);
  };

  const enterPrivateRoom = (targetRoomId?: string) => {
    if (!canAct) return;
    if (targetRoomId !== undefined && !targetRoomId.trim()) return;
    saveIdentity(identity);
    join(identity, targetRoomId);
    navigate({ to: '/room' });
  };

  return (
    <div className="panel lobby">
      <div className="lobby-hero" aria-hidden={false}>
        <img
          className="lobby-hero__art"
          src="/lobby/hero-illustration.svg"
          alt="斗地主大厅主视觉插画"
          width={720}
          height={320}
          decoding="async"
        />
        <div className="lobby-hero__copy">
          <h1 className="title lobby-title">斗地主</h1>
          <p className="subtitle lobby-subtitle">游客开玩 · 真人 / 机器人混战</p>
        </div>
      </div>

      {status !== 'connected' && (
        <div className="hint warn">
          {status === 'connecting'
            ? '正在连接服务器…'
            : '未连接到服务器，请先启动 apps/server (:3000)'}
        </div>
      )}

      {lastError && (
        <div className="hint warn lobby-error" onClick={dismissError}>
          失败：{lastError.message}（{lastError.code}）
        </div>
      )}

      {matching ? (
        <div className="matching-panel" role="status" aria-live="polite">
          <p className="subtitle matching-panel__title">正在寻找真人玩家…</p>
          <p className="hint matching-panel__hint">凑齐三人即开；暂无人则自动补机器人</p>
          <button className="btn big" type="button" onClick={() => cancelMatch()}>
            取消匹配
          </button>
        </div>
      ) : (
        <>
          <GuideSpot
            show={showIdentityGuide}
            title="先设昵称和头像"
            body="游客开玩：改个昵称、选个头像，身份会保存在本机。"
            onDismiss={() => mark('seenIdentity')}
          >
            <section className="lobby-player" aria-label="玩家信息">
              <div className="lobby-identity">
                <PlayerAvatar kind="player" avatarId={identity.avatarId} />
                <div>
                  <div className="lobby-beans">豆子 {beans ?? identity.beans}</div>
                  <div className="hint">游客 ID 已本地保存，刷新不清</div>
                </div>
              </div>

              <label className="field lobby-field">
                <span>昵称</span>
                <input
                  type="text"
                  placeholder="给自己起个名字"
                  value={identity.displayName}
                  onChange={(e) => persist({ ...identity, displayName: e.target.value })}
                  maxLength={DISPLAY_NAME_MAX}
                  autoFocus
                />
                {!isValidDisplayName(trimmedNick) && (
                  <span className="hint warn">昵称需 2–12 个字符</span>
                )}
              </label>

              <div className="field lobby-field">
                <span>头像</span>
                <div className="avatar-picker">
                  {BUILTIN_AVATARS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`avatar-pick ${identity.avatarId === id ? 'selected' : ''}`}
                      onClick={() => persist({ ...identity, avatarId: id })}
                      aria-label={id}
                    >
                      <PlayerAvatar kind="player" avatarId={id} />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </GuideSpot>

          <GuideSpot
            show={showStartGuide}
            title="点「开始游戏」"
            body="快速匹配开局；人不够时会自动补机器人。这是大厅唯一主入口。"
            onDismiss={() => mark('seenStart')}
            className="guide-spot--cta"
          >
            <div className="lobby-cta">
              <button
                className="btn primary cta lobby-start"
                onClick={startMatch}
                disabled={!canAct}
              >
                开始游戏
              </button>
              <p className="lobby-cta-hint">快速匹配，自动配桌开局</p>
            </div>
          </GuideSpot>

          <section className="lobby-secondary" aria-label="房间入口">
            <div className="lobby-secondary__head">
              <span className="lobby-secondary__label">私房</span>
              <span className="lobby-secondary__mute">次入口</span>
            </div>
            <label className="field lobby-field lobby-field--compact">
              <span>房间码</span>
              <input
                type="text"
                placeholder="输入房间号加入好友同桌"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.trim())}
                onKeyDown={(e) =>
                  e.key === 'Enter' && canJoinRoom && enterPrivateRoom(trimmedRoomCode)
                }
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>
            <div className="actions lobby-actions">
              <button className="btn lobby-join" onClick={() => enterPrivateRoom()} disabled={!canAct}>
                创建房间
              </button>
              <button
                className="btn lobby-join"
                onClick={() => enterPrivateRoom(trimmedRoomCode)}
                disabled={!canJoinRoom}
              >
                加入房间
              </button>
            </div>
          </section>
        </>
      )}

      <ul className="tips lobby-tips">
        <li>开始游戏：自动匹配；人数不足时 AI 补位开局。</li>
        <li>私房：创建房间后分享房间号或链接（?room=），满 3 真人自动开局；也可房主手动开始。</li>
        <li>无微信/QQ 登录；游客身份本地持久化（允许重名）。</li>
      </ul>
    </div>
  );
}
