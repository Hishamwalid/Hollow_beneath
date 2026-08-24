export interface TutorialScreen {
  id: string;
  title: string;
  body: string;
  icons?: string[];
}

export const TUTORIAL_SCREENS: TutorialScreen[] = [
  {
    id: 'who_you_are',
    title: 'Who You Are',
    icons: ['tok_player'],
    body: 'You are Lyra Vane. A linguist.\n\nYou survived an expedition that drove thirty experts to murder each other.\n\nNow you hear the static between words.',
  },
  {
    id: 'what_youre_doing',
    title: 'What You\'re Doing',
    icons: ['node_landmark'],
    body: 'Beneath the world, something ancient reads minds. It has consumed entire civilizations looking for one it cannot finish.\n\nThat mind is yours.\n\nDescend 200 nodes across 5 chapters. Reach the chamber at the bottom. Find out why you are the one who cannot be read.',
  },
  {
    id: 'how_to_move',
    title: 'How to Move',
    icons: ['node_event', 'node_combat', 'node_discovery', 'node_rest', 'node_trap'],
    body: 'Roll a six-sided die. Move forward that many nodes. You can see the next 4 nodes — plan your path wisely.\n\n  ⚔ Combat     ? Event    ✦ Discovery\n  + Rest       ! Trap     ★ Landmark / Boss\n\nYou must stop at every Landmark and Capture Point. You cannot skip history.',
  },
  {
    id: 'how_to_fight',
    title: 'How to Fight',
    icons: ['tok_player'],
    body: 'One action per turn: ATTACK, SKILL, GUARD, ITEM — then END TURN.\n\nEvery offensive move runs a TIMING BAR. Stop the needle in the gold center for PERFECT (+30% damage, big crit chance). Miss the window and the strike glances for less.\n\nGUARD halves incoming damage, prevents Stagger from enemy crits — and recovers +6 MP.',
  },
  {
    id: 'scan_and_affinities',
    title: 'Scan & Discover',
    icons: ['node_combat', 'node_discovery'],
    body: 'Every enemy starts with eight UNKNOWN affinity slots (sl pi bl fl fr sh sc sh).\n\nHit a foe with a damage type to test that slot forever: wk = weakness (+50% dmg, Downs them, grants 1-More), str = resist, null = nothing, rep = reflects back at you, drn = heals them.\n\nSCAN is free — open it anytime. Discoveries persist across every run in your Bestiary.',
  },
  {
    id: 'reactions',
    title: 'Reactions',
    icons: ['node_combat'],
    body: 'Elements interact. Shock a CHILLED target → SUPERCONDUCT (stun). Burn a SHOCKED one → OVERCHARGE. Hit a Sacred-marked foe with Shadow → ECLIPSE (strips buffs, double damage).\n\nMark with Frost Touch or Sacred Ray; detonate with what comes next.',
  },
  {
    id: 'loadout',
    title: 'Your Loadout',
    icons: ['node_landmark'],
    body: 'Six skill slots active in combat — everything else waits in your ARCHIVE.\n\nNew chapters unlock techniques tuned to what lurks there. Swap freely between fights from the Loadout screen. There are no classes down here: only what you carry and what you\'ve learned.',
  },
  {
    id: 'your_goal',
    title: 'Your Goal',
    icons: ['node_landmark'],
    body: 'Five major guardians block the path to the Loom. Each one holds a piece of the Venn\'s story. You will not know their names until you stand before them.\n\nDefeat them all. Reach the chamber at the bottom.\n\nThe Loom will ask you a question. Your entire run has been your answer.',
  },
];

export const FIRST_NODE_TOOLTIPS: Record<string, string> = {
  combat: 'This is a Combat node. Defeat the enemy to proceed.',
  event: 'This is an Event node. Your choices affect factions and Resonance.',
  discovery: 'This is a Discovery node. Search for items and lore.',
  rest: 'Restore HP and MP at Rest nodes.',
  trap: 'This is a Trap node. Watch your step.',
  landmark: 'This is a Landmark — a major boss waits here.',
};
