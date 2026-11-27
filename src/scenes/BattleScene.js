import { REST_POINTS, restoreParty } from './InteriorScene.js';
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
import { calculateElementalDamage, levelDamageMultiplier } from '../battle/DamageCalculator.js';
import { chooseAITarget, chooseAIMove } from '../battle/BattleAI.js';
import BoardProjection from '../battle/BoardProjection.js';
import { openLoot } from './LootScene.js';
import { mealBuff, applyMealAfterBattle } from '../systems/CookingSystem.js';
import { countQuestEvent } from '../systems/QuestCounters.js';
import { gearBonus, gearResist, gearElementDamage, applyReinforcementAfterBattle } from '../systems/SmithingSystem.js';
import { elixirBuff, activeGuard, applyAlchemyAfterBattle, applyLastingInBattle, exploreBonus, STAT_STACK_CAP, potionEffect } from '../systems/AlchemySystem.js';
import { ALCHEMY_BY_ID, describeAlchemy } from '../data/alchemy.js';
import BattleViewTuner from '../battle/BattleViewTuner.js';
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
import { markQuestObjective, QUESTS, QUEST_STATUS, getQuestStatus } from '../systems/QuestSystem.js';
import { cardText, cardButton, nineImage } from '../ui/fantasyCard.js';
import { askName } from '../ui/nameInput.js';
import { estimateBattle, runSimulation, applySimulationResult, SIMULATION_HANDICAP, SIMULATION_REWARD } from '../systems/BattleSimulationSystem.js';
import { gainMagicExperience, unlockMagicSchool, isMagicSchoolUnlocked } from '../systems/MagicMasterySystem.js';
import {
  rewardBondForVictory,
  getMonsterBondBonuses
} from '../systems/MonsterBondSystem.js';
import {
  getStarterSkillId,
  getSkillsLearnedAtLevel,
  getSignatureSkillId,
  SIGNATURE_LEVEL,
  learnSkill,
  getMonsterSkills,
  consumeSkillUse
} from '../systems/MonsterSkillSystem.js';
import {
  MONSTER_SPECIES,
  createMonster,
  gainMonsterExperience,
  experienceToNextLevel,
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
import { monsterStillKey } from '../battle/monsterAnimations.js';
import { timePhase } from '../systems/TimeSystem.js';
import { critChance, BASE_CRIT_CHANCE, CRIT_MULTIPLIER, lootMultiplier, luckRareBonus, charismaTameBonus } from '../systems/HeroStatsSystem.js';

// Soul Crystaly od nejsilnějšího (Řemeslnictví). Dragon Soul Crystal jen na prastaré draky.
const SOUL_CRYSTALS = [
  { id: 'dragon_crystal', type: 'dragonSoul', name: 'Dragon Soul Crystal' },
  { id: 'ancient_crystal', type: 'ancient', name: 'Ancient Soul Crystal' },
  { id: 'elemental_crystal', type: 'elemental', name: 'Elemental Soul Crystal' },
  { id: 'greater_crystal', type: 'greater', name: 'Greater Soul Crystal' },
  { id: 'basic_crystal', type: 'basic', name: 'Basic Soul Crystal' }
];
const isAncientDragon = (monster) => MONSTER_SPECIES.find((s) => s.id === monster?.speciesId)?.category === 'ancientDragon';

// Souboj: tahový boj na mřížce 10 × 8 v perspektivním pohledu.
// Herní pravidla (poškození, schopnosti, AI, ochočení, odměny) jsou převzatá
// z původní scény; nové je vykreslení, ovládání a zvýrazňování dosahu.

// Počet divokých monster v náhodném setkání podle oblasti [min, max].
const ENCOUNTER_SIZE = { Greenvale: [1, 3], default: [1, 5] };
// Počáteční oblast: váhy počtu monster 1 / 2 / 3 = 60 : 25 : 10 (přepočteno na 100 %).
const ENCOUNTER_WEIGHTS = { Greenvale: [60, 25, 10] };
// EXP za vítězství: 18 za monstrum, za každé další monstrum ve skupině +30 % celku.
const XP_PER_MONSTER = 18;
const XP_GROUP_BONUS = 0.3;
export const battleXp = (count) => Math.round(XP_PER_MONSTER * count * (1 + XP_GROUP_BONUS * (count - 1)));
// Startovní pole nepřátel (nejvýš 5).
const ENEMY_POSITIONS = [{ x: 8, y: 3 }, { x: 8, y: 5 }, { x: 9, y: 1 }, { x: 9, y: 6 }, { x: 7, y: 7 }];

// Pohled na bojiště: souboj z boku (hráč vlevo, nepřátelé vpravo), kamera šikmo shora.
// topY/bottomY = vzdálená/blízká hrana desky, depthRatio = zkrácení vzdálených řad
// (1 = bez zkrácení), gridAlpha/gridWidth = viditelnost mřížky.
const BATTLE_VIEW = {
  centerX: 960,
  topY: 150,
  bottomY: 960,
  nearHalfWidth: 680,
  depthRatio: 1.04,
  modelScale: 1.22,
  gridAlpha: 0,
  gridWidth: 0.5
};
const BATTLE_VIEW_DEFAULTS = { ...BATTLE_VIEW };

const ACTION_W = 118; // šířka tlačítek akcí (Kouzla, Předmět, Ochočení, Čekat, Útěk)
const COLUMNS = 10;
const ROWS = 8;
const ESCAPE_CHANCE = 70;
const SPELL_ORIGIN = { x: 0, y: 3 };
// Velikost modelů monster vůči poli (1 = model 118 px široký v nejbližší řadě).

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

// Názvy živelných efektů kouzel (popisek v knize kouzel).
const SPELL_STATUS_NAMES = { burn: 'spálení', freeze: 'zmrazení', stun: 'omráčení', paralysis: 'paralýza', curse: 'prokletí', poison: 'otrava' };

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
// Fyzické schopnosti mají vždy dosah 1 pole (zblízka). Magické (útoky na dálku) se použijí na cíl
// kdekoli na bojišti: do 5 polí plné poškození, dál postih −70 %. Kouzla hrdiny bez postihu i omezení.
const RANGED_FULL_RANGE = 5;
const RANGED_FAR_MULTIPLIER = 0.3;
// Fyzický útok divokých monster = podíl jejich Síly (dřív 0,4 – vlk dostával malé zásahy
// a monstrum o 2 úrovně silnější šlo porazit bez potíží). Kouzla nepřátel berou plnou Magii.
const ENEMY_ATTACK_SHARE = 0.8;
// Magické útoky (kouzla monster): monstrum se nehne a kouzlí z místa. Plné poškození do
// 5 polí + 1 pole za každých 8 bodů Přesnosti nad 80; dál −70 %. Přesnost u kouzel nezvyšuje
// šanci na zásah (ta je jen podle kouzla), jen dosah bez postihu.
const PRECISION_PER_TILE = 8;
const precisionOf = (unit) => Number(unit?.monster?.stats?.precision) || 80;
const rangedFullRange = (unit) => RANGED_FULL_RANGE + Math.max(0, Math.floor((precisionOf(unit) - 80) / PRECISION_PER_TILE));
const isRangedSkill = (skill) => isOffensive(skill) && skill.category === 'magical';
const MELEE_RANGE = 1;
// Monstra navíc v setkáních oblasti (mimo vlastní region druhu). Air Elemental v Greenvale
// je jen jednou – v úvodním úkolu (tutoriál souboje), v běžných setkáních ne.
const EXTRA_ENCOUNTER_SPECIES = {};
const NO_RANDOM_SPECIES = new Set(['air_elemental']);
// Noční vzácná monstra: šance na setkání v noci (23:00–05:00) a pořadí vzácnosti.
const NIGHT_RARE_CHANCE = 0.15;
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
// Tutoriál souboje (úvodní úkol Krotitelova zkouška): texty Mága podle kroku.
// Pauza mezi kroky tutoriálu, než se ukáže zatmavení s rámečkem a textem Mága.
const TUTORIAL_PAUSE_MS = 650;
// Zkušený hráč: když další krok udělá do TUTORIAL_FAST_MS od zvýraznění (nebo dřív, než se
// zvýraznění ukáže), tutoriál zrychlí – bez pauzy, kratší přechod a slabší ztmavení.
const TUTORIAL_FAST_MS = 1800;
const TUTORIAL_TEXT = {
  attack: 'Tvůj Dire Wolf je na tahu. Klikni na Air Elementala a vyber útok – vlk k němu sám doběhne a zaútočí.',
  wait: 'Air Elemental krouží a vyčkává. Počkej, až bude tvůj vlk znovu na tahu.',
  spell: 'Vlk zasáhl a kousnutí způsobilo krvácení (KRV): každé kolo ubere Air Elementalovi kus HP, stavy uvidíš pod jeho životy. Teď ty: klikni na Kouzla (Q), vyber kouzlo Vzduchu a pak klikni na Air Elementala.',
  capture: 'Je oslabený! Teď klikni na Ochočení (C) dole a pak na Air Elementala. Soul Crystal ho získá.',
  done: 'Krystal zazářil – Air Elemental je tvůj. Přenesu tě zpět do Hvězdárny.'
};
// Krátké texty pro zkušeného hráče (tutorialFast) – stejný obsah, méně čtení.
const TUTORIAL_TEXT_SHORT = {
  attack: 'Zaútoč vlkem na Air Elementala.',
  wait: 'Počkej na tah vlka.',
  spell: 'Krvácení (KRV) mu každé kolo ubírá HP. Teď kouzlo Vzduchu (Q) na Air Elementala.',
  capture: 'Je oslabený – Ochočení (C) a klik na něj.',
  done: 'Air Elemental je tvůj. Přenesu tě do Hvězdárny.'
};
const SCHOOL_NAMES = { air: 'Vzduch', water: 'Voda', fire: 'Oheň', earth: 'Země', light: 'Světlo', dark: 'Temnota' };
const SCHOOL_ORDER = ['air', 'water', 'fire', 'earth', 'light', 'dark'];

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // ================================================================ start

  create(data) {
    this.state = data?.state ?? SaveSystem.load();
    this.encounter = data?.encounter ?? null;
    this.simple = false; // souboj bez mřížky (volba před bojem)

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    // Úkol Nový společník: na Skalní stráni se došlé Mágovy krystaly doplní (úkol nejde zablokovat).
    this.mageCrystalRefill = 0;
    if (this.mageCrystalHere() && getItemCount(this.state, 'mage_crystal') <= 0) {
      this.mageCrystalRefill = this.mageCrystalQuest().mageCrystal.qty;
      addItem(this.state, 'mage_crystal', this.mageCrystalRefill);
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
    this.defeated = false; // jinak se po první porážce každý další boj vyhodnotí jako prohra
    this.returning = false;
    this.leaving = false;
    this.popover = null;
    this.preBattle = false;
    this.preBattleLayer = null;
    this.hoverUnit = null;
    this.previewSkill = null;
    this.currentUnit = null;
    this.selectedSkill = null;
    this.selectedSpell = null;
    this.spellReady = true;
    this.logLines = this.mageCrystalRefill ? [`Mág ti doplnil Mágovy krystaly (×${this.mageCrystalRefill}) – platí jen tady na Skalní stráni.`] : [];
    this.capturedHp = new Map();
    this.namingMonster = false;

    this.state.party ??= [];
    normalizeInventory(this.state);
    this.state.bestiary ??= {};
    this.state.spellbook ??= [];
    this.state.magicMastery ??= {};

    // Účinky talentů a pasivního bonusu specializace (TalentSystem).
    this.talentBonuses = getTalentBonuses(this.state);
    this.createWildMonsters();
    // Bonus Max. many z jídla (jen po dobu souboje).
    this.mealMaxMp = Math.round((Number(this.state.maxMp) || 0) * this.consumableBuff('maxMp') / 100);
    if (this.mealMaxMp) this.state.maxMp += this.mealMaxMp;
    this.units = [...this.createPartyUnits(), ...this.createEnemyUnits()];
    // HP party na začátku souboje – pro přehled utrženého po boji.
    this.startHp = new Map((this.state.party ?? []).map((m) => [m, Math.max(0, Number(m.currentHp) || 0)]));
    this.resultOpen = false;

    this.view = new BoardProjection({
      columns: COLUMNS,
      rows: ROWS,
      ...BATTLE_VIEW
    });

    this.createBackdrop(data?.backdrop ?? this.encounter?.backdrop ?? DEFAULT_BACKDROP);
    // Scéna se znovu používá – staré (už zničené) objekty z minulého souboje zapomenout.
    this.boardGraphics = null;
    this.highlight = null;
    this.hoverGraphics = null;
    this.obstacleObjects = null;
    this.drawBoard();
    this.createObstacles();
    this.createUnitModels();
    this.createArion();
    this.createHud();
    this.setupInput();

    this.cameras.main.fadeIn(450, 4, 8, 12);
    // Před bojem panel: Bojovat / Simulovat / Útěk (BattleSimulationSystem).
    this.time.delayedCall(350, () => this.openPreBattle());
  }

  // Divoká monstra souboje. Náhodné setkání: počet podle oblasti (systém umí 1–5,
  // začáteční Greenvale zatím 1–3). Boss Orčí válečník má s sebou 2 gobliny 5. úrovně,
  // tutoriál (úvodní úkol) jediného Air Elementala.
  createWildMonsters() {
    const currentRegion = this.state.region || 'Greenvale';
    const playerLevel = Number(this.state.level) || 1;
    this.isBoss = this.encounter?.type === 'greenvale_cave_boss';
    this.tutorial = this.encounter?.type === 'tutorial_air';
    this.tutorialStep = this.tutorial ? 'attack' : null;
    // Zrychlení pro zkušeného hráče se počítá v každém souboji znovu (scéna se používá opakovaně).
    this.tutorialFast = false;
    this.spotlightSig = '';
    this.spotlightReadyAt = 0;
    // Scéna se znovu používá – světelný bod tutoriálu se vytvoří znovu.
    this.spotlightSig = null;
    this.spotlightShade = null;
    this.spotlightRing = null;
    this.spotlightTween = null;
    this.wildMonsters = [];

    if (this.tutorial) {
      // Jediný Air Elemental (úvodní úkol): jeden zásah a jisté ochočení.
      this.wildMonsters.push(createMonster('air_elemental', 5)); // úroveň 5 – stejná jako startovní Dire Wolf
    } else if (this.isBoss) {
      // Úkol Orčí hrozba: boss Orc Warrior se dvěma gobliny (bez simulace a ochočení).
      const bossLevel = Math.max(3, Math.min(10, playerLevel + 2));
      const orc = createMonster('orc_warrior', bossLevel);
      orc.name = 'Orčí válečník';
      orc.isBoss = true;
      this.wildMonsters.push(orc, createMonster('goblin', 5), createMonster('goblin', 5));
    } else {
      let availableSpecies = MONSTER_SPECIES.filter(
        (species) => species.region === currentRegion && species.rarity !== 'rare' && !NO_RANDOM_SPECIES.has(species.id)
      );
      if (availableSpecies.length === 0) {
        availableSpecies = MONSTER_SPECIES.filter((species) => species.rarity === 'common');
      }
      for (const id of EXTRA_ENCOUNTER_SPECIES[currentRegion] ?? []) {
        const extra = MONSTER_SPECIES.find((species) => species.id === id);
        if (extra && !availableSpecies.includes(extra)) availableSpecies = [...availableSpecies, extra];
      }

      const [min, max] = this.encounter?.count
        ? [this.encounter.count, this.encounter.count]
        : ENCOUNTER_SIZE[currentRegion] ?? ENCOUNTER_SIZE.default;
      const weights = !this.encounter?.count && ENCOUNTER_WEIGHTS[currentRegion];
      let rolled = Phaser.Math.Between(min, max);
      if (weights) {
        let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
        rolled = weights.findIndex((w) => (roll -= w) < 0) + 1 || 1;
      }
      const count = Phaser.Math.Clamp(rolled, 1, ENEMY_POSITIONS.length);
      // Louka setkání (WorldScene → encounter.zone): její druhy a pevný rozsah úrovní.
      const zone = this.encounter?.zone;
      const zoneSpecies = (zone?.species ?? []).filter((id) => MONSTER_SPECIES.some((s) => s.id === id));
      for (let i = 0; i < count; i++) {
        if (zoneSpecies.length) {
          const [min, max] = zone.level ?? [playerLevel, playerLevel];
          this.wildMonsters.push(createMonster(zoneSpecies[Phaser.Math.Between(0, zoneSpecies.length - 1)], Phaser.Math.Between(min, max)));
          continue;
        }
        const chosenSpecies = availableSpecies[Phaser.Math.Between(0, availableSpecies.length - 1)];
        this.wildMonsters.push(createMonster(chosenSpecies.id, Math.max(1, playerLevel)));
      }
      // Noc: se šancí NIGHT_RARE_CHANCE nahradí jedno monstrum nejvzácnější druh oblasti
      // (vzácné, jinak neobvyklé – Greenvale: Zephyr Hound), o úroveň výš než louka.
      const rare = this.nightRareSpecies(currentRegion);
      if (rare && this.wildMonsters.length && timePhase(this.state).id === 'night' && Math.random() < NIGHT_RARE_CHANCE + luckRareBonus(this.state)) {
        const top = zone?.level?.[1] ?? Math.max(1, playerLevel);
        const index = Phaser.Math.Between(0, this.wildMonsters.length - 1);
        const monster = createMonster(rare.id, top + 1);
        monster.nightRare = true;
        this.wildMonsters[index] = monster;
      }
    }

    // Stejná monstra mají stejné jméno (bez písmen A, B – přání hráče).

    // Hlavní monstrum (boss / první) – pro starší části kódu.
    this.wildMonster = this.wildMonsters[0];

    for (const monster of this.wildMonsters) {
      const seenRecord = this.state.bestiary[monster.speciesId] ?? { seen: 0, caught: 0, defeated: 0 };
      seenRecord.seen += 1;
      this.state.bestiary[monster.speciesId] = seenRecord;
    }
  }

  // Nejvzácnější druhy oblasti (podle vzácnosti v monsters.json); náhodně jeden z nich.
  nightRareSpecies(region) {
    const pool = MONSTER_SPECIES.filter((s) => s.region === region && !NO_RANDOM_SPECIES.has(s.id));
    const best = Math.max(...pool.map((s) => RARITY_RANK[s.rarity] ?? 0));
    const top = pool.filter((s) => (RARITY_RANK[s.rarity] ?? 0) === best && best > 0);
    return top.length ? top[Phaser.Math.Between(0, top.length - 1)] : null;
  }

  createEnemyUnits() {
    // Tutoriál: Air Elemental ve stejné řadě jako vlk (0, 2) – vlk doběhne přímo před něj (2, 2).
    if (this.tutorial) return this.wildMonsters.map((monster) => this.createEnemyUnit(monster, { x: 3, y: 2 }));
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
      attack: Math.max(2, Math.floor(wildStats.force * ENEMY_ATTACK_SHARE)),
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
      // Podpisová schopnost (nová): monstra, která už úroveň mají, ji dostanou dodatečně.
      const signature = getSignatureSkillId(monster.speciesId);
      if (signature && monster.level >= SIGNATURE_LEVEL && !monster.skills.includes(signature)) learnSkill(monster, signature);
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

    // Bonus z jídla (Vaření) v % – platí, dokud pokrm vydrží (počet soubojů).
    // + velitelský bonus výbavy a výztuhy (Kovářství), zvlášť se svým stropem.
    const meal = (stat, value) => this.applyStatBonus(stat, value);
    const guard = activeGuard(this.state);

    return readyMonsters.slice(0, startingPositions.length).map((monster, index) => {
      const position = startingPositions[index];
      const bondBonus = getMonsterBondBonuses(monster);
      const armor = meal('defense', monster.stats.armor + bondBonus.defense + commanderBonus.defense);
      const maxHp = meal('maxHp', monster.stats.vitality);

      return {
        id: monster.instanceId,
        name: monster.name,
        side: 'player',
        x: position.x,
        y: position.y,
        hp: monster.currentHp + (maxHp - monster.stats.vitality),
        maxHp,
        attack: meal('attack', monster.stats.force + bondBonus.attack + commanderBonus.physicalAttack),
        aether: meal('aether', monster.stats.aether + commanderBonus.magicAttack),
        defense: armor,
        armor,
        resolve: meal('resolve', monster.stats.resolve + commanderBonus.magicResistance),
        speed: meal('speed', monster.stats.tempo + bondBonus.speed + talents.monsterTempo), // Vůdce smečky
        statusChanceReduction: talents.statusChanceReduction, // Nezlomné velení
        move: monster.stats.tempo >= 12 ? 3 : 2,
        range: 1,
        guarding: false,
        movedThisTurn: false,
        monster,
        statusEffects: monster.statusEffects ?? [],
        // Ochrana z alchymie (imunity a odolnosti) na počet soubojů.
        statusImmunities: [...(guard?.immune ?? [])],
        resist: this.combinedResist(guard),
        base: { attack: monster.stats.force + bondBonus.attack + commanderBonus.physicalAttack, aether: monster.stats.aether + commanderBonus.magicAttack,
          defense: monster.stats.armor + bondBonus.defense + commanderBonus.defense, resolve: monster.stats.resolve + commanderBonus.magicResistance,
          speed: monster.stats.tempo + bondBonus.speed + talents.monsterTempo, maxHp: monster.stats.vitality }
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
    this.boardGraphics?.destroy();
    const g = this.add.graphics().setDepth(DEPTH.board);
    this.boardGraphics = g;
    const quad = this.view.boardQuad(0.18);

    // Podložka bojiště: jemně ztmavená plocha s měkkým okrajem (bez mřížky žádná deska).
    if (!this.simple) {
      g.fillStyle(0x061015, 0.32).fillPoints(quad, true);
      g.lineStyle(10, this.palette.glow, 0.06).strokePoints(quad, true);
      g.lineStyle(2, this.palette.glow, 0.28).strokePoints(quad, true);
    }

    for (let y = 0; y < (this.simple ? 0 : ROWS); y++) {
      for (let x = 0; x < COLUMNS; x++) {
        const cell = this.view.cellQuad(x, y, 0.04);
        g.fillStyle(0xffffff, (x + y) % 2 === 0 ? 0.055 : 0.03).fillPoints(cell, true);
        g.lineStyle(BATTLE_VIEW.gridWidth, this.palette.grid, BATTLE_VIEW.gridAlpha).strokePoints(cell, true);
      }
    }

    this.highlight ??= this.add.graphics().setDepth(DEPTH.highlight);
    this.hoverGraphics ??= this.add.graphics().setDepth(DEPTH.hover);
  }

  // Nové nastavení pohledu (ladicí panel): přepočítat projekci a překreslit desku,
  // překážky a jednotky na nových místech.
  applyBattleView() {
    this.view = new BoardProjection({ columns: COLUMNS, rows: ROWS, ...BATTLE_VIEW });
    this.drawBoard();
    this.createObstacles();
    for (const unit of this.units) {
      if (unit.model) this.placeUnit(unit, false);
    }
    this.refreshUnits();
    this.refreshBoard();
    this.hoverGraphics?.clear();
  }

  createObstacles() {
    this.obstacleObjects?.forEach((object) => object.destroy());
    this.obstacleObjects = [];
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
          this.obstacleObjects.push(g);
          continue;
        }

        const key = objectTextureKey('rock', rocks[rockIndex++ % rocks.length]);
        if (this.textures.exists(key)) {
          this.obstacleObjects.push(this.add.image(center.x, center.y + 18 * scale, key)
            .setOrigin(0.5, 1)
            .setScale(SHEET_SCALE * 1.1 * scale)
            .setDepth(DEPTH.units + center.y));
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
    return { ...center, scale: this.view.scaleAt(unit.y + 0.5) * BATTLE_VIEW.modelScale };
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

    const scale = unit.model.scale;
    // Rychlý souboj: jméno, životy a stavy vpravo od monstra (nad hlavou by překážely).
    const side = this.simple;
    const x = side ? unit.model.x + 80 * scale + 60 * scale : unit.model.x;
    const y = unit.model.y;
    const top = side ? y - 110 * scale : y - (unit.boss ? 205 : 160) * scale;
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
    // Bestiář a úkoly počítají každé zabité monstrum (ne vyhrané setkání); ochočené se nepočítá.
    if (unit.side === 'enemy' && unit.monster && !unit.monster.captured && !unit.defeatCounted) {
      unit.defeatCounted = true;
      const record = this.state.bestiary[unit.monster.speciesId] ?? { seen: 1, caught: 0, defeated: 0 };
      record.defeated = (Number(record.defeated) || 0) + 1;
      this.state.bestiary[unit.monster.speciesId] = record;
    }
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

  // Vzdálenost dvou polí; v souboji bez mřížky jsou všichni vedle sebe (1).
  dist(x1, y1, x2, y2) {
    return this.simple ? 1 : this.grid.distance(x1, y1, x2, y2);
  }

  // Souboj bez mřížky (volba „Bez mřížky“ před bojem): pořadí tahů zůstává, nikdo nechodí,
  // každá schopnost dosáhne na každý cíl a útok na dálku nemá postih. Jednotky stojí ve dvou
  // řadách proti sobě, deska je bez políček a bez překážek.
  enterSimpleMode() {
    this.simple = true;
    const rows = (n) => [[4], [3, 5], [2, 4, 6], [1, 3, 5, 7], [1, 2, 4, 5, 7]][Math.max(1, Math.min(5, n)) - 1];
    const line = (side, col, altCol) => {
      const list = this.units.filter((u) => u.side === side);
      const ys = rows(list.length);
      list.forEach((u, i) => {
        u.x = list.length === 5 && (i === 1 || i === 3) ? altCol : col;
        u.y = ys[i] ?? i;
        u.movedThisTurn = true;
      });
    };
    line('player', 3, 2);
    line('enemy', 6, 7);
    this.obstacleObjects?.forEach((o) => o.destroy());
    this.obstacleObjects = [];
    this.drawBoard();
    for (const unit of this.units) if (unit.model) this.placeUnit(unit, true, 420);
    this.refreshUnits();
    this.refreshBoard();
    this.log('Souboj bez mřížky: všichni jsou na dosah, nepřátelé míří hlavně na monstra útočící z dálky.');
  }

  // Cíl nepřítele bez mřížky: přednostně monstra s útoky na dálku (kouzla), mezi nimi
  // nejzraněnější; když žádné není, běžná volba AI.
  chooseSimpleTarget(unit) {
    const alive = this.units.filter((u) => u.side !== unit.side && u.hp > 0);
    const ranged = alive.filter((u) => getMonsterSkills(u.monster).some((skill) => isRangedSkill(skill) && skill.remainingUses > 0));
    if (!ranged.length) return chooseAITarget(unit, this.units);
    return ranged.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  }

  // Jméno hrdiny (hráčova postava) a tvar slovesa podle pohlaví postavy.
  heroName() {
    return this.state.playerName || 'Arion';
  }

  heroVerb(male, female) {
    return this.state.gender === 'female' ? female : male;
  }

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
      new BattleButton(this, 0, 0, ACTION_W, 76, { label, accent, hotkey, sub: ' ', onClick, onHover: (b) => this.showActionTip(b), onOut: () => this.tooltip.hide() });

    this.spellButton = action('Kouzla', 0xb48cff, 'Q', () => this.toggleSpellMenu());
    this.captureButton = action('Ochočení', 0xffd27a, 'C', () => this.chooseCapture());
    this.waitButton = action('Čekat', 0x9fb3c4, 'Mezera', () => this.wait());
    this.fleeButton = action('Útěk', 0xff8a8a, 'F', () => this.runAway());
    this.spellButton.tipId = 'spell';
    this.captureButton.tipId = 'capture';
    this.waitButton.tipId = 'wait';
    this.fleeButton.tipId = 'flee';
    this.itemButton = action('Předmět', 0x6fd28a, 'X', () => this.toggleItemMenu());
    this.itemButton.tipId = 'item';
    this.actionButtons = [this.spellButton, this.itemButton, this.captureButton, this.waitButton, this.fleeButton];
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
    // Schopnosti monstra se volí kliknutím na nepřítele (nabídka útoku), ne ze spodní lišty.
    const skills = [];

    const skillW = 184;
    const actionW = ACTION_W;
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
        sub: `${category.label} · dosah ${skill.range ?? 1}`,
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
    const crystals = SOUL_CRYSTALS.reduce((sum, c) => sum + getItemCount(this.state, c.id), 0);
    const affordable = this.availableSpells('enemy').some((spell) => this.state.mp >= this.spellManaCost(spell));

    this.spellButton
      .setContent('Kouzla', this.spellReady ? `MP ${this.state.mp}/${this.state.maxMp}` : 'po tazích monster', 'Q')
      .setDisabled(!playerTurn || !this.spellReady || !affordable)
      .setSelected(this.mode === 'spellTarget' || this.popover?.kind === 'spells');
    this.captureButton
      .setContent('Ochočení', `krystaly ${crystals}`, 'C')
      .setDisabled(!playerTurn || crystals <= 0 || this.isBoss || (this.tutorial && this.tutorialStep !== 'capture'))
      .setSelected(this.mode === 'capture');
    const itemKinds = this.battleItems().length;
    this.itemButton
      .setContent('Předmět', itemKinds ? `${itemKinds} druhů` : 'nic', 'X')
      .setDisabled(!playerTurn || !itemKinds)
      .setSelected(this.mode === 'itemAlly' || this.mode === 'itemEnemy' || this.popover?.kind === 'items');
    // Tutoriál: bez čekání a útěku.
    this.waitButton.setContent('Čekat', 'přeskočit tah', 'Mezera').setDisabled(!playerTurn || this.tutorial);
    this.fleeButton.setContent('Útěk', `šance ${ESCAPE_CHANCE} %`, 'F').setDisabled(!playerTurn || this.tutorial);

    for (const button of this.skillButtons) {
      button.setSelected(this.selectedSkill?.id === button.skill.id && this.mode === 'act');
      button.setDisabled(!playerTurn || button.skill.remainingUses <= 0);
    }
  }

  showSkillTip(skill, button, at = null, plan = null) {
    const category = CATEGORY[skill.category] ?? CATEGORY.physical;
    const ranged = isRangedSkill(skill);
    const lines = [
      `${category.label} · ${ELEMENT_LABELS[normalizeElement(skill.element)] ?? 'Neutrální'}`,
      `Síla ${skill.power ?? 0} · přesnost ${Math.round((skill.accuracy ?? 1) * 100)} %`,
      ranged
        ? `Kouzlo z místa (monstrum se nehne): plně do ${rangedFullRange(this.currentUnit)} polí, dál −70 %.`
        : 'Zblízka (dosah 1 pole)'
    ];
    if (ranged) lines.push(`Přesnost +${PRECISION_PER_TILE} nad 80 = +1 pole plného dosahu.`);
    if (plan?.far) lines.push(`Cíl je dál než ${plan.reach} polí – poškození −70 %.`);
    if (plan?.cell) lines.push('Monstrum nejdřív dojde k cíli a hned zaútočí.');
    if (skill.description) lines.push(skill.description);
    const left = (at?.x ?? 0) + button.container.x;
    const top = (at?.y ?? 0) + button.container.y;
    this.tooltip.showBeside(left, top, left + button.w, skill.name, lines, plan?.far ? 0xff9a5a : category.color);
  }

  showActionTip(button) {
    const tips = {
      spell: ['Útočná kouzla z tvého Spellbooku.', 'Podpůrná kouzla: klikni na své monstrum.', `${this.heroName()} kouzlí jednou za kolo tvých monster.`],
      capture: ['Pokus o ochočení divokého monstra krystalem.', 'Nižší HP a stavové efekty zvyšují šanci.', 'Krystal se spotřebuje i při neúspěchu.'],
      item: ['Lektvar, protijed, elixír nebo vrhací směs z inventáře.', 'Léčení a protijed: klikni na své monstrum, směs: na nepřítele.', 'Použití předmětu zabere tah.'],
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
      // Bez mřížky se kliká přímo na monstrum (jako na postavy v interiérech), ne na políčko.
      if (this.simple) {
        const unit = this.unitAtPointer(pointer);
        if (unit) this.onCellClicked(unit.x, unit.y);
        return;
      }
      const cell = this.view.cellAt(pointer.worldX, pointer.worldY);
      if (cell) this.onCellClicked(cell.x, cell.y);
    });

    // Ladicí panel pohledu na bojiště (BattleViewTuner): Alt+F9, záměrně není v nápovědě.
    this.viewTuner = new BattleViewTuner({
      view: BATTLE_VIEW,
      defaults: BATTLE_VIEW_DEFAULTS,
      onChange: () => this.applyBattleView()
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.viewTuner.close();
      this.input.setDefaultCursor('default'); // ruka nad monstrem (bez mřížky) nesmí zůstat
    });

    this.input.keyboard.on('keydown', (event) => {
      if (event.code === 'F9' && event.altKey) {
        event.preventDefault?.();
        this.viewTuner.toggle();
        return;
      }
      if (this.namingMonster) return;
      if (this.finished) {
        // Přehled po boji zavře jen hráč – tlačítkem nebo Enterem.
        if (this.resultOpen && (event.code === 'Enter' || event.code === 'NumpadEnter')) this.returnToWorld(0, true);
        return;
      }
      if (this.preBattle) {
        if (event.code === 'Enter' || event.code === 'KeyB') this.preBattleFight();
        else if (event.code === 'KeyR') this.preBattleFight({ simple: true });
        else if (event.code === 'KeyS') this.preBattleSimulate();
        else if (event.code === 'KeyF') this.preBattleFlee();
        return;
      }
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
        case 'KeyX': if (!this.itemButton.disabled) this.toggleItemMenu(); break;
        case 'Escape': this.cancelMode(); break;
        default: break;
      }
    });
  }

  // Jednotka pod kurzorem podle postavy monstra (souboj bez mřížky). Při překryvu vyhrává
  // monstrum vpředu (níž na obrazovce).
  unitAtPointer(pointer) {
    const px = pointer.worldX;
    const py = pointer.worldY;
    const hits = this.units.filter((unit) => {
      if (unit.hp <= 0 || !unit.model?.visible) return false;
      const s = unit.model.scale || 1;
      const halfW = 70 * s;
      const top = unit.model.y - 190 * s;
      return px >= unit.model.x - halfW && px <= unit.model.x + halfW && py >= top && py <= unit.model.y + 24 * s;
    });
    return hits.sort((a, b) => b.model.y - a.model.y)[0] ?? null;
  }

  onPointerMove(pointer) {
    const g = this.hoverGraphics;
    g.clear();

    if (this.simple) {
      const unit = this.popover ? null : this.unitAtPointer(pointer);
      this.input.setDefaultCursor(unit && this.isPlayerActing() ? 'pointer' : 'default');
      if (!unit) {
        if (!this.tooltip.container.visible || this.hoverUnit) this.tooltip.hide();
        this.hoverUnit = null;
        return;
      }
      // Zvýraznění postavy pod kurzorem: bílý prstenec u nohou.
      const s = unit.model.scale || 1;
      g.lineStyle(3, 0xffffff, 0.85).strokeEllipse(unit.model.x, unit.model.y, 140 * s, 44 * s);
      if (unit !== this.hoverUnit) {
        this.hoverUnit = unit;
        this.showUnitTip(unit);
      }
      return;
    }

    const cell = this.view.cellAt(pointer.worldX, pointer.worldY);

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
    if (this.mode === 'spellTarget' || this.mode === 'capture' || this.mode === 'itemAlly' || this.mode === 'itemEnemy') {
      this.mode = 'act';
      this.selectedSpell = null;
      this.selectedItem = null;
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
      this.castSelectedSpell(target);
      return;
    }

    if (!this.isPlayerActing()) return;

    if (this.mode === 'itemEnemy') {
      const target = this.findEnemyAt(x, y);
      if (target) this.useBattleItem(this.selectedItem, target);
      else this.log('Klikni na nepřítele, na kterého směs hodíš.');
      return;
    }

    if (this.mode === 'itemAlly') {
      const target = this.unitAt(x, y);
      if (target?.side === 'player' && target.hp > 0) this.useBattleItem(this.selectedItem, target);
      else this.log('Klikni na své monstrum.');
      return;
    }

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

    if (!this.simple && !this.currentUnit.movedThisTurn) {
      this.moveTo(x, y);
    }
  }

  // Kliknutí na nepřítele: nabídka útoků – schopnosti monstra a Arionova kouzla.
  // Nic se nepoužije automaticky, volí se až v nabídce.
  openAttackMenu(target) {
    // Tutoriál: po zásahu vlkem už jen kouzlo a ochočení.
    if (this.tutorialStep === 'capture' || this.tutorialStep === 'spell') {
      this.setHint(this.tutorialStep === 'spell' ? 'Teď kouzlo: klikni na Kouzla (Q).' : 'Air Elemental je oslabený – použij Ochočení (C).');
      return;
    }
    const unit = this.currentUnit;
    const entries = [];
    for (const skill of getMonsterSkills(unit.monster).filter(isOffensive)) {
      const plan = this.planAttack(unit, target, skill);
      const category = CATEGORY[skill.category] ?? CATEGORY.physical;
      const where = !plan.ok ? 'mimo dosah' : plan.cell ? 'přesun + útok' : plan.far ? `−70 % (dál než ${plan.reach} polí)` : isRangedSkill(skill) ? 'z místa' : 'v dosahu';
      entries.push({
        label: skill.name,
        sub: `${category.label} · síla ${skill.power} · ${where}`,
        accent: plan.far ? 0xff9a5a : category.color,
        disabled: !plan.ok || skill.remainingUses <= 0,
        onHover: (button, at) => this.showSkillTip(skill, button, at, plan),
        onClick: () => {
          this.closePopover();
          this.executeAttack(skill, target, plan);
        }
      });
    }
    // Kouzla Ariona: poslední řádek tabulky útoků (otevře knihu kouzel s tímto cílem).
    if (this.availableSpells('enemy').length > 0) {
      entries.push({
        label: `Kouzlit (${this.heroName()})`,
        sub: this.spellReady ? `kniha kouzel · MP ${this.state.mp}/${this.state.maxMp}` : 'až po tazích monster',
        accent: 0xb48cff,
        disabled: !this.spellReady,
        onClick: () => this.openSpellbook(target)
      });
    }
    const top = target.model.y - 175 * target.model.scale;
    this.openPopover('attack', target.model.x, top, `Útok na: ${target.name}`, entries, UI_COLORS.inRangeAll);
  }

  // Jak se schopnost na cíl použije: zblízka z místa nebo po přesunu (pohyb + útok v jednom
  // tahu). Kouzlo (magický útok) vždy z místa – monstrum se nehne; dál než plný dosah s postihem.
  planAttack(unit, target, skill) {
    const dist = (x, y) => this.dist(x, y, target.x, target.y);
    const ranged = isRangedSkill(skill);
    if (skill.remainingUses <= 0) return { ok: false };
    if (ranged) return { ok: true, cell: null, far: dist(unit.x, unit.y) > rangedFullRange(unit), reach: rangedFullRange(unit) };
    const reach = MELEE_RANGE;
    if (dist(unit.x, unit.y) <= reach) return { ok: true, cell: null, far: false };
    if (!unit.movedThisTurn) {
      const cells = this.grid.getReachable(unit, this.units)
        .filter((c) => c.distance > 0 && dist(c.x, c.y) <= reach)
        // Při stejné cestě přednost polím přímo před cílem (stejná řada, pak sloupec) – útočník
        // pak opravdu stojí u cíle, ne šikmo (vypadalo to jako útok zdálky).
        .sort((a, b) => a.distance - b.distance || dist(a.x, a.y) - dist(b.x, b.y)
          || Number(a.y !== target.y) - Number(b.y !== target.y) || Number(a.x !== target.x) - Number(b.x !== target.x));
      if (cells[0]) return { ok: true, cell: cells[0], far: false };
    }
    return ranged ? { ok: true, cell: null, far: true } : { ok: false };
  }

  // Útok podle plánu: případně nejdřív přesun na pole u cíle, pak hned schopnost (jeden tah).
  executeAttack(skill, target, plan) {
    const unit = this.currentUnit;
    if (!plan?.ok || !unit) return;
    if (plan.cell) {
      unit.x = plan.cell.x;
      unit.y = plan.cell.y;
      unit.movedThisTurn = true;
      this.mode = 'busy';
      this.placeUnit(unit, true, 300);
      this.refreshBoard();
      this.refreshActionButtons();
      this.time.delayedCall(380, () => {
        this.selectedSkill = skill;
        this.useSelectedSkill(target);
      });
      return;
    }
    this.selectedSkill = skill;
    this.useSelectedSkill(target);
  }

  // Útočné schopnosti, které z pozice jednotky dosáhnou na cíl.
  skillsReaching(unit, target) {
    if (!unit?.monster || !target) return [];
    return getMonsterSkills(unit.monster)
      .filter((skill) => isOffensive(skill) && skill.remainingUses > 0 && this.planAttack(unit, target, skill).ok)
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
    if (this.simple) return 'Klikni na nepřítele a vyber útok, nebo na své monstrum (podpora). Bez mřížky – všichni jsou na dosah.';
    const anyReach = this.units.some((other) => other.side === 'enemy' && other.hp > 0 && this.skillsReaching(unit, other).length > 0);
    return anyReach
      ? 'Klikni na nepřítele a vyber útok (monstrum k němu samo dojde), nebo na tyrkysové pole pro pohyb.'
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
      const scale = this.view.scaleAt(target.y + 0.5) * BATTLE_VIEW.modelScale;
      g.fillStyle(color, strong ? 0.28 : 0.18).fillEllipse(center.x, center.y, 136 * scale, 44 * scale);
      g.lineStyle(strong ? 4 : 3, color, 0.95).strokeEllipse(center.x, center.y, 128 * scale, 40 * scale);
    };

    if (this.mode === 'spellTarget' && this.selectedSpell) {
      for (let y = 0; y < (this.simple ? 0 : ROWS); y++) {
        for (let x = 0; x < COLUMNS; x++) {
          fillCell(x, y, UI_COLORS.skillRange, 0.05); // kouzla hrdiny mají neomezený dosah
        }
      }
      for (const enemy of this.units.filter((u) => u.side === 'enemy' && u.hp > 0)) {
        {
          if (!this.simple) fillCell(enemy.x, enemy.y, 0xb48cff, 0.3, 0.9);
          glowUnit(enemy, 0xb48cff, true);
        }
      }
      return;
    }

    if (!unit || unit.hp <= 0) return;

    if (this.simple) {
      glowUnit(unit, 0xffd98a, true);
      if (unit.side !== 'player' || this.phase !== 'units') return;
      const color = this.mode === 'capture' ? 0xffd27a : UI_COLORS.inRangeAll;
      for (const enemy of this.units.filter((u) => u.side === 'enemy' && u.hp > 0)) glowUnit(enemy, color, false);
      return;
    }

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
        if (this.dist(unit.x, unit.y, ally.x, ally.y) <= (this.selectedSkill.range ?? 1)) {
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

  openPopover(kind, x, y, title, entries, accent, footer = null) {
    this.closePopover();
    this.tooltip.hide();

    // Víc než 6 položek → dva sloupce, ať nabídka nepřeroste obrazovku.
    const columns = entries.length > 6 ? 2 : 1;
    const columnW = 360;
    const width = columns * columnW + (columns - 1) * 8;
    const rowH = 64;
    const rowsCount = Math.max(1, Math.ceil(entries.length / columns));
    const height = 54 + rowsCount * (rowH + 8);
    const footerH = footer ? 100 : 0;
    const px = Phaser.Math.Clamp(x - width / 2, 16, 1920 - width - 16);
    const py = Phaser.Math.Clamp(y - height - footerH, 16, 1080 - height - footerH - 16);

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
        onClick: () => entry.onClick(),
        onHover: entry.onHover ? (b) => entry.onHover(b, { x: px, y: py }) : null,
        onOut: entry.onHover ? () => this.tooltip.hide() : null
      });
      button.setDisabled(Boolean(entry.disabled));
      container.add(button.container);
    });

    // Panel Kouzlit: užší, fialový, pod tabulkou schopností.
    if (footer) {
      const fw = 280;
      const fx = (width - fw) / 2;
      const fy = height + 12;
      const fbg = this.add.graphics();
      drawGlass(fbg, fx, fy, fw, 88, { edge: 0xb48cff, edgeAlpha: 0.95, alpha: 0.96, radius: 14 });
      container.add(fbg);
      const cast = new BattleButton(this, fx + 12, fy + 12, fw - 24, 64, {
        label: footer.label,
        sub: footer.sub,
        accent: 0xb48cff,
        titleSize: 19,
        onClick: () => footer.onClick()
      });
      container.add(cast.container);
    }

    // Ztlumení zbytku: klik mimo popover ho zavře (řeší pointerdown scény).
    // first = první dostupná položka (tutoriál ji zvýrazní).
    const firstIndex = Math.max(0, entries.findIndex((e) => !e.disabled));
    const first = entries.length ? { x: px + 14 + (firstIndex % columns) * (columnW + 8), y: py + 48 + Math.floor(firstIndex / columns) * (rowH + 8), w: columnW - 28, h: rowH } : null;
    this.popover = { kind, container, first };
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
      this.log(`${this.heroName()} už toto kolo ${this.heroVerb('kouzlil', 'kouzlila')}. Kouzla se obnoví po tazích tvých monster.`);
      return;
    }
    this.openSpellbook(null);
  }

  // Kniha kouzel: vlevo školy magie, vpravo útočná kouzla vybrané školy. S cílem (z nabídky
  // útoku) se kouzlo sešle rovnou na něj, jinak se cíl vybere kliknutím. Kouzla mají neomezený dosah.
  openSpellbook(target = null) {
    this.closePopover();
    this.tooltip.hide();
    const spells = this.availableSpells('enemy');
    const unlocked = (school) => this.state.magicMastery?.[school]?.unlocked !== false && (this.state.magicMastery?.[school]?.level ?? 0) > 0;
    if (!this.spellbookSchool || !spells.some((s) => s.school === this.spellbookSchool)) {
      this.spellbookSchool = SCHOOL_ORDER.find((school) => spells.some((s) => s.school === school)) ?? 'air';
    }
    const width = 700;
    const height = 60 + SCHOOL_ORDER.length * 66;
    const px = 960 - width / 2;
    const py = Phaser.Math.Clamp(1080 - 140 - height, 16, 1080 - height - 16);
    const container = this.add.container(px, py).setDepth(DEPTH.popover);
    const bg = this.add.graphics();
    drawGlass(bg, 0, 0, width, height, { edge: 0xb48cff, edgeAlpha: 0.85, alpha: 0.95, radius: 16 });
    container.add(bg);
    container.add(uiText(this, 18, 14, target ? `Kniha kouzel – cíl: ${target.name}` : 'Kniha kouzel', { size: 19, bold: true, color: UI_COLORS.gold }));
    container.add(uiText(this, width - 18, 16, `MP ${this.state.mp}/${this.state.maxMp} · neomezený dosah`, { size: 15, color: UI_COLORS.muted, originX: 1 }));
    SCHOOL_ORDER.forEach((school, i) => {
      const count = spells.filter((s) => s.school === school).length;
      const open = unlocked(school);
      const button = new BattleButton(this, 14, 50 + i * 66, 200, 58, {
        label: SCHOOL_NAMES[school],
        sub: open ? `${count} kouzel` : 'zamčeno',
        accent: elementColor(school),
        titleSize: 18,
        onClick: () => { this.spellbookSchool = school; this.openSpellbook(target); }
      });
      button.setDisabled(!open || count === 0);
      button.setSelected(school === this.spellbookSchool);
      container.add(button.container);
    });
    const list = spells.filter((s) => s.school === this.spellbookSchool);
    if (!list.length) container.add(uiText(this, 240, 70, 'V této škole zatím nemáš útočné kouzlo.', { size: 16, color: UI_COLORS.muted }));
    list.slice(0, SCHOOL_ORDER.length).forEach((spell, i) => {
      const button = new BattleButton(this, 230, 50 + i * 66, width - 244, 58, {
        label: spell.name,
        sub: `${this.spellManaCost(spell)} MP · poškození ${spell.damage}${spell.area > 0 ? ` · plocha ${spell.area * 2 + 1}×${spell.area * 2 + 1}` : spell.targets === 'all' ? ' · všichni' : spell.targets > 1 ? ` · ${spell.targets} cíle` : ''}${spell.statusEffect ? ` · ${SPELL_STATUS_NAMES[spell.statusEffect.id] ?? spell.statusEffect.id} ${Math.round(spell.statusEffect.chance * 100)} %` : ''}`,
        accent: elementColor(spell.school),
        titleSize: 17,
        onClick: () => {
          if (!target) { this.selectBattleSpell(spell); return; }
          this.closePopover();
          this.selectedSpell = spell;
          this.castSelectedSpell(target);
        }
      });
      button.setDisabled(this.state.mp < this.spellManaCost(spell));
      container.add(button.container);
    });
    this.popover = { kind: 'spells', container, first: list.length ? { x: px + 230, y: py + 50, w: width - 244, h: 58 } : null };
    this.refreshActionButtons();
  }

  selectBattleSpell(spell) {
    if (this.state.mp < this.spellManaCost(spell)) {
      this.log(`Na ${spell.name} nemáš dost many.`);
      return;
    }
    this.closePopover();
    this.selectedSpell = spell;
    this.mode = 'spellTarget';
    this.setHint(`${spell.name}: klikni na nepřítele (Esc zruší).`);
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
      const distance = this.dist(unit.x, unit.y, ally.x, ally.y);
      const healing = skill.category === 'healing' && distance <= (skill.range ?? 1);
      const buff = skill.category === 'buff' && ally === unit;
      if (!healing && !buff) continue;
      entries.push({
        label: `${skill.name} (schopnost)`,
        sub: `${CATEGORY[skill.category].label} · síla ${skill.power ?? 0}`,
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

  // ======================================================= předměty (alchymie)

  // Bonus statistiky z jídla a elixíru dohromady, nejvýš +25 %.
  consumableBuff(stat) {
    return Math.min(STAT_STACK_CAP, mealBuff(this.state, stat) + elixirBuff(this.state, stat));
  }

  // Násobek statistiky: jídlo + elixír (strop 25 %) × výbava + výztuha (strop 50 %).
  statMultiplier(stat) {
    return (1 + this.consumableBuff(stat) / 100) * (1 + gearBonus(this.state, stat) / 100);
  }

  // Statistika s bonusem; kladný bonus se zaokrouhlí nahoru, aby u malých hodnot nezmizel
  // (Obrana 10 a výbava +4 % = 11, ne 10).
  applyStatBonus(stat, value) {
    const multiplier = this.statMultiplier(stat);
    const result = value * multiplier;
    return multiplier > 1 ? Math.ceil(result - 1e-9) : Math.round(result);
  }

  // Odolnost proti elementům: ochrana z alchymie + výbava, dohromady nejvýš 75 %.
  combinedResist(guard) {
    const resist = { ...(guard?.resist ?? {}) };
    for (const element of ['fire', 'water', 'earth', 'air', 'verdant', 'dark', 'light']) {
      const total = (Number(resist[element]) || 0) + gearResist(this.state, element);
      if (total) resist[element] = Math.min(75, total);
    }
    return resist;
  }

  // Přepočítá statistiky monster hráče po vypití elixíru v souboji.
  refreshUnitStats() {
    for (const unit of this.units ?? []) {
      if (unit.side !== 'player' || !unit.base) continue;
      unit.attack = this.applyStatBonus('attack', unit.base.attack);
      unit.aether = this.applyStatBonus('aether', unit.base.aether);
      unit.defense = this.applyStatBonus('defense', unit.base.defense);
      unit.armor = unit.defense;
      unit.resolve = this.applyStatBonus('resolve', unit.base.resolve);
      unit.speed = this.applyStatBonus('speed', unit.base.speed);
      const maxHp = this.applyStatBonus('maxHp', unit.base.maxHp);
      if (maxHp > unit.maxHp && unit.hp > 0) unit.hp += maxHp - unit.maxHp;
      unit.maxHp = maxHp;
      unit.hp = Math.min(unit.hp, unit.maxHp);
      this.refreshUnitBars(unit);
    }
  }

  // Předměty z inventáře, které jdou použít v souboji (akce Předmět).
  battleItems() {
    const seen = new Map();
    for (const slot of this.state.inventory?.slots ?? []) {
      const item = getItem(slot?.id);
      if (!item?.battleUse) continue;
      seen.set(item.id, (seen.get(item.id) ?? 0) + slot.qty);
    }
    return [...seen.entries()].map(([id, qty]) => ({ item: getItem(id), qty, recipe: ALCHEMY_BY_ID[getItem(id).battleUse] }));
  }

  toggleItemMenu() {
    if (this.popover?.kind === 'items') {
      this.closePopover();
      return;
    }
    if (!this.isPlayerActing()) return;
    const entries = this.battleItems().map(({ item, qty, recipe }) => ({
      label: `${item.name} ×${qty}`,
      sub: describeAlchemy(recipe.effect).slice(0, 70),
      accent: 0x6fd28a,
      onClick: () => this.chooseBattleItem(item.id)
    }));
    if (!entries.length) {
      this.log('Nemáš žádný předmět použitelný v souboji.');
      return;
    }
    const anchor = this.itemButton.container;
    this.openPopover('items', anchor.x + ACTION_W / 2, anchor.y - 12, 'Předměty', entries, 0x6fd28a);
  }

  chooseBattleItem(itemId) {
    this.closePopover();
    const e = ALCHEMY_BY_ID[getItem(itemId)?.battleUse]?.effect;
    if (!e) return;
    if (e.throw) {
      this.selectedItem = itemId;
      this.mode = 'itemEnemy';
      this.setHint(`${getItem(itemId).name}: klikni na nepřítele (Esc zruší).`);
    } else if (e.revive) {
      const fainted = this.units.filter((u) => u.side === 'player' && u.hp <= 0);
      if (!fainted.length) {
        this.log('Žádné tvoje monstrum neomdlelo.');
        return;
      }
      const entries = fainted.map((unit) => ({
        label: unit.name, sub: 'oživit', accent: 0xffd27a,
        onClick: () => { this.closePopover(); this.useBattleItem(itemId, unit); }
      }));
      const anchor = this.itemButton.container;
      this.openPopover('revive', anchor.x + ACTION_W / 2, anchor.y - 12, 'Koho oživit?', entries, 0xffd27a);
      return;
    } else if (e.heal || e.regenTurn || e.cure) {
      this.selectedItem = itemId;
      this.mode = 'itemAlly';
      this.setHint(`${getItem(itemId).name}: klikni na své monstrum (Esc zruší).`);
    } else {
      this.useBattleItem(itemId, null);
      return;
    }
    this.refreshBoard();
    this.refreshActionButtons();
  }

  useBattleItem(itemId, target) {
    const item = getItem(itemId);
    const recipe = ALCHEMY_BY_ID[item?.battleUse];
    const e = potionEffect(this.state, recipe?.effect); // talent Alchymická zručnost
    if (!e || !removeItem(this.state, itemId, 1)) return;
    this.selectedItem = null;
    this.mode = 'busy';
    const user = this.currentUnit;
    const notes = [];
    const allies = this.units.filter((u) => u.side === 'player' && u.hp > 0);
    const heal = (unit, amount) => {
      const gained = Math.min(amount, unit.maxHp - unit.hp);
      unit.hp += gained;
      if (unit.monster) unit.monster.currentHp = Math.min(unit.monster.stats.vitality, unit.hp);
      this.refreshUnitBars(unit);
      floatingText(this, unit.model.x, unit.model.y - 150 * unit.model.scale, `+${gained}`, '#7fe38a', 26);
      return gained;
    };

    if (e.throw && target) {
      const t = e.throw;
      if (t.damage) {
        const result = calculateElementalDamage(t.damage, t.element, target.monster?.element);
        target.hp = Math.max(0, target.hp - result.damage);
        if (target.monster) target.monster.currentHp = target.hp;
        this.fxHit(target, { type: 'damage', amount: result.damage, multiplier: result.multiplier });
        notes.push(`${result.damage} poškození`);
      }
      if (target.hp > 0 && t.status) {
        const applied = applyStatusEffect(target, { id: t.status, chance: 1, duration: t.turns }, user);
        notes.push(applied.applied ? 'zasáhlo' : 'cíl odolal');
      }
      this.refreshUnitBars(target);
      if (target.hp <= 0) this.faintUnit(target);
    }
    if (e.revive && target) {
      target.hp = Math.max(1, Math.round(target.maxHp * e.revive));
      if (target.monster) target.monster.currentHp = Math.min(target.monster.stats.vitality, target.hp);
      target.statusEffects = [];
      target.model.setAlpha(1);
      this.placeUnit(target, false);
      this.refreshUnitBars(target);
      notes.push(`${target.name} je zpět v boji`);
    }
    if (e.heal && target) notes.push(`${target.name} +${heal(target, e.heal)} HP`);
    if (e.healAll) notes.push(`parta +${allies.reduce((sum, u) => sum + heal(u, e.healAll), 0)} HP`);
    if (e.mana) {
      const gained = Math.min(e.mana, Math.max(0, this.state.maxMp - this.state.mp));
      this.state.mp += gained;
      notes.push(`+${gained} many`);
    }
    if (e.regenTurn && target) {
      target.itemRegen = { hp: e.regenTurn, turns: e.turns };
      notes.push(`regenerace ${e.regenTurn} HP za tah`);
    }
    if (e.manaTurn) {
      this.manaRegen = { mp: e.manaTurn, turns: e.turns };
      notes.push(`mana +${e.manaTurn} za tah`);
    }
    if (e.cure && target) {
      const before = (target.statusEffects ?? []).length;
      target.statusEffects = e.cure === 'all' ? [] : (target.statusEffects ?? []).filter((s) => !e.cure.includes(s.id));
      if (target.monster) target.monster.statusEffects = target.statusEffects;
      this.refreshUnitBars(target);
      notes.push(before > target.statusEffects.length ? 'stav odstraněn' : 'žádný stav k odstranění');
    }
    if (e.immune || e.resist || e.buffs) {
      applyLastingInBattle(this.state, recipe);
      for (const unit of allies) {
        if (e.immune) unit.statusImmunities = [...new Set([...(unit.statusImmunities ?? []), ...e.immune])];
        if (e.resist) unit.resist = { ...(unit.resist ?? {}), ...e.resist };
      }
      if (e.buffs) this.refreshUnitStats();
      notes.push(`účinek na ${e.battles} ${e.battles < 5 ? 'souboje' : 'soubojů'}`);
    }

    this.log(`${item.name}: ${notes.join(', ') || 'použito'}.`);
    this.refreshHeroPanel();
    this.refreshBoard();
    this.refreshActionButtons();
    this.time.delayedCall(650, () => {
      if (!this.checkOutcome()) this.endTurn();
    });
  }

  // Na začátku tahu: regenerace z lektvaru (monstrum) a mana za tah (hrdina).
  applyItemRegen(unit) {
    if (!unit || unit.side !== 'player' || unit.hp <= 0) return;
    if (unit.itemRegen?.turns > 0) {
      const gained = Math.min(unit.itemRegen.hp, unit.maxHp - unit.hp);
      unit.hp += gained;
      if (unit.monster) unit.monster.currentHp = Math.min(unit.monster.stats.vitality, unit.hp);
      unit.itemRegen.turns -= 1;
      if (gained) floatingText(this, unit.model.x, unit.model.y - 150 * unit.model.scale, `+${gained}`, '#7fe38a', 22);
    }
    if (this.manaRegen?.turns > 0) {
      this.state.mp = Math.min(this.state.maxMp, this.state.mp + this.manaRegen.mp);
      this.manaRegen.turns -= 1;
      this.refreshHeroPanel();
    }
  }

  // ============================================================== akce

  wait() {
    if (!this.isPlayerActing() || this.tutorial) return;
    this.closePopover();
    this.log(`${this.currentUnit.name} přeskakuje tah.`);
    this.endTurn();
  }

  runAway() {
    if (!this.isPlayerActing() || this.tutorial) return;
    this.closePopover();

    if (exploreBonus(this.state, 'escape') || Phaser.Math.Between(1, 100) <= ESCAPE_CHANCE) {
      this.finished = true;
      this.log(`${this.heroName()} se s monstry ${this.heroVerb('stáhl', 'stáhla')} z boje.`);
      this.showResult('Útěk', ['Podařilo se uniknout.'], '#bfe2ff');
    } else {
      this.log('Útěk se nezdařil!');
      this.showBanner('Útěk se nezdařil', '#ff9b9b');
      this.endTurn();
    }
  }

  chooseCapture() {
    if (!this.isPlayerActing() || this.isBoss || (this.tutorial && this.tutorialStep !== 'capture')) return;
    if (!this.hasCaptureCrystal()) {
      this.crystalRefillTip(false);
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

    const crystal = this.pickCrystal(wild);
    if (!crystal || !removeItem(this.state, crystal.id, 1)) {
      this.log(isAncientDragon(wild)
        ? 'Prastarého draka ochočí jen Dragon Soul Crystal.' : 'Nemáš žádný Soul Crystal.');
      return;
    }
    this.log(`Použit ${crystal.name}.`);

    wild.currentHp = target.hp;
    this.mode = 'busy';
    this.refreshBoard();
    this.refreshActionButtons();

    const activeStatus = (target.statusEffects ?? []).find((effect) => effect.remaining > 0);
    // Lektvary štěstí lovce / velkého lovu: +šance na ochočení.
    // + Charisma (0,5 % za bod).
    const tameBonus = exploreBonus(this.state, 'tame') + charismaTameBonus(this.state);
    const result = tryCaptureMonster(wild, crystal.type, activeStatus?.id ?? null, Math.random() - tameBonus);
    result.chance = Math.min(1, result.chance + tameBonus);
    // Tutoriál: po jednom zásahu je ochočení jisté (100 %).
    if (this.tutorial) {
      result.success = true;
      result.chance = 1;
    }

    this.fxProjectile(this.currentUnit.model, target.model, 0xffd27a, () => this.fxCapture(target, result.success, () => {
      if (result.success) {
        // Do party s HP, které mělo v okamžiku ochočení (stejný podíl z maxima).
        const ratio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
        wild.currentHp = Math.max(1, Math.round((Number(wild.stats?.vitality) || target.maxHp) * ratio));
        const destination = addMonsterToCollection(this.state, wild);
        wild.captured = true;
        if (this.tutorial) {
          markQuestObjective(this.state, 'greenvale_mage_intro');
          this.setTutorialStep('done');
        }
        this.capturedHp = this.capturedHp ?? new Map();
        this.capturedHp.set(wild, wild.currentHp);
        const where = destination === 'party' ? 'Přidáno do party.' : 'Party je plná – monstrum jde do úschovny.';
        const othersAlive = this.units.some((unit) => unit.side === 'enemy' && unit !== target && unit.hp > 0);
        target.hp = 0;
        this.faintUnit(target);
        floatingText(this, target.model.x, target.model.y - 150 * target.model.scale, 'Ochočeno!', '#ffe3a0', 28);
        // Hráč zvíře pojmenuje (Enter s prázdným polem / Esc = jméno druhu).
        this.askMonsterName(wild, () => {
          this.log(`${wild.name} se podařilo ochočit! ${where}`);
          if (othersAlive) {
            // Další nepřátelé bojují dál.
            this.time.delayedCall(300, () => this.endTurn());
            return;
          }
          this.finished = true;
          this.showResult('Monstrum ochočeno', [`${wild.name} se přidává k tobě.`, where, ...this.tutorialSpellNotes()], '#ffe3a0');
        });
      } else {
        this.log(`Ochočení selhalo (${Math.round(result.chance * 100)} %). Krystal se spotřeboval.`);
        floatingText(this, target.model.x, target.model.y - 150 * target.model.scale, 'Zvíře se nenechalo ochočit', '#ffd27a', 26);
        // Poslední krystal vyplýtvaný: hned říct, kde vzít další (úkol, jehož zadavatel doplní).
        if (!this.hasCaptureCrystal()) this.crystalRefillTip(true);
        this.time.delayedCall(700, () => this.endTurn());
      }
    }));
  }

  // Došly Soul Crystaly (i vyplýtvané nepovedeným ochočením): když běží úkol, jehož zadavatel
  // krystaly doplní (Nový společník), poradit, kam pro ně.
  crystalRefillTip(wasted) {
    const quest = this.mageCrystalQuest();
    const zoneName = quest?.mageCrystal.zoneName;
    const tip = !quest ? ''
      : this.mageCrystalHere() ? ` Mágovy krystaly se ti doplní v dalším souboji na ${zoneName === 'Skalní stráň' ? 'Skalní stráni' : zoneName}.`
      : getItemCount(this.state, 'mage_crystal') > 0 ? ' Mágův krystal funguje jen na Skalní stráni.'
      : ' Mágovy krystaly se ti doplní v souboji na Skalní stráni.';
    this.log(`${wasted ? 'To byl tvůj poslední krystal.' : 'Nemáš krystal, který tu jde použít.'}${tip}`);
    if (tip) this.showBanner(wasted ? 'Poslední krystal vyplýtván' : 'Žádný použitelný krystal', '#ff9b9b');
  }

  // Úkol s Mágovým krystalem (Nový společník), když běží.
  mageCrystalQuest() {
    return Object.values(QUESTS).find((q) => q.mageCrystal && getQuestStatus(this.state, q.id) === QUEST_STATUS.active) ?? null;
  }

  // Souboj na louce, kde Mágův krystal platí (Skalní stráň) při aktivním úkolu.
  mageCrystalHere() {
    const quest = this.mageCrystalQuest();
    return Boolean(quest && this.encounter?.zone?.id === quest.mageCrystal.zone);
  }

  hasCaptureCrystal() {
    return SOUL_CRYSTALS.some((c) => c.type !== 'dragonSoul' && getItemCount(this.state, c.id) > 0)
      || (this.mageCrystalHere() && getItemCount(this.state, 'mage_crystal') > 0);
  }

  // Tutoriál: magie Vzduchu se odemkne až po souboji (Krotitelova zkouška) – řádky oznámení nového kouzla.
  tutorialSpellNotes() {
    if (!this.tutorial || isMagicSchoolUnlocked(this.state, 'air')) return [];
    const unlocked = unlockMagicSchool(this.state, 'air');
    const names = spellRows.filter((row) => unlocked?.unlockedSpellIds?.includes(row.id)).map((row) => row.name);
    const many = names.length > 1;
    return [`Probudil se v tobě vítr – odemčena magie Vzduchu.${names.length ? ` ${many ? 'Nová kouzla' : 'Nové kouzlo'}: ${names.join(', ')}.` : ''} Najdeš ${many ? 'je' : 'ho'} v Knize kouzel a v souboji pod Kouzla (Q).`];
  }

  // Animace ochočení: zlaté světlo obklopí monstrum. Úspěch = monstrum se stáhne do krystalu,
  // ten třikrát zapulzuje; neúspěch = monstrum se vytrhne zpět a krystal se roztříští. Pak done().
  fxCapture(target, success, done) {
    const model = target.model;
    const cx = model.x;
    const cy = model.y - 80 * model.scale;
    const scale0 = model.scaleX;
    const glow = this.add.graphics().setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(0xffd27a, 0.35).fillCircle(0, 0, 90).fillStyle(0xfff2c4, 0.5).fillCircle(0, 0, 45);
    glow.setPosition(cx, cy).setScale(0.2);
    this.tweens.add({ targets: glow, scale: 1.4, duration: 380, ease: 'Cubic.easeOut' });
    // Jiskry krouží kolem monstra a stahují se do středu.
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spark = this.add.circle(cx + Math.cos(angle) * 120, cy + Math.sin(angle) * 80, 5, 0xfff2c4, 1).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: spark, x: cx, y: cy, alpha: 0.2, duration: 620, delay: i * 25, ease: 'Cubic.easeIn', onComplete: () => spark.destroy() });
    }
    const crystal = this.add.graphics().setDepth(DEPTH.fx + 1);
    crystal.fillStyle(0x9fe6ff, 1).fillPoints([{ x: 0, y: -26 }, { x: 16, y: 0 }, { x: 0, y: 26 }, { x: -16, y: 0 }], true);
    crystal.lineStyle(3, 0xffffff, 0.9).strokePoints([{ x: 0, y: -26 }, { x: 16, y: 0 }, { x: 0, y: 26 }, { x: -16, y: 0 }], true);
    crystal.setPosition(cx, cy).setAlpha(0);
    if (success) {
      this.tweens.killTweensOf(model);
      this.tweens.add({ targets: model, scaleX: scale0 * 0.05, scaleY: scale0 * 0.05, alpha: 0, y: model.y - 60 * scale0, duration: 650, delay: 200, ease: 'Cubic.easeIn' });
      this.tweens.add({ targets: crystal, alpha: 1, duration: 200, delay: 700 });
      this.tweens.add({ targets: crystal, scale: 1.35, duration: 180, delay: 900, yoyo: true, repeat: 2, onComplete: () => {
        this.fxBurst(cx, cy, 0xffe3a0);
        this.tweens.add({ targets: [crystal, glow], alpha: 0, duration: 250, onComplete: () => { crystal.destroy(); glow.destroy(); } });
        done();
      } });
      return;
    }
    // Neúspěch: monstrum se zmenší, pak se vytrhne a krystal praskne.
    this.tweens.add({ targets: model, scaleX: scale0 * 0.6, scaleY: scale0 * 0.6, duration: 380, delay: 150, yoyo: true, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: crystal, alpha: 1, duration: 150, delay: 300 });
    this.time.delayedCall(900, () => {
      for (let i = 0; i < 6; i++) {
        const shard = this.add.rectangle(cx, cy, 8, 14, 0x9fe6ff).setDepth(DEPTH.fx + 1).setAngle(i * 60);
        const angle = (i / 6) * Math.PI * 2;
        this.tweens.add({ targets: shard, x: cx + Math.cos(angle) * 90, y: cy + Math.sin(angle) * 70, alpha: 0, angle: shard.angle + 180, duration: 450, onComplete: () => shard.destroy() });
      }
      crystal.destroy();
      this.tweens.add({ targets: glow, alpha: 0, duration: 250, onComplete: () => glow.destroy() });
      model.setScale(scale0);
      done();
    });
  }

  // Nejlepší Soul Crystal pro dané monstrum: prastarého draka jen Dragon Soul Crystal,
  // ostatní nejsilnější z Ancient / Elemental / Greater / Basic (dračí krystal se šetří).
  pickCrystal(wild) {
    const dragon = isAncientDragon(wild);
    // Úkol Nový společník na Skalní stráni: nejdřív Mágův krystal (jinde nejde použít).
    if (!dragon && this.mageCrystalHere() && getItemCount(this.state, 'mage_crystal') > 0) {
      return { id: 'mage_crystal', type: 'basic', name: 'Mágův krystal' };
    }
    const pool = dragon ? SOUL_CRYSTALS.filter((c) => c.type === 'dragonSoul') : SOUL_CRYSTALS.filter((c) => c.type !== 'dragonSoul');
    return pool.find((c) => getItemCount(this.state, c.id) > 0) ?? null;
  }

  // Okno pro pojmenování ochočeného zvířete (společné okno ui/nameInput.js). Prázdné = jméno druhu.
  askMonsterName(monster, done) {
    this.namingMonster = true;
    const speciesName = monster.name;
    askName(this, {
      title: 'Pojmenuj ochočené zvíře',
      fallback: speciesName,
      fallbackLabel: 'Jméno druhu',
      depth: DEPTH.popover + 200,
      onDone: (name) => {
        if (name) monster.name = name;
        this.namingMonster = false;
        done();
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
    // Tutoriál: útok hráče vždy zasáhne.
    const precisionBonus = isRangedSkill(skill) ? 0 : (precision - 80) * 0.005; // u kouzel přesnost = dosah
    const hitChance = this.tutorial && attacker.side === 'player' ? 1 : Phaser.Math.Clamp(skill.accuracy + precisionBonus, 0.05, 0.98);

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
      // Rozdíl úrovní (±6 % za úroveň, nejvýš ±50 %) – DamageCalculator.levelDamageMultiplier.
      damageResult.damage = Math.max(1, Math.round(damageResult.damage * levelDamageMultiplier(attacker, target)));
      damageResult.damage = this.applyTalentDamage(damageResult, attacker, target, skill.category, skill.element);
      const far = isRangedSkill(skill) && this.dist(attacker.x, attacker.y, target.x, target.y) > rangedFullRange(attacker);
      if (far) damageResult.damage = Math.max(1, Math.floor(damageResult.damage * RANGED_FAR_MULTIPLIER));
      // Kritický zásah: základ 5 %, monstrům hrdiny navíc Štěstí (+1 % za bod), ×1,5 poškození.
      const crit = !this.tutorial && Math.random() < (attacker.side === 'player' ? critChance(this.state) : BASE_CRIT_CHANCE);
      if (crit) {
        damageResult.damage = Math.max(1, Math.round(damageResult.damage * CRIT_MULTIPLIER));
        if (target.model) floatingText(this, target.model.x, target.model.y - 190 * target.model.scale, 'Kritický zásah!', '#ffb347', 28);
      }

      // Podpisové schopnosti: více zásahů (hits) – poškození za každý zásah.
      const hits = Math.max(1, Math.floor(Number(skill.hits) || 1));
      damageResult.damage *= hits;

      target.hp = Math.max(0, target.hp - damageResult.damage);
      if (target.monster) target.monster.currentHp = target.hp;
      if (attacker.side === 'player') this.tutorialAfterHit(target, 'monster');

      message = `${monster.name}: ${skill.name} → ${damageResult.damage} poškození${hits > 1 ? ` (${hits} zásahy)` : ''}${crit ? ' (kritický zásah!)' : ''}${far ? ' (z dálky −70 %)' : ''}.${damageResult.effectivenessMessage}`;
      outcome = { type: 'damage', amount: damageResult.damage, multiplier: damageResult.multiplier, crit, attacker };

      // Vysátí (drain): útočník si vyléčí podíl způsobeného poškození.
      if (skill.drain && attacker.hp > 0) {
        const healed = Math.min(attacker.maxHp - attacker.hp, Math.round(damageResult.damage * skill.drain));
        if (healed > 0) {
          attacker.hp += healed;
          if (attacker.monster) attacker.monster.currentHp = attacker.hp;
          outcome.drain = healed;
          message += ` Vysál ${healed} HP.`;
        }
      }
      // Zásah okolí (splash): nepřátelé cíle vedle něj dostanou podíl poškození (nejvýš 2).
      if (skill.splash) {
        const near = this.units
          .filter((u) => u !== target && u.side === target.side && u.hp > 0 && this.dist(u.x, u.y, target.x, target.y) <= 1)
          .slice(0, 2);
        outcome.splash = near.map((u) => {
          const amount = Math.max(1, Math.round(damageResult.damage / hits * skill.splash));
          u.hp = Math.max(0, u.hp - amount);
          if (u.monster) u.monster.currentHp = u.hp;
          return { unit: u, amount };
        });
        if (outcome.splash.length) message += ` Okolí: ${outcome.splash.map((s) => `${s.unit.name} −${s.amount}`).join(', ')}.`;
      }
      // Posílení sebe (selfBuff) po útoku.
      const selfStat = { attack: 'attack', defense: 'defense', aether: 'aether', resolve: 'resolve', speed: 'speed' }[skill.selfBuff?.stat];
      if (selfStat && typeof attacker[selfStat] === 'number') {
        this.addBuff(attacker, skill.id, selfStat, Number(skill.selfBuff.amount) || 0, Math.max(1, Number(skill.selfBuff.duration) || 1));
        outcome.selfBuff = selfStat;
        message += ` ${statLabel(selfStat)} +${skill.selfBuff.amount} na ${skill.selfBuff.duration} tahy.`;
      }

      // Tutoriál: první útok vlka dá vždy krvácení, bez hodu na odolnost (Mág ho vysvětlí v kroku capture).
      const tutorialBleed = this.tutorial && attacker.side === 'player' && !(target.statusEffects ?? []).some((e) => e.id === 'bleed');
      if (tutorialBleed) {
        target.statusEffects ??= [];
        target.statusEffects.push({ id: 'bleed', remaining: 3 });
        message += ' Efekt: krvácení.';
      }
      const statusEffect = this.tutorial ? null : skill.statusEffect;
      if (statusEffect) {
        const result = applyStatusEffect(target, statusEffect, monster);
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
  applyTalentDamage(damageResult, attacker, target, category, element = null) {
    const t = this.talentBonuses;
    const physical = category !== 'magical';
    let multiplier = 1;

    if (attacker?.side === 'player') {
      multiplier += physical ? t.monsterPhysicalDamage : t.monsterMagicalDamage;
      if (damageResult.multiplier > 1) multiplier += t.elementalAdvantageBonus;
      // Elementálně kalená výbava: útoky daného elementu silnější.
      if (element) multiplier *= 1 + gearElementDamage(this.state, element) / 100;
    }
    if (target?.side === 'player') {
      multiplier *= 1 - (physical ? t.monsterPhysicalTaken : t.monsterMagicalTaken);
      // Ochranný přípravek z alchymie: odolnost proti elementu útoku.
      const resist = Number(target.resist?.[element]) || 0;
      if (resist) multiplier *= 1 - resist / 100;
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
    // Počítadlo seslaných kouzel (úkol Píseň živlů).
    this.state.flags ??= {};
    this.state.flags.spellsCast = (Number(this.state.flags.spellsCast) || 0) + 1;
    // Pevná koncentrace / Široké znalosti zvyšují zkušenosti školy.
    const expGain = Math.max(1, Math.round(5 * getMasteryExpMultiplier(this.state, spell.school)));
    const mastery = gainMagicExperience(this.state, spell.school, expGain);
    this.spellReady = false;
    this.actedPlayerIds.clear();

    const school = SCHOOL_NAMES[spell.school] ?? spell.school;
    let note = mastery.gained ? ` Magie ${school} +${mastery.gained} EXP.` : '';
    if (mastery.levelsGained > 0) note += ` Škola ${school} dosáhla úrovně ${mastery.level}.`;
    if (mastery.unlockedSpellIds.length > 0) {
      const names = spellRows.filter((entry) => mastery.unlockedSpellIds.includes(entry.id)).map((entry) => entry.name);
      note += ` Odemčeno: ${names.join(', ')}.`;
    }
    return note;
  }

  // Útočné kouzlo hrdiny. targets = počet cílů (vybraný cíl + další nepřátelé, nejzraněnější
  // první) nebo 'all' = všichni nepřátelé. Každý cíl dostane plné poškození podle svého živlu
  // a případný živelný stavový efekt (spálení, zmrazení, omráčení, paralýza, prokletí).
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
    const targets = this.spellTargets(spell, target);
    const hits = targets.map((unit) => {
      const damageResult = calculateElementalDamage(baseDamage, spell.school, unit.monster?.element);
      unit.hp = Math.max(0, unit.hp - damageResult.damage);
      if (unit.monster) unit.monster.currentHp = unit.hp;
      let status = '';
      if (spell.statusEffect && unit.hp > 0) {
        const result = applyStatusEffect(unit, spell.statusEffect, null);
        if (result.applied) status = ` (${result.name})`;
      }
      return { unit, damageResult, status };
    });
    this.tutorialAfterHit(target, 'spell');

    const verb = `${this.heroName()} ${this.heroVerb('seslal', 'seslala')} ${spell.name}`;
    if (hits.length === 1) {
      const { damageResult, status } = hits[0];
      this.log(`${verb}: ${damageResult.damage} poškození${status}.${damageResult.effectivenessMessage}${note}`);
    } else {
      this.log(`${verb}: ${hits.map((h) => `${h.unit.name} ${h.damageResult.damage}${h.status}`).join(', ')}.${note}`);
    }

    const resumeMode = this.mode;
    this.selectedSpell = null;
    this.mode = 'busy';
    this.refreshBoard();
    this.refreshHeroPanel();
    this.refreshActionButtons();

    let left = hits.length;
    hits.forEach((hit, i) => {
      this.time.delayedCall(i * 140, () => this.fxCast(hit.unit, elementColor(spell.school), () => {
        this.fxHit(hit.unit, { type: 'damage', amount: hit.damageResult.damage, multiplier: hit.damageResult.multiplier });
        left -= 1;
        if (left > 0) return;
        if (this.checkOutcome()) return;
        this.mode = resumeMode === 'spellTarget' ? 'act' : resumeMode;
        this.setHint(this.actHint());
        this.refreshBoard();
        this.refreshActionButtons();
      }));
    });
  }

  // Cíle útočného kouzla: plocha (area = poloměr, 1 = 3 × 3 pole kolem cíle), všichni nepřátelé,
  // nebo vybraný cíl + další živí nepřátelé (nejzraněnější první). Bez mřížky stojí nepřátelé
  // v řadě po dvou polích – plocha zasáhne cíl a jeho sousedy v řadě.
  spellTargets(spell, target) {
    const enemies = this.units.filter((u) => u.side === 'enemy' && u.hp > 0);
    const area = Number(spell.area) || 0;
    if (area > 0) {
      const inArea = (u) => (this.simple
        ? Math.abs(u.y - target.y) <= area * 2
        : Math.max(Math.abs(u.x - target.x), Math.abs(u.y - target.y)) <= area);
      return [target, ...enemies.filter((u) => u !== target && inArea(u))];
    }
    if (spell.targets === 'all') return enemies;
    const count = Math.max(1, Number(spell.targets) || 1);
    const others = enemies.filter((u) => u !== target).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    return [target, ...others].slice(0, count);
  }

  // Podpůrné kouzlo: jeden spojenec, nebo celá parta v boji (allies: 'all').
  // Léčení s cleanse navíc odstraní negativní efekty (otrava, spálení, zmrazení…).
  castSupportSpell(spell, ally) {
    if (!this.spellReady || this.state.mp < this.spellManaCost(spell)) return;
    this.closePopover();

    const note = this.spellCost(spell);
    const effect = spell.effect ?? {};
    const allies = spell.allies === 'all' ? this.units.filter((u) => u.side === 'player' && u.hp > 0) : [ally];
    const outcomes = allies.map((unit) => {
      if (effect.type === 'heal') {
        const healing = Math.max(1, Number(effect.amount) || 1);
        const before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + healing);
        if (unit.monster) unit.monster.currentHp = unit.hp;
        let cleansed = false;
        if (effect.cleanse && unit.statusEffects?.length) {
          unit.statusEffects = [];
          if (unit.monster) unit.monster.statusEffects = [];
          cleansed = true;
        }
        return { unit, outcome: { type: 'heal', amount: unit.hp - before || healing }, text: `+${unit.hp - before} HP${cleansed ? ', efekty odstraněny' : ''}` };
      }
      this.addBuff(unit, spell.id, effect.stat, Number(effect.amount) || 0, Math.max(1, Number(effect.duration) || 1));
      return { unit, outcome: { type: 'buff', stat: effect.stat }, text: '' };
    });

    const verb = `${this.heroName()} ${this.heroVerb('seslal', 'seslala')} ${spell.name}`;
    const message = allies.length > 1
      ? `${verb} na celou partu${outcomes[0].text ? `: ${outcomes.map((o) => `${o.unit.name} ${o.text}`).join(', ')}` : ''}.`
      : `${verb} na ${ally.name}${outcomes[0].text ? `: ${outcomes[0].text}` : ''}.`;

    this.log(message + note);
    this.mode = 'busy';
    this.refreshHeroPanel();
    this.refreshActionButtons();

    let left = outcomes.length;
    outcomes.forEach((o, i) => {
      this.time.delayedCall(i * 140, () => this.fxCast(o.unit, elementColor(spell.school), () => {
        this.refreshUnitBars(o.unit);
        this.fxHit(o.unit, o.outcome);
        left -= 1;
        if (left > 0) return;
        this.mode = 'act';
        this.setHint(this.actHint());
        this.refreshBoard();
        this.refreshActionButtons();
      }));
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

    // Podpisové schopnosti: zásah okolí, vysátí a posílení útočníka.
    for (const { unit, amount } of outcome.splash ?? []) {
      if (unit.model) {
        floatingText(this, unit.model.x, unit.model.y - 150 * unit.model.scale, `-${amount}`, '#ffd27a', 28);
        this.tweens.add({ targets: unit.model, x: unit.model.x + 8, duration: 50, yoyo: true, repeat: 2 });
      }
      this.refreshUnitBars(unit);
      if (unit.hp <= 0) this.faintUnit(unit);
    }
    const attacker = outcome.attacker;
    if (attacker?.model && (outcome.drain || outcome.selfBuff)) {
      const ay = attacker.model.y - 160 * attacker.model.scale;
      if (outcome.drain) floatingText(this, attacker.model.x, ay, `+${outcome.drain}`, '#6dffa8', 30);
      if (outcome.selfBuff) floatingText(this, attacker.model.x, ay - (outcome.drain ? 36 : 0), `▲ ${statLabel(outcome.selfBuff)}`, '#8fd0ff', 24);
      this.refreshUnitBars(attacker);
    }
  }

  fxSkill(attacker, target, skill, outcome, done) {
    const model = attacker.model;
    const color = elementColor(skill.element);
    const finish = () => {
      this.fxHit(target, outcome);
      this.time.delayedCall(450, done);
    };

    if (target === attacker || !isOffensive(skill) || isRangedSkill(skill)) {
      if (target === attacker) {
        this.fxBurst(model.x, model.y - 60 * model.scale, color);
        this.time.delayedCall(200, finish);
      } else {
        this.fxProjectile(model, target.model, color, finish);
      }
      return;
    }

    // Útok zblízka: výpad k cíli a zpět.
    const dx = (target.model.x - model.x) * 0.5;
    const dy = (target.model.y - model.y) * 0.5;
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

    this.applyItemRegen(this.currentUnit);
    const statusResult = processStatusEffects(this.currentUnit);
    // Tutoriál: krvácení Air Elementala nezabije (musí se ochočit).
    if (this.tutorial && this.currentUnit.side === 'enemy' && this.currentUnit.hp < 1) this.currentUnit.hp = 1;
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

    if (isPlayer && this.tutorialStep === 'wait') this.setTutorialStep('attack');
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
    // Tutoriál: Air Elemental neútočí (hráč si v klidu vyzkouší útok a ochočení).
    if (this.tutorial) {
      this.log(`${unit.name} krouží kolem a vyčkává.`);
      if (this.tutorialStep === 'attack') this.setTutorialStep('wait');
      this.time.delayedCall(600, () => this.endTurn());
      return;
    }
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

    const target = this.simple ? this.chooseSimpleTarget(unit) : chooseAITarget(unit, this.units);
    if (!target) {
      this.checkOutcome();
      return;
    }

    // Agresivní monstra (počáteční oblast): nejdou s dosahem taktizovat – vždy jdou k cíli a útočí
    // nejsilnější schopností, která na cíl dosáhne naplno; jinak schopností na dálku s postihem.
    const fullReach = (s) => (isRangedSkill(s) ? rangedFullRange(unit) : MELEE_RANGE);
    const pick = (distance) =>
      [...availableSkills].filter((s) => distance <= fullReach(s)).sort((a, b) => b.power - a.power)[0] ??
      [...availableSkills].filter(isRangedSkill).sort((a, b) => b.power - a.power)[0] ?? null;
    const act = () => {
      const skill = pick(this.dist(unit.x, unit.y, target.x, target.y));
      if (skill) {
        this.selectedSkill = skill;
        this.useSelectedSkill(target);
      } else {
        this.log(`${unit.name} se nedostal do dosahu své techniky.`);
        this.time.delayedCall(400, () => this.endTurn());
      }
    };
    // Kouzlo (magický útok) z místa: v plném dosahu, nebo když nemá útok zblízka – nehne se.
    const distance = this.dist(unit.x, unit.y, target.x, target.y);
    const spell = [...availableSkills].filter(isRangedSkill).sort((a, b) => b.power - a.power)[0];
    const hasMelee = availableSkills.some((s) => !isRangedSkill(s));
    if (spell && distance > 1 && (distance <= rangedFullRange(unit) || !hasMelee)) {
      this.selectedSkill = spell;
      this.useSelectedSkill(target);
      return;
    }
    if (distance > 1) {
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
          this.log('Tvoje kouzla jsou znovu připravena.');
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

  winBattle({ simulated = false } = {}) {
    if (this.finished) return;
    this.finished = true;
    this.mode = 'busy';
    this.refreshActionButtons();
    // HP party před přidělením EXP (nová úroveň mění Max. HP).
    const hp = this.hpSnapshot();

    // Odměna roste s počtem divokých monster. Peníze hrdina nezíská – jen materiály (drop).
    const enemyCount = Math.max(1, this.wildMonsters?.length ?? 1);
    // Simulace: poloviční EXP a kořist (SIMULATION_REWARD).
    const rewardShare = simulated ? SIMULATION_REWARD : 1;
    const reward = Math.round(battleXp(enemyCount) * (1 + exploreBonus(this.state, 'monsterXp')) * rewardShare);
    const notes = [];
    const table = [];
    const heroOldLevel = this.state.level;
    this.state.exp += reward;

    const loot = {};
    for (const wild of this.wildMonsters ?? []) {
      if (wild.captured) continue;
      // Lektvar hledače pokladů / velkého lovu: vyšší šance na drop.
      // + Štěstí: kořist ×(1 + 2,5 % za bod).
      const dropBonus = exploreBonus(this.state, 'drop');
      const dropRandom = () => Math.random() / ((1 + dropBonus) * lootMultiplier(this.state));
      for (const drop of rollDrops(wild.speciesId, dropRandom)) {
        let qty = drop.qty;
        if (simulated) for (let i = 0; i < drop.qty; i++) if (Math.random() >= rewardShare) qty -= 1;
        if (qty > 0) loot[drop.id] = (loot[drop.id] ?? 0) + qty;
      }
    }
    // Kořist do inventáře jen po potvrzení hráčem (okno kořisti, LootScene).
    const lootItems = Object.entries(loot).map(([id, qty]) => ({ id, qty }));

    if (this.isBoss) {
      this.state.flags ??= {};
      this.state.flags.greenvaleCaveBossDefeated = true;
      notes.push('Orčí válečník je poražen. Vrať se za starostou Edricem na radnici.');
    }
    notes.push(...this.tutorialSpellNotes());

    // Poražená monstra se počítají už při omdlení (faintUnit) – i když se souboj nakonec prohraje.

    for (const monster of this.state.party ?? []) {
      const oldLevel = monster.level;
      // Omdlelé monstrum zkušenosti (ani tréninkový bod a důvěru) nedostane.
      if (!(Number(monster.currentHp) > 0)) {
        table.push({
          name: monster.name, exp: 0, oldLevel, level: monster.level,
          progress: monster.level >= 100 ? 'max.' : `${monster.experience} / ${experienceToNextLevel(monster)}`,
          training: 'omdlelo', bond: '+0'
        });
        continue;
      }
      gainMonsterExperience(monster, reward);

      for (let level = oldLevel + 1; level <= monster.level; level++) {
        for (const skillId of getSkillsLearnedAtLevel(monster.speciesId, level, monster.element)) {
          const result = learnSkill(monster, skillId);
          if (result.success) notes.push(`${monster.name} se naučilo ${result.skill.name}`);
        }
      }

      // Lektvar pouta: důvěra za vítězství víckrát.
      const bondBefore = Number(monster.bond) || 0;
      for (let extra = 1; extra < exploreBonus(this.state, 'bond', 1); extra++) rewardBondForVictory(monster);
      const bondResult = rewardBondForVictory(monster);
      if (bondResult.levelUp) notes.push(`Důvěra: ${monster.name} je nyní ${bondResult.newLevel}`);
      if (bondResult.bondSkillResult?.success) notes.push(`${monster.name} získalo schopnost ${bondResult.bondSkillResult.skill.name}`);

      const freePoints = Math.max(0, Math.floor(Number(monster.unspentTrainingPoints) || 0));
      const training = freePoints < 100 ? 1 : 0;
      if (training) monster.unspentTrainingPoints = freePoints + 1;

      table.push({
        name: monster.name,
        exp: reward,
        oldLevel,
        level: monster.level,
        progress: monster.level >= 100 ? 'max.' : `${monster.experience} / ${experienceToNextLevel(monster)}`,
        training: training ? `+${training}` : 'max.',
        bond: `+${(Number(monster.bond) || 0) - bondBefore}`
      });
    }

    while (this.state.exp >= this.state.level * 20) {
      this.state.exp -= this.state.level * 20;
      this.state.level += 1;
      applyHeroLevelUp(this.state);
    }
    table.unshift({
      name: this.heroName(),
      hero: true,
      exp: reward,
      oldLevel: heroOldLevel,
      level: this.state.level,
      progress: `${this.state.exp} / ${this.state.level * 20}`,
      training: '—',
      bond: '—'
    });
    if (this.state.level > heroOldLevel) notes.push(`${this.heroName()} ${this.heroVerb('postoupil', 'postoupila')} na úroveň ${this.state.level}!`);

    if (simulated) notes.push(`Simulace: ${Math.round(SIMULATION_REWARD * 100)} % EXP a kořisti`);
    this.log('Vítězství!');
    // Úkoly: vyhraný souboj, s aktivním jídlem zvlášť (Vaření III – Před bitvou).
    countQuestEvent(this.state, 'win');
    if (this.state.meal?.battlesLeft > 0) countQuestEvent(this.state, 'win:fed');
    const finishVictory = (lootLine) => {
      if (lootLine) notes.unshift(lootLine);
      this.showResult('Vítězství', notes, '#ffe3a0', { hp, table });
    };
    if (!lootItems.length) {
      finishVictory('Kořist: žádný materiál.');
      return;
    }
    openLoot(this, {
      state: this.state,
      title: 'Kořist z boje',
      lines: ['Vyber, co si vezmeš.'],
      items: lootItems,
      onClose: ({ taken }) => {
        const names = taken.map(({ id, qty }) => `${getItem(id)?.name ?? id}${qty > 1 ? ` ×${qty}` : ''}`);
        finishVictory(names.length ? `Získáno: ${names.join(', ')}` : 'Kořist jsi nechal na bojišti.');
      }
    });
  }

  // HP monster v partě: na začátku souboje a teď (hodnota, kterou si odnesou do světa).
  hpSnapshot() {
    return (this.state.party ?? []).map((monster) => {
      const max = Math.max(1, Number(monster.stats?.vitality) || 1);
      const unit = this.units?.find((u) => u.monster === monster);
      const now = unit ? unit.hp : Number(monster.currentHp) || 0;
      const start = this.startHp?.get(monster) ?? now;
      return { monster, max, start: Math.max(0, Math.min(max, start)), end: Math.max(0, Math.min(max, now)) };
    });
  }

  // ======================================================= před bojem

  // Úprava poškození talenty, výbavou a odolnostmi – stejná jako v ručním boji.
  simulationModify() {
    return (result, attacker, target, category, element) => this.applyTalentDamage(result, attacker, target, category, element);
  }

  // Panel před bojem: nepřátelé, porovnání sil, šance na výhru a tři volby.
  openPreBattle() {
    if (this.finished) return;
    // Tutoriál: bez panelu (žádná simulace ani útěk), rovnou boj s průvodcem.
    if (this.tutorial) {
      this.preBattle = true;
      this.createTutorialPanel();
      this.preBattleFight();
      return;
    }
    this.preBattle = true;
    this.mode = 'busy';
    // Lišta akcí se rozmístí až s prvním tahem – do té doby schovaná.
    this.actionBar.setVisible(false);
    const estimate = estimateBattle(this.units, { modify: this.simulationModify(), crit: { player: critChance(this.state), enemy: BASE_CRIT_CHANCE } });
    const chance = Math.round(estimate.winChance * 100);
    const chanceColor = chance >= 70 ? '#9ff0a8' : chance >= 40 ? '#ffe08a' : '#ff9aa6';
    const escape = exploreBonus(this.state, 'escape') ? 100 : ESCAPE_CHANCE;

    const layer = this.add.container(0, 0).setDepth(DEPTH.popover + 50);
    const shade = this.add.rectangle(0, 0, 1920, 1080, 0x02060a, 0.35).setOrigin(0).setInteractive();
    const width = 940;
    const height = 600;
    const x = 960 - width / 2;
    const y = 240;
    // Panel a tlačítka z nové sady UI (stejné jako okna profesí a karty).
    let bg = nineImage(this, 'nu-panel', x, y, width, height, 0.75);
    if (!bg) { bg = this.add.graphics(); drawGlass(bg, x, y, width, height, { edge: 0xffd98a, edgeAlpha: 0.7, alpha: 0.94, radius: 22 }); }

    // Noční vzácné monstrum má v přehledu hvězdu.
    const enemies = this.wildMonsters.map((m) => `${m.nightRare ? "★ " : ""}${m.name} (úr. ${m.level}${m.nightRare ? ", vzácné v noci" : ""})`).join(", ");
    const row = (label, p, e, yy) => [
      cardText(this, x + 50, yy, label, { size: 20, color: '#dcd2b8' }),
      cardText(this, x + 560, yy, String(p), { size: 22, bold: true, color: '#8ff0ff', originX: 0.5 }),
      cardText(this, x + 780, yy, String(e), { size: 22, bold: true, color: '#ff9aa6', originX: 0.5 })
    ];
    const texts = [
      cardText(this, 960, y + 26, this.isBoss ? 'Souboj s bossem' : this.encounter?.zone?.name ? `Setkání – ${this.encounter.zone.name}` : 'Setkání', { size: 40, bold: true, color: '#ffe3a0', originX: 0.5 }),
      cardText(this, 960, y + 84, enemies, { size: 21, originX: 0.5, wrap: width - 80, align: 'center' }),
      cardText(this, x + 560, y + 136, 'Tvoje parta', { size: 19, bold: true, color: '#8ff0ff', originX: 0.5 }),
      cardText(this, x + 780, y + 136, 'Nepřátelé', { size: 19, bold: true, color: '#ff9aa6', originX: 0.5 }),
      ...row('Poškození za kolo (průměr)', estimate.player.damage, estimate.enemy.damage, y + 174),
      ...row('HP celkem', estimate.player.hp, estimate.enemy.hp, y + 212),
      ...row('Zbroj / Vůle', `${estimate.player.armor} / ${estimate.player.resolve}`, `${estimate.enemy.armor} / ${estimate.enemy.resolve}`, y + 250),
      cardText(this, 960, y + 306, `Šance na výhru v simulaci: ${chance} %`, { size: 28, bold: true, color: chanceColor, originX: 0.5 }),
      cardText(this, 960, y + 352, `Simulace: bez tvých kouzel, s nevýhodou ${Math.round(SIMULATION_HANDICAP * 100)} %, za ${Math.round(SIMULATION_REWARD * 100)} % EXP a kořisti.`, { size: 19, color: '#dcd2b8', originX: 0.5, wrap: width - 80, align: 'center' })
    ];

    layer.add([shade, bg, ...texts]);
    // Popis volby (výhody a nevýhody) při najetí myší – nad tlačítky.
    const tip = cardText(this, 960, y + 400, 'Najeď myší na volbu – ukáže se, co ti dá a co ne.', { size: 19, color: '#c9b98f', originX: 0.5, wrap: width - 80, align: 'center', lineSpacing: 4 });
    layer.add(tip);
    const button = (bx, label, sub, hotkey, onClick, options = {}, info = '') => {
      const btn = cardButton(this, layer, bx, y + height - 130, 210, 96, `${label} (${hotkey})
${sub}`, onClick, { size: 21, ...options });
      const zone = btn.objects[2];
      zone.on('pointerover', () => tip.setText(info).setColor('#f3e4bd'));
      zone.on('pointerout', () => tip.setText('Najeď myší na volbu – ukáže se, co ti dá a co ne.').setColor('#c9b98f'));
      return btn;
    };
    button(x + 30, 'Bojovat', 'na mřížce', 'Enter', () => this.preBattleFight(), {},
      'Plný souboj na mřížce. + Pohyb a postavení, útoky na dálku s výhodou, kouzla hrdiny, ochočení, plné EXP a kořist. − Trvá nejdéle.');
    button(x + 250, 'Bez mřížky', 'rychlý souboj', 'R', () => this.preBattleFight({ simple: true }), {},
      'Rychlý souboj: všichni stojí proti sobě a každý útok dosáhne. + Rychlejší, kouzla hrdiny, ochočení, plné EXP a kořist. − Žádná taktika s postavením.');
    // Boss (Orčí hrozba) se simulovat nedá.
    button(x + 470, 'Simulovat', this.isBoss ? 'u bosse nejde' : `výhra ${chance} %`, 'S', () => this.preBattleSimulate(), { disabled: this.isBoss },
      `Výsledek se dopočítá hned. + Okamžitě. − Bez kouzel hrdiny a ochočení, nevýhoda ${Math.round(SIMULATION_HANDICAP * 100)} %, jen ${Math.round(SIMULATION_REWARD * 100)} % EXP a kořisti.`);
    button(x + 690, 'Útěk', `šance ${escape} %`, 'F', () => this.preBattleFlee(), { danger: true },
      `Pokus o útěk se šancí ${escape} %. − Žádné EXP ani kořist; při neúspěchu monstra v partě přijdou o polovinu HP.`);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 250 });
    this.preBattleLayer = layer;
    this.setHint('');
  }

  // Panel průvodce (Mág) nahoře uprostřed – jedna instrukce podle kroku tutoriálu.
  createTutorialPanel() {
    const w = 1000;
    const h = 136;
    const x = 960 - w / 2;
    const y = 150;
    const layer = this.add.container(0, 0).setDepth(DEPTH.popover - 5);
    let bg = nineImage(this, 'nu-panel', x, y, w, h, 0.6);
    if (!bg) { bg = this.add.graphics(); drawGlass(bg, x, y, w, h, { edge: 0xffd98a, edgeAlpha: 0.8, alpha: 0.95, radius: 18 }); }
    const name = cardText(this, x + 34, y + 18, 'Mág', { size: 24, bold: true, color: '#ffd76a' });
    this.tutorialText = cardText(this, x + 34, y + 52, '', { size: 21, color: '#f3e4bd', wrap: w - 68 });
    layer.add([bg, name, this.tutorialText]);
    this.tutorialLayer = layer;
    this.hintText?.setVisible(false); // místo běžné nápovědy radí Mág
    this.setTutorialStep(this.tutorialStep);
  }

  // Tutoriál: zatmavená obrazovka se světlým oknem na tom, na co má hráč kliknout
  // (Air Elemental → útok v nabídce → Kouzla → kouzlo Vzduchu → Air Elemental → Ochočení → Air Elemental).
  spotlightTarget() {
    const playerTurn = !this.finished && !this.preBattle && this.phase === 'units' && this.currentUnit?.side === 'player' && this.mode !== 'busy';
    if (!playerTurn || !['attack', 'spell', 'capture'].includes(this.tutorialStep)) return null;
    const enemy = this.units?.find?.((u) => u.side === 'enemy' && u.hp > 0) ?? null;
    const enemyRect = () => (enemy?.model ? { x: enemy.model.x - 100, y: enemy.model.y - 222, w: 200, h: 248 } : null);
    const button = (b) => ({ x: b.container.x, y: b.container.y, w: ACTION_W, h: 76 });
    if (this.popover?.first) {
      const wanted = { attack: 'attack', spell: 'spells' }[this.tutorialStep];
      if (this.popover.kind === wanted) return this.popover.first;
    }
    if (this.tutorialStep === 'attack') return enemyRect();
    if (this.tutorialStep === 'spell') return this.mode === 'spellTarget' ? enemyRect() : button(this.spellButton);
    return this.mode === 'capture' ? enemyRect() : button(this.captureButton);
  }

  // Rychlý souboj: monstrum hráče, které je na tahu, má zlatý zářivý obrys (glow na jeho
  // obrázcích). Při změně tahu se obrys přesune.
  updateActiveGlow() {
    const unit = this.simple && !this.finished && this.currentUnit?.side === 'player' && this.currentUnit.hp > 0 ? this.currentUnit : null;
    if (unit === this.glowUnit) return;
    const parts = (model) => {
      const out = [];
      const walk = (o) => { if (o?.list) o.list.forEach(walk); else if (o?.preFX) out.push(o); };
      walk(model);
      return out;
    };
    for (const fx of this.glowFx ?? []) fx.parent?.preFX?.remove(fx.glow);
    this.glowFx = [];
    this.glowUnit = unit;
    if (!unit?.model) return;
    for (const part of parts(unit.model)) {
      part.preFX.padding = Math.max(part.preFX.padding || 0, 16); // místo pro obrys za okrajem obrázku
      const glow = part.preFX.addGlow(0xffe08a, 6, 0, false, 0.1, 14);
      this.glowFx.push({ parent: part, glow });
    }
  }

  update() {
    this.updateActiveGlow();
    if (!this.tutorial) return;
    const rect = this.spotlightTarget();
    const sig = rect ? `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}` : '';
    if (sig === this.spotlightSig) return;
    // Hráč udělal krok (zvýraznění se změnilo jen jeho akcí) – rychle? Pak tutoriál zrychlí.
    if (this.spotlightSig && this.time.now - (this.spotlightReadyAt ?? 0) < TUTORIAL_FAST_MS) this.tutorialFast = true;
    this.spotlightSig = sig;
    this.spotlightReadyAt = this.time.now;
    this.spotlightShade ??= this.add.graphics().setDepth(DEPTH.popover - 10);
    this.spotlightRing ??= this.add.graphics().setDepth(DEPTH.popover + 10);
    this.spotlightTween ??= this.tweens.add({ targets: this.spotlightRing, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1 });
    this.spotlightShade.clear();
    this.spotlightRing.clear();
    this.spotlightDelay?.remove();
    if (!rect) return;
    // Krátká pauza mezi kroky, pak zatmavení, světlý rámeček a text Mága naráz (plynule).
    // Během pauzy je panel Mága schovaný celý (prázdný panel by problikl).
    this.tutorialLayer?.setAlpha(0);
    if (this.tutorialFast) this.drawSpotlight(rect);
    else this.spotlightDelay = this.time.delayedCall(TUTORIAL_PAUSE_MS, () => this.drawSpotlight(rect));
  }

  drawSpotlight(rect) {
    const shade = this.spotlightShade.clear();
    const ring = this.spotlightRing.clear();
    const pad = 10;
    const x = rect.x - pad;
    const y = rect.y - pad;
    const w = rect.w + pad * 2;
    const h = rect.h + pad * 2;
    shade.fillStyle(0x000000, this.tutorialFast ? 0.35 : 0.6);
    shade.fillRect(0, 0, 1920, y);
    shade.fillRect(0, y + h, 1920, 1080 - y - h);
    shade.fillRect(0, y, x, h);
    shade.fillRect(x + w, y, 1920 - x - w, h);
    ring.lineStyle(10, 0xffe08a, 0.25).strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 18);
    ring.lineStyle(4, 0xffe08a, 1).strokeRoundedRect(x, y, w, h, 14);
    this.tutorialText?.setText(this.tutorialLine(this.tutorialStep));
    for (const target of [shade, this.tutorialLayer].filter(Boolean)) {
      target.setAlpha(0);
      this.tweens.add({ targets: target, alpha: 1, duration: this.tutorialFast ? 110 : 260 });
    }
  }

  tutorialLine(step) {
    return (this.tutorialFast ? TUTORIAL_TEXT_SHORT[step] : null) ?? TUTORIAL_TEXT[step] ?? '';
  }

  setTutorialStep(step) {
    if (!this.tutorial) return;
    this.tutorialStep = step;
    // Kroky se zatmavením dostanou text až se zatmavením (drawSpotlight), ostatní hned.
    const spotlightStep = ['attack', 'spell', 'capture'].includes(step);
    if (!spotlightStep) {
      this.tutorialText?.setText(this.tutorialLine(step));
      this.tutorialLayer?.setAlpha(1);
    }
    if (this.captureButton) this.refreshActionButtons(); // Ochočení se odemkne až v kroku capture
  }

  // Tutoriál: Air Elemental po zásahu neklesne pod 1 HP (musí se ochočit). Kroky: zásah
  // Dire Wolfem → kouzlo Vzduchu → ochočení. Ochočení se odemkne jen po zásahu vlkem.
  tutorialAfterHit(target, source) {
    if (!this.tutorial || target?.side !== 'enemy') return;
    if (target.hp < 1) target.hp = 1;
    if (target.monster) target.monster.currentHp = target.hp;
    this.refreshUnitBars(target);
    if (source === 'monster' && (this.tutorialStep === 'attack' || this.tutorialStep === 'wait')) {
      // Po zásahu vlkem (krvácení) kouzlo Vzduchu; bez kouzla (nemělo by nastat) rovnou ochočení.
      this.setTutorialStep(this.availableSpells('enemy').length ? 'spell' : 'capture');
    } else if (source === 'spell' && this.tutorialStep === 'spell') {
      this.setTutorialStep('capture');
    }
  }

  closePreBattle() {
    this.preBattle = false;
    this.preBattleLayer?.destroy();
    this.preBattleLayer = null;
  }

  preBattleFight({ simple = false } = {}) {
    if (!this.preBattle) return;
    this.closePreBattle();
    if (simple) this.enterSimpleMode();
    this.actionBar.setVisible(true);
    this.beginTurn();
  }

  // Simulace: jeden průběh rozhodne; HP a spotřebované techniky se přenesou do party.
  preBattleSimulate() {
    if (!this.preBattle || this.isBoss || this.tutorial) return;
    this.closePreBattle();
    const result = runSimulation(this.units, { modify: this.simulationModify(), crit: { player: critChance(this.state), enemy: BASE_CRIT_CHANCE } });
    applySimulationResult(result);
    for (const unit of this.units) {
      this.refreshUnitBars(unit);
      if (unit.hp <= 0) this.faintUnit(unit);
    }
    this.log(`Simulace: ${result.win ? 'vítězství' : 'porážka'} po ${result.rounds} kolech.`);
    this.time.delayedCall(700, () => (result.win ? this.winBattle({ simulated: true }) : this.loseBattle()));
  }

  // Útěk před bojem: stejná šance jako v souboji. Neúspěch boj nespustí,
  // ale všechna monstra v partě přijdou o polovinu svých HP.
  preBattleFlee() {
    if (!this.preBattle || this.tutorial) return;
    this.closePreBattle();
    this.finished = true;
    this.mode = 'busy';
    if (exploreBonus(this.state, 'escape') || Phaser.Math.Between(1, 100) <= ESCAPE_CHANCE) {
      this.log(`${this.heroName()} se s monstry ${this.heroVerb('stáhl', 'stáhla')} dřív, než boj začal.`);
      this.showResult('Útěk', ['Podařilo se uniknout.'], '#bfe2ff');
      return;
    }
    const fleeHp = [];
    for (const monster of this.state.party ?? []) {
      if (!(monster.currentHp > 0)) continue;
      const before = monster.currentHp;
      monster.currentHp = Math.ceil(monster.currentHp / 2);
      const max = Math.max(1, Number(monster.stats?.vitality) || 1);
      fleeHp.push({ monster, max, start: Math.min(max, before), end: Math.min(max, monster.currentHp) });
      const unit = this.units.find((u) => u.monster === monster);
      if (unit) { unit.hp = monster.currentHp; this.refreshUnitBars(unit); }
    }
    this.log('Útěk se nezdařil, monstra utrpěla zranění.');
    this.showResult('Útěk se nezdařil', ['Boj nezačal, ale monstra v partě přišla o polovinu svých HP.'], '#ff9b9b', { hp: fleeHp });
  }

  loseBattle() {
    if (this.finished) return;
    this.finished = true;
    this.mode = 'busy';
    this.refreshActionButtons();
    this.state.hp = 1;

    this.log('Tvoje monstra padla.');
    // Návrat do posledního navštíveného hostince / k léčitelce (InteriorScene.REST_POINTS).
    this.defeated = true;
    const place = (this.state.lastRestPoint ?? 'greenvale_tavern') === 'greenvale_home_3' ? 'k Lioře do domu léčitelky' : 'do hostince';
    this.showResult('Porážka', ['Tvoje monstra padla.', `${this.heroName()} ${this.heroVerb('upadl', 'upadla')} do bezvědomí. ${this.heroVerb('Přinesou ho', 'Přinesou ji')} ${place}, kde se všichni zotaví.`], '#ff9aa6', { hp: this.hpSnapshot() });
  }

  // Přehled po boji. Bez summary jen nadpis a řádky; s `hp` karty monster party
  // (náhled, ubrané HP s animací), s `table` tabulka EXP / úrovní / bodů.
  // Zavře se jen kliknutím na Pokračovat (nebo Enterem).
  showResult(title, lines, color, summary = {}) {
    this.closePopover();
    this.tooltip.hide();
    this.setHint('');
    this.highlight.clear();
    this.refreshActionButtons();

    const layer = this.add.container(0, 0).setDepth(DEPTH.popover + 100);
    const shade = this.add.rectangle(0, 0, 1920, 1080, 0x02060a, 0.55).setOrigin(0).setInteractive();
    const content = this.add.container(0, 0);
    layer.add([shade, content]);
    const add = (obj) => { content.add(obj); return obj; };

    const hpRows = summary.hp ?? [];
    const table = summary.table ?? [];
    const width = hpRows.length || table.length ? 1280 : 700;
    const x = 960 - width / 2;
    let y = 30;

    add(cardText(this, 960, y, title, { size: 52, bold: true, color, originX: 0.5, stroke: '#05080c', strokeThickness: 6 }));
    y += 92;

    // --- karty monster: náhled, jméno, HP před a po souboji
    if (hpRows.length) {
      add(cardText(this, x + 50, y, 'Utržené poškození', { size: 22, bold: true, color: '#ffd98a' }));
      y += 40;
      const gap = 18;
      const cardW = Math.min(280, Math.floor((width - 100 - gap * (hpRows.length - 1)) / hpRows.length));
      const cardH = 262;
      let cx = 960 - (hpRows.length * cardW + (hpRows.length - 1) * gap) / 2;
      hpRows.forEach((row, index) => {
        this.resultMonsterCard(add, row, cx, y, cardW, cardH, index);
        cx += cardW + gap;
      });
      y += cardH + 26;
    }

    // --- tabulka EXP, úrovní, tréninkových bodů a důvěry
    if (table.length) {
      const cols = [
        { key: 'name', label: 'Postava', x: x + 50, origin: 0 },
        { key: 'exp', label: 'Získané EXP', x: x + 480, origin: 0.5 },
        { key: 'level', label: 'Úroveň', x: x + 660, origin: 0.5 },
        { key: 'progress', label: 'EXP do další úrovně', x: x + 870, origin: 0.5 },
        { key: 'training', label: 'Trénink', x: x + 1060, origin: 0.5 },
        { key: 'bond', label: 'Důvěra', x: x + 1180, origin: 0.5 }
      ];
      const rowH = 40;
      const stripes = add(this.add.graphics());
      for (const col of cols) add(cardText(this, col.x, y, col.label, { size: 19, bold: true, color: '#c9b98f', originX: col.origin }));
      y += 34;
      stripes.lineStyle(2, 0xc9a35a, 0.55).lineBetween(x + 36, y - 4, x + width - 36, y - 4);
      table.forEach((row, index) => {
        if (index % 2 === 0) stripes.fillStyle(0xffe3a0, 0.07).fillRect(x + 36, y, width - 72, rowH);
        const ty = y + rowH / 2;
        const levelUp = row.level > row.oldLevel;
        const values = {
          name: row.name,
          exp: `+${row.exp}`,
          level: levelUp ? `${row.oldLevel} → ${row.level}` : String(row.level),
          progress: row.progress,
          training: row.training,
          bond: row.bond
        };
        for (const col of cols) {
          const colour = col.key === 'name' ? (row.hero ? '#ffe3a0' : '#f3e4bd')
            : col.key === 'exp' ? '#8ff0ff'
            : col.key === 'level' && levelUp ? '#9ff0a8' : '#f3e4bd';
          const bold = col.key === 'name' || (levelUp && col.key === 'level');
          add(cardText(this, col.x, ty, values[col.key], { size: 21, bold, color: colour, originX: col.origin, originY: 0.5 }));
        }
        y += rowH;
      });
      y += 20;
    }

    // --- poznámky (kořist, nové schopnosti, simulace…)
    for (const line of lines) {
      const t = add(cardText(this, 960, y, line, { size: 20, originX: 0.5, align: 'center', wrap: width - 120, color: UI_COLORS.text }));
      y += t.height + 6;
    }
    y += 18;

    const buttonW = 300;
    const buttonH = 64;
    const buttonY = y;
    y += buttonH + 34;

    const height = y;
    content.y = Math.max(10, Math.round((1080 - height) / 2));
    let bg = nineImage(this, 'nu-panel', x, 0, width, height, 0.75);
    if (!bg) { bg = this.add.graphics(); drawGlass(bg, x, 0, width, height, { edge: 0xffd98a, edgeAlpha: 0.7, alpha: 0.92, radius: 22 }); }
    content.addAt(bg, 0);
    cardButton(this, content, 960 - buttonW / 2, buttonY, buttonW, buttonH, 'Pokračovat (Enter)', () => this.returnToWorld(0, true), { size: 22 });

    this.resultOpen = true;
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 300 });
  }

  // Karta jednoho monstra v přehledu: náhled jako v kartě Party a HP bar,
  // ze kterého se ubrané HP zbarví červeně a postupně odteče.
  resultMonsterCard(add, row, x, y, w, h, index) {
    const { monster, max, start, end } = row;
    const g = add(this.add.graphics());
    g.fillStyle(0x0b1016, 0.72).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(2, 0xc9a35a, 0.75).strokeRoundedRect(x, y, w, h, 14);

    const still = monsterStillKey(this, monster.speciesId);
    if (still) {
      const image = add(this.add.image(x + w / 2, y + 74, still));
      image.setScale(Math.min((w - 30) / image.width, 128 / image.height));
      if (end <= 0) image.setTint(0x666666);
    } else {
      const model = add(createMonsterModel(this, { speciesId: monster.speciesId, element: monster.element, side: 'player' }));
      model.setPosition(x + w / 2, y + 122).setScale(0.7);
    }

    add(cardText(this, x + w / 2, y + 150, monster.name, { size: 21, bold: true, color: '#ffe7ae', originX: 0.5 }));
    add(cardText(this, x + w / 2, y + 177, end <= 0 ? `Úroveň ${monster.level} · padlo` : `Úroveň ${monster.level}`, {
      size: 17, color: end <= 0 ? '#ff9aa6' : '#c9b98f', originX: 0.5
    }));

    const barX = x + 18;
    const barY = y + 206;
    const barW = w - 36;
    const barH = 20;
    const bar = add(this.add.graphics());
    const draw = (shown) => {
      bar.clear();
      bar.fillStyle(0x05080c, 0.9).fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 6);
      const endW = Math.round(barW * end / max);
      const shownW = Math.round(barW * shown / max);
      if (shownW > endW) bar.fillStyle(0xe0324a, 1).fillRect(barX + endW, barY, shownW - endW, barH);
      if (endW > 0) bar.fillStyle(end / max > 0.35 ? 0x5fd36a : 0xe8b440, 1).fillRect(barX, barY, endW, barH);
    };
    draw(start);

    const lost = Math.max(0, Math.round(start - end));
    add(cardText(this, barX, barY + 36, lost > 0 ? `−${lost} HP` : 'bez zranění', {
      size: 19, bold: true, color: lost > 0 ? '#ff7a8a' : '#9ff0a8', originY: 0.5
    }));
    const hpText = add(cardText(this, barX + barW, barY + 36, `${Math.round(start)} / ${max}`, { size: 19, bold: true, originX: 1, originY: 0.5 }));

    if (lost > 0) {
      const counter = { value: start };
      this.tweens.add({
        targets: counter,
        value: end,
        delay: 650 + index * 180,
        duration: 1100,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          draw(counter.value);
          hpText.setText(`${Math.round(counter.value)} / ${max}`);
        }
      });
    }
  }

  returnToWorld(delay = 0, immediate = false) {
    if (this.returning && !immediate) return;
    if (this.leaving) return;
    this.returning = true;

    const finish = () => {
      if (this.leaving) return;
      this.leaving = true;
      for (const unit of this.units ?? []) {
        // Bonus Max. HP z jídla platí jen v souboji.
        // Ochočené monstrum si nese HP z okamžiku ochočení (jednotka v boji má 0).
        if (unit.monster && this.capturedHp?.has(unit.monster)) unit.monster.currentHp = this.capturedHp.get(unit.monster);
        else if (unit.monster) unit.monster.currentHp = Math.max(0, Math.min(unit.monster.stats.vitality, unit.hp));
      }
      // Jídlo: po souboji regenerace a odečet trvání; bonus Max. many jen pro souboj.
      if (this.mealMaxMp) {
        this.state.maxMp -= this.mealMaxMp;
        this.state.mp = Math.min(this.state.mp, this.state.maxMp);
        this.mealMaxMp = 0;
      }
      applyMealAfterBattle(this.state);
      applyAlchemyAfterBattle(this.state);
      applyReinforcementAfterBattle(this.state);
      SaveSystem.save(this.state);
      this.cameras.main.fadeOut(350, 4, 8, 12);
      // Tutoriál: po ochočení Air Elementala Mág přenese hráče zpět do Hvězdárny.
      let teleport = this.tutorial && this.state.flags?.mageIntroCaught ? 'greenvale_observatory' : null;
      // Porážka: probuzení v posledním hostinci / u léčitelky, všichni vyléčení.
      if (this.defeated) {
        teleport = REST_POINTS[this.state.lastRestPoint] ? this.state.lastRestPoint : 'greenvale_tavern';
        restoreParty(this.state);
        this.state.flags ??= {};
        this.state.flags.revivedHere = true;
      }
      if (teleport) {
        this.state.interiorId = teleport;
        SaveSystem.save(this.state);
      }
      this.cameras.main.once('camerafadeoutcomplete', () => (teleport
        ? this.scene.start('Interior', { state: this.state, interiorId: teleport, fromWorld: false })
        : this.scene.start('World', { state: this.state })));
    };

    if (delay > 0) this.time.delayedCall(delay, finish);
    else finish();
  }
}

function statLabel(stat) {
  return { attack: 'Síla', defense: 'Zbroj', aether: 'Magie', resolve: 'Vůle', speed: 'Tempo' }[stat] ?? stat;
}
