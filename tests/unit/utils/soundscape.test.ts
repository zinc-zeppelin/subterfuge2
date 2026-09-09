import { describe, it, expect, beforeEach, vi } from "vitest";
import { soundscape } from "@/lib/utils/soundscape";

describe("Cold War Espionage Soundscape Subsystem", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);

    const mockLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {},
    };

    class MockAudioContext {
      currentTime = 0;
      sampleRate = 44100;
      state = "running";
      destination = {};
      createBuffer() {
        return { getChannelData: () => new Float32Array(100) };
      }
      createBufferSource() {
        return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      createBiquadFilter() {
        return {
          type: "",
          frequency: { setValueAtTime: vi.fn() },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      createOscillator() {
        return {
          type: "",
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      resume() {
        return Promise.resolve();
      }
    }

    vi.stubGlobal("window", {
      localStorage: mockLocalStorage,
      AudioContext: MockAudioContext,
    });
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  it("defaults to audio enabled and persists settings changes", () => {
    soundscape.setAudioEnabled(true);
    expect(soundscape.isAudioEnabled()).toBe(true);
    expect(store["subterfuge_audio_enabled"]).toBe("true");

    soundscape.setAudioEnabled(false);
    expect(soundscape.isAudioEnabled()).toBe(false);
    expect(store["subterfuge_audio_enabled"]).toBe("false");
  });

  it("toggles audio state and returns updated boolean", () => {
    soundscape.setAudioEnabled(true);
    const toggled = soundscape.toggleAudio();
    expect(toggled).toBe(false);
    expect(soundscape.isAudioEnabled()).toBe(false);

    const toggledBack = soundscape.toggleAudio();
    expect(toggledBack).toBe(true);
    expect(soundscape.isAudioEnabled()).toBe(true);
  });

  it("executes all sound effect procedures safely without throwing", () => {
    soundscape.setAudioEnabled(true);

    expect(() => soundscape.playTeletype()).not.toThrow();
    expect(() => soundscape.playClick()).not.toThrow();
    expect(() => soundscape.playRadioChirp()).not.toThrow();
    expect(() => soundscape.playDecryptSweep()).not.toThrow();
    expect(() => soundscape.playChallengeAlert()).not.toThrow();
    expect(() => soundscape.playStamp()).not.toThrow();
    expect(() => soundscape.playMidpointIntercept()).not.toThrow();
  });

  it("operates as safe no-op when audio is muted", () => {
    soundscape.setAudioEnabled(false);

    expect(() => soundscape.playTeletype()).not.toThrow();
    expect(() => soundscape.playRadioChirp()).not.toThrow();
    expect(() => soundscape.playChallengeAlert()).not.toThrow();
    expect(() => soundscape.playStamp()).not.toThrow();
  });
});
