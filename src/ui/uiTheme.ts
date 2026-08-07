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