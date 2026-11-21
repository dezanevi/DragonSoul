const ELEMENT_ALIASES = Object.freeze({
  flame: 'flame',
  fire: 'flame',

  water: 'water',
  ice: 'water',

  stone: 'stone',
  earth: 'stone',
  metal: 'stone',

  air: 'air',

  verdant: 'verdant',
  nature: 'verdant',

  shadow: 'shadow',
  dark: 'shadow',

  astral: 'astral',
  light: 'astral',
  arcane: 'astral',

  // Poison zůstává zvláštní vlastností útoku,
  // nikoli samostatným elementem poškození.
  poison: 'neutral',
  neutral: 'neutral'
});

const STRONG_AGAINST = Object.freeze({
  flame: 'verdant',
  verdant: 'stone',
  stone: 'air',
  air: 'water',
  water: 'shadow',
  shadow: 'astral',
  astral: 'flame'
});

export function normalizeElement(element) {
  const key = String(element ?? '').trim().toLowerCase();
  return ELEMENT_ALIASES[key] ?? 'neutral';
}

export function getElementMultiplier(attackerElement, targetElement) {
  const attacker = normalizeElement(attackerElement);
  const target = normalizeElement(targetElement);

  if (attacker === 'neutral' || target === 'neutral') {
    return 1;
  }

  if (STRONG_AGAINST[attacker] === target) {
    return 1.25;
  }

  if (STRONG_AGAINST[target] === attacker) {
    return 0.8;
  }

  return 1;
}
export function getStatusEffectChanceMultiplier(
  targetElement,
  statusEffectId
) {
  const target = normalizeElement(targetElement);

  if (target === 'verdant' && statusEffectId === 'poison') {
    return 0.7;
  }

  return 1;
}

export function getElementEffectivenessMessage(multiplier) {
  if (multiplier > 1) {
    return ' Elementový útok byl velmi účinný.';
  }

  if (multiplier < 1) {
    return ' Cíl tomuto elementu odolává.';
  }

  return '';
}
