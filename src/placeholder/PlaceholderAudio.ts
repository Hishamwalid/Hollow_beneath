type ToneShape = 'sine' | 'square' | 'triangle' | 'sawtooth';

class PlaceholderAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 1;

  get muted(): boolean { return this.masterVolume < 0.01; }

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.25 * this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(freq: number, durationMs: number, shape: ToneShape = 'sine', delayMs = 0, gainMul = 1): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = shape;
    osc.frequency.value = freq;
    const start = ctx.currentTime + delayMs / 1000;
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.9 * gainMul, start + Math.min(0.02, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  click(): void { this.tone(420, 60, 'triangle'); }
  confirm(): void { this.tone(520, 80, 'triangle'); this.tone(720, 100, 'triangle', 60); }
  diceRoll(): void { for (let i = 0; i < 4; i++) this.tone(300 + i * 40, 40, 'square', i * 50); }
  moveStep(): void { this.tone(260, 40, 'square'); }
  hit(): void { this.tone(150, 90, 'sawtooth'); }
  critHit(): void { this.tone(200, 60, 'sawtooth'); this.tone(320, 100, 'sawtooth', 40); }
  miss(): void { this.tone(180, 60, 'sine', 0, 0.5); }
  weaknessHit(): void { this.tone(500, 60, 'triangle'); this.tone(700, 120, 'triangle', 50); }
  heal(): void { this.tone(480, 100, 'sine'); this.tone(640, 140, 'sine', 80); }
  damageTaken(): void { this.tone(120, 140, 'sawtooth', 0, 1.1); }
  statusApplied(): void { this.tone(380, 70, 'square'); }
  momentumFull(): void { [440, 550, 660, 880].forEach((f, i) => this.tone(f, 90, 'triangle', i * 70)); }
  victory(): void { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 180, 'triangle', i * 110)); }
  defeat(): void { [392, 349, 293, 220].forEach((f, i) => this.tone(f, 220, 'sawtooth', i * 130, 0.8)); }
  bossPhase(): void { this.tone(150, 300, 'sawtooth', 0, 1.2); this.tone(80, 400, 'sine', 100, 1.2); }
  levelUp(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 140, 'triangle', i * 90)); }
  shardGain(): void { this.tone(900, 50, 'sine'); this.tone(1200, 70, 'sine', 40); }
  pageTurn(): void { this.tone(200, 40, 'triangle'); this.tone(160, 60, 'triangle', 30); }
  checkpoint(): void { this.tone(660, 80, 'triangle'); this.tone(880, 120, 'triangle', 90); }
  crisis(): void { this.tone(90, 320, 'sawtooth', 0, 1.3); this.tone(60, 400, 'sine', 90, 1.2); this.tone(130, 200, 'sawtooth', 200, 0.9); }
  bravery(): void { this.tone(330, 80, 'triangle'); this.tone(440, 120, 'triangle', 70); this.tone(550, 160, 'triangle', 140); }
  desperation(): void { this.tone(140, 240, 'square', 0, 0.9); this.tone(105, 300, 'sine', 80, 0.9); }

  // ---- Phase 7 cue extensions (doc Part 18) ----
  /** Weakness crunch — a clean, percussive break when you hit a weakness. */
  weaknessCrunch(): void { this.tone(240, 45, 'triangle'); this.tone(180, 90, 'square', 20, 0.8); }
  /** Resonance chime — a crystalline ascent when Resonance climbs a tier mid-fight. */
  resonanceChime(): void { [660, 880, 1100].forEach((f, i) => this.tone(f, 90, 'sine', i * 45, 0.6)); }
  /** Adaptation warning — dissonant intent before a boss hardens against you. */
  adaptationWarning(): void { this.tone(220, 90, 'sawtooth', 0, 1.1); this.tone(165, 110, 'square', 70, 1.0); this.tone(247, 140, 'sawtooth', 140, 0.9); }
  /** AP ding — short bright confirmation when tokens change hands. */
  apDing(): void { this.tone(1040, 55, 'sine'); }
  /** Combo ding — a quick two-note stamp when a combo sequence lands. */
  comboDing(): void { this.tone(660, 55, 'triangle'); this.tone(880, 80, 'triangle', 45); }
  /** Fatigue gasp — a strained breath as exhaustion bites. */
  fatigueGasp(): void { this.tone(150, 160, 'sine', 0, 0.5); this.tone(120, 220, 'sine', 90, 0.45); }

  setMasterVolume(v: number): void {
    this.masterVolume = Math.min(1, Math.max(0, v / 100));
    if (this.masterGain) {
      this.masterGain.gain.value = 0.25 * this.masterVolume;
    }
  }
}

export const audio = new PlaceholderAudioEngine();
