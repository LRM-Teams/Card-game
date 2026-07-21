import type { ReactNode } from 'react';
import { useOnboardingStore } from '../store/onboardingStore';

interface Props {
  /** 当前是否应展示本条引导。 */
  show: boolean;
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
  /** 点「知道了」时回调（通常 mark 某步）。 */
  onDismiss?: () => void;
}

/** 轻量教练框：包住目标区域，可跳过整段引导。 */
export function GuideSpot({ show, title, body, children, className, onDismiss }: Props) {
  const skip = useOnboardingStore((s) => s.skip);
  if (!show) return <>{children}</>;

  return (
    <div className={`guide-spot${className ? ` ${className}` : ''}`}>
      <div className="guide-spot__target">{children}</div>
      <div className="guide-bubble" role="dialog" aria-label={title}>
        <strong className="guide-bubble__title">{title}</strong>
        <p className="guide-bubble__body">{body}</p>
        <div className="guide-bubble__actions">
          <button type="button" className="btn guide-skip" onClick={skip}>
            跳过引导
          </button>
          <button
            type="button"
            className="btn primary guide-next"
            onClick={() => onDismiss?.()}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
