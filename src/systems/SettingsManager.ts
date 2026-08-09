export interface GameSettings {
  masterVolume: number;
  textSpeed: number;
  screenShake: boolean;
  /** Phase 6d: difficulty mode ('easy'|'normal'|'hard'|'ironman'). */
  difficulty: 'easy' | 'normal' | 'hard' | 'ironman';
}

const STORAGE_KEY = 'hollow_beneath_settings';

const DEFAULTS: GameSettings = {
  masterVolume: 100,
  textSpeed: 100,
  screenShake: true,
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
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }
}

export const settingsManager = new SettingsManager();
