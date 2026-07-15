import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { SeatInfo } from '../store/gameStore';

/** 房间：3 个座位、准备 / 开始（静态原型）。 */
export function Room() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  const seats: SeatInfo[] = [
    { seat: 0, name: '我', isBot: false, cardCount: 0, role: undefined },
    { seat: 1, name: '机器人 A', isBot: true, cardCount: 0, role: undefined },
    { seat: 2, name: '机器人 B', isBot: true, cardCount: 0, role: undefined },
  ];

  return (
    <div className="panel room">
      <h1 className="title">房间 #demo</h1>
      <p className="subtitle">3 人桌 · 缺人自动补机器人</p>

      <div className="seats-preview">
        {seats.map((s) => (
          <div className={`seat-card ${s.isBot ? 'bot' : 'me'}`} key={s.seat}>
            <div className="avatar">{s.isBot ? '🤖' : '🙂'}</div>
            <div className="seat-name">{s.name}</div>
            <div className="seat-role">{s.isBot ? '机器人' : '你'}</div>
          </div>
        ))}
      </div>

      <div className="actions">
        <button
          className={`btn ${ready ? '' : 'primary'} big`}
          onClick={() => setReady((v) => !v)}
        >
          {ready ? '已准备 ✓' : '准备'}
        </button>
        <button
          className="btn primary big"
          onClick={() => navigate({ to: '/game' })}
          disabled={!ready}
        >
          开始游戏
        </button>
      </div>
    </div>
  );
}
