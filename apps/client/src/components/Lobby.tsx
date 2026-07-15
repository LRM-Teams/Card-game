import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';

/** 大厅：昵称 + 快速匹配入口。 */
export function Lobby() {
  const navigate = useNavigate();
  const connectAndJoin = useGameStore((s) => s.connectAndJoin);
  const [nick, setNick] = useState('');

  const enter = (to: '/room' | '/game') => {
    const name = nick.trim() || '游客';
    connectAndJoin(name);
    navigate({ to });
  };

  return (
    <div className="panel lobby">
      <h1 className="title">♠ 斗地主 · 大厅</h1>
      <p className="subtitle">网页端 · 真人 / 机器人混战</p>

      <label className="field">
        <span>昵称</span>
        <input
          type="text"
          placeholder="给自己起个名字"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={12}
        />
      </label>

      <div className="actions">
        <button className="btn primary big" onClick={() => enter('/room')}>
          快速匹配
        </button>
        <button className="btn big" onClick={() => enter('/game')}>
          直接进牌桌（联网 demo）
        </button>
      </div>

      <ul className="tips">
        <li>点选手牌 → 出牌 / 不出；规则只做「能否成牌 / 压过」提示。</li>
        <li>合法性以服务端为准，客户端不裁决。</li>
        <li>本地联调：先起 server :3000，再起 client :5173。</li>
      </ul>
    </div>
  );
}
