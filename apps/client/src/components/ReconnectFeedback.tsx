import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGameStore } from '../store/gameStore';

/** 断线重连可见反馈：顶部 banner、恢复 toast、超时失败引导（LRM-276）。 */
export function ReconnectFeedback() {
  const navigate = useNavigate();
  const reconnecting = useGameStore((s) => s.reconnecting);
  const reconnectFailed = useGameStore((s) => s.reconnectFailed);
  const reconnectToast = useGameStore((s) => s.reconnectToast);
  const dismissReconnectToast = useGameStore((s) => s.dismissReconnectToast);
  const clearReconnectFailure = useGameStore((s) => s.clearReconnectFailure);

  useEffect(() => {
    if (!reconnectToast) return;
    const t = window.setTimeout(() => dismissReconnectToast(), 2800);
    return () => window.clearTimeout(t);
  }, [reconnectToast, dismissReconnectToast]);

  const handleReturnLobby = () => {
    clearReconnectFailure();
    navigate({ to: '/' });
  };

  return (
    <>
      {reconnecting && !reconnectFailed && (
        <div className="reconnect-banner" role="status" aria-live="polite">
          <span className="reconnect-banner__spinner" aria-hidden="true" />
          <span>连接已断开，正在重连…</span>
        </div>
      )}

      {reconnectToast && (
        <div className="reconnect-toast" role="status" aria-live="polite">
          已恢复对局
        </div>
      )}

      {reconnectFailed && (
        <div className="reconnect-fail-overlay" role="alertdialog" aria-labelledby="reconnect-fail-title">
          <div className="reconnect-fail-card">
            <h2 id="reconnect-fail-title" className="reconnect-fail-title">
              无法恢复连接
            </h2>
            <p className="reconnect-fail-desc">
              已超过 30 秒或多次重连失败，对局可能仍在进行。请返回大厅后重新匹配或加入房间。
            </p>
            <button type="button" className="btn primary big reconnect-fail-cta" onClick={handleReturnLobby}>
              返回大厅
            </button>
          </div>
        </div>
      )}
    </>
  );
}
