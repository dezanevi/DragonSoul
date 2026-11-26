// ======================================================================
// Simulace souboje: místo ručního boje se výsledek dopočítá z průměrného poškození
// monster (útok / magie proti zbroji / vůli, elementy, odolnosti), přesnosti a počtu
// použití útočných technik. Hrdinova kouzla se nepočítají. Hráčova monstra mají
// nevýhodu 20 % (poškození × 0,8). Bonusy jídla, elixírů, výbavy a ochranných
// přípravků jsou už ve statistikách jednotek (BattleScene.createPartyUnits).
//
// Šance na výhru = podíl vyhraných z SIMULATION_RUNS náhodných průběhů; skutečný
// výsledek je jeden další průběh (HP a spotřebované techniky se přenesou do party).
// Bez Phaseru – jde testovat v Node.
// ======================================================================

import { calculateElementalDamage } from '../battle/DamageCalculator.js';
import { getMonsterSkills } from './MonsterSkillSystem.js';

export const SIMULATION_HANDICAP = 0.2;
export const SIMULATION_RUNS = 400;
export const SIMULATION_REWARD = 0.5; // podíl EXP a kořisti oproti ručnímu boji
const MAX_ROUNDS = 60; // pojistka: po 60 kolech rozhodne větší podíl zbylých HP

const isOffensive = (skill) => skill?.category === 'physical' || skill?.category === 'magical';

// Stejně jako v souboji: Přesnost zvyšuje zásah jen u fyzických útoků (u kouzel dosah).
function hitChance(unit, skill) {
  const precision = Number(unit.monster?.stats?.precision) || 80;
  const bonus = skill?.category === 'magical' ? 0 : (precision - 80) * 0.005;
  return Math.min(0.98, Math.max(0.05, (Number(skill.accuracy) || 0.9) + bonus));
}

// Poškození jednoho zásahu stejným vzorcem jako v souboji (BattleScene.useSelectedSkill),
// modify = úprava talenty / výbavou / odolností (BattleScene.applyTalentDamage).
export function hitDamage(attacker, skill, target, modify = (result) => result.damage) {
  const magical = skill.category === 'magical';
  const power = magical ? Number(attacker.aether) || 1 : Number(attacker.attack) || 1;
  const defense = magical ? Number(target.resolve) || 0 : Number(target.armor ?? target.defense) || 0;
  const base = Math.max(1, Math.floor(skill.power + power * 0.5 - defense * 0.5));
  const result = calculateElementalDamage(base, skill.element, target.monster?.element);
  let damage = modify(result, attacker, target, skill.category, skill.element);
  if (attacker.side === 'player') damage *= 1 - SIMULATION_HANDICAP;
  return Math.max(1, Math.round(damage));
}

// Kopie jednotek pro jeden průběh (jen to, co simulace potřebuje).
function cloneUnits(units) {
  return units.map((unit) => ({
    unit,
    id: unit.id,
    side: unit.side,
    hp: unit.hp,
    maxHp: unit.maxHp,
    speed: Number(unit.speed) || 0,
    skills: getMonsterSkills(unit.monster).filter(isOffensive),
    uses: Object.fromEntries(getMonsterSkills(unit.monster).map((skill) => [skill.id, skill.remainingUses]))
  }));
}

const hasCharges = (sim) => sim.skills.some((skill) => sim.uses[skill.id] > 0);

// Nejvýhodnější technika proti cíli (očekávané poškození = zásah × šance).
function bestSkill(sim, target, modify) {
  let best = null;
  let bestValue = -1;
  for (const skill of sim.skills) {
    if (!(sim.uses[skill.id] > 0)) continue;
    const value = hitDamage(sim.unit, skill, target.unit, modify) * hitChance(sim.unit, skill);
    if (value > bestValue) { bestValue = value; best = skill; }
  }
  return best;
}

// Cíl: soupeř s nejnižším podílem HP (jako AI v souboji).
function pickTarget(sim, sims) {
  let target = null;
  for (const other of sims) {
    if (other.hp <= 0 || other.side === sim.side) continue;
    if (!target || other.hp / other.maxHp < target.hp / target.maxHp) target = other;
  }
  return target;
}

