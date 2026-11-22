import {
  createMonster,
  migrateMonsterStats
} from './MonsterSystem.js';
import {
  createInitialUnlockedRegions,
  normalizeUnlockedRegions
} from './RegionSystem.js';
import { normalizeHeroStats } from './HeroProgressionSystem.js';
import spellRows from '../data/spells.json';
import { normalizeMagicSchools } from './MagicMasterySystem.js';
import { HERO_ATTRIBUTE_DEFAULTS, normalizeHeroAttributes } from './HeroStatsSystem.js';
import {
  createInitialTalentProgress,
  normalizeTalentProgress
} from './TalentSystem.js';
import { INVENTORY_SIZE, normalizeInventory } from './InventorySystem.js';




const SAVE_KEY = 'dragon-souls-save';
const SAVE_VERSION = 2;

// Školy magie se odemykají postupně (MagicMasterySystem.unlockMagicSchool);
// na začátku je odemčená jen Air.
function createStartingMagicMastery() {
  return {
    fire: { level: 0, exp: 0, unlocked: false },
    water: { level: 0, exp: 0, unlocked: false },
    earth: { level: 0, exp: 0, unlocked: false },
    air: { level: 1, exp: 0, unlocked: true },
    light: { level: 0, exp: 0, unlocked: false },
    dark: { level: 0, exp: 0, unlocked: false }
  };
}
function normalizePlayerName(value) {
  const name = Array.from(
    String(value ?? '').normalize('NFC').trim()
  )
    .slice(0, 20)
    .join('');

  return name || 'Arion';
}

// První lovecký společník nové hry: Dire Wolf 5. úrovně, důvěra (bond) 0.
function createStarterDireWolf() {
  const monster = createMonster('dire_wolf', 5);
  monster.bond = 0;
  return monster;
}


// Počáteční inventář: 5 krystalů ochočení a 50 lektvarů many.
function createStartingInventory() {
  const slots = new Array(INVENTORY_SIZE).fill(null);
  slots[0] = { id: 'mana_potion', qty: 50 };
  slots[1] = { id: 'basic_crystal', qty: 5 };
  return { slots };
}

export const SaveSystem = {
 createNew(playerName = 'Arion') {
  const normalizedPlayerName = normalizePlayerName(playerName);
    return {
      version: SAVE_VERSION,
      chapter: 1,
      playerName: normalizedPlayerName,
      interiorId: 'greenvale_hunter_lodge',
     unlockedRegions: createInitialUnlockedRegions(),
      x: 320,
      y: 415,
      level: 1,
      exp: 0,
      hp: 30,
      maxHp: 30,
      mp: 12,
      maxMp: 12,
      attack: 7,
defense: 3,
magicAttack: 7,
magicResistance: 3,
intellect: 5,
magicPower: 0,
      // Rychlost, Štěstí, Charisma – viz HeroStatsSystem.js.
      ...HERO_ATTRIBUTE_DEFAULTS,
gold: 25,

      // starterManaPotions: 50 lektvarů many je už v počátečním inventáři.
      flags: { starterManaPotions: true },
talentProgress: createInitialTalentProgress(1),

      party: [createStarterDireWolf()],
      monsterStorage: [],
      bestiary: {},
      inventory: createStartingInventory(),
      // Vybavení hrdiny – sloty viz EquipmentSystem.js (zatím prázdné).
      equipment: {
        weapon: null,
        shield: null,
        ring: null,
        amulet: null,
        helmet: null,
        armor: null,
        legs: null,
        boots: null
      },

      spellbook: ['air_gale_needle', 'air_tailwind'],
      magicMastery: createStartingMagicMastery()
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);

      // Staré uložené hry verze 1 se pro tento test nepoužijí.
      if (data.version !== SAVE_VERSION) return null;
      data.playerName = normalizePlayerName(data.playerName);
      normalizeHeroStats(data);
      normalizeTalentProgress(data);
      data.party ??= [];
      data.monsterStorage ??= [];
      data.bestiary ??= {};
      normalizeInventory(data);
      data.region ??= 'Greenvale';
data.unlockedRegions = normalizeUnlockedRegions(
  data.unlockedRegions,
  data.region
);


      if (data.party.length > 4) {
        const extraMonsters = data.party.splice(4);
        data.monsterStorage.push(...extraMonsters);
      }

      for (const monster of [...data.party, ...data.monsterStorage]) {
        migrateMonsterStats(monster);

        monster.unspentTrainingPoints = Math.max(
          0,
          Math.min(
            100,
            Math.floor(Number(monster.unspentTrainingPoints) || 0)
          )
        );
      }

      if (!Array.isArray(data.spellbook)) {
        data.spellbook = [];
      }

      if (!data.spellbook.includes('air_gale_needle')) {
        data.spellbook.push('air_gale_needle');
      }

      data.magicMastery ??= {};

      const defaultMastery = createStartingMagicMastery();

      for (const school of Object.keys(defaultMastery)) {
        data.magicMastery[school] ??= {
          level: 0,
          exp: 0
        };
      }

      data.magicMastery.air.level = Math.max(
        1,
        Number(data.magicMastery.air.level) || 0
      );

      data.magicMastery.air.exp ??= 0;
      normalizeMagicSchools(data);
      normalizeHeroAttributes(data);

      // Kouzla, na která už hrdina má mistrovství (např. nově přidaná
      // podpůrná kouzla), patří do Spellbooku – stejně jako při postupu školy.
      for (const spell of spellRows) {
        if (!data.magicMastery[spell.school]?.unlocked) continue;
        const level = Number(data.magicMastery[spell.school]?.level) || 0;
        if ((Number(spell.requiredMastery) || 0) <= level && !data.spellbook.includes(spell.id)) {
          data.spellbook.push(spell.id);
        }
      }

      return data;
    } catch (error) {
      console.error('Uloženou hru se nepodařilo načíst:', error);
      return null;
    }
  },

  save(state) {
    try {
      const payload = {
        ...state,
        version: SAVE_VERSION,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error('Hru se nepodařilo uložit:', error);
      return false;
    }
  },

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
};
