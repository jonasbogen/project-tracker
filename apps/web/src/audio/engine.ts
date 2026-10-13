export type MusicName =
  | 'arena'
  | 'tension'
  | 'gallop'
  | 'noir'
  | 'daylight'
  | 'victory'
  | 'drumroll'
  | 'alarm'
  | 'cinema'
  | 'casino'
  | 'heartbeat';

export type SfxName =
  | 'click'
  | 'back'
  | 'flip'
  | 'hoof'
  | 'gunshot'
  | 'cheer'
  | 'ding'
  | 'whoosh'
  | 'tick'
  | 'sting'
  | 'fail'
  | 'howl'
  | 'gavel'
  | 'boo'
  | 'fanfare'
  | 'rocket'
  | 'engine'
  | 'bell'
  | 'train'
  | 'buzz'
  | 'snore'
  | 'ring'
  | 'lock'
  | 'stamp'
  | 'crash'
  | 'riser'
  | 'coin';

const SEMITONES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export function freq(note: string): number {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`Bad note ${note}`);
  const midi = (Number(m[2]) + 1) * 12 + SEMITONES[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ToneOpts {
  t: number;
  dur: number;
  freq: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  lowpass?: number;
  q?: number;
  detune?: number;
  vibrato?: { rate: number; depth: number };
  glide?: number;
  dest: AudioNode;
}

interface NoiseOpts {
  t: number;
  dur: number;
  gain?: number;
  attack?: number;
  release?: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  dest: AudioNode;
}

interface Track {
  bpm: number;
  beats: number;
  bar: (t0: number, bar: number, beat: number, dest: AudioNode) => void;
}

interface Playing {
  name: MusicName;
  gain: GainNode;
  timer: number;
}

/**
 * The synthesized Web Audio tracks are kept in the code but switched off: the
 * night runs on one continuous backing track (the audio from the user's video,
 * stored as /bakgrunn.m4a) that loops behind every screen. Sound effects stay.
 */
const MUSIC_ENABLED = false;
const BACKGROUND_SRC = '/bakgrunn.m4a';
/** Backing track sits a little under the effects so cheers and gunshots cut through. */
const BACKGROUND_LEVEL = 0.85;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private playing: Playing | null = null;
  private background: HTMLAudioElement | null = null;
  /** A one-off track (the finale song) that takes over from the backing track while it plays. */
  private track: HTMLAudioElement | null = null;
  private volume = 0.7;
  private muted = false;

  get currentMusic(): MusicName | null {
    return this.playing?.name ?? null;
  }

  /** Hidden looping <audio> element; only the sound is ever used. */
  private ensureBackground(): void {
    if (typeof document === 'undefined') return;
    if (!this.background) {
      const el = document.createElement('audio');
      el.src = BACKGROUND_SRC;
      el.loop = true;
      el.preload = 'auto';
      el.setAttribute('aria-hidden', 'true');
      el.style.display = 'none';
      el.volume = this.volume * BACKGROUND_LEVEL;
      el.muted = this.muted;
      document.body.appendChild(el);
      this.background = el;
    }
    if (this.background.paused) void this.background.play().catch(() => undefined);
  }

  /** Must be called from a user gesture at least once before anything is audible. */
  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    this.ensureBackground();
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1;
      this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Silence the backing track without losing its position (used by the staged network error). */
  pauseBackground(): void {
    this.background?.pause();
  }

  resumeBackground(): void {
    if (this.track) return; // a track is in charge; it resumes the backing track when it stops
    if (this.background?.paused) void this.background.play().catch(() => undefined);
  }

  /**
   * Play a track from the start instead of the backing track (which pauses and
   * keeps its position). Follows the mute button and volume slider like
   * everything else. stopTrack() hands the sound back to the backing track.
   */
  playTrack(src: string, loop = true): void {
    if (typeof document === 'undefined') return;
    this.stopTrack(false);
    this.background?.pause();
    const el = document.createElement('audio');
    el.src = src;
    el.loop = loop;
    el.preload = 'auto';
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    el.volume = Math.max(0, Math.min(1, this.volume));
    el.muted = this.muted;
    document.body.appendChild(el);
    this.track = el;
    void el.play().catch(() => undefined);
  }

  stopTrack(resume = true): void {
    const el = this.track;
    if (el) {
      el.pause();
      el.remove();
      this.track = null;
    }
    if (resume) this.resumeBackground();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
    if (this.background) this.background.volume = Math.max(0, Math.min(1, v * BACKGROUND_LEVEL));
    if (this.track) this.track.volume = Math.max(0, Math.min(1, v));
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    if (this.background) this.background.muted = m;
    if (this.track) this.track.muted = m;
  }

  // ---------- instruments ----------

  private tone(o: ToneOpts): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, o.t);
    if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, o.t + o.dur);
    if (o.detune) osc.detune.value = o.detune;

    let node: AudioNode = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      f.Q.value = o.q ?? 0.8;
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    const peak = o.gain ?? 0.1;
    const a = o.attack ?? 0.01;
    const d = o.decay ?? 0.08;
    const s = o.sustain ?? 0.7;
    const r = o.release ?? 0.08;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(peak, o.t + a);
    g.gain.linearRampToValueAtTime(peak * s, o.t + a + d);
    g.gain.setValueAtTime(peak * s, Math.max(o.t + a + d, o.t + o.dur));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur + r);
    node.connect(g);
    g.connect(o.dest);

    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vibrato.rate;
      const lg = ctx.createGain();
      lg.gain.value = o.vibrato.depth;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(o.t);
      lfo.stop(o.t + o.dur + r + 0.05);
    }
    osc.start(o.t);
    osc.stop(o.t + o.dur + r + 0.05);
  }

  private noise(o: NoiseOpts): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 1;
    let node: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.freq ?? 1000, o.t);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
      f.Q.value = o.q ?? 1;
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    const peak = o.gain ?? 0.1;
    const a = o.attack ?? 0.005;
    const r = o.release ?? 0.05;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.linearRampToValueAtTime(peak, o.t + a);
    g.gain.setValueAtTime(peak, o.t + Math.max(a, o.dur));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur + r);
    node.connect(g);
    g.connect(o.dest);
    src.start(o.t, Math.random() * 1.5);
    src.stop(o.t + o.dur + r + 0.05);
  }

  private kick(t: number, dest: AudioNode, gain = 0.9, low = 45): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(low, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private snare(t: number, dest: AudioNode, gain = 0.35): void {
    this.noise({ t, dur: 0.08, gain, release: 0.12, filter: 'bandpass', freq: 1800, q: 0.7, dest });
    this.tone({ t, dur: 0.05, freq: 190, type: 'triangle', gain: gain * 0.8, release: 0.08, dest });
  }

  private hat(t: number, dest: AudioNode, open = false, gain = 0.12): void {
    this.noise({ t, dur: open ? 0.18 : 0.02, gain, release: open ? 0.15 : 0.03, filter: 'highpass', freq: 7000, dest });
  }

  private crash(t: number, dest: AudioNode, gain = 0.25): void {
    this.noise({ t, dur: 0.3, gain, release: 1.4, filter: 'highpass', freq: 3500, dest });
  }

  private hoofHit(t: number, dest: AudioNode, gain = 0.5): void {
    this.noise({ t, dur: 0.015, gain, release: 0.04, filter: 'bandpass', freq: 900 + Math.random() * 300, q: 2.5, dest });
    this.tone({ t, dur: 0.02, freq: 110, type: 'sine', gain: gain * 0.5, release: 0.05, dest });
  }

  private chord(t: number, dur: number, notes: string[], dest: AudioNode, opts: Partial<ToneOpts> = {}): void {
    for (const n of notes) this.tone({ t, dur, freq: freq(n), dest, ...opts });
  }

  // ---------- music tracks ----------

  private readonly tracks: Record<MusicName, Track> = {
    arena: {
      bpm: 124,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const prog = [
          { root: 'A2', chord: ['A3', 'C4', 'E4', 'A4'] },
          { root: 'F2', chord: ['F3', 'A3', 'C4', 'F4'] },
          { root: 'C3', chord: ['C4', 'E4', 'G4', 'C5'] },
          { root: 'G2', chord: ['G3', 'B3', 'D4', 'G4'] },
        ][bar % 4];
        for (let i = 0; i < 8; i++) {
          const t = t0 + i * b * 0.5;
          const up = i === 5 || i === 7;
          this.tone({ t, dur: b * 0.4, freq: freq(prog.root) * (up ? 2 : 1), type: 'sawtooth', lowpass: 420, gain: 0.22, sustain: 0.6, release: 0.05, dest });
        }
        for (let i = 0; i < 16; i++) {
          const note = prog.chord[[0, 1, 2, 3, 2, 1][i % 6]];
          this.tone({ t: t0 + i * b * 0.25, dur: b * 0.18, freq: freq(note) * 2, type: 'sawtooth', lowpass: 2600, gain: 0.05, release: 0.06, dest });
        }
        this.chord(t0, b * 3.8, prog.chord, dest, { type: 'triangle', gain: 0.045, attack: 0.3, release: 0.3 });
        for (let i = 0; i < 4; i++) {
          this.kick(t0 + i * b, dest);
          if (i % 2 === 1) this.snare(t0 + i * b, dest);
          this.hat(t0 + i * b, dest);
          this.hat(t0 + i * b + b * 0.5, dest, i === 3, 0.09);
        }
      },
    },

    tension: {
      bpm: 60,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        this.tone({ t: t0, dur: b * 4, freq: freq('A1'), type: 'sine', gain: 0.22, attack: 0.5, release: 0.6, dest });
        this.tone({ t: t0, dur: b * 4, freq: freq('A1'), type: 'sawtooth', lowpass: 140, gain: 0.14, attack: 0.6, release: 0.6, detune: 6, dest });
        this.kick(t0, dest, 0.55, 38);
        this.kick(t0 + 0.38, dest, 0.38, 38);
        if (bar % 2 === 1) {
          const pings = ['E5', 'F5', 'Bb4', 'Eb5', 'B4'];
          const n = pings[Math.floor(Math.random() * pings.length)];
          this.tone({ t: t0 + Math.random() * b * 2, dur: 1.4, freq: freq(n), type: 'sine', gain: 0.04, attack: 0.02, release: 1.2, dest });
        }
        if (bar % 4 === 2) {
          this.noise({ t: t0, dur: 3, gain: 0.035, attack: 2.4, release: 0.8, filter: 'bandpass', freq: 300, freqEnd: 1600, q: 1.2, dest });
        }
        if (bar % 3 === 2) {
          const n = ['D2', 'F2', 'E2', 'Bb1'][Math.floor(Math.random() * 4)];
          this.tone({ t: t0 + b, dur: 2.2, freq: freq(n), type: 'sawtooth', lowpass: 320, gain: 0.08, attack: 0.4, release: 0.8, vibrato: { rate: 5, depth: 2 }, dest });
        }
      },
    },

    gallop: {
      bpm: 150,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const roots = ['C2', 'F2', 'G2', 'C2'];
        const root = roots[bar % 4];
        const melodies: [number, string, number][][] = [
          [[0, 'C5', 0.5], [0.5, 'E5', 0.5], [1, 'G5', 1], [2, 'E5', 0.5], [2.5, 'C5', 0.5], [3, 'G4', 1]],
          [[0, 'D5', 0.5], [0.5, 'F5', 0.5], [1, 'A5', 1], [2, 'F5', 0.5], [2.5, 'D5', 0.5], [3, 'A4', 1]],
          [[0, 'B4', 0.5], [0.5, 'D5', 0.5], [1, 'G5', 1], [2, 'D5', 0.5], [2.5, 'B4', 0.5], [3, 'D5', 0.5], [3.5, 'F5', 0.5]],
          [[0, 'E5', 0.5], [0.5, 'G5', 0.5], [1, 'C6', 1.5], [2.5, 'G5', 0.5], [3, 'E5', 0.5], [3.5, 'C5', 0.5]],
        ];
        for (const [off, note, len] of melodies[bar % 4]) {
          this.tone({ t: t0 + off * b, dur: len * b * 0.85, freq: freq(note), type: 'square', lowpass: 1900, gain: 0.07, attack: 0.01, release: 0.05, dest });
        }
        for (let i = 0; i < 4; i++) {
          const t = t0 + i * b;
          this.tone({ t, dur: b * 0.45, freq: freq(root), type: 'sawtooth', lowpass: 380, gain: 0.2, dest });
          this.tone({ t: t + b * 0.5, dur: b * 0.4, freq: freq(root) * 1.5, type: 'sawtooth', lowpass: 380, gain: 0.16, dest });
          this.kick(t, dest, 0.7);
          this.hoofHit(t, dest, 0.5);
          this.hoofHit(t + b * 0.5, dest, 0.3);
          this.hoofHit(t + b * 0.75, dest, 0.35);
          if (i % 2 === 1) this.snare(t, dest, 0.25);
          this.hat(t + b * 0.5, dest, false, 0.07);
        }
        this.noise({ t: t0, dur: b * 4, gain: 0.02, attack: 0.3, release: 0.3, filter: 'lowpass', freq: 600, dest });
      },
    },

    noir: {
      bpm: 84,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const prog = [
          { walk: ['D2', 'F2', 'A2', 'C3'], chord: ['D3', 'F3', 'A3', 'C4'] },
          { walk: ['G2', 'Bb2', 'D3', 'F3'], chord: ['G3', 'Bb3', 'D4', 'F4'] },
          { walk: ['D2', 'F2', 'A2', 'C3'], chord: ['D3', 'F3', 'A3', 'C4'] },
          { walk: ['A2', 'C#3', 'E3', 'G3'], chord: ['A3', 'C#4', 'E4', 'G4'] },
        ][bar % 4];
        const swing = 0.67;
        for (let i = 0; i < 4; i++) {
          const t = t0 + i * b;
          this.tone({ t, dur: b * 0.85, freq: freq(prog.walk[i]), type: 'triangle', lowpass: 500, gain: 0.26, attack: 0.02, release: 0.08, dest });
          this.tone({ t, dur: b * 0.85, freq: freq(prog.walk[i]), type: 'sine', gain: 0.18, attack: 0.02, release: 0.08, dest });
          this.hat(t, dest, false, 0.05);
          this.hat(t + b * swing, dest, false, 0.035);
          if (i % 2 === 1) {
            this.noise({ t, dur: 0.01, gain: 0.15, release: 0.03, filter: 'bandpass', freq: 2500, q: 4, dest });
            this.tone({ t, dur: 0.02, freq: 820, type: 'sine', gain: 0.08, release: 0.03, dest });
          }
        }
        this.chord(t0, b * 0.5, prog.chord, dest, { type: 'triangle', gain: 0.05, attack: 0.01, release: 0.25 });
        this.chord(t0 + b * (1 + swing), b * 0.4, prog.chord, dest, { type: 'triangle', gain: 0.04, attack: 0.01, release: 0.2 });
        const phrases: [number, string, number][][] = [
          [[0, 'A4', 0.6], [1, 'C5', 0.6], [1 + swing, 'Bb4', 0.3], [2, 'A4', 0.6], [2 + swing, 'F4', 1.2]],
          [[0.5, 'D5', 0.4], [1, 'C5', 0.4], [1 + swing, 'A4', 0.3], [2, 'G4', 1.6]],
        ];
        if (bar % 2 === 1) {
          for (const [off, note, len] of phrases[(bar >> 1) % 2]) {
            this.tone({ t: t0 + off * b, dur: len * b, freq: freq(note), type: 'sawtooth', lowpass: 950, q: 2, gain: 0.07, attack: 0.06, release: 0.2, vibrato: { rate: 5.5, depth: 4 }, dest });
          }
        }
        this.noise({ t: t0, dur: b * 4, gain: 0.012, attack: 0.5, release: 0.5, filter: 'lowpass', freq: 900, dest });
      },
    },

    daylight: {
      bpm: 100,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const prog = [
          { root: 'E2', chord: ['E3', 'G3', 'B3', 'E4'] },
          { root: 'C2', chord: ['C3', 'E3', 'G3', 'C4'] },
          { root: 'A2', chord: ['A2', 'C3', 'E3', 'A3'] },
          { root: 'B2', chord: ['B2', 'D#3', 'F#3', 'A3'] },
        ][bar % 4];
        for (let i = 0; i < 4; i++) {
          const t = t0 + i * b;
          this.noise({ t, dur: 0.008, gain: i === 2 ? 0.12 : 0.2, release: 0.03, filter: 'highpass', freq: i === 2 ? 2500 : 4500, dest });
          this.tone({ t, dur: 0.012, freq: i === 2 ? 1100 : 1700, type: 'square', gain: 0.05, release: 0.02, dest });
          this.tone({ t, dur: b * 0.42, freq: freq(prog.root), type: 'sawtooth', lowpass: 360, gain: 0.17, dest });
          this.tone({ t: t + b * 0.5, dur: b * 0.42, freq: freq(prog.root), type: 'sawtooth', lowpass: 360, gain: 0.12, dest });
        }
        for (const n of prog.chord) {
          this.tone({ t: t0, dur: b * 3.9, freq: freq(n), type: 'sawtooth', lowpass: 1100, gain: 0.03, attack: 0.4, release: 0.4, detune: -7, vibrato: { rate: 4.5, depth: 1.5 }, dest });
          this.tone({ t: t0, dur: b * 3.9, freq: freq(n), type: 'sawtooth', lowpass: 1100, gain: 0.03, attack: 0.4, release: 0.4, detune: 7, dest });
        }
        if (bar % 4 === 3) {
          this.noise({ t: t0, dur: b * 3, gain: 0.05, attack: b * 2.8, release: 0.3, filter: 'bandpass', freq: 400, freqEnd: 2500, q: 1.5, dest });
          this.snare(t0 + b * 3.5, dest, 0.2);
          this.snare(t0 + b * 3.75, dest, 0.25);
        }
      },
    },

    victory: {
      bpm: 128,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const prog = [
          { root: 'C3', chord: ['C4', 'E4', 'G4'] },
          { root: 'G2', chord: ['B3', 'D4', 'G4'] },
          { root: 'A2', chord: ['A3', 'C4', 'E4'] },
          { root: 'F2', chord: ['A3', 'C4', 'F4'] },
        ][bar % 4];
        const lead: [number, string, number][][] = [
          [[0, 'C5', 0.5], [0.5, 'E5', 0.5], [1, 'G5', 1], [2, 'C6', 2]],
          [[0, 'B5', 1], [1, 'G5', 0.5], [1.5, 'D5', 0.5], [2, 'G5', 2]],
          [[0, 'A5', 0.5], [0.5, 'C6', 0.5], [1, 'E6', 1], [2, 'C6', 2]],
          [[0, 'F5', 0.5], [0.5, 'A5', 0.5], [1, 'C6', 1], [2, 'C6', 0.5], [2.5, 'D6', 0.5], [3, 'E6', 1]],
        ];
        for (const [off, note, len] of lead[bar % 4]) {
          this.tone({ t: t0 + off * b, dur: len * b * 0.9, freq: freq(note), type: 'sawtooth', lowpass: 2300, gain: 0.08, attack: 0.02, release: 0.08, dest });
          this.tone({ t: t0 + off * b, dur: len * b * 0.9, freq: freq(note), type: 'square', lowpass: 1500, gain: 0.025, attack: 0.02, release: 0.08, detune: 5, dest });
        }
        this.chord(t0, b * 0.9, prog.chord, dest, { type: 'sawtooth', lowpass: 1500, gain: 0.05, release: 0.1 });
        this.chord(t0 + 2 * b, b * 0.9, prog.chord, dest, { type: 'sawtooth', lowpass: 1500, gain: 0.05, release: 0.1 });
        for (let i = 0; i < 8; i++) {
          const up = i === 5;
          this.tone({ t: t0 + i * b * 0.5, dur: b * 0.4, freq: freq(prog.root) * (up ? 2 : 1), type: 'sawtooth', lowpass: 450, gain: 0.2, dest });
        }
        for (let i = 0; i < 4; i++) {
          this.kick(t0 + i * b, dest);
          if (i % 2 === 1) this.snare(t0 + i * b, dest);
          this.hat(t0 + i * b, dest);
          this.hat(t0 + i * b + b * 0.5, dest, false, 0.08);
        }
        if (bar % 4 === 0) this.crash(t0, dest);
      },
    },

    drumroll: {
      bpm: 120,
      beats: 1,
      bar: (t0, bar, b, dest) => {
        for (let i = 0; i < 8; i++) {
          this.noise({ t: t0 + i * b * 0.125, dur: 0.02, gain: 0.12 + (i % 2) * 0.04, release: 0.04, filter: 'bandpass', freq: 2000, q: 0.8, dest });
        }
        if (bar % 2 === 0) this.tone({ t: t0, dur: 0.3, freq: 75, type: 'sine', gain: 0.3, release: 0.3, dest });
      },
    },

    cinema: {
      bpm: 72,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const prog = [
          { root: 'C2', chord: ['C3', 'E3', 'G3', 'B3'], arp: ['E4', 'G4', 'B4', 'D5'] },
          { root: 'A1', chord: ['A2', 'C3', 'E3', 'G3'], arp: ['C4', 'E4', 'G4', 'B4'] },
          { root: 'F1', chord: ['F2', 'A2', 'C3', 'E3'], arp: ['A3', 'C4', 'E4', 'G4'] },
          { root: 'G1', chord: ['G2', 'B2', 'D3', 'F3'], arp: ['B3', 'D4', 'G4', 'A4'] },
        ][bar % 4];
        for (const n of prog.chord) {
          this.tone({ t: t0, dur: b * 4.2, freq: freq(n), type: 'sawtooth', lowpass: 700, gain: 0.03, attack: 1.2, release: 1.5, detune: -6, vibrato: { rate: 0.3, depth: 1 }, dest });
          this.tone({ t: t0, dur: b * 4.2, freq: freq(n), type: 'triangle', gain: 0.035, attack: 1.0, release: 1.5, detune: 6, dest });
        }
        this.tone({ t: t0, dur: b * 3.8, freq: freq(prog.root), type: 'sine', gain: 0.22, attack: 0.3, release: 1.0, dest });
        for (let i = 0; i < 8; i++) {
          const n = prog.arp[[0, 1, 2, 3, 2, 1, 3, 2][i]];
          this.tone({ t: t0 + i * b * 0.5, dur: b * 0.6, freq: freq(n), type: 'triangle', gain: 0.05, attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.5, dest });
        }
        if (bar % 2 === 1) {
          const n = ['E5', 'D5', 'C5', 'B4'][(bar >> 1) % 4];
          this.tone({ t: t0 + b, dur: b * 2.5, freq: freq(n), type: 'sine', gain: 0.05, attack: 0.4, release: 1.2, vibrato: { rate: 4.5, depth: 2 }, dest });
        }
        this.noise({ t: t0, dur: b * 4, gain: 0.008, attack: 1, release: 1, filter: 'lowpass', freq: 700, dest });
      },
    },

    casino: {
      bpm: 118,
      beats: 4,
      bar: (t0, bar, b, dest) => {
        const prog = [
          { walk: ['C2', 'E2', 'G2', 'A2'], chord: ['E3', 'G3', 'Bb3', 'D4'] },
          { walk: ['F2', 'A2', 'C3', 'Eb3'], chord: ['A3', 'C4', 'Eb4', 'G4'] },
          { walk: ['C2', 'E2', 'G2', 'Bb2'], chord: ['E3', 'G3', 'Bb3', 'D4'] },
          { walk: ['G2', 'B2', 'D3', 'F3'], chord: ['B3', 'D4', 'F4', 'A4'] },
        ][bar % 4];
        const swing = 0.66;
        for (let i = 0; i < 4; i++) {
          const t = t0 + i * b;
          this.tone({ t, dur: b * 0.8, freq: freq(prog.walk[i]), type: 'triangle', lowpass: 600, gain: 0.26, attack: 0.01, release: 0.08, dest });
          this.hat(t, dest, false, 0.07);
          this.hat(t + b * swing, dest, i === 3, 0.05);
          this.kick(t, dest, 0.45, 50);
          if (i % 2 === 1) this.snare(t, dest, 0.18);
        }
        this.chord(t0 + b * swing, b * 0.3, prog.chord, dest, { type: 'sawtooth', lowpass: 1800, gain: 0.05, attack: 0.01, release: 0.15 });
        this.chord(t0 + b * 2 + b * swing, b * 0.3, prog.chord, dest, { type: 'sawtooth', lowpass: 1800, gain: 0.05, attack: 0.01, release: 0.15 });
        const stabs: [number, string, number][][] = [
          [[0, 'G5', 0.4], [1, 'E5', 0.4], [1 + swing, 'G5', 0.3], [2, 'Bb5', 0.8], [3, 'A5', 0.6]],
          [[0.5, 'C6', 0.4], [1, 'Bb5', 0.3], [1 + swing, 'G5', 0.3], [2, 'E5', 1.2]],
          [[0, 'G5', 0.3], [0.5, 'G5', 0.3], [1, 'Bb5', 0.5], [2, 'D6', 0.5], [2 + swing, 'C6', 0.4], [3, 'Bb5', 0.6]],
          [[0, 'A5', 0.4], [1, 'F5', 0.4], [2, 'D5', 0.4], [2 + swing, 'F5', 0.3], [3, 'G5', 0.9]],
        ];
        for (const [off, note, len] of stabs[bar % 4]) {
          this.tone({ t: t0 + off * b, dur: len * b, freq: freq(note), type: 'sawtooth', lowpass: 2600, q: 1.5, gain: 0.06, attack: 0.02, release: 0.12, vibrato: { rate: 5.5, depth: 3 }, dest });
        }
        if (bar % 8 === 7) this.crash(t0 + b * 3.5, dest, 0.12);
      },
    },

    heartbeat: {
      bpm: 64,
      beats: 1,
      bar: (t0, bar, b, dest) => {
        this.kick(t0, dest, 0.8, 40);
        this.kick(t0 + b * 0.28, dest, 0.55, 36);
        this.tone({ t: t0, dur: b, freq: freq('A1'), type: 'sine', gain: 0.12, attack: 0.3, release: 0.4, dest });
        if (bar % 4 === 0) {
          this.tone({ t: t0, dur: b * 4, freq: freq('A1'), type: 'sawtooth', lowpass: 120, gain: 0.1, attack: 1, release: 1, detune: 5, dest });
        }
        if (bar % 3 === 1) {
          const n = ['E5', 'Eb5', 'B4', 'F5'][Math.floor(Math.random() * 4)];
          this.tone({ t: t0 + Math.random() * b * 0.5, dur: 1.2, freq: freq(n), type: 'sine', gain: 0.03, attack: 0.02, release: 1, dest });
        }
      },
    },

    alarm: {
      bpm: 120,
      beats: 2,
      bar: (t0, _bar, b, dest) => {
        for (const det of [-6, 6]) {
          const osc = this.ctx!.createOscillator();
          osc.type = 'sawtooth';
          osc.detune.value = det;
          osc.frequency.setValueAtTime(520, t0);
          osc.frequency.linearRampToValueAtTime(980, t0 + b);
          osc.frequency.linearRampToValueAtTime(520, t0 + 2 * b);
          const f = this.ctx!.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 2800;
          const g = this.ctx!.createGain();
          g.gain.value = 0.11;
          osc.connect(f);
          f.connect(g);
          g.connect(dest);
          osc.start(t0);
          osc.stop(t0 + 2 * b + 0.01);
        }
        this.kick(t0, dest, 0.8);
        this.kick(t0 + b, dest, 0.8);
      },
    },
  };

  playMusic(name: MusicName): void {
    const ctx = this.ensure();
    if (!ctx || !MUSIC_ENABLED) return;
    if (this.playing?.name === name) return;
    this.stopMusic(0.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.4);
    gain.connect(this.master!);

    const track = this.tracks[name];
    const beat = 60 / track.bpm;
    const barDur = beat * track.beats;
    let next = ctx.currentTime + 0.05;
    let bar = 0;

    const tick = (): void => {
      while (next < ctx.currentTime + 0.6) {
        track.bar(next, bar, beat, gain);
        next += barDur;
        bar += 1;
      }
    };
    tick();
    const timer = window.setInterval(tick, 100);
    this.playing = { name, gain, timer };
  }

  stopMusic(fade = 0.5): void {
    const p = this.playing;
    if (!p || !this.ctx) return;
    window.clearInterval(p.timer);
    const now = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    const g = p.gain;
    window.setTimeout(() => g.disconnect(), (fade + 1.5) * 1000);
    this.playing = null;
  }

  // ---------- sound effects ----------

  sfx(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const dest = this.sfxGain!;
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'click':
        this.tone({ t, dur: 0.05, freq: 900, glide: 600, type: 'sine', gain: 0.12, release: 0.04, dest });
        break;
      case 'back':
        this.tone({ t, dur: 0.06, freq: 500, glide: 340, type: 'sine', gain: 0.12, release: 0.04, dest });
        break;
      case 'flip':
        this.noise({ t, dur: 0.03, gain: 0.3, release: 0.05, filter: 'highpass', freq: 2500, dest });
        this.noise({ t: t + 0.05, dur: 0.02, gain: 0.2, release: 0.04, filter: 'lowpass', freq: 1500, dest });
        break;
      case 'hoof':
        this.hoofHit(t, dest, 0.5);
        this.hoofHit(t + 0.09, dest, 0.35);
        this.hoofHit(t + 0.14, dest, 0.4);
        break;
      case 'gunshot':
        this.noise({ t, dur: 0.04, gain: 0.9, release: 0.35, filter: 'lowpass', freq: 900, dest });
        this.noise({ t, dur: 0.03, gain: 0.5, release: 0.06, filter: 'highpass', freq: 3000, dest });
        this.tone({ t, dur: 0.1, freq: 95, glide: 32, type: 'sine', gain: 0.8, release: 0.25, dest });
        break;
      case 'cheer':
        this.noise({ t, dur: 1.0, gain: 0.28, attack: 0.35, release: 1.3, filter: 'bandpass', freq: 1100, q: 0.7, dest });
        for (let i = 0; i < 4; i++) {
          const base = 500 + Math.random() * 300;
          this.tone({ t: t + 0.2 + i * 0.22, dur: 0.3, freq: base, glide: base * 1.5, type: 'triangle', gain: 0.035, attack: 0.05, release: 0.2, dest });
        }
        break;
      case 'ding':
        this.tone({ t, dur: 0.1, freq: 1319, type: 'sine', gain: 0.15, release: 1.1, dest });
        this.tone({ t, dur: 0.1, freq: 1760, type: 'sine', gain: 0.1, release: 0.9, dest });
        this.tone({ t, dur: 0.1, freq: 2637, type: 'triangle', gain: 0.04, release: 0.6, dest });
        break;
      case 'whoosh':
        this.noise({ t, dur: 0.3, gain: 0.22, attack: 0.1, release: 0.15, filter: 'bandpass', freq: 300, freqEnd: 3200, q: 1.5, dest });
        break;
      case 'tick':
        this.tone({ t, dur: 0.015, freq: 1200, type: 'square', gain: 0.06, release: 0.02, dest });
        break;
      case 'sting':
        for (const [i, n] of ['C4', 'E4', 'G4', 'C5', 'E5'].entries()) {
          this.tone({ t: t + i * 0.04, dur: 1.0, freq: freq(n), type: 'sawtooth', lowpass: 2600, gain: 0.07, attack: 0.01, release: 0.6, dest });
        }
        this.crash(t, dest, 0.2);
        break;
      case 'fail':
        this.tone({ t, dur: 0.22, freq: 392, type: 'sawtooth', lowpass: 900, gain: 0.14, release: 0.05, vibrato: { rate: 6, depth: 6 }, dest });
        this.tone({ t: t + 0.25, dur: 0.22, freq: 349, type: 'sawtooth', lowpass: 900, gain: 0.14, release: 0.05, vibrato: { rate: 6, depth: 6 }, dest });
        this.tone({ t: t + 0.5, dur: 0.22, freq: 311, type: 'sawtooth', lowpass: 900, gain: 0.14, release: 0.05, vibrato: { rate: 6, depth: 6 }, dest });
        this.tone({ t: t + 0.75, dur: 0.8, freq: 294, glide: 230, type: 'sawtooth', lowpass: 800, gain: 0.14, release: 0.3, vibrato: { rate: 7, depth: 10 }, dest });
        break;
      case 'howl': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.exponentialRampToValueAtTime(760, t + 0.6);
        osc.frequency.setValueAtTime(760, t + 1.1);
        osc.frequency.exponentialRampToValueAtTime(520, t + 2.0);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lg = ctx.createGain();
        lg.gain.value = 9;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.3);
        g.gain.setValueAtTime(0.11, t + 1.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
        osc.connect(g);
        g.connect(dest);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 2.2);
        lfo.stop(t + 2.2);
        break;
      }
      case 'gavel':
        for (const off of [0, 0.22]) {
          this.noise({ t: t + off, dur: 0.02, gain: 0.5, release: 0.06, filter: 'lowpass', freq: 1200, dest });
          this.tone({ t: t + off, dur: 0.03, freq: 160, type: 'sine', gain: 0.4, release: 0.1, dest });
        }
        break;
      case 'boo':
        for (const det of [-20, 0, 25]) {
          this.tone({ t, dur: 0.9, freq: 210, glide: 150, type: 'sawtooth', lowpass: 600, gain: 0.07, attack: 0.1, release: 0.3, detune: det, vibrato: { rate: 4, depth: 5 }, dest });
        }
        break;
      case 'fanfare':
        for (const [i, [n, len]] of ([['G4', 0.15], ['C5', 0.15], ['E5', 0.15], ['G5', 0.7]] as [string, number][]).entries()) {
          const start = t + [0, 0.17, 0.34, 0.51][i];
          this.tone({ t: start, dur: len, freq: freq(n), type: 'sawtooth', lowpass: 2200, gain: 0.1, attack: 0.01, release: 0.15, dest });
          this.tone({ t: start, dur: len, freq: freq(n) / 2, type: 'square', lowpass: 1200, gain: 0.04, attack: 0.01, release: 0.15, dest });
        }
        this.crash(t + 0.51, dest, 0.15);
        break;
      case 'rocket':
        this.noise({ t, dur: 0.5, gain: 0.25, attack: 0.05, release: 0.2, filter: 'bandpass', freq: 200, freqEnd: 4000, q: 1.2, dest });
        this.tone({ t, dur: 0.5, freq: 120, glide: 900, type: 'sawtooth', lowpass: 1500, gain: 0.08, release: 0.1, dest });
        break;
      case 'engine':
        this.tone({ t, dur: 2.5, freq: 45, glide: 70, type: 'sawtooth', lowpass: 200, gain: 0.2, attack: 0.4, release: 0.8, vibrato: { rate: 22, depth: 6 }, dest });
        this.noise({ t, dur: 2.5, gain: 0.08, attack: 0.4, release: 0.8, filter: 'lowpass', freq: 300, dest });
        break;
      case 'bell':
        for (const off of [0, 0.12]) {
          this.tone({ t: t + off, dur: 0.05, freq: 2800, type: 'sine', gain: 0.1, release: 0.4, dest });
          this.tone({ t: t + off, dur: 0.05, freq: 4200, type: 'sine', gain: 0.05, release: 0.3, dest });
        }
        break;
      case 'train':
        for (let i = 0; i < 8; i++) {
          this.noise({ t: t + i * 0.22, dur: 0.03, gain: i % 2 ? 0.2 : 0.3, release: 0.06, filter: 'bandpass', freq: 700, q: 1.5, dest });
        }
        this.tone({ t: t + 0.3, dur: 0.6, freq: 440, type: 'sawtooth', lowpass: 1200, gain: 0.06, attack: 0.05, release: 0.2, dest });
        this.tone({ t: t + 0.3, dur: 0.6, freq: 554, type: 'sawtooth', lowpass: 1200, gain: 0.06, attack: 0.05, release: 0.2, dest });
        break;
      case 'buzz':
        for (const off of [0, 0.3, 0.6]) {
          this.tone({ t: t + off, dur: 0.18, freq: 180, type: 'square', lowpass: 900, gain: 0.08, release: 0.03, dest });
        }
        break;
      case 'snore':
        this.noise({ t, dur: 0.9, gain: 0.12, attack: 0.3, release: 0.4, filter: 'lowpass', freq: 500, freqEnd: 250, q: 2, dest });
        this.tone({ t, dur: 0.9, freq: 90, glide: 60, type: 'sawtooth', lowpass: 250, gain: 0.06, attack: 0.3, release: 0.4, vibrato: { rate: 18, depth: 8 }, dest });
        break;
      case 'ring':
        // Old-fashioned telephone: two bursts of a fast trill.
        for (const off of [0, 1.0]) {
          for (let i = 0; i < 12; i++) {
            const tt = t + off + i * 0.05;
            this.tone({ t: tt, dur: 0.025, freq: i % 2 ? 1450 : 1180, type: 'square', lowpass: 3200, gain: 0.07, attack: 0.003, release: 0.02, dest });
          }
        }
        break;
      case 'lock':
        this.noise({ t, dur: 0.02, gain: 0.5, release: 0.05, filter: 'highpass', freq: 3000, dest });
        this.tone({ t, dur: 0.03, freq: 2200, glide: 900, type: 'square', gain: 0.1, release: 0.05, dest });
        this.noise({ t: t + 0.13, dur: 0.03, gain: 0.5, release: 0.08, filter: 'bandpass', freq: 1200, q: 2, dest });
        this.tone({ t: t + 0.13, dur: 0.05, freq: 320, glide: 120, type: 'sine', gain: 0.3, release: 0.12, dest });
        break;
      case 'stamp':
        this.noise({ t, dur: 0.03, gain: 0.8, release: 0.25, filter: 'lowpass', freq: 700, dest });
        this.tone({ t, dur: 0.08, freq: 140, glide: 40, type: 'sine', gain: 0.7, release: 0.2, dest });
        this.noise({ t: t + 0.01, dur: 0.02, gain: 0.3, release: 0.05, filter: 'highpass', freq: 4000, dest });
        break;
      case 'crash':
        this.noise({ t, dur: 0.08, gain: 0.8, release: 0.6, filter: 'lowpass', freq: 500, dest });
        this.tone({ t, dur: 0.3, freq: 80, glide: 25, type: 'sawtooth', lowpass: 300, gain: 0.5, release: 0.5, dest });
        for (const n of ['C2', 'F#2', 'C3']) {
          this.tone({ t: t + 0.05, dur: 1.4, freq: freq(n), type: 'sawtooth', lowpass: 700, gain: 0.07, attack: 0.02, release: 0.8, vibrato: { rate: 6, depth: 4 }, dest });
        }
        break;
      case 'riser':
        this.noise({ t, dur: 2.6, gain: 0.12, attack: 2.2, release: 0.3, filter: 'bandpass', freq: 200, freqEnd: 3800, q: 1.3, dest });
        this.tone({ t, dur: 2.6, freq: 110, glide: 880, type: 'sawtooth', lowpass: 1600, gain: 0.05, attack: 1.5, release: 0.2, dest });
        break;
      case 'coin':
        this.tone({ t, dur: 0.06, freq: 1975, type: 'square', gain: 0.07, release: 0.04, dest });
        this.tone({ t: t + 0.07, dur: 0.25, freq: 2637, type: 'square', gain: 0.07, release: 0.25, dest });
        break;
    }
  }
}

export const audio = new AudioEngine();
