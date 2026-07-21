import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';

/** 大厅：快速开始（匹配队列）或房间码进私房。 */
export function Lobby() {
  const navigate = useNavigate();
  const join = useGameStore((s) => s.join);
  const quickMatch = useGameStore((s) => s.quickMatch);
  const cancelMatch = useGameStore((s) => s.cancelMatch);
  const matchStatus = useGameStore((s) => s.matchStatus);
  const matchQueueSize = useGameStore((s) => s.matchQueueSize);
  const mySeat = useGameStore((s) => s.mySeat);
  const roomId = useGameStore((s) => s.roomId);
  const status = useGameStore((s) => s.status);
  const lastError = useGameStore((s) => s.lastError);
  const dismissError = useGameStore((s) => s.dismissError);
  const [nick, setNick] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const trimmedNick = nick.trim();
  const trimmedRoomCode = roomCode.trim();
  const matching = matchStatus === 'queued';
  const canAct = trimmedNick.length > 0 && status === 'connected' && !matching;
  const canJoinRoom = canAct && trimmedRoomCode.length > 0;

  // 匹配成功入座后进入房间（私房 join 也会触发）；开局后 Room 再跳牌桌。
  useEffect(() => {
    if (mySeat != null && roomId) {
      navigate({ to: '/room' });
    }
  }, [mySeat, roomId, navigate]);

  const enterPrivateRoom = (targetRoomId?: string) => {
    if (!canAct) return;
    join(trimmedNick, targetRoomId);
  };

  const startQuickMatch = () => {
    if (!canAct) return;
    quickMatch(trimmedNick);
  };

  if (matching) {
    return (
      <div className="panel lobby">
        <h1 className="title">♠ 斗地主 · 匹配中</h1>
        <p className="subtitle">正在为你寻找对手…</p>

        <div className="match-panel" role="status" aria-live="polite">
          <div className="match-spinner" aria-hidden />
          <p className="match-status-text">匹配中</p>
          <p className="match-queue-hint">
            队列 {Math.max(1, matchQueueSize)} 人 · 凑齐 3 真人即开桌，不足时 AI 补位
          </p>
        </div>

        {lastError && (
          <div className="hint warn lobby-error" onClick={dismissError}>
            {lastError.message}（{lastError.code}）
          </div>
        )}

        <div className="actions lobby-actions">
          <button className="btn big" type="button" onClick={() => cancelMatch()}>
            取消匹配
          </button>
        </div>
      </div>
    );
  }

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
          onKeyDown={(e) => e.key === 'Enter' && startQuickMatch()}
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
          onKeyDown={(e) => e.key === 'Enter' && canJoinRoom && enterPrivateRoom(trimmedRoomCode)}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>

      <div className="actions lobby-actions">
        <button className="btn primary big" onClick={startQuickMatch} disabled={!canAct}>
          快速开始
        </button>
        <button className="btn big" onClick={() => enterPrivateRoom()} disabled={!canAct}>
          创建房间
        </button>
        <button className="btn big" onClick={() => enterPrivateRoom(trimmedRoomCode)} disabled={!canJoinRoom}>
          加入房间
        </button>
      </div>

      <ul className="tips">
        <li>「快速开始」进入匹配：凑齐 3 真人即开桌；真人不足时 AI 自动补位。</li>
        <li>匹配中可随时取消，回到大厅。</li>
        <li>私房：「创建房间」拿房间号 → 好友在大厅输入房间码「加入房间」。</li>
        <li>合法性以服务端为准，客户端不裁决。</li>
      </ul>
    </div>
  );
}
