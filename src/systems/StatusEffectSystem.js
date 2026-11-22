import { getStatusEffectChanceMultiplier } from './ElementSystem.js';

const STATUS_NAMES = {
  poison: 'otrava',
  sleep: 'spánek',
  paralysis: 'paralýza',
  freeze: 'zmrazení',
  burn: 'spálení',
  curse: 'prokletí',
  stun: 'omráčení',
  bleed: 'krvácení'
};

export function applyStatusEffect(target, effect, source = null) {
  if (!target || !effect?.id) {
    return { applied: false, resisted: false };
  }

  if (target.statusImmunities?.includes(effect.id)) {
    return { applied: false, resisted: true };
  }

  const baseChance = Math.max(
    0,
    Math.min(1, Number(effect.chance) || 0)
  );

  // Některé schopnosti mohou zvýšit šanci podle statistiky útočníka.
  const sourceStats = source?.stats ?? source?.monster?.stats ?? {};
  const sourceStatValue = Math.max(
    0,
    Number(sourceStats[effect.sourceStat]) || 0
  );
  const chancePerStat = Math.max(
    0,
    Number(effect.chancePerStat) || 0
  );
  const maximumChance = Math.max(
    0,
    Math.min(1, Number(effect.maxChance ?? 1))
  );

  const chanceBeforeResistance = Math.min(
    maximumChance,
    baseChance + sourceStatValue * chancePerStat
  );

  const resolve = Math.max(
    0,
    Number(
      target.resolve ??
      target.monster?.stats?.resolve ??
      0
    ) || 0
  );

  const resistance = Math.min(0.5, resolve * 0.005);
  const elementalMultiplier = getStatusEffectChanceMultiplier(
    target.monster?.element ?? target.element,
    effect.id
  );

  // Nezlomné velení (talent Souboj): odečte procentní body od výsledné šance.
  const talentReduction = Math.max(0, Number(target.statusChanceReduction) || 0);

  const effectiveChance = Math.max(
    0,
    chanceBeforeResistance * (1 - resistance) * elementalMultiplier - talentReduction
  );

  if (Math.random() >= effectiveChance) {
    return {
      applied: false,
      resisted: resistance > 0 || elementalMultiplier < 1 || talentReduction > 0,
      chance: effectiveChance
    };
  }

  target.statusEffects ??= [];

  const duration = Math.max(
    1,
    Math.floor(Number(effect.duration) || 1)
  );

  const existing = target.statusEffects.find(
    (entry) => entry.id === effect.id
  );

  if (existing) {
    // Efekt se nesčítá; jeho trvání se obnoví nejméně na stanovenou dobu.
    existing.remaining = Math.max(existing.remaining, duration);
  } else {
    target.statusEffects.push({
      id: effect.id,
      remaining: duration
    });
  }

  return {
    applied: true,
    resisted: false,
    chance: effectiveChance,
    name: STATUS_NAMES[effect.id] ?? effect.id
  };
}

export function processStatusEffects(unit) {
  if (!unit) {
    return { skipped: false, messages: [] };
  }

  unit.statusEffects ??= [];

  let skipped = false;
  const messages = [];

  for (const effect of unit.statusEffects) {
    if (
      effect.id === 'poison' ||
      effect.id === 'burn' ||
      effect.id === 'curse' ||
      effect.id === 'bleed'
    ) {
      const damageRate = effect.id === 'bleed' ? 0.04 : 0.06;
      const damage = Math.max(
        1,
        Math.ceil(unit.maxHp * damageRate)
      );

      unit.hp = Math.max(0, unit.hp - damage);

      const name = STATUS_NAMES[effect.id] ?? effect.id;
      messages.push(
        `${unit.name} utrpěl ${damage} poškození (${name}).`
      );
    }

    if (
      effect.id === 'sleep' ||
      effect.id === 'freeze' ||
      effect.id === 'stun'
    ) {
      skipped = true;
      messages.push(
        `${unit.name} kvůli efektu ${STATUS_NAMES[effect.id]} nemůže jednat.`
      );
    }

    if (effect.id === 'paralysis' && Math.random() < 0.25) {
      skipped = true;
      messages.push(`${unit.name} je paralyzován a vynechá tah.`);
    }

    effect.remaining -= 1;
  }

  unit.statusEffects = unit.statusEffects.filter(
    (effect) => effect.remaining > 0
  );

  return { skipped, messages };
}
