import { loadMuteState, saveMuteState } from '../utils/storage';

export class SoundManager {
  constructor(scene) {
    this.scene = scene;
    this.muted = loadMuteState();
  }

  setMuted(value) {
    this.muted = Boolean(value);
    saveMuteState(this.muted);
    this.scene.registry.set('isMuted', this.muted);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  getAudioContext() {
    const ctx = this.scene.sound?.context;
    if (!ctx) {
      return null;
    }

    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume();
    }

    return ctx;
  }

  playTone({
    type = 'sine',
    frequency = 440,
    frequencyEnd = null,
    duration = 0.12,
    gain = 0.05,
    attack = 0.01,
    release = 0.06,
    detune = 0,
  }) {
    const ctx = this.getAudioContext();
    if (!ctx || this.muted) {
      return;
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (frequencyEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequencyEnd), now + duration);
    }
    osc.detune.setValueAtTime(detune, now);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + Math.max(0.001, attack));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + 0.001, duration - release));

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  playSfx(key) {
    if (this.muted) {
      return;
    }

    if (key === 'death') {
      this.playTone({ type: 'sawtooth', frequency: 320, frequencyEnd: 130, duration: 0.2, gain: 0.06, release: 0.09 });
      this.playTone({ type: 'triangle', frequency: 210, frequencyEnd: 90, duration: 0.25, gain: 0.04, release: 0.1 });
      return;
    }

    if (key === 'complete') {
      this.playTone({ type: 'triangle', frequency: 390, frequencyEnd: 560, duration: 0.14, gain: 0.05, release: 0.05 });
      this.playTone({ type: 'sine', frequency: 620, frequencyEnd: 880, duration: 0.19, gain: 0.045, attack: 0.02, release: 0.07 });
      return;
    }

    if (key === 'airlock-open') {
      this.playTone({ type: 'sawtooth', frequency: 170, frequencyEnd: 280, duration: 0.24, gain: 0.05, attack: 0.02, release: 0.09 });
      this.playTone({ type: 'triangle', frequency: 420, frequencyEnd: 540, duration: 0.16, gain: 0.03, release: 0.08 });
      return;
    }

    if (key === 'airlock-close') {
      this.playTone({ type: 'sawtooth', frequency: 270, frequencyEnd: 140, duration: 0.22, gain: 0.05, attack: 0.01, release: 0.1 });
      this.playTone({ type: 'triangle', frequency: 300, frequencyEnd: 210, duration: 0.18, gain: 0.03, release: 0.08 });
      return;
    }

    if (key === 'alien-hiss') {
      this.playTone({ type: 'square', frequency: 520, frequencyEnd: 300, duration: 0.11, gain: 0.03, detune: -20, release: 0.05 });
      this.playTone({ type: 'triangle', frequency: 220, frequencyEnd: 140, duration: 0.13, gain: 0.025, detune: 18, release: 0.06 });
      return;
    }

    if (key === 'ui-blip') {
      this.playTone({ type: 'triangle', frequency: 680, frequencyEnd: 760, duration: 0.08, gain: 0.025, release: 0.04 });
    }
  }

  playMusic(_key) {
    // Reserved for future streamed sci-fi soundtrack integration.
  }

  stopMusic() {
    // Reserved for future background music integration.
  }
}
