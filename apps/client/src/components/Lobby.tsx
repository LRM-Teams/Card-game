import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';

/** 大厅：输入昵称 → join → 进入房间。 */
export function Lobby() {
  const navigate = useNavigate();
  const join = useGameStore((s) => s.join);
  const status = useGameStore((s) => s.status);
  const [nick, setNick] = useState('');

  const canJoin = nick.trim().length > 0 && status === 'connected';

  const onMatch = () => {
    if (!canJoin) return;
    join(nick.trim());
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

      <label className="field">
        <span>昵称</span>
        <input
          type="text"
          placeholder="给自己起个名字"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onMatch()}
          maxLength={12}
          autoFocus
        />
      </label>

      <div className="actions">
        <button className="btn primary big" onClick={onMatch} disabled={!canJoin}>
          快速匹配
        </button>
      </div>

      <ul className="tips">
        <li>点选手牌 → 出牌 / 不出；规则只做「能否成牌 / 压过」提示。</li>
        <li>合法性以服务端为准，客户端不裁决。</li>
        <li>真人不足自动补机器人到 3 人。</li>
      </ul>
    </div>
  );
}
