import Phaser from 'phaser';
import { useGameStore } from '@store/gameStore';
import type { BoardNode, FactionState } from '@data/types';
import { CHECKPOINTS, LANDMARK_INDICES, CAPTURE_INDICES } from '@systems/BoardGenerator';
import { FIRST_NODE_TOOLTIPS } from '@data/tutorialText';
import { rollDie, rollMovement } from '@systems/checks';
import { TOTAL_NODES, PAGES, NODES_PER_PAGE, GAME_WIDTH, GAME_HEIGHT } from '@/config';
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
import { addResonanceEffects } from '@systems/ResonanceFX';
import { FONT_SERIF, FONT_MONO, PALETTE_HEX } from '@ui/uiTheme';
import { fadeToScene, fadeIn } from '@systems/sceneTransition';
import { audio } from '@placeholder/PlaceholderAudio';
import { influenceStatus } from '@data/factions';

const CHAPTER_PAGES = [1, 5, 9, 13, 17];
const CHAPTER_NAMES: Record<number, string> = {
  1: 'The Archive Opens',
  5: 'The Sable March',
  9: 'The Singing Deep',
  13: 'The Reach of Dust',
  17: 'The Final Descent',
};

const COLS = 10;
const ORIGIN_X = 90;
const ORIGIN_Y = 210;
const COL_SPACING = 108;
const ROW_SPACING = 54;
const VISIBILITY_RANGE = 4;
const AMBUSH_CHANCE = 0.30;
const REST_DISRUPT_CHANCE = 0.20;
const AMBUSH_TABLE: Record<string, string[]> = {
  sable: ['sable_zealot', 'sable_zealot'],
  archive: ['venn_custodian', 'archive_cipher_wraith'],
  covenant: ['ash_seer', 'ash_seer'],
  caravan: ['dust_road_raider', 'dust_wight'],
};

