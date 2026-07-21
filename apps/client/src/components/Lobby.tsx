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
          <p className="subtitle lobby-subtitle">网页端 · 真人 / 机器人混战</p>
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
          加入失败：{lastError.message}（{lastError.code}）
        </div>
      )}

      <section className="lobby-player" aria-label="玩家信息">
        <label className="field lobby-field">
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
      </section>

      <div className="lobby-cta">
        <button
          className="btn primary cta lobby-start"
          onClick={() => enterRoom()}
          disabled={!canJoin}
        >
          开始游戏
        </button>
        <p className="lobby-cta-hint">快速匹配，自动配桌开局</p>
      </div>

      <section className="lobby-secondary" aria-label="加入房间">
        <div className="lobby-secondary__head">
          <span className="lobby-secondary__label">加入好友房间</span>
          <span className="lobby-secondary__mute">次入口</span>
        </div>
        <label className="field lobby-field lobby-field--compact">
          <span>房间码</span>
          <input
            type="text"
            placeholder="输入房间号"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && canJoinRoom && enterRoom(trimmedRoomCode)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <button
          className="btn lobby-join"
          onClick={() => enterRoom(trimmedRoomCode)}
          disabled={!canJoinRoom}
        >
          加入房间
        </button>
      </section>

      <ul className="tips lobby-tips">
        <li>点选手牌 → 出牌 / 不出；规则只做「能否成牌 / 压过」提示。</li>
        <li>合法性以服务端为准，客户端不裁决。</li>
        <li>好友可复制房间号，在大厅输入后进入同一桌；3 真人齐了直接开局，人数不足时房主可选「补机器人开始」或等人。</li>
      </ul>
    </div>
  );
}
