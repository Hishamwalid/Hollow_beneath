// ============================================================================
// THE HOLLOW BENEATH — UI theme ("Expedition Journal" direction)
//
// Two-tier panel system over the dark world:
//  • PARCHMENT panels (narration, dialogue, choices, codex) read like the
//    field journal the player keeps — aged paper, ink-brown text.
//  • STONE panels (board HUD cards) stay instrument-dark with gold hairlines.
//
// Fonts: Cinzel tracked caps → IM Fell body → Courier Prime numbers.
// ============================================================================

// Fantasy display font (Cinzel) - titles, headers
export const FONT_SERIF = '"HollowCinzel", Georgia, "Times New Roman", serif';
// Parchment / ancient-book body font (IM Fell English)
export const FONT_BODY = '"HollowFell", Georgia, "Times New Roman", serif';
// Numeric readouts (HP / AP / stats) - Courier Prime
export const FONT_MONO = '"HollowMono", "Courier New", monospace';

// Readable size scale for a 1280x800 canvas. Body text never drops below 14px.
export const SZ = {
  xs: '14px',   // dense labels / readouts
  sm: '16px',   // body, buttons, form text
  md: '18px',   // emphasized body / sub-titles
  lg: '24px',   // panel titles
  xl: '30px',   // screen titles
  xxl: '38px',  // main menu title
} as const;

/** Spacing scale (px) — keep vertical rhythm consistent across scenes. */
export const SP = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

export const PALETTE_HEX = {
  void: '#0b0d10',
  stone: '#16191d',
  stoneLight: '#22262c',
  bone: '#e8e2d4',
  boneMuted: '#9a9488',
  gold: '#c9a24b',
  goldBright: '#e9c876',
  danger: '#b0453f',
  ok: '#5c8a5c',
  player: '#7fb0c9',

  // ---- Parchment journal -----------------------------------------------------
  paper: '#e6ddc4',        // aged paper fill
  paperDark: '#d9cdb0',    // shaded paper (edges/folds)
  ink: '#33291c',          // primary writing ink
  inkSoft: '#6b5a41',      // secondary ink (annotations)
  oxide: '#8a6a2f',        // oxide-gold heading ink on paper
  oxblood: '#7c2f26',      // danger stamps on paper
  waxRed: '#8e3b2e',       // faction wax-seal base

  // ---- Resonance tiers ---------------------------------------------------------
  resStable: '#7fb0c9',
  resAwakened: '#5c8a5c',
  resUnmoored: '#9b59b6',
  resTranscendent: '#c9a24b',
};

/** Faction status colors (Hostile → Devoted). */
export const STATUS_HEX = {
  Hostile: PALETTE_HEX.danger,
  Neutral: PALETTE_HEX.boneMuted,
  Friendly: PALETTE_HEX.ok,
  Devoted: PALETTE_HEX.gold,
};

/** Resonance tier → display color. */
export const RESONANCE_TIER_HEX: Record<string, string> = {
  Stable: PALETTE_HEX.resStable,
  Awakened: PALETTE_HEX.resAwakened,
  Unmoored: PALETTE_HEX.resUnmoored,
  Transcendent: PALETTE_HEX.resTranscendent,
};

export const DAMAGE_TYPE_HEX: Record<string, string> = {
  slash: '#c0392b',
  pierce: '#d4ac0d',
  blunt: '#8b5a2b',
  flame: '#e67e22',
  frost: '#5dade2',
  shock: '#9b59b6',
  sacred: '#f5f0e1',
  shadow: '#7a7a86',
};

// Battle UI design palette (Battle UI.svg, 1920x1080 source) — combat only.
export const DESIGN = {
  panelOlive: '#9b741e',
  buttonInner: '#21252a',
  hpRed: '#b10000',
  mpBlue: '#64b5f5',
  momentumPurple: '#b967bc',
  shadow: '#291c00',
  shadowAlpha: 0.76,
} as const;
