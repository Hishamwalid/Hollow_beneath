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
    body: 'Beneath the world, something ancient reads minds. It has consumed entire civilizations looking for one it cannot finish.\n\nThat mind is yours.\n\nDescend 200 nodes across 20 pages. Reach the chamber at the bottom. Find out why you are the one who cannot be read.',
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
    body: 'You have 2 Action Points (AP) per turn. Attack costs 1 AP. Skills cost 1-2 AP. Guard halves incoming damage for the round.\n\nHit enemy weaknesses to build Momentum. At 3 Momentum, choose a bonus: extra turn, heal, restore MP, free skill, or big hit.\n\nIf you die, you return to the last checkpoint with 50% HP and MP.',
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
