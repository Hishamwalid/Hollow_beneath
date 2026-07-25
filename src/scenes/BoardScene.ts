import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import type { BoardNode } from '@data/types';
import { CHECKPOINTS, LANDMARK_INDICES } from '@systems/BoardGenerator';
import { rollDie, rollMovement } from '@systems/checks';
import { pickEvent } from '@systems/EventEngine';
import { resolveTrap } from '@systems/EventEngine';
import { TRAPS } from '@data/events';
import { MINOR_LANDMARKS } from '@data/minorLandmarks';
import { DISCOVERABLE_SKILLS } from '@data/skills';
import { shardsForNodeVisit, applyShardBonus } from '@systems/EchoShardSystem';
import { maybePickWhisper } from '@systems/WhisperSystem';
import { createStatPanel } from '@ui/StatPanel';
import { createDiceRoller } from '@ui/DiceRoller';
import { createNodePreview } from '@ui/NodePreview';
import { createButton } from '@ui/Button';
import { showWhisper, applyResonanceTint } from '@ui/WhisperOverlay';
import { FONT_SERIF, PALETTE_HEX } from '@ui/uiTheme';
import { audio } from '@placeholder/PlaceholderAudio';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config';

const COLS = 10;
const ORIGIN_X = 90;
const ORIGIN_Y = 210;
const COL_SPACING = 108;
const ROW_SPACING = 54;

function nodePosition(index: number): { x: number; y: number } {
  const row = Math.floor((index - 1) / COLS);
  const colInRow = (index - 1) % COLS;
  const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
  return { x: ORIGIN_X + col * COL_SPACING, y: ORIGIN_Y + row * ROW_SPACING };
}

export class BoardScene extends Phaser.Scene {
  private playerToken?: Phaser.GameObjects.Image;
  private rollBtn?: ReturnType<typeof createButton>;
  private logText?: Phaser.GameObjects.Text;
  private statPanel?: ReturnType<typeof createStatPanel>;
  private preview?: ReturnType<typeof createNodePreview>;
  private diceRoller?: ReturnType<typeof createDiceRoller>;
  private busy = false;

  constructor() {
    super('Board');
  }

  create() {
    this.busy = false;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    const { player, game } = useGameStore.getState();
    if (!player || !game) {
      this.scene.start('Menu');
      return;
    }

    this.drawBoard(game.nodes);
    this.playerToken = this.add.image(0, 0, 'tok_player').setDisplaySize(30, 30).setDepth(10);
    this.placeTokenAt(game.currentNodeIndex);

    applyResonanceTint(this, player.resonance, GAME_WIDTH, GAME_HEIGHT);

    this.statPanel = createStatPanel(this, 16, 16, 300);
    this.statPanel.update(player);

    this.preview = createNodePreview(this, GAME_WIDTH - 130, 40);
    if (game.currentNodeIndex > 0) this.preview.show(game.nodes[game.currentNodeIndex - 1]);

    this.logText = this.add.text(16, GAME_HEIGHT - 100, this.pageFlavor(game.currentPage), {
      fontFamily: FONT_SERIF,
      fontSize: '13px',
      color: PALETTE_HEX.boneMuted,
      wordWrap: { width: GAME_WIDTH - 32 },
    });

    this.diceRoller = createDiceRoller(this, GAME_WIDTH - 130, GAME_HEIGHT - 150);
    this.rollBtn = createButton(this, GAME_WIDTH - 130, GAME_HEIGHT - 80, 'Roll (1d4+1)', () => this.handleRoll(), { width: 180 });

    if (game.currentNodeIndex >= 100) {
      this.rollBtn.setEnabled(false);
    }
  }

  private pageFlavor(page: number): string {
    if (page <= 0) return 'The stair down is behind you now. Ahead: a hundred pages of a book that was never meant to be read twice.';
    return `Page ${page} of 10. The Hollow does not get shallower from here.`;
  }

  private drawBoard(nodes: BoardNode[]) {
    for (const node of nodes) {
      const { x, y } = nodePosition(node.index);
      const isLandmark = LANDMARK_INDICES.includes(node.index);
      const icon = this.add.image(x, y, `node_${node.type}`).setDisplaySize(isLandmark ? 26 : 16, isLandmark ? 26 : 16);
      icon.setAlpha(node.resolved && !isLandmark ? 0.35 : 0.9);
      if (CHECKPOINTS.includes(node.index)) {
        this.add.circle(x, y, 16, 0x000000, 0).setStrokeStyle(1, 0xc9a24b, 0.5);
      }
    }
  }

  private placeTokenAt(index: number) {
    if (!this.playerToken) return;
    const pos = index <= 0 ? { x: ORIGIN_X - 60, y: ORIGIN_Y } : nodePosition(index);
    this.playerToken.setPosition(pos.x, pos.y - 24);
  }

  private log(msg: string) {
    this.logText?.setText(msg);
  }

