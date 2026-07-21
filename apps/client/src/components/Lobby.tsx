import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';
import {
  BUILTIN_AVATARS,
  readIdentity,
  saveIdentity,
  type GuestIdentity,
} from '../lib/session';
import { PlayerAvatar } from './PlayerAvatar';

/** 大厅：游客身份（昵称/头像持久化）+ 快速匹配 / 房间码进房。 */
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

  const [identity, setIdentity] = useState<GuestIdentity>(() => readIdentity());
  const [roomCode, setRoomCode] = useState('');

  const trimmedNick = identity.name.trim();
  const trimmedRoomCode = roomCode.trim();
  const canAct = trimmedNick.length > 0 && status === 'connected' && !matching;
  const canJoinRoom = canAct && trimmedRoomCode.length > 0;

  // 匹配成功入房后跳转
  useEffect(() => {
    if (roomId && snapshot) navigate({ to: '/room' });
  }, [roomId, snapshot, navigate]);

  const persist = (next: GuestIdentity) => {
    setIdentity(next);
    saveIdentity(next);
  };

  const startMatch = () => {
    if (!canAct) return;
    saveIdentity(identity);
    match(identity);
  };

  const enterPrivateRoom = (targetRoomId?: string) => {
    if (!canAct) return;
    if (targetRoomId && !trimmedRoomCode) return;
    saveIdentity(identity);
    join(identity, targetRoomId);
    navigate({ to: '/room' });
  };

  return (
    <div className="panel lobby">
      <h1 className="title">♠ 斗地主 · 大厅</h1>
      <p className="subtitle">游客开玩 · 真人 / 机器人混战</p>

      <div className="lobby-identity">
        <PlayerAvatar kind="player" avatarId={identity.avatarId} />
        <div>
          <div className="lobby-beans">豆子 {beans ?? identity.beans}</div>
          <div className="hint">游客 ID 已本地保存，刷新不清</div>
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
          <p className="subtitle">匹配中…凑齐三人即开；暂无人则 AI 补位</p>
          <button className="btn big" type="button" onClick={() => cancelMatch()}>
            取消匹配
          </button>
        </div>
      ) : (
        <>
          <label className="field">
            <span>昵称</span>
            <input
              type="text"
              placeholder="给自己起个名字"
              value={identity.name}
              onChange={(e) => persist({ ...identity, name: e.target.value })}
              maxLength={12}
              autoFocus
            />
          </label>

          <div className="field">
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

          <label className="field">
            <span>房间码（私房）</span>
            <input
              type="text"
              placeholder="输入房间号加入好友同桌"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && canJoinRoom && enterPrivateRoom(trimmedRoomCode)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>

          <div className="actions lobby-actions">
            <button className="btn primary big" onClick={startMatch} disabled={!canAct}>
              快速开始
            </button>
            <button className="btn big" onClick={() => enterPrivateRoom()} disabled={!canAct}>
              创建房间
            </button>
            <button
              className="btn big"
              onClick={() => enterPrivateRoom(trimmedRoomCode)}
              disabled={!canJoinRoom}
            >
              加入房间
            </button>
          </div>
        </>
      )}

      <ul className="tips">
        <li>快速开始：自动匹配；人数不足时 AI 补位开局。</li>
        <li>私房：创建房间后分享房间号，好友可加入；房主开局。</li>
        <li>无微信/QQ 登录；游客身份本地持久化（允许重名）。</li>
      </ul>
    </div>
  );
}
