import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { NarrativeSceneElements } from './NarrativeSceneElements';
import {
  narrativePixelHotspots,
  narrativePixelScene,
} from '../lib/narrativePixelAssets';
import { npTotalElements, npUiStates } from '../lib/narrativePixelElements';
import { PlayerAvatar } from './PlayerAvatar';
import { GuideSpot } from './GuideSpot';

function readRoomQuery(): string {
  try {
    return new URLSearchParams(window.location.search).get('room')?.trim() ?? '';
  } catch {
    return '';
  }
}

function hotspotStyle(
  spot: (typeof narrativePixelHotspots)[keyof typeof narrativePixelHotspots],
): CSSProperties {
  return {
    left: `${spot.left}%`,
    top: `${spot.top}%`,
    width: `${spot.width}%`,
    height: `${spot.height}%`,
  };
}

/** 叙事像素大厅：全屏老街场景 + 世界化 UI（电视/站牌/登记簿） */
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

  const viewportRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (roomId && !matching) navigate({ to: '/room' });
  }, [roomId, matching, navigate]);

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

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const dx = (e.clientX - cx) / rect.width;
      el.style.setProperty('--np-parallax-x', String(dx * 12));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

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
    <div className="np-lobby" data-theme="narrative-pixel">
      <div className="np-lobby__viewport" ref={viewportRef}>
        <img
          className="np-lobby__layer np-lobby__layer--far"
          src={narrativePixelScene.layers.far}
          alt=""
          aria-hidden
          draggable={false}
        />
        <img
          className="np-lobby__layer np-lobby__layer--mid"
          src={narrativePixelScene.layers.mid}
          alt=""
          aria-hidden
          draggable={false}
        />
        <NarrativeSceneElements />
        <img
          className="np-lobby__layer np-lobby__layer--light"
          src={narrativePixelScene.layers.lighting}
          alt=""
          aria-hidden
          draggable={false}
        />
        <img
          className="np-lobby__layer np-lobby__layer--fg"
          src={narrativePixelScene.layers.fg}
          alt=""
          aria-hidden
          draggable={false}
        />

        {matching ? (
          <div className="np-matching" role="status" aria-live="polite">
            <img
              className="np-matching__tv"
              src={npUiStates.tvLoading()}
              alt=""
              aria-hidden
            />
            <p className="np-matching__status">已匹配 {matchHumans}/3 真人，等待中…</p>
            {matchFillDeadlineAt != null && (
              <p className="np-matching__countdown">{secondsLeft}</p>
            )}
            <p className="np-hint">凑齐 3 真人立即开局；超时由 AI 补位</p>
            <button className="np-btn-wood" type="button" onClick={() => cancelMatch()}>
              取消匹配
            </button>
          </div>
        ) : (
          <div className="np-lobby__hud">
            <GuideSpot
              show={showIdentityGuide}
              title="先设昵称和头像"
              body="在登记簿上写下你的名字，选个头像。"
              onDismiss={() => mark('seenIdentity')}
            >
              <div
                className="np-hotspot np-hotspot--ledger"
                style={hotspotStyle(narrativePixelHotspots.ledger)}
                aria-label="玩家登记簿"
              >
                <img
                  className="np-hotspot__frame"
                  src={npUiStates.ledger()}
                  alt=""
                  aria-hidden
                />
                <div className="np-hotspot__body">
                  <div className="np-identity">
                    <PlayerAvatar kind="player" avatarId={identity.avatarId} />
                    <div>
                      <div className="np-beans">豆子 {beans ?? identity.beans}</div>
                      <div className="np-hint">游客 ID 本地保存</div>
                    </div>
                  </div>
                  <label className="np-field">
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
                      <span className="np-hint warn">昵称需 2–12 个字符</span>
                    )}
                  </label>
                  <div className="np-field">
                    <span>头像</span>
                    <div className="np-avatar-picker">
                      {BUILTIN_AVATARS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={`np-avatar-pick ${identity.avatarId === id ? 'selected' : ''}`}
                          onClick={() => persist({ ...identity, avatarId: id })}
                          aria-label={id}
                        >
                          <PlayerAvatar kind="player" avatarId={id} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </GuideSpot>

            <div
              className="np-hotspot np-hotspot--station"
              style={hotspotStyle(narrativePixelHotspots.stationBoard)}
              aria-label="房间站牌"
            >
              <img
                className="np-hotspot__frame"
                src={npUiStates.stationBoard()}
                alt=""
                aria-hidden
              />
              <div className="np-hotspot__body">
                <label className="np-field">
                  <span>房间码</span>
                  <input
                    type="text"
                    placeholder="输入房间号"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.trim())}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && canJoinRoom && enterPrivateRoom(trimmedRoomCode)
                    }
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </label>
                <div className="np-actions">
                  <button
                    className="np-btn-wood"
                    type="button"
                    onClick={() => enterPrivateRoom()}
                    disabled={!canAct}
                  >
                    创建
                  </button>
                  <button
                    className="np-btn-wood"
                    type="button"
                    onClick={() => enterPrivateRoom(trimmedRoomCode)}
                    disabled={!canJoinRoom}
                  >
                    加入
                  </button>
                </div>
              </div>
            </div>

            <GuideSpot
              show={showStartGuide}
              title="点电视「开始游戏」"
              body="快速匹配开局；满 3 真人立即开，不足时倒计时后 AI 补位。"
              onDismiss={() => mark('seenStart')}
            >
              <div
                className="np-hotspot np-hotspot--tv"
                style={hotspotStyle(narrativePixelHotspots.tvStart)}
                aria-label="开始游戏"
              >
                <img
                  className="np-hotspot__frame"
                  src={npUiStates.tvDefault()}
                  alt=""
                  aria-hidden
                />
                <div className="np-hotspot__body">
                  <button
                    className="np-btn-tv"
                    type="button"
                    onClick={startMatch}
                    disabled={!canAct}
                  >
                    开始游戏
                  </button>
                </div>
              </div>
            </GuideSpot>
          </div>
        )}
      </div>

      {status !== 'connected' && (
        <div className="np-status-bar warn">
          {status === 'connecting'
            ? '正在连接服务器…'
            : '未连接到服务器，请先启动 apps/server (:3000)'}
        </div>
      )}

      {lastError && (
        <div className="np-status-bar warn" onClick={dismissError} role="alert">
          失败：{lastError.message}（{lastError.code}）— 点击关闭
        </div>
      )}

      <ul className="np-tips">
        <li>开始游戏：自动匹配；满 3 真人立即开，不足时倒计时后 AI 补位。</li>
        <li>邀请进房：创建房间后分享房间号或链接。</li>
        <li>资产：LRM-417 叙事像素 v3 · {npTotalElements} 张独立元素 + 场景布局</li>
      </ul>
    </div>
  );
}
