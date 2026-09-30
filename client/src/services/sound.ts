/**
 * Sound system: synthesized via WebAudio (no binary assets needed).
 * Respects Telegram autoplay restrictions: audio context resumes on first user gesture.
 */

type SoundName =
  | 'click'
  | 'cardFlip'
  | 'vote'
  | 'nightStart'
  | 'dayStart'
  | 'elimination'
  | 'victory'
  | 'defeat'
  | 'notify';

let ctx: AudioContext | null = null;
let enabled = true;
let vibrationEnabled = true;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
  try {
    localStorage.setItem('tm_sound', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function setVibrationEnabled(v: boolean): void {
  vibrationEnabled = v;
  try {
    localStorage.setItem('tm_vibro', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadSoundPrefs(): { sound: boolean; vibro: boolean } {
  try {
    enabled = localStorage.getItem('tm_sound') !== '0';
    vibrationEnabled = localStorage.getItem('tm_vibro') !== '0';
  } catch {
    /* ignore */
  }
  return { sound: enabled, vibro: vibrationEnabled };
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Call from a user gesture once to unlock audio on iOS/Telegram. */
export function unlockAudio(): void {
  const c = ensureCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.08,
  when = 0,
  slideTo?: number,
): void {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playSound(name: SoundName): void {
  if (!enabled) return;
  switch (name) {
    case 'click':
      tone(660, 0.06, 'triangle', 0.05);
      break;
    case 'cardFlip':
      tone(320, 0.12, 'triangle', 0.07, 0, 720);
      tone(880, 0.18, 'sine', 0.04, 0.1);
      break;
    case 'vote':
      tone(520, 0.08, 'square', 0.045);
      tone(700, 0.08, 'square', 0.04, 0.09);
      break;
    case 'nightStart':
      tone(220, 0.5, 'sine', 0.07, 0, 110);
      tone(330, 0.4, 'sine', 0.04, 0.12);
      break;
    case 'dayStart':
      tone(440, 0.18, 'sine', 0.06);
      tone(554, 0.18, 'sine', 0.06, 0.14);
      tone(659, 0.3, 'sine', 0.06, 0.28);
      break;
    case 'elimination':
      tone(196, 0.4, 'sawtooth', 0.06, 0, 80);
      break;
    case 'victory':
      tone(523, 0.16, 'triangle', 0.07);
      tone(659, 0.16, 'triangle', 0.07, 0.14);
      tone(784, 0.2, 'triangle', 0.07, 0.28);
      tone(1046, 0.4, 'triangle', 0.08, 0.44);
      break;
    case 'defeat':
      tone(330, 0.3, 'sawtooth', 0.06, 0, 160);
      tone(220, 0.5, 'sawtooth', 0.05, 0.25, 90);
      break;
    case 'notify':
      tone(880, 0.09, 'sine', 0.05);
      tone(1100, 0.12, 'sine', 0.04, 0.1);
      break;
  }
}

export function vibrate(pattern: number | number[] = 15): void {
  if (!vibrationEnabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export { hapticNotify } from '../services/telegram';
