import FantasyButton from './FantasyButton.js';
import { EQUIPMENT_SLOTS } from './cardLayout.js';
import { RARITIES, getEquippedItem } from '../../systems/EquipmentSystem.js';
import { equipKey, itemIconKey } from '../inventorySprites.js';
import { getItem } from '../../data/items.js';
import { gearSummary } from '../../systems/SmithingSystem.js';
import { describeGearBonus } from '../../data/smithing.js';

// Osm slotů vybavení. Podklad karty má sloty prázdné – panel do nich kreslí obrázek slotu
// z hoover-icon.png (tmavý = výchozí, modrý = pod myší), ikonu vybaveného předmětu,
// rámeček a záři podle vzácnosti, výběr a tooltip.
export default class EquipmentPanel {
  constructor(scene, parent, tooltip, onSelect) {
    this.tooltip = tooltip;
    this.onSelect = onSelect;
    this.selectedId = null;
    this.state = null;

    this.scene = scene;
    // Obrázek slotu (o kousek větší než klikací plocha, aby zakryl namalovaný rámeček).
    this.slotImages = EQUIPMENT_SLOTS.map((slot) => {
      if (!scene.textures.exists(equipKey(slot.id, 'normal'))) return null;
      const { x, y, w, h } = slot.area;
      const image = scene.add.image(x + w / 2, y + h / 2, equipKey(slot.id, 'normal')).setDisplaySize(w + 8, h + 8);
      parent.add(image);
      return image;
    });
    const hasImages = this.slotImages.every(Boolean);
    this.itemIcons = EQUIPMENT_SLOTS.map((slot) => {
      const image = scene.add.image(slot.area.x + slot.area.w / 2, slot.area.y + slot.area.h / 2, '__DEFAULT').setVisible(false);
      parent.add(image);
      return image;
    });

    this.rarityLayer = scene.add.graphics();
    parent.add(this.rarityLayer);

    this.buttons = EQUIPMENT_SLOTS.map(
      (slot, index) =>
        new FantasyButton(scene, parent, slot.area, {
          label: slot.label,
          radius: 9,
          drawHover: !hasImages,
          onStateChange: (button) => {
            const image = this.slotImages?.[index];
            if (!image) return;
            const state = button.hovered || button.pressed ? 'hover' : 'normal';
            image.setTexture(equipKey(slot.id, state)).setDisplaySize(slot.area.w + 8, slot.area.h + 8);
          },
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
      this.tooltip.show(slot.area, slot.label, ['Prázdný slot', 'Kliknutím slot vybereš.', ...this.totalLines()]);
      return;
    }

    const rarity = RARITIES[item.rarity] ?? RARITIES.common;
    const lines = [`${slot.label} • ${rarity.label}`];
    // Aktuální popis z dat (uložená výbava může mít starší text).
    const description = getItem(item.id)?.description ?? item.description;
    if (description) lines.push(description);
    lines.push(...this.totalLines());

    this.tooltip.show(slot.area, item.name ?? item.id ?? slot.label, lines, rarity.color, rarity.css);
  }

  // Souhrn velitelského bonusu celé výbavy a výztuhy (Kovářství).
  totalLines() {
    const text = describeGearBonus(gearSummary(this.state));
    return text ? [`Výbava celkem: ${text}`] : [];
  }

  refresh(state) {
    this.state = state;
    const g = this.rarityLayer;
    g.clear();

    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const item = getEquippedItem(state, slot.id);
      // Ikona vybaveného předmětu přes obrázek slotu.
      const icon = this.itemIcons[index];
      const key = item ? itemIconKey(getItem(item.id)?.icon ?? '') : null;
      if (key && this.scene.textures.exists(key)) {
        icon.setTexture(key).setVisible(true);
        icon.setScale((slot.area.h - 10) / Math.max(icon.width, icon.height));
      } else {
        icon.setVisible(false);
      }
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
