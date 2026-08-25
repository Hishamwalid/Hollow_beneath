export interface GameSettings {
  masterVolume: number;
  textSpeed: number;
  screenShake: boolean;
  /** Accessibility: gates shakes, large movements, and freeze-frame pulses. */
  reduceMotion: boolean;
  /** Phase 6d: difficulty mode ('easy'|'normal'|'hard'|'ironman'). */
  difficulty: 'easy' | 'normal' | 'hard' | 'ironman';
}

const STORAGE_KEY = 'hollow_beneath_settings';

const DEFAULTS: GameSettings = {
  masterVolume: 100,
  textSpeed: 100,
  screenShake: true,
  reduceMotion: false,
  difficulty: 'normal',
};

class SettingsManager {
  private settings: GameSettings;

  constructor() {
    this.settings = this.load();
  }

  get(): GameSettings {
    return { ...this.settings };
  }

  set(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.save();
  }

  reset(): void {
    this.settings = { ...DEFAULTS };
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      console.warn('Failed to save settings');
    }
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      const merged = { ...DEFAULTS, ...parsed };
      // Sanitize numeric fields — corrupted values previously froze all
      // typewriter text (NaN timer delay in DialogBox/TutorialScene).
      const vol = Number(merged.masterVolume);
      const spd = Number(merged.textSpeed);
      merged.masterVolume = Number.isFinite(vol) ? Math.min(100, Math.max(0, vol)) : DEFAULTS.masterVolume;
      merged.textSpeed = Number.isFinite(spd) && spd > 0 ? Math.min(200, Math.max(20, spd)) : DEFAULTS.textSpeed;
      return merged;
    } catch {
      return { ...DEFAULTS };
    }
  }
}

export const settingsManager = new SettingsManager();
