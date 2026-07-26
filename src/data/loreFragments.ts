// ============================================================================
// THE HOLLOW BENEATH — Lore Fragments
// Every id referenced anywhere via ctx.addLoreFragment(...) or a
// BossRewards.loreFragment must resolve here. Viewed in the Lore Codex.
// ============================================================================
import type { LoreFragmentDef } from './types';

export const LORE_FRAGMENTS: Record<string, LoreFragmentDef> = {
  // ---- Already referenced by existing events/bosses (12) -------------------

  the_departure_feast: {
    id: 'the_departure_feast',
    title: 'The Departure Feast',
    category: 'venn',
    text: 'The table was set for twelve. Only three plates show real wear — the rest were touched once, politely, and set back down. Whoever hosted this did not expect anyone to be hungry for long. There is no sign of struggle. There is, if you look closely, a candle that was allowed to burn all the way down, unhurried, to the very last inch of wick.',
  },
  the_excited_departure: {
    id: 'the_excited_departure',
    title: 'A Margin Note',
    category: 'venn',
    text: "Handwriting that gets messier line by line, like the author kept forgetting to breathe: '...it isn't loss if we asked for it. Tell the children not to grieve. Tell them we asked the door a question, and it finally, finally answered, and we are going to go see.'",
  },
  the_hymn_of_unbecoming: {
    id: 'the_hymn_of_unbecoming',
    title: 'The Hymn of Unbecoming',
    category: 'faction',
    text: "Half-remembered through stone, the tune keeps slipping a quarter-step flat, as if the singer's throat were changing shape mid-note. The words that survive: '...not lost, only loosened. Not gone, only generous. Give the shape back. It was only ever borrowed.' Ash Covenant novices are made to learn it before they understand what it is asking of them.",
  },
  sentinels_confession: {
    id: 'sentinels_confession',
    title: "The Sentinel's Confession",
    category: 'loom',
    text: 'Keth-Vor was not built to guard treasure. It was built to guard a question, and it has held that door so long it no longer remembers which is worse — someone getting in, or itself finally getting to stop. In its last recorded thought before you met it: "I have been so very tired, and so very good at my work."',
  },
  cass_unburnt_memory: {
    id: 'cass_unburnt_memory',
    title: "Cass's Unburnt Memory",
    category: 'faction',
    text: 'Patriarch Oren Cass burned every record of what the Venn left behind — every scroll, every witness, every version of himself that might have argued otherwise. One memory would not take the flame. A woman, laughing, teaching him to skip a stone. He never says her name. He is no longer sure it was ever true, only that it is the last thing of his that is still only his.',
  },
  chorus_you_are_willing: {
    id: 'chorus_you_are_willing',
    title: 'You Are Willing',
    category: 'faction',
    text: 'The Merged Chorus does not lie, which is worse than if it did. It heard, in you, the same small hunger that undid every voice it carries: the wish, just once, to be understood so completely that being alone stops being possible. It is not wrong. That is the frightening part.',
  },
  chorus_the_choirs_tragedy_scholarly: {
    id: 'chorus_the_choirs_tragedy_scholarly',
    title: "The Choir's Tragedy (Annotated)",
    category: 'faction',
    text: "Archive marginalia, cross-referenced three times: 'Subjects 1-40 entered the Singing Library seeking translation of Venn liturgical harmonics. Merge event occurred at hour 6. Recommend future field teams enter no more than 2 at a time. Resonance appears to treat a choir as a single louder mind, not forty separate ones. This should have been obvious sooner.'",
  },
  chorus_the_choirs_tragedy: {
    id: 'chorus_the_choirs_tragedy',
    title: "The Choir's Tragedy",
    category: 'faction',
    text: 'They went in forty strong, singing in rounds so the harmony would never stop, so none of them would ever have to be the last voice standing in silence. The Loom did not separate them to devour them one at a time. It simply agreed with the arrangement. Forty throats. One song. It never had to choose a victim, because they had already chosen to have none.',
  },
  chorus_was_a_warning: {
    id: 'chorus_was_a_warning',
    title: 'A Warning, Sung',
    category: 'faction',
    text: 'Every Ash Covenant hymn about the Chorus is framed as an invitation. It is not. Read backward, the harmonic structure resolves into a single repeated phrase, one the Covenant has never noticed because it is buried under forty layers of longing: "do not follow the sound this far."',
  },
  fossil_kings_court: {
    id: 'fossil_kings_court',
    title: "The Fossil King's Court",
    category: 'dominion',
    text: 'Before it was a throne of still hours, this was a working court — ministers, tax rolls, a calendar of feast days, all of it Dominion, all of it certain it would outlast the ground it stood on. The Loom did not conquer them. It simply offered to let them keep everything exactly as it was, forever, and they said yes before they understood the word.',
  },
  final_reflection: {
    id: 'final_reflection',
    title: 'The Mirror Unfinished',
    category: 'loom',
    text: "The Loom was never trying to defeat you. Defeat requires an opponent, and it has never once believed you were separate from it long enough to oppose. It reads. That is the whole of its nature. It is reading you the way it read the Venn, the way it read the Dominion, the way it will read whoever finds this page after — and it still, every time, hopes to be surprised by the ending.",
  },
  venn_fragment_starter: {
    id: 'venn_fragment_starter',
    title: 'A Purchased Certainty',
    category: 'venn',
    text: "Every surviving Venn text agrees on one thing, stated a hundred different ways: they did not leave because something drove them out. They left because they finally understood something, all at once, together — and once you understand a thing that completely, staying becomes the strange choice.",
  },

  // ---- New: sourced from the 12 new events ----------------------------------

  mira_tols_index: {
    id: 'mira_tols_index',
    title: "Mira Tol's Index",
    category: 'faction',
    text: 'Every Archive ledger Mira Tol keeps ends with the same footer, hand-inked: "Filed, not forgiven. Understood, not excused." She has catalogued three separate accounts of her own death from timelines that never happened. She keeps them in the same drawer as her keys, so she remembers to check both every morning.',
  },
  the_unmarked_names: {
    id: 'the_unmarked_names',
    title: 'The Unmarked Names',
    category: 'faction',
    text: "The Sable Order keeps no public record of who they've purified — mercy, they call the omission, though whose mercy is never specified. Somewhere there is a private ledger. It is the longest document the Order owns, and the only one Patriarch Cass has never let anyone burn.",
  },
  the_venn_farewell_rite: {
    id: 'the_venn_farewell_rite',
    title: 'The Farewell Rite',
    category: 'venn',
    text: 'Venn custom held that a door should never be the last thing you say goodbye to. Before the Departure, families ate a final meal together, out loud, badly, arguing about nothing, so that the last sound in the house would be a voice and not a latch. It is why so many tables were found half-eaten. They were not interrupted. They simply ran out of things to argue about.',
  },
  keth_vors_last_watch: {
    id: 'keth_vors_last_watch',
    title: "Keth-Vor's Last Watch",
    category: 'loom',
    text: "Something the Sentinel said, only once, only after: it was not guarding the door from you. It was guarding the door from itself — from the version of it, centuries deep, that had started to wonder what was on the other side badly enough to open it alone, without a witness, without anyone left to notice if it never came back.",
  },
  oren_thals_ledger: {
    id: 'oren_thals_ledger',
    title: "Oren-Thal's Ledger",
    category: 'faction',
    text: 'A second name for Patriarch Cass, older than the Sable Order itself: Oren-Thal, the Last Mercy. The ledger that carried it was burned along with everything else he could not stand to remember — except the ash kept its shape long enough for someone patient to read the outline of what used to be written there.',
  },
  the_four_dimensional_grammar: {
    id: 'the_four_dimensional_grammar',
    title: 'The Four-Dimensional Grammar',
    category: 'venn',
    text: 'A Venn sentence is not finished when it is spoken. It is finished when the listener acts on it — the same words meaning something different depending on what the reader does tomorrow. Archive scholars call this "consequence grammar." Field linguists call it the reason none of their translations ever stay true for more than a season.',
  },
  the_first_note: {
    id: 'the_first_note',
    title: 'The First Note',
    category: 'faction',
    text: 'Before there was a Merged Chorus, there was a single Ash Covenant convert who could no longer speak without a second voice arriving underneath the first, uninvited, in perfect harmony. She was frightened by it for exactly one day. On the second day, she began teaching others how to make room.',
  },
  the_auctioneers_provenance: {
    id: 'the_auctioneers_provenance',
    title: "The Auctioneer's Provenance",
    category: 'venn',
    text: 'Every item on the block comes with a card, hand-lettered, listing where it was found and who found it. Half the finders\' names have a small mark beside them instead of a fate. The auctioneer will tell you, if you ask kindly, that the mark just means "unavailable for follow-up questions."',
  },
  what_the_vault_showed: {
    id: 'what_the_vault_showed',
    title: 'What the Vault Showed',
    category: 'personal',
    text: 'You went into Keth-7 with a team of eleven. You do not let yourself finish that sentence very often. The vault did not hurt anyone. It only showed each of them, perfectly, precisely, a version of understanding they could not survive wanting as badly as they suddenly did. You are still not sure why it stopped at ten.',
  },
  the_dominion_soldiers_oath: {
    id: 'the_dominion_soldiers_oath',
    title: "The Dominion Soldier's Oath",
    category: 'dominion',
    text: 'An oath, still legible on what is left of a breastplate: "I will hold this ground until relieved." No army has come to relieve the Dominion in longer than any living record accounts for. Some of its soldiers are, technically, still holding.',
  },
  the_hundredth_page: {
    id: 'the_hundredth_page',
    title: 'The Hundredth Page',
    category: 'loom',
    text: 'Every account of the deep road agrees the hundredth page is close now. None of them agree on what "close" cost the person writing it. The handwriting in the margins gets calmer near the end, not more frantic — which every scholar who has studied it finds far more unsettling than panic would have been.',
  },

  // ---- New: minor landmarks at capture points (10/30/50/70/90) --------------

  the_first_marker: {
    id: 'the_first_marker',
    title: 'The First Marker',
    category: 'venn',
    text: 'A waystone, worn smooth by hands that are no longer here to keep touching it. Someone carved a tally into the base — not of days, the guide notes suggest, but of "returns." It stops at a number and does not resume.',
  },
  the_third_marker: {
    id: 'the_third_marker',
    title: 'The Third Marker',
    category: 'faction',
    text: 'Sable ash-marks, Archive chalk numbers, and a Caravan trail-glyph are all layered on the same stone, each faction leaving its own note for whoever comes next, none of them addressed to each other. It is, in its way, the most cooperative thing the four factions have ever built.',
  },
  the_fifth_marker: {
    id: 'the_fifth_marker',
    title: 'The Fifth Marker',
    category: 'loom',
    text: "Halfway, by any honest count. The air here holds a faint, constant hum, too even to be wind. It is the sound of something very large, very far below, that has not yet decided whether it has noticed you.",
  },
  the_seventh_marker: {
    id: 'the_seventh_marker',
    title: 'The Seventh Marker',
    category: 'dominion',
    text: 'A Dominion boundary post, still upright, still technically marking a border for an empire with no remaining side to defend it. Someone recent has propped a small offering against its base — food, gone to dust, left anyway.',
  },
  the_ninth_marker: {
    id: 'the_ninth_marker',
    title: 'The Ninth Marker',
    category: 'loom',
    text: 'This close to the end, the waystone carvings stop describing the road and start describing the traveler. Yours is not carved yet. There is, unmistakably, room.',
  },
  the_eleventh_marker: {
    id: 'the_eleventh_marker',
    title: 'The Eleventh Marker',
    category: 'venn',
    text: 'A cracked waystone split by a root that grows deeper than it should. The fracture was deliberate — the marker was placed on a seam, as if the Venn intended the message to break in two. Beneath: more writing, incomplete, waiting for a pen that was never coming.',
  },
  the_thirteenth_marker: {
    id: 'the_thirteenth_marker',
    title: 'The Thirteenth Marker',
    category: 'venn',
    text: 'A circle of thirteen faces carved in sequence, each expressing a different stage of what looks like grief or understanding. The thirteenth face is blank — not unfinished, but reserved. The Archive record suggests the observer is meant to see their own expression reflected in it, which means the stone is watching back.',
  },
  the_fifteenth_marker: {
    id: 'the_fifteenth_marker',
    title: 'The Fifteenth Marker',
    category: 'loom',
    text: 'At the convergence of three paths, a single word: "Choose." The Venn word carries connotations the Common translation does not — it means not only "pick" but "commit to the consequence of having picked." The paths do not reconverge.',
  },
  the_seventeenth_marker: {
    id: 'the_seventeenth_marker',
    title: 'The Seventeenth Marker',
    category: 'loom',
    text: 'Etched into a bridge railing above a chasm of impossible depth. The carving says nothing about the chasm itself — only that "the one who crosses here must not be carrying anything they were given." What counts as given is left deliberately undefined.',
  },
  the_nineteenth_marker: {
    id: 'the_nineteenth_marker',
    title: 'The Nineteenth Marker',
    category: 'venn',
    text: 'The penultimate marker is the smallest, the carving hurried, almost desperate. "Almost," it says. And then, in a postscript so faint it is nearly invisible: "For Lyra." The name is correct. The stone should not know it.',
  },

  // ---- New: discovery-node flavor (10) --------------------------------------

  a_pressed_flower_that_isnt: {
    id: 'a_pressed_flower_that_isnt',
    title: "A Pressed Flower That Isn't",
    category: 'venn',
    text: "Kept between two pages for what must be centuries, flattened and dry — except it was never a flower. Under close light it resolves into a folded scrap of handwriting, pressed flat on purpose, the words worn to illegibility by whatever hand kept turning back to check it was still there.",
  },
  the_counting_room: {
    id: 'the_counting_room',
    title: 'The Counting Room',
    category: 'venn',
    text: 'A small chamber, every wall scratched with tally marks in groups of four crossed by a fifth — thousands of them, in a hand that never seems to tire or hurry. Nothing here explains what was being counted. Only that whoever did it took the counting very seriously, right up until the marks simply stop, mid-wall.',
  },
  names_carved_then_scratched_out: {
    id: 'names_carved_then_scratched_out',
    title: 'Names, Carved, Then Scratched Out',
    category: 'venn',
    text: 'A wall of names, each one gouged out afterward by the same tool that carved it — not erased in anger, the strokes suggest, but carefully, the way you might cross something off a list once it was finally, finally done.',
  },
  the_weight_of_unread_mail: {
    id: 'the_weight_of_unread_mail',
    title: 'The Weight of Unread Mail',
    category: 'personal',
    text: "A satchel of letters, never delivered, addressed to people who are almost certainly long past reading them. You do not open any of them. Some kindnesses only work if they stay unopened.",
  },
  a_childs_height_marks: {
    id: 'a_childs_height_marks',
    title: "A Child's Height Marks",
    category: 'venn',
    text: 'Pencil lines on a doorframe, a name and a date beside each, climbing steadily upward for years — and then one more line, well above where a child\'s hand could have reached, in the same handwriting, dated the same day as the last.',
  },
  the_last_entry: {
    id: 'the_last_entry',
    title: 'The Last Entry',
    category: 'venn',
    text: 'A logbook, meticulous for four hundred pages, then one final line in handwriting nothing like the rest: "It just wanted to talk. I don\'t know why we all assumed it would want to hurt us first."',
  },
  the_recipe_that_isnt_food: {
    id: 'the_recipe_that_isnt_food',
    title: "A Recipe That Isn't Food",
    category: 'venn',
    text: "Ingredients, measurements, a cooking time — formatted exactly like a recipe, except the ingredients are concepts, and the final instruction reads: 'serve to the part of yourself that is still afraid, until it agrees to stop.'",
  },
  the_map_that_updates_itself: {
    id: 'the_map_that_updates_itself',
    title: 'The Map That Updates Itself',
    category: 'loom',
    text: 'A hand-drawn map of this exact stretch of corridor — accurate down to the crack in the floor beneath your boots, though no one has been here to draw it since you arrived. The ink of the newest line is still, impossibly, faintly wet.',
  },
  the_second_moon_that_isnt_there: {
    id: 'the_second_moon_that_isnt_there',
    title: "The Second Moon That Isn't There",
    category: 'venn',
    text: 'A Venn astronomical chart depicting two moons in careful, practiced detail. Every surface record agrees there has only ever been one. The chart is not labeled as fiction, myth, or hope. It is labeled, plainly, "before."',
  },
  the_apology_never_sent: {
    id: 'the_apology_never_sent',
    title: 'The Apology Never Sent',
    category: 'personal',
    text: "A letter, drafted and redrafted in the same hand at least six times, each version slightly less angry than the last. The final version is calm, clear, and complete. It was never folded. It was never sent. It was, apparently, enough just to have finally written it.",
  },
  the_borrowed_hour: {
    id: 'the_borrowed_hour',
    title: 'The Borrowed Hour',
    category: 'loom',
    text: "A clock, stopped, its hands pointing at a time that does not match the light outside. Wind it, and it runs backward for exactly one hour before stopping again at the same mark. No one who has tried it agrees on what they saw during that hour. All of them agree it felt like being given something back.",
  },
  sera_voss_ledger_entry: {
    id: 'sera_voss_ledger_entry',
    title: "A Page from Sera Voss's Ledger",
    category: 'faction',
    text: 'Ten years of Caravan trade routes, tolls, and casualties, kept in the same hand — and one line, dated ten years back almost to the day, that isn\'t about trade at all: "Left the Archive today. Slept the whole night through. Did not dream of understanding anything. Best sleep of my life."',
  },

  // ---- Event variant lore (B1) ------------------------------------------------

  the_correspondence: {
    id: 'the_correspondence',
    title: 'The Correspondence',
    category: 'venn',
    text: 'A stack of letters, bound in leather, each one shorter than the last. The first is seven pages of careful observation. The last is three words: "It is listening." There is no signature on any of them — as if the author knew from the start that naming themselves would defeat the purpose.',
  },
  the_echo_that_stayed: {
    id: 'the_echo_that_stayed',
    title: 'The Echo That Stayed',
    category: 'loom',
    text: 'Some echoes are accidents of acoustics. This one is not. It has a preference for where it stands in relation to you. And it has begun, very quietly, to answer your questions before you finish asking them — not always correctly, but always first.',
  },
  the_floor_song: {
    id: 'the_floor_song',
    title: 'The Floor Song',
    category: 'venn',
    text: 'The mosaic tells the story of a Venn child who asked where sound goes when it stops. The adults could not answer. The child built a floor that remembers every step, every note, every breath taken while standing on it. The floor still remembers the child\'s footsteps most clearly of all.',
  },
  the_grief_chorus: {
    id: 'the_grief_chorus',
    title: 'The Grief Chorus',
    category: 'faction',
    text: '"The Loom took our teacher on the third day of the seventh month. She walked into a resonance field singing, and the field sang back, and neither stopped until there was no difference between them. We do not mourn her death. We mourn that she stopped answering." — From the Ash Covenant Book of Losses, fourth edition.',
  },
  the_whispered_name: {
    id: 'the_whispered_name',
    title: 'The Whispered Name',
    category: 'loom',
    text: 'A name you catch in the whispers. It is not your name. It is not any name you recognize. But something in you responds to it anyway — a reflex older than language, older than memory. The name fits somewhere inside you that you did not know was shaped exactly like it.',
  },
  the_ghosts_farewell: {
    id: 'the_ghosts_farewell',
    title: "The Ghost's Farewell",
    category: 'venn',
    text: 'She sat at that table for 37 years after her family left, eating the same bread every day, keeping it warm with her presence alone. The Venn believe the dead only truly leave when the last living person who remembers them forgets their name. She ran out of people first.',
  },
};

export function getLoreFragment(id: string): LoreFragmentDef | undefined {
  return LORE_FRAGMENTS[id];
}

export const TOTAL_LORE_FRAGMENTS = Object.keys(LORE_FRAGMENTS).length;