// Jeden průběh boje. Vrací { win, rounds, sims }.
export function runSimulation(units, { modify, random = Math.random } = {}) {
  const sims = cloneUnits(units);
  const alive = (side) => sims.some((sim) => sim.side === side && sim.hp > 0);
  let rounds = 0;

  while (alive('player') && alive('enemy') && rounds < MAX_ROUNDS) {
    rounds += 1;
    const order = sims.filter((sim) => sim.hp > 0)
      .sort((a, b) => b.speed - a.speed || String(a.id).localeCompare(String(b.id)));
    for (const sim of order) {
      if (sim.hp <= 0) continue;
      if (!hasCharges(sim)) { sim.hp = 0; continue; }
      const target = pickTarget(sim, sims);
      if (!target) break;
      const skill = bestSkill(sim, target, modify);
      // Použití schopností se neodečítají (pravidlo o počtu útoků zrušeno).
      if (random() <= hitChance(sim.unit, skill)) {
        // Rozptyl ±10 % kolem vzorce, ať průběhy nejsou všechny stejné.
        const spread = 0.9 + random() * 0.2;
        target.hp = Math.max(0, target.hp - Math.max(1, Math.round(hitDamage(sim.unit, skill, target.unit, modify) * spread)));
      }
      if (!hasCharges(sim)) sim.hp = 0; // vyčerpané techniky = omdlí (pravidlo souboje)
      if (!alive('player') || !alive('enemy')) break;
    }
  }

  if (alive('player') && alive('enemy')) {
    const share = (side) => {
      const list = sims.filter((sim) => sim.side === side);
      return list.reduce((s, sim) => s + sim.hp, 0) / Math.max(1, list.reduce((s, sim) => s + sim.maxHp, 0));
    };
    return { win: share('player') > share('enemy'), rounds, sims };
  }
  return { win: alive('player') && !alive('enemy'), rounds, sims };
}

// Průměrné očekávané poškození strany za jedno kolo (pro přehled v panelu).
function averageDamage(units, side, modify) {
  const attackers = units.filter((unit) => unit.side === side && unit.hp > 0);
  const targets = units.filter((unit) => unit.side !== side && unit.hp > 0);
  if (!attackers.length || !targets.length) return 0;
  let total = 0;
  for (const attacker of attackers) {
    const skills = getMonsterSkills(attacker.monster).filter((skill) => isOffensive(skill) && skill.remainingUses > 0);
    if (!skills.length) continue;
    let sum = 0;
    for (const target of targets) {
      sum += Math.max(...skills.map((skill) => hitDamage(attacker, skill, target, modify) * hitChance(attacker, skill)));
    }
    total += sum / targets.length;
  }
  return Math.round(total);
}

// Odhad před rozhodnutím: šance na výhru a přehled sil obou stran.
export function estimateBattle(units, { modify, runs = SIMULATION_RUNS, random = Math.random } = {}) {
  let wins = 0;
  for (let i = 0; i < runs; i++) if (runSimulation(units, { modify, random }).win) wins += 1;
  const side = (name) => units.filter((unit) => unit.side === name && unit.hp > 0);
  const sum = (list, key) => list.reduce((total, unit) => total + (Number(unit[key]) || 0), 0);
  const players = side('player');
  const enemies = side('enemy');
  return {
    winChance: wins / runs,
    player: { hp: sum(players, 'hp'), damage: averageDamage(units, 'player', modify), armor: sum(players, 'armor'), resolve: sum(players, 'resolve') },
    enemy: { hp: sum(enemies, 'hp'), damage: averageDamage(units, 'enemy', modify), armor: sum(enemies, 'armor'), resolve: sum(enemies, 'resolve') }
  };
}

// Výsledek jednoho průběhu přenese do jednotek a monster: HP a spotřebované techniky.
export function applySimulationResult(result) {
  for (const sim of result.sims) {
    const { unit } = sim;
    unit.hp = Math.max(0, Math.min(unit.maxHp, sim.hp));
    const monster = unit.monster;
    if (!monster) continue;
    monster.currentHp = unit.hp;
  }
}
