import Phaser from 'phaser';
import type { EnemyView } from '@systems/CombatEngine';
import { FONT_BODY, FONT_MONO, FONT_SERIF, PALETTE_HEX } from './uiTheme';
import { spawnHitParticles } from '@/systems/particles';
import { reducedMotion } from '@systems/motion';

export interface EnemyDisplay {
  container: Phaser.GameObjects.Container;
  update: (view: EnemyView) => void;
  /** Show/hide the small overhead HP bar (bosses use the big top bar instead). */
  setHpBarVisible: (v: boolean) => void;
  setSelected: (v: boolean) => void;
  setState: (state: 'idle' | 'attack' | 'hit' | 'guard') => void;
  /** The enemy definition id (e.g. 'sentinel'), stable across the fight. */
  defId: string;
  /** Switches the phase-suffixed sprite set (1 → `<state>1` frames, 2 → `<state>2`). */
  setPhase: (phase: 1 | 2) => void;
  /** Plays a multi-frame sequence of textures (transform / defeat / victory), cancelling any prior sequence. */
  playSequence: (frames: string[], intervalMs: number, onDone?: () => void) => void;
  destroy: () => void;
}

/** Resizes a centered (origin 0.5,0.5) pill to snugly cover `text`, including its stroke.
 *  Assumes pill and text share the same local position (e.g. both children of nameGroup at 0,0) —
 *  only the size changes, so it never touches position and can't produce NaN geometry from an
 *  unset/mid-update text position. */
function fitNamePill(pill: Phaser.GameObjects.Rectangle, text: Phaser.GameObjects.Text, paddingX = 14, paddingY = 6): void {
  const strokeThickness = typeof text.style?.strokeThickness === 'number' ? text.style.strokeThickness : 0;
  const textWidth = Number.isFinite(text.width) ? text.width : 0;
  const textHeight = Number.isFinite(text.height) ? text.height : 0;
  const width = Math.max(40, textWidth + strokeThickness * 2 + paddingX);
  const height = Math.max(20, textHeight + strokeThickness * 2 + paddingY);
  pill.setSize(width, height);
}

const SPRITE_SIZE = 190;
const SPRITE_SIZE_NORMAL = 170;
const BAR_W = 137.4;
const BAR_H = 9.7;
const BAR_Y = -95.3;

