// Elementy mají stejné názvy jako školy magie: Fire, Water, Earth, Air, Light, Dark.
// Navíc je Verdant (příroda) – element monster bez vlastní školy magie.
// Staré názvy (Flame, Stone, Shadow, Astral…) se převádějí na nové, takže starší
// data a uložené hry fungují dál.
const ELEMENT_ALIASES = Object.freeze({
  fire: 'fire',
  flame: 'fire',

  water: 'water',
  ice: 'water',

  earth: 'earth',
  stone: 'earth',
  metal: 'earth',

  air: 'air',

  verdant: 'verdant',
  nature: 'verdant',

  dark: 'dark',
  shadow: 'dark',

  light: 'light',
  astral: 'light',
  arcane: 'light',

  // Poison zůstává zvláštní vlastností útoku,
  // nikoli samostatným elementem poškození.
  poison: 'neutral',
  neutral: 'neutral'
});

// Kruh výhod: Fire > Verdant > Earth > Air > Water > Dark > Light > Fire.
const STRONG_AGAINST = Object.freeze({
  fire: 'verdant',
  verdant: 'earth',
  earth: 'air',
  air: 'water',
  water: 'dark',
  dark: 'light',
  light: 'fire'
});

// Zobrazované názvy elementů (shodné se školami magie).
export const ELEMENT_NAMES = Object.freeze({
  fire: 'Fire',
  water: 'Water',
  earth: 'Earth',
  air: 'Air',
  light: 'Light',
  dark: 'Dark',
  verdant: 'Verdant',
  neutral: 'Neutral'
});

export function elementName(element) {
  return ELEMENT_NAMES[normalizeElement(element)];
}

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
