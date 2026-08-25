# THE HOLLOW BENEATH — Scenes (Full Narrative Script)

*Definitive Edition scene reference — synced to the staged-narrative pass. Each scene lists its board node and event/boss id. Boss battles keep their full mechanical detail in `ENEMIES_AND_BOSSES.md`.*

**Presentation rules (Definitive pass):**
- Story beats are STAGED: short narration → a reaction for the player → consequence. No walls of prose.
- **The abstraction rule:** before Node 185, the recurring voice is never named or attributed. It is credited as `THE VOICE` in dialog and speaker plates. Eve / mother / "Mom" do not appear in any player-facing text until `eve_reveal`.
- Chapter dramatic questions are surfaced on chapter cards and the board title:
  1 · *What spoke to me?* · 2 · *Who else has heard it?* · 3 · *What did the Venn know?* · 4 · *What did she find?* · 5 · *What is waiting, wearing my face?*
- Pre-boss markers (nodes 30/70/110/150/190) carry one threshold line each that closes the chapter's question and aims at the guardian ahead.
- After every story beat, the board's Journal panel shows a reminder chip (`✦ <beat> — "<signature line>"`) so context survives long node stretches.
- The Voice reacts to play via the VoiceSystem pool (`victory` / `low_hp` / `boss_fall` / `lore_found`) through the ambient whisper overlay.

---

## PROLOGUE — BEFORE THE DESCENT

*(Character creation + intro screen.)*

**INTRO SCREEN:** "You heard a voice. It said: keep walking. So you walk."

**CHARACTER CREATION:** *"You stand at the mouth of the sinkhole. The journal is heavy in your hands. The desert wind is loud. Seven hundred years of Seekers have climbed down before you. You never dreamed their dream."*

---

## CHAPTER 1 — THE ARCHIVE OPENS (Nodes 1–40)

**Chapter question: What spoke to me?**

### Scene 1.1 — The Descent
**Node 1 · `prologue_descent` (cutscene)**

Rope creaks. Three days down a collapsed sinkhole, past rusted pitons, into corridors ribbed with bone-white masonry.

- The Keth-7 survey went silent here — leader, geologist, supplies, gone into the gold light.
- The walls read like a question.

Choices: **Walk toward the gold light** / **Say something to the dark** *(+2 Resonance; the echo comes back half-second late)*.

### Scene 1.2 — The First Voice
**Node 8 · `eves_first_voice` (staged cutscene, +1 eveVoiceHeard)**

An old expedition camp. Broken equipment. Dried blood. A journal lies open on a crate — a sketch of a door, drawn until the paper wore through.

Stage 2 — **THE VOICE:** *"You shouldn't have come here."* Close. Closer than a voice has any right to be — and familiar in a way you cannot place.

- **PLAYER:** Who are you? → **THE VOICE:** Keep walking.
- **PLAYER:** Where are you? → *(wind through stone)* → **THE VOICE:** I don't know.

Final beat: the camp is empty; the voice came from everywhere and nowhere. → *Keep walking.* (+1 eveVoiceHeard)

### Scene 1.3 — First Blood
**Node 15 · `first_blood` (scripted combat)**

Pale sand. A DUST WIGHT rises — it does not attack until looked at too long.

Afterward it crumbles; beneath it: a Sable ash-mark, half-burned, and a word scratched into the sand that the wind is already taking apart.

### Scene 1.T — Threshold: The Third Marker
**Node 30 · minor landmark**

*Threshold line:* "Ahead, past the last stretch of corridor: gold light. A door — and something standing before it that has been asking travelers a question for a very long time."

### Scene 1.4 — The Argent Sentinel
**Node 40 · Landmark boss `sentinel`**

The Archive Threshold. A gold-lit doorway. Before it, the SENTINEL studies rather than strikes.

**THE ARGENT SENTINEL:** Why do you seek the Door?

Pre-combat choices:
- **[A] "I want answers."** → *"Answers are not treasures. They are weights."*
- **[B] "I want to know what the one before me saw."** → the Sentinel tilts its head, almost recognition: *"...Then you are not here for the Door. You are here for the threshold."*
- **[C] Attack.** → it raises no weapon; it simply waits.

Aftermath — silver flaking like ash:

**THE ARGENT SENTINEL:** You are not the one I remember.
**PLAYER:** Who do you remember?
**THE ARGENT SENTINEL:** The woman. ...She asked the same question.

