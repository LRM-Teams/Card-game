import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';

/** 大厅：输入昵称，可快速匹配或用房间码加入同桌。 */
export function Lobby() {
  const navigate = useNavigate();
  const join = useGameStore((s) => s.join);
  const status = useGameStore((s) => s.status);
  const lastError = useGameStore((s) => s.lastError);
  const dismissError = useGameStore((s) => s.dismissError);
  const [nick, setNick] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const trimmedNick = nick.trim();
  const trimmedRoomCode = roomCode.trim();
  const canJoin = trimmedNick.length > 0 && status === 'connected';
  const canJoinRoom = canJoin && trimmedRoomCode.length > 0;

  const enterRoom = (targetRoomId?: string) => {
    if (!canJoin) return;
    join(trimmedNick, targetRoomId);
    navigate({ to: '/room' });
  };

  return (
    <div className="panel lobby">
      <h1 className="title">♠ 斗地主 · 大厅</h1>
      <p className="subtitle">网页端 · 真人 / 机器人混战</p>

      {status !== 'connected' && (
        <div className="hint warn">
          {status === 'connecting'
            ? '正在连接服务器…'
            : '未连接到服务器，请先启动 apps/server (:3000)'}
        </div>
      )}

      {lastError && (
        <div className="hint warn lobby-error" onClick={dismissError}>
          加入失败：{lastError.message}（{lastError.code}）
        </div>
      )}

      <label className="field">
        <span>昵称</span>
        <input
          type="text"
          placeholder="给自己起个名字"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enterRoom()}
          maxLength={12}
          autoFocus
        />
      </label>

      <label className="field">
        <span>房间码</span>
        <input
          type="text"
          placeholder="输入房间号加入好友同桌"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.trim())}
          onKeyDown={(e) => e.key === 'Enter' && canJoinRoom && enterRoom(trimmedRoomCode)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>

      <div className="actions lobby-actions">
        <button className="btn primary big" onClick={() => enterRoom()} disabled={!canJoin}>
          快速匹配
        </button>
        <button className="btn big" onClick={() => enterRoom(trimmedRoomCode)} disabled={!canJoinRoom}>
          加入房间
        </button>
      </div>

      <ul className="tips">
        <li>点选手牌 → 出牌 / 不出；规则只做「能否成牌 / 压过」提示。</li>
        <li>合法性以服务端为准，客户端不裁决。</li>
        <li>好友可复制房间号，在大厅输入后进入同一桌；3 真人齐了直接开局，人数不足时房主可选「补机器人开始」或等人。</li>
      </ul>
    </div>
  );
}
