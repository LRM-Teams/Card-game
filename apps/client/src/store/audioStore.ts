import { create } from 'zustand';
import {
  audio,
  type AudioSettings,
  DEFAULT_AUDIO_SETTINGS,
} from '../lib/audio';

interface AudioUiState extends AudioSettings {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setMuted: (muted: boolean) => void;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setBgmVolume: (v: number) => void;
  setBgmEnabled: (v: boolean) => void;
  setVoiceEnabled: (v: boolean) => void;
}

export const useAudioStore = create<AudioUiState>((set) => {
  const initial = audio.getSettings();
  audio.subscribe((s) => {
    set({
      muted: s.muted,
      masterVolume: s.masterVolume,
      sfxVolume: s.sfxVolume,
      bgmVolume: s.bgmVolume,
      bgmEnabled: s.bgmEnabled,
      voiceEnabled: s.voiceEnabled,
    });
  });

  return {
    ...DEFAULT_AUDIO_SETTINGS,
    ...initial,
    open: false,
    setOpen: (open) => set({ open }),
    toggleOpen: () => set((st) => ({ open: !st.open })),
    setMuted: (muted) => audio.setMuted(muted),
    setMasterVolume: (v) => audio.setMasterVolume(v),
    setSfxVolume: (v) => audio.setSfxVolume(v),
    setBgmVolume: (v) => audio.setBgmVolume(v),
    setBgmEnabled: (v) => audio.setBgmEnabled(v),
    setVoiceEnabled: (v) => audio.setVoiceEnabled(v),
  };
});
