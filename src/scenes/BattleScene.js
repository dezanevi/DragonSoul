import Phaser from 'phaser';
import { normalizeInventory, getItemCount, removeItem, addItem, rollDrops } from '../systems/InventorySystem.js';
import { getItem } from '../data/items.js';
import spellRows from '../data/spells.json';
import {
  applyStatusEffect,
  processStatusEffects
} from '../systems/StatusEffectSystem.js';
import BattleGrid from '../battle/BattleGrid.js';
import { sortByInitiative } from '../battle/InitiativeSystem.js';
import { calculateElementalDamage } from '../battle/DamageCalculator.js';
import { chooseAITarget, chooseAIMove } from '../battle/BattleAI.js';
import BoardProjection from '../battle/BoardProjection.js';
import { ensureBackdrop, DEFAULT_BACKDROP } from '../battle/backdrops.js';
import {
  createMonsterModel,
  elementColor,
  ELEMENT_LABELS
} from '../battle/monsterModels.js';
import {
  UI_COLORS,
  uiText,
  drawGlass,
  glassPanel,
  BattleButton,
  floatingText,
  Tooltip
} from '../battle/battleUi.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { gainMagicExperience } from '../systems/MagicMasterySystem.js';
import {
  rewardBondForVictory,
  getMonsterBondBonuses
} from '../systems/MonsterBondSystem.js';
import {
  getStarterSkillId,
  getSkillsLearnedAtLevel,
  learnSkill,
  getMonsterSkills,
  consumeSkillUse
} from '../systems/MonsterSkillSystem.js';
import {
  MONSTER_SPECIES,
  createMonster,
  gainMonsterExperience,
  tryCaptureMonster,
  addMonsterToCollection
} from '../systems/MonsterSystem.js';
import { applyHeroLevelUp } from '../systems/HeroProgressionSystem.js';
import { normalizeElement } from '../systems/ElementSystem.js';
import {
  getTalentBonuses,
  getEffectiveSpellPower,
  getSpellManaCost,
  getMasteryExpMultiplier,
  getSpellDamageMultiplier
} from '../systems/TalentSystem.js';
import { heroTexture, heroIdleFrame } from '../entities/heroSprite.js';
import { objectTextureKey, SHEET_SCALE } from '../entities/objectSprites.js';

// Souboj: tahový boj na mřížce 10 × 8 v perspektivním pohledu.
// Herní pravidla (poškození, schopnosti, AI, ochočení, odměny) jsou převzatá
// z původní scény; nové je vykreslení, ovládání a zvýrazňování dosahu.

// Počet divokých monster v náhodném setkání podle oblasti [min, max].
const ENCOUNTER_SIZE = { Greenvale: [1, 3], default: [1, 5] };
// Startovní pole nepřátel (nejvýš 5).
const ENEMY_POSITIONS = [{ x: 8, y: 3 }, { x: 8, y: 5 }, { x: 9, y: 1 }, { x: 9, y: 6 }, { x: 7, y: 7 }];

const COLUMNS = 10;
const ROWS = 8;
const ESCAPE_CHANCE = 70;
const SPELL_ORIGIN = { x: 0, y: 3 };
// Velikost modelů monster vůči poli (1 = model 118 px široký v nejbližší řadě).
const MODEL_SCALE = 1.35;

const DEPTH = {
  backdrop: -1000,
  motes: -900,
  board: 10,
  highlight: 20,
  hover: 30,
  units: 100,
  fx: 5000,
  ui: 8000,
  popover: 8600
};

const STATUS_LABELS = {
  poison: ['OTR', 0x8bdc54],
  sleep: ['SPÁ', 0x9fb6ff],
  paralysis: ['PAR', 0xffe066],
  freeze: ['ZMR', 0x8fe6ff],
  burn: ['PÁL', 0xff8a4a],
  curse: ['PRO', 0xb48cff],
  stun: ['OMR', 0xffd27a],
  bleed: ['KRV', 0xff5a6a]
};

const CATEGORY = {
  physical: { label: 'Fyzická', color: UI_COLORS.physical },
  magical: { label: 'Magická', color: UI_COLORS.magical },
  healing: { label: 'Léčení', color: UI_COLORS.healing },
  buff: { label: 'Posílení', color: UI_COLORS.buff }
};