  private handleRoll() {
    if (this.busy) return;
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;
    this.busy = true;
    this.rollBtn?.setEnabled(false);
    audio.diceRoll();

    const roll = rollMovement(Math.random);
    let target = Math.min(100, game.currentNodeIndex + roll);
    // Capture rule: never skip past an unresolved Landmark — stop there instead.
    for (let i = game.currentNodeIndex + 1; i <= target; i++) {
      if (LANDMARK_INDICES.includes(i) && !game.nodes[i - 1].resolved) {
        target = i;
        break;
      }
    }

    this.diceRoller?.roll(roll, () => {
      this.moveTo(target);
    });
  }

  private moveTo(target: number) {
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;

    const steps = target - game.currentNodeIndex;
    let step = 0;
    const advance = () => {
      step += 1;
      const idx = game.currentNodeIndex + step;
      this.placeTokenAt(idx);
      audio.moveStep();
      if (step < steps) {
        this.time.delayedCall(140, advance);
      } else {
        this.finishMove(target);
      }
    };
    advance();
  }

  private finishMove(target: number) {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;

    const page = Math.min(10, Math.ceil(target / 10));
    player.echoShards += applyShardBonus(player, shardsForNodeVisit());
    const updatedNodes = game.nodes.map((n) => n);
    const node = updatedNodes[target - 1];

    useGameStore.setState({
      game: { ...game, currentNodeIndex: target, currentPage: page, path: [...game.path, target], landings: game.landings + 1, nodes: updatedNodes },
    });
    this.statPanel?.update(player);
    this.preview?.show(node);
    store.persist();

    this.resolveNode(node);
  }

