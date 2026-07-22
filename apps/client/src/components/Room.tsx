import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { GamePhase } from '@card-game/rules';
import { useGameStore } from '../store/gameStore';
import { copyText } from '../lib/clipboard';
import { joinErrorText } from '../lib/roomJoin';
import {
  DISPLAY_NAME_MAX,
  isValidDisplayName,
  normalizeDisplayName,
  readIdentity,
  saveIdentity,
} from '../lib/session';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerKindBadge } from './PlayerKindBadge';

/**
 * 房间：展示 3 个座位（真人 / 空位 / 机器人补位）与等人状态。
 * - 凑齐 3 真人：服务端自动开局（纯人对战）；房主也可手动点「开始游戏」。
 * - 不足 3 真人：房主可选「补机器人开始」或继续等人。
 * - 非房主：等待第三人入房自动开局 / 或房主开局。
 * 进入发牌/叫地主/出牌后自动跳牌桌。
 */
export function Room() {
  const navigate = useNavigate();
  const snapshot = useGameStore((s) => s.snapshot);
  const mySeat = useGameStore((s) => s.mySeat);
  const roomId = useGameStore((s) => s.roomId);
  const joining = useGameStore((s) => s.joining);
  const lastError = useGameStore((s) => s.lastError);
  const dismissError = useGameStore((s) => s.dismissError);
  const leaveToLobby = useGameStore((s) => s.leaveToLobby);
  const start = useGameStore((s) => s.start);
  const updateDisplayName = useGameStore((s) => s.updateDisplayName);
  const [copied, setCopied] = useState<'id' | 'link' | null>(null);
  const [nickDraft, setNickDraft] = useState(() => readIdentity().displayName);

  const phase = snapshot?.phase;

  useEffect(() => {
    if (phase && phase !== GamePhase.WAITING) {
      navigate({ to: '/game' });
    }
  }, [phase, navigate]);

  const backToLobby = () => {
    dismissError();
    leaveToLobby();
    navigate({ to: '/' });
  };

  // 未入座：进房中 / 失败兜底，避免空白房间页
  if (!roomId || !snapshot) {
    const pending = joining || (Boolean(roomId) && !snapshot && !lastError);
    return (
      <div className="panel room">
        <h1 className="title">进入房间</h1>
        {pending ? (
          <p className="subtitle" role="status" aria-live="polite">
            正在加入房间…
          </p>
        ) : lastError ? (
          <>
            <div className="hint warn lobby-error" role="alert">
              {joinErrorText(lastError.code, lastError.message)}
              <span className="lobby-error-code">（{lastError.code}）</span>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn primary big" type="button" onClick={backToLobby}>
                返回大厅
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="subtitle">尚未加入房间</p>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn primary big" type="button" onClick={backToLobby}>
                返回大厅
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const players = snapshot.players ?? [];
  const seats = [0, 1, 2].map((seat) => players.find((p) => p.seat === seat) ?? null);
  const humans = players.filter((p) => !p.isBot).length;
  const hostSeat = snapshot.hostSeat ?? null;
  const isHost = mySeat != null && mySeat === hostSeat;
  const fullHouse = humans >= 3;
  const shareLink = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

  const copyRoomId = async () => {
    const ok = await copyText(roomId);
    setCopied(ok ? 'id' : null);
    if (ok) window.setTimeout(() => setCopied(null), 1200);
  };

  const copyShareLink = async () => {
    const ok = await copyText(shareLink);
    setCopied(ok ? 'link' : null);
    if (ok) window.setTimeout(() => setCopied(null), 1200);
  };

  // 房主：凑齐 3 真人 → 纯人对战（fillBots=false）；不足 → 补机器人开始（fillBots=true）
  const handleStart = () => start(!fullHouse);

  const commitNickname = () => {
    const normalized = normalizeDisplayName(nickDraft);
    if (!isValidDisplayName(normalized)) return;
    const id = readIdentity();
    const next = { ...id, displayName: normalized };
    saveIdentity(next);
    setNickDraft(normalized);
    updateDisplayName(normalized);
  };

  return (
    <div className="panel room">
      <h1 className="title">房间 {roomId ? `#${roomId.slice(0, 6)}` : ''}</h1>
      <p className="subtitle">3 人桌 · 真人对战 · 当前 {humans}/3 真人</p>

      <div className="room-code-card">
        <span className="room-code-label">房间号</span>
        <code>{roomId}</code>
        <button className="btn" type="button" onClick={copyRoomId}>
          {copied === 'id' ? '已复制' : '复制房间号'}
        </button>
        <button className="btn" type="button" onClick={copyShareLink}>
          {copied === 'link' ? '已复制' : '复制链接'}
        </button>
      </div>

      {lastError && (
        <div className="hint warn lobby-error" role="alert" onClick={dismissError}>
          {joinErrorText(lastError.code, lastError.message)}
          <span className="lobby-error-code">（{lastError.code}）</span>
        </div>
      )}

      <label className="field lobby-field lobby-field--compact">
        <span>我的昵称</span>
        <div className="actions lobby-actions">
          <input
            type="text"
            value={nickDraft}
            maxLength={DISPLAY_NAME_MAX}
            onChange={(e) => setNickDraft(e.target.value)}
            onBlur={commitNickname}
            onKeyDown={(e) => e.key === 'Enter' && commitNickname()}
          />
          <button className="btn" type="button" onClick={commitNickname} disabled={!isValidDisplayName(normalizeDisplayName(nickDraft))}>
            保存
          </button>
        </div>
      </label>

      <div className="seats-preview">
        {seats.map((p, i) => (
          <div
            className={`seat-card ${p ? (p.isBot ? 'bot' : p.seat === mySeat ? 'me' : 'human') : 'empty'}`}
            key={i}
          >
            <div className="avatar">
              <PlayerAvatar kind={!p ? 'empty' : 'player'} avatarId={p?.avatarId} />
              {p ? <PlayerKindBadge isBot={p.isBot} /> : null}
            </div>
            <div className="seat-name">{p ? p.displayName : '空位'}</div>
            <div className="seat-role">
              {!p
                ? '等待玩家加入'
                : p.isBot
                  ? 'AI 补位'
                  : p.seat === mySeat
                    ? '你 · 真人'
                    : '真人玩家'}
            </div>
            {p && p.seat === hostSeat && <div className="seat-host">房主</div>}
          </div>
        ))}
      </div>

      <div className="actions">
        {isHost ? (
          <button className="btn primary big" onClick={handleStart} disabled={!roomId}>
            {fullHouse ? '开始游戏（3 真人）' : '补机器人开始'}
          </button>
        ) : (
          <button className="btn big" disabled>
            等待房主开始游戏…
          </button>
        )}
      </div>
      <p className="tips" style={{ paddingLeft: 0, marginTop: 12 }}>
        {isHost
          ? fullHouse
            ? '3 位真人都到齐：将自动开局，也可点「开始游戏」立即进入纯人对战。'
            : `还差 ${3 - humans} 人：复制房间号/链接发给好友同桌，或点「补机器人开始」用机器人补齐空位。`
          : fullHouse
            ? '三人已齐，等待开局…'
            : `还差 ${3 - humans} 人：把房间号或链接发给好友凑齐 3 人（满员自动开局）。`}
      </p>
    </div>
  );
}
