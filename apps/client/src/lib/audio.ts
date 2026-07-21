/**
 * 客户端音频（LRM-176）：P0 音效 / BGM / 语音播报。
 *
 * - 资源均在 public/audio/，为程序化自制 placeholder（见 docs/assets/audio/LICENSE.md）。
 * - 不裁决牌型；只在服务端事件到达后播放对应反馈。
 * - 浏览器自动播放策略：首次用户手势后解锁；BGM 默认开。
 */

export type SfxId = 'play' | 'pass' | 'button' | 'bomb' | 'rocket' | 'win' | 'lose';
export type VoiceId = 'pass' | 'bomb' | 'rocket' | 'spring' | 'win' | 'lose';

export interface AudioSettings {
  /** 总静音（SFX + BGM + 语音）。 */
  muted: boolean;
  /** 主音量 0–1。 */
  masterVolume: number;
  /** 音效相对音量 0–1。 */
  sfxVolume: number;
  /** BGM 相对音量 0–1。 */
  bgmVolume: number;
  /** BGM 开关，默认开。 */
  bgmEnabled: boolean;
  /** 语音播报开关，默认开。 */
  voiceEnabled: boolean;
}

const STORAGE_KEY = 'ddz-audio-settings-v1';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  masterVolume: 0.85,
  sfxVolume: 0.9,
  bgmVolume: 0.45,
  bgmEnabled: true,
  voiceEnabled: true,
};

const SFX_SRC: Record<SfxId, string> = {
  play: '/audio/sfx/play.ogg',
  pass: '/audio/sfx/pass.ogg',
  button: '/audio/sfx/button.ogg',
  bomb: '/audio/sfx/bomb.ogg',
  rocket: '/audio/sfx/rocket.ogg',
  win: '/audio/sfx/win.ogg',
  lose: '/audio/sfx/lose.ogg',
};

const VOICE_SRC: Record<VoiceId, string> = {
  pass: '/audio/voice/pass.ogg',
  bomb: '/audio/voice/bomb.ogg',
  rocket: '/audio/voice/rocket.ogg',
  spring: '/audio/voice/spring.ogg',
  win: '/audio/voice/win.ogg',
  lose: '/audio/voice/lose.ogg',
};

/** 语音文案：优先走浏览器 SpeechSynthesis（zh-CN TTS placeholder）。 */
const VOICE_TEXT: Record<VoiceId, string> = {
  pass: '不要',
  bomb: '炸弹',
  rocket: '火箭',
  spring: '春天',
  win: '胜利',
  lose: '失败',
};

const BGM_SRC = '/audio/bgm/lobby.ogg';

type Listener = (s: AudioSettings) => void;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: Boolean(parsed.muted),
      masterVolume: clamp01(Number(parsed.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume)),
      sfxVolume: clamp01(Number(parsed.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume)),
      bgmVolume: clamp01(Number(parsed.bgmVolume ?? DEFAULT_AUDIO_SETTINGS.bgmVolume)),
      bgmEnabled: parsed.bgmEnabled !== false,
      voiceEnabled: parsed.voiceEnabled !== false,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function saveSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

class AudioManager {
  private settings: AudioSettings = loadSettings();
  private unlocked = false;
  private bgm: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private unlockBound = false;

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getSettings());
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const snap = this.getSettings();
    this.listeners.forEach((fn) => fn(snap));
  }

  private persist(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (patch.masterVolume != null) this.settings.masterVolume = clamp01(patch.masterVolume);
    if (patch.sfxVolume != null) this.settings.sfxVolume = clamp01(patch.sfxVolume);
    if (patch.bgmVolume != null) this.settings.bgmVolume = clamp01(patch.bgmVolume);
    saveSettings(this.settings);
    this.applyBgmVolume();
    this.syncBgmPlayback();
    this.emit();
  }

  setMuted(muted: boolean): void {
    this.persist({ muted });
  }

  setMasterVolume(masterVolume: number): void {
    this.persist({ masterVolume });
  }

  setSfxVolume(sfxVolume: number): void {
    this.persist({ sfxVolume });
  }

  setBgmVolume(bgmVolume: number): void {
    this.persist({ bgmVolume });
  }

  setBgmEnabled(bgmEnabled: boolean): void {
    this.persist({ bgmEnabled });
  }

  setVoiceEnabled(voiceEnabled: boolean): void {
    this.persist({ voiceEnabled });
  }

  /** 挂载全局：首次手势解锁 + 按钮点击音效。幂等。 */
  installUiHooks(): void {
    if (typeof document === 'undefined' || this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      this.unlock();
    };
    document.addEventListener('pointerdown', unlock, { capture: true, once: true });
    document.addEventListener('keydown', unlock, { capture: true, once: true });
    document.addEventListener(
      'click',
      (ev) => {
        const t = ev.target;
        if (!(t instanceof Element)) return;
        const btn = t.closest('button.btn, .btn');
        if (!btn || btn.hasAttribute('disabled') || (btn as HTMLButtonElement).disabled) return;
        // 设置面板内的控件本身不刷按钮音，避免拖动音量条噪音
        if (btn.closest('.audio-settings')) return;
        this.playSfx('button');
      },
      true,
    );
  }

  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.ensureBgm();
    this.syncBgmPlayback();
  }

  private gain(kind: 'sfx' | 'bgm'): number {
    if (this.settings.muted) return 0;
    const master = this.settings.masterVolume;
    return kind === 'sfx'
      ? master * this.settings.sfxVolume
      : master * this.settings.bgmVolume;
  }

  playSfx(id: SfxId): void {
    if (!this.unlocked) this.unlock();
    const vol = this.gain('sfx');
    if (vol <= 0) return;
    const el = new Audio(SFX_SRC[id]);
    el.volume = vol;
    void el.play().catch(() => {
      /* autoplay blocked or missing file — ignore */
    });
  }

  playVoice(id: VoiceId): void {
    if (!this.settings.voiceEnabled) return;
    if (this.settings.muted) return;
    if (!this.unlocked) this.unlock();
    const vol = this.gain('sfx');
    if (vol <= 0) return;

    // 优先浏览器中文 TTS；无中文引擎时播静态 placeholder（自制旋律 stub）。
    if (this.speakTts(VOICE_TEXT[id], vol)) return;

    const el = new Audio(VOICE_SRC[id]);
    el.volume = vol;
    void el.play().catch(() => {});
  }

  private speakTts(text: string, vol: number): boolean {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    try {
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find((v) => /zh[-_]?CN|Chinese|中文/i.test(`${v.lang} ${v.name}`));
      if (!zh) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1.05;
      u.volume = vol;
      u.voice = zh;
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      return false;
    }
  }

  private ensureBgm(): void {
    if (this.bgm) return;
    const el = new Audio(BGM_SRC);
    el.loop = true;
    el.preload = 'auto';
    this.bgm = el;
    this.applyBgmVolume();
  }

  private applyBgmVolume(): void {
    if (!this.bgm) return;
    this.bgm.volume = this.gain('bgm');
  }

  private syncBgmPlayback(): void {
    if (!this.bgm) return;
    const shouldPlay =
      this.unlocked &&
      this.settings.bgmEnabled &&
      !this.settings.muted &&
      this.gain('bgm') > 0;
    if (shouldPlay) {
      void this.bgm.play().catch(() => {});
    } else {
      this.bgm.pause();
    }
  }
}

/** 进程内单例。 */
export const audio = new AudioManager();
