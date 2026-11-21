import {
  createMonster,
  migrateMonsterStats
} from './MonsterSystem.js';
import { learnBondSkill } from './MonsterSkillSystem.js';
import {
  createInitialUnlockedRegions,
  normalizeUnlockedRegions
} from './RegionSystem.js';
import { normalizeHeroStats } from './HeroProgressionSystem.js';
import spellRows from '../data/spells.json';
import {
  createInitialTalentProgress,
  normalizeTalentProgress
} from './TalentSystem.js';




const SAVE_KEY = 'dragon-souls-save';
const SAVE_VERSION = 2;

function createStartingMagicMastery() {
  return {
    fire: { level: 0, exp: 0 },
    water: { level: 0, exp: 0 },
    earth: { level: 0, exp: 0 },
    air: { level: 1, exp: 0 },
    light: { level: 0, exp: 0 },
    dark: { level: 0, exp: 0 }
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

function createTestDireWolf() {
  const monster = createMonster('dire_wolf', 100);
  monster.bond = 100;

  const bondResult = learnBondSkill(monster);

  if (!bondResult.success) {
    throw new Error(
      `Dire Wolf nezískal Bond schopnost: ${bondResult.reason}`
    );
  }

  return monster;
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
gold: 25,

      flags: {},
talentProgress: createInitialTalentProgress(1),

      party: [createTestDireWolf()],
      monsterStorage: [],
      bestiary: {},
      inventory: {
        basic_crystal: 5
      },
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
      data.inventory ??= {};
      data.inventory.basic_crystal ??= 5;
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

      // Kouzla, na která už hrdina má mistrovství (např. nově přidaná
      // podpůrná kouzla), patří do Spellbooku – stejně jako při postupu školy.
      for (const spell of spellRows) {
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
