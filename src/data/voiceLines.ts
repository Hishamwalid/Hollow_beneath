// ============================================================================
// THE HOLLOW BENEATH — The Voice (reactive pool)
// One-line reactions fired by real play events: fights won, near-death,
// guardians felled, lore recovered. Never names her; never explains.
// Familiarity escalates only in wording, never in fact — the abstraction rule.
// ============================================================================

export type VoiceTrigger = 'victory' | 'low_hp' | 'boss_fall' | 'lore_found';

export interface VoiceLine {
  id: string;
  text: string;
}

export const VOICE_LINES: Record<VoiceTrigger, VoiceLine[]> = {
  victory: [
    { id: 'v_well_struck', text: 'THE VOICE: "Well struck."\n\nA pause.\n\n"You didn\'t use to sound like that."' },
    { id: 'v_enjoy', text: 'THE VOICE: "Careful. You\'re starting to enjoy it."' },
    { id: 'v_taught', text: 'THE VOICE: "You fight like someone I taught."\n\n"...I never taught anyone."' },
    { id: 'v_again', text: 'THE VOICE: "Again."' },
    { id: 'v_occupied', text: 'The quiet after the fight feels occupied.' },
    { id: 'v_breath', text: 'A breath that is not yours lets itself out, slow and satisfied.' },
  ],
  low_hp: [
    { id: 'lh_stay_up', text: 'THE VOICE, tight: "Stay up. Stay UP."' },
    { id: 'lh_please', text: 'THE VOICE: "Get up. Please."' },
    { id: 'lh_name', text: 'Your name — not the one you wrote down before descending. The other one.' },
    { id: 'lh_steady', text: 'A breath steadies itself just over your shoulder, timed exactly to yours.' },
  ],
  boss_fall: [
    { id: 'bf_kinder', text: 'THE VOICE, quieter than usual: "...They were kinder than they looked."' },
    { id: 'bf_easier', text: 'As the dust settles — THE VOICE: "It gets easier. That is the part to fear."' },
    { id: 'bf_door', text: 'THE VOICE: "One door closer."\n\nThen, barely audible: "I\'m sorry."' },
    { id: 'bf_silence', text: 'For three full seconds after the fall, nothing in you speaks — not even the thing that always does.' },
  ],
  lore_found: [
    { id: 'lf_burn', text: 'THE VOICE: "I remember that page."\n\n"Burn it."' },
    { id: 'lf_exhale', text: 'A soft exhale as you pocket the fragment. Approval — or grief. No way to tell them apart down here.' },
    { id: 'lf_twice', text: 'THE VOICE: "Read it twice. Then forget where you read it."' },
    { id: 'lf_mine', text: 'THE VOICE: "Not that one. Take a different one."' },
  ],
};
