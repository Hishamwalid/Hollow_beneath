export interface TutorialScreen {
  id: string;
  title: string;
  body: string;
  icons?: string[];
}

/**
 * One short screen before the descent begins. Everything else is taught
 * contextually on the board / in combat — see ui/CoachTip.
 */
export const INTRO_SCREEN: TutorialScreen = {
  id: 'intro',
  title: 'THE DESCENT',
  body: "You heard a voice. It said: keep walking.\n\nSo you walk.\n\nRoll the die. Walk. Choose. Live with it.\n\nEverything else, you'll learn on the way down.",
  icons: ['tok_player'],
};

/** Optional reference pages — Menu → "How to Play" (the Delver's Primer). */
export const TUTORIAL_SCREENS: TutorialScreen[] = [
  {
    id: 'on_the_road',
    title: 'On the Road',
    icons: ['node_event', 'node_combat', 'node_rest', 'node_discovery', 'node_trap'],
    body: 'Roll a six-sided die and walk that many nodes. The AHEAD panel shows what is coming — plan around it.\n\n◆ Event — a story choice\n▲ Combat — enemies bar the path\n✚ Rest — recover HP & MP\n✦ Discovery — search for loot and lore\n! Trap — dodge or suffer\n★ Landmark — a chapter boss\n\nLandmarks and capture points stop you. History cannot be skipped.',
  },
  {
    id: 'combat_basics',
    title: 'Combat Basics',
    icons: ['tok_player'],
    body: 'One action per turn — ATTACK, SKILL, GUARD, ITEM — then END TURN. Enemies answer in speed order.\n\nATTACK lands instantly. Offensive SKILLS run a timing needle: stop it in the gold center for PERFECT (+30% damage). GUARD halves incoming damage, prevents Stagger — and banks +6 MP.\n\nBelow 35% HP you may get one desperate gamble. Checkpoints at nodes 40 / 80 / 120 / 160 catch your falls.',
  },
  {
    id: 'scan_and_reactions',
    title: 'Scan & Reactions',
    icons: ['node_combat', 'node_discovery'],
    body: 'Every enemy starts with eight UNKNOWN affinity slots. Hit a foe with a damage type to test that slot forever:\n\nwk = weakness (+50% dmg, Downed, grants 1-More) · str = resist\nnull = immune · rep = reflects back at you · drn = heals them\n\nSCAN is free, anytime. Discoveries persist across every run in your Bestiary.\n\nElements interact: Shock a CHILLED target → Brittle Frost (stun). Burn a Shocked one → Overcharge. Hit a Sacred-marked foe with Shadow → Eclipse (strips buffs, double damage).',
  },
  {
    id: 'loadout_and_goal',
    title: 'Loadout & Goal',
    icons: ['node_landmark'],
    body: 'Six skill slots are active in combat — everything else waits in your ARCHIVE. New chapters unlock techniques tuned to what lurks there; swap freely between fights from the Loadout screen.\n\nFive guardians block the path to the Loom. Each one heard her too.\n\nDefeat them all. Reach the chamber at the bottom.\n\nThe thing waiting at the end of the journey is you.',
  },
];

/** First-encounter tooltips surfaced by the board's AHEAD panel. */
export const FIRST_NODE_TOOLTIPS: Record<string, string> = {
  combat: 'Combat node — defeat the enemy to proceed. Offensive skills: center the needle = PERFECT.',
  event: 'Event node — choices shift factions & Resonance.',
  discovery: 'Discovery node — search for items and lore.',
  rest: 'Rest node — restore HP and MP.',
  trap: 'Trap node — DEX check to dodge.',
  landmark: 'Landmark — a major boss waits here.',
};