---

## CHAPTER 2 — THE SABLE MARCH (Nodes 41–80)

**Chapter question: Who else has heard it?**

### Scene 2.1 — The Hollowed Man
**Node 48 · `the_hollowed_man` (staged dialogue)**

A Sable shelter. An old man wrapped in blankets — clear eyes, empty mind. He is Hollow.

- **HOLLOWED MAN:** Are you with the expedition? No. Of course not. You're one of the ones who keeps walking.
- **PLAYER:** Who did you come down here for?
- **HOLLOWED MAN:** A woman. She told me to go home. She said the Deep wasn't what I thought. She said the next one would come eventually. And that I should tell them—
- *(the sentence dies in his hand)*
- **HOLLOWED MAN:** ...Tell them. I had it a moment ago.

Choices: sit with him a while (+2 Resonance) / let the message go.

### Scene 2.2 — The Deep Pages
**Node 60 · `the_deep_pages` (dialogue → optional combat)**

The Resonant Hall. Books whose ink has not dried in five millennia. The pages are warm.

- **ASH COVENANT SEER:** You carry an echo. Someone who said no. She reached the Deep. She saw the Loom. She chose solitude over translation — a selfish choice. Ask me what you actually want to ask, or draw.
- **PLAYER:** What did she see? *(combat)* — or back out of the hall slowly.

### Scene 2.3 — Patriarch Oren Cass
**Node 80 · Landmark boss `patriarch`**

The Dark Vault — a forward chapel of the Sable Order. Incense and ash.

- **PATRIARCH OREN CASS:** Keth-7. The expedition that lost its leader, its geologist, and its way. Yet you persist.
- **PLAYER:** I'm looking for someone who came down before me.
- **CASS** *(nods slowly)***:** Then you have been hearing her.
- **PLAYER:** Hearing her?
- **CASS:** The deep keeps what it cannot keep out. Everyone who has gone deep enough hears a voice that does not belong to the stone.
- **PLAYER:** What is she?
- **CASS:** Someone who tried to save us.
- **PLAYER:** From the Loom?
- **CASS:** No. *(his eyes hollow in a different way — not empty, but full)* From ourselves.

Pre-combat choices:
- **[A] Accept his purification** *(skips the fight)* — as the PLAYER leaves he whispers: *"She still waits. Not for rescue. For the next one."*
- **[B] Refuse him.** → *"I don't need your salvation. I need the truth." / "The truth is what we are trying to prevent."*

Aftermath — kneeling:

**PATRIARCH OREN CASS:** She is still down there. Waiting. Not for rescue. For the next one.

He dies smiling. The Second Door opens.

---

## CHAPTER 3 — THE SINGING DEEP (Nodes 81–120)

**Chapter question: What did the Venn know?**

### Scene 3.1 — False Memories
**Node 88 · `false_memories` (staged cutscene)**

A Venn inscription almost resolves into words. Vision blurs — and a thought arrives that does not feel borrowed: warm hands. A low room. Someone counting brush-strokes while they teach you.

Wait. Did that happen?

Choices: **Keep the memory, even if it is false** / **Give the memory back** (-2 Resonance).

### Scene 3.2 — The Memory Room
**Node 92 · `the_memory_room` (staged cutscene, +1 eveVoiceHeard)**

A chamber that should not exist: childhood bed, old toys, a reading chair worn smooth by one person in the same spot. On the desk — family photographs, face-down. Every one of them.

Turn them over: the same face scratched out of every single one — carefully, deliberately.

- **THE VOICE:** Don't look.
- **PLAYER:** Look anyway *(+3 Resonance)* → the scratch marks tell you everything: someone wanted to forget her on purpose.
- Or put them back → **THE VOICE,** softer: Thank you.

### Scene 3.3 — The Merged Chorus
**Node 120 · Landmark boss `chorus`**

The Loom Gate. Forty figures in Archive robes moving as one — the voice a chord, a consensus.

Closing lines: *"We remember another. Almost one of us, once. She chose solitude instead. A strange choice."*

Aftermath — one figure remains, mouthing three soundless words:

**ARCHIVE SCHOLAR:** She... listens... still.

---

## CHAPTER 4 — THE REACH OF DUST (Nodes 121–160)

**Chapter question: What did she find?**

### Scene 4.1 — The Venn Truth
**Node 132 · `the_venn_truth` (lore discovery)**

