import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { getItem } from '../data/items.js';
import { RARITY } from '../data/fishing.js';
import { addItem, normalizeInventory } from '../systems/InventorySystem.js';
import { itemIconKey } from '../ui/inventorySprites.js';
import { CARD_GOLD, cardText, cardButton, uiWindow, uiTitle, nineImage, ACTIVE_ROW_TINT } from '../ui/fantasyCard.js';

// Okno kořisti (společné pro drop z boje, rybolov i těžbu): všechny získané předměty
// musí hráč potvrdit. Vzít vybrané / Vzít vše / Nevzít nic; předměty, které se do plného
// inventáře nevejdou, jsou označené a předem odškrtnuté.
//
// Spuštění: openLoot(scene, { state, title, items: [{ id, qty, label? }], lines, onClose })
//   – volající scéna se pozastaví a po zavření okna se zase rozběhne;
//   onClose({ taken: [{id, qty}], left: [{id, qty}] }) se zavolá po obnovení volající scény.

export function openLoot(scene, data) {
  scene.scene.pause();
  scene.scene.launch('Loot', { ...data, returnScene: scene.scene.key });
  scene.scene.bringToTop('Loot');
}

const PANEL_W = 760;
const ROW_H = 74;

export default class LootScene extends Phaser.Scene {
  constructor() {
    super('Loot');
  }

  create(data) {
    this.state = data.state;
    this.returnScene = data.returnScene;
    this.onClose = data.onClose;
    this.closing = false;
    normalizeInventory(this.state);

    const items = (data.items ?? []).filter((entry) => getItem(entry.id) && entry.qty > 0);
    this.rows = this.planFit(items).map((row) => ({ ...row, selected: row.fits }));

    const lines = data.lines ?? [];
    const listH = Math.max(1, this.rows.length) * ROW_H;
    const panelH = 150 + lines.length * 28 + listH + 110;
    const x = GAME_WIDTH / 2 - PANEL_W / 2;
    const y = Math.max(40, GAME_HEIGHT / 2 - panelH / 2);

    uiWindow(this, x, y, PANEL_W, panelH, { shade: 0.55 });

    uiTitle(this, GAME_WIDTH / 2, y + 26, data.title ?? 'Kořist', { icon: 'chest', size: 34, center: true });
    lines.forEach((line, index) => {
      cardText(this, GAME_WIDTH / 2, y + 80 + index * 28, line, { size: 19, color: '#cfe2f5', originX: 0.5 });
    });

    const listY = y + 92 + lines.length * 28;
    if (!this.rows.length) {
      cardText(this, GAME_WIDTH / 2, listY + 20, 'Nic k sebrání.', { size: 20, color: '#9aa4ae', originX: 0.5 });
    }
    this.rows.forEach((row, index) => this.createRow(row, x + 30, listY + index * ROW_H, PANEL_W - 60));

    const by = y + panelH - 82;
    const anyFits = this.rows.some((row) => row.fits);
    this.takeButton = cardButton(this, null, x + 30, by, 250, 56, 'Vzít vybrané', () => this.finish('selected'));
    cardButton(this, null, x + 30 + 265, by, 200, 56, 'Vzít vše', () => this.finish('all'), { disabled: !anyFits });
    cardButton(this, null, x + PANEL_W - 30 - 200, by, 200, 56, 'Nevzít nic', () => this.finish('none'), { danger: true });
    this.refreshTakeButton();

    this.onKey = (event) => {
      if (event.repeat) return;
      if (event.code === 'Enter' || event.code === 'KeyE' || event.code === 'Space') this.finish(anyFits ? 'all' : 'none');
      if (event.code === 'Escape') this.finish('none');
    };
    // Klávesa, kterou se okno otevřelo, ho nesmí hned zavřít.
    this.time.delayedCall(250, () => this.input.keyboard.on('keydown', this.onKey));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off('keydown', this.onKey));
  }

  // Kolik se vejde do inventáře (zkouška na kopii slotů).
  planFit(items) {
    const copy = { ...this.state, inventory: { slots: this.state.inventory.slots.map((slot) => (slot ? { ...slot } : null)) } };
    return items.map((entry) => {
      const left = addItem(copy, entry.id, entry.qty);
      return { ...entry, fits: left < entry.qty, fitQty: entry.qty - left };
    });
  }

  createRow(row, x, y, w) {
    const item = getItem(row.id);
    // Řádek z tlačítka nové sady: zlatý = vybraný, modrý = nevybraný.
    const rowBg = nineImage(this, 'nu-btn', x, y, w, ROW_H - 10, 0.4);
    const g = this.add.graphics();
    const draw = () => {
      g.clear();
      if (rowBg) rowBg.setTexture(row.selected ? 'nu-btnActive' : row.fits ? 'nu-btn' : 'nu-btnDisabled').setTint(row.selected ? ACTIVE_ROW_TINT : 0xffffff);
      else {
        g.fillStyle(row.selected ? 0x1b2f4c : 0x151c25, 1).fillRoundedRect(x, y, w, ROW_H - 10, 10);
        g.lineStyle(2, row.selected ? 0xffd76a : 0x3a4552, 1).strokeRoundedRect(x, y, w, ROW_H - 10, 10);
      }
      // Zaškrtávací políčko.
      g.lineStyle(2, row.fits ? 0xf3e4bd : 0x5a636e, 1).strokeRect(x + 16, y + 20, 24, 24);
      if (row.selected) g.fillStyle(0xffd76a, 1).fillRect(x + 21, y + 25, 14, 14);
    };
    draw();

    if (item.icon && this.textures.exists(itemIconKey(item.icon))) {
      const icon = this.add.image(x + 84, y + (ROW_H - 10) / 2, itemIconKey(item.icon));
      icon.setScale(50 / Math.max(icon.width, icon.height));
    }
    const rarity = RARITY[item.rarity] ?? RARITY.common;
    const qty = row.qty > 1 ? ` ×${row.qty}` : '';
    cardText(this, x + 124, y + 10, `${row.label ?? item.name}${qty}`, { size: 22, bold: true, color: rarity.color });
    const note = !row.fits ? 'Nevejde se – inventář je plný' : row.fitQty < row.qty ? `Vejde se jen ${row.fitQty} ks` : rarity.label;
    cardText(this, x + 124, y + 38, note, { size: 16, color: row.fits ? '#9fb3c8' : '#ff9a8a' });

    if (!row.fits) return;
    const zone = this.add.zone(x, y, w, ROW_H - 10).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      row.selected = !row.selected;
      draw();
      this.refreshTakeButton();
    });
  }

  refreshTakeButton() {
    this.takeButton.setDisabled(!this.rows.some((row) => row.selected));
  }

  finish(mode) {
    if (this.closing) return;
    this.closing = true;
    const taken = [];
    const left = [];
    for (const row of this.rows) {
      const take = mode === 'all' ? row.fits : mode === 'selected' ? row.selected : false;
      if (take) {
        const rest = addItem(this.state, row.id, row.qty);
        if (row.qty - rest > 0) taken.push({ id: row.id, qty: row.qty - rest });
        if (rest > 0) left.push({ id: row.id, qty: rest });
      } else {
        left.push({ id: row.id, qty: row.qty });
      }
    }
    const onClose = this.onClose;
    const returnScene = this.returnScene;
    this.scene.stop();
    if (returnScene) this.scene.resume(returnScene);
    onClose?.({ taken, left });
  }
}