  private resolveNode(node: BoardNode) {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;

    if (node.type === 'landmark') {
      this.scene.start('Landmark', { bossId: node.subtype });
      return;
    }
    if (node.type === 'combat') {
      this.scene.start('Combat', { mode: 'wild', enemyIds: [node.subtype], page: node.page });
      return;
    }
    if (node.type === 'event') {
      const seen = new Set(player.history.filter((h) => h.startsWith('event_seen:')).map((h) => h.slice('event_seen:'.length)));
      const event = pickEvent(node.page, player.resonance, seen, Math.random, player.flags);
      this.scene.start('Event', { eventId: event.id });
      return;
    }
    if (node.type === 'trap') {
      const result = resolveTrap(TRAPS[node.subtype], player, Math.random);
      audio.hit();
      this.log(result.text);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    if (node.type === 'rest') {
      this.resolveRest(player);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    if (node.type === 'discovery') {
      if (node.subtype === 'capture_point' && MINOR_LANDMARKS[node.index]) {
        this.markResolved(node);
        this.scene.start('Event', { eventId: MINOR_LANDMARKS[node.index].id });
        return;
      }
      this.resolveDiscovery(player, node);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    this.afterInlineResolution();
  }

  private resolveRest(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    if (player.flags.skip_next_rest) {
      delete player.flags.skip_next_rest;
      this.log('You look for somewhere to rest. The floor here remembers your last fall, and offers nothing.');
      return;
    }
    let healPct = player.flags.next_rest_double ? 50 : 25;
    if (player.flags.next_rest_double) delete player.flags.next_rest_double;
    if (player.skillsKnown.includes('deep_breath')) healPct += 10;
    const heal = Math.round(player.derived.maxHP * (healPct / 100));
    player.currentHP = Math.min(player.derived.maxHP, player.currentHP + heal);
    player.resonance = Math.max(0, player.resonance - 1);
    audio.heal();
    this.log(`You rest a while. +${heal} HP (-1 Resonance).`);
  }

  private resolveDiscovery(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>, node: BoardNode) {
    // Capture points are handled separately in resolveNode (routed to a minor-landmark vignette).
    const LORE_POOL = [
      'the_hundredth_page', 'a_pressed_flower_that_isnt', 'the_counting_room', 'names_carved_then_scratched_out',
      'the_weight_of_unread_mail', 'a_childs_height_marks', 'the_last_entry', 'the_recipe_that_isnt_food',
      'the_map_that_updates_itself', 'the_second_moon_that_isnt_there', 'the_apology_never_sent',
      'the_borrowed_hour', 'sera_voss_ledger_entry',
    ].filter((id) => !player.loreFragments.includes(id));
    const RELIC_POOL = ['sable_ash_blade', 'archive_field_coat', 'raiders_charm', 'dominion_boundary_seal', 'auctioneers_token', 'pressed_page'];
    const SUPPLY_POOL = ['ration', 'bandage', 'waterskin', 'traveler_salve'];
    const unknownSkills = DISCOVERABLE_SKILLS.filter((id) => !player.skillsKnown.includes(id));

    type Template = { id: string; weight: number };
    const templates: Template[] = [
      { id: 'gold_cache', weight: 4 },
      { id: 'lost_supplies', weight: 2 },
      { id: 'forgotten_relic', weight: 2 },
      { id: 'lore_cache', weight: LORE_POOL.length > 0 ? 2 : 0 },
      { id: 'training_notes', weight: unknownSkills.length > 0 ? 2 : 0 },
      { id: 'hidden_stash', weight: 1 },
      { id: 'quiet_moment', weight: 1 },
      { id: 'echo_residue', weight: 1 },
      { id: 'old_marker', weight: 1 },
      { id: 'small_cache_faction', weight: 1 },
      { id: 'nothing_here', weight: 1 },
    ].filter((t) => t.weight > 0);

    const totalWeight = templates.reduce((s, t) => s + t.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosen = templates[0].id;
    for (const t of templates) {
      if (roll < t.weight) { chosen = t.id; break; }
      roll -= t.weight;
    }

    switch (chosen) {
      case 'lost_supplies': {
        const gold = 3 + rollDie(6, Math.random);
        const itemId = SUPPLY_POOL[Math.floor(Math.random() * SUPPLY_POOL.length)];
        player.gold += gold;
        player.inventory.push({ id: itemId, qty: 1 });
        this.log(`Supplies, left behind in a hurry. +${gold} gold, an item.`);
        break;
      }
      case 'forgotten_relic': {
        const pool = player.resonance >= 50 ? [...RELIC_POOL, 'unread_echo'] : RELIC_POOL;
        const gold = 3 + rollDie(6, Math.random);
        const itemId = pool[Math.floor(Math.random() * pool.length)];
        player.gold += gold;
        player.inventory.push({ id: itemId, qty: 1 });
        this.log(`Something worth carrying, worked in by someone who isn't here anymore. +${gold} gold, an item.`);
        break;
      }
      case 'lore_cache': {
        const gold = 3 + rollDie(6, Math.random);
        const id = LORE_POOL[Math.floor(Math.random() * LORE_POOL.length)];
        player.gold += gold;
        if (!player.loreFragments.includes(id)) {
          player.loreFragments.push(id);
          player.echoShards += applyShardBonus(player, 1);
        }
        this.log(`Something written, worth reading twice. +${gold} gold, a lore fragment.`);
        break;
      }
      case 'training_notes': {
        const skillId = unknownSkills[Math.floor(Math.random() * unknownSkills.length)];
        player.skillsKnown.push(skillId);
        this.log(`Training notes, thorough and half-legible. You learn something from them.`);
        break;
      }
      case 'hidden_stash': {
        const gold = 10 + rollDie(15, Math.random);
        player.gold += gold;
        this.log(`A stash, properly hidden this time. +${gold} gold.`);
        break;
      }
      case 'quiet_moment': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        player.resonance = Math.max(0, player.resonance - 1);
        this.log(`A moment of quiet that costs nothing to take. +${gold} gold, -1 Resonance.`);
        break;
      }
      case 'echo_residue': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        player.echoShards += applyShardBonus(player, 1);
        this.log(`A trace of something spent. +${gold} gold, +1 Echo Shard.`);
        break;
      }
      case 'old_marker': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        const w = maybePickWhisper(player.resonance, 'movement', Math.random, 1);
        if (w) showWhisper(this, GAME_WIDTH / 2, 178, w.text, 460);
        this.log(`An old marker, half-erased. +${gold} gold.`);
        break;
      }
      case 'small_cache_faction': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        const leading = (Object.keys(player.faction) as (keyof typeof player.faction)[]).reduce((a, b) =>
          player.faction[a] >= player.faction[b] ? a : b
        );
        player.faction[leading] += 1;
        this.log(`Something that confirms a path you're already on. +${gold} gold, +1 ${leading}.`);
        break;
      }
      case 'nothing_here': {
        const gold = 1 + rollDie(4, Math.random);
        player.gold += gold;
        this.log(`Nothing here worth the detour, in the end. +${gold} gold.`);
        break;
      }
      default: {
        const gold = 5 + rollDie(10, Math.random);
        player.gold += gold;
        this.log(`You find something left behind by whoever came through last. +${gold} gold.`);
      }
    }
    audio.shardGain();
  }

  private markResolved(node: BoardNode) {
    node.resolved = true;
  }

  private afterInlineResolution() {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;
    store.persist();
    this.statPanel?.update(player);

    if (player.currentHP <= 0) {
      this.handleDeathFlow();
      return;
    }

    const whisper = maybePickWhisper(player.resonance, 'movement', Math.random);
    if (whisper) showWhisper(this, GAME_WIDTH / 2, 178, whisper.text, 460);

    this.busy = false;
    if (game.currentNodeIndex < 100) this.rollBtn?.setEnabled(true);
  }

  private handleDeathFlow() {
    const store = useGameStore.getState();
    const { game } = store;
    const hadCheckpoint = !!game?.checkpointSnapshot && (game?.checkpointPage ?? 0) > 0;
    store.handleDeath();
    if (hadCheckpoint) {
      this.scene.start('Board');
    } else {
      this.scene.start('GameOver');
    }
  }
}
