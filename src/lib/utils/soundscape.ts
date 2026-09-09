/**
 * Procedural Web Audio Soundscape for Project Subterfuge.
 * 
 * Synthesizes vintage Cold War espionage sound effects (teletype clack,
 * encrypted radio chirps, radar alert klaxons, and classified stamp impacts)
 * using the native Web Audio API with zero external audio assets.
 */

const AUDIO_STORAGE_KEY = "subterfuge_audio_enabled";

class SoundscapeEngine {
  private audioCtx: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
        // Default to enabled if not explicitly set to "false"
        this.isEnabled = stored !== "false";
      } catch {
        this.isEnabled = true;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }

      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public isAudioEnabled(): boolean {
    return this.isEnabled;
  }

  public setAudioEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(AUDIO_STORAGE_KEY, enabled ? "true" : "false");
      } catch {
        // storage fallback
      }
    }
  }

  public toggleAudio(): boolean {
    const nextState = !this.isEnabled;
    this.setAudioEnabled(nextState);
    if (nextState) {
      this.playClick();
    }
    return nextState;
  }

  /**
   * Mechanical typewriter keystroke / teletype clack.
   */
  public playTeletype(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Noise transient for typewriter strike
      const bufferSize = Math.floor(ctx.sampleRate * 0.03); // 30ms noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2400 + Math.random() * 400, now);
      filter.Q.setValueAtTime(3, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      // 2. Resonant mechanical click body
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);

      oscGain.gain.setValueAtTime(0.12, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      noise.start(now);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // Audio execution fallback
    }
  }

  /**
   * Subtle high-frequency interface tap / button press.
   */
  public playClick(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.015);
    } catch {
      // Audio execution fallback
    }
  }

  /**
   * Encrypted radio static chirp for incoming comms wire messages.
   */
  public playRadioChirp(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Static burst
      const burstLength = Math.floor(ctx.sampleRate * 0.04);
      const buffer = ctx.createBuffer(1, burstLength, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < burstLength; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      // Clean two-tone morse chirp
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(950, now + 0.02);
      osc.frequency.setValueAtTime(1350, now + 0.07);

      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.linearRampToValueAtTime(0.14, now + 0.025);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      noise.start(now);
      osc.start(now + 0.02);
      osc.stop(now + 0.16);
    } catch {
      // Audio execution fallback
    }
  }

  /**
   * Resonant frequency sweep when holding to decrypt codeword.
   */
  public playDecryptSweep(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.22);

      gain.gain.setValueAtTime(0.02, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio execution fallback
    }
  }

  /**
   * Urgent two-tone klaxon alert for incoming clearance challenges.
   */
  public playChallengeAlert(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      for (let i = 0; i < 2; i++) {
        const pulseStart = now + i * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(740, pulseStart);
        osc.frequency.setValueAtTime(880, pulseStart + 0.05);

        gain.gain.setValueAtTime(0.001, pulseStart);
        gain.gain.linearRampToValueAtTime(0.15, pulseStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, pulseStart + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(pulseStart);
        osc.stop(pulseStart + 0.11);
      }
    } catch {
      // Audio execution fallback
    }
  }

  /**
   * Heavy classified rubber stamp thud when slates are locked or debrief copied.
   */
  public playStamp(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Low frequency resonant thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Audio execution fallback
    }
  }

  /**
   * Midpoint theme intercept notification fanfare (three teletype arpeggios).
   */
  public playMidpointIntercept(): void {
    if (!this.isEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const pitches = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      pitches.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.14);
      });
    } catch {
      // Audio execution fallback
    }
  }
}

export const soundscape = new SoundscapeEngine();
