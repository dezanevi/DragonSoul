import FantasyButton from './FantasyButton.js';
import { EQUIPMENT_SLOTS } from './cardLayout.js';
import { RARITIES, getEquippedItem } from '../../systems/EquipmentSystem.js';

// Osm slotů vybavení. Ikony slotů jsou namalované v podkladu,
// panel přidává rámeček a záři podle vzácnosti, výběr a tooltip.
export default class EquipmentPanel {
  constructor(scene, parent, tooltip, onSelect) {
    this.tooltip = tooltip;
    this.onSelect = onSelect;
    this.selectedId = null;
    this.state = null;

    this.rarityLayer = scene.add.graphics();
    parent.add(this.rarityLayer);

    this.buttons = EQUIPMENT_SLOTS.map(
      (slot) =>
        new FantasyButton(scene, parent, slot.area, {
          label: slot.label,
          radius: 9,
          onClick: () => this.select(slot.id),
          onHover: () => this.showTooltip(slot),
          onOut: () => this.tooltip.hide()
        })
    );
  }

  select(id) {
    this.selectedId = this.selectedId === id ? null : id;
    this.buttons.forEach((button, index) =>
      button.setActive(EQUIPMENT_SLOTS[index].id === this.selectedId)
    );

    const slot = EQUIPMENT_SLOTS.find((entry) => entry.id === this.selectedId) ?? null;
    this.onSelect?.(slot, slot ? getEquippedItem(this.state, slot.id) : null);
  }

  showTooltip(slot) {
    const item = getEquippedItem(this.state, slot.id);

    if (!item) {
      this.tooltip.show(slot.area, slot.label, ['Prázdný slot', 'Kliknutím slot vybereš.']);
      return;
    }

    const rarity = RARITIES[item.rarity] ?? RARITIES.common;
    const lines = [`${slot.label} • ${rarity.label}`];
    if (item.description) lines.push(item.description);

    this.tooltip.show(slot.area, item.name ?? item.id ?? slot.label, lines, rarity.color, rarity.css);
  }

  refresh(state) {
    this.state = state;
    const g = this.rarityLayer;
    g.clear();

    EQUIPMENT_SLOTS.forEach((slot) => {
      const item = getEquippedItem(state, slot.id);
      if (!item) return;

      const { color } = RARITIES[item.rarity] ?? RARITIES.common;
      const { x, y, w, h } = slot.area;

      for (let i = 3; i >= 1; i -= 1) {
        g.lineStyle(i * 3, color, 0.12);
        g.strokeRoundedRect(x - i, y - i, w + i * 2, h + i * 2, 9 + i);
      }
      g.lineStyle(3, color, 1).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 8);
    });
  }
}
