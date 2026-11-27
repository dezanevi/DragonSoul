import {
  getElementMultiplier,
  getElementEffectivenessMessage
} from '../systems/ElementSystem.js';

export function calculateElementalDamage(
  baseDamage,
  attackerElement,
  targetElement
) {
  const safeBaseDamage = Math.max(
    1,
    Math.floor(Number(baseDamage) || 0)
  );

  const multiplier = getElementMultiplier(
    attackerElement,
    targetElement
  );

  return {
    damage: Math.max(
      1,
      Math.floor(safeBaseDamage * multiplier)
    ),
    multiplier,
    effectivenessMessage: getElementEffectivenessMessage(multiplier)
  };
}

// Rozdíl úrovní monster: každá úroveň útočníka nad cílem +6 % poškození, pod cílem −6 %,
// nejvýš ±50 %. Přesila silnějších monster tak bolí víc a slabší nepřátelé méně;
// jídlo, výbava a taktika rozdíl dorovnávají. Platí pro techniky monster (ruční souboj
// i simulace), ne pro kouzla hrdiny.
export const LEVEL_DAMAGE_STEP = 0.06;
export const LEVEL_DAMAGE_CAP = 0.5;

export function levelDamageMultiplier(attacker, target) {
  const a = Number(attacker?.monster?.level ?? attacker?.level);
  const t = Number(target?.monster?.level ?? target?.level);
  if (!Number.isFinite(a) || !Number.isFinite(t)) return 1;
  const shift = Math.max(-LEVEL_DAMAGE_CAP, Math.min(LEVEL_DAMAGE_CAP, (a - t) * LEVEL_DAMAGE_STEP));
  return 1 + shift;
}

export function calculatePhysicalDamage(attacker, target) {
  if (!attacker || !target) {
    throw new Error('Pro výpočet poškození chybí útočník nebo cíl.');
  }

  const attack = Number(attacker.attack) || 0;
  const defense = Number(target.defense) || 0;

  // Poškození se náhodně upraví o -1, 0 nebo +1.
  const variation = Math.floor(Math.random() * 3) - 1;

  let damage = Math.max(1, attack + variation - defense);

  // Obrana sníží příští obdržený zásah na polovinu.
  if (target.guarding) {
    damage = Math.max(1, Math.floor(damage / 2));
    target.guarding = false;
  }

  target.hp = Math.max(0, target.hp - damage);

  return damage;
}