The Crystal Veins. One inscription survives intact:

**PLAYER** *(reading)***:** "We go not because we are called, but because we have finished the question."

Copy it (+10 XP, lore fragment) or leave it unread.

### Scene 4.2 — The First Journal
**Node 155 · `eves_first_journal` (staged lore; sets `motherJournalFound`)**

The Archive Depths. A locked case — inside, another journal: older, spine cracked from a descent that happened before yours.

**THE VOICE,** reading aloud over your shoulder:
- *"I found the Loom."*
- *"It showed me myself. What I could become. I understood."*
- *(final page, shaky)* *"And I am afraid that I already said yes."*

Your hands tremble — they are not your tremors. Take the journal (somewhere far below, the voice pauses mid-breath) or close the case gently (this time the voice does not pause; somehow that is worse).

### Scene 4.3 — The Fossil King
**Node 160 · Landmark boss `fossil_king`**

A throne room of black basalt. DOMINION, LAST OF ITS COURT, preserved mid-decree.

Aftermath — dissolving into sand:

**THE FOSSIL KING:** Another... stood where you stand. Long ago. They wept. Not for themselves. For the next one. For...

Gone. The Fourth Door opens.

---

## CHAPTER 5 — THE FINAL DESCENT (Nodes 161–200)

**Chapter question: What is waiting, wearing my face?**

### Scene 5.1 — The Ashen Tunnels
**Node 175 · `ashen_tunnels` (staged cutscene, +1 eveVoiceHeard)**

The tunnels breathe. Walls whisper in Venn — almost understandable now.

- **THE VOICE:** You're close.
- **PLAYER:** I need to know who you are. What you are.
- **THE VOICE:** Does it matter?
- **PLAYER:** Yes.
- **THE VOICE** *(softer)***:** That's what I said too.

Or say nothing and keep walking — the silence weighs more than any question would have.

### Scene 5.2 — The Reveal
**Node 185 · `eve_reveal` (unskippable staged cutscene, +1 eveVoiceHeard)**

Title: **THE VOICE, GIVEN A FACE.**

The Covenant Spire — a temple built toward rather than away. At its heart stands a woman: translucent, a projection, a fragment of the Loom. Her expression is real.

She speaks, and the floor drops out of you. That voice — the empty camp, the scratched photographs, the breathing tunnels. Everywhere and nowhere, the whole way down.

- **PLAYER:** It was you. Every time. It was always you.
- **EVE:** Every time. From the first camp onward. I couldn't come closer than this — not without becoming part of what holds you here.
- **PLAYER:** Who are you?
- **EVE:** My name is Eve. And I am your mother.

Then the confession: she reached the Deep, became Hollow, defeated the next Seeker to save them — saving them meant joining the mechanism. The Loom has been reading you since you entered. *"You want to understand. That's the most dangerous thing to want down here."*

She fades: *"The thing waiting at the end of the journey... is you."*

Choices at the naming: **Reach for her** (+5 Resonance) / **"Why tell me only now?"**

### Scene 5.3 — The Final Reflection
**Node 200 · Landmark boss `reflection` — ending trigger**

The Final Chamber. Before the door the Venn walked through stands THE FINAL REFLECTION — the PLAYER, but finished.

Opening: *"You entered the Beneath to discover what happened to your mother. You discovered that you are walking toward becoming exactly what she became."*

Conditional phase-4 branches:
- If `motherJournalFound`: **"She already said yes. And now you have to say it too."**
- If `eveVoiceHeard ≥ 3`: **"You keep asking if I'm really her. Does it matter?"**

### Outcomes
- **Victory** → Ending 1: THE HOLLOW — the voice is heard one last time; it was always her. *"I'm sorry."*
- **Defeat** → The Offer: *"You cannot win. But you do not have to become me."* Beneath it — fainter, worn, hers: **"Choose. Either way, I will not let go of you."**
  - **[A] Accept the dark.** → Ending 2: LOST IN THE DARK
  - **[B] Climb to the surface.** → Ending 3: THE RETURN

Both choices lock in immediately (autosave). There is no third option.

---

## CREDITS

Over black:

**EVE:** *"The Deep stares at you. The emotion in its gaze is the comfort of freedom itself."*

Pause.

**EVE** *(different tone — not from the journal, but from memory, or from the Loom itself)***:** But freedom isn't the same as escape.

Silence. Wind over stone. Fading. Gone.

**THE END**
