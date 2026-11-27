import { equipSlot, unequipToSlot } from '../../systems/InventorySystem.js';
import { getEquippedItem } from '../../systems/EquipmentSystem.js';
import { SaveSystem } from '../../systems/SaveSystem.js';
import { getItem } from '../../data/items.js';
import { RARITY } from '../../data/fishing.js';
import { describeGearBonus } from '../../data/smithing.js';
import { heroStatSuffix } from '../../data/heroStatLabels.js';
import { openHeroPicker } from './heroPicker.js';
import { EQUIPMENT_SLOTS } from './cardLayout.js';

// Pravý klik na slot výbavy (karta Hrdina i Inventář): okno s předměty pro tento slot
// z inventáře (klik = obléct, dosavadní kus jde do inventáře) a „Sundat“, když je slot
// obsazený. Bez vhodných předmětů „Nemáš žádné vybavení.“ Okno zavře klik mimo nebo Esc
// (scene.heroPicker.close()).
//   slotId     id slotu (weapon, shield, …)
//   x, y       levý horní roh okna (souřadnice obrazovky)
//   onChange(result)  po oblečení / sundání (scéna překreslí a ukáže zprávu)
export function openEquipPicker(scene, state, slotId, x, y, onChange) {
  const label = EQUIPMENT_SLOTS.find((s) => s.id === slotId)?.label ?? slotId;
  const groups = new Map();
  state.inventory.slots.forEach((entry, index) => {
    const item = getItem(entry?.id);
    if (!item || item.slot !== slotId) return;
    const group = groups.get(item.id) ?? { item, index, qty: 0 };
    group.qty += entry.qty;
    groups.set(item.id, group);
  });
  const done = (result) => {
    SaveSystem.save(state);
    onChange?.(result);
  };
  const rows = [...groups.values()].map(({ item, index, qty }) => ({
    itemId: item.id,
    title: `${item.name}${qty > 1 ? ` ×${qty}` : ''}`,
    sub: (item.gear ? `${describeGearBonus(item.gear)}${heroStatSuffix(item.gear.bonus)}` : '') || item.description || '',
    color: RARITY[item.rarity]?.color,
    onClick: () => done(equipSlot(state, index, scene.game.events))
  }));
  const equipped = getEquippedItem(state, slotId);
  return openHeroPicker(scene, {
    x, y,
    title: `${label} – obléct`,
    rows,
    emptyText: 'Nemáš žádné vybavení.',
    footer: equipped ? {
      label: `Sundat: ${equipped.name ?? equipped.id}`,
      danger: true,
      onClick: () => done(unequipToSlot(state, slotId, null, scene.game.events))
    } : null
  });
}
