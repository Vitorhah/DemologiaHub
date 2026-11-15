export type DiceRollCriticalKind = "crit" | "fumble" | "normal";

export interface DiceSoundTapSpec {
  delaySec: number;
  freqHz: number;
  durationSec: number;
  gain: number;
}

export interface DiceSoundPreset {
  taps: DiceSoundTapSpec[];
  accentFreqStartHz?: number;
  accentFreqEndHz?: number;
  accentDelaySec?: number;
  accentDurationSec?: number;
  accentGain?: number;
  accentType?: OscillatorType;
}

export function shouldPlayDiceRollSound(params: {
  ostAudioAccepted: boolean;
  hasWebAudio: boolean;
}): boolean {
  return Boolean(params.ostAudioAccepted && params.hasWebAudio);
}

export function getDiceRollSoundPreset(
  critical: DiceRollCriticalKind = "normal",
): DiceSoundPreset {
  const baseTaps: DiceSoundTapSpec[] = [
    { delaySec: 0, freqHz: 420, durationSec: 0.032, gain: 0.14 },
    { delaySec: 0.042, freqHz: 610, durationSec: 0.028, gain: 0.11 },
    { delaySec: 0.082, freqHz: 330, durationSec: 0.04, gain: 0.13 },
  ];

  if (critical === "crit") {
    return {
      taps: baseTaps,
      accentFreqStartHz: 660,
      accentFreqEndHz: 990,
      accentDelaySec: 0.095,
      accentDurationSec: 0.2,
      accentGain: 0.09,
      accentType: "triangle",
    };
  }

  if (critical === "fumble") {
    return {
      taps: baseTaps,
      accentFreqStartHz: 145,
      accentFreqEndHz: 72,
      accentDelaySec: 0.095,
      accentDurationSec: 0.22,
      accentGain: 0.12,
      accentType: "sawtooth",
    };
  }

  return { taps: baseTaps };
}

let sharedAudioCtx: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;

function getAudioContextConstructor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

function getOrCreateAudioContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new Ctor();
    sharedNoiseBuffer = null;
  }
  return sharedAudioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.06));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    // Decaying noise burst for crisp tabletop dice clatter
    const env = 1 - i / length;
    channel[i] = (Math.random() * 2 - 1) * env;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

/**
 * Unlocks/resumes the shared Web Audio API context on the user's initial gesture.
 */
export function unlockDiceAudioContext(): boolean {
  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Plays a lightweight synthesized dice-roll sound via Web Audio API.
 * Respects the `ostAudioAccepted` user gesture lock strictly.
 */
export function playDiceRollSound(options: {
  ostAudioAccepted: boolean;
  critical?: DiceRollCriticalKind;
}): boolean {
  const hasWebAudio = Boolean(getAudioContextConstructor());
  if (
    !shouldPlayDiceRollSound({
      ostAudioAccepted: options.ostAudioAccepted,
      hasWebAudio,
    })
  ) {
    return false;
  }

  try {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const preset = getDiceRollSoundPreset(options.critical || "normal");
    const noiseBuffer = getNoiseBuffer(ctx);

    for (const tap of preset.taps) {
      const startAt = now + tap.delaySec;

      // Short filtered noise burst (dice face impact)
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(tap.freqHz * 2.1, startAt);
      filter.Q.setValueAtTime(2.6, startAt);

      const tapGain = ctx.createGain();
      tapGain.gain.setValueAtTime(0.0001, startAt);
      tapGain.gain.exponentialRampToValueAtTime(tap.gain, startAt + 0.004);
      tapGain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + tap.durationSec,
      );

      noiseSource.connect(filter);
      filter.connect(tapGain);
      tapGain.connect(ctx.destination);

      noiseSource.start(startAt);
      noiseSource.stop(startAt + tap.durationSec + 0.01);

      // Subtle resonant wood/bone body click
      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = "triangle";
      bodyOsc.frequency.setValueAtTime(tap.freqHz, startAt);
      bodyOsc.frequency.exponentialRampToValueAtTime(
        Math.max(90, tap.freqHz * 0.55),
        startAt + tap.durationSec,
      );

      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.0001, startAt);
      bodyGain.gain.exponentialRampToValueAtTime(
        tap.gain * 0.55,
        startAt + 0.003,
      );
      bodyGain.gain.exponentialRampToValueAtTime(
        0.0001,
        startAt + tap.durationSec,
      );

      bodyOsc.connect(bodyGain);
      bodyGain.connect(ctx.destination);

      bodyOsc.start(startAt);
      bodyOsc.stop(startAt + tap.durationSec + 0.01);
    }

    if (
      preset.accentFreqStartHz &&
      preset.accentFreqEndHz &&
      preset.accentDurationSec &&
      preset.accentGain &&
      preset.accentDelaySec !== undefined
    ) {
      const accentStart = now + preset.accentDelaySec;
      const osc = ctx.createOscillator();
      osc.type = preset.accentType || "triangle";
      osc.frequency.setValueAtTime(preset.accentFreqStartHz, accentStart);
      osc.frequency.exponentialRampToValueAtTime(
        preset.accentFreqEndHz,
        accentStart + preset.accentDurationSec * 0.75,
      );

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, accentStart);
      gainNode.gain.exponentialRampToValueAtTime(
        preset.accentGain,
        accentStart + 0.015,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        accentStart + preset.accentDurationSec,
      );

      if (preset.accentType === "sawtooth") {
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.setValueAtTime(340, accentStart);
        osc.connect(lowpass);
        lowpass.connect(gainNode);
      } else {
        osc.connect(gainNode);
      }

      gainNode.connect(ctx.destination);
      osc.start(accentStart);
      osc.stop(accentStart + preset.accentDurationSec + 0.015);
    }

    return true;
  } catch {
    return false;
  }
}
