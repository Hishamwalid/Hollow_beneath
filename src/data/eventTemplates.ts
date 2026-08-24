import type { PlayerState, EventDef, EventChoice, EventApplyCtx } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateEntry {
  id: string;
  text: string;
}

interface TemplateDef {
  category: string;
  title: string;
  entries: TemplateEntry[];
  weight: number;
}

// ---------------------------------------------------------------------------
// Faction label helpers
// ---------------------------------------------------------------------------

const FACTION_LABELS: Record<string, string> = {
  sable: 'the Sable Order',
  archive: 'the Archive',
  covenant: 'the Covenant',
  caravan: 'the Caravan',
};

function dominantFaction(player: PlayerState): { key: keyof typeof player.faction; label: string } {
  const entries = Object.entries(player.faction) as [keyof typeof player.faction, number][];
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return { key: entries[0][0], label: FACTION_LABELS[entries[0][0]] ?? entries[0][0] };
}

// ---------------------------------------------------------------------------
// Template data
// ---------------------------------------------------------------------------

const TEMPLATES: TemplateDef[] = [
  {
    category: 'venn_ruins',
    title: 'Venn Ruins',
    weight: 4,
    entries: [
      { id: 'venn_ruins_0', text: 'Venn archways curve overhead. The syntax of their architecture implies a sentence you cannot read.' },
      { id: 'venn_ruins_1', text: 'A room of mirrors. Each reflection is you, but different. One is bleeding. One is smiling.' },
      { id: 'venn_ruins_2', text: 'The floor here is glass. Below it, a city — upside down, perfectly preserved, impossible.' },
      { id: 'venn_ruins_3', text: 'A hallway of doors. Each door has a word carved into it. None of the words are in languages that exist yet.' },
      { id: 'venn_ruins_4', text: 'Water drips from a ceiling that depicts a sky no one has seen in five thousand years.' },
    ],
  },
  {
    category: 'faction_encounter',
    title: 'Faction Encounter',
    weight: 2,
    entries: [
      { id: 'faction_encounter_0', text: 'A {faction} scout blocks the path. They recognize your tablet. They do not recognize your right to carry it.' },
      { id: 'faction_encounter_1', text: '{faction} symbols mark this door. It opens easily. Too easily.' },
      { id: 'faction_encounter_2', text: 'The air smells of {faction} incense. Someone was here recently. Someone is watching.' },
    ],
  },
  {
    category: 'natural_wonder',
    title: 'Natural Wonder',
    weight: 2,
    entries: [
      { id: 'natural_wonder_0', text: 'A shaft of light pierces the darkness. Dust motes dance. For a moment, you forget where you are.' },
      { id: 'natural_wonder_1', text: 'Fungus that glows with soft blue light carpets the walls. It pulses in rhythm with your heartbeat.' },
      { id: 'natural_wonder_2', text: 'Underground river. The water is perfectly clear. At the bottom, shapes that might be ruins or might be bones.' },
    ],
  },
  {
    category: 'personal',
    title: 'Personal Echo',
    weight: 1,
    entries: [
      { id: 'personal_0', text: 'You find a footprint that matches your boot. You haven\'t been this way before.' },
      { id: 'personal_1', text: 'Your tablet displays a sentence in Venn. You have not seen this word before, but you understand it: \'Lonely.\'' },
      { id: 'personal_2', text: 'A whisper, so quiet you almost miss it: \'Lyra.\' Your name. Spoken by someone who should not know it.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Repeat avoidance (module-level, lasts for the session)
// ---------------------------------------------------------------------------

const recentIds: string[] = [];
const MAX_RECENT = 3;

function pickEntry(rng: () => number): { template: TemplateDef; entry: TemplateEntry } {
  const byEntry = TEMPLATES.flatMap(t =>
    t.entries.map(e => ({ template: t, entry: e })),
  );
  const available = byEntry.filter(p => !recentIds.includes(p.entry.id));
  const pool = available.length > 0 ? available : byEntry;
  const totalWeight = pool.reduce((s, p) => s + p.template.weight, 0);
  let roll = rng() * totalWeight;
  let picked = pool[0];
  for (const p of pool) {
    if (roll < p.template.weight) { picked = p; break; }
    roll -= p.template.weight;
  }
  recentIds.push(picked.entry.id);
  if (recentIds.length > MAX_RECENT) recentIds.shift();
  return picked;
}

// ---------------------------------------------------------------------------
// Unique ID counter
// ---------------------------------------------------------------------------

let idCounter = 0;

// ---------------------------------------------------------------------------
// Category-specific helpers
// ---------------------------------------------------------------------------

const CHECKS: Record<string, 'str' | 'dex' | 'con' | 'int' | 'will'> = {
  venn_ruins: 'int',
  faction_encounter: 'will',
  natural_wonder: 'con',
  personal: 'will',
};

const DCs: Record<string, number> = {
  venn_ruins: 12,
  faction_encounter: 10,
  natural_wonder: 10,
  personal: 12,
};

const LABELS: Record<string, string> = {
  venn_ruins: 'Study the architecture (INT check, DC 12)',
  faction_encounter: 'Stand your ground (WILL check, DC 10)',
  natural_wonder: 'Drink it in (CON check, DC 10)',
  personal: 'Listen closely (WILL check, DC 12)',
};

function addResonance(p: PlayerState, n: number): void {
  p.resonance = Math.min(100, p.resonance + n);
}

function applySuccess(p: PlayerState, ctx: EventApplyCtx, category: string, factionKey?: string): string {
  ctx.addXp(8);
  switch (category) {
    case 'venn_ruins': {
      addResonance(p, 3);
      if (ctx.rng() < 0.25) {
        ctx.addEchoShards(1);
        return 'You trace the patterns. They almost resolve. (+3 Resonance, +8 XP, +1 Echo Shard)';
      }
      return 'You trace the patterns. They almost resolve. (+3 Resonance, +8 XP)';
    }
    case 'faction_encounter': {
      if (factionKey) {
        p.faction[factionKey as keyof typeof p.faction] += 5;
        const label = FACTION_LABELS[factionKey] ?? factionKey;
        return `You hold your ground before ${label}. They acknowledge your presence. (+5 ${label}, +8 XP)`;
      }
      return 'You hold your ground. They acknowledge your presence. (+8 XP)';
    }
    case 'natural_wonder': {
      const heal = Math.round(p.derived.maxHP * 0.15);
      p.currentHP = Math.min(p.derived.maxHP, p.currentHP + heal);
      return `The beauty of the place restores you. (+${heal} HP, +8 XP)`;
    }
    case 'personal': {
      addResonance(p, 4);
      if (ctx.rng() < 0.25) {
        ctx.addEchoShards(1);
        return 'The moment lingers. You are not alone here. (+4 Resonance, +8 XP, +1 Echo Shard)';
      }
      return 'The moment lingers. You are not alone here. (+4 Resonance, +8 XP)';
    }
    default: {
      return 'You press on, a little richer for the pause. (+8 XP)';
    }
  }
}

function applyFailure(p: PlayerState, _ctx: EventApplyCtx, category: string, factionKey?: string): string {
  switch (category) {
    case 'venn_ruins': {
      addResonance(p, 2);
      p.currentHP = Math.max(1, p.currentHP - 5);
      return 'The syntax resists you. A headache blooms behind your eyes. (+2 Resonance, -5 HP)';
    }
    case 'faction_encounter': {
      addResonance(p, 3);
      if (factionKey) {
        const fk = factionKey as keyof typeof p.faction;
        p.faction[fk] = Math.max(-100, p.faction[fk] - 2);
        const label = FACTION_LABELS[factionKey] ?? factionKey;
        return `You falter. They remember your face. (+3 Resonance, -2 ${label})`;
      }
      return 'You falter. (+3 Resonance)';
    }
    case 'natural_wonder': {
      addResonance(p, 2);
      return 'The moment glides past you, untouched. (+2 Resonance)';
    }
    case 'personal': {
      addResonance(p, 3);
      p.currentHP = Math.max(1, p.currentHP - 4);
      return 'The whisper is not for you. It was never for you. (+3 Resonance, -4 HP)';
    }
    default: {
      addResonance(p, 2);
      return 'Nothing notable happens. (+2 Resonance)';
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateFallbackEvent(player: PlayerState, rng: () => number): EventDef {
  const { template, entry } = pickEntry(rng);
  const fi = template.category === 'faction_encounter' ? dominantFaction(player) : null;
  const flavorText = fi ? entry.text.replace('{faction}', fi.label) : entry.text;
  const baseId = `template_${template.category}_${idCounter++}`;

  const choices: EventChoice[] = [
    {
      id: `${baseId}_investigate`,
      label: LABELS[template.category] ?? 'Investigate',
      check: { stat: CHECKS[template.category] ?? 'int', dc: DCs[template.category] ?? 12 },
      onSuccess: (p, ctx) => applySuccess(p, ctx, template.category, fi?.key),
      onFailure: (p, ctx) => applyFailure(p, ctx, template.category, fi?.key),
    },
    {
      id: `${baseId}_pass`,
      label: 'Pass through.',
      onSuccess: (p) => {
        p.faction.caravan += 2;
        return 'You keep moving. Nothing follows. (+2 Caravan)';
      },
    },
  ];

  return {
    id: baseId,
    title: template.title,
    chapterRange: [1, 5],
    repeatable: true,
    flavorText,
    choices,
  };
}
