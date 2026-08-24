// ============================================================================
// THE HOLLOW BENEATH — Procedural audio engine ("atmospheric, subtle")
//
// Pure Web Audio synthesis — no asset files. Every cue is built from layered
// voices: shaped oscillators, filtered noise bursts, and a shared procedural
// reverb send, all mixed through a master compressor bus.
//
// Public API (cue method names) is unchanged from the placeholder engine, so
// no call sites had to move. Adds ambient beds:
//   startAmbience('menu' | 'descent' | 'loom') / stopAmbience()
// ============================================================================

type ToneShape = 'sine' | 'square' | 'triangle' | 'sawtooth';

interface ToneOpts {
  freq: number;
  durMs: number;
  shape?: ToneShape;
  delayMs?: number;
  gain?: number;
  /** Pitch glides to this frequency over the duration. */
  glideTo?: number;
  /** Stereo position -1..1. */
  pan?: number;
  /** Reverb send level 0..1. */
  send?: number;
  /** Attack time in ms (default 8). */
  attackMs?: number;
  /** Simple lowpass on the voice (single frequency). */
  lpHz?: number;
  /** Detuned unison layers for thickening (default 1). */
  layers?: number;
}

interface NoiseOpts {
  durMs: number;
  color?: 'white' | 'brown';
  delayMs?: number;
  gain?: number;
  pan?: number;
  send?: number;
  /** Bandpass/lowpass/highpass sweep across the burst. */
  filter?: { type: BiquadFilterType; f0: number; f1?: number; q?: number };
}

class PlaceholderAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compNode: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private whiteBuf: AudioBuffer | null = null;
  private brownBuf: AudioBuffer | null = null;
  private masterVolume = 1;

  private ambienceNodes: Array<AudioScheduledSourceNode | AudioNode> = [];
  private ambienceTimers: number[] = [];
  private ambienceMode: 'menu' | 'descent' | 'loom' | null = null;

  get muted(): boolean {
    return this.masterVolume < 0.01;
  }

  // ---- Infrastructure -------------------------------------------------------

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;

      this.compNode = ctx.createDynamicsCompressor();
      this.compNode.threshold.value = -20;
      this.compNode.knee.value = 24;
      this.compNode.ratio.value = 5;
      this.compNode.attack.value = 0.004;
      this.compNode.release.value = 0.24;

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0.32 * this.masterVolume;

      this.compNode.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Procedural reverb: decaying stereo noise impulse response.
      const irLen = Math.floor(ctx.sampleRate * 2.1);
      const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.6);
        }
      }
      this.reverbNode = ctx.createConvolver();
      this.reverbNode.buffer = ir;
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0.55;
      this.reverbNode.connect(this.reverbGain);
      this.reverbGain.connect(this.compNode);

      // Cached noise buffers.
      const nLen = Math.floor(ctx.sampleRate * 1.2);
      this.whiteBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const wd = this.whiteBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) wd[i] = Math.random() * 2 - 1;
      this.brownBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const bd = this.brownBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < nLen; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        bd[i] = last * 3.2;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private outNode(pan: number): AudioNode | null {
    const ctx = this.ensureCtx();
    if (!ctx || !this.compNode) return null;
    if (!pan) return this.compNode;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    panner.connect(this.compNode);
    return panner;
  }

  private sendToReverb(amount: number, pan: number): AudioNode | null {
    const ctx = this.ensureCtx();
    if (!ctx || !this.reverbNode || amount <= 0) return null;
    const g = ctx.createGain();
    g.gain.value = amount;
    g.connect(this.reverbNode);
    if (pan) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(panner);
      panner.connect(this.reverbNode);
    } else {
      g.connect(this.reverbNode);
    }
    return g;
  }

  // ---- Voice helpers ----------------------------------------------------------

  private tone(o: ToneOpts): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const dest = this.outNode(o.pan ?? 0);
    const send = this.sendToReverb((o.send ?? 0) * 0.9, o.pan ?? 0);
    if (!dest && !send) return;

    const start = ctx.currentTime + (o.delayMs ?? 0) / 1000;
    const dur = o.durMs / 1000;
    const attack = (o.attackMs ?? 8) / 1000;
    const layers = o.layers ?? 1;

    for (let l = 0; l < layers; l++) {
      const osc = ctx.createOscillator();
      osc.type = o.shape ?? 'sine';
      osc.frequency.setValueAtTime(o.freq, start);
      if (o.glideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glideTo), start + dur);
      }
      if (layers > 1) {
        osc.detune.setValueAtTime((l - (layers - 1) / 2) * 7, start); // ±cents spread
      }

      const gain = ctx.createGain();
      const peak = 0.85 * (o.gain ?? 1) / Math.sqrt(layers);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + Math.min(attack, dur / 3));
      gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

      let tail: AudioNode = gain;
      if (o.lpHz) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = o.lpHz;
        gain.connect(lp);
        tail = lp;
      }

      osc.connect(gain);
      if (dest) tail.connect(dest);
      if (send) tail.connect(send);

      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
  }

  private noise(o: NoiseOpts): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const buf = (o.color ?? 'white') === 'brown' ? this.brownBuf : this.whiteBuf;
    if (!buf) return;
    const dest = this.outNode(o.pan ?? 0);
    const send = this.sendToReverb((o.send ?? 0) * 0.9, o.pan ?? 0);
    if (!dest && !send) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const start = ctx.currentTime + (o.delayMs ?? 0) / 1000;
    const dur = o.durMs / 1000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.5 * (o.gain ?? 1), start + Math.min(10, dur * 220) / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

    let head: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.setValueAtTime(o.filter.f0, start);
      if (o.filter.f1 !== undefined) {
        f.frequency.exponentialRampToValueAtTime(Math.max(40, o.filter.f1), start + dur);
      }
      f.Q.value = o.filter.q ?? 1;
      src.connect(f);
      head = f;
    }
    head.connect(gain);
    if (dest) gain.connect(dest);
    if (send) gain.connect(send);

    src.start(start, Math.random() * 0.4);
    src.stop(start + dur + 0.05);
  }

  // ---- Ambience beds ----------------------------------------------------------

  /**
   * menu   — wind-over-stone above the sinkhole
   * descent— deeper cave air while exploring the board
   * loom   — the Final Chamber: slow fifth pad, distant rumbles/chimes
   */
  startAmbience(mode: 'menu' | 'descent' | 'loom'): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.compNode) return;
    if (this.ambienceMode === mode) return;
    this.stopAmbience();
    this.ambienceMode = mode;

    const keep = (n: AudioScheduledSourceNode | AudioNode) => this.ambienceNodes.push(n);

    // Shared wind bed: brown noise → LFO'd lowpass.
    if ((mode === 'menu' || mode === 'descent')) {
      const src = ctx.createBufferSource();
      src.buffer = this.brownBuf!;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = mode === 'menu' ? 420 : 260;
      lp.Q.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = mode === 'menu' ? 180 : 110;
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);
      const g = ctx.createGain();
      g.gain.value = mode === 'menu' ? 0.05 : 0.065;
      g.gain.linearRampToValueAtTime(mode === 'menu' ? 0.05 : 0.065, ctx.currentTime + 3); // gentle fade-in
      src.connect(lp);
      lp.connect(g);
      g.connect(this.compNode);
      src.start();
      lfo.start();
      keep(src);
      keep(lfo);
      void lfoGain;
    }

    // Sub-drone: detuned sine pair under everything.
    if (mode !== 'menu') {
      for (const f of [55, 55.8]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 4);
        o.connect(g);
        g.connect(this.compNode);
        o.start();
        keep(o);
      }
    }

    // Loom pad: slow fifth + tremolo, and distant events on a loose scheduler.
    if (mode === 'loom') {
      for (const [f, det] of [[110, 0], [165, 4], [110.6, -4]] as Array<[number, number]>) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        if (det) o.detune.value = det;
        const trem = ctx.createOscillator();
        trem.frequency.value = 0.12 + Math.random() * 0.08;
        const tremG = ctx.createGain();
        tremG.gain.value = 0.012;
        const g = ctx.createGain();
        g.gain.value = 0.02;
        trem.connect(tremG);
        tremG.connect(g.gain);
        o.connect(g);
        g.connect(this.compNode);
        o.start();
        trem.start();
        keep(o);
        keep(trem);
      }
      const scheduleDistant = () => {
        if (this.ambienceMode !== 'loom') return;
        if (Math.random() < 0.45) {
          this.noise({ durMs: 1400, color: 'brown', gain: 0.5, filter: { type: 'lowpass', f0: 140, f1: 60 }, send: 0.9 });
        } else {
          this.tone({ freq: Math.random() < 0.5 ? 659 : 880, durMs: 900, shape: 'sine', gain: 0.14, send: 1 });
        }
        const t = window.setTimeout(scheduleDistant, 8000 + Math.random() * 9000);
        this.ambienceTimers.push(t);
      };
      const t = window.setTimeout(scheduleDistant, 5000);
      this.ambienceTimers.push(t);
    }
  }

  stopAmbience(): void {
    this.ambienceTimers.forEach((t) => window.clearTimeout(t));
    this.ambienceTimers = [];
    for (const n of this.ambienceNodes) {
      try {
        if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') {
          (n as AudioScheduledSourceNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.ambienceNodes = [];
    this.ambienceMode = null;
  }

  // ---- Cues -------------------------------------------------------------------

  click(): void {
    this.tone({ freq: 1500, durMs: 26, shape: 'square', gain: 0.22, lpHz: 3200 });
    this.noise({ durMs: 30, gain: 0.15, filter: { type: 'highpass', f0: 3000 } });
  }
  confirm(): void {
    this.tone({ freq: 523, durMs: 90, shape: 'triangle', gain: 0.5 });
    this.tone({ freq: 784, durMs: 160, shape: 'triangle', delayMs: 70, gain: 0.5, send: 0.25 });
  }
  diceRoll(): void {
    for (let i = 0; i < 5; i++) {
      this.noise({
        durMs: 42, gain: 0.34 - i * 0.04, delayMs: i * 62,
        filter: { type: 'bandpass', f0: 1800 - i * 260, q: 5 },
      });
    }
    this.tone({ freq: 240, durMs: 70, shape: 'triangle', delayMs: 300, gain: 0.4 });
  }
  moveStep(): void {
    this.tone({ freq: 96, durMs: 70, shape: 'sine', glideTo: 60, gain: 0.75 });
    this.noise({ durMs: 36, gain: 0.12, filter: { type: 'lowpass', f0: 700 } });
  }
  hit(): void {
    this.noise({ durMs: 90, gain: 0.55, filter: { type: 'bandpass', f0: 900, f1: 260, q: 1.1 } });
    this.tone({ freq: 130, durMs: 95, shape: 'sawtooth', gain: 0.6, glideTo: 70, lpHz: 900 });
  }
  critHit(): void {
    this.hit();
    this.tone({ freq: 620, durMs: 190, shape: 'square', gain: 0.2, send: 0.35, lpHz: 2600 });
    this.tone({ freq: 930, durMs: 150, shape: 'square', gain: 0.14, delayMs: 40, send: 0.35, lpHz: 2800 });
  }
  miss(): void {
    this.noise({ durMs: 150, gain: 0.3, filter: { type: 'bandpass', f0: 420, f1: 1500, q: 2.2 }, send: 0.15 });
  }
  weaknessHit(): void {
    this.critHit();
    this.tone({ freq: 1240, durMs: 210, shape: 'sine', gain: 0.2, send: 0.55, delayMs: 30 });
  }
  heal(): void {
    [392, 494, 587].forEach((f, i) =>
      this.tone({ freq: f, durMs: 260, shape: 'sine', delayMs: i * 90, gain: 0.32, send: 0.4 }),
    );
  }
  damageTaken(): void {
    this.tone({ freq: 110, durMs: 170, shape: 'sawtooth', gain: 0.8, glideTo: 62, lpHz: 520 });
    this.noise({ durMs: 110, gain: 0.3, filter: { type: 'lowpass', f0: 480, f1: 160 } });
  }
  statusApplied(): void {
    this.tone({ freq: 360, durMs: 60, shape: 'square', gain: 0.3 });
    this.tone({ freq: 540, durMs: 80, shape: 'square', gain: 0.22, delayMs: 55 });
    this.noise({ durMs: 70, gain: 0.1, filter: { type: 'bandpass', f0: 1200, q: 4 }, delayMs: 30 });
  }
  momentumFull(): void {
    [440, 554, 659, 880].forEach((f, i) =>
      this.tone({ freq: f, durMs: 150, shape: 'triangle', delayMs: i * 68, gain: 0.4, send: 0.3, layers: 2 }),
    );
  }
  victory(): void {
    [392, 523, 659, 784].forEach((f, i) =>
      this.tone({ freq: f, durMs: 340, shape: 'triangle', delayMs: i * 115, gain: 0.42, send: 0.45, layers: 2 }),
    );
  }
  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone({ freq: f, durMs: 400, shape: 'sawtooth', delayMs: i * 150, gain: 0.34, send: 0.4, lpHz: 1100, layers: 2 }),
    );
  }
  bossPhase(): void {
    this.tone({ freq: 82, durMs: 700, shape: 'sawtooth', gain: 0.85, attackMs: 90, send: 0.7, lpHz: 420, layers: 3 });
    this.tone({ freq: 123, durMs: 550, shape: 'sawtooth', gain: 0.5, delayMs: 60, send: 0.6, lpHz: 600 });
    this.tone({ freq: 41, durMs: 800, shape: 'sine', gain: 0.8, delayMs: 40 });
  }
  levelUp(): void {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ freq: f, durMs: 260, shape: 'triangle', delayMs: i * 92, gain: 0.4, send: 0.45, layers: 2 }),
    );
  }
  shardGain(): void {
    [1046, 1318, 1568].forEach((f, i) =>
      this.tone({ freq: f, durMs: 120 + i * 50, shape: 'sine', delayMs: i * 46, gain: 0.26, send: 0.6 }),
    );
  }
  pageTurn(): void {
    this.noise({ durMs: 170, gain: 0.4, filter: { type: 'highpass', f0: 900, f1: 2600 }, send: 0.12 });
    this.noise({ durMs: 90, gain: 0.22, delayMs: 120, filter: { type: 'bandpass', f0: 1400, q: 1.4 } });
  }
  checkpoint(): void {
    this.tone({ freq: 660, durMs: 300, shape: 'sine', gain: 0.34, send: 0.6 });
    this.tone({ freq: 880, durMs: 420, shape: 'sine', delayMs: 110, gain: 0.3, send: 0.7 });
  }
  crisis(): void {
    this.bossPhase();
    this.tone({ freq: 208, durMs: 260, shape: 'sawtooth', gain: 0.4, delayMs: 220, send: 0.5, lpHz: 900 });
  }
  bravery(): void {
    [330, 440, 554].forEach((f, i) =>
      this.tone({ freq: f, durMs: 170, shape: 'triangle', delayMs: i * 74, gain: 0.36, send: 0.3 }),
    );
  }
  desperation(): void {
    this.tone({ freq: 148, durMs: 300, shape: 'square', gain: 0.42, glideTo: 98, lpHz: 700 });
    this.tone({ freq: 111, durMs: 380, shape: 'sine', gain: 0.44, delayMs: 84 });
  }

  // ---- Phase 7 cue extensions ----
  weaknessCrunch(): void {
    this.noise({ durMs: 60, gain: 0.5, filter: { type: 'bandpass', f0: 700, f1: 240, q: 0.9 } });
    this.tone({ freq: 185, durMs: 110, shape: 'square', gain: 0.4, lpHz: 1200 });
    this.tone({ freq: 1240, durMs: 180, shape: 'sine', gain: 0.16, delayMs: 26, send: 0.55 });
  }
  resonanceChime(): void {
    [660, 880, 1100].forEach((f, i) =>
      this.tone({ freq: f, durMs: 160 + i * 40, shape: 'sine', delayMs: i * 46, gain: 0.24, send: 0.7 }),
    );
  }
  adaptationWarning(): void {
    this.tone({ freq: 220, durMs: 130, shape: 'sawtooth', gain: 0.5, send: 0.3, lpHz: 1500, layers: 2 });
    this.tone({ freq: 165, durMs: 150, shape: 'square', gain: 0.4, delayMs: 76, lpHz: 1200 });
    this.tone({ freq: 247, durMs: 200, shape: 'sawtooth', gain: 0.36, delayMs: 152, send: 0.35, lpHz: 1600 });
  }
  apDing(): void {
    this.tone({ freq: 1040, durMs: 70, shape: 'sine', gain: 0.28, send: 0.25 });
  }
  comboDing(): void {
    this.tone({ freq: 660, durMs: 66, shape: 'triangle', gain: 0.32 });
    this.tone({ freq: 880, durMs: 110, shape: 'triangle', gain: 0.3, delayMs: 48, send: 0.3 });
  }
  fatigueGasp(): void {
    this.noise({ durMs: 200, gain: 0.2, filter: { type: 'bandpass', f0: 500, f1: 260, q: 1.6 } });
    this.tone({ freq: 148, durMs: 230, shape: 'sine', gain: 0.34, delayMs: 70, glideTo: 108 });
  }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.min(1, Math.max(0, v / 100));
    if (this.masterGain) {
      this.masterGain.gain.value = 0.32 * this.masterVolume;
    }
  }
}

export const audio = new PlaceholderAudioEngine();
