import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { ConnStatus } from '../net/socket';
import { useGameStore } from '../store/gameStore';

const TOAST_MS = 2800;

/** 断线重连可见反馈：顶部 banner、恢复 toast、失败回大厅。 */
export function ConnectionBanner({ status }: { status: ConnStatus }) {
  const navigate = useNavigate();
  const reconnectToast = useGameStore((s) => s.reconnectToast);
  const dismissReconnectToast = useGameStore((s) => s.dismissReconnectToast);

  useEffect(() => {
    if (!reconnectToast) return;
    const t = window.setTimeout(() => dismissReconnectToast(), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [reconnectToast, dismissReconnectToast]);

  const backToLobby = () => {
    dismissReconnectToast();
    navigate({ to: '/' });
  };

  return (
    <>
      {status === 'reconnecting' && (
        <div className="conn-banner" role="status" aria-live="polite">
          <span className="conn-spinner" aria-hidden="true" />
          连接已断开，正在重连…
        </div>
      )}

      {status === 'reconnect_failed' && (
        <div className="conn-fail-overlay" role="alertdialog" aria-labelledby="conn-fail-title">
          <div className="conn-fail-card">
            <h2 id="conn-fail-title">无法恢复对局</h2>
            <p>连接已断开超过 30 秒，请返回大厅重新匹配或加入房间。</p>
            <button type="button" className="btn primary" onClick={backToLobby}>
              返回大厅
            </button>
          </div>
        </div>
      )}

      {reconnectToast && status === 'connected' && (
        <div className="conn-toast" role="status" aria-live="polite">
          已恢复对局
        </div>
      )}
    </>
  );
}
