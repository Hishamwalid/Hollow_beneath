# THE HOLLOW BENEATH — Scenes (Full Narrative Script)

*Definitive Edition scene reference. Each scene lists its board node and event/boss id. Dialogue is verbatim from the Definitive Narrative Script. Boss battles keep their full mechanical detail in `ENEMIES_AND_BOSSES.md`.*

---

## PROLOGUE — THE SURFACE: EVE'S HOUSE

*(Presented by the tutorial's "Who You Are" screen + Node 1 cutscene.)*

*A small room. Dust on every surface except one desk, wiped clean. A leather journal sits in the center. The PLAYER stands before it.*

**NARRATION:** For seven hundred years, certain people have experienced the same dream. An impossible version of themselves. Power without limit. The promise of becoming the best they could possibly be. They are called Seekers.

*The journal's final entry, shaky, almost childlike:*

**EVE (V.O.):** *"The Deep stares at you. The emotion in its gaze is the comfort of freedom itself."*

**NARRATION:** Eve was a Seeker. She entered the Beneath, and she came back. But she did not come back as the same person. When you were eleven, she became a Hollow. When you were twenty-one, she died. She forgot almost everything. Eventually, she forgot how to breathe.

*A photograph on the desk: Eve, young, at the mouth of a cave. Smiling. Alive.*

**NARRATION:** You are not a Seeker. You never dreamed the dream. You enter the Beneath for one reason.

**NARRATION:** You want to understand what happened to your mother.

---

## CHAPTER 1 — THE ARCHIVE OPENS (Nodes 1–40)

### Scene 1.1 — The Descent
**Node 1 · `prologue_descent` (cutscene)**

The PLAYER descends through a collapsed sinkhole — rope creaks, expedition rope and rusted pitons give way to ashfall corridors ribbed with Venn masonry. Gold light pulses ahead.

**NARRATION:** Three days into the Keth-7 survey. A cave-in at the Chalk Doorway cost the expedition half its supplies and its best geologist. Expedition leader Anya Korr extended the timeline by a week. Then she went silent. Contact with the surface failed yesterday.

**NARRATION:** The Hollow is not a dungeon. It is a dead city preserved in cold stone and warm bone. Its architecture is syntax. Corridors form sentences. Rooms are paragraphs. The deeper you descend, the more the structure reads like a question you are walking toward the answer of.

### Scene 1.2 — Eve's First Voice
**Node 8 · `eves_first_voice` (cutscene, +1 eveVoiceHeard)**

An old expedition camp. Broken equipment. Dried blood. A journal open on a crate — a sketch of the First Door.

- **PLAYER:** Mom?
- **EVE (V.O.):** You shouldn't have come here.
- **PLAYER:** Mom?
- **EVE (V.O.):** Keep walking.
- **PLAYER:** Where are you?
- *(long silence; wind through stone)*
- **EVE (V.O.):** I don't know.

The camp is empty. The voice came from everywhere and nowhere.

### Scene 1.3 — First Blood
**Node 15 · `first_blood` (scripted combat)**

Pale sand. A DUST WIGHT rises — it does not attack until looked at too long.

**NARRATION:** The dust-caked dead do not mind being dead. They mind being watched.

Combat vs Dust Wight. Afterward it crumbles; beneath it: a Sable ash-mark, half-burned, and a name scratched in the sand — **"EVE."**

### Scene 1.4 — The Argent Sentinel
**Node 40 · Landmark boss `sentinel`**

The Archive Threshold. A gold-lit doorway. Before it, the SENTINEL studies rather than strikes.

**THE ARGENT SENTINEL:** Why do you seek the Door?

Pre-combat choices:
- **[A] "I want answers."** → *"Answers are not treasures. They are weights."*
- **[B] "I want to know what my mother saw."** → the Sentinel tilts its head, almost recognition: *"...Then you are not here for the Door. You are here for the threshold."*
- **[C] Attack.** → it raises no weapon; it simply waits.

Phase dialogue:
- Curator (>66%): *"You are not the first to arrive with grief instead of purpose."*
- Erudite (>33%): *"The Venn did not flee. They did not fall. They left. Consider what they left behind."*
- Desperate Guardian (≤33%): *"I have been so very tired. And so very good at my work."*

Aftermath — silver flaking like ash:

**THE ARGENT SENTINEL:** You are not the one I remember.
**PLAYER:** Who do you remember?
**THE ARGENT SENTINEL:** The woman. ...She asked the same question.

The Sentinel dissolves. The First Door opens. The map turns like a page.

---

## CHAPTER 2 — THE SABLE MARCH (Nodes 41–80)

### Scene 2.1 — The Hollowed Man
**Node 48 · `the_hollowed_man` (dialogue event)**

A Sable shelter. An old man wrapped in blankets — clear eyes, empty mind. He is Hollow.

- **PLAYER:** Are you with the expedition?
- **HOLLOWED MAN:** I was... something. I came down here for the same reason everyone does.
- **PLAYER:** The dream?
- **HOLLOWED MAN:** No. I came because of a woman.
- *(the PLAYER goes still)*
- **HOLLOWED MAN:** She told me to go home. She said the Deep wasn't what I thought. She said... *(he looks directly at the PLAYER)* ...She said her child would come eventually. And that I should tell them...
- *(the memory slips away like water)*
- **HOLLOWED MAN:** I don't remember what I was supposed to tell them.

### Scene 2.2 — The Deep Pages
**Node 60 · `the_deep_pages` (dialogue → forced combat)**

The Resonant Hall. Books whose ink has not dried in five millennia. The pages are warm; the ink shifts unobserved. They are not records — they are invitations.

- **ASH COVENANT SEER:** You carry her echo. The woman who said no.
- **PLAYER:** What do you know about Eve?
- **ASH COVENANT SEER:** She reached the Deep. She saw the Loom. And she chose solitude over translation. A strange choice. A selfish one.

Combat vs Ash Covenant Seer. Defeated, it shatters into glass and dust.

### Scene 2.3 — Patriarch Oren Cass
**Node 80 · Landmark boss `patriarch`**

The Dark Vault — a forward chapel of the Sable Order. Incense and ash.

- **PATRIARCH OREN CASS:** Keth-7. The expedition that lost its leader, its geologist, and its way. Yet you persist.
- **PLAYER:** I'm looking for my mother.
- **CASS** *(nods)***: Eve.**
- **PLAYER:** You knew her?
- **CASS:** Everyone who has gone deep enough knows Eve.
- **PLAYER:** What did she do?
- **CASS:** She tried to save us.
- **PLAYER:** From the Loom?
- **CASS:** No. *(his eyes hollow in a different way — not empty, but full)* From ourselves.

Pre-combat choices:
- **[A] Accept his purification** *(skips the fight)* — ash on the forehead: *"Go in peace. The Door beyond is sealed by my blessing."* As the PLAYER leaves he whispers: *"She still waits. Not for rescue. For the next one."*
- **[B] Refuse him.** → *"I don't need your salvation. I need the truth." / "The truth is what we are trying to prevent."*
- **[C] "I know what you burned."** → his face crumples; he attacks enraged (DEF −20%).

Phase dialogue:
- Base: *"The Venn left because they saw something. It is not a god. It is not a devil. It is a becoming."*
- The Devout (>30%): *"You think I am mad. But madness is simply clarity without consent."*
- The Martyr (≤30%): *"Eve understood. The only way to stop the cycle was to become part of it. She was stronger than me. Stronger than you."*

Aftermath — kneeling, ash mixing with blood, smiling:

**PATRIARCH OREN CASS:** She is still down there. Waiting. Not for rescue. For the next one.
**PLAYER:** The next what?
**PATRIARCH OREN CASS:** The next Seeker. The next sacrifice. The next...

He dies smiling. The Second Door opens.

---

## CHAPTER 3 — THE SINGING DEEP (Nodes 81–120)

### Scene 3.1 — False Memories
**Node 88 · `false_memories` (cutscene)**

A Venn inscription almost resolves into words. Vision blurs.

- **PLAYER:** I remember Mom teaching me this. ...Wait.

Did she? Or did the stone teach you to remember it that way?

**NARRATION:** The deeper you go, the less certain reality becomes. The Loom is not just below you. It is around you. Reading.

### Scene 3.2 — The Memory Room
**Node 92 · `the_memory_room` (cutscene, +1 eveVoiceHeard)**

A chamber that should not exist: childhood bed, old toys, Eve's chair, family photographs. Every photograph has Eve's face carefully scratched away with something sharp.

- **EVE (V.O.):** Don't look.
- **PLAYER:** Why?
- **EVE (V.O.):** Because you'll remember.
- **PLAYER:** Remember what?
- **EVE (V.O.)** *(softer, pleading)***: That I wasn't always your mother.**

For a fraction of a second — a figure in the corner: Eve, young, expedition gear, holding a journal. Then gone.

### Scene 3.3 — The Merged Chorus
**Node 120 · Landmark boss `chorus`**

The Loom Gate. Forty figures in Archive robes moving as one — the voice a chord, a consensus.

- **THE MERGED CHORUS:** You call us forty.
- **PLAYER:** You are forty people.
- **THE MERGED CHORUS:** Were.
- **PLAYER:** Then what are you?
- **THE MERGED CHORUS:** Less. And more.
- **THE MERGED CHORUS:** How many memories make a person? How many voices make a self? We entered as scholars. We catalogued. We measured. We thought understanding would protect us.
- *(one mouth opens wider than it should)*
- **THE MERGED CHORUS:** The Loom does not destroy identity. It optimizes it. Forty egos. Forty fears. Forty lonely midnights. Reduced to one clear note.

During combat: *"We remember Eve. She almost joined us. She chose solitude instead. A strange choice." / "She stood where you stand. She heard the harmony. She said no. But she took something with her when she left. A fragment. A seed."*

Aftermath — voices fracturing, separating, screaming in forty pitches, then silence. One figure remains: an old woman, her face the only one still human, mouthing three soundless words:

**ARCHIVE SCHOLAR:** She... loved... you.

The Third Door opens.

---

## CHAPTER 4 — THE REACH OF DUST (Nodes 121–160)

### Scene 4.1 — The Venn Truth
**Node 132 · `the_venn_truth` (lore discovery)**

The Crystal Veins. Light fractures into prophecy. An intact inscription:

**NARRATION:** The Venn were not destroyed. They did not fall. They walked into the Loom deliberately, systematically. They set down their cups. They left their bread uneaten. And they did not return.

**PLAYER** *(reading)***: "We go not because we are called, but because we have finished the question."**

### Scene 4.2 — Eve's First Journal
**Node 155 · `eves_first_journal` (unskippable lore; sets `motherJournalFound`)**

The Archive Depths. A locked case containing not the inherited journal but Eve's FIRST journal — written before the surface, before the forgetting.

- **EVE (V.O., reading):** *"I found the Loom."*
- *"It showed me myself. It showed me the person I could become. I understood."*
- *"The thing in the Deep isn't promising us power. It's showing us what we are willing to sacrifice for it."*
- *(final page, handwriting shaky)*
- *"And I am afraid that I already said yes."*

The PLAYER closes the journal. Their hands are trembling.

### Scene 4.3 — The Fossil King
**Node 160 · Landmark boss `fossil_king`**

A throne room of black basalt. DOMINION, LAST OF ITS COURT, preserved mid-decree.

- **THE FOSSIL KING** *(voice like grinding tectonics)***: Kneel. The empire persists.**
- **PLAYER:** Your empire is dust.
- **THE FOSSIL KING:** Dust is merely empire in another form.
- **PLAYER:** Why did you stay when the Venn left?
- **THE FOSSIL KING:** Someone must issue the last order. Even if there is no one left to hear it.

Pre-combat choices: *"What did the Venn become?" / "Why did you stay?" / "Will you stop me?" (provokes, HP −10%) / "I have no question." (WILL ≥8, grants Barrier).*

Phase dialogue:
- Regal Decree (>76%): *"Imperial Edict! The foreigner shall be taxed! The dissident shall be silenced!"*
- The Rebellion (>52%): *"They rose against me. My own court. They said I had ruled too long. They were correct."*
- The Silence (>28%): *"The Venn left me behind. Not because I was unworthy. Because I was still speaking. They had finished their sentences. I had not."*
- The Fossil (final): *"You will outlive your purpose too, child. Everyone does."*

Aftermath — dissolving into sand:

**THE FOSSIL KING:** Eve... stood where you stand. She wept. Not for herself. For the next one. For...

Gone. The Fourth Door opens.

---

## CHAPTER 5 — THE FINAL DESCENT (Nodes 161–200)

### Scene 5.1 — The Ashen Tunnels
**Node 175 · `ashen_tunnels` (cutscene, +1 eveVoiceHeard)**

The tunnels breathe. Walls whisper in Venn — almost understandable now.

- **EVE (V.O.):** You're close.
- **PLAYER** *(stopping)***: Mom. I need to know. Are you really my mother?**
- *(silence)*
- **EVE (V.O.):** Does it matter?
- **PLAYER:** Yes.
- **EVE (V.O.)** *(softer)***: That's what I said too.**

### Scene 5.2 — The Eve Reveal
**Node 185 · `eve_reveal` (unskippable cutscene, +1 eveVoiceHeard)**

The Covenant Spire — a temple built toward rather than away. At its heart stands EVE: not young, not old; the age she was when she died, clear-eyed and present. Translucent — a projection, a memory, a fragment of the Loom. Her expression is real.

- **EVE:** I reached the Deep. I became Hollow. Then I tried to stop the next Seeker. I defeated them. They lost themselves. That was the cycle.
- **PLAYER:** You killed them?
- **EVE:** No. I saved them from becoming what I became. But saving them meant... becoming part of the mechanism. The Hollow doesn't just wait. It maintains. It keeps the door open. It keeps the promise alive.
- **PLAYER:** You became part of the Loom.
- **EVE:** I thought saving someone meant keeping them away from the Deep. I was wrong. The only way to save someone is to let them choose. Even if they choose wrong.
- *(she steps closer)*
- **EVE:** The Loom has been reading you since you entered. It knows your techniques. It knows your fears. It knows what you want to become.
- **PLAYER:** And what do I want to become?
- **EVE** *(smiles, sad)***: You want to become someone who understands. That's the most dangerous thing to want down here.**
- *(she fades)*
- **EVE:** The thing waiting at the end of the journey... is you.

### Scene 5.3 — The Final Reflection
**Node 200 · Landmark boss `reflection` — ending trigger**

The Final Chamber. Before the door the Venn walked through stands THE FINAL REFLECTION — the PLAYER, but finished. Calm. Certain. Wearing their face with an expression they have never seen in a mirror.

- **THE FINAL REFLECTION:** You entered the Beneath to discover what happened to your mother.
- *(it steps forward; its movements are the PLAYER's movements, perfected)*
- **THE FINAL REFLECTION:** You discovered that you are walking toward becoming exactly what she became.
- *(it raises a hand; the PLAYER's own techniques appear as shadows around it)*
- **THE FINAL REFLECTION:** I am not your enemy. I am your completion. The thought you were too afraid to finish. The power was real. The dream was real. The Beneath was real. But there was a price.
- *(its smile — the PLAYER's smile, but hollow)*
- **THE FINAL REFLECTION:** The person who reaches the end and obtains the absolute power becomes part of the Hollow. There is no true return.

Phase dialogue:
- The Argument (>72%): *"What if she is not lost? What if she is distributed?"* — Mirror Cast.
- The Evidence (>44%): *"You have been quoting her your whole life. When will you write your own lines?"* — Quoted Choice, Call Echoes.
- The Question (>16%): *"What are you? A Seeker? No. A survivor? No. A son? A daughter? A question mark wearing skin?"* — Identity Erasure. *"The Loom asks: What will you become? And you have no answer. That is why it cannot read you. That is why you are dangerous."*
- The Answer: *"I am what you will be if you finish the thought. If you accept that the cycle is not a trap, but a staircase. Step up. Or step away. But do not stand in the doorway forever."* — ⚡ Hollow Surge, telegraphed as *"I am not attacking you. I am offering you the only honest blow you will ever receive."*

Conditional phase-4 branches:
- If `motherJournalFound`: **"She already said yes. And now you have to say it too."**
- If `eveVoiceHeard ≥ 3`: **"You keep asking if I'm really her. Does it matter?"**

### Outcomes
- **Victory** → Ending 1: THE HOLLOW (see `MAIN_STORY.md`)
- **Defeat** → The Offer: *"You cannot win. But you do not have to become me."*
  - **[A] Accept the dark.** → Ending 2: LOST IN THE DARK
  - **[B] Climb to the surface.** → Ending 3: THE RETURN

Both choices lock in immediately (autosave). There is no third option.

---

## CREDITS

Over black:

**EVE (V.O.):** *"The Deep stares at you. The emotion in its gaze is the comfort of freedom itself."*

Pause.

**EVE (V.O.)** *(different tone — not from the journal, but from memory, or from the Loom itself)***: But freedom isn't the same as escape.**

Silence. Wind over stone. Fading. Gone.

**THE END**
