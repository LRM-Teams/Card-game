import { useNavigate } from '@tanstack/react-router';
import { GamePhase } from '@card-game/rules';
import { useGameStore } from '../store/gameStore';

/** 房间：显示服务端房态、座位、开始按钮。 */
export function Room() {
  const navigate = useNavigate();
  const roomId = useGameStore((s) => s.roomId);
  const players = useGameStore((s) => s.players);
  const phase = useGameStore((s) => s.phase);
  const status = useGameStore((s) => s.status);
  const start = useGameStore((s) => s.start);

  const seats = players.length > 0
    ? players
    : [
        { seat: 0, name: '等待落座', isBot: false, handSize: 0, role: undefined, connected: false },
        { seat: 1, name: '等待补位', isBot: true, handSize: 0, role: undefined, connected: false },
        { seat: 2, name: '等待补位', isBot: true, handSize: 0, role: undefined, connected: false },
      ];

  if (!roomId) {
    return (
      <div className="panel room">
        <h1 className="title">房间</h1>
        <p className="subtitle">还没加入房间，先回大厅匹配。</p>
        <div className="actions">
          <button className="btn primary big" onClick={() => navigate({ to: '/' })}>
            返回大厅
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel room">
      <h1 className="title">房间 #{roomId}</h1>
      <p className="subtitle">连接 {status} · 当前 {phase} · 缺人自动补机器人</p>

      <div className="seats-preview">
        {seats.map((s) => (
          <div className={`seat-card ${s.isBot ? 'bot' : 'me'}`} key={s.seat}>
            <div className="avatar">{s.isBot ? '🤖' : '🙂'}</div>
            <div className="seat-name">{s.name}</div>
            <div className="seat-role">{s.isBot ? '机器人' : s.connected ? '在线' : '离线'}</div>
            <div className="seat-count">剩余 {s.handSize}</div>
          </div>
        ))}
      </div>

      <div className="actions">
        <button
          className="btn primary big"
          onClick={() => {
            start();
            navigate({ to: '/game' });
          }}
          disabled={phase !== GamePhase.WAITING}
        >
          开始游戏
        </button>
        <button className="btn big" onClick={() => navigate({ to: '/game' })}>
          进入牌桌
        </button>
      </div>
    </div>
  );
}
