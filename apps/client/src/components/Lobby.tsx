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
import { PIXEL } from '../lib/pixelAssets';

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
  const matchHumans = useGameStore((s) => s.matchHumans);
  const matchFillDeadlineAt = useGameStore((s) => s.matchFillDeadlineAt);
  const status = useGameStore((s) => s.status);
  const lastError = useGameStore((s) => s.lastError);
  const dismissError = useGameStore((s) => s.dismissError);
  const beans = useGameStore((s) => s.beans);
  const roomId = useGameStore((s) => s.roomId);
  const guideActive = useOnboardingStore((s) => s.active);
  const seenIdentity = useOnboardingStore((s) => s.seenIdentity);
  const seenStart = useOnboardingStore((s) => s.seenStart);
  const mark = useOnboardingStore((s) => s.mark);

  const [identity, setIdentity] = useState<GuestIdentity>(() => readIdentity());
  const [roomCode, setRoomCode] = useState(readRoomQuery);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deepLinkPending = useRef(Boolean(readRoomQuery()));
  const deepLinkDone = useRef(false);

  const trimmedNick = normalizeDisplayName(identity.displayName);
  const trimmedRoomCode = roomCode.trim();
  const canAct = isValidDisplayName(trimmedNick) && status === 'connected' && !matching;
  const canJoinRoom = canAct && trimmedRoomCode.length > 0;
  const showIdentityGuide = guideActive && !seenIdentity && !matching;
  const showStartGuide = guideActive && seenIdentity && !seenStart && !matching;

  // 匹配成功入房后跳转（不等 snapshot，减少等待态闪断）
  useEffect(() => {
    if (roomId && !matching) navigate({ to: '/room' });
  }, [roomId, matching, navigate]);

  // 与服务端 fillDeadlineAt 对齐的倒计时
  useEffect(() => {
    if (!matching || matchFillDeadlineAt == null) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((matchFillDeadlineAt - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [matching, matchFillDeadlineAt]);

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
          className="lobby-hero__art pixel-art"
          src={PIXEL.backgrounds.lobbyHero}
          alt="斗地主大厅主视觉插画"
          width={360}
          height={160}
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
        <div className="matching-panel">
          <p className="subtitle matching-status" role="status" aria-live="polite">
            已匹配 {matchHumans}/3 真人，等待中…
          </p>
          {matchFillDeadlineAt != null && (
            <p className="matching-countdown" aria-live="polite">
              <span className="matching-countdown__value">{secondsLeft}</span>
              <span className="matching-countdown__label">秒后 AI 补位</span>
            </p>
          )}
          <p className="hint matching-hint">凑齐 3 真人立即开局；超时由 AI 补位</p>
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
            body="快速匹配开局；满 3 真人立即开，不足时倒计时后 AI 补位。这是大厅唯一主入口。"
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
              <span className="lobby-secondary__label">邀请进房</span>
              <span className="lobby-secondary__mute">房间号 / 链接</span>
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
        <li>开始游戏：自动匹配；满 3 真人立即开，不足时倒计时后 AI 补位。</li>
        <li>邀请进房：创建房间后点「邀请好友」分享房间号或链接；好友打开链接自动加入同房。</li>
        <li>无微信/QQ 登录；游客身份本地持久化（允许重名）。</li>
      </ul>
    </div>
  );
}
