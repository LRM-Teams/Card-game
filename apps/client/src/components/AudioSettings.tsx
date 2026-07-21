import { useAudioStore } from '../store/audioStore';
import { useOnboardingStore } from '../store/onboardingStore';

/** 音效 / BGM / 静音设置面板（LRM-176）；含引导重置（LRM-181）。 */
export function AudioSettings() {
  const open = useAudioStore((s) => s.open);
  const toggleOpen = useAudioStore((s) => s.toggleOpen);
  const setOpen = useAudioStore((s) => s.setOpen);
  const muted = useAudioStore((s) => s.muted);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const sfxVolume = useAudioStore((s) => s.sfxVolume);
  const bgmVolume = useAudioStore((s) => s.bgmVolume);
  const bgmEnabled = useAudioStore((s) => s.bgmEnabled);
  const voiceEnabled = useAudioStore((s) => s.voiceEnabled);
  const setMuted = useAudioStore((s) => s.setMuted);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const setSfxVolume = useAudioStore((s) => s.setSfxVolume);
  const setBgmVolume = useAudioStore((s) => s.setBgmVolume);
  const setBgmEnabled = useAudioStore((s) => s.setBgmEnabled);
  const setVoiceEnabled = useAudioStore((s) => s.setVoiceEnabled);
  const resetGuide = useOnboardingStore((s) => s.reset);
  const guideActive = useOnboardingStore((s) => s.active);
  const guideSkipped = useOnboardingStore((s) => s.skipped);

  return (
    <div className="audio-settings">
      <button
        type="button"
        className={`btn audio-settings-toggle${muted ? ' muted' : ''}`}
        aria-expanded={open}
        aria-controls="audio-settings-panel"
        title={muted ? '已静音 · 打开声音设置' : '声音设置'}
        onClick={toggleOpen}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {open && (
        <div
          id="audio-settings-panel"
          className="audio-settings-panel"
          role="dialog"
          aria-label="声音设置"
        >
          <header className="audio-settings-head">
            <strong>声音设置</strong>
            <button type="button" className="btn audio-settings-close" onClick={() => setOpen(false)}>
              关闭
            </button>
          </header>

          <label className="audio-row">
            <span>静音</span>
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => setMuted(e.target.checked)}
            />
          </label>

          <label className="audio-row">
            <span>主音量</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              disabled={muted}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
            />
          </label>

          <label className="audio-row">
            <span>音效</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sfxVolume}
              disabled={muted}
              onChange={(e) => setSfxVolume(Number(e.target.value))}
            />
          </label>

          <label className="audio-row">
            <span>BGM</span>
            <input
              type="checkbox"
              checked={bgmEnabled}
              onChange={(e) => setBgmEnabled(e.target.checked)}
            />
          </label>

          <label className="audio-row">
            <span>BGM 音量</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={bgmVolume}
              disabled={muted || !bgmEnabled}
              onChange={(e) => setBgmVolume(Number(e.target.value))}
            />
          </label>

          <label className="audio-row">
            <span>语音播报</span>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
            />
          </label>

          <div className="audio-row audio-row--stack">
            <span>新手引导</span>
            <button
              type="button"
              className="btn"
              onClick={() => {
                resetGuide();
                setOpen(false);
              }}
            >
              重置引导
            </button>
            <span className="hint">
              {guideSkipped ? '已跳过' : guideActive ? '进行中' : '已完成'} · 重置后刷新大厅可再走一遍
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