const isOffensive = (skill) => skill?.category === 'physical' || skill?.category === 'magical';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // ================================================================ start

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.encounter = data?.encounter ?? null;

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    this.grid = new BattleGrid(COLUMNS, ROWS, [
      { x: 4, y: 2 },
      { x: 5, y: 5 },
      { x: 3, y: 5 }
    ]);

    this.round = 1;
    this.turnIndex = 0;
    this.turnOrder = null;
    this.actedPlayerIds = new Set();
    this.phase = 'units';
    this.mode = 'act';
    // Phaser instanci scény používá znovu pro každý souboj – všechny příznaky
    // z minulého boje (hlavně returning / leaving) se musí vynulovat, jinak
    // se z dalšího boje nedá odejít.
    this.finished = false;
    this.returning = false;
    this.leaving = false;
    this.popover = null;
    this.hoverUnit = null;
    this.previewSkill = null;
    this.currentUnit = null;
    this.selectedSkill = null;
    this.selectedSpell = null;
    this.spellReady = true;
    this.logLines = [];

    this.state.party ??= [];
    normalizeInventory(this.state);
    this.state.bestiary ??= {};
    this.state.spellbook ??= [];
    this.state.magicMastery ??= {};

    // Účinky talentů a pasivního bonusu specializace (TalentSystem).
    this.talentBonuses = getTalentBonuses(this.state);
    this.createWildMonsters();
    this.units = [...this.createPartyUnits(), ...this.createEnemyUnits()];

    this.view = new BoardProjection({
      columns: COLUMNS,
      rows: ROWS,
      centerX: 1010,
      topY: 450,
      bottomY: 950,
      nearHalfWidth: 690,
      depthRatio: 1.45
    });

    this.createBackdrop(data?.backdrop ?? this.encounter?.backdrop ?? DEFAULT_BACKDROP);
    this.drawBoard();
    this.createObstacles();
    this.createUnitModels();
    this.createArion();
    this.createHud();
    this.setupInput();

    this.cameras.main.fadeIn(450, 4, 8, 12);
    this.time.delayedCall(350, () => this.beginTurn());
  }

  // Divoká monstra souboje. Náhodné setkání: počet podle oblasti (systém umí 1–5,
  // začáteční Greenvale zatím 1–3). Jeskynní sliz má s sebou 2 gobliny 5. úrovně.
  createWildMonsters() {
    const currentRegion = this.state.region || 'Greenvale';
    const playerLevel = Number(this.state.level) || 1;
    this.isBoss = this.encounter?.type === 'greenvale_cave_boss';
    this.wildMonsters = [];

    if (this.isBoss) {
      const bossLevel = Math.max(3, Math.min(10, playerLevel + 2));
      const slime = createMonster('cave_slime', bossLevel);
      slime.name = 'Jeskynní sliz';
      slime.isBoss = true;
      this.wildMonsters.push(slime, createMonster('goblin', 5), createMonster('goblin', 5));
    } else {
      let availableSpecies = MONSTER_SPECIES.filter(
        (species) => species.region === currentRegion && species.rarity !== 'rare'
      );
      if (availableSpecies.length === 0) {
        availableSpecies = MONSTER_SPECIES.filter((species) => species.rarity === 'common');
      }

      const [min, max] = this.encounter?.count
        ? [this.encounter.count, this.encounter.count]
        : ENCOUNTER_SIZE[currentRegion] ?? ENCOUNTER_SIZE.default;
      const count = Phaser.Math.Clamp(Phaser.Math.Between(min, max), 1, ENEMY_POSITIONS.length);
      for (let i = 0; i < count; i++) {
        const chosenSpecies = availableSpecies[Phaser.Math.Between(0, availableSpecies.length - 1)];
        this.wildMonsters.push(createMonster(chosenSpecies.id, Math.max(1, playerLevel)));
      }
    }

    // Stejná jména odliší písmeno (Goblin A, Goblin B).
    const counts = {};
    for (const monster of this.wildMonsters) counts[monster.name] = (counts[monster.name] ?? 0) + 1;
    const used = {};
    for (const monster of this.wildMonsters) {
      if (counts[monster.name] > 1) {
        const n = used[monster.name] = (used[monster.name] ?? 0) + 1;
        monster.name = `${monster.name} ${String.fromCharCode(64 + n)}`;
      }
    }

    // Hlavní monstrum (boss / první) – pro starší části kódu.
    this.wildMonster = this.wildMonsters[0];

    for (const monster of this.wildMonsters) {
      const seenRecord = this.state.bestiary[monster.speciesId] ?? { seen: 0, caught: 0, defeated: 0 };
      seenRecord.seen += 1;
      this.state.bestiary[monster.speciesId] = seenRecord;
    }
  }

  createEnemyUnits() {
    return this.wildMonsters.map((monster, index) => this.createEnemyUnit(monster, ENEMY_POSITIONS[index]));
  }

  createEnemyUnit(monster, position) {
    const wildStats = monster.stats;
    const wildBattleHp = Math.max(12, Math.ceil(wildStats.vitality * 0.65));

    return {
      id: monster.instanceId,
      name: monster.name,
      side: 'enemy',
      x: position.x,
      y: position.y,
      boss: Boolean(monster.isBoss),
      hp: Math.min(monster.currentHp, wildBattleHp),
      maxHp: wildBattleHp,
      attack: Math.max(2, Math.floor(wildStats.force * 0.4)),
      aether: Number(wildStats.aether) || 1,
      defense: Math.floor(wildStats.armor * 0.25),
      armor: Number(wildStats.armor) || 0,
      resolve: Number(wildStats.resolve) || 0,
      speed: Math.max(2, Math.floor(wildStats.tempo * 0.75)),
      move: 2,
      range: 1,
      guarding: false,
      movedThisTurn: false,
      monster
    };
  }

  hasAttackCharges(monster) {
    return getMonsterSkills(monster).some((skill) => isOffensive(skill) && skill.remainingUses > 0);
  }

  createPartyUnits() {
    const startingPositions = [
      { x: 0, y: 2 },
      { x: 0, y: 4 },
      { x: 1, y: 2 },
      { x: 1, y: 4 }
    ];

    const party = this.state.party ?? [];

    for (const monster of party) {
      if (!monster.skills || monster.skills.length === 0) {
        learnSkill(monster, getStarterSkillId(monster.speciesId, monster.element));
      }
    }

    const readyMonsters = party.filter((monster) => {
      if (monster.currentHp <= 0) return false;
      if (!this.hasAttackCharges(monster)) {
        monster.currentHp = 0;
        return false;
      }
      return true;
    });

    // Velitelský bonus = statistika hrdiny / 5 + talenty stromu Souboj (rozkazy, Dračí taktika).
    const talents = this.talentBonuses;
    const commanderBonus = {
      physicalAttack: Math.floor(Math.max(0, Number(this.state.attack) || 0) / 5) + talents.commanderAttack,
      magicAttack: Math.floor(Math.max(0, Number(this.state.magicAttack) || 0) / 5) + talents.commanderMagicAttack,
      defense: Math.floor(Math.max(0, Number(this.state.defense) || 0) / 5) + talents.commanderDefense,
      magicResistance: Math.floor(Math.max(0, Number(this.state.magicResistance) || 0) / 5) + talents.commanderMagicResistance
    };

    return readyMonsters.slice(0, startingPositions.length).map((monster, index) => {
      const position = startingPositions[index];
      const bondBonus = getMonsterBondBonuses(monster);
      const armor = monster.stats.armor + bondBonus.defense + commanderBonus.defense;

      return {
        id: monster.instanceId,
        name: monster.name,
        side: 'player',
        x: position.x,
        y: position.y,
        hp: monster.currentHp,
        maxHp: monster.stats.vitality,
        attack: monster.stats.force + bondBonus.attack + commanderBonus.physicalAttack,
        aether: monster.stats.aether + commanderBonus.magicAttack,
        defense: armor,
        armor,
        resolve: monster.stats.resolve + commanderBonus.magicResistance,
        speed: monster.stats.tempo + bondBonus.speed + talents.monsterTempo, // Vůdce smečky
        statusChanceReduction: talents.statusChanceReduction, // Nezlomné velení
        move: monster.stats.tempo >= 12 ? 3 : 2,
        range: 1,
        guarding: false,
        movedThisTurn: false,
        monster,
        statusEffects: monster.statusEffects ?? []
      };
    });
  }

  // ======================================================= kulisa a mřížka

  createBackdrop(backdropId) {
    const { key, backdrop } = ensureBackdrop(this, backdropId);
    this.palette = backdrop.palette;
    this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.backdrop);

    // Poletující pyl / světlušky.
    if (!this.textures.exists('battle-mote')) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(0xffffff, 0.25).fillCircle(8, 8, 8);
      g.fillStyle(0xffffff, 1).fillCircle(8, 8, 3);
      g.generateTexture('battle-mote', 16, 16);
      g.destroy();
    }

    this.add.particles(0, 0, 'battle-mote', {
      x: { min: 0, max: 1920 },
      y: { min: 380, max: 1060 },
      lifespan: 6000,
      speedX: { min: -12, max: 14 },
      speedY: { min: -22, max: -6 },
      scale: { start: 0.5, end: 0.15 },
      alpha: { start: 0.9, end: 0 },
      tint: this.palette.mote,
      frequency: 260,
      blendMode: 'ADD'
    }).setDepth(DEPTH.motes);
  }

  drawBoard() {
    const g = this.add.graphics().setDepth(DEPTH.board);
    const quad = this.view.boardQuad(0.18);

    // Podložka bojiště: jemně ztmavená plocha s měkkým okrajem.
    g.fillStyle(0x061015, 0.32).fillPoints(quad, true);
    g.lineStyle(10, this.palette.glow, 0.06).strokePoints(quad, true);
    g.lineStyle(2, this.palette.glow, 0.28).strokePoints(quad, true);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLUMNS; x++) {
        const cell = this.view.cellQuad(x, y, 0.04);
        g.fillStyle(0xffffff, (x + y) % 2 === 0 ? 0.055 : 0.03).fillPoints(cell, true);
        g.lineStyle(1.2, this.palette.grid, 0.18).strokePoints(cell, true);
      }
    }

    this.highlight = this.add.graphics().setDepth(DEPTH.highlight);
    this.hoverGraphics = this.add.graphics().setDepth(DEPTH.hover);
  }

  createObstacles() {
    const rocks = [2, 0, 3];
    let rockIndex = 0;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLUMNS; x++) {
        if (!this.grid.isBlocked(x, y)) continue;
        const center = this.view.cellCenter(x, y);
        const scale = this.view.scaleAt(y + 0.5);

        if (x === 3 && y === 5) {
          // Tůňka.
          const g = this.add.graphics().setDepth(DEPTH.units + center.y - 30);
          const pond = this.view.cellQuad(x, y, 0.12);
          g.fillStyle(0x0e2b38, 0.9).fillPoints(pond, true);
          g.fillStyle(0x3d8fb0, 0.55).fillPoints(this.view.cellQuad(x, y, 0.2), true);
          g.lineStyle(2, 0xbfeaff, 0.35).strokePoints(pond, true);
          continue;
        }

        const key = objectTextureKey('rock', rocks[rockIndex++ % rocks.length]);
        if (this.textures.exists(key)) {
          this.add.image(center.x, center.y + 18 * scale, key)
            .setOrigin(0.5, 1)
            .setScale(SHEET_SCALE * 1.1 * scale)
            .setDepth(DEPTH.units + center.y);
        }
      }
    }
  }

  // ============================================================ jednotky

  createUnitModels() {
    for (const unit of this.units) {
      unit.model = createMonsterModel(this, {
        speciesId: unit.monster?.speciesId,
        element: unit.monster?.element,
        side: unit.side,
        boss: unit.side === 'enemy' && unit.boss
      });
      unit.bars = this.add.graphics();
      unit.label = uiText(this, 0, 0, '', {
        size: 16,
        bold: true,
        originX: 0.5,
        originY: 1,
        stroke: '#05080c',
        strokeThickness: 4
      });
      unit.statusLabel = uiText(this, 0, 0, '', {
        size: 13,
        bold: true,
        originX: 0.5,
        originY: 0,
        stroke: '#05080c',
        strokeThickness: 3
      });
      this.placeUnit(unit, false);
    }
    this.refreshUnits();
  }

  unitScreen(unit) {
    const center = this.view.cellCenter(unit.x, unit.y);
    return { ...center, scale: this.view.scaleAt(unit.y + 0.5) * MODEL_SCALE };
  }

  placeUnit(unit, animate = true, duration = 320) {
    const { x, y, scale } = this.unitScreen(unit);
    unit.model.setDepth(DEPTH.units + y);

    if (!animate) {
      unit.model.setPosition(x, y).setScale(scale);
      return;
    }

    this.tweens.add({
      targets: unit.model,
      x,
      y,
      scale,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.refreshUnitBars(unit),
      onComplete: () => this.refreshUnitBars(unit)
    });
  }

  refreshUnits() {
    for (const unit of this.units) this.refreshUnitBars(unit);
  }

  refreshUnitBars(unit) {
    const g = unit.bars;
    g.clear();

    if (unit.hp <= 0) {
      unit.label.setVisible(false);
      unit.statusLabel.setVisible(false);
      return;
    }

    const x = unit.model.x;
    const y = unit.model.y;
    const scale = unit.model.scale;
    const top = y - (unit.boss ? 205 : 160) * scale;
    const width = 120 * scale;
    const height = 10;
    const ratio = Phaser.Math.Clamp(unit.hp / unit.maxHp, 0, 1);
    const fill = unit.side === 'enemy' ? 0xff5468 : ratio > 0.5 ? 0x4ee39a : ratio > 0.25 ? 0xffc14a : 0xff5a5a;

    g.setDepth(DEPTH.units + y + 1);
    g.fillStyle(0x05080c, 0.75).fillRoundedRect(x - width / 2 - 2, top - 2, width + 4, height + 4, 6);
    g.fillStyle(0x1e2a33, 1).fillRoundedRect(x - width / 2, top, width, height, 5);
    if (ratio > 0) g.fillStyle(fill, 1).fillRoundedRect(x - width / 2, top, Math.max(6, width * ratio), height, 5);
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(x - width / 2 + 2, top + 1, Math.max(0, width * ratio - 4), 3, 2);

    const level = unit.monster?.level ? ` · ${unit.monster.level}` : '';
    unit.label
      .setText(`${unit.name}${level}`)
      .setPosition(x, top - 6)
      .setColor(unit.side === 'enemy' ? '#ffd0d6' : '#d6f7ff')
      .setDepth(DEPTH.units + y + 2)
      .setVisible(true);

    const statuses = (unit.statusEffects ?? [])
      .filter((effect) => (effect.remaining ?? 1) > 0)
      .map((effect) => `${STATUS_LABELS[effect.id]?.[0] ?? effect.id}${effect.remaining ?? ''}`);
    const buffs = (unit.activeBuffs ?? []).map((buff) => `▲${statLabel(buff.stat)}`);
    const chips = [...statuses, ...buffs].join('  ');

    unit.statusLabel
      .setText(chips)
      .setPosition(x, top + height + 6)
      .setColor('#ffe6a8')
      .setDepth(DEPTH.units + y + 2)
      .setVisible(chips.length > 0);
  }

  faintUnit(unit) {
    this.tweens.killTweensOf(unit.model);
    this.tweens.add({
      targets: unit.model,
      alpha: 0,
      y: unit.model.y + 16,
      duration: 650,
      ease: 'Cubic.easeIn'
    });
    this.refreshUnitBars(unit);
  }

  // ================================================================ Arion

  createArion() {
    const feet = { x: 215, y: 770 };
    this.arionAura = this.add.graphics().setDepth(DEPTH.units + feet.y - 1);
    this.arionAura.setPosition(feet.x, feet.y);
    this.drawArionAura();

    if (this.textures.exists(heroTexture(this.state.gender))) {
      this.arion = this.add.sprite(feet.x, feet.y + 8, heroTexture(this.state.gender), heroIdleFrame('east'))
        .setOrigin(0.5, 1)
        .setDisplaySize(195, 260)
        .setDepth(DEPTH.units + feet.y);
    } else {
      this.arion = this.add.rectangle(feet.x, feet.y, 80, 220, 0x2d4a7a).setOrigin(0.5, 1).setDepth(DEPTH.units + feet.y);
    }

    this.arionBaseScaleY = this.arion.scaleY;
    this.tweens.add({
      targets: this.arion,
      scaleY: this.arionBaseScaleY * 1.012,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.arionHand = { x: feet.x + 48, y: feet.y - 150 };
  }

  drawArionAura() {
    const g = this.arionAura;
    g.clear();
    const color = this.spellReady ? 0xb48cff : 0x5b6b78;
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 4, 136, 38);
    g.fillStyle(color, this.spellReady ? 0.2 : 0.08).fillEllipse(0, 0, 170, 50);
    g.lineStyle(3, color, this.spellReady ? 0.8 : 0.3).strokeEllipse(0, 0, 158, 44);

    this.tweens.killTweensOf(g);
    g.setAlpha(1);
    if (this.spellReady) {
      this.tweens.add({ targets: g, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ============================================================== rozhraní

  createHud() {
    this.tooltip = new Tooltip(this);

    // Arion – velitel (vlevo nahoře).
    const hero = glassPanel(this, 28, 24, 440, 132).setDepth(DEPTH.ui);
    hero.fillStyle(0x0b1a26, 1).fillCircle(96, 90, 50);
    hero.lineStyle(3, 0xb48cff, 0.8).strokeCircle(96, 90, 50);

    if (this.textures.exists(heroTexture(this.state.gender))) {
      const portrait = this.add.image(96, 112, heroTexture(this.state.gender), heroIdleFrame('south'))
        .setDisplaySize(92, 123)
        .setDepth(DEPTH.ui + 1);
      const maskShape = this.make.graphics({ add: false }).fillCircle(96, 90, 47);
      portrait.setMask(maskShape.createGeometryMask());
    }

    uiText(this, 162, 38, this.state.playerName || 'Arion', { size: 24, bold: true }).setDepth(DEPTH.ui + 1);
    uiText(this, 162, 70, `Velitel · úroveň ${this.state.level ?? 1}`, { size: 15, color: UI_COLORS.muted }).setDepth(DEPTH.ui + 1);
    this.manaBar = this.add.graphics().setDepth(DEPTH.ui + 1);
    this.manaText = uiText(this, 450, 96, '', { size: 14, color: '#bfe2ff', originX: 1 }).setDepth(DEPTH.ui + 2);
    this.spellStatus = uiText(this, 162, 124, '', { size: 14, bold: true }).setDepth(DEPTH.ui + 1);

    // Pořadí tahů (nahoře uprostřed).
    this.roundText = uiText(this, 960, 22, '', { size: 15, bold: true, color: UI_COLORS.muted, originX: 0.5 }).setDepth(DEPTH.ui);
    this.orderLayer = this.add.container(0, 0).setDepth(DEPTH.ui);
    this.hintText = uiText(this, 960, 146, '', {
      size: 18,
      color: '#e9f4ff',
      originX: 0.5,
      stroke: '#05080c',
      strokeThickness: 4
    }).setDepth(DEPTH.ui);

    // Záznam boje (vpravo nahoře).
    glassPanel(this, 1452, 24, 440, 160).setDepth(DEPTH.ui);
    uiText(this, 1472, 34, 'PRŮBĚH BOJE', { size: 13, bold: true, color: UI_COLORS.muted }).setDepth(DEPTH.ui + 1);
    this.logTexts = [0, 1, 2, 3].map((i) =>
      uiText(this, 1472, 58 + i * 30, '', { size: 15, wrap: 400 }).setDepth(DEPTH.ui + 1)
    );

    // Lišta akcí (dole).
    this.actionBar = this.add.container(0, 0).setDepth(DEPTH.ui);
    this.actionBarBg = this.add.graphics();
    this.actionBar.add(this.actionBarBg);
    this.skillButtons = [];

    const action = (label, accent, hotkey, onClick) =>
      new BattleButton(this, 0, 0, 136, 76, { label, accent, hotkey, sub: ' ', onClick, onHover: (b) => this.showActionTip(b), onOut: () => this.tooltip.hide() });

    this.spellButton = action('Kouzla', 0xb48cff, 'Q', () => this.toggleSpellMenu());
    this.captureButton = action('Ochočení', 0xffd27a, 'C', () => this.chooseCapture());
    this.waitButton = action('Čekat', 0x9fb3c4, 'Mezera', () => this.wait());
    this.fleeButton = action('Útěk', 0xff8a8a, 'F', () => this.runAway());
    this.spellButton.tipId = 'spell';
    this.captureButton.tipId = 'capture';
    this.waitButton.tipId = 'wait';
    this.fleeButton.tipId = 'flee';
    this.actionButtons = [this.spellButton, this.captureButton, this.waitButton, this.fleeButton];
    for (const button of this.actionButtons) this.actionBar.add(button.container);

    this.turnBanner = uiText(this, 960, 330, '', {
      size: 46,
      bold: true,
      originX: 0.5,
      originY: 0.5,
      stroke: '#05080c',
      strokeThickness: 8
    }).setDepth(DEPTH.fx).setAlpha(0);

    this.popover = null;
    this.refreshHeroPanel();
  }

  refreshHeroPanel() {
    const mp = Math.max(0, Number(this.state.mp) || 0);
    const maxMp = Math.max(1, Number(this.state.maxMp) || 1);
    const g = this.manaBar;
    g.clear();
    g.fillStyle(0x10202c, 1).fillRoundedRect(162, 100, 288, 12, 6);
    g.fillStyle(0x3fa9ff, 1).fillRoundedRect(162, 100, Math.max(8, 288 * (mp / maxMp)), 12, 6);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(164, 101, Math.max(0, 288 * (mp / maxMp) - 4), 4, 2);
    this.manaText.setText(`MP ${mp} / ${maxMp}`).setY(80);

    this.spellStatus
      .setText(this.spellReady ? '✦ Kouzlo připraveno' : '✧ Kouzlo po tazích monster')
      .setColor(this.spellReady ? '#d6c2ff' : '#7f8f9c');
    this.drawArionAura?.();
  }

  refreshTurnOrder() {
    this.orderLayer.removeAll(true);
    this.roundText.setText(`KOLO ${this.round}`);

    const upcoming = (this.turnOrder ?? []).slice(this.turnIndex).filter((unit) => unit.hp > 0);
    const size = 58;
    const gap = 14;
    const total = upcoming.length * (size + gap) - gap + 16;
    let x = 960 - total / 2;

    upcoming.forEach((unit, index) => {
      const current = index === 0;
      const r = current ? 36 : 27;
      const cx = x + r;
      const cy = 82;
      const g = this.add.graphics();
      const sideColor = unit.side === 'player' ? UI_COLORS.player : UI_COLORS.enemy;

      g.fillStyle(0x000000, 0.35).fillCircle(cx + 2, cy + 4, r);
      g.fillStyle(0x0b1620, 0.9).fillCircle(cx, cy, r);
      g.fillStyle(elementColor(unit.monster?.element), 0.95).fillCircle(cx, cy, r - 7);
      g.lineStyle(current ? 4 : 2.5, current ? 0xffd98a : sideColor, 1).strokeCircle(cx, cy, r);

      const initial = uiText(this, cx, cy, unit.name.charAt(0).toUpperCase(), {
        size: current ? 28 : 21,
        bold: true,
        originX: 0.5,
        originY: 0.5,
        stroke: '#05080c',
        strokeThickness: 4
      });
      this.orderLayer.add([g, initial]);

      if (current) {
        const label = uiText(this, cx, cy + r + 6, 'NA TAHU', { size: 12, bold: true, color: UI_COLORS.gold, originX: 0.5 });
        this.orderLayer.add(label);
      }
      x += r * 2 + gap;
    });
  }

  // Lišta: schopnosti aktuálního monstra + Kouzla, Ochočení, Čekat, Útěk.
  buildActionBar() {
    for (const button of this.skillButtons) button.container.destroy();
    this.skillButtons = [];

    const unit = this.currentUnit;
    const playerTurn = this.phase === 'units' && unit?.side === 'player';
    const skills = playerTurn ? getMonsterSkills(unit.monster).slice(0, 6) : [];

    const skillW = 184;
    const actionW = 136;
    const gap = 10;
    const sectionGap = playerTurn ? 26 : 0;
    const width = skills.length * (skillW + gap) + sectionGap + this.actionButtons.length * (actionW + gap) - gap;
    let x = 960 - width / 2;
    const y = 984;

    this.actionBarBg.clear();
    drawGlass(this.actionBarBg, x - 16, y - 14, width + 32, 104, { radius: 18, alpha: 0.7 });

    skills.forEach((skill, index) => {
      const category = CATEGORY[skill.category] ?? CATEGORY.physical;
      const button = new BattleButton(this, x, y, skillW, 76, {
        label: skill.name,
        sub: `${category.label} · dosah ${skill.range ?? 1} · ${skill.remainingUses}/${skill.maxUses}`,
        accent: category.color,
        hotkey: String(index + 1),
        titleSize: 17,
        onClick: () => this.selectSkill(skill),
        onHover: () => { this.previewSkill = skill; this.refreshBoard(); this.showSkillTip(skill, button); },
        onOut: () => { this.previewSkill = null; this.refreshBoard(); this.tooltip.hide(); }
      });
      button.skill = skill;
      button.setDisabled(skill.remainingUses <= 0);
      button.setSelected(this.selectedSkill?.id === skill.id);
      this.actionBar.add(button.container);
      this.skillButtons.push(button);
      x += skillW + gap;
    });

    x += sectionGap;
    for (const button of this.actionButtons) {
      button.container.setPosition(x, y);
      x += actionW + gap;
    }

    this.refreshActionButtons();
  }

  refreshActionButtons() {
    const playerTurn = !this.finished && this.phase === 'units' && this.currentUnit?.side === 'player' && this.mode !== 'busy';
    const crystals = getItemCount(this.state, 'basic_crystal');
    const affordable = this.availableSpells('enemy').some((spell) => this.state.mp >= this.spellManaCost(spell));

    this.spellButton
      .setContent('Kouzla', this.spellReady ? `MP ${this.state.mp}/${this.state.maxMp}` : 'po tazích monster', 'Q')
      .setDisabled(!playerTurn || !this.spellReady || !affordable)
      .setSelected(this.mode === 'spellTarget' || this.popover?.kind === 'spells');
    this.captureButton
      .setContent('Ochočení', `krystaly ${crystals}`, 'C')
      .setDisabled(!playerTurn || crystals <= 0 || this.isBoss)
      .setSelected(this.mode === 'capture');
    this.waitButton.setContent('Čekat', 'přeskočit tah', 'Mezera').setDisabled(!playerTurn);
    this.fleeButton.setContent('Útěk', `šance ${ESCAPE_CHANCE} %`, 'F').setDisabled(!playerTurn);

    for (const button of this.skillButtons) {
      button.setSelected(this.selectedSkill?.id === button.skill.id && this.mode === 'act');
      button.setDisabled(!playerTurn || button.skill.remainingUses <= 0);
    }
  }

  showSkillTip(skill, button) {
    const category = CATEGORY[skill.category] ?? CATEGORY.physical;
    const lines = [
      `${category.label} · ${ELEMENT_LABELS[normalizeElement(skill.element)] ?? 'Neutrální'}`,
      `Síla ${skill.power ?? 0} · přesnost ${Math.round((skill.accuracy ?? 1) * 100)} %`,
      `Dosah ${skill.range ?? 1} · použití ${skill.remainingUses}/${skill.maxUses}`
    ];
    if (skill.description) lines.push(skill.description);
    this.tooltip.show(button.container.x + button.w / 2, button.container.y, skill.name, lines, category.color);
  }

  showActionTip(button) {
    const tips = {
      spell: ['Útočná kouzla Arionova Spellbooku.', 'Podpůrná kouzla: klikni na své monstrum.', 'Arion kouzlí jednou za kolo tvých monster.'],
      capture: ['Pokus o ochočení divokého monstra krystalem.', 'Nižší HP a stavové efekty zvyšují šanci.', 'Krystal se spotřebuje i při neúspěchu.'],
      wait: ['Monstrum přeskočí tah (bez pohybu i útoku).'],
      flee: [`Šance na útěk ${ESCAPE_CHANCE} %. Při neúspěchu tah končí.`]
    };
    this.tooltip.show(button.container.x + button.w / 2, button.container.y, button.title.text, tips[button.tipId] ?? []);
  }

  setHint(text) {
    this.hintText.setText(text);
  }

  showBanner(text, color) {
    this.tweens.killTweensOf(this.turnBanner);
    this.turnBanner.setText(text).setColor(color).setAlpha(0).setScale(0.85);
    this.tweens.add({
      targets: this.turnBanner,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: this.turnBanner, alpha: 0, delay: 650, duration: 350 })
    });
  }

  log(message) {
    if (!message) return;
    this.logLines.unshift(message);
    this.logLines = this.logLines.slice(0, 4);
    this.logTexts?.forEach((text, index) => {
      const line = this.logLines[index] ?? '';
      text.setText(line.length > 95 ? `${line.slice(0, 92)}…` : line).setAlpha(1 - index * 0.22);
    });
    if (this.logTexts) {
      let y = 58;
      for (const text of this.logTexts) {
        text.setY(y);
        y += Math.min(text.height, 44) + 6;
      }
    }
  }

  // ============================================================= ovládání

  setupInput() {
    this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
    this.input.on('pointerdown', (pointer, over) => {
      if (over.length > 0) return; // klik na tlačítko
      if (this.popover) {
        this.closePopover();
        return;
      }
      const cell = this.view.cellAt(pointer.worldX, pointer.worldY);
      if (cell) this.onCellClicked(cell.x, cell.y);
    });

    this.input.keyboard.on('keydown', (event) => {
      if (this.finished) return;
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 6) {
        const button = this.skillButtons[digit - 1];
        if (button && !button.disabled) this.selectSkill(button.skill);
        return;
      }
      switch (event.code) {
        case 'KeyQ': if (!this.spellButton.disabled) this.toggleSpellMenu(); break;
        case 'KeyC': if (!this.captureButton.disabled) this.chooseCapture(); break;
        case 'Space': if (!this.waitButton.disabled) this.wait(); break;
        case 'KeyF': if (!this.fleeButton.disabled) this.runAway(); break;
        case 'Escape': this.cancelMode(); break;
        default: break;
      }
    });
  }

  onPointerMove(pointer) {
    const cell = this.view.cellAt(pointer.worldX, pointer.worldY);
    const g = this.hoverGraphics;
    g.clear();

    if (!cell || this.popover) {
      if (!this.tooltip.container.visible || this.hoverUnit) this.tooltip.hide();
      this.hoverUnit = null;
      return;
    }

    g.lineStyle(2.5, 0xffffff, 0.75).strokePoints(this.view.cellQuad(cell.x, cell.y, 0.05), true);

    const unit = this.unitAt(cell.x, cell.y);
    if (unit && unit !== this.hoverUnit) {
      this.hoverUnit = unit;
      this.showUnitTip(unit);
    } else if (!unit && this.hoverUnit) {
      this.hoverUnit = null;
      this.tooltip.hide();
    }
  }

  showUnitTip(unit) {
    const monster = unit.monster;
    const element = normalizeElement(monster?.element);
    const lines = [
      `${ELEMENT_LABELS[element] ?? 'Neutrální'} · úroveň ${monster?.level ?? '?'}`,
      `HP ${unit.hp} / ${unit.maxHp} · Tempo ${unit.speed}`
    ];

    if (unit.side === 'enemy' && this.isPlayerActing()) {
      const reach = this.skillsReaching(this.currentUnit, unit);
      lines.push(reach.length > 0 ? `V dosahu: ${reach.map((s) => s.name).join(', ')}` : 'Mimo dosah schopností');
    }
    if (unit.side === 'player' && this.isPlayerActing()) {
      lines.push('Klikni: podpůrná kouzla');
    }

    const top = unit.model.y - 175 * unit.model.scale;
    this.tooltip.show(unit.model.x, top, unit.name, lines, unit.side === 'player' ? UI_COLORS.player : UI_COLORS.enemy);
  }

  isPlayerActing() {
    return !this.finished && this.phase === 'units' && this.currentUnit?.side === 'player' && this.mode !== 'busy';
  }

  unitAt(x, y) {
    return this.units.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y) ?? null;
  }

  findEnemyAt(x, y) {
    const unit = this.unitAt(x, y);
    return unit?.side === 'enemy' ? unit : null;
  }

  cancelMode() {
    if (this.popover) {
      this.closePopover();
      return;
    }
    if (this.mode === 'spellTarget' || this.mode === 'capture') {
      this.mode = 'act';
      this.selectedSpell = null;
      this.setHint(this.actHint());
      this.refreshBoard();
      this.refreshActionButtons();
    }
  }

  onCellClicked(x, y) {
    if (this.finished || this.mode === 'busy') return;

    if (this.mode === 'spellTarget') {
      const target = this.findEnemyAt(x, y);
      if (!target) {
        this.log('Klikni na nepřítele v dosahu kouzla.');
        return;
      }
      if (this.grid.distance(SPELL_ORIGIN.x, SPELL_ORIGIN.y, target.x, target.y) > this.selectedSpell.range) {
        this.log('Nepřítel je mimo dosah tohoto kouzla.');
        return;
      }
      this.castSelectedSpell(target);
      return;
    }

    if (!this.isPlayerActing()) return;

    if (this.mode === 'capture') {
      const target = this.findEnemyAt(x, y);
      if (target) this.captureTarget(target);
      else this.log('Klikni na divoké monstrum.');
      return;
    }

    const unit = this.unitAt(x, y);

    if (unit?.side === 'enemy') {
      this.openAttackMenu(unit);
      return;
    }

    if (unit?.side === 'player') {
      this.openSupportMenu(unit);
      return;
    }

    if (!this.currentUnit.movedThisTurn) {
      this.moveTo(x, y);
    }
  }

  // Kliknutí na nepřítele: nabídka útoků – schopnosti monstra a Arionova kouzla.
  // Nic se nepoužije automaticky, volí se až v nabídce.
  openAttackMenu(target) {
    const unit = this.currentUnit;
    const distance = this.grid.distance(unit.x, unit.y, target.x, target.y);
    const entries = [];

    for (const skill of getMonsterSkills(unit.monster).filter(isOffensive)) {
      const range = skill.range ?? 1;
      const inRange = range >= distance;
      const category = CATEGORY[skill.category] ?? CATEGORY.physical;
      entries.push({
        label: skill.name,
        sub: `${category.label} · síla ${skill.power} · dosah ${range} · ${skill.remainingUses}/${skill.maxUses}${inRange ? '' : ' · mimo dosah'}`,
        accent: category.color,
        disabled: !inRange || skill.remainingUses <= 0,
        onClick: () => {
          this.closePopover();
          this.selectedSkill = skill;
          this.useSelectedSkill(target);
        }
      });
    }

    if (this.spellReady) {
      const spellDistance = this.grid.distance(SPELL_ORIGIN.x, SPELL_ORIGIN.y, target.x, target.y);
      for (const spell of this.availableSpells('enemy')) {
        const inRange = spell.range >= spellDistance;
        entries.push({
          label: `${spell.name} (Arion)`,
          sub: `Kouzlo · ${this.spellManaCost(spell)} MP · poškození ${spell.damage}${inRange ? '' : ' · mimo dosah'}`,
          accent: elementColor(spell.school),
          disabled: !inRange || this.state.mp < this.spellManaCost(spell),
          onClick: () => {
            this.closePopover();
            this.selectedSpell = spell;
            this.castSelectedSpell(target);
          }
        });
      }
    }

    const top = target.model.y - 175 * target.model.scale;
    this.openPopover('attack', target.model.x, top, `Útok na: ${target.name}`, entries, UI_COLORS.inRangeAll);
  }

  // Útočné schopnosti, které z pozice jednotky dosáhnou na cíl.
  skillsReaching(unit, target) {
    if (!unit?.monster || !target) return [];
    const distance = this.grid.distance(unit.x, unit.y, target.x, target.y);
    return getMonsterSkills(unit.monster)
      .filter((skill) => isOffensive(skill) && skill.remainingUses > 0 && (skill.range ?? 1) >= distance)
      .sort((a, b) => b.power - a.power);
  }

  offensiveSkills(unit) {
    return getMonsterSkills(unit?.monster).filter((skill) => isOffensive(skill) && skill.remainingUses > 0);
  }

  // Tlačítko schopnosti na liště jen ukáže (nebo skryje) její dosah na mřížce.
  // Použije se až volbou v nabídce po kliknutí na cíl.
  selectSkill(skill) {
    if (!this.isPlayerActing()) return;
    this.closePopover();
    this.selectedSkill = this.selectedSkill?.id === skill.id ? null : skill;
    this.mode = 'act';

    if (this.selectedSkill) {
      const target = skill.category === 'healing' || skill.category === 'buff' ? 'na své monstrum' : 'na nepřítele';
      this.setHint(`${skill.name}: dosah ${skill.range ?? 1}. Použiješ ji kliknutím ${target}.`);
    } else {
      this.setHint(this.actHint());
    }
    this.refreshBoard();
    this.refreshActionButtons();
  }

  actHint() {
    const unit = this.currentUnit;
    if (!unit) return '';
    const anyReach = this.units.some((other) => other.side === 'enemy' && other.hp > 0 && this.skillsReaching(unit, other).length > 0);
    return anyReach
      ? 'Klikni na nepřítele a vyber útok, nebo na tyrkysové pole pro pohyb. Pohyb i útok ukončí tah.'
      : 'Nikdo není v dosahu – klikni na tyrkysové pole pro pohyb (ukončí tah), nebo Čekat = přeskočit tah.';
  }

  moveTo(x, y) {
    const destination = this.grid.getReachable(this.currentUnit, this.units).find((cell) => cell.x === x && cell.y === y);

    if (!destination || destination.distance === 0) {
      this.log('Na toto pole se monstrum nedostane.');
      return;
    }

    // Pohyb ukončí tah.
    this.closePopover();
    this.currentUnit.x = x;
    this.currentUnit.y = y;
    this.currentUnit.movedThisTurn = true;
    this.mode = 'busy';
    this.placeUnit(this.currentUnit, true, 300);
    this.refreshBoard();
    this.refreshActionButtons();
    this.log(`${this.currentUnit.name} se přesunul.`);
    this.time.delayedCall(420, () => this.endTurn());
  }

  // ======================================================= zvýraznění pole

  refreshBoard() {
    if (!this.highlight) return;
    const g = this.highlight;
    g.clear();

    const unit = this.currentUnit;
    const fillCell = (x, y, color, alpha, lineAlpha = 0, inset = 0.06) => {
      const quad = this.view.cellQuad(x, y, inset);
      g.fillStyle(color, alpha).fillPoints(quad, true);
      if (lineAlpha > 0) g.lineStyle(2, color, lineAlpha).strokePoints(quad, true);
    };
    const glowUnit = (target, color, strong) => {
      const center = this.view.cellCenter(target.x, target.y);
      const scale = this.view.scaleAt(target.y + 0.5) * MODEL_SCALE;
      g.fillStyle(color, strong ? 0.28 : 0.18).fillEllipse(center.x, center.y, 136 * scale, 44 * scale);
      g.lineStyle(strong ? 4 : 3, color, 0.95).strokeEllipse(center.x, center.y, 128 * scale, 40 * scale);
    };

    if (this.mode === 'spellTarget' && this.selectedSpell) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLUMNS; x++) {
          if (this.grid.distance(SPELL_ORIGIN.x, SPELL_ORIGIN.y, x, y) <= this.selectedSpell.range) {
            fillCell(x, y, UI_COLORS.skillRange, 0.07);
          }
        }
      }
      for (const enemy of this.units.filter((u) => u.side === 'enemy' && u.hp > 0)) {
        const inRange = this.grid.distance(SPELL_ORIGIN.x, SPELL_ORIGIN.y, enemy.x, enemy.y) <= this.selectedSpell.range;
        if (inRange) {
          fillCell(enemy.x, enemy.y, 0xb48cff, 0.3, 0.9);
          glowUnit(enemy, 0xb48cff, true);
        }
      }
      return;
    }

    if (!unit || unit.hp <= 0) return;

    // Aktuální jednotka.
    fillCell(unit.x, unit.y, 0xffd98a, 0.16, 0.9, 0.03);

    if (unit.side !== 'player' || this.phase !== 'units') return;

    if (this.mode === 'capture') {
      for (const enemy of this.units.filter((u) => u.side === 'enemy' && u.hp > 0)) {
        fillCell(enemy.x, enemy.y, 0xffd27a, 0.3, 0.9);
        glowUnit(enemy, 0xffd27a, true);
      }
      return;
    }

    // Dosah pohybu.
    if (!unit.movedThisTurn && this.mode !== 'busy') {
      for (const cell of this.grid.getReachable(unit, this.units)) {
        if (cell.distance === 0) continue;
        fillCell(cell.x, cell.y, UI_COLORS.move, 0.2, 0.55);
      }
    }

    // Dosah vybrané (nebo právě prohlížené) schopnosti.
    const shown = this.previewSkill ?? this.selectedSkill;
    if (shown) {
      const range = shown.range ?? 1;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLUMNS; x++) {
          const d = this.grid.distance(unit.x, unit.y, x, y);
          if (d > 0 && d <= range) fillCell(x, y, UI_COLORS.skillRange, this.previewSkill ? 0.12 : 0.06, 0, 0.1);
        }
      }
    }

    // Nepřátelé: v dosahu všech útočných schopností / jen některých.
    const offensive = this.offensiveSkills(unit);
    for (const enemy of this.units.filter((u) => u.side === 'enemy' && u.hp > 0)) {
      const reach = this.skillsReaching(unit, enemy).length;
      if (reach === 0) continue;
      const color = reach === offensive.length ? UI_COLORS.inRangeAll : UI_COLORS.inRangeSome;
      fillCell(enemy.x, enemy.y, color, 0.3, 0.95);
      glowUnit(enemy, color, true);
    }

    // Spojenci v dosahu léčivé schopnosti.
    if (this.selectedSkill?.category === 'healing') {
      for (const ally of this.units.filter((u) => u.side === 'player' && u.hp > 0)) {
        if (this.grid.distance(unit.x, unit.y, ally.x, ally.y) <= (this.selectedSkill.range ?? 1)) {
          glowUnit(ally, UI_COLORS.support, false);
        }
      }
    }
  }

  // ============================================================ popovery

  closePopover() {
    if (!this.popover) return;
    this.popover.container.destroy();
    this.popover = null;
    this.refreshActionButtons();
  }

  openPopover(kind, x, y, title, entries, accent) {
    this.closePopover();
    this.tooltip.hide();

    // Víc než 6 položek → dva sloupce, ať nabídka nepřeroste obrazovku.
    const columns = entries.length > 6 ? 2 : 1;
    const columnW = 360;
    const width = columns * columnW + (columns - 1) * 8;
    const rowH = 64;
    const rowsCount = Math.max(1, Math.ceil(entries.length / columns));
    const height = 54 + rowsCount * (rowH + 8);
    const px = Phaser.Math.Clamp(x - width / 2, 16, 1920 - width - 16);
    const py = Phaser.Math.Clamp(y - height, 16, 1080 - height - 16);

    const container = this.add.container(px, py).setDepth(DEPTH.popover);
    const bg = this.add.graphics();
    drawGlass(bg, 0, 0, width, height, { edge: accent, edgeAlpha: 0.75, alpha: 0.94, radius: 16 });
    container.add(bg);
    container.add(uiText(this, 18, 14, title, { size: 18, bold: true, color: UI_COLORS.gold }));

    if (entries.length === 0) {
      container.add(uiText(this, 18, 56, 'Nic k dispozici.', { size: 16, color: UI_COLORS.muted }));
    }

    entries.forEach((entry, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const button = new BattleButton(this, 14 + column * (columnW + 8), 48 + row * (rowH + 8), columnW - 28, rowH, {
        label: entry.label,
        sub: entry.sub,
        accent: entry.accent ?? accent,
        titleSize: 17,
        onClick: () => entry.onClick()
      });
      button.setDisabled(Boolean(entry.disabled));
      container.add(button.container);
    });

    // Ztlumení zbytku: klik mimo popover ho zavře (řeší pointerdown scény).
    this.popover = { kind, container };
    this.refreshActionButtons();
  }

  availableSpells(targetType) {
    return spellRows.filter(
      (spell) =>
        (spell.targetType ?? 'enemy') === targetType &&
        this.state.spellbook.includes(spell.id) &&
        this.state.magicMastery?.[spell.school]?.unlocked !== false && // zamčená škola
        (this.state.magicMastery?.[spell.school]?.level ?? 0) >= (spell.requiredMastery ?? 0)
    );
  }

  toggleSpellMenu() {
    if (this.popover?.kind === 'spells') {
      this.closePopover();
      return;
    }
    if (!this.isPlayerActing()) return;
    if (!this.spellReady) {
      this.log('Arion už toto kolo kouzlil. Kouzla se obnoví po tazích tvých monster.');
      return;
    }

    const entries = this.availableSpells('enemy').map((spell) => ({
      label: spell.name,
      sub: `${this.spellManaCost(spell)} MP · dosah ${spell.range} · poškození ${spell.damage}`,
      accent: elementColor(spell.school),
      disabled: this.state.mp < this.spellManaCost(spell),
      onClick: () => this.selectBattleSpell(spell)
    }));

    const anchor = this.spellButton.container;
    this.openPopover('spells', anchor.x + 68, anchor.y - 12, 'Útočná kouzla', entries, 0xb48cff);
  }

  selectBattleSpell(spell) {
    if (this.state.mp < this.spellManaCost(spell)) {
      this.log(`Na ${spell.name} nemáš dost many.`);
      return;
    }
    this.closePopover();
    this.selectedSpell = spell;
    this.mode = 'spellTarget';
    this.setHint(`${spell.name}: klikni na nepřítele v dosahu ${spell.range} (Esc zruší).`);
    this.refreshBoard();
    this.refreshActionButtons();
  }

  // Kliknutí na vlastní monstrum: podpůrná kouzla Ariona + léčivé schopnosti.
  openSupportMenu(ally) {
    const entries = [];
    const ready = this.spellReady;

    for (const spell of this.availableSpells('ally')) {
      entries.push({
        label: spell.name,
        sub: `${this.spellManaCost(spell)} MP · ${spell.description}`,
        accent: elementColor(spell.school),
        disabled: !ready || this.state.mp < this.spellManaCost(spell),
        onClick: () => this.castSupportSpell(spell, ally)
      });
    }

    const unit = this.currentUnit;
    for (const skill of getMonsterSkills(unit.monster)) {
      if (skill.remainingUses <= 0) continue;
      const distance = this.grid.distance(unit.x, unit.y, ally.x, ally.y);
      const healing = skill.category === 'healing' && distance <= (skill.range ?? 1);
      const buff = skill.category === 'buff' && ally === unit;
      if (!healing && !buff) continue;
      entries.push({
        label: `${skill.name} (schopnost)`,
        sub: `${CATEGORY[skill.category].label} · ${skill.remainingUses}/${skill.maxUses}`,
        accent: CATEGORY[skill.category].color,
        onClick: () => {
          this.closePopover();
          this.selectedSkill = skill;
          this.useSelectedSkill(ally);
        }
      });
    }

    const top = ally.model.y - 170 * ally.model.scale;
    const title = ready ? `Podpora: ${ally.name}` : `Podpora: ${ally.name} (kouzla po tazích monster)`;
    this.openPopover('support', ally.model.x, top, title, entries, UI_COLORS.support);
  }

  // ============================================================== akce

  wait() {
    if (!this.isPlayerActing()) return;
    this.closePopover();
    this.log(`${this.currentUnit.name} přeskakuje tah.`);
    this.endTurn();
  }

  runAway() {
    if (!this.isPlayerActing()) return;
    this.closePopover();

    if (Phaser.Math.Between(1, 100) <= ESCAPE_CHANCE) {
      this.finished = true;
      this.log('Arion se s monstry stáhl z boje.');
      this.showResult('Útěk', ['Podařilo se uniknout.'], '#bfe2ff');
      this.returnToWorld(1600);
    } else {
      this.log('Útěk se nezdařil!');
      this.showBanner('Útěk se nezdařil', '#ff9b9b');
      this.endTurn();
    }
  }

  chooseCapture() {
    if (!this.isPlayerActing()) return;
    if (getItemCount(this.state, 'basic_crystal') <= 0) {
      this.log('Nemáš žádný Basic Soul Crystal.');
      return;
    }
    this.closePopover();
    this.mode = this.mode === 'capture' ? 'act' : 'capture';
    this.setHint(this.mode === 'capture' ? 'Klikni na divoké monstrum, které chceš ochočit (Esc zruší).' : this.actHint());
    this.refreshBoard();
    this.refreshActionButtons();
  }

  captureTarget(target) {
    const wild = target?.monster;
    if (!wild || target.side !== 'enemy') return;

    if (!removeItem(this.state, 'basic_crystal', 1)) {
      this.log('Nemáš žádný Basic Soul Crystal.');
      return;
    }

    wild.currentHp = target.hp;
    this.mode = 'busy';
    this.refreshBoard();
    this.refreshActionButtons();

    const activeStatus = (target.statusEffects ?? []).find((effect) => effect.remaining > 0);
    const result = tryCaptureMonster(wild, 'basic', activeStatus?.id ?? null);

    this.fxProjectile(this.currentUnit.model, target.model, 0xffd27a, () => {
      this.fxBurst(target.model.x, target.model.y - 70 * target.model.scale, 0xffd27a);

      if (result.success) {
        const destination = addMonsterToCollection(this.state, wild);
        wild.captured = true;
        const where = destination === 'party' ? 'Přidáno do party.' : 'Party je plná – monstrum jde do úschovny.';
        this.log(`${wild.name} se podařilo ochočit! ${where}`);
        const othersAlive = this.units.some((unit) => unit.side === 'enemy' && unit !== target && unit.hp > 0);
        if (othersAlive) {
          // Další nepřátelé bojují dál.
          target.hp = 0;
          this.faintUnit(target);
          floatingText(this, target.model.x, target.model.y - 150 * target.model.scale, 'Ochočeno!', '#ffe3a0', 28);
          this.time.delayedCall(900, () => this.endTurn());
          return;
        }
        this.finished = true;
        target.hp = 0;
        this.faintUnit(target);
        this.showResult('Monstrum ochočeno', [`${wild.name} se přidává k tobě.`, where], '#ffe3a0');
        this.returnToWorld(2600);
      } else {
        this.log(`Ochočení selhalo (${Math.round(result.chance * 100)} %). Krystal se spotřeboval.`);
        floatingText(this, target.model.x, target.model.y - 150 * target.model.scale, 'Zvíře se nenechalo ochočit', '#ffd27a', 26);
        this.time.delayedCall(700, () => this.endTurn());
      }
    });
  }

  useSelectedSkill(target) {
    const skill = this.selectedSkill;
    const attacker = this.currentUnit;
    const monster = attacker?.monster;

    if (!skill || !monster || !target) return;

    if (!consumeSkillUse(monster, skill.id)) {
      this.log('Tuto schopnost už nelze použít.');
      this.selectedSkill = null;
      return;
    }

    this.mode = 'busy';
    this.selectedSkill = null;
    this.refreshBoard();
    this.refreshActionButtons();

    const offensive = isOffensive(skill);
    const precision = Number(monster.stats?.precision) || 80;
    const hitChance = Phaser.Math.Clamp(skill.accuracy + (precision - 80) * 0.005, 0.05, 0.98);

    let message = '';
    let outcome = { type: 'none' };

    if (Math.random() > hitChance) {
      message = `${monster.name} použil ${skill.name}, ale minul.`;
      outcome = { type: 'miss' };
    } else if (offensive) {
      const attackPower = skill.category === 'magical'
        ? Number(attacker.aether ?? monster.stats.aether) || 1
        : Number(attacker.attack) || 1;
      const targetDefense = skill.category === 'magical'
        ? Number(target.resolve ?? target.monster?.stats?.resolve ?? target.defense) || 0
        : Number(target.armor ?? target.monster?.stats?.armor ?? target.defense) || 0;

      const baseDamage = Math.max(1, Math.floor(skill.power + attackPower * 0.5 - targetDefense * 0.5));
      const damageResult = calculateElementalDamage(baseDamage, skill.element, target.monster?.element);
      damageResult.damage = this.applyTalentDamage(damageResult, attacker, target, skill.category);

      target.hp = Math.max(0, target.hp - damageResult.damage);
      if (target.monster) target.monster.currentHp = target.hp;

      message = `${monster.name}: ${skill.name} → ${damageResult.damage} poškození.${damageResult.effectivenessMessage}`;
      outcome = { type: 'damage', amount: damageResult.damage, multiplier: damageResult.multiplier };

      if (skill.statusEffect) {
        const result = applyStatusEffect(target, skill.statusEffect, monster);
        if (result.applied) message += ` Efekt: ${result.name}.`;
        else if (result.resisted) message += ' Cíl efektu odolal.';
      }
    } else if (skill.category === 'healing') {
      const healing = Math.max(1, skill.power);
      target.hp = Math.min(target.maxHp, target.hp + healing);
      if (target.monster) target.monster.currentHp = target.hp;
      message = `${monster.name}: ${skill.name} obnovil ${healing} HP.`;
      outcome = { type: 'heal', amount: healing };
    } else if (skill.category === 'buff') {
      const unitStat = { attack: 'attack', force: 'attack', defense: 'defense', armor: 'defense', aether: 'aether', resolve: 'resolve', tempo: 'speed' }[skill.effect?.stat];
      const amount = Number(skill.effect?.amount) || 0;
      const duration = Math.max(1, Math.floor(Number(skill.effect?.duration) || 1));

      if (unitStat && typeof attacker[unitStat] === 'number') {
        this.addBuff(attacker, skill.id, unitStat, amount, duration);
        message = `${monster.name}: ${skill.name} na ${duration} tahy.`;
      } else {
        message = `${monster.name} použil ${skill.name}.`;
      }
      outcome = { type: 'buff', stat: unitStat };
    }

    if (offensive && !this.hasAttackCharges(monster)) {
      attacker.hp = 0;
      monster.currentHp = 0;
      message += ` ${monster.name} vyčerpal útočné techniky a omdlel.`;
    }

    this.log(message);
    this.fxSkill(attacker, target, skill, outcome, () => {
      if (attacker.hp <= 0) this.faintUnit(attacker);
      if (this.checkOutcome()) return;
      this.time.delayedCall(250, () => this.endTurn());
    });
  }

  // Cena kouzla po slevě z talentů (Šetření manou), nikdy pod 1 MP.
  spellManaCost(spell) {
    return getSpellManaCost(this.state, spell);
  }

  // Úprava poškození schopnosti monstra podle talentů a pasivního bonusu:
  // útočník hráče +% (formace, pasivní bonus, Lovec příležitostí při elementové výhodě),
  // zasažené monstrum hráče −% (Zocelená družina, pasivní bonus). Bonusy stejného
  // typu se nejprve sečtou a použijí najednou.
  applyTalentDamage(damageResult, attacker, target, category) {
    const t = this.talentBonuses;
    const physical = category !== 'magical';
    let multiplier = 1;

    if (attacker?.side === 'player') {
      multiplier += physical ? t.monsterPhysicalDamage : t.monsterMagicalDamage;
      if (damageResult.multiplier > 1) multiplier += t.elementalAdvantageBonus;
    }
    if (target?.side === 'player') {
      multiplier *= 1 - (physical ? t.monsterPhysicalTaken : t.monsterMagicalTaken);
    }

    return Math.max(1, Math.round(damageResult.damage * multiplier));
  }

  addBuff(unit, sourceId, stat, amount, duration) {
    unit.activeBuffs ??= [];
    const existing = unit.activeBuffs.find((buff) => buff.skillId === sourceId && buff.stat === stat);

    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration);
      existing.skipNextEndTurn = true;
    } else {
      unit[stat] += amount;
      unit.activeBuffs.push({ skillId: sourceId, stat, amount, remaining: duration, skipNextEndTurn: true });
    }
  }

  // ============================================================== kouzla

  spellCost(spell) {
    this.state.mp -= this.spellManaCost(spell);
    // Pevná koncentrace / Široké znalosti zvyšují zkušenosti školy.
    const expGain = Math.max(1, Math.round(5 * getMasteryExpMultiplier(this.state, spell.school)));
    const mastery = gainMagicExperience(this.state, spell.school, expGain);
    this.spellReady = false;
    this.actedPlayerIds.clear();

    let note = ` Magie ${spell.school} +${mastery.gained} EXP.`;
    if (mastery.levelsGained > 0) note += ` Škola ${spell.school} dosáhla úrovně ${mastery.level}.`;
    if (mastery.unlockedSpellIds.length > 0) {
      const names = spellRows.filter((entry) => mastery.unlockedSpellIds.includes(entry.id)).map((entry) => entry.name);
      note += ` Odemčeno: ${names.join(', ')}.`;
    }
    return note;
  }

  castSelectedSpell(target) {
    const spell = this.selectedSpell;
    if (!spell || !this.spellReady) return;
    if (this.state.mp < this.spellManaCost(spell)) {
      this.log('Nemáš dost many.');
      return;
    }

    const note = this.spellCost(spell);
    const spellPower = getEffectiveSpellPower(this.state);
    const baseDamage = Math.max(
      1,
      Math.floor((spell.damage + spellPower / 2) * getSpellDamageMultiplier(this.state, spell.school))
    );
    const damageResult = calculateElementalDamage(baseDamage, spell.school, target.monster?.element);

    target.hp = Math.max(0, target.hp - damageResult.damage);
    if (target.monster) target.monster.currentHp = target.hp;

    this.log(`Arion seslal ${spell.name}: ${damageResult.damage} poškození.${damageResult.effectivenessMessage}${note}`);

    const resumeMode = this.mode;
    this.selectedSpell = null;
    this.mode = 'busy';
    this.refreshBoard();
    this.refreshHeroPanel();
    this.refreshActionButtons();

    this.fxCast(target, elementColor(spell.school), () => {
      this.fxHit(target, { type: 'damage', amount: damageResult.damage, multiplier: damageResult.multiplier });
      if (this.checkOutcome()) return;
      this.mode = resumeMode === 'spellTarget' ? 'act' : resumeMode;
      this.setHint(this.actHint());
      this.refreshBoard();
      this.refreshActionButtons();
    });
  }

  castSupportSpell(spell, ally) {
    if (!this.spellReady || this.state.mp < this.spellManaCost(spell)) return;
    this.closePopover();

    const note = this.spellCost(spell);
    const effect = spell.effect ?? {};
    let outcome;
    let message;

    if (effect.type === 'heal') {
      const healing = Math.max(1, Number(effect.amount) || 1);
      ally.hp = Math.min(ally.maxHp, ally.hp + healing);
      if (ally.monster) ally.monster.currentHp = ally.hp;
      outcome = { type: 'heal', amount: healing };
      message = `Arion seslal ${spell.name} na ${ally.name}: +${healing} HP.`;
    } else {
      this.addBuff(ally, spell.id, effect.stat, Number(effect.amount) || 0, Math.max(1, Number(effect.duration) || 1));
      outcome = { type: 'buff', stat: effect.stat };
      message = `Arion seslal ${spell.name} na ${ally.name}.`;
    }

    this.log(message + note);
    this.mode = 'busy';
    this.refreshHeroPanel();
    this.refreshActionButtons();

    this.fxCast(ally, elementColor(spell.school), () => {
      this.fxHit(ally, outcome);
      this.mode = 'act';
      this.setHint(this.actHint());
      this.refreshBoard();
      this.refreshActionButtons();
    });
  }

  // ============================================================ efekty

  fxProjectile(fromModel, toModel, color, onArrive) {
    const from = { x: fromModel.x, y: fromModel.y - 70 * fromModel.scale };
    const to = { x: toModel.x, y: toModel.y - 70 * toModel.scale };
    const orb = this.add.graphics().setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    orb.fillStyle(color, 0.35).fillCircle(0, 0, 22);
    orb.fillStyle(color, 1).fillCircle(0, 0, 11);
    orb.fillStyle(0xffffff, 0.9).fillCircle(0, 0, 5);
    orb.setPosition(from.x, from.y);

    const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    this.tweens.add({
      targets: orb,
      x: to.x,
      y: to.y,
      duration: Phaser.Math.Clamp(distance * 0.55, 220, 560),
      ease: 'Quad.easeIn',
      onComplete: () => {
        orb.destroy();
        onArrive?.();
      }
    });
  }

  fxBurst(x, y, color) {
    const ring = this.add.graphics().setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(6, color, 1).strokeCircle(0, 0, 24);
    ring.setPosition(x, y);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  fxHit(target, outcome) {
    const model = target.model;
    const top = model.y - 150 * model.scale;

    if (outcome.type === 'miss') {
      floatingText(this, model.x, top, 'Minul', '#cfd8e3', 28);
    } else if (outcome.type === 'damage') {
      const strong = outcome.multiplier > 1;
      const weak = outcome.multiplier < 1;
      floatingText(this, model.x, top, `-${outcome.amount}`, strong ? '#ffb347' : weak ? '#c9d3dd' : '#ffffff', strong ? 42 : 34);
      if (strong) floatingText(this, model.x, top - 40, 'Účinné!', '#ffb347', 20);

      const body = model.getData('body');
      this.tweens.add({ targets: body, alpha: 0.25, duration: 70, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: model, x: model.x + 10, duration: 50, yoyo: true, repeat: 3 });
      this.fxBurst(model.x, model.y - 70 * model.scale, 0xffffff);
    } else if (outcome.type === 'heal') {
      floatingText(this, model.x, top, `+${outcome.amount}`, '#6dffa8', 34);
      this.fxBurst(model.x, model.y - 60 * model.scale, 0x6dffa8);
    } else if (outcome.type === 'buff') {
      floatingText(this, model.x, top, `▲ ${statLabel(outcome.stat)}`, '#8fd0ff', 26);
      this.fxBurst(model.x, model.y - 60 * model.scale, 0x59b8ff);
    }

    this.refreshUnitBars(target);
    if (target.hp <= 0) this.faintUnit(target);
  }

  fxSkill(attacker, target, skill, outcome, done) {
    const model = attacker.model;
    const color = elementColor(skill.element);
    const finish = () => {
      this.fxHit(target, outcome);
      this.time.delayedCall(450, done);
    };

    if (target === attacker || !isOffensive(skill) || (skill.range ?? 1) > 1) {
      if (target === attacker) {
        this.fxBurst(model.x, model.y - 60 * model.scale, color);
        this.time.delayedCall(200, finish);
      } else {
        this.fxProjectile(model, target.model, color, finish);
      }
      return;
    }

    // Útok zblízka: výpad k cíli a zpět.
    const dx = (target.model.x - model.x) * 0.35;
    const dy = (target.model.y - model.y) * 0.35;
    this.tweens.add({
      targets: model,
      x: model.x + dx,
      y: model.y + dy,
      duration: 150,
      ease: 'Quad.easeIn',
      yoyo: true,
      onYoyo: () => this.fxHit(target, outcome),
      onComplete: () => {
        this.placeUnit(attacker, false);
        this.refreshUnitBars(attacker);
        this.time.delayedCall(450, done);
      }
    });
  }

  fxCast(target, color, onHit) {
    this.tweens.add({ targets: this.arion, scaleX: this.arion.scaleX * 1.05, duration: 120, yoyo: true });
    this.fxBurst(this.arionHand.x, this.arionHand.y, color);
    this.fxProjectile({ x: this.arionHand.x, y: this.arionHand.y + 70, scale: 1 }, target.model, color, onHit);
  }

  // =========================================================== průběh tahů

  beginTurn() {
    if (this.finished || this.checkOutcome()) return;

    if (!this.turnOrder || this.turnIndex >= this.turnOrder.length) {
      if (this.turnOrder) this.round += 1;
      this.turnOrder = sortByInitiative(this.units);
      this.turnIndex = 0;
      this.actedPlayerIds = new Set();
    }

    this.currentUnit = this.turnOrder[this.turnIndex];

    if (!this.currentUnit) {
      this.turnOrder = null;
      this.beginTurn();
      return;
    }

    if (this.currentUnit.hp <= 0) {
      this.turnIndex += 1;
      this.beginTurn();
      return;
    }

    if (this.currentUnit.monster && !this.hasAttackCharges(this.currentUnit.monster)) {
      this.currentUnit.hp = 0;
      this.currentUnit.monster.currentHp = 0;
      this.log(`${this.currentUnit.name} nemá útočné techniky a omdlévá.`);
      this.faintUnit(this.currentUnit);
      if (this.checkOutcome()) return;
      this.turnIndex += 1;
      this.beginTurn();
      return;
    }

    const statusResult = processStatusEffects(this.currentUnit);
    if (this.currentUnit.monster) this.currentUnit.monster.currentHp = this.currentUnit.hp;
    if (statusResult.messages.length > 0) this.log(statusResult.messages.join(' '));
    this.refreshUnitBars(this.currentUnit);

    if (this.currentUnit.hp <= 0) {
      this.faintUnit(this.currentUnit);
      if (this.checkOutcome()) return;
      this.turnIndex += 1;
      this.beginTurn();
      return;
    }

    this.phase = 'units';
    this.currentUnit.movedThisTurn = false;
    this.mode = this.currentUnit.side === 'player' ? 'act' : 'busy';
    this.closePopover();

    // Žádná schopnost není předvybraná – útok se volí v nabídce po kliknutí na nepřítele.
    this.selectedSkill = null;

    this.refreshTurnOrder();
    this.buildActionBar();
    this.refreshBoard();
    this.refreshHeroPanel();

    const isPlayer = this.currentUnit.side === 'player';
    this.showBanner(isPlayer ? `Na tahu: ${this.currentUnit.name}` : `Nepřítel: ${this.currentUnit.name}`, isPlayer ? '#8ff0ff' : '#ff9aa6');

    if (statusResult.skipped) {
      this.setHint(`${this.currentUnit.name} nemůže jednat.`);
      this.mode = 'busy';
      this.time.delayedCall(800, () => this.endTurn());
      return;
    }

    if (!isPlayer) {
      this.setHint(`${this.currentUnit.name} se chystá k útoku…`);
      this.time.delayedCall(750, () => this.enemyTurn());
    } else {
      this.setHint(this.actHint());
    }
  }

  enemyTurn() {
    if (this.finished || !this.currentUnit) return;

    const unit = this.currentUnit;
    const enemyMonster = unit.monster;
    const availableSkills = getMonsterSkills(enemyMonster)
      .filter((skill) => isOffensive(skill) && skill.remainingUses > 0)
      .sort((a, b) => (Number(b.range) || unit.range) - (Number(a.range) || unit.range) || b.power - a.power);

    if (availableSkills.length === 0) {
      unit.hp = 0;
      if (enemyMonster) enemyMonster.currentHp = 0;
      this.log(`${unit.name} vyčerpal útočné techniky a omdlel.`);
      this.faintUnit(unit);
      if (this.checkOutcome()) return;
      this.time.delayedCall(500, () => this.endTurn());
      return;
    }

    const target = chooseAITarget(unit, this.units);
    if (!target) {
      this.checkOutcome();
      return;
    }

    const skill = availableSkills[0];
    const skillRange = Number(skill.range) || unit.range || 1;
    const act = () => {
      const distance = this.grid.distance(unit.x, unit.y, target.x, target.y);
      if (distance <= skillRange) {
        this.selectedSkill = skill;
        this.useSelectedSkill(target);
      } else {
        this.log(`${unit.name} se nedostal do dosahu své techniky.`);
        this.time.delayedCall(400, () => this.endTurn());
      }
    };

    if (this.grid.distance(unit.x, unit.y, target.x, target.y) > skillRange) {
      const destination = chooseAIMove(unit, target, this.units, this.grid);
      if (destination) {
        unit.x = destination.x;
        unit.y = destination.y;
        this.placeUnit(unit, true, 380);
        this.refreshBoard();
        this.time.delayedCall(450, act);
        return;
      }
    }

    act();
  }

  endTurn() {
    if (this.finished || this.phase !== 'units') return;

    const unitEndingTurn = this.currentUnit;

    if (unitEndingTurn?.activeBuffs?.length > 0) {
      for (const buff of unitEndingTurn.activeBuffs) {
        if (buff.skipNextEndTurn) {
          buff.skipNextEndTurn = false;
          continue;
        }
        buff.remaining -= 1;
        if (buff.remaining <= 0 && typeof unitEndingTurn[buff.stat] === 'number') {
          unitEndingTurn[buff.stat] -= buff.amount;
        }
      }
      unitEndingTurn.activeBuffs = unitEndingTurn.activeBuffs.filter((buff) => buff.remaining > 0);
      this.refreshUnitBars(unitEndingTurn);
    }

    if (unitEndingTurn?.side === 'player') {
      this.actedPlayerIds.add(unitEndingTurn.id);
      const living = this.units.filter((unit) => unit.side === 'player' && unit.hp > 0);
      if (living.length > 0 && living.every((unit) => this.actedPlayerIds.has(unit.id))) {
        if (!this.spellReady) {
          this.spellReady = true;
          this.log('Arionova kouzla jsou znovu připravena.');
        }
        this.actedPlayerIds.clear();
        this.refreshHeroPanel();
      }
    }

    this.turnIndex += 1;
    this.beginTurn();
  }

  checkOutcome() {
    if (this.finished) return true;

    const playersAlive = this.units.some((unit) => unit.side === 'player' && unit.hp > 0);
    const enemiesAlive = this.units.some((unit) => unit.side === 'enemy' && unit.hp > 0);

    if (!enemiesAlive) {
      this.winBattle();
      return true;
    }
    if (!playersAlive) {
      this.loseBattle();
      return true;
    }
    return false;
  }

  // ============================================================== konec

  winBattle() {
    if (this.finished) return;
    this.finished = true;
    this.mode = 'busy';
    this.refreshActionButtons();

    // Odměna roste s počtem divokých monster. Peníze hrdina nezíská – jen materiály (drop).
    const enemyCount = Math.max(1, this.wildMonsters?.length ?? 1);
    const reward = 18 + 10 * (enemyCount - 1);
    const lines = [`${this.state.playerName ?? 'Arion'}: +${reward} EXP`];
    this.state.exp += reward;

    const loot = {};
    for (const wild of this.wildMonsters ?? []) {
      if (wild.captured) continue;
      for (const drop of rollDrops(wild.speciesId)) loot[drop.id] = (loot[drop.id] ?? 0) + drop.qty;
    }
    const gained = [];
    let lost = 0;
    for (const [id, qty] of Object.entries(loot)) {
      const left = addItem(this.state, id, qty);
      if (qty - left > 0) gained.push(`${getItem(id)?.name ?? id}${qty - left > 1 ? ` ×${qty - left}` : ''}`);
      lost += left;
    }
    lines.push(gained.length ? `Získáno: ${gained.join(', ')}` : 'Žádný materiál.');
    if (lost > 0) lines.push('Inventář je plný – část materiálu zůstala na bojišti.');

    if (this.isBoss) {
      this.state.flags ??= {};
      this.state.flags.greenvaleCaveBossDefeated = true;
      lines.push('Jeskynní sliz je mrtvý. Vrať se za starostou Edricem na radnici.');
    }

    for (const wild of this.wildMonsters ?? []) {
      if (wild.captured) continue;
      const record = this.state.bestiary[wild.speciesId] ?? { seen: 1, caught: 0, defeated: 0 };
      record.defeated += 1;
      this.state.bestiary[wild.speciesId] = record;
    }

    for (const monster of this.state.party ?? []) {
      const oldLevel = monster.level;
      const experienceResult = gainMonsterExperience(monster, reward);
      if (experienceResult.levelsGained > 0) lines.push(`${monster.name} dosáhlo úrovně ${monster.level}`);

      for (let level = oldLevel + 1; level <= monster.level; level++) {
        for (const skillId of getSkillsLearnedAtLevel(monster.speciesId, level, monster.element)) {
          const result = learnSkill(monster, skillId);
          if (result.success) lines.push(`${monster.name} se naučilo ${result.skill.name}`);
        }
      }

      const bondResult = rewardBondForVictory(monster);
      if (bondResult.levelUp) lines.push(`Důvěra: ${monster.name} je nyní ${bondResult.newLevel}`);
      if (bondResult.bondSkillResult?.success) lines.push(`${monster.name} získalo schopnost ${bondResult.bondSkillResult.skill.name}`);

      const freePoints = Math.max(0, Math.min(100, Math.floor(Number(monster.unspentTrainingPoints) || 0)));
      if (freePoints < 100) monster.unspentTrainingPoints = freePoints + 1;
    }
    lines.push('Monstra v partě: +1 tréninkový bod, +2 důvěra');

    while (this.state.exp >= this.state.level * 20) {
      this.state.exp -= this.state.level * 20;
      this.state.level += 1;
      applyHeroLevelUp(this.state);
      lines.push(`Arion postoupil na úroveň ${this.state.level}!`);
    }

    this.log('Vítězství!');
    this.showResult('Vítězství', lines, '#ffe3a0');
    this.returnToWorld(4200);
  }

  loseBattle() {
    if (this.finished) return;
    this.finished = true;
    this.mode = 'busy';
    this.refreshActionButtons();
    this.state.hp = 1;

    this.log('Tvoje monstra padla.');
    this.showResult('Porážka', ['Tvoje monstra padla.', 'Arion ustoupil do bezpečí. Liora je vyléčí.'], '#ff9aa6');
    this.returnToWorld(3200);
  }

  showResult(title, lines, color) {
    this.closePopover();
    this.tooltip.hide();
    this.setHint('');
    this.highlight.clear();
    this.refreshActionButtons();

    const layer = this.add.container(0, 0).setDepth(DEPTH.popover + 100);
    const shade = this.add.rectangle(0, 0, 1920, 1080, 0x02060a, 0.55).setOrigin(0);
    const width = 640;
    const height = 150 + lines.length * 30 + 70;
    const x = 960 - width / 2;
    const y = 470 - height / 2;
    const bg = this.add.graphics();
    drawGlass(bg, x, y, width, height, { edge: 0xffd98a, edgeAlpha: 0.7, alpha: 0.92, radius: 22 });

    const heading = uiText(this, 960, y + 34, title, { size: 52, bold: true, color, originX: 0.5, stroke: '#05080c', strokeThickness: 6 });
    const body = lines.map((line, index) =>
      uiText(this, 960, y + 120 + index * 30, line, { size: 19, originX: 0.5, color: UI_COLORS.text })
    );
    const button = new BattleButton(this, 960 - 110, y + height - 84, 220, 60, {
      label: 'Pokračovat',
      accent: 0xffd98a,
      onClick: () => this.returnToWorld(0, true)
    });

    layer.add([shade, bg, heading, ...body, button.container]);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 300 });
  }

  returnToWorld(delay = 0, immediate = false) {
    if (this.returning && !immediate) return;
    if (this.leaving) return;
    this.returning = true;

    const finish = () => {
      if (this.leaving) return;
      this.leaving = true;
      for (const unit of this.units ?? []) {
        if (unit.monster) unit.monster.currentHp = unit.hp;
      }
      SaveSystem.save(this.state);
      this.cameras.main.fadeOut(350, 4, 8, 12);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', { state: this.state }));
    };

    if (delay > 0) this.time.delayedCall(delay, finish);
    else finish();
  }
}

function statLabel(stat) {
  return { attack: 'Síla', defense: 'Zbroj', aether: 'Magie', resolve: 'Vůle', speed: 'Tempo' }[stat] ?? stat;
}
