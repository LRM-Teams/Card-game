import type { ReactNode } from 'react';

type CoachTipProps = {
  /** 一句话提示文案 */
  message: string;
  /** 主操作（下一步 / 知道了） */
  primaryLabel?: string;
  onPrimary?: () => void;
  /** 跳过整段引导 */
  onSkip?: () => void;
  /** 气泡相对位置 */
  placement?: 'above' | 'below';
  children?: ReactNode;
  className?: string;
};

/** 轻量教练气泡：高亮目标旁一句话 + 可跳过。 */
export function CoachTip({
  message,
  primaryLabel = '知道了',
  onPrimary,
  onSkip,
  placement = 'below',
  children,
  className = '',
}: CoachTipProps) {
  return (
    <div
      className={`coach-tip coach-tip--${placement}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      {children}
      <div className="coach-tip__bubble">
        <p className="coach-tip__msg">{message}</p>
        <div className="coach-tip__actions">
          {onSkip && (
            <button type="button" className="btn coach-tip__skip" onClick={onSkip}>
              跳过
            </button>
          )}
          {onPrimary && (
            <button type="button" className="btn primary coach-tip__ok" onClick={onPrimary}>
              {primaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
