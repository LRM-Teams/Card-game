import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { GamePhase } from '@card-game/rules';
import { useGameStore } from '../store/gameStore';

/** 房间：显示座位与等人状态；3 真人可纯人对战，人数不足可选补机器人开局。 */
export function Room() {
  const navigate = useNavigate();
  const snapshot = useGameStore((s) => s.snapshot);
  const mySeat = useGameStore((s) => s.mySeat);
  const roomId = useGameStore((s) => s.roomId);
  const lastError = useGameStore((s) => s.lastError);
  const dismissError = useGameStore((s) => s.dismissError);
  const start = useGameStore((s) => s.start);
  const [copied, setCopied] = useState(false);

  const phase = snapshot?.phase;

  useEffect(() => {
    if (phase && phase !== GamePhase.WAITING) {
      navigate({ to: '/game' });
    }
  }, [phase, navigate]);

  const players = snapshot?.players ?? [];
  const seats = [0, 1, 2].map((seat) => players.find((p) => p.seat === seat));
  const humans = players.filter((p) => !p.isBot).length;
  const canStartPure = humans === 3; // 3 真人纯人对战
  const canStartWithBots = humans >= 1 && humans < 3; // 人数不足，可选补机器人

  const copyRoomId = async () => {
    if (!roomId) return;
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="panel room">
      <h1 className="title">房间 {roomId ? `#${roomId.slice(0, 6)}` : ''}</h1>
      <p className="subtitle">3 人桌 · 纯人对战 或 人数不足补机器人</p>

      {roomId && (
        <div className="room-code-card">
          <span className="room-code-label">房间号</span>
          <code>{roomId}</code>
          <button className="btn" type="button" onClick={copyRoomId}>
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      )}

      {lastError && (
        <div className="hint warn lobby-error" onClick={dismissError}>
          操作失败：{lastError.message}（{lastError.code}）
        </div>
      )}

      <div className="seats-preview">
        {seats.map((p, i) => (
          <div className={`seat-card ${p ? (p.isBot ? 'bot' : 'me') : 'empty'}`} key={i}>
            <div className="avatar">{!p ? '＋' : p.isBot ? '🤖' : '🙂'}</div>
            <div className="seat-name">{p ? p.name : '空位'}</div>
            <div className="seat-role">
              {p ? (p.isBot ? '机器人' : p.seat === mySeat ? '你' : '玩家') : '等待加入'}
            </div>
          </div>
        ))}
      </div>

      <div className="actions lobby-actions">
        <button className="btn primary big" onClick={() => start(false)} disabled={!roomId || !canStartPure}>
          开始游戏{canStartPure ? '' : `（等 ${3 - humans} 人）`}
        </button>
        <button className="btn big" onClick={() => start(true)} disabled={!roomId || !canStartWithBots}>
          补机器人开始
        </button>
      </div>
      <p className="tips" style={{ paddingLeft: 0, marginTop: 12 }}>
        {humans < 3
          ? `等待玩家加入（还差 ${3 - humans} 人）；把房间号发给好友，或选择「补机器人开始」。`
          : '3 人已满，点击「开始游戏」纯人对战。'}
      </p>
    </div>
  );
}