function isAnyFactionHostile(faction: FactionState): boolean {
  return Object.values(faction).some((v) => influenceStatus(v) === 'Hostile');
}

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
  private logBg?: Phaser.GameObjects.Rectangle;
  private statPanel?: ReturnType<typeof createStatPanel>;
  private preview?: ReturnType<typeof createNodePreview>;
  private diceRoller?: ReturnType<typeof createDiceRoller>;
  private depthLadder?: Phaser.GameObjects.GameObject[];
  private pageLabel?: Phaser.GameObjects.Text;
  private boardNodeLayer?: Phaser.GameObjects.Container;
  private ghostToken?: Phaser.GameObjects.Image;
  private busy = false;
  private firstNodeTooltips: Record<string, boolean> = {};

  constructor() {
    super('Board');
  }

  create() {
    this.busy = false;
    this.cameras.main.setBackgroundColor(0x0b0d10);
    fadeIn(this);
    const { player, game } = useGameStore.getState();
    if (!player || !game) {
      fadeToScene(this, 'Menu');
      return;
    }

    this.boardNodeLayer = this.add.container(0, 0);
    this.drawBoard(game.nodes, game.currentNodeIndex + VISIBILITY_RANGE);
    this.playerToken = this.add.image(0, 0, 'tok_player').setDisplaySize(30, 30).setDepth(20);
    this.placeTokenAt(game.currentNodeIndex);

    addResonanceEffects(this, player.resonance, GAME_WIDTH, GAME_HEIGHT);

    this.statPanel = createStatPanel(this, 16, 16, 300);
    this.statPanel.update(player);

    this.preview = createNodePreview(this, GAME_WIDTH - 130, 40);
    if (game.currentNodeIndex > 0) this.preview.show(game.nodes[game.currentNodeIndex - 1]);
    createButton(this, GAME_WIDTH - 100, 160, 'Bag', () => fadeToScene(this, 'Inventory'), { width: 60, height: 30, fontSize: '11px' });

    this.add.text(GAME_WIDTH - 100, 200, `Skills (${player.skillPoints})`, {
      fontFamily: FONT_MONO, fontSize: '11px', color: player.skillPoints > 0 ? PALETTE_HEX.gold : '#555555',
    }).setOrigin(0.5).setDepth(5);
    createButton(this, GAME_WIDTH - 100, 220, 'Skills', () => fadeToScene(this, 'SkillTree'), { width: 60, height: 25, fontSize: '10px' });

    this.pageLabel = this.add.text(GAME_WIDTH / 2, 16, `Page ${game.currentPage} / 20`, {
      fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5, 0).setDepth(5);

    this.buildDepthLadder(game.currentPage);

    const logY = GAME_HEIGHT - 34;
    this.logBg = this.add.rectangle(GAME_WIDTH / 2, logY, GAME_WIDTH - 40, 32, 0x16191d, 0.7)
      .setStrokeStyle(1, 0xc9a24b, 0.3).setDepth(5);
    this.logText = this.add.text(GAME_WIDTH / 2, logY, this.pageFlavor(game.currentPage), {
      fontFamily: FONT_SERIF,
      fontSize: '12px',
      color: PALETTE_HEX.boneMuted,
      align: 'center',
      wordWrap: { width: GAME_WIDTH - 60 },
    }).setOrigin(0.5).setDepth(6);

    this.diceRoller = createDiceRoller(this, GAME_WIDTH / 2 - 80, GAME_HEIGHT - 170);
    this.rollBtn = createButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 100, 'Roll (1d6)', () => this.handleRoll(), { width: 200 });

    if (game.currentNodeIndex >= TOTAL_NODES) {
      this.rollBtn.setEnabled(false);
    }

    if (game.pendingNodeIndex != null && game.pendingNodeIndex > game.currentNodeIndex) {
      const target = game.pendingNodeIndex;
      useGameStore.setState({ game: { ...game, pendingNodeIndex: null } });
      this.log('The ambush dealt with, you continue forward.');
      this.moveTo(target);
    }
  }

  private pageFlavor(page: number): string {
    if (page <= 0) return 'The stair down is behind you now. Ahead: two hundred pages of a book that was never meant to be read twice.';
    const NAMES = [
      'The Vestibule', 'Ashfall', 'The Warrens', 'The Archive Threshold', 'The Bone Gallery',
      'The Resonant Hall', 'Deep Pages', 'The Deep Vault', 'The Court of Dust', 'The Loom Gate',
      'The Echoing Passages', 'The Still Library', 'The Crystal Veins', 'The Sable Bastion', 'The Whispering Step',
      'The Archive Depths', 'The Covenant Spire', 'The Ashen Tunnels', 'The Silver Gallery', 'The Final Chamber',
    ];
    return `Page ${page} / 20 — ${NAMES[Math.min(19, page - 1)]}`;
  }

  private buildDepthLadder(currentPage: number) {
    if (this.depthLadder) { this.depthLadder.forEach((o) => o.destroy()); }
    const ladder: Phaser.GameObjects.GameObject[] = [];
    const lx = GAME_WIDTH - 20;
    const topY = 210;
    const bottomY = GAME_HEIGHT - 90;
    const stepH = (bottomY - topY) / (PAGES - 1);
    for (let i = 0; i < PAGES; i++) {
      const y = Math.round(topY + i * stepH);
      const isCurrent = i + 1 === currentPage;
      const dot = this.add.circle(lx, y, isCurrent ? 6 : 4, isCurrent ? 0xc9a24b : 0x2a2e33)
        .setStrokeStyle(1, isCurrent ? 0xe9c876 : 0x9a9488, isCurrent ? 1 : 0.4);
      const label = this.add.text(lx - 14, y, `${i + 1}`, {
        fontFamily: `"Courier New", monospace`, fontSize: '9px', color: isCurrent ? '#c9a24b' : '#555555',
      }).setOrigin(1, 0.5);
      ladder.push(dot, label);
    }
    this.depthLadder = ladder;
  }

  private drawBoard(nodes: BoardNode[], visibleLimit: number) {
    if (!this.boardNodeLayer) return;
    this.boardNodeLayer.removeAll(true);
    for (const node of nodes) {
      const { x, y } = nodePosition(node.index);
      const isLandmark = LANDMARK_INDICES.includes(node.index);
      const isVisible = node.index <= visibleLimit;
      const icon = this.add.image(x, y, `node_${node.type}`).setDisplaySize(isLandmark ? 26 : 16, isLandmark ? 26 : 16);
      icon.setName(`node_${node.index}`).setData('resolved', node.resolved);
      const baseAlpha = isVisible ? (node.resolved && !isLandmark ? 0.35 : 0.9) : 0;
      icon.setAlpha(baseAlpha);
      if (!isVisible) icon.setTint(0x000000);
      this.boardNodeLayer.add(icon);
      if (CHECKPOINTS.includes(node.index)) {
        const ring = this.add.circle(x, y, 16, 0x000000, 0).setStrokeStyle(1, isVisible ? 0xc9a24b : 0x222222, isVisible ? 0.5 : 0.15);
        this.boardNodeLayer.add(ring);
      }
    }
    const store = useGameStore.getState();
    if (this.ghostToken) { this.ghostToken.destroy(); this.ghostToken = undefined; }
    if (store.game?.deathNodeIndex != null) {
      const pos = nodePosition(store.game.deathNodeIndex);
      this.ghostToken = this.add.image(pos.x, pos.y - 24, 'tok_player').setDisplaySize(30, 30).setAlpha(0.35)
        .setTint(0x666666);
    }
  }

  private placeTokenAt(index: number) {
    if (!this.playerToken) return;
    const pos = index <= 0 ? { x: ORIGIN_X - 60, y: ORIGIN_Y } : nodePosition(index);
    this.playerToken.setPosition(pos.x, pos.y - 24);
  }

  private log(msg: string) {
    this.logText?.setText(msg);
    this.logBg?.setAlpha(0.85);
  }

  private handleRoll() {
    if (this.busy) return;
    const { player, game } = useGameStore.getState();
    if (!player || !game) return;
    this.busy = true;
    this.rollBtn?.setEnabled(false);
    audio.diceRoll();

    const roll = rollMovement(Math.random);
    let target = Math.min(TOTAL_NODES, game.currentNodeIndex + roll);
    for (let i = game.currentNodeIndex + 1; i <= target; i++) {
      if (LANDMARK_INDICES.includes(i) && !game.nodes[i - 1].resolved) {
        target = i;
        break;
      }
      if (CAPTURE_INDICES.includes(i) && !game.nodes[i - 1].resolved) {
        target = i;
        break;
      }
    }

    this.diceRoller?.roll(roll, () => {
      try {
        if (this.tryAmbush(target)) return;
        this.moveTo(target);
      } catch (e) {
        console.error('Roll handler failed', e);
        this.busy = false;
        this.rollBtn?.setEnabled(true);
      }
    });
  }

  private tryAmbush(target: number): boolean {
    const { player, game } = useGameStore.getState();
    if (!player || !game) return false;
    if (!isAnyFactionHostile(player.faction)) return false;
    if (Math.random() >= AMBUSH_CHANCE) return false;

    const hostileKey = (Object.keys(player.faction) as (keyof FactionState)[]).find(
      (k) => influenceStatus(player.faction[k]) === 'Hostile',
    );
    const enemies = hostileKey && AMBUSH_TABLE[hostileKey] ? AMBUSH_TABLE[hostileKey] : ['sable_zealot', 'sable_zealot'];
    const page = Math.max(1, game.currentPage);
    useGameStore.setState({ game: { ...game, pendingNodeIndex: target } });

    const factionNames: Record<string, string> = { sable: 'Sable', archive: 'Archive', covenant: 'Covenant', caravan: 'Caravan' };
    const factionLabel = hostileKey ? (factionNames[hostileKey] ?? hostileKey) : 'unknown';
    this.log(`The ${factionLabel} ambushes you! +${enemies.length} enemies.`);
    this.time.delayedCall(600, () => {
      fadeToScene(this, 'Combat', { mode: 'wild', enemyIds: enemies, page });
    });
    return true;
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

  private showChapterCard(page: number, node: BoardNode) {
    const num = CHAPTER_PAGES.indexOf(page) + 1;
    const name = CHAPTER_NAMES[page];
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const depth = 200;

    const container = this.add.container(0, 0).setDepth(depth);
    const bg = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(depth).setAlpha(0);
    container.add(bg);

    const chapterText = this.add.text(cx, cy - 30, `CHAPTER ${num}`, {
      fontFamily: FONT_SERIF, fontSize: '28px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    container.add(chapterText);

    const nameText = this.add.text(cx, cy + 20, name, {
      fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.bone, fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0);
    container.add(nameText);

    const elements = [bg, chapterText, nameText];
    this.tweens.add({
      targets: elements,
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: elements,
            alpha: 0,
            duration: 400,
            ease: 'Sine.easeIn',
            onComplete: () => {
              container.destroy();
              this.log(this.pageFlavor(page));
              this.resolveNode(node);
            },
          });
        });
      },
    });
  }

  private finishMove(target: number) {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;

    const page = Math.min(PAGES, Math.ceil(target / NODES_PER_PAGE));
    const prevPage = game.currentPage;
    player.echoShards += applyShardBonus(player, shardsForNodeVisit());
    const updatedNodes = game.nodes.map((n) => ({ ...n }));
    const node = updatedNodes[target - 1];

    useGameStore.setState({
      game: { ...game, currentNodeIndex: target, currentPage: page, path: [...game.path, target], landings: game.landings + 1, nodes: updatedNodes, deathNodeIndex: null },
    });
    this.drawBoard(updatedNodes, target + VISIBILITY_RANGE);
    this.statPanel?.update(player);
    this.preview?.show(node);
    this.pageLabel?.setText(`Page ${page} / ${PAGES}`);
    this.buildDepthLadder(page);

    if (page !== prevPage && CHAPTER_PAGES.includes(page)) {
      this.showChapterCard(page, node);
    } else {
      this.log(this.pageFlavor(page));
      this.resolveNode(node);
    }
    this.applyFactionGearBonus(player);
  }

  private resolveNode(node: BoardNode) {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;

    if (player.totalRuns === 0 && game.currentPage <= 1 && !this.firstNodeTooltips[node.type]) {
      this.firstNodeTooltips[node.type] = true;
      const tip = FIRST_NODE_TOOLTIPS[node.type];
      if (tip) this.showNodeTooltip(tip);
    }

    if (node.type === 'landmark') {
      fadeToScene(this, 'Landmark', { bossId: node.subtype });
      return;
    }
    if (node.type === 'combat') {
      fadeToScene(this, 'Combat', { mode: 'wild', enemyIds: [node.subtype], page: node.page });
      return;
    }
    if (node.type === 'event') {
      const seen = new Set(player.history.filter((h) => h.startsWith('event_seen:')).map((h) => h.slice('event_seen:'.length)));
      const event = pickEvent(player, node.page, player.resonance, seen, Math.random, player.flags);
      fadeToScene(this, 'Event', { eventDef: event });
      return;
    }
    if (node.type === 'trap') {
      const trapDef = TRAPS[node.subtype];
      if (!trapDef) {
        this.log('The trap mechanism is rusted and non-functional.');
        this.markResolved(node);
        this.afterInlineResolution();
        return;
      }
      const result = resolveTrap(trapDef, player, Math.random);
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
        fadeToScene(this, 'Event', { eventDef: MINOR_LANDMARKS[node.index] });
        return;
      }
      this.resolveDiscovery(player, node);
      this.markResolved(node);
      this.afterInlineResolution();
      return;
    }
    this.afterInlineResolution();
  }

  private showNodeTooltip(text: string) {
    const tx = this.add.text(GAME_WIDTH / 2, 200, text, {
      fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.gold,
      align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5).setDepth(100).setAlpha(0);
    this.tweens.add({
      targets: tx, alpha: 1, duration: 300, ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(2500, () => {
          this.tweens.add({
            targets: tx, alpha: 0, duration: 300, ease: 'Sine.easeIn',
            onComplete: () => tx.destroy(),
          });
        });
      },
    });
  }

  private resolveRest(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    if (player.flags.skip_next_rest) {
      delete player.flags.skip_next_rest;
      this.log('You look for somewhere to rest. The floor here remembers your last fall, and offers nothing.');
      return;
    }
    let disrupted = false;
    if (isAnyFactionHostile(player.faction) && Math.random() < REST_DISRUPT_CHANCE) {
      disrupted = true;
    }
    let healPct = player.flags.next_rest_double ? 50 : 25;
    if (player.flags.next_rest_double) delete player.flags.next_rest_double;
    if (player.skillsKnown.includes('deep_breath')) healPct += 10;
    if (disrupted) healPct = Math.round(healPct * 0.5);
    const heal = Math.round(player.derived.maxHP * (healPct / 100));
    player.currentHP = Math.min(player.derived.maxHP, player.currentHP + heal);
    const mpRestore = disrupted ? Math.round(player.derived.maxMP * 0.15) : Math.round(player.derived.maxMP * 0.3);
    player.currentMP = Math.min(player.derived.maxMP, player.currentMP + mpRestore);
    player.resonance = Math.max(0, player.resonance - 1);
    audio.heal();
    if (disrupted) {
      this.log(`You wake to the sound of blades being drawn. Not enough rest. +${heal} HP, +${mpRestore} MP (-1 Resonance).`);
    } else {
      this.log(`You rest a while. +${heal} HP, +${mpRestore} MP (-1 Resonance).`);
    }
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

    const xpStore = useGameStore.getState();
    switch (chosen) {
      case 'lost_supplies': {
        const gold = 3 + rollDie(6, Math.random);
        const itemId = SUPPLY_POOL[Math.floor(Math.random() * SUPPLY_POOL.length)];
        player.gold += gold;
        player.inventory.push({ id: itemId, qty: 1 });
        xpStore.addXp(8);
        this.log(`Supplies, left behind in a hurry. +${gold} gold, an item, +8 XP.`);
        break;
      }
      case 'forgotten_relic': {
        const pool = player.resonance >= 50 ? [...RELIC_POOL, 'unread_echo'] : RELIC_POOL;
        const gold = 3 + rollDie(6, Math.random);
        const itemId = pool[Math.floor(Math.random() * pool.length)];
        player.gold += gold;
        player.inventory.push({ id: itemId, qty: 1 });
        xpStore.addXp(10);
        this.log(`Something worth carrying, worked in by someone who isn't here anymore. +${gold} gold, an item, +10 XP.`);
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
        xpStore.addXp(8);
        this.log(`Something written, worth reading twice. +${gold} gold, a lore fragment, +8 XP.`);
        break;
      }
      case 'training_notes': {
        const skillId = unknownSkills[Math.floor(Math.random() * unknownSkills.length)];
        player.skillsKnown.push(skillId);
        xpStore.addXp(12);
        this.log(`Training notes, thorough and half-legible. You learn something from them. +12 XP.`);
        break;
      }
      case 'hidden_stash': {
        const gold = 10 + rollDie(15, Math.random);
        player.gold += gold;
        xpStore.addXp(10);
        this.log(`A stash, properly hidden this time. +${gold} gold, +10 XP.`);
        break;
      }
      case 'quiet_moment': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        player.resonance = Math.max(0, player.resonance - 1);
        xpStore.addXp(3);
        this.log(`A moment of quiet that costs nothing to take. +${gold} gold, -1 Resonance, +3 XP.`);
        break;
      }
      case 'echo_residue': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        player.echoShards += applyShardBonus(player, 1);
        xpStore.addXp(6);
        this.log(`A trace of something spent. +${gold} gold, +1 Echo Shard, +6 XP.`);
        break;
      }
      case 'old_marker': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        const w = maybePickWhisper(player.resonance, 'movement', Math.random, 1);
        if (w) showWhisper(this, GAME_WIDTH / 2, 178, w.text, 460);
        xpStore.addXp(4);
        this.log(`An old marker, half-erased. +${gold} gold, +4 XP.`);
        break;
      }
      case 'small_cache_faction': {
        const gold = 3 + rollDie(6, Math.random);
        player.gold += gold;
        const leading = (Object.keys(player.faction) as (keyof typeof player.faction)[]).reduce((a, b) =>
          player.faction[a] >= player.faction[b] ? a : b
        );
        player.faction[leading] += 1;
        xpStore.addXp(5);
        this.log(`Something that confirms a path you're already on. +${gold} gold, +1 ${leading}, +5 XP.`);
        break;
      }
      case 'nothing_here': {
        const gold = 1 + rollDie(4, Math.random);
        player.gold += gold;
        xpStore.addXp(2);
        this.log(`Nothing here worth the detour, in the end. +${gold} gold, +2 XP.`);
        break;
      }
      default: {
        const gold = 5 + rollDie(10, Math.random);
        player.gold += gold;
        xpStore.addXp(5);
        this.log(`You find something left behind by whoever came through last. +${gold} gold, +5 XP.`);
      }
    }
    audio.shardGain();
  }

  private applyFactionGearBonus(player: NonNullable<ReturnType<typeof useGameStore.getState>['player']>) {
    const FACTION_GEAR: Record<string, keyof typeof player.faction> = {
      sable_ash_blade: 'sable',
      archive_field_coat: 'archive',
      travelers_ledger: 'caravan',
      muted_stone: 'covenant',
    };
    const equipped = [player.equipment.weapon, player.equipment.armour, player.equipment.accessory, player.equipment.focus].filter((id): id is string => !!id);
    for (const gearId of equipped) {
      const faction = FACTION_GEAR[gearId];
      if (faction) player.faction[faction] += 1;
    }
  }

  private markResolved(node: BoardNode) {
    node.resolved = true;
  }

  private afterInlineResolution() {
    const store = useGameStore.getState();
    const { player, game } = store;
    if (!player || !game) return;
    store.persist();
    if (CHECKPOINTS.includes(game.currentNodeIndex)) {
      audio.checkpoint();
      const tx = this.add.text(GAME_WIDTH / 2, 300, '✦ Checkpoint Reached — Progress Saved ✦', {
        fontFamily: FONT_MONO, fontSize: '14px', color: '#c9a24b',
      }).setOrigin(0.5).setDepth(100).setAlpha(1);
      this.tweens.add({
        targets: tx, alpha: 0, y: 280, duration: 3000, ease: 'Power2', onComplete: () => tx.destroy(),
      });
    }
    this.statPanel?.update(player);

    if (player.currentHP <= 0) {
      this.handleDeathFlow();
      return;
    }

    const whisper = maybePickWhisper(player.resonance, 'movement', Math.random);
    if (whisper) showWhisper(this, GAME_WIDTH / 2, 178, whisper.text, 460);

    this.busy = false;
    if (game.currentNodeIndex < TOTAL_NODES) this.rollBtn?.setEnabled(true);
  }

  private handleDeathFlow() {
    const store = useGameStore.getState();
    const { game } = store;
    const hadCheckpoint = !!game?.checkpointSnapshot && (game?.checkpointPage ?? 0) > 0;
    if (!hadCheckpoint) {
      store.handleDeath();
      fadeToScene(this, 'GameOver');
      return;
    }

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const d = 200;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85).setDepth(d).setInteractive();
    this.add.text(cx, cy - 90, 'You fell. But the Loom remembers.', {
      fontFamily: FONT_SERIF, fontSize: '26px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(d);

    this.add.text(cx, cy - 40, `Fallen at Page ${game.currentPage}.`, {
      fontFamily: FONT_SERIF, fontSize: '18px', color: PALETTE_HEX.bone,
    }).setOrigin(0.5).setDepth(d);

    this.add.text(cx, cy - 10, `Return to checkpoint at Page ${game.checkpointPage}.`, {
      fontFamily: FONT_SERIF, fontSize: '15px', color: PALETTE_HEX.boneMuted,
    }).setOrigin(0.5).setDepth(d);

    this.add.text(cx, cy + 20, 'HP and MP restored to 50%.', {
      fontFamily: FONT_SERIF, fontSize: '14px', color: PALETTE_HEX.gold,
    }).setOrigin(0.5).setDepth(d);

    createButton(this, cx - 110, cy + 80, 'Continue', () => {
      store.handleDeath();
      fadeToScene(this, 'Board');
    }, { width: 180, height: 44, fontSize: '15px' }).container.setDepth(d);

    createButton(this, cx + 110, cy + 80, 'Return to Menu', () => {
      const { meta } = useGameStore.getState();
      const newMeta = { ...meta, deathCount: meta.deathCount + 1 };
      useGameStore.setState({ meta: newMeta, player: null, game: null });
      audio.click();
      fadeToScene(this, 'Menu');
    }, { width: 180, height: 44, fontSize: '15px' }).container.setDepth(d);
  }
}
