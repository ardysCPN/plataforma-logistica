import { Platform } from 'react-native';
import { appStorage } from './storage';

let audioCtx: AudioContext | null = null;
let isUnlocked = false;

const getAudioContext = (): AudioContext | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  // Despertar contexto de audio si el navegador lo suspendió por autoplay policy
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
};

// Auto-desbloquear AudioContext en la primera interacción táctil o clic
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (isUnlocked) return;
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          isUnlocked = true;
        }).catch(() => {});
      } else {
        isUnlocked = true;
      }
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

export const soundNotification = {
  isSoundEnabled(): boolean {
    const stored = appStorage.getItem('domy_sound_enabled');
    return stored === null ? true : stored === 'true';
  },

  setSoundEnabled(enabled: boolean): void {
    appStorage.setItem('domy_sound_enabled', enabled ? 'true' : 'false');
  },

  toggleSound(): boolean {
    const nextState = !this.isSoundEnabled();
    this.setSoundEnabled(nextState);
    if (nextState) {
      // Reproducir sonido de confirmación al activar
      this.playMessageTone();
    }
    return nextState;
  },

  /**
   * Tono suave de notificación de estado (Llegada del conductor, inicio del viaje, etc.)
   * Acorde suave de 2 notas ascendentes: D5 (587Hz) -> A5 (880Hz)
   */
  playChime(): void {
    if (!this.isSoundEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Nota 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.23);

      // Nota 2: A5 (880 Hz) - Entrada suave 0.12s después
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.12);
      gain2.gain.setValueAtTime(0.001, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.14, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.46);
    } catch {
      // Silenciar cualquier excepción de audio
    }
  },

  /**
   * Tono suave para nuevo mensaje de chat entrante
   * Blip agradable y corto: G5 (784Hz) -> C6 (1046Hz)
   */
  playMessageTone(): void {
    if (!this.isSoundEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.11, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } catch {
      // Silenciar cualquier excepción de audio
    }
  },
};
