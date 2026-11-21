// Společný stav vybavení hrdiny. Karta hrdiny i budoucí inventář čtou
// a mění jen state.equipment a o změně dají vědět událostí na game.events.
// Statistiky se tu nepočítají – bonusy předmětů zatím nic nemění.

export const EQUIPMENT_SLOT_IDS = [
  'weapon',
  'shield',
  'ring',
  'amulet',
  'helmet',
  'armor',
  'legs',
  'boots'
];

export const EQUIPMENT_CHANGED = 'equipment-changed';

export const RARITIES = {
  common: { label: 'Běžný', color: 0xb8b8b8, css: '#d6d6d6' },
  uncommon: { label: 'Neobvyklý', color: 0x4fd36a, css: '#7ff08f' },
  rare: { label: 'Vzácný', color: 0x3fa4ff, css: '#7cc4ff' },
  epic: { label: 'Epický', color: 0xb35cff, css: '#d39bff' },
  legendary: { label: 'Legendární', color: 0xffa21f, css: '#ffc35c' }
};

// Doplní chybějící sloty (starší uložené hry vybavení nemají).
export function normalizeEquipment(state) {
  if (!state) return {};

  state.equipment ??= {};

  for (const slot of EQUIPMENT_SLOT_IDS) {
    state.equipment[slot] ??= null;
  }

  return state.equipment;
}

// Předmět ve slotu: { id, name, rarity, description? } nebo null.
export function getEquippedItem(state, slot) {
  return normalizeEquipment(state)[slot] ?? null;
}

export function equipItem(state, slot, item, events = null) {
  if (!EQUIPMENT_SLOT_IDS.includes(slot)) return null;

  const equipment = normalizeEquipment(state);
  const previous = equipment[slot];

  equipment[slot] = item ?? null;
  events?.emit(EQUIPMENT_CHANGED, { slot, item: equipment[slot], previous });

  return previous;
}

export function unequipItem(state, slot, events = null) {
  return equipItem(state, slot, null, events);
}