export function createEnemyDisplay(
  scene: Phaser.Scene,
  x: number,
  y: number,
  isBoss: boolean,
  onClick: () => void,
): EnemyDisplay {
  const container = scene.add.container(x, y).setDepth(5);
  const shadow = scene.add.ellipse(0, 74, isBoss ? 195 : 175, isBoss ? 44 : 40, 0x291c00, 0.76);
  const token = scene.add.image(0, 0, 'enemy_idle').setInteractive({ useHandCursor: true });
  const spriteSize = isBoss ? SPRITE_SIZE : SPRITE_SIZE_NORMAL;
  let baseScaleX = 1;
  let baseScaleY = 1;
  const downedPill = scene.add.container(0, 102).setVisible(false);
  const downedBg = scene.add.rectangle(0, 0, 76, 18, 0x0b0d10, 0.85).setStrokeStyle(1, 0xc9a24b).setOrigin(0.5);
  const downedText = scene.add
    .text(0, 0, 'DOWNED', { fontFamily: FONT_MONO, fontSize: '11px', color: '#e9c876', fontStyle: 'bold' })
    .setOrigin(0.5);
  downedPill.add([downedBg, downedText]);
  // Persistent "⚡ CHARGING" telegraph — stays visible until the move lands.
  const chargePill = scene.add.container(0, -124).setVisible(false);
  const chargeBg = scene.add.rectangle(0, 0, 120, 20, 0x2a1010, 0.9).setStrokeStyle(1.5, 0xb0453f).setOrigin(0.5);
  const chargeText = scene.add
    .text(0, 0, '', { fontFamily: FONT_MONO, fontSize: '11px', color: '#ff8a75', fontStyle: 'bold' })
    .setOrigin(0.5);
  chargePill.add([chargeBg, chargeText]);
  let chargeTween: Phaser.Tweens.Tween | undefined;
  // Compact status chip row under the HP bar (DOWNED keeps its own pill).
  const STATUS_ABBR: Record<string, string> = {
    poison: 'PSN', burn: 'BRN', bleed: 'BLD', curse: 'CRS', frostbite: 'FRB', shock: 'SHK',
    sleep: 'SLP', fear: 'FEAR', silence: 'SLNT', blind: 'BLND', confuse: 'CNF', stun: 'STN',
    root: 'ROOT', slowed: 'SLOW', vulnerable: 'VULN', cursed: 'CRSD', pacified: 'PAC',
    atk_up: 'ATK+', def_up: 'DEF+', spd_up: 'SPD+', regen: 'REG', barrier: 'BAR',
    veil_step: 'VEIL', momentum_gain: 'MOM', atk_down: 'ATK-', def_down: 'DEF-', spd_down: 'SPD-',
  };
  const statusText = scene.add
    .text(0, -79, '', {
      fontFamily: FONT_MONO, fontSize: '9px', color: '#ff8a75', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 180 },
    })
    .setOrigin(0.5)
    .setVisible(false);
  const hpBg = scene.add.rectangle(-BAR_W / 2, BAR_Y, BAR_W, BAR_H, 0x0b0d10, 0.45).setOrigin(0, 0.5);
  const hpFg = scene.add.rectangle(-BAR_W / 2, BAR_Y, BAR_W, BAR_H, 0xb10000).setOrigin(0, 0.5).setStrokeStyle(1, 0x0b0d10);
  // Persona-style target reticle: a gold ring centered on the enemy's body.
  const reticle = scene.add.container(0, -4).setVisible(false).setDepth(7);
  const ringOuter = scene.add.circle(0, 0, 62).setFillStyle(0xffd700, 0.06).setStrokeStyle(2.5, 0xffd700, 0.9);
  const ringInner = scene.add.circle(0, 0, 50).setStrokeStyle(1.2, 0xffd700, 0.45);
  const ticks = scene.add.graphics();
  ticks.lineStyle(3.5, 0xffd700, 1);
  for (let a = 0; a < 4; a++) {
    const start = (a * Math.PI) / 2 + 0.28;
    ticks.beginPath();
    ticks.arc(0, 0, 62, start, start + 0.55);
    ticks.strokePath();
  }
  reticle.add([ringOuter, ringInner, ticks]);
  container.add([shadow, token, hpBg, hpFg, downedPill, chargePill, statusText, reticle]);
  token.on('pointerdown', onClick);
  token.on('pointerover', () => { if (!selected) token.setScale(baseScaleX * 1.06, baseScaleY * 1.06); });
  token.on('pointerout', () => { if (!selected) token.setScale(baseScaleX, baseScaleY); });

  let defId: string | undefined;
  let phase: 1 | 2 = 1;
  let currentState: 'idle' | 'attack' | 'hit' | 'guard' = 'idle';
  let sequencing = false;
  let seqTimer: Phaser.Time.TimerEvent | undefined;
  const stopSequence = () => {
    sequencing = false;
    if (seqTimer) { seqTimer.remove(); seqTimer = undefined; }
  };
  const applyTexture = (state: 'idle' | 'attack' | 'hit' | 'guard') => {
    const phaseKey = defId ? `enemy_${defId}_${state}${phase}` : '';
    const tex = defId
      ? scene.textures.exists(phaseKey)
        ? phaseKey
        : scene.textures.exists(`enemy_${defId}_${state}`)
          ? `enemy_${defId}_${state}`
          : scene.textures.exists(`enemy_${state}`)
            ? `enemy_${state}`
            : `tok_${defId}`
      : scene.textures.exists(`enemy_${state}`)
        ? `enemy_${state}`
        : null;
    if (!tex || !scene.textures.exists(tex)) return;
    token.setTexture(tex);
    const frame = token.frame;
    const scale = Math.min(spriteSize / frame.realWidth, spriteSize / frame.realHeight);
    token.setDisplaySize(frame.realWidth * scale, frame.realHeight * scale);
    baseScaleX = token.scaleX;
    baseScaleY = token.scaleY;
  };
  applyTexture('idle');

  // Idle breathing: every foe sways gently while it waits. Dies with the token.
  let idleTween: Phaser.Tweens.Tween | undefined;
  if (!reducedMotion()) {
    idleTween = scene.tweens.add({
      targets: token,
      y: -3.5,
      duration: 1500 + Math.random() * 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: Math.random() * 600,
    });
  }

  const setState = (state: 'idle' | 'attack' | 'hit' | 'guard') => {
    stopSequence();
    currentState = state;
    applyTexture(state);
    if (state === 'hit') {
      token.setTint(0xff3b30);
    } else {
      token.clearTint();
    }
  };

  const playSequence = (frames: string[], intervalMs: number, onDone?: () => void) => {
    stopSequence();
    sequencing = true;
    let i = 0;
    const showNext = () => {
      if (!sequencing) return;
      if (i >= frames.length) {
        sequencing = false;
        onDone?.();
        return;
      }
      const tex = frames[i++];
      if (scene.textures.exists(tex)) {
        token.setTexture(tex);
        const frame = token.frame;
        const scale = Math.min(spriteSize / frame.realWidth, spriteSize / frame.realHeight);
        token.setDisplaySize(frame.realWidth * scale, frame.realHeight * scale);
        baseScaleX = token.scaleX;
        baseScaleY = token.scaleY;
      }
      seqTimer = scene.time.delayedCall(intervalMs, showNext);
    };
    showNext();
  };

  let selected = false;
  let wasWindowOpen = false;
  let reticleTween: Phaser.Tweens.Tween | undefined;
  const setSelected = (v: boolean) => {
    if (selected === v) return;
    selected = v;
    if (v) {
      reticle.setVisible(true);
      reticleTween = scene.tweens.add({ targets: reticle, angle: 360, duration: 4000, repeat: -1 });
    } else {
      reticle.setVisible(false);
      if (reticleTween) { reticleTween.stop(); reticleTween = undefined; }
      reticle.angle = 0;
    }
  };

  const handle: EnemyDisplay = {
    container,
    setHpBarVisible: (v: boolean) => {
      hpBg.setVisible(v);
      hpFg.setVisible(v);
    },
    update: (view: EnemyView) => {
      if (defId !== view.defId) {
        defId = view.defId;
        handle.defId = defId ?? '';
        applyTexture(currentState);
      }
      const barrierUp = view.statuses.some((s) => s.id === 'barrier');
      const guardTex = defId ? `enemy_${defId}_guard${phase}` : '';
      if (!sequencing && barrierUp && currentState !== 'attack' && currentState !== 'hit' && scene.textures.exists(guardTex)) {
        if (currentState !== 'guard') {
          currentState = 'guard';
          applyTexture('guard');
        }
      } else if (currentState === 'guard') {
        currentState = 'idle';
        applyTexture('idle');
      }
      container.setVisible(view.alive);
      downedPill.setVisible(view.alive && view.statuses.some((s) => s.id === 'downed'));
      // Status chips under the HP bar — afflictions and buffs always readable.
      const chips = view.statuses
        .filter((s) => s.id !== 'downed')
        .map((s) => {
          const abbr = STATUS_ABBR[s.id] ?? s.id.toUpperCase();
          return s.turnsRemaining > 1 ? `${abbr}·${s.turnsRemaining}` : abbr;
        });
      statusText.setText(chips.join(' · '));
      statusText.setVisible(view.alive && chips.length > 0);
      // Persistent charge telegraph: label + pulse while a charged move brews.
      const charging = view.alive && !!view.pendingChargeLabel;
      if (charging) {
        const label = `⚡ ${view.pendingChargeLabel}`.toUpperCase();
        if (chargeText.text !== label) {
          chargeText.setText(label);
          chargeBg.setSize(Math.max(90, chargeText.width + 20), 20);
        }
        if (!chargePill.visible) {
          chargePill.setVisible(true).setAlpha(0);
          scene.tweens.add({ targets: chargePill, alpha: 1, duration: 180 });
          if (!reducedMotion()) {
            chargeTween = scene.tweens.add({ targets: chargePill, scale: 1.07, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        }
      } else if (chargePill.visible) {
        chargePill.setVisible(false);
        if (chargeTween) { chargeTween.stop(); chargeTween = undefined; }
        chargePill.setScale(1);
      }
      const pct = Math.max(0, view.hp / view.maxHp);
      hpFg.width = BAR_W * pct;
      if ((view.weakWindowTurns ?? 0) > 0) {
        token.setTint(0xc9a24b);
        if (!wasWindowOpen) {
          wasWindowOpen = true;
          spawnHitParticles(scene, 0, -18, 0xc9a24b);
          scene.tweens.add({
            targets: token,
            scaleX: { from: baseScaleX * 1.15, to: baseScaleX },
            scaleY: { from: baseScaleY * 1.15, to: baseScaleY },
            duration: 350,
            ease: 'Sine.easeOut',
          });
        }
      } else {
        token.clearTint();
        wasWindowOpen = false;
      }
    },
    setSelected,
    setState,
    defId: '',
    setPhase: (p: 1 | 2) => {
      if (phase === p) return;
      phase = p;
      if (!sequencing) applyTexture(currentState);
    },
    playSequence,
    destroy: () => { if (reticleTween) reticleTween.stop(); if (chargeTween) chargeTween.stop(); if (idleTween) idleTween.stop(); stopSequence(); container.destroy(); },
  };
  return handle;
}

export interface ApPipsHandle {
  container: Phaser.GameObjects.Container;
  update: (ap: number, banked: number) => void;
  destroy: () => void;
}

const PIP_XS = [-42, -15.3, 11.4, 38.1, 64.8];
const PIP_R = 7;

export function createApPips(scene: Phaser.Scene, x: number, y: number, labelText = 'AP'): ApPipsHandle {
  const container = scene.add.container(x, y).setDepth(10);
  const outer = scene.add.rectangle(0, 0, 184.7, 32.7, 0xc9a24b).setStrokeStyle(2, 0x0b0d10).setOrigin(0.5);
  const inner = scene.add.rectangle(0, 0, 178.7, 27.3, 0x0b0d10).setOrigin(0.5);
  const label = scene.add.text(-72, 3.5, labelText, { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold }).setOrigin(0.5);
  const dots: Phaser.GameObjects.Arc[] = [];
  for (const px of PIP_XS) {
    const d = scene.add.circle(px, 0, PIP_R, 0x0b0d10).setStrokeStyle(2, 0xc9a24b);
    dots.push(d);
  }
  const reserveText = scene.add.text(0, 27, '', { fontFamily: FONT_MONO, fontSize: '9px', color: PALETTE_HEX.gold }).setOrigin(0.5, 0.5);
  container.add([outer, inner, label, ...dots, reserveText]);
  return {
    container,
    update: (ap: number, banked: number) => {
      dots.forEach((d, i) => d.setFillStyle(i < ap ? 0xc9a24b : 0x0b0d10));
      reserveText.setText(banked > 0 ? `RES ${banked}` : '');
    },
    destroy: () => container.destroy(),
  };
}

export interface TooltipPanelHandle {
  container: Phaser.GameObjects.Container;
  /** Shows a transient message (hover descriptions, errors) — `hide` restores the default text. */
  show: (text: string) => void;
  /** Restores the default tooltip text. */
  hide: () => void;
  destroy: () => void;
}

const TOOLTIP_DEFAULT = 'Perform a basic attack on target enemy';

export function createTooltipPanel(scene: Phaser.Scene, x: number, y: number): TooltipPanelHandle {
  const container = scene.add.container(x, y).setDepth(10);
  const bg = scene.add
    .rectangle(0, 0, 534.7, 61.2, 0x0b0d10, 0.76)
    .setStrokeStyle(2, 0xc9a24b)
    .setOrigin(0.5);
  const text = scene.add
    .text(0, 2, TOOLTIP_DEFAULT, {
      fontFamily: FONT_BODY,
      fontSize: '16px',
      color: PALETTE_HEX.bone,
      align: 'center',
      wordWrap: { width: 500 },
      lineSpacing: 3,
    })
    .setOrigin(0.5);
  container.add([bg, text]);
  return {
    container,
    show: (t: string) => {
      text.setFontSize('16px');
      text.setText(t);
    },
    hide: () => {
      text.setFontSize('16px');
      text.setText(TOOLTIP_DEFAULT);
    },
    destroy: () => container.destroy(),
  };
}

export interface CombatLogPanelHandle {
  container: Phaser.GameObjects.Container;
  /** Renders the tail of the combat log (newest entries win). */
  update: (lines: string[]) => void;
  destroy: () => void;
}

/** Vertical combat-log strip in the right margin, outside the battle frame. */
const COMBAT_LOG_W = 92;
const COMBAT_LOG_H = 608;
const COMBAT_LOG_TAIL = 8;
const COMBAT_LOG_ENTRY_GAP = 6;

export function createCombatLogPanel(scene: Phaser.Scene, x: number, y: number): CombatLogPanelHandle {
  const container = scene.add.container(x, y).setDepth(10);
  const bg = scene.add
    .rectangle(0, 0, COMBAT_LOG_W, COMBAT_LOG_H, 0x0b0d10, 0.82)
    .setStrokeStyle(2, 0xc9a24b)
    .setOrigin(0.5);
  const title = scene.add
    .text(0, -(COMBAT_LOG_H / 2) + 12, 'COMBAT LOG', { fontFamily: FONT_MONO, fontSize: '10px', color: PALETTE_HEX.gold })
    .setOrigin(0.5);
  container.add([bg, title]);
  const entries: Phaser.GameObjects.Text[] = [];
  return {
    container,
    update: (lines: string[]) => {
      entries.forEach((t) => t.destroy());
      entries.length = 0;
      let y = -(COMBAT_LOG_H / 2) + 26;
      for (const line of lines.slice(-COMBAT_LOG_TAIL)) {
        const isRound = /^— Round \d+ —$/.test(line);
        const t = scene.add
          .text(0, y, line, {
            fontFamily: FONT_MONO,
            fontSize: '10px',
            color: isRound ? PALETTE_HEX.gold : PALETTE_HEX.boneMuted,
            align: 'left',
            wordWrap: { width: COMBAT_LOG_W - 8 },
            lineSpacing: 2,
          })
          .setOrigin(0, 0);
        container.add(t);
        entries.push(t);
        y += t.height + COMBAT_LOG_ENTRY_GAP;
        if (y > COMBAT_LOG_H / 2 - 8) break;
      }
    },
    destroy: () => {
      entries.forEach((t) => t.destroy());
      container.destroy();
    },
  };
}

export interface ActionGridItem {
  id: string;
  label: string;
  apCost: number;
  disabled?: boolean;
  description?: string;
  onHover?: () => void;
  onUnhover?: () => void;
  onClick: () => void;
}

const COL_XS = [-181.6, 8.4];
const ROW_YS = [-67.9, -19.3, 29.3];
const BTN_W = 177.3;
const BTN_H = 41.3;
/** Book-page container behind the action buttons (design-proportioned 614×274 → canvas).
 *  Offset to the buttons' visual center (grid cells are not symmetric around the container origin). */
const PANEL_BACK_W = 409.3;
const PANEL_BACK_H = 182.7;
const PANEL_BACK_X = -86.6;
const PANEL_BACK_Y = -19.3;

function addPanelBackdrop(scene: Phaser.Scene, container: Phaser.GameObjects.Container, w: number, h: number, x = 0, y = 0): void {
  if (!scene.textures.exists('panel_book')) return;
  const back = scene.add.image(x, y, 'panel_book').setDisplaySize(w, h);
  const gold = scene.add.rectangle(x, y, w, h).setStrokeStyle(2, 0xc9a24b);
  const black = scene.add.rectangle(x, y, w - 6, h - 6).setStrokeStyle(1.5, 0x0b0d10);
  container.addAt([back, gold, black], 0);
}

export interface ActionGridHandle {
  container: Phaser.GameObjects.Container;
  /** Keyboard focus: highlights a cell like hover (null clears). */
  setFocus: (index: number | null) => void;
  /** Activates a focused cell's action (no-op while disabled). */
  activate: (index: number) => void;
  /** Whether a cell is currently usable (keyboard nav skips unusable cells). */
  isEnabled: (index: number) => boolean;
}

export function createActionGrid(
  scene: Phaser.Scene,
  x: number,
  y: number,
  items: ActionGridItem[],
  tooltip: TooltipPanelHandle,
): ActionGridHandle {
  const container = scene.add.container(x, y).setDepth(10);
  addPanelBackdrop(scene, container, PANEL_BACK_W, PANEL_BACK_H, PANEL_BACK_X, PANEL_BACK_Y);

  const cells: { cx: number; cy: number }[] = [];
  for (const cy of ROW_YS) {
    for (const cx of COL_XS) {
      cells.push({ cx, cy });
    }
  }

  const entries: {
    bg: Phaser.GameObjects.Rectangle;
    inner: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    item: ActionGridItem;
    enabled: boolean;
  }[] = [];
  let focused = -1;

  const applyVisual = (i: number, hovered: boolean) => {
    const e = entries[i];
    if (!e || !e.enabled) return;
    e.bg.setFillStyle(hovered ? 0x0b0d10 : 0xc9a24b);
    e.bg.setStrokeStyle(2, hovered ? 0xc9a24b : 0x0b0d10);
    e.inner.setFillStyle(hovered ? 0xc9a24b : 0x21252a);
    e.inner.setStrokeStyle(1.5, hovered ? 0x0b0d10 : 0xc9a24b);
    e.label.setColor(hovered ? '#0b0d10' : '#ffffff');
  };

  cells.forEach((cell, i) => {
    const item = items[i];
    if (!item) return;
    const bg = scene.add.rectangle(cell.cx, cell.cy, BTN_W, BTN_H, 0xc9a24b).setStrokeStyle(2, 0x0b0d10).setOrigin(0.5);
    const inner = scene.add.rectangle(cell.cx, cell.cy, BTN_W - 4.8, BTN_H - 4.3, 0x21252a).setStrokeStyle(1.5, 0xc9a24b).setOrigin(0.5);
    const label = scene.add
      .text(cell.cx, cell.cy, item.label, {
        fontFamily: FONT_SERIF,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    const enabled = !item.disabled;
    if (!enabled) {
      [bg, inner, label].forEach((o) => o.setAlpha(0.45));
    } else {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        applyVisual(i, true);
        if (item.description) tooltip.show(item.description);
        item.onHover?.();
      });
      bg.on('pointerout', () => {
        applyVisual(i, false);
        tooltip.hide();
        item.onUnhover?.();
      });
      bg.on('pointerdown', () => {
        // Same press-squish vocabulary as every other button in the game.
        if (!reducedMotion()) {
          scene.tweens.add({ targets: [bg, inner], scale: 0.95, duration: 60, yoyo: true, ease: 'Sine.easeOut' });
        }
        item.onClick();
      });
    }
    entries.push({ bg, inner, label, item, enabled });
    container.add([bg, inner, label]);
  });

  return {
    container,
    setFocus: (index) => {
      if (index === focused) return;
      if (focused >= 0) {
        applyVisual(focused, false);
        tooltip.hide();
        entries[focused].item.onUnhover?.();
      }
      focused = index ?? -1;
      if (index === null || !entries[index] || !entries[index].enabled) return;
      applyVisual(index, true);
      if (entries[index].item.description) tooltip.show(entries[index].item.description);
      entries[index].item.onHover?.();
    },
    activate: (index) => {
      const e = entries[index];
      if (e && e.enabled) e.item.onClick();
    },
    isEnabled: (index) => !!entries[index]?.enabled,
  };
}

export interface CombatAlly {
  id: string;
  name: string;
  loyalty: number;
  tier: string;
  action: string;
}

export interface TurnOrderPanelHandle {
  container: Phaser.GameObjects.Container;
  update: (
    order: string[],
    currentActorKey: string | undefined,
    names: Map<string, string>,
    portraits: Map<string, string>,
  ) => void;
  destroy: () => void;
}

const PANEL_W = 224;
const ROW_W = 204;
const ROW_MAX_H = 33.3;
const ROW_SPACING = 39.3;
const PORTRAIT_SIZE = 33;
const PORTRAIT_BOX = 38;
const PORTRAIT_X = -38.3;
const TEXT_X = -6;

export function createTurnOrderPanel(scene: Phaser.Scene, x: number, y: number): TurnOrderPanelHandle {
  const container = scene.add.container(x, y).setDepth(10);
  const bg = scene.add
    .rectangle(0, 0, PANEL_W, 150, 0x0b0d10)
    .setStrokeStyle(2, 0xc9a24b)
    .setOrigin(0.5);
  const title = scene.add
    .text(0, -60, 'TURN ORDER', { fontFamily: FONT_SERIF, fontSize: '13px', color: PALETTE_HEX.gold })
    .setOrigin(0.5);
  container.add([bg, title]);

  const rows: { box: Phaser.GameObjects.Rectangle; portraitBox: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image | Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }[] = [];

  function setPortrait(img: Phaser.GameObjects.Image, texKey: string): void {
    if (!scene.textures.exists(texKey)) return;
    img.setTexture(texKey);
    img.setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);
  }

  function build(
    order: string[],
    actor: string | undefined,
    names: Map<string, string>,
    portraits: Map<string, string>,
  ) {
    rows.forEach((r) => { r.box.destroy(); r.portraitBox.destroy(); r.icon.destroy(); r.label.destroy(); });
    rows.length = 0;
    const n = Math.max(1, order.length);
    const spacing = ROW_SPACING;
    const rowH = ROW_MAX_H;
    const panelH = 42 + (n - 1) * spacing + rowH + 8;
    // Top-anchored: the panel's top edge stays at -75 (its default half-height)
    // so extra rows extend downward instead of pushing the title out of the frame.
    const TOP_EDGE = -(150 / 2);
    bg.setSize(PANEL_W, panelH);
    bg.setPosition(0, TOP_EDGE + panelH / 2);
    title.setPosition(0, TOP_EDGE + 14);
    const startY = TOP_EDGE + 42;
    let cursorY = startY;
    order.forEach((key, i) => {
      const isCurrent = key === actor;
      const ry = cursorY;
      const text = scene.add
        .text(TEXT_X, ry, names.get(key) ?? key, {
          fontFamily: FONT_MONO,
          fontSize: n > 3 ? '11px' : '12px',
          color: isCurrent ? PALETTE_HEX.gold : PALETTE_HEX.bone,
          wordWrap: { width: ROW_W / 2 - 22, useAdvancedWrap: true },
          lineSpacing: 1,
        })
        .setOrigin(0, 0.5);
      // Row plate sized to cover the whole name (even two-line wraps).
      const rowH = Math.max(ROW_MAX_H, text.height + 14);
      const box = scene.add
        .rectangle(0, ry, ROW_W, rowH, 0x000000)
        .setOrigin(0.5)
        .setStrokeStyle(isCurrent ? 2 : 0, isCurrent ? 0xc9a24b : 0x000000);
      const portraitBox = scene.add
        .rectangle(PORTRAIT_X, ry, PORTRAIT_BOX, Math.min(rowH, PORTRAIT_BOX + 8), 0x0b0d10)
        .setOrigin(0.5)
        .setStrokeStyle(isCurrent ? 2 : 0, isCurrent ? 0xc9a24b : 0x000000);
      const texKey = portraits.get(key) ?? '';
      const hasPortrait = texKey !== '' && scene.textures.exists(texKey);
      const icon: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = hasPortrait
        ? scene.add.image(PORTRAIT_X, ry, texKey)
        : scene.add.circle(PORTRAIT_X, ry, 11, 0xb0453f).setOrigin(0.5);
      if (hasPortrait) setPortrait(icon as Phaser.GameObjects.Image, texKey);
      rows.push({ box, portraitBox, icon, label: text });
      container.add([box, portraitBox, icon, text]);
      cursorY += Math.max(ROW_SPACING, rowH + 6);
    });
    // Grow the panel to the rows actually laid out (extra rows extend downward).
    const usedH = 42 + (cursorY - startY);
    const finalH = Math.max(panelH, usedH + 4);
    bg.setSize(PANEL_W, finalH);
    bg.setPosition(0, TOP_EDGE + finalH / 2);
  }

  return {
    container,
    update: (order, actor, names, portraits) => build(order, actor, names, portraits),
    destroy: () => container.destroy(),
  };
}

export interface AllyDisplay {
  container: Phaser.GameObjects.Container;
  setState: (state: 'idle' | 'attack' | 'hit') => void;
  destroy: () => void;
}

export function createAllyDisplay(scene: Phaser.Scene, x: number, y: number, name: string): AllyDisplay {
  const container = scene.add.container(x, y).setDepth(6);
  const shadow = scene.add.ellipse(0, 74, 175, 42, 0x291c00, 0.76);
  const token = scene.add.image(0, 0, 'token_7').setTint(0xc9a24b);
  let baseScaleX = 1;
  let baseScaleY = 1;
  const setPortrait = (texKey: string) => {
    if (!scene.textures.exists(texKey)) return;
    const frame = scene.textures.get(texKey).getSourceImage();
    const w = frame.width || 1;
    const h = frame.height || 1;
    token.setTexture(texKey);
    token.setScale(Math.min(170 / w, 200 / h));
    baseScaleX = token.scaleX;
    baseScaleY = token.scaleY;
  };
  setPortrait('token_7');
  const namePill = scene.add.rectangle(0, -110, 40, 20, 0x0b0d10, 0.5);
  const nameText = scene.add
    .text(0, -110, name, {
      fontFamily: FONT_SERIF,
      fontSize: '14px',
      color: '#e0b34f',
      align: 'center',
      stroke: '#0b0d10',
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0.5);
  fitNamePill(namePill, nameText);
  container.add([shadow, token, namePill, nameText]);
  let currentState: 'idle' | 'attack' | 'hit' = 'idle';
  const setState = (state: 'idle' | 'attack' | 'hit') => {
    currentState = state;
    if (state === 'hit') {
      token.setTint(0xff3b30);
    } else {
      token.setTint(0xc9a24b);
      scene.tweens.add({
        targets: token,
        scaleX: baseScaleX * 1.08,
        scaleY: baseScaleY * 1.08,
        duration: 100,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  };
  return {
    container,
    setState,
    destroy: () => container.destroy(),
  };
}
export interface BossBarHandle {
  container: Phaser.GameObjects.Container;
  update: (name: string, hp: number, maxHp: number) => void;
  destroy: () => void;
}

const BOSS_BAR_W = 560;
const BOSS_BAR_H = 14;

/** Big boss HP bar with a name plate, shown at the top of the battle frame. */
export function createBossBar(scene: Phaser.Scene, x: number, y: number): BossBarHandle {
  const container = scene.add.container(x, y).setDepth(11);
  const plate = scene.add.rectangle(0, -20, 320, 26, 0x0b0d10, 0.85).setStrokeStyle(2, 0xc9a24b).setOrigin(0.5);
  const nameText = scene.add
    .text(0, -20, '', { fontFamily: FONT_SERIF, fontSize: '15px', color: '#e0b34f', align: 'center' })
    .setOrigin(0.5);
  const bg = scene.add.rectangle(-BOSS_BAR_W / 2, 4, BOSS_BAR_W, BOSS_BAR_H, 0x0b0d10, 0.7).setOrigin(0, 0.5).setStrokeStyle(2, 0xc9a24b);
  const fg = scene.add.rectangle(-BOSS_BAR_W / 2 + 2, 4, BOSS_BAR_W - 4, BOSS_BAR_H - 4, 0xb10000).setOrigin(0, 0.5);
  container.add([plate, nameText, bg, fg]);
  return {
    container,
    update: (name, hp, maxHp) => {
      nameText.setText(name.toUpperCase());
      plate.setSize(Math.max(140, nameText.width + 28), 26);
      const pct = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
      scene.tweens.add({ targets: fg, width: (BOSS_BAR_W - 4) * pct, duration: 350, ease: 'Sine.easeOut' });
    },
    destroy: () => container.destroy(),
  };
}
