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
